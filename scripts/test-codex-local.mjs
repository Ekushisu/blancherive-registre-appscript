// Cache local du Codex et recherche des chefs d'accusation côté navigateur :
// forme compatible avec `getCodex`, clé d'article identique au serveur,
// classement de la recherche, filtres, documents non citables, helpers de
// chefs, résolution des lignes antérieures, chefs fréquents, stockage local
// et requête partagée.
//
//   node scripts/test-codex-local.mjs

import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';

const bundle = await build({ entryPoints: ['ui/src/codex.js'], bundle: true, write: false, format: 'cjs' });
let stockage = new Map(), quotaDepasse = false;
const localStorage = {
  getItem: k => stockage.has(k) ? stockage.get(k) : null,
  setItem(k, v) { if (quotaDepasse) throw new Error('QuotaExceededError'); stockage.set(k, v); },
  removeItem: k => stockage.delete(k)
};
const client = vm.createContext({ console, Intl, localStorage, React: {}, exports: {} });
client.module = { exports: client.exports };
client.globalThis = client;
vm.runInContext(bundle.outputFiles[0].text, client);
const {
  preparerCodex, rechercherArticlesLocal, cleArticle, chefDepuisArticle, cleChef, libelleChef, referenceChef, ajouterChef, retirerChef,
  chefsPourServeur, qualificationMax, resoudreLibelleHistorique, chefsDeLigne, chefsFrequents, chargerCodex, reinitialiserCodex, codexEnMemoire, CLE_CODEX_LOCAL
} = client.module.exports;
const plain = x => JSON.parse(JSON.stringify(x));

// ---------------------------------------------------------------- fixture (même forme que getCodex)
const CPL = 'Code pénal local de Blancherive', CPEN = 'Codex Penitus Imperialis', CJ = 'Codex Judiciaire de Blancherive', RC = 'Registre de la Chevalerie', DEC = 'Décret sur le régime fiscal de Bordeciel';
const art = (source, article, titre, classification, texte, extra = {}) => ({
  source, article, titre, classification, texte, sanction: '', label: article === 'Préambule' ? titre : `Art. ${article} — ${titre}`,
  famille: source === CPL || source === CJ ? 'Droit de Blancherive' : source === RC ? 'Documentation' : source === DEC ? 'Décrets impériaux' : 'Droit spécial',
  abrege: { [CPL]: 'CPL', [CPEN]: 'CPen', [CJ]: 'CJB', [RC]: 'RC', [DEC]: 'Décr. RFB' }[source], citable: source !== RC && article !== 'Préambule',
  montants: [], dureesCachot: [], amende: '', cachot: '', travaux: '', alerte: '', url: '', autorite: '', applicabilite: '', local: source === CPL, ...extra
});
const reponse = {
  version: 'v1',
  sources: [
    { nom: CPL, famille: 'Droit de Blancherive', abrege: 'CPL', citable: true },
    { nom: CPEN, famille: 'Droit spécial', abrege: 'CPen', citable: true },
    { nom: DEC, famille: 'Décrets impériaux', abrege: 'Décr. RFB', citable: true },
    { nom: RC, famille: 'Documentation', abrege: 'RC', citable: false }
  ],
  articles: [
    art(CPL, 'Préambule', 'Préambule', '', 'Considérant que…'),
    art(CPL, '4', 'Refus d’obtempérer à une injonction locale', 'délit', 'Constitue un refus d’obtempérer local le fait de refuser… (article 76)'),
    art(CPL, '15-1', 'Trahison', 'crime', 'Définir trahison'),
    art(CPL, '16', 'Injure', 'contravention', 'Le fait d’adresser à une personne des propos injurieux.'),
    art(CPL, '17', 'Injure publique aggravée', 'délit', 'Injure proférée en public, contre un garde.'),
    art(CPEN, '5', 'Usurpation d’une fonction impériale', 'crime', 'Le fait de se présenter comme une autorité impériale.', { montants: [900] }),
    art(CPEN, '16', 'Outrage', 'délit', 'Injure envers l’Empereur.'),
    art(DEC, '2', 'Taxe sur les échoppes', '', 'Toute échoppe acquitte 50 septims. Injure au fisc.', { montants: [50] }),
    art(RC, '1', 'Des chevaliers', '', 'Injure faite à un chevalier.'),
    art(CJ, '12', 'Vol simple', 'Délit', 'Ancien texte.')
  ]
};
const codex = preparerCodex(reponse);
assert.equal(codex.articles.length, 10);
assert.equal(codex.parCle.get(cleArticle(' CODE pénal local de Blancherive', '16')).titre, 'Injure', 'Clé insensible à la casse et aux espaces');

