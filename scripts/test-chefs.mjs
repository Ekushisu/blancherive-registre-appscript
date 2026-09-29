// Chefs d'accusation côté serveur : version du Codex, index des articles,
// validation des chefs, ajout et modification des Amendes et de la Prison,
// permissions, identité de ligne, montant et durée « à déterminer »,
// colonnes techniques créées à la demande, lignes antérieures et rollback.
//
//   node scripts/test-chefs.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const sheets = new Map();
let failFlush = false, locked = false, lectures = 0;
class Sheet {
  constructor(rows, colonnes) { this.rows = rows; this.validations = new Map(); this.colonnes = colonnes; }
  getLastRow() { return this.rows.length; }
  getMaxColumns() { return this.colonnes; }
  insertColumnsAfter(after, count) { assert.equal(after, this.colonnes); this.colonnes += count; }
  getRange(r, c, h = 1, w = 1) {
    if (c + w - 1 > this.colonnes) throw new Error(`Colonne ${c + w - 1} hors de la feuille (${this.colonnes})`);
    const sheet = this, key = `${r}:${c}`;
    const range = {
      getValues() { lectures++; return Array.from({ length: h }, (_, i) => Array.from({ length: w }, (_, j) => sheet.rows[r + i - 1]?.[c + j - 1] ?? '')); },
      getDisplayValues() { return this.getValues().map(row => row.map(v => v instanceof Date ? v.toISOString() : String(v))); },
      getDisplayValue() { return this.getDisplayValues()[0][0]; },
      setValues(values) {
        values.forEach((row, i) => row.forEach((value, j) => {
          const rule = sheet.validations.get(`${r + i}:${c + j}`);
          if (rule && value !== '' && !rule.includes(value)) throw Error('Validation Sheets');
          (sheet.rows[r + i - 1] ||= [])[c + j - 1] = value;
        })); return range;
      },
      setValue(v) { return this.setValues([[v]]); },
      clearContent() { return this.setValues(Array.from({ length: h }, () => Array(w).fill(''))); },
      getDataValidation() { return sheet.validations.get(key) || null; },
      setDataValidation(rule) { sheet.validations.set(key, rule); return range; },
      clearDataValidations() { sheet.validations.delete(key); return range; },
      insertCheckboxes() { return range; }, setNumberFormat() { return range; }
    };
    return range;
  }
}
const ctx = vm.createContext({
  console, Date, SPREADSHEET_ID: 'test', ROLE_PUBLIC: 'VISITEUR',
  requireRole(token, roles) { if (!roles.includes(token)) throw Error('Accès refusé'); return { role: token }; },
  SpreadsheetApp: { openById() { return { getSheetByName: name => sheets.get(name) || null }; }, flush() { if (failFlush) { failFlush = false; throw Error('Échec flush'); } } },
  LockService: { getScriptLock: () => ({ waitLock() { assert.equal(locked, false, 'Pas de verrou imbriqué'); locked = true; }, releaseLock() { locked = false; } }) },
  Utilities: {
    DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (algo, texte) => Array.from(createHash(algo).update(texte, 'utf8').digest()),
    base64EncodeWebSafe: octets => Buffer.from(octets).toString('base64url'),
    formatDate: (date, tz, motif) => motif.startsWith("yyyy-MM-dd'T'") ? date.toISOString().slice(0, 16) : date.toISOString()
  }
});
for (const file of ['SyncCodex.js', 'Codex.js', 'Amendes.js', 'Objets.js', 'Prison.js']) vm.runInContext(fs.readFileSync(`src/${file}`, 'utf8'), ctx);
ctx.lireCatalogueObjets_ = () => [{ id: 'skyrim.esm|00000F', nom: 'Or', type: 'Objet divers' }];
const plain = value => JSON.parse(JSON.stringify(value));

