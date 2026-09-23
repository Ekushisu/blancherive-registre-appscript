// Vérifie l'inventaire des coffres : droits, création des feuilles, coffres,
// quantités cumulées sans doublon, retrait à zéro, déplacement et robustesse.
//
//   node scripts/test-inventaire.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const seed = JSON.parse(readFileSync('src/CatalogueObjets.html', 'utf8'));
const sheets = new Map();
let reads = 0, writes = 0, seedReads = 0, held = false, failFlush = false, uuid = 0;

class Sheet {
  constructor(name, rows = []) { this.name = name; this.rows = rows; this.max = 1000; }
  getLastRow() {
    let i = this.rows.length;
    while (i && !this.rows[i - 1]?.some(v => v !== '' && v !== undefined && v !== null)) i--;
    return i;
  }
  getMaxRows() { return this.max; }
  insertRowsAfter(after, count) { this.max += count; }
  setFrozenRows() {}
  getRange(r, c, h = 1, w = 1) {
    const sheet = this;
    const range = {
      getValues() { reads++; return Array.from({ length: h }, (_, i) => Array.from({ length: w }, (_, j) => sheet.rows[r + i - 1]?.[c + j - 1] ?? '')); },
      getDisplayValues() { return this.getValues().map(row => row.map(v => String(v ?? ''))); },
      setValues(values) {
        writes++;
        values.forEach((row, i) => row.forEach((v, j) => { (sheet.rows[r + i - 1] ||= [])[c + j - 1] = v; }));
        return range;
      },
      setNumberFormat() { return range; }, setFontWeight() { return range; },
      setValue(v) { return this.setValues([[v]]); }
    };
    return range;
  }
}

const ss = {
  getSheetByName: name => sheets.get(name) || null,
  insertSheet(name) { assert.ok(!sheets.has(name), `${name} créée deux fois`); assert.ok(held, 'Création de feuille sous verrou'); const s = new Sheet(name); sheets.set(name, s); return s; }
};

const context = vm.createContext({
  Date, console, SPREADSHEET_ID: 'test',
  requireRole(token, roles) { if (!roles.includes(token)) throw Error('Accès refusé'); return { role: token }; },
  SpreadsheetApp: { openById() { reads++; return ss; }, flush() { if (failFlush) { failFlush = false; throw Error('Flush en échec'); } } },
  LockService: { getScriptLock: () => ({ waitLock() { assert.equal(held, false, 'Pas de verrou imbriqué'); held = true; }, releaseLock() { held = false; } }) },
  HtmlService: { createHtmlOutputFromFile(name) { assert.equal(name, 'CatalogueObjets'); seedReads++; return { getContent: () => JSON.stringify(seed) }; } },
  Utilities: { getUuid: () => `uuid-${++uuid}`, formatDate: date => date.toISOString() }
});
for (const f of ['Amendes.js', 'Objets.js', 'Inventaire.js']) vm.runInContext(readFileSync(`src/${f}`, 'utf8'), context);

const plain = x => JSON.parse(JSON.stringify(x));
const lire = role => plain(context.getInventaire(role));
const ajuster = (role, data) => plain(context.ajusterInventaire(role, data));
const OR = { id: 'skyrim.esm|00000F', nom: 'Or', libre: false };
const TORCHE = { id: 'skyrim.esm|01D4EC', nom: 'Torche', libre: false };


// ============================================================
// DROITS — refusés avant toute lecture Sheets
// ============================================================

