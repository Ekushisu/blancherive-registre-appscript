// Données de démonstration pour les aperçus de l'interface.
//
// Elles ne proviennent PAS du classeur réel : noms, montants et dates sont
// inventés. Elles servent uniquement à remplir les pages pour les captures de
// `scripts/capture-apercus.mjs`. Aucun appel Apps Script n'est effectué.
//
// Les formes doivent suivre celles des fonctions serveur correspondantes de
// `src/`. Si une page d'aperçu se retrouve vide, c'est en général qu'un champ
// attendu manque ici.

import { readFileSync } from "node:fs";
import vm from "node:vm";

const SEMAINE_COURANTE = 37;

const jours = motif => motif.split("").map(c => c === "x");

function presence(row, semaine, corps, prenom, nom, grade, motif, solde, paye) {
  const j = jours(motif);
  return {
    row,
    semaine,
    corps,
    prenom,
    nom,
    grade,
    jours: j,
    joursPresents: j.filter(Boolean).length,
    solde: `${solde} septims`,
    soldeRaw: solde,
    paye
  };
}

// Source unique des aperçus Présences et Paye : les deux pages doivent
// montrer le même registre, sinon les captures se contredisent.
const lignesPresences = [
  presence(12, 37, "Garnison de Rivebois", "Brynjar", "Poing-de-Fer", "Commandant", "xxxxx..", 500, false),
  presence(13, 37, "Garnison de Rivebois", "Sigrid", "Vent-du-Nord", "Capitaine", "xxxx.x.", 400, false),
  presence(14, 37, "Garnison de Rivebois", "Torvald", "Hache-Vive", "Garde", "xx.x...", 240, true),
  presence(15, 37, "Garnison de Rivebois", "Eydis", "la Silencieuse", "Cadet", "xxx....", 120, false),
  presence(16, 37, "Garnison de Rivebois", "Halvar", "Sans-Nom", "Recrue", "x......", 0, false),
  presence(21, 37, "Cité de Blancherive", "Ingrid", "Main-Leste", "Major", "xxxxxx.", 600, false),
  presence(22, 37, "Cité de Blancherive", "Rolf", "Écu-Fendu", "Garde", "xxxx...", 320, true),
  presence(23, 37, "Cité de Blancherive", "Astrid", "Œil-de-Faucon", "Garde", ".xxxx..", 320, false),
  presence(26, 37, "Éclaireur", "Runa", "Chante-Lame", "Cadet", "xxx....", 150, false),
  presence(28, 37, "Cap Granite", "Ulf", "Œil-Clair", "Garde", "xxxxx..", 400, false),

  presence(31, 36, "Garnison de Rivebois", "Brynjar", "Poing-de-Fer", "Commandant", "xxxxxxx", 700, true),
  presence(32, 36, "Garnison de Rivebois", "Torvald", "Hache-Vive", "Garde", "xxxxx..", 400, false),
  presence(33, 36, "Garnison de Rivebois", "Eydis", "la Silencieuse", "Cadet", "xxx.x..", 160, false),
  presence(34, 36, "Cité de Blancherive", "Ingrid", "Main-Leste", "Major", "xxxxx.x", 600, true),
  presence(35, 36, "Cité de Blancherive", "Astrid", "Œil-de-Faucon", "Garde", "xxxx.x.", 400, false),
  presence(36, 36, "Éclaireur", "Runa", "Chante-Lame", "Cadet", "xx.....", 100, false),
  presence(37, 36, "Cap Granite", "Ulf", "Œil-Clair", "Garde", "xxxxxx.", 480, false),

  presence(41, 35, "Garnison de Rivebois", "Eydis", "la Silencieuse", "Cadet", "xxxx...", 200, false),
  presence(42, 35, "Cité de Blancherive", "Astrid", "Œil-de-Faucon", "Garde", "xxx....", 240, false),
  presence(43, 35, "Cap Granite", "Ulf", "Œil-Clair", "Garde", "xxxxx..", 400, true),

  presence(51, 34, "Garnison de Rivebois", "Eydis", "la Silencieuse", "Cadet", "xxx....", 150, false),
  presence(52, 34, "Faubourgs de Blancherive", "Sif", "Pied-Sûr", "Garde", "xxxx...", 320, false)
];

