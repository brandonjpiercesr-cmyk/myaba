// ⬡B:MACE.phase0:VIEW:briefing_extract:20260405⬡
// BriefingView + BriefingSetup — extracted from MyABA.jsx.
// DAWN (Daily Automated Wisdom Notifier) briefing display.

import { useState } from "react";
import { CheckCircle, AlertTriangle, Calendar, Zap, RefreshCw } from "lucide-react";
import { ABABASE } from "../utils/api.js";
import ABALogo from "../components/shared/ABALogo.jsx";

function BriefingSetup({userId,onRefresh}){
  const[selected,setSelected]=useState([]);
  const[custom,setCustom]=useState("");
  const[saving,setSaving]=useState(false);
  const[done,setDone]=useState(false);

  const INTEREST_OPTIONS=[
    {id:"nba",label:"NBA Basketball",emoji:"🏀"},
    {id:"nfl",label:"NFL Football",emoji:"🏈"},
    {id:"college_basketball",label:"College Basketball",emoji:"🎓"},
    {id:"politics",label:"Politics",emoji:"🏛"},
    {id:"tech",label:"Tech & AI",emoji:"💻"},
    {id:"nonprofit",label:"Nonprofit Sector",emoji:"🤝"},
    {id:"finance",label:"Finance & Markets",emoji:"📈"},
    {id:"local_nc",label:"North Carolina News",emoji:"📍"},
    {id:"music",label:"Music",emoji:"🎵"},
    {id:"health",label:"Health & Wellness",emoji:"💪"},
  ];

  const toggle=(id)=>setSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);

  const save=async()=>{
    setSaving(true);
    const interests=[...selected.map(id=>INTEREST_OPTIONS.find(o=>o.id===id)?.label||id)];
    if(custom.trim())interests.push(...custom.split(",").map(s=>s.trim()).filter(Boolean));
    try{
      await fetch(`${ABABASE}/api/air/process`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({message:`Save my news interests for DAWN briefings: ${interests.join(", ")}`,user_id:userId,channel:"cip",appScope:"email"})
      });
    }catch(e){console.error("[BRIEFING] Save prefs error:",e)}
    setSaving(false);setDone(true);
    setTimeout(()=>onRefresh(),1000);
  };

  if(done)return(<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}>
    <CheckCircle size={48} style={{color:"rgba(16,185,129,.6)"}}/>
    <p style={{color:"rgba(255,255,255,.6)",fontSize:14}}>Preferences saved. Loading your briefing...</p>
  </div>);

  return(<div style={{flex:1,overflowY:"auto",padding:"8px 4px"}}>
    <div style={{textAlign:"center",marginBottom:16}}>
      <ABALogo size={36} glow/>
      <p style={{color:"rgba(255,255,255,.8)",fontSize:16,fontWeight:600,margin:"0 0 4px"}}>Set up your briefing</p>
      <p style={{color:"rgba(255,255,255,.4)",fontSize:12,margin:0}}>What do you want ABA to keep you updated on?</p>
    </div>

    <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
      {INTEREST_OPTIONS.map(opt=>{
        const active=selected.includes(opt.id);
        return(<button key={opt.id} onClick={()=>toggle(opt.id)} style={{
          padding:"10px 14px",borderRadius:12,border:`1px solid ${active?"rgba(139,92,246,.3)":"rgba(255,255,255,.08)"}`,
          background:active?"rgba(139,92,246,.15)":"rgba(255,255,255,.03)",
          color:active?"rgba(139,92,246,.95)":"rgba(255,255,255,.5)",
          cursor:"pointer",fontSize:12,fontWeight:active?600:400,display:"flex",alignItems:"center",gap:6
        }}><span>{opt.emoji}</span>{opt.label}</button>);
      })}
    </div>

    <input value={custom} onChange={e=>setCustom(e.target.value)} placeholder="Other interests (comma separated)..." style={{
      width:"100%",padding:"12px 14px",borderRadius:12,border:"1px solid rgba(255,255,255,.08)",
      background:"rgba(255,255,255,.03)",color:"rgba(255,255,255,.8)",fontSize:12,outline:"none",marginBottom:16,boxSizing:"border-box"
    }}/>

    <button disabled={saving||(selected.length===0&&!custom.trim())} onClick={save} style={{
      width:"100%",padding:"14px",borderRadius:12,border:"none",cursor:"pointer",
      background:selected.length>0||custom.trim()?"linear-gradient(135deg,#8B5CF6,#6366F1)":"rgba(255,255,255,.05)",
      color:selected.length>0||custom.trim()?"white":"rgba(255,255,255,.3)",fontSize:14,fontWeight:600
    }}>{saving?"Saving...":"Save & Load Briefing"}</button>
  </div>);
}

