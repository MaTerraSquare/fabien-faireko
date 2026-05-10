// netlify/functions/lib/odoo-rpc.mjs
//
// Client Odoo JSON-RPC minimal.
// Endpoint Odoo : POST {ODOO_URL}/jsonrpc
// Méthode : "call" sur service "object", method "execute_kw"
//
// Auth : on s'authentifie une fois par invocation Lambda (pas de session
// persistée — Netlify functions sont stateless de toute façon).
// On utilise une CLÉ API (Settings → Users → Account Security → New API Key)
// pas le mot de passe brut. Variable env : ODOO_API_KEY.

const ODOO_URL = process.env.ODOO_URL || 'https://www.faireko.be';
const ODOO_DB = process.env.ODOO_DB || 'nbsdistribution';
const ODOO_LOGIN = process.env.ODOO_LOGIN || 'admin';
const ODOO_API_KEY = process.env.ODOO_API_KEY || process.env.ODOO_PASSWORD || '';

// Multi-company forcé sur toutes les requêtes (cf. userMemories : c4/c5 inaccessibles)
const ALLOWED_COMPANY_IDS = [1, 2, 3, 6, 7];

let cachedUid = null;
let cachedAt = 0;
const UID_TTL_MS = 5 * 60 * 1000; // 5 min

async function rpc(service, method, args) {
  const body = {
    jsonrpc: '2.0',
    method: 'call',
    params: { service, method, args },
    id: Math.floor(Math.random() * 1e9),
  };
  const r = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text();
    const e = new Error(`Odoo HTTP ${r.status}: ${text.slice(0, 200)}`);
    e.code = 'ODOO_HTTP';
    throw e;
  }
  const j = await r.json();
  if (j.error) {
    const msg = j.error.data?.message || j.error.message || 'Odoo RPC error';
    const e = new Error(msg);
    e.code = msg.toLowerCase().includes('access') ? 'ODOO_AUTH' : 'ODOO_RPC';
    e.data = j.error.data;
    throw e;
  }
  return j.result;
}

async function authenticate() {
  if (cachedUid && Date.now() - cachedAt < UID_TTL_MS) return cachedUid;
  if (!ODOO_API_KEY) {
    const e = new Error('ODOO_API_KEY (or ODOO_PASSWORD) env var is not configured');
    e.code = 'ODOO_AUTH';
    throw e;
  }
  const uid = await rpc('common', 'authenticate', [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}]);
  if (!uid) {
    const e = new Error(`Authentication failed for ${ODOO_LOGIN} on ${ODOO_DB}`);
    e.code = 'ODOO_AUTH';
    throw e;
  }
  cachedUid = uid;
  cachedAt = Date.now();
  return uid;
}

/**
 * Appel ORM Odoo générique.
 * @param {string} model        ex: 'product.template'
 * @param {string} method       ex: 'search_read'
 * @param {Array} args          arguments positionnels (domain, fields, ...)
 * @param {object} kwargs       arguments nommés (limit, offset, context, ...)
 */
export async function call(model, method, args = [], kwargs = {}) {
  const uid = await authenticate();
  const ctx = {
    lang: 'fr_BE',
    allowed_company_ids: ALLOWED_COMPANY_IDS,
    ...(kwargs.context || {}),
  };
  const finalKwargs = { ...kwargs, context: ctx };
  return rpc('object', 'execute_kw', [
    ODOO_DB,
    uid,
    ODOO_API_KEY,
    model,
    method,
    args,
    finalKwargs,
  ]);
}

/** Helpers ergonomiques */
export const orm = {
  search:       (model, domain, kwargs) => call(model, 'search', [domain], kwargs),
  search_read:  (model, domain, fields, kwargs) =>
    call(model, 'search_read', [domain], { fields, ...(kwargs || {}) }),
  search_count: (model, domain, kwargs) => call(model, 'search_count', [domain], kwargs),
  read:         (model, ids, fields, kwargs) =>
    call(model, 'read', [ids], { fields, ...(kwargs || {}) }),
  create:       (model, vals, kwargs) => call(model, 'create', [vals], kwargs),
  write:        (model, ids, vals, kwargs) => call(model, 'write', [ids, vals], kwargs),
};

export const config = {
  url: ODOO_URL,
  db: ODOO_DB,
  login: ODOO_LOGIN,
  allowedCompanyIds: ALLOWED_COMPANY_IDS,
};
