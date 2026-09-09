import { readFileSync, writeFileSync } from 'node:fs';

// Le CSV d'extraction reste la source locale ; le fichier HTML est une ressource
// serveur chargée uniquement lors de la première création de la feuille Objets.
export function parseCsv(text) {
  const rows = [];
  let row = [], value = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === ';' || c === '\n' || c === '\r')) {
      row.push(value); value = '';
      if (c !== ';') {
        if (row.some(Boolean)) rows.push(row);
        row = [];
        if (c === '\r' && text[i + 1] === '\n') i++;
      }
    } else value += c;
  }
  if (quoted) throw new Error('CSV : guillemets non fermés.');
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

const [headers, ...source] = parseCsv(readFileSync('docs/catalogue-objets/objets-candidats.csv', 'utf8'));
const indices = ['id', 'nom', 'categorie'].map(name => headers.indexOf(name));
if (indices.includes(-1)) throw new Error('Colonnes du catalogue introuvables.');
const rows = source.map(row => indices.map(i => row[i]?.trim() || ''));
if (!rows.length || rows.some(row => row.some(v => !v)) || new Set(rows.map(r => r[0].toLowerCase())).size !== rows.length) {
  throw new Error('Catalogue vide, incomplet ou identifiants dupliqués.');
}
const csv = [['ID objet', 'Nom', 'Type'], ...rows].map(row => row.map(v => '"' + v.replaceAll('"', '""') + '"').join(';')).join('\r\n');
writeFileSync('docs/catalogue-objets/Objets.csv', '\uFEFF' + csv + '\r\n');
writeFileSync('src/CatalogueObjets.html', JSON.stringify(rows).replaceAll('<', '\\u003c') + '\n');
console.log(`Catalogue Objets préparé : ${rows.length} lignes, 3 colonnes.`);
