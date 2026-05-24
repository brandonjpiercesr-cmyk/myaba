// ⬡B:logful.phase8.frontend:VIEW:LogfulView_clean_under_100_lines:20260524⬡
// LogfulView — imports @aba/logful-core components, calls API once per screen.
// Zero intelligence. Zero hardcoded UIDs. Zero string assembly.
// hamUid comes from the app context or prop — never hardcoded.

import { useState } from 'react';
import {
  LogfulDashboard,
  LogfulBrowse,
  LogfulActions,
  LogfulAddEntry,
  LogfulHunchFlags
} from '@aba/logful-core';

export default function LogfulView({ hamUid }) {
  const [screen, setScreen] = useState('dashboard');

  if (!hamUid) {
    return <div className="logful-no-ham">Loading your LOGFUL...</div>;
  }

  const navigate = (s) => setScreen(s);

  return (
    <div className="logful-root">
      {screen === 'dashboard' && (
        <LogfulDashboard hamUid={hamUid} onNavigate={navigate} />
      )}
      {screen === 'browse' && (
        <LogfulBrowse hamUid={hamUid} onNavigate={navigate} />
      )}
      {screen === 'actions' && (
        <LogfulActions hamUid={hamUid} onNavigate={navigate} />
      )}
      {screen === 'add' && (
        <LogfulAddEntry hamUid={hamUid} onNavigate={navigate} />
      )}
      {screen === 'hunch' && (
        <LogfulHunchFlags hamUid={hamUid} onNavigate={navigate} />
      )}
    </div>
  );
}
