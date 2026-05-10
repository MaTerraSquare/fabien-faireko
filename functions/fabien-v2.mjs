const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SYSTEM = `Tu es Fabien, conseiller technique FAIRĒKO. Chef de chantier wallon : direct, concret, naturel. Tu tutoies, tu parles français.

═══════════════════════════════════════════════════════════════
🚨 RÈGLE PRIORITAIRE — ORIENTER D'ABORD (V3.8)
═══════════════════════════════════════════════════════════════

Tu aides d'abord, tu affines ensuite. TOUJOURS.

Même si la question est vague, tu donnes :
✅ Une orientation utile en 3-5 lignes
✅ 2 à 4 produits FAIRĒKO probables (par nom + id)
✅ La logique chantier en quelques mots
✅ UNE seule question de cadrage à la fin (via quick_options 2-4 options)

❌ INTERDITS FORMELS :
- Répondre uniquement par des questions
- Refuser d'orienter sous prétexte "manque de contexte"
- Renvoyer "Reformule ta question"

EXEMPLE — Question : "j'utilise quoi comme enduit à l'extérieur ?"
✅ "Sur façade ext FAIRĒKO on travaille 3 enduits chaux :
   - RESTAURA NHL 3,5 (id 759) → brique ancienne, supports souples
   - BASE NHL 5 (id 761) → pierre dure, béton
   - ADHERECAL NHL 5 (id 762) → système ETICS isolant
   Le bon choix dépend du support. Ton mur c'est plutôt :
   [Brique ancienne] [Pierre dure] [Bloc moderne] [ETICS isolant]"

═══════════════════════════════════════════════════════════════
🧭 SÉQUENCE 4 PHASES (cadrage de réponse, pas obligatoire à chaque fois)
═══════════════════════════════════════════════════════════════

Pour TOUTE question (mur, toiture, sol, cloison, acoustique, finition, traitement
humidité, restauration, neuf), tu raisonnes en 4 temps :

1. DIAGNOSTIC (léger, JAMAIS bloquant) — état support + contraintes,
   1 question simple à la fin si besoin (jamais 3+).
2. SOLUTIONS / APPROCHES — MIN 3 options distinctes avec arbitrages
   (épaisseur / inertie / coût / esthétique / faux-aplomb).
   JAMAIS un seul "complexe type". Voir doctrine #390.
3. MISE EN ŒUVRE — ordre couches, formules, règle dureté décroissante,
   quantités via calculate_quantity (JAMAIS calculer mentalement).
4. PROTECTION / SUIVI — cire CERA / Pintura / hydrofuge / savon ferré,
   conseils durabilité, CTA panier / build_quote / expert.

Sauter des phases si non pertinent (ex: "où trouver X" → réponse courte).

═══════════════════════════════════════════════════════════════
🔧 OUTILS — WORKFLOW
═══════════════════════════════════════════════════════════════

Pour chaque question technique :
1. search_doctrine en PREMIER (mot-clé COURT : "gobetis", "RESTAURA", "ITI",
   "humidite", "chanvre", "PI-HEMP", "IsoHemp", "patrimoine", etc.)
2. search_products (V3 multi-mots OK : "EXIE chanvre", "pavatex toiture")
3. get_product_details si produit précis identifié → CHAMPS NATIFS
   (λ, μ, Rw, ETA, prix list_price) à utiliser, JAMAIS inventer
4. calculate_quantity pour TOUT calcul (surface, palettes, prix total)
5. build_quote pour devis structuré (prix réels Odoo + TVA + total TTC)
6. Réponse JSON finale formatée

🚨 JAMAIS calculer mentalement. JAMAIS inventer λ/μ/Rw. JAMAIS halluciner un prix.

═══════════════════════════════════════════════════════════════
📋 RÈGLES TECHNIQUES NON-NÉGOCIABLES (ultra-compact)
═══════════════════════════════════════════════════════════════

🏗️ ENDUITS CHAUX EXT
- Gobetis NHL 5 + sable 0/5 (1:1) → couche dure d'accroche
- Corps : RESTAURA NHL 3,5 (15 kg/m² par cm) → souple, perspirant
- Finition : RESTAURA S NHL 3,5 → la plus tendre
- Règle dureté décroissante : gobetis dur > corps > finition tendre
- Pierre dure / béton : BASE NHL 5 (id 761)
- Brique ancienne / supports souples : RESTAURA NHL 3,5 (id 759)
- Torchis : CL 90-SP (id 768)

📦 ETICS / SYSTÈME COMCAL THERMWOOD
- ADHERECAL NHL 5 (id 762) = collage + base coat
- Fibre bois EN 13171 (Pavatex) + treillis 160g/m² + chevilles
- ETA 25/1081 / EAD 040083-01-0404
- Finition ETA stricte : Pintura de Cal CL90 OU Lime Wash UNIQUEMENT

🌿 ITI BIOSOURCÉ — 4 familles à connaître
- Soriwa profil + PI-HEMP Flex + Schleusner Hempleem + Recoma
- Bloc IsoHemp PAL + remplissage vrac CaNaDry EXIE + RESTAURA
- Bloc IsoHemp PAL seul collé + finition argile/stuc
- THERMCAL chaux-liège 4-8 cm + Pintura (correction mince <8 cm)
- Sur fibre bois ou PI-HEMP semi-rigide INT : primer Gordillos Pegamento Bio
- Pas de pare-vapeur fermé sur bâti ancien perspirant
- Frein-vapeur hygrovariable Ampatex Variano côté chaud

🏠 TOITURE BIOSOURCÉE
- Sarking : PAVAROOF R sur chevrons + lattage ventilé 38 mm min
- Entre + sur chevrons : PAVAFLEX entre + PAVATHERM par-dessus
- Sous-toiture : ISOLAIR MULTI + frein-vapeur Ampatex Variano

💧 TRAITEMENT HUMIDITÉ
- Capillaire : Lime Injection Gordillos (id 1895) — coulis injection structurel
- Mur très humide : Mortero Cal Drenante Gordillos (id 1894)
- Sels : décapage + repos 2-3 sem + RESTAURA + Pintura de Cal
- Surface : HUMICAL en enduit assainissement (15-25 mm corps)

🎨 FINITIONS SEULES (mur prêt)
- Chaux : RESTAURA S, Pintura de Cal, LimeWash (id 9276), Jabelga (id 1998)
- Argile : Hins, Leem, Argideco
- Stuc : Stuc & Staff, ESTUCAL Com-Cal (id 767), Calcita Gordillos
- Cal en Pasta Envejecida CL 90 SPL (id 9471) — pâte vieillie haut de gamme

🛡️ PROTECTIONS
- CERA NATURAL Com-Cal : zones tactiles, SDB
- Pintura de Cal : protection lavable ext
- Hydrofuge minéral : façades très exposées
- Savon de Marseille : stuc ferré SDB (résistance accrue)

═══════════════════════════════════════════════════════════════
🚫 INTERDICTIONS ABSOLUES
═══════════════════════════════════════════════════════════════

- JAMAIS Naturwerk, NW-Paneel, Ecoinsul → toujours "PI-HEMP de Pioneer-Hemp™ Systems"
- JAMAIS Knauf, Isover, Recticel, URSA, Rockwool (non distribués)
- JAMAIS PI-HEMP par défaut systématique (proposer aussi IsoHemp, EXIE, THERMCAL)
- JAMAIS un seul "complexe figé" en réponse → toujours min 3 options
- IsoHemp = blocs MAÇONNÉS (mortier-colle MC), PI-HEMP = panneaux SEMI-RIGIDES
- ESTUCAL = COMCAL (pas Gordillos)
- CaNaDry = MAIN/coffrage, EXIE Fibres = MACHINE soufflante (gammes différentes)

═══════════════════════════════════════════════════════════════
📋 FORMAT JSON DE SORTIE (obligatoire, JSON pur sans markdown)
═══════════════════════════════════════════════════════════════

{
  "message": "Cadrage 3-5 lignes prose chef de chantier + produits + 1 question",
  "posture": "diagnostic|conseil|alerte|pose",
  "systeme": {
    "support": "ex: brique ancienne XIXe",
    "logique": "enduit_traditionnel|etics|assainissement|iti_biosource|patrimoine|stucs_deco|toiture_biosource|sol|cloison|acoustique|finition_seule",
    "couches": [
      {"ordre": 1, "role": "Gobetis", "products": [{"id": 764, "name": "...", "conso_value": 5, "conso_unit": "kg/m²"}], "note": "..."}
    ]
  },
  "produits_suggeres": [{"id": 759, "name": "RESTAURA NHL 3,5"}],
  "quick_options": [{"label": "Brique ancienne", "value": "brique", "icon": "🧱"}],
  "quick_options_question": "Quelle nature de support ?",
  "actions": [
    {"id": "guide", "label": "Guide de mise en œuvre", "icon": "📘", "enabled": true},
    {"id": "recap", "label": "Récapitulatif", "icon": "📋", "enabled": true},
    {"id": "panier", "label": "Panier", "icon": "🛒", "enabled": true},
    {"id": "expert", "label": "Appeler un expert", "icon": "📞", "enabled": true}
  ],
  "etape_projet": "diagnostic|choix_produits|pose|finition",
  "sujet_principal": "humidite|isolation|enduit|toiture|sol|stucs|patrimoine|autre"
}

RÈGLES JSON :
- 0 à 9 quick_options selon pertinence
- 4 actions toujours présentes
- icon = emoji unicode
- JSON pur, pas de triple-backticks markdown autour

Pour la doctrine détaillée → search_doctrine. Pour les cas chantier réels → search_doctrine "cas chantier".
Doctrine cadre des 4 phases : article #390.
`;


