/*
  Synchronisation des rôles Discord (`src/SynchroDiscord.js`).

  - Feuille `RolesDiscord` créée et préremplie une fois (statuts, seuil
    Lieutenant, grades de Données!A, corps de Données!G avec les rôles cités
    par le propriétaire), jamais réécrite ; lignes illisibles signalées.
  - Noms de rôles résolus sur le serveur : introuvable, en double, réservé ou
    placé au-dessus du bot → ligne ignorée et signalée.
  - Rôles voulus : statut, puis en service actif seulement grade régulier,
    corps et seuil « À partir du grade » ; réserve → Réserviste seul ; départ
    → rien. Seuls les rôles gérés bougent, seuls les comptes rattachés et
    présents sur le serveur sont touchés.
  - Interrupteur DISCORD_SYNCHRO : absent → rien ; SIMULATION → aucun
    changement ; ACTIF → ajouts puis retraits, raison d'audit, plafond par
    passage, arrêt sur limitation de débit, second passage sans opération.

    node scripts/test-synchro-discord.mjs
*/
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const RELAIS = 'https://relais.garde.workers.dev';
const G = '900000000000000001';
const id = n => String(100000000000000000n + BigInt(n));
const BOT = id(999);

// ---------------------------------------------------------------- feuilles
class Sheet {
  constructor(name, rows = []) { this.name = name; this.rows = rows; this.formats = []; this.gel = 0; }
  getLastRow() { return this.rows.length; }
  setFrozenRows(n) { this.gel = n; }
  getRange(row, col, height = 1, width = 1) {
    const sheet = this;
    const read = () => Array.from({ length: height }, (_, i) =>
      Array.from({ length: width }, (_, j) => sheet.rows[row - 1 + i]?.[col - 1 + j] ?? ''));
    const range = {
      getValues: read,
      getDisplayValues: () => read().map(r => r.map(String)),
      setValues(values) { values.forEach((r, i) => r.forEach((v, j) => { (sheet.rows[row - 1 + i] ||= [])[col - 1 + j] = v; })); return range; },
      setNumberFormat(format) { sheet.formats.push(format); return range; }
    };
    return range;
  }
}
const GRADES = ['Commander', 'Major', 'Capitaine', 'Lieutenant-Chef', 'Lieutenant', 'Sergent-Chef', 'Sergent', 'Caporal', 'Garde', 'Recrue'];
const CORPS = ['Cité de Blancherive', 'Garnison de Rivebois', 'Garnison de Bois-de-Chêne', 'Garde des Faubourgs',
  'Éclaireur', 'Inquisition', 'Hird du Jarl', 'État-Major', 'Garnison de Cap Granite'];
const donnees = new Sheet('Données', [['Grade', '', '', '', '', '', 'Corps'],
  ...Array.from({ length: Math.max(GRADES.length, CORPS.length) }, (_, i) => [GRADES[i] ?? '', '', '', '', '', '', CORPS[i] ?? ''])]);
const feuilles = new Map([['Données', donnees]]);
const ss = { getSheetByName: n => feuilles.get(n) || null, insertSheet: n => { const s = new Sheet(n); feuilles.set(n, s); return s; } };

