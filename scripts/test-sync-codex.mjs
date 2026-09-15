import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../src/SyncCodex.js', import.meta.url), 'utf8'), context);
// `getText()` d'un conteneur Apps Script rend toutes les lignes, listes comprises.
const corps = lines => ({ getText: () => lines.join('\n') });
const extract = lines => context.extraireArticlesCodex_(
  { getBody: () => corps(lines) },
  { source: 'Codex Judiciaire de Blancherive' }
);

const articles = extract([
  'Préambule conservé.',
  'Titre préliminaire — Dispositions générales',
  'Article 73 — Des Compagnons',
  'Les Compagnons demeurent une confrérie libre.',
  'Titre VII — Des atteintes au gouvernement et à la justice',
  'Article 74 — De l’outrage',
  'Sanction — 100 septims et 1 heure de cachot.',
  'Chapitre VIII — Crimes',
  'Article 75',
  'Du paiement',
  'Le titre VII reste applicable.',
  'Titre de propriété requis.'
]);
assert.equal(articles.length, 4);
assert.equal(articles[0].texte, 'Préambule conservé.');
assert.equal(articles[1].texte, 'Les Compagnons demeurent une confrérie libre.');
assert.equal(articles[2].sanction, 'Sanction — 100 septims et 1 heure de cachot.');
assert.equal(articles[2].amende, 100);
assert.equal(articles[2].cachot, 1);
assert.equal(articles[3].titre, 'Du paiement');
assert.ok(articles[3].texte.includes('Le titre VII reste applicable.'));
assert.ok(articles[3].texte.includes('Titre de propriété requis.'));
assert.equal(context.estIntertitreCodex_('Titre VII impose une obligation.'), false);

/*
  Articles rédigés en listes à puces. `getParagraphs()` ne retournait pas les
  ListItem : les décrets « De Argentaria », « Armes éthérées » et « Successions
  des châtelleries » ne produisaient aucun article. Apps Script ne rend pas la
  puce elle-même dans le texte, contrairement à l'export .txt du document.
*/
const listes = extract([
  'DÉCRET IMPÉRIAL RELATIF AUX ARMES ÉTHÉRÉES',
  'Article 1 — Définition',
  'Sont qualifiées d’armes éthérées toutes armes aux propriétés anormales.',
  'Article 2 — Interdiction générale',
  'La fabrication et la détention sont interdites.',
  'Article I — Définition et certification',
  'La BCIB certifie les établissements bancaires.'
]);
assert.equal(listes.length, 4, 'Préambule plus trois articles en liste');
assert.equal(listes[1].article, '1');
assert.equal(listes[2].article, '2');
assert.equal(listes[3].article, 'I', 'Les articles en chiffres romains sont reconnus');
assert.equal(listes[2].texte, 'La fabrication et la détention sont interdites.');

// Documents à onglets : `getBody()` ne retourne que le premier.
const onglet = (lines, enfants = []) => ({
  asDocumentTab: () => ({ getBody: () => corps(lines) }),
  getChildTabs: () => enfants
});
const multi = context.extraireArticlesCodex_({
  getBody: () => corps(['Article 1 — Onglet principal uniquement']),
  getTabs: () => [
    onglet(['Article 1 — Des offices', 'Les offices sont attribués par le Conseil.'], [
      onglet(['Article 2 — Des serments', 'Le serment est prêté devant témoin.'])
    ]),
    onglet(['Article 3 — Des sanctions', 'Sanction — 50 septims.'])
  ]
}, { source: 'Constitution cléricale du Conseil des Huit Divins' });
assert.equal(multi.length, 3, 'Les onglets et sous-onglets sont tous lus');
// `Array.from` ramène le tableau du contexte vm dans ce realm-ci.
assert.deepEqual(Array.from(multi, a => a.article), ['1', '2', '3']);
assert.equal(multi[2].amende, 50);

// Sans `getTabs`, le comportement d'origine est conservé.
assert.equal(extract(['Article 9 — Repli', 'Texte.']).length, 1);

/*
  Registre des documents. Il est devenu la déclaration unique : `Codex.js` en
  dérive ses métadonnées, au lieu de redéclarer autorités et liens de son côté.
*/
// `const` reste dans la portée lexicale du contexte : on l'évalue au lieu de
// le lire comme une propriété, contrairement aux déclarations de fonctions.
const lire = expression => vm.runInContext(expression, context);
const registre = Array.from(lire('SYNC_CODEX_DOCUMENTS'), d => ({
  id: d.id, source: d.source, famille: d.famille, local: d.local
}));
const sources = registre.map(d => d.source);
assert.ok(registre.length >= 18, 'Codes et décrets référencés');
assert.equal(new Set(sources).size, sources.length, 'Pas de nom de source en double');
assert.equal(new Set(registre.map(d => d.id)).size, registre.length, 'Pas d’identifiant en double');

