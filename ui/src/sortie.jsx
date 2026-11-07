/*
  Sortie de détention : état d'une incarcération, dialogues d'acte et journal.

  La sortie d'un détenu n'est plus une case à cocher mais un acte complet
  (décision du propriétaire, 7 novembre 2026) : issue, destination et
  personne destinataire pour un transfert, date effective, garde signataire,
  motif obligatoire. L'annulation d'une sortie est réservée aux officiers et
  motivée elle aussi. Les notes s'ajoutent au journal, datées et signées,
  sans retouche possible. Le serveur (`Prison.js`) impose tout cela ; ces
  composants ne font que le demander proprement.
*/
import { DateRP } from "./calendrier.jsx";

const { useState } = React;

/* Date et heure locales au format d'un champ `datetime-local`. */
function maintenantLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/* `dd/MM/yyyy HH:mm` affiché par le registre → Date locale, ou null. */
export function dateDepuisAffichage(texte) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(String(texte || "").trim());
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1], m[4] === undefined ? 0 : +m[4], m[5] === undefined ? 0 : +m[5]);
  return Number.isNaN(d.getTime()) ? null : d;
}

/* Libellé court de l'état d'une entrée : en cellule, libéré, transféré… */
export function libelleEtat(entree) {
  if (entree.acteSortie) {
    const s = entree.acteSortie;
    if (s.destination) return `${s.libelle} — ${s.destination}`;
    return s.libelle;
  }
  return entree.libere ? "Libéré (sans détail)" : "En cellule";
}

export function classeEtat(entree) {
  if (!entree.libere && !entree.acteSortie) return "etat-cellule";
  const code = entree.acteSortie ? entree.acteSortie.issue : "";
  if (/^TRANSFERT_/.test(code)) return "etat-transfert";
  if (code === "EVASION") return "etat-evasion";
  if (code === "DECES") return "etat-deces";
  return "etat-libere";
}

export function EtatSortie({ entree }) {
  return <span className={`etat-sortie ${classeEtat(entree)}`}>{libelleEtat(entree)}</span>;
}

/* Champ Garde d'un acte : imposé en session Discord, sinon choisi dans la liste. */
function ChampSignataire({ id, data, value, onChange }) {
  if (data.gardeImpose) return <input id={id} readOnly value={data.gardeImpose} className="champ-impose" title="Connecté par Discord : vous signez à votre nom." />;
  return <select id={id} required value={value} onChange={e => onChange(e.target.value)}>
    <option value="">Sélectionner…</option>
    {data.gardes.map(g => <option key={g}>{g}</option>)}
  </select>;
}

/* Cadre commun des dialogues d'acte : titre, champs, erreur, boutons. */
function DialogueActe({ titre, entree, children, onFermer, onValider, libelleValider, danger = false }) {
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  async function soumettre(e) {
    e.preventDefault();
    if (envoi) return;
    setErreur(""); setEnvoi(true);
    try { await onValider(); }
    catch (x) { setErreur(x.message || String(x)); }
    finally { setEnvoi(false); }
  }
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !envoi) onFermer(); }}>
    <form className="acte-dialogue" role="dialog" aria-modal="true" aria-labelledby="acte-titre" onSubmit={soumettre}>
      <div className="acte-entete">
        <div>
          <h2 id="acte-titre">{titre}</h2>
          <p className="acte-sujet">{entree.detenu}{entree.cellule ? ` · ${/^cellule/i.test(entree.cellule) ? entree.cellule : `cellule ${entree.cellule}`}` : ""} · entré le <DateRP value={entree.entree} jour={false} /></p>
        </div>
        <button type="button" className="law-modal-close" aria-label="Fermer" onClick={onFermer} disabled={envoi}>×</button>
      </div>
      <fieldset className="form-fieldset" disabled={envoi}>
        <div className="acte-champs">{children}</div>
        {erreur && <div className="error" role="alert">{erreur}</div>}
        <div className="form-actions">
          <button type="submit" className={danger ? "danger-button" : "primary-button"}>{envoi ? "Enregistrement…" : libelleValider}</button>
          <button type="button" className="secondary-button" onClick={onFermer}>Annuler</button>
        </div>
      </fieldset>
    </form>
  </div>;
}

