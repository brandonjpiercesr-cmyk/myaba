// ⬡B:MACE.phase1:VIEW:jobs_migrated:20260406⬡
// JobsView — CIP surface, migrated to use awa-core.js shared library.
// Constants, API functions, filtering, sorting all from awa-core.
// Only JSX rendering and platform-specific UI state live here.

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Briefcase, Building, MapPin, ExternalLink, Download, ChevronDown, ChevronRight,
  Edit2, Loader2, Send, Search, FileText, RefreshCw, X, Users, Eye, Copy, Star, Trash2
} from "lucide-react";
import { ABABASE } from "../utils/api.js";
import { resolveHamId } from "../utils/ham.js";
import MockInterviewVARA from "../components/MockInterviewVARA.jsx";
import {
  TEAM, TEAM_COLORS, STAGE_COLORS, PERSONAL_EMAILS, PIPELINE_STAGES,
  cleanTitle, getDisplayName, getTeamColor,
  fetchJobs as coreFetchJobs, fetchUnmatchedJobs, runAction, updateStatus, assignJob,
  bulkGenerate as coreBulkGenerate, loadReferences,
  useJobs, useJobFilters, useMockInterview, useMiniChat,
} from "../utils/awa-core.js";

// CIP API adapter — wraps fetch(ABABASE + path) for awa-core functions
const api = async (path, opts = {}) => {
  const res = await fetch(ABABASE + path, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json', 'Accept': 'application/json' } : { 'Accept': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return res.json();
};

export default function JobsView({userId, setEditorDoc}){
  const defaultHam = resolveHamId(userId);
  
  // Core hooks — jobs, filtering, mock interview, mini chat
  const { jobs, loading, error, fetchJobs: refreshJobs, setJobs } = useJobs(api, userId);
  const {
    filtered, teamFilter, setTeamFilter, statusFilter, setStatusFilter,
    searchTerm, setSearchTerm, activeStage, setActiveStage,
    sortBy, setSortBy, stageCounts, totalActive,
  } = useJobFilters(jobs, defaultHam);
  const mock = useMockInterview(api, userId);
  const chat = useMiniChat(api, userId);
  
  // Platform-specific UI state (CIP only)
  const[selectedJob,setSelectedJob]=useState(null);
  const[generating,setGenerating]=useState(null);
  const[output,setOutput]=useState(null);
  const[showRefs,setShowRefs]=useState(false);
  const[jobRefs,setJobRefs]=useState([]);
  const[applyPreview,setApplyPreview]=useState(null);
  const[applyLoading,setApplyLoading]=useState(false);
  const[interviewChat,setInterviewChat]=useState(null);
  const[offerForm,setOfferForm]=useState(null);
  const[prepData,setPrepData]=useState(null);
  const[prepLoading,setPrepLoading]=useState(false);
  const[mockMode,setMockMode]=useState(false);
  const[mockQuestion,setMockQuestion]=useState(null);
  const[mockAnswer,setMockAnswer]=useState("");
  const[mockEval,setMockEval]=useState(null);
  const[mockHistory,setMockHistory]=useState([]);
  const[mockLoading,setMockLoading]=useState(false);
  const[varaInterview,setVaraInterview]=useState(null);
  const[unmatchedJobs,setUnmatchedJobs]=useState([]);
  const[assigningJob,setAssigningJob]=useState(null);
  const[bulkSelected,setBulkSelected]=useState(new Set());
  const[splitPane,setSplitPane]=useState(null);
  const[bulkLoading,setBulkLoading]=useState(false);
  const[miniChat,setMiniChat]=useState('');
  const[miniChatResult,setMiniChatResult]=useState(null);
  const[miniChatLoading,setMiniChatLoading]=useState(false);
  
  // Unmatched jobs fetch
  useEffect(()=>{
    if(statusFilter==="unmatched"){
      (async()=>{
        try{ const result = await fetchUnmatchedJobs(api); setUnmatchedJobs(result); }
        catch(e){ console.error("[AWA] Unmatched fetch:",e) }
      })();
    }
  },[statusFilter]);
  
  // Action handlers using core API functions
  const assignJobTo = async(jobId, assignTo) => {
    setAssigningJob(jobId);
    try{ await assignJob(api, jobId, assignTo, userId); setUnmatchedJobs(prev=>prev.filter(j=>j.id!==jobId)); }
    catch(e){ console.error("[AWA] Assign failed:",e) }
    setAssigningJob(null);
  };
  
  const toggleBulk=(id)=>{setBulkSelected(p=>{const n=new Set(p);if(n.has(id))n.delete(id);else n.add(id);return n;});};
  
  const handleBulkGenerate = async() => {
    setBulkLoading(true);
    const selectedJobs = filtered.filter(j=>bulkSelected.has(j.id));
    await coreBulkGenerate(api, selectedJobs, userId);
    setBulkLoading(false);
    setBulkSelected(new Set());
  };
  
  const openSplitPane = async(job) => {
    const a=(job.assignees||[])[0]||userId;
    setSplitPane({job,cl:'',res:'',loading:true});
    try{
      const[clResult, resResult] = await Promise.all([
        runAction(api, 'cover-letter', job, a),
        runAction(api, 'resume', job, a),
      ]);
      setSplitPane(p=>({...p, cl:clResult.coverLetter||clResult.response||'', res:resResult.resume||resResult.response||'', loading:false}));
    }catch{ setSplitPane(p=>({...p,loading:false})); }
  };
  
  const handleGenerate = async(type) => {
    if(!selectedJob) return;
    setGenerating(type); setOutput(null);
    try{
      const action = type==="cover" ? "cover-letter" : type==="resume" ? "resume" : "writing-sample";
      const result = await runAction(api, action, selectedJob, userId);
      setOutput(result.coverLetter||result.resume||result.writingSample||result.response||JSON.stringify(result,null,2));
    }catch(e){ setOutput("Error: "+e.message) }
    setGenerating(null);
  };

  // Alias filter/setFilter for JSX compatibility
  const filter = searchTerm;
  const setFilter = setSearchTerm;

  if(loading){
    return(<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{width:50,height:50,borderRadius:"50%",border:"3px solid rgba(139,92,246,.2)",borderTopColor:"rgba(139,92,246,.8)",animation:"spin 1s linear infinite"}}/>
      <p style={{color:"rgba(255,255,255,.5)",fontSize:13}}>Loading jobs...</p>
    </div>);
  }
  
  return(<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
    {/* Status filter: Active | My Applications | All | Unmatched (admin only) */}
    <div style={{display:"flex",gap:4,marginBottom:6}}>
      {[{k:"active",l:"Active Jobs"},{k:"applied",l:"My Applications"},{k:"all",l:"All"},...(["brandon","brandonjpiercesr","eric","ericreeselane"].includes(defaultHam)?[{k:"unmatched",l:"Review"}]:[])].map(sf=>(
        <button key={sf.k} onClick={()=>{setStatusFilter(sf.k);setSelectedJob(null);}} style={{
          flex:1,padding:"8px 6px",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:statusFilter===sf.k?600:400,
          background:statusFilter===sf.k?"rgba(139,92,246,.2)":"rgba(255,255,255,.04)",
          color:statusFilter===sf.k?"rgba(139,92,246,.95)":"rgba(255,255,255,.4)",transition:"all .2s"
        }}>{sf.l}{sf.k==="applied"?` (${jobs.filter(j=>["APPLIED","WAITING","INTERVIEW_SCHEDULED","INTERVIEWED","SECOND_INTERVIEW","OFFER","ACCEPTED"].includes((j.status||"").toUpperCase())).length})`:""}</button>
      ))}
    </div>
    {/* Team filter buttons */}
    <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
      {TEAM.map(tm=>(
        <button key={tm.id} onClick={()=>{setTeamFilter(tm.id);setSelectedJob(null);}} style={{
          padding:"6px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:11,fontWeight:500,
          background:teamFilter===tm.id?`${tm.color}30`:"rgba(255,255,255,.05)",
          color:teamFilter===tm.id?tm.color:"rgba(255,255,255,.5)",
          transition:"all .2s"
        }}>{tm.name}</button>
      ))}
    </div>
    
    {/* Search */}
    
    {/* Unmatched Review Queue - Brandon/Eric only */}
    {statusFilter==="unmatched"&&<div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
      <p style={{color:"rgba(255,255,255,.5)",fontSize:11,margin:"0 0 8px"}}>{unmatchedJobs.length} jobs need manual assignment. Tap a name to assign.</p>
      {unmatchedJobs.map(j=>(
        <div key={j.id} style={{padding:"12px 14px",borderRadius:12,background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.15)"}}>
          <p style={{color:"rgba(255,255,255,.85)",fontSize:13,fontWeight:600,margin:"0 0 2px"}}>{(j.job_title||j.title||"?").substring(0,60)}</p>
          <p style={{color:"rgba(255,255,255,.4)",fontSize:11,margin:"0 0 8px"}}>{j.organization||""} {j.location?`· ${j.location}`:""}</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {[{id:"brandon",name:"Brandon",c:"#8B5CF6"},{id:"eric",name:"Eric",c:"#3B82F6"},{id:"bj",name:"BJ",c:"#10B981"},{id:"cj",name:"CJ",c:"#F59E0B"},{id:"vante",name:"Vante",c:"#F97316"},{id:"dwayne",name:"Dwayne",c:"#EC4899"}].map(t=>(
              <button key={t.id} disabled={assigningJob===j.id} onClick={()=>assignJobTo(j.id,t.id)} style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${t.c}30`,background:`${t.c}15`,color:t.c,cursor:"pointer",fontSize:11,fontWeight:500}}>{t.name}</button>
            ))}
            <button onClick={()=>assignJobTo(j.id,"DISMISSED")} style={{padding:"5px 12px",borderRadius:8,border:"1px solid rgba(239,68,68,.2)",background:"rgba(239,68,68,.08)",color:"rgba(239,68,68,.6)",cursor:"pointer",fontSize:11,marginLeft:"auto"}}>Dismiss</button>
          </div>
        </div>
      ))}
      {unmatchedJobs.length===0&&<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><p style={{color:"rgba(255,255,255,.3)",fontSize:13}}>No unmatched jobs right now</p></div>}
    </div>}
    
    {/* Split view - hidden during unmatched review */}
    {statusFilter!=="unmatched"&&<div style={{flex:1,display:"flex",gap:8,overflow:"hidden"}}>
      {/* Job list */}
      <div style={{flex:selectedJob?1:2,overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
        {filtered.length===0&&<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,padding:20}}>
          <Briefcase size={40} style={{color:"rgba(139,92,246,.3)"}}/>
          <p style={{color:"rgba(255,255,255,.5)",fontSize:14,fontWeight:500,textAlign:"center"}}>No jobs matched to you yet</p>
          <p style={{color:"rgba(255,255,255,.3)",fontSize:12,textAlign:"center",maxWidth:280}}>When ABA finds roles that fit your profile, they'll appear here with cover letters and resumes ready to go.</p>
        </div>}
        {filtered.map(job=>{
          const title=job.job_title||job.title||"Untitled";
          const company=job.organization||job.company||"Unknown";
          const assignee=(job.assignees||[])[0]||job.assignee||"Unassigned";
          const assigneeDisplay=getDisplayName(assignee);
          return(
          <div key={job.id} onClick={()=>{setSelectedJob(job);setApplyPreview(null);setInterviewChat(null);setOfferForm(null);setShowRefs(false);setMockMode(false);setMockQuestion(null);setMockEval(null);}} style={{padding:12,borderRadius:12,background:selectedJob?.id===job.id?"rgba(139,92,246,.15)":"rgba(255,255,255,.03)",border:`1px solid ${selectedJob?.id===job.id?"rgba(139,92,246,.3)":"rgba(255,255,255,.05)"}`,borderLeft:`3px solid ${TEAM_COLORS[assigneeDisplay]||"rgba(255,255,255,.2)"}`,cursor:"pointer",transition:"all .2s"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
              <p style={{color:"rgba(255,255,255,.9)",fontSize:13,fontWeight:600,margin:0,lineHeight:1.3}}>{title}</p>
              {job.remote&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:"rgba(16,185,129,.15)",color:"#10B981",flexShrink:0}}>Remote</span>}
            </div>
            <p style={{color:"rgba(255,255,255,.5)",fontSize:11,margin:"4px 0 0"}}>{company}</p>
            <div style={{display:"flex",gap:6,marginTop:6,alignItems:"center"}}>
              <span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:`${TEAM_COLORS[assigneeDisplay]||"rgba(255,255,255,.1)"}20`,color:TEAM_COLORS[assigneeDisplay]||"rgba(255,255,255,.5)"}}>{assigneeDisplay}</span>
              {job.status&&job.status!=="NEW"&&job.status!=="MATERIALS_READY"&&job.status!=="LIVE"&&<span style={{fontSize:9,padding:"2px 5px",borderRadius:4,background:job.status==="APPLIED"?"rgba(16,185,129,.12)":job.status==="INTERVIEW_SCHEDULED"?"rgba(245,158,11,.12)":job.status==="OFFER"?"rgba(139,92,246,.15)":job.status==="ACCEPTED"?"rgba(16,185,129,.2)":"rgba(255,255,255,.05)",color:job.status==="APPLIED"?"#10B981":job.status==="INTERVIEW_SCHEDULED"?"#FBBF24":job.status==="OFFER"?"#A78BFA":job.status==="ACCEPTED"?"#34D399":"rgba(255,255,255,.4)"}}>{job.status.replace(/_/g," ")}</span>}
              {job.salary&&<span style={{fontSize:10,color:"rgba(255,255,255,.3)"}}>{job.salary}</span>}
            </div>
          </div>
        )})}
      </div>
      
      {/* Detail panel */}
      {selectedJob&&<div style={{flex:1,background:"rgba(255,255,255,.03)",borderRadius:12,padding:16,overflowY:"auto",border:"1px solid rgba(255,255,255,.05)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div>
            <h3 style={{color:"white",fontSize:16,fontWeight:600,margin:0}}>{selectedJob.job_title||selectedJob.title}</h3>
            <p style={{color:"rgba(255,255,255,.5)",fontSize:12,margin:"4px 0 0"}}>{selectedJob.organization||selectedJob.company}</p>
          </div>
          <button onClick={()=>{setSelectedJob(null);setOutput(null)}} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><X size={18} style={{color:"rgba(255,255,255,.4)"}}/></button>
        </div>
        
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <div style={{padding:8,borderRadius:8,background:"rgba(255,255,255,.05)"}}>
            <p style={{color:"rgba(255,255,255,.4)",fontSize:10,margin:0}}>Location</p>
            <p style={{color:"rgba(255,255,255,.8)",fontSize:12,margin:"2px 0 0"}}>{selectedJob.location||"Not specified"}</p>
          </div>
          <div style={{padding:8,borderRadius:8,background:"rgba(255,255,255,.05)"}}>
            <p style={{color:"rgba(255,255,255,.4)",fontSize:10,margin:0}}>Salary</p>
            <p style={{color:"rgba(255,255,255,.8)",fontSize:12,margin:"2px 0 0"}}>{selectedJob.salary||"Not specified"}</p>
          </div>
        </div>
        
        {selectedJob.url&&<a href={selectedJob.url} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:4,color:"rgba(139,92,246,.8)",fontSize:12,marginBottom:12,textDecoration:"none"}}><ExternalLink size={12}/>View Original</a>}
        
        {/* Apply method + requirements badges */}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
          {selectedJob.apply_method&&<span style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:600,background:selectedJob.apply_method==="email"?"rgba(16,185,129,.15)":selectedJob.apply_method==="idealist_form"?"rgba(139,92,246,.15)":"rgba(245,158,11,.15)",color:selectedJob.apply_method==="email"?"#10B981":selectedJob.apply_method==="idealist_form"?"#8B5CF6":"#F59E0B"}}>{selectedJob.apply_method==="email"?"EMAIL":"IDEALIST FORM"}</span>}
          <span style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:600,background:"rgba(59,130,246,.12)",color:"rgba(96,165,250,.9)"}}>Resume</span>
          <span style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:600,background:"rgba(139,92,246,.12)",color:"rgba(167,139,250,.9)"}}>Cover Letter</span>
          {selectedJob.application_requirements?.writing_sample&&<span style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:600,background:"rgba(245,158,11,.15)",color:"#F59E0B"}}>Writing Sample</span>}
          {selectedJob.application_requirements?.references&&<span style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:600,background:"rgba(239,68,68,.12)",color:"rgba(239,68,68,.8)"}}>References</span>}
        </div>
        
        <div style={{display:"flex",gap:6,marginBottom:8}}>
          <button onClick={()=>handleGenerate("cover")} disabled={generating} style={{flex:1,padding:"10px 8px",borderRadius:8,border:"none",cursor:generating?"wait":"pointer",background:"rgba(139,92,246,.2)",color:"#A78BFA",fontSize:11,fontWeight:500,opacity:generating?.5:1}}>{generating==="cover"?"...":"Cover Letter"}</button>
          <button onClick={()=>handleGenerate("resume")} disabled={generating} style={{flex:1,padding:"10px 8px",borderRadius:8,border:"none",cursor:generating?"wait":"pointer",background:"rgba(59,130,246,.2)",color:"#60A5FA",fontSize:11,fontWeight:500,opacity:generating?.5:1}}>{generating==="resume"?"...":"Resume"}</button>
          <button onClick={()=>handleGenerate("writing_sample")} disabled={generating} style={{flex:1,padding:"10px 8px",borderRadius:8,border:"none",cursor:generating?"wait":"pointer",background:"rgba(245,158,11,.2)",color:"#FBBF24",fontSize:11,fontWeight:500,opacity:generating?.5:1}}>{generating==="writing_sample"?"...":"Writing Sample"}</button>
        </div>
        
        {/* ⬡B:AWA.v3:Phase2:download_buttons:20260315⬡ */}
        <div style={{display:"flex",gap:6,marginBottom:8}}>
          <button onClick={async()=>{
            try{
              const assignee=(selectedJob.assignees||[])[0]||"unmatched";
              const r=await api('/api/awa/export/combined/preview',{method:'POST',body:{jobId:selectedJob.id,format:"pdf",userId:assignee,includeReferences:true}});
              const d=await r.json();
              if(d.success&&d.base64){const blob=new Blob([Uint8Array.from(atob(d.base64),c=>c.charCodeAt(0))],{type:"application/pdf"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=d.filename||"application.pdf";a.click();URL.revokeObjectURL(url)}
              else{setOutput("PDF generation failed: "+(d.error||"Unknown error"))}
            }catch(e){setOutput("PDF download error: "+e.message)}
          }} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid rgba(16,185,129,.2)",cursor:"pointer",background:"rgba(16,185,129,.1)",color:"#10B981",fontSize:11,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
            <Download size={12}/>PDF
          </button>
          <button onClick={async()=>{
            try{
              const assignee=(selectedJob.assignees||[])[0]||"unmatched";
              const r=await api('/api/awa/export/combined/preview',{method:'POST',body:{jobId:selectedJob.id,format:"docx",userId:assignee,includeReferences:true}});
              const d=await r.json();
              if(d.success&&d.base64){const blob=new Blob([Uint8Array.from(atob(d.base64),c=>c.charCodeAt(0))],{type:d.contentType});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=d.filename||"application.docx";a.click();URL.revokeObjectURL(url)}
              else{setOutput("DOCX generation failed: "+(d.error||"Unknown error"))}
            }catch(e){setOutput("DOCX download error: "+e.message)}
          }} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid rgba(59,130,246,.2)",cursor:"pointer",background:"rgba(59,130,246,.1)",color:"#60A5FA",fontSize:11,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
            <Download size={12}/>DOCX
          </button>
        </div>
        
        {/* ⬡B:AWA.v4:Phase4:apply_preview_flow:20260319⬡ */}
        {selectedJob.status!=="APPLIED"&&selectedJob.status!=="INTERVIEW_SCHEDULED"&&selectedJob.status!=="OFFER"&&selectedJob.status!=="ACCEPTED"&&selectedJob.status!=="DISMISSED"&&(
        <div style={{marginBottom:8}}>
          {!applyPreview?(
          <button disabled={applyLoading} onClick={async()=>{
            setApplyLoading(true);
            try{
              const assignee=(selectedJob.assignees||[])[0]||"unmatched";
              const r=await api('/api/awa/jobs/${selectedJob.id}/apply-preview',{method:'POST',body:{userId:assignee}});
              const d=await r.json();
              if(d.success){setApplyPreview(d)}else{setOutput("Preview failed: "+(d.error||"Unknown"))}
            }catch(e){setOutput("Preview error: "+e.message)}
            setApplyLoading(false);
          }} style={{width:"100%",padding:"12px 8px",borderRadius:10,border:"none",cursor:"pointer",background:"linear-gradient(135deg,rgba(16,185,129,.3),rgba(59,130,246,.3))",color:"#34D399",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:applyLoading?.6:1}}>
            <Send size={16}/>{applyLoading?"Preparing...":"Apply to This Job"}
          </button>
          <button onClick={async()=>{
            const assignee=(selectedJob.assignees||[])[0]||'unmatched';
            await updateStatus(api,selectedJob.id,'APPLIED',userId,{notes:'Manually marked as applied (applied outside ABA)'});
            fetchJobs();
          }} style={{width:'100%',padding:'10px 8px',borderRadius:10,border:'1px solid rgba(163,230,53,.2)',cursor:'pointer',background:'rgba(163,230,53,.08)',color:'rgba(163,230,53,.8)',fontSize:12,fontWeight:500,display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginTop:6}}>
            Already Applied (Mark Status)
          </button>
          ):(
          <div style={{padding:12,borderRadius:10,background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.15)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{color:"#34D399",fontSize:12,fontWeight:600}}>
                {applyPreview.applicationType==="email"?"Email Application":applyPreview.applicationType==="idealist_form"?"Idealist Application":"External Application"}
              </span>
              <button onClick={()=>setApplyPreview(null)} style={{background:"none",border:"none",color:"rgba(255,255,255,.3)",cursor:"pointer",fontSize:18}}>x</button>
            </div>
            
            {/* Download PDF + DOCX */}
            <div style={{display:"flex",gap:6,marginBottom:8}}>
              <button onClick={()=>{
                if(applyPreview.pdfBase64){const blob=new Blob([Uint8Array.from(atob(applyPreview.pdfBase64),c=>c.charCodeAt(0))],{type:"application/pdf"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=applyPreview.pdfFilename||"application.pdf";a.click();URL.revokeObjectURL(url)}
                else{setOutput("PDF not ready yet")}
              }} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid rgba(16,185,129,.2)",cursor:"pointer",background:"rgba(16,185,129,.1)",color:"#10B981",fontSize:11,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                <Download size={12}/>Download PDF
              </button>
              <button onClick={async()=>{
                try{
                  const assignee=(selectedJob.assignees||[])[0]||"unmatched";
                  const r=await api('/api/awa/export/combined/preview',{method:'POST',body:{jobId:selectedJob.id,format:"docx",userId:assignee,includeReferences:true}});
                  const d=await r.json();
                  if(d.success&&d.base64){const blob=new Blob([Uint8Array.from(atob(d.base64),c=>c.charCodeAt(0))],{type:d.contentType});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=d.filename||"application.docx";a.click();URL.revokeObjectURL(url)}
                }catch(e){setOutput("DOCX error: "+e.message)}
              }} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid rgba(59,130,246,.2)",cursor:"pointer",background:"rgba(59,130,246,.1)",color:"#60A5FA",fontSize:11,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                <Download size={12}/>Download DOCX
              </button>
            </div>
            
            {/* Email application: show draft + mailto */}
            {applyPreview.applicationType==="email"&&applyPreview.emailDraft&&(
            <div style={{marginBottom:8}}>
              <p style={{color:"rgba(255,255,255,.5)",fontSize:10,margin:"0 0 4px"}}>To: {applyPreview.emailDraft.to}</p>
              <p style={{color:"rgba(255,255,255,.5)",fontSize:10,margin:"0 0 4px"}}>Subject: {applyPreview.emailDraft.subject}</p>
              <div style={{maxHeight:100,overflowY:"auto",padding:8,borderRadius:6,background:"rgba(0,0,0,.3)",marginBottom:8}}>
                <p style={{color:"rgba(255,255,255,.6)",fontSize:10,margin:0,whiteSpace:"pre-wrap"}}>{applyPreview.emailDraft.body?.substring(0,500)}{applyPreview.emailDraft.body?.length>500?"...":""}</p>
              </div>
              <button onClick={()=>{
                if(applyPreview.mailtoLink)window.location.href=applyPreview.mailtoLink;
              }} style={{width:"100%",padding:"10px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(16,185,129,.25)",color:"#34D399",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                <Mail size={14}/>Open in Email App (attach PDF manually)
              </button>
              <p style={{color:"rgba(255,255,255,.3)",fontSize:9,textAlign:"center",margin:"4px 0 0"}}>Download your PDF first, then attach it in your email app</p>
            </div>
            )}
            
            {/* URL/Idealist application: checklist */}
            {(applyPreview.applicationType==="url"||applyPreview.applicationType==="idealist_form")&&(
            <div style={{marginBottom:8}}>
              {applyPreview.applicationType==="idealist_form"&&<p style={{color:"#8B5CF6",fontSize:10,fontWeight:600,margin:"0 0 6px"}}>Idealist Application Detected</p>}
              {(applyPreview.checklist||[]).map((c,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0"}}>
                  <span style={{color:c.done?"#10B981":"rgba(255,255,255,.3)",fontSize:12}}>{c.done?"✓":"○"}</span>
                  <span style={{color:"rgba(255,255,255,.6)",fontSize:11}}>{c.item}</span>
                </div>
              ))}
              <button onClick={()=>{if(selectedJob.url)window.open(selectedJob.url,"_blank")}} style={{width:"100%",padding:"10px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(59,130,246,.25)",color:"#60A5FA",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:8}}>
                <ExternalLink size={14}/>Open Application Link
              </button>
            </div>
            )}
            
            {/* References warning */}
            {applyPreview.job?.requirements?.references&&(
              <p style={{color:"#F59E0B",fontSize:10,margin:"0 0 8px"}}>This job requires references ({applyPreview.references?.length||0} loaded)</p>
            )}
            
            {/* Confirm applied */}
            <button onClick={async()=>{
              try{
                const assignee=(selectedJob.assignees||[])[0]||"unmatched";
                const method=applyPreview.applicationType||"manual";
                const r=await api('/api/awa/jobs/${selectedJob.id}/apply',{method:'POST',body:{userId:assignee,method}});
                const d=await r.json();
                if(d.success){
                  setSelectedJob(prev=>({...prev,status:"APPLIED",applied_at:new Date().toISOString()}));
                  setJobs(prev=>prev.map(j=>j.id===selectedJob.id?{...j,status:"APPLIED"}:j));
                  setApplyPreview(null);
                  setOutput(d.message);
                }
              }catch(e){setOutput("Confirm error: "+e.message)}
            }} style={{width:"100%",padding:"10px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(16,185,129,.3)",color:"#34D399",fontSize:12,fontWeight:600,marginTop:4}}>
              I Applied - Mark as Submitted
            </button>
          </div>
          )}
        </div>
        )}
        
        {/* Not Interested button */}
        {selectedJob.status!=="DISMISSED"&&selectedJob.status!=="ACCEPTED"&&(
        <button onClick={async()=>{
          try{
            const assignee=(selectedJob.assignees||[])[0]||"unmatched";
            const r=await updateStatus(api,selectedJob.id,"DISMISSED",assignee);
            const d=await r.json();
            if(d.success){
              setSelectedJob(prev=>({...prev,status:"DISMISSED"}));
              setJobs(prev=>prev.map(j=>j.id===selectedJob.id?{...j,status:"DISMISSED"}:j));
            }
          }catch(e){console.error("[AWA] Dismiss failed:",e)}
        }} style={{width:"100%",padding:"6px",borderRadius:6,border:"1px solid rgba(239,68,68,.1)",cursor:"pointer",background:"transparent",color:"rgba(239,68,68,.5)",fontSize:10,marginBottom:8}}>
          Not Interested
        </button>
        )}
        
        {/* ⬡B:AWA.v4:status_with_interview_form:20260319⬡ */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"8px 10px",borderRadius:8,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.05)"}}>
          <span style={{color:"rgba(255,255,255,.4)",fontSize:10}}>Status:</span>
          <span style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:600,
            background:selectedJob.status==="APPLIED"?"rgba(16,185,129,.15)":selectedJob.status==="INTERVIEW_SCHEDULED"?"rgba(245,158,11,.15)":selectedJob.status==="OFFER"?"rgba(139,92,246,.15)":selectedJob.status==="ACCEPTED"?"rgba(16,185,129,.25)":selectedJob.status==="DISMISSED"?"rgba(239,68,68,.12)":"rgba(255,255,255,.08)",
            color:selectedJob.status==="APPLIED"?"#10B981":selectedJob.status==="INTERVIEW_SCHEDULED"?"#FBBF24":selectedJob.status==="OFFER"?"#A78BFA":selectedJob.status==="ACCEPTED"?"#34D399":selectedJob.status==="DISMISSED"?"rgba(239,68,68,.7)":"rgba(255,255,255,.5)"
          }}>{(selectedJob.status||"NEW").replace(/_/g," ")}</span>
          <select onChange={async(e)=>{
            const newStatus=e.target.value;if(!newStatus)return;
            // Show interview form instead of immediately updating
            if(newStatus==="INTERVIEW_SCHEDULED"){
              setInterviewChat({jobId:selectedJob.id,step:"date",date:"",name:"",notes:"",messages:[{from:"aba",text:"Got it, scheduling an interview. When is it?"}]});
              return;
            }
            // Show offer form
            if(newStatus==="OFFER"){
              setOfferForm({jobId:selectedJob.id,salary:"",deadline:"",details:""});
              return;
            }
            try{
              const assignee=(selectedJob.assignees||[])[0]||"unmatched";
              const r=await api('/api/awa/jobs/${selectedJob.id}/status',{method:'POST',body:{userId:assignee,status:newStatus}});
              const d=await r.json();
              if(d.success){
                setSelectedJob(prev=>({...prev,status:newStatus}));
                setJobs(prev=>prev.map(j=>j.id===selectedJob.id?{...j,status:newStatus}:j));
              }
            }catch(e){console.error("[AWA] Status update failed:",e)}
          }} value="" style={{marginLeft:"auto",padding:"4px 6px",borderRadius:6,border:"1px solid rgba(255,255,255,.1)",background:"rgba(0,0,0,.3)",color:"rgba(255,255,255,.5)",fontSize:10,cursor:"pointer"}}>
            <option value="">Move to...</option>
            {["NEW","SAVED","MATERIALS_READY","APPLIED","WAITING","INTERVIEW_SCHEDULED","INTERVIEWED","SECOND_INTERVIEW","OFFER","ACCEPTED","REJECTED","WITHDRAWN","DISMISSED"].map(s=><option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
          </select>
        </div>
        
        {/* ⬡B:AUDRA:CIP_CONVERSATIONAL_INTERVIEW:20260402⬡ Conversational Interview Tracking */}
        {interviewChat&&interviewChat.jobId===selectedJob.id&&(
        <div style={{padding:12,borderRadius:12,background:"rgba(0,0,0,.3)",border:"1px solid rgba(245,158,11,.15)",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <p style={{color:"#FBBF24",fontSize:13,fontWeight:600,margin:0}}>Interview Tracking</p>
            <button onClick={()=>setInterviewChat(null)} style={{background:"none",border:"none",color:"rgba(255,255,255,.4)",cursor:"pointer",fontSize:16}}>×</button>
          </div>
          <div style={{maxHeight:200,overflowY:"auto",marginBottom:8}}>
            {(interviewChat.messages||[]).map((m,mi)=>(
              <div key={mi} style={{display:"flex",justifyContent:m.from==="aba"?"flex-start":"flex-end",marginBottom:6}}>
                <div style={{maxWidth:"80%",padding:"8px 12px",borderRadius:m.from==="aba"?"12px 12px 12px 4px":"12px 12px 4px 12px",
                  background:m.from==="aba"?"rgba(245,158,11,.1)":"rgba(139,92,246,.2)",
                  color:m.from==="aba"?"#FBBF24":"rgba(255,255,255,.9)",fontSize:12,lineHeight:1.4}}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          {interviewChat.step==="date"&&(
            <div style={{display:"flex",gap:6}}>
              <input type="datetime-local" id="iv-date-cip" style={{flex:1,padding:"8px 10px",borderRadius:8,border:"1px solid rgba(245,158,11,.2)",background:"rgba(0,0,0,.3)",color:"rgba(255,255,255,.8)",fontSize:12}}/>
              <button onClick={()=>{
                const v=document.getElementById("iv-date-cip").value;
                if(!v) return;
                setInterviewChat(p=>({...p,date:v,step:"who",
                  messages:[...p.messages,{from:"you",text:new Date(v).toLocaleString()},{from:"aba",text:"Nice. Who will you be meeting with?"}]}));
              }} style={{padding:"8px 14px",borderRadius:8,border:"none",background:"rgba(245,158,11,.2)",color:"#FBBF24",cursor:"pointer",fontSize:12,fontWeight:600}}>Set</button>
            </div>
          )}
          {interviewChat.step==="who"&&(
            <div style={{display:"flex",gap:6}}>
              <input id="iv-who-cip" placeholder="Name(s)" style={{flex:1,padding:"8px 10px",borderRadius:8,border:"1px solid rgba(255,255,255,.1)",background:"rgba(0,0,0,.3)",color:"rgba(255,255,255,.8)",fontSize:12}}
                onKeyDown={e=>{if(e.key==="Enter"){const v=e.target.value.trim();if(!v)return;
                  setInterviewChat(p=>({...p,name:v,step:"notes",
                    messages:[...p.messages,{from:"you",text:v},{from:"aba",text:"Got it. Any notes or things you want to remember? (or hit Skip)"}]}));}}}/>
              <button onClick={()=>{
                const v=document.getElementById("iv-who-cip").value.trim();
                if(!v) return;
                setInterviewChat(p=>({...p,name:v,step:"notes",
                  messages:[...p.messages,{from:"you",text:v},{from:"aba",text:"Got it. Any notes or things you want to remember? (or hit Skip)"}]}));
              }} style={{padding:"8px 14px",borderRadius:8,border:"none",background:"rgba(245,158,11,.2)",color:"#FBBF24",cursor:"pointer",fontSize:12,fontWeight:600}}>Send</button>
            </div>
          )}
          {interviewChat.step==="notes"&&(
            <div style={{display:"flex",gap:6}}>
              <input id="iv-notes-cip" placeholder="Notes..." style={{flex:1,padding:"8px 10px",borderRadius:8,border:"1px solid rgba(255,255,255,.1)",background:"rgba(0,0,0,.3)",color:"rgba(255,255,255,.8)",fontSize:12}}
                onKeyDown={async e=>{if(e.key==="Enter"){const v=e.target.value.trim();
                  setInterviewChat(p=>({...p,notes:v,step:"done",messages:[...p.messages,{from:"you",text:v||"(none)"},{from:"aba",text:"All set. Saving..."}]}));
                  try{
                    const assignee=(selectedJob.assignees||[])[0]||"unmatched";
                    await api('/api/awa/jobs/${selectedJob.id}/status',{method:'POST',body:{userId:assignee,status:"INTERVIEW_SCHEDULED",interviewDate:interviewChat.date||null,interviewerName:interviewChat.name||null,notes:v||null}});
                    setSelectedJob(prev=>({...prev,status:"INTERVIEW_SCHEDULED",interview_date:interviewChat.date,interviewer_name:interviewChat.name,interview_notes:v}));
                    setJobs(prev=>prev.map(j=>j.id===selectedJob.id?{...j,status:"INTERVIEW_SCHEDULED"}:j));
                  }catch(e2){console.error("[AWA] Interview save:",e2)}
                  setTimeout(()=>{setInterviewChat(p=>({...p,step:"saved",messages:[...p.messages.filter(m=>m.text!=="All set. Saving..."),{from:"aba",text:"Interview tracked. You got this."}]}));},800);
                }}}/>
              <button onClick={async()=>{
                setInterviewChat(p=>({...p,notes:"",step:"done",messages:[...p.messages,{from:"you",text:"(skipped)"},{from:"aba",text:"All set. Saving..."}]}));
                try{
                  const assignee=(selectedJob.assignees||[])[0]||"unmatched";
                  await api('/api/awa/jobs/${selectedJob.id}/status',{method:'POST',body:{userId:assignee,status:"INTERVIEW_SCHEDULED",interviewDate:interviewChat.date||null,interviewerName:interviewChat.name||null,notes:null}});
                  setSelectedJob(prev=>({...prev,status:"INTERVIEW_SCHEDULED",interview_date:interviewChat.date,interviewer_name:interviewChat.name}));
                  setJobs(prev=>prev.map(j=>j.id===selectedJob.id?{...j,status:"INTERVIEW_SCHEDULED"}:j));
                }catch(e2){console.error("[AWA] Interview save:",e2)}
                setTimeout(()=>{setInterviewChat(p=>({...p,step:"saved",messages:[...p.messages.filter(m=>m.text!=="All set. Saving..."),{from:"aba",text:"Interview tracked. You got this."}]}));},800);
              }} style={{padding:"8px 14px",borderRadius:8,border:"none",background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.4)",cursor:"pointer",fontSize:12}}>Skip</button>
            </div>
          )}
          {interviewChat.step==="saved"&&(
            <button onClick={()=>setInterviewChat(null)} style={{width:"100%",padding:10,borderRadius:8,border:"none",background:"rgba(245,158,11,.15)",color:"#FBBF24",cursor:"pointer",fontSize:12,fontWeight:600}}>Done</button>
          )}
        </div>
        )}
        
        {/* Offer form - appears when user selects OFFER */}
        {offerForm&&offerForm.jobId===selectedJob.id&&(
        <div style={{padding:12,borderRadius:10,background:"rgba(139,92,246,.08)",border:"1px solid rgba(139,92,246,.2)",marginBottom:8}}>
          <p style={{color:"#A78BFA",fontSize:12,fontWeight:600,margin:"0 0 8px"}}>Offer Details</p>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            <input placeholder="Salary offered" value={offerForm.salary} onChange={e=>setOfferForm(prev=>({...prev,salary:e.target.value}))} style={{padding:"8px 10px",borderRadius:6,border:"1px solid rgba(139,92,246,.2)",background:"rgba(0,0,0,.3)",color:"rgba(255,255,255,.8)",fontSize:12}}/>
            <input type="date" value={offerForm.deadline} onChange={e=>setOfferForm(prev=>({...prev,deadline:e.target.value}))} placeholder="Response deadline" style={{padding:"8px 10px",borderRadius:6,border:"1px solid rgba(255,255,255,.1)",background:"rgba(0,0,0,.3)",color:"rgba(255,255,255,.8)",fontSize:12}}/>
            <input placeholder="Notes (benefits, details)" value={offerForm.details} onChange={e=>setOfferForm(prev=>({...prev,details:e.target.value}))} style={{padding:"8px 10px",borderRadius:6,border:"1px solid rgba(255,255,255,.1)",background:"rgba(0,0,0,.3)",color:"rgba(255,255,255,.8)",fontSize:12}}/>
          </div>
          <div style={{display:"flex",gap:6,marginTop:8}}>
            <button onClick={async()=>{
              try{
                const assignee=(selectedJob.assignees||[])[0]||"unmatched";
                const r=await api('/api/awa/jobs/${selectedJob.id}/status',{method:'POST',body:{userId:assignee,status:"OFFER",offerSalary:offerForm.salary||null,offerDeadline:offerForm.deadline||null,offerDetails:offerForm.details||null}});
                const d=await r.json();
                if(d.success){
                  setSelectedJob(prev=>({...prev,status:"OFFER",offer_salary:offerForm.salary,offer_deadline:offerForm.deadline,offer_details:offerForm.details}));
                  setJobs(prev=>prev.map(j=>j.id===selectedJob.id?{...j,status:"OFFER"}:j));
                  setOfferForm(null);
                  setOutput(d.message);
                }
              }catch(e){setOutput("Offer save error: "+e.message)}
            }} style={{flex:1,padding:"10px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(139,92,246,.25)",color:"#A78BFA",fontSize:12,fontWeight:600}}>
              Save Offer
            </button>
            <button onClick={()=>setOfferForm(null)} style={{padding:"10px 16px",borderRadius:8,border:"1px solid rgba(255,255,255,.1)",cursor:"pointer",background:"transparent",color:"rgba(255,255,255,.4)",fontSize:12}}>
              Cancel
            </button>
          </div>
        </div>
        )}
        
        {/* ⬡B:AWA.v4:interview_details_display:20260319⬡ */}
        {!interviewChat&&(selectedJob.status==="INTERVIEW_SCHEDULED"||selectedJob.interview_date)&&(
        <div style={{padding:10,borderRadius:8,background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.15)",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <p style={{color:"#FBBF24",fontSize:11,fontWeight:600,margin:0}}>Interview Details</p>
            <button onClick={()=>setInterviewChat({jobId:selectedJob.id,step:"date",date:selectedJob.interview_date||"",name:selectedJob.interviewer_name||"",notes:selectedJob.interview_notes||"",messages:[{from:"aba",text:"Updating interview details. When is it now?"}]})} style={{background:"none",border:"none",color:"rgba(245,158,11,.5)",cursor:"pointer",fontSize:10}}>Edit</button>
          </div>
          {selectedJob.interview_date&&<p style={{color:"rgba(255,255,255,.7)",fontSize:11,margin:"4px 0 2px"}}>Date: {new Date(selectedJob.interview_date).toLocaleString()}</p>}
          {selectedJob.interviewer_name&&<p style={{color:"rgba(255,255,255,.7)",fontSize:11,margin:"2px 0"}}>With: {selectedJob.interviewer_name}</p>}
          {selectedJob.interview_notes&&<p style={{color:"rgba(255,255,255,.5)",fontSize:10,margin:"4px 0 0"}}>{selectedJob.interview_notes}</p>}
        </div>
        )}
        
        {/* ⬡B:AWA.v4:interview_prep_mock:20260319⬡ */}
        {(selectedJob.status==="INTERVIEW_SCHEDULED"||selectedJob.status==="INTERVIEWED"||selectedJob.status==="SECOND_INTERVIEW")&&!mockMode&&(
        <div style={{display:"flex",gap:6,marginBottom:8}}>
          <button disabled={prepLoading} onClick={async()=>{
            setPrepLoading(true);setPrepData(null);
            try{
              const assignee=(selectedJob.assignees||[])[0]||"unmatched";
              const r=await api('/api/awa/jobs/${selectedJob.id}/interview-prep',{method:'POST',body:{userId:assignee}});
              const d=await r.json();
              if(d.success)setPrepData({...d.prep, _jobTitle: selectedJob.job_title||selectedJob.title, _jobOrg: selectedJob.organization||selectedJob.company});
              else setOutput("Prep failed: "+(d.error||"Unknown"));
            }catch(e){setOutput("Prep error: "+e.message)}
            setPrepLoading(false);
          }} style={{flex:1,padding:"10px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(245,158,11,.2)",color:"#FBBF24",fontSize:11,fontWeight:600,opacity:prepLoading?.5:1}}>
            {prepLoading?"Generating...":"Interview Prep"}
          </button>
          <button onClick={()=>{setMockMode(true);setMockQuestion(null);setMockAnswer("");setMockEval(null);setMockHistory([])}} style={{flex:1,padding:"10px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(6,182,212,.2)",color:"#22D3EE",fontSize:11,fontWeight:600}}>
            Practice (Text)
          </button>
          <button onClick={()=>setVaraInterview(selectedJob)} style={{flex:1,padding:"10px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(236,72,153,.2)",color:"#F472B6",fontSize:11,fontWeight:600}}>
            Voice Interview
          </button>
        </div>
        )}
        
        {/* Interview Prep Results — rendered as modal overlay so it persists */}
        {/* (actual modal is rendered outside the detail panel below) */}
        
        {/* Mock Interview Mode */}
        {mockMode&&(
        <div style={{padding:12,borderRadius:10,background:"rgba(6,182,212,.06)",border:"1px solid rgba(6,182,212,.15)",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{color:"#22D3EE",fontSize:12,fontWeight:600}}>Mock Interview ({mockHistory.length} questions)</span>
            <button onClick={()=>{setMockMode(false);setMockQuestion(null);setMockEval(null)}} style={{background:"none",border:"none",color:"rgba(255,255,255,.3)",cursor:"pointer",fontSize:14}}>x</button>
          </div>
          
          {/* Get next question */}
          {!mockQuestion&&!mockLoading&&(
            <button onClick={async()=>{
              setMockLoading(true);
              try{
                const assignee=(selectedJob.assignees||[])[0]||"unmatched";
                const r=await api('/api/awa/jobs/${selectedJob.id}/mock-question',{method:'POST',body:{userId:assignee,previousQuestions:mockHistory}});
                const d=await r.json();
                if(d.success)setMockQuestion(d);
                else setOutput("Mock question failed: "+(d.error||"Unknown"));
              }catch(e){setOutput("Mock error: "+e.message)}
              setMockLoading(false);
            }} style={{width:"100%",padding:"12px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(6,182,212,.2)",color:"#22D3EE",fontSize:12,fontWeight:600}}>
              {mockHistory.length===0?"Start Mock Interview":"Next Question"}
            </button>
          )}
          
          {mockLoading&&<p style={{color:"rgba(6,182,212,.6)",fontSize:11,textAlign:"center"}}>Thinking of a question...</p>}
          
          {/* Show question + answer input */}
          {mockQuestion&&!mockEval&&(
          <div>
            <div style={{padding:8,borderRadius:6,background:"rgba(0,0,0,.3)",marginBottom:8}}>
              {mockQuestion.type&&<span style={{fontSize:9,color:"rgba(6,182,212,.6)",fontWeight:600,textTransform:"uppercase"}}>{mockQuestion.type} • {mockQuestion.difficulty}</span>}
              <p style={{color:"rgba(255,255,255,.8)",fontSize:12,margin:"4px 0 0",lineHeight:1.5}}>{mockQuestion.question}</p>
              {mockQuestion.tip&&<p style={{color:"rgba(245,158,11,.6)",fontSize:9,margin:"6px 0 0",fontStyle:"italic"}}>Tip: {mockQuestion.tip}</p>}
            </div>
            <textarea value={mockAnswer} onChange={e=>setMockAnswer(e.target.value)} placeholder="Type your answer..." rows={4} style={{width:"100%",padding:10,borderRadius:8,border:"1px solid rgba(255,255,255,.1)",background:"rgba(0,0,0,.3)",color:"rgba(255,255,255,.8)",fontSize:12,resize:"vertical",boxSizing:"border-box"}}/>
            <button disabled={!mockAnswer.trim()||mockLoading} onClick={async()=>{
              setMockLoading(true);
              try{
                const assignee=(selectedJob.assignees||[])[0]||"unmatched";
                const r=await api('/api/awa/jobs/${selectedJob.id}/mock-evaluate',{method:'POST',body:{userId:assignee,question:mockQuestion.question,answer:mockAnswer}});
                const d=await r.json();
                if(d.success){setMockEval(d);setMockHistory(prev=>[...prev,mockQuestion.question])}
                else setOutput("Eval failed: "+(d.error||"Unknown"));
              }catch(e){setOutput("Eval error: "+e.message)}
              setMockLoading(false);
            }} style={{width:"100%",marginTop:6,padding:"10px",borderRadius:8,border:"none",cursor:"pointer",background:mockAnswer.trim()?"rgba(6,182,212,.25)":"rgba(255,255,255,.05)",color:mockAnswer.trim()?"#22D3EE":"rgba(255,255,255,.3)",fontSize:12,fontWeight:600}}>
              {mockLoading?"Evaluating...":"Submit Answer"}
            </button>
          </div>
          )}
          
          {/* Show evaluation */}
          {mockEval&&(
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <span style={{fontSize:20,fontWeight:700,color:mockEval.score>=7?"#10B981":mockEval.score>=5?"#FBBF24":"#EF4444"}}>{mockEval.score}/10</span>
              {mockEval.encouragement&&<p style={{color:"rgba(255,255,255,.6)",fontSize:11,margin:0,flex:1}}>{mockEval.encouragement}</p>}
            </div>
            {mockEval.strengths&&<div style={{marginBottom:4}}><p style={{color:"#10B981",fontSize:9,margin:"0 0 2px",fontWeight:600}}>STRENGTHS</p>{mockEval.strengths.map((s,i)=><p key={i} style={{color:"rgba(255,255,255,.6)",fontSize:10,margin:"1px 0"}}>+ {s}</p>)}</div>}
            {mockEval.improvements&&<div style={{marginBottom:4}}><p style={{color:"#F59E0B",fontSize:9,margin:"0 0 2px",fontWeight:600}}>IMPROVE</p>{mockEval.improvements.map((s,i)=><p key={i} style={{color:"rgba(255,255,255,.6)",fontSize:10,margin:"1px 0"}}>- {s}</p>)}</div>}
            {mockEval.betterAnswer&&<div style={{padding:8,borderRadius:6,background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.1)",marginBottom:6}}><p style={{color:"rgba(255,255,255,.4)",fontSize:9,margin:"0 0 3px"}}>STRONGER VERSION</p><p style={{color:"rgba(255,255,255,.7)",fontSize:11,margin:0,lineHeight:1.5}}>{mockEval.betterAnswer}</p></div>}
            <button onClick={()=>{setMockQuestion(null);setMockAnswer("");setMockEval(null)}} style={{width:"100%",padding:"10px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(6,182,212,.2)",color:"#22D3EE",fontSize:12,fontWeight:600,marginTop:4}}>
              Next Question
            </button>
          </div>
          )}
        </div>
        )}
        
        {/* ⬡B:AWA.v4:offer_details_display:20260319⬡ */}
        {!offerForm&&selectedJob.status==="OFFER"&&(
        <div style={{padding:10,borderRadius:8,background:"rgba(139,92,246,.08)",border:"1px solid rgba(139,92,246,.15)",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <p style={{color:"#A78BFA",fontSize:11,fontWeight:600,margin:0}}>Offer Details</p>
            <button onClick={()=>setOfferForm({jobId:selectedJob.id,salary:selectedJob.offer_salary||"",deadline:selectedJob.offer_deadline||"",details:selectedJob.offer_details||""})} style={{background:"none",border:"none",color:"rgba(139,92,246,.5)",cursor:"pointer",fontSize:10}}>Edit</button>
          </div>
          {selectedJob.offer_salary&&<p style={{color:"rgba(255,255,255,.7)",fontSize:11,margin:"4px 0 2px"}}>Salary: {selectedJob.offer_salary}</p>}
          {selectedJob.offer_deadline&&<p style={{color:"rgba(255,255,255,.7)",fontSize:11,margin:"2px 0"}}>Deadline: {new Date(selectedJob.offer_deadline).toLocaleDateString()}</p>}
          {selectedJob.offer_details&&<p style={{color:"rgba(255,255,255,.5)",fontSize:10,margin:"4px 0 0"}}>{selectedJob.offer_details}</p>}
        </div>
        )}
        
        {/* ⬡B:AWA.v3:Phase5:references_in_job:20260315⬡ */}
        <button onClick={async()=>{
          if(showRefs){setShowRefs(false);return}
          try{
            const assignee=(selectedJob.assignees||[])[0]||"unmatched";
            const r=await api(`/api/awa/references?userId=${assignee}`);
            const d=await r.json();
            if(d.success)setJobRefs(d.references||[]);
            setShowRefs(true);
          }catch(e){console.error("[AWA] Refs load failed:",e)}
        }} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid rgba(139,92,246,.15)",cursor:"pointer",background:"rgba(139,92,246,.06)",color:"rgba(167,139,250,.8)",fontSize:11,fontWeight:500,marginBottom:showRefs?0:8,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <Users size={12}/>{showRefs?"Hide References":"Show References"}
        </button>
        {showRefs&&<div style={{padding:8,borderRadius:8,background:"rgba(139,92,246,.04)",border:"1px solid rgba(139,92,246,.1)",marginBottom:8,marginTop:4}}>
          {jobRefs.length===0?<p style={{color:"rgba(255,255,255,.4)",fontSize:10,textAlign:"center",margin:0}}>No references saved yet</p>:
          jobRefs.map((ref,i)=>(
            <div key={ref.id||i} style={{padding:6,borderBottom:i<jobRefs.length-1?"1px solid rgba(255,255,255,.04)":"none"}}>
              <p style={{color:"rgba(255,255,255,.8)",fontSize:11,fontWeight:500,margin:0}}>{ref.name}</p>
              <p style={{color:"rgba(255,255,255,.5)",fontSize:10,margin:"1px 0"}}>{[ref.title,ref.organization].filter(Boolean).join(", ")}</p>
              {ref.phone&&<p style={{color:"rgba(255,255,255,.4)",fontSize:9,margin:0}}>{ref.phone}</p>}
              {ref.email&&<p style={{color:"rgba(255,255,255,.4)",fontSize:9,margin:0}}>{ref.email}</p>}
            </div>
          ))}
        </div>}
        
        {/* Dismiss button */}
        <button onClick={async()=>{
          if(!confirm("Dismiss this job for everyone?"))return;
          try{
            await api(`/api/awa/jobs/${selectedJob.id}/dismiss`,{
              method:"PATCH",body:{userId:user?.email||"unknown",admin_dismiss:true,reason:"Dismissed from MyABA"}
            });
            setJobs(prev=>prev.filter(j=>j.id!==selectedJob.id));
            setSelectedJob(null);setOutput(null);
          }catch(e){console.error("[AWA] Dismiss failed:",e)}
        }} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid rgba(239,68,68,.2)",cursor:"pointer",background:"rgba(239,68,68,.08)",color:"rgba(239,68,68,.7)",fontSize:11,fontWeight:500,marginBottom:12,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <Trash2 size={12}/>Dismiss Job
        </button>
        
        {output&&<div style={{background:"rgba(0,0,0,.3)",borderRadius:8,padding:12,maxHeight:200,overflowY:"auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{color:"rgba(255,255,255,.5)",fontSize:11}}>Generated Output</span>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>{setEditorDoc({content:output,type:generating==="cover"?"Cover Letter":"Resume"});}} style={{background:"rgba(139,92,246,.15)",border:"1px solid rgba(139,92,246,.2)",borderRadius:6,cursor:"pointer",padding:"3px 8px",display:"flex",alignItems:"center",gap:4,color:"rgba(139,92,246,.8)",fontSize:10,fontWeight:500}}><Edit2 size={10}/>Edit</button>
              <button onClick={()=>navigator.clipboard.writeText(output)} style={{background:"none",border:"none",cursor:"pointer",padding:2}}><Copy size={14} style={{color:"rgba(139,92,246,.6)"}}/></button>
            </div>
          </div>
          <pre style={{color:"rgba(255,255,255,.7)",fontSize:11,margin:0,whiteSpace:"pre-wrap",lineHeight:1.5}}>{output}</pre>
        </div>}
      </div>}
    </div>}
    
    {/* Stats footer */}
    <div style={{padding:"8px 0 0",borderTop:"1px solid rgba(255,255,255,.05)",marginTop:8}}>
      <p style={{color:"rgba(255,255,255,.3)",fontSize:10,textAlign:"center",margin:0}}>{filtered.length} of {jobs.length} jobs • AWA powered by ABA</p>
    </div>
    
    {/* ⬡B:AUDRA:FIX6:interview_prep_modal:20260402⬡ Fixed overlay modal for interview prep — persists across job switches */}
    {prepData&&!mockMode&&(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={e=>{if(e.target===e.currentTarget)return}}>
      <div style={{width:"100%",maxWidth:440,maxHeight:"80vh",overflowY:"auto",background:"rgba(20,20,30,.98)",borderRadius:16,border:"1px solid rgba(245,158,11,.2)",padding:20,boxShadow:"0 20px 60px rgba(0,0,0,.5)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div>
            <span style={{color:"#FBBF24",fontSize:13,fontWeight:700}}>Interview Prep</span>
            {prepData._jobTitle&&<p style={{color:"rgba(255,255,255,.5)",fontSize:11,margin:"2px 0 0"}}>{prepData._jobTitle} {prepData._jobOrg?`at ${prepData._jobOrg}`:""}</p>}
          </div>
          <button onClick={()=>setPrepData(null)} style={{background:"rgba(255,255,255,.05)",border:"none",color:"rgba(255,255,255,.5)",cursor:"pointer",fontSize:18,width:28,height:28,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        {prepData.roleAnalysis&&<div style={{marginBottom:10,padding:10,borderRadius:8,background:"rgba(245,158,11,.06)"}}><p style={{color:"rgba(245,158,11,.7)",fontSize:9,margin:"0 0 4px",fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>What They Want</p><p style={{color:"rgba(255,255,255,.75)",fontSize:12,margin:0,lineHeight:1.5}}>{typeof prepData.roleAnalysis==="object"?prepData.roleAnalysis.summary||JSON.stringify(prepData.roleAnalysis):prepData.roleAnalysis}</p></div>}
        {prepData.talkingPoints&&Array.isArray(prepData.talkingPoints)&&prepData.talkingPoints.length>0&&<div style={{marginBottom:10,padding:10,borderRadius:8,background:"rgba(139,92,246,.06)"}}><p style={{color:"rgba(139,92,246,.7)",fontSize:9,margin:"0 0 4px",fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Your Talking Points</p>{prepData.talkingPoints.map((tp,i)=><p key={i} style={{color:"rgba(255,255,255,.65)",fontSize:11,margin:"3px 0",lineHeight:1.4}}>• {typeof tp==="object"?(tp.point||"")+" "+(tp.detail||""):tp}</p>)}</div>}
        {prepData.commonQuestions&&Array.isArray(prepData.commonQuestions)&&prepData.commonQuestions.length>0&&<div style={{marginBottom:10,padding:10,borderRadius:8,background:"rgba(59,130,246,.06)"}}><p style={{color:"rgba(96,165,250,.8)",fontSize:9,margin:"0 0 4px",fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Likely Questions</p>{prepData.commonQuestions.map((q,i)=><p key={i} style={{color:"rgba(255,255,255,.65)",fontSize:11,margin:"3px 0",lineHeight:1.4}}>{i+1}. {typeof q==="object"?(q.question||"")+(q.tip?(" (Tip: "+q.tip+")"):""):q}</p>)}</div>}
        {prepData.questionsToAsk&&Array.isArray(prepData.questionsToAsk)&&prepData.questionsToAsk.length>0&&<div style={{marginBottom:10,padding:10,borderRadius:8,background:"rgba(6,182,212,.06)"}}><p style={{color:"rgba(34,211,238,.7)",fontSize:9,margin:"0 0 4px",fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Ask Them</p>{prepData.questionsToAsk.map((q,i)=><p key={i} style={{color:"#22D3EE",fontSize:11,margin:"3px 0",lineHeight:1.4}}>• {typeof q==="object"?(q.question||""):q}</p>)}</div>}
        {prepData.redFlags&&Array.isArray(prepData.redFlags)&&prepData.redFlags.length>0&&<div style={{marginBottom:10,padding:10,borderRadius:8,background:"rgba(239,68,68,.06)"}}><p style={{color:"rgba(239,68,68,.7)",fontSize:9,margin:"0 0 4px",fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Watch For</p>{prepData.redFlags.map((rf,i)=><p key={i} style={{color:"rgba(239,68,68,.6)",fontSize:11,margin:"3px 0",lineHeight:1.4}}>• {typeof rf==="object"?(rf.flag||"")+" "+(rf.detail||""):rf}</p>)}</div>}
        {prepData.dresscode&&<div style={{padding:10,borderRadius:8,background:"rgba(255,255,255,.03)"}}><p style={{color:"rgba(255,255,255,.4)",fontSize:9,margin:"0 0 4px",fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Dress Code</p><p style={{color:"rgba(255,255,255,.6)",fontSize:11,margin:0}}>{typeof prepData.dresscode==="object"?(prepData.dresscode.recommendation||"")+" "+(prepData.dresscode.details||""):prepData.dresscode}</p></div>}
        <button onClick={()=>setPrepData(null)} style={{width:"100%",marginTop:12,padding:10,borderRadius:8,border:"none",background:"rgba(245,158,11,.15)",color:"#FBBF24",cursor:"pointer",fontSize:12,fontWeight:600}}>Close Prep</button>
      </div>
    </div>
    )}
    
    {/* ⬡B:AUDRA:FIX7:vara_mock_interview_render:20260402⬡ */}
    {varaInterview&&<MockInterviewVARA job={varaInterview} userId={userId} onClose={()=>setVaraInterview(null)}/>}
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════
// PIPELINE VIEW — Kanban board for AWA job tracking
// ⬡B:AWA.v3:Phase6:kanban:20260315⬡
// ═══════════════════════════════════════════════════════════════════════════
