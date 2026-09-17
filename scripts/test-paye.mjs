// Vérifie le regroupement de la page Paye : rattachement d'un corps à son
// financeur, périmètre de la demande, agrégation par garde, et droits.
//
//   node scripts/test-paye.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SEMAINE_COURANTE = 37;

let lectures = 0;
let ecritures = [];
let lignes = [];

// A Semaine, B Corps, C Grade, D Prénom, E Nom, F:L jours, M jours, N solde, O payé
const ligne = (semaine, corps, grade, prenom, nom, jours, solde, paye) =>
  [semaine, corps, grade, prenom, nom, ...Array(7).fill(false), jours, solde, paye];

const feuille = {
  getRange: (row, column) => ({
    getValues: () => lignes,
    getDisplayValues: () => lignes.map(l => l.map(v => (v === null ? '' : String(v)))),
    // Contrôle de `ecrirePresenceCellule_` : la ligne doit porter une semaine.
    getValue: () => (lignes[row - 2] ? lignes[row - 2][column - 1] : ''),
    setValue: valeur => ecritures.push({ row, column, valeur })
  })
};

const context = vm.createContext({
  Date,
  Number,
  String,
  Math,
  Map,
  Set,
  Array,
  JSON,
  SPREADSHEET_ID: 'test',
  PRESENCES_SHEET_NAME: 'Présences',
  requireRole(token, roles) {
    if (!roles.includes(token)) throw new Error('Accès refusé');
    return { role: token };
  },
  SpreadsheetApp: {
    flush() {},
    openById() {
      lectures++;
      return { getSheetByName: () => feuille };
    }
  }
});

vm.runInContext(readFileSync('src/Presences.js', 'utf8'), context);
vm.runInContext(readFileSync('src/Paye.js', 'utf8'), context);

// Couverts par leurs propres suites : barème (test-soldes-grades) et
// bornes de semaine ISO (test-presence-finances).
context.mettreAJourSoldesPresences_ = () => {};
context.getLastPresenceRowWebApp = () => lignes.length + 1;
context.getCurrentIsoWeekWebApp = () => SEMAINE_COURANTE;
context.estCorpsExcluDesPresences_ = corps => String(corps).toLowerCase().includes('hird');

// Les valeurs naissent dans le contexte vm : un aller-retour JSON leur rend
// les prototypes de cette réalité, sans quoi deepStrictEqual échoue.
const lirePaye = role => JSON.parse(JSON.stringify(context.getPaye(role)));
const financeur = (resultat, cle) => resultat.financeurs.find(f => f.cle === cle);


// ============================================================
// DROITS
// ============================================================

assert.throws(() => context.getPaye('GARDE'), /Accès refusé/);
assert.throws(() => context.getPaye('inconnu'), /Accès refusé/);
assert.equal(lectures, 0, 'Le refus doit précéder toute lecture Sheets');

lignes = [];
assert.ok(lirePaye('OFFICIER'), 'OFFICIER lit la paye');
assert.ok(context.getPaye('INTENDANT'), 'INTENDANT lit la paye');

// L'INTENDANT ne règle rien : le refus vient de ecrirePresenceCellule_,
// partagé avec la page Présences, donc indépendant de l'interface.
lignes = [ligne(36, 'Rivebois', 'Garde', 'Alice', 'Une', 5, 400, false)];
ecritures = [];
assert.throws(() => context.reglerSemainePaye('INTENDANT', 2, true), /Accès refusé/);
assert.throws(() => context.reglerSemainePaye('GARDE', 2, true), /Accès refusé/);
assert.equal(ecritures.length, 0, 'Aucune écriture sans le rôle OFFICIER');

context.reglerSemainePaye('OFFICIER', 2, true);
assert.deepEqual(
  ecritures.map(e => [e.row, e.column, e.valeur]),
  [[2, 15, true]],
  'Le règlement coche la colonne O de la ligne visée'
);


// ============================================================
// RATTACHEMENT D'UN CORPS À SON FINANCEUR
// ============================================================

lignes = [
  ligne(36, 'Cité de Blancherive', 'Garde', 'Ingrid', 'Main-Leste', 5, 400, false),
  ligne(36, 'Éclaireur', 'Garde', 'Runa', 'Chante-Lame', 4, 320, false),
  ligne(36, 'État-Major', 'Major', 'Vigdis', 'la Droite', 6, 600, false),
  ligne(36, 'Garnison de Rivebois', 'Garde', 'Torvald', 'Hache-Vive', 5, 400, false),
  ligne(36, 'Bois-de-Chêne', 'Garde', 'Kjell', 'Bras-Long', 3, 240, false),
  ligne(36, 'Faubourgs de Blancherive', 'Garde', 'Sif', 'Pied-Sûr', 4, 320, false),
  ligne(36, 'Cap Granite', 'Garde', 'Ulf', 'Œil-Clair', 2, 160, false),
  ligne(36, 'Hird du Jarl', 'Garde', 'Hirdman', '', 7, 999, false)
];

let paye = lirePaye('OFFICIER');

assert.equal(
  financeur(paye, 'argentier').total,
  1320,
  'Cité, Éclaireur et État-Major relèvent du même argentier'
);
assert.equal(financeur(paye, 'argentier').nbGardes, 3);
assert.equal(financeur(paye, 'thane-rivebois').total, 400, '« Garnison de Rivebois » est reconnu');
assert.equal(financeur(paye, 'thane-bois-de-chene').total, 240);
assert.equal(financeur(paye, 'thane-faubourgs').total, 320);
assert.equal(financeur(paye, 'thane-cap-granite').total, 160);
assert.equal(financeur(paye, 'a-determiner'), undefined, 'Aucun corps non classé ici');
assert.equal(paye.totalADemander, 2440, 'Le Hird est exclu de la demande');
assert.equal(paye.nbGardesDus, 7);

