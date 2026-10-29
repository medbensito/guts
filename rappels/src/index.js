// Guts : service de rappels (Cloudflare Worker)
//
// L'app Guts envoie ici, à chaque changement, la liste de ses rappels des prochains jours.
// Chaque minute, une tâche planifiée envoie ceux de la minute écoulée par Web Push, chiffrés pour le
// téléphone (RFC 8291, aes128gcm) et signés avec la clé du service (VAPID, RFC 8292).
// Tout tient dans une seule entrée KV « etat » : { clients: { jeton: { abonnement, rappels, maj, expire? } } }.
// Il garde aussi le coffre : les sauvegardes chiffrées de l'app (voir plus bas).
// Les clés VAPID sont créées au premier appel et gardées dans KV, entrée « vapid ».

const SUJET = 'https://medbensito.github.io/guts/';   // « sub » de VAPID : où joindre l'auteur
const MAX_RAPPELS = 600;
const enc = new TextEncoder();

// ---------- Outils ----------
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64u = s => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); };
const concat = (...l) => { const r = new Uint8Array(l.reduce((a, x) => a + x.length, 0)); let o = 0; l.forEach(x => { r.set(x, o); o += x.length; }); return r; };
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });

async function lireEtat(env) { return (await env.RAPPELS.get('etat', 'json')) || { clients: {} }; }
const ecrireEtat = (env, etat) => env.RAPPELS.put('etat', JSON.stringify(etat));

// ---------- Clés VAPID ----------
async function vapid(env) {
  let v = await env.RAPPELS.get('vapid', 'json');
  if (!v) {
    const paire = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    v = { publique: b64u(await crypto.subtle.exportKey('raw', paire.publicKey)), privee: await crypto.subtle.exportKey('jwk', paire.privateKey) };
    await env.RAPPELS.put('vapid', JSON.stringify(v));
  }
  return v;
}
async function enteteVapid(v, endpoint) {
  const aud = new URL(endpoint).origin;
  const entete = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const charge = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUJET })));
  const cle = await crypto.subtle.importKey('jwk', v.privee, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cle, enc.encode(`${entete}.${charge}`));
  return `vapid t=${entete}.${charge}.${b64u(sig)}, k=${v.publique}`;
}

// ---------- Chiffrement du message (RFC 8291) ----------
async function hkdf(sel, ikm, info, octets) {
  const cle = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: sel, info }, cle, octets * 8));
}
async function chiffrer(abonnement, texte) {
  const uaPub = deB64u(abonnement.keys.p256dh);          // clé publique du téléphone (65 octets)
  const auth = deB64u(abonnement.keys.auth);             // secret d'authentification (16 octets)
  const ephemere = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', ephemere.publicKey));
  const uaCle = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaCle }, ephemere.privateKey, 256));
  const ikm = await hkdf(auth, secret, concat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const sel = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sel, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(sel, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const cleAes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cleAes, concat(enc.encode(texte), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]);              // taille d'enregistrement : 4096
  return concat(sel, rs, new Uint8Array([asPub.length]), asPub, chiffre);
}

// Envoie un message à un abonnement. Renvoie le statut HTTP du service push (201 = accepté, 404/410 = abonnement perdu).
async function envoyer(env, abonnement, message, ttl = 3600) {
  const v = await vapid(env);
  const corps = await chiffrer(abonnement, JSON.stringify(message));
  const r = await fetch(abonnement.endpoint, {
    method: 'POST',
    headers: { Authorization: await enteteVapid(v, abonnement.endpoint), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String(ttl), Urgency: 'high' },
    body: corps
  });
  return r.status;
}

