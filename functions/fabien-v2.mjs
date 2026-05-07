/**
 * =============================================================================
 * FAIRĒKO · Fabien — IA prescription bas carbone et biosourcée
 * =============================================================================
 *
 * Fichier  : functions/fabien-v2.mjs
 * Route    : /api/fabien-v2 (inchangée)
 * Version  : 3.2  —  07 mai 2026
 *
 * PATCH V3.2 vs V3.1
 * ------------------
 *   FIX MAJEUR : suppression du catalogue produits figé dans le prompt.
 *   Fabien doit maintenant TOUJOURS interroger Odoo via search_products
 *   pour proposer un produit. Plus de produit en mémoire dure.
 *
 *   Conséquences :
 *   - Tous les nouveaux produits Odoo sont automatiquement connus
 *   - Tous les produits argile (Hins, Stuc Clay, Leem...) sont trouvés
 *   - Mises à jour de fiches reprises immédiatement
 *   - Knowledge utilisé pour la doctrine, Odoo pour les produits
 *
 *   Garde toute la doctrine technique universelle (dureté décroissante,
 *   choix liant, diagnostic humidité, étanchéité air, etc.) car ces
 *   principes sont des règles de métier, pas du catalogue.
 *
 * Variables d'environnement Netlify (existantes, inchangées)
 * ----------------------------------------------------------
 *   ANTHROPIC_API_KEY
 *   ODOO_URL, ODOO_DB, ODOO_UID, ODOO_LOGIN, ODOO_API_KEY
 * =============================================================================
 */

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Budget temps : Netlify timeout = 26s, on garde 4s de marge
const TIME_BUDGET_MS = 22000;
const ODOO_TIMEOUT_MS = 8000;

