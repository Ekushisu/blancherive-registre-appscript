## 🛡️ Ticket : outils de la Garde de Blancherive sur le Discord principal

Bonjour au staff 👋

Je fais suite à l'échange du 13 octobre dans le salon de la Garde, comme Fruit et Encore-Un-Espoir l'ont proposé. Avant tout, deux choses :
- 🏠 **le Discord séparé de la Garde ferme, nous rapatrions tout ici.** Il aurait fallu passer par vous avant de le construire, ça n'a pas été fait : c'est notre erreur. Avec le nombre de Discord liés à Keizaal que vous surveillez déjà, la règle se comprend ;
- 🙏 je m'excuse pour le ton de mes derniers messages. C'était de la frustration après beaucoup d'heures de travail, pas un reproche envers vous.

Ce ticket pose une seule question : **un bot de synchronisation des rôles peut-il tourner ici, sur le Discord principal, sous votre contrôle ?** 📜 Le système de missives fera l'objet d'un autre ticket.

Ci-dessous, pourquoi on en a besoin, ce qu'il fait exactement, et les garde-fous que je propose face aux points soulevés : pseudos, données des autres joueurs, RGPD, conflit d'intérêt. Désolé d'avance pour le tunnel 😅 : j'ai préféré tout détailler plutôt que de laisser une question sans réponse.
=====
## ⏳ 1. Pourquoi on en a besoin

La Garde compte environ 120 membres. Leur suivi tient dans un registre Google Sheets 📋 : grade, corps, statut (actif, réserve, départ), présences, solde, amendes, prison.

Aujourd'hui, chaque changement du registre doit être reporté **à la main** sur Discord : une promotion, une mutation de garnison, un passage en réserve, un départ. Pour 120 personnes, ce travail prenait aux officiers plusieurs heures par jour, avec des oublis inévitables :
- 🚪 un déserteur qui garde l'accès aux salons de la Garde ;
- 🆕 une recrue qui attend ses rôles ;
- 🔀 des rôles qui ne correspondent plus au registre.

Le bot fait ce report à notre place. **Le registre devient la seule source de vérité, et Discord le suit.** ✅ Les officiers passent ce temps à jouer, et les salons de la Garde ne restent pas ouverts à quelqu'un qui est parti.
=====
## 🔢 2. Un identifiant, jamais un pseudo

Vous avez indiqué que les outils qui stockent ou utilisent les pseudos Discord ne sont pas autorisés. **Celui-ci n'en stocke ni n'en utilise aucun.**

- 🪪 La fiche d'un garde reçoit une seule donnée Discord : son **identifiant numérique** (du type 123456789012345678), saisi à la main par un officier. Un garde ne peut pas se rattacher lui-même.
- 🚫 Aucun pseudo, nom d'utilisateur, avatar, e-mail, IP, message ou liste de serveurs n'est enregistré.
- 🔒 L'identifiant ne change jamais, contrairement au pseudo. C'est ce qui permet au bot de savoir à qui donner un rôle **sans jamais regarder les pseudos**.
- 👁️ Quand le bot consulte un membre rattaché, Discord lui renvoie sa fiche complète, pseudo compris : le bot n'y lit que la liste des rôles et ne garde rien.
- 🗝️ Les identifiants ne sont visibles que des officiers (page Effectifs du registre) et des personnes qui gèrent le tableur.

⚖️ Côté RGPD : l'identifiant est le strict minimum pour faire le lien, il ne sert qu'à ça, il n'est transmis à personne, et il s'efface sur simple demande du joueur ou du staff. Le bot ne touche alors plus jamais à ce compte.
=====
## 🤖 3. Ce que ferait le bot ici, et rien d'autre

