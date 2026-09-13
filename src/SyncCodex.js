// ============================================================
// SYNCHRONISATION DES CODEX
// ============================================================
//
// Google Docs = sources de vérité.
// SyncCodex = cache technique généré.
//
// A  Source
// B  Article
// C  Titre
// D  Classification
// E  Amende
// F  Travaux forcés (heures)
// G  Cachot (heures)
// H  Sanction complète
// I  Texte
// J  Alerte parsing
//
// L  Dropdown Amende
// M  Choix d'amende JSON version 1
// N  Dropdown Prison
// O  Choix de cachot JSON version 1 (heures)
//
// IMPORTANT :
// SPREADSHEET_ID existe déjà ailleurs dans le projet.
// Ne pas le redéclarer ici.
// ============================================================


// ============================================================
// DOCUMENTS LOCAUX EXISTANTS
// ============================================================

const CODEX_JUDICIAIRE_DOC_ID =
  "1_awmZGCcQ0TgQycHQGRiBXLTr-f6Yjsn4fR7dAMdQvk";

const CODEX_PROCEDURAL_DOC_ID =
  "17Y3GBQBp_fwLhvkppf9BqRasAYQmF957qwCZXPSO54s";


// ============================================================
// DOCUMENTS IMPÉRIAUX
// ============================================================

const CORPUS_JURISCIVILIS_DOC_ID =
  "1_AslqVkDl2Eo3_qYR_cwqgxoPXfOstyCenCGK0VHew0";

const CODE_NOBLESSE_DOC_ID =
  "1Kcw1wllFOgaPRxfCaJqCOQLt4l3UpdjJ2cprNm4cW8c";

const CORPUS_PROCEDURALIS_DOC_ID =
  "1S7TzUjib2Lfvrt7xbcddZ2Ess0oo1lI-BZ0oh8xOkUA";

const JUSTICIA_MILITARIS_DOC_ID =
  "17pIYvR6ViSOuFqi36Bqop8PqijVkUgoidQLDtJP8fAY";

const CODEX_PAENITUS_DOC_ID =
  "1cO8A1vo71fROQT8-2AyT5ACNLOZol0EDrLaUu9ghZK0";


// ============================================================
// CONFIGURATION
// ============================================================

const SYNC_CODEX_SHEET_NAME = "SyncCodex";

const SYNC_CODEX_DOCUMENTS = [
  {
    id: CODEX_JUDICIAIRE_DOC_ID,
    source: "Codex Judiciaire de Blancherive",
    famille: "Droit de Blancherive",
    garde: true
  },
  {
    id: CODEX_PROCEDURAL_DOC_ID,
    source: "Codex Procédural de Blancherive",
    famille: "Droit de Blancherive",
    garde: false
  },
  {
    id: CORPUS_JURISCIVILIS_DOC_ID,
    source: "Corpus Juriscivilis Imperialis",
    famille: "Droit impérial",
    garde: false
  },
  {
    id: CODE_NOBLESSE_DOC_ID,
    source: "Code de la Noblesse en Bordeciel",
    famille: "Droit impérial",
    garde: false
  },
  {
    id: CORPUS_PROCEDURALIS_DOC_ID,
    source: "Corpus Proceduralis Imperialis",
    famille: "Droit impérial",
    garde: false
  },
  {
    id: JUSTICIA_MILITARIS_DOC_ID,
    source: "Justicia Militaris",
    famille: "Droit spécial",
    garde: false
  },
  {
    id: CODEX_PAENITUS_DOC_ID,
    source: "Codex Pænitus Imperialis",
    famille: "Droit spécial",
    garde: false
  }
];


// ============================================================
// SYNCHRONISATION PRINCIPALE
// ============================================================

