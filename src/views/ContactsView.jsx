// ⬡B:MACE.phase0:VIEW:contacts_extract:20260405⬡
// ContactsView — extracted from MyABA.jsx. Full contacts with add, search, detail expand.
// ⬡B:911:FIX:contacts_use_backend:20260327⬡

import { useState, useEffect } from "react";
import { X, Plus, Search, Loader2, Mail, Phone } from "lucide-react";
import { ABABASE } from "../utils/api.js";

export default function ContactsView({userId}){
  const[contacts,setContacts]=useState([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  const[selected,setSelected]=useState(null);
  const[adding,setAdding]=useState(false);
  const[newC,setNewC]=useState({contact_name:"",email:"",phone:"",relationship:""});
  const[saving,setSaving]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const hamId=(userId||"unknown").split("@")[0];
        const r=await fetch(`${ABABASE}/api/contacts?ham_id=${hamId}`);
        if(r.ok){const d=await r.json();setContacts(d.contacts||[]);}
      }catch{}
      setLoading(false);
    })();
  },[userId]);

  const filtered=contacts.filter(c=>{if(!search)return true;const s=search.toLowerCase();return(c.contact_name||"").toLowerCase().includes(s)||(c.email||"").toLowerCase().includes(s)||(c.relationship||"").toLowerCase().includes(s);});
  const initials=n=>(n||"?").split(" ").map(w=>w[0]).join("").substring(0,2).toUpperCase();
  const colors=["#8b5cf6","#06b6d4","#f59e0b","#10b981","#ef4444"];
  const colorFor=n=>colors[(n||"").length%colors.length];

  return(<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
    <div style={{padding:"10px 12px",borderBottom:"1px solid rgba(255,255,255,.06)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <span style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,.7)"}}>Contacts ({contacts.length})</span>
      <button onClick={()=>setAdding(!adding)} style={{width:28,height:28,borderRadius:8,border:"none",background:"rgba(139,92,246,.15)",color:"#a78bfa",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{adding?<X size={14}/>:<Plus size={14}/>}</button>
    </div>
    {adding&&<div style={{padding:"8px 10px",borderBottom:"1px solid rgba(255,255,255,.04)",display:"flex",flexDirection:"column",gap:6}}>
      <input value={newC.contact_name} onChange={e=>setNewC({...newC,contact_name:e.target.value})} placeholder="Full name *" style={{padding:"7px 10px",borderRadius:8,border:"1px solid rgba(255,255,255,.08)",background:"rgba(255,255,255,.03)",color:"#fff",fontSize:12,outline:"none"}}/>
      <div style={{display:"flex",gap:4}}>
        <input value={newC.email} onChange={e=>setNewC({...newC,email:e.target.value})} placeholder="Email" style={{flex:1,padding:"7px 10px",borderRadius:8,border:"1px solid rgba(255,255,255,.08)",background:"rgba(255,255,255,.03)",color:"#fff",fontSize:11,outline:"none"}}/>
        <input value={newC.phone} onChange={e=>setNewC({...newC,phone:e.target.value})} placeholder="Phone" style={{flex:1,padding:"7px 10px",borderRadius:8,border:"1px solid rgba(255,255,255,.08)",background:"rgba(255,255,255,.03)",color:"#fff",fontSize:11,outline:"none"}}/>
      </div>
      <div style={{display:"flex",gap:4}}>
        <input value={newC.relationship} onChange={e=>setNewC({...newC,relationship:e.target.value})} placeholder="Relationship" style={{flex:1,padding:"7px 10px",borderRadius:8,border:"1px solid rgba(255,255,255,.08)",background:"rgba(255,255,255,.03)",color:"#fff",fontSize:11,outline:"none"}}/>
        <button onClick={async()=>{if(!newC.contact_name.trim())return;setSaving(true);try{const hamId=(userId||"").split("@")[0];await fetch(`${ABABASE}/api/contacts`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ham_id:hamId,...newC,userId})});setAdding(false);setNewC({contact_name:"",email:"",phone:"",relationship:""});const r2=await fetch(`${ABABASE}/api/contacts?ham_id=${hamId}`);if(r2.ok){const d2=await r2.json();setContacts(d2.contacts||[]);}}catch{}setSaving(false);}} disabled={saving||!newC.contact_name.trim()} style={{padding:"7px 12px",borderRadius:8,border:"none",background:"rgba(139,92,246,.2)",color:"#a78bfa",fontSize:11,cursor:"pointer"}}>{saving?"...":"Save"}</button>
      </div>
    </div>}
    <div style={{padding:"6px 10px"}}><div style={{position:"relative"}}><Search size={12} style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:"rgba(255,255,255,.2)"}}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{width:"100%",padding:"7px 10px 7px 28px",borderRadius:8,border:"1px solid rgba(255,255,255,.06)",background:"rgba(255,255,255,.03)",color:"#fff",fontSize:11,outline:"none"}}/></div></div>
    <div style={{flex:1,overflowY:"auto",padding:"2px 10px"}}>
      {loading?<div style={{textAlign:"center",padding:30}}><Loader2 size={16} style={{color:"#a78bfa",animation:"spin 1s linear infinite"}}/></div>
      :filtered.length===0?<p style={{textAlign:"center",padding:30,color:"rgba(255,255,255,.2)",fontSize:12}}>No contacts</p>
      :filtered.map((c,i)=><div key={c.id||i} onClick={()=>setSelected(selected?.id===c.id?null:c)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 6px",borderRadius:10,cursor:"pointer",background:selected?.id===c.id?"rgba(139,92,246,.06)":"transparent",marginBottom:2}}>
        <div style={{width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:"white",background:colorFor(c.contact_name)+"33",border:`1px solid ${colorFor(c.contact_name)}44`,flexShrink:0}}>{initials(c.contact_name)}</div>
        <div style={{flex:1,minWidth:0}}>
          <p style={{fontSize:13,fontWeight:500,color:"rgba(255,255,255,.85)",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.contact_name}</p>
          <p style={{fontSize:10,color:"rgba(255,255,255,.3)",margin:0}}>{c.relationship||c.email||""}</p>
        </div>
      </div>)}
      {selected&&<div style={{padding:10,borderRadius:10,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.06)",marginTop:4}}>
        {selected.email&&<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><Mail size={11} style={{color:"rgba(255,255,255,.3)"}}/><span style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>{selected.email}</span></div>}
        {selected.phone&&<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><Phone size={11} style={{color:"rgba(255,255,255,.3)"}}/><span style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>{selected.phone}</span></div>}
        {selected.nicknames?.length>0&&<p style={{fontSize:10,color:"rgba(255,255,255,.25)",margin:0}}>AKA: {selected.nicknames.join(", ")}</p>}
      </div>}
    </div>
  </div>);
}
