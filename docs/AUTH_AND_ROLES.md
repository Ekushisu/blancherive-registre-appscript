# Authentification et rôles

## Rôle public VISITEUR

`ouvrirSessionPublique()` délivre un jeton de rôle `VISITEUR` **sans mot de
passe**, pour la consultation du Codex. Durée deux heures, contre huit pour une
session de service.

La Web App s'exécute avec le compte du propriétaire et en accès anonyme : toute
personne qui charge la page peut appeler n'importe quelle fonction serveur.
`requireRole()` est le seul rempart. Jusqu'à l'introduction de ce rôle, ne pas
connaître de mot de passe suffisait à bloquer l'accès ; ce n'est plus vrai.

**`VISITEUR` ne doit donc figurer que dans la liste de rôles de `getCodex`.**
L'ajouter à une autre fonction la rendrait entièrement publique, sans erreur ni
signal. `scripts/test-acces-public.mjs` échoue si ce rôle apparaît ailleurs dans
`src/`, vérifie que le visiteur ne passe aucune autre liste de rôles, que son
jeton est bien signé et qu'il expire avant celui d'un membre de la Garde.

Côté interface, le visiteur ne voit que l'onglet Codex et les autres pages ne
sont pas rendues. Ce n'est qu'un confort d'affichage : la protection réelle est
côté serveur.


## Rôles UI

Quatre rôles :
- `GARDE`
- `OFFICIER`
- `INTENDANT`
- `VISITEUR`, décrit en tête de ce document : il ne relève pas de `login()` et
  reste cantonné à `getCodex`.

Il n'existe pas de rôle UI `COMMANDEMENT`.

`INTENDANT` est un rôle de consultation distribué **hors de la garde** : argentier
de la cour, Thanes des garnisons, cuisines de la cour. Il ne dispose d'aucun droit
d'écriture, sur aucune page.

## Authentification

`Auth.js` utilise des Script Properties :
- `PASSWORD_GARDE`
- `PASSWORD_OFFICIER`
- `PASSWORD_INTENDANT`
- `AUTH_CODES` — rôles dont le code commun est accepté (voir plus bas)
- `AUTH_SECRET`

Une propriété absente ne correspond jamais, y compris à un mot de passe vide :
tant que `PASSWORD_INTENDANT` n'est pas renseigné dans les Script Properties,
aucun code ne peut ouvrir de session `INTENDANT`. Les rôles sont testés du plus
au moins privilégié, afin que le résultat reste déterministe si deux codes ont
été réglés à la même valeur par erreur.

