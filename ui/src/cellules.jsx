/*
  Choix de la cellule d'une incarcération, d'après le plan de la prison de
  Fort Dragon (croquis du propriétaire, 7 novembre 2026).

  Quatre cellules fermées, numérotées 1 à 4. Les lettres A à H du croquis
  désignent des coffres, pas des places de détention : elles ne sont pas
  proposées. Le champ reste un texte libre : la feuille garde ce qu'on y
  écrit, et les anciennes lignes portent d'autres libellés. Le plan ne fait
  que proposer : un clic sur une cellule remplit le champ. Le croquis
  original s'ouvre à côté, pour s'y retrouver sur place.
*/
import planPrison from "../assets/plan-prison.jpg";

const { useState } = React;

export const CELLULES = [
  { code: "1", libelle: "Cellule 1" },
  { code: "2", libelle: "Cellule 2" },
  { code: "3", libelle: "Cellule 3" },
  { code: "4", libelle: "Cellule 4" }
];

/* Libellé d'une cellule connue ; la valeur telle quelle sinon. */
export function libelleCellule(code) {
  const propre = String(code || "").trim().toUpperCase();
  const connue = CELLULES.find(c => c.code === propre);
  return connue ? connue.libelle : String(code || "").trim();
}

/*
  Plan relevé sur le croquis, en unités de salle : u vers le haut à droite,
  v vers le bas à droite, puis tourné comme le croquis. Les salles sont
  décalées les unes par rapport aux autres (quinconce) comme sur le relevé :
  la grande salle en haut à gauche, une salle et les cellules 2 et 1 sur la
  bande suivante, la salle centrale sous elles, puis les cellules 3 et 4 et
  la salle qui ouvre sur l'extérieur.
*/
const UNITE = 60;
const ROTATION = -33;
const SALLES = [
  { id: "grande", u: 0, v: 0, w: 2.2, h: 1, libelle: "Salle" },
  { id: "ouest", u: 0.1, v: 1, w: 1.7, h: 1.35, libelle: "Salle" },
  { id: "c2", u: 1.8, v: 1, w: 0.8, h: 1.35, code: "2" },
  { id: "c1", u: 2.6, v: 1, w: 1, h: 1.35, code: "1" },
  { id: "centre", u: 0.4, v: 2.35, w: 3.5, h: 1.65, libelle: "Salle centrale" },
  { id: "c3", u: 0.5, v: 4, w: 1.2, h: 1.65, code: "3" },
  { id: "c4", u: 1.7, v: 4, w: 0.8, h: 1.5, code: "4" },
  { id: "est", u: 2.5, v: 4, w: 1.5, h: 2, libelle: "Salle" }
];

/*
  Portes du croquis : `sens` « u » pour une porte dans un mur qui suit u
  (ouverture le long de ce mur), « v » pour un mur qui suit v. Les portes
  dorées du croquis sont celles de l'entrée et de la sortie ; les autres sont
  des passages intérieurs.
*/
const PORTES = [
  { u: 0.8, v: 1, sens: "u", principale: true, titre: "Grande salle ↔ salle" },
  { u: 1.25, v: 2.35, sens: "u", principale: true, titre: "Salle ↔ salle centrale" },
  { u: 2.1, v: 2.35, sens: "u", titre: "Cellule 2 ↔ salle centrale" },
  { u: 3.05, v: 2.35, sens: "u", titre: "Cellule 1 ↔ salle centrale" },
  { u: 0.4, v: 3.1, sens: "v", principale: true, titre: "Entrée depuis l'extérieur" },
  { u: 1.2, v: 4, sens: "u", titre: "Salle centrale ↔ cellule 3" },
  { u: 2.0, v: 4, sens: "u", titre: "Salle centrale ↔ cellule 4" },
  { u: 3.35, v: 4, sens: "u", titre: "Salle centrale ↔ salle de sortie" },
  { u: 3.35, v: 6, sens: "u", principale: true, titre: "Sortie vers l'extérieur" }
];
const PORTE_LONGUEUR = 16;
const PORTE_EPAISSEUR = 7;

