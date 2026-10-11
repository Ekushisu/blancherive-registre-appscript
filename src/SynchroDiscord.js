/*
  Synchronisation des rôles Discord : le tableur décide.

  Feuille `RolesDiscord`, A:C (Type, Valeur, Rôle Discord), créée et préremplie
  au premier passage si elle manque ou est vide, jamais réécrite ensuite. Elle
  décide d'un rôle d'administration Discord : la protéger dans Sheets, avec le
  propriétaire seul comme éditeur.

  Types de ligne :
  - Statut : rôle de tout membre de ce statut (« En service actif » → Garde de
    Blancherive, « Réserve » → Réserviste) ;
  - À partir du grade : rôle donné, en service actif, à ce grade et à tout
    grade placé au-dessus dans `Données!A` (Lieutenant → Officier de
    Blancherive), sans exception de corps ;
  - Grade, Corps : rôle du grade régulier, jamais de l'alias, ou du corps, en
    service actif seulement.
  Une case « Rôle Discord » vide : pas de rôle. Plusieurs lignes pour une même
  valeur : plusieurs rôles. Un départ (mort, radié, déserteur, démission, tout
  statut sans ligne) ne reçoit aucun rôle géré.

  Rôles gérés : ceux que nomme la feuille, et eux seuls. Pour chaque compte
  rattaché, le bot ajoute les rôles gérés qui lui reviennent et retire les
  autres ; il ne touche à aucun autre rôle, ni aux comptes que personne n'a
  rattachés (décision du 11 octobre 2026, le temps de la passation).

  Pseudo (même décision) : « Prénom Nom » de la fiche, en service comme en
  réserve, effacé pour un départ. Le propriétaire du serveur et les membres
  dont un rôle est placé au-dessus du bot ne peuvent pas être renommés : leur
  pseudo est laissé, et le rapport le note.

  Interrupteur `DISCORD_SYNCHRO` (propriété du script) : `ACTIF` applique,
  `SIMULATION` calcule sans rien changer, toute autre valeur ou son absence
  coupe. Passages : après chaque modification d'Effectifs faite dans le
  registre, et toutes les heures par un déclencheur installé à la consultation
  des Effectifs. `simulerSynchroDiscord()`, lancée depuis l'éditeur, consigne
  le plan au journal d'exécution sans rien appliquer.

  Les appels passent par le relais (`appelerDiscordBot_`, Discord.js).
*/
const DISCORD_FEUILLE_ROLES = "RolesDiscord";
const DISCORD_ROLES_ENTETES = ["Type", "Valeur", "Rôle Discord"];

// Au-delà, le reste attend le passage suivant : un passage tient dans les
// limites de durée d'Apps Script et de débit de Discord.
const DISCORD_SYNCHRO_OPERATIONS_MAX = 80;

/*
  Préremplissage, d'après les rôles du serveur relevés par le propriétaire le
  11 octobre 2026. Chaque ligne propose des noms candidats ; le premier qui
  existe sur le serveur, sous le rôle du bot, est écrit avec son nom exact.
  Sinon la case reste vide, et le journal du passage dit pourquoi.

  Corps reconnus par un fragment du libellé de la feuille. La Cité de
  Blancherive s'appelle « Garde de Fort-Dragon » sur le serveur ; ses membres
  ont aussi, comme tout membre en service, le rôle de fonction Garde de
  Blancherive.
*/
const DISCORD_ROLES_STATUT_ACTIF = ["Garde de Blancherive"];
const DISCORD_ROLES_STATUT_RESERVE = ["Réserviste"];
const DISCORD_ROLES_SEUIL = ["Officiers de Blancherive", "Officier de Blancherive"];
const DISCORD_ROLES_GRADES_INITIAUX = [["garde", "Garde du domaine"]];
const DISCORD_ROLES_CORPS_INITIAUX = [
  ["eclaireur", "Corps des éclaireurs"],
  ["inquisition", "Brigade de l'Inquisition"],
  ["etatmajor", "Etat major"],
  ["faubourg", "Garnison des faubourgs"],
  ["rivebois", "Garnison de Rivebois"],
  ["boisdechene", "Garnison de Bois-de-Chêne"],
  ["capgranite", "Garnison de Cap Granite"],
  ["hird", "La hird du Jarl"],
  ["cite", "Garde de Fort-Dragon"]
];


