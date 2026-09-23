// ============================================================
// INVENTAIRE DE LA GARDE
//
// Ce que contiennent les coffres de Fort-Dragon, coffre par
// coffre. La page répond à une question d'intendance : « avons-
// nous encore des torches, et dans quel coffre ? »
//
// Deux feuilles, créées à la première consultation si elles
// n'existent pas :
//
//   Coffres      A ID coffre   B Nom   C Position   D Description
//   Inventaire   A ID coffre   B ID objet   C Nom   D Quantité
//
// Un objet n'apparaît qu'une fois par coffre : on incrémente ou
// décrémente sa quantité, et la ligne disparaît à zéro. Le formulaire
// range une liste entière en une requête (`rangerInventaire`), les
// boutons + / − une variation à la fois (`ajusterInventaire`) ; les
// deux passent par `appliquerAjustementsInventaire_`. Les
// objets viennent du même catalogue `Objets` que les saisies de
// la Prison ; le nom est un instantané pris à l'entrée en stock,
// comme dans `Prison!J`. Un `ID objet` vide désigne un objet hors
// catalogue, saisi librement.
//
// Le coffre est désigné par un identifiant technique et non par
// son nom, afin qu'un coffre renommé garde son contenu.
//
// OFFICIER : lecture et écriture.
// INTENDANT : lecture seule.
// GARDE : aucun accès, ni lecture ni écriture.
//
// Helpers partagés provenant d'Amendes.js : nettoyerSaisieUtilisateur().
// Helpers partagés provenant d'Objets.js : lireCatalogueObjets_().
// ============================================================

const INVENTAIRE_COFFRES_SHEET_NAME = "Coffres";
const INVENTAIRE_SHEET_NAME = "Inventaire";
const INVENTAIRE_COFFRES_HEADERS = ["ID coffre", "Nom", "Position", "Description"];
const INVENTAIRE_HEADERS = ["ID coffre", "ID objet", "Nom", "Quantité"];

const INVENTAIRE_LIMITES = {
  nomCoffre: 100,
  position: 200,
  description: 1000,
  idObjet: 200,
  nomObjet: 300
};


// ============================================================
// WEB APP - LECTURE
// ============================================================

function getInventaire(token) {
  requireRole(token, ["OFFICIER", "INTENDANT"]);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const feuilles = feuillesInventaire_(ss);

  return construireInventaire_(
    lireCoffres_(feuilles.coffres),
    lireLignesInventaire_(feuilles.inventaire).lignes
  );
}


// ============================================================
// WEB APP - COFFRES
// ============================================================

function ajouterCoffre(token, data) {
  requireRole(token, ["OFFICIER"]);

  const coffre = normaliserCoffre_(data);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  // La création éventuelle des feuilles prend son propre verrou :
  // elle a lieu avant le verrou d'écriture.
  const feuilles = feuillesInventaire_(ss);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const coffres = lireCoffres_(feuilles.coffres);
    verifierNomCoffreLibre_(coffres, coffre.nom, null);

    const id = Utilities.getUuid();
    const targetRow = Math.max(2, feuilles.coffres.getLastRow() + 1);
    ecrireLigneCoffre_(feuilles.coffres, targetRow, [id, coffre.nom, coffre.position, coffre.description]);

    coffres.push({ id, nom: coffre.nom, position: coffre.position, description: coffre.description, row: targetRow });
    return construireInventaire_(coffres, lireLignesInventaire_(feuilles.inventaire).lignes);
  } finally {
    lock.releaseLock();
  }
}


