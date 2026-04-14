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

      {/* Entries */}
      {tab === 'all' && entries.map((entry, i) => (
        <div key={i} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, marginBottom: 8, borderLeft: `3px solid ${getToneColor(entry.emotionalTone || 'neutral')}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#7aa2c8' }}>{getSourceIcon(entry.source?.split('.')[0])} {entry.source?.split('.')[0]}</span>
            <span style={{ fontSize: 11, color: '#5a7a98' }}>{formatEntryDate(entry.created_at)}</span>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: '#c8d8e8' }}>
            {entry.summary || entry.raw?.substring(0, 200) || JSON.stringify(entry).substring(0, 200)}
          </div>
          {entry.keyTopics?.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
              {entry.keyTopics.map((t, j) => (
                <span key={j} style={{ padding: '2px 8px', borderRadius: 12, background: 'rgba(56,189,248,0.15)', color: '#38bdf8', fontSize: 11 }}>{t}</span>
              ))}
            </div>
          )}
        </div>
      ))}

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
