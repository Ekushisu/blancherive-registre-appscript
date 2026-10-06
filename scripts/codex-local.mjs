// Codex reconstitué depuis les copies locales de `docs/codex/`, avec
// l'extraction réelle de `src/SyncCodex.js` et la lecture réelle de
// `src/Codex.js`. Sert aux tests et aux aperçus qui ont besoin des vrais
// numéros, titres et qualifications d'articles, sans accès Drive.
//
// Les copies locales ne sont pas la source de vérité : un document modifié
// dans Drive depuis sa copie peut différer. La correspondance fichier → document
// vient de la table de `docs/codex/README.md` (fichier, identifiant), et
// l'identifiant → source du registre `SYNC_CODEX_DOCUMENTS`.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = fichier => fs.readFileSync(path.join(racine, fichier), 'utf8');

/*
  Documents du registre, chacun avec les articles extraits de sa copie
  locale. Un document sans copie locale est rendu avec `fichier: null` et
  aucun article.
*/
export function documentsLocaux() {
  const ctx = vm.createContext({});
  vm.runInContext(lire('src/SyncCodex.js'), ctx);
  const registre = vm.runInContext('SYNC_CODEX_DOCUMENTS', ctx);
  const fichierParId = new Map(
    [...lire('docs/codex/README.md').matchAll(/^\|\s*`([^`]+\.txt)`\s*\|\s*`([^`]+)`/gm)].map(m => [m[2], m[1]])
  );
  return Array.from(registre, document => {
    const fichier = fichierParId.get(document.id) || null;
    if (!fichier) return { ...document, fichier, articles: [] };
    // L'export texte ajoute des puces en tête des listes ; Apps Script ne les rend pas.
    const lignes = lire(`docs/codex/${fichier}`).replace(/^﻿/, '').split(/\r?\n/)
      .map(ligne => ligne.replace(/^(?:\s*[*■]\s+)+/, ''));
    const articles = ctx.extraireArticlesCodex_({ getBody: () => ({ getText: () => lignes.join('\n') }) }, document);
    return { ...document, fichier, articles: JSON.parse(JSON.stringify(articles)) };
  });
}

/*
  Réponse de `getCodex` telle que le serveur la rendrait après une
  synchronisation sur les copies locales : `Codex.js` lit un faux SyncCodex
  rempli des articles extraits.
*/
export function codexLocal(documents = documentsLocaux()) {
  const lignes = [Array(25).fill('')];
  for (const document of documents) {
    for (const a of document.articles) {
      const ligne = Array(25).fill('');
      Object.assign(ligne, [a.source, a.article, a.titre, a.classification, a.amende, a.travaux, a.cachot, a.sanction, a.texte, a.alerte]);
      lignes.push(ligne);
    }
  }
  const feuille = {
    getLastRow: () => lignes.length,
    getMaxColumns: () => 25,
    getRange(ligne, colonne, hauteur = 1, largeur = 1) {
      const valeurs = () => Array.from({ length: hauteur }, (_, i) => Array.from({ length: largeur }, (_, j) => lignes[ligne + i - 1]?.[colonne + j - 1] ?? ''));
      return { getValues: valeurs, getDisplayValues: () => valeurs().map(r => r.map(v => String(v))) };
    }
  };
  const ctx = vm.createContext({
    SPREADSHEET_ID: 'local',
    ROLE_PUBLIC: 'VISITEUR',
    requireRole: () => ({ role: 'GARDE' }),
    SpreadsheetApp: { openById: () => ({ getSheetByName: nom => nom === 'SyncCodex' ? feuille : null }) },
    Utilities: {
      DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (algo, texte) => Array.from(createHash(algo).update(texte, 'utf8').digest()),
      base64EncodeWebSafe: octets => Buffer.from(octets).toString('base64url')
    }
  });
  vm.runInContext(lire('src/SyncCodex.js'), ctx);
  vm.runInContext(lire('src/Codex.js'), ctx);
  return JSON.parse(JSON.stringify(ctx.getCodex('GARDE', '')));
}
