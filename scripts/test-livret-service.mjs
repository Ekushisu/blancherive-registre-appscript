/*
  Livret de service (`src/LivretService.js`).

  - Réservé à une session Discord de GARDE ou d'OFFICIER : code commun,
    intendance, visiteur et fiche introuvable refusés.
  - Ne renvoie que les données du membre de la session ; lignes rapprochées
    par le nom, sans casse ni espaces superflus.
  - Solde (semaine en cours, en attente, perçue), service (jours, semaines,
    moyenne, série, dernier jour, inactivité), carrière (journal), chaîne de
    commandement, amendes et incarcérations.

    node scripts/test-livret-service.mjs
*/
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Validation « refuser la saisie » simulée : une écriture hors liste échoue,
// comme dans Sheets, y compris par script.
class Sheet {
  constructor(rows) { this.rows = rows; this.regles = new Map(); this.ecritures = []; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return Math.max(...this.rows.map(r => r.length)); }
  getMaxColumns() { return this.getLastColumn(); }
  getRange(row, col, height = 1, width = 1) {
    const sheet = this;
    const cles = () => Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => `${row + i}:${col + j}`));
    const read = () => Array.from({ length: height }, (_, i) =>
      Array.from({ length: width }, (_, j) => sheet.rows[row - 1 + i]?.[col - 1 + j] ?? ''));
    const ecrire = valeurs => valeurs.forEach((ligne, i) => ligne.forEach((v, j) => {
      const regle = sheet.regles.get(`${row + i}:${col + j}`);
      if (regle && !regle.getAllowInvalid() && !regle.liste.includes(v)) {
        throw new Error(`Les données que vous avez saisies dans la cellule ${String.fromCharCode(64 + col + j)}${row + i} ne respectent pas les règles de validation.`);
      }
      sheet.rows[row - 1 + i][col - 1 + j] = v;
      sheet.ecritures.push(`${row + i}:${col + j}`);
    }));
    return {
      getValues: read, setValues: ecrire, setValue: v => ecrire([[v]]),
      getDisplayValues: () => read().map(r => r.map(v => (v === true ? 'TRUE' : v === false ? 'FALSE' : String(v)))),
      getDataValidations: () => cles().map(l => l.map(k => sheet.regles.get(k) || null)),
      clearDataValidations: () => cles().flat().forEach(k => sheet.regles.delete(k)),
      setDataValidation: regle => cles().flat().forEach(k => sheet.regles.set(k, regle))
    };
  }
}

const sessions = {
  eydis: { role: 'GARDE', via: 'discord', membre: 'u-eydis', nom: 'Eydis la Silencieuse' },
  ulfgar: { role: 'OFFICIER', via: 'discord', membre: 'u-ulf', nom: 'Ulfgar Bouclier-Noir' },
  haldvar: { role: 'OFFICIER', via: 'discord', membre: 'u-hal', nom: 'Haldvar de Blancherive' },
  rorik: { role: 'OFFICIER', via: 'discord', membre: 'u-ror', nom: 'Rorik Marche-Hiver' },
  jarl: { role: 'OFFICIER', via: 'discord', membre: 'u-jarl', nom: 'Siddgeir Vent-Doré' },
  huscarl: { role: 'OFFICIER', via: 'discord', membre: 'u-hus', nom: 'Lydia Bras-Fort' },
  fantome: { role: 'GARDE', via: 'discord', membre: 'u-absent', nom: 'Fantôme' },
  code: { role: 'GARDE', via: 'code' },
  intendant: { role: 'INTENDANT', via: 'code' }
};

