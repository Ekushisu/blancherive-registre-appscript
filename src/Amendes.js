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
// H  Chefs d'accusation (JSON) — colonne technique, voir plus bas
//
// SyncCodex :
//
// A:J  Articles du Codex, indexés par `indexerArticlesCodex_` (Codex.js)
//      pour valider les chefs d'accusation. Les anciennes listes L:O ne sont
//      plus lues par l'application.
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
const AMENDES_CHEFS_COLUMN = 8;
const AMENDES_CHEFS_HEADER = "Chefs d'accusation (JSON)";


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

  const largeur = Math.min(AMENDES_CHEFS_COLUMN, sheet.getMaxColumns());
  const range = sheet.getRange(2, 1, lastRow - 1, largeur);
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
      chefs: lireChefsAccusation_(displayRow[AMENDES_CHEFS_COLUMN - 1]),

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
  // Lu au premier collecteur actif seulement (AliasGrades.js).
  let aliasGrades = null;
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
    if (!aliasGrades) aliasGrades = lireAliasGrades_(ss);
    // Un collecteur de l'Inquisition est nommé par l'alias de son grade.
    const gradeCollecteur = gradeAffiche_(nettoyerSaisieUtilisateur(row[grade]), row[corps], aliasGrades);
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

/*
  Les articles ne sont plus servis ici : le navigateur tient le Codex complet
  en cache (`getCodex`, `ui/src/codex.js`) et y cherche les chefs
  d'accusation. Seule la liste des gardes reste propre au formulaire.
*/
function getAmendeFormData(token) {
  requireRole(token, ["GARDE", "OFFICIER"]);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const donneesSheet = ss.getSheetByName(AMENDES_DONNEES_SHEET_NAME);

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
  `data` : { date, garde, contrevenant, chefs, montant }.

  `chefs` est une liste de références : `{ source, article }` pour un article
  du Codex, `{ libre }` pour une décision ou un décret hors Codex. Chaque
  référence est revalidée contre le cache SyncCodex ; le titre et la
  qualification sont figés à l'enregistrement.

  `montant` vide signifie « À déterminer » : l'amende est inscrite, son montant
  sera fixé par l'autorité et saisi par modification.
*/
function ajouterAmende(token, data) {
  requireRole(token, ["GARDE", "OFFICIER"]);

  if (!data) {
    throw new Error("Données de l'amende manquantes.");
  }

  const saisie = preparerSaisieAmende_(data);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const feuilles = ouvrirFeuillesAmendes_(ss);
    const ligne = construireLigneAmende_(ss, feuilles.donnees, saisie);

    const sheet = feuilles.amendes;
    garantirColonnesRegistre_(sheet, AMENDES_CHEFS_COLUMN, AMENDES_CHEFS_HEADER);

    const lastRow = getLastNonEmptyRowInColumn(sheet, 1);
    const targetRow = Math.max(2, lastRow + 1);

    ecrireLigneAmende_(sheet, targetRow, [
      ligne.date,
      ligne.garde,
      ligne.contrevenant,
      ligne.chefs.texte,
      ligne.montant,
      false,
      false,
      ligne.chefs.json
    ]);
  } finally {
    lock.releaseLock();
  }

  return getAmendes(token);
}


// ============================================================
// MODIFICATION - OFFICIER UNIQUEMENT
// ============================================================

/*
  Modifie la date, le garde, le contrevenant, les chefs d'accusation et le
  montant d'une amende existante. Les cases Payé et Reversé ne sont pas
  touchées : elles ont leur propre chemin et leur propre règle de rôle.

  `data.attendu` porte le garde et le contrevenant que l'officier avait sous
  les yeux. Si la ligne ne les porte plus (tri manuel de la feuille, autre
  modification entre-temps), rien n'est écrit : le numéro de ligne seul ne
  suffit pas à désigner une amende.
*/
function modifierAmende(token, row, data) {
  requireRole(token, ["OFFICIER"]);

  row = Number(row);

  if (!Number.isInteger(row) || row < 2) {
    throw new Error("Ligne d'amende invalide.");
  }

  if (!data) {
    throw new Error("Données de l'amende manquantes.");
  }

  const saisie = preparerSaisieAmende_(data);
  const attendu = lireIdentiteAttendue_(data.attendu, ["garde", "contrevenant"]);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const feuilles = ouvrirFeuillesAmendes_(ss);
    const sheet = feuilles.amendes;

    const lastRow = getLastNonEmptyRowInColumn(sheet, 1);

    if (row > lastRow) {
      throw new Error("Cette amende n'existe plus.");
    }

    garantirColonnesRegistre_(sheet, AMENDES_CHEFS_COLUMN, AMENDES_CHEFS_HEADER);

    const rangeActuel = sheet.getRange(row, 1, 1, AMENDES_CHEFS_COLUMN);
    const actuel = rangeActuel.getValues()[0];
    const affiche = rangeActuel.getDisplayValues()[0];

    if (!affiche.slice(0, 4).some(value => String(value || "").trim())) {
      throw new Error("Cette ligne d'amende est vide.");
    }

    verifierIdentiteRegistre_(
      { garde: affiche[1], contrevenant: affiche[2] },
      attendu,
      "Cette amende a changé depuis son affichage. Rechargez le registre avant de la modifier."
    );

    const ligne = construireLigneAmende_(ss, feuilles.donnees, saisie);

    ecrireLigneAmende_(sheet, row, [
      ligne.date,
      ligne.garde,
      ligne.contrevenant,
      ligne.chefs.texte,
      ligne.montant,
      actuel[5] === true,
      actuel[6] === true,
      ligne.chefs.json
    ]);
  } finally {
    lock.releaseLock();
  }

  return getAmendes(token);
}


