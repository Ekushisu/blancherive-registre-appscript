// ============================================================
// DÉCRETS DE PEINES ET AMENDES
// ============================================================
//
// Barème des sanctions article par article : amende et durée de cachot
// proposées par les formulaires Amendes et Prison, consultées dans la page
// « Décrets de peines et amendes » et dans la lecture d'un article.
//
// Décision du propriétaire du 4 octobre 2026, sur l'avis du magistrat de
// Blancherive : les quatre codes de la châtellerie ne chiffrant aucune peine,
// on se réfère aux fourchettes impériales du Corpus Juriscivilis
// (contravention jusqu'à 500 septims, délit de 500 à 2 500, crime au-delà).
//
// Feuille PeinesAmendes, créée et initialisée à la première consultation si
// elle n'existe pas, ou si elle existe entièrement vide. Une feuille déjà
// remplie n'est jamais réécrite : elle se corrige ensuite dans Sheets, comme
// SoldesGrades.
//
//   A  Source                      nom exact de la source au Codex (SyncCodex!A)
//   B  Article                     numéro au Codex (SyncCodex!B) ; « * » vise
//                                  tous les articles de la source sans ligne propre
//   C  Intitulé                    titre de l'article, pour la lecture de la feuille
//   D  Niveau                      cas visé : « Cas de base », « Forme aggravée — … »
//   E  Qualification               Contravention, Délit, Crime, Spéciale ou Renvoi
//   F  Échelon                     C1-C4, D1-D4, K1-K4, PM (peine maximale)
//   G  Amende (septims)            entier
//   H  Cachot (heures)             nombre, fraction admise
//   I  Amende nobiliaire (septims) amende proposée à un noble à la place du
//                                  cachot (De Re Nobilitatis, art. 9)
//   J  Crime de sang               « oui » : aucune amende de substitution
//   K  Peines complémentaires      confiscation, remise en état, restitution…
//   L  Observations                renvois, réserves, conditions du texte
//
// Le barème propose, il n'impose pas : Amendes.js et Prison.js ne lisent pas
// cette feuille, le montant et la durée restent saisis librement. Une ligne
// illisible est écartée des propositions et signalée, jamais ignorée en
// silence ; une ligne hors fourchette reste proposée avec un avertissement,
// l'écart pouvant être voulu par le magistrat.
//
// Helpers partagés provenant d'Amendes.js : nettoyerSaisieUtilisateur() ;
// de Codex.js : cleArticleCodex_().
// ============================================================

const PEINES_SHEET_NAME = "PeinesAmendes";
const PEINES_HEADERS = [
  "Source",
  "Article",
  "Intitulé",
  "Niveau",
  "Qualification",
  "Échelon",
  "Amende (septims)",
  "Cachot (heures)",
  "Amende nobiliaire (septims)",
  "Crime de sang",
  "Peines complémentaires",
  "Observations"
];
const PEINES_NIVEAU_DEFAUT = "Cas de base";
// Un an de cachot : au-delà, la saisie est une erreur de frappe (même borne que Prison.js).
const PEINES_CACHOT_MAX_HEURES = 24 * 366;


// ============================================================
// BARÈME INITIAL
// ============================================================

/*
  Fourchettes du Corpus Juriscivilis Imperialis, principes généraux :
  contravention jusqu'à 500 septims (amende simple ou travaux légers), délit
  de 500 à 2 500 (amende élevée ou travaux forcés), crime au-delà de 2 500
  (amende forte, emprisonnement ou peine de mort).
*/
const PEINES_FOURCHETTES = {
  contravention: { min: 1, max: 500 },
  délit: { min: 500, max: 2500 },
  crime: { min: 2501, max: null }
};

/*
  Échelons du barème : chaque article est rangé dans la fourchette de sa
  qualification, selon la gravité des faits. Le cachot n'apparaît qu'aux
  délits graves et aux crimes : la classification impériale réserve
  l'emprisonnement aux crimes, et la juridiction peut le prononcer « selon les
  circonstances et la gravité des faits ».

  PM : peine maximale — mort ou bannissement définitif, saisie des biens —
  sur verdict public et motivé du magistrat (Corpus Proceduralis, art. 11).
  Elle ne se chiffre pas.

  Délits resserrés au bas de leur fourchette, à la demande du propriétaire
  (4 octobre 2026) : le barème d'origine, de 750 à 2 250 septims, était jugé
  trop sévère. Les crimes sont inchangés.
*/
const PEINES_ECHELONS = {
  C1: { qualification: "Contravention", amende: 50 },
  C2: { qualification: "Contravention", amende: 150 },
  C3: { qualification: "Contravention", amende: 300 },
  C4: { qualification: "Contravention", amende: 500 },
  D1: { qualification: "Délit", amende: 500 },
  D2: { qualification: "Délit", amende: 750 },
  D3: { qualification: "Délit", amende: 1000, cachot: 0.5 },
  D4: { qualification: "Délit", amende: 1250, cachot: 1 },
  K1: { qualification: "Crime", amende: 3000, cachot: 1 },
  K2: { qualification: "Crime", amende: 5000, cachot: 2 },
  K3: { qualification: "Crime", amende: 8000, cachot: 4 },
  K4: { qualification: "Crime", amende: 12000, cachot: 6 },
  PM: { qualification: "Crime" }
};

/*
  Noblesse. Un noble reconnu coupable doit toujours se voir proposer une
  amende, sauf crime de sang (De Re Nobilitatis, art. 9) : le cachot est
  racheté à 1 000 septims l'heure, sans sortir de la fourchette délictuelle
  pour un délit. Taux retenu à l'initialisation ; la colonne I fait foi
  ensuite et se corrige ligne par ligne.
*/
const PEINES_RACHAT_NOBLE_PAR_HEURE = 1000;

