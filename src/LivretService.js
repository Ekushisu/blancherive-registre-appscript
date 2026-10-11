/*
  Livret de service : la page personnelle d'un membre connecté par Discord
  (décisions du propriétaire, 11 octobre 2026). Ouverte par défaut à la
  connexion Discord ; une session par code n'identifie personne et n'en a pas.

  Lecture seule. Le serveur ne renvoie que les données du membre de la
  session, désigné par l'ID membre de son jeton : sa fiche, sa chaîne de
  commandement, sa carrière, sa solde et son service, ses amendes et ses
  incarcérations. Un garde voit sa propre solde, jamais celle d'un autre.

  Présences, Amendes et Prison désignent un garde par son nom, pas par son ID
  membre : les lignes sont rapprochées du « Prénom Nom » de la fiche, sans
  casse, accents ni espaces superflus. Un membre renommé dans Effectifs perd le
  rattachement de ses lignes antérieures.
*/
const LIVRET_DERNIERES = 5;


function getLivretService(token) {
  const auth = requireRole(token, ["GARDE", "OFFICIER"]);

  if (auth.via !== "discord" || !auth.membre) {
    throw new Error("Le livret de service n'existe que pour une connexion par Discord.");
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const effectifs = lireEffectifsLivret_(ss);
  const fiche = effectifs.find(membre => membre.id === auth.membre);

  if (!fiche) {
    throw new Error("Votre fiche est introuvable dans les Effectifs : prévenir un officier.");
  }

  const ordre = lireOrdreGradesDiscord_(ss);

  return {
    fiche: {
      prenom: fiche.prenom,
      nom: fiche.nom,
      nomComplet: fiche.nomComplet,
      grade: fiche.grade,
      corps: fiche.corps,
      specialite: fiche.specialite,
      statut: fiche.statut,
      assermente: fiche.assermente
    },
    aliasGrades: lireAliasGrades_(ss),
    commandement: commandementLivret_(effectifs, fiche, ordre),
    carriere: lireCarriereLivret_(ss, auth.membre),
    service: lireServiceLivret_(ss, fiche),
    justice: lireJusticeLivret_(ss, fiche)
  };
}


function cleNomLivret_(valeur) {
  return normaliserEffectifsWeb_(valeur).replace(/\s+/g, " ").trim();
}


// ============================================================
// FICHE ET COMMANDEMENT
// ============================================================

function lireEffectifsLivret_(ss) {
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
*/
function commandementLivret_(effectifs, fiche, ordre) {
  const actif = normaliserEffectifsWeb_(EFFECTIFS_WEB_ACTIVE_STATUS);
  const rang = membre => {
    const index = ordre.indexOf(cleGradeDiscord_(membre.grade));
    return index < 0 ? Infinity : index;
  };
  const seuil = ordre.indexOf(cleGradeDiscord_(DISCORD_SEUIL_OFFICIER));
  const presenter = membre => ({ nomComplet: membre.nomComplet, grade: membre.grade, corps: membre.corps });
  const enService = effectifs.filter(m => m.id !== fiche.id && normaliserEffectifsWeb_(m.statut) === actif);
  const memeCorps = (a, b) => cleGradeDiscord_(a) === cleGradeDiscord_(b);
  const etatMajor = corps => cleGradeDiscord_(corps) === "etatmajor";
  const hird = corps => cleGradeDiscord_(corps).includes("hird");

  const corps = enService
    .filter(m => memeCorps(m.corps, fiche.corps) && rang(m) < rang(fiche) && rang(m) <= seuil)
    .sort((a, b) => rang(a) - rang(b))
    .map(presenter);

  const etatMajorListe = etatMajor(fiche.corps) || hird(fiche.corps)
    ? []
    : enService.filter(m => etatMajor(m.corps)).sort((a, b) => rang(a) - rang(b)).map(presenter);

  return { corps, etatMajor: etatMajorListe };
}


// ============================================================
// CARRIÈRE — journal HistoriqueEffectifs
// ============================================================

/*
  Inscription : premier événement du membre. S'il date de l'ouverture du
  journal (événement « initialisation »), le membre était déjà là : son
  arrivée réelle est inconnue. Événements : arrivée, grade et corps, du plus
  récent au plus ancien.
*/
function lireCarriereLivret_(ss, membreId) {
  const journal = ss.getSheetByName("HistoriqueEffectifs");
  const vide = { inscription: "", avantJournal: false, evenements: [] };
  if (!journal || journal.getLastRow() < 2) return vide;

  const lignes = journal.getRange(2, 1, journal.getLastRow() - 1, 8).getValues();
  const ouverture = lignes.find(l => l[3] === "initialisation");
  const miens = lignes.filter(l => String(l[2]) === String(membreId));
  if (!miens.length) return vide;

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
    avantJournal: Boolean(ouverture) && String(ouverture[1]) === premier,
    evenements
  };
}


// ============================================================
// SOLDE ET SERVICE — Présences
// ============================================================

function lireServiceLivret_(ss, fiche) {
  const lundiCourant = lundiCourantPresence_();
  const resultat = {
    lundiCourant,
    exclu: estCorpsExcluDesPresences_(fiche.corps),
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

  const sheet = ss.getSheetByName(PRESENCES_SHEET_NAME);
  if (!sheet) return resultat;

  // Soldes à jour, comme la page Présences (Presences.js).
  mettreAJourSoldesPresences_(ss, sheet);
  SpreadsheetApp.flush();

  const lastRow = getLastPresenceRowWebApp(sheet);
  if (lastRow < 2) return resultat;

  const cle = cleNomLivret_(fiche.nomComplet);
  const range = sheet.getRange(2, 1, lastRow - 1, 15);
  const values = range.getValues();
  const display = range.getDisplayValues();
  const semaines = [];

  values.forEach((row, i) => {
    if (cleNomLivret_(display[i][3] + " " + display[i][4]) !== cle) return;
    const lundi = normaliserLundiPresence_(row[0], lundiCourant);
    if (!estLundiPresence_(lundi) || estCorpsExcluDesPresences_(display[i][1])) return;
    semaines.push({
      lundi,
      corps: String(display[i][1] || "").trim(),
      grade: String(display[i][2] || "").trim(),
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
      const date = decalerDateLivret_(s.lundi, jour);
      if (!resultat.dernierJour || date > resultat.dernierJour) resultat.dernierJour = date;
    });
  });

  resultat.moyenne = resultat.semainesServies
    ? Math.round(resultat.joursTotal / resultat.semainesServies * 10) / 10
    : 0;

  // Série : semaines consécutives servies, la semaine en cours comprise si
  // elle compte déjà un jour, sinon à partir de la précédente.
  const servies = new Set(semaines.filter(s => s.joursPresents > 0).map(s => s.lundi));
  let semaine = servies.has(lundiCourant) ? lundiCourant : decalerDateLivret_(lundiCourant, -7);
  while (servies.has(semaine)) {
    resultat.serie++;
    semaine = decalerDateLivret_(semaine, -7);
  }

  if (resultat.dernierJour) {
    resultat.joursDepuis = ecartJoursLivret_(resultat.dernierJour, dateCivileStockholm_());
  }
  resultat.inactif =
    normaliserEffectifsWeb_(fiche.statut) === normaliserEffectifsWeb_(EFFECTIFS_WEB_ACTIVE_STATUS) &&
    (resultat.joursDepuis === null || resultat.joursDepuis > PRESENCE_DASHBOARD_INACTIVITY_DAYS);

  return resultat;
}


function decalerDateLivret_(iso, jours) {
  const date = new Date(iso + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + jours);
  return date.toISOString().slice(0, 10);
}


function ecartJoursLivret_(depuis, jusqua) {
  return Math.round((new Date(jusqua + "T00:00:00Z") - new Date(depuis + "T00:00:00Z")) / 86400000);
}


// ============================================================
// JUSTICE — Amendes et Prison
// ============================================================

function lireJusticeLivret_(ss, fiche) {
  const cle = cleNomLivret_(fiche.nomComplet);
  return {
    amendes: lireAmendesLivret_(ss, cle),
    prison: lirePrisonLivret_(ss, cle)
  };
}


/*
  Amendes dressées par le membre. À encaisser : non payées, montant fixé ou à
  déterminer. À reverser : payées, pas encore reversées aux trésoriers.
*/
function lireAmendesLivret_(ss, cle) {
  const resultat = {
    nombre: 0, total: 0,
    aEncaisser: { nombre: 0, total: 0, aDeterminer: 0 },
    aReverser: { nombre: 0, total: 0 },
    dernieres: []
  };
  const sheet = ss.getSheetByName(AMENDES_SHEET_NAME);
  if (!sheet) return resultat;
  const lastRow = getLastNonEmptyRowInColumn(sheet, 1);
  if (lastRow < 2) return resultat;

  const range = sheet.getRange(2, 1, lastRow - 1, 7);
  const values = range.getValues();
  const display = range.getDisplayValues();

  values.forEach((row, i) => {
    if (cleNomLivret_(display[i][1]) !== cle) return;
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
      date: formatDateAmende_(row[0], display[i][0]),
      contrevenant: nettoyerSaisieUtilisateur(display[i][2]),
      infraction: nettoyerSaisieUtilisateur(display[i][3]),
      montant,
      paye,
      reverse
    });
  });

  resultat.dernieres = resultat.dernieres.reverse().slice(0, LIVRET_DERNIERES);
  return resultat;
}


