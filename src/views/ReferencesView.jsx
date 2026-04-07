// ⬡B:MACE.phase0:VIEW:references_extract:20260405⬡
// ReferencesView — extracted from MyABA.jsx lines 4465-4610.

import { useState, useEffect } from "react";
import { Plus, X, Trash2, Loader2 } from "lucide-react";
import { ABABASE } from "../utils/api.js";

export default function ReferencesView({userId}){
  const[refs,setRefs]=useState([]);
  const[loading,setLoading]=useState(true);
  const[editing,setEditing]=useState(null);
  const[showForm,setShowForm]=useState(false);
  const[form,setForm]=useState({name:"",title:"",organization:"",email:"",phone:"",relationship:"",notes:""});
  const[saving,setSaving]=useState(false);
  
  // Load references
  useEffect(()=>{
    loadRefs();
  },[userId]);
  
  const loadRefs=async()=>{
    try{
      const res=await fetch(`${ABABASE}/api/awa/references?userId=${encodeURIComponent(userId)}`);
      if(res.ok){
        const data=await res.json();
        setRefs(data.references||[]);
      }
    }catch(e){console.error("[REFS] Load failed:",e)}
    setLoading(false);
  };
  
  const saveRef=async()=>{
    setSaving(true);
    try{
      const method=editing?"PUT":"POST";
      const url=editing?`${ABABASE}/api/awa/references/${editing}`:
        `${ABABASE}/api/awa/references`;
      const res=await fetch(url,{
        method,
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...form,userId})
      });
      if(res.ok){
        await loadRefs();
        setShowForm(false);
        setEditing(null);
        setForm({name:"",title:"",organization:"",email:"",phone:"",relationship:"",notes:""});
      }
    }catch(e){console.error("[REFS] Save failed:",e)}
    setSaving(false);
  };
  
  const deleteRef=async(id)=>{
    if(!confirm("Delete this reference?"))return;
    try{
      await fetch(`${ABABASE}/api/awa/references/${id}`,{
        method:"DELETE",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({userId})
      });
      await loadRefs();
    }catch(e){console.error("[REFS] Delete failed:",e)}
  };
  
  const startEdit=(ref)=>{
    setForm({name:ref.name||"",title:ref.title||"",organization:ref.organization||"",email:ref.email||"",phone:ref.phone||"",relationship:ref.relationship||"",notes:ref.notes||""});
    setEditing(ref.id);
    setShowForm(true);
  };
  
  if(loading){
    return(<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{width:50,height:50,borderRadius:"50%",border:"3px solid rgba(139,92,246,.2)",borderTopColor:"rgba(139,92,246,.8)",animation:"spin 1s linear infinite"}}/>
      <p style={{color:"rgba(255,255,255,.5)",fontSize:13}}>Loading references...</p>
    </div>);
  }
  
  if(showForm){
    const Field=({label,field,placeholder,type="text"})=>(
      <div style={{marginBottom:12}}>
        <label style={{color:"rgba(255,255,255,.5)",fontSize:11,fontWeight:600,display:"block",marginBottom:4}}>{label}</label>
        <input type={type} value={form[field]} onChange={e=>setForm({...form,[field]:e.target.value})} placeholder={placeholder}
          style={{width:"100%",padding:"10px 12px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,color:"white",fontSize:13,outline:"none"}}/>
      </div>
    );
    return(<div style={{flex:1,overflowY:"auto",padding:"8px 4px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <h3 style={{color:"rgba(255,255,255,.9)",fontSize:16,fontWeight:600,margin:0}}>{editing?"Edit Reference":"Add Reference"}</h3>
        <button onClick={()=>{setShowForm(false);setEditing(null);setForm({name:"",title:"",organization:"",email:"",phone:"",relationship:"",notes:""})}} style={{background:"rgba(255,255,255,.1)",border:"none",color:"white",width:32,height:32,borderRadius:99,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={16}/></button>
      </div>
      <Field label="Full Name" field="name" placeholder="John Smith"/>
      <Field label="Title" field="title" placeholder="Director of Development"/>
      <Field label="Organization" field="organization" placeholder="Nonprofit Organization"/>
      <Field label="Email" field="email" placeholder="john@example.org" type="email"/>
      <Field label="Phone" field="phone" placeholder="555-123-4567" type="tel"/>
      <Field label="Relationship" field="relationship" placeholder="Former supervisor"/>
      <div style={{marginBottom:12}}>
        <label style={{color:"rgba(255,255,255,.5)",fontSize:11,fontWeight:600,display:"block",marginBottom:4}}>Notes</label>
        <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Additional context..."
          style={{width:"100%",padding:"10px 12px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,color:"white",fontSize:13,outline:"none",minHeight:80,resize:"vertical"}}/>
      </div>
      <button onClick={saveRef} disabled={saving||!form.name} style={{width:"100%",padding:"14px",borderRadius:12,border:"none",cursor:saving||!form.name?"not-allowed":"pointer",background:saving||!form.name?"rgba(139,92,246,.2)":"rgba(139,92,246,.4)",color:"white",fontSize:14,fontWeight:600,opacity:saving||!form.name?.5:1}}>
        {saving?"Saving...":editing?"Update Reference":"Add Reference"}
      </button>
    </div>);
  }
  
  return(<div style={{flex:1,overflowY:"auto",padding:"8px 4px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <h3 style={{color:"rgba(255,255,255,.9)",fontSize:16,fontWeight:600,margin:0}}>References</h3>
      <button onClick={()=>setShowForm(true)} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:10,border:"none",cursor:"pointer",background:"rgba(139,92,246,.25)",color:"rgba(139,92,246,.95)",fontSize:12,fontWeight:600}}>
        <Plus size={14}/>Add
      </button>
    </div>
    
    {refs.length===0?(
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:40}}>
        <Users size={48} style={{color:"rgba(139,92,246,.4)"}}/>
        <p style={{color:"rgba(255,255,255,.5)",fontSize:14,textAlign:"center"}}>No references yet</p>
        <p style={{color:"rgba(255,255,255,.3)",fontSize:12,textAlign:"center"}}>Add professional references for your job applications</p>
      </div>
    ):(
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {refs.map((ref,i)=>(
          <div key={ref.id||i} style={{padding:"14px 16px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <p style={{color:"rgba(255,255,255,.9)",fontSize:14,fontWeight:600,margin:0}}>{ref.name}</p>
                <p style={{color:"rgba(139,92,246,.7)",fontSize:12,margin:"2px 0 0"}}>{ref.title}</p>
                <p style={{color:"rgba(255,255,255,.5)",fontSize:11,margin:"2px 0 0"}}>{ref.organization}</p>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>startEdit(ref)} style={{background:"rgba(255,255,255,.1)",border:"none",color:"rgba(255,255,255,.6)",width:28,height:28,borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Edit2 size={12}/></button>
                <button onClick={()=>deleteRef(ref.id)} style={{background:"rgba(239,68,68,.1)",border:"none",color:"rgba(239,68,68,.6)",width:28,height:28,borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Trash2 size={12}/></button>
              </div>
            </div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              {ref.email&&<a href={`mailto:${ref.email}`} style={{color:"rgba(99,102,241,.7)",fontSize:11,textDecoration:"none"}}>{ref.email}</a>}
              {ref.phone&&<span style={{color:"rgba(255,255,255,.4)",fontSize:11}}>{ref.phone}</span>}
            </div>
            {ref.relationship&&<p style={{color:"rgba(255,255,255,.4)",fontSize:11,marginTop:6,fontStyle:"italic"}}>{ref.relationship}</p>}
          </div>
        ))}
      </div>
    )}
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════
// ⬡B:AUDRA:FIX7:MOCK_INTERVIEW_VARA:20260402⬡
// MOCK INTERVIEW VARA — Voice-based mock interview using ElevenLabs
// Uses same VARA agent as TalkToABA but preloads with job-specific context
// ═══════════════════════════════════════════════════════════════════════════
