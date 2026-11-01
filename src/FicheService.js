/*
  Fiche de service : la page d'un effectif, ouverte en cliquant sur son nom
  partout où le registre l'affiche (décision du propriétaire, 1er novembre
  2026). Elle reprend le Livret de service, qui n'existait qu'en session
  Discord et ne montrait que son propre membre.

  Lecture seule, pour GARDE, OFFICIER et INTENDANT, sur n'importe quel
  effectif, départs compris : identité, chaîne de commandement, carrière,
  solde et service, justice. Un GARDE n'y lit rien que les Présences, les
  Amendes et la Prison ne lui montrent déjà. L'INTENDANT, qui n'a accès ni
  aux Amendes ni à la Prison, ne reçoit pas la Justice : elle n'est même pas
  lue pour lui (`justice: null`). Le visiteur du Codex n'y a jamais accès.

  Deux entrées, un seul calcul : `getFichesService` renvoie toutes les fiches,
  chargées en arrière-plan au lancement de l'application (même décision) ;
  `getFicheService` renvoie celle qu'on ouvre, pour la rafraîchir en silence.
  Chaque feuille n'est lue qu'une fois par appel, ses lignes rangées par
  effectif (`lireRegistreFiches_`), puis chaque fiche en est tirée
  (`construireFiche_`).

  L'effectif est désigné par son ID membre quand la page qui l'affiche le
  connaît (Organigramme, Effectifs, nouveautés, chaîne de commandement),
  sinon par son nom (Présences, Paye, Amendes, Prison). Présences, Amendes et
  Prison désignent elles aussi un garde par son nom : les lignes sont
  rapprochées du « Prénom Nom » de la fiche, sans casse, accents ni espaces
  superflus. Un membre renommé depuis les Effectifs garde ses Présences, ses
  amendes et ses incarcérations, réécrites à son nouveau nom
  (`renommerMembrePresences_`, `renommerGardeRegistres_`).
*/
const FICHE_DERNIERES = 5;
const FICHE_ROLES = ["GARDE", "OFFICIER", "INTENDANT"];


// `cible` : { membre: ID membre } ou { nom: "Prénom Nom" } ; l'ID prime.
function getFicheService(token, cible) {
  const auth = requireRole(token, FICHE_ROLES);

  const membre = String((cible && cible.membre) || "").trim();
  const cleNom = cleNomFiche_((cible && cible.nom) || "");

  if (!membre && !cleNom) {
    throw new Error("Effectif non précisé.");
  }

  const registre = lireRegistreFiches_(SpreadsheetApp.openById(SPREADSHEET_ID), auth.role);
  const fiche =
    (membre && registre.effectifs.find(m => m.id === membre)) ||
    (cleNom && registre.effectifs.find(m => cleNomFiche_(m.nomComplet) === cleNom));

  if (!fiche) {
    throw new Error("Aucune fiche à ce nom dans les Effectifs.");
  }

  return construireFiche_(registre, fiche);
}


// Toutes les fiches, pour le chargement au lancement : mêmes droits, même contenu.
function getFichesService(token) {
  const auth = requireRole(token, FICHE_ROLES);
  const registre = lireRegistreFiches_(SpreadsheetApp.openById(SPREADSHEET_ID), auth.role);

  return {
    fiches: registre.effectifs.map(fiche => construireFiche_(registre, fiche))
  };
}


function cleNomFiche_(valeur) {
  return normaliserEffectifsWeb_(valeur).replace(/\s+/g, " ").trim();
}


// ============================================================
// LECTURE — une fois par appel, lignes rangées par effectif
// ============================================================

function lireRegistreFiches_(ss, role) {
  // L'intendance n'a accès ni aux Amendes ni à la Prison : rien n'en est lu pour elle.
  const justice = role !== "INTENDANT";
  return {
    effectifs: lireEffectifsFiche_(ss),
    ordre: lireOrdreGradesDiscord_(ss),
    journal: lireJournalFiche_(ss),
    presences: lirePresencesFiche_(ss),
    amendes: justice ? lireLignesParGardeFiche_(ss, AMENDES_SHEET_NAME, 7) : null,
    prison: justice ? lireLignesParGardeFiche_(ss, PRISON_SHEET_NAME, 9) : null
  };
}


