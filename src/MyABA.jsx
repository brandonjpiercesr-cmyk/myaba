// ⬡B:myaba.genesis:APP:v2.17.0:20260313⬡
// MyABA v2.17.0 - AWA v2 Backend Integration + Ghost Mode
// ════════════════════════════════════════════════════════════════════════════
// SPURTS IMPLEMENTED:
//   1. Split Screen: Desktop=chat+talk panel, Mobile=chat+floating orb
//   2. Talk to ABA: Renamed from "Live" mode
//   3. Private/Shared Chats: Email-based sharing
//   4. Projects: Project folders with files
//   5. Attachments: File/image upload support
//   6. Voice Responses: ElevenLabs TTS (FIXED in v2.13.0)
//   7. F5 Briefing Mode: Dedicated /api/myaba/briefing endpoint (v2)
//   8. F6 Approve Mode: Dedicated /api/myaba/approvals endpoint (v2)
//   9. F7 Settings: Voice, notifications, backgrounds, user profile, Ghost Mode
//   10. F8 Push Notifications: Web Push API + toggle in settings
// v2.14.0 NEW:
//   - AWA Jobs tab with full job listings
//   - Cover letter / Resume generation from job detail
//   - Team color coding by assignee
//   - Search and filter jobs
// v2.17.0 NEW:
//   - Updated to AWA v2 backend endpoints
//   - Ghost Mode toggle in settings
//   - References manager integration ready
// ARCHITECTURE:
//   - Firebase = AUTH ONLY (Google sign-in)
//   - Conversations = AIR → Supabase (NOT Firebase Firestore)
//   - Greetings = AGENT DAWN (Dynamic, JARVIS-style, contextual)
//   - ABA = Life assistant (not AI/personal assistant)
// ════════════════════════════════════════════════════════════════════════════
// ROUTING: USER → MyABA → ABABASE → FAT PROMPT (88 agents) → Response
// This file is SKIN. It has NO brain. ZERO hardcoded content.

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Mic, MicOff, Volume2, VolumeX, MessageSquare, Radio, Hand,
  Settings, X, Plus, Bell, Mail, Calendar, Phone, Headphones,
  MessageCircle, Zap, Activity, Home, ChevronLeft, Code, Clock, CheckCircle, AlertTriangle,
  Sparkles, FileText, Eye, ChevronRight, User, LogOut, Users, Lock, Trophy, Timer, Target, Shield, CheckSquare, Coffee, FolderOpen, HardDrive, Clipboard, Waves, LayoutList,
  Trash2, Archive, Search, WifiOff, Wifi, RefreshCw, Share2, Paperclip,
  Image, File, FolderPlus, MoreVertical, Edit2, Copy, Briefcase,
  MapPin, ExternalLink, Building, Download, ChevronDown, Camera, Sunrise, BookOpen, GripVertical,
  Loader2, Play, Pause, Square, Globe, Compass, Hash, Heart, Star, TrendingUp, BarChart2
} from "lucide-react";
import { auth, signInGoogle, signOutUser, db } from "./firebase.js";
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { useConversation } from "@elevenlabs/react";
import { onAuthStateChanged } from "firebase/auth";

// ⬡B:AUDRA.C4:FIX:error_boundary:20260403⬡ Crash = fallback UI, not white screen
import React from "react";
import { ABAPresence } from './ABAPresence.jsx';

// ⬡B:MACE.phase0:IMPORTS:shared_utils_and_views:20260405⬡
// Shared utils — extracted from this file
import { ABABASE, airRequest, airRequestStream, isOnline, airShareChat, airLoadProjects, airCreateProject, airLoadConversations, airCreateConversation, airAddMessage, airUpdateConversation, airDeleteConversation, airLoadSettings, airSaveSettings, airAddProjectFile, IMAGE_TYPES, fileToBase64, uploadAttachment, uploadAttachmentsBatch, reachTranscribe, reachSynthesize, reachPresence, airNameChat, getDawnGreeting, subscribeToPush, unsubscribeFromPush, safeParseGreeting, exportChat, fetchBriefing } from "./utils/api.js";
import { resolveHamId, isHAM, HAM_EMAIL_MAP, HAM_TEAM } from "./utils/ham.js";
import { ICON_MAP } from "./utils/icons.js";
import { renderMd, renderInline } from "./utils/markdown.jsx";
import ABALogo from "./components/shared/ABALogo.jsx";
// Extracted views
import ShadowView from "./views/ShadowView.jsx";
import AOAView from "./views/AOAView.jsx";
import TasksView from "./views/TasksView.jsx";
import CRMView from "./views/CRMView.jsx";
import NotesView from "./views/NotesView.jsx";
import CalendarView from "./views/CalendarView.jsx";
import NURAView from "./views/NURAView.jsx";
import ContactsView from "./views/ContactsView.jsx";
import EmailView from "./views/EmailView.jsx";
import SportsView from "./views/SportsView.jsx";
import MusicView from "./views/MusicView.jsx";
import GuideView from "./views/GuideView.jsx";
import CCWAView from "./views/CCWAView.jsx";
import PipelineView from "./views/PipelineView.jsx";
import BriefingView from "./views/BriefingView.jsx";
import JournalView from "./views/JournalView.jsx";
import GMGUniversityView from "./views/GMGUniversityView.jsx";
import ReferencesView from "./views/ReferencesView.jsx";
import MemosView from "./views/MemosView.jsx";
import ApproveView from "./views/ApproveView.jsx";
import CommandCenterView from "./views/CommandCenterView.jsx";
import SettingsDrawer from "./views/SettingsDrawer.jsx";
import MeetingModeView from "./views/MeetingModeView.jsx";
import InterviewModeView from "./views/InterviewModeView.jsx";
import JobsView from "./views/JobsView.jsx";
import ReadingView from "./views/ReadingView.jsx";


class ErrorBoundary extends React.Component {
  constructor(props){super(props);this.state={hasError:false,error:null}}
  static getDerivedStateFromError(error){return{hasError:true,error}}
  componentDidCatch(e,info){console.error("[ABA] ErrorBoundary caught:",e,info)}
  render(){if(this.state.hasError)return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#0a0a0f",color:"white",padding:24,textAlign:"center"}}>
      <div style={{width:60,height:60,borderRadius:"50%",background:"rgba(239,68,68,.15)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16}}>
        <span style={{fontSize:28}}>!</span>
      </div>
      <p style={{fontSize:16,fontWeight:600,marginBottom:8}}>Something went wrong</p>
      <p style={{fontSize:12,color:"rgba(255,255,255,.4)",marginBottom:16,maxWidth:300}}>{this.state.error?.message||"ABA hit an unexpected error"}</p>
      <button onClick={()=>{this.setState({hasError:false,error:null});window.location.reload()}} style={{padding:"10px 20px",borderRadius:10,border:"none",background:"rgba(139,92,246,.3)",color:"#a78bfa",cursor:"pointer",fontSize:13}}>Reload ABA</button>
    </div>
  );return this.props.children}
}

// ═══════════════════════════════════════════════════════════════════════════
// SPURT 1: DEVICE DETECTION — Desktop vs Mobile
// ═══════════════════════════════════════════════════════════════════════════
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

// ═══════════════════════════════════════════════════════════════════════════
// ABABASE — Fat Prompt Architecture. Every interaction. ZERO local thinking.
// ═══════════════════════════════════════════════════════════════════════════
// ⬡B:MYABA:ABABASE:v2.6.0:20260228⬡
// ABABASE = Fat Prompt Architecture (87 agents, HAM identity)


// v1.2.0: Check online status

// ⬡B:aba_skins:COMPONENT:app_launcher:20260323⬡
// CIP App Launcher — renders app grid from GET /api/apps
// Zero hardcoded apps. Backend is source of truth.


// ═══════════════════════════════════════════════════════════════════════════
// PHASE 6+7: ALL CIP APP VIEWS (Tasks, Notes, Calendar, Contacts, Journal,
//   GUIDE, NURA, GMG-U) — added in one clean push
// ═══════════════════════════════════════════════════════════════════════════


// ⬡B:phase4b:mobile_editor:20260323⬡ Mobile Google Docs-style editor for cover letters/resumes
function MobileDocEditor({ content: initialContent, docId, docType, onClose, onSave }) {
  const [text, setText] = useState(initialContent || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const save = async () => {
    setSaving(true);
    try {
      const endpoint = docType === "resume" 
        ? ABABASE + "/api/awa/resumes/" + docId
        : ABABASE + "/api/awa/cover-letters/" + docId;
      await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, status: "edited" })
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (onSave) onSave(text);
    } catch (e) { console.error("[Editor] Save failed:", e); }
    setSaving(false);
  };

  const copy = () => { navigator.clipboard.writeText(text); };

  return (
    <div style={{position:"fixed",inset:0,zIndex:300,background:"rgba(5,3,15,.98)",display:"flex",flexDirection:"column"}}>
      {/* Toolbar */}
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,.08)",background:"rgba(10,8,20,.95)"}}>
        <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,.5)",cursor:"pointer",padding:4}}>
          <ChevronLeft size={20} />
        </button>
        <span style={{flex:1,fontSize:13,fontWeight:600,color:"rgba(255,255,255,.7)"}}>{docType === "resume" ? "Edit Resume" : "Edit Cover Letter"}</span>
        <button onClick={copy} style={{padding:"6px 12px",borderRadius:8,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.04)",color:"rgba(255,255,255,.5)",fontSize:11,cursor:"pointer"}}>Copy</button>
        <button onClick={save} disabled={saving} style={{padding:"6px 14px",borderRadius:8,border:"none",background:saved?"rgba(34,197,94,.2)":"rgba(139,92,246,.25)",color:saved?"#22c55e":"#a78bfa",fontSize:11,fontWeight:600,cursor:"pointer"}}>
          {saving ? "Saving..." : saved ? "Saved" : "Save"}
        </button>
      </div>
      {/* Editor area */}
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        style={{
          flex:1, padding:"20px 18px", background:"transparent", border:"none", outline:"none",
          color:"rgba(255,255,255,.9)", fontSize:14, lineHeight:1.8, resize:"none",
          fontFamily:"Georgia, 'Times New Roman', serif",
          WebkitOverflowScrolling:"touch"
        }}
        autoFocus
      />
      {/* Word count */}
      <div style={{padding:"8px 18px",borderTop:"1px solid rgba(255,255,255,.06)",display:"flex",justifyContent:"space-between"}}>
        <span style={{fontSize:10,color:"rgba(255,255,255,.2)"}}>{text.split(/\s+/).filter(Boolean).length} words</span>
        <span style={{fontSize:10,color:"rgba(255,255,255,.2)"}}>{text.length} characters</span>
      </div>
    </div>
  );
}

// ⬡B:audra.gmg_university:FIX:real_aba_logo_cip:20260405⬡
const STATE_PALETTES = {
  idle: {
    colors: [
      [139, 92, 246],   // Purple
      [167, 139, 250],  // Light purple
      [236, 72, 153],   // Pink
      [99, 102, 241],   // Indigo
    ],
    glow: [139, 92, 246]
  },
  thinking: {
    colors: [
      [245, 158, 11],   // Orange
      [251, 191, 36],   // Yellow
      [239, 68, 68],    // Red
      [253, 224, 71],   // Light yellow
    ],
    glow: [245, 158, 11]
  },
  speaking: {
    colors: [
      [34, 197, 94],    // Green
      [16, 185, 129],   // Emerald
      [132, 204, 22],   // Lime
      [45, 212, 191],   // Teal
    ],
    glow: [34, 197, 94]
  },
  listening: {
    colors: [
      [6, 182, 212],    // Cyan
      [59, 130, 246],   // Blue
      [139, 92, 246],   // Purple
      [147, 197, 253],  // Light blue
    ],
    glow: [6, 182, 212]
  }
};

// v1.7.8-P7-S1 | UTIL | Simplex-style noise for organic shapes
class NoiseGenerator {
  constructor() {
    this.perm = [];
    for (let i = 0; i < 512; i++) {
      this.perm[i] = Math.floor(Math.random() * 256);
    }
  }
  
  noise2D(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = this.fade(x);
    const v = this.fade(y);
    const A = this.perm[X] + Y;
    const B = this.perm[X + 1] + Y;
    return this.lerp(v,
      this.lerp(u, this.grad(this.perm[A], x, y), this.grad(this.perm[B], x - 1, y)),
      this.lerp(u, this.grad(this.perm[A + 1], x, y - 1), this.grad(this.perm[B + 1], x - 1, y - 1))
    );
  }
  
  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(t, a, b) { return a + t * (b - a); }
  grad(hash, x, y) {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }
}

