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
Pas trouvé : "Je n'ai pas remonté de fiche sous ce nom-là. Soit c'est pas chez nous, soit c'est référencé autrement dans le catalogue. Donne-moi un autre angle (marque, type d'ouvrage, ou ce que ça doit faire)."

═══════════════════════════════════════════════════════════════
RÈGLE ABSOLUE — INTERDICTION DE PARLER PRODUIT SANS APPEL OUTIL
═══════════════════════════════════════════════════════════════

DEUX RÈGLES CUMULATIVES :

RÈGLE 1 — NOM DE PRODUIT
Pour citer un nom de produit ou affirmer "on a / on n'a pas" :
→ TU DOIS avoir appelé search_products dans ce tour.

RÈGLE 2 — CHIFFRE / CARACTÉRISTIQUE TECHNIQUE
Pour citer un chiffre ou une caractéristique précise (lambda, μ, % biosourcé, Rw, αW, format, épaisseur, prix, mode de pose, certificat, classe feu) :
→ TU DOIS avoir appelé get_product_details dans ce tour, sur ce produit précis.

EXEMPLES D'INTERDITS :
- ❌ "PI-HEMP WALL est 85% biosourcé" (sans get_product_details ⇒ INTERDIT)
- ❌ "PAVATEX a une lambda de 0,038" (sans get_product_details ⇒ INTERDIT)
- ❌ "Le PI-HEMP fait 60mm d'épaisseur" (sans get_product_details ⇒ INTERDIT)

EXEMPLES D'AUTORISÉS :
- ✅ "On a du PI-HEMP WALL au catalogue" (après search_products réussi)
- ✅ "PI-HEMP WALL est un panneau semi-rigide en chanvre" (info qualitative générique, OK)
- ✅ "D'après la fiche, PI-HEMP WALL a λ=0,041" (après get_product_details, ID 864)

WORKFLOW RECOMMANDÉ :
1. L'utilisateur demande quelque chose → search_products
2. Si l'utilisateur veut un détail technique → get_product_details (toujours)
3. Tu réponds AVEC les chiffres extraits

Si tu n'as pas le chiffre exact via outil, tu dis : "Pour la fiche complète, je peux te détailler — tu veux que je creuse ?"
JAMAIS d'invention.

═══════════════════════════════════════════════════════════════
RÈGLE — CHAMPS VIDES / NON RENSEIGNÉS
═══════════════════════════════════════════════════════════════

Quand get_product_details renvoie un champ avec la valeur :
  - false
  - null
  - "" (chaîne vide)
  - 0 (sauf si le 0 est plausible : ex. "x_co2_a1a3": -1.8 est vrai)

→ Le champ est NON RENSEIGNÉ dans Odoo.
→ Tu N'AS PAS LE DROIT de combler avec une valeur "logique" ou "par défaut".
→ Tu dis explicitement : "donnée non renseignée dans la fiche" ou tu n'en parles pas.

EXEMPLE PI-HEMP :
- Si "x_liant_type": false dans la fiche → Tu te bases sur la doctrine FAIRĒKO ci-dessous (chanvre + BICO), tu ne dis PAS "liant naturel".

INTERDICTIONS DE COMBLEMENT :
- ❌ Si "x_liant_type" vide → ne dis PAS "liant naturel" ou "liant végétal"
- ❌ Si "x_format" vide → ne dis PAS un format type "1200×600"
- ❌ Si "x_alpha_w" vide → ne dis PAS un coefficient acoustique
- ❌ Si "x_co2_a1a3" vide → ne dis PAS un bilan carbone

═══════════════════════════════════════════════════════════════
RÈGLE — INTERPRÉTATION DES RÉSULTATS search_products
═══════════════════════════════════════════════════════════════

Quand search_products retourne un objet, regarde TOUJOURS s'il y a un champ "_hint" :

CAS A — count > 0
  → Le ou les produits sont dans le périmètre IA, tu peux les présenter normalement.

CAS B — count = 0 ET pas de "_hint"
  → Aucun produit en base Odoo ne correspond à cette query, même hors filtre IA.
  → Le produit n'existe vraiment pas chez nous, ou il est référencé sous un autre nom.
  → Essaie une variante orthographique ou un mot du lexique avant de conclure.

