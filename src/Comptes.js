/*
  Comptes individuels — connexion par nom et mot de passe personnel
  (décision du propriétaire, 10 novembre 2026).

  Principe : la connexion Discord ayant été refusée par le staff, chaque
  membre reçoit d'un officier un lien de connexion à usage unique, ouvre un
  formulaire où il choisit un mot de passe secret, puis se connecte avec son
  nom (« Prénom Nom », tel que la fiche l'écrit) et ce mot de passe. La
  session obtenue est nominative : elle porte l'ID membre et le nom de la
  fiche, et les règles de « saisie à son propre nom » (Amendes.js) s'y
  appliquent comme à une session Discord. Les codes communs restent pour
  l'intendance et le secours (`AUTH_CODES`, Auth.js).

  Comme pour Discord, le tableur décide : le rôle (GARDE, OFFICIER, ou aucun
  accès) se déduit du statut et du grade de la fiche `Effectifs` à chaque
  connexion et à chaque appel (table d'accès), jamais du compte lui-même. Un
  compte dont la fiche passe en réserve, part ou est rétrogradée perd ou
  change d'accès à l'appel suivant.

  Feuille `Comptes` (docs/DATA_MODEL.md), une ligne par membre :
    A ID membre · B Nom · C Sel · D Empreinte · E Version · F Invitation ·
    G Invitation expire · H Invitée par · I Activé le · J Dernière connexion
  Le mot de passe n'y est jamais écrit : seule son empreinte, HMAC-SHA256
  itéré sur un sel propre à la ligne, avec un secret du serveur
  (`COMPTES_SECRET`, Script Properties, créé à la première invitation) que la
  feuille ne contient pas. Sans ce secret, une copie de la feuille ne permet
  ni de retrouver un mot de passe ni d'en forger un : un éditeur du classeur
  peut supprimer un compte, pas se faire passer pour son titulaire. Effacer
  ou changer `COMPTES_SECRET` invalide tous les mots de passe et toutes les
  invitations : chacun doit alors recevoir un nouveau lien.

  Le lien d'invitation (`?invitation=<jeton>`) porte un jeton aléatoire dont
  la feuille ne garde que l'empreinte ; il vaut sept jours et une seule
  activation. Un lien délivré à un membre qui a déjà un mot de passe le
  remplace à l'activation (mot de passe oublié) ; le changement incrémente la
  version du compte, ce qui ferme ses autres sessions.

  Table d'accès `COMPTES_ACCES` (Script Properties, technique) : douze
  premiers caractères de l'ID membre → « O|nnnn|v » (initiale du rôle,
  empreinte du nom, version du compte). Recalculée à chaque synchronisation
  de l'historique des Effectifs (HistoriqueEffectifs.js), relue par
  `verifyAuthToken` à chaque appel d'une session `via: "compte"`. Ne pas
  l'éditer à la main.

  Fonctions publiques (appelables par google.script.run) :
  - `lireInvitationCompte(invitation)` : sans jeton, décrit la fiche que le
    lien ouvre (nom, grade, corps, expiration) pour l'écran d'activation ;
  - `creerInvitationCompte(token, membre)` : OFFICIER, Lieutenant et plus
    (Privileges.js), remet un lien, premier ou nouveau ;
  - `supprimerCompte(token, membre)` : OFFICIER, retire le compte.
  Chaque lien remis, activation, retrait et changement de mot de passe est
  consigné dans la feuille `JournalComptes`, à ajout seul.
  La connexion (`connecterCompte`), l'activation (`activerCompte`) et le
  changement de mot de passe (`changerMotDePasseCompte`) sont dans Auth.js :
  elles délivrent un jeton, et `scripts/test-auth-codes.mjs` fige la liste
  des fonctions qui le font. Aucune fonction de ce fichier ne fabrique de
  jeton.

  Dépendances : `roleRegistreDiscord_`, `lireOrdreGradesDiscord_` et
  `empreinteNomDiscord_` (Discord.js) ; `synchroniserHistoriqueEffectifs_`
  (HistoriqueEffectifs.js), qui appelle en retour `mettreAJourAccesComptes_`.
*/