function totauxParCorps(lignes) {
  const totaux = new Map();
  for (const l of lignes) {
    const cle = `${l.semaine}|${l.corps}`;
    if (!totaux.has(cle)) totaux.set(cle, { semaine: l.semaine, corps: l.corps, total: 0 });
    totaux.get(cle).total += l.soldeRaw;
  }
  return [...totaux.values()];
}

export const presences = {
  currentWeek: SEMAINE_COURANTE,
  rows: lignesPresences,
  corpsTotals: totauxParCorps(lignesPresences)
};

const impayesPasses = lignesPresences.filter(
  l => l.semaine < SEMAINE_COURANTE && l.soldeRaw > 0 && !l.paye
);

const semaineCourante = lignesPresences.filter(l => l.semaine === SEMAINE_COURANTE);

const somme = (lignes, filtre = () => true) =>
  lignes.filter(filtre).reduce((total, l) => total + l.soldeRaw, 0);

export const presenceDashboard = {
  currentWeek: SEMAINE_COURANTE,
  currentWeekTotal: somme(semaineCourante),
  currentWeekPaid: somme(semaineCourante, l => l.paye),
  currentWeekRemaining: somme(semaineCourante, l => !l.paye),
  pastUnpaidCount: impayesPasses.length,
  pastUnpaidAmount: somme(impayesPasses),
  currentWeekRecoveredFines: 850,
  inactive: [
    {
      nomComplet: "Halvar Sans-Nom",
      grade: "Recrue",
      corps: "Garnison de Rivebois",
      jamaisPresent: false,
      dernierePresence: "02/09/2026",
      joursDepuis: 13
    },
    {
      nomComplet: "Gunnar Dos-Courbé",
      grade: "Garde",
      corps: "Cité de Blancherive",
      jamaisPresent: true
    },
    {
      nomComplet: "Runa Chante-Lame",
      grade: "Cadet",
      corps: "Éclaireur",
      jamaisPresent: false,
      dernierePresence: "21/08/2026",
      joursDepuis: 25
    }
  ]
};

// La paye est produite par le vrai `getPaye` de `src/Paye.js`, exécuté sur les
// lignes ci-dessus dans un contexte vm avec des services Apps Script factices.
// L'aperçu ne peut donc pas s'écarter de ce que renvoie le serveur : une
// évolution du regroupement se voit à la capture suivante.
function construirePaye() {
  const contexte = vm.createContext({
    Number, String, Math, Map, Set, Array, JSON,
    SPREADSHEET_ID: "apercus",
    PRESENCES_SHEET_NAME: "Présences",
    requireRole: () => ({ role: "OFFICIER" }),
    SpreadsheetApp: {
      flush() {},
      openById: () => ({ getSheetByName: () => ({ getRange: () => cellules }) })
    }
  });

  const valeurs = lignesPresences.map(l => [
    l.semaine, l.corps, l.grade, l.prenom, l.nom,
    ...l.jours, l.joursPresents, l.soldeRaw, l.paye
  ]);

  const cellules = {
    getValues: () => valeurs,
    getDisplayValues: () => valeurs.map(l => l.map(String))
  };

  vm.runInContext(readFileSync(new URL("../src/Presences.js", import.meta.url), "utf8"), contexte);
  vm.runInContext(readFileSync(new URL("../src/Paye.js", import.meta.url), "utf8"), contexte);

  contexte.mettreAJourSoldesPresences_ = () => {};
  contexte.getLastPresenceRowWebApp = () => valeurs.length + 1;
  contexte.getCurrentIsoWeekWebApp = () => SEMAINE_COURANTE;
  contexte.estCorpsExcluDesPresences_ = corps =>
    String(corps).toLowerCase().includes("hird");

  return JSON.parse(JSON.stringify(contexte.getPaye("OFFICIER")));
}

export const paye = construirePaye();

