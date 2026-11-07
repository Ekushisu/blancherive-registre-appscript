import { DateRP } from './calendrier.jsx';

const { useEffect, useMemo, useState } = React;

// Page Permis de chasse : qui a le droit de chasser sur les terres de la
// châtellerie. GARDE et OFFICIER délivrent ; seul l'OFFICIER révoque. Un permis
// vaut à vie : la page n'affiche ni échéance ni renouvellement. INTENDANT et le
// visiteur public n'y accèdent pas — la navigation et le routage les excluent,
// et le serveur refuse leur rôle.

export const LIMITES_PERMIS = { prenom: 60, nom: 80 };

function normaliserTexte(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function nomTitulaire(permis) {
  return [permis.prenom, permis.nom].filter(Boolean).join(' ');
}

/*
  Recherche par prénom, le nom compris : « sven » trouve Sven Fer-Froid, et
  « fer » le trouve aussi. Chaque mot tapé doit se retrouver, sans casse ni
  accents.
*/
export function filtrerPermis(permis, recherche) {
  const termes = normaliserTexte(recherche).trim().split(/\s+/).filter(Boolean);
  return permis.filter(p => termes.every(t => normaliserTexte(`${p.prenom} ${p.nom}`).includes(t)));
}

// Date du jour en calendrier réel, `yyyy-MM-dd`, pour le champ de saisie.
export function dateDuJour(maintenant = new Date()) {
  const deux = n => String(n).padStart(2, '0');
  return `${maintenant.getFullYear()}-${deux(maintenant.getMonth() + 1)}-${deux(maintenant.getDate())}`;
}

/*
  Contrôle du formulaire avant l'envoi : mêmes règles que le serveur, pour un
  message immédiat. Le serveur revalide tout.
*/
export function validerPermis(form, aujourdhui = dateDuJour()) {
  const prenom = String(form.prenom || '').replace(/ /g, ' ').trim().replace(/\s+/g, ' ');
  const nom = String(form.nom || '').replace(/ /g, ' ').trim().replace(/\s+/g, ' ');
  const date = String(form.date || '').trim();
  if (!prenom) throw new Error('Indiquez le prénom du titulaire.');
  if (prenom.length > LIMITES_PERMIS.prenom) throw new Error(`Le prénom ne peut dépasser ${LIMITES_PERMIS.prenom} caractères.`);
  if (nom.length > LIMITES_PERMIS.nom) throw new Error(`Le nom ne peut dépasser ${LIMITES_PERMIS.nom} caractères.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Indiquez la date de délivrance.');
  if (date > aujourdhui) throw new Error('La date de délivrance ne peut pas être dans l’avenir.');
  return { prenom, nom, date };
}

const pluriel = (n, singulier, plurielForme) => `${n.toLocaleString('fr-FR')} ${n > 1 ? plurielForme : singulier}`;

export function PermisChassePage({ token, canRevoquer, serverCall }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [formOuvert, setFormOuvert] = useState(false);
  const [revocation, setRevocation] = useState(null);

  useEffect(() => { serverCall('getPermisChasse', token).then(setData).catch(e => setError(e.message)); }, []);

  const visibles = useMemo(() => data ? filtrerPermis(data.permis, recherche) : [], [data, recherche]);

  if (error && !data) return <div className="error">Erreur de chargement des permis de chasse : {error}</div>;
  if (!data) return <div className="loading">Chargement des permis de chasse...</div>;

  async function delivrer(permis) {
    if (busy) return false;
    setBusy(true); setError('');
    try { setData(await serverCall('ajouterPermisChasse', token, permis)); return true; }
    catch (e) { setError(e.message); return false; }
    finally { setBusy(false); }
  }

  async function revoquer(p) {
    if (!canRevoquer || busy) return;
    if (!confirm(`Révoquer le permis de chasse de ${nomTitulaire(p)} ?\n\nLa ligne sera retirée du registre.`)) return;
    setRevocation(p.row); setError('');
    try { setData(await serverCall('revoquerPermisChasse', token, p.row, { prenom: p.prenom, nom: p.nom, date: p.date })); }
    catch (e) { setError(e.message); }
    finally { setRevocation(null); }
  }

  return <>
    <div className="page-header">
      <div><h1 className="page-title">Permis de chasse</h1><p className="page-subtitle">Qui a le droit de chasser sur les terres de la châtellerie. Un permis vaut à vie, jusqu’à sa révocation.</p></div>
      <button type="button" className="primary-button" disabled={busy} onClick={() => setFormOuvert(!formOuvert)}>{formOuvert ? 'Fermer' : '+ Nouveau permis'}</button>
    </div>
    {!canRevoquer && <div className="readonly-notice">🔒 Les gardes délivrent les permis ; seul un officier peut en révoquer un.</div>}
    {error && <div className="error" role="alert">{error}</div>}

    {formOuvert && <PermisForm busy={busy} onCancel={() => setFormOuvert(false)} onSubmit={async permis => { if (await delivrer(permis)) setFormOuvert(false); }}/>}

    <div className="permis-filtres">
      <label htmlFor="permis-recherche">Rechercher un titulaire</label>
      <input id="permis-recherche" type="search" placeholder="Prénom…" value={recherche} onChange={e => setRecherche(e.target.value)}/>
      <span className="permis-compte" role="status">{visibles.length ? pluriel(visibles.length, 'permis', 'permis') : 'Aucun permis'}</span>
    </div>

    {visibles.length === 0
      ? <p className="permis-vide">{data.permis.length ? 'Aucun permis ne correspond à la recherche.' : 'Aucun permis de chasse enregistré. Délivrez le premier depuis « Nouveau permis ».'}</p>
      : <div className="registry"><div className="registry-table-wrap"><table className="registry-table permis-table">
        <thead><tr><th>Titulaire</th><th>Date de délivrance</th>{canRevoquer && <th>Actions</th>}</tr></thead>
        <tbody>{visibles.map(p => <tr key={p.row}>
          <td data-label="Titulaire"><span className="permis-titulaire"><strong>{p.prenom}</strong>{p.nom ? ` ${p.nom}` : ''}</span></td>
          <td data-label="Délivré le"><DateRP value={p.date} jour={false}/></td>
          {canRevoquer && <td data-label="Actions"><button type="button" className="danger-button" disabled={busy || revocation === p.row} onClick={() => revoquer(p)}>{revocation === p.row ? '…' : 'Révoquer'}</button></td>}
        </tr>)}</tbody>
      </table></div></div>}
  </>;
}

export function PermisForm({ busy, onSubmit, onCancel }) {
  const [form, setForm] = useState({ prenom: '', nom: '', date: dateDuJour() });
  const [erreur, setErreur] = useState('');
  const champ = (cle, valeur) => { setForm(precedent => ({ ...precedent, [cle]: valeur })); setErreur(''); };
  return <form className="form-card" onSubmit={e => {
    e.preventDefault();
    if (busy) return;
    try { onSubmit(validerPermis(form)); } catch (x) { setErreur(x.message); }
  }}>
    <fieldset className="form-fieldset" disabled={busy}>
      <h2>Nouveau permis de chasse</h2>
      <div className="form-grid">
        <div className="field"><label htmlFor="permis-prenom">Prénom</label><input id="permis-prenom" required maxLength={LIMITES_PERMIS.prenom} value={form.prenom} onChange={e => champ('prenom', e.target.value)} placeholder="Sven" autoFocus/></div>
        <div className="field"><label htmlFor="permis-nom">Nom <small>(facultatif)</small></label><input id="permis-nom" maxLength={LIMITES_PERMIS.nom} value={form.nom} onChange={e => champ('nom', e.target.value)} placeholder="Fer-Froid"/></div>
        <div className="field"><label htmlFor="permis-date">Date de délivrance</label><input id="permis-date" type="date" required max={dateDuJour()} value={form.date} onChange={e => champ('date', e.target.value)}/></div>
      </div>
      {erreur && <div className="error" role="alert">{erreur}</div>}
      <div className="form-actions">
        <button type="submit" className="primary-button">{busy ? 'Enregistrement…' : 'Délivrer le permis'}</button>
        <button type="button" className="secondary-button" onClick={onCancel}>Annuler</button>
      </div>
      <p className="saisie-help">Une même personne n’a qu’un permis : un second enregistrement au même prénom et nom est refusé. Deux homonymes se distinguent par leur nom.</p>
    </fieldset>
  </form>;
}
