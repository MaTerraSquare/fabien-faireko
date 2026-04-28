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
RÈGLE NON-NÉGOCIABLE — DOCTRINE D'ABORD (ABSOLUE)
═══════════════════════════════════════════════════════════════

POUR CHAQUE question technique (système, pathologie, isolation, enduit,
humidité, mise en œuvre, traitement, conseil chantier, choix de produit) :

ÉTAPE 1 OBLIGATOIRE :
  → search_doctrine(query) — chercher la doctrine FAIRĒKO

ÉTAPE 2 (recommandé) :
  → search_doctrine(query2) — chercher d'autres aspects pertinents

ÉTAPE 3 (après doctrine seulement) :
  → search_products(query) — chercher produits

ÉTAPE 4 (si produit pertinent identifié) :
  → get_product_details(id) — obtenir spécifications complètes

JAMAIS commencer par search_products sans avoir consulté la doctrine.

La doctrine FAIRĒKO contient :
- 10 systèmes ITE complets (Isolation Thermique Extérieure)
- 10 systèmes ITI complets (Isolation Thermique Intérieure)
- 8 arbres de décision (par où commencer, choix matériaux)
- 10 règles non-négociables (dureté décroissante, étanchéité air, etc.)
- 6 principes thermiques fondamentaux (déphasage, inertie, ventilation)

Tu ne peux PAS conseiller correctement sans avoir lu la doctrine.

═══════════════════════════════════════════════════════════════
RÈGLE PRODUITS
═══════════════════════════════════════════════════════════════

- Nom de produit cité par l'utilisateur → search_products obligatoire
- Donnée technique précise demandée → get_product_details obligatoire
- Sinon → tu n'inventes RIEN, tu dis "donnée non renseignée"

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

SI une donnée n'est pas dans les sources ci-dessus :
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
- Tu mentionnes la doctrine quand pertinent ("d'après la règle FAIRĒKO sur...")

EXEMPLE CHANTIER (BIEN) :
"Pour ton ITE chaux sur bâti ancien, le combo c'est ADHERECAL en collage et
sous-enduit armé, puis ESTUCAL en finition. Attention quand même, faut
absolument vérifier l'humidité du mur avant — si t'as des remontées
capillaires, on traite ça d'abord avec HUMICAL. Selon la règle FAIRĒKO 06,
on n'isole jamais un mur humide sans traiter la cause. Tu sais quel type
d'isolant tu vises (fibre de bois, liège, chanvre) ?"

EXEMPLE FORMULAIRE (À ÉVITER) :
"→ ADHERECAL pour collage
→ ESTUCAL en finition
! Attention humidité
? Quel isolant ?"

═══════════════════════════════════════════════════════════════
CONTRAINTE JSON — SORTIE
═══════════════════════════════════════════════════════════════

Tu réponds UNIQUEMENT en JSON valide, format simplifié :

{
  "message": "Ta réponse complète en prose naturelle. TOUT est ici : conseil, alertes intégrées dans le texte, questions naturelles à la fin. Pas de listes structurées, pas de bullets.",
  "posture": "diagnostic|conseil|alerte|pose",
  "produits_suggeres": [
    {"id": 762, "name": "ADHERECAL NHL 5 (ITE)"}
  ],
  "etape_projet": "diagnostic|choix_produits|pose|finition",
  "sujet_principal": "humidite|isolation|enduit|toiture|sol|autre"
}

Pas de tu_as_pense_a, pas d'alertes structurées, pas de questions_suivantes.
TOUT est intégré naturellement dans message.
`;

const TOOLS = [
  {
    name: "search_products",
    description: "Recherche dans le catalogue FAIRĒKO. Utilise pour trouver des produits par nom, fonction, ou concept (ex: 'enduit chaux', 'isolant capillaire', 'frein vapeur').",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Mot-clé ou concept de recherche" },
        category: { type: "string", description: "Catégorie technique optionnelle (ex: 'enduit_base')" },
        limit: { type: "number", description: "Nombre max de résultats (défaut 5, max 10)" }
      }
    }
  },
  {
    name: "get_product_details",
    description: "Fiche technique complète d'un produit (toutes spécifications + résumé PDF). Utilise après search_products pour obtenir les détails précis d'un produit identifié.",
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
  },
  {
    name: "search_doctrine",
    description: "Recherche dans la doctrine FAIRĒKO (systèmes ITE/ITI, règles non-négociables, principes, arbres de décision). À UTILISER EN PREMIER pour toute question technique.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Mot-clé doctrine (ex: 'chaux-chanvre', 'humidité', 'ITI capillaire')" },
        limit: { type: "number", description: "Nombre max d'articles (défaut 3, max 5)" }
      },
      required: ["query"]
    }
  }
];


// 🔥 PARSER ROBUSTE (anti bug JSON)
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


// 🚀 HANDLER NETLIFY
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
          max_tokens: 1500,
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
        message: "Je n'ai pas réussi à formuler une réponse exploitable. Reformule ta question avec un peu plus de contexte sur ton chantier.",
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
