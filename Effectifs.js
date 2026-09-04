// ============================================================
// EFFECTIFS - API WEB OFFICIER
// ============================================================
//
// Cette API ne permet JAMAIS de supprimer un membre.
//
// Elle travaille par en-têtes, donc elle ne dépend pas de la
// position exacte des colonnes dans la feuille Effectifs.
//
// En-têtes reconnus :
// - Prénom
// - Nom
// - Grade
// - Corps / Corps de garde
// - Spécialité
// - Status / Statut
// - Assermenté / Assermente
//
// Tous les endpoints sont réservés au rôle OFFICIER.
//
// IMPORTANT : SPREADSHEET_ID existe déjà dans le projet.
// Ne pas le redéclarer ici.
// ============================================================

const EFFECTIFS_WEB_SHEET_NAME = "Effectifs";
const EFFECTIFS_WEB_DONNEES_SHEET_NAME = "Données";
const EFFECTIFS_WEB_SYNC_CODEX_SHEET_NAME = "SyncCodex";
const EFFECTIFS_WEB_ACTIVE_STATUS = "En service actif";
const EFFECTIFS_WEB_RESERVE_STATUS = "Réserve";

/*
  Ces statuts ne sont plus masqués.
  Ils sont classés dans quatre groupes trans-corps affichés
  tout en bas de la page Effectifs.
*/
const EFFECTIFS_WEB_TERMINAL_STATUS_GROUPS = [
  {
    label: "Morts",
    aliases: [
      "Mort",
      "Morte",
      "Décédé",
      "Décédée"
    ]
  },
  {
    label: "Radiés",
    aliases: [
      "Radié",
      "Radiée"
    ]
  },
  {
    label: "Démissionnaires",
    aliases: [
      "Démissionnaire",
      "Démissionné",
      "Démissionnée"
    ]
  },
  {
    label: "Déserteurs",
    aliases: [
      "Déserteur",
      "Déserteuse"
    ]
  }
];


// ============================================================
// API - LECTURE
// ============================================================