// ---------------------------------------------------------------- serveur Discord simulé
let roles, membres, pseudos, appels, echecs, proprietes, cache, journal, declencheurs;
const role = (n, name, position, extra = {}) => ({ id: id(n), name, position, ...extra });
function serveurInitial() {
  roles = [
    { id: G, name: '@everyone', position: 0 },
    role(1, 'Garde de Blancherive', 5), role(2, 'Officier de Blancherive', 20), role(3, 'Réserviste', 4),
    role(10, 'Capitaine', 15), role(11, 'Lieutenant', 14), role(12, 'Sergent-Chef', 13), role(13, 'Garde', 6),
    role(14, 'Sergent', 12), role(15, 'Lieutenant-Chef', 16), role(16, 'Major', 18), role(17, 'Commander', 19),
    role(18, 'Caporal', 11), role(19, 'Recrue', 7),
    role(20, 'Corps des éclaireurs', 8), role(21, "Brigade de l'inquisition", 8), role(22, 'Etat Major', 8),
    role(23, 'Garnison des faubourgs', 8), role(24, 'Garnison de Bois-de-Chêne', 8), role(25, 'Garnison de Cap Granite', 8),
    role(30, 'Animation', 3), role(40, 'BlancheriveGarde', 25, { managed: true }), role(41, 'Administration', 30)
  ];
  membres = new Map([
    [BOT, [id(40)]],
    [id(101), [id(13)]],                       // Ragnhild : Capitaine de l'Inquisition, n'a que « Garde »
    [id(102), [id(1), id(14), id(30)]],        // Eydis : Lieutenant, a encore « Sergent » et « Animation »
    [id(103), [id(1), id(12), id(2)]],         // Sven : Sergent-Chef qui porte « Officier » à tort
    [id(104), []],                             // Ulfgar : Lieutenant du Hird
    [id(105), [id(1), id(13), id(24)]],        // Olaf : passé en réserve
    [id(106), [id(1), id(2), id(10), id(30)]], // Bjorn : radié
    [id(107), [id(41)]],                       // Inconnu : grade absent de Données, rôle au-dessus du bot
    [id(200), [id(1), id(2)]]                  // Compte que personne n'a rattaché
  ]);
  pseudos = new Map([[id(102), 'Eydis'], [id(103), 'Sven'], [id(106), 'Bjorn le Fort'], [id(200), 'Quelqu’un']]);
}
const comptes = () => new Map([
  [id(101), { membre: 'u1', statut: 'En service actif', grade: 'Capitaine', corps: 'Inquisition', nom: 'Ragnhild Fer-Juste' }],
  [id(102), { membre: 'u2', statut: 'En service actif', grade: 'Lieutenant', corps: 'Garnison de Bois-de-Chêne', nom: 'Eydis la Silencieuse' }],
  [id(103), { membre: 'u3', statut: 'En service actif', grade: 'Sergent-Chef', corps: 'Cité de Blancherive', nom: 'Sven' }],
  [id(104), { membre: 'u4', statut: 'en service actif', grade: 'Lieutenant', corps: 'Hird du Jarl', nom: 'Ulfgar' }],
  [id(105), { membre: 'u5', statut: 'Réserve', grade: 'Garde', corps: 'Garnison de Bois-de-Chêne', nom: 'Olaf' }],
  [id(106), { membre: 'u6', statut: 'Radié', grade: 'Capitaine', corps: 'Cité de Blancherive', nom: 'Bjorn' }],
  [id(107), { membre: 'u7', statut: 'En service actif', grade: 'Écuyer', corps: 'Éclaireur', nom: 'Inconnu' }],
  [id(300), { membre: 'u8', statut: 'En service actif', grade: 'Garde', corps: 'Éclaireur', nom: 'Absent' }],
  [id(301), { anomalie: 'Même compte Discord que …' }]
]);