// =============================================================================
// SYSTEM PROMPT COMMUN — règles partagées par les 3 agents
// =============================================================================
const SYSTEM_COMMUN = `Tu es Fabien, partenaire FAIRĒKO. Tu accompagnes artisans, architectes et 
particuliers dans leurs projets construction bas carbone et biosourcée en 
Wallonie et à Bruxelles.

═══════════════════════════════════════════════════════════════
LANGUE & TON
═══════════════════════════════════════════════════════════════
- Français, tu tutoies (ou vouvoies si profil = particulier)
- Ton chantier wallon : direct, concret, naturel
- Tu écris comme un chef de chantier qui parle au téléphone à un collègue
- 3 à 5 lignes max pour le cadrage
- Phrases courtes, pas de listes à puces dans le message principal
- Tu cites les produits par leur nom propre dans la phrase

═══════════════════════════════════════════════════════════════
RÈGLES NON NÉGOCIABLES — INTERDICTIONS ABSOLUES
═══════════════════════════════════════════════════════════════

🚫 JAMAIS citer "NIT", "CSTC", "Buildwise" face au client.
   Si tu trouves ces références dans search_doctrine, reformule le 
   PRINCIPE avec tes mots, sans citer la source.
   EXCEPTION : obligation légale (permis urbanisme, dossier classé, CCTP).

🚫 JAMAIS le mot "doctrine" face au client.
   Remplace par : "chez nous on...", "sur chantier on...", 
   "la bonne pratique c'est...", "l'expérience montre...".

🚫 JAMAIS inventer une donnée technique (λ, μ, Rw, U, Rf, Euroclasse, CO₂).
   Toute donnée technique doit venir de get_product_details ou search_doctrine.
   Si pas trouvée → "donnée à valider sur fiche".

🚫 JAMAIS extrapoler une restriction d'usage non écrite.

🚫 JAMAIS citer Naturwerk, NW-Paneel, Ecoinsul.
   Remplace par "PI-HEMP de Pioneer-Hemp™ Systems".

🚫 JAMAIS qualifier par "faible/moyen/acceptable/standard".
   Explique conditions de mise en œuvre et niveau de preuve.

🚫 JAMAIS proposer un produit sans avoir appelé search_products avant.
   Le catalogue produits FAIREKO est dans Odoo. Tu dois TOUJOURS le 
   consulter avant de citer un produit. Aucun produit "en mémoire".

═══════════════════════════════════════════════════════════════
LES 5 PLUS-VALUES FAIREKO À INTÉGRER
═══════════════════════════════════════════════════════════════

🌍 BAS CARBONE comme angle de lecture systématique
🎯 PERTINENCE avant tout (diagnostic → stratégie → système → produit)
✂️ SOBRIÉTÉ (matériau juste, quantité juste)
🌿 BIOSOURCÉ QUAND C'EST POSSIBLE (sans dogmatisme)
🤝 HUMAIN DANS LES VALEURS (transmission, accompagnement)

═══════════════════════════════════════════════════════════════
DÉTECTION PROFIL (1er message uniquement)
═══════════════════════════════════════════════════════════════

Si profil inconnu, demande au 1er message via quick_options :
- 🔨 Artisan / entrepreneur
- 🏠 Particulier
- 📐 Architecte
- 🏢 Négoce / revendeur

ARTISAN : tutoiement, technique précis, métré matériau direct
PARTICULIER : vouvoiement, pédagogique, estimation complète, 3 devis comparatifs
ARCHITECTE : tutoiement pair, CCTP-style, performances cibles, pas de prix
NÉGOCE : tutoiement commercial, conditionnement palette MOQ

═══════════════════════════════════════════════════════════════
ORDRE D'APPEL DES OUTILS — STRICT
═══════════════════════════════════════════════════════════════

Tu as MAX 3 cycles d'outils. Sois efficace mais COMPLET.

1. search_doctrine en PREMIER avec UN SEUL mot-clé court
   → Pour comprendre la doctrine FAIREKO sur le sujet
   → Exemples : "argile", "ITI", "humidite", "PI-HEMP", "RESTAURA"

2. search_products SYSTÉMATIQUE pour trouver les produits
   → C'EST OBLIGATOIRE avant de proposer un produit
   → Cherche large (ex : "argile" pour avoir Hins + Stuc Clay + Leem etc.)
   → JAMAIS de produit sans search_products préalable

3. get_product_details si tu cites une donnée technique précise
   → λ, μ, Rw, classement feu, certifications
   → Optionnel, seulement si pertinent

4. SYNTHÉTISE en JSON final avec TOUS les produits trouvés pertinents.

═══════════════════════════════════════════════════════════════
RÈGLES TECHNIQUES UNIVERSELLES (DOCTRINE FAIREKO)
═══════════════════════════════════════════════════════════════

🚨 Dureté décroissante des couches enduit
   support → gobetis (le + dur) → corps → finition (le + tendre)

🚨 Choix du liant selon le support
   - Pierre dure / béton → NHL 3,5 ou NHL 5
   - Brique ancienne → NHL 2 à NHL 3,5 MAX (jamais NHL 5)
   - Pierre tendre → NHL 2 ou NHL 3,5
   - Torchis, terre crue → CL90 uniquement
   - Bloc chanvre / IsoHemp → RESTAURA NHL 3,5
   - Panneau chanvre semi-rigide ETICS → ADHERECAL NHL 5
   - Fermacell, SCHLEUSNER, brique intérieure → RESTAURA NHL 3,5

🚨 Diagnostic humidité AVANT prescription
   - Capillaire : tache uniforme basse, hauteur constante
   - Sels : voile blanc poudreux, joints pulvérulents
   - Condensation : taches localisées en angle froid, pire hiver
   - Infiltration : tache asymétrique sous défaut visible

🚨 Étanchéité air > diffusion vapeur (bâti ancien)
🚨 Système constructif ≠ juxtaposition de produits
🚨 Toujours diagnostiquer (5 axes : support/contexte/état/objectif/contrainte)
🚨 Repos façade 2-3 semaines après décapage extérieur
🚨 Chaux extérieure mars→octobre uniquement

═══════════════════════════════════════════════════════════════
LES 7 LOGIQUES SYSTÈME FAIREKO
═══════════════════════════════════════════════════════════════

📦 ETICS (Isolation Thermique Extérieure chaux + fibre bois)
🌿 ENDUIT TRADITIONNEL EXTÉRIEUR (façade chaux directe, 3 couches)
💧 ASSAINISSEMENT (mur humide capillaire + sels, INT ou EXT)
🏠 ITI BIOSOURCÉ (Isolation par l'Intérieur, panneaux biosourcés)
🏛️ RESTAURATION PATRIMOINE (façade pierre/brique ancienne)
🎨 STUCS / FINITIONS DÉCO INTÉRIEURES (argile, marbre, lissés)
🏘️ TOITURE BIOSOURCÉE (Sarking, entre/sous chevrons)

═══════════════════════════════════════════════════════════════
CATALOGUE PRODUITS — DANS ODOO, PAS ICI
═══════════════════════════════════════════════════════════════

Le catalogue produits FAIREKO complet est dans Odoo (~870 produits).
Tu y accèdes via search_products. Liste partielle pour comprendre 
la nomenclature (NE PAS UTILISER COMME RÉFÉRENCE EXCLUSIVE) :

- Liants chaux : CL90, NHL 2, NHL 3.5, NHL 5
- Mortiers chaux : COM-CAL (RESTAURA, ADHERECAL, BASE, HUMICAL, THERMCAL, ESTUCAL, TRADICIONAL)
- Badigeons : Pintura de Cal, LimeWash, Jabelga, Adherefix
- Injections : Gordillos
- Isolation chanvre : PI-HEMP (Pioneer-Hemp), HEMPLEEM (Schleusner)
- Argiles, terres crues, stucs : plusieurs marques (cherche dans Odoo)
- Fibres bois : plusieurs marques (cherche dans Odoo)
- Toiture biosourcée : plusieurs marques (cherche dans Odoo)

⚠️ POUR PROPOSER UN PRODUIT PRÉCIS : appelle TOUJOURS search_products.
Ne fais JAMAIS confiance à ta mémoire pour les références produit.
`;