for (const role of ['GARDE', 'VISITEUR', 'intrus']) {
  assert.throws(() => context.getInventaire(role), /Accès refusé/, `${role} ne lit pas l'inventaire`);
}
for (const role of ['GARDE', 'INTENDANT', 'intrus']) {
  assert.throws(() => context.ajouterCoffre(role, { nom: 'X' }), /Accès refusé/, `${role} ne crée pas de coffre`);
  assert.throws(() => context.modifierCoffre(role, { id: 'x', nom: 'X' }), /Accès refusé/);
  assert.throws(() => context.ajusterInventaire(role, { coffreId: 'x', objet: OR, delta: 1 }), /Accès refusé/, `${role} n'écrit pas l'inventaire`);
  assert.throws(() => context.deplacerInventaire(role, { coffreId: 'x', versCoffreId: 'y', objet: OR }), /Accès refusé/);
}
assert.equal(reads, 0, 'Le refus précède toute lecture Sheets');


// ============================================================
// FEUILLES — créées à la première consultation, jamais réécrites
// ============================================================

let inventaire = lire('INTENDANT');
assert.deepEqual(inventaire, { coffres: [], objets: [] });
assert.deepEqual(sheets.get('Coffres').rows[0], ['ID coffre', 'Nom', 'Position', 'Description']);
assert.deepEqual(sheets.get('Inventaire').rows[0], ['ID coffre', 'ID objet', 'Nom', 'Quantité']);
assert.equal(held, false, 'Verrou libéré après création');
assert.equal(seedReads, 0, 'La consultation ne charge pas le catalogue');

const coffresSheet = sheets.get('Coffres'), inventaireSheet = sheets.get('Inventaire');
coffresSheet.rows[0][1] = 'Libellé';
assert.throws(() => lire('OFFICIER'), /Coffres doit contenir les colonnes/, 'En-têtes différents : aucun remplacement');
assert.equal(coffresSheet.rows[0][1], 'Libellé', 'Aucune correction destructive');
coffresSheet.rows[0][1] = 'Nom';


// ============================================================
// COFFRES
// ============================================================

assert.throws(() => context.ajouterCoffre('OFFICIER', { nom: '   ' }), /nom du coffre est obligatoire/);
assert.throws(() => context.ajouterCoffre('OFFICIER', { nom: 'a'.repeat(101) }), /100 caractères/);
assert.throws(() => context.ajouterCoffre('OFFICIER', { nom: '=HYPERLINK()' }), /signe égal/);
assert.throws(() => context.ajouterCoffre('OFFICIER', { nom: 'Armurerie', position: 'p'.repeat(201) }), /200 caractères/);
assert.throws(() => context.ajouterCoffre('OFFICIER', { nom: 'Armurerie', description: 'd'.repeat(1001) }), /1000 caractères/);
assert.equal(coffresSheet.getLastRow(), 1, 'Rien écrit sur validation refusée');

inventaire = plain(context.ajouterCoffre('OFFICIER', { nom: '  Coffre de   l’armurerie ', position: 'Fort-Dragon, salle des gardes', description: 'Armes de service.' }));
assert.equal(inventaire.coffres.length, 1);
const armurerie = inventaire.coffres[0];
assert.equal(armurerie.id, 'uuid-1');
assert.equal(armurerie.nom, 'Coffre de l’armurerie', 'Espaces normalisés');
assert.deepEqual(coffresSheet.rows[1], ['uuid-1', 'Coffre de l’armurerie', 'Fort-Dragon, salle des gardes', 'Armes de service.']);
assert.throws(() => context.ajouterCoffre('OFFICIER', { nom: 'coffre de L’ARMURERIE' }), /existe déjà/, 'Nom unique sans distinction de casse');

inventaire = plain(context.ajouterCoffre('OFFICIER', { nom: 'Réserve des cuisines', position: 'Cellier' }));
const cuisines = inventaire.coffres.find(c => c.nom === 'Réserve des cuisines');
assert.equal(cuisines.id, 'uuid-2');
assert.deepEqual(inventaire.coffres.map(c => c.nom), ['Coffre de l’armurerie', 'Réserve des cuisines'], 'Coffres triés par nom');
assert.equal(held, false);

