// Comptes individuels (décision du propriétaire, 10 novembre 2026) :
// - `ActivationCompte` : écran ouvert par le lien d'invitation (`?invitation=`),
//   où le membre choisit son mot de passe et entre aussitôt ;
// - `AccesCompte` : bloc « Connexion » de la fiche d'un membre, page Effectifs,
//   où un officier remet un lien ou retire le compte ;
// - `MotDePasseDialog` : changement de mot de passe par le titulaire.
// Le serveur (`Comptes.js`, `Auth.js`) reste seul juge des droits.

import { verifierMotDePasse, decrireCompte, formatDateCompte, libelleHistoriqueCompte, MOT_DE_PASSE_MIN } from "./compte.js";
import { libelleCorps, libelleGrade } from "./corps.js";
import { CadreConnexion, RegistreIcon } from "./navigation.jsx";

const { useEffect, useId, useRef, useState } = React;

export function ActivationCompte({ jeton, serverCall, onActive, onAbandon }) {
  const [fiche, setFiche] = useState(null);
  const [erreur, setErreur] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const idMdp = useId();
  const idConfirmation = useId();

  useEffect(() => {
    let vivant = true;
    serverCall("lireInvitationCompte", jeton)
      .then(f => { if (vivant) setFiche(f); })
      .catch(e => { if (vivant) setErreur(e.message); });
    return () => { vivant = false; };
  }, [jeton]);

  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    const message = verifierMotDePasse(motDePasse, confirmation);
    if (message) { setErreur(message); return; }
    pending.current = true;
    setBusy(true);
    setErreur("");
    try {
      onActive(await serverCall("activerCompte", jeton, motDePasse));
    } catch (e) {
      setErreur(e.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const invalide = !fiche && erreur;

  return <CadreConnexion eyebrow="Compte personnel" titre="Choisir son mot de passe">
    <form className="connexion-formulaire" onSubmit={submit}>
      {fiche && <p>Bienvenue, <strong>{fiche.nom}</strong>, {libelleGrade(fiche.grade, fiche.corps)}{fiche.corps ? ` — ${libelleCorps(fiche.corps)}` : ""}.{" "}
        {fiche.dejaActif ? "Ce lien remplace votre mot de passe actuel. " : ""}
        Vous vous connecterez ensuite avec votre nom, « {fiche.nom} », et ce mot de passe. Il n’est connu que de vous : un officier ne peut que vous remettre un nouveau lien.</p>}
      {!fiche && !erreur && <p className="login-statut" role="status">Lecture du lien…</p>}
      {invalide && <p>{erreur}</p>}
      {fiche && <>
        <label htmlFor={idMdp}>Mot de passe</label>
        <input id={idMdp} type="password" autoComplete="new-password" required minLength={MOT_DE_PASSE_MIN} disabled={busy} placeholder={`Au moins ${MOT_DE_PASSE_MIN} caractères`} value={motDePasse} onChange={e => setMotDePasse(e.target.value)} aria-describedby={erreur ? "activation-error" : undefined}/>
        <label htmlFor={idConfirmation}>Confirmer le mot de passe</label>
        <input id={idConfirmation} type="password" autoComplete="new-password" required disabled={busy} placeholder="La même saisie" value={confirmation} onChange={e => setConfirmation(e.target.value)}/>
        <button className="primary-button" disabled={busy}>{busy ? "Enregistrement…" : "Choisir ce mot de passe et entrer"}<span aria-hidden="true">→</span></button>
        {erreur && <div id="activation-error" className="error" role="alert">{erreur}</div>}
        <small className="login-aide">Lien valable jusqu’au {formatDateCompte(fiche.expire)}, pour une seule activation. Sur un ordinateur partagé, pensez à vous déconnecter.</small>
      </>}
      <div className="login-public"><button type="button" className="secondary-button" disabled={busy} onClick={onAbandon}>Retour à la connexion <span aria-hidden="true">→</span></button></div>
      <div className="login-footnote"><RegistreIcon name="shield"/>Réservé aux membres de la Garde de Blancherive.</div>
    </form>
  </CadreConnexion>;
}

// Statut normalisé : seule une fiche en service actif reçoit un lien (le serveur le vérifie aussi).
function enServiceActif(status) {
  return String(status || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") === "en service actif";
}

export function AccesCompte({ member, token, serverCall, onCompte, peutLien = true }) {
  const [lien, setLien] = useState(null);
  const [erreur, setErreur] = useState("");
  const [busy, setBusy] = useState(false);
  const [copie, setCopie] = useState(false);
  const champ = useRef(null);
  const acces = enServiceActif(member.status);
  const description = decrireCompte(member.compte, acces && peutLien);

  if (!description.etiquette) return null;

  async function genererLien() {
    setBusy(true); setErreur(""); setCopie(false);
    try {
      const reponse = await serverCall("creerInvitationCompte", token, member.memberId);
      setLien(reponse);
      onCompte(member.memberId, reponse.compte);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function retirer() {
    if (!confirm(`Retirer le compte de ${member.nomComplet} ?\n\nSon mot de passe est effacé et sa session fermée. Un nouveau lien recréera le compte.`)) return;
    setBusy(true); setErreur("");
    try {
      const reponse = await serverCall("supprimerCompte", token, member.memberId);
      setLien(null);
      onCompte(member.memberId, reponse.compte);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(lien.url);
      setCopie(true);
    } catch {
      champ.current?.select();
    }
  }

  return <div className="acces-compte">
    <div className="acces-compte-etat">
      <span className={`effectif-badge ${description.classe}`}>{description.etiquette}</span>
      {description.detail && <small>{description.detail}</small>}
    </div>
    <div className="acces-compte-actions">
      {description.lien && <button type="button" className="secondary-button" disabled={busy} onClick={genererLien}>{busy ? "…" : description.lien}</button>}
      {description.retrait && <button type="button" className="danger-button" disabled={busy} onClick={retirer}>Retirer le compte</button>}
    </div>
    {lien && <div className="lien-invitation" role="status">
      <p>Lien à remettre à <strong>{lien.nom}</strong>, et à personne d’autre : valable jusqu’au {formatDateCompte(lien.expire)}, pour une seule activation. Il n’est pas conservé ; en cas de perte, générez-en un autre.</p>
      <div className="lien-invitation-champ">
        <input ref={champ} readOnly value={lien.url} aria-label="Lien de connexion" onFocus={e => e.target.select()}/>
        <button type="button" className="secondary-button" onClick={copier}>{copie ? "Copié" : "Copier"}</button>
      </div>
    </div>}
    {erreur && <div className="error" role="alert">{erreur}</div>}
    {member.compte?.historique?.length > 0 && <details className="acces-compte-historique">
      <summary>Historique du compte</summary>
      <ul>{member.compte.historique.map((e, i) => <li key={i}>{libelleHistoriqueCompte(e)}</li>)}</ul>
    </details>}
  </div>;
}

export function MotDePasseDialog({ token, serverCall, onJeton, onFermer }) {
  const [ancien, setAncien] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState("");
  const [busy, setBusy] = useState(false);
  const id = useId();

  useEffect(() => {
    const touche = e => { if (e.key === "Escape") onFermer(); };
    document.addEventListener("keydown", touche);
    return () => document.removeEventListener("keydown", touche);
  }, [onFermer]);

  async function submit(event) {
    event.preventDefault();
    const message = verifierMotDePasse(nouveau, confirmation);
    if (message) { setErreur(message); return; }
    setBusy(true); setErreur("");
    try {
      onJeton(await serverCall("changerMotDePasseCompte", token, ancien, nouveau));
    } catch (e) {
      setErreur(e.message);
      setBusy(false);
    }
  }

  return <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onFermer(); }}>
    <form className="law-modal acte-dialogue mdp-dialogue" role="dialog" aria-modal="true" aria-labelledby={`${id}-titre`} onSubmit={submit}>
      <div className="law-modal-header acte-entete">
        <div><h2 id={`${id}-titre`}>Changer mon mot de passe</h2><p className="acte-sujet">Vos autres sessions seront fermées.</p></div>
        <button type="button" className="law-modal-close" aria-label="Fermer" onClick={onFermer}>×</button>
      </div>
      <div className="law-modal-body">
        <div className="field"><label htmlFor={`${id}-ancien`}>Mot de passe actuel</label><input id={`${id}-ancien`} type="password" autoComplete="current-password" required disabled={busy} value={ancien} onChange={e => setAncien(e.target.value)}/></div>
        <div className="field"><label htmlFor={`${id}-nouveau`}>Nouveau mot de passe</label><input id={`${id}-nouveau`} type="password" autoComplete="new-password" required minLength={MOT_DE_PASSE_MIN} disabled={busy} placeholder={`Au moins ${MOT_DE_PASSE_MIN} caractères`} value={nouveau} onChange={e => setNouveau(e.target.value)}/></div>
        <div className="field"><label htmlFor={`${id}-confirmation`}>Confirmer le nouveau mot de passe</label><input id={`${id}-confirmation`} type="password" autoComplete="new-password" required disabled={busy} value={confirmation} onChange={e => setConfirmation(e.target.value)}/></div>
        {erreur && <div className="error" role="alert">{erreur}</div>}
        <div className="form-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onFermer}>Annuler</button><button className="primary-button" disabled={busy}>{busy ? "Enregistrement…" : "Changer le mot de passe"}</button></div>
      </div>
    </form>
  </div>;
}
