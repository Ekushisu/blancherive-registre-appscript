/*
  Discord — rattachement des membres et appels à l'API du bot.

  Le tableur décide (docs/AUTH_AND_ROLES.md, « Connexion par Discord ») :
  `Effectifs` fixe l'accès au registre et les rôles Discord ; Discord ne fait
  que prouver l'identité d'un membre. Ce fichier porte le rattachement d'une
  ligne d'`Effectifs` à un compte (colonne `ID Discord`) et, pour la
  connexion, l'identification du compte et l'accès déduit de sa fiche. Le
  jeton lui-même est délivré par `ouvrirSessionDiscord` (`Auth.js`).

  Configuration dans les propriétés du script uniquement, jamais dans le code
  ni dans le classeur ; changer de serveur Discord ne demande que de changer
  ces valeurs :
  - `DISCORD_RELAIS_URL` et `DISCORD_RELAIS_SECRET` (secret) : relais des
    appels du bot, voir ci-dessous ;
  - `DISCORD_GUILD_ID` : identifiant du serveur de la Garde ;
  - `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` (secret) et
    `DISCORD_REDIRECT_URI` : connexion, adresse `/exec` de la Web App
    déclarée à l'identique dans le portail Discord.

  Les appels du bot passent par un relais Cloudflare (`relais-discord/`).
  Discord refuse les requêtes de bot dont l'en-tête User-Agent ressemble à
  celui d'un navigateur (403, « internal network error », code 40333), et
  Apps Script impose « Mozilla/5.0 (compatible; Google-Apps-Script…) » sans
  le laisser remplacer (constaté le 11 octobre 2026). Le relais détient le
  jeton du bot, ajoute un en-tête de bot et n'ouvre qu'une liste fermée de
  routes du serveur de la Garde ; le registre s'y authentifie par un secret
  partagé. La connexion des membres (OAuth) appelle Discord directement :
  ses routes ne sont pas bloquées.

  Le bot n'est jamais « en ligne » : il ne tient pas de connexion permanente
  avec Discord et n'agit que par l'API REST, à la demande du registre.
*/
const DISCORD_API = "https://discord.com/api/v10";
const EFFECTIFS_DISCORD_ENTETE = "ID Discord";
const DISCORD_CACHE_SECONDES = 600;

/*
  Un identifiant Discord compte 17 à 20 chiffres. Au-delà de 15, Sheets
  arrondit un nombre : la colonne est au format texte, et une valeur lue comme
  nombre a perdu ses derniers chiffres.
*/
const DISCORD_ID_MOTIF = /^\d{17,20}$/;


// ============================================================
// API — membres du serveur
// ============================================================

/*
  Membres du serveur Discord, pour choisir le compte d'un membre depuis les
  Effectifs. Bots exclus. Gardés dix minutes en cache, sauf `rafraichir` :
  un membre qui vient de rejoindre le serveur n'attend pas l'expiration.
*/
function getMembresDiscord(token, rafraichir) {
  requireRole(token, ["OFFICIER"]);

  const config = lireConfigBotDiscord_();
  const cache = CacheService.getScriptCache();
  const cle = "DISCORD_MEMBRES_V1|" + config.guildId;

  if (rafraichir !== true) {
    const enCache = cache.get(cle);
    if (enCache) return { membres: JSON.parse(enCache) };
  }

  const membres = lireMembresServeurDiscord_(config)
    .filter(membre => !membre.user.bot)
    .map(membre => ({
      id: String(membre.user.id),
      nom: String(membre.nick || membre.user.global_name || membre.user.username || ""),
      pseudo: String(membre.user.username || "")
    }));

  membres.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  try {
    cache.put(cle, JSON.stringify(membres), DISCORD_CACHE_SECONDES);
  } catch (e) {
    // Liste trop volumineuse pour le cache : elle sera relue la prochaine fois.
  }

  return { membres };
}