// v1.7.8-P7-S1 | COMP | Organic Energy ABA
// v1.18.1-P18-S6 | ABA | Animated consciousness orb with mood-based glow states
const ABAConsciousness = ({ size = 200, state = 'idle' }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const noiseRef = useRef(new NoiseGenerator());
  const stateRef = useRef(state);
  
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    
    const center = size / 2;
    const noise = noiseRef.current;
    
    let time = 0;
    
    const animate = () => {
      const palette = STATE_PALETTES[stateRef.current] || STATE_PALETTES.idle;
      const speed = stateRef.current === 'thinking' ? 0.025 : 
                   stateRef.current === 'speaking' ? 0.018 :
                   stateRef.current === 'listening' ? 0.012 : 0.015;
      
      time += speed;
      
      // Clear completely - transparent background
      ctx.clearRect(0, 0, size, size);
      
      // Draw multiple blob layers
      for (let layer = 0; layer < 4; layer++) {
        const color = palette.colors[layer];
        const layerOffset = layer * 0.7;
        const baseRadius = size * (0.28 - layer * 0.03);
        
        ctx.beginPath();
        
        // Create organic blob shape with noise
        const points = 120;
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;
          
          // Multiple noise octaves for organic feel
          const n1 = noise.noise2D(
            Math.cos(angle) * 2 + time + layerOffset,
            Math.sin(angle) * 2 + time * 0.7
          );
          const n2 = noise.noise2D(
            Math.cos(angle) * 4 + time * 1.3 + layerOffset,
            Math.sin(angle) * 4 + time * 0.9
          ) * 0.5;
          const n3 = noise.noise2D(
            Math.cos(angle) * 8 + time * 0.5 + layerOffset,
            Math.sin(angle) * 8 + time * 1.1
          ) * 0.25;
          
          const noiseVal = (n1 + n2 + n3) * 0.4;
          const radius = baseRadius + noiseVal * size * 0.15;
          
          const x = center + Math.cos(angle) * radius;
          const y = center + Math.sin(angle) * radius;
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        ctx.closePath();
        
        // Create gradient fill
        const gradient = ctx.createRadialGradient(
          center + Math.sin(time * 2 + layer) * 10,
          center + Math.cos(time * 1.5 + layer) * 10,
          0,
          center,
          center,
          baseRadius * 1.5
        );
        
        const alpha = 0.7 - layer * 0.12;
        gradient.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`);
        gradient.addColorStop(0.5, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha * 0.6})`);
        gradient.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Soft edge glow
        if (layer === 0) {
          ctx.shadowColor = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.5)`;
          ctx.shadowBlur = 30;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      
      // Add inner energy wisps
      for (let w = 0; w < 3; w++) {
        const wispColor = palette.colors[w % palette.colors.length];
        const wispTime = time * (1 + w * 0.3);
        
        ctx.beginPath();
        
        const wispPoints = 60;
        const wispRadius = size * 0.15;
        const wispOffsetX = Math.sin(wispTime + w * 2) * size * 0.08;
        const wispOffsetY = Math.cos(wispTime * 0.7 + w * 2) * size * 0.08;
        
        for (let i = 0; i <= wispPoints; i++) {
          const angle = (i / wispPoints) * Math.PI * 2;
          const n = noise.noise2D(
            Math.cos(angle) * 3 + wispTime + w,
            Math.sin(angle) * 3 + wispTime * 0.8
          );
          
          const r = wispRadius + n * size * 0.1;
          const x = center + wispOffsetX + Math.cos(angle) * r;
          const y = center + wispOffsetY + Math.sin(angle) * r;
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        
        ctx.closePath();
        
        const wispGradient = ctx.createRadialGradient(
          center + wispOffsetX, center + wispOffsetY, 0,
          center + wispOffsetX, center + wispOffsetY, wispRadius
        );
        wispGradient.addColorStop(0, `rgba(255, 255, 255, 0.4)`);
        wispGradient.addColorStop(0.3, `rgba(${wispColor[0]}, ${wispColor[1]}, ${wispColor[2]}, 0.3)`);
        wispGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = wispGradient;
        ctx.fill();
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [size]);

  return <canvas ref={canvasRef} width={size} height={size} style={{ width: size, height: size, borderRadius: '50%' }} />;
};

// ⬡B:audra.gmg_university:FIX:twin_features_cip:20260405⬡

function CARAButton({ appScope, userId, onFullChat }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);
  
  const ask = async () => {
    if (!msg.trim()) return;
    const userMsg = { role: "user", text: msg };
    const abaId = "aba-" + Date.now();
    setMessages(prev => [...prev, userMsg, { role: "aba", text: "", id: abaId }]);
    setLoading(true);
    const question = msg;
    setMsg("");
    try {
      const res = await fetch(ABABASE + "/api/air/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, user_id: userId, userId, channel: "cip", appScope })
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n").filter(l => l.startsWith("data: "))) {
          try {
            const d = JSON.parse(line.slice(6));
            if (d.type === "chunk") { acc += d.text; setMessages(prev => prev.map(m => m.id === abaId ? { ...m, text: acc } : m)); }
            else if (d.type === "done") { setMessages(prev => prev.map(m => m.id === abaId ? { ...m, text: d.fullResponse || acc } : m)); }
          } catch {}
        }
      }
    } catch (e) { setMessages(prev => prev.map(m => m.id === abaId ? { ...m, text: "Could not reach ABA. Try again." } : m)); }
    setLoading(false);
  };
  
  if (!open) return (
    <button onClick={() => setOpen(true)} style={{
      position: "fixed", bottom: 90, right: 16, width: 52, height: 52, borderRadius: "50%",
      background: "linear-gradient(135deg, rgba(139,92,246,.9), rgba(99,102,241,.9))",
      border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 4px 20px rgba(139,92,246,.4)", zIndex: 100,
      animation: "pulse 3s infinite"
    }}>
      <MessageSquare size={22} color="#fff" />
    </button>
  );
  
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
      background: "rgba(10,8,20,.97)", backdropFilter: "blur(24px)",
      borderTop: "1px solid rgba(139,92,246,.2)", borderRadius: "20px 20px 0 0",
      maxHeight: "60vh", display: "flex", flexDirection: "column"
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(139,92,246,.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MessageSquare size={14} color="#a78bfa" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,.8)" }}>Ask ABA</span>
          {appScope && <span style={{ fontSize: 10, color: "rgba(139,92,246,.5)", padding: "2px 8px", background: "rgba(139,92,246,.1)", borderRadius: 8 }}>{appScope}</span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setMessages([]); }} style={{ fontSize: 11, color: "rgba(255,255,255,.3)", background: "none", border: "none", cursor: "pointer" }}>Clear</button>
          <button onClick={() => { setOpen(false); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,.3)" }}>
            <X size={16} />
          </button>
        </div>
      </div>
      
      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "8px 16px", maxHeight: "40vh" }}>
        {messages.length === 0 && <p style={{ color: "rgba(255,255,255,.25)", fontSize: 12, textAlign: "center", padding: 20 }}>Ask ABA anything about this app</p>}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 8 }}>
            <div style={{
              maxWidth: "85%", padding: "8px 12px", borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
              background: m.role === "user" ? "rgba(139,92,246,.2)" : "rgba(255,255,255,.06)",
              border: "1px solid " + (m.role === "user" ? "rgba(139,92,246,.2)" : "rgba(255,255,255,.08)")
            }}>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,.8)", lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap" }}>{m.text || "..."}</p>
            </div>
          </div>
        ))}
      </div>
      
      {/* Input */}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px 16px", borderTop: "1px solid rgba(255,255,255,.06)" }}>
        <input type="text" value={msg} onChange={e => setMsg(e.target.value)}
          onKeyDown={e => e.key === "Enter" && ask()}
          placeholder="Ask ABA anything..."
          style={{ flex: 1, padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)", color: "#fff", fontSize: 13, outline: "none" }}
        />
        <button onClick={ask} disabled={loading || !msg.trim()} style={{
          padding: "10px 16px", borderRadius: 12, border: "none", cursor: "pointer",
          background: loading ? "rgba(139,92,246,.2)" : "rgba(139,92,246,.3)", color: "#a78bfa"
        }}>
          {loading ? "..." : "Go"}
        </button>
      </div>
    </div>
  );
}


function ProactiveTip({ tip, onDismiss }) {
  if (!tip) return null;
  return (<div style={{margin:"0 16px 8px",padding:"10px 14px",borderRadius:12,background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.12)",display:"flex",alignItems:"flex-start",gap:10}}>
    <Sparkles size={14} style={{color:"#f59e0b",flexShrink:0,marginTop:2}} />
    <p style={{flex:1,fontSize:12,color:"rgba(245,158,11,.8)",lineHeight:1.5}}>{tip}</p>
    <button onClick={onDismiss} style={{background:"none",border:"none",color:"rgba(255,255,255,.2)",cursor:"pointer",flexShrink:0}}><X size={14}/></button>
  </div>);
}

// ⬡B:transcript_item:closed_captions:20260323⬡ Closed captions bar
// Brandon: "every time she talks she also does closed caption, in case you don't want the sound on"
function ClosedCaptions({ text, visible }) {
  if (!visible || !text) return null;
  return (
    <div style={{
      position: "fixed", bottom: 70, left: 16, right: 16, zIndex: 150,
      padding: "10px 16px", borderRadius: 12,
      background: "rgba(0,0,0,.85)", backdropFilter: "blur(12px)",
      border: "1px solid rgba(255,255,255,.08)",
      pointerEvents: "none"
    }}>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,.9)", lineHeight: 1.5, margin: 0, textAlign: "center" }}>{text}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MESA (Meeting Executive Strategy Assistant) — 3-panel: Transcript | ABA Answers | Glossary
// ⬡B:cip.mesa:VIEW:tim_cook_v2:20260401⬡
// TIM: verbal filler HAM says out loud (Groq). COOK: one-paragraph copy-paste script (Sonnet SSE).
// Deepgram diarization identifies speakers. Speaker 0 = HAM (device holder).
// ═══════════════════════════════════════════════════════════
function AppLauncher({ userId, onAppSelect, currentApp }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const longPressTimer = useRef(null);
  const touchStart = useRef(null);
  
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(ABABASE + "/api/apps?userId=" + encodeURIComponent(userId));
        if (res.ok) {
          const data = await res.json();
          const saved = (() => { try { return JSON.parse(localStorage.getItem("myaba_app_order")||"null") } catch { return null } })();
          const backendApps = data.apps || [];
          if (saved && Array.isArray(saved)) {
            const ordered = [];
            saved.forEach(id => { const a = backendApps.find(x => x.id === id); if (a) ordered.push(a); });
            backendApps.forEach(a => { if (!ordered.find(x => x.id === a.id)) ordered.push(a); });
            setApps(ordered);
          } else {
            setApps(backendApps);
          }
        }
      } catch (e) { console.error("[APPS] Load failed:", e); }
      finally { setLoading(false); }
    })();
  }, [userId]);

  const handleTouchStart = (idx, e) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    longPressTimer.current = setTimeout(() => { setDragging(idx); }, 500);
  };
  const handleTouchMove = (e) => {
    if (dragging === null && longPressTimer.current) {
      const dx = Math.abs(e.touches[0].clientX - (touchStart.current?.x||0));
      const dy = Math.abs(e.touches[0].clientY - (touchStart.current?.y||0));
      if (dx > 10 || dy > 10) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    }
    if (dragging === null) return;
    const el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
    const btn = el?.closest("[data-app-idx]");
    if (btn) setDragOver(parseInt(btn.dataset.appIdx));
  };
  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current); longPressTimer.current = null;
    if (dragging !== null && dragOver !== null && dragging !== dragOver) {
      const newApps = [...apps];
      const [moved] = newApps.splice(dragging, 1);
      newApps.splice(dragOver, 0, moved);
      setApps(newApps);
      try { localStorage.setItem("myaba_app_order", JSON.stringify(newApps.map(a => a.id))); } catch {}
    }
    setDragging(null); setDragOver(null);
  };

  // App icon color map — each app gets a distinct accent
  const APP_COLORS = {
    chat: "#a78bfa", briefing: "#f59e0b", jobs: "#f97316", email: "#3b82f6",
    memos: "#84cc16", nura: "#06b6d4", guide: "#10b981", approve: "#8b5cf6",
    phone: "#22c55e", settings: "#6b7280", gmg_university: "#ec4899", incidents: "#ef4444",
    journal: "#818cf8", tasks: "#f472b6", notes: "#fbbf24", calendar: "#2dd4bf",
    crm: "#fb923c", ccwa: "#a78bfa", aoa: "#64748b", reading: "#8b5cf6"
  };

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [appSearch, setAppSearch] = useState("");
  const filteredApps = appSearch ? apps.filter(a => a.name.toLowerCase().includes(appSearch.toLowerCase()) || (a.id||"").toLowerCase().includes(appSearch.toLowerCase())) : apps;
  // Show max 8 on homescreen, rest in drawer
  // ⬡B:WRAP.fix:LOCAL:usage_based_recommendations:20260410⬡
  // Zero API calls. Tracks app usage in localStorage, recommends most-used.
  const [recommendedIds] = useState(() => {
    try {
      const usage = JSON.parse(localStorage.getItem("myaba_app_usage") || "{}");
      const sorted = Object.entries(usage).sort((a, b) => b[1] - a[1]).map(e => e[0]);
      return sorted.length >= 4 ? sorted.slice(0, 4) : ["chat", "jobs", "briefing", "email"];
    } catch { return ["chat", "jobs", "briefing", "email"]; }
  });
  const recommended = apps.filter(a => recommendedIds.includes(a.id)).slice(0, 4);
  const homeApps = apps.filter(a => !recommendedIds.includes(a.id)).slice(0, 8);
  if (loading) return (
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:32,height:32,borderRadius:"50%",border:"2px solid rgba(139,92,246,.3)",borderTopColor:"rgba(139,92,246,.8)",animation:"spin 1s linear infinite"}}/>
    </div>
  );
  
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });


  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 4px" }}>
      {/* Time + greeting header */}
      <div style={{ textAlign: "center", padding: "32px 0 16px", userSelect: "none" }}>
        <div style={{ fontSize: 56, fontWeight: 100, color: "rgba(255,255,255,.9)", letterSpacing: -2, lineHeight: 1, fontFamily: "'SF Pro Display',-apple-system,sans-serif" }}>{timeStr}</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,.35)", marginTop: 6, fontWeight: 400, letterSpacing: .5 }}>{dateStr}</div>
      </div>

      {/* ⬡B:FEATURE:recommended_apps:20260409⬡ Recommended for you */}
      {!appSearch && recommended.length > 0 && <div style={{ padding: "0 12px 8px" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Recommended for you</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {recommended.map((app) => {
            const IC = ICON_MAP[app.icon] || Sparkles;
            const ac = APP_COLORS[app.id] || "#a78bfa";
            return (
              <button key={"rec-"+app.id} onClick={() => onAppSelect(app)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 4px", borderRadius: 16, border: "1px solid " + ac + "22", background: ac + "08", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, " + ac + "33, " + ac + "15)", border: "1px solid " + ac + "44", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <IC size={20} color={ac} strokeWidth={1.8} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,.55)", textAlign: "center", lineHeight: 1.2, maxWidth: 68, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.name}</span>
              </button>
            );
          })}
        </div>
      </div>}

      {/* ⬡B:FEATURE:smart_app_search:20260409⬡ Search bar */}
      <div style={{ padding: "0 12px 8px", position: "relative" }}>
        <Search size={14} style={{ position: "absolute", left: 24, top: 10, color: "rgba(255,255,255,.3)", pointerEvents: "none" }} />
        <input
          value={appSearch}
          onChange={e => setAppSearch(e.target.value)}
          placeholder="Search apps..."
          style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 14, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.04)", color: "rgba(255,255,255,.8)", fontSize: 13, outline: "none", boxSizing: "border-box", backdropFilter: "blur(8px)" }}
        />
      </div>

      {/* ⬡B:FEATURE:app_frame_grid:20260411⬡ Frame layout — apps form border, ABA orb in center */}
      {appSearch ? <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, padding: "4px 12px", alignContent: "start" }}>
        {filteredApps.map((app, idx) => {
          const IconComponent = ICON_MAP[app.icon] || Sparkles;
          const accent = APP_COLORS[app.id] || "#a78bfa";
          return (
            <button key={app.id} onClick={() => onAppSelect(app)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 4px", borderRadius: 16, border: "none", background: "transparent", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${accent}22, ${accent}11)`, border: `1px solid ${accent}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <IconComponent size={24} color={accent} strokeWidth={1.8} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,.55)", textAlign: "center", lineHeight: 1.2, maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.name}</span>
            </button>
          );
        })}
      </div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, padding: "4px 16px", alignContent: "start" }}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      >
        {homeApps.slice(0, 3).map((app, idx) => {
          const IconComponent = ICON_MAP[app.icon] || Sparkles;
          const accent = APP_COLORS[app.id] || "#a78bfa";
          return (<button key={app.id} data-app-idx={idx} onTouchStart={(e) => handleTouchStart(idx, e)} onClick={() => { if (dragging === null) onAppSelect(app); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 4px", borderRadius: 16, border: "none", background: "transparent", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${accent}22, ${accent}11)`, border: `1px solid ${accent}33`, display: "flex", alignItems: "center", justifyContent: "center" }}><IconComponent size={24} color={accent} strokeWidth={1.8} /></div>
            <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,.55)", textAlign: "center", lineHeight: 1.2, maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.name}</span>
          </button>);
        })}
        {homeApps[3] && (() => { const app=homeApps[3]; const IC=ICON_MAP[app.icon]||Sparkles; const ac=APP_COLORS[app.id]||"#a78bfa"; return <button key={app.id} onClick={() => onAppSelect(app)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 4px", borderRadius: 16, border: "none", background: "transparent", cursor: "pointer" }}><div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${ac}22, ${ac}11)`, border: `1px solid ${ac}33`, display: "flex", alignItems: "center", justifyContent: "center" }}><IC size={24} color={ac} strokeWidth={1.8} /></div><span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,.55)", textAlign: "center" }}>{app.name}</span></button> })()}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 8 }}><ABALogo size={44} glow /></div>
        {homeApps[4] && (() => { const app=homeApps[4]; const IC=ICON_MAP[app.icon]||Sparkles; const ac=APP_COLORS[app.id]||"#a78bfa"; return <button key={app.id} onClick={() => onAppSelect(app)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 4px", borderRadius: 16, border: "none", background: "transparent", cursor: "pointer" }}><div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${ac}22, ${ac}11)`, border: `1px solid ${ac}33`, display: "flex", alignItems: "center", justifyContent: "center" }}><IC size={24} color={ac} strokeWidth={1.8} /></div><span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,.55)", textAlign: "center" }}>{app.name}</span></button> })()}
        {homeApps.slice(5, 8).map((app, idx) => {
          const IconComponent = ICON_MAP[app.icon] || Sparkles;
          const accent = APP_COLORS[app.id] || "#a78bfa";
          return (<button key={app.id} onClick={() => onAppSelect(app)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 4px", borderRadius: 16, border: "none", background: "transparent", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${accent}22, ${accent}11)`, border: `1px solid ${accent}33`, display: "flex", alignItems: "center", justifyContent: "center" }}><IconComponent size={24} color={accent} strokeWidth={1.8} /></div>
            <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,.55)", textAlign: "center", lineHeight: 1.2, maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.name}</span>
          </button>);
        })}
      </div>}

      {/* LEGACY: keep original map for drag-drop to not break — hidden */}
      <div style={{display:"none"}}>
        {homeApps.map((app, idx) => {
          const IconComponent = ICON_MAP[app.icon] || Sparkles;
          const accent = APP_COLORS[app.id] || "#a78bfa";
          const isDragged = dragging === idx;
          const isTarget = dragOver === idx && dragging !== null && dragging !== idx;
          return (
            <button
              key={app.id}
              data-app-idx={idx}
              onTouchStart={(e) => handleTouchStart(idx, e)}
              onClick={() => { if (dragging === null) onAppSelect(app); }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                padding: "12px 4px",
                borderRadius: 20,
                border: isTarget ? "2px dashed rgba(139,92,246,.6)" : "none",
                background: isDragged ? "rgba(139,92,246,.15)" : "transparent",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                WebkitUserSelect: "none",
                opacity: isDragged ? 0.6 : 1,
                transform: isDragged ? "scale(1.08)" : "scale(1)",
                transition: "all .15s"
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: `linear-gradient(135deg, ${accent}22, ${accent}11)`,
                border: `1px solid ${accent}33`,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "transform .15s",
                backdropFilter: "blur(8px)"
              }}>
                <IconComponent size={26} color={accent} strokeWidth={1.8} />
              </div>
              <span style={{
                fontSize: 11, fontWeight: 500, textAlign: "center",
                color: "rgba(255,255,255,.6)",
                lineHeight: 1.2, maxWidth: 76, overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap"
              }}>
                {app.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* ⬡B:FEATURE:all_apps_drawer:20260409⬡ "All Apps" button */}
      {!appSearch && <button onClick={() => setDrawerOpen(true)} style={{
        margin: "12px auto 8px", padding: "10px 24px", borderRadius: 14,
        border: "1px solid rgba(139,92,246,.2)", background: "rgba(139,92,246,.06)",
        color: "rgba(139,92,246,.8)", cursor: "pointer", fontSize: 13, fontWeight: 600,
        display: "flex", alignItems: "center", gap: 8, backdropFilter: "blur(8px)"
      }}><LayoutList size={14} /> All Apps</button>}

      {/* App Drawer overlay */}
      {drawerOpen && <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,.7)", backdropFilter: "blur(12px)", display: "flex", flexDirection: "column" }} onClick={() => setDrawerOpen(false)}>
        <div onClick={e => e.stopPropagation()} style={{ marginTop: "auto", maxHeight: "75vh", background: "rgba(20,16,32,.98)", borderRadius: "24px 24px 0 0", padding: "16px 16px calc(24px + env(safe-area-inset-bottom, 0px))", overflow: "hidden", display: "flex", flexDirection: "column", border: "1px solid rgba(139,92,246,.15)", boxShadow: "0 -8px 32px rgba(0,0,0,.5)" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,.15)", margin: "0 auto 12px" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ color: "rgba(255,255,255,.9)", fontSize: 18, fontWeight: 700, margin: 0 }}>All Apps</h3>
            <button onClick={() => setDrawerOpen(false)} style={{ width: 32, height: 32, borderRadius: 10, border: "none", background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
          </div>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: 10, color: "rgba(255,255,255,.3)", pointerEvents: "none" }} />
            <input
              value={appSearch}
              onChange={e => setAppSearch(e.target.value)}
              placeholder="Search apps..."
              autoFocus
              style={{ width: "100%", padding: "10px 12px 10px 34px", borderRadius: 12, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.04)", color: "rgba(255,255,255,.8)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, padding: "4px 0" }}>
            {(appSearch ? filteredApps : apps).map((app, idx) => {
              const IC = ICON_MAP[app.icon] || Sparkles;
              const ac = APP_COLORS[app.id] || "#a78bfa";
              return (
                <button key={app.id} onClick={() => { setDrawerOpen(false); setAppSearch(""); onAppSelect(app); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "10px 4px", borderRadius: 16, border: "none", background: "transparent", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg, ${ac}22, ${ac}11)`, border: `1px solid ${ac}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <IC size={22} color={ac} strokeWidth={1.8} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,.55)", textAlign: "center", lineHeight: 1.2, maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>}
    </div>
  );
}

// ⬡B:roadmap.tier3:COMPONENT:barcode_scanner:20260323⬡
// NURA barcode scanner. Uses native BarcodeDetector API (Chrome Android, Safari iOS).
// Falls back to manual barcode entry if API unavailable.
function BarcodeScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [manual, setManual] = useState("");
  const [supported] = useState(() => typeof window !== "undefined" && "BarcodeDetector" in window);
  const streamRef = useRef(null);
  
  useEffect(() => {
    if (!supported) return;
    let detecting = true;
    
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        
        const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"] });
        
        const scan = async () => {
          if (!detecting || !videoRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              detecting = false;
              if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
              onScan(barcodes[0].rawValue);
              return;
            }
          } catch {}
          if (detecting) requestAnimationFrame(scan);
        };
        requestAnimationFrame(scan);
      } catch (e) {
        setError("Camera access denied. Enter barcode manually.");
      }
    })();
    
    return () => {
      detecting = false;
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [supported, onScan]);
  
  return (
    <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.95)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
      <div style={{position:"absolute",top:16,right:16,zIndex:10000}}>
        <button onClick={() => { if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop()); onClose(); }} 
          style={{width:44,height:44,borderRadius:99,border:"none",background:"rgba(255,255,255,.1)",color:"white",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <X size={20}/>
        </button>
      </div>
      
      <p style={{color:"rgba(255,255,255,.6)",fontSize:13,marginBottom:16,fontFamily:"system-ui"}}>
        {supported ? "Point at a barcode" : "Barcode scanner not available on this browser"}
      </p>
      
      {supported && !error && (
        <div style={{position:"relative",width:"85vw",maxWidth:400,aspectRatio:"4/3",borderRadius:16,overflow:"hidden",border:"2px solid rgba(139,92,246,.4)"}}>
          <video ref={videoRef} style={{width:"100%",height:"100%",objectFit:"cover"}} playsInline muted/>
          <div style={{position:"absolute",inset:"20%",border:"2px dashed rgba(139,92,246,.6)",borderRadius:8,pointerEvents:"none"}}/>
        </div>
      )}
      
      {(error || !supported) && (
        <div style={{display:"flex",gap:8,marginTop:16,width:"85vw",maxWidth:400}}>
          <input value={manual} onChange={e=>setManual(e.target.value)} placeholder="Enter barcode number..." 
            style={{flex:1,padding:"12px 16px",borderRadius:12,border:"1px solid rgba(139,92,246,.3)",background:"rgba(255,255,255,.05)",color:"white",fontSize:15,fontFamily:"system-ui"}}
            onKeyDown={e=>{if(e.key==="Enter"&&manual.trim()){onScan(manual.trim())}}}/>
          <button onClick={()=>{if(manual.trim())onScan(manual.trim())}} 
            style={{padding:"12px 20px",borderRadius:12,border:"none",background:"rgba(139,92,246,.4)",color:"white",cursor:"pointer",fontSize:14,fontWeight:600}}>Scan</button>
        </div>
      )}
      
      {error && <p style={{color:"rgba(239,68,68,.8)",fontSize:12,marginTop:12}}>{error}</p>}
      
      <p style={{color:"rgba(255,255,255,.3)",fontSize:11,marginTop:24,fontFamily:"system-ui"}}>
        Powered by NURA (Nutritional Understanding and Research Agent)
      </p>
    </div>
  );
}

// v2.8.0: Conversations via direct Supabase endpoints (not AIR)
async function saveConversation(userId, conv) {
  try {
    const res = await fetch(`${ABABASE}/api/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        id: conv.id, 
        userId, 
        title: conv.title, 
        messages: conv.messages,
        shared: conv.shared,
        projectId: conv.projectId
      })
    });
    return res.ok ? await res.json() : { error: true };
  } catch { return { error: true }; }
}

async function loadConversations(userId) {
  try {
    const res = await fetch(`${ABABASE}/api/conversations?userId=${userId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.conversations || []).map(c => ({
      id: c.id,
      title: c.title,
      messages: c.messages || [],
      shared: c.shared || false,
      archived: c.archived || false,
      createdAt: new Date(c.created_at).getTime(),
      updatedAt: new Date(c.updated_at).getTime(),
      projectId: c.projectId || c.project_id
    }));
  } catch { return []; }
}

async function deleteConversation(userId, convId) {
  try {
    await fetch(`${ABABASE}/api/conversations/${convId}?userId=${userId}`, { method: "DELETE" });
    return { success: true };
  } catch { return { error: true }; }
}

async function archiveConversation(userId, convId) {
  try {
    await fetch(`${ABABASE}/api/conversations/${convId}/archive?userId=${userId}`, { method: "PATCH" });
    return { success: true };
  } catch { return { error: true }; }
}

// SPURT 3: Share chat by email - uses direct endpoint

function AdminPanel({ open, onClose, lastResponse }) {
  if (!open) return null;
  
  const data = lastResponse || window.__lastABAResponse || {};
  const agents = data.agentsUsed || [];
  const tools = data.toolsExecuted || [];
  const duration = data.duration || 0;
  const tokens = data.tokenCount || 0;
  const iterations = data.iterations || 0;
  const gritRan = agents.includes("GRIT");
  
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)" }} />
      <div style={{ position: "relative", width: "100%", maxWidth: 480, maxHeight: "70vh", background: "rgba(12,10,24,.98)", backdropFilter: "blur(24px)", borderRadius: "20px 20px 0 0", border: "1px solid rgba(139,92,246,.2)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ color: "white", fontSize: 16, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Activity size={18} style={{ color: "rgba(139,92,246,.8)" }} />
            Admin Mode
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,.4)", cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>
        
        <div style={{ padding: 20, overflowY: "auto", maxHeight: "calc(70vh - 60px)" }}>
          {/* Stats Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
            <div style={{ padding: 12, background: "rgba(139,92,246,.1)", borderRadius: 12, textAlign: "center" }}>
              <div style={{ color: "rgba(139,92,246,.9)", fontSize: 20, fontWeight: 700 }}>{agents.length}</div>
              <div style={{ color: "rgba(255,255,255,.4)", fontSize: 10, marginTop: 2 }}>Agents</div>
            </div>
            <div style={{ padding: 12, background: "rgba(34,197,94,.1)", borderRadius: 12, textAlign: "center" }}>
              <div style={{ color: "rgba(34,197,94,.9)", fontSize: 20, fontWeight: 700 }}>{tools.length}</div>
              <div style={{ color: "rgba(255,255,255,.4)", fontSize: 10, marginTop: 2 }}>Tools</div>
            </div>
            <div style={{ padding: 12, background: "rgba(245,158,11,.1)", borderRadius: 12, textAlign: "center" }}>
              <div style={{ color: "rgba(245,158,11,.9)", fontSize: 20, fontWeight: 700 }}>{iterations}</div>
              <div style={{ color: "rgba(255,255,255,.4)", fontSize: 10, marginTop: 2 }}>Iterations</div>
            </div>
            <div style={{ padding: 12, background: "rgba(6,182,212,.1)", borderRadius: 12, textAlign: "center" }}>
              <div style={{ color: "rgba(6,182,212,.9)", fontSize: 20, fontWeight: 700 }}>{(duration/1000).toFixed(1)}s</div>
              <div style={{ color: "rgba(255,255,255,.4)", fontSize: 10, marginTop: 2 }}>Duration</div>
            </div>
          </div>
          
          {/* GRIT Alert */}
          {gritRan && (
            <div style={{ padding: 12, background: "rgba(34,197,94,.1)", borderRadius: 12, marginBottom: 16, display: "flex", alignItems: "center", gap: 10, border: "1px solid rgba(34,197,94,.2)" }}>
              <CheckCircle size={18} style={{ color: "rgba(34,197,94,.9)" }} />
              <div>
                <div style={{ color: "rgba(34,197,94,.9)", fontSize: 13, fontWeight: 600 }}>GRIT Agent Ran</div>
                <div style={{ color: "rgba(255,255,255,.4)", fontSize: 11 }}>Attempted up to 8 retries for tools</div>
              </div>
            </div>
          )}
          
          {/* Tools Executed */}
          {tools.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Tools Executed</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {tools.map((tool, i) => {
                  // Handle both string and object formats
                  const toolName = typeof tool === 'string' ? tool : (tool.tool_name || tool.name || 'unknown');
                  const success = typeof tool === 'object' ? tool.result?.success : true;
                  return (
                    <span key={i} style={{ padding: "4px 10px", background: success ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)", borderRadius: 8, color: success ? "rgba(34,197,94,.9)" : "rgba(239,68,68,.9)", fontSize: 11, fontWeight: 500 }}>{toolName}</span>
                  );
                })}
              </div>
            </div>
          )}
          
          {tools.length === 0 && (
            <div style={{ padding: 12, background: "rgba(245,158,11,.1)", borderRadius: 12, marginBottom: 16, display: "flex", alignItems: "center", gap: 10, border: "1px solid rgba(245,158,11,.2)" }}>
              <AlertTriangle size={18} style={{ color: "rgba(245,158,11,.9)" }} />
              <div>
                <div style={{ color: "rgba(245,158,11,.9)", fontSize: 13, fontWeight: 600 }}>No Tools Executed</div>
                <div style={{ color: "rgba(255,255,255,.4)", fontSize: 11 }}>Response generated from FCW only</div>
              </div>
            </div>
          )}
          
          {/* Agents List */}
          <div>
            <div style={{ color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Agents Loaded ({agents.length})</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxHeight: 120, overflowY: "auto" }}>
              {agents.map((agent, i) => (
                <span key={i} style={{ padding: "3px 8px", background: "rgba(139,92,246,.1)", borderRadius: 6, color: "rgba(139,92,246,.7)", fontSize: 10, fontWeight: 500 }}>{agent}</span>
              ))}
            </div>
          </div>
          
          {/* Token Count */}
          <div style={{ marginTop: 16, padding: 12, background: "rgba(255,255,255,.03)", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "rgba(255,255,255,.4)", fontSize: 11 }}>Tokens Used</span>
            <span style={{ color: "rgba(255,255,255,.7)", fontSize: 13, fontWeight: 600 }}>{tokens.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMAND CENTER — Full system dashboard (HAM-only, calls backend)
// ═══════════════════════════════════════════════════════════════════════════
function Blob({state="idle",size=160}){
  return <ABAPresence state={state} size={size} />;
}

// ═══════════════════════════════════════════════════════════════════════════
// BACKGROUNDS
// ═══════════════════════════════════════════════════════════════════════════
const BG={blackLandscape:{u:"https://i.imgur.com/ZwVdgzN.jpeg",l:"Dark Horizon"},eventHorizon:{u:"https://i.imgur.com/A44TxCq.jpeg",l:"Event Horizon"},nebula:{u:"https://i.imgur.com/nLBRQ82.jpeg",l:"Nebula"},stormClouds:{u:"https://i.imgur.com/RRKjvgR.jpeg",l:"Storm Clouds"},wetCity:{u:"https://i.imgur.com/h8zNCw1.jpeg",l:"Wet City"},embers:{u:"https://i.imgur.com/9HZYnlX.png",l:"Embers"},earth:{u:"https://i.imgur.com/NOXQ3aM.png",l:"Earth"},pinkSmoke:{u:"https://i.imgur.com/3RkebB2.jpeg",l:"Pink Smoke"},mountainSnow:{u:"https://i.imgur.com/7Ffjcy2.png",l:"Mountain Snow"},motion:{u:"https://i.imgur.com/3hG18cp.jpeg",l:"Motion"},glassWindows:{u:"https://i.imgur.com/Kjjs7nt.jpeg",l:"Glass Windows"},particleLights:{u:"https://i.imgur.com/wLi9sGD.jpeg",l:"Particle Lights"},beach:{u:"https://i.imgur.com/YaH4lbp.jpeg",l:"Beach"},unity:{u:"https://i.imgur.com/IJAeq7t.png",l:"Unity"},threeGoats:{u:"https://i.imgur.com/jNJUq4u.png",l:"Three Goats"}};

// ═══════════════════════════════════════════════════════════════════════════
// TOAST - v1.2.0: Consumer-ready messages (NO tech jargon)
// ═══════════════════════════════════════════════════════════════════════════
function Toast({message,type="info",onClose}){
  useEffect(()=>{const t=setTimeout(onClose,4000);return()=>clearTimeout(t)},[onClose]);
  const colors={error:"#EF4444",success:"#22C55E",warning:"#F59E0B",info:"#8B5CF6",offline:"#6B7280"};
  const icons={error:AlertTriangle,success:CheckCircle,warning:AlertTriangle,info:Sparkles,offline:WifiOff};
  const Icon=icons[type]||Sparkles;
  return(<div style={{position:"fixed",bottom:100,left:"50%",transform:"translateX(-50%)",padding:"14px 20px",borderRadius:16,background:colors[type],color:"white",fontSize:14,fontWeight:500,zIndex:200,boxShadow:"0 4px 20px rgba(0,0,0,.4)",animation:"mf .3s ease",display:"flex",alignItems:"center",gap:10}}>
    <Icon size={18}/>{message}
  </div>);
}

// v1.2.0: Connection status indicator
function ConnectionStatus({online}){
  if(online)return null;
  return(<div style={{position:"fixed",top:60,left:"50%",transform:"translateX(-50%)",padding:"8px 16px",borderRadius:20,background:"rgba(107,114,128,0.9)",color:"white",fontSize:12,fontWeight:500,display:"flex",alignItems:"center",gap:8,zIndex:150,backdropFilter:"blur(8px)"}}>
    <WifiOff size={14}/>Reconnecting...
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════
// MARKDOWN RENDERER
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// OUTPUT CARD
// ═══════════════════════════════════════════════════════════════════════════
function OutputCard({output}){const[exp,setExp]=useState(false);const icons={email:Mail,calendar:Calendar,call:Phone,omi:Headphones,sms:MessageCircle,doc:FileText,task:CheckCircle};const Icon=icons[output.type]||Zap;
  return(<div style={{background:"rgba(255,255,255,.05)",backdropFilter:"blur(16px)",border:"1px solid rgba(255,255,255,.1)",borderRadius:16,padding:"14px 16px",margin:"6px 0",boxShadow:"0 4px 20px rgba(0,0,0,.2)"}}>
    <div onClick={()=>setExp(!exp)} style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}><div style={{width:32,height:32,borderRadius:10,background:"rgba(139,92,246,.15)",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon size={16} style={{color:"#8B5CF6"}}/></div><div style={{flex:1}}><div style={{color:"rgba(255,255,255,.9)",fontWeight:600,fontSize:13}}>{output.title}</div>{output.subtitle&&<div style={{color:"rgba(255,255,255,.4)",fontSize:11}}>{output.subtitle}</div>}</div><ChevronRight size={14} style={{color:"rgba(255,255,255,.3)",transform:exp?"rotate(90deg)":"none",transition:".2s"}}/></div>
    {exp&&output.preview&&<div style={{marginTop:10,padding:"10px 12px",background:"rgba(0,0,0,.2)",borderRadius:10,color:"rgba(255,255,255,.6)",fontSize:12,lineHeight:1.5}}>{output.preview}</div>}
    {exp&&output.actions&&<div style={{display:"flex",gap:8,marginTop:10}}><button style={{flex:1,padding:"8px 0",borderRadius:10,border:"none",cursor:"pointer",background:"rgba(34,197,94,.2)",color:"rgba(34,197,94,.9)",fontWeight:600,fontSize:12}}>Confirm</button><button style={{flex:1,padding:"8px 0",borderRadius:10,border:"none",cursor:"pointer",background:"rgba(239,68,68,.12)",color:"rgba(239,68,68,.7)",fontWeight:600,fontSize:12}}>Dismiss</button></div>}
  </div>)}

// ═══════════════════════════════════════════════════════════════════════════
// BUBBLE
// ═══════════════════════════════════════════════════════════════════════════
function Bubble({msg,userPhoto,onSpeak}){const isU=msg.role==="user";const time=msg.timestamp?new Date(msg.timestamp).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}):"";
  const isImg=t=>(t||"").startsWith("image/");
  return(<div style={{display:"flex",justifyContent:isU?"flex-end":"flex-start",padding:"4px 0",gap:10,alignItems:"flex-end"}}>
    {!isU&&<div style={{width:28,height:28,borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><ABALogo size={28} glow/></div>}
    <div style={{maxWidth:"80%"}}><div style={{padding:"12px 16px",borderRadius:isU?"20px 20px 6px 20px":"20px 20px 20px 6px",background:isU?"linear-gradient(135deg,rgba(139,92,246,.35),rgba(99,102,241,.3))":"rgba(255,255,255,.08)",minHeight:isU?undefined:24,backdropFilter:"blur(12px)",border:`1px solid ${isU?"rgba(139,92,246,.3)":"rgba(255,255,255,.1)"}`,boxShadow:isU?"0 4px 16px rgba(139,92,246,.15)":"inset 0 1px 1px rgba(255,255,255,.08), 0 4px 12px rgba(0,0,0,.15)"}}>{msg.output?<OutputCard output={msg.output}/>:<div>{renderMd(msg.content)||(!msg.role?.includes("user")&&msg.streaming?<span style={{color:"rgba(255,255,255,.3)",fontSize:12}}>Thinking...</span>:null)}</div>}
      {/* ⬡B:MYABA:FILE_ATTACHMENTS_DISPLAY:20260319⬡ */}
      {msg.attachments&&msg.attachments.length>0&&(
      <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:6}}>
        {msg.attachments.map((att,i)=>(
          att.url?(
            isImg(att.type)?(
              <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" style={{display:"block",borderRadius:8,overflow:"hidden",maxWidth:280}}>
                <img src={att.url} alt={att.name} style={{width:"100%",maxHeight:200,objectFit:"cover",borderRadius:8,display:"block"}} onError={e=>{e.target.style.display="none"}}/>
                <span style={{fontSize:9,color:"rgba(255,255,255,.3)",marginTop:2,display:"block"}}>{att.name}</span>
              </a>
            ):(
              <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" download={att.name} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",textDecoration:"none",cursor:"pointer"}}>
                <FileText size={16} style={{color:"rgba(139,92,246,.7)",flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{color:"rgba(255,255,255,.8)",fontSize:11,fontWeight:500,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{att.name}</p>
                  <p style={{color:"rgba(255,255,255,.3)",fontSize:9,margin:0}}>{att.type?.split("/")[1]?.toUpperCase()||"FILE"} · {att.size?Math.round(att.size/1024)+"KB":""}</p>
                </div>
                <Download size={12} style={{color:"rgba(255,255,255,.3)",flexShrink:0}}/>
              </a>
            )
          ):(
            <div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:6,background:"rgba(255,255,255,.04)"}}>
              <File size={12} style={{color:"rgba(255,255,255,.3)"}}/>
              <span style={{color:"rgba(255,255,255,.5)",fontSize:10}}>{att.name} ({att.size?Math.round(att.size/1024)+"KB":""})</span>
            </div>
          )
        ))}
      </div>
      )}
      {!isU&&msg.content&&onSpeak&&<button onClick={()=>onSpeak(msg.content)} style={{marginTop:10,display:"flex",alignItems:"center",gap:5,padding:"6px 10px",borderRadius:10,border:"1px solid rgba(139,92,246,.2)",background:"rgba(139,92,246,.08)",color:"rgba(139,92,246,.8)",cursor:"pointer",fontSize:11,fontWeight:500,transition:"all .2s"}}><Volume2 size={12}/>Play</button>}
    </div>
      {time&&<div style={{fontSize:10,color:"rgba(255,255,255,.25)",marginTop:4,textAlign:isU?"right":"left",padding:"0 4px"}}>{time}{msg.isVoice&&" · voice"}{msg.attachments&&msg.attachments.length>0&&` · ${msg.attachments.length} file${msg.attachments.length>1?"s":""}`}</div>}</div>
    {isU&&<div style={{width:28,height:28,borderRadius:99,overflow:"hidden",flexShrink:0,background:"linear-gradient(135deg,rgba(139,92,246,.4),rgba(99,102,241,.3))",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(139,92,246,.2)"}}>{userPhoto?<img src={userPhoto} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<User size={13} style={{color:"rgba(255,255,255,.7)"}}/>}</div>}
  </div>)}

function Typing(){return(<div style={{display:"flex",justifyContent:"flex-start",padding:"3px 0",gap:8,alignItems:"flex-end"}}><div style={{width:26,height:26,borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><ABALogo size={26} glow/></div><div style={{padding:"12px 18px",borderRadius:"18px 18px 18px 4px",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",display:"flex",gap:5,alignItems:"center"}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:99,background:"rgba(139,92,246,.6)",animation:`mp 1.4s ease-in-out ${i*.2}s infinite`}}/>)}</div></div>)}

// ═══════════════════════════════════════════════════════════════════════════
// ELEVENLABS CONVERSATIONAL AI - Talk to ABA
// ⬡B:MYABA:ELEVENLABS_VOICE:20260320⬡
// Same agent + webhook as VARA phone calls. WebRTC-based, not MediaRecorder.
// ═══════════════════════════════════════════════════════════════════════════
// TALK TO ABA - ElevenLabs Conversational AI via useConversation hook
// ⬡B:MYABA:TALK_TO_ABA:ELEVENLABS_SDK:20260321⬡
// Same agent as VARA phone calls. WebRTC audio. Full custom UI. No widget.
// ═══════════════════════════════════════════════════════════════════════════
function TalkToABA({userId}){
  const[orbState,setOrbState]=useState("idle"); // idle | connecting | listening | thinking | speaking | error
  const[statusText,setStatusText]=useState("Tap the orb to start talking");
  const[lastMsg,setLastMsg]=useState("");
  const[errorMsg,setErrorMsg]=useState("");
  const thinkTimerRef=useRef(null);

  const conversation=useConversation({
    onConnect:()=>{setOrbState("listening");setStatusText("Listening...");setErrorMsg("")},
    onDisconnect:()=>{setOrbState("idle");setStatusText("Tap the orb to start talking")},
    onError:(msg)=>{console.error("[TALK] ElevenLabs error:",msg);setOrbState("error");setErrorMsg(String(msg));setStatusText("Error. Tap to retry.")},
    onMessage:({message,source})=>{
      if(source==="user"){setOrbState("thinking");setStatusText("ABA is thinking...");setLastMsg("")}
      if(source==="ai"){
        setLastMsg(prev=>{const next=prev+message;
          // Fire real-time caption event so ClosedCaptions overlay shows during speech
          window.dispatchEvent(new CustomEvent("vara-caption",{detail:{text:next.slice(-150),source:"ABA"}}));
          return next;
        });
      }
    },
    onModeChange:({mode})=>{
      clearTimeout(thinkTimerRef.current);
      if(mode==="speaking"){setOrbState("speaking");setStatusText("ABA is speaking...")}
      else{thinkTimerRef.current=setTimeout(()=>{setOrbState("listening");setStatusText("Listening...")},200)}
    },
    onStatusChange:({status})=>{
      if(status==="connecting"){setOrbState("connecting");setStatusText("Connecting...")}
      if(status==="disconnected"){setOrbState("idle");setStatusText("Tap the orb to start talking")}
    }
  });

  const handleTap=useCallback(async()=>{
    if(orbState==="error"){setOrbState("idle");setStatusText("Tap the orb to start talking");setErrorMsg("");return}
    if(conversation.status==="connected"){
      await conversation.endSession();
      return;
    }
    try{
      setOrbState("connecting");setStatusText("Requesting microphone...");
      await navigator.mediaDevices.getUserMedia({audio:true});
      setStatusText("Connecting to ABA...");
      // ⬡B:voice.audit:FIX:preload_identity:20260330⬡ Warm VARA cache with HAM identity before WebRTC starts
      try{await fetch(ABABASE+"/vara/preload",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId,conversation_id:"webrtc_"+Date.now()})});}catch(pe){console.log("[TALK] Preload failed (non-fatal):",pe.message)}
      await conversation.startSession({
        agentId:"agent_0601khe2q0gben08ws34bzf7a0sa",
        connectionType:"webrtc"
      });
    }catch(err){
      console.error("[TALK] Start failed:",err);
      setOrbState("error");
      setErrorMsg(err.message||"Failed to connect");
      setStatusText(err.name==="NotAllowedError"?"Microphone access denied. Check browser settings.":"Connection failed. Tap to retry.");
    }
  },[conversation,orbState]);

  // ⬡B:MACE.fix:UI:orb_redesign_aba_logo_always:20260411⬡
  // ABA logo ALWAYS visible inside orb. Color and animation change per state.
  // Brandon loves the golden connecting circle — that warmth carries across all states.
  const colors={idle:"180,140,80",connecting:"245,158,11",listening:"139,92,246",thinking:"245,158,11",speaking:"16,185,129",error:"239,68,68"};
  const c=colors[orbState]||colors.idle;
  const labels={idle:"TAP TO TALK",connecting:"CONNECTING",listening:"LISTENING",thinking:"THINKING",speaking:"SPEAKING",error:"ERROR"};
  const isActive=orbState!=="idle"&&orbState!=="error";
  const isSpinning=orbState==="connecting"||orbState==="thinking";
  const breatheSpeed=orbState==="listening"?"1s":orbState==="speaking"?"1.5s":orbState==="connecting"?"0.8s":"3s";

  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flex:1,position:"relative"}}>
      {/* Pulsing rings */}
      <div style={{position:"absolute",width:220,height:220,borderRadius:"50%",border:`1px solid rgba(${c},.12)`,animation:isActive?"pulse 2s ease-out infinite":"none",opacity:.5,pointerEvents:"none"}}/>
      <div style={{position:"absolute",width:300,height:300,borderRadius:"50%",border:`1px solid rgba(${c},.08)`,animation:isActive?"pulse 2s ease-out .5s infinite":"none",opacity:.3,pointerEvents:"none"}}/>
      <div style={{position:"absolute",width:380,height:380,borderRadius:"50%",border:`1px solid rgba(${c},.05)`,animation:isActive?"pulse 2s ease-out 1s infinite":"none",opacity:.2,pointerEvents:"none"}}/>

      {/* Main orb — ALWAYS shows ABA logo */}
      <button onClick={handleTap} style={{
        width:160,height:160,borderRadius:"50%",border:"none",cursor:"pointer",
        background:`radial-gradient(circle at 30% 30%, rgba(${c},.5), rgba(${c},.25))`,
        boxShadow:`0 0 80px rgba(${c},.4), inset 0 0 40px rgba(255,255,255,.1)`,
        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,color:"white",
        animation:`breathe ${breatheSpeed} ease-in-out infinite`,
        transition:"all .5s"
      }}>
        <div style={{animation:isSpinning?"spin 1.5s linear infinite":"none",transition:"all .3s"}}>
          <ABALogo size={48} glow color="white"/>
        </div>
        <span style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",opacity:.9}}>{labels[orbState]}</span>
      </button>

      {/* Status */}
      <div style={{position:"absolute",bottom:80,display:"flex",flexDirection:"column",alignItems:"center",gap:8,maxWidth:300}}>
        <p style={{color:`rgba(${c},.8)`,fontSize:13,textAlign:"center",margin:0,fontWeight:500}}>{statusText}</p>
        {orbState==="listening"&&<div style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:"rgba(139,92,246,.9)",animation:"mb 1s ease infinite"}}/>
          <span style={{color:"rgba(139,92,246,.8)",fontSize:11,fontWeight:600}}>LIVE</span>
        </div>}
        {conversation.status==="connected"&&<button onClick={()=>conversation.endSession()} style={{padding:"6px 16px",borderRadius:8,border:"1px solid rgba(239,68,68,.2)",background:"rgba(239,68,68,.08)",color:"rgba(239,68,68,.7)",cursor:"pointer",fontSize:11,fontWeight:500}}>End Conversation</button>}
        {errorMsg&&<p style={{color:"rgba(239,68,68,.6)",fontSize:11,textAlign:"center",margin:0}}>{errorMsg}</p>}
      </div>

      {/* Last response */}
      {lastMsg&&<div style={{position:"absolute",bottom:20,left:16,right:16,padding:"12px 16px",background:"rgba(0,0,0,.6)",backdropFilter:"blur(12px)",borderRadius:16,border:`1px solid rgba(${c},.2)`,transition:"all .3s",maxHeight:200,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
          <ABALogo size={14}/>
          <span style={{color:`rgba(${c},.7)`,fontSize:9,fontWeight:600}}>{orbState==="speaking"?"ABA IS SAYING":orbState==="thinking"?"ABA IS THINKING":"ABA SAID"}</span>
          {orbState==="speaking"&&<div style={{width:6,height:6,borderRadius:3,background:`rgba(${c},.8)`,animation:"mb 1s ease infinite"}}/>}
        </div>
        <p style={{color:"rgba(255,255,255,.8)",fontSize:12,margin:0,lineHeight:1.5,maxHeight:80,overflow:"auto"}}>{lastMsg}</p>
      </div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FIRST LOGIN TOUR - Voice + Tooltip guided walkthrough
// ⬡B:MYABA:FIRST_LOGIN_TOUR:20260320⬡
// Shows on first login. ABA speaks + highlights each tab. Skip anytime.
// ═══════════════════════════════════════════════════════════════════════════
function FirstLoginTour({user,onComplete}){
  const[step,setStep]=useState(0);
  const[speaking,setSpeaking]=useState(false);
  const audioRef=useRef(null);

  const firstName=(user?.displayName||user?.email||"").split(/[\s@]/)[0]||"friend";

  const STEPS=[
    {tab:"welcome",title:"Welcome to ABA",body:`Hey ${firstName}. I'm ABA, your life assistant. Let me show you around real quick. This will take about 60 seconds. Tap Next to continue or Skip anytime.`,voice:`Hey ${firstName}. I'm ABA, your life assistant. Let me show you around. This will take about 60 seconds.`},
    {tab:"chat",title:"Chat",body:"This is Chat. Talk to me about anything here. Ask questions, give me tasks, or just have a conversation. I remember our history and learn your preferences over time.",voice:"This is Chat. Talk to me about anything. I remember our conversations and learn your preferences."},
    {tab:"briefing",title:"Briefing",body:"This is your Briefing. Every morning I'll summarize what happened overnight, what's pending, and what's on your calendar. Your personal morning report.",voice:"Briefing is your morning report. I'll tell you what happened, what needs attention, and what's coming up."},
    {tab:"jobs",title:"Jobs",body:"This is Jobs. Your job matches live here with cover letters and resumes ready for each one. Tap a job to apply. I'll walk you through the whole process and prep you for interviews.",voice:"Jobs has your matched roles with cover letters and resumes ready. Tap any job to apply. I'll prep you for interviews too."},
    {tab:"memos",title:"Memos",body:"This is Memos. Send messages to Brandon and the team through me. Think of it like internal DMs. You'll see a welcome message waiting for you.",voice:"Memos is how you message the team through me. Check your inbox, there's a welcome message from Brandon."},
    {tab:"email",title:"Connect Your Email",body:"One more thing. To get the most out of ABA, connect your email. This lets me send emails on your behalf, check your inbox, and manage your calendar. Tap the button below to connect with Google.",voice:"One more thing. Connect your email so I can help you with emails and calendar. Tap Connect Email below.",action:"connect_email"},
    {tab:"done",title:"You're all set",body:`That's the basics, ${firstName}. Explore each tab and talk to me whenever you need anything. I'm always here.`,voice:`That's the basics. Explore each tab and talk to me whenever you need anything. I'm always here, ${firstName}.`}
  ];

  const currentStep=STEPS[step];

  // Speak each step
  useEffect(()=>{
    if(!currentStep?.voice)return;
    let cancelled=false;
    (async()=>{
      setSpeaking(true);
      try{
        const res=await fetch(`${ABABASE}/api/voice/synthesize`,{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({text:currentStep.voice,voiceId:"AIFDUhRnM6s61433WMNu"})
        });
        if(res.ok&&!cancelled){
          const data=await res.json();
          if(data.url){
            const audio=new Audio(data.url);
            audioRef.current=audio;
            audio.onended=()=>setSpeaking(false);
            audio.play().catch(()=>setSpeaking(false));
          }else setSpeaking(false);
        }else setSpeaking(false);
      }catch{setSpeaking(false)}
    })();
    return()=>{cancelled=true;if(audioRef.current){audioRef.current.pause();audioRef.current=null}};
  },[step]);

  const next=()=>{
    if(audioRef.current){audioRef.current.pause();audioRef.current=null}
    if(step>=STEPS.length-1){finish()}
    else setStep(s=>s+1);
  };

  const finish=()=>{
    if(audioRef.current){audioRef.current.pause();audioRef.current=null}
    try{localStorage.setItem("myaba_tour_complete","true")}catch{}
    onComplete();
  };

  const tabColors={welcome:"#8B5CF6",chat:"#8B5CF6",briefing:"#F59E0B",jobs:"#10B981",memos:"#3B82F6",done:"#8B5CF6"};
  const color=tabColors[currentStep.tab]||"#8B5CF6";

  return(
    <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(8,8,13,.95)",backdropFilter:"blur(20px)",padding:20}}>
      {/* ABA orb */}
      <div style={{width:100,height:100,borderRadius:"50%",background:`radial-gradient(circle at 30% 30%, ${color}66, ${color}33)`,boxShadow:`0 0 60px ${color}44`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:24,animation:speaking?"breathe 1.5s ease-in-out infinite":"breathe 3s ease-in-out infinite"}}>
        {speaking?<Volume2 size={36} style={{color:"white"}}/>:<ABALogo size={40} color="white"/>}
      </div>

      {/* Step indicator */}
      <div style={{display:"flex",gap:6,marginBottom:16}}>
        {STEPS.map((_,i)=>(
          <div key={i} style={{width:i===step?24:8,height:8,borderRadius:99,background:i===step?color:i<step?`${color}80`:"rgba(255,255,255,.1)",transition:"all .3s"}}/>
        ))}
      </div>

      {/* Card */}
      <div style={{maxWidth:340,width:"100%",padding:"24px 20px",borderRadius:20,background:"rgba(255,255,255,.04)",border:`1px solid ${color}30`,backdropFilter:"blur(12px)"}}>
        <p style={{color,fontSize:11,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",margin:"0 0 8px"}}>{currentStep.title}</p>
        <p style={{color:"rgba(255,255,255,.8)",fontSize:14,lineHeight:1.6,margin:0}}>{currentStep.body}</p>
        {currentStep.action==="connect_email"&&(
          <button onClick={()=>{
            const email=(user?.email||"").toLowerCase();
            const hamId=resolveHamId(email);
            window.open(`${ABABASE}/api/nylas/connect?ham_id=${encodeURIComponent(hamId)}`,"_blank");
          }} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",padding:"14px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#10B981,#059669)",color:"white",cursor:"pointer",fontSize:14,fontWeight:600,marginTop:16,boxShadow:"0 4px 20px rgba(16,185,129,.3)"}}>
            <Mail size={18}/>Connect Email with Google
          </button>
        )}
      </div>

      {/* Buttons */}
      <div style={{display:"flex",gap:12,marginTop:20,width:"100%",maxWidth:340}}>
        <button onClick={finish} style={{flex:0,padding:"12px 20px",borderRadius:12,border:"1px solid rgba(255,255,255,.1)",background:"transparent",color:"rgba(255,255,255,.4)",cursor:"pointer",fontSize:13}}>Skip</button>
        <button onClick={next} style={{flex:1,padding:"12px 20px",borderRadius:12,border:"none",background:`linear-gradient(135deg, ${color}, ${color}cc)`,color:"white",cursor:"pointer",fontSize:14,fontWeight:600,boxShadow:`0 4px 20px ${color}44`}}>
          {step>=STEPS.length-1?"Let's Go":"Next"}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VOICE MODE SELECTOR
// ═══════════════════════════════════════════════════════════════════════════
// SPURT 2: Talk to ABA (renamed from Live)
function VoiceMode({mode,setMode}){const modes=[{k:"chat",i:MessageSquare,l:"Chat"},{k:"talk",i:Radio,l:"Talk"}];
  return(<div style={{display:"flex",gap:3,padding:4,background:"rgba(0,0,0,.25)",borderRadius:10}}>{modes.map(m=>{const a=mode===m.k;const I=m.i;return(<button key={m.k} onClick={()=>setMode(m.k)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"6px 8px",borderRadius:8,border:"none",cursor:"pointer",background:a?"rgba(139,92,246,.25)":"transparent",color:a?"rgba(139,92,246,.95)":"rgba(255,255,255,.35)",fontSize:11,fontWeight:a?600:400,transition:"all .2s",minHeight:36}}><I size={13}/>{m.l}</button>)})}</div>)}

// ═══════════════════════════════════════════════════════════════════════════
// F5: MAIN TAB SWITCHER - Chat | Briefing | Jobs | Approve | References
// ⬡B:MYABA.V2:tabs:20260313⬡ Added References tab
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// EMAIL VIEW - Real Nylas inbox
// ⬡B:MYABA:EMAIL_VIEW:20260321⬡
// Calls backend which calls Nylas. 90% backend, 10% frontend.
// ═══════════════════════════════════════════════════════════════════════════

// ⬡B:CIP:EMAIL_DETAIL:mark_read_ask_aba:20260325⬡
function MainTabSwitcher({tab,setTab}){
  const tabs=[
    {k:"chat",i:MessageSquare,l:"Chat"},
    {k:"briefing",i:Bell,l:"Briefing"},
    {k:"jobs",i:Briefcase,l:"Jobs"},
    {k:"pipeline",i:Activity,l:"Pipeline"},
    {k:"memos",i:Mail,l:"Memos"},
    {k:"email",i:Mail,l:"Email"},
    {k:"approve",i:CheckCircle,l:"Approve"}
  ];
  return(<div style={{display:"flex",gap:2,padding:4,background:"rgba(0,0,0,.4)",borderRadius:12,marginBottom:8}}>
    {tabs.map(t=>{const a=tab===t.k;const I=t.i;return(
      <button key={t.k} onClick={()=>setTab(t.k)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"10px 8px",borderRadius:10,border:"none",cursor:"pointer",background:a?"rgba(139,92,246,.25)":"transparent",color:a?"rgba(139,92,246,.95)":"rgba(255,255,255,.4)",fontSize:12,fontWeight:a?600:500,transition:"all .2s"}}>
        <I size={14}/>{t.l}
      </button>
    )})}
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════
// F5: BRIEFING VIEW - What happened, what's pending, what she handled
// ═══════════════════════════════════════════════════════════════════════════
// ⬡B:MYABA:BRIEFING_SETUP:20260321⬡ New user preference collection
function Login({onLogin}){
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState(null);
  const[greeting,setGreeting]=useState({greeting:"ABA",context:"A Better AI",proactive:null});
  
  useEffect(()=>{
    // v1.2.2: DAWN greeting - but don't let stale/long data break UI
    getDawnGreeting("guest","").then(g=>{
      if(g){
        // Truncate greeting if too long
        const safeGreeting = {
          greeting: (g.greeting || "ABA").substring(0, 100),
          context: (g.context || "").substring(0, 80),
          proactive: g.proactive ? g.proactive.substring(0, 150) : null
        };
        setGreeting(safeGreeting);
      }
    }).catch(()=>{});
  },[]);

  const go=async()=>{setLoading(true);setError(null);try{const result=await signInGoogle();if(result&&result.user)onLogin(result.user)}catch(e){setError(e.message)}finally{setLoading(false)}};

  return(<div style={{position:"fixed",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#08080d",fontFamily:"'SF Pro Display',-apple-system,sans-serif",overflow:"auto"}}>
    <div style={{position:"absolute",inset:0,backgroundImage:`url(${BG.pinkSmoke.u})`,backgroundSize:"cover",backgroundPosition:"center",filter:"brightness(.3) saturate(.6)",animation:"kenBurns 30s ease-in-out infinite"}}/>
    <div style={{position:"relative",zIndex:2,textAlign:"center",maxWidth:360,padding:"24px",margin:"auto"}}>
      <div style={{marginBottom:24}}><Blob state="idle" size={100}/></div>
      <h1 style={{color:"white",fontSize:24,fontWeight:700,margin:"0 0 8px",background:"linear-gradient(135deg,#8B5CF6,#6366F1,#EC4899)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{greeting.greeting||"ABA"}</h1>
      <p style={{color:"rgba(255,255,255,.6)",fontSize:13,margin:"0 0 16px",lineHeight:1.4,maxHeight:60,overflow:"hidden"}}>{greeting.context||""}</p>
      {greeting.proactive&&<div style={{background:"rgba(139,92,246,.1)",border:"1px solid rgba(139,92,246,.2)",borderRadius:10,padding:"8px 12px",marginBottom:16,textAlign:"left",maxHeight:80,overflow:"hidden"}}>
        <p style={{color:"rgba(139,92,246,.9)",fontSize:11,margin:0,lineHeight:1.4}}>{greeting.proactive}</p>
      </div>}
      <button onClick={go} disabled={loading} style={{width:"100%",padding:"14px 20px",borderRadius:14,border:"1px solid rgba(255,255,255,.1)",cursor:loading?"wait":"pointer",background:loading?"rgba(255,255,255,.05)":"linear-gradient(135deg,rgba(139,92,246,.3),rgba(99,102,241,.25))",color:"white",fontSize:15,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:10,boxShadow:"0 4px 20px rgba(139,92,246,.2)",minHeight:52}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        {loading?"Signing in...":"Sign in with Google"}
      </button>
      {error&&<p style={{color:"#EF4444",fontSize:12,marginTop:12}}>{error}</p>}
      <p style={{color:"rgba(255,255,255,.15)",fontSize:10,marginTop:20}}>v2.16.2</p>
    </div>
  </div>)}

// ═══════════════════════════════════════════════════════════════════════════
// SIDEBAR — v2.2.0: Chats + Projects + Share
// ═══════════════════════════════════════════════════════════════════════════
function Sidebar({open,convos,activeId,onSelect,onCreate,onClose,onDelete,onArchive,onShare,projects,activeProject,onSelectProject,onCreateProject,onProjectDetail,user}){
  const[search,setSearch]=useState("");
  const[showArchived,setShowArchived]=useState(false);
  const[tab,setTab]=useState("chats"); // "chats" or "projects"
  
  if(!open)return null;
  
  const filtered = convos.filter(c=>{
    const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase());
    const matchArchive = showArchived ? c.archived : !c.archived;
    return matchSearch && matchArchive;
  });
  const solo=filtered.filter(c=>!c.shared);
  const shared=filtered.filter(c=>c.shared);
  
  return(<div style={{position:"fixed",inset:0,zIndex:80,display:"flex"}}><div style={{width:300,height:"100%",background:"rgba(10,8,20,.97)",backdropFilter:"blur(24px)",borderRight:"1px solid rgba(139,92,246,.12)",display:"flex",flexDirection:"column",padding:"16px 12px"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,padding:"0 4px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:28,height:28,borderRadius:99,overflow:"hidden",background:"rgba(139,92,246,.3)",display:"flex",alignItems:"center",justifyContent:"center"}}>{user?.photoURL?<img src={user.photoURL} alt="" style={{width:"100%",height:"100%"}}/>:<User size={14} style={{color:"rgba(255,255,255,.6)"}}/>}</div><span style={{color:"rgba(255,255,255,.8)",fontSize:13,fontWeight:600}}>{user?.displayName||"User"}</span></div><button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.3)",minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center"}}><X size={18}/></button></div>
    
    {/* Tab switcher: Chats / Projects */}
    <div style={{display:"flex",gap:4,marginBottom:12,background:"rgba(255,255,255,.03)",borderRadius:10,padding:3}}>
      <button onClick={()=>setTab("chats")} style={{flex:1,padding:"8px 12px",borderRadius:8,border:"none",cursor:"pointer",background:tab==="chats"?"rgba(139,92,246,.2)":"transparent",color:tab==="chats"?"rgba(139,92,246,.95)":"rgba(255,255,255,.4)",fontSize:12,fontWeight:600}}>Chats</button>
      <button onClick={()=>setTab("projects")} style={{flex:1,padding:"8px 12px",borderRadius:8,border:"none",cursor:"pointer",background:tab==="projects"?"rgba(139,92,246,.2)":"transparent",color:tab==="projects"?"rgba(139,92,246,.95)":"rgba(255,255,255,.4)",fontSize:12,fontWeight:600}}>Projects</button>
    </div>
    
    {tab==="chats"&&<>
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"rgba(255,255,255,.05)",borderRadius:10,marginBottom:12,border:"1px solid rgba(255,255,255,.06)"}}>
      <Search size={14} style={{color:"rgba(255,255,255,.3)"}}/>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search chats..." style={{flex:1,background:"none",border:"none",outline:"none",color:"rgba(255,255,255,.8)",fontSize:12}}/>
    </div>
    
    <button onClick={()=>{onCreate();onClose()}} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:12,border:"1px solid rgba(139,92,246,.2)",background:"rgba(139,92,246,.08)",color:"rgba(139,92,246,.9)",cursor:"pointer",fontWeight:600,fontSize:13,marginBottom:8,minHeight:44}}><Plus size={16}/>New Chat</button>
    
    <button onClick={()=>setShowArchived(!showArchived)} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:"none",border:"none",cursor:"pointer",color:showArchived?"rgba(139,92,246,.8)":"rgba(255,255,255,.3)",fontSize:11,marginBottom:8}}>
      <Archive size={12}/>{showArchived?"Hide Archived":"Show Archived"}
    </button>
    
    <div style={{flex:1,overflowY:"auto"}}>
      {solo.length>0&&<><div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",marginBottom:4}}><Lock size={11} style={{color:"rgba(255,255,255,.25)"}}/><span style={{color:"rgba(255,255,255,.3)",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Private</span></div>
      {solo.map(c=>(<div key={c.id} style={{display:"flex",alignItems:"center",gap:4,padding:"8px 12px",borderRadius:10,background:c.id===activeId?"rgba(139,92,246,.15)":"transparent",marginBottom:2}}>
        <button onClick={()=>{onSelect(c.id);onClose()}} style={{flex:1,display:"flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:"pointer",color:c.id===activeId?"rgba(255,255,255,.9)":"rgba(255,255,255,.5)",fontSize:12,textAlign:"left",padding:0}}>
          <MessageSquare size={14} style={{flexShrink:0,opacity:.5}}/>
          <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title}</span>
        </button>
        <button onClick={()=>onShare&&onShare(c)} title="Share" style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.2)",padding:4,minWidth:24,minHeight:24,display:"flex",alignItems:"center",justifyContent:"center"}}><Users size={11}/></button>
        <button onClick={()=>onArchive(c.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.2)",padding:4,minWidth:24,minHeight:24,display:"flex",alignItems:"center",justifyContent:"center"}}><Archive size={11}/></button>
        <button onClick={()=>onDelete(c.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(239,68,68,.4)",padding:4,minWidth:24,minHeight:24,display:"flex",alignItems:"center",justifyContent:"center"}}><Trash2 size={11}/></button>
      </div>))}</>}
      
      {shared.length>0&&<><div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",marginTop:12,marginBottom:4}}><Users size={11} style={{color:"rgba(255,255,255,.25)"}}/><span style={{color:"rgba(255,255,255,.3)",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Shared</span></div>
      {shared.map(c=>(<div key={c.id} style={{display:"flex",alignItems:"center",gap:4,padding:"8px 12px",borderRadius:10,background:c.id===activeId?"rgba(139,92,246,.15)":"transparent",marginBottom:2}}>
        <button onClick={()=>{onSelect(c.id);onClose()}} style={{flex:1,display:"flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:"pointer",color:c.id===activeId?"rgba(255,255,255,.9)":"rgba(255,255,255,.5)",fontSize:12,textAlign:"left",padding:0}}>
          <Users size={14} style={{flexShrink:0,opacity:.5}}/>
          <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title}</span>
        </button>
        <button onClick={()=>onShare&&onShare(c)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.2)",padding:4}}><Users size={11}/></button>
        <button onClick={()=>onArchive(c.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.2)",padding:4}}><Archive size={11}/></button>
        <button onClick={()=>onDelete(c.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(239,68,68,.4)",padding:4}}><Trash2 size={11}/></button>
      </div>))}</>}
      
      {filtered.length===0&&<div style={{padding:24,textAlign:"center",color:"rgba(255,255,255,.3)",fontSize:12}}>{search?"No chats match search":"No chats yet"}</div>}
    </div>
    </>}
    
    {/* SPURT 4: Projects Tab */}
    {tab==="projects"&&<>
    <button onClick={onCreateProject} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:12,border:"1px solid rgba(139,92,246,.2)",background:"rgba(139,92,246,.08)",color:"rgba(139,92,246,.9)",cursor:"pointer",fontWeight:600,fontSize:13,marginBottom:12,minHeight:44}}><Plus size={16}/>New Project</button>
    <div style={{flex:1,overflowY:"auto"}}>
      {projects&&projects.length>0?projects.map(p=>(<div key={p.id} style={{padding:"10px 12px",borderRadius:10,background:p.id===activeProject?"rgba(139,92,246,.15)":"transparent",marginBottom:4}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{flex:1,cursor:"pointer",display:"flex",alignItems:"center",gap:8}} onClick={()=>{onSelectProject(p.id);onClose()}}>
            <FileText size={14} style={{color:"rgba(139,92,246,.6)"}}/>
            <span style={{color:"rgba(255,255,255,.8)",fontSize:13,fontWeight:500}}>{p.name}</span>
          </div>
          <button onClick={(e)=>{e.stopPropagation();onProjectDetail&&onProjectDetail(p)}} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.3)",padding:4,minWidth:28,minHeight:28,display:"flex",alignItems:"center",justifyContent:"center"}}><MoreVertical size={14}/></button>
        </div>
        {p.files&&p.files.length>0&&<div style={{marginTop:6,paddingLeft:22}}>
          {p.files.slice(0,3).map((f,i)=>(<div key={i} style={{color:"rgba(255,255,255,.4)",fontSize:11,marginBottom:2}}>{f.name}</div>))}
          {p.files.length>3&&<div style={{color:"rgba(139,92,246,.5)",fontSize:10}}>{p.files.length-3} more files</div>}
        </div>}
      </div>)):<div style={{padding:24,textAlign:"center",color:"rgba(255,255,255,.3)",fontSize:12}}>No projects yet</div>}
    </div>
    </>}
  </div><div onClick={onClose} style={{flex:1,background:"rgba(0,0,0,.4)"}}/></div>)}

// ═══════════════════════════════════════════════════════════════════════════
// SHARE MODAL — Email-based sharing (works before recipient signs up)
// ═══════════════════════════════════════════════════════════════════════════
function ShareModal({ open, onClose, conversation, onShare }) {
  const [emails, setEmails] = useState("");
  const [permission, setPermission] = useState("view"); // view or edit
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(conversation?.sharedWith || []);
  
  if (!open || !conversation) return null;
  
  const handleShare = async () => {
    const emailList = emails.split(/[,\s]+/).filter(e => e.includes("@"));
    if (emailList.length === 0) return;
    setSharing(true);
    try {
      await onShare(conversation.id, emailList, permission);
      setShared([...shared, ...emailList.map(e => ({ email: e, permission }))]);
      setEmails("");
    } catch (e) {
      console.error("Share failed:", e);
    }
    setSharing(false);
  };
  
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.7)" }} />
      <div style={{ position: "relative", width: "90%", maxWidth: 400, background: "rgba(12,10,24,.98)", backdropFilter: "blur(24px)", borderRadius: 20, padding: 24, border: "1px solid rgba(139,92,246,.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: 0 }}>Share Chat</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,.4)", cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>
        
        <p style={{ color: "rgba(255,255,255,.5)", fontSize: 12, margin: "0 0 16px" }}>
          Share "{conversation.title}" with others. They'll get access when they sign in.
        </p>
        
        <div style={{ marginBottom: 16 }}>
          <label style={{ color: "rgba(255,255,255,.6)", fontSize: 11, fontWeight: 600, marginBottom: 6, display: "block" }}>Email addresses (comma separated)</label>
          <input 
            value={emails} 
            onChange={e => setEmails(e.target.value)}
            placeholder="eric@example.com, bj@example.com"
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.05)", color: "white", fontSize: 14, outline: "none" }}
          />
        </div>
        
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button onClick={() => setPermission("view")} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1px solid ${permission === "view" ? "rgba(139,92,246,.4)" : "rgba(255,255,255,.1)"}`, background: permission === "view" ? "rgba(139,92,246,.15)" : "transparent", color: permission === "view" ? "rgba(139,92,246,.9)" : "rgba(255,255,255,.5)", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
            <Eye size={14} style={{ marginRight: 6, verticalAlign: -2 }} />View only
          </button>
          <button onClick={() => setPermission("edit")} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1px solid ${permission === "edit" ? "rgba(139,92,246,.4)" : "rgba(255,255,255,.1)"}`, background: permission === "edit" ? "rgba(139,92,246,.15)" : "transparent", color: permission === "edit" ? "rgba(139,92,246,.9)" : "rgba(255,255,255,.5)", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
            <MessageSquare size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Can reply
          </button>
        </div>
        
        {shared.length > 0 && (
          <div style={{ marginBottom: 16, padding: 12, background: "rgba(255,255,255,.03)", borderRadius: 12 }}>
            <p style={{ color: "rgba(255,255,255,.4)", fontSize: 10, fontWeight: 600, margin: "0 0 8px", textTransform: "uppercase" }}>Shared with</p>
            {shared.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
                <span style={{ color: "rgba(255,255,255,.7)", fontSize: 12 }}>{s.email}</span>
                <span style={{ color: "rgba(139,92,246,.6)", fontSize: 10 }}>{s.permission}</span>
              </div>
            ))}
          </div>
        )}
        
        <button onClick={handleShare} disabled={sharing || !emails.trim()} style={{ width: "100%", padding: "14px 20px", borderRadius: 14, border: "none", background: emails.trim() ? "linear-gradient(135deg, rgba(139,92,246,.5), rgba(99,102,241,.4))" : "rgba(255,255,255,.05)", color: emails.trim() ? "white" : "rgba(255,255,255,.3)", cursor: emails.trim() ? "pointer" : "default", fontSize: 14, fontWeight: 600 }}>
          {sharing ? "Sharing..." : "Share"}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROACTIVE QUEUE
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// NEW CHAT MODAL — Project vs Solo, Private vs Shared flow
// ═══════════════════════════════════════════════════════════════════════════
function NewChatModal({ open, onClose, onCreate, projects, onCreateProject }) {
  const [step, setStep] = useState(1);
  const [chatType, setChatType] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  
  if (!open) return null;
  
  const reset = () => { setStep(1); setChatType(null); setSelectedProject(null); setNewProjectName(""); setShowNewProject(false); };
  const handleClose = () => { reset(); onClose(); };
  
  const handleCreate = (privacy) => {
    const projectId = chatType === "project" ? (showNewProject ? null : selectedProject) : null;
    const projectName = showNewProject ? newProjectName.trim() : null;
    onCreate(privacy === "shared", projectId, projectName);
    handleClose();
  };
  
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={handleClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.7)" }} />
      <div style={{ position: "relative", width: "90%", maxWidth: 380, background: "rgba(12,10,24,.98)", backdropFilter: "blur(24px)", borderRadius: 20, padding: 24, border: "1px solid rgba(139,92,246,.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: 0 }}>{step === 1 ? "New Chat" : (chatType === "project" ? "Project Chat" : "Solo Chat")}</h3>
          <button onClick={handleClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,.4)", cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>
        
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button onClick={() => { setChatType("solo"); setStep(2); }} style={{ padding: "16px 20px", borderRadius: 14, border: "1px solid rgba(139,92,246,.2)", background: "rgba(139,92,246,.08)", color: "white", cursor: "pointer", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}><MessageSquare size={20} style={{ color: "#8B5CF6" }} /><div><div style={{ fontWeight: 600, fontSize: 14 }}>Solo Chat</div><div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", marginTop: 2 }}>Quick conversation</div></div></div>
            </button>
            <button onClick={() => { setChatType("project"); setStep(2); }} style={{ padding: "16px 20px", borderRadius: 14, border: "1px solid rgba(59,130,246,.2)", background: "rgba(59,130,246,.08)", color: "white", cursor: "pointer", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}><FolderPlus size={20} style={{ color: "#3B82F6" }} /><div><div style={{ fontWeight: 600, fontSize: 14 }}>Project Chat</div><div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", marginTop: 2 }}>Organized with files</div></div></div>
            </button>
          </div>
        )}
        
        {step === 2 && chatType === "project" && !showNewProject && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 180, overflowY: "auto", marginBottom: 12 }}>
              {projects?.length > 0 ? projects.map(p => (
                <button key={p.id} onClick={() => setSelectedProject(p.id)} style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${selectedProject === p.id ? "rgba(59,130,246,.4)" : "rgba(255,255,255,.1)"}`, background: selectedProject === p.id ? "rgba(59,130,246,.15)" : "transparent", color: "white", cursor: "pointer", textAlign: "left", fontSize: 13 }}>{p.name}</button>
              )) : <p style={{ color: "rgba(255,255,255,.4)", fontSize: 12, textAlign: "center", padding: 16 }}>No projects yet</p>}
            </div>
            <button onClick={() => setShowNewProject(true)} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px dashed rgba(139,92,246,.3)", background: "transparent", color: "rgba(139,92,246,.7)", cursor: "pointer", fontSize: 13, marginBottom: 16 }}>+ Create New Project</button>
            {selectedProject && <div style={{ display: "flex", gap: 8 }}><button onClick={() => handleCreate("private")} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "none", background: "rgba(139,92,246,.4)", color: "white", cursor: "pointer", fontWeight: 600 }}><Lock size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Private</button><button onClick={() => handleCreate("shared")} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "none", background: "rgba(59,130,246,.4)", color: "white", cursor: "pointer", fontWeight: 600 }}><Users size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Shared</button></div>}
          </>
        )}
        
        {step === 2 && chatType === "project" && showNewProject && (
          <>
            <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="Project name..." style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(139,92,246,.2)", background: "rgba(255,255,255,.05)", color: "white", fontSize: 14, outline: "none", marginBottom: 16, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8 }}><button onClick={() => setShowNewProject(false)} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "1px solid rgba(255,255,255,.1)", background: "transparent", color: "rgba(255,255,255,.6)", cursor: "pointer" }}>Back</button><button onClick={() => handleCreate("private")} disabled={!newProjectName.trim()} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "none", background: newProjectName.trim() ? "rgba(139,92,246,.4)" : "rgba(255,255,255,.1)", color: newProjectName.trim() ? "white" : "rgba(255,255,255,.3)", cursor: newProjectName.trim() ? "pointer" : "default", fontWeight: 600 }}>Create</button></div>
          </>
        )}
        
        {step === 2 && chatType === "solo" && (
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => handleCreate("private")} style={{ flex: 1, padding: "20px 16px", borderRadius: 14, border: "1px solid rgba(139,92,246,.2)", background: "rgba(139,92,246,.08)", color: "white", cursor: "pointer", textAlign: "center" }}><Lock size={24} style={{ color: "#8B5CF6", marginBottom: 8 }} /><div style={{ fontWeight: 600, fontSize: 14 }}>Private</div><div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 4 }}>Just me</div></button>
            <button onClick={() => handleCreate("shared")} style={{ flex: 1, padding: "20px 16px", borderRadius: 14, border: "1px solid rgba(59,130,246,.2)", background: "rgba(59,130,246,.08)", color: "white", cursor: "pointer", textAlign: "center" }}><Users size={24} style={{ color: "#3B82F6", marginBottom: 8 }} /><div style={{ fontWeight: 600, fontSize: 14 }}>Shared</div><div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 4 }}>Team access</div></button>
          </div>
        )}
        
        {step === 2 && <button onClick={() => setStep(1)} style={{ width: "100%", padding: "12px", marginTop: 16, borderRadius: 10, border: "none", background: "transparent", color: "rgba(255,255,255,.4)", cursor: "pointer", fontSize: 12 }}>← Back</button>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJECT DETAIL MODAL — Manage files, rename, delete
// ═══════════════════════════════════════════════════════════════════════════
function ProjectDetailModal({ open, onClose, project, onRename, onDelete, onAddFile, onRemoveFile }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project?.name || "");
  const fileInputRef = useRef(null);
  
  useEffect(() => { if (project) setName(project.name); }, [project]);
  
  if (!open || !project) return null;
  
  const handleRename = () => { if (name.trim() && name !== project.name) { onRename(project.id, name.trim()); } setEditing(false); };
  const handleFileSelect = (e) => { const files = Array.from(e.target.files); files.forEach(f => onAddFile(project.id, f)); e.target.value = ""; };
  
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.7)" }} />
      <div style={{ position: "relative", width: "90%", maxWidth: 420, background: "rgba(12,10,24,.98)", backdropFilter: "blur(24px)", borderRadius: 20, padding: 24, border: "1px solid rgba(139,92,246,.2)", maxHeight: "80vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          {editing ? <input value={name} onChange={e => setName(e.target.value)} onBlur={handleRename} onKeyDown={e => e.key === "Enter" && handleRename()} autoFocus style={{ flex: 1, background: "rgba(255,255,255,.1)", border: "1px solid rgba(139,92,246,.3)", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 18, fontWeight: 700 }} />
            : <h3 onClick={() => setEditing(true)} style={{ color: "white", fontSize: 18, fontWeight: 700, margin: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>{project.name} <Edit2 size={14} style={{ color: "rgba(255,255,255,.3)" }} /></h3>}
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,.4)", cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ color: "rgba(255,255,255,.5)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Files ({project.files?.length || 0})</span>
            <button onClick={() => fileInputRef.current?.click()} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(139,92,246,.3)", background: "rgba(139,92,246,.1)", color: "rgba(139,92,246,.9)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}><Plus size={12} style={{ marginRight: 4, verticalAlign: -1 }} />Add</button>
            <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} style={{ display: "none" }} />
          </div>
          {project.files?.length > 0 ? project.files.map(f => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "rgba(255,255,255,.03)", borderRadius: 10, marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}><File size={14} style={{ color: "rgba(139,92,246,.5)" }} /><span style={{ color: "rgba(255,255,255,.7)", fontSize: 13 }}>{f.name}</span></div>
              <button onClick={() => onRemoveFile(project.id, f.id)} style={{ background: "none", border: "none", color: "rgba(239,68,68,.5)", cursor: "pointer", padding: 4 }}><Trash2 size={14} /></button>
            </div>
          )) : <p style={{ color: "rgba(255,255,255,.3)", fontSize: 12, textAlign: "center", padding: 20 }}>No files yet</p>}
        </div>
        
        <button onClick={() => { onDelete(project.id); onClose(); }} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "1px solid rgba(239,68,68,.3)", background: "rgba(239,68,68,.08)", color: "rgba(239,68,68,.8)", cursor: "pointer", fontSize: 14, fontWeight: 600 }}><Trash2 size={14} style={{ marginRight: 8, verticalAlign: -2 }} />Delete Project</button>
      </div>
    </div>
  );
}

function Queue({open,onToggle,items}){
  const iconMap={briefing:Bell,email:Mail,meeting:Calendar,deadline:AlertTriangle,followup:Clock};const pColors={critical:"#EF4444",high:"#F59E0B",medium:"#3B82F6",low:"#6B7280"};
  if(!open)return(<button onClick={onToggle} style={{position:"fixed",bottom:"calc(90px + env(safe-area-inset-bottom, 0px))",right:14,width:44,height:44,borderRadius:99,background:items.length>0?"linear-gradient(135deg,#8B5CF6,#3B82F6)":"rgba(255,255,255,.08)",border:"none",boxShadow:"0 4px 20px rgba(0,0,0,.3)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",zIndex:50,minWidth:44,minHeight:44}}><Bell size={18}/>{items.length>0&&<div style={{position:"absolute",top:-2,right:-2,width:18,height:18,borderRadius:99,background:"#EF4444",color:"#fff",fontSize:10,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center"}}>{items.length}</div>}</button>);
  return(<div style={{position:"fixed",bottom:"calc(90px + env(safe-area-inset-bottom, 0px))",right:14,width:340,maxWidth:"calc(100vw - 28px)",maxHeight:380,background:"rgba(12,10,24,.97)",backdropFilter:"blur(20px)",borderRadius:16,border:"1px solid rgba(139,92,246,.25)",boxShadow:"0 20px 40px rgba(0,0,0,.4)",overflow:"hidden",zIndex:50,display:"flex",flexDirection:"column"}}>
    <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(139,92,246,.15)",display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(135deg,rgba(139,92,246,.08),rgba(59,130,246,.04))"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}><Bell size={16} style={{color:"#8B5CF6"}}/><span style={{color:"white",fontWeight:600,fontSize:14}}>What ABA Cooked</span><span style={{background:"rgba(139,92,246,.25)",padding:"1px 8px",borderRadius:10,fontSize:11,color:"#C4B5FD"}}>{items.length}</span></div>
      <button onClick={onToggle} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.4)",minWidth:44,minHeight:44,display:"flex",alignItems:"center",justifyContent:"center"}}><X size={16}/></button>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:8}}>{items.length===0?<div style={{padding:24,textAlign:"center",color:"rgba(255,255,255,.3)",fontSize:13}}>All clear. ABA is keeping watch.</div>:items.map((item,idx)=>{const I=iconMap[item.type]||Bell;const col=pColors[item.priority]||"#6B7280";return(<div key={idx} style={{padding:"10px 12px",borderRadius:12,border:`1px solid ${col}25`,background:`${col}08`,marginBottom:6,display:"flex",gap:10,alignItems:"flex-start"}}><div style={{width:28,height:28,borderRadius:8,background:`${col}20`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><I size={14} style={{color:col}}/></div><div style={{flex:1}}><div style={{color:"rgba(255,255,255,.85)",fontSize:12,fontWeight:600}}>{item.title}</div><div style={{color:"rgba(255,255,255,.4)",fontSize:11,marginTop:2}}>{item.summary}</div></div></div>)})}</div>
  </div>)}

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// F7: SETTINGS DRAWER - Full settings panel
// ═══════════════════════════════════════════════════════════════════════════
function MyABAInner(){
  const[user,setUser]=useState(null);const[authLoading,setAuthLoading]=useState(true);
  const[convos,setConvos]=useState([]);const[activeId,setActiveId]=useState(null);
  const activeConv=convos.find(c=>c.id===activeId);const messages=activeConv?.messages||[];
  const[input,setInput]=useState("");const[abaState,setAbaState]=useState("idle");
  const[attachments,setAttachments]=useState([]); // SPURT 5: files attached to message
  const fileInputRef=useRef(null);
  const [scannerOpen,setScannerOpen]=useState(false);
  const[isTyping,setIsTyping]=useState(false);
  // ⬡B:FIX:chat_bubble_collapsed:setMessages_wrapper:20260330⬡
  // messages is derived from convos — streaming updates must route through setConvos
  const setMessages=useCallback((updater)=>{
    setConvos(prev=>prev.map(c=>c.id===activeId?{...c,messages:typeof updater==='function'?updater(c.messages||[]):updater,updatedAt:Date.now()}:c));
  },[activeId]);
  
  // v2.16.1: Settings from backend (fallback to localStorage, then defaults)
  const[bg,setBg]=useState(()=>{try{return localStorage.getItem("myaba_bg")||"pinkSmoke"}catch{return "pinkSmoke"}});
  const[voiceOut,setVoiceOut]=useState(()=>{try{return localStorage.getItem("myaba_voiceOut")!=="false"}catch{return true}});
  const[voiceMode,setVoiceMode]=useState(()=>{try{return localStorage.getItem("myaba_voiceMode")||"chat"}catch{return "chat"}});
  const[settingsLoaded,setSettingsLoaded]=useState(false);
  
  const[settingsOpen,setSettingsOpen]=useState(false);const[sidebarOpen,setSidebarOpen]=useState(false);const[exportMenu,setExportMenu]=useState(false);
  const[mainTab,setMainTab]=useState("home"); // ⬡B:phase3:CIP_LAUNCHER:home_default:20260323⬡
  const[deepLinkMemoId,setDeepLinkMemoId]=useState(null);
  
  // ⬡B:MEMOS:FEAT:deep_link:20260412⬡ URL params: ?tab=memos&memo=UUID
  useEffect(()=>{
    try{
      const params=new URLSearchParams(window.location.search);
      const tab=params.get("tab");
      const memoId=params.get("memo");
      if(tab==="memos"){setMainTab("memos");if(memoId)setDeepLinkMemoId(memoId)}
    }catch(e){}
  },[]);
  const[appScope,setAppScope]=useState(null); // Current app agent scope for AIR calls
  const[briefingData,setBriefingData]=useState(null);
  const[briefingLoading,setBriefingLoading]=useState(false);
  const[shareModal,setShareModal]=useState(null); // conversation being shared
  // v2.16.0: Projects load from backend (not localStorage)
  const[projects,setProjects]=useState([]);
  const[newChatModal,setNewChatModal]=useState(false); // New chat flow modal
  const[projectDetailModal,setProjectDetailModal]=useState(null); // Project detail modal
  const[activeProject,setActiveProject]=useState(null);
  const[queueOpen,setQueueOpen]=useState(false);
  const[isListening,setIsListening]=useState(false);
  const[liveActive,setLiveActive]=useState(false);
  const[viewportHeight,setViewportHeight]=useState(window.innerHeight);
  const[proactiveItems,setProactiveItems]=useState([]);
  const[toast,setToast]=useState(null);
  const[online,setOnline]=useState(navigator.onLine);
  // ⬡B:transcript_item:cc_listener:20260323⬡ Closed caption event listener
  useEffect(()=>{
    const handler=(e)=>{setCaptionText(e.detail?.text||"");setCaptionVisible(true);setTimeout(()=>setCaptionVisible(false),8000);};
    window.addEventListener("vara-caption",handler);
    return()=>window.removeEventListener("vara-caption",handler);
  },[]);
  // v2.15.0: Admin mode for HAM users
  const[adminPanelOpen,setAdminPanelOpen]=useState(false);
  const[commandCenterOpen,setCommandCenterOpen]=useState(false);
  const[lastABAResponse,setLastABAResponse]=useState(null);
  // ⬡B:snap.quick_question:STATE:20260317⬡
  const[snapOpen,setSnapOpen]=useState(false);
  const[proactiveTip,setProactiveTip]=useState(null);
  // ⬡B:AUDRA.C2:FIX:alerts_via_backend:20260403⬡ Routed through backend per 90/10 rule
  useEffect(()=>{
    fetch(`${ABABASE}/api/alerts/hunch`)
      .then(r=>r.json()).then(d=>{const arr=d.alerts||d||[];if(arr&&arr[0]){try{const c=typeof arr[0].content==="string"?JSON.parse(arr[0].content):arr[0].content;setProactiveTip(c.hint||c.message||null)}catch{}}}).catch(()=>{});
  },[]);
  const[captionText,setCaptionText]=useState("");const[captionVisible,setCaptionVisible]=useState(false);
  const[editorDoc,setEditorDoc]=useState(null); // {content, type} for MobileDocEditor from Jobs
  const[snapMessages,setSnapMessages]=useState([]);
  const[snapInput,setSnapInput]=useState("");
  const[snapLoading,setSnapLoading]=useState(false);
  const[snapMigrate,setSnapMigrate]=useState(false);
  // ⬡B:clipboard.history:STATE:20260320⬡
  const[clipboardOpen,setClipboardOpen]=useState(false);
  const[clipboardItems,setClipboardItems]=useState(()=>{try{return JSON.parse(localStorage.getItem("myaba_clipboard")||"[]")}catch{return[]}});
  // v2.16.0: Projects now load from backend
  const[projectsLoading,setProjectsLoading]=useState(false);
  const scrollRef=useRef(null);const recorderRef=useRef(null);const liveRef=useRef(false);

  // v1.2.0: Track online/offline status
  useEffect(()=>{
    const handleOnline=()=>setOnline(true);
    const handleOffline=()=>setOnline(false);
    window.addEventListener("online",handleOnline);
    window.addEventListener("offline",handleOffline);
    return()=>{window.removeEventListener("online",handleOnline);window.removeEventListener("offline",handleOffline)};
  },[]);

  // ⬡B:clipboard.history:LISTENER:20260320⬡
  useEffect(()=>{
    const handleCopy=async()=>{
      try{
        const text=await navigator.clipboard.readText();
        if(text&&text.trim()){
          setClipboardItems(prev=>{
            const deduped=prev.filter(c=>c.text!==text.trim());
            const updated=[{id:`clip_${Date.now()}`,text:text.trim(),copiedAt:new Date().toISOString()},...deduped].slice(0,50);
            try{localStorage.setItem("myaba_clipboard",JSON.stringify(updated))}catch{}
            return updated;
          });
        }
      }catch{/* clipboard read permission denied — no-op */}
    };
    document.addEventListener("copy",handleCopy);
    return()=>document.removeEventListener("copy",handleCopy);
  },[]);

  // v2.16.1: Save settings to localStorage AND backend
  useEffect(()=>{
    try{localStorage.setItem("myaba_bg",bg)}catch{}
    // Save to backend if settings already loaded (prevent overwrite on init)
    if(settingsLoaded&&user?.email){
      airSaveSettings(user.email,{bg}).catch(()=>{});
    }
  },[bg,settingsLoaded,user?.email]);
  useEffect(()=>{
    try{localStorage.setItem("myaba_voiceOut",String(voiceOut))}catch{}
    if(settingsLoaded&&user?.email){
      airSaveSettings(user.email,{voiceOut}).catch(()=>{});
    }
  },[voiceOut,settingsLoaded,user?.email]);
  useEffect(()=>{
    try{localStorage.setItem("myaba_voiceMode",voiceMode)}catch{}
    if(settingsLoaded&&user?.email){
      airSaveSettings(user.email,{voiceMode}).catch(()=>{});
    }
  },[voiceMode,settingsLoaded,user?.email]);
  // v2.16.1: Load settings from backend when user is authenticated
  useEffect(()=>{
    if(user?.email){
      airLoadSettings(user.email).then(result=>{
        if(result.success&&result.settings){
          if(result.settings.bg)setBg(result.settings.bg);
          if(result.settings.voiceOut!==undefined)setVoiceOut(result.settings.voiceOut);
          if(result.settings.voiceMode)setVoiceMode(result.settings.voiceMode);
        }
        setSettingsLoaded(true);
      }).catch(()=>setSettingsLoaded(true));
    }
  },[user?.email]);
  // v2.16.0: Load projects from backend when user is authenticated
  useEffect(()=>{
    if(user?.email){
      setProjectsLoading(true);
      airLoadProjects(user.email).then(result=>{
        if(result.success&&result.projects){
          setProjects(result.projects);
        }
        setProjectsLoading(false);
      }).catch(()=>setProjectsLoading(false));
    }
  },[user?.email]);
  // v2.16.0: Load conversations from backend when user is authenticated
  useEffect(()=>{
    if(user?.email){
      airLoadConversations(user.email).then(result=>{
        if(result.success&&result.conversations&&result.conversations.length>0){
          // Map backend format to local format
          const mapped=result.conversations.map(c=>({
            id:c.id,
            title:c.title||"Untitled",
            shared:false,
            archived:false,
            messages:c.messages||[],
            createdAt:new Date(c.created_at).getTime(),
            updatedAt:new Date(c.updated_at).getTime(),
            autoNamed:true,
            projectId:c.projectId||null
          }));
          setConvos(mapped);
          setActiveId(mapped[0].id);
        }
      }).catch(()=>{});
    }
  },[user?.email]);
  // Mobile keyboard viewport fix - more robust
  useEffect(()=>{
    const handleResize=()=>{
      // Use visualViewport for accurate mobile keyboard detection
      const vh=window.visualViewport?window.visualViewport.height:window.innerHeight;
      setViewportHeight(vh);
      document.documentElement.style.setProperty('--vh',`${vh}px`);
      document.documentElement.style.setProperty('--viewport-height',`${vh}px`);
    };
    handleResize();
    
    // Listen to both visualViewport and window resize
    if(window.visualViewport){
      window.visualViewport.addEventListener('resize',handleResize);
      window.visualViewport.addEventListener('scroll',handleResize);
    }
    window.addEventListener('resize',handleResize);
    window.addEventListener('orientationchange',handleResize);
    
    return()=>{
      if(window.visualViewport){
        window.visualViewport.removeEventListener('resize',handleResize);
        window.visualViewport.removeEventListener('scroll',handleResize);
      }
      window.removeEventListener('resize',handleResize);
      window.removeEventListener('orientationchange',handleResize);
    };
  },[]);
  
  // Scroll input into view when focused (mobile keyboard fix)
  const scrollInputIntoView=useCallback(()=>{
    if(scrollRef.current){
      // Small delay to allow keyboard to appear
      setTimeout(()=>{
        scrollRef.current.scrollTop=scrollRef.current.scrollHeight;
      },300);
    }
  },[]);

  useEffect(()=>{const unsub=onAuthStateChanged(auth,(u)=>{setUser(u);setAuthLoading(false)});return()=>unsub()},[]);
  useEffect(()=>{if(scrollRef.current)scrollRef.current.scrollTop=scrollRef.current.scrollHeight},[messages,isTyping]);

  const showToast=useCallback((message,type="info")=>{setToast({message,type})},[]);

  // v2.16.0: Create conversation via backend
  const createConv=useCallback(async(shared=false,projectId=null)=>{
    const userId=user?.email||user?.uid||"unknown";
    const result=await airCreateConversation(userId,"New Chat",projectId,shared);
    if(result.success&&result.conversation){
      const conv={
        id:result.conversation.id,
        title:result.conversation.title||"New Chat",
        shared,
        archived:false,
        messages:result.conversation.messages||[],
        createdAt:Date.now(),
        updatedAt:Date.now(),
        autoNamed:false,
        projectId
      };
      setConvos(p=>[conv,...p]);
      setActiveId(conv.id);
      return conv.id;
    }
    // Fallback to local-only if backend fails
    const id=`conv-${Date.now()}`;
    const conv={id,title:"New Chat",shared,archived:false,messages:[],createdAt:Date.now(),updatedAt:Date.now(),autoNamed:false,projectId};
    setConvos(p=>[conv,...p]);
    setActiveId(id);
    return id;
  },[user]);
  
  // v2.16.0: Add message via backend
  const addMsg=useCallback(async(msg)=>{
    // Update local state immediately for responsiveness
    setConvos(p=>p.map(c=>c.id===activeId?{...c,messages:[...c.messages,msg],updatedAt:Date.now()}:c));
    // ⬡B:FIX:chat_persistence:always_save:20260321⬡
    // Always sync to backend. If conv- prefix (local fallback), create it on backend first then save.
    if(activeId){
      let backendId=activeId;
      if(String(activeId).startsWith('conv-')){
        // Retry creating on backend
        try{
          const userId=user?.email||user?.uid||"unknown";
          const activeConvLocal=convos.find(c=>c.id===activeId);
          const result=await airCreateConversation(userId,activeConvLocal?.title||"New Chat",activeConvLocal?.projectId,activeConvLocal?.shared||false);
          if(result.success&&result.conversation){
            backendId=result.conversation.id;
            // Swap local ID for backend ID
            setConvos(p=>p.map(c=>c.id===activeId?{...c,id:backendId}:c));
            setActiveId(backendId);
            console.log("[CHAT] Promoted local conv to backend:",backendId);
          }
        }catch(e){console.error("[CHAT] Backend create retry failed:",e)}
      }
      // Skip saving empty streaming placeholders — final content saved in onDone
      if(msg.content)airAddMessage(backendId,msg.role,msg.content).catch(e=>console.error("[CHAT] Save message failed:",e));
    }
  },[activeId,user,convos]);

  // v2.16.0: Delete via backend
  const deleteConv=useCallback(async(id)=>{
    setConvos(p=>p.filter(c=>c.id!==id));
    if(activeId===id){const remaining=convos.filter(c=>c.id!==id);setActiveId(remaining[0]?.id||null)}
    // Delete from backend
    if(!String(id).startsWith('conv-')){
      await airDeleteConversation(id);
    }
  },[activeId,convos]);

  const archiveConv=useCallback((id)=>{
    setConvos(p=>p.map(c=>c.id===id?{...c,archived:true}:c));
    if(user)archiveConversation(user.email||user.uid,id).catch(()=>{});
  },[user]);

  // SPURT 3: Share conversation via email
  const shareConversation=useCallback(async(convId,emails,permission)=>{
    // Update local state to mark as shared
    setConvos(p=>p.map(c=>c.id===convId?{...c,shared:true,sharedWith:[...(c.sharedWith||[]),...emails.map(e=>({email:e,permission}))]}:c));
    // Save to backend via direct share endpoint
    if(user){
      try{
        await airShareChat(user.email||user.uid, convId, emails);
      }catch(e){console.error("Share error:",e)}
    }
  },[user]);
  
  // SPURT 4: Create project - saves to backend
  const createProject=useCallback(async(name="New Project")=>{
    const userId=user?.email||user?.uid||"unknown";
    const result=await airCreateProject(userId,name);
    if(result.success&&result.project){
      const proj={id:result.project.id,name:result.project.name||name,files:result.project.files||[],createdAt:Date.now()};
      setProjects(p=>[proj,...p]);
      setActiveProject(proj.id);
      return proj.id;
    }
    // Fallback local if backend fails
    const id=`proj-${Date.now()}`;
    const proj={id,name,files:[],createdAt:Date.now()};
    setProjects(p=>[proj,...p]);
    setActiveProject(id);
    return id;
  },[user]);
  
  // Delete project - syncs to backend
  const deleteProject=useCallback(async(projectId)=>{
    setProjects(p=>p.filter(proj=>proj.id!==projectId));
    if(activeProject===projectId)setActiveProject(null);
    if(!String(projectId).startsWith('proj-')){
      try{await fetch(`${ABABASE}/api/projects/${projectId}`,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:user?.email||user?.uid||"unknown"})})}catch(e){console.error("[PROJECTS] Delete failed:",e)}
    }
  },[activeProject,user]);
  
  // Remove file from project
  const removeFileFromProject=useCallback((projectId,fileId)=>{
    setProjects(p=>p.map(proj=>proj.id===projectId?{...proj,files:proj.files.filter(f=>f.id!==fileId)}:proj));
  },[]);
  
  // SPURT 4: Add file to project
  const addFileToProject=useCallback((projectId,file)=>{
    const fileData={id:`file-${Date.now()}`,name:file.name,type:file.type,size:file.size,url:URL.createObjectURL(file),addedAt:Date.now()};
    setProjects(p=>p.map(proj=>proj.id===projectId?{...proj,files:[...proj.files,fileData]}:proj));
  },[]);
  
  // SPURT 4: Rename project - syncs to backend
  const renameProject=useCallback(async(projectId,newName)=>{
    setProjects(p=>p.map(proj=>proj.id===projectId?{...proj,name:newName}:proj));
    if(!String(projectId).startsWith('proj-')){
      try{await fetch(`${ABABASE}/api/projects/${projectId}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:user?.email||user?.uid||"unknown",name:newName})})}catch(e){console.error("[PROJECTS] Rename failed:",e)}
    }
  },[user]);

  // v1.2.0: Load conversations via AIR → Supabase + DAWN greeting
  // v2.15.0: Use email for userId to match HAM resolution
  useEffect(()=>{
    if(!user)return;
    const userId = user.email || user.uid;
    loadConversations(userId).then(loaded=>{
      if(loaded&&loaded.length>0){
        setConvos(loaded);
        setActiveId(loaded[0].id);
      }else{
        const id=createConv();
        // Get JARVIS-style welcome from DAWN
        getDawnGreeting(userId,user.displayName).then(g=>{
          let welcomeMsg=g.greeting||"";
          if(g.context)welcomeMsg+="\n\n"+g.context;
          if(g.proactive)welcomeMsg+="\n\n"+g.proactive;
          if(welcomeMsg){
            setConvos(p=>p.map(c=>c.id===id?{...c,messages:[{id:"w1",role:"aba",content:welcomeMsg,timestamp:Date.now()}]}:c));
            if(voiceOut){setAbaState("speaking");reachSynthesize(g.greeting).then(url=>{if(url){const a=new Audio(url);a.onended=()=>setAbaState("idle");a.play().catch(()=>setAbaState("idle"))}else setAbaState("idle")})}
          }
        });
      }
    }).catch(()=>{createConv()});
    reachPresence(userId).then(d=>{if(d.items)setProactiveItems(d.items)});
  },[user]);

  // ⬡B:WRAP.migration:FIX:rename_new_chat_convos:20260409⬡
  // Rename active conversation if still "New Chat"
  useEffect(()=>{
    if(!activeConv||activeConv.autoNamed||!user)return;
    if(activeConv.messages.length>=2){
      airNameChat(activeConv.messages,user.email||user.uid).then(name=>{
        if(name){
          setConvos(p=>p.map(c=>c.id===activeId?{...c,title:name,autoNamed:true}:c));
          if(activeId&&!String(activeId).startsWith('conv-')){
            fetch(`${ABABASE}/api/conversations/${activeId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:name})}).catch(()=>{});
          }
        }
      });
    }
  },[messages.length,activeId]);

  // ⬡B:WRAP.migration:FIX:bulk_rename_on_load:20260409⬡
  // One-time migration: rename all "New Chat" conversations with messages
  useEffect(()=>{
    if(!user||!convos.length)return;
    const unnamed=convos.filter(c=>c.title==="New Chat"&&!c.autoNamed&&c.messages&&c.messages.length>=2);
    if(!unnamed.length)return;
    // [WRAP] migration runs silently
    unnamed.slice(0,5).forEach(c=>{
      airNameChat(c.messages,user.email||user.uid).then(name=>{
        if(name){
          setConvos(p=>p.map(x=>x.id===c.id?{...x,title:name,autoNamed:true}:x));
          if(c.id&&!String(c.id).startsWith('conv-')){
            fetch(`${ABABASE}/api/conversations/${c.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:name})}).catch(()=>{});
          }
        }
      });
    });
  },[convos.length,user]);

  // ⬡B:MYABA:FIX:remove_duplicate_save:20260321⬡
  // REMOVED: saveConversation useEffect that ran on every messages.length change.
  // This was the ROOT CAUSE of duplicate conversations. It POSTed to the CREATE endpoint
  // every time a message was added, creating a new 0-message record each time.
  // addMsg() already saves each message individually via POST /conversations/:id/messages.
  // That is the correct single save path. No duplicate useEffect needed.

  // ⬡B:chat.persistence.v19:SAVE_ON_CLOSE:20260319⬡
  // Save conversation when user leaves the app (tab switch, minimize, close)
  const activeConvRef=useRef(null);
  useEffect(()=>{activeConvRef.current=activeConv},[activeConv]);
  
  useEffect(()=>{
    if(!user)return;
    const userId=user.email||user.uid;
    
    // Save when tab becomes hidden (user switches apps or tabs)
    const handleVisibility=()=>{
      if(document.visibilityState==="hidden"&&activeConvRef.current&&activeConvRef.current.messages.length>0){
        console.log("[SAVE] Saving on visibility change");
        // Use sendBeacon for reliability on close, fall back to fetch
        const payload=JSON.stringify({
          id:activeConvRef.current.id,
          userId,
          title:activeConvRef.current.title,
          messages:activeConvRef.current.messages,
          shared:activeConvRef.current.shared,
          projectId:activeConvRef.current.projectId
        });
        const sent=navigator.sendBeacon&&navigator.sendBeacon(
          `${ABABASE}/api/conversations`,
          new Blob([payload],{type:"application/json"})
        );
        if(!sent)saveConversation(userId,activeConvRef.current).catch(()=>{});
      }
    };
    
    // Save when browser is about to close
    const handleBeforeUnload=()=>{
      if(activeConvRef.current&&activeConvRef.current.messages.length>0){
        console.log("[SAVE] Saving on beforeunload");
        const payload=JSON.stringify({
          id:activeConvRef.current.id,
          userId,
          title:activeConvRef.current.title,
          messages:activeConvRef.current.messages,
          shared:activeConvRef.current.shared,
          projectId:activeConvRef.current.projectId
        });
        navigator.sendBeacon&&navigator.sendBeacon(
          `${ABABASE}/api/conversations`,
          new Blob([payload],{type:"application/json"})
        );
      }
    };
    
    document.addEventListener("visibilitychange",handleVisibility);
    window.addEventListener("beforeunload",handleBeforeUnload);
    return()=>{
      document.removeEventListener("visibilitychange",handleVisibility);
      window.removeEventListener("beforeunload",handleBeforeUnload);
    };
  },[user]);

  // SPURT 5: Handle file selection
  const handleFileSelect=useCallback((e)=>{
    const files=Array.from(e.target.files||[]);
    const newAttachments=files.map(f=>({id:`att-${Date.now()}-${Math.random()}`,file:f,name:f.name,type:f.type,size:f.size,url:URL.createObjectURL(f)}));
    setAttachments(p=>[...p,...newAttachments]);
    if(fileInputRef.current)fileInputRef.current.value="";
  },[]);
  
  const removeAttachment=useCallback((id)=>{
    setAttachments(p=>p.filter(a=>a.id!==id));
  },[]);

  // ⬡B:voice.chain.v4:FIXED_STALE_CLOSURES:20260319⬡
  // Use refs to break the circular dependency between sendMessage and startListening
  const sendMessageRef=useRef(null);
  const startListeningRef=useRef(null);

  const sendMessage=useCallback(async(text,isVoice=false)=>{
    if(!text.trim()&&attachments.length===0)return;
    
    // Upload files FIRST if any
    let uploadedFiles=[];
    if(attachments.length>0&&!isVoice){
      setAbaState("thinking");
      showToast(`Uploading ${attachments.length} file${attachments.length>1?"s":""}...`,"info");
      const filesToUpload=attachments.map(a=>a.file).filter(Boolean);
      if(filesToUpload.length>0){
        if(filesToUpload.length===1){
          const result=await uploadAttachment(filesToUpload[0],user?.email||user?.uid||"unknown",activeId);
          if(result)uploadedFiles=[result];
        }else{
          uploadedFiles=await uploadAttachmentsBatch(filesToUpload,user?.email||user?.uid||"unknown",activeId);
        }
      }
      if(uploadedFiles.length===0&&attachments.length>0){
        showToast("File upload failed. Sending message without files.","warning");
      }
    }
    
    // Build message with uploaded file info
    const attachmentInfo=uploadedFiles.length>0?uploadedFiles.map(f=>({name:f.filename,type:f.contentType,size:f.size,url:f.url,storagePath:f.storagePath})):attachments.length>0?attachments.map(a=>({name:a.name,type:a.type,size:a.size})):undefined;
    
    // ⬡B:MYABA:FIX:image_vision:20260321⬡
    // Capture image File refs BEFORE clearing attachments state
    const imageFiles=attachments.map(a=>a.file).filter(f=>f&&IMAGE_TYPES.includes(f.type));
    
    const userMsg={id:`u-${Date.now()}`,role:"user",content:text.trim(),timestamp:Date.now(),isVoice,attachments:attachmentInfo};
    addMsg(userMsg);setInput("");setAttachments([]);setIsTyping(true);setAbaState("thinking");
    console.log("[MSG] sendMessage called:",text.substring(0,50),uploadedFiles.length?"with "+uploadedFiles.length+" files":"");
    
    // Build message text with file context for AIR
    let messageForAIR=text.trim();
    if(uploadedFiles.length>0){
      const fileList=uploadedFiles.map(f=>`[Attached: ${f.filename} (${f.contentType}, ${Math.round(f.size/1024)}KB)]`).join("\n");
      messageForAIR=`${text.trim()}\n\n${fileList}`;
    }
    
    // ⬡B:MYABA:FIX:conversation_history:20260321⬡
    // Build conversation history from current messages so ABA has context between turns.
    // Last 20 messages max to keep payload reasonable. Map role 'aba' to 'assistant' for Anthropic API.
    const recentHistory=messages.slice(-20).map(m=>({role:m.role==="aba"?"assistant":"user",content:m.content||""})).filter(m=>m.content);
    
    // ⬡B:MYABA:FIX:image_vision:20260321⬡
    // Convert image attachments to base64 for Anthropic vision API
    let imagePayloads=[];
    for(const file of imageFiles){
      try{const b64=await fileToBase64(file);imagePayloads.push({data:b64,media_type:file.type||'image/jpeg'})}catch(e){console.error("[IMG] base64 conversion failed:",e)}
    }
    if(imagePayloads.length>0)console.log("[IMG] Sending",imagePayloads.length,"image(s) to AIR vision");
    // ⬡B:roadmap.tier3:STREAMING:sendMessage_stream:20260323⬡
    // Stream response — words appear in real-time instead of 15-35s wait
    const abaMsgId="a-"+Date.now();
    const abaMsg={id:abaMsgId,role:"aba",timestamp:Date.now(),content:"",streaming:true};
    addMsg(abaMsg);
    
    const streamResult=await airRequestStream({
      message:messageForAIR,
      userId:user?.email||user?.uid||"unknown",
      channel:"myaba",
      appScope:appScope||undefined,
      conversationId:activeId,
      conversationHistory:recentHistory,
      images:imagePayloads,
      onChunk:(accumulated, chunkText, chunkType)=>{
        if (chunkType === "filler") {
          // Show filler as temporary italic text in the ABA bubble
          setMessages(prev=>prev.map(m=>m.id===abaMsgId?{...m,content:"_"+chunkText+"_",isFiller:true}:m));
        } else if (chunkType === "filler_end") {
          // Clear filler, prepare for real content
          setMessages(prev=>prev.map(m=>m.id===abaMsgId?{...m,isFiller:false}:m)); // Keep filler text visible until real chunks replace it
        } else {
          // Real content chunk
          setMessages(prev=>prev.map(m=>m.id===abaMsgId?{...m,content:accumulated,isFiller:false}:m));
        }
      },
      onToolStart:(tool)=>{
        setMessages(prev=>prev.map(m=>m.id===abaMsgId?{...m,content:m.content+(m.content?"\n":"")+"_Checking "+tool+"..._"}:m));
      },
      onAttachment:(att)=>{
        // ⬡B:MACE.file_delivery:UI:attachment_in_bubble:20260409⬡
        setMessages(prev=>prev.map(m=>m.id===abaMsgId?{...m,attachments:[...(m.attachments||[]),{name:att.filename,type:att.contentType,size:att.sizeKB?att.sizeKB*1024:0,url:att.url}]}:m));
      },
      onDone:(data)=>{
        const finalText=data.fullResponse||data.response||"";
        setMessages(prev=>prev.map(m=>m.id===abaMsgId?{...m,content:finalText||m.content,streaming:false}:m));
        setLastABAResponse(data);
        // Save the finalized ABA response to backend
        if(finalText&&activeId)airAddMessage(activeId,"aba",finalText).catch(()=>{});
        console.log("[STREAM] Done. Tools:",data.toolsExecuted,"Duration:",data.duration+"ms");
      },
      onError:(err)=>{
        console.error("[STREAM] Error:",err);
        setMessages(prev=>prev.map(m=>m.id===abaMsgId?{...m,content:"Taking a moment to reconnect...",streaming:false}:m));
        showToast("Taking a moment to reconnect...","offline");
      }
    });
    
    setIsTyping(false);
    
    if(streamResult.error){
      setAbaState("idle");
      return;
    }
    
    const finalContent=streamResult.response||"";
    // Voice output after streaming completes (full text available)
    if(voiceOut&&finalContent){
      setAbaState("speaking");
      console.log("[VOICE] Synthesizing streamed response...");
      const url=await reachSynthesize(finalContent);
      if(url){
        const a=new Audio(url);
        a.onended=()=>{setAbaState("idle");if(liveRef.current&&startListeningRef.current){console.log("[VOICE] Auto-listen after speak");setTimeout(()=>{if(liveRef.current&&startListeningRef.current)startListeningRef.current()},500)}};
        a.play().catch(err=>{console.error("[VOICE] Audio play error:",err);setAbaState("idle");if(liveRef.current&&startListeningRef.current)startListeningRef.current()});
      }else{
        setAbaState("idle");
        if(liveRef.current&&startListeningRef.current)startListeningRef.current();
      }
    }else{
      setAbaState("idle");
      if(liveRef.current&&startListeningRef.current)startListeningRef.current();
    }
  },[activeId,user,voiceOut,addMsg,showToast,attachments,appScope]);

  // Barcode scanner overlay
  const handleBarcodeScan=useCallback((barcode)=>{
    setScannerOpen(false);
    sendMessage("Look up this food barcode: "+barcode);
  },[sendMessage]);
  
  // Keep ref always pointing to latest sendMessage
  useEffect(()=>{sendMessageRef.current=sendMessage},[sendMessage]);

  // SPURT 6: Speak any text (for replay button)
  const speakText=useCallback(async(text)=>{
    // ⬡B:transcript_item:speak_caption:20260323⬡ Show closed caption when ABA speaks
    window.dispatchEvent(new CustomEvent("vara-caption",{detail:{text:text.substring(0,200),source:"ABA"}}));
    if(!text)return;
    setAbaState("speaking");
    const url=await reachSynthesize(text);
    if(url){
      const audio=new Audio(url);
      audio.onended=()=>setAbaState("idle");
      audio.play().catch(()=>setAbaState("idle"));
    }else{
      setAbaState("idle");
    }
  },[]);

  const startListening=useCallback(async()=>{
    console.log("[VOICE] startListening called");
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      console.log("[VOICE] Mic access granted");
      setIsListening(true);setAbaState("listening");
      
      // Detect supported mimeType instead of hardcoding
      const mimeTypes=["audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus","audio/mp4","audio/aac",""];
      let mimeType="";
      for(const mt of mimeTypes){
        if(!mt||MediaRecorder.isTypeSupported(mt)){mimeType=mt;break}
      }
      console.log("[VOICE] Using mimeType:",mimeType||"(browser default)");
      
      const recOpts=mimeType?{mimeType}:undefined;
      const rec=new MediaRecorder(stream,recOpts);
      const chunks=[];
      rec.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data)};
      
      rec.onstop=async()=>{
        console.log("[VOICE] Recording stopped, chunks:",chunks.length);
        stream.getTracks().forEach(t=>t.stop());
        setAbaState("thinking");setIsListening(false);
        
        if(chunks.length===0){
          console.warn("[VOICE] No audio chunks recorded");
          setAbaState("idle");
          showToast("No audio captured. Try again.","warning");
          if(liveRef.current)setTimeout(()=>{if(startListeningRef.current)startListeningRef.current()},1000);
          return;
        }
        
        const blob=new Blob(chunks,{type:rec.mimeType||mimeType||"audio/webm"});
        console.log("[VOICE] Blob size:",blob.size,"type:",blob.type);
        
        try{
          const vResult=await reachTranscribe(blob);
          const transcript=vResult?.text||(typeof vResult==="string"?vResult:null);
          console.log("[VOICE] Transcript:",transcript||"(empty)");
          if(transcript&&transcript.trim()){
            if(sendMessageRef.current)sendMessageRef.current(transcript,true);
            else console.error("[VOICE] sendMessageRef is null!");
          }else{
            console.warn("[VOICE] Empty transcript from Deepgram");
            setAbaState("idle");
            if(liveRef.current)setTimeout(()=>{if(startListeningRef.current)startListeningRef.current()},500);
          }
        }catch(transcribeErr){
          console.error("[VOICE] Transcription error:",transcribeErr);
          setAbaState("idle");
          showToast("Voice processing failed. Try again.","warning");
        }
      };
      
      rec.onerror=e=>{console.error("[VOICE] MediaRecorder error:",e.error)};
      recorderRef.current=rec;
      rec.start(1000); // Collect chunks every 1 second
      console.log("[VOICE] Recording started");
      
      if(voiceMode!=="push")setTimeout(()=>{if(rec.state==="recording"){console.log("[VOICE] 15s timeout, stopping");rec.stop()}},15000);
    }catch(err){
      console.error("[VOICE] startListening error:",err.name,err.message);
      setIsListening(false);setAbaState("idle");
      if(err.name==="NotAllowedError")showToast("Microphone permission denied","warning");
      else if(err.name==="NotSupportedError")showToast("Audio recording not supported on this browser","warning");
      else showToast("Could not start voice: "+err.message,"warning");
    }
  },[voiceMode,showToast]);

  // Keep ref always pointing to latest startListening
  useEffect(()=>{startListeningRef.current=startListening},[startListening]);

  const stopListening=useCallback(()=>{if(recorderRef.current?.state==="recording")recorderRef.current.stop()},[]);
  const toggleLive=useCallback(()=>{if(liveActive){liveRef.current=false;setLiveActive(false);stopListening();setAbaState("idle")}else{liveRef.current=true;setLiveActive(true);startListening()}},[liveActive,startListening,stopListening]);
  const handleKey=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage(input)}};

  // ⬡B:snap.quick_question:SEND:20260317⬡
  const snapSend=useCallback(async(text)=>{
    if(!text.trim())return;
    const userMsg={id:"sq-u-"+Date.now(),role:"user",content:text.trim(),timestamp:Date.now()};
    setSnapMessages(prev=>[...prev,userMsg]);setSnapInput("");setSnapLoading(true);
    try{
      const res=await fetch(ABABASE+"/api/air/process",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({message:text.trim(),user_id:user?.email||user?.uid||"unknown",userId:user?.email||user?.uid||"unknown",channel:"snap"})
      });
      const data=await res.json();
      const abaMsg={id:"sq-a-"+Date.now(),role:"aba",content:data.response||data.message||"",timestamp:Date.now()};
      setSnapMessages(prev=>[...prev,abaMsg]);
      if(data.migrateToFull){setSnapMigrate(true)}
    }catch(err){
      setSnapMessages(prev=>[...prev,{id:"sq-e-"+Date.now(),role:"aba",content:"Connection issue. Try again.",timestamp:Date.now()}]);
    }
    setSnapLoading(false);
  },[user]);

  if(authLoading)return <div style={{position:"fixed",inset:0,background:"#08080d",display:"flex",alignItems:"center",justifyContent:"center"}}><Blob state="thinking" size={100}/></div>;
  if(!user)return <Login onLogin={setUser}/>;

  // ⬡B:MYABA:TOUR:20260320⬡ First login tour check
  const tourComplete=typeof window!=='undefined'&&localStorage.getItem("myaba_tour_complete")==="true";

  const sc=abaState==="thinking"?"245,158,11":abaState==="speaking"?"34,197,94":abaState==="listening"?"6,182,212":"139,92,246";
  const bgUrl=BG[bg]?.u||BG.pinkSmoke.u;

  // Show tour on first login
  if(!tourComplete)return <FirstLoginTour user={user} onComplete={()=>{try{localStorage.setItem("myaba_tour_complete","true")}catch{};window.location.reload()}}/>;

  return(<div style={{width:"100%",height:"100dvh",minHeight:`${viewportHeight}px`,position:"relative",overflow:"hidden",fontFamily:"'SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",background:"linear-gradient(165deg, #0a0a1a 0%, #1a0a2e 30%, #0d1117 60%, #0a0a1a 100%)",paddingTop:"env(safe-area-inset-top)",paddingBottom:"env(safe-area-inset-bottom)",boxSizing:"border-box"}}>
    {/* Ken Burns backgrounds show through — NO gradient overlay */}
    <style>{`@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes mp{0%,100%{opacity:.3;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}@keyframes mf{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes mb{0%,100%{opacity:.6}50%{opacity:1}}@keyframes ml{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.4)}50%{box-shadow:0 0 0 12px rgba(239,68,68,0)}}@keyframes kenBurns{0%{transform:scale(1) translate(0,0)}25%{transform:scale(1.08) translate(-1%,-1%)}50%{transform:scale(1.12) translate(1%,0)}75%{transform:scale(1.06) translate(-0.5%,1%)}100%{transform:scale(1) translate(0,0)}}@keyframes pulse{0%{transform:scale(1);opacity:1}100%{transform:scale(1.5);opacity:0}}@keyframes breathe{0%,100%{transform:scale(1);box-shadow:0 0 40px rgba(139,92,246,.3)}50%{transform:scale(1.05);box-shadow:0 0 60px rgba(139,92,246,.5)}}@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(139,92,246,.15);border-radius:99px}`}</style>
    <div style={{position:"absolute",inset:"-10%",zIndex:0,backgroundImage:`url(${bgUrl})`,backgroundSize:"cover",backgroundPosition:"center",filter:"brightness(.4) saturate(.7)",animation:"kenBurns 30s ease-in-out infinite",willChange:"transform",WebkitBackfaceVisibility:"hidden"}}/>
    <div style={{position:"absolute",inset:0,zIndex:1,background:"radial-gradient(ellipse at center,rgba(0,0,0,0) 0%,rgba(0,0,0,.55) 100%)"}}/>
    <div style={{position:"relative",zIndex:2,display:"flex",flexDirection:"column",height:"100%",maxWidth:480,margin:"0 auto",padding:"0 14px"}}>
      {/* ⬡B:CIP:STATUS_BAR:phone_like:20260324⬡ Phone status bar */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 16px 2px",flexShrink:0,height:28}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{color:"rgba(255,255,255,.75)",fontSize:12,fontWeight:600}}>{new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</span>
          <div style={{width:6,height:6,borderRadius:99,background:`rgba(${sc},.8)`,boxShadow:`0 0 6px rgba(${sc},.5)`}}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {liveActive&&<span style={{background:"rgba(239,68,68,.2)",color:"#EF4444",fontSize:8,fontWeight:700,padding:"1px 6px",borderRadius:99,letterSpacing:1}}>LIVE</span>}
          <div style={{display:"flex",gap:2,alignItems:"flex-end"}}>{[3,5,7,9].map((h,i)=><div key={i} style={{width:3,height:h,borderRadius:1,background:"rgba(255,255,255,.4)"}}/>)}</div>
          <svg width="18" height="10" viewBox="0 0 18 10"><rect x="0" y="0" width="15" height="10" rx="2" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth="1"/><rect x="16" y="3" width="2" height="4" rx="1" fill="rgba(255,255,255,.3)"/><rect x="1" y="1" width="10" height="8" rx="1" fill="rgba(34,197,94,.7)"/></svg>
        </div>
      </div>
      {/* App title bar — only shows when NOT on home */}
      {mainTab!=="home"&&mainTab!=="apps"&&<div style={{display:"flex",alignItems:"center",gap:10,padding:"6px 12px 4px",flexShrink:0}}>
        <button onClick={()=>{setMainTab("home");setAppScope(null)}} style={{width:32,height:32,borderRadius:10,border:"none",cursor:"pointer",background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.5)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><ChevronLeft size={18}/></button>
        <span style={{fontSize:16,fontWeight:600,color:"rgba(255,255,255,.85)",flex:1}}>{mainTab==="chat"?"Talk to ABA":mainTab==="briefing"?"Briefing":mainTab==="jobs"?"Jobs":mainTab==="pipeline"?"Pipeline":mainTab==="memos"?"Memos":mainTab==="email"?"Email":mainTab==="approve"?"Command Center":mainTab==="nura"?"Nutrition":mainTab==="phone"?"ABA Dials":mainTab==="gmg_university"?"GMG University":mainTab==="tasks"?"Tasks":mainTab==="notes"?"Notes":mainTab==="calendar"?"Calendar":mainTab==="crm"?"Contacts":mainTab==="journal"?"Journal":mainTab==="incidents"?"Report Bug":mainTab==="guide"?"ABA Guides":mainTab==="sports"?"Scoreboard":mainTab==="music"?"Music":mainTab==="reading"?"Reading":mainTab==="ccwa"?"Come Code with ABA":mainTab==="aoa"?"AOA":mainTab==="meeting"?"MESA":mainTab==="interview"?"IRIS":mainTab.replace(/_/g," ")}</span>
        <div style={{display:"flex",gap:4}}>
          {isHAM(user?.email)&&<button onClick={()=>setAdminPanelOpen(true)} style={{width:32,height:32,borderRadius:10,border:"none",cursor:"pointer",background:lastABAResponse?"rgba(34,197,94,.1)":"rgba(255,255,255,.04)",color:lastABAResponse?"rgba(34,197,94,.7)":"rgba(255,255,255,.25)",display:"flex",alignItems:"center",justifyContent:"center"}}><Activity size={14}/></button>}
          <button onClick={()=>setVoiceOut(!voiceOut)} style={{width:32,height:32,borderRadius:10,border:"none",cursor:"pointer",background:voiceOut?"rgba(139,92,246,.1)":"rgba(255,255,255,.04)",color:voiceOut?"rgba(139,92,246,.7)":"rgba(255,255,255,.25)",display:"flex",alignItems:"center",justifyContent:"center"}}>{voiceOut?<Volume2 size={13}/>:<VolumeX size={13}/>}</button>
          {mainTab==="chat"&&activeConv&&activeConv.messages.length>0&&<div style={{position:"relative"}}>
            <button onClick={()=>setExportMenu(!exportMenu)} style={{padding:"0 10px",height:32,borderRadius:10,border:"none",cursor:"pointer",background:exportMenu?"rgba(139,92,246,.15)":"rgba(255,255,255,.06)",color:exportMenu?"rgba(139,92,246,.7)":"rgba(255,255,255,.4)",display:"flex",alignItems:"center",justifyContent:"center",gap:4,fontSize:11,fontWeight:500}} title="Save chat"><Download size={13}/>Save</button>
            {exportMenu&&<div style={{position:"absolute",top:36,right:0,background:"rgba(20,16,32,.97)",border:"1px solid rgba(139,92,246,.2)",borderRadius:12,padding:4,minWidth:120,zIndex:50,boxShadow:"0 8px 24px rgba(0,0,0,.5)",backdropFilter:"blur(12px)"}}>
              {[["pdf","PDF"],["docx","Word"],["md","Markdown"]].map(([fmt,label])=>(
                <button key={fmt} onClick={()=>{setExportMenu(false);exportChat(activeConv.messages,activeConv.title||"ABA Chat",fmt)}} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"10px 12px",border:"none",background:"transparent",color:"rgba(255,255,255,.75)",cursor:"pointer",borderRadius:8,fontSize:12,fontWeight:500,textAlign:"left"}}
                  onMouseEnter={e=>e.target.style.background="rgba(139,92,246,.1)"}
                  onMouseLeave={e=>e.target.style.background="transparent"}
                ><FileText size={12} style={{color:"rgba(139,92,246,.6)",flexShrink:0}}/>{label}</button>
              ))}
            </div>}
          </div>}
          <button onClick={()=>setSettingsOpen(true)} style={{width:32,height:32,borderRadius:10,border:"none",cursor:"pointer",background:"rgba(255,255,255,.04)",color:"rgba(255,255,255,.25)",display:"flex",alignItems:"center",justifyContent:"center"}}><Settings size={13}/></button>
        </div>
      </div>}
            
      {/* ⬡B:aba_skins:RENDER:app_launcher_view:20260323⬡ */}
      {(mainTab==="home"||mainTab==="apps")&&<div style={{flex:1,overflowY:"auto",padding:"8px 8px calc(56px + env(safe-area-inset-bottom, 0px))",display:"flex",flexDirection:"column"}}>
        <AppLauncher 
          userId={user?.email||user?.uid||"unknown"} 
          currentApp={null}
          onAppSelect={(app)=>{
            setAppScope(app.app_scope||null);
            // ⬡B:FIX:dismiss_chat_on_switch:20260324⬡ Reset voice/chat state when leaving chat
            if(app.id!=="chat"&&app.id!=="phone"&&app.id!=="incidents"){
              if(voiceMode==="talk")setVoiceMode("chat");
              setSnapOpen(false);setClipboardOpen(false);
            }
            // ⬡B:WRAP.fix:LOCAL:track_app_usage:20260410⬡
            try { const u = JSON.parse(localStorage.getItem("myaba_app_usage") || "{}"); u[app.id] = (u[app.id] || 0) + 1; localStorage.setItem("myaba_app_usage", JSON.stringify(u)); } catch {}
            if(app.id==="chat"){setMainTab("chat")}
            else if(app.id==="briefing"){setMainTab("briefing");if(!briefingData&&!briefingLoading){setBriefingLoading(true);fetchBriefing(user?.email||user?.uid||"unknown").then(d=>{setBriefingData(d);setBriefingLoading(false)}).catch(()=>setBriefingLoading(false))}}
            else if(app.id==="jobs"){setMainTab("jobs")}
            else if(app.id==="pipeline"){setMainTab("pipeline")}
            else if(app.id==="email"){setMainTab("email")}
            else if(app.id==="memos"){setMainTab("memos")}
            else if(app.id==="approve"){setMainTab("approve")}
            else if(app.id==="settings"){setSettingsOpen(true)}
            else if(app.id==="ccwa"){setMainTab("ccwa")}
            else if(app.id==="aoa"){setMainTab("aoa")}
            else if(app.id==="gmg_university"){setMainTab("gmg_university")}
            else if(app.id==="phone"){setMainTab("chat");setVoiceMode("talk")}
            else if(app.id==="nura"){setMainTab("nura")}
            else if(app.id==="incidents"){setMainTab("chat");setInput("I want to report a bug: ")}
            else if(app.id==="tasks"){setMainTab("tasks")}
            else if(app.id==="notes"){setMainTab("notes")}
            else if(app.id==="calendar"){setMainTab("calendar")}
            else if(app.id==="crm"){setMainTab("crm")}
            else if(app.id==="journal"){setMainTab("journal")}
            else if(app.id==="guide"){setMainTab("guide")}
            else if(app.id==="sports"){setMainTab("sports")}
            else if(app.id==="music"){setMainTab("music")}
            else if(app.id==="meeting"){setMainTab("meeting")}
            else if(app.id==="interview"){setMainTab("interview")}
            else{setMainTab(app.id)}
          }}
        />
      </div>}
      
      {/* Chat Mode */}
      {mainTab==="chat"&&<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",paddingBottom:"calc(48px + env(safe-area-inset-bottom, 0px))"}}>
      <div style={{flexShrink:0,padding:"4px 0"}}><VoiceMode mode={voiceMode} setMode={m=>{setVoiceMode(m);if(m!=="talk"&&liveActive){liveRef.current=false;setLiveActive(false);stopListening()}}}/></div>
      
      {/* Hide chat elements when in Talk mode */}
      {voiceMode!=="talk"&&<>
      <div style={{flexShrink:0,display:"flex",justifyContent:"center",padding:"2px 0",transition:"all .5s"}}><Blob state={abaState} size={messages.length<=1?100:50}/></div>
      <div ref={scrollRef} style={{flex:1,overflowY:"auto",padding:"4px 2px",display:"flex",flexDirection:"column",gap:2,maskImage:"linear-gradient(transparent 0%,black 2%,black 96%,transparent 100%)",WebkitMaskImage:"linear-gradient(transparent 0%,black 2%,black 96%,transparent 100%)"}}>
        {messages.map(msg=><div key={msg.id} style={{animation:"mf .3s ease"}}><Bubble msg={msg} userPhoto={user?.photoURL} onSpeak={speakText}/></div>)}
        {isTyping&&<Typing/>}
      </div>
      </>}
      
      <div style={{flexShrink:voiceMode==="talk"?undefined:0,flex:voiceMode==="talk"?1:undefined,padding:voiceMode==="talk"?"0":"6px 0 14px",display:"flex",flexDirection:"column"}}>
        {/* Hidden file input */}
        <input type="file" ref={fileInputRef} multiple accept="*/*" onChange={handleFileSelect} style={{display:"none"}}/>
        
        {/* Attachments preview - only show in chat mode */}
        {voiceMode==="chat"&&attachments.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:8,padding:"0 4px"}}>
          {attachments.map(a=>(<div key={a.id} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:12,background:"rgba(139,92,246,.15)",border:"1px solid rgba(139,92,246,.25)"}}>
            {a.type?.startsWith("image")?<Image size={12} style={{color:"rgba(139,92,246,.8)"}}/>:<File size={12} style={{color:"rgba(139,92,246,.8)"}}/>}
            <span style={{color:"rgba(255,255,255,.8)",fontSize:11,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</span>
            <button onClick={()=>removeAttachment(a.id)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.4)",padding:2}}><X size={12}/></button>
          </div>))}
        </div>}
        
        {voiceMode==="chat"&&<div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
          <button onClick={()=>fileInputRef.current?.click()} style={{width:44,height:44,borderRadius:99,border:"none",cursor:"pointer",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.4)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Paperclip size={16}/></button>
          <button onClick={()=>setScannerOpen(true)} title="Scan food barcode" style={{width:44,height:44,borderRadius:99,border:"none",cursor:"pointer",background:"rgba(255,255,255,.05)",color:"rgba(139,92,246,.5)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Camera size={16}/></button>
          <div style={{flex:1,display:"flex",alignItems:"flex-end",background:"rgba(255,255,255,.05)",backdropFilter:"blur(12px)",border:"1px solid rgba(255,255,255,.08)",borderRadius:20,padding:"6px 6px 6px 16px",minHeight:44}}><textarea value={input} onChange={e=>{setInput(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,200)+"px"}} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage(input)}}} onFocus={scrollInputIntoView} placeholder="Message ABA..." rows={1} style={{flex:1,background:"none",border:"none",outline:"none",color:"rgba(255,255,255,.9)",fontSize:16,padding:"8px 0",WebkitAppearance:"none",resize:"none",overflow:"hidden",lineHeight:"1.4",maxHeight:200,minHeight:20,fontFamily:"inherit"}}/><button onClick={()=>{if(!isListening)startListening();else stopListening()}} style={{width:36,height:36,borderRadius:99,border:"none",cursor:"pointer",background:isListening?"rgba(6,182,212,.2)":"rgba(255,255,255,.05)",color:isListening?"rgba(6,182,212,.95)":"rgba(255,255,255,.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:4}}>{isListening?<MicOff size={14}/>:<Mic size={14}/>}</button></div>
          <button onClick={()=>sendMessage(input)} disabled={!input.trim()&&attachments.length===0} style={{width:48,height:48,borderRadius:99,border:"none",cursor:(input.trim()||attachments.length>0)?"pointer":"default",background:(input.trim()||attachments.length>0)?"rgba(139,92,246,.4)":"rgba(255,255,255,.04)",color:(input.trim()||attachments.length>0)?"white":"rgba(255,255,255,.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:(input.trim()||attachments.length>0)?"0 0 16px rgba(139,92,246,.25)":"none"}}><Send size={18}/></button>
        </div>}
        
        {/* ⬡B:roadmap.tier3:RENDER:barcode_scanner:20260323⬡ */}
        {scannerOpen && <BarcodeScanner onScan={handleBarcodeScan} onClose={()=>setScannerOpen(false)} />}
        
        {/* ⬡B:MYABA:TALK_TO_ABA:ELEVENLABS_WIDGET:20260320⬡ */}
        {voiceMode==="talk"&&<div style={{display:"flex",flexDirection:"column",flex:1,position:"relative",overflow:"hidden"}}>
          {/* Back to Chat button */}
          <button onClick={()=>{setVoiceMode("chat")}} style={{position:"absolute",top:8,left:8,display:"flex",alignItems:"center",gap:6,padding:"8px 14px",background:"rgba(0,0,0,.4)",backdropFilter:"blur(12px)",border:"1px solid rgba(255,255,255,.1)",borderRadius:12,color:"rgba(255,255,255,.6)",cursor:"pointer",fontSize:12,fontWeight:500,zIndex:10}}>
            <MessageSquare size={14}/>Chat
          </button>
          
          {/* Talk to ABA - ElevenLabs voice conversation */}
          <TalkToABA userId={user?.email||user?.uid||"unknown"}/>
        </div>}
      </div>
      </div>}
      
      {/* Jobs Mode - AWA Integration */}
      {/* ⬡B:CIP:APP_CARD:fullscreen_glass:20260324⬡ Apps render fullscreen in glass over wallpaper */}
      {mainTab!=="home"&&mainTab!=="apps"&&mainTab!=="chat"&&(
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"rgba(8,8,13,.82)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",borderRadius:"20px 20px 0 0",marginTop:2,paddingBottom:"calc(52px + env(safe-area-inset-bottom, 0px))",animation:"slideUp .25s ease-out"}}>
      {mainTab==="jobs"&&<JobsView userId={user?.email||user?.uid||"unknown"} setEditorDoc={setEditorDoc}/>}
      
      {/* Pipeline Mode - Kanban ⬡B:AWA.v3:Phase6:pipeline_tab:20260315⬡ */}
      {mainTab==="pipeline"&&<PipelineView userId={user?.email||user?.uid||"unknown"}/>}
      
      {/* Memos Mode - ⬡B:MYABA:memos_tab:20260319⬡ */}
      {mainTab==="memos"&&<MemosView userId={user?.email||user?.uid||"unknown"} deepLinkMemoId={deepLinkMemoId}/>}
      
      {/* Email Mode - ⬡B:MYABA:email_tab:20260321⬡ */}
      {mainTab==="email"&&<EmailView userId={user?.email||user?.uid||"unknown"}/>}
      
      {/* Approve Mode */}
      {mainTab==="approve"&&<ApproveView userId={user?.email||user?.uid||"unknown"}/>}
      {mainTab==="gmg_university"&&<GMGUniversityView userEmail={user?.email||""} userName={user?.displayName||""}/>}
      {mainTab==="tasks"&&<TasksView userId={user?.email||user?.uid||"unknown"}/>}
      {mainTab==="notes"&&<NotesView userId={user?.email||user?.uid||"unknown"}/>}
      {mainTab==="calendar"&&<CalendarView userId={user?.email||user?.uid||"unknown"}/>}
      {mainTab==="crm"&&<CRMView userId={user?.email||user?.uid||"unknown"}/>}
      {mainTab==="journal"&&<JournalView userId={user?.email||user?.uid||"unknown"}/>}
      {mainTab==="guide"&&<GuideView userId={user?.email||user?.uid||"unknown"}/>}
      {mainTab==="sports"&&<SportsView userId={user?.email||user?.uid||"unknown"}/>}
      {mainTab==="music"&&<MusicView userId={user?.email||user?.uid||"unknown"}/>}
      {mainTab==="reading"&&<ReadingView userId={user?.email||user?.uid||"unknown"}/>}
      {mainTab==="ccwa"&&<CCWAView userId={user?.email||user?.uid||"unknown"}/>}
      {mainTab==="aoa"&&<AOAView userId={user?.email||user?.uid||"unknown"}/>}
      {mainTab==="shadow"&&<ShadowView/>}
      {mainTab==="meeting"&&<MeetingModeView userId={user?.email||user?.uid||"unknown"}/>}
      {mainTab==="interview"&&<InterviewModeView userId={user?.email||user?.uid||"unknown"}/>}
      {mainTab==="nura"&&<NURAView userId={user?.email||user?.uid||"unknown"} onScan={()=>setScannerOpen(true)}/>}
      {mainTab==="briefing"&&<BriefingView data={briefingData} loading={briefingLoading} userId={user?.email||user?.uid||"unknown"} onRefresh={async()=>{
        setBriefingLoading(true);const data=await fetchBriefing(user?.email||user?.uid||"unknown");setBriefingData(data);setBriefingLoading(false);
      }}/>}

      {/* ⬡B:CIP:ASK_ABA:floating_context:20260325⬡ Floating Ask ABA on every app screen */}
      <button onClick={()=>{
        const currentContext = mainTab.replace(/_/g, " ");
        setMainTab("chat");
        setInput("I'm looking at " + currentContext + " and need help: ");
      }} style={{
        position:"absolute",bottom:16,right:16,display:"flex",alignItems:"center",gap:6,
        padding:"10px 16px",borderRadius:99,
        background:"linear-gradient(135deg,rgba(139,92,246,.9),rgba(99,102,241,.85))",
        border:"none",color:"white",fontSize:12,fontWeight:600,cursor:"pointer",
        boxShadow:"0 4px 20px rgba(139,92,246,.4)",zIndex:10
      }}>
        <ABALogo size={16} color="white"/>Ask ABA
      </button>
        </div>
      )}

      
      {/* Catch-all chat REMOVED — apps are their own views, chat is just an app */}
    </div>
    {/* ⬡B:CIP:ASK_ABA_FAB:context_button:20260325⬡ Floating Ask ABA button on every screen */}
    {mainTab!=="chat"&&mainTab!=="home"&&mainTab!=="apps"&&!snapOpen&&(
      <button onClick={()=>{
        const context=mainTab.replace(/_/g," ");
        setMainTab("chat");
        setInput("I have a question about "+context+": ");
      }} style={{
        position:"fixed",bottom:"calc(64px + env(safe-area-inset-bottom, 0px))",right:16,
        width:48,height:48,borderRadius:99,
        background:"linear-gradient(135deg,#8B5CF6,#6366F1)",
        border:"none",boxShadow:"0 4px 20px rgba(139,92,246,.4)",
        cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
        zIndex:40,animation:"breathe 3s ease-in-out infinite"
      }}>
        <ABALogo size={24} color="white"/>
      </button>
    )}
        {/* ⬡B:CIP:BOTTOM_NAV:android_style:20260324⬡ Android-style gesture nav */}
    <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:"8px 0 calc(6px + env(safe-area-inset-bottom, 0px))",background:"linear-gradient(transparent, rgba(0,0,0,.6) 30%)",pointerEvents:"none"}}>
      <div style={{display:"flex",alignItems:"center",gap:32,pointerEvents:"auto"}}>
        {mainTab!=="home"&&<button onClick={()=>{setMainTab("home");setAppScope(null)}} style={{width:40,height:40,borderRadius:99,background:"rgba(255,255,255,.08)",backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,.1)",color:"rgba(255,255,255,.5)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><Home size={18}/></button>}
        <div style={{width:120,height:5,borderRadius:99,background:"rgba(255,255,255,.3)"}}/>
        {mainTab!=="home"&&<button onClick={()=>setSidebarOpen(true)} style={{width:40,height:40,borderRadius:99,background:"rgba(255,255,255,.08)",backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,.1)",color:"rgba(255,255,255,.5)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><MessageSquare size={16}/></button>}
      </div>
    </div>
        <Sidebar open={sidebarOpen} convos={convos} activeId={activeId} onSelect={setActiveId} onCreate={()=>setNewChatModal(true)} onClose={()=>setSidebarOpen(false)} onDelete={deleteConv} onArchive={archiveConv} onShare={c=>setShareModal(c)} projects={projects} activeProject={activeProject} onSelectProject={setActiveProject} onCreateProject={()=>setNewChatModal(true)} onProjectDetail={p=>setProjectDetailModal(p)} user={user}/>
    <ShareModal open={!!shareModal} conversation={shareModal} onClose={()=>setShareModal(null)} onShare={shareConversation}/>
    <NewChatModal open={newChatModal} onClose={()=>setNewChatModal(false)} onCreate={(shared,projectId,projectName)=>{if(projectName){const pId=createProject(projectName);createConv(shared,pId)}else{createConv(shared,projectId)}}} projects={projects} onCreateProject={createProject}/>
    <ProjectDetailModal open={!!projectDetailModal} project={projectDetailModal} onClose={()=>setProjectDetailModal(null)} onRename={renameProject} onDelete={deleteProject} onAddFile={addFileToProject} onRemoveFile={removeFileFromProject}/>
    <Queue open={queueOpen} onToggle={()=>setQueueOpen(!queueOpen)} items={proactiveItems}/>
    <ClosedCaptions text={captionText} visible={captionVisible} />
    {editorDoc&&<MobileDocEditor content={editorDoc.content} docType={editorDoc.type} onClose={()=>setEditorDoc(null)} onSave={(text)=>{setOutput&&setOutput(text);setEditorDoc(null)}}/>}
    <SettingsDrawer open={settingsOpen} onClose={()=>setSettingsOpen(false)} bg={bg} setBg={setBg} voiceOut={voiceOut} setVoiceOut={setVoiceOut} user={user} onLogout={async()=>{await signOutUser();setUser(null);setConvos([]);setActiveId(null)}}/>
    {/* ⬡B:snap.quick_question:FAB_AND_PANEL:20260317⬡ */}
    {/* ⬡B:clipboard.history:FAB:20260320⬡ Clipboard History Button */}
    {!clipboardOpen&&!snapOpen&&mainTab==="chat"&&<button onClick={()=>setClipboardOpen(true)} style={{
      position:"fixed",bottom:"calc(24px + env(safe-area-inset-bottom, 0px))",left:24,width:44,height:44,borderRadius:99,
      background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.1)",cursor:"pointer",
      display:"flex",alignItems:"center",justifyContent:"center",
      boxShadow:"0 2px 12px rgba(0,0,0,.3)",zIndex:998,backdropFilter:"blur(8px)"
    }}>
      <Copy size={18} style={{color:"rgba(255,255,255,.5)"}}/>
    </button>}
    
    {/* Clipboard History Panel */}
    {clipboardOpen&&<div style={{
      position:"fixed",bottom:0,left:0,right:0,maxHeight:"50vh",
      background:"rgba(10,10,15,.98)",borderTop:"1px solid rgba(255,255,255,.15)",
      borderRadius:"20px 20px 0 0",zIndex:999,display:"flex",flexDirection:"column",
      backdropFilter:"blur(20px)",animation:"slideUp .3s ease",
      paddingBottom:"env(safe-area-inset-bottom, 0px)"
    }}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <Copy size={16} style={{color:"rgba(255,255,255,.5)"}}/>
          <span style={{color:"rgba(255,255,255,.8)",fontSize:14,fontWeight:600}}>Clipboard History</span>
          <span style={{color:"rgba(255,255,255,.3)",fontSize:10}}>{clipboardItems.length} items</span>
        </div>
        <div style={{display:"flex",gap:8}}>
          {clipboardItems.length>0&&<button onClick={()=>{setClipboardItems([]);try{localStorage.removeItem("myaba_clipboard")}catch{}}} style={{padding:"4px 10px",borderRadius:6,border:"1px solid rgba(239,68,68,.15)",background:"transparent",color:"rgba(239,68,68,.6)",cursor:"pointer",fontSize:10}}>Clear All</button>}
          <button onClick={()=>setClipboardOpen(false)} style={{background:"none",border:"none",color:"rgba(255,255,255,.4)",cursor:"pointer",fontSize:20}}>x</button>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"8px 14px"}}>
        {clipboardItems.length===0&&<p style={{color:"rgba(255,255,255,.3)",textAlign:"center",padding:30,fontSize:12}}>Copy text anywhere and it will appear here</p>}
        {clipboardItems.map(c=>(
          <div key={c.id} style={{padding:"10px 12px",borderRadius:8,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.05)",marginBottom:4,cursor:"pointer"}} onClick={async()=>{
            try{await navigator.clipboard.writeText(c.text);showToast("Copied!","info")}catch{}
          }}>
            <p style={{color:"rgba(255,255,255,.7)",fontSize:12,margin:0,lineHeight:1.4,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical"}}>{c.text}</p>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
              <span style={{color:"rgba(255,255,255,.2)",fontSize:9}}>{new Date(c.copiedAt).toLocaleString()}</span>
              <div style={{display:"flex",gap:4}}>
                <button onClick={e=>{e.stopPropagation();setInput(prev=>prev+c.text)}} style={{padding:"2px 8px",borderRadius:4,border:"1px solid rgba(139,92,246,.15)",background:"rgba(139,92,246,.06)",color:"rgba(139,92,246,.7)",cursor:"pointer",fontSize:9}}>Paste to Chat</button>
                <button onClick={e=>{e.stopPropagation();setClipboardItems(prev=>{const updated=prev.filter(i=>i.id!==c.id);try{localStorage.setItem("myaba_clipboard",JSON.stringify(updated))}catch{};return updated})}} style={{padding:"2px 6px",borderRadius:4,border:"1px solid rgba(239,68,68,.1)",background:"transparent",color:"rgba(239,68,68,.4)",cursor:"pointer",fontSize:9}}>x</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>}
    
    {/* SNAP Quick Question - Floating Action Button */}
    {mainTab!=="home"&&mainTab!=="chat"&&<CARAButton appScope={appScope} userId={user?.email||user?.uid||"unknown"} onFullChat={()=>{setMainTab("chat")}} />}
      {!snapOpen&&mainTab==="chat"&&<button onClick={()=>{setSnapOpen(true);setSnapMigrate(false)}} style={{
      position:"fixed",bottom:"calc(24px + env(safe-area-inset-bottom, 0px))",right:24,width:56,height:56,borderRadius:99,
      background:"linear-gradient(135deg,#8B5CF6,#6366F1)",border:"none",cursor:"pointer",
      display:"flex",alignItems:"center",justifyContent:"center",
      boxShadow:"0 4px 24px rgba(139,92,246,.4)",zIndex:998,transition:"transform .2s"
    }} onMouseEnter={e=>e.target.style.transform="scale(1.1)"} onMouseLeave={e=>e.target.style.transform="scale(1)"}>
      <Zap size={24} color="white"/>
    </button>}
    
    {/* SNAP Quick Question Panel */}
    {snapOpen&&<div style={{
      position:"fixed",bottom:0,right:0,left:0,maxHeight:"65vh",
      background:"rgba(10,10,15,.98)",borderTop:"1px solid rgba(139,92,246,.3)",
      borderRadius:"20px 20px 0 0",zIndex:999,display:"flex",flexDirection:"column",
      backdropFilter:"blur(20px)",animation:"slideUp .3s ease",
      paddingBottom:"env(safe-area-inset-bottom, 0px)"
    }}>
      <style>{String.raw`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <Zap size={16} color="#8B5CF6"/>
          <span style={{color:"rgba(255,255,255,.8)",fontSize:14,fontWeight:600}}>Quick Question</span>
          <span style={{color:"rgba(139,92,246,.5)",fontSize:10}}>SNAP</span>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {snapMigrate&&<button onClick={()=>{setSnapOpen(false);setMainTab("chat");const lastQ=snapMessages.filter(m=>m.role==="user").pop();if(lastQ)setInput(lastQ.content)}} style={{
            background:"rgba(139,92,246,.15)",border:"1px solid rgba(139,92,246,.3)",borderRadius:8,
            padding:"4px 12px",color:"#8B5CF6",fontSize:11,fontWeight:600,cursor:"pointer"
          }}>Switch to Full Chat</button>}
          <button onClick={()=>setSnapOpen(false)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.4)",padding:4}}>
            <X size={18}/>
          </button>
        </div>
      </div>
      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",padding:"10px 16px",display:"flex",flexDirection:"column",gap:10,maxHeight:"40vh",scrollBehavior:"smooth"}}>
        {snapMessages.length===0&&<div style={{textAlign:"center",padding:"24px 0",color:"rgba(255,255,255,.25)",fontSize:13}}>Ask ABA anything quick</div>}
        {snapMessages.map(m=><div key={m.id} style={{
          alignSelf:m.role==="user"?"flex-end":"flex-start",
          maxWidth:"85%",padding:"10px 14px",borderRadius:16,fontSize:13,lineHeight:1.5,
          background:m.role==="user"?"rgba(139,92,246,.2)":"rgba(255,255,255,.05)",
          color:m.role==="user"?"rgba(255,255,255,.9)":"rgba(255,255,255,.75)",
          border:m.role==="user"?"1px solid rgba(139,92,246,.2)":"1px solid rgba(255,255,255,.06)"
        }}>{m.content}</div>)}
        {snapLoading&&<div style={{alignSelf:"flex-start",padding:"10px 14px",borderRadius:16,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.06)"}}>
          <div style={{display:"flex",gap:4}}><div style={{width:6,height:6,borderRadius:99,background:"rgba(139,92,246,.5)",animation:"mb 1.4s ease infinite"}}/><div style={{width:6,height:6,borderRadius:99,background:"rgba(139,92,246,.5)",animation:"mb 1.4s ease .2s infinite"}}/><div style={{width:6,height:6,borderRadius:99,background:"rgba(139,92,246,.5)",animation:"mb 1.4s ease .4s infinite"}}/></div>
        </div>}
      </div>
      {/* Input */}
      <div style={{padding:"10px 16px calc(20px + env(safe-area-inset-bottom, 0px))",display:"flex",gap:8}}>
        <input value={snapInput} onChange={e=>setSnapInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();snapSend(snapInput)}}}
          placeholder="Ask a quick question..." style={{
          flex:1,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",
          borderRadius:12,padding:"10px 14px",color:"white",fontSize:14,outline:"none"
        }}/>
        <button onClick={()=>snapSend(snapInput)} disabled={!snapInput.trim()||snapLoading} style={{
          width:42,height:42,borderRadius:12,border:"none",cursor:snapInput.trim()?"pointer":"default",
          background:snapInput.trim()?"linear-gradient(135deg,#8B5CF6,#6366F1)":"rgba(255,255,255,.06)",
          display:"flex",alignItems:"center",justifyContent:"center",opacity:snapInput.trim()?1:.4
        }}><Send size={16} color="white"/></button>
      </div>
    </div>}
    <ConnectionStatus online={online}/>
    {/* v2.15.0: Admin Panel for HAM users */}
    {isHAM(user?.email)&&<AdminPanel open={adminPanelOpen} onClose={()=>setAdminPanelOpen(false)} lastResponse={lastABAResponse}/>}
    {toast&&<Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)}/>}
  </div>)}

// ⬡B:AUDRA.C4:FIX:error_boundary_export:20260403⬡
export default function MyABA(){ return <ErrorBoundary><MyABAInner/></ErrorBoundary> }