// ---------------------------------------------------------------- Codex
const CPL = 'Code pénal local de Blancherive', CPEN = 'Codex Penitus Imperialis', CONTEXTE = 'Registre de la Chevalerie';
const article = (source, num, titre, classif, texte, sanction = '') => {
  const row = Array(25).fill('');
  Object.assign(row, [source, num, titre, classif, '', '', '', sanction, texte, '']);
  return row;
};
const doc = (source, famille, abrege, citable) => { const row = Array(25).fill(''); Object.assign(row, [], { 17: source, 18: famille, 19: 'Autorité', 20: 'Domaine', 21: 'oui', 22: 'https://exemple.invalid', 23: abrege, 24: citable }); return row; };
const syncRows = [Array(25).fill('en-tête'),
  article(CPL, 'Préambule', 'Préambule', '', 'Considérant…'),
  article(CPL, '4', 'Refus d’obtempérer à une injonction locale', 'délit', 'Constitue un refus…'),
  article(CPL, '16', 'Injure', 'contravention', 'Le fait d’adresser…'),
  article(CPEN, '5', 'Usurpation d’une fonction impériale', 'crime', 'Le fait de…', 'Sanction — 900 septims.'),
  article(CONTEXTE, '1', 'Des chevaliers', '', 'Texte de contexte.')
];
// Métadonnées du dossier Drive : le registre de la chevalerie est un document de contexte.
syncRows[5] = syncRows[5].map((v, i) => i >= 17 ? doc(CONTEXTE, 'Documentation', '', 'non')[i] : v);
sheets.set('SyncCodex', new Sheet(syncRows, 25));

assert.throws(() => ctx.getCodex('INTENDANT'), /Accès refusé/);
const codex = plain(ctx.getCodex('VISITEUR'));
assert.ok(codex.version.length > 10, 'Version calculée');
assert.equal(codex.articles.length, 5);
const injure = codex.articles.find(a => a.article === '16');
assert.equal(injure.abrege, 'CPL', 'Sigle déclaré au registre');
assert.equal(injure.citable, true);
assert.equal(codex.articles.find(a => a.article === 'Préambule').citable, false, 'Un préambule ne fonde pas de chef');
assert.equal(codex.articles.find(a => a.source === CPEN).abrege, 'CPen');
const contexte = codex.articles.find(a => a.source === CONTEXTE);
assert.equal(contexte.citable, false, 'Document de contexte non citable, lu depuis le cache R:Y');
assert.equal(contexte.abrege, 'RC', 'Sigle dérivé du nom');
assert.equal(ctx.abregerSourceCodex_('Décret sur le régime fiscal de Bordeciel', ''), 'Décr. RFB');
assert.equal(ctx.abregerSourceCodex_('De Argentaria', ''), 'A');
assert.equal(ctx.abregerSourceCodex_('Décret sur les équipements dwemers', 'DED'), 'DED', 'Le sigle déclaré l’emporte');
const inchange = plain(ctx.getCodex('GARDE', codex.version));
assert.equal(inchange.articles, null, 'Version connue : rien de renvoyé');
assert.equal(inchange.version, codex.version);
syncRows[3][2] = 'Injure publique';
const modifie = plain(ctx.getCodex('GARDE', codex.version));
assert.notEqual(modifie.version, codex.version, 'Un titre modifié change la version');
assert.equal(modifie.articles.find(a => a.article === '16').titre, 'Injure publique');
syncRows[3][2] = 'Injure';
assert.equal(plain(ctx.getCodex('GARDE', codex.version)).articles, null);

const index = ctx.indexerArticlesCodex_({ getSheetByName: n => sheets.get(n) });
assert.equal(index.get(ctx.cleArticleCodex_(' code PÉNAL local de blancherive ', '16')).titre, 'Injure', 'Clé insensible à la casse et aux espaces');
assert.equal(index.get(ctx.cleArticleCodex_(CONTEXTE, '1')).citable, false);

