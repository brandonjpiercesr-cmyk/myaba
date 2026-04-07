// ⬡B:MACE.phase0:VIEW:music_extract:20260405⬡
// MusicView — extracted from MyABA.jsx. ARIA (Adaptive Rhythmic Intelligence Agent) music search + mood recs.
// ⬡B:ARIA:MUSIC_VIEW:CIP:20260325⬡

import { useState, useEffect } from "react";
import { ABABASE } from "../utils/api.js";

export default function MusicView({ userId }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mood, setMood] = useState(null);
  const [recs, setRecs] = useState([]);
  const [recsLoading, setRecsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(ABABASE + "/api/aria/recommend?userId=" + encodeURIComponent(userId) + "&mood=chill");
        if (res.ok) { const d = await res.json(); setRecs(d.results || []); }
      } catch (e) { console.error("[MUSIC]", e); }
      setRecsLoading(false);
    })();
  }, [userId]);

  const doSearch = async () => {
    if (!query.trim()) return;
    setLoading(true); setResults([]);
    try {
      const res = await fetch(ABABASE + "/api/aria/search?q=" + encodeURIComponent(query));
      if (res.ok) { const d = await res.json(); setResults(d.results || []); }
    } catch (e) { console.error("[MUSIC]", e); }
    setLoading(false);
  };

  const moods = ["Chill", "Worship", "Hype", "Study", "Throwback"];

  const loadMood = async (m) => {
    setMood(m); setRecsLoading(true);
    try {
      const res = await fetch(ABABASE + "/api/aria/recommend?userId=" + encodeURIComponent(userId) + "&mood=" + encodeURIComponent(m.toLowerCase()));
      if (res.ok) { const d = await res.json(); setRecs(d.results || []); }
    } catch (e) { console.error("[MUSIC]", e); }
    setRecsLoading(false);
  };

  const TrackCard = ({ track }) => (
    <div style={{padding:12,borderRadius:12,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",marginBottom:8,display:"flex",gap:12,alignItems:"center"}}>
      {track.thumbnail && <img src={track.thumbnail} alt="" style={{width:56,height:56,borderRadius:8,objectFit:"cover",flexShrink:0}}/>}
      <div style={{flex:1,minWidth:0}}>
        <p style={{color:"rgba(255,255,255,.85)",fontSize:13,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} dangerouslySetInnerHTML={{__html:track.title}}/>
        <p style={{color:"rgba(255,255,255,.4)",fontSize:11,margin:"4px 0 0"}}>{track.artist}</p>
      </div>
      <a href={track.url} target="_blank" rel="noopener noreferrer"
        style={{width:36,height:36,borderRadius:99,background:"rgba(239,68,68,.15)",color:"rgba(239,68,68,.8)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,textDecoration:"none"}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </a>
    </div>
  );

  return (<div style={{flex:1,overflowY:"auto",padding:"8px 4px"}}>
    <div style={{display:"flex",gap:8,marginBottom:12}}>
      <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")doSearch()}}
        placeholder="Search songs, artists..."
        style={{flex:1,padding:"10px 14px",borderRadius:12,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.04)",color:"rgba(255,255,255,.9)",fontSize:14,outline:"none"}}/>
      <button onClick={doSearch} disabled={loading}
        style={{padding:"10px 16px",borderRadius:12,border:"none",background:"rgba(139,92,246,.25)",color:"#a78bfa",fontSize:13,fontWeight:600,cursor:"pointer"}}>
        {loading?"...":"Search"}
      </button>
    </div>

    {results.length > 0 && <>
      <div style={{fontSize:11,color:"rgba(255,255,255,.3)",marginBottom:8,fontWeight:600,letterSpacing:1}}>RESULTS</div>
      {results.map((t, i) => <TrackCard key={i} track={t}/>)}
    </>}

    <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
      {moods.map(m => (
        <button key={m} onClick={()=>loadMood(m)}
          style={{padding:"6px 14px",borderRadius:20,border:"1px solid " + (mood===m?"rgba(139,92,246,.4)":"rgba(255,255,255,.1)"),
            background:mood===m?"rgba(139,92,246,.15)":"rgba(255,255,255,.03)",
            color:mood===m?"#a78bfa":"rgba(255,255,255,.5)",fontSize:12,cursor:"pointer"}}>{m}</button>
      ))}
    </div>

    <div style={{fontSize:11,color:"rgba(255,255,255,.3)",marginBottom:8,fontWeight:600,letterSpacing:1}}>
      {mood ? mood.toUpperCase() + " VIBES" : "RECOMMENDED FOR YOU"}
    </div>
    {recsLoading ? <p style={{color:"rgba(255,255,255,.3)",textAlign:"center",padding:20}}>Finding music...</p>
    : recs.length === 0 ? <p style={{color:"rgba(255,255,255,.3)",textAlign:"center",padding:20}}>No recommendations yet. Try searching above.</p>
    : recs.map((t, i) => <TrackCard key={i} track={t}/>)}
  </div>);
}