/*
  Diagnostic à lancer depuis l'éditeur Apps Script (Exécuter) après un
  changement de configuration. Il demande au passage la permission « services
  externes », puis vérifie le relais (secret exigé, routes fermées), le jeton
  du bot, l'accès au serveur, la lecture des membres et la configuration de
  la connexion. Le résultat s'affiche dans le journal d'exécution ; rien
  n'est renvoyé.

  Publique pour figurer dans l'éditeur, donc appelable par tout visiteur de
  la Web App : elle ne renvoie rien et ne s'exécute qu'une fois par minute.
*/
function verifierConfigurationDiscord() {
  /*
    Google laisse accorder les autorisations une à une, et ne redemande pas
    celle qui a été refusée. Lancée depuis l'éditeur, cette ligne rouvre la
    fenêtre d'autorisation pour « services externes » si elle manque.
  */
  if (typeof ScriptApp !== "undefined" && typeof ScriptApp.requireScopes === "function") {
    ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, [
      "https://www.googleapis.com/auth/script.external_request"
    ]);
  }

  const cache = CacheService.getScriptCache();
  if (cache.get("DISCORD_DIAGNOSTIC")) {
    console.log("Diagnostic Discord déjà lancé il y a moins d'une minute.");
    return;
  }
  cache.put("DISCORD_DIAGNOSTIC", "1", 60);

  const props = PropertiesService.getScriptProperties();
  const lignes = [];
  const etape = (libelle, action) => {
    try {
      lignes.push("✓ " + libelle + " : " + action());
    } catch (e) {
      lignes.push("✗ " + libelle + " : " + e.message + (e.detailDiscord ? " [" + e.detailDiscord + "]" : ""));
    }
  };

  etape("Relais", () => lireConfigBotDiscord_().relaisUrl);
  /*
    Contrôles de sécurité du relais : un secret faux doit être refusé, et une
    route hors de la liste fermée aussi. L'un ou l'autre accepté signale un
    relais déployé sans ses protections.
  */
  etape("Secret exigé", () => {
    const config = Object.assign({}, lireConfigBotDiscord_(), { relaisSecret: "secret-volontairement-faux" });
    try {
      appelerDiscordBot_(config, "/users/@me");
    } catch (e) {
      if (e.relais === "secret") return "le relais refuse un secret faux";
      throw e;
    }
    throw new Error("le relais accepte un secret faux : le redéployer depuis relais-discord/worker.js.");
  });
  etape("Bot", () => {
    const bot = appelerDiscordBot_(lireConfigBotDiscord_(), "/users/@me");
    return bot.username + " (" + bot.id + ")";
  });
  etape("Routes fermées", () => {
    try {
      appelerDiscordBot_(lireConfigBotDiscord_(), "/applications/@me");
    } catch (e) {
      if (e.relais === "refus") return "le relais refuse une route hors de sa liste";
      throw e;
    }
    throw new Error("le relais laisse passer une route hors de sa liste : le redéployer depuis relais-discord/worker.js.");
  });
  // Serveurs où le bot se trouve vraiment : départage une invitation manquée
  // ou faite avec une autre application, et un DISCORD_GUILD_ID erroné.
  etape("Serveurs du bot", () => {
    const config = lireConfigBotDiscord_();
    const serveurs = appelerDiscordBot_(config, "/users/@me/guilds") || [];
    const liste = serveurs.map(s => s.name + " (" + s.id + ")").join(", ");
    if (!serveurs.length) {
      throw new Error("le bot n'est sur aucun serveur : l'inviter avec le lien d'invitation de cette application.");
    }
    if (!serveurs.some(s => String(s.id) === config.guildId)) {
      throw new Error("DISCORD_GUILD_ID (" + config.guildId + ") ne désigne aucun d'eux. Le bot est sur : " + liste + ".");
    }
    return liste;
  });
  etape("Serveur", () => {
    const config = lireConfigBotDiscord_();
    return appelerDiscordBot_(config, "/guilds/" + config.guildId, {
      403: "Discord refuse l'accès au serveur : le bot n'y est pas, ou DISCORD_GUILD_ID désigne un autre serveur."
    }).name;
  });
  etape("Membres", () => {
    const config = lireConfigBotDiscord_();
    const lot = appelerDiscordBot_(config, "/guilds/" + config.guildId + "/members?limit=5") || [];
    return lot.length + " lus sur un échantillon de cinq";
  });
  etape("Synchronisation des rôles", () => {
    const mode = modeSynchroDiscord_(props);
    const dernier = lireJsonDiscord_(props.getProperty("DISCORD_SYNCHRO_RAPPORT") || "");
    return (mode ? "DISCORD_SYNCHRO " + mode : "coupée (DISCORD_SYNCHRO absent)") +
      (dernier ? ", dernier passage " + dernier.date + " en " + dernier.mode + " : " + dernier.prevues +
        " opération(s) prévue(s), " + dernier.ajouts + " ajout(s), " + dernier.retraits + " retrait(s), " +
        (dernier.pseudos || 0) + " pseudo(s), " +
        dernier.erreurs + " erreur(s), " + dernier.anomalies + " anomalie(s) de la feuille" : ", aucun passage encore");
  });
  etape("Connexion", () => {
    const config = lireConfigConnexionDiscord_();
    if (!urlAutorisationDiscord_(props)) {
      throw new Error("DISCORD_CLIENT_ID ou DISCORD_REDIRECT_URI mal formé (identifiant Discord et adresse https attendus).");
    }
    return "configurée" +
      (/\/exec$/.test(config.redirectUri) ? "" : " — attention, l'adresse de retour ne se termine pas par /exec") +
      ", AUTH_DISCORD " + (connexionDiscordActive_(props) ? "ACTIF" : "inactif (bouton caché)");
  });

  console.log("Diagnostic Discord\n" + lignes.join("\n"));
}


