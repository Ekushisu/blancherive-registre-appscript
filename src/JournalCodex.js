// ============================================================
// JOURNAL DU CODEX
// ============================================================
//
// Ce que chaque synchronisation a changé dans le Codex (décision du
// propriétaire, 1er novembre 2026) : lois nouvelles, modifiées ou retirées,
// documents ajoutés, retirés ou illisibles. Le but est d'en prévenir tous
// ceux qui consultent le Codex, visiteurs compris.
//
// Feuille `JournalCodex`, écrite par `synchroniserCodex()` seule, à la suite :
//
// A  Synchronisation  date ISO en texte, commune aux lignes d'un même passage
// B  Type             synchronisation | ajout | modification | retrait
//                     | document-ajout | document-retrait | document-illisible
// C  Source
// D  Article
// E  Titre            titre actuel, ou dernier titre connu d'un article retiré
// F  Champs           champs modifiés : titre, classification, sanction, texte
// G  Avant            JSON des champs d'avant
// H  Après            JSON des champs d'après ; pour la ligne
//                     « synchronisation », { articles, documents, erreurs }
//
// Chaque passage s'ouvre par sa ligne « synchronisation », même sans aucun
// changement : la date du dernier passage reste ainsi connue. La feuille
// n'est qu'un historique : ne pas l'éditer à la main.
//
// Lecture par `getCodex` (Codex.js), qui renvoie le journal avec les
// articles : seule fonction ouverte au visiteur, elle évite d'ouvrir une
// autre fonction au rôle public.
// ============================================================

const JOURNAL_CODEX_SHEET_NAME = "JournalCodex";
const JOURNAL_CODEX_ENTETES = ["Synchronisation", "Type", "Source", "Article", "Titre", "Champs", "Avant", "Après"];
const JOURNAL_CODEX_CHAMPS = ["titre", "classification", "sanction", "texte"];

// Renvoyés au navigateur : les derniers passages, et un plafond de changements
// pour qu'une refonte d'un document n'alourdisse pas le Codex de tout son texte.
const JOURNAL_CODEX_SYNCHROS = 12;
const JOURNAL_CODEX_CHANGEMENTS_PAR_SYNCHRO = 150;
const JOURNAL_CODEX_LIGNES_LUES = 2000;

// Une cellule Sheets ne dépasse pas 50 000 caractères.
const JOURNAL_CODEX_CELLULE_MAX = 45000;


/*
  Synchronisation lancée depuis le registre par un officier (même décision),
  sans attendre un passage dans l'éditeur Apps Script. Mêmes effets que
  `synchroniserCodex()`, journal compris.

  Délai de trois minutes entre deux lancements par ce bouton (décision du
  propriétaire), vérifié ici et non dans l'interface : l'heure du dernier
  lancement est notée dans la propriété technique `CODEX_SYNCHRO_BOUTON`,
  sous un verrou court pour que deux officiers ne passent pas ensemble.
  L'éditeur n'y est jamais soumis et ne la touche pas.
*/
const JOURNAL_CODEX_DELAI_BOUTON = 3 * 60 * 1000;
const JOURNAL_CODEX_PROPRIETE_BOUTON = "CODEX_SYNCHRO_BOUTON";

function synchroniserCodexRegistre(token, suivi) {
  requireRole(token, ["OFFICIER"]);

  const props = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    throw new Error("Une synchronisation du Codex est déjà en cours.");
  }

  try {
    const dernier = Number(props.getProperty(JOURNAL_CODEX_PROPRIETE_BOUTON)) || 0;
    const reste = dernier + JOURNAL_CODEX_DELAI_BOUTON - Date.now();
    if (reste > 0) {
      const secondes = Math.ceil(reste / 1000);
      throw new Error(
        "Synchronisation déjà lancée il y a moins de trois minutes : réessayer dans " +
        (secondes >= 60 ? Math.floor(secondes / 60) + " min " + (secondes % 60) + " s" : secondes + " s") + "."
      );
    }
    props.setProperty(JOURNAL_CODEX_PROPRIETE_BOUTON, String(Date.now()));
  } finally {
    lock.releaseLock();
  }

  return synchroniserCodexDepuis_("registre", suiviSynchroCodex_(suivi));
}


/*
  Traces d'une synchronisation, au fil de l'eau. Apps Script ne répond au
  navigateur qu'une fois la fonction terminée : un passage lancé du registre
  publie donc chaque message dans le cache du script, sous l'identifiant de
  suivi tiré par le navigateur, qui les relit pendant l'attente
  (`getProgressionSynchroCodex`). Chaque message va aussi au journal
  d'exécution de l'éditeur, et l'ensemble revient avec le résultat.
*/
const JOURNAL_CODEX_CLE_PROGRESSION = "CODEX_SYNCHRO_PROGRESSION";

