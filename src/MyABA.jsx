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
  MessageCircle, Zap, Activity, Clock, CheckCircle, AlertTriangle,
  Sparkles, FileText, Eye, ChevronRight, User, LogOut, Users, Lock,
  Trash2, Archive, Search, WifiOff, Wifi, RefreshCw, Share2, Paperclip,
  FolderOpen, Image, File, FolderPlus, MoreVertical, Edit2, Copy, Briefcase,
  MapPin, ExternalLink, Building, Download, ChevronDown, Camera, Sunrise, BookOpen, GripVertical
} from "lucide-react";
import { auth, signInGoogle, signOutUser } from "./firebase.js";
import { useConversation } from "@elevenlabs/react";
import { onAuthStateChanged } from "firebase/auth";

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
const ABABASE = "https://abacia-services.onrender.com";


// ⬡B:aba_skins:MAP:icon_lookup:20260323⬡
// Maps icon names from /api/apps to lucide-react components
const ICON_MAP = {
  MessageSquare, Sunrise, Briefcase, Mail, MessageCircle, Camera,
  MapPin, CheckCircle, Phone, Settings, BookOpen, AlertTriangle,
  FileText, Calendar, Search, Activity, Sparkles, Users
};

// v1.2.0: Check online status
function isOnline() { return navigator.onLine; }

// v2.15.0: AIR with retry + offline awareness + proper userId handling
// HAM users: brandonjpiercesr@gmail.com, brandon@globalmajoritygroup.com
const HAM_EMAILS = ['brandonjpiercesr@gmail.com', 'brandon@globalmajoritygroup.com'];
function isHAM(email) { return HAM_EMAILS.includes(email?.toLowerCase()); }

async function airRequest(type, payload = {}, userId = "unknown", maxRetries = 3) {
  if (!isOnline()) {
    return { response: null, offline: true, queued: true };
  }
  
  // v2.15.0: Ensure message is never empty/undefined
  const message = (payload.message || "").trim() || "hello";
  
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // ⬡B:MYABA:ABABASE_WIRED:v2.16.0:20260321⬡
      // FIX 1: Send conversationHistory so ABA has context between messages
      // FIX 2: Send email field separately for HAM identity crosswalk
      const res = await fetch(`${ABABASE}/api/air/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message, 
          type: type || "text",
          user_id: userId,  // Backend expects user_id
          userId,           // Also send as userId for compatibility
          email: userId.includes("@") ? userId : undefined, // HAM crosswalk
          channel: "myaba",
          conversationId: payload.conversationId,
          conversationHistory: payload.conversationHistory || [],
          images: payload.images || [],  // ⬡B:MYABA:FIX:image_vision:20260321⬡
          context: { ...payload, timestamp: Date.now() } 
        }),
      });
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        console.error(`[AIR] ${res.status}:`, errorText);
        throw new Error(`REACH ${res.status}: ${errorText}`);
      }
      
      const data = await res.json();
      // Store last response for admin mode
      window.__lastABAResponse = data;
      return data;
    } catch (e) {
      lastError = e;
      console.error(`[AIR] Attempt ${attempt} failed:`, e.message);
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  return { response: null, error: true, errorMessage: lastError?.message };
}

// ⬡B:roadmap.tier3:STREAMING:airRequestStream:20260323⬡
// SSE streaming variant of airRequest. Streams text chunks via onChunk callback.
// Returns the full response when done. Used by sendMessage for real-time chat.
async function airRequestStream({ message, userId, channel, conversationId, conversationHistory, images, appScope, onChunk, onToolStart, onDone, onError }) {
  if (!isOnline()) {
    onError?.("You are offline");
    return { response: null, offline: true };
  }
  
  try {
    const res = await fetch(ABABASE + "/api/air/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: (message || "").trim() || "hello",
        user_id: userId,
        userId,
        email: userId?.includes("@") ? userId : undefined,
        channel: channel || "myaba",
        conversationId,
        conversationHistory: conversationHistory || [],
        images: images || [],
        appScope: appScope || undefined
      })
    });
    
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      onError?.("REACH " + res.status + ": " + errText);
      return { response: null, error: true, errorMessage: errText };
    }
    
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";
    let finalData = null;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const text = decoder.decode(value, { stream: true });
      const lines = text.split("\n").filter(l => l.startsWith("data: "));
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === "chunk") {
            accumulated += data.text;
            onChunk?.(accumulated, data.text);
          } else if (data.type === "tool_start") {
            onToolStart?.(data.tool);
          } else if (data.type === "done") {
            finalData = data;
            onDone?.(data);
          } else if (data.type === "error") {
            onError?.(data.error);
          }
        } catch {}
      }
    }
    
    return { response: accumulated || finalData?.fullResponse || "", ...finalData };
  } catch (e) {
    console.error("[AIR-STREAM] Error:", e.message);
    onError?.(e.message);
    return { response: null, error: true, errorMessage: e.message };
  }
}

// ⬡B:aba_skins:COMPONENT:app_launcher:20260323⬡
// CIP App Launcher — renders app grid from GET /api/apps
// Zero hardcoded apps. Backend is source of truth.
function AppLauncher({ userId, onAppSelect, currentApp }) {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(ABABASE + "/api/apps?userId=" + encodeURIComponent(userId));
        if (res.ok) {
          const data = await res.json();
          setApps(data.apps || []);
        }
      } catch (e) { console.error("[APPS] Load failed:", e); }
      finally { setLoading(false); }
    })();
  }, [userId]);
  
  if (loading) return null;
  
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 12,
      padding: "12px 8px"
    }}>
      {apps.map(app => {
        const IconComponent = ICON_MAP[app.icon] || Sparkles;
        const isActive = currentApp === app.id;
        return (
          <button
            key={app.id}
            onClick={() => onAppSelect(app)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              padding: "14px 4px",
              borderRadius: 16,
              border: isActive ? "1px solid rgba(139,92,246,.5)" : "1px solid transparent",
              background: isActive ? "rgba(139,92,246,.15)" : "rgba(255,255,255,.04)",
              cursor: "pointer",
              transition: "all .2s"
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: isActive ? "rgba(139,92,246,.25)" : "rgba(255,255,255,.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: isActive ? "0 0 12px rgba(139,92,246,.2)" : "none"
            }}>
              <IconComponent size={22} color={isActive ? "#a78bfa" : "rgba(255,255,255,.5)"} />
            </div>
            <span style={{
              fontSize: 11, fontWeight: 500, textAlign: "center",
              color: isActive ? "#c4b5fd" : "rgba(255,255,255,.45)",
              lineHeight: 1.2, maxWidth: 72, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap"
            }}>
              {app.name}
            </span>
          </button>
        );
      })}
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
async function airShareChat(userId, convId, emails) {
  try {
    const res = await fetch(`${ABABASE}/api/conversations/${convId}/share`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, sharedWith: emails })
    });
    return await res.json();
  } catch (e) { return { success: false, error: e.message }; }
}

// SPURT 4: Project functions - now using direct /api/projects endpoint
async function airLoadProjects(userId) {
  try {
    const res = await fetch(`${ABABASE}/api/projects?userId=${encodeURIComponent(userId)}`);
    if (res.ok) {
      const data = await res.json();
      return { success: true, projects: data.projects || [] };
    }
    return { success: false, projects: [] };
  } catch { return { success: false, projects: [] }; }
}
async function airCreateProject(userId, name, shared = false, sharedWith = []) {
  try {
    const res = await fetch(`${ABABASE}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, name, shared, sharedWith })
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, project: data.project };
    }
    return { success: false };
  } catch { return { success: false }; }
}

// SPURT 4B: Conversation functions - using /api/conversations endpoint
async function airLoadConversations(userId, projectId = null) {
  try {
    let url = `${ABABASE}/api/conversations?userId=${encodeURIComponent(userId)}`;
    if (projectId) url += `&projectId=${encodeURIComponent(projectId)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      return { success: true, conversations: data.conversations || [] };
    }
    return { success: false, conversations: [] };
  } catch { return { success: false, conversations: [] }; }
}

async function airCreateConversation(userId, title = 'New Chat', projectId = null, shared = false) {
  try {
    const res = await fetch(`${ABABASE}/api/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, title, projectId, shared })
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, conversation: data.conversation };
    }
    return { success: false };
  } catch { return { success: false }; }
}

async function airAddMessage(conversationId, role, content) {
  try {
    const res = await fetch(`${ABABASE}/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, content })
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, message: data.message };
    }
    return { success: false };
  } catch { return { success: false }; }
}

async function airUpdateConversation(conversationId, updates) {
  try {
    const res = await fetch(`${ABABASE}/api/conversations/${conversationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
    return res.ok;
  } catch { return false; }
}

async function airDeleteConversation(conversationId) {
  try {
    const res = await fetch(`${ABABASE}/api/conversations/${conversationId}`, {
      method: "DELETE"
    });
    return res.ok;
  } catch { return false; }
}

// SPURT 4C: Settings functions - using /api/settings endpoint
async function airLoadSettings(userId) {
  try {
    const res = await fetch(`${ABABASE}/api/settings?userId=${encodeURIComponent(userId)}`);
    if (res.ok) {
      const data = await res.json();
      return { success: true, settings: data.settings || {} };
    }
    return { success: false, settings: {} };
  } catch { return { success: false, settings: {} }; }
}

async function airSaveSettings(userId, settings) {
  try {
    const res = await fetch(`${ABABASE}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, settings })
    });
    return res.ok;
  } catch { return false; }
}

async function airAddProjectFile(userId, projectId, file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("projectId", projectId);
  formData.append("userId", userId);
  try {
    const res = await fetch(`${ABABASE}/api/project/upload`, { method: "POST", body: formData });
    return res.ok ? await res.json() : { error: true };
  } catch { return { error: true }; }
}

// ⬡B:MYABA:REAL_FILE_UPLOAD:v2.20:20260319⬡
// Read file as base64 and upload to Supabase Storage via backend
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']; // ⬡B:MYABA:FIX:image_vision:20260321⬡
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]; // Remove data:...;base64, prefix
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadAttachment(file, userId, conversationId) {
  try {
    console.log(`[UPLOAD] Reading ${file.name} (${file.type}, ${file.size} bytes)`);
    const base64 = await fileToBase64(file);
    console.log(`[UPLOAD] Uploading ${file.name} to backend...`);
    const res = await fetch(`${ABABASE}/api/attachments/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        base64,
        userId: userId || 'unknown',
        conversationId: conversationId || null
      })
    });
    if (!res.ok) {
      console.error(`[UPLOAD] Backend returned ${res.status}`);
      return null;
    }
    const data = await res.json();
    console.log(`[UPLOAD] Success:`, data.file?.filename, data.file?.url?.substring(0, 60));
    return data.file || null;
  } catch (e) {
    console.error('[UPLOAD] Error:', e);
    return null;
  }
}

async function uploadAttachmentsBatch(files, userId, conversationId) {
  try {
    const fileData = [];
    for (const file of files) {
      const base64 = await fileToBase64(file);
      fileData.push({ filename: file.name, contentType: file.type || 'application/octet-stream', base64 });
    }
    console.log(`[UPLOAD] Batch uploading ${fileData.length} files...`);
    const res = await fetch(`${ABABASE}/api/attachments/upload-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: fileData, userId: userId || 'unknown', conversationId })
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.files || []).filter(f => f.success);
  } catch (e) {
    console.error('[UPLOAD] Batch error:', e);
    return [];
  }
}

async function reachTranscribe(audioBlob) {
  try {
    const contentType = audioBlob.type || "audio/webm";
    const res = await fetch(`${ABABASE}/api/voice/transcribe`, { 
      method: "POST", 
      headers: { "Content-Type": contentType },
      body: audioBlob 
    });
    if (!res.ok) { console.error("[VOICE] Transcribe HTTP", res.status); return null; }
    return (await res.json()).transcript || null;
  } catch (e) { console.error("[VOICE] Transcribe error:", e); return null; }
}

async function reachSynthesize(text) {
  try {
    // ⬡B:MYABA.V2:voice:20260313⬡ Using VARA (Vocal Authorized Representative of ABA) voice
    const res = await fetch(`${ABABASE}/api/voice/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voiceId: "6aDn1KB0hjpdcocrUkmq", model: "eleven_turbo_v2_5" }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url || null; // Returns data URL from backend
  } catch { return null; }
}

async function reachPresence(userId) {
  try {
    const res = await fetch(`${ABABASE}/api/presence?userId=${userId}`);
    return res.ok ? await res.json() : { items: [] };
  } catch { return { items: [] }; }
}

async function airNameChat(messages, userId) {
  try {
    const firstUserMsg = messages.find(m => m.role === "user");
    if (!firstUserMsg) return null;
    
    // Immediate: use first 6 words of first user message
    const words = firstUserMsg.content.trim().split(/\s+/).slice(0, 6).join(" ");
    const localName = words.length > 35 ? words.substring(0, 35) + "..." : words;
    console.log("[CHAT] Named chat:", localName);
    return localName;
  } catch (e) { 
    console.error("[CHAT] Name error:", e);
    return null; 
  }
}

// v1.2.0: JARVIS-style greeting from AGENT DAWN (Daily Automated Wisdom Notifier)
async function getDawnGreeting(userId, userName) {
  const result = await airRequest("dawn_greeting", { 
    userName, includeCalendar: true, includeJobs: true, includeSports: true, context: "login"
  }, userId);
  
  if (result.response) {
    // DAWN returns rich contextual greeting
    if (typeof result.response === "object") {
      return result.response;
    }
    // Parse if stringified
    try {
      const parsed = JSON.parse(result.response);
      return parsed;
    } catch {
      return { greeting: result.response, context: "", proactive: null };
    }
  }
  
  // Fallback - JARVIS style with contextual structure (even without full data)
  const hour = new Date().getHours();
  const timeGreeting = hour < 5 ? "Late night" : hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : hour < 21 ? "Evening" : "Late night";
  const firstName = userName?.split(' ')[0] || "there";
  // JARVIS greeting = time + name + pending count + key update + personal reminder
  // Example: "Morning Brandon. 3 things pending, 1 conflict to decide, Brooke replied about Florida. Also - BJ birthday in 9 days."
  return {
    greeting: `${timeGreeting}, ${firstName}.`,
    context: "Checking your calendar, emails, and pending items...",
    proactive: null
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// F8: PUSH NOTIFICATIONS - Subscribe to ABA alerts
// ═══════════════════════════════════════════════════════════════════════════
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

async function subscribeToPush(userId) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[PUSH] Not supported');
      return null;
    }
    
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[PUSH] Permission denied');
      return null;
    }
    
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    
    // Send subscription to backend
    await fetch('https://abacia-services.onrender.com/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, subscription: subscription.toJSON() })
    });
    
    console.log('[PUSH] Subscribed:', subscription.endpoint.substring(0, 50));
    return subscription;
  } catch (e) {
    console.error('[PUSH] Subscribe failed:', e);
    return null;
  }
}

