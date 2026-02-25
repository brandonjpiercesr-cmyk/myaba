// ⬡B:myaba.genesis:APP:v1.1.2:20260225⬡
// MyABA v1.1.2 — ABA's First True Body
// This file is SKIN. It has NO brain. ZERO hardcoded content.
// Every greeting, every status, every piece of text a user reads
// comes from AIR via REACH doing roll call on 78 agents.
// The skin just renders what AIR returns.

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Mic, MicOff, Volume2, VolumeX, MessageSquare, Radio, Hand,
  Settings, X, Plus, Bell, Mail, Calendar, Phone, Headphones,
  MessageCircle, Zap, Activity, Clock, CheckCircle, AlertTriangle,
  Sparkles, FileText, Eye, ChevronRight, User, LogOut, Users, Lock
} from "lucide-react";
import { auth, signInGoogle, signOutUser, saveConversation, loadConversations } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";

// ═══════════════════════════════════════════════════════════════════════════
// REACH — The Spine. Every interaction. ZERO local thinking.
// ═══════════════════════════════════════════════════════════════════════════
const REACH = "https://aba-reach.onrender.com";

// AIR roll call — sends request type and HAM identity, AIR decides which
// of the 78 agents to deploy and returns one intelligent response.
// The skin never decides what to say. AIR does.
async function airRequest(type, payload = {}, userId = "brandon") {
  try {
    const res = await fetch(`${REACH}/api/router`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: payload.message || "", type, userId, source: "myaba", context: { ...payload, timestamp: Date.now() } }),
    });
    if (!res.ok) throw new Error(`REACH ${res.status}`);
    return await res.json();
  } catch {
    return { response: null, error: true };
  }
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

// ═══════════════════════════════════════════════════════════════════════════
// NOISE + BLOB — ABA's organic energy presence
// ═══════════════════════════════════════════════════════════════════════════
class N{constructor(){this.p=Array.from({length:512},()=>Math.floor(Math.random()*256))}f(t){return t*t*t*(t*(t*6-15)+10)}l(t,a,b){return a+t*(b-a)}g(h,x,y){const u=(h&2)===0?x:y,v=(h&2)===0?y:x;return((h&1)?-u:u)+((h&2)?-v:v)}get(x,y){const X=Math.floor(x)&255,Y=Math.floor(y)&255;x-=Math.floor(x);y-=Math.floor(y);const u=this.f(x),v=this.f(y),A=this.p[X]+Y,B=this.p[X+1]+Y;return this.l(v,this.l(u,this.g(this.p[A],x,y),this.g(this.p[B],x-1,y)),this.l(u,this.g(this.p[A+1],x,y-1),this.g(this.p[B+1],x-1,y-1)))}}
const PAL={idle:{c:[[139,92,246],[167,139,250],[236,72,153],[99,102,241]],g:[139,92,246]},thinking:{c:[[245,158,11],[251,191,36],[239,68,68],[253,224,71]],g:[245,158,11]},speaking:{c:[[34,197,94],[16,185,129],[132,204,22],[45,212,191]],g:[34,197,94]},listening:{c:[[6,182,212],[59,130,246],[139,92,246],[147,197,253]],g:[6,182,212]}};

function Blob({state="idle",size=160}){
  const cvs=useRef(null),ns=useRef(new N()),st=useRef(state),fr=useRef(null);
  useEffect(()=>{st.current=state},[state]);
  useEffect(()=>{
    const c=cvs.current;if(!c)return;const ctx=c.getContext("2d"),dpr=Math.min(window.devicePixelRatio||1,2);
    c.width=size*dpr;c.height=size*dpr;ctx.scale(dpr,dpr);const ctr=size/2,n=ns.current;let t=0;
    const draw=()=>{const p=PAL[st.current]||PAL.idle;const spd=st.current==="thinking"?.025:st.current==="speaking"?.02:st.current==="listening"?.014:.012;
      t+=spd;ctx.clearRect(0,0,size,size);const g=p.g;const gr=ctx.createRadialGradient(ctr,ctr,size*.1,ctr,ctr,size*.48);
      gr.addColorStop(0,`rgba(${g[0]},${g[1]},${g[2]},.3)`);gr.addColorStop(.6,`rgba(${g[0]},${g[1]},${g[2]},.08)`);gr.addColorStop(1,`rgba(${g[0]},${g[1]},${g[2]},0)`);
      ctx.fillStyle=gr;ctx.fillRect(0,0,size,size);
      for(let l=0;l<4;l++){const cl=p.c[l],o=l*.7,bR=size*(.22-l*.025);ctx.beginPath();
        for(let i=0;i<=100;i++){const a=(i/100)*Math.PI*2;const n1=n.get(Math.cos(a)*2+t+o,Math.sin(a)*2+t*.7);const n2=n.get(Math.cos(a)*4+t*1.3+o,Math.sin(a)*4+t*.9)*.5;
          const r=bR+(n1+n2)*size*.09;const x=ctr+Math.cos(a)*r,y=ctr+Math.sin(a)*r;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)}
        ctx.closePath();ctx.fillStyle=`rgba(${cl[0]},${cl[1]},${cl[2]},${.6-l*.1})`;ctx.filter="blur(3px)";ctx.fill();ctx.filter="none"}
      fr.current=requestAnimationFrame(draw)};
    draw();return()=>cancelAnimationFrame(fr.current)},[size]);
  return <canvas ref={cvs} style={{width:size,height:size,display:"block",margin:"0 auto"}}/>;
}

