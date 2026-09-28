/*
  Semaines de Présences côté interface.

  Le serveur ne manipule que des lundis ISO (« 2026-09-28 ») : c'est la
  clé d'une semaine dans Présences!A, elle porte l'année. Le numéro de
  semaine n'est qu'un libellé pour l'officier ; il se calcule ici et nulle
  part ailleurs, pour qu'un passage d'année n'ait aucun effet sur les
  données.
*/

const LUNDI_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

// Date UTC à minuit, ou null si le texte n'est pas un lundi ISO valide.
export function parserLundi(lundi) {
  const match = LUNDI_REGEX.exec(String(lundi || "").trim());
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const pad = value => String(value).padStart(2, "0");
  const retour = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  return retour === match[0] ? date : null;
}

// Année et numéro de semaine ISO : l'année ISO est celle du jeudi.
export function semaineIso(lundi) {
  const date = parserLundi(lundi);
  if (!date) return null;
  const jeudi = new Date(date.getTime() + 3 * 86400000);
  const annee = jeudi.getUTCFullYear();
  const ordinal = Math.floor((jeudi.getTime() - Date.UTC(annee, 0, 1)) / 86400000) + 1;
  return { annee, semaine: Math.floor((ordinal - 1) / 7) + 1 };
}

export function numeroSemaine(lundi) {
  const iso = semaineIso(lundi);
  return iso ? iso.semaine : null;
}

// « Semaine 39 ». Une valeur non reconnue est affichée telle quelle,
// jamais masquée : une ligne mal datée doit rester visible.
export function libelleSemaine(lundi) {
  const numero = numeroSemaine(lundi);
  return numero === null ? String(lundi || "") : `Semaine ${numero}`;
}

// « 28/09/2026 », date civile du lundi.
export function dateLundi(lundi) {
  const date = parserLundi(lundi);
  if (!date) return "";
  const pad = value => String(value).padStart(2, "0");
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
}

// « Semaine 39 · du 28/09/2026 » : libellé complet d'un en-tête de semaine.
export function titreSemaine(lundi) {
  const date = dateLundi(lundi);
  return date ? `${libelleSemaine(lundi)} · du ${date}` : libelleSemaine(lundi);
}

// Écart en semaines entre un lundi et un lundi de référence.
export function retardSemaines(lundi, reference) {
  const a = parserLundi(lundi);
  const b = parserLundi(reference);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 604800000);
}

// Tri chronologique décroissant : la semaine la plus récente d'abord ;
// les valeurs non reconnues en fin de liste, groupées.
export function comparerLundisDecroissant(a, b) {
  const lundiA = parserLundi(a) !== null;
  const lundiB = parserLundi(b) !== null;
  if (lundiA !== lundiB) return lundiA ? -1 : 1;
  return String(b || "").localeCompare(String(a || ""));
}