export const prison = {
  rows: [
    {
      row: 4,
      date: "14/09/2026",
      garde: "Sigrid Vent-du-Nord",
      detenu: "Marcurio le Cadet",
      cellule: "Cellule II",
      infraction: "Art. 12 — Vol simple",
      duree: "6 h",
      entree: "14/09/2026 18:30",
      sortie: "15/09/2026 00:30",
      libere: false,
      saisies: "Dague en acier ×1, Bourse de septims ×1",
      notes: "Pris sur le fait au marché. Objets restitués à la sortie."
    },
    {
      row: 5,
      date: "13/09/2026",
      garde: "Rolf Écu-Fendu",
      detenu: "Anoriath",
      cellule: "Cellule I",
      infraction: "Art. 4 — Rixe sur la voie publique",
      duree: "2 h",
      entree: "13/09/2026 21:05",
      sortie: "13/09/2026 23:05",
      libere: true,
      saisies: "",
      notes: ""
    },
    {
      row: 6,
      date: "11/09/2026",
      garde: "Brynjar Poing-de-Fer",
      detenu: "Nazeem",
      cellule: "Cellule III",
      infraction: "Motif personnalisé — Décret du Jarl",
      duree: "À déterminer",
      entree: "11/09/2026 09:15",
      sortie: "",
      libere: false,
      saisies: "Amulette de Talos ×1",
      notes: "Détention sur ordre direct de l'État-Major, durée en attente."
    }
  ]
};

const infractions = [
  {
    label: "Art. 4 — Rixe sur la voie publique",
    sanction: {
      options: [
        { value: 2, label: "2 h : première rixe" },
        { value: 6, label: "6 h : récidive" }
      ],
      libre: false,
      texte: "Deux heures de cachot, portées à six en cas de récidive."
    }
  },
  {
    label: "Art. 12 — Vol simple",
    sanction: {
      options: [
        { value: 6, label: "6 h : vol de faible valeur" },
        { value: 24, label: "24 h : vol aggravé" }
      ],
      libre: true,
      texte: "Six heures de cachot, à l'appréciation du garde selon la valeur dérobée."
    }
  }
];

export const prisonForm = {
  gardes: [
    "Brynjar Poing-de-Fer",
    "Sigrid Vent-du-Nord",
    "Rolf Écu-Fendu",
    "Ingrid Main-Leste",
    "Astrid Œil-de-Faucon"
  ],
  infractions
};

export const amendeForm = {
  gardes: prisonForm.gardes,
  infractions: [
    {
      label: "Art. 7 — Trouble à l'ordre public",
      sanction: {
        options: [
          { value: 50, label: "50 : simple trouble" },
          { value: 150, label: "150 : récidive" }
        ],
        libre: false,
        texte: "Cinquante septims, portés à cent cinquante en cas de récidive."
      }
    },
    ...infractions
  ],
  collecteurs: [{ nom: "Ingrid Main-Leste", grade: "Major", corps: "Cité de Blancherive" }]
};

export const amendes = {
  rows: [
    {
      row: 4,
      date: "14/09/2026",
      garde: "Astrid Œil-de-Faucon",
      contrevenant: "Belethor",
      infraction: "Art. 7 — Trouble à l'ordre public",
      montant: 150,
      paye: true,
      reverse: false,
      destinataire: "Ingrid Main-Leste (Major)",
      notes: "Altercation devant l'échoppe."
    },
    {
      row: 5,
      date: "12/09/2026",
      garde: "Rolf Écu-Fendu",
      contrevenant: "Mikael",
      infraction: "Art. 12 — Vol simple",
      montant: 300,
      paye: true,
      reverse: true,
      destinataire: "Ingrid Main-Leste (Major)",
      notes: ""
    },
    {
      row: 6,
      date: "09/09/2026",
      garde: "Sigrid Vent-du-Nord",
      contrevenant: "Nazeem",
      infraction: "Art. 7 — Trouble à l'ordre public",
      montant: 50,
      paye: false,
      reverse: false,
      destinataire: "Ingrid Main-Leste (Major)",
      notes: "Refus de circuler."
    }
  ]
};

