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
// E  Infraction (libellé lisible des chefs d'accusation)
// F  Durée prévue (heures, vide = à déterminer)
// G  Heure d'entrée
// H  Heure de sortie prévue
// I  Libéré
// J  Saisies sur la personne
// K  Motif / Notes
// L  Chefs d'accusation (JSON) — colonne technique
//
// Helpers partagés provenant de Amendes.js :
//
// getLastNonEmptyRowInColumn()
// lireColonneTechnique()
// trouverValeurTechniqueBrute()
// nettoyerSaisieUtilisateur()
// parseDateInput()
// validerChefsAccusation_(), lireChefsAccusation_()
// garantirColonnesRegistre_(), lireIdentiteAttendue_(), verifierIdentiteRegistre_()
//
// et de Objets.js :
//
// preparerSaisiesPrison_(), afficherSaisiesPrison_(), lireSaisiesPrisonStructurees_()
// ============================================================

const PRISON_SHEET_NAME = "Prison";
const PRISON_DONNEES_SHEET_NAME = "Données";
const PRISON_TIMEZONE = "Europe/Stockholm";
const PRISON_CHEFS_COLUMN = 12;
const PRISON_CHEFS_HEADER = "Chefs d'accusation (JSON)";
// Un an de cachot : au-delà, la saisie est une erreur de frappe.
const PRISON_DUREE_MAX_HEURES = 24 * 366;


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

  const largeur = Math.min(PRISON_CHEFS_COLUMN, sheet.getMaxColumns());
  const range = sheet.getRange(2, 1, lastRow - 1, largeur);
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
      date: formatDatePrison_(valueRow[0], displayRow[0]),
      garde,
      detenu,
      cellule: nettoyerSaisieUtilisateur(displayRow[3]),
      infraction,
      chefs: lireChefsAccusation_(displayRow[PRISON_CHEFS_COLUMN - 1]),

      duree:
        dureeRaw === "" || dureeRaw === null
          ? ""
          : formatDureePrison_(dureeRaw),

      dureeRaw:
        dureeRaw === "" || dureeRaw === null
          ? null
          : Number(dureeRaw),

      entree: formatDateTimePrison_(valueRow[6], displayRow[6]),
      entreeIso: formatDateTimeLocalIsoPrison_(valueRow[6]),
      sortie: formatDateTimePrison_(valueRow[7], displayRow[7]),
      libere: valueRow[8] === true,
      saisies: afficherSaisiesPrison_(displayRow[9]),
      // Liste structurée pour le formulaire de modification ; null pour une
      // saisie historique en texte, que le formulaire laisse intacte.
      saisiesListe: lireSaisiesPrisonStructurees_(displayRow[9]),
      notes: nettoyerSaisieUtilisateur(displayRow[10])
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
  const donneesSheet = ss.getSheetByName(PRISON_DONNEES_SHEET_NAME);

  if (!donneesSheet) {
    throw new Error("Feuille Données introuvable.");
  }

  return {
    gardes: lireColonneTechnique(donneesSheet, 15)
  };
}


// ============================================================
// AJOUT
// ============================================================

/*
  `data` : { date, garde, detenu, cellule, chefs, duree, entree, saisies, notes }.
  `duree` vide signifie « À déterminer » : pas de sortie prévue calculée.
*/
function ajouterPrison(token, data) {
  requireRole(token, ["GARDE", "OFFICIER"]);
  if (!data) throw new Error("Données d'incarcération manquantes.");
  const saisie = preparerSaisiePrison_(data);
  // La première recherche peut créer Objets sous son propre verrou.
  // La validation des objets est donc terminée avant le verrou d'écriture.
  const objets = preparerSaisiesPrison_(data.saisies);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return ajouterPrisonVerrouille_(token, saisie, objets); }
  finally { lock.releaseLock(); }
}

