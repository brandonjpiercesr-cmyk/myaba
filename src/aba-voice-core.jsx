// ⬡B:aba_shared.voice_core.vendored:myaba_cip:20260422⬡
// VENDORED COPY of aba-shared/packages/voice-core/src/index.jsx.
// Sibling vendored copies:
//   gmg-university/src/aba-voice-core.jsx (dev branch)
//   oneaba-source/apps/shell/src/aba-voice-core.jsx (dev → main → dist → 1a-shell)
//
// When the canonical file in aba-shared changes (e.g., VOICE_LABELS.mute 
// from "Mute" to "SHUT UP"), re-vendor all three files.
//
// Stamp `aba_shared.voice_core.vendored` identifies every triplet's copy 
// so grep finds them all:
//   git grep "aba_shared.voice_core.vendored"
//
// ─────────────────────────────────────────────────────────────────────────────
// BEGIN CANONICAL CONTENT — do not edit below this line in triplet repos.
// Edit aba-shared/packages/voice-core/src/index.jsx and re-vendor.
// ─────────────────────────────────────────────────────────────────────────────

// ⬡B:aba_shared.voice_core:CODE:voice_orb_shared_v1:20260422⬡
// Shared voice orb for ABA triplets (gmg-university standalone + MyABA CIP + OneABA CIB).
// One source of truth for: ElevenLabs Custom LLM wiring, preload hard-gate, 
// conversation_id propagation, mute toggle, and ALL UI copy (button labels, 
// status text). Change a label here, all three platforms pick it up.
//
// Architecture covenants this file enforces (read before editing):
//
// 1. PRELOAD IS A HARD GATE. /vara/preload must return 2xx BEFORE we call 
//    conversation.startSession. If preload fails, startVoice throws. The old 
//    try/catch-and-continue pattern is what let ABA drop into "I need to verify 
//    who you are" state — the preload silently failed, startSession fired anyway, 
//    and the backend fell through to guest mode.
//
// 2. CONVERSATION_ID PROPAGATES END-TO-END. We generate the conversation_id 
//    client-side as 'voice_{app}_{timestamp}', pass it to /vara/preload (which 
//    stores the session in Supabase vara_active_sessions keyed by this ID), and 
//    also to conversation.startSession via customLlmExtraBody. The backend 
//    /v1/chat/completions reads body.conversation_id and looks up the session 
//    DIRECTLY — no "most recent session" scanning, no race condition, no 
//    cross-HAM bleed.
//
// 3. MUTE IS LOCAL-FIRST. Mute toggles the microphone input via 
//    conversation.setMicMuted (ElevenLabs SDK). ABA never hears muted audio. 
//    Works for airport noise, somebody walking in, loud intercom. Unmute 
//    restores immediately.
//
// 4. LABELS LIVE HERE. VOICE_LABELS constant at the top of this file is the 
//    single source of truth for all user-facing voice UI text. Brandon wants 
//    to change "Mute" to "SHUT UP" — one edit here, three platforms update.

import { useEffect, useState, useCallback, useRef } from 'react';
import { useConversation } from '@elevenlabs/react';

// ═══════════════════════════════════════════════════════════════════════════
// LABELS — edit here, all platforms update
// ═══════════════════════════════════════════════════════════════════════════

export const VOICE_LABELS = {
  tapToTalk: 'TAP TO TALK',
  connecting: 'CONNECTING',
  listening: 'LISTENING',
  thinking: 'THINKING',
  speaking: 'SPEAKING',
  error: 'ERROR',
  muted: 'MUTED',
  mute: 'Mute',
  unmute: 'Unmute',
  micDenied: 'Microphone access denied.',
  preloadFailed: 'Could not prepare your session. Try again in a moment.',
  connectFailed: 'Connection failed. Tap to retry.',
  defaultStatus: 'Tap to start voice conversation'
};

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG — single source for ElevenLabs agent ID + backend base URL
// ═══════════════════════════════════════════════════════════════════════════

export const VOICE_CONFIG = {
  elevenlabsAgentId: 'agent_0601khe2q0gben08ws34bzf7a0sa',
  backendBase: 'https://abacia-services.onrender.com'
};