function suiviSynchroCodex_(suivi) {
  const valeur = String(suivi || "");
  return /^[a-z0-9-]{1,40}$/i.test(valeur) ? valeur : "";
}

function tracesSynchroCodex_(origine, debut, suivi) {
  const lignes = [];
  const sorties = { info: "log", alerte: "warn", erreur: "error" };
  let fini = false;

  const publier = () => {
    if (!suivi) return;
    try {
      CacheService.getScriptCache().put(
        JOURNAL_CODEX_CLE_PROGRESSION,
        JSON.stringify({ suivi: suivi, fini: fini, lignes: lignes }),
        600
      );
    } catch (e) {
      // Sans cache, les traces arrivent avec le résultat.
    }
  };
  const ecrire = niveau => texte => {
    lignes.push({ niveau: niveau, texte: String(texte), ms: Date.now() - debut });
    console[sorties[niveau]](String(texte));
    publier();
  };

  return {
    info: ecrire("info"),
    alerte: ecrire("alerte"),
    erreur: ecrire("erreur"),
    fin: () => { fini = true; publier(); },
    lignes: () => lignes.slice()
  };
}


// Traces du passage en cours, pour les officiers qui l'attendent.
function getProgressionSynchroCodex(token, suivi) {
  requireRole(token, ["OFFICIER"]);
  const attendu = suiviSynchroCodex_(suivi);
  const progression = lireJsonJournalCodex_(CacheService.getScriptCache().get(JOURNAL_CODEX_CLE_PROGRESSION));
  if (!attendu || !progression || progression.suivi !== attendu) {
    return { fini: false, lignes: [] };
  }
  return { fini: Boolean(progression.fini), lignes: Array.isArray(progression.lignes) ? progression.lignes : [] };
}


// ============================================================
// COMPARAISON
// ============================================================

// Blancs repliés : un saut de ligne déplacé n'est pas une modification.
function normaliserJournalCodex_(valeur) {
  return String(valeur || "").replace(/\s+/g, " ").trim();
}


function extraireChampsJournalCodex_(article, champs) {
  const resultat = {};
  champs.forEach(champ => { resultat[champ] = String(article[champ] || ""); });
  return resultat;
}


/*
  Articles rapprochés par source et numéro (`cleArticleCodex_`), comme les
  chefs d'accusation : un titre corrigé est une modification, pas un retrait
  suivi d'un ajout.
*/
function comparerArticlesCodex_(avant, apres) {
  const indexer = liste => {
    const index = new Map();
    liste.forEach(article => {
      const cle = cleArticleCodex_(article.source, article.article);
      if (!index.has(cle)) index.set(cle, article);
    });
    return index;
  };
  const indexAvant = indexer(avant);
  const indexApres = indexer(apres);
  const changements = [];

  indexApres.forEach((article, cle) => {
    const ancien = indexAvant.get(cle);

    if (!ancien) {
      changements.push({
        type: "ajout",
        source: article.source,
        article: article.article,
        titre: article.titre,
        champs: [],
        avant: null,
        apres: extraireChampsJournalCodex_(article, ["titre", "classification", "sanction"])
      });
      return;
    }

    const champs = JOURNAL_CODEX_CHAMPS.filter(champ =>
      normaliserJournalCodex_(ancien[champ]) !== normaliserJournalCodex_(article[champ]));

    if (champs.length) {
      changements.push({
        type: "modification",
        source: article.source,
        article: article.article,
        titre: article.titre,
        champs: champs,
        avant: extraireChampsJournalCodex_(ancien, champs),
        apres: extraireChampsJournalCodex_(article, champs)
      });
    }
  });

  // Un article retiré garde son texte au journal : on peut encore le lire.
  indexAvant.forEach((article, cle) => {
    if (indexApres.has(cle)) return;
    changements.push({
      type: "retrait",
      source: article.source,
      article: article.article,
      titre: article.titre,
      champs: [],
      avant: extraireChampsJournalCodex_(article, JOURNAL_CODEX_CHAMPS),
      apres: null
    });
  });

  return changements;
}


// Avant la première écriture du cache des documents, rien n'est comparé.
function comparerDocumentsCodex_(sourcesAvant, sourcesApres) {
  if (!sourcesAvant.length) return [];
  const document = (type, source) => ({ type, source, article: "", titre: "", champs: [], avant: null, apres: null });
  return [
    ...sourcesApres.filter(source => sourcesAvant.indexOf(source) < 0).map(source => document("document-ajout", source)),
    ...sourcesAvant.filter(source => sourcesApres.indexOf(source) < 0).map(source => document("document-retrait", source))
  ];
}