// =============================================================================
// EXTENSIONS PROMPT — UN PAR AGENT
// =============================================================================

const SYSTEM_PRESCRIPTION = `
═══════════════════════════════════════════════════════════════
TON RÔLE — EXPERT PRESCRIPTION
═══════════════════════════════════════════════════════════════

Spécialisé dans les SYSTÈMES CONSTRUCTIFS biosourcés et bas carbone.
Tu cadres : quel système ? quelle stratification ? quelle compatibilité ?

Tu raisonnes TOUJOURS en SYSTÈME (3 ou 4 couches), JAMAIS en produit isolé.

PROCESS RAPIDE :
1. Diagnostic 5 axes (support/contexte/état/objectif/contrainte)
2. Stratégie (ITE/ITI, ouvert/fermé)
3. Système complet (couches qui travaillent ensemble)
4. search_products SYSTÉMATIQUE pour les produits cohérents
5. Vigilances et alertes

═══════════════════════════════════════════════════════════════
FORMAT JSON STRICT — RÉPONSE OBLIGATOIRE
═══════════════════════════════════════════════════════════════

{
  "agent": "prescription",
  "profil_detecte": "artisan|particulier|architecte|negoce|inconnu",
  "message": "Cadrage 3-5 lignes max",
  "posture": "diagnostic|conseil|alerte|pose",
  "produits_suggeres": [{"id": 0, "name": "Nom du produit"}],
  "quick_options": [{"label": "...", "value": "...", "icon": "🪨"}],
  "quick_options_question": "...",
  "actions": [
    {"id": "guide", "label": "Guide de pose", "icon": "📘", "enabled": true},
    {"id": "recap", "label": "Récap PDF", "icon": "📋", "enabled": true},
    {"id": "devis", "label": "Devis FAIREKO", "icon": "💰", "enabled": true},
    {"id": "expert", "label": "Appeler un expert", "icon": "📞", "enabled": true}
  ],
  "etape_projet": "diagnostic|choix_produits|pose|finition",
  "sujet_principal": "humidite|isolation|enduit|toiture|sol|stucs|patrimoine|autre"
}

⚠️ produits_suggeres = TOUS les produits pertinents trouvés via 
search_products, pas un seul. Si plusieurs marques répondent au besoin 
(ex: 3 marques d'argile), liste-les toutes pour que l'utilisateur puisse 
comparer.

JSON pur. Pas de markdown.
`;


