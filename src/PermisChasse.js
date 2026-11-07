// ============================================================
// REGISTRE DES PERMIS DE CHASSE
//
// Qui a le droit de chasser sur les terres de la châtellerie. Un
// permis est délivré par la Garde, au nom d'une personne, et vaut
// à vie : la page ne connaît ni échéance ni renouvellement. Il ne
// cesse que par révocation, qui retire la ligne du registre.
//
// Une feuille, créée à la première consultation si elle manque :
//
//   PermisChasse   A Prénom   B Nom   C Date de délivrance
//
// Le nom est facultatif (bien des habitants de Bordeciel n'en ont
// pas) ; le prénom suffit. Une même personne, prénom et nom
// confondus sans casse ni accents, n'a qu'un permis : un second
// enregistrement est refusé, et un homonyme se distingue par son
// nom. La date est une vraie date de cellule (dd/MM/yyyy), lisible
// et triable dans Sheets ; l'application la renvoie en `yyyy-MM-dd`.
//
// GARDE et OFFICIER : lecture et délivrance.
// OFFICIER seul : révocation.
// INTENDANT et visiteur public : aucun accès.
//
// La révocation exige l'identité affichée de la ligne (`attendu`) :
// une page restée ouverte ne révoque jamais un autre permis que
// celui qu'elle montre. Le bloc A:C est ensuite réécrit compacté,
// sous verrou de script, sans ligne fantôme.
//
// Helpers partagés provenant d'Amendes.js : nettoyerSaisieUtilisateur(),
// parseDateInput(), AMENDES_TIMEZONE.
// ============================================================

const PERMIS_CHASSE_SHEET_NAME = "PermisChasse";
const PERMIS_CHASSE_HEADERS = ["Prénom", "Nom", "Date de délivrance"];
const PERMIS_CHASSE_LIMITES = { prenom: 60, nom: 80 };
const PERMIS_CHASSE_FORMAT_DATE = "dd/MM/yyyy";


// ============================================================
// WEB APP
// ============================================================

function getPermisChasse(token) {
  requireRole(token, ["GARDE", "OFFICIER"]);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = feuillePermisChasse_(ss);
  return construirePermisChasse_(lirePermisChasse_(sheet).permis);
}


/*
  Délivre un permis. data = { prenom, nom, date } ; `nom` facultatif,
  `date` au format yyyy-MM-dd, jamais dans l'avenir.
*/
function ajouterPermisChasse(token, data) {
  requireRole(token, ["GARDE", "OFFICIER"]);

  const permis = normaliserPermisChasse_(data);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  // La création éventuelle de la feuille prend son propre verrou :
  // elle a lieu avant le verrou d'écriture.
  const sheet = feuillePermisChasse_(ss);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const etat = lirePermisChasse_(sheet);
    const cle = cleTitulairePermis_(permis.prenom, permis.nom);
    const existant = etat.permis.find(p => cleTitulairePermis_(p.prenom, p.nom) === cle);
    if (existant) {
      throw new Error(`Un permis est déjà enregistré au nom de « ${nomTitulairePermis_(existant)} », délivré le ${afficherDatePermis_(existant.date)}.`);
    }

    const row = etat.hauteur + 2;
    ecrireLignePermisChasse_(sheet, row, permis);

    etat.permis.push({ row, prenom: permis.prenom, nom: permis.nom, date: permis.date });
    return construirePermisChasse_(etat.permis);
  } finally {
    lock.releaseLock();
  }
}


/*
  Révoque un permis : la ligne quitte le registre. `attendu` porte
  l'identité affichée ({ prenom, nom, date }) ; si la ligne ne la
  porte plus, rien n'est écrit.
*/
function revoquerPermisChasse(token, row, attendu) {
  requireRole(token, ["OFFICIER"]);

  row = Number(row);
  if (!Number.isInteger(row) || row < 2) throw new Error("Ligne de permis invalide.");
  const identite = lireIdentitePermis_(attendu);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = feuillePermisChasse_(ss);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const etat = lirePermisChasse_(sheet);
    const index = etat.permis.findIndex(p => p.row === row);
    const actuel = index === -1 ? null : etat.permis[index];
    if (!actuel || actuel.prenom !== identite.prenom || actuel.nom !== identite.nom || actuel.date !== identite.date) {
      throw new Error("Ce permis a changé ou a déjà été révoqué. Actualisez la page.");
    }

    etat.permis.splice(index, 1);
    ecrireBlocPermisChasse_(sheet, etat);
    return construirePermisChasse_(etat.permis);
  } finally {
    lock.releaseLock();
  }
}


