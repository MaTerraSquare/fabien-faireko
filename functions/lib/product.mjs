// netlify/functions/lib/product.mjs
//
// Recherche et lecture de fiches produits.
//
// Filtre doctrinal FAIREKO par défaut :
//   x_owner_entity = 'FAIREKO'
//   x_visible_ia = True
//   x_niveau_confiance in ('2', '3')
//   website_published = True
//
// Règle d'or : ne JAMAIS combler false/null. Lambda, μ, U, Rw, Rf, Euroclasse,
// CO₂ sont renvoyés en `null` si absents — l'IA ne doit pas inventer.

import { orm } from './odoo-rpc.mjs';

const TECH_FIELDS = [
  'x_studio_conductivit_wmk',
  'x_reaction_feu',
  'x_fumee_classe',
  'x_gouttes_classe',
  'x_mu_min',
  'x_mu_max',
  'x_vapeur_ouvert',
  'x_alpha_w',
  'x_rw_db',
  'x_co2_a1a3',
  'x_biosource_pct',
  'x_eta_ref',
  'x_niveau_confiance',
  'x_visible_ia',
  'x_owner_entity',
  'x_ia_tags',
  'x_note_interne',
  'x_liant_type',
  'x_category_tech',
];

const BASE_FIELDS = [
  'id', 'name', 'default_code', 'list_price',
  'description_sale', 'website_published',
  'public_categ_ids', 'website_url', 'company_id',
  'product_variant_id',
];

const noneIfFalsy = (v) => (v === false || v === '' || v === null || v === undefined) ? null : v;

// ─── SEARCH ──────────────────────────────────────────────────────────
export async function searchProducts(payload = {}) {
  const query = (payload.query || '').trim();
  const categoryIds = payload.category_ids || [];
  const ownerEntity = payload.owner_entity || 'FAIREKO';
  const minConfidence = String(payload.min_confidence ?? '2');
  const includeIaInvisible = !!payload.include_ia_invisible;
  const limit = Math.min(parseInt(payload.limit ?? 20, 10), 100);
  const offset = Math.max(parseInt(payload.offset ?? 0, 10), 0);

  const confidenceLevels =
    minConfidence === '3' ? ['3'] :
    minConfidence === '2' ? ['2', '3'] :
    ['1', '2', '3'];

  // Domaine Odoo (notation préfixe pour |)
  const domain = [
    ['website_published', '=', true],
    ['x_owner_entity', '=', ownerEntity],
    ['x_niveau_confiance', 'in', confidenceLevels],
  ];
  if (!includeIaInvisible) {
    domain.push(['x_visible_ia', '=', true]);
  }
  if (query) {
    // OR sur name | default_code | description_sale
    domain.push('|', '|',
      ['name', 'ilike', query],
      ['default_code', 'ilike', query],
      ['description_sale', 'ilike', query],
    );
  }
  if (categoryIds.length) {
    domain.push(['public_categ_ids', 'in', categoryIds]);
  }

  const total = await orm.search_count('product.template', domain);
  const records = await orm.search_read(
    'product.template',
    domain,
    [
      'id', 'name', 'default_code', 'list_price', 'website_url',
      'public_categ_ids',
      'x_owner_entity', 'x_niveau_confiance',
    ],
    { limit, offset, order: 'name asc' }
  );

  const items = records.map(r => ({
    id: r.id,
    name: r.name,
    default_code: r.default_code || null,
    list_price: r.list_price,
    website_url: r.website_url || null,
    public_categ_ids: r.public_categ_ids || [],
    x_owner_entity: noneIfFalsy(r.x_owner_entity),
    x_niveau_confiance: noneIfFalsy(r.x_niveau_confiance),
  }));

  return { items, total };
}