function repondre(code, corps) {
  return { getResponseCode: () => code, getContentText: () => (corps === undefined ? '' : JSON.stringify(corps)) };
}
const context = vm.createContext({
  Date, Map, Set, Math, JSON, Number, String, Array, Object,
  console: { log: t => journal.push(t), error: t => journal.push('ERREUR ' + t) },
  SPREADSHEET_ID: 'test',
  EFFECTIFS_WEB_DONNEES_SHEET_NAME: 'Données',
  EFFECTIFS_WEB_ACTIVE_STATUS: 'En service actif',
  EFFECTIFS_WEB_RESERVE_STATUS: 'Réserve',
  nettoyerEffectifsWeb_: value => String(value ?? '').replace(/ /g, ' ').trim(),
  normaliserEffectifsWeb_: value => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
  SpreadsheetApp: { openById: () => ss },
  PropertiesService: { getScriptProperties: () => ({
    getProperty: nom => (nom in proprietes ? proprietes[nom] : null),
    setProperty: (nom, valeur) => { proprietes[nom] = valeur; }
  }) },
  CacheService: { getScriptCache: () => ({ get: c => cache.get(c) ?? null, put: (c, v) => cache.set(c, v), remove: c => cache.delete(c) }) },
  ScriptApp: {
    getProjectTriggers: () => declencheurs.map(nom => ({ getHandlerFunction: () => nom })),
    newTrigger: nom => { const b = { timeBased: () => b, everyHours: h => { assert.equal(h, 1); return b; }, create: () => declencheurs.push(nom) }; return b; }
  },
  Utilities: { sleep() {} },
  synchroniserHistoriqueEffectifs_: () => ({ accesDiscord: comptes() }),
  UrlFetchApp: { fetch(url, options) {
    assert.ok(url.startsWith(RELAIS + '/'), 'Tous les appels par le relais : ' + url);
    assert.equal(options.headers['X-Relais-Secret'], 'secret-relais');
    const chemin = url.slice(RELAIS.length);
    const methode = String(options.method || 'get').toLowerCase();
    appels.push({ methode, chemin, raison: options.headers['X-Audit-Log-Reason'] });
    if (echecs.length && methode !== 'get') {
      const [code, corps] = echecs.shift();
      if (code) return repondre(code, corps);
    }
    if (chemin === '/users/@me') return repondre(200, { id: BOT, username: 'Bot' });
    if (chemin === `/guilds/${G}`) return repondre(200, { id: G, name: 'Garde de Blancherive', owner_id: id(104) });
    if (chemin === `/guilds/${G}/roles`) return repondre(200, roles);
    if (chemin.startsWith(`/guilds/${G}/members?`)) {
      return repondre(200, [...membres].map(([u, r]) => ({ user: { id: u, username: 'u' + u, bot: u === BOT }, roles: [...r], nick: pseudos.get(u) ?? null })));
    }
    const p = chemin.match(new RegExp(`^/guilds/${G}/members/(\\d+)$`));
    if (p && methode === 'patch') {
      assert.equal(options.contentType, 'application/json');
      const corps = JSON.parse(options.payload);
      assert.deepEqual(Object.keys(corps), ['nick'], 'Le pseudo seul, comme le relais l’exige');
      pseudos.set(p[1], corps.nick);
      return repondre(200, { nick: corps.nick });
    }
    const m = chemin.match(new RegExp(`^/guilds/${G}/members/(\\d+)/roles/(\\d+)$`));
    if (m && (methode === 'put' || methode === 'delete')) {
      const actuels = membres.get(m[1]);
      if (methode === 'put' && !actuels.includes(m[2])) actuels.push(m[2]);
      if (methode === 'delete') membres.set(m[1], actuels.filter(r => r !== m[2]));
      return repondre(204);
    }
    throw new Error('Appel inattendu : ' + methode + ' ' + chemin);
  } }
});
vm.runInContext(readFileSync('src/Discord.js', 'utf8'), context);
vm.runInContext(readFileSync('src/SynchroDiscord.js', 'utf8'), context);

