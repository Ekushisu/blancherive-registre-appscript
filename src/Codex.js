// ============================================================
// CODEX - API WEB
// ============================================================

const CODEX_SYNC_SHEET_NAME = "SyncCodex";


// ============================================================
// MÉTADONNÉES DOCUMENTAIRES
// ============================================================

/*
  Les documents sont déclarés une seule fois, dans `SYNC_CODEX_DOCUMENTS` de
  `SyncCodex.js`. Ces métadonnées en sont dérivées à l'appel, et non au
  chargement du fichier, afin de ne pas dépendre de l'ordre d'évaluation des
  fichiers Apps Script.

  Un article dont la source n'est plus au registre reste affiché : `getCodex()`
  lui applique une métadonnée de repli. C'est le cas des articles laissés dans
  le cache par un document retiré, tant que la synchronisation n'a pas tourné.

  `abrege` et `citable` viennent du registre ou, pour les décrets du dossier
  Drive, du cache R:Y. Un cache écrit avant l'ajout des colonnes X:Y laisse ces
  cellules vides : le sigle est alors dérivé du nom et le document reste
  citable, ce qui est le défaut du registre.
*/
function getCodexDocumentMetadata_(sheet) {
  const metadata = {};

  SYNC_CODEX_DOCUMENTS.forEach(function (document) {
    metadata[document.source] = {
      famille: document.famille,
      autorite: document.autorite || "",
      applicabilite: document.applicabilite || "",
      local: Boolean(document.local),
      abrege: abregerSourceCodex_(document.source, document.abrege),
      citable: document.citable !== false,
      url:
        "https://docs.google.com/document/d/" +
        document.id +
        "/edit"
    };
  });

  /*
    Les décrets déposés dans un dossier Drive ne figurent dans aucune
    déclaration. La synchronisation inscrit leurs métadonnées en R:Y ; on les
    relit ici plutôt que de lister le dossier à chaque consultation du Codex.

    Le cache complète le registre sans l'écraser : un document déclaré garde ses
    métadonnées même si une ligne du cache porte le même nom.
  */
  if (sheet) {
    const dernierLigne = sheet.getLastRow();

    const largeur = largeurDisponibleCodex_(sheet, SYNC_CODEX_DOCUMENTS_COLUMN, SYNC_CODEX_DOCUMENTS_WIDTH);

    if (dernierLigne >= 2 && largeur > 0) {
      const lignes =
        sheet
          .getRange(2, SYNC_CODEX_DOCUMENTS_COLUMN, dernierLigne - 1, largeur)
          .getDisplayValues();

      lignes.forEach(function (ligne) {
        const source = String(ligne[0] || "").trim();

        if (!source || metadata[source]) {
          return;
        }

        metadata[source] = {
          famille: String(ligne[1] || "").trim() || "Autres textes",
          autorite: String(ligne[2] || "").trim(),
          applicabilite: String(ligne[3] || "").trim(),
          local: String(ligne[4] || "").trim() !== "",
          url: String(ligne[5] || "").trim(),
          abrege: abregerSourceCodex_(source, ligne[6]),
          citable: String(ligne[7] || "").trim().toLowerCase() !== "non"
        };
      });
    }
  }

  return metadata;
}


/*
  Largeur lisible d'un bloc à partir d'une colonne : un classeur créé avant
  l'ajout des colonnes X:Y peut s'arrêter avant, et une lecture hors de la
  feuille est refusée par Apps Script.
*/
function largeurDisponibleCodex_(sheet, colonne, largeur) {
  if (typeof sheet.getMaxColumns !== "function") {
    return largeur;
  }

  return Math.max(0, Math.min(largeur, sheet.getMaxColumns() - colonne + 1));
}


function metadonneesCodexRepli_(source) {
  return {
    famille: "Autres textes",
    autorite: "",
    applicabilite: "",
    local: false,
    abrege: abregerSourceCodex_(source, ""),
    citable: true,
    url: ""
  };
}


