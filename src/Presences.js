// ============================================================
// PRÉSENCES
//
// Génération du registre hebdomadaire + API Web App.
//
// Effectifs :
//   C = Prénom
//   D = Nom
//   E = Grade
//   F = Corps de garde
//   G = Statut
//
// Présences :
//   A = Lundi de la semaine ISO, texte « yyyy-MM-dd »
//       (voir la section LUNDI DE SEMAINE)
//   B = Corps de garde
//   C = Grade
//   D = Prénom
//   E = Nom
//   F:L = Lun → Dim
//   M = Jours présents
//   N = Solde
//   O = Payé
//
// IMPORTANT :
// Rien après la colonne O n'est modifié par ce script.
// ============================================================

const PRESENCE_ACTIVE_STATUS =
  "En service actif";

const PRESENCES_EFFECTIFS_SHEET_NAME =
  "Effectifs";

const PRESENCE_EXCLUDED_CORPS =
  "Hird du Jarl";

const PRESENCE_TIMEZONE =
  "Europe/Stockholm";


// ============================================================
// GÉNÉRATION / SYNCHRONISATION
// ============================================================

function genererPresencesSemaineCourante() {

  const lock =
    LockService.getDocumentLock();


  lock.waitLock(
    30000
  );


  try {

    const ss =
      SpreadsheetApp.openById(
        SPREADSHEET_ID
      );


    const effectifsSheet =
      ss.getSheetByName(
        PRESENCES_EFFECTIFS_SHEET_NAME
      );


    const presencesSheet =
      ss.getSheetByName(
        PRESENCES_SHEET_NAME
      );


    if (!effectifsSheet) {

      throw new Error(
        "Feuille Effectifs introuvable."
      );
    }


    if (!presencesSheet) {

      throw new Error(
        "Feuille Présences introuvable."
      );
    }


    const lundiCourant =
      lundiCourantPresence_();


    const effectifs =
      lireEffectifsActifsPourPresences(
        effectifsSheet
      )
        .filter(
          garde =>
            !estCorpsExcluDesPresences_(
              garde.corps
            )
        );


    // Migrer les anciennes références avant de déplacer les lignes.
    mettreAJourSoldesPresences_(ss, presencesSheet);
    const existing =
      lirePresencesExistantes(
        presencesSheet,
        lundiCourant
      );


    const nouvellesLignes =
      [];

    const formulesHistoriques = new Map();


    /*
      On conserve toutes les semaines déjà présentes,
      puis on reconstruit la semaine courante depuis Effectifs.
    */

    for (
      const item of existing
    ) {

      if (
        item.lundi ===
        lundiCourant
      ) {

        continue;
      }


      nouvellesLignes.push(
        item.row
      );
      if (item.formuleSolde) formulesHistoriques.set(item.row, item.formuleSolde);
    }


    /*
      Génération de la semaine courante.
    */

    for (
      const garde of effectifs
    ) {

      const key =
        construireClePresence(
          lundiCourant,
          garde.prenom,
          garde.nom
        );


      /*
        Une corruption passée peut avoir laissé plusieurs
        lignes pour la même personne et la même semaine.
        On fusionne les cases cochées plutôt que d'en perdre.
      */

      const anciennes =
        existing
          .filter(
            item =>
              item.key ===
              key
          )
          .map(
            item =>
              item.row
          );


      const coche =
        index =>
          anciennes.some(
            ligne =>
              ligne[index] === true
          );


      const row = [
        lundiCourant,
        garde.corps,
        garde.grade,
        garde.prenom,
        garde.nom,

        coche(5),
        coche(6),
        coche(7),
        coche(8),
        coche(9),
        coche(10),
        coche(11),

        "",

        "",

        coche(14)
      ];


      nouvellesLignes.push(
        row
      );
    }


    /*
      Membres sortis du service actif en cours de semaine (mort,
      radiation, réserve, mutation vers le Hird...) : leur ligne de
      la semaine courante est conservée dès qu'elle porte un jour
      pointé ou un paiement. Un pointage n'est jamais perdu par un
      changement d'Effectifs. Sans pointage ni paiement, la ligne
      disparaît : elle ne portait rien.
    */

    const clesActives =
      new Set(
        effectifs.map(
          garde =>
            construireClePresence(
              lundiCourant,
              garde.prenom,
              garde.nom
            )
        )
      );


    const sortants =
      new Map();


    for (
      const item of existing
    ) {

      if (
        item.lundi !== lundiCourant
        ||
        clesActives.has(item.key)
      ) {

        continue;
      }


      if (
        !sortants.has(item.key)
      ) {

        sortants.set(
          item.key,
          item.row.slice()
        );

        continue;
      }


      // Doublon d'une même personne : fusion des cases cochées.
      const fusion =
        sortants.get(item.key);

      [5, 6, 7, 8, 9, 10, 11, 14].forEach(
        index => {
          if (item.row[index] === true) fusion[index] = true;
        }
      );
    }


    for (
      const ligne of sortants.values()
    ) {

      const pointee =
        [5, 6, 7, 8, 9, 10, 11, 14].some(
          index =>
            ligne[index] === true
        );


      if (!pointee) {

        continue;
      }


      ligne[12] = "";
      ligne[13] = "";

      nouvellesLignes.push(
        ligne
      );
    }


    /*
      Tri :
      anciennes semaines d'abord,
      puis semaine courante.
      Au sein d'une semaine :
      corps, puis ordre courant des lignes.
    */

    nouvellesLignes.sort(
      (a, b) => {

        const lundiCompare =
          comparerLundisPresence_(
            a[0],
            b[0]
          );


        if (
          lundiCompare !== 0
        ) {

          return lundiCompare;
        }


        const corpsCompare =
          String(
            a[1] || ""
          ).localeCompare(
            String(
              b[1] || ""
            ),
            "fr"
          );


        if (
          corpsCompare !== 0
        ) {

          return corpsCompare;
        }


        return String(
          `${a[3]} ${a[4]}`
        ).localeCompare(
          String(
            `${b[3]} ${b[4]}`
          ),
          "fr"
        );
      }
    );


    ensurePresenceRows(
      presencesSheet,
      nouvellesLignes.length + 1
    );


    /*
      On ne touche qu'à A:O.
    */

    const maxRows =
      presencesSheet.getMaxRows();


    if (
      maxRows > 1
    ) {

      presencesSheet
        .getRange(
          2,
          1,
          maxRows - 1,
          15
        )
        .clearContent()
        .clearDataValidations();


      /*
        clearContent() conserve les formats : la colonne A est
        remise en texte brut pour que le lundi ISO ne soit jamais
        réinterprété en date ou en nombre par Sheets.
      */

      presencesSheet
        .getRange(
          2,
          1,
          maxRows - 1,
          1
        )
        .setNumberFormat(
          "@"
        );
    }


    if (
      nouvellesLignes.length === 0
    ) {

      return;
    }


    presencesSheet
      .getRange(
        2,
        1,
        nouvellesLignes.length,
        15
      )
      .setValues(
        nouvellesLignes
      );


    ecrireFormulesSoldeParBlocs_(presencesSheet,
      nouvellesLignes.map((row, index) => ({ row: index + 2, formula: formulesHistoriques.get(row) }))
        .filter(item => item.formula), true);

    appliquerStructurePresences(
      presencesSheet,
      nouvellesLignes.length + 1
    );


    tracerSeparateursPresences_(
      presencesSheet,
      nouvellesLignes
    );


    SpreadsheetApp.flush();

  }
  finally {

    lock.releaseLock();
  }
}


