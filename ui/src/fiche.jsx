// Fiche de service d'un effectif (décision du propriétaire, 1er novembre
// 2026) : un clic sur un nom, partout où le registre l'affiche, l'ouvre dans
// un panneau par-dessus la page, qui garde ainsi ses filtres et sa position.
// Depuis la fiche, un supérieur ouvre la sienne ; « Retour » revient à la
// précédente. Lecture seule ; le serveur (`getFicheService`) décide de ce que
// chaque rôle reçoit : pas de Justice pour l'intendance.

import { libelleCorps, libelleGrade } from "./corps.js";
import { GradeDescription } from "./grades.jsx";
import { DateRP } from "./calendrier.jsx";
import { titreSemaine } from "./semaine.js";

const { createContext, useContext, useEffect, useMemo, useRef, useState } = React;
const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function septims(valeur) {
  const n = Number(valeur) || 0;
  return `${new Intl.NumberFormat("fr-FR").format(n)} septim${Math.abs(n) > 1 ? "s" : ""}`;
}

export function pluriel(n, singulier, plurielForme = singulier + "s") {
  return `${new Intl.NumberFormat("fr-FR").format(Number(n) || 0)} ${Math.abs(Number(n) || 0) > 1 ? plurielForme : singulier}`;
}

// Une ligne de carrière, telle que le journal des Effectifs la décrit.
export function libelleEvenement(evenement) {
  if (evenement.type === "grade") {
    return `Élevé au grade de ${evenement.apres}${evenement.avant ? `, auparavant ${evenement.avant}` : ""}`;
  }
  if (evenement.type === "corps") {
    return `Affecté à ${libelleCorps(evenement.apres)}${evenement.avant ? `, venant de ${libelleCorps(evenement.avant)}` : ""}`;
  }
  if (evenement.type === "arrivee") return "Inscription au registre de la Garde";
  if (evenement.type === "nom") return `Nom changé en ${evenement.apres}, auparavant ${evenement.avant}`;
  return evenement.apres || evenement.type;
}

// Dernier service : « aujourd'hui », « hier », « il y a 4 jours ».
export function depuisJours(n) {
  if (n === null || n === undefined) return "";
  if (n <= 0) return "aujourd’hui";
  if (n === 1) return "hier";
  return `il y a ${n} jours`;
}

// ---------------------------------------------------------------- cache