// ---------------------------------------------------------------- validation des chefs
const ss = { getSheetByName: n => sheets.get(n) };
const valider = chefs => ctx.validerChefsAccusation_(ss, chefs);
assert.throws(() => valider([]), /au moins un chef/);
assert.throws(() => valider('texte'), /au moins un chef/);
assert.throws(() => valider([{ source: CPL, article: '999' }]), /ne figure plus/);
assert.throws(() => valider([{ source: CONTEXTE, article: '1' }]), /document de contexte/);
assert.throws(() => valider([{ source: CPL, article: 'Préambule' }]), /document de contexte/);
assert.throws(() => valider([{ source: CPL, article: '16' }, { source: 'CODE PÉNAL LOCAL DE BLANCHERIVE', article: '16' }]), /deux fois/);
assert.throws(() => valider([{ libre: ' ' }]), /1 à 1 000/);
assert.throws(() => valider([{ libre: 'x'.repeat(1001) }]), /1 à 1 000/);
assert.throws(() => valider([{ libre: 'Décision' }, { libre: ' décision ' }]), /deux fois/);
assert.throws(() => valider(Array.from({ length: 21 }, (_, i) => ({ libre: `Motif ${i}` }))), /plus de 20/);
assert.throws(() => valider([{ source: CPL }]), /invalide/);
assert.throws(() => valider([null]), /invalide/);
const avantLecture = lectures;
const libres = valider([{ libre: 'Décision  du Thane' }]);
assert.equal(lectures, avantLecture, 'Références libres seules : SyncCodex non lu');
assert.equal(libres.texte, 'Motif personnalisé — Décision du Thane');
const mixte = valider([{ source: CPL, article: '16', titre: 'Titre envoyé par le navigateur' }, { source: CPEN, article: '5' }, { libre: 'Ordre du Jarl' }]);
assert.equal(mixte.texte, 'CPL art. 16 — Injure ; CPen art. 5 — Usurpation d’une fonction impériale ; Motif personnalisé — Ordre du Jarl');
const json = JSON.parse(mixte.json);
assert.equal(json.version, 1);
assert.deepEqual(json.chefs[0], { source: CPL, article: '16', titre: 'Injure', classification: 'contravention', abrege: 'CPL' }, 'Titre figé depuis le Codex, pas depuis le navigateur');
assert.deepEqual(json.chefs[2], { libre: 'Ordre du Jarl' });
assert.deepEqual(plain(ctx.lireChefsAccusation_(mixte.json)), json.chefs);
assert.equal(ctx.lireChefsAccusation_(''), null);
assert.equal(ctx.lireChefsAccusation_('Art. 12 — Vol'), null, 'Texte historique : pas de JSON');
assert.equal(ctx.lireChefsAccusation_('{"version":2,"chefs":[]}'), null);
assert.equal(ctx.lireChefsAccusation_('{"version":1,"chefs":[{"source":"x"}]}'), null);
assert.equal(ctx.lireChefsAccusation_('{"version":1,"chefs":[{"source":"Décret X","article":"2","titre":"T"}]}')[0].abrege, 'Décr. X', 'Sigle dérivé si absent du JSON');

// ---------------------------------------------------------------- Amendes
sheets.set('Données', new Sheet([[], [...Array(14).fill(''), 'Rorik ']], 15));
const fines = new Sheet([Array(7).fill('En-tête'), ['2026-09-01', 'Rorik ', 'Ancien', 'Art. 12 — Vol simple', 300, true, false]], 7);
sheets.set('Amendes', fines);
const base = { date: '2026-09-29', garde: 'Rorik', contrevenant: 'Belethor', chefs: [{ source: CPL, article: '16' }] };
assert.throws(() => ctx.ajouterAmende('intrus', base), /Accès refusé/);
assert.throws(() => ctx.ajouterAmende('VISITEUR', base), /Accès refusé/);
assert.throws(() => ctx.ajouterAmende('GARDE', { ...base, chefs: undefined, infraction: 'Art. 105', montant: 200 }), /plus à jour/, 'Ancien formulaire');
assert.throws(() => ctx.ajouterAmende('GARDE', { ...base, chefs: [] }), /au moins un chef/);
for (const montant of [-1, 0, 1.5, 'abc', ' ', {}, true, Number.MAX_SAFE_INTEGER + 1]) {
  assert.throws(() => ctx.ajouterAmende('GARDE', { ...base, montant }), /entier strictement positif/, `montant ${String(montant)}`);
}
assert.equal(fines.rows.length, 2, 'Aucune ligne écrite par un refus');
assert.deepEqual(plain(ctx.getAmendeFormData('GARDE')), { gardes: ['Rorik'] });

