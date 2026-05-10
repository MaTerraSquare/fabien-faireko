// netlify/functions/ai-bridge.mjs
//
// FAIRĒKO AI Bridge — passerelle Netlify ↔ Odoo SaaS Online
// 5 endpoints :
//   POST /api/ai/products/search
//   GET  /api/ai/product/<id>
//   POST /api/ai/documents/search
//   POST /api/ai/rules/match
//   POST /api/ai/cart/create
//
// Auth : Bearer token (env AI_BRIDGE_TOKEN), comparaison timing-safe.
// Backend : JSON-RPC vers https://www.faireko.be (admin UID=7 + clé API).

import { verifyBearer } from './lib/auth.mjs';
import { searchProducts, readProduct } from './lib/product.mjs';
import { searchDocuments } from './lib/document.mjs';
import { matchRules } from './lib/rules.mjs';
import { createDraftCart } from './lib/cart.mjs';

const DEBUG = (process.env.AI_BRIDGE_DEBUG || 'false').toLowerCase() === 'true';

// ─── Helpers réponse ─────────────────────────────────────────────────
const json = (status, body) => ({
  statusCode: status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    // CORS minimal : autoriser Fabien V2 (Netlify même origine en théorie,
    // mais cross-origin si appelé depuis un autre frontend)
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  },
  body: JSON.stringify(body),
});

const ok = (data, meta) => json(200, meta ? { ok: true, data, meta } : { ok: true, data });
const err = (status, code, message, details) => {
  const body = { ok: false, error: { code, message } };
  if (details && DEBUG) body.error.details = details;
  return json(status, body);
};

// ─── Routing ─────────────────────────────────────────────────────────
export const handler = async (event) => {
  const t0 = Date.now();

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return json(204, {});
  }

  // Path : Netlify donne /.netlify/functions/ai-bridge/<reste>
  // Avec le redirect dans netlify.toml on reçoit le path après /api/ai/
  const rawPath = event.path || '';
  // Normaliser : enlever /.netlify/functions/ai-bridge ou /api/ai
  const path = rawPath
    .replace(/^\/\.netlify\/functions\/ai-bridge/, '')
    .replace(/^\/api\/ai/, '')
    .replace(/\/$/, '') || '/';

  const method = event.httpMethod;

  // ─── Auth Bearer (toutes les routes) ───────────────────────────────
  const authResult = verifyBearer(event.headers);
  if (!authResult.ok) {
    log({ path, method, status: 401, durMs: Date.now() - t0, reason: authResult.reason });
    return err(401, 'unauthorized', authResult.reason);
  }

  // ─── Parse body ────────────────────────────────────────────────────
  let payload = {};
  if (method === 'POST' && event.body) {
    try {
      payload = JSON.parse(event.body);
    } catch (e) {
      log({ path, method, status: 400, durMs: Date.now() - t0, reason: 'bad_json' });
      return err(400, 'bad_request', `Invalid JSON: ${e.message}`);
    }
  }

  // ─── Dispatch ──────────────────────────────────────────────────────
  try {
    let result;

    // GET /product/:id
    const productMatch = path.match(/^\/product\/(\d+)$/);
    if (method === 'GET' && productMatch) {
      const id = parseInt(productMatch[1], 10);
      const card = await readProduct(id);
      if (!card) {
        log({ path, method, status: 404, durMs: Date.now() - t0 });
        return err(404, 'not_found', `Product ${id} not found or not visible`);
      }
      log({ path, method, status: 200, durMs: Date.now() - t0 });
      return ok(card);
    }

    // POST endpoints
    if (method === 'POST') {
      switch (path) {
        case '/products/search': {
          const { items, total } = await searchProducts(payload);
          result = { items, total };
          log({ path, method, status: 200, durMs: Date.now() - t0, count: items.length });
          return ok(items, { total, limit: payload.limit ?? 20, offset: payload.offset ?? 0 });
        }
        case '/documents/search': {
          result = await searchDocuments(payload);
          log({ path, method, status: 200, durMs: Date.now() - t0 });
          return ok(result);
        }
        case '/rules/match': {
          result = await matchRules(payload);
          log({ path, method, status: 200, durMs: Date.now() - t0, count: result.count });
          return ok(result);
        }
        case '/cart/create': {
          result = await createDraftCart(payload);
          log({ path, method, status: 200, durMs: Date.now() - t0, orderId: result.sale_order_id });
          return ok(result);
        }
        default:
          break;
      }
    }

    log({ path, method, status: 404, durMs: Date.now() - t0, reason: 'route_not_found' });
    return err(404, 'not_found', `No route for ${method} ${path}`);

  } catch (e) {
    console.error('[ai-bridge] handler error:', e);
    log({ path, method, status: 500, durMs: Date.now() - t0, reason: e.message });
    if (e.code === 'BAD_REQUEST') return err(400, 'bad_request', e.message);
    if (e.code === 'NOT_FOUND') return err(404, 'not_found', e.message);
    if (e.code === 'ODOO_AUTH') return err(502, 'upstream_auth_error', 'Odoo authentication failed', e.message);
    return err(500, 'internal_error', 'Internal server error', e.message);
  }
};

// ─── Log structuré (stdout = visible dans Netlify Functions logs) ───
function log(obj) {
  console.log(JSON.stringify({ svc: 'ai-bridge', ts: new Date().toISOString(), ...obj }));
}
