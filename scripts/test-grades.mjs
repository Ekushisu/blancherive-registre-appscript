// Descriptions de grades de l'Organigramme : correspondance des libellés,
// variante du commandement local et repli silencieux sur un grade inconnu.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {build} from 'esbuild';
let slots=[],cursor=0;
const React={createElement:(type,props,...children)=>({type,props:{...props,children}}),
  // Le composant utilise la forme fonctionnelle `setOpen(v=>!v)`.
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;
    return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
  useEffect(){},useRef:()=>({current:null}),useId:()=>'id-test'};
const ctx=vm.createContext({React,exports:{}});ctx.module={exports:ctx.exports};
const bundle=await build({entryPoints:['ui/src/grades.jsx'],bundle:true,write:false,format:'cjs',jsxFactory:'React.createElement'});
vm.runInContext(bundle.outputFiles[0].text,ctx);
const {descriptionGrade,GradeDescription,GradeInfo}=ctx.module.exports;
const nodes=node=>Array.isArray(node)?node.flatMap(nodes):node&&typeof node==='object'?[node,...nodes(node.props?.children)]:[];

// Les quinze grades de la doctrine ont un texte.
for(const grade of ['Jarl','Maréchal','Commander','Major','Capitaine','Lieutenant-Chef',
  'Lieutenant','Sergent-Chef','Sergent','Caporal-Chef','Caporal','Garde','Cadet','Recrue']){
  assert.ok(descriptionGrade(grade),`${grade} doit avoir une description`);
}

// `Données!A2:A` écrit le commandant en chef des deux façons ; `estGradeCommandant()`
// dans `src/Organigramme.js` les traite déjà comme un seul grade.
assert.equal(descriptionGrade('Commandant'),descriptionGrade('Commander'));

// Casse, accents et séparateurs ne doivent pas casser la correspondance.
assert.equal(descriptionGrade('LIEUTENANT-CHEF'),descriptionGrade('Lieutenant-Chef'));
assert.equal(descriptionGrade('lieutenant chef'),descriptionGrade('Lieutenant-Chef'));
assert.equal(descriptionGrade('  Marechal  '),descriptionGrade('Maréchal'));

// Les en-têtes de la chaîne de commandement affichent parfois le pluriel.
assert.equal(descriptionGrade('Majors'),descriptionGrade('Major'));
assert.equal(descriptionGrade('Capitaines'),descriptionGrade('Capitaine'));

// Lieutenant-Chef et Lieutenant restent deux textes distincts.
assert.notEqual(descriptionGrade('Lieutenant-Chef'),descriptionGrade('Lieutenant'));
assert.notEqual(descriptionGrade('Sergent-Chef'),descriptionGrade('Sergent'));
assert.notEqual(descriptionGrade('Caporal-Chef'),descriptionGrade('Caporal'));

// Les Majors du commandement de Rivebois / Bois-de-Chêne ont une fonction distincte.
assert.match(descriptionGrade('Majors','commandementLocal'),/thaneries/);
assert.notEqual(descriptionGrade('Majors','commandementLocal'),descriptionGrade('Major'));

// Un grade absent de la doctrine ne doit rien afficher, sans erreur.
// « Aspirant-Garde », supprimé le 15 septembre 2026, reste lisible dans les
// lignes de Présences historiques : il ne doit pas provoquer d'erreur.
assert.equal(descriptionGrade('Aspirant-Garde'),'');
assert.equal(descriptionGrade(''),'');
assert.equal(descriptionGrade(undefined),'');
assert.equal(descriptionGrade('Porte-Étendard'),'');
assert.equal(GradeDescription({grade:'Aspirant-Garde'}),null);
assert.equal(GradeInfo({grade:'Aspirant-Garde'}),null);

// Rendu : texte permanent sur les cartes de commandement.
slots=[];cursor=0;
const description=nodes(GradeDescription({grade:'Commander'}));
assert.equal(description[0].type,'p');
assert.equal(description[0].props.className,'grade-description');
assert.ok(description.some(n=>typeof n==='object'&&n.props?.children?.some?.(c=>/Commandant en chef/.test(String(c)))
  ||/Commandant en chef/.test(String(n.props?.children))));

// Rendu : bouton replié par défaut, libellé accessible explicite.
slots=[];cursor=0;
let info=nodes(GradeInfo({grade:'Sergent-Chef'}));
const bouton=info.find(n=>n.type==='button');
assert.equal(bouton.props['aria-expanded'],false);
assert.equal(bouton.props['aria-label'],'Rôle du grade Sergent-Chef');
assert.equal(info.some(n=>n.props?.className==='grade-info-panel'),false,'Le texte est replié au départ');

// L'encart s'ouvre au clic et porte le texte du grade.
bouton.props.onClick({stopPropagation(){}});
cursor=0;info=nodes(GradeInfo({grade:'Sergent-Chef'}));
const panneau=info.find(n=>n.props?.className==='grade-info-panel');
assert.ok(panneau,'Le clic doit ouvrir l\'encart');
assert.equal(panneau.props.role,'note');
assert.match(String(panneau.props.children),/respect du règlement/);
assert.equal(info.find(n=>n.type==='button').props['aria-expanded'],true);

console.log('Descriptions de grades : doctrine complète, alias Commandant, pluriels, variante locale et repli OK.');
