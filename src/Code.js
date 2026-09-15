// ============================================================
// CONFIGURATION
// ============================================================

const SPREADSHEET_ID =
  "1eUjNgoYKQeGV2EZT96CxACCOfthY56nUGk2Uzk6hSW4";


const SHEET_PRESENCES = "Présences";
const SHEET_EFFECTIFS = "Effectifs";
const SHEET_AMENDES = "Amendes";
const SHEET_PRISON = "Prison";

function doGet() {

  return HtmlService
    .createTemplateFromFile("Index")
    .evaluate()
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setTitle("Registre de la Garde de Blancherive")
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    );
}

const MASTER_SHEET_NAME = "Effectifs";
const DONNEES_SHEET_NAME = "Données";
const PRESENCES_SHEET_NAME = "Présences";

const PRESENCE_COLUMN_COUNT = 15; // A:O

const TARGET_SHEETS = [
  "Garde de Blancherive",
  "Garde de Rivebois",
  "Garde des Faubourgs",
  "Garde de Bois-de-Chêne",
  "Garde de Cap Granite"
];

const HEADER_FIRST_NAME = "Prénom";
const HEADER_NAME = "Nom";
const HEADER_GRADE = "Grade";
const HEADER_CORPS = "Corps";
const HEADER_STATUS = "Status";

const ACTIVE_STATUS = "En service actif";

const DONNEES_GRADE_COLUMN = 1;
const DONNEES_GRADE_START_ROW = 2;


// ============================================================
// OUTILS
// ============================================================

function getISOWeekNumber(date) {

  const d = new Date(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    )
  );

  const dayNum = d.getUTCDay() || 7;

  d.setUTCDate(
    d.getUTCDate() + 4 - dayNum
  );

  const yearStart =
    new Date(
      Date.UTC(
        d.getUTCFullYear(),
        0,
        1
      )
    );

  return Math.ceil(
    (
      (d - yearStart) / 86400000 + 1
    ) / 7
  );
}


function getPersonKey(firstname, name) {

  return (
    String(firstname ?? "").trim() +
    "|" +
    String(name ?? "").trim()
  ).toLowerCase();
}


function getLastPresenceRow(sheet) {

  const values =
    sheet
      .getRange(
        1,
        1,
        sheet.getMaxRows(),
        1
      )
      .getValues();

  for (
    let i = values.length - 1;
    i >= 0;
    i--
  ) {

    if (
      values[i][0] !== "" &&
      values[i][0] !== null
    ) {

      return i + 1;
    }
  }

  return 1;
}


function ensurePresenceHeaders(sheet) {

  sheet
    .getRange(
      1,
      1,
      1,
      PRESENCE_COLUMN_COUNT
    )
    .setValues([[
      "Semaine",
      "Corps de garde",
      "Grade",
      "Prénom",
      "Nom",
      "Lun",
      "Mar",
      "Mer",
      "Jeu",
      "Ven",
      "Sam",
      "Dim",
      "Jours présents",
      "Solde",
      "Payé"
    ]]);


  sheet.setFrozenRows(1);
}


// ============================================================
// ORDRE DES GRADES
// ============================================================

function getGradeOrder(donnees) {

  const gradeOrder = new Map();

  const lastRow =
    donnees.getLastRow();


  if (
    lastRow <
    DONNEES_GRADE_START_ROW
  ) {

    return gradeOrder;
  }


  const values =
    donnees
      .getRange(
        DONNEES_GRADE_START_ROW,
        DONNEES_GRADE_COLUMN,
        lastRow -
          DONNEES_GRADE_START_ROW +
          1,
        1
      )
      .getDisplayValues()
      .flat();


  values
    .map(
      value =>
        String(value).trim()
    )
    .filter(
      value =>
        value !== ""
    )
    .forEach(
      (grade, index) => {

        gradeOrder.set(
          grade,
          index
        );
      }
    );


  return gradeOrder;
}


// ============================================================
// EFFECTIFS ACTIFS
// ============================================================

