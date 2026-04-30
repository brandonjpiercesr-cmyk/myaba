// ⬡B:MACE.view:CIP:WritesView:20260413⬡
import React, { useEffect, useState } from 'react';
import { useWritingSession, getStatusColor, getStatusLabel } from '../utils/writes-core.js';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_ABABASE_URL || 'https://ababase.onrender.com';
const api = async (path, opts = {}) => {
  const resp = await fetch(`${API_BASE}${path}`, { method: opts.method || 'GET', headers: { 'Content-Type': 'application/json' }, ...(opts.body ? { body: JSON.stringify(opts.body) } : {}) });
  return resp.json();
};

export default function WritesView({ userId = 'brandon' }) {
  const { session, library, suggestions, loading, contentBlocks, loadLibrary, loadSuggestions, startSession, addContent } = useWritingSession(api, userId);
  const [tab, setTab] = useState('library'); // library, write, suggest
  const [selectedBook, setSelectedBook] = useState(null);
  const [chapter, setChapter] = useState('');
  const [input, setInput] = useState('');

  useEffect(() => { loadLibrary(); loadSuggestions(); }, []);

  const handleStartSession = (bookId) => {
    setSelectedBook(bookId);
    startSession(bookId, chapter ? parseInt(chapter) : null);
    setTab('write');
  };

  const handleSaveContent = () => {
    if (input.trim()) {
      addContent(input.trim(), 'raw');
      setInput('');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a0f0a 0%, #2d1a0e 50%, #1f130c 100%)', color: '#f0e0d0', fontFamily: "'DM Sans', sans-serif", padding: 16, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', padding: '20px 0 12px' }}>
        <div style={{ fontSize: 28, fontWeight: 700, background: 'linear-gradient(90deg, #f5d99a, #d4a053)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ABA WRITES</div>
        <div style={{ fontSize: 11, color: '#b89a78', letterSpacing: 2 }}>AUTHOR WRITING &amp; ITERATIVE THINKING</div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderRadius: 12, background: 'rgba(255,255,255,0.06)', padding: 4 }}>
        {[['library','Books'],['write','Write'],['suggest','Next']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === k ? 'linear-gradient(135deg, #d4a053, #f5d99a)' : 'transparent', color: tab === k ? '#1a0f0a' : '#b89a78'
          }}>{l}</button>
        ))}
      </div>

      {/* LIBRARY TAB */}
      {tab === 'library' && library && (
        <div>
          {Object.entries(library).map(([bookId, book]) => (
            <div key={bookId} onClick={() => handleStartSession(bookId)} style={{
              background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, marginBottom: 8, cursor: 'pointer',
              borderLeft: `3px solid ${getStatusColor(book.status)}`, transition: 'transform 0.1s'
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f5d99a' }}>{book.title}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: `${getStatusColor(book.status)}22`, color: getStatusColor(book.status) }}>{getStatusLabel(book.status)}</span>
                {book.completionPct && <span style={{ fontSize: 11, color: '#b89a78' }}>{book.completionPct}%</span>}
                {book.genre && <span style={{ fontSize: 11, color: '#8a7a68' }}>{book.genre}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* WRITE TAB */}
      {tab === 'write' && (
        <div>
          {session ? (
            <>
              <div style={{ background: 'rgba(212,160,83,0.1)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f5d99a' }}>{session.book}</div>
                {session.chapter && <div style={{ fontSize: 13, color: '#b89a78' }}>Chapter {session.chapter}</div>}
                {session.writingTips && <div style={{ fontSize: 12, color: '#8a7a68', marginTop: 8, lineHeight: 1.5 }}>{session.writingTips}</div>}
              </div>

              {/* Content blocks saved */}
              {contentBlocks.map((block, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 10, marginBottom: 6, fontSize: 13, color: '#c8b8a8' }}>
                  {block.content.substring(0, 150)}... <span style={{ color: '#22c55e', fontSize: 11 }}>✓ saved</span>
                </div>
              ))}

              {/* Input area */}
              <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Talk to ABA... share your thoughts, stories, ideas for this chapter..." rows={6} style={{
                width: '100%', padding: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)',
                color: '#f0e0d0', fontSize: 15, lineHeight: 1.6, outline: 'none', resize: 'vertical', marginBottom: 8
              }} />
              <button onClick={handleSaveContent} disabled={loading || !input.trim()} style={{
                width: '100%', padding: 14, borderRadius: 10, border: 'none', cursor: 'pointer',
                background: loading ? '#8a7a68' : 'linear-gradient(135deg, #d4a053, #f5d99a)', color: '#1a0f0a', fontSize: 15, fontWeight: 600
              }}>{loading ? 'Saving...' : 'Save Content Block'}</button>

              {/* Cross-references */}
              {session.crossReferences && Object.keys(session.crossReferences).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, color: '#d4a053', fontWeight: 600, marginBottom: 8 }}>Cross-Book References</div>
                  {Object.entries(session.crossReferences).map(([ref, items]) => (
                    <div key={ref} style={{ fontSize: 12, color: '#8a7a68', marginBottom: 4 }}>
                      → {ref}: {Array.isArray(items) ? items.join(', ') : items}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 30, color: '#8a7a68' }}>Select a book from the Library tab to start writing.</div>
          )}
        </div>
      )}

      {/* SUGGEST TAB */}
      {tab === 'suggest' && (
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#f5d99a', marginBottom: 12 }}>What should you work on next?</div>
          {suggestions.map((s, i) => (
            <div key={i} onClick={() => { setSelectedBook(s.bookId); startSession(s.bookId); setTab('write'); }} style={{
              background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, marginBottom: 8, cursor: 'pointer',
              borderLeft: `3px solid ${s.priority === 'high' ? '#f59e0b' : '#38bdf8'}`
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f5d99a' }}>{s.bookId}</div>
              <div style={{ fontSize: 13, color: '#c8b8a8', marginTop: 4 }}>{s.action}</div>
              <div style={{ fontSize: 11, color: s.priority === 'high' ? '#f59e0b' : '#38bdf8', marginTop: 4 }}>Priority: {s.priority}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