const COMPTES_SHEET = "Comptes";
const COMPTES_ENTETES = [
  "ID membre", "Nom", "Sel", "Empreinte", "Version",
  "Invitation", "Invitation expire", "Invitée par", "Activé le", "Dernière connexion"
];
const COMPTES_PROPRIETE_SECRET = "COMPTES_SECRET";
const COMPTES_PROPRIETE_ACCES = "COMPTES_ACCES";

/*
  Journal des comptes (feuille `JournalComptes`, à ajout seul) : qui a remis
  quel lien à qui, activations, retraits, changements de mot de passe
  (décision du propriétaire, 10 novembre 2026). Les derniers événements
  d'un membre sont montrés aux officiers sur sa fiche.
*/
const COMPTES_JOURNAL_SHEET = "JournalComptes";
const COMPTES_JOURNAL_ENTETES = ["Date ISO", "ID membre", "Nom", "Action", "Par", "Détail"];
const COMPTES_JOURNAL_AFFICHE = 6;

/*
  Remettre un lien de connexion, premier ou nouveau, est réservé à Lieutenant
  et plus (Privileges.js, `lien` ; décision du propriétaire, 10 novembre
  2026) : un lien sur un compte actif permet de prendre la place du
  titulaire. Une session par code commun, sans fiche, n'est pas limitée :
  voie de mise en place du propriétaire, qui disparaît avec
  `AUTH_CODES = INTENDANT`.
*/

// Itérations de l'empreinte : assez pour ralentir un essai, pas au point de
// faire attendre la connexion (Apps Script n'offre ni bcrypt ni PBKDF2).
const COMPTES_ITERATIONS = 2000;
const COMPTES_MOT_DE_PASSE_MIN = 8;
const COMPTES_MOT_DE_PASSE_MAX = 128;
const COMPTES_INVITATION_DUREE = 7 * 24 * 60 * 60 * 1000;
const COMPTES_INVITATION_MOTIF = /^[0-9a-f]{32}$/;
// Essais infructueux tolérés par nom avant une pause d'un quart d'heure.
const COMPTES_TENTATIVES_MAX = 8;
const COMPTES_TENTATIVES_FENETRE = 15 * 60;
const COMPTES_PREFIXE_ID = 12;

const COMPTES_MESSAGE_INVITATION =
  "Ce lien de connexion est inconnu ou expiré : demander un nouveau lien à un officier.";
const COMPTES_MESSAGE_IDENTIFIANTS = "Nom ou mot de passe incorrect.";


// ============================================================
// API PUBLIQUE
// ============================================================

/*
  Fiche ouverte par un lien d'invitation, pour l'écran d'activation. Sans
  jeton : le lien lui-même est la preuve. Un lien inconnu ou expiré ne
  révèle rien.
*/
function lireInvitationCompte(invitation) {
  const jeton = nettoyerInvitationCompte_(invitation);
  const props = PropertiesService.getScriptProperties();
  const secret = secretComptes_(props, false);
  if (!secret) throw new Error(COMPTES_MESSAGE_INVITATION);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const compte = trouverCompteParInvitation_(ss, secret, jeton);
  const fiche = synchroniserHistoriqueEffectifs_(ss).members.find(m => m.id === compte.id);
  if (!fiche) throw new Error(COMPTES_MESSAGE_INVITATION);

  return {
    nom: nomCompletCompte_(fiche),
    grade: fiche.grade,
    corps: fiche.corps,
    expire: compte.invitationExpire,
    dejaActif: Boolean(compte.empreinte)
  };
}