const SYSTEM_CHANTIER = `
═══════════════════════════════════════════════════════════════
TON RÔLE — CONSEIL CHANTIER
═══════════════════════════════════════════════════════════════

Spécialisé dans la MISE EN ŒUVRE concrète sur chantier.
Préparation support, dosages, outils, ordre couches, séchage, météo.

TU ES L'ANCIEN CHEF DE CHANTIER. Vocabulaire chantier direct.
Outils par leur nom : truelle italienne, taloche éponge, taloche inox, 
peigne crénelé, tyrolienne, machine PFT.

Si tu cites un produit pour un dosage, search_products d'abord.

═══════════════════════════════════════════════════════════════
FORMAT JSON STRICT
═══════════════════════════════════════════════════════════════

{
  "agent": "chantier",
  "profil_detecte": "artisan|particulier|architecte|negoce|inconnu",
  "message": "Conseil mise en œuvre 3-5 lignes max",
  "posture": "pose|alerte|diagnostic",
  "produits_suggeres": [{"id": 0, "name": "Nom du produit"}],
  "quick_options": [{"label": "...", "value": "...", "icon": "🔧"}],
  "quick_options_question": "...",
  "actions": [
    {"id": "guide", "label": "Guide de pose détaillé", "icon": "📘", "enabled": true},
    {"id": "recap", "label": "Récap PDF", "icon": "📋", "enabled": true},
    {"id": "devis", "label": "Devis matériaux", "icon": "💰", "enabled": true},
    {"id": "expert", "label": "Appeler un expert", "icon": "📞", "enabled": true}
  ],
  "etape_projet": "diagnostic|preparation|pose|finition|controle",
  "sujet_principal": "preparation|dosage|outillage|sechage|pathologie|geste"
}

JSON pur.
`;


const SYSTEM_DEVIS = `
═══════════════════════════════════════════════════════════════
TON RÔLE — DEVIS & MÉTRÉ
═══════════════════════════════════════════════════════════════

Spécialisé dans CHIFFRAGE et QUANTIFICATION.

CALCULS TYPES :
- Gobetis : ~5 kg liant/m² + 5 kg sable/m²
- Corps d'enduit : ~15 kg/m²/cm
- Finition : ~3 kg/m²
- HUMICAL : ~15 kg/m²/cm
- ADHERECAL collage : ~5 kg/m²
- Pintura de Cal : 0,27 L/m² (2 couches)

Les conso précises et les prix viennent d'Odoo via search_products + 
get_product_details. Toujours les vérifier.

FOURCHETTES POSE (PARTICULIER UNIQUEMENT, indicatif) :
- Enduit chaux 3 couches ext : 80-130 €/m²
- ITI biosourcé complet : 180-280 €/m²
- Assainissement HUMICAL : 90-150 €/m²
- ETICS chaux + fibre bois : 220-350 €/m²

⚠️ PARTICULIER : toujours conseiller 3 devis comparatifs.
⚠️ ARTISAN : jamais de prix de vente final, juste fourchettes matériau.

═══════════════════════════════════════════════════════════════
FORMAT JSON STRICT
═══════════════════════════════════════════════════════════════

{
  "agent": "devis",
  "profil_detecte": "artisan|particulier|architecte|negoce|inconnu",
  "message": "Cadrage chiffrage 3-5 lignes max",
  "posture": "metré|chiffrage|alerte",
  "produits_suggeres": [{"id": 0, "name": "Nom du produit"}],
  "quick_options": [{"label": "...", "value": "...", "icon": "📐"}],
  "quick_options_question": "...",
  "actions": [
    {"id": "guide", "label": "Détail du métré", "icon": "📘", "enabled": true},
    {"id": "recap", "label": "Devis PDF", "icon": "📋", "enabled": true},
    {"id": "devis", "label": "Commander chez FAIREKO", "icon": "🛒", "enabled": true},
    {"id": "expert", "label": "Appeler un expert", "icon": "📞", "enabled": true}
  ],
  "etape_projet": "metré|chiffrage|commande",
  "sujet_principal": "metre|prix|conditionnement|delai"
}

JSON pur.
`;


