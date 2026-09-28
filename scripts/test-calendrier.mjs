// Calendrier tamrielien : lecture des formats renvoyés par le serveur,
// libellés, année de la Quatrième Ère, valeurs non reconnues conservées.
//
//   node scripts/test-calendrier.mjs

import assert from 'node:assert/strict';
import {
  MOIS_TAMRIEL, JOURS_TAMRIEL, lireDate, dateTamriel, dateReelle, anneeTamriel
} from '../ui/src/calendrier.js';

assert.equal(MOIS_TAMRIEL.length, 12);
assert.equal(JOURS_TAMRIEL.length, 7);
assert.equal(JOURS_TAMRIEL[1], 'Morndas', 'Indexé comme Date#getDay : lundi en position 1');

// Le 28 septembre 2026 est un lundi.
assert.equal(dateTamriel('2026-09-28'), 'Morndas 28 Âtrefeu 4E 226');
assert.equal(dateTamriel('2026-09-28', { jour: false }), '28 Âtrefeu 4E 226');
assert.equal(dateTamriel('26/09/2026'), 'Loredas 26 Âtrefeu 4E 226', 'Samedi = Loredas');
assert.equal(dateTamriel('27/09/2026'), 'Sundas 27 Âtrefeu 4E 226');
assert.equal(dateTamriel('14/09/2026 18:30'), 'Morndas 14 Âtrefeu 4E 226 · 18:30');
assert.equal(dateTamriel('14/09/2026 18:30', { heure: false }), 'Morndas 14 Âtrefeu 4E 226');
assert.equal(dateTamriel('1/2/2026'), 'Sundas 1 Clairciel 4E 226', 'Jour et mois sans zéro');
assert.equal(dateTamriel('2025-12-29'), 'Morndas 29 Soirétoile 4E 225');
assert.equal(dateTamriel('2026-01-01'), 'Turdas 1 Primétoile 4E 226');
assert.equal(anneeTamriel(2011), '4E 211');

// Instant absolu (journal des effectifs) : converti dans le fuseau métier.
assert.equal(dateTamriel('2026-09-06T11:12:57.322Z'), 'Sundas 6 Âtrefeu 4E 226 · 13:12', 'UTC+2 en septembre, le 6 est un dimanche');
assert.equal(dateTamriel('2026-01-10T23:30:00Z'), 'Sundas 11 Primétoile 4E 226 · 00:30', 'Passage de minuit à Stockholm');
assert.equal(dateTamriel(new Date('2026-09-28T10:00:00Z')), 'Morndas 28 Âtrefeu 4E 226 · 12:00');

// Date réelle pour l'info-bulle, normalisée.
assert.equal(dateReelle('2026-09-28'), '28/09/2026');
assert.equal(dateReelle('1/2/2026'), '01/02/2026');
assert.equal(dateReelle('14/09/2026 18:30'), '14/09/2026 18:30');
assert.equal(dateReelle('2026-09-06T11:12:57.322Z'), '06/09/2026 13:12');

// Valeurs non reconnues : rendues telles quelles, jamais masquées.
for (const brut of ['', null, undefined, '—', 'S37', '2026-02-30', '31/02/2026', '14/09/2026 25:00', 'demain']) {
  assert.equal(lireDate(brut), null, `non reconnu : ${brut}`);
  assert.equal(dateTamriel(brut), String(brut ?? ''));
  assert.equal(dateReelle(brut), String(brut ?? ''));
}
assert.equal(lireDate(new Date(NaN)), null);

console.log('test-calendrier : mois, jours, ère, formats serveur et valeurs non reconnues OK');
