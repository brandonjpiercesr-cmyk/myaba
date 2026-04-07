// ⬡B:MACE.phase0:VIEW:calendar_extract:20260405⬡
// CalendarView — extracted from MyABA.jsx. Calendar with event groups and create.
// ⬡B:AUDRA.W13:FIX:calendar_view_v2:20260403⬡ Full calendar with create, refresh, time groups

import { useState, useEffect } from "react";
import { RefreshCw, Calendar } from "lucide-react";
import { ABABASE } from "../utils/api.js";

export default function CalendarView({ userId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newEvent, setNewEvent] = useState("");
  const [creating, setCreating] = useState(false);
  const load = async () => {
    setLoading(true);
    try { const r = await fetch(ABABASE + "/api/calendar/upcoming?userId=" + encodeURIComponent(userId)); if (r.ok) { const d = await r.json(); setEvents(d.events||d||[]); } } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, [userId]);
  const createEvent = async () => {
    if (!newEvent.trim()) return; setCreating(true);
    await fetch(ABABASE + "/api/air/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Schedule: " + newEvent, user_id: userId, channel: "cip", appScope: "calendar" }) });
    setNewEvent(""); setCreating(false); setTimeout(load, 2000);
  };
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
  const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate()+7);
  const grouped = { today: [], tomorrow: [], week: [], later: [] };
  (Array.isArray(events)?events:[]).forEach(e => {
    const d = new Date(e.start||e.when?.start_time||"");
    if (d < tomorrow) grouped.today.push(e);
    else if (d < new Date(tomorrow.getTime()+86400000)) grouped.tomorrow.push(e);
    else if (d < nextWeek) grouped.week.push(e);
    else grouped.later.push(e);
  });
  const renderGroup = (label, items) => items.length === 0 ? null : (
    <div style={{marginBottom:14}}>
      <p style={{fontSize:10,fontWeight:700,color:"rgba(139,92,246,.5)",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{label}</p>
      {items.map((e,i) => <div key={e.id||i} style={{padding:"10px 12px",marginBottom:4,borderRadius:10,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",display:"flex",gap:10,alignItems:"flex-start"}}>
        <div style={{width:36,textAlign:"center",flexShrink:0}}>
          <p style={{fontSize:18,fontWeight:700,color:"rgba(139,92,246,.8)",margin:0}}>{new Date(e.start||e.when?.start_time||"").getDate()}</p>
          <p style={{fontSize:9,color:"rgba(255,255,255,.3)",margin:0}}>{new Date(e.start||e.when?.start_time||"").toLocaleDateString("en",{weekday:"short"})}</p>
        </div>
        <div style={{flex:1}}>
          <p style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,.85)",margin:0}}>{e.title||e.subject||"Untitled"}</p>
          {(e.start||e.when)&&<p style={{fontSize:11,color:"rgba(139,92,246,.5)",margin:"3px 0 0"}}>{new Date(e.start||e.when?.start_time||"").toLocaleTimeString("en",{hour:"numeric",minute:"2-digit"})}</p>}
          {e.location&&<p style={{fontSize:10,color:"rgba(255,255,255,.25)",margin:"2px 0 0"}}>{e.location}</p>}
        </div>
      </div>)}
    </div>
  );
  return (<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
      <span style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,.7)"}}>Calendar ({events.length})</span>
      <button onClick={load} style={{padding:"6px 10px",borderRadius:8,border:"none",background:"rgba(255,255,255,.04)",color:"rgba(255,255,255,.4)",cursor:"pointer",fontSize:11}}><RefreshCw size={12}/></button>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:"8px 12px"}}>
      {loading ? <p style={{textAlign:"center",padding:40,color:"rgba(255,255,255,.3)"}}>Loading...</p>
      : events.length === 0 ? <div style={{textAlign:"center",padding:40}}><Calendar size={32} style={{color:"rgba(139,92,246,.2)",margin:"0 auto 8px"}}/><p style={{color:"rgba(255,255,255,.3)",fontSize:13}}>No upcoming events</p></div>
      : <>{renderGroup("Today",grouped.today)}{renderGroup("Tomorrow",grouped.tomorrow)}{renderGroup("This Week",grouped.week)}{renderGroup("Later",grouped.later)}</>}
    </div>
    <div style={{padding:"8px 12px",borderTop:"1px solid rgba(255,255,255,.06)",display:"flex",gap:8}}>
      <input value={newEvent} onChange={e=>setNewEvent(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createEvent()} placeholder="Meeting with Eric tomorrow 3pm..." style={{flex:1,padding:"9px 12px",borderRadius:10,border:"1px solid rgba(255,255,255,.08)",background:"rgba(255,255,255,.03)",color:"#fff",fontSize:12,outline:"none"}} />
      <button onClick={createEvent} disabled={creating||!newEvent.trim()} style={{padding:"9px 14px",borderRadius:10,border:"none",background:"rgba(139,92,246,.2)",color:"#a78bfa",cursor:"pointer",fontSize:12}}>{creating?"...":"Add"}</button>
    </div>
  </div>);
}
