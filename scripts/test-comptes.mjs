/*
  Comptes individuels (`Comptes.js` + `Auth.js`).

  - Lien d'invitation : OFFICIER seul, fiche en service actif seule ; la
    feuille `Comptes` ne garde que l'empreinte du jeton ; sept jours, une
    seule activation ; un lien inconnu ou expiré ne révèle rien.
  - Activation : mot de passe de huit caractères au moins, jamais le nom ;
    jeton `via: "compte"` portant l'ID membre, le nom et la version.
  - Connexion : nom de la fiche (sans casse ni accents) et mot de passe ;
    même refus pour un nom inconnu et un mot de passe faux ; pause après
    huit essais ; le mot de passe n'est jamais écrit.
  - Le tableur décide : réserve, départ, rétrogradation, renommage, compte
    retiré ou mot de passe changé ferment la session à l'appel suivant ;
    OFFICIER dès Sergent-Chef (`DISCORD_SEUIL_OFFICIER`), GARDE en dessous.
  - Secret du serveur : sans `COMPTES_SECRET`, la feuille seule ne vaut rien.

    node scripts/test-comptes.mjs
*/
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const uuid = n => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;

// ---------------------------------------------------------------- feuilles
class Sheet {
  constructor(nom, rows) { this.nom = nom; this.rows = rows; this.maxRows = 60; this.frozen = 0; this.formats = []; this.notes = []; }
  getLastRow() { let n = this.rows.length; while (n > 0 && this.rows[n - 1].every(v => String(v ?? '') === '')) n--; return n; }
  getMaxRows() { return this.maxRows; }
  insertRowsAfter(_, count) { this.maxRows += count; }
  setFrozenRows(n) { this.frozen = n; }
  deleteRow(row) { this.rows.splice(row - 1, 1); }
  appendRow(row) { this.rows.push(row.slice()); }
  getRange(row, col, height = 1, width = 1) {
    const sheet = this;
    const read = () => Array.from({ length: height }, (_, i) =>
      Array.from({ length: width }, (_, j) => sheet.rows[row - 1 + i]?.[col - 1 + j] ?? ''));
    const range = {
      getValues: read,
      getDisplayValues: () => read().map(r => r.map(v => String(v ?? ''))),
      setValues(values) {
        values.forEach((r, i) => { sheet.rows[row - 1 + i] ||= []; r.forEach((v, j) => { sheet.rows[row - 1 + i][col - 1 + j] = v; }); });
        return range;
      },
      setValue(value) { return range.setValues([[value]]); },
      setNumberFormat(format) { sheet.formats.push([row, col, height, width, format]); return range; },
      setNote(note) { sheet.notes.push(note); return range; }
    };
    return range;
  }
}
const GRADES = ['Commander', 'Major', 'Capitaine', 'Lieutenant-Chef', 'Lieutenant', 'Sergent-Chef',
  'Sergent', 'Caporal-Chef', 'Caporal', 'Garde', 'Cadet', 'Recrue'];
const donnees = new Sheet('Données', [['Grade'], ...GRADES.map(g => [g])]);
// Fiches telles que la synchronisation de l'historique les renvoie (`members`).
const fiches = [
  { id: uuid(1), prenom: 'Ragnhild', nom: 'Test', grade: 'Capitaine', corps: 'Cap Granite', status: 'En service actif' },
  { id: uuid(2), prenom: 'Sven', nom: 'Bouclier-de-Fer', grade: 'Sergent', corps: 'Cité de Blancherive', status: 'En service actif' },
  { id: uuid(3), prenom: 'Olaf', nom: 'Le Réserviste', grade: 'Garde', corps: 'Cité de Blancherive', status: 'Réserve' },
  { id: uuid(4), prenom: 'Eydis', nom: 'Silencieuse', grade: 'Sergent-Chef', corps: 'Garnison de Rivebois', status: 'En service actif' }
];
const sheets = new Map([['Données', donnees]]);
const ss = {
  getSheetByName: nom => sheets.get(nom) || null,
  insertSheet: nom => { const sheet = new Sheet(nom, []); sheets.set(nom, sheet); return sheet; }
};
const comptes = () => sheets.get('Comptes');

