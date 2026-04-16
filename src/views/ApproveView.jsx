// ⬡B:MACE.phase0:VIEW:approve_extract:20260405⬡
// ApproveView — extracted from MyABA.jsx lines 4101-4301.
// ⬡B:MYABA.V2:approvals:20260313⬡ Updated to use /api/myaba/approvals

import { useState, useEffect, useRef } from "react";
import { Check, X, ChevronRight, AlertTriangle, Mail, Briefcase, Users, FileText, Loader2, Calendar, CheckCircle } from "lucide-react";
import { ABABASE } from "../utils/api.js";

export default function ApproveView({userId,onAction}){
  const[items,setItems]=useState([]);
  const[loading,setLoading]=useState(true);
  const[currentIndex,setCurrentIndex]=useState(0);
  const[swipeDir,setSwipeDir]=useState(null);
  const[touchStart,setTouchStart]=useState(null);
  const[touchDelta,setTouchDelta]=useState(0);
  const[velocityData,setVelocityData]=useState(null);
  const[velocityLoading,setVelocityLoading]=useState(false);
  const[showVelocity,setShowVelocity]=useState(false);
  const[categoryFilter,setCategoryFilter]=useState(null); // ⬡B:AUDRA.W12:FIX:category_filter_state:20260403⬡
  
  // Fetch pending approvals from v2 endpoint
  useEffect(()=>{
    (async()=>{
      try{
        const response=await fetch(`${ABABASE}/api/pending-approvals?userId=${encodeURIComponent(userId)}`);
        if(response.ok){
          const data=await response.json();
          setItems(data.items||[]);
        }
      }catch(e){console.error("[APPROVE] Fetch failed:",e)}
      setLoading(false);
    })();
  },[userId]);
  
  // ⬡B:AUDRA.W12:FIX:filtered_items:20260403⬡
  const filteredItems = categoryFilter ? items.filter(it=>(it.type||"other")===categoryFilter) : items;
  const currentItem=filteredItems[currentIndex];
  
  const handleSwipe=(direction)=>{
    if(!currentItem)return;
    setSwipeDir(direction);
    
    // Execute action via v2 endpoint — field must be 'action' not 'decision'
    const action=direction==="right"?"approve":"reject";
    fetch(`${ABABASE}/api/approve-action`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({item_id:currentItem.id,action,userId})
    }).catch(e=>console.error('[APPROVE] Action failed:',e));
    
    // Animate out then advance
    setTimeout(()=>{
      setSwipeDir(null);
      setTouchDelta(0);
      if(currentIndex<filteredItems.length-1){
        setCurrentIndex(currentIndex+1);
      }else{
        setItems([]);
      }
    },300);
  };
  
  const handleTouchStart=(e)=>setTouchStart(e.touches[0].clientX);
  const handleTouchMove=(e)=>{
    if(touchStart===null)return;
    setTouchDelta(e.touches[0].clientX-touchStart);
  };
  const handleTouchEnd=()=>{
    if(Math.abs(touchDelta)>100){
      handleSwipe(touchDelta>0?"right":"left");
    }else{
      setTouchDelta(0);
    }
    setTouchStart(null);
  };
  
  if(loading){
    return(<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{width:50,height:50,borderRadius:"50%",border:"3px solid rgba(139,92,246,.2)",borderTopColor:"rgba(139,92,246,.8)",animation:"spin 1s linear infinite"}}/>
      <p style={{color:"rgba(255,255,255,.5)",fontSize:13}}>Loading pending items...</p>
    </div>);
  }
  
  if(filteredItems.length===0||currentIndex>=filteredItems.length){
    return(<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:20}}>
      <CheckCircle size={56} style={{color:"rgba(16,185,129,.6)"}}/>
      <p style={{color:"rgba(255,255,255,.7)",fontSize:16,fontWeight:600}}>All caught up!</p>
      <p style={{color:"rgba(255,255,255,.4)",fontSize:13,textAlign:"center"}}>No pending decisions right now</p>
      <button disabled={velocityLoading} onClick={async()=>{
        setVelocityLoading(true);
        try{
          const r=await fetch(`${ABABASE}/api/awa/decisions/analysis?userId=${encodeURIComponent(userId)}`);
          const d=await r.json();if(d.success)setVelocityData(d);
        }catch(e){console.error("[VELOCITY]",e)}
        setVelocityLoading(false);setShowVelocity(true);
      }} style={{padding:"10px 20px",borderRadius:10,border:"1px solid rgba(139,92,246,.2)",background:"rgba(139,92,246,.08)",color:"rgba(139,92,246,.8)",cursor:"pointer",fontSize:12,fontWeight:500}}>
        {velocityLoading?"Analyzing...":"View Decision Patterns"}
      </button>
      {showVelocity&&velocityData&&(
      <div style={{width:"100%",maxWidth:360,padding:14,borderRadius:12,background:"rgba(139,92,246,.06)",border:"1px solid rgba(139,92,246,.1)"}}>
        <p style={{color:"rgba(139,92,246,.8)",fontSize:12,fontWeight:600,margin:"0 0 8px"}}>Decision Velocity</p>
        <div style={{display:"flex",gap:12,marginBottom:8}}>
          <div style={{flex:1,textAlign:"center"}}><p style={{color:"rgba(255,255,255,.8)",fontSize:20,fontWeight:700,margin:0}}>{velocityData.decisions}</p><p style={{color:"rgba(255,255,255,.3)",fontSize:9,margin:0}}>decisions</p></div>
          <div style={{flex:1,textAlign:"center"}}><p style={{color:"rgba(255,255,255,.8)",fontSize:20,fontWeight:700,margin:0}}>{velocityData.avgResponseMins}m</p><p style={{color:"rgba(255,255,255,.3)",fontSize:9,margin:0}}>avg time</p></div>
          <div style={{flex:1,textAlign:"center"}}><p style={{color:"rgba(255,255,255,.8)",fontSize:20,fontWeight:700,margin:0}}>{velocityData.approvalRate}%</p><p style={{color:"rgba(255,255,255,.3)",fontSize:9,margin:0}}>approval rate</p></div>
        </div>
        {/* ⬡B:approve:FIX:null_guard_candidates:20260416⬡ Was crashing if autoApprovalCandidates missing */ velocityData?.autoApprovalCandidates?.length>0&&(
          <div style={{marginTop:8,padding:8,borderRadius:8,background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.15)"}}>
            <p style={{color:"#10B981",fontSize:10,fontWeight:600,margin:"0 0 4px"}}>AUTO-APPROVAL CANDIDATES</p>
            {velocityData.autoApprovalCandidates.map((c,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0"}}>
                <span style={{color:"rgba(255,255,255,.6)",fontSize:11}}>{c.type} ({c.approvalRate}% in {c.avgResponseMins}m)</span>
                <button onClick={async()=>{
                  try{await fetch(`${ABABASE}/api/awa/decisions/auto-approve`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId,type:c.type,enabled:true})})}catch{}
                }} style={{padding:"3px 8px",borderRadius:4,border:"1px solid rgba(16,185,129,.2)",background:"rgba(16,185,129,.1)",color:"#10B981",cursor:"pointer",fontSize:9,fontWeight:600}}>Enable</button>
              </div>
            ))}
          </div>
        )}
        {velocityData.message&&<p style={{color:"rgba(255,255,255,.4)",fontSize:10,margin:"8px 0 0",textAlign:"center"}}>{velocityData.message}</p>}
      </div>
      )}
    </div>);
  }
  
  const urgencyColors={5:"#EF4444",4:"#F59E0B",3:"#3B82F6",2:"#6B7280",1:"#6B7280"};
  const typeIcons={email:Mail,calendar:Calendar,task:CheckCircle,confirm:AlertTriangle};
  const TypeIcon=typeIcons[currentItem.type]||Zap;
  
  const cardStyle={
    transform:`translateX(${swipeDir==="right"?300:swipeDir==="left"?-300:touchDelta}px) rotate(${(swipeDir==="right"?15:swipeDir==="left"?-15:touchDelta/20)}deg)`,
    opacity:swipeDir?0:1,
    transition:swipeDir?"transform .3s, opacity .3s":"none"
  };
  
  return(<div style={{flex:1,display:"flex",flexDirection:"column",padding:"8px 4px"}}>
    {/* ⬡B:AUDRA.W12:FIX:category_filters:20260403⬡ Category filter buttons */}
    {items.length>1&&<div style={{display:"flex",gap:4,padding:"0 8px",marginBottom:8,flexWrap:"wrap"}}>
      {["all",...[...new Set(items.map(it=>it.type||"other"))]].map(cat=>{
        const count=cat==="all"?items.length:items.filter(it=>(it.type||"other")===cat).length;
        const active=!categoryFilter&&cat==="all"||categoryFilter===cat;
        return <button key={cat} onClick={()=>setCategoryFilter(cat==="all"?null:cat)} style={{padding:"5px 10px",borderRadius:8,border:"none",cursor:"pointer",fontSize:10,fontWeight:active?600:400,background:active?"rgba(139,92,246,.2)":"rgba(255,255,255,.04)",color:active?"#a78bfa":"rgba(255,255,255,.4)",textTransform:"capitalize"}}>{cat} ({count})</button>;
      })}
    </div>}
    {/* Progress */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,padding:"0 8px"}}>
      <span style={{color:"rgba(255,255,255,.4)",fontSize:11}}>{currentIndex+1} of {filteredItems.length}</span>
      <div style={{flex:1,margin:"0 12px",height:3,background:"rgba(255,255,255,.1)",borderRadius:99}}>
        <div style={{width:`${((currentIndex+1)/filteredItems.length)*100}%`,height:"100%",background:"rgba(139,92,246,.6)",borderRadius:99,transition:"width .3s"}}/>
      </div>
      <span style={{color:"rgba(255,255,255,.4)",fontSize:11}}>{filteredItems.length-currentIndex-1} left</span>
    </div>
    
    {/* Swipe hints */}
    <div style={{display:"flex",justifyContent:"space-between",padding:"0 20px",marginBottom:8}}>
      <div style={{display:"flex",alignItems:"center",gap:6,opacity:touchDelta<-30?.8:.3,transition:"opacity .2s"}}>
        <X size={16} style={{color:"#EF4444"}}/><span style={{color:"#EF4444",fontSize:11,fontWeight:600}}>Reject</span>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6,opacity:touchDelta>30?.8:.3,transition:"opacity .2s"}}>
        <span style={{color:"#10B981",fontSize:11,fontWeight:600}}>Approve</span><CheckCircle size={16} style={{color:"#10B981"}}/>
      </div>
    </div>
    
    {/* Card */}
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}}
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <div style={{width:"100%",maxWidth:340,background:"rgba(255,255,255,.06)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,.1)",borderRadius:20,padding:20,boxShadow:"0 8px 32px rgba(0,0,0,.3)",...cardStyle}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <div style={{width:40,height:40,borderRadius:12,background:`rgba(${currentItem.urgency>=4?"239,68,68":currentItem.urgency>=3?"59,130,246":"139,92,246"},.15)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <TypeIcon size={20} style={{color:urgencyColors[currentItem.urgency]||"#8B5CF6"}}/>
          </div>
          <div style={{flex:1}}>
            <p style={{color:"rgba(255,255,255,.9)",fontSize:14,fontWeight:600,margin:0}}>{currentItem.title}</p>
            <p style={{color:"rgba(255,255,255,.4)",fontSize:11,margin:"2px 0 0",textTransform:"capitalize"}}>{currentItem.type}</p>
          </div>
          {currentItem.urgency>=4&&<span style={{background:"rgba(239,68,68,.15)",color:"#EF4444",fontSize:9,fontWeight:700,padding:"3px 8px",borderRadius:99}}>URGENT</span>}
        </div>
        
        {/* Summary */}
        <p style={{color:"rgba(255,255,255,.7)",fontSize:13,lineHeight:1.6,margin:"0 0 16px"}}>{currentItem.summary}</p>
        
        {/* Options */}
        {currentItem.options&&currentItem.options.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {currentItem.options.map((opt,i)=>(
            <button key={i} onClick={()=>handleSwipe(i===0?"right":"left")} style={{padding:"8px 14px",borderRadius:10,border:"none",cursor:"pointer",background:i===0?"rgba(16,185,129,.2)":"rgba(239,68,68,.15)",color:i===0?"#10B981":"#EF4444",fontSize:12,fontWeight:500}}>
              {opt}
            </button>
          ))}
        </div>}
      </div>
    </div>
    
    {/* Bottom buttons for desktop */}
    <div style={{display:"flex",justifyContent:"center",gap:24,padding:"16px 0"}}>
      <button onClick={()=>handleSwipe("left")} style={{width:56,height:56,borderRadius:"50%",border:"2px solid rgba(239,68,68,.3)",background:"rgba(239,68,68,.1)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <X size={24} style={{color:"#EF4444"}}/>
      </button>
      <button onClick={()=>handleSwipe("right")} style={{width:56,height:56,borderRadius:"50%",border:"2px solid rgba(16,185,129,.3)",background:"rgba(16,185,129,.1)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <CheckCircle size={24} style={{color:"#10B981"}}/>
      </button>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMOS VIEW - Internal HAM-to-HAM messaging
// ⬡B:MYABA.V2:memos:20260319⬡
// ═══════════════════════════════════════════════════════════════════════════
