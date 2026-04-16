// ⬡B:MACE.view:CIP:LogfulView:20260413⬡
import React, { useEffect } from 'react';
import { useLogEntries, LOG_SOURCES, formatEntryDate, getSourceIcon, getToneColor } from '../utils/logful-core.js';

const API_BASE = import.meta.env.VITE_API_URL || 'https://abacia-services.onrender.com';
const api = async (path, opts = {}) => {
  const resp = await fetch(`${API_BASE}${path}`, { method: opts.method || 'GET', headers: { 'Content-Type': 'application/json' }, ...(opts.body ? { body: JSON.stringify(opts.body) } : {}) });
  return resp.json();
};

export default function LogfulView({ userId = 'brandon' }) {
  const { entries, loading, searchQuery, filters, actionItems, search, updateFilters, loadEntries, setReminder } = useLogEntries(api, userId);
  const [searchInput, setSearchInput] = React.useState('');
  const [tab, setTab] = React.useState('all'); // all, actions, search

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0c1220 0%, #1a2332 50%, #0f1922 100%)', color: '#e0e8f0', fontFamily: "'DM Sans', sans-serif", padding: 16, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', padding: '20px 0 12px' }}>
        <div style={{ fontSize: 28, fontWeight: 700, background: 'linear-gradient(90deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>LOGFUL</div>
        <div style={{ fontSize: 11, color: '#7aa2c8', letterSpacing: 2 }}>LOGGING OPERATIONS &amp; GENERAL FEEDBACK</div>
      </div>

      {/* Search Bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={searchInput} onChange={e => setSearchInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && search(searchInput)} placeholder="Search everything..." style={{
          flex: 1, padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#e0e8f0', fontSize: 14, outline: 'none'
        }} />
        <button onClick={() => search(searchInput)} style={{ padding: '0 16px', borderRadius: 10, border: 'none', background: '#38bdf8', color: '#0c1220', fontWeight: 600, cursor: 'pointer' }}>🔍</button>
      </div>

      {/* Source Filter */}
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 12, paddingBottom: 4 }}>
        <button onClick={() => updateFilters({ source: '' })} style={{ padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap', background: !filters.source ? '#38bdf8' : 'rgba(255,255,255,0.08)', color: !filters.source ? '#0c1220' : '#7aa2c8' }}>All</button>
        {LOG_SOURCES.map(s => (
          <button key={s} onClick={() => updateFilters({ source: s })} style={{ padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap', background: filters.source === s ? '#38bdf8' : 'rgba(255,255,255,0.08)', color: filters.source === s ? '#0c1220' : '#7aa2c8' }}>
            {getSourceIcon(s)} {s}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderRadius: 10, background: 'rgba(255,255,255,0.06)', padding: 3 }}>
        {[['all','All Entries'],['actions',`Actions (${actionItems.length})`]].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === k ? '#38bdf8' : 'transparent', color: tab === k ? '#0c1220' : '#7aa2c8'
          }}>{l}</button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 30, color: '#38bdf8' }}>Loading...</div>}

      {/* Entries — ⬡B:LOGFUL:VIEW:soul_prayer_render:20260416⬡ */}
      {tab === 'all' && entries.map((entry, i) => {
        // Infer type from source prefix
        const src = entry.source || '';
        const isPrayer = src.startsWith('soul.prayer.');
        const isDeclaration = src.startsWith('soul.declaration.');
        const isJournal = src.startsWith('logful.entry.') || src.startsWith('logful_journal') || src.startsWith('journal.');
        const isSermon = src.startsWith('soul.sermon.');
        const isAtter = src.startsWith('atter.');
        const isOmi = src.startsWith('omi_');
        const isMeeting = src.startsWith('mars.') || src.startsWith('meeting.');
        
        // Source label + icon + color per type
        let label = entry.source?.split('.')[0] || entry.source?.split('_')[0] || 'entry';
        let borderColor = getToneColor(entry.emotionalTone || entry.mood || 'neutral');
        let icon = getSourceIcon(label);
        
        if (isPrayer) { label = 'prayer'; icon = '🙏'; borderColor = '#c4a265'; }
        else if (isDeclaration) { label = 'declaration'; icon = '💬'; borderColor = '#f5d99a'; }
        else if (isJournal) { label = 'journal'; icon = '📓'; borderColor = '#818cf8'; }
        else if (isSermon) { label = 'sermon'; icon = '🕊️'; borderColor = '#a78bfa'; }
        else if (isAtter) { label = 'atter'; icon = '🎤'; }
        else if (isOmi) { label = 'omi'; icon = '📡'; }
        else if (isMeeting) { label = 'meeting'; icon = '💬'; }
        
        // Body text: handle all shapes
        const bodyText = entry.text                    // soul_prayer, logful_entry shape
          || entry.content_text                        // newer shape
          || entry.summary                             // atter/omi shape
          || entry.correctedTranscript                 // atter transcript
          || entry.rawTranscript                       // atter raw
          || entry.raw                                 // generic
          || (typeof entry.content === 'string' ? entry.content : null)
          || '';
        
        return (
          <div key={i} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, marginBottom: 8, borderLeft: `3px solid ${borderColor}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: '#7aa2c8', display: 'flex', gap: 6, alignItems: 'center' }}>
                <span>{icon} {label}</span>
                {entry.privacy === 'private' && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(129,140,248,0.2)', color: '#a5b4fc' }}>private</span>}
                {entry.category && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(196,162,101,0.15)', color: '#c4a265' }}>{entry.category}</span>}
                {entry.mood && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(129,140,248,0.15)', color: '#818cf8' }}>{entry.mood}</span>}
              </span>
              <span style={{ fontSize: 11, color: '#5a7a98' }}>{formatEntryDate(entry.created_at || entry.loggedAt)}</span>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.5, color: '#c8d8e8' }}>
              {bodyText.substring(0, 280) || <span style={{ color: '#5a7a98', fontStyle: 'italic' }}>(empty)</span>}
            </div>
            {entry.keyTopics?.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                {entry.keyTopics.map((t, j) => (
                  <span key={j} style={{ padding: '2px 8px', borderRadius: 12, background: 'rgba(56,189,248,0.15)', color: '#38bdf8', fontSize: 11 }}>{t}</span>
                ))}
              </div>
            )}
            {entry.tags?.length > 0 && !entry.keyTopics?.length && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                {entry.tags.slice(0,5).map((t, j) => (
                  <span key={j} style={{ padding: '2px 8px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', color: '#7aa2c8', fontSize: 10 }}>{t}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Action Items */}
      {tab === 'actions' && actionItems.map((action, i) => (
        <div key={i} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, marginBottom: 8, borderLeft: '3px solid #f59e0b' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f5d99a' }}>{action.task || action.raw}</div>
          {action.deadline && <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>Due: {action.deadline}</div>}
          {action.urgency && <div style={{ fontSize: 11, color: '#7aa2c8' }}>Urgency: {action.urgency}</div>}
        </div>
      ))}

      {!loading && entries.length === 0 && tab === 'all' && (
        <div style={{ textAlign: 'center', padding: 40, color: '#5a7a98' }}>No entries yet. Start recording with ATTER or log through any channel.</div>
      )}
    </div>
  );
}
