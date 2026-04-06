// ⬡B:MACE.phase2:VIEW:interview_migrated:20260406⬡
// InterviewModeView + MockInterviewVARA — extracted from MyABA.jsx.
// IRIS (Interview Readiness and Intelligence System) — CIP surface.

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Timer, Send, Loader2, ChevronRight, Target, Play, Square } from "lucide-react";
import { useConversation } from "@elevenlabs/react";
import { ABABASE, reachTranscribe } from "../utils/api.js";
import {
  INTERVIEW_MODES, STAR_COMPONENTS, isQuestion, formatTime,
  fetchTimCue as coreTimCue, cleanInterviewTitle,
  TIM_COOLDOWN, COOK_COOLDOWN, TIM_CUE_DURATION, TIM_CUE_MAX_AGE, TIM_CUE_MAX_VISIBLE,
} from "../utils/iris-core.js";

const api = async (path, opts = {}) => {
  const res = await fetch(ABABASE + path, {
    method: opts.method || "GET",
    headers: opts.body ? { "Content-Type": "application/json" } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return res.json();
};

function MockInterviewVARA({job, userId, onClose}){
  const[orbState,setOrbState]=useState("idle");
  const[statusText,setStatusText]=useState("Tap to start voice interview");
  const[transcript,setTranscript]=useState([]);
  const[errorMsg,setErrorMsg]=useState("");
  const thinkTimerRef=useRef(null);
  const currentMsgRef=useRef("");

  const conversation=useConversation({
    onConnect:()=>{setOrbState("listening");setStatusText("Listening... answer the question")},
    onDisconnect:()=>{setOrbState("idle");setStatusText("Interview ended")},
    onError:(msg)=>{setOrbState("error");setErrorMsg(String(msg));setStatusText("Error. Tap to retry.")},
    onMessage:({message,source})=>{
      if(source==="user"){
        if(currentMsgRef.current){setTranscript(p=>[...p,{from:"vara",text:currentMsgRef.current}]);currentMsgRef.current=""}
        setOrbState("thinking");setStatusText("VARA is thinking...")
      }
      if(source==="ai"){currentMsgRef.current+=message}
    },
    onModeChange:({mode})=>{
      clearTimeout(thinkTimerRef.current);
      if(mode==="speaking"){setOrbState("speaking");setStatusText("VARA is asking a question...")}
      else{
        if(currentMsgRef.current){setTranscript(p=>[...p,{from:"vara",text:currentMsgRef.current}]);currentMsgRef.current=""}
        thinkTimerRef.current=setTimeout(()=>{setOrbState("listening");setStatusText("Your turn — answer the question")},200)
      }
    }
  });

  const handleTap=useCallback(async()=>{
    if(orbState==="error"){setOrbState("idle");setStatusText("Tap to start voice interview");setErrorMsg("");return}
    if(conversation.status==="connected"){await conversation.endSession();return}
    try{
      setOrbState("connecting");setStatusText("Requesting microphone...");
      await navigator.mediaDevices.getUserMedia({audio:true});
      setStatusText("Connecting to VARA...");
      // Preload VARA with mock interview context
      try{
        await fetch(ABABASE+"/vara/preload",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
          userId,conversation_id:"mock_interview_"+Date.now(),
          mode:"mock_interview",
          jobTitle:job?.job_title||job?.title||"",
          jobOrg:job?.organization||job?.company||"",
          jobDescription:job?.description||"",
          instructions:"You are conducting a mock interview. Ask one question at a time. After the candidate answers, give brief feedback and a score out of 10, then ask the next question. Start with a warm greeting and your first question."
        })})
      }catch(pe){console.log("[MOCK] Preload failed (non-fatal):",pe.message)}
      await conversation.startSession({agentId:"agent_0601khe2q0gben08ws34bzf7a0sa",connectionType:"webrtc"});
    }catch(err){
      setOrbState("error");setErrorMsg(err.message||"Failed to connect");
      setStatusText(err.name==="NotAllowedError"?"Microphone access denied.":"Connection failed. Tap to retry.");
    }
  },[conversation,orbState,job,userId]);

  const colors={idle:"6,182,212",connecting:"245,158,11",listening:"139,92,246",thinking:"245,158,11",speaking:"16,185,129",error:"239,68,68"};
  const c=colors[orbState]||colors.idle;

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:1000,display:"flex",flexDirection:"column",alignItems:"center",padding:20}} onClick={e=>{if(e.target===e.currentTarget&&conversation.status!=="connected")onClose()}}>
      <div style={{width:"100%",maxWidth:400,display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
        {/* Header */}
        <div style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <p style={{color:"#22D3EE",fontSize:14,fontWeight:700,margin:0}}>Mock Interview</p>
            <p style={{color:"rgba(255,255,255,.5)",fontSize:11,margin:"2px 0 0"}}>{job?.job_title||job?.title} at {job?.organization||job?.company}</p>
          </div>
          <button onClick={async()=>{if(conversation.status==="connected")await conversation.endSession();onClose()}} style={{background:"rgba(255,255,255,.05)",border:"none",color:"rgba(255,255,255,.5)",cursor:"pointer",fontSize:18,width:32,height:32,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>

        {/* Orb */}
        <div onClick={handleTap} style={{width:140,height:140,borderRadius:"50%",background:`radial-gradient(circle at 40% 40%, rgba(${c},.4), rgba(${c},.1))`,border:`2px solid rgba(${c},.4)`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .3s",boxShadow:`0 0 ${orbState==="speaking"?40:orbState==="listening"?20:10}px rgba(${c},.3)`}}>
          <span style={{fontSize:11,color:`rgba(${c},1)`,fontWeight:600,textAlign:"center",padding:10}}>{orbState==="idle"?"TAP TO\nSTART":orbState==="connecting"?"...":orbState==="listening"?"LISTENING":orbState==="thinking"?"THINKING":orbState==="speaking"?"SPEAKING":"ERROR"}</span>
        </div>
        <p style={{color:"rgba(255,255,255,.5)",fontSize:11,textAlign:"center"}}>{statusText}</p>
        {errorMsg&&<p style={{color:"rgba(239,68,68,.7)",fontSize:10,textAlign:"center"}}>{errorMsg}</p>}

        {/* Transcript */}
        <div style={{width:"100%",maxHeight:300,overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
          {transcript.map((t,i)=>(
            <div key={i} style={{display:"flex",justifyContent:t.from==="vara"?"flex-start":"flex-end"}}>
              <div style={{maxWidth:"85%",padding:"8px 12px",borderRadius:t.from==="vara"?"12px 12px 12px 4px":"12px 12px 4px 12px",
                background:t.from==="vara"?"rgba(6,182,212,.15)":"rgba(139,92,246,.2)",
                color:t.from==="vara"?"rgba(6,182,212,.9)":"rgba(255,255,255,.85)",fontSize:12,lineHeight:1.4}}>
                {t.text}
              </div>
            </div>
          ))}
        </div>

        {conversation.status==="connected"&&<button onClick={async()=>{await conversation.endSession()}} style={{padding:"10px 20px",borderRadius:8,border:"none",background:"rgba(239,68,68,.2)",color:"rgba(239,68,68,.8)",cursor:"pointer",fontSize:12,fontWeight:600}}>End Interview</button>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AWA JOBS VIEW - Apply With ABA job listings
// ═══════════════════════════════════════════════════════════════════════════

export default function InterviewModeView({ userId }) {
  const [mode, setMode] = useState("prep");
  const modeRef_iv = useRef("prep");
  const [starAnswer, setStarAnswer] = useState("");
  const [starScoring, setStarScoring] = useState(null);
  const [starLoading, setStarLoading] = useState(false);
  const [starQuestion, setStarQuestion] = useState("Tell me about a time you led a team through a challenging situation.");
  const [research, setResearch] = useState(null);
  const [researchLoading, setResearchLoading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [prepData, setPrepData] = useState(null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [timCues, setTimCues] = useState([]);
  const [cookAnswers, setCookAnswers] = useState([]);
  const [activeCue, setActiveCue] = useState(null);
  const [cookStreaming, setCookStreaming] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mockQ, setMockQ] = useState(null);
  const [mockHistory, setMockHistory] = useState([]);
  const [mockAnswer, setMockAnswer] = useState("");
  const [mockLoading, setMockLoading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState(null);
  const recRef = useRef(null);
  const streamRef = useRef(null);
  const wsRef = useRef(null);
  const intervalRef = useRef(null);
  const secondsRef = useRef(0);
  const cueTimeoutRef = useRef(null);
  const transcriptRef = useRef([]);
  const analyserRef_iv = useRef(null);
  const audioCtxRef_iv = useRef(null);
  const hamSpeakerRef_iv = useRef(0);
  const lastSaidByHamRef_iv = useRef("");
  const lastTimFire_iv = useRef(0);
  const lastCookFire_iv = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${ABABASE}/api/awa/jobs?assignee=${encodeURIComponent(userId)}&limit=15`);
        if (res.ok) { const d = await res.json(); setJobs((d.jobs || d.data || []).slice(0, 15)); }
      } catch {}
    })();
  }, [userId]);

  useEffect(() => {
    if (running) { intervalRef.current = setInterval(() => { setSeconds(s => { secondsRef.current = s + 1; return s + 1; }); }, 1000); }
    else clearInterval(intervalRef.current);
    return () => clearInterval(intervalRef.current);
  }, [running]);
  useEffect(() => { modeRef_iv.current = mode; }, [mode]);

  const doResearch = async () => {
    if (!selectedJob) return;
    setResearchLoading(true);
    try {
      const r = await fetch(ABABASE+"/api/air/process", { method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ message:"Research "+selectedJob.organization+" for an interview for "+selectedJob.title+". Include: mission, recent news, culture, key leaders, interview questions specific to this org.",
          user_id:userId, channel:"myaba", appScope:"interview" }) });
      const d = await r.json(); setResearch(d.response||d.text||JSON.stringify(d));
    } catch { setResearch("Research failed. Try again."); }
    setResearchLoading(false);
  };
  const scoreSTAR = async () => {
    if (!starAnswer.trim()) return;
    setStarLoading(true);
    try {
      const r = await fetch(ABABASE+"/api/air/process", { method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ message:'Score this STAR interview answer 0-5 per component. Question: "'+starQuestion+'" Answer: "'+starAnswer+'" Return JSON: situation_score, task_score, action_score, result_score, total_percent (S=20% T=20% A=35% R=25%), coaching_tip. Only JSON.',
          user_id:userId, channel:"myaba", appScope:"interview" }) });
      const d = await r.json(); const text = d.response||d.text||"";
      try { setStarScoring(JSON.parse(text.match(/\{[\s\S]*\}/)?.[0]||text)); }
      catch { setStarScoring({coaching_tip:text,total_percent:0}); }
    } catch { setStarScoring({coaching_tip:"Scoring failed.",total_percent:0}); }
    setStarLoading(false);
  };

  const fmt = formatTime;
  const amber = (opacity) => `rgba(245,158,11,${opacity})`;

  const fetchTimCue = async (text, speakerId) => {
    try {
      const isHamTurn = hamSpeakerRef_iv.current !== null && (speakerId === null || speakerId === hamSpeakerRef_iv.current);
      const res = await fetch(`${ABABASE}/api/tim/cue`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript_chunk: text, context: transcriptRef.current.slice(-3).map(t=>t.text).join(" "), mode: "interview", job_title: selectedJob?.title, job_org: selectedJob?.organization, userId, whose_turn: isHamTurn ? "ham" : "other" })
      });
      if (res.ok) {
        const d = await res.json();
        if (d.cue) {
          const cue = { text: d.cue, type: d.type, time: fmt(secondsRef.current), latency: d.latency_ms };
          setTimCues(prev => {
            const now = Date.now();
            // Queue management: max 5 cues, drop stale (older than 30s), ALERT priority
            const fresh = [...prev, { ...cue, ts: now }].filter(c => now - (c.ts || 0) < 30000).slice(-5);
            return fresh;
          });
          setActiveCue(cue);
          clearTimeout(cueTimeoutRef.current);
          cueTimeoutRef.current = setTimeout(() => setActiveCue(null), 8000);
        }
      }
    } catch {}
  };

  const fetchCookAnswer = async (question) => {
    setCookStreaming(true);
    let fullText = "";
    try {
      const res = await fetch(`${ABABASE}/api/cook/answer`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: 'Interviewer said: "' + question + '" — Give a STAR-method answer. Always answer.', transcript_context: transcriptRef.current.map(t=>t.text).join(" "), tim_cues: timCues.slice(-3).map(c=>c.text), mode: "interview", job_title: selectedJob?.title, job_org: selectedJob?.organization, job_description: selectedJob?.description, userId, last_said_by_ham: lastSaidByHamRef_iv.current })
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter(l => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.type === "text") { fullText += parsed.text; setCookAnswers(prev => { const u = [...prev]; if (u.length > 0 && u[u.length-1].streaming) { u[u.length-1].text = fullText; } else { u.push({ q: question.substring(0, 80), text: fullText, time: fmt(secondsRef.current), streaming: true }); } return u; }); }
            if (parsed.type === "done") { setCookAnswers(prev => { const u = [...prev]; if (u.length > 0) u[u.length-1].streaming = false; return u; }); }
          } catch {}
        }
      }
    } catch { if (fullText) setCookAnswers(prev => { const u = [...prev]; if (u.length > 0) u[u.length-1].streaming = false; return u; }); }
    setCookStreaming(false);
  };

  const processSegment = async (text, speakerId) => {
    const hamSpeaker = hamSpeakerRef_iv.current;
    const isHam = hamSpeaker !== null && speakerId === hamSpeaker;
    if (isHam || speakerId === null) lastSaidByHamRef_iv.current = text;
    const now = Date.now();
    if (now - lastTimFire_iv.current >= TIM_COOLDOWN) {
      lastTimFire_iv.current = now;
      fetchTimCue(text, speakerId);
    }
    const isQuestion_iv = isQuestion(text);
    if (isQuestion_iv && now - lastCookFire_iv.current >= COOK_COOLDOWN) {
      lastCookFire_iv.current = now;
      setTimeout(() => fetchCookAnswer(text), 2000);
    }
  };

  const loadPrep = async (job) => {
    setSelectedJob(job); setPrepLoading(true);
    try {
      const res = await fetch(`${ABABASE}/api/awa/interview-prep`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job, userId })
      });
      if (res.ok) { const d = await res.json(); setPrepData(d.prep || d.response || d); }
    } catch {}
    setPrepLoading(false);
  };

  const startMock = async () => {
    setMode("mock"); setMockHistory([]); setMockLoading(true);
    try {
      const res = await fetch(`${ABABASE}/api/air/process`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `You are interviewing me for "${selectedJob?.title || "a professional position"}" at ${selectedJob?.organization || "an organization"}. Ask me one interview question. Just the question, nothing else.`, user_id: userId, channel: "myaba", appScope: "interview" })
      });
      const d = await res.json();
      setMockQ(d.response || "Tell me about yourself.");
    } catch { setMockQ("Tell me about yourself."); }
    setMockLoading(false);
  };

  const submitMockAnswer = async () => {
    if (!mockAnswer.trim()) return;
    setMockLoading(true);
    const answer = mockAnswer; setMockAnswer("");
    setMockHistory(prev => [...prev, { q: mockQ, a: answer, scoring: true }]);
    try {
      const res = await fetch(`${ABABASE}/api/air/process`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `Mock interview for "${selectedJob?.title || "a role"}" at ${selectedJob?.organization || "org"}.\nQuestion: "${mockQ}"\nAnswer: "${answer}"\n\nScore the answer using STAR components:\nSITUATION (20%): Did they set the scene with specific context?\nTASK (20%): Did they clarify their role and responsibility?\nACTION (35%): Did they describe specific actions THEY took?\nRESULT (25%): Did they quantify outcomes and impact?\n\nFormat:\nSCORE: X/10\nS: X/10 - [feedback]\nT: X/10 - [feedback]\nA: X/10 - [feedback]\nR: X/10 - [feedback]\nSTRENGTHS: ...\nIMPROVE: ...\nBETTER ANSWER: ...\nNEXT QUESTION: ...`, user_id: userId, channel: "myaba", appScope: "interview" })
      });
      const d = await res.json();
      const fullText = d.response || '';
      const scoreM = fullText.match(/SCORE:\s*(\d+)/i);
      const sM = fullText.match(/\bS:\s*(\d+)\/10\s*-?\s*(.+?)(?=\bT:|STRENGTHS|$)/is);
      const tM = fullText.match(/\bT:\s*(\d+)\/10\s*-?\s*(.+?)(?=\bA:|STRENGTHS|$)/is);
      const aM = fullText.match(/\bA:\s*(\d+)\/10\s*-?\s*(.+?)(?=\bR:|STRENGTHS|$)/is);
      const rM = fullText.match(/\bR:\s*(\d+)\/10\s*-?\s*(.+?)(?=STRENGTHS|IMPROVE|$)/is);
      const strM = fullText.match(/STRENGTHS?:\s*(.+?)(?=IMPROVE|BETTER|NEXT|$)/is);
      const impM = fullText.match(/IMPROVE:\s*(.+?)(?=BETTER|NEXT|$)/is);
      const betM = fullText.match(/BETTER ANSWER:\s*(.+?)(?=NEXT|$)/is);
      const nqM = fullText.match(/NEXT QUESTION:\s*(.+)/is);
      setMockHistory(prev => { const u = [...prev]; if (u.length > 0) { u[u.length-1] = { ...u[u.length-1], score: scoreM?scoreM[1]:"?", star: { s: sM?{score:sM[1],note:sM[2].trim()}:null, t: tM?{score:tM[1],note:tM[2].trim()}:null, a: aM?{score:aM[1],note:aM[2].trim()}:null, r: rM?{score:rM[1],note:rM[2].trim()}:null }, strengths: strM?strM[1].trim():"", improve: impM?impM[1].trim():"", better: betM?betM[1].trim():"", scoring: false }; } return u; });
      setMockQ(nqM ? nqM[1].trim() : "Tell me more about your experience.");
    } catch {}
    setMockLoading(false);
  };

  const toggleRecord = async () => {
    if (recording) { recRef.current?.stop(); streamRef.current?.getTracks().forEach(t=>t.stop()); if(wsRef.current&&wsRef.current.readyState===WebSocket.OPEN)wsRef.current.close(); wsRef.current=null; setRecording(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // ⬡B:CIP.IRIS:WEBSOCKET:deepgram_proxy:20260402⬡ WebSocket streaming
      const wsProto = ABABASE.startsWith('https') ? 'wss' : 'ws';
      const wsHost = ABABASE.replace('https://', '').replace('http://', '');
      const ws = new WebSocket(`${wsProto}://${wsHost}/api/voice/stream`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'Results' && msg.is_final) {
            const alt = msg.channel?.alternatives?.[0];
            const text = alt?.transcript || '';
            if (text && text.trim()) {
              const words = alt?.words || [];
              const speakerId_iv = words.length > 0 ? words[0].speaker : null;
              const entry = { text: text.trim(), time: fmt(secondsRef.current), speaker: speakerId_iv };
              setTranscript(prev => [...prev, entry]);
              transcriptRef.current = [...transcriptRef.current, entry];
              if (modeRef_iv.current === "mock") setMockAnswer(prev => prev ? prev + " " + text.trim() : text.trim());
              else processSegment(text.trim(), speakerId_iv);
            }
          }
        } catch (err) { /* ignore status messages */ }
      };
      ws.onerror = (err) => console.error('[IRIS] WebSocket error:', err);
      ws.onclose = () => console.log('[IRIS] WebSocket closed');

      await new Promise((resolve, reject) => {
        ws.onopen = () => { console.log('[IRIS] WebSocket connected'); resolve(); };
        setTimeout(() => reject(new Error('WebSocket timeout')), 5000);
      });

      const mimes = ["audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus",""];
      let mime = "";
      for (const m of mimes) { if (!m || MediaRecorder.isTypeSupported(m)) { mime = m; break; } }
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0 && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(e.data);
        }
      };
      rec.start(250); recRef.current = rec; setRecording(true);
      if (!running) setRunning(true);
    } catch { alert("Microphone access denied"); }
  };

  const endInterview = async () => {
    recRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close();
    wsRef.current = null;
    if(analyserRef_iv.current?.interval)clearInterval(analyserRef_iv.current.interval);
    if(audioCtxRef_iv.current){try{audioCtxRef_iv.current.close()}catch{}}
    analyserRef_iv.current=null; audioCtxRef_iv.current=null;
    setRunning(false); setRecording(false);
    if (transcriptRef.current.length > 0) {
      try {
        const res = await fetch(`${ABABASE}/api/meeting/summary`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: transcriptRef.current.map(t=>`[${t.time}] ${t.text}`).join("\n"), duration: fmt(seconds), mode: "interview", job_title: selectedJob?.title, job_org: selectedJob?.organization, userId })
        });
        if (res.ok) { const d = await res.json(); setSummary(d.summary || ""); }
      } catch {}
    }
  };

  const modeTab = (id, label, emoji) => <button onClick={()=>{ if(id==="mock"&&selectedJob) startMock(); else setMode(id); }} style={{
    flex:1,padding:"9px 0",borderRadius:10,border:"none",cursor:"pointer",fontSize:11,fontWeight:mode===id?700:400,
    letterSpacing: mode===id?"0.5px":"0",
    background:mode===id?`linear-gradient(135deg, ${amber(.2)}, ${amber(.08)})`:"transparent",
    color:mode===id?"#fbbf24":"rgba(255,255,255,.3)",transition:"all 0.3s ease",display:"flex",alignItems:"center",justifyContent:"center",gap:5
  }}>{typeof emoji==="string"?<span>{emoji}</span>:React.createElement(emoji,{size:12})}{label}</button>;

  // ═══════ RESEARCH MODE ═══════
  if (mode === "research") return (<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"linear-gradient(180deg, rgba(245,158,11,.03) 0%, transparent 40%)"}}>
    <div style={{display:"flex",gap:3,padding:"8px 10px",borderBottom:"1px solid rgba(245,158,11,.08)"}}>
      {modeTab("prep","Prep",FileText)}{modeTab("research","Research",Search)}{modeTab("practice","Practice",Award)}{modeTab("live","Live",Mic)}{modeTab("mock","Mock",Target)}
    </div>
    <div style={{flex:1,overflowY:"auto",padding:12}}>
      {!selectedJob?<p style={{color:"rgba(255,255,255,.4)",textAlign:"center",padding:40}}>Select a job first to research the company.</p>:<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div><p style={{color:"white",fontSize:14,fontWeight:600,margin:0}}>{selectedJob.organization}</p><p style={{color:"rgba(255,255,255,.4)",fontSize:11,margin:0}}>{selectedJob.title||selectedJob.job_title}</p></div>
          <button onClick={doResearch} disabled={researchLoading} style={{padding:"6px 14px",borderRadius:8,border:"none",background:"#d97706",color:"white",fontSize:11,cursor:"pointer",fontWeight:600}}>{researchLoading?"Researching...":research?"Refresh":"Research Company"}</button>
        </div>
        {research&&<div style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(245,158,11,.15)",borderRadius:10,padding:12}}><p style={{color:"rgba(255,255,255,.8)",fontSize:12,lineHeight:1.7,whiteSpace:"pre-wrap",margin:0}}>{research}</p></div>}
      </>}
    </div>
  </div>);
  // ═══════ PRACTICE MODE (STAR Coach) ═══════
  if (mode === "practice") return (<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"linear-gradient(180deg, rgba(245,158,11,.03) 0%, transparent 40%)"}}>
    <div style={{display:"flex",gap:3,padding:"8px 10px",borderBottom:"1px solid rgba(245,158,11,.08)"}}>
      {modeTab("prep","Prep",FileText)}{modeTab("research","Research",Search)}{modeTab("practice","Practice",Award)}{modeTab("live","Live",Mic)}{modeTab("mock","Mock",Target)}
    </div>
    <div style={{flex:1,overflowY:"auto",padding:12}}>
      <p style={{color:"#fbbf24",fontSize:10,fontWeight:600,letterSpacing:1,marginBottom:4}}>QUESTION:</p>
      <input value={starQuestion} onChange={e=>setStarQuestion(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid rgba(255,255,255,.15)",background:"rgba(255,255,255,.05)",color:"white",fontSize:12,marginBottom:10,boxSizing:"border-box"}}/>
      <p style={{color:"#fbbf24",fontSize:10,fontWeight:600,letterSpacing:1,marginBottom:4}}>YOUR ANSWER:</p>
      <textarea value={starAnswer} onChange={e=>setStarAnswer(e.target.value)} placeholder="Situation → Task → Action → Result" rows={8} style={{width:"100%",padding:10,borderRadius:8,border:"1px solid rgba(255,255,255,.15)",background:"rgba(255,255,255,.05)",color:"white",fontSize:12,resize:"vertical",boxSizing:"border-box",lineHeight:1.6}}/>
      <button onClick={scoreSTAR} disabled={starLoading||!starAnswer.trim()} style={{marginTop:8,padding:"10px 20px",borderRadius:8,border:"none",background:starLoading?"rgba(255,255,255,.1)":"#d97706",color:"white",fontSize:12,cursor:"pointer",fontWeight:600}}>{starLoading?"Scoring...":"Score My Answer"}</button>
      {starScoring&&<div style={{marginTop:16,background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.2)",borderRadius:12,padding:14}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
          {[["S",starScoring.situation_score,"20%"],["T",starScoring.task_score,"20%"],["A",starScoring.action_score,"35%"],["R",starScoring.result_score,"25%"]].map(([l,s,w])=><div key={l} style={{textAlign:"center",padding:8,borderRadius:8,background:"rgba(255,255,255,.05)"}}><p style={{color:"#fbbf24",fontSize:20,fontWeight:700,margin:0}}>{s||0}</p><p style={{color:"rgba(255,255,255,.4)",fontSize:9,margin:0}}>{l} ({w})</p></div>)}
        </div>
        <div style={{marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:3}}><span style={{color:"rgba(255,255,255,.4)"}}>Overall</span><span style={{color:(starScoring.total_percent||0)>=80?"#10b981":"#f59e0b"}}>{starScoring.total_percent||0}%</span></div><div style={{height:6,background:"rgba(255,255,255,.1)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:(starScoring.total_percent||0)+"%",background:(starScoring.total_percent||0)>=80?"#10b981":"#d97706",borderRadius:3,transition:"width .5s"}}/></div></div>
        {starScoring.coaching_tip&&<p style={{color:"rgba(255,255,255,.75)",fontSize:12,lineHeight:1.6,marginTop:8,padding:8,background:"rgba(255,255,255,.03)",borderRadius:8}}>{starScoring.coaching_tip}</p>}
      </div>}
    </div>
  </div>);
  // ═══════ PREP MODE ═══════
  if (mode === "prep") return (<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"linear-gradient(180deg, rgba(245,158,11,.03) 0%, transparent 40%)"}}>
    <div style={{display:"flex",gap:3,padding:"8px 10px",borderBottom:`1px solid ${amber(.08)}`}}>
      {modeTab("prep","Prep",FileText)}{modeTab("research","Research",Search)}{modeTab("practice","Practice",Award)}{modeTab("live","Live",Mic)}{modeTab("mock","Mock",Target)}
    </div>
    <div style={{flex:1,overflowY:"auto",padding:"10px 12px"}}>
      {/* ⬡B:CIP.IRIS:UI:cara_greeting:20260402⬡ */}
      <div style={{background:"rgba(255,255,255,.04)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:"14px 18px",marginBottom:10,display:"flex",gap:10,alignItems:"flex-start"}}>
        <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg, #6366F1, #8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <span style={{fontSize:14,fontWeight:900,color:"white"}}>A</span>
        </div>
        <div>
          <div style={{fontSize:9,fontWeight:700,color:"rgba(139,92,246,.6)",marginBottom:2}}>ABA</div>
          <p style={{fontSize:12,color:"rgba(255,255,255,.7)",margin:0,lineHeight:1.5}}>
            {selectedJob ? `Prepping for ${selectedJob.title||selectedJob.job_title} at ${selectedJob.organization}. Jump to Live when ready.` : "Hey! Pick a job below, or hit Quick Start to jump into your interview."}
          </p>
        </div>
      </div>
      <button onClick={()=>setMode("live")} style={{width:"100%",padding:"10px 16px",borderRadius:10,marginBottom:12,background:`linear-gradient(135deg, ${amber(.12)}, ${amber(.04)})`,border:`1px solid ${amber(.2)}`,color:"#FBBF24",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
        Quick Start — Live Mode
      </button>
      {!selectedJob ? (<>
        <p style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,.7)",margin:"0 0 10px"}}>Select a job to prepare for</p>
        {jobs.length===0 ? <p style={{textAlign:"center",padding:30,color:"rgba(255,255,255,.15)",fontSize:12}}>No jobs in pipeline yet.</p>
        : jobs.map((j,i) => <button key={j.id||i} onClick={()=>loadPrep(j)} style={{display:"block",width:"100%",textAlign:"left",padding:"12px 14px",marginBottom:6,borderRadius:14,background:"linear-gradient(135deg, rgba(255,255,255,.03), rgba(255,255,255,.01))",border:`1px solid ${amber(.08)}`,cursor:"pointer",color:"#fff",transition:"all 0.2s ease"}}>
          <p style={{fontSize:13,fontWeight:600,margin:0,color:"rgba(255,255,255,.85)"}}>{j.title||"Untitled"}</p>
          <p style={{fontSize:10,color:amber(.4),margin:"3px 0 0",fontWeight:500}}>{j.organization||""}</p>
        </button>)}
      </>) : (<>
        <button onClick={()=>{setSelectedJob(null);setPrepData(null)}} style={{background:"none",border:"none",color:amber(.5),cursor:"pointer",fontSize:11,padding:0,marginBottom:8,fontWeight:500}}>← Back to jobs</button>
        <div style={{padding:"14px 16px",borderRadius:14,background:`linear-gradient(135deg, ${amber(.06)}, ${amber(.02)})`,border:`1px solid ${amber(.12)}`,marginBottom:12}}>
          <p style={{fontSize:15,fontWeight:700,color:"rgba(255,255,255,.9)",margin:"0 0 3px"}}>{selectedJob.title}</p>
          <p style={{fontSize:11,color:amber(.5),margin:0,fontWeight:500}}>{selectedJob.organization}</p>
        </div>
        {prepLoading ? <div style={{textAlign:"center",padding:40}}><Loader2 size={20} style={{color:"#fbbf24",animation:"spin 1s linear infinite"}}/><p style={{fontSize:11,color:"rgba(255,255,255,.2)",marginTop:8}}>Generating prep package...</p></div>
        : prepData ? <div style={{fontSize:12.5,color:"rgba(255,255,255,.75)",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{typeof prepData === "string" ? prepData : JSON.stringify(prepData, null, 2)}</div>
        : null}
      </>)}
    </div>
  </div>);

  // ═══════ MOCK MODE ═══════
  if (mode === "mock") return (<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"linear-gradient(180deg, rgba(245,158,11,.03) 0%, transparent 40%)"}}>
    <div style={{display:"flex",gap:3,padding:"8px 10px",borderBottom:`1px solid ${amber(.08)}`}}>
      {modeTab("prep","Prep",FileText)}{modeTab("research","Research",Search)}{modeTab("practice","Practice",Award)}{modeTab("live","Live",Mic)}{modeTab("mock","Mock",Target)}
    </div>
    <div style={{flex:1,overflowY:"auto",padding:"10px 12px"}}>
      {mockHistory.map((h,i) => <div key={i} style={{marginBottom:14}}>
        <div style={{padding:"12px 14px",borderRadius:"14px 14px 4px 14px",background:`linear-gradient(135deg, ${amber(.08)}, ${amber(.03)})`,border:`1px solid ${amber(.12)}`,marginBottom:4}}>
          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}><span style={{fontSize:9,fontWeight:700,color:amber(.6),letterSpacing:"0.5px",textTransform:"uppercase"}}>Interviewer</span></div>
          <p style={{fontSize:12.5,color:"rgba(255,255,255,.8)",margin:0,lineHeight:1.6}}>{h.q}</p>
        </div>
        <div style={{padding:"12px 14px",borderRadius:"4px 14px 14px 14px",background:"linear-gradient(135deg, rgba(139,92,246,.06), rgba(139,92,246,.02))",border:"1px solid rgba(139,92,246,.1)",marginBottom:4}}>
          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}><span style={{fontSize:9,fontWeight:700,color:"rgba(139,92,246,.6)",letterSpacing:"0.5px",textTransform:"uppercase"}}>You</span></div>
          <p style={{fontSize:12.5,color:"rgba(255,255,255,.75)",margin:0,lineHeight:1.6}}>{h.a}</p>
        </div>
        {h.scoring ? <div style={{padding:10,textAlign:"center"}}><Loader2 size={14} style={{color:"#fbbf24",animation:"spin 1s linear infinite"}}/></div>
        : h.score && <div style={{padding:"12px 14px",borderRadius:12,background:"linear-gradient(135deg, rgba(16,185,129,.06), rgba(16,185,129,.02))",border:"1px solid rgba(16,185,129,.1)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <span style={{fontSize:22,fontWeight:800,color:parseInt(h.score)>=7?"#34d399":parseInt(h.score)>=5?"#fbbf24":"#f87171"}}>{h.score}<span style={{fontSize:12,fontWeight:400,color:"rgba(255,255,255,.3)"}}>/10</span></span>
          </div>
          {h.star && <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
            {[{k:"S",label:"Situation",w:"20%",data:h.star.s},{k:"T",label:"Task",w:"20%",data:h.star.t},{k:"A",label:"Action",w:"35%",data:h.star.a},{k:"R",label:"Result",w:"25%",data:h.star.r}].map(c => c.data && <div key={c.k} style={{flex:"1 1 45%",padding:"6px 8px",borderRadius:8,background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                <span style={{fontSize:9,fontWeight:700,color:amber(.5)}}>{c.k} ({c.w})</span>
                <span style={{fontSize:11,fontWeight:700,color:parseInt(c.data.score)>=7?"#34d399":parseInt(c.data.score)>=5?"#fbbf24":"#f87171"}}>{c.data.score}/10</span>
              </div>
              <p style={{fontSize:10,color:"rgba(255,255,255,.4)",margin:0,lineHeight:1.4}}>{c.data.note}</p>
            </div>)}
          </div>}
          {h.strengths && <div style={{marginBottom:6}}><span style={{fontSize:9,fontWeight:700,color:"rgba(16,185,129,.6)",letterSpacing:"0.5px"}}>STRENGTHS</span><p style={{fontSize:11.5,color:"rgba(255,255,255,.6)",margin:"2px 0 0",lineHeight:1.5}}>{h.strengths}</p></div>}
          {h.improve && <div style={{marginBottom:6}}><span style={{fontSize:9,fontWeight:700,color:amber(.6),letterSpacing:"0.5px"}}>IMPROVE</span><p style={{fontSize:11.5,color:"rgba(255,255,255,.6)",margin:"2px 0 0",lineHeight:1.5}}>{h.improve}</p></div>}
          {h.better && <div><span style={{fontSize:9,fontWeight:700,color:"rgba(139,92,246,.6)",letterSpacing:"0.5px"}}>POLISHED VERSION</span><p style={{fontSize:11.5,color:"rgba(255,255,255,.7)",margin:"2px 0 0",lineHeight:1.5,fontStyle:"italic"}}>{h.better}</p></div>}
        </div>}
      </div>)}
      {mockQ && <div style={{padding:"14px 16px",borderRadius:14,background:`linear-gradient(135deg, ${amber(.1)}, ${amber(.04)})`,border:`1px solid ${amber(.15)}`,boxShadow:`0 0 20px ${amber(.05)}`}}>
        <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6}}><span style={{fontSize:9,fontWeight:700,color:amber(.7),letterSpacing:"1px",textTransform:"uppercase"}}>Interviewer asks</span></div>
        <p style={{fontSize:14,color:"rgba(255,255,255,.9)",margin:0,lineHeight:1.6,fontWeight:500}}>{mockQ}</p>
      </div>}
    </div>
    <div style={{padding:"10px 12px",borderTop:`1px solid ${amber(.08)}`,display:"flex",gap:6,background:"rgba(0,0,0,.2)"}}>
      <button onClick={toggleRecord} style={{padding:"9px 12px",borderRadius:10,border:"none",cursor:"pointer",background:recording?"rgba(239,68,68,.12)":"rgba(255,255,255,.04)",color:recording?"#fca5a5":"rgba(255,255,255,.35)",display:"flex",alignItems:"center",gap:4}}>{recording?<MicOff size={13}/>:<Mic size={13}/>}</button>
      <input value={mockAnswer} onChange={e=>setMockAnswer(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitMockAnswer()} placeholder="Type or speak your answer..." style={{flex:1,padding:"9px 12px",borderRadius:10,border:`1px solid ${amber(.1)}`,background:"rgba(255,255,255,.03)",color:"#fff",fontSize:12,outline:"none"}}/>
      <button onClick={submitMockAnswer} disabled={mockLoading||!mockAnswer.trim()} style={{padding:"9px 16px",borderRadius:10,border:"none",cursor:"pointer",background:mockAnswer.trim()?`linear-gradient(135deg, ${amber(.25)}, ${amber(.1)})`:"rgba(255,255,255,.03)",color:"#fbbf24",fontSize:12,fontWeight:600}}>{mockLoading?<Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/>:<Send size={13}/>}</button>
    </div>
  </div>);

  // ═══════ LIVE MODE ═══════
  // ⬡B:AUDRA:FIX:L3:removed_dead_livePanels:20260403⬡

  return (<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"linear-gradient(180deg, rgba(245,158,11,.03) 0%, transparent 40%)"}}>
    <div style={{display:"flex",gap:3,padding:"8px 10px",borderBottom:`1px solid ${amber(.08)}`}}>
      {modeTab("prep","Prep",FileText)}{modeTab("research","Research",Search)}{modeTab("practice","Practice",Award)}{modeTab("live","Live",Mic)}{modeTab("mock","Mock",Target)}
    </div>
    {activeCue && <div style={{padding:"10px 14px",margin:"6px 8px 0",borderRadius:12,background:activeCue.type==="ALERT"?"linear-gradient(135deg, rgba(239,68,68,.15), rgba(239,68,68,.05))":`linear-gradient(135deg, ${amber(.15)}, ${amber(.05)})`,border:activeCue.type==="ALERT"?"1px solid rgba(239,68,68,.2)":`1px solid ${amber(.15)}`,boxShadow:activeCue.type==="ALERT"?"0 0 20px rgba(239,68,68,.1)":`0 0 20px ${amber(.08)}`,animation:"mf .4s ease"}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:activeCue.type==="ALERT"?"#ef4444":"#fbbf24",animation:"mb 1.5s infinite"}}/>
        <span style={{fontSize:9,fontWeight:700,color:activeCue.type==="ALERT"?"#fca5a5":amber(.7),letterSpacing:"1px",textTransform:"uppercase"}}>{activeCue.type==="ALERT"?"Alert":"TIM Cue"}</span>
        <span style={{fontSize:8,color:"rgba(255,255,255,.2)",marginLeft:"auto"}}>{activeCue.latency}ms</span>
      </div>
      <p style={{fontSize:13,color:"rgba(255,255,255,.9)",margin:0,lineHeight:1.5,fontWeight:500}}>{activeCue.text}</p>
    </div>}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderBottom:`1px solid ${amber(.06)}`}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        {recording && <div style={{width:10,height:10,borderRadius:"50%",background:"#ef4444",animation:"mb 1.5s infinite",boxShadow:"0 0 12px rgba(239,68,68,.4)"}}/>}
        <span style={{fontFamily:"'SF Mono',monospace",fontSize:22,color:running?"#fbbf24":"rgba(255,255,255,.15)",fontWeight:200,letterSpacing:"2px"}}>{fmt(seconds)}</span>
        {selectedJob && <span style={{fontSize:9,color:amber(.4),fontWeight:500,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selectedJob.title}</span>}
      </div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={toggleRecord} style={{padding:"8px 14px",borderRadius:10,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,background:recording?"rgba(239,68,68,.12)":`linear-gradient(135deg, ${amber(.15)}, ${amber(.05)})`,color:recording?"#fca5a5":"#fbbf24",display:"flex",alignItems:"center",gap:5}}>{recording?<><MicOff size={12}/>Stop</>:<><Mic size={12}/>Record</>}</button>
        {running && <button onClick={endInterview} style={{padding:"8px 14px",borderRadius:10,border:"1px solid rgba(239,68,68,.15)",background:"transparent",color:"#f87171",fontSize:11,fontWeight:600,cursor:"pointer"}}>End</button>}
      </div>
    </div>
    <div style={{display:"flex",gap:3,padding:"6px 10px",borderBottom:"1px solid rgba(255,255,255,.03)"}}>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:"8px 12px"}}>
      {/* TRANSCRIPT */}
      <div style={{marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,padding:"0 4px"}}><Mic size={11} style={{color:amber(.4)}}/><span style={{fontSize:10,fontWeight:700,color:amber(.4),letterSpacing:"0.1em"}}>TRANSCRIPT</span>{transcript.length>0&&<span style={{fontSize:9,background:amber(.1),padding:"2px 6px",borderRadius:8,color:amber(.5),fontWeight:600}}>{transcript.length}</span>}</div>
        {transcript.length===0
          ? <div style={{textAlign:"center",padding:"30px 16px",color:"rgba(255,255,255,.1)"}}><p style={{fontSize:12,margin:0}}>{running?"Listening...":"Tap Record to start"}</p></div>
          : transcript.slice(-8).map((t,i) => <div key={i} style={{padding:"8px 10px",marginBottom:4,borderRadius:10,background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.04)"}}><span style={{color:amber(.3),fontSize:9,fontWeight:600,marginRight:6,fontFamily:"monospace"}}>{t.time}</span><span style={{color:"rgba(255,255,255,.8)",fontSize:12,lineHeight:1.5}}>{t.text}</span></div>)
        }
      </div>

      {/* COOK ANSWERS */}
      {cookAnswers.length > 0 && <div style={{marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,padding:"0 4px"}}><Sparkles size={11} style={{color:"rgba(139,92,246,.4)"}}/><span style={{fontSize:10,fontWeight:700,color:"rgba(139,92,246,.4)",letterSpacing:"0.1em"}}>COACHING</span><span style={{fontSize:9,background:"rgba(139,92,246,.1)",padding:"2px 6px",borderRadius:8,color:"rgba(139,92,246,.5)",fontWeight:600}}>{cookAnswers.length}</span></div>
        {cookAnswers.map((a,i) => <div key={i} style={{padding:12,marginBottom:6,borderRadius:12,background:"linear-gradient(135deg, rgba(139,92,246,.08), rgba(139,92,246,.02))",border:"1px solid rgba(139,92,246,.12)",boxShadow:a.streaming?"0 0 12px rgba(139,92,246,.08)":"none"}}>
          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:a.streaming?"#a78bfa":"rgba(139,92,246,.3)",...(a.streaming?{animation:"mb 1s infinite"}:{})}}/>
            <span style={{fontSize:9,fontWeight:700,color:"rgba(139,92,246,.5)",letterSpacing:"0.5px"}}>{a.streaming?"THINKING...":"COOK"}</span>
            <span style={{fontSize:8,color:"rgba(255,255,255,.12)",marginLeft:"auto"}}>{a.time}</span>
            {!a.streaming&&<button onClick={()=>navigator.clipboard.writeText(a.text||"")} style={{padding:"2px 6px",borderRadius:4,fontSize:8,background:"rgba(139,92,246,.08)",border:"1px solid rgba(139,92,246,.1)",color:"rgba(139,92,246,.4)",cursor:"pointer"}}>Copy</button>}
          </div>
          {a.q && <p style={{color:"rgba(139,92,246,.4)",fontSize:10,margin:"0 0 4px",fontStyle:"italic"}}>Re: {a.q}</p>}
          <p style={{color:"rgba(255,255,255,.8)",fontSize:12,margin:0,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{a.text}</p>
        </div>)}
      </div>}

      {/* AUTO-CONTEXT */}
      {autoContext_iv && <div style={{padding:10,borderRadius:10,background:`linear-gradient(135deg, ${amber(.05)}, ${amber(.02)})`,border:`1px solid ${amber(.08)}`,marginBottom:8}}>
        <div style={{fontSize:9,fontWeight:700,color:amber(.5),marginBottom:4,letterSpacing:"0.1em"}}>AUTO-DETECTED</div>
        {autoContext_iv.role&&<p style={{fontSize:12,color:"rgba(255,255,255,.7)",margin:"0 0 2px",fontWeight:600}}>{autoContext_iv.role}</p>}
        {autoContext_iv.company&&<p style={{fontSize:10,color:"rgba(255,255,255,.4)",margin:0}}>{autoContext_iv.company}</p>}
        {autoContext_iv.coaching_tip&&<p style={{fontSize:10,color:"rgba(16,185,129,.6)",margin:"4px 0 0",fontStyle:"italic"}}>{autoContext_iv.coaching_tip}</p>}
      </div>}

      {/* SUMMARY */}
      {summary && <div style={{padding:14,borderRadius:12,background:"linear-gradient(135deg, rgba(16,185,129,.06), rgba(16,185,129,.02))",border:"1px solid rgba(16,185,129,.12)"}}>
        <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6}}><CheckCircle size={12} color="#34d399"/><span style={{fontSize:10,fontWeight:700,color:"#34d399"}}>SUMMARY</span></div>
        <p style={{color:"rgba(255,255,255,.8)",fontSize:12,margin:0,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{summary}</p>
        <button onClick={()=>navigator.clipboard.writeText(summary||"")} style={{marginTop:6,padding:"5px 10px",borderRadius:6,border:"1px solid rgba(52,211,153,.2)",background:"rgba(52,211,153,.06)",color:"rgba(52,211,153,.6)",fontSize:10,cursor:"pointer"}}>Copy</button>
      </div>}
    </div>
  </div>);
}

