import { rechercherArticlesLocal, ajouterChef, retirerChef, chefDepuisArticle, cleChef, referenceChef, libelleChef, qualificationMax, BAREME_IMPERIAL, MOTIF_LIBRE_MAX, articleParCle } from './codex.js';

const { useEffect, useRef, useState } = React;

const GROUPES = [['', 'Tout le Codex'], ['blancherive', 'Blancherive'], ['imperial', 'Impérial'], ['decrets', 'Décrets']];
const QUALIFS = [['', 'Toutes'], ['contravention', 'Contravention'], ['délit', 'Délit'], ['crime', 'Crime']];
const RACCOURCIS_CACHOT = [[0.5, '30 min'], [1, '1 h'], [2, '2 h'], [6, '6 h'], [12, '12 h'], [24, '24 h']];

function extrait(texte, longueur = 140) {
  const t = String(texte || '').replace(/\s+/g, ' ').trim();
  return t.length > longueur ? `${t.slice(0, longueur).replace(/\s+\S*$/, '')}…` : t;
}

export function QualificationChip({ classification }) {
  if (!classification) return null;
  return <span className={`law-chip chef-qualif chef-qualif-${qualificationMax([{ classification }]) || 'autre'}`}>{classification}</span>;
}

/*
  Champ à jetons des chefs d'accusation. Une seule zone de saisie : la
  recherche propose les articles du Codex en mémoire, chaque choix devient un
  jeton avec sa lecture (ⓘ) et son retrait. Une référence libre (décret,
  décision) s'ajoute par la case dédiée et se mêle aux articles.
*/
export function ChefsField({ codex, value, onChange, onOpenLaw, onParcourir, frequents = [], disabled, onPendingChange = () => {}, statut = 'pret' }) {
  const [query, setQuery] = useState('');
  const [groupe, setGroupe] = useState('');
  const [qualif, setQualif] = useState('');
  const [libre, setLibre] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState('');
  const input = useRef(null);
  const recherche = codex && !libre && query.trim() ? (() => { try { return rechercherArticlesLocal(codex, query, { groupe, classification: qualif }); } catch (e) { return { articles: [], tronque: false, total: 0, erreur: e.message }; } })() : null;
  const results = recherche?.articles || [];

  useEffect(() => { setActive(-1); }, [query, groupe, qualif, libre]);
  useEffect(() => {
    if (active >= 0 && open) input.current?.ownerDocument.getElementById(`chef-option-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open]);

  function ajouter(chef) {
    try { onChange(ajouterChef(value, chef)); setQuery(''); setError(''); setOpen(false); setActive(-1); onPendingChange(false); input.current?.focus(); }
    catch (e) { setError(e.message); }
  }
  function edit(text) { setQuery(text); setError(''); setOpen(true); onPendingChange(libre && Boolean(text.trim())); }
  function keyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setActive(-1); }
    if (!libre && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault(); setOpen(true);
      if (results.length) setActive(index => event.key === 'ArrowDown' ? (index + 1) % results.length : (index <= 0 ? results.length - 1 : index - 1));
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (libre) { if (query.trim()) ajouter({ libre: query }); }
      else if (open && active >= 0 && results[active]) ajouter(chefDepuisArticle(results[active]));
      else if (results.length === 1) ajouter(chefDepuisArticle(results[0]));
    }
  }

  const aide = libre ? `Référence d’un décret, d’une décision ou d’un ordre hors Codex (${MOTIF_LIBRE_MAX} caractères maximum). Entrée ou « Ajouter » pour la retenir.`
    : statut === 'chargement' && !codex ? 'Chargement du Codex…'
    : statut === 'erreur' && !codex ? 'Le Codex n’a pas pu être chargé : seule la référence libre est possible.'
    : recherche ? (recherche.erreur ? recherche.erreur : results.length ? `${recherche.total} article${recherche.total > 1 ? 's' : ''}${recherche.tronque ? ', les douze premiers affichés : précisez la recherche.' : '.'} Entrée retient l’article surligné, ⓘ le lit sans le retenir.` : 'Aucun article ne correspond. Essayez un mot du titre, un numéro (« 16 », « cpl 16 ») ou parcourez le Codex.')
    : `Un mot du titre, un numéro d’article ou un sigle (CPL, CCoL…) — ${codex ? codex.articles.filter(a => a.citable).length : 0} articles citables.`;

  return <div className="field field-full chefs-field">
    <h3>Chefs d’accusation</h3>
    {frequents.length > 0 && <div className="saisie-shortcuts" aria-label="Chefs fréquents">
      {frequents.map(chef => <button key={cleChef(chef)} type="button" className="secondary-button" disabled={disabled || value.some(c => cleChef(c) === cleChef(chef))}
        title={libelleChef(chef)} onClick={() => ajouter(chef)}>{referenceChef(chef)}{chef.titre ? ` · ${extrait(chef.titre, 28)}` : ''}</button>)}
    </div>}
    {!libre && codex && <div className="chefs-filtres">
      <div className="chefs-filtre-groupe" role="group" aria-label="Corpus">{GROUPES.map(([v, l]) => <button key={v} type="button" className={`chefs-filtre ${groupe === v ? 'active' : ''}`} disabled={disabled} onClick={() => setGroupe(v)}>{l}</button>)}</div>
      <div className="chefs-filtre-groupe" role="group" aria-label="Qualification">{QUALIFS.map(([v, l]) => <button key={v} type="button" className={`chefs-filtre ${qualif === v ? 'active' : ''}`} disabled={disabled} onClick={() => setQualif(v)}>{l}</button>)}</div>
    </div>}
    <label className="saisie-free-toggle"><input type="checkbox" checked={libre} disabled={disabled}
      onChange={e => { setLibre(e.target.checked); setOpen(false); setActive(-1); setError(''); setQuery(q => q.slice(0, e.target.checked ? MOTIF_LIBRE_MAX : 200)); onPendingChange(e.target.checked && Boolean(query.trim())); }}/>
      <span>Référence libre — décret, décision, ordre hors Codex</span></label>
    <div className="saisie-controls">
      <div className="saisie-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActive(-1); } }}>
        <label htmlFor="chef-recherche">{libre ? 'Référence' : 'Rechercher un article'}</label>
        <input id="chef-recherche" ref={input} role={libre ? undefined : 'combobox'} autoComplete="off" maxLength={libre ? MOTIF_LIBRE_MAX : 200}
          aria-autocomplete={libre ? undefined : 'list'} aria-expanded={libre ? undefined : open && results.length > 0}
          aria-controls={libre ? undefined : 'chef-suggestions'} aria-describedby="chef-aide"
          aria-activedescendant={open && active >= 0 ? `chef-option-${active}` : undefined}
          placeholder={libre ? 'Ex. Décision du Thane de Rivebois du 12 Âtrefeu' : 'Injure, vol, 16, cpl 4, refus d’obtempérer…'}
          value={query} disabled={disabled || (!libre && !codex)} onChange={e => edit(e.target.value)} onFocus={() => setOpen(true)} onKeyDown={keyDown}/>
        {!libre && <ul id="chef-suggestions" role="listbox" aria-label="Articles proposés" className="saisie-suggestions chef-suggestions" hidden={!open || !results.length}>
          {results.map((a, index) => <li id={`chef-option-${index}`} key={a._cle} role="option" aria-selected={index === active} className={index === active ? 'active' : ''}
            onMouseDown={e => e.preventDefault()} onClick={() => ajouter(chefDepuisArticle(a))}>
            <div className="chef-suggestion-main">
              <strong><span className="chef-ref">{a.abrege} art. {a.article}</span> {a.titre}</strong>
              <span><QualificationChip classification={a.classification}/> {a.source}</span>
              {a.texte && <em>{extrait(a.texte)}</em>}
            </div>
            <button type="button" className="law-info-button chef-lire" aria-label={`Lire l’article ${a.article}`} title="Lire sans retenir"
              onMouseDown={e => e.preventDefault()} onClick={e => { e.stopPropagation(); onOpenLaw(a); }}>ⓘ</button>
          </li>)}
        </ul>}
      </div>
      {libre && <button type="button" className="secondary-button" disabled={disabled || !query.trim()} onClick={() => ajouter({ libre: query })}>Ajouter la référence</button>}
      {!libre && onParcourir && <button type="button" className="secondary-button" disabled={disabled || !codex} onClick={onParcourir}>Parcourir le Codex</button>}
      {query && <button type="button" className="secondary-button" disabled={disabled} onClick={() => { setQuery(''); setError(''); onPendingChange(false); input.current?.focus(); }}>Effacer</button>}
    </div>
    <p id="chef-aide" className="saisie-help" role="status">{aide}</p>
    {error && <div className="error" role="alert">{error}</div>}
    {value.length ? <ul className="chefs-list" aria-label="Chefs retenus">{value.map(chef => {
      const article = chef.libre === undefined ? articleParCle(codex, chef.source, chef.article) : null;
      return <li key={cleChef(chef)}>
        <div className="chef-token-main">
          <span className="chef-ref">{referenceChef(chef)}</span>
          <span className="chef-titre">{chef.libre !== undefined ? chef.libre : chef.titre}</span>
          <QualificationChip classification={chef.classification}/>
          {chef.libre === undefined && !article && codex && <span className="law-chip">Texte retiré du Codex</span>}
        </div>
        <div className="chef-token-actions">
          {article && <button type="button" className="law-info-button" onClick={() => onOpenLaw(article)}>ⓘ Lire</button>}
          <button type="button" className="danger-button" disabled={disabled} aria-label={`Retirer ${referenceChef(chef)}`} onClick={() => onChange(retirerChef(value, chef))}>Retirer</button>
        </div>
      </li>; })}</ul> : <p className="saisie-help">Aucun chef d’accusation retenu.</p>}
    <ResumeQualification chefs={value}/>
  </div>;
}

export function ResumeQualification({ chefs }) {
  if (!chefs.length) return null;
  const q = qualificationMax(chefs);
  const sansQualif = chefs.filter(c => c.libre === undefined && !c.classification).length;
  return <p className="chefs-resume">
    {q ? <>Qualification la plus grave retenue : <strong>{q}</strong>. Barème impérial indicatif : {BAREME_IMPERIAL[q]}.</> : 'Aucune qualification portée par les chefs retenus.'}
    {sansQualif > 0 && q ? ` ${sansQualif} article${sansQualif > 1 ? 's' : ''} sans qualification.` : ''}
    {' '}La sanction reste à l’appréciation de l’autorité.
  </p>;
}

/*
  Montant d'amende ou durée de cachot : saisie libre par défaut, « À
  déterminer » possible. Les valeurs que citent encore certains articles
  sont proposées en raccourcis, sans contrainte.
*/
export function SentenceField({ type, value, onChange, indetermine, onIndetermineChange, codex, chefs = [], disabled }) {
  const montant = type === 'amende';
  const propositions = [];
  for (const chef of chefs) {
    const article = chef.libre === undefined ? articleParCle(codex, chef.source, chef.article) : null;
    for (const v of (montant ? article?.montants : article?.dureesCachot) || []) if (!propositions.some(p => p[0] === v)) propositions.push([v, montant ? `${v} septims` : formatHeures(v)]);
  }
  const raccourcis = montant ? propositions : [...RACCOURCIS_CACHOT, ...propositions.filter(p => !RACCOURCIS_CACHOT.some(r => r[0] === p[0]))];
  return <div className="field field-wide sentence-field">
    <label htmlFor="sentence-valeur">{montant ? 'Montant (septims)' : 'Durée de cachot (heures)'}
      <input id="sentence-valeur" type="number" required={!indetermine} disabled={disabled || indetermine} min={montant ? 1 : 0.000001} step={montant ? 1 : 'any'}
        value={indetermine ? '' : value} onChange={e => onChange(e.target.value)} placeholder={indetermine ? 'À déterminer' : montant ? 'Montant retenu' : 'Ex. 0,5 pour 30 minutes'}/>
    </label>
    {raccourcis.length > 0 && <div className="saisie-shortcuts" aria-label="Valeurs proposées">
      {raccourcis.map(([v, l]) => <button key={v} type="button" className={`secondary-button ${!indetermine && String(value) === String(v) ? 'active' : ''}`} disabled={disabled} onClick={() => { onIndetermineChange(false); onChange(String(v)); }}>{l}</button>)}
    </div>}
    <label className="saisie-free-toggle"><input type="checkbox" checked={indetermine} disabled={disabled} onChange={e => { onIndetermineChange(e.target.checked); if (e.target.checked) onChange(''); }}/>
      <span>À déterminer par l’autorité{montant ? '' : ' — pas de sortie prévue calculée'}</span></label>
  </div>;
}

export function formatHeures(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (n < 1) return `${Math.round(n * 60)} min`;
  if (Number.isInteger(n)) return `${n} h`;
  const h = Math.floor(n), m = Math.round((n - h) * 60);
  return `${h} h ${m} min`;
}

/*
  Chefs d'une ligne de registre : un bouton par article, lisible en popup ;
  une référence libre ou un article disparu s'affichent en texte.
*/
export function ChefsChips({ entrees, onOpenLaw }) {
  if (!entrees.length) return <span>—</span>;
  return <ul className="chefs-chips">{entrees.map(({ chef, article }, i) => <li key={`${cleChef(chef)}-${i}`}>
    {article
      ? <button type="button" className="law-link" onClick={() => onOpenLaw(article)} title={libelleChef(chef)}><span className="chef-ref">{referenceChef(chef)}</span> {chef.titre} ⓘ</button>
      : chef.libre !== undefined
        ? <span title="Motif personnalisé"><span className="chef-ref">Motif</span> {chef.libre}</span>
        : <span title="Article retiré du Codex"><span className="chef-ref">{referenceChef(chef)}</span> {chef.titre}</span>}
  </li>)}</ul>;
}
