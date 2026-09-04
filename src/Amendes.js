// ============================================================
// AMENDES
// ============================================================
//
// Feuille Amendes :
//
// A  Date
// B  Garde
// C  Contrevenant
// D  Infraction
// E  Montant
// F  Payé
// G  Reversé aux trésoriers
//
// SyncCodex :
//
// L  Dropdown Amende
// M  Montant
// N  Dropdown Prison
// O  Cachot (heures)
//
// Données :
//
// O  Liste calculée des gardes (Prénom + Nom)
//
// Plusieurs helpers de ce fichier sont utilisés par Prison.gs.
// ============================================================

const AMENDES_SHEET_NAME = "Amendes";
const AMENDES_SYNC_CODEX_SHEET_NAME = "SyncCodex";
const AMENDES_DONNEES_SHEET_NAME = "Données";
const AMENDES_EFFECTIFS_SHEET_NAME = "Effectifs";
const AMENDES_COLLECTEUR_SPECIALITE = "Collecteur de la garde";
const AMENDES_STATUT_ACTIF = "En service actif";
const AMENDES_CORPS_REVERSEMENT_MUTUALISES = ["Cité de Blancherive", "Éclaireur", "Hird du Jarl", "État-Major"];
const AMENDES_CORPS_COLLECTEURS_MUTUALISES = ["Cité de Blancherive", "État-Major"];
const AMENDES_TIMEZONE = "Europe/Stockholm";


// ============================================================
// WEB APP - LECTURE
// ============================================================

function getAmendes(token) {
  requireRole(token, ["GARDE", "OFFICIER"]);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(AMENDES_SHEET_NAME);

  if (!sheet) {
    throw new Error("Feuille Amendes introuvable.");
  }

  const lastRow = getLastNonEmptyRowInColumn(sheet, 1);

  if (lastRow < 2) {
    return { rows: [] };
  }

  const range = sheet.getRange(2, 1, lastRow - 1, 7);
  const values = range.getValues();
  const display = range.getDisplayValues();
  const reversementsParGarde = lireReversementsAmendes_(ss);

  const rows = [];

  for (let i = 0; i < values.length; i++) {
    const valueRow = values[i];
    const displayRow = display[i];

    const date = valueRow[0];
    const garde = nettoyerSaisieUtilisateur(displayRow[1]);
    const contrevenant = nettoyerSaisieUtilisateur(displayRow[2]);
    const infraction = nettoyerSaisieUtilisateur(displayRow[3]);

    if (!date && !garde && !contrevenant && !infraction) {
      continue;
    }

    const montantRaw = valueRow[4];
    const reversement = reversementsParGarde.get(normaliserReferenceAmendes_(garde)) || { collecteurs: [], fallbackEtatMajor: false };

    rows.push({
      row: i + 2,
      date: formatDateAmende_(date, displayRow[0]),
      garde,
      contrevenant,
      infraction,

      montant:
        montantRaw === "" || montantRaw === null
          ? ""
          : displayRow[4],

      montantRaw:
        montantRaw === "" || montantRaw === null
          ? null
          : Number(montantRaw),

      collecteurs: reversement.collecteurs,
      fallbackEtatMajor: reversement.fallbackEtatMajor,

      paye: valueRow[5] === true,
      reverse: valueRow[6] === true
    });
  }

  rows.reverse();

  return { rows };
}

