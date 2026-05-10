// ⬡B:myaba.component.awa.strand_panel:CODE:ccwa_workspace_ui_runtime_wire:20260510⬡
// STRANDPanel — renders live AWA application STRANDs for the active HAM.
// Calls POST /api/dawn/awa_strands which returns {in_flight, blocked, awaiting_approval, total}
// grouped by application_id with the latest bead per application.

import { useState, useEffect } from "react";
import { Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { ABABASE } from "../../utils/api.js";

const BEAD_SEQUENCE = ['discovered', 'routed', 'researched', 'drafted', 'approved', 'sent', 'confirmed', 'replied', 'closed'];

const BEAD_COLORS = {
  discovered: '#94a3b8',
  routed: '#60a5fa',
  researched: '#a78bfa',
  drafted: '#f59e0b',
  approved: '#22d3ee',
  sent: '#34d399',
  confirmed: '#10b981',
  replied: '#22c55e',
  closed: '#64748b'
};

function BeadProgress({ latestBead }) {
  const idx = BEAD_SEQUENCE.indexOf(latestBead);
  return (
    <div style={{display: 'flex', gap: 4, alignItems: 'center'}}>
      {BEAD_SEQUENCE.map((bead, i) => (
        <div
          key={bead}
          title={bead}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: i <= idx ? BEAD_COLORS[bead] : 'rgba(255,255,255,0.1)',
            border: i === idx ? '2px solid #fff' : 'none'
          }}
        />
      ))}
      <span style={{fontSize: 10, color: BEAD_COLORS[latestBead] || '#94a3b8', marginLeft: 6, fontWeight: 600}}>
        {latestBead}
      </span>
    </div>
  );
}

export default function STRANDPanel({ hamUid }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStrands = async () => {
    if (!hamUid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(ABABASE + '/api/dawn/awa_strands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hamUid })
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || 'fetch_failed');
        setData(null);
      } else {
        setData(json);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStrands(); }, [hamUid]);

  if (!hamUid) return null;

  return (
    <div style={{padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)'}}>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
        <h3 style={{fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', margin: 0}}>
          AWA STRANDs
        </h3>
        <button
          onClick={fetchStrands}
          disabled={loading}
          style={{padding: 4, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer'}}
          title="Refresh"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      </div>

      {error && (
        <div style={{display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#f87171', marginBottom: 8}}>
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}

      {data && data.total === 0 && (
        <p style={{fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0}}>
          No active applications.
        </p>
      )}

      {data && data.total > 0 && (
        <>
          <div style={{display: 'flex', gap: 12, marginBottom: 12, fontSize: 11}}>
            <span style={{color: '#34d399'}}>{(data.in_flight || []).length} in flight</span>
            <span style={{color: '#f59e0b'}}>{(data.awaiting_approval || []).length} awaiting approval</span>
            <span style={{color: '#94a3b8'}}>{data.total} total</span>
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
            {(data.in_flight || []).map(app => (
              <div key={app.application_id} style={{padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6}}>
                  <span style={{fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace'}}>
                    {app.application_id}
                  </span>
                  <span style={{fontSize: 9, color: 'rgba(255,255,255,0.3)'}}>
                    {app.latest_updated ? new Date(app.latest_updated).toLocaleString() : ''}
                  </span>
                </div>
                <BeadProgress latestBead={app.latest_bead} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
