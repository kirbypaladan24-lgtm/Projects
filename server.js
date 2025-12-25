// server.js
// Express server providing simple API endpoints to store & fetch project comments in Firestore.
// - Supports initialization via serviceAccountKey.json (preferred) or via env vars.
// - If Firebase is not configured, falls back to an in-memory store (good for local dev).

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev'));

// CORS configuration
const corsOriginsRaw = (process.env.CORS_ORIGINS || '*');
const allowedOrigins = corsOriginsRaw === '*' ? ['*'] : corsOriginsRaw.split(',').map(s => s.trim());
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf('*') !== -1) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  }
}));

// Initialize Firebase Admin (Firestore)
let admin, db;
let firebaseConfigured = false;

function tryInitFirebase() {
  try {
    // 1) serviceAccountKey.json present?
    const svcPath = path.join(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(svcPath)) {
      admin = require('firebase-admin');
      const svc = require(svcPath);
      admin.initializeApp({ credential: admin.credential.cert(svc) });
      db = admin.firestore();
      firebaseConfigured = true;
      console.log('Firebase Admin initialized using serviceAccountKey.json');
      return;
    }

    // 2) env-based credentials
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
    if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
      admin = require('firebase-admin');
      // private key in env may contain literal "\n" sequences, replace them
      const privateKey = FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      const cert = {
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey
      };
      admin.initializeApp({ credential: admin.credential.cert(cert) });
      db = admin.firestore();
      firebaseConfigured = true;
      console.log('Firebase Admin initialized using environment variables');
      return;
    }

    console.warn('Firebase credentials not found — starting in in-memory fallback mode.');
  } catch (err) {
    console.error('Firebase initialization failed:', err);
    firebaseConfigured = false;
  }
}
tryInitFirebase();

// In-memory fallback store (when Firebase not configured). Structure: { [slug]: [commentObj, ...] }
const inMemoryStore = {};

// Utility: normalize comment object
function normalizeComment(c) {
  return {
    name: String(c.name || '').slice(0, 60),
    rating: parseInt(c.rating || 0, 10) || 0,
    text: String(c.text || '').slice(0, 1000),
    time: typeof c.time === 'number' ? c.time : Date.now()
  };
}

// GET comments for project
app.get('/api/projects/:slug/comments', async (req, res) => {
  const slug = String(req.params.slug || '').trim();
  if (!slug) return res.status(400).json({ error: 'Missing slug' });

  try {
    if (firebaseConfigured && db) {
      const snap = await db.collection('projects').doc(slug).collection('comments').orderBy('time', 'desc').get();
      const arr = [];
      snap.forEach(doc => {
        const data = doc.data();
        arr.push({
          name: data.name || 'Anonymous',
          rating: data.rating || 0,
          text: data.text || '',
          time: data.time ? (typeof data.time === 'number' ? data.time : (data.time.toMillis ? data.time.toMillis() : Date.now())) : Date.now()
        });
      });
      return res.json(arr);
    } else {
      const arr = inMemoryStore[slug] ? Array.from(inMemoryStore[slug]).sort((a,b)=>b.time - a.time) : [];
      return res.json(arr);
    }
  } catch (err) {
    console.error('GET comments failed', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST a single comment
app.post('/api/projects/:slug/comments', async (req, res) => {
  const slug = String(req.params.slug || '').trim();
  if (!slug) return res.status(400).json({ error: 'Missing slug' });

  try {
    const raw = req.body || {};
    const comment = normalizeComment(raw);

    if (firebaseConfigured && db) {
      // Add to subcollection with auto id
      await db.collection('projects').doc(slug).collection('comments').add(comment);
      return res.status(201).json({ ok: true, comment });
    } else {
      inMemoryStore[slug] = inMemoryStore[slug] || [];
      inMemoryStore[slug].unshift(comment);
      return res.status(201).json({ ok: true, comment });
    }
  } catch (err) {
    console.error('POST comment failed', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Bulk migrate comments (accepts array of comments)
app.post('/api/projects/:slug/migrate', async (req, res) => {
  const slug = String(req.params.slug || '').trim();
  if (!slug) return res.status(400).json({ error: 'Missing slug' });

  try {
    const list = Array.isArray(req.body.comments) ? req.body.comments.map(normalizeComment) : [];
    if (list.length === 0) return res.status(400).json({ error: 'No comments provided' });

    if (firebaseConfigured && db) {
      const batch = db.batch();
      const coll = db.collection('projects').doc(slug).collection('comments');
      list.forEach(c => {
        const docRef = coll.doc(); // auto-id
        batch.set(docRef, c);
      });
      await batch.commit();
      return res.status(201).json({ ok: true, count: list.length });
    } else {
      inMemoryStore[slug] = inMemoryStore[slug] || [];
      // prepend (keep newest first)
      list.forEach(c => inMemoryStore[slug].unshift(c));
      return res.status(201).json({ ok: true, count: list.length });
    }
  } catch (err) {
    console.error('MIGRATE failed', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, firebase: firebaseConfigured });
});

// Serve static (optional) — only if you want backend to serve front-end files as well.
// app.use(express.static(path.join(__dirname, 'public')));

const port = parseInt(process.env.PORT || '8080', 10);
app.listen(port, () => {
  console.log(`Comments API listening on port ${port} (firebaseConfigured=${firebaseConfigured})`);
});