// ═══════════════════════════════════════════════════════════════════════════
// conversationId generator — client-side, deterministic, propagated everywhere
// ═══════════════════════════════════════════════════════════════════════════

export function generateConversationId(appSlug) {
  const app = (appSlug || 'voice').replace(/[^a-z0-9_-]/gi, '').slice(0, 16);
  return `voice_${app}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// preloadSession — HARD GATE. Must succeed before startSession.
// Returns { ok: true, hamName, hamUid, guestMode } on success,
// throws Error with .preloadFailed=true on failure.
// ═══════════════════════════════════════════════════════════════════════════

export async function preloadSession({ userId, conversationId, appContext, backendBase }) {
  const base = backendBase || VOICE_CONFIG.backendBase;
  if (!userId) throw Object.assign(new Error('preloadSession: userId required'), { preloadFailed: true });
  if (!conversationId) throw Object.assign(new Error('preloadSession: conversationId required'), { preloadFailed: true });

  let resp;
  try {
    resp = await fetch(`${base}/vara/preload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, conversation_id: conversationId, appContext: appContext || {} })
    });
  } catch (netErr) {
    throw Object.assign(new Error('preloadSession: network error — ' + netErr.message), { preloadFailed: true, cause: netErr });
  }

  if (!resp.ok) {
    throw Object.assign(new Error('preloadSession: backend returned ' + resp.status), { preloadFailed: true, status: resp.status });
  }

  let data;
  try { data = await resp.json(); } catch (parseErr) {
    throw Object.assign(new Error('preloadSession: bad JSON from backend'), { preloadFailed: true });
  }

  if (!data || data.success !== true) {
    throw Object.assign(new Error('preloadSession: backend did not confirm success — ' + (data?.error || 'unknown')), { preloadFailed: true });
  }

  return {
    ok: true,
    hamName: data.ham || null,
    hamUid: data.ham_uid || null,
    guestMode: data.guest_mode === true,
    resolvedVia: data.resolved_via || null
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// useVoiceConversation — the shared hook.
// Returns { state, statusText, errorMsg, isMuted, start, stop, toggleMute, 
//           transcript, liveCaption }
// ═══════════════════════════════════════════════════════════════════════════

export function useVoiceConversation({
  userId,
  appSlug,           // 'gmgu' | 'myaba' | 'oneaba'
  buildAppContext,   // function returning the appContext object for preload
  onTranscriptDone,  // optional callback(transcriptArray) when session ends
  backendBase
}) {
  const [state, setState] = useState('idle');
  const [statusText, setStatusText] = useState(VOICE_LABELS.defaultStatus);
  const [errorMsg, setErrorMsg] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [liveCaption, setLiveCaption] = useState('');
  const convIdRef = useRef(null);
  const transcriptRef = useRef([]);

  const conversation = useConversation({
    onConnect: () => { setState('listening'); setStatusText(VOICE_LABELS.listening); },
    onDisconnect: () => {
      setState('idle');
      setStatusText(VOICE_LABELS.defaultStatus);
      setIsMuted(false);
      if (typeof onTranscriptDone === 'function' && transcriptRef.current.length > 0) {
        try { onTranscriptDone(transcriptRef.current); } catch {}
      }
    },
    onError: (err) => {
      setState('error');
      setErrorMsg((err && err.message) || String(err) || 'unknown');
      setStatusText(VOICE_LABELS.connectFailed);
    },
    onMessage: (msg) => {
      if (!msg) return;
      // ElevenLabs message shapes: { source, message, type } with source 'user' or 'ai'
      const src = msg.source || msg.role || (msg.type === 'agent_response' ? 'ai' : null);
      const text = msg.message || msg.text || msg.content || '';
      if (!text) return;
      const entry = { from: src === 'ai' ? 'aba' : 'user', text, time: Date.now() };
      transcriptRef.current = [...transcriptRef.current, entry];
      setTranscript(transcriptRef.current);
      if (src === 'ai') setLiveCaption(text);
      setState(src === 'ai' ? 'speaking' : 'listening');
      setStatusText(src === 'ai' ? VOICE_LABELS.speaking : VOICE_LABELS.listening);
    }
  });

  const start = useCallback(async () => {
    if (state !== 'idle' && state !== 'error') return;
    setErrorMsg('');
    setState('connecting');
    setStatusText(VOICE_LABELS.connecting);
    transcriptRef.current = [];
    setTranscript([]);
    setLiveCaption('');

    // 1. Mic permission FIRST. If denied, don't hit preload at all.
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (micErr) {
      setState('error');
      setStatusText(VOICE_LABELS.micDenied);
      setErrorMsg(micErr.message || 'Microphone denied');
      return;
    }

    // 2. Generate conversation_id, HARD-GATE preload.
    const convId = generateConversationId(appSlug);
    convIdRef.current = convId;
    const appContext = typeof buildAppContext === 'function' ? (buildAppContext() || {}) : {};

    let preloadResult;
    try {
      preloadResult = await preloadSession({
        userId,
        conversationId: convId,
        appContext: { ...appContext, userId, email: userId },
        backendBase
      });
    } catch (preloadErr) {
      setState('error');
      setStatusText(VOICE_LABELS.preloadFailed);
      setErrorMsg(preloadErr.message || 'Preload failed');
      return;
    }

    // 3. Preload succeeded. Start the ElevenLabs session with 
    //    conversation_id propagated via customLlmExtraBody so the 
    //    backend /v1/chat/completions receives it on every turn.
    try {
      await conversation.startSession({
        agentId: VOICE_CONFIG.elevenlabsAgentId,
        customLlmExtraBody: {
          conversation_id: convId,
          user_id: userId,
          app: appSlug
        },
        dynamicVariables: {
          conversation_id: convId,
          user_id: userId,
          email: userId
        }
      });
      setIsMuted(false);
    } catch (startErr) {
      setState('error');
      setStatusText(VOICE_LABELS.connectFailed);
      setErrorMsg(startErr.message || 'Start failed');
    }
  }, [state, userId, appSlug, buildAppContext, conversation, backendBase]);

  const stop = useCallback(async () => {
    try { await conversation.endSession(); } catch {}
    setState('idle');
    setStatusText(VOICE_LABELS.defaultStatus);
    setIsMuted(false);
  }, [conversation]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      // ElevenLabs @elevenlabs/react exposes setMicMuted in newer versions.
      // Older versions use different names — try the known options.
      try {
        if (typeof conversation.setMicMuted === 'function') conversation.setMicMuted(next);
        else if (typeof conversation.micMuted === 'function') conversation.micMuted(next);
        else if (typeof conversation.setMuted === 'function') conversation.setMuted(next);
        else if (conversation.micMuted !== undefined) conversation.micMuted = next;
      } catch {}
      return next;
    });
  }, [conversation]);

  // Keep status text in sync with state transitions from the SDK
  useEffect(() => {
    if (conversation?.status === 'connecting' && state !== 'connecting') {
      setState('connecting');
      setStatusText(VOICE_LABELS.connecting);
    }
  }, [conversation?.status, state]);

  return {
    state,
    statusText: isMuted ? VOICE_LABELS.muted : statusText,
    errorMsg,
    isMuted,
    start,
    stop,
    toggleMute,
    transcript,
    liveCaption,
    conversationId: convIdRef.current
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MuteButton — drop-in component. Consumers pass { isMuted, onToggle }.
// Label comes from VOICE_LABELS, so changing "Mute" → "SHUT UP" here 
// updates all three triplets at once.
// ═══════════════════════════════════════════════════════════════════════════

export function MuteButton({ isMuted, onToggle, size = 36, style = {} }) {
  const baseStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    border: '1px solid ' + (isMuted ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.2)'),
    background: isMuted ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
    color: isMuted ? '#ef4444' : 'rgba(255,255,255,0.7)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    transition: 'all 0.15s ease',
    ...style
  };
  return (
    <button
      onClick={onToggle}
      title={isMuted ? VOICE_LABELS.unmute : VOICE_LABELS.mute}
      aria-label={isMuted ? VOICE_LABELS.unmute : VOICE_LABELS.mute}
      style={baseStyle}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 1 0 6 0V5a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
        {isMuted && <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2.5" />}
      </svg>
    </button>
  );
}

export default {
  VOICE_LABELS,
  VOICE_CONFIG,
  generateConversationId,
  preloadSession,
  useVoiceConversation,
  MuteButton
};