export const codex = {
  articles: [
    {
      article: "4",
      label: "Art. 4 — Rixe sur la voie publique",
      titre: "De la rixe sur la voie publique",
      famille: "Codex Judiciaire de Blancherive",
      source: "Codex Judiciaire de Blancherive",
      classification: "Délit",
      autorite: "Garde en service",
      applicabilite: "Châtellerie de Blancherive",
      texte:
        "Quiconque engage ou poursuit une rixe sur la voie publique trouble la paix du Jarl. Le garde présent sépare les parties, puis conduit au cachot celui qui a porté le premier coup.",
      sanction: "Deux heures de cachot, portées à six en cas de récidive.",
      cachot: true,
      amende: false,
      dureesCachot: [2, 6],
      montants: []
    },
    {
      article: "7",
      label: "Art. 7 — Trouble à l'ordre public",
      titre: "Du trouble à l'ordre public",
      famille: "Codex Judiciaire de Blancherive",
      source: "Codex Judiciaire de Blancherive",
      classification: "Contravention",
      autorite: "Garde en service",
      applicabilite: "Châtellerie de Blancherive",
      texte:
        "Le tapage, l'ivresse manifeste et le refus de circuler sur injonction constituent un trouble à l'ordre public.",
      sanction: "Cinquante septims, portés à cent cinquante en cas de récidive.",
      cachot: false,
      amende: true,
      dureesCachot: [],
      montants: [50, 150]
    },
    {
      article: "12",
      label: "Art. 12 — Vol simple",
      titre: "Du vol simple",
      famille: "Codex Judiciaire de Blancherive",
      source: "Codex Judiciaire de Blancherive",
      classification: "Délit",
      autorite: "Officier",
      applicabilite: "Châtellerie de Blancherive",
      texte:
        "Le vol sans violence ni effraction est puni du cachot et de la restitution intégrale du bien dérobé à son propriétaire légitime.",
      sanction: "Six heures de cachot, à l'appréciation du garde selon la valeur dérobée.",
      cachot: true,
      amende: false,
      dureesCachot: [6, 24],
      montants: []
    }
  ]
};

/*
  Organigramme : la forme suit `getOrganigramme()` de `src/Organigramme.js`.
  Les grades couvrent volontairement toute l'échelle, du Jarl à la Recrue, afin
  que les descriptions de grades soient visibles sur la capture.
*/
let idMembre = 0;
const membre = (prenom, nom, grade, corps) => ({
  memberId: `demo-${++idMembre}`,
  nomComplet: `${prenom} ${nom}`,
  prenom,
  nom,
  grade,
  corps
});

export const organigramme = {
  changes: { events: [] },
  jarl: membre("Lucius", "Haldor", "Jarl", "État-Major"),
  hird: [membre("Ulfgar", "Bouclier-Noir", "Lieutenant", "Hird du Jarl")],
  marechaux: [],
  commandants: [membre("Haldvar", "de Blancherive", "Commander", "État-Major")],
  majorsEtatMajor: [membre("Ingrid", "Main-Leste", "Major", "État-Major")],
  majors: [membre("Torsten", "Pierre-Grise", "Major", "Éclaireur")],
  commandementLocal: {
    nom: "Commandement de Rivebois et Bois-de-Chêne",
    majors: [membre("Frida", "Val-Profond", "Major", "Garnison de Rivebois")],
    garnisonKeys: ["rivebois", "bois-de-chene"]
  },
  garnisons: [
    {
      key: "rivebois",
      nom: "Garnison de Rivebois",
      membres: [
        membre("Brynjar", "Poing-de-Fer", "Capitaine", "Garnison de Rivebois"),
        membre("Sigrid", "Vent-du-Nord", "Lieutenant-Chef", "Garnison de Rivebois"),
        membre("Torvald", "Hache-Vive", "Lieutenant", "Garnison de Rivebois"),
        membre("Eydis", "la Silencieuse", "Sergent-Chef", "Garnison de Rivebois"),
        membre("Halvar", "Sans-Nom", "Sergent", "Garnison de Rivebois"),
        membre("Gerda", "Œil-Vif", "Caporal-Chef", "Garnison de Rivebois"),
        membre("Bjorn", "Lame-Courte", "Caporal", "Garnison de Rivebois"),
        membre("Runa", "Chante-Lame", "Garde", "Garnison de Rivebois"),
        membre("Sven", "le Jeune", "Cadet", "Garnison de Rivebois"),
        membre("Alva", "Pied-Léger", "Recrue", "Garnison de Rivebois")
      ]
    },
    {
      key: "bois-de-chene",
      nom: "Garnison de Bois-de-Chêne",
      membres: [
        membre("Astrid", "Brise-Lame", "Capitaine", "Garnison de Bois-de-Chêne"),
        membre("Rorik", "Marche-Hiver", "Lieutenant", "Garnison de Bois-de-Chêne")
      ]
    },
    {
      key: "cite",
      nom: "Cité de Blancherive",
      membres: [
        membre("Rolf", "Écu-Fendu", "Capitaine", "Cité de Blancherive"),
        membre("Mjoll", "Main-Sûre", "Sergent", "Cité de Blancherive"),
        membre("Eirik", "Barbe-Rousse", "Garde", "Cité de Blancherive")
      ]
    },
    {
      key: "faubourgs",
      nom: "Garde des Faubourgs",
      membres: [membre("Hilda", "Pas-Furtif", "Lieutenant", "Garde des Faubourgs")]
    }
  ],
  reserve: [membre("Olaf", "Dos-Voûté", "Garde", "Cité de Blancherive")]
};

