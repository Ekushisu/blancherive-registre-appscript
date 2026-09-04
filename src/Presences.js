// ============================================================
// PRÉSENCES
//
// Génération du registre hebdomadaire + API Web App.
//
// Effectifs :
//   C = Prénom
//   D = Nom
//   E = Grade
//   F = Corps de garde
//   G = Statut
//
// Présences :
//   A = Semaine
//   B = Corps de garde
//   C = Grade
//   D = Prénom
//   E = Nom
//   F:L = Lun → Dim
//   M = Jours présents
//   N = Solde
//   O = Payé
//
// IMPORTANT :
// Rien après la colonne O n'est modifié par ce script.
// ============================================================

const PRESENCE_ACTIVE_STATUS =
  "En service actif";

const PRESENCE_EXCLUDED_CORPS =
  "Hird du Jarl";

const PRESENCE_TIMEZONE =
  "Europe/Stockholm";


// ============================================================
// GÉNÉRATION / SYNCHRONISATION
// ============================================================

function genererPresencesSemaineCourante() {

  const lock =
    LockService.getDocumentLock();


  lock.waitLock(
    30000
  );


  try {

    const ss =
      SpreadsheetApp.openById(
        SPREADSHEET_ID
      );


    const effectifsSheet =
      ss.getSheetByName(
        EFFECTIFS_SHEET_NAME
      );


    const presencesSheet =
      ss.getSheetByName(
        PRESENCES_SHEET_NAME
      );


    if (!effectifsSheet) {

      throw new Error(
        "Feuille Effectifs introuvable."
      );
    }


    if (!presencesSheet) {

      throw new Error(
        "Feuille Présences introuvable."
      );
    }


    const currentWeek =
      getCurrentIsoWeekWebApp();


    const effectifs =
      lireEffectifsActifsPourPresences(
        effectifsSheet
      )
        .filter(
          garde =>
            !estCorpsExcluDesPresences_(
              garde.corps
            )
        );


    const existing =
      lirePresencesExistantes(
        presencesSheet
      );


    const nouvellesLignes =
      [];


    /*
      On conserve toutes les semaines déjà présentes,
      puis on reconstruit la semaine courante depuis Effectifs.
    */

    for (
      const item of existing
    ) {

      if (
        Number(
          item.semaine
        ) ===
        Number(
          currentWeek
        )
      ) {

        continue;
      }


      nouvellesLignes.push(
        item.row
      );
    }


    /*
      Génération de la semaine courante.
    */

    for (
      const garde of effectifs
    ) {

      const key =
        construireClePresence(
          currentWeek,
          garde.prenom,
          garde.nom
        );


      const ancienne =
        existing.find(
          item =>
            item.key ===
            key
        );


      const row = [
        currentWeek,
        garde.corps,
        garde.grade,
        garde.prenom,
        garde.nom,

        ancienne
          ? ancienne.row[5]
          : false,

        ancienne
          ? ancienne.row[6]
          : false,

        ancienne
          ? ancienne.row[7]
          : false,

        ancienne
          ? ancienne.row[8]
          : false,

        ancienne
          ? ancienne.row[9]
          : false,

        ancienne
          ? ancienne.row[10]
          : false,

        ancienne
          ? ancienne.row[11]
          : false,

        "",

        "",

        ancienne
          ? ancienne.row[14]
          : false
      ];


      nouvellesLignes.push(
        row
      );
    }


    /*
      Tri :
      anciennes semaines d'abord,
      puis semaine courante.
      Au sein d'une semaine :
      corps, puis ordre courant des lignes.
    */

    nouvellesLignes.sort(
      (a, b) => {

        const weekA =
          Number(
            a[0]
          );


        const weekB =
          Number(
            b[0]
          );


        if (
          weekA !== weekB
        ) {

          return (
            weekA -
            weekB
          );
        }


        const corpsCompare =
          String(
            a[1] || ""
          ).localeCompare(
            String(
              b[1] || ""
            ),
            "fr"
          );


        if (
          corpsCompare !== 0
        ) {

          return corpsCompare;
        }


        return String(
          `${a[3]} ${a[4]}`
        ).localeCompare(
          String(
            `${b[3]} ${b[4]}`
          ),
          "fr"
        );
      }
    );


    ensurePresenceRows(
      presencesSheet,
      nouvellesLignes.length + 1
    );


    /*
      On ne touche qu'à A:O.
    */

    const maxRows =
      presencesSheet.getMaxRows();


    if (
      maxRows > 1
    ) {

      presencesSheet
        .getRange(
          2,
          1,
          maxRows - 1,
          15
        )
        .clearContent()
        .clearDataValidations();
    }


    if (
      nouvellesLignes.length === 0
    ) {

      return;
    }


    presencesSheet
      .getRange(
        2,
        1,
        nouvellesLignes.length,
        15
      )
      .setValues(
        nouvellesLignes
      );


    appliquerStructurePresences(
      presencesSheet,
      nouvellesLignes.length + 1
    );


    SpreadsheetApp.flush();

  }
  finally {

    lock.releaseLock();
  }
}


