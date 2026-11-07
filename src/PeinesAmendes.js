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
// on se réfère aux fourchettes impériales du Corpus Juriscivilis. Révisées
// par l'Empire et relues le 3 novembre 2026 : contravention jusqu'à 100
// septims, délit jusqu'à 500, crime jusqu'à 1 000, amendes non cumulables.
// Le barème initial est reconstruit le même jour sur le Code pénal local
// réécrit (39 articles) et le De Re Nobilitatis réécrit (18 articles).
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
//                                  cachot (De Re Nobilitatis, art. 13)
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
  Fourchettes du Corpus Juriscivilis Imperialis, classification des
  infractions (texte impérial révisé, lu le 3 novembre 2026) : contravention
  jusqu'à 100 septims (amende simple ou travaux légers), délit jusqu'à 500
  (amende élevée ou travaux forcés), crime jusqu'à 1 000 (amende forte,
  emprisonnement ou peine de mort). « Les amendes ne sont pas cumulables. »

  Avant cette révision, le texte donnait 500, 2 500 et au-delà : la première
  grille du 4 octobre 2026 (50 à 12 000 septims) en découlait.
*/
const PEINES_FOURCHETTES = {
  contravention: { min: 1, max: 100 },
  délit: { min: 100, max: 500 },
  crime: { min: 500, max: 1000 }
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

  Grille arrêtée par le propriétaire le 3 novembre 2026 sur les nouvelles
  fourchettes ; les durées de cachot sont celles du 4 octobre 2026.
*/
const PEINES_ECHELONS = {
  C1: { qualification: "Contravention", amende: 25 },
  C2: { qualification: "Contravention", amende: 50 },
  C3: { qualification: "Contravention", amende: 75 },
  C4: { qualification: "Contravention", amende: 100 },
  D1: { qualification: "Délit", amende: 150 },
  D2: { qualification: "Délit", amende: 250 },
  D3: { qualification: "Délit", amende: 375, cachot: 0.5 },
  D4: { qualification: "Délit", amende: 500, cachot: 1 },
  K1: { qualification: "Crime", amende: 600, cachot: 1 },
  K2: { qualification: "Crime", amende: 750, cachot: 2 },
  K3: { qualification: "Crime", amende: 900, cachot: 4 },
  K4: { qualification: "Crime", amende: 1000, cachot: 6 },
  PM: { qualification: "Crime" }
};

/*
  Noblesse. Un noble reconnu coupable doit toujours se voir proposer une
  amende, sauf crime de sang (De Re Nobilitatis, art. 13) : le cachot est
  racheté par une amende égale au plafond impérial de la qualification
  (500 septims pour un délit, 1 000 pour un crime), décision du propriétaire
  du 3 novembre 2026. Valeur retenue à l'initialisation ; la colonne I fait
  foi ensuite et se corrige ligne par ligne.
*/
function rachatNoblePeine_(qualification) {
  const fourchette = PEINES_FOURCHETTES[String(qualification || "").toLowerCase()];
  return fourchette ? fourchette.max : "";
}

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
const PEINES_RESTITUTION = "Restitution du bien ou de sa valeur (Code civil local, art. 11).";
const PEINES_REPARATION = "Remise en état ou réparation du tort causé (Code civil local, art. 11).";
const PEINES_SAISIE_GIBIER = "Saisie du gibier et des produits obtenus sans droit (art. 33).";
const PEINES_TITRE_CORPS = "Le titre qualifie de crime, le corps de l’article de délit : qualification à trancher par le magistrat.";

/*
  [sigle de la source, article, intitulé, niveau, échelon ou qualification,
   peines complémentaires, observations, options]

  options : { sang: true } pour un crime de sang ; { amende } pour une
  sanction spéciale chiffrée hors échelon (aucune aujourd'hui).

  Code pénal local de Blancherive réécrit (39 articles, lu le 3 novembre
  2026 ; le document ne porte pas d'article 29) : les art. 1 et 2 sont des
  dispositions générales, sans barème. Les niveaux suivent le corps de chaque
  article : cas de base, puis requalifications et formes aggravées qu'il
  prévoit. Le De Re Nobilitatis réécrit ne chiffre plus les manquements
  nobiliaires (art. 14 : amende prononcée par un juge compétent) : plus de
  ligne « Spéciale ».
*/
const PEINES_INITIALES = [
  // ----- Code pénal local de Blancherive -----
  ["CPL", "3", "Des ordres et sommations légitimes", "", "D1", "", "L’ordre doit relever de la charge de l’officiel et ne saurait imposer un acte contraire aux lois. Envers une autorité impériale : Corpus Juriscivilis, art. 2."],
  ["CPL", "4", "Des entraves à l’autorité locale", "", "D2", "", "Visite de marchandises, contrôle ou inspection ; la dissimulation volontaire d’objets recherchés peut constituer l’entrave."],
  ["CPL", "4", "Des entraves à l’autorité locale", "Requalification en crime — annoncée par le titre, non définie par le corps", "K1", "", PEINES_TITRE_CORPS],
  ["CPL", "5", "De l’usurpation des marques", "Port sans droit des marques, livrées ou insignes de la Cour", "C2", "Confiscation des effets constituant l’infraction."],
  ["CPL", "5", "De l’usurpation des marques", "Requalification en délit — usage pour tromper ou obtenir un avantage, ou se faire passer pour un officier de Blancherive", "D2", "Confiscation des effets constituant l’infraction."],
  ["CPL", "5", "De l’usurpation des marques", "Requalification en crime — usurpation d’une charge de la Cour, ou exercice frauduleux d’un pouvoir réservé au Jarl", "K2", "", "L’usurpation d’une fonction impériale relève du Codex Penitus."],
  ["CPL", "6", "Des outrages à l’autorité locale", "Injure grossière adressée publiquement à une autorité locale dans sa charge", "C2", "", "La critique des décisions du Jarl, exprimée sans menace ni entrave, n’est pas un outrage."],
  ["CPL", "6", "Des outrages à l’autorité locale", "Requalification en délit — humiliation grave, menace ou outrage troublant l’exercice de la charge", "D2"],
  ["CPL", "7", "De la sédition", "", "K4", "", "Le simple désaccord avec le Jarl n’est pas une sédition."],
  ["CPL", "7", "De la sédition", "Peine maximale", "PM", PEINES_PEINE_MAXIMALE, PEINES_VERDICT],
  ["CPL", "8", "De la trahison", "", "K4", "", "Faute volontaire, dirigée contre la sûreté de Blancherive ou de ses habitants. Envers l’Empire : Codex Penitus."],
  ["CPL", "8", "De la trahison", "Peine maximale", "PM", PEINES_PEINE_MAXIMALE, PEINES_VERDICT],
  ["CPL", "9", "De l’insubordination", "", "D1", "", "Officier ou serviteur de la châtellerie. Le refus d’un ordre manifestement contraire aux lois n’est pas puni ; un simple défaut de déférence ne suffit pas."],
  ["CPL", "10", "Des injures et calomnies", "Injures portant volontairement atteinte à l’honneur d’autrui", "C1", "", "Les propos tenus de bonne foi pour dénoncer un méfait ne sont pas punis."],
  ["CPL", "10", "Des injures et calomnies", "Requalification en délit — accusation publique de faits que l’on sait mensongers, afin de nuire", "D2"],
  ["CPL", "11", "Des accusations mensongères", "Faits faussement imputés de nature contraventionnelle", "C3", "", "La qualification suit la gravité des faits faussement imputés (art. 11)."],
  ["CPL", "11", "Des accusations mensongères", "Faits faussement imputés de nature délictuelle ou criminelle", "D3"],
  ["CPL", "12", "Du faux témoignage", "", "K2", "", "L’erreur, l’oubli ou le retrait spontané du mensonge avant la sentence ne constituent pas un faux témoignage."],
  ["CPL", "13", "Du chantage et des menaces", "", "D3", "", "Annoncer de bonne foi une plainte légitime n’est pas un chantage."],
  ["CPL", "14", "Des persécutions", "", "D3", "", "Actes répétés troublant gravement la vie ou la tranquillité d’une personne."],
  ["CPL", "14", "Des persécutions", "Requalification en crime — en groupe, ou en abusant d’une autorité sur la victime", "K1"],
  ["CPL", "15", "De la mise en péril et des blessures", "Exposition d’autrui à un danger prévisible par imprudence grave", "C3", "", "Blessures volontaires : Corpus Juriscivilis, art. 5."],
  ["CPL", "15", "De la mise en péril et des blessures", "Requalification en délit — usage dangereux d’une monture, d’un objet, d’une substance ou de magie", "D2"],
  ["CPL", "16", "Des atteintes à la pudeur", "Exhibition volontairement obscène sur les places ou voies fréquentées", "C3"],
  ["CPL", "16", "Des atteintes à la pudeur", "Requalification en délit — geste imposé portant gravement atteinte à l’intimité, ou exhibition visant un trouble grave", "D3", "", "Sans préjudice des crimes impériaux."],
  ["CPL", "17", "Des substances données à l’insu d’autrui", "", "K2"],
  ["CPL", "18", "De la rétention abusive", "", "D3", "", "Hors séquestration punie par l’Empire (Corpus Juriscivilis, art. 14)."],
  ["CPL", "18", "De la rétention abusive", "Forme aggravée — abus d’autorité ou rétention prolongée", "D4"],
  ["CPL", "19", "Des dommages aux biens", "", "D2", PEINES_REPARATION],
  ["CPL", "19", "Des dommages aux biens", "Forme aggravée — biens anciens, sacrés ou précieux ; vivres, remèdes ou réserves rendus impropres à l’usage", "D4", PEINES_REPARATION],
  ["CPL", "20", "Du vol", "", "D2", PEINES_RESTITUTION, "Valeur particulièrement élevée ou objet sous licence : Corpus Juriscivilis, art. 6 (crime)."],
  ["CPL", "21", "Des scellés de justice", "", "D2"],
  ["CPL", "22", "Des biens dont l’usage est soumis à permission", "Manquement aux seules conditions d’une permission accordée", "C2", "", "Les biens relevant exclusivement de l’Empire (équipements dwemers et Orsimer, armes éthérées) suivent leurs décrets."],
  ["CPL", "22", "Des biens dont l’usage est soumis à permission", "Requalification en délit — usage sans permission, commerce de marchandises interdites par édit, activité soumise à permission non obtenue", "D2", "Saisie des marchandises illicites."],
  ["CPL", "22", "Des biens dont l’usage est soumis à permission", "Requalification en crime — recel ou mise en vente sciemment pratiqués", "K1", "Saisie des marchandises illicites.", "Le titre ne retient que contravention et délit, le corps qualifie ce cas de crime : à trancher par le magistrat."],
  ["CPL", "23", "De l’occupation des possessions d’autrui", "Occupation sans droit d’une place ou d’un ouvrage de Blancherive, en empêchant son usage ordinaire", "C2", "", "L’intrusion simple relève du Corpus Juriscivilis, art. 4."],
  ["CPL", "23", "De l’occupation des possessions d’autrui", "Occupation ou rétention sans droit des terres, demeures et biens d’autrui", "D2"],
  ["CPL", "23", "De l’occupation des possessions d’autrui", "Requalification en crime — usage causant sciemment un dommage considérable", "K1", PEINES_REPARATION],
  ["CPL", "24", "Des voies et ouvrages de Blancherive", "Obstruction volontaire d’une route, d’un pont ou d’un passage ouvert aux voyageurs", "C2"],
  ["CPL", "24", "Des voies et ouvrages de Blancherive", "Requalification en délit — bornes ou repères détruits ou déplacés, usage d’un ouvrage de la châtellerie empêché", "D2"],
  ["CPL", "24", "Des voies et ouvrages de Blancherive", "Requalification en crime — entrave sciente à un passage nécessaire aux secours, au ravitaillement ou à la défense", "K2"],
  ["CPL", "25", "Des fausses alertes", "Fausse alerte, ou usage sans droit des signaux réservés à la garde", "C3"],
  ["CPL", "25", "Des fausses alertes", "Requalification en délit — levée des gardes, évacuation des habitants ou fermeture des portes provoquées", "D3"],
  ["CPL", "26", "De la salubrité des lieux", "", "C1", "Nettoyage et remise en état des lieux."],
  ["CPL", "26", "De la salubrité des lieux", "Requalification en délit — atteinte grave aux eaux ou aux approvisionnements", "D3", "Remise en état des lieux."],
  ["CPL", "27", "De la mendicité", "Insistance après refus, ou passage barré pour obtenir l’aumône", "C1", "", "La demande d’aumône paisible est permise."],
  ["CPL", "28", "De la dissimulation", "Refus de décliner son identité lors d’une vérification légitime", "C2", "", "Se couvrir le visage ou user de magie sans dessein frauduleux n’est pas puni par ce seul fait."],
  ["CPL", "28", "De la dissimulation", "Requalification en délit — marchandise, arme ou bien caché par ruse ou magie pour le soustraire à une recherche, une saisie ou un droit", "D2", "", "Sans préjudice de l’infraction liée au bien lui-même."],
  ["CPL", "30", "Des exploitations sans droit", "", "D2", "", "Y compris l’exploitation poursuivie après un ordre légitime de fermeture."],
  ["CPL", "30", "Des exploitations sans droit", "Forme aggravée — activité périlleuse pour les citoyens", "D4"],
  ["CPL", "31", "Des livres de comptes et droits dus", "", "D2", "", "Un simple oubli ou un retard de paiement, sans fraude, ne suffit pas ; les droits impayés restent exigibles (Code du commerce local, art. 9)."],
  ["CPL", "32", "Des faux livres d’exploitation", "", "K1"],
  ["CPL", "33", "De la chasse et du gibier", "Chasse sans droit sur les terres de Blancherive", "C2", PEINES_SAISIE_GIBIER, "Permis de chasse : Code du commerce local, art. 12."],
  ["CPL", "33", "De la chasse et du gibier", "Requalification en délit — espèce protégée abattue sciemment, ou vente du produit d’une chasse interdite", "D2", PEINES_SAISIE_GIBIER],
  ["CPL", "34", "Des végétaux protégés", "", "D1"],
  ["CPL", "35", "Des expéditions et des lieux gardés", "Expédition sans la permission spéciale exigée par édit", "C2"],
  ["CPL", "35", "Des expéditions et des lieux gardés", "Requalification en délit — fouille, pillage ou exploitation sans droit d’un tombeau, d’une ruine ou d’un lieu ancien gardé par Blancherive", "D3", "", "Les lieux relevant de l’Empire demeurent de son ressort (décret sur les recherches archéologiques)."],
  ["CPL", "36", "Du trafic des découvertes", "", "K2", "Saisie des biens, restitués à leurs propriétaires légitimes ou attribués à la châtellerie."],
  ["CPL", "37", "De l’emprise magique sur autrui", "", "K2"],
  ["CPL", "37", "De l’emprise magique sur autrui", "Forme aggravée — influence employée pour obtenir un bien, un renseignement ou un consentement", "K3"],
  ["CPL", "38", "Des créatures dangereuses", "", "K3"],
  ["CPL", "39", "Des expériences magiques périlleuses", "", "D3", "", PEINES_TITRE_CORPS],
  ["CPL", "39", "Des expériences magiques périlleuses", "Requalification en crime — selon le titre de l’article", "K1", "", "Y compris la pratique poursuivie après l’ordre d’une autorité légitime de l’interrompre."],

  // ----- Code du commerce local de Blancherive -----
  ["CCoL", "17", "Des ventes sans droit et des tromperies", "", "D2", "Saisies et confiscations décidées par le juge (art. 17).", "Commerce, vente à la sauvette ou étal sans permission ni droit de place ; tromperie sur les droits commerciaux ; refus de présenter les livres exigés. Un retard de paiement ou une fermeture occasionnelle ne constitue pas, à lui seul, une fraude."],

  // ----- Corpus Juriscivilis Imperialis -----
  ["CJI", "1", "Usurpation d'identité", "", "C2"],
  ["CJI", "1", "Usurpation d'identité", "Requalification en délit — qualité noble ou fonction officielle", "D2"],
  ["CJI", "2", "Refus d'obtempérer", "", "C2", "", "Envers une autorité de Blancherive, le Code pénal local, art. 3 (délit), prévaut."],
  ["CJI", "2", "Refus d'obtempérer", "Requalification en délit — usage de violence, de magie ou de potions", "D2"],
  ["CJI", "3", "Atteinte à la paix de l’Empereur", "", "C2"],
  ["CJI", "4", "Intrusion", "Propriété privée", "C2"],
  ["CJI", "4", "Intrusion", "Requalification en délit — propriété publique de l’Empire ou d’une châtellerie", "D1"],
  ["CJI", "5", "Violences et agressions", "Contusions ou blessures légères", "D2", "", "Crime avec une circonstance de l’art. 8 : arme ou magie, réunion, représentant de l’autorité, mutilation."],
  ["CJI", "5", "Violences et agressions", "Incapacité ou séquelles", "D4"],
  ["CJI", "6", "Vol, escroquerie", "Bien ou service d’une valeur jusqu’à 100 septims", "D1", PEINES_RESTITUTION, "Valeur « particulièrement élevée » : au-delà de 500 septims, seuil criminel de la classification impériale."],
  ["CJI", "6", "Vol, escroquerie", "Bien ou service d’une valeur de 100 à 500 septims", "D2", PEINES_RESTITUTION],
  ["CJI", "6", "Vol, escroquerie", "Requalification en crime — valeur au-delà de 500 septims, ou objet sous licence", "K1", PEINES_RESTITUTION],
  ["CJI", "7", "Recel", "Bien d’une valeur jusqu’à 100 septims", "D1", PEINES_RESTITUTION],
  ["CJI", "7", "Recel", "Bien d’une valeur de 100 à 500 septims", "D2", PEINES_RESTITUTION],
  ["CJI", "7", "Recel", "Requalification en crime — valeur au-delà de 500 septims, ou objet sous licence", "K1", PEINES_RESTITUTION],
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
    const nobiliaire = cachot && !options.sang ? rachatNoblePeine_(echelon.qualification) : "";

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

  if (fourchette && fourchette.max !== null && nobiliaire !== null && nobiliaire > fourchette.max) {
    avertissements.push(`Amende nobiliaire de ${nobiliaire} septims au-delà du plafond impérial ${libelleFourchettePeine_(qualification)}.`);
  }

  if (qualification === "contravention" && cachot !== null) {
    avertissements.push("Cachot pour une contravention : la classification impériale prévoit l’amende ou des travaux légers.");
  }

  if (fourchette && amende === null && cachot === null && echelon !== "PM") {
    avertissements.push("Aucune amende ni durée de cachot : la ligne ne propose rien.");
  }

  if (cachot !== null && !sang && nobiliaire === null) {
    avertissements.push("Amende nobiliaire manquante : un noble doit toujours se voir proposer une amende hors crime de sang (De Re Nobilitatis, art. 13).");
  }

  if (sang && nobiliaire !== null) {
    avertissements.push("Crime de sang : aucune amende de substitution n’est due à un noble (De Re Nobilitatis, art. 13).");
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
    contravention: "des contraventions (jusqu’à 100 septims)",
    "délit": "des délits (de 100 à 500 septims)",
    crime: "des crimes (de 500 à 1 000 septims)"
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
