// ⬡B:MACE.phase0:VIEW:commandcenter_extract:20260405⬡
// CommandCenterView — extracted from MyABA.jsx lines 3215-3424.

import { useState, useEffect } from "react";
import { Activity, AlertTriangle, CheckCircle, Clock, Zap, RefreshCw, ChevronRight, X } from "lucide-react";
import { ABABASE, airRequest } from "../utils/api.js";

export default function CommandCenterView({ open, onClose, userEmail }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('health'); // health, agents, awa, schedule
  
  useEffect(() => {
    if (open && !data) {
      loadDashboard();
    }
  }, [open]);
  
  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${ABABASE}/api/admin/dashboard?email=${encodeURIComponent(userEmail)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      setData(result);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };
  
  if (!open) return null;
  
  const TabBtn = ({ k, label }) => (
    <button onClick={() => setTab(k)} style={{ 
      padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
      background: tab === k ? "rgba(139,92,246,.2)" : "transparent",
      color: tab === k ? "rgba(139,92,246,.95)" : "rgba(255,255,255,.4)",
      fontSize: 12, fontWeight: 600
    }}>{label}</button>
  );
  
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.7)" }} />
      <div style={{ position: "relative", width: "95%", maxWidth: 600, maxHeight: "85vh", background: "rgba(12,10,24,.98)", backdropFilter: "blur(24px)", borderRadius: 20, border: "1px solid rgba(139,92,246,.2)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <Zap size={20} style={{ color: "rgba(139,92,246,.8)" }} />
            Command Center
          </h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={loadDashboard} style={{ background: "rgba(139,92,246,.15)", border: "1px solid rgba(139,92,246,.2)", borderRadius: 8, padding: "6px 12px", color: "rgba(139,92,246,.9)", cursor: "pointer", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              <RefreshCw size={12} />Refresh
            </button>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,.4)", cursor: "pointer", padding: 4 }}><X size={20} /></button>
          </div>
        </div>
        
        {/* Tabs */}
        <div style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,.04)", display: "flex", gap: 4, background: "rgba(0,0,0,.2)" }}>
          <TabBtn k="health" label="Health" />
          <TabBtn k="agents" label="Agents" />
          <TabBtn k="awa" label="AWA Jobs" />
          <TabBtn k="schedule" label="Schedule" />
        </div>
        
        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(139,92,246,.2)", borderTopColor: "rgba(139,92,246,.8)", animation: "spin 1s linear infinite" }} />
              <p style={{ color: "rgba(255,255,255,.5)", marginTop: 12, fontSize: 12 }}>Loading Command Center...</p>
            </div>
          )}
          
          {error && (
            <div style={{ padding: 16, background: "rgba(239,68,68,.1)", borderRadius: 12, border: "1px solid rgba(239,68,68,.2)" }}>
              <p style={{ color: "rgba(239,68,68,.9)", margin: 0, fontSize: 13 }}>Error: {error}</p>
            </div>
          )}
          
          {data && !loading && (
            <>
              {/* Health Tab */}
              {tab === 'health' && (
                <div>
                  {/* Service Status */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Services</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                      {Object.entries(data.health?.services || {}).map(([name, status]) => (
                        <div key={name} style={{ padding: "10px 12px", background: status === "healthy" || status === "configured" ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)", borderRadius: 10, border: `1px solid ${status === "healthy" || status === "configured" ? "rgba(34,197,94,.2)" : "rgba(239,68,68,.2)"}` }}>
                          <div style={{ color: status === "healthy" || status === "configured" ? "rgba(34,197,94,.9)" : "rgba(239,68,68,.9)", fontSize: 12, fontWeight: 600 }}>{name}</div>
                          <div style={{ color: "rgba(255,255,255,.4)", fontSize: 10, marginTop: 2 }}>{status}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Stats */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                    <div style={{ padding: 14, background: "rgba(139,92,246,.1)", borderRadius: 12, textAlign: "center" }}>
                      <div style={{ color: "rgba(139,92,246,.9)", fontSize: 24, fontWeight: 700 }}>{data.agents?.total || 0}</div>
                      <div style={{ color: "rgba(255,255,255,.4)", fontSize: 10, marginTop: 2 }}>Agents</div>
                    </div>
                    <div style={{ padding: 14, background: "rgba(34,197,94,.1)", borderRadius: 12, textAlign: "center" }}>
                      <div style={{ color: "rgba(34,197,94,.9)", fontSize: 24, fontWeight: 700 }}>{data.agents?.departments || 0}</div>
                      <div style={{ color: "rgba(255,255,255,.4)", fontSize: 10, marginTop: 2 }}>Departments</div>
                    </div>
                    <div style={{ padding: 14, background: "rgba(245,158,11,.1)", borderRadius: 12, textAlign: "center" }}>
                      <div style={{ color: "rgba(245,158,11,.9)", fontSize: 24, fontWeight: 700 }}>{data.awa?.totalJobs || 0}</div>
                      <div style={{ color: "rgba(255,255,255,.4)", fontSize: 10, marginTop: 2 }}>AWA Jobs</div>
                    </div>
                    <div style={{ padding: 14, background: "rgba(6,182,212,.1)", borderRadius: 12, textAlign: "center" }}>
                      <div style={{ color: "rgba(6,182,212,.9)", fontSize: 24, fontWeight: 700 }}>{data.brain?.totalMemories || 0}</div>
                      <div style={{ color: "rgba(255,255,255,.4)", fontSize: 10, marginTop: 2 }}>Memories</div>
                    </div>
                  </div>
                  
                  {/* Uptime */}
                  <div style={{ marginTop: 16, padding: 12, background: "rgba(255,255,255,.03)", borderRadius: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "rgba(255,255,255,.4)", fontSize: 11 }}>Uptime</span>
                      <span style={{ color: "rgba(34,197,94,.9)", fontSize: 12, fontWeight: 600 }}>{Math.floor((data.health?.uptime || 0) / 3600)}h {Math.floor(((data.health?.uptime || 0) % 3600) / 60)}m</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Agents Tab */}
              {tab === 'agents' && (
                <div>
                  <p style={{ color: "rgba(255,255,255,.5)", fontSize: 12, marginBottom: 12 }}>{data.agents?.total || 0} agents across {data.agents?.departments || 0} departments</p>
                  <p style={{ color: "rgba(255,255,255,.3)", fontSize: 11 }}>Full agent list available at /api/admin/agents</p>
                </div>
              )}
              
              {/* AWA Tab */}
              {tab === 'awa' && (
                <div>
                  <div style={{ padding: 16, background: "rgba(139,92,246,.1)", borderRadius: 14, textAlign: "center", marginBottom: 16 }}>
                    <div style={{ color: "rgba(139,92,246,.9)", fontSize: 32, fontWeight: 700 }}>{data.awa?.totalJobs || 0}</div>
                    <div style={{ color: "rgba(255,255,255,.4)", fontSize: 11, marginTop: 4 }}>Active Jobs in Pipeline</div>
                  </div>
                  <p style={{ color: "rgba(255,255,255,.3)", fontSize: 11 }}>View full job list in the Jobs tab</p>
                </div>
              )}
              
              {/* Schedule Tab */}
              {tab === 'schedule' && (
                <div>
                  <p style={{ color: "rgba(255,255,255,.5)", fontSize: 12 }}>Autonomous schedule management</p>
                  <p style={{ color: "rgba(255,255,255,.3)", fontSize: 11, marginTop: 8 }}>Schedule data at /api/admin/schedule</p>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,.04)", background: "rgba(0,0,0,.2)" }}>
          <p style={{ color: "rgba(255,255,255,.3)", fontSize: 10, margin: 0, textAlign: "center" }}>
            Command Center v1.0 • Backend: abacia-services.onrender.com
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// F5: BRIEFING MODE - What happened, what's pending, what she handled
// ⬡B:MYABA.V2:briefing:20260313⬡ Updated to use /api/myaba/briefing
// ═══════════════════════════════════════════════════════════════════════════
async function fetchBriefing(userId) {
  try {
    // Use v2 MyABA briefing endpoint
    const response = await fetch(`${ABABASE}/api/briefing?userId=${encodeURIComponent(userId)}`);
    if (!response.ok) throw new Error('Briefing fetch failed');
    const data = await response.json();
    // Transform v2 response to expected format
    const briefing = data.briefing || data;
    return {
      summary: data.summary || briefing.spoken_summary || briefing.summary || briefing.greeting || '',
      handled: data.handled || briefing.sections?.find(s => s.type === 'handled')?.items || [],
      pending: data.pending || briefing.sections?.find(s => s.type === 'pending' || s.type === 'approvals')?.items || [],
      upcoming: data.upcoming || briefing.sections?.find(s => s.type === 'calendar')?.items || [],
      jobs: data.jobs || briefing.sections?.find(s => s.type === 'jobs')?.items || [],
      raw: briefing
    };
  } catch (e) {
    console.error("[BRIEFING] Fetch failed:", e);
    // Fallback to AIR
    try {
      const result = await airRequest("briefing", {
        message: "Generate my briefing. What happened today? What's pending? What did you handle autonomously?"
      }, userId);
      if (result.response) {
        return { summary: result.response, handled: [], pending: [], upcoming: [] };
      }
    } catch {}
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ABA PRESENCE — Premium glass translucent animated orb
// ═══════════════════════════════════════════════════════════════════════════
// v1.2.0: Premium animated ABA presence (imported at top of file)

// Alias for backward compatibility

// ⬡B:CIP:ABA_LOGO:brand_mark:20260325⬡ Real ABA logo SVG component