function getActiveSoldiers(
  effectifs,
  donnees
) {

  const values =
    effectifs
      .getDataRange()
      .getValues();


  if (
    values.length < 2
  ) {

    return [];
  }


  const headers =
    values[0];


  const firstnameIndex =
    headers.indexOf(
      HEADER_FIRST_NAME
    );

  const nameIndex =
    headers.indexOf(
      HEADER_NAME
    );

  const gradeIndex =
    headers.indexOf(
      HEADER_GRADE
    );

  const corpsIndex =
    headers.indexOf(
      HEADER_CORPS
    );

  const statusIndex =
    headers.indexOf(
      HEADER_STATUS
    );


  if (firstnameIndex === -1) {
    throw new Error(
      `Colonne "${HEADER_FIRST_NAME}" introuvable.`
    );
  }

  if (nameIndex === -1) {
    throw new Error(
      `Colonne "${HEADER_NAME}" introuvable.`
    );
  }

  if (gradeIndex === -1) {
    throw new Error(
      `Colonne "${HEADER_GRADE}" introuvable.`
    );
  }

  if (corpsIndex === -1) {
    throw new Error(
      `Colonne "${HEADER_CORPS}" introuvable.`
    );
  }

  if (statusIndex === -1) {
    throw new Error(
      `Colonne "${HEADER_STATUS}" introuvable.`
    );
  }


  const gradeOrder =
    getGradeOrder(
      donnees
    );


  const soldiers =
    values
      .slice(1)

      .filter(row => {

        const firstname =
          String(
            row[firstnameIndex] ?? ""
          ).trim();

        const name =
          String(
            row[nameIndex] ?? ""
          ).trim();

        const status =
          String(
            row[statusIndex] ?? ""
          ).trim();


        return (
          (
            firstname !== "" ||
            name !== ""
          ) &&
          status === ACTIVE_STATUS
        );
      })

      .map(row => ({

        firstname:
          String(
            row[firstnameIndex] ?? ""
          ).trim(),

        name:
          String(
            row[nameIndex] ?? ""
          ).trim(),

        grade:
          String(
            row[gradeIndex] ?? ""
          ).trim(),

        corps:
          String(
            row[corpsIndex] ?? ""
          ).trim()

      }));


  soldiers.sort(
    (a, b) => {

      const corpsCompare =
        a.corps.localeCompare(
          b.corps,
          "fr"
        );


      if (
        corpsCompare !== 0
      ) {

        return corpsCompare;
      }


      const gradeA =
        gradeOrder.has(a.grade)
          ? gradeOrder.get(a.grade)
          : 9999;


      const gradeB =
        gradeOrder.has(b.grade)
          ? gradeOrder.get(b.grade)
          : 9999;


      if (
        gradeA !== gradeB
      ) {

        return gradeA - gradeB;
      }


      const firstnameCompare =
        a.firstname.localeCompare(
          b.firstname,
          "fr"
        );


      if (
        firstnameCompare !== 0
      ) {

        return firstnameCompare;
      }


      return a.name.localeCompare(
        b.name,
        "fr"
      );
    }
  );


  return soldiers;
}


// ============================================================
// NETTOYAGE D'UNE PLAGE A:O
// ============================================================

function clearPresenceRange(
  sheet,
  startRow,
  rowCount
) {

  if (
    rowCount <= 0
  ) {
    return;
  }


  const range =
    sheet.getRange(
      startRow,
      1,
      rowCount,
      PRESENCE_COLUMN_COUNT
    );


  range.clearContent();
  range.clearDataValidations();

  range.setBorder(
    false,
    false,
    false,
    false,
    false,
    false
  );
}


// ============================================================
// GARANTIR QU'IL Y A ASSEZ DE LIGNES
// ============================================================

function ensureEnoughRows(
  sheet,
  requiredLastRow
) {

  const maxRows =
    sheet.getMaxRows();


  if (
    requiredLastRow >
    maxRows
  ) {

    sheet.insertRowsAfter(
      maxRows,
      requiredLastRow - maxRows
    );
  }
}


// ============================================================
// DÉPLACER L'HISTORIQUE VERS LE BAS
//
// IMPORTANT : copie de BAS EN HAUT.
// Ainsi aucune ligne source n'est écrasée.
// ============================================================

function movePresenceBlockDown(
  sheet,
  startRow,
  rowCount,
  offset
) {

  if (
    rowCount <= 0 ||
    offset <= 0
  ) {

    return;
  }


  const lastSourceRow =
    startRow +
    rowCount -
    1;


  const lastDestinationRow =
    lastSourceRow +
    offset;


  ensureEnoughRows(
    sheet,
    lastDestinationRow
  );


  // CRITIQUE :
  // on commence par le bas.
  for (
    let row = lastSourceRow;
    row >= startRow;
    row--
  ) {

    const source =
      sheet.getRange(
        row,
        1,
        1,
        PRESENCE_COLUMN_COUNT
      );


    const destination =
      sheet.getRange(
        row + offset,
        1,
        1,
        PRESENCE_COLUMN_COUNT
      );


    source.copyTo(
      destination,
      SpreadsheetApp.CopyPasteType.PASTE_NORMAL,
      false
    );
  }


  // On nettoie UNIQUEMENT les lignes réellement libérées.
  clearPresenceRange(
    sheet,
    startRow,
    offset
  );
}