// ═══════════════════════════════════════════════════════════════════════════
// BACKGROUNDS — Skin assets (not content, just visual chrome)
// ═══════════════════════════════════════════════════════════════════════════
const BG={blackLandscape:{u:"https://i.imgur.com/ZwVdgzN.jpeg",l:"Dark Horizon"},eventHorizon:{u:"https://i.imgur.com/A44TxCq.jpeg",l:"Event Horizon"},nebula:{u:"https://i.imgur.com/nLBRQ82.jpeg",l:"Nebula"},stormClouds:{u:"https://i.imgur.com/RRKjvgR.jpeg",l:"Storm Clouds"},wetCity:{u:"https://i.imgur.com/h8zNCw1.jpeg",l:"Wet City"},embers:{u:"https://i.imgur.com/9HZYnlX.png",l:"Embers"},earth:{u:"https://i.imgur.com/NOXQ3aM.png",l:"Earth"},pinkSmoke:{u:"https://i.imgur.com/3RkebB2.jpeg",l:"Pink Smoke"},mountainSnow:{u:"https://i.imgur.com/7Ffjcy2.png",l:"Mountain Snow"},motion:{u:"https://i.imgur.com/3hG18cp.jpeg",l:"Motion"},glassWindows:{u:"https://i.imgur.com/Kjjs7nt.jpeg",l:"Glass Windows"},particleLights:{u:"https://i.imgur.com/wLi9sGD.jpeg",l:"Particle Lights"},beach:{u:"https://i.imgur.com/YaH4lbp.jpeg",l:"Beach"},unity:{u:"https://i.imgur.com/IJAeq7t.png",l:"Unity"},threeGoats:{u:"https://i.imgur.com/jNJUq4u.png",l:"Three Goats"}};

// ═══════════════════════════════════════════════════════════════════════════
// MARKDOWN RENDERER
// ═══════════════════════════════════════════════════════════════════════════
function renderInline(t){const p=[];let r=t;const re=/\*\*(.+?)\*\*/g;let m,last=0,k=0;while((m=re.exec(r))!==null){if(m.index>last)p.push(r.slice(last,m.index));p.push(<strong key={`b${k++}`} style={{color:"rgba(255,255,255,.95)"}}>{m[1]}</strong>);last=m.index+m[0].length}if(last<r.length)p.push(r.slice(last));return p.length>0?p:t}
function renderMd(text){if(!text)return null;let c=text.replace(/^\[(warm|firm|thoughtful|gentle|encouraging|excited|celebratory|annoyed)\]\s*/i,"");const lines=c.split("\n"),blocks=[];let i=0;while(i<lines.length){const ln=lines[i];if(ln.startsWith("```")){const lang=ln.slice(3).trim();const code=[];i++;while(i<lines.length&&!lines[i].startsWith("```")){code.push(lines[i]);i++}i++;blocks.push(<pre key={`c${blocks.length}`} style={{background:"rgba(0,0,0,.4)",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,padding:"10px 12px",margin:"6px 0",overflowX:"auto",fontSize:11,lineHeight:1.5}}>{lang&&<span style={{color:"rgba(139,92,246,.5)",fontSize:9}}>{lang}</span>}<code style={{color:"rgba(134,239,172,.8)"}}>{code.join("\n")}</code></pre>);continue}if(ln.startsWith("### "))blocks.push(<p key={`h${i}`} style={{fontWeight:600,color:"rgba(255,255,255,.75)",fontSize:13,margin:"8px 0 2px"}}>{ln.slice(4)}</p>);else if(ln.startsWith("## "))blocks.push(<p key={`h${i}`} style={{fontWeight:700,color:"rgba(255,255,255,.85)",fontSize:14,margin:"8px 0 2px"}}>{ln.slice(3)}</p>);else if(ln.startsWith("- ")||ln.startsWith("* "))blocks.push(<p key={`li${i}`} style={{paddingLeft:12,color:"rgba(255,255,255,.7)",fontSize:13,margin:"2px 0"}}>• {renderInline(ln.slice(2))}</p>);else if(ln.trim())blocks.push(<p key={`p${i}`} style={{color:"rgba(255,255,255,.8)",fontSize:13,margin:"3px 0",lineHeight:1.55}}>{renderInline(ln)}</p>);i++}return blocks}

