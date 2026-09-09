import "./styles.css";
import { SaisiesField } from "./saisies.jsx";
import { ChangesProvider, RecentChanges, ChangeBadge, ChangesCount, useMemberChanges } from "./changes.jsx";

const {useEffect,useMemo,useRef,useState}=React;

function serverCall(name,...args){return new Promise((resolve,reject)=>{google.script.run.withSuccessHandler(resolve).withFailureHandler(error=>reject(new Error(error?.message||String(error))))[name](...args);});}
function normalizeSearchText(value){return String(value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
function formatHours(value){const n=Number(value);if(!Number.isFinite(n))return"";if(n<1)return`${Math.round(n*60)} min`;if(Number.isInteger(n))return`${n} h`;const h=Math.floor(n),m=Math.round((n-h)*60);return`${h} h ${m} min`;}
function formatSeptims(value){const n=Number(value)||0;return`${new Intl.NumberFormat("fr-FR").format(n)} septim${Math.abs(n)>1?"s":""}`;}
function findCodexArticle(articles,label){if(!articles||!label)return null;const exact=articles.find(a=>a.label===label);if(exact)return exact;const m=String(label).match(/Art\.?\s*([0-9IVXLCDM.\-]+)/i);if(!m)return null;return articles.find(a=>String(a.article).toLowerCase()===String(m[1]).toLowerCase()&&a.source==="Codex Judiciaire de Blancherive")||null;}

function App(){
  const[token,setToken]=useState(sessionStorage.getItem("guardAuthToken"));
  const[role,setRole]=useState(null);const[page,setPage]=useState("organigramme");const[codexFocus,setCodexFocus]=useState(null);
  useEffect(()=>{if(!token)return;serverCall("getSessionInfo",token).then(i=>setRole(i.role)).catch(logout);},[token]);
  function logout(){sessionStorage.removeItem("guardAuthToken");setToken(null);setRole(null);setPage("organigramme");}
  if(!token)return <Login onLogin={t=>{sessionStorage.setItem("guardAuthToken",t);setToken(t);}}/>;
  if(!role)return <div className="loading">Chargement...</div>;
  return <div className="app"><Header role={role} page={page} onPage={setPage} onLogout={logout}/><main className="content">
    {page==="organigramme"&&<OrganigrammePage token={token}/>} 
    {page==="effectifs"&&role==="OFFICIER"&&<EffectifsPage token={token}/>} 
    {page==="presences"&&<PresencesPage token={token} canEdit={role==="OFFICIER"}/>} 
    {page==="codex"&&<CodexPage token={token} focusArticle={codexFocus} onFocusConsumed={()=>setCodexFocus(null)}/>} 
    {page==="amendes"&&<AmendesPage token={token} canDelete={role==="OFFICIER"} onOpenCodex={a=>{setCodexFocus(a);setPage("codex");}}/>}
    {page==="prison"&&<PrisonPage token={token} canDelete={role==="OFFICIER"} onOpenCodex={a=>{setCodexFocus(a);setPage("codex");}}/>}
  </main></div>;
}

function Login({onLogin}){const[password,setPassword]=useState("");const[error,setError]=useState("");async function submit(e){e.preventDefault();try{setError("");onLogin(await serverCall("login",password));}catch(e){setError(e.message);}}return <div className="login-page"><form className="login-card" onSubmit={submit}><h1>Registre de la Garde</h1><p>Garde de Blancherive</p><input type="password" placeholder="Mot de passe" value={password} onChange={e=>setPassword(e.target.value)}/><button className="primary-button">Entrer</button>{error&&<div className="error">{error}</div>}</form></div>;}
function Header({role,page,onPage,onLogout}){const pages=[["organigramme","Organigramme"],...(role==="OFFICIER"?[["effectifs","Effectifs"]]:[]),["presences","Présences"],["codex","Codex"],["amendes","Amendes"],["prison","Prison"]];return <header className="topbar"><div className="brand">Garde de Blancherive</div><nav className="nav">{pages.map(([k,l])=><button key={k} className={page===k?"active":""} onClick={()=>onPage(k)}>{l}</button>)}</nav><a className="external-link" href="https://registre-imperial.lovable.app/" target="_blank" rel="noopener noreferrer">Registre impérial ↗</a><span className="role-badge">{role}</span><button className="logout" onClick={onLogout}>Déconnexion</button></header>;}

function effectifsStyle(style,fallback={}){
  if(!style)return fallback;

  return {
    ...fallback,
    ...(style.background
      ?{backgroundColor:style.background}
      :{}),
    ...(style.color
      ?{color:style.color}
      :{}),
    ...(style.fontWeight
      ?{fontWeight:style.fontWeight}
      :{})
  };
}

function EffectifsPage({token}){
  const[data,setData]=useState(null);
  const[search,setSearch]=useState("");
  const[activeCorps,setActiveCorps]=useState("ALL");
  const[showForm,setShowForm]=useState(false);
  const[error,setError]=useState("");
  const[success,setSuccess]=useState("");

  useEffect(()=>{
    serverCall(
      "getEffectifs",
      token
    )
      .then(setData)
      .catch(e=>
        setError(
          e.message
        )
      );
  },[]);

  /*
    Les quatre groupes de sortie définitive sont trans-corps :
    ils ne participent pas aux onglets de corps.
  */
  const activeRows=useMemo(()=>{
    if(!data){
      return[];
    }

    return data.rows.filter(
      member=>
        !member.terminalGroup
    );
  },[data]);

  const terminalRows=useMemo(()=>{
    if(!data){
      return[];
    }

    return data.rows.filter(
      member=>
        Boolean(
          member.terminalGroup
        )
    );
  },[data]);

  const corpsTabs=useMemo(()=>{
    if(!data){
      return[];
    }

    const values=[
      ...data.options.corps
    ];

    activeRows.forEach(member=>{
      if(
        member.corps &&
        !values.includes(
          member.corps
        )
      ){
        values.push(
          member.corps
        );
      }
    });

    return values;
  },[
    data,
    activeRows
  ]);

  const filteredActive=useMemo(()=>{
    const q=
      normalizeSearchText(
        search
      );

    return activeRows.filter(member=>{
      if(
        activeCorps!=="ALL" &&
        member.corps!==activeCorps
      ){
        return false;
      }

      if(!q){
        return true;
      }

      return normalizeSearchText([
        member.prenom,
        member.nom,
        member.grade,
        member.corps,
        member.specialite,
        member.status,
        member.assermente
          ?"assermente"
          :"non assermente",
        member.reserve
          ?"reserve"
          :""
      ].join(" "))
        .includes(q);
    });
  },[
    activeRows,
    search,
    activeCorps
  ]);

  /*
    Les groupes Morts / Radiés / Démissionnaires / Déserteurs
    restent toujours à la fin de la page, quel que soit l'onglet
    de corps sélectionné. La recherche, elle, s'applique aussi à eux.
  */
  const filteredTerminal=useMemo(()=>{
    const q=
      normalizeSearchText(
        search
      );

    if(!q){
      return terminalRows;
    }

    return terminalRows.filter(member=>
      normalizeSearchText([
        member.prenom,
        member.nom,
        member.grade,
        member.corps,
        member.specialite,
        member.status,
        member.terminalGroup
      ].join(" "))
        .includes(q)
    );
  },[
    terminalRows,
    search
  ]);

  const groupedByCorps=useMemo(()=>{
    if(!data){
      return[];
    }

    const corpsMap=
      new Map();

    filteredActive.forEach(member=>{
      const corps=
        member.corps||
        "Sans corps";

      if(
        !corpsMap.has(corps)
      ){
        corpsMap.set(
          corps,
          {
            active:new Map(),
            reserve:[]
          }
        );
      }

      const group=
        corpsMap.get(corps);

      if(member.reserve){
        group.reserve.push(
          member
        );
        return;
      }

      const grade=
        member.grade||
        "Sans grade";

      if(
        !group.active.has(
          grade
        )
      ){
        group.active.set(
          grade,
          []
        );
      }

      group.active
        .get(grade)
        .push(member);
    });

    const gradeOrder=
      data.gradeOrder||[];

    function sortMembers(members){
      return members.sort(
        (a,b)=>
          a.nomComplet.localeCompare(
            b.nomComplet,
            "fr"
          )
      );
    }

    return [...corpsMap.entries()]
      .sort(
        ([a],[b])=>
          a.localeCompare(
            b,
            "fr"
          )
      )
      .map(([corps,group])=>{
        const normalGroups=
          [...group.active.entries()]
            .sort(
              ([gradeA],[gradeB])=>{
                const a=
                  gradeOrder.indexOf(
                    gradeA
                  );

                const b=
                  gradeOrder.indexOf(
                    gradeB
                  );

                if(
                  a>=0 &&
                  b>=0
                ){
                  return a-b;
                }

                if(a>=0){
                  return -1;
                }

                if(b>=0){
                  return 1;
                }

                return gradeA.localeCompare(
                  gradeB,
                  "fr"
                );
              }
            )
            .map(
              ([grade,members])=>({
                type:"grade",
                grade,
                members:
                  sortMembers(
                    members
                  )
              })
            );

        /*
          Réserve vient désormais APRÈS TOUS les grades,
          y compris après Aspirant-Garde / Recrue.
        */
        if(
          group.reserve.length
        ){
          normalGroups.push({
            type:"reserve",
            grade:"Réserve",
            members:
              sortMembers(
                group.reserve
              )
          });
        }

        return{
          corps,
          groups:
            normalGroups
        };
      });
  },[
    data,
    filteredActive
  ]);

  const terminalGroups=useMemo(()=>{
    if(!data){
      return[];
    }

    const order=[
      "Morts",
      "Radiés",
      "Démissionnaires",
      "Déserteurs"
    ];

    const gradeOrder=
      data.gradeOrder||[];

    return order
      .map(label=>{
        const members=
          filteredTerminal
            .filter(
              member=>
                member.terminalGroup===label
            )
            .sort((a,b)=>{
              const gradeA=
                gradeOrder.indexOf(
                  a.grade
                );

              const gradeB=
                gradeOrder.indexOf(
                  b.grade
                );

              if(
                gradeA>=0 &&
                gradeB>=0 &&
                gradeA!==gradeB
              ){
                return gradeA-gradeB;
              }

              if(gradeA>=0){
                return -1;
              }

              if(gradeB>=0){
                return 1;
              }

              return a.nomComplet.localeCompare(
                b.nomComplet,
                "fr"
              );
            });

        return{
          label,
          members
        };
      })
      .filter(
        group=>
          group.members.length>0
      );
  },[
    data,
    filteredTerminal
  ]);

  if(
    error &&
    !data
  ){
    return(
      <div className="error">
        Erreur Effectifs : {error}
      </div>
    );
  }

  if(!data){
    return(
      <div className="loading">
        Chargement des effectifs...
      </div>
    );
  }

  const countForCorps=corps=>
    corps==="ALL"
      ?activeRows.length
      :activeRows.filter(
        member=>
          member.corps===corps
      ).length;

  return(
    <ChangesProvider data={data.changes}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Effectifs
          </h1>

          <p className="page-subtitle">
            Gestion des membres de la Garde — officiers uniquement.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={()=>{
            setShowForm(
              !showForm
            );
            setError("");
            setSuccess("");
          }}
        >
          {showForm
            ?"Fermer"
            :"+ Nouveau membre"
          }
        </button>
      </div>

      <div className="info-notice">
        Les membres courants sont regroupés par corps puis par grade.
        La Réserve apparaît à la fin de chaque corps, après tous les grades.
        Les morts, radiés, démissionnaires et déserteurs sont regroupés
        séparément tout en bas de la page, indépendamment de leur corps.
      </div>

      <RecentChanges onRefresh={async()=>setData(await serverCall("getEffectifs",token))}/>

      {error&&
        <div className="error">
          {error}
        </div>
      }

      {success&&
        <div className="success">
          {success}
        </div>
      }

      {showForm&&
        <NouvelEffectifForm
          options={data.options}
          initialCorps={
            activeCorps==="ALL"
              ?""
              :activeCorps
          }
          onSubmit={async form=>{
            try{
              setError("");

              const refreshed=
                await serverCall(
                  "ajouterEffectif",
                  token,
                  form
                );

              setData(
                refreshed
              );

              setShowForm(
                false
              );

              if(form.corps){
                setActiveCorps(
                  form.corps
                );
              }

              setSuccess(
                `${`${form.prenom} ${form.nom}`.trim()} a été ajouté aux effectifs.`
              );
            }catch(e){
              setError(
                e.message
              );
            }
          }}
        />
      }

      <div
        className="effectifs-tabs"
        role="tablist"
        aria-label="Corps de garde"
      >
        <button
          type="button"
          className={
            `effectifs-tab ${
              activeCorps==="ALL"
                ?"active"
                :""
            }`
          }
          onClick={()=>
            setActiveCorps(
              "ALL"
            )
          }
        >
          Tous
          <ChangesCount people={activeRows}/>

          <span className="effectifs-tab-count">
            {countForCorps(
              "ALL"
            )}
          </span>
        </button>

        {corpsTabs.map(corps=>{
          const style=
            data.options
              .styles
              ?.corps
              ?.[corps];

          return(
            <button
              type="button"
              key={corps}
              className={
                `effectifs-tab ${
                  activeCorps===corps
                    ?"active"
                    :""
                }`
              }
              onClick={()=>
                setActiveCorps(
                  corps
                )
              }
            >
              <span
                className="effectifs-tab-dot"
                style={
                  style?.background
                    ?{
                        backgroundColor:
                          style.background
                      }
                    :undefined
                }
              />

              {corps}
              <ChangesCount people={activeRows} corps={corps}/>

              <span className="effectifs-tab-count">
                {countForCorps(
                  corps
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="effectifs-toolbar-v3">
        <div className="effectifs-total">
          <strong>
            {activeCorps==="ALL"
              ?"Tous les corps"
              :activeCorps
            }
          </strong>

          <span>
            {filteredActive.length} membre
            {filteredActive.length!==1
              ?"s"
              :""
            }
          </span>
        </div>

        <input
          className="effectifs-search"
          type="search"
          placeholder="Rechercher nom, grade, spécialité, statut..."
          value={search}
          onChange={e=>
            setSearch(
              e.target.value
            )
          }
        />
      </div>

      <div className="effectifs-corps-groups">
        {groupedByCorps.length===0&&
          <div className="effectifs-empty">
            Aucun membre avec les filtres actuels.
          </div>
        }

        {groupedByCorps.map(corpsGroup=>{
          const corpsStyle=
            data.options
              .styles
              ?.corps
              ?.[corpsGroup.corps];

          const total=
            corpsGroup.groups.reduce(
              (sum,group)=>
                sum+
                group.members.length,
              0
            );

          return(
            <section
              className="effectifs-corps-group"
              key={
                corpsGroup.corps
              }
            >
              <div
                className="effectifs-corps-heading"
                style={
                  corpsStyle?.background
                    ?{
                        borderLeftColor:
                          corpsStyle.background
                      }
                    :undefined
                }
              >
                <div>
                  <div className="effectifs-corps-title">
                    {corpsGroup.corps}
                  </div>

                  <div className="effectifs-corps-subtitle">
                    {total} membre
                    {total!==1?"s":""}
                  </div>
                </div>
              </div>

              <div className="effectifs-grade-groups">
                {corpsGroup.groups.map(group=>{
                  const gradeStyle=
                    group.type==="reserve"
                      ?{
                          background:"#e6e6e6",
                          color:"#555555",
                          fontWeight:"700"
                        }
                      :data.options
                        .styles
                        ?.grades
                        ?.[group.grade];

                  return(
                    <section
                      className={
                        `effectifs-grade-group ${
                          group.type==="reserve"
                            ?"effectifs-reserve-group"
                            :""
                        }`
                      }
                      key={
                        `${group.type}-${group.grade}`
                      }
                    >
                      <div
                        className="effectifs-grade-heading"
                        style={
                          effectifsStyle(
                            gradeStyle,
                            {}
                          )
                        }
                      >
                        <span>
                          {group.type==="reserve"
                            ?"Réserve"
                            :group.grade
                          }
                        </span>

                        <span className="effectifs-grade-count">
                          {group.members.length}
                        </span>
                      </div>

                      <div className="effectifs-member-list">
                        {group.members.map(member=>
                          <EffectifCard
                            key={
                              `${member.row}-${member.prenom}-${member.nom}`
                            }
                            member={
                              member
                            }
                            options={
                              data.options
                            }
                            onSave={
                              async values=>{
                                try{
                                  setError("");
                                  setSuccess("");

                                  const refreshed=
                                    await serverCall(
                                      "modifierEffectif",
                                      token,
                                      {
                                        row:
                                          member.row,

                                        expectedPrenom:
                                          member.prenom,

                                        expectedNom:
                                          member.nom,

                                        grade:
                                          values.grade,

                                        corps:
                                          values.corps,

                                        specialite:
                                          values.specialite,

                                        status:
                                          values.status,

                                        assermente:
                                          values.assermente
                                      }
                                    );

                                  setData(
                                    refreshed
                                  );

                                  setSuccess(
                                    `${member.nomComplet} a été mis à jour.`
                                  );
                                }catch(e){
                                  setError(
                                    e.message
                                  );
                                }
                              }
                            }
                          />
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {terminalGroups.length>0&&
        <section className="effectifs-archives">
          <div className="effectifs-archives-heading">
            <div>
              <div className="effectifs-archives-title">
                Anciens membres
              </div>

              <div className="effectifs-archives-subtitle">
                Groupes trans-corps — conservés au registre
              </div>
            </div>
          </div>

          <div className="effectifs-terminal-groups">
            {terminalGroups.map(group=>
              <section
                className={
                  `effectifs-grade-group effectifs-terminal-group effectifs-terminal-${normalizeSearchText(group.label)}`
                }
                key={group.label}
              >
                <div className="effectifs-terminal-heading">
                  <span>
                    {group.label}
                  </span>

                  <span className="effectifs-grade-count">
                    {group.members.length}
                  </span>
                </div>

                <div className="effectifs-member-list">
                  {group.members.map(member=>
                    <EffectifCard
                      key={
                        `terminal-${member.row}-${member.prenom}-${member.nom}`
                      }
                      member={
                        member
                      }
                      options={
                        data.options
                      }
                      showCorps
                      onSave={
                        async values=>{
                          try{
                            setError("");
                            setSuccess("");

                            const refreshed=
                              await serverCall(
                                "modifierEffectif",
                                token,
                                {
                                  row:
                                    member.row,

                                  expectedPrenom:
                                    member.prenom,

                                  expectedNom:
                                    member.nom,

                                  grade:
                                    values.grade,

                                  corps:
                                    values.corps,

                                  specialite:
                                    values.specialite,

                                  status:
                                    values.status,

                                  assermente:
                                    values.assermente
                                }
                              );

                            setData(
                              refreshed
                            );

                            setSuccess(
                              `${member.nomComplet} a été mis à jour.`
                            );
                          }catch(e){
                            setError(
                              e.message
                            );
                          }
                        }
                      }
                    />
                  )}
                </div>
              </section>
            )}
          </div>
        </section>
      }
    </ChangesProvider>
  );
}


function NouvelEffectifForm({
  options,
  initialCorps,
  onSubmit
}){
  const active=
    options.statuses.find(
      value=>
        normalizeSearchText(value)===
        normalizeSearchText(
          "En service actif"
        )
    );

  const[form,setForm]=useState({
    prenom:"",
    nom:"",
    grade:
      options.grades[0]||"",
    corps:
      initialCorps||
      options.corps[0]||"",
    specialite:"",
    status:
      active||
      options.statuses[0]||"",
    assermente:false
  });

  const[saving,setSaving]=
    useState(false);

  async function submit(e){
    e.preventDefault();

    try{
      setSaving(true);
      await onSubmit(form);
    }finally{
      setSaving(false);
    }
  }

  return(
    <form
      className="form-card"
      onSubmit={submit}
    >
      <h2>
        Nouveau membre
      </h2>

      <div className="form-grid">
        <Field label="Prénom">
          <input
            value={form.prenom}
            onChange={e=>
              setForm({
                ...form,
                prenom:e.target.value
              })
            }
          />
        </Field>

        <Field label="Nom">
          <input
            value={form.nom}
            onChange={e=>
              setForm({
                ...form,
                nom:e.target.value
              })
            }
          />
        </Field>

        <Field label="Grade">
          <select
            required
            value={form.grade}
            style={
              effectifsStyle(
                options
                  .styles
                  ?.grades
                  ?.[form.grade],
                {}
              )
            }
            onChange={e=>
              setForm({
                ...form,
                grade:e.target.value
              })
            }
          >
            <option value="">
              Sélectionner…
            </option>

            {options.grades.map(
              value=>
                <option
                  key={value}
                  value={value}
                >
                  {value}
                </option>
            )}
          </select>
        </Field>

        <Field label="Corps de garde">
          <select
            required
            value={form.corps}
            style={
              effectifsStyle(
                options
                  .styles
                  ?.corps
                  ?.[form.corps],
                {}
              )
            }
            onChange={e=>
              setForm({
                ...form,
                corps:e.target.value
              })
            }
          >
            <option value="">
              Sélectionner…
            </option>

            {options.corps.map(
              value=>
                <option
                  key={value}
                  value={value}
                >
                  {value}
                </option>
            )}
          </select>
        </Field>

        <Field label="Spécialité">
          {options.specialites.length>0
            ?(
              <select
                value={form.specialite}
                style={
                  effectifsStyle(
                    options
                      .styles
                      ?.specialites
                      ?.[form.specialite],
                    {}
                  )
                }
                onChange={e=>
                  setForm({
                    ...form,
                    specialite:
                      e.target.value
                  })
                }
              >
                <option value="">
                  Aucune / non renseignée
                </option>

                {options.specialites.map(
                  value=>
                    <option
                      key={value}
                      value={value}
                    >
                      {value}
                    </option>
                )}
              </select>
            )
            :(
              <input
                value={form.specialite}
                onChange={e=>
                  setForm({
                    ...form,
                    specialite:
                      e.target.value
                  })
                }
                placeholder="Spécialité"
              />
            )
          }
        </Field>

        <Field label="Statut">
          <select
            required
            value={form.status}
            style={
              effectifsStyle(
                options
                  .styles
                  ?.statuses
                  ?.[form.status],
                {}
              )
            }
            onChange={e=>
              setForm({
                ...form,
                status:e.target.value
              })
            }
          >
            <option value="">
              Sélectionner…
            </option>

            {options.statuses.map(
              value=>
                <option
                  key={value}
                  value={value}
                >
                  {value}
                </option>
            )}
          </select>
        </Field>

        <div className="field">
          <label>
            Assermentation
          </label>

          <label className="effectif-check">
            <input
              type="checkbox"
              checked={
                form.assermente
              }
              onChange={e=>
                setForm({
                  ...form,
                  assermente:
                    e.target.checked
                })
              }
            />

            Assermenté
          </label>
        </div>
      </div>

      <div className="form-actions">
        <button
          className="primary-button"
          disabled={saving}
        >
          {saving
            ?"Enregistrement..."
            :"Ajouter le membre"
          }
        </button>
      </div>
    </form>
  );
}


function EffectifCard({
  member,
  options,
  onSave,
  showCorps=false
}){
  const memberChanges=useMemberChanges(member.memberId);
  const[editing,setEditing]=
    useState(false);

  const[grade,setGrade]=
    useState(member.grade);

  const[corps,setCorps]=
    useState(member.corps);

  const[specialite,setSpecialite]=
    useState(
      member.specialite||""
    );

  const[status,setStatus]=
    useState(member.status);

  const[assermente,setAssermente]=
    useState(
      member.assermente
    );

  const[saving,setSaving]=
    useState(false);

  useEffect(()=>{
    setGrade(
      member.grade
    );

    setCorps(
      member.corps
    );

    setSpecialite(
      member.specialite||""
    );

    setStatus(
      member.status
    );

    setAssermente(
      member.assermente
    );
  },[
    member.grade,
    member.corps,
    member.specialite,
    member.status,
    member.assermente
  ]);

  const changed=
    grade!==member.grade||
    corps!==member.corps||
    specialite!==(member.specialite||"")||
    status!==member.status||
    assermente!==member.assermente;

  async function save(){
    try{
      setSaving(true);

      await onSave({
        grade,
        corps,
        specialite,
        status,
        assermente
      });

      setEditing(false);
    }finally{
      setSaving(false);
    }
  }

  function cancel(){
    setGrade(
      member.grade
    );

    setCorps(
      member.corps
    );

    setSpecialite(
      member.specialite||""
    );

    setStatus(
      member.status
    );

    setAssermente(
      member.assermente
    );

    setEditing(false);
  }

  return(
    <article className="effectif-row" {...memberChanges.hoverProps}>
      <div className="effectif-identity">
        <div className="effectif-name">
          {member.nomComplet}
          <ChangeBadge change={memberChanges}/>
        </div>

        <div className="effectif-badges">
          {showCorps&&member.corps&&
            <span
              className="effectif-badge"
              style={
                effectifsStyle(
                  member
                    .styles
                    ?.corps,
                  {}
                )
              }
            >
              {member.corps}
            </span>
          }

          {member.specialite&&
            <span
              className="effectif-badge"
              style={
                effectifsStyle(
                  member
                    .styles
                    ?.specialite,
                  {}
                )
              }
            >
              {member.specialite}
            </span>
          }

          <span
            className="effectif-badge"
            style={
              effectifsStyle(
                member
                  .styles
                  ?.status,
                {}
              )
            }
          >
            {member.status||
              "Sans statut"
            }
          </span>

          <span
            className={
              `effectif-badge ${
                member.assermente
                  ?"effectif-badge-sworn"
                  :"effectif-badge-muted"
              }`
            }
          >
            {member.assermente
              ?"✓ Assermenté"
              :"Non assermenté"
            }
          </span>
        </div>
      </div>

      {!editing&&
        <button
          type="button"
          className="secondary-button effectif-edit-button"
          onClick={()=>
            setEditing(true)
          }
        >
          Modifier
        </button>
      }

      {editing&&
        <div className="effectif-editor">
          <div className="field">
            <label>
              Grade
            </label>

            <select
              value={grade}
              style={
                effectifsStyle(
                  options
                    .styles
                    ?.grades
                    ?.[grade],
                  {}
                )
              }
              onChange={e=>
                setGrade(
                  e.target.value
                )
              }
            >
              {options.grades.map(
                value=>
                  <option
                    key={value}
                    value={value}
                  >
                    {value}
                  </option>
              )}
            </select>
          </div>

          <div className="field">
            <label>
              Corps
            </label>

            <select
              value={corps}
              style={
                effectifsStyle(
                  options
                    .styles
                    ?.corps
                    ?.[corps],
                  {}
                )
              }
              onChange={e=>
                setCorps(
                  e.target.value
                )
              }
            >
              {options.corps.map(
                value=>
                  <option
                    key={value}
                    value={value}
                  >
                    {value}
                  </option>
              )}
            </select>
          </div>

          <div className="field">
            <label>
              Spécialité
            </label>

            {options.specialites.length>0
              ?(
                <select
                  value={
                    specialite
                  }
                  style={
                    effectifsStyle(
                      options
                        .styles
                        ?.specialites
                        ?.[specialite],
                      {}
                    )
                  }
                  onChange={e=>
                    setSpecialite(
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Aucune
                  </option>

                  {specialite &&
                    !options
                      .specialites
                      .includes(
                        specialite
                      ) &&
                    <option
                      value={
                        specialite
                      }
                    >
                      {specialite}
                    </option>
                  }

                  {options.specialites.map(
                    value=>
                      <option
                        key={value}
                        value={value}
                      >
                        {value}
                      </option>
                  )}
                </select>
              )
              :(
                <input
                  value={
                    specialite
                  }
                  onChange={e=>
                    setSpecialite(
                      e.target.value
                    )
                  }
                />
              )
            }
          </div>

          <div className="field">
            <label>
              Statut
            </label>

            <select
              value={status}
              style={
                effectifsStyle(
                  options
                    .styles
                    ?.statuses
                    ?.[status],
                  {}
                )
              }
              onChange={e=>
                setStatus(
                  e.target.value
                )
              }
            >
              {options.statuses.map(
                value=>
                  <option
                    key={value}
                    value={value}
                  >
                    {value}
                  </option>
              )}
            </select>
          </div>

          <label className="effectif-check effectif-editor-check">
            <input
              type="checkbox"
              checked={
                assermente
              }
              onChange={e=>
                setAssermente(
                  e.target.checked
                )
              }
            />

            Assermenté
          </label>

          <div className="effectif-editor-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={cancel}
              disabled={saving}
            >
              Annuler
            </button>

            <button
              type="button"
              className="primary-button"
              disabled={
                !changed||
                saving
              }
              onClick={save}
            >
              {saving
                ?"Enregistrement..."
                :"Enregistrer"
              }
            </button>
          </div>
        </div>
      }
    </article>
  );
}


function LawModal({article,onClose,onOpenCodex}){if(!article)return null;return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className="law-modal"><div className="law-modal-header"><div><div className="law-modal-number">{article.article==="Préambule"?"Préambule":`Article ${article.article}`}</div><h2 className="law-modal-title">{article.titre}</h2></div><button className="law-modal-close" onClick={onClose}>×</button></div><div className="law-modal-body"><div className="law-meta">{article.famille&&<span className="law-chip">{article.famille}</span>}<span className="law-chip">{article.source}</span>{article.local&&<span className="law-chip law-chip-local">Applicable localement</span>}{article.classification&&<span className="law-chip">{article.classification}</span>}{article.amende!==""&&<span className="law-chip">💰 {article.amende} septims</span>}{article.cachot!==""&&<span className="law-chip">🔒 {formatHours(article.cachot)}</span>}{article.travaux!==""&&<span className="law-chip">⚒ {formatHours(article.travaux)}</span>}</div>{(article.autorite||article.applicabilite)&&<div className="law-source-info">{article.autorite&&<div><strong>Autorité :</strong> {article.autorite}</div>}{article.applicabilite&&<div><strong>Domaine :</strong> {article.applicabilite}</div>}</div>}{article.texte&&<div className="law-text">{article.texte}</div>}{article.sanction&&<div className="law-sanction-box"><strong>⚖ Sanction</strong><div>{article.sanction}</div></div>}{article.alerte&&<div className="law-warning">⚠ <strong>Vérification nécessaire :</strong> {article.alerte}</div>}<div className="form-actions">{article.url&&<button className="secondary-button" onClick={()=>window.open(article.url,"_blank")}>Ouvrir le document source ↗</button>}{onOpenCodex&&<button className="secondary-button" onClick={()=>onOpenCodex(article)}>Voir dans le Codex</button>}</div></div></div></div>;}

function CodexPage({token,focusArticle,onFocusConsumed}){const[data,setData]=useState(null),[search,setSearch]=useState(""),[family,setFamily]=useState(""),[source,setSource]=useState(""),[classification,setClassification]=useState(""),[selected,setSelected]=useState(null),[error,setError]=useState("");useEffect(()=>{serverCall("getCodex",token).then(r=>{setData(r);if(focusArticle){setSelected(r.articles.find(a=>a.source===focusArticle.source&&a.article===focusArticle.article)||focusArticle);onFocusConsumed();}}).catch(e=>setError(e.message));},[]);const families=useMemo(()=>data?[...new Set(data.sources.map(s=>s.famille))]:[],[data]);const classes=useMemo(()=>data?[...new Set(data.articles.map(a=>a.classification).filter(Boolean))].sort():[],[data]);const filtered=useMemo(()=>{if(!data)return[];const q=normalizeSearchText(search);return data.articles.filter(a=>(!family||a.famille===family)&&(!source||a.source===source)&&(!classification||a.classification===classification)&&(!q||normalizeSearchText([a.article,a.titre,a.source,a.famille,a.classification,a.autorite,a.applicabilite,a.texte,a.sanction].join(" ")).includes(q)));},[data,search,family,source,classification]);if(error)return<div className="error">{error}</div>;if(!data)return<div className="loading">Chargement du Codex...</div>;return <><div className="page-header"><div><h1 className="page-title">Codex & Droit impérial</h1><p className="page-subtitle">Bibliothèque juridique de la Garde de Blancherive.</p></div></div><div className="codex-library">{families.map(f=><section className="codex-family" key={f}><h2 className="codex-family-title">{f}</h2><div className="codex-source-list">{data.sources.filter(s=>s.famille===f).map(s=><button key={s.nom} className={`codex-source-button ${source===s.nom?"active":""}`} onClick={()=>{setFamily(f);setSource(source===s.nom?"":s.nom);}}>{s.nom}<small>{s.applicabilite}</small></button>)}</div></section>)}</div><div className="codex-controls"><input type="search" placeholder="Rechercher une loi, un article, un mot..." value={search} onChange={e=>setSearch(e.target.value)}/><select value={family} onChange={e=>{setFamily(e.target.value);setSource("");}}><option value="">Toutes les familles</option>{families.map(v=><option key={v}>{v}</option>)}</select><select value={classification} onChange={e=>setClassification(e.target.value)}><option value="">Toutes classifications</option>{classes.map(v=><option key={v}>{v}</option>)}</select></div><div className="codex-count">{filtered.length} résultat{filtered.length!==1?"s":""}</div><div className="codex-list">{filtered.map((a,i)=><article className="codex-card" key={`${a.source}-${a.article}-${i}`} onClick={()=>setSelected(a)}><div className="codex-card-top"><div><div className="codex-card-number">{a.article==="Préambule"?"Préambule":`Article ${a.article}`}</div><h2 className="codex-card-title">{a.titre}</h2><div className="law-meta">{a.famille&&<span className="law-chip">{a.famille}</span>}{a.classification&&<span className="law-chip">{a.classification}</span>}{a.amende!==""&&<span className="law-chip">💰 {a.amende}</span>}{a.cachot!==""&&<span className="law-chip">🔒 {formatHours(a.cachot)}</span>}</div></div><div className="codex-card-source">{a.source}<br/>{a.autorite}</div></div>{a.texte&&<div className="codex-card-text">{a.texte}</div>}{a.sanction&&<div className="codex-card-sanction">⚖ {a.sanction}</div>}</article>)}</div><LawModal article={selected} onClose={()=>setSelected(null)}/></>}

function OrganigrammePage({token}) {
  const [data,setData]=useState(null), [error,setError]=useState("");
  useEffect(()=>{let active=true;serverCall("getOrganigramme",token).then(r=>{if(active)setData(r);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[token]);
  if(error)return <div className="error">{error}</div>;
  if(!data)return <div className="loading">Chargement de l'organigramme...</div>;
  const local = data.commandementLocal;
  const localKeys = local?.garnisonKeys || [];
  const directCorps = data.garnisons.filter(g => !localKeys.includes(g.key));
  const localCorps = data.garnisons.filter(g => localKeys.includes(g.key));
  return <ChangesProvider data={data.changes}><div className="org-page">
    <div className="page-header"><div><h1 className="page-title">Organigramme</h1><p className="page-subtitle">Garde de Blancherive · Chaîne de commandement</p></div><span className="org-seal">Au service de la châtellerie</span></div>
    <RecentChanges onRefresh={async()=>setData(await serverCall("getOrganigramme",token))}/>
    <section className="org-hierarchy" aria-label="État-Major et Hird du Jarl">
      <div className="org-command-heading">État-Major</div>
      <div className="org-sovereign"><CentralGroup personnes={data.jarl?[data.jarl]:[]} grade="Jarl"/></div>
      <aside className="org-hird-branch"><div className="org-direct-label">Autorité directe du Jarl</div><OrgCorps title="Hird du Jarl" people={data.hird} compact/></aside>
      <div className="org-command-chain"><CentralGroup personnes={data.marechaux} grade="Maréchal"/><CentralGroup personnes={data.commandants} grade="Commander"/><CentralGroup personnes={data.majorsEtatMajor} grade="Major" note="État-Major"/></div>
    </section>
    <section className="org-corps-section" aria-labelledby="org-corps-title">
      <div className="org-corps-heading"><span className="org-eyebrow">Sous l’autorité de l’État-Major central</span><h2 id="org-corps-title">Corps de garde & garnisons</h2><p>Rivebois et Bois-de-Chêne relèvent d’un commandement commun ; les autres corps répondent directement à l’État-Major.</p></div>
      <div className="org-corps-grid">
        {local && <section className="org-local-command" aria-label={local.nom}>
          <div className="org-local-heading"><h3>{local.nom}</h3><p>Sous les ordres directs de l’État-Major central</p></div>
          <CentralGroup personnes={local.majors} grade="Majors" note="Rivebois · Bois-de-Chêne"/>
          <div className="org-local-corps" aria-label="Garnisons sous les ordres du commandement commun">{localCorps.map(g=><OrgCorps key={g.key} title={g.nom} people={g.membres}/>)}</div>
        </section>}
        {directCorps.map(g=><OrgCorps key={g.key} title={g.nom} people={g.membres}/>)}</div>
    </section>
    <div className="org-detached"><Independent title="Majors hors commandement" subtitle="Autres Majors actifs, hors État-Major et commandement de Rivebois / Bois-de-Chêne" people={data.majors}/><Independent title="Réserve" subtitle="Tous corps et grades confondus" people={data.reserve}/></div>
  </div></ChangesProvider>;
}
function PersonCard({personne,center=false,showCorps=false}) {
  const memberChanges=useMemberChanges(personne?.memberId);
  if(!personne)return null;
  return <div className={`org-person ${center?"center":""}`} {...memberChanges.hoverProps}><div className="org-person-name">{personne.nomComplet}<ChangeBadge change={memberChanges}/></div>{showCorps&&personne.corps&&<div className="org-person-corps">{personne.corps}</div>}</div>;
}
function CentralGroup({personnes=[],grade,note}) {
  return <section className="org-command-node" aria-label={note?`${grade} — ${note}`:grade}><h3>{grade}{note&&<span>{note}</span>}</h3>{personnes.length?personnes.map((p,i)=><PersonCard key={i} personne={p} center/>):<div className="org-vacant">Poste vacant</div>}</section>;
}
function RankedPeople({personnes=[],showCorps=false}) {
  if(!personnes.length)return <div className="org-empty">Aucun personnel.</div>;
  const groups=[];
  personnes.forEach(p=>{let g=groups.find(x=>x.grade===p.grade);if(!g){g={grade:p.grade,people:[]};groups.push(g);}g.people.push(p);});
  return groups.map(g=><section className="org-rank-group" key={g.grade}><h4 className="org-rank-title">{g.grade}<span>{g.people.length}</span></h4><div className="org-rank-members">{g.people.map((p,i)=><PersonCard key={i} personne={p} showCorps={showCorps}/>)}</div></section>);
}
function OrgCorps({title,people=[],compact=false}) {
  const captains=people.filter(p=>normalizeSearchText(p.grade).trim()==="capitaine");
  const others=people.filter(p=>normalizeSearchText(p.grade).trim()!=="capitaine");
  return <article className={`org-unit ${compact?"org-unit-hird":""}`}>
    <header className="org-unit-header"><h3>{title} <ChangesCount people={people}/></h3><span className="org-count" title="Personnel en service actif">{people.length}</span></header>
    <div className="org-captains"><div className="org-eyebrow">Capitaine{captains.length>1?"s":""}</div>{captains.length?captains.map((p,i)=><PersonCard key={i} personne={p}/>):<div className="org-empty">Poste vacant</div>}</div>
    <details className="org-roster" open={compact?undefined:true}><summary>Personnel <span>{others.length}</span> <ChangesCount people={others}/></summary><div className="org-roster-body"><RankedPeople personnes={others}/></div></details>
  </article>;
}
function Independent({title,subtitle,people=[]}) {
  return <section className="org-independent-block"><header><div><h2>{title}</h2><p>{subtitle}</p></div><span className="org-count">{people.length}</span></header><RankedPeople personnes={people} showCorps/></section>;
}
function AmendesPage({token,canDelete,onOpenCodex}){const[data,setData]=useState(null),[formData,setFormData]=useState(null),[codex,setCodex]=useState(null),[selected,setSelected]=useState(null),[showForm,setShowForm]=useState(false),[error,setError]=useState(""),[deletingRow,setDeletingRow]=useState(null);useEffect(()=>{Promise.all([serverCall("getAmendes",token),serverCall("getAmendeFormData",token),serverCall("getCodex",token)]).then(([r,f,c])=>{setData(r);setFormData(f);setCodex(c.articles);}).catch(e=>setError(e.message));},[]);if(error&&!data)return<div className="error">{error}</div>;if(!data||!formData||!codex)return<div className="loading">Chargement des amendes...</div>;const openLaw=l=>{const a=findCodexArticle(codex,l);if(a)setSelected(a);};async function del(item){if(!canDelete||!confirm(`Supprimer définitivement cette amende ?\n\n${item.contrevenant}\n${item.infraction}`))return;try{setDeletingRow(item.row);setData(await serverCall("supprimerAmende",token,item.row));}catch(e){setError(e.message);}finally{setDeletingRow(null);}}return <><div className="page-header"><h1 className="page-title">Amendes</h1><button className="primary-button" onClick={()=>setShowForm(!showForm)}>{showForm?"Fermer":"+ Nouvelle amende"}</button></div>{error&&<div className="error">{error}</div>}{showForm&&<AmendeForm data={formData} onOpenLaw={openLaw} onSubmit={async f=>{try{setData(await serverCall("ajouterAmende",token,f));setShowForm(false);}catch(e){setError(e.message);}}}/>}<div className="registry"><div className="registry-table-wrap"><table className="registry-table"><thead><tr><th>Date</th><th>Garde</th><th>Contrevenant</th><th>Infraction</th><th>Montant</th><th>Payé</th><th>Reversé</th>{canDelete&&<th>Actions</th>}</tr></thead><tbody>{data.rows.map(i=><tr key={i.row} className={i.paye&&i.reverse?"fine-reversed":i.paye?"fine-paid":"fine-unpaid"}><td>{i.date}</td><td>{i.garde}<div className="fine-recipient">{i.collecteurs.length?<>↳ À reverser à : {i.collecteurs.join(" ou ")}{i.fallbackEtatMajor?" (État-Major)":""}</>:"↳ Aucun collecteur désigné"}</div></td><td>{i.contrevenant}</td><td><button className="law-link" onClick={()=>openLaw(i.infraction)}>{i.infraction} ⓘ</button></td><td>{i.montant||"À déterminer"}</td><td className="cell-center"><input type="checkbox" checked={i.paye} onChange={async e=>{try{setData(await serverCall("modifierAmendeCheckbox",token,i.row,6,e.target.checked));}catch(x){setError(x.message);}}}/></td><td className="cell-center"><input type="checkbox" checked={i.reverse} disabled={!canDelete} onChange={async e=>{try{setData(await serverCall("modifierAmendeCheckbox",token,i.row,7,e.target.checked));}catch(x){setError(x.message);}}}/></td>{canDelete&&<td><button className="danger-button" disabled={deletingRow===i.row} onClick={()=>del(i)}>{deletingRow===i.row?"...":"Supprimer"}</button></td>}</tr>)}</tbody></table></div></div><LawModal article={selected} onClose={()=>setSelected(null)} onOpenCodex={onOpenCodex}/></>}
function AmendeForm({data,onSubmit,onOpenLaw}){
  const[form,setForm]=useState({date:new Date().toISOString().slice(0,10),garde:"",contrevenant:"",infraction:""});
  const[submitting,setSubmitting]=useState(false);
  const submittingRef=useRef(false);
  const selected=data.infractions.find(i=>i.label===form.infraction);

  async function submit(e){
    e.preventDefault();

    if(submittingRef.current){
      return;
    }

    submittingRef.current=true;
    setSubmitting(true);

    try{
      await onSubmit(form);
    }finally{
      submittingRef.current=false;
      setSubmitting(false);
    }
  }

  return <form className="form-card" onSubmit={submit}><fieldset className="form-fieldset" disabled={submitting}><h2>Nouvelle amende</h2><div className="form-grid"><Field label="Date"><input type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></Field><Field label="Garde"><select required value={form.garde} onChange={e=>setForm({...form,garde:e.target.value})}><option value="">Sélectionner…</option>{data.gardes.map(g=><option key={g}>{g}</option>)}</select></Field><Field label="Contrevenant"><input required value={form.contrevenant} onChange={e=>setForm({...form,contrevenant:e.target.value})}/></Field><div className="field field-wide"><label>Infraction</label><select required value={form.infraction} onChange={e=>setForm({...form,infraction:e.target.value})}><option value="">Sélectionner…</option>{data.infractions.map(i=><option key={i.label} value={i.label}>{i.label}</option>)}</select>{form.infraction&&<div className="law-info-row"><button type="button" className="law-info-button" onClick={()=>onOpenLaw(form.infraction)}>ⓘ Consulter cet article</button></div>}</div><Field label="Montant prévu"><input readOnly value={!selected?"":selected.montant===""?"À déterminer":`${selected.montant} septims`}/></Field></div><div className="form-actions"><button type="submit" className="primary-button">{submitting?"Enregistrement…":"Enregistrer"}</button></div></fieldset></form>;
}

function PrisonPage({token,canDelete,onOpenCodex}){const[data,setData]=useState(null),[formData,setFormData]=useState(null),[codex,setCodex]=useState(null),[selected,setSelected]=useState(null),[showForm,setShowForm]=useState(false),[error,setError]=useState(""),[deletingRow,setDeletingRow]=useState(null),[saving,setSaving]=useState(false);useEffect(()=>{Promise.all([serverCall("getPrison",token),serverCall("getPrisonFormData",token),serverCall("getCodex",token)]).then(([r,f,c])=>{setData(r);setFormData(f);setCodex(c.articles);}).catch(e=>setError(e.message));},[]);if(error&&!data)return<div className="error">{error}</div>;if(!data||!formData||!codex)return<div className="loading">Chargement de la prison...</div>;const openLaw=l=>{const a=findCodexArticle(codex,l);if(a)setSelected(a);};async function del(item){if(!canDelete||!confirm(`Supprimer définitivement cette incarcération ?\n\n${item.detenu}\n${item.infraction}`))return;try{setDeletingRow(item.row);setData(await serverCall("supprimerPrison",token,item.row));}catch(e){setError(e.message);}finally{setDeletingRow(null);}}return <><div className="page-header"><h1 className="page-title">Prison</h1><button className="primary-button" disabled={saving} onClick={()=>setShowForm(!showForm)}>{showForm?"Fermer":"+ Nouvelle incarcération"}</button></div>{error&&<div className="error">{error}</div>}{showForm&&<PrisonForm token={token} data={formData} onOpenLaw={openLaw} onSubmit={async f=>{setSaving(true);setError("");try{setData(await serverCall("ajouterPrison",token,f));setShowForm(false);}catch(e){setError(e.message);}finally{setSaving(false);}}}/>}<div className="registry"><div className="registry-table-wrap"><table className="registry-table prison-table"><thead><tr><th>Date</th><th>Garde</th><th>Détenu</th><th>Cellule</th><th>Infraction</th><th>Durée</th><th>Entrée</th><th>Sortie prévue</th><th>Libéré</th><th>Saisies</th><th>Notes</th>{canDelete&&<th>Actions</th>}</tr></thead><tbody>{data.rows.map(i=><tr key={i.row} className={i.libere?"prison-released":"prison-active"}><td>{i.date}</td><td>{i.garde}</td><td>{i.detenu}</td><td>{i.cellule||"—"}</td><td><button className="law-link" onClick={()=>openLaw(i.infraction)}>{i.infraction} ⓘ</button></td><td>{i.duree||"À déterminer"}</td><td>{i.entree}</td><td>{i.sortie||"—"}</td><td className="cell-center"><input type="checkbox" checked={i.libere} onChange={async e=>{try{setData(await serverCall("modifierPrisonLibere",token,i.row,e.target.checked));}catch(x){setError(x.message);}}}/></td><td className="saisies-cell">{i.saisies||"—"}</td><td>{i.notes||"—"}</td>{canDelete&&<td><button className="danger-button" disabled={deletingRow===i.row} onClick={()=>del(i)}>{deletingRow===i.row?"...":"Supprimer"}</button></td>}</tr>)}</tbody></table></div></div><LawModal article={selected} onClose={()=>setSelected(null)} onOpenCodex={onOpenCodex}/></>}
function PrisonForm({token,data,onSubmit,onOpenLaw}){
  const now=new Date(),local=new Date(now.getTime()-now.getTimezoneOffset()*60000);
  const[form,setForm]=useState({date:local.toISOString().slice(0,10),garde:"",detenu:"",cellule:"",infraction:"",entree:local.toISOString().slice(0,16),saisies:[],notes:""});
  const[submitting,setSubmitting]=useState(false);
  const[saisieEnCours,setSaisieEnCours]=useState(false);
  const[saisieError,setSaisieError]=useState("");
  const submittingRef=useRef(false);
  const selected=data.infractions.find(i=>i.label===form.infraction);

  async function submit(e){
    e.preventDefault();

    if(submittingRef.current){
      return;
    }

    if(saisieEnCours){setSaisieError("Ajoutez l’objet en cours à la liste ou effacez la recherche avant d’enregistrer.");return;}
    setSaisieError("");
    submittingRef.current=true;
    setSubmitting(true);

    try{
      await onSubmit(form);
    }finally{
      submittingRef.current=false;
      setSubmitting(false);
    }
  }

  return <form className="form-card" onSubmit={submit}><fieldset className="form-fieldset" disabled={submitting}><h2>Nouvelle incarcération</h2><div className="form-grid"><Field label="Date"><input type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></Field><Field label="Garde"><select required value={form.garde} onChange={e=>setForm({...form,garde:e.target.value})}><option value="">Sélectionner…</option>{data.gardes.map(g=><option key={g}>{g}</option>)}</select></Field><Field label="Détenu"><input required value={form.detenu} onChange={e=>setForm({...form,detenu:e.target.value})}/></Field><Field label="Cellule"><input value={form.cellule} onChange={e=>setForm({...form,cellule:e.target.value})}/></Field><div className="field field-wide"><label>Infraction</label><select required value={form.infraction} onChange={e=>setForm({...form,infraction:e.target.value})}><option value="">Sélectionner…</option>{data.infractions.map(i=><option key={i.label} value={i.label}>{i.label}</option>)}</select>{form.infraction&&<div className="law-info-row"><button type="button" className="law-info-button" onClick={()=>onOpenLaw(form.infraction)}>ⓘ Consulter cet article</button></div>}</div><Field label="Durée prévue"><input readOnly value={!selected?"":selected.duree===""?"À déterminer":formatHours(selected.duree)}/></Field><Field label="Heure d'entrée"><input type="datetime-local" required value={form.entree} onChange={e=>setForm({...form,entree:e.target.value})}/></Field><SaisiesField token={token} value={form.saisies} disabled={submitting} serverCall={serverCall} onPendingChange={pending=>{setSaisieEnCours(pending);setSaisieError("");}} onChange={saisies=>setForm(previous=>({...previous,saisies}))}/>{saisieError&&<div className="field-full error" role="alert">{saisieError}</div>}<div className="field field-full"><label>Motif / Notes</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></div></div><div className="form-actions"><button type="submit" className="primary-button">{submitting?"Enregistrement…":"Enregistrer"}</button></div></fieldset></form>;
}
function Field({label,children}){return<div className="field"><label>{label}</label>{children}</div>;}

function PresenceOfficerDashboard({token}){const[data,setData]=useState(null),[error,setError]=useState("");useEffect(()=>{serverCall("getPresenceOfficerDashboard",token).then(setData).catch(e=>setError(e.message));},[]);if(error)return<div className="error">{error}</div>;if(!data)return<div className="loading">Chargement du tableau de bord...</div>;return <><div className="presence-dashboard-cards"><Stat label={`Coût anticipé — semaine ${data.currentWeek}`} value={formatSeptims(data.currentWeekTotal)}/><Stat label="Déjà réglé cette semaine" value={formatSeptims(data.currentWeekPaid)} sub={`Reste : ${formatSeptims(data.currentWeekRemaining)}`}/><Stat label="Impayés des semaines passées" value={data.pastUnpaidCount} warning/><Stat label="Montant total des impayés" value={formatSeptims(data.pastUnpaidAmount)} danger/><Stat label="Amendes de la semaine déjà reversées" value={formatSeptims(data.currentWeekRecoveredFines)} sub="Amendes datées du lundi au dimanche de la semaine courante."/></div><div className="presence-inactive-panel"><div className="presence-inactive-header"><strong>Gardes à surveiller</strong><span>{data.inactive.length}</span></div><div className="presence-inactive-list">{data.inactive.map((g,i)=><div className="presence-inactive-person" key={i}><div className="presence-inactive-name">{g.nomComplet}</div><div className="presence-inactive-meta">{[g.grade,g.corps].filter(Boolean).join(" — ")}</div><div className="presence-inactive-alert">{g.jamaisPresent?"Jamais présent dans le registre":`Dernière présence : ${g.dernierePresence} (${g.joursDepuis} jours)`}</div></div>)}</div></div></>}
function Stat({label,value,sub,warning,danger}){return<div className={`presence-stat-card ${warning?"presence-stat-warning":""} ${danger?"presence-stat-danger":""}`}><div className="presence-stat-label">{label}</div><div className="presence-stat-value">{value}</div>{sub&&<div className="presence-stat-sub">{sub}</div>}</div>;}
function PresencesPage({token,canEdit}){const[data,setData]=useState(null),[error,setError]=useState(""),[weekFilter,setWeekFilter]=useState(""),[search,setSearch]=useState("");useEffect(()=>{serverCall("getPresences",token).then(setData).catch(e=>setError(e.message));},[]);if(error)return<div className="error">Erreur de chargement des présences : {error}</div>;if(!data)return<div className="loading">Chargement des présences...</div>;const weeks=new Map();data.rows.forEach(r=>{if(!weeks.has(r.semaine))weeks.set(r.semaine,[]);weeks.get(r.semaine).push(r);});const weekEntries=[...weeks.entries()].sort((a,b)=>b[0]-a[0]);const searchTerms=normalizeSearchText(search).trim().split(/\s+/).filter(Boolean);const matchesPerson=r=>searchTerms.every(term=>normalizeSearchText(`${r.prenom} ${r.nom}`).includes(term));const filteredWeeks=weekEntries.filter(([week,rows])=>(!weekFilter||String(week)===weekFilter)&&rows.some(matchesPerson));return <><div className="page-header"><div><h1 className="page-title">Présences</h1><p className="page-subtitle">Suivi des présences et des soldes.</p></div></div>{canEdit&&<PresenceOfficerDashboard token={token}/>} {!canEdit&&<div className="readonly-notice">🔒 Consultation en lecture seule — seuls les officiers peuvent modifier les présences et le règlement des soldes.</div>}<div className="presence-week-filter"><label htmlFor="presence-week-filter">Semaine</label><select id="presence-week-filter" value={weekFilter} onChange={e=>setWeekFilter(e.target.value)}><option value="">Toutes les semaines</option>{weekEntries.map(([week])=><option key={week} value={week}>Semaine {week}</option>)}</select><label htmlFor="presence-search">Rechercher une personne</label><input id="presence-search" type="search" placeholder="Prénom ou nom…" value={search} onChange={e=>setSearch(e.target.value)}/></div>{canEdit&&<p className="page-subtitle">Coût total estimé : somme des soldes de tout le corps pour la semaine, paiements inclus, selon les présences enregistrées.</p>}{filteredWeeks.length===0&&<p role="status">Aucune présence ne correspond aux filtres sélectionnés.</p>}{filteredWeeks.map(([w,r])=><WeekSection key={w} week={w} rows={r} currentWeek={data.currentWeek} canEdit={canEdit} token={token} onRefresh={setData} corpsTotals={data.corpsTotals||[]} matchesPerson={matchesPerson} searching={searchTerms.length>0}/>)}</>}
function WeekSection({week,rows,currentWeek,canEdit,token,onRefresh,corpsTotals,matchesPerson,searching}){const groups=new Map(),current=Number(week)===Number(currentWeek),[open,setOpen]=useState(current);useEffect(()=>{if(searching)setOpen(true);},[searching]);rows.forEach(r=>{const k=r.corps||"Sans corps";if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);});return<section className={`week-section ${current?"week-current":"week-old"}`}><button type="button" className="week-header week-toggle" onClick={()=>setOpen(!open)} aria-expanded={open}><span>Semaine {week}</span><span>{current?"Semaine courante · ":""}{open?"▾":"▸"}</span></button>{open&&[...groups.entries()].filter(([,soldiers])=>soldiers.some(matchesPerson)).map(([corps,soldiers])=><div key={corps}><div className="corps-title presence-corps-title"><span>{corps}</span>{canEdit&&<span>Coût total estimé : {formatSeptims(corpsTotals.find(t=>t.semaine===week&&t.corps===corps)?.total||0)}</span>}</div><div className="presence-table-wrap"><table className="presence-table"><thead><tr><th>Garde</th>{["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(d=><th key={d}>{d}</th>)}<th>Jours</th><th>Solde</th><th>Payé</th></tr></thead><tbody>{soldiers.filter(matchesPerson).map(s=><tr key={s.row} className={current?"row-current":s.paye?"row-paid":s.soldeRaw>0?"row-unpaid":""}><td><strong>{s.prenom} {s.nom}</strong><div className="grade">{s.grade}</div></td>{s.jours.map((c,i)=><td key={i}><input type="checkbox" checked={c} disabled={!canEdit} onChange={async e=>onRefresh(await serverCall("modifierPresence",token,s.row,6+i,e.target.checked))}/></td>)}<td>{s.joursPresents}</td><td>{s.solde}</td><td><input type="checkbox" checked={s.paye} disabled={!canEdit} onChange={async e=>onRefresh(await serverCall("modifierPresence",token,s.row,15,e.target.checked))}/></td></tr>)}</tbody></table></div></div>)}</section>}

export { App };
