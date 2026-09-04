// ============================================================
// TABLEAU DE BORD OFFICIER - PRÉSENCES
// ============================================================

const PRESENCE_DASHBOARD_PRESENCES_SHEET = "Présences";
const PRESENCE_DASHBOARD_EFFECTIFS_SHEET = "Effectifs";
const PRESENCE_DASHBOARD_ACTIVE_STATUS = "En service actif";
const PRESENCE_DASHBOARD_TIMEZONE = "Europe/Stockholm";

/*
  Même seuil que celui utilisé dans la Vue globale :
  au-delà de 5 jours sans présence, le garde est signalé.
*/
const PRESENCE_DASHBOARD_INACTIVITY_DAYS = 5;


// ============================================================
// API WEB
// ============================================================

function getPresenceOfficerDashboard(token) {
  requireRole(token, ["OFFICIER"]);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const presenceSheet = ss.getSheetByName(
    PRESENCE_DASHBOARD_PRESENCES_SHEET
  );

  const effectifsSheet = ss.getSheetByName(
    PRESENCE_DASHBOARD_EFFECTIFS_SHEET
  );

  if (!presenceSheet) {
    throw new Error("Feuille Présences introuvable.");
  }

  if (!effectifsSheet) {
    throw new Error("Feuille Effectifs introuvable.");
  }

  const now = new Date();

  const currentWeek = presenceDashboardGetIsoWeek_(now);

  const currentYear = Number(
    Utilities.formatDate(
      now,
      PRESENCE_DASHBOARD_TIMEZONE,
      "yyyy"
    )
  );

  // ==========================================================
  // LECTURE PRÉSENCES
  //
  // A Semaine
  // B Corps
  // C Grade
  // D Prénom
  // E Nom
  // F:L jours
  // M Jours présents
  // N Solde
  // O Payé
  // ==========================================================

  const lastRow = presenceSheet.getLastRow();

  const presenceRows =
    lastRow >= 2
      ? presenceSheet
          .getRange(
            2,
            1,
            lastRow - 1,
            15
          )
          .getValues()
      : [];

  let currentWeekTotal = 0;
  let currentWeekPaid = 0;
  let pastUnpaidCount = 0;
  let pastUnpaidAmount = 0;

  for (const row of presenceRows) {
    const week = Number(row[0]);
    const salary = presenceDashboardNumber_(row[13]);
    const paid = row[14] === true;

    if (!Number.isFinite(week)) {
      continue;
    }

    if (presenceDashboardIsExcludedCorps_(row[1])) {
      continue;
    }

    // ========================================================
    // SEMAINE COURANTE
    // ========================================================

    if (week === currentWeek) {
      currentWeekTotal += salary;

      if (paid) {
        currentWeekPaid += salary;
      }

      continue;
    }

    // ========================================================
    // SEMAINES PASSÉES
    // ========================================================

    if (
      week < currentWeek &&
      salary > 0 &&
      !paid
    ) {
      pastUnpaidCount++;
      pastUnpaidAmount += salary;
    }
  }

  // ==========================================================
  // GARDES INACTIFS
  // ==========================================================

  const activeGuards =
    presenceDashboardReadActiveGuards_(
      effectifsSheet
    );

  const lastPresences =
    presenceDashboardComputeLastPresences_(
      presenceRows,
      currentYear
    );

  const todayMidnight =
    presenceDashboardDateOnly_(now);

  const inactivityThreshold =
    new Date(todayMidnight);

  inactivityThreshold.setDate(
    inactivityThreshold.getDate() -
    PRESENCE_DASHBOARD_INACTIVITY_DAYS
  );

  const inactive = [];

  for (const guard of activeGuards) {
    const key =
      presenceDashboardPersonKey_(
        guard.prenom,
        guard.nom
      );

    const lastPresence =
      lastPresences.get(key) || null;

    /*
      Aucun pointage connu.
    */

    if (!lastPresence) {
      inactive.push({
        prenom: guard.prenom,
        nom: guard.nom,
        nomComplet: guard.nomComplet,
        grade: guard.grade,
        corps: guard.corps,
        jamaisPresent: true,
        dernierePresence: "",
        joursDepuis: null
      });

      continue;
    }

    /*
      Dernière présence trop ancienne.
    */

    if (
      lastPresence <
      inactivityThreshold
    ) {
      const diffMs =
        todayMidnight.getTime() -
        lastPresence.getTime();

      const days = Math.floor(
        diffMs /
        (
          24 *
          60 *
          60 *
          1000
        )
      );

      inactive.push({
        prenom: guard.prenom,
        nom: guard.nom,
        nomComplet: guard.nomComplet,
        grade: guard.grade,
        corps: guard.corps,
        jamaisPresent: false,
        dernierePresence:
          Utilities.formatDate(
            lastPresence,
            PRESENCE_DASHBOARD_TIMEZONE,
            "dd/MM/yyyy"
          ),
        joursDepuis: days
      });
    }
  }

  /*
    Les "jamais présents" en premier,
    puis les absences les plus longues.
  */

  inactive.sort((a, b) => {
    if (
      a.jamaisPresent !==
      b.jamaisPresent
    ) {
      return a.jamaisPresent ? -1 : 1;
    }

    if (
      !a.jamaisPresent &&
      !b.jamaisPresent
    ) {
      const dayDiff =
        Number(b.joursDepuis) -
        Number(a.joursDepuis);

      if (dayDiff !== 0) {
        return dayDiff;
      }
    }

    return String(
      a.nomComplet || ""
    ).localeCompare(
      String(
        b.nomComplet || ""
      ),
      "fr"
    );
  });

  return {
    currentWeek: currentWeek,

    currentWeekTotal:
      currentWeekTotal,

    currentWeekPaid:
      currentWeekPaid,

    currentWeekRemaining:
      Math.max(
        0,
        currentWeekTotal -
        currentWeekPaid
      ),

    pastUnpaidCount:
      pastUnpaidCount,

    pastUnpaidAmount:
      pastUnpaidAmount,

    inactivityDays:
      PRESENCE_DASHBOARD_INACTIVITY_DAYS,

    inactive:
      inactive
  };
}