// ============================================================
// POINTS D'ENTRÉE
// ============================================================

/*
  Plan de la synchronisation, au journal d'exécution, sans rien appliquer,
  quel que soit `DISCORD_SYNCHRO`. Publique pour figurer dans l'éditeur, donc
  appelable par tout visiteur : elle ne renvoie rien et ne s'exécute qu'une
  fois par minute.
*/
function simulerSynchroDiscord() {
  const cache = CacheService.getScriptCache();
  if (cache.get("DISCORD_SIMULATION")) {
    console.log("Simulation déjà lancée il y a moins d'une minute.");
    return;
  }
  cache.put("DISCORD_SIMULATION", "1", 60);

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log(decrireRapportSynchroDiscord_(synchroniserRolesDiscord_(ss, "SIMULATION")));
  } catch (e) {
    console.log("Simulation impossible : " + e.message);
  }
}


// Déclencheur horaire : applique ou simule selon `DISCORD_SYNCHRO`.
function synchroDiscordPeriodique_() {
  const mode = modeSynchroDiscord_(PropertiesService.getScriptProperties());
  if (!mode) return;
  const rapport = synchroniserRolesDiscord_(SpreadsheetApp.openById(SPREADSHEET_ID), mode);
  console.log(decrireRapportSynchroDiscord_(rapport));
}


/*
  Après une modification d'Effectifs faite dans le registre, hors du verrou
  des mutations. Applique seulement en mode ACTIF ; une panne de Discord ou du
  relais n'empêche jamais l'enregistrement de la fiche : le passage horaire
  rattrapera.
*/
function appliquerRolesDiscordApresModification_(ss, historique) {
  if (modeSynchroDiscord_(PropertiesService.getScriptProperties()) !== "ACTIF") return;
  try {
    synchroniserRolesDiscord_(ss, "ACTIF", historique && historique.accesDiscord);
  } catch (e) {
    console.error("Synchronisation Discord après modification : " + e.message);
  }
}


// Installation idempotente du passage horaire, dès que l'interrupteur existe.
function installerDeclencheurSynchroDiscord_() {
  const props = PropertiesService.getScriptProperties();
  const cle = "DISCORD_SYNCHRO_DECLENCHEUR_V1";
  if (!modeSynchroDiscord_(props) || props.getProperty(cle)) return;

  const existe = ScriptApp.getProjectTriggers().some(t =>
    t.getHandlerFunction() === "synchroDiscordPeriodique_");
  if (!existe) ScriptApp.newTrigger("synchroDiscordPeriodique_").timeBased().everyHours(1).create();
  props.setProperty(cle, "1");
}


function modeSynchroDiscord_(props) {
  const valeur = String(props.getProperty("DISCORD_SYNCHRO") || "").trim().toUpperCase();
  return valeur === "ACTIF" || valeur === "SIMULATION" ? valeur : "";
}


// ============================================================
// PASSAGE
// ============================================================

