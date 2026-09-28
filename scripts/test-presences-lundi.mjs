// Présences!A porte le lundi ISO de la semaine. Cette suite vérifie :
// la conversion des anciennes valeurs (numéro de semaine, cellule au format
// date, texte), la régénération avec fusion des doublons, le contrôle
// d'identité d'un pointage, l'inventaire des formules et la migration.
//
//   node scripts/test-presences-lundi.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {
  semaineIso, numeroSemaine, libelleSemaine, dateLundi, titreSemaine,
  retardSemaines, comparerLundisDecroissant
} from '../ui/src/semaine.js';

// Semaine courante : semaine 39 de 2026, lundi 21 septembre.
const L39 = '2026-09-21';
const L38 = '2026-09-14';
const LUNDI_COURANT = L39;

// Sheets renvoie une Date locale pour une cellule au format date. Le
// numéro de série 39 (un ancien numéro de semaine) s'affiche « 7 février 1900 ».
const dateSerie39 = new Date(1900, 1, 7);
const serie = iso => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.UTC(1899, 11, 30)) / 86400000);

class Sheet {
  constructor(name, rows) { this.name = name; this.rows = rows; this.capacity = 20; this.formats = new Map(); this.writes = []; this.regles = null; this.bordures = []; }
  setConditionalFormatRules(regles) { this.regles = regles; }
  getName() { return this.name; }
  getParent() { return ss; }
  getLastRow() {
    let i = this.rows.length;
    while (i && !this.rows[i - 1].some(v => v !== '' && v !== undefined)) i--;
    return i;
  }
  getLastColumn() { return Math.max(0, ...this.rows.map(r => r.length)); }
  getMaxRows() { return this.capacity; }
  insertRowsAfter(_, count) { this.capacity += count; }
  setFrozenRows() {}
  setColumnWidth() {}
  getRange(row, col, height = 1, width = 1) {
    const cells = () => Array.from({ length: height }, (_, i) =>
      Array.from({ length: width }, (_, j) => this.rows[row - 1 + i]?.[col - 1 + j] ?? ''));
    const range = {
      getA1Notation: () => `${String.fromCharCode(64 + col)}${row}`,
      getValues: () => cells(),
      getDisplayValues: () => cells().map(r => r.map(v => (v instanceof Date ? '07/02/1900' : String(v)))),
      getValue: () => cells()[0][0],
      getFormulas: () => cells().map(r => r.map(v => (typeof v === 'string' && v.startsWith('=') ? v : ''))),
      getFormulasR1C1: () => range.getFormulas(),
      setValues: values => {
        assert.equal(values.length, height);
        this.writes.push({ row, col, height, width, values });
        values.forEach((r, i) => { this.rows[row - 1 + i] ||= []; r.forEach((v, j) => { this.rows[row - 1 + i][col - 1 + j] = v; }); });
        return range;
      },
      setValue: value => range.setValues([[value]]),
      setFormulas: values => range.setValues(values),
      setFormulasR1C1: values => range.setValues(values),
      clearContent: () => range.setValues(Array.from({ length: height }, () => Array(width).fill(''))),
      clearDataValidations: () => range, setDataValidation: () => range,
      setFontWeight: () => range, setHorizontalAlignment: () => range,
      setNumberFormat: format => {
        for (let i = 0; i < height; i++) for (let j = 0; j < width; j++) this.formats.set(`${row + i}:${col + j}`, format);
        return range;
      },
      setBorder: (...args) => { this.bordures.push({ row, height, width, args }); return range; },
      setBackground: () => range,
      insertCheckboxes: () => { throw Error('Ne pas effacer les valeurs des cases existantes'); }
    };
    return range;
  }
}
// Constructeur de règle conditionnelle : on retient formule, couleur et plage.
const regleFactice = () => {
  const regle = {};
  const r = {
    whenFormulaSatisfied: f => { regle.formule = f; return r; },
    setBackground: c => { regle.couleur = c; return r; },
    setRanges: ranges => { regle.plages = ranges.length; return r; },
    build: () => regle
  };
  return r;
};