- 🎖️ **Une seule action : ajouter ou retirer des rôles de la Garde** aux comptes rattachés à une fiche, avec les rôles que vous validez et aucun autre.
- 🏷️ **Il ne renomme personne.** La gestion des pseudos existait sur le Discord de la Garde ; elle disparaît pour le Discord principal.
- 👥 **Il ne parcourt pas la liste des membres du serveur.** Il ne consulte que les comptes rattachés, un par un, par leur identifiant. Les autres joueurs de Keizaal ne passent jamais par lui, et il n'a pas besoin de l'intent privilégié « Server Members ».
- 💤 Il ne se connecte jamais en continu : il apparaît hors ligne et **ne reçoit ni message, ni statut, ni activité vocale**. Il ne lit aucun salon.
- 🔑 Une seule permission : **Gérer les rôles**.
- 🧱 Ses appels passent par un petit relais dont la liste d'actions est **fermée** : lire un membre rattaché, lui ajouter ou retirer un rôle autorisé. Le relais refuse tout le reste, même avec le bon mot de passe ❌ bannir, expulser, rendre muet, écrire, toucher aux salons, modifier un rôle ou un pseudo. Il n'a aucune base de données.
- 📒 Chaque action apparaît dans le **journal d'audit** du serveur avec sa raison : « Registre de la Garde : Prénom Nom (statut, grade, corps) ».
=====
## 👮 4. Le staff garde la main

Vous avez rappelé qu'un membre de la Garde ne doit pas contrôler seul un outil qui agit sur le serveur. Je propose donc :

- 📍 **Vous placez le rôle du bot**, juste au-dessus des rôles de la Garde et sous tout le reste. Discord lui interdit alors de toucher à un rôle ou à un membre placé plus haut.
- 📝 **Vous fixez la liste des rôles autorisés.** Elle est inscrite dans le relais, pas dans le tableur : un officier ne peut pas l'élargir, et tout rôle hors liste est refusé.
- 🛠️ **Vous entrez dans l'équipe de l'application** sur le portail développeur Discord, avec les droits d'administration : vous voyez sa configuration et pouvez réinitialiser son jeton, ce qui coupe le bot sur-le-champ.
- 🔌 **Vous pouvez l'expulser à tout moment.** Rien ne casse : le registre continue de fonctionner, et on revient aux rôles à la main.
- 🔍 **Le code est lisible.** Je vous ouvre le dépôt et je fais une démo en vocal 🎙️ avant toute mise en service.
- 🎫 **Rien n'évolue sans vous** : toute nouvelle fonction du bot passe par un ticket.
=====
## 🔐 5. En option : se connecter au registre avec Discord

C'est indépendant du bot : vous pouvez accepter l'un et refuser l'autre.

Aujourd'hui, le registre s'ouvre avec un mot de passe commun par rang. Ce mot de passe circule, et un garde qui part le garde : pour lui couper l'accès, il faut changer le code et le redonner aux 120 gardes. On ne sait pas non plus qui a créé ou supprimé une amende.

Avec la connexion Discord :
- 👤 chacun se connecte avec son compte, et l'accès suit la fiche : un départ ou une rétrogradation coupe l'accès de la seule personne concernée ;
- ✍️ chaque amende et chaque incarcération est signée par la personne connectée ;
- 🤏 l'autorisation demandée est **`identify`**, la plus restreinte de Discord, et l'écran de Discord l'affiche lui-même. Ni e-mail, ni serveurs, ni messages ;
- 🗑️ le registre n'en lit que l'identifiant, pour le comparer aux fiches, et n'enregistre rien de nouveau. L'accès accordé par Discord est jeté aussitôt : le registre ne peut plus rien lire ensuite ;
- ↩️ chacun peut retirer l'autorisation : Paramètres Discord → Applications autorisées.

🆘 Les mots de passe restent en secours.
=====
## ✅ En résumé

- 🏠 Plus de Discord séparé : tout revient ici.
- 🤖 Un bot qui ne fait qu'ajouter ou retirer les rôles de la Garde, aux seuls comptes rattachés par les officiers, avec les rôles que vous choisissez.
- 🚫 Aucun pseudo stocké ni utilisé, aucun autre joueur concerné.
- 👮 Le contrôle reste au staff : rôle du bot, liste des rôles, jeton, expulsion.

Je suis disponible pour une démo ou un vocal quand ça vous arrange 🎙️ Merci d'avoir laissé la porte ouverte 🙏
