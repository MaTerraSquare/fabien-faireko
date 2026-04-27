/**
 * =============================================================================
 * FAIRĒKO · Proxy Odoo pour Fabien-IA
 * =============================================================================
 *
 * Fichier    : netlify/functions/odoo-proxy.mjs
 * Route      : /api/odoo  (voir netlify.toml)
 * Version    : 1.0  —  22 avril 2026
 *
 * Rôle
 * ----
 * Ce proxy expose 3 outils à Claude Haiku (côté fabien.html) pour qu'il puisse
 * interroger le catalogue Odoo FAIREKO en temps réel, au lieu de s'appuyer
 * uniquement sur le corpus statique de son system prompt.
 *
 * Outils exposés
 * --------------
 *   1. search_products       — recherche dans le catalogue filtré IA
 *   2. get_product_details   — fiche technique complète d'un produit
 *   3. list_categories       — les 21 catégories techniques FAIREKO
 *
 * Sécurité
 * --------
 * L'API key Odoo n'est JAMAIS exposée au client. Elle vit uniquement dans les
 * variables d'environnement Netlify et est lue côté serveur.
 *
 * Le filtre IA doctrinal est appliqué CÔTÉ SERVEUR pour chaque requête :
 *   - x_owner_entity = "FAIREKO"
 *   - x_visible_ia = true
 *   - x_niveau_confiance in ["2", "3"]
 *   - website_published = true
 *
 * Ce filtre est non-négociable : Claude ne peut pas le contourner, même via
 * prompt injection ou tentative de passer un product_id hors périmètre.
 *
 * Variables d'environnement Netlify requises
 * -------------------------------------------
 *   ODOO_URL       ex: https://www.faireko.be
 *   ODOO_DB        ex: nbsdistribution
 *   ODOO_UID       ex: 7
 *   ODOO_LOGIN     ex: denis@nbsdistribution.eu
 *   ODOO_API_KEY   ex: (clé de 40 chars, générée côté profil Odoo)
 * =============================================================================
 */

// -----------------------------------------------------------------------------
// Filtre IA doctrinal — NE JAMAIS MODIFIER SANS ARBITRAGE DOCTRINAL
// -----------------------------------------------------------------------------
const FILTRE_IA_DOCTRINAL = [
  ["x_owner_entity", "=", "FAIREKO"],
  ["x_visible_ia", "=", true],
  ["x_niveau_confiance", "in", ["2", "3"]],
  ["website_published", "=", true]
];

// -----------------------------------------------------------------------------
// Champs retournés par search_products (vue liste)
// -----------------------------------------------------------------------------
const CHAMPS_LISTE = [
  "id",
  "name",
  "x_category_tech",
  "x_niveau_confiance",
  "x_studio_conductivit_wmk",
  "x_reaction_feu",
  "x_biosource_pct",
  "list_price"
];

// -----------------------------------------------------------------------------
// Champs retournés par get_product_details (vue détail complète)
// -----------------------------------------------------------------------------
const CHAMPS_DETAIL = [
  "id",
  "name",
  "description_sale",
  "x_category_tech",
  "x_niveau_confiance",
  "x_studio_conductivit_wmk",
  "x_reaction_feu",
  "x_fumee_classe",
  "x_gouttes_classe",
  "x_mu_min",
  "x_mu_max",
  "x_vapeur_ouvert",
  "x_alpha_w",
  "x_rw_db",
  "x_co2_a1a3",
  "x_biosource_pct",
  "x_eta_ref",
  "x_liant_type",
  "x_ia_tags",
  "list_price",
  "default_code",
  "website_url"
];

// -----------------------------------------------------------------------------
// 21 catégories techniques FAIREKO (miroir de x_category_tech en base Odoo)
// -----------------------------------------------------------------------------
const CATEGORIES_TECH = [
  { code: "support", label: "Support" },
  { code: "structure", label: "Structure" },
  { code: "ossature_biosource", label: "Ossature biosourcée" },
  { code: "ossature_bois", label: "Ossature bois" },
  { code: "ossature_metal", label: "Ossature métal" },
  { code: "isolant_rigide", label: "Isolant rigide" },
  { code: "isolant_semi_rigide", label: "Isolant semi-rigide" },
  { code: "isolant_vrac", label: "Isolant vrac" },
  { code: "membrane_frein_vapeur", label: "Frein vapeur" },
  { code: "membrane_pare_vapeur", label: "Pare-vapeur" },
  { code: "membrane_pare_pluie", label: "Pare-pluie / HPV" },
  { code: "parement_technique", label: "Parement technique" },
  { code: "parement_naturel", label: "Parement naturel" },
  { code: "enduit_base", label: "Enduit de base / accrochage" },
  { code: "enduit_finition", label: "Enduit de finition" },
  { code: "fixation", label: "Fixation" },
  { code: "chape", label: "Chape" },
  { code: "sol_sec", label: "Sol sec" },
  { code: "chauffage_radiant", label: "Chauffage radiant" },
  { code: "traitement_humidite", label: "Traitement humidité" },
  { code: "accessoire", label: "Accessoire" }
];

