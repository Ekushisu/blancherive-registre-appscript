/*
  Rôle public, obtenu sans mot de passe.

  ATTENTION — la Web App s'exécute avec le compte du propriétaire et en accès
  anonyme : toute personne qui charge la page peut appeler n'importe quelle
  fonction serveur. Le seul rempart est `requireRole()`. Jusqu'ici, ne pas
  connaître de mot de passe suffisait à bloquer l'accès ; ce n'est plus vrai dès
  lors qu'un jeton s'obtient sans condition.

  Conséquence : `VISITEUR` ne doit figurer que dans la liste de rôles de
  `getCodex`. L'ajouter ailleurs rendrait la fonction concernée entièrement
  publique, sans que rien ne le signale. `scripts/test-acces-public.mjs` échoue
  si ce rôle apparaît dans une autre fonction.

  Pour la même raison, toute fonction qui fabrique un jeton finit par `_` :
  `google.script.run` n'atteint pas les fonctions privées. Seules `login`,
  `ouvrirSessionPublique` et `ouvrirSessionDiscord` délivrent un jeton au
  navigateur, et chacune décide elle-même du rôle ; `getSessionInfo` ne fait
  que prolonger une session Discord déjà vérifiée, à l'identique. `scripts/test-auth-codes.mjs`
  vérifie la liste des fonctions publiques de ce fichier et qu'aucune autre
  fonction du dépôt n'appelle `createAuthToken_`.
*/
const ROLE_PUBLIC = "VISITEUR";

/*
  Codes communs.

  Chaque rôle de service a un code partagé, rangé dans `PASSWORD_<RÔLE>`. La
  connexion Discord ne les remplace pas : ils restent le mode de secours si le
  serveur Discord est coupé, changé ou indisponible, et l'accès de ceux qui n'y
  sont pas encore passés. L'intendance — argentier de la cour, Thanes,
  cuisines — n'est pas sur le Discord de la garde : son code reste son seul
  accès.

  `AUTH_CODES` liste les rôles dont le code est accepté, séparés par des
  virgules (`GARDE,OFFICIER,INTENDANT`). Propriété absente : les trois codes,
  comme avant son introduction. Un mot qui ne nomme aucun rôle — `AUCUN`, une
  faute de frappe — n'ouvre rien : une erreur de saisie ferme, elle n'ouvre pas.

  Cet interrupteur ne vit que dans les propriétés du script. Dans
  l'application, il serait hors d'atteinte le jour où Discord et les codes sont
  coupés ensemble ; dans le classeur, tout éditeur de la feuille pourrait
  rouvrir les codes.

  Ordre de test : du plus au moins privilégié, afin que le résultat reste
  déterministe si deux codes ont été réglés à la même valeur par erreur.
*/
const ROLES_CODE = ["OFFICIER", "GARDE", "INTENDANT"];

/*
  Durée des sessions (demande du propriétaire, 11 octobre 2026 : plus de
  24 heures). Le navigateur garde le jeton d'une ouverture à l'autre ; seule
  la déconnexion l'efface.
  - Code commun : trois jours, sans prolongation. Un code n'identifie
    personne : changer le code d'un rôle ferme les sessions ouvertes avec
    l'ancien (empreinte `cle` du jeton), le désactiver aussi.
  - Discord : trente jours, prolongés à chaque visite (`getSessionInfo`), au
    plus une fois par jour. Ces sessions se ferment une à une par la table
    d'accès (fiche rétrogradée, partie, déliée) ou `AUTH_DISCORD`.
  - Visiteur du Codex : deux heures.
  Changer `AUTH_SECRET` ferme toutes les sessions, quelle que soit leur durée.
*/
const DUREE_SESSION_CODE = 3 * 24 * 60 * 60 * 1000;
const DUREE_SESSION_DISCORD = 30 * 24 * 60 * 60 * 1000;
const RENOUVELLEMENT_SESSION_DISCORD = 24 * 60 * 60 * 1000;
const DUREE_SESSION_PUBLIQUE = 2 * 60 * 60 * 1000;

const LIBELLES_CODE = {
  OFFICIER: "des officiers",
  GARDE: "des gardes",
  INTENDANT: "de l'intendance"
};


/*
  Session de consultation du Codex, sans authentification.

  La durée est volontairement plus courte que celle d'une session de service :
  un visiteur consulte, il ne prend pas son service.
*/
function ouvrirSessionPublique() {
  return createAuthToken_(ROLE_PUBLIC, DUREE_SESSION_PUBLIQUE);
}