function synchroniserCodex() {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SYNC_CODEX_SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(SYNC_CODEX_SHEET_NAME);
    }

    const articles = [];
    const erreursDocuments = [];

    for (const config of SYNC_CODEX_DOCUMENTS) {
      try {
        const document = DocumentApp.openById(config.id);
        const parsed = extraireArticlesCodex_(document, config);

        articles.push(...parsed);
      } catch (error) {
        erreursDocuments.push(
          `${config.source} : ${error.message || error}`
        );
      }
    }

    ecrireSyncCodex_(sheet, articles);

    ecrireCachesTechniquesCodex_(
      sheet,
      articles
    );

    SpreadsheetApp.flush();

    return {
      articles: articles.length,
      documents: SYNC_CODEX_DOCUMENTS.length,
      erreurs: erreursDocuments
    };

  } finally {
    try {
      lock.releaseLock();
    } catch (_) {}
  }
}


// ============================================================
// EXTRACTION D'UN DOCUMENT
// ============================================================

function extraireArticlesCodex_(document, config) {
  const paragraphs = document
    .getBody()
    .getParagraphs()
    .map(paragraph => String(paragraph.getText() || "").trim());

  const results = [];

  let current = null;
  let preamble = [];

  function terminerArticle() {
    if (!current) {
      return;
    }

    const parsed = finaliserArticleCodex_(current, config);

    if (parsed) {
      results.push(parsed);
    }

    current = null;
  }

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      if (current) {
        current.lines.push("");
      } else if (preamble.length) {
        preamble.push("");
      }

      continue;
    }

    // Les intertitres du document ne font partie ni du texte ni des sanctions.
    if (estIntertitreCodex_(paragraph)) {
      continue;
    }

    const heading = reconnaitreArticleCodex_(paragraph);

    if (heading) {
      terminerArticle();

      current = {
        article: heading.article,
        titre: heading.titre,
        lines: []
      };

      continue;
    }

    if (!current) {
      preamble.push(paragraph);
      continue;
    }

    /*
      Si l'article n'avait pas de titre sur la ligne ARTICLE,
      on essaie de considérer la première ligne courte comme titre.
    */
    if (
      !current.titre &&
      current.lines.length === 0 &&
      estTitreProbableCodex_(paragraph)
    ) {
      current.titre = paragraph;
      continue;
    }

    current.lines.push(paragraph);
  }

  terminerArticle();

  /*
    On conserve aussi les préambules, car ils sont juridiquement
    consultables et doivent être trouvables dans la recherche globale.
  */
  const preambleText = nettoyerBlocCodex_(preamble);

  if (preambleText) {
    results.unshift({
      source: config.source,
      article: "Préambule",
      titre: "Préambule",
      classification: "",
      amende: "",
      travaux: "",
      cachot: "",
      sanction: "",
      texte: preambleText,
      alerte: ""
    });
  }

  return results;
}


// ============================================================
// RECONNAISSANCE DES ARTICLES
// ============================================================

function estIntertitreCodex_(text) {
  return /^(?:titre|chapitre|section|livre|partie)\s+(?:[IVXLCDM]+|\d+|préliminaire|preliminaire)(?:\s*[—–:\-]\s*\S.*)?$/i.test(String(text || "").trim());
}


function reconnaitreArticleCodex_(text) {
  const patterns = [
    /^ARTICLE\s+([0-9]+(?:[.\-][0-9]+)*|[IVXLCDM]+)\s*(?:[—–:\-]\s*(.*))?$/i,
    /^ART\.?\s+([0-9]+(?:[.\-][0-9]+)*|[IVXLCDM]+)\s*(?:[—–:\-]\s*(.*))?$/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      return {
        article: String(match[1] || "").trim(),
        titre: String(match[2] || "").trim()
      };
    }
  }

  return null;
}


function estTitreProbableCodex_(text) {
  if (!text || text.length > 160) {
    return false;
  }

  if (/^(sanction|peine|amende|classification)\b/i.test(text)) {
    return false;
  }

  if (/^[•\-–—]/.test(text)) {
    return false;
  }

  return true;
}


// ============================================================
// FINALISATION D'UN ARTICLE
// ============================================================

