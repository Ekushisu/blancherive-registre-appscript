// Vérifie le regroupement de la page Paye : rattachement d'un corps à son
// financeur, périmètre de la demande, agrégation par garde, et droits.
//
//   node scripts/test-paye.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Semaine 37 de 2026 : lundi 7 septembre. Les lignes sont écrites avec
// leur numéro de semaine pour rester lisibles, mais Présences!A porte le
// lundi ISO, et c'est lui que le serveur manipule.
const LUNDI_COURANT = '2026-09-07';
const L = { 34: '2026-08-17', 35: '2026-08-24', 36: '2026-08-31', 37: '2026-09-07', 38: '2026-09-14' };

let lectures = 0;
let ecritures = [];
let lignes = [];

// A Semaine, B Corps, C Grade, D Prénom, E Nom, F:L jours, M jours, N solde, O payé
const ligne = (semaine, corps, grade, prenom, nom, jours, solde, paye) =>
  [L[semaine], corps, grade, prenom, nom, ...Array(7).fill(false), jours, solde, paye];

const feuille = {
  // Lecture par bloc : le registre entier pour getPaye, l'en-tête A:E d'une
  // ligne pour le contrôle d'identité de `ecrirePresenceCellule_`.
  getRange: (row, column, height = lignes.length, width = 15) => {
    const bloc = () => lignes.slice(row - 2, row - 2 + height).map(l => l.slice(column - 1, column - 1 + width));
    return {
      getValues: bloc,
      getDisplayValues: () => bloc().map(l => l.map(v => (v === null ? '' : String(v)))),
      setValue: valeur => ecritures.push({ row, column, valeur })
    };
  }
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
  },
  LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) }
});

vm.runInContext(readFileSync('src/Presences.js', 'utf8'), context);
vm.runInContext(readFileSync('src/Paye.js', 'utf8'), context);

// Couverts par leurs propres suites : barème (test-soldes-grades) et
// bornes de semaine ISO (test-presence-finances).
context.mettreAJourSoldesPresences_ = () => {};
context.getLastPresenceRowWebApp = () => lignes.length + 1;
context.lundiCourantPresence_ = () => LUNDI_COURANT;
context.estCorpsExcluDesPresences_ = corps => String(corps).toLowerCase().includes('hird');
// Lecture de la feuille Données couverte par test-alias-grades ; seule la
// transmission de la table au navigateur est vérifiée ici.
const ALIAS_GRADES = { Inquisition: { Garde: 'Inquisiteur' } };
context.lireAliasGrades_ = () => ALIAS_GRADES;

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
const alice36 = { lundi: L[36], prenom: 'Alice', nom: 'Une' };
assert.throws(() => context.reglerSemainePaye('INTENDANT', 2, true, alice36), /Accès refusé/);
assert.throws(() => context.reglerSemainePaye('GARDE', 2, true, alice36), /Accès refusé/);
assert.equal(ecritures.length, 0, 'Aucune écriture sans le rôle OFFICIER');

// L'identité de la ligne affichée est vérifiée : un numéro de ligne périmé
// après un tri des Présences ne doit jamais cocher un autre garde.
assert.throws(() => context.reglerSemainePaye('OFFICIER', 2, true), /Identité de la ligne manquante/);
assert.throws(() => context.reglerSemainePaye('OFFICIER', 2, true, { lundi: L[35], prenom: 'Alice', nom: 'Une' }), /a changé/);
assert.throws(() => context.reglerSemainePaye('OFFICIER', 2, true, { lundi: L[36], prenom: 'Bob', nom: 'Deux' }), /a changé/);
assert.equal(ecritures.length, 0, 'Aucune écriture sur une identité qui ne correspond plus');

context.reglerSemainePaye('OFFICIER', 2, true, alice36);
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
  ligne(36, 'Inquisition', 'Garde', 'Ragnhild', 'Fer-Juste', 3, 240, false),
  ligne(36, 'Hird du Jarl', 'Garde', 'Hirdman', '', 7, 999, false)
];

let paye = lirePaye('OFFICIER');