function construireFiche_(registre, fiche) {
  const cle = cleNomFiche_(fiche.nomComplet);
  return {
    fiche: {
      memberId: fiche.id,
      prenom: fiche.prenom,
      nom: fiche.nom,
      nomComplet: fiche.nomComplet,
      grade: fiche.grade,
      corps: fiche.corps,
      specialite: fiche.specialite,
      statut: fiche.statut,
      assermente: fiche.assermente
    },
    commandement: commandementFiche_(registre.effectifs, fiche, registre.ordre),
    carriere: carriereFiche_(registre.journal, fiche.id),
    service: serviceFiche_(registre.presences, fiche),
    justice: registre.amendes
      ? {
          amendes: amendesFiche_(registre.amendes.get(cle) || []),
          prison: prisonFiche_(registre.prison.get(cle) || [])
        }
      : null
  };
}


// Lignes d'Amendes ou de Prison rangées par garde (colonne B), dans l'ordre de la feuille.
function lireLignesParGardeFiche_(ss, nomFeuille, largeur) {
  const parGarde = new Map();
  const sheet = ss.getSheetByName(nomFeuille);
  if (!sheet) return parGarde;
  const lastRow = getLastNonEmptyRowInColumn(sheet, 1);
  if (lastRow < 2) return parGarde;

  const range = sheet.getRange(2, 1, lastRow - 1, largeur);
  const values = range.getValues();
  const display = range.getDisplayValues();

  values.forEach((row, i) => {
    const cle = cleNomFiche_(display[i][1]);
    if (!cle) return;
    if (!parGarde.has(cle)) parGarde.set(cle, []);
    parGarde.get(cle).push({ row, display: display[i] });
  });
  return parGarde;
}


// ============================================================
// FICHE ET COMMANDEMENT
// ============================================================

function lireEffectifsFiche_(ss) {
  const sheet = ss.getSheetByName(EFFECTIFS_WEB_SHEET_NAME);
  if (!sheet) throw new Error('Feuille "Effectifs" introuvable.');

  const schema = lireSchemaEffectifsWeb_(sheet);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2) return [];

  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const colonneId = headers.findIndex(h => normaliserEffectifsWeb_(h) === "id membre");
  const range = sheet.getRange(2, 1, lastRow - 1, lastColumn);
  const values = range.getValues();
  const display = range.getDisplayValues();

  return display.map((ligne, i) => {
    const prenom = nettoyerEffectifsWeb_(ligne[schema.prenom]);
    const nom = nettoyerEffectifsWeb_(ligne[schema.nom]);
    return {
      id: colonneId >= 0 ? nettoyerEffectifsWeb_(ligne[colonneId]) : "",
      prenom,
      nom,
      nomComplet: (prenom + " " + nom).trim(),
      grade: nettoyerEffectifsWeb_(ligne[schema.grade]),
      corps: nettoyerEffectifsWeb_(ligne[schema.corps]),
      specialite: nettoyerEffectifsWeb_(ligne[schema.specialite]),
      statut: nettoyerEffectifsWeb_(ligne[schema.status]),
      assermente: values[i][schema.assermente] === true
    };
  }).filter(membre => membre.nomComplet);
}


