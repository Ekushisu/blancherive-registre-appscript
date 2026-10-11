/*
  Relais Discord du registre de la Garde de Blancherive (Cloudflare Workers).

  Pourquoi : Discord refuse les appels de bot dont l'en-tête User-Agent
  ressemble à celui d'un navigateur (403, « internal network error », code
  40333). Apps Script impose le sien, « Mozilla/5.0 (compatible;
  Google-Apps-Script…) », et ne le laisse pas remplacer (constaté le
  11 octobre 2026). Le registre passe donc par ce relais pour les appels du
  bot ; la connexion des membres (OAuth) n'y passe pas.

  Sécurité :
  - le registre s'authentifie par l'en-tête `X-Relais-Secret`, comparé en
    temps constant au secret `RELAIS_SECRET` ;
  - le jeton du bot ne vit qu'ici, en secret Cloudflare : Apps Script ne le
    détient plus ;
  - liste fermée de routes, toutes limitées au serveur `DISCORD_GUILD_ID` :
    lecture du bot, du serveur, des rôles et des membres ; ajout et retrait
    d'un rôle ; pseudo d'un membre, et rien d'autre dans la même requête.
    Ni bannissement, ni expulsion, ni message, ni salon.
  Le rôle du bot, placé sous les rôles d'administration du serveur, borne le
  reste : Discord interdit à un bot de donner un rôle placé au-dessus du sien.

  Secrets Cloudflare (Settings > Variables and Secrets, type Secret) :
  DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, RELAIS_SECRET (32 caractères au moins).

  Mise en ligne : voir README.md de ce dossier. Ce fichier ne part pas avec
  `clasp push` ; il se redéploie à la main sur Cloudflare.
*/

const DISCORD_API = "https://discord.com/api/v10";
const USER_AGENT = "DiscordBot (https://script.google.com, 1.0)";
const SNOWFLAKE = "\\d{17,20}";
const SECRET_MINIMUM = 32;

// En-têtes de Discord rendus au registre : limitation de débit, type.
const ENTETES_RENDUS = [
  "content-type", "retry-after", "x-ratelimit-limit", "x-ratelimit-remaining",
  "x-ratelimit-reset", "x-ratelimit-reset-after", "x-ratelimit-bucket",
  "x-ratelimit-global", "x-ratelimit-scope"
];

export default {
  async fetch(request, env) {
    // Le secret d'abord : un inconnu n'apprend rien d'autre de la configuration.
    const secret = String(env.RELAIS_SECRET || "");
    if (secret.length < SECRET_MINIMUM) {
      return refus(500, "Secret RELAIS_SECRET manquant ou trop court (" + SECRET_MINIMUM + " caractères au moins).", "config");
    }
    if (!(await secretValide(request.headers.get("X-Relais-Secret"), secret))) {
      return refus(401, "Secret du relais absent ou invalide.", "secret");
    }

    const config = lireConfig(env);
    if (config.erreur) return refus(500, config.erreur, "config");

    const url = new URL(request.url);
    const route = trouverRoute(request.method, url, config.guildId);
    if (!route) return refus(403, "Requête non autorisée par le relais.", "refus");

    const transmise = {
      method: request.method,
      headers: {
        Authorization: "Bot " + config.botToken,
        "User-Agent": USER_AGENT
      }
    };

    const raison = request.headers.get("X-Audit-Log-Reason");
    if (raison) transmise.headers["X-Audit-Log-Reason"] = raison.slice(0, 512);

    if (route.pseudo) {
      const corps = await lirePseudo(request);
      if (!corps) return refus(403, "Seul le pseudo d'un membre peut être modifié.", "refus");
      transmise.headers["Content-Type"] = "application/json";
      transmise.body = JSON.stringify(corps);
    }

    let reponse;
    try {
      reponse = await fetch(DISCORD_API + url.pathname + url.search, transmise);
    } catch (e) {
      return refus(502, "Discord injoignable depuis le relais.", "reseau");
    }

    const entetes = new Headers();
    ENTETES_RENDUS.forEach(nom => {
      const valeur = reponse.headers.get(nom);
      if (valeur !== null) entetes.set(nom, valeur);
    });
    // Ajout et retrait d'un rôle répondent 204 : une telle réponse n'a pas de corps.
    const sansCorps = [101, 204, 205, 304].includes(reponse.status);
    return new Response(sansCorps ? null : await reponse.text(), { status: reponse.status, headers: entetes });
  }
};


