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
*/
function getCodexDocumentMetadata_(sheet) {
  const metadata = {};

  SYNC_CODEX_DOCUMENTS.forEach(function (document) {
    metadata[document.source] = {
      famille: document.famille,
      autorite: document.autorite || "",
      applicabilite: document.applicabilite || "",
      local: Boolean(document.local),
      url:
        "https://docs.google.com/document/d/" +
        document.id +
        "/edit"
    };
  });

  /*
    Les décrets déposés dans un dossier Drive ne figurent dans aucune
    déclaration. La synchronisation inscrit leurs métadonnées en R:W ; on les
    relit ici plutôt que de lister le dossier à chaque consultation du Codex.

    Le cache complète le registre sans l'écraser : un document déclaré garde ses
    métadonnées même si une ligne du cache porte le même nom.
  */
  if (sheet) {
    const dernierLigne = sheet.getLastRow();

    if (dernierLigne >= 2) {
      const lignes =
        sheet
          .getRange(2, SYNC_CODEX_DOCUMENTS_COLUMN, dernierLigne - 1, 6)
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
          url: String(ligne[5] || "").trim()
        };
      });
    }
  }

  return metadata;
}


// ============================================================
// LECTURE DU CODEX
// ============================================================

function getCodex(token) {
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

  // Construit après l'ouverture de la feuille : le cache R:W y est relu.
  const documentMetadata =
    getCodexDocumentMetadata_(sheet);

  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {
    return {
      articles: [],
      sources: []
    };
  }

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
  const range =
    sheet.getRange(
      2,
      1,
      lastRow - 1,
      10
    );

  const values =
    range.getValues();

  const display =
    range.getDisplayValues();

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
      documentMetadata[source] || {
        famille: "Autres textes",
        autorite: "",
        applicabilite: "",
        local: false,
        url: ""
      };

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
        url: metadata.url
      })
    );

  return {
    articles: articles,
    sources: sources
  };
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