// Alias pratique si l'ancien déclencheur utilise ce nom.
function synchroniserPresences() {

  genererPresencesSemaineCourante();
}


// ============================================================
// LECTURE DES EFFECTIFS ACTIFS
// ============================================================

function lireEffectifsActifsPourPresences(
  sheet
) {

  const lastRow =
    sheet.getLastRow();


  if (
    lastRow < 2
  ) {

    return [];
  }


  /*
    C:G
      C prénom
      D nom
      E grade
      F corps
      G statut
  */

  const lastColumn =
    sheet.getLastColumn();

  const headers =
    sheet
      .getRange(1, 1, 1, lastColumn)
      .getDisplayValues()[0]
      .map(normaliserEntetePresence_);

  const prenomIndex = trouverEntetePresence_(headers, ["Prenom"]);
  const nomIndex = trouverEntetePresence_(headers, ["Nom"]);
  const gradeIndex = trouverEntetePresence_(headers, ["Grade"]);
  const corpsIndex = trouverEntetePresence_(headers, ["Corps", "Corps de garde", "Garnison"]);
  const statusIndex = trouverEntetePresence_(headers, ["Status", "Statut"]);

  if ([prenomIndex, nomIndex, gradeIndex, corpsIndex, statusIndex].some(index => index < 0)) {
    throw new Error("Colonnes obligatoires introuvables dans Effectifs.");
  }

  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        lastColumn
      )
      .getDisplayValues();


  return values
    .filter(
      row => {

        const prenom =
          String(
            row[prenomIndex] || ""
          ).trim();


        const nom =
          String(
            row[nomIndex] || ""
          ).trim();


        const status =
          String(
            row[statusIndex] || ""
          ).trim();

        const corps =
          String(
            row[corpsIndex] || ""
          ).trim();


        return (
          (
            prenom
            ||
            nom
          )
          &&
          status ===
            PRESENCE_ACTIVE_STATUS
          &&
          !estCorpsExcluDesPresences_(
            corps
          )
        );
      }
    )
    .map(
      row => ({

        prenom:
          String(
            row[prenomIndex] || ""
          ).trim(),

        nom:
          String(
            row[nomIndex] || ""
          ).trim(),

        grade:
          String(
            row[gradeIndex] || ""
          ).trim(),

        corps:
          String(
            row[corpsIndex] || ""
          ).trim()

      })
    );
}


// ============================================================
// LECTURE DE L'EXISTANT
// ============================================================

function trouverEntetePresence_(headers, aliases) {
  const aliasesNormalises = aliases.map(normaliserEntetePresence_);
  return headers.findIndex(header => aliasesNormalises.includes(header));
}

function normaliserEntetePresence_(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function lirePresencesExistantes(
  sheet
) {

  const lastRow =
    getLastPresenceRowWebApp(
      sheet
    );


  if (
    lastRow < 2
  ) {

    return [];
  }


  SpreadsheetApp.flush();


  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        15
      )
      .getValues();


  const result =
    [];


  for (
    let i = 0;
    i < values.length;
    i++
  ) {

    const row =
      values[i];


    if (
      row[0] === ""
      ||
      row[0] === null
      ||
      estCorpsExcluDesPresences_(
        displayValues[i][1]
      )
    ) {

      continue;
    }


    result.push({

      semaine:
        row[0],

      key:
        construireClePresence(
          row[0],
          row[3],
          row[4]
        ),

      row:
        row

    });
  }


  return result;
}

