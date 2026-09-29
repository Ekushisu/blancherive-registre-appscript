// Brouillon local d'un formulaire de création (Amendes, Prison) : un
// rechargement de page ou un changement d'onglet ne perd pas trois chefs
// d'accusation et une liste de saisies. Propre à l'onglet du navigateur
// (`sessionStorage`), effacé à l'enregistrement. Jamais utilisé pour une
// modification : on repart toujours de la ligne affichée.

const PREFIXE = 'blancherive.brouillon.v1.';

export function lireBrouillon(cle) {
  try {
    const brut = globalThis.sessionStorage?.getItem(PREFIXE + cle);
    if (!brut) return null;
    const valeur = JSON.parse(brut);
    return valeur && typeof valeur === 'object' ? valeur : null;
  } catch { return null; }
}

export function ecrireBrouillon(cle, valeur) {
  try { globalThis.sessionStorage?.setItem(PREFIXE + cle, JSON.stringify(valeur)); } catch { /* stockage refusé */ }
}

export function effacerBrouillon(cle) {
  try { globalThis.sessionStorage?.removeItem(PREFIXE + cle); } catch { /* stockage refusé */ }
}