function getEffectifs(token) {
  requireRole(token, ["OFFICIER"]);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(EFFECTIFS_WEB_SHEET_NAME);

  if (!sheet) {
    throw new Error('Feuille "Effectifs" introuvable.');
  }

  const schema = lireSchemaEffectifsWeb_(sheet);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  /*
    Données!A2:A est la source de vérité pour :
    - l'ordre hiérarchique des grades ;
    - la couleur de fond associée à chaque grade.
  */
  const gradeMeta = lireMetadonneesGradesEffectifsWeb_(ss);
  const gradeOrder = gradeMeta.order;

  const rows = [];

  const styles = {
    grades: gradeMeta.styles,
    corps: {},
    specialites: {},
    statuses: {}
  };

  if (lastRow >= 2) {
    const range = sheet.getRange(
      2,
      1,
      lastRow - 1,
      lastColumn
    );

    const values = range.getValues();
    const display = range.getDisplayValues();
    const backgrounds = range.getBackgrounds();
    const fontColors = range.getFontColors();
    const fontWeights = range.getFontWeights();

    for (let i = 0; i < values.length; i++) {
      const prenom = nettoyerEffectifsWeb_(
        display[i][schema.prenom]
      );

      const nom = nettoyerEffectifsWeb_(
        display[i][schema.nom]
      );

      if (!prenom && !nom) {
        continue;
      }

      const grade = nettoyerEffectifsWeb_(
        display[i][schema.grade]
      );

      const corps = nettoyerEffectifsWeb_(
        display[i][schema.corps]
      );

      const specialite = nettoyerEffectifsWeb_(
        display[i][schema.specialite]
      );

      const status = nettoyerEffectifsWeb_(
        display[i][schema.status]
      );

      const groupeTerminal =
        getGroupeTerminalEffectifsWeb_(status);

      const rowStyles = {
        /*
          Le grade vient volontairement de Données,
          pas de la cellule Effectifs.
        */
        grade:
          styles.grades[grade] ||
          styleCelluleEffectifsWeb_(
            "",
            "",
            ""
          ),

        corps:
          styleCelluleEffectifsWeb_(
            backgrounds[i][schema.corps],
            fontColors[i][schema.corps],
            fontWeights[i][schema.corps]
          ),

        specialite:
          styleCelluleEffectifsWeb_(
            backgrounds[i][schema.specialite],
            fontColors[i][schema.specialite],
            fontWeights[i][schema.specialite]
          ),

        status:
          styleCelluleEffectifsWeb_(
            backgrounds[i][schema.status],
            fontColors[i][schema.status],
            fontWeights[i][schema.status]
          )
      };

      memoriserStyleOptionEffectifsWeb_(
        styles.corps,
        corps,
        rowStyles.corps
      );

      memoriserStyleOptionEffectifsWeb_(
        styles.specialites,
        specialite,
        rowStyles.specialite
      );

      memoriserStyleOptionEffectifsWeb_(
        styles.statuses,
        status,
        rowStyles.status
      );

      rows.push({
        row: i + 2,

        prenom,
        nom,
        nomComplet:
          `${prenom} ${nom}`.trim(),

        grade,
        corps,
        specialite,
        status,

        reserve:
          !groupeTerminal &&
          estReserveEffectifsWeb_(status),

        terminalGroup:
          groupeTerminal,

        assermente:
          values[i][schema.assermente] === true,

        styles: rowStyles
      });
    }
  }

  /*
    Tri serveur stable :
    1. membres courants et réserve, groupés par corps ;
    2. membres sortis définitivement à la fin ;
    3. à l'intérieur : grade -> nom.

    L'interface construit ensuite :
    - les groupes de grades ;
    - Réserve en dernier dans chaque corps ;
    - les quatre groupes trans-corps terminaux tout en bas.
  */
  rows.sort((a, b) => {
    const aTerminal = Boolean(a.terminalGroup);
    const bTerminal = Boolean(b.terminalGroup);

    if (aTerminal !== bTerminal) {
      return aTerminal ? 1 : -1;
    }

    if (aTerminal && bTerminal) {
      const terminalOrder =
        EFFECTIFS_WEB_TERMINAL_STATUS_GROUPS
          .map(item => item.label);

      const terminalA =
        terminalOrder.indexOf(a.terminalGroup);

      const terminalB =
        terminalOrder.indexOf(b.terminalGroup);

      if (
        terminalA >= 0 &&
        terminalB >= 0 &&
        terminalA !== terminalB
      ) {
        return terminalA - terminalB;
      }
    } else {
      const corpsCompare =
        a.corps.localeCompare(
          b.corps,
          "fr"
        );

      if (corpsCompare !== 0) {
        return corpsCompare;
      }

      if (a.reserve !== b.reserve) {
        return a.reserve ? 1 : -1;
      }
    }

    const gradeA =
      gradeOrder.indexOf(a.grade);

    const gradeB =
      gradeOrder.indexOf(b.grade);

    if (
      gradeA >= 0 &&
      gradeB >= 0 &&
      gradeA !== gradeB
    ) {
      return gradeA - gradeB;
    }

    if (gradeA >= 0 && gradeB < 0) {
      return -1;
    }

    if (gradeA < 0 && gradeB >= 0) {
      return 1;
    }

    const gradeCompare =
      a.grade.localeCompare(
        b.grade,
        "fr"
      );

    if (gradeCompare !== 0) {
      return gradeCompare;
    }

    return a.nomComplet.localeCompare(
      b.nomComplet,
      "fr"
    );
  });

  return {
    rows,
    gradeOrder,

    options: {
      grades: lireOptionsColonneEffectifsWeb_(
        ss,
        sheet,
        schema.grade,
        "grade"
      ),

      corps: lireOptionsColonneEffectifsWeb_(
        ss,
        sheet,
        schema.corps,
        "corps"
      ),

      specialites: lireOptionsColonneEffectifsWeb_(
        ss,
        sheet,
        schema.specialite,
        "specialite"
      ),

      statuses: lireOptionsColonneEffectifsWeb_(
        ss,
        sheet,
        schema.status,
        "status"
      ),

      styles
    }
  };
}


// ============================================================
// API - AJOUT
// ============================================================