Le login renvoie un token contenant :
- le rôle ;
- son origine `via` : `code` pour un code commun (le jeton public n'en porte pas) ;
- pour un code, l'empreinte `cle` du code en vigueur (HMAC par `AUTH_SECRET`,
  tronquée ; le code lui-même n'est jamais dans le jeton) ;
- une expiration.

Durées (demande du propriétaire, 11 octobre 2026 : plus de 24 heures ;
constantes `DUREE_SESSION_*` d'`Auth.js`) :
- **code commun : 3 jours**, jamais prolongé. Changer le code d'un rôle ferme
  aussitôt les sessions ouvertes avec l'ancien (empreinte), le désactiver aussi ;
- **Discord : 30 jours, glissants** : à chaque visite, au plus une fois par jour,
  `getSessionInfo` renvoie un jeton neuf (`jeton`), délivré seulement après
  `verifyAuthToken`, donc pour une fiche qui donne encore ce rôle à ce compte ;
- **visiteur du Codex : 2 heures**.

Le navigateur garde le jeton dans `localStorage`, d'une ouverture à l'autre ;
seul le bouton de déconnexion l'efface. Sur un ordinateur partagé, se
déconnecter. Avant le 11 octobre 2026 : 8 heures, et un jeton perdu à la
fermeture de l'onglet (`sessionStorage`), repris automatiquement par la
nouvelle version.

Le token est signé en HMAC SHA-256. Changer `AUTH_SECRET` ferme toutes les
sessions ouvertes, publiques comprises : c'est le recours si un jeton a pu être
fabriqué ou si un code a fuité.

### Aucune fabrique de jeton publique

Toute fonction de premier niveau sans `_` final est appelable depuis le
navigateur par `google.script.run`, en accès anonyme. Seules `login`,
`ouvrirSessionPublique` et `ouvrirSessionDiscord` délivrent un jeton, et chacune
décide elle-même du rôle ; la fabrique du jeton est `createAuthToken_`, privée.

Jusqu'au 10 octobre 2026, elle s'appelait `createAuthToken` et était donc
publique : n'importe quel visiteur pouvait se délivrer un jeton OFFICIER, pour la
durée de son choix, depuis la console de son navigateur. Le correctif a été
déployé et `AUTH_SECRET` changé par le propriétaire le 11 octobre 2026.
`scripts/test-auth-codes.mjs` fige la liste des fonctions publiques d'`Auth.js`
et celle des fonctions de `src/` qui appellent `createAuthToken_`.

### Codes communs activables par rôle (`AUTH_CODES`)

Décision du propriétaire, 10 octobre 2026, en préparation de la connexion par
Discord. Les codes communs restent, pour deux raisons :
- **secours** : si le serveur Discord est coupé, changé ou indisponible, le
  registre doit rester accessible ;
- **passation** : elle ne sera pas instantanée, certains gardes utiliseront
  encore le code avant de passer à Discord.

L'intendance — argentier de la cour, Thanes, cuisines — n'est pas sur le Discord
de la garde : **son code reste son seul accès** et doit rester actif en
permanence.

`AUTH_CODES` liste les rôles acceptés, séparés par des virgules, sans tenir
compte de la casse ni des espaces :

```
AUTH_CODES = GARDE,OFFICIER,INTENDANT   ← les trois codes
AUTH_CODES = GARDE,INTENDANT            ← officiers passés sur Discord
AUTH_CODES = INTENDANT                  ← garde entière passée sur Discord
(propriété absente)                     ← les trois codes, comme avant
```

- Un mot qui ne nomme aucun rôle (`AUCUN`, une faute de frappe) n'ouvre rien :
  `OFICIER,GARDE` ferme le code des officiers. Une valeur ne nommant aucun rôle
  ferme aussi l'intendance, qui n'a pas d'autre accès.
- Désactiver un rôle n'efface pas son code : `PASSWORD_<RÔLE>` reste en place
  pour un rallumage d'urgence.
- Un code commun n'identifie personne : on ne peut pas le retirer seulement à
  ceux qui sont passés sur Discord. La passation se fait rôle par rôle,
  OFFICIER d'abord, puis GARDE.
- Un code juste mais désactivé reçoit « Le code des officiers n'est plus
  accepté. » plutôt que « Mot de passe incorrect », qui ferait croire à une
  faute de frappe. Si le code d'un rôle coupé coïncide par erreur avec celui
  d'un rôle ouvert, c'est le rôle ouvert qui l'emporte.
- **Coupure immédiate** (décision du propriétaire) : `verifyAuthToken` refuse un
  jeton obtenu par un code désormais désactivé, dès l'appel suivant, sans
  attendre son expiration. Les jetons délivrés avant l'introduction de `via` n'en
  portent pas et sont traités comme obtenus par code. Rallumer un code ranime
  les sessions encore valides ouvertes avec lui ; pour les fermer
  définitivement, changer `AUTH_SECRET`.
- `VISITEUR` ne dépend d'aucun code.

L'interrupteur ne vit que dans les propriétés du script (éditeur Apps Script >
Paramètres du projet > Propriétés du script), jamais dans l'application ni dans
le classeur. Dans l'application, il serait hors d'atteinte le jour où Discord et
les codes sont coupés ensemble ; dans le classeur, tout éditeur de la feuille
pourrait rouvrir les codes.

**Procédure d'urgence** — rallumer un code après une longue coupure, c'est
rallumer un code que connaissent les radiés et les déserteurs, que Discord, lui,
aurait écartés. Réactiver un rôle, c'est donc aussi changer la valeur de son
`PASSWORD_<RÔLE>`. Le code ne peut pas l'imposer.

## Connexion par Discord — en conception

Le propriétaire a la main sur le serveur Discord de la Garde depuis octobre
2026. Principes retenus à ce stade, à compléter au fil de la conception :
- **le tableur décide** (décision du propriétaire, 10 octobre 2026) : le grade,
  le corps et le statut d'`Effectifs` déterminent les rôles Discord, que le bot
  applique ; jamais l'inverse. Un rôle géré, donné ou retiré à la main sur
  Discord, est rétabli à la synchronisation suivante ;
- par conséquent, **Discord ne prouve que l'identité**. Le rôle dans le registre
  se déduit de la ligne d'`Effectifs` rattachée au compte Discord, pas des rôles
  Discord : un rôle accordé à la main sur le serveur n'ouvre rien dans le
  registre. La connexion n'a pas besoin du bot ;
- **accès OFFICIER à partir de Sergent-Chef** (décision du propriétaire,
  11 octobre 2026) : Sergent-Chef et tout grade placé au-dessus dans l'ordre de
  `Données!A2:A` ouvrent une session OFFICIER, les grades placés en dessous une
  session GARDE. Le grade régulier fait foi, jamais l'alias : un Enquêteur de
  l'Inquisition est Sergent-Chef, donc OFFICIER. Proposé : un grade absent de
  `Données!A` ouvre une session GARDE ; le seuil est une constante du code, pour
  qu'un changement d'accès passe par une relecture du `git diff`. Le Hird du
  Jarl, le Jarl et le Maréchal suivent la même règle (décision du propriétaire,
  11 octobre 2026) : aucun corps ni aucune personne n'y fait exception ;
- **le statut prime sur le grade** (décisions du propriétaire, 11 octobre
  2026) :

  | Statut dans `Effectifs` | Registre par Discord | Rôles Discord gérés |
  |---|---|---|
  | `En service actif` | selon le grade (seuil ci-dessus) | ceux du grade, du corps et du statut |
  | `Réserve` | aucun accès | le seul rôle de réserviste |
  | départ (mort, radié, démissionnaire, déserteur) | aucun accès | tous retirés |

  Proposé : tout autre statut, y compris une faute de saisie, est traité comme
  un départ. Le code commun échappe à cette règle : un réserviste qui connaît
  le code des gardes entre encore tant que ce code est actif ;
- **pendant la passation, le bot ne touche pas aux comptes non rattachés**
  (décision du propriétaire, 11 octobre 2026) : un compte Discord qu'aucun
  officier n'a lié à une ligne d'`Effectifs` garde ses rôles, même gérés. Sans
  quoi les membres pas encore rattachés perdraient les leurs. Le retrait des
  rôles gérés aux comptes non rattachés viendra une fois tout le monde lié ;
- **le bot renomme les membres sur Discord** (décision du propriétaire,
  11 octobre 2026). Format à fixer. Le pseudo est un affichage : le grade y
  passe par `gradeAffiche_`, donc sous son alias pour l'Inquisition. Discord
  limite un pseudo à 32 caractères, et un bot ne peut renommer ni le
  propriétaire du serveur ni un membre dont le rôle est placé au-dessus du
  sien ;
- la connexion Discord délivrera **le même jeton** que `login()`, avec
  `via: "discord"` et l'identifiant du membre ; `requireRole()` et les listes
  de rôles ne changent pas, les deux modes cohabitent ;
- `AUTH_CODES` ne concerne pas les jetons Discord ;
- le bot n'est jamais « en ligne » : Apps Script ne tient pas de connexion
  permanente et ne lit pas les en-têtes de signature des commandes slash. Il
  s'utilise par l'API REST, depuis le serveur, avec son jeton rangé dans les
  Script Properties ;
- risque à mesurer par un prototype : Apps Script sort par des adresses IP Google
  partagées, que Discord bloque parfois temporairement. Raison de plus pour
  garder les codes en secours ;
- constaté le 11 octobre 2026 : `/users/@me` et `/users/@me/guilds` répondent,
  mais `/guilds/{id}` et `/guilds/{id}/members` renvoient 403 « internal network
  error », code 40333. C'est le refus réseau de Discord (Cloudflare), opposé
  notamment aux requêtes de bot dont le User-Agent ressemble à un navigateur ;
  celui d'Apps Script commence par « Mozilla ». Remède appliqué :
  `DISCORD_USER_AGENT` (« DiscordBot (adresse, version) ») sur chaque appel.
  **Vérifié le même jour : Google ignore cet en-tête** et envoie toujours le
  sien (`verifierConfigurationDiscord`, ligne « User-Agent », lue auprès de
  httpbin.org). Depuis Apps Script, les appels du bot sur le serveur sont donc
  refusés : liste des membres dans les fiches, et toute attribution de rôle ou
  de pseudo (étape 3). Le rattachement reste possible par l'identifiant tapé à
  la main ; le message du code 40333 le dit. La connexion des membres n'appelle
  que `/oauth2/token` et `/users/@me` : **confirmé le 11 octobre 2026**, le
  propriétaire s'est connecté par Discord après avoir rattaché son compte à la
  main. Pour les appels du bot, le propriétaire a retenu un relais hors
  d'Apps Script (même jour) : voir « Relais Discord » ci-dessous.

### Relais Discord (`relais-discord/`)

Décision du propriétaire, 11 octobre 2026 : les appels du bot passent par un
Cloudflare Worker, sur l'offre gratuite (100 000 requêtes par jour, très
au-delà du besoin de la Garde). Code, mise en ligne et vérification :
`relais-discord/README.md`.