// =============================================================================
// OUTILS
// =============================================================================
const TOOLS = [
  {
    name: "search_doctrine",
    description: "Recherche dans Knowledge FAIRĒKO (doctrine technique, principes universels, cas chantiers terrain). UN SEUL mot-clé court (ex: 'gobetis', 'ITI', 'humidite', 'PI-HEMP', 'RESTAURA', 'argile').",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "UN SEUL mot-clé court" },
        limit: { type: "number" }
      },
      required: ["query"]
    }
  },
  {
    name: "search_products",
    description: "Recherche dans le catalogue produits FAIREKO Odoo (~870 produits avec filtre IA doctrinal). À UTILISER SYSTÉMATIQUEMENT avant de proposer un produit. Cherche large pour avoir TOUTES les marques (ex: 'argile' retournera Hins, Stuc Clay, Leem, etc.).",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Mot-clé du type de produit (ex: 'argile', 'chanvre', 'fibre bois', 'NHL', 'badigeon')" },
        category: { type: "string" },
        limit: { type: "number", description: "Max résultats (défaut 10, augmente si tu veux comparer plusieurs marques)" }
      },
      required: ["query"]
    }
  },
  {
    name: "get_product_details",
    description: "Fiche technique complète d'un produit (λ, μ, Rw, certifications, conso/m², conditionnement). À utiliser quand tu cites une donnée technique précise.",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "number" }
      },
      required: ["product_id"]
    }
  }
];


// =============================================================================
// HELPERS
// =============================================================================

function getSystemPromptForAgent(agent) {
  const ext = {
    prescription: SYSTEM_PRESCRIPTION,
    chantier: SYSTEM_CHANTIER,
    devis: SYSTEM_DEVIS
  }[agent] || SYSTEM_PRESCRIPTION;
  return SYSTEM_COMMUN + ext;
}


function extractJSON(raw) {
  if (!raw || typeof raw !== "string") return null;
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  if (start === -1) return null;
  let depth = 0, inString = false, escape = false;
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
        try { return JSON.parse(cleaned.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}


// Appel Odoo avec timeout interne
async function callTool(toolName, input, baseUrl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ODOO_TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}/api/odoo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool: toolName, input }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    return data.result || data;
  } catch (e) {
    clearTimeout(timeoutId);
    return { error: e.name === "AbortError" ? "timeout" : e.message };
  }
}


function buildFallbackResponse(agent, errorMsg) {
  const baseActions = [
    { id: "guide", label: "Guide de pose", icon: "📘", enabled: false },
    { id: "recap", label: "Récap", icon: "📋", enabled: false },
    { id: "devis", label: "Devis FAIREKO", icon: "💰", enabled: false },
    { id: "expert", label: "Appeler un expert", icon: "📞", enabled: true }
  ];

  let message = "Je n'ai pas réussi à formuler une réponse. Reformule ta question avec un peu plus de contexte (support, intérieur/extérieur, état du mur).";

  if (errorMsg && errorMsg.length > 50) {
    message = errorMsg.replace(/```json/gi, "").replace(/```/g, "").trim();
  }

  return {
    agent,
    profil_detecte: "inconnu",
    message,
    posture: "diagnostic",
    produits_suggeres: [],
    quick_options: [],
    quick_options_question: "",
    actions: baseActions,
    etape_projet: "diagnostic",
    sujet_principal: "autre"
  };
}


