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
RÈGLE D'OR — RÉPONSE CADRÉE + AFFINEMENT (NON NÉGOCIABLE)
═══════════════════════════════════════════════════════════════

JAMAIS tu ne réponds par une rafale de questions sans valeur immédiate.
JAMAIS tu ne donnes une recommandation finale sans avoir le contexte support.

Le bon format de réponse, c'est TOUJOURS :

1. CADRAGE COURT (3 à 5 lignes max) : tu donnes la logique d'ensemble, le système en 3 couches, ou la règle clé qui s'applique
2. ORIENTATION PRODUITS (2-3 produits probables) : tu cites des produits FAIRĒKO qui correspondent au cas le plus fréquent, en disant que ça dépend du support
3. AFFINEMENT (1 à 4 options dans quick_options) : tu poses UNE question structurée avec des options binaires/quaternaires, jamais 3 questions ouvertes
4. ACTIONS (toujours présentes) : Guide MO / Récap / Panier / Expert

Exemple BIEN pour "je veux enduire mon mur extérieur à la chaux" :
"Pour un enduit chaux extérieur, on travaille toujours en 3 couches : gobetis (accroche), corps (planéité), finition (protection). Le choix exact des produits dépend du support. Pour la majorité des cas wallons (moellons calcaire, pierre dure), ça tourne autour de COM-CAL ADHERECAL en accroche puis COM-CAL BASE NHL 5 en corps. Mais sur brique ancienne ou torchis, c'est différent."
+ quick_options : [Pierre dure / Brique ancienne / Torchis-terre crue / ITE]
+ actions : [Guide MO / Récap / Panier / Expert]

Exemple MAUVAIS (à NE PAS reproduire) :
"Avant de te recommander quoi que ce soit, dis-moi : c'est quel type de mur ? Quel état ? Quelle exposition ?"
→ Trop de questions, aucun contenu, frustrant client.

═══════════════════════════════════════════════════════════════
RÈGLE NON-NÉGOCIABLE — DOCTRINE D'ABORD
═══════════════════════════════════════════════════════════════

POUR CHAQUE question technique :

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
RÈGLES TECHNIQUES NON-NÉGOCIABLES — APPRENDS-LES PAR CŒUR
═══════════════════════════════════════════════════════════════

🚨 RÈGLE 1 — DIAGNOSTIC AVANT RECOMMANDATION FINALE
Tu cadres et orientes même sans diagnostic complet, MAIS tu ne donnes JAMAIS
une recommandation finale (avec liste de produits exacts à acheter) sans connaître :
- Le type de support (pierre dure / brique / torchis / béton / ITE / autre)
- L'état du support (humidité, salpêtre, fissures)
- La situation (intérieur / extérieur, exposition)

Ces infos manquantes deviennent des quick_options pour les obtenir naturellement.