/*
  Remet un lien de connexion à un membre. OFFICIER seul, pour une fiche qui
  donne accès au registre ; un lien pour une fiche sans accès n'aurait rien
  à ouvrir. Le jeton n'est jamais écrit : la feuille n'en garde que
  l'empreinte, et l'adresse renvoyée est la seule copie.
*/
function creerInvitationCompte(token, membre) {
  const auth = requireRole(token, ["OFFICIER"]);
  const id = String(membre || "").trim();
  if (!id) throw new Error("Membre inconnu.");

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const membres = synchroniserHistoriqueEffectifs_(ss).members;
  const fiche = membres.find(m => m.id === id);
  if (!fiche) throw new Error("Cette fiche n'existe plus dans les Effectifs.");

  const nom = nomCompletCompte_(fiche);
  if (!roleRegistreCompte_(ss, fiche)) {
    throw new Error(
      "La fiche de " + nom + " (statut « " + (fiche.status || "sans statut") +
      " ») ne donne pas accès au registre : aucun lien à remettre."
    );
  }

  exigerPrivilege_(gradeSession_(ss, auth, membres), "lien");

  const existant = lireComptes_(ss).lignes.find(l => l.id === id);
  const renouvellement = Boolean(existant && existant.empreinte);

  const url = urlWebAppCompte_();
  const props = PropertiesService.getScriptProperties();
  const secret = secretComptes_(props, true);
  const jeton = nouveauJetonInvitationCompte_();
  const expire = new Date(Date.now() + COMPTES_INVITATION_DUREE).toISOString();
  const par = auteurCompte_(auth);

  const ligne = ecrireCompte_(ss, id, l => {
    l.nom = nom;
    l.invitation = empreinteInvitationCompte_(secret, jeton);
    l.invitationExpire = expire;
    l.inviteePar = par;
  });

  journaliserCompte_(ss, id, nom, "lien", par,
    (renouvellement ? "Nouveau lien, compte déjà actif"
      : existant && existant.invitation ? "Lien remis à nouveau"
      : "Premier lien") +
    ", valable jusqu'au " + expire);

  return {
    url: url + (url.indexOf("?") >= 0 ? "&" : "?") + "invitation=" + jeton,
    expire: expire,
    nom: nom,
    compte: etatCompte_(ligne, lireJournalComptes_(ss).get(id))
  };
}


// Nom de la session pour la feuille et le journal ; un code commun n'identifie personne.
function auteurCompte_(auth) {
  return sessionNominativeCompte_(auth) ? String(auth.nom).trim() : "code des officiers";
}


/*
  Retire le compte d'un membre : mot de passe et invitation effacés, sessions
  fermées à l'appel suivant (table d'accès recalculée). La fiche n'est pas
  touchée ; un nouveau lien recrée le compte.
*/
function supprimerCompte(token, membre) {
  const auth = requireRole(token, ["OFFICIER"]);
  const id = String(membre || "").trim();
  if (!id) throw new Error("Membre inconnu.");

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const ligne = supprimerLigneCompte_(ss, id);
  synchroniserHistoriqueEffectifs_(ss);
  if (ligne) {
    journaliserCompte_(ss, id, ligne.nom, "retrait", auteurCompte_(auth),
      ligne.empreinte ? "Compte actif retiré" : "Lien annulé");
  }

  return { compte: etatCompte_(null, lireJournalComptes_(ss).get(id)) };
}


// ============================================================
// CONNEXION, ACTIVATION, CHANGEMENT — appelées par Auth.js
// ============================================================

/*
  Vérifie un nom et un mot de passe, puis renvoie l'accès de la fiche :
  { membre, role, nom, version }. Le nombre d'essais infructueux par nom est
  compté dans le cache du script : au-delà de `COMPTES_TENTATIVES_MAX` en un
  quart d'heure, le nom est refusé sans même être cherché. L'empreinte est
  calculée même sans compte correspondant, pour que la durée d'un refus ne
  dise pas si le nom existe.
*/
function connecterCompteInterne_(nomSaisi, motDePasse) {
  const cle = cleNomCompte_(nomSaisi);
  if (!cle) throw new Error("Indiquez votre nom tel qu'il figure au registre.");
  if (!motDePasse) throw new Error("Indiquez votre mot de passe.");
  if (String(motDePasse).length > COMPTES_MOT_DE_PASSE_MAX) throw new Error(COMPTES_MESSAGE_IDENTIFIANTS);

  const cache = CacheService.getScriptCache();
  const cleCache = "comptes:echecs:" + cle;
  const echecs = Number(cache.get(cleCache) || 0);
  if (echecs >= COMPTES_TENTATIVES_MAX) {
    throw new Error("Trop de tentatives pour ce nom : réessayez dans un quart d'heure.");
  }

  const echec = () => {
    cache.put(cleCache, String(echecs + 1), COMPTES_TENTATIVES_FENETRE);
    throw new Error(COMPTES_MESSAGE_IDENTIFIANTS);
  };

  const props = PropertiesService.getScriptProperties();
  const secret = secretComptes_(props, false);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const comptes = lireComptes_(ss).lignes.filter(l => l.empreinte && cleNomCompte_(l.nom) === cle);

  if (comptes.length > 1) {
    throw new Error("Plusieurs comptes portent ce nom : prévenir un officier.");
  }

  if (!secret || comptes.length !== 1) {
    empreinteMotDePasseCompte_(secret || "aucun", "aucun", motDePasse);
    echec();
  }

  const compte = comptes[0];
  if (!verifierEmpreinteCompte_(secret, compte.sel, motDePasse, compte.empreinte)) {
    echec();
  }

  cache.remove(cleCache);
  const acces = accesCompte_(ss, compte.id);
  ecrireCompte_(ss, compte.id, l => { l.derniereConnexion = new Date().toISOString(); });
  return acces;
}


