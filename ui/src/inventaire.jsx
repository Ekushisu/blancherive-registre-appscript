import { SaisiesField } from './saisies.jsx';
import { useCatalogue } from './catalogue.js';

const { useEffect, useMemo, useRef, useState } = React;

// Page Inventaire : ce que contiennent les coffres de Fort-Dragon.
// OFFICIER range, retire et déplace ; INTENDANT consulte. Le GARDE n'y accède
// pas — la navigation et le routage l'excluent, et le serveur refuse son rôle.

const LIMITES_COFFRE = { nom: 100, position: 200, description: 1000 };
// Pause après le dernier clic sur + / − avant d'envoyer la variation cumulée.
export const SEUIL_AJUSTEMENT_MS = 600;
const COFFRE_INCONNU = 'Coffre inconnu';

function normaliserTexte(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const nombre = value => Number(value || 0).toLocaleString('fr-FR');

const pluriel = (n, singulier, plurielForme) => `${nombre(n)} ${n > 1 ? plurielForme : singulier}`;

/*
  Une ligne dont le coffre a été effacé de la feuille reste visible, sous un
  coffre « inconnu » qui porte l'identifiant orphelin : le stock existe, et
  l'officier doit pouvoir le déplacer vers un coffre réel.
*/
export function coffresAffiches(data) {
  const connus = new Set(data.coffres.map(c => c.id));
  const orphelins = new Map();
  data.objets.forEach(o => {
    if (connus.has(o.coffreId)) return;
    const stats = orphelins.get(o.coffreId) || { id: o.coffreId, nom: COFFRE_INCONNU, position: `Identifiant ${o.coffreId}`, description: '', nbObjets: 0, total: 0, inconnu: true };
    stats.nbObjets += 1; stats.total += o.quantite;
    orphelins.set(o.coffreId, stats);
  });
  return [...data.coffres, ...orphelins.values()];
}

export function filtrerObjets(objets, coffreId, recherche) {
  const termes = normaliserTexte(recherche).trim().split(/\s+/).filter(Boolean);
  return objets.filter(o => (!coffreId || o.coffreId === coffreId) &&
    termes.every(t => normaliserTexte(`${o.nom} ${o.id}`).includes(t)));
}

export function InventairePage({ token, canEdit, serverCall }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [coffreFiltre, setCoffreFiltre] = useState('');
  const [recherche, setRecherche] = useState('');
  const [formCoffre, setFormCoffre] = useState(null);
  const [coffreAjout, setCoffreAjout] = useState('');
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  // Liste d'attente du formulaire : les objets s'y accumulent hors ligne, puis
  // partent en une seule requête. `panierEnCours` bloque l'envoi tant qu'une
  // recherche ou une sélection n'a pas été ajoutée ou effacée.
  const [panier, setPanier] = useState([]);
  const [panierEnCours, setPanierEnCours] = useState(false);
  const [panierErreur, setPanierErreur] = useState('');

  /*
    Boutons + / − : les clics sont cumulés par ligne et envoyés en une seule
    requête après une courte pause, pour que « ajouter cinq torches » soit
    cinq clics rapides et non cinq allers-retours serveur attendus un par un.
    `attente` compte les clics pas encore envoyés, `envoye` la variation
    partie au serveur et pas encore confirmée : la quantité affichée est la
    somme des trois, sans retour en arrière pendant l'attente.
  */
  const attente = useRef({}), envoye = useRef({}), minuteries = useRef({});
  const [ajustements, setAjustements] = useState({});
  const refleterAjustements = () => {
    const suivant = {};
    for (const [cle, valeur] of Object.entries(attente.current)) suivant[cle] = (suivant[cle] || 0) + valeur;
    for (const [cle, valeur] of Object.entries(envoye.current)) suivant[cle] = (suivant[cle] || 0) + valeur;
    setAjustements(suivant);
  };
  useEffect(() => () => Object.values(minuteries.current).forEach(clearTimeout), []);

  useEffect(() => { serverCall('getInventaire', token).then(setData).catch(e => setError(e.message)); }, []);
  // Préchargé seulement pour qui peut ranger : l'intendant n'a pas de formulaire.
  const catalogue = useCatalogue(serverCall, token, canEdit);

  const coffres = useMemo(() => data ? coffresAffiches(data) : [], [data]);
  const visibles = useMemo(() => data ? filtrerObjets(data.objets, coffreFiltre, recherche) : [], [data, coffreFiltre, recherche]);
  const totalVisible = visibles.reduce((somme, o) => somme + o.quantite, 0);

  if (error && !data) return <div className="error">Erreur de chargement de l’inventaire : {error}</div>;
  if (!data) return <div className="loading">Chargement de l’inventaire...</div>;

  // Chaque écriture renvoie l'inventaire complet : un seul chemin de mise à jour.
  async function appeler(nom, payload) {
    if (busy) return false;
    setBusy(true); setError('');
    try { setData(await serverCall(nom, token, payload)); return true; }
    catch (e) { setError(e.message); return false; }
    finally { setBusy(false); }
  }

  const objetDe = o => ({ id: o.id, nom: o.nom, libre: o.libre });
  const cleLigne = o => `${o.coffreId}|${o.cle}`;
  const quantiteAffichee = o => o.quantite + (ajustements[cleLigne(o)] || 0);

  function cliquer(o, delta) {
    const cle = cleLigne(o);
    const cumul = (attente.current[cle] || 0) + delta;
    if (o.quantite + (envoye.current[cle] || 0) + cumul < 0) return;
    attente.current[cle] = cumul;
    refleterAjustements();
    clearTimeout(minuteries.current[cle]);
    minuteries.current[cle] = setTimeout(() => envoyer(o, cle), SEUIL_AJUSTEMENT_MS);
  }

  async function envoyer(o, cle) {
    delete minuteries.current[cle];
    // Une requête est déjà partie pour cette ligne : on repasse après elle.
    if (cle in envoye.current) { minuteries.current[cle] = setTimeout(() => envoyer(o, cle), SEUIL_AJUSTEMENT_MS); return; }
    const delta = attente.current[cle] || 0;
    delete attente.current[cle];
    if (!delta) { refleterAjustements(); return; }
    envoye.current[cle] = delta;
    refleterAjustements();
    try { setData(await serverCall('ajusterInventaire', token, { coffreId: o.coffreId, objet: objetDe(o), delta })); setError(''); }
    catch (e) { setError(e.message); }
    finally { delete envoye.current[cle]; refleterAjustements(); }
  }

  async function retirer(o) {
    if (!confirm(`Retirer ${o.nom} × ${nombre(o.quantite)} de l’inventaire ?`)) return;
    await appeler('ajusterInventaire', { coffreId: o.coffreId, objet: objetDe(o), delta: -o.quantite });
  }

  async function enregistrerCoffre(coffre) {
    const ok = await appeler(coffre.id ? 'modifierCoffre' : 'ajouterCoffre', coffre);
    if (ok) setFormCoffre(null);
  }

  const coffreLibelle = id => coffres.find(c => c.id === id)?.nom || COFFRE_INCONNU;
  const coffresReels = data.coffres;
  const panierTotal = panier.reduce((somme, item) => somme + item.quantite, 0);

  async function rangerPanier() {
    if (panierEnCours) { setPanierErreur('Ajoutez l’objet en cours à la liste ou effacez la recherche avant de ranger.'); return; }
    if (!coffreAjout) { setPanierErreur('Sélectionnez le coffre de destination.'); return; }
    if (!panier.length) { setPanierErreur('La liste est vide.'); return; }
    setPanierErreur('');
    const ok = await appeler('rangerInventaire', {
      coffreId: coffreAjout,
      objets: panier.map(item => ({ id: item.id, nom: item.nom, libre: item.libre === true, quantite: item.quantite }))
    });
    if (ok) setPanier([]);
  }

  return <>
    <div className="page-header">
      <div><h1 className="page-title">Inventaire</h1><p className="page-subtitle">Ce que contiennent les coffres de la garde à Fort-Dragon, coffre par coffre.</p></div>
      {canEdit && <button type="button" className="primary-button" disabled={busy} onClick={() => { setFormCoffre(formCoffre && !formCoffre.id ? null : { nom: '', position: '', description: '' }); }}>{formCoffre && !formCoffre.id ? 'Fermer' : '+ Nouveau coffre'}</button>}
    </div>
    {!canEdit && <div className="readonly-notice">🔒 Consultation en lecture seule — seuls les officiers peuvent ranger, retirer ou déplacer des objets.</div>}
    {error && <div className="error" role="alert">{error}</div>}

    {formCoffre && <CoffreForm coffre={formCoffre} busy={busy} onCancel={() => setFormCoffre(null)} onSubmit={enregistrerCoffre}/>}

    {coffres.length === 0
      ? <p className="inventaire-vide">{canEdit ? 'Aucun coffre enregistré. Créez le premier coffre pour commencer l’inventaire.' : 'Aucun coffre enregistré pour le moment.'}</p>
      : <div className="inventaire-coffres" role="group" aria-label="Coffres">
        {coffres.map(c => <article key={c.id} className={`inventaire-coffre${coffreFiltre === c.id ? ' actif' : ''}${c.inconnu ? ' inventaire-coffre-inconnu' : ''}`}>
          <button type="button" className="inventaire-coffre-selection" aria-pressed={coffreFiltre === c.id} onClick={() => setCoffreFiltre(coffreFiltre === c.id ? '' : c.id)}>
            <span className="inventaire-coffre-nom">{c.nom}</span>
            {c.position && <span className="inventaire-coffre-position">{c.position}</span>}
            {c.description && <span className="inventaire-coffre-description">{c.description}</span>}
            <span className="inventaire-coffre-compte">{c.nbObjets ? `${pluriel(c.nbObjets, 'objet', 'objets')} · ${pluriel(c.total, 'exemplaire', 'exemplaires')}` : 'Vide'}</span>
          </button>
          {canEdit && !c.inconnu && <div className="inventaire-coffre-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => setFormCoffre({ id: c.id, nom: c.nom, position: c.position, description: c.description })}>Modifier</button></div>}
        </article>)}
      </div>}

    {canEdit && coffresReels.length > 0 && <div className="form-card inventaire-ajout">
      <div className="inventaire-ajout-entete">
        <h2>Ranger un objet</h2>
        <button type="button" className="secondary-button" onClick={() => setAjoutOuvert(!ajoutOuvert)} aria-expanded={ajoutOuvert}>{ajoutOuvert ? 'Replier' : 'Déplier'}</button>
      </div>
      {ajoutOuvert && <fieldset className="form-fieldset" disabled={busy}>
        <div className="form-grid">
          <div className="field"><label htmlFor="inventaire-coffre-ajout">Coffre</label>
            <select id="inventaire-coffre-ajout" value={coffreAjout} onChange={e => setCoffreAjout(e.target.value)}>
              <option value="">Sélectionner…</option>
              {coffresReels.map(c => <option key={c.id} value={c.id}>{c.nom}{c.position ? ` — ${c.position}` : ''}</option>)}
            </select>
          </div>
          <SaisiesField token={token} value={panier} disabled={busy} serverCall={serverCall} catalogue={catalogue.objets} titre="Objets à ranger"
            aideLibre="Le nom saisi sera conservé dans l’inventaire, sans ajout au catalogue."
            onPendingChange={pending => { setPanierEnCours(pending); setPanierErreur(''); }}
            onChange={items => { setPanier(items); setPanierErreur(''); }}/>
        </div>
        {panierErreur && <div className="error" role="alert">{panierErreur}</div>}
        <div className="form-actions inventaire-panier-actions">
          <button type="button" className="primary-button" disabled={busy || !panier.length} onClick={rangerPanier}>
            {busy ? 'Rangement…' : panier.length ? `Ranger ${pluriel(panier.length, 'objet', 'objets')} · ${pluriel(panierTotal, 'exemplaire', 'exemplaires')}${coffreAjout ? ` dans ${coffreLibelle(coffreAjout)}` : ''}` : 'Ranger la liste'}
          </button>
          <button type="button" className="secondary-button" disabled={busy || !panier.length} onClick={() => { setPanier([]); setPanierErreur(''); }}>Vider la liste</button>
        </div>
        <p className="saisie-help">Les objets s’ajoutent à la liste sans appel au serveur ; « Ranger » les envoie tous en une seule requête. Un objet déjà présent dans le coffre voit sa quantité augmenter : il n’y a jamais deux lignes pour le même objet dans un même coffre.</p>
      </fieldset>}
    </div>}

    <div className="inventaire-filtres">
      <label htmlFor="inventaire-filtre-coffre">Coffre</label>
      <select id="inventaire-filtre-coffre" value={coffreFiltre} onChange={e => setCoffreFiltre(e.target.value)}>
        <option value="">Tous les coffres</option>
        {coffres.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
      </select>
      <label htmlFor="inventaire-recherche">Rechercher un objet</label>
      <input id="inventaire-recherche" type="search" placeholder="Nom ou ID…" value={recherche} onChange={e => setRecherche(e.target.value)}/>
      <span className="inventaire-compte" role="status">{visibles.length ? `${pluriel(visibles.length, 'objet', 'objets')} · ${pluriel(totalVisible, 'exemplaire', 'exemplaires')}` : 'Aucun objet'}</span>
    </div>

    {visibles.length === 0
      ? <p className="inventaire-vide">{data.objets.length ? 'Aucun objet ne correspond aux filtres.' : 'Les coffres sont vides.'}</p>
      : <div className="registry"><div className="registry-table-wrap"><table className="registry-table inventaire-table">
        <thead><tr><th>Objet</th><th>Quantité</th><th>Coffre</th>{canEdit && <th>Actions</th>}</tr></thead>
        <tbody>{visibles.map(o => <tr key={`${o.coffreId}|${o.cle}`}>
          <td data-label="Objet"><strong>{o.nom}</strong><small className="inventaire-objet-id">{o.libre ? 'Hors catalogue' : o.id}</small></td>
          <td data-label="Quantité">{canEdit
            ? <span className={`inventaire-quantite${ajustements[cleLigne(o)] ? ' inventaire-quantite-attente' : ''}`}>
              <button type="button" disabled={busy || quantiteAffichee(o) <= 0} aria-label={`Retirer un exemplaire de ${o.nom}`} onClick={() => cliquer(o, -1)}>−</button>
              <strong aria-live="polite">{nombre(quantiteAffichee(o))}</strong>
              <button type="button" disabled={busy} aria-label={`Ajouter un exemplaire de ${o.nom}`} onClick={() => cliquer(o, 1)}>+</button>
            </span>
            : <strong>{nombre(o.quantite)}</strong>}</td>
          <td data-label="Coffre">{canEdit
            ? <select aria-label={`Coffre de ${o.nom}`} value={o.coffreId} disabled={busy || Boolean(ajustements[cleLigne(o)])} onChange={e => appeler('deplacerInventaire', { coffreId: o.coffreId, versCoffreId: e.target.value, objet: objetDe(o) })}>
              {!coffresReels.some(c => c.id === o.coffreId) && <option value={o.coffreId}>{COFFRE_INCONNU}</option>}
              {coffresReels.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            : coffreLibelle(o.coffreId)}</td>
          {canEdit && <td data-label="Actions"><button type="button" className="danger-button" disabled={busy || Boolean(ajustements[cleLigne(o)])} onClick={() => retirer(o)}>Retirer</button></td>}
        </tr>)}</tbody>
      </table></div></div>}
  </>;
}

export function CoffreForm({ coffre, busy, onSubmit, onCancel }) {
  const [form, setForm] = useState({ nom: coffre.nom || '', position: coffre.position || '', description: coffre.description || '' });
  const champ = (cle, valeur) => setForm(precedent => ({ ...precedent, [cle]: valeur }));
  return <form className="form-card" onSubmit={e => { e.preventDefault(); if (!busy) onSubmit({ ...(coffre.id ? { id: coffre.id } : {}), ...form }); }}>
    <fieldset className="form-fieldset" disabled={busy}>
      <h2>{coffre.id ? `Modifier « ${coffre.nom} »` : 'Nouveau coffre'}</h2>
      <div className="form-grid">
        <div className="field"><label htmlFor="coffre-nom">Nom</label><input id="coffre-nom" required maxLength={LIMITES_COFFRE.nom} value={form.nom} onChange={e => champ('nom', e.target.value)} placeholder="Coffre de l’armurerie"/></div>
        <div className="field field-wide"><label htmlFor="coffre-position">Position dans le monde</label><input id="coffre-position" maxLength={LIMITES_COFFRE.position} value={form.position} onChange={e => champ('position', e.target.value)} placeholder="Fort-Dragon, salle des gardes, mur nord"/></div>
        <div className="field field-full"><label htmlFor="coffre-description">Description</label><textarea id="coffre-description" maxLength={LIMITES_COFFRE.description} value={form.description} onChange={e => champ('description', e.target.value)} placeholder="Ce qu’on y range d’habitude, qui en a la clef…"/></div>
      </div>
      <div className="form-actions">
        <button type="submit" className="primary-button">{busy ? 'Enregistrement…' : coffre.id ? 'Enregistrer' : 'Créer le coffre'}</button>
        <button type="button" className="secondary-button" onClick={onCancel}>Annuler</button>
      </div>
    </fieldset>
  </form>;
}