/*
  Supérieurs en service actif : dans le corps du membre, ceux d'un grade plus
  élevé à partir de Sergent-Chef ; puis l'État-Major, sauf pour l'État-Major
  lui-même et le Hird du Jarl, qui ne répond qu'au Jarl. Ordre de `Données!A`.

  Le sommet est rendu à part (`jarl`) pour tous les autres membres, quel que
  soit leur corps : le Jarl en service actif, à défaut le ou les Régents
  impériaux. Le Huscarl est un grade à part, sous l'autorité directe du Jarl :
  il ne figure dans la chaîne de personne, et la sienne ne compte que le Jarl ;
  sous régence, elle est vide.
*/
function commandementFiche_(effectifs, fiche, ordre) {
  const actif = normaliserEffectifsWeb_(EFFECTIFS_WEB_ACTIVE_STATUS);
  const rang = membre => {
    const index = ordre.indexOf(cleGradeDiscord_(membre.grade));
    return index < 0 ? Infinity : index;
  };
  const seuil = ordre.indexOf(cleGradeDiscord_(DISCORD_SEUIL_OFFICIER));
  // L'ID membre permet d'ouvrir la fiche d'un supérieur depuis celle-ci.
  const presenter = membre => ({ memberId: membre.id, nomComplet: membre.nomComplet, grade: membre.grade, corps: membre.corps });
  const enService = effectifs.filter(m => m.id !== fiche.id && normaliserEffectifsWeb_(m.statut) === actif);
  const memeCorps = (a, b) => cleGradeDiscord_(a) === cleGradeDiscord_(b);
  const etatMajor = corps => cleGradeDiscord_(corps) === "etatmajor";
  const hird = corps => cleGradeDiscord_(corps).includes("hird");

  if (estGradeJarl(fiche.grade) || estGradeRegent(fiche.grade)) return { corps: [], etatMajor: [], jarl: [] };

  const jarl = enService.filter(m => estGradeJarl(m.grade)).map(presenter);
  if (estGradeHuscarl(fiche.grade)) return { corps: [], etatMajor: [], jarl };
  const sommet = jarl.length ? jarl : enService.filter(m => estGradeRegent(m.grade)).map(presenter);

  const chaine = enService.filter(m => !estGradeJarl(m.grade) && !estGradeRegent(m.grade) && !estGradeHuscarl(m.grade));

  const corps = chaine
    .filter(m => memeCorps(m.corps, fiche.corps) && rang(m) < rang(fiche) && rang(m) <= seuil)
    .sort((a, b) => rang(a) - rang(b))
    .map(presenter);

  const etatMajorListe = etatMajor(fiche.corps) || hird(fiche.corps)
    ? []
    : chaine.filter(m => etatMajor(m.corps)).sort((a, b) => rang(a) - rang(b)).map(presenter);

  return { corps, etatMajor: etatMajorListe, jarl: sommet };
}


// ============================================================
// CARRIÈRE — journal HistoriqueEffectifs
// ============================================================

// Ouverture du journal et lignes de chaque membre, dans l'ordre du journal.
function lireJournalFiche_(ss) {
  const journal = { ouverture: null, parMembre: new Map() };
  const sheet = ss.getSheetByName("HistoriqueEffectifs");
  if (!sheet || sheet.getLastRow() < 2) return journal;

  sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues().forEach(l => {
    if (l[3] === "initialisation" && !journal.ouverture) journal.ouverture = l;
    const membre = String(l[2] || "");
    if (!membre) return;
    if (!journal.parMembre.has(membre)) journal.parMembre.set(membre, []);
    journal.parMembre.get(membre).push(l);
  });
  return journal;
}


/*
  Inscription : premier événement du membre. S'il date de l'ouverture du
  journal (événement « initialisation »), le membre était déjà là : son
  arrivée réelle est inconnue. Événements : arrivée, grade et corps, du plus
  récent au plus ancien. Sans ID membre, aucun événement ne lui est rattaché.
*/
function carriereFiche_(journal, membreId) {
  const miens = (membreId && journal.parMembre.get(String(membreId))) || [];
  if (!miens.length) return { inscription: "", avantJournal: false, evenements: [] };

  const evenements = [];
  miens.forEach(l => {
    if (l[3] !== "changement") return;
    let changements = [];
    try { changements = JSON.parse(String(l[5] || "[]")); } catch (e) { changements = []; }
    changements.forEach(c => evenements.push({
      date: String(l[1]),
      type: String(c.type || ""),
      avant: String(c.avant || ""),
      apres: String(c.apres || "")
    }));
  });
  evenements.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const premier = String(miens[0][1]);
  return {
    inscription: premier,
    avantJournal: Boolean(journal.ouverture) && String(journal.ouverture[1]) === premier,
    evenements
  };
}