function modifierCoffre(token, data) {
  requireRole(token, ["OFFICIER"]);

  const coffre = normaliserCoffre_(data);
  const id = nettoyerSaisieUtilisateur(data.id);
  if (!id) throw new Error("Coffre à modifier non précisé.");

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const feuilles = feuillesInventaire_(ss);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const coffres = lireCoffres_(feuilles.coffres);
    const existant = coffres.find(c => c.id === id);
    if (!existant) throw new Error("Ce coffre n'existe plus. Actualisez la page.");
    verifierNomCoffreLibre_(coffres, coffre.nom, id);

    ecrireLigneCoffre_(feuilles.coffres, existant.row, [id, coffre.nom, coffre.position, coffre.description]);

    Object.assign(existant, { nom: coffre.nom, position: coffre.position, description: coffre.description });
    return construireInventaire_(coffres, lireLignesInventaire_(feuilles.inventaire).lignes);
  } finally {
    lock.releaseLock();
  }
}


// ============================================================
// WEB APP - OBJETS
// ============================================================

/*
  Ajoute `delta` exemplaires d'un objet dans un coffre. Un delta
  négatif retire ; la ligne disparaît quand la quantité atteint
  zéro, et on ne descend jamais en dessous.

  data = { coffreId, delta, objet: { id, nom, libre } }
*/
function ajusterInventaire(token, data) {
  requireRole(token, ["OFFICIER"]);

  if (!data || typeof data !== "object") throw new Error("Données d'inventaire manquantes.");
  if (!Number.isSafeInteger(data.delta) || data.delta === 0) {
    throw new Error("La variation de quantité doit être un entier non nul.");
  }
  return appliquerAjustementsInventaire_(data.coffreId, [{ objet: data.objet, delta: data.delta }]);
}


/*
  Range plusieurs objets d'un coup dans un coffre. Le formulaire
  constitue sa liste hors ligne, puis l'envoie en une seule requête
  et une seule écriture : ranger dix objets ne coûte plus dix
  allers-retours attendus l'un après l'autre.

  data = { coffreId, objets: [{ id, nom, libre, quantite }] }
*/
function rangerInventaire(token, data) {
  requireRole(token, ["OFFICIER"]);

  if (!data || typeof data !== "object") throw new Error("Données d'inventaire manquantes.");
  if (!Array.isArray(data.objets) || !data.objets.length) {
    throw new Error("Ajoutez au moins un objet à la liste avant de ranger.");
  }
  if (data.objets.length > 100) throw new Error("Un rangement peut contenir au maximum 100 objets différents.");

  const demandes = data.objets.map(item => {
    if (!item || typeof item !== "object" || !Number.isSafeInteger(item.quantite) || item.quantite <= 0) {
      throw new Error("Chaque objet à ranger doit porter une quantité entière strictement positive.");
    }
    return { objet: item, delta: item.quantite };
  });
  return appliquerAjustementsInventaire_(data.coffreId, demandes);
}


