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
// REGISTRE DES DOCUMENTS
// ============================================================

/*
  Registre unique des documents juridiques.

  Il était auparavant dédoublé : les identifiants et familles ici, les autorités
  et les liens dans `getCodexDocumentMetadata_()` de `Codex.js`. Avec une
  vingtaine de documents, deux tables parallèles divergent tôt ou tard.
  `Codex.js` dérive désormais ses métadonnées de ce registre ; ajouter un texte
  ne demande qu'une entrée ici.

  Champs :
    id             identifiant du Google Doc (44 caractères pour un Doc natif)
    source         nom affiché ; sert AUSSI de clé de rattachement des amendes
                   et incarcérations déjà enregistrées. Ne pas modifier à la
                   légère : un libellé changé orpheline les lignes historiques.
    famille        regroupement dans la bibliothèque du Codex
    autorite       qui édicte le texte
    applicabilite  domaine couvert
    local          droit de la châtellerie, par opposition au droit impérial
    garde          texte de référence directe pour la Garde
    sanctions      les articles sanctionnés alimentent les listes d'infractions
                   des formulaires Amendes et Prison

  `sanctions` ne force rien : un article n'entre dans ces listes que s'il porte
  effectivement une amende ou une durée de cachot, voir
  `ecrireCachesTechniquesCodex_()`. Un décret sans sanction reste donc
  consultable sans encombrer les formulaires, même si sa source est marquée.

  Le droit impérial est consultable mais n'alimente pas les formulaires : la
  Garde sanctionne sur le fondement du droit de la châtellerie.
*/

const SYNC_CODEX_SHEET_NAME = "SyncCodex";

const CODEX_JUDICIAIRE_SOURCE = "Codex Judiciaire de Blancherive";