// Les Faubourgs portent « Blancherive » comme la Cité : les deux doivent
// rester distincts, sans quoi la demande partirait au mauvais financeur.
assert.equal(
  financeur(paye, 'argentier').corps.includes('Faubourgs de Blancherive'),
  false
);


// ============================================================
// CORPS INCONNU : VISIBLE, JAMAIS PERDU
// ============================================================

lignes = [
  ligne(36, 'Rivebois', 'Garde', 'Torvald', 'Hache-Vive', 5, 400, false),
  ligne(36, 'Compagnie franche', 'Garde', 'Erik', 'le Muet', 4, 320, false)
];

paye = lirePaye('OFFICIER');

assert.equal(financeur(paye, 'a-determiner').total, 320);
assert.equal(paye.totalADemander, 720, 'Un corps non classé reste compté au total');
assert.equal(
  paye.financeurs[0].cle,
  'a-determiner',
  'Une anomalie de libellé passe en tête, avant les financeurs connus'
);


// ============================================================
// PÉRIMÈTRE DE LA DEMANDE
// ============================================================

lignes = [
  ligne(35, 'Rivebois', 'Garde', 'Alice', 'Une', 3, 240, false),   // dû
  ligne(36, 'Rivebois', 'Garde', 'Alice', 'Une', 5, 400, false),   // dû
  ligne(34, 'Rivebois', 'Garde', 'Bob', 'Deux', 4, 320, true),     // déjà réglé
  ligne(36, 'Rivebois', 'Recrue', 'Carl', 'Trois', 2, 0, false),   // solde nulle
  ligne(37, 'Rivebois', 'Garde', 'Dina', 'Quatre', 4, 320, false), // semaine en cours
  ligne(38, 'Rivebois', 'Garde', 'Erik', 'Cinq', 4, 320, false)    // semaine à venir
];

paye = lirePaye('OFFICIER');

assert.equal(paye.totalADemander, 640, 'Seules les semaines closes et non réglées');
assert.equal(paye.nbGardesDus, 1, 'Un seul garde à payer');
assert.equal(paye.totalAPrevoir, 320, 'La semaine en cours est chiffrée à part');

const rivebois = financeur(paye, 'thane-rivebois');
assert.equal(rivebois.previsionTotal, 320);
assert.equal(rivebois.previsionGardes, 1);
assert.deepEqual(rivebois.semaines, [35, 36], 'Semaines dues, triées');
assert.equal(rivebois.semainePlusAncienne, 35);
assert.equal(rivebois.retardMax, 2);


// ============================================================
// AGRÉGATION PAR GARDE
// ============================================================

const alice = rivebois.groupes[0].gardes[0];
assert.equal(alice.nomComplet, 'Alice Une');
assert.equal(alice.total, 640, 'Les semaines d’un même garde sont cumulées');
assert.deepEqual(alice.semaines.map(s => s.semaine), [35, 36], 'De la plus ancienne à la plus récente');
assert.deepEqual(alice.semaines.map(s => s.retard), [2, 1]);
assert.deepEqual(alice.semaines.map(s => s.row), [2, 3], 'La ligne Sheets permet de cocher');
assert.equal(alice.semaines[1].joursPresents, 5);

// Le grade retenu est celui de la semaine la plus récente.
lignes = [
  ligne(36, 'Rivebois', 'Garde', 'Alice', 'Une', 5, 400, false),
  ligne(35, 'Rivebois', 'Aspirant-Garde', 'Alice', 'Une', 3, 240, false)
];
paye = lirePaye('OFFICIER');
assert.equal(financeur(paye, 'thane-rivebois').groupes[0].gardes[0].grade, 'Garde');


// ============================================================
// ORDRE D'AFFICHAGE
// ============================================================

lignes = [
  ligne(36, 'Rivebois', 'Garde', 'Alice', 'Une', 5, 400, false),
  ligne(36, 'Cap Granite', 'Garde', 'Ulf', 'Œil-Clair', 7, 900, false),
  ligne(36, 'Cité de Blancherive', 'Garde', 'Ingrid', 'Main-Leste', 5, 400, true),
  ligne(37, 'Cité de Blancherive', 'Garde', 'Ingrid', 'Main-Leste', 5, 400, false)
];

paye = lirePaye('OFFICIER');

assert.deepEqual(
  paye.financeurs.map(f => f.cle),
  ['thane-cap-granite', 'thane-rivebois', 'argentier'],
  'Du montant le plus élevé au plus faible, les financeurs à jour en dernier'
);
assert.equal(
  financeur(paye, 'argentier').total,
  0,
  'Un financeur à jour reste affiché, à zéro'
);
assert.equal(
  financeur(paye, 'argentier').previsionTotal,
  400,
  'Sa semaine en cours reste chiffrée'
);

// Les dettes les plus lourdes en premier à l'intérieur d'un corps.
lignes = [
  ligne(36, 'Rivebois', 'Garde', 'Petit', 'Montant', 2, 160, false),
  ligne(36, 'Rivebois', 'Garde', 'Gros', 'Montant', 7, 560, false)
];
paye = lirePaye('OFFICIER');
assert.deepEqual(
  financeur(paye, 'thane-rivebois').groupes[0].gardes.map(g => g.nomComplet),
  ['Gros Montant', 'Petit Montant']
);


// ============================================================
// REGISTRE VIDE
// ============================================================

lignes = [];
paye = lirePaye('OFFICIER');
assert.equal(paye.totalADemander, 0);
assert.equal(paye.totalAPrevoir, 0);
assert.deepEqual(paye.financeurs, []);

console.log('test-paye : toutes les vérifications réussies.');
