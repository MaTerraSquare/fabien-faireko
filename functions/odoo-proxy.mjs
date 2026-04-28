/**
 * =============================================================================
 * FAIRĒKO · Proxy Odoo pour Fabien-IA
 * =============================================================================
 *
 * Fichier    : netlify/functions/odoo-proxy.mjs
 * Route      : /api/odoo  (voir netlify.toml)
 * Version    : 2.0  —  28 avril 2026
 *
 * Changements V2 vs V1 :
 *   - Filtre IA accepte N2 (validé Denis sans preuve formelle) en plus de N3-N5
 *   - Champs x_pdf_text et x_pdf_resume_pro ajoutés à CHAMPS_DETAIL
 *   - Recherche dans x_pdf_resume_pro et x_pdf_text dans search_products
 *
 * Outils exposés
 * --------------
 *   1. search_products       — recherche dans le catalogue filtré IA
 *   2. get_product_details   — fiche technique complète d'un produit
 *   3. list_categories       — les 21 catégories techniques FAIREKO
 *   4. search_doctrine       — recherche dans Knowledge Odoo (doctrine FAIRĒKO)
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
// Filtre IA doctrinal — V2 inclut N2 (validé Denis)
// -----------------------------------------------------------------------------
const FILTRE_IA_DOCTRINAL = [
  ["x_owner_entity", "=", "FAIREKO"],
  ["x_visible_ia", "=", true],
  ["x_niveau_confiance", "in", ["2", "3", "4", "5"]],
  ["website_published", "=", true]
];

// -----------------------------------------------------------------------------
// Champs retournés par search_products (vue liste)
// -----------------------------------------------------------------------------
const CHAMPS_LISTE = [
  "id",
  "name",
  "x_brand",
  "x_category_tech",
  "x_niveau_confiance",
  "x_studio_conductivit_wmk",
  "x_reaction_feu",
  "x_biosource_pct",
  "list_price"
];

// -----------------------------------------------------------------------------
// Champs retournés par get_product_details (vue détail complète V2)
// -----------------------------------------------------------------------------
const CHAMPS_DETAIL = [
  "id",
  "name",
  "description_sale",
  "x_brand",
  "x_category_tech",
  "x_niveau_confiance",
  "x_studio_conductivit_wmk",
  "x_reaction_feu",
  "x_fumee_classe",
  "x_gouttes_classe",
  "x_mu_min",
  "x_mu_max",
  "x_vapeur_ouvert",
  "x_capillarite",
  "x_alpha_w",
  "x_rw_db",
  "x_co2_a1a3",
  "x_biosource_pct",
  "x_eta_ref",
  "x_liant_type",
  "x_classe_resistance",
  "x_classe_absorption_w",
  "x_granulometrie_mm",
  "x_epaisseur_min_mm",
  "x_epaisseur_max_mm",
  "x_comportement_vapeur",
  "x_bati_compatible",
  "x_mise_en_oeuvre",
  "x_origine_solution",
  "x_recyclable",
  "x_densite_kg_m3",
  "x_ia_tags",
  "x_pdf_text",
  "x_pdf_resume_pro",
  "list_price",
  "default_code",
  "website_url"
];

// -----------------------------------------------------------------------------
// 21 catégories techniques FAIREKO
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
// Helper CORS
// -----------------------------------------------------------------------------
function cors(response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return response;
}

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
    console.error("Erreur Odoo:", JSON.stringify(data.error));
    throw new Error(`Odoo: ${data.error.message || "erreur inconnue"}`);
  }

  return data.result;
}

// -----------------------------------------------------------------------------
// Tool 1 : search_products (V2 — recherche élargie aux PDFs)
// -----------------------------------------------------------------------------
async function toolSearchProducts(input) {
  const domaine = [...FILTRE_IA_DOCTRINAL];

  if (input.category && typeof input.category === "string") {
    const categoriesValides = CATEGORIES_TECH.map(c => c.code);
    if (categoriesValides.includes(input.category)) {
      domaine.push(["x_category_tech", "=", input.category]);
    }
  }

  if (input.query && typeof input.query === "string") {
    const q = input.query.trim();
    if (q.length > 0) {
      // V2 : Recherche élargie incluant x_pdf_resume_pro et x_pdf_text
      // 5 OR conditions = 4 '|' devant
      domaine.push(
        "|", "|", "|", "|", "|",
        ["name", "ilike", q],
        ["default_code", "ilike", q],
        ["description_sale", "ilike", q],
        ["x_ia_tags", "ilike", q],
        ["x_pdf_resume_pro", "ilike", q],
        ["x_pdf_text", "ilike", q]
      );
    }
  }

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

  console.log(`[search_products] query="${input.query || ''}" cat="${input.category || ''}" → ${produits.length} produits`);

  // Hint hors filtre IA si 0 résultats
  let hint_existe_hors_ia = null;
  if (produits.length === 0 && input.query) {
    try {
      const q = input.query.trim();
      const domaineHorsIA = [
        ["active", "=", true],
        "|", "|", "|", "|", "|",
        ["name", "ilike", q],
        ["default_code", "ilike", q],
        ["description_sale", "ilike", q],
        ["x_ia_tags", "ilike", q],
        ["x_pdf_resume_pro", "ilike", q],
        ["x_pdf_text", "ilike", q]
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
          message_pour_ia: `${horsIA.length} produit(s) correspondent en base Odoo mais ne sont PAS exposés à l'IA. Raisons possibles : champ x_owner_entity≠FAIREKO, x_visible_ia non coché, x_niveau_confiance trop bas (doit être "2", "3", "4" ou "5"), ou website_published=false. Donne cette info à l'utilisateur honnêtement.`,
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
// Tool 2 : get_product_details (V2 avec champs PDF)
// -----------------------------------------------------------------------------
async function toolGetProductDetails(input) {
  const productId = parseInt(input.product_id, 10);

  if (isNaN(productId) || productId < 1) {
    return { error: "product_id invalide" };
  }

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
// Tool 4 : search_doctrine — recherche dans Knowledge Odoo
// -----------------------------------------------------------------------------
async function toolSearchDoctrine(input) {
  const q = (input.query || "").trim();
  if (!q) {
    return { count: 0, articles: [], message: "query vide" };
  }

  let limit = parseInt(input.limit, 10);
  if (isNaN(limit) || limit < 1) limit = 3;
  if (limit > 5) limit = 5;

  const domaine = [
    ["is_article_item", "=", false],
    "|",
    ["name", "ilike", q],
    ["body", "ilike", q]
  ];

  let articles;
  try {
    articles = await appelOdoo(
      "knowledge.article",
      "search_read",
      [domaine],
      {
        fields: ["id", "name", "body", "parent_id"],
        limit,
        order: "favorite_count desc, write_date desc"
      }
    );
  } catch (e) {
    console.error(`[search_doctrine] erreur Odoo:`, e.message);
    return {
      count: 0,
      articles: [],
      error: "Knowledge Odoo non accessible ou non installé",
      detail: e.message
    };
  }

  // Nettoyage HTML → texte brut, troncature à 1500 chars
  const articlesNettoyes = articles.map(a => {
    let texte = (a.body || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (texte.length > 1500) {
      texte = texte.substring(0, 1500) + "…";
    }

    return {
      id: a.id,
      titre: a.name,
      extrait: texte,
      url: `/odoo/knowledge/${a.id}`
    };
  });

  console.log(`[search_doctrine] query="${q}" → ${articles.length} articles`);

  return {
    count: articlesNettoyes.length,
    articles: articlesNettoyes
  };
}

// -----------------------------------------------------------------------------
// Tool 3 : list_categories
// -----------------------------------------------------------------------------
async function toolListCategories() {
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
  list_categories: toolListCategories,
  search_doctrine: toolSearchDoctrine
};

// -----------------------------------------------------------------------------
// Handler principal Netlify v2
// -----------------------------------------------------------------------------
export default async (request) => {
  if (request.method === "OPTIONS") {
    return cors(new Response(null, { status: 204 }));
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { error: "Méthode non autorisée. Utiliser POST." },
      405
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse(
      { error: "Body JSON invalide" },
      400
    );
  }

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
