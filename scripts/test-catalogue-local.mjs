// Vérifie le cache local du catalogue des objets : droits et version côté
// serveur, parité stricte entre la recherche locale et `rechercherObjets`,
// stockage local et partage d'une seule requête.
//
//   node scripts/test-catalogue-local.mjs

import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const seed = JSON.parse(readFileSync('src/CatalogueObjets.html', 'utf8'));

// ---------------------------------------------------------------- serveur
const sheets = new Map();
let held = false, lectures = 0;
class Sheet {
  constructor(name, rows = []) { this.name = name; this.rows = rows; this.max = 20000; }
  getLastRow() { return this.rows.length; }
  getMaxRows() { return this.max; }
  insertRowsAfter(after, count) { this.max += count; }
  setFrozenRows() {}
  getRange(r, c, h = 1, w = 1) {
    const sheet = this, range = {
      getValues() { lectures++; return Array.from({ length: h }, (_, i) => Array.from({ length: w }, (_, j) => sheet.rows[r + i - 1]?.[c + j - 1] ?? '')); },
      getDisplayValues() { return this.getValues().map(row => row.map(String)); },
      setValues(values) { values.forEach((row, i) => row.forEach((v, j) => { (sheet.rows[r + i - 1] ||= [])[c + j - 1] = v; })); return range; },
      setNumberFormat() { return range; }, setFontWeight() { return range; }
    };
    return range;
  }
}
const ss = { getSheetByName: n => sheets.get(n) || null, insertSheet(n) { const s = new Sheet(n); sheets.set(n, s); return s; }, deleteSheet() {} };
const context = vm.createContext({
  Date, console, SPREADSHEET_ID: 'test',
  requireRole(token, roles) { if (!roles.includes(token)) throw Error('Accès refusé'); },
  SpreadsheetApp: { openById: () => ss, flush() {} },
  LockService: { getScriptLock: () => ({ waitLock() { held = true; }, releaseLock() { held = false; } }) },
  HtmlService: { createHtmlOutputFromFile: () => ({ getContent: () => JSON.stringify(seed) }) },
  Utilities: {
    DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (algo, texte) => Array.from(createHash(algo).update(texte, 'utf8').digest()),
    base64EncodeWebSafe: octets => Buffer.from(octets).toString('base64url')
  }
});
for (const f of ['Amendes.js', 'Objets.js']) vm.runInContext(readFileSync(`src/${f}`, 'utf8'), context);
const plain = x => JSON.parse(JSON.stringify(x));

for (const role of ['INTENDANT', 'VISITEUR', 'intrus']) {
  assert.throws(() => context.getCatalogueObjets(role), /Accès refusé/, `${role} ne reçoit pas le catalogue`);
}
assert.equal(lectures, 0, 'Refus avant toute lecture Sheets');

const complet = plain(context.getCatalogueObjets('GARDE'));
assert.equal(complet.objets.length, seed.length);
assert.equal(complet.total, seed.length);
assert.deepEqual(complet.objets[0], seed[0], 'Tableau compact [id, nom, type]');
assert.ok(complet.version.length > 10);
assert.ok(complet.alias['skyrim.esm|00000f'].includes('septim'));
assert.equal(held, false);

const inchange = plain(context.getCatalogueObjets('OFFICIER', complet.version));
assert.equal(inchange.objets, null, 'Version connue : pas de renvoi des fiches');
assert.equal(inchange.version, complet.version);
assert.equal(plain(context.getCatalogueObjets('OFFICIER', 'autre')).objets.length, seed.length, 'Version inconnue : fiches renvoyées');

// Un renommage dans la feuille change la version.
const objets = sheets.get('Objets');
const ligneOr = objets.rows.find(r => r[0] === 'skyrim.esm|00000F');
ligneOr[1] = 'Septims';
const renomme = plain(context.getCatalogueObjets('GARDE', complet.version));
assert.notEqual(renomme.version, complet.version);
assert.ok(renomme.objets.some(o => o[1] === 'Septims'));
ligneOr[1] = 'Or';
assert.equal(plain(context.getCatalogueObjets('GARDE', complet.version)).objets, null, 'Version identique après retour au texte initial');

