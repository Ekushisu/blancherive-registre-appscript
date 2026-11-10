/*
  Privilèges par grade (décision du propriétaire, 10 novembre 2026).

  Le rôle OFFICIER ouvre la page des Effectifs à Sergent-Chef et plus ; ce
  fichier compartimente ce qu'une session y change, d'après le grade de sa
  propre fiche dans l'ordre de `Données!A2:A` (0 = le plus haut) :

    renommer un membre ............ Capitaine et plus
    changer l'affectation (corps) . Capitaine et plus
    changer le statut ............. Capitaine et plus
    changer la spécialité ......... Capitaine et plus
    attribuer ou changer un grade . Lieutenant et plus, et seulement un grade
                                    strictement inférieur au sien, sur un
                                    membre lui-même placé sous lui ; l'ajout
                                    d'un membre attribue un grade, il suit
                                    la même règle
    remettre un lien de connexion . Lieutenant et plus (Comptes.js)

  Une session par code commun n'a pas de fiche : elle n'est pas limitée. C'est
  la voie de mise en place du propriétaire, qui disparaît avec
  `AUTH_CODES = INTENDANT`. Une session nominative dont la fiche est introuvable
  n'a aucun privilège.

  Seul le serveur fait foi : `getEffectifs` renvoie `session` pour que
  l'interface cache ou grise ce qui n'est pas permis, mais chaque mutation
  revérifie ici. Les seuils vivent dans le code, jamais dans le classeur :
  changer qui peut quoi passe par une relecture du `git diff`.

  Dépendances : `lireOrdreGradesDiscord_` et `cleGradeDiscord_` (Discord.js),
  `EFFECTIFS_WEB_DONNEES_SHEET_NAME` (Effectifs.js).
*/

const PRIVILEGES_SEUILS = {
  renommer: "Capitaine",
  corps: "Capitaine",
  statut: "Capitaine",
  specialite: "Capitaine",
  grade: "Lieutenant",
  lien: "Lieutenant"
};

const PRIVILEGES_LIBELLES = {
  renommer: "Renommer un membre",
  corps: "Changer l'affectation d'un membre",
  statut: "Changer le statut d'un membre",
  specialite: "Changer la spécialité d'un membre",
  grade: "Attribuer ou changer un grade",
  lien: "Remettre un lien de connexion"
};


/*
  Grade de la session : { grade, rang, ordre } ; `null` pour une session sans
  fiche (code commun). Une fiche introuvable ou un grade absent de
  `Données!A` donnent un rang infini : rien n'est permis.
*/
function gradeSession_(ss, auth, members) {
  if (!auth || !auth.membre) return null;
  const fiche = (members || []).find(m => m.id === auth.membre);
  const ordre = lireOrdreGradesDiscord_(ss);
  return {
    grade: fiche ? String(fiche.grade || "") : "",
    rang: fiche ? rangGradePrivileges_(ordre, fiche.grade) : Infinity,
    ordre: ordre
  };
}


// Rang d'un grade dans l'ordre de Données!A ; inconnu : Infinity.
function rangGradePrivileges_(ordre, grade) {
  const rang = ordre.indexOf(cleGradeDiscord_(grade));
  return rang < 0 ? Infinity : rang;
}


function seuilPrivilege_(ordre, cle) {
  return rangGradePrivileges_(ordre, PRIVILEGES_SEUILS[cle]);
}


// Vrai si la session peut ; une session sans fiche peut tout.
function aLePrivilege_(session, cle) {
  if (!session) return true;
  return session.rang <= seuilPrivilege_(session.ordre, cle);
}


function exigerPrivilege_(session, cle) {
  if (aLePrivilege_(session, cle)) return;
  throw new Error(
    PRIVILEGES_LIBELLES[cle] + " est réservé aux " + PRIVILEGES_SEUILS[cle] + "s et plus."
  );
}


/*
  Attribution d'un grade : strictement sous le sien. `contexte` distingue le
  grade donné (« attribuer ») du grade actuel du membre touché (« changer »).
*/
function exigerGradeSousLeSien_(session, grade, contexte) {
  if (!session) return;
  // Un grade absent de Données!A n'est jamais « sous » quiconque.
  const rang = rangGradePrivileges_(session.ordre, grade);
  if (Number.isFinite(session.rang) && Number.isFinite(rang) && rang > session.rang) return;
  throw new Error(
    contexte === "membre"
      ? "Vous ne pouvez changer le grade que d'un membre placé sous le vôtre."
      : "Vous ne pouvez attribuer qu'un grade inférieur au vôtre."
  );
}


/*
  Ce que l'interface peut proposer : `peut` par privilège,
  `gradesAttribuables` (libellés de `Données!A` strictement sous le sien ;
  `null` quand tout est permis). Jarl et Régent impérial restent exclus par
  `verifierGradeJarlEffectifsWeb_`, l'interface les retire elle-même.
*/
function privilegesSession_(ss, auth, members) {
  const session = gradeSession_(ss, auth, members);
  const peut = {};
  Object.keys(PRIVILEGES_SEUILS).forEach(cle => { peut[cle] = aLePrivilege_(session, cle); });

  let gradesAttribuables = null;
  if (session) {
    const libelles = lireLibellesGradesPrivileges_(ss);
    gradesAttribuables = Number.isFinite(session.rang)
      ? libelles.filter(libelle => rangGradePrivileges_(session.ordre, libelle) > session.rang)
      : [];
  }

  return {
    grade: session ? session.grade : "",
    nominative: Boolean(session),
    peut: peut,
    gradesAttribuables: gradesAttribuables
  };
}


// Libellés de Données!A2:A, dans l'ordre de la feuille.
function lireLibellesGradesPrivileges_(ss) {
  const donnees = ss.getSheetByName(EFFECTIFS_WEB_DONNEES_SHEET_NAME);
  if (!donnees || donnees.getLastRow() < 2) return [];
  return donnees
    .getRange(2, 1, donnees.getLastRow() - 1, 1)
    .getDisplayValues()
    .map(ligne => String(ligne[0] || "").trim())
    .filter(Boolean);
}