function lireReversementsAmendes_(ss) {
  const sheet = ss.getSheetByName(AMENDES_EFFECTIFS_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) return new Map();
  const width = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, width).getDisplayValues()[0].map(normaliserReferenceAmendes_);
  const prenom = trouverColonneAmendes_(headers, ["prenom", "prénom"]);
  const nom = trouverColonneAmendes_(headers, ["nom"]);
  const grade = trouverColonneAmendes_(headers, ["grade"]);
  const corps = trouverColonneAmendes_(headers, ["corps", "corps de garde", "garnison"]);
  const specialite = trouverColonneAmendes_(headers, ["specialite", "spécialité"]);
  const statut = trouverColonneAmendes_(headers, ["status", "statut"]);
  if ([prenom, nom, grade, corps, specialite, statut].some(index => index < 0)) return new Map();
  const corpsParGarde = new Map(), collecteursParCorps = new Map();
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getDisplayValues();
  for (const row of rows) {
    const nomComplet = nettoyerSaisieUtilisateur(`${row[prenom] || ""} ${row[nom] || ""}`);
    const corpsGarde = normaliserReferenceAmendes_(row[corps]);
    if (!nomComplet || !corpsGarde) continue;
    const cleGarde = normaliserReferenceAmendes_(nomComplet);
    if (!corpsParGarde.has(cleGarde)) corpsParGarde.set(cleGarde, new Set());
    corpsParGarde.get(cleGarde).add(corpsGarde);
    const estCollecteur = contientSpecialiteAmendes_(row[specialite], AMENDES_COLLECTEUR_SPECIALITE);
    const estActif = normaliserReferenceAmendes_(row[statut]) === normaliserReferenceAmendes_(AMENDES_STATUT_ACTIF);
    if (!estCollecteur || !estActif) continue;
    if (!collecteursParCorps.has(corpsGarde)) collecteursParCorps.set(corpsGarde, []);
    const gradeCollecteur = nettoyerSaisieUtilisateur(row[grade]);
    collecteursParCorps.get(corpsGarde).push(gradeCollecteur ? `${gradeCollecteur} ${nomComplet}` : nomComplet);
  }
  const collecteursEtatMajor = [];
  for (const [corpsGarde, collecteurs] of collecteursParCorps) if (estEtatMajorAmendes_(corpsGarde)) collecteursEtatMajor.push(...collecteurs);
  const result = new Map();
  for (const [cleGarde, corpsGardes] of corpsParGarde) {
    const collecteurs = [];
    for (const corpsGarde of corpsGardes) {
      const corpsCollecteurs = estCorpsReversementMutualiseAmendes_(corpsGarde)
        ? AMENDES_CORPS_COLLECTEURS_MUTUALISES.map(normaliserReferenceAmendes_)
        : [corpsGarde];
      for (const corpsCollecteur of corpsCollecteurs) collecteurs.push(...(collecteursParCorps.get(corpsCollecteur) || []));
    }
    const noms = listeUniqueAmendes_(collecteurs);
    const fallbackEtatMajor = noms.length === 0 && collecteursEtatMajor.length > 0;
    result.set(cleGarde, { collecteurs: fallbackEtatMajor ? listeUniqueAmendes_(collecteursEtatMajor) : noms, fallbackEtatMajor });
  }
  return result;
}

function trouverColonneAmendes_(headers, aliases) { const normalizedAliases = aliases.map(normaliserReferenceAmendes_); return headers.findIndex(header => normalizedAliases.includes(header)); }
function estEtatMajorAmendes_(corps) { const value = normaliserReferenceAmendes_(corps); return value === "etat-major" || value === "etat major"; }
function estCorpsReversementMutualiseAmendes_(corps) { const value = normaliserReferenceAmendes_(corps); return AMENDES_CORPS_REVERSEMENT_MUTUALISES.map(normaliserReferenceAmendes_).includes(value) || value === "hird"; }
function listeUniqueAmendes_(values) { const result = [], seen = new Set(); for (const value of values) { const cleaned = nettoyerSaisieUtilisateur(value), key = normaliserReferenceAmendes_(cleaned); if (!cleaned || seen.has(key)) continue; seen.add(key); result.push(cleaned); } return result; }
function contientSpecialiteAmendes_(specialites, specialiteRecherchee) { const recherchee = normaliserReferenceAmendes_(specialiteRecherchee); return String(specialites || "").split(/[,;\n]/).some(specialite => normaliserReferenceAmendes_(specialite) === recherchee); }


// ============================================================
// DONNÉES DU FORMULAIRE
// ============================================================

function getAmendeFormData(token) {
  requireRole(token, ["GARDE", "OFFICIER"]);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const syncSheet = ss.getSheetByName(AMENDES_SYNC_CODEX_SHEET_NAME);
  const donneesSheet = ss.getSheetByName(AMENDES_DONNEES_SHEET_NAME);

  if (!syncSheet) {
    throw new Error(
      "Feuille SyncCodex introuvable. Lancez synchroniserCodex()."
    );
  }

  if (!donneesSheet) {
    throw new Error("Feuille Données introuvable.");
  }

  const infractions = lireListeTechnique(
    syncSheet,
    12,
    13
  ).map(item => ({
    label: item.label,
    montant: item.value
  }));

  const gardes = lireColonneTechnique(donneesSheet, 15);

  return {
    infractions,
    gardes
  };
}


// ============================================================
// AJOUT
// ============================================================