registre.forEach(d => {
  assert.ok(d.id && d.source && d.famille, `Entrée incomplète : ${d.source}`);
  assert.equal(d.id.length, 44,
    `${d.source} : un identifiant de ${d.id.length} caractères n’est pas un Google Doc natif, ` +
    'et DocumentApp.openById() ne saurait pas l’ouvrir');
  assert.ok(!/\s/.test(d.id), `${d.source} : identifiant mal formé`);
});

// Le Codex Judiciaire est la seule source des listes d'infractions.
assert.ok(sources.includes(lire('CODEX_JUDICIAIRE_SOURCE')));
assert.equal(registre.filter(d => d.local).length, 1, 'Un seul texte de la châtellerie');

// Documents écartés : abandonnés, non partagés, ou documentation de contexte.
[
  'Codex Procédural de Blancherive',
  'Constitution cléricale du Conseil des Huit Divins',
  'Registre de la Chevalerie de Bordeciel'
].forEach(absent => assert.ok(!sources.includes(absent), `${absent} ne doit pas être référencé`));

// Les décrets forment leur propre famille et ne sont pas du droit local.
const decrets = registre.filter(d => d.famille === 'Décrets impériaux');
assert.ok(decrets.length >= 12, 'Décrets référencés');
assert.ok(decrets.every(d => !d.local));

/*
  `Codex.js` dérive ses métadonnées du registre. Les deux fichiers partagent le
  même espace global dans Apps Script, d'où le chargement dans le même contexte.
*/
vm.runInContext(fs.readFileSync(new URL('../src/Codex.js', import.meta.url), 'utf8'), context);
const meta = context.getCodexDocumentMetadata_();
assert.deepEqual(Object.keys(meta).sort(), sources.slice().sort(),
  'Chaque document du registre expose ses métadonnées, et aucun autre');
registre.forEach(d => {
  const entree = meta[d.source];
  assert.equal(entree.famille, d.famille);
  assert.equal(entree.local, Boolean(d.local));
  assert.equal(entree.url, `https://docs.google.com/document/d/${d.id}/edit`);
  assert.ok(entree.autorite, `${d.source} : autorité manquante`);
  assert.ok(entree.applicabilite, `${d.source} : domaine manquant`);
});

/*
  Découverte des décrets déposés dans un dossier Drive. Le Jarl promulgue au fil
  de l'eau : un décret ne doit demander ni modification de code ni push.
*/
const dossiers = lire('SYNC_CODEX_FOLDERS');
assert.equal(dossiers.length, 1);
assert.equal(dossiers[0].id, '', 'Le dossier reste à créer côté Drive');
assert.equal(dossiers[0].sanctions, true, 'Les décrets du Jarl peuvent sanctionner');

// Sans identifiant de dossier, seul le registre déclaré est lu.
assert.equal(context.lireDocumentsCodex_().length, registre.length);

const fichier = (id, nom) => ({ getId: () => id, getName: () => nom });
const iterateur = items => { let i = 0; return { hasNext: () => i < items.length, next: () => items[i++] }; };
let typeDemande = null;
context.MimeType = { GOOGLE_DOCS: 'application/vnd.google-apps.document' };
context.DriveApp = { getFolderById: id => {
  assert.equal(id, 'dossier-des-decrets');
  return { getFilesByType: type => { typeDemande = type; return iterateur([
    fichier('decret-couvre-feu-id', 'Décret du couvre-feu'),
    fichier('decret-marche-id', 'Décret sur le marché de Blancherive'),
    fichier('doublon-id', '  Décret du couvre-feu  '),
    fichier('vide-id', '   '),
    // Un document homonyme d'une source déclarée ne doit pas la supplanter.
    fichier('faux-codex-id', lire('CODEX_JUDICIAIRE_SOURCE'))
  ]); } };
} };

dossiers[0].id = 'dossier-des-decrets';
const avecDossier = context.lireDocumentsCodex_();
assert.equal(typeDemande, 'application/vnd.google-apps.document',
  'Seuls les Google Docs natifs sont lus ; les autres fichiers sont ignorés');
assert.equal(avecDossier.length, registre.length + 2, 'Doublons et noms vides écartés');

const couvreFeu = avecDossier.find(d => d.source === 'Décret du couvre-feu');
assert.equal(couvreFeu.id, 'decret-couvre-feu-id');
assert.equal(couvreFeu.famille, 'Droit de Blancherive');
assert.equal(couvreFeu.autorite, 'Jarl de Blancherive');
assert.equal(couvreFeu.local, true);
assert.equal(couvreFeu.sanctions, true);
assert.equal(
  avecDossier.filter(d => d.source === lire('CODEX_JUDICIAIRE_SOURCE'))[0].id,
  registre[0].id,
  'Le document déclaré l’emporte sur son homonyme du dossier'
);

