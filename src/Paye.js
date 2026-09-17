// ============================================================
// PAYE
//
// Vue de trésorerie des Présences.
//
// Objectif : le jour de la paye, l'officier doit pouvoir
// annoncer à son financeur un montant unique et le justifier.
// Le registre des Présences est organisé par semaine puis par
// corps ; l'argent, lui, vient d'un financeur par corps. Ce
// module fait uniquement ce regroupement.
//
// Financeurs :
//   - Argentier de la cour : Cité de Blancherive, Éclaireurs,
//     État-Major. Même regroupement central que le reversement
//     des amendes (`AMENDES_CORPS_REVERSEMENT_MUTUALISES`).
//   - Un Thane par garnison : Rivebois, Bois-de-Chêne,
//     Faubourgs, Cap Granite.
//
// Le Hird du Jarl est exclu des Présences ; il l'est ici aussi.
//
// Lecture des Présences, colonnes A:O — voir `Presences.js`.
//
// OFFICIER : lecture et règlement.
// INTENDANT : lecture seule.
// ============================================================

const PAYE_PRESENCES_SHEET = "Présences";


/*
  Un corps est rattaché à son financeur par jeton distinctif,
  recherché dans le libellé normalisé. La recherche est une
  inclusion et non une égalité, afin d'accepter aussi bien
  « Rivebois » que « Garnison de Rivebois ».

  Les jetons sont volontairement discriminants : aucun n'est
  contenu dans le libellé d'un autre corps. En particulier on
  n'utilise jamais « blancherive » seul, que portent à la fois
  la Cité et les Faubourgs.
*/

const PAYE_FINANCEURS = [

  {
    cle: "argentier",
    libelle: "Argentier de la cour",
    role: "argentier",
    jetons: [
      "cite de blancherive",
      "eclaireur",
      "etat-major",
      "etat major"
    ]
  },

  {
    cle: "thane-rivebois",
    libelle: "Thane de Rivebois",
    role: "thane",
    jetons: [
      "rivebois"
    ]
  },

  {
    cle: "thane-bois-de-chene",
    libelle: "Thane de Bois-de-Chêne",
    role: "thane",
    jetons: [
      "bois-de-chene",
      "bois de chene"
    ]
  },

  {
    cle: "thane-faubourgs",
    libelle: "Thane des Faubourgs",
    role: "thane",
    jetons: [
      "faubourg"
    ]
  },

  {
    cle: "thane-cap-granite",
    libelle: "Thane de Cap Granite",
    role: "thane",
    jetons: [
      "cap granite",
      "cap-granite"
    ]
  }

];


/*
  Financeur de repli. Un corps qui ne correspond à aucun jeton
  n'est jamais écarté : il est regroupé ici, visible et compté
  dans le total général. Une solde ne doit pas disparaître de
  la demande de budget parce que le libellé d'un corps a changé
  dans la feuille.
*/

const PAYE_FINANCEUR_INCONNU = {
  cle: "a-determiner",
  libelle: "Financeur à déterminer",
  role: "inconnu",
  jetons: []
};


// ============================================================
// API WEB
// LECTURE
// ============================================================

function getPaye(token) {

  requireRole(token, ["OFFICIER", "INTENDANT"]);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const sheet = ss.getSheetByName(PAYE_PRESENCES_SHEET);

  if (!sheet) {
    throw new Error("Feuille Présences introuvable.");
  }

  mettreAJourSoldesPresences_(ss, sheet);
  SpreadsheetApp.flush();

  const currentWeek = getCurrentIsoWeekWebApp();

  const lastRow = getLastPresenceRowWebApp(sheet);

  if (lastRow < 2) {
    return construireResultatPaye_([], currentWeek);
  }

  const range = sheet.getRange(2, 1, lastRow - 1, 15);

  const values = range.getValues();

  const displayValues = range.getDisplayValues();

  const lignes = [];

  for (let i = 0; i < values.length; i++) {

    const row = values[i];

    const semaine = Number(row[0]);

    if (!Number.isFinite(semaine)) {
      continue;
    }

    const corps = String(displayValues[i][1] || "").trim();

    if (estCorpsExcluDesPresences_(corps)) {
      continue;
    }

    lignes.push({
      row: i + 2,
      semaine: semaine,
      corps: corps,
      grade: String(displayValues[i][2] || "").trim(),
      prenom: String(displayValues[i][3] || "").trim(),
      nom: String(displayValues[i][4] || "").trim(),
      joursPresents: payeNombre_(row[12]),
      soldeRaw: payeNombre_(row[13]),
      paye: row[14] === true
    });
  }

  return construireResultatPaye_(lignes, currentWeek);
}


