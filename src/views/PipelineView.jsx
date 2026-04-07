// ⬡B:MACE.phase0:VIEW:pipeline_extract:20260405⬡
// PipelineView + AlertsSummary — extracted from MyABA.jsx. AWA job pipeline kanban view.

import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { ABABASE } from "../utils/api.js";

function AlertsSummary({userId}){
  const[alerts,setAlerts]=useState([]);

  useEffect(()=>{
    (async()=>{
      try{
        const r=await fetch(`${ABABASE}/api/awa/alerts?userId=${userId}`);
        const d=await r.json();
        if(d.success)setAlerts(d.alerts||[]);
      }catch(e){}
    })();
  },[userId]);

  const urgent=alerts.filter(a=>a.priority==="critical"||a.priority==="high");
  if(urgent.length===0)return null;

  return(<div style={{padding:8,borderRadius:8,background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.12)"}}>
    <p style={{color:"#FBBF24",fontSize:10,fontWeight:600,margin:"0 0 4px"}}>Alerts ({urgent.length})</p>
    {urgent.slice(0,3).map((a,i)=>(
      <p key={i} style={{color:"rgba(255,255,255,.6)",fontSize:10,margin:"2px 0",lineHeight:1.4}}>{a.message.substring(0,100)}</p>
    ))}
  </div>);
}

export default function PipelineView({userId}){
  const[pipeline,setPipeline]=useState(null);
  const[loading,setLoading]=useState(true);
  const[expandedCol,setExpandedCol]=useState(null);

  const COLUMNS=[
    {key:"NEW",label:"New",color:"#6B7280",icon:"inbox"},
    {key:"MATERIALS_READY",label:"Ready",color:"#8B5CF6",icon:"doc"},
    {key:"APPLIED",label:"Applied",color:"#10B981",icon:"sent"},
    {key:"WAITING",label:"Waiting",color:"#F59E0B",icon:"wait"},
    {key:"INTERVIEW_SCHEDULED",label:"Interview",color:"#EC4899",icon:"mic"},
    {key:"INTERVIEWED",label:"Done",color:"#F97316",icon:"check"},
    {key:"OFFER",label:"Offer",color:"#A78BFA",icon:"offer"},
    {key:"ACCEPTED",label:"Won",color:"#34D399",icon:"won"},
  ];

  useEffect(()=>{
    (async()=>{
      try{
        const r=await fetch(`${ABABASE}/api/awa/pipeline?userId=${userId}`);
        const d=await r.json();
        if(d.success)setPipeline(d);
      }catch(e){console.error("[PIPELINE]",e)}
      setLoading(false);
    })();
  },[userId]);

  if(loading)return <div style={{padding:20,textAlign:"center",color:"rgba(255,255,255,.4)"}}>Loading pipeline...</div>;
  if(!pipeline)return <div style={{padding:20,textAlign:"center",color:"rgba(255,255,255,.4)"}}>Could not load pipeline</div>;

  const jobs=pipeline.jobs||[];
  const counts=pipeline.pipeline||{};
  const activeCount=jobs.filter(j=>j.status!=="DISMISSED").length;

  return(<div style={{display:"flex",flexDirection:"column",height:"100%",gap:8}}>
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
      <span style={{color:"white",fontSize:14,fontWeight:600}}>Pipeline</span>
      <span style={{color:"rgba(255,255,255,.4)",fontSize:11}}>{activeCount} active</span>
    </div>

    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:4,paddingBottom:8}}>
      {COLUMNS.map(col=>{
        const colJobs=jobs.filter(j=>j.status===col.key);
        const isExpanded=expandedCol===col.key;
        return(
        <div key={col.key} onClick={()=>setExpandedCol(isExpanded?null:col.key)} style={{background:"rgba(255,255,255,.02)",borderRadius:12,border:`1px solid ${colJobs.length>0?col.color+"30":"rgba(255,255,255,.05)"}`,padding:"10px 14px",cursor:"pointer",transition:"all .2s"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:14}}>{col.icon}</span>
            <span style={{color:col.color,fontSize:12,fontWeight:600,flex:1}}>{col.label}</span>
            <span style={{background:`${col.color}20`,color:col.color,fontSize:12,fontWeight:700,padding:"2px 10px",borderRadius:10,minWidth:24,textAlign:"center"}}>{colJobs.length}</span>
            <ChevronRight size={14} style={{color:"rgba(255,255,255,.2)",transform:isExpanded?"rotate(90deg)":"none",transition:"transform .2s"}}/>
          </div>
          {isExpanded&&colJobs.length>0&&<div style={{marginTop:8,display:"flex",flexDirection:"column",gap:4}}>
            {colJobs.map(job=>(
              <div key={job.id} style={{padding:10,borderRadius:8,background:"rgba(0,0,0,.3)",border:"1px solid rgba(255,255,255,.05)"}}>
                <p style={{color:"rgba(255,255,255,.85)",fontSize:12,fontWeight:500,margin:0,lineHeight:1.3}}>{(job.job_title||job.title||"").substring(0,60)}</p>
                <p style={{color:"rgba(255,255,255,.4)",fontSize:11,margin:"2px 0 0"}}>{(job.organization||"").substring(0,40)}</p>
                {job.interview_date&&<p style={{color:"#FBBF24",fontSize:10,margin:"3px 0 0"}}>Interview: {new Date(job.interview_date).toLocaleDateString()}</p>}
              </div>
            ))}
          </div>}
          {isExpanded&&colJobs.length===0&&<p style={{color:"rgba(255,255,255,.2)",fontSize:11,margin:"6px 0 0",fontStyle:"italic"}}>No jobs in this stage</p>}
        </div>
        );
      })}
    </div>

    <AlertsSummary userId={userId}/>
  </div>);
}