async function unsubscribeFromPush(userId) {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      await fetch('https://abacia-services.onrender.com/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
    }
  } catch (e) {
    console.error('[PUSH] Unsubscribe failed:', e);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Legacy support
function safeParseGreeting(response) {
  if (!response) return { title: "", subtitle: "" };
  let parsed = response;
  if (typeof parsed === "object" && parsed !== null) {
    return { title: parsed.greeting || parsed.title || "", subtitle: parsed.context || parsed.subtitle || "" };
  }
  try { parsed = JSON.parse(parsed); } catch {}
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch {}
  }
  if (typeof parsed === "object" && parsed !== null) {
    return { title: parsed.greeting || parsed.title || "", subtitle: parsed.context || parsed.subtitle || "" };
  }
  return { title: String(response), subtitle: "" };
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN PANEL — HAM-only agent activity viewer
// ═══════════════════════════════════════════════════════════════════════════
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
function CommandCenterView({ open, onClose, userEmail }) {
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
      const res = await fetch(`https://abacia-services.onrender.com/api/admin/dashboard?email=${encodeURIComponent(userEmail)}`);
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
    const response = await fetch(`https://abacia-services.onrender.com/api/myaba/briefing?userId=${encodeURIComponent(userId)}`);
    if (!response.ok) throw new Error('Briefing fetch failed');
    const data = await response.json();
    // Transform v2 response to expected format
    const briefing = data.briefing || data;
    return {
      summary: briefing.spoken_summary || briefing.greeting || '',
      handled: briefing.sections?.find(s => s.type === 'handled')?.items || [],
      pending: briefing.sections?.find(s => s.type === 'pending' || s.type === 'approvals')?.items || [],
      upcoming: briefing.sections?.find(s => s.type === 'calendar')?.items || [],
      jobs: briefing.sections?.find(s => s.type === 'jobs')?.items || [],
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
// v1.2.0: Premium animated ABA presence imported
import { ABAPresence } from './ABAPresence.jsx';

// Alias for backward compatibility
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
function renderInline(t){const p=[];let r=t;const re=/\*\*(.+?)\*\*/g;let m,last=0,k=0;while((m=re.exec(r))!==null){if(m.index>last)p.push(r.slice(last,m.index));p.push(<strong key={`b${k++}`} style={{color:"rgba(255,255,255,.95)"}}>{m[1]}</strong>);last=m.index+m[0].length}if(last<r.length)p.push(r.slice(last));return p.length>0?p:t}
function renderMd(text){if(!text)return null;let c=text.replace(/^\[(warm|firm|thoughtful|gentle|encouraging|excited|celebratory|annoyed)\]\s*/i,"");const lines=c.split("\n"),blocks=[];let i=0;while(i<lines.length){const ln=lines[i];if(ln.startsWith("```")){const lang=ln.slice(3).trim();const code=[];i++;while(i<lines.length&&!lines[i].startsWith("```")){code.push(lines[i]);i++}i++;const codeText=code.join("\n");blocks.push(<div key={`c${blocks.length}`} style={{position:"relative",margin:"8px 0"}}><div style={{position:"absolute",top:0,left:0,right:0,height:28,background:"rgba(139,92,246,.12)",borderRadius:"12px 12px 0 0",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 12px"}}><span style={{color:"rgba(139,92,246,.7)",fontSize:10,fontWeight:600,textTransform:"uppercase"}}>{lang||"code"}</span><button onClick={()=>navigator.clipboard.writeText(codeText)} style={{background:"none",border:"none",color:"rgba(255,255,255,.4)",cursor:"pointer",fontSize:9,padding:"2px 6px",borderRadius:4}}><Copy size={10}/></button></div><pre style={{background:"rgba(0,0,0,.5)",border:"1px solid rgba(139,92,246,.15)",borderRadius:12,padding:"36px 14px 12px",margin:0,overflowX:"auto",fontSize:12,lineHeight:1.6,fontFamily:"'SF Mono',Menlo,monospace"}}><code style={{color:"rgba(134,239,172,.85)"}}>{codeText}</code></pre></div>);continue}if(ln.startsWith("### "))blocks.push(<p key={`h${i}`} style={{fontWeight:600,color:"rgba(255,255,255,.8)",fontSize:13,margin:"10px 0 4px"}}>{ln.slice(4)}</p>);else if(ln.startsWith("## "))blocks.push(<p key={`h${i}`} style={{fontWeight:700,color:"rgba(255,255,255,.9)",fontSize:14,margin:"12px 0 4px"}}>{ln.slice(3)}</p>);else if(ln.startsWith("- ")||ln.startsWith("* "))blocks.push(<p key={`li${i}`} style={{paddingLeft:14,color:"rgba(255,255,255,.75)",fontSize:13,margin:"3px 0",position:"relative"}}><span style={{position:"absolute",left:0,color:"rgba(139,92,246,.6)"}}>•</span>{renderInline(ln.slice(2))}</p>);else if(ln.trim())blocks.push(<p key={`p${i}`} style={{color:"rgba(255,255,255,.85)",fontSize:13,margin:"4px 0",lineHeight:1.6}}>{renderInline(ln)}</p>);i++}return blocks}

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
    {!isU&&<div style={{width:28,height:28,borderRadius:99,background:"linear-gradient(135deg,#8B5CF6,#6366F1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 2px 8px rgba(139,92,246,.3)"}}><Sparkles size={14} style={{color:"white"}}/></div>}
    <div style={{maxWidth:"80%"}}><div style={{padding:"12px 16px",borderRadius:isU?"20px 20px 6px 20px":"20px 20px 20px 6px",background:isU?"linear-gradient(135deg,rgba(139,92,246,.35),rgba(99,102,241,.3))":"rgba(255,255,255,.08)",backdropFilter:"blur(12px)",border:`1px solid ${isU?"rgba(139,92,246,.3)":"rgba(255,255,255,.1)"}`,boxShadow:isU?"0 4px 16px rgba(139,92,246,.15)":"inset 0 1px 1px rgba(255,255,255,.08), 0 4px 12px rgba(0,0,0,.15)"}}>{msg.output?<OutputCard output={msg.output}/>:<div>{renderMd(msg.content)}</div>}
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

function Typing(){return(<div style={{display:"flex",justifyContent:"flex-start",padding:"3px 0",gap:8,alignItems:"flex-end"}}><div style={{width:26,height:26,borderRadius:99,background:"linear-gradient(135deg,#8B5CF6,#6366F1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Sparkles size={12} style={{color:"white"}}/></div><div style={{padding:"12px 18px",borderRadius:"18px 18px 18px 4px",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",display:"flex",gap:5,alignItems:"center"}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:99,background:"rgba(139,92,246,.6)",animation:`mp 1.4s ease-in-out ${i*.2}s infinite`}}/>)}</div></div>)}

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
      if(source==="ai")setLastMsg(prev=>prev+message)
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

  const colors={idle:"139,92,246",connecting:"245,158,11",listening:"139,92,246",thinking:"245,158,11",speaking:"16,185,129",error:"239,68,68"};
  const c=colors[orbState]||colors.idle;
  const icons={idle:Mic,connecting:Sparkles,listening:Mic,thinking:Sparkles,speaking:Volume2,error:AlertTriangle};
  const Icon=icons[orbState]||Mic;
  const labels={idle:"TAP TO TALK",connecting:"CONNECTING",listening:"LISTENING",thinking:"THINKING",speaking:"SPEAKING",error:"ERROR"};
  const isActive=orbState!=="idle"&&orbState!=="error";

  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flex:1,position:"relative"}}>
      {/* Pulsing rings */}
      <div style={{position:"absolute",width:220,height:220,borderRadius:"50%",border:`1px solid rgba(${c},.12)`,animation:isActive?"pulse 2s ease-out infinite":"none",opacity:.5,pointerEvents:"none"}}/>
      <div style={{position:"absolute",width:300,height:300,borderRadius:"50%",border:`1px solid rgba(${c},.08)`,animation:isActive?"pulse 2s ease-out .5s infinite":"none",opacity:.3,pointerEvents:"none"}}/>
      <div style={{position:"absolute",width:380,height:380,borderRadius:"50%",border:`1px solid rgba(${c},.05)`,animation:isActive?"pulse 2s ease-out 1s infinite":"none",opacity:.2,pointerEvents:"none"}}/>

      {/* Main orb */}
      <button onClick={handleTap} style={{
        width:160,height:160,borderRadius:"50%",border:"none",cursor:"pointer",
        background:`radial-gradient(circle at 30% 30%, rgba(${c},.5), rgba(${c},.25))`,
        boxShadow:`0 0 80px rgba(${c},.4), inset 0 0 40px rgba(255,255,255,.1)`,
        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,color:"white",
        animation:orbState==="listening"?"breathe 1s ease-in-out infinite":orbState==="speaking"?"breathe 1.5s ease-in-out infinite":"breathe 3s ease-in-out infinite",
        transition:"all .3s"
      }}>
        {orbState==="thinking"||orbState==="connecting"?<div style={{animation:"spin 1s linear infinite"}}><Sparkles size={44}/></div>:<Icon size={44}/>}
        <span style={{fontSize:11,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase"}}>{labels[orbState]}</span>
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
      {lastMsg&&orbState==="idle"&&<div style={{position:"absolute",bottom:20,left:16,right:16,padding:"12px 16px",background:"rgba(0,0,0,.5)",backdropFilter:"blur(12px)",borderRadius:16,border:"1px solid rgba(139,92,246,.15)"}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
          <Sparkles size={10} style={{color:"rgba(139,92,246,.7)"}}/>
          <span style={{color:"rgba(139,92,246,.6)",fontSize:9,fontWeight:600}}>ABA SAID</span>
        </div>
        <p style={{color:"rgba(255,255,255,.7)",fontSize:12,margin:0,lineHeight:1.4,maxHeight:60,overflow:"hidden"}}>{lastMsg.substring(0,180)}{lastMsg.length>180?"...":""}</p>
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
        const res=await fetch("https://abacia-services.onrender.com/api/voice/synthesize",{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({text:currentStep.voice,voiceId:"6aDn1KB0hjpdcocrUkmq"})
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
        {speaking?<Volume2 size={36} style={{color:"white"}}/>:<Sparkles size={36} style={{color:"white"}}/>}
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
            const hamMap={"brandonjpiercesr@gmail.com":"brandon","ericreeselane@gmail.com":"eric","bryanjpiercejr@gmail.com":"bj","cj.d.moore32@gmail.com":"cj","shields.devante@gmail.com":"vante","dmurrayjr34@gmail.com":"dwayne"};
            const hamId=hamMap[email]||email.split("@")[0];
            window.open(`https://abacia-services.onrender.com/api/nylas/connect?ham_id=${encodeURIComponent(hamId)}`,"_blank");
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
function EmailView({userId}){
  const ABABASE="https://abacia-services.onrender.com";
  const[emails,setEmails]=useState([]);
  const[loading,setLoading]=useState(true);
  const[selectedEmail,setSelectedEmail]=useState(null);
  const[folder,setFolder]=useState("inbox"); // inbox | sent

  const loadEmails=async(f)=>{
    setLoading(true);setSelectedEmail(null);
    try{
      const r=await fetch(`${ABABASE}/api/email/${f}?userId=${encodeURIComponent(userId)}&limit=20`);
      if(r.ok){const d=await r.json();setEmails(d.emails||d.messages||d.data||[])}
      else setEmails([]);
    }catch(e){console.error("[EMAIL]",e);setEmails([])}
    setLoading(false);
  };

  useEffect(()=>{loadEmails(folder)},[folder]);

  if(loading)return <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:40,height:40,borderRadius:"50%",border:"3px solid rgba(139,92,246,.2)",borderTopColor:"rgba(139,92,246,.8)",animation:"spin 1s linear infinite"}}/></div>;

  return(<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
    {/* Folder toggle */}
    <div style={{display:"flex",gap:4,padding:"4px 0",flexShrink:0}}>
      {["inbox","sent"].map(f=>(
        <button key={f} onClick={()=>{setFolder(f);loadEmails(f)}} style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:folder===f?600:400,background:folder===f?"rgba(139,92,246,.2)":"rgba(255,255,255,.04)",color:folder===f?"rgba(139,92,246,.95)":"rgba(255,255,255,.4)",textTransform:"capitalize"}}>{f}</button>
      ))}
      <button onClick={()=>loadEmails(folder)} style={{padding:"8px 12px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(255,255,255,.04)",color:"rgba(255,255,255,.4)",fontSize:12}}><RefreshCw size={14}/></button>
    </div>

    {/* Selected email detail */}
    {selectedEmail&&<div style={{flex:1,overflowY:"auto",padding:8}}>
      <button onClick={()=>setSelectedEmail(null)} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:8,border:"1px solid rgba(255,255,255,.1)",background:"transparent",color:"rgba(255,255,255,.5)",cursor:"pointer",fontSize:11,marginBottom:8}}><ChevronRight size={12} style={{transform:"rotate(180deg)"}}/>Back</button>
      <div style={{padding:14,borderRadius:14,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.06)"}}>
        <p style={{color:"rgba(255,255,255,.9)",fontSize:14,fontWeight:600,margin:"0 0 4px"}}>{selectedEmail.subject||"(no subject)"}</p>
        <p style={{color:"rgba(255,255,255,.5)",fontSize:11,margin:"0 0 2px"}}>From: {selectedEmail.from?.[0]?.name||selectedEmail.from?.[0]?.email||"Unknown"}</p>
        <p style={{color:"rgba(255,255,255,.3)",fontSize:10,margin:"0 0 12px"}}>{selectedEmail.date?new Date(selectedEmail.date*1000).toLocaleString():""}</p>
        <div style={{color:"rgba(255,255,255,.7)",fontSize:12,lineHeight:1.6}} dangerouslySetInnerHTML={{__html:selectedEmail.body||selectedEmail.snippet||"No content"}}/>
      </div>
    </div>}

    {/* Email list */}
    {!selectedEmail&&<div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:2,padding:"4px 0"}}>
      {emails.length===0&&<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,padding:20}}>
        <Mail size={36} style={{color:"rgba(139,92,246,.3)"}}/>
        <p style={{color:"rgba(255,255,255,.4)",fontSize:13,textAlign:"center"}}>{folder==="inbox"?"No emails found. Connect your email in Settings.":"No sent emails."}</p>
      </div>}
      {emails.map((em,i)=>{
        const from=em.from?.[0]?.name||em.from?.[0]?.email||"Unknown";
        const unread=em.unread!==false;
        return(
        <div key={em.id||i} onClick={()=>setSelectedEmail(em)} style={{padding:"12px 10px",borderRadius:10,background:unread?"rgba(139,92,246,.06)":"rgba(255,255,255,.02)",border:`1px solid ${unread?"rgba(139,92,246,.12)":"rgba(255,255,255,.04)"}`,cursor:"pointer",display:"flex",gap:10,alignItems:"flex-start"}}>
          <div style={{width:32,height:32,borderRadius:99,background:"linear-gradient(135deg,rgba(139,92,246,.3),rgba(99,102,241,.2))",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{color:"white",fontSize:13,fontWeight:600}}>{from.charAt(0).toUpperCase()}</span>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
              <span style={{color:unread?"rgba(255,255,255,.9)":"rgba(255,255,255,.6)",fontSize:12,fontWeight:unread?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"60%"}}>{from}</span>
              <span style={{color:"rgba(255,255,255,.25)",fontSize:9,flexShrink:0}}>{em.date?new Date(em.date*1000).toLocaleDateString():""}</span>
            </div>
            <p style={{color:unread?"rgba(255,255,255,.7)":"rgba(255,255,255,.45)",fontSize:11,fontWeight:unread?500:400,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{em.subject||"(no subject)"}</p>
            <p style={{color:"rgba(255,255,255,.3)",fontSize:10,margin:"2px 0 0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{em.snippet||""}</p>
          </div>
          {unread&&<div style={{width:8,height:8,borderRadius:99,background:"#8B5CF6",flexShrink:0,marginTop:4}}/>}
        </div>
        );
      })}
    </div>}
  </div>);
}

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
function BriefingSetup({userId,onRefresh}){
  const ABABASE="https://abacia-services.onrender.com";
  const[selected,setSelected]=useState([]);
  const[custom,setCustom]=useState("");
  const[saving,setSaving]=useState(false);
  const[done,setDone]=useState(false);

  const INTEREST_OPTIONS=[
    {id:"nba",label:"NBA Basketball",emoji:"🏀"},
    {id:"nfl",label:"NFL Football",emoji:"🏈"},
    {id:"college_basketball",label:"College Basketball",emoji:"🎓"},
    {id:"politics",label:"Politics",emoji:"🏛"},
    {id:"tech",label:"Tech & AI",emoji:"💻"},
    {id:"nonprofit",label:"Nonprofit Sector",emoji:"🤝"},
    {id:"finance",label:"Finance & Markets",emoji:"📈"},
    {id:"local_nc",label:"North Carolina News",emoji:"📍"},
    {id:"music",label:"Music",emoji:"🎵"},
    {id:"health",label:"Health & Wellness",emoji:"💪"},
  ];

  const toggle=(id)=>setSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);

  const save=async()=>{
    setSaving(true);
    const interests=[...selected.map(id=>INTEREST_OPTIONS.find(o=>o.id===id)?.label||id)];
    if(custom.trim())interests.push(...custom.split(",").map(s=>s.trim()).filter(Boolean));
    try{
      await fetch(`${ABABASE}/api/air/process`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({message:`Save my news interests for DAWN briefings: ${interests.join(", ")}`,user_id:userId,channel:"myaba"})
      });
      // Also save directly to brain as HAM preference
      await fetch(`https://htlxjkbrstpwwtzsbyvb.supabase.co/rest/v1/aba_memory`,{
        method:"POST",
        headers:{"apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0bHhqa2Jyc3Rwd3d0enNieXZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MzI4MjEsImV4cCI6MjA4NjEwODgyMX0.MOgNYkezWpgxTO3ZHd0omZ0WLJOOR-tL7hONXWG9eBw","Content-Type":"application/json","Prefer":"return=minimal"},
        body:JSON.stringify({source:`ham.preferences.${(userId||"").split("@")[0]}`,memory_type:"ham_preferences",content:JSON.stringify({news_interests:interests,updated:new Date().toISOString()}),importance:7,tags:["preferences","news",userId]})
      });
    }catch(e){console.error("[BRIEFING] Save prefs error:",e)}
    setSaving(false);setDone(true);
    setTimeout(()=>onRefresh(),1000);
  };

  if(done)return(<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}>
    <CheckCircle size={48} style={{color:"rgba(16,185,129,.6)"}}/>
    <p style={{color:"rgba(255,255,255,.6)",fontSize:14}}>Preferences saved. Loading your briefing...</p>
  </div>);

  return(<div style={{flex:1,overflowY:"auto",padding:"8px 4px"}}>
    <div style={{textAlign:"center",marginBottom:16}}>
      <Sparkles size={32} style={{color:"rgba(139,92,246,.6)",marginBottom:8}}/>
      <p style={{color:"rgba(255,255,255,.8)",fontSize:16,fontWeight:600,margin:"0 0 4px"}}>Set up your briefing</p>
      <p style={{color:"rgba(255,255,255,.4)",fontSize:12,margin:0}}>What do you want ABA to keep you updated on?</p>
    </div>

    <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
      {INTEREST_OPTIONS.map(opt=>{
        const active=selected.includes(opt.id);
        return(<button key={opt.id} onClick={()=>toggle(opt.id)} style={{
          padding:"10px 14px",borderRadius:12,border:`1px solid ${active?"rgba(139,92,246,.3)":"rgba(255,255,255,.08)"}`,
          background:active?"rgba(139,92,246,.15)":"rgba(255,255,255,.03)",
          color:active?"rgba(139,92,246,.95)":"rgba(255,255,255,.5)",
          cursor:"pointer",fontSize:12,fontWeight:active?600:400,display:"flex",alignItems:"center",gap:6
        }}><span>{opt.emoji}</span>{opt.label}</button>);
      })}
    </div>

    <input value={custom} onChange={e=>setCustom(e.target.value)} placeholder="Other interests (comma separated)..." style={{
      width:"100%",padding:"12px 14px",borderRadius:12,border:"1px solid rgba(255,255,255,.08)",
      background:"rgba(255,255,255,.03)",color:"rgba(255,255,255,.8)",fontSize:12,outline:"none",marginBottom:16,boxSizing:"border-box"
    }}/>

    <button disabled={saving||(selected.length===0&&!custom.trim())} onClick={save} style={{
      width:"100%",padding:"14px",borderRadius:12,border:"none",cursor:"pointer",
      background:selected.length>0||custom.trim()?"linear-gradient(135deg,#8B5CF6,#6366F1)":"rgba(255,255,255,.05)",
      color:selected.length>0||custom.trim()?"white":"rgba(255,255,255,.3)",fontSize:14,fontWeight:600
    }}>{saving?"Saving...":"Save & Load Briefing"}</button>
  </div>);
}

function BriefingView({data,loading,onRefresh,userId}){
  if(loading){
    return(<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{width:50,height:50,borderRadius:"50%",border:"3px solid rgba(139,92,246,.2)",borderTopColor:"rgba(139,92,246,.8)",animation:"spin 1s linear infinite"}}/>
      <p style={{color:"rgba(255,255,255,.5)",fontSize:13}}>Loading briefing...</p>
    </div>);
  }
  
  if(!data){
    return(<BriefingSetup userId={userId} onRefresh={onRefresh}/>);
  }
  
  const Section=({title,icon:Icon,items,emptyText,color})=>(
    <div style={{marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <Icon size={16} style={{color:color||"rgba(139,92,246,.7)"}}/>
        <span style={{color:"rgba(255,255,255,.8)",fontSize:13,fontWeight:600}}>{title}</span>
        {items?.length>0&&<span style={{background:"rgba(139,92,246,.2)",color:"rgba(139,92,246,.9)",fontSize:10,padding:"2px 8px",borderRadius:99}}>{items.length}</span>}
      </div>
      {items?.length>0?(
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {items.map((item,i)=>(
            <div key={i} style={{padding:"10px 14px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12}}>
              <p style={{color:"rgba(255,255,255,.8)",fontSize:12,margin:0,lineHeight:1.5}}>{typeof item==="string"?item:item.text||item.title||item.description||JSON.stringify(item)}</p>
              {item.time&&<span style={{color:"rgba(255,255,255,.4)",fontSize:10}}>{item.time}</span>}
            </div>
          ))}
        </div>
      ):(
        <p style={{color:"rgba(255,255,255,.3)",fontSize:12,fontStyle:"italic",padding:"8px 0"}}>{emptyText}</p>
      )}
    </div>
  );
  
  return(<div style={{flex:1,overflowY:"auto",padding:"8px 4px"}}>
    {/* Summary */}
    {data.summary&&<div style={{padding:"14px 16px",background:"linear-gradient(135deg,rgba(139,92,246,.15),rgba(99,102,241,.1))",border:"1px solid rgba(139,92,246,.2)",borderRadius:14,marginBottom:16}}>
      <p style={{color:"rgba(255,255,255,.9)",fontSize:13,margin:0,lineHeight:1.6}}>{data.summary}</p>
    </div>}
    
    {/* Handled - What ABA did autonomously */}
    <Section title="Handled" icon={CheckCircle} items={data.handled} emptyText="Nothing handled yet today" color="#10B981"/>
    
    {/* Pending - Needs your attention */}
    <Section title="Pending" icon={AlertTriangle} items={data.pending} emptyText="Nothing pending" color="#F59E0B"/>
    
    {/* Upcoming - Calendar events */}
    <Section title="Upcoming" icon={Calendar} items={data.upcoming} emptyText="No upcoming events" color="#3B82F6"/>
    
    {/* News */}
    {data.news&&data.news.length>0&&<Section title="News" icon={Zap} items={data.news} emptyText="" color="#F59E0B"/>}
    
    {/* Refresh button */}
    <div style={{display:"flex",justifyContent:"center",paddingTop:8}}>
      <button onClick={onRefresh} style={{display:"flex",alignItems:"center",gap:6,padding:"10px 20px",borderRadius:10,border:"none",cursor:"pointer",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.4)",fontSize:12}}>
        <RefreshCw size={14}/>Refresh
      </button>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════
// F6: APPROVE VIEW - Swipe stack of pending decisions
// ⬡B:MYABA.V2:approvals:20260313⬡ Updated to use /api/myaba/approvals
// ═══════════════════════════════════════════════════════════════════════════
function ApproveView({userId,onAction}){
  const[items,setItems]=useState([]);
  const[loading,setLoading]=useState(true);
  const[currentIndex,setCurrentIndex]=useState(0);
  const[swipeDir,setSwipeDir]=useState(null);
  const[touchStart,setTouchStart]=useState(null);
  const[touchDelta,setTouchDelta]=useState(0);
  const[velocityData,setVelocityData]=useState(null);
  const[velocityLoading,setVelocityLoading]=useState(false);
  const[showVelocity,setShowVelocity]=useState(false);
  
  // Fetch pending approvals from v2 endpoint
  useEffect(()=>{
    (async()=>{
      try{
        const response=await fetch(`https://abacia-services.onrender.com/api/myaba/approvals?userId=${encodeURIComponent(userId)}`);
        if(response.ok){
          const data=await response.json();
          setItems(data.items||[]);
        }
      }catch(e){console.error("[APPROVE] Fetch failed:",e)}
      setLoading(false);
    })();
  },[userId]);
  
  const currentItem=items[currentIndex];
  
  const handleSwipe=(direction)=>{
    if(!currentItem)return;
    setSwipeDir(direction);
    
    // Execute action via v2 endpoint — field must be 'action' not 'decision'
    const action=direction==="right"?"approve":"reject";
    fetch(`https://abacia-services.onrender.com/api/myaba/approvals/${currentItem.id}`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action,userId})
    }).catch(e=>console.error('[APPROVE] Action failed:',e));
    
    // Animate out then advance
    setTimeout(()=>{
      setSwipeDir(null);
      setTouchDelta(0);
      if(currentIndex<items.length-1){
        setCurrentIndex(currentIndex+1);
      }else{
        setItems([]);
      }
    },300);
  };
  
  const handleTouchStart=(e)=>setTouchStart(e.touches[0].clientX);
  const handleTouchMove=(e)=>{
    if(touchStart===null)return;
    setTouchDelta(e.touches[0].clientX-touchStart);
  };
  const handleTouchEnd=()=>{
    if(Math.abs(touchDelta)>100){
      handleSwipe(touchDelta>0?"right":"left");
    }else{
      setTouchDelta(0);
    }
    setTouchStart(null);
  };
  
  if(loading){
    return(<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{width:50,height:50,borderRadius:"50%",border:"3px solid rgba(139,92,246,.2)",borderTopColor:"rgba(139,92,246,.8)",animation:"spin 1s linear infinite"}}/>
      <p style={{color:"rgba(255,255,255,.5)",fontSize:13}}>Loading pending items...</p>
    </div>);
  }
  
  if(items.length===0||currentIndex>=items.length){
    return(<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:20}}>
      <CheckCircle size={56} style={{color:"rgba(16,185,129,.6)"}}/>
      <p style={{color:"rgba(255,255,255,.7)",fontSize:16,fontWeight:600}}>All caught up!</p>
      <p style={{color:"rgba(255,255,255,.4)",fontSize:13,textAlign:"center"}}>No pending decisions right now</p>
      <button disabled={velocityLoading} onClick={async()=>{
        setVelocityLoading(true);
        try{
          const r=await fetch(`https://abacia-services.onrender.com/api/awa/decisions/analysis?userId=${encodeURIComponent(userId)}`);
          const d=await r.json();if(d.success)setVelocityData(d);
        }catch(e){console.error("[VELOCITY]",e)}
        setVelocityLoading(false);setShowVelocity(true);
      }} style={{padding:"10px 20px",borderRadius:10,border:"1px solid rgba(139,92,246,.2)",background:"rgba(139,92,246,.08)",color:"rgba(139,92,246,.8)",cursor:"pointer",fontSize:12,fontWeight:500}}>
        {velocityLoading?"Analyzing...":"View Decision Patterns"}
      </button>
      {showVelocity&&velocityData&&(
      <div style={{width:"100%",maxWidth:360,padding:14,borderRadius:12,background:"rgba(139,92,246,.06)",border:"1px solid rgba(139,92,246,.1)"}}>
        <p style={{color:"rgba(139,92,246,.8)",fontSize:12,fontWeight:600,margin:"0 0 8px"}}>Decision Velocity</p>
        <div style={{display:"flex",gap:12,marginBottom:8}}>
          <div style={{flex:1,textAlign:"center"}}><p style={{color:"rgba(255,255,255,.8)",fontSize:20,fontWeight:700,margin:0}}>{velocityData.decisions}</p><p style={{color:"rgba(255,255,255,.3)",fontSize:9,margin:0}}>decisions</p></div>
          <div style={{flex:1,textAlign:"center"}}><p style={{color:"rgba(255,255,255,.8)",fontSize:20,fontWeight:700,margin:0}}>{velocityData.avgResponseMins}m</p><p style={{color:"rgba(255,255,255,.3)",fontSize:9,margin:0}}>avg time</p></div>
          <div style={{flex:1,textAlign:"center"}}><p style={{color:"rgba(255,255,255,.8)",fontSize:20,fontWeight:700,margin:0}}>{velocityData.approvalRate}%</p><p style={{color:"rgba(255,255,255,.3)",fontSize:9,margin:0}}>approval rate</p></div>
        </div>
        {velocityData.autoApprovalCandidates&&velocityData.autoApprovalCandidates.length>0&&(
          <div style={{marginTop:8,padding:8,borderRadius:8,background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.15)"}}>
            <p style={{color:"#10B981",fontSize:10,fontWeight:600,margin:"0 0 4px"}}>AUTO-APPROVAL CANDIDATES</p>
            {velocityData.autoApprovalCandidates.map((c,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0"}}>
                <span style={{color:"rgba(255,255,255,.6)",fontSize:11}}>{c.type} ({c.approvalRate}% in {c.avgResponseMins}m)</span>
                <button onClick={async()=>{
                  try{await fetch("https://abacia-services.onrender.com/api/awa/decisions/auto-approve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId,type:c.type,enabled:true})})}catch{}
                }} style={{padding:"3px 8px",borderRadius:4,border:"1px solid rgba(16,185,129,.2)",background:"rgba(16,185,129,.1)",color:"#10B981",cursor:"pointer",fontSize:9,fontWeight:600}}>Enable</button>
              </div>
            ))}
          </div>
        )}
        {velocityData.message&&<p style={{color:"rgba(255,255,255,.4)",fontSize:10,margin:"8px 0 0",textAlign:"center"}}>{velocityData.message}</p>}
      </div>
      )}
    </div>);
  }
  
  const urgencyColors={5:"#EF4444",4:"#F59E0B",3:"#3B82F6",2:"#6B7280",1:"#6B7280"};
  const typeIcons={email:Mail,calendar:Calendar,task:CheckCircle,confirm:AlertTriangle};
  const TypeIcon=typeIcons[currentItem.type]||Zap;
  
  const cardStyle={
    transform:`translateX(${swipeDir==="right"?300:swipeDir==="left"?-300:touchDelta}px) rotate(${(swipeDir==="right"?15:swipeDir==="left"?-15:touchDelta/20)}deg)`,
    opacity:swipeDir?0:1,
    transition:swipeDir?"transform .3s, opacity .3s":"none"
  };
  
  return(<div style={{flex:1,display:"flex",flexDirection:"column",padding:"8px 4px"}}>
    {/* Progress */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,padding:"0 8px"}}>
      <span style={{color:"rgba(255,255,255,.4)",fontSize:11}}>{currentIndex+1} of {items.length}</span>
      <div style={{flex:1,margin:"0 12px",height:3,background:"rgba(255,255,255,.1)",borderRadius:99}}>
        <div style={{width:`${((currentIndex+1)/items.length)*100}%`,height:"100%",background:"rgba(139,92,246,.6)",borderRadius:99,transition:"width .3s"}}/>
      </div>
      <span style={{color:"rgba(255,255,255,.4)",fontSize:11}}>{items.length-currentIndex-1} left</span>
    </div>
    
    {/* Swipe hints */}
    <div style={{display:"flex",justifyContent:"space-between",padding:"0 20px",marginBottom:8}}>
      <div style={{display:"flex",alignItems:"center",gap:6,opacity:touchDelta<-30?.8:.3,transition:"opacity .2s"}}>
        <X size={16} style={{color:"#EF4444"}}/><span style={{color:"#EF4444",fontSize:11,fontWeight:600}}>Reject</span>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6,opacity:touchDelta>30?.8:.3,transition:"opacity .2s"}}>
        <span style={{color:"#10B981",fontSize:11,fontWeight:600}}>Approve</span><CheckCircle size={16} style={{color:"#10B981"}}/>
      </div>
    </div>
    
    {/* Card */}
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}}
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <div style={{width:"100%",maxWidth:340,background:"rgba(255,255,255,.06)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,.1)",borderRadius:20,padding:20,boxShadow:"0 8px 32px rgba(0,0,0,.3)",...cardStyle}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <div style={{width:40,height:40,borderRadius:12,background:`rgba(${currentItem.urgency>=4?"239,68,68":currentItem.urgency>=3?"59,130,246":"139,92,246"},.15)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <TypeIcon size={20} style={{color:urgencyColors[currentItem.urgency]||"#8B5CF6"}}/>
          </div>
          <div style={{flex:1}}>
            <p style={{color:"rgba(255,255,255,.9)",fontSize:14,fontWeight:600,margin:0}}>{currentItem.title}</p>
            <p style={{color:"rgba(255,255,255,.4)",fontSize:11,margin:"2px 0 0",textTransform:"capitalize"}}>{currentItem.type}</p>
          </div>
          {currentItem.urgency>=4&&<span style={{background:"rgba(239,68,68,.15)",color:"#EF4444",fontSize:9,fontWeight:700,padding:"3px 8px",borderRadius:99}}>URGENT</span>}
        </div>
        
        {/* Summary */}
        <p style={{color:"rgba(255,255,255,.7)",fontSize:13,lineHeight:1.6,margin:"0 0 16px"}}>{currentItem.summary}</p>
        
        {/* Options */}
        {currentItem.options&&currentItem.options.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {currentItem.options.map((opt,i)=>(
            <button key={i} onClick={()=>handleSwipe(i===0?"right":"left")} style={{padding:"8px 14px",borderRadius:10,border:"none",cursor:"pointer",background:i===0?"rgba(16,185,129,.2)":"rgba(239,68,68,.15)",color:i===0?"#10B981":"#EF4444",fontSize:12,fontWeight:500}}>
              {opt}
            </button>
          ))}
        </div>}
      </div>
    </div>
    
    {/* Bottom buttons for desktop */}
    <div style={{display:"flex",justifyContent:"center",gap:24,padding:"16px 0"}}>
      <button onClick={()=>handleSwipe("left")} style={{width:56,height:56,borderRadius:"50%",border:"2px solid rgba(239,68,68,.3)",background:"rgba(239,68,68,.1)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <X size={24} style={{color:"#EF4444"}}/>
      </button>
      <button onClick={()=>handleSwipe("right")} style={{width:56,height:56,borderRadius:"50%",border:"2px solid rgba(16,185,129,.3)",background:"rgba(16,185,129,.1)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <CheckCircle size={24} style={{color:"#10B981"}}/>
      </button>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMOS VIEW - Internal HAM-to-HAM messaging
// ⬡B:MYABA.V2:memos:20260319⬡
// ═══════════════════════════════════════════════════════════════════════════
function MemosView({userId}){
  const[memos,setMemos]=useState([]);
  const[loading,setLoading]=useState(true);
  const[view,setView]=useState("inbox"); // inbox | sent | thread
  const[threadUser,setThreadUser]=useState(null);
  const[thread,setThread]=useState([]);
  const[composing,setComposing]=useState(false);
  const[composeForm,setComposeForm]=useState({to:"",subject:"",body:"",priority:"normal"});
  const[sending,setSending]=useState(false);

  const TEAM=[
    {id:"brandon",name:"Brandon",email:"brandonjpiercesr@gmail.com"},
    {id:"eric",name:"Eric",email:"eric@globalmajoritygroup.com"},
    {id:"bj",name:"BJ",email:"bj@globalmajoritygroup.com"},
    {id:"cj",name:"CJ",email:"cj@globalmajoritygroup.com"},
    {id:"vante",name:"Vante",email:"vante@globalmajoritygroup.com"},
    {id:"dwayne",name:"Dwayne",email:"dwayne@globalmajoritygroup.com"}
  ].filter(t=>t.id!==userId&&t.id!==(userId||"").split("@")[0]);

  const loadMemos=async(type)=>{
    setLoading(true);
    try{
      const r=await fetch(`${ABABASE}/api/memos/${type}?userId=${encodeURIComponent(userId)}`);
      const d=await r.json();
      if(d.success)setMemos(d.memos||[]);
    }catch(e){console.error("[MEMOS]",e)}
    setLoading(false);
  };

  const loadThread=async(otherUser)=>{
    setLoading(true);
    try{
      const r=await fetch(`${ABABASE}/api/memos/thread/${encodeURIComponent(otherUser)}?userId=${encodeURIComponent(userId)}`);
      const d=await r.json();
      if(d.success)setThread(d.thread||[]);
      setThreadUser(otherUser);setView("thread");
    }catch(e){console.error("[MEMOS]",e)}
    setLoading(false);
  };

  useEffect(()=>{loadMemos("inbox")},[]);

  const sendMemo=async()=>{
    if(!composeForm.to||!composeForm.body.trim())return;
    setSending(true);
    try{
      const r=await fetch(`${ABABASE}/api/memos/send`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...composeForm,userId})});
      const d=await r.json();
      if(d.success){setComposing(false);setComposeForm({to:"",subject:"",body:"",priority:"normal"});loadMemos(view==="sent"?"sent":"inbox")}
    }catch(e){console.error("[MEMOS] send error:",e)}
    setSending(false);
  };

  const markRead=async(memoId)=>{
    try{
      await fetch(`${ABABASE}/api/memos/${memoId}/read`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId})});
      setMemos(prev=>prev.map(m=>m.id===memoId?{...m,read:true,readAt:new Date().toISOString()}:m));
    }catch(e){console.error("[MEMOS] read error:",e)}
  };

  const react=async(memoId,emoji)=>{
    try{
      const r=await fetch(`${ABABASE}/api/memos/${memoId}/react`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId,reaction:emoji})});
      const d=await r.json();
      if(d.success){
        setMemos(prev=>prev.map(m=>m.id===memoId?{...m,reactions:d.reactions}:m));
        setThread(prev=>prev.map(m=>m.id===memoId?{...m,reactions:d.reactions}:m));
      }
    }catch(e){console.error("[MEMOS] react error:",e)}
  };

  const TEAM_COLORS={brandon:"#8B5CF6",eric:"#3B82F6",bj:"#10B981",cj:"#F59E0B",vante:"#F97316",dwayne:"#EC4899",raquel:"#A78BFA"};
  
  const renderMemo=(m)=>{
    const senderName=m.from===userId?"You":m.fromName||m.from;
    const senderColor=TEAM_COLORS[(m.from||"").toLowerCase()]||"#6B7280";
    const initial=(senderName||"?").charAt(0).toUpperCase();
    const isUnread=m.read===false&&m.to===userId;
    
    return(
    <div key={m.id||m.dbId} onClick={()=>{if(isUnread)markRead(m.id)}} style={{padding:"12px 14px",borderRadius:14,background:isUnread?"rgba(139,92,246,.08)":"rgba(255,255,255,.03)",border:`1px solid ${isUnread?"rgba(139,92,246,.2)":"rgba(255,255,255,.05)"}`,marginBottom:6,cursor:"pointer",display:"flex",gap:10}}>
      {/* Avatar */}
      <div style={{width:36,height:36,borderRadius:99,background:`${senderColor}30`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <span style={{color:senderColor,fontSize:14,fontWeight:700}}>{initial}</span>
      </div>
      
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{color:isUnread?"rgba(255,255,255,.9)":"rgba(255,255,255,.6)",fontSize:12,fontWeight:isUnread?700:500}}>{senderName}</span>
            {m.priority==="urgent"&&<span style={{fontSize:8,padding:"2px 5px",borderRadius:4,background:"rgba(239,68,68,.2)",color:"#EF4444",fontWeight:700}}>URGENT</span>}
            {isUnread&&<span style={{width:7,height:7,borderRadius:99,background:"#8B5CF6"}}/>}
          </div>
          <span style={{color:"rgba(255,255,255,.2)",fontSize:9,flexShrink:0}}>{m.sentAt?new Date(m.sentAt).toLocaleDateString():""}</span>
        </div>
        {m.subject&&<p style={{color:isUnread?"rgba(255,255,255,.75)":"rgba(255,255,255,.5)",fontSize:12,fontWeight:isUnread?600:400,margin:"0 0 3px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.subject}</p>}
        <p style={{color:"rgba(255,255,255,.4)",fontSize:11,margin:0,lineHeight:1.4,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{m.body?.substring(0,200)}</p>
        {m.reactions&&m.reactions.length>0&&(
          <div style={{display:"flex",gap:3,marginTop:6}}>{m.reactions.map((r,i)=><span key={i} style={{fontSize:13,background:"rgba(255,255,255,.05)",padding:"1px 4px",borderRadius:6}}>{r.emoji}</span>)}</div>
        )}
        <div style={{display:"flex",gap:4,marginTop:6}}>
          {["👍","❤️","🔥","✅","👀"].map(e=>(
            <button key={e} onClick={(ev)=>{ev.stopPropagation();react(m.id,e)}} style={{padding:"2px 5px",borderRadius:6,border:"1px solid rgba(255,255,255,.04)",background:"transparent",cursor:"pointer",fontSize:11}}>{e}</button>
          ))}
          {m.from!==userId&&<button onClick={(ev)=>{ev.stopPropagation();loadThread(m.from)}} style={{marginLeft:"auto",padding:"3px 10px",borderRadius:6,border:"1px solid rgba(139,92,246,.15)",background:"rgba(139,92,246,.06)",color:"rgba(139,92,246,.8)",cursor:"pointer",fontSize:10,fontWeight:500}}>Reply</button>}
        </div>
      </div>
    </div>
    );
  };

  return(<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
    {/* Inbox/Sent toggle + Compose */}
    <div style={{display:"flex",gap:4,marginBottom:8}}>
      <button onClick={()=>{setView("inbox");loadMemos("inbox")}} style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:view==="inbox"?600:400,background:view==="inbox"?"rgba(139,92,246,.2)":"rgba(255,255,255,.04)",color:view==="inbox"?"rgba(139,92,246,.95)":"rgba(255,255,255,.4)"}}>Inbox</button>
      <button onClick={()=>{setView("sent");loadMemos("sent")}} style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:view==="sent"?600:400,background:view==="sent"?"rgba(139,92,246,.2)":"rgba(255,255,255,.04)",color:view==="sent"?"rgba(139,92,246,.95)":"rgba(255,255,255,.4)"}}>Sent</button>
      <button onClick={()=>setComposing(!composing)} style={{padding:"8px 16px",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,background:"rgba(16,185,129,.2)",color:"#34D399"}}>+ New</button>
    </div>

    {/* Compose form */}
    {composing&&(
    <div style={{padding:12,borderRadius:10,background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.15)",marginBottom:8}}>
      <select value={composeForm.to} onChange={e=>setComposeForm(p=>({...p,to:e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid rgba(255,255,255,.1)",background:"rgba(0,0,0,.3)",color:"rgba(255,255,255,.8)",fontSize:12,marginBottom:6}}>
        <option value="">Send to...</option>
        {TEAM.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <input placeholder="Subject (optional)" value={composeForm.subject} onChange={e=>setComposeForm(p=>({...p,subject:e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid rgba(255,255,255,.1)",background:"rgba(0,0,0,.3)",color:"rgba(255,255,255,.8)",fontSize:12,marginBottom:6,boxSizing:"border-box"}}/>
      <textarea placeholder="Message..." value={composeForm.body} onChange={e=>setComposeForm(p=>({...p,body:e.target.value}))} rows={4} style={{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid rgba(255,255,255,.1)",background:"rgba(0,0,0,.3)",color:"rgba(255,255,255,.8)",fontSize:12,resize:"vertical",boxSizing:"border-box",marginBottom:6}}/>
      <div style={{display:"flex",gap:6}}>
        <select value={composeForm.priority} onChange={e=>setComposeForm(p=>({...p,priority:e.target.value}))} style={{padding:"8px",borderRadius:6,border:"1px solid rgba(255,255,255,.1)",background:"rgba(0,0,0,.3)",color:"rgba(255,255,255,.6)",fontSize:11}}>
          <option value="normal">Normal</option>
          <option value="urgent">Urgent</option>
          <option value="fyi">FYI</option>
        </select>
        <button disabled={sending||!composeForm.to||!composeForm.body.trim()} onClick={sendMemo} style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(16,185,129,.25)",color:"#34D399",fontSize:12,fontWeight:600,opacity:sending?.5:1}}>{sending?"Sending...":"Send Memo"}</button>
        <button onClick={()=>setComposing(false)} style={{padding:"8px 12px",borderRadius:8,border:"1px solid rgba(255,255,255,.1)",background:"transparent",color:"rgba(255,255,255,.4)",cursor:"pointer",fontSize:11}}>Cancel</button>
      </div>
    </div>
    )}

    {/* Thread view */}
    {view==="thread"&&threadUser&&(
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
      <button onClick={()=>{setView("inbox");loadMemos("inbox")}} style={{alignSelf:"flex-start",padding:"4px 10px",borderRadius:6,border:"1px solid rgba(255,255,255,.1)",background:"transparent",color:"rgba(255,255,255,.4)",cursor:"pointer",fontSize:10,marginBottom:4}}>← Back to Inbox</button>
      <p style={{color:"rgba(255,255,255,.6)",fontSize:12,fontWeight:600,margin:"0 0 6px"}}>Thread with {threadUser}</p>
      {thread.map(renderMemo)}
      {thread.length===0&&<p style={{color:"rgba(255,255,255,.3)",textAlign:"center",padding:20,fontSize:12}}>No messages in this thread</p>}
    </div>
    )}

    {/* Memo list */}
    {view!=="thread"&&(
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
      {loading&&<p style={{color:"rgba(255,255,255,.4)",textAlign:"center",padding:20}}>Loading...</p>}
      {!loading&&memos.length===0&&<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,padding:20}}>
        <Mail size={40} style={{color:"rgba(139,92,246,.3)"}}/>
        <p style={{color:"rgba(255,255,255,.4)",fontSize:13}}>{view==="inbox"?"No memos yet":"No sent memos"}</p>
      </div>}
      {!loading&&memos.map(renderMemo)}
    </div>
    )}
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════
// REFERENCES VIEW - Manage professional references
// ⬡B:MYABA.V2:references:20260313⬡ New component for /api/awa/references
// ═══════════════════════════════════════════════════════════════════════════
function ReferencesView({userId}){
  const[refs,setRefs]=useState([]);
  const[loading,setLoading]=useState(true);
  const[editing,setEditing]=useState(null);
  const[showForm,setShowForm]=useState(false);
  const[form,setForm]=useState({name:"",title:"",organization:"",email:"",phone:"",relationship:"",notes:""});
  const[saving,setSaving]=useState(false);
  
  // Load references
  useEffect(()=>{
    loadRefs();
  },[userId]);
  
  const loadRefs=async()=>{
    try{
      const res=await fetch(`https://abacia-services.onrender.com/api/awa/references?userId=${encodeURIComponent(userId)}`);
      if(res.ok){
        const data=await res.json();
        setRefs(data.references||[]);
      }
    }catch(e){console.error("[REFS] Load failed:",e)}
    setLoading(false);
  };
  
  const saveRef=async()=>{
    setSaving(true);
    try{
      const method=editing?"PUT":"POST";
      const url=editing?`https://abacia-services.onrender.com/api/awa/references/${editing}`:
        "https://abacia-services.onrender.com/api/awa/references";
      const res=await fetch(url,{
        method,
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...form,userId})
      });
      if(res.ok){
        await loadRefs();
        setShowForm(false);
        setEditing(null);
        setForm({name:"",title:"",organization:"",email:"",phone:"",relationship:"",notes:""});
      }
    }catch(e){console.error("[REFS] Save failed:",e)}
    setSaving(false);
  };
  
  const deleteRef=async(id)=>{
    if(!confirm("Delete this reference?"))return;
    try{
      await fetch(`https://abacia-services.onrender.com/api/awa/references/${id}`,{
        method:"DELETE",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({userId})
      });
      await loadRefs();
    }catch(e){console.error("[REFS] Delete failed:",e)}
  };
  
  const startEdit=(ref)=>{
    setForm({name:ref.name||"",title:ref.title||"",organization:ref.organization||"",email:ref.email||"",phone:ref.phone||"",relationship:ref.relationship||"",notes:ref.notes||""});
    setEditing(ref.id);
    setShowForm(true);
  };
  
  if(loading){
    return(<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{width:50,height:50,borderRadius:"50%",border:"3px solid rgba(139,92,246,.2)",borderTopColor:"rgba(139,92,246,.8)",animation:"spin 1s linear infinite"}}/>
      <p style={{color:"rgba(255,255,255,.5)",fontSize:13}}>Loading references...</p>
    </div>);
  }
  
  if(showForm){
    const Field=({label,field,placeholder,type="text"})=>(
      <div style={{marginBottom:12}}>
        <label style={{color:"rgba(255,255,255,.5)",fontSize:11,fontWeight:600,display:"block",marginBottom:4}}>{label}</label>
        <input type={type} value={form[field]} onChange={e=>setForm({...form,[field]:e.target.value})} placeholder={placeholder}
          style={{width:"100%",padding:"10px 12px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,color:"white",fontSize:13,outline:"none"}}/>
      </div>
    );
    return(<div style={{flex:1,overflowY:"auto",padding:"8px 4px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <h3 style={{color:"rgba(255,255,255,.9)",fontSize:16,fontWeight:600,margin:0}}>{editing?"Edit Reference":"Add Reference"}</h3>
        <button onClick={()=>{setShowForm(false);setEditing(null);setForm({name:"",title:"",organization:"",email:"",phone:"",relationship:"",notes:""})}} style={{background:"rgba(255,255,255,.1)",border:"none",color:"white",width:32,height:32,borderRadius:99,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={16}/></button>
      </div>
      <Field label="Full Name" field="name" placeholder="John Smith"/>
      <Field label="Title" field="title" placeholder="Director of Development"/>
      <Field label="Organization" field="organization" placeholder="Nonprofit Organization"/>
      <Field label="Email" field="email" placeholder="john@example.org" type="email"/>
      <Field label="Phone" field="phone" placeholder="555-123-4567" type="tel"/>
      <Field label="Relationship" field="relationship" placeholder="Former supervisor"/>
      <div style={{marginBottom:12}}>
        <label style={{color:"rgba(255,255,255,.5)",fontSize:11,fontWeight:600,display:"block",marginBottom:4}}>Notes</label>
        <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Additional context..."
          style={{width:"100%",padding:"10px 12px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,color:"white",fontSize:13,outline:"none",minHeight:80,resize:"vertical"}}/>
      </div>
      <button onClick={saveRef} disabled={saving||!form.name} style={{width:"100%",padding:"14px",borderRadius:12,border:"none",cursor:saving||!form.name?"not-allowed":"pointer",background:saving||!form.name?"rgba(139,92,246,.2)":"rgba(139,92,246,.4)",color:"white",fontSize:14,fontWeight:600,opacity:saving||!form.name?.5:1}}>
        {saving?"Saving...":editing?"Update Reference":"Add Reference"}
      </button>
    </div>);
  }
  
  return(<div style={{flex:1,overflowY:"auto",padding:"8px 4px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <h3 style={{color:"rgba(255,255,255,.9)",fontSize:16,fontWeight:600,margin:0}}>References</h3>
      <button onClick={()=>setShowForm(true)} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:10,border:"none",cursor:"pointer",background:"rgba(139,92,246,.25)",color:"rgba(139,92,246,.95)",fontSize:12,fontWeight:600}}>
        <Plus size={14}/>Add
      </button>
    </div>
    
    {refs.length===0?(
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:40}}>
        <Users size={48} style={{color:"rgba(139,92,246,.4)"}}/>
        <p style={{color:"rgba(255,255,255,.5)",fontSize:14,textAlign:"center"}}>No references yet</p>
        <p style={{color:"rgba(255,255,255,.3)",fontSize:12,textAlign:"center"}}>Add professional references for your job applications</p>
      </div>
    ):(
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {refs.map((ref,i)=>(
          <div key={ref.id||i} style={{padding:"14px 16px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <p style={{color:"rgba(255,255,255,.9)",fontSize:14,fontWeight:600,margin:0}}>{ref.name}</p>
                <p style={{color:"rgba(139,92,246,.7)",fontSize:12,margin:"2px 0 0"}}>{ref.title}</p>
                <p style={{color:"rgba(255,255,255,.5)",fontSize:11,margin:"2px 0 0"}}>{ref.organization}</p>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>startEdit(ref)} style={{background:"rgba(255,255,255,.1)",border:"none",color:"rgba(255,255,255,.6)",width:28,height:28,borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Edit2 size={12}/></button>
                <button onClick={()=>deleteRef(ref.id)} style={{background:"rgba(239,68,68,.1)",border:"none",color:"rgba(239,68,68,.6)",width:28,height:28,borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Trash2 size={12}/></button>
              </div>
            </div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              {ref.email&&<a href={`mailto:${ref.email}`} style={{color:"rgba(99,102,241,.7)",fontSize:11,textDecoration:"none"}}>{ref.email}</a>}
              {ref.phone&&<span style={{color:"rgba(255,255,255,.4)",fontSize:11}}>{ref.phone}</span>}
            </div>
            {ref.relationship&&<p style={{color:"rgba(255,255,255,.4)",fontSize:11,marginTop:6,fontStyle:"italic"}}>{ref.relationship}</p>}
          </div>
        ))}
      </div>
    )}
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════
// AWA JOBS VIEW - Apply With ABA job listings
// ═══════════════════════════════════════════════════════════════════════════
function JobsView({userId}){
  // Map email to ham_id for default filter
  const hamMap={"brandonjpiercesr@gmail.com":"brandon","ericreeselane@gmail.com":"eric","bryanjpiercejr@gmail.com":"bj","cj.d.moore32@gmail.com":"cj","shields.devante@gmail.com":"vante","dmurrayjr34@gmail.com":"dwayne"};
  const defaultHam=hamMap[(userId||"").toLowerCase()]||(userId||"").split("@")[0]||"all";
  
  const[jobs,setJobs]=useState([]);
  const[loading,setLoading]=useState(true);
  const[selectedJob,setSelectedJob]=useState(null);
  const[filter,setFilter]=useState("");
  const[teamFilter,setTeamFilter]=useState(defaultHam);
  const[statusFilter,setStatusFilter]=useState("active"); // active | applied | all
  const[generating,setGenerating]=useState(null);
  const[output,setOutput]=useState(null);
  const[showRefs,setShowRefs]=useState(false);
  const[jobRefs,setJobRefs]=useState([]);
  const[applyPreview,setApplyPreview]=useState(null);
  const[applyLoading,setApplyLoading]=useState(false);
  const[interviewForm,setInterviewForm]=useState(null); // {jobId, date, name, notes}
  const[offerForm,setOfferForm]=useState(null); // {jobId, salary, deadline, details}
  const[prepData,setPrepData]=useState(null); // interview prep package
  const[prepLoading,setPrepLoading]=useState(false);
  const[mockMode,setMockMode]=useState(false); // mock interview active
  const[mockQuestion,setMockQuestion]=useState(null); // current question
  const[mockAnswer,setMockAnswer]=useState(""); // user's typed answer
  const[mockEval,setMockEval]=useState(null); // evaluation result
  const[mockHistory,setMockHistory]=useState([]); // past questions
  const[mockLoading,setMockLoading]=useState(false);
  const[unmatchedJobs,setUnmatchedJobs]=useState([]);
  const[assigningJob,setAssigningJob]=useState(null); // job being assigned
  
  // Team members for filter
  const TEAM_MEMBERS=[
    {id:"all",name:"All",color:"#6B7280"},
    {id:"brandon",name:"Brandon",color:"#8B5CF6"},
    {id:"eric",name:"Eric",color:"#3B82F6"},
    {id:"bj",name:"BJ",color:"#10B981"},
    {id:"cj",name:"CJ",color:"#F59E0B"},
    {id:"vante",name:"Vante",color:"#F97316"},
    {id:"dwayne",name:"Dwayne",color:"#EC4899"},
    {id:"gmg",name:"GMG",color:"#6B7280"}
  ];
  
  // Team colors for job cards
  const TEAM_COLORS={"Brandon":"#8B5CF6","Eric":"#3B82F6","BJ":"#10B981","CJ":"#F59E0B","Vante":"#F97316","Dwayne":"#EC4899","GMG":"#6B7280"};
  
  useEffect(()=>{
    (async()=>{
      try{
        const res=await fetch(`${ABABASE}/api/awa/jobs?userId=${encodeURIComponent(userId)}`,{
          headers:{"Accept":"application/json"}
        });
        const data=await res.json();
        if(data.success&&data.jobs){setJobs(data.jobs)}
        else{
          const parsed=(Array.isArray(data)?data:[]).map(j=>{
            if(j.id&&j.job_title)return j;
            try{return{...JSON.parse(j.content),id:j.id}}catch{return{title:"Unknown",id:j.id}}
          });
          setJobs(parsed);
        }
      }catch(e){console.error("[AWA] Load failed:",e)}
      setLoading(false);
    })();
  },[]);
  
  // Filter by team, status, AND text
  // ⬡B:MYABA:UNMATCHED_REVIEW:20260321⬡
  useEffect(()=>{
    if(statusFilter==="unmatched"){
      (async()=>{
        try{
          const r=await fetch(`${ABABASE}/api/awa/jobs/unmatched`);
          const d=await r.json();
          if(d.success)setUnmatchedJobs(d.jobs||[]);
        }catch(e){console.error("[AWA] Unmatched fetch:",e)}
      })();
    }
  },[statusFilter]);
  
  const assignJobTo=async(jobId,assignTo)=>{
    setAssigningJob(jobId);
    try{
      await fetch(`${ABABASE}/api/awa/jobs/${jobId}/assign`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({assignTo,userId})});
      setUnmatchedJobs(prev=>prev.filter(j=>j.id!==jobId));
    }catch(e){console.error("[AWA] Assign failed:",e)}
    setAssigningJob(null);
  };
  
  const filtered=jobs.filter(j=>{
    // Status filter
    if(statusFilter==="active"){
      const s=(j.status||"NEW").toUpperCase();
      if(["APPLIED","WAITING","INTERVIEW_SCHEDULED","INTERVIEWED","SECOND_INTERVIEW","OFFER","ACCEPTED","REJECTED","WITHDRAWN","DISMISSED"].includes(s))return false;
    }else if(statusFilter==="applied"){
      const s=(j.status||"NEW").toUpperCase();
      if(!["APPLIED","WAITING","INTERVIEW_SCHEDULED","INTERVIEWED","SECOND_INTERVIEW","OFFER","ACCEPTED"].includes(s))return false;
    }
    // Team filter - check ALL assignees
    if(teamFilter!=="all"){
      const allAssignees=(j.assignees||[j.assignee]||[]).map(a=>(a||"").toLowerCase());
      if(!allAssignees.some(a=>a.includes(teamFilter)))return false;
    }
    // Text filter
    if(!filter)return true;
    const f=filter.toLowerCase();
    const title=(j.job_title||j.title||"").toLowerCase();
    const company=(j.organization||j.company||"").toLowerCase();
    const assignees=((j.assignees||[])[0]||j.assignee||"").toLowerCase();
    return title.includes(f)||company.includes(f)||assignees.includes(f);
  });
  
  const handleGenerate=async(type)=>{
    if(!selectedJob)return;
    setGenerating(type);setOutput(null);
    try{
      const assignee=(selectedJob.assignees||[])[0]||selectedJob.assignee||"unmatched";
      const endpoint = type==="cover" ? "cover-letter" : type==="resume" ? "resume" : "writing-sample";
      const res=await fetch(`https://abacia-services.onrender.com/api/awa/${endpoint}`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({job:selectedJob,userId:assignee.toLowerCase().replace(" ","_")})
      });
      const data=await res.json();
      setOutput(data.coverLetter||data.resume||data.writingSample||data.response||JSON.stringify(data,null,2));
    }catch(e){setOutput("Error: "+e.message)}
    setGenerating(null);
  };
  
  if(loading){
    return(<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{width:50,height:50,borderRadius:"50%",border:"3px solid rgba(139,92,246,.2)",borderTopColor:"rgba(139,92,246,.8)",animation:"spin 1s linear infinite"}}/>
      <p style={{color:"rgba(255,255,255,.5)",fontSize:13}}>Loading jobs...</p>
    </div>);
  }
  
  return(<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
    {/* Status filter: Active | My Applications | All | Unmatched (admin only) */}
    <div style={{display:"flex",gap:4,marginBottom:6}}>
      {[{k:"active",l:"Active Jobs"},{k:"applied",l:"My Applications"},{k:"all",l:"All"},...(["brandon","brandonjpiercesr","eric","ericreeselane"].includes(defaultHam)?[{k:"unmatched",l:"Review"}]:[])].map(sf=>(
        <button key={sf.k} onClick={()=>{setStatusFilter(sf.k);setSelectedJob(null);}} style={{
          flex:1,padding:"8px 6px",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:statusFilter===sf.k?600:400,
          background:statusFilter===sf.k?"rgba(139,92,246,.2)":"rgba(255,255,255,.04)",
          color:statusFilter===sf.k?"rgba(139,92,246,.95)":"rgba(255,255,255,.4)",transition:"all .2s"
        }}>{sf.l}{sf.k==="applied"?` (${jobs.filter(j=>["APPLIED","WAITING","INTERVIEW_SCHEDULED","INTERVIEWED","SECOND_INTERVIEW","OFFER","ACCEPTED"].includes((j.status||"").toUpperCase())).length})`:""}</button>
      ))}
    </div>
    {/* Team filter buttons */}
    <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
      {TEAM_MEMBERS.map(tm=>(
        <button key={tm.id} onClick={()=>{setTeamFilter(tm.id);setSelectedJob(null);}} style={{
          padding:"6px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:11,fontWeight:500,
          background:teamFilter===tm.id?`${tm.color}30`:"rgba(255,255,255,.05)",
          color:teamFilter===tm.id?tm.color:"rgba(255,255,255,.5)",
          transition:"all .2s"
        }}>{tm.name}</button>
      ))}
    </div>
    
    {/* Search */}
    
    {/* Unmatched Review Queue - Brandon/Eric only */}
    {statusFilter==="unmatched"&&<div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
      <p style={{color:"rgba(255,255,255,.5)",fontSize:11,margin:"0 0 8px"}}>{unmatchedJobs.length} jobs need manual assignment. Tap a name to assign.</p>
      {unmatchedJobs.map(j=>(
        <div key={j.id} style={{padding:"12px 14px",borderRadius:12,background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.15)"}}>
          <p style={{color:"rgba(255,255,255,.85)",fontSize:13,fontWeight:600,margin:"0 0 2px"}}>{(j.job_title||j.title||"?").substring(0,60)}</p>
          <p style={{color:"rgba(255,255,255,.4)",fontSize:11,margin:"0 0 8px"}}>{j.organization||""} {j.location?`· ${j.location}`:""}</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {[{id:"brandon",name:"Brandon",c:"#8B5CF6"},{id:"eric",name:"Eric",c:"#3B82F6"},{id:"bj",name:"BJ",c:"#10B981"},{id:"cj",name:"CJ",c:"#F59E0B"},{id:"vante",name:"Vante",c:"#F97316"},{id:"dwayne",name:"Dwayne",c:"#EC4899"}].map(t=>(
              <button key={t.id} disabled={assigningJob===j.id} onClick={()=>assignJobTo(j.id,t.id)} style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${t.c}30`,background:`${t.c}15`,color:t.c,cursor:"pointer",fontSize:11,fontWeight:500}}>{t.name}</button>
            ))}
            <button onClick={()=>assignJobTo(j.id,"DISMISSED")} style={{padding:"5px 12px",borderRadius:8,border:"1px solid rgba(239,68,68,.2)",background:"rgba(239,68,68,.08)",color:"rgba(239,68,68,.6)",cursor:"pointer",fontSize:11,marginLeft:"auto"}}>Dismiss</button>
          </div>
        </div>
      ))}
      {unmatchedJobs.length===0&&<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><p style={{color:"rgba(255,255,255,.3)",fontSize:13}}>No unmatched jobs right now</p></div>}
    </div>}
    
    {/* Split view - hidden during unmatched review */}
    {statusFilter!=="unmatched"&&<div style={{flex:1,display:"flex",gap:8,overflow:"hidden"}}>
      {/* Job list */}
      <div style={{flex:selectedJob?1:2,overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
        {filtered.length===0&&<div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,padding:20}}>
          <Briefcase size={40} style={{color:"rgba(139,92,246,.3)"}}/>
          <p style={{color:"rgba(255,255,255,.5)",fontSize:14,fontWeight:500,textAlign:"center"}}>No jobs matched to you yet</p>
          <p style={{color:"rgba(255,255,255,.3)",fontSize:12,textAlign:"center",maxWidth:280}}>When ABA finds roles that fit your profile, they'll appear here with cover letters and resumes ready to go.</p>
        </div>}
        {filtered.map(job=>{
          const title=job.job_title||job.title||"Untitled";
          const company=job.organization||job.company||"Unknown";
          const assignee=(job.assignees||[])[0]||job.assignee||"Unassigned";
          const DISPLAY_NAMES={"brandon":"Brandon","eric":"Eric","bj":"BJ","cj":"CJ","vante":"Vante","dwayne":"Dwayne","gmg":"GMG"};
          const assigneeDisplay=DISPLAY_NAMES[assignee]||assignee;
          return(
          <div key={job.id} onClick={()=>{setSelectedJob(job);setApplyPreview(null);setInterviewForm(null);setOfferForm(null);setShowRefs(false);setPrepData(null);setMockMode(false);setMockQuestion(null);setMockEval(null);}} style={{padding:12,borderRadius:12,background:selectedJob?.id===job.id?"rgba(139,92,246,.15)":"rgba(255,255,255,.03)",border:`1px solid ${selectedJob?.id===job.id?"rgba(139,92,246,.3)":"rgba(255,255,255,.05)"}`,borderLeft:`3px solid ${TEAM_COLORS[assigneeDisplay]||"rgba(255,255,255,.2)"}`,cursor:"pointer",transition:"all .2s"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
              <p style={{color:"rgba(255,255,255,.9)",fontSize:13,fontWeight:600,margin:0,lineHeight:1.3}}>{title}</p>
              {job.remote&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:4,background:"rgba(16,185,129,.15)",color:"#10B981",flexShrink:0}}>Remote</span>}
            </div>
            <p style={{color:"rgba(255,255,255,.5)",fontSize:11,margin:"4px 0 0"}}>{company}</p>
            <div style={{display:"flex",gap:6,marginTop:6,alignItems:"center"}}>
              <span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:`${TEAM_COLORS[assigneeDisplay]||"rgba(255,255,255,.1)"}20`,color:TEAM_COLORS[assigneeDisplay]||"rgba(255,255,255,.5)"}}>{assigneeDisplay}</span>
              {job.status&&job.status!=="NEW"&&job.status!=="MATERIALS_READY"&&job.status!=="LIVE"&&<span style={{fontSize:9,padding:"2px 5px",borderRadius:4,background:job.status==="APPLIED"?"rgba(16,185,129,.12)":job.status==="INTERVIEW_SCHEDULED"?"rgba(245,158,11,.12)":job.status==="OFFER"?"rgba(139,92,246,.15)":job.status==="ACCEPTED"?"rgba(16,185,129,.2)":"rgba(255,255,255,.05)",color:job.status==="APPLIED"?"#10B981":job.status==="INTERVIEW_SCHEDULED"?"#FBBF24":job.status==="OFFER"?"#A78BFA":job.status==="ACCEPTED"?"#34D399":"rgba(255,255,255,.4)"}}>{job.status.replace(/_/g," ")}</span>}
              {job.salary&&<span style={{fontSize:10,color:"rgba(255,255,255,.3)"}}>{job.salary}</span>}
            </div>
          </div>
        )})}
      </div>
      
      {/* Detail panel */}
      {selectedJob&&<div style={{flex:1,background:"rgba(255,255,255,.03)",borderRadius:12,padding:16,overflowY:"auto",border:"1px solid rgba(255,255,255,.05)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div>
            <h3 style={{color:"white",fontSize:16,fontWeight:600,margin:0}}>{selectedJob.job_title||selectedJob.title}</h3>
            <p style={{color:"rgba(255,255,255,.5)",fontSize:12,margin:"4px 0 0"}}>{selectedJob.organization||selectedJob.company}</p>
          </div>
          <button onClick={()=>{setSelectedJob(null);setOutput(null)}} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><X size={18} style={{color:"rgba(255,255,255,.4)"}}/></button>
        </div>
        
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <div style={{padding:8,borderRadius:8,background:"rgba(255,255,255,.05)"}}>
            <p style={{color:"rgba(255,255,255,.4)",fontSize:10,margin:0}}>Location</p>
            <p style={{color:"rgba(255,255,255,.8)",fontSize:12,margin:"2px 0 0"}}>{selectedJob.location||"Not specified"}</p>
          </div>
          <div style={{padding:8,borderRadius:8,background:"rgba(255,255,255,.05)"}}>
            <p style={{color:"rgba(255,255,255,.4)",fontSize:10,margin:0}}>Salary</p>
            <p style={{color:"rgba(255,255,255,.8)",fontSize:12,margin:"2px 0 0"}}>{selectedJob.salary||"Not specified"}</p>
          </div>
        </div>
        
        {selectedJob.url&&<a href={selectedJob.url} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:4,color:"rgba(139,92,246,.8)",fontSize:12,marginBottom:12,textDecoration:"none"}}><ExternalLink size={12}/>View Original</a>}
        
        {/* Apply method + requirements badges */}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
          {selectedJob.apply_method&&<span style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:600,background:selectedJob.apply_method==="email"?"rgba(16,185,129,.15)":selectedJob.apply_method==="idealist_form"?"rgba(139,92,246,.15)":"rgba(245,158,11,.15)",color:selectedJob.apply_method==="email"?"#10B981":selectedJob.apply_method==="idealist_form"?"#8B5CF6":"#F59E0B"}}>{selectedJob.apply_method==="email"?"EMAIL":"IDEALIST FORM"}</span>}
          <span style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:600,background:"rgba(59,130,246,.12)",color:"rgba(96,165,250,.9)"}}>Resume</span>
          <span style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:600,background:"rgba(139,92,246,.12)",color:"rgba(167,139,250,.9)"}}>Cover Letter</span>
          {selectedJob.application_requirements?.writing_sample&&<span style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:600,background:"rgba(245,158,11,.15)",color:"#F59E0B"}}>Writing Sample</span>}
          {selectedJob.application_requirements?.references&&<span style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:600,background:"rgba(239,68,68,.12)",color:"rgba(239,68,68,.8)"}}>References</span>}
        </div>
        
        <div style={{display:"flex",gap:6,marginBottom:8}}>
          <button onClick={()=>handleGenerate("cover")} disabled={generating} style={{flex:1,padding:"10px 8px",borderRadius:8,border:"none",cursor:generating?"wait":"pointer",background:"rgba(139,92,246,.2)",color:"#A78BFA",fontSize:11,fontWeight:500,opacity:generating?.5:1}}>{generating==="cover"?"...":"Cover Letter"}</button>
          <button onClick={()=>handleGenerate("resume")} disabled={generating} style={{flex:1,padding:"10px 8px",borderRadius:8,border:"none",cursor:generating?"wait":"pointer",background:"rgba(59,130,246,.2)",color:"#60A5FA",fontSize:11,fontWeight:500,opacity:generating?.5:1}}>{generating==="resume"?"...":"Resume"}</button>
          <button onClick={()=>handleGenerate("writing_sample")} disabled={generating} style={{flex:1,padding:"10px 8px",borderRadius:8,border:"none",cursor:generating?"wait":"pointer",background:"rgba(245,158,11,.2)",color:"#FBBF24",fontSize:11,fontWeight:500,opacity:generating?.5:1}}>{generating==="writing_sample"?"...":"Writing Sample"}</button>
        </div>
        
        {/* ⬡B:AWA.v3:Phase2:download_buttons:20260315⬡ */}
        <div style={{display:"flex",gap:6,marginBottom:8}}>
          <button onClick={async()=>{
            try{
              const assignee=(selectedJob.assignees||[])[0]||"unmatched";
              const r=await fetch(`${ABABASE}/api/awa/export/combined/preview`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId:selectedJob.id,format:"pdf",userId:assignee,includeReferences:true})});
              const d=await r.json();
              if(d.success&&d.base64){const blob=new Blob([Uint8Array.from(atob(d.base64),c=>c.charCodeAt(0))],{type:"application/pdf"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=d.filename||"application.pdf";a.click();URL.revokeObjectURL(url)}
              else{setOutput("PDF generation failed: "+(d.error||"Unknown error"))}
            }catch(e){setOutput("PDF download error: "+e.message)}
          }} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid rgba(16,185,129,.2)",cursor:"pointer",background:"rgba(16,185,129,.1)",color:"#10B981",fontSize:11,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
            <Download size={12}/>PDF
          </button>
          <button onClick={async()=>{
            try{
              const assignee=(selectedJob.assignees||[])[0]||"unmatched";
              const r=await fetch(`${ABABASE}/api/awa/export/combined/preview`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId:selectedJob.id,format:"docx",userId:assignee,includeReferences:true})});
              const d=await r.json();
              if(d.success&&d.base64){const blob=new Blob([Uint8Array.from(atob(d.base64),c=>c.charCodeAt(0))],{type:d.contentType});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=d.filename||"application.docx";a.click();URL.revokeObjectURL(url)}
              else{setOutput("DOCX generation failed: "+(d.error||"Unknown error"))}
            }catch(e){setOutput("DOCX download error: "+e.message)}
          }} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid rgba(59,130,246,.2)",cursor:"pointer",background:"rgba(59,130,246,.1)",color:"#60A5FA",fontSize:11,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
            <Download size={12}/>DOCX
          </button>
        </div>
        
        {/* ⬡B:AWA.v4:Phase4:apply_preview_flow:20260319⬡ */}
        {selectedJob.status!=="APPLIED"&&selectedJob.status!=="INTERVIEW_SCHEDULED"&&selectedJob.status!=="OFFER"&&selectedJob.status!=="ACCEPTED"&&selectedJob.status!=="DISMISSED"&&(
        <div style={{marginBottom:8}}>
          {!applyPreview?(
          <button disabled={applyLoading} onClick={async()=>{
            setApplyLoading(true);
            try{
              const assignee=(selectedJob.assignees||[])[0]||"unmatched";
              const r=await fetch(`${ABABASE}/api/awa/jobs/${selectedJob.id}/apply-preview`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:assignee})});
              const d=await r.json();
              if(d.success){setApplyPreview(d)}else{setOutput("Preview failed: "+(d.error||"Unknown"))}
            }catch(e){setOutput("Preview error: "+e.message)}
            setApplyLoading(false);
          }} style={{width:"100%",padding:"12px 8px",borderRadius:10,border:"none",cursor:"pointer",background:"linear-gradient(135deg,rgba(16,185,129,.3),rgba(59,130,246,.3))",color:"#34D399",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:applyLoading?.6:1}}>
            <Send size={16}/>{applyLoading?"Preparing...":"Apply to This Job"}
          </button>
          ):(
          <div style={{padding:12,borderRadius:10,background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.15)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{color:"#34D399",fontSize:12,fontWeight:600}}>
                {applyPreview.applicationType==="email"?"Email Application":applyPreview.applicationType==="idealist_form"?"Idealist Application":"External Application"}
              </span>
              <button onClick={()=>setApplyPreview(null)} style={{background:"none",border:"none",color:"rgba(255,255,255,.3)",cursor:"pointer",fontSize:18}}>x</button>
            </div>
            
            {/* Download PDF + DOCX */}
            <div style={{display:"flex",gap:6,marginBottom:8}}>
              <button onClick={()=>{
                if(applyPreview.pdfBase64){const blob=new Blob([Uint8Array.from(atob(applyPreview.pdfBase64),c=>c.charCodeAt(0))],{type:"application/pdf"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=applyPreview.pdfFilename||"application.pdf";a.click();URL.revokeObjectURL(url)}
                else{setOutput("PDF not ready yet")}
              }} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid rgba(16,185,129,.2)",cursor:"pointer",background:"rgba(16,185,129,.1)",color:"#10B981",fontSize:11,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                <Download size={12}/>Download PDF
              </button>
              <button onClick={async()=>{
                try{
                  const assignee=(selectedJob.assignees||[])[0]||"unmatched";
                  const r=await fetch(`${ABABASE}/api/awa/export/combined/preview`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jobId:selectedJob.id,format:"docx",userId:assignee,includeReferences:true})});
                  const d=await r.json();
                  if(d.success&&d.base64){const blob=new Blob([Uint8Array.from(atob(d.base64),c=>c.charCodeAt(0))],{type:d.contentType});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=d.filename||"application.docx";a.click();URL.revokeObjectURL(url)}
                }catch(e){setOutput("DOCX error: "+e.message)}
              }} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid rgba(59,130,246,.2)",cursor:"pointer",background:"rgba(59,130,246,.1)",color:"#60A5FA",fontSize:11,fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                <Download size={12}/>Download DOCX
              </button>
            </div>
            
            {/* Email application: show draft + mailto */}
            {applyPreview.applicationType==="email"&&applyPreview.emailDraft&&(
            <div style={{marginBottom:8}}>
              <p style={{color:"rgba(255,255,255,.5)",fontSize:10,margin:"0 0 4px"}}>To: {applyPreview.emailDraft.to}</p>
              <p style={{color:"rgba(255,255,255,.5)",fontSize:10,margin:"0 0 4px"}}>Subject: {applyPreview.emailDraft.subject}</p>
              <div style={{maxHeight:100,overflowY:"auto",padding:8,borderRadius:6,background:"rgba(0,0,0,.3)",marginBottom:8}}>
                <p style={{color:"rgba(255,255,255,.6)",fontSize:10,margin:0,whiteSpace:"pre-wrap"}}>{applyPreview.emailDraft.body?.substring(0,500)}{applyPreview.emailDraft.body?.length>500?"...":""}</p>
              </div>
              <button onClick={()=>{
                if(applyPreview.mailtoLink)window.location.href=applyPreview.mailtoLink;
              }} style={{width:"100%",padding:"10px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(16,185,129,.25)",color:"#34D399",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                <Mail size={14}/>Open in Email App (attach PDF manually)
              </button>
              <p style={{color:"rgba(255,255,255,.3)",fontSize:9,textAlign:"center",margin:"4px 0 0"}}>Download your PDF first, then attach it in your email app</p>
            </div>
            )}
            
            {/* URL/Idealist application: checklist */}
            {(applyPreview.applicationType==="url"||applyPreview.applicationType==="idealist_form")&&(
            <div style={{marginBottom:8}}>
              {applyPreview.applicationType==="idealist_form"&&<p style={{color:"#8B5CF6",fontSize:10,fontWeight:600,margin:"0 0 6px"}}>Idealist Application Detected</p>}
              {(applyPreview.checklist||[]).map((c,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0"}}>
                  <span style={{color:c.done?"#10B981":"rgba(255,255,255,.3)",fontSize:12}}>{c.done?"✓":"○"}</span>
                  <span style={{color:"rgba(255,255,255,.6)",fontSize:11}}>{c.item}</span>
                </div>
              ))}
              <button onClick={()=>{if(selectedJob.url)window.open(selectedJob.url,"_blank")}} style={{width:"100%",padding:"10px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(59,130,246,.25)",color:"#60A5FA",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:8}}>
                <ExternalLink size={14}/>Open Application Link
              </button>
            </div>
            )}
            
            {/* References warning */}
            {applyPreview.job?.requirements?.references&&(
              <p style={{color:"#F59E0B",fontSize:10,margin:"0 0 8px"}}>This job requires references ({applyPreview.references?.length||0} loaded)</p>
            )}
            
            {/* Confirm applied */}
            <button onClick={async()=>{
              try{
                const assignee=(selectedJob.assignees||[])[0]||"unmatched";
                const method=applyPreview.applicationType||"manual";
                const r=await fetch(`${ABABASE}/api/awa/jobs/${selectedJob.id}/apply`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:assignee,method})});
                const d=await r.json();
                if(d.success){
                  setSelectedJob(prev=>({...prev,status:"APPLIED",applied_at:new Date().toISOString()}));
                  setJobs(prev=>prev.map(j=>j.id===selectedJob.id?{...j,status:"APPLIED"}:j));
                  setApplyPreview(null);
                  setOutput(d.message);
                }
              }catch(e){setOutput("Confirm error: "+e.message)}
            }} style={{width:"100%",padding:"10px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(16,185,129,.3)",color:"#34D399",fontSize:12,fontWeight:600,marginTop:4}}>
              I Applied - Mark as Submitted
            </button>
          </div>
          )}
        </div>
        )}
        
        {/* Not Interested button */}
        {selectedJob.status!=="DISMISSED"&&selectedJob.status!=="ACCEPTED"&&(
        <button onClick={async()=>{
          try{
            const assignee=(selectedJob.assignees||[])[0]||"unmatched";
            const r=await fetch(`${ABABASE}/api/awa/jobs/${selectedJob.id}/status`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:assignee,status:"DISMISSED"})});
            const d=await r.json();
            if(d.success){
              setSelectedJob(prev=>({...prev,status:"DISMISSED"}));
              setJobs(prev=>prev.map(j=>j.id===selectedJob.id?{...j,status:"DISMISSED"}:j));
            }
          }catch(e){console.error("[AWA] Dismiss failed:",e)}
        }} style={{width:"100%",padding:"6px",borderRadius:6,border:"1px solid rgba(239,68,68,.1)",cursor:"pointer",background:"transparent",color:"rgba(239,68,68,.5)",fontSize:10,marginBottom:8}}>
          Not Interested
        </button>
        )}
        
        {/* ⬡B:AWA.v4:status_with_interview_form:20260319⬡ */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"8px 10px",borderRadius:8,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.05)"}}>
          <span style={{color:"rgba(255,255,255,.4)",fontSize:10}}>Status:</span>
          <span style={{padding:"3px 8px",borderRadius:6,fontSize:10,fontWeight:600,
            background:selectedJob.status==="APPLIED"?"rgba(16,185,129,.15)":selectedJob.status==="INTERVIEW_SCHEDULED"?"rgba(245,158,11,.15)":selectedJob.status==="OFFER"?"rgba(139,92,246,.15)":selectedJob.status==="ACCEPTED"?"rgba(16,185,129,.25)":selectedJob.status==="DISMISSED"?"rgba(239,68,68,.12)":"rgba(255,255,255,.08)",
            color:selectedJob.status==="APPLIED"?"#10B981":selectedJob.status==="INTERVIEW_SCHEDULED"?"#FBBF24":selectedJob.status==="OFFER"?"#A78BFA":selectedJob.status==="ACCEPTED"?"#34D399":selectedJob.status==="DISMISSED"?"rgba(239,68,68,.7)":"rgba(255,255,255,.5)"
          }}>{(selectedJob.status||"NEW").replace(/_/g," ")}</span>
          <select onChange={async(e)=>{
            const newStatus=e.target.value;if(!newStatus)return;
            // Show interview form instead of immediately updating
            if(newStatus==="INTERVIEW_SCHEDULED"){
              setInterviewForm({jobId:selectedJob.id,date:"",name:"",notes:""});
              return;
            }
            // Show offer form
            if(newStatus==="OFFER"){
              setOfferForm({jobId:selectedJob.id,salary:"",deadline:"",details:""});
              return;
            }
            try{
              const assignee=(selectedJob.assignees||[])[0]||"unmatched";
              const r=await fetch(`${ABABASE}/api/awa/jobs/${selectedJob.id}/status`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:assignee,status:newStatus})});
              const d=await r.json();
              if(d.success){
                setSelectedJob(prev=>({...prev,status:newStatus}));
                setJobs(prev=>prev.map(j=>j.id===selectedJob.id?{...j,status:newStatus}:j));
              }
            }catch(e){console.error("[AWA] Status update failed:",e)}
          }} value="" style={{marginLeft:"auto",padding:"4px 6px",borderRadius:6,border:"1px solid rgba(255,255,255,.1)",background:"rgba(0,0,0,.3)",color:"rgba(255,255,255,.5)",fontSize:10,cursor:"pointer"}}>
            <option value="">Move to...</option>
            {["NEW","SAVED","MATERIALS_READY","APPLIED","WAITING","INTERVIEW_SCHEDULED","INTERVIEWED","SECOND_INTERVIEW","OFFER","ACCEPTED","REJECTED","WITHDRAWN","DISMISSED"].map(s=><option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
          </select>
        </div>
        
        {/* Interview scheduling form - appears when user selects INTERVIEW_SCHEDULED */}
        {interviewForm&&interviewForm.jobId===selectedJob.id&&(
        <div style={{padding:12,borderRadius:10,background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.2)",marginBottom:8}}>
          <p style={{color:"#FBBF24",fontSize:12,fontWeight:600,margin:"0 0 8px"}}>Schedule Interview</p>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            <input type="datetime-local" value={interviewForm.date} onChange={e=>setInterviewForm(prev=>({...prev,date:e.target.value}))} style={{padding:"8px 10px",borderRadius:6,border:"1px solid rgba(245,158,11,.2)",background:"rgba(0,0,0,.3)",color:"rgba(255,255,255,.8)",fontSize:12}}/>
            <input placeholder="Interviewer name" value={interviewForm.name} onChange={e=>setInterviewForm(prev=>({...prev,name:e.target.value}))} style={{padding:"8px 10px",borderRadius:6,border:"1px solid rgba(255,255,255,.1)",background:"rgba(0,0,0,.3)",color:"rgba(255,255,255,.8)",fontSize:12}}/>
            <input placeholder="Notes (optional)" value={interviewForm.notes} onChange={e=>setInterviewForm(prev=>({...prev,notes:e.target.value}))} style={{padding:"8px 10px",borderRadius:6,border:"1px solid rgba(255,255,255,.1)",background:"rgba(0,0,0,.3)",color:"rgba(255,255,255,.8)",fontSize:12}}/>
          </div>
          <div style={{display:"flex",gap:6,marginTop:8}}>
            <button onClick={async()=>{
              try{
                const assignee=(selectedJob.assignees||[])[0]||"unmatched";
                const r=await fetch(`${ABABASE}/api/awa/jobs/${selectedJob.id}/status`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:assignee,status:"INTERVIEW_SCHEDULED",interviewDate:interviewForm.date||null,interviewerName:interviewForm.name||null,notes:interviewForm.notes||null})});
                const d=await r.json();
                if(d.success){
                  setSelectedJob(prev=>({...prev,status:"INTERVIEW_SCHEDULED",interview_date:interviewForm.date,interviewer_name:interviewForm.name,interview_notes:interviewForm.notes}));
                  setJobs(prev=>prev.map(j=>j.id===selectedJob.id?{...j,status:"INTERVIEW_SCHEDULED"}:j));
                  setInterviewForm(null);
                  setOutput(d.message);
                }
              }catch(e){setOutput("Interview schedule error: "+e.message)}
            }} style={{flex:1,padding:"10px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(245,158,11,.25)",color:"#FBBF24",fontSize:12,fontWeight:600}}>
              Confirm Interview
            </button>
            <button onClick={()=>setInterviewForm(null)} style={{padding:"10px 16px",borderRadius:8,border:"1px solid rgba(255,255,255,.1)",cursor:"pointer",background:"transparent",color:"rgba(255,255,255,.4)",fontSize:12}}>
              Cancel
            </button>
          </div>
        </div>
        )}
        
        {/* Offer form - appears when user selects OFFER */}
        {offerForm&&offerForm.jobId===selectedJob.id&&(
        <div style={{padding:12,borderRadius:10,background:"rgba(139,92,246,.08)",border:"1px solid rgba(139,92,246,.2)",marginBottom:8}}>
          <p style={{color:"#A78BFA",fontSize:12,fontWeight:600,margin:"0 0 8px"}}>Offer Details</p>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            <input placeholder="Salary offered" value={offerForm.salary} onChange={e=>setOfferForm(prev=>({...prev,salary:e.target.value}))} style={{padding:"8px 10px",borderRadius:6,border:"1px solid rgba(139,92,246,.2)",background:"rgba(0,0,0,.3)",color:"rgba(255,255,255,.8)",fontSize:12}}/>
            <input type="date" value={offerForm.deadline} onChange={e=>setOfferForm(prev=>({...prev,deadline:e.target.value}))} placeholder="Response deadline" style={{padding:"8px 10px",borderRadius:6,border:"1px solid rgba(255,255,255,.1)",background:"rgba(0,0,0,.3)",color:"rgba(255,255,255,.8)",fontSize:12}}/>
            <input placeholder="Notes (benefits, details)" value={offerForm.details} onChange={e=>setOfferForm(prev=>({...prev,details:e.target.value}))} style={{padding:"8px 10px",borderRadius:6,border:"1px solid rgba(255,255,255,.1)",background:"rgba(0,0,0,.3)",color:"rgba(255,255,255,.8)",fontSize:12}}/>
          </div>
          <div style={{display:"flex",gap:6,marginTop:8}}>
            <button onClick={async()=>{
              try{
                const assignee=(selectedJob.assignees||[])[0]||"unmatched";
                const r=await fetch(`${ABABASE}/api/awa/jobs/${selectedJob.id}/status`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:assignee,status:"OFFER",offerSalary:offerForm.salary||null,offerDeadline:offerForm.deadline||null,offerDetails:offerForm.details||null})});
                const d=await r.json();
                if(d.success){
                  setSelectedJob(prev=>({...prev,status:"OFFER",offer_salary:offerForm.salary,offer_deadline:offerForm.deadline,offer_details:offerForm.details}));
                  setJobs(prev=>prev.map(j=>j.id===selectedJob.id?{...j,status:"OFFER"}:j));
                  setOfferForm(null);
                  setOutput(d.message);
                }
              }catch(e){setOutput("Offer save error: "+e.message)}
            }} style={{flex:1,padding:"10px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(139,92,246,.25)",color:"#A78BFA",fontSize:12,fontWeight:600}}>
              Save Offer
            </button>
            <button onClick={()=>setOfferForm(null)} style={{padding:"10px 16px",borderRadius:8,border:"1px solid rgba(255,255,255,.1)",cursor:"pointer",background:"transparent",color:"rgba(255,255,255,.4)",fontSize:12}}>
              Cancel
            </button>
          </div>
        </div>
        )}
        
        {/* ⬡B:AWA.v4:interview_details_display:20260319⬡ */}
        {!interviewForm&&(selectedJob.status==="INTERVIEW_SCHEDULED"||selectedJob.interview_date)&&(
        <div style={{padding:10,borderRadius:8,background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.15)",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <p style={{color:"#FBBF24",fontSize:11,fontWeight:600,margin:0}}>Interview Details</p>
            <button onClick={()=>setInterviewForm({jobId:selectedJob.id,date:selectedJob.interview_date||"",name:selectedJob.interviewer_name||"",notes:selectedJob.interview_notes||""})} style={{background:"none",border:"none",color:"rgba(245,158,11,.5)",cursor:"pointer",fontSize:10}}>Edit</button>
          </div>
          {selectedJob.interview_date&&<p style={{color:"rgba(255,255,255,.7)",fontSize:11,margin:"4px 0 2px"}}>Date: {new Date(selectedJob.interview_date).toLocaleString()}</p>}
          {selectedJob.interviewer_name&&<p style={{color:"rgba(255,255,255,.7)",fontSize:11,margin:"2px 0"}}>With: {selectedJob.interviewer_name}</p>}
          {selectedJob.interview_notes&&<p style={{color:"rgba(255,255,255,.5)",fontSize:10,margin:"4px 0 0"}}>{selectedJob.interview_notes}</p>}
        </div>
        )}
        
        {/* ⬡B:AWA.v4:interview_prep_mock:20260319⬡ */}
        {(selectedJob.status==="INTERVIEW_SCHEDULED"||selectedJob.status==="INTERVIEWED"||selectedJob.status==="SECOND_INTERVIEW")&&!mockMode&&(
        <div style={{display:"flex",gap:6,marginBottom:8}}>
          <button disabled={prepLoading} onClick={async()=>{
            setPrepLoading(true);setPrepData(null);
            try{
              const assignee=(selectedJob.assignees||[])[0]||"unmatched";
              const r=await fetch(`${ABABASE}/api/awa/jobs/${selectedJob.id}/interview-prep`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:assignee})});
              const d=await r.json();
              if(d.success)setPrepData(d.prep);
              else setOutput("Prep failed: "+(d.error||"Unknown"));
            }catch(e){setOutput("Prep error: "+e.message)}
            setPrepLoading(false);
          }} style={{flex:1,padding:"10px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(245,158,11,.2)",color:"#FBBF24",fontSize:11,fontWeight:600,opacity:prepLoading?.5:1}}>
            {prepLoading?"Generating...":"Interview Prep"}
          </button>
          <button onClick={()=>{setMockMode(true);setMockQuestion(null);setMockAnswer("");setMockEval(null);setMockHistory([])}} style={{flex:1,padding:"10px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(6,182,212,.2)",color:"#22D3EE",fontSize:11,fontWeight:600}}>
            Practice Interview
          </button>
        </div>
        )}
        
        {/* Interview Prep Results */}
        {prepData&&!mockMode&&(
        <div style={{padding:10,borderRadius:8,background:"rgba(245,158,11,.05)",border:"1px solid rgba(245,158,11,.1)",marginBottom:8,maxHeight:300,overflowY:"auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{color:"#FBBF24",fontSize:11,fontWeight:600}}>Interview Prep</span>
            <button onClick={()=>setPrepData(null)} style={{background:"none",border:"none",color:"rgba(255,255,255,.3)",cursor:"pointer",fontSize:14}}>x</button>
          </div>
          {prepData.roleAnalysis&&<div style={{marginBottom:6}}><p style={{color:"rgba(255,255,255,.5)",fontSize:9,margin:"0 0 2px"}}>WHAT THEY WANT</p><p style={{color:"rgba(255,255,255,.7)",fontSize:11,margin:0}}>{prepData.roleAnalysis}</p></div>}
          {prepData.talkingPoints&&<div style={{marginBottom:6}}><p style={{color:"rgba(255,255,255,.5)",fontSize:9,margin:"0 0 2px"}}>YOUR TALKING POINTS</p>{(Array.isArray(prepData.talkingPoints)?prepData.talkingPoints:[]).map((tp,i)=><p key={i} style={{color:"rgba(255,255,255,.6)",fontSize:10,margin:"2px 0"}}>• {tp}</p>)}</div>}
          {prepData.commonQuestions&&<div style={{marginBottom:6}}><p style={{color:"rgba(255,255,255,.5)",fontSize:9,margin:"0 0 2px"}}>LIKELY QUESTIONS</p>{(Array.isArray(prepData.commonQuestions)?prepData.commonQuestions:[]).map((q,i)=><p key={i} style={{color:"rgba(255,255,255,.6)",fontSize:10,margin:"2px 0"}}>{i+1}. {q}</p>)}</div>}
          {prepData.questionsToAsk&&<div><p style={{color:"rgba(255,255,255,.5)",fontSize:9,margin:"0 0 2px"}}>ASK THEM</p>{(Array.isArray(prepData.questionsToAsk)?prepData.questionsToAsk:[]).map((q,i)=><p key={i} style={{color:"#22D3EE",fontSize:10,margin:"2px 0"}}>• {q}</p>)}</div>}
        </div>
        )}
        
        {/* Mock Interview Mode */}
        {mockMode&&(
        <div style={{padding:12,borderRadius:10,background:"rgba(6,182,212,.06)",border:"1px solid rgba(6,182,212,.15)",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{color:"#22D3EE",fontSize:12,fontWeight:600}}>Mock Interview ({mockHistory.length} questions)</span>
            <button onClick={()=>{setMockMode(false);setMockQuestion(null);setMockEval(null)}} style={{background:"none",border:"none",color:"rgba(255,255,255,.3)",cursor:"pointer",fontSize:14}}>x</button>
          </div>
          
          {/* Get next question */}
          {!mockQuestion&&!mockLoading&&(
            <button onClick={async()=>{
              setMockLoading(true);
              try{
                const assignee=(selectedJob.assignees||[])[0]||"unmatched";
                const r=await fetch(`${ABABASE}/api/awa/jobs/${selectedJob.id}/mock-question`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:assignee,previousQuestions:mockHistory})});
                const d=await r.json();
                if(d.success)setMockQuestion(d);
                else setOutput("Mock question failed: "+(d.error||"Unknown"));
              }catch(e){setOutput("Mock error: "+e.message)}
              setMockLoading(false);
            }} style={{width:"100%",padding:"12px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(6,182,212,.2)",color:"#22D3EE",fontSize:12,fontWeight:600}}>
              {mockHistory.length===0?"Start Mock Interview":"Next Question"}
            </button>
          )}
          
          {mockLoading&&<p style={{color:"rgba(6,182,212,.6)",fontSize:11,textAlign:"center"}}>Thinking of a question...</p>}
          
          {/* Show question + answer input */}
          {mockQuestion&&!mockEval&&(
          <div>
            <div style={{padding:8,borderRadius:6,background:"rgba(0,0,0,.3)",marginBottom:8}}>
              {mockQuestion.type&&<span style={{fontSize:9,color:"rgba(6,182,212,.6)",fontWeight:600,textTransform:"uppercase"}}>{mockQuestion.type} • {mockQuestion.difficulty}</span>}
              <p style={{color:"rgba(255,255,255,.8)",fontSize:12,margin:"4px 0 0",lineHeight:1.5}}>{mockQuestion.question}</p>
              {mockQuestion.tip&&<p style={{color:"rgba(245,158,11,.6)",fontSize:9,margin:"6px 0 0",fontStyle:"italic"}}>Tip: {mockQuestion.tip}</p>}
            </div>
            <textarea value={mockAnswer} onChange={e=>setMockAnswer(e.target.value)} placeholder="Type your answer..." rows={4} style={{width:"100%",padding:10,borderRadius:8,border:"1px solid rgba(255,255,255,.1)",background:"rgba(0,0,0,.3)",color:"rgba(255,255,255,.8)",fontSize:12,resize:"vertical",boxSizing:"border-box"}}/>
            <button disabled={!mockAnswer.trim()||mockLoading} onClick={async()=>{
              setMockLoading(true);
              try{
                const assignee=(selectedJob.assignees||[])[0]||"unmatched";
                const r=await fetch(`${ABABASE}/api/awa/jobs/${selectedJob.id}/mock-evaluate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:assignee,question:mockQuestion.question,answer:mockAnswer})});
                const d=await r.json();
                if(d.success){setMockEval(d);setMockHistory(prev=>[...prev,mockQuestion.question])}
                else setOutput("Eval failed: "+(d.error||"Unknown"));
              }catch(e){setOutput("Eval error: "+e.message)}
              setMockLoading(false);
            }} style={{width:"100%",marginTop:6,padding:"10px",borderRadius:8,border:"none",cursor:"pointer",background:mockAnswer.trim()?"rgba(6,182,212,.25)":"rgba(255,255,255,.05)",color:mockAnswer.trim()?"#22D3EE":"rgba(255,255,255,.3)",fontSize:12,fontWeight:600}}>
              {mockLoading?"Evaluating...":"Submit Answer"}
            </button>
          </div>
          )}
          
          {/* Show evaluation */}
          {mockEval&&(
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <span style={{fontSize:20,fontWeight:700,color:mockEval.score>=7?"#10B981":mockEval.score>=5?"#FBBF24":"#EF4444"}}>{mockEval.score}/10</span>
              {mockEval.encouragement&&<p style={{color:"rgba(255,255,255,.6)",fontSize:11,margin:0,flex:1}}>{mockEval.encouragement}</p>}
            </div>
            {mockEval.strengths&&<div style={{marginBottom:4}}><p style={{color:"#10B981",fontSize:9,margin:"0 0 2px",fontWeight:600}}>STRENGTHS</p>{mockEval.strengths.map((s,i)=><p key={i} style={{color:"rgba(255,255,255,.6)",fontSize:10,margin:"1px 0"}}>+ {s}</p>)}</div>}
            {mockEval.improvements&&<div style={{marginBottom:4}}><p style={{color:"#F59E0B",fontSize:9,margin:"0 0 2px",fontWeight:600}}>IMPROVE</p>{mockEval.improvements.map((s,i)=><p key={i} style={{color:"rgba(255,255,255,.6)",fontSize:10,margin:"1px 0"}}>- {s}</p>)}</div>}
            {mockEval.betterAnswer&&<div style={{padding:8,borderRadius:6,background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.1)",marginBottom:6}}><p style={{color:"rgba(255,255,255,.4)",fontSize:9,margin:"0 0 3px"}}>STRONGER VERSION</p><p style={{color:"rgba(255,255,255,.7)",fontSize:11,margin:0,lineHeight:1.5}}>{mockEval.betterAnswer}</p></div>}
            <button onClick={()=>{setMockQuestion(null);setMockAnswer("");setMockEval(null)}} style={{width:"100%",padding:"10px",borderRadius:8,border:"none",cursor:"pointer",background:"rgba(6,182,212,.2)",color:"#22D3EE",fontSize:12,fontWeight:600,marginTop:4}}>
              Next Question
            </button>
          </div>
          )}
        </div>
        )}
        
        {/* ⬡B:AWA.v4:offer_details_display:20260319⬡ */}
        {!offerForm&&selectedJob.status==="OFFER"&&(
        <div style={{padding:10,borderRadius:8,background:"rgba(139,92,246,.08)",border:"1px solid rgba(139,92,246,.15)",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <p style={{color:"#A78BFA",fontSize:11,fontWeight:600,margin:0}}>Offer Details</p>
            <button onClick={()=>setOfferForm({jobId:selectedJob.id,salary:selectedJob.offer_salary||"",deadline:selectedJob.offer_deadline||"",details:selectedJob.offer_details||""})} style={{background:"none",border:"none",color:"rgba(139,92,246,.5)",cursor:"pointer",fontSize:10}}>Edit</button>
          </div>
          {selectedJob.offer_salary&&<p style={{color:"rgba(255,255,255,.7)",fontSize:11,margin:"4px 0 2px"}}>Salary: {selectedJob.offer_salary}</p>}
          {selectedJob.offer_deadline&&<p style={{color:"rgba(255,255,255,.7)",fontSize:11,margin:"2px 0"}}>Deadline: {new Date(selectedJob.offer_deadline).toLocaleDateString()}</p>}
          {selectedJob.offer_details&&<p style={{color:"rgba(255,255,255,.5)",fontSize:10,margin:"4px 0 0"}}>{selectedJob.offer_details}</p>}
        </div>
        )}
        
        {/* ⬡B:AWA.v3:Phase5:references_in_job:20260315⬡ */}
        <button onClick={async()=>{
          if(showRefs){setShowRefs(false);return}
          try{
            const assignee=(selectedJob.assignees||[])[0]||"unmatched";
            const r=await fetch(`${ABABASE}/api/awa/references?userId=${assignee}`);
            const d=await r.json();
            if(d.success)setJobRefs(d.references||[]);
            setShowRefs(true);
          }catch(e){console.error("[AWA] Refs load failed:",e)}
        }} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid rgba(139,92,246,.15)",cursor:"pointer",background:"rgba(139,92,246,.06)",color:"rgba(167,139,250,.8)",fontSize:11,fontWeight:500,marginBottom:showRefs?0:8,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <Users size={12}/>{showRefs?"Hide References":"Show References"}
        </button>
        {showRefs&&<div style={{padding:8,borderRadius:8,background:"rgba(139,92,246,.04)",border:"1px solid rgba(139,92,246,.1)",marginBottom:8,marginTop:4}}>
          {jobRefs.length===0?<p style={{color:"rgba(255,255,255,.4)",fontSize:10,textAlign:"center",margin:0}}>No references saved yet</p>:
          jobRefs.map((ref,i)=>(
            <div key={ref.id||i} style={{padding:6,borderBottom:i<jobRefs.length-1?"1px solid rgba(255,255,255,.04)":"none"}}>
              <p style={{color:"rgba(255,255,255,.8)",fontSize:11,fontWeight:500,margin:0}}>{ref.name}</p>
              <p style={{color:"rgba(255,255,255,.5)",fontSize:10,margin:"1px 0"}}>{[ref.title,ref.organization].filter(Boolean).join(", ")}</p>
              {ref.phone&&<p style={{color:"rgba(255,255,255,.4)",fontSize:9,margin:0}}>{ref.phone}</p>}
              {ref.email&&<p style={{color:"rgba(255,255,255,.4)",fontSize:9,margin:0}}>{ref.email}</p>}
            </div>
          ))}
        </div>}
        
        {/* Dismiss button */}
        <button onClick={async()=>{
          if(!confirm("Dismiss this job for everyone?"))return;
          try{
            await fetch(`${ABABASE}/api/awa/jobs/${selectedJob.id}/dismiss`,{
              method:"PATCH",headers:{"Content-Type":"application/json"},
              body:JSON.stringify({userId:user?.email||"unknown",admin_dismiss:true,reason:"Dismissed from MyABA"})
            });
            setJobs(prev=>prev.filter(j=>j.id!==selectedJob.id));
            setSelectedJob(null);setOutput(null);
          }catch(e){console.error("[AWA] Dismiss failed:",e)}
        }} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid rgba(239,68,68,.2)",cursor:"pointer",background:"rgba(239,68,68,.08)",color:"rgba(239,68,68,.7)",fontSize:11,fontWeight:500,marginBottom:12,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <Trash2 size={12}/>Dismiss Job
        </button>
        
        {output&&<div style={{background:"rgba(0,0,0,.3)",borderRadius:8,padding:12,maxHeight:200,overflowY:"auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{color:"rgba(255,255,255,.5)",fontSize:11}}>Generated Output</span>
            <button onClick={()=>navigator.clipboard.writeText(output)} style={{background:"none",border:"none",cursor:"pointer",padding:2}}><Copy size={14} style={{color:"rgba(139,92,246,.6)"}}/></button>
          </div>
          <pre style={{color:"rgba(255,255,255,.7)",fontSize:11,margin:0,whiteSpace:"pre-wrap",lineHeight:1.5}}>{output}</pre>
        </div>}
      </div>}
    </div>}
    
    {/* Stats footer */}
    <div style={{padding:"8px 0 0",borderTop:"1px solid rgba(255,255,255,.05)",marginTop:8}}>
      <p style={{color:"rgba(255,255,255,.3)",fontSize:10,textAlign:"center",margin:0}}>{filtered.length} of {jobs.length} jobs • AWA powered by ABA</p>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════
// PIPELINE VIEW — Kanban board for AWA job tracking
// ⬡B:AWA.v3:Phase6:kanban:20260315⬡
// ═══════════════════════════════════════════════════════════════════════════
function PipelineView({userId}){
  const[pipeline,setPipeline]=useState(null);
  const[loading,setLoading]=useState(true);
  const[expandedCol,setExpandedCol]=useState(null);

  const ABABASE="https://abacia-services.onrender.com";

  const COLUMNS=[
    {key:"NEW",label:"New",color:"#6B7280",icon:"📥"},
    {key:"MATERIALS_READY",label:"Ready",color:"#8B5CF6",icon:"📄"},
    {key:"APPLIED",label:"Applied",color:"#10B981",icon:"📨"},
    {key:"WAITING",label:"Waiting",color:"#F59E0B",icon:"⏳"},
    {key:"INTERVIEW_SCHEDULED",label:"Interview",color:"#EC4899",icon:"🎤"},
    {key:"INTERVIEWED",label:"Done",color:"#F97316",icon:"✅"},
    {key:"OFFER",label:"Offer",color:"#A78BFA",icon:"💰"},
    {key:"ACCEPTED",label:"Won",color:"#34D399",icon:"🎉"},
  ];

  useEffect(()=>{
    (async()=>{
      try{
        const r=await fetch(`${ABABASE}/api/awa/pipeline?userId=${userId}`);
        const d=await r.json();
        if(d.success)setPipeline(d);
      }catch(e){console.error("[PIPELINE]",e)}
      setLoading(false);
    })();
  },[userId]);

  if(loading)return <div style={{padding:20,textAlign:"center",color:"rgba(255,255,255,.4)"}}>Loading pipeline...</div>;
  if(!pipeline)return <div style={{padding:20,textAlign:"center",color:"rgba(255,255,255,.4)"}}>Could not load pipeline</div>;

  const jobs=pipeline.jobs||[];
  const counts=pipeline.pipeline||{};
  const activeCount=jobs.filter(j=>j.status!=="DISMISSED").length;

  return(<div style={{display:"flex",flexDirection:"column",height:"100%",gap:8}}>
    {/* Summary bar */}
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
      <span style={{color:"white",fontSize:14,fontWeight:600}}>Pipeline</span>
      <span style={{color:"rgba(255,255,255,.4)",fontSize:11}}>{activeCount} active</span>
    </div>

    {/* Vertical stacked rows - mobile friendly */}
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:4,paddingBottom:8}}>
      {COLUMNS.map(col=>{
        const colJobs=jobs.filter(j=>j.status===col.key);
        const isExpanded=expandedCol===col.key;
        return(
        <div key={col.key} onClick={()=>setExpandedCol(isExpanded?null:col.key)} style={{background:"rgba(255,255,255,.02)",borderRadius:12,border:`1px solid ${colJobs.length>0?col.color+"30":"rgba(255,255,255,.05)"}`,padding:"10px 14px",cursor:"pointer",transition:"all .2s"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:14}}>{col.icon}</span>
            <span style={{color:col.color,fontSize:12,fontWeight:600,flex:1}}>{col.label}</span>
            <span style={{background:`${col.color}20`,color:col.color,fontSize:12,fontWeight:700,padding:"2px 10px",borderRadius:10,minWidth:24,textAlign:"center"}}>{colJobs.length}</span>
            <ChevronRight size={14} style={{color:"rgba(255,255,255,.2)",transform:isExpanded?"rotate(90deg)":"none",transition:"transform .2s"}}/>
          </div>
          {isExpanded&&colJobs.length>0&&<div style={{marginTop:8,display:"flex",flexDirection:"column",gap:4}}>
            {colJobs.map(job=>(
              <div key={job.id} style={{padding:10,borderRadius:8,background:"rgba(0,0,0,.3)",border:"1px solid rgba(255,255,255,.05)"}}>
                <p style={{color:"rgba(255,255,255,.85)",fontSize:12,fontWeight:500,margin:0,lineHeight:1.3}}>{(job.job_title||job.title||"").substring(0,60)}</p>
                <p style={{color:"rgba(255,255,255,.4)",fontSize:11,margin:"2px 0 0"}}>{(job.organization||"").substring(0,40)}</p>
                {job.interview_date&&<p style={{color:"#FBBF24",fontSize:10,margin:"3px 0 0"}}>Interview: {new Date(job.interview_date).toLocaleDateString()}</p>}
              </div>
            ))}
          </div>}
          {isExpanded&&colJobs.length===0&&<p style={{color:"rgba(255,255,255,.2)",fontSize:11,margin:"6px 0 0",fontStyle:"italic"}}>No jobs in this stage</p>}
        </div>
        );
      })}
    </div>

    {/* Alerts summary */}
    <AlertsSummary userId={userId}/>
  </div>);
}

// ⬡B:AWA.v3:proactive:alerts_summary:20260315⬡
function AlertsSummary({userId}){
  const[alerts,setAlerts]=useState([]);
  const ABABASE="https://abacia-services.onrender.com";

  useEffect(()=>{
    (async()=>{
      try{
        const r=await fetch(`${ABABASE}/api/awa/alerts?userId=${userId}`);
        const d=await r.json();
        if(d.success)setAlerts(d.alerts||[]);
      }catch(e){}
    })();
  },[userId]);

  const urgent=alerts.filter(a=>a.priority==="critical"||a.priority==="high");
  if(urgent.length===0)return null;

  return(<div style={{padding:8,borderRadius:8,background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.12)"}}>
    <p style={{color:"#FBBF24",fontSize:10,fontWeight:600,margin:"0 0 4px"}}>Alerts ({urgent.length})</p>
    {urgent.slice(0,3).map((a,i)=>(
      <p key={i} style={{color:"rgba(255,255,255,.6)",fontSize:10,margin:"2px 0",lineHeight:1.4}}>{a.message.substring(0,100)}</p>
    ))}
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN — v1.1.3-P1-S1: Fixed JSON parsing
// ═══════════════════════════════════════════════════════════════════════════
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

  const go=async()=>{setLoading(true);setError(null);try{const result=await signInGoogle();onLogin(result.user)}catch(e){setError(e.message)}finally{setLoading(false)}};

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
function SettingsDrawer({open,onClose,bg,setBg,voiceOut,setVoiceOut,onLogout,user}){
  const[notifyBriefing,setNotifyBriefing]=useState(()=>{try{return localStorage.getItem("myaba_notifyBriefing")!=="false"}catch{return true}});
  const[notifyUrgent,setNotifyUrgent]=useState(()=>{try{return localStorage.getItem("myaba_notifyUrgent")!=="false"}catch{return true}});
  const[autoSpeak,setAutoSpeak]=useState(()=>{try{return localStorage.getItem("myaba_autoSpeak")==="true"}catch{return false}});
  const[pushEnabled,setPushEnabled]=useState(()=>{try{return localStorage.getItem("myaba_pushEnabled")==="true"}catch{return false}});
  const[pushLoading,setPushLoading]=useState(false);
  // ⬡B:MYABA.V2:ghost:20260313⬡ Ghost Mode state
  const[ghostMode,setGhostMode]=useState(false);
  const[ghostLoading,setGhostLoading]=useState(false);
  
  // Load ghost mode status on mount
  useEffect(()=>{
    if(!user?.email)return;
    (async()=>{
      try{
        const res=await fetch(`https://abacia-services.onrender.com/api/myaba/ghost?userId=${encodeURIComponent(user.email)}`);
        if(res.ok){
          const data=await res.json();
          setGhostMode(data.active||false);
        }
      }catch(e){console.error("[GHOST] Load failed:",e)}
    })();
  },[user?.email]);
  
  const handleGhostToggle=async(enable)=>{
    setGhostLoading(true);
    try{
      const res=await fetch('https://abacia-services.onrender.com/api/myaba/ghost',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({userId:user?.email||user?.uid||"unknown",enabled:enable,duration:24})
      });
      if(res.ok){
        const data=await res.json();
        setGhostMode(data.active||enable);
      }
    }catch(e){console.error("[GHOST] Toggle failed:",e)}
    setGhostLoading(false);
  };
  
  useEffect(()=>{try{localStorage.setItem("myaba_notifyBriefing",String(notifyBriefing))}catch{}},[notifyBriefing]);
  useEffect(()=>{try{localStorage.setItem("myaba_notifyUrgent",String(notifyUrgent))}catch{}},[notifyUrgent]);
  useEffect(()=>{try{localStorage.setItem("myaba_autoSpeak",String(autoSpeak))}catch{}},[autoSpeak]);
  useEffect(()=>{try{localStorage.setItem("myaba_pushEnabled",String(pushEnabled))}catch{}},[pushEnabled]);
  
  const handlePushToggle=async(enable)=>{
    setPushLoading(true);
    try{
      if(enable){
        const sub=await subscribeToPush(user?.email||user?.uid||"unknown");
        if(sub)setPushEnabled(true);
      }else{
        await unsubscribeFromPush(user?.email||user?.uid||"unknown");
        setPushEnabled(false);
      }
    }catch(e){console.error(e)}
    setPushLoading(false);
  };
  
  if(!open)return null;
  
  const Toggle=({value,onChange,label,sublabel})=>(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
      <div>
        <p style={{color:"rgba(255,255,255,.85)",fontSize:13,fontWeight:500,margin:0}}>{label}</p>
        {sublabel&&<p style={{color:"rgba(255,255,255,.4)",fontSize:11,margin:"2px 0 0"}}>{sublabel}</p>}
      </div>
      <button onClick={()=>onChange(!value)} style={{width:48,height:28,borderRadius:99,border:"none",cursor:"pointer",background:value?"rgba(139,92,246,.5)":"rgba(255,255,255,.1)",position:"relative",transition:"background .2s"}}>
        <div style={{position:"absolute",top:2,left:value?22:2,width:24,height:24,borderRadius:"50%",background:"white",boxShadow:"0 2px 4px rgba(0,0,0,.2)",transition:"left .2s"}}/>
      </button>
    </div>
  );
  
  const Section=({title,children})=>(
    <div style={{marginBottom:20}}>
      <p style={{color:"rgba(255,255,255,.35)",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:8}}>{title}</p>
      <div style={{background:"rgba(255,255,255,.03)",borderRadius:14,padding:"4px 14px"}}>{children}</div>
    </div>
  );
  
  return(<div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
    <div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(0,0,0,.6)"}}/>
    <div style={{position:"relative",zIndex:101,width:"100%",maxWidth:480,background:"rgba(12,10,24,.98)",backdropFilter:"blur(24px)",border:"1px solid rgba(255,255,255,.08)",borderRadius:"24px 24px 0 0",padding:"24px 20px calc(32px + env(safe-area-inset-bottom))",maxHeight:"85vh",overflowY:"auto"}}>
      
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <span style={{color:"rgba(255,255,255,.9)",fontSize:18,fontWeight:700}}>Settings</span>
        <button onClick={onClose} style={{background:"rgba(255,255,255,.08)",border:"none",color:"white",width:36,height:36,borderRadius:99,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={18}/></button>
      </div>
      
      {/* User info */}
      {user&&<div style={{display:"flex",alignItems:"center",gap:12,padding:14,background:"rgba(139,92,246,.08)",borderRadius:14,marginBottom:20}}>
        {user.photoURL?<img src={user.photoURL} alt="" style={{width:44,height:44,borderRadius:"50%",border:"2px solid rgba(139,92,246,.3)"}}/>:<div style={{width:44,height:44,borderRadius:"50%",background:"rgba(139,92,246,.2)",display:"flex",alignItems:"center",justifyContent:"center"}}><User size={22} style={{color:"rgba(139,92,246,.7)"}}/></div>}
        <div style={{flex:1}}>
          <p style={{color:"rgba(255,255,255,.9)",fontSize:14,fontWeight:600,margin:0}}>{user.displayName||"User"}</p>
          <p style={{color:"rgba(255,255,255,.5)",fontSize:11,margin:"2px 0 0"}}>{user.email}</p>
        </div>
      </div>}
      
      {/* Voice */}
      <Section title="Voice">
        <Toggle value={voiceOut} onChange={setVoiceOut} label="Voice responses" sublabel="ABA speaks her responses aloud"/>
        <Toggle value={autoSpeak} onChange={setAutoSpeak} label="Auto-speak" sublabel="Automatically speak without tapping"/>
      </Section>
      
      {/* Notifications */}
      <Section title="Notifications">
        <Toggle value={notifyBriefing} onChange={setNotifyBriefing} label="Morning briefing" sublabel="Daily summary at 6 AM"/>
        <Toggle value={notifyUrgent} onChange={setNotifyUrgent} label="Urgent alerts" sublabel="Calls and texts for emergencies"/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0"}}>
          <div>
            <p style={{color:"rgba(255,255,255,.85)",fontSize:13,fontWeight:500,margin:0}}>Push notifications</p>
            <p style={{color:"rgba(255,255,255,.4)",fontSize:11,margin:"2px 0 0"}}>Alerts even when app is closed</p>
          </div>
          <button onClick={()=>handlePushToggle(!pushEnabled)} disabled={pushLoading} style={{width:48,height:28,borderRadius:99,border:"none",cursor:pushLoading?"wait":"pointer",background:pushEnabled?"rgba(139,92,246,.5)":"rgba(255,255,255,.1)",position:"relative",transition:"background .2s",opacity:pushLoading?.5:1}}>
            <div style={{position:"absolute",top:2,left:pushEnabled?22:2,width:24,height:24,borderRadius:"50%",background:"white",boxShadow:"0 2px 4px rgba(0,0,0,.2)",transition:"left .2s"}}/>
          </button>
        </div>
      </Section>
      
      {/* ⬡B:MYABA.V2:ghost_ui:20260313⬡ Ghost Mode Section */}
      <Section title="Privacy">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
          <div>
            <p style={{color:ghostMode?"rgba(139,92,246,.95)":"rgba(255,255,255,.85)",fontSize:13,fontWeight:500,margin:0}}>Ghost Mode {ghostMode&&"👻"}</p>
            <p style={{color:"rgba(255,255,255,.4)",fontSize:11,margin:"2px 0 0"}}>ABA handles everything silently for 24h</p>
          </div>
          <button onClick={()=>handleGhostToggle(!ghostMode)} disabled={ghostLoading} style={{width:48,height:28,borderRadius:99,border:"none",cursor:ghostLoading?"wait":"pointer",background:ghostMode?"rgba(139,92,246,.5)":"rgba(255,255,255,.1)",position:"relative",transition:"background .2s",opacity:ghostLoading?.5:1}}>
            <div style={{position:"absolute",top:2,left:ghostMode?22:2,width:24,height:24,borderRadius:"50%",background:"white",boxShadow:"0 2px 4px rgba(0,0,0,.2)",transition:"left .2s"}}/>
          </button>
        </div>
        {ghostMode&&<div style={{padding:"10px 0",color:"rgba(139,92,246,.7)",fontSize:11}}>
          ABA is handling your messages autonomously. Toggle off to resume normal notifications.
        </div>}
      </Section>
      
      {/* Appearance */}
      <Section title="Background">
        <div style={{padding:"8px 0"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {Object.entries(BG).map(([k,{u,l}])=>(
              <button key={k} onClick={()=>setBg(k)} style={{position:"relative",aspectRatio:"16/10",borderRadius:10,overflow:"hidden",border:bg===k?"2px solid rgba(139,92,246,.8)":"2px solid rgba(255,255,255,.06)",cursor:"pointer",background:"#111",padding:0,boxShadow:bg===k?"0 0 14px rgba(139,92,246,.4)":"none"}}>
                <img src={u} alt={l} style={{width:"100%",height:"100%",objectFit:"cover",opacity:.8}}/>
                <span style={{position:"absolute",bottom:0,left:0,right:0,padding:"10px 4px 4px",background:"linear-gradient(transparent,rgba(0,0,0,.8))",color:bg===k?"rgba(139,92,246,.95)":"rgba(255,255,255,.6)",fontSize:8,fontWeight:600,textAlign:"center"}}>{l}</span>
              </button>
            ))}
          </div>
        </div>
      </Section>
      
      {/* ⬡B:MYABA:CONNECT_EMAIL:20260320⬡ */}
      <button onClick={()=>{
        // Map email to ham_id for Nylas OAuth
        const email=(user?.email||"").toLowerCase();
        const hamMap={"brandonjpiercesr@gmail.com":"brandon","ericreeselane@gmail.com":"eric","bryanjpiercejr@gmail.com":"bj","cj.d.moore32@gmail.com":"cj","shields.devante@gmail.com":"vante","dmurrayjr34@gmail.com":"dwayne"};
        const hamId=hamMap[email]||email.split("@")[0];
        window.open(`https://abacia-services.onrender.com/api/nylas/connect?ham_id=${encodeURIComponent(hamId)}`,"_blank");
      }} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",padding:"14px 16px",borderRadius:14,border:"1px solid rgba(16,185,129,.2)",background:"rgba(16,185,129,.06)",color:"rgba(16,185,129,.8)",cursor:"pointer",fontSize:14,fontWeight:600,marginBottom:8}}>
        <Mail size={18}/>Connect Email
      </button>
      
      {/* Replay Tour */}
      <button onClick={()=>{try{localStorage.removeItem("myaba_tour_complete")}catch{};window.location.reload()}} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",padding:"12px 16px",borderRadius:14,border:"1px solid rgba(139,92,246,.15)",background:"rgba(139,92,246,.04)",color:"rgba(139,92,246,.6)",cursor:"pointer",fontSize:12,fontWeight:500,marginBottom:8}}>
        <Sparkles size={16}/>Replay Welcome Tour
      </button>
      
      {/* Sign out */}
      <button onClick={onLogout} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",padding:"14px 16px",borderRadius:14,border:"1px solid rgba(239,68,68,.2)",background:"rgba(239,68,68,.06)",color:"rgba(239,68,68,.8)",cursor:"pointer",fontSize:14,fontWeight:600}}>
        <LogOut size={18}/>Sign Out
      </button>
      
      {/* Version */}
      <div style={{marginTop:16,padding:"14px",background:"rgba(139,92,246,.05)",borderRadius:14,border:"1px solid rgba(139,92,246,.1)",textAlign:"center"}}>
        <p style={{color:"rgba(139,92,246,.7)",fontSize:11,fontWeight:600,margin:0}}>MyABA v2.25.0</p>
        <p style={{color:"rgba(255,255,255,.3)",fontSize:10,margin:"4px 0 0"}}>Pre-Alpha</p>
      </div>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════
// MYABA — v1.1.3-P1: All Phase 1 fixes applied
// ═══════════════════════════════════════════════════════════════════════════
export default function MyABA(){
  const[user,setUser]=useState(null);const[authLoading,setAuthLoading]=useState(true);
  const[convos,setConvos]=useState([]);const[activeId,setActiveId]=useState(null);
  const activeConv=convos.find(c=>c.id===activeId);const messages=activeConv?.messages||[];
  const[input,setInput]=useState("");const[abaState,setAbaState]=useState("idle");
  const[attachments,setAttachments]=useState([]); // SPURT 5: files attached to message
  const fileInputRef=useRef(null);
  const [scannerOpen,setScannerOpen]=useState(false);
  const[isTyping,setIsTyping]=useState(false);
  
  // v2.16.1: Settings from backend (fallback to localStorage, then defaults)
  const[bg,setBg]=useState(()=>{try{return localStorage.getItem("myaba_bg")||"pinkSmoke"}catch{return "pinkSmoke"}});
  const[voiceOut,setVoiceOut]=useState(()=>{try{return localStorage.getItem("myaba_voiceOut")!=="false"}catch{return true}});
  const[voiceMode,setVoiceMode]=useState(()=>{try{return localStorage.getItem("myaba_voiceMode")||"chat"}catch{return "chat"}});
  const[settingsLoaded,setSettingsLoaded]=useState(false);
  
  const[settingsOpen,setSettingsOpen]=useState(false);const[sidebarOpen,setSidebarOpen]=useState(false);
  const[mainTab,setMainTab]=useState("chat"); // ⬡B:aba_skins:STATE:chat_default_safe:20260323⬡ (apps grid via grid button)
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
  // v2.15.0: Admin mode for HAM users
  const[adminPanelOpen,setAdminPanelOpen]=useState(false);
  const[commandCenterOpen,setCommandCenterOpen]=useState(false);
  const[lastABAResponse,setLastABAResponse]=useState(null);
  // ⬡B:snap.quick_question:STATE:20260317⬡
  const[snapOpen,setSnapOpen]=useState(false);
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
      airAddMessage(backendId,msg.role,msg.content).catch(e=>console.error("[CHAT] Save message failed:",e));
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

  useEffect(()=>{
    if(!activeConv||activeConv.autoNamed||!user)return;
    if(activeConv.messages.length>=2){
      airNameChat(activeConv.messages,user.email||user.uid).then(name=>{
        if(name){
          setConvos(p=>p.map(c=>c.id===activeId?{...c,title:name,autoNamed:true}:c));
          // Sync title to backend
          if(activeId&&!String(activeId).startsWith('conv-')){
            fetch(`${ABABASE}/api/conversations/${activeId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:name})}).catch(()=>{});
          }
        }
      });
    }
  },[messages.length,activeId]);

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
      onChunk:(accumulated)=>{
        // Update the ABA message content in real-time
        setMessages(prev=>prev.map(m=>m.id===abaMsgId?{...m,content:accumulated}:m));
      },
      onToolStart:(tool)=>{
        setMessages(prev=>prev.map(m=>m.id===abaMsgId?{...m,content:m.content+(m.content?"\n":"")+"_Checking "+tool+"..._"}:m));
      },
      onDone:(data)=>{
        // Finalize: remove streaming flag, set final content
        setMessages(prev=>prev.map(m=>m.id===abaMsgId?{...m,content:data.fullResponse||m.content,streaming:false}:m));
        setLastABAResponse(data);
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
        a.onended=()=>{setAbaState("idle");if(liveRef.current&&startListeningRef.current)startListeningRef.current()};
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
        
        const blob=new Blob(chunks,{type:mimeType||"audio/webm"});
        console.log("[VOICE] Blob size:",blob.size,"type:",blob.type);
        
        try{
          const transcript=await reachTranscribe(blob);
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

  return(<div style={{width:"100%",height:"100dvh",minHeight:`${viewportHeight}px`,position:"relative",overflow:"hidden",fontFamily:"'SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",background:"#08080d",paddingTop:"env(safe-area-inset-top)",paddingBottom:"env(safe-area-inset-bottom)",boxSizing:"border-box"}}>
    <style>{`@keyframes mp{0%,100%{opacity:.3;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}@keyframes mf{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes mb{0%,100%{opacity:.6}50%{opacity:1}}@keyframes ml{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.4)}50%{box-shadow:0 0 0 12px rgba(239,68,68,0)}}@keyframes kenBurns{0%{transform:scale(1) translate(0,0)}25%{transform:scale(1.08) translate(-1%,-1%)}50%{transform:scale(1.12) translate(1%,0)}75%{transform:scale(1.06) translate(-0.5%,1%)}100%{transform:scale(1) translate(0,0)}}@keyframes pulse{0%{transform:scale(1);opacity:1}100%{transform:scale(1.5);opacity:0}}@keyframes breathe{0%,100%{transform:scale(1);box-shadow:0 0 40px rgba(139,92,246,.3)}50%{transform:scale(1.05);box-shadow:0 0 60px rgba(139,92,246,.5)}}@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(139,92,246,.15);border-radius:99px}`}</style>
    <div style={{position:"absolute",inset:"-10%",zIndex:0,backgroundImage:`url(${bgUrl})`,backgroundSize:"cover",backgroundPosition:"center",filter:"brightness(.4) saturate(.7)",animation:"kenBurns 30s ease-in-out infinite",willChange:"transform",WebkitBackfaceVisibility:"hidden"}}/>
    <div style={{position:"absolute",inset:0,zIndex:1,background:"radial-gradient(ellipse at center,rgba(0,0,0,0) 0%,rgba(0,0,0,.55) 100%)"}}/>
    <div style={{position:"relative",zIndex:2,display:"flex",flexDirection:"column",height:"100%",maxWidth:480,margin:"0 auto",padding:"0 14px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 2px 4px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>setSidebarOpen(true)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.5)",padding:0,display:"flex",minWidth:44,minHeight:44,alignItems:"center",justifyContent:"center"}}><MessageSquare size={18}/></button>
          <div style={{width:8,height:8,borderRadius:99,background:`rgba(${sc},.9)`,boxShadow:`0 0 10px rgba(${sc},.6)`,animation:"mb 3s ease infinite"}}/>
          <div style={{width:22,height:22,borderRadius:99,background:"linear-gradient(135deg,#8B5CF6,#6366F1)",display:"flex",alignItems:"center",justifyContent:"center",marginRight:4,boxShadow:"0 0 8px rgba(139,92,246,.4)"}}><Sparkles size={11} style={{color:"white"}}/></div>
          <span style={{color:"rgba(255,255,255,.75)",fontSize:14,fontWeight:700,letterSpacing:.5}}>MyABA</span>
          {liveActive&&<span style={{background:"rgba(239,68,68,.2)",color:"#EF4444",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:99,animation:"ml 2s infinite",letterSpacing:1}}>LIVE</span>}
          <span style={{color:"rgba(255,255,255,.2)",fontSize:10}}>{abaState!=="idle"?(abaState==="thinking"?"thinking...":abaState==="speaking"?"speaking...":"listening..."):""}</span>
        </div>
        <div style={{display:"flex",gap:4}}>
          {/* v2.15.0: Admin button for HAM users */}
          {isHAM(user?.email)&&<button onClick={()=>setAdminPanelOpen(true)} style={{background:lastABAResponse?"rgba(34,197,94,.15)":"rgba(255,255,255,.04)",border:`1px solid ${lastABAResponse?"rgba(34,197,94,.2)":"rgba(255,255,255,.06)"}`,color:lastABAResponse?"rgba(34,197,94,.85)":"rgba(255,255,255,.3)",borderRadius:99,width:44,height:44,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}} title="Admin Mode"><Activity size={15}/></button>}
          <button onClick={()=>setVoiceOut(!voiceOut)} style={{background:voiceOut?"rgba(139,92,246,.15)":"rgba(255,255,255,.04)",border:`1px solid ${voiceOut?"rgba(139,92,246,.2)":"rgba(255,255,255,.06)"}`,color:voiceOut?"rgba(139,92,246,.85)":"rgba(255,255,255,.3)",borderRadius:99,width:44,height:44,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{voiceOut?<Volume2 size={15}/>:<VolumeX size={15}/>}</button>
          <button onClick={()=>setSettingsOpen(true)} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.06)",color:"rgba(255,255,255,.3)",borderRadius:99,width:44,height:44,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Settings size={15}/></button>
        </div>
      </div>
      {/* F5/F6: Main Tab Switcher - Chat | Briefing | Approve */}
      {/* ⬡B:aba_skins:NAV:home_button_plus_tabs:20260323⬡ */}
      {mainTab!=="apps"?<div style={{display:"flex",alignItems:"center",gap:4,padding:"4px 0"}}>
        <button onClick={()=>{setMainTab("apps");setAppScope(null)}} style={{width:40,height:40,borderRadius:10,border:"none",cursor:"pointer",background:"rgba(139,92,246,.12)",color:"rgba(139,92,246,.7)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} title="All Apps"><GripVertical size={16}/></button>
        <div style={{flex:1,overflow:"hidden"}}><MainTabSwitcher tab={mainTab} setTab={async(t)=>{
          setMainTab(t);
          if(t==="briefing"&&!briefingData&&!briefingLoading){
            setBriefingLoading(true);
            const data=await fetchBriefing(user?.email||user?.uid||"unknown");
            setBriefingData(data);
            setBriefingLoading(false);
          }
        }}/></div>
      </div>:null}
      
      {/* ⬡B:aba_skins:RENDER:app_launcher_view:20260323⬡ */}
      {mainTab==="apps"&&<div style={{flex:1,overflowY:"auto",padding:"8px 4px"}}>
        <AppLauncher 
          userId={user?.email||user?.uid||"unknown"} 
          currentApp={null}
          onAppSelect={(app)=>{
            setAppScope(app.app_scope||null);
            if(app.id==="chat"){setMainTab("chat")}
            else if(app.id==="briefing"){setMainTab("briefing");if(!briefingData&&!briefingLoading){setBriefingLoading(true);fetchBriefing(user?.email||user?.uid||"unknown").then(d=>{setBriefingData(d);setBriefingLoading(false)})}}
            else if(app.id==="jobs"){setMainTab("jobs")}
            else if(app.id==="email"){setMainTab("email")}
            else if(app.id==="memos"){setMainTab("memos")}
            else if(app.id==="approve"){setMainTab("approve")}
            else if(app.id==="settings"){setSettingsOpen(true)}
            else if(app.id==="gmg_university"){window.open("https://gmg-university-v7.vercel.app","_blank")}
            else if(app.id==="phone"){setMainTab("chat");setVoiceMode("talk")}
            else if(app.id==="nura"){setMainTab("nura");setScannerOpen(true)}
            else if(app.id==="incidents"){setMainTab("chat");setInput("I want to report a bug: ")}
            else{setMainTab(app.id)}
          }}
        />
      </div>}
      
      {/* Chat Mode */}
      {mainTab==="chat"&&<>
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
          <div style={{flex:1,display:"flex",alignItems:"flex-end",background:"rgba(255,255,255,.05)",backdropFilter:"blur(12px)",border:"1px solid rgba(255,255,255,.08)",borderRadius:20,padding:"6px 6px 6px 16px",minHeight:44}}><textarea value={input} onChange={e=>{setInput(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,120)+"px"}} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage(input)}}} onFocus={scrollInputIntoView} placeholder="Message ABA..." rows={1} style={{flex:1,background:"none",border:"none",outline:"none",color:"rgba(255,255,255,.9)",fontSize:16,padding:"8px 0",WebkitAppearance:"none",resize:"none",overflow:"hidden",lineHeight:"1.4",maxHeight:120,minHeight:20,fontFamily:"inherit"}}/><button onClick={()=>{if(!isListening)startListening();else stopListening()}} style={{width:36,height:36,borderRadius:99,border:"none",cursor:"pointer",background:isListening?"rgba(6,182,212,.2)":"rgba(255,255,255,.05)",color:isListening?"rgba(6,182,212,.95)":"rgba(255,255,255,.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:4}}>{isListening?<MicOff size={14}/>:<Mic size={14}/>}</button></div>
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
      </>}
      
      {/* Briefing Mode */}
      {mainTab==="briefing"&&<BriefingView data={briefingData} loading={briefingLoading} userId={user?.email||user?.uid||"unknown"} onRefresh={async()=>{
        setBriefingLoading(true);
        const data=await fetchBriefing(user?.email||user?.uid||"unknown");
        setBriefingData(data);
        setBriefingLoading(false);
      }}/>}
      
      {/* Jobs Mode - AWA Integration */}
      {mainTab==="jobs"&&<JobsView userId={user?.email||user?.uid||"unknown"}/>}
      
      {/* Pipeline Mode - Kanban ⬡B:AWA.v3:Phase6:pipeline_tab:20260315⬡ */}
      {mainTab==="pipeline"&&<PipelineView userId={user?.email||user?.uid||"unknown"}/>}
      
      {/* Memos Mode - ⬡B:MYABA:memos_tab:20260319⬡ */}
      {mainTab==="memos"&&<MemosView userId={user?.email||user?.uid||"unknown"}/>}
      
      {/* Email Mode - ⬡B:MYABA:email_tab:20260321⬡ */}
      {mainTab==="email"&&<EmailView userId={user?.email||user?.uid||"unknown"}/>}
      
      {/* Approve Mode */}
      {mainTab==="approve"&&<ApproveView userId={user?.email||user?.uid||"unknown"}/>}
      
      {/* ⬡B:aba_skins:RENDER:app_scoped_chat:20260323⬡ */}
      {/* Catch-all: apps from launcher that aren't native tabs get scoped chat */}
      {!["apps","chat","briefing","jobs","pipeline","memos","email","approve"].includes(mainTab)&&<>
        <div style={{padding:"8px 12px",background:"rgba(139,92,246,.08)",borderRadius:12,marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:8,height:8,borderRadius:4,background:"rgba(139,92,246,.6)"}}/>
          <span style={{color:"rgba(139,92,246,.8)",fontSize:13,fontWeight:500}}>{mainTab.replace(/_/g," ").toUpperCase()}</span>
          <span style={{color:"rgba(255,255,255,.3)",fontSize:11,marginLeft:"auto"}}>{appScope||"full"} scope</span>
        </div>
        <div style={{flexShrink:0,display:"flex",justifyContent:"center",padding:"2px 0"}}><Blob state={abaState} size={messages.length<=1?80:40}/></div>
        <div ref={scrollRef} style={{flex:1,overflowY:"auto",padding:"4px 2px",display:"flex",flexDirection:"column",gap:2,maskImage:"linear-gradient(transparent 0%,black 2%,black 96%,transparent 100%)",WebkitMaskImage:"linear-gradient(transparent 0%,black 2%,black 96%,transparent 100%)"}}>
          {messages.map(msg=><div key={msg.id} style={{animation:"mf .3s ease"}}><Bubble msg={msg} userPhoto={user?.photoURL} onSpeak={speakText}/></div>)}
          {isTyping&&<Typing/>}
        </div>
        <div style={{flexShrink:0,padding:"6px 0 14px",display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
            <div style={{flex:1,display:"flex",alignItems:"flex-end",background:"rgba(255,255,255,.05)",backdropFilter:"blur(12px)",border:"1px solid rgba(255,255,255,.08)",borderRadius:20,padding:"4px 4px 4px 14px",minHeight:48}}>
              <textarea value={input} onChange={e=>{setInput(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,120)+"px"}} onKeyDown={handleKey} placeholder={"Ask about "+mainTab.replace(/_/g," ")+"..."} rows={1} style={{flex:1,background:"transparent",border:"none",color:"white",fontSize:15,outline:"none",resize:"none",lineHeight:"22px",maxHeight:120,fontFamily:"system-ui"}}/>
            </div>
            <button onClick={()=>sendMessage(input)} disabled={!input.trim()} style={{width:48,height:48,borderRadius:99,border:"none",cursor:input.trim()?"pointer":"default",background:input.trim()?"rgba(139,92,246,.4)":"rgba(255,255,255,.04)",color:input.trim()?"white":"rgba(255,255,255,.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Send size={18}/></button>
          </div>
        </div>
      </>}
    </div>
    <Sidebar open={sidebarOpen} convos={convos} activeId={activeId} onSelect={setActiveId} onCreate={()=>setNewChatModal(true)} onClose={()=>setSidebarOpen(false)} onDelete={deleteConv} onArchive={archiveConv} onShare={c=>setShareModal(c)} projects={projects} activeProject={activeProject} onSelectProject={setActiveProject} onCreateProject={()=>setNewChatModal(true)} onProjectDetail={p=>setProjectDetailModal(p)} user={user}/>
    <ShareModal open={!!shareModal} conversation={shareModal} onClose={()=>setShareModal(null)} onShare={shareConversation}/>
    <NewChatModal open={newChatModal} onClose={()=>setNewChatModal(false)} onCreate={(shared,projectId,projectName)=>{if(projectName){const pId=createProject(projectName);createConv(shared,pId)}else{createConv(shared,projectId)}}} projects={projects} onCreateProject={createProject}/>
    <ProjectDetailModal open={!!projectDetailModal} project={projectDetailModal} onClose={()=>setProjectDetailModal(null)} onRename={renameProject} onDelete={deleteProject} onAddFile={addFileToProject} onRemoveFile={removeFileFromProject}/>
    <Queue open={queueOpen} onToggle={()=>setQueueOpen(!queueOpen)} items={proactiveItems}/>
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