// ============================================================
// LECTURE DES EFFECTIFS ACTIFS
// ============================================================

function presenceDashboardReadActiveGuards_(
  sheet
) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2) {
    return [];
  }

  const headers = sheet
    .getRange(
      1,
      1,
      1,
      lastColumn
    )
    .getDisplayValues()[0]
    .map(
      presenceDashboardNormalize_
    );

  let firstNameIndex =
    presenceDashboardFindHeader_(
      headers,
      [
        "prenom",
        "prénom"
      ]
    );

  let lastNameIndex =
    presenceDashboardFindHeader_(
      headers,
      [
        "nom"
      ]
    );

  let gradeIndex =
    presenceDashboardFindHeader_(
      headers,
      [
        "grade"
      ]
    );

  let corpsIndex =
    presenceDashboardFindHeader_(
      headers,
      [
        "corps",
        "corps de garde",
        "garnison"
      ]
    );

  let statusIndex =
    presenceDashboardFindHeader_(
      headers,
      [
        "status",
        "statut"
      ]
    );

  /*
    Fallback sur la structure connue de Effectifs :

    C Prénom
    D Nom
    E Grade
    F Corps
    G Statut
  */

  if (firstNameIndex < 0) {
    firstNameIndex = 2;
  }

  if (lastNameIndex < 0) {
    lastNameIndex = 3;
  }

  if (gradeIndex < 0) {
    gradeIndex = 4;
  }

  if (corpsIndex < 0) {
    corpsIndex = 5;
  }

  if (statusIndex < 0) {
    statusIndex = 6;
  }

  const values = sheet
    .getRange(
      2,
      1,
      lastRow - 1,
      lastColumn
    )
    .getDisplayValues();

  const guards = [];

  for (const row of values) {
    const status =
      String(
        row[statusIndex] ||
        ""
      ).trim();

    if (
      presenceDashboardNormalize_(
        status
      )
      !==
      presenceDashboardNormalize_(
        PRESENCE_DASHBOARD_ACTIVE_STATUS
      )
    ) {
      continue;
    }

    const prenom =
      String(
        row[firstNameIndex] ||
        ""
      ).trim();

    const nom =
      String(
        row[lastNameIndex] ||
        ""
      ).trim();

    const corps =
      String(
        row[corpsIndex] ||
        ""
      ).trim();

    if (
      (!prenom && !nom)
      ||
      presenceDashboardIsExcludedCorps_(corps)
    ) {
      continue;
    }

    guards.push({
      prenom: prenom,
      nom: nom,
      nomComplet:
        `${prenom} ${nom}`.trim(),
      grade:
        String(
          row[gradeIndex] ||
          ""
        ).trim(),
      corps:
        corps
    });
  }

  return guards;
}

