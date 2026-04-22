// ⬡B:MACE.phase3:VIEW:ccwa_cip_migrated:20260406⬡
// CCWAView — extracted from MyABA.jsx. Come Code With ABA (CCWA) dual-engine coding assistant.
// Supports Production (Sonnet), Dev (Haiku/INCUABA), and Compare modes.

import { useState, useRef, useEffect } from "react";
import { Code, Loader2, Send } from "lucide-react";
import { ABABASE } from "../utils/api.js";
import {
  ENGINE_MODES, getChannel, sendToEngine, compareEngines,
} from "../utils/ccwa-engine.js"; // ⬡B:MACE.rename:FIX:ccwa_engine_collision_kill:20260422⬡

const api = async (path, opts = {}) => {
  const res = await fetch(ABABASE + path, {
    method: opts.method || "GET",
    headers: opts.body ? { "Content-Type": "application/json" } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return res.json();
};

export default function CCWAView({ userId }) {
  const [query, setQuery] = useState("");
  // ⬡B:ccwa:FIX:scroll_to_bottom:20260416⬡
  // CCWAView messages were not scrollable — flex:1 child needs minHeight:0 to clip
  // and a ref to auto-scroll to bottom on new messages.
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, response]);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [devMode, setDevMode] = useState("prod"); // prod | dev | compare
  const ask = async () => {
    if (!query.trim()) return; setLoading(true);
    setHistory(prev => [...prev, { role: "user", text: query }]); const msg = query; setQuery("");
    if (devMode === "compare") {
      const channels = ["ccwa", "incuaba"];
      const results = await Promise.allSettled(channels.map(ch =>
        fetch(ABABASE + "/api/air/process", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg, user_id: userId, userId, channel: ch, appScope: "ccwa" }) }).then(r => r.json())
      ));
      const prodResp = results[0]?.value?.response || "Production error";
      const devResp = results[1]?.value?.response || "Dev error";
      const prodTools = (results[0]?.value?.toolsExecuted || []).map(t => typeof t === "object" ? t.tool_name : t).filter(Boolean);
      const devTools = (results[1]?.value?.toolsExecuted || []).map(t => typeof t === "object" ? t.tool_name : t).filter(Boolean);
      setHistory(prev => [...prev, { role: "compare", prod: prodResp, dev: devResp, prodTools, devTools }]);
      setLoading(false); return;
    }
    try {
      const res = await fetch(ABABASE + "/api/air/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg, user_id: userId, userId, channel: devMode === "dev" ? "incuaba" : "ccwa", appScope: "ccwa" }) });
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let acc = "";
      while (true) { const { done, value } = await reader.read(); if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split("\n").filter(l => l.startsWith("data: "))) {
          try { const d = JSON.parse(line.slice(6)); if (d.type === "chunk") { acc += d.text; setResponse(acc); } else if (d.type === "done") { acc = d.fullResponse || acc; setResponse(acc); } } catch {} } }
      setHistory(prev => { const c = [...prev]; if (c.length > 0 && c[c.length-1].role === "assistant") c[c.length-1] = { ...c[c.length-1], text: acc }; else c.push({ role: "assistant", text: acc }); return c; }); setResponse(null);
    } catch { setHistory(prev => [...prev, { role: "assistant", text: "Could not reach ABA." }]); }
    setLoading(false);
  };
  return (<div style={{flex:1,display:"flex",flexDirection:"column"}}>
    <div ref={scrollRef} style={{flex:1,overflowY:"auto",padding:16,minHeight:0}}>
      <div style={{display:"flex",gap:4,padding:"0 0 8px",borderBottom:"1px solid rgba(255,255,255,.04)",marginBottom:8}}>
        {ENGINE_MODES.map(m=>
          <button key={m.id} onClick={()=>setDevMode(m.id)} style={{flex:1,padding:"6px 0",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:devMode===m.id?700:400,background:devMode===m.id?m.color+"20":"transparent",color:devMode===m.id?m.color:"rgba(255,255,255,.3)"}}>{m.label}</button>)}
      </div>
      {devMode==="dev"&&<div style={{padding:"4px 8px",borderRadius:6,background:"rgba(34,211,238,.08)",border:"1px solid rgba(34,211,238,.15)",marginBottom:8,fontSize:10,color:"rgba(34,211,238,.7)"}}>INCUABA: Running on Haiku. 10-20x cheaper. Same agents, cheaper model.</div>}
      {history.length === 0 && !response && <div style={{textAlign:"center",padding:"40px 20px"}}>
        <Code size={40} style={{margin:"0 auto 12px",opacity:.3,color:devMode==="dev"?"#22d3ee":"#f59e0b"}} />
        <p style={{fontSize:15,color:"rgba(255,255,255,.6)",marginBottom:8}}>Code with ABA</p>
        <p style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>Build, debug, audit, or deploy code across the ABA ecosystem</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginTop:16}}>
          {["Audit last deploy","Check Render status","Agent roster","Show recent errors"].map(s => <button key={s} onClick={()=>setQuery(s)} style={{padding:"8px 14px",borderRadius:20,border:"1px solid rgba(245,158,11,.2)",background:"rgba(245,158,11,.08)",color:"rgba(245,158,11,.7)",fontSize:11,cursor:"pointer"}}>{s}</button>)}
        </div></div>}
      {history.map((m,i) => <div key={i} style={{marginBottom:12}}>
        {m.role==="compare" ? <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div style={{padding:"10px 12px",borderRadius:12,background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.15)"}}>
            <p style={{fontSize:10,color:"#f59e0b",marginBottom:4,fontWeight:600}}>PRODUCTION (Sonnet)</p>
            <p style={{fontSize:12,color:"rgba(255,255,255,.8)",lineHeight:1.5,whiteSpace:"pre-wrap",margin:0}}>{m.prod}</p>
            {m.prodTools?.length>0&&<div style={{display:"flex",gap:3,flexWrap:"wrap",marginTop:4}}>{m.prodTools.map((t,j)=><span key={j} style={{fontSize:8,padding:"1px 5px",borderRadius:3,background:"rgba(245,158,11,.1)",color:"#f59e0b"}}>{t}</span>)}</div>}
          </div>
          <div style={{padding:"10px 12px",borderRadius:12,background:"rgba(34,211,238,.08)",border:"1px solid rgba(34,211,238,.15)"}}>
            <p style={{fontSize:10,color:"#22d3ee",marginBottom:4,fontWeight:600}}>DEV (Haiku)</p>
            <p style={{fontSize:12,color:"rgba(255,255,255,.8)",lineHeight:1.5,whiteSpace:"pre-wrap",margin:0}}>{m.dev}</p>
            {m.devTools?.length>0&&<div style={{display:"flex",gap:3,flexWrap:"wrap",marginTop:4}}>{m.devTools.map((t,j)=><span key={j} style={{fontSize:8,padding:"1px 5px",borderRadius:3,background:"rgba(34,211,238,.1)",color:"#22d3ee"}}>{t}</span>)}</div>}
          </div>
        </div>
        : <><div style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}><div style={{maxWidth:"85%",padding:"10px 14px",borderRadius:16,background:m.role==="user"?"rgba(245,158,11,.15)":"rgba(255,255,255,.05)",border:"1px solid "+(m.role==="user"?"rgba(245,158,11,.2)":"rgba(255,255,255,.08)")}}><p style={{fontSize:13,color:"rgba(255,255,255,.85)",lineHeight:1.5,whiteSpace:"pre-wrap",margin:0}}>{m.text}</p></div></div>
        {m.tools && m.tools.length > 0 && <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4,justifyContent:"flex-start"}}>{m.tools.map((t,j)=><span key={j} style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:"rgba(139,92,246,.1)",color:"#a78bfa"}}>{t}</span>)}</div>}</>}
      </div>)}
      {response && <div style={{marginBottom:12}}><div style={{maxWidth:"85%",padding:"10px 14px",borderRadius:16,background:"rgba(255,255,255,.05)",border:"1px solid rgba(245,158,11,.15)"}}><p style={{fontSize:13,color:"rgba(255,255,255,.85)",lineHeight:1.5,whiteSpace:"pre-wrap"}}>{response}</p></div></div>}
    </div>
    <div style={{display:"flex",gap:8,padding:"10px 16px 16px"}}>
      <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&ask()} placeholder="Code with ABA..." style={{flex:1,padding:"12px 14px",borderRadius:14,border:"1px solid rgba(245,158,11,.15)",background:"rgba(255,255,255,.04)",color:"#fff",fontSize:13,outline:"none"}} />
      <button onClick={ask} disabled={loading||!query.trim()} style={{padding:"12px 18px",borderRadius:14,border:"none",background:loading?"rgba(245,158,11,.1)":"rgba(245,158,11,.2)",color:"#f59e0b",cursor:"pointer"}}>{loading?<Loader2 size={16} className="animate-spin"/>:<Send size={16}/>}</button>
    </div>
  </div>);
}