// ============================================================
// HELPERS D'ÉCRITURE AMENDES
// ============================================================

function preparerSaisieAmende_(data) {
  const dateInput = nettoyerSaisieUtilisateur(data.date);
  const garde = nettoyerSaisieUtilisateur(data.garde);
  const contrevenant = nettoyerSaisieUtilisateur(data.contrevenant);

  if (!dateInput) {
    throw new Error("La date est obligatoire.");
  }

  if (!garde) {
    throw new Error("Le garde est obligatoire.");
  }

  if (!contrevenant) {
    throw new Error("Le contrevenant est obligatoire.");
  }

  if (contrevenant.length > 200) {
    throw new Error("Le nom du contrevenant est limité à 200 caractères.");
  }

  if (data.infraction !== undefined && data.chefs === undefined) {
    throw new Error("Ce formulaire n'est plus à jour. Actualisez la page puis saisissez les chefs d'accusation.");
  }

  return {
    date: parseDateInput(dateInput),
    garde,
    contrevenant,
    chefs: data.chefs,
    montant: validerMontantAmende_(data.montant)
  };
}


function ouvrirFeuillesAmendes_(ss) {
  const amendes = ss.getSheetByName(AMENDES_SHEET_NAME);
  const donnees = ss.getSheetByName(AMENDES_DONNEES_SHEET_NAME);

  if (!amendes) {
    throw new Error("Feuille Amendes introuvable.");
  }

  if (!donnees) {
    throw new Error("Feuille Données introuvable.");
  }

  return { amendes, donnees };
}


function construireLigneAmende_(ss, donneesSheet, saisie) {
  const gardePourFeuille = trouverValeurTechniqueBrute(
    donneesSheet,
    15,
    saisie.garde
  );

  if (gardePourFeuille === null) {
    throw new Error("Le garde sélectionné n'est pas reconnu.");
  }

  return {
    date: saisie.date,
    garde: gardePourFeuille,
    contrevenant: saisie.contrevenant,
    chefs: validerChefsAccusation_(ss, saisie.chefs),
    montant: saisie.montant
  };
}


/*
  Écrit A:H d'une ligne d'amende et restaure la ligne si l'écriture échoue.

  La validation de données de la cellule Infraction est retirée : le libellé
  composite des chefs d'accusation ne figure dans aucune liste déroulante.
  Elle est remise en place en cas d'échec.
*/
function ecrireLigneAmende_(sheet, targetRow, values) {
  const targetRange = sheet.getRange(targetRow, 1, 1, AMENDES_CHEFS_COLUMN);
  const previousValues = targetRange.getValues();
  const motifCell = sheet.getRange(targetRow, 4);
  const previousValidation = motifCell.getDataValidation();

  try {
    motifCell.clearDataValidations();
    targetRange.setValues([values]);

    sheet
      .getRange(targetRow, 6, 1, 2)
      .insertCheckboxes();

    sheet
      .getRange(targetRow, 1)
      .setNumberFormat("dd/MM/yyyy");

    SpreadsheetApp.flush();
  } catch (error) {
    try {
      targetRange.setValues(previousValues);
      if (previousValidation) motifCell.setDataValidation(previousValidation);
      SpreadsheetApp.flush();
    } catch (rollbackError) {
      console.error(
        "Impossible de restaurer la ligne d'amende après un échec d'écriture.",
        rollbackError
      );
    }

    throw error;
  }
}