/*
  Un passage complet. `index` : comptes rattachés déjà calculés par la
  synchronisation de l'historique ; à défaut, elle est relancée. Un seul
  passage à la fois : un second, lancé pendant le premier, s'abstient.
*/
function synchroniserRolesDiscord_(ss, mode, index) {
  const cache = CacheService.getScriptCache();
  if (cache.get("DISCORD_SYNCHRO_EN_COURS")) {
    return { mode, ignore: true };
  }
  cache.put("DISCORD_SYNCHRO_EN_COURS", "1", 300);

  try {
    const config = lireConfigBotDiscord_();
    const bot = appelerDiscordBot_(config, "/users/@me");
    const serveurDiscord = appelerDiscordBot_(config, "/guilds/" + config.guildId) || {};
    const rolesServeur = appelerDiscordBot_(config, "/guilds/" + config.guildId + "/roles") || [];
    const membres = lireMembresServeurDiscord_(config);
    const positionBot = positionBotDiscord_(bot, membres, rolesServeur);
    const notes = [];
    const lecture = lireReglesRolesDiscord_(ss, { roles: rolesServeur, positionBot, guildId: config.guildId, notes });
    const comptes = index || synchroniserHistoriqueEffectifs_(ss).accesDiscord;

    const resolution = resoudreRolesDiscord_(lecture.regles, rolesServeur, positionBot, config.guildId);
    const plan = planifierRolesDiscord_(comptes, membres, resolution.regles, lecture.ordre, resolution.geres, {
      positionBot,
      positions: new Map(rolesServeur.map(r => [String(r.id), Number(r.position) || 0])),
      proprietaire: String(serveurDiscord.owner_id || ""),
      notes
    });

    if (!resolution.geres.size) {
      notes.push("La feuille RolesDiscord ne désigne aucun rôle du serveur : rien n'est géré. Pour la faire préremplir, effacer ses lignes (l'en-tête peut rester) ou la supprimer.");
    }

    const nomsRoles = new Map(rolesServeur.map(r => [String(r.id), String(r.name)]));
    const rapport = {
      mode,
      ajouts: 0,
      retraits: 0,
      pseudos: 0,
      erreurs: [],
      anomalies: lecture.anomalies.concat(resolution.anomalies),
      notes,
      absents: plan.absents,
      reste: 0,
      operations: plan.operations.map(op => Object.assign({
        libelle: op.methode === "patch" ? "pseudo « " + (op.pseudo || "effacé") + " »" : nomsRoles.get(op.role) || op.role
      }, op))
    };

    if (mode === "ACTIF") executerPlanDiscord_(config, rapport);

    enregistrerRapportSynchroDiscord_(rapport);
    return rapport;
  } finally {
    cache.remove("DISCORD_SYNCHRO_EN_COURS");
  }
}


/*
  Exécute les opérations, ajouts de rôles d'abord, puis retraits, puis
  pseudos : un membre ne perd pas l'accès à un salon le temps de changer de
  grade. Une limitation de débit arrête le passage et laisse le reste au
  suivant ; toute autre erreur est consignée et le passage continue.
*/
function executerPlanDiscord_(config, rapport) {
  const operations = rapport.operations.slice(0, DISCORD_SYNCHRO_OPERATIONS_MAX);
  rapport.reste = rapport.operations.length - operations.length;

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    const membre = "/guilds/" + config.guildId + "/members/" + op.discordId;
    try {
      if (op.methode === "patch") {
        appelerDiscordBot_(config, membre, null,
          { method: "patch", corps: { nick: op.pseudo }, raison: "Registre de la Garde : pseudo de la fiche " + op.motif });
        rapport.pseudos++;
      } else {
        appelerDiscordBot_(config, membre + "/roles/" + op.role, null,
          { method: op.methode, raison: "Registre de la Garde : " + op.motif });
        if (op.methode === "put") rapport.ajouts++;
        else rapport.retraits++;
      }
    } catch (e) {
      if (e.statut === 429) {
        rapport.reste += operations.length - i;
        rapport.erreurs.push("Discord limite les requêtes : le reste attend le passage suivant.");
        return;
      }
      rapport.erreurs.push(op.nom + " — " + op.libelle + " : " + e.message);
    }
  }
}


// ============================================================
// FEUILLE RolesDiscord
// ============================================================