// -----------------------------------------------------------------------------
// Helper CORS — identique à fabien.mjs pour cohérence
// -----------------------------------------------------------------------------
function cors(response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return response;
}

// -----------------------------------------------------------------------------
// Helper : construit une réponse JSON propre avec CORS
// -----------------------------------------------------------------------------
function jsonResponse(data, status = 200) {
  return cors(new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  }));
}

// -----------------------------------------------------------------------------
// Helper : appel JSON-RPC vers Odoo
// -----------------------------------------------------------------------------
async function appelOdoo(model, method, args, kwargs = {}) {
  const ODOO_URL = Netlify.env.get("ODOO_URL");
  const ODOO_DB = Netlify.env.get("ODOO_DB");
  const ODOO_UID = parseInt(Netlify.env.get("ODOO_UID"), 10);
  const ODOO_API_KEY = Netlify.env.get("ODOO_API_KEY");

  if (!ODOO_URL || !ODOO_DB || !ODOO_UID || !ODOO_API_KEY) {
    throw new Error("Configuration Odoo manquante dans les variables d'environnement");
  }

  const payload = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [ODOO_DB, ODOO_UID, ODOO_API_KEY, model, method, args, kwargs]
    }
  };

  const response = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Odoo HTTP ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    // Log côté serveur pour debug sans leaker à l'appelant
    console.error("Erreur Odoo:", JSON.stringify(data.error));
    throw new Error(`Odoo: ${data.error.message || "erreur inconnue"}`);
  }

  return data.result;
}

// -----------------------------------------------------------------------------
// Tool 1 : search_products
// -----------------------------------------------------------------------------
async function toolSearchProducts(input) {
  // Construction du domaine Odoo : filtre IA + filtres optionnels
  const domaine = [...FILTRE_IA_DOCTRINAL];

  if (input.category && typeof input.category === "string") {
    // Validation : la catégorie doit être dans la liste autorisée
    const categoriesValides = CATEGORIES_TECH.map(c => c.code);
    if (categoriesValides.includes(input.category)) {
      domaine.push(["x_category_tech", "=", input.category]);
    }
  }

  if (input.query && typeof input.query === "string") {
    const q = input.query.trim();
    if (q.length > 0) {
      // Recherche élargie : name OR default_code OR description_sale OR x_ia_tags
      // Syntaxe Odoo : '|' devant N-1 conditions OR (3 OR ⇒ 3 '|')
      domaine.push(
        "|", "|", "|",
        ["name", "ilike", q],
        ["default_code", "ilike", q],
        ["description_sale", "ilike", q],
        ["x_ia_tags", "ilike", q]
      );
    }
  }

  // Limite : défaut 5, max 10, min 1
  let limit = parseInt(input.limit, 10);
  if (isNaN(limit) || limit < 1) limit = 5;
  if (limit > 10) limit = 10;

  const produits = await appelOdoo(
    "product.template",
    "search_read",
    [domaine],
    {
      fields: CHAMPS_LISTE,
      limit,
      order: "x_niveau_confiance desc, name asc"
    }
  );

  // Log côté serveur pour debug (visible dans logs Netlify)
  console.log(`[search_products] query="${input.query || ''}" cat="${input.category || ''}" → ${produits.length} produits`);

  // Si 0 produits avec filtre IA, on cherche SANS filtre IA pour dire à Claude
  // si le produit existe en base mais est filtré par la doctrine.
  // Ça évite les "j'ai rien trouvé" trompeurs : Claude saura que le produit
  // existe mais n'est pas exposé à l'IA, et pourra le dire honnêtement.
  let hint_existe_hors_ia = null;
  if (produits.length === 0 && input.query) {
    try {
      const q = input.query.trim();
      // Domaine SANS filtre IA, juste les actifs publiés ou non
      const domaineHorsIA = [
        ["active", "=", true],
        "|", "|", "|",
        ["name", "ilike", q],
        ["default_code", "ilike", q],
        ["description_sale", "ilike", q],
        ["x_ia_tags", "ilike", q]
      ];
      const horsIA = await appelOdoo(
        "product.template",
        "search_read",
        [domaineHorsIA],
        { fields: ["id", "name", "x_owner_entity", "x_visible_ia", "x_niveau_confiance", "website_published"], limit: 3 }
      );
      if (horsIA.length > 0) {
        hint_existe_hors_ia = {
          existe_en_base: true,
          count_hors_filtre_ia: horsIA.length,
          message_pour_ia: `${horsIA.length} produit(s) correspondent en base Odoo mais ne sont PAS exposés à l'IA. Raisons possibles : champ x_owner_entity≠FAIREKO, x_visible_ia non coché, x_niveau_confiance non renseigné (doit être "2" ou "3"), ou website_published=false. Donne cette info à l'utilisateur honnêtement au lieu de dire "j'ai rien trouvé".`,
          exemples: horsIA.map(p => ({
            id: p.id,
            name: p.name,
            x_owner_entity: p.x_owner_entity || null,
            x_visible_ia: p.x_visible_ia || false,
            x_niveau_confiance: p.x_niveau_confiance || null,
            website_published: p.website_published || false
          }))
        };
        console.log(`[search_products] hors_filtre_ia="${q}" → ${horsIA.length} produits trouvés mais filtrés`);
      }
    } catch (e) {
      // Si la requête hors filtre IA plante, on ignore — c'est juste un hint
      console.error(`[search_products] hint_hors_ia erreur:`, e.message);
    }
  }

  return {
    count: produits.length,
    products: produits,
    ...(hint_existe_hors_ia && { _hint: hint_existe_hors_ia })
  };
}

