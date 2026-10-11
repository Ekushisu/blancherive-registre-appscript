/*
  Codes communs activables par rôle, et surface publique d'`Auth.js`.

  Toute fonction de premier niveau sans `_` final est appelable depuis le
  navigateur par `google.script.run`, en accès anonyme. Jusqu'au 10 octobre
  2026, `createAuthToken` l'était : n'importe qui pouvait se délivrer un jeton
  OFFICIER. Ce test fige la liste des fonctions publiques du fichier.

  `AUTH_CODES` (propriété du script) liste les rôles dont le code commun est
  accepté ; absente, les trois le sont. Un code désactivé ferme aussi les
  sessions ouvertes avec lui, dès l'appel suivant.
*/
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('src/Auth.js', 'utf8');

// Surface publique : exactement ces sept fonctions.
const publiques = [...source.matchAll(/^function\s+([A-Za-z0-9_$]+)\s*\(/gm)]
  .map(m => m[1])
  .filter(nom => !nom.endsWith('_'))
  .sort();
assert.deepEqual(publiques,
  ['getModesConnexion', 'getSessionInfo', 'login', 'ouvrirSessionDiscord', 'ouvrirSessionPublique', 'requireRole', 'verifyAuthToken'],
  'Une fonction publique d’Auth.js est appelable par google.script.run : ' +
  'toute fonction qui fabrique un jeton doit finir par « _ »');

// Seules trois fonctions délivrent un jeton, dans tout le dépôt.
const emetteurs = [];
for (const fichier of fs.readdirSync('src').filter(f => f.endsWith('.js'))) {
  const contenu = fs.readFileSync(`src/${fichier}`, 'utf8');
  const fonctions = [...contenu.matchAll(/^function\s+([A-Za-z0-9_$]+)\s*\(/gm)];
  fonctions.forEach((m, i) => {
    const corps = contenu.slice(m.index, fonctions[i + 1]?.index ?? contenu.length);
    if (m[1] !== 'createAuthToken_' && /createAuthToken_\s*\(/.test(corps)) emetteurs.push(m[1]);
  });
}
// `getSessionInfo` ne fait que prolonger une session Discord déjà vérifiée (test-connexion-discord.mjs).
assert.deepEqual(emetteurs.sort(), ['getSessionInfo', 'login', 'ouvrirSessionDiscord', 'ouvrirSessionPublique'],
  'Une nouvelle fonction délivre un jeton : la relire, puis l’ajouter ici en connaissance de cause');

let horloge = 1_000_000;
let proprietes = {};
const context = vm.createContext({
  Date: { now: () => horloge },
  PropertiesService: { getScriptProperties: () => ({
    getProperty: nom => (nom in proprietes ? proprietes[nom] : null)
  }) },
  Utilities: {
    base64EncodeWebSafe: valeur => Buffer.from(
      typeof valeur === 'string' ? valeur : Buffer.from(valeur)
    ).toString('base64url'),
    // Vraie signature HMAC : l'empreinte tronquée d'un code doit dépendre du code.
    computeHmacSha256Signature: (donnees, cle) => Array.from(
      createHmac('sha256', cle).update(donnees).digest().values()
    ),
    base64DecodeWebSafe: valeur => Array.from(Buffer.from(valeur, 'base64url').values()),
    newBlob: octets => ({ getDataAsString: () => Buffer.from(octets).toString('utf8') })
  }
});
vm.runInContext(source, context);

assert.equal(typeof context.createAuthToken, 'undefined',
  'createAuthToken ne doit plus exister sous son nom public');

const CODES = {
  AUTH_SECRET: 'secret-de-test',
  PASSWORD_GARDE: 'garde',
  PASSWORD_OFFICIER: 'officier',
  PASSWORD_INTENDANT: 'intendant'
};
const regler = autres => { proprietes = { ...CODES, ...autres }; };
const charge = jeton => JSON.parse(Buffer.from(jeton.split('.')[0], 'base64url').toString('utf8'));
const role = jeton => context.getSessionInfo(jeton).role;

// Propriété absente : comportement d'avant, les trois codes, origine « code ».
regler({});
assert.equal(role(context.login('officier')), 'OFFICIER');
assert.equal(role(context.login('garde')), 'GARDE');
assert.equal(role(context.login('intendant')), 'INTENDANT');
assert.equal(charge(context.login('garde')).via, 'code');
assert.throws(() => context.login('inconnu'), /^Error: Mot de passe incorrect\.$/);

// Une propriété de mot de passe absente ne correspond jamais, même à un code vide.
regler({});
delete proprietes.PASSWORD_INTENDANT;
assert.throws(() => context.login(''), /Mot de passe incorrect/);
assert.throws(() => context.login(undefined), /Mot de passe incorrect/);
assert.throws(() => context.login(null), /Mot de passe incorrect/);

// Liste partielle, casse et espaces tolérés.
regler({ AUTH_CODES: ' garde , INTENDANT' });
assert.throws(() => context.login('officier'), /^Error: Le code des officiers n'est plus accepté\.$/);
assert.equal(role(context.login('garde')), 'GARDE');
assert.equal(role(context.login('intendant')), 'INTENDANT');

// Aucun rôle : chaque code juste reçoit son message, un code faux reste faux.
regler({ AUTH_CODES: 'AUCUN' });
assert.throws(() => context.login('garde'), /Le code des gardes n'est plus accepté/);
assert.throws(() => context.login('intendant'), /Le code de l'intendance n'est plus accepté/);
assert.throws(() => context.login('inconnu'), /Mot de passe incorrect/);

// Une faute de frappe ferme le rôle mal écrit, elle n'ouvre rien d'autre.
regler({ AUTH_CODES: 'OFICIER,GARDE' });
assert.throws(() => context.login('officier'), /des officiers n'est plus accepté/);
assert.equal(role(context.login('garde')), 'GARDE');
assert.throws(() => context.login('intendant'), /de l'intendance n'est plus accepté/);

// Codes identiques par erreur : le plus privilégié des rôles actifs l'emporte.
regler({ PASSWORD_GARDE: 'meme', PASSWORD_OFFICIER: 'meme' });
assert.equal(role(context.login('meme')), 'OFFICIER');
regler({ PASSWORD_GARDE: 'meme', PASSWORD_OFFICIER: 'meme', AUTH_CODES: 'GARDE,INTENDANT' });
assert.equal(role(context.login('meme')), 'GARDE');

// Coupure immédiate : les sessions ouvertes par un code désactivé tombent.
regler({});
const officier = context.login('officier');
const garde = context.login('garde');
const intendant = context.login('intendant');
const visiteur = context.ouvrirSessionPublique();
regler({ AUTH_CODES: 'GARDE,INTENDANT' });
assert.throws(() => context.verifyAuthToken(officier),
  /^Error: Le code des officiers n'est plus accepté\. Session fermée\.$/);
assert.throws(() => context.requireRole(officier, ['OFFICIER']), /n'est plus accepté/);
assert.throws(() => context.getSessionInfo(officier), /n'est plus accepté/);
assert.equal(context.requireRole(garde, ['GARDE', 'OFFICIER']).role, 'GARDE');
assert.equal(role(intendant), 'INTENDANT');

// Le visiteur public ne dépend d'aucun code.
regler({ AUTH_CODES: 'AUCUN' });
assert.equal(context.requireRole(visiteur, ['VISITEUR']).role, 'VISITEUR');
assert.throws(() => context.verifyAuthToken(garde), /des gardes n'est plus accepté/);

// Un jeton délivré avant l'introduction de `via` compte comme un jeton de code.
regler({});
const ancien = context.createAuthToken_('OFFICIER');
assert.equal(charge(ancien).via, undefined);
assert.equal(role(ancien), 'OFFICIER');
regler({ AUTH_CODES: 'GARDE' });
assert.throws(() => context.verifyAuthToken(ancien), /des officiers n'est plus accepté/);

// L'origine est signée : la réécrire invalide le jeton.
const forge = Buffer.from(JSON.stringify({ ...charge(officier), via: 'discord' })).toString('base64url');
assert.throws(() => context.verifyAuthToken(`${forge}.${officier.split('.')[1]}`), /Token invalide/);

// Code changé : les sessions ouvertes avec l'ancien tombent, les autres rôles non.
regler({});
const gardeAvant = context.login('garde');
const contenuGarde = charge(gardeAvant);
assert.equal(typeof contenuGarde.cle, 'string');
assert.ok(contenuGarde.cle.length >= 12, 'Empreinte présente');
assert.ok(!JSON.stringify(contenuGarde).includes('garde"') && !Object.values(contenuGarde).includes('garde'), 'Le code lui-même n’est jamais dans le jeton');
regler({ PASSWORD_GARDE: 'nouveau-code' });
assert.throws(() => context.verifyAuthToken(gardeAvant), /^Error: Le code des gardes a changé : reconnectez-vous avec le nouveau code\.$/);
assert.equal(role(intendant), 'INTENDANT', 'Code d’un autre rôle inchangé : session intacte');
assert.equal(role(context.login('nouveau-code')), 'GARDE');
regler({ PASSWORD_GARDE: 'nouveau-code', AUTH_SECRET: 'autre-secret' });
assert.throws(() => context.verifyAuthToken(intendant), /Token invalide/, 'Changer AUTH_SECRET ferme tout');

// Durées : trois jours pour un code, sans prolongation ; deux heures pour le visiteur.
regler({});
const debut = horloge;
const longue = context.login('garde');
assert.equal(charge(longue).exp - debut, 3 * 24 * 60 * 60 * 1000);
assert.equal(charge(context.ouvrirSessionPublique()).exp - debut, 2 * 60 * 60 * 1000);
horloge += 2 * 24 * 60 * 60 * 1000;
assert.deepEqual({ ...context.getSessionInfo(longue) }, { role: 'GARDE', nom: '' }, 'Session par code jamais prolongée');
horloge = debut + 3 * 24 * 60 * 60 * 1000 + 1;
assert.throws(() => context.verifyAuthToken(longue), /Session expirée/);

console.log('Codes communs : activables par rôle, coupure immédiate des sessions, code changé, durées, aucune fabrique de jeton publique.');
