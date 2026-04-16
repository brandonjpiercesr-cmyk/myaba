// ⬡B:ccwa.aba_dials:V2:identity_signals:20260416⬡
// DIAL Shared Core — passes identity signals (email, phone) not raw userId
// Backend ham-service.resolveIdentity uses these to look up the canonical hamId.

import { useState, useRef, useEffect, useCallback } from "react";
export { fetchTimCue, fetchCookAnswer, isQuestion, formatTime } from "./mesa-core.js";

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
  NEEDS_VERIFICATION: 'needs_verification',
  NO_PHONE: 'no_phone',
  ERROR: 'error',
};

// ═══════════════════════════════════════════════════════════════
// Build identity payload from user auth object
// ═══════════════════════════════════════════════════════════════
export function buildIdentity(user) {
  if (!user) return {};
  return {
    email: user.email || null,
    phone: user.phoneNumber || user.phone || null,
    user_id: user.uid || user.user_id || user.email || null,
    firebase_uid: user.uid || null,
  };
}

// ═══════════════════════════════════════════════════════════════
// API FUNCTIONS — all require identity object
// ═══════════════════════════════════════════════════════════════

export async function initiateCall(api, identity, toNumber, purpose) {
  return api('/api/dial/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...identity, to: toNumber, purpose }),
  });
}

export async function setupBridge(api, identity) {
  return api('/api/dial/bridge/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(identity),
  });
}

export async function teardownBridge(api, identity) {
  return api('/api/dial/bridge', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(identity),
  });
}

export async function verifyCallerId(api, identity) {
  return api('/api/dial/verify-caller-id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(identity),
  });
}

export async function fetchCallHistory(api, identity, page = 1, limit = 20, query = '') {
  const params = new URLSearchParams({
    page, limit,
    ...(identity.email && { email: identity.email }),
    ...(identity.phone && { phone: identity.phone }),
    ...(identity.user_id && { userId: identity.user_id }),
  });
  if (query) params.set('query', query);
  return api(`/api/dial/history?${params}`);
}

export function formatTranscript(segments) {
  if (!segments || !Array.isArray(segments)) return '';
  return segments.map(s => `[${s.speaker || 'SPEAKER'}] ${s.text}`).join('\n');
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

export function useDialer(api, identity) {
  const [status, setStatus] = useState(CALL_STATUS.IDLE);
  const [callSid, setCallSid] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const timerRef = useRef(null);

  const startCall = useCallback(async (toNumber, purpose) => {
    try {
      setStatus(CALL_STATUS.CONNECTING);
      setError(null);
      setErrorCode(null);
      setTranscript([]);
      setSeconds(0);
      const result = await initiateCall(api, identity, toNumber, purpose);
      if (result.success) {
        setCallSid(result.callSid);
        setStatus(CALL_STATUS.ACTIVE);
        timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
      } else {
        setStatus(CALL_STATUS.ERROR);
        setError(result.error || 'Call failed');
        setErrorCode(result.code || null);
      }
    } catch (err) {
      setStatus(CALL_STATUS.ERROR);
      setError(err.message);
    }
  }, [api, identity]);

  const endCall = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus(CALL_STATUS.ENDED);
  }, []);

  const addTranscriptSegment = useCallback((segment) => {
    setTranscript(prev => [...prev, { ...segment, time: formatDuration(seconds) }]);
  }, [seconds]);

  useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);

  return { status, callSid, transcript, seconds, error, errorCode, startCall, endCall, addTranscriptSegment };
}

