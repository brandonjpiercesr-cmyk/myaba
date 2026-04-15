// ⬡B:BIRTH.PAGE:VIEW:reading_view_v2:20260413⬡
// ReadingView v2 — visual redesign with covers, reading plans, progress bars
import { useState, useEffect, useCallback } from 'react';

const API_BASE = 'https://abacia-services.onrender.com';
const SUPABASE_URL = 'https://htlxjkbrstpwwtzsbyvb.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0bHhqa2Jyc3Rwd3d0enNieXZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MzI4MjEsImV4cCI6MjA4NjEwODgyMX0.MOgNYkezWpgxTO3ZHd0omZ0WLJOOR-tL7hONXWG9eBw';

export default function ReadingView({ userId }) {
  const [tab, setTab] = useState('library');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState({ audiobooks: [], ebooks: [], openLibrary: [] });
  const [readingList, setReadingList] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [readerBook, setReaderBook] = useState(null);
  const [chapterText, setChapterText] = useState('');
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterNum, setChapterNum] = useState(1);
  const [chapterMeta, setChapterMeta] = useState({});
  const [abaResponse, setAbaResponse] = useState('');
  const [planLoading, setPlanLoading] = useState(null); // book title being planned
  const [importMode, setImportMode] = useState('paste');
  const [pasteText, setPasteText] = useState('');
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteAuthor, setPasteAuthor] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');
  const [epubUrl, setEpubUrl] = useState('');
  const [highlightsText, setHighlightsText] = useState('');
  const [highlightsBook, setHighlightsBook] = useState('');

  const callAIR = useCallback(async (message) => {
    try {
      const res = await fetch(`${API_BASE}/api/air/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, user_id: userId, channel: 'chat' })
      });
      return await res.json();
    } catch (e) { return { error: e.message }; }
  }, [userId]);

  // Direct Supabase for reading list (no AIR overhead)
  const loadList = async () => {
    setListLoading(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/aba_memory?memory_type=eq.page_reading_list&user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc&limit=20`,
        { headers: { apikey: SUPABASE_ANON } }
      );
      const rows = await res.json();
      const books = (rows || []).map(r => {
        try { return typeof r.content === 'string' ? JSON.parse(r.content) : r.content; }
        catch { return null; }
      }).filter(Boolean);
      setReadingList(books);
    } catch { setReadingList([]); }
    setListLoading(false);
  };

  // ⬡B:BIRTH.PAGE:FIX:direct_search_no_air:20260414⬡
  // Search directly against free public APIs — no AIR, no Sonnet, no 30-second wait
  // Open Library (4.8M books) + Gutendex (76K ebooks) + LibriVox (20K audiobooks)
  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResults({ audiobooks: [], ebooks: [], openLibrary: [] });
    setAbaResponse('');
    const q = encodeURIComponent(query.trim());

    // Fire all three searches in parallel
    const [olRes, gutRes, lvRes] = await Promise.allSettled([
      fetch(`https://openlibrary.org/search.json?q=${q}&limit=10&fields=key,title,author_name,first_publish_year,subject,cover_i,number_of_pages_median,edition_count,ia`)
        .then(r => r.ok ? r.json() : { docs: [] }).catch(() => ({ docs: [] })),
      fetch(`https://gutendex.com/books/?search=${q}`)
        .then(r => r.ok ? r.json() : { results: [] }).catch(() => ({ results: [] })),
      fetch(`https://librivox.org/api/feed/audiobooks/?title=${q}&format=json&limit=10`)
        .then(r => r.ok ? r.json() : { books: [] }).catch(() => ({ books: [] }))
    ]);

    const olData = olRes.status === 'fulfilled' ? olRes.value : { docs: [] };
    const gutData = gutRes.status === 'fulfilled' ? gutRes.value : { results: [] };
    const lvData = lvRes.status === 'fulfilled' ? lvRes.value : { books: [] };

    const openLibrary = (olData.docs || []).map(d => ({
      source: 'openlibrary', key: d.key, title: d.title,
      author: (d.author_name || []).join(', '), year: d.first_publish_year,
      subjects: (d.subject || []).slice(0, 8), pages: d.number_of_pages_median,
      editions: d.edition_count || 0,
      cover_url: d.cover_i ? 'https://covers.openlibrary.org/b/id/' + d.cover_i + '-M.jpg' : null,
      ia_id: (d.ia || [])[0] || null, readable: !!(d.ia && d.ia.length > 0)
    }));

    const ebooks = (gutData.results || []).slice(0, 10).map(b => {
      const fmts = b.formats || {};
      return {
        source: 'gutenberg', id: b.id, title: b.title,
        author: (b.authors || []).map(a => a.name).join(', '),
        has_text: !!(fmts['text/plain; charset=utf-8'] || fmts['text/plain']),
        has_audio: false, download_count: b.download_count
      };
    });

    const audiobooks = (lvData.books || []).map(b => ({
      source: 'librivox', id: b.id, title: b.title,
      author: (b.authors || []).map(a => a.first_name + ' ' + a.last_name).join(', '),
      totaltime: b.totaltime, num_sections: b.num_sections,
      url_librivox: b.url_librivox
    }));

    setResults({ openLibrary, ebooks, audiobooks });
    setSearching(false);
  };

  // START READING PLAN — triggers Gemini chapter generation
  const startReadingPlan = async (title, author) => {
    setPlanLoading(title);
    const data = await callAIR(`add ${title} by ${author || 'unknown'} to my daily reading plan`);
    setPlanLoading(null);
    setAbaResponse(data.response || 'Reading plan created.');
    loadList(); // Refresh list
  };

  const openBook = async (bookId, source, chapter = 1) => {
    setTab('reader');
    setChapterLoading(true);
    setChapterNum(chapter);
    const data = await callAIR(`use page_get_chapter with book_id ${bookId} source ${source} chapter ${chapter}`);
    const chTool = (data.toolsExecuted || []).find(t => t.tool_name === 'page_get_chapter');
    if (chTool?.result) {
      setChapterText(chTool.result.text || '');
      setChapterMeta({ title: chTool.result.title, author: chTool.result.author, chapterTitle: chTool.result.chapter_title, chapterNumber: chTool.result.chapter_number, totalChapters: chTool.result.total_chapters, toc: chTool.result.table_of_contents || [], listenUrl: chTool.result.listen_url });
      setReaderBook({ id: bookId, source });
    }
    setAbaResponse(data.response || '');
    setChapterLoading(false);
  };

  const importPastedText = async () => {
    if (!pasteText.trim() || !pasteTitle.trim()) return;
    setImporting(true);
    const bookId = pasteTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40).toLowerCase();
    await callAIR(`Save this book to my reading list and brain. Title: "${pasteTitle}", Author: "${pasteAuthor || 'Unknown'}". Store it with book_id "${bookId}" and source "brain". Here is the text for chapter 1:\n\n${pasteText.substring(0, 7000)}`);
    setImportResult('Saved to your library.');
    setPasteText(''); setPasteTitle(''); setPasteAuthor('');
    setImporting(false);
    loadList();
  };

  const importEpubFromUrl = async () => {
    if (!epubUrl.trim()) return;
    setImporting(true);
    const data = await callAIR(`download and import this epub to my reading library: ${epubUrl}`);
    setImportResult(data.response || 'Processing...');
    setEpubUrl(''); setImporting(false); loadList();
  };

  const importHighlights = async () => {
    if (!highlightsText.trim() || !highlightsBook.trim()) return;
    setImporting(true);
    await callAIR(`Save these Kindle highlights from "${highlightsBook}" to my brain. These are passages I highlighted while reading:\n\n${highlightsText.substring(0, 8000)}`);
    setImportResult('Highlights saved.');
    setHighlightsText(''); setHighlightsBook(''); setImporting(false);
  };

  useEffect(() => { loadList(); }, []);

  const c = {
    bg: '#0d0d0d', card: '#1a1a1a', cardHover: '#222', border: '#2a2a2a',
    accent: '#d4a574', accentLight: '#e8c9a0', accentDim: 'rgba(212,165,116,0.15)',
    text: '#e8e0d8', textDim: '#8a7f74', textMuted: '#5a524a',
    green: '#6db070', blue: '#6ba3d4', purple: '#9b8ec4',
    font: "'Georgia', 'Palatino Linotype', serif",
    sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  };

  const Progress = ({ current, total }) => {
    const pct = total ? Math.min((current / total) * 100, 100) : 0;
    return (
      <div style={{ height: 4, borderRadius: 2, background: c.border, overflow: 'hidden', marginTop: 6 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${c.accent}, ${c.accentLight})`, borderRadius: 2, transition: 'width 0.5s' }} />
      </div>
    );
  };

  const BookCover = ({ url, title, size = 'md' }) => {
    const sizes = { sm: { w: 48, h: 72 }, md: { w: 64, h: 96 }, lg: { w: 80, h: 120 } };
    const s = sizes[size];
    return url ? (
      <img src={url} alt={title} style={{ width: s.w, height: s.h, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} onError={e => { e.target.style.display = 'none'; }} />
    ) : (
      <div style={{ width: s.w, height: s.h, borderRadius: 4, background: c.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>
        📖
      </div>
    );
  };

  const tabStyle = (active) => ({
    padding: '8px 18px', borderRadius: 20, border: 'none', fontFamily: c.sans, fontSize: 13, fontWeight: active ? 600 : 400,
    background: active ? c.accent : 'transparent', color: active ? '#0d0d0d' : c.textDim, cursor: 'pointer', transition: 'all 0.2s'
  });

  const btnPrimary = { padding: '10px 20px', borderRadius: 8, border: 'none', background: c.accent, color: '#0d0d0d', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: c.sans };
  const btnSecondary = { padding: '6px 12px', borderRadius: 6, border: `1px solid ${c.border}`, background: 'transparent', color: c.textDim, fontSize: 12, cursor: 'pointer', fontFamily: c.sans };
  const inputStyle = { width: '100%', padding: '12px 16px', borderRadius: 8, border: `1px solid ${c.border}`, background: c.card, color: c.text, fontSize: 15, fontFamily: c.sans, outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ padding: '12px', fontFamily: c.font, color: c.text, maxWidth: '100%', minHeight: '70vh' }}>
      {/* TABS */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {['library', 'search', 'import', ...(readerBook ? ['reader'] : [])].map(t => (
          <button key={t} onClick={() => setTab(t)} style={tabStyle(tab === t)}>
            {t === 'library' ? 'My Library' : t === 'search' ? 'Discover' : t === 'import' ? 'Import' : 'Reader'}
          </button>
        ))}
      </div>

      {/* MY LIBRARY */}
      {tab === 'library' && (
        <div>
          {listLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: c.textMuted }}>Loading your library...</div>
          ) : readingList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
              <div style={{ fontSize: 18, color: c.text, marginBottom: 8, fontFamily: c.font }}>Your library is empty</div>
              <div style={{ fontSize: 14, color: c.textDim, marginBottom: 24, lineHeight: 1.6 }}>
                Search for a book in Discover, or tell ABA in chat:<br/>
                <span style={{ color: c.accent, fontStyle: 'italic' }}>"Add Purpose Driven Life to my reading plan"</span>
              </div>
              <button onClick={() => setTab('search')} style={btnPrimary}>Discover Books</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {readingList.map((b, i) => {
                const pct = b.total_chapters ? Math.round((b.current_chapter / b.total_chapters) * 100) : 0;
                return (
                  <div key={i} style={{ display: 'flex', gap: 14, padding: 14, background: c.card, borderRadius: 12, border: `1px solid ${c.border}`, alignItems: 'flex-start' }}>
                    <BookCover url={b.cover_url} title={b.book_title} size="md" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: c.text, marginBottom: 2 }}>{b.book_title}</div>
                      <div style={{ fontSize: 13, color: c.textDim, marginBottom: 6 }}>{b.author}</div>
                      {b.total_chapters && (
                        <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 4 }}>
                          Chapter {b.current_chapter || 1} of {b.total_chapters} · {pct}% complete
                        </div>
                      )}
                      <Progress current={b.current_chapter || 1} total={b.total_chapters} />
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        {b.book_id && b.source && (
                          <button onClick={() => openBook(b.book_id, b.source, b.current_chapter || 1)} style={{ ...btnPrimary, padding: '6px 14px', fontSize: 12 }}>
                            {(b.current_chapter || 1) > 1 ? 'Continue Reading' : 'Start Reading'}
                          </button>
                        )}
                        {b.status === 'finished' && <span style={{ fontSize: 12, color: c.green, fontWeight: 600, padding: '6px 0' }}>✓ Finished</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DISCOVER / SEARCH */}
      {tab === 'search' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <input style={inputStyle} placeholder="Search books, authors, topics..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()} />
            <button style={btnPrimary} onClick={doSearch} disabled={searching}>{searching ? '...' : 'Search'}</button>
          </div>

          {/* Open Library results (with covers) */}
          {results.openLibrary?.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontFamily: c.sans }}>Open Library · {results.openLibrary.length} results</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {results.openLibrary.map((b, i) => (
                  <div key={`ol-${i}`} style={{ display: 'flex', gap: 12, padding: 12, background: c.card, borderRadius: 10, border: `1px solid ${c.border}` }}>
                    <BookCover url={b.cover_url} title={b.title} size="md" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: c.text }}>{b.title}</div>
                      <div style={{ fontSize: 13, color: c.textDim, marginBottom: 4 }}>{b.author} {b.year ? `(${b.year})` : ''}</div>
                      {b.subjects?.length > 0 && (
                        <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 8 }}>{b.subjects.slice(0, 4).join(' · ')}</div>
                      )}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => startReadingPlan(b.title, b.author)} disabled={planLoading === b.title} style={{ ...btnPrimary, padding: '6px 14px', fontSize: 12 }}>
                          {planLoading === b.title ? 'Creating Plan...' : '📖 Start Reading Plan'}
                        </button>
                        {b.readable && <button style={btnSecondary} onClick={() => window.open(`https://archive.org/details/${b.ia_id}`, '_blank')}>Read on Archive.org</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audiobooks */}
          {results.audiobooks?.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontFamily: c.sans }}>Audiobooks · {results.audiobooks.length} free</div>
              {results.audiobooks.map((ab, i) => (
                <div key={`au-${i}`} style={{ display: 'flex', gap: 12, padding: 12, background: c.card, borderRadius: 10, border: `1px solid ${c.border}`, marginBottom: 8 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 24, background: c.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>🎧</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{ab.title}</div>
                    <div style={{ fontSize: 12, color: c.textDim }}>{ab.author} {ab.totaltime ? `· ${ab.totaltime}` : ''}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button onClick={() => startReadingPlan(ab.title, ab.author)} disabled={planLoading === ab.title} style={{ ...btnPrimary, padding: '4px 10px', fontSize: 11 }}>
                        {planLoading === ab.title ? 'Creating...' : '📖 Reading Plan'}
                      </button>
                      {ab.url_librivox && <button style={btnSecondary} onClick={() => window.open(ab.url_librivox, '_blank')}>Listen Free</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ebooks */}
          {results.ebooks?.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontFamily: c.sans }}>Free Ebooks · {results.ebooks.length}</div>
              {results.ebooks.map((eb, i) => (
                <div key={`eb-${i}`} style={{ padding: 12, background: c.card, borderRadius: 10, border: `1px solid ${c.border}`, marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{eb.title}</div>
                  <div style={{ fontSize: 12, color: c.textDim, marginBottom: 6 }}>{eb.author}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {eb.has_text && <button onClick={() => openBook(eb.id, 'gutenberg', 1)} style={{ ...btnPrimary, padding: '4px 10px', fontSize: 11 }}>Read Full Text</button>}
                    <button onClick={() => startReadingPlan(eb.title, eb.author)} disabled={planLoading === eb.title} style={btnSecondary}>
                      {planLoading === eb.title ? '...' : 'Reading Plan'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {abaResponse && <div style={{ fontSize: 14, color: c.textDim, lineHeight: 1.6, padding: 14, background: c.accentDim, borderRadius: 8, marginTop: 16, borderLeft: `3px solid ${c.accent}` }}>{abaResponse}</div>}
          {!searching && !results.openLibrary?.length && !results.audiobooks?.length && !results.ebooks?.length && query && (
            <div style={{ textAlign: 'center', padding: 40, color: c.textMuted }}>No results. Try a different search.</div>
          )}
        </div>
      )}

      {/* IMPORT */}
      {tab === 'import' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {['paste', 'epub', 'highlights'].map(m => (
              <button key={m} onClick={() => setImportMode(m)} style={tabStyle(importMode === m)}>
                {m === 'paste' ? 'Paste Text' : m === 'epub' ? 'EPUB Link' : 'Highlights'}
              </button>
            ))}
          </div>

          {importMode === 'paste' && (
            <div>
              <div style={{ fontSize: 13, color: c.textDim, marginBottom: 12, lineHeight: 1.5 }}>Paste chapter text from Kindle Cloud Reader, a PDF, or any source. ABA stores it in your personal library.</div>
              <input style={{ ...inputStyle, marginBottom: 8 }} placeholder="Book title" value={pasteTitle} onChange={e => setPasteTitle(e.target.value)} />
              <input style={{ ...inputStyle, marginBottom: 8 }} placeholder="Author (optional)" value={pasteAuthor} onChange={e => setPasteAuthor(e.target.value)} />
              <textarea style={{ ...inputStyle, minHeight: 180, resize: 'vertical', fontFamily: c.font, lineHeight: 1.7 }} placeholder="Paste chapter text here..." value={pasteText} onChange={e => setPasteText(e.target.value)} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <span style={{ fontSize: 12, color: c.textMuted }}>{pasteText.length > 0 ? `${pasteText.split(/\s+/).length} words` : ''}</span>
                <button style={btnPrimary} onClick={importPastedText} disabled={importing || !pasteText.trim() || !pasteTitle.trim()}>
                  {importing ? 'Saving...' : 'Import to Library'}
                </button>
              </div>
            </div>
          )}

          {importMode === 'epub' && (
            <div>
              <div style={{ fontSize: 13, color: c.textDim, marginBottom: 12, lineHeight: 1.6 }}>
                Go to <span style={{ color: c.accent }}>amazon.com/mycd</span> → Content tab → find book → three dots → "Download and transfer via USB." If EPUB format appears, copy the link and paste below.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={inputStyle} placeholder="Paste EPUB URL..." value={epubUrl} onChange={e => setEpubUrl(e.target.value)} />
                <button style={btnPrimary} onClick={importEpubFromUrl} disabled={importing || !epubUrl.trim()}>{importing ? '...' : 'Import'}</button>
              </div>
            </div>
          )}

          {importMode === 'highlights' && (
            <div>
              <div style={{ fontSize: 13, color: c.textDim, marginBottom: 12, lineHeight: 1.6 }}>
                Go to <span style={{ color: c.accent }}>read.amazon.com/notebook</span> → select a book → copy your highlights → paste below.
              </div>
              <input style={{ ...inputStyle, marginBottom: 8 }} placeholder="Book title" value={highlightsBook} onChange={e => setHighlightsBook(e.target.value)} />
              <textarea style={{ ...inputStyle, minHeight: 140, resize: 'vertical', lineHeight: 1.6 }} placeholder="Paste highlights here..." value={highlightsText} onChange={e => setHighlightsText(e.target.value)} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button style={btnPrimary} onClick={importHighlights} disabled={importing || !highlightsText.trim() || !highlightsBook.trim()}>
                  {importing ? 'Saving...' : 'Save Highlights'}
                </button>
              </div>
            </div>
          )}

          {importResult && <div style={{ padding: 12, background: c.accentDim, borderRadius: 8, marginTop: 12, borderLeft: `3px solid ${c.accent}`, color: c.text, fontSize: 14 }}>{importResult}</div>}
        </div>
      )}

      {/* READER */}
      {tab === 'reader' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <button onClick={() => setTab('library')} style={btnSecondary}>← Back</button>
            <span style={{ fontSize: 13, color: c.textMuted, fontFamily: c.sans }}>
              {chapterMeta.chapterNumber && chapterMeta.totalChapters ? `Chapter ${chapterMeta.chapterNumber} of ${chapterMeta.totalChapters}` : ''}
            </span>
          </div>
          {chapterMeta.title && <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 2 }}>{chapterMeta.title}</div>}
          {chapterMeta.author && <div style={{ fontSize: 14, color: c.textDim, marginBottom: 6 }}>{chapterMeta.author}</div>}
          {chapterMeta.chapterTitle && <div style={{ fontSize: 16, fontWeight: 600, color: c.accent, marginBottom: 16 }}>{chapterMeta.chapterTitle}</div>}
          {chapterMeta.listenUrl && <audio controls src={chapterMeta.listenUrl} style={{ width: '100%', marginBottom: 16 }} />}
          {chapterLoading ? <div style={{ textAlign: 'center', padding: 40, color: c.textMuted }}>Loading chapter...</div> :
            chapterText ? <div style={{ fontSize: 16, lineHeight: 1.8, color: c.text, whiteSpace: 'pre-wrap', padding: 20, background: c.card, borderRadius: 10, maxHeight: '60vh', overflowY: 'auto', fontFamily: c.font }}>{chapterText}</div> :
            abaResponse ? <div style={{ padding: 16, background: c.accentDim, borderRadius: 8, borderLeft: `3px solid ${c.accent}`, lineHeight: 1.6 }}>{abaResponse}</div> : null}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <button style={btnSecondary} disabled={chapterNum <= 1} onClick={() => readerBook && openBook(readerBook.id, readerBook.source, chapterNum - 1)}>← Previous</button>
            <button style={btnPrimary} disabled={chapterMeta.totalChapters && chapterNum >= chapterMeta.totalChapters} onClick={() => readerBook && openBook(readerBook.id, readerBook.source, chapterNum + 1)}>Next Chapter →</button>
          </div>
        </div>
      )}
    </div>
  );
}