function Etiquette({ x, y, children, className }) {
  return <text x={x} y={y} className={className} textAnchor="middle" dominantBaseline="central" transform={`rotate(${-ROTATION} ${x} ${y})`}>{children}</text>;
}

export function PlanCellules({ valeur, onChoisir }) {
  const choisi = String(valeur || "").trim().toUpperCase();
  return <svg className="plan-prison" viewBox="-12 -145 445 495" role="group" aria-label="Plan de la prison de Fort Dragon">
    <g transform={`rotate(${ROTATION})`}>
      {SALLES.map(s => {
        const x = s.u * UNITE, y = s.v * UNITE, w = s.w * UNITE, h = s.h * UNITE;
        const cliquable = Boolean(s.code);
        const classe = `plan-salle${cliquable ? " plan-cellule" : ""}${s.code && s.code === choisi ? " plan-choisi" : ""}`;
        return <g key={s.id} className={classe} onClick={cliquable ? () => onChoisir(s.code) : undefined} role={cliquable ? "button" : undefined} aria-label={cliquable ? `Cellule ${s.code}` : undefined} tabIndex={cliquable ? 0 : undefined} onKeyDown={cliquable ? e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChoisir(s.code); } } : undefined}>
          <rect x={x} y={y} width={w} height={h} />
          {s.code && <Etiquette x={x + w / 2} y={y + h / 2} className="plan-numero">{s.code}</Etiquette>}
          {s.libelle && <Etiquette x={x + w / 2} y={y + h / 2} className="plan-libelle">{s.libelle}</Etiquette>}
        </g>;
      })}
      {PORTES.map(p => {
        const x = p.u * UNITE, y = p.v * UNITE;
        const long = p.sens === "u";
        return <rect key={p.titre} className={`plan-porte${p.principale ? " plan-porte-principale" : ""}`}
          x={x - (long ? PORTE_LONGUEUR : PORTE_EPAISSEUR) / 2} y={y - (long ? PORTE_EPAISSEUR : PORTE_LONGUEUR) / 2}
          width={long ? PORTE_LONGUEUR : PORTE_EPAISSEUR} height={long ? PORTE_EPAISSEUR : PORTE_LONGUEUR}><title>{p.titre}</title></rect>;
      })}
      <Etiquette x={3.3 * UNITE} y={6.6 * UNITE} className="plan-exterieur">Extérieur</Etiquette>
    </g>
  </svg>;
}

/*
  Champ Cellule : saisie libre avec les cellules connues en suggestion, et un
  plan dépliable où un clic choisit la cellule.
*/
export function ChampCellule({ value, onChange, disabled = false }) {
  const [plan, setPlan] = useState(false);
  const [croquis, setCroquis] = useState(false);
  const connue = libelleCellule(value);
  return <div className="champ-cellule">
    <div className="champ-cellule-ligne">
      <input maxLength={100} list="cellules-connues" value={value} disabled={disabled} onChange={e => onChange(e.target.value)} placeholder="1 à 4…" />
      <datalist id="cellules-connues">{CELLULES.map(c => <option key={c.code} value={c.code}>{c.libelle}</option>)}</datalist>
      <button type="button" className="secondary-button champ-cellule-plan" aria-expanded={plan} onClick={() => setPlan(p => !p)}>{plan ? "Masquer le plan" : "Plan"}</button>
    </div>
    {value && connue !== String(value).trim() && <small className="champ-cellule-aide">{connue}</small>}
    {plan && <div className="plan-prison-cadre">
      <PlanCellules valeur={value} onChoisir={code => { onChange(code); }} />
      <p className="plan-prison-legende">Cellules fermées 1 à 4. Portes dorées : entrée et sortie ; portes claires : passages intérieurs. Un clic sur une cellule remplit le champ.</p>
      <button type="button" className="registre-depli" aria-expanded={croquis} onClick={() => setCroquis(c => !c)}>{croquis ? "Masquer le croquis" : "Voir le croquis original"}</button>
      {croquis && <img className="plan-prison-croquis" src={planPrison} alt="Croquis de la prison de Fort Dragon : cellules 1 à 4" />}
    </div>}
  </div>;
}
