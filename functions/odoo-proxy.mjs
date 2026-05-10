/**
 * =============================================================================
 * FAIRĒKO · Proxy Odoo pour Fabien-IA
 * =============================================================================
 *
 * Fichier    : netlify/functions/odoo-proxy.mjs
 * Route      : /api/odoo  (voir netlify.toml)
 * Version    : 3.1  —  10 mai 2026
 *
 * Changements V3.1 vs V3.0 (suite review technique) :
 *   - FIX BUG SILENCIEUX : domaine Odoo multi-OR construit explicitement via
 *     helper makeOrDomain (pile postfixée explicite) au lieu d'une suite de "|"
 *     qui devenait instable avec plusieurs tokens AND.
 *   - PERF : x_pdf_text retiré de search_products (PDFs OCR de 50k chars qui
 *     plombaient le CPU PostgreSQL). x_pdf_text reste consultable dans
 *     get_product_details à la demande.
 *   - SÉCURITÉ COMMERCIALE : build_quote ajoute price_source + disclaimer
 *     explicite (prix public HT, hors transport et remises chantier).
 *   - PRÉCISION : calculate_quantity accepte waste_factor_pct + presets par
 *     type d'application (ETICS, panneaux, vrac, enduit manuel).
 *   - ARCHITECTURE FUTUR : ajout d'un v9_model vide dans build_quote pour
 *     préparer la transition slots / function_options / materials / generates.
 *
 * Outils exposés
 * --------------
 *   1. search_products       — recherche dans le catalogue filtré IA (V3.1 OR explicite, sans x_pdf_text)
 *   2. get_product_details   — fiche technique complète d'un produit (inclut x_pdf_text)
 *   3. list_categories       — les 21 catégories techniques FAIREKO
 *   4. search_doctrine       — recherche dans Knowledge Odoo (doctrine FAIRĒKO)
 *   5. calculate_quantity    — calcul de quantités métré + waste_factor_pct
 *   6. build_quote           — devis structuré + price_source + v9_model
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
// Helper : makeOrDomainFlat (V3.1 — fix domaine Odoo multi-OR)
// -----------------------------------------------------------------------------
// Construit un domaine OR aplati pour Odoo : pour N champs il faut N-1 '|'.
// Forme : ['|', '|', ..., [f1, op, val], [f2, op, val], ...]
// IMPORTANT : Odoo n'accepte PAS les sous-listes nested (erreur "unhashable type: 'list'").
// Il faut la forme postfixée aplatie standard.
//
// Usage : pousser le retour dans le tableau domaine plat à coups de spread.
//   const orTerms = makeOrDomainFlat(["name", "default_code"], "tok");
//   domaine.push(...orTerms);
// → domaine devient : [..., '|', ['name','ilike','tok'], ['default_code','ilike','tok']]
//
// Pour 5 champs : 4 opérateurs '|' suivis des 5 conditions.
// Plusieurs tokens AND : on push à la suite, Odoo fait AND implicite entre blocs.
// -----------------------------------------------------------------------------
function makeOrDomainFlat(fields, token) {
  if (!fields || fields.length === 0) return [];
  if (fields.length === 1) {
    return [[fields[0], "ilike", token]];
  }
  const result = [];
  // N-1 opérateurs '|' devant
  for (let i = 0; i < fields.length - 1; i++) {
    result.push("|");
  }
  // Puis les N conditions
  for (const f of fields) {
    result.push([f, "ilike", token]);
  }
  return result;
}

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
      // V3.1 — Fix domaine Odoo multi-OR : on utilise makeOrDomain qui construit
      // une pile postfixée explicite, robuste à plusieurs tokens AND.
      // Stop-words ignorés. Max 5 tokens.
      // x_pdf_text RETIRÉ ici (PDFs OCR de 50k chars trop coûteux en search global).
      // x_pdf_text reste accessible dans get_product_details à la demande.
      const STOP_WORDS = new Set([
        "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "à", "au", "aux",
        "en", "sur", "sous", "dans", "pour", "par", "avec", "sans", "vs", "que", "qui",
        "the", "a", "of", "for", "and", "or", "to", "in", "on"
      ]);

      const CHAMPS_RECHERCHE = [
        "name",
        "default_code",
        "description_sale",
        "x_ia_tags",
        "x_pdf_resume_pro"
        // x_pdf_text RETIRÉ V3.1 — voir CHAMPS_DETAIL pour le récupérer à la demande
      ];

      const tokens = q
        .toLowerCase()
        .split(/\s+/)
        .filter(t => t.length >= 2 && !STOP_WORDS.has(t))
        .slice(0, 5);

      if (tokens.length === 0) {
        // Fallback : query brute (cas où tout est stop-words)
        domaine.push(...makeOrDomainFlat(CHAMPS_RECHERCHE, q));
      } else {
        // Pour CHAQUE token : bloc OR aplati postfixé. Tous les tokens en AND implicite.
        for (const tok of tokens) {
          domaine.push(...makeOrDomainFlat(CHAMPS_RECHERCHE, tok));
        }
      }
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
      const STOP_WORDS = new Set([
        "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "à", "au", "aux",
        "en", "sur", "sous", "dans", "pour", "par", "avec", "sans", "vs", "que", "qui",
        "the", "a", "of", "for", "and", "or", "to", "in", "on"
      ]);
      const CHAMPS_RECHERCHE = [
        "name", "default_code", "description_sale", "x_ia_tags", "x_pdf_resume_pro"
        // x_pdf_text retiré V3.1 (perf)
      ];
      const tokens = q.toLowerCase().split(/\s+/)
        .filter(t => t.length >= 2 && !STOP_WORDS.has(t))
        .slice(0, 5);

      const domaineHorsIA = [["active", "=", true]];
      if (tokens.length === 0) {
        domaineHorsIA.push(...makeOrDomainFlat(CHAMPS_RECHERCHE, q));
      } else {
        for (const tok of tokens) {
          domaineHorsIA.push(...makeOrDomainFlat(CHAMPS_RECHERCHE, tok));
        }
      }

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
  if (isNaN(limit) || limit < 1) limit = 2;
  if (limit > 3) limit = 3;

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

  // V3.2 — Nettoyage HTML → texte brut, troncature DURE à 600 chars
  // (avant 1500 chars × 3 articles = 4500 chars = ~1100 tokens à chaque tool call,
  // accumulés en context window qui faisait exploser le rate limit Anthropic).
  // Maintenant 600 × 2 = 1200 chars = ~300 tokens max par appel.
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

    if (texte.length > 600) {
      texte = texte.substring(0, 600) + "…";
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
// Tool 5 : calculate_quantity (V3.1 — Fabien ne calcule plus + waste_factor)
// -----------------------------------------------------------------------------
// Reçoit : dimensions chantier + produit(s) consommables + (optionnel) waste
// Renvoie : quantités exactes en unités, palettes, prix HT total, marge pertes
//
// Presets de waste (review technique) :
//   - panneaux rigides (ETICS, sarking)  : 5%
//   - ETICS (système complet)            : 8%
//   - enduit manuel                      : 12% (truelle, taloche)
//   - vrac insufflé / soufflé            : 12%
//   - vrac coulé / banché (CaNaDry)      : 8%
//   - rouleaux / membranes               : 5%
//   - défaut                             : 5%
//
// Exemple input :
//   {
//     surface_m2: 100,
//     epaisseur_cm: 25,
//     coverage_unit: "m3",
//     coverage_per_unit: 0.055,
//     unit_price: 15.43,
//     unit_label: "sac",
//     palette_qty: 40,
//     waste_factor_pct: 8,           // OPTIONNEL : Fabien le passe selon contexte
//     waste_preset: "vrac_banche"    // OPTIONNEL : alternative au pct direct
//   }
// -----------------------------------------------------------------------------
const WASTE_PRESETS = {
  "panneau_rigide": 5,
  "etics": 8,
  "enduit_manuel": 12,
  "enduit_projection": 10,
  "vrac_insuffle": 12,
  "vrac_souffle": 12,
  "vrac_banche": 8,
  "vrac_coule": 8,
  "rouleau": 5,
  "membrane": 5,
  "default": 5
};

async function toolCalculateQuantity(input) {
  const errs = [];

  const surface_m2 = Number(input.surface_m2);
  if (!isFinite(surface_m2) || surface_m2 <= 0) errs.push("surface_m2 manquant ou invalide");

  const unit_price = Number(input.unit_price);
  if (!isFinite(unit_price) || unit_price < 0) errs.push("unit_price manquant ou invalide");

  const coverage_unit = (input.coverage_unit || "m2").toLowerCase();
  if (!["m2", "m3", "kg"].includes(coverage_unit)) errs.push("coverage_unit doit être 'm2', 'm3' ou 'kg'");

  if (errs.length > 0) return { error: "input invalide", details: errs };

  const couches = Math.max(1, Number(input.couches) || 1);
  const epaisseur_cm = Number(input.epaisseur_cm) || 0;
  const consommation_per_m2 = Number(input.consommation_per_m2) || 0;
  const coverage_per_unit = Number(input.coverage_per_unit) || 0;
  const palette_qty = Number(input.palette_qty) || 0;
  const unit_label = input.unit_label || "unité";

  // V3.1 : résolution waste_factor_pct
  // Priorité : valeur explicite > preset > défaut 5%
  let waste_factor_pct = Number(input.waste_factor_pct);
  let waste_source = "explicite";
  if (!isFinite(waste_factor_pct) || waste_factor_pct < 0 || waste_factor_pct > 50) {
    const preset = (input.waste_preset || "default").toLowerCase();
    waste_factor_pct = WASTE_PRESETS[preset] !== undefined ? WASTE_PRESETS[preset] : WASTE_PRESETS.default;
    waste_source = `preset:${preset}`;
  }

  // Calcul du besoin théorique (sans pertes)
  let besoin_theorique = 0;
  let besoin_unit = "";
  let formule = "";

  if (coverage_unit === "m3" && epaisseur_cm > 0 && coverage_per_unit > 0) {
    const volume_m3 = (surface_m2 * epaisseur_cm) / 100;
    besoin_theorique = volume_m3 * couches;
    besoin_unit = "m³";
    formule = `${surface_m2} m² × ${epaisseur_cm} cm × ${couches} couche(s) = ${volume_m3.toFixed(2)} m³`;
  } else if (coverage_unit === "kg" && consommation_per_m2 > 0) {
    besoin_theorique = surface_m2 * consommation_per_m2 * couches;
    besoin_unit = "kg";
    formule = `${surface_m2} m² × ${consommation_per_m2} kg/m² × ${couches} couche(s) = ${besoin_theorique.toFixed(1)} kg`;
  } else if (coverage_unit === "m2") {
    besoin_theorique = surface_m2 * couches;
    besoin_unit = "m²";
    formule = `${surface_m2} m² × ${couches} couche(s) = ${besoin_theorique.toFixed(1)} m²`;
  } else {
    return { error: "Configuration insuffisante : besoin de coverage_unit + (epaisseur_cm OR consommation_per_m2)" };
  }

  // V3.1 : application du waste_factor
  const besoin_total = +(besoin_theorique * (1 + waste_factor_pct / 100)).toFixed(2);

  // Conversion besoin → nombre d'unités
  let unites_brutes = 0;
  if (coverage_per_unit > 0) {
    unites_brutes = besoin_total / coverage_per_unit;
  } else if (coverage_unit === "kg") {
    unites_brutes = besoin_total;
  }

  const unites_arrondi = Math.ceil(unites_brutes);
  const sous_total_ht = +(unites_arrondi * unit_price).toFixed(2);

  // Conversion en palettes si applicable
  let palettes = null;
  let unites_palette_complete = 0;
  let unites_appoint = 0;
  if (palette_qty > 0) {
    palettes = Math.floor(unites_arrondi / palette_qty);
    unites_palette_complete = palettes * palette_qty;
    unites_appoint = unites_arrondi - unites_palette_complete;
  }

  return {
    formule_calcul: formule,
    besoin_theorique: +besoin_theorique.toFixed(2),
    besoin_avec_pertes: besoin_total,
    besoin_unit,
    waste_factor_pct,
    waste_source,
    unites_brutes: +unites_brutes.toFixed(2),
    unites_arrondi,
    unit_label,
    unit_price,
    sous_total_ht,
    devise: "EUR",
    ...(palette_qty > 0 && {
      palettes_completes: palettes,
      unites_par_palette: palette_qty,
      unites_appoint,
      conditionnement_optimal:
        palettes === 0
          ? `${unites_arrondi} ${unit_label}(s) à l'unité`
          : unites_appoint === 0
          ? `${palettes} palette(s) de ${palette_qty} ${unit_label}(s) = ${unites_palette_complete} ${unit_label}(s)`
          : `${palettes} palette(s) + ${unites_appoint} ${unit_label}(s) à l'unité`
    }),
    note_chantier: `Quantités calculées avec marge pertes ${waste_factor_pct}% (source : ${waste_source}). Ajuster selon complexité chantier réelle.`,
    presets_disponibles: Object.keys(WASTE_PRESETS)
  };
}

// -----------------------------------------------------------------------------
// Tool 6 : build_quote (V3 — devis structuré)
// -----------------------------------------------------------------------------
// Reçoit : un tableau de lignes { product_id, quantity, ... }
// Pour chaque ligne, le proxy va chercher le prix réel dans Odoo (pas de
// hallucination LLM) et calcule total HT, TVA 21%, TTC. Retourne JSON propre
// que Fabien lit et formate en réponse client.
//
// Exemple input :
//   {
//     client_ref: "Devis 100m² ITI bâti ancien",
//     lines: [
//       { product_id: 1909, quantity: 11, unit_label: "palette", note: "CaNaDry banché" },
//       { product_id: 762, quantity: 1, unit_label: "palette", note: "Adherecal collage" }
//     ]
//   }
// -----------------------------------------------------------------------------
async function toolBuildQuote(input) {
  const lines = Array.isArray(input.lines) ? input.lines : [];
  if (lines.length === 0) return { error: "Aucune ligne de devis fournie" };
  if (lines.length > 20) return { error: "Maximum 20 lignes par devis" };

  const product_ids = [...new Set(lines.map(l => parseInt(l.product_id, 10)).filter(id => id > 0))];
  if (product_ids.length === 0) return { error: "Aucun product_id valide" };

  // Récupérer les prix réels en une seule requête
  let produits;
  try {
    produits = await appelOdoo(
      "product.template",
      "search_read",
      [[
        ["id", "in", product_ids],
        ["x_owner_entity", "=", "FAIREKO"],
        ["active", "=", true]
      ]],
      { fields: ["id", "name", "list_price", "default_code", "x_brand", "website_url"] }
    );
  } catch (e) {
    return { error: "Impossible de récupérer les prix Odoo", detail: e.message };
  }

  const produitsMap = {};
  for (const p of produits) produitsMap[p.id] = p;

  const lignes_devis = [];
  let total_ht = 0;
  const erreurs = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const pid = parseInt(l.product_id, 10);
    const qty = Number(l.quantity);

    if (!pid || pid < 1) {
      erreurs.push(`Ligne ${i + 1} : product_id invalide`);
      continue;
    }
    if (!isFinite(qty) || qty <= 0) {
      erreurs.push(`Ligne ${i + 1} : quantity invalide`);
      continue;
    }

    const p = produitsMap[pid];
    if (!p) {
      erreurs.push(`Ligne ${i + 1} : produit ${pid} introuvable ou hors FAIREKO`);
      continue;
    }

    const prix_unit = Number(p.list_price) || 0;
    const sous_total = +(qty * prix_unit).toFixed(2);
    total_ht += sous_total;

    lignes_devis.push({
      ligne: i + 1,
      product_id: p.id,
      name: p.name,
      brand: p.x_brand || "",
      reference: p.default_code || "",
      quantity: qty,
      unit_label: l.unit_label || "unité",
      unit_price_ht: +prix_unit.toFixed(2),
      sous_total_ht: sous_total,
      note: l.note || "",
      url: p.website_url || `/odoo/inventory/products/${p.id}`
    });
  }

  total_ht = +total_ht.toFixed(2);
  const tva = +(total_ht * 0.21).toFixed(2);
  const total_ttc = +(total_ht + tva).toFixed(2);

  return {
    client_ref: input.client_ref || "",
    lignes_devis,
    nb_lignes: lignes_devis.length,
    erreurs: erreurs.length > 0 ? erreurs : undefined,
    totaux: {
      total_ht,
      tva_21_pct: tva,
      total_ttc,
      devise: "EUR"
    },
    // V3.1 — Sécurité commerciale (review technique)
    price_source: "public_list_price",
    price_disclaimer: "Prix publics HT issus du catalogue Odoo FAIRĒKO. NON contractuel. Hors transport, hors remises chantier, hors pricelists B2B (Prix Négoces, Prix Entrepreneur). Stock non vérifié. Pour devis officiel : contacter hello@nbsdistribution.eu",
    cta: {
      panier: "Ajouter au panier sur faireko.be",
      devis_pdf: "Demander un devis PDF officiel à hello@nbsdistribution.eu",
      expert: "Appeler un conseiller FAIRĒKO pour validation chantier"
    },
    // V3.1 — Préparation modèle FAIRĒKO v9 (review technique)
    // Pour l'instant vide. Sera rempli par un futur system_builder en amont
    // (slots → function_options → materials → generates).
    // Présent dès maintenant pour que le front puisse l'ignorer ou commencer
    // à le consommer sans casser la compatibilité.
    v9_model: {
      slots: [],
      function_options: [],
      materials: [],
      generates: []
    },
    note: "Devis indicatif basé sur le catalogue public. Prix réels via pricelist FAIRĒKO sur demande."
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
  search_doctrine: toolSearchDoctrine,
  calculate_quantity: toolCalculateQuantity,
  build_quote: toolBuildQuote
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