export function useBridge(api, identity) {
  const [bridgeStatus, setBridgeStatus] = useState(BRIDGE_STATUS.NOT_SET);
  const [bridgeNumber, setBridgeNumber] = useState(null);
  const [hamPhone, setHamPhone] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const [verificationCode, setVerificationCode] = useState(null);
  const [callerIdVerified, setCallerIdVerified] = useState(false);
  const [pollingVerification, setPollingVerification] = useState(false);
  const pollRef = useRef(null);

  // Poll verification status every 3 seconds when waiting for HAM to enter code
  useEffect(() => {
    if (!pollingVerification) return;
    pollRef.current = setInterval(async () => {
      try {
        const params = new URLSearchParams({
          ...(identity.email && { email: identity.email }),
          ...(identity.phone && { phone: identity.phone }),
          ...(identity.user_id && { userId: identity.user_id }),
        });
        const result = await api('/api/dial/verification-status?' + params);
        if (result?.verified) {
          setCallerIdVerified(true);
          setVerificationCode(null);
          setPollingVerification(false);
          clearInterval(pollRef.current);
        }
      } catch {}
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pollingVerification, api, identity]);

  // ONE TAP: provisions bridge AND triggers caller ID verification simultaneously.
  // Backend returns { bridge, callerIdVerified, verificationCode }.
  // If already verified, no code needed. Otherwise we show the code and poll.
  const setup = useCallback(async () => {
    try {
      setLoading(true);
      setBridgeStatus(BRIDGE_STATUS.PROVISIONING);
      setError(null); setErrorCode(null);
      const result = await setupBridge(api, identity);
      if (result.success) {
        const b = result.bridge || {};
        setBridgeNumber(b.bridgeNumber);
        setHamPhone(b.hamPhone || result.hamPhone);
        setBridgeStatus(BRIDGE_STATUS.ACTIVE);
        setCallerIdVerified(!!result.callerIdVerified);
        if (result.verificationCode) {
          setVerificationCode(result.verificationCode);
          setPollingVerification(true);
        }
      } else {
        setError(result.error);
        setErrorCode(result.code);
        if (result.code === 'NO_HAM_PHONE') setBridgeStatus(BRIDGE_STATUS.NO_PHONE);
        else setBridgeStatus(BRIDGE_STATUS.ERROR);
      }
    } catch (err) {
      setBridgeStatus(BRIDGE_STATUS.ERROR);
      setError(err.message);
    } finally { setLoading(false); }
  }, [api, identity]);

  const teardown = useCallback(async () => {
    try {
      setLoading(true);
      await teardownBridge(api, identity);
      setBridgeNumber(null);
      setCallerIdVerified(false);
      setVerificationCode(null);
      setPollingVerification(false);
      setBridgeStatus(BRIDGE_STATUS.NOT_SET);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, [api, identity]);

  // Manual re-verify if user needs it
  const verify = useCallback(async () => {
    try {
      setLoading(true);
      const result = await verifyCallerId(api, identity);
      if (result.success) {
        setVerificationCode(result.verificationCode);
        setPollingVerification(true);
      } else {
        setError(result.error);
      }
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, [api, identity]);

  return { bridgeStatus, bridgeNumber, hamPhone, loading, error, errorCode, verificationCode, callerIdVerified, pollingVerification, setup, teardown, verify };
}

export function useCallHistory(api, identity) {
  const [calls, setCalls] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async (pg = 1, query = '') => {
    try {
      setLoading(true);
      const result = await fetchCallHistory(api, identity, pg, 20, query);
      if (result.success) {
        setCalls(result.transcripts || []);
        setTotal(result.total || 0);
        setPage(pg);
      }
    } catch (err) { console.error('[dial-core] History error:', err.message); } finally { setLoading(false); }
  }, [api, identity]);

  const search = useCallback((query) => { setSearchQuery(query); load(1, query); }, [load]);
  const nextPage = useCallback(() => load(page + 1, searchQuery), [load, page, searchQuery]);
  const prevPage = useCallback(() => load(Math.max(1, page - 1), searchQuery), [load, page, searchQuery]);

  useEffect(() => { load(); }, [load]);

  return { calls, total, page, loading, searchQuery, search, nextPage, prevPage, refresh: () => load(1, searchQuery) };
}
