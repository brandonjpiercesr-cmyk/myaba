// ⬡B:myaba.firebase:CONFIG:auth:20260225⬡
// MyABA v1.1.2 — Firebase Configuration
// Uses ABA Central Brain for auth and conversation persistence
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, addDoc, getDocs, query, where, orderBy, limit, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';

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
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export async function signInGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutUser() {
  return signOut(auth);
}

// Conversation persistence via Firestore
export async function saveConversation(userId, conv) {
  const ref = doc(db, 'aba_conversations', conv.id);
  await setDoc(ref, { ...conv, userId, updatedAt: serverTimestamp() }, { merge: true });
}

export async function loadConversations(userId) {
  const q = query(collection(db, 'aba_conversations'), where('userId', '==', userId), orderBy('updatedAt', 'desc'), limit(30));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export { onSnapshot, query, collection, where, orderBy, limit, serverTimestamp, doc, setDoc, updateDoc };
