import panorama from "../assets/connexion-fond.jpg";
import sceau from "../assets/sceau.jpg";
import { nouvelEtatDiscord, urlConnexionDiscord, memoriserEtatDiscord } from "./connexion-discord.js";
import { libelleCodes } from "./compte.js";
import { NomEffectif } from "./fiche.jsx";

const paths={
  organigramme:'M12 3v6M5 15v-4h14v4M3 15h4v5H3zM10 15h4v5h-4zM17 15h4v5h-4zM9 3h6v5H9z',
  effectifs:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3a4 4 0 0 1 0 8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  presences:'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2M8 15l3 3 5-5',
  paye:'M5 6c0-1.4 3.1-2.5 7-2.5S19 4.6 19 6s-3.1 2.5-7 2.5S5 7.4 5 6M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5',
  codex:'M12 5v16M12 5C8 2 4 3 2 4v15c4-2 7-1 10 2 3-3 6-4 10-2V4c-2-1-6-2-10 1',
  peines:'M12 3v17M8 20h8M5 7h14M12 3v4M2 14l3-7 3 7M2 14a3 3 0 0 0 6 0M16 14l3-7 3 7M16 14a3 3 0 0 0 6 0',
  amendes:'M6 3h12v18l-3-2-3 2-3-2-3 2V3M9 7h6M9 11h6M9 15h3',
  prison:'M4 21V5l8-3 8 3v16M2 21h20M8 8v13M12 8v13M16 8v13M4 12h16',
  inventaire:'M3 10a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v10H3zM3 12h18M12 10v3M10 12h4v4h-4z',
  permis:'M3 21L19 5M19 5h-6M19 5v6M6 8L16 18M6 8Q16 8 16 18',
  shield:'M12 2l8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5l8-3zM8 12l3 3 5-6',
  cle:'M15 3a6 6 0 1 1-4.5 10L9 14.5V17H6.5v2.5H4V22H2v-3l7.5-7.5A6 6 0 0 1 15 3zM16 8h.01',
  exit:'M9 4H4v16h5M14 8l4 4-4 4M8 12h13'
};
export function RegistreIcon({name}) {return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]||paths.shield}/></svg>;}

// Le rôle public ne consulte que le Codex ; le serveur refuse tout le reste.
export const ROLE_PUBLIC="VISITEUR";
const LIBELLES_ROLE={OFFICIER:"Officier",GARDE:"Garde",INTENDANT:"Intendant",[ROLE_PUBLIC]:"Visiteur"};
// Libellés courts de la barre inférieure, où chaque entrée dispose de 45 px.
const LIBELLES_MOBILES={organigramme:"Hiérarchie",peines:"Peines",permis:"Permis"};