/*
  Membres du serveur tels que Discord les décrit (compte, surnom, rôles), bots
  compris, par pages de mille ; vingt pages couvrent largement le serveur.
  Partagé par la liste des fiches et la synchronisation des rôles.
*/
function lireMembresServeurDiscord_(config) {
  const membres = [];
  let apres = "0";

  for (let page = 0; page < 20; page++) {
    const lot = appelerDiscordBot_(
      config,
      "/guilds/" + config.guildId + "/members?limit=1000&after=" + apres
    ) || [];

    lot.forEach(membre => {
      if (membre && membre.user && DISCORD_ID_MOTIF.test(String(membre.user.id))) membres.push(membre);
    });

    if (lot.length < 1000) break;
    apres = String(lot[lot.length - 1].user.id);
  }

  return membres;
}


function lireConfigBotDiscord_() {
  const props = PropertiesService.getScriptProperties();
  const relaisUrl = String(props.getProperty("DISCORD_RELAIS_URL") || "").trim().replace(/\/+$/, "");
  const relaisSecret = String(props.getProperty("DISCORD_RELAIS_SECRET") || "");
  const guildId = String(props.getProperty("DISCORD_GUILD_ID") || "").trim();

  if (!relaisUrl || !relaisSecret || !guildId) {
    throw new Error(
      "Le bot Discord n'est pas configuré : renseigner DISCORD_RELAIS_URL, DISCORD_RELAIS_SECRET et DISCORD_GUILD_ID dans les propriétés du script (voir relais-discord/README.md)."
    );
  }

  if (!/^https:\/\/[^/?#]+$/.test(relaisUrl)) {
    throw new Error("DISCORD_RELAIS_URL doit être l'adresse https du relais, sans chemin (https://….workers.dev).");
  }

  if (!DISCORD_ID_MOTIF.test(guildId)) {
    throw new Error("DISCORD_GUILD_ID n'est pas un identifiant de serveur Discord.");
  }

  return { relaisUrl, relaisSecret, guildId };
}


/*
  Appel du bot, par le relais. `requete` porte la méthode et le corps JSON
  des écritures (rôles, pseudo) et la raison inscrite au journal d'audit de
  Discord.
*/
function appelerDiscordBot_(config, chemin, messages, requete) {
  const options = requete || {};
  const headers = { "X-Relais-Secret": config.relaisSecret };
  if (options.raison) headers["X-Audit-Log-Reason"] = encodeURIComponent(options.raison);

  return appelerDiscord_(chemin, {
    base: config.relaisUrl,
    relais: true,
    method: options.method,
    payload: options.corps === undefined ? undefined : JSON.stringify(options.corps),
    contentType: options.corps === undefined ? undefined : "application/json",
    headers
  }, messages);
}


/*
  Appel à l'API REST, directement ou par le relais (`options.base`). Une
  limitation courte (cinq secondes au plus) est attendue puis rejouée une fois ;
  toute autre erreur remonte avec un message en français, sans jamais citer un
  jeton ni un secret. `messages` remplace le message d'un code HTTP pour
  l'appel concerné ; une fonction y reçoit le corps de la réponse.
*/
function appelerDiscord_(chemin, options, messages) {
  const requete = {
    method: options.method || "get",
    headers: options.headers || {},
    muteHttpExceptions: true
  };
  if (options.payload !== undefined) requete.payload = options.payload;
  if (options.contentType) requete.contentType = options.contentType;

  for (let essai = 0; essai < 2; essai++) {
    const reponse = UrlFetchApp.fetch((options.base || DISCORD_API) + chemin, requete);
    const code = reponse.getResponseCode();
    const texte = reponse.getContentText();

    if (code >= 200 && code < 300) {
      return texte ? JSON.parse(texte) : null;
    }

    const corps = lireJsonDiscord_(texte);
    const attente = corps ? Number(corps.retry_after) : NaN;

    if (code === 429 && essai === 0 && attente >= 0 && attente <= 5) {
      Utilities.sleep(Math.ceil(attente * 1000) + 100);
      continue;
    }

    /*
      Les refus du relais lui-même (secret, route, configuration, réseau) et
      les refus réseau de Discord (40333) n'ont rien à voir avec les causes
      que décrivent les messages propres à l'appel : ils gardent le leur.
    */
    const relais = options.relais && corps && corps.relais ? String(corps.relais) : "";
    const bloque = Boolean(corps) && Number(corps.code) === 40333;
    const muet = options.relais && !corps && code !== 429;
    const propre = !relais && !bloque && !muet && messages && messages[code];
    const erreur = new Error(
      relais ? messageRelaisDiscord_(relais, corps)
        : muet ? "Le relais Discord ne répond pas comme prévu (HTTP " + code + ") : vérifier DISCORD_RELAIS_URL et que le relais est déployé."
        : typeof propre === "function" ? propre(corps)
        : propre || messageErreurDiscord_(code, corps)
    );
    if (relais) erreur.relais = relais;
    erreur.statut = code;

    /*
      Réponse brute de Discord, pour le diagnostic de l'éditeur seulement :
      code HTTP, message et code d'erreur Discord, ou début d'une page qui
      n'est pas du JSON (Cloudflare). Discord n'y renvoie aucun secret.
    */
    erreur.detailDiscord = "HTTP " + code + (corps
      ? (corps.message ? " — " + corps.message : "") + (corps.code ? " (code " + corps.code + ")" : "")
      : texte ? " — " + String(texte).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) : "");

    throw erreur;
  }

  throw new Error(messageErreurDiscord_(429, null));
}