// ============================================================
// API WEB
// RÈGLEMENT D'UNE SEMAINE
//
// OFFICIER UNIQUEMENT.
//
// Une semaine et un garde à la fois : la case cochée est la
// colonne O de la ligne de présence correspondante. Les
// contrôles de rôle et de cellule sont ceux de
// `ecrirePresenceCellule_`, partagés avec la page Présences.
// Un INTENDANT y est refusé côté serveur, indépendamment de
// ce que l'interface affiche.
// ============================================================

function reglerSemainePaye(token, row, paye) {

  ecrirePresenceCellule_(token, row, 15, paye);

  return getPaye(token);
}


// ============================================================
// REGROUPEMENT
// ============================================================

function construireResultatPaye_(lignes, currentWeek) {

  const financeurs = new Map();

  let totalADemander = 0;
  let totalAPrevoir = 0;

  const gardesDus = new Set();

  for (const ligne of lignes) {

    const financeur = trouverFinanceurPaye_(ligne.corps);

    if (!financeurs.has(financeur.cle)) {
      financeurs.set(financeur.cle, {
        cle: financeur.cle,
        libelle: financeur.libelle,
        role: financeur.role,
        corps: [],
        total: 0,
        nbLignes: 0,
        semaines: [],
        gardes: new Map(),
        previsionTotal: 0,
        previsionGardes: new Set()
      });
    }

    const bloc = financeurs.get(financeur.cle);

    if (ligne.corps && bloc.corps.indexOf(ligne.corps) === -1) {
      bloc.corps.push(ligne.corps);
    }

    /*
      Semaine en cours : jamais sommée dans la demande. Elle
      n'est pas close, les pointages peuvent encore bouger d'ici
      dimanche. Elle est renvoyée à part, en prévision.
    */

    if (ligne.semaine === currentWeek) {

      if (ligne.soldeRaw > 0 && !ligne.paye) {
        bloc.previsionTotal += ligne.soldeRaw;
        bloc.previsionGardes.add(payeClePersonne_(ligne));
        totalAPrevoir += ligne.soldeRaw;
      }

      continue;
    }

    /*
      Une solde nulle n'est pas une dette : une recrue ou un
      garde sans jour pointé n'a rien à percevoir. La case
      « Payé » décochée d'une telle ligne ne doit pas gonfler
      le nombre d'impayés.

      Les semaines postérieures à la semaine en cours ne sont
      pas des retards. La colonne Semaine ne porte pas l'année ;
      après le passage à la nouvelle année, les semaines de
      l'année écoulée cessent donc d'être comptées ici.
    */

    if (
      ligne.semaine >= currentWeek ||
      ligne.soldeRaw <= 0 ||
      ligne.paye
    ) {
      continue;
    }

    const cleGarde = payeClePersonne_(ligne);

    if (!bloc.gardes.has(cleGarde)) {
      bloc.gardes.set(cleGarde, {
        cle: cleGarde,
        prenom: ligne.prenom,
        nom: ligne.nom,
        nomComplet: [ligne.prenom, ligne.nom]
          .filter(Boolean)
          .join(" "),
        grade: ligne.grade,
        corps: ligne.corps,
        total: 0,
        semaines: []
      });
    }

    const garde = bloc.gardes.get(cleGarde);

    /*
      Le grade et le corps retenus sont ceux de la semaine la
      plus récente : c'est l'état le plus proche de celui du
      garde aujourd'hui. Comparaison avant l'ajout de la
      semaine courante à la liste.
    */

    if (ligne.semaine > payeDerniereSemaine_(garde)) {
      garde.grade = ligne.grade;
      garde.corps = ligne.corps;
    }

    garde.total += ligne.soldeRaw;

    garde.semaines.push({
      row: ligne.row,
      semaine: ligne.semaine,
      joursPresents: ligne.joursPresents,
      montant: ligne.soldeRaw,
      retard: currentWeek - ligne.semaine
    });

    bloc.total += ligne.soldeRaw;
    bloc.nbLignes++;

    if (bloc.semaines.indexOf(ligne.semaine) === -1) {
      bloc.semaines.push(ligne.semaine);
    }

    totalADemander += ligne.soldeRaw;
    gardesDus.add(financeur.cle + "|" + cleGarde);
  }

  const resultat = [];

  for (const bloc of financeurs.values()) {

    const gardes = Array.from(bloc.gardes.values());

    for (const garde of gardes) {
      garde.semaines.sort((a, b) => a.semaine - b.semaine);
    }

    /*
      Les dettes les plus lourdes en premier, puis les plus
      anciennes : ce sont celles qu'il faut penser à citer.
    */

    gardes.sort((a, b) => {

      if (b.total !== a.total) {
        return b.total - a.total;
      }

      const ancienneteA = a.semaines.length ? a.semaines[0].semaine : 0;
      const ancienneteB = b.semaines.length ? b.semaines[0].semaine : 0;

      if (ancienneteA !== ancienneteB) {
        return ancienneteA - ancienneteB;
      }

      return String(a.nomComplet).localeCompare(
        String(b.nomComplet),
        "fr"
      );
    });

    bloc.semaines.sort((a, b) => a - b);

    resultat.push({
      cle: bloc.cle,
      libelle: bloc.libelle,
      role: bloc.role,
      corps: bloc.corps.slice().sort((a, b) => a.localeCompare(b, "fr")),
      total: bloc.total,
      nbGardes: gardes.length,
      nbLignes: bloc.nbLignes,
      semaines: bloc.semaines,
      semainePlusAncienne: bloc.semaines.length ? bloc.semaines[0] : null,
      retardMax: bloc.semaines.length ? currentWeek - bloc.semaines[0] : 0,
      groupes: payeGrouperParCorps_(gardes),
      previsionTotal: bloc.previsionTotal,
      previsionGardes: bloc.previsionGardes.size
    });
  }

  /*
    Les financeurs à qui l'on doit quelque chose d'abord, du
    montant le plus élevé au plus faible. Ceux qui sont à jour
    restent affichés, en fin de liste : savoir qu'il n'y a rien
    à demander fait partie de la réponse.

    « Financeur à déterminer » passe en tête dès qu'il porte un
    montant : c'est une anomalie de libellé à corriger avant de
    présenter la demande.
  */

  resultat.sort((a, b) => {

    const anomalieA = a.role === "inconnu" && a.total > 0;
    const anomalieB = b.role === "inconnu" && b.total > 0;

    if (anomalieA !== anomalieB) {
      return anomalieA ? -1 : 1;
    }

    if ((a.total > 0) !== (b.total > 0)) {
      return a.total > 0 ? -1 : 1;
    }

    if (b.total !== a.total) {
      return b.total - a.total;
    }

    return a.libelle.localeCompare(b.libelle, "fr");
  });

  return {
    currentWeek: currentWeek,
    totalADemander: totalADemander,
    totalAPrevoir: totalAPrevoir,
    nbGardesDus: gardesDus.size,
    financeurs: resultat
  };
}