export function Header({role,nom="",via="",page,onPage,onLogout,onMotDePasse}) {
  // VISITEUR ne consulte que le Codex. INTENDANT est un code remis hors de la
  // garde — argentier, Thanes, cuisines — et n'a que l'effectif, la paye,
  // l'inventaire, le Codex et les décrets de peines et amendes, toujours sans
  // droit d'écriture. L'inventaire des coffres est une affaire d'officiers et
  // d'intendance : le GARDE ne le voit pas. Les permis de chasse sont tenus par
  // la garde (GARDE et OFFICIER), pas par l'intendance. La fiche de service
  // d'un effectif n'est pas une page du menu : elle s'ouvre en cliquant sur son nom.
  const pages=role===ROLE_PUBLIC
    ?[["codex","Codex"]]
    :role==="INTENDANT"
    ?[["organigramme","Organigramme"],["paye","Paye"],["inventaire","Inventaire"],["codex","Codex"],["peines","Peines et amendes"]]
    :[["organigramme","Organigramme"],...(role==="OFFICIER"?[["effectifs","Effectifs"]]:[]),["presences","Présences"],...(role==="OFFICIER"?[["paye","Paye"],["inventaire","Inventaire"]]:[]),["codex","Codex"],["peines","Peines et amendes"],["amendes","Amendes"],["prison","Prison"],["permis","Permis de chasse"]];
  // Le nom n'existe que pour une session nominative (compte personnel) ; un code commun n'identifie personne.
  const titreSession=nom?`Connecté : ${nom}`:undefined;
  return <header className="topbar">
    <div className="brand"><span className="brand-seal"><img src={sceau} alt=""/></span><div><span className="brand-overline">Châtellerie de</span><strong>Blancherive</strong><span className="brand-caption">Registre de la Garde</span></div></div>
    <div className="nav-caption">Le registre</div>
    <nav className={`nav${pages.length>=10?" nav-dense":""}`} aria-label="Navigation principale" style={{'--nav-count':pages.length}}>{pages.map(([key,label])=><button key={key} type="button" aria-label={label} aria-current={page===key?"page":undefined} className={page===key?"active":""} onClick={()=>{onPage(key);window.scrollTo(0,0);}}><RegistreIcon name={key}/><span className="nav-label-full">{label}</span><span className="nav-label-mobile">{LIBELLES_MOBILES[key]||label}</span></button>)}</nav>
    <div className="nav-footer">{nom&&<div className="session-nom" title={titreSession}><NomEffectif nom={nom}/></div>}<a className="external-link" href="https://registre-imperial.lovable.app/" target="_blank" rel="noopener noreferrer">Registre impérial <span aria-hidden="true">↗</span></a><div className="session-summary"><span className="role-badge" title={titreSession}><span className="session-dot"/>{LIBELLES_ROLE[role]||"Garde"}</span><span className="session-boutons">{via==="compte"&&onMotDePasse&&<button className="logout session-mdp" type="button" onClick={onMotDePasse} aria-label="Changer mon mot de passe" title="Changer mon mot de passe"><RegistreIcon name="cle"/></button>}<button className="logout" onClick={onLogout} aria-label={role===ROLE_PUBLIC?"Quitter la consultation":"Se déconnecter"} title={role===ROLE_PUBLIC?"Quitter la consultation":"Se déconnecter"}><RegistreIcon name="exit"/></button></span></div></div>
  </header>;
}

/*
  Cadre des écrans d'entrée (connexion, activation d'un compte) : la capture
  du jeu fournie par le propriétaire, Blancherive depuis les pins, passée en
  gravure sépia (`ui/assets/connexion-fond.jpg`), en fond pleine page ; un
  panneau uni au centre (décision du propriétaire, 10 novembre 2026 : plus de parchemin
  texturé ni de colonne illustrée). Le fond se remplace en changeant l'import.
*/
export function CadreConnexion({children,titre,eyebrow="Accès au registre"}) {
  return <div className="connexion" style={{"--connexion-fond":`url(${panorama})`}}><main className="connexion-carte">
    <header className="connexion-entete"><span className="connexion-sceau"><img src={sceau} alt=""/></span><p className="eyebrow">Châtellerie de Blancherive</p><h1>Registre de la Garde</h1><p className="connexion-devise">Veiller. Servir. <em>Protéger.</em></p></header>
    <p className="eyebrow connexion-section">{eyebrow}</p><h2>{titre}</h2>
    {children}
  </main></div>;
}