- Le relais détient le **jeton du bot** (secret Cloudflare). Apps Script ne le
  détient plus : `DISCORD_BOT_TOKEN` quitte les propriétés du script.
- Le registre s'authentifie par `X-Relais-Secret` (`DISCORD_RELAIS_SECRET`,
  identique au secret `RELAIS_SECRET` du relais), comparé en temps constant.
  Sans secret valide, le relais ne dit rien de sa configuration.
- **Liste fermée de routes**, toutes sur le serveur `DISCORD_GUILD_ID` : lecture
  du bot et de ses serveurs, du serveur, de ses rôles et de ses membres ; ajout
  et retrait d'un rôle ; pseudo d'un membre, seul champ admis dans la requête.
  Pas de bannissement, d'expulsion, de message, de salon ni de modification de
  rôle, même avec le bon secret. Élargir cette liste demande une décision du
  propriétaire.
- Le relais rend la réponse de Discord telle quelle, avec ses en-têtes de
  limitation de débit ; ses propres refus portent un champ `relais` (`secret`,
  `refus`, `config`, `reseau`), que `Discord.js` traduit.
- La connexion des membres (OAuth) n'y passe pas. Si le relais tombe, seuls
  la liste des membres et, plus tard, la synchronisation des rôles s'arrêtent.
