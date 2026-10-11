/*
  Connexion par Discord (`Auth.js` + `Discord.js`).

  - Rôle déduit de la fiche : service actif seul, OFFICIER à partir de
    Sergent-Chef dans l'ordre de `Données!A`, sans exception de corps ; grade
    inconnu → GARDE ; réserve, départ, statut mal saisi → aucun accès.
  - Table d'accès `DISCORD_ACCES` : liens valides seuls, écrite seulement si
    elle change ; une session Discord tombe dès que sa fiche ne lui donne plus
    ce rôle, qu'elle est déliée ou que `AUTH_DISCORD` est coupé.
  - `ouvrirSessionDiscord` : interrupteur et format du code contrôlés avant
    tout appel ; échange du code, identité, messages lisibles ; aucun secret
    dans l'adresse d'autorisation ni dans le jeton.

    node scripts/test-connexion-discord.mjs
*/
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SECRET_APPLI = 'secret-application';
const id = n => String(100000000000000000n + BigInt(n));
const uuid = n => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;

// ---------------------------------------------------------------- feuilles
class Sheet {
  constructor(rows) { this.rows = rows; }
  getLastRow() { return this.rows.length; }
  getRange(row, col, height = 1, width = 1) {
    const read = () => Array.from({ length: height }, (_, i) =>
      Array.from({ length: width }, (_, j) => this.rows[row - 1 + i]?.[col - 1 + j] ?? ''));
    return { getValues: read, getDisplayValues: () => read().map(r => r.map(String)) };
  }
}
const GRADES = ['Commander', 'Major', 'Capitaine', 'Lieutenant-Chef', 'Lieutenant', 'Sergent-Chef',
  'Sergent', 'Caporal-Chef', 'Caporal', 'Garde', 'Cadet', 'Recrue'];
let donnees = new Sheet([['Grade'], ...GRADES.map(g => [g])]);
const entetes = ['Prénom', 'Nom', 'Grade', 'Corps', 'Statut', 'ID membre', 'ID Discord'];
const fiche = (n, prenom, grade, corps, statut, discord) => [prenom, 'Test', grade, corps, statut, uuid(n), discord];
const effectifs = new Sheet([entetes,
  fiche(1, 'Ragnhild', 'Capitaine', 'Inquisition', 'En service actif', id(1)),
  fiche(2, 'Eydis', 'Sergent-Chef', 'Garnison de Rivebois', 'En service actif', id(2)),
  fiche(3, 'Sven', 'Sergent', 'Cité de Blancherive', 'En service actif', id(3)),
  fiche(4, 'Ulfgar', 'Lieutenant', 'Hird du Jarl', 'en service ACTIF', id(4)),
  fiche(5, 'Olaf', 'Garde', 'Cité de Blancherive', 'Réserve', id(5)),
  fiche(6, 'Bjorn', 'Caporal', 'Cité de Blancherive', 'Radié', id(6)),
  fiche(7, 'Faute', 'Garde', 'Cité de Blancherive', 'En servise actif', id(7)),
  fiche(8, 'Inconnu', 'Écuyer', 'Cité de Blancherive', 'En service actif', id(8)),
  fiche(9, 'Double', 'Capitaine', 'Cité de Blancherive', 'En service actif', id(9)),
  fiche(10, 'Doublon', 'Garde', 'Cité de Blancherive', 'En service actif', id(9)),
  fiche(11, 'Arrondi', 'Capitaine', 'Cité de Blancherive', 'En service actif', 1.55870353055299e18),
  fiche(12, 'Libre', 'Garde', 'Cité de Blancherive', 'En service actif', '')
]);
const schema = { prenom: 0, nom: 1, grade: 2, corps: 3, status: 4 };
const ss = { getSheetByName: nom => (nom === 'Données' ? donnees : null) };

