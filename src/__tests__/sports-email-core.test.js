// ⬡B:MACE.phase4:TEST:sports_email_core_isolation:20260406⬡

import { describe, it, expect, vi } from 'vitest';

describe('sports-core.js', () => {
  it('fetchScores calls /api/nash/briefing', async () => {
    const { fetchScores } = await import('../utils/sports-core.js');
    const mockApi = vi.fn().mockResolvedValue({ scores: [{ team: 'Lakers', spoken: 'Lakers won 112-104' }] });
    const result = await fetchScores(mockApi, 'brandon');
    expect(mockApi).toHaveBeenCalledWith('/api/nash/briefing?userId=brandon');
    expect(result).toHaveLength(1);
    expect(result[0].team).toBe('Lakers');
  });

  it('fetchScores returns empty array on error', async () => {
    const { fetchScores } = await import('../utils/sports-core.js');
    const mockApi = vi.fn().mockRejectedValue(new Error('fail'));
    const result = await fetchScores(mockApi, 'brandon');
    expect(result).toEqual([]);
  });

  it('searchTeam calls /api/nash/scores with team', async () => {
    const { searchTeam } = await import('../utils/sports-core.js');
    const mockApi = vi.fn().mockResolvedValue({ type: 'result', winScore: 112, loseScore: 104 });
    const result = await searchTeam(mockApi, 'Lakers', 'brandon');
    expect(mockApi).toHaveBeenCalledWith('/api/nash/scores?team=Lakers&userId=brandon');
    expect(result.winScore).toBe(112);
  });
});

describe('email-core.js', () => {
  it('MARK_READ_DELAY is 3 seconds', async () => {
    const { MARK_READ_DELAY } = await import('../utils/email-core.js');
    expect(MARK_READ_DELAY).toBe(3000);
  });

  it('EMAIL_FOLDERS has inbox and sent', async () => {
    const { EMAIL_FOLDERS } = await import('../utils/email-core.js');
    expect(EMAIL_FOLDERS).toContain('inbox');
    expect(EMAIL_FOLDERS).toContain('sent');
  });

  it('loadAccounts calls /api/team and filters has_nylas', async () => {
    const { loadAccounts } = await import('../utils/email-core.js');
    const mockApi = vi.fn().mockResolvedValue({
      success: true,
      members: [
        { id: 'brandon', name: 'Brandon', email: 'b@test.com', has_nylas: true, color: '#8B5CF6' },
        { id: 'cj', name: 'CJ', email: 'cj@test.com', has_nylas: false },
      ]
    });
    const result = await loadAccounts(mockApi);
    expect(mockApi).toHaveBeenCalledWith('/api/team');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('brandon');
  });

  it('fetchEmails calls correct endpoint', async () => {
    const { fetchEmails } = await import('../utils/email-core.js');
    const mockApi = vi.fn().mockResolvedValue({ emails: [{ id: '1', subject: 'Test' }] });
    const result = await fetchEmails(mockApi, 'inbox', 'brandon');
    expect(mockApi).toHaveBeenCalledWith('/api/email/inbox?userId=brandon&limit=20');
    expect(result).toHaveLength(1);
  });

  it('markEmailRead calls PATCH endpoint', async () => {
    const { markEmailRead } = await import('../utils/email-core.js');
    const mockApi = vi.fn().mockResolvedValue({});
    await markEmailRead(mockApi, 'email123', 'brandon');
    expect(mockApi).toHaveBeenCalledWith('/api/email/email123/read?userId=brandon', { method: 'PATCH' });
  });

  it('askAboutEmail calls AIR with email context', async () => {
    const { askAboutEmail } = await import('../utils/email-core.js');
    const mockApi = vi.fn().mockResolvedValue({ response: 'The email is about...' });
    const email = { from: [{ name: 'Eric' }], subject: 'Q3 Report', snippet: 'Here are the numbers...' };
    const result = await askAboutEmail(mockApi, email, 'Summarize this', 'brandon');
    expect(mockApi).toHaveBeenCalledWith('/api/air/process', expect.objectContaining({ method: 'POST' }));
    expect(result).toBe('The email is about...');
  });
});