// Incarcérations prononcées par le membre, et détenus encore en cellule.
function lirePrisonLivret_(ss, cle) {
  const resultat = { nombre: 0, enCellule: [], dernieres: [] };
  const sheet = ss.getSheetByName(PRISON_SHEET_NAME);
  if (!sheet) return resultat;
  const lastRow = getLastNonEmptyRowInColumn(sheet, 1);
  if (lastRow < 2) return resultat;

  const range = sheet.getRange(2, 1, lastRow - 1, 9);
  const values = range.getValues();
  const display = range.getDisplayValues();

  values.forEach((row, i) => {
    if (cleNomLivret_(display[i][1]) !== cle) return;
    const detention = {
      date: formatDatePrison_(row[0], display[i][0]),
      detenu: nettoyerSaisieUtilisateur(display[i][2]),
      cellule: nettoyerSaisieUtilisateur(display[i][3]),
      infraction: nettoyerSaisieUtilisateur(display[i][4]),
      entree: formatDateTimePrison_(row[6], display[i][6]),
      sortie: formatDateTimePrison_(row[7], display[i][7]),
      libere: row[8] === true
    };
    resultat.nombre++;
    if (!detention.libere) resultat.enCellule.push(detention);
    resultat.dernieres.push(detention);
  });

  resultat.enCellule.reverse();
  resultat.dernieres = resultat.dernieres.reverse().slice(0, LIVRET_DERNIERES);
  return resultat;
}