// ---------------------------------------------------------------- contexte
let horloge = 1_000_000, proprietes = {}, ecritures = 0, ecritureImpossible = false;
let appels = [], reponses = [], cache = new Map(), journal = [], demandesPortees = [];
const context = vm.createContext({
  Date: { now: () => horloge },
  console: { log: texte => journal.push(texte), error() {} },
  SPREADSHEET_ID: 'test',
  EFFECTIFS_WEB_DONNEES_SHEET_NAME: 'Données',
  EFFECTIFS_WEB_ACTIVE_STATUS: 'En service actif',
  nettoyerEffectifsWeb_: value => String(value ?? '').replace(/ /g, ' ').trim(),
  normaliserEffectifsWeb_: value => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
  PropertiesService: { getScriptProperties: () => ({
    getProperty: nom => (nom in proprietes ? proprietes[nom] : null),
    setProperty: (nom, valeur) => { if (ecritureImpossible) throw Error('Argument too large'); ecritures++; proprietes[nom] = valeur; },
    deleteProperty: nom => { delete proprietes[nom]; }
  }) },
  CacheService: { getScriptCache: () => ({ get: cle => cache.get(cle) ?? null, put: (cle, valeur) => cache.set(cle, valeur) }) },
  UrlFetchApp: { fetch(url, options) {
    appels.push({ url, options });
    const [code, corps] = reponses.shift();
    return { getResponseCode: () => code, getContentText: () => typeof corps === 'string' ? corps : JSON.stringify(corps) };
  } },
  SpreadsheetApp: { openById: () => ss },
  ScriptApp: { AuthMode: { FULL: 'FULL' }, requireScopes: (mode, portees) => demandesPortees.push([mode, Array.from(portees)]) },
  Utilities: {
    sleep() {},
    base64EncodeWebSafe: valeur => Buffer.from(typeof valeur === 'string' ? valeur : Buffer.from(valeur)).toString('base64url'),
    computeHmacSha256Signature: (donnees, cle) => Array.from(Buffer.from(`${cle}::${donnees}`).values()),
    base64DecodeWebSafe: valeur => Array.from(Buffer.from(valeur, 'base64url').values()),
    newBlob: octets => ({ getDataAsString: () => Buffer.from(octets).toString('utf8') })
  },
  // La synchronisation réelle (HistoriqueEffectifs.js) lit le bloc en valeurs
  // affichées, puis appelle `mettreAJourAccesDiscord_` : même chemin ici.
  synchroniserHistoriqueEffectifs_() {
    const values = effectifs.rows.slice(1).map(r => r.map(String));
    return { accesDiscord: context.mettreAJourAccesDiscord_(ss, effectifs, schema, values, 5, entetes) };
  }
});
vm.runInContext(readFileSync('src/Auth.js', 'utf8'), context);
vm.runInContext(readFileSync('src/Discord.js', 'utf8'), context);
vm.runInContext(readFileSync('src/SynchroDiscord.js', 'utf8'), context);

const configurer = (autres = {}) => {
  proprietes = {
    AUTH_SECRET: 'secret-de-test', AUTH_DISCORD: 'ACTIF',
    DISCORD_CLIENT_ID: id(77), DISCORD_CLIENT_SECRET: SECRET_APPLI,
    DISCORD_REDIRECT_URI: 'https://script.google.com/macros/s/ABC/exec',
    DISCORD_RELAIS_URL: 'https://relais.garde.workers.dev', DISCORD_RELAIS_SECRET: 'secret-relais-'.repeat(3),
    DISCORD_GUILD_ID: id(88), ...autres
  };
  appels = []; reponses = []; cache = new Map(); journal = []; ecritures = 0; ecritureImpossible = false;
};
const charge = jeton => JSON.parse(Buffer.from(jeton.split('.')[0], 'base64url').toString('utf8'));
const connexionReussie = (n, pseudo = 'pseudo') => reponses.push(
  [200, { access_token: 'acces-discord', token_type: 'Bearer' }],
  [200, { id: id(n), username: pseudo, global_name: 'Nom Global' }]
);
const CODE = 'AbCdEf0123456789';