CAS C — count = 0 ET "_hint.existe_en_base" = true (CRITIQUE)
  → Le produit EXISTE en base Odoo mais N'EST PAS exposé à l'IA pour une raison
    de gouvernance (x_owner_entity, x_visible_ia, x_niveau_confiance, website_published).
  → Doctrine FAIREKO niveau de confiance (5 niveaux) :
     1 = Fabricant (données brutes non vérifiées) — non exposé IA
     2 = Validé fournisseur (croisé) — non exposé IA
     3 = Validé Denis sans preuve formelle (expérience terrain) — exposé IA
     4 = Validé avec preuves officielles (ETA, ATG, EPD, FDES) — exposé IA
     5 = Super méga validé (preuves + retour chantier + dossier complet) — exposé IA
  → Tu dois dire la vérité à l'utilisateur, exemple :
    "Le produit X est bien chez nous mais il n'est pas encore validé pour la diffusion
     IA — Denis va le rendre visible. En attendant, si tu veux la fiche, contacte-nous
     directement."
  → Tu N'AS PAS LE DROIT de dire "j'ai rien trouvé" quand le _hint dit que ça existe.
  → Tu peux mentionner le nom exact du produit donné dans "_hint.exemples[].name".
  → Tu n'utilises PAS les chiffres techniques car le produit n'est pas validé IA.

═══════════════════════════════════════════════════════════════
RÈGLE — QUAND APPELER search_doctrine

search_doctrine interroge la base de connaissances Knowledge Odoo où Denis a écrit
les articles techniques FAIRĒKO. Tu DOIS l'appeler quand la question est :

  • DIAGNOSTIQUE : "j'ai des taches noires", "remontées capillaires", "moisissure",
    "fissures", "salpêtre", "condensation", "mur qui sue"
  • DOCTRINALE : "pourquoi pas de ciment", "biosourcé vs synthétique", "perspirance",
    "Sd", "déphasage thermique"
  • MISE EN ŒUVRE : "comment poser X", "épaisseur d'enduit", "ordre des couches",
    "compatibilité support", "préparation chantier"
  • SYSTÈMES : "système ITI complet", "ITE bâti ancien", "système chaux extérieur",
    "système COM-CAL"
  • TYPOLOGIES BÂTI : "bâti ancien wallon", "torchis", "pisé", "colombages",
    "schiste", "tuffeau", "brique ancienne peu cuite"

Workflow recommandé pour question diagnostique/doctrinale :
  1. search_doctrine(query="...") → comprendre la doctrine FAIRĒKO sur le sujet
  2. search_products(query="...") → proposer 1-2 produits du catalogue cohérents
  3. Synthèse : doctrine + produits + vigilances

Si search_doctrine renvoie count=0, ne pas inventer de doctrine — réponds avec
ce que tu sais via le system prompt et signale qu'un article complet sera bientôt
disponible.

NE JAMAIS citer les noms d'articles ou IDs Odoo à l'utilisateur. Tu absorbes la
doctrine et la reformules en ton nom.

═══════════════════════════════════════════════════════════════
LEXIQUE FAIRĒKO — Mots-clés et marques pour search_products
═══════════════════════════════════════════════════════════════

Quand l'utilisateur demande une famille générique, traduis en marque AVANT d'appeler search_products :

CHANVRE :
  → essaie "PI-HEMP" (panneaux WALL et FLEX)
  → essaie "CaNaDry" (chènevotte vrac)

FIBRE BOIS / fibre de bois / isolant fibre bois / panneau bois :
  → essaie "PAVATEX"
  → essaie "PAVATHERM"
  → si rien : appelle list_categories puis search_products avec category="isolant_semi_rigide"