/*
  Active un compte par son lien : le mot de passe choisi remplace l'ancien
  s'il y en avait un, la version change (les autres sessions tombent), le
  lien est consommé.
*/
function activerCompteInterne_(invitation, motDePasse) {
  const jeton = nettoyerInvitationCompte_(invitation);
  const props = PropertiesService.getScriptProperties();
  const secret = secretComptes_(props, false);
  if (!secret) throw new Error(COMPTES_MESSAGE_INVITATION);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const compte = trouverCompteParInvitation_(ss, secret, jeton);
  verifierMotDePasseCompte_(motDePasse, compte.nom);

  const maintenant = new Date().toISOString();
  const sel = Utilities.getUuid();
  const empreinte = empreinteMotDePasseCompte_(secret, sel, motDePasse);

  ecrireCompte_(ss, compte.id, l => {
    if (l.invitation !== compte.invitation) throw new Error(COMPTES_MESSAGE_INVITATION);
    l.sel = sel;
    l.empreinte = empreinte;
    l.version = String(Number(l.version || 0) + 1);
    l.invitation = "";
    l.invitationExpire = "";
    l.activeLe = maintenant;
    l.derniereConnexion = maintenant;
  });

  journaliserCompte_(ss, compte.id, compte.nom, "activation", compte.nom,
    compte.empreinte ? "Mot de passe remplacé par le lien" : "Mot de passe choisi");

  return accesCompte_(ss, compte.id);
}


/*
  Changement de mot de passe par le titulaire, session personnelle seule :
  l'ancien mot de passe est exigé, la version change.
*/
function changerMotDePasseInterne_(auth, ancien, nouveau) {
  if (!auth || auth.via !== "compte" || !auth.membre) {
    throw new Error("Seule une session personnelle a un mot de passe à changer.");
  }
  if (!ancien) throw new Error("Indiquez votre mot de passe actuel.");

  const props = PropertiesService.getScriptProperties();
  const secret = secretComptes_(props, false);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const compte = lireComptes_(ss).lignes.find(l => l.id === auth.membre && l.empreinte);

  if (!secret || !compte) {
    throw new Error("Ce compte n'existe plus : demander un nouveau lien à un officier.");
  }
  if (!verifierEmpreinteCompte_(secret, compte.sel, ancien, compte.empreinte)) {
    throw new Error("Mot de passe actuel incorrect.");
  }
  verifierMotDePasseCompte_(nouveau, compte.nom);
  if (String(nouveau) === String(ancien)) throw new Error("Le nouveau mot de passe doit être différent de l'actuel.");

  const sel = Utilities.getUuid();
  const empreinte = empreinteMotDePasseCompte_(secret, sel, nouveau);
  ecrireCompte_(ss, compte.id, l => {
    l.sel = sel;
    l.empreinte = empreinte;
    l.version = String(Number(l.version || 0) + 1);
  });

  journaliserCompte_(ss, compte.id, compte.nom, "mot de passe", compte.nom, "Changé par le titulaire");

  return accesCompte_(ss, compte.id);
}


