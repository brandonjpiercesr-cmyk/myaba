// ⬡B:MACE.phase4:CORE:sports_core:20260406⬡
// NASH (Notable Athletic Scores and Highlights) Shared Core Library
// Source of truth for: CIP SportsView, CIB ABASportsApp

import { useState, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

// Fetch user's followed team scores
export async function fetchScores(api, userId) {
  try {
    const result = await api('/api/nash/briefing?userId=' + encodeURIComponent(userId));
    return result.scores || [];
  } catch (err) {
    console.error('[SPORTS] Score fetch error:', err);
    return [];
  }
}

// Search for a specific team's scores
export async function searchTeam(api, team, userId) {
  try {
    return await api('/api/nash/scores?team=' + encodeURIComponent(team) + '&userId=' + encodeURIComponent(userId));
  } catch (err) {
    console.error('[SPORTS] Search error:', err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REACT HOOKS
// ═══════════════════════════════════════════════════════════════════════════

// Main sports hook — scores, search, loading state
export function useSports(api, userId) {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);

  const loadScores = useCallback(async () => {
    setLoading(true);
    const result = await fetchScores(api, userId);
    setScores(result);
    setLoading(false);
  }, [api, userId]);

  useEffect(() => { loadScores(); }, [loadScores]);

  const doSearch = useCallback(async (term) => {
    const q = (term || search).trim();
    if (!q) return;
    setSearching(true); setSearchResult(null);
    const result = await searchTeam(api, q, userId);
    setSearchResult(result);
    setSearching(false);
  }, [api, userId, search]);

  return { scores, loading, search, setSearch, searchResult, searching, doSearch, loadScores };
}