const membre = (prenom, nom, grade, corps, statut, id, specialite = '') => [prenom, nom, grade, corps, specialite, statut, true, id];
const effectifs = new Sheet([
  ['Prénom', 'Nom', 'Grade', 'Corps', 'Spécialité', 'Statut', 'Assermenté', 'ID membre'],
  membre('Eydis', 'la Silencieuse', 'Sergent', 'Garnison de Rivebois', 'En service actif', 'u-eydis', 'Pisteuse'),
  membre('Brynjar', 'Poing-de-Fer', 'Capitaine', 'Garnison de Rivebois', 'En service actif', 'u-bryn'),
  membre('Sigrid', 'Vent-du-Nord', 'Lieutenant-Chef', 'Garnison de Rivebois', 'En service actif', 'u-sig'),
  membre('Mjoll', 'Main-Sûre', 'Sergent-Chef', 'Garnison de Rivebois', 'Réserve', 'u-mj'),
  membre('Torsten', 'Pierre-Grise', 'Caporal', 'Garnison de Rivebois', 'En service actif', 'u-tor'),
  membre('Haldvar', 'de Blancherive', 'Commander', 'État-Major', 'En service actif', 'u-hal'),
  membre('Ulfgar', 'Bouclier-Noir', 'Lieutenant', 'Hird du Jarl', 'En service actif', 'u-ulf'),
  membre('Rorik', 'Marche-Hiver', 'Capitaine', 'Cité de Blancherive', 'En service actif', 'u-ror'),
  membre('Siddgeir', 'Vent-Doré', 'Jarl', 'État-Major', 'En service actif', 'u-jarl'),
  membre('Lydia', 'Bras-Fort', 'Huscarl', 'Cité de Blancherive', 'En service actif', 'u-hus')
]);
effectifs.rows[1][6] = false;
const GRADES = ['Jarl', 'Huscarl', 'Commander', 'Major', 'Capitaine', 'Lieutenant-Chef', 'Lieutenant', 'Sergent-Chef', 'Sergent', 'Caporal', 'Garde'];
const donnees = new Sheet([['Grade'], ...GRADES.map(g => [g])]);

const evt = (id, date, membreId, type, changes = []) => [id, date, membreId, type, '', JSON.stringify(changes), '{}', 'Détection'];
const journal = new Sheet([
  ['ID événement', 'Date ISO', 'ID membre', 'Type', 'Nom', 'Changements JSON', 'État JSON', 'Source'],
  evt('e0', '2026-09-06T12:00:00.000Z', '', 'initialisation'),
  evt('e1', '2026-09-06T12:00:00.000Z', 'u-eydis', 'reference'),
  evt('e2', '2026-09-06T12:00:00.000Z', 'u-bryn', 'reference'),
  evt('e3', '2026-09-20T10:00:00.000Z', 'u-eydis', 'changement', [{ type: 'grade', avant: 'Caporal', apres: 'Sergent' }]),
  evt('e4', '2026-10-01T10:00:00.000Z', 'u-eydis', 'changement', [{ type: 'corps', avant: 'Cité de Blancherive', apres: 'Garnison de Rivebois' }]),
  evt('e5', '2026-10-02T10:00:00.000Z', 'u-bryn', 'changement', [{ type: 'grade', avant: 'Lieutenant', apres: 'Capitaine' }]),
  evt('e6', '2026-10-03T10:00:00.000Z', 'u-ror', 'changement', [{ type: 'arrivee', avant: '', apres: 'Rorik Marche-Hiver' }])
]);

const T = true, F = false;
const semaine = (lundi, prenom, nom, jours, n, solde, paye, corps = 'Garnison de Rivebois') =>
  [lundi, corps, 'Sergent', prenom, nom, ...jours, n, solde, paye];
