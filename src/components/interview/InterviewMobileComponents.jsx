// ⬡B:MACE.parity:COMPONENTS:interview_mobile:20260406⬡
// Mobile-optimized interview components for CIP (MyABA phone)
// These bring CIP to FEATURE PARITY with CIB's 196KB rich interview suite.
// All logic flows through iris-core.js hooks. Only rendering lives here.
// Desktop-only components (SplitScreenGuidance, FullScreenMode) are excluded — 
// those are window management features that don't apply to phones.

import { useState, useEffect, useCallback } from "react";
import { Target, Award, Search, Building2, Mail, FileText, Loader2, ChevronRight, RefreshCw, Zap } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// STAR COACH — Real-time STAR scoring with component-by-component feedback
// Source: CIB STARCoach.jsx (136 lines) — mobile layout
// ═══════════════════════════════════════════════════════════════════════════

const STAR_WEIGHTS = [
  { id: 'situation', label: 'Situation', weight: '20%', color: '#60a5fa' },
  { id: 'task', label: 'Task', weight: '20%', color: '#a78bfa' },
  { id: 'action', label: 'Action', weight: '35%', color: '#34d399' },
  { id: 'result', label: 'Result', weight: '25%', color: '#fbbf24' },
];

export function STARCoachMobile({ question, api, userId, onClose }) {
  const [answer, setAnswer] = useState('');
  const [scoring, setScoring] = useState(null);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const handleScore = async () => {
    if (!answer.trim()) return;
    setLoading(true);
    try {
      const r = await api('/api/air/process', {
        method: 'POST',
        body: {
          message: `Score this STAR interview answer on a 0-5 scale for each component. Question: "${question}" Answer: "${answer}" Return JSON with: situation_score (0-5), task_score (0-5), action_score (0-5), result_score (0-5), total_percent (weighted: S=20%, T=20%, A=35%, R=25%), coaching_tip (specific actionable feedback). Only return the JSON object.`,
          user_id: userId, channel: 'myaba', appScope: 'interview',
        }
      });
      try {
        const text = r.response || r.message || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setScoring(parsed);
          setAttempts(prev => prev + 1);
        }
      } catch { setScoring({ coaching_tip: 'Could not parse scoring. Try rephrasing your answer.' }); }
    } catch { setScoring({ coaching_tip: 'Could not reach ABA.' }); }
    setLoading(false);
  };

  const total = scoring?.total_percent || 0;
  const color = total >= 80 ? '#10b981' : total >= 60 ? '#f59e0b' : '#ef4444';
  const label = total >= 80 ? 'Strong' : total >= 60 ? 'Developing' : 'Needs Work';

  return (
    <div style={{padding:12,borderRadius:14,background:'rgba(139,92,246,.06)',border:'1px solid rgba(139,92,246,.12)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <Target size={14} color="#a78bfa"/>
          <span style={{color:'#a78bfa',fontSize:12,fontWeight:600}}>STAR Coach</span>
          {attempts > 0 && <span style={{color:'rgba(255,255,255,.3)',fontSize:10}}>Attempt {attempts}</span>}
        </div>
        {onClose && <button onClick={onClose} style={{background:'none',border:'none',color:'rgba(255,255,255,.3)',cursor:'pointer',fontSize:14}}>×</button>}
      </div>

      {question && <p style={{color:'rgba(255,255,255,.5)',fontSize:11,margin:'0 0 8px',fontStyle:'italic'}}>Q: {question}</p>}

      <textarea value={answer} onChange={e => setAnswer(e.target.value)}
        placeholder="Type your STAR answer here..."
        style={{width:'100%',minHeight:80,padding:10,borderRadius:10,border:'1px solid rgba(139,92,246,.15)',background:'rgba(255,255,255,.03)',color:'white',fontSize:12,resize:'vertical',outline:'none',boxSizing:'border-box'}}/>

      <button onClick={handleScore} disabled={loading || !answer.trim()}
        style={{width:'100%',padding:'10px',borderRadius:8,border:'none',background:'rgba(139,92,246,.2)',color:'#a78bfa',fontSize:12,fontWeight:600,cursor:'pointer',marginTop:8,opacity:loading?.5:1}}>
        {loading ? 'Scoring...' : scoring ? 'Re-Score' : 'Score My Answer'}
      </button>

      {scoring && scoring.situation_score !== undefined && (
        <div style={{marginTop:12}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <Award size={14} color={color}/>
            <span style={{color,fontSize:13,fontWeight:600}}>{total}% — {label}</span>
          </div>
          {STAR_WEIGHTS.map(sw => {
            const score = scoring[sw.id + '_score'] || 0;
            return (
              <div key={sw.id} style={{marginBottom:6}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:10,marginBottom:2}}>
                  <span style={{color:'rgba(255,255,255,.5)'}}>{sw.label} ({sw.weight})</span>
                  <span style={{color:sw.color,fontWeight:700}}>{score}/5</span>
                </div>
                <div style={{height:5,background:'rgba(255,255,255,.08)',borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${(score/5)*100}%`,background:sw.color,borderRadius:3,transition:'width .5s'}}/>
                </div>
              </div>
            );
          })}
          {scoring.coaching_tip && <p style={{color:'rgba(255,255,255,.6)',fontSize:11,margin:'8px 0 0',lineHeight:1.5,padding:8,background:'rgba(255,255,255,.03)',borderRadius:8}}>{scoring.coaching_tip}</p>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPANY RESEARCH — AI-powered company research before interviews
// Source: CIB CompanyResearch.jsx (101 lines) — mobile card layout
// ═══════════════════════════════════════════════════════════════════════════

export function CompanyResearchMobile({ job, api, userId, onClose }) {
  const [research, setResearch] = useState(null);
  const [loading, setLoading] = useState(false);

  const doResearch = useCallback(async () => {
    if (!job) return;
    setLoading(true);
    try {
      const r = await api('/api/air/process', {
        method: 'POST',
        body: {
          message: `Research ${job.organization || job.company} thoroughly for a ${job.title || job.job_title} interview. Return a JSON object with: mission (string), recent_news (array of 3-5 strings), culture (string), key_people (array of {name, role}), interview_tips (array of 3 strings), glassdoor_summary (string).`,
          user_id: userId, channel: 'myaba', appScope: 'interview',
        }
      });
      try {
        const text = r.response || r.message || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) setResearch(JSON.parse(jsonMatch[0]));
        else setResearch({ mission: text });
      } catch { setResearch({ mission: r.response || 'Could not parse research.' }); }
    } catch { setResearch({ mission: 'Could not reach ABA.' }); }
    setLoading(false);
  }, [job, api, userId]);

  useEffect(() => { if (job && !research) doResearch(); }, [job]);

  const Section = ({ icon: Icon, title, color, children }) => (
    <div style={{marginBottom:12}}>
      <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:4}}>
        <Icon size={12} color={color}/><span style={{color,fontSize:11,fontWeight:600}}>{title}</span>
      </div>
      <div style={{paddingLeft:17}}>{children}</div>
    </div>
  );

  return (
    <div style={{padding:12,borderRadius:14,background:'rgba(59,130,246,.06)',border:'1px solid rgba(59,130,246,.12)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <Building2 size={14} color="#60a5fa"/>
          <span style={{color:'#60a5fa',fontSize:12,fontWeight:600}}>Company Research</span>
        </div>
        <div style={{display:'flex',gap:6}}>
          <button onClick={doResearch} disabled={loading} style={{background:'none',border:'none',color:'rgba(255,255,255,.3)',cursor:'pointer'}}><RefreshCw size={12}/></button>
          {onClose && <button onClick={onClose} style={{background:'none',border:'none',color:'rgba(255,255,255,.3)',cursor:'pointer',fontSize:14}}>×</button>}
        </div>
      </div>

      {loading && <div style={{textAlign:'center',padding:20}}><Loader2 size={20} style={{animation:'spin 1s linear infinite',color:'#60a5fa'}}/><p style={{color:'rgba(255,255,255,.3)',fontSize:11,marginTop:8}}>Researching {job?.organization || 'company'}...</p></div>}

      {research && !loading && (
        <>
          {research.mission && <Section icon={Building2} title="Mission" color="#60a5fa"><p style={{color:'rgba(255,255,255,.6)',fontSize:11,lineHeight:1.5,margin:0}}>{research.mission}</p></Section>}
          {research.culture && <Section icon={Search} title="Culture" color="#a78bfa"><p style={{color:'rgba(255,255,255,.6)',fontSize:11,lineHeight:1.5,margin:0}}>{research.culture}</p></Section>}
          {research.recent_news?.length > 0 && <Section icon={FileText} title="Recent News" color="#34d399">{research.recent_news.map((n,i)=><p key={i} style={{color:'rgba(255,255,255,.5)',fontSize:11,margin:'0 0 4px'}}>• {n}</p>)}</Section>}
          {research.interview_tips?.length > 0 && <Section icon={Target} title="Interview Tips" color="#fbbf24">{research.interview_tips.map((t,i)=><p key={i} style={{color:'rgba(255,255,255,.5)',fontSize:11,margin:'0 0 4px'}}>• {t}</p>)}</Section>}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// POST INTERVIEW ACTIONS — Thank you email, recap notes, follow-up tasks
// Source: CIB PostInterviewActions.jsx (307 lines) — mobile card layout
// ═══════════════════════════════════════════════════════════════════════════

const POST_ACTIONS = [
  { id: 'thank_you', label: 'Thank You Email', icon: Mail, color: '#34d399' },
  { id: 'recap', label: 'Recap Notes', icon: FileText, color: '#60a5fa' },
  { id: 'follow_up', label: 'Follow-Up Task', icon: ChevronRight, color: '#fbbf24' },
];

export function PostInterviewMobile({ job, interviewerName, api, userId, onClose }) {
  const [activeAction, setActiveAction] = useState(null);
  const [generated, setGenerated] = useState({});
  const [loading, setLoading] = useState(false);

  const generate = async (actionId) => {
    setLoading(true); setActiveAction(actionId);
    const org = job?.organization || job?.company || 'the company';
    const title = job?.title || job?.job_title || 'the position';
    const interviewer = interviewerName || 'the interviewer';

    const prompts = {
      thank_you: `Generate a thank you email for a ${title} interview at ${org} with ${interviewer}. Keep it warm, professional, one paragraph body. Include subject line. Return plain text with Subject: on first line then body.`,
      recap: `Generate interview recap notes for a ${title} interview at ${org} with ${interviewer}. Include: key topics discussed, strengths shown, areas to improve, follow-up items. Format as clean notes.`,
      follow_up: `Generate 3-5 follow-up action items after a ${title} interview at ${org}. Include timeline for each. Format as a numbered list.`,
    };

    try {
      const r = await api('/api/air/process', {
        method: 'POST', body: { message: prompts[actionId], user_id: userId, channel: 'myaba', appScope: 'interview' }
      });
      setGenerated(prev => ({ ...prev, [actionId]: r.response || r.message || '' }));
    } catch { setGenerated(prev => ({ ...prev, [actionId]: 'Could not reach ABA.' })); }
    setLoading(false);
  };

  return (
    <div style={{padding:12,borderRadius:14,background:'rgba(16,185,129,.06)',border:'1px solid rgba(16,185,129,.12)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <span style={{color:'#34d399',fontSize:12,fontWeight:600}}>Post-Interview Actions</span>
        {onClose && <button onClick={onClose} style={{background:'none',border:'none',color:'rgba(255,255,255,.3)',cursor:'pointer',fontSize:14}}>×</button>}
      </div>

      <div style={{display:'flex',gap:6,marginBottom:10}}>
        {POST_ACTIONS.map(a => (
          <button key={a.id} onClick={() => generated[a.id] ? setActiveAction(a.id) : generate(a.id)}
            style={{flex:1,padding:'8px 4px',borderRadius:8,border:`1px solid ${a.color}25`,background:activeAction===a.id?`${a.color}15`:'rgba(255,255,255,.03)',color:a.color,fontSize:10,fontWeight:500,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
            <a.icon size={14}/>{a.label}
            {generated[a.id] && <span style={{fontSize:8,opacity:.5}}>✓</span>}
          </button>
        ))}
      </div>

      {loading && <div style={{textAlign:'center',padding:12}}><Loader2 size={16} style={{animation:'spin 1s linear infinite',color:'#34d399'}}/></div>}

      {activeAction && generated[activeAction] && !loading && (
        <div style={{padding:10,borderRadius:10,background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.06)'}}>
          <p style={{color:'rgba(255,255,255,.7)',fontSize:11,lineHeight:1.6,margin:0,whiteSpace:'pre-wrap'}}>{generated[activeAction]}</p>
          <button onClick={() => navigator.clipboard?.writeText(generated[activeAction])}
            style={{marginTop:8,padding:'6px 12px',borderRadius:6,border:'1px solid rgba(255,255,255,.1)',background:'rgba(255,255,255,.05)',color:'rgba(255,255,255,.5)',fontSize:10,cursor:'pointer'}}>
            Copy
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TIM QUEUE — Compact verbal filler cue display for mobile
// Source: CIB TIMQueueManager.jsx (105 lines) — minimal mobile version
// ═══════════════════════════════════════════════════════════════════════════

export function TIMQueueMobile({ cues, activeCue }) {
  // This is a pure display component — TIM firing logic is in mesa-core processSegment
  if (!cues || cues.length === 0) return null;

  return (
    <div style={{padding:8,borderRadius:10,background:'rgba(34,211,238,.06)',border:'1px solid rgba(34,211,238,.1)'}}>
      <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:6}}>
        <Zap size={10} color="#22d3ee"/>
        <span style={{color:'#22d3ee',fontSize:9,fontWeight:600,letterSpacing:.5}}>TIM CUES</span>
      </div>
      {activeCue && (
        <div style={{padding:8,borderRadius:8,background:'rgba(34,211,238,.1)',border:'1px solid rgba(34,211,238,.15)',marginBottom:4}}>
          <p style={{color:'#22d3ee',fontSize:12,margin:0,fontWeight:500}}>{activeCue.text}</p>
          <span style={{color:'rgba(34,211,238,.4)',fontSize:9}}>{activeCue.time} · {activeCue.type}</span>
        </div>
      )}
      {cues.filter(c => c !== activeCue).slice(-3).map((c, i) => (
        <div key={c.ts || i} style={{padding:4,borderBottom:'1px solid rgba(255,255,255,.04)'}}>
          <p style={{color:'rgba(255,255,255,.4)',fontSize:10,margin:0}}>{c.text}</p>
          <span style={{color:'rgba(255,255,255,.2)',fontSize:8}}>{c.time}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MOCK INTERVIEW PANEL — Multi-round text mock with STAR scoring
// Source: CIB MockInterviewMode.jsx (1088 lines) — simplified mobile version
// Uses iris-core useMockInterview hook for logic
// ═══════════════════════════════════════════════════════════════════════════

export function MockInterviewPanel({ job, api, userId, onClose }) {
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [round, setRound] = useState(0);
  const [showSTAR, setShowSTAR] = useState(false);

  const jobId = job?.id;
  const title = job?.title || job?.job_title || 'the position';
  const org = job?.organization || job?.company || '';

  const startRound = async () => {
    setLoading(true); setQuestion(null); setEvaluation(null); setAnswer(''); setShowSTAR(false);
    try {
      const r = await api(`/api/awa/jobs/${jobId}/mock-question`, {
        method: 'POST', body: { userId, previousQuestions: history.map(h => h.question) }
      });
      setQuestion(r.question || r.data?.question || r.response || 'Could not generate question');
      setRound(prev => prev + 1);
    } catch { setQuestion('Could not reach ABA.'); }
    setLoading(false);
  };

  const submitAnswer = async () => {
    if (!answer.trim()) return;
    setLoading(true);
    try {
      const r = await api(`/api/awa/jobs/${jobId}/mock-evaluate`, {
        method: 'POST', body: { question, answer, userId }
      });
      const eval_ = r.evaluation || r.data?.evaluation || r.response || '';
      setEvaluation(eval_);
      setHistory(prev => [...prev, { question, answer, evaluation: eval_, round }]);
    } catch { setEvaluation('Could not evaluate.'); }
    setLoading(false);
  };

  useEffect(() => { if (jobId) startRound(); }, [jobId]);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:10,padding:4}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <span style={{color:'#22d3ee',fontSize:12,fontWeight:600}}>Mock Interview</span>
          <span style={{color:'rgba(255,255,255,.3)',fontSize:10,marginLeft:8}}>Round {round} · {title}</span>
        </div>
        {onClose && <button onClick={onClose} style={{background:'none',border:'none',color:'rgba(255,255,255,.3)',cursor:'pointer',fontSize:14}}>×</button>}
      </div>

      {/* Question */}
      {question && (
        <div style={{padding:12,borderRadius:12,background:'rgba(34,211,238,.06)',border:'1px solid rgba(34,211,238,.1)'}}>
          <p style={{color:'rgba(255,255,255,.3)',fontSize:9,margin:'0 0 4px',fontWeight:600,letterSpacing:.5}}>INTERVIEWER</p>
          <p style={{color:'rgba(255,255,255,.85)',fontSize:13,margin:0,lineHeight:1.5}}>{question}</p>
        </div>
      )}

      {/* Answer input */}
      {question && !evaluation && (
        <>
          <textarea value={answer} onChange={e => setAnswer(e.target.value)}
            placeholder="Type your answer..."
            style={{width:'100%',minHeight:100,padding:12,borderRadius:12,border:'1px solid rgba(255,255,255,.1)',background:'rgba(255,255,255,.03)',color:'white',fontSize:13,resize:'vertical',outline:'none',lineHeight:1.5,boxSizing:'border-box'}}/>
          <div style={{display:'flex',gap:8}}>
            <button onClick={submitAnswer} disabled={loading || !answer.trim()}
              style={{flex:1,padding:'10px',borderRadius:10,border:'none',background:'rgba(34,211,238,.2)',color:'#22d3ee',fontSize:12,fontWeight:600,cursor:'pointer',opacity:loading?.5:1}}>
              {loading ? 'Evaluating...' : 'Submit Answer'}
            </button>
            <button onClick={() => setShowSTAR(!showSTAR)}
              style={{padding:'10px 14px',borderRadius:10,border:'1px solid rgba(139,92,246,.2)',background:showSTAR?'rgba(139,92,246,.15)':'transparent',color:'#a78bfa',fontSize:12,cursor:'pointer'}}>
              <Target size={14}/>
            </button>
          </div>
        </>
      )}

      {/* STAR Coach inline */}
      {showSTAR && question && !evaluation && (
        <STARCoachMobile question={question} api={api} userId={userId} onClose={() => setShowSTAR(false)}/>
      )}

      {/* Evaluation */}
      {evaluation && (
        <div style={{padding:12,borderRadius:12,background:'rgba(16,185,129,.06)',border:'1px solid rgba(16,185,129,.12)'}}>
          <p style={{color:'rgba(255,255,255,.3)',fontSize:9,margin:'0 0 4px',fontWeight:600,letterSpacing:.5}}>FEEDBACK</p>
          <p style={{color:'rgba(255,255,255,.7)',fontSize:12,margin:0,lineHeight:1.6,whiteSpace:'pre-wrap'}}>{evaluation}</p>
          <button onClick={startRound} disabled={loading}
            style={{marginTop:10,width:'100%',padding:'10px',borderRadius:10,border:'none',background:'rgba(34,211,238,.15)',color:'#22d3ee',fontSize:12,fontWeight:600,cursor:'pointer'}}>
            {loading ? 'Loading...' : 'Next Question →'}
          </button>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div style={{borderTop:'1px solid rgba(255,255,255,.06)',paddingTop:8}}>
          <p style={{color:'rgba(255,255,255,.3)',fontSize:9,fontWeight:600,letterSpacing:.5,margin:'0 0 6px'}}>HISTORY ({history.length} rounds)</p>
          {history.map((h, i) => (
            <div key={i} style={{padding:8,borderRadius:8,background:'rgba(255,255,255,.02)',marginBottom:4}}>
              <p style={{color:'rgba(255,255,255,.4)',fontSize:10,margin:0}}>Q{h.round}: {(h.question || '').substring(0, 60)}...</p>
            </div>
          ))}
        </div>
      )}

      {loading && !question && <div style={{textAlign:'center',padding:20}}><Loader2 size={20} style={{animation:'spin 1s linear infinite',color:'#22d3ee'}}/></div>}
    </div>
  );
}