const PEINES_SOURCES = {
  CPL: "Code pénal local de Blancherive",
  CCoL: "Code du commerce local de Blancherive",
  CJI: "Corpus Juriscivilis Imperialis",
  DRN: "De Re Nobilitatis",
  CPen: "Codex Penitus Imperialis",
  JM: "Justicia Militaris",
  ORS: "Décret sur les équipements stratégiques Orsimer",
  DWE: "Décret sur les équipements dwemers",
  ETH: "Décret sur les armes éthérées",
  DRBI: "Decretum de Restitutione Bonorum Imperii"
};

const PEINES_VERDICT = "Verdict public et motivé du magistrat (Corpus Proceduralis, art. 11).";
const PEINES_PEINE_MAXIMALE = "Mort ou bannissement définitif du territoire, saisie des biens.";
const PEINES_CONFISCATION_84 = "Saisie et confiscation des ressources, objets et découvertes (art. 84).";
const PEINES_PRODUIT = "Confiscation possible du produit de l’infraction.";
const PEINES_RESTITUTION = "Restitution du bien ou de sa valeur (Code civil local, art. 19).";
const PEINES_TITRE_CORPS = "Le titre qualifie de crime, le corps de l’article de délit : qualification à trancher par le magistrat.";

/*
  [sigle de la source, article, intitulé, niveau, échelon ou qualification,
   peines complémentaires, observations, options]

  options : { sang: true } pour un crime de sang ; { amende } pour une
  sanction spéciale chiffrée hors échelon.
*/
const PEINES_INITIALES = [
  // ----- Code pénal local de Blancherive -----
  ["CPL", "4", "Refus d’obtempérer à une injonction locale", "", "D1", "", "Ordre verbal ou gestuel donné dans l’instant ; l’inexécution d’une mise en demeure écrite relève de l’art. 95. Avec violences ou menaces contre un contrôle : art. 72."],
  ["CPL", "5", "Entrave à l’action des autorités locales", "", "D2", "", "Subsidiaire : moyens non couverts par les art. 6, 17 ou 25."],
  ["CPL", "6", "Entrave à un contrôle de sécurité", "", "D2", "", "Porte sur le contenu du contrôle ; le refus de s’y soumettre relève de l’art. 4."],
  ["CPL", "7", "Usurpation d’un signe officiel local", "", "C4", "Confiscation des effets constituant l’infraction (art. 7)."],
  ["CPL", "7", "Usurpation d’un signe officiel local", "Requalification en délit — pour obtenir un avantage ou tromper un tiers", "D2", "Confiscation des effets constituant l’infraction (art. 7)."],
  ["CPL", "8", "Usurpation d’une fonction locale", "", "D3", "", "L’usurpation d’une fonction impériale centrale relève du Codex Penitus, art. 5."],
  ["CPL", "8", "Usurpation d’une fonction locale", "Requalification en crime — fonction d’un membre de la Cour, ou décision souveraine prise de fait", "K2"],
  ["CPL", "9", "Propos irrespectueux envers une autorité locale", "", "C2", "", "Sans menace ni contestation organisée ; sinon art. 11 ou 12."],
  ["CPL", "10", "Provocation à l’irrespect de l’autorité locale", "", "D1"],
  ["CPL", "11", "Contestation publique de l’autorité de la châtellerie", "", "D1", "", "La critique de bonne foi, la contestation respectueuse et l’exercice des voies de recours ne sont pas punissables."],
  ["CPL", "12", "Outrage aggravé envers une autorité locale", "", "D2"],
  ["CPL", "13", "Atteinte organisée à l’autorité locale", "", "K3"],
  ["CPL", "13", "Atteinte organisée à l’autorité locale", "Peine maximale", "PM", PEINES_PEINE_MAXIMALE, PEINES_VERDICT],
  ["CPL", "14", "Lèse-majesté locale", "Atteinte à un membre de la Cour", "K2"],
  ["CPL", "14", "Lèse-majesté locale", "Atteinte au Jarl", "K3", "", "Gradation selon la personne visée, laissée à l’appréciation du magistrat."],
  ["CPL", "15", "Sédition contre la châtellerie", "", "K3"],
  ["CPL", "15", "Sédition contre la châtellerie", "Peine maximale", "PM", PEINES_PEINE_MAXIMALE, PEINES_VERDICT],
  ["CPL", "15-1", "Trahison", "", "K4", "", "Article non rédigé à ce jour : sans définition de l’infraction, l’élément légal manque. Aucune poursuite sur ce seul fondement avant sa rédaction par la Cour."],
  ["CPL", "15-1", "Trahison", "Peine maximale", "PM", PEINES_PEINE_MAXIMALE, PEINES_VERDICT + " Article non rédigé à ce jour."],
  ["CPL", "16", "Injure", "", "C2"],
  ["CPL", "17", "Diffamation", "", "D1", "", "La critique de bonne foi et la dénonciation fondée sur des éléments sérieux ne sont pas punissables."],
  ["CPL", "18", "Dénonciation calomnieuse", "Imputation d’une contravention", "C3", "", "La sanction dépend de l’infraction imputée : l’échelon suit sa qualification."],
  ["CPL", "18", "Dénonciation calomnieuse", "Imputation d’un délit", "D2"],
  ["CPL", "18", "Dénonciation calomnieuse", "Imputation d’un crime", "K1"],
  ["CPL", "19", "Chantage", "", "D2", "", "La simple menace d’engager une procédure légale n’est pas un chantage."],
  ["CPL", "20", "Menaces", "", "D1"],
  ["CPL", "21", "Harcèlement moral", "", "D2"],
  ["CPL", "21", "Harcèlement moral", "Requalification en crime — en réunion, ou dans une relation d’autorité, de dépendance ou de service", "K1"],
  ["CPL", "22", "Faux témoignage", "", "K2", "", "L’erreur, l’oubli ou la rétractation spontanée avant la décision ne sont pas punissables."],
  ["CPL", "23", "Atteinte à la mémoire des défunts", "", "D1", "", "La profanation relève du Corpus Juriscivilis, art. 10."],
  ["CPL", "24", "Mise en danger d’autrui", "", "C3"],
  ["CPL", "24", "Mise en danger d’autrui", "Requalification en délit — monture, engin, sortilège ou substance dangereuse", "D1"],
  ["CPL", "25", "Refus d’assistance à personne en péril", "", "D1", "", "Alerter immédiatement les autorités vaut assistance lorsque l’intervention directe est dangereuse ou impossible."],
  ["CPL", "26", "Blessures causées par négligence grave", "", "D2", "", "Les violences volontaires relèvent du Corpus Juriscivilis, art. 5."],
  ["CPL", "27", "Atteinte à la pudeur", "", "D2"],
  ["CPL", "27", "Atteinte à la pudeur", "Forme aggravée — sous menace, sur une personne vulnérable ou en réunion", "D4"],
  ["CPL", "28", "Exhibition obscène", "", "C2"],
  ["CPL", "28", "Exhibition obscène", "Requalification en délit — pour provoquer, choquer ou attirer un attroupement", "D1"],
  ["CPL", "29", "Administration clandestine d’une substance", "", "K2"],
  ["CPL", "30", "Privation abusive de liberté", "", "D2", "", "La séquestration relève du Corpus Juriscivilis, art. 14."],
  ["CPL", "30", "Privation abusive de liberté", "Forme aggravée — par une personne ayant autorité ou tutelle, ou au-delà d’une journée", "D4"],
  ["CPL", "31", "Dégradation d’un bien", "", "D1"],
  ["CPL", "32", "Destruction d’un bien", "", "D2"],
  ["CPL", "33", "Altération d’un bien", "", "D1"],
  ["CPL", "34", "Contamination d’un bien", "", "D1"],
  ["CPL", "34", "Contamination d’un bien", "Forme aggravée — bien destiné à la consommation, aux soins ou à l’approvisionnement", "D3"],
  ["CPL", "35", "Déplacement ou dissimulation d’un bien", "", "C2", "Restitution du bien (Code civil local, art. 19)."],
  ["CPL", "36", "Atteinte à un bien placé sous scellés", "", "D2"],
  ["CPL", "37", "Dégradation d’un bien protégé", "", "D3", "", "Bien d’intérêt historique, religieux, artistique ou patrimonial."],
  ["CPL", "38", "Détention locale irrégulière", "", "D1", "Saisie ou confiscation possible du bien (art. 42).", "Licence relevant exclusivement de la châtellerie (art. 38 et 42)."],
  ["CPL", "39", "Recel local d’un bien réglementé", "", "D2", "Saisie ou confiscation possible du bien (art. 42)."],
  ["CPL", "40", "Mise en circulation d’un bien localement interdit", "", "D3", "Saisie ou confiscation possible du bien (art. 42)."],
  ["CPL", "41", "Violation des conditions d’une licence locale", "", "C2", "Saisie ou confiscation possible du bien (art. 42)."],
  ["CPL", "43", "Intrusion dans une propriété privée locale", "", "C2", "", "Sans préjudice du Corpus Juriscivilis, art. 4."],
  ["CPL", "44", "Occupation illégitime d’une propriété privée", "", "D1"],
  ["CPL", "45", "Usage non autorisé d’une propriété privée causant préjudice", "", "K1", "", "Crime si le préjudice est significatif ; à défaut, art. 44."],
  ["CPL", "46", "Dégradation d’un bien public local", "", "D2", "", "Bien également affecté à l’Empire : qualifications impériales possibles."],
  ["CPL", "47", "Occupation illégitime d’un lieu public local", "", "C2", "Confiscation possible des biens occupés illicitement (art. 47)."],
  ["CPL", "48", "Entrave à une infrastructure publique locale", "", "D1"],
  ["CPL", "49", "Trouble volontaire à l’ordre public", "", "C2"],
  ["CPL", "50", "Fausse alerte locale", "", "C3", "", "Délit (art. 52) si elle provoque une évacuation ou mobilise la garde ou les secours."],
  ["CPL", "51", "Usage frauduleux d’un signal officiel local", "", "C3", "", "Délit (art. 52) si l’usage provoque une évacuation ou mobilise la garde ou les secours."],
  ["CPL", "52", "Alerte gravement perturbatrice", "", "D2", "", "Évacuation, fermeture de zone, intervention des secours, déplacement de moyens ou engagement de la garde."],
  ["CPL", "53", "Abandon de déchets ou d’objets", "", "C1", "Remise en état ou nettoyage (art. 53)."],
  ["CPL", "54", "Souillure de l’espace public", "", "C2"],
  ["CPL", "55", "Nuisances olfactives", "", "C1"],
  ["CPL", "56", "Mendicité troublant l’ordre public", "", "C1", "", "L’appel à la charité respectueux de l’ordre public, notamment par les cultes reconnus, n’est pas visé."],
  ["CPL", "57", "Dissimulation irrégulière du visage", "", "C1", "", "Exceptions : climat, santé, activité professionnelle, coutume autorisée ou nécessité légitime."],
  ["CPL", "58", "Refus d’identification", "Refus de décliner son identité", "C2"],
  ["CPL", "58", "Refus d’identification", "Fausse identité ou identité d’un tiers (délit)", "D1", "", "Délit par renvoi au Corpus Juriscivilis, art. 1."],
  ["CPL", "59", "Dissimulation magique de la présence", "", "C2"],
  ["CPL", "59", "Dissimulation magique de la présence", "Requalification en délit — pendant un contrôle officiel ou dans une propriété publique", "D1"],
  ["CPL", "60", "Dissimulation frauduleuse", "Valeur ou somme éludée jusqu’à 500 septims", "C3", "", "Qualification selon la valeur de l’objet ou le montant éludé, aux seuils impériaux. L’objet dont la détention est elle-même interdite reste poursuivi pour cette infraction."],
  ["CPL", "60", "Dissimulation frauduleuse", "Valeur ou somme éludée de 500 à 2 500 septims", "D2"],
  ["CPL", "60", "Dissimulation frauduleuse", "Valeur ou somme éludée au-delà de 2 500 septims", "K1"],
  ["CPL", "61", "Obstruction d’une voie publique locale", "", "C2", "", "Crime (art. 63) pour un passage stratégique."],
  ["CPL", "62", "Atteinte à une balise de sécurité locale", "", "D1"],
  ["CPL", "63", "Obstruction d’un passage stratégique local", "", "K1", "", "Passage nécessaire aux secours, au ravitaillement, à la défense ou à l’évacuation."],
  ["CPL", "64", "Fraude commerciale locale", "", "D2", PEINES_PRODUIT],
  ["CPL", "65", "Commerce interdit", "", "D2", PEINES_PRODUIT],
  ["CPL", "66", "Exploitation clandestine locale", "", "D2", PEINES_PRODUIT],
  ["CPL", "67", "Poursuite d’une exploitation fermée administrativement", "", "D3", PEINES_PRODUIT],
  ["CPL", "68", "Mise en danger par exploitation", "", "K1"],
  ["CPL", "69", "Refus de présentation des documents d’exploitation", "", "D1"],
  ["CPL", "70", "Dissimulation ou falsification de documents d’exploitation", "", "K1"],
  ["CPL", "71", "Entrave à une inspection locale", "", "D2"],
  ["CPL", "72", "Opposition violente à un contrôle local", "", "K2", "", "Sans préjudice des autres infractions commises, violences comprises."],
  ["CPL", "73", "Dissimulation de bénéfices d’une exploitation locale", "", "D2", "Paiement des sommes éludées.", "Sans préjudice du Codex Penitus, art. 19, pour les sommes dues à l’Empire."],
  ["CPL", "74", "Chasse sans droit", "", "C2", PEINES_CONFISCATION_84],
  ["CPL", "75", "Chasse dangereuse", "", "D1"],
  ["CPL", "76", "Exploitation illicite des ressources cynégétiques", "", "D1", "Saisie et confiscation des ressources et de leurs produits (art. 76 et 84)."],
  ["CPL", "77", "Chasse d’espèces protégées", "", "D2", PEINES_CONFISCATION_84],
  ["CPL", "78", "Exploitation illicite de la flore locale", "", "D1", PEINES_CONFISCATION_84],
  ["CPL", "79", "Atteinte aux espèces végétales protégées", "", "D2", PEINES_CONFISCATION_84],
  ["CPL", "80", "Dégradation volontaire de l’environnement local", "", "K1", "Remise en état (art. 80)."],
  ["CPL", "81", "Expédition sans autorisation à Blancherive", "", "C3", PEINES_CONFISCATION_84],
  ["CPL", "82", "Exploitation illicite d’un site ou de ruines locaux", "", "D2", PEINES_CONFISCATION_84, "Site reconnu comme installation impériale : qualifications du Codex Penitus."],
  ["CPL", "83", "Trafic d’objets issus d’une expédition locale", "", "K1", PEINES_CONFISCATION_84],
  ["CPL", "85", "Altération magique de la volonté", "", "D3", "", "Sans préjudice du Corpus Juriscivilis, art. 11."],
  ["CPL", "86", "Influence magique frauduleuse", "Qualification du corps de l’article (délit)", "D4", "Saisie ou restitution du produit de l’infraction (art. 86).", PEINES_TITRE_CORPS],
  ["CPL", "86", "Influence magique frauduleuse", "Qualification du titre (crime)", "K1", "Saisie ou restitution du produit de l’infraction (art. 86).", PEINES_TITRE_CORPS],
  ["CPL", "87", "Invocation dangereuse", "", "K2"],
  ["CPL", "88", "Libération d’une créature dangereuse", "", "K2"],
  ["CPL", "89", "Expérience magique dangereuse", "", "D3"],
  ["CPL", "90", "Poursuite d’une expérience interdite", "Qualification du corps de l’article (délit)", "D4", "", PEINES_TITRE_CORPS + " L’ordre d’interruption doit reposer sur un risque caractérisé."],
  ["CPL", "90", "Poursuite d’une expérience interdite", "Qualification du titre (crime)", "K1", "", PEINES_TITRE_CORPS],
  ["CPL", "91", "Pratique magique catastrophique", "", "K4"],
  ["CPL", "91", "Pratique magique catastrophique", "Peine maximale", "PM", PEINES_PEINE_MAXIMALE, PEINES_VERDICT],
  ["CPL", "92", "Contournement d’une interdiction magique locale", "", "D2"],
  ["CPL", "93", "Violation d’une mesure exceptionnelle locale", "Mesure qualifiée de contravention par l’acte", "C3", "", "La qualification et la peine fixées par l’acte qui proclame la mesure priment sur le barème."],
  ["CPL", "93", "Violation d’une mesure exceptionnelle locale", "Mesure qualifiée de délit par l’acte", "D2", "", "La qualification et la peine fixées par l’acte qui proclame la mesure priment sur le barème."],
  ["CPL", "93", "Violation d’une mesure exceptionnelle locale", "Mesure qualifiée de crime par l’acte", "K1", "", "La qualification et la peine fixées par l’acte qui proclame la mesure priment sur le barème."],
  ["CPL", "95", "Non-respect d’une mise en demeure administrative", "", "D1", "", "La régularité de la mise en demeure peut être contestée devant le magistrat."],

  // ----- Code du commerce local de Blancherive -----
  ["CCoL", "10", "Réserves limitées et non-concurrence", "Dépassement des réserves autorisées", "C2", "Confiscation immédiate des marchandises concernées (art. 10).", "Qualification non précisée par le texte : contravention retenue par le barème. Poursuites possibles au titre du Code pénal local, art. 38 et 73."],
  ["CCoL", "12", "Exploitation sans concession", "", "D2", PEINES_PRODUIT, "Sans préjudice du Code pénal local, art. 69, 70 et 73."],
  ["CCoL", "13", "Fraude et manquements aux obligations", "Fraude fiscale, comptabilité inexacte ou refus de présenter les documents", "D2", "", "Le texte renvoie aux « articles 42 à 46 du Code pénal local », étrangers à la matière : voir les art. 69 à 73 de ce code."],
  ["CCoL", "13", "Fraude et manquements aux obligations", "Ouverture minimale non respectée après mise en demeure restée sans effet", "D1"],
  ["CCoL", "14", "Vente à la sauvette", "", "D1", "Confiscation possible des marchandises (art. 14).", "Les art. 38, 64, 65 et 66 du Code pénal local s’appliquent s’ils répriment plus sévèrement."],

  // ----- Corpus Juriscivilis Imperialis -----
  ["CJI", "1", "Usurpation d'identité", "", "C3"],
  ["CJI", "1", "Usurpation d'identité", "Requalification en délit — qualité noble ou fonction officielle", "D2"],
  ["CJI", "2", "Refus d'obtempérer", "", "C2", "", "Envers une autorité de Blancherive, le Code pénal local, art. 4 (délit), prévaut (art. 3 de ce code)."],
  ["CJI", "2", "Refus d'obtempérer", "Requalification en délit — usage de violence, de magie ou de potions", "D2"],
  ["CJI", "3", "Atteinte à la paix de l’Empereur", "", "C2"],
  ["CJI", "4", "Intrusion", "Propriété privée", "C2"],
  ["CJI", "4", "Intrusion", "Requalification en délit — propriété publique de l’Empire ou d’une châtellerie", "D1"],
  ["CJI", "5", "Violences et agressions", "Contusions ou blessures légères", "D2", "", "Crime avec une circonstance de l’art. 8 : arme ou magie, réunion, représentant de l’autorité, mutilation."],
  ["CJI", "5", "Violences et agressions", "Incapacité ou séquelles", "D4"],
  ["CJI", "6", "Vol, escroquerie", "Bien ou service d’une valeur jusqu’à 500 septims", "D1", PEINES_RESTITUTION, "Valeur « particulièrement élevée » : au-delà de 2 500 septims, seuil criminel de la classification impériale."],
  ["CJI", "6", "Vol, escroquerie", "Bien ou service d’une valeur de 500 à 2 500 septims", "D2", PEINES_RESTITUTION],
  ["CJI", "6", "Vol, escroquerie", "Requalification en crime — valeur au-delà de 2 500 septims, ou objet sous licence", "K1", PEINES_RESTITUTION],
  ["CJI", "7", "Recel", "Bien d’une valeur jusqu’à 500 septims", "D1", PEINES_RESTITUTION],
  ["CJI", "7", "Recel", "Bien d’une valeur de 500 à 2 500 septims", "D2", PEINES_RESTITUTION],
  ["CJI", "7", "Recel", "Requalification en crime — valeur au-delà de 2 500 septims, ou objet sous licence", "K1", PEINES_RESTITUTION],
  ["CJI", "8", "Circonstances aggravantes", "Vol, escroquerie ou recel aggravés", "K1", PEINES_RESTITUTION, "Cité avec l’art. 6 ou 7 pour un même fait : seule la qualification aggravée est retenue."],
  ["CJI", "8", "Circonstances aggravantes", "Violences aggravées — arme ou magie, réunion, ou contre un représentant de l’autorité", "K2", "", "Cité avec l’art. 5 pour un même fait : seule la qualification aggravée est retenue.", { sang: true }],
  ["CJI", "8", "Circonstances aggravantes", "Violences avec mutilation", "K3", "", "", { sang: true }],
  ["CJI", "9", "Pratique de culte non autorisé", "", "D2", "", "Un culte respectant la tolérance conditionnelle n’est pas visé, ni la simple possession d’objets d’un culte toléré."],
  ["CJI", "9", "Pratique de culte non autorisé", "Requalification en crime — culte daedrique hors tolérance conditionnelle", "K2"],
  ["CJI", "10", "Profanation", "", "D2"],
  ["CJI", "10", "Profanation", "Requalification en crime — motif daedrique", "K2"],
  ["CJI", "11", "Usage de magie non autorisé", "", "D2", "", "Notamment gemmes spirituelles noires et capture de l’âme d’un être conscient."],
  ["CJI", "11", "Usage de magie non autorisé", "Requalification en crime — usage dangereux, offensif ou coercitif, ou causant trouble grave, blessures ou dommages", "K2"],
  ["CJI", "12", "Meurtre", "", "K3", "", "Exclus : guerre ou bataille légitime, usage légitime de la force, exécution judiciaire, injonction impériale, duel légal consenti.", { sang: true }],
  ["CJI", "12", "Meurtre", "Peine maximale", "PM", PEINES_PEINE_MAXIMALE, PEINES_VERDICT, { sang: true }],
  ["CJI", "13", "Assassinat", "", "K4", "", "Puni plus sévèrement que le meurtre (art. 13).", { sang: true }],
  ["CJI", "13", "Assassinat", "Peine maximale", "PM", PEINES_PEINE_MAXIMALE, PEINES_VERDICT, { sang: true }],
  ["CJI", "14", "Torture, séquestration", "Séquestration", "K2"],
  ["CJI", "14", "Torture, séquestration", "Torture, mutilation ou acte de barbarie", "K4", "", "", { sang: true }],
  ["CJI", "15", "Évasion", "", "K1", "", "La peine restant à purger s’ajoute."],
  ["CJI", "16", "Créatures profanes et abominations", "", "K3", "", "Vampires, lycanthropes et créatures assimilées se maintenant parmi la population."],
  ["CJI", "16", "Créatures profanes et abominations", "Peine maximale", "PM", PEINES_PEINE_MAXIMALE, PEINES_VERDICT],
  ["CJI", "17", "Abus de pouvoir et corruption", "", "K2", "", "Corruption active comme passive."],

  // ----- De Re Nobilitatis -----
  ["DRN", "4", "Devoirs et Obligations", "Manquement isolé", "Spéciale", "Remboursement des sommes dues.", "Plafond : 5 000 septims, cumulés avec le remboursement des sommes dues et un bannissement temporaire ou définitif.", { amende: 1000 }],
  ["DRN", "4", "Devoirs et Obligations", "Manquement grave — convocation judiciaire ignorée, impôt non acquitté, Jarl non soutenu", "Spéciale", "Remboursement des sommes dues.", "", { amende: 2500 }],
  ["DRN", "4", "Devoirs et Obligations", "Manquement grave et réitéré", "Spéciale", "Remboursement des sommes dues ; bannissement temporaire ou définitif des terres du Jarl.", "", { amende: 5000 }],

  // ----- Décrets impériaux -----
  ["ORS", "4", "Sanctions — port et fabrication irréguliers", "Port d’une armure Orsimer sans rite", "C4", "Saisie de l’armure (art. 4).", "Qualification non précisée par le décret : retenue par le barème. Les armes Orsimer ne sont pas visées."],
  ["ORS", "4", "Sanctions — port et fabrication irréguliers", "Fabrication, vente ou commerce sans habilitation", "D2", "Saisie des équipements."],
  ["ORS", "4", "Sanctions — port et fabrication irréguliers", "Falsification ou usage frauduleux d’une attestation rituelle", "D2", "", "Poursuites possibles au titre du Corpus Juriscivilis."],

  // ----- Renvois -----
  ["CPen", "*", "", "Compétence exclusive des juridictions impériales", "Renvoi", "", "Interpeller si nécessaire, consigner les faits et remettre l’affaire aux autorités impériales : le jugement de ces infractions leur est réservé (préambule)."],
  ["JM", "*", "", "Juridiction militaire", "Renvoi", "", "Un légionnaire dans l’exercice de ses fonctions ne relève que de la juridiction militaire (préambule) : signaler les faits à sa hiérarchie."],
  ["DWE", "5", "Sanctions — port irrégulier et fabrication", "Procès impérial à Markarth", "Renvoi", "Confiscation immédiate des équipements dwemers.", "Saisir, inventorier et remettre à la Compagnie Orientale ; transmettre la procédure à la Chancellerie impériale."],
  ["ETH", "2", "Interdiction générale", "Compétence impériale", "Renvoi", "Remise de l’arme aux autorités impériales (art. 3).", "Atteinte à l’ordre impérial (art. 4) : saisie des biens et peine capitale encourues devant les autorités impériales."],
  ["DRBI", "*", "", "Juges impériaux", "Renvoi", "Réquisition du bien impérial (art. II).", "Vol aggravé et recel contre l’Empire jugés par les juges impériaux (art. V) ; la garde saisit le bien et le remet à la Légion."]
];