const publiques = [...readFileSync('src/SynchroDiscord.js', 'utf8').matchAll(/^function\s+([A-Za-z0-9_$]+)\s*\(/gm)]
  .map(m => m[1]).filter(n => !n.endsWith('_'));
assert.deepEqual(publiques, ['simulerSynchroDiscord'], 'Seule la simulation est publique, et elle ne renvoie rien');

function reinitialiser(autres = {}) {
  serveurInitial();
  appels = []; echecs = []; cache = new Map(); journal = []; declencheurs = [];
  proprietes = { DISCORD_RELAIS_URL: RELAIS, DISCORD_RELAIS_SECRET: 'secret-relais', DISCORD_GUILD_ID: G, ...autres };
}
const nomRole = rid => roles.find(r => r.id === rid)?.name;
const rolesDe = u => membres.get(u).map(nomRole).sort();
const ecritures = () => appels.filter(a => a.methode !== 'get');

// ---------------------------------------------------------------- feuille préremplie
reinitialiser();
feuilles.delete('RolesDiscord');
let rapport = context.synchroniserRolesDiscord_(ss, 'SIMULATION');
const feuille = feuilles.get('RolesDiscord');
assert.deepEqual(feuille.rows[0], ['Type', 'Valeur', 'Rôle Discord']);
assert.deepEqual(feuille.rows.slice(1, 4), [
  ['Statut', 'En service actif', 'Garde de Blancherive'],
  ['Statut', 'Réserve', 'Réserviste'],
  ['À partir du grade', 'Lieutenant', 'Officier de Blancherive']
]);
assert.deepEqual(feuille.rows.filter(r => r[0] === 'Grade').map(r => r[1]), GRADES);
assert.ok(feuille.rows.filter(r => r[0] === 'Grade').every(r => r[2] === r[1]), 'Rôle de grade prérempli au nom du grade');
const corpsPrerempli = Object.fromEntries(feuille.rows.filter(r => r[0] === 'Corps').map(r => [r[1], r[2]]));
assert.deepEqual(corpsPrerempli, {
  'Cité de Blancherive': '', 'Garnison de Rivebois': '', 'Hird du Jarl': '',
  'Garnison de Bois-de-Chêne': 'Garnison de Bois-de-Chêne', 'Garde des Faubourgs': 'Garnison des faubourgs',
  'Éclaireur': 'Corps des éclaireurs', 'Inquisition': "Brigade de l'inquisition",
  'État-Major': 'Etat Major', 'Garnison de Cap Granite': 'Garnison de Cap Granite'
});
assert.deepEqual(feuille.formats, ['@'], 'Texte brut');
assert.equal(feuille.gel, 1);
assert.equal(ecritures().length, 0, 'Simulation : aucun changement');

// La feuille n'est plus jamais réécrite.
feuille.rows[2][2] = 'Réservistes';
context.synchroniserRolesDiscord_(ss, 'SIMULATION');
assert.equal(feuille.rows[2][2], 'Réservistes');
feuille.rows[2][2] = 'Réserviste';
const entete = feuille.rows[0][2]; feuille.rows[0][2] = 'Rôle';
assert.throws(() => context.synchroniserRolesDiscord_(ss, 'ACTIF'), /d'autres en-têtes.*Rien n'est appliqué/);
assert.equal(cache.get('DISCORD_SYNCHRO_EN_COURS'), undefined, 'Verrou libéré même en cas d’erreur');
feuille.rows[0][2] = entete;

// ---------------------------------------------------------------- plan
reinitialiser();
rapport = context.synchroniserRolesDiscord_(ss, 'SIMULATION');
assert.deepEqual([...rapport.anomalies], [], 'Feuille préremplie sans anomalie sur ce serveur');
// Tableaux du contexte vm ramenés au domaine du test pour deepEqual.
const plan = op => Array.from(rapport.operations.filter(o => o.discordId === op && o.methode !== 'patch'),
  o => (o.methode === 'put' ? '+' : '-') + o.libelle).sort();
const pseudoPrevu = op => Array.from(rapport.operations.filter(o => o.discordId === op && o.methode === 'patch'), o => o.pseudo);
assert.deepEqual(plan(id(101)), ["+Brigade de l'inquisition", '+Capitaine', '+Garde de Blancherive', '+Officier de Blancherive', '-Garde'].sort(),
  'Capitaine de l’Inquisition : grade régulier, corps, fonction, Officier ; ancien grade retiré');
assert.deepEqual(plan(id(102)), ['+Garnison de Bois-de-Chêne', '+Lieutenant', '+Officier de Blancherive', '-Sergent'].sort(),
  'Lieutenant : Officier inclus ; « Animation », non géré, reste');
assert.deepEqual(plan(id(103)), ['-Officier de Blancherive'],
  'Sergent-Chef : Officier retiré, pas de rôle de corps pour la Cité');
assert.deepEqual(plan(id(104)), ['+Garde de Blancherive', '+Lieutenant', '+Officier de Blancherive'].sort(),
  'Hird : même seuil, sans rôle de corps');
assert.deepEqual(plan(id(105)), ['+Réserviste', '-Garde', '-Garde de Blancherive', '-Garnison de Bois-de-Chêne'].sort(),
  'Réserve : Réserviste seul');
assert.deepEqual(plan(id(106)), ['-Capitaine', '-Garde de Blancherive', '-Officier de Blancherive'].sort(),
  'Radié : tous les rôles gérés retirés, « Animation » gardé');
assert.deepEqual(plan(id(107)), ['+Corps des éclaireurs', '+Garde de Blancherive'].sort(),
  'Grade inconnu : ni rôle de grade, ni Officier');
assert.deepEqual(plan(id(200)), [], 'Compte non rattaché : jamais touché');

// Pseudos : « Prénom Nom », réserve comprise ; effacé pour un départ ; rien si déjà juste.
assert.deepEqual(pseudoPrevu(id(101)), ['Ragnhild Fer-Juste']);
assert.deepEqual(pseudoPrevu(id(102)), ['Eydis la Silencieuse']);
assert.deepEqual(pseudoPrevu(id(103)), [], 'Pseudo déjà juste');
assert.deepEqual(pseudoPrevu(id(105)), ['Olaf'], 'Réserve : le nom aussi');
assert.deepEqual(pseudoPrevu(id(106)), [null], 'Départ : pseudo effacé');
assert.deepEqual(pseudoPrevu(id(200)), [], 'Compte non rattaché : pseudo intact');
assert.deepEqual(pseudoPrevu(id(104)), [], 'Propriétaire du serveur : pas renommable');
assert.deepEqual(pseudoPrevu(id(107)), [], 'Rôle au-dessus du bot : pas renommable');
assert.match(rapport.notes.join('\n'), /Pseudo de Ulfgar laissé tel quel : propriétaire du serveur\./);
assert.match(rapport.notes.join('\n'), /Pseudo de Inconnu laissé tel quel : un de ses rôles est placé au-dessus du bot\./);
const premierPseudo = rapport.operations.findIndex(o => o.methode === 'patch');
assert.ok(premierPseudo > 0 && rapport.operations.slice(premierPseudo).every(o => o.methode === 'patch'), 'Pseudos après les rôles');
assert.equal(context.pseudoVouluDiscord_({ statut: 'En service actif', nom: 'x'.repeat(40) }), 'x'.repeat(31) + '…', 'Trente-deux caractères au plus');
assert.equal([...context.pseudoVouluDiscord_({ statut: 'En service actif', nom: 'Œ'.repeat(32) })].length, 32);
assert.equal(context.pseudoVouluDiscord_({ statut: 'Mort', nom: 'Bjorn' }), null);
assert.equal(context.pseudoVouluDiscord_({ statut: 'En service actif', nom: '  ' }), null);
assert.equal(rapport.absents, 1, 'Compte rattaché absent du serveur');
assert.equal(rapport.operations.findIndex(o => o.methode === 'delete'), rapport.operations.filter(o => o.methode === 'put').length,
  'Ajouts d’abord, retraits ensuite');
assert.equal(ecritures().length, 0);
const resume = JSON.parse(proprietes.DISCORD_SYNCHRO_RAPPORT);
assert.equal(resume.mode, 'SIMULATION');
assert.equal(resume.prevues, rapport.operations.length);
const texte = context.decrireRapportSynchroDiscord_(rapport);
assert.match(texte, /simulation, rien n'est changé/);
assert.match(texte, /\+ Officier de Blancherive — Ragnhild Fer-Juste \(En service actif, Capitaine, Inquisition\)/);
assert.match(texte, /− Officier de Blancherive — Sven/);
assert.match(texte, /✎ pseudo « Eydis la Silencieuse » — Eydis la Silencieuse \(aujourd'hui : « Eydis »\)/);
assert.match(texte, /✎ pseudo « effacé » — Bjorn \(aujourd'hui : « Bjorn le Fort »\)/);
assert.match(texte, /✎ pseudo « Ragnhild Fer-Juste » — Ragnhild Fer-Juste \(aujourd'hui : sans pseudo\)/);
assert.match(texte, /1 compte\(s\) rattaché\(s\) absent\(s\)/);

// ---------------------------------------------------------------- application
reinitialiser();
rapport = context.synchroniserRolesDiscord_(ss, 'ACTIF');
assert.equal(rapport.ajouts + rapport.retraits + rapport.pseudos, rapport.operations.length);
assert.equal(rapport.pseudos, 4, 'Ragnhild, Eydis, Olaf, Bjorn');
assert.deepEqual([...rapport.erreurs], []);
assert.equal(pseudos.get(id(101)), 'Ragnhild Fer-Juste');
assert.equal(pseudos.get(id(106)), null, 'Pseudo effacé');
assert.equal(pseudos.get(id(200)), 'Quelqu’un');
assert.match(context.decrireRapportSynchroDiscord_(rapport), /4 pseudo\(s\) changé\(s\)/);
assert.equal(JSON.parse(proprietes.DISCORD_SYNCHRO_RAPPORT).pseudos, 4);
assert.deepEqual(rolesDe(id(101)), ["Brigade de l'inquisition", 'Capitaine', 'Garde de Blancherive', 'Officier de Blancherive']);
assert.deepEqual(rolesDe(id(102)), ['Animation', 'Garde de Blancherive', 'Garnison de Bois-de-Chêne', 'Lieutenant', 'Officier de Blancherive']);
assert.deepEqual(rolesDe(id(105)), ['Réserviste']);
assert.deepEqual(rolesDe(id(106)), ['Animation']);
assert.deepEqual(rolesDe(id(200)), ['Garde de Blancherive', 'Officier de Blancherive'], 'Non rattaché intact');
assert.deepEqual(membres.get(BOT), [id(40)]);
const premiere = ecritures()[0];
assert.match(decodeURIComponent(premiere.raison), /^Registre de la Garde : .+\(/, 'Raison inscrite au journal d’audit Discord');
appels = [];
rapport = context.synchroniserRolesDiscord_(ss, 'ACTIF');
assert.equal(rapport.operations.length, 0, 'Second passage : tout est à jour');
assert.equal(ecritures().length, 0);

// ---------------------------------------------------------------- feuille fautive
reinitialiser();
feuille.rows.push(
  ['Couleur', 'Rouge', 'Animation'],
  ['Grade', '', 'Capitaine'],
  ['À partir du grade', 'Connétable', 'Officier de Blancherive'],
  ['Corps', 'Garnison de Rivebois', '@Garnison de Rivebois'],
  ['Corps', 'Éclaireur', 'Pisteurs'],
  ['Statut', 'Réserve', '@everyone'],
  ['Statut', 'Réserve', 'BlancheriveGarde'],
  ['Statut', 'Réserve', 'Administration'],
  ['Grade', 'Recrue', '']
);
roles.push(role(50, 'Pisteurs', 8), role(51, 'pisteurs', 9));
rapport = context.synchroniserRolesDiscord_(ss, 'SIMULATION');
const anomalies = rapport.anomalies.join('\n');
const n = feuille.rows.length;
assert.match(anomalies, new RegExp(`Ligne ${n - 8} : type « Couleur » inconnu`));
assert.match(anomalies, new RegExp(`Ligne ${n - 7} : valeur manquante`));
assert.match(anomalies, new RegExp(`Ligne ${n - 6} : grade « Connétable » absent de Données`));
assert.match(anomalies, new RegExp(`Ligne ${n - 5} : « Garnison de Rivebois » introuvable sur le serveur`));
assert.match(anomalies, new RegExp(`Ligne ${n - 4} : « Pisteurs » désigne plusieurs rôles`));
assert.match(anomalies, new RegExp(`Ligne ${n - 3} : « everyone » est @everyone ou un rôle d'intégration`));
assert.match(anomalies, new RegExp(`Ligne ${n - 2} : « BlancheriveGarde » est @everyone ou un rôle d'intégration`));
assert.match(anomalies, new RegExp(`Ligne ${n - 1} : « Administration » est placé au-dessus du rôle du bot`));
assert.ok(!rapport.operations.some(o => ['Administration', 'BlancheriveGarde', 'Animation'].includes(o.libelle)), 'Lignes fautives ignorées');
assert.match(context.decrireRapportSynchroDiscord_(rapport), /Feuille RolesDiscord :\n  ! Ligne/);
feuille.rows.splice(n - 9, 9);

// ---------------------------------------------------------------- limites et erreurs
reinitialiser();
for (let i = 0; i < 60; i++) {
  membres.set(id(500 + i), [id(2)]);
}
const nombreux = () => { const c = comptes(); for (let i = 0; i < 60; i++) c.set(id(500 + i), { membre: 'x' + i, statut: 'En service actif', grade: 'Garde', corps: 'Éclaireur', nom: 'G' + i }); return c; };
context.synchroniserHistoriqueEffectifs_ = () => ({ accesDiscord: nombreux() });
rapport = context.synchroniserRolesDiscord_(ss, 'ACTIF');
assert.ok(rapport.operations.length > 80);
assert.equal(ecritures().length, 80, 'Plafond par passage');
assert.equal(rapport.reste, rapport.operations.length - 80);
assert.match(context.decrireRapportSynchroDiscord_(rapport), new RegExp(`${rapport.reste} au passage suivant`));

reinitialiser();
echecs = [[0], [403, { message: 'Missing Permissions', code: 50013 }], [429, { retry_after: 30 }]];
rapport = context.synchroniserRolesDiscord_(ss, 'ACTIF');
assert.equal(ecritures().length, 3, 'Arrêt à la limitation de débit');
assert.equal(rapport.erreurs.length, 2);
assert.match(rapport.erreurs[0], / — .+ : Discord refuse, faute de permission : le rôle du bot doit être placé au-dessus/);
assert.match(rapport.erreurs[1], /limite les requêtes : le reste attend le passage suivant/);
assert.equal(rapport.reste, rapport.operations.length - 2);
context.synchroniserHistoriqueEffectifs_ = () => ({ accesDiscord: comptes() });

// Un seul passage à la fois.
reinitialiser();
cache.set('DISCORD_SYNCHRO_EN_COURS', '1');
rapport = context.synchroniserRolesDiscord_(ss, 'ACTIF');
assert.equal(rapport.ignore, true);
assert.equal(appels.length, 0);
assert.match(context.decrireRapportSynchroDiscord_(rapport), /déjà en cours/);

// ---------------------------------------------------------------- interrupteur et points d'entrée
reinitialiser();
context.synchroDiscordPeriodique_();
context.appliquerRolesDiscordApresModification_(ss, { accesDiscord: comptes() });
context.installerDeclencheurSynchroDiscord_();
assert.equal(appels.length, 0, 'Interrupteur absent : rien');
assert.deepEqual(declencheurs, []);

reinitialiser({ DISCORD_SYNCHRO: 'simulation' });
context.synchroDiscordPeriodique_();
assert.ok(appels.length > 0);
assert.equal(ecritures().length, 0, 'Passage horaire en simulation : rien de changé');
assert.match(journal.join('\n'), /simulation/);
context.appliquerRolesDiscordApresModification_(ss, { accesDiscord: comptes() });
assert.equal(ecritures().length, 0, 'Après modification : seulement en mode ACTIF');
context.installerDeclencheurSynchroDiscord_();
context.installerDeclencheurSynchroDiscord_();
assert.deepEqual(declencheurs, ['synchroDiscordPeriodique_'], 'Déclencheur horaire installé une fois');

reinitialiser({ DISCORD_SYNCHRO: 'ACTIF' });
context.appliquerRolesDiscordApresModification_(ss, { accesDiscord: comptes() });
assert.ok(ecritures().length > 0, 'Après modification : appliqué en mode ACTIF');
reinitialiser({ DISCORD_SYNCHRO: 'ACTIF', DISCORD_RELAIS_URL: '' });
assert.doesNotThrow(() => context.appliquerRolesDiscordApresModification_(ss, { accesDiscord: comptes() }),
  'Une panne n’empêche jamais l’enregistrement de la fiche');
assert.match(journal.join('\n'), /ERREUR Synchronisation Discord après modification : Le bot Discord n'est pas configuré/);

reinitialiser({ DISCORD_SYNCHRO: 'ACTIF' });
assert.equal(context.simulerSynchroDiscord(), undefined);
assert.equal(ecritures().length, 0, 'La simulation ne change rien, même en mode ACTIF');
assert.match(journal.join('\n'), /Opérations prévues/);
appels = [];
context.simulerSynchroDiscord();
assert.equal(appels.length, 0, 'Une fois par minute au plus');

// ---------------------------------------------------------------- serveur réel (relevé du 11 octobre 2026)
reinitialiser();
const feuilleOrigine = feuilles.get('RolesDiscord');
const donneesOrigine = feuilles.get('Données');
const GRADES_REELS = ['Jarl', 'Maréchal', 'Commander', 'Major', 'Capitaine', 'Lieutenant-Chef', 'Lieutenant',
  'Sergent-Chef', 'Sergent', 'Caporal-Chef', 'Caporal', 'Garde', 'Cadet', 'Recrue'];
feuilles.set('Données', new Sheet('Données', [['Grade', '', '', '', '', '', 'Corps'],
  ...Array.from({ length: GRADES_REELS.length }, (_, i) => [GRADES_REELS[i], '', '', '', '', '', CORPS[i] ?? ''])]));
feuilles.delete('RolesDiscord');
const noms = ['Jarl', 'Etat major', 'BlancheriveGarde', 'Officiers de Blancherive', 'Garde de Blancherive', 'Maréchal',
  'Commander', 'Major', 'Capitaine', 'Lieutenant-Chef', 'Lieutenant', 'Sergent-Chef', 'Sergent', 'Caporal-Chef', 'Caporal',
  'Garde du domaine', 'Cadet', 'Recrue', 'Garde de Fort-Dragon', 'Corps des éclaireurs', 'Brigade de l’Inquisition',
  'Garnison des faubourgs', 'Garnison de Rivebois', 'Garnison de Cap Granite', 'Garnison de Bois-de-Chêne',
  'La hird du Jarl', 'Réserviste'];
roles = [{ id: G, name: '@everyone', position: 0 },
  ...noms.map((nom, i) => role(600 + i, nom, 100 - i, nom === 'BlancheriveGarde' ? { managed: true } : {}))];
membres = new Map([[BOT, [id(602)]]]);
context.synchroniserHistoriqueEffectifs_ = () => ({ accesDiscord: new Map() });
rapport = context.synchroniserRolesDiscord_(ss, 'SIMULATION');
const reelle = Object.fromEntries(feuilles.get('RolesDiscord').rows.slice(1).map(r => [r[0] + ' / ' + r[1], r[2]]));
assert.equal(reelle['Statut / En service actif'], 'Garde de Blancherive');
assert.equal(reelle['Statut / Réserve'], 'Réserviste');
assert.equal(reelle['À partir du grade / Lieutenant'], 'Officiers de Blancherive', 'Nom réel, au pluriel');
assert.equal(reelle['Grade / Garde'], 'Garde du domaine');
assert.equal(reelle['Grade / Maréchal'], 'Maréchal');
assert.equal(reelle['Grade / Jarl'], '', 'Jarl au-dessus du bot : laissé vide');
assert.equal(reelle['Corps / État-Major'], '', 'Etat major au-dessus du bot : laissé vide');
assert.equal(reelle['Corps / Inquisition'], 'Brigade de l’Inquisition', 'Nom exact du serveur, apostrophe comprise');
assert.equal(reelle['Corps / Hird du Jarl'], 'La hird du Jarl');
assert.equal(reelle['Corps / Garnison de Rivebois'], 'Garnison de Rivebois');
assert.equal(reelle['Corps / Cité de Blancherive'], 'Garde de Fort-Dragon', 'La Cité s’appelle Garde de Fort-Dragon sur le serveur');
const notesReelles = rapport.notes.join('\n');
assert.match(notesReelles, /^Feuille RolesDiscord créée et préremplie/);
assert.match(notesReelles, /« Jarl » \(Jarl\) est placé au-dessus du rôle du bot : case laissée vide/);
assert.match(notesReelles, /« Etat major » \(État-Major\) est placé au-dessus du rôle du bot/);
assert.deepEqual([...rapport.anomalies], [], 'Aucune ligne préremplie fautive');
assert.match(context.decrireRapportSynchroDiscord_(rapport), /Notes :\n  • Feuille RolesDiscord créée/);
rapport = context.synchroniserRolesDiscord_(ss, 'SIMULATION');
assert.deepEqual([...rapport.notes], [], 'Notes du préremplissage au premier passage seulement');

// Feuille vidée en gardant l'en-tête : préremplie de nouveau (constaté le 11 octobre 2026).
const reelleFeuille = feuilles.get('RolesDiscord');
reelleFeuille.rows.splice(1);
rapport = context.synchroniserRolesDiscord_(ss, 'SIMULATION');
assert.ok(reelleFeuille.rows.length > 20, 'En-tête seul : préremplie');
assert.match(rapport.notes[0], /^Feuille RolesDiscord créée et préremplie/);

// Lignes présentes mais aucun rôle reconnu : dit clairement que rien n'est géré.
reelleFeuille.rows.splice(1, reelleFeuille.rows.length, ['Grade', 'Capitaine', ''], ['Corps', 'Rivebois', '']);
rapport = context.synchroniserRolesDiscord_(ss, 'SIMULATION');
assert.equal(reelleFeuille.rows.length, 3, 'Des lignes existent : jamais réécrite');
assert.match(rapport.notes.join('\n'), /ne désigne aucun rôle du serveur : rien n'est géré/);
assert.equal(rapport.operations.length, 0);
feuilles.set('Données', donneesOrigine);
feuilles.set('RolesDiscord', feuilleOrigine);
context.synchroniserHistoriqueEffectifs_ = () => ({ accesDiscord: comptes() });

console.log('Synchronisation Discord : feuille, résolution des rôles, plan, simulation, application et interrupteur validés.');