const lu = plain(ctx.getAmendes('GARDE'));
assert.equal(lu.rows[0].chefs, null, 'Ligne antérieure : pas de chefs structurés');
assert.equal(lu.rows[0].infraction, 'Art. 12 — Vol simple');

fines.validations.set('3:4', ['Art. 12 — Vol simple']);
let result = plain(ctx.ajouterAmende('GARDE', { ...base, montant: '200' }));
assert.equal(fines.colonnes, 8, 'Colonne H créée');
assert.equal(fines.rows[0][7], "Chefs d'accusation (JSON)", 'En-tête posé');
assert.equal(fines.rows[2][3], 'CPL art. 16 — Injure');
assert.equal(fines.rows[2][4], 200);
assert.equal(fines.rows[2][1], 'Rorik ', 'Valeur brute de validation conservée');
assert.equal(JSON.parse(fines.rows[2][7]).chefs[0].titre, 'Injure');
assert.equal(fines.validations.has('3:4'), false, 'Validation de la cellule Infraction retirée');
assert.equal(locked, false);
assert.deepEqual(result.rows[0].chefs, [{ source: CPL, article: '16', titre: 'Injure', classification: 'contravention', abrege: 'CPL' }]);
assert.equal(result.rows[0].montantRaw, 200);

result = plain(ctx.ajouterAmende('OFFICIER', { ...base, contrevenant: 'Nazeem', chefs: [{ libre: 'Ordre du Jarl' }, { source: CPEN, article: '5' }] }));
assert.equal(fines.rows[3][4], '', 'Montant à déterminer');
assert.equal(result.rows[0].montantRaw, null);
assert.equal(result.rows[0].montant, '');
assert.equal(fines.rows[3][3], 'Motif personnalisé — Ordre du Jarl ; CPen art. 5 — Usurpation d’une fonction impériale');

// Rollback : ligne et validation restaurées après un échec d'écriture.
fines.validations.set('5:4', ['Art. 12 — Vol simple']);
failFlush = true;
assert.throws(() => ctx.ajouterAmende('GARDE', { ...base, montant: 100 }), /flush/);
assert.ok(fines.rows[4].every(value => value === ''));
assert.deepEqual(fines.validations.get('5:4'), ['Art. 12 — Vol simple']);
assert.equal(locked, false, 'Verrou libéré après échec');