- `verifierConfigurationDiscord` éprouve le relais à chaque lancement : un
  secret faux et une route hors liste doivent être refusés.
- Le rôle du bot se place sous les rôles d'administration du serveur : Discord
  lui interdit alors de donner un rôle plus élevé que le sien.

### Parcours validé (11 octobre 2026)

Validé par le propriétaire, à réaliser en trois étapes, chacune livrable seule :

1. **Rattachement** — fait le 11 octobre 2026 (`Discord.js`, colonne
   `Effectifs!ID Discord`, voir DATA_MODEL). Un OFFICIER relie une fiche à un
   compte depuis le formulaire des Effectifs, en choisissant parmi les membres
   du serveur ou en tapant l'identifiant. Un garde ne se rattache jamais
   lui-même : n'importe qui pourrait se déclarer Capitaine.
2. **Connexion** — réalisée le 11 octobre 2026, détail dans « Session
   Discord » ci-dessous. Bouton « Se connecter avec Discord », page d'autorisation
   ouverte dans tout l'onglet avec un `state` aléatoire gardé par le navigateur,
   droit `identify` seul, retour sur l'adresse `/exec`, échange du code côté
   serveur, recherche de la fiche par `ID Discord`, jeton habituel avec
   `via: "discord"` et l'identifiant du membre. Messages explicites pour un
   compte non rattaché (avec son pseudo et son identifiant, à transmettre à un
   officier) ou un statut sans accès. Interrupteur `AUTH_DISCORD` : tant qu'il ne
   vaut pas `ACTIF`, le bouton est caché et toute session Discord refusée.
   Coupure immédiate par une table d'accès (membre → rôle) dans les Script
   Properties, recalculée à chaque modification d'Effectifs, par l'application,
   par le déclencheur des éditions manuelles et par la synchronisation ;
   `verifyAuthToken` refuse un jeton dont le rôle ne correspond plus.
   L'écran de connexion met Discord en avant et garde le code en dessous, pour
   l'intendance et le secours.
