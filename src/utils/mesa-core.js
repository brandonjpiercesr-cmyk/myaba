// ⬡B:MACE.phase2:CORE:mesa_core:20260406⬡
// Meeting Support Application (MESA) Shared Core Library
// Source of truth for all MESA surfaces: CIP MeetingModeView, CIB MeetingModeApp, MESA standalone
// Also provides TIM/COOK functions used by IRIS (Interview Readiness and Intelligence System)

import { useState, useRef, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

// Interrogative patterns for detecting questions — triggers COOK (source: standalone, most complete)
export const INTERROGATIVES = [
  'how ', 'what ', 'why ', 'when ', 'where ',
  'tell me', 'describe', 'explain', 'walk me through',
  'can you', 'could you', 'would you',
  'elaborate', 'thoughts on', 'your take'
];

// TIM cooldown (ms between fires)
export const TIM_COOLDOWN = 8000;
// COOK cooldown (ms between fires)
export const COOK_COOLDOWN = 15000;
// TIM cue display duration
export const TIM_CUE_DURATION = 8000;
// TIM cue max age (30 seconds)
export const TIM_CUE_MAX_AGE = 30000;
// TIM cue max visible
export const TIM_CUE_MAX_VISIBLE = 5;

// Panel options for coaching sidebar
export const PANEL_OPTIONS = ['transcript', 'coaching', 'glossary'];

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

// Format seconds as MM:SS (source: standalone)
export function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

// Detect if text is a question (source: all 3 surfaces, identical logic)
export function isQuestion(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return text.includes('?') || INTERROGATIVES.some(w => lower.includes(w));
}

// Format a transcript line for display
export function formatTranscriptLine(segment) {
  if (!segment) return '';
  const speaker = segment.speaker !== undefined ? `Speaker ${segment.speaker}: ` : '';
  return speaker + (segment.text || '');
}

// Build meeting context string from transcript and TIM cues
export function buildMeetingContext(transcript, timCues) {
  const recentTranscript = (transcript || []).slice(-10).map(t => t.text).join(' ');
  const recentCues = (timCues || []).slice(-3).map(c => c.text);
  return { recentTranscript, recentCues };
}

// ═══════════════════════════════════════════════════════════════════════════
// API FUNCTIONS (all take apiAdapter as first argument)
// apiAdapter signature: async (path, options?) => result (JSON parsed)
// ═══════════════════════════════════════════════════════════════════════════

// Fetch TIM (Temporary Interim Mode) cue from backend
// Returns: { cue, type, model } or null
export async function fetchTimCue(api, segment, userId, context) {
  try {
    const result = await api('/api/tim/cue', {
      method: 'POST',
      body: {
        transcript_chunk: segment.text || segment,
        userId,
        context: context || 'live meeting',
        mode: segment.mode || 'meeting',
        whose_turn: segment.whose_turn || 'unknown',
      }
    });
    return result.cue ? result : null;
  } catch (err) {
    console.error('[TIM] cue error:', err);
    return null;
  }
}

// Fetch COOK answer via SSE streaming
// Returns the full answer text via onChunk callback, final text on complete
export async function fetchCookAnswer(api, question, userId, context, onChunk) {
  try {
    // COOK uses raw fetch for SSE streaming — adapter provides base URL
    const baseUrl = typeof api._baseUrl === 'string' ? api._baseUrl : 'https://abacia-services.onrender.com';
    const res = await fetch(baseUrl + '/api/cook/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: (context?.autoContext || '') + question,
        user_id: userId,
        mode: context?.mode || 'meeting',
        transcript_context: context?.recentTranscript || '',
        tim_cues: context?.recentCues || [],
        last_said_by_ham: context?.lastSaidByHam || '',
      })
    });

    if (!res.ok || !res.body) return null;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n').filter(l => l.startsWith('data: '))) {
        try {
          const parsed = JSON.parse(line.slice(6));
          if (parsed.text) {
            fullText += parsed.text;
            onChunk?.(fullText, parsed.text);
          }
        } catch {}
      }
    }

    return fullText;
  } catch (err) {
    console.error('[COOK] answer error:', err);
    return null;
  }
}

// Generate meeting summary
export async function generateSummary(api, transcript, userId) {
  try {
    return await api('/api/meeting/summary', {
      method: 'POST',
      body: { transcript, userId }
    });
  } catch (err) {
    console.error('[MESA] Summary error:', err);
    return null;
  }
}

