/*
  Privilèges par grade (`Privileges.js`), décision du propriétaire du
  10 novembre 2026 :

  - renommage, affectation, statut, spécialité : Capitaine et plus ;
  - grade et inscription d'un membre : Lieutenant et plus, grade strictement
    sous le sien, membre placé sous lui ;
  - lien de connexion : Lieutenant et plus ;
  - session par code commun : rien n'est limité ; fiche introuvable ou grade
    hors de `Données!A` : rien n'est permis.

  `Effectifs.js` est contrôlé sur son texte : chaque mutation appelle les
  vérifications avant toute écriture.

    node scripts/test-privileges.mjs
*/
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const GRADES = ['Jarl', 'Huscarl', 'Commander', 'Major', 'Capitaine', 'Lieutenant-Chef', 'Lieutenant',
  'Sergent-Chef', 'Sergent', 'Caporal-Chef', 'Caporal', 'Garde', 'Cadet', 'Recrue'];
const donnees = {
  getLastRow: () => GRADES.length + 1,
  getRange: (row, col, height) => ({ getDisplayValues: () => GRADES.slice(row - 2, row - 2 + height).map(g => [g]) })
};
const ss = { getSheetByName: nom => (nom === 'Données' ? donnees : null) };
const uuid = n => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;
const members = [
  { id: uuid(1), prenom: 'Haldvar', nom: 'Commander', grade: 'Commander', status: 'En service actif' },
  { id: uuid(2), prenom: 'Astrid', nom: 'Capitaine', grade: 'Capitaine', status: 'En service actif' },
  { id: uuid(3), prenom: 'Rorik', nom: 'Lieutenant', grade: 'Lieutenant', status: 'En service actif' },
  { id: uuid(4), prenom: 'Eydis', nom: 'Sergent-Chef', grade: 'Sergent-Chef', status: 'En service actif' },
  { id: uuid(5), prenom: 'Inconnu', nom: 'Grade', grade: 'Écuyer', status: 'En service actif' }
];

const context = vm.createContext({
  EFFECTIFS_WEB_DONNEES_SHEET_NAME: 'Données',
  normaliserEffectifsWeb_: value => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
});
// `lireOrdreGradesDiscord_` et `cleGradeDiscord_` viennent de Discord.js.
vm.runInContext(readFileSync('src/Discord.js', 'utf8'), context);
vm.runInContext(readFileSync('src/Privileges.js', 'utf8'), context);

const session = n => context.gradeSession_(ss, { via: 'compte', membre: uuid(n) }, members);
const code = context.gradeSession_(ss, { via: 'code', role: 'OFFICIER' }, members);
const peut = (s, cle) => context.aLePrivilege_(s, cle);

// ---------------------------------------------------------------- seuils
assert.equal(code, null, 'Code commun : pas de fiche');
for (const cle of ['renommer', 'corps', 'statut', 'specialite', 'grade', 'lien']) {
  assert.equal(peut(code, cle), true, `Code commun : ${cle} permis`);
  assert.equal(peut(session(1), cle), true, `Commander : ${cle} permis`);
  assert.equal(peut(session(2), cle), true, `Capitaine : ${cle} permis`);
  assert.equal(peut(session(4), cle), false, `Sergent-Chef : ${cle} refusé`);
  assert.equal(peut(session(5), cle), false, `Grade inconnu : ${cle} refusé`);
  assert.equal(peut(context.gradeSession_(ss, { via: 'compte', membre: uuid(99) }, members), cle), false, `Fiche introuvable : ${cle} refusé`);
}
for (const cle of ['renommer', 'corps', 'statut', 'specialite']) {
  assert.equal(peut(session(3), cle), false, `Lieutenant : ${cle} réservé aux Capitaines`);
}
assert.equal(peut(session(3), 'grade'), true, 'Lieutenant : grades');
assert.equal(peut(session(3), 'lien'), true, 'Lieutenant : liens');
assert.throws(() => context.exigerPrivilege_(session(3), 'renommer'), /Renommer un membre est réservé aux Capitaines et plus\./);
assert.throws(() => context.exigerPrivilege_(session(4), 'lien'), /Remettre un lien de connexion est réservé aux Lieutenants et plus\./);
assert.throws(() => context.exigerPrivilege_(session(4), 'grade'), /Attribuer ou changer un grade est réservé aux Lieutenants et plus\./);
context.exigerPrivilege_(code, 'renommer');
context.exigerPrivilege_(session(2), 'statut');