3. **Synchronisation** — rôles et pseudos réalisés le 11 octobre 2026, détail
   dans « Synchronisation des rôles » ci-dessous.

Configuration, dans les Script Properties uniquement : `DISCORD_CLIENT_ID`,
`DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` (adresse exacte de la Web App,
déclarée aussi dans le portail Discord), `DISCORD_GUILD_ID`,
`DISCORD_RELAIS_URL` et `DISCORD_RELAIS_SECRET`. Le jeton du bot est un secret
du relais Cloudflare, pas du registre. Aucun secret ne transite par le code, le
dépôt, le classeur, une conversation ou une capture d'écran : un secret exposé
se réinitialise (portail Discord, ou nouveau secret partagé des deux côtés).

Le premier `clasp push` qui appelle Discord ajoute la permission « services
externes » (`UrlFetchApp`) : le propriétaire doit l'autoriser une fois en
lançant une fonction depuis l'éditeur Apps Script, sans quoi les appels de la
Web App échouent avec « Vous n'êtes pas autorisé à appeler UrlFetchApp.fetch ».
Google laisse cocher les autorisations une à une : toutes doivent l'être, et une
autorisation refusée n'est pas redemandée d'elle-même (constaté le 11 octobre
2026 : diagnostic lancé depuis l'éditeur sans nouvelle fenêtre). Remède sans
code : supprimer l'accès du projet sur myaccount.google.com/connections, puis
relancer une fonction depuis l'éditeur. `verifierConfigurationDiscord` appelle
en outre `ScriptApp.requireScopes` pour « services externes », qui rouvre la
fenêtre d'autorisation si la permission manque, puis rend compte de la
configuration au journal d'exécution.

### Synchronisation des rôles

Rôles du serveur décrits puis relevés par le propriétaire le 11 octobre 2026 :
- fonction : **Garde de Blancherive** pour tout membre en service actif (ni
  réserve, ni départ) ; **Officiers de Blancherive**, rôle d'administration
  Discord, à partir de Lieutenant, sans lien avec l'accès OFFICIER du registre
  (Sergent-Chef) ;
- un rôle par grade, du nom du grade, sauf **Garde du domaine** pour le grade
  Garde ;
- un rôle par corps : Corps des éclaireurs, Brigade de l'Inquisition, Etat
  major, Garnison des faubourgs, Garnison de Rivebois, Garnison de
  Bois-de-Chêne, Garnison de Cap Granite, La hird du Jarl (créé le même jour),
  et **Garde de Fort-Dragon** pour la Cité de Blancherive : c'est le nom de la
  garde de la Cité sur le serveur. Un membre de la Cité a donc Garde de
  Blancherive (fonction) et Garde de Fort-Dragon (corps) ;
- **Réserviste** pour la réserve, seul ; aucun rôle pour un départ.

**Jarl** et **Etat major** sont placés au-dessus du rôle du bot : le bot ne peut
pas les donner, le préremplissage les laisse vides et le dit. Pour les confier
à la synchronisation, le propriétaire du serveur doit remonter le rôle du bot
au-dessus d'eux.

Mécanisme (`SynchroDiscord.js`, feuille `RolesDiscord`, voir DATA_MODEL) :
- rôles gérés : ceux que nomme la feuille, et eux seuls. Pour chaque compte
  rattaché et présent sur le serveur, le bot ajoute les rôles gérés qui lui
  reviennent, puis retire les autres rôles gérés. Aucun autre rôle n'est
  touché ; les comptes non rattachés non plus, le temps de la passation ;
- grade régulier, jamais l'alias : un Inquisiteur reçoit le rôle « Garde »
  (rôles d'alias à confirmer) ;
- interrupteur `DISCORD_SYNCHRO` : `SIMULATION` calcule et consigne sans rien
  changer, `ACTIF` applique, toute autre valeur coupe ;
- passages : après chaque modification d'Effectifs par le registre (hors du
  verrou, une panne n'annule jamais la modification) et toutes les heures, par
  un déclencheur installé à la consultation des Effectifs dès que l'interrupteur
  existe. Les modifications faites à la main dans la feuille attendent le
  passage horaire ;
- 80 opérations au plus par passage, ajouts d'abord ; une limitation de débit
  arrête le passage et laisse le reste au suivant ; chaque opération porte une
  raison au journal d'audit Discord (« Registre de la Garde : nom (statut,
  grade, corps) ») ;
