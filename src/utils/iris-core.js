// ⬡B:MACE.phase2:CORE:iris_core:20260406⬡
// Interview Readiness and Intelligence System (IRIS) Shared Core Library
// Source of truth for all IRIS surfaces: CIP InterviewModeView, CIB InterviewPrepApp, IRIS standalone
// TIM/COOK functions imported from mesa-core.js (shared with Meeting Support Application)

import { useState, useRef, useEffect, useCallback } from "react";
// TIM/COOK shared with MESA — one source of truth
export { fetchTimCue, fetchCookAnswer, isQuestion, INTERROGATIVES, formatTime } from "./mesa-core.js";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

// 5 interview modes (source: all 3 surfaces, identical)
export const INTERVIEW_MODES = ['prep', 'research', 'practice', 'live', 'mock'];

// STAR (Situation, Task, Action, Result) scoring components with weights
export const STAR_COMPONENTS = [
  { id: 'situation', label: 'Situation', weight: 0.2, description: 'Clear context and background' },
  { id: 'task', label: 'Task', weight: 0.2, description: 'Specific responsibility or challenge' },
  { id: 'action', label: 'Action', weight: 0.35, description: 'Concrete steps you personally took' },
  { id: 'result', label: 'Result', weight: 0.25, description: 'Measurable outcome or impact' },
];

// ═══════════════════════════════════════════════════════════════════════════
// API FUNCTIONS (all take apiAdapter as first argument)
// ═══════════════════════════════════════════════════════════════════════════

// Load AWA jobs for the interview job picker
export async function loadJobs(api, userId) {
  try {
    const result = await api('/api/awa/jobs?userId=' + encodeURIComponent(userId));
    return Array.isArray(result) ? result : result.jobs || [];
  } catch (err) {
    console.error('[IRIS] Load jobs error:', err);
    return [];
  }
}

// Generate interview prep package for a specific job
export async function generatePrep(api, jobId, userId) {
  try {
    return await api(`/api/awa/jobs/${jobId}/interview-prep`, {
      method: 'POST',
      body: { userId }
    });
  } catch (err) {
    console.error('[IRIS] Prep error:', err);
    return null;
  }
}

// Generate a mock interview question
export async function generateMockQuestion(api, jobId, userId, previousQuestions) {
  try {
    return await api(`/api/awa/jobs/${jobId}/mock-question`, {
      method: 'POST',
      body: { userId, previousQuestions: previousQuestions || [] }
    });
  } catch (err) {
    console.error('[IRIS] Mock question error:', err);
    return null;
  }
}

