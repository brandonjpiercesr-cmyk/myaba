// ⬡B:MACE.phase0:VIEW:nura_extract:20260405⬡
// NURAView — extracted from MyABA.jsx. Nutrition assistant with barcode scanning.

import { useState } from "react";
import { Camera } from "lucide-react";
import { ABABASE } from "../utils/api.js";

export default function NURAView({ userId, onScan }) {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const ask = async (text) => {
    const msg = text || query; if (!msg.trim()) return; setLoading(true);
    setHistory(prev => [...prev, { role: "user", text: msg }]); setQuery("");
    try {
      const res = await fetch(ABABASE + "/api/air/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg, user_id: userId, userId, channel: "cip", appScope: "nura" }) });
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let acc = "";
      while (true) { const { done, value } = await reader.read(); if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split("\n").filter(l => l.startsWith("data: "))) {
          try { const d = JSON.parse(line.slice(6)); if (d.type === "chunk") { acc += d.text; setResponse(acc); } else if (d.type === "done") { acc = d.fullResponse || acc; const toolNames = (d.toolsExecuted || []).map(t => typeof t === "object" ? t.tool_name : t).filter(Boolean); setHistory(prev => { const c = [...prev]; if (c.length > 0 && c[c.length-1].role === "assistant") c[c.length-1] = { ...c[c.length-1], tools: toolNames }; return c; }); setResponse(acc); } } catch {} } }
      setHistory(prev => { const c = [...prev]; if (c.length > 0 && c[c.length-1].role === "assistant") c[c.length-1] = { ...c[c.length-1], text: acc }; else c.push({ role: "assistant", text: acc }); return c; }); setResponse(null);
    } catch { setHistory(prev => [...prev, { role: "assistant", text: "Could not reach ABA." }]); }
    setLoading(false);
  };
  return (<div style={{flex:1,display:"flex",flexDirection:"column"}}>
    <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,.06)",display:"flex",gap:8,flexWrap:"wrap"}}>
      <button onClick={onScan} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 16px",borderRadius:14,border:"1px solid rgba(6,182,212,.2)",background:"rgba(6,182,212,.1)",color:"#06b6d4",fontSize:12,cursor:"pointer"}}><Camera size={16}/> Scan Barcode</button>
      {["Is this healthy?","Low sugar alternatives","Meal plan for today"].map(s => <button key={s} onClick={()=>ask(s)} style={{padding:"8px 12px",borderRadius:12,border:"1px solid rgba(6,182,212,.12)",background:"rgba(6,182,212,.05)",color:"rgba(6,182,212,.6)",fontSize:11,cursor:"pointer"}}>{s}</button>)}
    </div>
    <div style={{flex:1,overflowY:"auto",padding:16}}>
      {history.length === 0 && !response && <div style={{textAlign:"center",padding:"30px 20px"}}><p style={{fontSize:14,color:"rgba(255,255,255,.5)"}}>Scan a barcode or ask about any food</p><p style={{fontSize:11,color:"rgba(255,255,255,.25)",marginTop:6}}>NURA uses Open Food Facts and USDA databases</p></div>}
      {history.map((msg,i) => <div key={i} style={{marginBottom:12,display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start"}}>
        <div style={{maxWidth:"85%",padding:"10px 14px",borderRadius:16,background:msg.role==="user"?"rgba(6,182,212,.15)":"rgba(255,255,255,.05)",border:"1px solid "+(msg.role==="user"?"rgba(6,182,212,.2)":"rgba(255,255,255,.08)")}}>
          <p style={{fontSize:13,color:"rgba(255,255,255,.85)",lineHeight:1.5,whiteSpace:"pre-wrap"}}>{msg.text}</p></div></div>)}
      {response && <div style={{marginBottom:12}}><div style={{maxWidth:"85%",padding:"10px 14px",borderRadius:16,background:"rgba(255,255,255,.05)",border:"1px solid rgba(6,182,212,.1)"}}>
        <p style={{fontSize:13,color:"rgba(255,255,255,.85)",lineHeight:1.5,whiteSpace:"pre-wrap"}}>{response}</p></div></div>}
    </div>
    <div style={{display:"flex",gap:8,padding:"10px 16px 16px"}}>
      <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&ask()} placeholder="Ask about food, nutrition..." style={{flex:1,padding:"12px 14px",borderRadius:14,border:"1px solid rgba(6,182,212,.15)",background:"rgba(255,255,255,.04)",color:"#fff",fontSize:13,outline:"none"}} />
      <button onClick={()=>ask()} disabled={loading||!query.trim()} style={{padding:"12px 18px",borderRadius:14,border:"none",background:loading?"rgba(6,182,212,.1)":"rgba(6,182,212,.2)",color:"#06b6d4",cursor:"pointer"}}>{loading?"...":"Ask"}</button>
    </div>
  </div>);
}
