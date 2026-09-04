// ============================================================
// PRISON
// ============================================================
//
// Feuille Prison :
//
// A  Date
// B  Garde
// C  Détenu
// D  Cellule
// E  Infraction
// F  Durée prévue
// G  Heure d'entrée
// H  Heure de sortie prévue
// I  Libéré
// J  Saisies sur la personne
// K  Motif / Notes
//
// Helpers partagés provenant de Amendes.gs :
//
// getLastNonEmptyRowInColumn()
// lireColonneTechnique()
// lireListeTechnique()
// nettoyerSaisieUtilisateur()
// parseDateInput()
// ============================================================

const PRISON_SHEET_NAME = "Prison";
const PRISON_SYNC_CODEX_SHEET_NAME = "SyncCodex";
const PRISON_DONNEES_SHEET_NAME = "Données";
const PRISON_TIMEZONE = "Europe/Stockholm";


// ============================================================
// WEB APP - LECTURE
// ============================================================

function getPrison(token) {
  requireRole(token, ["GARDE", "OFFICIER"]);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(PRISON_SHEET_NAME);

  if (!sheet) {
    throw new Error("Feuille Prison introuvable.");
  }

  const lastRow = getLastNonEmptyRowInColumn(sheet, 1);

  if (lastRow < 2) {
    return { rows: [] };
  }

  const range = sheet.getRange(
    2,
    1,
    lastRow - 1,
    11
  );

  const values = range.getValues();
  const display = range.getDisplayValues();

  const rows = [];

  for (let i = 0; i < values.length; i++) {
    const valueRow = values[i];
    const displayRow = display[i];

    const date = valueRow[0];
    const garde = nettoyerSaisieUtilisateur(displayRow[1]);
    const detenu = nettoyerSaisieUtilisateur(displayRow[2]);
    const infraction = nettoyerSaisieUtilisateur(displayRow[4]);

    if (!date && !garde && !detenu && !infraction) {
      continue;
    }

    const dureeRaw = valueRow[5];

    rows.push({
      row: i + 2,

      date: formatDatePrison_(
        valueRow[0],
        displayRow[0]
      ),

      garde,
      detenu,

      cellule:
        nettoyerSaisieUtilisateur(
          displayRow[3]
        ),

      infraction,

      duree:
        dureeRaw === "" ||
        dureeRaw === null
          ? ""
          : formatDureePrison_(dureeRaw),

      dureeRaw:
        dureeRaw === "" ||
        dureeRaw === null
          ? null
          : Number(dureeRaw),

      entree:
        formatDateTimePrison_(
          valueRow[6],
          displayRow[6]
        ),

      sortie:
        formatDateTimePrison_(
          valueRow[7],
          displayRow[7]
        ),

      libere:
        valueRow[8] === true,

      saisies:
        nettoyerSaisieUtilisateur(
          displayRow[9]
        ),

      notes:
        nettoyerSaisieUtilisateur(
          displayRow[10]
        )
    });
  }

  rows.reverse();

  return { rows };
}


// ============================================================
// DONNÉES DU FORMULAIRE
// ============================================================

function getPrisonFormData(token) {
  requireRole(token, ["GARDE", "OFFICIER"]);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const syncSheet = ss.getSheetByName(
    PRISON_SYNC_CODEX_SHEET_NAME
  );

  const donneesSheet = ss.getSheetByName(
    PRISON_DONNEES_SHEET_NAME
  );

  if (!syncSheet) {
    throw new Error(
      "Feuille SyncCodex introuvable. Lancez synchroniserCodex()."
    );
  }

  if (!donneesSheet) {
    throw new Error(
      "Feuille Données introuvable."
    );
  }

  /*
    N = Dropdown Prison
    O = Cachot (heures)
  */
  const infractions = lireListeTechnique(
    syncSheet,
    14,
    15
  ).map(item => ({
    label: item.label,
    duree: item.value
  }));

  /*
    Données!O = Gardes
  */
  const gardes = lireColonneTechnique(
    donneesSheet,
    15
  );

  return {
    infractions,
    gardes
  };
}


// ============================================================
// AJOUT
// ============================================================

