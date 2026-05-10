// netlify/functions/lib/rules.mjs
//
// Moteur de règles doctrinales FAIRĒKO.
// Source : data/rules.json (versionné Git, pas d'appel Odoo).
//
// Verdicts : compatible | incompatible | expert_requis
// Evidence : DOCUMENT_OFFICIEL | EPD_FDES | BASE_EXTERNE | ESTIMATION_IA
// Status opposable (calculé) : documente | partiel | a_verifier

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const EVIDENCE_TO_OPPOSABLE = {
  DOCUMENT_OFFICIEL: 'documente',
  EPD_FDES: 'documente',
  BASE_EXTERNE: 'partiel',
  ESTIMATION_IA: 'a_verifier',
};

let cachedRules = null;
let cachedAt = 0;
const RULES_TTL_MS = 60 * 1000; // 1 min — re-lecture régulière au cas où le repo est redéployé

async function loadRules() {
  if (cachedRules && Date.now() - cachedAt < RULES_TTL_MS) return cachedRules;

  // Le fichier est packagé dans le bundle Netlify Function via netlify.toml
  // included_files. Sinon on essaie plusieurs paths.
  const candidates = [
    join(__dirname, '..', '..', '..', 'data', 'rules.json'),
    join(__dirname, '..', '..', 'data', 'rules.json'),
    join(process.cwd(), 'data', 'rules.json'),
  ];

  for (const p of candidates) {
    try {
      const raw = await readFile(p, 'utf-8');
      cachedRules = JSON.parse(raw);
      cachedAt = Date.now();
      if (!Array.isArray(cachedRules)) {
        console.warn('[ai-bridge] rules.json must be an array, got', typeof cachedRules);
        cachedRules = [];
      }
      return cachedRules;
    } catch (e) {
      // try next path
    }
  }
  console.warn('[ai-bridge] rules.json not found in any candidate path');
  cachedRules = [];
  return cachedRules;
}

export async function matchRules(payload = {}) {
  const ctx = payload.context || {};
  const ruleSetFilter = payload.rule_set;
  const rules = await loadRules();
  const matches = [];

  for (const rule of rules) {
    if (ruleSetFilter && rule.rule_set !== ruleSetFilter) continue;
    if (!matchesWhen(rule.when || {}, ctx)) continue;

    const { ok, reason } = checkRequire(rule.require || {}, ctx);
    const evidence = rule.evidence || 'ESTIMATION_IA';
    const opposable = EVIDENCE_TO_OPPOSABLE[evidence] || 'a_verifier';

    matches.push({
      rule_id: rule.id,
      name: rule.name,
      rule_set: rule.rule_set,
      verdict: ok ? rule.verdict : 'expert_requis',
      require_ok: ok,
      require_reason: reason,
      evidence,
      source: rule.source,
      vigilance: rule.vigilance,
      status_opposable: opposable,
    });
  }

  return {
    context_received: ctx,
    matches,
    count: matches.length,
  };
}

function matchesWhen(whenClause, ctx) {
  if (!whenClause || Object.keys(whenClause).length === 0) return false;
  for (const [key, accepted] of Object.entries(whenClause)) {
    const v = ctx[key];
    if (Array.isArray(accepted)) {
      if (!accepted.includes(v)) return false;
    } else {
      if (v !== accepted) return false;
    }
  }
  return true;
}

function checkRequire(requireClause, ctx) {
  if (!requireClause || Object.keys(requireClause).length === 0) return { ok: true, reason: null };
  for (const [key, allowed] of Object.entries(requireClause)) {
    const v = ctx[key];
    if (v === undefined || v === null) {
      return { ok: false, reason: `Champ manquant : ${key}` };
    }
    if (Array.isArray(allowed) && !allowed.includes(v)) {
      return { ok: false, reason: `${key}=${v} hors liste autorisée` };
    }
  }
  return { ok: true, reason: null };
}