// ---------- Coffre : sauvegardes chiffrées de l'app ----------
// L'app chiffre ses données elle-même (le service ne voit jamais la clé). Identifiant et jeton d'écriture sont des
// empreintes SHA-256 dérivées du code de récupération ; on ne garde que l'empreinte du jeton.
// KV : « coffre:<id> » = { hash, jours, derniere } ; « coffre:<id>:<AAAA-MM-JJ> » = la sauvegarde du jour (UTC) ; « coffres » = liste des id.
const MAX_COFFRE = 5 * 1024 * 1024;
const JOURS_GARDES = 7;
const MAX_COFFRES = 20;
async function sha256hex(t) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(t)));
  return [...h].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function coffre(req, env, id, jour) {
  const cleMeta = 'coffre:' + id;
  const meta = await env.RAPPELS.get(cleMeta, 'json');
  if (req.method === 'GET' && !jour) return meta ? json({ jours: meta.jours, derniere: meta.derniere }) : json({ erreur: 'introuvable' }, 404);
  if (req.method === 'GET' && jour) {
    if (!meta || !meta.jours.includes(jour)) return json({ erreur: 'introuvable' }, 404);
    const b = await env.RAPPELS.get(cleMeta + ':' + jour);
    return b ? new Response(b, { headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } }) : json({ erreur: 'introuvable' }, 404);
  }
  // Écrire ou effacer : il faut le jeton d'écriture
  const jeton = jetonDe(req);
  if (!/^[0-9a-f]{64}$/.test(jeton)) return json({ erreur: 'jeton manquant' }, 401);
  const h = await sha256hex(jeton);
  if (meta && meta.hash !== h) return json({ erreur: 'refusé' }, 403);
  if (req.method === 'PUT' && !jour) {
    const texte = await req.text();
    if (texte.length > MAX_COFFRE) return json({ erreur: 'trop gros' }, 413);
    let d;
    try { d = JSON.parse(texte); } catch (e) { return json({ erreur: 'illisible' }, 400); }
    if (!d || d.v !== 1 || typeof d.sel !== 'string' || typeof d.iv !== 'string' || typeof d.donnees !== 'string') return json({ erreur: 'format' }, 400);
    if (!meta) {
      const liste = (await env.RAPPELS.get('coffres', 'json')) || [];
      if (liste.length >= MAX_COFFRES) return json({ erreur: 'trop de coffres' }, 429);
      liste.push(id);
      await env.RAPPELS.put('coffres', JSON.stringify(liste));
    }
    const auj = new Date().toISOString().slice(0, 10);
    await env.RAPPELS.put(cleMeta + ':' + auj, texte);
    const jours = [auj, ...((meta && meta.jours) || []).filter(j => j !== auj)].sort().reverse();
    for (const j of jours.slice(JOURS_GARDES)) await env.RAPPELS.delete(cleMeta + ':' + j);
    const garder = jours.slice(0, JOURS_GARDES);
    await env.RAPPELS.put(cleMeta, JSON.stringify({ hash: h, jours: garder, derniere: Date.now() }));
    return json({ ok: true, jour: auj, jours: garder });
  }
  if (req.method === 'DELETE' && !jour) {
    if (meta) {
      for (const j of meta.jours) await env.RAPPELS.delete(cleMeta + ':' + j);
      await env.RAPPELS.delete(cleMeta);
      const liste = ((await env.RAPPELS.get('coffres', 'json')) || []).filter(x => x !== id);
      await env.RAPPELS.put('coffres', JSON.stringify(liste));
    }
    return json({ ok: true });
  }
  return json({ erreur: 'introuvable' }, 404);
}

