// Journal partagé des arrivées, changements de grade et mutations.
// Structure documentée dans docs/DATA_MODEL.md.
const HISTORIQUE_EFFECTIFS_HEADERS = [
  "ID événement", "Date ISO", "ID membre", "Type", "Nom",
  "Changements JSON", "État JSON", "Source"
];
const HISTORIQUE_EFFECTIFS_DAYS = 14;

function avecVerrouHistoriqueEffectifs_(action) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return action(); } finally { lock.releaseLock(); }
}

function synchroniserHistoriqueEffectifs_(ss) {
  return avecVerrouHistoriqueEffectifs_(() => synchroniserHistoriqueEffectifsSansVerrou_(ss, "Détection"));
}

function synchroniserHistoriqueEffectifsSansVerrou_(ss, source) {
  const sheet = ss.getSheetByName("Effectifs");
  if (!sheet) throw new Error("Feuille Effectifs introuvable.");
  const schema = lireSchemaEffectifsWeb_(sheet);
  let width = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];
  let idIndex = headers.findIndex(h => normaliserEffectifsWeb_(h) === "id membre");
  let journal = ss.getSheetByName("HistoriqueEffectifs");
  if (!journal) journal = ss.insertSheet("HistoriqueEffectifs");
  if (journal.getLastRow() === 0) {
    journal.getRange(1, 1, 1, 8).setValues([HISTORIQUE_EFFECTIFS_HEADERS]);
    journal.setFrozenRows(1);
  } else {
    const actual = journal.getRange(1, 1, 1, 8).getDisplayValues()[0];
    if (actual.some((h, i) => h !== HISTORIQUE_EFFECTIFS_HEADERS[i])) {
      throw new Error("La feuille HistoriqueEffectifs existe avec une structure différente. Aucun contenu remplacé.");
    }
  }
  if (idIndex < 0) {
    idIndex = width++;
    if (sheet.getMaxColumns() < width) sheet.insertColumnsAfter(sheet.getMaxColumns(), width - sheet.getMaxColumns());
    sheet.getRange(1, width).setValue("ID membre").setNote("Identifiant technique stable. Inclure cette colonne dans les tris de lignes ; ne pas modifier.");
  }
  const count = Math.max(0, sheet.getLastRow() - 1);
  const values = count ? sheet.getRange(2, 1, count, width).getDisplayValues() : [];
  const journalCount = Math.max(0, journal.getLastRow() - 1);
  const history = journalCount ? journal.getRange(2, 1, journalCount, 8).getValues() : [];
  const previous = new Map();
  history.forEach(row => {
    if (row[2]) previous.set(String(row[2]), JSON.parse(String(row[6])));
  });
  const initial = !history.some(row => row[3] === "initialisation");
  const now = new Date().toISOString();
  const pending = [];
  if (initial) pending.push([Utilities.getUuid(), now, "", "initialisation", "", "[]", "{}", source]);
  const ids = new Set();
  let idsChanged = false;
  const members = [];
  values.forEach((row, index) => {
    const prenom = String(row[schema.prenom] || "").trim();
    const nom = String(row[schema.nom] || "").trim();
    if (!prenom && !nom) {
      if (row[idIndex]) { row[idIndex] = ""; idsChanged = true; }
      return;
    }
    let id = String(row[idIndex] || "").trim();
    if (!id || ids.has(id)) {
      id = Utilities.getUuid(); row[idIndex] = id; idsChanged = true;
    }
    ids.add(id);
    const state = {
      prenom, nom,
      grade: String(row[schema.grade] || "").trim(),
      corps: String(row[schema.corps] || "").trim(),
      status: String(row[schema.status] || "").trim()
    };
    members.push({ id, row: index + 2, ...state });
    const old = previous.get(id);
    const changes = [];
    if (!initial && !old) changes.push({ type: "arrivee", avant: "", apres: `${prenom} ${nom}`.trim() });
    if (!initial && old) {
      ["grade", "corps"].forEach(type => {
        if (old[type] !== state[type]) changes.push({ type, avant: old[type], apres: state[type] });
      });
    }
    if (!old || JSON.stringify(old) !== JSON.stringify(state)) {
      pending.push([Utilities.getUuid(), now, id, changes.length ? "changement" : "reference",
        `${prenom} ${nom}`.trim(), JSON.stringify(changes), JSON.stringify(state), source]);
    }
  });
  if (idsChanged) sheet.getRange(2, idIndex + 1, count, 1).setValues(values.map(r => [r[idIndex]]));
  if (pending.length) {
    const start = journal.getLastRow() + 1;
    const required = start + pending.length - 1;
    if (required > journal.getMaxRows()) journal.insertRowsAfter(journal.getMaxRows(), required - journal.getMaxRows());
    // JSON et UUID sont sûrs ; noms/sources sont écrits en texte pour éviter les formules.
    journal.getRange(start, 1, pending.length, 8).setValues(pending.map(row => row.map(v =>
      typeof v === "string" && v.startsWith("=") ? "'" + v : v)));
  }
  SpreadsheetApp.flush();
  const cutoff = Date.now() - HISTORIQUE_EFFECTIFS_DAYS * 86400000;
  const current = new Map(members.map(m => [m.id, m]));
  const events = history.concat(pending).filter(row =>
    row[3] === "changement" && Date.parse(row[1]) >= cutoff && current.has(String(row[2]))
  ).map(row => ({
    id: String(row[0]), date: String(row[1]), memberId: String(row[2]),
    nom: `${current.get(String(row[2])).prenom} ${current.get(String(row[2])).nom}`.trim(),
    corps: current.get(String(row[2])).corps,
    changes: JSON.parse(String(row[5])), source: String(row[7])
  })).reverse();
  return { members, events, idIndex, days: HISTORIQUE_EFFECTIFS_DAYS };
}

