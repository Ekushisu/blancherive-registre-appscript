export function MotifSanction({form,setForm,infractions,onOpenLaw,valueKey}) {
  function changer(changes) { setForm(previous => ({...previous,...changes,[valueKey]:""})); }
  return <div className="field field-wide">
    <label><input type="checkbox" checked={Boolean(form.personnalisee)} onChange={e=>changer({personnalisee:e.target.checked,infraction:""})}/> Motif personnalisé (décret, décision…)</label>
    <label>{form.personnalisee?"Motif et référence du décret ou de la décision":"Infraction du Codex"}
      {form.personnalisee
        ? <textarea required maxLength={1000} value={form.infraction} onChange={e=>setForm(previous=>({...previous,infraction:e.target.value}))}/>
        : <select required value={form.infraction} onChange={e=>changer({infraction:e.target.value})}>
          <option value="">Sélectionner…</option>
          {infractions.map(item=><option key={item.label} value={item.label}>{item.label}</option>)}
        </select>}
    </label>
    {!form.personnalisee&&form.infraction&&<div className="law-info-row"><button type="button" className="law-info-button" onClick={()=>onOpenLaw(form.infraction)}>ⓘ Consulter cet article</button></div>}
  </div>;
}

export function ChoixSanction({selected,personnalisee,value,onChange,type}) {
  const sanction=personnalisee?{options:[],libre:true,texte:""}:selected?.sanction;
  const options=sanction?.options||[];
  const [libre,setLibre]=React.useState(Boolean(sanction?.libre&&!options.length));
  const montant=type==="amende";
  const label=montant?"Montant (septims)":"Durée de cachot (heures)";
  const fixe=options.length===1&&!sanction?.libre;
  const effective=value??"";
  return <div className="field field-wide">
    <label>{label}
      {fixe?<input readOnly value={options[0].value}/>:
        sanction&&(options.length>0||sanction.libre)?<>
          {options.length>0&&<select required value={libre?"libre":effective} onChange={e=>{const free=e.target.value==="libre";setLibre(free);onChange(free?"":e.target.value);}}>
            <option value="">Choisir le niveau applicable…</option>
            {options.map((option,index)=><option key={index} value={option.value}>{option.label}</option>)}
            {sanction.libre&&<option value="libre">À l’appréciation de l’autorité — saisie libre</option>}
          </select>}
          {libre&&<input type="number" required min={montant?1:0.000001} step={montant?1:"any"} value={effective} onChange={e=>onChange(e.target.value)} placeholder={montant?"Montant retenu":"Ex. 0,5 pour 30 minutes"}/>}
        </>:<input readOnly value={selected?"À déterminer — actualisez le Codex":"Sélectionnez une infraction"}/>}
    </label>
    {sanction?.texte&&<p style={{whiteSpace:"pre-line"}}>{sanction.texte}</p>}
    {libre&&!personnalisee&&<small>À fixer conformément à l’article et à la décision de l’autorité compétente.</small>}
  </div>;
}