function ajouterPrisonVerrouille_(token, saisie, objets) {
  requireRole(token, ["GARDE", "OFFICIER"]);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const feuilles = ouvrirFeuillesPrison_(ss);
  const ligne = construireLignePrison_(ss, feuilles.donnees, saisie);
  const sheet = feuilles.prison;

  garantirColonnesRegistre_(sheet, PRISON_CHEFS_COLUMN, PRISON_CHEFS_HEADER);

  const lastRow = getLastNonEmptyRowInColumn(sheet, 1);
  const targetRow = Math.max(2, lastRow + 1);

  ecrireLignePrison_(sheet, targetRow, [
    ligne.date,
    ligne.garde,
    ligne.detenu,
    ligne.cellule,
    ligne.chefs.texte,
    ligne.duree,
    ligne.entree,
    ligne.sortie,
    false,
    objets,
    ligne.notes,
    ligne.chefs.json
  ]);

  return getPrison(token);
}


// ============================================================
// MODIFICATION - OFFICIER UNIQUEMENT
// ============================================================

/*
  Modifie tout ce que le formulaire de création saisit : date, garde, détenu,
  cellule, chefs d'accusation, durée, entrée, saisies et notes. La sortie
  prévue est recalculée. La case Libéré n'est pas touchée.

  `data.saisies` absent : la colonne J est conservée telle quelle. C'est le
  cas d'une incarcération antérieure dont les saisies sont en texte libre ;
  le formulaire ne sait pas les rééditer et ne doit pas les effacer.

  `data.attendu` porte le garde et le détenu affichés à l'officier : la ligne
  n'est réécrite que si elle les porte encore.
*/
function modifierPrison(token, row, data) {
  requireRole(token, ["OFFICIER"]);

  row = Number(row);

  if (!Number.isInteger(row) || row < 2) {
    throw new Error("Ligne de prison invalide.");
  }

  if (!data) throw new Error("Données d'incarcération manquantes.");

  const saisie = preparerSaisiePrison_(data);
  const attendu = lireIdentiteAttendue_(data.attendu, ["garde", "detenu"]);
  const objets = data.saisies === undefined ? null : preparerSaisiesPrison_(data.saisies);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const feuilles = ouvrirFeuillesPrison_(ss);
    const sheet = feuilles.prison;

    const lastRow = getLastNonEmptyRowInColumn(sheet, 1);

    if (row > lastRow) {
      throw new Error("Cette incarcération n'existe plus.");
    }

    garantirColonnesRegistre_(sheet, PRISON_CHEFS_COLUMN, PRISON_CHEFS_HEADER);

    const rangeActuel = sheet.getRange(row, 1, 1, PRISON_CHEFS_COLUMN);
    const actuel = rangeActuel.getValues()[0];
    const affiche = rangeActuel.getDisplayValues()[0];

    if (!affiche.slice(0, 5).some(value => String(value || "").trim())) {
      throw new Error("Cette ligne d'incarcération est vide.");
    }

    verifierIdentiteRegistre_(
      { garde: affiche[1], detenu: affiche[2] },
      attendu,
      "Cette incarcération a changé depuis son affichage. Rechargez le registre avant de la modifier."
    );

    const ligne = construireLignePrison_(ss, feuilles.donnees, saisie);

    ecrireLignePrison_(sheet, row, [
      ligne.date,
      ligne.garde,
      ligne.detenu,
      ligne.cellule,
      ligne.chefs.texte,
      ligne.duree,
      ligne.entree,
      ligne.sortie,
      actuel[8] === true,
      objets === null ? actuel[9] : objets,
      ligne.notes,
      ligne.chefs.json
    ]);
  } finally {
    lock.releaseLock();
  }

  return getPrison(token);
}


// ============================================================
// HELPERS D'ÉCRITURE PRISON
// ============================================================