function lireConfig(env) {
  const botToken = String(env.DISCORD_BOT_TOKEN || "").trim();
  const guildId = String(env.DISCORD_GUILD_ID || "").trim();

  if (!botToken) return { erreur: "Secret DISCORD_BOT_TOKEN manquant sur le relais." };
  if (!new RegExp("^" + SNOWFLAKE + "$").test(guildId)) {
    return { erreur: "Secret DISCORD_GUILD_ID manquant ou invalide sur le relais." };
  }
  return { botToken, guildId };
}


/*
  Comparaison en temps constant : les deux valeurs sont d'abord réduites à
  leur empreinte SHA-256, de même longueur, puis comparées octet par octet
  sans sortie anticipée.
*/
async function secretValide(recu, attendu) {
  if (!recu) return false;
  const encodeur = new TextEncoder();
  const [a, b] = await Promise.all([recu, attendu].map(valeur =>
    crypto.subtle.digest("SHA-256", encodeur.encode(valeur))));
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < x.length; i++) difference |= x[i] ^ y[i];
  return difference === 0;
}


/*
  Routes ouvertes, toutes sur le seul serveur de la Garde (sauf les deux
  lectures du compte du bot, qui servent au diagnostic). Paramètres d'adresse
  admis : `limit` et `after` pour la liste des membres, rien ailleurs.
*/
function trouverRoute(methode, url, guildId) {
  const g = "/guilds/" + guildId;
  const routes = [
    { methode: "GET", motif: "^/users/@me$" },
    { methode: "GET", motif: "^/users/@me/guilds$" },
    { methode: "GET", motif: "^" + g + "$" },
    { methode: "GET", motif: "^" + g + "/roles$" },
    { methode: "GET", motif: "^" + g + "/members$", parametres: { limit: /^([1-9]\d{0,2}|1000)$/, after: /^(0|\d{17,20})$/ } },
    { methode: "GET", motif: "^" + g + "/members/" + SNOWFLAKE + "$" },
    { methode: "PUT", motif: "^" + g + "/members/" + SNOWFLAKE + "/roles/" + SNOWFLAKE + "$" },
    { methode: "DELETE", motif: "^" + g + "/members/" + SNOWFLAKE + "/roles/" + SNOWFLAKE + "$" },
    { methode: "PATCH", motif: "^" + g + "/members/" + SNOWFLAKE + "$", pseudo: true }
  ];

  const route = routes.find(r => r.methode === methode && new RegExp(r.motif).test(url.pathname));
  if (!route) return null;

  const admis = route.parametres || {};
  for (const [nom, valeur] of url.searchParams) {
    if (!admis[nom] || !admis[nom].test(valeur)) return null;
  }
  return route;
}


/*
  Corps d'un PATCH de membre : `{ "nick": "…" }` seul, 32 caractères au plus,
  ou `null` pour effacer le pseudo. Tout autre champ (rôles, sourdine,
  exclusion temporaire…) fait refuser la requête.
*/
async function lirePseudo(request) {
  let corps;
  try {
    corps = await request.json();
  } catch (e) {
    return null;
  }
  if (!corps || typeof corps !== "object" || Array.isArray(corps)) return null;
  const cles = Object.keys(corps);
  if (cles.length !== 1 || cles[0] !== "nick") return null;
  const nick = corps.nick;
  if (nick !== null && (typeof nick !== "string" || !nick.trim() || [...nick].length > 32)) return null;
  return { nick };
}


function refus(statut, message, relais) {
  return new Response(JSON.stringify({ message, relais }), {
    status: statut,
    headers: { "content-type": "application/json" }
  });
}