// Save transcript to brain
export async function saveTranscript(api, transcript, userId, metadata) {
  try {
    return await api('/api/air/process', {
      method: 'POST',
      body: {
        message: 'Save meeting transcript: ' + JSON.stringify({ transcript: transcript.slice(-50), ...metadata }),
        user_id: userId,
        channel: 'myaba',
        appScope: 'meeting',
      }
    });
  } catch (err) {
    console.error('[MESA] Save error:', err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROCESS SEGMENT — The core orchestrator for TIM and COOK
// Decides when to fire TIM (8s cooldown) and COOK (15s cooldown on questions)
// Used by MESA and IRIS surfaces
// ═══════════════════════════════════════════════════════════════════════════

export function createSegmentProcessor(api, userId, context) {
  const lastTimFire = { current: 0 };
  const lastCookFire = { current: 0 };

  return {
    // Process a transcript segment — fires TIM and/or COOK as appropriate
    process: async (text, speakerId, callbacks) => {
      const now = Date.now();

      // TIM: fire every 8 seconds
      if (now - lastTimFire.current >= TIM_COOLDOWN) {
        lastTimFire.current = now;
        const result = await fetchTimCue(api, { text, mode: context?.mode || 'meeting', whose_turn: speakerId === context?.hamSpeaker ? 'ham' : 'other' }, userId, context?.contextString);
        if (result?.cue) {
          callbacks?.onTimCue?.({
            text: result.cue,
            type: result.type || 'INFO',
            time: callbacks?.getTime?.() || '',
            model: result.model,
            ts: now,
          });
        }
      }

      // COOK: fire on questions every 15 seconds
      if (isQuestion(text) && now - lastCookFire.current >= COOK_COOLDOWN) {
        lastCookFire.current = now;
        const answerId = now;
        callbacks?.onCookStart?.(answerId, text);

        const fullAnswer = await fetchCookAnswer(
          api, text, userId,
          { ...context, recentTranscript: callbacks?.getRecentTranscript?.() || '', recentCues: callbacks?.getRecentCues?.() || [], lastSaidByHam: callbacks?.getLastSaidByHam?.() || '' },
          (accumulated, chunk) => callbacks?.onCookChunk?.(answerId, accumulated)
        );

        callbacks?.onCookDone?.(answerId, fullAnswer);
      }
    },

    // Reset cooldowns
    reset: () => {
      lastTimFire.current = 0;
      lastCookFire.current = 0;
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// REACT HOOKS
// ═══════════════════════════════════════════════════════════════════════════

// TIM + COOK state management hook
export function useTimCook(api, userId) {
  const [timCues, setTimCues] = useState([]);
  const [currentTimCue, setCurrentTimCue] = useState(null);
  const [cookAnswers, setCookAnswers] = useState([]);
  const [cookStreaming, setCookStreaming] = useState(false);

  const processorRef = useRef(null);

  const getProcessor = useCallback((context) => {
    if (!processorRef.current) {
      processorRef.current = createSegmentProcessor(api, userId, context);
    }
    return processorRef.current;
  }, [api, userId]);

  const processSegment = useCallback(async (text, speakerId, context) => {
    const processor = getProcessor(context);
    await processor.process(text, speakerId, {
      getTime: context?.getTime,
      getRecentTranscript: () => context?.recentTranscript || '',
      getRecentCues: () => timCues.slice(-3).map(c => c.text),
      getLastSaidByHam: () => context?.lastSaidByHam || '',
      onTimCue: (cue) => {
        const now = Date.now();
        setTimCues(prev => [...prev, cue].filter(c => now - (c.ts || 0) < TIM_CUE_MAX_AGE).slice(-TIM_CUE_MAX_VISIBLE));
        setCurrentTimCue(cue);
        setTimeout(() => setCurrentTimCue(prev => prev === cue ? null : prev), TIM_CUE_DURATION);
      },
      onCookStart: (id, question) => {
        setCookStreaming(true);
        setCookAnswers(prev => [...prev, { id, question, time: context?.getTime?.() || '', streaming: true }]);
      },
      onCookChunk: (id, accumulated) => {
        setCookAnswers(prev => prev.map(a => a.id === id ? { ...a, answer: accumulated } : a));
      },
      onCookDone: (id, fullAnswer) => {
        setCookAnswers(prev => prev.map(a => a.id === id ? { ...a, answer: fullAnswer || 'Connection issue.', streaming: false } : a));
        setCookStreaming(false);
      },
    });
  }, [getProcessor, timCues]);

  return { timCues, currentTimCue, cookAnswers, cookStreaming, processSegment, setTimCues, setCookAnswers };
}

// Meeting prep hook — chat with ABA about upcoming meeting
export function useMeetingPrep(api, userId) {
  const [prepInput, setPrepInput] = useState('');
  const [prepMessages, setPrepMessages] = useState([]);
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepContext, setPrepContext] = useState(null);

  const sendPrep = useCallback(async (message) => {
    if (!message.trim()) return;
    setPrepLoading(true);
    setPrepMessages(prev => [...prev, { role: 'user', text: message }]);
    setPrepInput('');
    try {
      const result = await api('/api/air/process', {
        method: 'POST',
        body: { message, user_id: userId, channel: 'myaba', appScope: 'meeting' }
      });
      const response = result.response || result.message || '';
      setPrepMessages(prev => [...prev, { role: 'aba', text: response }]);
      // Extract prep context if ABA provides structured data
      if (result.context) setPrepContext(result.context);
    } catch {
      setPrepMessages(prev => [...prev, { role: 'aba', text: 'Could not reach ABA.' }]);
    }
    setPrepLoading(false);
  }, [api, userId]);

  return { prepInput, setPrepInput, prepMessages, prepLoading, sendPrep, prepContext };
}

// Glossary hook — collect terms during meeting
export function useGlossary() {
  const [glossary, setGlossary] = useState([]);

  const addTerm = useCallback((term, definition) => {
    setGlossary(prev => {
      if (prev.some(g => g.term === term)) return prev;
      return [...prev, { term, definition, addedAt: Date.now() }];
    });
  }, []);

  return { glossary, addTerm, setGlossary };
}
