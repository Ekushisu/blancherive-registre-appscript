// ============================================================
// ORGANIGRAMME
// ============================================================

const ORGANIGRAMME_EFFECTIFS_SHEET =
  "Effectifs";

const ORGANIGRAMME_DATA_SHEET =
  "Données";

const ORGANIGRAMME_ACTIVE_STATUS =
  "En service actif";


// ============================================================
// CORPS / GARNISONS OFFICIELS
// ============================================================

const ORGANIGRAMME_GARNISONS = [

  {
    key: "rivebois",
    label: "Rivebois",
    aliases: [
      "rivebois"
    ]
  },

  {
    key: "faubourgs",
    label: "Faubourgs de Blancherive",
    aliases: [
      "faubourgs de blancherive",
      "faubourgs"
    ]
  },

  {
    key: "cite",
    label: "Cité de Blancherive",
    aliases: [
      "cite de blancherive",
      "cité de blancherive"
    ]
  },

  {
    key: "cap-granite",
    label: "Cap Granite",
    aliases: [
      "cap granite",
      "cap-granite"
    ]
  },

  {
    key: "bois-de-chene",
    label: "Bois-de-Chêne",
    aliases: [
      "bois-de-chene",
      "bois de chene",
      "bois-de-chêne",
      "bois de chêne"
    ]
  },

  {
    key: "eclaireurs",
    label: "Éclaireurs",
    aliases: [
      "eclaireur",
      "eclaireurs",
      "éclaireur",
      "éclaireurs"
    ]
  }

];


// ============================================================
// API WEB
// ============================================================

function getOrganigramme(
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


  const effectifsSheet =
    ss.getSheetByName(
      ORGANIGRAMME_EFFECTIFS_SHEET
    );


  const dataSheet =
    ss.getSheetByName(
      ORGANIGRAMME_DATA_SHEET
    );


  if (!effectifsSheet) {

    throw new Error(
      "Feuille Effectifs introuvable."
    );
  }


  const personnes =
    lireEffectifsOrganigramme(
      effectifsSheet
    );


  const ordreGrades =
    lireOrdreGradesOrganigramme(
      dataSheet
    );


  // ==========================================================
  // RÉSERVE
  // ==========================================================

  const reserve =
    personnes
      .filter(
        personne =>
          estStatutReserveOrganigramme(
            personne.status
          )
      )
      .sort(
        (a, b) =>
          comparerPersonnesOrganigramme(
            a,
            b,
            ordreGrades
          )
      );


  // ==========================================================
  // SERVICE ACTIF
  // ==========================================================

  const actifs =
    personnes.filter(
      personne =>
        normaliserOrganigramme(
          personne.status
        )
        ===
        normaliserOrganigramme(
          ORGANIGRAMME_ACTIVE_STATUS
        )
    );


  // ==========================================================
  // JARL
  // ==========================================================

  let jarl =
    actifs.find(
      personne =>
        estGradeJarl(
          personne.grade
        )
    );


  /*
    Le Jarl n'a pas besoin d'être dans Effectifs.

    Si aucun Jarl n'est trouvé,
    on affiche Lucius Haldor.
  */

  if (!jarl) {

    jarl = {

      prenom:
        "Lucius",

      nom:
        "Haldor",

      nomComplet:
        "Lucius Haldor",

      grade:
        "Jarl",

      corps:
        "",

      status:
        ORGANIGRAMME_ACTIVE_STATUS

    };
  }


  // ==========================================================
  // MARÉCHAUX
  // ==========================================================

  const marechaux =
    actifs
      .filter(
        personne =>
          estGradeMarechal(
            personne.grade
          )
      )
      .sort(
        comparerNomsOrganigramme
      );


  // ==========================================================
  // COMMANDANTS
  // ==========================================================

  const commandants =
    actifs
      .filter(
        personne =>
          estGradeCommandant(
            personne.grade
          )
      )
      .sort(
        comparerNomsOrganigramme
      );


  // ==========================================================
  // MAJORS
  //
  // Bloc complètement indépendant.
  //
  // Le corps renseigné dans Effectifs
  // n'a aucune influence sur leur affichage.
  // ==========================================================

  const majors =
    actifs
      .filter(
        personne =>
          estGradeMajor(
            personne.grade
          )
      )
      .sort(
        comparerNomsOrganigramme
      );


  // ==========================================================
  // HIRD DU JARL
  //
  // Branche parallèle directement sous le Jarl.
  // ==========================================================

  const hird =
    actifs
      .filter(
        personne =>
          estHirdDuJarl(
            personne.corps
          )
      )
      .filter(
        personne =>
          !estGradeCommandementGeneral(
            personne.grade
          )
      )
      .sort(
        (a, b) =>
          comparerPersonnesOrganigramme(
            a,
            b,
            ordreGrades
          )
      );


  // ==========================================================
  // PERSONNEL POUVANT APPARAÎTRE DANS LES CORPS
  // ==========================================================

  const personnesGarnisons =
    actifs
      .filter(
        personne =>
          !estGradeCommandementGeneral(
            personne.grade
          )
      )
      .filter(
        personne =>
          !estHirdDuJarl(
            personne.corps
          )
      )
      .filter(
        personne =>
          !estEtatMajor(
            personne.corps
          )
      );


  // ==========================================================
  // CORPS / GARNISONS
  // ==========================================================

  const garnisons =
    ORGANIGRAMME_GARNISONS.map(
      garnison => {

        const membres =
          personnesGarnisons
            .filter(
              personne =>
                correspondAGarnison(
                  personne.corps,
                  garnison
                )
            )
            .sort(
              (a, b) =>
                comparerPersonnesOrganigramme(
                  a,
                  b,
                  ordreGrades
                )
            );


        return {

          key:
            garnison.key,

          nom:
            garnison.label,

          membres:
            membres

        };

      }
    );


  return {

    jarl:
      jarl,

    hird:
      hird,

    marechaux:
      marechaux,

    commandants:
      commandants,

    majors:
      majors,

    garnisons:
      garnisons,

    reserve:
      reserve

  };
}