function lireJsonDiscord_(texte) {
  try {
    return JSON.parse(texte);
  } catch (e) {
    return null;
  }
}


/*
  Refus émis par le relais lui-même (`relais-discord/worker.js`), reconnus à
  leur champ `relais`.
*/
function messageRelaisDiscord_(type, corps) {
  if (type === "secret") {
    return "Le relais Discord refuse le secret : DISCORD_RELAIS_SECRET doit être identique au secret RELAIS_SECRET du relais.";
  }
  if (type === "refus") {
    return "Le relais Discord n'autorise pas cette requête.";
  }
  if (type === "reseau") {
    return "Discord est injoignable depuis le relais. Réessayer plus tard.";
  }
  return "Le relais Discord est mal configuré : " + String((corps && corps.message) || type);
}


/*
  Un 429 sans corps JSON est une page de Cloudflare : Discord bloque alors les
  adresses de Google, partagées avec d'autres scripts, et non ce seul projet.
*/
function messageErreurDiscord_(code, corps) {
  if (corps && Number(corps.code) === 40333) {
    return "Discord bloque cette requête (refus réseau, code 40333). Saisir l'identifiant Discord à la main.";
  }
  if (code === 429 && !corps) {
    return "Discord bloque temporairement les requêtes venant des serveurs de Google. Réessayer plus tard.";
  }
  if (code === 429) {
    return "Discord limite les requêtes : réessayer dans " + Math.ceil(Number(corps.retry_after) || 1) + " s.";
  }
  if (code === 401) {
    return "Discord refuse le jeton du bot : vérifier le secret DISCORD_BOT_TOKEN du relais.";
  }
  if (corps && Number(corps.code) === 50013) {
    return "Discord refuse, faute de permission : le rôle du bot doit être placé au-dessus du rôle visé et du membre, avec « Gérer les rôles » et « Gérer les pseudos ».";
  }
  if (code === 403) {
    return "Discord refuse l'accès au bot : vérifier qu'il est invité sur le serveur et que « Server Members Intent » est activé.";
  }
  if (code === 404) {
    return "Serveur Discord introuvable : vérifier DISCORD_GUILD_ID et que le bot y a été invité.";
  }
  return "Discord a répondu " + code + (corps && corps.message ? " : " + corps.message : "") + ".";
}