/*
  Chemin d'écriture unique des quantités : ajustement unitaire des
  boutons + / − et rangement groupé du formulaire y passent tous
  deux. Les rôles sont déjà vérifiés par les fonctions publiques.
*/
function appliquerAjustementsInventaire_(coffreIdBrut, demandes) {
  const coffreId = nettoyerSaisieUtilisateur(coffreIdBrut);
  if (!coffreId) throw new Error("Sélectionnez un coffre.");

  /*
    Validation et fusion des doublons de la requête, par clé d'objet,
    avant toute lecture : deux lignes « Torche » d'une même liste ne
    font qu'une variation.
  */
  const parCle = new Map();
  demandes.forEach(({ objet, delta }) => {
    const demande = normaliserObjetInventaire_(objet);
    const cle = cleObjetInventaire_(demande);
    const precedent = parCle.get(cle);
    const total = (precedent ? precedent.delta : 0) + delta;
    if (!Number.isSafeInteger(total)) throw new Error("Quantité totale trop élevée.");
    parCle.set(cle, { demande: precedent ? precedent.demande : demande, delta: total });
  });

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const feuilles = feuillesInventaire_(ss);

  /*
    Résolution avant le verrou : la première recherche peut créer
    `Objets` sous son propre verrou, et une lecture de 10 000 fiches
    n'a pas à retenir les autres écritures. Un objet déjà en stock,
    dans ce coffre ou un autre, réutilise son instantané sans relire
    le catalogue : les boutons + / − d'une ligne existante ne coûtent
    qu'une lecture d'Inventaire, et un rangement groupé ne lit le
    catalogue qu'une fois, quel que soit le nombre d'objets nouveaux.
  */
  const lignesAvant = lireLignesInventaire_(feuilles.inventaire).lignes;
  let catalogue = null;
  const resolus = [];
  parCle.forEach(({ demande, delta }) => {
    if (delta === 0) return;
    if (demande.libre) { resolus.push({ objet: demande, delta }); return; }
    const cle = cleObjetInventaire_(demande);
    const existante = lignesAvant.find(l => cleObjetInventaire_(l) === cle);
    if (existante) { resolus.push({ objet: { id: existante.id, nom: existante.nom, libre: false }, delta }); return; }
    if (delta < 0) { resolus.push({ objet: { id: demande.id, nom: demande.nom, libre: false }, delta }); return; }
    if (!catalogue) catalogue = new Map(lireCatalogueObjets_().map(o => [o.id.toLowerCase(), o]));
    const fiche = catalogue.get(demande.id.toLowerCase());
    if (!fiche) throw new Error("Cet objet n'existe pas dans le catalogue. Relancez la recherche.");
    // Le nom envoyé par le navigateur n'est jamais une source de confiance.
    resolus.push({ objet: { id: fiche.id, nom: fiche.nom, libre: false }, delta });
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const coffres = lireCoffres_(feuilles.coffres);
    if (!coffres.some(c => c.id === coffreId)) throw new Error("Ce coffre n'existe plus. Actualisez la page.");

    const etat = lireLignesInventaire_(feuilles.inventaire);
    resolus.forEach(({ objet, delta }) => {
      const cle = cleObjetInventaire_(objet);
      const index = etat.lignes.findIndex(l => l.coffreId === coffreId && cleObjetInventaire_(l) === cle);

      if (index === -1) {
        if (delta < 0) throw new Error("Cet objet n'est pas dans ce coffre.");
        etat.lignes.push({ coffreId, id: objet.id, nom: objet.nom, libre: objet.libre, quantite: delta });
        return;
      }
      const ligne = etat.lignes[index];
      const total = ligne.quantite + delta;
      if (!Number.isSafeInteger(total)) throw new Error("Quantité totale trop élevée.");
      if (total < 0) {
        throw new Error(`Ce coffre ne contient que ${ligne.quantite.toLocaleString("fr-FR")} exemplaire${ligne.quantite > 1 ? "s" : ""} de ${ligne.nom}.`);
      }
      if (total === 0) etat.lignes.splice(index, 1);
      else etat.lignes[index] = Object.assign({}, ligne, { quantite: total });
    });

    ecrireLignesInventaire_(feuilles.inventaire, etat);
    return construireInventaire_(coffres, etat.lignes);
  } finally {
    lock.releaseLock();
  }
}


/*
  Déplace toute la pile d'un objet vers un autre coffre. Si le
  coffre de destination contient déjà cet objet, les quantités
  s'additionnent : un objet reste unique par coffre.

  data = { coffreId, versCoffreId, objet: { id, nom, libre } }
*/
function deplacerInventaire(token, data) {
  requireRole(token, ["OFFICIER"]);

  if (!data || typeof data !== "object") throw new Error("Données d'inventaire manquantes.");
  const coffreId = nettoyerSaisieUtilisateur(data.coffreId);
  const versCoffreId = nettoyerSaisieUtilisateur(data.versCoffreId);
  if (!coffreId || !versCoffreId) throw new Error("Précisez le coffre d'origine et le coffre de destination.");
  if (coffreId === versCoffreId) throw new Error("L'objet est déjà dans ce coffre.");
  const demande = normaliserObjetInventaire_(data.objet);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const feuilles = feuillesInventaire_(ss);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    /*
      Seule la destination doit être un coffre connu : la ligne d'origine
      peut appartenir à un coffre effacé à la main dans la feuille, et ce
      déplacement est justement le moyen de la rattacher à un coffre réel.
    */
    const coffres = lireCoffres_(feuilles.coffres);
    if (!coffres.some(c => c.id === versCoffreId)) throw new Error("Le coffre de destination n'existe plus. Actualisez la page.");

    const etat = lireLignesInventaire_(feuilles.inventaire);
    const cle = cleObjetInventaire_(demande);
    const source = etat.lignes.findIndex(l => l.coffreId === coffreId && cleObjetInventaire_(l) === cle);
    if (source === -1) throw new Error("Cet objet n'est plus dans le coffre d'origine. Actualisez la page.");

    const ligne = etat.lignes[source];
    const cible = etat.lignes.findIndex(l => l.coffreId === versCoffreId && cleObjetInventaire_(l) === cle);
    if (cible === -1) {
      etat.lignes[source] = Object.assign({}, ligne, { coffreId: versCoffreId });
    } else {
      const total = etat.lignes[cible].quantite + ligne.quantite;
      if (!Number.isSafeInteger(total)) throw new Error("Quantité totale trop élevée.");
      etat.lignes[cible] = Object.assign({}, etat.lignes[cible], { quantite: total });
      etat.lignes.splice(source, 1);
    }

    ecrireLignesInventaire_(feuilles.inventaire, etat);
    return construireInventaire_(coffres, etat.lignes);
  } finally {
    lock.releaseLock();
  }
}