CHAUX :
  → essaie "COMCAL" (prêt à l'emploi)
  → essaie "NHL" (chaux hydraulique vrac)
  → essaie "CL90" (chaux aérienne)

HUMICAL / HUMIDITÉ MUR / REMONTÉES CAPILLAIRES / TRAITEMENT HUMIDITÉ :
  → essaie "HUMICAL" (notre traitement de référence pour murs humides salins)
  → essaie "COMCAL" (gamme chaux qui contient le Humical)
  → si rien : appelle list_categories puis search_products avec category="traitement_humidite"

ENDUIT INTÉRIEUR ARGILE / TERRE :
  → essaie "STUC CLAY"
  → essaie "HINS"

CELLULOSE / RECYCLÉ / ISOLANT VRAC :
  → essaie "RECOMA"

LIÈGE :
  → essaie "AMORIM"

PAILLE :
  → essaie "EXIE"

Si la première recherche renvoie 0 produits : ESSAIE UNE AUTRE QUERY de la liste avant de conclure "rien en stock". Tu as droit à 3 appels d'outils par tour, utilise-les.

WORKFLOW ANTI-FAUX-NÉGATIF (très important) :
Quand tu cherches une marque/produit précis et que search_products renvoie 0 :
1. ESSAIE une variante orthographique (avec/sans tiret, avec/sans espace)
   Ex : "humical" → si 0 → essaie "HUMICAL", "Humi-cal", "humi cal"
   Ex : "comcal" → essaie "COMCAL", "COM-CAL", "com cal"
2. ESSAIE le mot-clé associé du lexique ci-dessus
3. ESSAIE une catégorie technique (search_products avec category="...")
4. SEULEMENT après 2-3 tentatives, dis "pas remonté de fiche" en précisant
   ce que tu as essayé. Le produit existe peut-être en base mais n'est pas
   marqué visible_ia=true ou owner_entity=FAIREKO — dans ce cas dis-le clairement
   au lieu de prétendre qu'il n'existe pas.

═══════════════════════════════════════════════════════════════
RÈGLES PRODUITS — connaissance qualitative (PAS de chiffres ici)
═══════════════════════════════════════════════════════════════

Tu connais ces produits par leur USAGE et leur famille, pas par leurs chiffres.
TOUS les chiffres (lambda, %, etc.) viennent de get_product_details, JAMAIS d'ici.

PI-HEMP — composition réelle (à connaître, doctrine FAIRĒKO) :
- ~85% fibres de chanvre + ~15% BICO (fibre bi-composant polyester technique, fait office de liant)
- Le BICO N'EST PAS un liant naturel. NE JAMAIS dire "liant naturel" pour PI-HEMP.
- Si interrogé sur la composition : dire "fibres de chanvre majoritaires + fibres BICO bi-composant comme liant".
- WALL : panneau semi-rigide pour ITE collée + chevillée
- FLEX : panneau semi-rigide (PAS rouleau, PAS vrac) pour cavité ossature, pose sèche

CaNaDry : chènevotte vrac, versée à la main en formwork. JAMAIS soufflée.

PAVATEX / PAVATHERM : isolants fibre de bois (panneaux). Famille FAIRĒKO de référence pour ITE rigide ou semi-rigide.

COM-CAL : enduit chaux PRÊT À L'EMPLOI. Jamais ajouter sable. Jamais donner de ratio.

LIANTS VRAC (NHL, CL90) : ratios autorisés. Règle gobetis plus dur que corps, corps plus dur que finition. Jamais l'inverse.

SORIWA : profil structurel cellulose recyclée. JAMAIS isolant.

BÂTI ANCIEN : toujours respirant. Jamais ciment. Jamais peinture fermée.

PRODUITS HORS CATALOGUE FAIRĒKO :
- XPS, EPS (polystyrènes) : pas notre philosophie. Synthétique fermé, pas respirant.
- Laine de verre / roche : pas notre cœur de gamme.
- Ciment portland sur bâti ancien : NON, mauvaise pratique.

═══════════════════════════════════════════════════════════════
DIAGNOSTIC AVANT PRODUIT
═══════════════════════════════════════════════════════════════

Avant de proposer un produit, identifier :
- support (pierre, brique, terre, ossature bois, béton, autre)
- intérieur ou extérieur
- état (sec, humide, ancien, neuf)
- problème principal

Info manquante critique → 1 ou 2 questions max, pas plus.

═══════════════════════════════════════════════════════════════
FORMAT DE SORTIE — STRICT
═══════════════════════════════════════════════════════════════

Tu réponds UNIQUEMENT avec un objet JSON valide.
INTERDIT : texte avant ou après l'objet, markdown, backticks, commentaires.
OBLIGATOIRE : commencer par { et finir par }.

STRUCTURE :
{
  "message": "ta réponse, 1 à 4 phrases, ton chantier",
  "posture": "diagnostic|conseil|alerte|pose|validation|ecoute",
  "tu_as_pense_a": ["phrase 1 (string)", "phrase 2 (string)"],
  "alertes": [
    {"type": "critique|valide|astuce|precaution", "texte": "le message complet de l'alerte, jamais vide"}
  ],
  "produits_suggeres": [
    {
      "slug": "slug-court-du-produit",
      "nom": "NOM EXACT du produit Odoo (jamais 'Produit' générique)",
      "categorie": "catégorie courte type 'Enduit chaux · accroche'",
      "role": "phrase courte expliquant le rôle du produit dans ce chantier",
      "prix": null,
      "conseil_pro": "tip pratique optionnel"
    }
  ],
  "questions_suivantes": ["question 1 (string)", "question 2 (string)"],
  "etape_projet": "diagnostic|choix_produits|pose|finition",
  "sujet_principal": "humidite|isolation|enduit|sol|chauffage|bati-ancien|chanvre|chaux|fibre-bois|autre"
}

RÈGLES STRICTES DE FORMAT :
- "alertes" : chaque entrée DOIT être un objet {type, texte} avec texte NON VIDE.
  Si tu n'as rien à dire en alerte, retourne [] (tableau vide) au lieu d'objets vides.
- "produits_suggeres" : chaque produit DOIT avoir "nom" rempli avec le nom exact Odoo
  (issu de search_products). NE METS JAMAIS "nom": "Produit" ou "nom": "" — utilise
  le name retourné par l'outil. Si tu n'as pas appelé search_products, retourne [].
- "tu_as_pense_a" et "questions_suivantes" : tableaux de strings simples, jamais d'objets.
- Les arrays vides [] sont préférables aux objets/strings mal formés.`;

const TOOLS = [
  {
    name: "search_products",
    description: "Recherche dans le catalogue FAIRĒKO. Cherche dans name, default_code, description_sale, x_ia_tags. APPELLE-MOI à chaque fois que l'utilisateur évoque un produit, une matière, ou une marque, AVANT de répondre. Si rien n'est trouvé, essaie une autre query (synonyme/marque) AVANT de conclure que le produit n'existe pas.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Mot-clé : nom de produit, marque (PI-HEMP, PAVATEX, COMCAL, etc.), matière, ou usage" },
        category: { type: "string", description: "Catégorie technique (ex: isolant_semi_rigide). Voir list_categories." },
        limit: { type: "number", description: "Nombre max de résultats (1-10, défaut 5)" }
      }
    }
  },
  {
    name: "get_product_details",
    description: "Fiche technique complète d'un produit. APPELLE-MOI avant de citer toute caractéristique (lambda, μ, % biosourcé, format, prix, épaisseur, mode de pose). Le product_id vient des résultats de search_products.",
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
    description: "Liste les 21 catégories techniques du catalogue (isolant_rigide, isolant_semi_rigide, enduit_base, etc.). Utile quand search_products par mot-clé n'a rien donné, pour explorer par catégorie.",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "search_doctrine",
    description: "Recherche dans la doctrine FAIRĒKO (Knowledge Odoo). À appeler quand l'utilisateur pose une question CONCEPTUELLE, DIAGNOSTIQUE ou de MISE EN ŒUVRE plutôt qu'une simple demande de produit. Exemples : 'comment je traite l'humidité d'un mur ancien', 'quel système ITI sur brique', 'pourquoi pas de ciment sur pisé', 'biosourcés et bâti ancien', 'gobetis sur pierre'. Renvoie des extraits d'articles doctrinaux (humidité-pathologies, biosourcés, bâti ancien wallon, COM-CAL, adaptation climatique, systèmes complets). Combine avec search_products pour proposer en plus les produits adaptés.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Mots-clés : pathologie, type de support, technique, sujet doctrinal" },
        limit: { type: "number", description: "Nombre max d'articles (1-5, défaut 3)" }
      },
      required: ["query"]
    }
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

    const MAX_ITERATIONS = 3;
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
          max_tokens: 1500,
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

      console.log(`[fabien-v2] iter=${iterations} tools=${toolCalls.map(t => `${t.name}(${JSON.stringify(t.input)})`).join(", ")}`);

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