// ============================================================
// WEB APP - LECTURE
// ============================================================

/*
  Barème complet, versionné comme le Codex : le navigateur garde sa copie
  (`ui/src/peines.js`) et renvoie sa version ; rien n'est renvoyé si la
  feuille n'a pas changé. Lecture GARDE et OFFICIER, qui appliquent le
  barème, et INTENDANT, qui le consulte (décision du propriétaire du
  4 octobre 2026). Le rôle public n'y a pas accès.
*/
function getPeinesAmendes(token, versionConnue) {
  requireRole(token, ["GARDE", "OFFICIER", "INTENDANT"]);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const lecture = lirePeinesAmendes_(feuillePeinesAmendes_(ss));

  if (
    typeof versionConnue === "string" &&
    versionConnue &&
    versionConnue === lecture.version
  ) {
    return { version: lecture.version, lignes: null, anomalies: null };
  }

  return lecture;
}


// ============================================================
// FEUILLE
// ============================================================

/*
  Renvoie la feuille, créée et initialisée si elle manque ou si elle est
  entièrement vide. Une feuille remplie n'est jamais réécrite : des en-têtes
  différents arrêtent tout, plutôt que de lire des colonnes qu'on ne
  comprend pas.
*/
function feuillePeinesAmendes_(ss) {
  let sheet = ss.getSheetByName(PEINES_SHEET_NAME);

  if (!sheet || sheet.getLastRow() === 0) {
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      sheet = ss.getSheetByName(PEINES_SHEET_NAME) || ss.insertSheet(PEINES_SHEET_NAME);
      if (sheet.getLastRow() === 0) {
        initialiserPeinesAmendes_(sheet);
      }
    } finally {
      lock.releaseLock();
    }
  }

  const largeur = PEINES_HEADERS.length;
  if (sheet.getMaxColumns() < largeur) {
    throw new Error(`La feuille ${PEINES_SHEET_NAME} doit contenir les colonnes ${PEINES_HEADERS.join(", ")}. Aucun contenu remplacé.`);
  }
  const entetes = sheet.getRange(1, 1, 1, largeur).getDisplayValues()[0].map(nettoyerSaisieUtilisateur);
  if (entetes.join("|") !== PEINES_HEADERS.join("|")) {
    throw new Error(`La feuille ${PEINES_SHEET_NAME} doit contenir les colonnes ${PEINES_HEADERS.join(", ")} en A:L. Aucun contenu remplacé.`);
  }

  return sheet;
}