- `simulerSynchroDiscord()`, depuis l'éditeur : plan détaillé au journal
  d'exécution, sans rien appliquer, quel que soit l'interrupteur. Le diagnostic
  résume le dernier passage ;
- **pseudos** (décision du propriétaire, option B) : « Prénom Nom » de la
  fiche, en service comme en réserve, le grade restant lisible à la couleur du
  rôle ; pseudo effacé pour un départ ; 32 caractères au plus, coupé par « … ».
  Appliqués dans le même passage, après les rôles, aux seuls comptes
  rattachés. Discord interdit de renommer le propriétaire du serveur et un
  membre dont un rôle est placé au-dessus du bot (Jarl, Etat major) : leur
  pseudo est laissé, et le rapport le note à chaque passage.

**Mise en service** : lancer `simulerSynchroDiscord` (la feuille se crée),
relire et corriger `RolesDiscord`, la protéger, régler `DISCORD_SYNCHRO` à
`SIMULATION` le temps de quelques passages, puis à `ACTIF`. Le rôle du bot doit
être au-dessus d'Officier de Blancherive et de tous les rôles de la feuille.

### Ce que change une session Discord

- `getLivretService` (Livret de service) : GARDE et OFFICIER, **et seulement en
  session Discord** — un code commun n'identifie personne et reçoit un refus.
  Ne renvoie que les données du membre désigné par l'ID membre du jeton.
- `ajouterAmende`, `ajouterPrison` : en session Discord, le garde inscrit est
  celui de la session, officier compris (`imposerGardeSession_`) ;
  `getAmendeFormData` et `getPrisonFormData` le renvoient sous `gardeImpose`
  pour figer le champ.
- `modifierAmendeCheckbox`, case Payé : en session Discord, un GARDE ne la
  change que sur ses propres amendes ; `getAmendes` renvoie `encaissement`
  pour griser les autres cases. Seul le serveur l'impose.
- Interface : le livret s'ouvre par défaut, le nom s'affiche dans la barre
  latérale, sa ligne de Présences et sa carte d'Organigramme sont repérées
  (« · vous »). Règles métier détaillées : BUSINESS_RULES, « Saisie à son
  propre nom » et « Livret de service ».

### Session Discord

- `getModesConnexion()` : appelée par l'écran de connexion, sans jeton. Renvoie
  `{ discord: { url } }` si `AUTH_DISCORD` vaut `ACTIF` et que
  `DISCORD_CLIENT_ID` et `DISCORD_REDIRECT_URI` sont bien formés, sinon
  `{ discord: null }`. L'adresse ne porte que l'identifiant public de
  l'application, `scope=identify`, `prompt=none` et l'adresse de retour.
- Au retour, l'interface vérifie le `state`, retire le code de l'adresse et
  appelle `ouvrirSessionDiscord(code)`. Celle-ci contrôle l'interrupteur et le
  format du code avant tout appel, échange le code (`/oauth2/token`), lit
  l'identité (`/users/@me`), puis cherche la fiche par une synchronisation
  complète de l'historique. Le jeton d'accès Discord n'est ni gardé ni
  transmis.
