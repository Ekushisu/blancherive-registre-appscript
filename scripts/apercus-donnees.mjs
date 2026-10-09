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
import { createHash } from "node:crypto";
import { codexLocal } from "./codex-local.mjs";

// Présences!A porte le lundi ISO ; les numéros ci-dessous ne servent qu'à
// la lisibilité des lignes d'aperçu.
const LUNDI_COURANT = "2026-09-07";
const LUNDIS = { 34: "2026-08-17", 35: "2026-08-24", 36: "2026-08-31", 37: "2026-09-07" };

const jours = motif => motif.split("").map(c => c === "x");

// Alias des grades de l'Inquisition, tels que `Données!C` les porte
// (`lireAliasGrades_`, src/AliasGrades.js) : renvoyés par toutes les lectures
// qui affichent un grade.
const ALIAS_GRADES = {
  Inquisition: {
    Capitaine: "Grand Inquisiteur",
    "Lieutenant-Chef": "La Plume",
    "Sergent-Chef": "Enquêteur",
    "Caporal-Chef": "Traqueur",
    Garde: "Inquisiteur"
  }
};

function presence(row, semaine, corps, prenom, nom, grade, motif, solde, paye) {
  const j = jours(motif);
  return {
    row,
    lundi: LUNDIS[semaine],
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
  presence(29, 37, "Inquisition", "Ragnhild", "Fer-Juste", "Capitaine", "xxxx...", 320, false),

  presence(31, 36, "Garnison de Rivebois", "Brynjar", "Poing-de-Fer", "Commandant", "xxxxxxx", 700, true),
  presence(32, 36, "Garnison de Rivebois", "Torvald", "Hache-Vive", "Garde", "xxxxx..", 400, false),
  presence(33, 36, "Garnison de Rivebois", "Eydis", "la Silencieuse", "Cadet", "xxx.x..", 160, false),
  presence(34, 36, "Cité de Blancherive", "Ingrid", "Main-Leste", "Major", "xxxxx.x", 600, true),
  presence(35, 36, "Cité de Blancherive", "Astrid", "Œil-de-Faucon", "Garde", "xxxx.x.", 400, false),
  presence(36, 36, "Éclaireur", "Runa", "Chante-Lame", "Cadet", "xx.....", 100, false),
  presence(37, 36, "Cap Granite", "Ulf", "Œil-Clair", "Garde", "xxxxxx.", 480, false),
  presence(38, 36, "Inquisition", "Ragnhild", "Fer-Juste", "Capitaine", "xxxxx..", 400, false),

  presence(41, 35, "Garnison de Rivebois", "Eydis", "la Silencieuse", "Cadet", "xxxx...", 200, false),
  presence(42, 35, "Cité de Blancherive", "Astrid", "Œil-de-Faucon", "Garde", "xxx....", 240, false),
  presence(43, 35, "Cap Granite", "Ulf", "Œil-Clair", "Garde", "xxxxx..", 400, true),

  presence(51, 34, "Garnison de Rivebois", "Eydis", "la Silencieuse", "Cadet", "xxx....", 150, false),
  presence(52, 34, "Faubourgs de Blancherive", "Sif", "Pied-Sûr", "Garde", "xxxx...", 320, false)
];

function totauxParCorps(lignes) {
  const totaux = new Map();
  for (const l of lignes) {
    const cle = `${l.lundi}|${l.corps}`;
    if (!totaux.has(cle)) totaux.set(cle, { lundi: l.lundi, corps: l.corps, total: 0 });
    totaux.get(cle).total += l.soldeRaw;
  }
  return [...totaux.values()];
}

export const presences = {
  lundiCourant: LUNDI_COURANT,
  rows: lignesPresences,
  corpsTotals: totauxParCorps(lignesPresences),
  aliasGrades: ALIAS_GRADES
};

const impayesPasses = lignesPresences.filter(
  l => l.lundi < LUNDI_COURANT && l.soldeRaw > 0 && !l.paye
);

const semaineCourante = lignesPresences.filter(l => l.lundi === LUNDI_COURANT);

const somme = (lignes, filtre = () => true) =>
  lignes.filter(filtre).reduce((total, l) => total + l.soldeRaw, 0);

export const presenceDashboard = {
  lundiCourant: LUNDI_COURANT,
  currentWeekTotal: somme(semaineCourante),
  currentWeekPaid: somme(semaineCourante, l => l.paye),
  currentWeekRemaining: somme(semaineCourante, l => !l.paye),
  pastUnpaidCount: impayesPasses.length,
  pastUnpaidAmount: somme(impayesPasses),
  currentWeekRecoveredFines: 850,
  aliasGrades: ALIAS_GRADES,
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
    l.lundi, l.corps, l.grade, l.prenom, l.nom,
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
  contexte.lundiCourantPresence_ = () => LUNDI_COURANT;
  contexte.estCorpsExcluDesPresences_ = corps =>
    String(corps).toLowerCase().includes("hird");
  contexte.lireAliasGrades_ = () => ALIAS_GRADES;

  return JSON.parse(JSON.stringify(contexte.getPaye("OFFICIER")));
}

export const paye = construirePaye();

// Le barème des peines est celui que `src/PeinesAmendes.js` écrit à la création
// de la feuille, relu par sa propre lecture : l'aperçu montre le vrai barème.
function construirePeines() {
  const lignes = [];
  const feuille = {
    getLastRow: () => lignes.length,
    getMaxColumns: () => 12,
    getRange(r, c, h = 1, w = 1) {
      const valeurs = () => Array.from({ length: h }, (_, i) => Array.from({ length: w }, (_, j) => lignes[r + i - 1]?.[c + j - 1] ?? ""));
      return { getValues: valeurs, getDisplayValues: () => valeurs().map(l => l.map(String)) };
    }
  };
  const contexte = vm.createContext({
    Utilities: {
      DigestAlgorithm: { MD5: "md5" }, Charset: { UTF_8: "utf8" },
      computeDigest: (algo, texte) => Array.from(createHash(algo).update(texte, "utf8").digest()),
      base64EncodeWebSafe: octets => Buffer.from(octets).toString("base64url")
    }
  });
  for (const fichier of ["SyncCodex.js", "Codex.js", "Amendes.js", "PeinesAmendes.js"]) {
    vm.runInContext(readFileSync(new URL(`../src/${fichier}`, import.meta.url), "utf8"), contexte);
  }
  lignes.push(Array.from(vm.runInContext("PEINES_HEADERS", contexte)), ...Array.from(contexte.construireBaremeInitial_(), l => Array.from(l)));
  return JSON.parse(JSON.stringify(contexte.lirePeinesAmendes_(feuille)));
}

export const peines = construirePeines();

// Codex reconstitué depuis les copies locales des textes (`codex-local.mjs`),
// pour les aperçus qui citent de vrais articles : barème, formulaire d'amende.
// Le Codex de démonstration plus bas reste celui de la page Codex, dont la
// capture pleine page deviendrait démesurée avec quelque 450 articles.
export const codexComplet = codexLocal();

export const prison = {
  rows: [
    {
      row: 4,
      date: "14/09/2026",
      garde: "Sigrid Vent-du-Nord",
      detenu: "Marcurio le Cadet",
      cellule: "Cellule II",
      infraction: "CPL art. 24 — Vol simple",
      chefs: [{"source":"Code pénal local de Blancherive","article":"24","titre":"Vol simple","classification":"délit","abrege":"CPL"}],
      duree: "6 h",
      dureeRaw: 6,
      entree: "14/09/2026 18:30",
      entreeIso: "2026-09-14T18:30",
      sortie: "15/09/2026 00:30",
      libere: false,
      saisies: "Dague d'acier × 1\nOr × 40",
      saisiesListe: [{ id: "skyrim.esm|0001397E", nom: "Dague d'acier", quantite: 1 }, { id: "skyrim.esm|00000F", nom: "Or", quantite: 40 }],
      notes: "Pris sur le fait au marché. Objets restitués à la sortie."
    },
    {
      row: 5,
      date: "13/09/2026",
      garde: "Rolf Écu-Fendu",
      detenu: "Anoriath",
      cellule: "Cellule I",
      infraction: "CPL art. 31 — Rixe sur la voie publique ; CPL art. 16 — Injure",
      chefs: [{"source":"Code pénal local de Blancherive","article":"31","titre":"Rixe sur la voie publique","classification":"délit","abrege":"CPL"}, {"source":"Code pénal local de Blancherive","article":"16","titre":"Injure","classification":"contravention","abrege":"CPL"}],
      duree: "2 h",
      dureeRaw: 2,
      entree: "13/09/2026 21:05",
      entreeIso: "2026-09-13T21:05",
      sortie: "13/09/2026 23:05",
      libere: true,
      saisies: "",
      saisiesListe: [],
      notes: ""
    },
    {
      row: 6,
      date: "11/09/2026",
      garde: "Brynjar Poing-de-Fer",
      detenu: "Nazeem",
      cellule: "Cellule III",
      infraction: "Motif personnalisé — Décret du Jarl",
      chefs: null,
      duree: "",
      dureeRaw: null,
      entree: "11/09/2026 09:15",
      entreeIso: "2026-09-11T09:15",
      sortie: "",
      libere: false,
      saisies: "Amulette de Talos",
      saisiesListe: null,
      notes: "Détention sur ordre direct de l'État-Major, durée en attente."
    }
  ]
};

// Catalogue préchargé par les pages Prison et Inventaire, même forme que
// `getCatalogueObjets` : tableau compact [id, nom, type].
export const catalogueObjets = {
  version: "demo",
  total: 6,
  alias: { "skyrim.esm|00000f": "or septim septims", "skyrim.esm|00000a": "crochet crochets", "skyrim.esm|01d4ec": "torche torches" },
  objets: [
    ["skyrim.esm|00000F", "Or", "Objet divers"],
    ["skyrim.esm|00000A", "Crochet", "Objet divers"],
    ["skyrim.esm|01D4EC", "Torche", "Objet divers"],
    ["skyrim.esm|013989", "Épée d'acier", "Arme"],
    ["skyrim.esm|012EB6", "Cuirasse d'acier", "Armure"],
    ["skyrim.esm|013938", "Bouclier de fer", "Armure"]
  ]
};

export const prisonForm = {
  gardes: [
    "Brynjar Poing-de-Fer",
    "Sigrid Vent-du-Nord",
    "Rolf Écu-Fendu",
    "Ingrid Main-Leste",
    "Astrid Œil-de-Faucon"
  ]
};

export const amendeForm = { gardes: prisonForm.gardes };

export const amendes = {
  rows: [
    {
      row: 4,
      date: "14/09/2026",
      garde: "Astrid Œil-de-Faucon",
      contrevenant: "Belethor",
      infraction: "CPL art. 9 — Propos irrespectueux envers une autorité locale ; CPL art. 16 — Injure",
      chefs: [{"source":"Code pénal local de Blancherive","article":"9","titre":"Propos irrespectueux envers une autorité locale","classification":"contravention","abrege":"CPL"}, {"source":"Code pénal local de Blancherive","article":"16","titre":"Injure","classification":"contravention","abrege":"CPL"}],
      montant: "150",
      montantRaw: 150,
      paye: true,
      reverse: false,
      collecteurs: ["Major Ingrid Main-Leste"],
      fallbackEtatMajor: false
    },
    {
      row: 5,
      date: "12/09/2026",
      garde: "Rolf Écu-Fendu",
      contrevenant: "Mikael",
      infraction: "Art. 12 — Vol simple",
      chefs: null,
      montant: "300",
      montantRaw: 300,
      paye: true,
      reverse: true,
      collecteurs: ["Major Ingrid Main-Leste"],
      fallbackEtatMajor: false
    },
    {
      row: 6,
      date: "09/09/2026",
      garde: "Sigrid Vent-du-Nord",
      contrevenant: "Nazeem",
      infraction: "CPL art. 4 — Refus d’obtempérer à une injonction locale",
      chefs: [{"source":"Code pénal local de Blancherive","article":"4","titre":"Refus d’obtempérer à une injonction locale","classification":"délit","abrege":"CPL"}],
      montant: "",
      montantRaw: null,
      paye: false,
      reverse: false,
      collecteurs: [],
      fallbackEtatMajor: false
    }
  ]
};

export const codex = {
  "version": "demo",
  "sources": [
    {
      "nom": "Code pénal local de Blancherive",
      "abrege": "CPL",
      "citable": true,
      "famille": "Droit de Blancherive",
      "autorite": "Cour de Blancherive",
      "applicabilite": "Infractions locales et sanctions de la Garde",
      "local": true,
      "url": ""
    },
    {
      "nom": "Corpus Juriscivilis Imperialis",
      "abrege": "CJI",
      "citable": true,
      "famille": "Droit impérial",
      "autorite": "Empire de Tamriel",
      "applicabilite": "Droit pénal impérial général",
      "local": false,
      "url": ""
    }
  ],
  "articles": [
    {
      "source": "Code pénal local de Blancherive",
      "abrege": "CPL",
      "citable": true,
      "article": "4",
      "titre": "Refus d’obtempérer à une injonction locale",
      "label": "Art. 4 — Refus d’obtempérer à une injonction locale",
      "classification": "délit",
      "famille": "Droit de Blancherive",
      "autorite": "Cour de Blancherive",
      "applicabilite": "Infractions locales et sanctions de la Garde",
      "local": true,
      "url": "",
      "texte": "Constitue un refus d’obtempérer local le fait, pour toute personne, de refuser volontairement de se conformer sans délai à une injonction claire, compréhensible et légalement fondée, adressée par une autorité compétente de Blancherive. La présente infraction se distingue du non-respect d’une mise en demeure administrative (article 76).",
      "sanction": "",
      "amende": "",
      "cachot": "",
      "travaux": "",
      "alerte": "",
      "montants": [],
      "dureesCachot": []
    },
    {
      "source": "Code pénal local de Blancherive",
      "abrege": "CPL",
      "citable": true,
      "article": "9",
      "titre": "Propos irrespectueux envers une autorité locale",
      "label": "Art. 9 — Propos irrespectueux envers une autorité locale",
      "classification": "contravention",
      "famille": "Droit de Blancherive",
      "autorite": "Cour de Blancherive",
      "applicabilite": "Infractions locales et sanctions de la Garde",
      "local": true,
      "url": "",
      "texte": "Le fait de tenir publiquement, envers un représentant de la châtellerie agissant dans l’exercice de ses fonctions, des propos grossiers, méprisants ou offensants constitue une infraction contraventionnelle.",
      "sanction": "",
      "amende": "",
      "cachot": "",
      "travaux": "",
      "alerte": "",
      "montants": [],
      "dureesCachot": []
    },
    {
      "source": "Code pénal local de Blancherive",
      "abrege": "CPL",
      "citable": true,
      "article": "16",
      "titre": "Injure",
      "label": "Art. 16 — Injure",
      "classification": "contravention",
      "famille": "Droit de Blancherive",
      "autorite": "Cour de Blancherive",
      "applicabilite": "Infractions locales et sanctions de la Garde",
      "local": true,
      "url": "",
      "texte": "Le fait d’adresser à une personne des propos, gestes ou écrits injurieux, hors de toute menace, constitue une contravention.",
      "sanction": "",
      "amende": "",
      "cachot": "",
      "travaux": "",
      "alerte": "",
      "montants": [],
      "dureesCachot": []
    },
    {
      "source": "Code pénal local de Blancherive",
      "abrege": "CPL",
      "citable": true,
      "article": "24",
      "titre": "Vol simple",
      "label": "Art. 24 — Vol simple",
      "classification": "délit",
      "famille": "Droit de Blancherive",
      "autorite": "Cour de Blancherive",
      "applicabilite": "Infractions locales et sanctions de la Garde",
      "local": true,
      "url": "",
      "texte": "Le fait de soustraire frauduleusement la chose d’autrui, sans violence ni effraction, constitue un délit. La restitution du bien est ordonnée à titre accessoire.",
      "sanction": "",
      "amende": "",
      "cachot": "",
      "travaux": "",
      "alerte": "",
      "montants": [],
      "dureesCachot": []
    },
    {
      "source": "Code pénal local de Blancherive",
      "abrege": "CPL",
      "citable": true,
      "article": "31",
      "titre": "Rixe sur la voie publique",
      "label": "Art. 31 — Rixe sur la voie publique",
      "classification": "délit",
      "famille": "Droit de Blancherive",
      "autorite": "Cour de Blancherive",
      "applicabilite": "Infractions locales et sanctions de la Garde",
      "local": true,
      "url": "",
      "texte": "Le fait de participer volontairement à une rixe sur la voie publique constitue un délit, sans préjudice des atteintes aux personnes qui en résultent (articles 26 et 27).",
      "sanction": "",
      "amende": "",
      "cachot": "",
      "travaux": "",
      "alerte": "",
      "montants": [],
      "dureesCachot": []
    },
    {
      "source": "Corpus Juriscivilis Imperialis",
      "abrege": "CJI",
      "citable": true,
      "article": "3",
      "titre": "Classification des infractions",
      "label": "Art. 3 — Classification des infractions",
      "classification": "",
      "famille": "Droit impérial",
      "autorite": "Empire de Tamriel",
      "applicabilite": "Droit pénal impérial général",
      "local": false,
      "url": "",
      "texte": "Les infractions sont classées en contraventions, délits et crimes. La contravention est punie d’une amende jusqu’à 500 septims, le délit de 500 à 2 500 septims, le crime au-delà.",
      "sanction": "",
      "amende": "",
      "cachot": "",
      "travaux": "",
      "alerte": "",
      "montants": [],
      "dureesCachot": []
    },
    {
      "source": "Codex Judiciaire de Blancherive",
      "abrege": "CJB",
      "citable": true,
      "article": "12",
      "titre": "Du vol simple",
      "label": "Art. 12 — Du vol simple",
      "classification": "Délit",
      "famille": "Droit de Blancherive",
      "autorite": "Empire de Tamriel",
      "applicabilite": "Droit pénal impérial général",
      "local": false,
      "url": "",
      "texte": "Le vol sans violence ni effraction est puni du cachot et de la restitution intégrale du bien dérobé.",
      "sanction": "Six heures de cachot, à l’appréciation du garde selon la valeur dérobée.",
      "amende": "",
      "cachot": "",
      "travaux": "",
      "alerte": "",
      "montants": [],
      "dureesCachot": [
        6,
        24
      ]
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
    },
    // Le serveur renvoie toujours les sept corps, même vides : l'aperçu
    // doit montrer la grille à cette densité.
    {
      key: "cap-granite",
      nom: "Cap Granite",
      membres: [membre("Ulf", "Œil-Clair", "Garde", "Cap Granite")]
    },
    {
      key: "eclaireurs",
      nom: "Éclaireurs",
      membres: [membre("Runa", "Chante-Lame", "Garde", "Éclaireur")]
    },
    {
      key: "inquisition",
      nom: "Garde inquisitoriale",
      membres: [
        membre("Ragnhild", "Fer-Juste", "Capitaine", "Inquisition"),
        membre("Ivar", "Œil-Sombre", "Garde", "Inquisition")
      ]
    }
  ],
  reserve: [membre("Olaf", "Dos-Voûté", "Garde", "Cité de Blancherive")],
  aliasGrades: ALIAS_GRADES
};

/*
  Effectifs : la forme suit `getEffectifs()` de `src/Effectifs.js`.
  Sept corps sont représentés, afin que la bande d'onglets soit aussi chargée
  qu'en production — c'est à cette densité que les défauts d'affichage mobile
  apparaissent, pas avec deux corps. « Inquisition » est le libellé de la
  feuille ; l'interface affiche « Garde inquisitoriale ».
*/
const CORPS = [
  "Cité de Blancherive",
  "Garnison de Rivebois",
  "Garnison de Bois-de-Chêne",
  "Garde des Faubourgs",
  "Éclaireur",
  "Inquisition",
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
  aliasGrades: ALIAS_GRADES,
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
    membreEffectif(14, "Olaf", "Dos-Voûté", "Garde", "Cité de Blancherive", { status: "Réserve", reserve: true }),
    membreEffectif(15, "Ragnhild", "Fer-Juste", "Capitaine", "Inquisition"),
    membreEffectif(16, "Ivar", "Œil-Sombre", "Garde", "Inquisition")
  ]
};

