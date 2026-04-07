// ⬡B:MACE.phase0:VIEW:journal_extract:20260405⬡
// JournalView — extracted from MyABA.jsx. LOGFUL (Logging Operations and General Feedback Utility Layer)
// Dual mode: Capture (quick voice/text notes) + Journal (reflections with mood)
// ⬡B:cip.logful:VIEW:dual_mode:20260324⬡
// 90/10: All data through backend /api/logful/* endpoints. Zero direct Supabase.

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff } from "lucide-react";
import { ABABASE, reachTranscribe } from "../utils/api.js";

export default function JournalView({ userId }) {
  const [mode, setMode] = useState("journal");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [mood, setMood] = useState(null);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${ABABASE}/api/logful/recent?userId=${encodeURIComponent(userId)}&limit=30`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.journals || []);
      }
    } catch (e) { console.error("[LOGFUL] Load failed:", e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const payload = {
        message: mode === "capture" ? text : `Journal entry: ${text}`,
        user_id: userId,
        userId,
        channel: "cip",
        appScope: "logful"
      };
      if (mood) payload.message = `[mood: ${mood}] ${payload.message}`;
      await fetch(`${ABABASE}/api/air/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      setText(""); setMood(null); load();
    } catch (e) { console.error("[LOGFUL] Save failed:", e); }
    setSending(false);
  };

  const toggleRecord = async () => {
    if (recording) {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeTypes = ["audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus","audio/mp4","audio/aac",""];
      let mimeType = "";
      for (const mt of mimeTypes) { if (!mt || MediaRecorder.isTypeSupported(mt)) { mimeType = mt; break; } }
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks = [];
      rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunks, { type: mimeType || "audio/webm" });
        const result = await reachTranscribe(blob);
        const transcript = result?.text || (typeof result === 'string' ? result : null);
        if (transcript) setText(prev => prev ? prev + " " + transcript : transcript);
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch (e) {
      console.error("[LOGFUL] Mic error:", e);
    }
  };

  const MOODS = [
    { emoji: "\u{1F60A}", label: "Good", value: "good" },
    { emoji: "\u{1F914}", label: "Reflective", value: "reflective" },
    { emoji: "\u{1F4AA}", label: "Motivated", value: "motivated" },
    { emoji: "\u{1F614}", label: "Stressed", value: "stressed" },
    { emoji: "\u{1F64F}", label: "Grateful", value: "grateful" }
  ];

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 16 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 12, background: "rgba(255,255,255,.04)", borderRadius: 10, padding: 3 }}>
        {[{ id: "capture", label: "Capture" }, { id: "journal", label: "Journal" }].map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} style={{
            flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 500, transition: "all .2s",
            background: mode === m.id ? "rgba(139,92,246,.3)" : "transparent",
            color: mode === m.id ? "#c4b5fd" : "rgba(255,255,255,.35)"
          }}>{m.label}</button>
        ))}
      </div>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,.25)", marginBottom: 10 }}>{today}</p>

      {mode === "journal" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, justifyContent: "center" }}>
          {MOODS.map(m => (
            <button key={m.value} onClick={() => setMood(mood === m.value ? null : m.value)} style={{
              padding: "6px 10px", borderRadius: 20, border: mood === m.value ? "1px solid rgba(139,92,246,.5)" : "1px solid rgba(255,255,255,.08)",
              background: mood === m.value ? "rgba(139,92,246,.15)" : "rgba(255,255,255,.03)",
              cursor: "pointer", fontSize: 12, color: mood === m.value ? "#c4b5fd" : "rgba(255,255,255,.4)",
              transition: "all .2s"
            }}>{m.emoji} {m.label}</button>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <textarea
          value={text}
          onChange={e => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px"; }}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && mode === "capture") { e.preventDefault(); save(); } }}
          placeholder={mode === "capture" ? "Quick thought, note, or idea..." : "How are you feeling? What happened today?"}
          rows={mode === "capture" ? 2 : 4}
          style={{
            width: "100%", padding: "12px 14px", borderRadius: 12,
            border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)",
            color: "#fff", fontSize: 13, outline: "none", resize: "none", lineHeight: 1.6,
            boxSizing: "border-box"
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={toggleRecord} style={{
            padding: "10px 16px", borderRadius: 12, border: "none", cursor: "pointer",
            background: recording ? "rgba(239,68,68,.3)" : "rgba(255,255,255,.06)",
            color: recording ? "#fca5a5" : "rgba(255,255,255,.5)", fontSize: 13, fontWeight: 500,
            display: "flex", alignItems: "center", gap: 6, transition: "all .2s"
          }}>
            {recording ? <><MicOff size={14}/> Stop</> : <><Mic size={14}/> Voice</>}
          </button>
          <button onClick={save} disabled={sending || !text.trim()} style={{
            flex: 1, padding: "10px", borderRadius: 12, border: "none", cursor: "pointer",
            background: text.trim() ? "rgba(139,92,246,.3)" : "rgba(255,255,255,.04)",
            color: text.trim() ? "#c4b5fd" : "rgba(255,255,255,.2)",
            fontSize: 13, fontWeight: 500, transition: "all .2s"
          }}>
            {sending ? "Saving..." : mode === "capture" ? "Capture" : "Save Entry"}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ width: 24, height: 24, margin: "0 auto", borderRadius: "50%", border: "2px solid rgba(139,92,246,.2)", borderTopColor: "rgba(139,92,246,.6)", animation: "spin 1s linear infinite" }}/>
          </div>
        ) : entries.length === 0 ? (
          <p style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,.25)", fontSize: 13 }}>
            {mode === "capture" ? "No captures yet. Speak or type a quick thought." : "No journal entries yet. How was your day?"}
          </p>
        ) : (entries||[]).map((e, i) => {
          const content = typeof e.raw === "string" ? e.raw : typeof e.content === "string" ? e.content : JSON.stringify(e);
          const tone = e.emotionalTone || "";
          const summary = e.summary || "";
          const ts = e.extractedAt || e.created_at || "";
          return (
            <div key={i} style={{
              padding: 12, marginBottom: 8, borderRadius: 12,
              background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)"
            }}>
              {tone && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(139,92,246,.15)", color: "#a78bfa", marginBottom: 6, display: "inline-block" }}>{tone}</span>}
              <p style={{ fontSize: 13, color: "rgba(255,255,255,.75)", whiteSpace: "pre-wrap", lineHeight: 1.6, margin: tone ? "6px 0 0" : 0 }}>{content.substring(0, 400)}</p>
              {summary && <p style={{ fontSize: 11, color: "rgba(139,92,246,.5)", marginTop: 6, fontStyle: "italic" }}>{summary.substring(0, 200)}</p>}
              <span style={{ fontSize: 10, color: "rgba(255,255,255,.15)", marginTop: 4, display: "block" }}>{ts ? new Date(ts).toLocaleString() : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
