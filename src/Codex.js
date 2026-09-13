// ============================================================
// CODEX - API WEB
// ============================================================

const CODEX_SYNC_SHEET_NAME = "SyncCodex";


// ============================================================
// MÉTADONNÉES DOCUMENTAIRES
// ============================================================

/*
  Les identifiants de documents sont déclarés dans SyncCodex.js.
  On construit ces métadonnées à l'appel, plutôt qu'au chargement
  du fichier, afin de ne pas dépendre de l'ordre d'évaluation des
  fichiers Apps Script.
*/
function getCodexDocumentMetadata_() {
  return {
  "Codex Judiciaire de Blancherive": {
    famille: "Droit de Blancherive",
    autorite: "Châtellerie de Blancherive",
    applicabilite: "Justice et sanctions de la Garde",
    local: true,
    url:
      "https://docs.google.com/document/d/" +
      CODEX_JUDICIAIRE_DOC_ID +
      "/edit"
  },

  "Codex Procédural de Blancherive": {
    famille: "Droit de Blancherive",
    autorite: "Châtellerie de Blancherive",
    applicabilite: "Procédure judiciaire locale",
    local: true,
    url:
      "https://docs.google.com/document/d/" +
      CODEX_PROCEDURAL_DOC_ID +
      "/edit"
  },

  "Corpus Juriscivilis Imperialis": {
    famille: "Droit impérial",
    autorite: "Empire de Tamriel",
    applicabilite: "Droit pénal impérial général",
    local: false,
    url:
      "https://docs.google.com/document/d/" +
      CORPUS_JURISCIVILIS_DOC_ID +
      "/edit"
  },

  "Code de la Noblesse en Bordeciel": {
    famille: "Droit impérial",
    autorite: "Empire de Tamriel",
    applicabilite: "Droit et statut de la noblesse",
    local: false,
    url:
      "https://docs.google.com/document/d/" +
      CODE_NOBLESSE_DOC_ID +
      "/edit"
  },

  "Corpus Proceduralis Imperialis": {
    famille: "Droit impérial",
    autorite: "Empire de Tamriel",
    applicabilite: "Procédure pénale impériale",
    local: false,
    url:
      "https://docs.google.com/document/d/" +
      CORPUS_PROCEDURALIS_DOC_ID +
      "/edit"
  },

  "Justicia Militaris": {
    famille: "Droit spécial",
    autorite: "Empire de Tamriel",
    applicabilite: "Justice militaire et Légion impériale",
    local: false,
    url:
      "https://docs.google.com/document/d/" +
      JUSTICIA_MILITARIS_DOC_ID +
      "/edit"
  },

  "Codex Pænitus Imperialis": {
    famille: "Droit spécial",
    autorite: "Empire de Tamriel",
    applicabilite: "Protection de l'autorité impériale",
    local: false,
    url:
      "https://docs.google.com/document/d/" +
      CODEX_PAENITUS_DOC_ID +
      "/edit"
  }
  };
}


// ============================================================
// LECTURE DU CODEX
// ============================================================

function getCodex(token) {
  requireRole(
    token,
    ["GARDE", "OFFICIER"]
  );

  const documentMetadata =
    getCodexDocumentMetadata_();

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