const TOOLS = [
  {
    name: "search_doctrine",
    description: "Recherche dans la base technique FAIRĒKO Knowledge Odoo (systèmes constructifs, règles non-négociables, principes, arbres de décision, doctrine ENDUITS bâti ancien, ITI biosourcé, cas chantiers terrain Wallonie/Bruxelles, pathologies). À UTILISER EN PREMIER. UN SEUL mot-clé court (ex: 'gobetis', 'RESTAURA', 'ADHERECAL', 'HUMICAL', 'sels', 'chanvre', 'cas chantier', 'PI-HEMP', 'SCHLEUSNER', 'IsoHemp', 'argile', 'patrimoine', 'toiture', 'Fermacell').",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "UN SEUL mot-clé court. JAMAIS de phrase." },
        limit: { type: "number", description: "Nombre max d'articles (défaut 3, max 5)" }
      },
      required: ["query"]
    }
  },
  {
    name: "search_products",
    description: "Recherche dans le catalogue FAIRĒKO. À utiliser APRÈS search_doctrine. V3 : la query peut contenir 2-5 mots-clés (ex: 'EXIE chanvre', 'PI-HEMP wall 100', 'pavatex toiture'). Tous les mots doivent matcher (AND), les stop-words sont ignorés.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "1 à 5 mots-clés produit (ex: 'EXIE chanvre', 'pavatex toiture')" },
        category: { type: "string", description: "Catégorie technique optionnelle" },
        limit: { type: "number", description: "Nombre max (défaut 5, max 10)" }
      }
    }
  },
  {
    name: "get_product_details",
    description: "Fiche technique complète d'un produit. Renvoie tous les champs natifs Odoo (λ, μ, Rw, ETA, prix, conditionnement, etc.) — utilise CES champs structurés pour répondre, pas le résumé pdf qui peut être incomplet.",
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
    description: "Liste les 21 catégories techniques FAIRĒKO.",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "calculate_quantity",
    description: "🚨 OUTIL OBLIGATOIRE pour TOUT calcul de quantité chantier. NE JAMAIS calculer mentalement (surface × consommation, volumes, palettes, prix totaux). Tu appelles toujours cet outil. Renvoie quantité juste, nombre de palettes optimisé, sous-total HT.",
    input_schema: {
      type: "object",
      properties: {
        surface_m2: { type: "number", description: "Surface du chantier en m² (obligatoire)" },
        epaisseur_cm: { type: "number", description: "Épaisseur en cm pour produits volumiques (CaNaDry, vrac)" },
        couches: { type: "number", description: "Nombre de couches (défaut 1)" },
        coverage_unit: { type: "string", description: "'m2' (couvrance par unité), 'm3' (volumique), 'kg' (pondéral)" },
        coverage_per_unit: { type: "number", description: "Couverture par unité (ex CaNaDry sac 55L = 0.055 m³, sac 25kg → 25)" },
        consommation_per_m2: { type: "number", description: "Consommation kg/m² pour produits pondéraux (ex RESTAURA = 15 kg/m² par cm)" },
        unit_price: { type: "number", description: "Prix HT par unité (depuis get_product_details.list_price)" },
        unit_label: { type: "string", description: "Étiquette unité ('sac', 'rouleau', 'palette', 'panneau')" },
        palette_qty: { type: "number", description: "Nb d'unités par palette si applicable (ex CaNaDry = 40 sacs/palette)" }
      },
      required: ["surface_m2", "unit_price", "coverage_unit"]
    }
  },
  {
    name: "build_quote",
    description: "🚨 OUTIL OBLIGATOIRE pour générer un devis. JAMAIS rédiger un devis avec des prix mentalement — toujours appeler cet outil qui va chercher les VRAIS prix Odoo et calcule TVA 21% + total TTC. Renvoie un JSON propre que tu formates joliment dans ton message.",
    input_schema: {
      type: "object",
      properties: {
        client_ref: { type: "string", description: "Référence courte du devis (ex: 'ITI 100m² bâti ancien')" },
        lines: {
          type: "array",
          description: "Lignes du devis. Chaque ligne contient product_id (ID Odoo), quantity (déjà calculée via calculate_quantity de préférence), unit_label, note optionnelle.",
          items: {
            type: "object",
            properties: {
              product_id: { type: "number" },
              quantity: { type: "number" },
              unit_label: { type: "string" },
              note: { type: "string" }
            },
            required: ["product_id", "quantity"]
          }
        }
      },
      required: ["lines"]
    }
  }
];


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
    const MAX_ITERATIONS = 3;
    let data;
    const trace = [];

    while (true) {
      const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          // HYBRIDE Anthropic : tour principal en Sonnet 4.6 pour la qualité de prescription
          // (suivi de règles longues, enchaînement multi-tools, démêlage cas ambigus)
          // V3.6 : max_tokens augmenté à 4096 — le JSON de sortie complet (systeme + couches +
          // produits + 9 quick_options + actions + posture) faisait régulièrement >2000 tokens
          // et Sonnet tronquait au milieu, faisant planter extractJSON → message "reformule".
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
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

    const text = (data?.content || [])
      .filter(c => c.type === "text")
      .map(c => c.text)
      .join("\n");

    let parsed = extractJSON(text);

    if (!parsed && text && text.length > 0) {
      trace.push({ iter: "retry", reason: "no_valid_json", text_preview: text.substring(0, 200) });
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
            // HYBRIDE Anthropic : tour de retry/reformulation JSON en Haiku 4.5
            // (tâche basique de reformatage, rapide et économique, ~5× moins cher que Sonnet)
            // V3.6 : max_tokens 4096 pour ne plus tronquer le JSON de sortie complet
            model: "claude-haiku-4-5-20251001",
            max_tokens: 4096,
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

    if (!parsed) {
      // V3.6 — Fallback robuste : on essaie de récupérer le maximum d'info même si JSON cassé
      // Cas typique : Sonnet a tronqué au milieu d'un champ → on extrait au moins "message"
      let fallback_message = "";

      if (text && text.length > 50) {
        // Tentative 1 : nettoyer markdown et essayer de récupérer le message
        const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();

        // Tentative 2 : extraire le champ "message" même si JSON incomplet
        const msgMatch = cleaned.match(/"message"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
        if (msgMatch && msgMatch[1] && msgMatch[1].length > 30) {
          fallback_message = msgMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
        } else if (cleaned.startsWith("{")) {
          // JSON cassé sans message extractible → afficher le brut tronqué
          fallback_message = "Je formule ma réponse mais elle a été tronquée. Voici ce que j'ai pu rédiger :\n\n"
            + cleaned.replace(/^\s*\{[^"]*"[^"]*"\s*:\s*"/, "").substring(0, 800);
        } else {
          // Texte non-JSON (Sonnet a parlé naturellement) → on l'affiche tel quel
          fallback_message = cleaned;
        }
      } else {
        fallback_message = "Je m'oriente. Si tu cherches un enduit chaux extérieur, on travaille surtout RESTAURA NHL 3,5 (id 759) sur brique ancienne, BASE NHL 5 (id 761) sur pierre dure, ou ADHERECAL NHL 5 (id 762) en système ETICS. Si c'est un autre sujet (ITI, toiture, sol, finition, traitement humidité), précise-moi ton ouvrage et l'état du support, je te donne 3-4 options.";
      }

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
        sujet_principal: "autre",
        _debug_fallback: true
      };
    }

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
          version: "v3.8.1-token-budget-fix"
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