/*
  Montant d'une amende : entier strictement positif en septims, ou vide pour
  « À déterminer ». Le montant est fixé à l'appréciation de l'autorité ; le
  Codex ne le contraint pas.
*/
function validerMontantAmende_(value) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !value.trim())
  ) {
    throw new Error("Le montant doit être un entier strictement positif, ou laissé à déterminer.");
  }

  const montant = Number(value);

  if (!Number.isSafeInteger(montant) || montant <= 0) {
    throw new Error("Le montant doit être un entier strictement positif, ou laissé à déterminer.");
  }

  return montant;
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

  const largeur = Math.min(AMENDES_CHEFS_COLUMN, sheet.getMaxColumns());

  const values = sheet
    .getRange(row, 1, 1, largeur)
    .getDisplayValues()[0];

  if (!values.some(value => String(value || "").trim())) {
    throw new Error("Cette amende a déjà été supprimée.");
  }

  /*
    On ne supprime PAS physiquement la ligne Sheet.
    On vide uniquement A:H.

    Cela évite de décaler les lignes et d'éventuels éléments
    situés ailleurs dans la feuille.
  */
  sheet
    .getRange(row, 1, 1, largeur)
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


function trouverValeurTechniqueBrute(sheet, column, value) {
  if (!sheet) {
    return null;
  }

  const valueToFind = nettoyerSaisieUtilisateur(value);

  if (!valueToFind) {
    return null;
  }

  const lastRow = getLastNonEmptyRowInColumn(
    sheet,
    column
  );

  if (lastRow < 2) {
    return null;
  }

  const values = sheet
    .getRange(2, column, lastRow - 1, 1)
    .getValues();

  for (const row of values) {
    const rawValue = row[0];

    if (
      nettoyerSaisieUtilisateur(rawValue) ===
      valueToFind
    ) {
      return rawValue;
    }
  }

  return null;
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


// ============================================================
// CHEFS D'ACCUSATION - PARTAGÉ AVEC PRISON
// ============================================================

/*
  Une amende ou une incarcération porte un ou plusieurs chefs d'accusation.
  Chaque chef est soit un article du Codex, identifié par sa source et son
  numéro, soit une référence libre (décret, décision d'une autorité).

  Colonne texte (Amendes!D, Prison!E) : libellé lisible dans Sheets,
  « CPL art. 16 — Injure ; Motif personnalisé — Décision du Thane ».

  Colonne technique (Amendes!H, Prison!L) : JSON version 1,
  { version: 1, chefs: [ { source, article, titre, classification, abrege },
                         { libre: "..." } ] }.
  Le titre, la qualification et le sigle sont des instantanés : un article
  renommé ou un décret retiré ne modifie pas la ligne enregistrée.

  Les lignes antérieures n'ont pas de JSON ; leur colonne texte reste affichée
  telle quelle et se résout à l'ancienne dans l'interface.
*/
const CHEFS_ACCUSATION_VERSION = 1;
const CHEFS_ACCUSATION_MAX = 20;
const CHEFS_ACCUSATION_MOTIF_MAX = 1000;
const CHEFS_ACCUSATION_JSON_MAX = 45000;
const CHEFS_ACCUSATION_PREFIXE_LIBRE = "Motif personnalisé — ";

function libelleChefAccusation_(chef) {
  if (chef.libre !== undefined) {
    return CHEFS_ACCUSATION_PREFIXE_LIBRE + chef.libre;
  }

  const reference = `${chef.abrege} art. ${chef.article}`;

  return chef.titre ? `${reference} — ${chef.titre}` : reference;
}


/*
  Valide la liste envoyée par le navigateur et renvoie les deux formes à
  écrire. L'index du Codex n'est lu qu'une fois par requête, et seulement si
  un chef y renvoie : une liste ne contenant que des références libres ne
  touche pas à SyncCodex.
*/
function validerChefsAccusation_(ss, chefs) {
  if (!Array.isArray(chefs) || !chefs.length) {
    throw new Error("Indiquez au moins un chef d'accusation.");
  }

  if (chefs.length > CHEFS_ACCUSATION_MAX) {
    throw new Error(`Une même entrée ne peut porter plus de ${CHEFS_ACCUSATION_MAX} chefs d'accusation.`);
  }

  const besoinCodex = chefs.some(chef => chef && chef.libre === undefined);
  const index = besoinCodex ? indexerArticlesCodex_(ss) : null;
  const vus = new Set();
  const result = [];

  chefs.forEach(function (chef) {
    if (!chef || typeof chef !== "object") {
      throw new Error("Chef d'accusation invalide.");
    }

    if (chef.libre !== undefined) {
      if (typeof chef.libre !== "string") {
        throw new Error("Chef d'accusation invalide.");
      }

      const motif = nettoyerSaisieUtilisateur(chef.libre).replace(/\s+/g, " ");

      if (!motif || motif.length > CHEFS_ACCUSATION_MOTIF_MAX) {
        throw new Error(`Un motif personnalisé compte de 1 à 1 000 caractères.`);
      }

      const cle = "libre|" + motif.toLowerCase();

      if (vus.has(cle)) {
        throw new Error("Un même chef d'accusation est indiqué deux fois.");
      }

      vus.add(cle);
      result.push({ libre: motif });
      return;
    }

    if (typeof chef.source !== "string" || typeof chef.article !== "string") {
      throw new Error("Chef d'accusation invalide.");
    }

    const cle = cleArticleCodex_(chef.source, chef.article);
    const article = index.get(cle);

    if (!article) {
      throw new Error("Un article cité ne figure plus au Codex. Retirez-le puis relancez la recherche.");
    }

    if (!article.citable) {
      throw new Error(`« ${article.source} » est un document de contexte : ses articles ne fondent pas de chef d'accusation.`);
    }

    if (vus.has(cle)) {
      throw new Error("Un même chef d'accusation est indiqué deux fois.");
    }

    vus.add(cle);

    // Le titre envoyé par le navigateur n'est jamais une source de confiance.
    result.push({
      source: article.source,
      article: article.article,
      titre: article.titre,
      classification: article.classification,
      abrege: article.abrege
    });
  });

  const json = JSON.stringify({ version: CHEFS_ACCUSATION_VERSION, chefs: result });

  if (json.length > CHEFS_ACCUSATION_JSON_MAX) {
    throw new Error("La liste des chefs d'accusation est trop volumineuse.");
  }

  return {
    chefs: result,
    texte: result.map(libelleChefAccusation_).join(" ; "),
    json: json
  };
}


/*
  Relit la colonne technique d'une ligne. Renvoie la liste des chefs, ou
  `null` pour une ligne antérieure ou un JSON non reconnu : la colonne texte
  fait alors foi, comme avant.
*/
function lireChefsAccusation_(raw) {
  const text = String(raw || "").trim();

  if (!text) {
    return null;
  }

  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch (_) {
    return null;
  }

  if (!parsed || parsed.version !== CHEFS_ACCUSATION_VERSION || !Array.isArray(parsed.chefs)) {
    return null;
  }

  const valides = parsed.chefs.every(chef =>
    chef && typeof chef === "object" && (
      typeof chef.libre === "string" ||
      (typeof chef.source === "string" && typeof chef.article === "string" && typeof chef.titre === "string")
    )
  );

  if (!valides || !parsed.chefs.length) {
    return null;
  }

  return parsed.chefs.map(chef => chef.libre !== undefined
    ? { libre: chef.libre }
    : {
        source: chef.source,
        article: chef.article,
        titre: chef.titre,
        classification: typeof chef.classification === "string" ? chef.classification : "",
        abrege: typeof chef.abrege === "string" && chef.abrege ? chef.abrege : abregerSourceCodex_(chef.source, "")
      });
}


/*
  Les registres Amendes et Prison ont été créés avec sept et onze colonnes.
  La colonne technique des chefs d'accusation vient juste après : on l'ajoute
  à la feuille si elle manque, avec son en-tête, sans déplacer les autres.
*/
function garantirColonnesRegistre_(sheet, colonne, entete) {
  const max = sheet.getMaxColumns();

  if (max < colonne) {
    sheet.insertColumnsAfter(max, colonne - max);
  }

  const cellule = sheet.getRange(1, colonne);

  if (!String(cellule.getDisplayValue() || "").trim()) {
    cellule.setValue(entete);
  }
}


/*
  Identité attendue d'une ligne avant modification : les champs affichés à
  l'officier, tels quels. Refus explicite si le navigateur ne les envoie pas.
*/
function lireIdentiteAttendue_(attendu, champs) {
  if (!attendu || typeof attendu !== "object") {
    throw new Error("Ce formulaire n'est plus à jour. Rechargez le registre avant de modifier une entrée.");
  }

  const result = {};

  champs.forEach(function (champ) {
    if (typeof attendu[champ] !== "string") {
      throw new Error("Ce formulaire n'est plus à jour. Rechargez le registre avant de modifier une entrée.");
    }

    result[champ] = nettoyerSaisieUtilisateur(attendu[champ]);
  });

  return result;
}


function verifierIdentiteRegistre_(actuel, attendu, message) {
  const different = Object.keys(attendu).some(
    champ => nettoyerSaisieUtilisateur(actuel[champ]) !== attendu[champ]
  );

  if (different) {
    throw new Error(message);
  }
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