/*
  Accès d'un compte après la synchronisation de l'historique, qui recalcule
  la table : le jeton délivré est vérifiable dès l'appel suivant.
*/
function accesCompte_(ss, id) {
  const acces = synchroniserHistoriqueEffectifs_(ss).accesComptes.get(id);

  if (!acces || !acces.actif) {
    throw new Error("Ce compte n'existe plus : demander un nouveau lien à un officier.");
  }
  if (!acces.role) {
    throw new Error(
      "Votre fiche (statut « " + (acces.statut || "sans statut") + " ») ne donne pas accès au registre."
    );
  }

  const table = lireTableAccesComptes_(PropertiesService.getScriptProperties());
  if (table[cleTableCompte_(id)] !== entreeAccesCompte_(acces.role, acces.nom, acces.version)) {
    throw new Error("Table d'accès indisponible : prévenir le propriétaire du registre.");
  }

  return { membre: id, role: acces.role, nom: acces.nom, version: acces.version };
}


// ============================================================
// TABLE D'ACCÈS — appelée par HistoriqueEffectifs.js
// ============================================================

/*
  Recalcule la table d'accès des comptes à partir des fiches (`members` de la
  synchronisation : id, prenom, nom, grade, status) et de la feuille
  `Comptes`, et l'écrit seulement si elle change. Rafraîchit au passage la
  colonne Nom de la feuille, informative, pour qu'un membre renommé se
  connecte sous son nouveau nom. Renvoie l'index id → { role, nom, statut,
  version, actif }. Une table trop grande pour une propriété est effacée :
  les sessions personnelles sont alors refusées, les codes restent.
*/
function mettreAJourAccesComptes_(ss, members) {
  const feuille = lireComptes_(ss);
  const index = new Map();
  const table = {};

  if (feuille.lignes.length) {
    const parId = new Map((members || []).map(m => [m.id, m]));
    const ordre = lireOrdreGradesDiscord_(ss);
    const noms = feuille.lignes.map(l => [l.nom]);
    let nomsChanges = false;

    feuille.lignes.forEach((ligne, i) => {
      const fiche = parId.get(ligne.id);
      if (!fiche) return;
      const nom = nomCompletCompte_(fiche);
      if (ligne.nom !== nom) {
        noms[i] = [nom];
        nomsChanges = true;
      }
      const role = roleRegistreDiscord_(fiche.status, fiche.grade, ordre);
      const actif = Boolean(ligne.empreinte);
      index.set(ligne.id, {
        role: role,
        nom: nom,
        statut: fiche.status,
        version: String(ligne.version || "0"),
        actif: actif
      });
      if (role && actif) {
        table[cleTableCompte_(ligne.id)] = entreeAccesCompte_(role, nom, ligne.version);
      }
    });

    if (nomsChanges && feuille.sheet) {
      feuille.sheet.getRange(2, 2, noms.length, 1).setValues(noms);
    }
  }

  const texte = JSON.stringify(table);
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(COMPTES_PROPRIETE_ACCES) !== texte) {
    try {
      props.setProperty(COMPTES_PROPRIETE_ACCES, texte);
    } catch (e) {
      console.error("Table d'accès des comptes non enregistrée : " + e.message);
      props.deleteProperty(COMPTES_PROPRIETE_ACCES);
    }
  }

  return index;
}


function lireTableAccesComptes_(props) {
  try {
    const table = JSON.parse(props.getProperty(COMPTES_PROPRIETE_ACCES) || "{}");
    return table && typeof table === "object" ? table : {};
  } catch (e) {
    return {};
  }
}


function cleTableCompte_(id) {
  return String(id || "").slice(0, COMPTES_PREFIXE_ID);
}


function entreeAccesCompte_(role, nom, version) {
  return String(role || "").charAt(0) + "|" + empreinteNomDiscord_(nom) + "|" + String(version || "0");
}


// Même seuil que la connexion Discord : service actif, OFFICIER dès Sergent-Chef.
function roleRegistreCompte_(ss, fiche) {
  return roleRegistreDiscord_(fiche.status, fiche.grade, lireOrdreGradesDiscord_(ss));
}


// ============================================================
// ÉTAT D'UN COMPTE — pour la page Effectifs
// ============================================================