// ============================================================
// LECTURE DU CODEX
// ============================================================

/*
  Version du Codex : empreinte du contenu du cache, articles A:J et documents
  R:Y. Le navigateur la conserve avec sa copie locale (`ui/src/codex.js`) et la
  renvoie à l'appel suivant ; si rien n'a changé, on ne renvoie pas les
  quelque 470 articles et leur texte intégral.
*/
function lireCacheCodex_(sheet) {
  const lastRow = sheet.getLastRow();
  const articles = lastRow < 2 ? { values: [], display: [] } : (function () {
    const range = sheet.getRange(2, 1, lastRow - 1, 10);
    return { values: range.getValues(), display: range.getDisplayValues() };
  })();

  const largeurDocuments = largeurDisponibleCodex_(sheet, SYNC_CODEX_DOCUMENTS_COLUMN, SYNC_CODEX_DOCUMENTS_WIDTH);
  const documents = lastRow < 2 || largeurDocuments < 1 ? [] :
    sheet
      .getRange(2, SYNC_CODEX_DOCUMENTS_COLUMN, lastRow - 1, largeurDocuments)
      .getDisplayValues();

  const contenu =
    articles.display.map(ligne => ligne.join("\t")).join("\n") +
    "\n\u0001\n" +
    documents.map(ligne => ligne.join("\t")).join("\n");

  const empreinte = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    contenu,
    Utilities.Charset.UTF_8
  );

  return {
    values: articles.values,
    display: articles.display,
    version: Utilities.base64EncodeWebSafe(empreinte)
  };
}


function getCodex(token, versionConnue) {
  /*
    Seule fonction ouverte au rôle public. Voir l'avertissement en tête
    d'`Auth.js` avant d'ajouter `ROLE_PUBLIC` à une autre liste de rôles.
  */
  requireRole(
    token,
    [ROLE_PUBLIC, "GARDE", "OFFICIER"]
  );

  const ss =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );

  const sheet =
    ss.getSheetByName(
      CODEX_SYNC_SHEET_NAME
    );

  if (!sheet) {
    throw new Error(
      "Feuille SyncCodex introuvable."
    );
  }

  const cache = lireCacheCodex_(sheet);

  if (
    typeof versionConnue === "string" &&
    versionConnue &&
    versionConnue === cache.version
  ) {
    return {
      version: cache.version,
      articles: null,
      sources: null
    };
  }

  // Construit après l'ouverture de la feuille : le cache R:Y y est relu.
  const documentMetadata =
    getCodexDocumentMetadata_(sheet);

  /*
    A Source
    B Article
    C Titre
    D Classification
    E Amende
    F Travaux forcés
    G Cachot
    H Sanction complète
    I Texte
    J Alerte parsing
  */
  const values = cache.values;
  const display = cache.display;

  const articles = [];

  for (let i = 0; i < values.length; i++) {
    const source =
      String(
        display[i][0] || ""
      ).trim();

    const article =
      String(
        display[i][1] || ""
      ).trim();

    const titre =
      String(
        display[i][2] || ""
      ).trim();

    if (!source && !article && !titre) {
      continue;
    }

    const metadata =
      documentMetadata[source] || metadonneesCodexRepli_(source);

    articles.push({
      montants: construireChoixSanctionCodex_(display[i][7] || display[i][8], "amende").options.map(option => option.value).filter((value, index, values) => values.indexOf(value) === index),
      dureesCachot: construireChoixSanctionCodex_(display[i][7] || display[i][8], "cachot").options.map(option => option.value).filter((value, index, values) => values.indexOf(value) === index),
      source: source,

      article: article,

      titre: titre,

      classification:
        String(
          display[i][3] || ""
        ).trim(),

      amende:
        nombreOuVideCodex(
          values[i][4]
        ),

      travaux:
        nombreOuVideCodex(
          values[i][5]
        ),

      cachot:
        nombreOuVideCodex(
          values[i][6]
        ),

      sanction:
        String(
          display[i][7] || ""
        ).trim(),

      texte:
        String(
          display[i][8] || ""
        ).trim(),

      alerte:
        String(
          display[i][9] || ""
        ).trim(),

      label:
        construireLabelArticleCodex(
          article,
          titre
        ),

      famille:
        metadata.famille,

      autorite:
        metadata.autorite,

      applicabilite:
        metadata.applicabilite,

      local:
        metadata.local,

      abrege:
        metadata.abrege,

      citable:
        metadata.citable && article.toLowerCase() !== "préambule",

      url:
        metadata.url
    });
  }

  const sources =
    Object.entries(
      documentMetadata
    ).map(
      ([nom, metadata]) => ({
        nom: nom,
        famille: metadata.famille,
        autorite: metadata.autorite,
        applicabilite:
          metadata.applicabilite,
        local: metadata.local,
        abrege: metadata.abrege,
        citable: metadata.citable,
        url: metadata.url
      })
    );

  return {
    version: cache.version,
    articles: articles,
    sources: sources
  };
}