// ============================================================
// SOLDE ET SERVICE — Présences
// ============================================================

// Soldes à jour, comme la page Présences (Presences.js), puis lignes rangées par garde.
function lirePresencesFiche_(ss) {
  const presences = { lundiCourant: lundiCourantPresence_(), parNom: new Map() };
  const sheet = ss.getSheetByName(PRESENCES_SHEET_NAME);
  if (!sheet) return presences;

  mettreAJourSoldesPresences_(ss, sheet);
  SpreadsheetApp.flush();

  const lastRow = getLastPresenceRowWebApp(sheet);
  if (lastRow < 2) return presences;

  const range = sheet.getRange(2, 1, lastRow - 1, 15);
  const values = range.getValues();
  const display = range.getDisplayValues();

  values.forEach((row, i) => {
    const cle = cleNomFiche_(display[i][3] + " " + display[i][4]);
    if (!cle) return;
    if (!presences.parNom.has(cle)) presences.parNom.set(cle, []);
    presences.parNom.get(cle).push({ row, display: display[i] });
  });
  return presences;
}


function serviceFiche_(presences, fiche) {
  const lundiCourant = presences.lundiCourant;
  const resultat = {
    lundiCourant,
    exclu: estExcluDesPresences_(fiche.corps, fiche.grade),
    semaineCourante: null,
    enAttente: [],
    totalEnAttente: 0,
    totalPercu: 0,
    derniereSemaineReglee: "",
    joursTotal: 0,
    semainesServies: 0,
    moyenne: 0,
    serie: 0,
    dernierJour: "",
    joursDepuis: null,
    inactif: false,
    seuilInactivite: PRESENCE_DASHBOARD_INACTIVITY_DAYS
  };
  if (resultat.exclu) return resultat;

  const semaines = [];

  (presences.parNom.get(cleNomFiche_(fiche.nomComplet)) || []).forEach(({ row, display }) => {
    const lundi = normaliserLundiPresence_(row[0], lundiCourant);
    if (!estLundiPresence_(lundi) || estExcluDesPresences_(display[1], display[2])) return;
    semaines.push({
      lundi,
      corps: String(display[1] || "").trim(),
      grade: String(display[2] || "").trim(),
      jours: [5, 6, 7, 8, 9, 10, 11].map(c => row[c] === true),
      joursPresents: Number(row[12]) || 0,
      solde: Number(row[13]) || 0,
      paye: row[14] === true
    });
  });

  semaines.sort((a, b) => comparerLundisPresence_(b.lundi, a.lundi));
  const financeur = semaine => trouverFinanceurPaye_(semaine.corps).libelle;

  const courante = semaines.find(s => s.lundi === lundiCourant);
  if (courante) {
    resultat.semaineCourante = {
      lundi: courante.lundi,
      jours: courante.jours,
      joursPresents: courante.joursPresents,
      solde: courante.solde,
      financeur: financeur(courante)
    };
  }

  semaines.forEach(s => {
    resultat.joursTotal += s.joursPresents;
    if (s.joursPresents > 0) resultat.semainesServies++;
    if (s.paye && s.solde > 0) {
      resultat.totalPercu += s.solde;
      if (!resultat.derniereSemaineReglee || comparerLundisPresence_(s.lundi, resultat.derniereSemaineReglee) > 0) {
        resultat.derniereSemaineReglee = s.lundi;
      }
    }
    // Même définition que la page Paye : semaine close, solde due, non réglée.
    if (s.lundi !== lundiCourant && comparerLundisPresence_(s.lundi, lundiCourant) < 0 && s.solde > 0 && !s.paye) {
      resultat.enAttente.push({ lundi: s.lundi, joursPresents: s.joursPresents, solde: s.solde, financeur: financeur(s) });
      resultat.totalEnAttente += s.solde;
    }
    s.jours.forEach((present, jour) => {
      if (!present) return;
      const date = decalerDateFiche_(s.lundi, jour);
      if (!resultat.dernierJour || date > resultat.dernierJour) resultat.dernierJour = date;
    });
  });

  resultat.moyenne = resultat.semainesServies
    ? Math.round(resultat.joursTotal / resultat.semainesServies * 10) / 10
    : 0;

  // Série : semaines consécutives servies, la semaine en cours comprise si
  // elle compte déjà un jour, sinon à partir de la précédente.
  const servies = new Set(semaines.filter(s => s.joursPresents > 0).map(s => s.lundi));
  let semaine = servies.has(lundiCourant) ? lundiCourant : decalerDateFiche_(lundiCourant, -7);
  while (servies.has(semaine)) {
    resultat.serie++;
    semaine = decalerDateFiche_(semaine, -7);
  }

  if (resultat.dernierJour) {
    resultat.joursDepuis = ecartJoursFiche_(resultat.dernierJour, dateCivileStockholm_());
  }
  resultat.inactif =
    normaliserEffectifsWeb_(fiche.statut) === normaliserEffectifsWeb_(EFFECTIFS_WEB_ACTIVE_STATUS) &&
    (resultat.joursDepuis === null || resultat.joursDepuis > PRESENCE_DASHBOARD_INACTIVITY_DAYS);

  return resultat;
}


