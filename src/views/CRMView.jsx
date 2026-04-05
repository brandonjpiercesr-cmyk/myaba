// ⬡B:MACE.phase0:VIEW:crm_extract:20260405⬡
// CRMView — extracted from MyABA.jsx. Contacts list with search.
// ⬡B:911:FIX:crm_use_backend:20260327⬡
// ⬡B:rolo.audit:FIX:contact_name_field:20260330⬡

import { useState, useEffect } from "react";
import { ABABASE } from "../utils/api.js";

export default function CRMView({ userId }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  useEffect(() => {
    (async () => { try { const hamId=(userId||"").split("@")[0]; const r = await fetch(`${ABABASE}/api/contacts?ham_id=${hamId}`); if (r.ok) { const d=await r.json(); setContacts(d.contacts||[]); } } catch {} setLoading(false); })();
  }, [userId]);
  const f = contacts.filter(c => !search || (c.contact_name||"").toLowerCase().includes(search.toLowerCase()) || (c.email||"").toLowerCase().includes(search.toLowerCase()));
  return (<div style={{flex:1,display:"flex",flexDirection:"column",padding:16}}>
    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search contacts..." style={{padding:"10px 14px",borderRadius:12,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.04)",color:"#fff",fontSize:13,outline:"none",marginBottom:12}} />
    <div style={{flex:1,overflowY:"auto"}}>{loading ? <p style={{textAlign:"center",padding:40,color:"rgba(255,255,255,.3)"}}>Loading...</p>
    : f.length === 0 ? <p style={{textAlign:"center",padding:40,color:"rgba(255,255,255,.3)"}}>No contacts</p>
    : f.map((c,i) => <div key={c.id||i} style={{padding:12,marginBottom:6,borderRadius:12,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:36,height:36,borderRadius:"50%",background:"rgba(139,92,246,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:600,color:"#a78bfa"}}>{(c.contact_name||"?")[0].toUpperCase()}</div>
        <div><p style={{fontSize:13,fontWeight:500,color:"rgba(255,255,255,.85)"}}>{c.contact_name}</p>
          {c.email&&<p style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>{c.email}</p>}
          {c.phone&&<p style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>{c.phone}</p>}</div>
      </div>)}</div>
  </div>);
}
