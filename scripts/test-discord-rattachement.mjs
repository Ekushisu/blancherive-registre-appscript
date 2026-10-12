/*
  Rattachement des membres à leur compte Discord (`src/Discord.js`).

  - `getMembresDiscord` : OFFICIER seul, avant toute lecture de configuration
    ou tout appel ; appels par le relais (`relais-discord/`) avec son secret,
    jamais avec un jeton de bot ; pagination, bots exclus, cache, erreurs du
    relais et de Discord lisibles, sans jamais citer un secret.
  - Colonne `Effectifs!ID Discord` : texte de 17 à 20 chiffres ; un nombre
    (arrondi par Sheets), une valeur illisible ou un compte relié à deux
    membres ne valent pour personne ; un compte déjà pris refuse le lien.
  - `Effectifs.js` vérifie le lien avant toute autre écriture et vide la case
    d'une ligne réemployée.

    node scripts/test-discord-rattachement.mjs
*/
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const RELAIS = 'https://relais-discord.garde.workers.dev';
const SECRET_RELAIS = 'secret-du-relais-'.repeat(3);
const SERVEUR = '900000000000000001';
const id = n => String(100000000000000000n + BigInt(n));

// ---------------------------------------------------------------- feuille
class Sheet {
  constructor(rows) { this.rows = rows; this.columns = Math.max(...rows.map(r => r.length)); this.formats = new Map(); this.notes = new Map(); }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return Math.max(0, ...this.rows.map(r => r.length)); }
  getMaxColumns() { return this.columns; }
  getMaxRows() { return 50; }
  insertColumnsAfter(_, count) { this.columns += count; }
  getRange(row, col, height = 1, width = 1) {
    const sheet = this;
    const read = () => Array.from({ length: height }, (_, i) =>
      Array.from({ length: width }, (_, j) => sheet.rows[row - 1 + i]?.[col - 1 + j] ?? ''));
    const range = {
      getValues: read,
      getDisplayValues: () => read().map(r => r.map(String)),
      setValue(value) { (sheet.rows[row - 1] ||= [])[col - 1] = value; return range; },
      clearContent() { for (let i = 0; i < height; i++) for (let j = 0; j < width; j++) if (sheet.rows[row - 1 + i]) sheet.rows[row - 1 + i][col - 1 + j] = ''; return range; },
      setNumberFormat(format) { sheet.formats.set(`${row}:${col}:${height}`, format); return range; },
      setNote(note) { sheet.notes.set(`${row}:${col}`, note); return range; }
    };
    return range;
  }
}
const schema = { prenom: 0, nom: 1, grade: 2, corps: 3, status: 4 };

// ---------------------------------------------------------------- contexte
let proprietes = {}, appels = [], reponses = [], cache = new Map(), attentes = [];
const context = vm.createContext({
  requireRole(token, roles) { if (!roles.includes(token)) throw Error('Vous n\'avez pas les droits nécessaires.'); return { role: token }; },
  PropertiesService: { getScriptProperties: () => ({ getProperty: nom => proprietes[nom] ?? null }) },
  CacheService: { getScriptCache: () => ({ get: cle => cache.get(cle) ?? null, put: (cle, valeur) => cache.set(cle, valeur) }) },
  UrlFetchApp: { fetch(url, options) {
    appels.push({ url, options });
    const [code, corps] = reponses.shift();
    return { getResponseCode: () => code, getContentText: () => typeof corps === 'string' ? corps : JSON.stringify(corps) };
  } },
  Utilities: { sleep: ms => attentes.push(ms) },
  nettoyerEffectifsWeb_: value => String(value ?? '').replace(/ /g, ' ').trim(),
  normaliserEffectifsWeb_: value => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
});
const source = readFileSync('src/Discord.js', 'utf8');
vm.runInContext(source, context);