// Alias pratique si l'ancien déclencheur utilise ce nom.
function synchroniserPresences() {

  genererPresencesSemaineCourante();
}


// ============================================================
// LECTURE DES EFFECTIFS ACTIFS
// ============================================================

function lireEffectifsActifsPourPresences(
  sheet
) {

  const lastRow =
    sheet.getLastRow();


  if (
    lastRow < 2
  ) {

    return [];
  }


  /*
    C:G
      C prénom
      D nom
      E grade
      F corps
      G statut
  */

  const lastColumn =
    sheet.getLastColumn();

  const headers =
    sheet
      .getRange(1, 1, 1, lastColumn)
      .getDisplayValues()[0]
      .map(normaliserEntetePresence_);

  const prenomIndex = trouverEntetePresence_(headers, ["Prenom"]);
  const nomIndex = trouverEntetePresence_(headers, ["Nom"]);
  const gradeIndex = trouverEntetePresence_(headers, ["Grade"]);
  const corpsIndex = trouverEntetePresence_(headers, ["Corps", "Corps de garde", "Garnison"]);
  const statusIndex = trouverEntetePresence_(headers, ["Status", "Statut"]);

  if ([prenomIndex, nomIndex, gradeIndex, corpsIndex, statusIndex].some(index => index < 0)) {
    throw new Error("Colonnes obligatoires introuvables dans Effectifs.");
  }

  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        lastColumn
      )
      .getDisplayValues();


  return values
    .filter(
      row => {

        const prenom =
          String(
            row[prenomIndex] || ""
          ).trim();


        const nom =
          String(
            row[nomIndex] || ""
          ).trim();


        const status =
          String(
            row[statusIndex] || ""
          ).trim();

        const corps =
          String(
            row[corpsIndex] || ""
          ).trim();


        return (
          (
            prenom
            ||
            nom
          )
          &&
          status ===
            PRESENCE_ACTIVE_STATUS
          &&
          !estCorpsExcluDesPresences_(
            corps
          )
        );
      }
    )
    .map(
      row => ({

        prenom:
          String(
            row[prenomIndex] || ""
          ).trim(),

        nom:
          String(
            row[nomIndex] || ""
          ).trim(),

        grade:
          String(
            row[gradeIndex] || ""
          ).trim(),

        corps:
          String(
            row[corpsIndex] || ""
          ).trim()

      })
    );
}


