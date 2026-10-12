// Livret de service : page personnelle d'un membre connecté par Discord,
// ouverte par défaut à la connexion (décisions du propriétaire, 11 octobre
// 2026). Lecture seule ; le serveur (`getLivretService`) ne renvoie que les
// données du membre de la session.

import { libelleCorps, libelleGrade } from "./corps.js";
import { GradeDescription } from "./grades.jsx";
import { DateRP } from "./calendrier.jsx";
import { titreSemaine } from "./semaine.js";

const { useEffect, useState } = React;
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

function Section({ titre, sousTitre, children }) {
  return <section className="livret-section">
    <header className="livret-section-entete"><h2>{titre}</h2>{sousTitre && <p>{sousTitre}</p>}</header>
    {children}
  </section>;
}

function Tuile({ valeur, libelle, detail }) {
  return <div className="livret-tuile"><strong>{valeur}</strong><span>{libelle}</span>{detail && <small>{detail}</small>}</div>;
}

function Personne({ personne, aliasGrades }) {
  return <li className="livret-personne">
    <span className="livret-personne-grade">{libelleGrade(personne.grade, personne.corps, aliasGrades)}</span>
    <span className="livret-personne-nom">{personne.nomComplet}</span>
  </li>;
}

// Hors solde : le Jarl, par son grade, et le Hird du Jarl, par son corps.
function Solde({ s, grade }) {
  if (s.exclu) {
    const qui = String(grade || "").trim().toLowerCase() === "jarl" ? "Le Jarl" : "Le Hird du Jarl";
    return <Section titre="Solde"><p className="livret-vide">{qui} n’est pas soldé par le registre de la Garde.</p></Section>;
  }
  const courante = s.semaineCourante;
  return <Section titre="Solde" sousTitre={titreSemaine(s.lundiCourant)}>
    <div className="livret-semaine" aria-label="Jours de service de la semaine en cours">
      {JOURS.map((jour, i) => {
        const present = Boolean(courante?.jours?.[i]);
        return <div key={jour} className={`livret-jour ${present ? "is-present" : ""}`}>
          <span>{jour}</span><strong aria-label={present ? "en service" : "absent"}>{present ? "✓" : "·"}</strong>
        </div>;
      })}
    </div>
    <p className="livret-ligne-solde">
      {courante
        ? <>{pluriel(courante.joursPresents, "jour")} de service cette semaine · <strong>{septims(courante.solde)}</strong> à recevoir de {courante.financeur}</>
        : "Aucun pointage cette semaine."}
    </p>

    <h3>Soldes en attente</h3>
    {s.enAttente.length
      ? <>
          <ul className="livret-liste">
            {s.enAttente.map(e => <li key={e.lundi}>
              <span>{titreSemaine(e.lundi)}<small>{pluriel(e.joursPresents, "jour")} · {e.financeur}</small></span>
              <strong>{septims(e.solde)}</strong>
            </li>)}
          </ul>
          <p className="livret-total">À réclamer : <strong>{septims(s.totalEnAttente)}</strong></p>
        </>
      : <p className="livret-vide">Aucune solde en attente : vous êtes à jour.</p>}

    <p className="livret-percu">
      Soldes perçues : <strong>{septims(s.totalPercu)}</strong>
      {s.derniereSemaineReglee && <> · dernière semaine réglée : {titreSemaine(s.derniereSemaineReglee)}</>}
    </p>
  </Section>;
}

function Service({ s }) {
  if (s.exclu) return null;
  return <Section titre="Service">
    <div className="livret-tuiles">
      <Tuile valeur={s.joursTotal} libelle="jours de service" />
      <Tuile valeur={s.semainesServies} libelle="semaines servies" />
      <Tuile valeur={new Intl.NumberFormat("fr-FR").format(s.moyenne)} libelle="jours par semaine" detail="en moyenne" />
      <Tuile valeur={s.serie} libelle={s.serie > 1 ? "semaines de suite" : "semaine de suite"} detail="série en cours" />
    </div>
    <p className="livret-ligne-solde">
      Dernier service : {s.dernierJour ? <><DateRP value={s.dernierJour} heure={false} /> ({depuisJours(s.joursDepuis)})</> : "aucun service enregistré."}
    </p>
  </Section>;
}

