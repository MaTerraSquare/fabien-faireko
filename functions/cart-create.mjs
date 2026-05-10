// netlify/functions/cart-create.mjs
//
// Proxy minimal vers /api/ai/cart/create.
// JAMAIS appelé par le LLM. Uniquement après clic utilisateur dans le widget.
// Existe pour ne pas exposer AI_BRIDGE_TOKEN au navigateur.

const BRIDGE_BASE = process.env.URL || "https://fabien-faireko.netlify.app";
const BRIDGE_TOKEN = process.env.AI_BRIDGE_TOKEN;

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: HEADERS });
  if (!BRIDGE_TOKEN) return new Response(JSON.stringify({ error: "AI_BRIDGE_TOKEN missing" }), { status: 500, headers: HEADERS });

  let body;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: HEADERS }); }

  // Validation minimale côté proxy
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: { code: "bad_request", message: "lines required" } }), { status: 400, headers: HEADERS });
  }

  try {
    const r = await fetch(`${BRIDGE_BASE}/api/ai/cart/create`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${BRIDGE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    return new Response(text, { status: r.status, headers: HEADERS });
  } catch (err) {
    console.error("[cart-create] error:", err);
    return new Response(JSON.stringify({ ok: false, error: { code: "internal_error", message: err.message } }), { status: 500, headers: HEADERS });
  }
};

export const config = { path: "/api/v3/cart-create" };
