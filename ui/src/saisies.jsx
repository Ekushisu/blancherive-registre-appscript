const { useEffect, useRef, useState } = React;

const objetsCourants = [
  { id: 'skyrim.esm|00000F', nom: 'Or', label: 'Or (septims)' },
  { id: 'skyrim.esm|00000A', nom: 'Crochet', label: 'Crochets' },
  { id: 'skyrim.esm|01D4EC', nom: 'Torche', label: 'Torches' }
];

export function cleObjetSaisi(objet) {
  return objet.libre === true ? `libre:${objet.nom.trim().replace(/\s+/g, ' ').toLowerCase()}` : `catalogue:${objet.id.toLowerCase()}`;
}

export function ajouterObjetSaisi(items, objet, quantite) {
  if (!objet || !Number.isSafeInteger(quantite) || quantite <= 0) {
    throw new Error('Sélectionnez un objet et indiquez une quantité entière strictement positive.');
  }
  const nom = String(objet.nom || '').trim().replace(/\s+/g, ' ');
  if (objet.libre === true && (!nom || nom.length > 300 || objet.id)) {
    throw new Error('Indiquez un nom pour la saisie libre (300 caractères maximum).');
  }
  const entree = objet.libre === true ? { id: '', nom, libre: true } : { id: objet.id, nom: objet.nom };
  const key = cleObjetSaisi(entree);
  const existing = items.find(item => cleObjetSaisi(item) === key);
  if (!existing && items.length >= 100) throw new Error('La limite de 100 objets différents est atteinte.');
  const total = (existing?.quantite || 0) + quantite;
  if (!Number.isSafeInteger(total)) throw new Error('Quantité totale trop élevée.');
  return existing
    ? items.map(item => cleObjetSaisi(item) === key ? { ...item, quantite: total } : item)
    : [...items, { ...entree, quantite }];
}

