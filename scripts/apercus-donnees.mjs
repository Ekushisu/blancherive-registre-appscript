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
  presence(29, 37, "Garnison de Bois-de-Chêne", "Ragnhild", "Fer-Juste", "Capitaine", "xxxx...", 320, false),

  presence(31, 36, "Garnison de Rivebois", "Brynjar", "Poing-de-Fer", "Commandant", "xxxxxxx", 700, true),
  presence(32, 36, "Garnison de Rivebois", "Torvald", "Hache-Vive", "Garde", "xxxxx..", 400, false),
  presence(33, 36, "Garnison de Rivebois", "Eydis", "la Silencieuse", "Cadet", "xxx.x..", 160, false),
  presence(34, 36, "Cité de Blancherive", "Ingrid", "Main-Leste", "Major", "xxxxx.x", 600, true),
  presence(35, 36, "Cité de Blancherive", "Astrid", "Œil-de-Faucon", "Garde", "xxxx.x.", 400, false),
  presence(36, 36, "Éclaireur", "Runa", "Chante-Lame", "Cadet", "xx.....", 100, false),
  presence(37, 36, "Cap Granite", "Ulf", "Œil-Clair", "Garde", "xxxxxx.", 480, false),
  presence(38, 36, "Garnison de Bois-de-Chêne", "Ragnhild", "Fer-Juste", "Capitaine", "xxxxx..", 400, false),

  presence(41, 35, "Garnison de Rivebois", "Eydis", "la Silencieuse", "Cadet", "xxxx...", 200, false),
  presence(42, 35, "Cité de Blancherive", "Astrid", "Œil-de-Faucon", "Garde", "xxx....", 240, false),
  presence(43, 35, "Cap Granite", "Ulf", "Œil-Clair", "Garde", "xxxxx..", 400, true),

  presence(51, 34, "Garnison de Rivebois", "Eydis", "la Silencieuse", "Cadet", "xxx....", 150, false),
  presence(52, 34, "Garnison de Bois-de-Chêne", "Sif", "Pied-Sûr", "Garde", "xxxx...", 320, false)
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
  corpsTotals: totauxParCorps(lignesPresences)
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
  for (const fichier of ["SyncCodex.js", "Codex.js", "JournalCodex.js", "Amendes.js", "PeinesAmendes.js"]) {
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
    // Incarcération richement documentée : une longue liste de saisies, dont
    // des saisies libres, et un procès-verbal sur plusieurs lignes. C'est le
    // cas qui faisait dérouler le registre sur plusieurs écrans.
    {
      row: 7,
      date: "15/09/2026",
      garde: "Brynjar Poing-de-Fer",
      detenu: "Zghrahz",
      cellule: "Cellule II",
      infraction: "CPL art. 5 — Des troubles à l'ordre public ; CPL art. 20 — Du vol",
      chefs: [{"source":"Code pénal local de Blancherive","article":"5","titre":"Des troubles à l'ordre public","classification":"contravention","abrege":"CPL"}, {"source":"Code pénal local de Blancherive","article":"20","titre":"Du vol","classification":"délit","abrege":"CPL"}],
      duree: "24 h",
      dureeRaw: 24,
      entree: "15/09/2026 00:10",
      entreeIso: "2026-09-15T00:10",
      sortie: "16/09/2026 00:10",
      libere: false,
      saisies: "Or × 750\nCrochet × 12\nTorche × 3\nÉpée d'acier × 1\nMora tapinella × 28 (saisie libre)\nMousse barbue × 3 (saisie libre)\nMycène des marais × 4 (saisie libre)\nŒuf de fauvette × 1 (saisie libre)\nOreille d'elfe × 7 (saisie libre)\nPerche argentée × 1 (saisie libre)\nPoisson de rivière × 1 (saisie libre)\nQueue de ragnard × 4 (saisie libre)\nTige de charbon × 66 (saisie libre)\nTruffe de Namira × 2 (saisie libre)",
      saisiesListe: [
        { id: "skyrim.esm|00000F", nom: "Or", quantite: 750 },
        { id: "skyrim.esm|00000A", nom: "Crochet", quantite: 12 },
        { id: "skyrim.esm|01D4EC", nom: "Torche", quantite: 3 },
        { id: "skyrim.esm|013989", nom: "Épée d'acier", quantite: 1 },
        { id: "", nom: "Mora tapinella", quantite: 28, libre: true },
        { id: "", nom: "Mousse barbue", quantite: 3, libre: true },
        { id: "", nom: "Mycène des marais", quantite: 4, libre: true },
        { id: "", nom: "Œuf de fauvette", quantite: 1, libre: true },
        { id: "", nom: "Oreille d'elfe", quantite: 7, libre: true },
        { id: "", nom: "Perche argentée", quantite: 1, libre: true },
        { id: "", nom: "Poisson de rivière", quantite: 1, libre: true },
        { id: "", nom: "Queue de ragnard", quantite: 4, libre: true },
        { id: "", nom: "Tige de charbon", quantite: 66, libre: true },
        { id: "", nom: "Truffe de Namira", quantite: 2, libre: true }
      ],
      notes: "Date : 14 septembre, aux alentours de minuit\nLieu : Bois-de-Chêne\nGardes présents : Brynjar Poing-de-Fer, Rolf Écu-Fendu\nTémoins : le Thane Garbosh gro-Mak, Askelad Premier-du-Gré\n\nL'individu faisait déjà l'objet d'une consigne d'arrestation à vue, sur ordre du Thane, à la suite de plusieurs incidents survenus à Bois-de-Chêne : troubles répétés à l'ordre public, délit de fuite, usurpation de marque. Interpellé à la sortie de l'auberge, il a tenté de s'enfuir par les écuries avant d'être rattrapé. Les objets saisis seront restitués à la sortie, à l'exception de l'or, retenu en garantie de l'amende à venir."
    },
    {
      row: 4,
      date: "14/09/2026",
      garde: "Sigrid Vent-du-Nord",
      detenu: "Marcurio le Cadet",
      cellule: "2",
      infraction: "CPL art. 20 — Du vol",
      chefs: [{"source":"Code pénal local de Blancherive","article":"20","titre":"Du vol","classification":"délit","abrege":"CPL"}],
      duree: "6 h",
      dureeRaw: 6,
      entree: "14/09/2026 18:30",
      entreeIso: "2026-09-14T18:30",
      sortie: "15/09/2026 00:30",
      libere: false,
      saisies: "Dague d'acier × 1\nOr × 40",
      saisiesListe: [{ id: "skyrim.esm|0001397E", nom: "Dague d'acier", quantite: 1 }, { id: "skyrim.esm|00000F", nom: "Or", quantite: 40 }],
      notes: "Pris sur le fait au marché.",
      acteSortie: null,
      journal: [
        { quand: "14/09/2026 22:40", type: "note", qui: "Rolf Écu-Fendu", texte: "Visite du Thane : le détenu reste en cellule jusqu'au terme." }
      ]
    },
    {
      row: 5,
      date: "13/09/2026",
      garde: "Rolf Écu-Fendu",
      detenu: "Anoriath",
      cellule: "A",
      infraction: "CPL art. 15 — De la mise en péril et des blessures ; CPL art. 10 — Des injures et calomnies",
      chefs: [{"source":"Code pénal local de Blancherive","article":"15","titre":"De la mise en péril et des blessures","classification":"délit","abrege":"CPL"}, {"source":"Code pénal local de Blancherive","article":"10","titre":"Des injures et calomnies","classification":"contravention","abrege":"CPL"}],
      duree: "2 h",
      dureeRaw: 2,
      entree: "13/09/2026 21:05",
      entreeIso: "2026-09-13T21:05",
      sortie: "13/09/2026 23:05",
      libere: true,
      saisies: "",
      saisiesListe: [],
      notes: "",
      acteSortie: { issue: "LIBERATION_ANTICIPEE", libelle: "Libération anticipée", transfert: false, destination: "", remisA: "", date: "13/09/2026 22:30", garde: "Sigrid Vent-du-Nord", motif: "Blessé soigné et excuses présentées à la victime ; relâché sur décision du Sergent de garde." },
      journal: [
        { quand: "13/09/2026 22:31", type: "sortie", qui: "Sigrid Vent-du-Nord", issue: "LIBERATION_ANTICIPEE", libelle: "Libération anticipée", destination: "", remisA: "", date: "13/09/2026 22:30", texte: "Blessé soigné et excuses présentées à la victime ; relâché sur décision du Sergent de garde." }
      ]
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
      libere: true,
      saisies: "Amulette de Talos",
      saisiesListe: null,
      notes: "Détention sur ordre direct de l'État-Major, durée en attente.",
      acteSortie: { issue: "TRANSFERT_THALMOR", libelle: "Transfert au Thalmor", transfert: true, destination: "", remisA: "Justiciar Ondolemar", date: "12/09/2026 16:00", garde: "Brynjar Poing-de-Fer", motif: "Réquisition de l'ambassade, contresignée par le Capitaine. Amulette remise avec le détenu." },
      journal: [
        { quand: "11/09/2026 09:20", type: "note", qui: "Brynjar Poing-de-Fer", texte: "Refuse de répondre. Attente des ordres de l'État-Major." },
        { quand: "12/09/2026 16:05", type: "sortie", qui: "Brynjar Poing-de-Fer", issue: "TRANSFERT_THALMOR", libelle: "Transfert au Thalmor", destination: "", remisA: "Justiciar Ondolemar", date: "12/09/2026 16:00", texte: "Réquisition de l'ambassade, contresignée par le Capitaine. Amulette remise avec le détenu." }
      ]
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
  ],
  gardeImpose: "",
  // Issues d'une détention, telles que `getPrisonFormData` les sert (`PRISON_ISSUES`, Prison.js).
  issues: [
    { code: "LIBERATION", libelle: "Libération", transfert: false, destination: "", destinationNom: "" },
    { code: "LIBERATION_ANTICIPEE", libelle: "Libération anticipée", transfert: false, destination: "", destinationNom: "" },
    { code: "TRANSFERT_EMPIRE", libelle: "Transfert à l'Empire", transfert: true, destination: "", destinationNom: "" },
    { code: "TRANSFERT_THALMOR", libelle: "Transfert au Thalmor", transfert: true, destination: "", destinationNom: "" },
    { code: "TRANSFERT_CHATELLERIE", libelle: "Transfert à une châtellerie", transfert: true, destination: "Châtellerie", destinationNom: "la châtellerie" },
    { code: "TRANSFERT_ORDRE", libelle: "Transfert à un ordre", transfert: true, destination: "Ordre", destinationNom: "l'ordre" },
    { code: "EVASION", libelle: "Évasion", transfert: false, destination: "", destinationNom: "" },
    { code: "DECES", libelle: "Décès en détention", transfert: false, destination: "", destinationNom: "" }
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
      infraction: "CPL art. 6 — Des outrages à l’autorité locale ; CPL art. 10 — Des injures et calomnies",
      chefs: [{"source":"Code pénal local de Blancherive","article":"6","titre":"Des outrages à l’autorité locale","classification":"contravention","abrege":"CPL"}, {"source":"Code pénal local de Blancherive","article":"10","titre":"Des injures et calomnies","classification":"contravention","abrege":"CPL"}],
      montant: "150",
      montantRaw: 150,
      paye: true,
      reverse: false,
      collecteurs: [{ grade: "Major", nom: "Ingrid Main-Leste" }],
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
      collecteurs: [{ grade: "Major", nom: "Ingrid Main-Leste" }],
      fallbackEtatMajor: false
    },
    {
      row: 6,
      date: "09/09/2026",
      garde: "Sigrid Vent-du-Nord",
      contrevenant: "Nazeem",
      infraction: "CPL art. 3 — Des ordres et sommations légitimes",
      chefs: [{"source":"Code pénal local de Blancherive","article":"3","titre":"Des ordres et sommations légitimes","classification":"délit","abrege":"CPL"}],
      montant: "",
      montantRaw: null,
      paye: false,
      reverse: false,
      collecteurs: [],
      fallbackEtatMajor: false
    }
  ]
};