const presences = new Sheet([
  ['Lundi', 'Corps', 'Grade', 'Prénom', 'Nom', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim', 'Jours', 'Solde', 'Payé'],
  semaine('2026-09-14', 'Eydis', 'la Silencieuse', [T, F, F, F, F, F, F], 1, 40, F),
  semaine('2026-09-21', 'Eydis', 'la Silencieuse', [F, F, F, F, F, F, F], 0, 0, F),
  semaine('2026-09-28', 'Eydis', 'la Silencieuse', [T, T, T, T, F, F, F], 4, 160, T),
  semaine('2026-10-05', ' EYDIS ', 'la  silencieuse', [F, T, T, T, F, F, F], 3, 120, F),
  semaine('2026-10-12', 'Eydis', 'la Silencieuse', [T, T, F, F, F, F, F], 2, 80, F),
  semaine('2026-10-05', 'Brynjar', 'Poing-de-Fer', [T, T, T, T, T, T, T], 7, 999, F),
  semaine('2026-10-12', 'Ulfgar', 'Bouclier-Noir', [T, F, F, F, F, F, F], 1, 0, F, 'Hird du Jarl')
]);
const amendes = new Sheet([
  ['Date', 'Garde', 'Contrevenant', 'Infraction', 'Montant', 'Payé', 'Reversé'],
  ['01/10/2026', 'Eydis la Silencieuse ', 'Nazeem', 'CPL art. 16 — Injure', 100, F, F],
  ['02/10/2026', 'Eydis la Silencieuse', 'Belethor', 'CPL art. 4 — Refus', '', F, F],
  ['03/10/2026', 'Eydis la Silencieuse', 'Heimskr', 'CPL art. 16 — Injure', 200, T, F],
  ['04/10/2026', 'eydis la silencieuse', 'Ysolda', 'CPL art. 16 — Injure', 50, T, T],
  ['05/10/2026', 'Brynjar Poing-de-Fer', 'Contrevenant de Brynjar', 'CPL art. 16 — Injure', 999, F, F]
]);
const prison = new Sheet([
  ['Date', 'Garde', 'Détenu', 'Cellule', 'Infraction', 'Durée', 'Entrée', 'Sortie', 'Libéré'],
  ['01/10/2026', 'Eydis la Silencieuse', 'Nazeem', 'I', 'CPL art. 4', 2, '01/10/2026 10:00', '01/10/2026 12:00', T],
  ['06/10/2026', 'Eydis la Silencieuse', 'Belethor', 'III', 'CPL art. 4', 48, '06/10/2026 10:00', '08/10/2026 10:00', F],
  ['07/10/2026', 'Brynjar Poing-de-Fer', 'Détenu de Brynjar', 'II', 'CPL art. 4', 1, '', '', F]
]);
const feuilles = new Map([['Effectifs', effectifs], ['Données', donnees], ['HistoriqueEffectifs', journal],
  ['Présences', presences], ['Amendes', amendes], ['Prison', prison]]);
const ss = { getSheetByName: n => feuilles.get(n) || null };

let soldesMisAJour = 0;
const context = vm.createContext({
  console, Date, Math, JSON,
  requireRole(token, roles) {
    const auth = sessions[token];
    if (!auth || !roles.includes(auth.role)) throw Error("Vous n'avez pas les droits nécessaires.");
    return auth;
  },
  SpreadsheetApp: { openById: () => ss, flush() {} },
  Utilities: { formatDate: () => '' },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) }
});
for (const f of ['Code.js', 'Effectifs.js', 'Discord.js', 'AliasGrades.js', 'Organigramme.js', 'Presences.js', 'Paye.js',
  'PresenceDashboard.gs.js', 'Amendes.js', 'Prison.js', 'LivretService.js']) {
  vm.runInContext(readFileSync(`src/${f}`, 'utf8'), context);
}
// Horloge et effets de bord fixés : mercredi 14 octobre 2026.
let aujourdHui = '2026-10-14', lundi = '2026-10-12';
context.dateCivileStockholm_ = () => aujourdHui;
context.lundiCourantPresence_ = () => lundi;
context.mettreAJourSoldesPresences_ = () => { soldesMisAJour++; };
context.lireAliasGrades_ = () => ({});
const livret = token => JSON.parse(JSON.stringify(context.getLivretService(token)));

