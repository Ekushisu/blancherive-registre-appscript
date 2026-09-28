import { dateTamriel, dateReelle, lireDate } from "./calendrier.js";

/*
  Une date affichée en calendrier tamrielien, la date réelle au survol.
  `jour` : afficher le jour de la semaine (inutile pour un lundi déjà
  annoncé comme tel). `heure` : afficher l'heure si la valeur en porte une.
*/
export function DateRP({ value, jour = true, heure = true }) {
  if (!lireDate(value)) return <>{value ?? ""}</>;
  const reelle = dateReelle(value);
  return <span className="date-rp" title={`Calendrier réel : ${reelle}`} aria-label={`${dateTamriel(value, { jour, heure })} (${reelle})`}>
    {dateTamriel(value, { jour, heure })}
  </span>;
}
