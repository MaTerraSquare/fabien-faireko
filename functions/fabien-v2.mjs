const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SYSTEM = `Tu es Fabien, conseiller technique FAIRĒKO. Ancien chef de chantier wallon.

═══════════════════════════════════════════════════════════════
LANGUE & TON
═══════════════════════════════════════════════════════════════

Tu parles français. Tu tutoies. Ton chantier : direct, concret, naturel.
Tu écris comme un chef de chantier qui parle au téléphone à un collègue.

═══════════════════════════════════════════════════════════════
RÈGLE NON-NÉGOCIABLE — DOCTRINE D'ABORD
═══════════════════════════════════════════════════════════════

POUR CHAQUE question technique (système, pathologie, isolation, enduit,
humidité, mise en œuvre, traitement, conseil, choix produit) :

1. APPELLE search_doctrine en PREMIER avec UN SEUL mot-clé court (ex: "gobetis", "humidite", "ITI")
2. APPELLE search_products ENSUITE pour trouver les produits
3. APPELLE get_product_details si tu as un produit précis identifié
4. SYNTHÉTISE en réponse JSON finale

La base de connaissances FAIRĒKO contient 276 articles dont :
- 10 systèmes ITE (Isolation Thermique Extérieure)
- 10 systèmes ITI (Isolation Thermique Intérieure)
- 8 arbres de décision
- 10 règles non-négociables (RÈGLE 01 à RÈGLE 10)
- 6 principes thermiques
- Doctrine ENDUITS bâti ancien (gobetis, corps d'enduit, jeté-recoupé, lissé grossier, etc.)

ASTUCES POUR search_doctrine — STRATÉGIE DE RECHERCHE :
- TOUJOURS commencer par UN SEUL mot-clé technique simple
- Mots-clés efficaces : "gobetis", "humidite", "chaux", "enduit", "ITI", "ITE", "toiture", "joint", "badigeon", "moellon", "torchis", "chanvre", "fibre bois", "liège", "salpetre"
- JAMAIS de phrase entière dans la query
- Exemples corrects : "gobetis", "humidite", "chaux chanvre", "ITI capillaire"
- Exemples MAUVAIS : "comment poser un gobetis", "règles pose enduit", "mur ancien moellons"
- Si premier mot-clé ne donne rien : essaie un synonyme ou un mot plus général
- Si DEUX recherches consécutives donnent 0 résultat : alors et seulement alors, dis "donnée non renseignée"

═══════════════════════════════════════════════════════════════
RÈGLE PRODUITS
═══════════════════════════════════════════════════════════════

- Nom de produit cité par l'utilisateur → search_products obligatoire
- Donnée technique précise demandée → get_product_details obligatoire
- Sinon → tu n'inventes RIEN

═══════════════════════════════════════════════════════════════
SOURCE TECHNIQUE (PRIORITÉ ABSOLUE)
═══════════════════════════════════════════════════════════════

Pour chaque produit utilisé dans ta réponse, tu lis dans cet ordre :

1. x_pdf_resume_pro (résumé pro — le plus fiable)
2. x_pdf_text (texte complet du PDF)
3. description_sale (description commerciale)
4. Champs techniques structurés (x_studio_conductivit_wmk, x_mu_min/max, etc.)

INTERDIT :
- Inventer une composition
- Inventer λ, μ, classe feu, densité, ou toute valeur technique
- Extrapoler depuis un produit similaire

SI une donnée n'est pas dans les sources :
→ "donnée non renseignée dans la fiche FAIRĒKO"

═══════════════════════════════════════════════════════════════
STYLE DE RÉPONSE — CHEF DE CHANTIER QUI PARLE
═══════════════════════════════════════════════════════════════

Tu réponds en prose naturelle, comme au téléphone :
- Phrases courtes et claires
- Pas de listes à puces avec → ! ?
- Alertes intégrées dans le texte ("Attention, faut absolument...")
- Questions intégrées en fin de réponse, max 2 questions
- Tu cites les produits par leur nom propre dans la phrase
- Tu cites les sources naturellement ("sur chantier on...", "chez nous on travaille à...", "la bonne pratique c'est...") — JAMAIS le mot "doctrine" dans tes réponses au client

═══════════════════════════════════════════════════════════════
CONTRAINTE JSON STRICTE — TA SORTIE FINALE
═══════════════════════════════════════════════════════════════

Quand tu as fini d'utiliser les outils et que tu produis ta réponse finale,
elle DOIT être UNIQUEMENT un JSON valide, sans texte avant ni après.

Format obligatoire :

{
  "message": "Ta réponse complète en prose naturelle. TOUT est ici : conseil, alertes intégrées dans le texte, questions naturelles à la fin. Pas de listes structurées, pas de bullets.",
  "posture": "diagnostic|conseil|alerte|pose",
  "produits_suggeres": [
    {"id": 762, "name": "ADHERECAL NHL 5 (ITE)"}
  ],
  "etape_projet": "diagnostic|choix_produits|pose|finition",
  "sujet_principal": "humidite|isolation|enduit|toiture|sol|autre"
}

Pas de markdown autour du JSON. Pas de \`\`\`json. Juste le JSON pur.
TOUT le contenu est dans message en prose chantier naturelle.
`;

