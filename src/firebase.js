// ⬡B:myaba.firebase:CONFIG:auth:v1.5.0:20260410⬡
// MyABA v1.5.0 — Firebase for AUTH ONLY
// ════════════════════════════════════════════════════════════════════════════
// FIX v1.5.0: Popup-first with redirect fallback.
//   - Mobile often blocks popups → catch auth/popup-blocked → fall back to redirect
//   - Redirect on iOS can loop due to ITP → getRedirectResult on load catches it
//   - signInWithRedirect returns undefined (navigates away), so onAuthStateChanged
//     picks up the user on page reload
// ════════════════════════════════════════════════════════════════════════════

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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

// On page load, check if we're returning from a redirect sign-in
getRedirectResult(auth).then((result) => {
  if (result?.user) {
    console.log("[AUTH] Redirect sign-in complete:", result.user.email);
  }
}).catch((err) => {
  console.warn("[AUTH] Redirect result error:", err.code);
});

export async function signInGoogle() {
  try {
    // Try popup first (works on desktop, some mobile browsers)
    const result = await signInWithPopup(auth, googleProvider);
    return result;
  } catch (err) {
    if (err.code === "auth/popup-blocked" || err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
      // Popup blocked or closed — fall back to redirect
      console.log("[AUTH] Popup blocked, falling back to redirect");
      await signInWithRedirect(auth, googleProvider);
      // signInWithRedirect navigates away, returns undefined
      // getRedirectResult above catches the user on page reload
      return null;
    }
    throw err;
  }
}

export async function signOutUser() {
  return signOut(auth);
}