// Journal des synchronisations (src/JournalCodex.js) : nouveautés du Codex.
const JOURNAL_CODEX_DEMO = [
  {
    date: new Date(Date.now() - 2 * 86400000).toISOString(), origine: "registre", articles: 452, documents: 18, erreurs: [], duree: 38400,
    parDocument: [
      { source: "Code pénal local de Blancherive", articles: 31, alertes: 0, duree: 2100 },
      { source: "Décret sur le couvre-feu", articles: 4, alertes: 1, duree: 900 }
    ],
    compte: { ajouts: 1, modifications: 2, retraits: 1, documentsAjoutes: 1, documentsRetires: 0, documentsIllisibles: 0 },
    tronque: false,
    changements: [
      { type: "document-ajout", source: "Décret sur le couvre-feu", article: "", titre: "", champs: [], avant: null, apres: null },
      { type: "ajout", source: "Code pénal local de Blancherive", article: "4", titre: "Refus d’obtempérer à une injonction locale", champs: [],
        avant: null, apres: { titre: "Refus d’obtempérer à une injonction locale", classification: "délit", sanction: "Amende de 250 à 500 septims ou 6 à 24 heures de cachot" } },
      { type: "modification", source: "Code pénal local de Blancherive", article: "16", titre: "Injure", champs: ["sanction", "texte"],
        avant: { sanction: "Amende de 50 septims", texte: "Quiconque injurie un garde dans l’exercice de ses fonctions est puni d’une amende de 50 septims." },
        apres: { sanction: "Amende de 100 septims", texte: "Quiconque injurie un garde ou un officier dans l’exercice de ses fonctions est puni d’une amende de 100 septims." } },
      { type: "modification", source: "Code pénal local de Blancherive", article: "9", titre: "Propos irrespectueux envers une autorité locale", champs: ["classification"],
        avant: { classification: "contravention" }, apres: { classification: "délit" } },
      { type: "retrait", source: "Code pénal local de Blancherive", article: "21", titre: "Port de la capuche dans l’enceinte du fort", champs: [],
        avant: { titre: "Port de la capuche dans l’enceinte du fort", classification: "contravention", sanction: "Amende de 20 septims", texte: "Le port de la capuche est interdit dans l’enceinte de Fort-Dragon." }, apres: null }
    ]
  },
  {
    date: new Date(Date.now() - 16 * 86400000).toISOString(), origine: "editeur", articles: 448, documents: 17, erreurs: [], duree: 41200, parDocument: [],
    compte: { ajouts: 0, modifications: 0, retraits: 0, documentsAjoutes: 0, documentsRetires: 0, documentsIllisibles: 0 }, tronque: false, changements: []
  }
];