// Même rapprochement que le serveur (`cleNomFiche_`) : sans casse, accents ni espaces superflus.
export function cleNomFiche(nom) {
  return String(nom ?? "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

/*
  Fiches connues, en mémoire seulement : perdues au rechargement et à la
  déconnexion, jamais écrites dans le navigateur, puisqu'elles portent les
  soldes et les amendes d'autrui. Rangées par ID membre et par nom, comme le
  serveur les cherche ; `depuis` (heure de la demande) empêche une réponse
  plus ancienne d'écraser une plus récente.
*/
export function memoriserFiche(cache, data, depuis) {
  const fiche = data?.fiche;
  if (!cache || !fiche) return;
  const nom = cleNomFiche(fiche.nomComplet);
  const cles = [fiche.memberId && `id:${fiche.memberId}`, nom && `nom:${nom}`].filter(Boolean);
  for (const cle of cles) {
    const actuelle = cache.get(cle);
    if (!actuelle || actuelle.depuis <= depuis) cache.set(cle, { data, depuis });
  }
}

export function ficheEnCache(cache, cible) {
  if (!cache || !cible) return null;
  const nom = cleNomFiche(cible.nom);
  return (cible.membre && cache.get(`id:${cible.membre}`)) || (nom && cache.get(`nom:${nom}`)) || null;
}

// ---------------------------------------------------------------- ouverture

const FicheContext = createContext(null);
// Laisse passer d'abord la page affichée à la connexion.
const DELAI_PRECHARGEMENT = 1500;

/*
  Pile des fiches ouvertes : un nom cliqué hors du panneau en ouvre une
  première, un supérieur cliqué dans le panneau s'y empile. Sans fournisseur
  (visiteur du Codex), les noms restent du texte.

  Au lancement, toutes les fiches sont chargées en arrière-plan, en un seul
  appel (décision du propriétaire, 1er novembre 2026) : une fiche s'ouvre
  alors aussitôt, puis se met à jour en silence. Si ce chargement échoue,
  chaque fiche se charge simplement à son ouverture.
*/
export function FicheProvider({ token, serverCall, children, delaiPrechargement = DELAI_PRECHARGEMENT }) {
  const [pile, setPile] = useState([]);
  const cache = useRef(null);
  if (!cache.current) cache.current = new Map();
  const valeur = useMemo(() => ({ ouvrir: cible => setPile(p => [...p, cible]) }), []);

  useEffect(() => {
    const minuteur = setTimeout(() => {
      const depuis = Date.now();
      serverCall("getFichesService", token)
        .then(reponse => (reponse?.fiches || []).forEach(data => memoriserFiche(cache.current, data, depuis)))
        .catch(() => {});
    }, delaiPrechargement);
    return () => clearTimeout(minuteur);
  }, [token]);

  return <FicheContext.Provider value={valeur}>
    {children}
    {pile.length > 0 && <FichePanneau token={token} serverCall={serverCall} cache={cache.current} cible={pile[pile.length - 1]}
      profondeur={pile.length} onRetour={() => setPile(p => p.slice(0, -1))} onFermer={() => setPile([])} />}
  </FicheContext.Provider>;
}

/*
  Nom d'un effectif, qui ouvre sa fiche. `membre` : son ID membre quand la
  page le connaît, sinon le serveur le retrouve par son nom. Le clic ne
  remonte pas : un nom posé sur une ligne ou une carte cliquable n'ouvre que
  la fiche.
*/
export function NomEffectif({ nom, membre = "", children }) {
  const fiche = useContext(FicheContext);
  const libelle = String(nom || "").trim();
  const contenu = children ?? libelle;
  if (!fiche || !libelle) return <>{contenu}</>;
  return <button type="button" className="nom-effectif" title={`Fiche de ${libelle}`}
    onClick={event => { event.stopPropagation(); fiche.ouvrir({ membre: String(membre || ""), nom: libelle }); }}>
    {contenu}
  </button>;
}

// ---------------------------------------------------------------- panneau

export function FichePanneau({ token, serverCall, cache = null, cible, profondeur = 1, onRetour, onFermer }) {
  const [etat, setEtat] = useState({ data: null, erreur: "", miseAJour: false, avertissement: "" });
  const panneau = useRef(null);
  const fermerRef = useRef(onFermer);
  fermerRef.current = onFermer;

  // Fiche déjà chargée : affichée aussitôt, puis rafraîchie en silence.
  useEffect(() => {
    let vivant = true;
    const connue = ficheEnCache(cache, cible);
    setEtat({ data: connue?.data || null, erreur: "", miseAJour: true, avertissement: "" });
    panneau.current?.scrollTo?.(0, 0);
    const depuis = Date.now();
    serverCall("getFicheService", token, cible)
      .then(data => {
        if (!vivant) return;
        memoriserFiche(cache, data, depuis);
        setEtat({ data, erreur: "", miseAJour: false, avertissement: "" });
      })
      .catch(e => {
        if (!vivant) return;
        setEtat(connue
          ? { data: connue.data, erreur: "", miseAJour: false, avertissement: `Mise à jour impossible : ${e.message}` }
          : { data: null, erreur: e.message, miseAJour: false, avertissement: "" });
      });
    return () => { vivant = false; };
  }, [cible]);

  // Comme la modale du Codex : page figée, Échap pour fermer, focus gardé dans le panneau.
  useEffect(() => {
    const precedent = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panneau.current?.focus();
    function touches(event) {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); fermerRef.current(); }
      if (event.key !== "Tab" || !panneau.current) return;
      const controles = [...panneau.current.querySelectorAll("button:not(:disabled),a[href]")];
      const premier = controles[0], dernier = controles[controles.length - 1];
      if (event.shiftKey && document.activeElement === premier) { event.preventDefault(); dernier?.focus(); }
      else if (!event.shiftKey && document.activeElement === dernier) { event.preventDefault(); premier?.focus(); }
    }
    document.addEventListener("keydown", touches);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", touches); precedent?.focus?.(); };
  }, []);

  const { data, erreur, miseAJour, avertissement } = etat;
  return <div className="modal-backdrop fiche-fond" onMouseDown={event => { if (event.target === event.currentTarget) onFermer(); }}>
    <div className="fiche-panneau" role="dialog" aria-modal="true" aria-labelledby="fiche-titre" tabIndex={-1} ref={panneau}>
      <div className="fiche-barre">
        <div className="fiche-barre-gauche">
          {profondeur > 1 && <button type="button" className="secondary-button fiche-retour" onClick={onRetour}>← Retour</button>}
          {data && (miseAJour || avertissement) && <span className="fiche-maj" role="status">{avertissement || "Mise à jour…"}</span>}
        </div>
        <button type="button" className="fiche-fermer" aria-label="Fermer la fiche" onClick={onFermer}>×</button>
      </div>
      {erreur
        ? <div className="error" role="alert">{erreur}</div>
        : data
          ? <FicheContenu data={data} />
          : <div className="loading" role="status">Ouverture de la fiche{cible?.nom ? ` de ${cible.nom}` : ""}…</div>}
    </div>
  </div>;
}

