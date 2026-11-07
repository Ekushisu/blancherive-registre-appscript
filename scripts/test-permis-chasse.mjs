// Vérifie le registre des permis de chasse : droits, création de la feuille,
// délivrance, doublons, révocation sous identité, compaction et robustesse.
//
//   node scripts/test-permis-chasse.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sheets = new Map();
let reads = 0, writes = 0, held = false, failFlush = false;

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
      getDisplayValues() { return this.getValues().map(row => row.map(v => v instanceof Date ? iso(v) : String(v ?? ''))); },
      setValues(values) {
        writes++;
        values.forEach((row, i) => row.forEach((v, j) => { (sheet.rows[r + i - 1] ||= [])[c + j - 1] = v; }));
        return range;
      },
      setNumberFormat() { return range; }, setFontWeight() { return range; }
    };
    return range;
  }
}

const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const ss = {
  getSheetByName: name => sheets.get(name) || null,
  insertSheet(name) { assert.ok(!sheets.has(name), `${name} créée deux fois`); assert.ok(held, 'Création de feuille sous verrou'); const s = new Sheet(name); sheets.set(name, s); return s; }
};

const context = vm.createContext({
  Date, console, SPREADSHEET_ID: 'test',
  requireRole(token, roles) { if (!roles.includes(token)) throw Error('Accès refusé'); return { role: token }; },
  SpreadsheetApp: { openById() { reads++; return ss; }, flush() { if (failFlush) { failFlush = false; throw Error('Flush en échec'); } } },
  LockService: { getScriptLock: () => ({ waitLock() { assert.equal(held, false, 'Pas de verrou imbriqué'); held = true; }, releaseLock() { held = false; } }) },
  Utilities: { formatDate: (date, tz, format) => { assert.equal(format, 'yyyy-MM-dd'); return iso(date); } }
});
for (const f of ['Amendes.js', 'PermisChasse.js']) vm.runInContext(readFileSync(`src/${f}`, 'utf8'), context);

const plain = x => JSON.parse(JSON.stringify(x));
const lire = role => plain(context.getPermisChasse(role));
const ajouter = (role, data) => plain(context.ajouterPermisChasse(role, data));
const revoquer = (role, row, attendu) => plain(context.revoquerPermisChasse(role, row, attendu));
const aujourdhui = iso(new Date());
const demain = iso(new Date(Date.now() + 86400000));


// ============================================================
// DROITS — refusés avant toute lecture Sheets
// ============================================================

for (const role of ['INTENDANT', 'VISITEUR', 'intrus']) {
  assert.throws(() => context.getPermisChasse(role), /Accès refusé/, `${role} ne lit pas les permis`);
  assert.throws(() => context.ajouterPermisChasse(role, { prenom: 'Sven', date: aujourdhui }), /Accès refusé/, `${role} ne délivre pas`);
}
for (const role of ['GARDE', 'INTENDANT', 'VISITEUR', 'intrus']) {
  assert.throws(() => context.revoquerPermisChasse(role, 2, { prenom: 'Sven', nom: '', date: aujourdhui }), /Accès refusé/, `${role} ne révoque pas`);
}
assert.equal(reads, 0, 'Le refus précède toute lecture Sheets');


// ============================================================
// FEUILLE — créée à la première consultation, jamais réécrite
// ============================================================

let registre = lire('GARDE');
assert.deepEqual(registre, { permis: [] });
const sheet = sheets.get('PermisChasse');
assert.deepEqual(sheet.rows[0], ['Prénom', 'Nom', 'Date de délivrance']);
assert.equal(held, false, 'Verrou libéré après création');

sheet.rows[0][2] = 'Date';
assert.throws(() => lire('OFFICIER'), /PermisChasse doit contenir les colonnes/, 'En-têtes différents : aucun remplacement');
assert.equal(sheet.rows[0][2], 'Date', 'Aucune correction destructive');
sheet.rows[0][2] = 'Date de délivrance';


// ============================================================
// DÉLIVRANCE — validation
// ============================================================

