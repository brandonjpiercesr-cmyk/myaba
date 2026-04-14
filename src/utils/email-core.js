// ⬡B:iman.processor:CORE:email_core_v2_multiaccount:20260413⬡
// Email Shared Core Library — IMAN (Intelligent Mail and Notification Agent)
// Source of truth for: CIP EmailView, CIB EmailApp
// Safety-critical: 911 Rule 2 email identity routing enforced here.
// NEVER hardcode Nylas grants. Always load dynamically from /api/iman/accounts.
//
// v2: Multi-account support, digest (cooked items), OAuth connect flow.
// HAM isolation: each HAM sees only their accounts.
// Account isolation: BDIF emails never show in MH Action context.

import { useState, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export const MARK_READ_DELAY = 3000;
export const EMAIL_FOLDERS = ['inbox', 'sent'];
export const DIGEST_POLL_INTERVAL = 60000; // Check for new cooked items every 60s

// ═══════════════════════════════════════════════════════════════════════════
// ACCOUNT MANAGEMENT — Multi-account Nylas connections
// ═══════════════════════════════════════════════════════════════════════════

// Load connected email accounts for this HAM
export async function fetchAccounts(api, userId) {
  try {
    const result = await api(`/api/iman/accounts?userId=${encodeURIComponent(userId)}`);
    return result.accounts || [];
  } catch (err) {
    console.error('[EMAIL] Accounts fetch error:', err);
    return [];
  }
}

// ⬡B:iman.processor:FIX:connect_url_client_side:20260413⬡
// Build OAuth URL client-side — no backend call needed. One less point of failure.
// After auth, Nylas redirects to /api/nylas/callback which exchanges code for grant and saves to brain.
const NYLAS_CLIENT_ID = '1c693097-2bf7-4391-b922-29880466ec8e';
const NYLAS_REDIRECT_URI = 'https://abacia-services.onrender.com/api/nylas/callback';
const NYLAS_SCOPES = 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/contacts';

export function getConnectUrl(api, userId, provider = 'google') {
  const params = new URLSearchParams({
    client_id: NYLAS_CLIENT_ID,
    redirect_uri: NYLAS_REDIRECT_URI,
    response_type: 'code',
    access_type: 'offline',
    scope: NYLAS_SCOPES,
  });
  if (userId && userId.includes('@')) {
    params.set('login_hint', userId);
  }
  return 'https://api.us.nylas.com/v3/connect/auth?' + params.toString();
}

// ⬡B:911.ham_isolation:REMOVED:loadAccounts_api_team:20260413⬡
// REMOVED: loadAccounts called /api/team which returned ALL HAMs.
// Brandon's email leaked to BJ. Use fetchAccounts (HAM-isolated) only.

// ═══════════════════════════════════════════════════════════════════════════
// EMAIL FETCHING — Per-account isolation
// ═══════════════════════════════════════════════════════════════════════════

// Fetch emails for a specific account (account-isolated)
export async function fetchEmails(api, folder, userId, limit = 20, account = null) {
  try {
    let url = `/api/iman/emails?userId=${encodeURIComponent(userId)}&folder=${folder}&limit=${limit}`;
    if (account) url += `&account=${encodeURIComponent(account)}`;
    const result = await api(url);
    return result.emails || [];
  } catch (err) {
    console.error('[EMAIL] Fetch error:', err);
    return [];
  }
}

// Mark an email as read
export async function markEmailRead(api, emailId, userId) {
  try {
    await api(`/api/email/${emailId}/read?userId=${encodeURIComponent(userId)}`, { method: 'PATCH' });
  } catch (err) {
    console.error('[EMAIL] Mark read error:', err);
  }
}

// Send a reply
export async function sendReply(api, emailId, body, userId) {
  try {
    return await api('/api/email/reply', {
      method: 'POST',
      body: { emailId, body, userId }
    });
  } catch (err) {
    console.error('[EMAIL] Reply error:', err);
    return null;
  }
}

// Ask ABA about an email
export async function askAboutEmail(api, email, question, userId) {
  try {
    const result = await api('/api/air/process', {
      method: 'POST',
      body: {
        message: `About this email from ${email.from?.[0]?.name || 'someone'} with subject "${email.subject || ''}": ${question}\n\nEmail content: ${(email.snippet || email.body || '').substring(0, 500)}`,
        user_id: userId,
        channel: 'myaba',
      }
    });
    return result.response || result.message || '';
  } catch (err) {
    return 'Could not reach ABA right now';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DIGEST — What ABA has cooked (proactive email processing)
// ═══════════════════════════════════════════════════════════════════════════

// Fetch digest (cooked items) for this HAM
export async function fetchDigest(api, userId, options = {}) {
  try {
    const { since, category, limit = 30, account } = options;
    let url = `/api/iman/digest?userId=${encodeURIComponent(userId)}&limit=${limit}`;
    if (since) url += `&since=${encodeURIComponent(since)}`;
    if (category) url += `&category=${encodeURIComponent(category)}`;
    if (account) url += `&account=${encodeURIComponent(account)}`;
    const result = await api(url);
    return result;
  } catch (err) {
    console.error('[EMAIL] Digest fetch error:', err);
    return { success: false, items: [], total: 0 };
  }
}

// Trigger immediate inbox processing
export async function processInbox(api, userId) {
  try {
    const result = await api('/api/iman/process', {
      method: 'POST',
      body: { user_id: userId }
    });
    return result;
  } catch (err) {
    console.error('[EMAIL] Process inbox error:', err);
    return { success: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REACT HOOKS
// ═══════════════════════════════════════════════════════════════════════════

// Multi-account hook — manages connected accounts and adding new ones
export function useAccounts(api, userId) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchAccounts(api, userId);
    setAccounts(result);
    setLoading(false);
  }, [api, userId]);

  useEffect(() => { load(); }, [load]);

  const connect = useCallback((provider = 'google') => {
    const url = getConnectUrl(null, userId, provider);
    if (url) window.open(url, '_blank');
  }, [userId]);

  return { accounts, loading, reload: load, connect };
}

// Email inbox hook — manages emails, folder, loading, per-account filtering
export function useInbox(api, userId, account = null) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState('inbox');
  const [selectedEmail, setSelectedEmail] = useState(null);

  const load = useCallback(async (f) => {
    const target = f || folder;
    setLoading(true); setSelectedEmail(null);
    const result = await fetchEmails(api, target, userId, 20, account);
    setEmails(result);
    setLoading(false);
  }, [api, userId, folder, account]);

  useEffect(() => { load(folder); }, [folder, account]);

  useEffect(() => {
    if (!selectedEmail?.id || !selectedEmail.unread) return;
    const timer = setTimeout(() => markEmailRead(api, selectedEmail.id, userId), MARK_READ_DELAY);
    return () => clearTimeout(timer);
  }, [selectedEmail?.id, api, userId]);

  const changeFolder = useCallback((f) => { setFolder(f); }, []);

  return { emails, loading, folder, changeFolder, selectedEmail, setSelectedEmail, load };
}

// Digest hook — cooked email items, auto-refreshes
export function useDigest(api, userId, account = null) {
  const [digest, setDigest] = useState({ items: [], total: 0, needs_response: 0, assignments: 0, receipts: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const result = await fetchDigest(api, userId, { account });
    if (result.success !== false) setDigest(result);
    setLoading(false);
  }, [api, userId, account]);

  useEffect(() => {
    load();
    const interval = setInterval(load, DIGEST_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [load]);

  const process = useCallback(async () => {
    setLoading(true);
    await processInbox(api, userId);
    await load();
  }, [api, userId, load]);

  return { digest, loading, reload: load, process };
}