/*
  `serveur` : { roles, positionBot, guildId, notes } — rôles du serveur, pour
  ne préremplir que des rôles existants que le bot peut donner ; les cases
  laissées vides sont expliquées dans `notes`.
*/
function garantirFeuilleRolesDiscord_(ss, serveur) {
  let feuille = ss.getSheetByName(DISCORD_FEUILLE_ROLES);
  if (feuille && feuille.getLastRow() > 0) {
    const entetes = feuille.getRange(1, 1, 1, 3).getDisplayValues()[0];
    if (entetes.some((entete, i) => entete !== DISCORD_ROLES_ENTETES[i])) {
      throw new Error("La feuille RolesDiscord existe avec d'autres en-têtes que Type, Valeur, Rôle Discord. Rien n'est appliqué.");
    }
    // Réduite à ses en-têtes, elle est vide : préremplie de nouveau.
    if (feuille.getLastRow() > 1) return feuille;
  }
  if (!feuille) feuille = ss.insertSheet(DISCORD_FEUILLE_ROLES);

  const choisir = (libelle, candidats) => choisirRoleInitialDiscord_(libelle, candidats, serveur);
  const lignes = [
    DISCORD_ROLES_ENTETES,
    ["Statut", EFFECTIFS_WEB_ACTIVE_STATUS, choisir(EFFECTIFS_WEB_ACTIVE_STATUS, DISCORD_ROLES_STATUT_ACTIF)],
    ["Statut", EFFECTIFS_WEB_RESERVE_STATUS, choisir(EFFECTIFS_WEB_RESERVE_STATUS, DISCORD_ROLES_STATUT_RESERVE)],
    ["À partir du grade", "Lieutenant", choisir("à partir de Lieutenant", DISCORD_ROLES_SEUIL)]
  ];
  lireColonneDonneesDiscord_(ss, 1).forEach(grade => {
    const special = DISCORD_ROLES_GRADES_INITIAUX.find(([cle]) => cle === cleGradeDiscord_(grade));
    lignes.push(["Grade", grade, choisir(grade, special ? [special[1], grade] : [grade])]);
  });
  lireColonneDonneesDiscord_(ss, 7).forEach(corps => {
    const cle = cleGradeDiscord_(corps);
    const trouve = DISCORD_ROLES_CORPS_INITIAUX.find(([fragment]) => cle.includes(fragment));
    lignes.push(["Corps", corps, trouve ? choisir(corps, [trouve[1]]) : ""]);
  });

  feuille.getRange(1, 1, lignes.length, 3).setNumberFormat("@").setValues(lignes);
  feuille.setFrozenRows(1);
  serveur.notes.unshift("Feuille RolesDiscord créée et préremplie : la relire avant de passer DISCORD_SYNCHRO à ACTIF.");
  return feuille;
}


// Premier candidat présent sur le serveur et placé sous le bot, sous son nom exact.
function choisirRoleInitialDiscord_(libelle, candidats, serveur) {
  for (const candidat of candidats) {
    const role = serveur.roles.find(r => cleRoleDiscord_(r.name) === cleRoleDiscord_(candidat));
    if (!role) continue;
    if ((Number(role.position) || 0) >= serveur.positionBot || String(role.id) === String(serveur.guildId) || role.managed) {
      serveur.notes.push("« " + role.name + " » (" + libelle + ") est placé au-dessus du rôle du bot : case laissée vide. Remonter le rôle du bot pour le confier à la synchronisation.");
      return "";
    }
    return String(role.name);
  }
  serveur.notes.push("Aucun rôle « " + candidats[0] + " » sur le serveur (" + libelle + ") : case laissée vide.");
  return "";
}


// Valeurs de `Données`, colonne A (grades) ou G (corps), dans leur ordre.
function lireColonneDonneesDiscord_(ss, colonne) {
  const donnees = ss.getSheetByName(EFFECTIFS_WEB_DONNEES_SHEET_NAME);
  if (!donnees || donnees.getLastRow() < 2) return [];
  return donnees
    .getRange(2, colonne, donnees.getLastRow() - 1, 1)
    .getDisplayValues()
    .map(ligne => nettoyerEffectifsWeb_(ligne[0]))
    .filter(Boolean);
}


