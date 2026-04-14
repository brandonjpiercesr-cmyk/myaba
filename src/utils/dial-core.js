// ⬡B:ccwa.aba_dials:PHASE4:dial_core:20260414⬡
// DIAL Shared Core Library — ABA Dials (Phone Call Mode)
// Source of truth for all DIAL surfaces: CIP DialModeView, CIB DialApp, DIAL standalone
// TIM/COOK imported from mesa-core for real-time coaching during calls

import { useState, useRef, useEffect, useCallback } from "react";
export { fetchTimCue, fetchCookAnswer, isQuestion, formatTime } from "./mesa-core.js";

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

export const DIAL_TABS = ['dialer', 'live', 'history'];

export const CALL_STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  ACTIVE: 'active',
  ENDED: 'ended',
  ERROR: 'error',
};

export const BRIDGE_STATUS = {
  NOT_SET: 'not_set',
  PROVISIONING: 'provisioning',
  ACTIVE: 'active',
  ERROR: 'error',
};

// ═══════════════════════════════════════════════════════════════
// API FUNCTIONS (all take apiAdapter as first argument)
// ═══════════════════════════════════════════════════════════════

export async function initiateCall(api, userId, toNumber, purpose) {
  const result = await api('/api/dial/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hamId: userId, to: toNumber, purpose }),
  });
  return result;
}

export async function setupBridge(api, userId, carrierNumber) {
  const result = await api('/api/dial/bridge/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hamId: userId, carrierNumber }),
  });
  return result;
}

export async function teardownBridge(api, userId) {
  const result = await api('/api/dial/bridge', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hamId: userId }),
  });
  return result;
}

export async function fetchCallHistory(api, userId, page = 1, limit = 20, query = '') {
  const params = new URLSearchParams({ hamId: userId, page, limit });
  if (query) params.set('query', query);
  const result = await api(`/api/dial/history?${params}`);
  return result;
}

export function formatTranscript(segments) {
  if (!segments || !Array.isArray(segments)) return '';
  return segments
    .map(s => `[${s.speaker || 'SPEAKER'}] ${s.text}`)
    .join('\n');
}

export function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════

// useDialer — manages call state, timer, transcript
export function useDialer(api, userId) {
  const [status, setStatus] = useState(CALL_STATUS.IDLE);
  const [callSid, setCallSid] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const startCall = useCallback(async (toNumber, purpose) => {
    try {
      setStatus(CALL_STATUS.CONNECTING);
      setError(null);
      setTranscript([]);
      setSeconds(0);
      const result = await initiateCall(api, userId, toNumber, purpose);
      if (result.success) {
        setCallSid(result.callSid || result.conversation_id);
        setStatus(CALL_STATUS.ACTIVE);
        timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
      } else {
        setStatus(CALL_STATUS.ERROR);
        setError(result.error || 'Call failed');
      }
    } catch (err) {
      setStatus(CALL_STATUS.ERROR);
      setError(err.message);
    }
  }, [api, userId]);

  const endCall = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus(CALL_STATUS.ENDED);
  }, []);

  const addTranscriptSegment = useCallback((segment) => {
    setTranscript(prev => [...prev, { ...segment, time: formatDuration(seconds) }]);
  }, [seconds]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return { status, callSid, transcript, seconds, error, startCall, endCall, addTranscriptSegment };
}

// useBridge — manages bridge number setup
export function useBridge(api, userId) {
  const [bridgeStatus, setBridgeStatus] = useState(BRIDGE_STATUS.NOT_SET);
  const [bridgeNumber, setBridgeNumber] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const setup = useCallback(async (carrierNumber) => {
    try {
      setLoading(true);
      setBridgeStatus(BRIDGE_STATUS.PROVISIONING);
      setError(null);
      const result = await setupBridge(api, userId, carrierNumber);
      if (result.success) {
        setBridgeNumber(result.bridgeNumber || result.phoneNumber);
        setBridgeStatus(BRIDGE_STATUS.ACTIVE);
      } else {
        setBridgeStatus(BRIDGE_STATUS.ERROR);
        setError(result.error);
      }
    } catch (err) {
      setBridgeStatus(BRIDGE_STATUS.ERROR);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api, userId]);

  const teardown = useCallback(async () => {
    try {
      setLoading(true);
      await teardownBridge(api, userId);
      setBridgeNumber(null);
      setBridgeStatus(BRIDGE_STATUS.NOT_SET);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api, userId]);

  return { bridgeStatus, bridgeNumber, loading, error, setup, teardown };
}

// useCallHistory — paginated transcript history with search
export function useCallHistory(api, userId) {
  const [calls, setCalls] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async (pg = 1, query = '') => {
    try {
      setLoading(true);
      const result = await fetchCallHistory(api, userId, pg, 20, query);
      if (result.success) {
        setCalls(result.transcripts || []);
        setTotal(result.total || 0);
        setPage(pg);
      }
    } catch (err) {
      console.error('[dial-core] History load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [api, userId]);

  const search = useCallback((query) => {
    setSearchQuery(query);
    load(1, query);
  }, [load]);

  const nextPage = useCallback(() => load(page + 1, searchQuery), [load, page, searchQuery]);
  const prevPage = useCallback(() => load(Math.max(1, page - 1), searchQuery), [load, page, searchQuery]);

  useEffect(() => { load(); }, [load]);

  return { calls, total, page, loading, searchQuery, search, nextPage, prevPage, refresh: () => load(1, searchQuery) };
}
