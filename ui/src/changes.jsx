import { CHANGE_SEEN_KEY, parseSeenChanges, markChangesSeen, recentChanges } from "./change-state.js";

const { createContext, useContext, useEffect, useMemo, useRef, useState } = React;
const ChangesContext = createContext({ events: [], seen: {}, mark: () => {} });
let sessionSeen = {};
const labels = { arrivee: "Arrivée", grade: "Grade", corps: "Mutation" };
const formatDate = date => new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris"
}).format(new Date(date));

function describe(change) {
  if (change.type === "arrivee") return "A rejoint les effectifs";
  return `${labels[change.type]} : ${change.avant || "Sans affectation"} → ${change.apres || "Sans affectation"}`;
}

export function ChangesProvider({ data, children }) {
  const [seen, setSeen] = useState(() => {
    try { return { ...sessionSeen, ...parseSeenChanges(localStorage.getItem(CHANGE_SEEN_KEY)) }; }
    catch { return sessionSeen; }
  });
  const [storageFailed, setStorageFailed] = useState(false);
  const [now, setNow] = useState(Date.now());
  const events = useMemo(() => recentChanges(data?.events, now), [data, now]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    const sync = e => {
      if (e.key === CHANGE_SEEN_KEY) {
        sessionSeen = parseSeenChanges(e.newValue);
        setSeen(sessionSeen);
      }
    };
    window.addEventListener("storage", sync);
    return () => { clearInterval(timer); window.removeEventListener("storage", sync); };
  }, []);
  function mark(items) {
    if (!items.length) return;
    let stored = {};
    try { stored = parseSeenChanges(localStorage.getItem(CHANGE_SEEN_KEY)); } catch { /* Mémoire locale en repli. */ }
    const next = markChangesSeen({ ...stored, ...sessionSeen, ...seen }, items);
    sessionSeen = next;
    try { localStorage.setItem(CHANGE_SEEN_KEY, JSON.stringify(next)); }
    catch { setStorageFailed(true); }
    setSeen(next);
  }
  return <ChangesContext.Provider value={{ events, seen, mark }}>
    {storageFailed && <p className="info-notice">Le navigateur ne permet pas de conserver les éléments vus après fermeture. Ils restent mémorisés pendant cette visite.</p>}
    {children}
  </ChangesContext.Provider>;
}

export function useMemberChanges(memberId) {
  const { events, seen, mark } = useContext(ChangesContext);
  const items = events.filter(e => e.memberId === memberId);
  const unread = items.filter(e => !seen[e.id]);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const signature = items.map(e => e.id).join("|");
  function cancel() { clearTimeout(timer.current); timer.current = null; }
  useEffect(() => { cancel(); setOpen(false); return cancel; }, [signature]);
  function enter() {
    if (!items.length) return;
    cancel(); setOpen(true);
    timer.current = setTimeout(() => mark(unread), 800);
  }
  function leave() { cancel(); setOpen(false); }
  return {
    items, unread: unread.length > 0, open,
    toggle() { cancel(); setOpen(true); mark(unread); },
    hoverProps: {
      onMouseEnter: enter, onMouseLeave: leave,
      onFocusCapture: enter,
      onBlurCapture: e => { if (!e.currentTarget.contains(e.relatedTarget)) leave(); },
      onKeyDown: e => { if (e.key === "Escape") leave(); }
    }
  };
}

export function ChangeBadge({ change }) {
  if (!change.items.length) return null;
  return <span className="member-change">
    <button type="button" className={`change-badge ${change.unread ? "change-new" : "change-seen"}`}
      aria-expanded={change.open} aria-label={`${change.unread ? "Nouveau" : "Vu"} : afficher les changements récents`}
      onClick={e => { e.stopPropagation(); change.toggle(); }}>
      {change.unread ? "Nouveau" : "Vu"}{change.items.length > 1 ? ` · ${change.items.length}` : ""}
    </button>
    {change.open && <span className="change-details">
      {change.items.map(event => <span className="change-detail" key={event.id}>
        <span>{event.changes.map(describe).join(" · ")}</span>
        <small>{formatDate(event.date)}</small>
      </span>)}
    </span>}
  </span>;
}

export function ChangesCount({ people, corps }) {
  const { events, seen } = useContext(ChangesContext);
  const ids = people ? new Set(people.map(p => p.memberId)) : null;
  const count = new Set(events.filter(e => !seen[e.id] &&
    (!ids || ids.has(e.memberId)) && (corps === undefined || e.corps === corps)
  ).map(e => e.memberId)).size;
  return count ? <span className="changes-count">{count} nouveauté{count > 1 ? "s" : ""}</span> : null;
}

export function RecentChanges({ onRefresh }) {
  const { events, seen, mark } = useContext(ChangesContext);
  const [type, setType] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const normalize = text => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filtered = events.filter(e => (!type || e.changes.some(c => c.type === type)) &&
    (!onlyUnread || !seen[e.id]) && normalize(`${e.nom} ${e.corps}`).includes(normalize(search.trim())));
  const unread = events.filter(e => !seen[e.id]);
  return <details className="recent-changes">
    <summary>Changements récents <span>{unread.length} non vu{unread.length > 1 ? "s" : ""}</span></summary>
    <div className="recent-changes-body">
      <p>Les 14 derniers jours. Un survol de 800 ms marque les changements comme vus. Sur mobile, touche le badge. Le suivi est commun aux deux pages sur ce navigateur.</p>
      <div className="changes-controls">
        <button type="button" className="secondary-button" disabled={refreshing} onClick={async () => {
          setRefreshing(true); setError("");
          try { await onRefresh(); } catch (e) { setError(e.message); }
          finally { setRefreshing(false); }
        }}>{refreshing ? "Actualisation…" : "Actualiser"}</button>
        <label>Type <select value={type} onChange={e => setType(e.target.value)}>
          <option value="">Tous</option>{Object.entries(labels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
        </select></label>
        <label>Personne ou corps <input type="search" value={search} onChange={e => setSearch(e.target.value)}/></label>
        <label><input type="checkbox" checked={onlyUnread} onChange={e => setOnlyUnread(e.target.checked)}/> Non vus uniquement</label>
        <button type="button" className="secondary-button" disabled={!unread.length} onClick={() => mark(unread)}>Tout marquer comme vu</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {!filtered.length && <p role="status">Aucun changement récent ne correspond à cette sélection.</p>}
      <ol className="changes-list">{filtered.map(event => <li key={event.id}>
        <div><strong>{event.nom}</strong> <span>{event.corps}</span><small>{formatDate(event.date)}</small>
          {event.changes.map((change, i) => <div key={i}>{describe(change)}</div>)}
        </div>
        <button type="button" className={`change-badge ${seen[event.id] ? "change-seen" : "change-new"}`}
          disabled={Boolean(seen[event.id])} onClick={() => mark([event])}>{seen[event.id] ? "Vu" : "Marquer comme vu"}</button>
      </li>)}</ol>
    </div>
  </details>;
}
