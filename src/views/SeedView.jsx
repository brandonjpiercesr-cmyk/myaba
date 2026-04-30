// ⬡B:MACE.view:CIP:SeedView:20260413⬡
import React from 'react';
import { useOnboarding } from '../utils/sync-core.js';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_ABABASE_URL || 'https://ababase.onrender.com';
const api = async (path, opts = {}) => {
  const resp = await fetch(`${API_BASE}${path}`, { method: opts.method || 'GET', headers: { 'Content-Type': 'application/json' }, ...(opts.body ? { body: JSON.stringify(opts.body) } : {}) });
  return resp.json();
};

export default function SeedView({ userId = 'newuser' }) {
  const { questionnaire, status, uploading, step, generate, upload, refreshStatus, setStep } = useOnboarding(api, userId);
  const [responseText, setResponseText] = React.useState('');

  const steps = [
    { key: 'generate', label: 'Generate', icon: '📋' },
    { key: 'download', label: 'Download', icon: '⬇️' },
    { key: 'upload', label: 'Upload', icon: '⬆️' },
    { key: 'processing', label: 'Processing', icon: '⚙️' },
    { key: 'complete', label: 'Done', icon: '✅' }
  ];
  const stepIndex = steps.findIndex(s => s.key === step);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a1628 0%, #122040 50%, #0c1830 100%)', color: '#d0e0f0', fontFamily: "'DM Sans', sans-serif", padding: 16, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', padding: '20px 0 12px' }}>
        <div style={{ fontSize: 28, fontWeight: 700, background: 'linear-gradient(90deg, #34d399, #6ee7b7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ABA SYNC</div>
        <div style={{ fontSize: 11, color: '#6aaa90', letterSpacing: 2 }}>GETTING TO KNOW YOU</div>
      </div>

      {/* Progress Steps */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
        {steps.map((s, i) => (
          <div key={s.key} style={{ textAlign: 'center' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: i <= stepIndex ? 'linear-gradient(135deg, #34d399, #6ee7b7)' : 'rgba(255,255,255,0.08)',
              color: i <= stepIndex ? '#0a1628' : '#6aaa90', fontSize: 18, transition: 'all 0.3s'
            }}>{s.icon}</div>
            <div style={{ fontSize: 10, color: i <= stepIndex ? '#34d399' : '#4a7a68', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Step 1: Generate */}
      {step === 'generate' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, lineHeight: 1.6, color: '#a0c8b8', marginBottom: 20, padding: '0 20px' }}>
            ABA needs to get to know you. We will generate a set of questions, you upload them to your existing AI assistant (ChatGPT, Gemini, etc.), and bring the answers back.
          </div>
          <button onClick={generate} style={{
            padding: '16px 40px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #34d399, #6ee7b7)', color: '#0a1628', fontSize: 16, fontWeight: 700
          }}>Generate My Questions</button>
        </div>
      )}

      {/* Step 2: Download */}
      {step === 'download' && questionnaire && (
        <div>
          <div style={{ fontSize: 14, color: '#6aaa90', marginBottom: 12 }}>Copy this text and paste it into ChatGPT or Gemini. Ask it to answer based on what it knows about you.</div>
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, marginBottom: 12, maxHeight: 400, overflow: 'auto' }}>
            <pre style={{ fontSize: 13, color: '#a0c8b8', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{questionnaire}</pre>
          </div>
          <button onClick={() => { navigator.clipboard?.writeText(questionnaire); }} style={{
            width: '100%', padding: 14, borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'rgba(52,211,153,0.2)', color: '#34d399', fontSize: 14, fontWeight: 600, marginBottom: 8
          }}>Copy to Clipboard</button>
          <button onClick={() => setStep('upload')} style={{
            width: '100%', padding: 14, borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #34d399, #6ee7b7)', color: '#0a1628', fontSize: 14, fontWeight: 600
          }}>I Have My Answers → Upload</button>
        </div>
      )}

      {/* Step 3: Upload */}
      {step === 'upload' && (
        <div>
          <div style={{ fontSize: 14, color: '#6aaa90', marginBottom: 12 }}>Paste the response you got from your AI assistant below.</div>
          <textarea value={responseText} onChange={e => setResponseText(e.target.value)} placeholder="Paste the full response here..." rows={10} style={{
            width: '100%', padding: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)',
            color: '#d0e0f0', fontSize: 14, lineHeight: 1.6, outline: 'none', resize: 'vertical', marginBottom: 12
          }} />
          <button onClick={() => upload(responseText)} disabled={uploading || responseText.length < 100} style={{
            width: '100%', padding: 14, borderRadius: 10, border: 'none', cursor: 'pointer',
            background: uploading ? '#4a7a68' : 'linear-gradient(135deg, #34d399, #6ee7b7)', color: '#0a1628', fontSize: 15, fontWeight: 600
          }}>{uploading ? 'Uploading...' : 'Upload to ABA'}</button>
        </div>
      )}

      {/* Step 4: Processing */}
      {step === 'processing' && (
        <div style={{ textAlign: 'center', padding: 30 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚙️</div>
          <div style={{ fontSize: 16, color: '#34d399', marginBottom: 8 }}>Building your profile...</div>
          <div style={{ fontSize: 13, color: '#6aaa90' }}>ABA is extracting your preferences, routines, and goals.</div>
          <button onClick={refreshStatus} style={{ marginTop: 20, padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(52,211,153,0.2)', color: '#34d399' }}>Check Status</button>
        </div>
      )}

      {/* Step 5: Complete */}
      {step === 'complete' && (
        <div style={{ textAlign: 'center', padding: 30 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#34d399', marginBottom: 8 }}>Welcome to ABA</div>
          <div style={{ fontSize: 14, color: '#a0c8b8', lineHeight: 1.6 }}>Your profile is set up. ABA now knows you and can start personalizing your experience. Your morning briefings, app recommendations, and assistant responses will all be tailored to you.</div>
        </div>
      )}
    </div>
  );
}
