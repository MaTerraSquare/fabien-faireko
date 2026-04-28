const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SYSTEM = `
Tu es Fabien, conseiller technique FAIRĒKO.
Ancien chef de chantier.

Tu réponds comme sur chantier :
→ direct
→ clair
→ utile

═══════════════════════════════════════
OBJECTIF
═══════════════════════════════════════

Résoudre un problème réel.

Toujours :
diagnostic → système → produits → mise en œuvre

═══════════════════════════════════════
UTILISATION DES OUTILS
═══════════════════════════════════════

Tu peux utiliser :

- search_products → trouver produits
- get_product_details → lire fiche + PDF
- search_doctrine → règles chantier

IMPORTANT :
- utilise les outils si un matériau est concerné
- ne bloque jamais si un tool échoue
- pas de boucle infinie

═══════════════════════════════════════
RÈGLE PRODUIT
═══════════════════════════════════════

Toujours proposer un système.

Jamais un produit seul.

Toujours :
- accroche
- corps
- finition

═══════════════════════════════════════
RÈGLE PDF
═══════════════════════════════════════

Si une info est dans le PDF :
→ elle est prioritaire

═══════════════════════════════════════
ALTERNATIVE
═══════════════════════════════════════

Toujours proposer au moins UNE alternative si possible.

═══════════════════════════════════════
STYLE
═══════════════════════════════════════

- court
- terrain
- max 3 paragraphes

═══════════════════════════════════════
JSON
═══════════════════════════════════════

{
  "message": "réponse chantier",
  "posture": "diagnostic|conseil|pose",
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
    description: "Trouver produits FAIREKO dans catalogue",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } }
    }
  },
  {
    name: "get_product_details",
    description: "Lire fiche technique + PDF produit",
    input_schema: {
      type: "object",
      properties: { product_id: { type: "number" } },
      required: ["product_id"]
    }
  },
  {
    name: "search_doctrine",
    description: "Lire règles techniques FAIRĒKO",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"]
    }
  }
];

function extractJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

async function callTool(name, input, baseUrl) {
  const res = await fetch(baseUrl + "/api/odoo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tool: name, input })
  });

  const data = await res.json();
  return data.result || data;
}

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: HEADERS });
  }

  try {
    const body = await req.json();
    const messages = body.messages || [];

    const userMessage = messages[messages.length - 1]?.content || "";

    const host = req.headers.get("host");
    const baseUrl = "https://" + host;

    let conversation = [
      {
        role: "user",
        content: `
Analyse ce chantier.

IMPORTANT :
- si matériaux → utilise search_products
- ensuite utilise get_product_details
- utilise search_doctrine si besoin
- propose toujours un système complet
- propose une alternative si possible

Question :
${userMessage}
`
      }
    ];

    let iterations = 0;
    let data;

    while (iterations < 3) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1200,
          temperature: 0.2,
          system: SYSTEM,
          messages: conversation,
          tools: TOOLS
        })
      });

      data = await res.json();

      if (data.stop_reason !== "tool_use") break;

      const toolCalls = data.content.filter(c => c.type === "tool_use");

      conversation.push({ role: "assistant", content: data.content });

      const results = await Promise.all(
        toolCalls.map(async t => ({
          type: "tool_result",
          tool_use_id: t.id,
          content: JSON.stringify(await callTool(t.name, t.input, baseUrl))
        }))
      );

      conversation.push({ role: "user", content: results });

      iterations++;
    }

    const text = (data.content || [])
      .filter(c => c.type === "text")
      .map(c => c.text)
      .join("\n");

    let parsed = extractJSON(text);

    if (!parsed) {
      parsed = {
        message: text || "Réponse non exploitable",
        posture: "diagnostic",
        tu_as_pense_a: [],
        alertes: [],
        produits_suggeres: [],
        questions_suivantes: [],
        etape_projet: "diagnostic",
        sujet_principal: "autre"
      };
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: HEADERS
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: HEADERS
    });
  }
}