/*
  États affichés aux officiers : `actif` (mot de passe choisi), `invitation`
  (lien remis, pas encore activé, expire à `expire`), `expire` (lien périmé
  sans compte), `aucun`. Un compte actif peut aussi porter un lien en cours
  (mot de passe oublié) : `expire` est alors renseigné.
*/
function lireEtatsComptes_(ss) {
  const etats = new Map();
  const journal = lireJournalComptes_(ss);
  lireComptes_(ss).lignes.forEach(ligne => etats.set(ligne.id, etatCompte_(ligne, journal.get(ligne.id))));
  journal.forEach((evenements, id) => {
    if (!etats.has(id)) etats.set(id, etatCompte_(null, evenements));
  });
  return etats;
}


/*
  `inviteePar` et `lienRemisLe` décrivent le dernier lien remis (feuille) ;
  `historique` les derniers événements du journal, du plus récent au plus
  ancien, pour que les officiers voient qui a remis quel lien.
*/
function etatCompte_(ligne, historique) {
  const base = {
    etat: "aucun", expire: "", activeLe: "", derniereConnexion: "",
    inviteePar: "", lienRemisLe: "", historique: historique || []
  };
  if (!ligne) return base;
  const enCours = Boolean(ligne.invitation) && Date.parse(ligne.invitationExpire || "") > Date.now();
  const remisLe = Date.parse(ligne.invitationExpire || "");
  return Object.assign(base, {
    etat: ligne.empreinte ? "actif" : enCours ? "invitation" : ligne.invitation ? "expire" : "aucun",
    expire: enCours ? ligne.invitationExpire : "",
    activeLe: ligne.activeLe || "",
    derniereConnexion: ligne.derniereConnexion || "",
    inviteePar: ligne.invitation ? ligne.inviteePar : "",
    lienRemisLe: ligne.invitation && Number.isFinite(remisLe) ? new Date(remisLe - COMPTES_INVITATION_DUREE).toISOString() : ""
  });
}


// ============================================================
// JOURNAL `JournalComptes` — à ajout seul
// ============================================================

function journaliserCompte_(ss, id, nom, action, par, detail) {
  let sheet = ss.getSheetByName(COMPTES_JOURNAL_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(COMPTES_JOURNAL_SHEET);
    sheet.getRange(1, 1, 1, COMPTES_JOURNAL_ENTETES.length).setValues([COMPTES_JOURNAL_ENTETES]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, sheet.getMaxRows(), COMPTES_JOURNAL_ENTETES.length).setNumberFormat("@");
    sheet.getRange(1, 1).setNote("Journal des comptes personnels (Comptes.js) : liens remis, activations, retraits. À ajout seul, écrit par l'application.");
  }
  // Noms et détails en texte : jamais de formule.
  sheet.appendRow([new Date().toISOString(), id, nom, action, par, detail]
    .map(v => String(v === undefined || v === null ? "" : v).replace(/^=/, "'=")));
}