/*
  Écran de connexion. Les membres de la Garde entrent avec leur nom et leur
  mot de passe personnel (compte remis par un officier, compte.jsx). Le code
  d'accès commun reste derrière un lien, pour l'intendance et le secours ; le
  serveur dit quels codes il accepte encore (`getModesConnexion().codes`) et
  l'écran en tire le libellé. Discord n'est proposé que si le serveur l'ouvre.
*/
export function Login({onLogin,serverCall,discordRetour={}}) {
  const[nom,setNom]=React.useState("");const[motDePasse,setMotDePasse]=React.useState("");const[password,setPassword]=React.useState("");
  const[modeCode,setModeCode]=React.useState(false);const[error,setError]=React.useState("");const[busy,setBusy]=React.useState(false);const pending=React.useRef(false);
  const[modes,setModes]=React.useState(null);const[etat]=React.useState(nouvelEtatDiscord);
  React.useEffect(()=>{let vivant=true;serverCall("getModesConnexion").then(m=>{if(vivant)setModes(m);}).catch(()=>{if(vivant)setModes({discord:null});});return()=>{vivant=false;};},[]);
  const discord=modes?.discord;const enRetour=discordRetour.statut==="connexion";const occupe=busy||enRetour;const erreur=error||discordRetour.erreur||"";
  const codes=libelleCodes(modes?.codes);const codesOuverts=!modes||!Array.isArray(modes.codes)||modes.codes.length>0;
  async function submit(event){event.preventDefault();if(pending.current||enRetour)return;pending.current=true;setBusy(true);try{setError("");onLogin(modeCode?await serverCall("login",password):await serverCall("connecterCompte",nom,motDePasse));}catch(error){setError(error.message);}finally{pending.current=false;setBusy(false);}}
  // Consultation publique : aucun mot de passe, le serveur limite l'accès au Codex.
  async function consulter(){if(pending.current||enRetour)return;pending.current=true;setBusy(true);try{setError("");onLogin(await serverCall("ouvrirSessionPublique"));}catch(error){setError(error.message);}finally{pending.current=false;setBusy(false);}}
  // Le `state` est gardé au clic, juste avant de quitter la page pour Discord.
  function partirVersDiscord(event){if(occupe){event.preventDefault();return;}memoriserEtatDiscord(etat);}
  function basculer(){setModeCode(m=>!m);setError("");}
  return <CadreConnexion titre="Prendre son service"><form className="connexion-formulaire" onSubmit={submit}>{enRetour&&<p className="login-statut" role="status">Connexion Discord en cours…</p>}{discord&&<><p>Membres de la Garde : connectez-vous avec Discord, ou avec votre compte personnel.</p><a className="primary-button discord-button" href={urlConnexionDiscord(discord.url,etat)} target="_top" aria-disabled={occupe||undefined} onClick={partirVersDiscord}>Se connecter avec Discord<span aria-hidden="true">→</span></a><div className="login-separateur"><span>{modeCode?"ou avec un code d’accès":"ou avec votre compte"}</span></div></>}
    {modeCode
      ?<><p>{codes.aide}</p><label htmlFor="access-code">{codes.titre}</label><input id="access-code" type="password" autoComplete="current-password" required disabled={occupe} placeholder="Votre code d’accès" value={password} onChange={event=>setPassword(event.target.value)} aria-describedby={erreur?"login-error":undefined}/></>
      :<>{!discord&&<p>Membres de la Garde : votre nom tel qu’il figure au registre, et votre mot de passe personnel.</p>}<label htmlFor="login-nom">Nom</label><input id="login-nom" type="text" autoComplete="username" autoCapitalize="words" required disabled={occupe} placeholder="Prénom Nom" value={nom} onChange={event=>setNom(event.target.value)}/><label htmlFor="login-mdp">Mot de passe</label><input id="login-mdp" type="password" autoComplete="current-password" required disabled={occupe} placeholder="Votre mot de passe" value={motDePasse} onChange={event=>setMotDePasse(event.target.value)} aria-describedby={erreur?"login-error":undefined}/></>}
    <button className={discord?"secondary-button login-code-button":"primary-button"} disabled={occupe}>{busy?"Connexion en cours…":"Entrer dans le registre"}<span aria-hidden="true">→</span></button>
    {erreur&&<div id="login-error" className="error" role="alert">{erreur}</div>}
    {!modeCode&&<small className="login-aide">Pas encore de mot de passe ? Demandez votre lien de connexion à un officier.</small>}
    {codesOuverts&&<button type="button" className="login-lien" disabled={occupe} onClick={basculer}>{modeCode?"← Se connecter avec son nom et son mot de passe":`${codes.titre} →`}</button>}
    <div className="login-public"><p>Vous n’êtes pas de la Garde ?</p><button type="button" className="secondary-button" disabled={busy} onClick={consulter}>Consulter le Codex <span aria-hidden="true">→</span></button><small>Lecture seule des lois et décrets de la châtellerie.</small></div><div className="login-footnote"><RegistreIcon name="shield"/>Réservé aux membres de la Garde de Blancherive.</div></form></CadreConnexion>;
}