function historiqueEffectifsPourRole_(history, role) {
  const allowed = new Set(history.members.filter(m => role === "OFFICIER" ||
    normaliserEffectifsWeb_(m.status) === "en service actif" || estStatutReserveOrganigramme(m.status)
  ).map(m => m.id));
  return { days: history.days, events: history.events.filter(e => allowed.has(e.memberId)) };
}

// Installation idempotente lors de la première consultation OFFICIER.
function installerDeclencheurHistoriqueEffectifs_(ss) {
  const properties = PropertiesService.getScriptProperties();
  const key = "HISTORIQUE_EFFECTIFS_TRIGGER_V1";
  if (properties.getProperty(key) === ss.getId()) return;
  avecVerrouHistoriqueEffectifs_(() => {
    if (properties.getProperty(key) === ss.getId()) return;
    const exists = ScriptApp.getProjectTriggers().some(t =>
      t.getHandlerFunction() === "surModificationHistoriqueEffectifs_" && t.getTriggerSourceId() === ss.getId());
    if (!exists) ScriptApp.newTrigger("surModificationHistoriqueEffectifs_").forSpreadsheet(ss).onEdit().create();
    properties.setProperty(key, ss.getId());
  });
}

function surModificationHistoriqueEffectifs_(e) {
  if (!e || !e.source || e.source.getId() !== SPREADSHEET_ID || !e.range || e.range.getSheet().getName() !== "Effectifs") return;
  avecVerrouHistoriqueEffectifs_(() => synchroniserHistoriqueEffectifsSansVerrou_(e.source, "Google Sheets"));
}

function executerMutationHistoriqueEffectifs_(token, data, mutation) {
  requireRole(token, ["OFFICIER"]);
  avecVerrouHistoriqueEffectifs_(() => {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    synchroniserHistoriqueEffectifsSansVerrou_(ss, "Détection");
    try { mutation(token, data); }
    finally { synchroniserHistoriqueEffectifsSansVerrou_(ss, "Application"); }
  });
  return getEffectifs(token);
}