const SYNC_CODEX_DOCUMENTS = [

  // ----- Droit de la châtellerie -----
  {
    id: "1_awmZGCcQ0TgQycHQGRiBXLTr-f6Yjsn4fR7dAMdQvk",
    source: CODEX_JUDICIAIRE_SOURCE,
    famille: "Droit de Blancherive",
    autorite: "Châtellerie de Blancherive",
    applicabilite: "Justice et sanctions de la Garde",
    local: true,
    garde: true,
    sanctions: true
  },

  // ----- Codes impériaux -----
  {
    id: "1Q44ArnKr6qsJIRP9pSVCq_eloSzgMxA1JTqbPl7PP-M",
    source: "Corpus Juriscivilis Imperialis",
    famille: "Droit impérial",
    autorite: "Empire de Tamriel",
    applicabilite: "Droit pénal impérial général",
    local: false,
    garde: false
  },
  {
    id: "1hMA2J9FeE-LfKwdKXy15U6nrpKpdzRZdFg77hqywrzI",
    source: "De Re Nobilitatis",
    famille: "Droit impérial",
    autorite: "Empire de Tamriel",
    applicabilite: "Droit et statut de la noblesse",
    local: false,
    garde: false
  },
  {
    id: "15ij3H8wqKr-kEAlmHtSSAY1EKslKLudAJT-iM78UERE",
    source: "Corpus Proceduralis Imperialis",
    famille: "Droit impérial",
    autorite: "Empire de Tamriel",
    applicabilite: "Procédure pénale impériale",
    local: false,
    garde: false
  },
  {
    id: "1OfwyV6KQynjJS3QyVJyLLbgoTuQc2IP3CoRBSt45soM",
    source: "Justicia Militaris",
    famille: "Droit spécial",
    autorite: "Empire de Tamriel",
    applicabilite: "Justice militaire et Légion impériale",
    local: false,
    garde: false
  },
  {
    id: "1AwLYSziNrCP5oLCyIUAaAauoWmeQVRjvrBcSIBYP000",
    source: "Codex Penitus Imperialis",
    famille: "Droit spécial",
    autorite: "Empire de Tamriel",
    applicabilite: "Protection de l'autorité impériale",
    local: false,
    garde: false
  },

  // ----- Décrets impériaux et provinciaux -----
  {
    id: "1u3x3SrbR0IAP3S2hZg-8szrQajtPUBz8dPnLdydb_hE",
    source: "Décret sur le régime fiscal de Bordeciel",
    famille: "Décrets impériaux",
    autorite: "Empire de Tamriel",
    applicabilite: "Fiscalité de la province",
    local: false,
    garde: false
  },
  {
    id: "1a2Iq5wEduHZlnoFFMbaOuBNHRG7kfhTQGxHM7PnJR-A",
    source: "Décret sur l'imposition en Bordeciel",
    famille: "Décrets impériaux",
    autorite: "Empire de Tamriel",
    applicabilite: "Impôts et contributions",
    local: false,
    garde: false
  },
  {
    id: "1OEoAUcDVqnjH22Knnyl8ki4v2ED5UYqdg9P6dqww1Zo",
    source: "De Argentaria",
    famille: "Décrets impériaux",
    autorite: "Empire de Tamriel",
    applicabilite: "Établissements bancaires",
    local: false,
    garde: false
  },
  {
    id: "1epKkQLkEHy9RhLZycOUt-HNxFwVP8szyh_zhBRv0lGQ",
    source: "Décret sur les Avocatus de Bordeciel",
    famille: "Décrets impériaux",
    autorite: "Empire de Tamriel",
    applicabilite: "Représentation en justice",
    local: false,
    garde: false
  },
  {
    id: "1PAtsn1rI81OLlwCmNvjM8EvPbd6oAHGrnUE-rzS2jOA",
    source: "Décret sur le statut des administrateurs impériaux",
    famille: "Décrets impériaux",
    autorite: "Empire de Tamriel",
    applicabilite: "Administration impériale",
    local: false,
    garde: false
  },
  {
    id: "1AZpHX8bqLZktW9Y36AI7QiAN_qBkZdxMxdkXYycg7sU",
    source: "Décret sur les successions des châtelleries",
    famille: "Décrets impériaux",
    autorite: "Gouverneur impérial de Bordeciel",
    applicabilite: "Succession des Jarls et des charges",
    local: false,
    garde: false
  },
  {
    id: "1HprPbGwA0B_0eOA4wlTnckxFDZZK-ikCfbklJ_p6RwA",
    source: "Décret sur la qualité de Chevalier de Bordeciel",
    famille: "Décrets impériaux",
    autorite: "Empire de Tamriel",
    applicabilite: "Chevalerie de la province",
    local: false,
    garde: false
  },
  {
    id: "105KB6YllsBgQr7m_gcOVj74vHQFy30e2ja0omh5BNfE",
    source: "Décret sur les Ordres Militaires Religieux",
    famille: "Décrets impériaux",
    autorite: "Empire de Tamriel",
    applicabilite: "Ordres militaires religieux",
    local: false,
    garde: false
  },
  {
    id: "19asrJHgFRAu3KDaHkXZjAAggqOI-gyFp5ZJl2jrepU8",
    source: "Décret sur les équipements stratégiques Orsimer",
    famille: "Décrets impériaux",
    autorite: "Gouverneur impérial de Bordeciel",
    applicabilite: "Armes et équipements prohibés",
    local: false,
    garde: true
  },
  {
    id: "17Y36stT6oVpZARCc093XOrhHVCfHimRBwxmFLapq9lM",
    source: "Décret sur les équipements dwemers",
    famille: "Décrets impériaux",
    autorite: "Gouverneur impérial de Bordeciel",
    applicabilite: "Armes et équipements prohibés",
    local: false,
    garde: true
  },
  {
    id: "1vvolhoVSss_EEI8cECbNrVdQAgBpjbUbfN_iiZJoYG8",
    source: "Décret sur les armes éthérées",
    famille: "Décrets impériaux",
    autorite: "Gouverneur impérial de Bordeciel",
    applicabilite: "Armes et équipements prohibés",
    local: false,
    garde: true
  },
  {
    id: "1x9jV2Ijc_4niwHQe4yK3PKmp28fqfWCN4FFuwRTTOzs",
    source: "Decretum de Restitutione Bonorum Imperii",
    famille: "Décrets impériaux",
    autorite: "Empire de Tamriel",
    applicabilite: "Restitution des biens de l'Empire",
    local: false,
    garde: true
  }

  /*
    Non référencés volontairement, au 15 septembre 2026 :

    - La Constitution cléricale du Conseil des Huit Divins et le Registre de la
      Chevalerie de Bordeciel sont de la documentation de contexte, pas du droit
      applicable par la Garde.
    - Deux décrets de la Chancellerie impériale (`1jP5L4_Y6Mn6AmQaofUDXcNxqLe8MPpLW`
      et `1bHAKCcyHORBhNySubRTfqWm81pd1CH74`) sont des fichiers Word importés, que
      `DocumentApp.openById()` ne sait pas ouvrir. À convertir en Google Docs.
    - `13faCeylp2cI_asJcb7JmTosG6Dbt8_FDl488NPZuf9U` n'est pas partagé.
    - Le Codex Procédural de Blancherive est abandonné et son document ne répond
      plus ; il a été retiré de ce registre.
  */
];


