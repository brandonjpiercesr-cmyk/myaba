// ⬡B:iman.processor:VIEW:email_v2_multiaccount_digest:20260413⬡
// EmailView v2 — Multi-account, ABA cooked section, per-account isolation
// Uses email-core.js shared hooks: useAccounts, useInbox, useDigest

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Mail, ChevronRight, Plus, Send, CheckCircle, Clock, FileText, AlertCircle, Edit3, X, ChevronDown } from "lucide-react";
import { ABABASE } from "../utils/api.js";
import {
  useAccounts, useInbox, useDigest,
  markEmailRead, askAboutEmail, sendReply,
} from "../utils/email-core.js";
import ABALogo from "../components/shared/ABALogo.jsx";

const api = async (path, opts = {}) => {
  const res = await fetch(ABABASE + path, {
    method: opts.method || "GET",
    headers: opts.body ? { "Content-Type": "application/json" } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return res.json();
};

// ═══════════════════════════════════════════════════════════
// COOKED ITEM CARD — Draft, Assignment, or Receipt
// ═══════════════════════════════════════════════════════════
function CookedCard({ item, onApprove, onEdit, onDismiss }) {
  const [expanded, setExpanded] = useState(false);
  const cat = item.category;
  const icon = cat === 'needs_response' ? <Edit3 size={13}/> : cat === 'assignment' ? <FileText size={13}/> : <CheckCircle size={13}/>;
  const color = cat === 'needs_response' ? '139,92,246' : cat === 'assignment' ? '234,179,8' : '34,197,94';
  const label = cat === 'needs_response' ? 'Draft Ready' : cat === 'assignment' ? 'Task Found' : 'Receipt';

  return (
    <div style={{padding:10,borderRadius:10,background:`rgba(${color},.06)`,border:`1px solid rgba(${color},.15)`,marginBottom:6}}>
      <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>setExpanded(!expanded)}>
        <div style={{width:26,height:26,borderRadius:8,background:`rgba(${color},.15)`,display:"flex",alignItems:"center",justifyContent:"center",color:`rgba(${color},.9)`,flexShrink:0}}>{icon}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:10,fontWeight:600,color:`rgba(${color},.8)`,textTransform:"uppercase",letterSpacing:.5}}>{label}</span>
            <span style={{fontSize:9,color:"rgba(255,255,255,.25)"}}>{item.date ? new Date(item.date).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}) : ""}</span>
          </div>
          <p style={{fontSize:11,color:"rgba(255,255,255,.7)",margin:"2px 0 0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.from}: {item.subject}</p>
        </div>
        <ChevronDown size={12} style={{color:"rgba(255,255,255,.3)",transform:expanded?"rotate(180deg)":"none",transition:"transform .2s"}}/>
      </div>

      {expanded && (
        <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid rgba(255,255,255,.06)"}}>
          {item.draft && (
            <div style={{padding:10,borderRadius:8,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",marginBottom:8}}>
              <p style={{fontSize:10,color:"rgba(139,92,246,.6)",margin:"0 0 4px",fontWeight:600}}>ABA's Draft Response:</p>
              <p style={{fontSize:12,color:"rgba(255,255,255,.7)",margin:0,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{item.draft.body}</p>
            </div>
          )}
          {item.assignment && (
            <div style={{padding:10,borderRadius:8,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",marginBottom:8}}>
              <p style={{fontSize:10,color:"rgba(234,179,8,.6)",margin:"0 0 4px",fontWeight:600}}>Extracted Task:</p>
              <p style={{fontSize:12,color:"rgba(255,255,255,.7)",margin:0}}>{item.assignment.task}</p>
              {item.assignment.deadline && <p style={{fontSize:10,color:"rgba(234,179,8,.5)",margin:"4px 0 0"}}>Deadline: {item.assignment.deadline}</p>}
            </div>
          )}
          {item.receipt && (
            <div style={{padding:10,borderRadius:8,background:"rgba(255,255,255,.03)"}}>
              <p style={{fontSize:12,color:"rgba(34,197,94,.7)",margin:0}}>{item.receipt.vendor} — {item.receipt.amount || "Amount pending"}</p>
            </div>
          )}
          <div style={{display:"flex",gap:6,marginTop:6}}>
            {item.draft && <button onClick={()=>onApprove?.(item)} style={{flex:1,padding:"7px",borderRadius:8,border:"none",background:"rgba(139,92,246,.2)",color:"#a78bfa",fontSize:11,fontWeight:500,cursor:"pointer"}}>
              <Send size={11} style={{marginRight:4,verticalAlign:"middle"}}/>Send Draft
            </button>}
            {item.draft && <button onClick={()=>onEdit?.(item)} style={{padding:"7px 12px",borderRadius:8,border:"1px solid rgba(255,255,255,.1)",background:"transparent",color:"rgba(255,255,255,.5)",fontSize:11,cursor:"pointer"}}>Edit</button>}
            <button onClick={()=>onDismiss?.(item)} style={{padding:"7px 12px",borderRadius:8,border:"1px solid rgba(255,255,255,.06)",background:"transparent",color:"rgba(255,255,255,.3)",fontSize:11,cursor:"pointer"}}>
              <X size={11}/>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// EMAIL DETAIL — Single email view with Ask ABA
// ═══════════════════════════════════════════════════════════
function EmailDetail({email,onBack,userId}){
  const[askOpen,setAskOpen]=useState(false);
  const[askInput,setAskInput]=useState("");
  const[askResult,setAskResult]=useState("");
  const[askLoading,setAskLoading]=useState(false);

  useEffect(()=>{
    if(!email?.id||!email.unread)return;
    const timer=setTimeout(async()=>{
      try{ await markEmailRead(api, email.id, userId); }catch{}
    },3000);
    return()=>clearTimeout(timer);
  },[email?.id]);

  const askABA=async()=>{
    if(!askInput.trim())return;
    setAskLoading(true);
    const q=askInput; setAskInput("");
    try{
      const result = await askAboutEmail(api, email, q, userId);
      setAskResult(result);
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

// ═══════════════════════════════════════════════════════════
// MAIN EMAIL VIEW
// ═══════════════════════════════════════════════════════════
export default function EmailView({userId}){
  const { accounts, loading: acctLoading, connect } = useAccounts(api, userId);
  const [activeAccount, setActiveAccount] = useState(null); // null = all accounts
  const { digest, loading: digestLoading, process: processNow } = useDigest(api, userId, activeAccount);
  const { emails, loading: emailLoading, folder, changeFolder, selectedEmail, setSelectedEmail, load } = useInbox(api, userId, activeAccount);
  const [showCooked, setShowCooked] = useState(true);

  const cookedItems = (digest.items || []).filter(d => ['needs_response','assignment','receipt'].includes(d.category));
  const loading = acctLoading || emailLoading;

  if(loading && emails.length===0) return <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:40,height:40,borderRadius:"50%",border:"3px solid rgba(139,92,246,.2)",borderTopColor:"rgba(139,92,246,.8)",animation:"spin 1s linear infinite"}}/></div>;

  return(<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

    {/* ACCOUNT BAR — tabs for each connected account + add button */}
    <div style={{display:"flex",gap:4,padding:"4px 0",flexShrink:0,overflowX:"auto"}}>
      <button onClick={()=>setActiveAccount(null)} style={{padding:"6px 10px",borderRadius:8,border:"none",cursor:"pointer",fontSize:10,fontWeight:!activeAccount?600:400,background:!activeAccount?"rgba(139,92,246,.2)":"rgba(255,255,255,.04)",color:!activeAccount?"rgba(139,92,246,.95)":"rgba(255,255,255,.4)",whiteSpace:"nowrap",flexShrink:0}}>All</button>
      {accounts.map(a=>{
        const active=activeAccount===a.email;
        const label=a.email.split("@")[0];
        return <button key={a.email} onClick={()=>setActiveAccount(a.email)} style={{padding:"6px 10px",borderRadius:8,border:"none",cursor:"pointer",fontSize:10,fontWeight:active?600:400,background:active?"rgba(139,92,246,.2)":"rgba(255,255,255,.04)",color:active?"rgba(139,92,246,.95)":"rgba(255,255,255,.4)",whiteSpace:"nowrap",flexShrink:0}}>{label}</button>;
      })}
      <button onClick={()=>connect('google')} style={{width:28,height:28,borderRadius:8,border:"1px dashed rgba(139,92,246,.3)",background:"transparent",color:"rgba(139,92,246,.6)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} title="Connect another email account">
        <Plus size={14}/>
      </button>
    </div>

    {/* FOLDER TABS + REFRESH */}
    <div style={{display:"flex",gap:4,padding:"2px 0",flexShrink:0}}>
      {["inbox","sent"].map(f=>(
        <button key={f} onClick={()=>{changeFolder(f);}} style={{flex:1,padding:"7px",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:folder===f?600:400,background:folder===f?"rgba(139,92,246,.15)":"rgba(255,255,255,.03)",color:folder===f?"rgba(139,92,246,.9)":"rgba(255,255,255,.35)",textTransform:"capitalize"}}>{f}</button>
      ))}
      <button onClick={()=>{processNow();load(folder);}} style={{padding:"7px 10px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(255,255,255,.04)",color:"rgba(255,255,255,.4)",fontSize:11}}><RefreshCw size={13}/></button>
    </div>

    {/* ABA COOKED SECTION — drafts, tasks, receipts */}
    {cookedItems.length > 0 && folder === 'inbox' && (
      <div style={{flexShrink:0,padding:"4px 0"}}>
        <button onClick={()=>setShowCooked(!showCooked)} style={{display:"flex",alignItems:"center",gap:6,width:"100%",padding:"8px 10px",borderRadius:8,border:"none",background:"rgba(139,92,246,.08)",color:"rgba(139,92,246,.8)",cursor:"pointer",fontSize:11,fontWeight:600}}>
          <ABALogo size={16}/>
          ABA Cooked ({cookedItems.length})
          <ChevronDown size={12} style={{marginLeft:"auto",transform:showCooked?"rotate(180deg)":"none",transition:"transform .2s"}}/>
        </button>
        {showCooked && (
          <div style={{marginTop:4,maxHeight:300,overflowY:"auto"}}>
            {cookedItems.map((item, i) => (
              <CookedCard key={item.message_id || i} item={item}
                onApprove={async (it) => {
                  // ⬡B:iman.processor:FIX:cooked_card_handlers:20260413⬡
                  if (!confirm('Send this draft to ' + (it.from || 'recipient') + '?')) return;
                  try {
                    const res = await api('/api/air/process', {
                      method: 'POST',
                      body: {
                        message: 'Send this drafted email reply. Reply to message ID: ' + (it.draft?.reply_to_message_id || it.message_id) + '. Thread ID: ' + (it.draft?.thread_id || '') + '. To: ' + (it.from_email || it.from) + '. Body: ' + (it.draft?.body || ''),
                        user_id: userId,
                        channel: 'myaba'
                      }
                    });
                    if (res.response) alert('Sent!');
                  } catch (e) { alert('Send failed: ' + e.message); }
                }}
                onEdit={(it) => {
                  const newBody = prompt('Edit the draft:', it.draft?.body || '');
                  if (newBody !== null && newBody.trim()) {
                    it.draft.body = newBody;
                  }
                }}
                onDismiss={async (it) => {
                  try {
                    await api('/api/iman/digest/dismiss', {
                      method: 'POST',
                      body: { message_id: it.message_id, user_id: userId }
                    });
                  } catch {}
                  processNow();
                }}
              />
            ))}
          </div>
        )}
      </div>
    )}

    {/* NO ACCOUNTS STATE */}
    {accounts.length === 0 && !acctLoading && (
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,padding:20}}>
        <Mail size={36} style={{color:"rgba(139,92,246,.3)"}}/>
        <p style={{color:"rgba(255,255,255,.5)",fontSize:13,textAlign:"center"}}>No email accounts connected yet.</p>
        <button onClick={()=>connect('google')} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 20px",borderRadius:10,border:"none",background:"rgba(139,92,246,.2)",color:"#a78bfa",cursor:"pointer",fontSize:13,fontWeight:500}}>
          <Plus size={14}/>Connect Gmail
        </button>
      </div>
    )}

    {/* EMAIL DETAIL */}
    {selectedEmail && <EmailDetail email={selectedEmail} onBack={()=>setSelectedEmail(null)} userId={userId}/>}

    {/* EMAIL LIST */}
    {!selectedEmail && accounts.length > 0 && <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:2,padding:"4px 0"}}>
      {emails.length===0&&!loading&&<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,padding:20}}>
        <Mail size={36} style={{color:"rgba(139,92,246,.3)"}}/>
        <p style={{color:"rgba(255,255,255,.4)",fontSize:13,textAlign:"center"}}>{folder==="inbox"?"Inbox is empty.":"No sent emails."}</p>
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
