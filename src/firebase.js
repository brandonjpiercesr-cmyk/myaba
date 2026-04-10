// ⬡B:myaba.firebase:CONFIG:auth:v1.3.0:20260409⬡
// MyABA v1.3.0 — Firebase for AUTH ONLY
// ════════════════════════════════════════════════════════════════════════════
// ARCHITECTURE:
//   - Firebase = AUTH (Google sign-in only)
//   - Conversations = AIR → Supabase (see MyABA.jsx)
//   - DO NOT add Firestore conversation functions here
// FIX v1.3.0: PWA sign-in loop — use signInWithPopup in standalone mode
//   signInWithRedirect navigates away, but PWA standalone windows can't
//   receive the redirect back, causing an infinite login loop.
// ════════════════════════════════════════════════════════════════════════════

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithRedirect, signInWithPopup, getRedirectResult, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAD5sW9y0RriF8HsyS7twfd0bjgA2dGsQw",
  authDomain: "aba-central-brain.firebaseapp.com",
  databaseURL: "https://aba-central-brain-default-rtdb.firebaseio.com",
  projectId: "aba-central-brain",
  storageBucket: "aba-central-brain.firebasestorage.app",
  messagingSenderId: "280046049526",
  appId: "1:280046049526:web:4021ec007ca79c0e0cf4d7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

// Detect if running as installed PWA (standalone mode)
function isPWA() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

export async function signInGoogle() {
  if (isPWA()) {
    // Popup stays within PWA context — no redirect loop
    return signInWithPopup(auth, googleProvider);
  }
  // Browser tab mode — redirect works fine
  return signInWithRedirect(auth, googleProvider);
}

export async function signOutUser() {
  return signOut(auth);
}

// ════════════════════════════════════════════════════════════════════════════
// NOTE: All conversation persistence routes through AIR → Supabase
// Functions: airSaveConversation, airLoadConversations, airDeleteConversation
// Location: MyABA.jsx
// ════════════════════════════════════════════════════════════════════════════
