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
