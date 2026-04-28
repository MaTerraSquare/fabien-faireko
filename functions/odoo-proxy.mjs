// =============================================================================
// FAIRĒKO — ODOO PROXY V4 (PDF + SYSTEM + PROPRE)
// =============================================================================

const FILTRE_IA = [
  ["x_owner_entity", "=", "FAIREKO"],
  ["x_visible_ia", "=", true],
  ["x_niveau_confiance", "in", ["3", "4", "5"]],
  ["website_published", "=", true]
];

// ----------------------
// CHAMPS PRODUITS
// ----------------------
const CHAMPS_DETAIL = [
  "id",
  "name",
  "description_sale",
  "x_category_tech",
  "x_system_role",
  "x_studio_conductivit_wmk",
  "x_mu_min",
  "x_mu_max",
  "x_liant_type",
  "x_pdf_text",
  "x_ia_tags",
  "list_price"
];

// ----------------------
// HELPERS
// ----------------------
function cors(res) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return res;
}

function json(data, status = 200) {
  return cors(new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  }));
}

async function odoo(model, method, args, kwargs = {}) {
  const url = Netlify.env.get("ODOO_URL");
  const db = Netlify.env.get("ODOO_DB");
  const uid = parseInt(Netlify.env.get("ODOO_UID"), 10);
  const key = Netlify.env.get("ODOO_API_KEY");

  const res = await fetch(url + "/jsonrpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: "object",
        method: "execute_kw",
        args: [db, uid, key, model, method, args, kwargs]
      }
    })
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

// ----------------------
// 🔎 PRODUITS (SMART SEARCH)
// ----------------------
async function search_products(input) {
  const domain = [...FILTRE_IA];

  if (input.query) {
    const q = input.query;

    domain.push(
      "|","|","|","|",
      ["name", "ilike", q],
      ["default_code", "ilike", q],
      ["description_sale", "ilike", q],
      ["x_pdf_text", "ilike", q], // 🔥 PDF
      ["x_ia_tags", "ilike", q]
    );
  }

  const res = await odoo("product.template", "search_read", [domain], {
    fields: [
      "id",
      "name",
      "x_category_tech",
      "x_studio_conductivit_wmk",
      "list_price"
    ],
    limit: 6,
    order: "x_niveau_confiance desc"
  });

  return {
    count: res.length,
    products: res
  };
}

// ----------------------
// 📄 PRODUIT + PDF COMPLET
// ----------------------
async function get_product_details(input) {
  const res = await odoo("product.template", "search_read", [[
    ...FILTRE_IA,
    ["id", "=", input.product_id]
  ]], {
    fields: CHAMPS_DETAIL,
    limit: 1
  });

  if (!res.length) return { error: "not found" };

  const p = res[0];

  return {
    produit: p,
    fiche_pdf: p.x_pdf_text || "",
    resume: (p.x_pdf_text || "").slice(0, 1500) // ⚡ optimisation tokens
  };
}

// ----------------------
// 📚 KNOWLEDGE CLEAN
// ----------------------
async function search_doctrine(input) {
  const res = await odoo("knowledge.article", "search_read", [[
    "|",
    ["name", "ilike", input.query],
    ["body", "ilike", input.query]
  ]], {
    fields: ["name", "body"],
    limit: 3
  });

  return res.map(a => ({
    titre: a.name,
    texte: a.body
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 1200)
  }));
}

// ----------------------
// 🧠 SYSTEMES (ULTRA IMPORTANT)
// ----------------------
async function search_systems(input) {
  const systems = await odoo("x_generic_system", "search_read", [[
    ["x_owner_entity", "=", "FAIREKO"],
    ["x_visible_ia", "=", true]
  ]], {
    fields: ["id", "name", "x_typology"],
    limit: 5
  });

  for (let s of systems) {
    const slots = await odoo("x_function_option", "search_read", [[
      ["system_id", "=", s.id]
    ]], {
      fields: ["slot_role", "product_options_ids", "order_in_system"],
      order: "order_in_system asc"
    });

    s.slots = [];

    for (let slot of slots) {
      const products = await odoo("product.template", "read", [
        slot.product_options_ids,
        ["id","name","x_category_tech"]
      ]);

      s.slots.push({
        role: slot.slot_role,
        produits: products
      });
    }
  }

  return systems;
}

// ----------------------
// ROUTEUR
// ----------------------
const TOOLS = {
  search_products,
  get_product_details,
  search_doctrine,
  search_systems
};

// ----------------------
// HANDLER
// ----------------------
export default async (req) => {
  if (req.method === "OPTIONS") {
    return cors(new Response("", { status: 204 }));
  }

  if (req.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }

  try {
    const { tool, input } = await req.json();

    if (!TOOLS[tool]) {
      return json({ error: "outil inconnu" }, 400);
    }

    const result = await TOOLS[tool](input || {});

    return json({
      tool,
      result
    });

  } catch (e) {
    console.error(e);
    return json({ error: e.message }, 500);
  }
};