// ---------------------------------------------------------------- contenu

function Section({ titre, sousTitre, children }) {
  return <section className="fiche-section">
    <header className="fiche-section-entete"><h2>{titre}</h2>{sousTitre && <p>{sousTitre}</p>}</header>
    {children}
  </section>;
}

function Tuile({ valeur, libelle, detail }) {
  return <div className="fiche-tuile"><strong>{valeur}</strong><span>{libelle}</span>{detail && <small>{detail}</small>}</div>;
}

function Personne({ personne }) {
  return <li className="fiche-personne">
    <span className="fiche-personne-grade">{libelleGrade(personne.grade, personne.corps)}</span>
    <span className="fiche-personne-nom"><NomEffectif nom={personne.nomComplet} membre={personne.memberId} /></span>
  </li>;
}

// Hors solde : le Jarl, le Régent impérial et le Huscarl, par leur grade, et le Hird du Jarl, par son corps.
function Solde({ s, grade }) {
  if (s.exclu) {
    const cle = String(grade || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const qui = cle === "jarl" ? "Le Jarl" : cle.startsWith("regent") ? "Le Régent impérial" : cle.startsWith("huscarl") ? "Le Huscarl" : "Le Hird du Jarl";
    return <Section titre="Solde"><p className="fiche-vide">{qui} n’est pas soldé par le registre de la Garde.</p></Section>;
  }
  const courante = s.semaineCourante;
  return <Section titre="Solde" sousTitre={titreSemaine(s.lundiCourant)}>
    <div className="fiche-semaine" aria-label="Jours de service de la semaine en cours">
      {JOURS.map((jour, i) => {
        const present = Boolean(courante?.jours?.[i]);
        return <div key={jour} className={`fiche-jour ${present ? "is-present" : ""}`}>
          <span>{jour}</span><strong aria-label={present ? "en service" : "absent"}>{present ? "✓" : "·"}</strong>
        </div>;
      })}
    </div>
    <p className="fiche-ligne">
      {courante
        ? <>{pluriel(courante.joursPresents, "jour")} de service cette semaine · <strong>{septims(courante.solde)}</strong> · {courante.financeur}</>
        : "Aucun pointage cette semaine."}
    </p>

    <h3>Soldes en attente</h3>
    {s.enAttente.length
      ? <>
          <ul className="fiche-liste">
            {s.enAttente.map(e => <li key={e.lundi}>
              <span>{titreSemaine(e.lundi)}<small>{pluriel(e.joursPresents, "jour")} · {e.financeur}</small></span>
              <strong>{septims(e.solde)}</strong>
            </li>)}
          </ul>
          <p className="fiche-total">En attente : <strong>{septims(s.totalEnAttente)}</strong></p>
        </>
      : <p className="fiche-vide">Aucune solde en attente.</p>}

    <p className="fiche-percu">
      Soldes perçues : <strong>{septims(s.totalPercu)}</strong>
      {s.derniereSemaineReglee && <> · dernière semaine réglée : {titreSemaine(s.derniereSemaineReglee)}</>}
    </p>
  </Section>;
}

function Service({ s }) {
  if (s.exclu) return null;
  return <Section titre="Service">
    <div className="fiche-tuiles">
      <Tuile valeur={s.joursTotal} libelle="jours de service" />
      <Tuile valeur={s.semainesServies} libelle="semaines servies" />
      <Tuile valeur={new Intl.NumberFormat("fr-FR").format(s.moyenne)} libelle="jours par semaine" detail="en moyenne" />
      <Tuile valeur={s.serie} libelle={s.serie > 1 ? "semaines de suite" : "semaine de suite"} detail="série en cours" />
    </div>
    <p className="fiche-ligne">
      Dernier service : {s.dernierJour ? <><DateRP value={s.dernierJour} heure={false} /> ({depuisJours(s.joursDepuis)})</> : "aucun service enregistré."}
    </p>
  </Section>;
}

function Justice({ j }) {
  const a = j.amendes, p = j.prison;
  return <Section titre="Justice">
    <div className="fiche-tuiles">
      <Tuile valeur={a.nombre} libelle={a.nombre > 1 ? "amendes dressées" : "amende dressée"} detail={septims(a.total)} />
      <Tuile valeur={a.aEncaisser.nombre} libelle="à encaisser" detail={`${septims(a.aEncaisser.total)}${a.aEncaisser.aDeterminer ? ` · ${a.aEncaisser.aDeterminer} à déterminer` : ""}`} />
      <Tuile valeur={a.aReverser.nombre} libelle="à reverser" detail={septims(a.aReverser.total)} />
      <Tuile valeur={p.nombre} libelle={p.nombre > 1 ? "incarcérations" : "incarcération"} detail={p.transferes ? `${p.transferes} transféré${p.transferes > 1 ? "s" : ""}` : undefined} />
    </div>

    {p.enCellule.length > 0 && <>
      <h3>Encore en cellule</h3>
      <ul className="fiche-liste">
        {p.enCellule.map((d, i) => <li key={i}>
          <span>{d.detenu}<small>Cellule {d.cellule || "?"} · {d.infraction}</small></span>
          <small>{d.sortie ? <>sortie prévue <DateRP value={d.sortie} /></> : "durée à déterminer"}</small>
        </li>)}
      </ul>
    </>}

    <h3>Dernières amendes</h3>
    {a.dernieres.length
      ? <ul className="fiche-liste">
          {a.dernieres.map((d, i) => <li key={i}>
            <span>{d.contrevenant}<small><DateRP value={d.date} jour={false} heure={false} /> · {d.infraction}</small></span>
            <span className="fiche-amende-etat">
              <strong>{d.montant === null ? "À déterminer" : septims(d.montant)}</strong>
              <small>{d.reverse ? "Reversée" : d.paye ? "Payée, à reverser" : "À encaisser"}</small>
            </span>
          </li>)}
        </ul>
      : <p className="fiche-vide">Aucune amende dressée.</p>}
  </Section>;
}

// Sommet : le Jarl, ou sous régence le ou les Régents impériaux (FicheService.js).
function Commandement({ cmd }) {
  const regence = cmd.jarl?.length > 0 && cmd.jarl.every(p => String(p.grade || "").trim().toLowerCase() !== "jarl");
  return <Section titre="Chaîne de commandement">
    {cmd.corps.length
      ? <><h3>Dans son corps</h3><ul className="fiche-personnes">{cmd.corps.map(p => <Personne key={p.nomComplet} personne={p} />)}</ul></>
      : <p className="fiche-vide">Aucun supérieur dans son corps.</p>}
    {cmd.etatMajor.length > 0 && <><h3>État-Major</h3><ul className="fiche-personnes">{cmd.etatMajor.map(p => <Personne key={p.nomComplet} personne={p} />)}</ul></>}
    {cmd.jarl?.length > 0 && <><h3>{regence ? "Régence impériale" : "Jarl"}</h3><ul className="fiche-personnes">{cmd.jarl.map(p => <Personne key={p.nomComplet} personne={p} />)}</ul></>}
  </Section>;
}

function Carriere({ c }) {
  return <Section titre="Carrière">
    <p className="fiche-ligne">
      {c.avantJournal
        ? "Déjà au service de la Garde à l’ouverture du registre, en septembre 2026."
        : c.inscription
          ? <>Inscription au registre le <DateRP value={c.inscription} heure={false} />.</>
          : "Inscription non retrouvée au journal des Effectifs."}
    </p>
    {c.evenements.length
      ? <ol className="fiche-carriere">
          {c.evenements.map((e, i) => <li key={i}><DateRP value={e.date} heure={false} /><span>{libelleEvenement(e)}</span></li>)}
        </ol>
      : <p className="fiche-vide">Aucune promotion ni mutation depuis l’ouverture du journal.</p>}
  </Section>;
}

export function FicheContenu({ data }) {
  const { fiche, service: s, justice: j, carriere: c, commandement: cmd } = data;
  return <div className="fiche-page">
    <div className="page-header fiche-entete">
      <div>
        <p className="eyebrow">Fiche de service</p>
        <h1 className="page-title" id="fiche-titre">{fiche.nomComplet}</h1>
        <p className="page-subtitle">
          {libelleGrade(fiche.grade, fiche.corps)} · {libelleCorps(fiche.corps)}{fiche.specialite ? ` · ${fiche.specialite}` : ""}
        </p>
      </div>
      <div className="fiche-badges">
        <span className="effectif-badge">{fiche.statut || "Sans statut"}</span>
        <span className={`effectif-badge ${fiche.assermente ? "effectif-badge-sworn" : "effectif-badge-muted"}`}>{fiche.assermente ? "✓ Assermenté" : "Non assermenté"}</span>
      </div>
    </div>
    <GradeDescription grade={libelleGrade(fiche.grade, fiche.corps)} />
    {s.inactif && <div className="fiche-alerte" role="status">
      {s.joursDepuis === null
        ? "Aucun jour de service enregistré à son nom."
        : `Aucun service depuis ${s.joursDepuis} jours : au-delà de ${s.seuilInactivite}, son nom remonte au tableau des officiers.`}
    </div>}
    <div className="fiche-grille">
      <Solde s={s} grade={fiche.grade} />
      <Service s={s} />
      {j && <Justice j={j} />}
      <Commandement cmd={cmd} />
      <Carriere c={c} />
    </div>
  </div>;
}
