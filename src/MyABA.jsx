// ⬡B:myaba.genesis:APP:v2.13.0:20260305⬡
// MyABA v2.13.0 - PHASE 9 FIXES: Voice + Mobile Keyboard
// ════════════════════════════════════════════════════════════════════════════
// SPURTS IMPLEMENTED:
//   1. Split Screen: Desktop=chat+talk panel, Mobile=chat+floating orb
//   2. Talk to ABA: Renamed from "Live" mode
//   3. Private/Shared Chats: Email-based sharing
//   4. Projects: Project folders with files
//   5. Attachments: File/image upload support
//   6. Voice Responses: ElevenLabs TTS (FIXED in v2.13.0)
//   7. F5 Briefing Mode: Dedicated /api/briefing endpoint
//   8. F6 Approve Mode: Dedicated /api/pending-approvals + /api/approve-action
//   9. F7 Settings: Voice, notifications, backgrounds, user profile
//   10. F8 Push Notifications: Web Push API + toggle in settings
// v2.13.0 FIXES:
//   - Voice transcription fixed (raw audio blob handling)
//   - Voice synthesis fixed (data URL return)
//   - Mobile keyboard viewport handling improved
//   - Input fontSize increased to 16px to prevent iOS zoom
//   - Added onFocus scroll for mobile keyboard
// ARCHITECTURE:
//   - Firebase = AUTH ONLY (Google sign-in)
//   - Conversations = AIR → Supabase (NOT Firebase Firestore)
//   - Greetings = AGENT DAWN (Dynamic, JARVIS-style, contextual)
//   - ABA = Life assistant (not AI/personal assistant)
// ════════════════════════════════════════════════════════════════════════════
// ROUTING: USER → MyABA → ABABASE → FAT PROMPT (88 agents) → Response
// This file is SKIN. It has NO brain. ZERO hardcoded content.

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Mic, MicOff, Volume2, VolumeX, MessageSquare, Radio, Hand,
  Settings, X, Plus, Bell, Mail, Calendar, Phone, Headphones,
  MessageCircle, Zap, Activity, Clock, CheckCircle, AlertTriangle,
  Sparkles, FileText, Eye, ChevronRight, User, LogOut, Users, Lock,
  Trash2, Archive, Search, WifiOff, Wifi, RefreshCw, Share2, Paperclip,
  FolderOpen, Image, File, FolderPlus, MoreVertical, Edit2, Copy
} from "lucide-react";
import { auth, signInGoogle, signOutUser } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";

// ═══════════════════════════════════════════════════════════════════════════
// SPURT 1: DEVICE DETECTION — Desktop vs Mobile
// ═══════════════════════════════════════════════════════════════════════════
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

// ═══════════════════════════════════════════════════════════════════════════
// ABABASE — Fat Prompt Architecture. Every interaction. ZERO local thinking.
// ═══════════════════════════════════════════════════════════════════════════
// ⬡B:MYABA:ABABASE:v2.6.0:20260228⬡
// ABABASE = Fat Prompt Architecture (87 agents, HAM identity)
const ABABASE = "https://abacia-services.onrender.com";

// v1.2.0: Check online status
function isOnline() { return navigator.onLine; }

// v1.2.0: AIR with retry + offline awareness
async function airRequest(type, payload = {}, userId = "brandon", maxRetries = 3) {
  if (!isOnline()) {
    return { response: null, offline: true, queued: true };
  }
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // ⬡B:MYABA:ABABASE_WIRED:v2.0:20260227⬡
      // Chat uses ababase backend (fat context, exact contacts)
      // Voice/presence still use original endpoints
      const res = await fetch(`${ABABASE}/api/air/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: payload.message || "", type, userId, channel: "myaba", context: { ...payload, timestamp: Date.now() } }),
      });
      if (!res.ok) throw new Error(`REACH ${res.status}`);
      return await res.json();
    } catch (e) {
      lastError = e;
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  return { response: null, error: true, errorMessage: lastError?.message };
}

// v2.8.0: Conversations via direct Supabase endpoints (not AIR)
async function saveConversation(userId, conv) {
  try {
    const res = await fetch(`${ABABASE}/api/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        id: conv.id, 
        userId, 
        title: conv.title, 
        messages: conv.messages,
        shared: conv.shared,
        projectId: conv.projectId
      })
    });
    return res.ok ? await res.json() : { error: true };
  } catch { return { error: true }; }
}

async function loadConversations(userId) {
  try {
    const res = await fetch(`${ABABASE}/api/conversations?userId=${userId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.conversations || []).map(c => ({
      id: c.id,
      title: c.title,
      messages: c.messages || [],
      shared: c.shared || false,
      archived: c.archived || false,
      createdAt: new Date(c.created_at).getTime(),
      updatedAt: new Date(c.updated_at).getTime(),
      projectId: c.project_id
    }));
  } catch { return []; }
}

async function deleteConversation(userId, convId) {
  try {
    await fetch(`${ABABASE}/api/conversations/${convId}?userId=${userId}`, { method: "DELETE" });
    return { success: true };
  } catch { return { error: true }; }
}

async function archiveConversation(userId, convId) {
  try {
    await fetch(`${ABABASE}/api/conversations/${convId}/archive?userId=${userId}`, { method: "PATCH" });
    return { success: true };
  } catch { return { error: true }; }
}

// SPURT 3: Share chat by email
async function airShareChat(userId, convId, emails) {
  return airRequest("share_chat", { conversationId: convId, emails }, userId);
}

// SPURT 4: Project functions
async function airLoadProjects(userId) {
  return airRequest("load_projects", {}, userId);
}
async function airCreateProject(userId, name) {
  return airRequest("create_project", { name }, userId);
}
async function airAddProjectFile(userId, projectId, file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("projectId", projectId);
  formData.append("userId", userId);
  try {
    const res = await fetch(`${ABABASE}/api/project/upload`, { method: "POST", body: formData });
    return res.ok ? await res.json() : { error: true };
  } catch { return { error: true }; }
}

// SPURT 5: Upload attachment to chat
async function uploadAttachment(file) {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const res = await fetch(`${ABABASE}/api/attachments/upload`, { method: "POST", body: formData });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

async function reachTranscribe(audioBlob) {
  try {
    // Send raw audio blob with proper content type
    const res = await fetch(`${ABABASE}/api/voice/transcribe`, { 
      method: "POST", 
      headers: { "Content-Type": "audio/webm" },
      body: audioBlob 
    });
    if (!res.ok) return null;
    return (await res.json()).transcript || null;
  } catch { return null; }
}

async function reachSynthesize(text) {
  try {
    const res = await fetch(`${ABABASE}/api/voice/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voiceId: "bcbkbYJpNzQGHml4XFrp", model: "eleven_flash_v2_5" }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url || null; // Returns data URL from backend
  } catch { return null; }
}

async function reachPresence(userId) {
  try {
    const res = await fetch(`${ABABASE}/api/presence?userId=${userId}`);
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
  
  // Fallback - JARVIS style with contextual structure (even without full data)
  const hour = new Date().getHours();
  const timeGreeting = hour < 5 ? "Late night" : hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : hour < 21 ? "Evening" : "Late night";
  const firstName = userName?.split(' ')[0] || "there";
  // JARVIS greeting = time + name + pending count + key update + personal reminder
  // Example: "Morning Brandon. 3 things pending, 1 conflict to decide, Brooke replied about Florida. Also - BJ birthday in 9 days."
  return {
    greeting: `${timeGreeting}, ${firstName}.`,
    context: "Checking your calendar, emails, and pending items...",
    proactive: null
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// F8: PUSH NOTIFICATIONS - Subscribe to ABA alerts
// ═══════════════════════════════════════════════════════════════════════════
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

async function subscribeToPush(userId) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[PUSH] Not supported');
      return null;
    }
    
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[PUSH] Permission denied');
      return null;
    }
    
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    
    // Send subscription to backend
    await fetch('https://abacia-services.onrender.com/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, subscription: subscription.toJSON() })
    });
    
    console.log('[PUSH] Subscribed:', subscription.endpoint.substring(0, 50));
    return subscription;
  } catch (e) {
    console.error('[PUSH] Subscribe failed:', e);
    return null;
  }
}