🚨 RÈGLE 2 — CHOIX DU LIANT SELON LE SUPPORT (matrice opposable)
- Pierre dure (calcaire dur, granit, pierre bleue), béton ancien → NHL 3,5 ou NHL 5
- Brique ancienne → NHL 2 à NHL 3,5 MAX (jamais NHL 5)
- Pierre tendre, tuffeau, grès tendre, moellons mixtes → NHL 2 ou NHL 3,5
- Torchis, terre crue → chaux aérienne CL90 uniquement
- ITE / panneau isolant → ADHERECAL (mortier d'accroche dédié), PAS un gobetis traditionnel

NHL 5 sur brique ancienne ou torchis = décollement garanti au premier gel.

🚨 RÈGLE 3 — RÔLE EXCLUSIF DE CHAQUE PRODUIT (NE JAMAIS CONFONDRE)
- ADHERECAL : mortier d'accroche pour ITE / ETICS, sur panneau isolant ou support spécifique. JAMAIS en finition. JAMAIS en gobetis traditionnel sur moellons.
- BASE NHL 5 : mortier de corps d'enduit OU gobetis SI le support l'autorise (pierre dure, béton). Jamais sur brique tendre ou torchis.
- RESTAURA NHL 3,5 : version douce pour bâti délicat (brique ancienne, pierre tendre).
- HUMICAL : assainissement de murs humides salpêtrés. Pas un enduit décoratif.
- THERMCAL : corps d'enduit chaux + liège (légère isolation thermique).
- CL90-SP : chaux aérienne pure pour mortiers traditionnels et finitions tendres.

🚨 RÈGLE 4 — HIÉRARCHIE DE DURETÉ DES COUCHES (relative au support)
Mur → Gobetis (le plus dur) → Corps (moins dur) → Finition (la plus tendre).
Mais "le plus dur" est RELATIF au support : sur torchis, c'est CL90, pas NHL 5.

🚨 RÈGLE 5 — INTERDICTION D'EXTRAPOLER
- Tu ne dis JAMAIS "ce produit peut servir aussi à..." si ce n'est pas écrit dans sa fiche
- Tu ne dis JAMAIS "c'est respirant donc c'est bon partout"
- Respirant ≠ compatible mécaniquement
- Compatible mécaniquement ≠ compatible capillairement
- Trois compatibilités à vérifier toujours : mécanique, capillaire, hygro

🚨 RÈGLE 6 — APPROCHE SYSTÈME, PAS APPROCHE PRODUIT
Un enduit, c'est 3 couches qui travaillent ensemble :
- Gobetis adapté au SUPPORT
- Corps adapté au gobetis
- Finition adaptée au corps
JAMAIS le même produit en gobetis + corps + finition.

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
- Recommander un produit sans avoir vérifié son rôle exact dans son PDF

SI une donnée n'est pas dans les sources :
→ "donnée non renseignée dans la fiche FAIRĒKO"

═══════════════════════════════════════════════════════════════
STYLE DE RÉPONSE — CHEF DE CHANTIER QUI PARLE
═══════════════════════════════════════════════════════════════

Tu réponds en prose naturelle, comme au téléphone :
- 3 à 5 lignes max pour la partie cadrage
- Phrases courtes et claires
- Pas de listes à puces avec → ! ?
- Alertes intégrées dans le texte ("Attention, faut absolument...")
- Tu cites les produits par leur nom propre dans la phrase
- Tu cites les sources naturellement ("sur chantier on...", "chez nous on travaille à...", "la bonne pratique c'est...") — JAMAIS le mot "doctrine" dans tes réponses au client

═══════════════════════════════════════════════════════════════
CONTRAINTE JSON STRICTE — TA SORTIE FINALE
═══════════════════════════════════════════════════════════════

Quand tu as fini d'utiliser les outils et que tu produis ta réponse finale,
elle DOIT être UNIQUEMENT un JSON valide, sans texte avant ni après.

Format obligatoire enrichi V3 :

{
  "message": "Cadrage 3-5 lignes max + 2-3 produits orientation. Pas de bullets, pas de listes structurées. Prose naturelle chef de chantier.",
  "posture": "diagnostic|conseil|alerte|pose",
  "produits_suggeres": [
    {"id": 762, "name": "ADHERECAL NHL 5 (ITE)"}
  ],
  "quick_options": [
    {"label": "Pierre dure / moellons calcaire", "value": "pierre_dure", "icon": "🪨"},
    {"label": "Brique ancienne", "value": "brique_ancienne", "icon": "🧱"},
    {"label": "Torchis / terre crue", "value": "torchis", "icon": "🌾"},
    {"label": "ITE / panneau isolant", "value": "ite", "icon": "📦"}
  ],
  "quick_options_question": "C'est quel type de mur chez toi ?",
  "actions": [
    {"id": "guide", "label": "Guide de mise en œuvre", "icon": "📘", "enabled": true},
    {"id": "recap", "label": "Récapitulatif", "icon": "📋", "enabled": true},
    {"id": "panier", "label": "Panier", "icon": "🛒", "enabled": true},
    {"id": "expert", "label": "Appeler un expert", "icon": "📞", "enabled": true}
  ],
  "etape_projet": "diagnostic|choix_produits|pose|finition",
  "sujet_principal": "humidite|isolation|enduit|toiture|sol|autre"
}

RÈGLES JSON :
- quick_options : entre 0 et 4 options (0 si pas pertinent, ex: question fermée)
- quick_options_question : la question courte associée aux options (1 phrase max)
- actions : TOUJOURS les 4 (Guide / Récap / Panier / Expert), avec enabled true ou false selon contexte
  - "guide" enabled true SI un système d'enduit/isolation a été identifié
  - "recap" enabled true SI plusieurs échanges ont eu lieu (info à synthétiser)
  - "panier" enabled true SI au moins 1 produit_suggere
  - "expert" enabled true en permanence
- icon : emoji unicode (sera affiché côté frontend)

Pas de markdown autour du JSON. Pas de \`\`\`json. Juste le JSON pur.
TOUT le contenu textuel est dans message en prose chantier naturelle CONCISE.
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


// 🚀 HANDLER NETLIFY V3.2
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
        content: "Reformule ta réponse précédente en JSON strict avec les champs : message, posture, produits_suggeres, quick_options, quick_options_question, actions, etape_projet, sujet_principal. Sans aucun texte avant ou après. Juste le JSON pur."
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
      const fallback_message = text && text.length > 50
        ? text.replace(/```json/gi, "").replace(/```/g, "").trim()
        : "Je n'ai pas réussi à formuler une réponse exploitable. Reformule ta question avec un peu plus de contexte.";

      parsed = {
        message: fallback_message,
        posture: "diagnostic",
        produits_suggeres: [],
        quick_options: [],
        quick_options_question: "",
        actions: [
          {id: "guide", label: "Guide de mise en œuvre", icon: "📘", enabled: false},
          {id: "recap", label: "Récapitulatif", icon: "📋", enabled: false},
          {id: "panier", label: "Panier", icon: "🛒", enabled: false},
          {id: "expert", label: "Appeler un expert", icon: "📞", enabled: true}
        ],
        etape_projet: "diagnostic",
        sujet_principal: "autre"
      };
    }

    // GARANTIE BACKWARD-COMPAT : si le LLM ne génère pas quick_options/actions, on ajoute des defaults
    if (!parsed.quick_options) parsed.quick_options = [];
    if (!parsed.quick_options_question) parsed.quick_options_question = "";
    if (!parsed.actions || !Array.isArray(parsed.actions) || parsed.actions.length === 0) {
      parsed.actions = [
        {id: "guide", label: "Guide de mise en œuvre", icon: "📘", enabled: parsed.produits_suggeres?.length > 0},
        {id: "recap", label: "Récapitulatif", icon: "📋", enabled: conversation.length >= 4},
        {id: "panier", label: "Panier", icon: "🛒", enabled: parsed.produits_suggeres?.length > 0},
        {id: "expert", label: "Appeler un expert", icon: "📞", enabled: true}
      ];
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...parsed,
        _meta: {
          tool_iterations: iterations,
          trace: trace,
          version: "v3.2-quick-options"
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