// ============================================================
// DÉPLACER L'HISTORIQUE VERS LE HAUT
//
// IMPORTANT : copie de HAUT EN BAS.
// ============================================================

function movePresenceBlockUp(
  sheet,
  startRow,
  rowCount,
  offset
) {

  if (
    rowCount <= 0 ||
    offset <= 0
  ) {

    return;
  }


  // CRITIQUE :
  // pour remonter, on commence par le haut.
  for (
    let row = startRow;
    row < startRow + rowCount;
    row++
  ) {

    const source =
      sheet.getRange(
        row,
        1,
        1,
        PRESENCE_COLUMN_COUNT
      );


    const destination =
      sheet.getRange(
        row - offset,
        1,
        1,
        PRESENCE_COLUMN_COUNT
      );


    source.copyTo(
      destination,
      SpreadsheetApp.CopyPasteType.PASTE_NORMAL,
      false
    );
  }


  // Nettoyer uniquement les lignes libérées EN BAS.
  const vacatedStartRow =
    startRow +
    rowCount -
    offset;


  clearPresenceRange(
    sheet,
    vacatedStartRow,
    offset
  );
}


// ============================================================
// FORMULES M ET N
// ============================================================

function reparerFormulesPresence() {

  const spreadsheet =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );


  const presences =
    spreadsheet.getSheetByName(
      PRESENCES_SHEET_NAME
    );


  if (!presences) {
    return;
  }


  const lastRow =
    getLastPresenceRow(
      presences
    );


  if (
    lastRow <= 1
  ) {

    return;
  }


  const weeks =
    presences
      .getRange(
        2,
        1,
        lastRow - 1,
        1
      )
      .getValues()
      .flat();


  const presenceFormulas = [];


  for (
    let index = 0;
    index < weeks.length;
    index++
  ) {

    const row =
      index + 2;


    if (
      weeks[index] === "" ||
      weeks[index] === null
    ) {

      presenceFormulas.push([""]);

      continue;
    }


    // M = Jours présents
    presenceFormulas.push([
      `=COUNTIF(F${row}:L${row};TRUE)`
    ]);


  }


  presences
    .getRange(
      2,
      13,
      presenceFormulas.length,
      1
    )
    .setFormulas(
      presenceFormulas
    );


  mettreAJourSoldesPresences_(spreadsheet, presences);


  SpreadsheetApp.flush();
}


// ============================================================
// RÉCRÉER LES SÉPARATEURS DU REGISTRE
// ============================================================

function reconstruireSeparateursPresence() {

  const spreadsheet =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );


  const sheet =
    spreadsheet.getSheetByName(
      PRESENCES_SHEET_NAME
    );


  if (!sheet) {
    return;
  }


  const lastRow =
    getLastPresenceRow(
      sheet
    );


  if (
    lastRow <= 1
  ) {
    return;
  }


  // Supprimer les anciens séparateurs seulement dans A:O.
  sheet
    .getRange(
      2,
      1,
      lastRow - 1,
      PRESENCE_COLUMN_COUNT
    )
    .setBorder(
      false,
      false,
      false,
      false,
      false,
      false
    );


  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        2
      )
      .getValues();


  for (
    let i = 0;
    i < values.length;
    i++
  ) {

    const row =
      i + 2;

    const currentWeek =
      values[i][0];

    const currentCorps =
      values[i][1];


    if (
      currentWeek === "" ||
      currentWeek === null
    ) {

      continue;
    }


    const isLastRow =
      i === values.length - 1;


    const nextWeek =
      isLastRow
        ? null
        : values[i + 1][0];


    const nextCorps =
      isLastRow
        ? null
        : values[i + 1][1];


    // Fin de semaine
    if (
      isLastRow ||
      Number(nextWeek) !==
        Number(currentWeek)
    ) {

      sheet
        .getRange(
          row,
          1,
          1,
          PRESENCE_COLUMN_COUNT
        )
        .setBorder(
          null,
          null,
          true,
          null,
          null,
          null,
          null,
          SpreadsheetApp.BorderStyle.SOLID_MEDIUM
        );


      continue;
    }


    // Changement de corps dans la même semaine
    if (
      nextCorps !==
      currentCorps
    ) {

      sheet
        .getRange(
          row,
          1,
          1,
          PRESENCE_COLUMN_COUNT
        )
        .setBorder(
          null,
          null,
          true,
          null,
          null,
          null,
          null,
          SpreadsheetApp.BorderStyle.DASHED
        );
    }
  }
}