function Justice({ j }) {
  const a = j.amendes, p = j.prison;
  return <Section titre="Justice">
    <div className="livret-tuiles">
      <Tuile valeur={a.nombre} libelle={a.nombre > 1 ? "amendes dressées" : "amende dressée"} detail={septims(a.total)} />
      <Tuile valeur={a.aEncaisser.nombre} libelle="à encaisser" detail={`${septims(a.aEncaisser.total)}${a.aEncaisser.aDeterminer ? ` · ${a.aEncaisser.aDeterminer} à déterminer` : ""}`} />
      <Tuile valeur={a.aReverser.nombre} libelle="à reverser" detail={septims(a.aReverser.total)} />
      <Tuile valeur={p.nombre} libelle={p.nombre > 1 ? "incarcérations" : "incarcération"} />
    </div>

    {p.enCellule.length > 0 && <>
      <h3>Encore en cellule</h3>
      <ul className="livret-liste">
        {p.enCellule.map((d, i) => <li key={i}>
          <span>{d.detenu}<small>Cellule {d.cellule || "?"} · {d.infraction}</small></span>
          <small>{d.sortie ? <>sortie prévue <DateRP value={d.sortie} /></> : "durée à déterminer"}</small>
        </li>)}
      </ul>
    </>}

    <h3>Dernières amendes</h3>
    {a.dernieres.length
      ? <ul className="livret-liste">
          {a.dernieres.map((d, i) => <li key={i}>
            <span>{d.contrevenant}<small><DateRP value={d.date} jour={false} heure={false} /> · {d.infraction}</small></span>
            <span className="livret-amende-etat">
              <strong>{d.montant === null ? "À déterminer" : septims(d.montant)}</strong>
              <small>{d.reverse ? "Reversée" : d.paye ? "Payée, à reverser" : "À encaisser"}</small>
            </span>
          </li>)}
        </ul>
      : <p className="livret-vide">Aucune amende dressée.</p>}
  </Section>;
}

function Commandement({ cmd, aliasGrades }) {
  return <Section titre="Chaîne de commandement">
    {cmd.corps.length
      ? <><h3>Dans votre corps</h3><ul className="livret-personnes">{cmd.corps.map(p => <Personne key={p.nomComplet} personne={p} aliasGrades={aliasGrades} />)}</ul></>
      : <p className="livret-vide">Aucun officier au-dessus de vous dans votre corps.</p>}
    {cmd.etatMajor.length > 0 && <><h3>État-Major</h3><ul className="livret-personnes">{cmd.etatMajor.map(p => <Personne key={p.nomComplet} personne={p} aliasGrades={aliasGrades} />)}</ul></>}
    {cmd.jarl?.length > 0 && <><h3>Jarl</h3><ul className="livret-personnes">{cmd.jarl.map(p => <Personne key={p.nomComplet} personne={p} aliasGrades={aliasGrades} />)}</ul></>}
  </Section>;
}

function Carriere({ c }) {
  return <Section titre="Carrière">
    <p className="livret-ligne-solde">
      {c.avantJournal
        ? "Déjà au service de la Garde à l’ouverture du registre, en septembre 2026."
        : c.inscription
          ? <>Inscrit au registre le <DateRP value={c.inscription} heure={false} />.</>
          : "Inscription non retrouvée au journal des Effectifs."}
    </p>
    {c.evenements.length
      ? <ol className="livret-carriere">
          {c.evenements.map((e, i) => <li key={i}><DateRP value={e.date} heure={false} /><span>{libelleEvenement(e)}</span></li>)}
        </ol>
      : <p className="livret-vide">Aucune promotion ni mutation depuis l’ouverture du journal.</p>}
  </Section>;
}

export function LivretPage({ token, serverCall }) {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState("");
  useEffect(() => {
    serverCall("getLivretService", token).then(setData).catch(e => setErreur(e.message));
  }, []);

  if (erreur) return <div className="error">{erreur}</div>;
  if (!data) return <div className="loading">Ouverture du livret de service…</div>;

  const { fiche, service: s, justice: j, carriere: c, commandement: cmd, aliasGrades } = data;
  return <div className="livret-page">
    <div className="page-header livret-entete">
      <div>
        <p className="eyebrow">Livret de service</p>
        <h1 className="page-title">{fiche.nomComplet}</h1>
        <p className="page-subtitle">
          {libelleGrade(fiche.grade, fiche.corps, aliasGrades)} · {libelleCorps(fiche.corps)}{fiche.specialite ? ` · ${fiche.specialite}` : ""}
        </p>
      </div>
      <div className="livret-badges">
        <span className="effectif-badge">{fiche.statut || "Sans statut"}</span>
        <span className={`effectif-badge ${fiche.assermente ? "effectif-badge-sworn" : "effectif-badge-muted"}`}>{fiche.assermente ? "✓ Assermenté" : "Non assermenté"}</span>
      </div>
    </div>
    <GradeDescription grade={fiche.grade} />
    {s.inactif && <div className="livret-alerte" role="status">
      {s.joursDepuis === null
        ? "Aucun jour de service enregistré à votre nom."
        : `Aucun service depuis ${s.joursDepuis} jours : au-delà de ${s.seuilInactivite}, votre nom remonte au tableau des officiers.`}
    </div>}
    <div className="livret-grille">
      <Solde s={s} grade={fiche.grade} />
      <Service s={s} />
      <Justice j={j} />
      <Commandement cmd={cmd} aliasGrades={aliasGrades} />
      <Carriere c={c} />
    </div>
  </div>;
}
