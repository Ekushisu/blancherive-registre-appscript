// Lecture d'un article en popup, commune au Codex, aux registres Amendes et
// Prison, à leurs formulaires et à la page des décrets de peines. Elle porte
// le barème de l'article quand le décret des peines en prévoit un.

import { articleParCle } from "./codex.js";
import { formatHeures as formatHours } from "./chefs.jsx";
import { BaremeArticle } from "./bareme.jsx";

const {useEffect,useRef}=React;

function normalizeSearchText(value){return String(value||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");}
// Un article reconstruit hors du Codex n'a pas toujours ces champs.
function renseigne(value){return value!==undefined&&value!==null&&value!=="";}

/*
  Texte d'un article avec ses renvois cliquables : « article 76 », « articles
  6, 17 ou 25 » ouvrent l'article visé dans la même source, ou dans la source
  nommée juste après (« article 5 du Codex Penitus Imperialis »).
*/
function TexteArticle({texte,article,codex,onNavigate}){
  if(!codex||!onNavigate)return <div className="law-text">{texte}</div>;
  const source=article.source;
  const motif=/\b(articles?\s+)((?:\d+(?:-\d+)?)(?:\s*(?:,|et|ou)\s*\d+(?:-\d+)?)*)/gi;
  const parts=[];let last=0,m;
  while((m=motif.exec(texte))){
    const suite=texte.slice(m.index+m[0].length,m.index+m[0].length+90);
    let cible=source;
    const lien=/^\s+(?:du|de la|de l’|de l'|des|au)\s+(.+)$/i.exec(suite);
    if(lien){const reste=normalizeSearchText(lien[1]);const s=codex.sources.find(s=>reste.startsWith(normalizeSearchText(s.nom))||reste.startsWith(normalizeSearchText(s.abrege)));if(s)cible=s.nom;}
    parts.push(texte.slice(last,m.index),m[1]);
    const numeros=m[2];const num=/\d+(?:-\d+)?/g;let n,p=0;
    while((n=num.exec(numeros))){
      parts.push(numeros.slice(p,n.index));
      const vise=articleParCle(codex,cible,n[0]);
      parts.push(vise&&vise!==article?<button key={`${m.index}-${n.index}`} type="button" className="law-link law-renvoi" title={`${vise.abrege} art. ${vise.article} — ${vise.titre}`} onClick={()=>onNavigate(vise)}>{n[0]}</button>:n[0]);
      p=n.index+n[0].length;
    }
    parts.push(numeros.slice(p));last=m.index+m[0].length;
  }
  parts.push(texte.slice(last));
  return <div className="law-text">{parts.map((p,i)=>typeof p==="string"?<React.Fragment key={i}>{p}</React.Fragment>:p)}</div>;
}

export function LawModal({article,onClose,onOpenCodex,codex=null,peines=null,onNavigate=null,onRetenir=null,retenu=false}){
  const closeRef=useRef(onClose);closeRef.current=onClose;
  useEffect(()=>{
    if(!article)return;
    const previous=document.activeElement,overflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const dialog=document.querySelector(".law-modal");
    dialog?.querySelector("button")?.focus();
    function keys(event){
      if(event.key==="Escape"){event.preventDefault();event.stopPropagation();closeRef.current();}
      if(event.key!=="Tab"||!dialog)return;
      const controls=[...dialog.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')];
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
    document.addEventListener("keydown",keys);
    return()=>{document.body.style.overflow=overflow;document.removeEventListener("keydown",keys);previous?.focus();};
  },[article]);
  if(!article)return null;
  const memeSource=codex?codex.articles.filter(a=>a.source===article.source):[];
  const position=memeSource.findIndex(a=>a._cle===article._cle);
  const precedent=position>0?memeSource[position-1]:null,suivant=position>=0&&position<memeSource.length-1?memeSource[position+1]:null;
  const naviguer=onNavigate&&memeSource.length>1;
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className="law-modal" role="dialog" aria-modal="true" aria-labelledby="law-title"><div className="law-modal-header"><div><div className="law-modal-number">{article.abrege&&article.abrege!==article.source?`${article.abrege} · `:""}{article.article==="Préambule"?"Préambule":`Article ${article.article}`}</div><h2 id="law-title" className="law-modal-title">{article.titre}</h2></div><button aria-label="Fermer l’article" className="law-modal-close" onClick={onClose}>×</button></div><div className="law-modal-body"><div className="law-meta">{article.famille&&<span className="law-chip">{article.famille}</span>}<span className="law-chip">{article.source}</span>{article.local&&<span className="law-chip law-chip-local">Applicable localement</span>}{article.classification&&<span className="law-chip">{article.classification}</span>}{article.citable===false&&<span className="law-chip">Document de contexte — non citable</span>}{(article.montants?.length>0||renseigne(article.amende))&&<span className="law-chip">💰 {article.montants?.length?article.montants.join(" / "):article.amende} septims</span>}{(article.dureesCachot?.length>0||renseigne(article.cachot))&&<span className="law-chip">🔒 {article.dureesCachot?.length?article.dureesCachot.map(formatHours).join(" / "):formatHours(article.cachot)}</span>}{renseigne(article.travaux)&&<span className="law-chip">⚒ {formatHours(article.travaux)}</span>}</div>{(article.autorite||article.applicabilite)&&<div className="law-source-info">{article.autorite&&<div><strong>Autorité :</strong> {article.autorite}</div>}{article.applicabilite&&<div><strong>Domaine :</strong> {article.applicabilite}</div>}</div>}{article.texte&&<TexteArticle texte={article.texte} article={article} codex={codex} onNavigate={onNavigate}/>}{article.sanction&&<div className="law-sanction-box"><strong>⚖ Sanction</strong><div>{article.sanction}</div></div>}{peines&&<BaremeArticle peines={peines} article={article}/>}{article.alerte&&<div className="law-warning">⚠ <strong>Vérification nécessaire :</strong> {article.alerte}</div>}{naviguer&&<div className="law-nav"><button type="button" className="secondary-button" disabled={!precedent} onClick={()=>precedent&&onNavigate(precedent)} title={precedent?`Art. ${precedent.article} — ${precedent.titre}`:""}>← Article précédent</button><span className="law-nav-position">{position+1} / {memeSource.length}</span><button type="button" className="secondary-button" disabled={!suivant} onClick={()=>suivant&&onNavigate(suivant)} title={suivant?`Art. ${suivant.article} — ${suivant.titre}`:""}>Article suivant →</button></div>}<div className="form-actions">{onRetenir&&article.citable!==false&&<button type="button" className="primary-button" disabled={retenu} onClick={()=>onRetenir(article)}>{retenu?"Déjà retenu":"Retenir ce chef d’accusation"}</button>}{article.url&&<button type="button" className="secondary-button" onClick={()=>window.open(article.url,"_blank")}>Ouvrir le document source ↗</button>}{onOpenCodex&&<button type="button" className="secondary-button" onClick={()=>onOpenCodex(article)}>Voir dans le Codex</button>}</div></div></div></div>;}