// ============================================================
// ÉCRIRE UNE SEMAINE
// ============================================================

function writePresenceWeek(
  sheet,
  soldiers,
  weekNumber,
  startRow
) {

  if (
    soldiers.length === 0
  ) {

    return;
  }


  ensureEnoughRows(
    sheet,
    startRow +
      soldiers.length -
      1
  );


  const rows =
    soldiers.map(
      soldier => [

        weekNumber,
        soldier.corps,
        soldier.grade,
        soldier.firstname,
        soldier.name,

        false,
        false,
        false,
        false,
        false,
        false,
        false,

        "",
        "",
        false

      ]
    );


  sheet
    .getRange(
      startRow,
      1,
      rows.length,
      PRESENCE_COLUMN_COUNT
    )
    .setValues(
      rows
    );


  // Présence
  sheet
    .getRange(
      startRow,
      6,
      rows.length,
      7
    )
    .insertCheckboxes();


  // Payé
  sheet
    .getRange(
      startRow,
      15,
      rows.length,
      1
    )
    .insertCheckboxes();


  sheet
    .getRange(
      startRow,
      1,
      rows.length,
      1
    )
    .setNumberFormat(
      "0"
    );
}


// ============================================================
// AJOUTER UNE NOUVELLE SEMAINE
// ============================================================

function ajouterSemainePresence() {

  const spreadsheet =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );


  const effectifs =
    spreadsheet.getSheetByName(
      MASTER_SHEET_NAME
    );

  const donnees =
    spreadsheet.getSheetByName(
      DONNEES_SHEET_NAME
    );

  let presences =
    spreadsheet.getSheetByName(
      PRESENCES_SHEET_NAME
    );


  if (!effectifs) {
    throw new Error(
      `Feuille "${MASTER_SHEET_NAME}" introuvable.`
    );
  }


  if (!donnees) {
    throw new Error(
      `Feuille "${DONNEES_SHEET_NAME}" introuvable.`
    );
  }


  if (!presences) {

    presences =
      spreadsheet.insertSheet(
        PRESENCES_SHEET_NAME
      );
  }


  ensurePresenceHeaders(
    presences
  );


  const weekNumber =
    getISOWeekNumber(
      new Date()
    );


  const lastRow =
    getLastPresenceRow(
      presences
    );


  // Vérifier si semaine déjà présente.
  if (
    lastRow > 1
  ) {

    const weeks =
      presences
        .getRange(
          2,
          1,
          lastRow - 1,
          1
        )
        .getValues()
        .flat();


    if (
      weeks.some(
        value =>
          Number(value) ===
          weekNumber
      )
    ) {

      console.log(
        `La semaine ${weekNumber} existe déjà.`
      );

      return;
    }
  }


  const soldiers =
    getActiveSoldiers(
      effectifs,
      donnees
    );


  if (
    soldiers.length === 0
  ) {

    return;
  }


  const historyRows =
    Math.max(
      0,
      lastRow - 1
    );


  // Historique vers le bas.
  if (
    historyRows > 0
  ) {

    movePresenceBlockDown(
      presences,
      2,
      historyRows,
      soldiers.length
    );
  }


  // Nouvelle semaine en haut.
  writePresenceWeek(
    presences,
    soldiers,
    weekNumber,
    2
  );


  reparerFormulesPresence();
  reconstruireSeparateursPresence();


  console.log(
    `Semaine ${weekNumber} ajoutée avec ${soldiers.length} gardes.`
  );
}


// ============================================================
// RÉGÉNÉRER LA SEMAINE COURANTE
// ============================================================