assert.throws(() => context.modifierCoffre('OFFICIER', { id: 'absent', nom: 'X' }), /n'existe plus/);
assert.throws(() => context.modifierCoffre('OFFICIER', { id: cuisines.id, nom: 'Coffre de l’armurerie' }), /existe déjà/);
inventaire = plain(context.modifierCoffre('OFFICIER', { id: cuisines.id, nom: 'Réserve des cuisines', position: 'Cellier, derrière les tonneaux', description: 'Vivres.' }));
assert.deepEqual(coffresSheet.rows[2], ['uuid-2', 'Réserve des cuisines', 'Cellier, derrière les tonneaux', 'Vivres.']);
assert.equal(inventaire.coffres.find(c => c.id === cuisines.id).position, 'Cellier, derrière les tonneaux');


// ============================================================
// OBJETS — validation
// ============================================================

for (const delta of [0, 1.5, '2', null, undefined, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  assert.throws(() => context.ajusterInventaire('OFFICIER', { coffreId: armurerie.id, objet: OR, delta }), /entier non nul/, `delta ${delta} refusé`);
}
assert.throws(() => context.ajusterInventaire('OFFICIER', { coffreId: '', objet: OR, delta: 1 }), /Sélectionnez un coffre/);
assert.throws(() => context.ajusterInventaire('OFFICIER', { coffreId: armurerie.id, delta: 1 }), /Sélectionnez un objet/);
assert.throws(() => context.ajusterInventaire('OFFICIER', { coffreId: armurerie.id, objet: { id: '', nom: '' }, delta: 1 }), /Identifiant d'objet invalide/);
assert.throws(() => context.ajusterInventaire('OFFICIER', { coffreId: armurerie.id, objet: { id: 'x', nom: 'Libre', libre: true }, delta: 1 }), /hors catalogue/);
assert.throws(() => context.ajusterInventaire('OFFICIER', { coffreId: armurerie.id, objet: { id: '', nom: '=1+1', libre: true }, delta: 1 }), /signe égal/);
assert.equal(seedReads, 0, 'Aucune lecture du catalogue sur validation refusée');
assert.throws(() => context.ajusterInventaire('OFFICIER', { coffreId: armurerie.id, objet: { id: 'inconnu', nom: 'Rien', libre: false }, delta: 1 }), /n'existe pas dans le catalogue/);
assert.equal(seedReads, 1, 'Le catalogue est créé à la première résolution');
assert.equal(held, false);
assert.throws(() => context.ajusterInventaire('OFFICIER', { coffreId: 'coffre-fantome', objet: OR, delta: 1 }), /coffre n'existe plus/);
assert.equal(inventaireSheet.getLastRow(), 1, 'Rien écrit');


// ============================================================
// OBJETS — cumul, décrément, zéro
// ============================================================

inventaire = ajuster('OFFICIER', { coffreId: armurerie.id, objet: { id: 'SKYRIM.ESM|00000f', nom: 'Faux nom', libre: false }, delta: 9000 });
assert.deepEqual(inventaire.objets, [{ cle: 'catalogue:skyrim.esm|00000f', coffreId: armurerie.id, coffreNom: 'Coffre de l’armurerie', id: 'skyrim.esm|00000F', nom: 'Or', libre: false, quantite: 9000 }],
  'Identité et nom pris dans le catalogue, pas dans la requête');
assert.deepEqual(inventaireSheet.rows[1], [armurerie.id, 'skyrim.esm|00000F', 'Or', 9000]);

const seedAvant = seedReads;
inventaire = ajuster('OFFICIER', { coffreId: armurerie.id, objet: OR, delta: 2 });
assert.equal(inventaire.objets.length, 1, 'Pas de ligne dupliquée');
assert.equal(inventaire.objets[0].quantite, 9002);
assert.equal(inventaireSheet.getLastRow(), 2);
assert.equal(seedReads, seedAvant, 'Un objet déjà en stock ne relit pas le catalogue');

inventaire = ajuster('OFFICIER', { coffreId: armurerie.id, objet: OR, delta: -2 });
assert.equal(inventaire.objets[0].quantite, 9000);
assert.throws(() => ajuster('OFFICIER', { coffreId: armurerie.id, objet: OR, delta: -9001 }), /ne contient que 9\s000 exemplaires de Or/);
assert.equal(inventaire.objets[0].quantite, 9000);
assert.throws(() => ajuster('OFFICIER', { coffreId: cuisines.id, objet: OR, delta: -1 }), /n'est pas dans ce coffre/);
assert.throws(() => ajuster('OFFICIER', { coffreId: armurerie.id, objet: OR, delta: Number.MAX_SAFE_INTEGER }), /trop élevée/);

// Même objet dans un second coffre : instantané réutilisé, ligne distincte.
inventaire = ajuster('OFFICIER', { coffreId: cuisines.id, objet: { id: 'skyrim.esm|00000f', nom: 'Peu importe', libre: false }, delta: 50 });
assert.equal(seedReads, seedAvant, 'Instantané d’un autre coffre réutilisé sans catalogue');
assert.equal(inventaire.objets.length, 2);
assert.equal(inventaire.objets.find(o => o.coffreId === cuisines.id).nom, 'Or');
assert.equal(inventaire.coffres.find(c => c.id === cuisines.id).total, 50);

// Objet hors catalogue : clé sur le nom, sans accent ni casse.
inventaire = ajuster('OFFICIER', { coffreId: cuisines.id, objet: { id: '', nom: '  Pain   d’Épeautre ', libre: true }, delta: 12 });
inventaire = ajuster('OFFICIER', { coffreId: cuisines.id, objet: { id: '', nom: 'pain d’epeautre', libre: true }, delta: 3 });
const pain = inventaire.objets.find(o => o.libre);
assert.equal(pain.nom, 'Pain d’Épeautre', 'Premier nom conservé');
assert.equal(pain.quantite, 15);
assert.equal(pain.cle, 'libre:pain d’epeautre');
assert.equal(inventaireSheet.rows.filter(r => r[0] === cuisines.id && r[1] === '').length, 1);

// Retour à zéro : la ligne disparaît, la feuille ne garde pas de ligne fantôme.
inventaire = ajuster('OFFICIER', { coffreId: cuisines.id, objet: { id: '', nom: 'PAIN D’EPEAUTRE', libre: true }, delta: -15 });
assert.equal(inventaire.objets.some(o => o.libre), false);
assert.equal(inventaireSheet.getLastRow(), 3, 'Bloc compacté après retrait');
assert.deepEqual(inventaireSheet.rows.slice(1, 3).map(r => r[3]), [9000, 50]);

// Tri : coffre puis nom.
inventaire = ajuster('OFFICIER', { coffreId: armurerie.id, objet: TORCHE, delta: 4 });
assert.deepEqual(inventaire.objets.map(o => `${o.coffreNom}/${o.nom}`), ['Coffre de l’armurerie/Or', 'Coffre de l’armurerie/Torche', 'Réserve des cuisines/Or']);
assert.deepEqual(inventaire.coffres.map(c => [c.nbObjets, c.total]), [[2, 9004], [1, 50]]);


// ============================================================
// DÉPLACEMENT
// ============================================================

assert.throws(() => context.deplacerInventaire('OFFICIER', { coffreId: armurerie.id, versCoffreId: armurerie.id, objet: OR }), /déjà dans ce coffre/);
assert.throws(() => context.deplacerInventaire('OFFICIER', { coffreId: armurerie.id, versCoffreId: 'nulle-part', objet: OR }), /destination n'existe plus/);
assert.throws(() => context.deplacerInventaire('OFFICIER', { coffreId: cuisines.id, versCoffreId: armurerie.id, objet: TORCHE }), /n'est plus dans le coffre d'origine/);

inventaire = plain(context.deplacerInventaire('OFFICIER', { coffreId: armurerie.id, versCoffreId: cuisines.id, objet: TORCHE }));
assert.equal(inventaire.objets.find(o => o.id === TORCHE.id).coffreId, cuisines.id, 'Pile déplacée telle quelle');
inventaire = plain(context.deplacerInventaire('OFFICIER', { coffreId: cuisines.id, versCoffreId: armurerie.id, objet: OR }));
const orArmurerie = inventaire.objets.filter(o => o.id === OR.id);
assert.equal(orArmurerie.length, 1, 'Fusion dans le coffre de destination');
assert.equal(orArmurerie[0].quantite, 9050);
assert.equal(inventaireSheet.getLastRow(), 3, 'Bloc compacté après fusion');
assert.equal(held, false);


// ============================================================
// ROBUSTESSE — échec d'écriture, feuille éditée à la main
// ============================================================

const avant = JSON.stringify(inventaireSheet.rows);
failFlush = true;
assert.throws(() => ajuster('OFFICIER', { coffreId: armurerie.id, objet: OR, delta: 1 }), /Flush/);
assert.equal(JSON.stringify(inventaireSheet.rows), avant, 'Valeurs restaurées après échec');
assert.equal(held, false, 'Verrou libéré après échec');

inventaireSheet.rows.push(['uuid-disparu', '', 'Vieille bannière', 1]);
inventaire = lire('INTENDANT');
const orphelin = inventaire.objets.find(o => o.nom === 'Vieille bannière');
assert.ok(orphelin, 'Une ligne sans coffre connu reste visible');
assert.equal(orphelin.coffreNom, '');
assert.equal(orphelin.libre, true);
// Le déplacement est le moyen de rattacher une ligne orpheline à un coffre réel.
const banniere = plain(context.deplacerInventaire('OFFICIER', { coffreId: 'uuid-disparu', versCoffreId: armurerie.id, objet: { id: '', nom: 'vieille banniere', libre: true } }))
  .objets.find(o => o.nom === 'Vieille bannière');
assert.equal(banniere.coffreId, armurerie.id, 'Ligne orpheline rattachée');
assert.equal(inventaireSheet.rows.some(r => r[0] === 'uuid-disparu'), false);
ajuster('OFFICIER', { coffreId: armurerie.id, objet: { id: '', nom: 'Vieille bannière', libre: true }, delta: -1 });
assert.equal(inventaireSheet.getLastRow(), 3);

// Les compactages ont laissé des lignes vides en fin de bloc : la ligne
// signalée est la ligne physique, celle que l'officier ouvrira dans Sheets.
const ligneInvalide = inventaireSheet.rows.length + 1;
inventaireSheet.rows.push([armurerie.id, '', 'Sans quantité', 0]);
assert.throws(() => lire('OFFICIER'), new RegExp(`Ligne ${ligneInvalide} de la feuille Inventaire invalide`));
inventaireSheet.rows.pop();
inventaireSheet.rows.push(['', '', '', '']);
assert.equal(lire('OFFICIER').objets.length, 2, 'Ligne vide ignorée');
inventaireSheet.rows.pop();

coffresSheet.rows.push(['uuid-1', 'Doublon', '', '']);
assert.throws(() => lire('OFFICIER'), /Identifiant de coffre en double/);
coffresSheet.rows.pop();



// ============================================================
// RANGEMENT GROUPÉ — une requête, une lecture du catalogue, une écriture
// ============================================================

for (const role of ['GARDE', 'INTENDANT', 'intrus']) {
  assert.throws(() => context.rangerInventaire(role, { coffreId: armurerie.id, objets: [{ ...OR, quantite: 1 }] }), /Accès refusé/);
}
assert.throws(() => context.rangerInventaire('OFFICIER', { coffreId: armurerie.id, objets: [] }), /au moins un objet/);
assert.throws(() => context.rangerInventaire('OFFICIER', { coffreId: armurerie.id }), /au moins un objet/);
assert.throws(() => context.rangerInventaire('OFFICIER', { coffreId: armurerie.id, objets: Array(101).fill({ ...OR, quantite: 1 }) }), /100 objets/);
for (const quantite of [0, -1, 1.5, '2', null, undefined, Number.MAX_SAFE_INTEGER + 1]) {
  assert.throws(() => context.rangerInventaire('OFFICIER', { coffreId: armurerie.id, objets: [{ ...OR, quantite }] }), /quantité entière strictement positive/, `quantité ${quantite} refusée`);
}
assert.throws(() => context.rangerInventaire('OFFICIER', { coffreId: '', objets: [{ ...OR, quantite: 1 }] }), /Sélectionnez un coffre/);
assert.throws(() => context.rangerInventaire('OFFICIER', { coffreId: armurerie.id, objets: [{ id: 'inconnu', nom: 'Rien', libre: false, quantite: 1 }] }), /n'existe pas dans le catalogue/);
assert.throws(() => context.rangerInventaire('OFFICIER', { coffreId: armurerie.id, objets: [{ ...OR, quantite: Number.MAX_SAFE_INTEGER }, { ...OR, quantite: 1 }] }), /trop élevée/);

const seedAvantLot = seedReads, writesAvantLot = writes;
const etatAvantLot = JSON.stringify(inventaireSheet.rows);
// Deux objets nouveaux au catalogue, un doublon dans la requête, un objet
// déjà en stock, un objet hors catalogue : une seule lecture du catalogue.
inventaire = plain(context.rangerInventaire('OFFICIER', { coffreId: cuisines.id, objets: [
  { id: 'skyrim.esm|013989', nom: 'Faux nom', libre: false, quantite: 2 },
  { id: 'SKYRIM.ESM|013989', nom: 'Faux nom', libre: false, quantite: 3 },
  { id: 'skyrim.esm|012EB6', nom: 'Faux nom', libre: false, quantite: 1 },
  { ...TORCHE, quantite: 6 },
  { id: '', nom: 'Fromage de chèvre', libre: true, quantite: 4 }
] }));
assert.equal(seedReads, seedAvantLot, 'Feuille Objets existante : aucun réimport');
const dansCuisines = inventaire.objets.filter(o => o.coffreId === cuisines.id);
assert.deepEqual(dansCuisines.map(o => [o.nom, o.quantite]).sort(), [
  ["Bouclier de fer", 1], ['Fromage de chèvre', 4], ["Torche", 10], ["Épée d'acier", 5]
].sort(), 'Doublon fusionné, stock existant cumulé, noms pris au catalogue');
assert.equal(writes - writesAvantLot, 1, 'Une seule écriture du bloc pour tout le lot');
assert.equal(held, false);

// Un lot invalide n'écrit rien, même si ses premiers objets sont valides.
// La restauration réécrit la plage lue, ligne vide de fin comprise : on compare le contenu, pas le remplissage.
const contenu = () => JSON.stringify(inventaireSheet.rows.filter(r => r.some(v => v !== '')));
const avantEchec = contenu();
assert.throws(() => context.rangerInventaire('OFFICIER', { coffreId: cuisines.id, objets: [{ ...OR, quantite: 1 }, { id: 'absent', nom: 'X', libre: false, quantite: 1 }] }), /n'existe pas dans le catalogue/);
assert.equal(contenu(), avantEchec, 'Rien écrit sur un lot refusé');
failFlush = true;
assert.throws(() => context.rangerInventaire('OFFICIER', { coffreId: cuisines.id, objets: [{ ...OR, quantite: 1 }] }), /Flush/);
assert.equal(contenu(), avantEchec, 'Valeurs restaurées après échec du lot');
assert.equal(held, false);
void etatAvantLot;

console.log('Inventaire : droits, feuilles, coffres, cumul sans doublon, retrait à zéro, déplacement, rangement groupé, rollback et lignes orphelines OK.');