function initialiserPeinesAmendes_(sheet) {
  const lignes = construireBaremeInitial_();
  const largeur = PEINES_HEADERS.length;
  const total = lignes.length + 1;

  if (sheet.getMaxColumns() < largeur) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), largeur - sheet.getMaxColumns());
  }
  if (sheet.getMaxRows() < total) {
    sheet.insertRowsAfter(sheet.getMaxRows(), total - sheet.getMaxRows());
  }

  // Texte brut pour l'article : « 15-1 » ne doit pas devenir une date, ni « 4 » un nombre.
  sheet.getRange(1, 1, total, 6).setNumberFormat("@");
  sheet.getRange(1, 10, total, 3).setNumberFormat("@");
  sheet.getRange(1, 1, 1, largeur).setValues([PEINES_HEADERS]).setFontWeight("bold");
  sheet.getRange(2, 1, lignes.length, largeur).setValues(lignes);
  sheet.getRange(2, 11, lignes.length, 2).setWrap(true);
  sheet.setFrozenRows(1);

  [230, 70, 260, 300, 110, 75, 120, 110, 160, 100, 280, 380].forEach(function (largeurColonne, index) {
    sheet.setColumnWidth(index + 1, largeurColonne);
  });

  SpreadsheetApp.flush();
}


/*
  Lignes A:L du barème initial. Les montants viennent des échelons ; le
  rachat nobiliaire du cachot est calculé ici, une fois, puis appartient à la
  feuille.
*/
function construireBaremeInitial_() {
  return PEINES_INITIALES.map(function (entree) {
    const sigle = entree[0];
    const article = entree[1];
    const intitule = entree[2] || "";
    const niveau = entree[3] || PEINES_NIVEAU_DEFAUT;
    const code = entree[4];
    const complements = entree[5] || "";
    const observations = entree[6] || "";
    const options = entree[7] || {};
    const source = PEINES_SOURCES[sigle];
    const echelon = PEINES_ECHELONS[code];

    if (!source) {
      throw new Error(`Barème initial : source inconnue ${sigle}.`);
    }

    if (!echelon) {
      return [source, article, intitule, niveau, code, "", options.amende || "", "", "", options.sang ? "oui" : "", complements, observations];
    }

    const amende = echelon.amende || "";
    const cachot = echelon.cachot || "";
    let nobiliaire = "";

    if (cachot && !options.sang) {
      nobiliaire = amende + cachot * PEINES_RACHAT_NOBLE_PAR_HEURE;
      if (echelon.qualification === "Délit") {
        nobiliaire = Math.min(nobiliaire, PEINES_FOURCHETTES["délit"].max);
      }
    }

    return [source, article, intitule, niveau, echelon.qualification, code, amende, cachot, nobiliaire, options.sang ? "oui" : "", complements, observations];
  });
}