function finaliserArticleCodex_(article, config) {
  const texte = nettoyerBlocCodex_(article.lines);

  if (!article.article && !article.titre && !texte) {
    return null;
  }

  const classification =
    extraireClassificationCodex_(texte);

  const sanction =
    extraireBlocSanctionCodex_(article.lines);

  const sanctions =
    analyserSanctionCodex_(
      sanction || texte
    );

  return {
    source: config.source,
    article: article.article,
    titre:
      article.titre ||
      `Article ${article.article}`,
    classification: classification,
    amende: sanctions.amende,
    travaux: sanctions.travaux,
    cachot: sanctions.cachot,
    sanction: sanction,
    texte: texte,
    alerte: sanctions.alerte
  };
}


// ============================================================
// CLASSIFICATION
// ============================================================

function extraireClassificationCodex_(text) {
  const normalized = String(text || "");

  const classifications = [
    "Crime majeur",
    "Crime",
    "Délit majeur",
    "Délit",
    "Contravention",
    "Infraction",
    "Faute militaire",
    "Faute",
    "Trahison"
  ];

  for (const classification of classifications) {
    const regex = new RegExp(
      `\\b${echapperRegexCodex_(classification)}\\b`,
      "i"
    );

    if (regex.test(normalized)) {
      return classification;
    }
  }

  return "";
}


// ============================================================
// BLOC SANCTION
// ============================================================

function extraireBlocSanctionCodex_(lines) {
  let start = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = String(lines[i] || "").trim();

    if (
      /^(sanction|sanctions|peine|peines)\b/i.test(line) ||
      /\bSanction\s*[—–:\-]/i.test(line)
    ) {
      start = i;
      break;
    }
  }

  if (start < 0) {
    return "";
  }

  return nettoyerBlocCodex_(
    lines.slice(start)
  );
}


// ============================================================
// PARSING DES SANCTIONS
// ============================================================