// ---------------------------------------------------------------- accès
assert.throws(() => context.getLivretService('code'), /n'existe que pour une connexion par Discord/);
assert.throws(() => context.getLivretService('intendant'), /droits nécessaires/);
assert.throws(() => context.getLivretService('visiteur'), /droits nécessaires/);
assert.throws(() => context.getLivretService('fantome'), /fiche est introuvable/);

// ---------------------------------------------------------------- fiche et commandement
let l = livret('eydis');
assert.deepEqual(l.fiche, { prenom: 'Eydis', nom: 'la Silencieuse', nomComplet: 'Eydis la Silencieuse', grade: 'Sergent',
  corps: 'Garnison de Rivebois', specialite: 'Pisteuse', statut: 'En service actif', assermente: false });
assert.deepEqual(l.commandement.corps.map(p => p.nomComplet), ['Brynjar Poing-de-Fer', 'Sigrid Vent-du-Nord'],
  'Supérieurs du corps, en service, à partir de Sergent-Chef, du plus haut au plus bas ; ni réserve, ni subordonné');
assert.deepEqual(l.commandement.etatMajor.map(p => p.nomComplet), ['Haldvar de Blancherive'],
  'Le Jarl, même inscrit à l’État-Major, est rendu à part');
const jarl = [{ nomComplet: 'Siddgeir Vent-Doré', grade: 'Jarl', corps: 'État-Major' }];
assert.deepEqual(l.commandement.jarl, jarl, 'Le Jarl au sommet de chaque chaîne');
assert.deepEqual(livret('haldvar').commandement, { corps: [], etatMajor: [], jarl }, 'L’État-Major ne se voit pas lui-même');
assert.deepEqual(livret('ulfgar').commandement.etatMajor, [], 'Le Hird ne répond qu’au Jarl');
assert.deepEqual(livret('ulfgar').commandement.jarl, jarl);
// Le Huscarl ne répond qu'au Jarl et n'entre dans la chaîne de personne.
assert.deepEqual(livret('huscarl').commandement, { corps: [], etatMajor: [], jarl });
assert.deepEqual(livret('rorik').commandement.corps, [], 'Le Huscarl n’est pas un supérieur de son corps');
assert.deepEqual(livret('jarl').commandement, { corps: [], etatMajor: [], jarl: [] }, 'Le Jarl n’a pas de supérieur');

// ---------------------------------------------------------------- carrière
assert.equal(l.carriere.inscription, '2026-09-06T12:00:00.000Z');
assert.equal(l.carriere.avantJournal, true, 'Déjà là à l’ouverture du journal : arrivée réelle inconnue');
assert.deepEqual(l.carriere.evenements.map(e => e.type + ':' + e.apres), ['corps:Garnison de Rivebois', 'grade:Sergent'],
  'Ses seuls changements, du plus récent au plus ancien');

// ---------------------------------------------------------------- solde et service
const s = l.service;
assert.equal(soldesMisAJour > 0, true, 'Soldes recalculées avant lecture');
assert.equal(s.exclu, false);
assert.deepEqual(s.semaineCourante, { lundi: '2026-10-12', jours: [T, T, F, F, F, F, F], joursPresents: 2, solde: 80, financeur: 'Thane de Rivebois' });
assert.deepEqual(s.enAttente.map(e => [e.lundi, e.solde, e.financeur]), [['2026-10-05', 120, 'Thane de Rivebois'], ['2026-09-14', 40, 'Thane de Rivebois']],
  'Semaines closes, solde due, non réglées ; nom rapproché sans casse ni espaces');
assert.equal(s.totalEnAttente, 160);
assert.equal(s.totalPercu, 160);
assert.equal(s.derniereSemaineReglee, '2026-09-28');
assert.equal(s.joursTotal, 10);
assert.equal(s.semainesServies, 4);
assert.equal(s.moyenne, 2.5);
assert.equal(s.serie, 3, 'Semaine en cours servie, puis 05/10 et 28/09 ; le 21/09 rompt la série');
assert.equal(s.dernierJour, '2026-10-13', 'Mardi de la semaine en cours');
assert.equal(s.joursDepuis, 1);
assert.equal(s.inactif, false);
assert.equal(s.seuilInactivite, 5);

// Dix jours plus tard, sans pointage : inactivité signalée, série depuis la semaine passée.
aujourdHui = '2026-10-25'; lundi = '2026-10-19';
const tard = livret('eydis').service;
assert.equal(tard.semaineCourante, null);
assert.equal(tard.joursDepuis, 12);
assert.equal(tard.inactif, true);
assert.equal(tard.serie, 3, 'Semaine en cours vide : la série part de la précédente');
assert.equal(tard.enAttente.length, 3, 'La semaine du 12/10 est close à son tour');
aujourdHui = '2026-10-14'; lundi = '2026-10-12';

// Le Hird n'est pas soldé par le registre.
const hird = livret('ulfgar').service;
assert.equal(hird.exclu, true);
assert.equal(hird.semaineCourante, null);
assert.equal(hird.joursTotal, 0);
// Le Jarl non plus, quel que soit son corps ; le Huscarl l'est.
assert.equal(livret('jarl').service.exclu, true);
assert.equal(livret('huscarl').service.exclu, false);

// ---------------------------------------------------------------- justice
const a = l.justice.amendes;
assert.equal(a.nombre, 4);
assert.equal(a.total, 350);
assert.deepEqual(a.aEncaisser, { nombre: 2, total: 100, aDeterminer: 1 });
assert.deepEqual(a.aReverser, { nombre: 1, total: 200 });
assert.deepEqual(a.dernieres.map(d => d.contrevenant), ['Ysolda', 'Heimskr', 'Belethor', 'Nazeem'], 'Plus récentes d’abord');
assert.equal(a.dernieres[2].montant, null, 'Montant à déterminer');
const p = l.justice.prison;
assert.equal(p.nombre, 2);
assert.deepEqual(p.enCellule.map(d => d.detenu), ['Belethor']);
assert.deepEqual(p.dernieres.map(d => d.detenu), ['Belethor', 'Nazeem']);

// ---------------------------------------------------------------- confidentialité
const brut = JSON.stringify({ service: l.service, justice: l.justice, carriere: l.carriere });
for (const autre of ['999', 'Contrevenant de Brynjar', 'Détenu de Brynjar', 'Lieutenant', 'arrivee']) {
  assert.ok(!brut.includes(autre), `Aucune donnée d’un autre membre : ${autre}`);
}

// ---------------------------------------------------------------- renommage d'un garde
// Colonne Garde d'Amendes et de Prison : les seules cases de ce garde, lignes
// rapprochées comme le Livret ; contrevenants, détenus et autres gardes intacts.
const garde = sheet => sheet.rows.slice(1).map(r => r[1]);
const contrevenants = amendes.rows.map(r => r[2]).join('|');
// Validation « refuser » sur toute la colonne, liste des gardes actifs : ni le
// nouveau nom, ni un ancien garde parti n'y figurent.
const regleGardes = { liste: ['Eydis la Silencieuse', 'Brynjar Poing-de-Fer'], getAllowInvalid: () => false };
amendes.rows.push(['06/10/2026', 'Garde Parti', 'Lydia', 'CPL art. 16 — Injure', 10, F, F]);
for (const feuille of [amendes, prison]) {
  for (let r = 2; r <= feuille.rows.length; r++) feuille.regles.set(`${r}:2`, regleGardes);
  feuille.ecritures = [];
}
assert.equal(context.renommerGardeRegistres_(ss, 'Eydis la Silencieuse', 'Eydis Brise-Nuit'), 6, 'Quatre amendes, deux incarcérations');
assert.deepEqual(garde(amendes), [...Array(4).fill('Eydis Brise-Nuit'), 'Brynjar Poing-de-Fer', 'Garde Parti']);
assert.deepEqual(garde(prison), ['Eydis Brise-Nuit', 'Eydis Brise-Nuit', 'Brynjar Poing-de-Fer']);
assert.equal(amendes.rows.slice(0, 6).map(r => r[2]).join('|'), contrevenants);
assert.deepEqual(amendes.ecritures, ['2:2', '3:2', '4:2', '5:2'], 'Ni Brynjar ni le garde parti ne sont réécrits');
assert.ok([amendes, prison].every(f => [...f.regles.values()].length === f.rows.length - 1 && [...f.regles.values()].every(r => r === regleGardes)),
  'Validation remise sur chaque case réécrite');
// Reprise d'un renommage interrompu : des lignes portent déjà le nouveau nom.
amendes.rows[1][1] = 'Eydis la Silencieuse';
assert.equal(context.renommerGardeRegistres_(ss, 'Eydis la Silencieuse', 'Eydis Brise-Nuit'), 1);
assert.deepEqual(garde(amendes), [...Array(4).fill('Eydis Brise-Nuit'), 'Brynjar Poing-de-Fer', 'Garde Parti']);
assert.equal(context.renommerGardeRegistres_(ss, 'Personne', 'Quelqu’un'), 0);

console.log('Livret de service : accès, fiche, commandement, carrière, solde, service, justice et confidentialité validés.');
