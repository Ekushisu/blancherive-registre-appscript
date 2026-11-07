/*
  Détails d'une entrée du registre de la Prison : saisies, notes, acte de
  sortie et journal.

  Sur grand écran, ces champs ne tiennent plus dans des colonnes étroites du
  tableau : ils occupent une ligne de détail sous l'entrée, sur toute la
  largeur. Les saisies s'affichent en jetons compacts, les notes en prose
  avec leurs retours à la ligne. L'un comme l'autre se replient au-delà d'un
  seuil, pour qu'une incarcération richement documentée ne fasse pas dérouler
  tout le registre ; « Tout afficher » les déplie. L'acte de sortie (issue,
  destination, personne destinataire, date, garde, motif) et le journal des
  notes et actes, datés et signés, suivent sur toute la largeur.
*/
import { JournalPrison, ResumeSortie } from "./sortie.jsx";

const { useState } = React;

// Jetons affichés avant repli, et taille de notes au-delà de laquelle on replie.
export const SAISIES_VISIBLES = 8;
export const NOTES_REPLI_CARACTERES = 320;
export const NOTES_REPLI_LIGNES = 4;

/* Saisies structurées (`saisiesListe`) en jetons ; texte historique tel quel. */
export function SaisiesResume({ liste, texte }) {
  const [deplie, setDeplie] = useState(false);
  if (!liste || !liste.length) {
    const t = String(texte || '').trim();
    return t ? <div className="saisies-texte">{t}</div> : <span className="registre-vide">—</span>;
  }
  const visibles = deplie ? liste : liste.slice(0, SAISIES_VISIBLES);
  const reste = liste.length - visibles.length;
  return <div className="saisies-resume">
    <ul className="saisies-jetons">{visibles.map((item, i) => <li key={`${item.id || item.nom}-${i}`} className={item.libre ? 'saisie-jeton saisie-jeton-libre' : 'saisie-jeton'} title={item.libre ? `${item.nom} : saisie libre, hors catalogue` : item.nom}>
      <span className="saisie-jeton-nom">{item.nom}</span>
      <span className="saisie-jeton-quantite">× {Number(item.quantite).toLocaleString('fr-FR')}</span>
    </li>)}</ul>
    {(reste > 0 || deplie) && <button type="button" className="registre-depli" aria-expanded={deplie} onClick={() => setDeplie(d => !d)}>
      {deplie ? 'Réduire' : `+ ${reste} autre${reste > 1 ? 's' : ''}`}
    </button>}
  </div>;
}

export function notesLongues(texte) {
  const t = String(texte || '');
  return t.length > NOTES_REPLI_CARACTERES || t.split('\n').length > NOTES_REPLI_LIGNES;
}

/* Notes en prose : retours à la ligne conservés, repli au-delà du seuil. */
export function NotesDepliables({ texte }) {
  const [deplie, setDeplie] = useState(false);
  const t = String(texte || '').trim();
  if (!t) return <span className="registre-vide">—</span>;
  const longues = notesLongues(t);
  return <div className="notes-depliables">
    <div className={longues && !deplie ? 'notes-texte notes-texte-replie' : 'notes-texte'}>{t}</div>
    {longues && <button type="button" className="registre-depli" aria-expanded={deplie} onClick={() => setDeplie(d => !d)}>{deplie ? 'Réduire' : 'Tout afficher'}</button>}
  </div>;
}

/*
  Ligne de détail d'une incarcération ; rien si l'entrée n'a ni saisies, ni
  notes, ni acte de sortie, ni journal. `Nom` rend un nom de garde
  (NomEffectif dans l'application).
*/
export function DetailsPrison({ entree, colonnes, Nom = ({ nom }) => nom }) {
  const saisies = (entree.saisiesListe && entree.saisiesListe.length) || String(entree.saisies || '').trim();
  const notes = String(entree.notes || '').trim();
  const acte = entree.acteSortie || null;
  const journal = Array.isArray(entree.journal) ? entree.journal : [];
  if (!saisies && !notes && !acte && !journal.length) return null;
  return <tr className="registry-details">
    <td colSpan={colonnes} className="registry-details-cell">
      <div className="registry-details-grid">
        {saisies ? <section className="registry-details-bloc registry-details-saisies"><h4 className="registry-details-label">Saisies</h4><SaisiesResume liste={entree.saisiesListe} texte={entree.saisies} /></section> : null}
        {notes ? <section className="registry-details-bloc registry-details-notes"><h4 className="registry-details-label">Motif d'incarcération</h4><NotesDepliables texte={notes} /></section> : null}
        {acte ? <section className="registry-details-bloc registry-details-sortie"><h4 className="registry-details-label">Sortie</h4><ResumeSortie sortie={acte} Nom={Nom} /></section> : null}
        {journal.length ? <section className="registry-details-bloc registry-details-journal"><h4 className="registry-details-label">Journal</h4><JournalPrison journal={journal} Nom={Nom} /></section> : null}
      </div>
    </td>
  </tr>;
}
