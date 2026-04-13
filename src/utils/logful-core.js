// ⬡B:MACE.core:CORE:logful_core:20260413⬡
// LOGFUL Shared Core — Logging Operations and General Feedback Utility Layer
// Frontend UI for the master index of everything logged across all channels.

import { useState, useCallback, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

export const LOG_SOURCES = ['atter', 'iris', 'mesa', 'taste', 'omi', 'manual', 'chat', 'email', 'phone'];

export const TAG_HIERARCHY = {
  level1: 'HAM Profile',    // Who submitted
  level2: 'Organization',   // GMG, BDIF, Mediators, Personal, etc.
  level3: 'Team',           // Collective, Solo, Eric, etc.
  level4: 'Project'         // CFP, MFP, specific initiative
};

export const EMOTIONAL_TONES = ['positive', 'neutral', 'negative', 'mixed', 'reflective', 'urgent'];

// ═══════════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export async function getEntries(api, hamId, filters = {}) {
  const params = new URLSearchParams({ hamId, ...filters });
  return await api(`/api/logful/entries?${params}`);
}

export async function searchEntries(api, hamId, query) {
  return await api(`/api/logful/search?hamId=${hamId}&q=${encodeURIComponent(query)}`);
}

export async function getActionItems(api, hamId) {
  return await api(`/api/logful/actions?hamId=${hamId}`);
}

export async function createReminder(api, hamId, entryId, reminderDate, note) {
  return await api('/api/logful/reminder', {
    method: 'POST',
    body: { user_id: hamId, entry_id: entryId, reminder_date: reminderDate, note }
  });
}

export async function requestSync(api, hamId, targetHamId) {
  return await api('/api/logful/sync', {
    method: 'POST',
    body: { user_id: hamId, target_ham_id: targetHamId }
  });
}

// ═══════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════

export function useLogEntries(api, hamId) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({ source: '', organization: '', dateFrom: '', dateTo: '' });
  const [actionItems, setActionItems] = useState([]);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const data = searchQuery
        ? await searchEntries(api, hamId, searchQuery)
        : await getEntries(api, hamId, filters);
      setEntries(data?.entries || data?.results || []);
    } catch (e) {
      console.error('[LOGFUL] Load error:', e);
    }
    setLoading(false);
  }, [api, hamId, searchQuery, filters]);

  const loadActions = useCallback(async () => {
    try {
      const data = await getActionItems(api, hamId);
      setActionItems(data?.actions || []);
    } catch (e) { /* ok */ }
  }, [api, hamId]);

  useEffect(() => { loadEntries(); }, [loadEntries]);
  useEffect(() => { loadActions(); }, [loadActions]);

  const search = useCallback((query) => {
    setSearchQuery(query);
  }, []);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setSearchQuery('');
  }, []);

  const setReminder = useCallback(async (entryId, date, note) => {
    return await createReminder(api, hamId, entryId, date, note);
  }, [api, hamId]);

  return {
    entries, loading, searchQuery, filters, actionItems,
    search, updateFilters, loadEntries, loadActions, setReminder
  };
}

// ═══════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════

export function formatEntryDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

export function getSourceIcon(source) {
  const icons = { atter: '🎙️', iris: '🎯', mesa: '📋', taste: '👂', omi: '📿', manual: '✍️', chat: '💬', email: '📧', phone: '📞' };
  return icons[source] || '📝';
}

export function getToneColor(tone) {
  const colors = { positive: '#22c55e', neutral: '#64748b', negative: '#ef4444', mixed: '#f59e0b', reflective: '#8b5cf6', urgent: '#dc2626' };
  return colors[tone] || '#64748b';
}
