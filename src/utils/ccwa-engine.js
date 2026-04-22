// ⬡B:MACE.rename:FIX:ccwa_engine_collision_kill:20260422⬡
// Come Code With ABA (CCWA) Engine — MyABA CIP local helper
// Renamed from 'ccwa-core.js' on April 22 2026 to kill the name collision
// with the shared package @aba/ccwa-core (aba-shared/packages/ccwa-core).
// This file is NOT shared — it is MyABA-CIP-specific engine routing,
// training note writes, and chat hooks. The shared CCWA UI components
// (ThreePanelLayout, ChatPanel, CARA, etc.) live in @aba/ccwa-core.
//
// Engine selection, training note read/write, session management

import { useState, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

// Engine modes — production (Sonnet), dev (Haiku via INCUABA), compare (both)
export const ENGINE_MODES = [
  { id: 'prod', label: 'Production', color: '#f59e0b', channel: 'ccwa' },
  { id: 'dev', label: 'Dev (Haiku)', color: '#22d3ee', channel: 'incuaba' },
  { id: 'compare', label: 'Compare', color: '#a78bfa', channel: null },
];

// Panel identifiers shared between CIB and standalone
export const PANEL_IDS = [
  'enforcement', 'cloudSettings', 'backupHistory', 'workspaceSettings',
  'apiDashboard', 'deployPanel', 'gitPanel', 'rightSidebar',
  'teachingPanel', 'glossaryPanel', 'filePanel',
];

// Project metadata
export const CCWA_PROJECT = 'ccwa';

// Storage keys for background preferences
export const STORAGE_KEYS = {
  selectedBackground: 'ccwa_bg',
  backgroundAnimation: 'ccwa_anim',
};

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE ROUTING — The dual-engine pattern (source: CIP, cleanest version)
// ═══════════════════════════════════════════════════════════════════════════

// Get the channel for a given engine mode
export function getChannel(mode) {
  if (mode === 'dev') return 'incuaba';
  if (mode === 'prod') return 'ccwa';
  return 'ccwa'; // default
}

// Send a message to a specific engine (source: CIP sendToEngine pattern)
export async function sendToEngine(api, message, userId, mode, opts = {}) {
  try {
    const channel = getChannel(mode);
    const result = await api('/api/air/process', {
      method: 'POST',
      body: {
        message,
        user_id: userId,
        userId,
        channel,
        appScope: 'ccwa',
        ...opts,
      }
    });
    return {
      response: result.response || result.message || '',
      toolsExecuted: (result.toolsExecuted || []).map(t => typeof t === 'object' ? t.tool_name : t).filter(Boolean),
      model: result.model,
      channel,
      raw: result,
    };
  } catch (err) {
    return { response: 'Error: ' + err.message, toolsExecuted: [], channel: getChannel(mode), error: true };
  }
}

// Send to a streaming endpoint
export async function sendToEngineStream(api, message, userId, mode, onChunk) {
  const channel = getChannel(mode);
  const baseUrl = typeof api._baseUrl === 'string' ? api._baseUrl : 'https://abacia-services.onrender.com';
  
  try {
    const res = await fetch(baseUrl + '/api/air/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        user_id: userId,
        userId,
        channel,
        appScope: 'ccwa',
      })
    });

    if (!res.ok || !res.body) return { response: 'Stream failed', error: true };

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value, { stream: true }).split('\n').filter(l => l.startsWith('data: '))) {
        try {
          const d = JSON.parse(line.slice(6));
          if (d.type === 'chunk' || d.text) {
            fullText += d.text || '';
            onChunk?.(fullText, d.text || '');
          }
          if (d.type === 'done') {
            fullText = d.fullResponse || fullText;
            onChunk?.(fullText, '', true);
          }
        } catch {}
      }
    }

    return { response: fullText, channel };
  } catch (err) {
    return { response: 'Stream error: ' + err.message, error: true };
  }
}

