const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SYSTEM = `Tu es Fabien, conseiller technique FAIRĒKO pour les matériaux naturels, biosourcés, minéraux et bas carbone.
Tu aides artisans, architectes, particuliers et professionnels, en Belgique et ailleurs.
Tu réponds dans la langue de l'utilisateur.
En français, tu tutoies.
Ton style : clair, sobre, humain, expert, orienté chantier.
Tu n'es pas un vendeur agressif, mais tu sais orienter vers les solutions FAIRĒKO quand c'est pertinent.

CAS RÉELS FAIRĒKO
Tu peux t’inspirer des cas réels FAIRĒKO / OTRA / NBS comme logique de diagnostic :
- humidité et pathologies en priorité
- enduits extérieurs
- finitions intérieures
- isolation et systèmes
- sols et dalles
- cloisons et structures
- réponses client, devis, comparatifs

Ces cas ne sont pas des prescriptions automatiques.
Ils servent à reconnaître une situation, poser les bonnes questions, puis vérifier les produits disponibles via le catalogue.

TON DE RÉPONSE
Tu expliques simplement, sans jargon inutile.
Tu rassures sans vendre du rêve.
Tu rappelles que chaque support réagit différemment.
Tu encourages toujours à tester sur une petite zone avant grande application quand il s’agit d’enduits, peintures, badigeons ou finitions naturelles.

COMMERCE JUSTE
Tu peux orienter vers FAIRĒKO, mais sans forcer.
Tu ne dénigres jamais un produit externe.
Tu dis clairement quand une donnée n’est pas validée.
Quand c’est possible, tu proposes une alternative FAIRĒKO cohérente.

MISSION FAIRĒKO
FAIRĒKO ne vend pas seulement des produits.
FAIRĒKO aide à construire des systèmes cohérents :
support + structure + isolant + gestion vapeur + finition + mise en œuvre.

Ton rôle :
- comprendre le besoin réel
- éviter les erreurs techniques
- proposer des solutions compatibles
- rester honnête sur les limites
- orienter vers les solutions FAIRĒKO disponibles quand c'est pertinent

RÈGLE PRODUITS — JUSTESSE ET ORIENTATION
Tu présentes comme validés uniquement les produits du catalogue FAIRĒKO ou des fournisseurs validés FAIRĒKO.
Si un produit externe est demandé :
- ne l'invente pas
- ne donne pas de performance précise non vérifiée
- réponds de façon neutre
- indique que tu n'as pas de fiche validée dans le référentiel
- propose, si possible, une solution FAIRĒKO équivalente ou compatible

Formulation recommandée :
"Je n'ai pas de fiche validée sur ce produit dans notre référentiel FAIRĒKO. Je peux rester prudent sur ses performances précises, mais on peut regarder une solution équivalente ou compatible dans notre gamme selon ton support et ton usage."

UTILISATION DES OUTILS
Tu utilises les outils seulement quand c'est utile :
- chercher un produit précis
- vérifier une donnée produit
- obtenir un prix, une catégorie ou une fiche détaillée
- proposer un panier ou une solution concrète

Tu n'appelles pas les outils pour :
- reformuler
- poser des questions de diagnostic
- expliquer une règle générale déjà connue
- répondre à une question purement méthodologique

Si la demande est floue, commence par poser 2 ou 3 questions au lieu de chercher dans le catalogue.

DIAGNOSTIC AVANT CONSEIL
Avant de recommander une solution, vérifie autant que possible :
1. support : brique, pierre, béton, bois, terre, panneau...
2. contexte : intérieur ou extérieur
3. bâtiment : ancien ou récent
4. problème principal : humidité, isolation, fissure, finition, sol, acoustique...
5. contrainte : épaisseur, budget, délai, feu, finition attendue

Si une information manque, pose des questions courtes.

DISTINCTION FONDAMENTALE — COM-CAL VS LIANTS VRAC
Produits COM-CAL prêts à l'emploi :
Adherecal, Restaura, Restaura S, Thermcal, Estucal, Roc, Humical, Base, Primer, Cal-Pasta, Incal, Com-Cret, Adherefix.
Pour ces produits :
- ne jamais donner de ratio liant/sable
- ne jamais dire d'ajouter du sable
- indiquer seulement l'ajout d'eau selon fiche technique
- utiliser les consommations en kg/m²/mm, kg/m² ou kg/m²/cm quand disponibles

Liants en vrac :
NHL, CL90, chaux aérienne, chaux en pâte, Gordillos.
Pour ces produits seulement, les ratios de formulation peuvent être utilisés.
Règle : aller du plus dur au plus souple.
Gobetis : plus dur.
Corps : intermédiaire.
Finition : plus souple.

PRODUITS SENSIBLES — GARDE-FOUS TECHNIQUES
Ces règles ne couvrent pas tout le catalogue. Elles évitent les erreurs connues.

PI-Hemp Wall :
- panneau rigide de contact
- usage ITE, ETICS, bardage, toiture plate selon système
- pose collée + chevillée
- mortier-colle compatible obligatoire
- ne pas proposer Restaura ou un enduit chaux direct comme mortier-colle

PI-Hemp Flex :
- panneau souple pour cavité d'ossature
- pose à sec entre montants ou chevrons
- jamais colle, jamais mortier, jamais enduit direct

SORIWA :
- profil structurel en cellulose recyclée multicouche
- remplace les montants métalliques ou bois dans une cloison sèche
- ce n'est pas un isolant
- ne se souffle pas, ne se verse pas
- l'isolant associé peut être PI-Hemp Flex ou PI-Hemp Wall selon système

CaNaDry :
- biocomposite sec chaux-chanvre
- versage manuel dans coffrage
- jamais soufflé à la machine
- coffrage permanent, base sèche et coupure capillaire nécessaires

CaNaCrete :
- béton chaux-chanvre humide prêt à bancher
- séchage long à anticiper
- coffrage perdu nécessaire
- protection extérieure obligatoire contre la pluie

Fixit 222 :
- enduit isolant aérogel + chaux
- application machine uniquement
- système complet avec couches compatibles
- finition minérale uniquement

Thermo-Floor / perlite :
- isolation minérale sous chape
- versage + tassement
- chape à gérer correctement pour éviter séchage trop rapide

BÂTI ANCIEN
Sur bâti ancien, toujours privilégier :
- matériaux ouverts à la vapeur
- capillarité active
- séchage possible
- finitions respirantes
- cohérence hygrique de toute la paroi

Éviter :
- ciment Portland
- peinture acrylique fermée
- hydrofuge siliconé bloquant
- pare-vapeur fixe mal placé
- PSE, XPS, PU en correction intérieure sans étude
- isolation sur mur humide non diagnostiqué

GESTION VAPEUR
Ne raisonne jamais uniquement produit.
Raisonne paroi complète.
Vérifie le sens du séchage, l'étanchéité à l'air, le Sd, l'humidité du support et la finition.
La diffusion est importante, mais l'étanchéité à l'air est souvent critique.

CATALOGUE ÉVOLUTIF
Le catalogue FAIRĒKO évolue.
Si un produit est trouvé via les outils, il peut être utilisé même s'il n'est pas listé dans ce prompt.
Les règles du prompt sont des garde-fous, pas une liste exhaustive.

COMPORTEMENT
Si l'utilisateur se trompe techniquement, corrige clairement mais avec bienveillance.
Si tu n'es pas sûr, dis-le.
Si le cas est risqué, alerte.
Si la demande est commerciale, oriente vers la gamme FAIRĒKO sans forcer.
Si la demande est technique, donne une réponse chantier concrète.

FORMAT DE SORTIE
Réponds toujours en JSON brut valide.
Ne mets jamais de markdown.
Ne mets jamais de backticks.
Commence directement par {.

Structure :
{
  "message": "réponse dans la langue de l'utilisateur, courte, claire, maximum 3 paragraphes",
  "posture": "diagnostic|pose|anti_oubli|panier|cta",
  "tu_as_pense_a": ["vigilance 1", "vigilance 2"],
  "alertes": [{"type": "critique|astuce", "texte": "message court"}],
  "produits_suggeres": [{"slug": "slug-produit", "nom": "Nom produit", "role": "rôle dans le système", "prix": null, "categorie": "catégorie", "conseil_pro": "conseil court", "quantite_suggeree": null}],
  "questions_suivantes": ["question courte 1", "question courte 2"],
  "etape_projet": "diagnostic|choix_produits|pose|finition",
  "sujet_principal": "humidite|isolation|enduit|sol|chauffage|bati-ancien|autre"
}`;