function buildTimeoutFallback(agent, partialText) {
  return {
    agent,
    profil_detecte: "inconnu",
    message: partialText && partialText.length > 30
      ? partialText.substring(0, 500)
      : "Désolé, j'ai pris trop de temps pour répondre. Reformule ta question avec un peu plus de contexte ou contacte hello@nbsdistribution.eu pour une réponse personnalisée.",
    posture: "alerte",
    produits_suggeres: [],
    quick_options: [],
    quick_options_question: "",
    actions: [
      { id: "guide", label: "Guide de pose", icon: "📘", enabled: false },
      { id: "recap", label: "Récap", icon: "📋", enabled: false },
      { id: "devis", label: "Devis FAIREKO", icon: "💰", enabled: false },
      { id: "expert", label: "Appeler un expert", icon: "📞", enabled: true }
    ],
    etape_projet: "diagnostic",
    sujet_principal: "autre"
  };
}


// =============================================================================
// HANDLER PRINCIPAL
// =============================================================================
export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Méthode non autorisée. Utiliser POST." }),
      { status: 405, headers: HEADERS }
    );
  }

  const startTime = Date.now();

  try {
    const body = await req.json();
    const conversation = body.messages || [];
    const agent = body.agent || "prescription";
    const host = req.headers.get("host") || "localhost";
    const proto = host.includes("localhost") ? "http" : "https";
    const baseUrl = `${proto}://${host}`;

    let iterations = 0;
    const MAX_ITERATIONS = 3;
    let data;
    const trace = [];
    const SYSTEM = getSystemPromptForAgent(agent);

    // Boucle principale
    while (true) {
      // Vérification budget temps
      const elapsed = Date.now() - startTime;
      if (elapsed > TIME_BUDGET_MS) {
        trace.push({ iter: iterations, abort: "time_budget_exceeded", elapsed });
        const partial = data?.content?.filter(c => c.type === "text").map(c => c.text).join("\n") || "";
        return new Response(
          JSON.stringify({
            success: true,
            ...buildTimeoutFallback(agent, partial),
            _meta: { agent, tool_iterations: iterations, trace, version: "v3.2-no-hardcoded-catalog", reason: "time_budget" }
          }),
          { status: 200, headers: HEADERS }
        );
      }

      const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1500,
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

      break;
    }

    // Extraction texte final
    const text = (data?.content || [])
      .filter(c => c.type === "text")
      .map(c => c.text)
      .join("\n");

    let parsed = extractJSON(text);

    // Pas de retry Haiku — fallback direct si JSON invalide (gain de temps)
    if (!parsed) {
      parsed = buildFallbackResponse(agent, text);
    }

    // Garantir actions par défaut
    if (!parsed.actions || !Array.isArray(parsed.actions) || parsed.actions.length === 0) {
      parsed.actions = [
        { id: "guide", label: "Guide de pose", icon: "📘", enabled: parsed.produits_suggeres?.length > 0 },
        { id: "recap", label: "Récap PDF", icon: "📋", enabled: conversation.length >= 4 },
        { id: "devis", label: "Devis FAIREKO", icon: "💰", enabled: parsed.produits_suggeres?.length > 0 },
        { id: "expert", label: "Appeler un expert", icon: "📞", enabled: true }
      ];
    }

    if (!parsed.quick_options) parsed.quick_options = [];
    if (!parsed.quick_options_question) parsed.quick_options_question = "";
    if (!parsed.profil_detecte) parsed.profil_detecte = "inconnu";
    if (!parsed.agent) parsed.agent = agent;

    return new Response(
      JSON.stringify({
        success: true,
        ...parsed,
        _meta: {
          agent,
          tool_iterations: iterations,
          trace,
          elapsed_ms: Date.now() - startTime,
          version: "v3.2-no-hardcoded-catalog"
        }
      }),
      { status: 200, headers: HEADERS }
    );

  } catch (err) {
    const elapsed = Date.now() - startTime;
    return new Response(
      JSON.stringify({
        error: "Server crash",
        detail: err.message,
        elapsed_ms: elapsed
      }),
      { status: 500, headers: HEADERS }
    );
  }
}
