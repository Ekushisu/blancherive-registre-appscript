import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let slots = [], cursor = 0, effects = [], dirty = false, clock = 0, timerId = 0, tree;
const timers = new Map();
const React = {
  createElement(type, props, ...children) {
    if (props?.ref) props.ref.current = { focus() {}, ownerDocument: { getElementById: () => null } };
    return { type, props: { ...props, children } };
  },
  useState(initial) {
    const i = cursor++;
    if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
    return [slots[i], value => { const next = typeof value === 'function' ? value(slots[i]) : value;
      if (!Object.is(next, slots[i])) { slots[i] = next; dirty = true; } }];
  },
  useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
  useEffect(fn, deps) {
    const i = cursor++;
    if (!slots[i] || deps.some((d,j) => d !== slots[i].deps[j])) {
      effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
    }
  }
};
const context = vm.createContext({ React, exports: {}, Intl, Date, console,
  setTimeout: (fn,ms) => { const id = ++timerId; timers.set(id,{fn,due:clock+ms}); return id; },
  clearTimeout: id => timers.delete(id)
});
context.module = { exports: context.exports };
const bundle = await build({entryPoints:['ui/src/saisies.jsx'],bundle:true,write:false,format:'cjs',jsxFactory:'React.createElement'});
vm.runInContext(bundle.outputFiles[0].text,context);
const { SaisiesField, ajouterObjetSaisi } = context.module.exports;
const gold = {id:'skyrim.esm|00000F',nom:'Or',type:'Objet divers'};
assert.throws(() => ajouterObjetSaisi([],gold,0),/quantité/);
assert.throws(() => ajouterObjetSaisi([],gold,1.5),/quantité/);
assert.throws(() => ajouterObjetSaisi([{...gold,quantite:Number.MAX_SAFE_INTEGER}],gold,1),/élevée/);
let component, pending = false, requests = [];
const props = {token:'GARDE',value:[],disabled:false,
  onChange: value => { props.value = value; }, onPendingChange: value => { pending = value; },
  serverCall: (name,token,query) => new Promise((resolve,reject) => { requests.push({name,token,query,resolve,reject}); })
};
component = () => SaisiesField(props);
function render() {
  let loops = 0;
  do { dirty = false; cursor = 0; tree = component(); effects.splice(0).forEach(fn => fn()); assert.ok(++loops < 20); } while (dirty);
  return tree;
}
function nodes(node = tree) {
  if (Array.isArray(node)) return node.flatMap(n => nodes(n));
  if (!node || typeof node !== 'object') return [];
  return [node,...nodes(node.props?.children)];
}
const id = name => nodes().find(n => n.props.id === name);
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) :
  Array.isArray(node) ? node.map(text).join(' ') : node?.props ? text(node.props.children) : '';
const button = label => nodes().find(n => n.type === 'button' && text(n) === label);
const edit = q => { id('saisie-objet').props.onChange({target:{value:q}}); render(); };
const advance = ms => { clock += ms; for (const [key,t] of [...timers]) if(t.due<=clock){timers.delete(key);t.fn();} };
const settle = async () => { await new Promise(resolve => setImmediate(resolve)); render(); };
const event = key => ({key,preventDefault(){this.prevented=true;}});
function reset() { slots.forEach(s=>s?.cleanup?.()); slots=[]; cursor=0; effects=[]; dirty=false; timers.clear(); }

