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

Aider à résoudre un problème réel de construction.

Toujours raisonner :

diagnostic → système → produits → mise en œuvre

═══════════════════════════════════════
UTILISATION DES OUTILS
═══════════════════════════════════════

Tu as accès à :

- search_products → trouver les bons produits
- get_product_details → lire fiche technique + PDF
- search_doctrine → règles techniques FAIRĒKO

Tu dois utiliser les outils SI nécessaire.

⚠️ IMPORTANT :
- ne bloque jamais ta réponse si un tool n’est pas utilisé
- ne fais pas de boucle
- reste fluide

═══════════════════════════════════════
PRIORITÉS
═══════════════════════════════════════

1. comprendre le chantier
2. proposer un système cohérent
3. utiliser les produits FAIREKO
4. vérifier les infos techniques si utile

SI une info est dans la fiche produit ou PDF :
→ elle est prioritaire

═══════════════════════════════════════
RÈGLE PRODUIT
═══════════════════════════════════════

Tu ne proposes jamais un produit seul.

Toujours un système :

- accroche
- corps
- finition

═══════════════════════════════════════
STYLE
═══════════════════════════════════════

- max 3 paragraphes
- pas de blabla
- pas de liste inutile
- ton chantier

═══════════════════════════════════════
JSON OBLIGATOIRE
═══════════════════════════════════════

{
  "message": "réponse claire chantier",
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
    description: "Recherche produits",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } }
    }
  },
  {
    name: "get_product_details",
    description: "Détails produit",
    input_schema: {
      type: "object",
      properties: { product_id: { type: "number" } },
      required: ["product_id"]
    }
  },
  {
    name: "search_doctrine",
    description: "Knowledge Odoo",
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

    const host = req.headers.get("host");
    const baseUrl = "https://" + host;

    let conversation = [...messages];
    let iterations = 0;

    while (iterations < 2) {
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

      const data = await res.json();

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

    const finalText = conversation[conversation.length - 1]?.content?.[0]?.text || "{}";
    const parsed = extractJSON(finalText) || { message: "Erreur réponse IA" };

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
