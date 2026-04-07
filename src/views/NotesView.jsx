// ⬡B:MACE.phase0:VIEW:notes_extract:20260405⬡
// NotesView — extracted from MyABA.jsx. Notes list with save functionality.
// ⬡B:AUDRA.C2:FIX:notes_via_backend:20260403⬡ Routed through backend per 90/10 rule

import { useState, useEffect } from "react";
import { ABABASE } from "../utils/api.js";

export default function NotesView({ userId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [sending, setSending] = useState(false);
  const load = async () => {
    try { const r = await fetch(`${ABABASE}/api/notes?userId=${encodeURIComponent(userId)}`); if (r.ok) { const d = await r.json(); setNotes(d.notes || []); } } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  const save = async () => {
    if (!newNote.trim()) return; setSending(true);
    await fetch(ABABASE + "/api/air/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Save this note: " + newNote, user_id: userId, channel: "cip" }) });
    setNewNote(""); setSending(false); load();
  };
  return (<div style={{flex:1,display:"flex",flexDirection:"column",padding:16}}>
    <div style={{flex:1,overflowY:"auto"}}>{loading ? <p style={{textAlign:"center",padding:40,color:"rgba(255,255,255,.3)"}}>Loading...</p>
    : notes.length === 0 ? <p style={{textAlign:"center",padding:40,color:"rgba(255,255,255,.3)"}}>No notes yet</p>
    : (notes||[]).map((n,i) => <div key={n.id||i} style={{padding:12,marginBottom:8,borderRadius:12,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)"}}>
        <p style={{fontSize:13,color:"rgba(255,255,255,.8)",whiteSpace:"pre-wrap"}}>{(typeof n.content==="string"?n.content:JSON.stringify(n.content)).substring(0,300)}</p>
        <span style={{fontSize:10,color:"rgba(255,255,255,.2)"}}>{n.created_at?new Date(n.created_at).toLocaleDateString():""}</span></div>)}</div>
    <div style={{display:"flex",gap:8,paddingTop:12}}>
      <textarea value={newNote} onChange={e=>setNewNote(e.target.value)} placeholder="Write a note..." rows={2} style={{flex:1,padding:"10px 14px",borderRadius:12,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.04)",color:"#fff",fontSize:13,outline:"none",resize:"none"}} />
      <button onClick={save} disabled={sending||!newNote.trim()} style={{padding:"10px 16px",borderRadius:12,border:"none",background:"rgba(139,92,246,.3)",color:"#a78bfa",cursor:"pointer",alignSelf:"flex-end"}}>{sending?"...":"Save"}</button>
    </div>
  </div>);
}