// ---------------------------------------------------------------- contexte
let horloge = Date.parse('2026-11-10T10:00:00Z'), proprietes = {}, cache = new Map(), uuids = 100, synchros = 0, verrous = 0;
const octets = v => (typeof v === 'string' ? Buffer.from(v, 'utf8') : Buffer.from(v));
const context = vm.createContext({
  Date: Object.assign(function (...args) { return args.length ? new Date(...args) : new Date(horloge); }, { now: () => horloge, parse: Date.parse }),
  console: { error() {} },
  SPREADSHEET_ID: 'test',
  EFFECTIFS_WEB_DONNEES_SHEET_NAME: 'Données',
  EFFECTIFS_WEB_ACTIVE_STATUS: 'En service actif',
  nettoyerEffectifsWeb_: value => String(value ?? '').trim(),
  normaliserEffectifsWeb_: value => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
  PropertiesService: { getScriptProperties: () => ({
    getProperty: nom => (nom in proprietes ? proprietes[nom] : null),
    setProperty: (nom, valeur) => { proprietes[nom] = valeur; },
    deleteProperty: nom => { delete proprietes[nom]; }
  }) },
  CacheService: { getScriptCache: () => ({
    get: cle => cache.get(cle) ?? null, put: (cle, valeur) => cache.set(cle, valeur), remove: cle => cache.delete(cle)
  }) },
  LockService: { getScriptLock: () => ({ waitLock() { verrous++; }, releaseLock() { verrous--; } }) },
  SpreadsheetApp: { openById: () => ss, flush() {} },
  ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/ABC/exec' }) },
  Utilities: {
    getUuid: () => uuid(++uuids),
    newBlob: valeur => ({ getBytes: () => Array.from(octets(valeur).values()), getDataAsString: () => octets(valeur).toString('utf8') }),
    base64EncodeWebSafe: valeur => octets(valeur).toString('base64url'),
    base64DecodeWebSafe: valeur => Array.from(Buffer.from(valeur, 'base64url').values()),
    computeHmacSha256Signature: (donnees, cle) => Array.from(createHmac('sha256', octets(cle)).update(octets(donnees)).digest().values())
  },
  // Même chemin que HistoriqueEffectifs.js : les fiches, puis la table des comptes.
  synchroniserHistoriqueEffectifs_() {
    synchros++;
    const members = fiches.map(f => ({ ...f }));
    return { members, accesComptes: context.mettreAJourAccesComptes_(ss, members) };
  }
});
vm.runInContext(readFileSync('src/Auth.js', 'utf8'), context);
vm.runInContext(readFileSync('src/Discord.js', 'utf8'), context);
// Les itérations réelles ralentissent la suite sans rien prouver de plus.
const sourceComptes = readFileSync('src/Comptes.js', 'utf8');
assert.ok(sourceComptes.includes('const COMPTES_ITERATIONS = 2000;'), 'Nombre d’itérations attendu');
vm.runInContext(sourceComptes.replace('const COMPTES_ITERATIONS = 2000;', 'const COMPTES_ITERATIONS = 3;'), context);

proprietes = { AUTH_SECRET: 'secret-de-test', PASSWORD_OFFICIER: 'officier', PASSWORD_GARDE: 'garde' };
const charge = jeton => JSON.parse(Buffer.from(jeton.split('.')[0], 'base64url').toString('utf8'));
const jetonInvitation = url => { const m = /\?invitation=([0-9a-f]{32})$/.exec(url); assert.ok(m, `Adresse d'invitation attendue : ${url}`); return m[1]; };
const texteFeuille = () => JSON.stringify(comptes()?.rows || []);
const officierCode = context.login('officier');
const gardeCode = context.login('garde');

