// netlify/functions/lib/auth.mjs
//
// Vérification Bearer timing-safe (crypto.timingSafeEqual).
// Token attendu dans env var AI_BRIDGE_TOKEN.

import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';

export function verifyBearer(headers) {
  // Netlify normalise les headers en lowercase
  const auth = headers?.authorization || headers?.Authorization || '';
  if (!auth) return { ok: false, reason: 'Missing Authorization header' };

  const parts = auth.split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return { ok: false, reason: 'Authorization must be "Bearer <token>"' };
  }
  const provided = parts[1].trim();
  if (!provided) return { ok: false, reason: 'Empty token' };

  const expected = process.env.AI_BRIDGE_TOKEN || '';
  if (!expected) {
    console.warn('[ai-bridge] AI_BRIDGE_TOKEN env var is not configured');
    return { ok: false, reason: 'Server token not configured' };
  }

  // Comparaison en temps constant — buffers de même longueur obligatoires
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return { ok: false, reason: 'Invalid token' };
  }
  if (!timingSafeEqual(a, b)) {
    return { ok: false, reason: 'Invalid token' };
  }
  return { ok: true };
}