// ============================================================
// FEUILLES
// ============================================================

function feuillesInventaire_(ss) {
  return {
    coffres: feuilleInventaire_(ss, INVENTAIRE_COFFRES_SHEET_NAME, INVENTAIRE_COFFRES_HEADERS),
    inventaire: feuilleInventaire_(ss, INVENTAIRE_SHEET_NAME, INVENTAIRE_HEADERS)
  };
}

/*
  Renvoie la feuille, en la créant avec ses en-têtes si elle
  manque. Une feuille existante n'est jamais modifiée : des
  en-têtes différents arrêtent tout, plutôt que d'écrire dans
  des colonnes qu'on ne comprend pas.
*/
function feuilleInventaire_(ss, nom, entetes) {
  let sheet = ss.getSheetByName(nom);
  if (!sheet) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      sheet = ss.getSheetByName(nom);
      if (!sheet) {
        sheet = ss.insertSheet(nom);
        sheet.getRange(1, 1, 1, entetes.length).setNumberFormat("@").setValues([entetes]).setFontWeight("bold");
        sheet.setFrozenRows(1);
        SpreadsheetApp.flush();
      }
    } finally {
      lock.releaseLock();
    }
  }
  const header = sheet.getRange(1, 1, 1, entetes.length).getDisplayValues()[0].map(nettoyerSaisieUtilisateur);
  if (header.join("|") !== entetes.join("|")) {
    throw new Error(`La feuille ${nom} doit contenir les colonnes ${entetes.join(", ")} en A:${String.fromCharCode(64 + entetes.length)}. Aucun contenu remplacé.`);
  }
  return sheet;
}


// ============================================================
// COFFRES - LECTURE / ÉCRITURE
// ============================================================

function lireCoffres_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 4).getDisplayValues();
  const coffres = [];
  const ids = new Set();

  values.forEach((row, i) => {
    const [id, nom, position, description] = row.map(nettoyerSaisieUtilisateur);
    if (!id && !nom && !position && !description) return;
    if (!id || !nom) {
      throw new Error(`Ligne ${i + 2} de la feuille Coffres invalide : identifiant et nom sont requis.`);
    }
    if (ids.has(id.toLowerCase())) {
      throw new Error(`Identifiant de coffre en double dans la feuille Coffres, ligne ${i + 2}.`);
    }
    ids.add(id.toLowerCase());
    coffres.push({ id, nom, position, description, row: i + 2 });
  });

  return coffres;
}


