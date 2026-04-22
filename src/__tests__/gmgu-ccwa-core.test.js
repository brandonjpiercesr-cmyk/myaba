// ⬡B:MACE.phase3:TEST:gmgu_ccwa_core_isolation:20260406⬡
// Implementation Rule 3: Core must be tested standalone before any skin imports it.

import { describe, it, expect, vi } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// GMG-U CORE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('gmgu-core.js — constants', () => {
  it('VOL_META has 3 volumes', async () => {
    const { VOL_META } = await import('../utils/gmgu-core.js');
    expect(Object.keys(VOL_META)).toHaveLength(3);
    expect(VOL_META.v1.days).toBe(30);
    expect(VOL_META.v2.days).toBe(30);
    expect(VOL_META.v3.days).toBe(15);
  });

  it('TITLES has 75 total lessons', async () => {
    const { TITLES } = await import('../utils/gmgu-core.js');
    const total = Object.values(TITLES).reduce((s, arr) => s + arr.length, 0);
    expect(total).toBe(75);
    expect(TITLES.v1).toHaveLength(30);
    expect(TITLES.v2).toHaveLength(30);
    expect(TITLES.v3).toHaveLength(15);
  });

  it('TOTAL_LESSONS equals 75', async () => {
    const { TOTAL_LESSONS } = await import('../utils/gmgu-core.js');
    expect(TOTAL_LESSONS).toBe(75);
  });
});

describe('gmgu-core.js — utility functions', () => {
  it('getNextLesson returns first uncompleted', async () => {
    const { getNextLesson } = await import('../utils/gmgu-core.js');
    // No completions — returns v1 day 1
    const first = getNextLesson([]);
    expect(first.vol).toBe('v1');
    expect(first.day).toBe(1);
    expect(first.title).toBe('The Four Sources of Money');
  });

  it('getNextLesson skips completed days', async () => {
    const { getNextLesson } = await import('../utils/gmgu-core.js');
    const next = getNextLesson(['v1-d1', 'v1-d2']);
    expect(next.vol).toBe('v1');
    expect(next.day).toBe(3);
    expect(next.title).toBe('The Donor Lifecycle');
  });

  it('getNextLesson returns null when all complete', async () => {
    const { getNextLesson, TOTAL_LESSONS } = await import('../utils/gmgu-core.js');
    const allDone = [];
    for (let d = 1; d <= 30; d++) allDone.push('v1-d' + d);
    for (let d = 1; d <= 30; d++) allDone.push('v2-d' + d);
    for (let d = 1; d <= 15; d++) allDone.push('v3-d' + d);
    expect(allDone).toHaveLength(TOTAL_LESSONS);
    expect(getNextLesson(allDone)).toBeNull();
  });

  it('lessonKey formats correctly', async () => {
    const { lessonKey } = await import('../utils/gmgu-core.js');
    expect(lessonKey('v1', 5)).toBe('v1-d5');
    expect(lessonKey('v3', 15)).toBe('v3-d15');
  });

  it('lessonTitle returns correct title', async () => {
    const { lessonTitle } = await import('../utils/gmgu-core.js');
    expect(lessonTitle('v1', 1)).toBe('The Four Sources of Money');
    expect(lessonTitle('v3', 15)).toBe('CPP Final Assessment');
    expect(lessonTitle('v1', 99)).toBe('Day 99'); // out of range fallback
  });
});

describe('gmgu-core.js — SSE parsing', () => {
  it('parseSSELine parses valid data line', async () => {
    const { parseSSELine } = await import('../utils/gmgu-core.js');
    const result = parseSSELine('data: {"type":"chunk","text":"Hello"}');
    expect(result.type).toBe('chunk');
    expect(result.text).toBe('Hello');
  });

  it('parseSSELine returns null for invalid input', async () => {
    const { parseSSELine } = await import('../utils/gmgu-core.js');
    expect(parseSSELine('not a data line')).toBeNull();
    expect(parseSSELine(null)).toBeNull();
  });

  it('extractDeck extracts deck JSON', async () => {
    const { extractDeck } = await import('../utils/gmgu-core.js');
    const text = 'Lesson content [DECK]{"question":"What?","options":["A","B"],"correct":"A"}[/DECK] more text';
    const result = extractDeck(text);
    expect(result.deck.question).toBe('What?');
    expect(result.text).not.toContain('[DECK]');
  });

  it('extractDeck returns null deck when none present', async () => {
    const { extractDeck } = await import('../utils/gmgu-core.js');
    const result = extractDeck('Just normal text');
    expect(result.deck).toBeNull();
    expect(result.text).toBe('Just normal text');
  });

  it('checkLessonComplete detects completion marker', async () => {
    const { checkLessonComplete } = await import('../utils/gmgu-core.js');
    const result = checkLessonComplete('Great job! [LESSON_COMPLETE]');
    expect(result.complete).toBe(true);
    expect(result.text).toBe('Great job!');
  });

  it('checkLessonComplete returns false when no marker', async () => {
    const { checkLessonComplete } = await import('../utils/gmgu-core.js');
    const result = checkLessonComplete('Still going');
    expect(result.complete).toBe(false);
    expect(result.text).toBe('Still going');
  });
});