// Evaluate a mock interview answer
export async function evaluateMockAnswer(api, jobId, question, answer, userId) {
  try {
    return await api(`/api/awa/jobs/${jobId}/mock-evaluate`, {
      method: 'POST',
      body: { question, answer, userId }
    });
  } catch (err) {
    console.error('[IRIS] Mock evaluate error:', err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

// Clean job title (re-export from awa-core pattern)
export function cleanInterviewTitle(raw) {
  if (!raw) return 'Untitled';
  const match = raw.match(/^[0-9a-fA-F]{32}\s+(.+)$/);
  return match ? match[1].replace(/\s+/g, ' ').trim() : raw;
}

// Score a STAR response based on component presence
export function scoreSTAR(text) {
  if (!text) return { total: 0, components: {} };
  const lower = text.toLowerCase();
  const scores = {};
  
  // Situation: look for context-setting language
  scores.situation = (lower.includes('when') || lower.includes('at') || lower.includes('during') || lower.includes('while') || lower.includes('context') || lower.includes('background')) ? 1 : 0;
  
  // Task: look for responsibility language
  scores.task = (lower.includes('responsible') || lower.includes('needed to') || lower.includes('had to') || lower.includes('my role') || lower.includes('challenge') || lower.includes('goal')) ? 1 : 0;
  
  // Action: look for personal action language
  scores.action = (lower.includes('i ') || lower.includes('implemented') || lower.includes('created') || lower.includes('developed') || lower.includes('led') || lower.includes('built') || lower.includes('designed')) ? 1 : 0;
  
  // Result: look for outcome language
  scores.result = (lower.includes('result') || lower.includes('outcome') || lower.includes('increased') || lower.includes('decreased') || lower.includes('improved') || lower.includes('achieved') || lower.includes('%') || lower.includes('dollar')) ? 1 : 0;
  
  const total = STAR_COMPONENTS.reduce((sum, comp) => sum + (scores[comp.id] || 0) * comp.weight, 0);
  return { total: Math.round(total * 100), components: scores };
}

// ═══════════════════════════════════════════════════════════════════════════
// REACT HOOKS
// ═══════════════════════════════════════════════════════════════════════════

// Interview prep hook — loads prep data for a selected job
export function useInterviewPrep(api, userId) {
  const [prepData, setPrepData] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async (jobId) => {
    setLoading(true); setPrepData(null);
    try {
      const result = await generatePrep(api, jobId, userId);
      setPrepData(result?.prep || result?.data?.prep || result);
    } catch (err) {
      console.error('[IRIS] Prep error:', err);
    }
    setLoading(false);
  }, [api, userId]);

  return { prepData, loading, generate, setPrepData };
}

// Mock interview hook — manages question/answer/evaluation cycle
export function useMockInterview(api, userId) {
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const start = useCallback(async (jobId) => {
    setLoading(true); setQuestion(null); setEvaluation(null); setAnswer('');
    try {
      const result = await generateMockQuestion(api, jobId, userId, history.map(h => h.question));
      setQuestion(result?.question || result?.data?.question || result?.response || 'Could not generate question');
    } catch (err) {
      setQuestion('Error: ' + err.message);
    }
    setLoading(false);
  }, [api, userId, history]);

  const submit = useCallback(async (jobId) => {
    if (!answer.trim()) return;
    setLoading(true);
    try {
      const result = await evaluateMockAnswer(api, jobId, question, answer, userId);
      const eval_ = result?.evaluation || result?.data?.evaluation || result?.response || '';
      setEvaluation(eval_);
      setHistory(prev => [...prev, { question, answer, evaluation: eval_ }]);
    } catch (err) {
      setEvaluation('Error: ' + err.message);
    }
    setLoading(false);
  }, [api, userId, question, answer]);

  const next = useCallback(async (jobId) => {
    setEvaluation(null); setAnswer('');
    await start(jobId);
  }, [start]);

  return { question, answer, setAnswer, evaluation, history, loading, start, submit, next };
}

// STAR Coach hook — real-time scoring of interview answers
export function useSTARCoach() {
  const [lastScore, setLastScore] = useState(null);
  const [feedback, setFeedback] = useState([]);

  const score = useCallback((text) => {
    const result = scoreSTAR(text);
    setLastScore(result);
    
    // Generate feedback for missing components
    const missing = STAR_COMPONENTS.filter(c => !result.components[c.id]);
    const newFeedback = missing.map(c => ({
      component: c.label,
      tip: `Try adding ${c.description.toLowerCase()} to strengthen your answer.`,
    }));
    setFeedback(newFeedback);
    
    return result;
  }, []);

  return { lastScore, feedback, score };
}

// Company research hook — AI-powered research on the company
export function useCompanyResearch(api, userId) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);

  const research = useCallback(async (companyName, jobTitle) => {
    setLoading(true); setInsights(null);
    try {
      const result = await api('/api/air/process', {
        method: 'POST',
        body: {
          message: `Research ${companyName} for an interview for the position of ${jobTitle}. Include: company overview, recent news, culture, key people, and interview tips specific to this company.`,
          user_id: userId,
          channel: 'myaba',
          appScope: 'interview',
        }
      });
      setInsights(result?.response || result?.message || '');
    } catch {
      setInsights('Could not reach ABA for research.');
    }
    setLoading(false);
  }, [api, userId]);

  return { insights, loading, research };
}