/*
  Effectifs : la forme suit `getEffectifs()` de `src/Effectifs.js`.
  Les six corps sont représentés, afin que la bande d'onglets soit aussi chargée
  qu'en production — c'est à cette densité que les défauts d'affichage mobile
  apparaissent, pas avec deux corps.
*/
const CORPS = [
  "Cité de Blancherive",
  "Garnison de Rivebois",
  "Garnison de Bois-de-Chêne",
  "Garde des Faubourgs",
  "Éclaireur",
  "Hird du Jarl"
];

const GRADES = [
  "Commander", "Major", "Capitaine", "Lieutenant-Chef", "Lieutenant",
  "Sergent-Chef", "Sergent", "Caporal-Chef", "Caporal", "Garde", "Cadet", "Recrue"
];

const membreEffectif = (id, prenom, nom, grade, corps, options = {}) => ({
  row: id + 1,
  memberId: `demo-${id}`,
  prenom,
  nom,
  nomComplet: `${prenom} ${nom}`,
  grade,
  corps,
  specialite: options.specialite || "",
  status: options.status || "En service actif",
  reserve: Boolean(options.reserve),
  terminalGroup: "",
  assermente: options.assermente !== false,
  styles: {}
});

export const effectifs = {
  gradeOrder: GRADES,
  changes: { events: [] },
  options: {
    grades: GRADES,
    corps: CORPS,
    specialites: ["Pisteuse", "Archer", "Cavalier"],
    statuses: ["En service actif", "Réserve", "Congé"],
    styles: { grades: {}, corps: {}, specialites: {}, statuses: {} }
  },
  rows: [
    membreEffectif(1, "Haldvar", "de Blancherive", "Commander", "Cité de Blancherive", { collecteur: true }),
    membreEffectif(2, "Astrid", "Brise-Lame", "Capitaine", "Cité de Blancherive", { collecteur: true }),
    membreEffectif(3, "Rorik", "Marche-Hiver", "Lieutenant", "Cité de Blancherive"),
    membreEffectif(4, "Mjoll", "Main-Sûre", "Sergent", "Cité de Blancherive"),
    membreEffectif(5, "Brynjar", "Poing-de-Fer", "Capitaine", "Garnison de Rivebois"),
    membreEffectif(6, "Sigrid", "Vent-du-Nord", "Lieutenant-Chef", "Garnison de Rivebois"),
    membreEffectif(7, "Eydis", "la Silencieuse", "Cadet", "Garnison de Rivebois", { assermente: false }),
    membreEffectif(8, "Alva", "Pied-Léger", "Recrue", "Garnison de Rivebois", { assermente: false }),
    membreEffectif(9, "Torsten", "Pierre-Grise", "Major", "Garnison de Bois-de-Chêne"),
    membreEffectif(10, "Frida", "Val-Profond", "Garde", "Garnison de Bois-de-Chêne"),
    membreEffectif(11, "Hilda", "Pas-Furtif", "Lieutenant", "Garde des Faubourgs"),
    membreEffectif(12, "Runa", "Chante-Lame", "Garde", "Éclaireur", { specialite: "Pisteuse" }),
    membreEffectif(13, "Ulfgar", "Bouclier-Noir", "Garde", "Hird du Jarl"),
    membreEffectif(14, "Olaf", "Dos-Voûté", "Garde", "Cité de Blancherive", { status: "Réserve", reserve: true })
  ]
};

export const sessionInfo = { role: "OFFICIER" };