function estCorpsExcluDesPresences_(corps) {
  const valeur = String(corps || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const corpsExclu = PRESENCE_EXCLUDED_CORPS
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return valeur === corpsExclu || valeur === "hird";
}


// ============================================================
// CLÉ STABLE
// ============================================================

function construireClePresence(
  semaine,
  prenom,
  nom
) {

  return [
    String(
      semaine || ""
    ).trim(),

    String(
      prenom || ""
    )
      .trim()
      .toLowerCase(),

    String(
      nom || ""
    )
      .trim()
      .toLowerCase()
  ].join(
    "|"
  );
}


// ============================================================
// STRUCTURE DE LA FEUILLE
// ============================================================

function appliquerStructurePresences(
  sheet,
  lastRow
) {

  const headers = [[

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

  ]];


  sheet
    .getRange(
      1,
      1,
      1,
      15
    )
    .setValues(
      headers
    )
    .setFontWeight(
      "bold"
    );


  sheet.setFrozenRows(
    1
  );


  if (
    lastRow < 2
  ) {

    return;
  }


  const dataRows =
    lastRow - 1;


  // ==========================================================
  // CHECKBOXES F:L
  // ==========================================================

  sheet
    .getRange(
      2,
      6,
      dataRows,
      7
    )
    .insertCheckboxes();


  // ==========================================================
  // CHECKBOX PAYÉ
  // ==========================================================

  sheet
    .getRange(
      2,
      15,
      dataRows,
      1
    )
    .insertCheckboxes();


  // ==========================================================
  // FORMULES
  // ==========================================================

  const joursFormulas =
    [];


  const soldeFormulas =
    [];


  for (
    let row = 2;
    row <= lastRow;
    row++
  ) {

    joursFormulas.push([
      `=COUNTIF(F${row}:L${row};TRUE)`
    ]);


    soldeFormulas.push([
      `=IF(OR(B${row}="Hird du Jarl";C${row}="Recrue");0;IF(C${row}="Aspirant-Garde";M${row}*'Vue globale'!$L$2/2;M${row}*'Vue globale'!$L$2))`
    ]);
  }


  sheet
    .getRange(
      2,
      13,
      dataRows,
      1
    )
    .setFormulas(
      joursFormulas
    );


  sheet
    .getRange(
      2,
      14,
      dataRows,
      1
    )
    .setFormulas(
      soldeFormulas
    );


  // ==========================================================
  // ALIGNEMENTS
  // ==========================================================

  sheet
    .getRange(
      2,
      6,
      dataRows,
      10
    )
    .setHorizontalAlignment(
      "center"
    );


  // ==========================================================
  // LARGEURS
  // ==========================================================

  sheet.setColumnWidth(
    1,
    80
  );

  sheet.setColumnWidth(
    2,
    180
  );

  sheet.setColumnWidth(
    3,
    150
  );

  sheet.setColumnWidth(
    4,
    150
  );

  sheet.setColumnWidth(
    5,
    170
  );


  for (
    let column = 6;
    column <= 12;
    column++
  ) {

    sheet.setColumnWidth(
      column,
      55
    );
  }


  sheet.setColumnWidth(
    13,
    105
  );

  sheet.setColumnWidth(
    14,
    110
  );

  sheet.setColumnWidth(
    15,
    70
  );
}


// ============================================================
// AJOUT DE LIGNES SI NÉCESSAIRE
// ============================================================

function ensurePresenceRows(
  sheet,
  requiredRows
) {

  const currentRows =
    sheet.getMaxRows();


  if (
    currentRows >=
    requiredRows
  ) {

    return;
  }


  sheet.insertRowsAfter(
    currentRows,
    requiredRows -
      currentRows
  );
}


// ============================================================
// WEB APP
// LECTURE DES PRÉSENCES
//
// GARDE : lecture
// OFFICIER : lecture
// ============================================================

function getPresences(
  token
) {

  requireRole(
    token,
    [
      "GARDE",
      "OFFICIER"
    ]
  );


  const ss =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );


  const sheet =
    ss.getSheetByName(
      PRESENCES_SHEET_NAME
    );


  if (!sheet) {

    throw new Error(
      "Feuille Présences introuvable."
    );
  }


  SpreadsheetApp.flush();


  const lastRow =
    getLastPresenceRowWebApp(
      sheet
    );


  if (
    lastRow < 2
  ) {

    return {

      currentWeek:
        getCurrentIsoWeekWebApp(),

      rows:
        []

    };
  }


  const range =
    sheet.getRange(
      2,
      1,
      lastRow - 1,
      15
    );


  const values =
    range.getValues();


  const displayValues =
    range.getDisplayValues();


  const rows =
    [];


  for (
    let i = 0;
    i < values.length;
    i++
  ) {

    const row =
      values[i];


    if (
      row[0] === ""
      ||
      row[0] === null
    ) {

      continue;
    }


    rows.push({

      /*
        Numéro réel de ligne dans Google Sheets.
      */

      row:
        i + 2,

      semaine:
        Number(
          row[0]
        ),

      corps:
        displayValues[i][1],

      grade:
        displayValues[i][2],

      prenom:
        displayValues[i][3],

      nom:
        displayValues[i][4],

      jours: [

        row[5] === true,
        row[6] === true,
        row[7] === true,
        row[8] === true,
        row[9] === true,
        row[10] === true,
        row[11] === true

      ],

      joursPresents:
        displayValues[i][12],

      solde:
        displayValues[i][13],

      soldeRaw:
        Number(
          row[13]
        ) || 0,

      paye:
        row[14] === true

    });
  }


  return {

    currentWeek:
      getCurrentIsoWeekWebApp(),

    rows:
      rows

  };
}


