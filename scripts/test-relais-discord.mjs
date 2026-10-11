/*
  Relais Discord (`relais-discord/worker.js`, Cloudflare Workers).

  - Secret exigé avant toute autre réponse, comparé en temps constant ;
    configuration détaillée seulement à un appelant authentifié.
  - Liste fermée de routes, limitées au serveur de la Garde ; paramètres
    d'adresse contrôlés ; PATCH d'un membre réduit au pseudo.
  - Jeton du bot et en-tête de bot ajoutés par le relais, jamais renvoyés ;
    réponse de Discord rendue avec ses en-têtes de limitation de débit.

    node scripts/test-relais-discord.mjs
*/
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('relais-discord/worker.js', 'utf8');
const relais = (await import('data:text/javascript,' + encodeURIComponent(source))).default;

const SECRET = 's'.repeat(40);
const GUILD = '900000000000000001';
const AUTRE = '900000000000000002';
const MEMBRE = '100000000000000123';
const ROLE = '100000000000000456';
const env = { DISCORD_BOT_TOKEN: 'jeton-bot-secret', DISCORD_GUILD_ID: GUILD, RELAIS_SECRET: SECRET };

let appels = [], reponseDiscord;
globalThis.fetch = async (url, init) => {
  appels.push({ url, init });
  if (reponseDiscord instanceof Error) throw reponseDiscord;
  return reponseDiscord;
};
const repondre = (statut = 200, corps = { ok: true }, entetes = {}) => {
  reponseDiscord = statut === 204
    ? new Response(null, { status: 204, headers: entetes })
    : new Response(JSON.stringify(corps), { status: statut, headers: { 'content-type': 'application/json', ...entetes } });
};

async function appeler(chemin, { methode = 'GET', secret = SECRET, corps, entetes = {}, configuration = env } = {}) {
  appels = [];
  const headers = { ...entetes };
  if (secret !== null) headers['X-Relais-Secret'] = secret;
  const requete = new Request('https://relais.example.workers.dev' + chemin, {
    method: methode, headers, body: corps === undefined ? undefined : (typeof corps === 'string' ? corps : JSON.stringify(corps))
  });
  const reponse = await relais.fetch(requete, configuration);
  const texte = await reponse.text();
  let json = null;
  try { json = JSON.parse(texte); } catch { /* corps brut */ }
  return { statut: reponse.status, json, texte, entetes: reponse.headers };
}
const refuse = async (chemin, options, attendu = 'refus') => {
  const r = await appeler(chemin, options);
  assert.equal(r.json?.relais, attendu, `${options?.methode || 'GET'} ${chemin} doit être refusé (${attendu})`);
  assert.equal(appels.length, 0, `${chemin} : aucun appel à Discord`);
  return r;
};

// ---------------------------------------------------------------- secret
repondre();
let r = await refuse('/users/@me', { secret: null }, 'secret');
assert.equal(r.statut, 401);
await refuse('/users/@me', { secret: 'faux' }, 'secret');
await refuse('/users/@me', { secret: SECRET.slice(0, -1) }, 'secret');
await refuse('/users/@me', { secret: SECRET + 's' }, 'secret');

// Configuration : sans secret valide, rien d'autre n'est révélé.
r = await refuse('/users/@me', { configuration: { ...env, RELAIS_SECRET: 'court' } }, 'config');
assert.equal(r.statut, 500);
assert.match(r.json.message, /RELAIS_SECRET/);
r = await refuse('/users/@me', { secret: 'faux', configuration: { ...env, DISCORD_BOT_TOKEN: '' } }, 'secret');
assert.doesNotMatch(r.json.message, /DISCORD_BOT_TOKEN/, 'Un inconnu n’apprend pas ce qui manque');
r = await refuse('/users/@me', { configuration: { ...env, DISCORD_BOT_TOKEN: '' } }, 'config');
assert.match(r.json.message, /DISCORD_BOT_TOKEN/);
await refuse('/users/@me', { configuration: { ...env, DISCORD_GUILD_ID: 'garde' } }, 'config');

