// ⬡B:MACE.phase0:VIEW:memos_extract:20260405⬡
// MemosView — extracted from MyABA.jsx lines 4302-4464.

import { useState, useEffect } from "react";
import { Send, Loader2, RefreshCw, Mail } from "lucide-react";
import { ABABASE } from "../utils/api.js";
import { HAM_TEAM } from "../utils/ham.js";

export default function MemosView({userId}){
  const[memos,setMemos]=useState([]);
  const[loading,setLoading]=useState(true);
  const[view,setView]=useState("inbox"); // inbox | sent | thread
  const[threadUser,setThreadUser]=useState(null);
  const[thread,setThread]=useState([]);
  const[composing,setComposing]=useState(false);
  const[composeForm,setComposeForm]=useState({to:"",subject:"",body:"",priority:"normal"});
  const[sending,setSending]=useState(false);
  const[selectedMemo,setSelectedMemo]=useState(null);

  // ⬡B:AUDRA.W1:FIX:memos_dynamic_team:20260403⬡ Dynamic team from HAM_TEAM, no hardcoded emails
  const hamId = (userId||"").split("@")[0];
  const TEAM = HAM_TEAM.map(t => ({id: t.ham_id||t.id, name: t.name||t.ham_id, email: t.email||""})).filter(t => t.id !== hamId && t.id !== userId);

  const loadMemos=async(type)=>{
    setLoading(true);
    try{
      const r=await fetch(`${ABABASE}/api/memos/${type}?userId=${encodeURIComponent(userId)}`);
      const d=await r.json();
      if(d.success)setMemos(d.memos||[]);
    }catch(e){console.error("[MEMOS]",e)}
    setLoading(false);
  };

  const loadThread=async(otherUser)=>{
    setLoading(true);
    try{
      const r=await fetch(`${ABABASE}/api/memos/thread/${encodeURIComponent(otherUser)}?userId=${encodeURIComponent(userId)}`);
      const d=await r.json();
      if(d.success)setThread(d.thread||[]);
      setThreadUser(otherUser);setView("thread");
    }catch(e){console.error("[MEMOS]",e)}
    setLoading(false);
  };

  useEffect(()=>{loadMemos("inbox")},[]);

  const sendMemo=async()=>{
    if(!composeForm.to||!composeForm.body.trim())return;
    setSending(true);
    try{
      const r=await fetch(`${ABABASE}/api/memos/send`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...composeForm,userId})});
      const d=await r.json();
      if(d.success){setComposing(false);setComposeForm({to:"",subject:"",body:"",priority:"normal"});loadMemos(view==="sent"?"sent":"inbox")}
    }catch(e){console.error("[MEMOS] send error:",e)}
    setSending(false);
  };

  const markRead=async(memoId)=>{
    try{
      await fetch(`${ABABASE}/api/memos/${memoId}/read`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId})});
      setMemos(prev=>prev.map(m=>m.id===memoId?{...m,read:true,readAt:new Date().toISOString()}:m));
    }catch(e){console.error("[MEMOS] read error:",e)}
  };

  const react=async(memoId,emoji)=>{
    try{
      const r=await fetch(`${ABABASE}/api/memos/${memoId}/react`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId,reaction:emoji})});
      const d=await r.json();
      if(d.success){
        setMemos(prev=>prev.map(m=>m.id===memoId?{...m,reactions:d.reactions}:m));
        setThread(prev=>prev.map(m=>m.id===memoId?{...m,reactions:d.reactions}:m));
      }
    }catch(e){console.error("[MEMOS] react error:",e)}
  };

  const TEAM_COLORS={brandon:"#8B5CF6",eric:"#3B82F6",bj:"#10B981",cj:"#F59E0B",vante:"#F97316",dwayne:"#EC4899",raquel:"#A78BFA"};
  
  const renderMemo=(m)=>{
    const senderName=m.from===userId?"You":m.fromName||m.from;
    const senderColor=TEAM_COLORS[(m.from||"").toLowerCase()]||"#6B7280";
    const initial=(senderName||"?").charAt(0).toUpperCase();
    const isUnread=m.read===false&&m.to===userId;
    
    return(
    <div key={m.id||m.dbId} onClick={()=>{if(isUnread)markRead(m.id);setSelectedMemo(selectedMemo?.id===m.id?null:m)}} style={{padding:"12px 14px",borderRadius:14,background:isUnread?"rgba(139,92,246,.08)":selectedMemo?.id===m.id?"rgba(139,92,246,.05)":"rgba(255,255,255,.03)",border:`1px solid ${isUnread?"rgba(139,92,246,.2)":selectedMemo?.id===m.id?"rgba(139,92,246,.15)":"rgba(255,255,255,.05)"}`,marginBottom:6,cursor:"pointer",display:"flex",gap:10}}>
      {/* Avatar */}
      <div style={{width:36,height:36,borderRadius:99,background:`${senderColor}30`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <span style={{color:senderColor,fontSize:14,fontWeight:700}}>{initial}</span>
      </div>
      
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{color:isUnread?"rgba(255,255,255,.9)":"rgba(255,255,255,.6)",fontSize:12,fontWeight:isUnread?700:500}}>{senderName}</span>
            {m.priority==="urgent"&&<span style={{fontSize:8,padding:"2px 5px",borderRadius:4,background:"rgba(239,68,68,.2)",color:"#EF4444",fontWeight:700}}>URGENT</span>}
            {isUnread&&<span style={{width:7,height:7,borderRadius:99,background:"#8B5CF6"}}/>}
          </div>
          <span style={{color:"rgba(255,255,255,.2)",fontSize:9,flexShrink:0}}>{m.sentAt?new Date(m.sentAt).toLocaleDateString():""}</span>
        </div>
        {m.subject&&<p style={{color:isUnread?"rgba(255,255,255,.75)":"rgba(255,255,255,.5)",fontSize:12,fontWeight:isUnread?600:400,margin:"0 0 3px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.subject}</p>}
        {m.bodyHtml&&selectedMemo?.id===m.id?<div style={{color:"rgba(255,255,255,.75)",fontSize:12,margin:0,lineHeight:1.6}} dangerouslySetInnerHTML={{__html:m.bodyHtml}}/>:selectedMemo?.id===m.id?<p style={{color:"rgba(255,255,255,.7)",fontSize:12,margin:0,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{m.body}</p>:<p style={{color:"rgba(255,255,255,.4)",fontSize:11,margin:0,lineHeight:1.4,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{m.body?.substring(0,200)}</p>}
        {m.reactions&&m.reactions.length>0&&(
          <div style={{display:"flex",gap:3,marginTop:6}}>{m.reactions.map((r,i)=><span key={i} style={{fontSize:13,background:"rgba(255,255,255,.05)",padding:"1px 4px",borderRadius:6}}>{r.emoji}</span>)}</div>
        )}
        <div style={{display:"flex",gap:4,marginTop:6}}>
          {["👍","❤️","🔥","✅","👀"].map(e=>(
            <button key={e} onClick={(ev)=>{ev.stopPropagation();react(m.id,e)}} style={{padding:"2px 5px",borderRadius:6,border:"1px solid rgba(255,255,255,.04)",background:"transparent",cursor:"pointer",fontSize:11}}>{e}</button>
          ))}
          {m.from!==userId&&<button onClick={(ev)=>{ev.stopPropagation();loadThread(m.from)}} style={{marginLeft:"auto",padding:"3px 10px",borderRadius:6,border:"1px solid rgba(139,92,246,.15)",background:"rgba(139,92,246,.06)",color:"rgba(139,92,246,.8)",cursor:"pointer",fontSize:10,fontWeight:500}}>Reply</button>}
        </div>
      </div>
    </div>
    );
  };

  return(<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
    {/* Inbox/Sent toggle + Compose */}
    <div style={{display:"flex",gap:4,marginBottom:8}}>
      <button onClick={()=>{setView("inbox");loadMemos("inbox")}} style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:view==="inbox"?600:400,background:view==="inbox"?"rgba(139,92,246,.2)":"rgba(255,255,255,.04)",color:view==="inbox"?"rgba(139,92,246,.95)":"rgba(255,255,255,.4)"}}>Inbox</button>
      <button onClick={()=>{setView("sent");loadMemos("sent")}} style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:view==="sent"?600:400,background:view==="sent"?"rgba(139,92,246,.2)":"rgba(255,255,255,.04)",color:view==="sent"?"rgba(139,92,246,.95)":"rgba(255,255,255,.4)"}}>Sent</button>
      <button onClick={()=>setComposing(!composing)} style={{padding:"8px 16px",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,background:"rgba(16,185,129,.2)",color:"#34D399"}}>+ New</button>
    </div>

    {/* Compose form */}
    {composing&&(
    <div style={{padding:12,borderRadius:10,background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.15)",marginBottom:8}}>
      <select value={composeForm.to} onChange={e=>setComposeForm(p=>({...p,to:e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid rgba(255,255,255,.1)",background:"rgba(0,0,0,.3)",color:"rgba(255,255,255,.8)",fontSize:12,marginBottom:6}}>
        <option value="">Send to...</option>
        {TEAM.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <input placeholder="Subject (optional)" value={composeForm.subject} onChange={e=>setComposeForm(p=>({...p,subject:e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid rgba(255,255,255,.1)",background:"rgba(0,0,0,.3)",color:"rgba(255,255,255,.8)",fontSize:12,marginBottom:6,boxSizing:"border-box"}}/>
      <textarea placeholder="Message..." value={composeForm.body} onChange={e=>setComposeForm(p=>({...p,body:e.target.value}))} rows={4} style={{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid rgba(255,255,255,.1)",background:"rgba(0,0,0,.3)",color:"rgba(255,255,255,.8)",fontSize:12,resize:"vertical",boxSizing:"border-box",marginBottom:6}}/>
      <div style={{display:"flex",gap:6}}>
        <select value={composeForm.priority} onChange={e=>setComposeForm(p=>({...p,priority:e.target.value}))} style={{padding:"8px",borderRadius:6,border:"1px solid rgba(255,255,255,.1)",background:"rgba(0,0,0,.3)",color:"rgba(255,255,255,.6)",fontSize:11}}>
          <option value="normal">Normal</option>
          <option value="urgent">Urgent</option>
          <option value="fyi">FYI</option>
        </select>
        <button disabled={sending||!composeForm.to||!composeForm.body.trim()} onClick={sendMemo} style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(16,185,129,.25)",color:"#34D399",fontSize:12,fontWeight:600,opacity:sending?.5:1}}>{sending?"Sending...":"Send Memo"}</button>
        <button onClick={()=>setComposing(false)} style={{padding:"8px 12px",borderRadius:8,border:"1px solid rgba(255,255,255,.1)",background:"transparent",color:"rgba(255,255,255,.4)",cursor:"pointer",fontSize:11}}>Cancel</button>
      </div>
    </div>
    )}

    {/* Thread view */}
    {view==="thread"&&threadUser&&(
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
      <button onClick={()=>{setView("inbox");loadMemos("inbox")}} style={{alignSelf:"flex-start",padding:"4px 10px",borderRadius:6,border:"1px solid rgba(255,255,255,.1)",background:"transparent",color:"rgba(255,255,255,.4)",cursor:"pointer",fontSize:10,marginBottom:4}}>← Back to Inbox</button>
      <p style={{color:"rgba(255,255,255,.6)",fontSize:12,fontWeight:600,margin:"0 0 6px"}}>Thread with {threadUser}</p>
      {thread.map(renderMemo)}
      {thread.length===0&&<p style={{color:"rgba(255,255,255,.3)",textAlign:"center",padding:20,fontSize:12}}>No messages in this thread</p>}
    </div>
    )}

    {/* Memo list */}
    {view!=="thread"&&(
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
      {loading&&<p style={{color:"rgba(255,255,255,.4)",textAlign:"center",padding:20}}>Loading...</p>}
      {!loading&&memos.length===0&&<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,padding:20}}>
        <Mail size={40} style={{color:"rgba(139,92,246,.3)"}}/>
        <p style={{color:"rgba(255,255,255,.4)",fontSize:13}}>{view==="inbox"?"No memos yet":"No sent memos"}</p>
      </div>}
      {!loading&&memos.map(renderMemo)}
    </div>
    )}
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════
// REFERENCES VIEW - Manage professional references
// ⬡B:MYABA.V2:references:20260313⬡ New component for /api/awa/references
// ═══════════════════════════════════════════════════════════════════════════