// -----------------------------------------------------------------------------
// Tool 2 : get_product_details
// -----------------------------------------------------------------------------
async function toolGetProductDetails(input) {
  const productId = parseInt(input.product_id, 10);

  if (isNaN(productId) || productId < 1) {
    return { error: "product_id invalide" };
  }

  // Anti-contournement : on applique le filtre IA + le filtre sur l'ID.
  // Si le produit n'est pas dans le périmètre IA, Odoo renverra une liste vide
  // et on refusera d'exposer quoi que ce soit.
  const domaine = [
    ...FILTRE_IA_DOCTRINAL,
    ["id", "=", productId]
  ];

  const produits = await appelOdoo(
    "product.template",
    "search_read",
    [domaine],
    {
      fields: CHAMPS_DETAIL,
      limit: 1
    }
  );

  if (produits.length === 0) {
    return {
      error: "Produit introuvable ou hors périmètre IA",
      product_id: productId
    };
  }

  return { product: produits[0] };
}

// -----------------------------------------------------------------------------
// Tool 3 : list_categories
// -----------------------------------------------------------------------------
async function toolListCategories() {
  // Pas d'appel Odoo : la liste est en dur (miroir fidèle de la selection Odoo).
  // Si un jour une catégorie est ajoutée en base, il faudra mettre à jour la
  // constante CATEGORIES_TECH ci-dessus.
  return {
    count: CATEGORIES_TECH.length,
    categories: CATEGORIES_TECH
  };
}

// -----------------------------------------------------------------------------
// Routeur des outils
// -----------------------------------------------------------------------------
const OUTILS = {
  search_products: toolSearchProducts,
  get_product_details: toolGetProductDetails,
  list_categories: toolListCategories
};

// -----------------------------------------------------------------------------
// Handler principal Netlify v2
// -----------------------------------------------------------------------------
export default async (request) => {
  // Preflight CORS
  if (request.method === "OPTIONS") {
    return cors(new Response(null, { status: 204 }));
  }

  // Méthode autorisée : POST uniquement
  if (request.method !== "POST") {
    return jsonResponse(
      { error: "Méthode non autorisée. Utiliser POST." },
      405
    );
  }

  // Parsing du body JSON
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse(
      { error: "Body JSON invalide" },
      400
    );
  }

  // Validation du nom d'outil (whitelist stricte)
  const toolName = body.tool;
  if (!toolName || typeof toolName !== "string") {
    return jsonResponse(
      { error: "Paramètre 'tool' manquant" },
      400
    );
  }

  const handler = OUTILS[toolName];
  if (!handler) {
    return jsonResponse(
      {
        error: `Outil inconnu : ${toolName}`,
        outils_disponibles: Object.keys(OUTILS)
      },
      400
    );
  }

  // Exécution de l'outil
  try {
    const input = body.input || {};
    const result = await handler(input);
    return jsonResponse({
      tool: toolName,
      result
    });
  } catch (err) {
    console.error(`Erreur outil ${toolName}:`, err.message);
    return jsonResponse(
      {
        tool: toolName,
        error: err.message || "Erreur interne"
      },
      500
    );
  }
};
