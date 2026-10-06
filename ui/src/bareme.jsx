import { referenceChef } from './codex.js';
import { niveauxArticle, valeurNiveau, propositionBareme, libelleQualification, formatSeptims, formatDuree, resumeNiveaux, FOURCHETTES, JOURS_FAIT_ISOLE_NOBLE } from './peines.js';
import { DateRP } from './calendrier.jsx';

const { useEffect, useRef } = React;

// Classe de couleur d'une qualification, partagée avec les jetons des chefs.
export function classeQualification(qualification) {
  return ['contravention', 'délit', 'crime'].includes(qualification) ? qualification : 'autre';
}

export function PuceQualification({ niveau }) {
  return <span className={`law-chip chef-qualif chef-qualif-${classeQualification(niveau.qualification)}`}>
    {libelleQualification(niveau.qualification)}{niveau.echelon ? ` · ${niveau.echelon}` : ''}
  </span>;
}

/*
  Rachat nobiliaire d'un niveau : l'amende proposée à un noble à la place du
  cachot (De Re Nobilitatis, art. 9), sauf crime de sang.
*/
export function NobleNiveau({ niveau }) {
  if (niveau._renvoi) return '—';
  if (niveau.sang) return <span className="bareme-sang" title="De Re Nobilitatis, art. 9 : pas d’amende de substitution pour un crime de sang.">Sans rachat (crime de sang)</span>;
  if (niveau.nobiliaire) return <span title="Amende proposée à un noble à la place du cachot (De Re Nobilitatis, art. 9).">{formatSeptims(niveau.nobiliaire)}</span>;
  if (niveau._pm) return <span title="De Re Nobilitatis, art. 10 et 12.">Décision conjointe</span>;
  return <span className="bareme-muet" title="Sans cachot, rien à racheter : le noble paie l’amende ordinaire.">—</span>;
}

/*
  Niveaux d'un article, tels que la lecture d'un article et la page des
  décrets les montrent : le cas, sa qualification, l'amende, le cachot, le
  rachat nobiliaire, puis les peines complémentaires et les observations.
*/
export function NiveauxBareme({ niveaux }) {
  return <ul className="bareme-niveaux">{niveaux.map(n => <li key={n._index} className={`bareme-niveau bareme-niveau-${classeQualification(n.qualification)}`}>
    <div className="bareme-niveau-cas">
      <strong>{n.niveau}</strong>
      <PuceQualification niveau={n}/>
    </div>
    {!n._renvoi && <dl className="bareme-niveau-valeurs">
      <div><dt>Amende</dt><dd>{n.amende ? formatSeptims(n.amende) : n._pm ? 'Peine maximale' : '—'}</dd></div>
      <div><dt>Cachot</dt><dd>{n.cachot ? formatDuree(n.cachot) : '—'}</dd></div>
      <div><dt>Rachat noble</dt><dd><NobleNiveau niveau={n}/></dd></div>
    </dl>}
    {n.complements && <p className="bareme-complement"><span>Peines complémentaires</span> {n.complements}</p>}
    {n.observations && <p className="bareme-observation">{n.observations}</p>}
  </li>)}</ul>;
}

// Barème d'un article dans sa lecture en popup ; rien s'il n'en a pas.
export function BaremeArticle({ peines, article }) {
  const niveaux = niveauxArticle(peines, article.source, article.article);
  if (!niveaux.length) return null;
  const toutLeTexte = niveaux[0].article === '*';
  return <section className="law-bareme" aria-labelledby="law-bareme-titre">
    <h3 id="law-bareme-titre">⚖ Décret des peines{toutLeTexte ? ' — tout le texte' : ''}</h3>
    <NiveauxBareme niveaux={niveaux}/>
    <p className="law-bareme-note">Barème indicatif dans les fourchettes impériales : la sentence reste à l’appréciation de l’autorité. Récidive : peine doublée. Un noble se voit proposer l’amende nobiliaire à la place du cachot, hors crime de sang.</p>
  </section>;
}

// Puce de résumé pour une carte du Codex.
export function PuceBareme({ peines, article }) {
  const resume = resumeNiveaux(niveauxArticle(peines, article.source, article.article));
  return resume ? <span className="law-chip law-chip-bareme" title="Décret des peines et amendes">⚖ {resume}</span> : null;
}

function valeurLisible(valeur, type) {
  const amende = valeur.amende ? formatSeptims(valeur.amende) : '';
  const cachot = valeur.cachot ? `${formatDuree(valeur.cachot)} de cachot` : '';
  return (type === 'cachot' ? [cachot, amende] : [amende, cachot]).filter(Boolean).join(' · ');
}

