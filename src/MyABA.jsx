// ⬡B:myaba.genesis:APP:v2.0.0:20260227⬡
// MyABA v2.0.0 — ABABASE Integration
// ════════════════════════════════════════════════════════════════════════════
// ARCHITECTURE:
//   - Firebase = AUTH ONLY (Google sign-in)
//   - Conversations = AIR v2 → Supabase (ababase fat context)
//   - Contacts = EXACT MATCH (no semantic search confusion)
//   - Actions = SMS, Email, Phone via ababase tools
//   - Greetings = AGENT DAWN (Dynamic, JARVIS-style, contextual)
//   - Errors = Consumer-ready (no tech jargon)
//   - PWA = Offline queue, background sync
// ════════════════════════════════════════════════════════════════════════════
// ROUTING: USER → MyABA → REACH → AIR v2 → ababase → Supabase Brain
// This file is SKIN. It has NO brain. ZERO hardcoded content.

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Mic, MicOff, Volume2, VolumeX, MessageSquare, Radio, Hand,
  Settings, X, Plus, Bell, Mail, Calendar, Phone, Headphones,
  MessageCircle, Zap, Activity, Clock, CheckCircle, AlertTriangle,
  Sparkles, FileText, Eye, ChevronRight, User, LogOut, Users, Lock,
  Trash2, Archive, Search, WifiOff, Wifi, RefreshCw
} from "lucide-react";
import { auth, signInGoogle, signOutUser } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";

// ═══════════════════════════════════════════════════════════════════════════
// REACH — The Spine. Every interaction. ZERO local thinking.
// ═══════════════════════════════════════════════════════════════════════════
const REACH = "https://aba-reach.onrender.com";

// v1.2.0: Check online status
function isOnline() { return navigator.onLine; }

// v1.2.0: AIR with retry + offline awareness
// ⬡B:MYABA:FIX:ham_identity:20260226⬡
// ⬡B:MYABA:ABABASE:v2.0:20260227⬡ - Now uses /api/air/v2/process
async function airRequest(type, payload = {}, userOrId = "brandon", maxRetries = 3) {
  if (!isOnline()) {
    return { response: null, offline: true, queued: true };
  }
  
  // Support both user object and userId string
  const userId = typeof userOrId === 'object' ? userOrId?.uid || 'brandon' : userOrId;
  const userName = typeof userOrId === 'object' ? userOrId?.displayName || 'Brandon' : 'Brandon';
  const userEmail = typeof userOrId === 'object' ? userOrId?.email || '' : '';
  
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // ⬡B:MYABA:ABABASE:v2.0:20260227⬡
      // Use new /api/air/v2/process endpoint for fat context + exact contact matching
      const res = await fetch(`${REACH}/api/air/v2/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: payload.message || "", 
          userId,
          channel: "myaba",
          // Include conversation context for continuity
          conversationId: payload.conversationId,
          // Pass agent hints for specialized requests
          agentHints: type === "dawn_greeting" ? ["DAWN"] : 
                      type === "save_conversation" ? ["MEMO"] :
                      type === "load_conversations" ? ["COLE"] : []
        }),
      });
      if (!res.ok) throw new Error(`REACH ${res.status}`);
      const data = await res.json();
      // Transform response to match expected format
      return { 
        response: data.response || data.message,
        actions: data.actions,
        metadata: data.metadata
      };
    } catch (e) {
      lastError = e;
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  return { response: null, error: true, errorMessage: lastError?.message };
}

// v1.2.0: Conversations via AIR → Supabase (NOT Firebase)
async function airSaveConversation(userId, conv) {
  return airRequest("save_conversation", { 
    conversationId: conv.id, title: conv.title, messages: conv.messages,
    createdAt: conv.createdAt, archived: conv.archived || false
  }, userId);
}

async function airLoadConversations(userId) {
  const result = await airRequest("load_conversations", {}, userId);
  if (result.conversations) return result.conversations;
  if (result.response?.conversations) return result.response.conversations;
  return [];
}

async function airDeleteConversation(userId, convId) {
  return airRequest("delete_conversation", { conversationId: convId }, userId);
}

async function airArchiveConversation(userId, convId) {
  return airRequest("archive_conversation", { conversationId: convId }, userId);
}

async function reachTranscribe(audioBlob) {
  const form = new FormData();
  form.append("audio", audioBlob, "voice.webm");
  try {
    const res = await fetch(`${REACH}/api/voice/transcribe`, { method: "POST", body: form });
    if (!res.ok) return null;
    return (await res.json()).transcript || null;
  } catch { return null; }
}

async function reachSynthesize(text) {
  try {
    const res = await fetch(`${REACH}/api/voice/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voiceId: "hAQCIV0cazWEuGzMG5bV", model: "eleven_v3" }),
    });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch { return null; }
}

async function reachPresence(userId) {
  try {
    const res = await fetch(`${REACH}/api/presence?userId=${userId}`);
    return res.ok ? await res.json() : { items: [] };
  } catch { return { items: [] }; }
}

async function airNameChat(messages, userId) {
  try {
    const recent = messages.filter(m => m.role === "user").slice(-5).map(m => m.content).join(" | ");
    const data = await airRequest("name_chat", { message: recent, conversationMessages: recent }, userId);
    return data.response || null;
  } catch { return null; }
}

// v1.2.0: JARVIS-style greeting from AGENT DAWN (Daily Automated Wisdom Notifier)
async function getDawnGreeting(userId, userName) {
  const result = await airRequest("dawn_greeting", { 
    userName, includeCalendar: true, includeJobs: true, includeSports: true, context: "login"
  }, userId);
  
  if (result.response) {
    // DAWN returns rich contextual greeting
    if (typeof result.response === "object") {
      return result.response;
    }
    // Parse if stringified
    try {
      const parsed = JSON.parse(result.response);
      return parsed;
    } catch {
      return { greeting: result.response, context: "", proactive: null };
    }
  }
  
  // Fallback - still dynamic based on time
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return {
    greeting: `${timeGreeting}, ${userName || "there"}`,
    context: "I'm ready when you are.",
    proactive: null
  };
}

