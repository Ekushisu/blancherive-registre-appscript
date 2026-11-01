/*
  Journal du Codex (`src/JournalCodex.js`, `synchroniserCodex()` de
  `src/SyncCodex.js`, `getCodex` de `src/Codex.js`).

  - Comparaison avant / après : ajout, modification (champs, blancs ignorés),
    retrait (texte gardé), documents ajoutés, retirés, illisibles.
  - Synchronisation complète simulée : un document illisible garde ses
    articles et n'est pas annoncé abrogé ; compte rendu dans la feuille et au
    journal d'exécution.
  - Lecture : passages du plus récent au plus ancien, plafond de changements.
  - `getCodex` : journal renvoyé à tous, visiteur compris ; version changée
    à chaque passage.
  - Bouton des officiers : rôle vérifié avant tout, délai de trois minutes
    pour le seul bouton, jamais pour l'éditeur.

    node scripts/test-journal-codex.mjs
*/
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

class Sheet {
  constructor(name, rows = []) { this.name = name; this.rows = rows.map(r => r.slice()); this.formats = []; }
  getName() { return this.name; }
  getLastRow() {
    let n = this.rows.length;
    while (n > 0 && !(this.rows[n - 1] || []).some(v => v !== '' && v !== undefined && v !== null)) n--;
    return n;
  }
  getLastColumn() {
    return Math.max(0, ...this.rows.map(r => {
      let n = (r || []).length;
      while (n > 0 && (r[n - 1] === '' || r[n - 1] === undefined || r[n - 1] === null)) n--;
      return n;
    }));
  }
  getMaxColumns() { return 30; }
  insertColumnsAfter() {}
  setFrozenRows() {}
  setColumnWidth() {}
  getRange(row, col, h = 1, w = 1) {
    const sheet = this;
    const lire = () => Array.from({ length: h }, (_, i) => Array.from({ length: w }, (_, j) => sheet.rows[row - 1 + i]?.[col - 1 + j] ?? ''));
    const range = {
      getValues: lire,
      getDisplayValues: () => lire().map(r => r.map(v => (v === true ? 'TRUE' : v === false ? 'FALSE' : String(v)))),
      setValues(valeurs) { valeurs.forEach((l, i) => l.forEach((v, j) => { (sheet.rows[row - 1 + i] ||= [])[col - 1 + j] = v; })); return range; },
      clearContent() { for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) if (sheet.rows[row - 1 + i]) sheet.rows[row - 1 + i][col - 1 + j] = ''; return range; },
      setFontWeight() { return range; },
      setWrap() { return range; },
      setNumberFormat(format) { sheet.formats.push(format); return range; }
    };
    return range;
  }
}

// ---------------------------------------------------------------- état d'avant
const article = (source, numero, titre, texte, sanction = '', classification = '') =>
  ({ source, article: numero, titre, classification, amende: '', travaux: '', cachot: '', sanction, texte, alerte: '' });
const ligne = a => [a.source, a.article, a.titre, a.classification, a.amende, a.travaux, a.cachot, a.sanction, a.texte, a.alerte];
const AVANT = [
  article('Code A', '1', 'Vol', 'Le vol est puni.', 'Amende de 100 septims', 'Délit'),
  article('Code A', '2', 'Injure', 'L’injure est punie.'),
  article('Code A', '3', 'Ancien article', 'Texte abrogé.'),
  article('Décret B', '1', 'Couvre-feu', 'Nul ne sort après minuit.'),
  article('Décret D', '1', 'Taxe', 'La taxe est due.')
];
const syncCodex = new Sheet('SyncCodex', [
  ['Source', 'Article', 'Titre', 'Classification', 'Amende', 'Travaux forcés (heures)', 'Cachot (heures)', 'Sanction complète', 'Texte', 'Alerte parsing'],
  ...AVANT.map(ligne)
]);
// Cache des documents (R) : A, B et D.
[['Source'], ['Code A'], ['Décret B'], ['Décret D']].forEach((cellule, i) => { syncCodex.rows[i][17] = cellule[0]; });

const feuilles = new Map([['SyncCodex', syncCodex]]);
const ss = {
  getSheetByName: n => feuilles.get(n) || null,
  insertSheet: n => { const s = new Sheet(n); feuilles.set(n, s); return s; }
};