function normaliserCoffre_(data) {
  if (!data || typeof data !== "object") throw new Error("Données du coffre manquantes.");
  const nom = nettoyerSaisieUtilisateur(data.nom).replace(/\s+/g, " ");
  const position = nettoyerSaisieUtilisateur(data.position).replace(/\s+/g, " ");
  const description = nettoyerSaisieUtilisateur(data.description);

  if (!nom) throw new Error("Le nom du coffre est obligatoire.");
  if (nom.length > INVENTAIRE_LIMITES.nomCoffre) throw new Error(`Le nom du coffre ne peut dépasser ${INVENTAIRE_LIMITES.nomCoffre} caractères.`);
  if (position.length > INVENTAIRE_LIMITES.position) throw new Error(`La position ne peut dépasser ${INVENTAIRE_LIMITES.position} caractères.`);
  if (description.length > INVENTAIRE_LIMITES.description) throw new Error(`La description ne peut dépasser ${INVENTAIRE_LIMITES.description} caractères.`);
  [nom, position, description].forEach(valeur => {
    if (valeur.startsWith("=")) throw new Error("Un champ du coffre ne peut pas commencer par le signe égal.");
  });

  return { nom, position, description };
}


function verifierNomCoffreLibre_(coffres, nom, idExclu) {
  const recherche = normaliserTexteInventaire_(nom);
  if (coffres.some(c => c.id !== idExclu && normaliserTexteInventaire_(c.nom) === recherche)) {
    throw new Error(`Un coffre nommé « ${nom} » existe déjà.`);
  }
}


function ecrireLigneCoffre_(sheet, row, valeurs) {
  if (sheet.getMaxRows() < row) sheet.insertRowsAfter(sheet.getMaxRows(), row - sheet.getMaxRows());
  const range = sheet.getRange(row, 1, 1, 4);
  const precedentes = range.getValues();
  try {
    range.setNumberFormat("@").setValues([valeurs]);
    SpreadsheetApp.flush();
  } catch (error) {
    try { range.setValues(precedentes); SpreadsheetApp.flush(); }
    catch (rollbackError) { console.error("Impossible de restaurer la ligne de coffre après un échec d'écriture.", rollbackError); }
    throw error;
  }
}


// ============================================================
// INVENTAIRE - LECTURE / ÉCRITURE
// ============================================================

/*
  Lit tout le bloc A:D. `hauteur` compte les lignes occupées,
  lignes vides intermédiaires comprises, pour que la réécriture
  efface bien tout ce qui existait.
*/
function lireLignesInventaire_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { lignes: [], hauteur: 0 };

  const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  const lignes = [];

  values.forEach((row, i) => {
    const coffreId = nettoyerSaisieUtilisateur(row[0]);
    const id = nettoyerSaisieUtilisateur(row[1]);
    const nom = nettoyerSaisieUtilisateur(row[2]).replace(/\s+/g, " ");
    const brut = row[3];
    if (!coffreId && !id && !nom && (brut === "" || brut === null)) return;

    const quantite = Number(brut);
    if (!coffreId || !nom || !Number.isSafeInteger(quantite) || quantite <= 0) {
      throw new Error(`Ligne ${i + 2} de la feuille Inventaire invalide : coffre, nom et quantité entière strictement positive sont requis.`);
    }
    lignes.push({ coffreId, id, nom, libre: !id, quantite });
  });

  return { lignes, hauteur: lastRow - 1 };
}