function signataire(data, garde) { return data.gardeImpose || garde; }
function attendu(entree) { return { garde: entree.garde, detenu: entree.detenu }; }

/*
  Prononcer la sortie. `data` : `getPrisonFormData` (gardes, gardeImpose,
  issues). `onValider(payload)` appelle le serveur et laisse remonter l'erreur.
*/
export function SortieDialog({ entree, data, onFermer, onValider }) {
  const issues = data.issues || [];
  const [form, setForm] = useState({ issue: "", destination: "", remisA: "", date: maintenantLocal(), garde: "", motif: "" });
  const issue = issues.find(i => i.code === form.issue) || null;
  // `entree.sortie` est la sortie prévue (Prison!H), affichée `dd/MM/yyyy HH:mm`.
  const prevueDate = dateDepuisAffichage(entree.sortie);
  const anticipee = Boolean(issue && issue.code === "LIBERATION" && prevueDate && form.date && new Date(form.date) < prevueDate);
  return <DialogueActe titre="Prononcer la sortie" entree={entree} onFermer={onFermer} libelleValider="Prononcer la sortie"
    onValider={() => onValider({ issue: form.issue, destination: form.destination, remisA: form.remisA, date: form.date, garde: signataire(data, form.garde), motif: form.motif, attendu: attendu(entree) })}>
    <div className="field"><label htmlFor="acte-issue">Issue</label>
      <select id="acte-issue" required value={form.issue} onChange={e => setForm(p => ({ ...p, issue: e.target.value }))}>
        <option value="">Sélectionner…</option>
        {issues.map(i => <option key={i.code} value={i.code}>{i.libelle}</option>)}
      </select>
    </div>
    {issue && issue.destination && <div className="field"><label htmlFor="acte-destination">{issue.destination}</label>
      <input id="acte-destination" required maxLength={200} value={form.destination} placeholder={`Nom de ${issue.destinationNom || issue.destination.toLowerCase()}`} onChange={e => setForm(p => ({ ...p, destination: e.target.value }))} />
    </div>}
    {issue && issue.transfert && <div className="field"><label htmlFor="acte-remis-a">Remis à</label>
      <input id="acte-remis-a" required maxLength={200} value={form.remisA} placeholder="Nom de la personne qui reçoit le détenu" onChange={e => setForm(p => ({ ...p, remisA: e.target.value }))} />
    </div>}
    <div className="field"><label htmlFor="acte-date">Date et heure de sortie</label>
      <input id="acte-date" type="datetime-local" required value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
      {anticipee && <small className="acte-aide">Avant la sortie prévue (<DateRP value={entree.sortie} jour={false} />) : enregistrée comme libération anticipée.</small>}
    </div>
    <div className="field"><label htmlFor="acte-garde">Garde signataire</label><ChampSignataire id="acte-garde" data={data} value={form.garde} onChange={garde => setForm(p => ({ ...p, garde }))} /></div>
    <div className="field field-full"><label htmlFor="acte-motif">Motif</label>
      <textarea id="acte-motif" required maxLength={2000} rows={4} value={form.motif} placeholder="Ordre reçu, décision, circonstances…" onChange={e => setForm(p => ({ ...p, motif: e.target.value }))} />
    </div>
  </DialogueActe>;
}

/* Annuler une sortie (OFFICIER) : le détenu redevient en cellule. */
export function AnnulationDialog({ entree, data, onFermer, onValider }) {
  const [form, setForm] = useState({ garde: "", motif: "" });
  return <DialogueActe titre="Annuler la sortie" entree={entree} onFermer={onFermer} libelleValider="Remettre en cellule" danger
    onValider={() => onValider({ garde: signataire(data, form.garde), motif: form.motif, attendu: attendu(entree) })}>
    <p className="info-notice acte-notice">Sortie enregistrée : {libelleEtat(entree)}{entree.acteSortie && entree.acteSortie.date ? <> le <DateRP value={entree.acteSortie.date} jour={false} /></> : null}. L'acte annulé reste au journal.</p>
    <div className="field"><label htmlFor="acte-garde">Officier signataire</label><ChampSignataire id="acte-garde" data={data} value={form.garde} onChange={garde => setForm(p => ({ ...p, garde }))} /></div>
    <div className="field field-full"><label htmlFor="acte-motif">Motif de l'annulation</label>
      <textarea id="acte-motif" required maxLength={2000} rows={3} value={form.motif} onChange={e => setForm(p => ({ ...p, motif: e.target.value }))} />
    </div>
  </DialogueActe>;
}