render();
edit('ép'); advance(500); assert.equal(requests.length,0);
edit('épé'); advance(299); assert.equal(requests.length,0);
edit('épée'); advance(300); assert.equal(requests.length,1);
assert.equal(requests[0].query,'épée');
edit('armure'); advance(300); assert.equal(requests.length,2);
requests[1].resolve({objets:[gold],tronque:false}); await settle();
requests[0].resolve({objets:[{id:'old',nom:'Réponse ancienne'}],tronque:false}); await settle();
assert.equal(text(id('saisie-option-0')).includes('Or'),true,'Réponse ancienne ignorée');
id('saisie-objet').props.onKeyDown(event('ArrowDown')); render();
assert.equal(id('saisie-objet').props['aria-activedescendant'],'saisie-option-0');
const enter = event('Enter'); id('saisie-objet').props.onKeyDown(enter); render();
assert.equal(enter.prevented,true);
assert.equal(button('Ajouter l’objet').props.disabled,false);
assert.equal(pending,true);
id('saisie-quantite').props.onChange({target:{value:'9000'}}); render();
button('Ajouter l’objet').props.onClick(); render();
assert.equal(props.value[0].quantite,9000);
assert.equal(pending,false);
assert.equal(id('saisie-objet').props.value,'');
edit('000000F'); advance(300); requests.at(-1).resolve({objets:[gold],tronque:false}); await settle();
id('saisie-option-0').props.onClick(); render();
id('saisie-quantite').props.onChange({target:{value:'-1'}}); render();
button('Ajouter l’objet').props.onClick(); render();
assert.equal(props.value[0].quantite,9000);
assert.ok(nodes().some(n => n.props.role === 'alert'));
id('saisie-quantite').props.onChange({target:{value:'2'}}); render();
button('Ajouter l’objet').props.onClick(); render();
assert.equal(props.value.length,1);
assert.equal(props.value[0].quantite,9002);
button('Retirer').props.onClick(); render(); assert.equal(props.value.length,0);
edit('test'); advance(300); requests.at(-1).reject(Error('Connexion perdue')); await settle();
assert.ok(text(tree).includes('Connexion perdue'));
edit('introuvable'); advance(300); requests.at(-1).resolve({objets:[],tronque:false}); await settle();
assert.ok(text(tree).includes('Aucun objet trouvé'));
edit('abc'); advance(300); const late = requests.at(-1);
edit('ab'); late.resolve({objets:[gold],tronque:false}); await settle();
assert.equal(id('saisie-option-0'),undefined,'Effacement sous le seuil invalide une réponse en vol');
edit('abc'); props.disabled=true; render(); const count=requests.length; advance(1000);
assert.equal(requests.length,count,'Aucune recherche pendant enregistrement');
props.disabled=false; render(); advance(300); const unmounted=requests.at(-1);
reset(); unmounted.resolve({objets:[gold],tronque:false}); await Promise.resolve();
assert.equal(dirty,false,'Aucune mise à jour après démontage');

// Le vrai formulaire bloque les brouillons et les doubles submissions, et
// conserve les données si l'appel échoue. Compilation isolée du composant.
const app = readFileSync('ui/src/app.jsx','utf8');
const formSource = app.slice(app.indexOf('function PrisonForm('),app.indexOf('function Field('));
const formBundle = await build({stdin:{contents:formSource+'\nexport { PrisonForm };',loader:'jsx'},write:false,format:'cjs',jsxFactory:'React.createElement'});
context.exports={}; context.module={exports:context.exports};
Object.assign(context,{useState:React.useState,useRef:React.useRef,SaisiesField,MotifSanction:()=>{},ChoixSanction:()=>{},Field:()=>{},formatHours:()=>'',serverCall:props.serverCall});
vm.runInContext(formBundle.outputFiles[0].text,context);
const PrisonForm=context.module.exports.PrisonForm;
let submitCount=0, rejectSubmit;
const formProps={token:'GARDE',data:{gardes:['Garde'],infractions:[]},onSubmit:()=>{submitCount++; return new Promise((resolve,reject)=>{rejectSubmit=reject;});}};
component=()=>PrisonForm(formProps); render();
nodes().find(n=>n.type===SaisiesField).props.onPendingChange(true); render();
await tree.props.onSubmit(event('submit')); render(); assert.equal(submitCount,0,'Brouillon non ajouté : pas de soumission');
const field=nodes().find(n=>n.type===SaisiesField);
field.props.onPendingChange(false); field.props.onChange([{...gold,quantite:1}]); render();
const first=tree.props.onSubmit(event('submit')); render();
assert.equal(nodes().find(n=>n.type==='fieldset').props.disabled,true);
await tree.props.onSubmit(event('submit')); assert.equal(submitCount,1);
rejectSubmit(Error('Erreur serveur')); await assert.rejects(first,/Erreur serveur/); render();
assert.equal(nodes().find(n=>n.type==='fieldset').props.disabled,false);
assert.equal(nodes().find(n=>n.type===SaisiesField).props.value.length,1,'Liste conservée après échec');
console.log('Saisies UI : délai, réponses obsolètes, clavier, quantités, doublons, retrait et soumission OK.');
