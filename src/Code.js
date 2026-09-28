// ============================================================
// CONFIGURATION
// ============================================================

const SPREADSHEET_ID =
  "1eUjNgoYKQeGV2EZT96CxACCOfthY56nUGk2Uzk6hSW4";


const SHEET_PRESENCES = "Présences";
const SHEET_EFFECTIFS = "Effectifs";
const SHEET_AMENDES = "Amendes";
const SHEET_PRISON = "Prison";

function doGet() {

  return HtmlService
    .createTemplateFromFile("Index")
    .evaluate()
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setTitle("Registre de la Garde de Blancherive")
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    );
}

const PRESENCES_SHEET_NAME = "Présences";

// Les anciennes fonctions de génération hebdomadaire des Présences
// (ajouterSemainePresence, regenererSemaineCourante, déclencheur du
// lundi, miseAJourComplete) et la copie de mise en forme vers les
// feuilles de corps (synchroniserMiseEnForme) ont été retirées le
// 28 septembre 2026 : elles raisonnaient en numéros de semaine, sans
// année, et doublaient genererPresencesSemaineCourante() de Presences.js,
// seul chemin de génération ; les feuilles de corps ont été supprimées du
// classeur, l'Organigramme de l'application les remplace. Ne pas les recréer.
