// ⬡B:MACE.phase1:CORE:awa_core:20260406⬡
// ABA Workforce Automation (AWA) Shared Core Library
// Source of truth for all AWA surfaces: CIP JobsView, CIB JobsApp, AWA Portal JobsPipeline
// Best version of each function extracted from side-by-side comparison of all 3 surfaces.
// Every skin imports from this core. Logic lives here. Rendering lives in the skin.

import { useState, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

// 14 pipeline stages — matches backend AWA_STATUSES exactly (source: CIB, most complete)
export const PIPELINE_STAGES = [
  'NEW', 'SAVED', 'MATERIALS_READY', 'APPLIED', 'WAITING',
  'INTERVIEW', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'SECOND_INTERVIEW',
  'OFFER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'DISMISSED'
];

// Team members with display info (source: CIP, richest version, extended with "all" and "unmatched")
export const TEAM = [
  { id: 'all', name: 'All', color: '#6B7280' },
  { id: 'brandon', name: 'Brandon', color: '#8B5CF6' },
  { id: 'eric', name: 'Eric', color: '#3B82F6' },
  { id: 'bj', name: 'BJ', color: '#10B981' },
  { id: 'cj', name: 'CJ', color: '#F59E0B' },
  { id: 'vante', name: 'Vante', color: '#F97316' },
  { id: 'dwayne', name: 'Dwayne', color: '#EC4899' },
  { id: 'gmg', name: 'GMG', color: '#6B7280' },
  { id: 'UNMATCHED', name: 'Unmatched', color: '#9CA3AF' },
];

// Simple team ID array (source: CIB)
export const TEAM_IDS = ['brandon', 'eric', 'bj', 'cj', 'vante', 'dwayne'];

// Team color lookup by display name (source: CIP)
export const TEAM_COLORS = {
  'Brandon': '#8B5CF6', 'Eric': '#3B82F6', 'BJ': '#10B981',
  'CJ': '#F59E0B', 'Vante': '#F97316', 'Dwayne': '#EC4899',
  'GMG': '#6B7280', 'Unmatched': '#9CA3AF',
  // Lowercase variants for flexible matching
  'brandon': '#8B5CF6', 'eric': '#3B82F6', 'bj': '#10B981',
  'cj': '#F59E0B', 'vante': '#F97316', 'dwayne': '#EC4899',
  'gmg': '#6B7280', 'unmatched': '#9CA3AF',
};

// Stage colors with bg and text (source: Portal, extended to all 14 stages)
export const STAGE_COLORS = {
  NEW:                 { bg: 'rgba(255,255,255,0.1)', text: 'rgba(255,255,255,0.5)' },
  SAVED:               { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.4)' },
  MATERIALS_READY:     { bg: 'rgba(59,130,246,0.2)', text: '#60a5fa' },
  APPLIED:             { bg: 'rgba(59,130,246,0.2)', text: '#60a5fa' },
  WAITING:             { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24' },
  INTERVIEW:           { bg: 'rgba(34,197,94,0.2)', text: '#4ade80' },
  INTERVIEW_SCHEDULED: { bg: 'rgba(245,158,11,0.2)', text: '#fbbf24' },
  INTERVIEWED:         { bg: 'rgba(245,158,11,0.25)', text: '#f59e0b' },
  SECOND_INTERVIEW:    { bg: 'rgba(168,85,247,0.15)', text: '#a78bfa' },
  OFFER:               { bg: 'rgba(168,85,247,0.2)', text: '#c084fc' },
  ACCEPTED:            { bg: 'rgba(34,197,94,0.3)', text: '#4ade80' },
  REJECTED:            { bg: 'rgba(239,68,68,0.2)', text: '#f87171' },
  WITHDRAWN:           { bg: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.35)' },
  DISMISSED:           { bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.3)' },
};

// Personal emails per Human ABA Master (HAM) (source: Portal)
export const PERSONAL_EMAILS = {
  brandon: 'brandonjpiercesr@gmail.com',
  eric: 'ericreeselanesr@gmail.com',
  bj: 'brianjpiercejr@gmail.com',
  cj: '',
  vante: '',
  dwayne: '',
};

// Action button definitions (source: CIB, richest set)
export const ACTION_BUTTONS = [
  { id: 'cover-letter', label: 'Cover Letter', color: 'emerald' },
  { id: 'resume', label: 'Resume', color: 'blue' },
  { id: 'writing-sample', label: 'Writing Sample', color: 'amber' },
  { id: 'interview-prep', label: 'Interview Prep', color: 'violet' },
  { id: 'apply-preview', label: 'Apply', color: 'green' },
  { id: 'view-posting', label: 'View Posting', color: 'slate' },
  { id: 'combined', label: 'Download PDF', color: 'purple' },
  { id: 'combined-docx', label: 'Download DOCX', color: 'indigo' },
  { id: 'mark-applied', label: 'Mark Applied', color: 'lime' },
  { id: 'dismiss', label: 'Dismiss', color: 'red' },
  { id: 'mock', label: 'Mock Interview', color: 'cyan' },
];

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

// Strip hash prefix from imported job titles (source: CIB — CIP didn't have this)
export function cleanTitle(raw) {
  if (!raw) return 'Untitled';
  const match = raw.match(/^[0-9a-fA-F]{32}\s+(.+)$/);
  return match ? match[1].replace(/\s+/g, ' ').trim() : raw;
}

// Detect which JOBA (Job Orchestration and Benefits Allocator) track a title belongs to
// Based on JOBA track rules verified March 25, 2026
export function detectTrackFromTitle(title) {
  if (!title) return null;
  const t = title.toLowerCase();
  if (/executive director|^ed\b/i.test(t)) return 'brandon'; // Brandon + Eric
  if (/chief development|^cdo\b|vp.*development|head.*fundrais/i.test(t)) return 'bj';
  if (/marketing|communications|marcom|public relations|media/i.test(t)) return 'bj';
  if (/development manager|fundrais.*manager|grants? manager|annual fund|donor relations|prospect research|corporate relations/i.test(t)) return 'cj';
  if (/program|development associate|development coordinator|fundrais.*associate|fundrais.*coordinator|community|youth|volunteer|regional manager|team leader/i.test(t)) return 'vante';
  if (/financ|account|operations|admin|budget|compliance|hr|human resource|office manager|facilities|contracts/i.test(t)) return 'dwayne';
  return null;
}

// Resolve display name from ham_id
export function getDisplayName(hamId) {
  const member = TEAM.find(t => t.id === (hamId || '').toLowerCase());
  return member ? member.name : (hamId || 'Unmatched');
}

// Get team color for a ham_id or display name
export function getTeamColor(identifier) {
  return TEAM_COLORS[identifier] || TEAM_COLORS[(identifier || '').toLowerCase()] || '#6B7280';
}

// ═══════════════════════════════════════════════════════════════════════════
// API FUNCTIONS (all take apiAdapter as first argument)
// apiAdapter signature: async (path, options?) => result
//   CIP adapter: (path, opts) => fetch(ABABASE + path, opts).then(r => r.json())
//   CIB adapter: ababaseAPI (already exists)
//   Portal adapter: same as CIP pattern
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchJobs(api, userId) {
  const result = await api('/api/awa/jobs?userId=' + encodeURIComponent(userId));
  return Array.isArray(result) ? result : result.jobs || [];
}

export async function fetchUnmatchedJobs(api) {
  const result = await api('/api/awa/unmatched');
  return Array.isArray(result) ? result : result.jobs || [];
}

export async function runAction(api, action, job, userId) {
  const assignee = (job.assignees || [])[0] || 'unmatched';
  const title = cleanTitle(job.job_title || job.title || '');
  const org = job.organization || job.company || '';

  switch (action) {
    case 'view-posting':
      if (job.url) { window.open(job.url, '_blank'); return { success: true, message: 'Opened posting' }; }
      return { success: false, error: 'No URL available' };

    case 'cover-letter':
      return await api('/api/awa/cover-letter', { method: 'POST', body: { job, userId: assignee } });

    case 'resume':
      return await api('/api/awa/resume', { method: 'POST', body: { job, userId: assignee } });

    case 'writing-sample':
      return await api('/api/awa/writing-sample', { method: 'POST', body: { job, userId: assignee } });

    case 'interview-prep':
      return await api(`/api/awa/jobs/${job.id}/interview-prep`, { method: 'POST', body: { userId: assignee } });

    case 'mark-applied':
      await updateStatus(api, job.id, 'APPLIED', userId, { notes: 'Manually marked as applied (applied outside ABA)' });
      return { success: true, message: 'Marked as applied' };

    case 'apply':
      return await api(`/api/awa/jobs/${job.id}/apply`, { method: 'POST', body: { userId: assignee } });

    case 'apply-preview':
      return await api(`/api/awa/jobs/${job.id}/apply-preview`, { method: 'POST', body: { userId: assignee } });

    case 'dismiss':
      return await api(`/api/awa/jobs/${job.id}/dismiss`, { method: 'PATCH', body: { userId, reason: 'Dismissed by HAM' } });

    case 'combined': {
      const result = await api('/api/awa/export/combined/preview', { method: 'POST', body: { jobId: job.id, format: 'pdf', userId: assignee, includeReferences: true } });
      if (result?.base64) {
        const blob = new Blob([Uint8Array.from(atob(result.base64), c => c.charCodeAt(0))], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = result.filename || 'application.pdf'; a.click();
        URL.revokeObjectURL(url);
        return { success: true, message: 'PDF downloaded: ' + (result.filename || 'application.pdf') };
      }
      return result;
    }

    case 'combined-docx': {
      const result = await api('/api/awa/export/combined/preview', { method: 'POST', body: { jobId: job.id, format: 'docx', userId: assignee, includeReferences: true } });
      if (result?.base64) {
        const blob = new Blob([Uint8Array.from(atob(result.base64), c => c.charCodeAt(0))], { type: result.contentType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = result.filename || 'application.docx'; a.click();
        URL.revokeObjectURL(url);
        return { success: true, message: 'DOCX downloaded: ' + (result.filename || 'application.docx') };
      }
      return result;
    }

    default:
      return { success: false, error: 'Unknown action: ' + action };
  }
}

export async function updateStatus(api, jobId, status, userId, meta = {}) {
  return await api(`/api/awa/jobs/${jobId}/status`, { method: 'POST', body: { status, userId, ...meta } });
}

export async function assignJob(api, jobId, toUser, userId) {
  return await api(`/api/awa/jobs/${jobId}/assign`, { method: 'POST', body: { assignTo: toUser, userId } });
}

export async function startMock(api, jobId, userId) {
  return await api(`/api/awa/jobs/${jobId}/mock-question`, { method: 'POST', body: { userId } });
}

export async function submitMock(api, jobId, question, answer, userId) {
  return await api(`/api/awa/jobs/${jobId}/mock-evaluate`, { method: 'POST', body: { question, answer, userId } });
}

export async function bulkGenerate(api, jobs, userId) {
  const results = [];
  for (const job of jobs) {
    const assignee = (job.assignees || [])[0] || 'unmatched';
    try {
      const [cl, res] = await Promise.all([
        api('/api/awa/cover-letter', { method: 'POST', body: { job, userId: assignee } }),
        api('/api/awa/resume', { method: 'POST', body: { job, userId: assignee } }),
      ]);
      results.push({ jobId: job.id, success: true, coverLetter: cl, resume: res });
    } catch (e) {
      results.push({ jobId: job.id, success: false, error: e.message });
    }
  }
  return results;
}

export async function loadReferences(api, userId) {
  return await api(`/api/awa/references?userId=${encodeURIComponent(userId)}`);
}

export async function exportCombined(api, jobId, format, userId) {
  return await api('/api/awa/export/combined/preview', {
    method: 'POST',
    body: { jobId, format, userId, includeReferences: true }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// FILTER AND SORT (pure functions — used by all skins)
// ═══════════════════════════════════════════════════════════════════════════

// Filter jobs by team member assignment
export function filterByTeam(jobs, teamFilter) {
  if (teamFilter === 'all') return jobs;
  if (teamFilter === 'UNMATCHED') {
    return jobs.filter(j => {
      const assignees = j.assignees || [];
      return assignees.length === 0 || assignees.includes('UNMATCHED') || assignees.includes('unmatched');
    });
  }
  return jobs.filter(j => {
    const assignees = (j.assignees || []).map(a => a.toLowerCase());
    return assignees.includes(teamFilter.toLowerCase());
  });
}

// Filter jobs by search term (title or organization)
export function filterBySearch(jobs, searchTerm) {
  if (!searchTerm) return jobs;
  const s = searchTerm.toLowerCase();
  return jobs.filter(j => {
    const title = cleanTitle(j.job_title || j.title || '');
    const org = j.organization || j.company || '';
    return title.toLowerCase().includes(s) || org.toLowerCase().includes(s);
  });
}

// Filter jobs by pipeline stage
export function filterByStage(jobs, stage) {
  if (!stage) return jobs;
  return jobs.filter(j => (j.status || 'NEW') === stage);
}

// Filter by status category — workflow-oriented grouping
// 'active' = pre-application (NEW, SAVED, MATERIALS_READY) — source: CIP, best UX
// 'applied' = in-progress applications (APPLIED through ACCEPTED, excluding dismissed/rejected/withdrawn)
// 'all' = everything including dismissed
export function filterByStatusCategory(jobs, category) {
  if (category === 'all') return jobs;
  if (category === 'active') {
    // Pre-application: only jobs that haven't been applied to yet
    const preApp = ['NEW', 'SAVED', 'MATERIALS_READY'];
    return jobs.filter(j => preApp.includes((j.status || 'NEW').toUpperCase()));
  }
  if (category === 'applied') {
    // In-progress: applied and beyond, but not dismissed/rejected/withdrawn
    const inProgress = ['APPLIED', 'WAITING', 'INTERVIEW', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'SECOND_INTERVIEW', 'OFFER', 'ACCEPTED'];
    return jobs.filter(j => inProgress.includes((j.status || 'NEW').toUpperCase()));
  }
  if (category === 'unmatched') {
    return jobs.filter(j => {
      const assignees = j.assignees || [];
      return assignees.length === 0 || assignees.includes('UNMATCHED') || assignees.includes('unmatched');
    });
  }
  return jobs;
}

// Sort jobs by different criteria (source: CIB — most complete sort options)
export function sortJobs(jobs, sortBy) {
  return [...jobs].sort((a, b) => {
    switch (sortBy) {
      case 'oldest':
        return new Date(a.imported_at || a.created_at || 0) - new Date(b.imported_at || b.created_at || 0);
      case 'salary':
        return (b.salary || '').localeCompare(a.salary || '');
      case 'org':
        return (a.organization || '').localeCompare(b.organization || '');
      case 'status':
        return PIPELINE_STAGES.indexOf(a.status || 'NEW') - PIPELINE_STAGES.indexOf(b.status || 'NEW');
      case 'newest':
      default:
        return new Date(b.imported_at || b.created_at || 0) - new Date(a.imported_at || a.created_at || 0);
    }
  });
}

// Calculate stage counts for pipeline display
export function getStageCounts(jobs) {
  return PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage] = jobs.filter(j => (j.status || 'NEW') === stage).length;
    return acc;
  }, {});
}

// ═══════════════════════════════════════════════════════════════════════════
// REACT HOOKS (platform-independent — each skin passes its own apiAdapter)
// ═══════════════════════════════════════════════════════════════════════════

// Main jobs hook — loads jobs, provides refresh, tracks loading/error
export function useJobs(api, userId) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await fetchJobs(api, userId);
      setJobs(result);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [api, userId]);

  useEffect(() => { load(); }, [load]);

  return { jobs, loading, error, fetchJobs: load, setJobs };
}

// Filtering and sorting hook — takes raw jobs, returns filtered/sorted with controls
export function useJobFilters(jobs, defaultHam) {
  const [teamFilter, setTeamFilter] = useState(defaultHam || 'all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeStage, setActiveStage] = useState(null);
  const [sortBy, setSortBy] = useState('newest');

  const teamFiltered = filterByTeam(jobs, teamFilter);
  const statusFiltered = filterByStatusCategory(teamFiltered, statusFilter);
  const searchFiltered = filterBySearch(statusFiltered, searchTerm);
  const stageFiltered = filterByStage(searchFiltered, activeStage);
  const sorted = sortJobs(stageFiltered, sortBy);

  const stageCounts = getStageCounts(teamFiltered);

  return {
    filtered: sorted,
    teamFilter, setTeamFilter,
    statusFilter, setStatusFilter,
    searchTerm, setSearchTerm,
    activeStage, setActiveStage,
    sortBy, setSortBy,
    stageCounts,
    totalActive: teamFiltered.filter(j => !['DISMISSED', 'REJECTED', 'WITHDRAWN'].includes(j.status)).length,
  };
}

// Mock interview hook
export function useMockInterview(api, userId) {
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const start = async (jobId) => {
    setLoading(true); setQuestion(null); setEvaluation(null); setAnswer('');
    try {
      const result = await startMock(api, jobId, userId);
      setQuestion(result.question || result.data?.question || result.response);
    } catch (e) { setQuestion('Could not generate question: ' + e.message); }
    setLoading(false);
  };

  const submit = async (jobId) => {
    if (!answer.trim()) return;
    setLoading(true);
    try {
      const result = await submitMock(api, jobId, question, answer, userId);
      setEvaluation(result.evaluation || result.data?.evaluation || result.response);
      setHistory(prev => [...prev, { question, answer, evaluation: result.evaluation || result.data?.evaluation }]);
    } catch (e) { setEvaluation('Could not evaluate: ' + e.message); }
    setLoading(false);
  };

  const next = async (jobId) => {
    setEvaluation(null); setAnswer('');
    await start(jobId);
  };

  return { question, answer, setAnswer, evaluation, history, loading, start, submit, next };
}

// Mini chat hook (Ask ABA about a job)
export function useMiniChat(api, userId) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const send = async (message) => {
    if (!message.trim()) return;
    setLoading(true); setResult(null);
    try {
      const r = await api('/api/air/process', {
        method: 'POST',
        body: { message, user_id: userId, userId, channel: 'myaba', appScope: 'awa' }
      });
      setResult(r.response || r.message || JSON.stringify(r));
    } catch (e) { setResult('Could not reach ABA: ' + e.message); }
    setLoading(false);
    setInput('');
  };

  return { input, setInput, result, loading, send };
}
