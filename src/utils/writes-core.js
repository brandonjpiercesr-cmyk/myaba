// ⬡B:MACE.core:CORE:writes_core:20260413⬡
// WRITES Shared Core — ABA Writes Book Authoring
// Source of truth for all WRITES surfaces.

import { useState, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export async function startWritingSession(api, userId, bookId, chapter) {
  return await api('/api/writes/session', { method: 'POST', body: { user_id: userId, book_id: bookId, chapter } });
}

export async function getBookLibrary(api) {
  return await api('/api/writes/library');
}

export async function getCrossRefs(api, bookId) {
  return await api(`/api/writes/crossrefs/${bookId}`);
}

export async function getContentGaps(api, bookId) {
  return await api(`/api/writes/gaps/${bookId}`);
}

export async function saveContent(api, sessionId, userId, bookId, chapter, content, type) {
  return await api('/api/writes/content', {
    method: 'POST',
    body: { session_id: sessionId, user_id: userId, book_id: bookId, chapter, content, type: type || 'raw' }
  });
}

export async function getSuggestions(api, hamId) {
  return await api(`/api/writes/suggest/${hamId}`);
}

export async function getWritingTips(api, bookId) {
  return await api(`/api/writes/tips/${bookId}`);
}

// ═══════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════

export function useWritingSession(api, userId) {
  const [session, setSession] = useState(null);
  const [library, setLibrary] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contentBlocks, setContentBlocks] = useState([]);

  const loadLibrary = useCallback(async () => {
    try {
      const data = await getBookLibrary(api);
      setLibrary(data?.books || null);
    } catch (e) { console.error('[WRITES] Library error:', e); }
  }, [api]);

  const loadSuggestions = useCallback(async () => {
    try {
      const data = await getSuggestions(api, userId);
      setSuggestions(data?.suggestions || []);
    } catch (e) { /* ok */ }
  }, [api, userId]);

  const startSession = useCallback(async (bookId, chapter) => {
    setLoading(true);
    try {
      const data = await startWritingSession(api, userId, bookId, chapter);
      setSession(data);
      setContentBlocks([]);
    } catch (e) {
      console.error('[WRITES] Session error:', e);
    }
    setLoading(false);
  }, [api, userId]);

  const addContent = useCallback(async (content, type = 'raw') => {
    if (!session) return;
    setLoading(true);
    try {
      const result = await saveContent(api, session.sessionId, userId, session.bookId || '', session.chapter || 0, content, type);
      setContentBlocks(prev => [...prev, { content, type, savedAt: new Date().toISOString(), ...result }]);
    } catch (e) {
      console.error('[WRITES] Save error:', e);
    }
    setLoading(false);
  }, [api, userId, session]);

  return {
    session, library, suggestions, loading, contentBlocks,
    loadLibrary, loadSuggestions, startSession, addContent
  };
}

// ═══════════════════════════════════════════════════════════════
// BOOK STATUS HELPERS
// ═══════════════════════════════════════════════════════════════

export function getStatusColor(status) {
  const colors = {
    'complete': '#22c55e', 'manuscript-complete': '#22c55e',
    'in-progress': '#f59e0b', 'outlined': '#3b82f6',
    'planning': '#8b5cf6', 'concept': '#6b7280',
    'early': '#6b7280', 'blocked': '#ef4444'
  };
  return colors[status] || '#6b7280';
}

export function getStatusLabel(status) {
  const labels = {
    'complete': 'Complete', 'manuscript-complete': 'Manuscript Done',
    'in-progress': 'In Progress', 'outlined': 'Outlined',
    'planning': 'Planning', 'concept': 'Concept',
    'early': 'Early Stage', 'blocked': 'Blocked'
  };
  return labels[status] || status;
}
