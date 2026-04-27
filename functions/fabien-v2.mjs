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

Si la question concerne :
- humidité / condensation / fissure
- "pourquoi" / "bonne pratique"
- pose / couches / système

→ TU DOIS appeler search_doctrine AVANT de répondre.

INTERDIT :
- répondre sans tool
- inventer une règle
- dire "je sais" sans vérifier

PRIORITÉ :
Doctrine > raisonnement

SI résultat trouvé :
→ tu t’appuies dessus

SI aucun résultat :
→ tu peux répondre seul

═══════════════════════════════════════════════════════════════
LEXIQUE
═══════════════════════════════════════════════════════════════

CHANVRE → PI-HEMP, CaNaDry  
CHAUX → COMCAL, NHL  
BOIS → PAVATEX  
HUMIDITÉ → HUMICAL  

═══════════════════════════════════════════════════════════════
FORMAT JSON STRICT
═══════════════════════════════════════════════════════════════

{
  "message": "réponse chantier",
  "posture": "diagnostic|conseil|alerte|pose",
  "tu_as_pense_a": [],
  "alertes": [],
  "produits_suggeres": [],
  "questions_suivantes": [],
  "etape_projet": "diagnostic|choix_produits|pose|finition",
  "sujet_principal": "humidite|isolation|enduit|autre"
}`;

const TOOLS = [
  {
    name: "search_products",
    description: "Recherche catalogue FAIRĒKO. À utiliser dès qu’un produit ou matériau est évoqué.",
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
    description: "Fiche technique complète. Obligatoire avant toute donnée technique.",
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
    description: "Liste catégories techniques.",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "search_doctrine",
    description: "Recherche doctrine FAIRĒKO (Knowledge Odoo). Contient règles, pathologies, systèmes, mise en œuvre. À utiliser OBLIGATOIREMENT pour toute question technique avant de répondre.",
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

async function callTool(toolName, input, baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/api/odoo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool: toolName, input: input || {} })
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

    const MAX_ITERATIONS = 3;
    let iterations = 0;
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
          model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
          max_tokens: 1200,
          temperature: 0.2,
          system: SYSTEM,
          messages: conversation,
          tools: TOOLS
        })
      });

      data = await apiRes.json();

      if (!apiRes.ok) {
        return new Response(
          JSON.stringify({ error: "Anthropic error", detail: data }),
          { status: 500, headers: HEADERS }
        );
      }

      if (data.stop_reason !== "tool_use" || iterations >= MAX_ITERATIONS) {
        break;
      }

      iterations++;

      const toolCalls = (data.content || []).filter(b => b.type === "tool_use");

      console.log(`[fabien-v2] tools=${toolCalls.map(t => t.name).join(", ")}`);

      conversation.push({ role: "assistant", content: data.content });

      const results = await Promise.all(
        toolCalls.map(async (tb) => ({
          type: "tool_result",
          tool_use_id: tb.id,
          content: JSON.stringify(await callTool(tb.name, tb.input, baseUrl))
        }))
      );

      conversation.push({ role: "user", content: results });
    }

    const text = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n");

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {
        message: "Réponse non formatée, reformule ta question.",
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
