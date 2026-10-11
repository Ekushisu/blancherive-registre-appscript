// Comptes Discord dans les Effectifs.
//
// Un officier rattache un membre à son compte Discord depuis sa fiche. La liste
// des membres du serveur vient du bot (`getMembresDiscord`) : elle n'est
// demandée qu'à l'ouverture d'une fiche en modification, une fois pour la
// session de la page, puis cherchée en mémoire. Le serveur reste juge à
// l'enregistrement : format de l'identifiant, compte déjà pris.

export const MOTIF_ID_DISCORD = /^\d{17,20}$/;
const SUGGESTIONS_MAX = 8;

let membresCourants = null;
let chargementEnCours = null;

export function normaliserRechercheDiscord(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/*
  Suggestions pour une saisie : membres dont le nom ou le pseudo contient la
  recherche, ceux qui commencent par elle en premier. Un identifiant complet
  tapé à la main est proposé tel quel s'il n'est pas dans la liste : bot
  injoignable, ou membre parti du serveur.
*/
export function suggestionsDiscord(membres, recherche, limite = SUGGESTIONS_MAX) {
  const brut = String(recherche || '').trim();
  const q = normaliserRechercheDiscord(brut).replace(/^@/, '');
  if (!q) return [];

  const debut = [], milieu = [];
  for (const membre of membres || []) {
    const nom = normaliserRechercheDiscord(membre.nom);
    const pseudo = normaliserRechercheDiscord(membre.pseudo);
    if (membre.id === brut || nom.startsWith(q) || pseudo.startsWith(q)) debut.push(membre);
    else if (nom.includes(q) || pseudo.includes(q)) milieu.push(membre);
  }

  const liste = [...debut, ...milieu].slice(0, limite);
  if (MOTIF_ID_DISCORD.test(brut) && !liste.some(membre => membre.id === brut)) {
    liste.unshift({ id: brut, nom: '', pseudo: '', manuel: true });
  }
  return liste;
}

export function libelleMembreDiscord(membre) {
  if (!membre) return '';
  if (membre.manuel || !membre.nom) return `Identifiant ${membre.id}`;
  return membre.pseudo && normaliserRechercheDiscord(membre.pseudo) !== normaliserRechercheDiscord(membre.nom)
    ? `${membre.nom} (@${membre.pseudo})`
    : membre.nom;
}

export function membreDiscordParId(membres, id) {
  return (membres || []).find(membre => membre.id === id) || null;
}

/*
  Comptes déjà liés, pour griser une suggestion : identifiant → membre. Les
  liens en anomalie comptent aussi, le serveur les refuserait de même.
*/
export function comptesRattaches(rows) {
  const comptes = new Map();
  for (const row of rows || []) {
    if (row.discordId && !comptes.has(row.discordId)) {
      comptes.set(row.discordId, { memberId: row.memberId, nom: row.nomComplet });
    }
  }
  return comptes;
}

export function chargerMembresDiscord(serverCall, token, rafraichir = false) {
  if (!rafraichir && membresCourants) return Promise.resolve(membresCourants);
  if (!rafraichir && chargementEnCours) return chargementEnCours;
  const chargement = serverCall('getMembresDiscord', token, rafraichir === true)
    .then(reponse => { membresCourants = reponse.membres || []; return membresCourants; })
    .finally(() => { if (chargementEnCours === chargement) chargementEnCours = null; });
  chargementEnCours = chargement;
  return chargement;
}

export function reinitialiserMembresDiscord() { membresCourants = null; chargementEnCours = null; }

/*
  Hook de page : rien n'est demandé avant le premier `charger()`, appelé par
  la première fiche ouverte en modification.
*/
export function useMembresDiscord(serverCall, token) {
  const { useCallback, useState } = React;
  const [etat, setEtat] = useState(() => membresCourants
    ? { statut: 'pret', membres: membresCourants, erreur: '' }
    : { statut: 'inactif', membres: [], erreur: '' });

  const charger = useCallback((rafraichir = false) => {
    setEtat(e => ({ ...e, statut: 'chargement', erreur: '' }));
    chargerMembresDiscord(serverCall, token, rafraichir)
      .then(membres => setEtat({ statut: 'pret', membres, erreur: '' }))
      .catch(error => setEtat(e => ({ ...e, statut: 'erreur', erreur: error.message || String(error) })));
  }, [serverCall, token]);

  return { ...etat, charger };
}