function ajouterAmende(token, data) {
  requireRole(token, ["GARDE", "OFFICIER"]);

  if (!data) {
    throw new Error("Données de l'amende manquantes.");
  }

  const dateInput = nettoyerSaisieUtilisateur(data.date);
  const garde = nettoyerSaisieUtilisateur(data.garde);
  const contrevenant = nettoyerSaisieUtilisateur(data.contrevenant);
  const infraction = nettoyerSaisieUtilisateur(data.infraction);

  if (!dateInput) {
    throw new Error("La date est obligatoire.");
  }

  if (!garde) {
    throw new Error("Le garde est obligatoire.");
  }

  if (!contrevenant) {
    throw new Error("Le contrevenant est obligatoire.");
  }

  if (!infraction) {
    throw new Error("L'infraction est obligatoire.");
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(AMENDES_SHEET_NAME);
  const syncSheet = ss.getSheetByName(AMENDES_SYNC_CODEX_SHEET_NAME);
  const donneesSheet = ss.getSheetByName(AMENDES_DONNEES_SHEET_NAME);

  if (!sheet) {
    throw new Error("Feuille Amendes introuvable.");
  }

  if (!syncSheet) {
    throw new Error("Feuille SyncCodex introuvable.");
  }

  if (!donneesSheet) {
    throw new Error("Feuille Données introuvable.");
  }

  const gardes = lireColonneTechnique(donneesSheet, 15);

  if (!gardes.includes(garde)) {
    throw new Error("Le garde sélectionné n'est pas reconnu.");
  }

  const infractions = lireListeTechnique(syncSheet, 12, 13);

  const article = infractions.find(
    item => item.label === infraction
  );

  if (!article) {
    throw new Error(
      "L'infraction sélectionnée n'est pas reconnue."
    );
  }

  const montant =
    article.value === "" ||
    article.value === null ||
    typeof article.value === "undefined"
      ? ""
      : Number(article.value);

  if (montant !== "" && !Number.isFinite(montant)) {
    throw new Error(
      "Le montant associé à cette infraction est invalide."
    );
  }

  const date = parseDateInput(dateInput);

  const lastRow = getLastNonEmptyRowInColumn(sheet, 1);
  const targetRow = Math.max(2, lastRow + 1);

  sheet
    .getRange(targetRow, 1, 1, 7)
    .setValues([[
      date,
      garde,
      contrevenant,
      infraction,
      montant,
      false,
      false
    ]]);

  sheet
    .getRange(targetRow, 6, 1, 2)
    .insertCheckboxes();

  sheet
    .getRange(targetRow, 1)
    .setNumberFormat("dd/MM/yyyy");

  SpreadsheetApp.flush();

  return getAmendes(token);
}


// ============================================================
// MODIFICATION CHECKBOXES
// ============================================================

function modifierAmendeCheckbox(
  token,
  row,
  column,
  checked
) {
  const auth =
    requireRole(token, ["GARDE", "OFFICIER"]);

  row = Number(row);
  column = Number(column);

  if (!Number.isInteger(row) || row < 2) {
    throw new Error("Ligne d'amende invalide.");
  }

  if (column !== 6 && column !== 7) {
    throw new Error("Colonne d'amende non autorisée.");
  }

  if (column === 7 && auth.role !== "OFFICIER") {
    throw new Error(
      "Seuls les officiers peuvent modifier le statut Reversé."
    );
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(AMENDES_SHEET_NAME);

  if (!sheet) {
    throw new Error("Feuille Amendes introuvable.");
  }

  const lastRow = getLastNonEmptyRowInColumn(sheet, 1);

  if (row > lastRow) {
    throw new Error("Cette amende n'existe plus.");
  }

  const rowData = sheet
    .getRange(row, 1, 1, 4)
    .getDisplayValues()[0];

  if (!rowData.some(value => String(value || "").trim())) {
    throw new Error("Cette ligne d'amende est vide.");
  }

  if (column === 7 && checked === true) {
    sheet.getRange(row, 6).setValue(true);
  }

  if (column === 6 && checked === false) {
    sheet.getRange(row, 7).setValue(false);
  }

  sheet
    .getRange(row, column)
    .setValue(Boolean(checked));

  SpreadsheetApp.flush();

  return getAmendes(token);
}


// ============================================================
// SUPPRESSION - OFFICIER UNIQUEMENT
// ============================================================

function supprimerAmende(token, row) {
  requireRole(token, ["OFFICIER"]);

  row = Number(row);

  if (!Number.isInteger(row) || row < 2) {
    throw new Error("Ligne d'amende invalide.");
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(AMENDES_SHEET_NAME);

  if (!sheet) {
    throw new Error("Feuille Amendes introuvable.");
  }

  const lastRow = getLastNonEmptyRowInColumn(sheet, 1);

  if (row > lastRow) {
    throw new Error("Cette amende n'existe plus.");
  }

  const values = sheet
    .getRange(row, 1, 1, 7)
    .getDisplayValues()[0];

  if (!values.some(value => String(value || "").trim())) {
    throw new Error("Cette amende a déjà été supprimée.");
  }

  /*
    On ne supprime PAS physiquement la ligne Sheet.
    On vide uniquement A:G.

    Cela évite de décaler les lignes et d'éventuels éléments
    situés ailleurs dans la feuille.
  */
  sheet
    .getRange(row, 1, 1, 7)
    .clearContent();

  SpreadsheetApp.flush();

  return getAmendes(token);
}


// ============================================================
// UTILITAIRES PARTAGÉS
// ============================================================

function getLastNonEmptyRowInColumn(sheet, column) {
  if (!sheet) {
    throw new Error(
      "Feuille invalide dans getLastNonEmptyRowInColumn()."
    );
  }

  column = Number(column);

  if (!Number.isInteger(column) || column < 1) {
    throw new Error(
      "Colonne invalide dans getLastNonEmptyRowInColumn()."
    );
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 1) {
    return 0;
  }

  const values = sheet
    .getRange(1, column, lastRow, 1)
    .getDisplayValues();

  for (let i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0] || "").trim() !== "") {
      return i + 1;
    }
  }

  return 0;
}