async function unsubscribeFromPush(userId) {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      await fetch('https://abacia-services.onrender.com/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
    }
  } catch (e) {
    console.error('[PUSH] Unsubscribe failed:', e);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
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
// F5: BRIEFING MODE - What happened, what's pending, what she handled
// ═══════════════════════════════════════════════════════════════════════════
async function fetchBriefing(userId) {
  try {
    // Use dedicated briefing endpoint
    const response = await fetch(`https://abacia-services.onrender.com/api/briefing?userId=${encodeURIComponent(userId)}`);
    if (!response.ok) throw new Error('Briefing fetch failed');
    const data = await response.json();
    return data;
  } catch (e) {
    console.error("[BRIEFING] Fetch failed:", e);
    // Fallback to AIR
    try {
      const result = await airRequest("briefing", {
        message: "Generate my briefing. What happened today? What's pending? What did you handle autonomously?"
      }, userId);
      if (result.response) {
        return { summary: result.response, handled: [], pending: [], upcoming: [] };
      }
    } catch {}
    return null;
  }
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
function renderMd(text){if(!text)return null;let c=text.replace(/^\[(warm|firm|thoughtful|gentle|encouraging|excited|celebratory|annoyed)\]\s*/i,"");const lines=c.split("\n"),blocks=[];let i=0;while(i<lines.length){const ln=lines[i];if(ln.startsWith("```")){const lang=ln.slice(3).trim();const code=[];i++;while(i<lines.length&&!lines[i].startsWith("```")){code.push(lines[i]);i++}i++;const codeText=code.join("\n");blocks.push(<div key={`c${blocks.length}`} style={{position:"relative",margin:"8px 0"}}><div style={{position:"absolute",top:0,left:0,right:0,height:28,background:"rgba(139,92,246,.12)",borderRadius:"12px 12px 0 0",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 12px"}}><span style={{color:"rgba(139,92,246,.7)",fontSize:10,fontWeight:600,textTransform:"uppercase"}}>{lang||"code"}</span><button onClick={()=>navigator.clipboard.writeText(codeText)} style={{background:"none",border:"none",color:"rgba(255,255,255,.4)",cursor:"pointer",fontSize:9,padding:"2px 6px",borderRadius:4}}><Copy size={10}/></button></div><pre style={{background:"rgba(0,0,0,.5)",border:"1px solid rgba(139,92,246,.15)",borderRadius:12,padding:"36px 14px 12px",margin:0,overflowX:"auto",fontSize:12,lineHeight:1.6,fontFamily:"'SF Mono',Menlo,monospace"}}><code style={{color:"rgba(134,239,172,.85)"}}>{codeText}</code></pre></div>);continue}if(ln.startsWith("### "))blocks.push(<p key={`h${i}`} style={{fontWeight:600,color:"rgba(255,255,255,.8)",fontSize:13,margin:"10px 0 4px"}}>{ln.slice(4)}</p>);else if(ln.startsWith("## "))blocks.push(<p key={`h${i}`} style={{fontWeight:700,color:"rgba(255,255,255,.9)",fontSize:14,margin:"12px 0 4px"}}>{ln.slice(3)}</p>);else if(ln.startsWith("- ")||ln.startsWith("* "))blocks.push(<p key={`li${i}`} style={{paddingLeft:14,color:"rgba(255,255,255,.75)",fontSize:13,margin:"3px 0",position:"relative"}}><span style={{position:"absolute",left:0,color:"rgba(139,92,246,.6)"}}>•</span>{renderInline(ln.slice(2))}</p>);else if(ln.trim())blocks.push(<p key={`p${i}`} style={{color:"rgba(255,255,255,.85)",fontSize:13,margin:"4px 0",lineHeight:1.6}}>{renderInline(ln)}</p>);i++}return blocks}

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
function Bubble({msg,userPhoto,onSpeak}){const isU=msg.role==="user";const time=msg.timestamp?new Date(msg.timestamp).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}):"";
  return(<div style={{display:"flex",justifyContent:isU?"flex-end":"flex-start",padding:"4px 0",gap:10,alignItems:"flex-end"}}>
    {!isU&&<div style={{width:28,height:28,borderRadius:99,background:"linear-gradient(135deg,#8B5CF6,#6366F1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 2px 8px rgba(139,92,246,.3)"}}><svg width="14" height="14" viewBox="0 0 100 100"><text x="50" y="72" textAnchor="middle" fill="white" fontSize="65" fontWeight="700" fontFamily="SF Pro Display,system-ui">A</text></svg></div>}
    <div style={{maxWidth:"80%"}}><div style={{padding:"12px 16px",borderRadius:isU?"20px 20px 6px 20px":"20px 20px 20px 6px",background:isU?"linear-gradient(135deg,rgba(139,92,246,.35),rgba(99,102,241,.3))":"rgba(255,255,255,.08)",backdropFilter:"blur(12px)",border:`1px solid ${isU?"rgba(139,92,246,.3)":"rgba(255,255,255,.1)"}`,boxShadow:isU?"0 4px 16px rgba(139,92,246,.15)":"inset 0 1px 1px rgba(255,255,255,.08), 0 4px 12px rgba(0,0,0,.15)"}}>{msg.output?<OutputCard output={msg.output}/>:<div>{renderMd(msg.content)}</div>}
      {!isU&&msg.content&&onSpeak&&<button onClick={()=>onSpeak(msg.content)} style={{marginTop:10,display:"flex",alignItems:"center",gap:5,padding:"6px 10px",borderRadius:10,border:"1px solid rgba(139,92,246,.2)",background:"rgba(139,92,246,.08)",color:"rgba(139,92,246,.8)",cursor:"pointer",fontSize:11,fontWeight:500,transition:"all .2s"}}><Volume2 size={12}/>Play</button>}
    </div>
      {time&&<div style={{fontSize:10,color:"rgba(255,255,255,.25)",marginTop:4,textAlign:isU?"right":"left",padding:"0 4px"}}>{time}{msg.isVoice&&" · voice"}{msg.attachments&&` · ${msg.attachments.length} file${msg.attachments.length>1?"s":""}`}</div>}</div>
    {isU&&<div style={{width:28,height:28,borderRadius:99,overflow:"hidden",flexShrink:0,background:"linear-gradient(135deg,rgba(139,92,246,.4),rgba(99,102,241,.3))",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(139,92,246,.2)"}}>{userPhoto?<img src={userPhoto} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<User size={13} style={{color:"rgba(255,255,255,.7)"}}/>}</div>}
  </div>)}

function Typing(){return(<div style={{display:"flex",justifyContent:"flex-start",padding:"3px 0",gap:8,alignItems:"flex-end"}}><div style={{width:26,height:26,borderRadius:99,background:"linear-gradient(135deg,#8B5CF6,#6366F1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><svg width="14" height="14" viewBox="0 0 100 100"><text x="50" y="72" textAnchor="middle" fill="white" fontSize="65" fontWeight="700" fontFamily="SF Pro Display,system-ui">A</text></svg></div><div style={{padding:"12px 18px",borderRadius:"18px 18px 18px 4px",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",display:"flex",gap:5,alignItems:"center"}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:99,background:"rgba(139,92,246,.6)",animation:`mp 1.4s ease-in-out ${i*.2}s infinite`}}/>)}</div></div>)}

// ═══════════════════════════════════════════════════════════════════════════
// VOICE MODE SELECTOR
// ═══════════════════════════════════════════════════════════════════════════
// SPURT 2: Talk to ABA (renamed from Live)
function VoiceMode({mode,setMode}){const modes=[{k:"chat",i:MessageSquare,l:"Chat with ABA"},{k:"talk",i:Radio,l:"Talk to ABA"}];
  return(<div style={{display:"flex",gap:4,padding:6,background:"rgba(0,0,0,.3)",borderRadius:14}}>{modes.map(m=>{const a=mode===m.k;const I=m.i;return(<button key={m.k} onClick={()=>setMode(m.k)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"8px 10px",borderRadius:10,border:"none",cursor:"pointer",background:a?"rgba(139,92,246,.25)":"transparent",color:a?"rgba(139,92,246,.95)":"rgba(255,255,255,.35)",fontSize:11,fontWeight:a?600:400,transition:"all .2s",minHeight:44}}><I size={14}/>{m.l}</button>)})}</div>)}

// ═══════════════════════════════════════════════════════════════════════════
// F5: MAIN TAB SWITCHER - Chat | Briefing | Approve
// ═══════════════════════════════════════════════════════════════════════════
function MainTabSwitcher({tab,setTab}){
  const tabs=[
    {k:"chat",i:MessageSquare,l:"Chat"},
    {k:"briefing",i:Bell,l:"Briefing"},
    {k:"approve",i:CheckCircle,l:"Approve"}
  ];
  return(<div style={{display:"flex",gap:2,padding:4,background:"rgba(0,0,0,.4)",borderRadius:12,marginBottom:8}}>
    {tabs.map(t=>{const a=tab===t.k;const I=t.i;return(
      <button key={t.k} onClick={()=>setTab(t.k)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"10px 8px",borderRadius:10,border:"none",cursor:"pointer",background:a?"rgba(139,92,246,.25)":"transparent",color:a?"rgba(139,92,246,.95)":"rgba(255,255,255,.4)",fontSize:12,fontWeight:a?600:500,transition:"all .2s"}}>
        <I size={14}/>{t.l}
      </button>
    )})}
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════
// F5: BRIEFING VIEW - What happened, what's pending, what she handled
// ═══════════════════════════════════════════════════════════════════════════
function BriefingView({data,loading,onRefresh}){
  if(loading){
    return(<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{width:50,height:50,borderRadius:"50%",border:"3px solid rgba(139,92,246,.2)",borderTopColor:"rgba(139,92,246,.8)",animation:"spin 1s linear infinite"}}/>
      <p style={{color:"rgba(255,255,255,.5)",fontSize:13}}>Loading briefing...</p>
    </div>);
  }
  
  if(!data){
    return(<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:20}}>
      <Bell size={48} style={{color:"rgba(139,92,246,.4)"}}/>
      <p style={{color:"rgba(255,255,255,.5)",fontSize:14,textAlign:"center"}}>No briefing loaded yet</p>
      <button onClick={onRefresh} style={{padding:"12px 24px",borderRadius:12,border:"none",cursor:"pointer",background:"rgba(139,92,246,.25)",color:"rgba(139,92,246,.95)",fontSize:13,fontWeight:600}}>Load Briefing</button>
    </div>);
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
    {/* Summary */}
    {data.summary&&<div style={{padding:"14px 16px",background:"linear-gradient(135deg,rgba(139,92,246,.15),rgba(99,102,241,.1))",border:"1px solid rgba(139,92,246,.2)",borderRadius:14,marginBottom:16}}>
      <p style={{color:"rgba(255,255,255,.9)",fontSize:13,margin:0,lineHeight:1.6}}>{data.summary}</p>
    </div>}
    
    {/* Handled - What ABA did autonomously */}
    <Section title="Handled" icon={CheckCircle} items={data.handled} emptyText="Nothing handled yet today" color="#10B981"/>
    
    {/* Pending - Needs your attention */}
    <Section title="Pending" icon={AlertTriangle} items={data.pending} emptyText="Nothing pending" color="#F59E0B"/>
    
    {/* Upcoming - Calendar events */}
    <Section title="Upcoming" icon={Calendar} items={data.upcoming} emptyText="No upcoming events" color="#3B82F6"/>
    
    {/* Refresh button */}
    <div style={{display:"flex",justifyContent:"center",paddingTop:8}}>
      <button onClick={onRefresh} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 20px",borderRadius:10,border:"none",cursor:"pointer",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.4)",fontSize:12}}>
        <RefreshCw size={14}/>Refresh
      </button>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════
// F6: APPROVE VIEW - Swipe stack of pending decisions
// ═══════════════════════════════════════════════════════════════════════════
function ApproveView({userId,onAction}){
  const[items,setItems]=useState([]);
  const[loading,setLoading]=useState(true);
  const[currentIndex,setCurrentIndex]=useState(0);
  const[swipeDir,setSwipeDir]=useState(null);
  const[touchStart,setTouchStart]=useState(null);
  const[touchDelta,setTouchDelta]=useState(0);
  
  // Fetch pending approvals from dedicated endpoint
  useEffect(()=>{
    (async()=>{
      try{
        const response=await fetch(`https://abacia-services.onrender.com/api/pending-approvals?userId=${encodeURIComponent(userId)}`);
        if(response.ok){
          const data=await response.json();
          setItems(data.items||[]);
        }
      }catch(e){console.error("[APPROVE] Fetch failed:",e)}
      setLoading(false);
    })();
  },[userId]);
  
  const currentItem=items[currentIndex];
  
  const handleSwipe=(direction)=>{
    if(!currentItem)return;
    setSwipeDir(direction);
    
    // Execute action via dedicated endpoint
    const action=direction==="right"?"approve":"reject";
    fetch('https://abacia-services.onrender.com/api/approve-action',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({itemId:currentItem.id,action,userId})
    }).catch(e=>console.error('[APPROVE] Action failed:',e));
    
    // Animate out then advance
    setTimeout(()=>{
      setSwipeDir(null);
      setTouchDelta(0);
      if(currentIndex<items.length-1){
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
  
  if(items.length===0||currentIndex>=items.length){
    return(<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:20}}>
      <CheckCircle size={56} style={{color:"rgba(16,185,129,.6)"}}/>
      <p style={{color:"rgba(255,255,255,.7)",fontSize:16,fontWeight:600}}>All caught up!</p>
      <p style={{color:"rgba(255,255,255,.4)",fontSize:13,textAlign:"center"}}>No pending decisions right now</p>
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
    {/* Progress */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,padding:"0 8px"}}>
      <span style={{color:"rgba(255,255,255,.4)",fontSize:11}}>{currentIndex+1} of {items.length}</span>
      <div style={{flex:1,margin:"0 12px",height:3,background:"rgba(255,255,255,.1)",borderRadius:99}}>
        <div style={{width:`${((currentIndex+1)/items.length)*100}%`,height:"100%",background:"rgba(139,92,246,.6)",borderRadius:99,transition:"width .3s"}}/>
      </div>
      <span style={{color:"rgba(255,255,255,.4)",fontSize:11}}>{items.length-currentIndex-1} left</span>
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
    <div style={{position:"absolute",inset:0,backgroundImage:`url(${BG.blackLandscape.u})`,backgroundSize:"cover",backgroundPosition:"center",filter:"brightness(.3) saturate(.6)",animation:"kenBurns 30s ease-in-out infinite"}}/>
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
      <p style={{color:"rgba(255,255,255,.15)",fontSize:10,marginTop:20}}>v1.2.2</p>
    </div>
  </div>)}

// ═══════════════════════════════════════════════════════════════════════════
// SIDEBAR — v2.2.0: Chats + Projects + Share
// ═══════════════════════════════════════════════════════════════════════════
function Sidebar({open,convos,activeId,onSelect,onCreate,onClose,onDelete,onArchive,onShare,projects,activeProject,onSelectProject,onCreateProject,onProjectDetail,user}){
  const[search,setSearch]=useState("");
  const[showArchived,setShowArchived]=useState(false);
  const[tab,setTab]=useState("chats"); // "chats" or "projects"
  
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
    
    {/* Tab switcher: Chats / Projects */}
    <div style={{display:"flex",gap:4,marginBottom:12,background:"rgba(255,255,255,.03)",borderRadius:10,padding:3}}>
      <button onClick={()=>setTab("chats")} style={{flex:1,padding:"8px 12px",borderRadius:8,border:"none",cursor:"pointer",background:tab==="chats"?"rgba(139,92,246,.2)":"transparent",color:tab==="chats"?"rgba(139,92,246,.95)":"rgba(255,255,255,.4)",fontSize:12,fontWeight:600}}>Chats</button>
      <button onClick={()=>setTab("projects")} style={{flex:1,padding:"8px 12px",borderRadius:8,border:"none",cursor:"pointer",background:tab==="projects"?"rgba(139,92,246,.2)":"transparent",color:tab==="projects"?"rgba(139,92,246,.95)":"rgba(255,255,255,.4)",fontSize:12,fontWeight:600}}>Projects</button>
    </div>
    
    {tab==="chats"&&<>
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"rgba(255,255,255,.05)",borderRadius:10,marginBottom:12,border:"1px solid rgba(255,255,255,.06)"}}>
      <Search size={14} style={{color:"rgba(255,255,255,.3)"}}/>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search chats..." style={{flex:1,background:"none",border:"none",outline:"none",color:"rgba(255,255,255,.8)",fontSize:12}}/>
    </div>
    
    <button onClick={()=>{onCreate();onClose()}} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:12,border:"1px solid rgba(139,92,246,.2)",background:"rgba(139,92,246,.08)",color:"rgba(139,92,246,.9)",cursor:"pointer",fontWeight:600,fontSize:13,marginBottom:8,minHeight:44}}><Plus size={16}/>New Chat</button>
    
    <button onClick={()=>setShowArchived(!showArchived)} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:"none",border:"none",cursor:"pointer",color:showArchived?"rgba(139,92,246,.8)":"rgba(255,255,255,.3)",fontSize:11,marginBottom:8}}>
      <Archive size={12}/>{showArchived?"Hide Archived":"Show Archived"}
    </button>
    
    <div style={{flex:1,overflowY:"auto"}}>
      {solo.length>0&&<><div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",marginBottom:4}}><Lock size={11} style={{color:"rgba(255,255,255,.25)"}}/><span style={{color:"rgba(255,255,255,.3)",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Private</span></div>
      {solo.map(c=>(<div key={c.id} style={{display:"flex",alignItems:"center",gap:4,padding:"8px 12px",borderRadius:10,background:c.id===activeId?"rgba(139,92,246,.15)":"transparent",marginBottom:2}}>
        <button onClick={()=>{onSelect(c.id);onClose()}} style={{flex:1,display:"flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:"pointer",color:c.id===activeId?"rgba(255,255,255,.9)":"rgba(255,255,255,.5)",fontSize:12,textAlign:"left",padding:0}}>
          <MessageSquare size={14} style={{flexShrink:0,opacity:.5}}/>
          <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title}</span>
        </button>
        <button onClick={()=>onShare&&onShare(c)} title="Share" style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.2)",padding:4,minWidth:24,minHeight:24,display:"flex",alignItems:"center",justifyContent:"center"}}><Users size={11}/></button>
        <button onClick={()=>onArchive(c.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.2)",padding:4,minWidth:24,minHeight:24,display:"flex",alignItems:"center",justifyContent:"center"}}><Archive size={11}/></button>
        <button onClick={()=>onDelete(c.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(239,68,68,.4)",padding:4,minWidth:24,minHeight:24,display:"flex",alignItems:"center",justifyContent:"center"}}><Trash2 size={11}/></button>
      </div>))}</>}
      
      {shared.length>0&&<><div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",marginTop:12,marginBottom:4}}><Users size={11} style={{color:"rgba(255,255,255,.25)"}}/><span style={{color:"rgba(255,255,255,.3)",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Shared</span></div>
      {shared.map(c=>(<div key={c.id} style={{display:"flex",alignItems:"center",gap:4,padding:"8px 12px",borderRadius:10,background:c.id===activeId?"rgba(139,92,246,.15)":"transparent",marginBottom:2}}>
        <button onClick={()=>{onSelect(c.id);onClose()}} style={{flex:1,display:"flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:"pointer",color:c.id===activeId?"rgba(255,255,255,.9)":"rgba(255,255,255,.5)",fontSize:12,textAlign:"left",padding:0}}>
          <Users size={14} style={{flexShrink:0,opacity:.5}}/>
          <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title}</span>
        </button>
        <button onClick={()=>onShare&&onShare(c)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.2)",padding:4}}><Users size={11}/></button>
        <button onClick={()=>onArchive(c.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.2)",padding:4}}><Archive size={11}/></button>
        <button onClick={()=>onDelete(c.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(239,68,68,.4)",padding:4}}><Trash2 size={11}/></button>
      </div>))}</>}
      
      {filtered.length===0&&<div style={{padding:24,textAlign:"center",color:"rgba(255,255,255,.3)",fontSize:12}}>{search?"No chats match search":"No chats yet"}</div>}
    </div>
    </>}
    
    {/* SPURT 4: Projects Tab */}
    {tab==="projects"&&<>
    <button onClick={onCreateProject} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:12,border:"1px solid rgba(139,92,246,.2)",background:"rgba(139,92,246,.08)",color:"rgba(139,92,246,.9)",cursor:"pointer",fontWeight:600,fontSize:13,marginBottom:12,minHeight:44}}><Plus size={16}/>New Project</button>
    <div style={{flex:1,overflowY:"auto"}}>
      {projects&&projects.length>0?projects.map(p=>(<div key={p.id} style={{padding:"10px 12px",borderRadius:10,background:p.id===activeProject?"rgba(139,92,246,.15)":"transparent",marginBottom:4}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{flex:1,cursor:"pointer",display:"flex",alignItems:"center",gap:8}} onClick={()=>{onSelectProject(p.id);onClose()}}>
            <FileText size={14} style={{color:"rgba(139,92,246,.6)"}}/>
            <span style={{color:"rgba(255,255,255,.8)",fontSize:13,fontWeight:500}}>{p.name}</span>
          </div>
          <button onClick={(e)=>{e.stopPropagation();onProjectDetail&&onProjectDetail(p)}} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.3)",padding:4,minWidth:28,minHeight:28,display:"flex",alignItems:"center",justifyContent:"center"}}><MoreVertical size={14}/></button>
        </div>
        {p.files&&p.files.length>0&&<div style={{marginTop:6,paddingLeft:22}}>
          {p.files.slice(0,3).map((f,i)=>(<div key={i} style={{color:"rgba(255,255,255,.4)",fontSize:11,marginBottom:2}}>{f.name}</div>))}
          {p.files.length>3&&<div style={{color:"rgba(139,92,246,.5)",fontSize:10}}>{p.files.length-3} more files</div>}
        </div>}
      </div>)):<div style={{padding:24,textAlign:"center",color:"rgba(255,255,255,.3)",fontSize:12}}>No projects yet</div>}
    </div>
    </>}
  </div><div onClick={onClose} style={{flex:1,background:"rgba(0,0,0,.4)"}}/></div>)}

// ═══════════════════════════════════════════════════════════════════════════
// SHARE MODAL — Email-based sharing (works before recipient signs up)
// ═══════════════════════════════════════════════════════════════════════════
function ShareModal({ open, onClose, conversation, onShare }) {
  const [emails, setEmails] = useState("");
  const [permission, setPermission] = useState("view"); // view or edit
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(conversation?.sharedWith || []);
  
  if (!open || !conversation) return null;
  
  const handleShare = async () => {
    const emailList = emails.split(/[,\s]+/).filter(e => e.includes("@"));
    if (emailList.length === 0) return;
    setSharing(true);
    try {
      await onShare(conversation.id, emailList, permission);
      setShared([...shared, ...emailList.map(e => ({ email: e, permission }))]);
      setEmails("");
    } catch (e) {
      console.error("Share failed:", e);
    }
    setSharing(false);
  };
  
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.7)" }} />
      <div style={{ position: "relative", width: "90%", maxWidth: 400, background: "rgba(12,10,24,.98)", backdropFilter: "blur(24px)", borderRadius: 20, padding: 24, border: "1px solid rgba(139,92,246,.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: 0 }}>Share Chat</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,.4)", cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>
        
        <p style={{ color: "rgba(255,255,255,.5)", fontSize: 12, margin: "0 0 16px" }}>
          Share "{conversation.title}" with others. They'll get access when they sign in.
        </p>
        
        <div style={{ marginBottom: 16 }}>
          <label style={{ color: "rgba(255,255,255,.6)", fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>Email addresses (comma separated)</label>
          <input 
            value={emails} 
            onChange={e => setEmails(e.target.value)}
            placeholder="eric@example.com, bj@example.com"
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.05)", color: "white", fontSize: 14, outline: "none" }}
          />
        </div>
        
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button onClick={() => setPermission("view")} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1px solid ${permission === "view" ? "rgba(139,92,246,.4)" : "rgba(255,255,255,.1)"}`, background: permission === "view" ? "rgba(139,92,246,.15)" : "transparent", color: permission === "view" ? "rgba(139,92,246,.9)" : "rgba(255,255,255,.5)", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
            <Eye size={14} style={{ marginRight: 6, verticalAlign: -2 }} />View only
          </button>
          <button onClick={() => setPermission("edit")} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1px solid ${permission === "edit" ? "rgba(139,92,246,.4)" : "rgba(255,255,255,.1)"}`, background: permission === "edit" ? "rgba(139,92,246,.15)" : "transparent", color: permission === "edit" ? "rgba(139,92,246,.9)" : "rgba(255,255,255,.5)", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
            <MessageSquare size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Can reply
          </button>
        </div>
        
        {shared.length > 0 && (
          <div style={{ marginBottom: 16, padding: 12, background: "rgba(255,255,255,.03)", borderRadius: 12 }}>
            <p style={{ color: "rgba(255,255,255,.4)", fontSize: 10, fontWeight: 600, margin: "0 0 8px", textTransform: "uppercase" }}>Shared with</p>
            {shared.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
                <span style={{ color: "rgba(255,255,255,.7)", fontSize: 12 }}>{s.email}</span>
                <span style={{ color: "rgba(139,92,246,.6)", fontSize: 10 }}>{s.permission}</span>
              </div>
            ))}
          </div>
        )}
        
        <button onClick={handleShare} disabled={sharing || !emails.trim()} style={{ width: "100%", padding: "14px 20px", borderRadius: 14, border: "none", background: emails.trim() ? "linear-gradient(135deg, rgba(139,92,246,.5), rgba(99,102,241,.4))" : "rgba(255,255,255,.05)", color: emails.trim() ? "white" : "rgba(255,255,255,.3)", cursor: emails.trim() ? "pointer" : "default", fontSize: 14, fontWeight: 600 }}>
          {sharing ? "Sharing..." : "Share"}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROACTIVE QUEUE
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// NEW CHAT MODAL — Project vs Solo, Private vs Shared flow
// ═══════════════════════════════════════════════════════════════════════════
function NewChatModal({ open, onClose, onCreate, projects, onCreateProject }) {
  const [step, setStep] = useState(1);
  const [chatType, setChatType] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  
  if (!open) return null;
  
  const reset = () => { setStep(1); setChatType(null); setSelectedProject(null); setNewProjectName(""); setShowNewProject(false); };
  const handleClose = () => { reset(); onClose(); };
  
  const handleCreate = (privacy) => {
    const projectId = chatType === "project" ? (showNewProject ? null : selectedProject) : null;
    const projectName = showNewProject ? newProjectName.trim() : null;
    onCreate(privacy === "shared", projectId, projectName);
    handleClose();
  };
  
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={handleClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.7)" }} />
      <div style={{ position: "relative", width: "90%", maxWidth: 380, background: "rgba(12,10,24,.98)", backdropFilter: "blur(24px)", borderRadius: 20, padding: 24, border: "1px solid rgba(139,92,246,.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: 0 }}>{step === 1 ? "New Chat" : (chatType === "project" ? "Project Chat" : "Solo Chat")}</h3>
          <button onClick={handleClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,.4)", cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>
        
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button onClick={() => { setChatType("solo"); setStep(2); }} style={{ padding: "16px 20px", borderRadius: 14, border: "1px solid rgba(139,92,246,.2)", background: "rgba(139,92,246,.08)", color: "white", cursor: "pointer", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}><MessageSquare size={20} style={{ color: "#8B5CF6" }} /><div><div style={{ fontWeight: 600, fontSize: 14 }}>Solo Chat</div><div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", marginTop: 2 }}>Quick conversation</div></div></div>
            </button>
            <button onClick={() => { setChatType("project"); setStep(2); }} style={{ padding: "16px 20px", borderRadius: 14, border: "1px solid rgba(59,130,246,.2)", background: "rgba(59,130,246,.08)", color: "white", cursor: "pointer", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}><FolderPlus size={20} style={{ color: "#3B82F6" }} /><div><div style={{ fontWeight: 600, fontSize: 14 }}>Project Chat</div><div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", marginTop: 2 }}>Organized with files</div></div></div>
            </button>
          </div>
        )}
        
        {step === 2 && chatType === "project" && !showNewProject && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 180, overflowY: "auto", marginBottom: 12 }}>
              {projects?.length > 0 ? projects.map(p => (
                <button key={p.id} onClick={() => setSelectedProject(p.id)} style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${selectedProject === p.id ? "rgba(59,130,246,.4)" : "rgba(255,255,255,.1)"}`, background: selectedProject === p.id ? "rgba(59,130,246,.15)" : "transparent", color: "white", cursor: "pointer", textAlign: "left", fontSize: 13 }}>{p.name}</button>
              )) : <p style={{ color: "rgba(255,255,255,.4)", fontSize: 12, textAlign: "center", padding: 16 }}>No projects yet</p>}
            </div>
            <button onClick={() => setShowNewProject(true)} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px dashed rgba(139,92,246,.3)", background: "transparent", color: "rgba(139,92,246,.7)", cursor: "pointer", fontSize: 13, marginBottom: 16 }}>+ Create New Project</button>
            {selectedProject && <div style={{ display: "flex", gap: 8 }}><button onClick={() => handleCreate("private")} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "none", background: "rgba(139,92,246,.4)", color: "white", cursor: "pointer", fontWeight: 600 }}><Lock size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Private</button><button onClick={() => handleCreate("shared")} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "none", background: "rgba(59,130,246,.4)", color: "white", cursor: "pointer", fontWeight: 600 }}><Users size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Shared</button></div>}
          </>
        )}
        
        {step === 2 && chatType === "project" && showNewProject && (
          <>
            <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="Project name..." style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(139,92,246,.2)", background: "rgba(255,255,255,.05)", color: "white", fontSize: 14, outline: "none", marginBottom: 16, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8 }}><button onClick={() => setShowNewProject(false)} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "1px solid rgba(255,255,255,.1)", background: "transparent", color: "rgba(255,255,255,.6)", cursor: "pointer" }}>Back</button><button onClick={() => handleCreate("private")} disabled={!newProjectName.trim()} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "none", background: newProjectName.trim() ? "rgba(139,92,246,.4)" : "rgba(255,255,255,.1)", color: newProjectName.trim() ? "white" : "rgba(255,255,255,.3)", cursor: newProjectName.trim() ? "pointer" : "default", fontWeight: 600 }}>Create</button></div>
          </>
        )}
        
        {step === 2 && chatType === "solo" && (
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => handleCreate("private")} style={{ flex: 1, padding: "20px 16px", borderRadius: 14, border: "1px solid rgba(139,92,246,.2)", background: "rgba(139,92,246,.08)", color: "white", cursor: "pointer", textAlign: "center" }}><Lock size={24} style={{ color: "#8B5CF6", marginBottom: 8 }} /><div style={{ fontWeight: 600, fontSize: 14 }}>Private</div><div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 4 }}>Just me</div></button>
            <button onClick={() => handleCreate("shared")} style={{ flex: 1, padding: "20px 16px", borderRadius: 14, border: "1px solid rgba(59,130,246,.2)", background: "rgba(59,130,246,.08)", color: "white", cursor: "pointer", textAlign: "center" }}><Users size={24} style={{ color: "#3B82F6", marginBottom: 8 }} /><div style={{ fontWeight: 600, fontSize: 14 }}>Shared</div><div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 4 }}>Team access</div></button>
          </div>
        )}
        
        {step === 2 && <button onClick={() => setStep(1)} style={{ width: "100%", padding: "12px", marginTop: 16, borderRadius: 10, border: "none", background: "transparent", color: "rgba(255,255,255,.4)", cursor: "pointer", fontSize: 12 }}>← Back</button>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT DETAIL MODAL — Manage files, rename, delete
// ═══════════════════════════════════════════════════════════════════════════
function ProjectDetailModal({ open, onClose, project, onRename, onDelete, onAddFile, onRemoveFile }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project?.name || "");
  const fileInputRef = useRef(null);
  
  useEffect(() => { if (project) setName(project.name); }, [project]);
  
  if (!open || !project) return null;
  
  const handleRename = () => { if (name.trim() && name !== project.name) { onRename(project.id, name.trim()); } setEditing(false); };
  const handleFileSelect = (e) => { const files = Array.from(e.target.files); files.forEach(f => onAddFile(project.id, f)); e.target.value = ""; };
  
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.7)" }} />
      <div style={{ position: "relative", width: "90%", maxWidth: 420, background: "rgba(12,10,24,.98)", backdropFilter: "blur(24px)", borderRadius: 20, padding: 24, border: "1px solid rgba(139,92,246,.2)", maxHeight: "80vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          {editing ? <input value={name} onChange={e => setName(e.target.value)} onBlur={handleRename} onKeyDown={e => e.key === "Enter" && handleRename()} autoFocus style={{ flex: 1, background: "rgba(255,255,255,.1)", border: "1px solid rgba(139,92,246,.3)", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 18, fontWeight: 700 }} />
            : <h3 onClick={() => setEditing(true)} style={{ color: "white", fontSize: 18, fontWeight: 700, margin: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>{project.name} <Edit2 size={14} style={{ color: "rgba(255,255,255,.3)" }} /></h3>}
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,.4)", cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ color: "rgba(255,255,255,.5)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Files ({project.files?.length || 0})</span>
            <button onClick={() => fileInputRef.current?.click()} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(139,92,246,.3)", background: "rgba(139,92,246,.1)", color: "rgba(139,92,246,.9)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}><Plus size={12} style={{ marginRight: 4, verticalAlign: -1 }} />Add</button>
            <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} style={{ display: "none" }} />
          </div>
          {project.files?.length > 0 ? project.files.map(f => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "rgba(255,255,255,.03)", borderRadius: 10, marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}><File size={14} style={{ color: "rgba(139,92,246,.5)" }} /><span style={{ color: "rgba(255,255,255,.7)", fontSize: 13 }}>{f.name}</span></div>
              <button onClick={() => onRemoveFile(project.id, f.id)} style={{ background: "none", border: "none", color: "rgba(239,68,68,.5)", cursor: "pointer", padding: 4 }}><Trash2 size={14} /></button>
            </div>
          )) : <p style={{ color: "rgba(255,255,255,.3)", fontSize: 12, textAlign: "center", padding: 20 }}>No files yet</p>}
        </div>
        
        <button onClick={() => { onDelete(project.id); onClose(); }} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "1px solid rgba(239,68,68,.3)", background: "rgba(239,68,68,.08)", color: "rgba(239,68,68,.8)", cursor: "pointer", fontSize: 14, fontWeight: 600 }}><Trash2 size={14} style={{ marginRight: 8, verticalAlign: -2 }} />Delete Project</button>
      </div>
    </div>
  );
}

function Queue({open,onToggle,items}){
  const iconMap={briefing:Bell,email:Mail,meeting:Calendar,deadline:AlertTriangle,followup:Clock};const pColors={critical:"#EF4444",high:"#F59E0B",medium:"#3B82F6",low:"#6B7280"};
  if(!open)return(<button onClick={onToggle} style={{position:"fixed",bottom:160,right:14,width:48,height:48,borderRadius:99,background:items.length>0?"linear-gradient(135deg,#8B5CF6,#3B82F6)":"rgba(255,255,255,.08)",border:"none",boxShadow:"0 4px 20px rgba(0,0,0,.3)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",zIndex:50,minWidth:48,minHeight:48}}><Bell size={20}/>{items.length>0&&<div style={{position:"absolute",top:-2,right:-2,width:20,height:20,borderRadius:99,background:"#EF4444",color:"#fff",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center"}}>{items.length}</div>}</button>);
  return(<div style={{position:"fixed",bottom:160,right:14,width:340,maxHeight:420,background:"rgba(12,10,24,.97)",backdropFilter:"blur(20px)",borderRadius:16,border:"1px solid rgba(139,92,246,.25)",boxShadow:"0 20px 40px rgba(0,0,0,.4)",overflow:"hidden",zIndex:50,display:"flex",flexDirection:"column"}}>
    <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(139,92,246,.15)",display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(135deg,rgba(139,92,246,.08),rgba(59,130,246,.04))"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}><Bell size={16} style={{color:"#8B5CF6"}}/><span style={{color:"white",fontWeight:600,fontSize:14}}>What ABA Cooked</span><span style={{background:"rgba(139,92,246,.25)",padding:"1px 8px",borderRadius:10,fontSize:11,color:"#C4B5FD"}}>{items.length}</span></div>
      <button onClick={onToggle} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.4)",minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center"}}><X size={16}/></button>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:8}}>{items.length===0?<div style={{padding:24,textAlign:"center",color:"rgba(255,255,255,.3)",fontSize:13}}>All clear. ABA is keeping watch.</div>:items.map((item,idx)=>{const I=iconMap[item.type]||Bell;const col=pColors[item.priority]||"#6B7280";return(<div key={idx} style={{padding:"10px 12px",borderRadius:12,border:`1px solid ${col}25`,background:`${col}08`,marginBottom:6,display:"flex",gap:10,alignItems:"flex-start"}}><div style={{width:28,height:28,borderRadius:8,background:`${col}20`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><I size={14} style={{color:col}}/></div><div style={{flex:1}}><div style={{color:"rgba(255,255,255,.85)",fontSize:12,fontWeight:600}}>{item.title}</div><div style={{color:"rgba(255,255,255,.4)",fontSize:11,marginTop:2}}>{item.summary}</div></div></div>)})}</div>
  </div>)}

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// F7: SETTINGS DRAWER - Full settings panel
// ═══════════════════════════════════════════════════════════════════════════
function SettingsDrawer({open,onClose,bg,setBg,voiceOut,setVoiceOut,onLogout,user}){
  const[notifyBriefing,setNotifyBriefing]=useState(()=>{try{return localStorage.getItem("myaba_notifyBriefing")!=="false"}catch{return true}});
  const[notifyUrgent,setNotifyUrgent]=useState(()=>{try{return localStorage.getItem("myaba_notifyUrgent")!=="false"}catch{return true}});
  const[autoSpeak,setAutoSpeak]=useState(()=>{try{return localStorage.getItem("myaba_autoSpeak")==="true"}catch{return false}});
  const[pushEnabled,setPushEnabled]=useState(()=>{try{return localStorage.getItem("myaba_pushEnabled")==="true"}catch{return false}});
  const[pushLoading,setPushLoading]=useState(false);
  
  useEffect(()=>{try{localStorage.setItem("myaba_notifyBriefing",String(notifyBriefing))}catch{}},[notifyBriefing]);
  useEffect(()=>{try{localStorage.setItem("myaba_notifyUrgent",String(notifyUrgent))}catch{}},[notifyUrgent]);
  useEffect(()=>{try{localStorage.setItem("myaba_autoSpeak",String(autoSpeak))}catch{}},[autoSpeak]);
  useEffect(()=>{try{localStorage.setItem("myaba_pushEnabled",String(pushEnabled))}catch{}},[pushEnabled]);
  
  const handlePushToggle=async(enable)=>{
    setPushLoading(true);
    try{
      if(enable){
        const sub=await subscribeToPush(user?.email||"brandon");
        if(sub)setPushEnabled(true);
      }else{
        await unsubscribeFromPush(user?.email||"brandon");
        setPushEnabled(false);
      }
    }catch(e){console.error(e)}
    setPushLoading(false);
  };
  
  if(!open)return null;
  
  const Toggle=({value,onChange,label,sublabel})=>(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
      <div>
        <p style={{color:"rgba(255,255,255,.85)",fontSize:13,fontWeight:500,margin:0}}>{label}</p>
        {sublabel&&<p style={{color:"rgba(255,255,255,.4)",fontSize:11,margin:"2px 0 0"}}>{sublabel}</p>}
      </div>
      <button onClick={()=>onChange(!value)} style={{width:48,height:28,borderRadius:99,border:"none",cursor:"pointer",background:value?"rgba(139,92,246,.5)":"rgba(255,255,255,.1)",position:"relative",transition:"background .2s"}}>
        <div style={{position:"absolute",top:2,left:value?22:2,width:24,height:24,borderRadius:"50%",background:"white",boxShadow:"0 2px 4px rgba(0,0,0,.2)",transition:"left .2s"}}/>
      </button>
    </div>
  );
  
  const Section=({title,children})=>(
    <div style={{marginBottom:20}}>
      <p style={{color:"rgba(255,255,255,.35)",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:8}}>{title}</p>
      <div style={{background:"rgba(255,255,255,.03)",borderRadius:14,padding:"4px 14px"}}>{children}</div>
    </div>
  );
  
  return(<div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
    <div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(0,0,0,.6)"}}/>
    <div style={{position:"relative",zIndex:101,width:"100%",maxWidth:480,background:"rgba(12,10,24,.98)",backdropFilter:"blur(24px)",border:"1px solid rgba(255,255,255,.08)",borderRadius:"24px 24px 0 0",padding:"24px 20px calc(32px + env(safe-area-inset-bottom))",maxHeight:"85vh",overflowY:"auto"}}>
      
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <span style={{color:"rgba(255,255,255,.9)",fontSize:18,fontWeight:700}}>Settings</span>
        <button onClick={onClose} style={{background:"rgba(255,255,255,.08)",border:"none",color:"white",width:36,height:36,borderRadius:99,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={18}/></button>
      </div>
      
      {/* User info */}
      {user&&<div style={{display:"flex",alignItems:"center",gap:12,padding:14,background:"rgba(139,92,246,.08)",borderRadius:14,marginBottom:20}}>
        {user.photoURL?<img src={user.photoURL} alt="" style={{width:44,height:44,borderRadius:"50%",border:"2px solid rgba(139,92,246,.3)"}}/>:<div style={{width:44,height:44,borderRadius:"50%",background:"rgba(139,92,246,.2)",display:"flex",alignItems:"center",justifyContent:"center"}}><User size={22} style={{color:"rgba(139,92,246,.7)"}}/></div>}
        <div style={{flex:1}}>
          <p style={{color:"rgba(255,255,255,.9)",fontSize:14,fontWeight:600,margin:0}}>{user.displayName||"User"}</p>
          <p style={{color:"rgba(255,255,255,.5)",fontSize:11,margin:"2px 0 0"}}>{user.email}</p>
        </div>
      </div>}
      
      {/* Voice */}
      <Section title="Voice">
        <Toggle value={voiceOut} onChange={setVoiceOut} label="Voice responses" sublabel="ABA speaks her responses aloud"/>
        <Toggle value={autoSpeak} onChange={setAutoSpeak} label="Auto-speak" sublabel="Automatically speak without tapping"/>
      </Section>
      
      {/* Notifications */}
      <Section title="Notifications">
        <Toggle value={notifyBriefing} onChange={setNotifyBriefing} label="Morning briefing" sublabel="Daily summary at 6 AM"/>
        <Toggle value={notifyUrgent} onChange={setNotifyUrgent} label="Urgent alerts" sublabel="Calls and texts for emergencies"/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0"}}>
          <div>
            <p style={{color:"rgba(255,255,255,.85)",fontSize:13,fontWeight:500,margin:0}}>Push notifications</p>
            <p style={{color:"rgba(255,255,255,.4)",fontSize:11,margin:"2px 0 0"}}>Alerts even when app is closed</p>
          </div>
          <button onClick={()=>handlePushToggle(!pushEnabled)} disabled={pushLoading} style={{width:48,height:28,borderRadius:99,border:"none",cursor:pushLoading?"wait":"pointer",background:pushEnabled?"rgba(139,92,246,.5)":"rgba(255,255,255,.1)",position:"relative",transition:"background .2s",opacity:pushLoading?.5:1}}>
            <div style={{position:"absolute",top:2,left:pushEnabled?22:2,width:24,height:24,borderRadius:"50%",background:"white",boxShadow:"0 2px 4px rgba(0,0,0,.2)",transition:"left .2s"}}/>
          </button>
        </div>
      </Section>
      
      {/* Appearance */}
      <Section title="Background">
        <div style={{padding:"8px 0"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {Object.entries(BG).map(([k,{u,l}])=>(
              <button key={k} onClick={()=>setBg(k)} style={{position:"relative",aspectRatio:"16/10",borderRadius:10,overflow:"hidden",border:bg===k?"2px solid rgba(139,92,246,.8)":"2px solid rgba(255,255,255,.06)",cursor:"pointer",background:"#111",padding:0,boxShadow:bg===k?"0 0 14px rgba(139,92,246,.4)":"none"}}>
                <img src={u} alt={l} style={{width:"100%",height:"100%",objectFit:"cover",opacity:.8}}/>
                <span style={{position:"absolute",bottom:0,left:0,right:0,padding:"10px 4px 4px",background:"linear-gradient(transparent,rgba(0,0,0,.8))",color:bg===k?"rgba(139,92,246,.95)":"rgba(255,255,255,.6)",fontSize:8,fontWeight:600,textAlign:"center"}}>{l}</span>
              </button>
            ))}
          </div>
        </div>
      </Section>
      
      {/* Sign out */}
      <button onClick={onLogout} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",padding:"14px 16px",borderRadius:14,border:"1px solid rgba(239,68,68,.2)",background:"rgba(239,68,68,.06)",color:"rgba(239,68,68,.8)",cursor:"pointer",fontSize:14,fontWeight:600}}>
        <LogOut size={18}/>Sign Out
      </button>
      
      {/* Version */}
      <div style={{marginTop:16,padding:"14px",background:"rgba(139,92,246,.05)",borderRadius:14,border:"1px solid rgba(139,92,246,.1)",textAlign:"center"}}>
        <p style={{color:"rgba(139,92,246,.7)",fontSize:11,fontWeight:600,margin:0}}>MyABA v2.13.0</p>
        <p style={{color:"rgba(255,255,255,.3)",fontSize:10,margin:"4px 0 0"}}>Phase 9 Fixes Complete</p>
      </div>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════
// MYABA — v1.1.3-P1: All Phase 1 fixes applied
// ═══════════════════════════════════════════════════════════════════════════
export default function MyABA(){
  const[user,setUser]=useState(null);const[authLoading,setAuthLoading]=useState(true);
  const[convos,setConvos]=useState([]);const[activeId,setActiveId]=useState(null);
  const activeConv=convos.find(c=>c.id===activeId);const messages=activeConv?.messages||[];
  const[input,setInput]=useState("");const[abaState,setAbaState]=useState("idle");
  const[attachments,setAttachments]=useState([]); // SPURT 5: files attached to message
  const fileInputRef=useRef(null);
  const[isTyping,setIsTyping]=useState(false);
  
  // v1.1.3-P1-S3: Settings from localStorage
  const[bg,setBg]=useState(()=>{try{return localStorage.getItem("myaba_bg")||"blackLandscape"}catch{return "blackLandscape"}});
  const[voiceOut,setVoiceOut]=useState(()=>{try{return localStorage.getItem("myaba_voiceOut")!=="false"}catch{return true}});
  const[voiceMode,setVoiceMode]=useState(()=>{try{return localStorage.getItem("myaba_voiceMode")||"chat"}catch{return "chat"}});
  
  const[settingsOpen,setSettingsOpen]=useState(false);const[sidebarOpen,setSidebarOpen]=useState(false);
  const[mainTab,setMainTab]=useState("chat"); // F5/F6: "chat" | "briefing" | "approve"
  const[briefingData,setBriefingData]=useState(null);
  const[briefingLoading,setBriefingLoading]=useState(false);
  const[shareModal,setShareModal]=useState(null); // conversation being shared
  const[projects,setProjects]=useState([]); // SPURT 4: projects list
  const[newChatModal,setNewChatModal]=useState(false); // New chat flow modal
  const[projectDetailModal,setProjectDetailModal]=useState(null); // Project detail modal
  const[activeProject,setActiveProject]=useState(null);
  const[queueOpen,setQueueOpen]=useState(false);
  const[isListening,setIsListening]=useState(false);
  const[liveActive,setLiveActive]=useState(false);
  const[viewportHeight,setViewportHeight]=useState(window.innerHeight);
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
  // Mobile keyboard viewport fix - more robust
  useEffect(()=>{
    const handleResize=()=>{
      // Use visualViewport for accurate mobile keyboard detection
      const vh=window.visualViewport?window.visualViewport.height:window.innerHeight;
      setViewportHeight(vh);
      document.documentElement.style.setProperty('--vh',`${vh}px`);
      document.documentElement.style.setProperty('--viewport-height',`${vh}px`);
    };
    handleResize();
    
    // Listen to both visualViewport and window resize
    if(window.visualViewport){
      window.visualViewport.addEventListener('resize',handleResize);
      window.visualViewport.addEventListener('scroll',handleResize);
    }
    window.addEventListener('resize',handleResize);
    window.addEventListener('orientationchange',handleResize);
    
    return()=>{
      if(window.visualViewport){
        window.visualViewport.removeEventListener('resize',handleResize);
        window.visualViewport.removeEventListener('scroll',handleResize);
      }
      window.removeEventListener('resize',handleResize);
      window.removeEventListener('orientationchange',handleResize);
    };
  },[]);
  
  // Scroll input into view when focused (mobile keyboard fix)
  const scrollInputIntoView=useCallback(()=>{
    if(scrollRef.current){
      // Small delay to allow keyboard to appear
      setTimeout(()=>{
        scrollRef.current.scrollTop=scrollRef.current.scrollHeight;
      },300);
    }
  },[]);

  useEffect(()=>{const unsub=onAuthStateChanged(auth,(u)=>{setUser(u);setAuthLoading(false)});return()=>unsub()},[]);
  useEffect(()=>{if(scrollRef.current)scrollRef.current.scrollTop=scrollRef.current.scrollHeight},[messages,isTyping]);

  const showToast=useCallback((message,type="info")=>{setToast({message,type})},[]);

  const createConv=useCallback((shared=false,projectId=null)=>{const id=`conv-${Date.now()}`;const conv={id,title:"New Chat",shared,archived:false,messages:[],createdAt:Date.now(),updatedAt:Date.now(),autoNamed:false,projectId};setConvos(p=>[conv,...p]);setActiveId(id);return id},[]);
  const addMsg=useCallback((msg)=>{setConvos(p=>p.map(c=>c.id===activeId?{...c,messages:[...c.messages,msg],updatedAt:Date.now()}:c))},[activeId]);

  // v1.2.0: Delete and archive via AIR → Supabase
  const deleteConv=useCallback((id)=>{
    setConvos(p=>p.filter(c=>c.id!==id));
    if(activeId===id){const remaining=convos.filter(c=>c.id!==id);setActiveId(remaining[0]?.id||null)}
    if(user)deleteConversation(user.uid,id).catch(()=>{});
  },[activeId,convos,user]);

  const archiveConv=useCallback((id)=>{
    setConvos(p=>p.map(c=>c.id===id?{...c,archived:true}:c));
    if(user)archiveConversation(user.uid,id).catch(()=>{});
  },[user]);

  // SPURT 3: Share conversation via email
  const shareConversation=useCallback(async(convId,emails,permission)=>{
    // Update local state to mark as shared
    setConvos(p=>p.map(c=>c.id===convId?{...c,shared:true,sharedWith:[...(c.sharedWith||[]),...emails.map(e=>({email:e,permission}))]}:c));
    // Save to backend
    if(user){
      try{
        await airRequest("share_conversation",{conversationId:convId,emails,permission},user.uid);
      }catch(e){console.error("Share error:",e)}
    }
  },[user]);
  
  // SPURT 4: Create project
  const createProject=useCallback((name="New Project")=>{
    const id=`proj-${Date.now()}`;
    const proj={id,name,files:[],createdAt:Date.now()};
    setProjects(p=>[proj,...p]);
    setActiveProject(id);
    return id;
  },[]);
  
  // Delete project
  const deleteProject=useCallback((projectId)=>{
    setProjects(p=>p.filter(proj=>proj.id!==projectId));
    if(activeProject===projectId)setActiveProject(null);
  },[activeProject]);
  
  // Remove file from project
  const removeFileFromProject=useCallback((projectId,fileId)=>{
    setProjects(p=>p.map(proj=>proj.id===projectId?{...proj,files:proj.files.filter(f=>f.id!==fileId)}:proj));
  },[]);
  
  // SPURT 4: Add file to project
  const addFileToProject=useCallback((projectId,file)=>{
    const fileData={id:`file-${Date.now()}`,name:file.name,type:file.type,size:file.size,url:URL.createObjectURL(file),addedAt:Date.now()};
    setProjects(p=>p.map(proj=>proj.id===projectId?{...proj,files:[...proj.files,fileData]}:proj));
  },[]);
  
  // SPURT 4: Rename project
  const renameProject=useCallback((projectId,newName)=>{
    setProjects(p=>p.map(proj=>proj.id===projectId?{...proj,name:newName}:proj));
  },[]);

  // v1.2.0: Load conversations via AIR → Supabase + DAWN greeting
  useEffect(()=>{
    if(!user)return;
    loadConversations(user.uid).then(loaded=>{
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

  // v2.8.0: Save via direct Supabase endpoint
  useEffect(()=>{if(user&&activeConv&&activeConv.messages.length>0)saveConversation(user.uid,activeConv).catch(()=>{})},[activeConv?.messages?.length]);

  // SPURT 5: Handle file selection
  const handleFileSelect=useCallback((e)=>{
    const files=Array.from(e.target.files||[]);
    const newAttachments=files.map(f=>({id:`att-${Date.now()}-${Math.random()}`,file:f,name:f.name,type:f.type,size:f.size,url:URL.createObjectURL(f)}));
    setAttachments(p=>[...p,newAttachments]);
    if(fileInputRef.current)fileInputRef.current.value="";
  },[]);
  
  const removeAttachment=useCallback((id)=>{
    setAttachments(p=>p.filter(a=>a.id!==id));
  },[]);

  const sendMessage=useCallback(async(text,isVoice=false)=>{
    if(!text.trim()&&attachments.length===0)return;
    // Include attachments in message
    const userMsg={id:`u-${Date.now()}`,role:"user",content:text.trim(),timestamp:Date.now(),isVoice,attachments:attachments.length>0?attachments.map(a=>({name:a.name,type:a.type,size:a.size})):undefined};
    addMsg(userMsg);setInput("");setAttachments([]);setIsTyping(true);setAbaState("thinking");
    const data=await airRequest("text",{message:text.trim(),conversationId:activeId,attachments:attachments.map(a=>({name:a.name,type:a.type}))},user?.uid);
    setIsTyping(false);
    
    if(data.error){
      showToast("Taking a moment to reconnect...","offline");
      setAbaState("idle");
      return;
    }
    
    const abaMsg={id:`a-${Date.now()}`,role:"aba",timestamp:Date.now(),content:data.response||data.message||"",output:data.actions?.[0]?{type:data.actions[0].type,title:data.actions[0].title,subtitle:data.actions[0].subtitle,preview:data.actions[0].preview,actions:true}:undefined};
    addMsg(abaMsg);
    if(voiceOut&&abaMsg.content){setAbaState("speaking");const url=await reachSynthesize(abaMsg.content);if(url){const a=new Audio(url);a.onended=()=>{setAbaState("idle");if(liveRef.current)startListening()};a.play().catch(()=>{setAbaState("idle");if(liveRef.current)startListening()})}else{setAbaState("idle");if(liveRef.current)startListening()}}else{setAbaState("idle");if(liveRef.current)startListening()}
  },[activeId,user,voiceOut,addMsg,showToast,attachments]);

  // SPURT 6: Speak any text (for replay button)
  const speakText=useCallback(async(text)=>{
    if(!text)return;
    setAbaState("speaking");
    const url=await reachSynthesize(text);
    if(url){
      const audio=new Audio(url);
      audio.onended=()=>setAbaState("idle");
      audio.play().catch(()=>setAbaState("idle"));
    }else{
      setAbaState("idle");
    }
  },[]);

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
  const bgUrl=BG[bg]?.u||BG.blackLandscape.u;

  return(<div style={{width:"100%",height:`${viewportHeight}px`,position:"relative",overflow:"hidden",fontFamily:"'SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",background:"#08080d",paddingTop:"env(safe-area-inset-top)",paddingBottom:"env(safe-area-inset-bottom)"}}>
    <style>{`@keyframes mp{0%,100%{opacity:.3;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}@keyframes mf{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes mb{0%,100%{opacity:.6}50%{opacity:1}}@keyframes ml{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.4)}50%{box-shadow:0 0 0 12px rgba(239,68,68,0)}}@keyframes kenBurns{0%{transform:scale(1) translate(0,0)}25%{transform:scale(1.08) translate(-1%,-1%)}50%{transform:scale(1.12) translate(1%,0)}75%{transform:scale(1.06) translate(-0.5%,1%)}100%{transform:scale(1) translate(0,0)}}@keyframes pulse{0%{transform:scale(1);opacity:1}100%{transform:scale(1.5);opacity:0}}@keyframes breathe{0%,100%{transform:scale(1);box-shadow:0 0 40px rgba(139,92,246,.3)}50%{transform:scale(1.05);box-shadow:0 0 60px rgba(139,92,246,.5)}}@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(139,92,246,.15);border-radius:99px}`}</style>
    <div style={{position:"absolute",inset:0,zIndex:0,backgroundImage:`url(${bgUrl})`,backgroundSize:"cover",backgroundPosition:"center",filter:"brightness(.4) saturate(.7)",transition:"background-image 1s",animation:"kenBurns 30s ease-in-out infinite"}}/>
    <div style={{position:"absolute",inset:0,zIndex:1,background:"radial-gradient(ellipse at center,rgba(0,0,0,0) 0%,rgba(0,0,0,.55) 100%)"}}/>
    <div style={{position:"relative",zIndex:2,display:"flex",flexDirection:"column",height:"100%",maxWidth:480,margin:"0 auto",padding:"0 14px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 2px 4px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>setSidebarOpen(true)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.5)",padding:0,display:"flex",minWidth:44,minHeight:44,alignItems:"center",justifyContent:"center"}}><MessageSquare size={18}/></button>
          <div style={{width:8,height:8,borderRadius:99,background:`rgba(${sc},.9)`,boxShadow:`0 0 10px rgba(${sc},.6)`,animation:"mb 3s ease infinite"}}/>
          <svg width="22" height="22" viewBox="0 0 100 100" style={{marginRight:4}}><defs><linearGradient id="abaGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#8B5CF6"/><stop offset="100%" stopColor="#6366F1"/></linearGradient></defs><circle cx="50" cy="50" r="45" fill="url(#abaGrad)" opacity=".2"/><circle cx="50" cy="50" r="35" fill="url(#abaGrad)" opacity=".4"/><circle cx="50" cy="50" r="25" fill="url(#abaGrad)"/><text x="50" y="58" textAnchor="middle" fill="white" fontSize="24" fontWeight="700" fontFamily="SF Pro Display,system-ui">A</text></svg>
          <span style={{color:"rgba(255,255,255,.75)",fontSize:14,fontWeight:700,letterSpacing:.5}}>MyABA</span>
          {liveActive&&<span style={{background:"rgba(239,68,68,.2)",color:"#EF4444",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:99,animation:"ml 2s infinite",letterSpacing:1}}>LIVE</span>}
          <span style={{color:"rgba(255,255,255,.2)",fontSize:10}}>{abaState!=="idle"?(abaState==="thinking"?"thinking...":abaState==="speaking"?"speaking...":"listening..."):""}</span>
        </div>
        <div style={{display:"flex",gap:4}}>
          <button onClick={()=>setVoiceOut(!voiceOut)} style={{background:voiceOut?"rgba(139,92,246,.15)":"rgba(255,255,255,.04)",border:`1px solid ${voiceOut?"rgba(139,92,246,.2)":"rgba(255,255,255,.06)"}`,color:voiceOut?"rgba(139,92,246,.85)":"rgba(255,255,255,.3)",borderRadius:99,width:44,height:44,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{voiceOut?<Volume2 size={15}/>:<VolumeX size={15}/>}</button>
          <button onClick={()=>setSettingsOpen(true)} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.06)",color:"rgba(255,255,255,.3)",borderRadius:99,width:44,height:44,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Settings size={15}/></button>
        </div>
      </div>
      {/* F5/F6: Main Tab Switcher - Chat | Briefing | Approve */}
      <MainTabSwitcher tab={mainTab} setTab={async(t)=>{
        setMainTab(t);
        if(t==="briefing"&&!briefingData&&!briefingLoading){
          setBriefingLoading(true);
          const data=await fetchBriefing(user?.email||"brandon");
          setBriefingData(data);
          setBriefingLoading(false);
        }
      }}/>
      
      {/* Chat Mode */}
      {mainTab==="chat"&&<>
      <div style={{flexShrink:0,padding:"4px 0"}}><VoiceMode mode={voiceMode} setMode={m=>{setVoiceMode(m);if(m!=="talk"&&liveActive){liveRef.current=false;setLiveActive(false);stopListening()}}}/></div>
      <div style={{flexShrink:0,display:"flex",justifyContent:"center",padding:"2px 0",transition:"all .5s"}}><Blob state={abaState} size={messages.length<=1?140:70}/></div>
      <div ref={scrollRef} style={{flex:1,overflowY:"auto",padding:"4px 2px",display:"flex",flexDirection:"column",gap:2,maskImage:"linear-gradient(transparent 0%,black 2%,black 96%,transparent 100%)",WebkitMaskImage:"linear-gradient(transparent 0%,black 2%,black 96%,transparent 100%)"}}>
        {messages.map(msg=><div key={msg.id} style={{animation:"mf .3s ease"}}><Bubble msg={msg} userPhoto={user?.photoURL} onSpeak={speakText}/></div>)}
        {isTyping&&<Typing/>}
      </div>
      <div style={{flexShrink:0,padding:"6px 0 14px"}}>
        {/* Hidden file input */}
        <input type="file" ref={fileInputRef} multiple accept="image/*,.pdf,.doc,.docx,.txt" onChange={handleFileSelect} style={{display:"none"}}/>
        
        {/* Attachments preview */}
        {attachments.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:8,padding:"0 4px"}}>
          {attachments.map(a=>(<div key={a.id} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:12,background:"rgba(139,92,246,.15)",border:"1px solid rgba(139,92,246,.25)"}}>
            {a.type?.startsWith("image")?<Image size={12} style={{color:"rgba(139,92,246,.8)"}}/>:<File size={12} style={{color:"rgba(139,92,246,.8)"}}/>}
            <span style={{color:"rgba(255,255,255,.8)",fontSize:11,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</span>
            <button onClick={()=>removeAttachment(a.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.4)",padding:2}}><X size={12}/></button>
          </div>))}
        </div>}
        
        {voiceMode==="chat"&&<div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
          <button onClick={()=>fileInputRef.current?.click()} style={{width:44,height:44,borderRadius:99,border:"none",cursor:"pointer",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.4)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Paperclip size={16}/></button>
          <div style={{flex:1,display:"flex",alignItems:"center",background:"rgba(255,255,255,.05)",backdropFilter:"blur(12px)",border:"1px solid rgba(255,255,255,.08)",borderRadius:24,padding:"0 6px 0 16px",minHeight:48}}><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey} onFocus={scrollInputIntoView} placeholder="Message ABA..." style={{flex:1,background:"none",border:"none",outline:"none",color:"rgba(255,255,255,.9)",fontSize:16,padding:"12px 0",WebkitAppearance:"none"}}/><button onClick={()=>{if(!isListening)startListening();else stopListening()}} style={{width:44,height:44,borderRadius:99,border:"none",cursor:"pointer",background:isListening?"rgba(6,182,212,.2)":"rgba(255,255,255,.05)",color:isListening?"rgba(6,182,212,.95)":"rgba(255,255,255,.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{isListening?<MicOff size={16}/>:<Mic size={16}/>}</button></div>
          <button onClick={()=>sendMessage(input)} disabled={!input.trim()&&attachments.length===0} style={{width:48,height:48,borderRadius:99,border:"none",cursor:(input.trim()||attachments.length>0)?"pointer":"default",background:(input.trim()||attachments.length>0)?"rgba(139,92,246,.4)":"rgba(255,255,255,.04)",color:(input.trim()||attachments.length>0)?"white":"rgba(255,255,255,.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:(input.trim()||attachments.length>0)?"0 0 16px rgba(139,92,246,.25)":"none"}}><Send size={18}/></button>
        </div>}
        {voiceMode==="talk"&&<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"radial-gradient(circle at 50% 50%, rgba(139,92,246,.15) 0%, transparent 70%)",zIndex:10}}>
          {/* Pulsing rings */}
          <div style={{position:"absolute",width:200,height:200,borderRadius:"50%",border:"1px solid rgba(139,92,246,.1)",animation:liveActive?"pulse 2s ease-out infinite":"none",opacity:.5}}/>
          <div style={{position:"absolute",width:280,height:280,borderRadius:"50%",border:"1px solid rgba(139,92,246,.08)",animation:liveActive?"pulse 2s ease-out .5s infinite":"none",opacity:.3}}/>
          <div style={{position:"absolute",width:360,height:360,borderRadius:"50%",border:"1px solid rgba(139,92,246,.05)",animation:liveActive?"pulse 2s ease-out 1s infinite":"none",opacity:.2}}/>
          
          {/* Central orb */}
          <button onClick={toggleLive} style={{width:140,height:140,borderRadius:"50%",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,border:"none",background:liveActive?"radial-gradient(circle at 30% 30%, rgba(239,68,68,.4), rgba(139,92,246,.3))":"radial-gradient(circle at 30% 30%, rgba(139,92,246,.4), rgba(99,102,241,.3))",color:"white",boxShadow:liveActive?"0 0 60px rgba(239,68,68,.4), inset 0 0 30px rgba(255,255,255,.1)":"0 0 60px rgba(139,92,246,.4), inset 0 0 30px rgba(255,255,255,.1)",animation:liveActive?"breathe 1.5s ease-in-out infinite":"breathe 3s ease-in-out infinite",backdropFilter:"blur(8px)"}}>
            {abaState==="speaking"?<Volume2 size={36}/>:abaState==="thinking"?<Sparkles size={36}/>:isListening?<MicOff size={36}/>:<Mic size={36}/>}
            <span style={{fontSize:12,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>{liveActive?(abaState==="speaking"?"Speaking":isListening?"Listening":"Ready"):"Tap to Talk"}</span>
          </button>
          
          {/* Status text */}
          <p style={{position:"absolute",bottom:100,color:"rgba(255,255,255,.5)",fontSize:13,textAlign:"center",maxWidth:280}}>
            {liveActive?"Listening. Speak naturally. Tap orb to end.":"Tap the orb to start a voice conversation with ABA."}
          </p>
          
          {/* Recent message preview */}
          {messages.length>0&&messages[messages.length-1].role==="aba"&&<div style={{position:"absolute",bottom:160,maxWidth:320,padding:"12px 16px",background:"rgba(0,0,0,.4)",backdropFilter:"blur(12px)",borderRadius:16,border:"1px solid rgba(255,255,255,.08)"}}>
            <p style={{color:"rgba(255,255,255,.7)",fontSize:12,margin:0,lineHeight:1.5,maxHeight:60,overflow:"hidden"}}>{messages[messages.length-1].content.substring(0,150)}{messages[messages.length-1].content.length>150?"...":""}</p>
          </div>}
        </div>}
      </div>
      </>}
      
      {/* Briefing Mode */}
      {mainTab==="briefing"&&<BriefingView data={briefingData} loading={briefingLoading} onRefresh={async()=>{
        setBriefingLoading(true);
        const data=await fetchBriefing(user?.email||"brandon");
        setBriefingData(data);
        setBriefingLoading(false);
      }}/>}
      
      {/* Approve Mode */}
      {mainTab==="approve"&&<ApproveView userId={user?.email||"brandon"}/>}
    </div>
    <Sidebar open={sidebarOpen} convos={convos} activeId={activeId} onSelect={setActiveId} onCreate={()=>setNewChatModal(true)} onClose={()=>setSidebarOpen(false)} onDelete={deleteConv} onArchive={archiveConv} onShare={c=>setShareModal(c)} projects={projects} activeProject={activeProject} onSelectProject={setActiveProject} onCreateProject={()=>setNewChatModal(true)} onProjectDetail={p=>setProjectDetailModal(p)} user={user}/>
    <ShareModal open={!!shareModal} conversation={shareModal} onClose={()=>setShareModal(null)} onShare={shareConversation}/>
    <NewChatModal open={newChatModal} onClose={()=>setNewChatModal(false)} onCreate={(shared,projectId,projectName)=>{if(projectName){const pId=createProject(projectName);createConv(shared,pId)}else{createConv(shared,projectId)}}} projects={projects} onCreateProject={createProject}/>
    <ProjectDetailModal open={!!projectDetailModal} project={projectDetailModal} onClose={()=>setProjectDetailModal(null)} onRename={renameProject} onDelete={deleteProject} onAddFile={addFileToProject} onRemoveFile={removeFileFromProject}/>
    <Queue open={queueOpen} onToggle={()=>setQueueOpen(!queueOpen)} items={proactiveItems}/>
    <SettingsDrawer open={settingsOpen} onClose={()=>setSettingsOpen(false)} bg={bg} setBg={setBg} voiceOut={voiceOut} setVoiceOut={setVoiceOut} user={user} onLogout={async()=>{await signOutUser();setUser(null);setConvos([]);setActiveId(null)}}/>
    <ConnectionStatus online={online}/>
    {toast&&<Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)}/>}
  </div>)}