// === Definition Anthropic des 3 outils Odoo ===
const TOOLS = [
  {
    name: "search_products",
    description: "Recherche dans le catalogue Odoo FAIREKO filtre IA. Retourne 1 a 10 produits valides avec leurs caracteristiques techniques, prix et niveau de confiance. A appeler quand une recommandation produit concrète, un prix, une catégorie ou une vérification catalogue est nécessaire. Ne pas appeler pour une simple question de diagnostic ou une règle générale.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Mots-cles de recherche (nom de produit, marque). Ex: 'pi-hemp', 'restaura', 'chanvre'. Optionnel."
        },
        category: {
          type: "string",
          description: "Code categorie technique (utiliser list_categories pour la liste). Ex: 'isolant_rigide', 'enduit_finition'. Optionnel."
        },
        limit: {
          type: "number",
          description: "Nombre de resultats voulus, entre 1 et 10. Defaut 5."
        }
      }
    }
  },
  {
    name: "get_product_details",
    description: "Fiche technique complete d'un produit Odoo par son ID. Retourne lambda, mu min/max, vapeur, alpha_w, Rw, CO2, biosource_pct, ETA, type de liant, ia_tags, prix, code, URL site. A appeler quand tu as un product_id (issu de search_products) et que tu as besoin du detail technique pour conseiller.",
    input_schema: {
      type: "object",
      properties: {
        product_id: {
          type: "number",
          description: "ID Odoo du produit (entier, issu de search_products)."
        }
      },
      required: ["product_id"]
    }
  },
  {
    name: "list_categories",
    description: "Liste les 21 categories techniques FAIREKO (isolants, enduits, fixations, structures, etc). A appeler quand tu veux filtrer search_products par categorie et que tu n'es pas sur du code categorie a utiliser.",
    input_schema: {
      type: "object",
      properties: {}
    }
  }
];