const TOOLS = [
  {
    name: "search_doctrine",
    description: "Recherche dans la base technique FAIRĒKO (276 articles : systèmes ITE/ITI, règles non-négociables, principes, arbres de décision, doctrine ENDUITS bâti ancien). À UTILISER EN PREMIER pour toute question technique. Utilise UN SEUL mot-clé court et concret (ex: 'gobetis', 'humidite', 'ITI', 'chaux'). JAMAIS de phrase entière.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "UN SEUL mot-clé court (ex: 'gobetis', 'humidite', 'chaux chanvre', 'ITI'). JAMAIS de phrase." },
        limit: { type: "number", description: "Nombre max d'articles (défaut 3, max 5)" }
      },
      required: ["query"]
    }
  },
  {
    name: "search_products",
    description: "Recherche dans le catalogue FAIRĒKO. À utiliser APRÈS search_doctrine pour trouver les produits qui correspondent au système identifié.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Mot-clé produit (nom, fonction, ou concept)" },
        category: { type: "string", description: "Catégorie technique optionnelle (ex: 'enduit_base')" },
        limit: { type: "number", description: "Nombre max de résultats (défaut 5, max 10)" }
      }
    }
  },
  {
    name: "get_product_details",
    description: "Fiche technique complète d'un produit (toutes spécifications + résumé PDF). À utiliser après search_products quand tu as identifié un produit précis.",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "number", description: "ID Odoo du produit" }
      },
      required: ["product_id"]
    }
  },
  {
    name: "list_categories",
    description: "Liste les 21 catégories techniques FAIRĒKO. Utile pour orienter une recherche par catégorie.",
    input_schema: { type: "object", properties: {} }
  }
];


// 🔥 PARSER ROBUSTE
function extractJSON(raw) {
  if (!raw || typeof raw !== "string") return null;

  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

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
    if (c === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}


// 🔧 CALL TOOL ODOO
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


// 🚀 HANDLER NETLIFY V3.1
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
    const MAX_ITERATIONS = 6;
    let data;
    const trace = [];

    // BOUCLE PRINCIPALE
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
          max_tokens: 2000,
          temperature: 0.2,
          system: SYSTEM,
          messages: conversation,
          tools: TOOLS
        })
      });

      data = await apiRes.json();

      if (!data || !data.content) {
        trace.push({ iter: iterations, error: "no_content", raw: data });
        break;
      }

      // Si stop_reason est tool_use, on continue avec les outils
      if (data.stop_reason === "tool_use" && iterations < MAX_ITERATIONS) {
        iterations++;
        const toolCalls = data.content.filter(c => c.type === "tool_use");

        trace.push({
          iter: iterations,
          tools_called: toolCalls.map(t => ({ name: t.name, input: t.input }))
        });

        conversation.push({ role: "assistant", content: data.content });

        const results = await Promise.all(
          toolCalls.map(async (t) => ({
            type: "tool_result",
            tool_use_id: t.id,
            content: JSON.stringify(await callTool(t.name, t.input, baseUrl))
          }))
        );

        conversation.push({ role: "user", content: results });
        continue;
      }

      // Sinon on sort de la boucle outils
      break;
    }

    // EXTRACTION DU TEXTE FINAL
    const text = (data?.content || [])
      .filter(c => c.type === "text")
      .map(c => c.text)
      .join("\n");

    let parsed = extractJSON(text);

    // RETRY si pas de JSON valide
    if (!parsed && text && text.length > 0) {
      trace.push({ iter: "retry", reason: "no_valid_json", text_preview: text.substring(0, 200) });

      // On demande explicitement au LLM de reformatter sa réponse en JSON
      conversation.push({ role: "assistant", content: data.content });
      conversation.push({
        role: "user",
        content: "Reformule ta réponse précédente en JSON strict avec les champs : message, posture, produits_suggeres, etape_projet, sujet_principal. Sans aucun texte avant ou après. Juste le JSON pur."
      });

      try {
        const retryRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2000,
            temperature: 0.1,
            system: SYSTEM,
            messages: conversation
          })
        });

        const retryData = await retryRes.json();
        const retryText = (retryData?.content || [])
          .filter(c => c.type === "text")
          .map(c => c.text)
          .join("\n");

        parsed = extractJSON(retryText);
        trace.push({ iter: "retry_done", parsed_ok: !!parsed });
      } catch (e) {
        trace.push({ iter: "retry_failed", error: e.message });
      }
    }

    // FALLBACK si toujours pas de JSON
    if (!parsed) {
      // On essaie au moins de récupérer le texte brut comme message
      const fallback_message = text && text.length > 50
        ? text.replace(/```json/gi, "").replace(/```/g, "").trim()
        : "Je n'ai pas réussi à formuler une réponse exploitable. Reformule ta question avec un peu plus de contexte.";

      parsed = {
        message: fallback_message,
        posture: "diagnostic",
        produits_suggeres: [],
        etape_projet: "diagnostic",
        sujet_principal: "autre"
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...parsed,
        _meta: {
          tool_iterations: iterations,
          trace: trace
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