const titres = (q, f) => plain(rechercherArticlesLocal(codex, q, f)).articles.map(a => `${a.abrege} ${a.article}`);
assert.deepEqual(titres('injure'), ['CPL 16', 'CPL 17', 'CPEN 16'.replace('CPEN', 'CPen'), 'Décr. RFB 2'], 'Titre égal, titre commençant, texte ; jamais le document de contexte');
assert.deepEqual(titres('16'), ['CPL 16', 'CPen 16'], 'Numéro exact, Blancherive d’abord');
assert.deepEqual(titres('cpl 16'), ['CPL 16'], 'Le sigle restreint à la source');
assert.deepEqual(titres('art. 16'), ['CPL 16', 'CPen 16'], '« art. » ignoré');
assert.deepEqual(titres('cpen'), ['CPen 5', 'CPen 16'], 'Un sigle seul liste la source');
assert.deepEqual(titres('15-1'), ['CPL 15-1']);
assert.deepEqual(titres('injure publique'), ['CPL 17']);
assert.deepEqual(titres('INJURE', { groupe: 'imperial' }), ['CPen 16']);
assert.deepEqual(titres('injure', { classification: 'délit' }), ['CPL 17', 'CPen 16']);
assert.deepEqual(titres('injure', { classification: 'contravention' }), ['CPL 16']);
assert.deepEqual(titres('chevalier'), [], 'Document de contexte jamais proposé');
assert.deepEqual(titres('Considérant'), [], 'Préambule jamais proposé');
assert.deepEqual(titres(''), [], 'Sans saisie, rien');
assert.deepEqual(titres('zzz'), []);
assert.throws(() => rechercherArticlesLocal(codex, 'a'.repeat(201)), /invalide/);
assert.equal(rechercherArticlesLocal(codex, 'e').tronque, false);

// ---------------------------------------------------------------- chefs
const injure = codex.parCle.get(cleArticle(CPL, '16'));
const chef = chefDepuisArticle(injure);
assert.deepEqual(plain(chef), { source: CPL, article: '16', titre: 'Injure', classification: 'contravention', abrege: 'CPL' });
assert.equal(libelleChef(chef), 'CPL art. 16 — Injure');
assert.equal(referenceChef(chef), 'CPL art. 16');
assert.equal(libelleChef({ libre: 'Ordre du Jarl' }), 'Motif personnalisé — Ordre du Jarl');
let liste = ajouterChef([], chef);
assert.throws(() => ajouterChef(liste, chef), /déjà retenu/);
assert.throws(() => ajouterChef(liste, { libre: '  ' }), /1 à 1000/);
assert.throws(() => ajouterChef(liste, { libre: 'x'.repeat(1001) }), /1 à 1000/);
liste = ajouterChef(liste, { libre: '  Ordre   du Jarl ' });
assert.equal(liste[1].libre, 'Ordre du Jarl', 'Espaces normalisés');
assert.throws(() => ajouterChef(liste, { libre: 'ordre du jarl' }), /déjà retenu/);
assert.throws(() => ajouterChef(Array.from({ length: 20 }, (_, i) => ({ libre: `m${i}` })), chef), /plus de 20/);
assert.deepEqual(plain(chefsPourServeur(liste)), [{ source: CPL, article: '16' }, { libre: 'Ordre du Jarl' }], 'Le serveur ne reçoit que des références');
assert.equal(retirerChef(liste, chef).length, 1);
assert.equal(qualificationMax(liste), 'contravention');
assert.equal(qualificationMax([chef, chefDepuisArticle(codex.parCle.get(cleArticle(CPL, '15-1')))]), 'crime');
assert.equal(qualificationMax([chef, { classification: 'Délit' }]), 'délit', 'Casse indifférente');
assert.equal(qualificationMax([{ libre: 'x' }]), '');
assert.equal(cleChef({ libre: 'Ordre du Jarl' }), cleChef({ libre: ' ORDRE du jarl ' }));