// ---------------------------------------------------------------- invitation
assert.throws(() => context.creerInvitationCompte(gardeCode, uuid(1)), /droits nécessaires/, 'Un garde ne remet pas de lien');
assert.throws(() => context.creerInvitationCompte(officierCode, uuid(99)), /n'existe plus/);
assert.throws(() => context.creerInvitationCompte(officierCode, uuid(3)), /Réserve.*ne donne pas accès/, 'Pas de lien pour une fiche sans accès');
assert.equal(comptes(), undefined, 'Aucun refus ne crée la feuille');
assert.equal(proprietes.COMPTES_SECRET, undefined);

const invitationSven = context.creerInvitationCompte(officierCode, uuid(2));
assert.ok(proprietes.COMPTES_SECRET && proprietes.COMPTES_SECRET.length >= 64, 'Secret du serveur créé à la première invitation');
const jetonSven = jetonInvitation(invitationSven.url);
assert.equal(invitationSven.nom, 'Sven Bouclier-de-Fer');
assert.deepEqual({ etat: invitationSven.compte.etat, expire: invitationSven.compte.expire, activeLe: invitationSven.compte.activeLe, derniereConnexion: invitationSven.compte.derniereConnexion }, { etat: 'invitation', expire: invitationSven.expire, activeLe: '', derniereConnexion: '' });
assert.equal(Date.parse(invitationSven.expire) - horloge, 7 * 24 * 60 * 60 * 1000, 'Sept jours');
assert.deepEqual(comptes().rows[0], ['ID membre', 'Nom', 'Sel', 'Empreinte', 'Version', 'Invitation', 'Invitation expire', 'Invitée par', 'Activé le', 'Dernière connexion']);
assert.equal(comptes().frozen, 1);
assert.ok(comptes().formats.some(f => f[4] === '@'), 'Feuille au format texte');
assert.equal(comptes().rows[1][0], uuid(2));
assert.equal(comptes().rows[1][1], 'Sven Bouclier-de-Fer');
assert.equal(comptes().rows[1][7], 'code des officiers', 'Invitation par code commun : pas de nom d’officier');
// Lignes recopiées hors du contexte vm, pour deepEqual.
const journal = () => ({ rows: sheets.get('JournalComptes').rows.map(r => Array.from(r)) });
assert.deepEqual(journal().rows[0], ['Date ISO', 'ID membre', 'Nom', 'Action', 'Par', 'Détail']);
assert.deepEqual(journal().rows[1].slice(1, 5), [uuid(2), 'Sven Bouclier-de-Fer', 'lien', 'code des officiers'], 'Lien consigné au journal');
assert.match(journal().rows[1][5], /^Premier lien/);
assert.deepEqual([...invitationSven.compte.historique].map(e => e.action), ['lien']);
assert.equal(invitationSven.compte.inviteePar, 'code des officiers');
assert.equal(Date.parse(invitationSven.compte.lienRemisLe), horloge, 'Date de remise retrouvée');
assert.ok(!texteFeuille().includes(jetonSven), 'Le jeton du lien n’est pas dans la feuille, seule son empreinte');

// Lecture du lien par l'écran d'activation.
assert.deepEqual({ ...context.lireInvitationCompte(jetonSven) },
  { nom: 'Sven Bouclier-de-Fer', grade: 'Sergent', corps: 'Cité de Blancherive', expire: invitationSven.expire, dejaActif: false });
assert.throws(() => context.lireInvitationCompte('0'.repeat(32)), /inconnu ou expiré/);
assert.throws(() => context.lireInvitationCompte('pas-un-jeton'), /inconnu ou expiré/);
assert.throws(() => context.lireInvitationCompte(''), /inconnu ou expiré/);

// ---------------------------------------------------------------- activation
assert.throws(() => context.activerCompte(jetonSven, 'court'), /au moins 8 caractères/);
assert.throws(() => context.activerCompte(jetonSven, 'Sven Bouclier-de-Fer'), /ne doit pas être votre nom/);
assert.throws(() => context.activerCompte(jetonSven, 'bouclier-de-fer'), /ne doit pas être votre nom/);
assert.throws(() => context.activerCompte('0'.repeat(32), 'un-bon-mot-de-passe'), /inconnu ou expiré/);

const sessionSven = context.activerCompte(jetonSven, 'Hache & Bouclier 1');
let contenu = charge(sessionSven);
assert.deepEqual({ role: contenu.role, via: contenu.via, membre: contenu.membre, nom: contenu.nom, v: contenu.v },
  { role: 'GARDE', via: 'compte', membre: uuid(2), nom: 'Sven Bouclier-de-Fer', v: '1' });
assert.equal(contenu.exp - horloge, 30 * 24 * 60 * 60 * 1000, 'Trente jours');
assert.deepEqual({ ...context.getSessionInfo(sessionSven) }, { role: 'GARDE', nom: 'Sven Bouclier-de-Fer', via: 'compte' });
assert.equal(context.requireRole(sessionSven, ['GARDE', 'OFFICIER']).role, 'GARDE');
assert.throws(() => context.requireRole(sessionSven, ['OFFICIER']), /droits nécessaires/, 'Un Sergent n’est pas officier');
assert.equal(comptes().rows[1][5], '', 'Lien consommé');
assert.deepEqual(journal().rows.at(-1).slice(2, 6), ['Sven Bouclier-de-Fer', 'activation', 'Sven Bouclier-de-Fer', 'Mot de passe choisi']);
assert.equal(comptes().rows[1][4], '1');
assert.ok(comptes().rows[1][3].startsWith('3$'), 'Empreinte avec son nombre d’itérations');
assert.ok(!texteFeuille().includes('Hache & Bouclier'), 'Le mot de passe n’est jamais écrit');
assert.throws(() => context.activerCompte(jetonSven, 'Hache & Bouclier 2'), /inconnu ou expiré/, 'Un lien ne sert qu’une fois');
assert.ok(proprietes.COMPTES_ACCES.includes(uuid(2).slice(0, 12)), 'Table d’accès écrite');
assert.ok(!proprietes.COMPTES_ACCES.includes(uuid(1).slice(0, 12)), 'Pas d’entrée sans compte actif');

// ---------------------------------------------------------------- connexion
const connecte = (nom, mdp) => context.connecterCompte(nom, mdp);
assert.throws(() => connecte('', 'x'), /Indiquez votre nom/);
assert.throws(() => connecte('Sven Bouclier-de-Fer', ''), /Indiquez votre mot de passe/);
assert.throws(() => connecte('Sven Bouclier-de-Fer', 'faux'), /^Error: Nom ou mot de passe incorrect\.$/);
assert.throws(() => connecte('Inconnu Total', 'Hache & Bouclier 1'), /^Error: Nom ou mot de passe incorrect\.$/, 'Même message : le nom n’est pas révélé');
assert.throws(() => connecte('Ragnhild Test', 'Hache & Bouclier 1'), /Nom ou mot de passe incorrect/, 'Fiche sans compte : refus ordinaire');
let sessionSven2 = connecte('  sven   BOUCLIER-DE-FER ', 'Hache & Bouclier 1');
assert.equal(charge(sessionSven2).membre, uuid(2), 'Nom reconnu sans casse ni espaces superflus');
assert.equal(comptes().rows[1][9], new Date(horloge).toISOString(), 'Dernière connexion notée');
assert.equal(cache.get('comptes:echecs:sven bouclier-de-fer'), undefined, 'Compteur d’échecs effacé après une réussite');

// Pause après huit essais, même avec le bon mot de passe ensuite.
for (let i = 0; i < 8; i++) assert.throws(() => connecte('Sven Bouclier-de-Fer', 'faux ' + i), /incorrect/);
assert.throws(() => connecte('Sven Bouclier-de-Fer', 'Hache & Bouclier 1'), /Trop de tentatives/);
cache.clear();
assert.equal(charge(connecte('Sven Bouclier-de-Fer', 'Hache & Bouclier 1')).role, 'GARDE');

// Prolongation glissante, comme Discord.
const debut = horloge;
assert.equal(context.getSessionInfo(sessionSven2).jeton, undefined, 'Moins d’un jour : pas de nouveau jeton');
horloge += 2 * 24 * 60 * 60 * 1000;
const prolonge = context.getSessionInfo(sessionSven2).jeton;
assert.ok(prolonge, 'Après un jour : jeton neuf');
assert.equal(charge(prolonge).exp - horloge, 30 * 24 * 60 * 60 * 1000);
assert.equal(charge(prolonge).v, '1');
horloge = debut;

// ---------------------------------------------------------------- le tableur décide
fiches[1].status = 'Réserve';
context.synchroniserHistoriqueEffectifs_();
assert.throws(() => context.verifyAuthToken(sessionSven2), /accès au registre a changé/, 'Réserve : session fermée à l’appel suivant');
assert.throws(() => connecte('Sven Bouclier-de-Fer', 'Hache & Bouclier 1'), /Réserve.*ne donne pas accès/, 'Bon mot de passe, fiche sans accès');
fiches[1].status = 'En service actif';
context.synchroniserHistoriqueEffectifs_();
assert.equal(context.verifyAuthToken(sessionSven2).role, 'GARDE', 'Retour en service : la session reprend');

fiches[1].grade = 'Sergent-Chef';
context.synchroniserHistoriqueEffectifs_();
assert.throws(() => context.verifyAuthToken(sessionSven2), /accès au registre a changé/, 'Promotion : l’ancienne session GARDE tombe');
sessionSven2 = connecte('Sven Bouclier-de-Fer', 'Hache & Bouclier 1');
assert.equal(charge(sessionSven2).role, 'OFFICIER', 'Sergent-Chef : OFFICIER à la reconnexion');
assert.equal(context.requireRole(sessionSven2, ['OFFICIER']).role, 'OFFICIER');
fiches[1].grade = 'Sergent';
context.synchroniserHistoriqueEffectifs_();
assert.throws(() => context.requireRole(sessionSven2, ['OFFICIER']), /accès au registre a changé/, 'Rétrogradation : coupure immédiate');
sessionSven2 = connecte('Sven Bouclier-de-Fer', 'Hache & Bouclier 1');

fiches[1].nom = 'Bouclier-de-Bronze';
context.synchroniserHistoriqueEffectifs_();
assert.equal(comptes().rows[1][1], 'Sven Bouclier-de-Bronze', 'Nom de la feuille Comptes rafraîchi');
assert.throws(() => context.verifyAuthToken(sessionSven2), /accès au registre a changé/, 'Renommage : session fermée');
assert.throws(() => connecte('Sven Bouclier-de-Fer', 'Hache & Bouclier 1'), /Nom ou mot de passe incorrect/, 'L’ancien nom ne vaut plus');
sessionSven2 = connecte('Sven Bouclier-de-Bronze', 'Hache & Bouclier 1');
assert.equal(charge(sessionSven2).nom, 'Sven Bouclier-de-Bronze');

delete proprietes.COMPTES_ACCES;
assert.throws(() => context.verifyAuthToken(sessionSven2), /accès au registre a changé/, 'Table absente : aucune session personnelle');
context.synchroniserHistoriqueEffectifs_();
assert.equal(context.verifyAuthToken(sessionSven2).role, 'GARDE');

// ---------------------------------------------------------------- changement de mot de passe
assert.throws(() => context.changerMotDePasseCompte(officierCode, 'x', 'un-nouveau-mot-de-passe'), /Seule une session personnelle/);
assert.throws(() => context.changerMotDePasseCompte(sessionSven2, 'faux', 'un-nouveau-mot-de-passe'), /actuel incorrect/);
assert.throws(() => context.changerMotDePasseCompte(sessionSven2, 'Hache & Bouclier 1', 'court'), /au moins 8/);
assert.throws(() => context.changerMotDePasseCompte(sessionSven2, 'Hache & Bouclier 1', 'Hache & Bouclier 1'), /différent/);
const sessionSven3 = context.changerMotDePasseCompte(sessionSven2, 'Hache & Bouclier 1', 'Hache & Bouclier 2');
assert.equal(charge(sessionSven3).v, '2');
assert.throws(() => context.verifyAuthToken(sessionSven2), /accès au registre a changé/, 'Les autres sessions tombent');
assert.equal(context.verifyAuthToken(sessionSven3).role, 'GARDE');
assert.throws(() => connecte('Sven Bouclier-de-Bronze', 'Hache & Bouclier 1'), /incorrect/);
assert.equal(charge(connecte('Sven Bouclier-de-Bronze', 'Hache & Bouclier 2')).v, '2');

// Nouveau lien sur un compte actif : Lieutenant et plus, pour prévenir les abus (prise du compte d'autrui).
fiches[3].grade = 'Sergent-Chef';
context.synchroniserHistoriqueEffectifs_();
const invitationEydisTest = context.creerInvitationCompte(officierCode, uuid(4));
const sessionEydisTest = context.activerCompte(jetonInvitation(invitationEydisTest.url), 'Silence et Patience');
assert.equal(charge(sessionEydisTest).role, 'OFFICIER');
assert.throws(() => context.creerInvitationCompte(sessionEydisTest, uuid(2)), /réservé aux Lieutenants et plus/, 'Un Sergent-Chef ne renouvelle pas le lien d’un compte actif');
assert.ok(!journal().rows.some(r => r[3] === 'lien' && r[4] === 'Eydis Silencieuse'), 'Le refus n’est pas un lien');
fiches[3].grade = 'Lieutenant';
context.synchroniserHistoriqueEffectifs_();
assert.equal(context.verifyAuthToken(sessionEydisTest).role, 'OFFICIER', 'Promotion au sein des officiers : même rôle, session conservée ; le grade est relu dans la fiche');
const sessionEydisLt = connecte('Eydis Silencieuse', 'Silence et Patience');
const renouvele = context.creerInvitationCompte(sessionEydisLt, uuid(2));
assert.equal(renouvele.compte.etat, 'actif');
assert.deepEqual(journal().rows.at(-1).slice(1, 5), [uuid(2), 'Sven Bouclier-de-Bronze', 'lien', 'Eydis Silencieuse'], 'Qui a renouvelé le lien est consigné');
assert.match(journal().rows.at(-1)[5], /^Nouveau lien, compte déjà actif/);
assert.equal(renouvele.compte.historique[0].par, 'Eydis Silencieuse');
assert.ok(renouvele.compte.historique.length <= 6);
// Premier lien d'un membre sans compte : tout officier, Sergent-Chef compris.
fiches[3].grade = 'Sergent-Chef';
context.synchroniserHistoriqueEffectifs_();
const sessionEydisSc = connecte('Eydis Silencieuse', 'Silence et Patience');
assert.equal(context.creerInvitationCompte(sessionEydisSc, uuid(1)).compte.etat, 'invitation', 'Premier lien ouvert à tout officier');
assert.equal(journal().rows.at(-1)[4], 'Eydis Silencieuse');
context.supprimerCompte(officierCode, uuid(1));
context.supprimerCompte(officierCode, uuid(4));
context.synchroniserHistoriqueEffectifs_();

// Mot de passe oublié : un nouveau lien remplace le mot de passe à l'activation.
const nominative = context.createAuthToken_('OFFICIER', 60 * 60 * 1000, 'compte', { membre: uuid(1), nom: 'Ragnhild Test', v: '1' });
assert.throws(() => context.creerInvitationCompte(nominative, uuid(2)), /accès au registre a changé/, 'Une session personnelle sans compte ne vaut rien');
const invitationBis = context.creerInvitationCompte(officierCode, uuid(2));
assert.equal(invitationBis.compte.etat, 'actif', 'Le compte reste actif tant que le lien n’est pas activé');
assert.equal(invitationBis.compte.expire, invitationBis.expire);
assert.equal(context.lireInvitationCompte(jetonInvitation(invitationBis.url)).dejaActif, true);
assert.equal(charge(connecte('Sven Bouclier-de-Bronze', 'Hache & Bouclier 2')).v, '2', 'L’ancien mot de passe vaut encore');
const sessionSven4 = context.activerCompte(jetonInvitation(invitationBis.url), 'Hache & Bouclier 3');
assert.equal(charge(sessionSven4).v, '3');
assert.throws(() => context.verifyAuthToken(sessionSven3), /accès au registre a changé/);
assert.throws(() => connecte('Sven Bouclier-de-Bronze', 'Hache & Bouclier 2'), /incorrect/);

// Lien expiré.
const invitationEydis = context.creerInvitationCompte(officierCode, uuid(4));
horloge += 7 * 24 * 60 * 60 * 1000 + 1;
assert.throws(() => context.lireInvitationCompte(jetonInvitation(invitationEydis.url)), /inconnu ou expiré/);
assert.throws(() => context.activerCompte(jetonInvitation(invitationEydis.url), 'un-bon-mot-de-passe'), /inconnu ou expiré/);
assert.equal(context.lireEtatsComptes_(ss).get(uuid(4)).etat, 'expire');
horloge = debut;

// Invitation signée du nom de l'officier en session personnelle.
fiches[1].grade = 'Sergent-Chef';
context.synchroniserHistoriqueEffectifs_();
const sessionSvenOfficier = connecte('Sven Bouclier-de-Bronze', 'Hache & Bouclier 3');
const invitationEydis2 = context.creerInvitationCompte(sessionSvenOfficier, uuid(4));
assert.equal(comptes().rows.find(r => r[0] === uuid(4))[7], 'Sven Bouclier-de-Bronze');
const sessionEydis = context.activerCompte(jetonInvitation(invitationEydis2.url), 'Silence et Patience');
assert.equal(charge(sessionEydis).role, 'OFFICIER', 'Sergent-Chef : officier dès le seuil');

// ---------------------------------------------------------------- retrait du compte
assert.throws(() => context.supprimerCompte(gardeCode, uuid(2)), /droits nécessaires/);
const retrait = context.supprimerCompte(officierCode, uuid(2)).compte;
assert.deepEqual({ etat: retrait.etat, expire: retrait.expire, activeLe: retrait.activeLe, inviteePar: retrait.inviteePar }, { etat: 'aucun', expire: '', activeLe: '', inviteePar: '' });
assert.deepEqual([...retrait.historique].slice(0, 1).map(e => [e.action, e.par, e.detail]), [['retrait', 'code des officiers', 'Compte actif retiré']], 'Retrait consigné');
assert.throws(() => context.verifyAuthToken(sessionSven4), /accès au registre a changé/, 'Compte retiré : session fermée');
assert.throws(() => connecte('Sven Bouclier-de-Bronze', 'Hache & Bouclier 3'), /incorrect/);
assert.equal(comptes().rows.some(r => r[0] === uuid(2)), false);
assert.equal(context.verifyAuthToken(sessionEydis).role, 'OFFICIER', 'Les autres comptes restent');

// ---------------------------------------------------------------- secret du serveur
const empreinteAvant = comptes().rows.find(r => r[0] === uuid(4))[3];
proprietes.COMPTES_SECRET = 'autre-secret';
assert.throws(() => connecte('Eydis Silencieuse', 'Silence et Patience'), /incorrect/, 'Sans le secret du serveur, la feuille seule ne vaut rien');
assert.equal(comptes().rows.find(r => r[0] === uuid(4))[3], empreinteAvant, 'La feuille n’est pas réécrite par un refus');
assert.equal(verrous, 0, 'Tous les verrous rendus');

// ---------------------------------------------------------------- saisie à son propre nom (Amendes.js)
const registre = vm.createContext({});
vm.runInContext(readFileSync('src/Amendes.js', 'utf8'), registre);
assert.equal(registre.gardeImposeSession_({ role: 'OFFICIER', via: 'compte', nom: 'Eydis Silencieuse' }), 'Eydis Silencieuse');
assert.deepEqual({ ...registre.imposerGardeSession_({ via: 'compte', nom: 'Eydis Silencieuse' }, { garde: 'Quelqu’un d’autre', montant: 5 }) }, { garde: 'Eydis Silencieuse', montant: 5 });
assert.equal(registre.gardeImposeSession_({ role: 'OFFICIER', via: 'code' }), '', 'Un code commun n’impose rien');
assert.deepEqual({ ...registre.imposerGardeSession_({ via: 'code' }, { garde: 'Libre' }) }, { garde: 'Libre' });
assert.throws(() => registre.imposerGardeSession_({ via: 'compte', nom: '' }, {}), /ne porte pas de nom/);

console.log('Comptes individuels : invitation, activation, connexion, pause, le tableur décide, mot de passe, retrait, secret et saisie à son nom validés.');