// Modification.
const modif = { ...base, contrevenant: 'Belethor le Marchand', montant: 350, chefs: [{ source: CPL, article: '4' }, { source: CPL, article: '16' }], attendu: { garde: 'Rorik', contrevenant: 'Belethor' } };
assert.throws(() => ctx.modifierAmende('GARDE', 3, modif), /Accès refusé/, 'La modification est réservée aux officiers');
assert.throws(() => ctx.modifierAmende('OFFICIER', 3, { ...modif, attendu: undefined }), /plus à jour/);
assert.throws(() => ctx.modifierAmende('OFFICIER', 3, { ...modif, attendu: { garde: 'Rorik', contrevenant: 'Autre' } }), /a changé depuis/);
assert.throws(() => ctx.modifierAmende('OFFICIER', 99, modif), /n'existe plus/);
assert.throws(() => ctx.modifierAmende('OFFICIER', 5, { ...modif, attendu: { garde: '', contrevenant: '' } }), /n'existe plus/, 'Ligne vidée par le rollback : hors registre');
assert.equal(fines.rows[2][3], 'CPL art. 16 — Injure', 'Aucune écriture après refus');
fines.rows[2][5] = true; // payée entre-temps
result = plain(ctx.modifierAmende('OFFICIER', 3, modif));
assert.equal(fines.rows[2][2], 'Belethor le Marchand');
assert.equal(fines.rows[2][3], 'CPL art. 4 — Refus d’obtempérer à une injonction locale ; CPL art. 16 — Injure');
assert.equal(fines.rows[2][4], 350);
assert.equal(fines.rows[2][5], true, 'Payé conservé');
assert.equal(fines.rows[2][6], false, 'Reversé conservé');
assert.equal(JSON.parse(fines.rows[2][7]).chefs.length, 2);
assert.equal(locked, false);
result = plain(ctx.modifierAmende('OFFICIER', 3, { ...modif, montant: '', attendu: { garde: 'Rorik', contrevenant: 'Belethor le Marchand' } }));
assert.equal(fines.rows[2][4], '', 'Retour à « à déterminer »');
// Une ligne antérieure se modifie aussi : ses chefs deviennent structurés.
ctx.modifierAmende('OFFICIER', 2, { date: '2026-09-01', garde: 'Rorik', contrevenant: 'Ancien', chefs: [{ libre: 'Art. 12 — Vol simple (ancien Codex)' }], montant: 300, attendu: { garde: 'Rorik', contrevenant: 'Ancien' } });
assert.equal(fines.rows[1][5], true, 'Payé historique conservé');
assert.equal(JSON.parse(fines.rows[1][7]).chefs[0].libre, 'Art. 12 — Vol simple (ancien Codex)');
// Suppression : A:H vidés.
ctx.supprimerAmende('OFFICIER', 2);
assert.ok(fines.rows[1].every(v => v === ''));

// ---------------------------------------------------------------- Prison
const prison = new Sheet([Array(11).fill('En-tête'), ['2026-09-01', 'Rorik ', 'Ancien', '', 'Art. 12 — Vol simple', 2, new Date('2026-09-01T10:00:00Z'), new Date('2026-09-01T12:00:00Z'), false, 'Deux épées\nUne bourse', 'Note']], 11);
sheets.set('Prison', prison);
const basePrison = { date: '2026-09-29', garde: 'Rorik', detenu: 'Nazeem', cellule: 'III', chefs: [{ source: CPL, article: '4' }], entree: '2026-09-29T10:00', saisies: [{ id: 'skyrim.esm|00000F', quantite: 50 }], notes: '' };
assert.throws(() => ctx.ajouterPrison('intrus', basePrison), /Accès refusé/);
assert.throws(() => ctx.ajouterPrison('GARDE', { ...basePrison, chefs: undefined, infraction: 'Art. 34', duree: 2 }), /plus à jour/);
for (const duree of [-1, 0, 'abc', ' ', {}, 24 * 400]) {
  assert.throws(() => ctx.ajouterPrison('GARDE', { ...basePrison, duree }), /durée/i, `durée ${String(duree)}`);
}
assert.deepEqual(plain(ctx.getPrisonFormData('GARDE')), { gardes: ['Rorik'] });
let lecture = plain(ctx.getPrison('GARDE'));
assert.equal(lecture.rows[0].chefs, null);
assert.equal(lecture.rows[0].saisiesListe, null, 'Saisies historiques en texte : pas de liste');
assert.equal(lecture.rows[0].saisies, 'Deux épées\nUne bourse');
assert.equal(lecture.rows[0].entreeIso, '2026-09-01T10:00');

prison.validations.set('3:5', ['Art. 34']);
result = plain(ctx.ajouterPrison('GARDE', { ...basePrison, duree: '0,5' }));
assert.equal(prison.colonnes, 12, 'Colonne L créée');
assert.equal(prison.rows[2][4], 'CPL art. 4 — Refus d’obtempérer à une injonction locale');
assert.equal(prison.rows[2][5], 0.5, 'Virgule décimale acceptée');
assert.equal(prison.rows[2][7] - prison.rows[2][6], 30 * 60 * 1000);
assert.deepEqual(JSON.parse(prison.rows[2][9]), [{ id: 'skyrim.esm|00000F', nom: 'Or', quantite: 50 }]);
assert.equal(prison.validations.has('3:5'), false);
assert.equal(JSON.parse(prison.rows[2][11]).chefs[0].article, '4');
assert.deepEqual(result.rows[0].saisiesListe, [{ id: 'skyrim.esm|00000F', nom: 'Or', quantite: 50 }]);
assert.equal(locked, false);
result = plain(ctx.ajouterPrison('GARDE', { ...basePrison, detenu: 'Belethor', duree: '', saisies: [] }));
assert.equal(prison.rows[3][5], '', 'Durée à déterminer');
assert.equal(prison.rows[3][7], '', 'Pas de sortie prévue');
assert.equal(result.rows[0].dureeRaw, null);
assert.deepEqual(result.rows[0].saisiesListe, []);

failFlush = true;
assert.throws(() => ctx.ajouterPrison('GARDE', { ...basePrison, duree: 1 }), /flush/);
assert.ok(prison.rows[4].every(value => value === ''));
assert.equal(locked, false);

const modifPrison = { ...basePrison, cellule: 'IV', duree: 2, entree: '2026-09-29T11:00', notes: 'Récidive', chefs: [{ source: CPL, article: '4' }, { libre: 'Ordre du Jarl' }], attendu: { garde: 'Rorik', detenu: 'Nazeem' } };
assert.throws(() => ctx.modifierPrison('GARDE', 3, modifPrison), /Accès refusé/);
assert.throws(() => ctx.modifierPrison('OFFICIER', 3, { ...modifPrison, attendu: { garde: 'Rorik', detenu: 'Autre' } }), /a changé depuis/);
prison.rows[2][8] = true; // libéré entre-temps
result = plain(ctx.modifierPrison('OFFICIER', 3, { ...modifPrison, saisies: undefined }));
assert.equal(prison.rows[2][3], 'IV');
assert.equal(prison.rows[2][5], 2);
assert.equal(prison.rows[2][7] - prison.rows[2][6], 2 * 60 * 60 * 1000, 'Sortie recalculée');
assert.equal(prison.rows[2][8], true, 'Libéré conservé');
assert.deepEqual(JSON.parse(prison.rows[2][9]), [{ id: 'skyrim.esm|00000F', nom: 'Or', quantite: 50 }], 'Saisies conservées sans envoi');
assert.equal(prison.rows[2][10], 'Récidive');
assert.equal(JSON.parse(prison.rows[2][11]).chefs[1].libre, 'Ordre du Jarl');
ctx.modifierPrison('OFFICIER', 3, { ...modifPrison, saisies: [] });
assert.equal(prison.rows[2][9], '[]', 'Liste vide envoyée : saisies effacées');
// Ligne historique : les saisies en texte restent intactes quand le navigateur ne les renvoie pas.
ctx.modifierPrison('OFFICIER', 2, { date: '2026-09-01', garde: 'Rorik', detenu: 'Ancien', cellule: '', chefs: [{ libre: 'Art. 12 — Vol simple' }], duree: 2, entree: '2026-09-01T12:00', notes: 'Note', attendu: { garde: 'Rorik', detenu: 'Ancien' } });
assert.equal(prison.rows[1][9], 'Deux épées\nUne bourse');
assert.equal(locked, false);
ctx.supprimerPrison('OFFICIER', 2);
assert.ok(prison.rows[1].every(v => v === ''));

console.log('Chefs d’accusation : version du Codex, index, validation, Amendes et Prison (ajout, modification, à déterminer, identité, rollback, colonnes) OK.');