// ============================================================
// LECTURE DE L'EXISTANT
// ============================================================

function trouverEntetePresence_(headers, aliases) {
  const aliasesNormalises = aliases.map(normaliserEntetePresence_);
  return headers.findIndex(header => aliasesNormalises.includes(header));
}

function normaliserEntetePresence_(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function lirePresencesExistantes(
  sheet,
  lundiCourant
) {

  const lastRow =
    getLastPresenceRowWebApp(
      sheet
    );


  if (
    lastRow < 2
  ) {

    return [];
  }


  SpreadsheetApp.flush();


  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        15
      )
      .getValues();


  const result =
    [];

  const formulesSolde = sheet.getRange(2, 14, lastRow - 1, 1).getFormulasR1C1();


  for (
    let i = 0;
    i < values.length;
    i++
  ) {

    const row =
      values[i];


    /*
      Anciens numéros de semaine, cellules au format date ou
      lundis ISO : tout est ramené au lundi ISO avant comparaison
      et réécriture. La feuille se convertit ainsi d'elle-même.
    */

    row[0] =
      normaliserLundiPresence_(
        row[0],
        lundiCourant
      );


    if (
      row[0] === ""
    ) {

      continue;
    }


    result.push({

      formuleSolde: formulesSolde[i][0],

      lundi:
        row[0],

      key:
        construireClePresence(
          row[0],
          row[3],
          row[4]
        ),

      row:
        row

    });
  }


  return result;
}