describe('gmgu-core.js — API functions', () => {
  it('fetchProgress calls correct endpoint', async () => {
    const { fetchProgress } = await import('../utils/gmgu-core.js');
    const mockApi = vi.fn().mockResolvedValue({ completedDays: ['v1-d1'], xp: 100 });
    const result = await fetchProgress(mockApi, 'test@test.com');
    expect(mockApi).toHaveBeenCalledWith('/api/gmg-university/progress?email=test%40test.com');
    expect(result.xp).toBe(100);
  });

  it('markLessonComplete calls correct endpoint', async () => {
    const { markLessonComplete } = await import('../utils/gmgu-core.js');
    const mockApi = vi.fn().mockResolvedValue({ completedDays: ['v1-d1'] });
    await markLessonComplete(mockApi, 'test@test.com', 'v1', 1);
    expect(mockApi).toHaveBeenCalledWith('/api/gmg-university/progress', expect.objectContaining({
      method: 'POST',
      body: expect.objectContaining({ completedKey: 'v1-d1' })
    }));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CCWA CORE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('ccwa-engine.js — constants', () => {
  it('ENGINE_MODES has 3 modes', async () => {
    const { ENGINE_MODES } = await import('../utils/ccwa-engine.js');
    expect(ENGINE_MODES).toHaveLength(3);
    expect(ENGINE_MODES.find(m => m.id === 'prod').channel).toBe('ccwa');
    expect(ENGINE_MODES.find(m => m.id === 'dev').channel).toBe('incuaba');
    expect(ENGINE_MODES.find(m => m.id === 'compare').channel).toBeNull();
  });

  it('PANEL_IDS has expected panels', async () => {
    const { PANEL_IDS } = await import('../utils/ccwa-engine.js');
    expect(PANEL_IDS.length).toBeGreaterThanOrEqual(10);
    expect(PANEL_IDS).toContain('enforcement');
    expect(PANEL_IDS).toContain('gitPanel');
  });
});

describe('ccwa-engine.js — engine routing', () => {
  it('getChannel returns correct channel for each mode', async () => {
    const { getChannel } = await import('../utils/ccwa-engine.js');
    expect(getChannel('prod')).toBe('ccwa');
    expect(getChannel('dev')).toBe('incuaba');
    expect(getChannel('compare')).toBe('ccwa'); // defaults to ccwa
  });

  it('sendToEngine calls /api/air/process with correct channel', async () => {
    const { sendToEngine } = await import('../utils/ccwa-engine.js');
    const mockApi = vi.fn().mockResolvedValue({ response: 'test', toolsExecuted: [] });
    const result = await sendToEngine(mockApi, 'hello', 'brandon', 'prod');
    expect(mockApi).toHaveBeenCalledWith('/api/air/process', expect.objectContaining({
      method: 'POST',
      body: expect.objectContaining({ channel: 'ccwa', appScope: 'ccwa' })
    }));
    expect(result.response).toBe('test');
    expect(result.channel).toBe('ccwa');
  });

  it('sendToEngine uses incuaba channel for dev mode', async () => {
    const { sendToEngine } = await import('../utils/ccwa-engine.js');
    const mockApi = vi.fn().mockResolvedValue({ response: 'dev test' });
    await sendToEngine(mockApi, 'hello', 'brandon', 'dev');
    expect(mockApi).toHaveBeenCalledWith('/api/air/process', expect.objectContaining({
      body: expect.objectContaining({ channel: 'incuaba' })
    }));
  });

  it('compareEngines calls both prod and dev', async () => {
    const { compareEngines } = await import('../utils/ccwa-engine.js');
    let callCount = 0;
    const mockApi = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({ response: `response ${callCount}`, toolsExecuted: [] });
    });
    const result = await compareEngines(mockApi, 'test', 'brandon');
    expect(mockApi).toHaveBeenCalledTimes(2);
    expect(result.prod.response).toBeTruthy();
    expect(result.dev.response).toBeTruthy();
  });
});