// ---------------------------------------------------------------- lignes de registre
assert.equal(resoudreLibelleHistorique(codex, 'Art. 12 — Vol simple').source, CJ, 'Libellé antérieur : ancien Codex Judiciaire');
assert.equal(resoudreLibelleHistorique(codex, 'Art. 12 — Autre titre').source, CJ, 'Par numéro à défaut d’égalité');
assert.equal(resoudreLibelleHistorique(codex, 'Motif personnalisé — Décret'), null);
assert.equal(resoudreLibelleHistorique(null, 'Art. 12 — Vol simple'), null);
const ligneNouvelle = { infraction: 'CPL art. 16 — Injure ; Motif personnalisé — Ordre', chefs: [chef, { libre: 'Ordre' }, { source: 'Décret disparu', article: '3', titre: 'Titre figé', classification: '', abrege: 'Décr. D' }] };
const entrees = chefsDeLigne(codex, ligneNouvelle);
assert.equal(entrees.length, 3);
assert.equal(entrees[0].article, injure);
assert.equal(entrees[1].article, null);
assert.equal(entrees[2].article, null, 'Article retiré du Codex : chef affiché depuis l’instantané');
assert.equal(entrees[2].chef.titre, 'Titre figé');
const ancienne = chefsDeLigne(codex, { infraction: 'Art. 12 — Vol simple', chefs: null });
assert.equal(ancienne.length, 1);
assert.equal(ancienne[0].article.source, CJ);
assert.equal(ancienne[0].historique, true);
assert.deepEqual(plain(chefsDeLigne(codex, { infraction: 'Motif personnalisé — Décret du Jarl', chefs: null })[0].chef), { libre: 'Décret du Jarl' });
assert.deepEqual(plain(chefsDeLigne(codex, { infraction: 'Art. 99 — Inconnu' })[0].chef), { libre: 'Art. 99 — Inconnu' }, 'Libellé irrésolu conservé en référence libre');
assert.deepEqual(plain(chefsDeLigne(codex, { infraction: '' })), []);
assert.deepEqual(plain(chefsDeLigne(null, { infraction: 'Art. 12 — Vol simple' })[0].chef), { libre: 'Art. 12 — Vol simple' }, 'Sans Codex chargé, la ligne reste lisible');

const rows = [ligneNouvelle, ligneNouvelle, { infraction: 'Art. 12 — Vol simple' }, { chefs: [chefDepuisArticle(codex.parCle.get(cleArticle(CPEN, '5')))] }, { chefs: [chef] }];
assert.deepEqual(plain(chefsFrequents(codex, rows).map(referenceChef)), ['CPL art. 16', 'CJB art. 12', 'CPen art. 5'], 'Par fréquence, articles du Codex seulement');
assert.equal(chefsFrequents(codex, rows, 1).length, 1);
assert.deepEqual(plain(chefsFrequents(codex, undefined)), []);

// ---------------------------------------------------------------- chargement et stockage
let appels = [];
const serveur = { version: 'v1', ...reponse };
const serverCall = (nom, token, version) => { appels.push({ nom, token, version }); return Promise.resolve(version === serveur.version ? { version: serveur.version, articles: null, sources: null } : plain(serveur)); };
reinitialiserCodex();
const [a, b] = await Promise.all([chargerCodex(serverCall, 'GARDE'), chargerCodex(serverCall, 'GARDE')]);
assert.equal(a, b);
assert.equal(appels.length, 1, 'Appels simultanés partagés');
assert.equal(appels[0].nom, 'getCodex');
assert.equal(appels[0].version, '');
assert.ok(stockage.has(CLE_CODEX_LOCAL));

reinitialiserCodex(); appels = [];
const c = await chargerCodex(serverCall, 'VISITEUR');
assert.equal(appels[0].version, 'v1', 'Version stockée renvoyée au serveur');
assert.equal(c.articles.length, 10, 'Codex conservé quand le serveur ne renvoie rien');
assert.equal(codexEnMemoire(), c);

serveur.version = 'v2'; serveur.articles = [...reponse.articles, art(CPL, '18', 'Menace', 'délit', 'Menacer.')];
reinitialiserCodex(); appels = [];
const d = await chargerCodex(serverCall, 'GARDE');
assert.equal(d.articles.length, 11, 'Nouvelle version : Codex remplacé');
assert.equal(JSON.parse(stockage.get(CLE_CODEX_LOCAL)).version, 'v2');

reinitialiserCodex(); stockage.clear(); quotaDepasse = true;
assert.equal((await chargerCodex(serverCall, 'GARDE')).articles.length, 11);
assert.equal(stockage.size, 0, 'Quota dépassé : Codex en mémoire seulement');
quotaDepasse = false;

reinitialiserCodex(); stockage.set(CLE_CODEX_LOCAL, '{"version":1'); appels = [];
assert.equal((await chargerCodex(serverCall, 'GARDE')).articles.length, 11);
assert.equal(appels[0].version, '', 'Stockage corrompu ignoré');

reinitialiserCodex(); stockage.clear();
await assert.rejects(chargerCodex(() => Promise.reject(new Error('Connexion perdue')), 'GARDE'), /Connexion perdue/);
assert.equal(codexEnMemoire(), null);
assert.equal((await chargerCodex(serverCall, 'GARDE')).articles.length, 11);

console.log('Codex local : forme, clé, classement de la recherche, filtres, non citables, chefs, lignes antérieures, fréquents, stockage et requête partagée OK.');