/*
  Proposition du barème dans les formulaires Amendes (`type="amende"`) et
  Prison (`type="cachot"`). Chaque chef retient un de ses niveaux ; la
  récidive double la peine, un noble rachète le cachot. La proposition remplit
  le champ de sentence tant que l'autorité ne l'a pas modifié elle-même :
  une valeur saisie à la main n'est jamais écrasée.
*/
export function PropositionBareme({ type, peines, statut = 'pret', chefs, reglages, onReglages, valeur, indetermine, onAppliquer, historique = null, disabled }) {
  const r = { choix: {}, noble: false, recidive: false, mode: 'cumul', ...(reglages || {}) };
  const p = propositionBareme(peines, chefs, r);
  const montant = type === 'amende';
  const proposee = montant ? p.total.amende : p.total.cachot;
  // `undefined` au montage : la première proposition remplit un champ vide.
  const derniere = useRef(undefined);

  useEffect(() => {
    const precedente = derniere.current;
    derniere.current = proposee;
    if (indetermine || precedente === proposee) return;
    const courante = String(valeur ?? '').trim();
    const cible = proposee === null ? '' : String(proposee);
    // Suivre la proposition seulement si le champ est vide ou en porte encore
    // la valeur précédente : une saisie de l'autorité n'est pas écrasée.
    const suivie = courante === '' || (precedente !== undefined && precedente !== null && courante === String(precedente));
    if (suivie && courante !== cible) onAppliquer(cible);
  }, [proposee]);

  const regler = changement => onReglages({ ...r, ...changement });
  const choisir = (cle, index) => regler({ choix: { ...r.choix, [cle]: index } });
  const ecart = !indetermine && proposee !== null && String(valeur ?? '').trim() !== '' && Number(valeur) !== proposee;
  const autre = montant ? (p.total.cachot ? `Ces chefs prévoient aussi ${formatDuree(p.total.cachot)} de cachot : à inscrire au registre de la Prison.` : '')
    : (p.total.amende ? `Ces chefs prévoient aussi une amende de ${formatSeptims(p.total.amende)} : à inscrire au registre des Amendes.` : '');

  let corps;
  if (!peines && statut === 'chargement') corps = <p className="saisie-help">Chargement du barème des peines…</p>;
  else if (!peines) corps = <p className="saisie-help">Le barème des peines n’a pas pu être chargé : saisissez la sentence librement.</p>;
  else if (!chefs.length) corps = <p className="saisie-help">Retenez un chef d’accusation : le barème proposera {montant ? 'le montant' : 'la durée'}.</p>;
  else corps = <>
    <ul className="bareme-chefs" aria-label="Niveau retenu pour chaque chef">{p.lignes.map((l, i) => <li key={l.cle || `libre-${i}`}>
      <div className="bareme-chef-titre"><span className="chef-ref">{referenceChef(l.chef)}</span>{l.libre ? l.chef.libre : l.chef.titre}</div>
      {l.libre ? <p className="bareme-chef-note">Référence libre : hors barème.</p>
        : l.niveaux.length ? <div className="bareme-choix" role="radiogroup" aria-label={`Niveau retenu pour ${referenceChef(l.chef)}`}>
          {l.niveaux.map((n, index) => <label key={n._index} className={`bareme-option ${index === l.index ? 'active' : ''}`}>
            <input type="radio" name={`bareme-${type}-${l.cle}`} checked={index === l.index} disabled={disabled} onChange={() => choisir(l.cle, index)}/>
            <span className="bareme-option-cas">{n.niveau} <PuceQualification niveau={n}/></span>
            <span className="bareme-option-valeur">{n._pm ? 'Peine maximale' : valeurLisible(valeurNiveau(n, r), type) || '—'}</span>
          </label>)}
        </div>
        : !l.renvois.length && <p className="bareme-chef-note">Pas de barème pour cet article : sentence à l’appréciation de l’autorité.</p>}
      {l.renvois.map(n => <p key={n._index} className="bareme-renvoi"><strong>{n.niveau}.</strong> {n.observations}{n.complements ? ` ${n.complements}` : ''}</p>)}
    </li>)}</ul>
    <div className="bareme-reglages">
      <label className="saisie-free-toggle"><input type="checkbox" checked={r.recidive} disabled={disabled} onChange={e => regler({ recidive: e.target.checked })}/><span>Récidive — peine doublée</span></label>
      <label className="saisie-free-toggle"><input type="checkbox" checked={r.noble} disabled={disabled} onChange={e => regler({ noble: e.target.checked })}/><span>{montant ? 'Contrevenant noble' : 'Détenu noble'}</span></label>
    </div>
    {p.retenues > 1 && <div className="chefs-filtre-groupe bareme-mode" role="group" aria-label="Calcul de la proposition">
      <button type="button" className={`chefs-filtre ${p.mode === 'cumul' ? 'active' : ''}`} aria-pressed={p.mode === 'cumul'} disabled={disabled} onClick={() => regler({ mode: 'cumul' })}>Faits distincts — peines cumulées</button>
      <button type="button" className={`chefs-filtre ${p.mode === 'grave' ? 'active' : ''}`} aria-pressed={p.mode === 'grave'} disabled={disabled} onClick={() => regler({ mode: 'grave' })}>Même fait — qualification la plus rigoureuse</button>
    </div>}
    <div className="bareme-total" role="status">
      {proposee !== null
        ? <span>Proposition du barème : <strong>{montant ? formatSeptims(proposee) : `${formatDuree(proposee)} de cachot`}</strong>{r.recidive ? ' (récidive comprise)' : ''}</span>
        : <span>{p.peineMaximale ? 'Peine maximale : sur verdict public et motivé du magistrat.' : montant ? 'Le barème ne propose pas d’amende pour ces chefs.' : 'Le barème ne propose pas de cachot pour ces chefs.'}</span>}
      {proposee !== null && (indetermine || String(valeur ?? '').trim() !== String(proposee)) && <button type="button" className="secondary-button" disabled={disabled} onClick={() => onAppliquer(String(proposee))}>Reprendre la proposition</button>}
    </div>
    {p.qualification && <p className="bareme-note">Qualification la plus grave retenue : <strong>{libelleQualification(p.qualification).toLowerCase()}</strong>{FOURCHETTES[p.qualification] ? `, fourchette impériale ${FOURCHETTES[p.qualification].fourchette}` : ''}.</p>}
    {ecart && <p className="bareme-note">{montant ? 'Le montant saisi' : 'La durée saisie'} s’écarte de la proposition : c’est l’appréciation de l’autorité qui fait foi.</p>}
    {autre && <p className="bareme-note">{autre}</p>}
    {p.sansBareme > 0 && <p className="bareme-note">{p.sansBareme} chef{p.sansBareme > 1 ? 's' : ''} sans barème : la proposition ne {p.sansBareme > 1 ? 'les' : 'le'} compte pas.</p>}
    {r.noble && <NoticeNoble p={p} montant={montant} historique={historique}/>}
  </>;

  return <section className="field field-full bareme-proposition" aria-labelledby={`bareme-titre-${type}`}>
    <h3 id={`bareme-titre-${type}`}>Barème des peines</h3>
    {corps}
  </section>;
}

