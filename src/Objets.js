// Catalogue Objets!A:C : ID objet, Nom, Type. Aucun chargement au démarrage.
function normaliserRechercheObjet_(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function validerLignesCatalogueObjets_(rows) {
  const ids = new Set();
  return rows.filter(row => row.some(value => String(value).trim())).map(row => {
    const [id, nom, type] = row.map(value => String(value || '').trim());
    if (!id || !nom || !type || id.length > 200 || nom.length > 300 || type.length > 100 || ids.has(id.toLowerCase())) {
      throw new Error('Catalogue Objets invalide : ID unique, nom et type sont requis.');
    }
    ids.add(id.toLowerCase());
    return { id, nom, type };
  });
}

function obtenirFeuilleObjets_(ss) {
  const existing = ss.getSheetByName('Objets');
  if (existing) return existing;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const concurrent = ss.getSheetByName('Objets');
    if (concurrent) return concurrent;
    const source = JSON.parse(HtmlService.createHtmlOutputFromFile('CatalogueObjets').getContent());
    if (!Array.isArray(source) || !source.length) throw new Error('Catalogue initial des objets introuvable.');
    const objects = validerLignesCatalogueObjets_(source);
    const rows = [['ID objet', 'Nom', 'Type'], ...objects.map(o => [o.id, o.nom, o.type])];
    const sheet = ss.insertSheet('Objets');
    try {
      if (sheet.getMaxRows() < rows.length) sheet.insertRowsAfter(sheet.getMaxRows(), rows.length - sheet.getMaxRows());
      sheet.getRange(1, 1, rows.length, 3).setNumberFormat('@').setValues(
        rows.map(row => row.map(value => value.startsWith('=') ? "'" + value : value))
      );
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
      SpreadsheetApp.flush();
      return sheet;
    } catch (error) {
      // Seulement la feuille créée par cet appel, toujours sous verrou.
      try { ss.deleteSheet(sheet); } catch (cleanupError) { console.error('Initialisation Objets incomplète.', cleanupError); }
      throw error;
    }
  } finally { lock.releaseLock(); }
}

function lireCatalogueObjets_() {
  const sheet = obtenirFeuilleObjets_(SpreadsheetApp.openById(SPREADSHEET_ID));
  const rows = sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), 3).getDisplayValues();
  if (rows[0].join('|') !== 'ID objet|Nom|Type') {
    throw new Error('La feuille Objets doit contenir les colonnes ID objet, Nom et Type en A:C.');
  }
  return validerLignesCatalogueObjets_(rows.slice(1));
}

/*
  Alias de recherche : mots usuels qui ne figurent pas dans le nom du
  catalogue. Partagés avec le cache local du navigateur par
  `getCatalogueObjets`, pour qu'une recherche donne le même résultat des deux
  côtés.
*/
const OBJETS_ALIAS_RECHERCHE = {
  'skyrim.esm|00000f': 'or septim septims pieces d’or gold',
  'skyrim.esm|00000a': 'crochet crochets lockpick lockpicks',
  'skyrim.esm|01d4ec': 'torche torches torch torches'
};

/*
  Catalogue complet pour le cache local du navigateur.

  Chaque `rechercherObjets` relit toute la feuille : une autocomplétion au
  serveur coûte plusieurs secondes par frappe. Les pages qui portent un
  formulaire d'objets préchargent donc le catalogue à l'ouverture et cherchent
  en mémoire (`ui/src/catalogue.js`). La version est une empreinte du contenu :
  si le navigateur la connaît déjà, on ne renvoie pas les 10 000 fiches.

  Le catalogue n'est pas confidentiel, mais la fonction garde les rôles de la
  recherche : ni INTENDANT, qui n'a aucun formulaire d'objets, ni le public.
*/
function getCatalogueObjets(token, versionConnue) {
  requireRole(token, ['GARDE', 'OFFICIER']);
  const objets = lireCatalogueObjets_();
  const empreinte = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    objets.map(o => `${o.id}\t${o.nom}\t${o.type}`).join('\n'),
    Utilities.Charset.UTF_8
  );
  const version = Utilities.base64EncodeWebSafe(empreinte);
  if (typeof versionConnue === 'string' && versionConnue && versionConnue === version) {
    return { version, total: objets.length, alias: OBJETS_ALIAS_RECHERCHE, objets: null };
  }
  return { version, total: objets.length, alias: OBJETS_ALIAS_RECHERCHE, objets: objets.map(o => [o.id, o.nom, o.type]) };
}

