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
// ACADÉMIE MILITAIRE DE BLANCHERIVE
//
// Corps spécial (décision du propriétaire, 3 novembre 2026),
// hors des garnisons : rendu au bas de l'organigramme dans un
// encart détaché, comme les Majors hors commandement. Son chef
// n'est pas un Capitaine mais un Sergent-Chef. Ses membres sont
// pointés et soldés comme ceux de tout corps (Presences.js,
// Paye.js : financeur argentier). Les alias de ses grades
// (Instructeur, Sergent-Instructeur) ne vivent que dans
// l'interface (ui/src/corps.js) : le serveur rend le grade de
// la feuille.
// ============================================================

const ORGANIGRAMME_ACADEMIE = {
  key: "academie",
  label: "Académie militaire de Blancherive",
  aliases: [
    "academie militaire de blancherive",
    "académie militaire de blancherive",
    "academie militaire",
    "académie militaire",
    "academie",
    "académie"
  ]
};


// ============================================================
// API WEB
// ============================================================

function getOrganigramme(
  token
) {

  /*
    INTENDANT lit l'organigramme comme un GARDE : les cuisines
    de la cour en tirent l'effectif à nourrir. Le filtrage des
    nouveautés par `historiqueEffectifsPourRole_` ne laisse
    passer que les membres actifs ou réservistes pour tout rôle
    autre qu'OFFICIER, et le déclencheur d'historique reste
    installé par les seuls OFFICIER.
  */

  const auth = requireRole(
    token,
    [
      "GARDE",
      "OFFICIER",
      "INTENDANT"
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


  const history = synchroniserHistoriqueEffectifs_(ss);
  if (auth.role === "OFFICIER") installerDeclencheurHistoriqueEffectifs_(ss);
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
  // JARL OU RÉGENCE IMPÉRIALE
  //
  // Un Jarl en service actif tient le sommet, seul. Sans lui,
  // le ou les Régents impériaux en service actif le prennent :
  // la châtellerie est sous régence. Sans l'un ni l'autre, le
  // poste de Jarl est vacant. Un Jarl mort, radié ou parti ne
  // s'affiche plus.
  // ==========================================================

  const jarl =
    actifs.find(
      personne =>
        estGradeJarl(
          personne.grade
        )
    ) || null;


  const regents =
    jarl
      ? []
      : actifs
          .filter(
            personne =>
              estGradeRegent(
                personne.grade
              )
          )
          .sort(
            comparerNomsOrganigramme
          );


  // ==========================================================
  // HUSCARL
  //
  // Grade à part. Un Huscarl de l'État-Major est le garde
  // personnel du Jarl, sous son autorité directe : rendu ici,
  // hors de la chaîne de l'État-Major. Sous régence, il reste à
  // sa place, détaché du sommet. Un Huscarl d'un autre corps
  // protège le thane local : il est rendu au bas de la colonne
  // de son corps (`garnison.huscarls`), décision du propriétaire
  // du 3 novembre 2026.
  // ==========================================================

  const huscarls =
    actifs
      .filter(
        personne =>
          estGradeHuscarl(
            personne.grade
          )
          &&
          estEtatMajor(
            personne.corps
          )
      )
      .sort(
        comparerNomsOrganigramme
      );


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
  // Les Majors de l'État-Major prolongent la chaîne centrale.
  // Rivebois et Bois-de-Chêne ont un commandement commun intermédiaire.
  // Les autres Majors actifs restent dans un bloc indépendant.
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

  const majorsEtatMajor = majors.filter(personne => estEtatMajor(personne.corps));
  const garnisonsCommandementLocal = ORGANIGRAMME_GARNISONS.filter(
    garnison => garnison.key === "rivebois" || garnison.key === "bois-de-chene"
  );
  const estMajorLocal = personne => garnisonsCommandementLocal.some(
    garnison => correspondAGarnison(personne.corps, garnison)
  );
  const majorsCommandementLocal = majors.filter(estMajorLocal);
  const majorsIndependants = majors.filter(
    personne => !estEtatMajor(personne.corps) && !estMajorLocal(personne)
  );


  // ==========================================================
  // PERSONNEL POUVANT APPARAÎTRE DANS LES CORPS
  //
  // Le Hird du Jarl, dissous, n'a plus de branche : un corps
  // absent d'`ORGANIGRAMME_GARNISONS` n'est pas rendu. Les
  // Huscarls d'un corps y figurent, à part de son personnel.
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

        const personnesCorps =
          personnesGarnisons
            .filter(
              personne =>
                correspondAGarnison(
                  personne.corps,
                  garnison
                )
            );


        const membres =
          personnesCorps
            .filter(
              personne =>
                !estGradeHuscarl(
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


        // Gardiens des thanes locaux, rendus sous tout le personnel du corps.
        const huscarlsCorps =
          personnesCorps
            .filter(
              personne =>
                estGradeHuscarl(
                  personne.grade
                )
            )
            .sort(
              comparerNomsOrganigramme
            );


        return {

          key:
            garnison.key,

          nom:
            garnison.label,

          membres:
            membres,

          huscarls:
            huscarlsCorps

        };

      }
    );


  // ==========================================================
  // ACADÉMIE MILITAIRE
  //
  // Hors des garnisons. Son chef est le Sergent-Chef (`chefs`,
  // par nom) ; le reste du personnel est trié par grade
  // (`membres`). Un Major de l'Académie rejoint, comme ceux des
  // corps directs, les Majors hors commandement.
  // ==========================================================

  const personnesAcademie =
    personnesGarnisons
      .filter(
        personne =>
          estAcademie(
            personne.corps
          )
      );


  const academie = {

    key:
      ORGANIGRAMME_ACADEMIE.key,

    nom:
      ORGANIGRAMME_ACADEMIE.label,

    chefs:
      personnesAcademie
        .filter(
          personne =>
            estGradeSergentChef(
              personne.grade
            )
        )
        .sort(
          comparerNomsOrganigramme
        ),

    membres:
      personnesAcademie
        .filter(
          personne =>
            !estGradeSergentChef(
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
        )

  };


  return {

    changes: historiqueEffectifsPourRole_(history, auth.role),

    jarl:
      jarl,

    regents:
      regents,

    huscarls:
      huscarls,

    marechaux:
      marechaux,

    commandants:
      commandants,

    majors:
      majorsIndependants,

    majorsEtatMajor:
      majorsEtatMajor,

    commandementLocal: {
      nom: "Commandement de Rivebois et Bois-de-Chêne",
      majors: majorsCommandementLocal,
      garnisonKeys: garnisonsCommandementLocal.map(garnison => garnison.key)
    },

    garnisons:
      garnisons,

    academie:
      academie,

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

  const indexId = headers.indexOf("id membre");


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

      memberId: indexId >= 0 ? row[indexId] : "",

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


/*
  Régent impérial, au masculin comme au féminin. Il gouverne la
  châtellerie en l'absence de Jarl ; comme lui, il est hors
  Présences et sans solde, et son grade ne se change que dans la
  feuille.
*/
function estGradeRegent(
  grade
) {

  const value =
    normaliserOrganigramme(
      grade
    );


  return (
    value === "regent imperial"
    ||
    value === "regente imperiale"
  );
}


function estGradeCommandementGeneral(
  grade
) {

  return (
    estGradeJarl(
      grade
    )
    ||
    estGradeRegent(
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


/*
  Grade rendu à part, accepté seul ou avec son titre complet
  (« Huscarl de Blancherive »).
*/
function estGradeHuscarl(
  grade
) {

  const value =
    normaliserOrganigramme(
      grade
    );


  return (
    value === "huscarl"
    ||
    value.startsWith(
      "huscarl "
    )
  );
}


// Chef de l'Académie militaire : « Sergent-Chef » (ou « Sergent Chef »).
function estGradeSergentChef(
  grade
) {

  const value =
    normaliserOrganigramme(
      grade
    );


  return (
    value === "sergent-chef"
    ||
    value === "sergent chef"
  );
}


// ============================================================
// CORPS SPÉCIAUX
// ============================================================

function estAcademie(
  corps
) {

  return correspondAGarnison(
    corps,
    ORGANIGRAMME_ACADEMIE
  );
}


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