// ============================================================
// RATTACHEMENT — colonne Effectifs « ID Discord »
// ============================================================

function trouverColonneDiscordEffectifs_(headers) {
  return headers.findIndex(
    header => normaliserEffectifsWeb_(header) === "id discord"
  );
}


/*
  Liens d'un bloc `Effectifs` déjà lu par getValues(), ligne 2 en tête. Pour
  chaque ligne : { id, anomalie }. Seules les lignes nommées comptent.

  Un lien ne vaut que s'il a un `id` et aucune `anomalie`. Un compte relié à
  deux membres est signalé sur les deux et ne vaut pour aucun : le registre ne
  choisit pas entre eux.
*/
function lireLiensDiscordEffectifs_(valeurs, schema, colonne) {
  const liens = valeurs.map(() => ({ id: "", anomalie: "" }));
  if (colonne < 0) return liens;

  const parId = new Map();

  valeurs.forEach((ligne, index) => {
    if (!nomLigneEffectifsDiscord_(ligne, schema)) return;

    const brut = ligne[colonne];
    if (brut === "" || brut === null || brut === undefined) return;

    if (typeof brut === "number") {
      liens[index].anomalie =
        "Identifiant Discord enregistré comme nombre : Sheets en a arrondi les derniers chiffres. Rattacher le compte de nouveau.";
      return;
    }

    const id = String(brut).trim();
    if (!id) return;

    if (!DISCORD_ID_MOTIF.test(id)) {
      liens[index].anomalie = "Identifiant Discord illisible : 17 à 20 chiffres attendus.";
      return;
    }

    liens[index].id = id;
    if (!parId.has(id)) parId.set(id, []);
    parId.get(id).push(index);
  });

  parId.forEach(indices => {
    if (indices.length < 2) return;
    indices.forEach(index => {
      const autres = indices
        .filter(autre => autre !== index)
        .map(autre => nomLigneEffectifsDiscord_(valeurs[autre], schema));
      liens[index].anomalie =
        "Même compte Discord que " + autres.join(", ") + " : ce lien ne vaut pour personne.";
    });
  });

  return liens;
}


function nomLigneEffectifsDiscord_(ligne, schema) {
  return (
    nettoyerEffectifsWeb_(ligne[schema.prenom]) + " " +
    nettoyerEffectifsWeb_(ligne[schema.nom])
  ).trim();
}


/*
  Écrit ou retire le lien d'une ligne ; `discordId` vide le retire.

  Appelé par `modifierEffectifInterne_`, sous le verrou des mutations
  d'Effectifs et après le contrôle d'identité de la ligne, avant toute autre
  écriture : un compte déjà pris arrête l'enregistrement sans rien écrire.
*/
function ecrireLienDiscordEffectif_(sheet, schema, row, discordId) {
  const id = nettoyerEffectifsWeb_(discordId);

  if (id && !DISCORD_ID_MOTIF.test(id)) {
    throw new Error("Identifiant Discord invalide : 17 à 20 chiffres attendus.");
  }

  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  let colonne = trouverColonneDiscordEffectifs_(headers);

  if (colonne < 0) {
    if (!id) return;
    colonne = creerColonneDiscordEffectifs_(sheet, lastColumn);
  }

  if (id) {
    const lastRow = sheet.getLastRow();
    const valeurs = lastRow >= 2
      ? sheet.getRange(2, 1, lastRow - 1, Math.max(lastColumn, colonne + 1)).getValues()
      : [];
    const liens = lireLiensDiscordEffectifs_(valeurs, schema, colonne);
    const autre = liens.findIndex(
      (lien, index) => index !== row - 2 && lien.id === id
    );

    if (autre >= 0) {
      throw new Error(
        "Ce compte Discord est déjà rattaché à " +
        nomLigneEffectifsDiscord_(valeurs[autre], schema) + "."
      );
    }
  }

  sheet.getRange(row, colonne + 1).setNumberFormat("@").setValue(id);
}


