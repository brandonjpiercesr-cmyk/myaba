// ⬡B:BIRTH.PAGE:VIEW:reading_view_cip:20260412⬡
// ReadingView for CIP (MyABA mobile) — imports from page-core.js
import { useState, useEffect, useCallback } from 'react';

const API_BASE = 'https://abacia-services.onrender.com';

// Inline core functions (CIP doesn't have module resolution for separate core files)
const READING_STATUS = {
  reading: { label: 'Reading', color: '#4CAF50', bg: '#E8F5E9' },
  want_to_read: { label: 'Want to Read', color: '#2196F3', bg: '#E3F2FD' },
  finished: { label: 'Finished', color: '#9E9E9E', bg: '#F5F5F5' }
};

function formatDuration(d) {
  if (!d) return '';
  const p = d.split(':');
  if (p.length === 3) { const h = parseInt(p[0]), m = parseInt(p[1]); return h > 0 ? `${h}h ${m}m` : `${m}m`; }
  return d;
}

export default function ReadingView({ userId }) {
  const [tab, setTab] = useState('search'); // search | list | reader
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState({ audiobooks: [], ebooks: [] });
  const [readingList, setReadingList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [readerBook, setReaderBook] = useState(null);
  const [chapterText, setChapterText] = useState('');
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterNum, setChapterNum] = useState(1);
  const [chapterMeta, setChapterMeta] = useState({});
  const [abaResponse, setAbaResponse] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [importMode, setImportMode] = useState('paste'); // paste | epub | highlights
  const [pasteText, setPasteText] = useState('');
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteAuthor, setPasteAuthor] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');

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

  // Search books
  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResults({ audiobooks: [], ebooks: [] });
    const data = await callAIR(`find me books about ${query}`);
    const searchTools = (data.toolsExecuted || []).filter(t => t.tool_name === 'page_search');
    let allAudio = [], allEbooks = [];
    for (const t of searchTools) {
      if (t.result?.audiobooks) allAudio.push(...t.result.audiobooks);
      if (t.result?.ebooks) allEbooks.push(...t.result.ebooks);
    }
    // Dedup by id
    const seenAudio = new Set(); allAudio = allAudio.filter(a => { if (seenAudio.has(a.id)) return false; seenAudio.add(a.id); return true; });
    const seenEbook = new Set(); allEbooks = allEbooks.filter(e => { if (seenEbook.has(e.id)) return false; seenEbook.add(e.id); return true; });
    setResults({ audiobooks: allAudio, ebooks: allEbooks });
    setAbaResponse(data.response || '');
    setSearching(false);
  };

  // Load reading list
  const loadList = async () => {
    setListLoading(true);
    const data = await callAIR('show my reading list');
    const listTool = (data.toolsExecuted || []).find(t => t.tool_name === 'page_reading_list');
    if (listTool?.result) {
      const all = listTool.result.all || [];
      setReadingList(all);
    }
    setListLoading(false);
  };

  // Open reader
  const openBook = async (bookId, source, chapter = 1) => {
    setTab('reader');
    setChapterLoading(true);
    setChapterNum(chapter);
    const data = await callAIR(`use page_get_chapter with book_id ${bookId} source ${source} chapter ${chapter}`);
    const chTool = (data.toolsExecuted || []).find(t => t.tool_name === 'page_get_chapter');
    if (chTool?.result) {
      setChapterText(chTool.result.text || '');
      setChapterMeta({
        title: chTool.result.title,
        author: chTool.result.author,
        chapterTitle: chTool.result.chapter_title,
        chapterNumber: chTool.result.chapter_number,
        totalChapters: chTool.result.total_chapters,
        toc: chTool.result.table_of_contents || [],
        listenUrl: chTool.result.listen_url
      });
      setReaderBook({ id: bookId, source });
    }
    setAbaResponse(data.response || '');
    setChapterLoading(false);
  };

  // Add to list
  const addBook = async (book) => {
    await callAIR(`add "${book.title}" by ${book.author || 'unknown'} to my reading list. Source: ${book.source}, id: ${book.id}`);
    loadList();
  };


  // Import pasted text as a book
  const importPastedText = async () => {
    if (!pasteText.trim() || !pasteTitle.trim()) return;
    setImporting(true);
    setImportResult('');
    const bookId = pasteTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40).toLowerCase();
    // Split into chapters by common markers or just store as one chapter
    const chapters = pasteText.split(/\n\s*(?:CHAPTER|Chapter)\s+[IVXLCDM\d]+/gi).filter(c => c.trim().length > 100);
    const chapterCount = Math.max(chapters.length, 1);
    
    // Store via AIR
    const data = await callAIR(
      `Save this book to my reading list and brain. Title: "${pasteTitle}", Author: "${pasteAuthor || 'Unknown'}". ` +
      `Store it with book_id "${bookId}" and source "brain". It has ${chapterCount} chapter(s). ` +
      `Here is the text for chapter 1:\n\n${pasteText.substring(0, 7000)}`
    );
    setImportResult(data.response || 'Saved to your library.');
    setPasteText('');
    setPasteTitle('');
    setPasteAuthor('');
    setImporting(false);
  };

  // Import EPUB file
  const handleEpubUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult('');
    
    // For now, upload EPUB via URL isn't possible from file input
    // We need to read the file and send it to ABA for processing
    // Since page_upload_epub expects a URL, we'll use a workaround:
    // Read as text if possible, or prompt user for URL
    if (file.name.endsWith('.epub')) {
      setImportResult('EPUB files need to be uploaded via URL. Go to amazon.com/mycd, right-click the EPUB download link, copy the URL, and paste it below.');
      setImportMode('epub_url');
    } else if (file.name.endsWith('.txt') || file.name.endsWith('.html') || file.name.endsWith('.htm')) {
      const text = await file.text();
      setPasteText(text);
      setPasteTitle(file.name.replace(/\.[^.]+$/, ''));
      setImportMode('paste');
      setImportResult('Text loaded. Enter a title and tap Import.');
    }
    setImporting(false);
  };

  // Import EPUB from URL
  const [epubUrl, setEpubUrl] = useState('');
  const importEpubFromUrl = async () => {
    if (!epubUrl.trim()) return;
    setImporting(true);
    setImportResult('');
    const data = await callAIR(`download and import this epub to my reading library: ${epubUrl}`);
    setImportResult(data.response || 'Processing...');
    setEpubUrl('');
    setImporting(false);
  };

  // Import highlights
  const [highlightsText, setHighlightsText] = useState('');
  const [highlightsBook, setHighlightsBook] = useState('');
  const importHighlights = async () => {
    if (!highlightsText.trim() || !highlightsBook.trim()) return;
    setImporting(true);
    const data = await callAIR(
      `Save these Kindle highlights from "${highlightsBook}" to my brain. These are passages I highlighted while reading:\n\n${highlightsText.substring(0, 8000)}`
    );
    setImportResult(data.response || 'Highlights saved.');
    setHighlightsText('');
    setHighlightsBook('');
    setImporting(false);
  };

    useEffect(() => { if (tab === 'list') loadList(); }, [tab]);

  const sty = {
    container: { padding: '12px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', maxWidth: '100%' },
    tabs: { display: 'flex', gap: '8px', marginBottom: '16px' },
    tab: (active) => ({ padding: '8px 16px', borderRadius: '20px', border: 'none', background: active ? '#1a1a2e' : '#f0f0f0', color: active ? '#fff' : '#333', fontWeight: active ? '600' : '400', cursor: 'pointer', fontSize: '14px' }),
    searchBox: { display: 'flex', gap: '8px', marginBottom: '16px' },
    input: { flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '15px', outline: 'none' },
    btn: { padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#1a1a2e', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '14px' },
    card: { background: '#fff', borderRadius: '10px', padding: '14px', marginBottom: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #eee' },
    title: { fontSize: '15px', fontWeight: '600', color: '#1a1a2e', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: '#666', marginBottom: '6px' },
    badge: (bg, color) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '10px', background: bg, color, fontSize: '11px', fontWeight: '600' }),
    section: { fontSize: '13px', fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', marginTop: '16px' },
    chapterText: { fontSize: '15px', lineHeight: '1.7', color: '#333', whiteSpace: 'pre-wrap', padding: '16px', background: '#fafafa', borderRadius: '8px', maxHeight: '60vh', overflowY: 'auto' },
    abaResp: { fontSize: '14px', color: '#555', lineHeight: '1.5', padding: '12px', background: '#f8f8ff', borderRadius: '8px', marginTop: '12px', borderLeft: '3px solid #1a1a2e' },
    smallBtn: { padding: '4px 10px', borderRadius: '6px', border: '1px solid #ddd', background: '#fff', color: '#333', fontSize: '12px', cursor: 'pointer' },
    listenBtn: { padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#4CAF50', color: '#fff', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }
  };

  return (
    <div style={sty.container}>
      <div style={sty.tabs}>
        <button style={sty.tab(tab === 'search')} onClick={() => setTab('search')}>Search</button>
        <button style={sty.tab(tab === 'list')} onClick={() => setTab('list')}>My Books</button>
        <button style={sty.tab(tab === 'import')} onClick={() => setTab('import')}>Import</button>
        {readerBook && <button style={sty.tab(tab === 'reader')} onClick={() => setTab('reader')}>Reader</button>}
      </div>

      {tab === 'search' && (
        <div>
          <div style={sty.searchBox}>
            <input style={sty.input} placeholder="Search books, authors, topics..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()} />
            <button style={sty.btn} onClick={doSearch} disabled={searching}>{searching ? '...' : 'Search'}</button>
          </div>

          {results.audiobooks.length > 0 && (
            <div>
              <div style={sty.section}>Audiobooks ({results.audiobooks.length})</div>
              {results.audiobooks.map((ab, i) => (
                <div key={`audio-${i}`} style={sty.card}>
                  <div style={sty.title}>{ab.title}</div>
                  <div style={sty.subtitle}>{ab.author} {ab.totaltime ? `· ${formatDuration(ab.totaltime)}` : ''} {ab.num_sections ? `· ${ab.num_sections} sections` : ''}</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={sty.badge('#E8F5E9', '#2E7D32')}>Free Audiobook</span>
                    {ab.url_librivox && <button style={sty.listenBtn} onClick={() => window.open(ab.url_librivox, '_blank')}>Listen on LibriVox</button>}
                    <button style={sty.smallBtn} onClick={() => openBook(ab.id, 'librivox', 1)}>Chapters</button>
                    <button style={sty.smallBtn} onClick={() => addBook({ title: ab.title, author: ab.author, id: ab.id, source: 'librivox' })}>+ List</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.ebooks.length > 0 && (
            <div>
              <div style={sty.section}>Ebooks ({results.ebooks.length})</div>
              {results.ebooks.map((eb, i) => (
                <div key={`ebook-${i}`} style={sty.card}>
                  <div style={sty.title}>{eb.title}</div>
                  <div style={sty.subtitle}>{eb.author} {eb.download_count ? `· ${eb.download_count.toLocaleString()} downloads` : ''}</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {eb.has_text && <span style={sty.badge('#E3F2FD', '#1565C0')}>Full Text</span>}
                    {eb.has_audio && <span style={sty.badge('#E8F5E9', '#2E7D32')}>+ Audio</span>}
                    {eb.has_text && <button style={sty.smallBtn} onClick={() => openBook(eb.id, 'gutenberg', 1)}>Read</button>}
                    {eb.epub_url && <button style={sty.smallBtn} onClick={() => window.open(eb.epub_url, '_blank')}>EPUB</button>}
                    <button style={sty.smallBtn} onClick={() => addBook({ title: eb.title, author: eb.author, id: eb.id, source: 'gutenberg' })}>+ List</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {abaResponse && <div style={sty.abaResp}>{abaResponse}</div>}
          {!searching && results.audiobooks.length === 0 && results.ebooks.length === 0 && query && <div style={{ color: '#999', textAlign: 'center', padding: '20px' }}>No results yet. Try searching for a title or author.</div>}
        </div>
      )}

      {tab === 'list' && (
        <div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {['all', 'reading', 'want_to_read', 'finished'].map(s => (
              <button key={s} style={sty.tab(statusFilter === s)} onClick={() => setStatusFilter(s)}>
                {s === 'all' ? 'All' : READING_STATUS[s]?.label || s}
              </button>
            ))}
          </div>
          {listLoading ? <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>Loading...</div> : (
            readingList.length === 0 ? <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Your reading list is empty. Search for books to get started.</div> :
            readingList.filter(b => statusFilter === 'all' || b.status === statusFilter).map((b, i) => {
              const st = READING_STATUS[b.status] || READING_STATUS.reading;
              return (
                <div key={i} style={sty.card}>
                  <div style={sty.title}>{b.book_title}</div>
                  <div style={sty.subtitle}>{b.author || ''} {b.current_chapter && b.total_chapters ? `· Ch. ${b.current_chapter}/${b.total_chapters}` : ''}</div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={sty.badge(st.bg, st.color)}>{st.label}</span>
                    {b.book_id && b.source && <button style={sty.smallBtn} onClick={() => openBook(b.book_id, b.source, b.current_chapter || 1)}>Continue</button>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}


      {tab === 'import' && (
        <div>
          <div style={{display:'flex',gap:'6px',marginBottom:'16px',flexWrap:'wrap'}}>
            <button style={sty.tab(importMode==='paste')} onClick={()=>setImportMode('paste')}>Paste Text</button>
            <button style={sty.tab(importMode==='epub_url')} onClick={()=>setImportMode('epub_url')}>EPUB Link</button>
            <button style={sty.tab(importMode==='highlights')} onClick={()=>setImportMode('highlights')}>Highlights</button>
          </div>

          {importMode === 'paste' && (
            <div>
              <div style={{fontSize:'13px',color:'#888',marginBottom:'12px',lineHeight:'1.5'}}>
                Copy text from Kindle Cloud Reader (read.amazon.com), a PDF, or any source. Paste it here and ABA will store it in your personal library.
              </div>
              <input style={sty.input} placeholder="Book title (required)" value={pasteTitle} onChange={e=>setPasteTitle(e.target.value)} />
              <input style={{...sty.input,marginTop:'8px'}} placeholder="Author (optional)" value={pasteAuthor} onChange={e=>setPasteAuthor(e.target.value)} />
              <textarea style={{...sty.input,marginTop:'8px',minHeight:'200px',resize:'vertical',fontFamily:'Georgia, serif',lineHeight:'1.6'}} placeholder="Paste chapter text here..." value={pasteText} onChange={e=>setPasteText(e.target.value)} />
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'10px'}}>
                <span style={{fontSize:'12px',color:'#999'}}>{pasteText.length > 0 ? `${pasteText.split(/\s+/).length} words` : ''}</span>
                <button style={sty.btn} onClick={importPastedText} disabled={importing || !pasteText.trim() || !pasteTitle.trim()}>
                  {importing ? 'Saving...' : 'Import to Library'}
                </button>
              </div>
            </div>
          )}

          {importMode === 'epub_url' && (
            <div>
              <div style={{fontSize:'13px',color:'#888',marginBottom:'12px',lineHeight:'1.5'}}>
                <strong>Step 1:</strong> Go to <span style={{color:'#1a1a2e',fontWeight:'600'}}>amazon.com/mycd</span> on your computer<br/>
                <strong>Step 2:</strong> Click Content tab, find your book<br/>
                <strong>Step 3:</strong> Click three dots (...) → "Download and transfer via USB"<br/>
                <strong>Step 4:</strong> If EPUB format appears, the book is DRM-free<br/>
                <strong>Step 5:</strong> Right-click the download link → Copy Link Address<br/>
                <strong>Step 6:</strong> Paste the link below
              </div>
              <div style={{display:'flex',gap:'8px'}}>
                <input style={sty.input} placeholder="Paste EPUB download URL here..." value={epubUrl} onChange={e=>setEpubUrl(e.target.value)} />
                <button style={sty.btn} onClick={importEpubFromUrl} disabled={importing || !epubUrl.trim()}>
                  {importing ? '...' : 'Import'}
                </button>
              </div>
              <div style={{fontSize:'12px',color:'#999',marginTop:'8px'}}>
                Works with Gutenberg EPUBs too — search a book, copy the EPUB link, paste here.
              </div>
            </div>
          )}

          {importMode === 'highlights' && (
            <div>
              <div style={{fontSize:'13px',color:'#888',marginBottom:'12px',lineHeight:'1.5'}}>
                <strong>Step 1:</strong> Go to <span style={{color:'#1a1a2e',fontWeight:'600'}}>read.amazon.com/notebook</span><br/>
                <strong>Step 2:</strong> Click a book on the left sidebar<br/>
                <strong>Step 3:</strong> Select all highlights (Ctrl+A) and copy (Ctrl+C)<br/>
                <strong>Step 4:</strong> Paste below — ABA saves them to your brain
              </div>
              <input style={sty.input} placeholder="Book title (required)" value={highlightsBook} onChange={e=>setHighlightsBook(e.target.value)} />
              <textarea style={{...sty.input,marginTop:'8px',minHeight:'150px',resize:'vertical',lineHeight:'1.6'}} placeholder="Paste your highlights and notes here..." value={highlightsText} onChange={e=>setHighlightsText(e.target.value)} />
              <div style={{display:'flex',justifyContent:'flex-end',marginTop:'10px'}}>
                <button style={sty.btn} onClick={importHighlights} disabled={importing || !highlightsText.trim() || !highlightsBook.trim()}>
                  {importing ? 'Saving...' : 'Save Highlights'}
                </button>
              </div>
            </div>
          )}

          {importResult && <div style={sty.abaResp}>{importResult}</div>}
        </div>
      )}

            {tab === 'reader' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <button style={sty.smallBtn} onClick={() => setTab('search')}>Back</button>
            <div style={{ fontSize: '13px', color: '#888' }}>
              {chapterMeta.chapterNumber && chapterMeta.totalChapters ? `Chapter ${chapterMeta.chapterNumber} of ${chapterMeta.totalChapters}` : ''}
            </div>
          </div>
          {chapterMeta.title && <div style={sty.title}>{chapterMeta.title}</div>}
          {chapterMeta.author && <div style={sty.subtitle}>{chapterMeta.author}</div>}
          {chapterMeta.chapterTitle && <div style={{ ...sty.subtitle, fontWeight: '600', marginBottom: '12px' }}>{chapterMeta.chapterTitle}</div>}

          {chapterMeta.listenUrl && (
            <div style={{ marginBottom: '12px' }}>
              <audio controls src={chapterMeta.listenUrl} style={{ width: '100%' }} />
            </div>
          )}

          {chapterLoading ? <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Loading chapter...</div> :
            chapterText ? <div style={sty.chapterText}>{chapterText}</div> :
            abaResponse ? <div style={sty.abaResp}>{abaResponse}</div> : null
          }

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
            <button style={sty.smallBtn} disabled={chapterNum <= 1} onClick={() => readerBook && openBook(readerBook.id, readerBook.source, chapterNum - 1)}>Previous</button>
            <button style={sty.btn} disabled={chapterMeta.totalChapters && chapterNum >= chapterMeta.totalChapters} onClick={() => readerBook && openBook(readerBook.id, readerBook.source, chapterNum + 1)}>Next Chapter</button>
          </div>
        </div>
      )}
    </div>
  );
}