function analyserSanctionCodex_(text) {
  const source = String(text || "").trim();

  if (!source) {
    return {
      amende: "",
      travaux: "",
      cachot: "",
      alerte: ""
    };
  }

  const alertes = [];

  const amendes = extraireMontantsAmendeCodex_(source);
  const cachots = extraireDureesChoixCodex_(source, "cachot|prison|incarcération|incarceration|détention|detention|geôle|geole");

  const travaux = extraireDureesCodex_(
    source,
    [
      "travaux forcés",
      "travaux forces",
      "travail forcé",
      "travail force",
      "travaux d'intérêt",
      "travaux d’interêt",
      "travaux"
    ]
  );

  if (amendes.length > 1) {
    alertes.push(
      "Plusieurs montants d'amende détectés."
    );
  }

  if (cachots.length > 1) {
    alertes.push(
      "Plusieurs durées de détention détectées."
    );
  }

  if (travaux.length > 1) {
    alertes.push(
      "Plusieurs durées de travaux détectées."
    );
  }

  if (
    /\b(à l['’]appréciation|selon appréciation|au choix|variable)\b/i.test(source)
  ) {
    alertes.push(
      "Sanction laissée à l'appréciation de l'autorité."
    );
  }

  if (
    /\b(minimum|au moins|maximum|au plus|jusqu['’]à)\b/i.test(source)
  ) {
    alertes.push(
      "La sanction comporte une borne minimale ou maximale."
    );
  }

  if (
    /\b(par\s+(jour|objet|unité|unite|victime|infraction|personne|tête|tete))\b/i.test(source)
  ) {
    alertes.push(
      "La sanction dépend d'une quantité ou d'une unité."
    );
  }

  if (
    /\b(confiscation|saisie définitive|déchéance|decheance)\b/i.test(source)
  ) {
    alertes.push(
      "La sanction comporte une mesure non numérique."
    );
  }

  if (
    /\b(peine de mort|mise à mort|exécution|execution|condamnation à mort)\b/i.test(source)
  ) {
    alertes.push(
      "Peine capitale mentionnée."
    );
  }

  return {
    amende:
      amendes.length === 1
        ? amendes[0]
        : "",
    travaux:
      travaux.length === 1
        ? travaux[0]
        : "",
    cachot:
      cachots.length === 1
        ? cachots[0]
        : "",
    alerte:
      [...new Set(alertes)].join(" ")
  };
}


// ============================================================
// AMENDES
// ============================================================

function extraireMontantsAmendeCodex_(text) {
  const values = [];

  const patterns = [
    /(\d[\d\s.,]*)\s*(?:septims?|pièces?\s+d['’]or|pieces?\s+d['’]or)/gi,
    /amende\s+(?:de|d['’])?\s*(\d[\d\s.,]*)/gi
  ];

  for (const pattern of patterns) {
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const number = parseNombreCodex_(match[1]);

      if (
        Number.isFinite(number) &&
        number >= 0
      ) {
        values.push(number);
      }
    }
  }

  return [...new Set(values)];
}


// ============================================================
// DURÉES
// ============================================================

function extraireDureesCodex_(text, keywords) {
  const values = [];

  const keywordRegex = keywords
    .map(echapperRegexCodex_)
    .join("|");

  const patterns = [
    new RegExp(
      `(?:${keywordRegex})[^\\n.;]{0,80}?(\\d+(?:[.,]\\d+)?)\\s*(minute|min|minutes|heure|heures|h|jour|jours|journée|journées)`,
      "gi"
    ),
    new RegExp(
      `(\\d+(?:[.,]\\d+)?)\\s*(minute|min|minutes|heure|heures|h|jour|jours|journée|journées)[^\\n.;]{0,80}?(?:${keywordRegex})`,
      "gi"
    )
  ];

  for (const pattern of patterns) {
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const quantity =
        Number(
          String(match[1])
            .replace(",", ".")
        );

      if (!Number.isFinite(quantity)) {
        continue;
      }

      const unit =
        String(match[2] || "")
          .toLowerCase();

      let hours = quantity;

      if (
        unit.startsWith("min")
      ) {
        hours = quantity / 60;
      } else if (
        unit.startsWith("jour")
      ) {
        hours = quantity * 24;
      }

      values.push(
        Math.round(hours * 10000) / 10000
      );
    }
  }

  return [...new Set(values)];
}


// ============================================================
// ÉCRITURE PRINCIPALE A:J
// ============================================================

function ecrireSyncCodex_(sheet, articles) {
  const headers = [
    "Source",
    "Article",
    "Titre",
    "Classification",
    "Amende",
    "Travaux forcés (heures)",
    "Cachot (heures)",
    "Sanction complète",
    "Texte",
    "Alerte parsing"
  ];

  const rows = articles.map(article => [
    article.source,
    article.article,
    article.titre,
    article.classification,
    article.amende,
    article.travaux,
    article.cachot,
    article.sanction,
    article.texte,
    article.alerte
  ]);

  const clearRows = Math.max(
    sheet.getLastRow(),
    rows.length + 1,
    2
  );

  sheet
    .getRange(1, 1, clearRows, 10)
    .clearContent();

  sheet
    .getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight("bold");

  if (rows.length) {
    sheet
      .getRange(2, 1, rows.length, 10)
      .setValues(rows);
  }

  sheet.setFrozenRows(1);

  sheet.setColumnWidth(1, 230);
  sheet.setColumnWidth(2, 90);
  sheet.setColumnWidth(3, 250);
  sheet.setColumnWidth(4, 150);
  sheet.setColumnWidth(5, 100);
  sheet.setColumnWidth(6, 140);
  sheet.setColumnWidth(7, 110);
  sheet.setColumnWidth(8, 350);
  sheet.setColumnWidth(9, 500);
  sheet.setColumnWidth(10, 300);

  if (rows.length) {
    sheet
      .getRange(2, 8, rows.length, 3)
      .setWrap(true);
  }
}


// ============================================================
// CACHES TECHNIQUES L:P
// ============================================================

function ecrireCachesTechniquesCodex_(
  sheet,
  articles
) {
  const headers = [
    "Dropdown Amende",
    "Montant",
    "Dropdown Prison",
    "Cachot (heures)"
  ];

  const judicialSource =
    "Codex Judiciaire de Blancherive";

  const amendes = [];
  const prisons = [];

  for (const article of articles) {
    /*
      IMPORTANT :
      Les documents impériaux sont consultables mais ils ne sont
      PAS automatiquement proposés aux gardes dans les formulaires.

      Les dropdowns restent exclusivement issus du Codex judiciaire
      local, comme avant.
    */
    if (article.source !== judicialSource) {
      continue;
    }

    const label =
      construireLabelArticleSyncCodex_(
        article.article,
        article.titre
      );

    if (!label || article.article === "Préambule") {
      continue;
    }

    const choixAmende = construireChoixSanctionCodex_(article.sanction || article.texte, "amende");
    const choixPrison = construireChoixSanctionCodex_(article.sanction || article.texte, "cachot");

    if (
      choixAmende.options.length || choixAmende.libre
    ) {
      amendes.push([
        label,
        JSON.stringify(choixAmende)
      ]);
    }

    if (
      choixPrison.options.length || choixPrison.libre
    ) {
      prisons.push([
        label,
        JSON.stringify(choixPrison)
      ]);
    }
  }

  const maxLength = Math.max(
    amendes.length,
    prisons.length,
    1
  );

  const rows = [];

  for (let i = 0; i < maxLength; i++) {
    rows.push([
      amendes[i]?.[0] || "",
      amendes[i]?.[1] ?? "",
      prisons[i]?.[0] || "",
      prisons[i]?.[1] ?? ""
    ]);
  }

  const clearRows = Math.max(
    sheet.getLastRow(),
    rows.length + 1,
    2
  );

  sheet
    .getRange(1, 12, clearRows, 5)
    .clearContent();

  sheet
    .getRange(1, 16, clearRows, 1)
    .clearDataValidations();

  sheet
    .getRange(1, 12, 1, 4)
    .setValues([headers])
    .setFontWeight("bold");

  sheet
    .getRange(2, 12, rows.length, 4)
    .setValues(rows);

  sheet.setColumnWidth(12, 350);
  sheet.setColumnWidth(13, 100);
  sheet.setColumnWidth(14, 350);
  sheet.setColumnWidth(15, 120);
}


// ============================================================
// HELPERS
// ============================================================

// Cache versionné des choix : les libellés conservent les conditions du texte.
// Seules les quantités accompagnées de leur unité sont proposées.
function construireChoixSanctionCodex_(text, type) {
  const texte = String(text || "").trim();
  const options = [];
  const clauses = texte.split(/\n|;/).map(line => line.trim()).filter(Boolean);
  const blocSanction = /^(?:sanctions?|peines?)\s*[—–:\-]/i.test(texte);
  const unite = type === "amende" ? "septims" : "h de cachot";
  for (const clause of clauses) {
    const values = type === "amende"
      ? (blocSanction || /\bamende\b|\[(?:contravention|délit|crime)/i.test(clause) ? extraireMontantsChoixCodex_(clause) : [])
      : extraireDureesChoixCodex_(clause, "cachot|prison|détention|incarcération");
    for (const value of values) {
      if (!Number.isFinite(value) || value <= 0) continue;
      const label = `${value} ${unite} — ${clause.replace(/^[*•]\s*/, "")}`;
      if (!options.some(option => option.value === value && option.label === label)) {
        options.push({ value, label });
      }
    }
  }
  // Une mesure non numérique (mort, saisie…) n'autorise pas une saisie libre.
  const libre = /(?:à|a) l['’]appréciation|appréciation (?:du|de la|de l['’])|sanction(?:s)? (?:déterminée?s?|fixée?s?) (?:par|selon)|peine(?:s)? (?:déterminée?s?|fixée?s?) (?:par|selon)/i.test(texte);
  return { version: 1, options, libre, texte };
}


function extraireMontantsChoixCodex_(text) {
  const values = [];
  const pattern = /(\d[\d\s.,]*)\s*(?:septims?|pièces?\s+d['’]or|pieces?\s+d['’]or)/gi;
  let match, previousEnd = 0;
  while ((match = pattern.exec(text)) !== null) {
    const prefix = text.slice(previousEnd, match.index);
    previousEnd = pattern.lastIndex;
    // Les seuils de dommage/préjudice ne sont pas des montants d'amende.
    if (/(?:dommage|préjudice|valeur)[^.;\n]{0,100}$/i.test(prefix) && !/amende[^.;\n]*$/i.test(prefix)) continue;
    const value = parseNombreCodex_(match[1]);
    if (Number.isFinite(value)) values.push(value);
  }
  // Ancienne syntaxe « amende de 100 », sans unité explicite.
  const explicit = /amende\s+(?:de|d['’])?\s*(\d[\d\s.,]*)/gi;
  while ((match = explicit.exec(text)) !== null) {
    const value = parseNombreCodex_(match[1]);
    if (Number.isFinite(value)) values.push(value);
  }
  return [...new Set(values)];
}


function extraireDureesChoixCodex_(text, keywords) {
  // Ne pas prendre les heures de travaux forcés précédant une durée de cachot.
  const unit = "(minutes?|min|heures?|h|jours?)";
  const number = "(\\d+(?:[.,]\\d+)?)";
  const patterns = [
    new RegExp(`${number}\\s*${unit}\\s*(?:de\\s+|d['’])?(?:${keywords})`, "gi"),
    new RegExp(`(?:${keywords})\\s*(?::|de|d['’]|pour)?\\s*${number}\\s*${unit}`, "gi")
  ];
  const values = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = Number(match[1].replace(",", "."));
      const unitName = match[2].toLowerCase();
      values.push(unitName.startsWith("m") ? value / 60 : unitName.startsWith("j") ? value * 24 : value);
    }
  }
  return [...new Set(values)];
}


function construireLabelArticleSyncCodex_(
  article,
  titre
) {
  const numero =
    String(article || "").trim();

  const nom =
    String(titre || "").trim();

  if (numero && nom) {
    return `Art. ${numero} — ${nom}`;
  }

  if (numero) {
    return `Art. ${numero}`;
  }

  return nom;
}


function nettoyerBlocCodex_(lines) {
  const result = [];
  let previousEmpty = false;

  for (const rawLine of lines) {
    const line =
      String(rawLine || "")
        .trim();

    if (!line) {
      if (
        result.length &&
        !previousEmpty
      ) {
        result.push("");
      }

      previousEmpty = true;
      continue;
    }

    result.push(line);
    previousEmpty = false;
  }

  while (
    result.length &&
    !result[result.length - 1]
  ) {
    result.pop();
  }

  return result.join("\n").trim();
}


function parseNombreCodex_(value) {
  const cleaned =
    String(value || "")
      .replace(/\s/g, "")
      .replace(",", ".");

  const number = Number(cleaned);

  return Number.isFinite(number)
    ? number
    : NaN;
}


function echapperRegexCodex_(value) {
  return String(value || "")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function diagnostiquerSyncCodex() {
  const result = [];

  for (const config of SYNC_CODEX_DOCUMENTS) {
    try {
      const document = DocumentApp.openById(config.id);
      const body = document.getBody();

      const paragraphs = body
        .getParagraphs()
        .map(p => String(p.getText() || "").trim())
        .filter(Boolean);

      const parsed = extraireArticlesCodex_(document, config);

      result.push({
        source: config.source,
        accessible: true,
        paragraphes: paragraphs.length,
        articlesParses: parsed.length,
        premiersParagraphes: paragraphs.slice(0, 8)
      });

    } catch (error) {
      result.push({
        source: config.source,
        accessible: false,
        erreur: error.message || String(error)
      });
    }
  }

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}