function lireColonneTechnique(sheet, column) {
  if (!sheet) {
    return [];
  }

  const lastRow = getLastNonEmptyRowInColumn(
    sheet,
    column
  );

  if (lastRow < 2) {
    return [];
  }

  const values = sheet
    .getRange(2, column, lastRow - 1, 1)
    .getDisplayValues();

  const result = [];

  for (const row of values) {
    const value = nettoyerSaisieUtilisateur(row[0]);

    if (value) {
      result.push(value);
    }
  }

  return [...new Set(result)];
}


function lireListeTechnique(
  sheet,
  labelColumn,
  valueColumn
) {
  if (!sheet) {
    return [];
  }

  const lastRow = getLastNonEmptyRowInColumn(
    sheet,
    labelColumn
  );

  if (lastRow < 2) {
    return [];
  }

  const firstColumn = Math.min(
    labelColumn,
    valueColumn
  );

  const lastColumn = Math.max(
    labelColumn,
    valueColumn
  );

  const width =
    lastColumn -
    firstColumn +
    1;

  const range = sheet.getRange(
    2,
    firstColumn,
    lastRow - 1,
    width
  );

  const values = range.getValues();
  const display = range.getDisplayValues();

  const labelIndex =
    labelColumn -
    firstColumn;

  const valueIndex =
    valueColumn -
    firstColumn;

  const result = [];

  for (let i = 0; i < values.length; i++) {
    const label = nettoyerSaisieUtilisateur(
      display[i][labelIndex]
    );

    if (!label) {
      continue;
    }

    const rawValue = values[i][valueIndex];

    let value = "";

    if (
      rawValue !== "" &&
      rawValue !== null &&
      typeof rawValue !== "undefined"
    ) {
      const numeric = Number(rawValue);

      value = Number.isFinite(numeric)
        ? numeric
        : nettoyerSaisieUtilisateur(
            display[i][valueIndex]
          );
    }

    result.push({
      label,
      value
    });
  }

  return result;
}


function nettoyerSaisieUtilisateur(value) {
  return String(
    value === null ||
    typeof value === "undefined"
      ? ""
      : value
  )
    .replace(/\u00A0/g, " ")
    .trim();
}

function normaliserReferenceAmendes_(value) { return nettoyerSaisieUtilisateur(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }


function parseDateInput(value) {
  const input = nettoyerSaisieUtilisateur(value);

  const match = input.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) {
    throw new Error("Format de date invalide.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const result = new Date(
    year,
    month - 1,
    day,
    12,
    0,
    0,
    0
  );

  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day
  ) {
    throw new Error("Date invalide.");
  }

  return result;
}


function formatDateAmende_(value, fallback) {
  if (
    value instanceof Date &&
    !isNaN(value.getTime())
  ) {
    return Utilities.formatDate(
      value,
      AMENDES_TIMEZONE,
      "dd/MM/yyyy"
    );
  }

  return nettoyerSaisieUtilisateur(fallback);
}
