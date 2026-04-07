// ⬡B:MACE.phase4:CORE:email_core:20260406⬡
// Email Shared Core Library — IMAN (Intelligent Mail and Notification Agent)
// Source of truth for: CIP EmailView, CIB EmailApp
// Safety-critical: 911 Rule 2 email identity routing enforced here.
// NEVER hardcode Nylas grants. Always load dynamically from /api/team.

import { useState, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

// Mark-read delay (ms) — how long an email must be viewed before marking read
export const MARK_READ_DELAY = 3000;

// Default folders
export const EMAIL_FOLDERS = ['inbox', 'sent'];

// ═══════════════════════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

// Load team accounts with Nylas grants — NEVER hardcode grants
export async function loadAccounts(api) {
  try {
    const result = await api('/api/team');
    if (result.success && result.members) {
      return result.members.filter(m => m.has_nylas).map(m => ({
        id: m.id, label: m.name, email: m.email, grant: '', color: m.color?.replace('#', '') || 'purple',
      }));
    }
    return [];
  } catch (err) {
    console.error('[EMAIL] Account load error:', err);
    return [];
  }
}

// Fetch emails for a folder (inbox, sent)
export async function fetchEmails(api, folder, userId, limit = 20) {
  try {
    const result = await api(`/api/email/${folder}?userId=${encodeURIComponent(userId)}&limit=${limit}`);
    return result.emails || result.messages || result.data || [];
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
// REACT HOOKS
// ═══════════════════════════════════════════════════════════════════════════

// Email inbox hook — manages emails, folder, loading, mark-read timer
export function useInbox(api, userId) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState('inbox');
  const [selectedEmail, setSelectedEmail] = useState(null);

  const load = useCallback(async (f) => {
    const target = f || folder;
    setLoading(true); setSelectedEmail(null);
    const result = await fetchEmails(api, target, userId);
    setEmails(result);
    setLoading(false);
  }, [api, userId, folder]);

  useEffect(() => { load(folder); }, [folder]);

  // Mark-read timer — fires MARK_READ_DELAY ms after selecting an email
  useEffect(() => {
    if (!selectedEmail?.id || !selectedEmail.unread) return;
    const timer = setTimeout(() => markEmailRead(api, selectedEmail.id, userId), MARK_READ_DELAY);
    return () => clearTimeout(timer);
  }, [selectedEmail?.id, api, userId]);

  const changeFolder = useCallback((f) => { setFolder(f); }, []);

  return { emails, loading, folder, changeFolder, selectedEmail, setSelectedEmail, load };
}
