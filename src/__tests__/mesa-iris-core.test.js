// ⬡B:MACE.phase2:TEST:mesa_iris_core_isolation:20260406⬡
// Implementation Rule 3: Core must be tested standalone before any skin imports it.

import { describe, it, expect, vi } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════════
// MESA CORE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('mesa-core.js — constants', () => {
  it('INTERROGATIVES has 15 question patterns', async () => {
    const { INTERROGATIVES } = await import('../utils/mesa-core.js');
    expect(INTERROGATIVES).toHaveLength(15);
    expect(INTERROGATIVES).toContain('how ');
    expect(INTERROGATIVES).toContain('walk me through');
    expect(INTERROGATIVES).toContain('your take');
  });

  it('cooldown values are correct', async () => {
    const { TIM_COOLDOWN, COOK_COOLDOWN, TIM_CUE_DURATION } = await import('../utils/mesa-core.js');
    expect(TIM_COOLDOWN).toBe(8000);
    expect(COOK_COOLDOWN).toBe(15000);
    expect(TIM_CUE_DURATION).toBe(8000);
  });

  it('PANEL_OPTIONS has 3 panels', async () => {
    const { PANEL_OPTIONS } = await import('../utils/mesa-core.js');
    expect(PANEL_OPTIONS).toHaveLength(3);
    expect(PANEL_OPTIONS).toContain('transcript');
    expect(PANEL_OPTIONS).toContain('coaching');
  });
});

describe('mesa-core.js — utility functions', () => {
  it('formatTime formats seconds as MM:SS', async () => {
    const { formatTime } = await import('../utils/mesa-core.js');
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(65)).toBe('01:05');
    expect(formatTime(3661)).toBe('61:01');
  });

  it('isQuestion detects question marks', async () => {
    const { isQuestion } = await import('../utils/mesa-core.js');
    expect(isQuestion('What is this?')).toBe(true);
    expect(isQuestion('This is a statement')).toBe(false);
    expect(isQuestion('')).toBe(false);
    expect(isQuestion(null)).toBe(false);
  });

  it('isQuestion detects interrogative patterns', async () => {
    const { isQuestion } = await import('../utils/mesa-core.js');
    expect(isQuestion('How does this work')).toBe(true);
    expect(isQuestion('Can you explain that')).toBe(true);
    expect(isQuestion('Walk me through the process')).toBe(true);
    expect(isQuestion('Your take on the budget')).toBe(true);
    expect(isQuestion('I agree completely')).toBe(false);
  });

  it('formatTranscriptLine formats segments', async () => {
    const { formatTranscriptLine } = await import('../utils/mesa-core.js');
    expect(formatTranscriptLine({ speaker: 0, text: 'Hello' })).toBe('Speaker 0: Hello');
    expect(formatTranscriptLine({ text: 'No speaker' })).toBe('No speaker');
    expect(formatTranscriptLine(null)).toBe('');
  });

  it('buildMeetingContext extracts recent data', async () => {
    const { buildMeetingContext } = await import('../utils/mesa-core.js');
    const transcript = [
      { text: 'First' }, { text: 'Second' }, { text: 'Third' }
    ];
    const cues = [{ text: 'Cue 1' }, { text: 'Cue 2' }];
    const result = buildMeetingContext(transcript, cues);
    expect(result.recentTranscript).toContain('First');
    expect(result.recentCues).toHaveLength(2);
  });
});