function ajouterEffectif(token, data) {
  requireRole(token, ["OFFICIER"]);

  if (!data) {
    throw new Error("Données du nouveau membre manquantes.");
  }

  const prenom = nettoyerEffectifsWeb_(data.prenom);
  const nom = nettoyerEffectifsWeb_(data.nom);
  const grade = nettoyerEffectifsWeb_(data.grade);
  const corps = nettoyerEffectifsWeb_(data.corps);
  const specialite = nettoyerEffectifsWeb_(data.specialite);
  const status = nettoyerEffectifsWeb_(data.status);
  const assermente = data.assermente === true;

  if (!prenom && !nom) {
    throw new Error("Le prénom ou le nom doit être renseigné.");
  }

  if (!grade) {
    throw new Error("Le grade est obligatoire.");
  }

  if (!corps) {
    throw new Error("Le corps est obligatoire.");
  }

  if (!status) {
    throw new Error("Le statut est obligatoire.");
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(EFFECTIFS_WEB_SHEET_NAME);

  if (!sheet) {
    throw new Error('Feuille "Effectifs" introuvable.');
  }

  const schema = lireSchemaEffectifsWeb_(sheet);

  validerOptionEffectifsWeb_(
    ss,
    sheet,
    schema.grade,
    grade,
    "grade"
  );

  validerOptionEffectifsWeb_(
    ss,
    sheet,
    schema.corps,
    corps,
    "corps"
  );

  if (specialite) {
    validerOptionEffectifsWeb_(
      ss,
      sheet,
      schema.specialite,
      specialite,
      "spécialité"
    );
  }

  validerOptionEffectifsWeb_(
    ss,
    sheet,
    schema.status,
    status,
    "statut"
  );

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow >= 2) {
    const existing = sheet
      .getRange(2, 1, lastRow - 1, lastColumn)
      .getDisplayValues();

    const newKey = clePersonneEffectifsWeb_(prenom, nom);

    const duplicate = existing.some(row =>
      clePersonneEffectifsWeb_(
        row[schema.prenom],
        row[schema.nom]
      ) === newKey
    );

    if (duplicate) {
      throw new Error(
        `Un membre nommé "${`${prenom} ${nom}`.trim()}" existe déjà dans Effectifs.`
      );
    }
  }

  const targetRow = Math.max(2, lastRow + 1);

  if (sheet.getMaxRows() < targetRow) {
    sheet.insertRowsAfter(
      sheet.getMaxRows(),
      targetRow - sheet.getMaxRows()
    );
  }

  if (lastRow >= 2) {
    sheet
      .getRange(lastRow, 1, 1, lastColumn)
      .copyTo(
        sheet.getRange(targetRow, 1, 1, lastColumn),
        SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
        false
      );

    const validations = sheet
      .getRange(lastRow, 1, 1, lastColumn)
      .getDataValidations();

    sheet
      .getRange(targetRow, 1, 1, lastColumn)
      .setDataValidations(validations);
  }

  sheet.getRange(targetRow, schema.prenom + 1).setValue(prenom);
  sheet.getRange(targetRow, schema.nom + 1).setValue(nom);
  sheet.getRange(targetRow, schema.grade + 1).setValue(grade);
  sheet.getRange(targetRow, schema.corps + 1).setValue(corps);
  sheet.getRange(targetRow, schema.specialite + 1).setValue(specialite);
  sheet.getRange(targetRow, schema.status + 1).setValue(status);

  const assermenteCell = sheet.getRange(
    targetRow,
    schema.assermente + 1
  );

  const validation =
    assermenteCell.getDataValidation();

  if (
    !validation ||
    validation.getCriteriaType() !==
      SpreadsheetApp.DataValidationCriteria.CHECKBOX
  ) {
    assermenteCell.insertCheckboxes();
  }

  assermenteCell.setValue(assermente);

  rafraichirListeGardesTechniquesEffectifs_(ss);

  SpreadsheetApp.flush();

  return getEffectifs(token);
}


// ============================================================
// API - MISE À JOUR
// ============================================================
//
// Champs modifiables depuis l'application :
// - Grade
// - Corps
// - Spécialité
// - Assermenté
// - Status
//
// Nom et prénom restent en lecture seule.
// La suppression n'existe volontairement pas.
// ============================================================

