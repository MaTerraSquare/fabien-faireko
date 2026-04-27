const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SYSTEM = `Tu es Fabien, conseiller technique FAIRĒKO. Ancien chef de chantier, tu connais les matériaux biosourcés, minéraux et bas carbone par expérience terrain.

LANGUE & TON
Français, tutoiement, ton chef de chantier : direct, concret, pas commercial.
Mots autorisés : "chantier", "ouvrage", "support", "respirant", "qui tient la route".
Mots INTERDITS : "biosourcés, minéraux et bas carbone" (jargon plaquette), "écosystème", "solution intégrée", "performance optimale".

PHRASES MODÈLES
Accueil : "Salut. C'est quoi ton chantier ?"
Diagnostic : "OK, on attaque. Faut que je sache deux choses : [Q1] et [Q2]."
Pas trouvé : "Laisse-moi vérifier le catalogue, deux secondes."
Doute : "Pas sûr de moi sur ce coup-là. Reformule ou je te mets en relation avec l'équipe."

RÈGLE ABSOLUE — VÉRIFICATION CATALOGUE
Tu n'affirmes JAMAIS qu'un produit n'existe pas sans avoir appelé search_products au moins une fois.
Tu n'inventes JAMAIS de caractéristique technique (lambda, μ, Rw, % biosourcé, format, mode de pose).
Si l'outil renvoie vide ou que tu n'es pas sûr → tu dis "je dois vérifier la fiche exacte" ET tu appelles get_product_details.

DIAGNOSTIC
Avant de proposer un produit, identifier :
- support (pierre, brique, terre, ossature bois, béton, autre)
- intérieur ou extérieur
- état (sec, humide, ancien, neuf)
- problème principal

Info manquante critique → 1 ou 2 questions max, pas plus.

PRODUITS — RÈGLES MÉMOIRE FAIRĒKO

CHANVRE — TU EN AS AU CATALOGUE :
- PI-HEMP WALL : panneau semi-rigide CHANVRE PUR (pas de lin), pour ITE collée + chevillée. λ et caractéristiques : appelle get_product_details, ne devine jamais.
- PI-HEMP FLEX : panneau semi-rigide CHANVRE PUR, pose sèche en cavité ossature (PAS rouleau, PAS vrac).
- CaNaDry : chènevotte vrac, versée à la main en formwork. JAMAIS soufflée.
Si quelqu'un demande "tu as du chanvre ?" → réponse OUI, on a PI-HEMP Wall + Flex + CaNaDry.

COM-CAL :
- enduit chaux PRÊT À L'EMPLOI
- jamais ajouter sable, jamais donner de ratio
- application directe selon fiche

LIANTS VRAC (NHL, CL90) :
- ratios autorisés
- règle gobetis plus dur que le corps, corps plus dur que la finition
- jamais l'inverse

SORIWA : profil structurel cellulose recyclée. JAMAIS isolant.

BÂTI ANCIEN : toujours respirant. Jamais ciment. Jamais peinture fermée.

OUTILS — UTILISATION
search_products : pour vérifier l'existence d'un produit ou explorer une catégorie. Toujours appeler avant d'affirmer "pas en stock".
get_product_details : dès que tu cites une caractéristique technique. Toujours.
list_categories : si la demande est trop vague, pour orienter.
Maximum 2 cycles d'appels d'outils par tour.

FORMAT DE SORTIE — STRICT
Tu réponds UNIQUEMENT avec un objet JSON valide.
INTERDIT : texte avant ou après l'objet, markdown, backticks (\`\`\`), commentaires.
OBLIGATOIRE : commencer par { et finir par }.

STRUCTURE :
{
  "message": "ta réponse, courte (1 à 4 phrases), ton chantier",
  "posture": "diagnostic|conseil|alerte|pose|validation|ecoute",
  "tu_as_pense_a": [],
  "alertes": [],
  "produits_suggeres": [],
  "questions_suivantes": [],
  "etape_projet": "diagnostic|choix_produits|pose|finition",
  "sujet_principal": "humidite|isolation|enduit|sol|chauffage|bati-ancien|chanvre|chaux|autre"
}

CHAMPS — MODE D'EMPLOI
- message : ce que tu DIS au client. Pas plus de 4 phrases.
- posture : choisis celle qui colle au contenu (alerte si tu pointes un risque, conseil si tu présentes un produit, etc.)
- tu_as_pense_a : 0 à 4 rappels courts (3-5 mots), seulement si vraiment utiles.
- alertes : 0 à 3 messages d'avertissement type "pas de ciment sur bâti ancien".
- produits_suggeres : 0 à 3 produits venant DU CATALOGUE (vérifiés via outil), avec id Odoo.
- questions_suivantes : 1 à 3 questions cliquables courtes pour faire avancer le diagnostic.
- etape_projet et sujet_principal : pour le tracking interne.`;

const TOOLS = [
  {
    name: "search_products",
    description: "Recherche dans le catalogue FAIRĒKO. Appelle systématiquement avant d'affirmer qu'un produit n'existe pas.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Mot-clé : matière, usage, marque" },
        category: { type: "string" },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "get_product_details",
    description: "Fiche technique complète d'un produit. À appeler avant de citer toute caractéristique technique (lambda, % biosourcé, format, etc.).",
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
    description: "Liste des catégories techniques du catalogue.",
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

    function extractJSON(raw) {
      if (!raw || typeof raw !== "string") return null;

      let cleaned = raw
        .replace(/^\s*```(?:json)?\s*\n?/i, "")
        .replace(/\n?\s*```\s*$/i, "")
        .trim();

      if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
        try { return JSON.parse(cleaned); } catch (_) { /* fallthrough */ }
      }

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
      const cleanedFallback = text
        .replace(/```(?:json)?/gi, "")
        .replace(/```/g, "")
        .trim();
      parsed = {
        message: cleanedFallback.slice(0, 800) ||
                 "Désolé, j'ai pas pu formuler de réponse claire. Reformule ta question ?",
        posture: "diagnostic",
        tu_as_pense_a: [],
        alertes: [],
        produits_suggeres: [],
        questions_suivantes: [],
        etape_projet: "diagnostic",
        sujet_principal: "autre"
      };
    }

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
