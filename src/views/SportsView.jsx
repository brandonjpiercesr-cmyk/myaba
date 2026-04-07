// ⬡B:MACE.phase4:VIEW:sports_migrated:20260406⬡
// SportsView — extracted from MyABA.jsx. NASH (Nimble Athletic Scoreboard Hub) scores + search.

import { useState, useEffect } from "react";
import { ABABASE } from "../utils/api.js";
import { fetchScores, searchTeam, useSports } from "../utils/sports-core.js";

const api = async (path, opts = {}) => {
  const res = await fetch(ABABASE + path, {
    method: opts.method || "GET",
    headers: opts.body ? { "Content-Type": "application/json" } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return res.json();
};

export default function SportsView({ userId }) {
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const result = await fetchScores(api, userId);
        setScores(result);
      } catch (e) { console.error("[SPORTS]", e); }
      setLoading(false);
    })();
  }, [userId]);

  const doSearch = async () => {
    if (!search.trim()) return;
    setSearching(true); setSearchResult(null);
    try {
      const result = await searchTeam(api, search, userId);
      if (result) setSearchResult(result);
    } catch (e) { console.error("[SPORTS]", e); }
    setSearching(false);
  };

  return (<div style={{flex:1,overflowY:"auto",padding:"8px 4px"}}>
    <div style={{display:"flex",gap:8,marginBottom:12}}>
      <input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")doSearch()}}
        placeholder="Search team (Lakers, Duke, Saints...)"
        style={{flex:1,padding:"10px 14px",borderRadius:12,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.04)",color:"rgba(255,255,255,.9)",fontSize:14,outline:"none"}}/>
      <button onClick={doSearch} disabled={searching}
        style={{padding:"10px 16px",borderRadius:12,border:"none",background:"rgba(139,92,246,.25)",color:"#a78bfa",fontSize:13,fontWeight:600,cursor:"pointer"}}>
        {searching?"...":"Go"}
      </button>
    </div>

    {searchResult && <div style={{padding:16,borderRadius:14,background:"rgba(139,92,246,.08)",border:"1px solid rgba(139,92,246,.15)",marginBottom:12}}>
      <p style={{color:"rgba(255,255,255,.9)",fontSize:14,lineHeight:1.6,margin:0}}>{searchResult.spoken || searchResult.type}</p>
      {searchResult.type==="result" && <div style={{marginTop:8,display:"flex",gap:12,justifyContent:"center"}}>
        <span style={{fontSize:24,fontWeight:700,color:"rgba(34,197,94,.9)"}}>{searchResult.winScore}</span>
        <span style={{fontSize:14,color:"rgba(255,255,255,.3)",alignSelf:"center"}}>vs</span>
        <span style={{fontSize:24,fontWeight:700,color:"rgba(239,68,68,.7)"}}>{searchResult.loseScore}</span>
      </div>}
    </div>}

    <div style={{fontSize:11,color:"rgba(255,255,255,.3)",marginBottom:8,fontWeight:600,letterSpacing:1}}>YOUR TEAMS</div>
    {loading ? <p style={{color:"rgba(255,255,255,.3)",textAlign:"center",padding:20}}>Loading scores...</p>
    : scores.length === 0 ? <p style={{color:"rgba(255,255,255,.3)",textAlign:"center",padding:20}}>No recent scores for your followed teams. Add teams in your profile.</p>
    : scores.map((s, i) => (
      <div key={i} style={{padding:14,borderRadius:12,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",marginBottom:8}}>
        <p style={{color:"rgba(255,255,255,.85)",fontSize:14,margin:0,lineHeight:1.5}}>{s.spoken || JSON.stringify(s)}</p>
        {s.date && <p style={{color:"rgba(255,255,255,.25)",fontSize:11,margin:"6px 0 0"}}>{s.date}</p>}
      </div>
    ))}
  </div>);
}
