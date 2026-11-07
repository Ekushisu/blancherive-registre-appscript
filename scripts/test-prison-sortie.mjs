// Sortie de détention (`Prison.js`) : acte complet à la place de la case
// Libéré. Prononcer (GARDE, OFFICIER ; issue, destination et personne
// destinataire d'un transfert, date, garde signataire, motif obligatoire),
// annuler (OFFICIER, motif), note au journal (datée, signée, définitive),
// identité de ligne, colonnes M:S créées au besoin, lignes antérieures,
// modification et suppression qui respectent ces colonnes.
//
//   node scripts/test-prison-sortie.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sheets = new Map();
let held = false, writes = 0;
class Sheet {
  constructor(name, rows = [], colonnes = 12) { this.name = name; this.rows = rows; this.colonnes = colonnes; }
  getMaxColumns() { return this.colonnes; }
  insertColumnsAfter(after, count) { assert.equal(after, this.colonnes); this.colonnes += count; }
  getLastRow() { let i = this.rows.length; while (i && !this.rows[i - 1]?.some(v => v !== '' && v !== undefined)) i--; return i; }
  getMaxRows() { return 1000; }
  getRange(r, c, h = 1, w = 1) {
    const sheet = this;
    assert.ok(c + w - 1 <= sheet.colonnes, `Lecture hors feuille : colonne ${c + w - 1} sur ${sheet.colonnes}`);
    const range = {
      getValues() { return Array.from({ length: h }, (_, i) => Array.from({ length: w }, (_, j) => sheet.rows[r + i - 1]?.[c + j - 1] ?? '')); },
      getDisplayValues() { return this.getValues().map(row => row.map(v => v instanceof Date ? v.toISOString() : String(v))); },
      getDisplayValue() { return this.getDisplayValues()[0][0]; },
      getDataValidation() { return null; }, setDataValidation() { return range; }, clearDataValidations() { return range; },
      setValues(values) {
        assert.equal(held, true, 'Écritures sous verrou');
        writes++;
        values.forEach((row, i) => row.forEach((v, j) => { (sheet.rows[r + i - 1] ||= [])[c + j - 1] = v; }));
        return range;
      },
      setValue(v) { return this.setValues([[v]]); },
      setNumberFormat() { return range; }, setFontWeight() { return range; }, insertCheckboxes() { return range; },
      clearContent() { return this.setValues(Array.from({ length: h }, () => Array(w).fill(''))); }
    };
    return range;
  }
}
const ss = { getSheetByName: name => sheets.get(name) || null };
const context = vm.createContext({ Date, console, SPREADSHEET_ID: 'test',
  // 'GARDE' / 'OFFICIER' : code commun ; 'OFFICIER@Nom' : session Discord au nom de Nom.
  requireRole(token, roles) {
    const [role, nom] = String(token).split('@');
    if (!roles.includes(role)) throw Error('Accès refusé');
    return nom ? { role, via: 'discord', nom } : { role, via: 'code' };
  },
  SpreadsheetApp: { openById: () => ss, flush() {} },
  LockService: { getScriptLock: () => ({ waitLock() { assert.equal(held, false, 'Pas de verrou imbriqué'); held = true; }, releaseLock() { held = false; } }) },
  Utilities: { formatDate: (date, tz, motif) => motif === "yyyy-MM-dd'T'HH:mm" ? date.toISOString().slice(0, 16) : date.toISOString(), DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' }, computeDigest: () => [1], base64EncodeWebSafe: () => 'v' }
});
for (const f of ['SyncCodex.js', 'Codex.js', 'JournalCodex.js', 'Amendes.js', 'Objets.js', 'Prison.js']) vm.runInContext(readFileSync(`src/${f}`, 'utf8'), context);
const plain = x => JSON.parse(JSON.stringify(x));

const entree = new Date(2026, 8, 7, 12, 0), prevue = new Date(2026, 8, 8, 12, 0);
const prison = new Sheet('Prison', [
  Array(12).fill('En-tête'),
  ['2026-09-07', 'Rorik', 'Nazeem', '1', 'Vol', 24, entree, prevue, false, '[]', 'Pris au marché', '[]'],
  ['2026-09-01', 'Ulfgar', 'Ancien', '', 'Vol', 1, '', '', true, '', 'Ligne antérieure, cochée sans acte', '']
]);
sheets.set('Prison', prison);
sheets.set('Données', new Sheet('Données', [Array(15).fill(''), [...Array(14).fill(''), 'Rorik'], [...Array(14).fill(''), 'Ulfgar ']], 15));
sheets.set('SyncCodex', new Sheet('SyncCodex', [Array(25).fill(''), ['Code pénal local de Blancherive', '34', 'Vol', 'délit', '', '', '', '', 'Texte', '']], 25));

// L'ancienne bascule n'existe plus ; les issues sont servies au formulaire.
assert.equal(typeof context.modifierPrisonLibere, 'undefined', 'modifierPrisonLibere retirée');
const formData = plain(context.getPrisonFormData('GARDE'));
assert.deepEqual(formData.issues.map(i => i.code), ['LIBERATION', 'LIBERATION_ANTICIPEE', 'TRANSFERT_EMPIRE', 'TRANSFERT_THALMOR', 'TRANSFERT_CHATELLERIE', 'TRANSFERT_ORDRE', 'EVASION', 'DECES']);
assert.equal(formData.issues.find(i => i.code === 'TRANSFERT_CHATELLERIE').destination, 'Châtellerie');
assert.ok(formData.issues.filter(i => i.transfert).every(i => /^TRANSFERT_/.test(i.code)));

// Feuille à douze colonnes : lecture sans acte ni journal, sans erreur.
let lecture = plain(context.getPrison('GARDE'));
assert.equal(lecture.rows.length, 2);
assert.equal(lecture.rows[1].acteSortie, null);
assert.deepEqual(lecture.rows[1].journal, []);
assert.equal(lecture.rows[1].libere, false);
assert.equal(lecture.rows[0].libere, true, 'Ligne antérieure cochée : libérée, sans détail');
assert.equal(lecture.rows[0].acteSortie, null);

const attendu = { garde: 'Rorik', detenu: 'Nazeem' };
const base = { issue: 'LIBERATION', date: '2026-09-08T12:00', garde: 'Rorik', motif: 'Peine purgée.', attendu };
const avant = JSON.stringify(prison.rows.slice(1));

// Rôles, identité, champs obligatoires : rien n'est écrit avant validation.
assert.throws(() => context.prononcerSortiePrison('intrus', 2, base), /Accès refusé/);
assert.throws(() => context.prononcerSortiePrison('INTENDANT', 2, base), /Accès refusé/);
assert.throws(() => context.prononcerSortiePrison('GARDE', 2, null), /manquantes/);
assert.throws(() => context.prononcerSortiePrison('GARDE', 2, { ...base, issue: 'FUITE' }), /issue/);
assert.throws(() => context.prononcerSortiePrison('GARDE', 2, { ...base, motif: '  ' }), /motif de la sortie est obligatoire/);
assert.throws(() => context.prononcerSortiePrison('GARDE', 2, { ...base, attendu: undefined }), /plus à jour/);
assert.throws(() => context.prononcerSortiePrison('GARDE', 2, { ...base, attendu: { garde: 'Rorik', detenu: 'Autre' } }), /a changé/);
assert.throws(() => context.prononcerSortiePrison('GARDE', 2, { ...base, garde: 'Inconnu' }), /pas reconnu/);
assert.throws(() => context.prononcerSortiePrison('GARDE', 2, { ...base, garde: '' }), /garde qui signe/);
assert.throws(() => context.prononcerSortiePrison('GARDE', 2, { ...base, date: '2026-09-07T11:00' }), /précéder l'entrée/);
assert.throws(() => context.prononcerSortiePrison('GARDE', 2, { ...base, date: 'hier' }), /de sortie/);
assert.throws(() => context.prononcerSortiePrison('GARDE', 2, { ...base, issue: 'TRANSFERT_CHATELLERIE', remisA: 'Capitaine Aldis' }), /nom de la châtellerie/);
assert.throws(() => context.prononcerSortiePrison('GARDE', 2, { ...base, issue: 'TRANSFERT_ORDRE', remisA: 'Isran' }), /nom de l'ordre/);
assert.throws(() => context.prononcerSortiePrison('GARDE', 2, { ...base, issue: 'TRANSFERT_EMPIRE' }), /personne à qui le détenu est remis/);
assert.throws(() => context.prononcerSortiePrison('GARDE', 2, { ...base, issue: 'TRANSFERT_THALMOR', remisA: 'x'.repeat(201) }), /200 caractères/);
assert.throws(() => context.prononcerSortiePrison('GARDE', 9, base), /n'existe plus/);
assert.throws(() => context.prononcerSortiePrison('GARDE', 'deux', base), /invalide/);
assert.equal(JSON.stringify(prison.rows.slice(1)), avant, 'Aucune écriture de ligne avant validation (seuls les en-têtes M:S sont posés)');
assert.equal(held, false, 'Verrou libéré après refus');

// Session Discord : le garde signataire est celui de la session, pas celui du navigateur.
assert.throws(() => context.prononcerSortiePrison('GARDE@Inconnu', 2, { ...base, garde: 'Rorik' }), /pas reconnu/);

// Libération un jour avant la sortie prévue : enregistrée comme anticipée.
let resultat = plain(context.prononcerSortiePrison('GARDE@Ulfgar', 2, { ...base, date: '2026-09-08T09:30', garde: 'Rorik', issue: 'LIBERATION', destination: 'ignorée', remisA: 'ignoré' }));
assert.equal(held, false);
assert.ok(prison.colonnes >= 19, 'Colonnes M:S créées');
assert.equal(prison.rows[0][18], 'Journal (JSON)', 'En-tête du journal');
assert.equal(prison.rows[0][14], 'Sortie — remis à');
const ligne = prison.rows[1];
assert.equal(ligne[8], true, 'Libéré coché');
assert.equal(ligne[12], 'LIBERATION_ANTICIPEE');
assert.equal(ligne[13], '', 'Pas de destination hors châtellerie / ordre');
assert.equal(ligne[14], '', 'Pas de personne destinataire hors transfert');
assert.ok(ligne[15] instanceof Date && ligne[15].getHours() === 9);
assert.equal(ligne[16], 'Ulfgar', 'Signataire : la session Discord');
assert.equal(ligne[17], 'Peine purgée.');
let journal = JSON.parse(ligne[18]);
assert.equal(journal.length, 1);
assert.equal(journal[0].type, 'sortie');
assert.equal(journal[0].qui, 'Ulfgar');
assert.equal(journal[0].issue, 'LIBERATION_ANTICIPEE');
assert.equal(journal[0].texte, 'Peine purgée.');
const lu = resultat.rows.find(r => r.row === 2);
assert.equal(lu.libere, true);
assert.equal(lu.acteSortie.libelle, 'Libération anticipée');
assert.equal(lu.acteSortie.garde, 'Ulfgar');
assert.equal(lu.acteSortie.transfert, false);
assert.equal(lu.journal[0].libelle, 'Libération anticipée');

// Déjà close : refus tant qu'un officier n'a pas annulé.
assert.throws(() => context.prononcerSortiePrison('GARDE', 2, base), /déjà close/);

// Note au journal : datée, signée, ajoutée en fin, cases de sortie intactes.
assert.throws(() => context.ajouterNotePrison('GARDE', 2, { garde: 'Rorik', texte: ' ', attendu }), /vide/);
assert.throws(() => context.ajouterNotePrison('GARDE', 2, { garde: 'Rorik', texte: 'x'.repeat(2001), attendu }), /2000/);
assert.throws(() => context.ajouterNotePrison('VISITEUR', 2, { garde: 'Rorik', texte: 'Visite', attendu }), /Accès refusé/);
resultat = plain(context.ajouterNotePrison('GARDE', 2, { garde: 'Rorik', texte: 'Objets restitués.', attendu }));
journal = JSON.parse(prison.rows[1][18]);
assert.equal(journal.length, 2);
assert.deepEqual([journal[1].type, journal[1].qui, journal[1].texte], ['note', 'Rorik', 'Objets restitués.']);
assert.equal(prison.rows[1][12], 'LIBERATION_ANTICIPEE', 'Une note ne touche pas la sortie');
assert.equal(resultat.rows.find(r => r.row === 2).journal.length, 2);

// Modification par un officier : A:L réécrits, M:S conservés.
const modif = { date: '2026-09-07', garde: 'Rorik', detenu: 'Nazeem', cellule: 'B', chefs: [{ source: 'Code pénal local de Blancherive', article: '34' }], duree: 24, entree: '2026-09-07T12:00', notes: 'Pris au marché', attendu };
context.modifierPrison('OFFICIER', 2, modif);
assert.equal(prison.rows[1][3], 'B');
assert.equal(prison.rows[1][8], true, 'Libéré conservé');
assert.equal(prison.rows[1][12], 'LIBERATION_ANTICIPEE', 'Acte conservé');
assert.equal(JSON.parse(prison.rows[1][18]).length, 2, 'Journal conservé');

// Annulation : OFFICIER seul, motif obligatoire, colonnes vidées, journal gardé.
assert.throws(() => context.annulerSortiePrison('GARDE', 2, { garde: 'Rorik', motif: 'Erreur', attendu }), /Accès refusé/);
assert.throws(() => context.annulerSortiePrison('OFFICIER', 2, { garde: 'Rorik', motif: '', attendu }), /motif de l'annulation/);
assert.throws(() => context.annulerSortiePrison('OFFICIER', 2, { garde: 'Rorik', motif: 'Erreur', attendu: { garde: 'Rorik', detenu: 'X' } }), /a changé/);
resultat = plain(context.annulerSortiePrison('OFFICIER', 2, { garde: 'Rorik', motif: 'Erreur de ligne.', attendu }));
assert.equal(prison.rows[1][8], false);
assert.deepEqual(prison.rows[1].slice(12, 18), ['', '', '', '', '', '']);
journal = JSON.parse(prison.rows[1][18]);
assert.equal(journal.length, 3);
assert.deepEqual([journal[2].type, journal[2].issue, journal[2].texte], ['annulation', 'LIBERATION_ANTICIPEE', 'Erreur de ligne.']);
assert.equal(resultat.rows.find(r => r.row === 2).acteSortie, null);
assert.equal(resultat.rows.find(r => r.row === 2).libere, false);
assert.throws(() => context.annulerSortiePrison('OFFICIER', 2, { garde: 'Rorik', motif: 'Encore', attendu }), /rien à annuler/);

// Transfert à une châtellerie : destination et personne destinataire écrites.
resultat = plain(context.prononcerSortiePrison('OFFICIER', 2, { ...base, issue: 'TRANSFERT_CHATELLERIE', destination: 'Châtellerie de Solitude', remisA: 'Capitaine Aldis', date: '2026-09-10T08:00', motif: 'Ordre du Jarl.' }));
assert.deepEqual(prison.rows[1].slice(12, 15), ['TRANSFERT_CHATELLERIE', 'Châtellerie de Solitude', 'Capitaine Aldis']);
const transfert = resultat.rows.find(r => r.row === 2);
assert.equal(transfert.acteSortie.transfert, true);
assert.equal(transfert.acteSortie.remisA, 'Capitaine Aldis');
assert.equal(transfert.acteSortie.destination, 'Châtellerie de Solitude');
assert.equal(JSON.parse(prison.rows[1][18]).length, 4);
assert.equal(JSON.parse(prison.rows[1][18])[3].remisA, 'Capitaine Aldis');

// Transfert à l'Empire : destination ignorée, personne exigée et écrite.
context.annulerSortiePrison('OFFICIER', 2, { garde: 'Rorik', motif: 'Test', attendu });
context.prononcerSortiePrison('GARDE', 2, { ...base, issue: 'TRANSFERT_EMPIRE', destination: 'ignorée', remisA: 'Légat Rikke', date: '2026-09-10T08:00', motif: 'Réquisition impériale.' });
assert.deepEqual(prison.rows[1].slice(12, 15), ['TRANSFERT_EMPIRE', '', 'Légat Rikke']);

// Ligne antérieure cochée sans acte : l'officier peut l'annuler (décocher), le garde ne peut pas la prononcer de nouveau.
const attenduAncien = { garde: 'Ulfgar', detenu: 'Ancien' };
assert.throws(() => context.prononcerSortiePrison('GARDE', 3, { ...base, garde: 'Ulfgar', attendu: attenduAncien }), /déjà close/);
context.annulerSortiePrison('OFFICIER', 3, { garde: 'Ulfgar', motif: 'Réouverture.', attendu: attenduAncien });
assert.equal(prison.rows[2][8], false);
assert.equal(JSON.parse(prison.rows[2][18])[0].issue, '', 'Annulation d\'une case cochée sans acte');
assert.equal(prison.rows[2][1], 'Ulfgar', 'Colonne Garde intacte');
assert.equal(prison.rows[2][16], '', 'Pas de garde de sortie');

// Journal illisible : lecture tolérante, puis réécriture propre.
prison.rows[2][18] = '{pas du json';
assert.deepEqual(plain(context.getPrison('GARDE')).rows.find(r => r.row === 3).journal, []);
context.ajouterNotePrison('GARDE', 3, { garde: 'Ulfgar', texte: 'Repris.', attendu: attenduAncien });
assert.equal(JSON.parse(prison.rows[2][18]).length, 1);

// Journal plein : refusé sans écriture.
prison.rows[2][18] = JSON.stringify(Array.from({ length: 40 }, () => ({ quand: 'x', type: 'note', qui: 'Ulfgar', texte: 'y'.repeat(1100) })));
assert.throws(() => context.ajouterNotePrison('GARDE', 3, { garde: 'Ulfgar', texte: 'Encore', attendu: attenduAncien }), /plein/);
assert.equal(held, false);

// Suppression : A:S vidés, journal compris.
// `supprimerPrison` n'a jamais pris de verrou (inchangé ici) : le simulateur l'exige pour toute écriture.
held = true; context.supprimerPrison('OFFICIER', 2); held = false;
assert.ok(prison.rows[1].slice(0, 19).every(v => v === ''), 'Ligne vidée jusqu\'au journal');

console.log('Prison / sortie : issues, transferts, motif obligatoire, journal, annulation, lignes antérieures OK.');
