// netlify/functions/lib/document.mjs
//
// Recherche dans knowledge.article (Enterprise) + ir.attachment.
// knowledge.article est soft-dependency : si absent, on retombe sur attachments seuls.

import { orm } from './odoo-rpc.mjs';

export async function searchDocuments(payload = {}) {
  const query = (payload.query || '').trim();
  const scope = payload.scope || ['knowledge', 'attachments'];
  const productId = payload.product_id;
  const limit = Math.min(parseInt(payload.limit ?? 20, 10), 100);

  const result = { knowledge: [], attachments: [] };

  if (scope.includes('knowledge')) {
    result.knowledge = await searchKnowledge(query, limit);
  }
  if (scope.includes('attachments')) {
    result.attachments = await searchAttachments(query, productId, limit);
  }

  return result;
}

async function searchKnowledge(query, limit) {
  try {
    const domain = [['active', '=', true]];
    if (query) {
      domain.unshift('|', ['name', 'ilike', query], ['body', 'ilike', query]);
    }
    const articles = await orm.search_read(
      'knowledge.article',
      domain,
      ['id', 'name', 'body', 'write_date'],
      { limit, order: 'write_date desc' }
    );
    return articles.map(a => ({
      id: a.id,
      name: a.name,
      url: `/odoo/knowledge/${a.id}`,
      write_date: a.write_date || null,
      snippet: stripHtml(a.body || '').slice(0, 300),
    }));
  } catch (e) {
    // knowledge module absent → soft fallback
    console.warn('[ai-bridge] knowledge.article search failed (module absent?):', e.message);
    return [];
  }
}

async function searchAttachments(query, productId, limit) {
  const domain = [];

  if (productId) {
    domain.push(['res_model', '=', 'product.template']);
    domain.push(['res_id', '=', parseInt(productId, 10)]);
  } else {
    // Sécurité : seulement publics ou modèles non sensibles
    domain.push('|',
      ['public', '=', true],
      ['res_model', 'in', [
        'product.template', 'product.product',
        'website.page', 'knowledge.article',
      ]],
    );
  }
  if (query) {
    domain.push(['name', 'ilike', query]);
  }

  try {
    const atts = await orm.search_read(
      'ir.attachment',
      domain,
      ['id', 'name', 'mimetype', 'res_model', 'res_id', 'public', 'file_size'],
      { limit, order: 'create_date desc' }
    );
    return atts.map(a => ({
      id: a.id,
      name: a.name,
      mimetype: a.mimetype,
      url: `/web/content/${a.id}?download=true`,
      res_model: a.res_model,
      res_id: a.res_id,
      public: a.public,
      file_size: a.file_size,
    }));
  } catch (e) {
    console.warn('[ai-bridge] ir.attachment search failed:', e.message);
    return [];
  }
}

// Strip HTML très basique pour les snippets
function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