// ---------- Validation ----------
function abonnementValide(a) {
  return a && typeof a.endpoint === 'string' && /^https?:\/\//.test(a.endpoint) && a.endpoint.length < 1000
    && a.keys && typeof a.keys.p256dh === 'string' && typeof a.keys.auth === 'string';
}
function rappelsValides(l) {
  if (!Array.isArray(l) || l.length > MAX_RAPPELS) return null;
  const r = [];
  for (const x of l) {
    if (!x || typeof x.at !== 'number' || !isFinite(x.at)) return null;
    r.push({ at: Math.round(x.at), titre: String(x.titre || 'Guts').slice(0, 120), corps: String(x.corps || '').slice(0, 240), tag: String(x.tag || '').slice(0, 80) });
  }
  return r;
}
const jetonDe = req => (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');

// ---------- Tâche planifiée : chaque minute ----------
// Envoie les rappels dont l'heure tombe dans la minute écoulée (]t − 60 s ; t]).
async function envoyerDus(env, t) {
  const etat = await lireEtat(env);
  let change = false;
  for (const [jeton, c] of Object.entries(etat.clients)) {
    if (c.expire) continue;
    const dus = (c.rappels || []).filter(r => r.at > t - 60000 && r.at <= t);
    for (const r of dus) {
      const statut = await envoyer(env, c.abonnement, { titre: r.titre, corps: r.corps, tag: r.tag });
      if (statut === 404 || statut === 410) { c.expire = true; change = true; break; }
    }
    // Ménage : les rappels passés depuis plus d'un jour ne servent plus
    const avant = (c.rappels || []).length;
    c.rappels = (c.rappels || []).filter(r => r.at > t - 864e5);
    if (c.rappels.length !== avant) change = true;
    if (!c.maj || c.maj < t - 60 * 864e5) { delete etat.clients[jeton]; change = true; }   // client muet depuis 60 jours
  }
  if (change) await ecrireEtat(env, etat);
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    const chemin = url.pathname.replace(/\/+$/, '') || '/';
    try {
      if (chemin === '/' && req.method === 'GET') return json({ service: 'Guts : rappels', ok: true });
      if (chemin === '/cle' && req.method === 'GET') return json({ cle: (await vapid(env)).publique });
      const mc = chemin.match(/^\/coffre\/([0-9a-f]{64})(?:\/(\d{4}-\d\d-\d\d))?$/);
      if (mc) return coffre(req, env, mc[1], mc[2]);
      if (chemin.startsWith('/coffre')) return json({ erreur: 'introuvable' }, 404);

      if (chemin === '/abonner' && req.method === 'POST') {
        const d = await req.json().catch(() => null);
        if (!d || !abonnementValide(d.abonnement)) return json({ erreur: 'abonnement invalide' }, 400);
        const etat = await lireEtat(env);
        if (Object.keys(etat.clients).length >= 20) return json({ erreur: 'trop de clients' }, 429);
        const jeton = b64u(crypto.getRandomValues(new Uint8Array(24)));
        etat.clients[jeton] = { abonnement: d.abonnement, rappels: [], maj: Date.now() };
        await ecrireEtat(env, etat);
        return json({ jeton });
      }

      // Routes réservées à un client connu
      const jeton = jetonDe(req);
      const etat = await lireEtat(env);
      const c = jeton && etat.clients[jeton];
      if (!c) return json({ erreur: 'inconnu' }, 401);

      if (chemin === '/rappels' && req.method === 'PUT') {
        const d = await req.json().catch(() => null);
        const rappels = d && rappelsValides(d.rappels);
        if (!rappels) return json({ erreur: 'rappels invalides' }, 400);
        if (d.abonnement && abonnementValide(d.abonnement)) { c.abonnement = d.abonnement; delete c.expire; }
        c.rappels = rappels;
        c.maj = Date.now();
        await ecrireEtat(env, etat);
        return json({ ok: true, n: rappels.length, expire: !!c.expire });
      }
      if (chemin === '/essai' && req.method === 'POST') {
        const statut = await envoyer(env, c.abonnement, { titre: 'Guts', corps: 'Les rappels marchent. Guts veille sur ton temps.', tag: 'essai' }, 600);
        if (statut === 404 || statut === 410) { c.expire = true; await ecrireEtat(env, etat); }
        return json({ ok: statut >= 200 && statut < 300, statut, expire: !!c.expire });
      }
      if (chemin === '/abonner' && req.method === 'DELETE') {
        delete etat.clients[jeton];
        await ecrireEtat(env, etat);
        return json({ ok: true });
      }
      return json({ erreur: 'introuvable' }, 404);
    } catch (e) {
      return json({ erreur: 'erreur interne' }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(envoyerDus(env, event.scheduledTime));
  }
};
