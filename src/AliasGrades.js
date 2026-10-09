// ============================================================
// GRADES AFFICHÉS SELON LE CORPS
//
// Un corps peut nommer ses grades autrement que la Garde. La
// feuille `Données` porte, à côté de la liste des grades
// (colonne A), une colonne par corps concerné, d'en-tête
// « Alias <corps> », le corps écrit comme dans la liste des
// corps (`Données!G`). Seul cas aujourd'hui, décision du
// propriétaire du 8 octobre 2026 : « Alias Inquisition », en C.
//
//   Capitaine       → Grand Inquisiteur
//   Lieutenant-Chef → La Plume
//   Sergent-Chef    → Enquêteur
//   Caporal-Chef    → Traqueur
//   Garde           → Inquisiteur
//
// L'alias est l'équivalent du grade de sa ligne et ne sert qu'à
// l'affichage : Effectifs, Présences, soldes, tris et
// regroupements restent sur le grade régulier, et aucun alias
// n'est écrit dans une feuille. Un grade sans alias garde son
// nom.
//
// Les lectures Effectifs, Organigramme, Présences, tableau de
// bord OFFICIER et Paye renvoient la table sous `aliasGrades` ;
// le navigateur l'applique par `libelleGrade` (ui/src/corps.js).
// Les collecteurs d'une amende sont nommés côté serveur
// (`Amendes.js`), par `gradeAffiche_`.
// ============================================================

const ALIAS_GRADES_DONNEES_SHEET = "Données";


/*
  { "Inquisition": { "Capitaine": "Grand Inquisiteur", … } }

  Libellés tels qu'écrits dans la feuille : la comparaison
  ignore casse, accents et espaces de bord. Sans colonne
  d'alias, la table est vide et chaque grade garde son nom.
*/
function lireAliasGrades_(ss) {
  const sheet = ss.getSheetByName(ALIAS_GRADES_DONNEES_SHEET);

  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 2) {
    return {};
  }

  const entetes = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];

  const colonnes = [];

  // La colonne A porte les grades : elle n'est jamais une colonne d'alias.
  for (let index = 1; index < entetes.length; index++) {
    const corps = corpsEnteteAliasGrades_(entetes[index]);
    if (corps) colonnes.push({ index: index, corps: corps });
  }

  if (!colonnes.length) {
    return {};
  }

  const largeur = Math.max.apply(null, colonnes.map(c => c.index)) + 1;

  const lignes = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, largeur)
    .getDisplayValues();

  const tables = {};

  for (const colonne of colonnes) {
    const table = {};

    for (const ligne of lignes) {
      const grade = nettoyerAliasGrades_(ligne[0]);
      const alias = nettoyerAliasGrades_(ligne[colonne.index]);

      if (grade && alias && !table[grade]) {
        table[grade] = alias;
      }
    }

    tables[colonne.corps] = table;
  }

  return tables;
}


// « Alias Inquisition » → « Inquisition » ; tout autre en-tête → "".
function corpsEnteteAliasGrades_(entete) {
  const correspondance = /^alias\s+(.+)$/i.exec(nettoyerAliasGrades_(entete));
  return correspondance ? correspondance[1].trim() : "";
}


// Grade à afficher pour un membre de `corps` (libellé de la feuille).
function gradeAffiche_(grade, corps, aliasGrades) {
  const cleCorps = normaliserAliasGrades_(corps);
  const cleGrade = normaliserAliasGrades_(grade);

  if (!cleCorps || !cleGrade || !aliasGrades) {
    return grade;
  }

  for (const corpsAlias of Object.keys(aliasGrades)) {
    if (normaliserAliasGrades_(corpsAlias) !== cleCorps) continue;

    const table = aliasGrades[corpsAlias] || {};

    for (const gradeRegulier of Object.keys(table)) {
      if (normaliserAliasGrades_(gradeRegulier) === cleGrade) {
        return table[gradeRegulier];
      }
    }
  }

  return grade;
}


function nettoyerAliasGrades_(value) {
  return String(value === null || typeof value === "undefined" ? "" : value)
    .replace(/ /g, " ")
    .trim();
}


function normaliserAliasGrades_(value) {
  return nettoyerAliasGrades_(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