function login(password) {

  const props =
    PropertiesService.getScriptProperties();


  /*
    Une propriété absente ne correspond jamais, y compris à
    un mot de passe vide.
  */

  const correspond = role => {

    const code =
      props.getProperty("PASSWORD_" + role);

    return Boolean(code) && password === code;
  };


  /*
    Les rôles actifs sont testés avant les rôles désactivés :
    si le code d'un rôle coupé coïncide par erreur avec celui
    d'un rôle ouvert, c'est le rôle ouvert qui l'emporte.
  */

  const role =
    rolesCodeActifs_(props).find(correspond);

  if (role) {

    return createAuthToken_(
      role,
      DUREE_SESSION_CODE,
      "code",
      { cle: empreinteCode_(props, role) }
    );
  }


  /*
    Code juste mais désactivé : pendant la passation, « Mot de
    passe incorrect » ferait croire à une faute de frappe.
  */

  const desactive =
    ROLES_CODE.find(correspond);

  if (desactive) {

    throw new Error(
      messageCodeDesactive_(desactive)
    );
  }


  throw new Error(
    "Mot de passe incorrect."
  );
}


function rolesCodeActifs_(props) {

  const valeur =
    props.getProperty("AUTH_CODES");


  if (valeur === null) {

    return ROLES_CODE.slice();
  }


  const demandes =
    String(valeur)
      .split(",")
      .map(role => role.trim().toUpperCase());


  return ROLES_CODE.filter(
    role => demandes.includes(role)
  );
}


/*
  Empreinte du code en vigueur d'un rôle : signée par `AUTH_SECRET`, elle ne
  permet pas de retrouver le code, qui n'est jamais placé dans le jeton.
  Vide si le code ou le secret manque.
*/
function empreinteCode_(props, role) {

  const code =
    props.getProperty("PASSWORD_" + role);

  const secret =
    props.getProperty("AUTH_SECRET");

  if (!code || !secret) {

    return "";
  }


  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature("code:" + role + ":" + code, secret)
  ).slice(0, 16);
}


function messageCodeDesactive_(role) {

  return (
    "Le code " +
    LIBELLES_CODE[role] +
    " n'est plus accepté."
  );
}


/*
  Connexion par Discord (docs/AUTH_AND_ROLES.md).

  Discord ne prouve que l'identité : le rôle se déduit de la fiche
  `Effectifs` rattachée au compte (`accesCompteDiscord_`, Discord.js),
  jamais des rôles du serveur Discord.

  `AUTH_DISCORD` doit valoir `ACTIF`. Sinon le bouton reste caché, aucune
  session Discord ne s'ouvre et celles qui sont ouvertes sont refusées à
  l'appel suivant, comme un code désactivé. `AUTH_CODES` ne concerne pas
  les sessions Discord.
*/
function connexionDiscordActive_(props) {

  return (
    String(props.getProperty("AUTH_DISCORD") || "")
      .trim()
      .toUpperCase() === "ACTIF"
  );
}


/*
  Modes proposés par l'écran de connexion, avant toute session. Le code
  d'accès est toujours proposé : c'est l'accès de l'intendance et le
  secours. L'adresse d'autorisation Discord n'a rien de secret.
*/
function getModesConnexion() {

  const props =
    PropertiesService.getScriptProperties();

  const url =
    connexionDiscordActive_(props)
      ? urlAutorisationDiscord_(props)
      : "";

  return {
    discord: url ? { url: url } : null
  };
}


/*
  Retour de Discord : `code` est le code à usage unique transmis dans
  l'adresse. Le navigateur a déjà vérifié son `state`.
*/
function ouvrirSessionDiscord(code) {

  if (
    !connexionDiscordActive_(
      PropertiesService.getScriptProperties()
    )
  ) {

    throw new Error(
      "La connexion par Discord n'est pas ouverte : utiliser le code d'accès."
    );
  }


  const compte =
    identifierCompteDiscord_(code);

  const acces =
    accesCompteDiscord_(compte);


  return createAuthToken_(
    acces.role,
    DUREE_SESSION_DISCORD,
    "discord",
    {
      membre: acces.membre,
      discord: compte.id,
      nom: acces.nom
    }
  );
}


/*
  `via` indique comment le jeton a été obtenu : `code` pour un
  code commun, `discord` pour une connexion Discord, qui ajoute
  dans `extra` l'ID membre, l'identifiant Discord et le nom de la
  fiche. Le jeton public n'en porte pas.
*/
function createAuthToken_(role, dureeMs, via, extra) {

  const secret =
    PropertiesService
      .getScriptProperties()
      .getProperty("AUTH_SECRET");


  if (!secret) {

    throw new Error(
      "AUTH_SECRET n'est pas configuré."
    );
  }


  const payload = {

    role: role,

    exp:
      Date.now() +
      (dureeMs || 8 * 60 * 60 * 1000)

  };


  if (via) {

    payload.via = via;
  }


  Object.keys(extra || {}).forEach(cle => {

    payload[cle] = extra[cle];
  });


  const encodedPayload =
    Utilities.base64EncodeWebSafe(
      JSON.stringify(payload)
    );


  const signature =
    Utilities.computeHmacSha256Signature(
      encodedPayload,
      secret
    );


  const encodedSignature =
    Utilities.base64EncodeWebSafe(
      signature
    );


  return (
    encodedPayload +
    "." +
    encodedSignature
  );
}