/*
  Colonne technique ajoutée après la dernière colonne utilisée, comme
  `ID membre`, au format texte sur toute sa hauteur.
*/
function creerColonneDiscordEffectifs_(sheet, lastColumn) {
  const numero = lastColumn + 1;

  if (sheet.getMaxColumns() < numero) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), numero - sheet.getMaxColumns());
  }

  sheet
    .getRange(1, numero)
    .setValue(EFFECTIFS_DISCORD_ENTETE)
    .setNote(
      "Compte Discord du membre, rattaché par un officier depuis le registre. " +
      "Texte de 17 à 20 chiffres, jamais un nombre. Inclure cette colonne dans les tris de lignes."
    );

  sheet
    .getRange(2, numero, Math.max(1, sheet.getMaxRows() - 1), 1)
    .setNumberFormat("@");

  return numero - 1;
}


/*
  Une ligne réemployée pour un nouveau membre ne doit pas hériter du compte
  Discord d'un autre : `ajouterEffectifInterne_` vide la case avant d'écrire.
*/
function effacerLienDiscordLigne_(sheet, row) {
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const colonne = trouverColonneDiscordEffectifs_(headers);
  if (colonne >= 0) sheet.getRange(row, colonne + 1).clearContent();
}


/*
  Une ligne dont le prénom et le nom ont été effacés à la main perd son lien,
  comme elle perd son `ID membre` : appelé par la synchronisation de
  l'historique, sur les seules cases à vider, une par une.
*/
function effacerLiensDiscordOrphelins_(sheet, headers, valeurs, schema) {
  const colonne = trouverColonneDiscordEffectifs_(headers);
  if (colonne < 0) return;

  valeurs.forEach((ligne, index) => {
    if (nomLigneEffectifsDiscord_(ligne, schema)) return;
    if (String(ligne[colonne] || "").trim()) {
      sheet.getRange(index + 2, colonne + 1).clearContent();
    }
  });
}


// ============================================================
// CONNEXION — identité Discord, accès déduit de la fiche
// ============================================================

/*
  Seuil OFFICIER (décision du propriétaire, 11 octobre 2026) : Sergent-Chef et
  tout grade placé au-dessus dans `Données!A2:A`, sans exception de corps. Une
  constante du code plutôt qu'une cellule : changer qui devient officier passe
  par une relecture du `git diff`.
*/
const DISCORD_SEUIL_OFFICIER = "Sergent-Chef";

/*
  Table d'accès, propriété du script : identifiant Discord → « O|xxxxxxxx » ou
  « G|xxxxxxxx » (initiale du rôle, huit premiers caractères de l'ID membre).
  `verifyAuthToken` la relit à chaque appel d'une session Discord : une fiche
  rétrogradée, passée en réserve, partie ou déliée ferme sa session à l'appel
  suivant. Recalculée à chaque synchronisation de l'historique des Effectifs
  (pages, modifications par l'application, déclencheur des éditions à la
  main) et à chaque connexion. Environ 250 comptes tiennent dans une
  propriété de 9 Ko.
*/
const DISCORD_PROPRIETE_ACCES = "DISCORD_ACCES";


function urlAutorisationDiscord_(props) {
  const clientId = String(props.getProperty("DISCORD_CLIENT_ID") || "").trim();
  const redirectUri = String(props.getProperty("DISCORD_REDIRECT_URI") || "").trim();
  if (!DISCORD_ID_MOTIF.test(clientId) || !/^https:\/\//.test(redirectUri)) return "";

  // `identify` seul : le registre ne lit ni les serveurs ni les rôles du membre.
  // `prompt=none` saute l'écran d'accord quand il a déjà été donné.
  return "https://discord.com/oauth2/authorize" +
    "?response_type=code" +
    "&client_id=" + clientId +
    "&scope=identify" +
    "&prompt=none" +
    "&redirect_uri=" + encodeURIComponent(redirectUri);
}


function lireConfigConnexionDiscord_() {
  const props = PropertiesService.getScriptProperties();
  const config = {
    clientId: String(props.getProperty("DISCORD_CLIENT_ID") || "").trim(),
    clientSecret: String(props.getProperty("DISCORD_CLIENT_SECRET") || "").trim(),
    redirectUri: String(props.getProperty("DISCORD_REDIRECT_URI") || "").trim()
  };

  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new Error(
      "La connexion Discord n'est pas configurée : renseigner DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET et DISCORD_REDIRECT_URI dans les propriétés du script."
    );
  }

  return config;
}