// ---------------------------------------------------------------- rôle d'une fiche
const ordre = GRADES.map(g => context.cleGradeDiscord_(g));
const role = (statut, grade, o = ordre) => context.roleRegistreDiscord_(statut, grade, o);
assert.equal(role('En service actif', 'Commander'), 'OFFICIER');
assert.equal(role('En service actif', 'Sergent-Chef'), 'OFFICIER', 'Le seuil est inclus');
assert.equal(role('En service actif', 'sergent chef'), 'OFFICIER', 'Casse et séparateur indifférents');
assert.equal(role('En service actif', 'Sergent'), 'GARDE');
assert.equal(role('En service actif', 'Recrue'), 'GARDE');
assert.equal(role('En service actif', 'Écuyer'), 'GARDE', 'Grade inconnu : jamais officier');
assert.equal(role('EN SERVICE ACTIF', 'Capitaine'), 'OFFICIER');
for (const statut of ['Réserve', 'Radié', 'Mort', 'Déserteur', 'Démissionnaire', 'En servise actif', '']) {
  assert.equal(role(statut, 'Capitaine'), '', `Statut « ${statut} » : aucun accès`);
}
const sansSeuil = ordre.filter(g => g !== context.cleGradeDiscord_('Sergent-Chef'));
assert.equal(role('En service actif', 'Commander', sansSeuil), 'GARDE', 'Seuil disparu de Données : personne n’est officier');

// ---------------------------------------------------------------- table d'accès
configurer();
let index = context.synchroniserHistoriqueEffectifs_().accesDiscord;
const table = JSON.parse(proprietes.DISCORD_ACCES);
assert.deepEqual(table, {
  [id(1)]: 'O|00000001', [id(2)]: 'O|00000002', [id(3)]: 'G|00000003',
  [id(4)]: 'O|00000004', [id(8)]: 'G|00000008'
}, 'Seuls les liens valides ouvrant un accès ; Hird compris ; réserve, départ, faute, doublon et nombre exclus');
assert.equal(index.get(id(5)).role, '');
assert.equal(index.get(id(5)).statut, 'Réserve');
assert.match(index.get(id(9)).anomalie, /Même compte Discord/);
assert.equal(ecritures, 1);
context.synchroniserHistoriqueEffectifs_();
assert.equal(ecritures, 1, 'Table inchangée : aucune écriture');
ecritureImpossible = true; effectifs.rows[3][2] = 'Lieutenant';
context.synchroniserHistoriqueEffectifs_();
assert.equal(proprietes.DISCORD_ACCES, undefined, 'Table impossible à écrire : effacée, sessions Discord refusées');
effectifs.rows[3][2] = 'Sergent';

// ---------------------------------------------------------------- modes de connexion
configurer({ AUTH_DISCORD: undefined }); delete proprietes.AUTH_DISCORD;
assert.equal(context.getModesConnexion().discord, null, 'Interrupteur absent : bouton caché');
configurer({ AUTH_DISCORD: 'inactif' });
assert.equal(context.getModesConnexion().discord, null);
configurer({ DISCORD_REDIRECT_URI: 'script.google.com/exec' });
assert.equal(context.getModesConnexion().discord, null, 'Adresse de retour mal formée : bouton caché');
configurer({ AUTH_DISCORD: ' actif ' });
const url = new URL(context.getModesConnexion().discord.url);
assert.equal(url.origin + url.pathname, 'https://discord.com/oauth2/authorize');
assert.equal(url.searchParams.get('client_id'), id(77));
assert.equal(url.searchParams.get('scope'), 'identify', 'Identité seule');
assert.equal(url.searchParams.get('response_type'), 'code');
assert.equal(url.searchParams.get('redirect_uri'), 'https://script.google.com/macros/s/ABC/exec');
assert.ok(!url.href.includes(SECRET_APPLI), 'Le secret ne quitte jamais le serveur');
assert.equal(appels.length, 0);