// ============================================================
// LECTURE ET CONTRÔLE DES LIGNES
// ============================================================

/*
  Lit A:L par bloc. Une ligne vide est sautée ; une ligne illisible est
  écartée et signalée dans `anomalies` avec son numéro de ligne physique ;
  une ligne lisible mais douteuse (hors fourchette, échelon incohérent…) est
  gardée avec ses `avertissements`.
*/
function lirePeinesAmendes_(sheet) {
  const largeur = PEINES_HEADERS.length;
  const lastRow = sheet.getLastRow();
  const range = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, largeur) : null;
  const valeurs = range ? range.getValues() : [];
  const affichage = range ? range.getDisplayValues() : [];

  const empreinte = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    affichage.map(function (ligne) { return ligne.join("\t"); }).join("\n"),
    Utilities.Charset.UTF_8
  );

  const lignes = [];
  const anomalies = [];
  const vues = new Map();

  affichage.forEach(function (texte, index) {
    const numero = index + 2;

    if (!texte.some(function (cellule) { return nettoyerSaisieUtilisateur(cellule); })) {
      return;
    }

    let ligne;
    try {
      ligne = lirePeineLigne_(valeurs[index], texte, numero);
    } catch (error) {
      anomalies.push({ ligne: numero, grave: true, message: error.message });
      return;
    }

    const cle = clePeine_(ligne.source, ligne.article, ligne.niveau);
    if (vues.has(cle)) {
      anomalies.push({ ligne: numero, grave: true, message: `Niveau « ${ligne.niveau} » déjà décrit ligne ${vues.get(cle)} pour ${ligne.source}, art. ${ligne.article}.` });
      return;
    }
    vues.set(cle, numero);

    ligne.avertissements.forEach(function (message) {
      anomalies.push({ ligne: numero, grave: false, message: message });
    });
    lignes.push(ligne);
  });

  return {
    version: Utilities.base64EncodeWebSafe(empreinte),
    lignes: lignes,
    anomalies: anomalies
  };
}