- Rôle : `roleRegistreDiscord_` — service actif seul ; OFFICIER si le grade est
  `DISCORD_SEUIL_OFFICIER` (Sergent-Chef) ou au-dessus dans `Données!A2:A`,
  GARDE sinon, y compris pour un grade absent de la liste. Si le seuil lui-même
  disparaît de `Données!A`, personne n'est OFFICIER par Discord.
- Table d'accès `DISCORD_ACCES` (Script Property, technique) : identifiant
  Discord → `O|` ou `G|` suivi des huit premiers caractères de l'ID membre.
  Recalculée par `mettreAJourAccesDiscord_` à chaque synchronisation de
  l'historique des Effectifs (pages Organigramme et Effectifs, modifications par
  l'application, déclencheur des éditions à la main) et à chaque connexion,
  écrite seulement si elle change. Une table trop grande (au-delà d'environ 250
  comptes) est effacée : sessions Discord refusées, codes intacts.
- `verifyAuthToken`, pour `via: "discord"` : refuse si `AUTH_DISCORD` n'est plus
  `ACTIF`, ou si la table ne donne plus ce rôle à cette fiche pour ce compte
  (« Votre accès au registre a changé : reconnectez-vous. »). Rétrogradation,
  réserve, départ, lien retiré ou donné à une autre fiche ferment donc la session
  à l'appel suivant ; une promotion prend effet à la reconnexion.
- Le jeton porte `nom` (prénom et nom de la fiche) : `getSessionInfo` le renvoie
  et l'interface l'affiche en info-bulle du rôle. Il ne sert qu'à l'affichage.
- Refus explicites : compte non rattaché (avec pseudo et identifiant, à
  transmettre à un officier), compte relié à plusieurs fiches, statut sans
  accès, adresse de retour différente de celle du portail, code expiré.
- Limite connue : `ouvrirSessionDiscord` est publique, comme `login`. Un tiers
  peut l'appeler en boucle avec de faux codes ; chaque appel part vers Discord
  depuis les adresses partagées de Google. Aucune limitation de débit pour
  l'instant.

**Ouvrir la connexion Discord** : vérifier le diagnostic, déclarer
`DISCORD_REDIRECT_URI` à l'identique dans le portail Discord (OAuth2 >
Redirects), rattacher au moins son propre compte, puis régler `AUTH_DISCORD` à
`ACTIF`. La couper : toute autre valeur.

## Autorisations

Toujours vérifier côté serveur avec `requireRole()`.

Règles connues :

### GARDE
- Organigramme
- Présences en lecture seule
- Codex
- Décrets de peines et amendes, en lecture
- Amendes (création et statut `Payé`)
- Prison

### OFFICIER
- tout ce qui précède ;
- Effectifs ;
- édition Présences ;
- tableau de bord officier ;
- suppression Amendes ;
- modification d'une amende (`modifierAmende` : date, garde, contrevenant,
  chefs d'accusation, montant) ;
- modification du statut `Reversé` des Amendes ;
- suppression Prison ;
- modification d'une incarcération (`modifierPrison` : tout sauf la case
  Libéré) ;
- règlement d'une semaine depuis la page Paye ;
- inventaire des coffres : création et modification des coffres, quantités,
  rangement groupé, déplacements.

### INTENDANT
- Organigramme en lecture, comme un GARDE : c'est de là que les cuisines de la
  cour tirent l'effectif à nourrir ;
- page Paye en lecture seule ;
- page Inventaire en lecture seule : l'intendance de la cour doit savoir ce que
  la garde possède, sans pouvoir le modifier ;
- Codex et décrets de peines et amendes en lecture, depuis le 4 octobre 2026
  (décision du propriétaire) : `getCodex` et `getPeinesAmendes` acceptent son
  rôle.

Aucune autre page ne lui est accessible, ni Présences, ni Amendes, ni Prison,
ni Effectifs. À la différence de `VISITEUR`, `INTENDANT` s'obtient
par un mot de passe et n'ouvre aucune fonction au public. La navigation ne lui propose que ses cinq pages, et
chaque API refuse son rôle côté serveur.

Un contrôle uniquement côté React n'est jamais suffisant.

### Catalogue des objets