// ============================================================
// ÉCRITURE
// ============================================================

/*
  Appelé par `synchroniserCodex()`, sous son verrou, une fois le cache réécrit.
  Renvoie la date du passage, ses changements et leur nombre par type.
*/
function journaliserSynchroCodex_(ss, etat) {
  const date = new Date().toISOString();
  const illisibles = etat.sourcesIllisibles.map(source => ({
    type: "document-illisible",
    source: source,
    article: "",
    titre: "",
    champs: [],
    avant: null,
    apres: { message: messageErreurDocumentCodex_(etat.erreurs, source) }
  }));
  const changements = [
    ...comparerDocumentsCodex_(etat.sourcesAvant, etat.sourcesApres),
    ...illisibles,
    ...comparerArticlesCodex_(etat.avant, etat.apres)
  ];

  const lignes = [
    // Compte rendu technique du passage, pour le propriétaire.
    [date, "synchronisation", "", "", "", "", "", celluleJsonJournalCodex_({
      articles: etat.apres.length,
      documents: etat.sourcesApres.length,
      erreurs: etat.erreurs,
      duree: etat.duree || 0,
      parDocument: etat.parDocument || [],
      origine: etat.origine || ""
    })],
    ...changements.map(changement => [
      date,
      changement.type,
      changement.source,
      changement.article,
      changement.titre,
      changement.champs.join(","),
      celluleJsonJournalCodex_(changement.avant),
      celluleJsonJournalCodex_(changement.apres)
    ])
  ];

  const sheet = feuilleJournalCodex_(ss);
  // En texte brut : ni la date ni un titre ne doivent être interprétés par Sheets.
  sheet
    .getRange(sheet.getLastRow() + 1, 1, lignes.length, JOURNAL_CODEX_ENTETES.length)
    .setNumberFormat("@")
    .setValues(lignes);

  return { date: date, changements: changements, compte: compterChangementsCodex_(changements) };
}


// Compte rendu d'un passage pour le journal d'exécution de l'éditeur.
function decrireSynchroCodex_(journal, duree) {
  const c = journal.compte;
  const lignes = [
    "Synchronisation du Codex terminée en " + Math.round(duree / 100) / 10 + " s (" + journal.date + ").",
    "Changements : " + c.ajouts + " nouveau(x), " + c.modifications + " modifié(s), " + c.retraits + " retiré(s) ; documents : " +
      c.documentsAjoutes + " ajouté(s), " + c.documentsRetires + " retiré(s), " + c.documentsIllisibles + " illisible(s)."
  ];
  const symboles = {
    "ajout": "+",
    "modification": "~",
    "retrait": "−",
    "document-ajout": "+ document",
    "document-retrait": "− document",
    "document-illisible": "! document illisible"
  };
  const MAX = 80;

  journal.changements.slice(0, MAX).forEach(changement => {
    const article = changement.article ? " art. " + changement.article : "";
    const titre = changement.titre ? " — " + changement.titre : "";
    const champs = changement.champs.length ? " [" + changement.champs.join(", ") + "]" : "";
    const message = changement.apres && changement.apres.message ? " : " + changement.apres.message : "";
    lignes.push("  " + symboles[changement.type] + " " + changement.source + article + titre + champs + message);
  });
  if (journal.changements.length > MAX) {
    lignes.push("  … et " + (journal.changements.length - MAX) + " autre(s) : voir la feuille JournalCodex.");
  }
  if (!journal.changements.length) lignes.push("  Aucun changement : le Codex était à jour.");
  lignes.push("Détail : feuille JournalCodex, et « Nouveautés » sur la page Codex du registre.");
  return lignes.join("\n");
}


function feuilleJournalCodex_(ss) {
  const existante = ss.getSheetByName(JOURNAL_CODEX_SHEET_NAME);
  if (existante) return existante;

  const sheet = ss.insertSheet(JOURNAL_CODEX_SHEET_NAME);
  sheet
    .getRange(1, 1, 1, JOURNAL_CODEX_ENTETES.length)
    .setValues([JOURNAL_CODEX_ENTETES])
    .setFontWeight("bold");
  sheet.setFrozenRows(1);
  return sheet;
}


