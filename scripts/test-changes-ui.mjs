import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';

// Exécute les vrais handlers du composant avec horloge et hooks contrôlés.
// Aucun accès à Sheets ni dépendance navigateur pendant ces tests.
const bundle = await build({ entryPoints: ['ui/src/changes.jsx'], bundle: true, write: false,
  format: 'cjs', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment' });
let slots = [], cursor = 0, effects = [], currentContext, clock = 0, timerId = 0;
const timers = new Map(), storage = new Map(), listeners = new Map();
let storageBlocked = false;
const React = {
  createContext: () => ({ Provider: 'Provider' }),
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useContext: () => currentContext,
  useState(initial) {
    const i = cursor++;
    if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
    return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
  },
  useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
  useMemo(fn) { cursor++; return fn(); },
  useEffect(fn, deps) {
    const i = cursor++;
    if (!slots[i] || deps.some((d, j) => d !== slots[i].deps[j])) {
      effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
    }
  }
};
const context = vm.createContext({ React, exports: {}, Intl, Date,
  setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, due: clock + ms }); return id; },
  clearTimeout: id => timers.delete(id), setInterval: () => 0, clearInterval() {},
  window: { addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) },
  localStorage: {
    getItem: key => { if (storageBlocked) throw Error('blocked'); return storage.get(key) || null; },
    setItem: (key, value) => { if (storageBlocked) throw Error('blocked'); storage.set(key, value); }
  }
});
context.module = { exports: context.exports };
vm.runInContext(bundle.outputFiles[0].text, context);
const ui = context.module.exports;
const render = fn => { cursor = 0; const result = fn(); effects.splice(0).forEach(e => e()); return result; };
const reset = () => { slots.forEach(s => s?.cleanup?.()); slots = []; cursor = 0; effects = []; };
const advance = ms => {
  clock += ms;
  for (const [id, timer] of [...timers]) if (timer.due <= clock) { timers.delete(id); timer.fn(); }
};
const event = { id: 'event-1', memberId: 'alice', date: new Date().toISOString(), nom: 'Alice', corps: 'Rivebois', changes: [{ type: 'grade', avant: 'Garde', apres: 'Sergent' }] };
let marked = [];
currentContext = { events: [event], seen: {}, mark: events => marked.push(...events.map(e => e.id)) };
let change = render(() => ui.useMemberChanges('alice'));
assert.equal(change.unread, true);
change.hoverProps.onMouseEnter(); advance(799);
assert.equal(marked.length, 0);
advance(1); assert.deepEqual(marked, ['event-1']);

marked = [];
change.hoverProps.onMouseEnter(); advance(300); change.hoverProps.onMouseLeave(); advance(800);
assert.equal(marked.length, 0, 'Un survol bref ne marque pas comme vu');
change.hoverProps.onFocusCapture(); advance(800);
assert.deepEqual(marked, ['event-1'], 'Accessible au clavier');
marked = [];
change = render(() => ui.useMemberChanges('alice'));
change.toggle(); assert.deepEqual(marked, ['event-1'], 'Un appui marque immédiatement comme vu');

currentContext.seen['event-1'] = Date.now();
change = render(() => ui.useMemberChanges('alice'));
assert.equal(change.unread, false);
currentContext.events.push({ ...event, id: 'event-2' });
change = render(() => ui.useMemberChanges('alice'));
assert.equal(change.unread, true, 'Une nouvelle modification réactive le badge');
marked = [];
change.hoverProps.onMouseEnter(); reset(); advance(800);
assert.equal(marked.length, 0, 'Le démontage annule le survol');

let provider = render(() => ui.ChangesProvider({ data: { events: [event] }, children: null }));
provider.props.value.mark([event]);
provider = render(() => ui.ChangesProvider({ data: { events: [event] }, children: null }));
assert.ok(provider.props.value.seen['event-1']);
reset();
provider = render(() => ui.ChangesProvider({ data: { events: [event] }, children: null }));
assert.ok(provider.props.value.seen['event-1'], 'Lecture partagée entre pages et rechargements');
const key = [...storage.keys()][0];
listeners.get('storage')({ key, newValue: JSON.stringify({ 'event-2': Date.now() }) });
provider = render(() => ui.ChangesProvider({ data: { events: [event] }, children: null }));
assert.ok(provider.props.value.seen['event-2'], 'Synchronisation entre onglets');
storageBlocked = true;
provider.props.value.mark([{ ...event, id: 'event-3' }]);
reset();
provider = render(() => ui.ChangesProvider({ data: { events: [event] }, children: null }));
assert.ok(provider.props.value.seen['event-3'], 'Stockage indisponible : repli en mémoire');
reset();
console.log('Nouveautés UI : survol 800 ms, annulation, clavier, appui, nouveau badge et persistance validés.');
