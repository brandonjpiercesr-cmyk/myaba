// ⬡B:MACE.core:CORE:atter_core_deepgram:20260415⬡
// ATTER Shared Core — Audio Transcription and Thought Expression Recorder
// Upgraded from Web Speech API to Deepgram WebSocket streaming (same as MESA)
// Backend proxy at /api/voice/stream handles Deepgram connection.

import { useState, useCallback, useEffect, useRef } from "react";
export { formatTime } from "./mesa-core.js";

const WS_URL = 'wss://abacia-services.onrender.com/api/voice/stream';

// ═══════════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export async function startSession(api, userId, metadata = {}) {
  return await api('/api/atter/start', { method: 'POST', body: { user_id: userId, ...metadata } });
}

export async function getCorrections(api, hamId) {
  return await api(`/api/atter/corrections/${hamId}`);
}

export async function saveCorrection(api, userId, wrong, correct) {
  return await api('/api/atter/correction', { method: 'POST', body: { user_id: userId, wrong, correct } });
}

export async function completeSession(api, sessionId, userId, transcript, tags = []) {
  return await api('/api/atter/complete', { method: 'POST', body: { session_id: sessionId, user_id: userId, transcript, tags } });
}

export async function getRecentSessions(api, hamId, limit = 10) {
  return await api(`/api/atter/sessions/${hamId}?limit=${limit}`);
}

// ═══════════════════════════════════════════════════════════════
// WORD CORRECTION ENGINE
// ═══════════════════════════════════════════════════════════════

export function applyCorrections(text, corrections) {
  if (!corrections || corrections.length === 0) return text;
  let result = text;
  for (const c of corrections) {
    try {
      const regex = new RegExp(`\\b${c.wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      result = result.replace(regex, c.correct);
    } catch(e) {}
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// RECORDING HOOK — Deepgram WebSocket streaming (same as MESA/IRIS)
// ═══════════════════════════════════════════════════════════════

export function useRecording(api, userId) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [segments, setSegments] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  const wsRef = useRef(null);
  const recRef = useRef(null);
  const streamRef = useRef(null);
  const transcriptRef = useRef('');
  const segmentsRef = useRef([]);
  const correctionsRef = useRef([]);

  // Load corrections on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await getCorrections(api, userId);
        const corrs = data.corrections || [];
        setCorrections(corrs);
        correctionsRef.current = corrs;
      } catch (e) { /* first time */ }
    })();
  }, [api, userId]);

  const start = useCallback(async () => {
    setLoading(true);
    try {
      // Start session on backend
      const session = await startSession(api, userId);
      setSessionId(session.sessionId);
      setTranscript('');
      setSegments([]);
      transcriptRef.current = '';
      segmentsRef.current = [];

      // Get mic
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // MediaRecorder with opus codec (same as MESA)
      const mimes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', ''];
      let mime = '';
      for (const m of mimes) { if (!m || MediaRecorder.isTypeSupported(m)) { mime = m; break; } }
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);

      // WebSocket to Deepgram proxy
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'status' && msg.message === 'connected') {
            setConnected(true);
          }
          if (msg.type === 'Results' && msg.is_final) {
            const alt = msg.channel?.alternatives?.[0];
            const text = alt?.transcript || '';
            if (text && text.trim()) {
              const corrected = applyCorrections(text.trim(), correctionsRef.current);
              const seg = { text: corrected, raw: text.trim(), timestamp: Date.now() };
              segmentsRef.current = [...segmentsRef.current, seg];
              setSegments([...segmentsRef.current]);
              transcriptRef.current = transcriptRef.current + corrected + ' ';
              setTranscript(transcriptRef.current);
            }
          }
        } catch (err) {}
      };

      ws.onerror = (err) => console.error('[ATTER] WS error:', err);
      ws.onclose = () => setConnected(false);

      await new Promise((resolve, reject) => {
        ws.onopen = () => resolve();
        setTimeout(() => reject(new Error('WebSocket timeout')), 5000);
      });

      rec.ondataavailable = (e) => {
        if (e.data.size > 0 && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(e.data);
        }
      };

      rec.start(250);
      recRef.current = rec;
      setIsRecording(true);
    } catch (e) {
      console.error('[ATTER] Start error:', e);
      alert('Microphone access required');
    }
    setLoading(false);
  }, [api, userId]);

  const stop = useCallback(async () => {
    setIsRecording(false);
    if (recRef.current) { recRef.current.stop(); recRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close();
    wsRef.current = null;
    setConnected(false);

    // Complete session and route
    const finalText = transcriptRef.current.trim();
    if (sessionId && finalText.length > 10) {
      setLoading(true);
      try {
        const result = await completeSession(api, sessionId, userId, finalText);
        setLoading(false);
        return result;
      } catch (e) {
        console.error('[ATTER] Complete error:', e);
      }
      setLoading(false);
    }
    return null;
  }, [api, sessionId, userId]);

  const addCorrection = useCallback(async (wrong, correct) => {
    await saveCorrection(api, userId, wrong, correct);
    const updated = [...correctionsRef.current, { wrong, correct }];
    correctionsRef.current = updated;
    setCorrections(updated);
  }, [api, userId]);

  const editSegment = useCallback((index, newText) => {
    segmentsRef.current = segmentsRef.current.map((s, i) => i === index ? { ...s, text: newText, edited: true } : s);
    setSegments([...segmentsRef.current]);
    const joined = segmentsRef.current.map(s => s.text).join(' ');
    transcriptRef.current = joined;
    setTranscript(joined);
  }, []);

  return {
    isRecording, transcript, segments, sessionId, corrections, loading, connected,
    start, stop, addCorrection, editSegment, setTranscript
  };
}

// ═══════════════════════════════════════════════════════════════
// TAGGING
// ═══════════════════════════════════════════════════════════════

export const TAG_LEVELS = {
  organization: ['GMG', 'BDIF', 'Mediators', 'MH Action', 'Personal', 'Envolve'],
  team: ['Collective', 'Solo', 'Eric', 'Family'],
  project: [] // Dynamic, filled per HAM
};
