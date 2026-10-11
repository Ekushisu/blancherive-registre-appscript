// Connexion par Discord : aller-retour par la page d'autorisation de Discord.
//
// Avant de partir, le navigateur garde un `state` aléatoire dans
// `sessionStorage`, comme le jeton de session. Discord le renvoie avec un code
// à usage unique dans l'adresse de la Web App ; le retour n'est accepté que si
// les deux `state` concordent, sans quoi un tiers pourrait faire ouvrir à
// quelqu'un une session sous son propre compte. Le code part ensuite au
// serveur (`ouvrirSessionDiscord`), qui seul l'échange auprès de Discord.

const CLE_ETAT = 'blancherive.discord.etat';

export function nouvelEtatDiscord() {
  const octets = new Uint8Array(16);
  globalThis.crypto.getRandomValues(octets);
  return Array.from(octets, octet => octet.toString(16).padStart(2, '0')).join('');
}

export function urlConnexionDiscord(base, etat) {
  return `${base}&state=${encodeURIComponent(etat)}`;
}

export function memoriserEtatDiscord(etat) {
  try { globalThis.sessionStorage?.setItem(CLE_ETAT, etat); } catch { /* stockage refusé */ }
}

/*
  Paramètres de l'adresse au chargement, lus par `google.script.url` : la page
  est servie dans un cadre et ne voit pas sa propre adresse. Résout `null`
  hors d'un retour de Discord, ou hors d'Apps Script (aperçus).
*/
export function lireRetourDiscord() {
  const url = globalThis.google?.script?.url;
  if (!url?.getLocation) return Promise.resolve(null);
  return new Promise(resolve => url.getLocation(location => {
    const p = location?.parameter || {};
    resolve(p.code || p.error ? { code: p.code || '', etat: p.state || '', erreur: p.error || '' } : null);
  }));
}

/*
  Contrôle du retour, une seule fois : le `state` gardé est effacé dans tous les
  cas. Renvoie le code à transmettre au serveur, ou lève un message lisible.
*/
export function verifierRetourDiscord(retour) {
  let attendu = null;
  try {
    attendu = globalThis.sessionStorage?.getItem(CLE_ETAT) ?? null;
    globalThis.sessionStorage?.removeItem(CLE_ETAT);
  } catch { /* stockage refusé */ }

  if (retour.erreur) {
    throw new Error(retour.erreur === 'access_denied'
      ? 'Connexion Discord annulée.'
      : 'Discord a refusé la connexion : recommencer.');
  }
  if (!attendu || attendu !== retour.etat) {
    throw new Error('Connexion Discord interrompue : recommencer depuis ce navigateur.');
  }
  return retour.code;
}

// Retire le code de l'adresse, pour qu'un rechargement ne le rejoue pas.
export function effacerRetourDiscord() {
  try { globalThis.google?.script?.history?.replace(null, {}, ''); } catch { /* hors Apps Script */ }
}