assert.equal(
  financeur(paye, 'argentier').total,
  1880,
  'Cité, Éclaireur, État-Major, Faubourgs et Inquisition relèvent du même argentier'
);
assert.equal(financeur(paye, 'argentier').nbGardes, 5);
assert.deepEqual(
  financeur(paye, 'argentier').corps,
  ['Cité de Blancherive', 'Éclaireur', 'État-Major', 'Faubourgs de Blancherive', 'Inquisition']
);
assert.equal(financeur(paye, 'thane-rivebois').total, 400, '« Garnison de Rivebois » est reconnu');
assert.equal(financeur(paye, 'thane-bois-de-chene').total, 240);
assert.equal(financeur(paye, 'thane-faubourgs'), undefined, 'Les Faubourgs n’ont plus de Thane payeur');
assert.equal(financeur(paye, 'thane-cap-granite').total, 160);
assert.equal(financeur(paye, 'a-determiner'), undefined, 'Aucun corps non classé ici');
assert.equal(paye.totalADemander, 2680, 'Le Hird est exclu de la demande');
assert.equal(paye.nbGardesDus, 8);

// La table des alias accompagne la Paye ; le grade de la ligne reste le
// grade régulier, l'alias n'étant appliqué qu'à l'affichage.
assert.deepEqual(paye.aliasGrades, ALIAS_GRADES);
const ragnhild = financeur(paye, 'argentier').groupes
  .find(g => g.corps === 'Inquisition').gardes[0];
assert.equal(ragnhild.grade, 'Garde');
assert.equal(ragnhild.corps, 'Inquisition', 'Le corps du garde sert à choisir l’alias');

// Le libellé de la feuille est « Inquisition » ; le nom affiché par
// l'application, s'il y était écrit un jour, reste reconnu.
lignes = [ligne(36, 'Garde inquisitoriale', 'Garde', 'Ragnhild', 'Fer-Juste', 3, 240, false)];
assert.equal(financeur(lirePaye('OFFICIER'), 'argentier').total, 240);


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
assert.deepEqual(rivebois.semaines, [L[35], L[36]], 'Semaines dues, triées, en lundis ISO');
assert.equal(rivebois.semainePlusAncienne, L[35]);
assert.equal(rivebois.retardMax, 2);
assert.equal(paye.lundiCourant, LUNDI_COURANT);


// ============================================================
// AGRÉGATION PAR GARDE
// ============================================================

const alice = rivebois.groupes[0].gardes[0];
assert.equal(alice.nomComplet, 'Alice Une');
assert.equal(alice.total, 640, 'Les semaines d’un même garde sont cumulées');
assert.deepEqual(alice.semaines.map(s => s.lundi), [L[35], L[36]], 'De la plus ancienne à la plus récente');
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
// PASSAGE D'ANNÉE
//
// Le lundi ISO porte l'année : la semaine 52 de 2025 reste due
// en semaine 2 de 2026, avec un retard de deux semaines. Avec
// un simple numéro de semaine, 52 > 2 la faisait passer pour
// une semaine à venir.
// ============================================================

context.lundiCourantPresence_ = () => '2026-01-05';
lignes = [
  ['2025-12-22', 'Rivebois', 'Garde', 'Alice', 'Une', ...Array(7).fill(false), 5, 400, false],
  ['2025-12-29', 'Rivebois', 'Garde', 'Alice', 'Une', ...Array(7).fill(false), 3, 240, false],
  ['2026-01-05', 'Rivebois', 'Garde', 'Alice', 'Une', ...Array(7).fill(false), 2, 160, false]
];
paye = lirePaye('OFFICIER');
assert.equal(paye.totalADemander, 640, 'Les semaines de l\'année écoulée restent dues');
assert.equal(paye.totalAPrevoir, 160);
assert.deepEqual(
  financeur(paye, 'thane-rivebois').groupes[0].gardes[0].semaines.map(s => s.retard),
  [2, 1]
);
assert.equal(financeur(paye, 'thane-rivebois').retardMax, 2);
context.lundiCourantPresence_ = () => LUNDI_COURANT;


// ============================================================
// REGISTRE VIDE
// ============================================================

lignes = [];
paye = lirePaye('OFFICIER');
assert.equal(paye.totalADemander, 0);
assert.equal(paye.totalAPrevoir, 0);
assert.deepEqual(paye.financeurs, []);

console.log('test-paye : toutes les vérifications réussies.');
