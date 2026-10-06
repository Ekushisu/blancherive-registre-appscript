import { useCodex, articleParCle, normaliserTexteCodex } from './codex.js';
import { usePeines, grilleEchelons, FOURCHETTES, libelleQualification, formatSeptims, formatDuree } from './peines.js';
import { NobleNiveau, PuceQualification, classeQualification } from './bareme.jsx';
import { LawModal } from './article.jsx';

const { useMemo, useState } = React;

// Page « Décrets de peines et amendes » : le barème de la feuille
// PeinesAmendes, article par article. GARDE et OFFICIER la consultent ; le
// barème se corrige dans Sheets. L'officier voit en plus les lignes de la
// feuille à reprendre.

const QUALIFS_FILTRE = ['contravention', 'délit', 'crime'];

const pluriel = (n, singulier, plurielForme) => `${n.toLocaleString('fr-FR')} ${n > 1 ? plurielForme : singulier}`;

// « * » d'abord, puis l'ordre des numéros : 15 avant 15-1 avant 16 ; II avant III.
const ROMAINS = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
function numeroTri(article) {
  if (article === '*') return -1;
  const m = String(article || '').match(/^(\d+)(?:-(\d+))?/);
  if (m) return Number(m[1]) * 1000 + Number(m[2] || 0);
  const romain = String(article || '').toUpperCase();
  if (/^[IVXLCDM]+$/.test(romain)) {
    let total = 0;
    for (let i = 0; i < romain.length; i++) {
      const v = ROMAINS[romain[i]], suivant = ROMAINS[romain[i + 1]] || 0;
      total += v < suivant ? -v : v;
    }
    return total * 1000;
  }
  return Number.MAX_SAFE_INTEGER;
}

/*
  Articles du barème regroupés par source, dans l'ordre de la feuille pour
  les sources et des numéros pour les articles. Le titre vient du Codex quand
  il le connaît, de l'intitulé de la feuille sinon.
*/
export function regrouperBareme(peines, codex) {
  const parSource = new Map();
  for (const l of peines?.lignes || []) {
    if (!parSource.has(l.source)) parSource.set(l.source, new Map());
    const articles = parSource.get(l.source);
    if (!articles.has(l._cle)) {
      const article = l.article === '*' ? null : articleParCle(codex, l.source, l.article);
      articles.set(l._cle, {
        cle: l._cle,
        source: l.source,
        article: l.article,
        titre: article?.titre || l.intitule || (l.article === '*' ? 'Tout le texte' : `Article ${l.article}`),
        codex: article,
        niveaux: []
      });
    }
    articles.get(l._cle).niveaux.push(l);
  }
  return [...parSource.entries()].map(([source, articles]) => ({
    source,
    abrege: codex?.sources?.find(s => s.nom === source)?.abrege || '',
    articles: [...articles.values()].sort((a, b) => numeroTri(a.article) - numeroTri(b.article))
  }));
}

/*
  Recherche en ET, sans accents : un terme numérique (« 16 », « 15-1 ») vise
  le numéro d'article exact, les autres le sigle, le titre, les niveaux, les
  peines complémentaires et les observations.
*/
export function filtrerBareme(groupes, { recherche = '', source = '', qualification = '' } = {}) {
  const termes = normaliserTexteCodex(recherche).replace(/\b(art|article|articles)\.?\s*/g, '').split(' ').filter(Boolean);
  return groupes
    .filter(g => !source || g.source === source)
    .map(g => ({
      ...g,
      articles: g.articles.filter(a => {
        if (qualification && !a.niveaux.some(n => n.qualification === qualification)) return false;
        if (!termes.length) return true;
        const texte = normaliserTexteCodex(`${g.abrege} ${a.titre} ${a.niveaux.map(n => n._texte).join(' ')}`);
        const numero = normaliserTexteCodex(a.article);
        return termes.every(t => /^\d+(-\d+)?$/.test(t) ? numero === t : texte.includes(t));
      })
    }))
    .filter(g => g.articles.length);
}

/*
  Lignes du barème qui ne renvoient à aucun article du Codex : numéro changé,
  source renommée, décret retiré. Elles restent proposées si un chef les
  cite, mais aucun chef ne peut plus les citer.
*/
export function lignesHorsCodex(peines, codex) {
  if (!peines || !codex) return [];
  const vus = new Set();
  return peines.lignes.filter(l => {
    if (vus.has(l._cle)) return false;
    vus.add(l._cle);
    return l.article === '*' ? !codex.sources.some(s => s.nom === l.source) : !articleParCle(codex, l.source, l.article);
  });
}

