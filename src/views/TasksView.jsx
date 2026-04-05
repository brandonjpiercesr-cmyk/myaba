// ⬡B:MACE.phase0:VIEW:tasks_extract:20260405⬡
// TasksView — extracted from MyABA.jsx. Task list with add functionality.
// ⬡B:AUDRA.C2:FIX:tasks_via_backend:20260403⬡ Routed through backend per 90/10 rule

import { useState, useEffect } from "react";
import { ABABASE } from "../utils/api.js";

export default function TasksView({ userId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState("");
  const [sending, setSending] = useState(false);
  const load = async () => {
    try { const r = await fetch(`${ABABASE}/api/tasks?userId=${encodeURIComponent(userId)}`); if (r.ok) { const d = await r.json(); setTasks(d.tasks || []); } } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!newTask.trim()) return; setSending(true);
    await fetch(ABABASE + "/api/air/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Create task: " + newTask, user_id: userId, channel: "cip" }) });
    setNewTask(""); setSending(false); load();
  };
  return (<div style={{flex:1,display:"flex",flexDirection:"column",padding:16}}>
    <div style={{flex:1,overflowY:"auto"}}>{loading ? <p style={{textAlign:"center",padding:40,color:"rgba(255,255,255,.3)"}}>Loading...</p>
    : tasks.length === 0 ? <p style={{textAlign:"center",padding:40,color:"rgba(255,255,255,.3)"}}>No tasks yet</p>
    : (tasks||[]).map((t,i) => <div key={t.id||i} style={{padding:12,marginBottom:8,borderRadius:12,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)"}}>
        <p style={{fontSize:13,color:"rgba(255,255,255,.8)"}}>{(typeof t.content==="string"?t.content:JSON.stringify(t.content)).substring(0,200)}</p>
        <span style={{fontSize:10,color:"rgba(255,255,255,.2)"}}>{t.created_at?new Date(t.created_at).toLocaleDateString():""}</span></div>)}</div>
    <div style={{display:"flex",gap:8,paddingTop:12}}>
      <input value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Add a task..." style={{flex:1,padding:"10px 14px",borderRadius:12,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.04)",color:"#fff",fontSize:13,outline:"none"}} />
      <button onClick={add} disabled={sending||!newTask.trim()} style={{padding:"10px 16px",borderRadius:12,border:"none",background:"rgba(139,92,246,.3)",color:"#a78bfa",cursor:"pointer"}}>{sending?"...":"+"}</button>
    </div>
  </div>);
}
