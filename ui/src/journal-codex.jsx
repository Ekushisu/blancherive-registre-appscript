// Nouveautés du Codex (décision du propriétaire, 1er novembre 2026) : prévenir
// tous ceux qui consultent le Codex, visiteurs compris, des lois nouvelles,
// modifiées ou retirées à chaque synchronisation. Le journal arrive avec le
// Codex (`getCodex`) ; la logique est dans journal-codex.js.

import { DateRP } from "./calendrier.jsx";
import { articleParCle } from "./codex.js";
import {
  changementsLecteur, delaiBoutonRestant, depuis, diffMots, phraseResume, resumerSynchros, totalResume
} from "./journal-codex.js";

const { useEffect, useRef, useState } = React;

const CHAMPS = { titre: "Titre", classification: "Qualification", sanction: "Sanction", texte: "Texte" };
const GROUPES = [
  ["ajout", "Nouvelles lois"],
  ["modification", "Lois modifiées"],
  ["retrait", "Lois retirées"],
  ["document", "Documents"]
];

// Bandeau en tête du Codex : ce qui a changé depuis la dernière visite.
export function BandeauNouveautesCodex({ synchros, onVoir }) {
  const resume = resumerSynchros(synchros);
  if (!totalResume(resume)) return null;
  return <div className="codex-nouveautes-bandeau" role="status">
    <span><strong>Le Codex a changé</strong> depuis votre dernière visite : {phraseResume(resume)}.</span>
    <button type="button" className="primary-button" onClick={onVoir}>Voir les changements</button>
  </div>;
}

function sigle(codex, source) {
  return codex?.sources?.find(s => s.nom === source)?.abrege || source;
}

function DiffTexte({ avant, apres }) {
  const segments = diffMots(avant, apres);
  if (!segments) {
    return <div className="journal-diff">
      <p><strong>Avant</strong></p><p className="journal-avant">{avant}</p>
      <p><strong>Après</strong></p><p className="journal-apres">{apres}</p>
    </div>;
  }
  return <p className="journal-diff">{segments.map((s, i) =>
    s.type === "ajout" ? <ins key={i}>{s.texte}</ins> : s.type === "retrait" ? <del key={i}>{s.texte}</del> : <span key={i}>{s.texte}</span>
  )}</p>;
}

function Entree({ changement: c, codex, onOuvrirArticle }) {
  const article = c.article ? articleParCle(codex, c.source, c.article) : null;
  const libelle = <>{sigle(codex, c.source)}{c.article ? ` · art. ${c.article}` : ""}{c.titre ? ` — ${c.titre}` : ""}</>;
  const lire = article && <button type="button" className="secondary-button journal-lire" onClick={() => onOuvrirArticle(article)}>Lire l’article</button>;

  if (c.type === "document-ajout" || c.type === "document-retrait") {
    return <li className={`journal-entree journal-${c.type}`}>
      <span>{c.type === "document-ajout" ? "Document ajouté" : "Document retiré"} : <strong>{c.source}</strong></span>
      {c.type === "document-retrait" && <small>Ses articles ne sont plus en vigueur.</small>}
    </li>;
  }
  if (c.type === "ajout") {
    return <li className="journal-entree journal-ajout">
      <span>{libelle}{c.apres?.classification ? <small> · {c.apres.classification}</small> : null}</span>{lire}
    </li>;
  }
  if (c.type === "modification") {
    return <li className="journal-entree journal-modification">
      <details>
        <summary>{libelle} <small>· {c.champs.map(champ => CHAMPS[champ] || champ).join(", ").toLowerCase()} modifié{c.champs.length > 1 ? "s" : ""}</small></summary>
        {c.champs.filter(champ => champ !== "texte").map(champ =>
          <p key={champ} className="journal-champ"><strong>{CHAMPS[champ] || champ} :</strong> <del>{c.avant?.[champ] || "—"}</del> → <ins>{c.apres?.[champ] || "—"}</ins></p>)}
        {c.champs.includes("texte") && <DiffTexte avant={c.avant?.texte} apres={c.apres?.texte} />}
        {lire}
      </details>
    </li>;
  }
  // Retrait : l'ancien texte reste lisible ici, faute d'article au Codex.
  return <li className="journal-entree journal-retrait">
    <details>
      <summary>{libelle}</summary>
      {c.avant?.sanction && <p className="journal-champ"><strong>Sanction :</strong> {c.avant.sanction}</p>}
      <p className="journal-avant">{c.avant?.texte || "Texte non conservé."}{c.avant?.tronque ? " (texte tronqué)" : ""}</p>
    </details>
  </li>;
}