export function PeinesPage({ token, serverCall, voirAnomalies = false, onOpenCodex }) {
  const etat = usePeines(serverCall, token, true);
  const codexEtat = useCodex(serverCall, token, true);
  const peines = etat.peines, codex = codexEtat.codex;
  const [recherche, setRecherche] = useState('');
  const [source, setSource] = useState('');
  const [qualification, setQualification] = useState('');
  const [lu, setLu] = useState(null);

  const groupes = useMemo(() => regrouperBareme(peines, codex), [peines, codex]);
  const filtres = useMemo(() => filtrerBareme(groupes, { recherche, source, qualification }), [groupes, recherche, source, qualification]);
  const grille = useMemo(() => grilleEchelons(peines), [peines]);
  const horsCodex = useMemo(() => voirAnomalies ? lignesHorsCodex(peines, codex) : [], [peines, codex, voirAnomalies]);
  const comptes = useMemo(() => {
    const comptes = {};
    for (const q of QUALIFS_FILTRE) comptes[q] = groupes.reduce((n, g) => n + g.articles.filter(a => a.niveaux.some(l => l.qualification === q)).length, 0);
    return comptes;
  }, [groupes]);

  if (etat.statut === 'erreur' && !peines) return <div className="error">Le barème des peines n’a pas pu être chargé : {etat.erreur}</div>;
  if (!peines) return <div className="loading">Chargement du barème des peines…</div>;

  const nbArticles = filtres.reduce((n, g) => n + g.articles.length, 0);
  const nbNiveaux = filtres.reduce((n, g) => n + g.articles.reduce((m, a) => m + a.niveaux.length, 0), 0);
  const filtre = Boolean(recherche.trim() || source || qualification);

  // Un article absent du Codex s'ouvre quand même, avec son seul barème.
  function lire(a) {
    setLu(a.codex || { source: a.source, article: a.article, titre: a.titre, abrege: groupes.find(g => g.source === a.source)?.abrege || '', texte: '', _cle: a.cle });
  }

  return <div className="peines-page">
    <div className="page-header"><div>
      <h1 className="page-title">Décrets de peines et amendes</h1>
      <p className="page-subtitle">Barème des sanctions de la Garde, article par article, dans les fourchettes du droit impérial. Le barème propose ; l’autorité apprécie.</p>
    </div></div>

    {etat.statut === 'erreur' && <div className="error">Barème non actualisé : {etat.erreur}. La dernière version connue est affichée.</div>}
    {voirAnomalies && <AnomaliesBareme anomalies={peines.anomalies} horsCodex={horsCodex}/>}

    <div className="peines-fourchettes" role="group" aria-label="Fourchettes impériales — filtrer par qualification">
      {QUALIFS_FILTRE.map(q => <button key={q} type="button" className={`peines-fourchette peines-fourchette-${q} ${qualification === q ? 'actif' : ''}`} aria-pressed={qualification === q} onClick={() => setQualification(qualification === q ? '' : q)}>
        <span className="peines-fourchette-libelle">{FOURCHETTES[q].libelle}</span>
        <strong>{FOURCHETTES[q].fourchette}</strong>
        <small>{FOURCHETTES[q].peines}</small>
        <span className="peines-fourchette-compte">{pluriel(comptes[q], 'article', 'articles')}</span>
      </button>)}
    </div>

    <PrincipesBareme grille={grille}/>

    <div className="peines-filtres">
      <label className="sr-only" htmlFor="peines-recherche">Rechercher dans le barème</label>
      <input id="peines-recherche" type="search" placeholder="Article, intitulé, sigle… (« vol », « cpl 16 »)" value={recherche} onChange={e => setRecherche(e.target.value)}/>
      <label className="sr-only" htmlFor="peines-source">Source</label>
      <select id="peines-source" value={source} onChange={e => setSource(e.target.value)}>
        <option value="">Tous les textes</option>
        {groupes.map(g => <option key={g.source} value={g.source}>{g.abrege ? `${g.abrege} — ` : ''}{g.source}</option>)}
      </select>
      <select aria-label="Qualification" value={qualification} onChange={e => setQualification(e.target.value)}>
        <option value="">Toutes qualifications</option>
        {['contravention', 'délit', 'crime', 'spéciale', 'renvoi'].map(q => <option key={q} value={q}>{libelleQualification(q)}</option>)}
      </select>
      {filtre && <button type="button" className="secondary-button" onClick={() => { setRecherche(''); setSource(''); setQualification(''); }}>Effacer les filtres</button>}
    </div>
    <p className="codex-count" role="status">{pluriel(nbArticles, 'article', 'articles')} · {pluriel(nbNiveaux, 'niveau', 'niveaux')} de peine</p>

    {!filtres.length && <p className="peines-vide">Aucun article du barème ne correspond. Un article absent du barème se sanctionne à l’appréciation de l’autorité.</p>}

    {filtres.map(g => <section className="peines-source" key={g.source} aria-labelledby={`peines-${g.source}`}>
      <h2 className="peines-source-titre" id={`peines-${g.source}`}>{g.abrege && <span className="chef-ref">{g.abrege}</span>}{g.source}<small>{pluriel(g.articles.length, 'article', 'articles')}</small></h2>
      <div className="peines-table-wrap">
        <table className="peines-table">
          <thead><tr><th scope="col">Article</th><th scope="col">Niveau</th><th scope="col">Qualification</th><th scope="col">Amende</th><th scope="col">Cachot</th><th scope="col">Rachat noble</th></tr></thead>
          {g.articles.map(a => <tbody key={a.cle} className="peines-article">
            {a.niveaux.map((n, i) => <tr key={n._index} className={`peines-niveau-${classeQualification(n.qualification)}`}>
              {i === 0 && <th scope="rowgroup" rowSpan={a.niveaux.length} className="peines-article-cellule">
                <button type="button" className="law-link" onClick={() => lire(a)} title="Lire l’article et son barème">
                  <span className="chef-ref">{a.article === '*' ? 'Tout le texte' : `${g.abrege || ''} art. ${a.article}`.trim()}</span>
                  <span className="peines-article-titre">{a.article === '*' ? n.niveau : a.titre}</span>
                </button>
                {voirAnomalies && !a.codex && a.article !== '*' && codex && <span className="peines-alerte">Introuvable au Codex</span>}
              </th>}
              <td data-label="Niveau">
                <span className="peines-niveau">{n.niveau}</span>
                {n.complements && <span className="peines-complement">{n.complements}</span>}
                {n.observations && <span className="peines-observation">{n.observations}</span>}
                {voirAnomalies && n.avertissements.length > 0 && <span className="peines-alerte" title={n.avertissements.join('\n')}>⚠ {n.avertissements[0]}{n.avertissements.length > 1 ? ` (+${n.avertissements.length - 1})` : ''}</span>}
              </td>
              <td data-label="Qualification"><PuceQualification niveau={n}/></td>
              <td data-label="Amende" className="peines-montant">{n._renvoi ? '—' : n.amende ? formatSeptims(n.amende) : n._pm ? 'Peine maximale' : '—'}</td>
              <td data-label="Cachot" className="peines-montant">{n.cachot ? formatDuree(n.cachot) : '—'}</td>
              <td data-label="Rachat noble"><NobleNiveau niveau={n}/></td>
            </tr>)}
          </tbody>)}
        </table>
      </div>
    </section>)}

    <LawModal article={lu} onClose={() => setLu(null)} codex={codex} peines={peines} onNavigate={lu?.source && articleParCle(codex, lu.source, lu.article) ? setLu : null} onOpenCodex={lu && articleParCle(codex, lu.source, lu.article) ? onOpenCodex : null}/>
  </div>;
}

