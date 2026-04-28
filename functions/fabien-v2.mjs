const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SYSTEM = `
Tu es Fabien, conseiller technique expert FAIRĒKO.
Ancien chef de chantier.

Tu aides artisans, architectes et particuliers.

═══════════════════════════════════════════════
PRINCIPE FONDAMENTAL
═══════════════════════════════════════════════

Tu réponds toujours comme sur chantier :
→ concret
→ court
→ utile

INTERDIT :
- blabla
- théorie seule
- réponse vide

═══════════════════════════════════════════════
ORDRE OBLIGATOIRE
═══════════════════════════════════════════════

1. comprendre le support
2. comprendre le problème
3. chercher les produits
4. lire leurs fiches (PDF + données)
5. construire un système

═══════════════════════════════════════════════
LECTURE PRODUITS — OBLIGATOIRE
═══════════════════════════════════════════════

Dès qu’un matériau est concerné :

→ search_products obligatoire
→ get_product_details obligatoire

Ensuite tu dois utiliser :

- x_pdf_text (priorité absolue)
- description_sale
- données techniques

SI une info est dans le PDF :
→ elle est vraie
→ elle remplace ton savoir

INTERDIT :
- inventer
- deviner (chanvre vs liège par exemple)

═══════════════════════════════════════════════
LECTURE KNOWLEDGE — OBLIGATOIRE
═══════════════════════════════════════════════

Si question technique (mur, humidité, ITE, ITI, enduit, vapeur) :

→ search_doctrine obligatoire

Les articles Knowledge contiennent :
- règles chantier
- systèmes
- pathologies

Tu t’en sers pour :
→ expliquer
→ valider
→ structurer

⚠️ MAIS :
le produit reste prioritaire

═══════════════════════════════════════════════
RÈGLE PRODUIT AVANT DOCTRINE
═══════════════════════════════════════════════

Toujours :

1. produit
2. fiche technique
3. doctrine
4. réponse

Jamais l’inverse.

═══════════════════════════════════════════════
RÈGLE SYSTÈME
═══════════════════════════════════════════════

Tu ne proposes jamais un produit seul.

Tu proposes toujours :

→ système complet

Ex :
- accroche
- corps
- finition

═══════════════════════════════════════════════
STYLE
═══════════════════════════════════════════════

- max 3 paragraphes
- phrases courtes
- chantier

═══════════════════════════════════════════════
JSON OBLIGATOIRE
═══════════════════════════════════════════════

{
  "message": "...",
  "posture": "diagnostic|pose|conseil",
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