// Inventaire des coffres : même forme que `getInventaire` de `src/Inventaire.js`.
// Les identifiants de coffre sont techniques ; l'interface n'affiche que les noms.
const coffresDemo = [
  { id: "coffre-armurerie", nom: "Coffre de l’armurerie", position: "Fort-Dragon, salle des gardes, mur nord", description: "Armes et armures de service. Clef chez le Capitaine." },
  { id: "coffre-intendance", nom: "Réserve de l’intendance", position: "Fort-Dragon, cellier", description: "Torches, vivres et fournitures du quotidien." },
  { id: "coffre-greffe", nom: "Coffre du greffe", position: "Fort-Dragon, bureau du Commander", description: "Objets saisis en attente de restitution ou de vente." }
];
const objetsDemo = [
  ["coffre-armurerie", "skyrim.esm|013989", "Épée d'acier", 6],
  ["coffre-armurerie", "skyrim.esm|012EB6", "Cuirasse d'acier", 3],
  ["coffre-armurerie", "skyrim.esm|013938", "Bouclier de fer", 8],
  ["coffre-intendance", "skyrim.esm|01D4EC", "Torche", 40],
  ["coffre-intendance", "skyrim.esm|00000F", "Or", 1250],
  ["coffre-intendance", "", "Pain d’épeautre", 24],
  ["coffre-greffe", "skyrim.esm|00000A", "Crochet", 15],
  ["coffre-greffe", "", "Amulette de Talos (saisie)", 1]
];
export const inventaire = {
  coffres: coffresDemo.map(c => {
    const lignes = objetsDemo.filter(o => o[0] === c.id);
    return { ...c, nbObjets: lignes.length, total: lignes.reduce((somme, o) => somme + o[3], 0) };
  }),
  objets: objetsDemo.map(([coffreId, id, nom, quantite]) => ({
    cle: id ? `catalogue:${id.toLowerCase()}` : `libre:${nom.toLowerCase()}`,
    coffreId,
    coffreNom: coffresDemo.find(c => c.id === coffreId).nom,
    id, nom, libre: !id, quantite
  }))
};

export const sessionInfo = { role: "OFFICIER" };
