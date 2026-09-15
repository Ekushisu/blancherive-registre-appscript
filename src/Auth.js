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
*/
const ROLE_PUBLIC = "VISITEUR";

/*
  Session de consultation du Codex, sans authentification.

  La durée est volontairement plus courte que celle d'une session de service :
  un visiteur consulte, il ne prend pas son service.
*/
function ouvrirSessionPublique() {
  return createAuthToken(ROLE_PUBLIC, 2 * 60 * 60 * 1000);
}


function login(password) {

  const props =
    PropertiesService.getScriptProperties();

  const passwords = {
    GARDE:
      props.getProperty("PASSWORD_GARDE"),

    OFFICIER:
      props.getProperty("PASSWORD_OFFICIER")
  };


  let role = null;

  if (
    passwords.OFFICIER &&
    password === passwords.OFFICIER
  ) {
    role = "OFFICIER";
  }
  else if (
    passwords.GARDE &&
    password === passwords.GARDE
  ) {
    role = "GARDE";
  }


  if (!role) {

    throw new Error(
      "Mot de passe incorrect."
    );
  }


  return createAuthToken(role);
}


function createAuthToken(role, dureeMs) {

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


  const secret =
    PropertiesService
      .getScriptProperties()
      .getProperty("AUTH_SECRET");


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


  return {
    role: auth.role
  };
}