function estCorpsExcluDesPresences_(corps) {
  const valeur = String(corps || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const corpsExclu = PRESENCE_EXCLUDED_CORPS
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return valeur === corpsExclu || valeur === "hird";
}


// ============================================================
// CLÉ STABLE
// ============================================================

function construireClePresence(
  lundi,
  prenom,
  nom
) {

  return [
    String(
      lundi || ""
    ).trim(),

    String(
      prenom || ""
    )
      .trim()
      .toLowerCase(),

    String(
      nom || ""
    )
      .trim()
      .toLowerCase()
  ].join(
    "|"
  );
}


// ============================================================
// LUNDI DE SEMAINE
//
// Présences!A porte le lundi de la semaine ISO, en texte
// « yyyy-MM-dd », colonne au format texte brut. Le texte ne
// dépend ni du format de cellule ni du fuseau du classeur :
// c'est ce qui a manqué au numéro de semaine, qu'une cellule
// passée au format date renvoyait en objet Date (39 devenait
// le 7 février 1900) et qu'aucune année n'accompagnait.
//
// Le serveur raisonne en lundis. Le numéro de semaine n'est
// qu'un libellé, calculé par l'interface.
//
// Toute lecture de la colonne A passe par
// `normaliserLundiPresence_`, qui accepte encore les anciennes
// valeurs — numéro de semaine, cellule date, texte — et les
// ramène au lundi ISO. La feuille se convertit ainsi d'elle-
// même à la première régénération ; `migrerPresencesVersLundis`
// le fait explicitement, colonne A seule.
// ============================================================

const PRESENCE_LUNDI_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

// Formules d'autres feuilles lisant Présences!A par numéro de
// semaine : `Présences!A2`, `'Présences'!$A:$A`, `Présences!A2:O`.
const PRESENCE_REFERENCE_COLONNE_A = /pr[ée]sences'?!\$?A(?![A-Za-z])/i;

// Dans Présences même, au-delà de la colonne O : `A2`, `$A$2`, `A:A`.
const PRESENCE_REFERENCE_LOCALE_A = /(^|[^A-Za-z0-9_!'.])\$?A(\$?\d|:)/;


function dateCivileStockholm_(date) {
  return Utilities.formatDate(
    date || new Date(),
    PRESENCE_TIMEZONE,
    "yyyy-MM-dd"
  );
}


function lundiCourantPresence_() {
  return lundiDeDateIso_(dateCivileStockholm_());
}


// Date UTC à minuit, ou null si le texte n'est pas une date
// civile valide (« 2026-02-30 » est refusé).
function parserDateIsoPresence_(texte) {
  const match = PRESENCE_LUNDI_REGEX.exec(String(texte || "").trim());
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return formaterDateIsoPresence_(date) === match[0] ? date : null;
}


function formaterDateIsoPresence_(dateUtc) {
  const pad = value => String(value).padStart(2, "0");
  return `${dateUtc.getUTCFullYear()}-${pad(dateUtc.getUTCMonth() + 1)}-${pad(dateUtc.getUTCDate())}`;
}


// Lundi de la semaine ISO contenant la date donnée.
function lundiDeDateIso_(iso) {
  const date = parserDateIsoPresence_(iso);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return formaterDateIsoPresence_(date);
}


// Année et numéro de semaine ISO d'un lundi. L'année ISO est
// celle du jeudi de la semaine : les 29-31 décembre peuvent
// appartenir à la semaine 1 de l'année suivante.
function numeroSemaineIsoPresence_(lundi) {
  const date = parserDateIsoPresence_(lundi);
  if (!date) return null;
  const jeudi = new Date(date.getTime() + 3 * 86400000);
  const annee = jeudi.getUTCFullYear();
  const ordinal = Math.floor((jeudi.getTime() - Date.UTC(annee, 0, 1)) / 86400000) + 1;
  return { annee: annee, semaine: Math.floor((ordinal - 1) / 7) + 1 };
}


// Conversion d'un ancien numéro de semaine sans année. Une
// semaine supérieure à la semaine courante ne peut pas être à
// venir : elle appartient à l'année précédente.
function lundiDepuisNumeroSemaine_(semaine, lundiCourant) {
  const courant = numeroSemaineIsoPresence_(lundiCourant);
  if (!courant || !Number.isInteger(semaine) || semaine < 1 || semaine > 53) return "";
  const annee = semaine > courant.semaine ? courant.annee - 1 : courant.annee;
  // Le 4 janvier est toujours en semaine 1.
  const janvier4 = new Date(Date.UTC(annee, 0, 4));
  janvier4.setUTCDate(janvier4.getUTCDate() - ((janvier4.getUTCDay() + 6) % 7) + (semaine - 1) * 7);
  return formaterDateIsoPresence_(janvier4);
}


// Numéro de série Sheets (0 = 30 décembre 1899) vers date ISO.
function dateIsoDepuisSerieSheets_(serie) {
  return formaterDateIsoPresence_(new Date(Date.UTC(1899, 11, 30) + Math.round(serie) * 86400000));
}


/*
  Ramène une valeur de Présences!A au lundi ISO.

  - texte « yyyy-MM-dd » : recalé sur son lundi ;
  - objet Date d'une vraie date : son lundi ;
  - objet Date avant 1950 : un numéro de semaine affiché au format
    date, on reprend le numéro de série ;
  - nombre de 1 à 53 ou texte numérique : ancien numéro de semaine ;
  - nombre au-delà : numéro de série d'une date ;
  - vide ou null : « » ;
  - tout autre texte : conservé tel quel, jamais perdu.
*/
function normaliserLundiPresence_(value, lundiCourant) {

  if (Object.prototype.toString.call(value) === "[object Date]") {
    if (Number.isNaN(value.getTime())) return "";
    const iso = formaterDateIsoPresence_(
      new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
    );
    if (value.getFullYear() >= 1950) return lundiDeDateIso_(iso);
    const serie = Math.round(
      (Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) - Date.UTC(1899, 11, 30)) / 86400000
    );
    return normaliserLundiPresence_(serie, lundiCourant);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    if (Number.isInteger(value) && value >= 1 && value <= 53) {
      return lundiDepuisNumeroSemaine_(value, lundiCourant) || String(value);
    }
    if (value >= 20000) return lundiDeDateIso_(dateIsoDepuisSerieSheets_(value)) || String(value);
    return String(value);
  }

  if (typeof value === "string") {
    const texte = value.trim();
    if (texte === "") return "";
    if (PRESENCE_LUNDI_REGEX.test(texte)) return lundiDeDateIso_(texte) || texte;
    const nombre = Number(texte);
    if (Number.isFinite(nombre)) return normaliserLundiPresence_(nombre, lundiCourant);
    return texte;
  }

  if (value === null || value === undefined || value === "") return "";

  return String(value);
}


function estLundiPresence_(value) {
  return typeof value === "string" && parserDateIsoPresence_(value) !== null;
}


// Tri : lundis valides par ordre chronologique ; les valeurs
// non reconnues passent en tête, groupées, sans être perdues.
function comparerLundisPresence_(a, b) {
  const lundiA = estLundiPresence_(a);
  const lundiB = estLundiPresence_(b);
  if (lundiA !== lundiB) return lundiA ? 1 : -1;
  const texteA = String(a || "");
  const texteB = String(b || "");
  return texteA < texteB ? -1 : texteA > texteB ? 1 : 0;
}


// Nombre de semaines entre un lundi et un lundi de référence
// (positif si le lundi est passé).
function ecartSemainesPresence_(lundi, reference) {
  const a = parserDateIsoPresence_(lundi);
  const b = parserDateIsoPresence_(reference);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 604800000);
}


// Identité d'une ligne telle que l'interface la renvoie avec un
// pointage : lundi, prénom, nom. Le numéro de ligne seul ne
// suffit pas, un tri l'a peut-être déplacé depuis l'affichage.
function clePersonnePresence_(prenom, nom) {
  return [prenom, nom]
    .map(value => String(value || "").trim().toLowerCase())
    .join("|");
}


// ============================================================
// INVENTAIRE DES FORMULES LISANT PRÉSENCES!A
//
// À lancer depuis l'éditeur avant la migration : liste toutes
// les formules du classeur qui mentionnent la feuille Présences,
// et signale celles qui lisent la colonne A par numéro de
// semaine. Ne modifie rien.
// ============================================================

function inventorierReferencesSemainePresences() {

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const references = [];

  ss.getSheets().forEach(sheet => {

    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (lastRow < 1 || lastColumn < 1) return;

    const nom = sheet.getName();
    const locale = nom === PRESENCES_SHEET_NAME;
    const formulas = sheet.getRange(1, 1, lastRow, lastColumn).getFormulas();

    formulas.forEach((ligne, r) => ligne.forEach((formule, c) => {

      if (!formule) return;

      // Les formules M et N du registre lui-même ne lisent pas A.
      if (locale && c < 15) return;

      const colonneA = locale
        ? PRESENCE_REFERENCE_LOCALE_A.test(formule) || PRESENCE_REFERENCE_COLONNE_A.test(formule)
        : PRESENCE_REFERENCE_COLONNE_A.test(formule);

      if (!colonneA && !/pr[ée]sences/i.test(formule)) return;

      references.push({
        feuille: nom,
        cellule: sheet.getRange(r + 1, c + 1).getA1Notation(),
        formule: formule,
        colonneA: colonneA
      });
    }));
  });

  references.forEach(ref => Logger.log(
    `${ref.colonneA ? "COLONNE A" : "info"} — ${ref.feuille}!${ref.cellule} : ${ref.formule}`
  ));

  Logger.log(
    `${references.length} formule(s) mentionnent Présences, dont ${references.filter(r => r.colonneA).length} lisent la colonne A.`
  );

  return references;
}


// ============================================================
// MIGRATION VERS LES LUNDIS
//
// Colonne A seule : valeurs et format texte, sous les mêmes
// verrous qu'un ajout d'effectif et qu'une régénération. Aucune
// ligne déplacée, aucun pointage touché. Les formules du classeur
// qui lisent la colonne A sont rappelées dans le journal : c'est
// l'inventaire préalable qui sert de contrôle, une formule adaptée
// au lundi ISO lit légitimement cette colonne.
// ============================================================

function migrerPresencesVersLundis() {

  const scriptLock = LockService.getScriptLock();
  scriptLock.waitLock(30000);

  try {

    const documentLock = LockService.getDocumentLock();
    documentLock.waitLock(30000);

    try {

      const references = inventorierReferencesSemainePresences()
        .filter(ref => ref.colonneA);

      if (references.length > 0) {
        Logger.log(
          `Attention : ${references.length} formule(s) lisent Présences!A ` +
          `(${references.map(ref => `${ref.feuille}!${ref.cellule}`).join(", ")}). ` +
          "Elles doivent attendre un lundi ISO en texte, pas un numéro de semaine."
        );
      }

      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      const sheet = ss.getSheetByName(PRESENCES_SHEET_NAME);

      if (!sheet) {
        throw new Error("Feuille Présences introuvable.");
      }

      const lundiCourant = lundiCourantPresence_();
      const maxRows = sheet.getMaxRows();

      sheet.getRange(1, 1).setValue("Lundi");

      if (maxRows >= 2) {
        sheet.getRange(2, 1, maxRows - 1, 1).setNumberFormat("@");
      }

      const lastRow = getLastPresenceRowWebApp(sheet);
      let corrigees = 0;
      let lignes = 0;

      if (lastRow >= 2) {

        const range = sheet.getRange(2, 1, lastRow - 1, 1);
        const values = range.getValues();
        lignes = values.length;

        const nouvelles = values.map(ligne => {
          const lundi = normaliserLundiPresence_(ligne[0], lundiCourant);
          if (lundi !== ligne[0]) corrigees++;
          return [lundi];
        });

        if (corrigees > 0) {
          range.setValues(nouvelles);
        }
      }

      SpreadsheetApp.flush();

      Logger.log(
        `Présences!A : ${corrigees} cellule(s) converties en lundi ISO sur ${lignes} ligne(s).`
      );

      return { lignes: lignes, corrigees: corrigees, lundiCourant: lundiCourant };

    }
    finally {
      documentLock.releaseLock();
    }
  }
  finally {
    scriptLock.releaseLock();
  }
}



// ============================================================
// STRUCTURE DE LA FEUILLE
// ============================================================

function appliquerStructurePresences(
  sheet,
  lastRow
) {

  const headers = [[

    "Lundi",
    "Corps de garde",
    "Grade",
    "Prénom",
    "Nom",

    "Lun",
    "Mar",
    "Mer",
    "Jeu",
    "Ven",
    "Sam",
    "Dim",

    "Jours présents",
    "Solde",
    "Payé"

  ]];


  sheet
    .getRange(
      1,
      1,
      1,
      15
    )
    .setValues(
      headers
    )
    .setFontWeight(
      "bold"
    );


  sheet.setFrozenRows(
    1
  );


  if (
    lastRow < 2
  ) {

    return;
  }


  const dataRows =
    lastRow - 1;

  // Poser la validation sans remettre à faux les pointages et paiements sauvegardés.
  const checkboxRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();


  // ==========================================================
  // CHECKBOXES F:L
  // ==========================================================

  sheet
    .getRange(
      2,
      6,
      dataRows,
      7
    )
    .setDataValidation(checkboxRule);


  // ==========================================================
  // CHECKBOX PAYÉ
  // ==========================================================

  sheet
    .getRange(
      2,
      15,
      dataRows,
      1
    )
    .setDataValidation(checkboxRule);


  // ==========================================================
  // FORMULES
  // ==========================================================

  const joursFormulas =
    [];




  for (
    let row = 2;
    row <= lastRow;
    row++
  ) {

    joursFormulas.push([
      `=COUNTIF(F${row}:L${row};TRUE)`
    ]);


  }


  sheet
    .getRange(
      2,
      13,
      dataRows,
      1
    )
    .setFormulas(
      joursFormulas
    );


  mettreAJourSoldesPresences_(sheet.getParent(), sheet);


  // ==========================================================
  // ALIGNEMENTS
  // ==========================================================

  sheet
    .getRange(
      2,
      6,
      dataRows,
      10
    )
    .setHorizontalAlignment(
      "center"
    );


  appliquerCouleursPresences_(sheet);


  // ==========================================================
  // LARGEURS
  // ==========================================================

  sheet.setColumnWidth(
    1,
    80
  );

  sheet.setColumnWidth(
    2,
    180
  );

  sheet.setColumnWidth(
    3,
    150
  );

  sheet.setColumnWidth(
    4,
    150
  );

  sheet.setColumnWidth(
    5,
    170
  );


  for (
    let column = 6;
    column <= 12;
    column++
  ) {

    sheet.setColumnWidth(
      column,
      55
    );
  }


  sheet.setColumnWidth(
    13,
    105
  );

  sheet.setColumnWidth(
    14,
    110
  );

  sheet.setColumnWidth(
    15,
    70
  );
}


// ============================================================
// COULEURS ET SÉPARATEURS
//
// La mise en forme conditionnelle et les séparateurs de semaine
// étaient posés à la main sur une plage fixe : chaque ligne
// ajoutée par la génération en sortait. Ils sont désormais
// réécrits à chaque régénération sur toute la hauteur de A:O.
// Les règles existantes de la feuille sont remplacées : ne pas
// en poser à la main dans Présences.
//
// Formules en anglais, SANS séparateur d'arguments : l'API ne
// traduit pas les formules des règles conditionnelles dans la
// locale du classeur (voir appliquerCouleursPresences_). Le
// lundi courant y est inscrit en dur, en texte ISO, par la
// génération : la colonne A porte le lundi en texte ISO, et la
// feuille ne compare que des textes.
// ============================================================

const PRESENCE_COULEUR_SEMAINE_COURANTE = "#fce5cd";
const PRESENCE_COULEUR_IMPAYE = "#f4cccc";
const PRESENCE_COULEUR_PASSEE = "#efefef";

function appliquerCouleursPresences_(sheet) {

  const maxRows = sheet.getMaxRows();

  if (maxRows < 2) {
    return;
  }

  const plage = sheet.getRange(2, 1, maxRows - 1, 15);

  // Un fond posé à la main masquerait les lignes qu'aucune règle ne
  // colore : seule la règle décide de la couleur.
  plage.setBackground(null);

  /*
    Le lundi courant est inscrit en dur dans les règles, en texte ISO,
    par la génération. Sheets ne fait plus que comparer deux textes
    ISO, ce qui est chronologiquement exact et ne dépend ni de la
    locale, ni de TODAY(), ni d'un calcul de date dans la feuille :
    les variantes à base de TEXT() puis de DATE(LEFT;MID;RIGHT)
    n'étaient jamais vraies sur le classeur du propriétaire.

    Contrepartie : les règles changent de semaine quand la génération
    tourne, donc avec le déclencheur du lundi. Entre minuit et son
    passage, la semaine écoulée reste affichée comme courante.
  */
  const lundiCourant = `"${lundiCourantPresence_()}"`;

  /*
    AUCUN SÉPARATEUR D'ARGUMENTS dans ces formules. Contrairement aux
    formules de cellules, celles des règles conditionnelles posées par
    l'API sont stockées telles quelles, sans traduction dans la locale
    du classeur : avec une virgule, un classeur à point-virgule les
    tient pour invalides et la règle n'est jamais vraie (constaté sur
    le classeur du propriétaire ; seule la règle sans séparateur
    fonctionnait). D'où des produits de booléens et des fonctions à un
    seul argument : (a)*(b) vaut 1 si a et b sont vrais, et NOT(NOT(x))
    ramène ce nombre à un booléen. LEN($A2)=10 écarte les lignes vides.
  */
  const ligneDatee = "(LEN($A2)=10)";
  const passee = `${ligneDatee}*($A2<${lundiCourant})`;

  // Ordre significatif : la première règle vraie l'emporte.
  const regles = [
    { formule: `=$A2=${lundiCourant}`, couleur: PRESENCE_COULEUR_SEMAINE_COURANTE },
    { formule: `=NOT(NOT(${passee}*($N2>0)*NOT($O2)))`, couleur: PRESENCE_COULEUR_IMPAYE },
    { formule: `=NOT(NOT(${passee}))`, couleur: PRESENCE_COULEUR_PASSEE }
  ].map(regle =>
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(regle.formule)
      .setBackground(regle.couleur)
      .setRanges([plage])
      .build()
  );

  sheet.setConditionalFormatRules(regles);
}


// Trait plein sous la dernière ligne de chaque semaine, pointillé
// à chaque changement de corps dans la semaine ; rien ailleurs.
function tracerSeparateursPresences_(sheet, lignes) {

  const maxRows = sheet.getMaxRows();

  if (maxRows > 1) {
    sheet
      .getRange(2, 1, maxRows - 1, 15)
      .setBorder(false, false, false, false, false, false);
  }

  lignes.forEach((ligne, index) => {

    const suivante = lignes[index + 1];
    const finSemaine = !suivante || String(suivante[0]) !== String(ligne[0]);
    const changementCorps = !finSemaine && String(suivante[1] || "") !== String(ligne[1] || "");

    if (!finSemaine && !changementCorps) {
      return;
    }

    sheet
      .getRange(index + 2, 1, 1, 15)
      .setBorder(
        null, null, true, null, null, null,
        finSemaine ? "#000000" : "#999999",
        finSemaine ? SpreadsheetApp.BorderStyle.SOLID_MEDIUM : SpreadsheetApp.BorderStyle.DASHED
      );
  });
}


// ============================================================
// AJOUT DE LIGNES SI NÉCESSAIRE
// ============================================================

function ensurePresenceRows(
  sheet,
  requiredRows
) {

  const currentRows =
    sheet.getMaxRows();


  if (
    currentRows >=
    requiredRows
  ) {

    return;
  }


  sheet.insertRowsAfter(
    currentRows,
    requiredRows -
      currentRows
  );
}


// ============================================================
// WEB APP
// LECTURE DES PRÉSENCES
//
// GARDE : lecture
// OFFICIER : lecture
// ============================================================

function getPresences(
  token
) {

  const auth = requireRole(
    token,
    [
      "GARDE",
      "OFFICIER"
    ]
  );


  const ss =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );


  const sheet =
    ss.getSheetByName(
      PRESENCES_SHEET_NAME
    );


  if (!sheet) {

    throw new Error(
      "Feuille Présences introuvable."
    );
  }


  mettreAJourSoldesPresences_(ss, sheet);
  SpreadsheetApp.flush();


  const lundiCourant =
    lundiCourantPresence_();


  const lastRow =
    getLastPresenceRowWebApp(
      sheet
    );


  if (
    lastRow < 2
  ) {

    return {

      lundiCourant:
        lundiCourant,

      rows:
        []

    };
  }


  const range =
    sheet.getRange(
      2,
      1,
      lastRow - 1,
      15
    );


  const values =
    range.getValues();


  const displayValues =
    range.getDisplayValues();


  const rows =
    [];


  for (
    let i = 0;
    i < values.length;
    i++
  ) {

    const row =
      values[i];


    const lundi =
      normaliserLundiPresence_(
        row[0],
        lundiCourant
      );


    if (
      lundi === ""
      ||
      estCorpsExcluDesPresences_(
        displayValues[i][1]
      )
    ) {

      continue;
    }


    rows.push({

      /*
        Numéro réel de ligne dans Google Sheets. L'écriture
        d'une case exige aussi l'identité (lundi, prénom, nom) :
        un tri a pu déplacer la ligne depuis l'affichage.
      */

      row:
        i + 2,

      lundi:
        lundi,

      corps:
        displayValues[i][1],

      grade:
        displayValues[i][2],

      prenom:
        displayValues[i][3],

      nom:
        displayValues[i][4],

      jours: [

        row[5] === true,
        row[6] === true,
        row[7] === true,
        row[8] === true,
        row[9] === true,
        row[10] === true,
        row[11] === true

      ],

      joursPresents:
        displayValues[i][12],

      solde:
        displayValues[i][13],

      soldeRaw:
        Number(
          row[13]
        ) || 0,

      paye:
        row[14] === true

    });
  }


  const result = {
    lundiCourant: lundiCourant,
    rows: rows,
    // Grades affichés selon le corps de la ligne (AliasGrades.js).
    aliasGrades: lireAliasGrades_(ss)
  };

  // Les agrégats financiers sont réservés aux officiers.
  if (auth.role === "OFFICIER") {
    const totals = new Map();
    rows.forEach(row => {
      const corps = row.corps || "Sans corps";
      const key = JSON.stringify([row.lundi, corps]);
      if (!totals.has(key)) {
        totals.set(key, { lundi: row.lundi, corps: corps, total: 0 });
      }
      totals.get(key).total += row.soldeRaw;
    });
    result.corpsTotals = Array.from(totals.values());
  }

  return result;
}