function rechercherObjets(token, recherche) {
  requireRole(token, ['GARDE', 'OFFICIER']);
  if (typeof recherche !== 'string' || recherche.length > 100) throw new Error('Recherche d’objet invalide (100 caractères maximum).');
  const query = normaliserRechercheObjet_(recherche);
  if (query.length < 3) return { objets: [], tronque: false };
  const terms = query.split(/\s+/);
  const numericId = /^[0-9a-f]{3,8}$/.test(query) ? query.replace(/^0+/, '') || '0' : null;
  const matches = [];
  const aliases = OBJETS_ALIAS_RECHERCHE;
  lireCatalogueObjets_().forEach(objet => {
    const name = normaliserRechercheObjet_(objet.nom), id = objet.id.toLowerCase();
    const localId = id.split('|').pop().replace(/^0+/, '') || '0';
    const exactId = id === query || (numericId !== null && numericId === localId);
    if (exactId || terms.every(term => `${name} ${id} ${aliases[id] || ''}`.includes(term))) {
      const rank = exactId ? 0 : name === query ? 1 : name.startsWith(query) ? 2 : 3;
      matches.push({ objet, rank });
    }
  });
  matches.sort((a, b) => a.rank - b.rank || a.objet.nom.localeCompare(b.objet.nom, 'fr') || a.objet.id.localeCompare(b.objet.id));
  return { objets: matches.slice(0, 15).map(m => m.objet), tronque: matches.length > 15 };
}

function preparerSaisiesPrison_(value) {
  if (value === undefined || value === null || value === '') return '[]';
  if (!Array.isArray(value)) throw new Error('Actualisez la page puis sélectionnez les objets saisis dans le catalogue.');
  if (value.length > 100) throw new Error('Une incarcération peut contenir au maximum 100 objets différents.');
  const requested = new Map();
  value.forEach(item => {
    if (!item || typeof item.id !== 'string' || item.id.length > 200 ||
        !Number.isSafeInteger(item.quantite) || item.quantite <= 0) {
      throw new Error('Chaque saisie doit contenir un objet et une quantité entière strictement positive.');
    }
    const libre = item.libre === true;
    const nom = typeof item.nom === 'string' ? item.nom.trim().replace(/\s+/g, ' ') : '';
    if (libre ? (item.id !== '' || !nom || nom.length > 300) : !item.id.trim()) {
      throw new Error('Saisie libre : nom requis (300 caractères maximum), sans identifiant de catalogue.');
    }
    const id = item.id.trim().toLowerCase();
    const key = libre ? `libre:${nom.toLowerCase()}` : `catalogue:${id}`;
    const previous = requested.get(key);
    const quantite = (previous?.quantite || 0) + item.quantite;
    if (!Number.isSafeInteger(quantite)) throw new Error('Quantité totale trop élevée.');
    requested.set(key, { id, nom: previous?.nom || nom, libre, quantite });
  });
  if (!requested.size) return '[]'; // Aucune lecture du catalogue sans saisie.
  const besoinCatalogue = [...requested.values()].some(item => !item.libre);
  const catalogue = new Map(besoinCatalogue ? lireCatalogueObjets_().map(o => [o.id.toLowerCase(), o]) : []);
  const result = [];
  requested.forEach(({ id, nom, libre, quantite }) => {
    if (libre) { result.push({ id: '', nom, quantite, libre: true }); return; }
    const objet = catalogue.get(id);
    if (!objet) throw new Error('Un objet saisi n’existe plus dans le catalogue. Retirez-le puis relancez la recherche.');
    // Le nom envoyé par le navigateur n'est jamais une source de confiance.
    result.push({ id: objet.id, nom: objet.nom, quantite });
  });
  const json = JSON.stringify(result);
  if (json.length > 45000) throw new Error('La liste des saisies est trop volumineuse.');
  return json;
}

/*
  Liste structurée d'une cellule Prison!J, ou `null` pour une saisie
  historique en texte libre ou une cellule non reconnue. Le formulaire de
  modification ne réédite que les listes structurées ; un texte historique
  reste tel quel.
*/
function lireSaisiesPrisonStructurees_(value) {
  const text = String(value || '').trim();
  if (!text) return [];
  try {
    const items = JSON.parse(text);
    if (Array.isArray(items) && items.every(item => item && typeof item.id === 'string' &&
        typeof item.nom === 'string' && Number.isSafeInteger(item.quantite) && item.quantite > 0)) {
      return items.map(item => item.libre === true
        ? { id: '', nom: item.nom, quantite: item.quantite, libre: true }
        : { id: item.id, nom: item.nom, quantite: item.quantite });
    }
  } catch (_) { /* Texte historique. */ }
  return null;
}

function afficherSaisiesPrison_(value) {
  const items = lireSaisiesPrisonStructurees_(value);
  if (items) {
    return items.map(item => `${item.nom} × ${item.quantite.toLocaleString('fr-FR')}${item.libre === true ? ' (saisie libre)' : ''}`).join('\n');
  }
  return String(value || '');
}