/*
  Règles de la feuille, rôles encore désignés par leur nom. Une ligne illisible
  est écartée et signalée avec son numéro, jamais devinée.
*/
function lireReglesRolesDiscord_(ss, serveur) {
  const feuille = garantirFeuilleRolesDiscord_(ss, serveur);
  const derniere = feuille.getLastRow();
  const lignes = derniere >= 2 ? feuille.getRange(2, 1, derniere - 1, 3).getDisplayValues() : [];
  const ordre = lireOrdreGradesDiscord_(ss);
  const regles = { statut: new Map(), grade: new Map(), corps: new Map(), seuils: [] };
  const anomalies = [];
  const ajouter = (table, cle, regle) => {
    if (!table.has(cle)) table.set(cle, []);
    table.get(cle).push(regle);
  };

  lignes.forEach((ligne, i) => {
    const numero = i + 2;
    const type = cleGradeDiscord_(ligne[0]);
    const valeur = nettoyerEffectifsWeb_(ligne[1]);
    const role = nettoyerEffectifsWeb_(ligne[2]).replace(/^@+/, "").trim();
    if (!role) return;

    if (!valeur) {
      anomalies.push("Ligne " + numero + " : valeur manquante, ligne ignorée.");
      return;
    }

    const regle = { role, numero };
    if (type === "statut") {
      ajouter(regles.statut, normaliserEffectifsWeb_(valeur), regle);
    } else if (type === "grade") {
      ajouter(regles.grade, cleGradeDiscord_(valeur), regle);
    } else if (type === "corps") {
      ajouter(regles.corps, cleGradeDiscord_(valeur), regle);
    } else if (type === "apartirdugrade") {
      const rang = ordre.indexOf(cleGradeDiscord_(valeur));
      if (rang < 0) {
        anomalies.push("Ligne " + numero + " : grade « " + valeur + " » absent de Données, ligne ignorée.");
      } else {
        regles.seuils.push(Object.assign({ rang }, regle));
      }
    } else {
      anomalies.push("Ligne " + numero + " : type « " + ligne[0] + " » inconnu (Statut, À partir du grade, Grade ou Corps), ligne ignorée.");
    }
  });

  return { regles, anomalies, ordre };
}


/*
  « @Garde de Blancherive », « garde de blancherive » : le même rôle. Casse,
  accents, espaces, tirets et apostrophes (droites ou typographiques) sont
  indifférents ; deux rôles du serveur réduits à la même clé sont signalés
  comme doublon.
*/
function cleRoleDiscord_(nom) {
  return normaliserEffectifsWeb_(String(nom || "").replace(/^@+/, "")).replace(/[^a-z0-9]/g, "");
}


// Position du plus haut rôle du bot : il ne peut donner que des rôles placés en dessous.
function positionBotDiscord_(bot, membres, rolesServeur) {
  const membre = membres.find(m => String(m.user.id) === String(bot && bot.id));
  if (!membre) return 0;
  const positions = new Map(rolesServeur.map(r => [String(r.id), Number(r.position) || 0]));
  return Math.max(0, ...(membre.roles || []).map(id => positions.get(String(id)) || 0));
}