function ajouterPrison(token, data) {
  requireRole(token, ["GARDE", "OFFICIER"]);

  if (!data) {
    throw new Error(
      "Données d'incarcération manquantes."
    );
  }

  const dateInput =
    nettoyerSaisieUtilisateur(data.date);

  const garde =
    nettoyerSaisieUtilisateur(data.garde);

  const detenu =
    nettoyerSaisieUtilisateur(data.detenu);

  const cellule =
    nettoyerSaisieUtilisateur(data.cellule);

  const infraction =
    nettoyerSaisieUtilisateur(data.infraction);

  const entreeInput =
    nettoyerSaisieUtilisateur(data.entree);

  const saisies =
    nettoyerSaisieUtilisateur(data.saisies);

  const notes =
    nettoyerSaisieUtilisateur(data.notes);

  if (!dateInput) {
    throw new Error("La date est obligatoire.");
  }

  if (!garde) {
    throw new Error("Le garde est obligatoire.");
  }

  if (!detenu) {
    throw new Error("Le détenu est obligatoire.");
  }

  if (!infraction) {
    throw new Error("L'infraction est obligatoire.");
  }

  if (!entreeInput) {
    throw new Error(
      "L'heure d'entrée est obligatoire."
    );
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const sheet =
    ss.getSheetByName(
      PRISON_SHEET_NAME
    );

  const syncSheet =
    ss.getSheetByName(
      PRISON_SYNC_CODEX_SHEET_NAME
    );

  const donneesSheet =
    ss.getSheetByName(
      PRISON_DONNEES_SHEET_NAME
    );

  if (!sheet) {
    throw new Error(
      "Feuille Prison introuvable."
    );
  }

  if (!syncSheet) {
    throw new Error(
      "Feuille SyncCodex introuvable."
    );
  }

  if (!donneesSheet) {
    throw new Error(
      "Feuille Données introuvable."
    );
  }

  // ==========================================================
  // GARDE
  // ==========================================================

  const gardes = lireColonneTechnique(
    donneesSheet,
    15
  );

  if (!gardes.includes(garde)) {
    throw new Error(
      "Le garde sélectionné n'est pas reconnu."
    );
  }

  // ==========================================================
  // INFRACTION + SNAPSHOT DURÉE
  // ==========================================================

  const infractions = lireListeTechnique(
    syncSheet,
    14,
    15
  );

  const article = infractions.find(
    item => item.label === infraction
  );

  if (!article) {
    throw new Error(
      "L'infraction sélectionnée n'est pas reconnue."
    );
  }

  const duree =
    article.value === "" ||
    article.value === null ||
    typeof article.value === "undefined"
      ? ""
      : Number(article.value);

  if (
    duree !== "" &&
    !Number.isFinite(duree)
  ) {
    throw new Error(
      "La durée associée à cette infraction est invalide."
    );
  }

  const date = parseDateInput(dateInput);
  const entree = parseDateTimeLocalPrison_(
    entreeInput
  );

  let sortie = "";

  if (duree !== "") {
    sortie = new Date(
      entree.getTime() +
      duree * 60 * 60 * 1000
    );
  }

  const lastRow =
    getLastNonEmptyRowInColumn(
      sheet,
      1
    );

  const targetRow =
    Math.max(
      2,
      lastRow + 1
    );

  /*
    A Date
    B Garde
    C Détenu
    D Cellule
    E Infraction
    F Durée
    G Entrée
    H Sortie prévue
    I Libéré
    J Saisies
    K Notes
  */
  sheet
    .getRange(
      targetRow,
      1,
      1,
      11
    )
    .setValues([[
      date,
      garde,
      detenu,
      cellule,
      infraction,
      duree,
      entree,
      sortie,
      false,
      saisies,
      notes
    ]]);

  sheet
    .getRange(targetRow, 9)
    .insertCheckboxes();

  sheet
    .getRange(targetRow, 1)
    .setNumberFormat("dd/MM/yyyy");

  sheet
    .getRange(targetRow, 7, 1, 2)
    .setNumberFormat(
      "dd/MM/yyyy HH:mm"
    );

  SpreadsheetApp.flush();

  return getPrison(token);
}


// ============================================================
// LIBÉRATION
// ============================================================

function modifierPrisonLibere(
  token,
  row,
  checked
) {
  requireRole(token, ["GARDE", "OFFICIER"]);

  row = Number(row);

  if (
    !Number.isInteger(row) ||
    row < 2
  ) {
    throw new Error(
      "Ligne de prison invalide."
    );
  }

  const ss = SpreadsheetApp.openById(
    SPREADSHEET_ID
  );

  const sheet = ss.getSheetByName(
    PRISON_SHEET_NAME
  );

  if (!sheet) {
    throw new Error(
      "Feuille Prison introuvable."
    );
  }

  const lastRow =
    getLastNonEmptyRowInColumn(
      sheet,
      1
    );

  if (row > lastRow) {
    throw new Error(
      "Cette incarcération n'existe plus."
    );
  }

  const rowData = sheet
    .getRange(row, 1, 1, 5)
    .getDisplayValues()[0];

  if (
    !rowData.some(
      value =>
        String(value || "").trim()
    )
  ) {
    throw new Error(
      "Cette ligne d'incarcération est vide."
    );
  }

  sheet
    .getRange(row, 9)
    .setValue(
      Boolean(checked)
    );

  SpreadsheetApp.flush();

  return getPrison(token);
}


// ============================================================
// SUPPRESSION - OFFICIER UNIQUEMENT
// ============================================================

function supprimerPrison(
  token,
  row
) {
  requireRole(token, ["OFFICIER"]);

  row = Number(row);

  if (
    !Number.isInteger(row) ||
    row < 2
  ) {
    throw new Error(
      "Ligne de prison invalide."
    );
  }

  const ss = SpreadsheetApp.openById(
    SPREADSHEET_ID
  );

  const sheet = ss.getSheetByName(
    PRISON_SHEET_NAME
  );

  if (!sheet) {
    throw new Error(
      "Feuille Prison introuvable."
    );
  }

  const lastRow =
    getLastNonEmptyRowInColumn(
      sheet,
      1
    );

  if (row > lastRow) {
    throw new Error(
      "Cette incarcération n'existe plus."
    );
  }

  const values = sheet
    .getRange(row, 1, 1, 11)
    .getDisplayValues()[0];

  if (
    !values.some(
      value =>
        String(value || "").trim()
    )
  ) {
    throw new Error(
      "Cette incarcération a déjà été supprimée."
    );
  }

  /*
    Même principe que pour Amendes :
    on conserve physiquement la ligne Sheet mais on vide A:K.
  */
  sheet
    .getRange(row, 1, 1, 11)
    .clearContent();

  SpreadsheetApp.flush();

  return getPrison(token);
}


// ============================================================
// HELPERS PRISON
// ============================================================

function parseDateTimeLocalPrison_(
  value
) {
  const input =
    nettoyerSaisieUtilisateur(
      value
    );

  const match = input.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
  );

  if (!match) {
    throw new Error(
      "Format d'heure d'entrée invalide."
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  const result = new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    0,
    0
  );

  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day ||
    result.getHours() !== hour ||
    result.getMinutes() !== minute
  ) {
    throw new Error(
      "Date ou heure d'entrée invalide."
    );
  }

  return result;
}


function formatDatePrison_(
  value,
  fallback
) {
  if (
    value instanceof Date &&
    !isNaN(value.getTime())
  ) {
    return Utilities.formatDate(
      value,
      PRISON_TIMEZONE,
      "dd/MM/yyyy"
    );
  }

  return nettoyerSaisieUtilisateur(
    fallback
  );
}


function formatDateTimePrison_(
  value,
  fallback
) {
  if (
    value instanceof Date &&
    !isNaN(value.getTime())
  ) {
    return Utilities.formatDate(
      value,
      PRISON_TIMEZONE,
      "dd/MM/yyyy HH:mm"
    );
  }

  return nettoyerSaisieUtilisateur(
    fallback
  );
}


function formatDureePrison_(
  value
) {
  const hours = Number(value);

  if (!Number.isFinite(hours)) {
    return "";
  }

  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }

  if (Number.isInteger(hours)) {
    return `${hours} h`;
  }

  const wholeHours = Math.floor(hours);

  const minutes = Math.round(
    (hours - wholeHours) * 60
  );

  if (!wholeHours) {
    return `${minutes} min`;
  }

  return `${wholeHours} h ${minutes} min`;
}
