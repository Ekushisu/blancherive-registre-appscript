# Relais Discord

Petit programme hébergé sur Cloudflare Workers (offre gratuite), entre le
registre et Discord, pour les seuls appels du bot.

**Pourquoi.** Discord refuse les appels de bot dont l'en-tête User-Agent
ressemble à celui d'un navigateur (403, code 40333). Apps Script impose le sien,
« Mozilla/5.0 (compatible; Google-Apps-Script…) », et ne le laisse pas
remplacer : depuis Apps Script, le bot ne peut ni lister les membres du serveur
ni donner de rôle. Le relais ajoute un en-tête de bot et transmet. La connexion
des membres par Discord n'y passe pas : elle fonctionne sans lui.

**Ce que le relais permet, et rien d'autre**, sur le seul serveur
`DISCORD_GUILD_ID` :

- lire le compte du bot et la liste de ses serveurs (diagnostic) ;
- lire le serveur, ses rôles, ses membres ;
- ajouter ou retirer un rôle à un membre ;
- changer ou effacer le pseudo d'un membre, sans autre champ dans la requête.

Bannir, expulser, écrire un message, toucher aux salons ou modifier un rôle lui
sont refusés, même avec le bon secret. Dernière borne : Discord interdit à un
bot de donner un rôle placé au-dessus du sien. Placez donc le rôle du bot sous
les rôles d'administration du serveur et au-dessus des rôles de grades et de
corps.

**Secrets.** Le jeton du bot ne vit qu'ici, en secret Cloudflare : le registre
ne le détient plus. Le registre s'authentifie auprès du relais par un secret
partagé. Aucun de ces secrets ne doit figurer dans le dépôt, dans le classeur,
dans une conversation ou sur une capture d'écran.

## Mise en ligne (tableau de bord, rien à installer)

1. **Générer le secret partagé**, dans un terminal, sans le transmettre à
   personne :

   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

2. **Créer le relais.** Sur https://dash.cloudflare.com (compte gratuit) :
   *Workers & Pages* → *Create* → *Create Worker*. Nommez-le
   `relais-discord-garde`, puis *Deploy*.
3. **Mettre le code.** *Edit code* : remplacez tout le contenu par celui de
   [`worker.js`](worker.js), puis *Deploy*.
4. **Déclarer les secrets.** *Settings* → *Variables and Secrets* → *Add*,
   type **Secret** pour chacun :

   | Nom | Valeur |
   |---|---|
   | `DISCORD_BOT_TOKEN` | un jeton **neuf** : portail Discord, onglet Bot, *Reset Token* |
   | `DISCORD_GUILD_ID` | l'identifiant du serveur de la Garde |
   | `RELAIS_SECRET` | le secret généré à l'étape 1 |

5. **Relever l'adresse** du relais, de la forme
   `https://relais-discord-garde.<votre-sous-domaine>.workers.dev`.

## Côté registre (propriétés du script Apps Script)

| Propriété | Valeur |
|---|---|
| `DISCORD_RELAIS_URL` | l'adresse de l'étape 5, sans barre finale |
| `DISCORD_RELAIS_SECRET` | le même secret qu'à l'étape 1 |

Puis **supprimez `DISCORD_BOT_TOKEN`** des propriétés du script : le registre
ne s'en sert plus.

## Vérifier

Dans l'éditeur Apps Script, lancez `verifierConfigurationDiscord`. Le journal
doit montrer :

- « Secret exigé » : le relais refuse un secret faux ;
- « Routes fermées » : le relais refuse une route hors de sa liste ;
- « Bot », « Serveurs du bot », « Serveur », « Membres » en ✓.

## Mettre à jour

Ce dossier ne part pas avec `clasp push`. Après une modification de
`worker.js`, recollez-le dans *Edit code* puis *Deploy*. En ligne de commande,
`npx wrangler deploy` depuis ce dossier fait la même chose (voir
`wrangler.toml`).

`scripts/test-relais-discord.mjs` vérifie le relais : secret, routes fermées,
pseudo seul, réponses de Discord.
