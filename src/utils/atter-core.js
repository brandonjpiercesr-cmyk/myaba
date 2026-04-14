// ⬡B:MACE.core:CORE:atter_core:20260413⬡
// ATTER Shared Core — Audio Transcription and Thought Expression Recorder
// Imports recording/transcription from mesa-core.js (one source of truth)
// Adds: word correction learning, LOGFUL routing, multi-level tagging

import { useState, useCallback, useEffect, useRef } from "react";
export { formatTime } from "./mesa-core.js";

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
    const regex = new RegExp(`\\b${c.wrong}\\b`, 'gi');
    result = result.replace(regex, c.correct);
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// RECORDING HOOK (wraps Web Speech API, applies corrections live)
// ═══════════════════════════════════════════════════════════════

export function useRecording(api, userId) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [segments, setSegments] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(false);
  const recognitionRef = useRef(null);

  // Load corrections on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await getCorrections(api, userId);
        setCorrections(data.corrections || []);
      } catch (e) { /* first time */ }
    })();
  }, [api, userId]);

  const start = useCallback(async () => {
    setLoading(true);
    try {
      const session = await startSession(api, userId);
      setSessionId(session.sessionId);
      setTranscript('');
      setSegments([]);

      // Init Web Speech API
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.error('[ATTER] Speech recognition not supported');
        setLoading(false);
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let interim = '';
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            const corrected = applyCorrections(text, corrections);
            finalText += corrected + ' ';
            setSegments(prev => [...prev, {
              text: corrected,
              timestamp: Date.now(),
              confidence: event.results[i][0].confidence
            }]);
          } else {
            interim = applyCorrections(text, corrections);
          }
        }
        if (finalText) {
          setTranscript(prev => prev + finalText);
        }
      };

      recognition.onerror = (event) => {
        console.error('[ATTER] Recognition error:', event.error);
        if (event.error !== 'no-speech') {
          recognition.stop();
          setTimeout(() => { try { recognition.start(); } catch(e) {} }, 500);
        }
      };

      recognition.onend = () => {
        if (isRecording) {
          try { recognition.start(); } catch(e) {}
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
    } catch (e) {
      console.error('[ATTER] Start error:', e);
    }
    setLoading(false);
  }, [api, userId, corrections, isRecording]);

  const stop = useCallback(async () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);

    // Complete session and route to LOGFUL
    if (sessionId && transcript.trim().length > 10) {
      setLoading(true);
      try {
        const result = await completeSession(api, sessionId, userId, transcript);
        setLoading(false);
        return result;
      } catch (e) {
        console.error('[ATTER] Complete error:', e);
      }
      setLoading(false);
    }
    return null;
  }, [api, sessionId, userId, transcript]);

  const addCorrection = useCallback(async (wrong, correct) => {
    await saveCorrection(api, userId, wrong, correct);
    setCorrections(prev => [...prev, { wrong, correct }]);
  }, [api, userId]);

  const editSegment = useCallback((index, newText) => {
    setSegments(prev => prev.map((s, i) => i === index ? { ...s, text: newText, edited: true } : s));
    setTranscript(segments.map((s, i) => i === index ? newText : s.text).join(' '));
  }, [segments]);

  return {
    isRecording, transcript, segments, sessionId, corrections, loading,
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