export default function BriefingView({data,loading,onRefresh,userId}){
  if(loading){
    return(<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{width:50,height:50,borderRadius:"50%",border:"3px solid rgba(139,92,246,.2)",borderTopColor:"rgba(139,92,246,.8)",animation:"spin 1s linear infinite"}}/>
      <p style={{color:"rgba(255,255,255,.5)",fontSize:13}}>Loading briefing...</p>
    </div>);
  }
  
  if(!data){
    return(<BriefingSetup userId={userId} onRefresh={onRefresh}/>);
  }
  
  const Section=({title,icon:Icon,items,emptyText,color})=>(
    <div style={{marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <Icon size={16} style={{color:color||"rgba(139,92,246,.7)"}}/>
        <span style={{color:"rgba(255,255,255,.8)",fontSize:13,fontWeight:600}}>{title}</span>
        {items?.length>0&&<span style={{background:"rgba(139,92,246,.2)",color:"rgba(139,92,246,.9)",fontSize:10,padding:"2px 8px",borderRadius:99}}>{items.length}</span>}
      </div>
      {items?.length>0?(
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {items.map((item,i)=>(
            <div key={i} style={{padding:"10px 14px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12}}>
              <p style={{color:"rgba(255,255,255,.8)",fontSize:12,margin:0,lineHeight:1.5}}>{typeof item==="string"?item:item.text||item.title||item.description||JSON.stringify(item)}</p>
              {item.time&&<span style={{color:"rgba(255,255,255,.4)",fontSize:10}}>{item.time}</span>}
            </div>
          ))}
        </div>
      ):(
        <p style={{color:"rgba(255,255,255,.3)",fontSize:12,fontStyle:"italic",padding:"8px 0"}}>{emptyText}</p>
      )}
    </div>
  );
  
  return(<div style={{flex:1,overflowY:"auto",padding:"8px 4px"}}>
    {data.summary&&<div style={{padding:"14px 16px",background:"linear-gradient(135deg,rgba(139,92,246,.15),rgba(99,102,241,.1))",border:"1px solid rgba(139,92,246,.2)",borderRadius:14,marginBottom:16}}>
      <p style={{color:"rgba(255,255,255,.9)",fontSize:13,margin:0,lineHeight:1.6}}>{data.summary}</p>
    </div>}
    
    <Section title="Handled" icon={CheckCircle} items={data.handled} emptyText="Nothing handled yet today" color="#10B981"/>
    <Section title="Pending" icon={AlertTriangle} items={data.pending} emptyText="Nothing pending" color="#F59E0B"/>
    <Section title="Upcoming" icon={Calendar} items={data.upcoming} emptyText="No upcoming events" color="#3B82F6"/>
    {data.news&&data.news.length>0&&<Section title="News" icon={Zap} items={data.news} emptyText="" color="#F59E0B"/>}
    
    <div style={{display:"flex",justifyContent:"center",paddingTop:8}}>
      <button onClick={onRefresh} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 20px",borderRadius:10,border:"none",cursor:"pointer",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.4)",fontSize:12}}>
        <RefreshCw size={14}/>Refresh
      </button>
    </div>
  </div>);
}