function preparerSaisiePrison_(data) {
  const dateInput = nettoyerSaisieUtilisateur(data.date);
  const garde = nettoyerSaisieUtilisateur(data.garde);
  const detenu = nettoyerSaisieUtilisateur(data.detenu);
  const cellule = nettoyerSaisieUtilisateur(data.cellule);
  const entreeInput = nettoyerSaisieUtilisateur(data.entree);
  const notes = nettoyerSaisieUtilisateur(data.notes);

  if (!dateInput) throw new Error("La date est obligatoire.");
  if (!garde) throw new Error("Le garde est obligatoire.");
  if (!detenu) throw new Error("Le détenu est obligatoire.");
  if (detenu.length > 200) throw new Error("Le nom du détenu est limité à 200 caractères.");
  if (cellule.length > 100) throw new Error("La cellule est limitée à 100 caractères.");
  if (!entreeInput) throw new Error("L'heure d'entrée est obligatoire.");
  if (notes.length > 5000) throw new Error("Les notes sont limitées à 5 000 caractères.");

  if (data.infraction !== undefined && data.chefs === undefined) {
    throw new Error("Ce formulaire n'est plus à jour. Actualisez la page puis saisissez les chefs d'accusation.");
  }

  return {
    date: parseDateInput(dateInput),
    garde,
    detenu,
    cellule,
    chefs: data.chefs,
    duree: validerDureePrison_(data.duree),
    entree: parseDateTimeLocalPrison_(entreeInput),
    notes
  };
}


function ouvrirFeuillesPrison_(ss) {
  const prison = ss.getSheetByName(PRISON_SHEET_NAME);
  const donnees = ss.getSheetByName(PRISON_DONNEES_SHEET_NAME);

  if (!prison) throw new Error("Feuille Prison introuvable.");
  if (!donnees) throw new Error("Feuille Données introuvable.");

  return { prison, donnees };
}


function construireLignePrison_(ss, donneesSheet, saisie) {
  const gardePourFeuille = trouverValeurTechniqueBrute(donneesSheet, 15, saisie.garde);

  if (gardePourFeuille === null) {
    throw new Error("Le garde sélectionné n'est pas reconnu.");
  }

  let sortie = "";

  if (saisie.duree !== "") {
    sortie = new Date(saisie.entree.getTime() + saisie.duree * 60 * 60 * 1000);
    if (!Number.isFinite(sortie.getTime())) throw new Error("La date de sortie calculée est invalide.");
  }

  return {
    date: saisie.date,
    garde: gardePourFeuille,
    detenu: saisie.detenu,
    cellule: saisie.cellule,
    chefs: validerChefsAccusation_(ss, saisie.chefs),
    duree: saisie.duree,
    entree: saisie.entree,
    sortie,
    notes: saisie.notes
  };
}


/*
  Écrit A:L d'une ligne et restaure la ligne si l'écriture échoue. La
  validation de données de la cellule Infraction est retirée, le libellé
  composite des chefs ne figurant dans aucune liste déroulante.
*/
function ecrireLignePrison_(sheet, targetRow, values) {
  const targetRange = sheet.getRange(targetRow, 1, 1, PRISON_CHEFS_COLUMN);
  const previousValues = targetRange.getValues();
  const motifCell = sheet.getRange(targetRow, 5);
  const previousValidation = motifCell.getDataValidation();

  try {
    motifCell.clearDataValidations();
    targetRange.setValues([values]);

    sheet.getRange(targetRow, 9).insertCheckboxes();
    sheet.getRange(targetRow, 1).setNumberFormat("dd/MM/yyyy");
    sheet.getRange(targetRow, 7, 1, 2).setNumberFormat("dd/MM/yyyy HH:mm");

    SpreadsheetApp.flush();
  } catch (error) {
    try {
      targetRange.setValues(previousValues);
      if (previousValidation) motifCell.setDataValidation(previousValidation);
      SpreadsheetApp.flush();
    } catch (rollbackError) {
      console.error(
        "Impossible de restaurer la ligne de prison après un échec d'écriture.",
        rollbackError
      );
    }

    throw error;
  }
}