/* Ajouter une note au journal : datée, signée, définitive. */
export function NoteDialog({ entree, data, onFermer, onValider }) {
  const [form, setForm] = useState({ garde: "", texte: "" });
  return <DialogueActe titre="Ajouter une note" entree={entree} onFermer={onFermer} libelleValider="Ajouter la note"
    onValider={() => onValider({ garde: signataire(data, form.garde), texte: form.texte, attendu: attendu(entree) })}>
    <div className="field"><label htmlFor="acte-garde">Garde signataire</label><ChampSignataire id="acte-garde" data={data} value={form.garde} onChange={garde => setForm(p => ({ ...p, garde }))} /></div>
    <div className="field field-full"><label htmlFor="acte-note">Note</label>
      <textarea id="acte-note" required maxLength={2000} rows={4} value={form.texte} placeholder="Visite, incident, restitution d'objets…" onChange={e => setForm(p => ({ ...p, texte: e.target.value }))} />
      <small className="acte-aide">Une note ne se modifie ni ne s'efface.</small>
    </div>
  </DialogueActe>;
}

const TYPES_JOURNAL = { sortie: "Sortie", annulation: "Sortie annulée", note: "Note" };

/* Résumé d'un événement de sortie : issue, destination, personne, date. */
export function resumeEvenement(e) {
  if (e.type !== "sortie" && e.type !== "annulation") return "";
  const parties = [];
  if (e.libelle || e.issue) parties.push(e.libelle || e.issue);
  if (e.destination) parties.push(e.destination);
  if (e.remisA) parties.push(`remis à ${e.remisA}`);
  return parties.join(" · ");
}

/*
  Journal d'une incarcération, du plus ancien au plus récent. `Nom` rend un
  nom de garde (NomEffectif dans l'application).
*/
export function JournalPrison({ journal, Nom = ({ nom }) => nom }) {
  const liste = Array.isArray(journal) ? journal : [];
  if (!liste.length) return <span className="registre-vide">—</span>;
  return <ol className="journal-prison">
    {liste.map((e, i) => {
      const resume = resumeEvenement(e);
      return <li key={i} className={`journal-evt journal-evt-${e.type || "autre"}`}>
        <div className="journal-entete">
          <span className="journal-type">{TYPES_JOURNAL[e.type] || e.type || "Événement"}</span>
          {e.quand && <span className="journal-quand"><DateRP value={e.quand} jour={false} /></span>}
          {e.qui && <span className="journal-qui"><Nom nom={e.qui} /></span>}
        </div>
        {resume && <div className="journal-resume">{resume}{e.type === "sortie" && e.date ? <> · le <DateRP value={e.date} jour={false} /></> : null}</div>}
        {e.texte && <div className="journal-texte">{e.texte}</div>}
      </li>;
    })}
  </ol>;
}

/* Bloc de l'acte de sortie en cours : qui, quand, à qui, pourquoi. */
export function ResumeSortie({ sortie, Nom = ({ nom }) => nom }) {
  if (!sortie) return null;
  return <dl className="sortie-resume">
    <div><dt>Issue</dt><dd>{sortie.libelle}</dd></div>
    {sortie.destination && <div><dt>Destination</dt><dd>{sortie.destination}</dd></div>}
    {sortie.remisA && <div><dt>Remis à</dt><dd>{sortie.remisA}</dd></div>}
    {sortie.date && <div><dt>Le</dt><dd><DateRP value={sortie.date} jour={false} /></dd></div>}
    {sortie.garde && <div><dt>Par</dt><dd><Nom nom={sortie.garde} /></dd></div>}
    {sortie.motif && <div className="sortie-motif"><dt>Motif</dt><dd>{sortie.motif}</dd></div>}
  </dl>;
}