// Compare engines — sends to both prod and dev, returns side-by-side (source: CIP compare mode)
export async function compareEngines(api, message, userId) {
  const [prodResult, devResult] = await Promise.allSettled([
    sendToEngine(api, message, userId, 'prod'),
    sendToEngine(api, message, userId, 'dev'),
  ]);

  return {
    prod: prodResult.value || { response: 'Production error', error: true },
    dev: devResult.value || { response: 'Dev error', error: true },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TRAINING NOTE API — Read/write CCWA training notes to brain
// ═══════════════════════════════════════════════════════════════════════════

// Write a training note to brain (Claude Base → ABAbase learning)
export async function writeTrainingNote(api, content, topic) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  try {
    return await api('/api/air/process', {
      method: 'POST',
      body: {
        message: `Save this CCWA training note to brain with source "ccwa.training.${topic || 'note'}.${date}" and memory_type "ccwa_training_note": ${content}`,
        user_id: 'brandon',
        channel: 'ccwa',
        appScope: 'ccwa',
      }
    });
  } catch (err) {
    console.error('[CCWA] Training note write error:', err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SESSION BOOTSTRAP — Save/load CCWA session context
// ═══════════════════════════════════════════════════════════════════════════

// Save session context to brain for continuity
export async function saveSessionContext(api, context, topic) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  try {
    return await api('/api/air/process', {
      method: 'POST',
      body: {
        message: `Save this CCWA bootstrap to brain with source "ccwa.bootstrap.${topic || 'session'}.${date}" and memory_type "ccwa_training_note": ${JSON.stringify(context)}`,
        user_id: 'brandon',
        channel: 'ccwa',
        appScope: 'ccwa',
      }
    });
  } catch (err) {
    console.error('[CCWA] Session save error:', err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REACT HOOKS
// ═══════════════════════════════════════════════════════════════════════════

// Engine selection hook
export function useEngineMode(defaultMode = 'prod') {
  const [mode, setMode] = useState(defaultMode);
  const channel = getChannel(mode);
  const isCompare = mode === 'compare';
  const isDev = mode === 'dev';
  const isProd = mode === 'prod';

  return { mode, setMode, channel, isCompare, isDev, isProd };
}

// Panel state management hook — generates show/setShow pairs for all panels
export function usePanelState(panelIds = PANEL_IDS) {
  const [panels, setPanels] = useState(() => {
    const initial = {};
    for (const id of panelIds) initial[id] = false;
    // rightSidebar defaults to true
    initial.rightSidebar = true;
    return initial;
  });

  const toggle = useCallback((id) => {
    setPanels(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const show = useCallback((id) => {
    setPanels(prev => ({ ...prev, [id]: true }));
  }, []);

  const hide = useCallback((id) => {
    setPanels(prev => ({ ...prev, [id]: false }));
  }, []);

  return { panels, toggle, show, hide, setPanels };
}

// CCWA chat hook — manages message history and engine routing
export function useCCWAChat(api, userId) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const { mode, setMode, isCompare } = useEngineMode();

  const send = useCallback(async (message) => {
    if (!message.trim()) return;
    setLoading(true);
    setHistory(prev => [...prev, { role: 'user', text: message }]);

    if (isCompare) {
      const result = await compareEngines(api, message, userId);
      setHistory(prev => [...prev, {
        role: 'compare',
        prod: result.prod.response,
        dev: result.dev.response,
        prodTools: result.prod.toolsExecuted || [],
        devTools: result.dev.toolsExecuted || [],
      }]);
    } else {
      const result = await sendToEngine(api, message, userId, mode);
      setHistory(prev => [...prev, {
        role: 'aba',
        text: result.response,
        tools: result.toolsExecuted || [],
        model: result.model,
        channel: result.channel,
      }]);
    }

    setLoading(false);
  }, [api, userId, mode, isCompare]);

  return { history, loading, send, setHistory, mode, setMode };
}