`rechercherObjets` et `getCatalogueObjets` autorisent GARDE et OFFICIER après
`requireRole()`, avant toute lecture ou initialisation Sheets. INTENDANT n'a
aucun formulaire d'objets et ne reçoit pas le catalogue ; le rôle public non plus. `ajouterPrison` vérifie le même rôle avant la
validation des objets. L'initialisation d'une feuille Objets absente est un helper
privé, sous verrou ; aucune API Web de remplacement ou d'import libre du catalogue.

## Amendes et Prison

`getAmendes`, `getAmendeFormData`, `ajouterAmende`, `getPrison`,
`getPrisonFormData` et `ajouterPrison` autorisent `GARDE` et `OFFICIER`.
`modifierAmende` et `modifierPrison` n'autorisent que `OFFICIER`, avant toute
ouverture du classeur, au même titre que `supprimerAmende` et
`supprimerPrison` : un garde qui se trompe demande la correction à un
officier. Les deux exigent en outre l'identité affichée de la ligne (`attendu`)
et refusent d'écrire si elle a changé.

`getCodex` reste la seule fonction ouverte au rôle public ; elle autorise
`VISITEUR`, `GARDE`, `OFFICIER` et `INTENDANT`, et son paramètre
`versionConnue` ne change pas sa liste de rôles. Les formulaires Amendes et
Prison lisent le Codex par cette fonction, avec un jeton de service.

## Décrets de peines et amendes

`getPeinesAmendes` autorise `GARDE` et `OFFICIER`, qui sanctionnent, et
`INTENDANT`, qui consulte, avant toute ouverture du classeur. `VISITEUR` est
refusé. Il
n'existe aucune fonction d'écriture du barème : la feuille `PeinesAmendes`
se corrige dans Sheets. Le Codex public (`getCodex`, seule fonction ouverte
au visiteur) ne transporte pas le barème ; la lecture d'un article s'y
affiche sans lui. Le navigateur ne demande pas le barème pour le visiteur,
mais seul `requireRole()` le protège. `scripts/test-peines.mjs` vérifie que
chaque refus précède toute lecture Sheets.

## Paye

`getPaye` autorise `OFFICIER` et `INTENDANT`. `reglerSemainePaye` n'écrit rien
par lui-même : il délègue à `ecrirePresenceCellule_`, partagé avec la page
Présences, qui exige `OFFICIER` avant toute ouverture du classeur. Un INTENDANT
qui appellerait `reglerSemainePaye` depuis la console est donc refusé au même
titre qu'un GARDE, indépendamment de ce que l'interface affiche.

## Inventaire

`getInventaire` autorise `OFFICIER` et `INTENDANT`. `ajouterCoffre`,
`modifierCoffre`, `ajusterInventaire`, `rangerInventaire` et `deplacerInventaire`
n'autorisent que `OFFICIER`, avant toute ouverture du classeur. `GARDE` n'apparaît dans aucune
de ces listes : la page n'existe pas pour lui, ni en lecture ni en écriture.
L'interface cache la page au GARDE et les commandes à l'INTENDANT, mais seul
`requireRole()` protège réellement. `scripts/test-inventaire.mjs` vérifie que
chaque refus précède toute lecture Sheets.

## Discord

`getMembresDiscord` n'autorise que `OFFICIER`, avant toute lecture de
configuration ou tout appel à Discord : la liste des membres du serveur ne sert
qu'à rattacher une fiche. Le rattachement passe par `modifierEffectif`, déjà
réservé à `OFFICIER`. `getOrganigramme` ne transmet aucun compte Discord.
`scripts/test-discord-rattachement.mjs` vérifie l'ordre des contrôles.

## Nouveautés des Effectifs

- `getEffectifs` reste OFFICIER ; `getOrganigramme` accepte GARDE, OFFICIER et INTENDANT. Leurs réponses incluent les événements récents filtrés côté serveur selon le rôle.
- La synchronisation et le déclencheur sont des helpers privés suffixés `_`, non appelables via `google.script.run`. Les mutations publiques vérifient OFFICIER avant tout accès au journal.
- Le journal est commun ; les ID événements vus sont enregistrés dans le navigateur, pas dans le token ni sous une identité Google supposée.