/*
  Échange le code reçu au retour de Discord contre l'identité du compte. Le
  jeton d'accès Discord ne sert qu'à cette lecture : il n'est ni gardé ni
  transmis au navigateur.
*/
function identifierCompteDiscord_(code) {
  const valeur = String(code || "").trim();

  if (!/^[A-Za-z0-9]{10,100}$/.test(valeur)) {
    throw new Error("Code de connexion Discord invalide : recommencer la connexion.");
  }

  const config = lireConfigConnexionDiscord_();

  const jeton = appelerDiscord_("/oauth2/token", {
    method: "post",
    payload: {
      grant_type: "authorization_code",
      code: valeur,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret
    }
  }, {
    400: corps => /redirect_uri/i.test(String(corps && corps.error_description))
      ? "L'adresse de retour ne correspond pas : DISCORD_REDIRECT_URI doit être identique à l'adresse déclarée dans le portail Discord (OAuth2 > Redirects)."
      : "Code de connexion Discord expiré ou déjà utilisé : recommencer la connexion.",
    401: "Discord refuse l'application : vérifier DISCORD_CLIENT_ID et DISCORD_CLIENT_SECRET."
  });

  if (!jeton || !jeton.access_token) {
    throw new Error("Discord n'a pas confirmé la connexion : recommencer.");
  }

  const user = appelerDiscord_("/users/@me", {
    headers: { Authorization: "Bearer " + jeton.access_token }
  }, {
    401: "Discord n'a pas confirmé votre identité : recommencer la connexion."
  });

  if (!user || !DISCORD_ID_MOTIF.test(String(user.id))) {
    throw new Error("Discord n'a pas renvoyé d'identifiant de compte.");
  }

  return {
    id: String(user.id),
    pseudo: String(user.username || ""),
    nom: String(user.global_name || user.username || "")
  };
}


/*
  Rôle ouvert par une fiche : "OFFICIER", "GARDE" ou "" (aucun accès). Le
  statut prime : seul le service actif ouvre le registre ; réserve, départ et
  tout autre statut, faute de saisie comprise, n'ouvrent rien. Un grade absent
  de `Données!A` ouvre une session GARDE : une erreur ne donne jamais les
  droits d'officier. Le grade régulier fait foi, jamais l'alias.
*/
function roleRegistreDiscord_(statut, grade, ordreGrades) {
  if (normaliserEffectifsWeb_(statut) !== normaliserEffectifsWeb_(EFFECTIFS_WEB_ACTIVE_STATUS)) {
    return "";
  }

  const seuil = ordreGrades.indexOf(cleGradeDiscord_(DISCORD_SEUIL_OFFICIER));
  const rang = ordreGrades.indexOf(cleGradeDiscord_(grade));

  return seuil >= 0 && rang >= 0 && rang <= seuil ? "OFFICIER" : "GARDE";
}


// « Sergent-Chef », « sergent chef » et « SERGENT-CHEF » désignent le même grade.
function cleGradeDiscord_(grade) {
  return normaliserEffectifsWeb_(grade).replace(/[^a-z0-9]/g, "");
}


// Grades de `Données!A2:A`, du plus haut au plus bas, en clés normalisées.
function lireOrdreGradesDiscord_(ss) {
  const donnees = ss.getSheetByName(EFFECTIFS_WEB_DONNEES_SHEET_NAME);
  if (!donnees || donnees.getLastRow() < 2) return [];

  return donnees
    .getRange(2, 1, donnees.getLastRow() - 1, 1)
    .getDisplayValues()
    .map(ligne => cleGradeDiscord_(ligne[0]))
    .filter(Boolean);
}