// ---------------------------------------------------------------- contexte
const proprietes = new Map();
const cache = new Map();
const publications = [];
const journalExecution = [];
let ouvertures = 0;
const context = vm.createContext({
  console: { log: m => journalExecution.push(String(m)), warn: m => journalExecution.push(String(m)), error: m => journalExecution.push(String(m)) },
  Date, Math, JSON, String, Number, Array, Object, Map, Set,
  ROLE_PUBLIC: 'VISITEUR',
  SPREADSHEET_ID: 'test',
  requireRole(token, roles) {
    if (!roles.includes(token)) throw new Error("Vous n'avez pas les droits nécessaires.");
    return { role: token };
  },
  SpreadsheetApp: { openById: () => { ouvertures++; return ss; }, flush() {} },
  LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) },
  PropertiesService: { getScriptProperties: () => ({
    getProperty: k => (proprietes.has(k) ? proprietes.get(k) : null),
    setProperty: (k, v) => proprietes.set(k, String(v))
  }) },
  CacheService: { getScriptCache: () => ({
    put: (k, v) => { cache.set(k, v); publications.push(JSON.parse(v)); },
    get: k => (cache.has(k) ? cache.get(k) : null)
  }) },
  DocumentApp: { openById: id => { if (id === 'doc-b') throw new Error('Accès refusé au document.'); return { id }; } },
  Utilities: {
    DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (algo, texte) => Array.from(createHash(algo).update(texte, 'utf8').digest()),
    base64EncodeWebSafe: octets => Buffer.from(octets).toString('base64url')
  }
});
for (const f of ['SyncCodex.js', 'Codex.js', 'JournalCodex.js']) vm.runInContext(readFileSync(`src/${f}`, 'utf8'), context);

// Registre et extraction simulés : A modifié, B illisible, C nouveau, D retiré.
const document = (id, source) => ({ id, source, famille: 'Droit de Blancherive', autorite: 'Jarl', applicabilite: '', local: true, garde: true, sanctions: true });
context.lireDocumentsCodex_ = () => [document('doc-a', 'Code A'), document('doc-b', 'Décret B'), document('doc-c', 'Décret C')];
let extraits = {
  'doc-a': [
    article('Code A', '1', 'Vol', 'Le vol  est\npuni.', 'Amende de 100 septims', 'Délit'),
    article('Code A', '2', 'Injure publique', 'L’injure publique est punie.'),
    { ...article('Code A', '4', 'Recel', 'Le recel est puni.'), alerte: 'Sanction illisible' }
  ],
  'doc-c': [article('Décret C', '1', 'Port d’arme', 'Le port d’arme est réglementé.')]
};
context.extraireArticlesCodex_ = (doc, config) => (extraits[doc.id] || []).map(a => ({ ...a, source: config.source }));
// Listes déroulantes L:O : hors sujet ici.
context.ecrireCachesTechniquesCodex_ = () => {};
const brut = valeur => JSON.parse(JSON.stringify(valeur));

// ---------------------------------------------------------------- comparaison
const comparaison = brut(context.comparerArticlesCodex_(AVANT.slice(0, 3), [
  article('Code A', '1', 'Vol', ' Le vol est   puni. ', 'Amende de 100 septims', 'Délit'),
  article('Code A', '2', 'Insulte', 'L’injure est punie.', 'Amende de 50 septims')
]));
assert.deepEqual(comparaison.map(c => [c.type, c.article, c.champs.join(',')]),
  [['modification', '2', 'titre,sanction'], ['retrait', '3', '']], 'Blancs ignorés ; titre corrigé = modification');
assert.deepEqual(comparaison[0].avant, { titre: 'Injure', sanction: '' });
assert.deepEqual(comparaison[0].apres, { titre: 'Insulte', sanction: 'Amende de 50 septims' });
assert.equal(comparaison[1].avant.texte, 'Texte abrogé.', 'Un article retiré garde son texte');
assert.deepEqual(brut(context.comparerDocumentsCodex_([], ['X'])), [], 'Sans cache des documents, rien à comparer');
assert.deepEqual(brut(context.comparerDocumentsCodex_(['X', 'Y'], ['Y', 'Z'])).map(c => c.type + ':' + c.source),
  ['document-ajout:Z', 'document-retrait:X']);
