// ⬡B:ccwa.aba_dials:V2:proper_identity_and_verification:20260416⬡
// ABA Dials — CIP Mobile Skin V2
// Accepts user object, shows bridge + caller ID verification flow,
// handles HAM_UNRESOLVED, NO_HAM_PHONE, CALLER_ID_NOT_VERIFIED errors.

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  useDialer, useBridge, useCallHistory,
  DIAL_TABS, CALL_STATUS, BRIDGE_STATUS,
  formatDuration, buildIdentity,
  fetchTimCue, fetchCookAnswer, isQuestion,
} from '../utils/dial-core';

const ABABASE = import.meta.env.VITE_ABABASE_URL || 'https://abacia-services.onrender.com';
const api = (path, opts) => fetch(ABABASE + path, opts).then(r => r.json());

export default function DialModeView({ user, userId }) {
  // Build identity from user object. If only legacy userId string passed, wrap it.
  const identity = useMemo(() => {
    if (user && typeof user === 'object') return buildIdentity(user);
    if (userId && userId !== 'unknown') return { email: userId.includes('@') ? userId : null, user_id: userId };
    return {};
  }, [user, userId]);
  
  const identityResolved = !!(identity.email || identity.phone || identity.user_id);
  
  const [tab, setTab] = useState('dialer');
  const [phoneInput, setPhoneInput] = useState('');
  const [purposeInput, setPurposeInput] = useState('');
  const [livePanel, setLivePanel] = useState('transcript');

  const { status, callSid, transcript, seconds, error, errorCode, startCall, endCall } = useDialer(api, identity);
  const { bridgeStatus, bridgeNumber, hamPhone, loading: bridgeLoading, error: bridgeError, errorCode: bridgeErrorCode, verificationCode, callerIdVerified, pollingVerification, setup: setupBridge, verify: verifyCallerId } = useBridge(api, identity);
  const { calls, total, page, loading: historyLoading, search, nextPage, prevPage } = useCallHistory(api, identity);

  const [searchInput, setSearchInput] = useState('');
  const [timCue, setTimCue] = useState(null);
  const [timFading, setTimFading] = useState(false);
  const [cookAnswers, setCookAnswers] = useState([]);
  const timCooldown = useRef(null);
  const cookCooldown = useRef(null);
  const transcriptRef = useRef([]);

  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  // TIM cues
  useEffect(() => {
    if (status !== CALL_STATUS.ACTIVE || transcript.length === 0) return;
    const last = transcript[transcript.length - 1];
    if (!last || timCooldown.current) return;
    timCooldown.current = setTimeout(async () => {
      timCooldown.current = null;
      try {
        const cue = await fetchTimCue(api, last.text, identity.user_id || identity.email, {
          mode: 'dial', callSid,
          recentTranscript: transcriptRef.current.slice(-5).map(t => t.text).join(' '),
        });
        if (cue?.cue) {
          setTimCue(cue.cue); setTimFading(false);
          setTimeout(() => setTimFading(true), 6000);
          setTimeout(() => setTimCue(null), 8000);
        }
      } catch {}
    }, 8000);
    return () => { if (timCooldown.current) clearTimeout(timCooldown.current); };
  }, [transcript.length, status]);

  // COOK answers
  useEffect(() => {
    if (status !== CALL_STATUS.ACTIVE || transcript.length === 0) return;
    const last = transcript[transcript.length - 1];
    if (!last || !isQuestion(last.text) || cookCooldown.current) return;
    cookCooldown.current = setTimeout(async () => {
      cookCooldown.current = null;
      const qText = last.text;
      const entry = { q: qText, text: '', streaming: true, time: last.time };
      setCookAnswers(prev => [entry, ...prev].slice(0, 10));
      try {
        await fetchCookAnswer(api, qText, identity.user_id || identity.email, {
          mode: 'dial', callSid,
          recentTranscript: transcriptRef.current.slice(-8).map(t => t.text).join(' '),
        }, (chunk) => {
          setCookAnswers(prev => { const u = [...prev]; if (u[0]) u[0] = { ...u[0], text: (u[0].text || '') + chunk }; return u; });
        });
        setCookAnswers(prev => { const u = [...prev]; if (u[0]) u[0] = { ...u[0], streaming: false }; return u; });
      } catch {}
    }, 2000);
    return () => { if (cookCooldown.current) clearTimeout(cookCooldown.current); };
  }, [transcript.length, status]);

  const handleDial = useCallback(() => {
    if (!phoneInput.trim()) return;
    startCall(phoneInput.trim(), purposeInput.trim() || 'outbound call');
    setTab('live'); setCookAnswers([]); setTimCue(null);
  }, [phoneInput, purposeInput, startCall]);

  useEffect(() => { if (status === CALL_STATUS.ACTIVE) setTab('live'); }, [status]);

  const accent = '#F59E0B';
  const dimColor = 'rgba(245,158,11,0.15)';

  // ═══════════════════════════════════════════════════
  // NOT SIGNED IN STATE
  // ═══════════════════════════════════════════════════
  if (!identityResolved) {
    return (
      <div style={{ padding: 24, color: '#fff', background: '#0a0a0a', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📞</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>ABA Dials</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', maxWidth: 280 }}>
            Sign in to set up your per-HAM call recording bridge.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0a', color: '#fff' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: status === CALL_STATUS.ACTIVE ? '#22c55e' : accent }} />
        <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '0.1em', color: accent }}>ABA DIALS</span>
        {status === CALL_STATUS.ACTIVE && <span style={{ marginLeft: 'auto', fontSize: 12, color: '#22c55e', fontFamily: 'monospace' }}>{formatDuration(seconds)}</span>}
      </div>

      {/* TIM Cue */}
      {timCue && status === CALL_STATUS.ACTIVE && (
        <div style={{ padding: '8px 16px', background: 'linear-gradient(90deg, rgba(34,211,238,0.12), rgba(34,211,238,0.04))', borderBottom: '1px solid rgba(34,211,238,0.15)', opacity: timFading ? 0.3 : 1, transition: 'opacity 2s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22d3ee' }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(34,211,238,0.6)', letterSpacing: '0.1em' }}>TIM</span>
          </div>
          <div style={{ fontSize: 13, color: 'rgba(34,211,238,0.9)', marginTop: 2 }}>{timCue}</div>
        </div>
      )}

      {/* Tab Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {DIAL_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
              background: tab === t ? dimColor : 'transparent',
              color: tab === t ? accent : 'rgba(255,255,255,0.4)',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              borderBottom: tab === t ? `2px solid ${accent}` : '2px solid transparent' }}>
            {t === 'dialer' ? 'DIAL' : t === 'live' ? 'LIVE' : 'HISTORY'}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {/* === DIALER TAB === */}
        {tab === 'dialer' && (
          <div>
            {/* Unified onboarding card — bridge + caller ID in one flow */}
            <div style={{ marginBottom: 20, padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: 8 }}>ABA DIALS</div>
              
              {bridgeStatus === BRIDGE_STATUS.NOT_SET && (
                <div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 4, fontWeight: 600 }}>Set up your line</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 12, lineHeight: 1.5 }}>
                    One tap. We provision your private bridge number, and Twilio will call you with a 6-digit code so you can keep your real number as caller ID.
                  </div>
                  <button onClick={setupBridge} disabled={bridgeLoading}
                    style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: accent, color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: bridgeLoading ? 0.5 : 1 }}>
                    {bridgeLoading ? 'Setting up...' : 'Set Up ABA Dials'}
                  </button>
                </div>
              )}
              
              {bridgeStatus === BRIDGE_STATUS.PROVISIONING && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Provisioning bridge and starting verification...</div>
              )}
              
              {bridgeStatus === BRIDGE_STATUS.NO_PHONE && (
                <div>
                  <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 6 }}>Phone number required on HAM profile</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>Add your phone number to your profile before setting up ABA Dials. Your phone is needed for ringing and caller ID.</div>
                </div>
              )}
              
              {bridgeStatus === BRIDGE_STATUS.ERROR && (
                <div>
                  <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 6 }}>Error: {bridgeError}</div>
                  <button onClick={setupBridge} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', fontSize: 11, cursor: 'pointer' }}>Retry</button>
                </div>
              )}
              
              {bridgeStatus === BRIDGE_STATUS.ACTIVE && (
                <div>
                  {/* Caller ID verification state */}
                  {verificationCode && !callerIdVerified && (
                    <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                      <div style={{ fontSize: 11, color: '#86efac', marginBottom: 4, fontWeight: 600 }}>Twilio is calling {hamPhone}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>When you answer, enter this code on your keypad:</div>
                      <div style={{ fontSize: 32, fontFamily: 'monospace', fontWeight: 700, color: '#22c55e', letterSpacing: '0.2em', textAlign: 'center', padding: '8px 0' }}>{verificationCode}</div>
                      {pollingVerification && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 4 }}>Waiting for you to enter the code...</div>}
                    </div>
                  )}
                  
                  {/* Active bridge summary */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ color: '#22c55e' }}>✓</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Bridge <span style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.9)' }}>{bridgeNumber}</span></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <span style={{ color: callerIdVerified ? '#22c55e' : 'rgba(255,255,255,0.3)' }}>{callerIdVerified ? '✓' : '○'}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Caller ID <span style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.9)' }}>{hamPhone}</span> {callerIdVerified ? <span style={{ color: '#22c55e' }}>verified</span> : <span style={{ color: 'rgba(255,255,255,0.4)' }}>pending</span>}</span>
                  </div>
                  
                  {callerIdVerified && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                      To forward incoming calls: dial <span style={{ color: accent, fontFamily: 'monospace' }}>*72{bridgeNumber?.replace(/\D/g, '')}</span> from your phone.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Dialer */}
            <div style={{ marginBottom: 12 }}>
              <input value={phoneInput} onChange={e => setPhoneInput(e.target.value)} placeholder="+1 (555) 123-4567"
                style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 18, fontFamily: 'monospace', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <input value={purposeInput} onChange={e => setPurposeInput(e.target.value)} placeholder="Purpose (optional)"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.7)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <button onClick={handleDial} disabled={!phoneInput.trim() || status === CALL_STATUS.CONNECTING || bridgeStatus !== BRIDGE_STATUS.ACTIVE || !callerIdVerified}
              style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: accent, color: '#000', fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: (!phoneInput.trim() || bridgeStatus !== BRIDGE_STATUS.ACTIVE || !callerIdVerified) ? 0.4 : 1 }}>
              {status === CALL_STATUS.CONNECTING ? 'Ringing your phone...' : 'CALL'}
            </button>
            {error && <div style={{ marginTop: 8, fontSize: 12, color: '#ef4444' }}>{error}</div>}
            {(bridgeStatus !== BRIDGE_STATUS.ACTIVE || !callerIdVerified) && <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{bridgeStatus !== BRIDGE_STATUS.ACTIVE ? 'Set up ABA Dials first to place calls.' : 'Finish caller ID verification to place outbound calls.'}</div>}
          </div>
        )}

        {/* === LIVE TAB === */}
        {tab === 'live' && (
          <div>
            {status === CALL_STATUS.IDLE && <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No active call. Go to Dial tab to start one.</div>}
            {(status === CALL_STATUS.ACTIVE || status === CALL_STATUS.ENDED) && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: status === CALL_STATUS.ACTIVE ? '#22c55e' : 'rgba(255,255,255,0.4)' }}>{status === CALL_STATUS.ACTIVE ? 'LIVE' : 'ENDED'} — {formatDuration(seconds)}</span>
                  {status === CALL_STATUS.ACTIVE && <button onClick={endCall} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}>End Call</button>}
                </div>

                <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                  {['transcript', 'coaching'].map(p => (
                    <button key={p} onClick={() => setLivePanel(p)}
                      style={{ flex: 1, padding: '6px 0', border: 'none', borderRadius: 6, cursor: 'pointer',
                        background: livePanel === p ? (p === 'coaching' ? 'rgba(139,92,246,0.12)' : 'rgba(34,211,238,0.1)') : 'rgba(255,255,255,0.03)',
                        color: livePanel === p ? (p === 'coaching' ? 'rgba(139,92,246,0.8)' : 'rgba(34,211,238,0.8)') : 'rgba(255,255,255,0.3)',
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {p === 'transcript' ? `TRANSCRIPT (${transcript.length})` : `COACHING (${cookAnswers.length})`}
                    </button>
                  ))}
                </div>

                {livePanel === 'transcript' && (
                  transcript.length === 0
                    ? <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, fontStyle: 'italic' }}>Listening...</div>
                    : transcript.slice(-15).map((t, i) => (
                      <div key={i} style={{ padding: '6px 10px', marginBottom: 4, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ fontSize: 9, color: accent, fontWeight: 600, marginRight: 6, fontFamily: 'monospace' }}>{t.time}</span>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginRight: 6 }}>[{t.speaker || '?'}]</span>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>{t.text}</span>
                      </div>
                    ))
                )}

                {livePanel === 'coaching' && (
                  cookAnswers.length === 0
                    ? <div style={{ color: 'rgba(139,92,246,0.3)', fontSize: 12, fontStyle: 'italic', textAlign: 'center', padding: 20 }}>COOK will suggest answers when questions are detected.</div>
                    : cookAnswers.map((a, i) => (
                      <div key={i} style={{ padding: 12, marginBottom: 6, borderRadius: 12, background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(139,92,246,0.02))', border: '1px solid rgba(139,92,246,0.12)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                          <div style={{ width: 5, height: 5, borderRadius: '50%', background: a.streaming ? '#a78bfa' : 'rgba(139,92,246,0.3)' }} />
                          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(139,92,246,0.5)', letterSpacing: '0.5px' }}>{a.streaming ? 'THINKING...' : 'COOK'}</span>
                          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.12)', marginLeft: 'auto' }}>{a.time}</span>
                          {!a.streaming && <button onClick={() => navigator.clipboard.writeText(a.text || '')} style={{ padding: '2px 6px', borderRadius: 4, fontSize: 8, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.1)', color: 'rgba(139,92,246,0.4)', cursor: 'pointer' }}>Copy</button>}
                        </div>
                        {a.q && <p style={{ color: 'rgba(139,92,246,0.4)', fontSize: 10, margin: '0 0 4px', fontStyle: 'italic' }}>Re: {a.q.substring(0, 80)}</p>}
                        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{a.text}</p>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>
        )}

        {/* === HISTORY TAB === */}
        {tab === 'history' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && search(searchInput)} placeholder="Search transcripts..."
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 12, boxSizing: 'border-box' }} />
              <button onClick={() => search(searchInput)} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: accent, color: '#000', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Search</button>
            </div>
            {historyLoading && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Loading...</div>}
            {!historyLoading && calls.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>No call transcripts yet.</div>}
            {calls.map((call, i) => {
              let parsed = {}; try { parsed = JSON.parse(call.content); } catch {}
              return (
                <div key={call.id || i} style={{ padding: 12, marginBottom: 8, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{parsed.from || 'Unknown'} → {parsed.to || 'Unknown'}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{new Date(call.created_at).toLocaleDateString()}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{parsed.durationSecs ? formatDuration(parsed.durationSecs) : '—'} | {(parsed.transcript || []).length} segments</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