function lirePeineLigne_(valeurs, texte, numero) {
  const source = nettoyerSaisieUtilisateur(texte[0]);
  const article = nettoyerSaisieUtilisateur(texte[1]);

  if (!source || !article) {
    throw new Error("Source et article sont requis.");
  }

  const qualification = normaliserQualificationPeine_(texte[4]);
  if (!qualification) {
    throw new Error(`Qualification « ${nettoyerSaisieUtilisateur(texte[4])} » inconnue : Contravention, Délit, Crime, Spéciale ou Renvoi.`);
  }

  const echelon = nettoyerSaisieUtilisateur(texte[5]).toUpperCase();
  let amende = nombrePeine_(valeurs[6], texte[6], "L’amende", true);
  let cachot = nombrePeine_(valeurs[7], texte[7], "La durée de cachot", false);
  let nobiliaire = nombrePeine_(valeurs[8], texte[8], "L’amende nobiliaire", true);
  const sang = ["oui", "x", "vrai", "true"].indexOf(nettoyerSaisieUtilisateur(texte[9]).toLowerCase()) >= 0 || valeurs[9] === true;

  if (cachot !== null && cachot > PEINES_CACHOT_MAX_HEURES) {
    throw new Error("La durée de cachot dépasse un an : erreur de saisie probable.");
  }

  const avertissements = [];

  if (qualification === "renvoi") {
    if (amende !== null || cachot !== null || nobiliaire !== null) {
      avertissements.push("Ligne de renvoi : les montants et durées sont ignorés.");
    }
    amende = null;
    cachot = null;
    nobiliaire = null;
  } else {
    controlerFourchettePeine_(qualification, echelon, amende, cachot, nobiliaire, sang, avertissements);
  }

  return {
    ligne: numero,
    source: source,
    article: article,
    intitule: nettoyerSaisieUtilisateur(texte[2]),
    niveau: nettoyerSaisieUtilisateur(texte[3]) || PEINES_NIVEAU_DEFAUT,
    qualification: qualification,
    echelon: echelon,
    amende: amende,
    cachot: cachot,
    nobiliaire: nobiliaire,
    sang: sang,
    complements: nettoyerSaisieUtilisateur(texte[10]),
    observations: nettoyerSaisieUtilisateur(texte[11]),
    avertissements: avertissements
  };
}


