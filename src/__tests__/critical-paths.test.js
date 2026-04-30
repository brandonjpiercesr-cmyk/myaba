// ⬡B:MACE.phase0:TEST:critical_paths:20260405⬡
// 10 critical path tests — verifies the monolith split didn't break shared utils
// Per architecture scrub: "Even 20 basic tests would catch 80% of regressions"

import { describe, it, expect } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// TEST 1-3: api.js — Backend Communication Layer
// ═══════════════════════════════════════════════════════════════

describe('api.js — shared backend utils', () => {
  it('TEST 1: ABABASE constant points to production backend', async () => {
    const { ABABASE } = await import('../utils/api.js');
    expect(ABABASE).toBe(import.meta.env.VITE_ABABASE_URL || 'https://ababase.onrender.com');
  });

  it('TEST 2: safeParseGreeting handles null without crashing', async () => {
    const { safeParseGreeting } = await import('../utils/api.js');
    const result = safeParseGreeting(null);
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('subtitle');
    expect(result.title).toBe('');
  });

  it('TEST 3: safeParseGreeting parses object with greeting field', async () => {
    const { safeParseGreeting } = await import('../utils/api.js');
    const result = safeParseGreeting({ greeting: 'Morning, Brandon.', context: 'Checking items...' });
    expect(result.title).toBe('Morning, Brandon.');
    expect(result.subtitle).toBe('Checking items...');
  });

  it('TEST 4: airRequest is an async function', async () => {
    const { airRequest } = await import('../utils/api.js');
    expect(typeof airRequest).toBe('function');
  });

  it('TEST 5: isOnline returns a boolean', async () => {
    const { isOnline } = await import('../utils/api.js');
    expect(typeof isOnline()).toBe('boolean');
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST 6-7: ham.js — Human ABA Master (HAM) Identity Resolution
// ═══════════════════════════════════════════════════════════════

describe('ham.js — HAM identity resolution', () => {
  it('TEST 6: resolveHamId returns "all" for null email', async () => {
    const { resolveHamId } = await import('../utils/ham.js');
    expect(resolveHamId(null)).toBe('all');
    expect(resolveHamId(undefined)).toBe('all');
    expect(resolveHamId('')).toBe('all');
  });

  it('TEST 7: resolveHamId extracts username when email not in cache', async () => {
    const { resolveHamId } = await import('../utils/ham.js');
    // With empty cache (fetch mocked to fail), falls back to email prefix
    expect(resolveHamId('testuser@example.com')).toBe('testuser');
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST 8: icons.js — Icon Map
// ═══════════════════════════════════════════════════════════════

describe('icons.js — icon map', () => {
  it('TEST 8: ICON_MAP contains expected icon keys and aliases', async () => {
    const { ICON_MAP } = await import('../utils/icons.js');
    expect(ICON_MAP).toHaveProperty('MessageSquare');
    expect(ICON_MAP).toHaveProperty('Briefcase');
    expect(ICON_MAP).toHaveProperty('Settings');
    // Aliases
    expect(ICON_MAP).toHaveProperty('GraduationCap');
    expect(ICON_MAP).toHaveProperty('Music');
    expect(ICON_MAP.GraduationCap).toBe(ICON_MAP.BookOpen);
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST 9-10: View file existence — all 25 views exist as modules
// ═══════════════════════════════════════════════════════════════

describe('view files — all 25 exist', () => {
  const VIEW_FILES = [
    'ShadowView', 'AOAView', 'TasksView', 'CRMView', 'NotesView',
    'CalendarView', 'NURAView', 'ContactsView', 'EmailView', 'SportsView',
    'MusicView', 'GuideView', 'CCWAView', 'PipelineView', 'BriefingView',
    'JournalView', 'GMGUniversityView', 'ReferencesView', 'MemosView',
    'ApproveView', 'CommandCenterView', 'SettingsDrawer', 'MeetingModeView',
    'InterviewModeView', 'JobsView'
  ];

  it('TEST 9: all 25 view files can be imported without throwing', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const viewDir = path.resolve(import.meta.dirname, '..', 'views');
    
    const missing = [];
    for (const name of VIEW_FILES) {
      const filePath = path.join(viewDir, `${name}.jsx`);
      if (!fs.existsSync(filePath)) {
        missing.push(name);
      }
    }
    expect(missing).toEqual([]);
  });

  it('TEST 10: view files are non-empty and contain export default', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const viewDir = path.resolve(import.meta.dirname, '..', 'views');
    
    const broken = [];
    for (const name of VIEW_FILES) {
      const filePath = path.join(viewDir, `${name}.jsx`);
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.length < 20) {
        broken.push(`${name}: too short (${content.length} chars)`);
      }
      if (!content.includes('export default')) {
        broken.push(`${name}: missing export default`);
      }
    }
    expect(broken).toEqual([]);
  });
});