// Derniers événements par membre, du plus récent au plus ancien.
function lireJournalComptes_(ss) {
  const index = new Map();
  const sheet = ss.getSheetByName(COMPTES_JOURNAL_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return index;

  const lignes = sheet.getRange(2, 1, sheet.getLastRow() - 1, COMPTES_JOURNAL_ENTETES.length).getDisplayValues();
  for (let i = lignes.length - 1; i >= 0; i--) {
    const id = String(lignes[i][1] || "").trim();
    if (!id) continue;
    const liste = index.get(id) || [];
    if (liste.length >= COMPTES_JOURNAL_AFFICHE) continue;
    liste.push({
      date: String(lignes[i][0] || ""),
      action: String(lignes[i][3] || ""),
      par: String(lignes[i][4] || ""),
      detail: String(lignes[i][5] || "")
    });
    index.set(id, liste);
  }
  return index;
}


// ============================================================
// FEUILLE `Comptes`
// ============================================================

/*
  Lit toute la feuille. Absente, elle n'est pas créée par une lecture :
  seule une invitation la crée.
*/
function lireComptes_(ss) {
  const sheet = ss.getSheetByName(COMPTES_SHEET);
  if (!sheet) return { sheet: null, lignes: [] };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { sheet: sheet, lignes: [] };

  const valeurs = sheet.getRange(2, 1, lastRow - 1, COMPTES_ENTETES.length).getDisplayValues();
  const lignes = [];
  valeurs.forEach((v, i) => {
    const id = String(v[0] || "").trim();
    if (!id) return;
    lignes.push({
      row: i + 2,
      id: id,
      nom: String(v[1] || "").trim(),
      sel: String(v[2] || ""),
      empreinte: String(v[3] || ""),
      version: String(v[4] || "0"),
      invitation: String(v[5] || ""),
      invitationExpire: String(v[6] || ""),
      inviteePar: String(v[7] || ""),
      activeLe: String(v[8] || ""),
      derniereConnexion: String(v[9] || "")
    });
  });

  return { sheet: sheet, lignes: lignes };
}


function ouvrirOuCreerFeuilleComptes_(ss) {
  let sheet = ss.getSheetByName(COMPTES_SHEET);
  if (sheet) return sheet;

  sheet = ss.insertSheet(COMPTES_SHEET);
  sheet.getRange(1, 1, 1, COMPTES_ENTETES.length).setValues([COMPTES_ENTETES]);
  sheet.setFrozenRows(1);
  // Tout en texte : un sel ou une empreinte ne doivent jamais être interprétés.
  sheet.getRange(1, 1, sheet.getMaxRows(), COMPTES_ENTETES.length).setNumberFormat("@");
  sheet.getRange(1, 1).setNote(
    "Comptes individuels du registre (Comptes.js). Écrit par l'application ; " +
    "ne contient aucun mot de passe. Supprimer une ligne retire le compte."
  );
  return sheet;
}


/*
  Modifie ou crée la ligne d'un membre, sous verrou : `modifier(ligne)`
  reçoit l'objet relu et le change en place ; la ligne entière est réécrite.
*/
function ecrireCompte_(ss, id, modifier) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = ouvrirOuCreerFeuilleComptes_(ss);
    const feuille = lireComptes_(ss);
    let ligne = feuille.lignes.find(l => l.id === id);
    if (!ligne) {
      ligne = {
        row: Math.max(sheet.getLastRow(), 1) + 1,
        id: id, nom: "", sel: "", empreinte: "", version: "0",
        invitation: "", invitationExpire: "", inviteePar: "", activeLe: "", derniereConnexion: ""
      };
    }
    modifier(ligne);
    if (sheet.getMaxRows() < ligne.row) sheet.insertRowsAfter(sheet.getMaxRows(), ligne.row - sheet.getMaxRows());
    sheet.getRange(ligne.row, 1, 1, COMPTES_ENTETES.length).setValues([[
      ligne.id, ligne.nom, ligne.sel, ligne.empreinte, ligne.version,
      ligne.invitation, ligne.invitationExpire, ligne.inviteePar, ligne.activeLe, ligne.derniereConnexion
    ].map(v => String(v === undefined || v === null ? "" : v))]);
    SpreadsheetApp.flush();
    return ligne;
  } finally {
    lock.releaseLock();
  }
}


function supprimerLigneCompte_(ss, id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const feuille = lireComptes_(ss);
    const ligne = feuille.lignes.find(l => l.id === id);
    if (ligne && feuille.sheet) {
      feuille.sheet.deleteRow(ligne.row);
      SpreadsheetApp.flush();
    }
    return ligne || null;
  } finally {
    lock.releaseLock();
  }
}


function trouverCompteParInvitation_(ss, secret, jeton) {
  const empreinte = empreinteInvitationCompte_(secret, jeton);
  const compte = lireComptes_(ss).lignes.find(l => l.invitation && memesChainesCompte_(l.invitation, empreinte));
  if (!compte || !(Date.parse(compte.invitationExpire || "") > Date.now())) {
    throw new Error(COMPTES_MESSAGE_INVITATION);
  }
  return compte;
}


// ============================================================
// SECRET, EMPREINTES, JETONS
// ============================================================

