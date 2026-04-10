// ⬡B:myaba.firebase:CONFIG:auth:v1.4.0:20260410⬡
// MyABA v1.4.0 — Firebase for AUTH ONLY
// ════════════════════════════════════════════════════════════════════════════
// FIX v1.4.0: Use signInWithPopup ALWAYS. signInWithRedirect fails on iOS
//   Safari due to ITP (Intelligent Tracking Prevention) blocking cross-origin
//   cookies. Popup auth stays same-origin and works everywhere.
// ════════════════════════════════════════════════════════════════════════════

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
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

export async function signInGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutUser() {
  return signOut(auth);
}

// ════════════════════════════════════════════════════════════════════════════
// NOTE: All conversation persistence routes through AIR → Supabase
// ════════════════════════════════════════════════════════════════════════════
