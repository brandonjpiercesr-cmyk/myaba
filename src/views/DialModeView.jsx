// ⬡B:ccwa.aba_dials:PHASE5:cip_skin:20260414⬡
// ABA Dials — CIP Mobile Skin (MyABA)
// Imports all logic from dial-core.js — this file is RENDERING ONLY

import React, { useState, useCallback, useEffect } from 'react';
import {
  useDialer, useBridge, useCallHistory,
  DIAL_TABS, CALL_STATUS, BRIDGE_STATUS,
  formatDuration, formatTranscript,
} from '../utils/dial-core';

const ABABASE = import.meta.env.VITE_ABABASE_URL || 'https://abacia-services.onrender.com';
const api = (path, opts) => fetch(ABABASE + path, opts).then(r => r.json());

export default function DialModeView({ userId = 'brandon' }) {
  const [tab, setTab] = useState('dialer');
  const [phoneInput, setPhoneInput] = useState('');
  const [purposeInput, setPurposeInput] = useState('');

  const { status, callSid, transcript, seconds, error, startCall, endCall } = useDialer(api, userId);
  const { bridgeStatus, bridgeNumber, loading: bridgeLoading, error: bridgeError, setup: setupBridge } = useBridge(api, userId);
  const { calls, total, page, loading: historyLoading, search, nextPage, prevPage, refresh } = useCallHistory(api, userId);

  const [searchInput, setSearchInput] = useState('');

  const handleDial = useCallback(() => {
    if (!phoneInput.trim()) return;
    startCall(phoneInput.trim(), purposeInput.trim() || 'outbound call');
    setTab('live');
  }, [phoneInput, purposeInput, startCall]);

  const handleSetupBridge = useCallback(() => {
    setupBridge(phoneInput.trim() || undefined);
  }, [phoneInput, setupBridge]);

  // Auto-switch to live tab when call connects
  useEffect(() => {
    if (status === CALL_STATUS.ACTIVE) setTab('live');
  }, [status]);

  const accentColor = '#F59E0B'; // Amber for DIAL (vs cyan MESA, amber IRIS)
  const dimColor = 'rgba(245,158,11,0.15)';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0a', color: '#fff' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: status === CALL_STATUS.ACTIVE ? '#22c55e' : accentColor }} />
        <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '0.1em', color: accentColor }}>ABA DIALS</span>
        {status === CALL_STATUS.ACTIVE && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#22c55e', fontFamily: 'monospace' }}>{formatDuration(seconds)}</span>
        )}
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {DIAL_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
              background: tab === t ? dimColor : 'transparent',
              color: tab === t ? accentColor : 'rgba(255,255,255,0.4)',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              borderBottom: tab === t ? `2px solid ${accentColor}` : '2px solid transparent',
            }}>
            {t === 'dialer' ? 'DIAL' : t === 'live' ? 'LIVE' : 'HISTORY'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {tab === 'dialer' && (
          <div>
            {/* Bridge Setup */}
            <div style={{ marginBottom: 20, padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: 8 }}>CALL FORWARDING BRIDGE</div>
              {bridgeStatus === BRIDGE_STATUS.ACTIVE ? (
                <div>
                  <div style={{ fontSize: 13, color: '#22c55e', marginBottom: 4 }}>Bridge Active</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Bridge #: {bridgeNumber}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Dial *72{bridgeNumber} from your phone to forward calls</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>Set up a bridge to auto-record all incoming calls</div>
                  <button onClick={handleSetupBridge} disabled={bridgeLoading}
                    style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: accentColor, color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: bridgeLoading ? 0.5 : 1 }}>
                    {bridgeLoading ? 'Setting up...' : 'Set Up Bridge'}
                  </button>
                  {bridgeError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>{bridgeError}</div>}
                </div>
              )}
            </div>

            {/* Dialer */}
            <div style={{ marginBottom: 12 }}>
              <input value={phoneInput} onChange={e => setPhoneInput(e.target.value)}
                placeholder="+1 (555) 123-4567"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 18, fontFamily: 'monospace', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <input value={purposeInput} onChange={e => setPurposeInput(e.target.value)}
                placeholder="Purpose (optional)"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.7)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <button onClick={handleDial} disabled={!phoneInput.trim() || status === CALL_STATUS.CONNECTING}
              style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: accentColor, color: '#000', fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: !phoneInput.trim() ? 0.4 : 1 }}>
              {status === CALL_STATUS.CONNECTING ? 'Connecting...' : 'CALL'}
            </button>
            {error && <div style={{ marginTop: 8, fontSize: 12, color: '#ef4444' }}>{error}</div>}
          </div>
        )}

        {tab === 'live' && (
          <div>
            {status === CALL_STATUS.IDLE && (
              <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No active call. Go to Dial tab to start one.</div>
            )}
            {(status === CALL_STATUS.ACTIVE || status === CALL_STATUS.ENDED) && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: status === CALL_STATUS.ACTIVE ? '#22c55e' : 'rgba(255,255,255,0.4)' }}>
                    {status === CALL_STATUS.ACTIVE ? 'LIVE' : 'ENDED'} — {formatDuration(seconds)}
                  </span>
                  {status === CALL_STATUS.ACTIVE && (
                    <button onClick={endCall} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}>End Call</button>
                  )}
                </div>

                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', marginBottom: 8 }}>TRANSCRIPT</div>
                {transcript.length === 0 ? (
                  <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, fontStyle: 'italic' }}>Listening...</div>
                ) : (
                  transcript.map((t, i) => (
                    <div key={i} style={{ padding: '6px 10px', marginBottom: 4, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ fontSize: 9, color: accentColor, fontWeight: 600, marginRight: 6, fontFamily: 'monospace' }}>{t.time}</span>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginRight: 6 }}>[{t.speaker || '?'}]</span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{t.text}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search(searchInput)}
                placeholder="Search transcripts..."
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 12, boxSizing: 'border-box' }} />
              <button onClick={() => search(searchInput)}
                style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: accentColor, color: '#000', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Search</button>
            </div>

            {historyLoading && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Loading...</div>}

            {!historyLoading && calls.length === 0 && (
              <div style={{ textAlign: 'center', padding: 30, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>No call transcripts yet. Make a call to get started.</div>
            )}

            {calls.map((call, i) => {
              let parsed = {};
              try { parsed = JSON.parse(call.content); } catch {}
              return (
                <div key={call.id || i} style={{ padding: 12, marginBottom: 8, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{parsed.from || 'Unknown'} → {parsed.to || 'Unknown'}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{new Date(call.created_at).toLocaleDateString()}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                    {parsed.durationSecs ? formatDuration(parsed.durationSecs) : '—'} | {(parsed.transcript || []).length} segments
                  </div>
                  {parsed.fullText && (
                    <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.5)', maxHeight: 60, overflow: 'hidden', lineHeight: 1.4 }}>
                      {parsed.fullText.substring(0, 200)}...
                    </div>
                  )}
                </div>
              );
            })}

            {total > 20 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 12 }}>
                <button onClick={prevPage} disabled={page <= 1} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', fontSize: 11, cursor: 'pointer' }}>Previous</button>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', alignSelf: 'center' }}>Page {page}</span>
                <button onClick={nextPage} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', fontSize: 11, cursor: 'pointer' }}>Next</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
