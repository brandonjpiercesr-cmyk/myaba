// ⬡B:AWA.voice:SHARED:mock_interview_vara:20260408⬡
// MockInterviewVARA — shared voice interview component
// Used by: JobsView (AWA jobs), InterviewModeView (IRIS interview mode)
// Extracted per 911 Rule 13 (shared core mandate) to prevent duplicate components
// across CIP, CIB, and standalone surfaces.

import { useState, useRef, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
import { ABABASE } from "../utils/api.js";

export default function MockInterviewVARA({ job, userId, onClose }) {
  const [orbState, setOrbState] = useState("idle");
  const [statusText, setStatusText] = useState("Tap to start voice interview");
  const [transcript, setTranscript] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const thinkTimerRef = useRef(null);
  const currentMsgRef = useRef("");

  const conversation = useConversation({
    onConnect: () => { setOrbState("listening"); setStatusText("Listening... answer the question"); },
    onDisconnect: () => { setOrbState("idle"); setStatusText("Interview ended"); },
    onError: (msg) => { setOrbState("error"); setErrorMsg(String(msg)); setStatusText("Error. Tap to retry."); },
    onMessage: ({ message, source }) => {
      if (source === "user") {
        if (currentMsgRef.current) { setTranscript(p => [...p, { from: "vara", text: currentMsgRef.current }]); currentMsgRef.current = ""; }
        setOrbState("thinking"); setStatusText("VARA is thinking...");
      }
      if (source === "ai") { currentMsgRef.current += message; }
    },
    onModeChange: ({ mode }) => {
      clearTimeout(thinkTimerRef.current);
      if (mode === "speaking") { setOrbState("speaking"); setStatusText("VARA is asking a question..."); }
      else {
        if (currentMsgRef.current) { setTranscript(p => [...p, { from: "vara", text: currentMsgRef.current }]); currentMsgRef.current = ""; }
        thinkTimerRef.current = setTimeout(() => { setOrbState("listening"); setStatusText("Your turn — answer the question"); }, 200);
      }
    }
  });

  const handleTap = useCallback(async () => {
    if (orbState === "error") { setOrbState("idle"); setStatusText("Tap to start voice interview"); setErrorMsg(""); return; }
    if (conversation.status === "connected") { await conversation.endSession(); return; }
    try {
      setOrbState("connecting"); setStatusText("Requesting microphone...");
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setStatusText("Connecting to VARA...");
      // Preload VARA with mock interview context
      try {
        await fetch(ABABASE + "/vara/preload", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId, conversation_id: "mock_interview_" + Date.now(),
            mode: "mock_interview",
            jobTitle: job?.job_title || job?.title || "",
            jobOrg: job?.organization || job?.company || "",
            jobDescription: job?.description || "",
            instructions: "You are conducting a mock interview. Ask one question at a time. After the candidate answers, give brief feedback and a score out of 10, then ask the next question. Start with a warm greeting and your first question."
          })
        });
      } catch (pe) { console.log("[MOCK] Preload failed (non-fatal):", pe.message); }
      await conversation.startSession({
        agentId: "agent_0601khe2q0gben08ws34bzf7a0sa",
        connectionType: "webrtc",
        overrides: { agent: { prompt: { prompt: "" } }, conversation_initiation_client_data: { dynamic_variables: { user_id: userId || "unknown" } } },
        dynamicVariables: { user_id: userId || "unknown" }
      });
    } catch (err) {
      setOrbState("error"); setErrorMsg(err.message || "Failed to connect");
      setStatusText(err.name === "NotAllowedError" ? "Microphone access denied." : "Connection failed. Tap to retry.");
    }
  }, [conversation, orbState, job, userId]);

  const colors = { idle: "6,182,212", connecting: "245,158,11", listening: "139,92,246", thinking: "245,158,11", speaking: "16,185,129", error: "239,68,68" };
  const c = colors[orbState] || colors.idle;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "center", padding: 20 }} onClick={e => { if (e.target === e.currentTarget && conversation.status !== "connected") onClose(); }}>
      <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        {/* Header */}
        <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ color: "#22D3EE", fontSize: 14, fontWeight: 700, margin: 0 }}>Mock Interview</p>
            <p style={{ color: "rgba(255,255,255,.5)", fontSize: 11, margin: "2px 0 0" }}>{job?.job_title || job?.title} at {job?.organization || job?.company}</p>
          </div>
          <button onClick={async () => { if (conversation.status === "connected") await conversation.endSession(); onClose(); }} style={{ background: "rgba(255,255,255,.05)", border: "none", color: "rgba(255,255,255,.5)", cursor: "pointer", fontSize: 18, width: 32, height: 32, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        {/* Orb */}
        <div onClick={handleTap} style={{ width: 140, height: 140, borderRadius: "50%", background: `radial-gradient(circle at 40% 40%, rgba(${c},.4), rgba(${c},.1))`, border: `2px solid rgba(${c},.4)`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .3s", boxShadow: `0 0 ${orbState === "speaking" ? 40 : orbState === "listening" ? 20 : 10}px rgba(${c},.3)` }}>
          <span style={{ fontSize: 11, color: `rgba(${c},1)`, fontWeight: 600, textAlign: "center", padding: 10 }}>{orbState === "idle" ? "TAP TO\nSTART" : orbState === "connecting" ? "..." : orbState === "listening" ? "LISTENING" : orbState === "thinking" ? "THINKING" : orbState === "speaking" ? "SPEAKING" : "ERROR"}</span>
        </div>
        <p style={{ color: "rgba(255,255,255,.5)", fontSize: 11, textAlign: "center" }}>{statusText}</p>
        {errorMsg && <p style={{ color: "rgba(239,68,68,.7)", fontSize: 10, textAlign: "center" }}>{errorMsg}</p>}

        {/* Transcript */}
        <div style={{ width: "100%", maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {transcript.map((t, i) => (
            <div key={i} style={{ display: "flex", justifyContent: t.from === "vara" ? "flex-start" : "flex-end" }}>
              <div style={{ maxWidth: "85%", padding: "8px 12px", borderRadius: t.from === "vara" ? "12px 12px 12px 4px" : "12px 12px 4px 12px",
                background: t.from === "vara" ? "rgba(6,182,212,.15)" : "rgba(139,92,246,.2)",
                color: t.from === "vara" ? "rgba(6,182,212,.9)" : "rgba(255,255,255,.85)", fontSize: 12, lineHeight: 1.4 }}>
                {t.text}
              </div>
            </div>
          ))}
        </div>

        {conversation.status === "connected" && <button onClick={async () => { await conversation.endSession(); }} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "rgba(239,68,68,.2)", color: "rgba(239,68,68,.8)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>End Interview</button>}
      </div>
    </div>
  );
}
