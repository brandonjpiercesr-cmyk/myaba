// ⬡B:MACE.phase3:VIEW:gmgu_cip_migrated:20260406⬡
// GMGUniversityView + QuizDeckCIP + DeckPanel + LessonSidebar
// Extracted from MyABA.jsx lines 567-759. Zero logic changes.

import { useState, useRef, useEffect } from "react";
import { ABABASE } from "../utils/api.js";
import {
  VOL_META, TITLES, TOTAL_LESSONS, getNextLesson, lessonKey, lessonTitle,
  fetchCurriculum, blockLessonKey, getNextBlockLesson,
  fetchProgress, markLessonComplete, resetProgress as coreResetProgress,
  parseSSELine, extractDeck, checkLessonComplete,
} from "../utils/gmgu-core.js";
import { ABAPresence } from '../ABAPresence.jsx';
const ABAConsciousness = ABAPresence;

function QuizDeckCIP({ deck, glass }) {
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const correct = deck.correct;
  const handlePick = (opt, i) => { if (revealed) return; setSelected(i); setRevealed(true); };
  const isCorrect = (opt, i) => { if (!revealed) return null; if (opt === correct || String.fromCharCode(65+i) === correct) return "correct"; if (i === selected) return "wrong"; return null; };
  return (<div>
    <p style={{color:"rgba(255,255,255,0.85)",fontSize:14,lineHeight:1.6,marginBottom:14}}>{deck.question}</p>
    {(deck.options||[]).map((opt,i)=>{const r=isCorrect(opt,i);return(<button key={i} onClick={()=>handlePick(opt,i)} style={{width:"100%",marginBottom:8,textAlign:"left",cursor:revealed?"default":"pointer",background:r==="correct"?"rgba(16,185,129,.12)":r==="wrong"?"rgba(239,68,68,.08)":"rgba(255,255,255,.06)",border:"1px solid "+(r==="correct"?"rgba(16,185,129,.4)":r==="wrong"?"rgba(239,68,68,.4)":"rgba(255,255,255,.08)"),borderRadius:12,padding:14,color:r==="correct"?"#10b981":r==="wrong"?"#ef4444":"rgba(255,255,255,.8)",fontSize:13}}>{String.fromCharCode(65+i)}. {opt}{r==="correct"&&" ✓"}{r==="wrong"&&" ✗"}</button>);})}
    {revealed&&<p style={{color:selected!==null&&isCorrect(deck.options[selected],selected)==="correct"?"#10b981":"#ef4444",fontSize:13,marginTop:8,fontWeight:500}}>{isCorrect(deck.options[selected],selected)==="correct"?"Correct!":"Not quite. The answer is "+correct+"."}</p>}
  </div>);
}
function DeckPanel({ deck, onClose }) {
  if (!deck) return null;
  const glass = {background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:14};
  return (<div style={{position:"fixed",top:0,right:0,bottom:0,width:320,maxWidth:"90vw",background:"rgba(10,10,15,.95)",backdropFilter:"blur(24px)",borderLeft:"1px solid rgba(255,255,255,.08)",zIndex:40,display:"flex",flexDirection:"column"}}>
    <div style={{padding:"12px 14px",borderBottom:"1px solid rgba(255,255,255,.06)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <span style={{color:"#a78bfa",fontSize:13,fontWeight:600}}>{deck.title||"Interactive"}</span>
      <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,.4)",fontSize:18,cursor:"pointer"}}>×</button>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:14}}>
      {deck.type==="quiz"&&<QuizDeckCIP deck={deck} glass={glass}/>}
      {deck.type==="matching"&&<div>{(deck.pairs||[]).map((p,i)=>(<div key={i} style={{...glass,marginBottom:8,display:"flex",justifyContent:"space-between"}}><span style={{color:"rgba(255,255,255,.7)",fontSize:13}}>{p.left}</span><span style={{color:"#a78bfa",fontSize:13,fontWeight:500}}>{p.right}</span></div>))}</div>}
      {deck.type==="scenario"&&<div><div style={{...glass,marginBottom:14,borderColor:"rgba(124,58,237,.2)",background:"rgba(124,58,237,.08)"}}><p style={{color:"rgba(255,255,255,.85)",fontSize:14,lineHeight:1.6}}>{deck.situation}</p></div></div>}
    </div>
  </div>);
}
// ⬡B:audra.gmg_university.restructure:FIX:cip_block_sidebar:20260407⬡
function LessonSidebar({ show, onClose, completedDays, onSelectBlock, onReset, currentLesson, curriculum }) {
  if (!show) return null;
  const completed = completedDays || [];
  const blocks = curriculum?.blocks || [];
  const totalAll = blocks.reduce((s, b) => s + (b.days || []).length, 0);
  const totalDone = completed.length;
  return (<>
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:90}}/>
    <div style={{position:"fixed",top:0,left:0,bottom:0,width:280,maxWidth:"85vw",background:"rgba(15,15,20,.95)",backdropFilter:"blur(24px)",borderRight:"1px solid rgba(255,255,255,.08)",zIndex:91,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"16px 14px",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{color:"white",fontSize:15,fontWeight:600}}>Curriculum</span><button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,.4)",fontSize:22,cursor:"pointer"}}>×</button></div>
        <div style={{marginTop:10,display:"flex",alignItems:"center",gap:8}}>
          <div style={{flex:1,height:4,background:"rgba(255,255,255,.08)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",background:"linear-gradient(90deg,#7c3aed,#a78bfa)",borderRadius:2,width:totalAll>0?(totalDone/totalAll*100)+"%":"0%"}}/></div>
          <span style={{color:"rgba(255,255,255,.4)",fontSize:11}}>{totalDone}/{totalAll}</span>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"6px 0"}}>
        {blocks.map(block=>(<div key={block.block}>
          <div style={{padding:"10px 14px 4px",color:block.block===0?"#fbbf24":"#a78bfa",fontSize:10,fontWeight:600,letterSpacing:1.5,textTransform:"uppercase"}}>
            Block {block.block}{block.track&&block.track!=="UNASSIGNED"?" · "+block.track.replace(/_/g," "):""} — {block.name}
          </div>
          {(block.days||[]).map((title,i)=>{const d=i+1;const k="b"+block.block+"-d"+d;const done=completed.includes(k);const cur=currentLesson?.block===block.block&&currentLesson?.day===d;return(<button key={k} onClick={()=>{onSelectBlock(block.block,d,title,block.name);onClose();}} style={{width:"100%",padding:"8px 14px",display:"flex",alignItems:"center",gap:8,background:cur?"rgba(124,58,237,.15)":"transparent",border:"none",cursor:"pointer",textAlign:"left",borderLeft:cur?"3px solid #7c3aed":"3px solid transparent"}}>
            <span style={{width:20,height:20,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:600,flexShrink:0,background:done?"rgba(16,185,129,.2)":"rgba(255,255,255,.06)",color:done?"#10b981":"rgba(255,255,255,.3)",border:"1px solid "+(done?"rgba(16,185,129,.3)":"rgba(255,255,255,.08)")}}>{done?"✓":d}</span>
            <span style={{color:done?"rgba(255,255,255,.5)":"rgba(255,255,255,.8)",fontSize:12,lineHeight:1.3}}>{title}</span>
          </button>);})}
        </div>))}
      </div>
      <div style={{padding:10,borderTop:"1px solid rgba(255,255,255,.06)"}}><button onClick={()=>{if(window.confirm("Reset ALL progress?"))onReset();}} style={{width:"100%",padding:8,borderRadius:8,border:"1px solid rgba(239,68,68,.25)",background:"rgba(239,68,68,.06)",color:"#ef4444",fontSize:11,cursor:"pointer"}}>Reset Progress</button></div>
    </div>
  </>);
}

