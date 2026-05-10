// netlify/functions/fabien-v3.mjs
//
// Fabien V3 — MVP frontend assistant pour FAIRĒKO.
//
// Ne touche JAMAIS Odoo directement. Consomme uniquement /api/ai/* (le bridge).
// Endpoints utilisés :
//   - POST /api/ai/products/search
//   - GET  /api/ai/product/:id
//   - POST /api/ai/documents/search
//   - POST /api/ai/rules/match
// (cart/create est appelé depuis le frontend uniquement après clic utilisateur,
//  jamais automatiquement par le LLM.)
//
// Flow :
//   1. Frontend POST /api/v3/chat avec { messages: [...] }
//   2. On appelle Claude (claude-sonnet-4-20250514) avec un prompt système strict
//   3. Claude peut appeler des "tools" qui sont en fait des proxies vers le bridge
//   4. Quand Claude a fini, il renvoie une "card" structurée (JSON parsable)
//   5. Le frontend rend la card.

import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, TOOLS } from "./_fabien_v3_prompt.mjs";

// ─── Config ──────────────────────────────────────────────────────────
const BRIDGE_BASE = process.env.URL || "https://fabien-faireko.netlify.app";
const BRIDGE_TOKEN = process.env.AI_BRIDGE_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MAX_TOOL_ITERATIONS = 5; // budget strict, cf. v2

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Bridge proxy (read-only, jamais cart/create ici) ────────────────
async function callBridge(path, payload, method = "POST") {
  const url = `${BRIDGE_BASE}/api/ai${path}`;
  const opts = {
    method,
    headers: {
      "Authorization": `Bearer ${BRIDGE_TOKEN}`,
      "Content-Type": "application/json",
    },
  };
  if (method === "POST") opts.body = JSON.stringify(payload || {});
  const r = await fetch(url, opts);
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { ok: false, error: { code: "bad_json", message: text.slice(0, 200) } }; }
  return { status: r.status, json };
}

// ─── Tool executor : map nom de tool → appel bridge ──────────────────
async function runTool(name, input) {
  switch (name) {
    case "search_products": {
      const { json } = await callBridge("/products/search", {
        query: input.query,
        category_ids: input.category_ids,
        limit: Math.min(input.limit || 5, 10),
      });
      return json;
    }
    case "get_product": {
      const { json } = await callBridge(`/product/${parseInt(input.id, 10)}`, null, "GET");
      return json;
    }
    case "search_documents": {
      const { json } = await callBridge("/documents/search", {
        query: input.query,
        scope: input.scope || ["knowledge", "attachments"],
        product_id: input.product_id,
        limit: Math.min(input.limit || 5, 10),
      });
      return json;
    }
    case "match_rules": {
      const { json } = await callBridge("/rules/match", {
        context: input.context || {},
        rule_set: input.rule_set,
      });
      return json;
    }
    default:
      return { ok: false, error: { code: "unknown_tool", message: `Tool ${name} not available` } };
  }
}

// ─── Handler ─────────────────────────────────────────────────────────
export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: HEADERS });

  if (!BRIDGE_TOKEN) return new Response(JSON.stringify({ error: "AI_BRIDGE_TOKEN missing" }), { status: 500, headers: HEADERS });
  if (!ANTHROPIC_KEY) return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY missing" }), { status: 500, headers: HEADERS });

  let body;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: HEADERS }); }

  const messages = Array.isArray(body.messages) ? body.messages : null;
  if (!messages || messages.length === 0) return new Response(JSON.stringify({ error: "messages array required" }), { status: 400, headers: HEADERS });

  const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
  const trace = [];
  let iterations = 0;
  let convo = [...messages];

  try {
    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;
      const resp = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: convo,
      });

      const toolUses = resp.content.filter((b) => b.type === "tool_use");
      const textBlocks = resp.content.filter((b) => b.type === "text");

      // Si pas de tool_use → on a la réponse finale
      if (toolUses.length === 0) {
        const finalText = textBlocks.map((b) => b.text).join("\n").trim();
        // Tenter de parser une card JSON dans la réponse
        const card = extractCard(finalText);
        return new Response(JSON.stringify({
          ok: true,
          card: card,
          raw: finalText,
          _meta: { iterations, trace, model: "claude-sonnet-4-20250514" },
        }), { status: 200, headers: HEADERS });
      }

      // Sinon : exécuter les tools demandés et boucler
      convo.push({ role: "assistant", content: resp.content });
      const toolResults = [];
      for (const tu of toolUses) {
        const result = await runTool(tu.name, tu.input);
        trace.push({ tool: tu.name, input: tu.input, ok: result?.ok, count: result?.data?.length || result?.data?.count || null });
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(result),
        });
      }
      convo.push({ role: "user", content: toolResults });
    }

    return new Response(JSON.stringify({
      ok: false,
      error: { code: "iteration_budget_exhausted", message: `Reached ${MAX_TOOL_ITERATIONS} iterations` },
      _meta: { iterations, trace },
    }), { status: 200, headers: HEADERS });

  } catch (err) {
    console.error("[fabien-v3] error:", err);
    return new Response(JSON.stringify({
      ok: false,
      error: { code: "internal_error", message: err.message },
      _meta: { iterations, trace },
    }), { status: 500, headers: HEADERS });
  }
};

// ─── Card extractor ──────────────────────────────────────────────────
// Fabien doit terminer sa réponse par un bloc ```json {...} ```
// Si présent → on l'extrait pour le frontend. Sinon on renvoie raw seulement.
function extractCard(text) {
  if (!text) return null;
  const m = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

export const config = { path: "/api/v3/chat" };
