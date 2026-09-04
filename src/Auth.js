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


function createAuthToken(role) {

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
      8 * 60 * 60 * 1000

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