function regenererSemaineCourante() {

  const lock =
    LockService.getDocumentLock();


  lock.waitLock(
    30000
  );


  try {

    const spreadsheet =
      SpreadsheetApp.openById(
        SPREADSHEET_ID
      );


    const effectifs =
      spreadsheet.getSheetByName(
        MASTER_SHEET_NAME
      );


    const donnees =
      spreadsheet.getSheetByName(
        DONNEES_SHEET_NAME
      );


    const presences =
      spreadsheet.getSheetByName(
        PRESENCES_SHEET_NAME
      );


    if (
      !effectifs ||
      !donnees
    ) {

      throw new Error(
        "Effectifs ou Données introuvable."
      );
    }


    if (!presences) {

      ajouterSemainePresence();

      return;
    }


    ensurePresenceHeaders(
      presences
    );


    const weekNumber =
      getISOWeekNumber(
        new Date()
      );


    const lastRow =
      getLastPresenceRow(
        presences
      );


    // ======================================================
    // TROUVER LA SEMAINE COURANTE
    // ======================================================

    const currentRows = [];


    if (
      lastRow > 1
    ) {

      const weeks =
        presences
          .getRange(
            2,
            1,
            lastRow - 1,
            1
          )
          .getValues()
          .flat();


      weeks.forEach(
        (week, index) => {

          if (
            Number(week) ===
            weekNumber
          ) {

            currentRows.push(
              index + 2
            );
          }
        }
      );
    }


    if (
      currentRows.length === 0
    ) {

      ajouterSemainePresence();

      return;
    }


    const firstCurrentRow =
      Math.min(
        ...currentRows
      );


    const lastCurrentRow =
      Math.max(
        ...currentRows
      );


    const oldCount =
      currentRows.length;


    // ======================================================
    // PROTECTION :
    // la semaine doit être un bloc continu.
    // ======================================================

    if (
      lastCurrentRow -
        firstCurrentRow +
        1 !==
      oldCount
    ) {

      throw new Error(
        `La semaine ${weekNumber} n'est pas un bloc continu. ` +
        `Régénération annulée pour protéger l'historique.`
      );
    }


    // ======================================================
    // SAUVEGARDE DES PRÉSENCES DE LA SEMAINE COURANTE
    // ======================================================

    const savedData =
      new Map();


    const oldValues =
      presences
        .getRange(
          firstCurrentRow,
          1,
          oldCount,
          PRESENCE_COLUMN_COUNT
        )
        .getValues();


    oldValues.forEach(
      row => {

        const key =
          getPersonKey(
            row[3],
            row[4]
          );


        savedData.set(
          key,
          {

            presence: [
              row[5],
              row[6],
              row[7],
              row[8],
              row[9],
              row[10],
              row[11]
            ],

            paid:
              row[14] === true

          }
        );
      }
    );


    // ======================================================
    // NOUVEL EFFECTIF
    // ======================================================

    const soldiers =
      getActiveSoldiers(
        effectifs,
        donnees
      );


    const newCount =
      soldiers.length;


    if (
      newCount === 0
    ) {

      throw new Error(
        "Aucun garde actif. Régénération annulée."
      );
    }


    const delta =
      newCount -
      oldCount;


    // ======================================================
    // HISTORIQUE
    // ======================================================

    const historyStartRow =
      firstCurrentRow +
      oldCount;


    const historyRowCount =
      Math.max(
        0,
        lastRow -
          historyStartRow +
          1
      );


    // ======================================================
    // PLUS DE GARDES :
    // pousser l'historique vers le bas.
    // ======================================================

    if (
      delta > 0 &&
      historyRowCount > 0
    ) {

      movePresenceBlockDown(
        presences,
        historyStartRow,
        historyRowCount,
        delta
      );
    }


    // ======================================================
    // MOINS DE GARDES :
    // remonter l'historique.
    // ======================================================

    if (
      delta < 0 &&
      historyRowCount > 0
    ) {

      movePresenceBlockUp(
        presences,
        historyStartRow,
        historyRowCount,
        Math.abs(delta)
      );
    }


    // S'il n'y a aucun historique et que l'effectif diminue,
    // nettoyer les anciennes lignes surnuméraires.
    if (
      delta < 0 &&
      historyRowCount === 0
    ) {

      clearPresenceRange(
        presences,
        firstCurrentRow +
          newCount,
        Math.abs(delta)
      );
    }


    // ======================================================
    // NETTOYER UNIQUEMENT LA NOUVELLE ZONE COURANTE
    //
    // TRÈS IMPORTANT :
    // surtout PAS Math.max(oldCount,newCount).
    // ======================================================

    clearPresenceRange(
      presences,
      firstCurrentRow,
      newCount
    );


    // ======================================================
    // RÉÉCRIRE LA SEMAINE COURANTE
    // ======================================================

    writePresenceWeek(
      presences,
      soldiers,
      weekNumber,
      firstCurrentRow
    );


    // ======================================================
    // RESTAURER PRÉSENCES + PAYÉ
    // ======================================================

    let restored = 0;
    let added = 0;


    soldiers.forEach(
      (soldier, index) => {

        const key =
          getPersonKey(
            soldier.firstname,
            soldier.name
          );


        const row =
          firstCurrentRow +
          index;


        if (
          !savedData.has(
            key
          )
        ) {

          added++;

          return;
        }


        const oldData =
          savedData.get(
            key
          );


        presences
          .getRange(
            row,
            6,
            1,
            7
          )
          .setValues([
            oldData.presence
          ]);


        presences
          .getRange(
            row,
            15
          )
          .setValue(
            oldData.paid
          );


        restored++;
      }
    );


    // ======================================================
    // RÉPARER TOUTES LES FORMULES
    // ======================================================

    reparerFormulesPresence();


    // ======================================================
    // RECONSTRUIRE TOUS LES SÉPARATEURS
    // ======================================================

    reconstruireSeparateursPresence();


    SpreadsheetApp.flush();


    console.log(
      `Semaine ${weekNumber} régénérée : ` +
      `${oldCount} → ${newCount} gardes, ` +
      `${restored} présences restaurées, ` +
      `${added} nouveaux gardes.`
    );

  }
  finally {

    lock.releaseLock();
  }
}