export default function GMGUniversityView({ userEmail: propEmail, userName: propName }) {
  // ⬡B:audra.gmg_university:FIX:cip_user_props:20260405⬡
  const userEmail = propEmail || window.__ABA_USER_EMAIL || "";
  const userName = propName || window.__ABA_USER_NAME || "there";
  const firstName = (userName || "there").split(" ")[0];

  const [profile, setProfile] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [voice, setVoice] = useState(true);
  const [currentLesson, setCurrentLesson] = useState(null);
  const [initDone, setInitDone] = useState(false);
  const [listening, setListening] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [deckContent, setDeckContent] = useState(null);
  const [curriculum, setCurriculum] = useState(null);
  const sentBufRef = useRef("");
  const audioRef = useRef();
  const endRef = useRef();
  const recognitionRef = useRef(null);
  const audioQueue = useRef([]);
  const isPlaying = useRef(false);

  // VOL_META imported from gmgu-core.js
  const VOL = Object.fromEntries(Object.entries(VOL_META).map(([k,v])=>([k,{t:v.short,f:v.name,d:v.days}])));
  // TITLES imported from gmgu-core.js
  const totalLessons = TOTAL_LESSONS;

  // Load curriculum from backend
  useEffect(() => {
    if (!profile) return;
    (async () => {
      try {
        const cohort = profile.cohort_type || 'FOUNDING_LINE';
        const track = profile.gmg_track || 'UNASSIGNED';
        const data = await fetchCurriculum(null, cohort, track);
        if (data) setCurriculum(data);
      } catch (e) { console.error('[GMG-U] Curriculum:', e.message); }
    })();
  }, [profile]);

  useEffect(() => { if (userEmail) loadProfile(); }, [userEmail]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs, streaming]);
  useEffect(() => {
    const unlock = () => { if (audioRef.current) { audioRef.current.play().then(()=>{audioRef.current.pause();audioRef.current.currentTime=0;}).catch(()=>{}); } };
    document.addEventListener("click", unlock, { once: true });
    return () => document.removeEventListener("click", unlock);
  }, []);
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) { const rec = new SR(); rec.continuous=false; rec.interimResults=true; rec.lang="en-US"; rec.onresult=e=>{setInput(Array.from(e.results).map(r=>r[0].transcript).join(""));if(e.results[0].isFinal)setListening(false);}; rec.onend=()=>setListening(false); rec.onerror=()=>setListening(false); recognitionRef.current=rec; }
  }, []);
  useEffect(() => {
    if (profile && !initDone && !streaming) {
      setInitDone(true);
      const next = curriculum ? getNextBlockLesson(profile?.completedDays, curriculum) : null;
      const h = new Date().getHours();
      let msg = "Good "+(h<12?"morning":h<17?"afternoon":"evening")+", this is "+firstName+". I just opened GMG University.";
        msg += ' My next lesson is Block ' + next.block + ' Day ' + next.day + ': "' + next.title + '". I have completed ' + (profile.completedDays||[]).length + ' of ' + (curriculum?.totalDays||'?') + ' lessons. Check my cohort_type and proceed accordingly.';
      else { msg += " I have completed all "+totalLessons+" lessons!"; }
      streamFromAIR(msg, true);
    }
  }, [profile, initDone]);

  const loadProfile = async () => {
    try {
      const r = await fetch(ABABASE+"/api/gmg-university/progress?email="+encodeURIComponent(userEmail));
      if (r.ok) { const p = await r.json(); setProfile({ email:userEmail, name:userName, ...p }); }
      else { setProfile({ email:userEmail, name:userName, completedDays:[], xp:0 }); }
    } catch (e) { console.error("[GMG-U] Load:", e.message); setProfile({ completedDays:[], xp:0 }); }
  };
  const getNext = () => getNextLesson(profile?.completedDays);
  const selectBlockLesson = (blockNum, dayNum, title, blockName) => {
    setCurrentLesson({block:blockNum,day:dayNum,title,blockName});
    setMsgs([]);
    setInitDone(false);
    setTimeout(() => {
      streamFromAIR(firstName + ' here. I want to do Block ' + blockNum + ' Day ' + dayNum + ': "' + title + '". Check my cohort_type and proceed accordingly.', true);
    }, 100);
  };
  const resetProgress = async () => {
    if (!userEmail) return;
    try { await fetch(ABABASE+"/api/gmg-university/progress",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:userEmail,completedDays:[],xp:0})}); } catch(e) { console.error("[GMG-U] Reset:",e.message); }
    setProfile(p=>({...p,completedDays:[],xp:0}));
    setMsgs([]); setInitDone(false); setCurrentLesson(null);
  };
  const speak = async (text) => { if (!voice||!text.trim()) return; try { const r=await fetch(ABABASE+"/api/tts/speak",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:text.substring(0,500)})}); if(r.ok){const url=URL.createObjectURL(await r.blob());audioQueue.current.push(url);playNext();} } catch(e){console.error('[GMG-U] TTS:',e.message);} };
  function playNext() { if(isPlaying.current||audioQueue.current.length===0)return; isPlaying.current=true; const url=audioQueue.current.shift(); if(audioRef.current){audioRef.current.src=url;audioRef.current.onended=()=>{isPlaying.current=false;URL.revokeObjectURL(url);playNext();};audioRef.current.onerror=()=>{isPlaying.current=false;URL.revokeObjectURL(url);playNext();};audioRef.current.play().catch(()=>{isPlaying.current=false;playNext();});} }

  const streamFromAIR = async (userMsg, isAutoInit=false) => {
    if (streaming) return; setStreaming(true);
    if (!isAutoInit) setMsgs(prev=>[...prev,{role:"user",text:userMsg}]);
    setMsgs(prev=>[...prev,{role:"aba",text:"",streaming:true}]);
    let acc=""; sentBufRef.current="";
    try {
      const history=msgs.slice(-20).map(m=>({role:m.role==="aba"?"assistant":"user",content:m.text||""})).filter(m=>m.content);
      const r=await fetch(ABABASE+"/api/air/stream",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:userMsg,user_id:userEmail,userId:userEmail,channel:"gmg-university",conversationHistory:history})});
      const reader=r.body.getReader(); const decoder=new TextDecoder();
      while(true){const{done,value}=await reader.read();if(done)break;for(const line of decoder.decode(value,{stream:true}).split("\n").filter(l=>l.startsWith("data: "))){try{const d=JSON.parse(line.slice(6));if(d.type==="chunk"){acc+=d.text;sentBufRef.current+=d.text;setMsgs(prev=>{const c=[...prev];const l=c[c.length-1];if(l?.role==="aba")c[c.length-1]={...l,text:acc};return c;});if(sentBufRef.current.match(/[.!?]\s*$/)){speak(sentBufRef.current.trim());sentBufRef.current="";}}else if(d.type==="done"){const final=d.fullResponse||acc;setMsgs(prev=>{const c=[...prev];const l=c[c.length-1];if(l?.role==="aba")c[c.length-1]={...l,text:final,streaming:false};return c;});if(sentBufRef.current.trim())speak(sentBufRef.current.trim());const deckMatch=final.match(/\[DECK\](.*?)\[\/DECK\]/s); if(deckMatch){try{setDeckContent(JSON.parse(deckMatch[1].trim()));}catch(e){console.error("[GMG-U] Deck:",e);} final=final.replace(/\[DECK\].*?\[\/DECK\]/s,"");} const shouldComplete=final.includes("[LESSON_COMPLETE]"); final=final.replace(/\[LESSON_STARTED\]/g,"").replace(/\[LESSON_COMPLETE\]/g,"").trim(); if(shouldComplete)markComplete();}}catch(e){console.error('[GMG-U] SSE:',e.message);}}}
    } catch{setMsgs(prev=>{const c=[...prev];const l=c[c.length-1];if(l?.role==="aba")c[c.length-1]={...l,text:"Connection issue.",streaming:false};return c;});}
    finally{setStreaming(false);}
  };
  const handleSend=()=>{const msg=input.trim();if(!msg||streaming)return;setInput("");streamFromAIR(msg);};
  const toggleMic=()=>{if(!recognitionRef.current)return;if(listening){recognitionRef.current.stop();setListening(false);if(input.trim())setTimeout(()=>handleSend(),200);}else{setInput("");setListening(true);recognitionRef.current.start();}};
  const markComplete = async () => {
    if (!currentLesson||!userEmail) return;
    const k=currentLesson.vol+"-d"+currentLesson.day;
    if (profile?.completedDays?.includes(k)) return;
    try { const r=await fetch(ABABASE+"/api/gmg-university/progress",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:userEmail,completedKey:k})}); if(r.ok){const u=await r.json();setProfile(p=>({...p,...u}));setCurrentLesson(getNext());} } catch(e){console.error("[GMG-U] Complete:",e.message);}
  };

  if (!profile) return (<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><ABAConsciousness size={40}/></div>);

  const totalDone=(profile.completedDays||[]).length;
  return (<div style={{flex:1,display:"flex",flexDirection:"column",position:"relative",background:"rgba(10,10,15,.95)",overflow:"hidden"}}>
    <style>{"@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes msgIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes micPulse{0%,100%{box-shadow:0 0 0 0 rgba(124,58,237,.4)}50%{box-shadow:0 0 0 10px rgba(124,58,237,0)}}@keyframes dotBounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}"}</style>
    <audio ref={audioRef}/>
    <div style={{padding:"8px 12px",display:"flex",alignItems:"center",gap:8,borderBottom:"1px solid rgba(255,255,255,.06)",background:"rgba(10,10,15,.95)",flexShrink:0}}>
      <ABAConsciousness size={28}/>
      <div style={{flex:1,minWidth:0}}><p style={{color:"white",fontSize:14,fontWeight:600,margin:0}}>ABA</p><p style={{color:"rgba(255,255,255,.3)",fontSize:10,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentLesson?"Day "+currentLesson.day+" · "+currentLesson.title:totalDone+"/"+totalLessons+" lessons"}</p></div>
      <button onClick={()=>setShowSidebar(true)} style={{background:"none",border:"none",color:"rgba(255,255,255,.4)",fontSize:18,cursor:"pointer",padding:"0 4px"}}>≡</button>
      <button onClick={()=>setVoice(!voice)} style={{background:voice?"rgba(124,58,237,.12)":"transparent",border:"1px solid "+(voice?"rgba(124,58,237,.25)":"rgba(255,255,255,.06)"),borderRadius:6,padding:"4px 8px",cursor:"pointer",color:voice?"#a78bfa":"rgba(255,255,255,.2)",fontSize:11}}>{voice?"\ud83d\udd0a":"\ud83d\udd07"}</button>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:"8px 0",paddingBottom:12}}>
      {msgs.length===0&&!streaming&&<div style={{textAlign:"center",padding:"40px 24px",color:"rgba(255,255,255,.1)"}}><p style={{fontSize:12}}>Starting session...</p></div>}
      {msgs.map((m,i)=>{const isAba=m.role==="aba";return(<div key={i} style={{display:"flex",alignItems:"flex-end",gap:6,justifyContent:isAba?"flex-start":"flex-end",padding:"2px 12px",animation:i===msgs.length-1?"msgIn .2s ease-out":"none"}}>
        {isAba&&<ABAConsciousness size={24}/>}
        <div style={{maxWidth:"80%",padding:"9px 13px",borderRadius:isAba?"16px 16px 16px 4px":"16px 16px 4px 16px",background:isAba?"rgba(255,255,255,.06)":"rgba(124,58,237,.22)",border:"1px solid "+(isAba?"rgba(255,255,255,.05)":"rgba(124,58,237,.25)")}}>
          <p style={{color:"rgba(255,255,255,.88)",fontSize:13.5,lineHeight:1.6,whiteSpace:"pre-wrap",margin:0}}>{(m.text||"").split(/(\*\*.*?\*\*)/g).map((part,pi)=>part.startsWith("**")&&part.endsWith("**")?<strong key={pi} style={{color:"#a78bfa",fontWeight:600}}>{part.slice(2,-2)}</strong>:part)}{m.streaming&&<span style={{display:"inline-block",width:2,height:14,background:"#a78bfa",marginLeft:2,animation:"pulse .8s infinite",verticalAlign:"text-bottom"}}/>}</p>
        </div></div>);})}
      {streaming&&msgs[msgs.length-1]?.text===""&&<div style={{display:"flex",alignItems:"flex-end",gap:6,padding:"2px 12px"}}><div style={{width:24,height:24,position:"relative"}}><div style={{position:"absolute",inset:0,borderRadius:"42% 58% 55% 45%/48% 42% 58% 52%",background:"linear-gradient(135deg,rgba(139,92,246,.85),rgba(236,72,153,.6),rgba(99,102,241,.7))",animation:"morph 4s ease-in-out infinite"}}/></div><div style={{background:"rgba(255,255,255,.06)",borderRadius:"16px 16px 16px 4px",padding:"10px 14px",display:"flex",gap:4}}>{[0,1,2].map(j=><div key={j} style={{width:5,height:5,borderRadius:"50%",background:"#a78bfa",animation:"dotBounce 1.2s ease-in-out "+j*.15+"s infinite"}}/>)}</div></div>}
      <div ref={endRef}/>
    </div>
    <div style={{flexShrink:0,background:"rgba(10,10,15,.85)",borderTop:"1px solid rgba(255,255,255,.06)",padding:10}}>
      <div style={{display:"flex",gap:6,alignItems:"flex-end"}}>
        <div style={{flex:1,display:"flex",alignItems:"flex-end",background:"rgba(255,255,255,.05)",borderRadius:18,border:"1px solid "+(listening?"rgba(124,58,237,.35)":"rgba(255,255,255,.06)"),padding:"2px 4px 2px 12px",minHeight:36}}>
          <textarea value={input} onChange={e=>{setInput(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,90)+"px";}} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSend();}}} placeholder={listening?"Listening...":"Message ABA..."} rows={1} disabled={streaming} style={{flex:1,background:"none",border:"none",outline:"none",color:listening?"#a78bfa":"rgba(255,255,255,.85)",fontSize:14,padding:"7px 0",resize:"none",lineHeight:1.35,maxHeight:90}}/>
          {input.trim()&&<button onClick={handleSend} disabled={streaming} style={{width:26,height:26,borderRadius:"50%",border:"none",background:"#7c3aed",color:"white",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,margin:3}}><svg viewBox="0 0 24 24" fill="currentColor" width={12} height={12}><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>}
        </div>
        {!input.trim()&&<button onClick={toggleMic} disabled={streaming} style={{width:36,height:36,borderRadius:"50%",border:"1px solid "+(listening?"transparent":"rgba(124,58,237,.2)"),background:listening?"#7c3aed":"rgba(124,58,237,.1)",color:listening?"white":"#a78bfa",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,animation:listening?"micPulse 1.5s infinite":"none"}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}><rect x={9} y={2} width={6} height={11} rx={3}/><path d="M5 11a7 7 0 0014 0"/><line x1={12} y1={18} x2={12} y2={22}/></svg></button>}
      </div>
    </div>
    <LessonSidebar show={showSidebar} onClose={()=>setShowSidebar(false)} completedDays={profile?.completedDays} onSelectBlock={selectBlockLesson} curriculum={curriculum} onReset={resetProgress} currentLesson={currentLesson}/>
    <DeckPanel deck={deckContent} onClose={()=>setDeckContent(null)}/>
  </div>);
}

