// ⬡B:MACE.parity:VIEW:interview_rich:20260406⬡
// InterviewModeView + MockInterviewVARA — CIP surface with FULL feature parity.
// IRIS (Interview Readiness and Intelligence System) — rich mobile components.

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Timer, Send, Loader2, ChevronRight, Target, Play, Square, FileText, Search, Award, CheckCircle, Sparkles, Users, User, Hand, RotateCcw } from "lucide-react";
import { useConversation } from "@elevenlabs/react";
import { ABABASE, reachTranscribe } from "../utils/api.js";
import {
  INTERVIEW_MODES, STAR_COMPONENTS, isQuestion, formatTime,
  fetchTimCue as coreTimCue, cleanInterviewTitle,
  TIM_COOLDOWN, COOK_COOLDOWN, TIM_CUE_DURATION, TIM_CUE_MAX_AGE, TIM_CUE_MAX_VISIBLE,
} from "../utils/iris-core.js";
import { captureDualAudio } from "../utils/mesa-core.js";

// v3: Speaker modes for control panel
const SPEAKER_MODES = { THEY: 'they_talking', ME: 'i_talking', TEAM: 'my_team', PAUSED: 'paused' };
import {
  STARCoachMobile, CompanyResearchMobile, PostInterviewMobile,
  TIMQueueMobile, MockInterviewPanel,
} from "../components/interview/InterviewMobileComponents.jsx";

