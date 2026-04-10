// ⬡B:MACE.phase2:VIEW:meeting_v3_control_panel:20260408⬡
// MeetingModeView — CIP surface, fully migrated to mesa-core.js v2
// v3: Control panel with speaker separation, briefing-aware COOK, meeting save, sticky End
// Fixes: Bug 1 (jumping), Bug 2 (speaker separation), Bug 3 (hallucination),
//        Bug 4 (end button), Bug 5 (meeting not logged to HAM)

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Play, Pause, Square, Timer, Send, Loader2, ChevronRight, Sparkles, BookOpen, CheckCircle, User, Users, Hand, RotateCcw } from "lucide-react";
import { ABABASE, reachTranscribe } from "../utils/api.js";
import {
  INTERROGATIVES, TIM_COOLDOWN, COOK_COOLDOWN, TIM_CUE_DURATION, TIM_CUE_MAX_AGE, TIM_CUE_MAX_VISIBLE,
  SPEAKER_MODES,
  formatTime, isQuestion, fetchTimCue as coreTimCue, fetchCookAnswer as coreCookAnswer,
  saveMeetingToHAM, captureDualAudio, supportsSystemAudio,
} from "../utils/mesa-core.js";

const api = async (path, opts = {}) => {
  const res = await fetch(ABABASE + path, {
    method: opts.method || "GET",
    headers: opts.body ? { "Content-Type": "application/json" } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return res.json();
};
api._baseUrl = ABABASE;

export default function MeetingModeView({ userId }) {
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState([]);
  const [timCues, setTimCues] = useState([]);
  const [cookAnswers, setCookAnswers] = useState([]);
  const [glossary, setGlossary] = useState([]);
  const [recording, setRecording] = useState(false);
  const [askInput, setAskInput] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const [summary, setSummary] = useState(null);

  const [glossarySearch, setGlossarySearch] = useState('');
  const [brainResults, setBrainResults] = useState([]);
  const [brainSearching, setBrainSearching] = useState(false);
  const searchBrain = async (q) => {
    if (!q.trim()) return; setBrainSearching(true);
    try {
      const r = await fetch(ABABASE + '/api/meeting/brain-search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      });
      if (r.ok) { const d = await r.json(); setBrainResults(d.results || []); }
    } catch (e) { console.error('Brain search:', e); }
    setBrainSearching(false);
  };
  };

  const [activeCue, setActiveCue] = useState(null);
  const [cookStreaming, setCookStreaming] = useState(false);
  const [showPrep, setShowPrep] = useState(true);
  const [prepMsgs, setPrepMsgs] = useState([{from:'aba',text:"Hey! Tell me about your meeting, or hit Quick Start to go live."}]);
  const [prepInput, setPrepInput] = useState('');
  const [prepLoading, setPrepLoading] = useState(false);
  const [autoContext, setAutoContext] = useState(null);
  // v3: Speaker mode state
  const [speakerMode, setSpeakerMode] = useState(SPEAKER_MODES.THEY_TALKING);
  // v3: Refine panel state
  const [showRefine, setShowRefine] = useState(false);
  const [hasSystemAudio, setHasSystemAudio] = useState(false);
  const dualAudioRef = useRef(null);
  const [refineLoading, setRefineLoading] = useState(false);
  const prepCtxRef = useRef('');
  const recRef = useRef(null);
  const streamRef = useRef(null);
  const wsRef = useRef(null);
  const intervalRef = useRef(null);
  const secondsRef = useRef(0);
  const cueTimeoutRef = useRef(null);
  const transcriptRef = useRef([]);
  const lastTimFire = useRef(0);
  const lastCookFire = useRef(0);
  const speakerModeRef = useRef(SPEAKER_MODES.THEY_TALKING);

  // Keep ref in sync with state so WebSocket callbacks see current mode
  useEffect(() => { speakerModeRef.current = speakerMode; }, [speakerMode]);

  useEffect(() => {
    if (running) { intervalRef.current = setInterval(() => { setSeconds(s => { secondsRef.current = s + 1; return s + 1; }); }, 1000); }
    else clearInterval(intervalRef.current);
  
  const needAnswerNow = async () => {
    const segs = transcriptRef.current;
    if (segs.length === 0) return;
    const last60 = segs.slice(-20).map(s => s.text).join(' ');
    setCookStreaming(true);
    try {
      const res = await api('/api/cook/answer', {
        method: 'POST', body: JSON.stringify({
          question: 'Give me something to say right now based on this conversation',
          user_id: user?.email || 'unknown', mode: 'meeting',
          transcript_context: last60.substring(0, 2000),
          briefing_context: prepCtxRef.current ? JSON.stringify(prepCtxRef.current).substring(0, 3000) : '',
          last_said_by_ham: lastSaidByHamRef.current || ''
        })
      });
      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let answer = '';
        const ts = formatTime(secondsRef.current);
        setCookAnswers(prev => [...prev, { time: ts, question: 'Immediate answer', answer: '', streaming: true }]);
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = dec.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            try {
              const d = JSON.parse(line.slice(6));
              if (d.text) { answer += d.text; setCookAnswers(prev => { const u = [...prev]; u[u.length - 1] = { ...u[u.length - 1], answer, streaming: true }; return u; }); }
              if (d.type === 'done') setCookAnswers(prev => { const u = [...prev]; u[u.length - 1] = { ...u[u.length - 1], answer, streaming: false }; return u; });
            } catch {}
          }
        }
      }
    } catch (e) { console.error('[CIP MESA] Need answer error:', e); }
    setCookStreaming(false);
  };
  const [showRefineMenu, setShowRefineMenu] = useState(false);

  return () => clearInterval(intervalRef.current);
  }, [running]);

  const fmt = formatTime;

  // ═══════════════════════════════════════════════════════════════════════
  // TIM — verbal filler cues (only fires when speakerMode is THEY_TALKING)
  // ═══════════════════════════════════════════════════════════════════════
  const fireTimCue = async (text) => {
    const result = await coreTimCue(api, { text, mode: 'meeting', whose_turn: 'other' }, userId, transcriptRef.current.slice(-3).map(t=>t.text).join(' '));
    if (result && result.cue) {
      const cue = { text: result.cue, type: result.type, time: fmt(secondsRef.current), latency: result.latency_ms };
      setTimCues(prev => {
        const now = Date.now();
        return [...prev, { ...cue, ts: now }].filter(c => now - (c.ts || 0) < TIM_CUE_MAX_AGE).slice(-TIM_CUE_MAX_VISIBLE);
      });
      setActiveCue(cue);
      clearTimeout(cueTimeoutRef.current);
      cueTimeoutRef.current = setTimeout(() => setActiveCue(null), TIM_CUE_DURATION);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // COOK — full coached answer (now includes briefing context!)
  // Bug 3 fix: prepCtxRef.current is sent as briefing_context
  // ═══════════════════════════════════════════════════════════════════════
  const fetchCookAnswer = async (question) => {
    setCookStreaming(true);
    let fullText = "";
    try {
      const res = await fetch(`${ABABASE}/api/cook/answer`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: 'Someone said: "' + question + '" — Give a polished 1-paragraph answer. Always answer. Never hold.',
          transcript_context: transcriptRef.current.map(t=>t.text).join(" "),
          tim_cues: timCues.slice(-3).map(c=>c.text),
          mode: "meeting",
          userId,
          last_said_by_ham: "",
          // v3 FIX: Send the prep briefing so COOK actually uses it
          briefing_context: prepCtxRef.current || '',
        })
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
            if (parsed.type === "text") {
              fullText += parsed.text;
              setCookAnswers(prev => {
                const updated = [...prev];
                if (updated.length > 0 && updated[updated.length-1].streaming) {
                  updated[updated.length-1].text = fullText;
                } else {
                  updated.push({ q: question.substring(0, 80), text: fullText, time: fmt(secondsRef.current), streaming: true });
                }
                return updated;
              });
            }
            if (parsed.type === "done") {
              setCookAnswers(prev => {
                const updated = [...prev];
                if (updated.length > 0) updated[updated.length-1].streaming = false;
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch {
      if (fullText) setCookAnswers(prev => { const u = [...prev]; if (u.length > 0) u[u.length-1].streaming = false; return u; });
    }
    setCookStreaming(false);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // PROCESS SEGMENT — the core gate
  // v3: Only fires TIM/COOK when speakerMode is THEY_TALKING
  // When I_TALKING: transcript still records, but no AI fires (no screen jumping)
  // When PAUSED: nothing happens at all
  // ═══════════════════════════════════════════════════════════════════════
  const processSegment = async (text) => {
    const mode = speakerModeRef.current;

    // PAUSED or I_TALKING — no TIM/COOK, no screen changes
    if (mode === SPEAKER_MODES.PAUSED || mode === SPEAKER_MODES.I_TALKING) return;

    // THEY_TALKING — fire TIM and COOK
    const now = Date.now();
    if (now - lastTimFire.current >= TIM_COOLDOWN) {
      lastTimFire.current = now;
      fireTimCue(text);
    }
    if (isQuestion(text) && now - lastCookFire.current >= COOK_COOLDOWN) {
      lastCookFire.current = now;
      setTimeout(() => fetchCookAnswer(text), 2000);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // START / END MEETING
  // v3: endMeeting now calls saveMeetingToHAM (Bug 5 fix)
  // ═══════════════════════════════════════════════════════════════════════
  const startMeeting = async () => {
    try {
      // v3: Dual audio — captures mic AND system audio (Zoom/Meet/FaceTime)
      const dualAudio = await captureDualAudio();
      dualAudioRef.current = dualAudio;
      const stream = dualAudio.mixedStream;
      streamRef.current = dualAudio.micStream; // for cleanup
      setHasSystemAudio(!!dualAudio.systemStream);
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
              const speakerId = words.length > 0 ? words[0].speaker : null;
              const entry = { text: text.trim(), time: fmt(secondsRef.current), speaker: speakerId };
              // Transcript ALWAYS records regardless of speaker mode
              setTranscript(prev => [...prev, entry]);
              transcriptRef.current = [...transcriptRef.current, entry];
              // But TIM/COOK only fire based on speaker mode
              processSegment(text.trim());
            }
          }
        } catch {}
      };
      ws.onerror = (err) => console.error('[MESA] WebSocket error:', err);
      ws.onclose = () => console.log('[MESA] WebSocket closed');

      await new Promise((resolve, reject) => {
        ws.onopen = () => { console.log('[MESA] WebSocket connected'); resolve(); };
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
      rec.start(250);
      recRef.current = rec;
      setRecording(true);
      setRunning(true);
    } catch { alert("Microphone access denied"); }
  };


  // Save transcript
  const buildTranscriptMarkdown = () => {
    const lines = ['# Meeting Transcript', '', '**Date:** ' + new Date().toLocaleDateString(), '**Duration:** ' + formatTime(secondsRef.current)];
    lines.push('', '---', '', '## Transcript', '');
    transcriptRef.current.forEach(t => { lines.push('[' + t.time + '] ' + (t.speaker ? '**' + t.speaker + ':** ' : '') + t.text); lines.push(''); });
    if (cookAnswers.length > 0) {
      lines.push('---', '', '## Coached Answers', '');
      cookAnswers.forEach(a => { lines.push('**[' + a.time + ']** ' + (a.question || '')); lines.push(a.answer); lines.push(''); });
    }
    if (summary) lines.push('---', '', '## Summary', '', summary);
    return lines.join('\n');
  };
  const downloadTranscript = (format) => {
    const md = buildTranscriptMarkdown();
    if (format === 'copy') { navigator.clipboard.writeText(md).catch(() => {}); return; }
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'meeting-' + new Date().toISOString().slice(0,10) + '.md'; a.click();
  };
  const [speakers, setSpeakers] = useState(['Me', 'Unknown']);
  const [editingSpeaker, setEditingSpeaker] = useState(null);

  const endMeeting = async () => {
    recRef.current?.stop();
    // v3: Clean up dual audio (mic + system + audio context)
    if (dualAudioRef.current?.cleanup) dualAudioRef.current.cleanup();
    else streamRef.current?.getTracks().forEach(t => t.stop());
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close();
    wsRef.current = null;
    setRunning(false);
    setRecording(false);

    let meetingSummary = null;
    if (transcriptRef.current.length > 0) {
      try {
        const res = await fetch(`${ABABASE}/api/meeting/summary`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: transcriptRef.current.map(t=>`[${t.time}] ${t.text}`).join("\n"), duration: fmt(seconds), mode: "meeting", userId })
        });
        if (res.ok) { const d = await res.json(); meetingSummary = typeof d.summary === 'string' ? d.summary : (d.summary?.text || d.response || ''); setSummary(meetingSummary); }
      } catch {}
    }

    // v3 Bug 5 fix: Save entire meeting session to HAM's brain
    saveMeetingToHAM(api, userId, {
      transcript: transcriptRef.current,
      cookAnswers,
      timCues,
      briefingContext: prepCtxRef.current,
      duration: fmt(seconds),
      summary: meetingSummary,
      mode: 'meeting',
    });
  };

  const askABA = async () => {
    if (!askInput.trim()) return;
    setAskLoading(true);
    const q = askInput; setAskInput("");
    fetchCookAnswer(q);
    setAskLoading(false);
  };

  // Refine: let ABA self-examine and course correct
  const handleRefine = async (action) => {
    setRefineLoading(true);
    setShowRefine(false);
    if (action === 'reset') {
      setCookAnswers([]);
      setTimCues([]);
      setActiveCue(null);
      lastTimFire.current = 0;
      lastCookFire.current = 0;
    } else if (action === 'recalibrate') {
      // Force a COOK re-fire with full briefing context
      const recentText = transcriptRef.current.slice(-5).map(t => t.text).join(' ');
      if (recentText) await fetchCookAnswer('Based on everything discussed so far, what should I know right now? Context: ' + recentText);
    }
    setRefineLoading(false);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // PREP CHAT
  // ═══════════════════════════════════════════════════════════════════════
  const sendPrep = async()=>{
    if(!prepInput.trim()||prepLoading)return;
    const msg=prepInput.trim();setPrepInput('');
    setPrepMsgs(p=>[...p,{from:'user',text:msg}]);
    prepCtxRef.current+='\n'+msg;
    setPrepLoading(true);
    try{
      const r=await fetch(ABABASE+'/api/air/process',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Meeting prep: '+msg+'. Respond in 1-2 sentences.',user_id:userId,channel:'myaba',appScope:'meeting'})});
      const d=await r.json();
      const resp = d.response||'Got it.';
      setPrepMsgs(p=>[...p,{from:'aba',text:resp}]);
      prepCtxRef.current+='\n'+resp;
    }catch{setPrepMsgs(p=>[...p,{from:'aba',text:'Got it. What else?'}]);}
    setPrepLoading(false);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // PREP VIEW
  // ═══════════════════════════════════════════════════════════════════════
  if (showPrep) return (<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
    <div style={{padding:"10px 16px",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
      <button onClick={()=>setShowPrep(false)} style={{width:"100%",padding:"12px",borderRadius:12,background:"linear-gradient(135deg, rgba(6,182,212,.12), rgba(6,182,212,.04))",border:"1px solid rgba(6,182,212,.2)",color:"#22D3EE",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        Quick Start — Jump to Live
      </button>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
      {prepMsgs.map((m,i)=><div key={i} style={{alignSelf:m.from==='user'?'flex-end':'flex-start',maxWidth:'85%',padding:'10px 14px',borderRadius:m.from==='user'?'14px 14px 4px 14px':'14px 14px 14px 4px',background:m.from==='user'?'rgba(139,92,246,.12)':'rgba(255,255,255,.04)',border:'1px solid '+(m.from==='user'?'rgba(139,92,246,.15)':'rgba(255,255,255,.06)')}}>
        {m.from==='aba'&&<div style={{fontSize:9,fontWeight:700,color:'rgba(34,211,238,.6)',marginBottom:3}}>ABA</div>}
        <p style={{fontSize:13,color:'rgba(255,255,255,.8)',margin:0,lineHeight:1.6}}>{m.text}</p>
      </div>)}
      {prepLoading&&<div style={{padding:'8px 14px',borderRadius:14,background:'rgba(255,255,255,.02)',border:'1px solid rgba(255,255,255,.04)',alignSelf:'flex-start'}}><div style={{fontSize:9,fontWeight:700,color:'rgba(34,211,238,.4)',marginBottom:2}}>ABA</div><p style={{fontSize:13,color:'rgba(255,255,255,.3)',margin:0}}>Thinking...</p></div>}
    </div>
    <div style={{padding:"10px 16px",borderTop:"1px solid rgba(255,255,255,.04)",display:"flex",gap:8,alignItems:"center"}}>
      <input value={prepInput} onChange={e=>setPrepInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendPrep()} placeholder="Tell ABA about this meeting..." style={{flex:1,padding:"10px 14px",borderRadius:10,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.06)",color:"#e2e8f0",fontSize:13,outline:"none"}} />
      <button onClick={sendPrep} disabled={prepLoading||!prepInput.trim()} style={{padding:8,borderRadius:8,background:"rgba(139,92,246,.12)",border:"1px solid rgba(139,92,246,.15)",color:"rgba(139,92,246,.7)",cursor:"pointer"}}><Send size={16}/></button>
      <button onClick={()=>{const t=document.querySelector('[data-talk-to-aba]');if(t)t.click();}} style={{padding:"8px 14px",borderRadius:8,background:"linear-gradient(135deg, rgba(139,92,246,.15), rgba(139,92,246,.08))",border:"1px solid rgba(139,92,246,.15)",color:"rgba(139,92,246,.8)",cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:600}}><Mic size={14}/> Talk</button>
    </div>
    <div style={{padding:"10px 16px",borderTop:"1px solid rgba(255,255,255,.04)"}}>
      <button onClick={async()=>{
        if(prepCtxRef.current){try{await fetch(ABABASE+'/api/air/process',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Save meeting context: '+prepCtxRef.current,user_id:userId,channel:'myaba',appScope:'meeting'})})}catch{}}
        setShowPrep(false);
      }} style={{width:"100%",padding:"12px",borderRadius:12,background:"linear-gradient(135deg, rgba(16,185,129,.15), rgba(16,185,129,.05))",border:"1px solid rgba(16,185,129,.2)",color:"#34D399",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        Start Meeting
      </button>
    </div>
  </div>);

  // ═══════════════════════════════════════════════════════════════════════
  // LIVE MEETING VIEW
  // ═══════════════════════════════════════════════════════════════════════
  return (<div style={{flex:1,display:"flex",flexDirection:"column",backdropFilter:"blur(12px)",overflow:"hidden",background:"linear-gradient(180deg, rgba(6,182,212,.03) 0%, transparent 40%)"}}>
    {/* TIM Cue Banner — only shows when speakerMode is THEY_TALKING */}
    {activeCue && speakerMode !== SPEAKER_MODES.PAUSED && <div style={{
      padding:"10px 14px",margin:"6px 8px 0",borderRadius:12,
      background: activeCue.type === "ALERT" ? "linear-gradient(135deg, rgba(239,68,68,.15), rgba(239,68,68,.05))" : "linear-gradient(135deg, rgba(6,182,212,.15), rgba(6,182,212,.05))",
      border: activeCue.type === "ALERT" ? "1px solid rgba(239,68,68,.2)" : "1px solid rgba(6,182,212,.15)",
      boxShadow: activeCue.type === "ALERT" ? "0 0 20px rgba(239,68,68,.1)" : "0 0 20px rgba(6,182,212,.08)",
      animation:"mf .4s ease",transition:"all 0.3s ease"
    }}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:activeCue.type==="ALERT"?"#ef4444":"#22d3ee",boxShadow:activeCue.type==="ALERT"?"0 0 8px rgba(239,68,68,.5)":"0 0 8px rgba(6,182,212,.5)",animation:"mb 1.5s infinite"}}/>
        <span style={{fontSize:9,fontWeight:700,color:activeCue.type==="ALERT"?"#fca5a5":"rgba(6,182,212,.7)",letterSpacing:"1px",textTransform:"uppercase"}}>{activeCue.type==="ALERT"?"Alert":"TIM Cue"}</span>
        <span style={{fontSize:8,color:"rgba(255,255,255,.2)",marginLeft:"auto"}}>{activeCue.latency}ms</span>
      </div>
      <p style={{fontSize:13,color:"rgba(255,255,255,.9)",margin:0,lineHeight:1.5,fontWeight:500}}>{activeCue.text}</p>
    </div>}

    {/* Header — timer + status indicator */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",borderBottom:"1px solid rgba(6,182,212,.08)"}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        {recording && <div style={{width:10,height:10,borderRadius:"50%",background:"#ef4444",animation:"mb 1.5s infinite",boxShadow:"0 0 12px rgba(239,68,68,.4)"}}/>}
{hasSystemAudio && <span style={{fontSize:9,padding:"2px 6px",borderRadius:6,background:"rgba(16,185,129,.12)",color:"#34d399",fontWeight:600}}>DUAL AUDIO</span>}
        <span style={{fontFamily:"'SF Mono',monospace",fontSize:24,color:running?"#22d3ee":"rgba(255,255,255,.15)",fontWeight:200,letterSpacing:"2px"}}>{fmt(seconds)}</span>
      </div>
      {/* Speaker mode indicator */}
      {running && <div style={{padding:"4px 10px",borderRadius:8,fontSize:10,fontWeight:700,letterSpacing:"0.5px",
        background: speakerMode === SPEAKER_MODES.THEY_TALKING ? "rgba(16,185,129,.12)" : speakerMode === SPEAKER_MODES.I_TALKING ? "rgba(59,130,246,.12)" : "rgba(239,68,68,.12)",
        color: speakerMode === SPEAKER_MODES.THEY_TALKING ? "#34d399" : speakerMode === SPEAKER_MODES.I_TALKING ? "#60a5fa" : "#f87171",
        border: `1px solid ${speakerMode === SPEAKER_MODES.THEY_TALKING ? "rgba(16,185,129,.2)" : speakerMode === SPEAKER_MODES.I_TALKING ? "rgba(59,130,246,.2)" : "rgba(239,68,68,.2)"}`,
      }}>
        {speakerMode === SPEAKER_MODES.THEY_TALKING ? "JUST LISTEN" : speakerMode === SPEAKER_MODES.I_TALKING ? "MY TURN" : "PAUSED"}
      </div>}
      <div style={{display:"flex",gap:8}}>
        {!running && <button onClick={startMeeting} style={{padding:"8px 18px",borderRadius:12,border:"1px solid rgba(6,182,212,.3)",background:"linear-gradient(135deg, rgba(6,182,212,.15), rgba(6,182,212,.05))",color:"#22d3ee",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6,boxShadow:"0 0 15px rgba(6,182,212,.1)",transition:"all 0.2s ease"}}><Mic size={14}/>Start</button>}
      </div>
    </div>

    {/* Single scroll — transcript, coaching, glossary, summary */}
    <div style={{flex:1,overflowY:"auto",padding:"10px 12px"}}>
      {/* Brain Search */}
      <div style={{marginBottom:10,display:"flex",gap:4}}>
        <input type="text" placeholder="Search brain..." value={glossarySearch} onChange={e=>setGlossarySearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchBrain(glossarySearch)} style={{flex:1,padding:"6px 10px",borderRadius:8,fontSize:11,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.08)",color:"#e2e8f0",outline:"none"}} />
        <button onClick={()=>searchBrain(glossarySearch)} style={{padding:"6px 12px",borderRadius:8,fontSize:10,background:"rgba(34,211,238,.08)",border:"1px solid rgba(34,211,238,.15)",color:"#22d3ee",cursor:"pointer"}}>{brainSearching?"...":"Search"}</button>
      </div>
      {brainResults.length>0&&<div style={{marginBottom:10,padding:8,borderRadius:8,background:"rgba(34,211,238,.04)",border:"1px solid rgba(34,211,238,.1)"}}>
        <div style={{fontSize:9,fontWeight:700,color:"rgba(34,211,238,.5)",marginBottom:4}}>BRAIN RESULTS</div>
        {brainResults.map((r,i)=><div key={i} style={{marginBottom:4,fontSize:11,color:"rgba(255,255,255,.7)",lineHeight:1.4}}>{typeof r.content==="string"?r.content.substring(0,150):JSON.stringify(r.content).substring(0,150)}...</div>)}
      </div>}
      {/* TRANSCRIPT */}
      <div style={{marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,padding:"0 4px"}}><Mic size={11} style={{color:"rgba(6,182,212,.4)"}}/><span style={{fontSize:10,fontWeight:700,color:"rgba(6,182,212,.4)",letterSpacing:"0.1em"}}>TRANSCRIPT</span>{transcript.length>0&&<span style={{fontSize:9,background:"rgba(6,182,212,.1)",padding:"2px 6px",borderRadius:8,color:"rgba(6,182,212,.5)",fontWeight:600}}>{transcript.length}</span>}</div>
        {transcript.length===0
          ? <div style={{textAlign:"center",padding:"30px 16px",color:"rgba(255,255,255,.1)"}}><p style={{fontSize:12,margin:0}}>{running?"Listening...":"Tap Start"}</p></div>
          : transcript.slice(-8).map((t,i) => <div key={i} style={{padding:"8px 10px",marginBottom:4,borderRadius:10,background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.04)"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                <span style={{color:"rgba(6,182,212,.3)",fontSize:9,fontWeight:600,fontFamily:"monospace"}}>{t.time}</span>
                <button onClick={()=>setEditingSpeaker(editingSpeaker===i?null:i)} style={{padding:"1px 6px",borderRadius:4,fontSize:9,fontWeight:600,cursor:"pointer",background:t.speaker==="Me"?"rgba(59,130,246,.15)":"rgba(255,255,255,.06)",color:t.speaker==="Me"?"#60a5fa":"rgba(255,255,255,.35)",border:"1px solid rgba(255,255,255,.08)"}}>{t.speaker||"?"}</button>
              </div>
              {editingSpeaker===i&&<div style={{display:"flex",gap:4,marginBottom:4,flexWrap:"wrap"}}>
                {speakers.map(s=><button key={s} onClick={()=>{setTranscript(prev=>prev.map((seg,j)=>j===i?{...seg,speaker:s}:seg));transcriptRef.current=transcriptRef.current.map((seg,j)=>j===i?{...seg,speaker:s}:seg);setEditingSpeaker(null);}} style={{padding:"2px 8px",borderRadius:4,fontSize:9,cursor:"pointer",background:"rgba(34,211,238,.08)",border:"1px solid rgba(34,211,238,.15)",color:"#22d3ee"}}>{s}</button>)}
                <input type="text" placeholder="New" onKeyDown={e=>{if(e.key==="Enter"&&e.target.value.trim()){const n=e.target.value.trim();if(!speakers.includes(n))setSpeakers(p=>[...p,n]);setTranscript(p=>p.map((seg,j)=>j===i?{...seg,speaker:n}:seg));transcriptRef.current=transcriptRef.current.map((seg,j)=>j===i?{...seg,speaker:n}:seg);setEditingSpeaker(null);}}} style={{padding:"2px 6px",borderRadius:4,fontSize:9,width:60,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.08)",color:"#e2e8f0",outline:"none"}} />
              </div>}
              <span style={{color:"rgba(255,255,255,.8)",fontSize:12,lineHeight:1.5}}>{t.text}</span>
            </div>)
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
      {autoContext && <div style={{padding:10,borderRadius:10,background:"linear-gradient(135deg, rgba(34,211,238,.05), rgba(34,211,238,.02))",border:"1px solid rgba(34,211,238,.08)",marginBottom:8}}>
        <div style={{fontSize:9,fontWeight:700,color:"rgba(34,211,238,.5)",marginBottom:4,letterSpacing:"0.1em"}}>AUTO-DETECTED</div>
        {autoContext.topic&&<p style={{fontSize:12,color:"rgba(255,255,255,.7)",margin:"0 0 2px",fontWeight:600}}>{autoContext.topic}</p>}
        {autoContext.participants&&<p style={{fontSize:10,color:"rgba(255,255,255,.4)",margin:0}}>{autoContext.participants}</p>}
        {autoContext.suggested_approach&&<p style={{fontSize:10,color:"rgba(16,185,129,.6)",margin:"4px 0 0",fontStyle:"italic"}}>{autoContext.suggested_approach}</p>}
      </div>}

      {/* GLOSSARY */}
      {glossary.length > 0 && <div style={{marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,padding:"0 4px"}}><BookOpen size={11} style={{color:"rgba(34,211,238,.4)"}}/><span style={{fontSize:10,fontWeight:700,color:"rgba(34,211,238,.4)",letterSpacing:"0.1em"}}>GLOSSARY</span></div>
        {glossary.map((g,i) => <div key={i} style={{padding:8,marginBottom:4,borderRadius:8,background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.04)"}}><span style={{color:"#22d3ee",fontSize:11,fontWeight:600}}>{g.term}</span><p style={{color:"rgba(255,255,255,.4)",fontSize:10,margin:"2px 0 0"}}>{g.definition}</p></div>)}
      </div>}

      {/* SUMMARY */}
      {summary && <div style={{padding:14,borderRadius:12,background:"linear-gradient(135deg, rgba(16,185,129,.06), rgba(16,185,129,.02))",border:"1px solid rgba(16,185,129,.12)"}}>
        <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6}}><CheckCircle size={12} color="#34d399"/><span style={{fontSize:10,fontWeight:700,color:"#34d399",letterSpacing:"0.5px"}}>SUMMARY</span></div>
        <p style={{color:"rgba(255,255,255,.8)",fontSize:12,margin:0,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{summary}</p>
        <div style={{display:'flex',gap:4,marginTop:8,flexWrap:'wrap'}}>
          <button onClick={()=>navigator.clipboard.writeText(summary||"")} style={{padding:"5px 10px",borderRadius:6,border:"1px solid rgba(52,211,153,.2)",background:"rgba(52,211,153,.06)",color:"rgba(52,211,153,.6)",fontSize:10,cursor:"pointer"}}>Copy Summary</button>
          <button onClick={()=>downloadTranscript('md')} style={{padding:"5px 10px",borderRadius:6,border:"1px solid rgba(34,211,238,.2)",background:"rgba(34,211,238,.06)",color:"rgba(34,211,238,.6)",fontSize:10,cursor:"pointer"}}>Save .md</button>
          <button onClick={()=>downloadTranscript('copy')} style={{padding:"5px 10px",borderRadius:6,border:"1px solid rgba(168,85,247,.2)",background:"rgba(168,85,247,.06)",color:"rgba(168,85,247,.6)",fontSize:10,cursor:"pointer"}}>Copy Full</button>
        </div>
      </div>}
    </div>

    {/* Ask ABA input */}
    {running && <div style={{padding:"10px 12px",borderTop:"1px solid rgba(6,182,212,.08)",display:"flex",gap:8,background:"rgba(0,0,0,.2)"}}>
      <input value={askInput} onChange={e=>setAskInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&askABA()} placeholder="Ask ABA anything..." style={{flex:1,padding:"10px 14px",borderRadius:12,border:"1px solid rgba(6,182,212,.12)",background:"rgba(255,255,255,.03)",color:"#fff",fontSize:12,outline:"none",transition:"border-color 0.2s"}}/>
      <button onClick={askABA} disabled={askLoading||!askInput.trim()} style={{padding:"10px 16px",borderRadius:12,border:"none",background:askInput.trim()?"linear-gradient(135deg, rgba(139,92,246,.25), rgba(139,92,246,.1))":"rgba(255,255,255,.03)",color:askInput.trim()?"#c4b5fd":"rgba(255,255,255,.15)",cursor:"pointer",fontSize:12,fontWeight:600,transition:"all 0.2s ease"}}>{askLoading?<Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/>:<Send size={14}/>}</button>
    </div>}

    {/* ═══════════════════════════════════════════════════════════════════
      CONTROL PANEL — Bug 1+2 fix: Speaker separation
      Large buttons with icons AND words. Bottom third of screen.
      They Are Talking (green) | I Am Talking (blue) | Pause (red) | Refine (amber) | End (red outline)
    ═══════════════════════════════════════════════════════════════════ */}
    {running && <div style={{
      padding:"12px",
      borderTop:"1px solid rgba(255,255,255,.06)",
      background:"rgba(0,0,0,.4)",
      backdropFilter:"blur(8px)",
    }}>
      {/* Row 1: Speaker mode buttons */}
      <div style={{display:"flex",gap:8,marginBottom:8}}>
        {/* They Are Talking */}
        <button onClick={()=>setSpeakerMode(SPEAKER_MODES.THEY_TALKING)} style={{
          flex:1,padding:"14px 8px",borderRadius:14,cursor:"pointer",
          display:"flex",flexDirection:"column",alignItems:"center",gap:6,
          background: speakerMode === SPEAKER_MODES.THEY_TALKING ? "linear-gradient(135deg, rgba(16,185,129,.25), rgba(16,185,129,.08))" : "rgba(255,255,255,.03)",
          border: speakerMode === SPEAKER_MODES.THEY_TALKING ? "2px solid rgba(16,185,129,.4)" : "1px solid rgba(255,255,255,.08)",
          boxShadow: speakerMode === SPEAKER_MODES.THEY_TALKING ? "0 0 20px rgba(16,185,129,.15)" : "none",
          transition:"all 0.2s ease",
        }}>
          <Users size={20} color={speakerMode === SPEAKER_MODES.THEY_TALKING ? "#34d399" : "rgba(255,255,255,.3)"} />
          <span style={{fontSize:11,fontWeight:700,color: speakerMode === SPEAKER_MODES.THEY_TALKING ? "#34d399" : "rgba(255,255,255,.3)",letterSpacing:"0.3px"}}>
            Just Listen
          </span>
          {speakerMode === SPEAKER_MODES.THEY_TALKING && <div style={{width:6,height:6,borderRadius:"50%",background:"#34d399",animation:"mb 1.5s infinite",boxShadow:"0 0 8px rgba(52,211,153,.5)"}}/>}
        </button>

        {/* I Am Talking */}
        <button onClick={()=>setSpeakerMode(SPEAKER_MODES.I_TALKING)} style={{
          flex:1,padding:"14px 8px",borderRadius:14,cursor:"pointer",
          display:"flex",flexDirection:"column",alignItems:"center",gap:6,
          background: speakerMode === SPEAKER_MODES.I_TALKING ? "linear-gradient(135deg, rgba(59,130,246,.25), rgba(59,130,246,.08))" : "rgba(255,255,255,.03)",
          border: speakerMode === SPEAKER_MODES.I_TALKING ? "2px solid rgba(59,130,246,.4)" : "1px solid rgba(255,255,255,.08)",
          boxShadow: speakerMode === SPEAKER_MODES.I_TALKING ? "0 0 20px rgba(59,130,246,.15)" : "none",
          transition:"all 0.2s ease",
        }}>
          <User size={20} color={speakerMode === SPEAKER_MODES.I_TALKING ? "#60a5fa" : "rgba(255,255,255,.3)"} />
          <span style={{fontSize:11,fontWeight:700,color: speakerMode === SPEAKER_MODES.I_TALKING ? "#60a5fa" : "rgba(255,255,255,.3)",letterSpacing:"0.3px"}}>
            My Turn
          </span>
          {speakerMode === SPEAKER_MODES.I_TALKING && <div style={{width:6,height:6,borderRadius:"50%",background:"#60a5fa",animation:"mb 1.5s infinite",boxShadow:"0 0 8px rgba(96,165,250,.5)"}}/>}
        </button>

        {/* Pause */}
        <button onClick={()=>setSpeakerMode(SPEAKER_MODES.PAUSED)} style={{
          flex:1,padding:"14px 8px",borderRadius:14,cursor:"pointer",
          display:"flex",flexDirection:"column",alignItems:"center",gap:6,
          background: speakerMode === SPEAKER_MODES.PAUSED ? "linear-gradient(135deg, rgba(239,68,68,.25), rgba(239,68,68,.08))" : "rgba(255,255,255,.03)",
          border: speakerMode === SPEAKER_MODES.PAUSED ? "2px solid rgba(239,68,68,.4)" : "1px solid rgba(255,255,255,.08)",
          boxShadow: speakerMode === SPEAKER_MODES.PAUSED ? "0 0 20px rgba(239,68,68,.15)" : "none",
          transition:"all 0.2s ease",
        }}>
          <Hand size={20} color={speakerMode === SPEAKER_MODES.PAUSED ? "#f87171" : "rgba(255,255,255,.3)"} />
          <span style={{fontSize:11,fontWeight:700,color: speakerMode === SPEAKER_MODES.PAUSED ? "#f87171" : "rgba(255,255,255,.3)",letterSpacing:"0.3px"}}>
            Pause
          </span>
          {speakerMode === SPEAKER_MODES.PAUSED && <div style={{width:6,height:6,borderRadius:"50%",background:"#f87171",boxShadow:"0 0 8px rgba(248,113,113,.5)"}}/>}
        </button>
      </div>

      {/* Row 2: Refine + End */}
      <div style={{display:"flex",gap:8}}>
        {/* Refine */}
        <button onClick={()=>setShowRefine(!showRefine)} style={{
          flex:1,padding:"12px 8px",borderRadius:12,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",gap:8,
          background: showRefine ? "linear-gradient(135deg, rgba(245,158,11,.2), rgba(245,158,11,.05))" : "rgba(255,255,255,.03)",
          border: showRefine ? "1px solid rgba(245,158,11,.3)" : "1px solid rgba(255,255,255,.08)",
          transition:"all 0.2s ease",
        }}>
          <RotateCcw size={16} color={showRefine ? "#fbbf24" : "rgba(255,255,255,.3)"} />
          <span style={{fontSize:12,fontWeight:700,color: showRefine ? "#fbbf24" : "rgba(255,255,255,.3)"}}>Refine</span>
        </button>

        {/* End Meeting — Bug 4 fix: always visible, sticky at bottom */}
        <button onClick={endMeeting} style={{
          flex:1,padding:"12px 8px",borderRadius:12,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",gap:8,
          background:"rgba(239,68,68,.06)",
          border:"1px solid rgba(239,68,68,.2)",
          transition:"all 0.2s ease",
        }}>
          <Square size={16} color="#f87171" />
          <span style={{fontSize:12,fontWeight:700,color:"#f87171"}}>End Meeting</span>
        </button>
      </div>

      {/* Refine submenu */}
      {showRefine && <div style={{marginTop:8,display:"flex",gap:8}}>
        <button onClick={()=>handleRefine('reset')} disabled={refineLoading} style={{flex:1,padding:"10px",borderRadius:10,background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.15)",color:"#fbbf24",fontSize:11,fontWeight:600,cursor:"pointer"}}>
          Reset Coaching
        </button>
        <button onClick={()=>handleRefine('recalibrate')} disabled={refineLoading} style={{flex:1,padding:"10px",borderRadius:10,background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.15)",color:"#fbbf24",fontSize:11,fontWeight:600,cursor:"pointer"}}>
          {refineLoading ? 'Recalibrating...' : 'Recalibrate'}
        </button>
      </div>}
    </div>}
  </div>);
}