const ligne = (semaine, corps, prenom, jours, paye = false) =>
  [semaine, corps, 'Garde', prenom, '', ...jours, '', '', paye];

const entete = () => ['Semaine', 'Corps de garde', 'Grade', 'Prénom', 'Nom', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim', 'Jours présents', 'Solde', 'Payé'];

let presence = new Sheet('Présences', [
  entete(),
  // Semaine courante en ancien numéro, corrompu au format date.
  ligne(dateSerie39, 'Cité', 'Corrompu', [true, true, false, false, false, false, false], true),
  // Doublon créé par une régénération précédente, en numéro de semaine.
  ligne(39, 'Cité', 'Corrompu', [false, false, true, false, false, false, false]),
  // Déjà migré en lundi ISO.
  ligne(L39, 'Cité', 'Sain', [true, false, false, false, false, false, false]),
  // Semaine passée en ancien numéro : convertie, jamais perdue.
  ligne(38, 'Cité', 'Ancien', [true, true, true, true, true, false, false], true),
  // Valeur non reconnue : conservée telle quelle, en tête.
  ligne('S37', 'Cité', 'Étrange', Array(7).fill(false)),
  // Sorti du service actif en cours de semaine, un jour pointé : conservé.
  ligne(L39, 'Cité', 'Parti', [false, false, false, true, false, false, false]),
  // Sorti sans rien pointé ni payé : la ligne ne portait rien, elle disparaît.
  ligne(L39, 'Cité', 'Fantome', Array(7).fill(false))
]);
presence.rows[1][15] = 'Colonne technique préservée';

const sheets = new Map([['Présences', presence], ['Effectifs', new Sheet('Effectifs', [])]]);
const ss = { getSheetByName: name => sheets.get(name), getSheets: () => [...sheets.values()] };
const logs = [];
let verrousDocument = 0;
const context = vm.createContext({
  console, Date, Object, Number, Math, String, Map, Set, Array, JSON, RegExp,
  SPREADSHEET_ID: 'test',
  PRESENCES_SHEET_NAME: 'Présences',
  SpreadsheetApp: {
    openById: () => ss, flush() {},
    newDataValidation: () => ({ requireCheckbox: () => ({ build: () => ({}) }) }),
    newConditionalFormatRule: regleFactice,
    BorderStyle: { SOLID_MEDIUM: 'SOLID_MEDIUM', DASHED: 'DASHED' }
  },
  LockService: {
    getDocumentLock: () => ({ waitLock() { verrousDocument++; }, releaseLock() {} }),
    getScriptLock: () => ({ waitLock() {}, releaseLock() {} })
  },
  Logger: { log: message => logs.push(message) },
  Utilities: { formatDate: () => { throw new Error('lundiCourantPresence_ doit être simulé'); } },
  requireRole: (token, roles) => { if (!roles.includes(token)) throw new Error('Accès refusé'); return { role: token }; }
});
vm.runInContext(readFileSync('src/Presences.js', 'utf8'), context);
context.lundiCourantPresence_ = () => LUNDI_COURANT;
context.mettreAJourSoldesPresences_ = () => {};
context.ecrireFormulesSoldeParBlocs_ = () => {};

// --- Calendrier ISO ---------------------------------------------------------

assert.equal(context.lundiDeDateIso_('2026-09-28'), '2026-09-28', 'Un lundi reste lui-même');
assert.equal(context.lundiDeDateIso_('2026-10-04'), '2026-09-28', 'Le dimanche appartient à la semaine du lundi précédent');
assert.equal(context.lundiDeDateIso_('2026-02-30'), '', 'Date civile invalide refusée');
// Les objets naissent dans le contexte vm : un aller-retour JSON leur rend
// les prototypes de cette réalité, sans quoi deepStrictEqual échoue.
const plain = value => JSON.parse(JSON.stringify(value));
assert.deepEqual(plain(context.numeroSemaineIsoPresence_('2026-09-28')), { annee: 2026, semaine: 40 });
assert.deepEqual(plain(context.numeroSemaineIsoPresence_('2024-12-30')), { annee: 2025, semaine: 1 }, 'Fin décembre en semaine 1 de l\'année suivante');
assert.deepEqual(plain(context.numeroSemaineIsoPresence_('2027-01-04')), { annee: 2027, semaine: 1 });
assert.deepEqual(plain(context.numeroSemaineIsoPresence_('2020-12-28')), { annee: 2020, semaine: 53 }, 'Année à 53 semaines');
assert.equal(context.lundiDepuisNumeroSemaine_(39, LUNDI_COURANT), L39);
assert.equal(context.lundiDepuisNumeroSemaine_(40, LUNDI_COURANT), '2025-09-29', 'Semaine 40 vue depuis la 39 : année précédente');
assert.equal(context.lundiDepuisNumeroSemaine_(52, '2026-01-05'), '2025-12-22', 'Une semaine supérieure à la courante vient de l\'année précédente');
assert.equal(context.lundiDepuisNumeroSemaine_(1, '2026-01-05'), '2025-12-29', 'Semaine 1 de 2026 : lundi 29 décembre 2025');
assert.equal(context.ecartSemainesPresence_(L38, LUNDI_COURANT), 1);
assert.equal(context.ecartSemainesPresence_(L39, LUNDI_COURANT), 0);
assert.equal(context.ecartSemainesPresence_('2025-12-22', '2026-01-05'), 2);
assert.equal(context.getCurrentIsoWeekWebApp(), 39, 'Ancien nom conservé, calculé depuis le lundi');

// --- Normalisation des anciennes valeurs -----------------------------------

const norm = value => context.normaliserLundiPresence_(value, LUNDI_COURANT);
assert.equal(norm(dateSerie39), L39, 'Numéro 39 affiché en date de 1900 → lundi de la semaine 39');
assert.equal(norm(39), L39, 'Ancien numéro de semaine');
assert.equal(norm(' 39 '), L39, 'Texte numérique');
assert.equal(norm(L39), L39, 'Lundi ISO inchangé');
assert.equal(norm('2026-09-23'), L39, 'Un autre jour est recalé sur son lundi');
assert.equal(norm(new Date(2026, 8, 30)), '2026-09-28', 'Vraie cellule date → lundi de sa semaine');
assert.equal(norm(serie('2026-09-28')), '2026-09-28', 'Numéro de série d\'une date');
assert.equal(norm(''), '');
assert.equal(norm(null), '');
assert.equal(norm(undefined), '');
assert.equal(norm(new Date(NaN)), '', 'Date invalide traitée comme vide');
assert.equal(norm('S39'), 'S39', 'Texte non reconnu conservé, jamais perdu');
assert.equal(norm(0), '0', 'Zéro n\'est pas une semaine : conservé en texte');
assert.equal(norm(54), '54');
assert.equal(context.estLundiPresence_(L39), true);
assert.equal(context.estLundiPresence_('S39'), false);
assert.equal(context.estLundiPresence_(39), false);
assert.deepEqual(['S39', L39, '', L38].sort(context.comparerLundisPresence_), ['', 'S39', L38, L39], 'Valeurs non reconnues en tête, puis chronologique');

// --- Lecture : tout revient en lundi ISO -----------------------------------

const lecture = context.getPresences('GARDE');
assert.equal(lecture.lundiCourant, LUNDI_COURANT);
assert.deepEqual([...lecture.rows].map(r => r.lundi), [L39, L39, L39, L38, 'S37', L39, L39]);
assert.deepEqual([...lecture.rows].map(r => r.row), [2, 3, 4, 5, 6, 7, 8], 'Numéros de ligne Sheets');
const totaux = JSON.parse(JSON.stringify(context.getPresences('OFFICIER').corpsTotals));
assert.deepEqual(totaux.map(t => t.lundi), [L39, L38, 'S37'], 'Totaux par lundi et corps');

// --- Régénération : conversion, fusion, format texte -----------------------

context.lireEffectifsActifsPourPresences = () => [
  { prenom: 'Corrompu', nom: '', grade: 'Garde', corps: 'Cité' },
  { prenom: 'Sain', nom: '', grade: 'Garde', corps: 'Cité' },
  { prenom: 'Nouveau', nom: '', grade: 'Garde', corps: 'Rivebois' }
];
context.genererPresencesSemaineCourante();

const parNom = nom => presence.rows.find(r => r[3] === nom);
const colonneA = presence.rows.slice(1).filter(r => r[0] !== '').map(r => r[0]);
assert.ok(colonneA.every(v => typeof v === 'string'), `Aucune Date ni nombre réécrit en colonne A : ${colonneA}`);
assert.deepEqual(colonneA, ['S37', L38, L39, L39, L39, L39], 'Valeur inconnue en tête, puis semaine passée, puis semaine courante');
assert.deepEqual(parNom('Parti').slice(5, 12), [false, false, false, true, false, false, false], 'Sorti du service actif : sa ligne pointée est conservée');
assert.equal(parNom('Fantome'), undefined, 'Sorti sans pointage : ligne retirée');
assert.deepEqual(presence.rows.slice(1).filter(r => r[0] === L39).map(r => r[3]), ['Corrompu', 'Parti', 'Sain', 'Nouveau'], 'Semaine courante : corps puis nom');
assert.equal(presence.rows[0][0], 'Lundi', 'En-tête renommé');

assert.deepEqual(parNom('Corrompu').slice(5, 12), [true, true, true, false, false, false, false],
  'Les pointages de la ligne corrompue et de son doublon sont fusionnés');
assert.equal(parNom('Corrompu')[14], true, 'Paiement conservé');
assert.equal(presence.rows.slice(1).filter(r => r[3] === 'Corrompu').length, 1, 'Un seul exemplaire après fusion');
assert.deepEqual(parNom('Sain').slice(5, 12), [true, false, false, false, false, false, false]);
assert.deepEqual(parNom('Nouveau').slice(5, 12), Array(7).fill(false));
assert.deepEqual(parNom('Ancien').slice(5, 12), [true, true, true, true, true, false, false], 'Historique intact');
assert.equal(parNom('Ancien')[0], L38, 'Semaine passée convertie en lundi');
assert.equal(parNom('Étrange')[0], 'S37', 'Ligne non reconnue conservée');

// --- Couleurs et séparateurs posés par la génération -----------------------

assert.equal(presence.regles.length, 3, 'Trois règles : semaine courante, impayé dû, semaine passée');
assert.ok(presence.regles.every(r => r.plages === 1 && /^=/.test(r.formule) && !/;/.test(r.formule)), 'Formules en anglais, virgules, une plage');
// Le lundi courant est inscrit en dur en texte ISO : aucun calcul de date
// ni TEXT() dans la feuille, dont la locale ne les évaluait pas.
assert.ok(presence.regles.every(r => !/TEXT\(|TODAY\(|DATE\(/.test(r.formule)), 'Aucun calcul de date dans les règles');
assert.equal(presence.regles[0].formule, `=$A2="${LUNDI_COURANT}"`);
// Aucun séparateur d'arguments : les formules des règles conditionnelles
// posées par l'API ne sont pas traduites dans la locale du classeur, et une
// virgule les rend invalides dans un classeur à point-virgule.
assert.ok(presence.regles.every(r => !/[,;]/.test(r.formule)), `Ni virgule ni point-virgule : ${presence.regles.map(r => r.formule)}`);
assert.equal(presence.regles[1].formule, `=NOT(NOT((LEN($A2)=10)*($A2<"${LUNDI_COURANT}")*($N2>0)*NOT($O2)))`);
assert.equal(presence.regles[2].formule, `=NOT(NOT((LEN($A2)=10)*($A2<"${LUNDI_COURANT}")))`);
assert.deepEqual([...presence.regles].map(r => r.couleur), ['#fce5cd', '#f4cccc', '#efefef']);

// Effacement global puis un trait par fin de semaine ; pas de changement de
// corps ici (Cité puis Rivebois dans la semaine courante → pointillé).
const effacement = presence.bordures.find(b => b.row === 2 && b.height === presence.getMaxRows() - 1);
assert.ok(effacement, 'Les anciens séparateurs sont effacés sur toute la hauteur');
const traits = presence.bordures.filter(b => b.height === 1).map(b => [b.row, b.args[7]]);
assert.deepEqual(traits, [[2, 'SOLID_MEDIUM'], [3, 'SOLID_MEDIUM'], [6, 'DASHED'], [7, 'SOLID_MEDIUM']],
  'Trait plein sous S37, sous la semaine passée et sous la dernière ligne ; pointillé au changement de corps');

const formatsA = Array.from({ length: presence.getMaxRows() - 1 }, (_, i) => presence.formats.get(`${i + 2}:1`));
assert.ok(formatsA.every(f => f === '@'), 'Toute la colonne A passe en texte brut, lignes vides comprises');
assert.equal(presence.formats.get('1:1'), undefined, 'En-tête non touché');
assert.equal(presence.rows[1][15], 'Colonne technique préservée');

// --- Pointage : identité de ligne et verrou --------------------------------

const ligneSain = presence.rows.findIndex(r => r[3] === 'Sain') + 1;
const identiteSain = { lundi: L39, prenom: 'Sain', nom: '' };
presence.writes = [];
verrousDocument = 0;
assert.throws(() => context.ecrirePresenceCellule_('GARDE', ligneSain, 6, true, identiteSain), /Accès refusé/);
assert.throws(() => context.ecrirePresenceCellule_('OFFICIER', ligneSain, 6, true), /Identité de la ligne manquante/);
assert.throws(() => context.ecrirePresenceCellule_('OFFICIER', ligneSain, 6, true, { lundi: L38, prenom: 'Sain', nom: '' }), /a changé/);
assert.throws(() => context.ecrirePresenceCellule_('OFFICIER', ligneSain, 6, true, { lundi: L39, prenom: 'Nouveau', nom: '' }), /a changé/);
assert.throws(() => context.ecrirePresenceCellule_('OFFICIER', ligneSain, 3, true, identiteSain), /ne peut pas être modifiée/);
assert.throws(() => context.ecrirePresenceCellule_('OFFICIER', 50, 6, true, identiteSain), /n'existe plus/);
assert.equal(presence.writes.length, 0, 'Aucune écriture refusée');

context.ecrirePresenceCellule_('OFFICIER', ligneSain, 8, true, identiteSain);
assert.deepEqual(presence.writes.map(w => [w.row, w.col, w.values[0][0]]), [[ligneSain, 8, true]]);
assert.ok(verrousDocument >= 1, 'Le pointage prend le verrou de document');
// L'identité peut arriver sous une ancienne forme (numéro de semaine) : même ligne.
context.ecrirePresenceCellule_('OFFICIER', ligneSain, 15, true, { lundi: 39, prenom: ' SAIN ', nom: '' });
assert.equal(presence.rows[ligneSain - 1][14], true);

// --- Inventaire des formules et migration ----------------------------------

const vue = new Sheet('Vue globale', [
  ['Titre', "=SUMIF(Présences!A:A;39;Présences!N:N)"],
  ['Autre', "=COUNTA('Présences'!$B$2:$B)"],
  ['Sans', '=1+1']
]);
sheets.set('Vue globale', vue);
presence.rows[1][16] = '=A2&" - "&B2';
presence.rows[2][16] = '=SUM(N2:N9)';

const inventaire = JSON.parse(JSON.stringify(context.inventorierReferencesSemainePresences()));
assert.deepEqual(
  inventaire.map(r => [r.feuille, r.cellule, r.colonneA]),
  [['Présences', 'Q2', true], ['Vue globale', 'B1', true], ['Vue globale', 'B2', false]],
  'Les formules lisant la colonne A sont signalées, les autres mentions de Présences listées'
);
// La migration ne bloque pas : une formule adaptée au lundi ISO lit
// légitimement la colonne A. Elle rappelle ces formules dans le journal.
logs.length = 0;
context.migrerPresencesVersLundis();
assert.ok(logs.some(l => /Attention : 2 formule\(s\).*Présences!Q2.*Vue globale!B1/.test(l)), `Formules rappelées : ${logs}`);

// Formules adaptées : la migration convertit la colonne A seule.
vue.rows[0][1] = "=SUMIF(Présences!B:B;\"Cité\";Présences!N:N)";
presence.rows[1][16] = '';
const abime = new Sheet('Présences', [
  entete(),
  ligne(dateSerie39, 'Cité', 'Un', Array(7).fill(true), true),
  ligne(38, 'Cité', 'Deux', Array(7).fill(false)),
  ligne(L38, 'Cité', 'Trois', [true, false, false, false, false, false, false]),
  ligne('S37', 'Cité', 'Quatre', Array(7).fill(false))
]);
sheets.set('Présences', abime);
const resultat = JSON.parse(JSON.stringify(context.migrerPresencesVersLundis()));
assert.deepEqual(resultat, { lignes: 4, corrigees: 2, lundiCourant: LUNDI_COURANT });
assert.deepEqual(abime.rows.slice(1).map(r => r[0]), [L39, L38, L38, 'S37']);
assert.equal(abime.rows[0][0], 'Lundi');
assert.ok(abime.writes.every(w => w.col === 1 && w.width === 1), 'Seule la colonne A est écrite');
assert.deepEqual(abime.rows[1].slice(5, 15), [...Array(7).fill(true), '', '', true], 'Pointages intacts');
assert.ok(Array.from({ length: abime.getMaxRows() - 1 }, (_, i) => abime.formats.get(`${i + 2}:1`)).every(f => f === '@'));

sheets.set('Présences', new Sheet('Présences', [entete(), ligne(L39, 'Cité', 'Un', Array(7).fill(false))]));
const propre = sheets.get('Présences');
assert.equal(context.migrerPresencesVersLundis().corrigees, 0);
assert.deepEqual(propre.writes.map(w => [w.row, w.col]), [[1, 1]], 'Colonne saine : seul l\'en-tête est réécrit');

// --- Libellés côté interface ------------------------------------------------

assert.deepEqual(semaineIso(LUNDI_COURANT), { annee: 2026, semaine: 39 });
assert.equal(numeroSemaine(L39), 39);
assert.equal(numeroSemaine('S37'), null);
assert.equal(libelleSemaine(L39), 'Semaine 39');
assert.equal(libelleSemaine('S37'), 'S37', 'Une valeur inconnue reste visible');
assert.equal(dateLundi(L39), '21/09/2026');
assert.equal(titreSemaine(L39), 'Semaine 39 · du 21/09/2026');
assert.equal(titreSemaine('S37'), 'S37');
assert.equal(retardSemaines('2025-12-22', '2026-01-05'), 2);
assert.deepEqual([L38, 'S37', L39].sort(comparerLundisDecroissant), [L39, L38, 'S37'], 'Plus récente d\'abord, inconnues en fin');

console.log('test-presences-lundi : lundis ISO, conversion des anciennes valeurs, fusion, identité de ligne, inventaire et migration OK');