/*
  Listes d'infractions. Une source non marquée `sanctions` n'y entre jamais ;
  une source marquée n'y entre que par ses articles réellement sanctionnés.
*/
const ecrites = {};
const feuilleCache = {
  getLastRow: () => 1,
  getRange: (row, col, height, width) => ({
    clearContent() { return this; }, clearDataValidations() { return this; },
    setFontWeight() { return this; },
    setValues(values) { ecrites[`${row},${col}`] = values; return this; },
    setWrap() { return this; }
  }),
  setColumnWidth() {}
};
context.ecrireCachesTechniquesCodex_(feuilleCache, [
  { source: 'Décret du couvre-feu', article: '1', titre: 'Heure de fermeture',
    sanction: 'Sanction — 50 septims.', texte: '' },
  { source: 'Décret du couvre-feu', article: '2', titre: 'Affichage',
    sanction: '', texte: 'Les tenanciers affichent l’horaire.' },
  { source: 'Corpus Juriscivilis Imperialis', article: '61', titre: 'Nécromancie',
    sanction: 'Sanction — 500 septims.', texte: '' }
], avecDossier);
const dropdowns = ecrites['2,12'] || [];
const libelles = Array.from(dropdowns, ligne => ligne[0]).filter(Boolean);
assert.deepEqual(libelles, ['Art. 1 — Heure de fermeture'],
  'Décret sanctionné retenu ; article sans sanction et droit impérial écartés');

// Métadonnées : le cache R:W complète le registre sans l’écraser.
const feuilleMeta = {
  getLastRow: () => 3,
  getRange: () => ({ getDisplayValues: () => [
    ['Décret du couvre-feu', 'Droit de Blancherive', 'Jarl de Blancherive',
     'Décrets de la châtellerie', 'oui', 'https://docs.google.com/document/d/decret-couvre-feu-id/edit'],
    [lire('CODEX_JUDICIAIRE_SOURCE'), 'Famille usurpée', '', '', '', 'https://exemple.invalid']
  ] })
};
const metaCache = context.getCodexDocumentMetadata_(feuilleMeta);
assert.equal(metaCache['Décret du couvre-feu'].autorite, 'Jarl de Blancherive');
assert.equal(metaCache['Décret du couvre-feu'].local, true);
assert.equal(metaCache[lire('CODEX_JUDICIAIRE_SOURCE')].famille, 'Droit de Blancherive',
  'Un document déclaré garde ses métadonnées face à une ligne de cache homonyme');

/*
  Abrogation. Le dossier fait autorité : un décret qu'on en retire doit
  disparaître du Codex et des listes d'infractions. Les caches sont réécrits sur
  toute leur hauteur précédente, sans quoi les articles supprimés resteraient
  visibles en bas de feuille et continueraient d'être proposés aux gardes.
*/
const effacements = [];
const feuilleAvant = hauteurPrecedente => ({
  getLastRow: () => hauteurPrecedente,
  setFrozenRows() {}, setColumnWidth() {},
  getRange: (row, col, height, width) => ({
    clearContent() { effacements.push({ row, col, height, width }); return this; },
    clearDataValidations() { return this; },
    setFontWeight() { return this; }, setValues() { return this; }, setWrap() { return this; }
  })
});

// La feuille contenait 40 lignes ; il n'en reste qu'une après abrogation.
context.ecrireSyncCodex_(feuilleAvant(40), [
  { source: 'Décret du couvre-feu', article: '1', titre: 'Heure de fermeture',
    classification: '', amende: '', travaux: '', cachot: '',
    sanction: 'Sanction — 50 septims.', texte: '', alerte: '' }
]);
const purgeArticles = effacements.find(e => e.col === 1);
assert.ok(purgeArticles.height >= 40,
  `A:J doit être purgé sur les 40 lignes précédentes, pas ${purgeArticles.height}`);

effacements.length = 0;
context.ecrireCacheDocumentsCodex_(feuilleAvant(40), [registre[0]]);
const purgeDocuments = effacements.find(e => e.col === 18);
assert.ok(purgeDocuments.height >= 40, 'R:W purgé sur toute la hauteur précédente');

effacements.length = 0;
context.ecrireCachesTechniquesCodex_(feuilleAvant(40), [], avecDossier);
assert.ok(effacements.find(e => e.col === 12).height >= 40,
  'L:P purgé : un décret abrogé ne doit plus être proposé aux gardes');

dossiers[0].id = '';

console.log('SyncCodex : extraction, registre, dossier, abrogation, listes d’infractions et métadonnées OK.');