// ============================================================
// FEUILLE
// ============================================================

/*
  Renvoie la feuille, en la créant avec ses en-têtes si elle manque.
  Une feuille existante n'est jamais modifiée : des en-têtes
  différents arrêtent tout, plutôt que d'écrire dans des colonnes
  qu'on ne comprend pas.
*/
function feuillePermisChasse_(ss) {
  let sheet = ss.getSheetByName(PERMIS_CHASSE_SHEET_NAME);
  if (!sheet) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      sheet = ss.getSheetByName(PERMIS_CHASSE_SHEET_NAME);
      if (!sheet) {
        sheet = ss.insertSheet(PERMIS_CHASSE_SHEET_NAME);
        sheet.getRange(1, 1, 1, PERMIS_CHASSE_HEADERS.length).setNumberFormat("@").setValues([PERMIS_CHASSE_HEADERS]).setFontWeight("bold");
        sheet.setFrozenRows(1);
        SpreadsheetApp.flush();
      }
    } finally {
      lock.releaseLock();
    }
  }
  const header = sheet.getRange(1, 1, 1, PERMIS_CHASSE_HEADERS.length).getDisplayValues()[0].map(nettoyerSaisieUtilisateur);
  if (header.join("|") !== PERMIS_CHASSE_HEADERS.join("|")) {
    throw new Error(`La feuille ${PERMIS_CHASSE_SHEET_NAME} doit contenir les colonnes ${PERMIS_CHASSE_HEADERS.join(", ")} en A:C. Aucun contenu remplacé.`);
  }
  return sheet;
}


/*
  Lit tout le bloc A:C. `hauteur` compte les lignes occupées, lignes
  vides intermédiaires comprises, pour qu'une réécriture efface bien
  tout ce qui existait. Une ligne sans prénom ou sans date lisible
  arrête la page en nommant sa ligne physique, plutôt que d'être
  passée sous silence.
*/
function lirePermisChasse_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { permis: [], hauteur: 0 };

  const values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  const permis = [];

  values.forEach((row, i) => {
    const prenom = nettoyerSaisieUtilisateur(row[0]).replace(/\s+/g, " ");
    const nom = nettoyerSaisieUtilisateur(row[1]).replace(/\s+/g, " ");
    const brut = row[2];
    if (!prenom && !nom && (brut === "" || brut === null || typeof brut === "undefined")) return;

    const date = lireDatePermis_(brut);
    if (!prenom || !date) {
      throw new Error(`Ligne ${i + 2} de la feuille ${PERMIS_CHASSE_SHEET_NAME} invalide : prénom et date de délivrance sont requis.`);
    }
    permis.push({ row: i + 2, prenom, nom, date });
  });

  return { permis, hauteur: lastRow - 1 };
}


function ecrireLignePermisChasse_(sheet, row, permis) {
  if (sheet.getMaxRows() < row) sheet.insertRowsAfter(sheet.getMaxRows(), row - sheet.getMaxRows());
  const range = sheet.getRange(row, 1, 1, 3);
  const precedentes = range.getValues();
  try {
    sheet.getRange(row, 1, 1, 2).setNumberFormat("@");
    sheet.getRange(row, 3, 1, 1).setNumberFormat(PERMIS_CHASSE_FORMAT_DATE);
    range.setValues([[permis.prenom, permis.nom, parseDateInput(permis.date)]]);
    SpreadsheetApp.flush();
  } catch (error) {
    try { range.setValues(precedentes); SpreadsheetApp.flush(); }
    catch (rollbackError) { console.error("Impossible de restaurer la ligne de permis après un échec d'écriture.", rollbackError); }
    throw error;
  }
}


/*
  Réécrit le bloc entier, compacté : le registre tient en quelques
  dizaines de lignes, et une écriture en bloc ne laisse ni ligne
  fantôme ni doublon quand deux gardes travaillent en même temps.
*/
function ecrireBlocPermisChasse_(sheet, etat) {
  const rows = etat.permis.map(p => [p.prenom, p.nom, parseDateInput(p.date)]);
  const hauteur = Math.max(rows.length, etat.hauteur);
  if (!hauteur) return;
  while (rows.length < hauteur) rows.push(["", "", ""]);

  if (sheet.getMaxRows() < hauteur + 1) sheet.insertRowsAfter(sheet.getMaxRows(), hauteur + 1 - sheet.getMaxRows());
  const range = sheet.getRange(2, 1, hauteur, 3);
  const precedentes = range.getValues();
  try {
    sheet.getRange(2, 1, hauteur, 2).setNumberFormat("@");
    sheet.getRange(2, 3, hauteur, 1).setNumberFormat(PERMIS_CHASSE_FORMAT_DATE);
    range.setValues(rows);
    SpreadsheetApp.flush();
  } catch (error) {
    try { range.setValues(precedentes); SpreadsheetApp.flush(); }
    catch (rollbackError) { console.error("Impossible de restaurer le registre des permis après un échec d'écriture.", rollbackError); }
    throw error;
  }
  etat.permis.forEach((p, i) => { p.row = i + 2; });
}


