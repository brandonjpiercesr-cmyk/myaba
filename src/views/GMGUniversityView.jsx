// ⬡B:MACE.phase3:VIEW:gmgu_cip_migrated:20260406⬡
// ⬡B:GMGU.layered:FEAT:cip_voice_orb:20260412⬡
// GMGUniversityView with FULL voice conversation support via ElevenLabs.
// Voice orb, chat/voice mode selector, preload with lesson plan injection,
// live captions, transcript capture. Matches standalone experience.

import { useState, useRef, useEffect, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
import { ABABASE } from "../utils/api.js";
import {
  VOL_META, TITLES, TOTAL_LESSONS, getNextLesson, lessonKey, lessonTitle,
  fetchCurriculum, blockLessonKey, getNextBlockLesson,
  fetchProgress, markLessonComplete, resetProgress as coreResetProgress,
  parseSSELine, extractDeck, checkLessonComplete,
  VOICE_CONFIG, buildGMGUAppContext, fireVoicePreload,
} from "../utils/gmgu-core.js";
// ⬡B:voice.rebuild.gmgu_cip_view.20260423⬡
// Vendored voice-core shared with gmg-university standalone (both branches)
// and OneABA CIB (forthcoming). Provides preloadSession as a HARD GATE:
// if preload fails, it throws — we DO NOT call startSession. Kills the
// silent-fail pattern that was in fireVoicePreload (gmgu-core.js).
import { preloadSession, generateConversationId, MuteButton, VOICE_LABELS } from "../aba-voice-core.jsx";
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
function LessonSidebar({ show, onClose, completedDays, onSelectBlock, onReset, currentLesson, curriculum, cohortType }) {
  if (!show) return null;
  const completed = completedDays || [];
  const blocks = curriculum?.blocks || [];
  const totalAll = blocks.reduce((s, b) => s + (b.days || []).length, 0);
  const totalDone = completed.length;
  const isFounder = cohortType === 'FOUNDER' || cohortType === 'INTERVIEW_MODE';
  // ⬡B:GMGU.layered:FIX:cip_lesson_locking:20260410⬡
  let nextUnlocked = null;
  for (const block of blocks) {
    for (let i = 0; i < (block.days || []).length; i++) {
      const key = 'b' + block.block + '-d' + (i + 1);
      if (!completed.includes(key)) { nextUnlocked = key; break; }
    }
    if (nextUnlocked) break;
  }
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
          {(block.days||[]).map((title,i)=>{const d=i+1;const k="b"+block.block+"-d"+d;const done=completed.includes(k);const cur=currentLesson?.block===block.block&&currentLesson?.day===d;const isNextUp=k===nextUnlocked;const isLocked=!isFounder&&!done&&!isNextUp;return(<button key={k} onClick={()=>{if(!isLocked){onSelectBlock(block.block,d,title,block.name);onClose();}}} style={{width:"100%",padding:"8px 14px",display:"flex",alignItems:"center",gap:8,background:cur?"rgba(124,58,237,.15)":"transparent",border:"none",cursor:isLocked?"not-allowed":"pointer",textAlign:"left",borderLeft:cur?"3px solid #7c3aed":"3px solid transparent",opacity:isLocked?0.35:1}}>
            <span style={{width:20,height:20,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:600,flexShrink:0,background:done?"rgba(16,185,129,.2)":isLocked?"rgba(255,255,255,.03)":"rgba(255,255,255,.06)",color:done?"#10b981":isLocked?"rgba(255,255,255,.15)":"rgba(255,255,255,.3)",border:"1px solid "+(done?"rgba(16,185,129,.3)":"rgba(255,255,255,.08)")}}>{done?"✓":isLocked?"🔒":d}</span>
            <span style={{color:done?"rgba(255,255,255,.5)":isLocked?"rgba(255,255,255,.25)":"rgba(255,255,255,.8)",fontSize:12,lineHeight:1.3}}>{title}</span>
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

  // ⬡B:GMGU.layered:FEAT:cip_voice_orb:20260412⬡
  // Voice conversation state — null=show mode selector, 'chat'=text, 'voice'=ElevenLabs orb
  const [interactionMode, setInteractionMode] = useState(null);
  const [orbState, setOrbState] = useState('idle');
  const [transcript, setTranscript] = useState([]);
  const [liveCaption, setLiveCaption] = useState('');
  const [statusText, setStatusText] = useState('Tap to start');
  const [errorMsg, setErrorMsg] = useState('');
  const captionRef = useRef(null);

  // ElevenLabs conversation hook
  const conversation = useConversation({
    onConnect: () => { setOrbState('listening'); setStatusText('Connected'); },
    onDisconnect: () => { setOrbState('idle'); setStatusText('Call ended'); },
    onMessage: ({ message, source }) => {
      if (source === 'ai') {
        setTranscript(prev => [...prev, { role: 'aba', text: message }]);
        setLiveCaption('');
      } else if (source === 'user') {
        setTranscript(prev => [...prev, { role: 'user', text: message }]);
      }
    },
    onModeChange: ({ mode }) => {
      if (mode === 'listening') setOrbState('listening');
      else if (mode === 'thinking') setOrbState('thinking');
      else if (mode === 'speaking') { setOrbState('speaking'); }
    },
    onError: (err) => { setOrbState('error'); setErrorMsg(err?.message || 'Connection error'); setStatusText('Error. Tap to retry.'); },
  });

  // Handle orb tap — start or stop voice session
  const handleOrbTap = useCallback(async () => {
    if (orbState === 'error') { setOrbState('idle'); setStatusText('Tap to start'); setErrorMsg(''); return; }
    if (conversation.status === 'connected') { await conversation.endSession(); return; }
    try {
      setOrbState('connecting'); setStatusText('Requesting microphone...');
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setStatusText('Preparing your session...');

      // ⬡B:voice.rebuild.gmgu_cip_view.hard_gate:20260423⬡
      // HARD GATE: preloadSession from aba-voice-core throws on failure. The
      // old fireVoicePreload in gmgu-core.js silently returned false on error
      // and the code continued to startSession anyway — that's the silent-fail
      // that hit gmg-university standalone on 2026-04-22 and is the same bug
      // pattern here in CIP. If preload can't land, we DO NOT start the
      // WebRTC session. User gets a clear error instead of receptionist.
      const convId = generateConversationId('gmgu_cip');
      const appContext = buildGMGUAppContext({
        lesson: currentLesson,
        userId: userEmail,
        userEmail: userEmail,
        cohortType: profile?.cohort_type,
        recentMessages: msgs
      });
      try {
        await preloadSession({
          userId: userEmail,
          conversationId: convId,
          appContext
        });
      } catch (preloadErr) {
        setOrbState('error');
        setErrorMsg(preloadErr.message || 'Preload failed');
        setStatusText(VOICE_LABELS.preloadFailed);
        console.error('[GMGU-CIP] Preload hard-gate failed:', preloadErr);
        return;
      }

      setStatusText('Connecting to ABA...');
      // ⬡B:voice.rebuild.gmgu_cip_view.customLlmExtraBody:20260423⬡
      // Propagate conversation_id end-to-end. Backend /v1/chat/completions
      // reads req.body.conversation_id and looks up vara_active_sessions
      // DIRECTLY — no "most recent session within 5 min" scan (which was the
      // cross-HAM race). Plus dynamicVariables as belt-and-suspenders so
      // ElevenLabs passes the id through every path it has.
      await conversation.startSession({
        agentId: VOICE_CONFIG.agentId,
        customLlmExtraBody: {
          conversation_id: convId,
          user_id: userEmail,
          app: 'gmgu_cip'
        },
        dynamicVariables: {
          conversation_id: convId,
          user_id: userEmail,
          email: userEmail
        }
      });
    } catch (err) {
      setOrbState('error'); setErrorMsg(err.message || 'Failed to connect');
      setStatusText(err.name === 'NotAllowedError' ? 'Microphone access denied.' : 'Connection failed. Tap to retry.');
    }
  }, [conversation, orbState, currentLesson, userEmail, profile, msgs]);

  // Auto-scroll captions
  useEffect(() => { if (captionRef.current) captionRef.current.scrollTop = captionRef.current.scrollHeight; }, [transcript, liveCaption]);

  // VOL_META imported from gmgu-core.js
  const VOL = Object.fromEntries(Object.entries(VOL_META).map(([k,v])=>([k,{t:v.short,f:v.name,d:v.days}])));
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
  // ⬡B:GMGU.layered:FIX:cip_backend_pairing_init:20260410⬡
  useEffect(() => {
    if (profile && curriculum && !initDone && !streaming) {
      setInitDone(true);
      const h = new Date().getHours();
      const greeting = h<12?"morning":h<17?"afternoon":"evening";
      (async () => {
        try {
          const nlRes = await fetch(ABABASE+"/api/gmg-university/next-lessons?email="+encodeURIComponent(userEmail));
          if (!nlRes.ok) throw new Error('next-lessons failed');
          const nl = await nlRes.json();
          // ⬡B:GMGU.ux:FIX:never_blank_init:20260416⬡
          // Instant static greeting so user NEVER sees blank screen.
          if (nl.mode === 'paired' && nl.nextLessons.length > 1) {
            const first = nl.nextLessons[0];
            const second = nl.nextLessons[1];
            setCurrentLesson({ block: first.block, day: first.day, title: first.title });
            setMsgs([{ role:'aba', text:`Good ${greeting}, ${firstName}. You have two sessions lined up today, and I want to get through both if we can.\n\n**${first.title}**\n**${second.title}**\n\nWhich one do you want to knock out first?` }]);
            return;
          }
          if ((nl.mode === 'paired' && nl.nextLessons.length === 1) || (nl.mode === 'single' && nl.nextLessons.length > 0)) {
            const lesson = nl.nextLessons[0];
            setCurrentLesson({ block:lesson.block, day:lesson.day, title:lesson.title });
            setMsgs([{ role:'aba', text:`Good ${greeting}, ${firstName}. Today we are covering "${lesson.title}." Ready when you are.` }]);
            return;
          }
          setMsgs([{ role:'aba', text:`Good ${greeting}, ${firstName}. You have completed everything so far. That is a serious accomplishment, and I hope you know that.` }]);
        } catch(e) {
          console.error('[GMG-U] Next lessons:', e.message);
          const next = getNextBlockLesson(profile?.completedDays, curriculum);
          if (next) {
            setCurrentLesson(next);
            setMsgs([{ role:'aba', text:`Good ${greeting}, ${firstName}. Today we are covering "${next.title}." Ready when you are.` }]);
          } else {
            setMsgs([{ role:'aba', text:`Good ${greeting}, ${firstName}. Welcome to GMG University.` }]);
          }
        }
      })();
    }
  }, [profile, curriculum, initDone]);

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
    setMsgs([]); setInitDone(false); setInteractionMode(null);
    setTimeout(() => { setInitDone(true);
      setMsgs([{ role:'aba', text:`"${title}" — ready when you are.` }]);
    }, 100);
  };
  const resetProgress = async () => {
    if (!userEmail) return;
    try { await fetch(ABABASE+"/api/gmg-university/progress",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:userEmail,completedDays:[],xp:0})}); } catch(e) { console.error("[GMG-U] Reset:",e.message); }
    setProfile(p=>({...p,completedDays:[],xp:0}));
    setMsgs([]); setInitDone(false); setCurrentLesson(null); setInteractionMode(null);
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
      while(true){const{done,value}=await reader.read();if(done)break;for(const line of decoder.decode(value,{stream:true}).split("\n").filter(l=>l.startsWith("data: "))){try{const d=JSON.parse(line.slice(6));if(d.type==="chunk"){acc+=d.text;sentBufRef.current+=d.text;setMsgs(prev=>{const c=[...prev];const l=c[c.length-1];if(l?.role==="aba")c[c.length-1]={...l,text:acc};return c;});if(sentBufRef.current.match(/[.!?]\s*$/)){speak(sentBufRef.current.trim());sentBufRef.current="";}}else if(d.type==="done"){const final=d.fullResponse||acc;setMsgs(prev=>{const c=[...prev];const l=c[c.length-1];if(l?.role==="aba")c[c.length-1]={...l,text:final,streaming:false};return c;});if(sentBufRef.current.trim())speak(sentBufRef.current.trim());const deckMatch=final.match(/\[DECK\](.*?)\[\/DECK\]/s); if(deckMatch){try{setDeckContent(JSON.parse(deckMatch[1].trim()));}catch(e){console.error("[GMG-U] Deck:",e);} } const cleanFinal=final.replace(/\[DECK\].*?\[\/DECK\]/sg,""); const shouldComplete=cleanFinal.includes("[LESSON_COMPLETE]"); if(shouldComplete)markComplete();}}catch(e){console.error('[GMG-U] SSE:',e.message);}}}
    } catch{setMsgs(prev=>{const c=[...prev];const l=c[c.length-1];if(l?.role==="aba")c[c.length-1]={...l,text:"Connection issue.",streaming:false};return c;});}
    finally{setStreaming(false);}
  };
  const handleSend=()=>{const msg=input.trim();if(!msg||streaming)return;setInput("");streamFromAIR(msg);};
  const toggleMic=()=>{if(!recognitionRef.current)return;if(listening){recognitionRef.current.stop();setListening(false);if(input.trim())setTimeout(()=>handleSend(),200);}else{setInput("");setListening(true);recognitionRef.current.start();}};
  const markComplete = async () => {
    if (!currentLesson||!userEmail) return;
    const k='b'+currentLesson.block+'-d'+currentLesson.day;
    if (profile?.completedDays?.includes(k)) return;
    try { const r=await fetch(ABABASE+"/api/gmg-university/progress",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:userEmail,completedKey:k})}); if(r.ok){const u=await r.json();setProfile(p=>({...p,...u}));setCurrentLesson(curriculum ? getNextBlockLesson(u.completedDays, curriculum) : null);} } catch(e){console.error("[GMG-U] Complete:",e.message);}
  };

  // Start a chat session (user picked "Chat" mode)
  // ⬡B:GMGU.ux:FEAT:streamed_greeting_from_air:20260414⬡
  // ABA already greeted via init stream. Chat mode just activates the input bar.
  const startChatMode = () => {
    setInteractionMode('chat');
  };

  // Start a voice session (user picked "Voice" mode)
  const startVoiceMode = () => {
    setInteractionMode('voice');
    setTranscript([]);
    setOrbState('idle');
    setStatusText('Tap to start');
  };

  if (!profile) return (<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><ABAConsciousness size={40}/></div>);

  const totalDone=(profile.completedDays||[]).length;
  const c = VOICE_CONFIG.orbColors[orbState] || VOICE_CONFIG.orbColors.idle;
  const isVoiceActive = orbState !== 'idle' && orbState !== 'error';

  return (<div style={{flex:1,display:"flex",flexDirection:"column",position:"relative",background:"rgba(10,10,15,.95)",overflow:"hidden",paddingTop:"env(safe-area-inset-top, 0px)"}}>
    <style>{"@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes msgIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes micPulse{0%,100%{box-shadow:0 0 0 0 rgba(124,58,237,.4)}50%{box-shadow:0 0 0 10px rgba(124,58,237,0)}}@keyframes dotBounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}@keyframes orbPulse{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.08);opacity:1}}@keyframes orbGlow{0%,100%{box-shadow:0 0 20px rgba(var(--orb-c),.3)}50%{box-shadow:0 0 40px rgba(var(--orb-c),.6)}}"}</style>
    <audio ref={audioRef}/>
    {/* HEADER */}
    <div style={{padding:"8px 12px",display:"flex",alignItems:"center",gap:8,borderBottom:"1px solid rgba(255,255,255,.06)",background:"rgba(10,10,15,.95)",flexShrink:0}}>
      <ABAConsciousness size={28}/>
      <div style={{flex:1,minWidth:0}}><p style={{color:"white",fontSize:14,fontWeight:600,margin:0}}>ABA</p><p style={{color:"rgba(255,255,255,.3)",fontSize:10,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentLesson?currentLesson.title:totalDone+"/"+(curriculum?.totalDays||"?")+" sessions"}</p></div>
      <button onClick={()=>setShowSidebar(true)} style={{background:"none",border:"none",color:"rgba(255,255,255,.4)",fontSize:18,cursor:"pointer",padding:"0 4px"}}>≡</button>
      {interactionMode === 'voice' && <button onClick={()=>{ if(conversation.status==='connected') conversation.endSession(); setInteractionMode('chat'); setOrbState('idle'); }} style={{background:"rgba(124,58,237,.12)",border:"1px solid rgba(124,58,237,.25)",borderRadius:6,padding:"4px 8px",cursor:"pointer",color:"#a78bfa",fontSize:11}}>Switch to Chat</button>}
      {interactionMode === 'chat' && <button onClick={()=>startVoiceMode()} style={{background:"rgba(124,58,237,.12)",border:"1px solid rgba(124,58,237,.25)",borderRadius:6,padding:"4px 8px",cursor:"pointer",color:"#a78bfa",fontSize:11}}>Switch to Voice</button>}
      {interactionMode === 'chat' && <button onClick={()=>setVoice(!voice)} style={{background:voice?"rgba(124,58,237,.12)":"transparent",border:"1px solid "+(voice?"rgba(124,58,237,.25)":"rgba(255,255,255,.06)"),borderRadius:6,padding:"4px 8px",cursor:"pointer",color:voice?"#a78bfa":"rgba(255,255,255,.2)",fontSize:11}}>{voice?"\ud83d\udd0a":"\ud83d\udd07"}</button>}
    </div>

    {/* ===== MODE SELECTOR (shown when no mode picked yet) ===== */}
    {interactionMode === null && msgs.length > 0 && (
      <div style={{flex:1,display:"flex",flexDirection:"column"}}>
        {/* Show the initial ABA message */}
        <div style={{flex:1,overflowY:"auto",padding:"8px 0"}}>
          {msgs.map((m,i)=>{const isAba=m.role==="aba";return(<div key={i} style={{display:"flex",alignItems:"flex-end",gap:6,justifyContent:isAba?"flex-start":"flex-end",padding:"2px 12px",animation:"msgIn .2s ease-out"}}>
            {isAba&&<ABAConsciousness size={24}/>}
            <div style={{maxWidth:"80%",padding:"9px 13px",borderRadius:isAba?"16px 16px 16px 4px":"16px 16px 4px 16px",background:isAba?"rgba(255,255,255,.06)":"rgba(124,58,237,.22)",border:"1px solid "+(isAba?"rgba(255,255,255,.05)":"rgba(124,58,237,.25)")}}>
              <p style={{color:"rgba(255,255,255,.88)",fontSize:13.5,lineHeight:1.6,whiteSpace:"pre-wrap",margin:0}}>{(m.text||"").split(/(\*\*.*?\*\*)/g).map((part,pi)=>part.startsWith("**")&&part.endsWith("**")?<strong key={pi} style={{color:"#a78bfa",fontWeight:600}}>{part.slice(2,-2)}</strong>:part)}</p>
            </div></div>);})}
        </div>
        {/* Mode selector buttons */}
        <div style={{padding:"16px 20px 24px",display:"flex",gap:12}}>
          <button onClick={startVoiceMode} style={{flex:1,padding:"16px 12px",borderRadius:16,border:"1px solid rgba(124,58,237,.3)",background:"rgba(124,58,237,.1)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth={1.5} width={28} height={28}><rect x={9} y={2} width={6} height={11} rx={3}/><path d="M5 11a7 7 0 0014 0"/><line x1={12} y1={18} x2={12} y2={22}/></svg>
            <span style={{color:"#a78bfa",fontSize:13,fontWeight:600}}>Voice Session</span>
            <span style={{color:"rgba(255,255,255,.35)",fontSize:10}}>Talk with ABA live</span>
          </button>
          <button onClick={startChatMode} style={{flex:1,padding:"16px 12px",borderRadius:16,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.04)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth={1.5} width={28} height={28}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            <span style={{color:"rgba(255,255,255,.7)",fontSize:13,fontWeight:600}}>Chat</span>
            <span style={{color:"rgba(255,255,255,.35)",fontSize:10}}>Type with ABA</span>
          </button>
        </div>
      </div>
    )}

    {/* ===== VOICE MODE ===== */}
    {interactionMode === 'voice' && (
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",position:"relative",padding:"16px 14px 0",gap:0}}>
        {/* Voice orb */}
        <div style={{flex:"0 0 auto",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 0 12px"}}>
          <div onClick={handleOrbTap} style={{width:120,height:120,borderRadius:"50%",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",background:`radial-gradient(circle at 40% 40%, rgba(${c},.4), rgba(${c},.15))`,border:`2px solid rgba(${c},.4)`,boxShadow:`0 0 ${isVoiceActive?40:20}px rgba(${c},.3)`,animation:isVoiceActive?"orbPulse 2s ease-in-out infinite":"none",transition:"all .3s ease"}}>
            {orbState === 'idle' && <svg viewBox="0 0 24 24" fill="none" stroke={`rgba(${c},1)`} strokeWidth={1.5} width={36} height={36}><rect x={9} y={2} width={6} height={11} rx={3}/><path d="M5 11a7 7 0 0014 0"/><line x1={12} y1={18} x2={12} y2={22}/></svg>}
            {orbState === 'connecting' && <div style={{width:24,height:24,border:"3px solid rgba(245,158,11,.3)",borderTop:"3px solid #f59e0b",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>}
            {(orbState === 'listening' || orbState === 'thinking' || orbState === 'speaking') && <div style={{width:40,height:40,borderRadius:"50%",background:`rgba(${c},.5)`,animation:"orbPulse 1.5s ease-in-out infinite"}}/>}
            {orbState === 'error' && <span style={{fontSize:28}}>⚠</span>}
          </div>
          <p style={{color:`rgba(${c},1)`,fontSize:11,fontWeight:600,letterSpacing:2,marginTop:10,textTransform:"uppercase"}}>{VOICE_CONFIG.orbLabels[orbState]}</p>
          {errorMsg && <p style={{color:"#ef4444",fontSize:11,marginTop:4,textAlign:"center",maxWidth:200}}>{errorMsg}</p>}
          {isVoiceActive && <button onClick={async()=>{await conversation.endSession();}} style={{marginTop:10,padding:"6px 16px",borderRadius:8,border:"1px solid rgba(239,68,68,.3)",background:"rgba(239,68,68,.1)",color:"#ef4444",fontSize:11,cursor:"pointer"}}>End Call</button>}
        </div>
        {/* Live captions */}
        <div ref={captionRef} style={{flex:1,width:"100%",overflowY:"auto",padding:"0 4px"}}>
          {transcript.map((t,i) => (
            <div key={i} style={{display:"flex",alignItems:"flex-end",gap:6,justifyContent:t.role==="aba"?"flex-start":"flex-end",padding:"2px 8px",animation:"msgIn .2s ease-out"}}>
              {t.role==="aba"&&<ABAConsciousness size={20}/>}
              <div style={{maxWidth:"80%",padding:"7px 11px",borderRadius:t.role==="aba"?"14px 14px 14px 4px":"14px 14px 4px 14px",background:t.role==="aba"?"rgba(255,255,255,.06)":"rgba(124,58,237,.18)",border:"1px solid "+(t.role==="aba"?"rgba(255,255,255,.05)":"rgba(124,58,237,.2)")}}>
                <p style={{color:"rgba(255,255,255,.75)",fontSize:12,lineHeight:1.5,margin:0}}>{t.text}</p>
              </div>
            </div>
          ))}
          {liveCaption && <div style={{padding:"2px 8px",textAlign:"right"}}><span style={{color:"rgba(124,58,237,.5)",fontSize:11,fontStyle:"italic"}}>{liveCaption}</span></div>}
        </div>
        <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      </div>
    )}

    {/* ===== CHAT MODE (existing iMessage experience) ===== */}
    {interactionMode === 'chat' && (<>
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
    </>)}

    {/* Loading state before init */}
    {interactionMode === null && msgs.length === 0 && (
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <ABAConsciousness size={40}/>
      </div>
    )}

    <LessonSidebar show={showSidebar} onClose={()=>setShowSidebar(false)} completedDays={profile?.completedDays} onSelectBlock={selectBlockLesson} curriculum={curriculum} onReset={resetProgress} currentLesson={currentLesson} cohortType={profile?.cohort_type}/>
    <DeckPanel deck={deckContent} onClose={()=>setDeckContent(null)}/>
  </div>);
}