assert.throws(() => ajouter('GARDE', null), /Données du permis manquantes/);
assert.throws(() => ajouter('GARDE', { prenom: '   ', date: aujourdhui }), /prénom du titulaire est obligatoire/);
assert.throws(() => ajouter('GARDE', { prenom: 'a'.repeat(61), date: aujourdhui }), /60 caractères/);
assert.throws(() => ajouter('GARDE', { prenom: 'Sven', nom: 'b'.repeat(81), date: aujourdhui }), /80 caractères/);
assert.throws(() => ajouter('GARDE', { prenom: '=HYPERLINK()', date: aujourdhui }), /signe égal/);
assert.throws(() => ajouter('GARDE', { prenom: 'Sven', nom: '=1+1', date: aujourdhui }), /signe égal/);
assert.throws(() => ajouter('GARDE', { prenom: 'Sven' }), /Format de date invalide/);
assert.throws(() => ajouter('GARDE', { prenom: 'Sven', date: '02/11/2026' }), /Format de date invalide/);
assert.throws(() => ajouter('GARDE', { prenom: 'Sven', date: '2026-02-30' }), /Date invalide/);
assert.throws(() => ajouter('GARDE', { prenom: 'Sven', date: demain }), /dans l'avenir/);
assert.equal(sheet.getLastRow(), 1, 'Rien écrit sur validation refusée');
assert.equal(held, false);


// ============================================================
// DÉLIVRANCE — écriture, nom facultatif, doublons
// ============================================================

registre = ajouter('GARDE', { prenom: '  Sven ', nom: ' Fer-Froid  ', date: '2026-10-20' });
assert.deepEqual(registre.permis, [{ row: 2, prenom: 'Sven', nom: 'Fer-Froid', date: '2026-10-20' }], 'Espaces normalisés');
assert.equal(sheet.rows[1][0], 'Sven');
assert.equal(sheet.rows[1][1], 'Fer-Froid');
assert.ok(sheet.rows[1][2] instanceof Date, 'La date est une vraie date de cellule');
assert.equal(iso(sheet.rows[1][2]), '2026-10-20');
assert.equal(held, false);

registre = ajouter('OFFICIER', { prenom: 'Lydia', date: aujourdhui });
assert.equal(registre.permis.length, 2);
assert.deepEqual(registre.permis[0], { row: 3, prenom: 'Lydia', nom: '', date: aujourdhui }, 'Nom facultatif, plus récent en tête');
assert.equal(sheet.rows[2][1], '', 'Nom vide écrit vide');

assert.throws(() => ajouter('GARDE', { prenom: 'sven', nom: 'FER-FROID', date: aujourdhui }), /déjà enregistré au nom de « Sven Fer-Froid », délivré le 20\/10\/2026/, 'Doublon sans casse');
assert.throws(() => ajouter('GARDE', { prenom: 'Lydia', nom: '', date: '2026-01-01' }), /déjà enregistré au nom de « Lydia »/);
assert.equal(sheet.getLastRow(), 3, 'Doublon : rien écrit');
assert.equal(held, false);

// Homonyme : un nom différent distingue deux personnes.
registre = ajouter('GARDE', { prenom: 'Lydia', nom: 'de Blancherive', date: '2026-10-20' });
assert.equal(registre.permis.length, 3);
assert.deepEqual(registre.permis.map(p => `${p.prenom} ${p.nom}`.trim()), ['Lydia', 'Lydia de Blancherive', 'Sven Fer-Froid'], 'Date décroissante, puis prénom et nom');

// Accents : « Élodie » et « Elodie » sont la même personne.
ajouter('GARDE', { prenom: 'Élodie', date: '2026-09-01' });
assert.throws(() => ajouter('GARDE', { prenom: 'Elodie', date: '2026-09-01' }), /déjà enregistré/);


// ============================================================
// RÉVOCATION — identité exigée, bloc compacté
// ============================================================

const avantRevocation = JSON.stringify(sheet.rows);
assert.throws(() => revoquer('OFFICIER', 1, { prenom: 'Sven', nom: 'Fer-Froid', date: '2026-10-20' }), /Ligne de permis invalide/);
assert.throws(() => revoquer('OFFICIER', 'deux', { prenom: 'Sven', nom: 'Fer-Froid', date: '2026-10-20' }), /Ligne de permis invalide/);
assert.throws(() => revoquer('OFFICIER', 2), /Rechargez la page/);
assert.throws(() => revoquer('OFFICIER', 2, { prenom: 'Sven', nom: 'Fer-Froid' }), /Rechargez la page/);
assert.throws(() => revoquer('OFFICIER', 2, { prenom: 'Lydia', nom: '', date: '2026-10-20' }), /a changé ou a déjà été révoqué/, 'Identité différente : refus');
assert.throws(() => revoquer('OFFICIER', 50, { prenom: 'Sven', nom: 'Fer-Froid', date: '2026-10-20' }), /a changé ou a déjà été révoqué/);
assert.equal(JSON.stringify(sheet.rows), avantRevocation, 'Aucune écriture sur refus');
assert.equal(held, false);

registre = revoquer('OFFICIER', 2, { prenom: 'Sven', nom: 'Fer-Froid', date: '2026-10-20' });
assert.equal(registre.permis.some(p => p.prenom === 'Sven'), false, 'Permis retiré');
assert.deepEqual(registre.permis.map(p => p.row), [2, 3, 4], 'Lignes renumérotées après compaction');
assert.deepEqual(sheet.rows[1].slice(0, 2), ['Lydia', ''], 'Bloc compacté : première ligne réoccupée');
assert.deepEqual(sheet.rows[4], ['', '', ''], 'Ancienne dernière ligne vidée');
assert.equal(sheet.getLastRow(), 4);
assert.equal(held, false);

// Une page restée ouverte sur l'ancien numéro de ligne ne révoque rien d'autre.
assert.throws(() => revoquer('OFFICIER', 4, { prenom: 'Lydia', nom: 'de Blancherive', date: '2026-10-20' }), /a changé ou a déjà été révoqué/);

// Sven peut recevoir un nouveau permis après révocation.
registre = ajouter('GARDE', { prenom: 'Sven', nom: 'Fer-Froid', date: aujourdhui });
assert.equal(registre.permis.length, 4);
assert.equal(sheet.getLastRow(), 5);


// ============================================================
// ROBUSTESSE — échec d'écriture, feuille éditée à la main
// ============================================================

// La restauration réécrit la plage lue, ligne vide de fin comprise : on compare le contenu, pas le remplissage.
const contenu = () => JSON.stringify(sheet.rows.filter(r => r.some(v => v !== '')));
let avant = contenu();
failFlush = true;
assert.throws(() => ajouter('GARDE', { prenom: 'Ralof', date: aujourdhui }), /Flush/);
assert.equal(contenu(), avant, 'Ligne restaurée après échec de délivrance');
assert.equal(held, false, 'Verrou libéré après échec');

avant = contenu();
failFlush = true;
assert.throws(() => revoquer('OFFICIER', 2, { prenom: 'Lydia', nom: '', date: aujourdhui }), /Flush/);
assert.equal(contenu(), avant, 'Bloc restauré après échec de révocation');
assert.equal(held, false);

// Dates saisies à la main en texte : dd/MM/yyyy et yyyy-MM-dd sont lues.
sheet.rows.push(['Ralof', 'de Rivebois', '3/9/2026']);
sheet.rows.push(['Hadvar', '', '2026-09-04']);
registre = lire('GARDE');
assert.equal(registre.permis.find(p => p.prenom === 'Ralof').date, '2026-09-03');
assert.equal(registre.permis.find(p => p.prenom === 'Hadvar').date, '2026-09-04');

// Ligne vide ignorée ; ligne sans date ou sans prénom signalée par sa ligne physique.
sheet.rows.push(['', '', '']);
assert.equal(lire('GARDE').permis.length, 6, 'Ligne vide ignorée');
// Les restaurations ont laissé des lignes vides en fin de bloc : la ligne
// signalée est la ligne physique, celle que l'officier ouvrira dans Sheets.
const ligneInvalide = new RegExp(`Ligne ${sheet.rows.length + 1} de la feuille PermisChasse invalide`);
sheet.rows.push(['Sans date', '', '']);
assert.throws(() => lire('GARDE'), ligneInvalide);
sheet.rows.pop();
sheet.rows.push(['', 'Sans prénom', '2026-09-04']);
assert.throws(() => lire('GARDE'), ligneInvalide);
sheet.rows.pop();
sheet.rows.push(['Mauvaise date', '', 'hier']);
assert.throws(() => lire('GARDE'), ligneInvalide);
sheet.rows.pop();
sheet.rows.pop();

// Une révocation compacte aussi les lignes écrites à la main.
registre = revoquer('OFFICIER', registre.permis.find(p => p.prenom === 'Ralof').row, { prenom: 'Ralof', nom: 'de Rivebois', date: '2026-09-03' });
assert.equal(registre.permis.some(p => p.prenom === 'Ralof'), false);
assert.ok(sheet.rows[registre.permis.find(p => p.prenom === 'Hadvar').row - 1][2] instanceof Date, 'Date texte réécrite en date de cellule');

// Révoquer le dernier permis laisse un bloc vide, sans erreur. Chaque
// révocation renumérote les lignes : on relit le registre entre deux.
for (let liste = lire('OFFICIER').permis; liste.length; liste = lire('OFFICIER').permis) {
  const p = liste[0];
  revoquer('OFFICIER', p.row, { prenom: p.prenom, nom: p.nom, date: p.date });
}
assert.deepEqual(lire('OFFICIER'), { permis: [] });
assert.equal(sheet.getLastRow(), 1, 'Feuille réduite à ses en-têtes');
assert.ok(writes > 0);

console.log('Permis de chasse : droits, feuille, délivrance, doublons, révocation sous identité, compaction, rollback et dates manuelles OK.');