export function SaisiesField({ token, value, onChange, onPendingChange, disabled, serverCall }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [results, setResults] = useState([]);
  const [truncated, setTruncated] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [free, setFree] = useState(false);
  const version = useRef(0);
  const input = useRef(null);
  const quantityInput = useRef(null);

  useEffect(() => {
    const current = ++version.current;
    setResults([]); setActive(-1); setTruncated(false);
    if (disabled || free || selected || query.trim().length < 3) { setStatus(''); return; }
    setStatus('attente');
    const timer = setTimeout(async () => {
      setStatus('chargement');
      try {
        const response = await serverCall('rechercherObjets', token, query.trim());
        if (version.current !== current) return;
        setResults(response.objets); setTruncated(response.tronque); setStatus('termine');
      } catch (e) {
        if (version.current !== current) return;
        setError(e.message || 'La recherche a échoué.'); setStatus('erreur');
      }
    }, 300);
    return () => { clearTimeout(timer); version.current++; };
  }, [query, selected, token, disabled, free, serverCall]);

  function edit(text) {
    version.current++;
    setQuery(text); setSelected(null); setResults([]); setActive(-1);
    setError(''); setOpen(true); setStatus(text.trim().length >= 3 ? 'attente' : '');
    onPendingChange(Boolean(text.trim()));
  }
  function choose(objet) {
    if (disabled) return;
    version.current++;
    setFree(false); setSelected(objet); setQuery(objet.nom); setResults([]); setOpen(false); setActive(-1);
    setError(''); setStatus(''); onPendingChange(true);
  }
  function clear() {
    version.current++;
    setQuery(''); setSelected(null); setQuantity('1'); setResults([]); setOpen(false);
    setActive(-1); setError(''); setStatus(''); onPendingChange(false);
    input.current?.focus();
  }
  function add() {
    if (disabled) return;
    const objet = free ? { id: '', nom: query, libre: true } : selected;
    try { onChange(ajouterObjetSaisi(value, objet, Number(quantity))); clear(); }
    catch (e) { setError(e.message); }
  }
  function keyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setActive(-1); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true);
      if (results.length) setActive(index => event.key === 'ArrowDown'
        ? (index + 1) % results.length : (index <= 0 ? results.length - 1 : index - 1));
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (open && active >= 0 && results[active]) choose(results[active]);
      else if (selected || free) add();
    }
  }
  useEffect(() => {
    if (active >= 0 && open) input.current?.ownerDocument.getElementById(`saisie-option-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open]);
  useEffect(() => { if (selected) quantityInput.current?.focus(); }, [selected]);

  return <div className="field field-full saisies-field">
    <h3>Saisies sur la personne</h3>
    <div className="saisie-shortcuts" aria-label="Objets courants">
      {objetsCourants.map(objet => <button key={objet.id} type="button" className="secondary-button"
        disabled={disabled} onClick={() => choose(objet)}>{objet.label}</button>)}
    </div>
    <label className="saisie-free-toggle"><input type="checkbox" checked={free} disabled={disabled}
      onChange={e => {
        version.current++; setFree(e.target.checked); setSelected(null); setResults([]);
        setActive(-1); setOpen(false); setError(''); setStatus('');
        setQuery(text => text.slice(0, e.target.checked ? 300 : 100));
        onPendingChange(Boolean(query.trim()));
      }}/><span>Saisie libre — objet hors catalogue</span></label>
    <div className="saisie-controls">
      <div className="saisie-search" onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActive(-1); }
      }}>
        <label htmlFor="saisie-objet">Objet</label>
        <input id="saisie-objet" ref={input} role={free ? undefined : 'combobox'} autoComplete="off" maxLength={free || selected ? 300 : 100}
          aria-autocomplete={free ? undefined : 'list'} aria-expanded={free ? undefined : open && results.length > 0}
          aria-controls={free ? undefined : 'saisie-suggestions'} aria-describedby="saisie-aide"
          aria-activedescendant={open && active >= 0 ? `saisie-option-${active}` : undefined}
          placeholder={free ? 'Nom ou description de l’objet' : 'Nom ou ID — 3 caractères minimum'} value={query} disabled={disabled}
          onChange={e => edit(e.target.value)} onFocus={() => setOpen(true)} onKeyDown={keyDown}/>
        <ul id="saisie-suggestions" role="listbox" aria-label="Objets proposés" className="saisie-suggestions" hidden={!open || !results.length}>
          {results.map((objet, index) => <li id={`saisie-option-${index}`} key={objet.id} role="option"
            aria-selected={index === active} className={index === active ? 'active' : ''}
            onMouseDown={e => e.preventDefault()} onClick={() => choose(objet)}>
            <strong>{objet.nom}</strong><span>{objet.type} · {objet.id}</span>
          </li>)}
        </ul>
      </div>
      <div className="saisie-quantity"><label htmlFor="saisie-quantite">Quantité</label>
        <input id="saisie-quantite" ref={quantityInput} type="number" min="1" step="1" max={Number.MAX_SAFE_INTEGER}
          value={quantity} disabled={disabled || (!selected && !free)} onChange={e => setQuantity(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}/>
      </div>
      <button type="button" className="secondary-button" disabled={disabled || (!selected && !(free && query.trim()))} onClick={add}>Ajouter l’objet</button>
      {query && <button type="button" className="secondary-button" disabled={disabled} onClick={clear}>Effacer</button>}
    </div>
    <p id="saisie-aide" className="saisie-help" role="status">
      {free ? 'Le nom saisi sera conservé avec cette incarcération, sans ajout au catalogue.' : selected ? `${selected.nom} sélectionné · ${selected.id}` :
        status === 'chargement' || status === 'attente' ? 'Recherche…' :
        status === 'termine' ? (results.length ? `${results.length} suggestion${results.length > 1 ? 's' : ''}${truncated ? ' — précisez la recherche pour en voir d’autres.' : '.'}` : 'Aucun objet trouvé. Essayez un autre nom ou son ID.') :
        'Saisissez au moins 3 caractères, puis sélectionnez un objet.'}
    </p>
    {error && <div className="error" role="alert">{error}</div>}
    {value.length ? <ul className="saisies-list">{value.map(item => <li key={cleObjetSaisi(item)}>
      <div><strong>{item.nom}</strong> × {item.quantite.toLocaleString('fr-FR')}<small>{item.libre ? 'Saisie libre' : item.id}</small></div>
      <button type="button" className="danger-button" disabled={disabled} aria-label={`Retirer ${item.nom}`}
        onClick={() => onChange(value.filter(other => cleObjetSaisi(other) !== cleObjetSaisi(item)))}>Retirer</button>
    </li>)}</ul> : <p className="saisie-help">Aucun objet ajouté.</p>}
  </div>;
}
