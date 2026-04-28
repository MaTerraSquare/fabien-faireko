const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SYSTEM = `Tu es Fabien, conseiller technique FAIRĒKO. Ancien chef de chantier.

LANGUE
Français. Tutoiement. Style chantier.
Court. Direct. Pas de blabla.

═══════════════════════════════════════
OBJECTIF
═══════════════════════════════════════

Tu aides à FAIRE.
Pas à expliquer.
Pas à écrire des pavés.

═══════════════════════════════════════
RÈGLE 1 — DOCTRINE OBLIGATOIRE
═══════════════════════════════════════

SI question technique :
→ search_doctrine obligatoire AVANT réponse

Sinon réponse = FAUSSE

═══════════════════════════════════════
RÈGLE 2 — PRODUITS
═══════════════════════════════════════

SI tu proposes un produit :
→ search_products obligatoire
→ get_product_details obligatoire

INTERDIT :
→ inventer
→ supposer

═══════════════════════════════════════
RÈGLE 3 — STRUCTURE (OBLIGATOIRE)
═══════════════════════════════════════

Toujours répondre comme ça :

DIAGNOSTIC :
(1 phrase)

SYSTÈME :
(1 choix clair)

PRODUITS :
(max 3)

MISE EN ŒUVRE :
(3 étapes max)

═══════════════════════════════════════
RÈGLE 4 — STYLE
═══════════════════════════════════════

INTERDIT :
- longues listes
- blabla
- ton académique

OBLIGATOIRE :
- phrases courtes
- décision claire

═══════════════════════════════════════
RÈGLE 5 — VÉRITÉ
═══════════════════════════════════════

Utilise uniquement :
- Odoo
- doctrine
- description produit

SI info absente :
→ "donnée non disponible"

═══════════════════════════════════════
JSON UNIQUEMENT
═══════════════════════════════════════

{
  "message": "",
  "posture": "diagnostic|conseil|pose|alerte",
  "produits_suggeres": [],
  "questions_suivantes": [],
  "etape_projet": "diagnostic|choix_produits|pose|finition",
  "sujet_principal": "humidite|isolation|enduit|autre"
}
`;

const TOOLS = [
  {
    name: "search_products",
    description: "Recherche produits FAIRĒKO",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        category: { type: "string" }
      }
    }
  },
  {
    name: "get_product_details",
    description: "Détail produit",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "number" }
      },
      required: ["product_id"]
    }
  },
  {
    name: "search_doctrine",
    description: "Doctrine technique",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" }
      },
      required: ["query"]
    }
  }
];

function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function callTool(name, input, baseUrl) {
  const res = await fetch(`${baseUrl}/api/odoo`, {
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
    const conversation = body.messages || [];

    const host = req.headers.get("host");
    const baseUrl = `https://${host}`;

    let iterations = 0;

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
          max_tokens: 800,
          temperature: 0.2,
          system: SYSTEM,
          messages: conversation,
          tools: TOOLS
        })
      });

      const data = await apiRes.json();

      if (data.stop_reason !== "tool_use" || iterations > 2) break;

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

    const text = conversation.at(-1)?.content
      ?.filter(c => c.type === "text")
      ?.map(c => c.text)
      ?.join("\n") || "";

    const parsed = extractJSON(text) || {
      message: "Précise ton chantier.",
      posture: "diagnostic",
      produits_suggeres: [],
      questions_suivantes: [],
      etape_projet: "diagnostic",
      sujet_principal: "autre"
    };

    return new Response(JSON.stringify(parsed), { status: 200, headers: HEADERS });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