// ============================================================
// DOSSIERS DE DOCUMENTS
// ============================================================

/*
  Dossiers Drive dont chaque Google Doc est un texte juridique.

  Le Jarl de Blancherive promulgue ses décrets au fil de l'eau. Les inscrire un
  par un dans `SYNC_CODEX_DOCUMENTS` imposerait une modification de code et un
  push à chaque décret. Un dossier supprime cette contrainte : déposer le
  document suffit, la synchronisation suivante le prend en compte.

  Le nom du fichier devient le nom de la source affiché dans le Codex.

  Le dossier fait autorité : les caches sont intégralement réécrits à chaque
  synchronisation, sur toute leur hauteur précédente. Un décret retiré du
  dossier, ou renommé, disparaît donc du Codex et des listes d'infractions sans
  intervention. C'est le comportement voulu — un décret abrogé se supprime.

  Les libellés déjà enregistrés dans Amendes et Prison sont de la forme
  `Art. N — Titre` et ne portent pas le nom de la source : retirer ou renommer
  un décret ne modifie donc aucune ligne historique. Seul le lien de l'icône
  d'information vers l'article cesse de se résoudre, le libellé restant lisible.

  Seuls les Google Docs natifs sont lus. Les fichiers d'un autre type présents
  dans le dossier sont ignorés en silence, et non signalés comme des erreurs :
  un dossier peut légitimement contenir des pièces jointes ou des brouillons.

  `id` reste vide tant que le dossier n'a pas été créé ; la lecture est alors
  simplement sautée, ce qui permet de livrer le code avant le dossier.
*/
const SYNC_CODEX_FOLDERS = [
  {
    id: "",
    famille: "Droit de Blancherive",
    autorite: "Jarl de Blancherive",
    applicabilite: "Décrets de la châtellerie",
    local: true,
    garde: true,
    sanctions: true
  }
];