// Traces d'une synchronisation lancée du registre, telles que le serveur les publie.
export const synchroTraces = [
  { niveau: "info", ms: 12, texte: "Synchronisation du Codex (bouton du registre) : attente du verrou…" },
  { niveau: "info", ms: 640, texte: "18 document(s) à lire. Cache actuel : 452 article(s), 18 document(s)." },
  { niveau: "info", ms: 2900, texte: "[1/18] Code pénal local de Blancherive : 31 article(s) (2240 ms)" },
  { niveau: "info", ms: 4100, texte: "[2/18] Corpus Juriscivilis : 58 article(s), 1 alerte(s) de lecture (1180 ms)" },
  { niveau: "info", ms: 4100, texte: "    alerte, article 12 : Sanction illisible" },
  { niveau: "alerte", ms: 6300, texte: "[3/18] Décret sur les marchés : ILLISIBLE — Accès refusé au document. — 6 article(s) précédent(s) conservé(s)." },
  { niveau: "info", ms: 31200, texte: "Écriture du cache SyncCodex : 452 article(s)…" },
  { niveau: "info", ms: 37900, texte: "Synchronisation du Codex terminée en 37,9 s.\nChangements : 0 nouveau(x), 1 modifié(s), 0 retiré(s) ; documents : 0 ajouté(s), 0 retiré(s), 1 illisible(s).\n  ~ Code pénal local de Blancherive art. 16 — Injure [sanction, texte]\n  ! document illisible Décret sur les marchés : Accès refusé au document.\nDétail : feuille JournalCodex, et « Nouveautés » sur la page Codex du registre." }
];
export const synchroResultat = {
  articles: 452, documents: 18, erreurs: ["Décret sur les marchés : Accès refusé au document."], duree: 37900,
  changements: { ajouts: 0, modifications: 1, retraits: 0, documentsAjoutes: 0, documentsRetires: 0, documentsIllisibles: 1 },
  traces: synchroTraces
};