// ============================================================
// LECTURE EFFECTIFS
// ============================================================

function lireEffectifsOrganigramme(
  sheet
) {

  const lastRow =
    sheet.getLastRow();


  const lastColumn =
    sheet.getLastColumn();


  if (
    lastRow < 2
    ||
    lastColumn < 1
  ) {

    return [];
  }


  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getDisplayValues()[0]
      .map(
        normaliserOrganigramme
      );


  const indexPrenom =
    trouverColonneOrganigramme(
      headers,
      [
        "prenom",
        "prénom"
      ]
    );


  const indexNom =
    trouverColonneOrganigramme(
      headers,
      [
        "nom"
      ]
    );


  const indexGrade =
    trouverColonneOrganigramme(
      headers,
      [
        "grade"
      ]
    );


  const indexCorps =
    trouverColonneOrganigramme(
      headers,
      [
        "corps",
        "corps de garde",
        "garnison"
      ]
    );


  const indexStatus =
    trouverColonneOrganigramme(
      headers,
      [
        "status",
        "statut"
      ]
    );


  if (
    indexPrenom === -1
    ||
    indexNom === -1
    ||
    indexGrade === -1
    ||
    indexStatus === -1
  ) {

    throw new Error(
      "Impossible d'identifier les colonnes Prénom, Nom, Grade et Statut dans Effectifs."
    );
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


  const personnes =
    [];


  for (
    const row of
    values
  ) {

    const prenom =
      String(
        row[indexPrenom]
        ||
        ""
      ).trim();


    const nom =
      String(
        row[indexNom]
        ||
        ""
      ).trim();


    if (
      !prenom
      &&
      !nom
    ) {

      continue;
    }


    personnes.push({

      prenom:
        prenom,

      nom:
        nom,

      nomComplet:
        `${prenom} ${nom}`
          .trim(),

      grade:
        String(
          row[indexGrade]
          ||
          ""
        ).trim(),

      corps:
        indexCorps >= 0
          ? String(
              row[indexCorps]
              ||
              ""
            ).trim()
          : "",

      status:
        String(
          row[indexStatus]
          ||
          ""
        ).trim()

    });
  }


  return personnes;
}


// ============================================================
// ORDRE DES GRADES
// ============================================================

function lireOrdreGradesOrganigramme(
  sheet
) {

  const result =
    new Map();


  if (!sheet) {

    return result;
  }


  const lastRow =
    sheet.getLastRow();


  if (
    lastRow < 2
  ) {

    return result;
  }


  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        1
      )
      .getDisplayValues()
      .flat();


  let ordre =
    0;


  for (
    const value of
    values
  ) {

    const grade =
      String(
        value
        ||
        ""
      ).trim();


    if (!grade) {

      continue;
    }


    const key =
      normaliserOrganigramme(
        grade
      );


    if (
      !result.has(
        key
      )
    ) {

      result.set(
        key,
        ordre++
      );
    }
  }


  return result;
}