/*
  Registre effectif : documents déclarés un par un, puis documents découverts
  dans les dossiers. Un document explicitement déclaré l'emporte sur un
  homonyme trouvé en dossier.
*/
function lireDocumentsCodex_() {
  const documents = SYNC_CODEX_DOCUMENTS.slice();
  const connus = {};

  documents.forEach(function (document) {
    connus[document.source] = true;
  });

  SYNC_CODEX_FOLDERS.forEach(function (dossier) {
    if (!dossier.id) {
      return;
    }

    const fichiers =
      DriveApp
        .getFolderById(dossier.id)
        .getFilesByType(MimeType.GOOGLE_DOCS);

    while (fichiers.hasNext()) {
      const fichier = fichiers.next();
      const source = String(fichier.getName() || "").trim();

      if (!source || connus[source]) {
        continue;
      }

      connus[source] = true;

      documents.push({
        id: fichier.getId(),
        source: source,
        famille: dossier.famille,
        autorite: dossier.autorite,
        applicabilite: dossier.applicabilite,
        local: dossier.local,
        garde: dossier.garde,
        sanctions: dossier.sanctions
      });
    }
  });

  return documents;
}


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
    const documents = lireDocumentsCodex_();

    for (const config of documents) {
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
      articles,
      documents
    );

    /*
      Les documents découverts en dossier ne sont connus qu'ici. `Codex.js` les
      relit dans ce cache plutôt que de lister le dossier à chaque consultation,
      ce qui épargne un appel Drive par affichage du Codex.
    */
    ecrireCacheDocumentsCodex_(sheet, documents);

    SpreadsheetApp.flush();

    return {
      articles: articles.length,
      documents: documents.length,
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

/*
  Lecture des lignes d'un document.

  `getBody().getParagraphs()` ne retourne QUE les éléments de type Paragraph :
  les ListItem sont un type distinct et en étaient absents. Plusieurs décrets
  impériaux rédigent leurs articles en listes à puces, et disparaissaient donc
  intégralement de l'extraction, sans erreur ni article produit.

  `getText()` sur un conteneur concatène tout le texte qu'il contient,
  paragraphes, listes et tableaux compris, séparés par des sauts de ligne.

  Les documents à onglets posent le même problème une strate plus haut :
  `getBody()` ne retourne que l'onglet courant. `getTabs()` n'existe pas dans
  les anciennes exécutions, d'où la détection au lieu d'un appel direct.
*/
function lignesDocumentCodex_(document) {
  const corps = [];

  if (typeof document.getTabs === "function") {
    const empiler = tabs => {
      (tabs || []).forEach(tab => {
        try {
          corps.push(tab.asDocumentTab().getBody());
        } catch (_) {}

        if (typeof tab.getChildTabs === "function") {
          empiler(tab.getChildTabs());
        }
      });
    };

    try {
      empiler(document.getTabs());
    } catch (_) {}
  }

  if (!corps.length) {
    corps.push(document.getBody());
  }

  const lignes = [];

  corps.forEach(body => {
    if (!body) {
      return;
    }

    String(body.getText() || "")
      .split("\n")
      .forEach(ligne => lignes.push(ligne.trim()));
  });

  return lignes;
}


function extraireArticlesCodex_(document, config) {
  const paragraphs = lignesDocumentCodex_(document);

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
  articles,
  documents
) {
  const headers = [
    "Dropdown Amende",
    "Montant",
    "Dropdown Prison",
    "Cachot (heures)"
  ];

  /*
    IMPORTANT :
    Les documents impériaux sont consultables mais ils ne sont PAS proposés aux
    gardes dans les formulaires. Seules les sources marquées `sanctions` y
    entrent : le Codex Judiciaire, et les décrets de la châtellerie.

    Un article d'une source marquée n'apparaît pour autant que s'il porte une
    amende ou une durée de cachot ; les décrets purement réglementaires
    n'encombrent donc pas les listes.
  */
  const sourcesSanctionnantes = {};

  (documents || SYNC_CODEX_DOCUMENTS).forEach(function (document) {
    if (document.sanctions) {
      sourcesSanctionnantes[document.source] = true;
    }
  });

  const amendes = [];
  const prisons = [];

  for (const article of articles) {
    if (!sourcesSanctionnantes[article.source]) {
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
// CACHE DES DOCUMENTS R:W
// ============================================================

/*
  Métadonnées des documents effectivement synchronisés.

  Nécessaire parce que les décrets déposés dans un dossier Drive ne figurent
  dans aucune déclaration : sans ce cache, `Codex.js` devrait relister le
  dossier à chaque consultation du Codex.

  R Source
  S Famille
  T Autorité
  U Applicabilité
  V Local
  W Lien
*/
const SYNC_CODEX_DOCUMENTS_COLUMN = 18;

function ecrireCacheDocumentsCodex_(sheet, documents) {
  const headers = [
    "Source",
    "Famille",
    "Autorité",
    "Applicabilité",
    "Local",
    "Lien"
  ];

  const rows = documents.map(function (document) {
    return [
      document.source,
      document.famille || "",
      document.autorite || "",
      document.applicabilite || "",
      document.local ? "oui" : "",
      "https://docs.google.com/document/d/" + document.id + "/edit"
    ];
  });

  const clearRows = Math.max(
    sheet.getLastRow(),
    rows.length + 1,
    2
  );

  sheet
    .getRange(1, SYNC_CODEX_DOCUMENTS_COLUMN, clearRows, headers.length)
    .clearContent();

  sheet
    .getRange(1, SYNC_CODEX_DOCUMENTS_COLUMN, 1, headers.length)
    .setValues([headers])
    .setFontWeight("bold");

  if (rows.length) {
    sheet
      .getRange(2, SYNC_CODEX_DOCUMENTS_COLUMN, rows.length, headers.length)
      .setValues(rows);
  }

  sheet.setColumnWidth(SYNC_CODEX_DOCUMENTS_COLUMN, 320);
  sheet.setColumnWidth(SYNC_CODEX_DOCUMENTS_COLUMN + 1, 160);
  sheet.setColumnWidth(SYNC_CODEX_DOCUMENTS_COLUMN + 2, 200);
  sheet.setColumnWidth(SYNC_CODEX_DOCUMENTS_COLUMN + 3, 240);
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