export const codex = {
  "version": "demo",
  "journal": JOURNAL_CODEX_DEMO,
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
  Les grades couvrent volontairement toute l'échelle, du sommet à la Recrue, afin
  que les descriptions de grades soient visibles sur la capture. La châtellerie
  est sous régence impériale : pas de Jarl en service, un Régent au sommet, le
  Huscarl de l'État-Major détaché. Un Huscarl de la Cité est rendu au bas de
  la colonne de son corps, gardien des thanes locaux. L'Académie militaire,
  corps hors des garnisons, est rendue en bas dans un encart détaché : son
  Sergent-Chef s'affiche « Sergent-Instructeur », ses Caporaux « Instructeur ».
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
  jarl: null,
  regents: [membre("Cassius", "Varo", "Régent impérial", "État-Major")],
  huscarls: [membre("Lydia", "Bras-Fort", "Huscarl", "État-Major")],
  marechaux: [],
  commandants: [membre("Haldvar", "de Blancherive", "Commander", "État-Major")],
  majorsEtatMajor: [membre("Ingrid", "Main-Leste", "Major", "État-Major")],
  // Plus de commandement commun : les Majors des corps sont tous « hors commandement ».
  majors: [membre("Frida", "Val-Profond", "Major", "Garnison de Rivebois"), membre("Torsten", "Pierre-Grise", "Major", "Éclaireur")],
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
      nom: "Garde de Fort-Dragon",
      membres: [
        membre("Rolf", "Écu-Fendu", "Capitaine", "Cité de Blancherive"),
        membre("Mjoll", "Main-Sûre", "Sergent", "Cité de Blancherive"),
        membre("Eirik", "Barbe-Rousse", "Garde", "Cité de Blancherive")
      ],
      huscarls: [membre("Jorund", "Main-Ferme", "Huscarl", "Cité de Blancherive")]
    },
    // Le serveur renvoie toujours les cinq corps, même vides : l'aperçu
    // doit montrer la grille à cette densité. Les Faubourgs sont dissous.
    {
      key: "cap-granite",
      nom: "Cap Granite",
      membres: [membre("Hilda", "Pas-Furtif", "Lieutenant", "Cap Granite"), membre("Ulf", "Œil-Clair", "Garde", "Cap Granite")]
    },
    {
      key: "eclaireurs",
      nom: "Éclaireurs",
      membres: [membre("Runa", "Chante-Lame", "Garde", "Éclaireur")]
    }
  ],
  academie: {
    key: "academie",
    nom: "Académie militaire de Blancherive",
    chefs: [membre("Hrolf", "Main-Sage", "Sergent-Chef", "Académie militaire de Blancherive")],
    membres: [
      membre("Tove", "Œil-de-Lynx", "Caporal-Chef", "Académie militaire de Blancherive"),
      membre("Askel", "Pas-Lourd", "Caporal", "Académie militaire de Blancherive"),
      membre("Yrsa", "Mains-Froides", "Cadet", "Académie militaire de Blancherive"),
      membre("Finn", "Sans-Ombre", "Recrue", "Académie militaire de Blancherive")
    ]
  },
  reserve: [membre("Olaf", "Dos-Voûté", "Garde", "Cité de Blancherive")]
};