/*
  Comptes rattachés : identifiant Discord → { membre, role, statut, grade,
  corps, nom }, ou { anomalie } pour un compte relié à plusieurs fiches. `values` est le bloc
  `Effectifs` lu par la synchronisation (ligne 2 en tête), ID membre à jour
  en colonne `idIndex` ; la colonne Discord est relue en valeurs brutes, un
  nombre y trahissant un identifiant arrondi.
*/
function indexerAccesDiscord_(ss, sheet, schema, values, idIndex, headers) {
  const index = new Map();
  const colonne = trouverColonneDiscordEffectifs_(headers);
  if (colonne < 0 || !values.length) return index;

  const bruts = sheet.getRange(2, colonne + 1, values.length, 1).getValues();
  const lignes = values.map((ligne, i) => {
    const copie = ligne.slice();
    copie[colonne] = bruts[i][0];
    return copie;
  });
  const liens = lireLiensDiscordEffectifs_(lignes, schema, colonne);
  const ordre = lireOrdreGradesDiscord_(ss);

  liens.forEach((lien, i) => {
    if (!lien.id) return;
    if (lien.anomalie) {
      index.set(lien.id, { anomalie: lien.anomalie });
      return;
    }
    const ligne = values[i];
    index.set(lien.id, {
      membre: String(ligne[idIndex] || "").trim(),
      role: roleRegistreDiscord_(ligne[schema.status], ligne[schema.grade], ordre),
      statut: nettoyerEffectifsWeb_(ligne[schema.status]),
      grade: nettoyerEffectifsWeb_(ligne[schema.grade]),
      corps: nettoyerEffectifsWeb_(ligne[schema.corps]),
      nom: nomLigneEffectifsDiscord_(ligne, schema)
    });
  });

  return index;
}


function entreeAccesDiscord_(role, membre) {
  return String(role || "").charAt(0) + "|" + String(membre || "").slice(0, 8);
}


function lireTableAccesDiscord_(props) {
  try {
    const table = JSON.parse(props.getProperty(DISCORD_PROPRIETE_ACCES) || "{}");
    return table && typeof table === "object" ? table : {};
  } catch (e) {
    return {};
  }
}


/*
  Recalcule la table d'accès et ne l'écrit que si elle a changé. Une table
  trop grande pour une propriété est effacée plutôt que de bloquer la
  synchronisation : les sessions Discord sont alors refusées, les codes
  restent disponibles.
*/
function mettreAJourAccesDiscord_(ss, sheet, schema, values, idIndex, headers) {
  const index = indexerAccesDiscord_(ss, sheet, schema, values, idIndex, headers);
  const table = {};

  Array.from(index.keys()).sort().forEach(id => {
    const acces = index.get(id);
    if (acces.role && acces.membre) table[id] = entreeAccesDiscord_(acces.role, acces.membre);
  });

  const texte = JSON.stringify(table);
  const props = PropertiesService.getScriptProperties();

  if (props.getProperty(DISCORD_PROPRIETE_ACCES) !== texte) {
    try {
      props.setProperty(DISCORD_PROPRIETE_ACCES, texte);
    } catch (e) {
      console.error("Table d'accès Discord non enregistrée : " + e.message);
      props.deleteProperty(DISCORD_PROPRIETE_ACCES);
    }
  }

  return index;
}


/*
  Fiche du compte qui se connecte. La synchronisation complète de l'historique
  attribue au besoin l'ID membre et recalcule la table d'accès : le jeton
  délivré est donc vérifiable dès l'appel suivant.
*/
function accesCompteDiscord_(compte) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const acces = synchroniserHistoriqueEffectifs_(ss).accesDiscord.get(compte.id);

  if (!acces) {
    throw new Error(
      "Ce compte Discord (" + (compte.pseudo ? "@" + compte.pseudo + ", " : "") +
      "identifiant " + compte.id + ") n'est rattaché à aucun membre de la Garde. " +
      "Transmettre cet identifiant à un officier."
    );
  }

  if (acces.anomalie) {
    throw new Error("Ce compte Discord est rattaché à plusieurs fiches : un officier doit corriger les Effectifs.");
  }

  if (!acces.role) {
    throw new Error(
      "Votre fiche (statut « " + (acces.statut || "sans statut") + " ») ne donne pas accès au registre."
    );
  }

  const table = lireTableAccesDiscord_(PropertiesService.getScriptProperties());
  if (table[compte.id] !== entreeAccesDiscord_(acces.role, acces.membre)) {
    throw new Error("Table d'accès Discord indisponible : utiliser le code d'accès et prévenir le propriétaire.");
  }

  return acces;
}