describe('mesa-core.js — API functions', () => {
  it('fetchTimCue calls /api/tim/cue with correct body', async () => {
    const { fetchTimCue } = await import('../utils/mesa-core.js');
    const mockApi = vi.fn().mockResolvedValue({ cue: 'Ask about timeline', type: 'QUESTION' });
    const result = await fetchTimCue(mockApi, { text: 'We need to discuss the budget', mode: 'meeting' }, 'brandon', 'quarterly review');
    expect(mockApi).toHaveBeenCalledWith('/api/tim/cue', expect.objectContaining({ method: 'POST' }));
    expect(result.cue).toBe('Ask about timeline');
  });

  it('fetchTimCue returns null when no cue', async () => {
    const { fetchTimCue } = await import('../utils/mesa-core.js');
    const mockApi = vi.fn().mockResolvedValue({ });
    const result = await fetchTimCue(mockApi, 'test', 'brandon', '');
    expect(result).toBeNull();
  });

  it('generateSummary calls /api/meeting/summary', async () => {
    const { generateSummary } = await import('../utils/mesa-core.js');
    const mockApi = vi.fn().mockResolvedValue({ summary: 'Meeting discussed Q3.' });
    const result = await generateSummary(mockApi, [{ text: 'Hi' }], 'brandon');
    expect(mockApi).toHaveBeenCalledWith('/api/meeting/summary', expect.objectContaining({ method: 'POST' }));
    expect(result.summary).toBe('Meeting discussed Q3.');
  });

  it('createSegmentProcessor respects TIM cooldown', async () => {
    const { createSegmentProcessor, TIM_COOLDOWN } = await import('../utils/mesa-core.js');
    const mockApi = vi.fn().mockResolvedValue({ cue: 'Test cue', type: 'INFO' });
    const processor = createSegmentProcessor(mockApi, 'brandon', {});
    const onTimCue = vi.fn();

    // First call should fire TIM
    await processor.process('Hello there', null, { onTimCue });
    expect(onTimCue).toHaveBeenCalledTimes(1);

    // Immediate second call should NOT fire TIM (cooldown)
    await processor.process('How are you', null, { onTimCue });
    expect(onTimCue).toHaveBeenCalledTimes(1); // still 1
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// IRIS CORE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('iris-core.js — constants', () => {
  it('INTERVIEW_MODES has 5 modes', async () => {
    const { INTERVIEW_MODES } = await import('../utils/iris-core.js');
    expect(INTERVIEW_MODES).toHaveLength(5);
    expect(INTERVIEW_MODES).toContain('prep');
    expect(INTERVIEW_MODES).toContain('research');
    expect(INTERVIEW_MODES).toContain('practice');
    expect(INTERVIEW_MODES).toContain('live');
    expect(INTERVIEW_MODES).toContain('mock');
  });

  it('STAR_COMPONENTS has 4 components with weights summing to 1', async () => {
    const { STAR_COMPONENTS } = await import('../utils/iris-core.js');
    expect(STAR_COMPONENTS).toHaveLength(4);
    const totalWeight = STAR_COMPONENTS.reduce((sum, c) => sum + c.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 5);
    expect(STAR_COMPONENTS.find(c => c.id === 'action').weight).toBe(0.35); // highest weight
  });
});

describe('iris-core.js — re-exports from mesa-core', () => {
  it('re-exports fetchTimCue from mesa-core', async () => {
    const { fetchTimCue } = await import('../utils/iris-core.js');
    expect(typeof fetchTimCue).toBe('function');
  });

  it('re-exports isQuestion from mesa-core', async () => {
    const { isQuestion } = await import('../utils/iris-core.js');
    expect(isQuestion('What time is it?')).toBe(true);
  });

  it('re-exports formatTime from mesa-core', async () => {
    const { formatTime } = await import('../utils/iris-core.js');
    expect(formatTime(90)).toBe('01:30');
  });
});

describe('iris-core.js — utility functions', () => {
  it('cleanInterviewTitle strips hash prefix', async () => {
    const { cleanInterviewTitle } = await import('../utils/iris-core.js');
    expect(cleanInterviewTitle('abc123def456abc123def456abc12345 Program Director')).toBe('Program Director');
    expect(cleanInterviewTitle('Normal Title')).toBe('Normal Title');
    expect(cleanInterviewTitle(null)).toBe('Untitled');
  });

  it('scoreSTAR scores a complete STAR response', async () => {
    const { scoreSTAR } = await import('../utils/iris-core.js');
    const complete = 'When I was at the company, I was responsible for leading a team. I implemented a new system that resulted in a 30% improvement.';
    const result = scoreSTAR(complete);
    expect(result.total).toBeGreaterThan(50);
    expect(result.components.situation).toBe(1);
    expect(result.components.action).toBe(1);
    expect(result.components.result).toBe(1);
  });

  it('scoreSTAR returns 0 for empty input', async () => {
    const { scoreSTAR } = await import('../utils/iris-core.js');
    expect(scoreSTAR(null).total).toBe(0);
    expect(scoreSTAR('').total).toBe(0);
  });
});

describe('iris-core.js — API functions', () => {
  it('loadJobs calls /api/awa/jobs', async () => {
    const { loadJobs } = await import('../utils/iris-core.js');
    const mockApi = vi.fn().mockResolvedValue({ jobs: [{ id: '1', title: 'Test' }] });
    const result = await loadJobs(mockApi, 'brandon');
    expect(mockApi).toHaveBeenCalledWith('/api/awa/jobs?userId=brandon');
    expect(result).toHaveLength(1);
  });

  it('generatePrep calls correct endpoint', async () => {
    const { generatePrep } = await import('../utils/iris-core.js');
    const mockApi = vi.fn().mockResolvedValue({ prep: { talkingPoints: [] } });
    const result = await generatePrep(mockApi, 'job123', 'brandon');
    expect(mockApi).toHaveBeenCalledWith('/api/awa/jobs/job123/interview-prep', expect.objectContaining({ method: 'POST' }));
  });

  it('generateMockQuestion calls correct endpoint', async () => {
    const { generateMockQuestion } = await import('../utils/iris-core.js');
    const mockApi = vi.fn().mockResolvedValue({ question: 'Tell me about yourself' });
    const result = await generateMockQuestion(mockApi, 'job123', 'brandon', []);
    expect(mockApi).toHaveBeenCalledWith('/api/awa/jobs/job123/mock-question', expect.objectContaining({ method: 'POST' }));
    expect(result.question).toBe('Tell me about yourself');
  });

  it('evaluateMockAnswer calls correct endpoint', async () => {
    const { evaluateMockAnswer } = await import('../utils/iris-core.js');
    const mockApi = vi.fn().mockResolvedValue({ evaluation: 'Good answer, 8/10' });
    await evaluateMockAnswer(mockApi, 'job123', 'Tell me about yourself', 'I am a developer...', 'brandon');
    expect(mockApi).toHaveBeenCalledWith('/api/awa/jobs/job123/mock-evaluate', expect.objectContaining({
      method: 'POST',
      body: expect.objectContaining({ question: 'Tell me about yourself', answer: 'I am a developer...' })
    }));
  });
});