/*
  Effectifs : la forme suit `getEffectifs()` de `src/Effectifs.js`.
  Sept corps sont représentés, afin que la bande d'onglets soit aussi chargée
  qu'en production — c'est à cette densité que les défauts d'affichage mobile
  apparaissent, pas avec deux corps. Les Faubourgs, dissous, n'y sont plus.
*/
const CORPS = [
  "Cité de Blancherive",
  "Garnison de Rivebois",
  "Garnison de Bois-de-Chêne",
  "Éclaireur",
  "Cap Granite",
  "État-Major",
  "Académie militaire de Blancherive"
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
  discordId: options.discordId || "",
  discordAnomalie: options.discordAnomalie || "",
  styles: {}
});

// Identifiants Discord fictifs, de 18 chiffres comme les vrais.
const discord = n => String(300000000000000000n + BigInt(n));

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
    membreEffectif(1, "Haldvar", "de Blancherive", "Commander", "Cité de Blancherive", { collecteur: true, discordId: discord(1) }),
    membreEffectif(2, "Astrid", "Brise-Lame", "Capitaine", "Cité de Blancherive", { collecteur: true, discordId: discord(2) }),
    membreEffectif(3, "Rorik", "Marche-Hiver", "Lieutenant", "Cité de Blancherive", { discordId: discord(3) }),
    membreEffectif(4, "Mjoll", "Main-Sûre", "Sergent", "Cité de Blancherive"),
    membreEffectif(5, "Brynjar", "Poing-de-Fer", "Capitaine", "Garnison de Rivebois", { discordId: discord(5) }),
    membreEffectif(6, "Sigrid", "Vent-du-Nord", "Lieutenant-Chef", "Garnison de Rivebois", { discordId: discord(6) }),
    membreEffectif(7, "Eydis", "la Silencieuse", "Cadet", "Garnison de Rivebois", { assermente: false }),
    membreEffectif(8, "Alva", "Pied-Léger", "Recrue", "Garnison de Rivebois", { assermente: false }),
    membreEffectif(9, "Torsten", "Pierre-Grise", "Major", "Garnison de Bois-de-Chêne"),
    membreEffectif(10, "Frida", "Val-Profond", "Garde", "Garnison de Bois-de-Chêne"),
    membreEffectif(11, "Hilda", "Pas-Furtif", "Lieutenant", "Cap Granite"),
    membreEffectif(12, "Runa", "Chante-Lame", "Garde", "Éclaireur", { specialite: "Pisteuse", discordId: discord(12) }),
    membreEffectif(13, "Ulfgar", "Bouclier-Noir", "Garde", "État-Major"),
    membreEffectif(14, "Olaf", "Dos-Voûté", "Garde", "Cité de Blancherive", { status: "Réserve", reserve: true }),
    membreEffectif(15, "Ragnhild", "Fer-Juste", "Capitaine", "Cap Granite"),
    membreEffectif(16, "Ivar", "Œil-Sombre", "Garde", "Cap Granite", {
      discordAnomalie: "Identifiant Discord enregistré comme nombre : Sheets en a arrondi les derniers chiffres. Rattacher le compte de nouveau."
    }),
    // Académie militaire : le grade de la feuille reste Sergent-Chef / Caporal ;
    // l'interface affiche l'alias, le grade régulier en rappel.
    membreEffectif(17, "Hrolf", "Main-Sage", "Sergent-Chef", "Académie militaire de Blancherive"),
    membreEffectif(18, "Tove", "Œil-de-Lynx", "Caporal-Chef", "Académie militaire de Blancherive"),
    membreEffectif(19, "Finn", "Sans-Ombre", "Recrue", "Académie militaire de Blancherive", { assermente: false })
  ]
};

