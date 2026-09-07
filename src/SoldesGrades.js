// Barème journalier par grade. Aucun ajout de colonne dans Présences.
// Les tarifs historiques sont conservés dans les formules de solde.
const SOLDES_GRADES_HEADERS = ["Grade", "Solde journalière (septims)"];

function cleGradeSolde_(grade) {
  const key = String(grade || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return key === "commandant" ? "commander" : key;
}

function lireAncienneBaseSolde_(ss) {
  const sheet = ss.getSheetByName("Vue globale");
  const value = sheet ? sheet.getRange("L2").getValue() : "";
  if (value === "" || value === null || !Number.isFinite(Number(value)) || Number(value) < 0) {
    throw new Error("La base de solde dans Vue globale!L2 doit être un nombre positif ou nul.");
  }
  return Number(value);
}

function lireBaremeSoldesGrades_(ss) {
  let sheet = ss.getSheetByName("SoldesGrades");
  if (!sheet) {
    try { sheet = ss.insertSheet("SoldesGrades"); }
    catch (error) {
      sheet = ss.getSheetByName("SoldesGrades");
      if (!sheet) throw error;
    }
  }
  if (sheet.getLastRow() === 0) {
    const base = lireAncienneBaseSolde_(ss);
    const donnees = ss.getSheetByName("Données");
    const grades = donnees && donnees.getLastRow() >= 2
      ? donnees.getRange(2, 1, donnees.getLastRow() - 1, 1).getDisplayValues().flat()
      : [];
    const seen = new Set(["par defaut"]);
    const rows = [SOLDES_GRADES_HEADERS, ["Par défaut", base]];
    grades.concat(["Commander", "Recrue", "Aspirant-Garde"]).forEach(grade => {
      const key = cleGradeSolde_(grade);
      if (!key || seen.has(key)) return;
      seen.add(key);
      const rate = key === "commander" ? 100 : key === "recrue" ? 0 : key === "aspirant-garde" ? base / 2 : base;
      rows.push([String(grade).trim(), rate]);
    });
    if (sheet.getMaxRows() < rows.length) sheet.insertRowsAfter(sheet.getMaxRows(), rows.length - sheet.getMaxRows());
    sheet.getRange(1, 1, rows.length, 2).setValues(rows);
    sheet.setFrozenRows(1);
  }
  const rows = sheet.getRange(1, 1, sheet.getLastRow(), 2).getValues();
  if (rows[0].some((value, i) => value !== SOLDES_GRADES_HEADERS[i])) {
    throw new Error("La feuille SoldesGrades existe avec des en-têtes différents. Aucun contenu remplacé.");
  }
  const rates = new Map();
  rows.slice(1).forEach((row, index) => {
    if (row[0] === "" && row[1] === "") return;
    const key = cleGradeSolde_(row[0]);
    if (!key || row[1] === "" || row[1] === null || !Number.isFinite(Number(row[1])) || Number(row[1]) < 0) {
      throw new Error(`Solde invalide dans SoldesGrades, ligne ${index + 2}.`);
    }
    if (rates.has(key)) throw new Error(`Grade en double dans SoldesGrades, ligne ${index + 2}.`);
    rates.set(key, Number(row[1]));
  });
  if (!rates.has("par defaut")) throw new Error('La ligne "Par défaut" est obligatoire dans SoldesGrades.');
  return rates;
}

function tarifSoldeGrade_(rates, grade, corps) {
  if (estCorpsExcluDesPresences_(corps)) return 0;
  const key = cleGradeSolde_(grade);
  return rates.has(key) ? rates.get(key) : rates.get("par defaut");
}

function nombreFormuleSolde_(value) {
  // Pas de séparateur décimal dépendant de la langue du classeur.
  const [mantissa, exponent = "0"] = String(value).toLowerCase().split("e");
  const decimals = (mantissa.split(".")[1] || "").length;
  const power = Number(exponent) - decimals;
  const digits = mantissa.replace(".", "");
  return power === 0 ? digits : `(${digits}*10^${power})`;
}

function figerAncienneFormuleSolde_(formula, base) {
  // Accepte les notations A1 et R1C1, avec ou sans références absolues.
  return formula.replace(/'Vue globale'!\$?L\$?2\b/gi, nombreFormuleSolde_(base))
    .replace(/'Vue globale'!R2C12\b/gi, nombreFormuleSolde_(base));
}

function mettreAJourSoldesPresences_(ss, sheet) {
  if (!sheet) return;
  const rates = lireBaremeSoldesGrades_(ss);
  const lastRow = getLastPresenceRowWebApp(sheet);
  if (lastRow < 2) return;
  SpreadsheetApp.flush();
  const values = sheet.getRange(2, 1, lastRow - 1, 15).getValues();
  const formulas = sheet.getRange(2, 14, lastRow - 1, 1).getFormulas();
  const currentWeek = getCurrentIsoWeekWebApp();
  let oldBase;
  const updates = [];
  values.forEach((row, index) => {
    if (row[0] === "" || row[0] === null) return;
    let next = formulas[index][0];
    if (Number(row[0]) === Number(currentWeek)) {
      const rate = tarifSoldeGrade_(rates, row[2], row[1]);
      next = `=M${index + 2}*${nombreFormuleSolde_(rate)}`;
    } else if (next && /'Vue globale'!\$?L\$?2\b/i.test(next)) {
      if (oldBase === undefined) oldBase = lireAncienneBaseSolde_(ss);
      next = figerAncienneFormuleSolde_(next, oldBase);
    }
    if (next && next !== formulas[index][0]) updates.push({ row: index + 2, formula: next });
  });
  ecrireFormulesSoldeParBlocs_(sheet, updates, false);
}

function ecrireFormulesSoldeParBlocs_(sheet, updates, r1c1) {
  let index = 0;
  while (index < updates.length) {
    const start = index;
    while (index + 1 < updates.length && updates[index + 1].row === updates[index].row + 1) index++;
    const formulas = updates.slice(start, index + 1).map(item => [item.formula]);
    const range = sheet.getRange(updates[start].row, 14, formulas.length, 1);
    if (r1c1) range.setFormulasR1C1(formulas);
    else range.setFormulas(formulas);
    index++;
  }
}