// ============================================================
// GRADES CENTRAUX
// ============================================================

function estGradeJarl(
  grade
) {

  return normaliserOrganigramme(
    grade
  ) === "jarl";
}


function estGradeMarechal(
  grade
) {

  return normaliserOrganigramme(
    grade
  ) === "marechal";
}


function estGradeCommandant(
  grade
) {

  const value =
    normaliserOrganigramme(
      grade
    );


  return (
    value === "commandant"
    ||
    value === "commander"
  );
}


function estGradeMajor(
  grade
) {

  return normaliserOrganigramme(
    grade
  ) === "major";
}


function estGradeCommandementGeneral(
  grade
) {

  return (
    estGradeJarl(
      grade
    )
    ||
    estGradeMarechal(
      grade
    )
    ||
    estGradeCommandant(
      grade
    )
    ||
    estGradeMajor(
      grade
    )
  );
}


// ============================================================
// CORPS SPÉCIAUX
// ============================================================

function estEtatMajor(
  corps
) {

  const value =
    normaliserOrganigramme(
      corps
    );


  return (
    value === "etat-major"
    ||
    value === "etat major"
  );
}


function estHirdDuJarl(
  corps
) {

  const value =
    normaliserOrganigramme(
      corps
    );


  return (
    value === "hird du jarl"
    ||
    value === "hird"
  );
}


// ============================================================
// CORRESPONDANCE AUX GARNISONS
// ============================================================

function correspondAGarnison(
  corps,
  garnison
) {

  const value =
    normaliserOrganigramme(
      corps
    );


  return garnison.aliases
    .map(
      normaliserOrganigramme
    )
    .includes(
      value
    );
}


// ============================================================
// RÉSERVE
// ============================================================

function estStatutReserveOrganigramme(
  status
) {

  return normaliserOrganigramme(
    status
  ).includes(
    "reserve"
  );
}


// ============================================================
// TRI
// ============================================================

function comparerPersonnesOrganigramme(
  a,
  b,
  ordreGrades
) {

  const gradeA =
    normaliserOrganigramme(
      a.grade
    );


  const gradeB =
    normaliserOrganigramme(
      b.grade
    );


  const ordreA =
    ordreGrades.has(
      gradeA
    )
      ? ordreGrades.get(
          gradeA
        )
      : 9999;


  const ordreB =
    ordreGrades.has(
      gradeB
    )
      ? ordreGrades.get(
          gradeB
        )
      : 9999;


  if (
    ordreA !==
    ordreB
  ) {

    return ordreA - ordreB;
  }


  return comparerNomsOrganigramme(
    a,
    b
  );
}


function comparerNomsOrganigramme(
  a,
  b
) {

  return String(
    a.nomComplet
    ||
    ""
  ).localeCompare(
    String(
      b.nomComplet
      ||
      ""
    ),
    "fr"
  );
}


// ============================================================
// COLONNES
// ============================================================

function trouverColonneOrganigramme(
  headers,
  aliases
) {

  const normalisedAliases =
    aliases.map(
      normaliserOrganigramme
    );


  for (
    let i = 0;
    i < headers.length;
    i++
  ) {

    if (
      normalisedAliases.includes(
        headers[i]
      )
    ) {

      return i;
    }
  }


  return -1;
}


// ============================================================
// NORMALISATION
// ============================================================

function normaliserOrganigramme(
  value
) {

  return String(
    value
    ||
    ""
  )
    .trim()
    .toLowerCase()
    .normalize(
      "NFD"
    )
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}