/*
  Durée de cachot en heures : strictement positive, fraction admise (0,5 pour
  trente minutes), ou vide pour « À déterminer ».
*/
function validerDureePrison_(value) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !value.trim())
  ) {
    throw new Error("La durée doit être strictement positive, ou laissée à déterminer.");
  }

  const duree = Number(typeof value === "string" ? value.replace(",", ".") : value);

  if (!Number.isFinite(duree) || duree <= 0) {
    throw new Error("La durée doit être strictement positive, ou laissée à déterminer.");
  }

  if (duree > PRISON_DUREE_MAX_HEURES) {
    throw new Error("La durée de cachot dépasse un an : vérifiez la saisie.");
  }

  return duree;
}


// ============================================================
// LIBÉRATION
// ============================================================

function modifierPrisonLibere(token, row, checked) {
  requireRole(token, ["GARDE", "OFFICIER"]);

  row = Number(row);

  if (!Number.isInteger(row) || row < 2) {
    throw new Error("Ligne de prison invalide.");
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(PRISON_SHEET_NAME);

  if (!sheet) {
    throw new Error("Feuille Prison introuvable.");
  }

  const lastRow = getLastNonEmptyRowInColumn(sheet, 1);

  if (row > lastRow) {
    throw new Error("Cette incarcération n'existe plus.");
  }

  const rowData = sheet.getRange(row, 1, 1, 5).getDisplayValues()[0];

  if (!rowData.some(value => String(value || "").trim())) {
    throw new Error("Cette ligne d'incarcération est vide.");
  }

  sheet.getRange(row, 9).setValue(Boolean(checked));

  SpreadsheetApp.flush();

  return getPrison(token);
}


// ============================================================
// SUPPRESSION - OFFICIER UNIQUEMENT
// ============================================================

function supprimerPrison(token, row) {
  requireRole(token, ["OFFICIER"]);

  row = Number(row);

  if (!Number.isInteger(row) || row < 2) {
    throw new Error("Ligne de prison invalide.");
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(PRISON_SHEET_NAME);

  if (!sheet) {
    throw new Error("Feuille Prison introuvable.");
  }

  const lastRow = getLastNonEmptyRowInColumn(sheet, 1);

  if (row > lastRow) {
    throw new Error("Cette incarcération n'existe plus.");
  }

  const largeur = Math.min(PRISON_CHEFS_COLUMN, sheet.getMaxColumns());
  const values = sheet.getRange(row, 1, 1, largeur).getDisplayValues()[0];

  if (!values.some(value => String(value || "").trim())) {
    throw new Error("Cette incarcération a déjà été supprimée.");
  }

  /*
    Même principe que pour Amendes :
    on conserve physiquement la ligne Sheet mais on vide A:L.
  */
  sheet.getRange(row, 1, 1, largeur).clearContent();

  SpreadsheetApp.flush();

  return getPrison(token);
}


// ============================================================
// HELPERS PRISON
// ============================================================

function parseDateTimeLocalPrison_(value) {
  const input = nettoyerSaisieUtilisateur(value);
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

  if (!match) {
    throw new Error("Format d'heure d'entrée invalide.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  const result = new Date(year, month - 1, day, hour, minute, 0, 0);

  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day ||
    result.getHours() !== hour ||
    result.getMinutes() !== minute
  ) {
    throw new Error("Date ou heure d'entrée invalide.");
  }

  return result;
}


function formatDatePrison_(value, fallback) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, PRISON_TIMEZONE, "dd/MM/yyyy");
  }

  return nettoyerSaisieUtilisateur(fallback);
}


function formatDateTimePrison_(value, fallback) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, PRISON_TIMEZONE, "dd/MM/yyyy HH:mm");
  }

  return nettoyerSaisieUtilisateur(fallback);
}


// Valeur prête pour un champ `datetime-local` du formulaire de modification.
function formatDateTimeLocalIsoPrison_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, PRISON_TIMEZONE, "yyyy-MM-dd'T'HH:mm");
  }

  return "";
}


function formatDureePrison_(value) {
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
  const minutes = Math.round((hours - wholeHours) * 60);

  if (!wholeHours) {
    return `${minutes} min`;
  }

  return `${wholeHours} h ${minutes} min`;
}
