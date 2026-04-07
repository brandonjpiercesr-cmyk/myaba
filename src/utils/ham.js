// ⬡B:MACE.phase0:UTILS:ham_shared:20260405⬡
// HAM identity resolution — extracted from MyABA.jsx
// Used by JobsView, SettingsDrawer, MemosView, MyABAInner

import { ABABASE } from './api.js';

// ⬡B:ham.resolve:CACHE:backend_identity_resolution:20260327⬡
// HAM identity resolution from backend. Replaces hardcoded hamMap.
// Loaded once on module init, used by all components that need email→hamId.
export let HAM_EMAIL_MAP = {};
export let HAM_TEAM = [];

(async () => {
  try {
    const r = await fetch(`${ABABASE}/api/ham/team`);
    if (r.ok) {
      const d = await r.json();
      if (d.team) {
        HAM_TEAM = d.team;
        for (const t of d.team) {
          if (t.email) HAM_EMAIL_MAP[t.email.toLowerCase()] = t.ham_id;
        }
        console.log('[HAM] Team cache loaded:', Object.keys(HAM_EMAIL_MAP).length, 'members');
      }
    }
  } catch (e) { console.log('[HAM] Cache load failed, using fallback:', e.message); }
})();

export function resolveHamId(email) {
  if (!email) return 'all';
  const e = email.toLowerCase();
  return HAM_EMAIL_MAP[e] || e.split('@')[0] || 'all';
}

// v2.15.0: Admin mode for HAM users
// ⬡B:ham.audit:FIX:dynamic_isHAM:20260330⬡ Uses backend HAM team cache, not hardcoded emails
export function isHAM(email) { return !!email && !!HAM_EMAIL_MAP[email.toLowerCase()]; }