// « Source : message », tel que `synchroniserCodex()` le note.
function messageErreurDocumentCodex_(erreurs, source) {
  const prefixe = source + " : ";
  const erreur = erreurs.find(e => String(e).indexOf(prefixe) === 0);
  return erreur ? String(erreur).slice(prefixe.length) : "";
}


// Un texte trop long pour une cellule est tronqué, et signalé comme tel.
function celluleJsonJournalCodex_(objet) {
  if (!objet) return "";
  const json = JSON.stringify(objet);
  if (json.length <= JOURNAL_CODEX_CELLULE_MAX || typeof objet.texte !== "string") return json;
  const garde = Math.max(0, objet.texte.length - (json.length - JOURNAL_CODEX_CELLULE_MAX) - 100);
  return JSON.stringify(Object.assign({}, objet, { texte: objet.texte.slice(0, garde) + "…", tronque: true }));
}


function compterChangementsCodex_(changements) {
  const compte = { ajouts: 0, modifications: 0, retraits: 0, documentsAjoutes: 0, documentsRetires: 0, documentsIllisibles: 0 };
  const cles = {
    "ajout": "ajouts",
    "modification": "modifications",
    "retrait": "retraits",
    "document-ajout": "documentsAjoutes",
    "document-retrait": "documentsRetires",
    "document-illisible": "documentsIllisibles"
  };
  changements.forEach(changement => { compte[cles[changement.type]]++; });
  return compte;
}


// ============================================================
// LECTURE
// ============================================================

// Change à chaque passage : entre dans la version du Codex (Codex.js).
function nombreLignesJournalCodex_(ss) {
  const sheet = ss.getSheetByName(JOURNAL_CODEX_SHEET_NAME);
  return sheet ? sheet.getLastRow() : 0;
}


function lireJsonJournalCodex_(valeur) {
  if (!valeur) return null;
  try { return JSON.parse(String(valeur)); } catch (e) { return null; }
}


/*
  Les derniers passages, du plus récent au plus ancien : date, nombre
  d'articles et de documents, erreurs, changements. Au-delà du plafond, les
  changements d'un passage sont coupés mais restent comptés (`compte`,
  `tronque`).
*/
function lireJournalCodex_(ss) {
  const sheet = ss.getSheetByName(JOURNAL_CODEX_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const lastRow = sheet.getLastRow();
  const debut = Math.max(2, lastRow - JOURNAL_CODEX_LIGNES_LUES + 1);
  const lignes = sheet.getRange(debut, 1, lastRow - debut + 1, JOURNAL_CODEX_ENTETES.length).getDisplayValues();
  const synchros = [];
  let courante = null;

  lignes.forEach(ligne => {
    const date = String(ligne[0] || "").trim();
    if (!date) return;

    if (!courante || courante.date !== date) {
      courante = { date: date, articles: null, documents: null, erreurs: [], duree: null, parDocument: [], origine: "", changements: [] };
      synchros.push(courante);
    }

    const type = String(ligne[1] || "").trim();
    if (type === "synchronisation") {
      const resume = lireJsonJournalCodex_(ligne[7]) || {};
      courante.articles = typeof resume.articles === "number" ? resume.articles : null;
      courante.documents = typeof resume.documents === "number" ? resume.documents : null;
      courante.erreurs = Array.isArray(resume.erreurs) ? resume.erreurs.map(String) : [];
      courante.duree = typeof resume.duree === "number" ? resume.duree : null;
      courante.parDocument = Array.isArray(resume.parDocument) ? resume.parDocument : [];
      courante.origine = String(resume.origine || "");
      return;
    }

    courante.changements.push({
      type: type,
      source: String(ligne[2] || "").trim(),
      article: String(ligne[3] || "").trim(),
      titre: String(ligne[4] || "").trim(),
      champs: String(ligne[5] || "").split(",").map(champ => champ.trim()).filter(Boolean),
      avant: lireJsonJournalCodex_(ligne[6]),
      apres: lireJsonJournalCodex_(ligne[7])
    });
  });

  // Une lecture qui ne part pas du début peut couper le plus ancien passage.
  if (debut > 2 && synchros.length > 1) synchros.shift();

  return synchros.slice(-JOURNAL_CODEX_SYNCHROS).reverse().map(synchro => {
    const compte = compterChangementsCodex_(synchro.changements);
    const tronque = synchro.changements.length > JOURNAL_CODEX_CHANGEMENTS_PAR_SYNCHRO;
    return Object.assign({}, synchro, {
      compte: compte,
      tronque: tronque,
      changements: tronque ? synchro.changements.slice(0, JOURNAL_CODEX_CHANGEMENTS_PAR_SYNCHRO) : synchro.changements
    });
  });
}