/*
  Mode d'emploi du barème, replié par défaut : la grille des échelons telle
  que la feuille l'applique, les règles de cumul et de récidive, et les
  règles propres à la noblesse.
*/
function PrincipesBareme({ grille }) {
  return <details className="peines-principes">
    <summary>Comment lire ce barème — échelons, cumul, récidive et noblesse</summary>
    <div className="peines-principes-corps">
      <section>
        <h3>Échelons</h3>
        <div className="peines-echelons-wrap">
          <table className="peines-echelons">
            <thead><tr><th scope="col">Échelon</th><th scope="col">Qualification</th><th scope="col">Amende</th><th scope="col">Cachot</th><th scope="col">Rachat noble</th><th scope="col">Articles</th></tr></thead>
            <tbody>{grille.map(e => <tr key={e.code}>
              <th scope="row">{e.code}</th>
              <td>{libelleQualification(e.qualification)}</td>
              <td>{e.amende ? formatSeptims(e.amende) : e.code === 'PM' ? 'Mort, bannissement' : '—'}</td>
              <td>{e.cachot ? formatDuree(e.cachot) : '—'}</td>
              <td>{e.nobiliaire ? formatSeptims(e.nobiliaire) : '—'}</td>
              <td>{e.articles}{e.ajustes > 0 && <span className="peines-ajustes" title="Niveaux dont les valeurs s’écartent de l’échelon"> · {e.ajustes} ajusté{e.ajustes > 1 ? 's' : ''}</span>}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="peines-note">Chaque article est rangé dans la fourchette de sa qualification selon la gravité des faits. Le cachot ne vient qu’aux délits graves et aux crimes : la classification impériale réserve l’emprisonnement aux crimes.</p>
      </section>
      <section>
        <h3>Règles d’application</h3>
        <ul className="peines-regles">
          <li><strong>Fourchettes impériales.</strong> Contravention jusqu’à 500 septims, délit de 500 à 2 500, crime au-delà (Corpus Juriscivilis, principes généraux).</li>
          <li><strong>Plusieurs chefs.</strong> Des faits distincts cumulent leurs peines ; un même fait qualifié par plusieurs textes n’est puni qu’une fois, selon la qualification la plus rigoureuse (Code pénal local, art. 3).</li>
          <li><strong>Récidive.</strong> Peine encourue multipliée par deux, comptée depuis la dernière condamnation (Corpus Proceduralis).</li>
          <li><strong>Tentative et complicité.</strong> Punies comme l’infraction consommée et comme son auteur (Corpus Proceduralis).</li>
          <li><strong>Travaux.</strong> La classification impériale admet des travaux légers à la place d’une amende contraventionnelle, des travaux forcés à la place d’une amende délictuelle.</li>
          <li><strong>Peine maximale.</strong> Mort ou bannissement définitif et saisie des biens, prononcés seulement sur verdict public et motivé du magistrat (Corpus Proceduralis, art. 11).</li>
          <li><strong>Réparation.</strong> La réparation du dommage due à la victime s’ajoute à la peine (Code civil local, art. 18 et 19).</li>
          <li><strong>Compétence.</strong> Une autorité impériale peut se saisir d’une infraction impériale (Corpus Proceduralis, art. 1) ; le Codex Penitus relève des seules juridictions impériales.</li>
        </ul>
        <h3>Noblesse — De Re Nobilitatis</h3>
        <ul className="peines-regles">
          <li><strong>Art. 8.</strong> Une contravention ou un délit isolé sur sept jours n’est pas poursuivi : il faut une nouvelle infraction de même nature dans ce délai.</li>
          <li><strong>Art. 9.</strong> Une amende doit toujours être proposée, sauf crime de sang : le cachot se rachète par l’amende nobiliaire de chaque niveau.</li>
          <li><strong>Art. 10.</strong> Seuls l’amende, le bannissement, l’emprisonnement, la déchéance et la mise à mort honorable s’appliquent à un noble : pas de travaux forcés.</li>
          <li><strong>Art. 12.</strong> Emprisonnement, mise à mort et déchéance exigent une décision conjointe avec l’autorité souveraine du noble, Jarl ou consul.</li>
          <li><strong>Art. 4.</strong> Les manquements aux devoirs de la noblesse sont punis jusqu’à 5 000 septims, avec remboursement des sommes dues et bannissement.</li>
        </ul>
      </section>
    </div>
  </details>;
}

/*
  Contrôle de la feuille, pour l'officier : lignes écartées parce
  qu'illisibles, lignes gardées malgré un avertissement, articles que le
  Codex ne connaît plus. Rien n'est ignoré en silence.
*/
function AnomaliesBareme({ anomalies, horsCodex }) {
  const total = anomalies.length + horsCodex.length;
  if (!total) return null;
  const ecartees = anomalies.filter(a => a.grave).length;
  return <details className="peines-anomalies" open={ecartees > 0}>
    <summary>⚠ {pluriel(total, 'point', 'points')} à vérifier dans la feuille PeinesAmendes{ecartees ? ` — ${pluriel(ecartees, 'ligne écartée', 'lignes écartées')} des propositions` : ''}</summary>
    <ul>
      {anomalies.map((a, i) => <li key={`a-${i}`}><strong>Ligne {a.ligne}</strong> — {a.grave ? 'écartée : ' : ''}{a.message}</li>)}
      {horsCodex.map(l => <li key={`c-${l.ligne}`}><strong>Ligne {l.ligne}</strong> — {l.article === '*' ? `source « ${l.source} »` : `${l.source}, art. ${l.article}`} : introuvable au Codex. Vérifiez le numéro ou le nom de la source, ou relancez la synchronisation du Codex.</li>)}
    </ul>
    <p>Une ligne écartée n’est proposée nulle part ; une ligne avec un avertissement reste proposée telle quelle. La feuille se corrige dans Sheets.</p>
  </details>;
}