/*
  Membres du serveur Discord : la forme suit `getMembresDiscord()` de
  `src/Discord.js`. Eydis et Alva n'y sont pas encore rattachées.
*/
export const membresDiscord = {
  membres: [
    { id: discord(2), nom: "Astrid", pseudo: "astrid.bl" },
    { id: discord(20), nom: "Eyvind", pseudo: "eyvind.rp" },
    { id: discord(7), nom: "Eydis", pseudo: "eydis_silence" },
    { id: discord(8), nom: "Alva Pied-Léger", pseudo: "alva" },
    { id: discord(1), nom: "Haldvar", pseudo: "haldvar" },
    { id: discord(3), nom: "Rorik", pseudo: "rorik_mh" }
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

// Permis de chasse : même forme que `getPermisChasse` de `src/PermisChasse.js`,
// les plus récents d'abord. Le nom est facultatif.
export const permisChasse = {
  permis: [
    { row: 7, prenom: "Lydia", nom: "", date: "2026-10-30" },
    { row: 4, prenom: "Sven", nom: "Fer-Froid", date: "2026-10-18" },
    { row: 6, prenom: "Faendal", nom: "", date: "2026-10-18" },
    { row: 3, prenom: "Élodie", nom: "de Rivebois", date: "2026-09-27" },
    { row: 5, prenom: "Hadvar", nom: "Pied-Sûr", date: "2026-09-12" },
    { row: 2, prenom: "Ralof", nom: "de Rivebois", date: "2026-08-03" }
  ]
};

export const sessionInfo = { role: "OFFICIER" };

/*
  Fiche de service : la forme suit `getFicheService()` de
  `src/FicheService.js`. Eydis, Sergent de Rivebois, vue par un officier.
*/
export const fiche = {
  fiche: {
    prenom: "Eydis", nom: "la Silencieuse", nomComplet: "Eydis la Silencieuse", grade: "Sergent",
    corps: "Garnison de Rivebois", specialite: "Pisteuse", statut: "En service actif", assermente: true
  },
  commandement: {
    corps: [
      { memberId: "demo-5", nomComplet: "Brynjar Poing-de-Fer", grade: "Capitaine", corps: "Garnison de Rivebois" },
      { memberId: "demo-6", nomComplet: "Sigrid Vent-du-Nord", grade: "Lieutenant-Chef", corps: "Garnison de Rivebois" }
    ],
    etatMajor: [
      { memberId: "demo-1", nomComplet: "Haldvar de Blancherive", grade: "Commander", corps: "État-Major" },
      { memberId: "demo-9", nomComplet: "Torsten Pierre-Grise", grade: "Major", corps: "État-Major" }
    ],
    jarl: [{ memberId: "demo-reg", nomComplet: "Cassius Varo", grade: "Régent impérial", corps: "État-Major" }]
  },
  carriere: {
    inscription: "2026-09-06T12:00:00.000Z",
    avantJournal: true,
    evenements: [
      { date: "2026-10-01T10:00:00.000Z", type: "corps", avant: "Cité de Blancherive", apres: "Garnison de Rivebois" },
      { date: "2026-09-20T10:00:00.000Z", type: "grade", avant: "Caporal", apres: "Sergent" }
    ]
  },
  service: {
    lundiCourant: "2026-10-12", exclu: false,
    semaineCourante: { lundi: "2026-10-12", jours: [true, true, false, false, false, false, false], joursPresents: 2, solde: 80, financeur: "Thane de Rivebois" },
    enAttente: [
      { lundi: "2026-10-05", joursPresents: 3, solde: 120, financeur: "Thane de Rivebois" },
      { lundi: "2026-09-14", joursPresents: 1, solde: 40, financeur: "Thane de Rivebois" }
    ],
    totalEnAttente: 160, totalPercu: 640, derniereSemaineReglee: "2026-09-28",
    joursTotal: 24, semainesServies: 8, moyenne: 3, serie: 3,
    dernierJour: "2026-10-13", joursDepuis: 1, inactif: false, seuilInactivite: 5
  },
  justice: {
    amendes: {
      nombre: 6, total: 950,
      aEncaisser: { nombre: 2, total: 100, aDeterminer: 1 },
      aReverser: { nombre: 1, total: 200 },
      dernieres: [
        { date: "04/10/2026", contrevenant: "Ysolda", infraction: "CPL art. 10 — Des injures et calomnies", montant: 50, paye: true, reverse: true },
        { date: "03/10/2026", contrevenant: "Heimskr", infraction: "CPL art. 10 — Des injures et calomnies", montant: 200, paye: true, reverse: false },
        { date: "02/10/2026", contrevenant: "Belethor", infraction: "CPL art. 3 — Des ordres et sommations légitimes", montant: null, paye: false, reverse: false },
        { date: "01/10/2026", contrevenant: "Nazeem", infraction: "CPL art. 10 — Des injures et calomnies", montant: 100, paye: false, reverse: false }
      ]
    },
    prison: {
      nombre: 3,
      transferes: 1,
      enCellule: [{ date: "06/10/2026", detenu: "Belethor", cellule: "III", infraction: "CPL art. 3 — Des ordres et sommations légitimes", entree: "06/10/2026 10:00", sortie: "16/10/2026 10:00", libere: false }],
      dernieres: []
    }
  }
};