/*
  Remplace chaque nom de rôle par son identifiant. Un nom introuvable, porté
  par deux rôles, réservé (@everyone, rôle d'intégration) ou placé au-dessus
  du bot est signalé, et sa ligne ignorée. `geres` : tous les rôles résolus,
  les seuls que le bot retirera.
*/
function resoudreRolesDiscord_(reglesNoms, rolesServeur, positionBot, guildId) {
  const parNom = new Map();
  rolesServeur.forEach(role => {
    const cle = cleRoleDiscord_(role.name);
    if (!parNom.has(cle)) parNom.set(cle, []);
    parNom.get(cle).push(role);
  });

  const anomalies = [];
  const geres = new Set();
  const resoudre = regle => {
    const trouves = parNom.get(cleRoleDiscord_(regle.role)) || [];
    const prefixe = "Ligne " + regle.numero + " : « " + regle.role + " » ";
    if (!trouves.length) {
      anomalies.push(prefixe + "introuvable sur le serveur, ligne ignorée.");
      return null;
    }
    if (trouves.length > 1) {
      anomalies.push(prefixe + "désigne plusieurs rôles du serveur : en renommer un. Ligne ignorée.");
      return null;
    }
    const role = trouves[0];
    if (String(role.id) === String(guildId) || role.managed) {
      anomalies.push(prefixe + "est @everyone ou un rôle d'intégration, que le bot ne peut pas donner. Ligne ignorée.");
      return null;
    }
    if ((Number(role.position) || 0) >= positionBot) {
      anomalies.push(prefixe + "est placé au-dessus du rôle du bot : le remonter dans les paramètres du serveur. Ligne ignorée.");
      return null;
    }
    geres.add(String(role.id));
    return String(role.id);
  };
  const convertir = table => {
    const resultat = new Map();
    table.forEach((liste, cle) => {
      const ids = liste.map(resoudre).filter(Boolean);
      if (ids.length) resultat.set(cle, ids);
    });
    return resultat;
  };

  const regles = {
    statut: convertir(reglesNoms.statut),
    grade: convertir(reglesNoms.grade),
    corps: convertir(reglesNoms.corps),
    seuils: reglesNoms.seuils
      .map(seuil => ({ rang: seuil.rang, id: resoudre(seuil) }))
      .filter(seuil => seuil.id)
  };
  return { regles, geres, anomalies };
}


// Rôles gérés qui reviennent à une fiche.
function rolesVoulusDiscord_(acces, regles, ordre) {
  const voulus = new Set();
  const ajouter = ids => (ids || []).forEach(id => voulus.add(id));
  const statut = normaliserEffectifsWeb_(acces.statut);

  ajouter(regles.statut.get(statut));

  if (statut === normaliserEffectifsWeb_(EFFECTIFS_WEB_ACTIVE_STATUS)) {
    ajouter(regles.grade.get(cleGradeDiscord_(acces.grade)));
    ajouter(regles.corps.get(cleGradeDiscord_(acces.corps)));
    const rang = ordre.indexOf(cleGradeDiscord_(acces.grade));
    regles.seuils.forEach(seuil => {
      if (rang >= 0 && rang <= seuil.rang) voulus.add(seuil.id);
    });
  }

  return voulus;
}


/*
  Pseudo d'une fiche (décision du propriétaire, 11 octobre 2026) : « Prénom
  Nom » d'Effectifs, en service comme en réserve ; `null` (pseudo effacé, le
  compte reprend son propre nom) pour un départ. Trente-deux caractères au
  plus, limite de Discord.
*/
function pseudoVouluDiscord_(acces) {
  const statut = normaliserEffectifsWeb_(acces.statut);
  const enFonction =
    statut === normaliserEffectifsWeb_(EFFECTIFS_WEB_ACTIVE_STATUS) ||
    statut === normaliserEffectifsWeb_(EFFECTIFS_WEB_RESERVE_STATUS);
  if (!enFonction) return null;

  const caracteres = [...String(acces.nom || "").trim()];
  if (!caracteres.length) return null;
  return caracteres.length > 32 ? caracteres.slice(0, 31).join("") + "…" : caracteres.join("");
}


