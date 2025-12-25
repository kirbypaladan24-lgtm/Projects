// firebase-client.js
// Minimal Firebase Web SDK helper (Firestore + Anonymous Auth + optional Analytics).
// Include this as a module script BEFORE project.js so project.js can call window.firebaseClient.*

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-analytics.js";

/*
  Firebase configuration provided by user (from your script tag).
  If you later rotate keys, update these values from Firebase console -> Project settings -> General.
*/
const firebaseConfig = {
  apiKey: "AIzaSyAQJnWHVaaTXOTansodSqwrjhcavrmM-5Y",
  authDomain: "port-a4e9c.firebaseapp.com",
  projectId: "port-a4e9c",
  storageBucket: "port-a4e9c.firebasestorage.app",
  messagingSenderId: "828929421886",
  appId: "1:828929421886:web:a4222a0003143aa5e0176f",
  measurementId: "G-DZ3D7JW16V"
};

let app = null;
let db = null;
let auth = null;
let analytics = null;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);

  // Analytics is optional and may be blocked in some environments (e.g. local file:// or privacy settings).
  try {
    analytics = getAnalytics(app);
    console.info('firebase-client: analytics initialized');
  } catch (e) {
    // Non-fatal: analytics not available
    console.info('firebase-client: analytics unavailable or blocked', e && e.message ? e.message : e);
  }

  // Try to sign in anonymously to satisfy Firestore rules that may require auth.
  // Failures are non-fatal (e.g. rules may block anonymous sign-in).
  signInAnonymously(auth).catch((err) => {
    console.warn('firebase-client: anonymous sign-in failed', err && err.code ? err.code : err);
  });

  console.info('firebase-client: initialized');
} catch (err) {
  console.warn('firebase-client: initialization error', err);
}

/**
 * Load comments for a project slug from Firestore.
 * Returns an array of comment objects sorted desc by time, or null on error / not available.
 */
export async function loadCommentsFromFirestore(slug) {
  if (!db) return null;
  try {
    const q = query(collection(db, 'projects', slug, 'comments'), orderBy('time', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  } catch (e) {
    console.warn('firebase-client: loadCommentsFromFirestore failed', e);
    return null;
  }
}

/**
 * Post a single comment to Firestore.
 * commentObj should include at least { name, rating, text, time }.
 * Returns true if write succeeded, false otherwise.
 */
export async function postCommentToFirestore(slug, commentObj) {
  if (!db) {
    console.warn('firebase-client: Firestore not initialized');
    return false;
  }
  try {
    const c = {
      name: String(commentObj.name || '').slice(0, 60),
      rating: Number(commentObj.rating || 0),
      text: String(commentObj.text || '').slice(0, 1000),
      time: typeof commentObj.time === 'number' ? commentObj.time : Date.now()
    };
    await addDoc(collection(db, 'projects', slug, 'comments'), c);
    return true;
  } catch (e) {
    console.warn('firebase-client: postCommentToFirestore failed', e);
    return false;
  }
}

/**
 * Bulk push an array of comments to Firestore.
 * This is a convenience helper for small sets (it simply posts one-by-one).
 * Returns an object { attempted, succeeded }.
 */
export async function bulkPushCommentsToFirestore(slug, commentsArray) {
  if (!Array.isArray(commentsArray) || commentsArray.length === 0) return { attempted: 0, succeeded: 0 };
  let succeeded = 0;
  for (const raw of commentsArray) {
    try {
      const ok = await postCommentToFirestore(slug, raw);
      if (ok) succeeded++;
    } catch (e) {
      // continue on error
    }
  }
  return { attempted: commentsArray.length, succeeded };
}

// Expose a small global API so your existing project.js can call window.firebaseClient.* without changing imports.
window.firebaseClient = {
  loadCommentsFromFirestore,
  postCommentToFirestore,
  bulkPushCommentsToFirestore,
  auth,
  analytics,
  app,
  db
};