// ============================================================
// VALIDATION
// ============================================================

function normaliserPermisChasse_(data) {
  if (!data || typeof data !== "object") throw new Error("Données du permis manquantes.");
  const prenom = nettoyerSaisieUtilisateur(data.prenom).replace(/\s+/g, " ");
  const nom = nettoyerSaisieUtilisateur(data.nom).replace(/\s+/g, " ");

  if (!prenom) throw new Error("Le prénom du titulaire est obligatoire.");
  if (prenom.length > PERMIS_CHASSE_LIMITES.prenom) throw new Error(`Le prénom ne peut dépasser ${PERMIS_CHASSE_LIMITES.prenom} caractères.`);
  if (nom.length > PERMIS_CHASSE_LIMITES.nom) throw new Error(`Le nom ne peut dépasser ${PERMIS_CHASSE_LIMITES.nom} caractères.`);
  [prenom, nom].forEach(valeur => {
    if (valeur.startsWith("=")) throw new Error("Un nom ne peut pas commencer par le signe égal.");
  });

  const date = formaterDateIsoPermis_(parseDateInput(data.date));
  if (date > aujourdhuiPermis_()) throw new Error("La date de délivrance ne peut pas être dans l'avenir.");

  return { prenom, nom, date };
}


function lireIdentitePermis_(attendu) {
  if (!attendu || typeof attendu !== "object") {
    throw new Error("Ce registre n'est plus à jour. Rechargez la page avant de révoquer un permis.");
  }
  const identite = {};
  ["prenom", "nom", "date"].forEach(champ => {
    if (typeof attendu[champ] !== "string") {
      throw new Error("Ce registre n'est plus à jour. Rechargez la page avant de révoquer un permis.");
    }
    identite[champ] = nettoyerSaisieUtilisateur(attendu[champ]).replace(/\s+/g, " ");
  });
  return identite;
}


function cleTitulairePermis_(prenom, nom) {
  const normaliser = valeur => nettoyerSaisieUtilisateur(valeur).replace(/\s+/g, " ").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return `${normaliser(prenom)}|${normaliser(nom)}`;
}


function nomTitulairePermis_(permis) {
  return [permis.prenom, permis.nom].filter(Boolean).join(" ");
}


// ============================================================
// DATES
// ============================================================

/*
  Une cellule de date revient de `getValues()` en objet `Date` ; une
  cellule saisie à la main en texte peut porter `dd/MM/yyyy` ou
  `yyyy-MM-dd`. Les trois formes sont ramenées à `yyyy-MM-dd` ; toute
  autre valeur est illisible (chaîne vide).
*/
function lireDatePermis_(valeur) {
  if (valeur instanceof Date) {
    return isNaN(valeur.getTime()) ? "" : formaterDateIsoPermis_(valeur);
  }
  const texte = nettoyerSaisieUtilisateur(valeur);
  let match = texte.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return verifierDateIsoPermis_(texte);
  match = texte.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return verifierDateIsoPermis_(`${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`);
  return "";
}


function verifierDateIsoPermis_(iso) {
  try { parseDateInput(iso); return iso; }
  catch (error) { return ""; }
}


function formaterDateIsoPermis_(date) {
  return Utilities.formatDate(date, AMENDES_TIMEZONE, "yyyy-MM-dd");
}


function aujourdhuiPermis_() {
  return formaterDateIsoPermis_(new Date());
}


function afficherDatePermis_(iso) {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(iso || "");
}


// ============================================================
// RÉPONSE WEB
// ============================================================

/*
  Les permis les plus récents d'abord, puis par prénom et nom : la
  recherche par prénom se fait dans le navigateur.
*/
function construirePermisChasse_(permis) {
  const compare = (a, b) => a.localeCompare(b, "fr", { sensitivity: "base" });
  return {
    permis: permis
      .map(p => ({ row: p.row, prenom: p.prenom, nom: p.nom, date: p.date }))
      .sort((a, b) => compare(b.date, a.date) || compare(a.prenom, b.prenom) || compare(a.nom, b.nom) || a.row - b.row)
  };
}