// ============================================================
// INDEX DES ARTICLES POUR LES CHEFS D'ACCUSATION
// ============================================================

/*
  Clé stable d'un article : source et numéro, sans le titre. Le titre peut être
  corrigé dans le document ; la source et le numéro identifient l'article.
  Même règle côté navigateur (`cleArticle` dans `ui/src/codex.js`).
*/
function cleArticleCodex_(source, article) {
  return (
    String(source || "").replace(/ /g, " ").trim().toLowerCase() +
    "|" +
    String(article || "").replace(/ /g, " ").trim().toLowerCase()
  );
}


/*
  Index du cache pour valider les chefs d'accusation envoyés par les
  formulaires Amendes et Prison : clé → {source, article, titre,
  classification, citable}. Lecture par bloc de A:D seulement ; le texte des
  articles n'est pas nécessaire pour valider une référence.

  Utilisé par `validerChefsAccusation_` (`Amendes.js`), partagé avec
  `Prison.js`.
*/
function indexerArticlesCodex_(ss) {
  const sheet = ss.getSheetByName(CODEX_SYNC_SHEET_NAME);

  if (!sheet) {
    throw new Error("Feuille SyncCodex introuvable. Lancez synchroniserCodex().");
  }

  const index = new Map();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return index;
  }

  const metadata = getCodexDocumentMetadata_(sheet);
  const lignes = sheet.getRange(2, 1, lastRow - 1, 4).getDisplayValues();

  lignes.forEach(function (ligne) {
    const source = String(ligne[0] || "").trim();
    const article = String(ligne[1] || "").trim();

    if (!source || !article) {
      return;
    }

    const meta = metadata[source] || metadonneesCodexRepli_(source);

    index.set(cleArticleCodex_(source, article), {
      source: source,
      article: article,
      titre: String(ligne[2] || "").trim(),
      classification: String(ligne[3] || "").trim(),
      abrege: meta.abrege,
      citable: meta.citable && article.toLowerCase() !== "préambule"
    });
  });

  return index;
}


// ============================================================
// HELPERS
// ============================================================

function nombreOuVideCodex(value) {
  if (
    value === "" ||
    value === null ||
    typeof value === "undefined"
  ) {
    return "";
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : "";
}


function construireLabelArticleCodex(
  article,
  titre
) {
  const numero =
    String(article || "").trim();

  const nom =
    String(titre || "").trim();

  if (
    numero.toLowerCase() ===
    "préambule"
  ) {
    return nom || "Préambule";
  }

  if (numero && nom) {
    return `Art. ${numero} — ${nom}`;
  }

  if (numero) {
    return `Art. ${numero}`;
  }

  return nom;
}