/*
  Contrôles non bloquants : le magistrat peut vouloir s'écarter d'une
  fourchette, mais l'écart doit se voir.
*/
function controlerFourchettePeine_(qualification, echelon, amende, cachot, nobiliaire, sang, avertissements) {
  const fourchette = PEINES_FOURCHETTES[qualification];

  if (fourchette && amende !== null) {
    if (amende < fourchette.min || (fourchette.max !== null && amende > fourchette.max)) {
      avertissements.push(`Amende de ${amende} septims hors de la fourchette impériale ${libelleFourchettePeine_(qualification)}.`);
    }
  }

  if (qualification === "délit" && nobiliaire !== null && nobiliaire > fourchette.max) {
    avertissements.push(`Amende nobiliaire de ${nobiliaire} septims au-delà du plafond délictuel de 2 500 septims.`);
  }

  if (qualification === "contravention" && cachot !== null) {
    avertissements.push("Cachot pour une contravention : la classification impériale prévoit l’amende ou des travaux légers.");
  }

  if (fourchette && amende === null && cachot === null && echelon !== "PM") {
    avertissements.push("Aucune amende ni durée de cachot : la ligne ne propose rien.");
  }

  if (cachot !== null && !sang && nobiliaire === null) {
    avertissements.push("Amende nobiliaire manquante : un noble doit toujours se voir proposer une amende hors crime de sang (De Re Nobilitatis, art. 9).");
  }

  if (sang && nobiliaire !== null) {
    avertissements.push("Crime de sang : aucune amende de substitution n’est due à un noble (De Re Nobilitatis, art. 9).");
  }

  if (nobiliaire !== null && amende !== null && nobiliaire < amende) {
    avertissements.push("Amende nobiliaire inférieure à l’amende ordinaire.");
  }

  const prefixes = { contravention: /^C\d+$/, "délit": /^D\d+$/, crime: /^(K\d+|PM)$/ };
  if (echelon && prefixes[qualification] && !prefixes[qualification].test(echelon)) {
    avertissements.push(`Échelon ${echelon} incohérent avec la qualification.`);
  }
}