/*
  Opérations à faire : seulement pour les comptes rattachés et présents sur
  le serveur ; rôles gérés seulement, puis pseudo. Les comptes que personne
  n'a rattachés ne figurent pas dans `comptes` : ils ne sont jamais touchés.

  `contexte` : position du bot, positions des rôles et propriétaire du
  serveur. Discord interdit de renommer le propriétaire ou un membre dont un
  rôle est placé au-dessus du bot : son pseudo est laissé, et une note le dit.
*/
function planifierRolesDiscord_(comptes, membres, regles, ordre, geres, contexte) {
  const parId = new Map(membres.map(m => [String(m.user.id), m]));
  const ajouts = [], retraits = [], pseudos = [];
  let absents = 0;

  comptes.forEach((acces, discordId) => {
    if (acces.anomalie) return;
    const membre = parId.get(discordId);
    if (!membre) {
      absents++;
      return;
    }
    const actuels = (membre.roles || []).map(String);

    const voulus = rolesVoulusDiscord_(acces, regles, ordre);
    const motif = acces.nom + " (" + [acces.statut, acces.grade, acces.corps].filter(Boolean).join(", ") + ")";
    voulus.forEach(role => {
      if (!actuels.includes(role)) ajouts.push({ methode: "put", discordId, role, nom: acces.nom, motif });
    });
    actuels.forEach(role => {
      if (geres.has(role) && !voulus.has(role)) retraits.push({ methode: "delete", discordId, role, nom: acces.nom, motif });
    });

    if (!contexte) return;
    const pseudo = pseudoVouluDiscord_(acces);
    const actuel = membre.nick ? String(membre.nick) : null;
    if (pseudo === actuel) return;

    const plusHaut = Math.max(0, ...actuels.map(role => contexte.positions.get(role) || 0));
    if (discordId === contexte.proprietaire || plusHaut >= contexte.positionBot) {
      contexte.notes.push("Pseudo de " + acces.nom + " laissé tel quel : " +
        (discordId === contexte.proprietaire ? "propriétaire du serveur" : "un de ses rôles est placé au-dessus du bot") + ".");
      return;
    }
    pseudos.push({ methode: "patch", discordId, pseudo, ancien: actuel, nom: acces.nom, motif });
  });

  return { operations: ajouts.concat(retraits, pseudos), absents };
}


// ============================================================
// RAPPORT
// ============================================================

// Résumé du dernier passage, lu par le diagnostic de l'éditeur.
function enregistrerRapportSynchroDiscord_(rapport) {
  PropertiesService.getScriptProperties().setProperty("DISCORD_SYNCHRO_RAPPORT", JSON.stringify({
    date: new Date().toISOString(),
    mode: rapport.mode,
    prevues: rapport.operations.length,
    ajouts: rapport.ajouts,
    retraits: rapport.retraits,
    pseudos: rapport.pseudos,
    erreurs: rapport.erreurs.length,
    anomalies: rapport.anomalies.length,
    reste: rapport.reste
  }));
}


function decrireRapportSynchroDiscord_(rapport) {
  if (rapport.ignore) return "Synchronisation Discord : un passage est déjà en cours, celui-ci s'abstient.";

  const lignes = ["Synchronisation Discord — " + (rapport.mode === "ACTIF" ? "appliquée" : "simulation, rien n'est changé")];
  if (rapport.mode === "ACTIF") {
    lignes.push(rapport.ajouts + " rôle(s) ajouté(s), " + rapport.retraits + " retiré(s), " +
      rapport.pseudos + " pseudo(s) changé(s)" +
      (rapport.reste ? ", " + rapport.reste + " au passage suivant" : "") + ".");
  } else {
    lignes.push(rapport.operations.length ? "Opérations prévues :" : "Aucune opération : tout est déjà à jour.");
    rapport.operations.forEach(op => lignes.push(op.methode === "patch"
      ? "  ✎ " + op.libelle + " — " + op.nom + " (aujourd'hui : " + (op.ancien ? "« " + op.ancien + " »" : "sans pseudo") + ")"
      : (op.methode === "put" ? "  + " : "  − ") + op.libelle + " — " + op.motif));
  }
  if (rapport.notes && rapport.notes.length) lignes.push("Notes :", ...rapport.notes.map(n => "  • " + n));
  if (rapport.absents) lignes.push(rapport.absents + " compte(s) rattaché(s) absent(s) du serveur Discord.");
  if (rapport.anomalies.length) lignes.push("Feuille RolesDiscord :", ...rapport.anomalies.map(a => "  ! " + a));
  if (rapport.erreurs.length) lignes.push("Erreurs :", ...rapport.erreurs.map(e => "  ✗ " + e));
  return lignes.join("\n");
}
