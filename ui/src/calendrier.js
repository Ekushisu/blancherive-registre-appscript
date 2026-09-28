/*
  Calendrier tamrielien pour l'affichage des dates.

  Les données restent en calendrier réel partout (feuilles, API, champs de
  saisie) : seul l'affichage est traduit, et la date réelle est toujours
  disponible à côté, dans l'info-bulle.

  Correspondance : même jour, même mois, même jour de la semaine ; l'année
  réelle moins 1 800 donne l'année de la Quatrième Ère (2026 → 4E 226). Noms
  français de la version française des jeux, vérifiés sur le wiki The Elder
  Scrolls et la Grande Bibliothèque de Tamriel.
*/

export const MOIS_TAMRIEL = [
  "Primétoile", "Clairciel", "Semailles", "Ondepluie", "Plantaisons", "Mi-l'An",
  "Hautzénith", "Vifazur", "Âtrefeu", "Soufflegivre", "Sombreciel", "Soirétoile"
];

// Indexés comme Date#getDay : dimanche en premier.
export const JOURS_TAMRIEL = ["Sundas", "Morndas", "Tirdas", "Middas", "Turdas", "Fredas", "Loredas"];

export const ERE = 4;
export const DECALAGE_ANNEE = 1800;
export const FUSEAU = "Europe/Stockholm";

const pad = value => String(value).padStart(2, "0");

/*
  Lit une date sous les formes que le serveur renvoie :
  « 2026-09-28 », « 2026-09-28T11:12:57.322Z », « 28/09/2026 »,
  « 28/09/2026 18:30 », ou un objet Date. Renvoie les champs civils
  (dans le fuseau métier pour un instant absolu), ou null.
*/
export function lireDate(valeur) {
  if (valeur instanceof Date) {
    if (Number.isNaN(valeur.getTime())) return null;
    return champsInstant(valeur);
  }
  const texte = String(valeur ?? "").trim();
  if (!texte) return null;

  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texte);
  if (m) return valider({ annee: +m[1], mois: +m[2], jour: +m[3] });

  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(texte);
  if (m) {
    const champs = { annee: +m[3], mois: +m[2], jour: +m[1] };
    if (m[4] !== undefined) { champs.heure = +m[4]; champs.minute = +m[5]; }
    return valider(champs);
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(texte)) {
    const date = new Date(texte);
    return Number.isNaN(date.getTime()) ? null : champsInstant(date);
  }

  return null;
}

function champsInstant(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en", {
    timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date).map(p => [p.type, p.value]));
  return { annee: +parts.year, mois: +parts.month, jour: +parts.day, heure: +parts.hour, minute: +parts.minute };
}

function valider(champs) {
  const date = new Date(Date.UTC(champs.annee, champs.mois - 1, champs.jour));
  const ok = date.getUTCFullYear() === champs.annee && date.getUTCMonth() === champs.mois - 1 && date.getUTCDate() === champs.jour
    && (champs.heure === undefined || (champs.heure >= 0 && champs.heure < 24 && champs.minute >= 0 && champs.minute < 60));
  return ok ? champs : null;
}

export function jourSemaineTamriel(champs) {
  return JOURS_TAMRIEL[new Date(Date.UTC(champs.annee, champs.mois - 1, champs.jour)).getUTCDay()];
}

export function anneeTamriel(annee) {
  return `${ERE}E ${annee - DECALAGE_ANNEE}`;
}

/*
  « Loredas 28 Âtrefeu 4E 226 », ou « 28 Âtrefeu 4E 226 » sans le jour,
  suivi de « · 18:30 » si la valeur porte une heure. Une valeur non
  reconnue est rendue telle quelle : une date mal formée doit rester
  visible, pas disparaître.
*/
export function dateTamriel(valeur, { jour = true, heure = true } = {}) {
  const champs = lireDate(valeur);
  if (!champs) return String(valeur ?? "");
  const parties = [];
  if (jour) parties.push(jourSemaineTamriel(champs));
  parties.push(String(champs.jour), MOIS_TAMRIEL[champs.mois - 1], anneeTamriel(champs.annee));
  let texte = parties.join(" ");
  if (heure && champs.heure !== undefined) texte += ` · ${pad(champs.heure)}:${pad(champs.minute)}`;
  return texte;
}

// « 28/09/2026 » ou « 28/09/2026 18:30 » : la date réelle de l'info-bulle.
export function dateReelle(valeur) {
  const champs = lireDate(valeur);
  if (!champs) return String(valeur ?? "");
  let texte = `${pad(champs.jour)}/${pad(champs.mois)}/${champs.annee}`;
  if (champs.heure !== undefined) texte += ` ${pad(champs.heure)}:${pad(champs.minute)}`;
  return texte;
}