// Compte rendu technique d'un passage, pour les officiers.
function RapportTechnique({ synchro }) {
  const illisibles = (synchro.changements || []).filter(c => c.type === "document-illisible");
  return <details className="journal-rapport">
    <summary>Compte rendu technique</summary>
    <p>
      {synchro.origine === "registre" ? "Lancée depuis le registre" : synchro.origine === "editeur" ? "Lancée depuis l’éditeur Apps Script" : "Origine non notée"}
      {typeof synchro.duree === "number" ? ` · ${(synchro.duree / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} s` : ""}
      {typeof synchro.articles === "number" ? ` · ${synchro.articles} articles` : ""}
      {typeof synchro.documents === "number" ? ` · ${synchro.documents} documents` : ""}
    </p>
    {synchro.parDocument?.length > 0 && <table className="journal-documents">
      <thead><tr><th>Document</th><th>Articles</th><th>Alertes de lecture</th></tr></thead>
      <tbody>{synchro.parDocument.map(d => <tr key={d.source} className={d.illisible ? "journal-illisible" : ""}>
        <td>{d.source}{d.illisible ? ` — illisible : ${d.erreur || "erreur inconnue"} (articles précédents conservés)` : ""}</td>
        <td>{d.articles}</td><td>{d.alertes || ""}</td>
      </tr>)}</tbody>
    </table>}
    {!synchro.parDocument?.length && illisibles.map(c => <p key={c.source} className="journal-illisible">{c.source} illisible : {c.apres?.message}</p>)}
    {synchro.erreurs?.length > 0 && !synchro.parDocument?.length && <ul>{synchro.erreurs.map((e, i) => <li key={i}>{e}</li>)}</ul>}
  </details>;
}

function Synchro({ synchro, codex, ouverte, officier, onOuvrirArticle }) {
  const changements = changementsLecteur(synchro);
  const resume = resumerSynchros([synchro]);
  const groupe = c => (c.type.startsWith("document") ? "document" : c.type);
  return <section className="journal-synchro">
    <details open={ouverte || undefined}>
      <summary>
        <span className="journal-date"><DateRP value={synchro.date} /></span>
        <span className="journal-resume">{totalResume(resume) ? phraseResume(resume) : "Aucun changement"}</span>
      </summary>
      {GROUPES.map(([cle, titre]) => {
        const liste = changements.filter(c => groupe(c) === cle);
        return liste.length > 0 && <div key={cle} className="journal-groupe">
          <h3>{titre} <span>{liste.length}</span></h3>
          <ul>{liste.map((c, i) => <Entree key={`${c.type}-${c.source}-${c.article}-${i}`} changement={c} codex={codex} onOuvrirArticle={onOuvrirArticle} />)}</ul>
        </div>;
      })}
      {synchro.tronque && <p className="journal-note">Changements trop nombreux : seuls les premiers sont détaillés ici.</p>}
      {officier && <RapportTechnique synchro={synchro} />}
    </details>
  </section>;
}

// Bouton des officiers : délai de trois minutes, compté ici pour l'affichage, imposé par le serveur.
function BoutonSynchroniser({ journal, dernierClic, enCours, onLancer }) {
  const [maintenant, setMaintenant] = useState(Date.now());
  const restant = delaiBoutonRestant(journal, dernierClic, maintenant);

  useEffect(() => {
    if (!restant) return undefined;
    const minuteur = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(minuteur);
  }, [restant > 0]);

  const secondes = Math.ceil(restant / 1000);
  return <div className="journal-synchroniser">
    <button type="button" className="primary-button" disabled={enCours || restant > 0} onClick={onLancer}>
      {enCours ? "Synchronisation en cours…" : "Synchroniser maintenant"}
    </button>
    {!enCours && restant > 0 && <small>Nouvelle synchronisation possible dans {secondes >= 60 ? `${Math.floor(secondes / 60)} min ${secondes % 60} s` : `${secondes} s`}.</small>}
  </div>;
}

export const INTERVALLE_PROGRESSION = 2000;