/*
  Secret du serveur, créé à la première invitation et jamais renvoyé au
  navigateur. Il n'est pas dérivé d'`AUTH_SECRET` : changer celui-ci ferme
  les sessions sans invalider les mots de passe.
*/
function secretComptes_(props, creer) {
  const existant = props.getProperty(COMPTES_PROPRIETE_SECRET);
  if (existant || !creer) return existant || "";

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const relu = props.getProperty(COMPTES_PROPRIETE_SECRET);
    if (relu) return relu;
    const secret = (Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "");
    props.setProperty(COMPTES_PROPRIETE_SECRET, secret);
    return secret;
  } finally {
    lock.releaseLock();
  }
}


/*
  Empreinte d'un mot de passe : HMAC-SHA256 du sel et du mot de passe par le
  secret, puis `COMPTES_ITERATIONS` passes de HMAC sur le résultat. Rendue
  en base64 web, précédée du nombre d'itérations pour pouvoir le changer
  sans invalider les empreintes existantes.
*/
function empreinteMotDePasseCompte_(secret, sel, motDePasse, iterations) {
  const passes = Number(iterations) > 0 ? Number(iterations) : COMPTES_ITERATIONS;
  const cle = Utilities.newBlob(String(secret)).getBytes();
  let bloc = Utilities.newBlob(String(sel) + "\n" + String(motDePasse)).getBytes();
  for (let i = 0; i < passes; i++) {
    bloc = Utilities.computeHmacSha256Signature(bloc, cle);
  }
  return passes + "$" + Utilities.base64EncodeWebSafe(bloc);
}


function verifierEmpreinteCompte_(secret, sel, motDePasse, empreinte) {
  const passes = Number(String(empreinte || "").split("$")[0]);
  return memesChainesCompte_(empreinte, empreinteMotDePasseCompte_(secret, sel, motDePasse, passes));
}


function empreinteInvitationCompte_(secret, jeton) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature("invitation:" + String(jeton), String(secret))
  );
}


function nouveauJetonInvitationCompte_() {
  return Utilities.getUuid().replace(/-/g, "");
}


function nettoyerInvitationCompte_(invitation) {
  const jeton = String(invitation || "").trim().toLowerCase();
  if (!COMPTES_INVITATION_MOTIF.test(jeton)) throw new Error(COMPTES_MESSAGE_INVITATION);
  return jeton;
}


function verifierMotDePasseCompte_(motDePasse, nom) {
  const valeur = String(motDePasse || "");
  if (valeur.length < COMPTES_MOT_DE_PASSE_MIN) {
    throw new Error("Le mot de passe doit compter au moins " + COMPTES_MOT_DE_PASSE_MIN + " caractères.");
  }
  if (valeur.length > COMPTES_MOT_DE_PASSE_MAX) {
    throw new Error("Le mot de passe est limité à " + COMPTES_MOT_DE_PASSE_MAX + " caractères.");
  }
  const cle = cleNomCompte_(valeur);
  const cleNom = cleNomCompte_(nom);
  if (cleNom && (cle === cleNom || cleNom.split(" ").filter(Boolean).some(mot => mot.length >= 4 && cle === mot))) {
    throw new Error("Le mot de passe ne doit pas être votre nom.");
  }
}


// Comparaison en temps constant, pour les empreintes.
function memesChainesCompte_(a, b) {
  const x = String(a || "");
  const y = String(b || "");
  let diff = x.length ^ y.length;
  const longueur = Math.max(x.length, y.length);
  for (let i = 0; i < longueur; i++) {
    diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  }
  return diff === 0;
}


// Même rapprochement que les fiches : sans casse, accents ni espaces superflus.
function cleNomCompte_(nom) {
  return String(nom || "").trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ").trim();
}


function nomCompletCompte_(fiche) {
  return (String(fiche.prenom || "").trim() + " " + String(fiche.nom || "").trim()).trim();
}


function sessionNominativeCompte_(auth) {
  return Boolean(auth) && (auth.via === "compte" || auth.via === "discord") &&
    Boolean(String(auth.nom || "").trim());
}


// Adresse de la Web App en service, base du lien d'invitation.
function urlWebAppCompte_() {
  const url = String((ScriptApp.getService() && ScriptApp.getService().getUrl()) || "").trim();
  if (!/^https:\/\//.test(url)) {
    throw new Error("Adresse de la Web App inconnue : le lien ne peut pas être composé.");
  }
  return url;
}