/*
  Rappels du De Re Nobilitatis pour un contrevenant noble : fait isolé sur
  sept jours (art. 8), amende toujours proposée hors crime de sang (art. 9),
  décision conjointe pour l'emprisonnement et la peine capitale (art. 12).
*/
function NoticeNoble({ p, montant, historique }) {
  return <div className="bareme-noble">
    <strong>Noblesse — De Re Nobilitatis</strong>
    <ul>
      {p.mineur && <li>
        Art. 8 : une contravention ou un délit isolé sur {JOURS_FAIT_ISOLE_NOBLE} jours n’est pas poursuivi ; il faut une nouvelle infraction de même nature dans ce délai.
        {historique && (historique.length
          ? <> Inscrit à ce nom ces {JOURS_FAIT_ISOLE_NOBLE} derniers jours : {historique.map((row, i) => <React.Fragment key={row.row}>{i ? ' ; ' : ''}<DateRP value={row.date} jour={false}/>{row.infraction ? ` — ${row.infraction}` : ''}</React.Fragment>)}.</>
          : ` Aucune entrée à ce nom dans ce registre ces ${JOURS_FAIT_ISOLE_NOBLE} derniers jours.`)}
      </li>}
      {p.rachat && <li>Art. 9 : le cachot est remplacé par l’amende nobiliaire{montant ? ', comprise dans la proposition' : ' ; la proposition ne compte plus de cachot'}.</li>}
      {p.sang && <li>Art. 9 : crime de sang, aucune amende de substitution n’est due.</li>}
      {(p.total.cachot || p.peineMaximale) && <li>Art. 12 : l’emprisonnement{p.peineMaximale ? ', la mise à mort honorable' : ''} d’un noble exige une décision conjointe avec le Jarl.</li>}
      <li>Art. 10 : pas de travaux forcés pour un noble.</li>
    </ul>
  </div>;
}