function modifierEffectif(token, data) {
  requireRole(token, ["OFFICIER"]);

  if (!data) {
    throw new Error("Données de modification manquantes.");
  }

  const row = Number(data.row);

  if (!Number.isInteger(row) || row < 2) {
    throw new Error("Ligne Effectifs invalide.");
  }

  const grade = nettoyerEffectifsWeb_(data.grade);
  const corps = nettoyerEffectifsWeb_(data.corps);
  const specialite = nettoyerEffectifsWeb_(data.specialite);
  const status = nettoyerEffectifsWeb_(data.status);
  const assermente = data.assermente === true;

  if (!grade) {
    throw new Error("Le grade est obligatoire.");
  }

  if (!corps) {
    throw new Error("Le corps est obligatoire.");
  }

  if (!status) {
    throw new Error("Le statut est obligatoire.");
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(EFFECTIFS_WEB_SHEET_NAME);

  if (!sheet) {
    throw new Error('Feuille "Effectifs" introuvable.');
  }

  if (row > sheet.getLastRow()) {
    throw new Error("Ce membre n'existe plus dans la feuille.");
  }

  const schema = lireSchemaEffectifsWeb_(sheet);

  const currentPrenom = nettoyerEffectifsWeb_(
    sheet
      .getRange(row, schema.prenom + 1)
      .getDisplayValue()
  );

  const currentNom = nettoyerEffectifsWeb_(
    sheet
      .getRange(row, schema.nom + 1)
      .getDisplayValue()
  );

  const expectedPrenom =
    nettoyerEffectifsWeb_(data.expectedPrenom);

  const expectedNom =
    nettoyerEffectifsWeb_(data.expectedNom);

  if (
    clePersonneEffectifsWeb_(currentPrenom, currentNom) !==
    clePersonneEffectifsWeb_(expectedPrenom, expectedNom)
  ) {
    throw new Error(
      "La ligne a changé depuis le chargement de la page. Recharge les effectifs avant de modifier ce membre."
    );
  }

  if (!currentPrenom && !currentNom) {
    throw new Error("Cette ligne Effectifs est vide.");
  }

  validerOptionEffectifsWeb_(
    ss,
    sheet,
    schema.grade,
    grade,
    "grade"
  );

  validerOptionEffectifsWeb_(
    ss,
    sheet,
    schema.corps,
    corps,
    "corps"
  );

  if (specialite) {
    validerOptionEffectifsWeb_(
      ss,
      sheet,
      schema.specialite,
      specialite,
      "spécialité"
    );
  }

  validerOptionEffectifsWeb_(
    ss,
    sheet,
    schema.status,
    status,
    "statut"
  );

  sheet
    .getRange(row, schema.grade + 1)
    .setValue(grade);

  sheet
    .getRange(row, schema.corps + 1)
    .setValue(corps);

  sheet
    .getRange(row, schema.specialite + 1)
    .setValue(specialite);

  sheet
    .getRange(row, schema.status + 1)
    .setValue(status);

  const assermenteCell = sheet.getRange(
    row,
    schema.assermente + 1
  );

  const validation =
    assermenteCell.getDataValidation();

  if (
    !validation ||
    validation.getCriteriaType() !==
      SpreadsheetApp.DataValidationCriteria.CHECKBOX
  ) {
    assermenteCell.insertCheckboxes();
  }

  assermenteCell.setValue(assermente);

  rafraichirListeGardesTechniquesEffectifs_(ss);

  SpreadsheetApp.flush();

  return getEffectifs(token);
}


// ============================================================
// SCHÉMA EFFECTIFS
// ============================================================

function lireSchemaEffectifsWeb_(sheet) {
  const lastColumn = sheet.getLastColumn();

  if (lastColumn < 1) {
    throw new Error(
      "La feuille Effectifs ne contient aucun en-tête."
    );
  }

  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(normaliserEffectifsWeb_);

  const schema = {
    prenom: trouverEnteteEffectifsWeb_(headers, [
      "prenom",
      "prénom"
    ]),
    nom: trouverEnteteEffectifsWeb_(headers, [
      "nom"
    ]),
    grade: trouverEnteteEffectifsWeb_(headers, [
      "grade"
    ]),
    corps: trouverEnteteEffectifsWeb_(headers, [
      "corps",
      "corps de garde",
      "garnison"
    ]),
    specialite: trouverEnteteEffectifsWeb_(headers, [
      "specialite",
      "spécialité",
      "specialites",
      "spécialités"
    ]),
    status: trouverEnteteEffectifsWeb_(headers, [
      "status",
      "statut"
    ]),
    assermente: trouverEnteteEffectifsWeb_(headers, [
      "assermente",
      "assermenté",
      "assermentation",
      "serment"
    ])
  };

  const missing = Object
    .entries(schema)
    .filter(([, index]) => index < 0)
    .map(([name]) => name);

  if (missing.length) {
    throw new Error(
      "Colonnes introuvables dans Effectifs : " +
      missing.join(", ") +
      ". Vérifie les en-têtes de la ligne 1."
    );
  }

  return schema;
}


// ============================================================
// OPTIONS - GRADE / CORPS / SPÉCIALITÉ / STATUS
// ============================================================

function lireOptionsColonneEffectifsWeb_(
  ss,
  sheet,
  zeroBasedColumn,
  type
) {
  const result = [];

  const validation = trouverValidationEffectifsWeb_(
    sheet,
    zeroBasedColumn + 1
  );

  if (validation) {
    const criteria = validation.getCriteriaType();
    const args = validation.getCriteriaValues();

    if (
      criteria ===
      SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST
    ) {
      for (const value of (args[0] || [])) {
        const cleaned = nettoyerEffectifsWeb_(value);
        if (cleaned) result.push(cleaned);
      }
    }

    if (
      criteria ===
      SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE
    ) {
      const range = args[0];

      if (range) {
        for (const value of range.getDisplayValues().flat()) {
          const cleaned = nettoyerEffectifsWeb_(value);
          if (cleaned) result.push(cleaned);
        }
      }
    }
  }

  if (type === "grade") {
    const donnees = ss.getSheetByName(
      EFFECTIFS_WEB_DONNEES_SHEET_NAME
    );

    if (
      donnees &&
      donnees.getLastRow() >= 2
    ) {
      const grades = donnees
        .getRange(
          2,
          1,
          donnees.getLastRow() - 1,
          1
        )
        .getDisplayValues()
        .flat();

      for (const grade of grades) {
        const cleaned = nettoyerEffectifsWeb_(grade);
        if (cleaned) result.push(cleaned);
      }
    }
  }

  if (sheet.getLastRow() >= 2) {
    const existing = sheet
      .getRange(
        2,
        zeroBasedColumn + 1,
        sheet.getLastRow() - 1,
        1
      )
      .getDisplayValues()
      .flat();

    for (const value of existing) {
      const cleaned = nettoyerEffectifsWeb_(value);
      if (cleaned) result.push(cleaned);
    }
  }

  return listeUniqueEffectifsWeb_(result);
}


function trouverValidationEffectifsWeb_(
  sheet,
  oneBasedColumn
) {
  const lastRow = Math.max(2, sheet.getLastRow());

  const validations = sheet
    .getRange(
      2,
      oneBasedColumn,
      lastRow - 1,
      1
    )
    .getDataValidations();

  for (const row of validations) {
    if (row[0]) return row[0];
  }

  return null;
}


function validerOptionEffectifsWeb_(
  ss,
  sheet,
  zeroBasedColumn,
  value,
  type
) {
  const options = lireOptionsColonneEffectifsWeb_(
    ss,
    sheet,
    zeroBasedColumn,
    type
  );

  if (!options.length) return;

  if (!options.includes(value)) {
    throw new Error(
      `Valeur "${value}" non autorisée pour ${type}.`
    );
  }
}


// ============================================================
// RAFRAÎCHISSEMENT DE SyncCodex!P
// ============================================================

function rafraichirListeGardesTechniquesEffectifs_(ss) {
  const effectifs =
    ss.getSheetByName(EFFECTIFS_WEB_SHEET_NAME);

  const sync =
    ss.getSheetByName(EFFECTIFS_WEB_SYNC_CODEX_SHEET_NAME);

  if (!effectifs || !sync) return;

  const schema = lireSchemaEffectifsWeb_(effectifs);
  const lastRow = effectifs.getLastRow();
  const lastColumn = effectifs.getLastColumn();
  const guards = [];

  if (lastRow >= 2) {
    const display = effectifs
      .getRange(
        2,
        1,
        lastRow - 1,
        lastColumn
      )
      .getDisplayValues();

    for (const row of display) {
      const prenom =
        nettoyerEffectifsWeb_(row[schema.prenom]);

      const nom =
        nettoyerEffectifsWeb_(row[schema.nom]);

      const status =
        nettoyerEffectifsWeb_(row[schema.status]);

      if (!prenom && !nom) continue;

      if (
        normaliserEffectifsWeb_(status) !==
        normaliserEffectifsWeb_(
          EFFECTIFS_WEB_ACTIVE_STATUS
        )
      ) {
        continue;
      }

      guards.push(
        `${prenom} ${nom}`.trim()
      );
    }
  }

  const uniqueGuards =
    listeUniqueEffectifsWeb_(guards)
      .sort((a, b) =>
        a.localeCompare(b, "fr")
      );

  const clearRows =
    Math.max(sync.getLastRow(), 2);

  sync
    .getRange(1, 16, clearRows, 1)
    .clearContent();

  sync
    .getRange(1, 16)
    .setValue("Dropdown Garde")
    .setFontWeight("bold");

  if (uniqueGuards.length) {
    sync
      .getRange(
        2,
        16,
        uniqueGuards.length,
        1
      )
      .setValues(
        uniqueGuards.map(value => [value])
      );
  }
}


// ============================================================
// COULEURS / STYLES DE LA FEUILLE
// ============================================================

function styleCelluleEffectifsWeb_(
  background,
  color,
  weight
) {
  return {
    background:
      nettoyerCouleurEffectifsWeb_(
        background
      ),

    color:
      nettoyerCouleurEffectifsWeb_(
        color
      ),

    fontWeight:
      String(weight || "")
        .toLowerCase() === "bold"
        ? "700"
        : "500"
  };
}


function memoriserStyleOptionEffectifsWeb_(
  target,
  value,
  style
) {
  const cleaned =
    nettoyerEffectifsWeb_(value);

  if (!cleaned) {
    return;
  }

  if (!target[cleaned]) {
    target[cleaned] = style;
  }
}


function nettoyerCouleurEffectifsWeb_(value) {
  const color =
    String(value || "")
      .trim();

  if (
    /^#[0-9a-f]{6}$/i.test(color)
  ) {
    return color;
  }

  return "";
}


// ============================================================
// HELPERS
// ============================================================

function trouverEnteteEffectifsWeb_(
  normalizedHeaders,
  aliases
) {
  const normalizedAliases =
    aliases.map(normaliserEffectifsWeb_);

  for (
    let i = 0;
    i < normalizedHeaders.length;
    i++
  ) {
    if (
      normalizedAliases.includes(
        normalizedHeaders[i]
      )
    ) {
      return i;
    }
  }

  return -1;
}


function lireMetadonneesGradesEffectifsWeb_(ss) {
  const donnees = ss.getSheetByName(
    EFFECTIFS_WEB_DONNEES_SHEET_NAME
  );

  if (
    !donnees ||
    donnees.getLastRow() < 2
  ) {
    return {
      order: [],
      styles: {}
    };
  }

  const lastRow = donnees.getLastRow();

  const range = donnees.getRange(
    2,
    1,
    lastRow - 1,
    1
  );

  const values = range
    .getDisplayValues()
    .flat();

  const backgrounds = range
    .getBackgrounds()
    .flat();

  const fontColors = range
    .getFontColors()
    .flat();

  const fontWeights = range
    .getFontWeights()
    .flat();

  const order = [];
  const styles = {};

  for (let i = 0; i < values.length; i++) {
    const grade = nettoyerEffectifsWeb_(
      values[i]
    );

    if (!grade) {
      continue;
    }

    if (!order.includes(grade)) {
      order.push(grade);
    }

    if (!styles[grade]) {
      styles[grade] =
        styleCelluleEffectifsWeb_(
          backgrounds[i],
          fontColors[i],
          fontWeights[i]
        );
    }
  }

  return {
    order,
    styles
  };
}


function getGradeOrderEffectifsWeb_(ss) {
  return lireMetadonneesGradesEffectifsWeb_(
    ss
  ).order;
}


function getGroupeTerminalEffectifsWeb_(status) {
  const normalized =
    normaliserEffectifsWeb_(status);

  if (!normalized) {
    return "";
  }

  for (
    const group of
    EFFECTIFS_WEB_TERMINAL_STATUS_GROUPS
  ) {
    for (const alias of group.aliases) {
      const normalizedAlias =
        normaliserEffectifsWeb_(alias);

      if (
        normalized === normalizedAlias ||
        normalized.includes(
          normalizedAlias
        )
      ) {
        return group.label;
      }
    }
  }

  return "";
}


function estReserveEffectifsWeb_(status) {
  const normalized =
    normaliserEffectifsWeb_(status);

  return (
    normalized ===
      normaliserEffectifsWeb_(
        EFFECTIFS_WEB_RESERVE_STATUS
      ) ||
    normalized.includes(
      normaliserEffectifsWeb_(
        EFFECTIFS_WEB_RESERVE_STATUS
      )
    )
  );
}


function clePersonneEffectifsWeb_(
  prenom,
  nom
) {
  return normaliserEffectifsWeb_(
    `${prenom || ""} ${nom || ""}`
  );
}


function nettoyerEffectifsWeb_(value) {
  return String(
    value === null ||
    typeof value === "undefined"
      ? ""
      : value
  )
    .replace(/\u00A0/g, " ")
    .trim();
}


function normaliserEffectifsWeb_(value) {
  return nettoyerEffectifsWeb_(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}


function listeUniqueEffectifsWeb_(values) {
  const result = [];
  const seen = new Set();

  for (const value of values) {
    const cleaned =
      nettoyerEffectifsWeb_(value);

    const key =
      normaliserEffectifsWeb_(cleaned);

    if (
      !cleaned ||
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}