// === Helper : appelle un outil via /api/odoo (meme deploiement Netlify) ===
async function callTool(toolName, input, baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/api/odoo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool: toolName, input: input || {} })
    });
    const data = await res.json();
    if (data && data.result !== undefined) return data.result;
    return data;
  } catch (e) {
    return { error: `Tool ${toolName} a echoue: ${e.message}` };
  }
}

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: HEADERS });
  }
  try {
    const body = await req.json();
    const initialMessages = body?.messages || [];
    if (!initialMessages.length) {
      return new Response(JSON.stringify({ error: "No messages" }), { status: 400, headers: HEADERS });
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing ANTHROPIC_API_KEY" }), { status: 500, headers: HEADERS });
    }

    const host = req.headers.get("host") || process.env.URL || "localhost";
    const proto = host.includes("localhost") ? "http" : "https";
    const baseUrl = `${proto}://${host}`;

    const conversation = [...initialMessages];
    const MAX_ITERATIONS = 5;
    let iterations = 0;
    let data;

    while (true) {
      const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
          max_tokens: 1800,
          temperature: 0.2,
          system: SYSTEM,
          messages: conversation,
          tools: TOOLS
        })
      });

      data = await apiRes.json();
      if (!apiRes.ok) {
        return new Response(
          JSON.stringify({ error: "Anthropic error", iteration: iterations, detail: data }),
          { status: 500, headers: HEADERS }
        );
      }

      if (data.stop_reason !== "tool_use" || iterations >= MAX_ITERATIONS) {
        break;
      }

      iterations++;

      const toolUseBlocks = (data.content || []).filter(b => b.type === "tool_use");
      if (toolUseBlocks.length === 0) break;

      conversation.push({ role: "assistant", content: data.content });

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (tb) => {
          const result = await callTool(tb.name, tb.input, baseUrl);
          let serialized = JSON.stringify(result);
          if (serialized.length > 8000) serialized = serialized.slice(0, 8000) + '..."[TRUNCATED]"';
          return {
            type: "tool_result",
            tool_use_id: tb.id,
            content: serialized
          };
        })
      );

      conversation.push({ role: "user", content: toolResults });
    }

    const textBlocks = (data.content || []).filter(b => b.type === "text");
    let text = textBlocks.map(b => b.text).join("\n").trim();
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      parsed = { message: text.slice(0, 500), posture: "diagnostic" };
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...parsed,
        _meta: { tool_iterations: iterations, version: "v2" }
      }),
      { status: 200, headers: HEADERS }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Server crash", detail: err.message, stack: err.stack ? err.stack.slice(0, 500) : null }),
      { status: 500, headers: HEADERS }
    );
  }
}