// ============================================================
// WEB APP
// MODIFICATION
//
// OFFICIER UNIQUEMENT.
// ============================================================

function modifierPresence(
  token,
  row,
  column,
  checked
) {

  /*
    IMPORTANT :

    Même si un GARDE modifie manuellement
    le HTML ou appelle google.script.run
    depuis la console, le serveur refuse.
  */

  requireRole(
    token,
    [
      "OFFICIER"
    ]
  );


  row =
    Number(
      row
    );


  column =
    Number(
      column
    );


  if (
    !Number.isInteger(
      row
    )
    ||
    row < 2
  ) {

    throw new Error(
      "Ligne invalide."
    );
  }


  /*
    Seules les colonnes suivantes
    sont modifiables via la Web App :

    F:L = présence quotidienne
    O   = payé
  */

  const isPresenceDay =
    (
      column >= 6
      &&
      column <= 12
    );


  const isPaid =
    column === 15;


  if (
    !isPresenceDay
    &&
    !isPaid
  ) {

    throw new Error(
      "Cette cellule ne peut pas être modifiée."
    );
  }


  const ss =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );


  const sheet =
    ss.getSheetByName(
      PRESENCES_SHEET_NAME
    );


  if (!sheet) {

    throw new Error(
      "Feuille Présences introuvable."
    );
  }


  const lastRow =
    getLastPresenceRowWebApp(
      sheet
    );


  if (
    row >
    lastRow
  ) {

    throw new Error(
      "Cette ligne n'existe plus."
    );
  }


  /*
    Vérification supplémentaire :
    la ligne doit réellement être une ligne
    de présence.
  */

  const semaine =
    sheet
      .getRange(
        row,
        1
      )
      .getValue();


  if (
    semaine === ""
    ||
    semaine === null
  ) {

    throw new Error(
      "Ligne de présence invalide."
    );
  }


  sheet
    .getRange(
      row,
      column
    )
    .setValue(
      checked === true
    );


  SpreadsheetApp.flush();


  /*
    Retour immédiat de l'état à jour.
  */

  return getPresences(
    token
  );
}


// ============================================================
// DERNIÈRE LIGNE UTILE
// ============================================================

function getLastPresenceRowWebApp(
  sheet
) {

  const lastRow =
    sheet.getLastRow();


  if (
    lastRow < 1
  ) {

    return 1;
  }


  const values =
    sheet
      .getRange(
        1,
        1,
        lastRow,
        1
      )
      .getValues();


  for (
    let i =
      values.length - 1;
    i >= 0;
    i--
  ) {

    if (
      values[i][0] !== ""
      &&
      values[i][0] !== null
    ) {

      return i + 1;
    }
  }


  return 1;
}


// ============================================================
// SEMAINE ISO
// ============================================================

function getCurrentIsoWeekWebApp() {

  /*
    Calcul à partir de la date Stockholm
    afin d'éviter qu'un changement de jour UTC
    fasse apparaître la mauvaise semaine.
  */

  const now =
    new Date();


  const stockholmDate =
    Utilities.formatDate(
      now,
      PRESENCE_TIMEZONE,
      "yyyy-MM-dd"
    );


  const parts =
    stockholmDate
      .split("-")
      .map(
        Number
      );


  const date =
    new Date(
      Date.UTC(
        parts[0],
        parts[1] - 1,
        parts[2]
      )
    );


  const day =
    date.getUTCDay()
    || 7;


  date.setUTCDate(
    date.getUTCDate()
    +
    4
    -
    day
  );


  const yearStart =
    new Date(
      Date.UTC(
        date.getUTCFullYear(),
        0,
        1
      )
    );


  return Math.ceil(
    (
      (
        date -
        yearStart
      )
      /
      86400000
      +
      1
    )
    /
    7
  );
}
