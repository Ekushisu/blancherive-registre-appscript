/*
  Nom affiché d'un corps.

  La feuille garde le libellé de la liste Données!G : c'est lui qui est
  écrit dans Effectifs et Présences, envoyé au serveur, comparé par les
  filtres et les regroupements. Seul l'affichage le remplace, quand
  l'application doit montrer un autre nom.

  L'Organigramme nomme ses corps côté serveur (`ORGANIGRAMME_GARNISONS`,
  src/Organigramme.js) : un corps déclaré ici doit y porter le même nom.
  `scripts/test-organigramme.mjs` vérifie l'accord des deux tables.
*/

export const NOMS_AFFICHES_CORPS = {
  inquisition: "Garde inquisitoriale"
};

const normaliser = valeur => String(valeur || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "");

export function libelleCorps(corps) {
  return NOMS_AFFICHES_CORPS[normaliser(corps)] || corps;
}

/*
  Grade affiché d'un membre, selon son corps.

  Les alias viennent de la feuille Données (colonne « Alias Inquisition ») ;
  les lectures du serveur les renvoient sous `aliasGrades`
  ({ "Inquisition": { "Capitaine": "Grand Inquisiteur", … } }, voir
  src/AliasGrades.js). Un membre de l'Inquisition voit l'alias de son grade,
  ou le grade lui-même s'il n'en a pas.

  Comme pour le nom du corps, seul l'affichage change : les options des
  formulaires gardent le grade régulier pour valeur, et les tris, les
  regroupements et les couleurs restent ceux du grade régulier. `corps` peut
  être le libellé de la feuille ou le nom affiché (« Garde inquisitoriale »,
  titre d'une garnison de l'Organigramme).
*/
export function libelleGrade(grade, corps, aliasGrades) {
  const cleCorps = normaliser(corps);
  const cleGrade = normaliser(grade);
  if (!cleCorps || !cleGrade || !aliasGrades) return grade;
  for (const [corpsAlias, table] of Object.entries(aliasGrades)) {
    if (normaliser(corpsAlias) !== cleCorps && normaliser(libelleCorps(corpsAlias)) !== cleCorps) continue;
    for (const [gradeRegulier, alias] of Object.entries(table || {})) {
      if (normaliser(gradeRegulier) === cleGrade && String(alias || "").trim()) return String(alias).trim();
    }
  }
  return grade;
}