const long = context.celluleJsonJournalCodex_({ titre: 'Long', texte: 'x'.repeat(60000) });
assert.ok(long.length <= 45000 && JSON.parse(long).tronque === true && JSON.parse(long).texte.endsWith('…'), 'Texte tronqué pour tenir dans une cellule');

// ---------------------------------------------------------------- synchronisation complète
const resultat = brut(context.synchroniserCodex());
assert.deepEqual(resultat.changements, { ajouts: 2, modifications: 1, retraits: 2, documentsAjoutes: 1, documentsRetires: 1, documentsIllisibles: 1 });
assert.deepEqual(resultat.erreurs, ['Décret B : Accès refusé au document.']);
const apres = syncCodex.rows.slice(1).filter(r => r[0]).map(r => `${r[0]}|${r[1]}`);
assert.deepEqual(apres, ['Code A|1', 'Code A|2', 'Code A|4', 'Décret B|1', 'Décret C|1'],
  'Le document illisible garde ses articles, à leur place');

const journal = feuilles.get('JournalCodex');
assert.ok(journal, 'Feuille JournalCodex créée');
assert.deepEqual(journal.rows[0], ['Synchronisation', 'Type', 'Source', 'Article', 'Titre', 'Champs', 'Avant', 'Après']);
assert.ok(journal.formats.includes('@'), 'Écrit en texte brut');
const types = journal.rows.slice(1).map(r => `${r[1]}:${r[2]}:${r[3]}`);
assert.deepEqual(types, [
  'synchronisation::', 'document-ajout:Décret C:', 'document-retrait:Décret D:', 'document-illisible:Décret B:',
  'modification:Code A:2', 'ajout:Code A:4', 'ajout:Décret C:1', 'retrait:Code A:3', 'retrait:Décret D:1'
]);
assert.ok(!types.includes('retrait:Décret B:1'), 'Un document illisible n’est pas annoncé abrogé');
assert.ok(new Set(journal.rows.slice(1).map(r => r[0])).size === 1, 'Une même date pour tout le passage');
const resume = JSON.parse(journal.rows[1][7]);
assert.equal(resume.origine, 'editeur');
assert.equal(resume.articles, 5);
assert.equal(resume.documents, 3);
assert.ok(resume.duree >= 0);
assert.deepEqual(resume.parDocument.map(d => [d.source, d.articles, d.alertes, Boolean(d.illisible)]),
  [['Code A', 3, 1, false], ['Décret B', 1, 0, true], ['Décret C', 1, 0, false]]);

// Journal d'exécution bavard.
const log = journalExecution.join('\n');
assert.match(log, /éditeur Apps Script/);
assert.match(log, /3 document\(s\) à lire\. Cache actuel : 5 article\(s\), 3 document\(s\)\./);
assert.match(log, /\[1\/3\] Code A : 3 article\(s\), 1 alerte\(s\) de lecture/);
assert.match(log, /alerte, article 4 : Sanction illisible/);
assert.match(log, /\[2\/3\] Décret B : ILLISIBLE — Accès refusé au document\. — 1 article\(s\) précédent\(s\) conservé\(s\)\./);
assert.match(log, /Changements : 2 nouveau\(x\), 1 modifié\(s\), 2 retiré\(s\) ; documents : 1 ajouté\(s\), 1 retiré\(s\), 1 illisible\(s\)\./);
assert.match(log, /~ Code A art\. 2 — Injure publique \[titre, texte\]/);
assert.match(log, /! document illisible Décret B : Accès refusé au document\./);

// ---------------------------------------------------------------- lecture et getCodex
const lu = brut(context.lireJournalCodex_(ss));
assert.equal(lu.length, 1);
assert.equal(lu[0].origine, 'editeur');
assert.deepEqual(lu[0].compte, resultat.changements);
assert.equal(lu[0].changements.find(c => c.type === 'modification').avant.titre, 'Injure');

const visiteur = brut(context.getCodex('VISITEUR'));
assert.equal(visiteur.journal.length, 1, 'Le visiteur reçoit les nouveautés du Codex');
const garde = brut(context.getCodex('GARDE'));
assert.equal(brut(context.getCodex('GARDE', garde.version)).articles, null, 'Version inchangée : rien n’est renvoyé');