// ═══════════════════════════════════════════════════════════════════════════
// OUTPUT CARD — Rich expandable cards for ABA outputs
// ═══════════════════════════════════════════════════════════════════════════
function OutputCard({output}){const[exp,setExp]=useState(false);const icons={email:Mail,calendar:Calendar,call:Phone,omi:Headphones,sms:MessageCircle,doc:FileText,task:CheckCircle};const Icon=icons[output.type]||Zap;
  return(<div style={{background:"rgba(255,255,255,.05)",backdropFilter:"blur(16px)",border:"1px solid rgba(255,255,255,.1)",borderRadius:16,padding:"14px 16px",margin:"6px 0",boxShadow:"0 4px 20px rgba(0,0,0,.2)"}}>
    <div onClick={()=>setExp(!exp)} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}><div style={{width:32,height:32,borderRadius:10,background:"rgba(139,92,246,.15)",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon size={16} style={{color:"#8B5CF6"}}/></div><div style={{flex:1}}><div style={{color:"rgba(255,255,255,.9)",fontWeight:600,fontSize:13}}>{output.title}</div>{output.subtitle&&<div style={{color:"rgba(255,255,255,.4)",fontSize:11}}>{output.subtitle}</div>}</div><ChevronRight size={14} style={{color:"rgba(255,255,255,.3)",transform:exp?"rotate(90deg)":"none",transition:".2s"}}/></div>
    {exp&&output.preview&&<div style={{marginTop:10,padding:"10px 12px",background:"rgba(0,0,0,.2)",borderRadius:10,color:"rgba(255,255,255,.6)",fontSize:12,lineHeight:1.5}}>{output.preview}</div>}
    {exp&&output.actions&&<div style={{display:"flex",gap:8,marginTop:10}}><button style={{flex:1,padding:"8px 0",borderRadius:10,border:"none",cursor:"pointer",background:"rgba(34,197,94,.2)",color:"rgba(34,197,94,.9)",fontWeight:600,fontSize:12}}>Confirm</button><button style={{flex:1,padding:"8px 0",borderRadius:10,border:"none",cursor:"pointer",background:"rgba(239,68,68,.12)",color:"rgba(239,68,68,.7)",fontWeight:600,fontSize:12}}>Dismiss</button></div>}
  </div>)}

// ═══════════════════════════════════════════════════════════════════════════
// BUBBLE — iMessage-style with avatars
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
  return(<div style={{display:"flex",gap:4,padding:6,background:"rgba(0,0,0,.3)",borderRadius:14}}>{modes.map(m=>{const a=mode===m.k;const I=m.i;return(<button key={m.k} onClick={()=>setMode(m.k)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"8px 10px",borderRadius:10,border:"none",cursor:"pointer",background:a?"rgba(139,92,246,.25)":"transparent",color:a?"rgba(139,92,246,.95)":"rgba(255,255,255,.35)",fontSize:11,fontWeight:a?600:400,transition:"all .2s"}}><I size={14}/>{m.l}</button>)})}</div>)}

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN — Firebase Google Auth. Login text comes from AIR, not hardcoded.
// ═══════════════════════════════════════════════════════════════════════════
function Login({onLogin}){
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState(null);
  // Login greeting fetched from AIR — AIR decides what the login screen says
  const[loginText,setLoginText]=useState({title:"",subtitle:""});
  useEffect(()=>{airRequest("login_greeting",{}).then(d=>{if(d.response){try{const parsed=JSON.parse(d.response);setLoginText(parsed)}catch{setLoginText({title:d.response,subtitle:""})}}}).catch(()=>{})},[]);

  const go=async()=>{setLoading(true);setError(null);try{const result=await signInGoogle();onLogin(result.user)}catch(e){setError(e.message)}finally{setLoading(false)}};

  return(<div style={{position:"fixed",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#08080d",fontFamily:"'SF Pro Display',-apple-system,sans-serif"}}>
    <div style={{position:"absolute",inset:0,backgroundImage:`url(${BG.eventHorizon.u})`,backgroundSize:"cover",backgroundPosition:"center",filter:"brightness(.3) saturate(.6)"}}/>
    <div style={{position:"relative",zIndex:2,textAlign:"center",maxWidth:360,padding:"0 24px"}}>
      <div style={{marginBottom:32}}><Blob state="idle" size={120}/></div>
      <h1 style={{color:"white",fontSize:28,fontWeight:700,margin:"0 0 8px",background:"linear-gradient(135deg,#8B5CF6,#6366F1,#EC4899)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{loginText.title||"ABA"}</h1>
      <p style={{color:"rgba(255,255,255,.5)",fontSize:14,margin:"0 0 32px"}}>{loginText.subtitle||""}</p>
      <button onClick={go} disabled={loading} style={{width:"100%",padding:"16px 24px",borderRadius:16,border:"1px solid rgba(255,255,255,.1)",cursor:loading?"wait":"pointer",background:loading?"rgba(255,255,255,.05)":"linear-gradient(135deg,rgba(139,92,246,.3),rgba(99,102,241,.25))",color:"white",fontSize:15,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:10,boxShadow:"0 4px 20px rgba(139,92,246,.2)"}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        {loading?"Signing in...":"Continue with Google"}
      </button>
      {error&&<p style={{color:"#EF4444",fontSize:12,marginTop:12}}>{error}</p>}
      <p style={{color:"rgba(255,255,255,.15)",fontSize:10,marginTop:24}}>v1.1.2</p>
    </div>
  </div>)}

// ═══════════════════════════════════════════════════════════════════════════
// SIDEBAR — Chat history, solo/shared
// ═══════════════════════════════════════════════════════════════════════════
function Sidebar({open,convos,activeId,onSelect,onCreate,onClose,user}){if(!open)return null;const solo=convos.filter(c=>!c.shared);const shared=convos.filter(c=>c.shared);
  return(<div style={{position:"fixed",inset:0,zIndex:80,display:"flex"}}><div style={{width:280,height:"100%",background:"rgba(10,8,20,.97)",backdropFilter:"blur(24px)",borderRight:"1px solid rgba(139,92,246,.12)",display:"flex",flexDirection:"column",padding:"16px 12px"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,padding:"0 4px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:28,height:28,borderRadius:99,overflow:"hidden",background:"rgba(139,92,246,.3)",display:"flex",alignItems:"center",justifyContent:"center"}}>{user?.photoURL?<img src={user.photoURL} alt="" style={{width:"100%",height:"100%"}}/>:<User size={14} style={{color:"rgba(255,255,255,.6)"}}/>}</div><span style={{color:"rgba(255,255,255,.8)",fontSize:13,fontWeight:600}}>{user?.displayName||"User"}</span></div><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.3)"}}><X size={18}/></button></div>
    <button onClick={()=>{onCreate();onClose()}} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:12,border:"1px solid rgba(139,92,246,.2)",background:"rgba(139,92,246,.08)",color:"rgba(139,92,246,.9)",cursor:"pointer",fontWeight:600,fontSize:13,marginBottom:16}}><Plus size={16}/>New Chat</button>
    <div style={{flex:1,overflowY:"auto"}}>{solo.length>0&&<><div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",marginBottom:4}}><Lock size={11} style={{color:"rgba(255,255,255,.25)"}}/><span style={{color:"rgba(255,255,255,.3)",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Solo</span></div>{solo.map(c=>(<button key={c.id} onClick={()=>{onSelect(c.id);onClose()}} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"10px 12px",borderRadius:10,border:"none",cursor:"pointer",background:c.id===activeId?"rgba(139,92,246,.15)":"transparent",color:c.id===activeId?"rgba(255,255,255,.9)":"rgba(255,255,255,.5)",fontSize:12,textAlign:"left",marginBottom:2}}><MessageSquare size={14} style={{flexShrink:0,opacity:.5}}/><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title}</span></button>))}</>}
      {shared.length>0&&<><div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",marginTop:12,marginBottom:4}}><Users size={11} style={{color:"rgba(255,255,255,.25)"}}/><span style={{color:"rgba(255,255,255,.3)",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Shared</span></div>{shared.map(c=>(<button key={c.id} onClick={()=>{onSelect(c.id);onClose()}} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"10px 12px",borderRadius:10,border:"none",cursor:"pointer",background:c.id===activeId?"rgba(139,92,246,.15)":"transparent",color:c.id===activeId?"rgba(255,255,255,.9)":"rgba(255,255,255,.5)",fontSize:12,textAlign:"left",marginBottom:2}}><Users size={14} style={{flexShrink:0,opacity:.5}}/><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title}</span></button>))}</>}
    </div></div><div onClick={onClose} style={{flex:1,background:"rgba(0,0,0,.4)"}}/></div>)}

// ═══════════════════════════════════════════════════════════════════════════
// PROACTIVE QUEUE — Items fetched from REACH /api/presence, not hardcoded
// ═══════════════════════════════════════════════════════════════════════════
function Queue({open,onToggle,items}){
  const iconMap={briefing:Bell,email:Mail,meeting:Calendar,deadline:AlertTriangle,followup:Clock};const pColors={critical:"#EF4444",high:"#F59E0B",medium:"#3B82F6",low:"#6B7280"};
  if(!open)return(<button onClick={onToggle} style={{position:"fixed",bottom:80,right:14,width:48,height:48,borderRadius:99,background:items.length>0?"linear-gradient(135deg,#8B5CF6,#3B82F6)":"rgba(255,255,255,.08)",border:"none",boxShadow:"0 4px 20px rgba(0,0,0,.3)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",zIndex:50}}><Bell size={20}/>{items.length>0&&<div style={{position:"absolute",top:-2,right:-2,width:20,height:20,borderRadius:99,background:"#EF4444",color:"#fff",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center"}}>{items.length}</div>}</button>);
  return(<div style={{position:"fixed",bottom:80,right:14,width:340,maxHeight:420,background:"rgba(12,10,24,.97)",backdropFilter:"blur(20px)",borderRadius:16,border:"1px solid rgba(139,92,246,.25)",boxShadow:"0 20px 40px rgba(0,0,0,.4)",overflow:"hidden",zIndex:50,display:"flex",flexDirection:"column"}}>
    <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(139,92,246,.15)",display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(135deg,rgba(139,92,246,.08),rgba(59,130,246,.04))"}}><div style={{display:"flex",alignItems:"center",gap:8}}><Bell size={16} style={{color:"#8B5CF6"}}/><span style={{color:"white",fontWeight:600,fontSize:14}}>What ABA Cooked</span><span style={{background:"rgba(139,92,246,.25)",padding:"1px 8px",borderRadius:10,fontSize:11,color:"#C4B5FD"}}>{items.length}</span></div><button onClick={onToggle} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.4)"}}><X size={16}/></button></div>
    <div style={{flex:1,overflowY:"auto",padding:8}}>{items.length===0?<div style={{padding:24,textAlign:"center",color:"rgba(255,255,255,.3)",fontSize:13}}>All clear. ABA is keeping watch.</div>:items.map((item,idx)=>{const I=iconMap[item.type]||Bell;const col=pColors[item.priority]||"#6B7280";return(<div key={idx} style={{padding:"10px 12px",borderRadius:12,border:`1px solid ${col}25`,background:`${col}08`,marginBottom:6,display:"flex",gap:10,alignItems:"flex-start"}}><div style={{width:28,height:28,borderRadius:8,background:`${col}20`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><I size={14} style={{color:col}}/></div><div style={{flex:1}}><div style={{color:"rgba(255,255,255,.85)",fontSize:12,fontWeight:600}}>{item.title}</div><div style={{color:"rgba(255,255,255,.4)",fontSize:11,marginTop:2}}>{item.summary}</div></div></div>)})}</div>
  </div>)}

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════
function SettingsDrawer({open,onClose,bg,setBg,onLogout}){if(!open)return null;
  return(<div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"}}><div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(0,0,0,.6)"}}/><div style={{position:"relative",zIndex:101,width:"100%",maxWidth:480,background:"rgba(12,10,24,.98)",backdropFilter:"blur(24px)",border:"1px solid rgba(255,255,255,.08)",borderRadius:"24px 24px 0 0",padding:"24px 20px 32px",maxHeight:"75vh",overflowY:"auto"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}><span style={{color:"rgba(255,255,255,.9)",fontSize:16,fontWeight:700}}>Settings</span><button onClick={onClose} style={{background:"rgba(255,255,255,.08)",border:"none",color:"white",width:32,height:32,borderRadius:99,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={16}/></button></div>
    <p style={{color:"rgba(255,255,255,.35)",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>Background</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>{Object.entries(BG).map(([k,{u,l}])=>(<button key={k} onClick={()=>{setBg(k);onClose()}} style={{position:"relative",aspectRatio:"16/10",borderRadius:10,overflow:"hidden",border:bg===k?"2px solid rgba(139,92,246,.8)":"2px solid rgba(255,255,255,.06)",cursor:"pointer",background:"#111",padding:0,boxShadow:bg===k?"0 0 14px rgba(139,92,246,.4)":"none"}}><img src={u} alt={l} style={{width:"100%",height:"100%",objectFit:"cover",opacity:.8}}/><span style={{position:"absolute",bottom:0,left:0,right:0,padding:"10px 4px 4px",background:"linear-gradient(transparent,rgba(0,0,0,.8))",color:bg===k?"rgba(139,92,246,.95)":"rgba(255,255,255,.6)",fontSize:8,fontWeight:600,textAlign:"center"}}>{l}</span></button>))}</div>
    <button onClick={onLogout} style={{display:"flex",alignItems:"center",gap:8,width:"100%",marginTop:20,padding:"12px 16px",borderRadius:12,border:"1px solid rgba(239,68,68,.2)",background:"rgba(239,68,68,.06)",color:"rgba(239,68,68,.7)",cursor:"pointer",fontSize:13,fontWeight:600}}><LogOut size={16}/>Sign Out</button>
    <div style={{marginTop:16,padding:"12px 14px",background:"rgba(139,92,246,.05)",borderRadius:12,border:"1px solid rgba(139,92,246,.1)"}}><p style={{color:"rgba(139,92,246,.6)",fontSize:10,fontWeight:600,margin:0}}>MyABA v1.1.2</p></div>
  </div></div>)}

// ═══════════════════════════════════════════════════════════════════════════
// MYABA — The Vessel. The Skin. No brain here. All AIR.
// ═══════════════════════════════════════════════════════════════════════════
export default function MyABA(){
  const[user,setUser]=useState(null);const[authLoading,setAuthLoading]=useState(true);
  const[convos,setConvos]=useState([]);const[activeId,setActiveId]=useState(null);
  const activeConv=convos.find(c=>c.id===activeId);const messages=activeConv?.messages||[];
  const[input,setInput]=useState("");const[abaState,setAbaState]=useState("idle");
  const[isTyping,setIsTyping]=useState(false);const[bg,setBg]=useState("eventHorizon");
  const[settingsOpen,setSettingsOpen]=useState(false);const[sidebarOpen,setSidebarOpen]=useState(false);
  const[queueOpen,setQueueOpen]=useState(false);const[voiceMode,setVoiceMode]=useState("chat");
  const[voiceOut,setVoiceOut]=useState(true);const[isListening,setIsListening]=useState(false);
  const[liveActive,setLiveActive]=useState(false);
  const[proactiveItems,setProactiveItems]=useState([]);
  const scrollRef=useRef(null);const recorderRef=useRef(null);const liveRef=useRef(false);

  // Firebase auth state listener
  useEffect(()=>{const unsub=onAuthStateChanged(auth,(u)=>{setUser(u);setAuthLoading(false)});return()=>unsub()},[]);

  useEffect(()=>{if(scrollRef.current)scrollRef.current.scrollTop=scrollRef.current.scrollHeight},[messages,isTyping]);

  const createConv=useCallback((shared=false)=>{const id=`conv-${Date.now()}`;const conv={id,title:"New Chat",shared,messages:[],createdAt:Date.now(),updatedAt:Date.now(),autoNamed:false};setConvos(p=>[conv,...p]);setActiveId(id);return id},[]);
  const addMsg=useCallback((msg)=>{setConvos(p=>p.map(c=>c.id===activeId?{...c,messages:[...c.messages,msg],updatedAt:Date.now()}:c))},[activeId]);

  // On login: ask AIR for greeting (AIR does roll call on HAM, DAWN, PLAY, NOW, etc.)
  // Also fetch proactive items from REACH /api/presence
  useEffect(()=>{
    if(!user||convos.length>0)return;
    const id=createConv();
    // AIR decides the greeting — deploys whatever agents it needs
    airRequest("ham_greeting",{hamName:user.displayName,hamEmail:user.email,hamPhoto:user.photoURL},user.uid).then(data=>{
      const greeting=data.response||"";
      if(greeting){
        setConvos(p=>p.map(c=>c.id===id?{...c,messages:[{id:"w1",role:"aba",content:greeting,timestamp:Date.now()}]}:c));
        if(voiceOut){setAbaState("speaking");reachSynthesize(greeting).then(url=>{if(url){const a=new Audio(url);a.onended=()=>setAbaState("idle");a.play().catch(()=>setAbaState("idle"))}else setAbaState("idle")})}
      }
    });
    // Fetch what ABA has cooked (proactive queue from REACH)
    reachPresence(user.uid).then(d=>{if(d.items)setProactiveItems(d.items)});
  },[user]);

  // Auto-name chat after 5 messages — AIR names it, not local keyword extraction
  useEffect(()=>{
    if(!activeConv||activeConv.autoNamed||!user)return;
    if(activeConv.messages.length>=5){
      airNameChat(activeConv.messages,user.uid).then(name=>{
        if(name)setConvos(p=>p.map(c=>c.id===activeId?{...c,title:name,autoNamed:true}:c));
      });
    }
  },[messages.length,activeId]);

  // Save conversation to Firebase on changes
  useEffect(()=>{if(user&&activeConv&&activeConv.messages.length>0)saveConversation(user.uid,activeConv).catch(()=>{})},[activeConv?.messages?.length]);

  const sendMessage=useCallback(async(text,isVoice=false)=>{
    if(!text.trim())return;
    const userMsg={id:`u-${Date.now()}`,role:"user",content:text.trim(),timestamp:Date.now(),isVoice};
    addMsg(userMsg);setInput("");setIsTyping(true);setAbaState("thinking");
    const data=await airRequest("text",{message:text.trim(),conversationId:activeId},user?.uid);
    setIsTyping(false);
    const abaMsg={id:`a-${Date.now()}`,role:"aba",timestamp:Date.now(),content:data.response||data.message||"",output:data.actions?.[0]?{type:data.actions[0].type,title:data.actions[0].title,subtitle:data.actions[0].subtitle,preview:data.actions[0].preview,actions:true}:undefined};
    addMsg(abaMsg);
    if(voiceOut&&abaMsg.content){setAbaState("speaking");const url=await reachSynthesize(abaMsg.content);if(url){const a=new Audio(url);a.onended=()=>{setAbaState("idle");if(liveRef.current)startListening()};a.play().catch(()=>{setAbaState("idle");if(liveRef.current)startListening()})}else{setAbaState("idle");if(liveRef.current)startListening()}}else{setAbaState("idle");if(liveRef.current)startListening()}
  },[activeId,user,voiceOut,addMsg]);

  const startListening=useCallback(async()=>{
    try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});setIsListening(true);setAbaState("listening");
      const rec=new MediaRecorder(stream,{mimeType:"audio/webm"});const chunks=[];rec.ondataavailable=e=>chunks.push(e.data);
      rec.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());setAbaState("thinking");setIsListening(false);const blob=new Blob(chunks,{type:"audio/webm"});const transcript=await reachTranscribe(blob);if(transcript)sendMessage(transcript,true);else{setAbaState("idle");if(liveRef.current)setTimeout(startListening,500)}};
      recorderRef.current=rec;rec.start();if(voiceMode!=="push")setTimeout(()=>{if(rec.state==="recording")rec.stop()},10000);
    }catch{setIsListening(false);setAbaState("idle")}
  },[sendMessage,voiceMode]);

  const stopListening=useCallback(()=>{if(recorderRef.current?.state==="recording")recorderRef.current.stop()},[]);
  const toggleLive=useCallback(()=>{if(liveActive){liveRef.current=false;setLiveActive(false);stopListening();setAbaState("idle")}else{liveRef.current=true;setLiveActive(true);setVoiceMode("live");startListening()}},[liveActive,startListening,stopListening]);
  const handleKey=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage(input)}};

  if(authLoading)return <div style={{position:"fixed",inset:0,background:"#08080d",display:"flex",alignItems:"center",justifyContent:"center"}}><Blob state="thinking" size={100}/></div>;
  if(!user)return <Login onLogin={setUser}/>;

  const sc=abaState==="thinking"?"245,158,11":abaState==="speaking"?"34,197,94":abaState==="listening"?"6,182,212":"139,92,246";
  const bgUrl=BG[bg]?.u||BG.eventHorizon.u;

  return(<div style={{width:"100%",height:"100vh",position:"relative",overflow:"hidden",fontFamily:"'SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",background:"#08080d"}}>
    <style>{`@keyframes mp{0%,100%{opacity:.3;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}@keyframes mf{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes mb{0%,100%{opacity:.6}50%{opacity:1}}@keyframes ml{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.4)}50%{box-shadow:0 0 0 12px rgba(239,68,68,0)}}*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(139,92,246,.15);border-radius:99px}`}</style>
    <div style={{position:"absolute",inset:0,zIndex:0,backgroundImage:`url(${bgUrl})`,backgroundSize:"cover",backgroundPosition:"center",filter:"brightness(.4) saturate(.7)",transition:"all 1s"}}/>
    <div style={{position:"absolute",inset:0,zIndex:1,background:"radial-gradient(ellipse at center,rgba(0,0,0,0) 0%,rgba(0,0,0,.55) 100%)"}}/>
    <div style={{position:"relative",zIndex:2,display:"flex",flexDirection:"column",height:"100%",maxWidth:480,margin:"0 auto",padding:"0 14px"}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 2px 4px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>setSidebarOpen(true)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.5)",padding:0,display:"flex"}}><MessageSquare size={18}/></button>
          <div style={{width:8,height:8,borderRadius:99,background:`rgba(${sc},.9)`,boxShadow:`0 0 10px rgba(${sc},.6)`,animation:"mb 3s ease infinite"}}/>
          <span style={{color:"rgba(255,255,255,.75)",fontSize:14,fontWeight:700,letterSpacing:.5}}>MyABA</span>
          {liveActive&&<span style={{background:"rgba(239,68,68,.2)",color:"#EF4444",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:99,animation:"ml 2s infinite",letterSpacing:1}}>LIVE</span>}
          <span style={{color:"rgba(255,255,255,.2)",fontSize:10}}>{abaState!=="idle"?(abaState==="thinking"?"thinking...":abaState==="speaking"?"speaking...":"listening..."):""}</span>
        </div>
        <div style={{display:"flex",gap:4}}>
          <button onClick={()=>setVoiceOut(!voiceOut)} style={{background:voiceOut?"rgba(139,92,246,.15)":"rgba(255,255,255,.04)",border:`1px solid ${voiceOut?"rgba(139,92,246,.2)":"rgba(255,255,255,.06)"}`,color:voiceOut?"rgba(139,92,246,.85)":"rgba(255,255,255,.3)",borderRadius:99,width:32,height:32,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{voiceOut?<Volume2 size={15}/>:<VolumeX size={15}/>}</button>
          <button onClick={()=>setSettingsOpen(true)} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.06)",color:"rgba(255,255,255,.3)",borderRadius:99,width:32,height:32,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Settings size={15}/></button>
        </div>
      </div>
      <div style={{flexShrink:0,padding:"4px 0"}}><VoiceMode mode={voiceMode} setMode={m=>{setVoiceMode(m);if(m!=="live"&&liveActive){liveRef.current=false;setLiveActive(false);stopListening()}}}/></div>
      <div style={{flexShrink:0,display:"flex",justifyContent:"center",padding:"2px 0",transition:"all .5s"}}><Blob state={abaState} size={messages.length<=1?140:70}/></div>
      <div ref={scrollRef} style={{flex:1,overflowY:"auto",padding:"4px 2px",display:"flex",flexDirection:"column",gap:2,maskImage:"linear-gradient(transparent 0%,black 2%,black 96%,transparent 100%)",WebkitMaskImage:"linear-gradient(transparent 0%,black 2%,black 96%,transparent 100%)"}}>
        {messages.map(msg=><div key={msg.id} style={{animation:"mf .3s ease"}}><Bubble msg={msg} userPhoto={user?.photoURL}/></div>)}
        {isTyping&&<Typing/>}
      </div>
      {/* Input */}
      <div style={{flexShrink:0,padding:"6px 0 14px"}}>
        {voiceMode==="chat"&&<div style={{display:"flex",gap:8,alignItems:"flex-end"}}><div style={{flex:1,display:"flex",alignItems:"center",background:"rgba(255,255,255,.05)",backdropFilter:"blur(12px)",border:"1px solid rgba(255,255,255,.08)",borderRadius:24,padding:"0 6px 0 16px",minHeight:48}}><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey} placeholder="" style={{flex:1,background:"none",border:"none",outline:"none",color:"rgba(255,255,255,.9)",fontSize:14,padding:"12px 0"}}/><button onClick={()=>{if(!isListening)startListening();else stopListening()}} style={{width:36,height:36,borderRadius:99,border:"none",cursor:"pointer",background:isListening?"rgba(6,182,212,.2)":"rgba(255,255,255,.05)",color:isListening?"rgba(6,182,212,.95)":"rgba(255,255,255,.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{isListening?<MicOff size={16}/>:<Mic size={16}/>}</button></div><button onClick={()=>sendMessage(input)} disabled={!input.trim()} style={{width:48,height:48,borderRadius:99,border:"none",cursor:input.trim()?"pointer":"default",background:input.trim()?"rgba(139,92,246,.4)":"rgba(255,255,255,.04)",color:input.trim()?"white":"rgba(255,255,255,.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:input.trim()?"0 0 16px rgba(139,92,246,.25)":"none"}}><Send size={18}/></button></div>}
        {voiceMode==="push"&&<div style={{display:"flex",justifyContent:"center"}}><button onMouseDown={startListening} onMouseUp={stopListening} onTouchStart={startListening} onTouchEnd={stopListening} style={{width:80,height:80,borderRadius:99,border:`3px solid ${isListening?"rgba(6,182,212,.6)":"rgba(139,92,246,.3)"}`,background:isListening?"rgba(6,182,212,.15)":"rgba(139,92,246,.08)",color:isListening?"rgba(6,182,212,.95)":"rgba(139,92,246,.7)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,boxShadow:isListening?"0 0 30px rgba(6,182,212,.3)":"0 0 20px rgba(139,92,246,.15)"}}><Hand size={24}/><span style={{fontSize:9,fontWeight:600}}>{isListening?"Release":"Hold"}</span></button></div>}
        {voiceMode==="live"&&<div style={{display:"flex",justifyContent:"center"}}><button onClick={toggleLive} style={{width:80,height:80,borderRadius:99,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,border:`3px solid ${liveActive?"rgba(239,68,68,.6)":"rgba(139,92,246,.3)"}`,background:liveActive?"rgba(239,68,68,.12)":"rgba(139,92,246,.08)",color:liveActive?"rgba(239,68,68,.9)":"rgba(139,92,246,.7)",boxShadow:liveActive?"0 0 30px rgba(239,68,68,.25)":"0 0 20px rgba(139,92,246,.15)",animation:liveActive?"ml 2s infinite":"none"}}><Radio size={24}/><span style={{fontSize:9,fontWeight:600}}>{liveActive?"End":"Go Live"}</span></button></div>}
      </div>
    </div>
    <Sidebar open={sidebarOpen} convos={convos} activeId={activeId} onSelect={setActiveId} onCreate={()=>createConv()} onClose={()=>setSidebarOpen(false)} user={user}/>
    <Queue open={queueOpen} onToggle={()=>setQueueOpen(!queueOpen)} items={proactiveItems}/>
    <SettingsDrawer open={settingsOpen} onClose={()=>setSettingsOpen(false)} bg={bg} setBg={setBg} onLogout={async()=>{await signOutUser();setUser(null);setConvos([]);setActiveId(null)}}/>
  </div>)}
