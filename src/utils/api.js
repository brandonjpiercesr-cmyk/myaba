// ⬡B:MACE.phase0:UTILS:api_shared:20260405⬡
// Extracted from MyABA.jsx — zero logic changes, just exports added
// Every backend communication function lives here. Views import what they need.

// ⬡B:VIGIL.gatekeeper:FRONTEND:auth_headers:20260408⬡
// Gatekeeper integration — injects Firebase ID token into all backend calls
import { auth } from '../firebase.js';

const ABA_PLATFORM = 'myaba';

async function getAuthHeaders() {
  const headers = { 'X-ABA-Platform': ABA_PLATFORM };
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (e) {
    console.warn('[AUTH] Failed to get ID token:', e.message);
  }
  return headers;
}

async function abaFetch(url, options = {}) {
  const authHeaders = await getAuthHeaders();
  const mergedHeaders = { ...authHeaders, ...(options.headers || {}) };
  return fetch(url, { ...options, headers: mergedHeaders });
}

export const ABABASE = "https://abacia-services.onrender.com";

// v1.2.0: Check online status
export function isOnline() { return navigator.onLine; }

// v2.15.0: AIR with retry + offline awareness + proper userId handling
export async function airRequest(type, payload = {}, userId = "unknown", maxRetries = 3) {
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
      const res = await abaFetch(`${ABABASE}/api/air/process`, {
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
export async function airRequestStream({ message, userId, channel, conversationId, conversationHistory, images, appScope, onChunk, onToolStart, onDone, onError }) {
  if (!isOnline()) {
    onError?.("You are offline");
    return { response: null, offline: true };
  }
  
  try {
    const res = await abaFetch(ABABASE + "/api/air/stream", {
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
            onChunk?.(accumulated, data.text, "chunk");
          } else if (data.type === "filler") {
            onChunk?.(null, data.text, "filler");
          } else if (data.type === "filler_end") {
            onChunk?.(null, null, "filler_end");
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

// ═══════════════════════════════════════════════════════════════════════════
// Conversation & Project API Functions
// ═══════════════════════════════════════════════════════════════════════════

export async function airShareChat(userId, convId, emails) {
  try {
    const res = await abaFetch(`${ABABASE}/api/conversations/${convId}/share`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, sharedWith: emails })
    });
    return await res.json();
  } catch (e) { return { success: false, error: e.message }; }
}

// SPURT 4: Project functions - now using direct /api/projects endpoint
export async function airLoadProjects(userId) {
  try {
    const res = await abaFetch(`${ABABASE}/api/projects?userId=${encodeURIComponent(userId)}`);
    if (res.ok) {
      const data = await res.json();
      return { success: true, projects: data.projects || [] };
    }
    return { success: false, projects: [] };
  } catch { return { success: false, projects: [] }; }
}

export async function airCreateProject(userId, name, shared = false, sharedWith = []) {
  try {
    const res = await abaFetch(`${ABABASE}/api/projects`, {
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
export async function airLoadConversations(userId, projectId = null) {
  try {
    let url = `${ABABASE}/api/conversations?userId=${encodeURIComponent(userId)}`;
    if (projectId) url += `&projectId=${encodeURIComponent(projectId)}`;
    const res = await abaFetch(url);
    if (res.ok) {
      const data = await res.json();
      return { success: true, conversations: data.conversations || [] };
    }
    return { success: false, conversations: [] };
  } catch { return { success: false, conversations: [] }; }
}

export async function airCreateConversation(userId, title = 'New Chat', projectId = null, shared = false) {
  try {
    const res = await abaFetch(`${ABABASE}/api/conversations`, {
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

export async function airAddMessage(conversationId, role, content) {
  try {
    const res = await abaFetch(`${ABABASE}/api/conversations/${conversationId}/messages`, {
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

export async function airUpdateConversation(conversationId, updates) {
  try {
    const res = await abaFetch(`${ABABASE}/api/conversations/${conversationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates)
    });
    return res.ok;
  } catch { return false; }
}

export async function airDeleteConversation(conversationId) {
  try {
    const res = await abaFetch(`${ABABASE}/api/conversations/${conversationId}`, {
      method: "DELETE"
    });
    return res.ok;
  } catch { return false; }
}

// SPURT 4C: Settings functions - using /api/settings endpoint
export async function airLoadSettings(userId) {
  try {
    const res = await abaFetch(`${ABABASE}/api/settings?userId=${encodeURIComponent(userId)}`);
    if (res.ok) {
      const data = await res.json();
      return { success: true, settings: data.settings || {} };
    }
    return { success: false, settings: {} };
  } catch { return { success: false, settings: {} }; }
}

export async function airSaveSettings(userId, settings) {
  try {
    const res = await abaFetch(`${ABABASE}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, settings })
    });
    return res.ok;
  } catch { return false; }
}

export async function airAddProjectFile(userId, projectId, file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("projectId", projectId);
  formData.append("userId", userId);
  try {
    const res = await abaFetch(`${ABABASE}/api/project/upload`, { method: "POST", body: formData });
    return res.ok ? await res.json() : { error: true };
  } catch { return { error: true }; }
}

// ═══════════════════════════════════════════════════════════════════════════
// Voice & File Upload Functions
// ═══════════════════════════════════════════════════════════════════════════

// ⬡B:MYABA:REAL_FILE_UPLOAD:v2.20:20260319⬡
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadAttachment(file, userId, conversationId) {
  try {
    console.log(`[UPLOAD] Reading ${file.name} (${file.type}, ${file.size} bytes)`);
    const base64 = await fileToBase64(file);
    console.log(`[UPLOAD] Uploading ${file.name} to backend...`);
    const res = await abaFetch(`${ABABASE}/api/attachments/upload`, {
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

export async function uploadAttachmentsBatch(files, userId, conversationId) {
  try {
    const fileData = [];
    for (const file of files) {
      const base64 = await fileToBase64(file);
      fileData.push({ filename: file.name, contentType: file.type || 'application/octet-stream', base64 });
    }
    console.log(`[UPLOAD] Batch uploading ${fileData.length} files...`);
    const res = await abaFetch(`${ABABASE}/api/attachments/upload-batch`, {
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

export async function reachTranscribe(audioBlob) {
  try {
    if (!audioBlob || !(audioBlob instanceof Blob)) {
      console.warn("[VOICE] reachTranscribe called with non-Blob:", typeof audioBlob);
      return null;
    }
    if (audioBlob.size < 1000) { 
      console.log("[VOICE] Audio chunk too small:", audioBlob.size, "bytes — skipping"); 
      return null; 
    }
    console.log("[VOICE] Transcribing", audioBlob.size, "bytes,", audioBlob.type);
    const contentType = audioBlob.type || "audio/webm";
    const res = await abaFetch(`${ABABASE}/api/voice/transcribe`, { 
      method: "POST", 
      headers: { "Content-Type": contentType },
      body: audioBlob 
    });
    if (!res.ok) { console.error("[VOICE] Transcribe HTTP", res.status); return null; }
    const data = await res.json();
    const text = data.transcript || data.text || null;
    const speaker = data.speaker !== undefined ? data.speaker : null;
    if (text) console.log("[VOICE] Got:", text.substring(0, 80), "| Speaker:", speaker);
    else console.log("[VOICE] Empty transcript from Deepgram");
    return text ? { text, speaker } : null;
  } catch (e) { console.error("[VOICE] Transcribe error:", e); return null; }
}

export async function reachSynthesize(text) {
  try {
    // ⬡B:MYABA.V2:voice:20260313⬡ Using VARA (Vocal Authorized Representative of ABA) voice
    const res = await abaFetch(`${ABABASE}/api/voice/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voiceId: "AIFDUhRnM6s61433WMNu", model: "eleven_turbo_v2_5" }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url || null;
  } catch { return null; }
}

export async function reachPresence(userId) {
  try {
    const res = await abaFetch(`${ABABASE}/api/presence?userId=${userId}`);
    return res.ok ? await res.json() : { items: [] };
  } catch { return { items: [] }; }
}

export async function airNameChat(messages, userId) {
  try {
    const firstUserMsg = messages.find(m => m.role === "user");
    if (!firstUserMsg) return null;
    
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
export async function getDawnGreeting(userId, userName) {
  const result = await airRequest("dawn_greeting", { 
    userName, includeCalendar: true, includeJobs: true, includeSports: true, context: "login"
  }, userId);
  
  if (result.response) {
    if (typeof result.response === "object") {
      return result.response;
    }
    try {
      const parsed = JSON.parse(result.response);
      return parsed;
    } catch {
      return { greeting: result.response, context: "", proactive: null };
    }
  }
  
  const hour = new Date().getHours();
  const timeGreeting = hour < 5 ? "Late night" : hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : hour < 21 ? "Evening" : "Late night";
  const firstName = userName?.split(' ')[0] || "there";
  return {
    greeting: `${timeGreeting}, ${firstName}.`,
    context: "Checking your calendar, emails, and pending items...",
    proactive: null
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Push Notifications
// ═══════════════════════════════════════════════════════════════════════════

const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function subscribeToPush(userId) {
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
    
    await abaFetch(`${ABABASE}/api/push/subscribe`, {
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

export async function unsubscribeFromPush(userId) {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      await abaFetch(`${ABABASE}/api/push/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
    }
  } catch (e) {
    console.error('[PUSH] Unsubscribe failed:', e);
  }
}

export function safeParseGreeting(response) {
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