// Legacy support
function safeParseGreeting(response) {
  if (!response) return { title: "", subtitle: "" };
  let parsed = response;
  if (typeof parsed === "object" && parsed !== null) {
    return { title: parsed.greeting || parsed.title || "", subtitle: parsed.context || parsed.subtitle || "" };
  }
  try { parsed = JSON.parse(parsed); } catch {}
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch {}
  }
  if (typeof parsed === "object" && parsed !== null) {
    return { title: parsed.greeting || parsed.title || "", subtitle: parsed.context || parsed.subtitle || "" };
  }
  return { title: String(response), subtitle: "" };
}

// ═══════════════════════════════════════════════════════════════════════════
// ABA PRESENCE — Premium glass translucent animated orb
// ═══════════════════════════════════════════════════════════════════════════
// v1.2.0: Premium animated ABA presence imported
import { ABAPresence } from './ABAPresence.jsx';

// Alias for backward compatibility
function Blob({state="idle",size=160}){
  return <ABAPresence state={state} size={size} />;
}

// ═══════════════════════════════════════════════════════════════════════════
// BACKGROUNDS
// ═══════════════════════════════════════════════════════════════════════════
const BG={blackLandscape:{u:"https://i.imgur.com/ZwVdgzN.jpeg",l:"Dark Horizon"},eventHorizon:{u:"https://i.imgur.com/A44TxCq.jpeg",l:"Event Horizon"},nebula:{u:"https://i.imgur.com/nLBRQ82.jpeg",l:"Nebula"},stormClouds:{u:"https://i.imgur.com/RRKjvgR.jpeg",l:"Storm Clouds"},wetCity:{u:"https://i.imgur.com/h8zNCw1.jpeg",l:"Wet City"},embers:{u:"https://i.imgur.com/9HZYnlX.png",l:"Embers"},earth:{u:"https://i.imgur.com/NOXQ3aM.png",l:"Earth"},pinkSmoke:{u:"https://i.imgur.com/3RkebB2.jpeg",l:"Pink Smoke"},mountainSnow:{u:"https://i.imgur.com/7Ffjcy2.png",l:"Mountain Snow"},motion:{u:"https://i.imgur.com/3hG18cp.jpeg",l:"Motion"},glassWindows:{u:"https://i.imgur.com/Kjjs7nt.jpeg",l:"Glass Windows"},particleLights:{u:"https://i.imgur.com/wLi9sGD.jpeg",l:"Particle Lights"},beach:{u:"https://i.imgur.com/YaH4lbp.jpeg",l:"Beach"},unity:{u:"https://i.imgur.com/IJAeq7t.png",l:"Unity"},threeGoats:{u:"https://i.imgur.com/jNJUq4u.png",l:"Three Goats"}};

// ═══════════════════════════════════════════════════════════════════════════
// TOAST - v1.2.0: Consumer-ready messages (NO tech jargon)
// ═══════════════════════════════════════════════════════════════════════════
function Toast({message,type="info",onClose}){
  useEffect(()=>{const t=setTimeout(onClose,4000);return()=>clearTimeout(t)},[onClose]);
  const colors={error:"#EF4444",success:"#22C55E",warning:"#F59E0B",info:"#8B5CF6",offline:"#6B7280"};
  const icons={error:AlertTriangle,success:CheckCircle,warning:AlertTriangle,info:Sparkles,offline:WifiOff};
  const Icon=icons[type]||Sparkles;
  return(<div style={{position:"fixed",bottom:100,left:"50%",transform:"translateX(-50%)",padding:"14px 20px",borderRadius:16,background:colors[type],color:"white",fontSize:14,fontWeight:500,zIndex:200,boxShadow:"0 4px 20px rgba(0,0,0,.4)",animation:"mf .3s ease",display:"flex",alignItems:"center",gap:10}}>
    <Icon size={18}/>{message}
  </div>);
}