function presenceDashboardIsExcludedCorps_(corps) {
  const value = presenceDashboardNormalize_(corps);
  return value === "hird du jarl" || value === "hird";
}


// ============================================================
// CALCUL DERNIÈRE PRÉSENCE
// ============================================================

function presenceDashboardComputeLastPresences_(
  rows,
  year
) {
  const result = new Map();

  for (const row of rows) {
    const week = Number(row[0]);

    if (!Number.isFinite(week)) {
      continue;
    }

    const prenom =
      String(
        row[3] ||
        ""
      ).trim();

    const nom =
      String(
        row[4] ||
        ""
      ).trim();

    if (!prenom && !nom) {
      continue;
    }

    const key =
      presenceDashboardPersonKey_(
        prenom,
        nom
      );

    const monday =
      presenceDashboardIsoWeekMonday_(
        year,
        week
      );

    for (
      let day = 0;
      day < 7;
      day++
    ) {
      const present =
        row[5 + day] === true;

      if (!present) {
        continue;
      }

      const date =
        new Date(monday);

      date.setDate(
        date.getDate() +
        day
      );

      const previous =
        result.get(key);

      if (
        !previous ||
        date > previous
      ) {
        result.set(
          key,
          date
        );
      }
    }
  }

  return result;
}


// ============================================================
// ISO WEEK
// ============================================================

function presenceDashboardGetIsoWeek_(
  date
) {
  const stockholmDate =
    new Date(
      Utilities.formatDate(
        date,
        PRESENCE_DASHBOARD_TIMEZONE,
        "yyyy/MM/dd HH:mm:ss"
      )
    );

  const tmp =
    new Date(
      stockholmDate.valueOf()
    );

  const day =
    (
      stockholmDate.getDay() +
      6
    ) %
    7;

  tmp.setDate(
    tmp.getDate() -
    day +
    3
  );

  const firstThursday =
    new Date(
      tmp.getFullYear(),
      0,
      4
    );

  const firstDay =
    (
      firstThursday.getDay() +
      6
    ) %
    7;

  firstThursday.setDate(
    firstThursday.getDate() -
    firstDay +
    3
  );

  return (
    1 +
    Math.round(
      (
        tmp -
        firstThursday
      ) /
      604800000
    )
  );
}


// ============================================================
// LUNDI D'UNE SEMAINE ISO
// ============================================================

function presenceDashboardIsoWeekMonday_(
  year,
  week
) {
  const januaryFourth =
    new Date(
      year,
      0,
      4
    );

  const day =
    januaryFourth.getDay() ||
    7;

  const mondayWeekOne =
    new Date(
      januaryFourth
    );

  mondayWeekOne.setDate(
    januaryFourth.getDate() -
    day +
    1
  );

  const result =
    new Date(
      mondayWeekOne
    );

  result.setDate(
    result.getDate() +
    (
      week - 1
    ) *
    7
  );

  return presenceDashboardDateOnly_(
    result
  );
}


// ============================================================
// HELPERS
// ============================================================

function presenceDashboardDateOnly_(
  date
) {
  const year =
    Number(
      Utilities.formatDate(
        date,
        PRESENCE_DASHBOARD_TIMEZONE,
        "yyyy"
      )
    );

  const month =
    Number(
      Utilities.formatDate(
        date,
        PRESENCE_DASHBOARD_TIMEZONE,
        "MM"
      )
    );

  const day =
    Number(
      Utilities.formatDate(
        date,
        PRESENCE_DASHBOARD_TIMEZONE,
        "dd"
      )
    );

  return new Date(
    year,
    month - 1,
    day
  );
}


function presenceDashboardPersonKey_(
  prenom,
  nom
) {
  return presenceDashboardNormalize_(
    `${prenom} ${nom}`
  );
}


function presenceDashboardNumber_(
  value
) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}


function presenceDashboardNormalize_(
  value
) {
  return String(
    value ||
    ""
  )
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}


function presenceDashboardFindHeader_(
  headers,
  aliases
) {
  const normalizedAliases =
    aliases.map(
      presenceDashboardNormalize_
    );

  for (
    let i = 0;
    i < headers.length;
    i++
  ) {
    if (
      normalizedAliases.includes(
        headers[i]
      )
    ) {
      return i;
    }
  }

  return -1;
}
