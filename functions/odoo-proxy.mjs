/**
 * =============================================================================
 * FAIRĒKO · Proxy Odoo pour Fabien-IA
 * =============================================================================
 *
 * Fichier    : netlify/functions/odoo-proxy.mjs
 * Route      : /api/odoo  (voir netlify.toml)
 * Version    : 3.0  —  10 mai 2026
 *
 * Changements V3 vs V2 :
 *   - FIX bug recherche multi-mots dans search_products (tokenize + AND par mot)
 *     → "EXIE chanvre" trouve maintenant les produits qui contiennent les 2 mots
 *   - NOUVEAU outil calculate_quantity → calcul métré juste (Fabien ne calcule plus)
 *   - NOUVEAU outil build_quote → devis JSON structuré, prix justes, total auto
 *
 * Outils exposés
 * --------------
 *   1. search_products       — recherche dans le catalogue filtré IA (V3 multi-mots)
 *   2. get_product_details   — fiche technique complète d'un produit
 *   3. list_categories       — les 21 catégories techniques FAIREKO
 *   4. search_doctrine       — recherche dans Knowledge Odoo (doctrine FAIRĒKO)
 *   5. calculate_quantity    — calcul de quantités métré (jamais d'erreur LLM)
 *   6. build_quote           — devis structuré multi-lignes avec totaux justes
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
      // V3 — FIX recherche multi-mots
      // Stratégie : tokeniser la query → chaque mot doit matcher au moins UN champ (OR par champ)
      // Tous les mots doivent être présents (AND entre les mots) sur l'ensemble des champs
      // Stop-words ignorés (mots vides qui pourrissent la recherche)
      const STOP_WORDS = new Set([
        "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "à", "au", "aux",
        "en", "sur", "sous", "dans", "pour", "par", "avec", "sans", "vs", "que", "qui",
        "the", "a", "of", "for", "and", "or", "to", "in", "on"
      ]);

      const tokens = q
        .toLowerCase()
        .split(/\s+/)
        .filter(t => t.length >= 2 && !STOP_WORDS.has(t))
        .slice(0, 5); // max 5 mots-clés (sinon trop restrictif)

      if (tokens.length === 0) {
        // Fallback : query brute (cas où tout est stop-words ou mots <2 chars)
        domaine.push(
          "|", "|", "|", "|", "|",
          ["name", "ilike", q],
          ["default_code", "ilike", q],
          ["description_sale", "ilike", q],
          ["x_ia_tags", "ilike", q],
          ["x_pdf_resume_pro", "ilike", q],
          ["x_pdf_text", "ilike", q]
        );
      } else {
        // V3 : pour CHAQUE token, on fait un OR sur les 6 champs
        // Tous les tokens doivent matcher (AND implicite entre eux)
        for (const tok of tokens) {
          domaine.push(
            "|", "|", "|", "|", "|",
            ["name", "ilike", tok],
            ["default_code", "ilike", tok],
            ["description_sale", "ilike", tok],
            ["x_ia_tags", "ilike", tok],
            ["x_pdf_resume_pro", "ilike", tok],
            ["x_pdf_text", "ilike", tok]
          );
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
      const tokens = q.toLowerCase().split(/\s+/)
        .filter(t => t.length >= 2 && !STOP_WORDS.has(t))
        .slice(0, 5);

      const domaineHorsIA = [["active", "=", true]];
      if (tokens.length === 0) {
        domaineHorsIA.push(
          "|", "|", "|", "|", "|",
          ["name", "ilike", q],
          ["default_code", "ilike", q],
          ["description_sale", "ilike", q],
          ["x_ia_tags", "ilike", q],
          ["x_pdf_resume_pro", "ilike", q],
          ["x_pdf_text", "ilike", q]
        );
      } else {
        for (const tok of tokens) {
          domaineHorsIA.push(
            "|", "|", "|", "|", "|",
            ["name", "ilike", tok],
            ["default_code", "ilike", tok],
            ["description_sale", "ilike", tok],
            ["x_ia_tags", "ilike", tok],
            ["x_pdf_resume_pro", "ilike", tok],
            ["x_pdf_text", "ilike", tok]
          );
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
// Tool 5 : calculate_quantity (V3 — Fabien ne calcule plus mentalement)
// -----------------------------------------------------------------------------
// Reçoit : dimensions chantier + produit(s) consommables
// Renvoie : quantités exactes en unités, palettes, prix HT total
//
// Exemple input :
//   {
//     surface_m2: 100,
//     epaisseur_cm: 5,           // optionnel pour produits volumiques
//     couches: 1,                 // optionnel (défaut 1)
//     coverage_per_unit: 0.055,   // m³/sac (CaNaDry sac 55L = 0.055 m³)
//     coverage_unit: "m3",        // "m2" | "m3" | "kg"
//     consommation_per_m2: null,  // ex 5 kg/m² (pour produit en kg)
//     unit_price: 15.43,          // € HT par unité
//     unit_label: "sac",          // pour affichage
//     palette_qty: 40             // optionnel : nb d'unités par palette
//   }
// -----------------------------------------------------------------------------
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

  // Calcul du besoin total selon le mode
  let besoin_total = 0;
  let besoin_unit = "";
  let formule = "";

  if (coverage_unit === "m3" && epaisseur_cm > 0 && coverage_per_unit > 0) {
    // Mode volumique : surface × épaisseur = volume → divisé par couverture/unité
    const volume_m3 = (surface_m2 * epaisseur_cm) / 100; // cm → m
    besoin_total = volume_m3 * couches;
    besoin_unit = "m³";
    formule = `${surface_m2} m² × ${epaisseur_cm} cm × ${couches} couche(s) = ${volume_m3.toFixed(2)} m³`;
  } else if (coverage_unit === "kg" && consommation_per_m2 > 0) {
    // Mode pondéral : surface × consommation × couches
    besoin_total = surface_m2 * consommation_per_m2 * couches;
    besoin_unit = "kg";
    formule = `${surface_m2} m² × ${consommation_per_m2} kg/m² × ${couches} couche(s) = ${besoin_total.toFixed(1)} kg`;
  } else if (coverage_unit === "m2") {
    // Mode surfacique simple (couvrance par unité = m²/unité)
    besoin_total = surface_m2 * couches;
    besoin_unit = "m²";
    formule = `${surface_m2} m² × ${couches} couche(s) = ${besoin_total.toFixed(1)} m²`;
  } else {
    return { error: "Configuration insuffisante : besoin de coverage_unit + (epaisseur_cm OR consommation_per_m2)" };
  }

  // Conversion besoin → nombre d'unités
  let unites_brutes = 0;
  if (coverage_per_unit > 0) {
    unites_brutes = besoin_total / coverage_per_unit;
  } else if (coverage_unit === "kg") {
    // Si pas de coverage_per_unit en kg, on assume 1 unité = 1 kg (rare)
    unites_brutes = besoin_total;
  }

  const unites_arrondi = Math.ceil(unites_brutes); // toujours arrondir au-dessus
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
    besoin_total: +besoin_total.toFixed(2),
    besoin_unit,
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
    note_chantier: "Quantités calculées sans pertes. Prévoir +5 à +10% de marge selon complexité du chantier."
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
    cta: {
      panier: "Ajouter au panier sur faireko.be",
      devis_pdf: "Demander un devis PDF officiel à hello@nbsdistribution.eu",
      expert: "Appeler un conseiller FAIRĒKO pour validation chantier"
    },
    note: "Prix HT indicatifs depuis Odoo. Devis officiel sur demande. TVA 21% (Belgique)."
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
