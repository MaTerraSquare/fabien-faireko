const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SYSTEM = `Tu es Fabien, conseiller technique FAIRĒKO spécialisé en matériaux biosourcés, minéraux et bas carbone.

MISSION
Tu aides artisans, architectes et particuliers à faire les bons choix techniques.
Tu raisonnes toujours en système : support + isolant + gestion vapeur + finition.

STYLE
Réponse claire, courte, chantier.
En français : tu tutoies.

DIAGNOSTIC
Avant de proposer :
- identifier support
- intérieur ou extérieur
- problème principal

Si info manquante → poser 1 à 2 questions.

PRODUITS
Tu privilégies les solutions FAIRĒKO.
Si produit externe → réponse neutre + alternative FAIRĒKO si possible.

OUTILS
Tu utilises les outils seulement si nécessaire.
MAXIMUM 2 appels outils.

RÈGLES CRITIQUES

COM-CAL :
- prêt à l’emploi
- jamais ajouter sable
- jamais ratio

LIANTS VRAC :
- ratios autorisés
- plus dur → plus souple

PI-HEMP :
- Wall = extérieur collé + chevillé
- Flex = cavité ossature, pose sèche

SORIWA :
- profil structurel
- jamais isolant

CaNaDry :
- versé manuel
- jamais soufflé

BÂTI ANCIEN :
- toujours respirant
- jamais ciment
- jamais peinture fermée

FORMAT DE SORTIE (OBLIGATOIRE)

Tu réponds UNIQUEMENT en JSON valide.

INTERDIT :
- texte avant ou après
- markdown
- backticks

OBLIGATOIRE :
- commencer par {
- finir par }

STRUCTURE :
{
  "message": "réponse courte",
  "posture": "diagnostic|pose|anti_oubli|panier|cta",
  "tu_as_pense_a": [],
  "alertes": [],
  "produits_suggeres": [],
  "questions_suivantes": [],
  "etape_projet": "diagnostic|choix_produits|pose|finition",
  "sujet_principal": "humidite|isolation|enduit|sol|chauffage|bati-ancien|autre"
}`;

const TOOLS = [
  {
    name: "search_products",
    description: "Recherche catalogue FAIREKO",
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
    description: "Fiche produit",
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

    const MAX_ITERATIONS = 2;
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

    // 🔥 Parsing robuste
    const text = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("\n");

    /**
     * Extrait un objet JSON depuis une réponse LLM, même si elle est
     * enveloppée dans des code-fences markdown ou contient du texte parasite.
     * Stratégie :
     *   1. Strip les code-fences ```json ... ``` ou ``` ... ```
     *   2. Trim
     *   3. Si commence par { et finit par } → tente parse direct
     *   4. Sinon trouve le 1er { et le } qui le ferme (équilibrage d'accolades)
     */
    function extractJSON(raw) {
      if (!raw || typeof raw !== "string") return null;

      // 1. Strip code-fences markdown (```json...``` ou ```...```)
      let cleaned = raw
        .replace(/^\s*```(?:json)?\s*\n?/i, "")  // début
        .replace(/\n?\s*```\s*$/i, "")            // fin
        .trim();

      // 2. Tentative parse direct
      if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
        try { return JSON.parse(cleaned); } catch (_) { /* fallthrough */ }
      }

      // 3. Recherche par équilibrage d'accolades (gère JSON imbriqué)
      const start = cleaned.indexOf("{");
      if (start === -1) return null;

      let depth = 0;
      let inString = false;
      let escape = false;
      for (let i = start; i < cleaned.length; i++) {
        const c = cleaned[i];
        if (escape) { escape = false; continue; }
        if (c === "\\") { escape = true; continue; }
        if (c === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (c === "{") depth++;
        else if (c === "}") {
          depth--;
          if (depth === 0) {
            const candidate = cleaned.slice(start, i + 1);
            try { return JSON.parse(candidate); } catch (_) { return null; }
          }
        }
      }
      return null;
    }

    let parsed = extractJSON(text);

    if (!parsed || typeof parsed !== "object") {
      // Fallback : garde un message lisible (pas le JSON brut)
      const cleanedFallback = text
        .replace(/```(?:json)?/gi, "")
        .replace(/```/g, "")
        .trim();
      parsed = {
        message: cleanedFallback.slice(0, 800) ||
                 "Désolé, je n'ai pas pu formuler de réponse claire. Reformule ta question ?",
        posture: "diagnostic",
        tu_as_pense_a: [],
        alertes: [],
        produits_suggeres: [],
        questions_suivantes: [],
        etape_projet: "diagnostic",
        sujet_principal: "autre"
      };
    }

    // Garde-fou : champs obligatoires si LLM a oublié l'un
    parsed.message = parsed.message || "";
    parsed.posture = parsed.posture || "diagnostic";
    parsed.tu_as_pense_a = Array.isArray(parsed.tu_as_pense_a) ? parsed.tu_as_pense_a : [];
    parsed.alertes = Array.isArray(parsed.alertes) ? parsed.alertes : [];
    parsed.produits_suggeres = Array.isArray(parsed.produits_suggeres) ? parsed.produits_suggeres : [];
    parsed.questions_suivantes = Array.isArray(parsed.questions_suivantes) ? parsed.questions_suivantes : [];
    parsed.etape_projet = parsed.etape_projet || "diagnostic";
    parsed.sujet_principal = parsed.sujet_principal || "autre";

    return new Response(
      JSON.stringify({
        success: true,
        ...parsed,
        _meta: {
          tool_iterations: iterations,
          version: "v2"
        }
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
