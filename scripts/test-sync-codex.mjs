import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../src/SyncCodex.js', import.meta.url), 'utf8'), context);
const extract = lines => context.extraireArticlesCodex_({
  getBody: () => ({ getParagraphs: () => lines.map(text => ({ getText: () => text })) })
}, { source: 'Codex Judiciaire de Blancherive' });

const articles = extract([
  'Préambule conservé.',
  'Titre préliminaire — Dispositions générales',
  'Article 73 — Des Compagnons',
  'Les Compagnons demeurent une confrérie libre.',
  'Titre VII — Des atteintes au gouvernement et à la justice',
  'Article 74 — De l’outrage',
  'Sanction — 100 septims et 1 heure de cachot.',
  'Chapitre VIII — Crimes',
  'Article 75',
  'Du paiement',
  'Le titre VII reste applicable.',
  'Titre de propriété requis.'
]);
assert.equal(articles.length, 4);
assert.equal(articles[0].texte, 'Préambule conservé.');
assert.equal(articles[1].texte, 'Les Compagnons demeurent une confrérie libre.');
assert.equal(articles[2].sanction, 'Sanction — 100 septims et 1 heure de cachot.');
assert.equal(articles[2].amende, 100);
assert.equal(articles[2].cachot, 1);
assert.equal(articles[3].titre, 'Du paiement');
assert.ok(articles[3].texte.includes('Le titre VII reste applicable.'));
assert.ok(articles[3].texte.includes('Titre de propriété requis.'));
assert.equal(context.estIntertitreCodex_('Titre VII impose une obligation.'), false);
console.log('SyncCodex : intertitres exclus, articles, préambule et sanctions conservés.');
