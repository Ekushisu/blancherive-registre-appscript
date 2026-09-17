import fortDragon from "../assets/fort-dragon.jpg";
import sceau from "../assets/sceau.jpg";

const paths={
  organigramme:'M12 3v6M5 15v-4h14v4M3 15h4v5H3zM10 15h4v5h-4zM17 15h4v5h-4zM9 3h6v5H9z',
  effectifs:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3a4 4 0 0 1 0 8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  presences:'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2M8 15l3 3 5-5',
  paye:'M5 6c0-1.4 3.1-2.5 7-2.5S19 4.6 19 6s-3.1 2.5-7 2.5S5 7.4 5 6M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5',
  codex:'M12 5v16M12 5C8 2 4 3 2 4v15c4-2 7-1 10 2 3-3 6-4 10-2V4c-2-1-6-2-10 1',
  amendes:'M6 3h12v18l-3-2-3 2-3-2-3 2V3M9 7h6M9 11h6M9 15h3',
  prison:'M4 21V5l8-3 8 3v16M2 21h20M8 8v13M12 8v13M16 8v13M4 12h16',
  shield:'M12 2l8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5l8-3zM8 12l3 3 5-6',
  exit:'M9 4H4v16h5M14 8l4 4-4 4M8 12h13'
};
export function RegistreIcon({name}) {return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]||paths.shield}/></svg>;}

// Le rôle public ne consulte que le Codex ; le serveur refuse tout le reste.
export const ROLE_PUBLIC="VISITEUR";
const LIBELLES_ROLE={OFFICIER:"Officier",GARDE:"Garde",INTENDANT:"Intendant",[ROLE_PUBLIC]:"Visiteur"};

export function Header({role,page,onPage,onLogout}) {
  // VISITEUR ne consulte que le Codex. INTENDANT est un code remis hors de la
  // garde — argentier, Thanes, cuisines — et n'a que l'effectif et la paye,
  // toujours sans droit d'écriture.
  const pages=role===ROLE_PUBLIC
    ?[["codex","Codex"]]
    :role==="INTENDANT"
    ?[["organigramme","Organigramme"],["paye","Paye"]]
    :[["organigramme","Organigramme"],...(role==="OFFICIER"?[["effectifs","Effectifs"]]:[]),["presences","Présences"],...(role==="OFFICIER"?[["paye","Paye"]]:[]),["codex","Codex"],["amendes","Amendes"],["prison","Prison"]];
  return <header className="topbar">
    <div className="brand"><span className="brand-seal"><img src={sceau} alt=""/></span><div><span className="brand-overline">Châtellerie de</span><strong>Blancherive</strong><span className="brand-caption">Registre de la Garde</span></div></div>
    <div className="nav-caption">Le registre</div>
    <nav className="nav" aria-label="Navigation principale" style={{'--nav-count':pages.length}}>{pages.map(([key,label])=><button key={key} type="button" aria-label={label} aria-current={page===key?"page":undefined} className={page===key?"active":""} onClick={()=>{onPage(key);window.scrollTo(0,0);}}><RegistreIcon name={key}/><span className="nav-label-full">{label}</span><span className="nav-label-mobile">{key==="organigramme"?"Hiérarchie":label}</span></button>)}</nav>
    <div className="nav-footer"><a className="external-link" href="https://registre-imperial.lovable.app/" target="_blank" rel="noopener noreferrer">Registre impérial <span aria-hidden="true">↗</span></a><div className="session-summary"><span className="role-badge"><span className="session-dot"/>{LIBELLES_ROLE[role]||"Garde"}</span><button className="logout" onClick={onLogout} aria-label={role===ROLE_PUBLIC?"Quitter la consultation":"Se déconnecter"} title={role===ROLE_PUBLIC?"Quitter la consultation":"Se déconnecter"}><RegistreIcon name="exit"/></button></div></div>
  </header>;
}

export function Login({onLogin,serverCall}) {
  const[password,setPassword]=React.useState("");const[error,setError]=React.useState("");const[busy,setBusy]=React.useState(false);const pending=React.useRef(false);
  async function submit(event){event.preventDefault();if(pending.current)return;pending.current=true;setBusy(true);try{setError("");onLogin(await serverCall("login",password));}catch(error){setError(error.message);}finally{pending.current=false;setBusy(false);}}
  // Consultation publique : aucun mot de passe, le serveur limite l'accès au Codex.
  async function consulter(){if(pending.current)return;pending.current=true;setBusy(true);try{setError("");onLogin(await serverCall("ouvrirSessionPublique"));}catch(error){setError(error.message);}finally{pending.current=false;setBusy(false);}}
  return <div className="login-page"><section className="login-intro"><img className="login-art" src={fortDragon} alt="Illustration de Fort-Dragon"/><span className="login-insignia"><RegistreIcon name="shield"/></span><p className="eyebrow">Châtellerie de Blancherive</p><h1>Veiller.<br/>Servir.<br/><em>Protéger.</em></h1><p className="login-description">Le registre de la Garde.<br/>Les effectifs, le service et la justice,<br/>réunis en un même lieu.</p><span className="login-rule"/></section><div className="login-form-wrap"><form className="login-card" onSubmit={submit}><p className="eyebrow">Accès au registre</p><h2>Prendre son service</h2><p>Identifiez-vous avec votre code de garde ou d’officier.</p><label htmlFor="access-code">Code d’accès</label><input id="access-code" type="password" autoComplete="current-password" required disabled={busy} placeholder="Votre code d’accès" value={password} onChange={event=>setPassword(event.target.value)} aria-describedby={error?"login-error":undefined}/><button className="primary-button" disabled={busy}>{busy?"Connexion en cours…":"Entrer dans le registre"}<span aria-hidden="true">→</span></button>{error&&<div id="login-error" className="error" role="alert">{error}</div>}<div className="login-public"><p>Vous n’êtes pas de la Garde ?</p><button type="button" className="secondary-button" disabled={busy} onClick={consulter}>Consulter le Codex <span aria-hidden="true">→</span></button><small>Lecture seule des lois et décrets de la châtellerie.</small></div><div className="login-footnote"><RegistreIcon name="shield"/>Réservé aux membres de la Garde de Blancherive.</div></form></div></div>;
}