/*
  Fenêtre d'une synchronisation lancée du registre : les traces du serveur
  s'affichent au fil de l'eau (`getProgressionSynchroCodex`, relu toutes les
  deux secondes sous l'identifiant de suivi tiré ici), puis le résultat. Elle
  ne se ferme pas seule : l'officier lit le compte rendu, puis ferme.
*/
export function nouveauSuivi() {
  return `s${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function LigneTrace({ ligne }) {
  const secondes = typeof ligne.ms === "number" ? `${(ligne.ms / 1000).toFixed(1)} s` : "";
  return <li className={`synchro-trace synchro-trace-${ligne.niveau || "info"}`}><span>{secondes}</span><span>{ligne.texte}</span></li>;
}

export function SynchroCodexModal({ serverCall, token, onTermine, onClose }) {
  const [etat, setEtat] = useState({ statut: "encours", lignes: [], resultat: null, erreur: "" });
  const liste = useRef(null);
  const suivi = useRef(nouveauSuivi());
  const fermerRef = useRef(onClose);
  fermerRef.current = onClose;

  useEffect(() => {
    let vivant = true;
    const id = suivi.current;
    const minuteur = setInterval(() => {
      serverCall("getProgressionSynchroCodex", token, id)
        .then(p => { if (vivant && p?.lignes?.length) setEtat(e => (e.statut === "encours" ? { ...e, lignes: p.lignes } : e)); })
        .catch(() => {});
    }, INTERVALLE_PROGRESSION);
    serverCall("synchroniserCodexRegistre", token, id)
      .then(r => { if (!vivant) return; setEtat({ statut: "fait", lignes: r.traces || [], resultat: r, erreur: "" }); onTermine?.(r); })
      .catch(e => { if (vivant) setEtat(etatPrecedent => ({ ...etatPrecedent, statut: "erreur", erreur: e.message })); })
      .finally(() => clearInterval(minuteur));
    return () => { vivant = false; clearInterval(minuteur); };
  }, []);

  // Les nouvelles lignes restent en vue ; Échap ferme, sauf pendant le passage.
  useEffect(() => { liste.current?.scrollTo?.(0, liste.current.scrollHeight); }, [etat.lignes.length]);
  useEffect(() => {
    function touches(event) {
      if (event.key === "Escape" && etat.statut !== "encours") { event.preventDefault(); fermerRef.current(); }
    }
    document.addEventListener("keydown", touches);
    return () => document.removeEventListener("keydown", touches);
  }, [etat.statut]);

  const r = etat.resultat;
  const resume = r && { ajouts: r.changements.ajouts, modifications: r.changements.modifications, retraits: r.changements.retraits,
    documents: r.changements.documentsAjoutes + r.changements.documentsRetires };
  return <div className="modal-backdrop synchro-fond" onMouseDown={event => { if (event.target === event.currentTarget && etat.statut !== "encours") onClose(); }}>
    <div className="law-modal synchro-codex" role="dialog" aria-modal="true" aria-labelledby="synchro-codex-titre">
      <div className="law-modal-header">
        <div>
          <div className="law-modal-number">Codex & Droit impérial</div>
          <h2 id="synchro-codex-titre" className="law-modal-title">Synchronisation du Codex</h2>
          <p className="journal-derniere" role="status">
            {etat.statut === "encours" && "En cours : lecture des documents Google, jusqu’à une minute…"}
            {etat.statut === "fait" && `Terminée en ${(r.duree / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} s : ${totalResume(resume) ? phraseResume(resume) : "aucun changement"}.${r.erreurs?.length ? ` ${r.erreurs.length} document(s) illisible(s), articles précédents conservés.` : ""}`}
            {etat.statut === "erreur" && "Interrompue."}
          </p>
        </div>
        <button type="button" aria-label="Fermer" className="law-modal-close" disabled={etat.statut === "encours"} onClick={onClose}>×</button>
      </div>
      <div className="law-modal-body">
        {etat.erreur && <p className="error" role="alert">{etat.erreur}</p>}
        <ol className="synchro-traces" ref={liste} aria-live="polite" aria-label="Journal de la synchronisation">
          {etat.lignes.map((ligne, i) => <LigneTrace key={i} ligne={ligne} />)}
          {etat.statut === "encours" && !etat.lignes.length && <li className="synchro-trace synchro-trace-info"><span /><span>Demande envoyée, en attente du serveur…</span></li>}
        </ol>
        {etat.statut !== "encours" && <div className="form-actions"><button type="button" className="primary-button" onClick={onClose}>Fermer</button></div>}
      </div>
    </div>
  </div>;
}

export function JournalCodexModal({ codex, onClose, onOuvrirArticle, officier = false, onSynchroniser = null }) {
  const dialogue = useRef(null);
  const fermerRef = useRef(onClose);
  fermerRef.current = onClose;
  const journal = codex?.journal || [];
  const dernier = journal[0];

  // Comme la modale du Codex : page figée, Échap pour fermer.
  useEffect(() => {
    const precedent = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogue.current?.focus();
    function touches(event) {
      if (event.key === "Escape") { event.preventDefault(); fermerRef.current(); }
    }
    document.addEventListener("keydown", touches);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", touches); precedent?.focus?.(); };
  }, []);

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="law-modal journal-codex" role="dialog" aria-modal="true" aria-labelledby="journal-codex-titre" tabIndex={-1} ref={dialogue}>
      <div className="law-modal-header">
        <div>
          <div className="law-modal-number">Codex & Droit impérial</div>
          <h2 id="journal-codex-titre" className="law-modal-title">Nouveautés du Codex</h2>
          <p className="journal-derniere">
            {dernier
              ? <>Dernière synchronisation : <DateRP value={dernier.date} /> ({depuis(dernier.date)})</>
              : "Aucune synchronisation n’a encore été notée."}
          </p>
        </div>
        <button type="button" aria-label="Fermer les nouveautés" className="law-modal-close" onClick={onClose}>×</button>
      </div>
      <div className="law-modal-body">
        {officier && onSynchroniser && <BoutonSynchroniser journal={journal} onLancer={onSynchroniser} />}
        {journal.length
          ? journal.map((synchro, i) => <Synchro key={synchro.date} synchro={synchro} codex={codex} ouverte={i === 0} officier={officier} onOuvrirArticle={onOuvrirArticle} />)
          : <p className="journal-note">Les changements apparaîtront ici après la prochaine synchronisation.</p>}
      </div>
    </div>
  </div>;
}
