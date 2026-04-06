// ⬡B:MACE.phase3:CORE:gmgu_core:20260406⬡
// Global Majority Group University (GMG-U) Shared Core Library
// Source of truth for all GMG-U surfaces: CIP GMGUniversityView, CIB GMGUniversityApp, standalone App.jsx
// Curriculum data, progress tracking, TTS, SSE lesson streaming

import { useState, useRef, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS — CURRICULUM STRUCTURE
// ═══════════════════════════════════════════════════════════════════════════

// Volume metadata (source: CIB, cleanest naming — extended with short titles from CIP)
export const VOL_META = {
  v1: { name: 'Fundraising Foundations', short: 'Foundations', days: 30 },
  v2: { name: 'The GMG Way', short: 'GMG Way', days: 30 },
  v3: { name: 'CPP Model', short: 'CPP', days: 15 },
};

// Lesson titles per volume (identical across all 3 surfaces — 75 total)
export const TITLES = {
  v1: ["The Four Sources of Money","Why People Actually Give","The Donor Lifecycle","The Donor Pyramid","Quiz 1-4","Annual Giving Programs","Foundation Grants Reality","Corporate Partnerships","Earned Revenue Strategies","Quiz 6-9","Board Fundraising Responsibility","Grant Research Methods","Donor Retention Fundamentals","Fundraising Systems and Tools","Quiz 11-14","Grant Writing Basics","Major Donor Identification","Planned Giving Basics","Corporate Sponsorship Strategy","Quiz 16-19","Digital Fundraising","Storytelling for Fundraising","Capital Campaigns","Monthly Giving Programs","Quiz 21-24","Board Development","Prospect Research Deep Dive","Fundraising Metrics","Strategic Fundraising Planning","Volume 1 Capstone"],
  v2: ["What Makes GMG Different","Both Sides of the Table","Brandon's Writing Standards","The 360 Assessment","Quiz 1-4","Data Science Development Planning","Prospect Precision System","Grant Catalyst Method","Implementation Engine","Quiz 6-9","Tic-Tac-Toe Framework Intro","Tic-Tac-Toe Implementation","Recipe Pitch Framework","Board Training GMG Style","Quiz 11-14","Foundation Pipeline Management","Major Donor Strategy","Corporate Small-Dollar Approach","Merchandise Programs","Quiz 16-19","Monthly Giving as Default","Membership Programs","Tax-Advantaged Giving","Event Strategy GMG Way","Quiz 21-24","CRM Optimization","AI in Fundraising","Building Your Tech Stack","Final Assessment Prep","Volume 2 Certification"],
  v3: ["What Is CPP","Legal Structure","Money Flow","Capacity Planning","Quiz 1-4","Building Your Resume","Certifications","Online Presence","Crafting Your Pitch","Quiz 6-9","Client Interviews","Documentation Mastery","Folder Structure","Client Communication","CPP Final Assessment"],
};

// Total lesson count
export const TOTAL_LESSONS = Object.values(VOL_META).reduce((s, v) => s + v.days, 0);

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

// Get the next uncompleted lesson
export function getNextLesson(completedDays) {
  const done = completedDays || [];
  for (const [vol, meta] of Object.entries(VOL_META)) {
    for (let d = 1; d <= meta.days; d++) {
      if (!done.includes(vol + '-d' + d)) {
        return { vol, day: d, title: (TITLES[vol] || [])[d - 1] || 'Day ' + d };
      }
    }
  }
  return null; // all complete
}

// Build lesson key from vol + day
export function lessonKey(vol, day) {
  return vol + '-d' + day;
}

// Get lesson title
export function lessonTitle(vol, day) {
  return (TITLES[vol] || [])[day - 1] || 'Day ' + day;
}

// ═══════════════════════════════════════════════════════════════════════════
// API FUNCTIONS (all take apiAdapter as first argument)
// ═══════════════════════════════════════════════════════════════════════════

// Fetch student progress
export async function fetchProgress(api, email) {
  try {
    const result = await api('/api/gmg-university/progress?email=' + encodeURIComponent(email));
    return result;
  } catch (err) {
    console.error('[GMG-U] Progress fetch error:', err);
    return null;
  }
}

// Mark a lesson complete
export async function markLessonComplete(api, email, vol, day) {
  try {
    const k = lessonKey(vol, day);
    const result = await api('/api/gmg-university/progress', {
      method: 'POST',
      body: { email, completedKey: k }
    });
    return result;
  } catch (err) {
    console.error('[GMG-U] Complete error:', err);
    return null;
  }
}

// Reset all progress
export async function resetProgress(api, email) {
  try {
    return await api('/api/gmg-university/progress', {
      method: 'POST',
      body: { email, completedDays: [], xp: 0 }
    });
  } catch (err) {
    console.error('[GMG-U] Reset error:', err);
    return null;
  }
}

// TTS speak — returns blob URL for audio playback
export async function speak(api, text) {
  if (!text || !text.trim()) return null;
  try {
    // TTS needs raw fetch for blob response — api adapter provides base URL
    const baseUrl = typeof api._baseUrl === 'string' ? api._baseUrl : 'https://abacia-services.onrender.com';
    const r = await fetch(baseUrl + '/api/tts/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.substring(0, 500) })
    });
    if (r.ok) {
      return URL.createObjectURL(await r.blob());
    }
  } catch (err) {
    console.error('[GMG-U] TTS error:', err);
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// SSE LESSON STREAMING — Parses AIR stream responses for lessons
// Handles chunk/done events, deck extraction, lesson completion markers
// ═══════════════════════════════════════════════════════════════════════════

// Parse a single SSE data line, returns { type, text, fullResponse } or null
export function parseSSELine(line) {
  if (!line || !line.startsWith('data: ')) return null;
  try {
    return JSON.parse(line.slice(6));
  } catch {
    return null;
  }
}

// Extract [DECK]...[/DECK] content from lesson response
export function extractDeck(text) {
  const match = text.match(/\[DECK\](.*?)\[\/DECK\]/s);
  if (!match) return { text, deck: null };
  try {
    const deck = JSON.parse(match[1].trim());
    return { text: text.replace(/\[DECK\].*?\[\/DECK\]/s, ''), deck };
  } catch {
    return { text, deck: null };
  }
}

// Check for lesson completion marker
export function checkLessonComplete(text) {
  const complete = text.includes('[LESSON_COMPLETE]');
  const cleaned = text
    .replace(/\[LESSON_STARTED\]/g, '')
    .replace(/\[LESSON_COMPLETE\]/g, '')
    .trim();
  return { complete, text: cleaned };
}

// ═══════════════════════════════════════════════════════════════════════════
// REACT HOOKS
// ═══════════════════════════════════════════════════════════════════════════

// Progress management hook
export function useProgress(api, email) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    const result = await fetchProgress(api, email);
    if (result) setProfile(result);
    setLoading(false);
  }, [api, email]);

  useEffect(() => { load(); }, [load]);

  const markComplete = useCallback(async (vol, day) => {
    const result = await markLessonComplete(api, email, vol, day);
    if (result) setProfile(p => ({ ...p, ...result }));
    return result;
  }, [api, email]);

  const reset = useCallback(async () => {
    await resetProgress(api, email);
    setProfile(p => ({ ...p, completedDays: [], xp: 0 }));
  }, [api, email]);

  const nextLesson = profile ? getNextLesson(profile.completedDays) : null;
  const completedCount = (profile?.completedDays || []).length;

  return { profile, loading, markComplete, reset, nextLesson, completedCount, setProfile, reload: load };
}

// Audio queue hook for TTS playback
export function useAudioQueue() {
  const audioRef = useRef(null);
  const queue = useRef([]);
  const isPlaying = useRef(false);

  const playNext = useCallback(() => {
    if (isPlaying.current || queue.current.length === 0) return;
    isPlaying.current = true;
    const url = queue.current.shift();
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.onended = () => { isPlaying.current = false; URL.revokeObjectURL(url); playNext(); };
      audioRef.current.onerror = () => { isPlaying.current = false; URL.revokeObjectURL(url); playNext(); };
      audioRef.current.play().catch(() => { isPlaying.current = false; playNext(); });
    }
  }, []);

  const enqueue = useCallback((url) => {
    if (!url) return;
    queue.current.push(url);
    playNext();
  }, [playNext]);

  return { audioRef, enqueue, playNext };
}
