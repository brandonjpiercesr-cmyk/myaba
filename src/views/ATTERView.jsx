// ⬡B:MACE.view:CIP:ATTERView:20260413⬡
import React, { useState } from 'react';
import { useRecording, TAG_LEVELS, formatTime, getRecentSessions } from '../utils/atter-core.js';

const API_BASE = import.meta.env.VITE_API_URL || 'https://abacia-services.onrender.com';
const api = async (path, opts = {}) => {
  const resp = await fetch(`${API_BASE}${path}`, { method: opts.method || 'GET', headers: { 'Content-Type': 'application/json' }, ...(opts.body ? { body: JSON.stringify(opts.body) } : {}) });
  return resp.json();
};

export default function ATTERView({ userId = 'brandon' }) {
  const { isRecording, transcript, segments, sessionId, corrections, loading, start, stop, addCorrection, editSegment, setTranscript } = useRecording(api, userId);
  const [result, setResult] = useState(null);
  const [correctionModal, setCorrectionModal] = useState(null);
  const [newWrong, setNewWrong] = useState('');
  const [newCorrect, setNewCorrect] = useState('');
  const [tags, setTags] = useState({ organization: '', team: '', project: '' });
  const [tab, setTab] = useState('record'); // record, history, corrections

  const handleStop = async () => {
    const r = await stop();
    if (r) setResult(r);
  };

  const handleAddCorrection = async () => {
    if (newWrong && newCorrect) {
      await addCorrection(newWrong, newCorrect);
      setNewWrong(''); setNewCorrect('');
      setCorrectionModal(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 50%, #1a1040 100%)', color: '#e8e0f0', fontFamily: "'DM Sans', sans-serif", padding: 16, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', padding: '20px 0 12px' }}>
        <div style={{ fontSize: 28, fontWeight: 700, background: 'linear-gradient(90deg, #a78bfa, #c4b5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ATTER</div>
        <div style={{ fontSize: 11, color: '#a89cc8', letterSpacing: 2 }}>AUDIO TRANSCRIPTION &amp; THOUGHT EXPRESSION</div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderRadius: 12, background: 'rgba(255,255,255,0.06)', padding: 4 }}>
        {[['record','Record'],['history','History'],['corrections','Words']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === k ? 'linear-gradient(135deg, #8b5cf6, #a78bfa)' : 'transparent', color: tab === k ? '#fff' : '#a89cc8'
          }}>{l}</button>
        ))}
      </div>

      {tab === 'record' && (
        <div>
          {/* Record Button */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <button onClick={isRecording ? handleStop : start} disabled={loading} style={{
              width: 120, height: 120, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: isRecording ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
              boxShadow: isRecording ? '0 0 40px rgba(239,68,68,0.4)' : '0 0 30px rgba(139,92,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
              animation: isRecording ? 'pulse 1.5s infinite' : 'none'
            }}>
              <span style={{ fontSize: 40 }}>{isRecording ? '⏹' : '🎙️'}</span>
            </button>
            <div style={{ fontSize: 14, color: '#a89cc8', marginTop: 12 }}>{isRecording ? 'Recording... tap to stop' : loading ? 'Processing...' : 'Tap to start recording'}</div>
          </div>

          {/* Live Transcript */}
          {(transcript || isRecording) && (
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, marginBottom: 12, minHeight: 120 }}>
              <div style={{ fontSize: 13, color: '#8b5cf6', fontWeight: 600, marginBottom: 8 }}>Live Transcript</div>
              <div style={{ fontSize: 15, lineHeight: 1.7, color: '#e8e0f0' }}>{transcript || <span style={{color:'#a89cc8', fontStyle:'italic'}}>Listening...</span>}</div>
            </div>
          )}

          {/* Segments (editable) */}
          {segments.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: '#a89cc8', marginBottom: 6 }}>Segments ({segments.length})</div>
              {segments.slice(-5).map((seg, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 10, marginBottom: 4, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ flex: 1 }}>{seg.text}</span>
                  <button onClick={() => {
                    const edited = prompt('Edit this segment:', seg.text);
                    if (edited !== null) editSegment(segments.length - 5 + i, edited);
                  }} style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', fontSize: 12 }}>✏️</button>
                </div>
              ))}
            </div>
          )}

          {/* Word Correction Quick Add */}
          {isRecording && (
            <button onClick={() => setCorrectionModal(true)} style={{
              width: '100%', padding: 12, borderRadius: 10, border: '1px dashed rgba(139,92,246,0.4)', cursor: 'pointer',
              background: 'transparent', color: '#8b5cf6', fontSize: 13, marginBottom: 12
            }}>+ Teach ABA a word correction</button>
          )}

          {/* Result */}
          {result && (
            <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: 12, padding: 16, border: '1px solid rgba(34,197,94,0.2)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#22c55e', marginBottom: 8 }}>Recording Complete</div>
              <div style={{ fontSize: 13, color: '#c8c0d8' }}>Words: {result.wordCount} | Corrections applied: {result.correctionsApplied}</div>
              <div style={{ fontSize: 13, color: '#c8c0d8' }}>LOGFUL processed: {result.logfulProcessed ? '✓' : '—'} | Actions found: {result.actionItems}</div>
            </div>
          )}

          {/* Correction Modal */}
          {correctionModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
              <div style={{ background: '#2d1b4e', borderRadius: 16, padding: 24, width: '90%', maxWidth: 360 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#a78bfa', marginBottom: 16 }}>Teach ABA a word</div>
                <input placeholder="ABA hears (wrong)..." value={newWrong} onChange={e => setNewWrong(e.target.value)} style={{ width: '100%', padding: 12, marginBottom: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#e8e0f0', fontSize: 14, outline: 'none' }} />
                <input placeholder="Should be (correct)..." value={newCorrect} onChange={e => setNewCorrect(e.target.value)} style={{ width: '100%', padding: 12, marginBottom: 16, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#e8e0f0', fontSize: 14, outline: 'none' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setCorrectionModal(null)} style={{ flex: 1, padding: 12, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.08)', color: '#e8e0f0' }}>Cancel</button>
                  <button onClick={handleAddCorrection} style={{ flex: 1, padding: 12, borderRadius: 8, border: 'none', cursor: 'pointer', background: '#8b5cf6', color: '#fff', fontWeight: 600 }}>Save</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'corrections' && (
        <div>
          <div style={{ fontSize: 14, color: '#a89cc8', marginBottom: 12 }}>ABA learns these corrections and applies them automatically during transcription.</div>
          {corrections.map((c, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: 8, marginBottom: 6, fontSize: 14 }}>
              <span><s style={{color:'#ef4444'}}>{c.wrong}</s> → <span style={{color:'#22c55e'}}>{c.correct}</span></span>
            </div>
          ))}
          {corrections.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: '#a89cc8' }}>No corrections yet. ABA will learn as you teach her.</div>}
        </div>
      )}

      <style>{`@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }`}</style>
    </div>
  );
}
