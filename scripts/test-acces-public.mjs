/*
  Accès public au Codex.

  La Web App s'exécute avec le compte du propriétaire et en accès anonyme :
  toute personne qui charge la page peut appeler n'importe quelle fonction
  serveur. `requireRole()` est le seul rempart, et `ouvrirSessionPublique()`
  délivre un jeton sans mot de passe — ne pas connaître de code ne protège donc
  plus rien.

  Ce test échoue si le rôle public apparaît ailleurs que dans `getCodex`. Sans
  lui, un ajout distrait dans une liste de rôles ouvrirait les Effectifs ou les
  Présences au monde entier, sans erreur ni signal.
*/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const src = 'src';
const fichiers = fs.readdirSync(src).filter(f => f.endsWith('.js'));

// Toutes les listes de rôles du dépôt, avec leur fichier.
const appels = [];
for (const fichier of fichiers) {
  const contenu = fs.readFileSync(path.join(src, fichier), 'utf8');
  for (const m of contenu.matchAll(/requireRole\(\s*[A-Za-z0-9_.]+\s*,\s*\[([^\]]*)\]/g)) {
    appels.push({ fichier, roles: m[1] });
  }
}
assert.ok(appels.length > 5, 'Les appels à requireRole doivent être détectés');

const publics = appels.filter(a => /ROLE_PUBLIC|["']VISITEUR["']/.test(a.roles));
assert.equal(publics.length, 1,
  'Le rôle public ne doit figurer que dans une seule liste de rôles, celle de getCodex. ' +
  `Trouvé dans : ${publics.map(p => p.fichier).join(', ') || 'aucun'}`);
assert.equal(publics[0].fichier, 'Codex.js');

// Aucune fonction de mutation ne doit mentionner le rôle public, même en commentaire de liste.
for (const fichier of fichiers.filter(f => f !== 'Auth.js' && f !== 'Codex.js')) {
  const contenu = fs.readFileSync(path.join(src, fichier), 'utf8');
  assert.ok(!/ROLE_PUBLIC|VISITEUR/.test(contenu),
    `${fichier} ne doit pas mentionner le rôle public`);
}

/*
  Comportement du jeton. `Auth.js` est chargé seul : les autres fichiers Apps
  Script partagent son espace global mais n'interviennent pas ici.
*/
let horloge = 1_000_000;
const context = vm.createContext({
  Date: { now: () => horloge },
  PropertiesService: { getScriptProperties: () => ({
    getProperty: nom => ({ AUTH_SECRET: 'secret-de-test',
      PASSWORD_GARDE: 'garde', PASSWORD_OFFICIER: 'officier' })[nom] || null
  }) },
  Utilities: {
    base64EncodeWebSafe: valeur => Buffer.from(
      typeof valeur === 'string' ? valeur : Buffer.from(valeur)
    ).toString('base64url'),
    computeHmacSha256Signature: (donnees, cle) => Array.from(
      Buffer.from(`${cle}::${donnees}`).values()
    ),
    base64DecodeWebSafe: valeur => Array.from(Buffer.from(valeur, 'base64url').values()),
    newBlob: octets => ({ getDataAsString: () => Buffer.from(octets).toString('utf8') })
  }
});
vm.runInContext(fs.readFileSync('src/Auth.js', 'utf8'), context);

const jeton = context.ouvrirSessionPublique();
assert.equal(context.getSessionInfo(jeton).role, 'VISITEUR');

// Le rôle public n'ouvre rien d'autre.
for (const roles of [['GARDE', 'OFFICIER'], ['OFFICIER'], ['GARDE']]) {
  assert.throws(() => context.requireRole(jeton, roles), /droits nécessaires/,
    `Le visiteur ne doit pas passer requireRole(${roles.join(', ')})`);
}
assert.equal(context.requireRole(jeton, ['VISITEUR', 'GARDE', 'OFFICIER']).role, 'VISITEUR');

// Le jeton public est signé : il ne se fabrique pas à la main.
const [charge] = jeton.split('.');
assert.throws(() => context.verifyAuthToken(`${charge}.signature-inventee`), /Token invalide/);

// Session de consultation plus courte qu'une prise de service.
const jetonGarde = context.login('garde');
const expiration = t => JSON.parse(
  Buffer.from(t.split('.')[0], 'base64url').toString('utf8')
).exp;
assert.ok(expiration(jeton) < expiration(jetonGarde),
  'Le jeton public doit expirer avant celui d’un membre de la Garde');

horloge += 2 * 60 * 60 * 1000 + 1000;
assert.throws(() => context.verifyAuthToken(jeton), /Session expirée/);

console.log('Accès public : rôle limité au Codex, jeton signé, expiration courte, aucune fuite ailleurs.');