/*
  Un financeur peut couvrir plusieurs corps. Le détail reste
  groupé par corps, parce que c'est ainsi que la garde se
  compte, mais chaque garde n'apparaît qu'une fois.
*/

function payeGrouperParCorps_(gardes) {

  const groupes = new Map();

  for (const garde of gardes) {

    const corps = garde.corps || "Sans corps";

    if (!groupes.has(corps)) {
      groupes.set(corps, { corps: corps, total: 0, gardes: [] });
    }

    const groupe = groupes.get(corps);

    groupe.total += garde.total;
    groupe.gardes.push(garde);
  }

  return Array.from(groupes.values()).sort(
    (a, b) => b.total - a.total
  );
}


function payeDerniereSemaine_(garde) {

  let derniere = 0;

  for (const semaine of garde.semaines) {
    if (semaine.semaine > derniere) {
      derniere = semaine.semaine;
    }
  }

  return derniere;
}


// ============================================================
// RATTACHEMENT D'UN CORPS À SON FINANCEUR
// ============================================================

function trouverFinanceurPaye_(corps) {

  const valeur = payeNormaliser_(corps);

  if (!valeur) {
    return PAYE_FINANCEUR_INCONNU;
  }

  for (const financeur of PAYE_FINANCEURS) {

    for (const jeton of financeur.jetons) {

      if (valeur.indexOf(payeNormaliser_(jeton)) !== -1) {
        return financeur;
      }
    }
  }

  return PAYE_FINANCEUR_INCONNU;
}


// ============================================================
// OUTILS
// ============================================================

function payeClePersonne_(ligne) {

  return payeNormaliser_(ligne.prenom) +
    "|" +
    payeNormaliser_(ligne.nom);
}


function payeNombre_(value) {

  const nombre = Number(value);

  return Number.isFinite(nombre) ? nombre : 0;
}


function payeNormaliser_(value) {

  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