// v1.2.0: Connection status indicator
function ConnectionStatus({online}){
  if(online)return null;
  return(<div style={{position:"fixed",top:60,left:"50%",transform:"translateX(-50%)",padding:"8px 16px",borderRadius:20,background:"rgba(107,114,128,0.9)",color:"white",fontSize:12,fontWeight:500,display:"flex",alignItems:"center",gap:8,zIndex:150,backdropFilter:"blur(8px)"}}>
    <WifiOff size={14}/>Reconnecting...
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════
// MARKDOWN RENDERER
// ═══════════════════════════════════════════════════════════════════════════
function renderInline(t){const p=[];let r=t;const re=/\*\*(.+?)\*\*/g;let m,last=0,k=0;while((m=re.exec(r))!==null){if(m.index>last)p.push(r.slice(last,m.index));p.push(<strong key={`b${k++}`} style={{color:"rgba(255,255,255,.95)"}}>{m[1]}</strong>);last=m.index+m[0].length}if(last<r.length)p.push(r.slice(last));return p.length>0?p:t}
function renderMd(text){if(!text)return null;let c=text.replace(/^\[(warm|firm|thoughtful|gentle|encouraging|excited|celebratory|annoyed)\]\s*/i,"");const lines=c.split("\n"),blocks=[];let i=0;while(i<lines.length){const ln=lines[i];if(ln.startsWith("```")){const lang=ln.slice(3).trim();const code=[];i++;while(i<lines.length&&!lines[i].startsWith("```")){code.push(lines[i]);i++}i++;blocks.push(<pre key={`c${blocks.length}`} style={{background:"rgba(0,0,0,.4)",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,padding:"10px 12px",margin:"6px 0",overflowX:"auto",fontSize:11,lineHeight:1.5}}>{lang&&<span style={{color:"rgba(139,92,246,.5)",fontSize:9}}>{lang}</span>}<code style={{color:"rgba(134,239,172,.8)"}}>{code.join("\n")}</code></pre>);continue}if(ln.startsWith("### "))blocks.push(<p key={`h${i}`} style={{fontWeight:600,color:"rgba(255,255,255,.75)",fontSize:13,margin:"8px 0 2px"}}>{ln.slice(4)}</p>);else if(ln.startsWith("## "))blocks.push(<p key={`h${i}`} style={{fontWeight:700,color:"rgba(255,255,255,.85)",fontSize:14,margin:"8px 0 2px"}}>{ln.slice(3)}</p>);else if(ln.startsWith("- ")||ln.startsWith("* "))blocks.push(<p key={`li${i}`} style={{paddingLeft:12,color:"rgba(255,255,255,.7)",fontSize:13,margin:"2px 0"}}>• {renderInline(ln.slice(2))}</p>);else if(ln.trim())blocks.push(<p key={`p${i}`} style={{color:"rgba(255,255,255,.8)",fontSize:13,margin:"3px 0",lineHeight:1.55}}>{renderInline(ln)}</p>);i++}return blocks}

// ═══════════════════════════════════════════════════════════════════════════
// OUTPUT CARD
// ═══════════════════════════════════════════════════════════════════════════
function OutputCard({output}){const[exp,setExp]=useState(false);const icons={email:Mail,calendar:Calendar,call:Phone,omi:Headphones,sms:MessageCircle,doc:FileText,task:CheckCircle};const Icon=icons[output.type]||Zap;
  return(<div style={{background:"rgba(255,255,255,.05)",backdropFilter:"blur(16px)",border:"1px solid rgba(255,255,255,.1)",borderRadius:16,padding:"14px 16px",margin:"6px 0",boxShadow:"0 4px 20px rgba(0,0,0,.2)"}}>
    <div onClick={()=>setExp(!exp)} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}><div style={{width:32,height:32,borderRadius:10,background:"rgba(139,92,246,.15)",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon size={16} style={{color:"#8B5CF6"}}/></div><div style={{flex:1}}><div style={{color:"rgba(255,255,255,.9)",fontWeight:600,fontSize:13}}>{output.title}</div>{output.subtitle&&<div style={{color:"rgba(255,255,255,.4)",fontSize:11}}>{output.subtitle}</div>}</div><ChevronRight size={14} style={{color:"rgba(255,255,255,.3)",transform:exp?"rotate(90deg)":"none",transition:".2s"}}/></div>
    {exp&&output.preview&&<div style={{marginTop:10,padding:"10px 12px",background:"rgba(0,0,0,.2)",borderRadius:10,color:"rgba(255,255,255,.6)",fontSize:12,lineHeight:1.5}}>{output.preview}</div>}
    {exp&&output.actions&&<div style={{display:"flex",gap:8,marginTop:10}}><button style={{flex:1,padding:"8px 0",borderRadius:10,border:"none",cursor:"pointer",background:"rgba(34,197,94,.2)",color:"rgba(34,197,94,.9)",fontWeight:600,fontSize:12}}>Confirm</button><button style={{flex:1,padding:"8px 0",borderRadius:10,border:"none",cursor:"pointer",background:"rgba(239,68,68,.12)",color:"rgba(239,68,68,.7)",fontWeight:600,fontSize:12}}>Dismiss</button></div>}
  </div>)}

// ═══════════════════════════════════════════════════════════════════════════
// BUBBLE
// ═══════════════════════════════════════════════════════════════════════════
function Bubble({msg,userPhoto}){const isU=msg.role==="user";const time=msg.timestamp?new Date(msg.timestamp).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}):"";
  return(<div style={{display:"flex",justifyContent:isU?"flex-end":"flex-start",padding:"3px 0",gap:8,alignItems:"flex-end"}}>
    {!isU&&<div style={{width:26,height:26,borderRadius:99,background:"linear-gradient(135deg,#8B5CF6,#6366F1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Sparkles size={12} style={{color:"white"}}/></div>}
    <div style={{maxWidth:"78%"}}><div style={{padding:"10px 14px",borderRadius:isU?"18px 18px 4px 18px":"18px 18px 18px 4px",background:isU?"linear-gradient(135deg,rgba(139,92,246,.3),rgba(99,102,241,.25))":"rgba(255,255,255,.06)",backdropFilter:isU?"none":"blur(8px)",border:`1px solid ${isU?"rgba(139,92,246,.25)":"rgba(255,255,255,.08)"}`,boxShadow:isU?"none":"inset 0 1px 1px rgba(255,255,255,.06)"}}>{msg.output?<OutputCard output={msg.output}/>:<div>{renderMd(msg.content)}</div>}</div>
      {time&&<div style={{fontSize:9,color:"rgba(255,255,255,.2)",marginTop:2,textAlign:isU?"right":"left",padding:"0 4px"}}>{time}{msg.isVoice&&" · via voice"}</div>}</div>
    {isU&&<div style={{width:26,height:26,borderRadius:99,overflow:"hidden",flexShrink:0,background:"rgba(139,92,246,.3)",display:"flex",alignItems:"center",justifyContent:"center"}}>{userPhoto?<img src={userPhoto} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<User size={12} style={{color:"rgba(255,255,255,.6)"}}/>}</div>}
  </div>)}

function Typing(){return(<div style={{display:"flex",justifyContent:"flex-start",padding:"3px 0",gap:8,alignItems:"flex-end"}}><div style={{width:26,height:26,borderRadius:99,background:"linear-gradient(135deg,#8B5CF6,#6366F1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Sparkles size={12} style={{color:"white"}}/></div><div style={{padding:"12px 18px",borderRadius:"18px 18px 18px 4px",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",display:"flex",gap:5,alignItems:"center"}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:99,background:"rgba(139,92,246,.6)",animation:`mp 1.4s ease-in-out ${i*.2}s infinite`}}/>)}</div></div>)}

// ═══════════════════════════════════════════════════════════════════════════
// VOICE MODE SELECTOR
// ═══════════════════════════════════════════════════════════════════════════
function VoiceMode({mode,setMode}){const modes=[{k:"chat",i:MessageSquare,l:"Chat"},{k:"push",i:Hand,l:"Push to Talk"},{k:"live",i:Radio,l:"Live"}];
  return(<div style={{display:"flex",gap:4,padding:6,background:"rgba(0,0,0,.3)",borderRadius:14}}>{modes.map(m=>{const a=mode===m.k;const I=m.i;return(<button key={m.k} onClick={()=>setMode(m.k)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"8px 10px",borderRadius:10,border:"none",cursor:"pointer",background:a?"rgba(139,92,246,.25)":"transparent",color:a?"rgba(139,92,246,.95)":"rgba(255,255,255,.35)",fontSize:11,fontWeight:a?600:400,transition:"all .2s",minHeight:44}}><I size={14}/>{m.l}</button>)})}</div>)}

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN — v1.1.3-P1-S1: Fixed JSON parsing
// ═══════════════════════════════════════════════════════════════════════════
function Login({onLogin}){
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState(null);
  const[greeting,setGreeting]=useState({greeting:"ABA",context:"A Better AI",proactive:null});
  
  useEffect(()=>{
    // v1.2.2: DAWN greeting - but don't let stale/long data break UI
    getDawnGreeting("guest","").then(g=>{
      if(g){
        // Truncate greeting if too long
        const safeGreeting = {
          greeting: (g.greeting || "ABA").substring(0, 100),
          context: (g.context || "").substring(0, 80),
          proactive: g.proactive ? g.proactive.substring(0, 150) : null
        };
        setGreeting(safeGreeting);
      }
    }).catch(()=>{});
  },[]);

  const go=async()=>{setLoading(true);setError(null);try{const result=await signInGoogle();onLogin(result.user)}catch(e){setError(e.message)}finally{setLoading(false)}};

  return(<div style={{position:"fixed",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#08080d",fontFamily:"'SF Pro Display',-apple-system,sans-serif",overflow:"auto"}}>
    <div style={{position:"absolute",inset:0,backgroundImage:`url(${BG.eventHorizon.u})`,backgroundSize:"cover",backgroundPosition:"center",filter:"brightness(.3) saturate(.6)"}}/>
    <div style={{position:"relative",zIndex:2,textAlign:"center",maxWidth:360,padding:"24px",margin:"auto"}}>
      <div style={{marginBottom:24}}><Blob state="idle" size={100}/></div>
      <h1 style={{color:"white",fontSize:24,fontWeight:700,margin:"0 0 8px",background:"linear-gradient(135deg,#8B5CF6,#6366F1,#EC4899)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{greeting.greeting||"ABA"}</h1>
      <p style={{color:"rgba(255,255,255,.6)",fontSize:13,margin:"0 0 16px",lineHeight:1.4,maxHeight:60,overflow:"hidden"}}>{greeting.context||""}</p>
      {greeting.proactive&&<div style={{background:"rgba(139,92,246,.1)",border:"1px solid rgba(139,92,246,.2)",borderRadius:10,padding:"8px 12px",marginBottom:16,textAlign:"left",maxHeight:80,overflow:"hidden"}}>
        <p style={{color:"rgba(139,92,246,.9)",fontSize:11,margin:0,lineHeight:1.4}}>{greeting.proactive}</p>
      </div>}
      <button onClick={go} disabled={loading} style={{width:"100%",padding:"14px 20px",borderRadius:14,border:"1px solid rgba(255,255,255,.1)",cursor:loading?"wait":"pointer",background:loading?"rgba(255,255,255,.05)":"linear-gradient(135deg,rgba(139,92,246,.3),rgba(99,102,241,.25))",color:"white",fontSize:15,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:10,boxShadow:"0 4px 20px rgba(139,92,246,.2)",minHeight:52}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        {loading?"Signing in...":"Sign in with Google"}
      </button>
      {error&&<p style={{color:"#EF4444",fontSize:12,marginTop:12}}>{error}</p>}
      <p style={{color:"rgba(255,255,255,.15)",fontSize:10,marginTop:20}}>v2.0.0</p>
    </div>
  </div>)}

// ═══════════════════════════════════════════════════════════════════════════
// SIDEBAR — v1.1.3-P1-S4: Delete, Archive, Search
// ═══════════════════════════════════════════════════════════════════════════
function Sidebar({open,convos,activeId,onSelect,onCreate,onClose,onDelete,onArchive,user}){
  const[search,setSearch]=useState("");
  const[showArchived,setShowArchived]=useState(false);
  
  if(!open)return null;
  
  const filtered = convos.filter(c=>{
    const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase());
    const matchArchive = showArchived ? c.archived : !c.archived;
    return matchSearch && matchArchive;
  });
  const solo=filtered.filter(c=>!c.shared);
  const shared=filtered.filter(c=>c.shared);
  
  return(<div style={{position:"fixed",inset:0,zIndex:80,display:"flex"}}><div style={{width:300,height:"100%",background:"rgba(10,8,20,.97)",backdropFilter:"blur(24px)",borderRight:"1px solid rgba(139,92,246,.12)",display:"flex",flexDirection:"column",padding:"16px 12px"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,padding:"0 4px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:28,height:28,borderRadius:99,overflow:"hidden",background:"rgba(139,92,246,.3)",display:"flex",alignItems:"center",justifyContent:"center"}}>{user?.photoURL?<img src={user.photoURL} alt="" style={{width:"100%",height:"100%"}}/>:<User size={14} style={{color:"rgba(255,255,255,.6)"}}/>}</div><span style={{color:"rgba(255,255,255,.8)",fontSize:13,fontWeight:600}}>{user?.displayName||"User"}</span></div><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.3)",minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center"}}><X size={18}/></button></div>
    
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"rgba(255,255,255,.05)",borderRadius:10,marginBottom:12,border:"1px solid rgba(255,255,255,.06)"}}>
      <Search size={14} style={{color:"rgba(255,255,255,.3)"}}/>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search chats..." style={{flex:1,background:"none",border:"none",outline:"none",color:"rgba(255,255,255,.8)",fontSize:12}}/>
    </div>
    
    <button onClick={()=>{onCreate();onClose()}} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:12,border:"1px solid rgba(139,92,246,.2)",background:"rgba(139,92,246,.08)",color:"rgba(139,92,246,.9)",cursor:"pointer",fontWeight:600,fontSize:13,marginBottom:8,minHeight:44}}><Plus size={16}/>New Chat</button>
    
    <button onClick={()=>setShowArchived(!showArchived)} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:"none",border:"none",cursor:"pointer",color:showArchived?"rgba(139,92,246,.8)":"rgba(255,255,255,.3)",fontSize:11,marginBottom:8}}>
      <Archive size={12}/>{showArchived?"Hide Archived":"Show Archived"}
    </button>
    
    <div style={{flex:1,overflowY:"auto"}}>
      {solo.length>0&&<><div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",marginBottom:4}}><Lock size={11} style={{color:"rgba(255,255,255,.25)"}}/><span style={{color:"rgba(255,255,255,.3)",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Solo</span></div>
      {solo.map(c=>(<div key={c.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:10,background:c.id===activeId?"rgba(139,92,246,.15)":"transparent",marginBottom:2}}>
        <button onClick={()=>{onSelect(c.id);onClose()}} style={{flex:1,display:"flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:"pointer",color:c.id===activeId?"rgba(255,255,255,.9)":"rgba(255,255,255,.5)",fontSize:12,textAlign:"left",padding:0}}>
          <MessageSquare size={14} style={{flexShrink:0,opacity:.5}}/>
          <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title}</span>
        </button>
        <button onClick={()=>onArchive(c.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.2)",padding:4,minWidth:28,minHeight:28,display:"flex",alignItems:"center",justifyContent:"center"}}><Archive size={12}/></button>
        <button onClick={()=>onDelete(c.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(239,68,68,.4)",padding:4,minWidth:28,minHeight:28,display:"flex",alignItems:"center",justifyContent:"center"}}><Trash2 size={12}/></button>
      </div>))}</>}
      
      {shared.length>0&&<><div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",marginTop:12,marginBottom:4}}><Users size={11} style={{color:"rgba(255,255,255,.25)"}}/><span style={{color:"rgba(255,255,255,.3)",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Shared</span></div>
      {shared.map(c=>(<div key={c.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:10,background:c.id===activeId?"rgba(139,92,246,.15)":"transparent",marginBottom:2}}>
        <button onClick={()=>{onSelect(c.id);onClose()}} style={{flex:1,display:"flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:"pointer",color:c.id===activeId?"rgba(255,255,255,.9)":"rgba(255,255,255,.5)",fontSize:12,textAlign:"left",padding:0}}>
          <Users size={14} style={{flexShrink:0,opacity:.5}}/>
          <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title}</span>
        </button>
        <button onClick={()=>onArchive(c.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.2)",padding:4}}><Archive size={12}/></button>
        <button onClick={()=>onDelete(c.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(239,68,68,.4)",padding:4}}><Trash2 size={12}/></button>
      </div>))}</>}
      
      {filtered.length===0&&<div style={{padding:24,textAlign:"center",color:"rgba(255,255,255,.3)",fontSize:12}}>{search?"No chats match search":"No chats yet"}</div>}
    </div>
  </div><div onClick={onClose} style={{flex:1,background:"rgba(0,0,0,.4)"}}/></div>)}

// ═══════════════════════════════════════════════════════════════════════════
// PROACTIVE QUEUE
// ═══════════════════════════════════════════════════════════════════════════
function Queue({open,onToggle,items}){
  const iconMap={briefing:Bell,email:Mail,meeting:Calendar,deadline:AlertTriangle,followup:Clock};const pColors={critical:"#EF4444",high:"#F59E0B",medium:"#3B82F6",low:"#6B7280"};
  if(!open)return(<button onClick={onToggle} style={{position:"fixed",bottom:80,right:14,width:48,height:48,borderRadius:99,background:items.length>0?"linear-gradient(135deg,#8B5CF6,#3B82F6)":"rgba(255,255,255,.08)",border:"none",boxShadow:"0 4px 20px rgba(0,0,0,.3)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",zIndex:50,minWidth:48,minHeight:48}}><Bell size={20}/>{items.length>0&&<div style={{position:"absolute",top:-2,right:-2,width:20,height:20,borderRadius:99,background:"#EF4444",color:"#fff",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center"}}>{items.length}</div>}</button>);
  return(<div style={{position:"fixed",bottom:80,right:14,width:340,maxHeight:420,background:"rgba(12,10,24,.97)",backdropFilter:"blur(20px)",borderRadius:16,border:"1px solid rgba(139,92,246,.25)",boxShadow:"0 20px 40px rgba(0,0,0,.4)",overflow:"hidden",zIndex:50,display:"flex",flexDirection:"column"}}>
    <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(139,92,246,.15)",display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(135deg,rgba(139,92,246,.08),rgba(59,130,246,.04))"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}><Bell size={16} style={{color:"#8B5CF6"}}/><span style={{color:"white",fontWeight:600,fontSize:14}}>What ABA Cooked</span><span style={{background:"rgba(139,92,246,.25)",padding:"1px 8px",borderRadius:10,fontSize:11,color:"#C4B5FD"}}>{items.length}</span></div>
      <button onClick={onToggle} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.4)",minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center"}}><X size={16}/></button>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:8}}>{items.length===0?<div style={{padding:24,textAlign:"center",color:"rgba(255,255,255,.3)",fontSize:13}}>All clear. ABA is keeping watch.</div>:items.map((item,idx)=>{const I=iconMap[item.type]||Bell;const col=pColors[item.priority]||"#6B7280";return(<div key={idx} style={{padding:"10px 12px",borderRadius:12,border:`1px solid ${col}25`,background:`${col}08`,marginBottom:6,display:"flex",gap:10,alignItems:"flex-start"}}><div style={{width:28,height:28,borderRadius:8,background:`${col}20`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><I size={14} style={{color:col}}/></div><div style={{flex:1}}><div style={{color:"rgba(255,255,255,.85)",fontSize:12,fontWeight:600}}>{item.title}</div><div style={{color:"rgba(255,255,255,.4)",fontSize:11,marginTop:2}}>{item.summary}</div></div></div>)})}</div>
  </div>)}

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════
function SettingsDrawer({open,onClose,bg,setBg,onLogout}){if(!open)return null;
  return(<div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"}}><div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(0,0,0,.6)"}}/><div style={{position:"relative",zIndex:101,width:"100%",maxWidth:480,background:"rgba(12,10,24,.98)",backdropFilter:"blur(24px)",border:"1px solid rgba(255,255,255,.08)",borderRadius:"24px 24px 0 0",padding:"24px 20px calc(32px + env(safe-area-inset-bottom))",maxHeight:"75vh",overflowY:"auto"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><span style={{color:"rgba(255,255,255,.9)",fontSize:16,fontWeight:700}}>Settings</span><button onClick={onClose} style={{background:"rgba(255,255,255,.08)",border:"none",color:"white",width:32,height:32,borderRadius:99,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",minWidth:44,minHeight:44}}><X size={16}/></button></div>
    <p style={{color:"rgba(255,255,255,.35)",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>Background</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>{Object.entries(BG).map(([k,{u,l}])=>(<button key={k} onClick={()=>{setBg(k);onClose()}} style={{position:"relative",aspectRatio:"16/10",borderRadius:10,overflow:"hidden",border:bg===k?"2px solid rgba(139,92,246,.8)":"2px solid rgba(255,255,255,.06)",cursor:"pointer",background:"#111",padding:0,boxShadow:bg===k?"0 0 14px rgba(139,92,246,.4)":"none",minHeight:44}}><img src={u} alt={l} style={{width:"100%",height:"100%",objectFit:"cover",opacity:.8}}/><span style={{position:"absolute",bottom:0,left:0,right:0,padding:"10px 4px 4px",background:"linear-gradient(transparent,rgba(0,0,0,.8))",color:bg===k?"rgba(139,92,246,.95)":"rgba(255,255,255,.6)",fontSize:8,fontWeight:600,textAlign:"center"}}>{l}</span></button>))}</div>
    <button onClick={onLogout} style={{display:"flex",alignItems:"center",gap:8,width:"100%",marginTop:20,padding:"12px 16px",borderRadius:12,border:"1px solid rgba(239,68,68,.2)",background:"rgba(239,68,68,.06)",color:"rgba(239,68,68,.7)",cursor:"pointer",fontSize:13,fontWeight:600,minHeight:48}}><LogOut size={16}/>Sign Out</button>
    <div style={{marginTop:16,padding:"12px 14px",background:"rgba(139,92,246,.05)",borderRadius:12,border:"1px solid rgba(139,92,246,.1)"}}><p style={{color:"rgba(139,92,246,.6)",fontSize:10,fontWeight:600,margin:0}}>MyABA v2.0.0 - ABABASE</p></div>
  </div></div>)}

// ═══════════════════════════════════════════════════════════════════════════
// MYABA — v1.1.3-P1: All Phase 1 fixes applied
// ═══════════════════════════════════════════════════════════════════════════
export default function MyABA(){
  const[user,setUser]=useState(null);const[authLoading,setAuthLoading]=useState(true);
  const[convos,setConvos]=useState([]);const[activeId,setActiveId]=useState(null);
  const activeConv=convos.find(c=>c.id===activeId);const messages=activeConv?.messages||[];
  const[input,setInput]=useState("");const[abaState,setAbaState]=useState("idle");
  const[isTyping,setIsTyping]=useState(false);
  
  // v1.1.3-P1-S3: Settings from localStorage
  const[bg,setBg]=useState(()=>{try{return localStorage.getItem("myaba_bg")||"eventHorizon"}catch{return "eventHorizon"}});
  const[voiceOut,setVoiceOut]=useState(()=>{try{return localStorage.getItem("myaba_voiceOut")!=="false"}catch{return true}});
  const[voiceMode,setVoiceMode]=useState(()=>{try{return localStorage.getItem("myaba_voiceMode")||"chat"}catch{return "chat"}});
  
  const[settingsOpen,setSettingsOpen]=useState(false);const[sidebarOpen,setSidebarOpen]=useState(false);
  const[queueOpen,setQueueOpen]=useState(false);
  const[isListening,setIsListening]=useState(false);
  const[liveActive,setLiveActive]=useState(false);
  const[proactiveItems,setProactiveItems]=useState([]);
  const[toast,setToast]=useState(null);
  const[online,setOnline]=useState(navigator.onLine);
  const scrollRef=useRef(null);const recorderRef=useRef(null);const liveRef=useRef(false);

  // v1.2.0: Track online/offline status
  useEffect(()=>{
    const handleOnline=()=>setOnline(true);
    const handleOffline=()=>setOnline(false);
    window.addEventListener("online",handleOnline);
    window.addEventListener("offline",handleOffline);
    return()=>{window.removeEventListener("online",handleOnline);window.removeEventListener("offline",handleOffline)};
  },[]);

  // v1.2.0: Save settings to localStorage
  useEffect(()=>{try{localStorage.setItem("myaba_bg",bg)}catch{}},[bg]);
  useEffect(()=>{try{localStorage.setItem("myaba_voiceOut",String(voiceOut))}catch{}},[voiceOut]);
  useEffect(()=>{try{localStorage.setItem("myaba_voiceMode",voiceMode)}catch{}},[voiceMode]);

  useEffect(()=>{const unsub=onAuthStateChanged(auth,(u)=>{setUser(u);setAuthLoading(false)});return()=>unsub()},[]);
  useEffect(()=>{if(scrollRef.current)scrollRef.current.scrollTop=scrollRef.current.scrollHeight},[messages,isTyping]);

  const showToast=useCallback((message,type="info")=>{setToast({message,type})},[]);

  const createConv=useCallback((shared=false)=>{const id=`conv-${Date.now()}`;const conv={id,title:"New Chat",shared,archived:false,messages:[],createdAt:Date.now(),updatedAt:Date.now(),autoNamed:false};setConvos(p=>[conv,...p]);setActiveId(id);return id},[]);
  const addMsg=useCallback((msg)=>{setConvos(p=>p.map(c=>c.id===activeId?{...c,messages:[...c.messages,msg],updatedAt:Date.now()}:c))},[activeId]);

  // v1.2.0: Delete and archive via AIR → Supabase
  const deleteConv=useCallback((id)=>{
    setConvos(p=>p.filter(c=>c.id!==id));
    if(activeId===id){const remaining=convos.filter(c=>c.id!==id);setActiveId(remaining[0]?.id||null)}
    if(user)airDeleteConversation(user.uid,id).catch(()=>{});
  },[activeId,convos,user]);

  const archiveConv=useCallback((id)=>{
    setConvos(p=>p.map(c=>c.id===id?{...c,archived:true}:c));
    if(user)airArchiveConversation(user.uid,id).catch(()=>{});
  },[user]);

  // v1.2.0: Load conversations via AIR → Supabase + DAWN greeting
  useEffect(()=>{
    if(!user)return;
    airLoadConversations(user.uid).then(loaded=>{
      if(loaded&&loaded.length>0){
        setConvos(loaded);
        setActiveId(loaded[0].id);
      }else{
        const id=createConv();
        // Get JARVIS-style welcome from DAWN
        getDawnGreeting(user.uid,user.displayName).then(g=>{
          let welcomeMsg=g.greeting||"";
          if(g.context)welcomeMsg+="\n\n"+g.context;
          if(g.proactive)welcomeMsg+="\n\n"+g.proactive;
          if(welcomeMsg){
            setConvos(p=>p.map(c=>c.id===id?{...c,messages:[{id:"w1",role:"aba",content:welcomeMsg,timestamp:Date.now()}]}:c));
            if(voiceOut){setAbaState("speaking");reachSynthesize(g.greeting).then(url=>{if(url){const a=new Audio(url);a.onended=()=>setAbaState("idle");a.play().catch(()=>setAbaState("idle"))}else setAbaState("idle")})}
          }
        });
      }
    }).catch(()=>{createConv()});
    reachPresence(user.uid).then(d=>{if(d.items)setProactiveItems(d.items)});
  },[user]);

  useEffect(()=>{
    if(!activeConv||activeConv.autoNamed||!user)return;
    if(activeConv.messages.length>=5){
      airNameChat(activeConv.messages,user.uid).then(name=>{
        if(name)setConvos(p=>p.map(c=>c.id===activeId?{...c,title:name,autoNamed:true}:c));
      });
    }
  },[messages.length,activeId]);

  // v1.2.0: Save via AIR → Supabase
  useEffect(()=>{if(user&&activeConv&&activeConv.messages.length>0)airSaveConversation(user.uid,activeConv).catch(()=>{})},[activeConv?.messages?.length]);

  const sendMessage=useCallback(async(text,isVoice=false)=>{
    if(!text.trim())return;
    const userMsg={id:`u-${Date.now()}`,role:"user",content:text.trim(),timestamp:Date.now(),isVoice};
    addMsg(userMsg);setInput("");setIsTyping(true);setAbaState("thinking");
    const data=await airRequest("text",{message:text.trim(),conversationId:activeId},user);
    setIsTyping(false);
    
    if(data.error){
      // v1.2.0: Consumer-ready message (no tech jargon)
      showToast("Taking a moment to reconnect...","offline");
      setAbaState("idle");
      return;
    }
    
    const abaMsg={id:`a-${Date.now()}`,role:"aba",timestamp:Date.now(),content:data.response||data.message||"",output:data.actions?.[0]?{type:data.actions[0].type,title:data.actions[0].title,subtitle:data.actions[0].subtitle,preview:data.actions[0].preview,actions:true}:undefined};
    addMsg(abaMsg);
    if(voiceOut&&abaMsg.content){setAbaState("speaking");const url=await reachSynthesize(abaMsg.content);if(url){const a=new Audio(url);a.onended=()=>{setAbaState("idle");if(liveRef.current)startListening()};a.play().catch(()=>{setAbaState("idle");if(liveRef.current)startListening()})}else{setAbaState("idle");if(liveRef.current)startListening()}}else{setAbaState("idle");if(liveRef.current)startListening()}
  },[activeId,user,voiceOut,addMsg,showToast]);

  const startListening=useCallback(async()=>{
    try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});setIsListening(true);setAbaState("listening");
      const rec=new MediaRecorder(stream,{mimeType:"audio/webm"});const chunks=[];rec.ondataavailable=e=>chunks.push(e.data);
      rec.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());setAbaState("thinking");setIsListening(false);const blob=new Blob(chunks,{type:"audio/webm"});const transcript=await reachTranscribe(blob);if(transcript)sendMessage(transcript,true);else{setAbaState("idle");if(liveRef.current)setTimeout(startListening,500)}};
      recorderRef.current=rec;rec.start();if(voiceMode!=="push")setTimeout(()=>{if(rec.state==="recording")rec.stop()},10000);
    }catch{setIsListening(false);setAbaState("idle");showToast("Could not access your microphone","warning")}
  },[sendMessage,voiceMode,showToast]);

  const stopListening=useCallback(()=>{if(recorderRef.current?.state==="recording")recorderRef.current.stop()},[]);
  const toggleLive=useCallback(()=>{if(liveActive){liveRef.current=false;setLiveActive(false);stopListening();setAbaState("idle")}else{liveRef.current=true;setLiveActive(true);setVoiceMode("live");startListening()}},[liveActive,startListening,stopListening]);
  const handleKey=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage(input)}};

  if(authLoading)return <div style={{position:"fixed",inset:0,background:"#08080d",display:"flex",alignItems:"center",justifyContent:"center"}}><Blob state="thinking" size={100}/></div>;
  if(!user)return <Login onLogin={setUser}/>;

  const sc=abaState==="thinking"?"245,158,11":abaState==="speaking"?"34,197,94":abaState==="listening"?"6,182,212":"139,92,246";
  const bgUrl=BG[bg]?.u||BG.eventHorizon.u;

  return(<div style={{width:"100%",height:"100vh",position:"relative",overflow:"hidden",fontFamily:"'SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",background:"#08080d",paddingTop:"env(safe-area-inset-top)",paddingBottom:"env(safe-area-inset-bottom)"}}>
    <style>{`@keyframes mp{0%,100%{opacity:.3;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}@keyframes mf{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes mb{0%,100%{opacity:.6}50%{opacity:1}}@keyframes ml{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.4)}50%{box-shadow:0 0 0 12px rgba(239,68,68,0)}}*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(139,92,246,.15);border-radius:99px}`}</style>
    <div style={{position:"absolute",inset:0,zIndex:0,backgroundImage:`url(${bgUrl})`,backgroundSize:"cover",backgroundPosition:"center",filter:"brightness(.4) saturate(.7)",transition:"all 1s"}}/>
    <div style={{position:"absolute",inset:0,zIndex:1,background:"radial-gradient(ellipse at center,rgba(0,0,0,0) 0%,rgba(0,0,0,.55) 100%)"}}/>
    <div style={{position:"relative",zIndex:2,display:"flex",flexDirection:"column",height:"100%",maxWidth:480,margin:"0 auto",padding:"0 14px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 2px 4px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>setSidebarOpen(true)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.5)",padding:0,display:"flex",minWidth:44,minHeight:44,alignItems:"center",justifyContent:"center"}}><MessageSquare size={18}/></button>
          <div style={{width:8,height:8,borderRadius:99,background:`rgba(${sc},.9)`,boxShadow:`0 0 10px rgba(${sc},.6)`,animation:"mb 3s ease infinite"}}/>
          <span style={{color:"rgba(255,255,255,.75)",fontSize:14,fontWeight:700,letterSpacing:.5}}>MyABA</span>
          {liveActive&&<span style={{background:"rgba(239,68,68,.2)",color:"#EF4444",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:99,animation:"ml 2s infinite",letterSpacing:1}}>LIVE</span>}
          <span style={{color:"rgba(255,255,255,.2)",fontSize:10}}>{abaState!=="idle"?(abaState==="thinking"?"thinking...":abaState==="speaking"?"speaking...":"listening..."):""}</span>
        </div>
        <div style={{display:"flex",gap:4}}>
          <button onClick={()=>setVoiceOut(!voiceOut)} style={{background:voiceOut?"rgba(139,92,246,.15)":"rgba(255,255,255,.04)",border:`1px solid ${voiceOut?"rgba(139,92,246,.2)":"rgba(255,255,255,.06)"}`,color:voiceOut?"rgba(139,92,246,.85)":"rgba(255,255,255,.3)",borderRadius:99,width:44,height:44,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{voiceOut?<Volume2 size={15}/>:<VolumeX size={15}/>}</button>
          <button onClick={()=>setSettingsOpen(true)} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.06)",color:"rgba(255,255,255,.3)",borderRadius:99,width:44,height:44,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Settings size={15}/></button>
        </div>
      </div>
      <div style={{flexShrink:0,padding:"4px 0"}}><VoiceMode mode={voiceMode} setMode={m=>{setVoiceMode(m);if(m!=="live"&&liveActive){liveRef.current=false;setLiveActive(false);stopListening()}}}/></div>
      <div style={{flexShrink:0,display:"flex",justifyContent:"center",padding:"2px 0",transition:"all .5s"}}><Blob state={abaState} size={messages.length<=1?140:70}/></div>
      <div ref={scrollRef} style={{flex:1,overflowY:"auto",padding:"4px 2px",display:"flex",flexDirection:"column",gap:2,maskImage:"linear-gradient(transparent 0%,black 2%,black 96%,transparent 100%)",WebkitMaskImage:"linear-gradient(transparent 0%,black 2%,black 96%,transparent 100%)"}}>
        {messages.map(msg=><div key={msg.id} style={{animation:"mf .3s ease"}}><Bubble msg={msg} userPhoto={user?.photoURL}/></div>)}
        {isTyping&&<Typing/>}
      </div>
      <div style={{flexShrink:0,padding:"6px 0 14px"}}>
        {voiceMode==="chat"&&<div style={{display:"flex",gap:8,alignItems:"flex-end"}}><div style={{flex:1,display:"flex",alignItems:"center",background:"rgba(255,255,255,.05)",backdropFilter:"blur(12px)",border:"1px solid rgba(255,255,255,.08)",borderRadius:24,padding:"0 6px 0 16px",minHeight:48}}><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey} placeholder="" style={{flex:1,background:"none",border:"none",outline:"none",color:"rgba(255,255,255,.9)",fontSize:14,padding:"12px 0"}}/><button onClick={()=>{if(!isListening)startListening();else stopListening()}} style={{width:44,height:44,borderRadius:99,border:"none",cursor:"pointer",background:isListening?"rgba(6,182,212,.2)":"rgba(255,255,255,.05)",color:isListening?"rgba(6,182,212,.95)":"rgba(255,255,255,.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{isListening?<MicOff size={16}/>:<Mic size={16}/>}</button></div><button onClick={()=>sendMessage(input)} disabled={!input.trim()} style={{width:48,height:48,borderRadius:99,border:"none",cursor:input.trim()?"pointer":"default",background:input.trim()?"rgba(139,92,246,.4)":"rgba(255,255,255,.04)",color:input.trim()?"white":"rgba(255,255,255,.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:input.trim()?"0 0 16px rgba(139,92,246,.25)":"none"}}><Send size={18}/></button></div>}
        {voiceMode==="push"&&<div style={{display:"flex",justifyContent:"center"}}><button onMouseDown={startListening} onMouseUp={stopListening} onTouchStart={startListening} onTouchEnd={stopListening} style={{width:80,height:80,borderRadius:99,border:`3px solid ${isListening?"rgba(6,182,212,.6)":"rgba(139,92,246,.3)"}`,background:isListening?"rgba(6,182,212,.15)":"rgba(139,92,246,.08)",color:isListening?"rgba(6,182,212,.95)":"rgba(139,92,246,.7)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,boxShadow:isListening?"0 0 30px rgba(6,182,212,.3)":"0 0 20px rgba(139,92,246,.15)"}}><Hand size={24}/><span style={{fontSize:9,fontWeight:600}}>{isListening?"Release":"Hold"}</span></button></div>}
        {voiceMode==="live"&&<div style={{display:"flex",justifyContent:"center"}}><button onClick={toggleLive} style={{width:80,height:80,borderRadius:99,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,border:`3px solid ${liveActive?"rgba(239,68,68,.6)":"rgba(139,92,246,.3)"}`,background:liveActive?"rgba(239,68,68,.12)":"rgba(139,92,246,.08)",color:liveActive?"rgba(239,68,68,.9)":"rgba(139,92,246,.7)",boxShadow:liveActive?"0 0 30px rgba(239,68,68,.25)":"0 0 20px rgba(139,92,246,.15)",animation:liveActive?"ml 2s infinite":"none"}}><Radio size={24}/><span style={{fontSize:9,fontWeight:600}}>{liveActive?"End":"Go Live"}</span></button></div>}
      </div>
    </div>
    <Sidebar open={sidebarOpen} convos={convos} activeId={activeId} onSelect={setActiveId} onCreate={()=>createConv()} onClose={()=>setSidebarOpen(false)} onDelete={deleteConv} onArchive={archiveConv} user={user}/>
    <Queue open={queueOpen} onToggle={()=>setQueueOpen(!queueOpen)} items={proactiveItems}/>
    <SettingsDrawer open={settingsOpen} onClose={()=>setSettingsOpen(false)} bg={bg} setBg={setBg} onLogout={async()=>{await signOutUser();setUser(null);setConvos([]);setActiveId(null)}}/>
    <ConnectionStatus online={online}/>
    {toast&&<Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)}/>}
  </div>)}