// ---------------------------------------------------------------- grade sous le sien
const lt = session(3);
context.exigerGradeSousLeSien_(lt, 'Sergent-Chef', 'attribuer');
context.exigerGradeSousLeSien_(lt, 'Recrue', 'attribuer');
assert.throws(() => context.exigerGradeSousLeSien_(lt, 'Lieutenant', 'attribuer'), /qu'un grade inférieur au vôtre/, 'Pas son propre grade');
assert.throws(() => context.exigerGradeSousLeSien_(lt, 'Lieutenant-Chef', 'attribuer'), /qu'un grade inférieur au vôtre/);
assert.throws(() => context.exigerGradeSousLeSien_(lt, 'Capitaine', 'membre'), /membre placé sous le vôtre/, 'Pas rétrograder un supérieur');
assert.throws(() => context.exigerGradeSousLeSien_(lt, 'Écuyer', 'attribuer'), /inférieur au vôtre/, 'Grade inconnu : jamais attribuable');
context.exigerGradeSousLeSien_(code, 'Commander', 'attribuer');
context.exigerGradeSousLeSien_(session(1), 'Capitaine', 'membre');
assert.throws(() => context.exigerGradeSousLeSien_(session(5), 'Recrue', 'attribuer'), /inférieur au vôtre/, 'Grade inconnu : rien');

// ---------------------------------------------------------------- pour l'interface
const privLt = context.privilegesSession_(ss, { via: 'compte', membre: uuid(3) }, members);
assert.equal(privLt.grade, 'Lieutenant');
assert.equal(privLt.nominative, true);
assert.deepEqual({ ...privLt.peut }, { renommer: false, corps: false, statut: false, specialite: false, grade: true, lien: true });
assert.deepEqual([...privLt.gradesAttribuables], ['Sergent-Chef', 'Sergent', 'Caporal-Chef', 'Caporal', 'Garde', 'Cadet', 'Recrue']);
const privCode = context.privilegesSession_(ss, { via: 'code' }, members);
assert.equal(privCode.nominative, false);
assert.equal(privCode.gradesAttribuables, null, 'Code commun : tous les grades');
assert.deepEqual([...context.privilegesSession_(ss, { via: 'compte', membre: uuid(5) }, members).gradesAttribuables], [], 'Grade inconnu : aucun');
assert.deepEqual([...context.privilegesSession_(ss, { via: 'compte', membre: uuid(1) }, members).gradesAttribuables].slice(0, 2), ['Major', 'Capitaine']);

// ---------------------------------------------------------------- Effectifs.js, sur le texte
const source = readFileSync('src/Effectifs.js', 'utf8');
const corps = nom => {
  const debut = source.indexOf(`function ${nom}(`);
  assert.ok(debut >= 0, `${nom} présent`);
  const fin = source.indexOf('\nfunction ', debut + 1);
  return source.slice(debut, fin < 0 ? undefined : fin);
};
const avantPremiereEcriture = texte => texte.slice(0, Math.min(...['setValue(', 'ecrireLienDiscordEffectif_(', 'renommerMembrePresences_(', 'insertCheckboxes('].map(m => texte.indexOf(m)).filter(i => i >= 0)));
const modifier = avantPremiereEcriture(corps('modifierEffectifInterne_'));
for (const cle of ['renommer', 'corps', 'statut', 'specialite', 'grade']) {
  assert.ok(modifier.includes(`exigerPrivilege_(session, "${cle}")`), `modifierEffectifInterne_ vérifie « ${cle} » avant d'écrire`);
}
assert.ok(modifier.includes('exigerGradeSousLeSien_(session, currentGrade, "membre")'), 'Grade actuel du membre sous le sien');
assert.ok(modifier.includes('exigerGradeSousLeSien_(session, grade, "attribuer")'), 'Nouveau grade sous le sien');
assert.ok(/function modifierEffectifInterne_\(token, data, etat\)/.test(source), 'La mutation reçoit l’état d’avant');
const ajouter = avantPremiereEcriture(corps('ajouterEffectifInterne_'));
assert.ok(ajouter.includes('exigerPrivilege_(session, "grade")'), 'Inscrire un membre : privilège grade');
assert.ok(ajouter.includes('exigerGradeSousLeSien_(session, grade, "attribuer")'), 'Inscrire un membre : grade sous le sien');
assert.ok(/mutation\(token, data, avant\)/.test(readFileSync('src/HistoriqueEffectifs.js', 'utf8')), 'L’état d’avant est transmis par le verrou des mutations');
assert.ok(/session: privilegesSession_\(ss, auth, history\.members\)/.test(corps('getEffectifs')), 'getEffectifs renvoie les privilèges de la session');
assert.ok(/exigerPrivilege_\(gradeSession_\(ss, auth, membres\), "lien"\)/.test(readFileSync('src/Comptes.js', 'utf8')), 'Lien de connexion : privilège lien');

console.log('Privilèges par grade : seuils, grade sous le sien, interface et vérifications des mutations validés.');
