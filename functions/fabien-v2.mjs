const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SYSTEM = `Tu es Fabien, conseiller technique FAIRĒKO. Ancien chef de chantier.

LANGUE & TON
Français, tutoiement, ton chantier : direct, concret.

═══════════════════════════════════════════════════════════════
RÈGLE ABSOLUE — PRODUITS
═══════════════════════════════════════════════════════════════

- Nom produit → search_products obligatoire
- Donnée technique → get_product_details obligatoire
- Sinon → interdit

═══════════════════════════════════════════════════════════════
RÈGLE — DOCTRINE FAIRĒKO
═══════════════════════════════════════════════════════════════

search_doctrine interroge Knowledge Odoo.

À utiliser pour :
- humidité, pathologie
- mise en œuvre
- systèmes (ITE, ITI, chaux)
- règles techniques

═══════════════════════════════════════════════════════════════
OBLIGATION FORTE — PRIORITÉ DOCTRINE
═══════════════════════════════════════════════════════════════

Si question technique → search_doctrine obligatoire avant réponse.

═══════════════════════════════════════════════════════════════
MOTEUR DE DÉCISION — APPEL OUTILS
═══════════════════════════════════════════════════════════════

SI question technique :
→ search_doctrine → analyse → réponse

═══════════════════════════════════════════════════════════════
MODE EXPERT — RAISONNEMENT CHANTIER
═══════════════════════════════════════════════════════════════

diagnostic → doctrine → système → produits → mise en œuvre

═══════════════════════════════════════════════════════════════
MODE NIVEAU 4 — PRESCRIPTION
═══════════════════════════════════════════════════════════════

- système complet
- max 3 produits
- ordre de grandeur (jamais précis)

═══════════════════════════════════════════════════════════════
CONTRAINTE ABSOLUE — JSON
═══════════════════════════════════════════════════════════════

Tu réponds UNIQUEMENT en JSON valide.

{
  "message": "réponse chantier",
  "posture": "diagnostic|conseil|alerte|pose",
  "tu_as_pense_a": [],
  "alertes": [],
  "produits_suggeres": [],
  "questions_suivantes": [],
  "etape_projet": "diagnostic|choix_produits|pose|finition",
  "sujet_principal": "humidite|isolation|enduit|autre"
}
`;

const TOOLS = [
  {
    name: "search_products",
    description: "Recherche catalogue FAIRĒKO",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        category: { type: "string" },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "get_product_details",
    description: "Fiche technique produit",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "number" }
      },
      required: ["product_id"]
    }
  },
  {
    name: "list_categories",
    description: "Liste catégories",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "search_doctrine",
    description: "Doctrine FAIRĒKO",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number" }
      },
      required: ["query"]
    }
  }
];

// 🔥 PARSER ROBUSTE
function extractJSON(raw) {
  if (!raw) return null;

  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function callTool(toolName, input, baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/api/odoo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool: toolName, input })
    });
    const data = await res.json();
    return data.result || data;
  } catch (e) {
    return { error: e.message };
  }
}

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: HEADERS });
  }

  try {
    const body = await req.json();
    const conversation = body.messages || [];

    const host = req.headers.get("host") || "localhost";
    const proto = host.includes("localhost") ? "http" : "https";
    const baseUrl = `${proto}://${host}`;

    let iterations = 0;
    const MAX_ITERATIONS = 2;
    let data;

    while (true) {
      const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1000,
          temperature: 0.2,
          system: SYSTEM,
          messages: conversation,
          tools: TOOLS
        })
      });

      data = await apiRes.json();

      if (!data || !data.content) break;

      if (data.stop_reason !== "tool_use" || iterations >= MAX_ITERATIONS) break;

      iterations++;

      const toolCalls = data.content.filter(c => c.type === "tool_use");

      conversation.push({ role: "assistant", content: data.content });

      const results = await Promise.all(
        toolCalls.map(async (t) => ({
          type: "tool_result",
          tool_use_id: t.id,
          content: JSON.stringify(await callTool(t.name, t.input, baseUrl))
        }))
      );

      conversation.push({ role: "user", content: results });
    }

    const text = (data?.content || [])
      .filter(c => c.type === "text")
      .map(c => c.text)
      .join("\n");

    let parsed = extractJSON(text);

    if (!parsed) {
      parsed = {
        message: "Réponse non exploitable. Précise ton chantier.",
        posture: "diagnostic",
        tu_as_pense_a: [],
        alertes: [],
        produits_suggeres: [],
        questions_suivantes: [],
        etape_projet: "diagnostic",
        sujet_principal: "autre"
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...parsed,
        _meta: { tool_iterations: iterations }
      }),
      { status: 200, headers: HEADERS }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Server crash", detail: err.message }),
      { status: 500, headers: HEADERS }
    );
  }
}