// ---------------------------------------------------------------- client
const bundle = await build({ entryPoints: ['ui/src/catalogue.js'], bundle: true, write: false, format: 'cjs' });
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
const { preparerCatalogue, rechercherObjetsLocal, chargerCatalogue, reinitialiserCatalogue, catalogueEnMemoire, CLE_CATALOGUE_LOCAL } = client.module.exports;

// Parité stricte avec le serveur, requête par requête.
const catalogue = preparerCatalogue(complet);
assert.equal(catalogue.total, seed.length);
const requetes = ['épée acier', 'EPEE ACIER', '000000F', '00000f', 'skyrim.esm|013989', '013989', 'arm', 'or', 'septims', 'torch', 'crochet', 'lockpick', 'bouclier', 'ép', '  ', 'zzzzintrouvablezzzz', 'd4ec', 'a'.repeat(100)];
for (const q of requetes) {
  const serveur = plain(context.rechercherObjets('GARDE', q));
  const local = plain(rechercherObjetsLocal(catalogue, q));
  assert.deepEqual(local, serveur, `Recherche « ${q} » : résultat local différent du serveur`);
}
assert.equal(plain(rechercherObjetsLocal(catalogue, 'arm')).objets.length, 15);
assert.equal(rechercherObjetsLocal(catalogue, 'arm').tronque, true);
assert.throws(() => rechercherObjetsLocal(catalogue, 'a'.repeat(101)), /invalide/);
assert.throws(() => context.rechercherObjets('GARDE', 'a'.repeat(101)), /invalide/);

// Chargement : une seule requête pour deux appels simultanés, stockage local,
// puis version connue renvoyée au serveur.
let appels = [];
const serverCall = (nom, token, version) => { appels.push({ nom, token, version }); return Promise.resolve(plain(context.getCatalogueObjets(token, version))); };
reinitialiserCatalogue();
const [a, b] = await Promise.all([chargerCatalogue(serverCall, 'GARDE'), chargerCatalogue(serverCall, 'GARDE')]);
assert.equal(a, b);
assert.equal(appels.length, 1, 'Appels simultanés partagés');
assert.equal(appels[0].version, '', 'Aucune version connue au premier chargement');
assert.equal(a.total, seed.length);
assert.ok(stockage.has(CLE_CATALOGUE_LOCAL), 'Catalogue écrit dans localStorage');
assert.ok(stockage.get(CLE_CATALOGUE_LOCAL).length > 500_000);

// Nouvelle session : le stockage sert tout de suite, le serveur ne renvoie rien.
reinitialiserCatalogue();
appels = [];
const c = await chargerCatalogue(serverCall, 'OFFICIER');
assert.equal(appels[0].version, complet.version, 'Version stockée envoyée au serveur');
assert.equal(c.total, seed.length, 'Catalogue conservé quand le serveur ne renvoie rien');
assert.equal(catalogueEnMemoire(), c);

// Quota dépassé : le catalogue reste utilisable en mémoire.
reinitialiserCatalogue(); stockage.clear(); quotaDepasse = true;
const d = await chargerCatalogue(serverCall, 'GARDE');
assert.equal(d.total, seed.length);
assert.equal(stockage.size, 0);
quotaDepasse = false;

// Stockage corrompu : ignoré, rechargé.
reinitialiserCatalogue(); stockage.set(CLE_CATALOGUE_LOCAL, '{"version":1');
appels = [];
assert.equal((await chargerCatalogue(serverCall, 'GARDE')).total, seed.length);
assert.equal(appels[0].version, '');

// Échec serveur sans stockage : erreur remontée, pas de catalogue fantôme.
reinitialiserCatalogue(); stockage.clear();
await assert.rejects(chargerCatalogue(() => Promise.reject(new Error('Connexion perdue')), 'GARDE'), /Connexion perdue/);
assert.equal(catalogueEnMemoire(), null);
// … et un rechargement après échec est possible.
assert.equal((await chargerCatalogue(serverCall, 'GARDE')).total, seed.length);

console.log(`Catalogue local : droits, version, parité serveur sur ${requetes.length} requêtes, stockage, requête partagée et replis OK.`);