// ============================================================
// SYNCHRONISER LA MISE EN FORME
// ============================================================

function synchroniserMiseEnForme() {

  const spreadsheet =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );


  const masterSheet =
    spreadsheet.getSheetByName(
      MASTER_SHEET_NAME
    );


  if (!masterSheet) {

    throw new Error(
      `La feuille "${MASTER_SHEET_NAME}" est introuvable.`
    );
  }


  const lastColumn =
    masterSheet.getLastColumn();


  const MAX_ROWS = 500;


  const masterFormatRange =
    masterSheet.getRange(
      1,
      1,
      Math.min(
        MAX_ROWS,
        masterSheet.getMaxRows()
      ),
      lastColumn
    );


  spreadsheet
    .getSheets()
    .forEach(
      sheet => {

        if (
          sheet.getName() ===
          MASTER_SHEET_NAME
        ) {

          return;
        }


        if (
          !TARGET_SHEETS.includes(
            sheet.getName()
          )
        ) {

          return;
        }


        if (
          sheet.getMaxRows() <
          MAX_ROWS
        ) {

          sheet.insertRowsAfter(
            sheet.getMaxRows(),
            MAX_ROWS -
              sheet.getMaxRows()
          );
        }


        if (
          sheet.getMaxColumns() <
          lastColumn
        ) {

          sheet.insertColumnsAfter(
            sheet.getMaxColumns(),
            lastColumn -
              sheet.getMaxColumns()
          );
        }


        const targetRange =
          sheet.getRange(
            1,
            1,
            MAX_ROWS,
            lastColumn
          );


        masterFormatRange.copyTo(
          targetRange,
          SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
          false
        );


        masterFormatRange.copyTo(
          targetRange,
          SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION,
          false
        );


        for (
          let column = 1;
          column <= lastColumn;
          column++
        ) {

          sheet.setColumnWidth(
            column,
            masterSheet.getColumnWidth(
              column
            )
          );
        }


        sheet.setRowHeight(
          1,
          masterSheet.getRowHeight(1)
        );
      }
    );
}


// ============================================================
// TRIGGER HEBDOMADAIRE
// ============================================================

function installerTriggerPresenceHebdomadaire() {

  const triggers =
    ScriptApp.getProjectTriggers();


  triggers.forEach(
    trigger => {

      if (
        trigger.getHandlerFunction() ===
        "ajouterSemainePresence"
      ) {

        ScriptApp.deleteTrigger(
          trigger
        );
      }
    }
  );


  ScriptApp
    .newTrigger(
      "ajouterSemainePresence"
    )
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(
      ScriptApp.WeekDay.MONDAY
    )
    .atHour(6)
    .inTimezone(
      "Europe/Stockholm"
    )
    .create();
}


function supprimerTriggerPresenceHebdomadaire() {

  ScriptApp
    .getProjectTriggers()
    .forEach(
      trigger => {

        if (
          trigger.getHandlerFunction() ===
          "ajouterSemainePresence"
        ) {

          ScriptApp.deleteTrigger(
            trigger
          );
        }
      }
    );
}


// ============================================================
// MISE À JOUR COMPLÈTE
// ============================================================

function miseAJourComplete() {

  synchroniserMiseEnForme();

  ajouterSemainePresence();
}
