// Descriptions doctrinales des grades de la Garde, affichées dans l'Organigramme.
//
// Ces textes sont de la doctrine stable : ils ne viennent pas du classeur et
// n'ont donc pas de fonction serveur associée. Un grade absent de la table
// s'affiche simplement sans description, sans erreur.
//
// Les clés sont normalisées (minuscules, sans accents ni séparateurs), afin que
// « Lieutenant-Chef », « lieutenant chef » et « LIEUTENANT-CHEF » se rejoignent.

const { useEffect, useId, useRef, useState } = React;

const cleGrade = value =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/*
  `Données!A2:A` écrit le commandant en chef tantôt « Commander », tantôt
  « Commandant » ; `estGradeCommandant()` dans `src/Organigramme.js` traite
  déjà les deux comme un seul grade.
*/
const DESCRIPTIONS = {
  jarl: "Moyenne noblesse. Détient le pouvoir judiciaire de la châtellerie.",
  marechal:
    "Petite noblesse, siège à la haute cour de la châtellerie. Orchestre les affaires militaires et celles de la garde.",
  commander:
    "Commandant en chef des armées et de la garde de Blancherive. Supervise les garnisons et les corps de garde.",
  commandant:
    "Commandant en chef des armées et de la garde de Blancherive. Supervise les garnisons et les corps de garde.",
  major:
    "Seconde le Commander dans l'exercice de la garde et des affaires militaires de Blancherive.",
  capitaine:
    "Commande un corps de garde ou une garnison dans l'exercice de la garde et des armées.",
  lieutenantchef: "Seconde le capitaine de corps ou de garnison dans son exercice.",
  lieutenant:
    "Commande des patrouilles et seconde le commandement du corps ou de la garnison. Intendant de son corps ou de sa garnison.",
  sergentchef:
    "Commande des patrouilles, veille au respect du règlement et aide à l'intendance journalière du corps ou de la garnison.",
  sergent: "Seconde le sergent-chef.",
  caporalchef:
    "Commande des binômes ou trinômes de patrouille, ou un détachement d'une patrouille plus large, au sein du corps ou de la garnison. Veille à la remontée d'information dans la hiérarchie, accompagne et observe les recrues et les cadets.",
  caporal:
    "Commande des binômes ou trinômes. Veille à la remontée d'information dans la hiérarchie, accompagne et observe les recrues et les cadets.",
  garde: "Garde de la châtellerie.",
  cadet:
    "Garde en formation de la châtellerie. Assermenté, mais ne peut exercer son pouvoir sans l'accompagnement d'un garde.",
  recrue:
    "Prospect de la garde, en tenue civile. Non assermenté, mis à l'épreuve par les gardes."
};

/*
  Les Majors du commandement commun de Rivebois et Bois-de-Chêne exercent une
  fonction distincte des Majors d'État-Major, pour un même nom de grade.
*/
const VARIANTES = {
  commandementLocal: "Supervise les garnisons locales des deux thaneries."
};

export function descriptionGrade(grade, variante) {
  if (variante && VARIANTES[variante]) return VARIANTES[variante];
  // Les en-têtes affichent parfois le pluriel : « Majors », « Capitaines ».
  const cle = cleGrade(grade).replace(/s$/, "");
  return DESCRIPTIONS[cle] || DESCRIPTIONS[cleGrade(grade)] || "";
}

// Description permanente, sous les libellés de la chaîne de commandement.
export function GradeDescription({ grade, variante }) {
  const texte = descriptionGrade(grade, variante);
  if (!texte) return null;
  return <p className="grade-description">{texte}</p>;
}

/*
  Bouton d'information à côté d'un libellé de grade, sur le modèle de
  `ChangeBadge` : un encart replié, ouvert au clic ou au clavier. Fermeture par
  Échap ou par un clic à l'extérieur, comme la modale du Codex.
*/
export function GradeInfo({ grade, variante }) {
  const texte = descriptionGrade(grade, variante);
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return undefined;
    const dehors = event => {
      if (!wrap.current?.contains(event.target)) setOpen(false);
    };
    const touches = event => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", dehors);
    document.addEventListener("keydown", touches);
    return () => {
      document.removeEventListener("mousedown", dehors);
      document.removeEventListener("keydown", touches);
    };
  }, [open]);

  if (!texte) return null;
  return <span className="grade-info" ref={wrap}>
    <button type="button" className="grade-info-button" aria-expanded={open}
      aria-controls={open ? id : undefined}
      aria-label={`Rôle du grade ${grade}`}
      onClick={event => { event.stopPropagation(); setOpen(value => !value); }}>
      ⓘ
    </button>
    {open && <span className="grade-info-panel" id={id} role="note">{texte}</span>}
  </span>;
}