// ─── READ CARD ───────────────────────────────────────────────────────
export async function readProduct(productId) {
  const fields = [...BASE_FIELDS, ...TECH_FIELDS];
  const records = await orm.read('product.template', [productId], fields);
  if (!records || records.length === 0) return null;

  const r = records[0];

  // Garde-fou doctrinal : refuser si invisible IA ou non publié
  if (r.x_visible_ia === false || r.website_published === false) return null;

  // Champs techniques avec null si false/null
  const tech = {};
  for (const f of TECH_FIELDS) {
    tech[f] = noneIfFalsy(r[f]);
  }

  // Categories : lire les noms
  let categories = [];
  if (r.public_categ_ids?.length) {
    categories = await orm.read(
      'product.public.category',
      r.public_categ_ids,
      ['id', 'name']
    );
  }

  // Attachments via product.document (méthode B++ KB#370)
  const attachments = await readAttachments(productId);

  // Prix négoces (pricelist id=4)
  const priceNegoce = await computePriceForVariant(r.product_variant_id, 4);

  return {
    id: r.id,
    name: r.name,
    default_code: r.default_code || null,
    description_sale: r.description_sale || null,
    list_price: r.list_price,
    price_negoce: priceNegoce,
    website_url: r.website_url || null,
    website_published: r.website_published,
    public_categ_ids: categories.map(c => ({ id: c.id, name: c.name })),
    tech,
    attachments,
    _meta: {
      source: 'odoo.product.template',
      company_id: Array.isArray(r.company_id) ? r.company_id[0] : r.company_id,
      fields_returned: fields,
    },
  };
}

async function readAttachments(productTemplateId) {
  // product.document → champ critique ir_attachment_id (cf. KB#370)
  let docs = [];
  try {
    docs = await orm.search_read(
      'product.document',
      [
        ['res_model', '=', 'product.template'],
        ['res_id', '=', productTemplateId],
      ],
      ['id', 'name', 'ir_attachment_id'],
      { limit: 50 }
    );
  } catch (e) {
    // product.document peut ne pas exister selon la version — fallback ir.attachment direct
    console.warn('[ai-bridge] product.document unavailable, fallback to ir.attachment:', e.message);
    const atts = await orm.search_read(
      'ir.attachment',
      [
        ['res_model', '=', 'product.template'],
        ['res_id', '=', productTemplateId],
      ],
      ['id', 'name', 'mimetype', 'public', 'file_size'],
      { limit: 50 }
    );
    return atts.map(a => ({
      id: a.id,
      name: a.name,
      mimetype: a.mimetype,
      url: `/web/content/${a.id}?download=true`,
      public: a.public,
    }));
  }

  // Récupérer les ir.attachment liés
  const attIds = docs
    .map(d => Array.isArray(d.ir_attachment_id) ? d.ir_attachment_id[0] : d.ir_attachment_id)
    .filter(Boolean);
  if (!attIds.length) return [];

  const atts = await orm.read('ir.attachment', attIds, ['id', 'name', 'mimetype', 'public', 'file_size']);
  return atts.map(a => ({
    id: a.id,
    name: a.name,
    mimetype: a.mimetype,
    url: `/web/content/${a.id}?download=true`,
    public: a.public,
  }));
}

async function computePriceForVariant(variantField, pricelistId) {
  if (!variantField) return null;
  const variantId = Array.isArray(variantField) ? variantField[0] : variantField;
  if (!variantId) return null;
  try {
    // Odoo v19 : product.pricelist._get_product_price
    // Note : méthode privée mais accessible via execute_kw avec un user authentifié
    const price = await orm.read('product.pricelist', [pricelistId], ['id', 'name']);
    if (!price?.length) return null;
    // On utilise la route _get_product_price qui retourne le prix unitaire qty=1
    // Si la méthode n'est pas exposée → on retombe sur null (l'IA ne comble pas)
    const result = await import('./odoo-rpc.mjs').then(m =>
      m.call('product.pricelist', '_get_product_price', [pricelistId, variantId, 1.0])
    );
    return typeof result === 'number' ? Math.round(result * 100) / 100 : null;
  } catch (e) {
    console.warn('[ai-bridge] pricelist compute failed:', e.message);
    return null;
  }
}