const api = async (path, opts = {}) => {
  const res = await fetch(ABABASE + path, {
    method: opts.method || "GET",
    headers: opts.body ? { "Content-Type": "application/json" } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return res.json();
};

// ⬡B:AWA.voice:SHARED:mock_interview_vara:20260408⬡ Imported from shared component
import MockInterviewVARA from "../components/MockInterviewVARA.jsx";

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
  // v3: Speaker mode for control panel
  const [speakerMode_iv, setSpeakerMode_iv] = useState(SPEAKER_MODES.THEY);
  const speakerModeRef_iv = useRef(SPEAKER_MODES.THEY);
  useEffect(() => { speakerModeRef_iv.current = speakerMode_iv; }, [speakerMode_iv]);
  const [showRefine_iv, setShowRefine_iv] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mockQ, setMockQ] = useState(null);
  const [mockHistory, setMockHistory] = useState([]);
  const [mockAnswer, setMockAnswer] = useState("");
  const [mockLoading, setMockLoading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState(null);
  const [speakers, setSpeakers] = useState(['Me', 'Unknown']);
  const [editingSpeaker, setEditingSpeaker] = useState(null);


  const [glossarySearch, setGlossarySearch] = useState('');
  const [brainResults, setBrainResults] = useState([]);
  const [brainSearching, setBrainSearching] = useState(false);
  const searchBrain = async (q) => {
    if (!q.trim()) return; setBrainSearching(true);
    try {
      const r = await fetch('https://htlxjkbrstpwwtzsbyvb.supabase.co/rest/v1/rpc/exec_sql', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0bHhqa2Jyc3Rwd3d0enNieXZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDUzMjgyMSwiZXhwIjoyMDg2MTA4ODIxfQ.G55zXnfanoUxRAoaYz-tD9FDJ53xHH-pRgDrKss_Iqo' },
        body: JSON.stringify({ query: "SELECT source, content FROM aba_memory WHERE content ILIKE '%" + q.replace(/'/g, "''") + "%' ORDER BY importance DESC NULLS LAST LIMIT 5" })
      });
      if (r.ok) { setBrainResults(await r.json()); }
    } catch {} setBrainSearching(false);
  };

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
  const dualAudioRef_iv = useRef(null);

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
        body: JSON.stringify({ question: 'Interviewer said: "' + question + '" — Give a STAR-method answer. Always answer.', transcript_context: transcriptRef.current.map(t=>t.text).join(" "), tim_cues: timCues.slice(-3).map(c=>c.text), mode: "interview", job_title: selectedJob?.title, job_org: selectedJob?.organization, job_description: selectedJob?.description, userId, last_said_by_ham: lastSaidByHamRef_iv.current, briefing_context: prepData ? JSON.stringify(prepData).substring(0, 3000) : '' })
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
    // v3: Gate TIM/COOK on speaker mode
    const sMode = speakerModeRef_iv.current;
    if (sMode === SPEAKER_MODES.PAUSED || sMode === SPEAKER_MODES.ME) return;
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
      // v4: Dual audio — captures mic AND system audio (Zoom/Meet/FaceTime)
      const dualAudio = await captureDualAudio();
      dualAudioRef_iv.current = dualAudio;
      const stream = dualAudio.mixedStream;
      streamRef.current = dualAudio.micStream;
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

  const needAnswerNow = async () => {
    const segs = transcriptRef.current;
    if (segs.length === 0) return;
    const last60 = segs.slice(-20).map(s => s.text).join(' ');
    try {
      const res = await fetch(apiBase + '/api/cook/answer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: 'Give me something to say right now',
          user_id: user?.email || 'unknown', mode: 'interview',
          transcript_context: last60.substring(0, 2000),
          briefing_context: prepData ? JSON.stringify(prepData).substring(0, 3000) : '',
          last_said_by_ham: ''
        })
      });
      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let answer = '';
        setCookAnswers(prev => [...prev, { time: fmt(secondsRef.current), question: 'Immediate', answer: '', streaming: true }]);
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of dec.decode(value, { stream: true }).split('\n')) {
            if (!line.startsWith('data: ')) continue;
            try {
              const d = JSON.parse(line.slice(6));
              if (d.text) { answer += d.text; setCookAnswers(prev => { const u=[...prev]; u[u.length-1]={...u[u.length-1],answer,streaming:true}; return u; }); }
              if (d.type==='done') setCookAnswers(prev => { const u=[...prev]; u[u.length-1]={...u[u.length-1],answer,streaming:false}; return u; });
            } catch {}
          }
        }
      }
    } catch (e) { console.error('[CIP IRIS] Answer now error:', e); }
  };
  const [showRefineMenu, setShowRefineMenu] = useState(false);


  const buildTranscriptMarkdown = () => {
    const lines = ['# Interview Transcript', '', '**Date:** ' + new Date().toLocaleDateString()];
    lines.push('', '---', '', '## Transcript', '');
    transcriptRef.current.forEach(t => { lines.push('[' + t.time + '] ' + (t.speaker ? '**' + t.speaker + ':** ' : '') + t.text + ''); });
    if (cookAnswers.length > 0) {
      lines.push('', '---', '', '## Coached Answers', '');
      cookAnswers.forEach(a => { lines.push('**[' + a.time + ']** ' + (a.question || '')); lines.push(a.answer + ''); });
    }
    if (summary) lines.push('', '---', '', '## Summary', '', summary);
    return lines.join('\n');
  };
  const downloadTranscript = (fmt) => {
    const md = buildTranscriptMarkdown();
    if (fmt === 'copy') { navigator.clipboard.writeText(md).catch(() => {}); return; }
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'interview-' + new Date().toISOString().slice(0,10) + '.md'; a.click();
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
    let meetingSummary = null;
    if (transcriptRef.current.length > 0) {
      try {
        const res = await fetch(`${ABABASE}/api/meeting/summary`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: transcriptRef.current.map(t=>`[${t.time}] ${t.text}`).join("\n"), duration: fmt(seconds), mode: "interview", job_title: selectedJob?.title, job_org: selectedJob?.organization, userId })
        });
        if (res.ok) { const d = await res.json(); meetingSummary = typeof d.summary === 'string' ? d.summary : (d.summary?.text || d.response || ''); setSummary(meetingSummary); }
      } catch {}
    }
    // v3 Bug 5: Save interview session to HAM brain
    try {
      await fetch(ABABASE + '/api/air/process', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Save this interview session. Job: ' + (selectedJob?.title || 'unknown') + ' at ' + (selectedJob?.organization || 'unknown') + '. Duration: ' + fmt(seconds) + '. Summary: ' + (meetingSummary || 'none') + '. Lines: ' + transcriptRef.current.length,
          user_id: userId, channel: 'myaba', appScope: 'interview',
          meetingLog: { type: 'interview', date: new Date().toISOString(), duration: fmt(seconds), summary: meetingSummary || '', job: { title: selectedJob?.title, org: selectedJob?.organization }, transcript: transcriptRef.current.slice(-100), cookAnswers: cookAnswers.map(a => ({ q: a.q, text: a.text, time: a.time })) }
        })
      });
    } catch {}
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
      {!selectedJob?<p style={{color:"rgba(255,255,255,.4)",textAlign:"center",padding:40}}>Select a job first to research the company.</p>
      :<CompanyResearchMobile job={selectedJob} api={api} userId={userId}/>}

    {/* ⬡B:MACE.iris:UI:bottom_control_panel_cip:20260409⬡ */}
    {running && <div style={{flexShrink:0,padding:"8px 10px",borderTop:"1px solid rgba(255,255,255,.06)",background:"rgba(0,0,0,.4)"}}>
      <div style={{display:"flex",gap:4,marginBottom:6}}>
        {[
          {mode:SPEAKER_MODES.THEY,bg:"16,185,129",hex:"#34d399",icon:<Users size={14}/>,label:"Just Listen"},
          {mode:SPEAKER_MODES.ME,bg:"59,130,246",hex:"#60a5fa",icon:<User size={14}/>,label:"My Turn"},
          {mode:SPEAKER_MODES.TEAM,bg:"168,85,247",hex:"#a78bfa",icon:<Users size={14}/>,label:"My Team"},
          {mode:SPEAKER_MODES.PAUSED,bg:"239,68,68",hex:"#f87171",icon:<Hand size={14}/>,label:"Pause"},
        ].map(b=>(
          <button key={b.mode} onClick={()=>setSpeakerMode_iv(b.mode)} style={{flex:1,padding:"8px 4px",borderRadius:8,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:speakerMode_iv===b.mode?`rgba(${b.bg},.18)`:"rgba(255,255,255,.03)",border:speakerMode_iv===b.mode?`2px solid rgba(${b.bg},.35)`:"1px solid rgba(255,255,255,.06)",transition:"all 0.2s"}}>
            {React.cloneElement(b.icon,{color:speakerMode_iv===b.mode?b.hex:"rgba(255,255,255,.2)"})}
            <span style={{fontSize:9,fontWeight:700,color:speakerMode_iv===b.mode?b.hex:"rgba(255,255,255,.2)"}}>{b.label}</span>
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:4}}>
        <button onClick={needAnswerNow} style={{flex:2,padding:"10px 8px",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"linear-gradient(135deg, rgba(251,191,36,.12), rgba(245,158,11,.06))",border:"1px solid rgba(251,191,36,.25)"}}>
          <Zap size={13} color="#fbbf24"/>
          <span style={{fontSize:11,fontWeight:700,color:"#fbbf24"}}>Answer Now</span>
        </button>
        <div style={{position:"relative",flex:1}}>
          <button onClick={()=>setShowRefineMenu(!showRefineMenu)} style={{width:"100%",padding:"10px 8px",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.15)"}}>
            <RotateCcw size={13} color="rgba(245,158,11,.5)"/>
            <span style={{fontSize:11,fontWeight:700,color:"rgba(245,158,11,.5)"}}>Refine</span>
          </button>
          {showRefineMenu&&<div style={{position:"absolute",bottom:"100%",left:0,right:0,marginBottom:4,background:"rgba(15,23,42,.98)",border:"1px solid rgba(245,158,11,.2)",borderRadius:8,overflow:"hidden",zIndex:50}}>
            <button onClick={()=>{setCookAnswers([]);setTimCues([]);setShowRefineMenu(false);}} style={{width:"100%",padding:"10px",border:"none",borderBottom:"1px solid rgba(255,255,255,.05)",background:"transparent",color:"rgba(245,158,11,.7)",fontSize:11,fontWeight:600,cursor:"pointer",textAlign:"left"}}>Reset Coaching</button>
            <button onClick={()=>{setShowRefineMenu(false);}} style={{width:"100%",padding:"10px",border:"none",background:"transparent",color:"rgba(245,158,11,.7)",fontSize:11,fontWeight:600,cursor:"pointer",textAlign:"left"}}>Recalibrate</button>
          </div>}
        </div>
        <button onClick={endInterview} style={{flex:1,padding:"10px 8px",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.15)"}}>
          <Square size={13} color="#f87171"/>
          <span style={{fontSize:11,fontWeight:700,color:"#f87171"}}>End</span>
        </button>
      </div>
    </div>}
    </div>
  </div>);
  // ═══════ PRACTICE MODE (STAR Coach) ═══════
  if (mode === "practice") return (<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"linear-gradient(180deg, rgba(245,158,11,.03) 0%, transparent 40%)"}}>
    <div style={{display:"flex",gap:3,padding:"8px 10px",borderBottom:"1px solid rgba(245,158,11,.08)"}}>
      {modeTab("prep","Prep",FileText)}{modeTab("research","Research",Search)}{modeTab("practice","Practice",Award)}{modeTab("live","Live",Mic)}{modeTab("mock","Mock",Target)}
    </div>
    <div style={{flex:1,overflowY:"auto",padding:12}}>
      <STARCoachMobile question={starQuestion || "Tell me about a time you demonstrated leadership."} api={api} userId={userId}/>
      <div style={{marginTop:10}}>
        <p style={{color:"rgba(255,255,255,.3)",fontSize:10,fontWeight:600,marginBottom:4}}>CUSTOM QUESTION:</p>
        <input value={starQuestion} onChange={e=>setStarQuestion(e.target.value)} placeholder="Type a custom interview question..." style={{width:"100%",padding:"8px 10px",borderRadius:8,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.03)",color:"white",fontSize:12,boxSizing:"border-box"}}/>
      </div>

    {/* ⬡B:MACE.iris:UI:bottom_control_panel_cip:20260409⬡ */}
    {running && <div style={{flexShrink:0,padding:"8px 10px",borderTop:"1px solid rgba(255,255,255,.06)",background:"rgba(0,0,0,.4)"}}>
      <div style={{display:"flex",gap:4,marginBottom:6}}>
        {[
          {mode:SPEAKER_MODES.THEY,bg:"16,185,129",hex:"#34d399",icon:<Users size={14}/>,label:"Just Listen"},
          {mode:SPEAKER_MODES.ME,bg:"59,130,246",hex:"#60a5fa",icon:<User size={14}/>,label:"My Turn"},
          {mode:SPEAKER_MODES.TEAM,bg:"168,85,247",hex:"#a78bfa",icon:<Users size={14}/>,label:"My Team"},
          {mode:SPEAKER_MODES.PAUSED,bg:"239,68,68",hex:"#f87171",icon:<Hand size={14}/>,label:"Pause"},
        ].map(b=>(
          <button key={b.mode} onClick={()=>setSpeakerMode_iv(b.mode)} style={{flex:1,padding:"8px 4px",borderRadius:8,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:speakerMode_iv===b.mode?`rgba(${b.bg},.18)`:"rgba(255,255,255,.03)",border:speakerMode_iv===b.mode?`2px solid rgba(${b.bg},.35)`:"1px solid rgba(255,255,255,.06)",transition:"all 0.2s"}}>
            {React.cloneElement(b.icon,{color:speakerMode_iv===b.mode?b.hex:"rgba(255,255,255,.2)"})}
            <span style={{fontSize:9,fontWeight:700,color:speakerMode_iv===b.mode?b.hex:"rgba(255,255,255,.2)"}}>{b.label}</span>
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:4}}>
        <button onClick={needAnswerNow} style={{flex:2,padding:"10px 8px",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"linear-gradient(135deg, rgba(251,191,36,.12), rgba(245,158,11,.06))",border:"1px solid rgba(251,191,36,.25)"}}>
          <Zap size={13} color="#fbbf24"/>
          <span style={{fontSize:11,fontWeight:700,color:"#fbbf24"}}>Answer Now</span>
        </button>
        <div style={{position:"relative",flex:1}}>
          <button onClick={()=>setShowRefineMenu(!showRefineMenu)} style={{width:"100%",padding:"10px 8px",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.15)"}}>
            <RotateCcw size={13} color="rgba(245,158,11,.5)"/>
            <span style={{fontSize:11,fontWeight:700,color:"rgba(245,158,11,.5)"}}>Refine</span>
          </button>
          {showRefineMenu&&<div style={{position:"absolute",bottom:"100%",left:0,right:0,marginBottom:4,background:"rgba(15,23,42,.98)",border:"1px solid rgba(245,158,11,.2)",borderRadius:8,overflow:"hidden",zIndex:50}}>
            <button onClick={()=>{setCookAnswers([]);setTimCues([]);setShowRefineMenu(false);}} style={{width:"100%",padding:"10px",border:"none",borderBottom:"1px solid rgba(255,255,255,.05)",background:"transparent",color:"rgba(245,158,11,.7)",fontSize:11,fontWeight:600,cursor:"pointer",textAlign:"left"}}>Reset Coaching</button>
            <button onClick={()=>{setShowRefineMenu(false);}} style={{width:"100%",padding:"10px",border:"none",background:"transparent",color:"rgba(245,158,11,.7)",fontSize:11,fontWeight:600,cursor:"pointer",textAlign:"left"}}>Recalibrate</button>
          </div>}
        </div>
        <button onClick={endInterview} style={{flex:1,padding:"10px 8px",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.15)"}}>
          <Square size={13} color="#f87171"/>
          <span style={{fontSize:11,fontWeight:700,color:"#f87171"}}>End</span>
        </button>
      </div>
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

    {/* ⬡B:MACE.iris:UI:bottom_control_panel_cip:20260409⬡ */}
    {running && <div style={{flexShrink:0,padding:"8px 10px",borderTop:"1px solid rgba(255,255,255,.06)",background:"rgba(0,0,0,.4)"}}>
      <div style={{display:"flex",gap:4,marginBottom:6}}>
        {[
          {mode:SPEAKER_MODES.THEY,bg:"16,185,129",hex:"#34d399",icon:<Users size={14}/>,label:"Just Listen"},
          {mode:SPEAKER_MODES.ME,bg:"59,130,246",hex:"#60a5fa",icon:<User size={14}/>,label:"My Turn"},
          {mode:SPEAKER_MODES.TEAM,bg:"168,85,247",hex:"#a78bfa",icon:<Users size={14}/>,label:"My Team"},
          {mode:SPEAKER_MODES.PAUSED,bg:"239,68,68",hex:"#f87171",icon:<Hand size={14}/>,label:"Pause"},
        ].map(b=>(
          <button key={b.mode} onClick={()=>setSpeakerMode_iv(b.mode)} style={{flex:1,padding:"8px 4px",borderRadius:8,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:speakerMode_iv===b.mode?`rgba(${b.bg},.18)`:"rgba(255,255,255,.03)",border:speakerMode_iv===b.mode?`2px solid rgba(${b.bg},.35)`:"1px solid rgba(255,255,255,.06)",transition:"all 0.2s"}}>
            {React.cloneElement(b.icon,{color:speakerMode_iv===b.mode?b.hex:"rgba(255,255,255,.2)"})}
            <span style={{fontSize:9,fontWeight:700,color:speakerMode_iv===b.mode?b.hex:"rgba(255,255,255,.2)"}}>{b.label}</span>
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:4}}>
        <button onClick={needAnswerNow} style={{flex:2,padding:"10px 8px",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"linear-gradient(135deg, rgba(251,191,36,.12), rgba(245,158,11,.06))",border:"1px solid rgba(251,191,36,.25)"}}>
          <Zap size={13} color="#fbbf24"/>
          <span style={{fontSize:11,fontWeight:700,color:"#fbbf24"}}>Answer Now</span>
        </button>
        <div style={{position:"relative",flex:1}}>
          <button onClick={()=>setShowRefineMenu(!showRefineMenu)} style={{width:"100%",padding:"10px 8px",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.15)"}}>
            <RotateCcw size={13} color="rgba(245,158,11,.5)"/>
            <span style={{fontSize:11,fontWeight:700,color:"rgba(245,158,11,.5)"}}>Refine</span>
          </button>
          {showRefineMenu&&<div style={{position:"absolute",bottom:"100%",left:0,right:0,marginBottom:4,background:"rgba(15,23,42,.98)",border:"1px solid rgba(245,158,11,.2)",borderRadius:8,overflow:"hidden",zIndex:50}}>
            <button onClick={()=>{setCookAnswers([]);setTimCues([]);setShowRefineMenu(false);}} style={{width:"100%",padding:"10px",border:"none",borderBottom:"1px solid rgba(255,255,255,.05)",background:"transparent",color:"rgba(245,158,11,.7)",fontSize:11,fontWeight:600,cursor:"pointer",textAlign:"left"}}>Reset Coaching</button>
            <button onClick={()=>{setShowRefineMenu(false);}} style={{width:"100%",padding:"10px",border:"none",background:"transparent",color:"rgba(245,158,11,.7)",fontSize:11,fontWeight:600,cursor:"pointer",textAlign:"left"}}>Recalibrate</button>
          </div>}
        </div>
        <button onClick={endInterview} style={{flex:1,padding:"10px 8px",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.15)"}}>
          <Square size={13} color="#f87171"/>
          <span style={{fontSize:11,fontWeight:700,color:"#f87171"}}>End</span>
        </button>
      </div>
    </div>}
    </div>
  </div>);

  // ═══════ MOCK MODE — Rich multi-round mock with STAR coach ═══════
  if (mode === "mock") return (<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"linear-gradient(180deg, rgba(245,158,11,.03) 0%, transparent 40%)"}}>
    <div style={{display:"flex",gap:3,padding:"8px 10px",borderBottom:`1px solid ${amber(.08)}`}}>
      {modeTab("prep","Prep",FileText)}{modeTab("research","Research",Search)}{modeTab("practice","Practice",Award)}{modeTab("live","Live",Mic)}{modeTab("mock","Mock",Target)}
    </div>
    <div style={{flex:1,overflowY:"auto",padding:"10px 12px"}}>
      {!selectedJob ? <p style={{color:"rgba(255,255,255,.4)",textAlign:"center",padding:40}}>Select a job in Prep mode first.</p>
      : <MockInterviewPanel job={selectedJob} api={api} userId={userId} onClose={()=>setMode("prep")}/>}
      {selectedJob && varaInterview===null && <button onClick={()=>setVaraInterview(selectedJob)} style={{width:"100%",marginTop:10,padding:"10px",borderRadius:10,border:"1px solid rgba(34,211,238,.2)",background:"rgba(34,211,238,.06)",color:"#22d3ee",fontSize:12,fontWeight:600,cursor:"pointer"}}>
        Voice Mock (VARA)
      </button>}

    {/* ⬡B:MACE.iris:UI:bottom_control_panel_cip:20260409⬡ */}
    {running && <div style={{flexShrink:0,padding:"8px 10px",borderTop:"1px solid rgba(255,255,255,.06)",background:"rgba(0,0,0,.4)"}}>
      <div style={{display:"flex",gap:4,marginBottom:6}}>
        {[
          {mode:SPEAKER_MODES.THEY,bg:"16,185,129",hex:"#34d399",icon:<Users size={14}/>,label:"Just Listen"},
          {mode:SPEAKER_MODES.ME,bg:"59,130,246",hex:"#60a5fa",icon:<User size={14}/>,label:"My Turn"},
          {mode:SPEAKER_MODES.TEAM,bg:"168,85,247",hex:"#a78bfa",icon:<Users size={14}/>,label:"My Team"},
          {mode:SPEAKER_MODES.PAUSED,bg:"239,68,68",hex:"#f87171",icon:<Hand size={14}/>,label:"Pause"},
        ].map(b=>(
          <button key={b.mode} onClick={()=>setSpeakerMode_iv(b.mode)} style={{flex:1,padding:"8px 4px",borderRadius:8,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:speakerMode_iv===b.mode?`rgba(${b.bg},.18)`:"rgba(255,255,255,.03)",border:speakerMode_iv===b.mode?`2px solid rgba(${b.bg},.35)`:"1px solid rgba(255,255,255,.06)",transition:"all 0.2s"}}>
            {React.cloneElement(b.icon,{color:speakerMode_iv===b.mode?b.hex:"rgba(255,255,255,.2)"})}
            <span style={{fontSize:9,fontWeight:700,color:speakerMode_iv===b.mode?b.hex:"rgba(255,255,255,.2)"}}>{b.label}</span>
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:4}}>
        <button onClick={needAnswerNow} style={{flex:2,padding:"10px 8px",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"linear-gradient(135deg, rgba(251,191,36,.12), rgba(245,158,11,.06))",border:"1px solid rgba(251,191,36,.25)"}}>
          <Zap size={13} color="#fbbf24"/>
          <span style={{fontSize:11,fontWeight:700,color:"#fbbf24"}}>Answer Now</span>
        </button>
        <div style={{position:"relative",flex:1}}>
          <button onClick={()=>setShowRefineMenu(!showRefineMenu)} style={{width:"100%",padding:"10px 8px",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.15)"}}>
            <RotateCcw size={13} color="rgba(245,158,11,.5)"/>
            <span style={{fontSize:11,fontWeight:700,color:"rgba(245,158,11,.5)"}}>Refine</span>
          </button>
          {showRefineMenu&&<div style={{position:"absolute",bottom:"100%",left:0,right:0,marginBottom:4,background:"rgba(15,23,42,.98)",border:"1px solid rgba(245,158,11,.2)",borderRadius:8,overflow:"hidden",zIndex:50}}>
            <button onClick={()=>{setCookAnswers([]);setTimCues([]);setShowRefineMenu(false);}} style={{width:"100%",padding:"10px",border:"none",borderBottom:"1px solid rgba(255,255,255,.05)",background:"transparent",color:"rgba(245,158,11,.7)",fontSize:11,fontWeight:600,cursor:"pointer",textAlign:"left"}}>Reset Coaching</button>
            <button onClick={()=>{setShowRefineMenu(false);}} style={{width:"100%",padding:"10px",border:"none",background:"transparent",color:"rgba(245,158,11,.7)",fontSize:11,fontWeight:600,cursor:"pointer",textAlign:"left"}}>Recalibrate</button>
          </div>}
        </div>
        <button onClick={endInterview} style={{flex:1,padding:"10px 8px",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.15)"}}>
          <Square size={13} color="#f87171"/>
          <span style={{fontSize:11,fontWeight:700,color:"#f87171"}}>End</span>
        </button>
      </div>
    </div>}
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
        
      </div>
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

      {/* TIM CUE QUEUE */}
      <TIMQueueMobile cues={timCues} activeCue={activeCue}/>

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

      {/* POST-INTERVIEW ACTIONS — thank you email, recap notes, follow-up tasks */}
      {summary && selectedJob && <div style={{marginTop:10}}><PostInterviewMobile job={selectedJob} api={api} userId={userId}/></div>}

    {/* ⬡B:MACE.iris:UI:bottom_control_panel_cip:20260409⬡ */}
    {running && <div style={{flexShrink:0,padding:"8px 10px",borderTop:"1px solid rgba(255,255,255,.06)",background:"rgba(0,0,0,.4)"}}>
      <div style={{display:"flex",gap:4,marginBottom:6}}>
        {[
          {mode:SPEAKER_MODES.THEY,bg:"16,185,129",hex:"#34d399",icon:<Users size={14}/>,label:"Just Listen"},
          {mode:SPEAKER_MODES.ME,bg:"59,130,246",hex:"#60a5fa",icon:<User size={14}/>,label:"My Turn"},
          {mode:SPEAKER_MODES.TEAM,bg:"168,85,247",hex:"#a78bfa",icon:<Users size={14}/>,label:"My Team"},
          {mode:SPEAKER_MODES.PAUSED,bg:"239,68,68",hex:"#f87171",icon:<Hand size={14}/>,label:"Pause"},
        ].map(b=>(
          <button key={b.mode} onClick={()=>setSpeakerMode_iv(b.mode)} style={{flex:1,padding:"8px 4px",borderRadius:8,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:speakerMode_iv===b.mode?`rgba(${b.bg},.18)`:"rgba(255,255,255,.03)",border:speakerMode_iv===b.mode?`2px solid rgba(${b.bg},.35)`:"1px solid rgba(255,255,255,.06)",transition:"all 0.2s"}}>
            {React.cloneElement(b.icon,{color:speakerMode_iv===b.mode?b.hex:"rgba(255,255,255,.2)"})}
            <span style={{fontSize:9,fontWeight:700,color:speakerMode_iv===b.mode?b.hex:"rgba(255,255,255,.2)"}}>{b.label}</span>
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:4}}>
        <button onClick={needAnswerNow} style={{flex:2,padding:"10px 8px",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"linear-gradient(135deg, rgba(251,191,36,.12), rgba(245,158,11,.06))",border:"1px solid rgba(251,191,36,.25)"}}>
          <Zap size={13} color="#fbbf24"/>
          <span style={{fontSize:11,fontWeight:700,color:"#fbbf24"}}>Answer Now</span>
        </button>
        <div style={{position:"relative",flex:1}}>
          <button onClick={()=>setShowRefineMenu(!showRefineMenu)} style={{width:"100%",padding:"10px 8px",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.15)"}}>
            <RotateCcw size={13} color="rgba(245,158,11,.5)"/>
            <span style={{fontSize:11,fontWeight:700,color:"rgba(245,158,11,.5)"}}>Refine</span>
          </button>
          {showRefineMenu&&<div style={{position:"absolute",bottom:"100%",left:0,right:0,marginBottom:4,background:"rgba(15,23,42,.98)",border:"1px solid rgba(245,158,11,.2)",borderRadius:8,overflow:"hidden",zIndex:50}}>
            <button onClick={()=>{setCookAnswers([]);setTimCues([]);setShowRefineMenu(false);}} style={{width:"100%",padding:"10px",border:"none",borderBottom:"1px solid rgba(255,255,255,.05)",background:"transparent",color:"rgba(245,158,11,.7)",fontSize:11,fontWeight:600,cursor:"pointer",textAlign:"left"}}>Reset Coaching</button>
            <button onClick={()=>{setShowRefineMenu(false);}} style={{width:"100%",padding:"10px",border:"none",background:"transparent",color:"rgba(245,158,11,.7)",fontSize:11,fontWeight:600,cursor:"pointer",textAlign:"left"}}>Recalibrate</button>
          </div>}
        </div>
        <button onClick={endInterview} style={{flex:1,padding:"10px 8px",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.15)"}}>
          <Square size={13} color="#f87171"/>
          <span style={{fontSize:11,fontWeight:700,color:"#f87171"}}>End</span>
        </button>
      </div>
    </div>}
    </div>
  </div>);
}