function decalerDateFiche_(iso, jours) {
  const date = new Date(iso + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + jours);
  return date.toISOString().slice(0, 10);
}


function ecartJoursFiche_(depuis, jusqua) {
  return Math.round((new Date(jusqua + "T00:00:00Z") - new Date(depuis + "T00:00:00Z")) / 86400000);
}


// ============================================================
// JUSTICE — Amendes et Prison
// ============================================================

/*
  Amendes dressées par le membre. À encaisser : non payées, montant fixé ou à
  déterminer. À reverser : payées, pas encore reversées aux trésoriers.
*/
function amendesFiche_(lignes) {
  const resultat = {
    nombre: 0, total: 0,
    aEncaisser: { nombre: 0, total: 0, aDeterminer: 0 },
    aReverser: { nombre: 0, total: 0 },
    dernieres: []
  };

  lignes.forEach(({ row, display }) => {
    const montant = row[4] === "" || row[4] === null ? null : Number(row[4]);
    const paye = row[5] === true;
    const reverse = row[6] === true;

    resultat.nombre++;
    if (montant !== null) resultat.total += montant;
    if (!paye) {
      resultat.aEncaisser.nombre++;
      if (montant === null) resultat.aEncaisser.aDeterminer++;
      else resultat.aEncaisser.total += montant;
    } else if (!reverse) {
      resultat.aReverser.nombre++;
      if (montant !== null) resultat.aReverser.total += montant;
    }
    resultat.dernieres.push({
      date: formatDateAmende_(row[0], display[0]),
      contrevenant: nettoyerSaisieUtilisateur(display[2]),
      infraction: nettoyerSaisieUtilisateur(display[3]),
      montant,
      paye,
      reverse
    });
  });

  resultat.dernieres = resultat.dernieres.reverse().slice(0, FICHE_DERNIERES);
  return resultat;
}


// Incarcérations prononcées par le membre, et détenus encore en cellule.
function prisonFiche_(lignes) {
  const resultat = { nombre: 0, enCellule: [], dernieres: [] };

  lignes.forEach(({ row, display }) => {
    const detention = {
      date: formatDatePrison_(row[0], display[0]),
      detenu: nettoyerSaisieUtilisateur(display[2]),
      cellule: nettoyerSaisieUtilisateur(display[3]),
      infraction: nettoyerSaisieUtilisateur(display[4]),
      entree: formatDateTimePrison_(row[6], display[6]),
      sortie: formatDateTimePrison_(row[7], display[7]),
      libere: row[8] === true
    };
    resultat.nombre++;
    if (!detention.libere) resultat.enCellule.push(detention);
    resultat.dernieres.push(detention);
  });

  resultat.enCellule.reverse();
  resultat.dernieres = resultat.dernieres.reverse().slice(0, FICHE_DERNIERES);
  return resultat;
}
