/*
  Comptes individuels, côté navigateur (`ui/src/compte.js`).

  - lecture du paramètre `invitation` par `google.script.url`, et rien hors
    d'Apps Script ;
  - contrôle du mot de passe avant l'envoi ;
  - libellé du champ « code d'accès » selon les codes encore acceptés ;
  - description de l'état d'un compte sur la fiche d'un membre.

    node scripts/test-compte-ui.mjs
*/
import assert from 'node:assert/strict';
import { lireInvitationUrl, effacerInvitationUrl, verifierMotDePasse, libelleCodes, decrireCompte, motRechercheCompte, formatDateCompte, libelleHistoriqueCompte } from '../ui/src/compte.js';

// Hors d'Apps Script : aucune invitation, aucune erreur.
assert.equal(await lireInvitationUrl(), null);
effacerInvitationUrl();

// Dans Apps Script : le jeton de l'adresse, puis son effacement.
let remplacements = 0;
globalThis.google = { script: {
  url: { getLocation: cb => cb({ parameter: { invitation: ' abc123 ' } }) },
  history: { replace: () => { remplacements++; } }
} };
assert.deepEqual(await lireInvitationUrl(), { jeton: 'abc123' });
effacerInvitationUrl();
assert.equal(remplacements, 1);
globalThis.google.script.url.getLocation = cb => cb({ parameter: {} });
assert.equal(await lireInvitationUrl(), null, 'Sans paramètre : pas d’invitation');
delete globalThis.google;

// Mot de passe : longueur, confirmation.
assert.match(verifierMotDePasse('court', 'court'), /au moins 8/);
assert.match(verifierMotDePasse('assez long', 'assez lon'), /ne correspondent pas/);
assert.equal(verifierMotDePasse('assez long', 'assez long'), '');
assert.equal(verifierMotDePasse('assez long'), '', 'Sans confirmation demandée');

// Libellé du code d'accès.
assert.equal(libelleCodes(['OFFICIER', 'GARDE', 'INTENDANT']).titre, 'Code d’accès commun');
assert.equal(libelleCodes(['INTENDANT']).titre, 'Code de l’intendance');
assert.match(libelleCodes(['INTENDANT']).aide, /nom/);
assert.equal(libelleCodes(['garde']).titre, 'Code d’accès commun', 'Casse indifférente');
assert.match(libelleCodes([]).aide, /Aucun code/);
assert.equal(libelleCodes(undefined).titre, 'Code d’accès', 'Serveur muet : libellé général');

// État d'un compte.
const actif = decrireCompte({ etat: 'actif', expire: '', activeLe: '2026-11-10T10:00:00Z', derniereConnexion: '2026-11-12T08:30:00Z' });
assert.equal(actif.etiquette, 'Compte actif');
assert.match(actif.detail, /Mot de passe choisi le/);
assert.match(actif.detail, /dernière connexion/);
assert.equal(actif.lien, 'Nouveau lien (mot de passe oublié)');
assert.equal(actif.retrait, true);
const actifAvecLien = decrireCompte({ etat: 'actif', expire: '2026-11-17T10:00:00Z' });
assert.match(actifAvecLien.detail, /nouveau lien en cours/);
const invitation = decrireCompte({ etat: 'invitation', expire: '2026-11-17T10:00:00Z' });
assert.equal(invitation.etiquette, 'Lien remis');
assert.match(invitation.detail, /valable jusqu’au/);
assert.equal(invitation.lien, 'Nouveau lien');
assert.equal(decrireCompte({ etat: 'expire' }).etiquette, 'Lien expiré');
const aucun = decrireCompte({ etat: 'aucun' });
assert.equal(aucun.etiquette, 'Sans compte');
assert.equal(aucun.lien, 'Lien de connexion');
assert.equal(aucun.retrait, false);
assert.equal(decrireCompte(undefined).etiquette, 'Sans compte', 'Réponse serveur sans champ compte');
// Fiche sans accès (réserve, départ) : rien à remettre, mais un compte existant se retire.
assert.equal(decrireCompte({ etat: 'aucun' }, false).etiquette, '');
const reserveActif = decrireCompte({ etat: 'actif' }, false);
assert.equal(reserveActif.lien, '');
assert.equal(reserveActif.retrait, true);

// Qui a remis le lien, et le journal.
const remis = decrireCompte({ etat: 'invitation', expire: '2026-11-17T10:00:00Z', inviteePar: 'Astrid Brise-Lame', lienRemisLe: '2026-11-10T10:00:00Z' });
assert.match(remis.detail, /remis par Astrid Brise-Lame le .*2026/);
assert.match(decrireCompte({ etat: 'actif', expire: '2026-11-17T10:00:00Z', inviteePar: 'Rorik' }).detail, /nouveau lien en cours .*remis par Rorik/);
assert.match(libelleHistoriqueCompte({ date: '2026-11-10T10:00:00Z', action: 'lien', par: 'Astrid Brise-Lame', detail: 'Nouveau lien, compte déjà actif, valable jusqu’au 2026-11-17T10:00:00.000Z' }), /2026.*— Lien remis par Astrid Brise-Lame \(Nouveau lien, compte déjà actif\)$/);
assert.equal(libelleHistoriqueCompte({ action: 'activation', par: 'Sven' }), 'Compte activé par Sven');
assert.equal(libelleHistoriqueCompte({ action: 'inconnue' }), 'inconnue');

// Recherche de la page Effectifs.
assert.equal(motRechercheCompte({ etat: 'actif' }), 'compte actif');
assert.equal(motRechercheCompte({ etat: 'invitation' }), 'lien remis');
assert.equal(motRechercheCompte(undefined), 'sans compte');

// Dates.
assert.equal(formatDateCompte('pas une date'), '');
assert.match(formatDateCompte('2026-11-17T10:00:00Z'), /2026/);

console.log('Comptes (navigateur) : lecture du lien, mot de passe, libellé des codes, états et recherche validés.');