// ============================================================
// WEB APP
// MODIFICATION
//
// OFFICIER UNIQUEMENT.
// ============================================================

function modifierPresence(
  token,
  row,
  column,
  checked,
  identite
) {

  ecrirePresenceCellule_(
    token,
    row,
    column,
    checked,
    identite
  );


  /*
    Retour immédiat de l'état à jour.
  */

  return getPresences(
    token
  );
}


// ============================================================
// ÉCRITURE VALIDÉE D'UNE CASE DE PRÉSENCE
//
// Partagée par `modifierPresence` et par la page Paye
// (`Paye.js`), afin que les deux chemins d'écriture
// appliquent exactement les mêmes contrôles.
//
// N'effectue aucune lecture de retour : l'appelant choisit
// la vue qu'il renvoie à l'interface.
//
// `identite` = { lundi, prenom, nom } de la ligne telle que
// l'interface l'a affichée. Une régénération trie et déplace
// les lignes ; sans cette vérification, un clic sur un numéro
// de ligne périmé pointerait un autre garde. L'écriture se fait
// sous le verrou de document, le même que la régénération, pour
// qu'aucune case ne se glisse au milieu d'une réécriture.
// ============================================================

function ecrirePresenceCellule_(
  token,
  row,
  column,
  checked,
  identite
) {

  /*
    IMPORTANT :

    Même si un GARDE modifie manuellement
    le HTML ou appelle google.script.run
    depuis la console, le serveur refuse.
  */

  requireRole(
    token,
    [
      "OFFICIER"
    ]
  );


  row =
    Number(
      row
    );


  column =
    Number(
      column
    );


  if (
    !Number.isInteger(
      row
    )
    ||
    row < 2
  ) {

    throw new Error(
      "Ligne invalide."
    );
  }


  /*
    Seules les colonnes suivantes
    sont modifiables via la Web App :

    F:L = présence quotidienne
    O   = payé
  */

  const isPresenceDay =
    (
      column >= 6
      &&
      column <= 12
    );


  const isPaid =
    column === 15;


  if (
    !isPresenceDay
    &&
    !isPaid
  ) {

    throw new Error(
      "Cette cellule ne peut pas être modifiée."
    );
  }


  if (
    !identite
    ||
    typeof identite !== "object"
    ||
    !identite.lundi
  ) {

    throw new Error(
      "Identité de la ligne manquante. Rechargez la page."
    );
  }


  const lock =
    LockService.getDocumentLock();


  lock.waitLock(
    30000
  );


  try {

    const ss =
      SpreadsheetApp.openById(
        SPREADSHEET_ID
      );


    const sheet =
      ss.getSheetByName(
        PRESENCES_SHEET_NAME
      );


    if (!sheet) {

      throw new Error(
        "Feuille Présences introuvable."
      );
    }


    const lastRow =
      getLastPresenceRowWebApp(
        sheet
      );


    if (
      row >
      lastRow
    ) {

      throw new Error(
        "Cette ligne n'existe plus. Rechargez la page."
      );
    }


    /*
      La ligne doit être une ligne de présence, et être
      celle que l'officier avait sous les yeux.
    */

    const lundiCourant =
      lundiCourantPresence_();


    const entete =
      sheet
        .getRange(
          row,
          1,
          1,
          5
        )
        .getValues()[0];


    const lundi =
      normaliserLundiPresence_(
        entete[0],
        lundiCourant
      );


    if (
      lundi === ""
    ) {

      throw new Error(
        "Ligne de présence invalide."
      );
    }


    const attendu =
      normaliserLundiPresence_(
        identite.lundi,
        lundiCourant
      );


    if (
      lundi !== attendu
      ||
      clePersonnePresence_(
        entete[3],
        entete[4]
      ) !==
      clePersonnePresence_(
        identite.prenom,
        identite.nom
      )
    ) {

      throw new Error(
        "La liste des présences a changé depuis l'affichage. Rechargez la page avant de pointer."
      );
    }


    sheet
      .getRange(
        row,
        column
      )
      .setValue(
        checked === true
      );


    SpreadsheetApp.flush();

  }
  finally {

    lock.releaseLock();
  }
}


// ============================================================
// DERNIÈRE LIGNE UTILE
// ============================================================

function getLastPresenceRowWebApp(
  sheet
) {

  const lastRow =
    sheet.getLastRow();


  if (
    lastRow < 1
  ) {

    return 1;
  }


  const values =
    sheet
      .getRange(
        1,
        1,
        lastRow,
        1
      )
      .getValues();


  for (
    let i =
      values.length - 1;
    i >= 0;
    i--
  ) {

    if (
      values[i][0] !== ""
      &&
      values[i][0] !== null
    ) {

      return i + 1;
    }
  }


  return 1;
}


// ============================================================
// SEMAINE ISO
// ============================================================

function getCurrentIsoWeekWebApp() {

  /*
    Numéro de semaine ISO de la semaine courante, à Stockholm.
    Conservé pour les anciens appelants ; le serveur raisonne
    en lundis (voir lundiCourantPresence_).
  */

  const courant =
    numeroSemaineIsoPresence_(
      lundiCourantPresence_()
    );


  return courant
    ? courant.semaine
    : null;
}