// Deuxième passage, sans aucun changement : la version change quand même.
extraits['doc-b'] = [article('Décret B', '1', 'Couvre-feu', 'Nul ne sort après minuit.')];
context.DocumentApp.openById = id => ({ id });
const second = brut(context.synchroniserCodex());
assert.deepEqual(second.changements, { ajouts: 0, modifications: 0, retraits: 0, documentsAjoutes: 0, documentsRetires: 0, documentsIllisibles: 0 });
assert.match(journalExecution.join('\n'), /Aucun changement : le Codex était à jour\./);
const nouvelleVersion = brut(context.getCodex('GARDE', garde.version));
assert.ok(Array.isArray(nouvelleVersion.articles), 'Nouveau passage : le navigateur reçoit le journal à jour');
assert.equal(nouvelleVersion.journal.length, 2);
assert.equal(nouvelleVersion.journal[0].changements.length, 0, 'Le plus récent d’abord');

// Plafond : au-delà de 150 changements, la liste est coupée mais le compte reste juste.
const avantMasse = Array.from({ length: 200 }, (_, i) => article('Code A', String(i + 1), 'T', 'Ancien'));
const apresMasse = avantMasse.map(a => ({ ...a, texte: 'Nouveau' }));
context.journaliserSynchroCodex_(ss, { avant: avantMasse, apres: apresMasse, sourcesAvant: [], sourcesApres: ['Code A'], sourcesIllisibles: [], erreurs: [] });
const masse = brut(context.lireJournalCodex_(ss))[0];
assert.equal(masse.compte.modifications, 200);
assert.equal(masse.changements.length, 150);
assert.equal(masse.tronque, true);

// ---------------------------------------------------------------- bouton des officiers
ouvertures = 0;
assert.throws(() => context.synchroniserCodexRegistre('GARDE'), /droits nécessaires/);
assert.throws(() => context.synchroniserCodexRegistre('VISITEUR'), /droits nécessaires/);
assert.equal(ouvertures, 0, 'Refus avant toute lecture');
assert.equal(proprietes.has('CODEX_SYNCHRO_BOUTON'), false);
publications.length = 0;
const parBouton = brut(context.synchroniserCodexRegistre('OFFICIER', 'suivi-1'));
assert.equal(parBouton.articles, 5);
// Messages publiés au fil de l'eau sous l'identifiant de suivi, puis rendus avec le résultat.
assert.ok(publications.length > 3 && publications.every(p => p.suivi === 'suivi-1'), 'Une publication par message');
assert.equal(publications[0].fini, false);
assert.match(publications[0].lignes[0].texte, /bouton du registre/);
assert.equal(publications.at(-1).fini, true);
assert.ok(parBouton.traces.some(l => /Synchronisation du Codex terminée/.test(l.texte)));
const progression = brut(context.getProgressionSynchroCodex('OFFICIER', 'suivi-1'));
assert.equal(progression.fini, true);
assert.equal(progression.lignes.length, parBouton.traces.length);
assert.deepEqual(brut(context.getProgressionSynchroCodex('OFFICIER', 'autre')), { fini: false, lignes: [] }, 'Autre suivi : rien');
assert.throws(() => context.getProgressionSynchroCodex('GARDE', 'suivi-1'), /droits nécessaires/);
// L'éditeur ne publie rien : personne ne l'attend dans le registre.
publications.length = 0;
assert.equal(brut(context.lireJournalCodex_(ss))[0].origine, 'registre');
assert.throws(() => context.synchroniserCodexRegistre('OFFICIER'), /moins de trois minutes : réessayer dans [23] min/);
// L'éditeur n'est jamais retenu, et ne touche pas au délai du bouton.
const delai = proprietes.get('CODEX_SYNCHRO_BOUTON');
context.synchroniserCodex();
assert.equal(proprietes.get('CODEX_SYNCHRO_BOUTON'), delai);
assert.equal(publications.length, 0, 'L’éditeur ne publie pas de traces');
// Trois minutes plus tard, le bouton reprend.
proprietes.set('CODEX_SYNCHRO_BOUTON', String(Date.now() - 3 * 60 * 1000 - 1));
assert.equal(brut(context.synchroniserCodexRegistre('OFFICIER')).articles, 5);

console.log('Journal du Codex : comparaison, document illisible conservé, compte rendu, lecture, getCodex, bouton des officiers et traces en direct validés.');
