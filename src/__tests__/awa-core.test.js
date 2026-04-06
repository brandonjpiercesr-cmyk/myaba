// ⬡B:MACE.phase1:TEST:awa_core_isolation:20260406⬡
// Implementation Rule 3: Core must be tested standalone before any skin imports it.

import { describe, it, expect, vi } from 'vitest';

describe('awa-core.js — constants', () => {
  it('PIPELINE_STAGES has 14 stages matching backend', async () => {
    const { PIPELINE_STAGES } = await import('../utils/awa-core.js');
    expect(PIPELINE_STAGES).toHaveLength(14);
    expect(PIPELINE_STAGES[0]).toBe('NEW');
    expect(PIPELINE_STAGES[13]).toBe('DISMISSED');
    expect(PIPELINE_STAGES).toContain('MATERIALS_READY');
    expect(PIPELINE_STAGES).toContain('INTERVIEW_SCHEDULED');
    expect(PIPELINE_STAGES).toContain('SECOND_INTERVIEW');
  });

  it('TEAM has 9 entries including all, gmg, and unmatched', async () => {
    const { TEAM } = await import('../utils/awa-core.js');
    expect(TEAM).toHaveLength(9);
    expect(TEAM[0].id).toBe('all');
    expect(TEAM.find(t => t.id === 'brandon').color).toBe('#8B5CF6');
    expect(TEAM.find(t => t.id === 'UNMATCHED')).toBeTruthy();
  });

  it('STAGE_COLORS covers all 14 stages', async () => {
    const { PIPELINE_STAGES, STAGE_COLORS } = await import('../utils/awa-core.js');
    for (const stage of PIPELINE_STAGES) {
      expect(STAGE_COLORS[stage]).toBeDefined();
      expect(STAGE_COLORS[stage]).toHaveProperty('bg');
      expect(STAGE_COLORS[stage]).toHaveProperty('text');
    }
  });

  it('PERSONAL_EMAILS has correct entries', async () => {
    const { PERSONAL_EMAILS } = await import('../utils/awa-core.js');
    expect(PERSONAL_EMAILS.brandon).toBe('brandonjpiercesr@gmail.com');
    expect(PERSONAL_EMAILS.eric).toBe('ericreeselanesr@gmail.com');
    expect(PERSONAL_EMAILS.bj).toBe('brianjpiercejr@gmail.com');
  });

  it('ACTION_BUTTONS has 10 actions', async () => {
    const { ACTION_BUTTONS } = await import('../utils/awa-core.js');
    expect(ACTION_BUTTONS).toHaveLength(10);
    expect(ACTION_BUTTONS.find(a => a.id === 'cover-letter')).toBeTruthy();
    expect(ACTION_BUTTONS.find(a => a.id === 'dismiss')).toBeTruthy();
    expect(ACTION_BUTTONS.find(a => a.id === 'mock')).toBeTruthy();
  });
});

describe('awa-core.js — utility functions', () => {
  it('cleanTitle strips hash prefix', async () => {
    const { cleanTitle } = await import('../utils/awa-core.js');
    expect(cleanTitle('abc123def456abc123def456abc12345 Executive Director')).toBe('Executive Director');
    expect(cleanTitle('Regular Title')).toBe('Regular Title');
    expect(cleanTitle(null)).toBe('Untitled');
    expect(cleanTitle('')).toBe('Untitled');
  });

  it('detectTrackFromTitle returns correct HAM', async () => {
    const { detectTrackFromTitle } = await import('../utils/awa-core.js');
    expect(detectTrackFromTitle('Executive Director')).toBe('brandon');
    expect(detectTrackFromTitle('Chief Development Officer')).toBe('bj');
    expect(detectTrackFromTitle('Marketing Manager')).toBe('bj');
    expect(detectTrackFromTitle('Development Manager')).toBe('cj');
    expect(detectTrackFromTitle('Program Director')).toBe('vante');
    expect(detectTrackFromTitle('Finance Manager')).toBe('dwayne');
    expect(detectTrackFromTitle('Random Title')).toBeNull();
  });

  it('getDisplayName resolves ham_id to name', async () => {
    const { getDisplayName } = await import('../utils/awa-core.js');
    expect(getDisplayName('brandon')).toBe('Brandon');
    expect(getDisplayName('bj')).toBe('BJ');
    expect(getDisplayName('unknown_person')).toBe('unknown_person');
    expect(getDisplayName(null)).toBe('Unmatched');
  });

  it('getTeamColor returns correct color', async () => {
    const { getTeamColor } = await import('../utils/awa-core.js');
    expect(getTeamColor('Brandon')).toBe('#8B5CF6');
    expect(getTeamColor('brandon')).toBe('#8B5CF6');
    expect(getTeamColor('nobody')).toBe('#6B7280');
  });
});

