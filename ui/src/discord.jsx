// Champ « Compte Discord » de la fiche d'un membre (page Effectifs).
//
// La valeur est un identifiant Discord ; elle part au serveur avec le reste de
// la fiche, à l'enregistrement, et seulement si elle a changé. Le lien ouvre
// la connexion par Discord : le registre déduit l'accès de la fiche, jamais
// des rôles du serveur.

import { suggestionsDiscord, libelleMembreDiscord, membreDiscordParId } from "./discord.js";

const { useId, useState } = React;

export function CompteDiscordField({ value, onChange, discord, rattaches, memberId, anomalie = "", disabled = false }) {
  const idChamp = useId();
  const [recherche, setRecherche] = useState("");
  const membre = value ? membreDiscordParId(discord.membres, value) : null;
  const suggestions = value ? [] : suggestionsDiscord(discord.membres, recherche);

  function choisir(id) {
    onChange(id);
    setRecherche("");
  }

  return <div className="field compte-discord">
    <label htmlFor={idChamp}>Compte Discord</label>
    {value
      ? <div className="compte-discord-lie">
          <span id={idChamp} className="compte-discord-nom" title={`Identifiant ${value}`}>
            {membre
              ? libelleMembreDiscord(membre)
              : discord.statut === "pret"
                ? `Identifiant ${value} — absent du serveur`
                : `Identifiant ${value}`}
          </span>
          <button type="button" className="secondary-button" disabled={disabled} onClick={() => choisir("")}>Retirer le lien</button>
        </div>
      : <>
          <input id={idChamp} type="search" autoComplete="off" disabled={disabled} placeholder="Nom, pseudo ou identifiant Discord" value={recherche} onChange={event => setRecherche(event.target.value)}/>
          {suggestions.length > 0 && <ul className="compte-discord-suggestions" aria-label="Membres du serveur Discord">
            {suggestions.map(suggestion => {
              const titulaire = rattaches.get(suggestion.id);
              const pris = Boolean(titulaire) && titulaire.memberId !== memberId;
              return <li key={suggestion.id}>
                <button type="button" disabled={disabled || pris} onClick={() => choisir(suggestion.id)}>
                  <span>{libelleMembreDiscord(suggestion)}</span>
                  {pris && <small>déjà lié à {titulaire.nom}</small>}
                </button>
              </li>;
            })}
          </ul>}
          {recherche.trim() && !suggestions.length && discord.statut === "pret" && <small className="compte-discord-aide">Aucun membre du serveur ne correspond.</small>}
        </>}
    {anomalie && <small className="compte-discord-aide compte-discord-erreur" role="alert">{anomalie}</small>}
    {discord.statut === "chargement" && <small className="compte-discord-aide">Chargement des membres du serveur…</small>}
    {discord.statut === "erreur" && <small className="compte-discord-aide compte-discord-erreur">
      {discord.erreur} <button type="button" className="compte-discord-lien" onClick={() => discord.charger()}>Réessayer</button>
    </small>}
    {discord.statut === "pret" && !value && <button type="button" className="compte-discord-lien" onClick={() => discord.charger(true)}>Actualiser la liste du serveur</button>}
  </div>;
}