function verifyAuthToken(token) {

  if (!token) {

    throw new Error(
      "Authentification requise."
    );
  }


  const parts =
    token.split(".");


  if (
    parts.length !== 2
  ) {

    throw new Error(
      "Token invalide."
    );
  }


  const encodedPayload =
    parts[0];

  const receivedSignature =
    parts[1];


  const props =
    PropertiesService.getScriptProperties();

  const secret =
    props.getProperty("AUTH_SECRET");


  if (!secret) {

    throw new Error(
      "AUTH_SECRET n'est pas configuré."
    );
  }


  const expectedSignature =
    Utilities.base64EncodeWebSafe(
      Utilities.computeHmacSha256Signature(
        encodedPayload,
        secret
      )
    );


  if (
    receivedSignature !==
    expectedSignature
  ) {

    throw new Error(
      "Token invalide."
    );
  }


  const json =
    Utilities
      .newBlob(
        Utilities.base64DecodeWebSafe(
          encodedPayload
        )
      )
      .getDataAsString();


  const payload =
    JSON.parse(json);


  if (
    Date.now() >
    payload.exp
  ) {

    throw new Error(
      "Session expirée."
    );
  }


  /*
    Coupure immédiate : une session ouverte par un code que le
    propriétaire vient de désactiver est refusée dès l'appel
    suivant, sans attendre son expiration. Les jetons délivrés
    avant l'introduction de `via` n'en portent pas ; pour un
    rôle à code, ils sont traités comme obtenus par code.
  */

  if (
    ROLES_CODE.includes(payload.role) &&
    (payload.via || "code") === "code"
  ) {

    if (!rolesCodeActifs_(props).includes(payload.role)) {

      throw new Error(
        messageCodeDesactive_(payload.role) +
        " Session fermée."
      );
    }


    /*
      Code changé : les sessions ouvertes avec l'ancien tombent.
      Un jeton antérieur à l'empreinte n'en porte pas ; il expire
      au plus tard huit heures après sa délivrance.
    */

    if (
      payload.cle &&
      payload.cle !== empreinteCode_(props, payload.role)
    ) {

      throw new Error(
        "Le code " +
        LIBELLES_CODE[payload.role] +
        " a changé : reconnectez-vous avec le nouveau code."
      );
    }
  }


  /*
    Session Discord : refusée dès que la connexion Discord est
    coupée, ou que la table d'accès ne donne plus ce rôle à cette
    fiche sous ce nom pour ce compte — fiche rétrogradée, passée
    en réserve, partie, déliée ou renommée (voir
    `DISCORD_PROPRIETE_ACCES`, Discord.js). Une table écrite avant
    l'empreinte du nom vaut jusqu'à son premier recalcul.
  */

  if (payload.via === "discord") {

    if (!connexionDiscordActive_(props)) {

      throw new Error(
        "La connexion par Discord est fermée. Session fermée."
      );
    }


    const table =
      lireTableAccesDiscord_(props);

    const entree =
      table[payload.discord];

    if (
      entree !==
        entreeAccesDiscord_(payload.role, payload.membre, payload.nom) &&
      entree !==
        entreeAccesDiscordSansNom_(payload.role, payload.membre)
    ) {

      throw new Error(
        "Votre accès au registre a changé : reconnectez-vous."
      );
    }
  }


  return payload;
}


function requireRole(
  token,
  allowedRoles
) {

  const auth =
    verifyAuthToken(token);


  if (
    !allowedRoles.includes(
      auth.role
    )
  ) {

    throw new Error(
      "Vous n'avez pas les droits nécessaires."
    );
  }


  return auth;
}


function getSessionInfo(token) {

  const auth =
    verifyAuthToken(token);


  // Le nom n'existe que pour une session Discord : un code n'identifie personne.
  const info = {
    role: auth.role,
    nom: auth.nom || ""
  };


  /*
    Session Discord glissante : à chaque visite, au plus une fois
    par jour, un jeton neuf de trente jours remplace l'ancien. Il
    n'est délivré qu'après `verifyAuthToken`, donc pour une fiche
    qui donne encore ce rôle à ce compte. Une session par code
    n'est jamais prolongée.
  */

  if (
    auth.via === "discord" &&
    auth.exp - Date.now() < DUREE_SESSION_DISCORD - RENOUVELLEMENT_SESSION_DISCORD
  ) {

    info.jeton = createAuthToken_(
      auth.role,
      DUREE_SESSION_DISCORD,
      "discord",
      {
        membre: auth.membre,
        discord: auth.discord,
        nom: auth.nom
      }
    );
  }


  return info;
}
