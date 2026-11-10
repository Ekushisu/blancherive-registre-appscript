// Comptes individuels : règles et lectures partagées par l'écran d'activation,
// l'écran de connexion et la fiche d'un membre (compte.jsx). Sans React, pour
// être éprouvé par `scripts/test-compte-ui.mjs`.
//
// Le serveur (`Comptes.js`) reste juge : longueur du mot de passe, lien
// valide, rôle de la fiche. Ce fichier n'anticipe que ce qui évite un
// aller-retour inutile.

export const MOT_DE_PASSE_MIN = 8;

/*
  Paramètre `invitation` de l'adresse au chargement, lu par
  `google.script.url` : la page est servie dans un cadre et ne voit pas sa
  propre adresse. Résout `null` sans invitation, ou hors d'Apps Script.
*/
export function lireInvitationUrl() {
  const url = globalThis.google?.script?.url;
  if (!url?.getLocation) return Promise.resolve(null);
  return new Promise(resolve => url.getLocation(location => {
    const jeton = String(location?.parameter?.invitation || '').trim();
    resolve(jeton ? { jeton } : null);
  }));
}

// Retire le jeton de l'adresse : un rechargement ne doit pas le rejouer.
export function effacerInvitationUrl() {
  try { globalThis.google?.script?.history?.replace(null, {}, ''); } catch { /* hors Apps Script */ }
}

/*
  Contrôle du formulaire avant l'envoi. Renvoie un message, ou '' quand le
  serveur peut être appelé. Le refus « votre nom » exact est laissé au
  serveur, qui connaît la fiche.
*/
export function verifierMotDePasse(motDePasse, confirmation) {
  const valeur = String(motDePasse || '');
  if (valeur.length < MOT_DE_PASSE_MIN) return `Le mot de passe doit compter au moins ${MOT_DE_PASSE_MIN} caractères.`;
  if (confirmation !== undefined && String(confirmation) !== valeur) return 'Les deux saisies ne correspondent pas.';
  return '';
}

/*
  Libellé du champ « code d'accès » selon les codes communs encore acceptés
  par le serveur (`getModesConnexion().codes`). Sans la liste, le libellé
  général.
*/
export function libelleCodes(codes) {
  const liste = Array.isArray(codes) ? codes.map(c => String(c).toUpperCase()) : null;
  if (!liste) return { titre: 'Code d’accès', aide: 'Intendance et secours.' };
  const garde = liste.includes('GARDE') || liste.includes('OFFICIER');
  if (!liste.length) return { titre: 'Code d’accès', aide: 'Aucun code commun n’est accepté pour l’instant.' };
  if (!garde) return { titre: 'Code de l’intendance', aide: 'Argentier, Thanes et cuisines de la cour. Les membres de la Garde se connectent avec leur nom.' };
  return { titre: 'Code d’accès commun', aide: 'Secours pendant la mise en place des comptes personnels, et intendance.' };
}

// Date ISO → « 17 nov. 2026, 14:05 » ; vide si illisible.
export function formatDateCompte(iso) {
  const temps = Date.parse(iso || '');
  if (!Number.isFinite(temps)) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(temps));
}

/*
  État d'un compte tel que `getEffectifs` le renvoie (`compte`) : étiquette
  courte pour la fiche, phrase pour le détail, et ce que l'officier peut
  faire. Une fiche sans accès (réserve, départ) n'a pas de lien à recevoir.
*/
export function decrireCompte(compte, acces = true) {
  const etat = compte?.etat || 'aucun';
  const expire = formatDateCompte(compte?.expire);
  const activeLe = formatDateCompte(compte?.activeLe);
  const derniere = formatDateCompte(compte?.derniereConnexion);
  const remis = compte?.inviteePar ? `remis par ${compte.inviteePar}${formatDateCompte(compte.lienRemisLe) ? ` le ${formatDateCompte(compte.lienRemisLe)}` : ''}` : '';

  if (etat === 'actif') {
    return {
      etiquette: 'Compte actif',
      classe: 'effectif-badge-compte',
      detail: [activeLe && `Mot de passe choisi le ${activeLe}`, derniere && `dernière connexion le ${derniere}`, expire && `nouveau lien en cours jusqu’au ${expire}${remis ? `, ${remis}` : ''}`]
        .filter(Boolean).join(' · '),
      lien: acces ? 'Nouveau lien (mot de passe oublié)' : '',
      retrait: true
    };
  }
  if (etat === 'invitation') {
    return { etiquette: 'Lien remis', classe: 'effectif-badge-invitation', detail: `Lien de connexion ${remis ? `${remis}, ` : ''}valable jusqu’au ${expire}, pas encore activé.`, lien: acces ? 'Nouveau lien' : '', retrait: true };
  }
  if (etat === 'expire') {
    return { etiquette: 'Lien expiré', classe: 'effectif-badge-alerte', detail: `Le lien ${remis ? `${remis} ` : ''}n’a pas été activé à temps.`, lien: acces ? 'Nouveau lien' : '', retrait: true };
  }
  return { etiquette: acces ? 'Sans compte' : '', classe: 'effectif-badge-muted', detail: acces ? 'Aucun compte : remettre un lien de connexion.' : '', lien: acces ? 'Lien de connexion' : '', retrait: false };
}

/*
  Ligne du journal des comptes (`compte.historique`, du plus récent au plus
  ancien) : « 12 nov. 2026, 14:05 — Lien remis par Astrid Brise-Lame (Premier
  lien) ».
*/
const ACTIONS_JOURNAL = { lien: 'Lien remis', activation: 'Compte activé', retrait: 'Compte retiré', 'mot de passe': 'Mot de passe changé' };
export function libelleHistoriqueCompte(evenement) {
  const date = formatDateCompte(evenement?.date);
  const action = ACTIONS_JOURNAL[evenement?.action] || evenement?.action || '';
  const par = evenement?.par ? ` par ${evenement.par}` : '';
  const detail = evenement?.detail ? ` (${String(evenement.detail).replace(/, valable jusqu’au .*$/, '')})` : '';
  return `${date ? `${date} — ` : ''}${action}${par}${detail}`;
}

// Mot de recherche de la page Effectifs : « compte actif », « sans compte », « lien remis ».
export function motRechercheCompte(compte) {
  const etat = compte?.etat || 'aucun';
  return etat === 'actif' ? 'compte actif' : etat === 'invitation' ? 'lien remis' : etat === 'expire' ? 'lien expire sans compte' : 'sans compte';
}