function libelleFourchettePeine_(qualification) {
  return {
    contravention: "des contraventions (jusqu’à 500 septims)",
    "délit": "des délits (de 500 à 2 500 septims)",
    crime: "des crimes (au-delà de 2 500 septims)"
  }[qualification];
}


function normaliserQualificationPeine_(valeur) {
  const brut = nettoyerSaisieUtilisateur(valeur)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  return {
    contravention: "contravention",
    delit: "délit",
    crime: "crime",
    speciale: "spéciale",
    special: "spéciale",
    renvoi: "renvoi"
  }[brut] || "";
}


/*
  Nombre d'une cellule : la valeur brute si Sheets l'a reconnue, sinon le
  texte affiché, virgule décimale admise. Vide : null.
*/
function nombrePeine_(valeur, texte, libelle, entier) {
  const affiche = nettoyerSaisieUtilisateur(texte);

  if (valeur === "" || valeur === null || valeur === undefined) {
    if (!affiche) {
      return null;
    }
  }

  const nombre = typeof valeur === "number"
    ? valeur
    : Number(affiche.replace(/\s/g, "").replace(",", "."));

  if (!Number.isFinite(nombre) || nombre <= 0 || (entier && !Number.isSafeInteger(nombre))) {
    throw new Error(`${libelle} « ${affiche} » doit être ${entier ? "un entier" : "un nombre"} strictement positif, ou laissé vide.`);
  }

  return nombre;
}


/*
  Clé d'un niveau : source, article et libellé du niveau, sans casse ni
  espaces superflus. Même normalisation que `cleArticleCodex_` pour la source
  et l'article.
*/
function clePeine_(source, article, niveau) {
  return cleArticleCodex_(source, article) + "|" + nettoyerSaisieUtilisateur(niveau).replace(/\s+/g, " ").toLowerCase();
}
