// ⬡B:MACE.phase0:VIEW:email_extract:20260405⬡
// EmailView + EmailDetail — extracted from MyABA.jsx.

import { useState, useEffect } from "react";
import { RefreshCw, Mail, ChevronRight } from "lucide-react";
import { ABABASE } from "../utils/api.js";
import ABALogo from "../components/shared/ABALogo.jsx";

function EmailDetail({email,onBack,userId}){
  const[askOpen,setAskOpen]=useState(false);
  const[askInput,setAskInput]=useState("");
  const[askResult,setAskResult]=useState("");
  const[askLoading,setAskLoading]=useState(false);

  useEffect(()=>{
    if(!email?.id||!email.unread)return;
    const timer=setTimeout(async()=>{
      try{ await fetch(`${ABABASE}/api/email/${email.id}/read?userId=${encodeURIComponent(userId)}`,{method:"PATCH"}); }catch{}
    },3000);
    return()=>clearTimeout(timer);
  },[email?.id]);

  const askABA=async()=>{
    if(!askInput.trim())return;
    setAskLoading(true);
    const q=askInput; setAskInput("");
    try{
      const r=await fetch(`${ABABASE}/api/air/process`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({message:`About this email from ${email.from?.[0]?.name||"someone"} with subject "${email.subject||""}": ${q}\n\nEmail content: ${(email.snippet||email.body||"").substring(0,500)}`,user_id:userId,channel:"myaba"})
      });
      if(r.ok){const d=await r.json();setAskResult(d.response||d.message||"");}
    }catch{setAskResult("Could not reach ABA right now")}
    setAskLoading(false);
  };

  return(<div style={{flex:1,overflowY:"auto",padding:8}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
      <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:8,border:"1px solid rgba(255,255,255,.1)",background:"transparent",color:"rgba(255,255,255,.5)",cursor:"pointer",fontSize:11}}><ChevronRight size={12} style={{transform:"rotate(180deg)"}}/>Back</button>
      <button onClick={()=>setAskOpen(!askOpen)} style={{display:"flex",alignItems:"center",gap:4,padding:"6px 12px",borderRadius:8,border:"1px solid rgba(139,92,246,.2)",background:askOpen?"rgba(139,92,246,.15)":"rgba(139,92,246,.06)",color:"rgba(139,92,246,.8)",cursor:"pointer",fontSize:11,fontWeight:500}}>
        <ABALogo size={14}/>Ask ABA
      </button>
    </div>
    <div style={{padding:14,borderRadius:14,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.06)"}}>
      <p style={{color:"rgba(255,255,255,.9)",fontSize:14,fontWeight:600,margin:"0 0 4px"}}>{email.subject||"(no subject)"}</p>
      <p style={{color:"rgba(255,255,255,.5)",fontSize:11,margin:"0 0 2px"}}>From: {email.from?.[0]?.name||email.from?.[0]?.email||"Unknown"}</p>
      <p style={{color:"rgba(255,255,255,.3)",fontSize:10,margin:"0 0 12px"}}>{email.date?new Date(email.date*1000).toLocaleString():""}</p>
      <div style={{color:"rgba(255,255,255,.7)",fontSize:12,lineHeight:1.6}} dangerouslySetInnerHTML={{__html:email.body||email.snippet||"No content"}}/>
    </div>
    {askOpen&&<div style={{marginTop:8,padding:12,borderRadius:12,background:"rgba(139,92,246,.06)",border:"1px solid rgba(139,92,246,.12)"}}>
      <div style={{display:"flex",gap:6,marginBottom:askResult?8:0}}>
        <input value={askInput} onChange={e=>setAskInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&askABA()} placeholder="Ask ABA about this email..." style={{flex:1,padding:"8px 12px",borderRadius:8,border:"1px solid rgba(139,92,246,.15)",background:"rgba(255,255,255,.03)",color:"#fff",fontSize:12,outline:"none"}}/>
        <button onClick={askABA} disabled={askLoading||!askInput.trim()} style={{padding:"8px 14px",borderRadius:8,border:"none",background:"rgba(139,92,246,.2)",color:"#a78bfa",cursor:"pointer",fontSize:12}}>{askLoading?"...":"Ask"}</button>
      </div>
      {askResult&&<div style={{padding:10,borderRadius:8,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)"}}><p style={{color:"rgba(255,255,255,.7)",fontSize:12,margin:0,lineHeight:1.5}}>{askResult}</p></div>}
    </div>}
  </div>);
}

export default function EmailView({userId}){
  const[emails,setEmails]=useState([]);
  const[loading,setLoading]=useState(true);
  const[selectedEmail,setSelectedEmail]=useState(null);
  const[folder,setFolder]=useState("inbox");

  const loadEmails=async(f)=>{
    setLoading(true);setSelectedEmail(null);
    try{
      const r=await fetch(`${ABABASE}/api/email/${f}?userId=${encodeURIComponent(userId)}&limit=20`);
      if(r.ok){const d=await r.json();setEmails(d.emails||d.messages||d.data||[])}
      else setEmails([]);
    }catch(e){console.error("[EMAIL]",e);setEmails([])}
    setLoading(false);
  };

  useEffect(()=>{loadEmails(folder)},[folder]);

  if(loading)return <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:40,height:40,borderRadius:"50%",border:"3px solid rgba(139,92,246,.2)",borderTopColor:"rgba(139,92,246,.8)",animation:"spin 1s linear infinite"}}/></div>;

  return(<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
    <div style={{display:"flex",gap:4,padding:"4px 0",flexShrink:0}}>
      {["inbox","sent"].map(f=>(
        <button key={f} onClick={()=>{setFolder(f);loadEmails(f)}} style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:folder===f?600:400,background:folder===f?"rgba(139,92,246,.2)":"rgba(255,255,255,.04)",color:folder===f?"rgba(139,92,246,.95)":"rgba(255,255,255,.4)",textTransform:"capitalize"}}>{f}</button>
      ))}
      <button onClick={()=>loadEmails(folder)} style={{padding:"8px 12px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(255,255,255,.04)",color:"rgba(255,255,255,.4)",fontSize:12}}><RefreshCw size={14}/></button>
    </div>

    {selectedEmail&&<EmailDetail email={selectedEmail} onBack={()=>setSelectedEmail(null)} userId={userId}/>}

    {!selectedEmail&&<div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:2,padding:"4px 0"}}>
      {emails.length===0&&<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,padding:20}}>
        <Mail size={36} style={{color:"rgba(139,92,246,.3)"}}/>
        <p style={{color:"rgba(255,255,255,.4)",fontSize:13,textAlign:"center"}}>{folder==="inbox"?"No emails found. Connect your email in Settings.":"No sent emails."}</p>
      </div>}
      {emails.map((em,i)=>{
        const from=em.from?.[0]?.name||em.from?.[0]?.email||"Unknown";
        const unread=em.unread!==false;
        return(
        <div key={em.id||i} onClick={()=>setSelectedEmail(em)} style={{padding:"12px 10px",borderRadius:10,background:unread?"rgba(139,92,246,.06)":"rgba(255,255,255,.02)",border:`1px solid ${unread?"rgba(139,92,246,.12)":"rgba(255,255,255,.04)"}`,cursor:"pointer",display:"flex",gap:10,alignItems:"flex-start"}}>
          <div style={{width:32,height:32,borderRadius:99,background:"linear-gradient(135deg,rgba(139,92,246,.3),rgba(99,102,241,.2))",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{color:"white",fontSize:13,fontWeight:600}}>{from.charAt(0).toUpperCase()}</span>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
              <span style={{color:unread?"rgba(255,255,255,.9)":"rgba(255,255,255,.6)",fontSize:12,fontWeight:unread?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"60%"}}>{from}</span>
              <span style={{color:"rgba(255,255,255,.25)",fontSize:9,flexShrink:0}}>{em.date?new Date(em.date*1000).toLocaleDateString():""}</span>
            </div>
            <p style={{color:unread?"rgba(255,255,255,.7)":"rgba(255,255,255,.45)",fontSize:11,fontWeight:unread?500:400,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{em.subject||"(no subject)"}</p>
            <p style={{color:"rgba(255,255,255,.3)",fontSize:10,margin:"2px 0 0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{em.snippet||""}</p>
          </div>
          {unread&&<div style={{width:8,height:8,borderRadius:99,background:"#8B5CF6",flexShrink:0,marginTop:4}}/>}
        </div>
        );
      })}
    </div>}
  </div>);
}
