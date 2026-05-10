// netlify/functions/lib/cart.mjs
//
// Création de sale.order en state='draft'.
// L'IA ne confirme JAMAIS le panier.
//
// Garde-fous :
//   - Chaque ligne vérifiée : product existe, website_published=True,
//     x_visible_ia=True, x_owner_entity matche audience.
//   - Pricelist 4 (Prix Négoces) si audience='negoce'.
//   - Partner : recherche par email, sinon création minimale,
//     sinon Public User (anonyme).

import { orm, call } from './odoo-rpc.mjs';

const AUDIENCE_PRICELIST = {
  b2c: null,        // pricelist par défaut Odoo
  negoce: 4,        // Prix Négoces
  otra: null,
};

const AUDIENCE_OWNER_ENTITY = {
  b2c: 'FAIREKO',
  negoce: 'FAIREKO',
  otra: 'OTRA',
};

class BadRequestError extends Error {
  constructor(msg) { super(msg); this.code = 'BAD_REQUEST'; }
}

export async function createDraftCart(payload = {}) {
  const lines = payload.lines || [];
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new BadRequestError('lines is required and must be non-empty');
  }
  const audience = payload.audience || 'b2c';
  if (!(audience in AUDIENCE_PRICELIST)) {
    throw new BadRequestError(`audience must be one of ${Object.keys(AUDIENCE_PRICELIST).join(', ')}`);
  }

  // 1) Validation préalable des lignes (échec rapide avant toute écriture)
  const validated = await validateLines(lines, audience);

  // 2) Partner
  const partner = await resolvePartner(payload.partner_email, payload.partner_name);

  // 3) Création de la commande
  const orderVals = {
    partner_id: partner.id,
    state: 'draft',
    origin: 'Fabien IA / faireko-ai-bridge',
    note: payload.note || '',
  };
  const pricelistId = AUDIENCE_PRICELIST[audience];
  if (pricelistId) orderVals.pricelist_id = pricelistId;

  const orderId = await orm.create('sale.order', orderVals);

  // 4) Lignes
  for (const ln of validated) {
    const lineVals = {
      order_id: orderId,
      product_id: ln.variantId,
      product_uom_qty: ln.qty,
    };
    if (ln.note) {
      lineVals.name = `${ln.displayName}\n${ln.note}`;
    }
    await orm.create('sale.order.line', lineVals);
  }

  // 5) Relire la commande pour totaux
  const orders = await orm.read('sale.order', [orderId], [
    'id', 'name', 'state', 'partner_id',
    'amount_untaxed', 'amount_tax', 'amount_total',
    'currency_id', 'pricelist_id', 'order_line',
  ]);
  const o = orders[0];

  // Tentative de récupérer le portal_url (pas garanti selon version)
  let portalUrl = null;
  try {
    const r = await call('sale.order', 'get_portal_url', [[orderId]]);
    portalUrl = typeof r === 'string' ? r : (Array.isArray(r) ? r[0] : null);
  } catch (e) {
    // pas critique
  }

  return {
    sale_order_id: o.id,
    name: o.name,
    state: o.state,
    partner: {
      id: partner.id,
      name: partner.name,
      email: partner.email || null,
    },
    amount_untaxed: o.amount_untaxed,
    amount_tax: o.amount_tax,
    amount_total: o.amount_total,
    currency: Array.isArray(o.currency_id) ? o.currency_id[1] : null,
    pricelist_id: Array.isArray(o.pricelist_id) ? o.pricelist_id[0] : (o.pricelist_id || null),
    lines_count: (o.order_line || []).length,
    portal_url: portalUrl,
    _warning: 'L\'order est en DRAFT. Aucune confirmation faite par l\'IA.',
  };
}

// ─── helpers ─────────────────────────────────────────────────────────
async function resolvePartner(email, name) {
  if (email) {
    const found = await orm.search_read(
      'res.partner',
      [['email', '=ilike', email]],
      ['id', 'name', 'email'],
      { limit: 1 }
    );
    if (found.length) return found[0];
    // Créer un partner minimal
    const newId = await orm.create('res.partner', {
      name: name || email.split('@')[0],
      email,
      comment: 'Créé via faireko-ai-bridge (Fabien IA)',
    });
    return { id: newId, name: name || email.split('@')[0], email };
  }
  // Public user
  const publicPartners = await orm.search_read(
    'res.partner',
    [['name', '=', 'Public user']],
    ['id', 'name', 'email'],
    { limit: 1 }
  );
  if (publicPartners.length) return publicPartners[0];
  throw new BadRequestError('Cannot resolve partner: no email and no public user found');
}

async function validateLines(lines, audience) {
  const expectedOwner = AUDIENCE_OWNER_ENTITY[audience];
  const out = [];

  for (const ln of lines) {
    const pid = ln.product_id;
    const qty = ln.qty;
    if (!pid || qty === undefined || qty === null) {
      throw new BadRequestError('each line needs product_id and qty');
    }
    if (qty <= 0) {
      throw new BadRequestError(`qty must be > 0 (line product_id=${pid})`);
    }

    const recs = await orm.read('product.template', [parseInt(pid, 10)], [
      'id', 'name', 'display_name',
      'website_published', 'x_visible_ia', 'x_owner_entity',
      'product_variant_id',
    ]);
    if (!recs.length) {
      throw new BadRequestError(`product_id ${pid} not found`);
    }
    const tpl = recs[0];
    if (!tpl.website_published) {
      throw new BadRequestError(`product_id ${pid} is not website_published`);
    }
    if (tpl.x_visible_ia === false) {
      throw new BadRequestError(`product_id ${pid} is not visible to AI (x_visible_ia=False)`);
    }
    if (tpl.x_owner_entity && tpl.x_owner_entity !== expectedOwner) {
      throw new BadRequestError(
        `product_id ${pid} owner_entity=${tpl.x_owner_entity} ` +
        `but audience=${audience} expects ${expectedOwner}`
      );
    }
    const variantId = Array.isArray(tpl.product_variant_id)
      ? tpl.product_variant_id[0]
      : tpl.product_variant_id;
    if (!variantId) {
      throw new BadRequestError(`product_id ${pid} has no variant`);
    }
    out.push({
      templateId: tpl.id,
      variantId,
      qty: Number(qty),
      note: ln.note || null,
      displayName: tpl.display_name || tpl.name,
    });
  }
  return out;
}
