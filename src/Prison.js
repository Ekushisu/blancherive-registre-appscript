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
// M  Sortie — issue (code de PRISON_ISSUES)
// N  Sortie — destination (châtellerie ou ordre)
// O  Sortie — remis à (personne qui reçoit le détenu)
// P  Sortie — date effective
// Q  Sortie — garde ayant prononcé l'acte
// R  Sortie — motif
// S  Journal (JSON) — notes et actes datés, signés, à ajout seul
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

  const largeur = Math.min(PRISON_LARGEUR, sheet.getMaxColumns());
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
      notes: nettoyerSaisieUtilisateur(displayRow[10]),
      // Acte de sortie (M:R) et journal (S) ; null et [] pour une ligne
      // antérieure à cette version, cochée ou non.
      acteSortie: lireSortiePrison_(valueRow, displayRow),
      journal: lireJournalPrison_(displayRow[PRISON_SORTIE_COLONNES.journal - 1])
    });
  }

  rows.reverse();

  return { rows };
}


// ============================================================
// DONNÉES DU FORMULAIRE
// ============================================================

function getPrisonFormData(token) {
  const auth = requireRole(token, ["GARDE", "OFFICIER"]);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const donneesSheet = ss.getSheetByName(PRISON_DONNEES_SHEET_NAME);

  if (!donneesSheet) {
    throw new Error("Feuille Données introuvable.");
  }

  return {
    gardes: lireColonneTechnique(donneesSheet, 15),
    // Session Discord : le garde est celui qui saisit (Auth.js).
    gardeImpose: gardeImposeSession_(auth),
    // Issues possibles d'une détention, dans l'ordre proposé au registre.
    issues: PRISON_ISSUES.map(issue => Object.assign({}, issue))
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
  const auth = requireRole(token, ["GARDE", "OFFICIER"]);
  if (!data) throw new Error("Données d'incarcération manquantes.");
  // Session Discord : l'incarcération est prononcée au nom de celui qui la saisit.
  const saisie = preparerSaisiePrison_(imposerGardeSession_(auth, data));
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
  prévue est recalculée. La case Libéré, l'acte de sortie et le journal
  (I, M:S) ne sont pas touchés.

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
// SORTIE DE DÉTENTION — acte complet, jamais une simple case
// ============================================================
//
// Décision du propriétaire, 7 novembre 2026 : la sortie d'un détenu est un
// acte qui porte son issue, la personne à qui il est remis (transferts), la
// date effective, le garde qui la prononce et un motif obligatoire. La case
// Libéré (I) reste écrite pour la fiche de service et les anciennes lignes,
// mais ne se bascule plus seule : `modifierPrisonLibere` a été retirée.
//
// Les issues vivent ici, fermées : chacune porte un comportement (nom de la
// châtellerie ou de l'ordre, personne destinataire). Ne pas les déplacer
// dans une feuille.

const PRISON_SORTIE_COLONNES = {
  issue: 13,       // M
  destination: 14, // N  nom de la châtellerie ou de l'ordre
  remisA: 15,      // O  personne à qui le détenu est remis
  date: 16,        // P  date et heure effectives
  garde: 17,       // Q  garde ayant prononcé la sortie
  motif: 18,       // R
  journal: 19      // S  journal (JSON)
};
const PRISON_SORTIE_ENTETES = {
  issue: "Sortie — issue",
  destination: "Sortie — destination",
  remisA: "Sortie — remis à",
  date: "Sortie — date",
  garde: "Sortie — garde",
  motif: "Sortie — motif",
  journal: "Journal (JSON)"
};
const PRISON_LARGEUR = 19;

// `transfert` : la personne qui reçoit le détenu (`remisA`) est exigée.
// `destination` : libellé du champ qui nomme la châtellerie ou l'ordre, vide
// quand l'issue n'en demande pas ; `destinationNom` sert aux phrases.
const PRISON_ISSUES = [
  { code: "LIBERATION", libelle: "Libération", transfert: false, destination: "", destinationNom: "" },
  { code: "LIBERATION_ANTICIPEE", libelle: "Libération anticipée", transfert: false, destination: "", destinationNom: "" },
  { code: "TRANSFERT_EMPIRE", libelle: "Transfert à l'Empire", transfert: true, destination: "", destinationNom: "" },
  { code: "TRANSFERT_THALMOR", libelle: "Transfert au Thalmor", transfert: true, destination: "", destinationNom: "" },
  { code: "TRANSFERT_CHATELLERIE", libelle: "Transfert à une châtellerie", transfert: true, destination: "Châtellerie", destinationNom: "la châtellerie" },
  { code: "TRANSFERT_ORDRE", libelle: "Transfert à un ordre", transfert: true, destination: "Ordre", destinationNom: "l'ordre" },
  { code: "EVASION", libelle: "Évasion", transfert: false, destination: "", destinationNom: "" },
  { code: "DECES", libelle: "Décès en détention", transfert: false, destination: "", destinationNom: "" }
];

const PRISON_MOTIF_MAX = 2000;
const PRISON_NOTE_MAX = 2000;
const PRISON_NOM_MAX = 200;
const PRISON_JOURNAL_MAX = 45000;


function trouverIssuePrison_(code) {
  const propre = nettoyerSaisieUtilisateur(code);
  return PRISON_ISSUES.find(issue => issue.code === propre) || null;
}


function libelleIssuePrison_(code) {
  const issue = trouverIssuePrison_(code);
  return issue ? issue.libelle : nettoyerSaisieUtilisateur(code);
}


/*
  Prononce la sortie d'un détenu. GARDE et OFFICIER, pour toute issue
  (décision du propriétaire, 7 novembre 2026).

  `data` : { issue, destination, remisA, date, garde, motif, attendu }.
  - `issue` : code de `PRISON_ISSUES`.
  - `destination` : nom de la châtellerie ou de l'ordre, exigé pour ces deux
    transferts seulement.
  - `remisA` : personne à qui le détenu est remis, exigée pour tout transfert.
  - `date` : `yyyy-MM-ddTHH:mm`, jamais avant l'entrée.
  - `garde` : auteur de l'acte, dans `Données!O` ; imposé en session Discord.
  - `motif` : obligatoire, quelle que soit l'issue.
  - `attendu` : garde et détenu affichés, comme pour `modifierPrison`.

  Une libération prononcée avant la sortie prévue est enregistrée comme
  libération anticipée. Une incarcération déjà close est refusée : l'officier
  annule d'abord l'acte (`annulerSortiePrison`).
*/
function prononcerSortiePrison(token, row, data) {
  const auth = requireRole(token, ["GARDE", "OFFICIER"]);
  if (!data) throw new Error("Données de sortie manquantes.");

  const issue = trouverIssuePrison_(data.issue);
  if (!issue) throw new Error("Choisissez l'issue de la détention.");

  const destination = nettoyerSaisieUtilisateur(data.destination);
  const remisA = nettoyerSaisieUtilisateur(data.remisA);
  const motif = nettoyerSaisieUtilisateur(data.motif);

  if (issue.destination && !destination) {
    throw new Error(`Indiquez le nom de ${issue.destinationNom} qui reçoit le détenu.`);
  }
  if (destination.length > PRISON_NOM_MAX) throw new Error(`Le nom de la destination est limité à ${PRISON_NOM_MAX} caractères.`);
  if (issue.transfert && !remisA) {
    throw new Error("Indiquez le nom de la personne à qui le détenu est remis.");
  }
  if (remisA.length > PRISON_NOM_MAX) throw new Error(`Le nom de la personne destinataire est limité à ${PRISON_NOM_MAX} caractères.`);
  if (!motif) throw new Error("Le motif de la sortie est obligatoire.");
  if (motif.length > PRISON_MOTIF_MAX) throw new Error(`Le motif est limité à ${PRISON_MOTIF_MAX} caractères.`);

  const dateSortie = parseDateTimeLocalPrison_(data.date, "de sortie");
  const attendu = lireIdentiteAttendue_(data.attendu, ["garde", "detenu"]);

  return ecrireActePrison_(token, auth, row, data, attendu, function (ligne, auteur) {
    if (ligne.valeurs[8] === true || String(ligne.affiche[PRISON_SORTIE_COLONNES.issue - 1] || "").trim()) {
      throw new Error("Cette incarcération est déjà close. Un officier doit annuler la sortie avant d'en prononcer une autre.");
    }

    const entree = ligne.valeurs[6];
    if (entree instanceof Date && !isNaN(entree.getTime()) && dateSortie.getTime() < entree.getTime()) {
      throw new Error("La sortie ne peut pas précéder l'entrée en cellule.");
    }

    let code = issue.code;
    const prevue = ligne.valeurs[7];
    if (code === "LIBERATION" && prevue instanceof Date && !isNaN(prevue.getTime()) && dateSortie.getTime() < prevue.getTime()) {
      code = "LIBERATION_ANTICIPEE";
    }

    const destinationRetenue = issue.destination ? destination : "";
    const remisARetenu = issue.transfert ? remisA : "";

    const evenement = {
      quand: horodatageJournalPrison_(new Date()),
      type: "sortie",
      qui: auteur,
      issue: code,
      destination: destinationRetenue,
      remisA: remisARetenu,
      date: formatDateTimePrison_(dateSortie, ""),
      texte: motif
    };

    return {
      cases: [
        [9, true],
        [PRISON_SORTIE_COLONNES.issue, code],
        [PRISON_SORTIE_COLONNES.destination, destinationRetenue],
        [PRISON_SORTIE_COLONNES.remisA, remisARetenu],
        [PRISON_SORTIE_COLONNES.date, dateSortie],
        [PRISON_SORTIE_COLONNES.garde, auteur],
        [PRISON_SORTIE_COLONNES.motif, motif]
      ],
      evenement
    };
  });
}


/*
  Annule une sortie : OFFICIER seul, motif obligatoire. Le détenu redevient en
  cellule ; les colonnes de sortie sont vidées, le journal garde l'acte annulé.
  `data` : { garde, motif, attendu }.
*/
function annulerSortiePrison(token, row, data) {
  const auth = requireRole(token, ["OFFICIER"]);
  if (!data) throw new Error("Données d'annulation manquantes.");

  const motif = nettoyerSaisieUtilisateur(data.motif);
  if (!motif) throw new Error("Le motif de l'annulation est obligatoire.");
  if (motif.length > PRISON_MOTIF_MAX) throw new Error(`Le motif est limité à ${PRISON_MOTIF_MAX} caractères.`);

  const attendu = lireIdentiteAttendue_(data.attendu, ["garde", "detenu"]);

  return ecrireActePrison_(token, auth, row, data, attendu, function (ligne, auteur) {
    const issueActuelle = String(ligne.affiche[PRISON_SORTIE_COLONNES.issue - 1] || "").trim();

    if (ligne.valeurs[8] !== true && !issueActuelle) {
      throw new Error("Cette incarcération n'est pas close : rien à annuler.");
    }

    const evenement = {
      quand: horodatageJournalPrison_(new Date()),
      type: "annulation",
      qui: auteur,
      issue: issueActuelle,
      texte: motif
    };

    return {
      cases: [
        [9, false],
        [PRISON_SORTIE_COLONNES.issue, ""],
        [PRISON_SORTIE_COLONNES.destination, ""],
        [PRISON_SORTIE_COLONNES.remisA, ""],
        [PRISON_SORTIE_COLONNES.date, ""],
        [PRISON_SORTIE_COLONNES.garde, ""],
        [PRISON_SORTIE_COLONNES.motif, ""]
      ],
      evenement
    };
  });
}


/*
  Ajoute une note datée et signée au journal d'une incarcération. GARDE et
  OFFICIER ; une note ne se modifie ni ne s'efface. `data` : { garde, texte,
  attendu }.
*/
function ajouterNotePrison(token, row, data) {
  const auth = requireRole(token, ["GARDE", "OFFICIER"]);
  if (!data) throw new Error("Données de note manquantes.");

  const texte = nettoyerSaisieUtilisateur(data.texte);
  if (!texte) throw new Error("La note est vide.");
  if (texte.length > PRISON_NOTE_MAX) throw new Error(`Une note est limitée à ${PRISON_NOTE_MAX} caractères.`);

  const attendu = lireIdentiteAttendue_(data.attendu, ["garde", "detenu"]);

  return ecrireActePrison_(token, auth, row, data, attendu, function (ligne, auteur) {
    return {
      cases: [],
      evenement: {
        quand: horodatageJournalPrison_(new Date()),
        type: "note",
        qui: auteur,
        texte
      }
    };
  });
}


/*
  Chemin commun des actes : verrou, ligne existante et non vide, identité
  affichée, auteur reconnu dans `Données!O` (imposé en session Discord), puis
  écriture des seules cases demandées et de l'événement en fin de journal.
  `construire(ligne, auteur)` renvoie { cases: [[colonne, valeur]], evenement }.
*/
function ecrireActePrison_(token, auth, row, data, attendu, construire) {
  row = Number(row);
  if (!Number.isInteger(row) || row < 2) throw new Error("Ligne de prison invalide.");

  const gardeSaisi = nettoyerSaisieUtilisateur(imposerGardeSession_(auth, data).garde);
  if (!gardeSaisi) throw new Error("Indiquez le garde qui signe cet acte.");

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const feuilles = ouvrirFeuillesPrison_(ss);
    const sheet = feuilles.prison;

    const lastRow = getLastNonEmptyRowInColumn(sheet, 1);
    if (row > lastRow) throw new Error("Cette incarcération n'existe plus.");

    garantirColonnesSortiePrison_(sheet);

    const range = sheet.getRange(row, 1, 1, PRISON_LARGEUR);
    const ligne = { valeurs: range.getValues()[0], affiche: range.getDisplayValues()[0] };

    if (!ligne.affiche.slice(0, 5).some(value => String(value || "").trim())) {
      throw new Error("Cette ligne d'incarcération est vide.");
    }

    verifierIdentiteRegistre_(
      { garde: ligne.affiche[1], detenu: ligne.affiche[2] },
      attendu,
      "Cette incarcération a changé depuis son affichage. Rechargez le registre avant d'agir."
    );

    if (trouverValeurTechniqueBrute(feuilles.donnees, 15, gardeSaisi) === null) {
      throw new Error("Le garde qui signe n'est pas reconnu.");
    }

    const acte = construire(ligne, gardeSaisi);
    const journal = lireJournalPrison_(ligne.affiche[PRISON_SORTIE_COLONNES.journal - 1]);
    journal.push(acte.evenement);
    const journalJson = JSON.stringify(journal);
    if (journalJson.length > PRISON_JOURNAL_MAX) {
      throw new Error("Le journal de cette incarcération est plein.");
    }

    acte.cases.forEach(function (c) {
      sheet.getRange(row, c[0]).setValue(c[1]);
    });
    sheet.getRange(row, PRISON_SORTIE_COLONNES.date).setNumberFormat("dd/MM/yyyy HH:mm");
    sheet.getRange(row, PRISON_SORTIE_COLONNES.journal).setValue(journalJson);

    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  return getPrison(token);
}


function garantirColonnesSortiePrison_(sheet) {
  garantirColonnesRegistre_(sheet, PRISON_CHEFS_COLUMN, PRISON_CHEFS_HEADER);
  Object.keys(PRISON_SORTIE_COLONNES).forEach(function (cle) {
    garantirColonnesRegistre_(sheet, PRISON_SORTIE_COLONNES[cle], PRISON_SORTIE_ENTETES[cle]);
  });
}


// Sortie d'une ligne telle que le registre l'affiche ; null tant qu'aucune
// issue n'est écrite (anciennes lignes cochées comprises).
function lireSortiePrison_(valueRow, displayRow) {
  const c = PRISON_SORTIE_COLONNES;
  const code = nettoyerSaisieUtilisateur(displayRow[c.issue - 1]);
  if (!code) return null;
  const issue = trouverIssuePrison_(code);
  return {
    issue: code,
    libelle: libelleIssuePrison_(code),
    transfert: issue ? issue.transfert : false,
    destination: nettoyerSaisieUtilisateur(displayRow[c.destination - 1]),
    remisA: nettoyerSaisieUtilisateur(displayRow[c.remisA - 1]),
    date: formatDateTimePrison_(valueRow[c.date - 1], displayRow[c.date - 1]),
    garde: nettoyerSaisieUtilisateur(displayRow[c.garde - 1]),
    motif: nettoyerSaisieUtilisateur(displayRow[c.motif - 1])
  };
}


// Journal d'une ligne : liste d'événements { quand, type, qui, texte, ... }.
// Une cellule illisible vaut un journal vide, jamais une erreur de lecture.
function lireJournalPrison_(texte) {
  const brut = String(texte === undefined || texte === null ? "" : texte).trim();
  if (!brut) return [];
  try {
    const liste = JSON.parse(brut);
    if (!Array.isArray(liste)) return [];
    return liste.filter(e => e && typeof e === "object").map(function (e) {
      const evenement = {
        quand: nettoyerSaisieUtilisateur(e.quand),
        type: nettoyerSaisieUtilisateur(e.type),
        qui: nettoyerSaisieUtilisateur(e.qui),
        texte: nettoyerSaisieUtilisateur(e.texte)
      };
      ["issue", "destination", "remisA", "date"].forEach(function (cle) {
        if (e[cle] !== undefined) evenement[cle] = nettoyerSaisieUtilisateur(e[cle]);
      });
      if (evenement.issue) evenement.libelle = libelleIssuePrison_(evenement.issue);
      return evenement;
    });
  } catch (error) {
    return [];
  }
}


function horodatageJournalPrison_(date) {
  return Utilities.formatDate(date, PRISON_TIMEZONE, "dd/MM/yyyy HH:mm");
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

  const largeur = Math.min(PRISON_LARGEUR, sheet.getMaxColumns());
  const values = sheet.getRange(row, 1, 1, largeur).getDisplayValues()[0];

  if (!values.some(value => String(value || "").trim())) {
    throw new Error("Cette incarcération a déjà été supprimée.");
  }

  /*
    Même principe que pour Amendes :
    on conserve physiquement la ligne Sheet mais on vide A:S, journal compris.
  */
  sheet.getRange(row, 1, 1, largeur).clearContent();

  SpreadsheetApp.flush();

  return getPrison(token);
}


// ============================================================
// HELPERS PRISON
// ============================================================

function parseDateTimeLocalPrison_(value, libelle) {
  const quoi = libelle || "d'entrée";
  const input = nettoyerSaisieUtilisateur(value);
  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

  if (!match) {
    throw new Error(`Format d'heure ${quoi} invalide.`);
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
    throw new Error(`Date ou heure ${quoi} invalide.`);
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