describe('awa-core.js — filter and sort', () => {
  const mockJobs = [
    { id: '1', job_title: 'ED Role', status: 'NEW', assignees: ['brandon'], imported_at: '2026-04-01', organization: 'Alpha' },
    { id: '2', job_title: 'Dev Manager', status: 'APPLIED', assignees: ['cj'], imported_at: '2026-04-02', organization: 'Beta' },
    { id: '3', job_title: 'Programs Lead', status: 'DISMISSED', assignees: ['vante'], imported_at: '2026-04-03', organization: 'Gamma' },
    { id: '4', job_title: 'Unmatched Job', status: 'NEW', assignees: [], imported_at: '2026-04-04', organization: 'Delta' },
  ];

  it('filterByTeam filters correctly', async () => {
    const { filterByTeam } = await import('../utils/awa-core.js');
    expect(filterByTeam(mockJobs, 'all')).toHaveLength(4);
    expect(filterByTeam(mockJobs, 'brandon')).toHaveLength(1);
    expect(filterByTeam(mockJobs, 'UNMATCHED')).toHaveLength(1);
  });

  it('filterBySearch matches title and org', async () => {
    const { filterBySearch } = await import('../utils/awa-core.js');
    expect(filterBySearch(mockJobs, 'ED Role')).toHaveLength(1);
    expect(filterBySearch(mockJobs, 'Beta')).toHaveLength(1);
    expect(filterBySearch(mockJobs, '')).toHaveLength(4);
  });

  it('filterByStatusCategory filters active vs all', async () => {
    const { filterByStatusCategory } = await import('../utils/awa-core.js');
    expect(filterByStatusCategory(mockJobs, 'active')).toHaveLength(3); // excludes DISMISSED
    expect(filterByStatusCategory(mockJobs, 'all')).toHaveLength(4);
  });

  it('sortJobs sorts by newest and oldest', async () => {
    const { sortJobs } = await import('../utils/awa-core.js');
    const newest = sortJobs(mockJobs, 'newest');
    expect(newest[0].id).toBe('4'); // April 4 is newest
    const oldest = sortJobs(mockJobs, 'oldest');
    expect(oldest[0].id).toBe('1'); // April 1 is oldest
  });

  it('getStageCounts returns correct counts', async () => {
    const { getStageCounts } = await import('../utils/awa-core.js');
    const counts = getStageCounts(mockJobs);
    expect(counts.NEW).toBe(2);
    expect(counts.APPLIED).toBe(1);
    expect(counts.DISMISSED).toBe(1);
    expect(counts.OFFER).toBe(0);
  });
});

describe('awa-core.js — API functions', () => {
  it('fetchJobs calls api with correct path', async () => {
    const { fetchJobs } = await import('../utils/awa-core.js');
    const mockApi = vi.fn().mockResolvedValue({ jobs: [{ id: '1' }] });
    const result = await fetchJobs(mockApi, 'brandon');
    expect(mockApi).toHaveBeenCalledWith('/api/awa/jobs?userId=brandon');
    expect(result).toHaveLength(1);
  });

  it('runAction cover-letter calls correct endpoint', async () => {
    const { runAction } = await import('../utils/awa-core.js');
    const mockApi = vi.fn().mockResolvedValue({ coverLetter: 'test' });
    const job = { id: '1', job_title: 'Test', assignees: ['brandon'] };
    await runAction(mockApi, 'cover-letter', job, 'brandon');
    expect(mockApi).toHaveBeenCalledWith('/api/awa/cover-letter', expect.objectContaining({ method: 'POST' }));
  });

  it('runAction dismiss calls correct endpoint with PATCH', async () => {
    const { runAction } = await import('../utils/awa-core.js');
    // Mock window.open for view-posting test
    const mockApi = vi.fn().mockResolvedValue({ success: true });
    const job = { id: '99', assignees: ['brandon'] };
    await runAction(mockApi, 'dismiss', job, 'brandon');
    expect(mockApi).toHaveBeenCalledWith('/api/awa/jobs/99/dismiss', expect.objectContaining({ method: 'PATCH' }));
  });
});
