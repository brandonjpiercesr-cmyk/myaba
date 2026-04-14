// ⬡B:MACE.core:CORE:soul_core:20260413⬡
// SOUL Shared Core Library — Spiritual Oversight and Understanding Liaison
// Source of truth for all SOUL surfaces: CIP SoulView, CIB SoulApp, SOUL standalone
// One source of truth per architecture scrub mandate.

import { useState, useCallback, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export const SECTION_NAMES = [
  'morningGreetings', 'betterManChallenge', 'namesOfGod', 'breathChallenge',
  'scriptureMemory', 'exerciseTime', 'foundationDeclarations', 'dailyProphecy',
  'bookTime', 'answerKey'
];

export const SECTION_TITLES = {
  morningGreetings: 'Morning Greetings',
  betterManChallenge: 'Brian Dawkins Better Man Challenge',
  namesOfGod: 'Names of God Study',
  breathChallenge: 'Breath Challenge',
  scriptureMemory: 'Scripture Memory (NKJV)',
  exerciseTime: 'Exercise Time',
  foundationDeclarations: 'Foundation & Declarations',
  dailyProphecy: 'Daily Prophecy Summary',
  bookTime: 'Book Time',
  answerKey: 'Answer Key'
};

export const SECTION_EMOJIS = {
  morningGreetings: '🌅', betterManChallenge: '💪', namesOfGod: '📖',
  breathChallenge: '🫁', scriptureMemory: '📝', exerciseTime: '🏃‍♂️',
  foundationDeclarations: '🛡️', dailyProphecy: '🔥', bookTime: '📚',
  answerKey: '🔑'
};

// ═══════════════════════════════════════════════════════════════════════════
// API FUNCTIONS (all take apiAdapter as first argument for platform agnostic calls)
// ═══════════════════════════════════════════════════════════════════════════

export async function generateRoutine(api, userId, date) {
  const result = await api('/api/soul/routine', {
    method: 'POST',
    body: { user_id: userId, date }
  });
  return result?.routine || null;
}

export async function fetchVerse(api, book, chapter, verse) {
  const url = `/api/soul/verse/${encodeURIComponent(book)}/${chapter}${verse ? '/' + verse : ''}`;
  return await api(url);
}

export async function getAllNames(api) {
  return await api('/api/soul/names');
}

export async function generateQuiz(api, count = 20, type = 'all') {
  return await api('/api/soul/quiz', { method: 'POST', body: { count, type } });
}

export async function gradeQuiz(api, questions, answers) {
  return await api('/api/soul/quiz/grade', { method: 'POST', body: { questions, answers } });
}

export async function saveSermonNotes(api, userId, sermonData) {
  return await api('/api/soul/sermon', {
    method: 'POST',
    body: { user_id: userId, ...sermonData }
  });
}

export async function getHistory(api, hamId) {
  return await api(`/api/soul/history/${hamId}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════

// Main routine hook — loads today's routine
export function useRoutine(api, userId) {
  const [routine, setRoutine] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentSection, setCurrentSection] = useState(0);
  const [completedSections, setCompletedSections] = useState(new Set());

  const loadRoutine = useCallback(async (date) => {
    setLoading(true);
    setError(null);
    try {
      const today = date || new Date().toISOString().split('T')[0];
      const result = await generateRoutine(api, userId, today);
      setRoutine(result);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [api, userId]);

  const completeSection = useCallback((sectionName) => {
    setCompletedSections(prev => new Set([...prev, sectionName]));
  }, []);

  const nextSection = useCallback(() => {
    setCurrentSection(prev => Math.min(prev + 1, SECTION_NAMES.length - 1));
  }, []);

  const prevSection = useCallback(() => {
    setCurrentSection(prev => Math.max(prev - 1, 0));
  }, []);

  const progress = routine ? Math.round((completedSections.size / SECTION_NAMES.length) * 100) : 0;

  return {
    routine, loading, error, currentSection, completedSections,
    loadRoutine, completeSection, nextSection, prevSection, setCurrentSection,
    progress
  };
}

// Quiz hook — manages quiz flow
export function useQuiz(api) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);

  const startQuiz = useCallback(async (count = 20, type = 'all') => {
    setQuizLoading(true);
    setResults(null);
    setAnswers({});
    try {
      const data = await generateQuiz(api, count, type);
      setQuestions(data.questions || []);
    } catch (e) {
      console.error('[SOUL] Quiz error:', e);
    }
    setQuizLoading(false);
  }, [api]);

  const setAnswer = useCallback((questionNumber, answer) => {
    setAnswers(prev => ({ ...prev, [questionNumber]: answer }));
  }, []);

  const submitQuiz = useCallback(async () => {
    setQuizLoading(true);
    try {
      const answerArray = questions.map(q => answers[q.number] || '');
      const graded = await gradeQuiz(api, questions, answerArray);
      setResults(graded);
    } catch (e) {
      console.error('[SOUL] Grade error:', e);
    }
    setQuizLoading(false);
  }, [api, questions, answers]);

  return { questions, answers, results, quizLoading, startQuiz, setAnswer, submitQuiz };
}

// Sermon notes hook
export function useSermonNotes(api, userId) {
  const [sermonData, setSermonData] = useState({ title: '', speaker: '', date: '', scripture: '', notes: '', keyPhrases: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const updateField = useCallback((field, value) => {
    setSermonData(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }, []);

  const saveNotes = useCallback(async () => {
    setSaving(true);
    try {
      await saveSermonNotes(api, userId, sermonData);
      setSaved(true);
    } catch (e) {
      console.error('[SOUL] Save sermon error:', e);
    }
    setSaving(false);
  }, [api, userId, sermonData]);

  const reset = useCallback(() => {
    setSermonData({ title: '', speaker: '', date: '', scripture: '', notes: '', keyPhrases: '' });
    setSaved(false);
  }, []);

  return { sermonData, saving, saved, updateField, saveNotes, reset };
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

// Generate changelog for a routine (displayed in chat, NOT in the file)
export function generateChangelog(routine) {
  if (!routine?.sections?.namesOfGod?.names) return '';
  const names = routine.sections.namesOfGod.names;
  const verse = routine.sections.scriptureMemory;
  const prophecy = routine.sections.dailyProphecy?.prophecy;

  let log = `CHANGELOG — ${formatDate(routine.date)}\n\nNames of God Used:\n`;
  names.forEach((n, i) => {
    log += `${i + 1}. ${n.name} (${n.type === 'lesser-known' ? 'Lesser-Known' : 'Standard'})\n`;
  });
  log += `\nMemory Verse: ${verse?.reference || 'N/A'}`;
  log += `\nProphecy Selection: ${prophecy ? `${prophecy.speaker}, ${prophecy.date}, to ${prophecy.recipient}` : 'N/A'}`;
  return log;
}
