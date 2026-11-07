/*
  Nom affiché d'un corps.

  La feuille garde le libellé de la liste Données!G : c'est lui qui est
  écrit dans Effectifs et Présences, envoyé au serveur, comparé par les
  filtres et les regroupements. Seul l'affichage le remplace, quand
  l'application doit montrer un autre nom. Aucun corps n'est renommé
  aujourd'hui.

  L'Organigramme nomme ses corps côté serveur (`ORGANIGRAMME_GARNISONS`,
  src/Organigramme.js) : un corps déclaré ici doit y porter le même nom.
  `scripts/test-organigramme.mjs` vérifie l'accord des deux tables.
*/

export const NOMS_AFFICHES_CORPS = {};

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

  Décision du propriétaire du 3 novembre 2026 : à l'Académie militaire de
  Blancherive, Caporal et Caporal-Chef s'affichent « Instructeur », Sergent et
  Sergent-Chef « Sergent-Instructeur ». La table vit ici, dans le code, et
  nulle part dans le classeur (les alias par colonne de `Données` ont été
  retirés le 1er novembre 2026).

  Comme pour le nom du corps, seul l'affichage change : la feuille, les
  formulaires, les tris, les regroupements, les rôles Discord et le serveur
  gardent le grade régulier. `corps` peut être le libellé de la feuille ou le
  nom de l'organigramme (`ORGANIGRAMME_ACADEMIE`, src/Organigramme.js) ; les
  descriptions des alias sont dans `grades.jsx`.
*/
const cleGrade = valeur => normaliser(valeur).replace(/[^a-z0-9]/g, "");

export const ALIAS_GRADES_CORPS = [
  {
    corps: ["academie militaire de blancherive", "academie militaire", "academie"],
    grades: {
      caporal: "Instructeur",
      caporalchef: "Instructeur",
      sergent: "Sergent-Instructeur",
      sergentchef: "Sergent-Instructeur"
    }
  }
];

export function libelleGrade(grade, corps) {
  const cleCorps = normaliser(corps);
  if (!cleCorps || !grade) return grade;
  const table = ALIAS_GRADES_CORPS.find(entree => entree.corps.includes(cleCorps));
  return (table && table.grades[cleGrade(grade)]) || grade;
}