// ---------------------------------------------------------------- ouverture de session
// Interrupteur et format contrôlés avant tout appel à Discord.
configurer({ AUTH_DISCORD: 'inactif' });
assert.throws(() => context.ouvrirSessionDiscord(CODE), /n'est pas ouverte : utiliser le code d'accès/);
configurer();
for (const mauvais of ['', 'court', 'a b c d e f g h i j', '<script>alert(1)</script>', undefined]) {
  assert.throws(() => context.ouvrirSessionDiscord(mauvais), /Code de connexion Discord invalide/);
}
configurer({ DISCORD_CLIENT_SECRET: '' });
assert.throws(() => context.ouvrirSessionDiscord(CODE), /connexion Discord n'est pas configurée/);
assert.equal(appels.length, 0);

// Échange refusé : messages lisibles.
const echecs = [
  [[400, { error: 'invalid_grant', error_description: 'Invalid "code" in request.' }], /expiré ou déjà utilisé/],
  [[400, { error: 'invalid_grant', error_description: 'Invalid "redirect_uri" in request.' }], /DISCORD_REDIRECT_URI doit être identique/],
  [[401, { error: 'invalid_client' }], /vérifier DISCORD_CLIENT_ID et DISCORD_CLIENT_SECRET/],
  [[429, '<html>1015</html>'], /bloque temporairement/]
];
for (const [reponse, attendu] of echecs) {
  configurer(); reponses.push(reponse);
  assert.throws(() => context.ouvrirSessionDiscord(CODE), error => {
    assert.match(error.message, attendu);
    assert.ok(!error.message.includes(SECRET_APPLI));
    return true;
  });
}
configurer(); reponses.push([200, { access_token: 'acces' }], [401, { message: '401: Unauthorized' }]);
assert.throws(() => context.ouvrirSessionDiscord(CODE), /n'a pas confirmé votre identité/);

// Réussite : officier de l'Inquisition.
configurer(); connexionReussie(1, 'ragnhild');
let jeton = context.ouvrirSessionDiscord(` ${CODE} `);
assert.equal(appels[0].url, 'https://discord.com/api/v10/oauth2/token');
assert.equal(appels[0].options.method, 'post');
assert.deepEqual({ ...appels[0].options.payload }, {
  grant_type: 'authorization_code', code: CODE,
  redirect_uri: 'https://script.google.com/macros/s/ABC/exec',
  client_id: id(77), client_secret: SECRET_APPLI
});
assert.equal(appels[1].url, 'https://discord.com/api/v10/users/@me');
assert.equal(appels[1].options.headers.Authorization, 'Bearer acces-discord');
assert.ok(appels.every(a => a.url.startsWith('https://discord.com/api/v10/') && !JSON.stringify(a.options).includes('secret-relais')),
  'La connexion appelle Discord directement, sans le relais ni son secret');
let contenu = charge(jeton);
assert.deepEqual({ role: contenu.role, via: contenu.via, membre: contenu.membre, discord: contenu.discord, nom: contenu.nom },
  { role: 'OFFICIER', via: 'discord', membre: uuid(1), discord: id(1), nom: 'Ragnhild Test' });
assert.ok(!JSON.stringify(contenu).includes('acces-discord'), 'Le jeton Discord n’est pas transmis');
assert.ok(!JSON.stringify(contenu).includes(SECRET_APPLI));
assert.deepEqual({ ...context.getSessionInfo(jeton) }, { role: 'OFFICIER', nom: 'Ragnhild Test' });
assert.equal(context.requireRole(jeton, ['OFFICIER']).role, 'OFFICIER');

// Sergent : GARDE, refusé aux pages d'officier.
configurer(); connexionReussie(3);
const garde = context.ouvrirSessionDiscord(CODE);
assert.equal(charge(garde).role, 'GARDE');
assert.throws(() => context.requireRole(garde, ['OFFICIER']), /droits nécessaires/);

// Refus explicites.
configurer(); connexionReussie(12345, 'inconnu');
assert.throws(() => context.ouvrirSessionDiscord(CODE),
  new RegExp(`\\(@inconnu, identifiant ${id(12345)}\\) n'est rattaché à aucun membre`));
configurer(); connexionReussie(5);
assert.throws(() => context.ouvrirSessionDiscord(CODE), /Votre fiche \(statut « Réserve »\) ne donne pas accès au registre\./);
configurer(); connexionReussie(6);
assert.throws(() => context.ouvrirSessionDiscord(CODE), /statut « Radié »/);
configurer(); connexionReussie(9);
assert.throws(() => context.ouvrirSessionDiscord(CODE), /rattaché à plusieurs fiches/);
configurer(); connexionReussie(1); ecritureImpossible = true; delete proprietes.DISCORD_ACCES;
assert.throws(() => context.ouvrirSessionDiscord(CODE), /Table d'accès Discord indisponible/,
  'Aucun jeton qui serait refusé à l’appel suivant');

// ---------------------------------------------------------------- vie de la session
configurer(); connexionReussie(2);
jeton = context.ouvrirSessionDiscord(CODE);
const resynchroniser = () => context.synchroniserHistoriqueEffectifs_();

// Les codes communs ne concernent pas Discord.
proprietes.AUTH_CODES = 'AUCUN';
assert.equal(context.verifyAuthToken(jeton).role, 'OFFICIER');
delete proprietes.AUTH_CODES;

// Rétrogradation : la session tombe à l'appel suivant ; reconnexion en GARDE.
effectifs.rows[2][2] = 'Sergent'; resynchroniser();
assert.throws(() => context.verifyAuthToken(jeton), /^Error: Votre accès au registre a changé : reconnectez-vous\.$/);
connexionReussie(2);
assert.equal(charge(context.ouvrirSessionDiscord(CODE)).role, 'GARDE');
effectifs.rows[2][2] = 'Sergent-Chef'; resynchroniser();
assert.equal(context.verifyAuthToken(jeton).role, 'OFFICIER', 'Rétablie, la fiche rouvre la session');

// Passage en réserve, lien retiré, lien donné à une autre fiche.
effectifs.rows[2][4] = 'Réserve'; resynchroniser();
assert.throws(() => context.verifyAuthToken(jeton), /accès au registre a changé/);
effectifs.rows[2][4] = 'En service actif'; effectifs.rows[2][6] = ''; resynchroniser();
assert.throws(() => context.verifyAuthToken(jeton), /accès au registre a changé/);
effectifs.rows[12][6] = id(2); effectifs.rows[12][2] = 'Capitaine'; resynchroniser();
assert.throws(() => context.verifyAuthToken(jeton), /accès au registre a changé/, 'Même compte, autre fiche');
effectifs.rows[12][6] = ''; effectifs.rows[12][2] = 'Garde'; effectifs.rows[2][6] = id(2); resynchroniser();
assert.equal(context.verifyAuthToken(jeton).role, 'OFFICIER');

// Interrupteur coupé : sessions Discord refusées, sessions par code intactes.
proprietes.PASSWORD_GARDE = 'garde';
const parCode = context.login('garde');
proprietes.AUTH_DISCORD = 'INACTIF';
assert.throws(() => context.verifyAuthToken(jeton), /La connexion par Discord est fermée/);
assert.equal(context.verifyAuthToken(parCode).role, 'GARDE');
proprietes.AUTH_DISCORD = 'ACTIF';

// Rôle réécrit dans le jeton : signature invalide.
const forge = Buffer.from(JSON.stringify({ ...charge(garde), role: 'OFFICIER' })).toString('base64url');
assert.throws(() => context.verifyAuthToken(`${forge}.${garde.split('.')[1]}`), /Token invalide/);

// Session glissante : trente jours, prolongée à chaque visite, au plus une fois par jour.
const JOUR = 24 * 60 * 60 * 1000;
const emis = charge(jeton).exp - 30 * JOUR;
assert.equal(context.getSessionInfo(jeton).jeton, undefined, 'Moins d’un jour : pas de nouveau jeton');
horloge = emis + 25 * 60 * 60 * 1000;
const prolonge = context.getSessionInfo(jeton).jeton;
assert.ok(prolonge, 'Plus d’un jour : jeton neuf');
assert.equal(charge(prolonge).exp, horloge + 30 * JOUR);
for (const champ of ['role', 'via', 'membre', 'discord', 'nom']) {
  assert.equal(charge(prolonge)[champ], charge(jeton)[champ], `Prolongé à l’identique : ${champ}`);
}
effectifs.rows[2][4] = 'Réserve'; resynchroniser();
assert.throws(() => context.getSessionInfo(jeton), /accès au registre a changé/, 'Une fiche sans accès n’est jamais prolongée');
effectifs.rows[2][4] = 'En service actif'; resynchroniser();
horloge = charge(prolonge).exp - JOUR;
assert.equal(context.verifyAuthToken(prolonge).role, 'OFFICIER', 'Valable vingt-neuf jours après la visite');

// Expiration : trente jours sans visite.
horloge = charge(prolonge).exp + 1;
assert.throws(() => context.verifyAuthToken(prolonge), /Session expirée/);

// ---------------------------------------------------------------- diagnostic de l'éditeur
// Ordre des appels : secret faux, bot, route fermée, serveurs du bot, serveur, membres.
const SECRET_REFUSE = [401, { message: 'Secret du relais absent ou invalide.', relais: 'secret' }];
const ROUTE_REFUSEE = [403, { message: 'Requête non autorisée par le relais.', relais: 'refus' }];
const BOT = [200, { id: id(50), username: 'Sceau' }];
configurer({ AUTH_DISCORD: 'inactif', DISCORD_REDIRECT_URI: 'https://script.google.com/macros/s/ABC/dev' });
reponses.push(SECRET_REFUSE, BOT, ROUTE_REFUSEE, [200, [{ id: id(88), name: 'Garde de Blancherive' }]],
  [200, { name: 'Garde de Blancherive' }], [403, { message: 'Missing Access', code: 50001 }]);
assert.equal(context.verifierConfigurationDiscord(), undefined, 'Ne renvoie rien au navigateur');
assert.deepEqual(demandesPortees, [['FULL', ['https://www.googleapis.com/auth/script.external_request']]],
  'Permission « services externes » redemandée si elle manque');
const rapport = journal.join('\n');
assert.match(rapport, /✓ Relais : https:\/\/relais\.garde\.workers\.dev/);
assert.match(rapport, /✓ Secret exigé : le relais refuse un secret faux/);
assert.notEqual(appels[0].options.headers['X-Relais-Secret'], proprietes.DISCORD_RELAIS_SECRET, 'Essai avec un secret faux');
assert.match(rapport, new RegExp(`✓ Bot : Sceau \\(${id(50)}\\)`));
assert.match(rapport, /✓ Routes fermées : le relais refuse une route hors de sa liste/);
assert.equal(appels[2].url, 'https://relais.garde.workers.dev/applications/@me');
assert.match(rapport, new RegExp(`✓ Serveurs du bot : Garde de Blancherive \\(${id(88)}\\)`));
assert.match(rapport, /✓ Serveur : Garde de Blancherive/);
assert.match(rapport, /✗ Membres : .*Server Members Intent/);
assert.match(rapport, /✓ Synchronisation des rôles : coupée \(DISCORD_SYNCHRO absent\), aucun passage encore/);
assert.match(rapport, /✓ Connexion : configurée — attention, l'adresse de retour ne se termine pas par \/exec, AUTH_DISCORD inactif/);
assert.ok(!rapport.includes('secret-relais') && !rapport.includes(SECRET_APPLI), 'Aucun secret au journal');
assert.equal(appels.length, 6);
assert.ok(appels.every(a => a.url.startsWith('https://relais.garde.workers.dev/')), 'Tous les appels du bot par le relais');
context.verifierConfigurationDiscord();
assert.equal(appels.length, 6, 'Une fois par minute au plus');

// Dernier passage de la synchronisation, résumé.
configurer({ DISCORD_SYNCHRO: 'simulation', DISCORD_SYNCHRO_RAPPORT: JSON.stringify({
  date: '2026-10-11T10:00:00.000Z', mode: 'SIMULATION', prevues: 12, ajouts: 0, retraits: 0, erreurs: 0, anomalies: 1, reste: 0 }) });
reponses.push(SECRET_REFUSE, BOT, ROUTE_REFUSEE, [200, [{ id: id(88), name: 'Garde' }]], [200, { name: 'Garde' }], [200, []]);
context.verifierConfigurationDiscord();
assert.match(journal.join('\n'), /✓ Synchronisation des rôles : DISCORD_SYNCHRO SIMULATION, dernier passage 2026-10-11T10:00:00\.000Z en SIMULATION : 12 opération\(s\) prévue\(s\), 0 ajout\(s\), 0 retrait\(s\), 0 pseudo\(s\), 0 erreur\(s\), 1 anomalie\(s\) de la feuille/);

// Relais déployé sans ses protections : signalé.
configurer();
reponses.push(BOT, BOT, [200, { id: id(50) }], [200, [{ id: id(88), name: 'Garde' }]], [200, { name: 'Garde' }], [200, []]);
context.verifierConfigurationDiscord();
assert.match(journal.join('\n'), /✗ Secret exigé : le relais accepte un secret faux : le redéployer/);
assert.match(journal.join('\n'), /✗ Routes fermées : le relais laisse passer une route hors de sa liste/);

// Mauvaise adresse de relais : chaque appel le dit.
configurer();
reponses.push(...Array.from({ length: 6 }, () => [404, '<html>There is nothing here yet</html>']));
context.verifierConfigurationDiscord();
assert.match(journal.join('\n'), /✗ Secret exigé : Le relais Discord ne répond pas comme prévu \(HTTP 404\) : vérifier DISCORD_RELAIS_URL/);
assert.match(journal.join('\n'), /✗ Bot : Le relais Discord ne répond pas comme prévu/);

// Relais non configuré dans le registre : aucun appel.
configurer({ DISCORD_RELAIS_URL: '' });
context.verifierConfigurationDiscord();
assert.match(journal.join('\n'), /✗ Relais : Le bot Discord n'est pas configuré : renseigner DISCORD_RELAIS_URL/);
assert.equal(appels.length, 0);

// Refus réseau de Discord derrière le relais : son message, pas celui de l'appel.
configurer();
reponses.push(SECRET_REFUSE, BOT, ROUTE_REFUSEE, [200, [{ id: id(88), name: 'Garde' }]],
  [403, { message: 'internal network error', code: 40333 }], [403, { message: 'internal network error', code: 40333 }]);
context.verifierConfigurationDiscord();
assert.match(journal.join('\n'), /✗ Serveur : Discord bloque cette requête \(refus réseau, code 40333\)/,
  'Le refus réseau garde son message, pas celui de l’appel');
assert.match(journal.join('\n'), /✗ Membres : .*\[HTTP 403 — internal network error \(code 40333\)\]/);

// Bot invité ailleurs, ou identifiant de serveur erroné : le journal dit où il est.
configurer();
reponses.push(SECRET_REFUSE, BOT, ROUTE_REFUSEE, [200, [{ id: id(99), name: 'Autre serveur' }]],
  [403, { message: 'Missing Access', code: 50001 }], [403, { message: 'Missing Access', code: 50001 }]);
context.verifierConfigurationDiscord();
assert.match(journal.join('\n'), new RegExp(`✗ Serveurs du bot : DISCORD_GUILD_ID \\(${id(88)}\\) ne désigne aucun d'eux\\. Le bot est sur : Autre serveur \\(${id(99)}\\)\\.`));
assert.match(journal.join('\n'), /✗ Serveur : .*le bot n'y est pas, ou DISCORD_GUILD_ID désigne un autre serveur\. \[HTTP 403 — Missing Access \(code 50001\)\]/,
  'Réponse brute de Discord au journal');
configurer();
reponses.push(SECRET_REFUSE, BOT, ROUTE_REFUSEE, [200, []], [403, {}], [403, {}]);
context.verifierConfigurationDiscord();
assert.match(journal.join('\n'), /✗ Serveurs du bot : le bot n'est sur aucun serveur/);

console.log('Connexion Discord : rôle par la fiche, table d’accès, échange du code, coupure des sessions et diagnostic validés.');