// ---------------------------------------------------------------- routes ouvertes
const ouvertes = [
  ['GET', '/users/@me'],
  ['GET', '/users/@me/guilds'],
  ['GET', `/guilds/${GUILD}`],
  ['GET', `/guilds/${GUILD}/roles`],
  ['GET', `/guilds/${GUILD}/members?limit=1000&after=0`],
  ['GET', `/guilds/${GUILD}/members?limit=1&after=${MEMBRE}`],
  ['GET', `/guilds/${GUILD}/members`],
  ['GET', `/guilds/${GUILD}/members/${MEMBRE}`],
  ['PUT', `/guilds/${GUILD}/members/${MEMBRE}/roles/${ROLE}`],
  ['DELETE', `/guilds/${GUILD}/members/${MEMBRE}/roles/${ROLE}`]
];
for (const [methode, chemin] of ouvertes) {
  repondre(200, [{ id: 1 }], { 'x-ratelimit-remaining': '4', 'set-cookie': 'cf=1' });
  r = await appeler(chemin, { methode });
  assert.equal(r.statut, 200, `${methode} ${chemin}`);
  assert.equal(appels.length, 1);
  assert.equal(appels[0].url, 'https://discord.com/api/v10' + chemin);
  assert.equal(appels[0].init.method, methode);
  assert.equal(appels[0].init.headers.Authorization, 'Bot jeton-bot-secret');
  assert.match(appels[0].init.headers['User-Agent'], /^DiscordBot \(/);
  assert.equal(r.entetes.get('x-ratelimit-remaining'), '4');
  assert.equal(r.entetes.get('set-cookie'), null, 'Seuls les en-têtes utiles sont rendus');
  assert.ok(!r.texte.includes('jeton-bot-secret'));
}

// Le secret du registre n'est jamais transmis à Discord.
repondre();
await appeler('/users/@me');
assert.ok(!JSON.stringify(appels[0].init).includes(SECRET));

// Rôle ajouté : 204 sans corps, rendu tel quel. Raison d'audit transmise, tronquée.
repondre(204);
r = await appeler(`/guilds/${GUILD}/members/${MEMBRE}/roles/${ROLE}`, { methode: 'PUT', entetes: { 'X-Audit-Log-Reason': 'Registre%20%3A%20grade%20Sergent' + 'x'.repeat(600) } });
assert.equal(r.statut, 204);
assert.equal(r.texte, '');
assert.equal(appels[0].init.headers['X-Audit-Log-Reason'].length, 512);
assert.match(appels[0].init.headers['X-Audit-Log-Reason'], /^Registre%20%3A%20grade%20Sergent/);

// ---------------------------------------------------------------- routes fermées
const fermees = [
  ['GET', `/guilds/${AUTRE}`],
  ['GET', `/guilds/${AUTRE}/members`],
  ['PUT', `/guilds/${AUTRE}/members/${MEMBRE}/roles/${ROLE}`],
  ['PUT', `/guilds/${GUILD}/bans/${MEMBRE}`],
  ['DELETE', `/guilds/${GUILD}/members/${MEMBRE}`],
  ['POST', `/channels/${ROLE}/messages`],
  ['GET', `/channels/${ROLE}/messages`],
  ['DELETE', `/guilds/${GUILD}`],
  ['PATCH', `/guilds/${GUILD}`],
  ['POST', `/guilds/${GUILD}/roles`],
  ['PATCH', `/guilds/${GUILD}/roles/${ROLE}`],
  ['GET', '/applications/@me'],
  ['GET', '/gateway/bot'],
  ['GET', `/guilds/${GUILD}/members/`],
  ['GET', `/guilds/${GUILD}/members/${MEMBRE}/../../../channels/${ROLE}`],
  ['GET', `/guilds/${GUILD}%2Fmembers`],
  ['GET', `/guilds/${GUILD}/members?limit=1001`],
  ['GET', `/guilds/${GUILD}/members?limit=0`],
  ['GET', `/guilds/${GUILD}/members?after=abc`],
  ['GET', `/guilds/${GUILD}/members?query=a`],
  ['GET', `/guilds/${GUILD}/members?limit=10&limit=10000`],
  ['GET', `/guilds/${GUILD}/roles?with_counts=true`],
  ['GET', '/users/@me?x=1'],
  ['HEAD', '/users/@me'],
  ['OPTIONS', '/users/@me']
];
for (const [methode, chemin] of fermees) {
  r = await refuse(chemin, { methode });
  if (r.statut !== 403) assert.fail(`${methode} ${chemin} : statut ${r.statut}`);
}

// ---------------------------------------------------------------- pseudo seul
const pseudo = `/guilds/${GUILD}/members/${MEMBRE}`;
repondre(200, { nick: 'Sgt-Chef Eydis' });
r = await appeler(pseudo, { methode: 'PATCH', corps: { nick: 'Sgt-Chef Eydis' } });
assert.equal(r.statut, 200);
assert.equal(appels[0].init.body, JSON.stringify({ nick: 'Sgt-Chef Eydis' }));
assert.equal(appels[0].init.headers['Content-Type'], 'application/json');
repondre(200, { nick: null });
await appeler(pseudo, { methode: 'PATCH', corps: { nick: null } });
assert.equal(appels[0].init.body, '{"nick":null}', 'Pseudo effacé');
repondre();
await appeler(pseudo, { methode: 'PATCH', corps: { nick: 'Œ'.repeat(32) } });
assert.equal(appels.length, 1, 'Trente-deux caractères, accents compris');
for (const corps of [
  { roles: [ROLE] }, { nick: 'A', roles: [] }, { nick: 'A', mute: true },
  { communication_disabled_until: '2030-01-01' }, { nick: 'x'.repeat(33) }, { nick: '   ' },
  { nick: 12 }, [], 'pas du json', {}
]) {
  await refuse(pseudo, { methode: 'PATCH', corps });
}
await refuse(`/guilds/${AUTRE}/members/${MEMBRE}`, { methode: 'PATCH', corps: { nick: 'A' } });

// ---------------------------------------------------------------- réponses de Discord
repondre(429, { message: 'You are being rate limited.', retry_after: 1.5 }, { 'retry-after': '2' });
r = await appeler(`/guilds/${GUILD}/members?limit=1000&after=0`);
assert.equal(r.statut, 429, 'Statut de Discord rendu tel quel');
assert.equal(r.json.retry_after, 1.5);
assert.equal(r.entetes.get('retry-after'), '2');
repondre(403, { message: 'Missing Permissions', code: 50013 });
r = await appeler(`/guilds/${GUILD}/members/${MEMBRE}/roles/${ROLE}`, { methode: 'PUT' });
assert.deepEqual(r.json, { message: 'Missing Permissions', code: 50013 });
reponseDiscord = new Error('réseau');
r = await appeler('/users/@me');
assert.equal(r.statut, 502);
assert.equal(r.json.relais, 'reseau');

console.log('Relais Discord : secret, configuration, routes fermées, pseudo seul et réponses de Discord validés.');