/*
  Réécrit le bloc entier : l'inventaire tient en quelques dizaines
  de lignes, et une écriture en bloc évite toute ligne fantôme ou
  doublon quand deux officiers travaillent en même temps — le
  verrou de script sérialise les appels, le bloc les rend simples.
*/
function ecrireLignesInventaire_(sheet, etat) {
  const rows = etat.lignes.map(l => [l.coffreId, l.id, l.nom, l.quantite]);
  const hauteur = Math.max(rows.length, etat.hauteur);
  if (!hauteur) return;
  while (rows.length < hauteur) rows.push(["", "", "", ""]);

  if (sheet.getMaxRows() < hauteur + 1) sheet.insertRowsAfter(sheet.getMaxRows(), hauteur + 1 - sheet.getMaxRows());
  const range = sheet.getRange(2, 1, hauteur, 4);
  const precedentes = range.getValues();
  try {
    sheet.getRange(2, 1, hauteur, 3).setNumberFormat("@");
    sheet.getRange(2, 4, hauteur, 1).setNumberFormat("0");
    range.setValues(rows);
    SpreadsheetApp.flush();
  } catch (error) {
    try { range.setValues(precedentes); SpreadsheetApp.flush(); }
    catch (rollbackError) { console.error("Impossible de restaurer l'inventaire après un échec d'écriture.", rollbackError); }
    throw error;
  }
}


// ============================================================
// OBJETS - VALIDATION
// ============================================================

function normaliserObjetInventaire_(value) {
  if (!value || typeof value !== "object") throw new Error("Sélectionnez un objet.");
  const libre = value.libre === true;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const nom = typeof value.nom === "string" ? value.nom.trim().replace(/\s+/g, " ") : "";

  if (libre) {
    if (id || !nom || nom.length > INVENTAIRE_LIMITES.nomObjet) {
      throw new Error(`Objet hors catalogue : nom requis (${INVENTAIRE_LIMITES.nomObjet} caractères maximum), sans identifiant.`);
    }
    if (nom.startsWith("=")) throw new Error("Le nom d'un objet ne peut pas commencer par le signe égal.");
    return { id: "", nom, libre: true };
  }
  if (!id || id.length > INVENTAIRE_LIMITES.idObjet) throw new Error("Identifiant d'objet invalide.");
  return { id, nom, libre: false };
}


function cleObjetInventaire_(objet) {
  return objet.libre
    ? `libre:${normaliserTexteInventaire_(objet.nom)}`
    : `catalogue:${String(objet.id).toLowerCase()}`;
}


function normaliserTexteInventaire_(value) {
  return nettoyerSaisieUtilisateur(value).replace(/\s+/g, " ").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}


// ============================================================
// RÉPONSE WEB
// ============================================================

/*
  Une ligne dont le coffre a disparu de la feuille reste envoyée :
  l'interface l'affiche sous « Coffre inconnu ». Un stock ne doit
  pas disparaître de l'inventaire parce qu'une ligne de Coffres a
  été effacée à la main.
*/
function construireInventaire_(coffres, lignes) {
  const parCoffre = new Map();
  lignes.forEach(l => {
    const stats = parCoffre.get(l.coffreId) || { nbObjets: 0, total: 0 };
    stats.nbObjets += 1;
    stats.total += l.quantite;
    parCoffre.set(l.coffreId, stats);
  });

  const nomsCoffres = new Map(coffres.map(c => [c.id, c.nom]));
  const compare = (a, b) => a.localeCompare(b, "fr", { sensitivity: "base" });

  return {
    coffres: coffres
      .map(c => Object.assign({ id: c.id, nom: c.nom, position: c.position, description: c.description }, parCoffre.get(c.id) || { nbObjets: 0, total: 0 }))
      .sort((a, b) => compare(a.nom, b.nom)),
    objets: lignes
      .map(l => ({
        cle: cleObjetInventaire_(l),
        coffreId: l.coffreId,
        coffreNom: nomsCoffres.get(l.coffreId) || "",
        id: l.id,
        nom: l.nom,
        libre: l.libre,
        quantite: l.quantite
      }))
      .sort((a, b) => compare(a.coffreNom || "￿", b.coffreNom || "￿") || compare(a.nom, b.nom) || compare(a.id, b.id))
  };
}