// Deux fonctions publiques : la liste des membres (OFFICIER) et le diagnostic
// de l'éditeur, qui ne renvoie rien. Tout le reste finit par « _ ».
const publiques = [...source.matchAll(/^function\s+([A-Za-z0-9_$]+)\s*\(/gm)].map(m => m[1]).filter(n => !n.endsWith('_'));
assert.deepEqual(publiques, ['getMembresDiscord', 'verifierConfigurationDiscord']);

const reinitialiser = () => { appels = []; reponses = []; cache = new Map(); attentes = []; };
const configurer = (autres = {}) => {
  proprietes = { DISCORD_RELAIS_URL: RELAIS + '/', DISCORD_RELAIS_SECRET: SECRET_RELAIS, DISCORD_GUILD_ID: SERVEUR, ...autres };
};
const membre = (n, extra = {}) => ({ user: { id: id(n), username: `pseudo${n}`, global_name: null, ...extra.user }, nick: extra.nick ?? null });

// Rôle contrôlé avant la configuration et avant tout appel.
reinitialiser(); proprietes = {};
for (const role of ['GARDE', 'INTENDANT', 'VISITEUR', undefined]) {
  assert.throws(() => context.getMembresDiscord(role), /droits nécessaires/);
}
assert.equal(appels.length, 0);

// Configuration absente ou fausse : message explicite, aucun appel.
assert.throws(() => context.getMembresDiscord('OFFICIER'), /bot Discord n'est pas configuré : renseigner DISCORD_RELAIS_URL, DISCORD_RELAIS_SECRET/);
configurer({ DISCORD_RELAIS_SECRET: '' });
assert.throws(() => context.getMembresDiscord('OFFICIER'), /bot Discord n'est pas configuré/);
configurer({ DISCORD_BOT_TOKEN: 'ancien-jeton', DISCORD_RELAIS_URL: '' });
assert.throws(() => context.getMembresDiscord('OFFICIER'), /bot Discord n'est pas configuré/, 'Le jeton du bot ne suffit plus');
for (const mauvaise of ['http://relais.workers.dev', 'https://relais.workers.dev/api', 'relais.workers.dev', 'https://relais.workers.dev?x=1']) {
  configurer({ DISCORD_RELAIS_URL: mauvaise });
  assert.throws(() => context.getMembresDiscord('OFFICIER'), /DISCORD_RELAIS_URL doit être l'adresse https du relais/);
}
configurer({ DISCORD_GUILD_ID: 'serveur' });
assert.throws(() => context.getMembresDiscord('OFFICIER'), /DISCORD_GUILD_ID n'est pas un identifiant/);
assert.equal(appels.length, 0);

// Pagination par mille, bots exclus, nom = surnom, nom global ou pseudo.
reinitialiser(); configurer();
const premierePage = Array.from({ length: 1000 }, (_, n) => membre(n + 10));
premierePage[0] = membre(10, { nick: 'Zora la Brave' });
premierePage[1] = membre(11, { user: { global_name: 'Aldric' } });
premierePage[2] = membre(12, { user: { bot: true } });
reponses.push([200, premierePage], [200, [membre(2000)]]);
let resultat = context.getMembresDiscord('OFFICIER');
assert.equal(appels.length, 2);
assert.equal(appels[0].url, `${RELAIS}/guilds/${SERVEUR}/members?limit=1000&after=0`, 'Par le relais, barre finale ôtée');
assert.match(appels[1].url, new RegExp(`after=${id(1009)}$`));
assert.deepEqual({ ...appels[0].options.headers }, { 'X-Relais-Secret': SECRET_RELAIS },
  'Le secret du relais, aucun jeton de bot : le relais seul le détient');
assert.equal(appels[0].options.method, 'get');
assert.equal(appels[0].options.payload, undefined);
assert.equal(appels[0].options.muteHttpExceptions, true);
assert.equal(resultat.membres.length, 1000, 'Le bot est exclu');
assert.ok(!resultat.membres.some(m => m.id === id(12)));
assert.deepEqual({ ...resultat.membres.find(m => m.id === id(10)) }, { id: id(10), nom: 'Zora la Brave', pseudo: 'pseudo10' });
assert.equal(resultat.membres.find(m => m.id === id(11)).nom, 'Aldric');
assert.equal(resultat.membres[0].nom, 'Aldric', 'Liste triée par nom');

// Cache : pas de nouvel appel, sauf rafraîchissement demandé.
context.getMembresDiscord('OFFICIER');
assert.equal(appels.length, 2);
reponses.push([200, [membre(3000)]]);
assert.equal(context.getMembresDiscord('OFFICIER', true).membres.length, 1);
assert.equal(appels.length, 3);

// Limitation courte : attendue puis rejouée une fois.
reinitialiser(); configurer();
reponses.push([429, { retry_after: 0.5 }], [200, [membre(1)]]);
assert.equal(context.getMembresDiscord('OFFICIER').membres.length, 1);
assert.deepEqual(attentes, [600]);

// Erreurs de Discord (rendues par le relais) et du relais lui-même : messages
// en français, jamais un secret.
const erreurs = [
  [[429, { retry_after: 30 }], /réessayer dans 30 s/],
  [[401, { message: '401: Unauthorized', code: 0 }], /refuse le jeton du bot : vérifier le secret DISCORD_BOT_TOKEN du relais/],
  [[403, { message: 'Missing Access', code: 50001 }], /Server Members Intent/],
  [[404, { message: 'Unknown Guild', code: 10004 }], /Serveur Discord introuvable/],
  [[403, { message: 'internal network error', code: 40333 }], /^Discord bloque cette requête \(refus réseau, code 40333\)\. Saisir l'identifiant Discord à la main\.$/],
  [[500, { message: 'Oups' }], /Discord a répondu 500 : Oups\./],
  [[401, { message: 'Secret du relais absent ou invalide.', relais: 'secret' }], /^Le relais Discord refuse le secret : DISCORD_RELAIS_SECRET doit être identique au secret RELAIS_SECRET du relais\.$/],
  [[403, { message: 'Requête non autorisée par le relais.', relais: 'refus' }], /^Le relais Discord n'autorise pas cette requête\.$/],
  [[500, { message: 'Secret DISCORD_BOT_TOKEN manquant sur le relais.', relais: 'config' }], /^Le relais Discord est mal configuré : Secret DISCORD_BOT_TOKEN manquant sur le relais\.$/],
  [[502, { message: 'Discord injoignable depuis le relais.', relais: 'reseau' }], /^Discord est injoignable depuis le relais/],
  [[404, '<html>There is nothing here yet</html>'], /^Le relais Discord ne répond pas comme prévu \(HTTP 404\) : vérifier DISCORD_RELAIS_URL/],
  [[429, '<html>error code: 1015</html>'], /bloque temporairement les requêtes/]
];
for (const [reponse, attendu] of erreurs) {
  reinitialiser(); configurer(); reponses.push(reponse);
  assert.throws(() => context.getMembresDiscord('OFFICIER'), error => {
    assert.match(error.message, attendu);
    assert.ok(!error.message.includes(SECRET_RELAIS), 'Le secret du relais ne doit jamais apparaître');
    return true;
  });
}

// Écritures à venir (rôles, pseudo) : méthode, corps JSON, raison d'audit encodée.
reinitialiser(); configurer(); reponses.push([204, '']);
assert.equal(context.appelerDiscordBot_(context.lireConfigBotDiscord_(), `/guilds/${SERVEUR}/members/${id(5)}`, null,
  { method: 'patch', corps: { nick: 'Sgt Eydis' }, raison: 'Registre : grade Sergent' }), null);
assert.equal(appels[0].options.method, 'patch');
assert.equal(appels[0].options.payload, '{"nick":"Sgt Eydis"}');
assert.equal(appels[0].options.contentType, 'application/json');
assert.equal(appels[0].options.headers['X-Audit-Log-Reason'], 'Registre%20%3A%20grade%20Sergent');
reinitialiser(); configurer(); reponses.push([429, { retry_after: 1 }], [429, { retry_after: 1 }]);
assert.throws(() => context.getMembresDiscord('OFFICIER'), /réessayer dans 1 s/, 'Une seule nouvelle tentative');

// ---------------------------------------------------------------- lecture des liens
const lire = rows => context.lireLiensDiscordEffectifs_(rows, schema, 5).map(l => ({ ...l }));
let liens = lire([
  ['Alice', 'Nord', 'Garde', 'Cité', 'En service actif', id(1)],
  ['Bob', 'Sud', 'Garde', 'Cité', 'En service actif', 1.55870353055299e18],
  ['Claire', '', 'Garde', 'Cité', 'En service actif', 'abc'],
  ['Dan', 'Est', 'Garde', 'Cité', 'En service actif', id(4)],
  ['Eve', 'Ouest', 'Garde', 'Cité', 'En service actif', ` ${id(4)} `],
  ['', '', '', '', '', id(6)],
  ['Fred', '', 'Garde', 'Cité', 'En service actif', '']
]);
assert.deepEqual(liens[0], { id: id(1), anomalie: '' });
assert.equal(liens[1].id, '');
assert.match(liens[1].anomalie, /enregistré comme nombre/);
assert.match(liens[2].anomalie, /illisible/);
assert.match(liens[3].anomalie, /Même compte Discord que Eve Ouest/);
assert.match(liens[4].anomalie, /Même compte Discord que Dan Est/);
assert.deepEqual(liens[5], { id: '', anomalie: '' }, 'Une ligne sans nom ne compte pas');
assert.deepEqual(liens[6], { id: '', anomalie: '' });
assert.ok(context.lireLiensDiscordEffectifs_([['A', 'B']], schema, -1).every(l => !l.id && !l.anomalie), 'Colonne absente');

// ---------------------------------------------------------------- écriture des liens
const entetes = ['Prénom', 'Nom', 'Grade', 'Corps', 'Statut', 'ID membre'];
let feuille = new Sheet([entetes, ['Alice', 'Nord', 'Garde', 'Cité', 'En service actif', 'u1'], ['Bob', 'Sud', 'Garde', 'Cité', 'Réserve', 'u2']]);

// Retirer un lien sans colonne : rien à faire, aucune colonne créée.
context.ecrireLienDiscordEffectif_(feuille, schema, 2, '');
assert.equal(feuille.getLastColumn(), 6);

// Premier lien : colonne créée en fin, en-tête, note, format texte.
context.ecrireLienDiscordEffectif_(feuille, schema, 2, ` ${id(1)} `);
assert.equal(feuille.rows[0][6], 'ID Discord');
assert.match(feuille.notes.get('1:7'), /jamais un nombre/);
assert.equal(feuille.formats.get('2:7:49'), '@', 'Colonne entière au format texte');
assert.equal(feuille.formats.get('2:7:1'), '@', 'Case au format texte avant écriture');
assert.equal(feuille.rows[1][6], id(1));

// Compte déjà pris : refus nommant le titulaire, rien d'écrit.
assert.throws(() => context.ecrireLienDiscordEffectif_(feuille, schema, 3, id(1)), /déjà rattaché à Alice Nord/);
assert.equal(feuille.rows[2][6] ?? '', '');
// Réécrire le même lien sur la même ligne reste permis.
context.ecrireLienDiscordEffectif_(feuille, schema, 2, id(1));

// Formats refusés.
for (const mauvais of ['123', 'abcdefghijklmnopq', `${id(1)}0000`, '1.5e18']) {
  assert.throws(() => context.ecrireLienDiscordEffectif_(feuille, schema, 3, mauvais), /17 à 20 chiffres/);
}

// Retrait.
context.ecrireLienDiscordEffectif_(feuille, schema, 2, '');
assert.equal(feuille.rows[1][6], '');
context.ecrireLienDiscordEffectif_(feuille, schema, 3, id(1));
assert.equal(feuille.rows[2][6], id(1), 'Compte libéré, rattachable à un autre membre');

// Ligne réemployée : la case est vidée.
context.effacerLienDiscordLigne_(feuille, 3);
assert.equal(feuille.rows[2][6], '');
context.effacerLienDiscordLigne_(new Sheet([entetes, ['X', 'Y']]), 2); // sans colonne : rien

// ---------------------------------------------------------------- Effectifs.js
/*
  Ordre des opérations, lu dans le source : le lien Discord passe avant toute
  écriture de la fiche, et la case d'une ligne réemployée est vidée avant
  d'écrire le nouveau membre.
*/
const effectifs = readFileSync('src/Effectifs.js', 'utf8');
const corps = nom => {
  const debut = effectifs.indexOf(`function ${nom}(`);
  return effectifs.slice(debut, effectifs.indexOf('\nfunction ', debut + 1));
};
const modifier = corps('modifierEffectifInterne_');
assert.ok(modifier.indexOf('ecrireLienDiscordEffectif_') > modifier.indexOf('clePersonneEffectifsWeb_(expectedPrenom'),
  'Le lien Discord suit le contrôle d’identité de la ligne');
assert.ok(modifier.indexOf('ecrireLienDiscordEffectif_') < modifier.indexOf('.setValue('),
  'Le lien Discord précède toute autre écriture');
assert.match(modifier, /data\.discordId !== undefined/, 'Champ absent : case intacte');
const ajouter = corps('ajouterEffectifInterne_');
assert.ok(ajouter.indexOf('effacerLienDiscordLigne_(sheet, targetRow)') > 0);
assert.ok(ajouter.indexOf('effacerLienDiscordLigne_') < ajouter.indexOf('.setValue(prenom)'));
// Compte choisi dès l'ajout : écrit après l'effacement de la case, avant la fiche.
assert.ok(ajouter.indexOf('ecrireLienDiscordEffectif_(sheet, schema, targetRow, discordId)') > ajouter.indexOf('effacerLienDiscordLigne_(sheet, targetRow)'));
assert.ok(ajouter.indexOf('ecrireLienDiscordEffectif_') < ajouter.indexOf('.setValue(prenom)'));

// Grade de Jarl : ni donné ni retiré par le registre, contrôlé avant toute écriture.
assert.ok(ajouter.indexOf('verifierGradeJarlEffectifsWeb_') > 0 && ajouter.indexOf('verifierGradeJarlEffectifsWeb_') < ajouter.indexOf('.setValue('));
assert.ok(modifier.indexOf('verifierGradeJarlEffectifsWeb_') > 0 && modifier.indexOf('verifierGradeJarlEffectifsWeb_') < modifier.indexOf('.setValue('));
const contexteEffectifs = vm.createContext({});
vm.runInContext(effectifs, contexteEffectifs);
vm.runInContext(readFileSync('src/Organigramme.js', 'utf8'), contexteEffectifs);
const gradeJarl = (grade, actuel) => contexteEffectifs.verifierGradeJarlEffectifsWeb_(grade, actuel);
assert.throws(() => gradeJarl('Jarl', ''), /ne se donne ni ne se retire/, 'Ajout d’un Jarl');
assert.throws(() => gradeJarl(' jarl ', 'Maréchal'), /ne se donne ni ne se retire/, 'Promotion');
assert.throws(() => gradeJarl('Maréchal', 'Jarl'), /ne se donne ni ne se retire/, 'Rétrogradation du Jarl');
gradeJarl('Jarl', 'Jarl'); // le reste de sa fiche reste modifiable
gradeJarl('Garde', 'Recrue');

// Renommage : champs absents, rien ; nom vide ou déjà pris, refus ; contrôlé
// avant le lien Discord, Présences comprises, et Présences écrites avant la fiche.
const feuilleNoms = new Sheet([['Prénom', 'Nom', 'Grade', 'Corps', 'Statut'],
  ['Alice', 'Nord', 'Garde', 'Rivebois', 'En service actif'], ['Bob', 'Sud', 'Garde', 'Rivebois', 'En service actif']]);
const renommer = data => contexteEffectifs.preparerRenommageEffectifsWeb_(feuilleNoms, schema, 2, data, 'Alice', 'Nord');
assert.equal(renommer({}), null);
assert.equal(renommer({ nouveauPrenom: ' Alice ', nouveauNom: 'Nord' }), null, 'Nom inchangé');
assert.deepEqual(JSON.parse(JSON.stringify(renommer({ nouveauPrenom: 'Alicia', nouveauNom: 'Nord' }))),
  { ancien: { prenom: 'Alice', nom: 'Nord' }, nouveau: { prenom: 'Alicia', nom: 'Nord' },
    gardeAncien: 'Alice Nord', gardeNouveau: 'Alicia Nord' });
assert.equal(renommer({ nouveauPrenom: 'Alicia', nouveauNom: '' }).gardeNouveau, 'Alicia ', 'Comme Données!O : espace final sans nom');
assert.ok(renommer({ nouveauPrenom: 'ALICE', nouveauNom: 'Nord' }), 'Casse corrigée : sa propre ligne n’est pas un doublon');
assert.throws(() => renommer({ nouveauPrenom: '', nouveauNom: ' ' }), /prénom ou le nom doit être renseigné/);
assert.throws(() => renommer({ nouveauPrenom: 'bob', nouveauNom: 'SUD' }), /Un membre nommé "bob SUD" existe déjà/);
assert.ok(modifier.indexOf('verifierRenommagePresences_') < modifier.indexOf('ecrireLienDiscordEffectif_'));
assert.ok(modifier.indexOf('renommerMembrePresences_') < modifier.indexOf('.setValue(renommage.nouveau.prenom)'));
// Une case inchangée n'est jamais réécrite : elle n'a pas à repasser la validation de la feuille.
assert.ok(!/\.setValue\((grade|corps|specialite|status)\)/.test(modifier), 'Grade, corps, spécialité et statut écrits seulement s’ils changent');
assert.match(modifier, /if \(valeur !== actuelle\)/);
assert.ok(modifier.indexOf('renommerMembrePresences_') < modifier.indexOf('renommerGardeRegistres_') &&
  modifier.indexOf('renommerGardeRegistres_') < modifier.indexOf('.setValue(renommage.nouveau.prenom)'),
  'Présences, puis Amendes et Prison, puis la fiche');
assert.match(corps('getEffectifs'), /discordId:\s*liensDiscord\[i\]\.id/);
assert.ok(!/discord/i.test(readFileSync('src/Organigramme.js', 'utf8')), 'L’organigramme ne transmet aucun compte Discord');

console.log('Rattachement Discord : membres du serveur, erreurs, lecture et écriture des liens, ordre des écritures validés.');
