/* project.js
   Full interaction logic for project.html
   - fills project metadata from URL params & internal mappings
   - supports per-project repo and raw links
   - screenshot carousel + lightbox
   - comments with admin "stealth delete" mode
   - improved Back link behavior with fallback to index.html#scroll=...
   - Now: prefers Firestore via window.firebaseClient for fetching/posting/migrating comments.
           Falls back to existing /api endpoints when firebaseClient is unavailable.
*/

(function () {
  'use strict';

  /* =============================
     Helpers
     ============================= */
  function qs(name, url) {
    if (!url) url = location.search;
    name = name.replace(/[\[\]]/g, '\\$&');
    const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
    const results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
  }

  function slugify(str) {
    if (!str) return 'project';
    return String(str).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function nowSec(){ return Math.floor(Date.now()/1000); }

  const COMMENT_MAX_LENGTH = 1000;
  function sanitizeText(s){
    if(!s) return '';
    return String(s).replace(/[\u0000-\u001F\u007F]/g,'').trim().slice(0, COMMENT_MAX_LENGTH);
  }

  function normalizeCommentForClient(c) {
    // Ensure fields exist and time is a number (ms)
    if (!c) return { name: 'Anonymous', rating: 0, text: '', time: Date.now() };
    const name = String(c.name || 'Anonymous').slice(0,60);
    const rating = parseInt(c.rating || 0, 10) || 0;
    const text = String(c.text || '').slice(0, 1000);
    let time = Date.now();
    if (typeof c.time === 'number') time = c.time;
    else if (c.time && typeof c.time.toMillis === 'function') {
      try { time = c.time.toMillis(); } catch(e) { time = Date.now(); }
    } else if (c.time) {
      const n = Number(c.time);
      time = isNaN(n) ? Date.now() : n;
    }
    return { name, rating, text, time };
  }

  /* =============================
     Configuration / Mappings
     ============================= */
  const PROJECT_IMAGES = {
    "3d-poly-forest": "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/9fc8adabb06752ad6fe18df0cf27ef4142a6838b/1766479341892.jpg",
    "level10gc-replica": "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/234f2564892d15b30bd1df202dc220e8de4611f3/LEVEL10GC%20WEB.jpg",
    "aureum-bank": "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/234f2564892d15b30bd1df202dc220e8de4611f3/ATM%20SYSTEM.jpg",
    "wordify": "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/234f2564892d15b30bd1df202dc220e8de4611f3/WORD%20COUNTER.jpg",
    "payflow": "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/234f2564892d15b30bd1df202dc220e8de4611f3/CASHIER%20SIMULATION.jpg",
    "moneymap": "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/dd374a4167165bc898437ec1d1a856f00f2a1013/1766481186427.jpg",
    "fuelog": "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/234f2564892d15b30bd1df202dc220e8de4611f3/C%2B%2B%20GAS%20CONSUMPTION%20TRACKING.jpg",
    "wordify-c": "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/666e1090e986d879ca2f37a1972c9e9325361e9b/1766482046522.jpg",
    "payflow-c": "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/234f2564892d15b30bd1df202dc220e8de4611f3/C%2B%2BCASHIER%20SIMULATION.jpg",
    "moneymap-c": "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/234f2564892d15b30bd1df202dc220e8de4611f3/FINANCE%20TRACKER.jpg",
    "fuelog-c": "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/234f2564892d15b30bd1df202dc220e8de4611f3/C%2B%2B%20GAS%20CONSUMPTION%20TRACKING.jpg",
    "classmate-c": "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/234f2564892d15b30bd1df202dc220e8de4611f3/C%2B%2B%20STUDENT%20DATA%20MANAGEMENT.jpg",
    "gradeflow-c": "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/234f2564892d15b30bd1df202dc220e8de4611f3/C%2B%2B%20GRADE%20CONVERSION.jpg",
    "aureum-bank-c": "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/234f2564892d15b30bd1df202dc220e8de4611f3/ATM%20SYSTEM.jpg",
    "pythos-ai": "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/234f2564892d15b30bd1df202dc220e8de4611f3/AI%20ASSISTANT.jpg",
    "fuckyou": "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/913a0278264f18fc2ed70170abe2170b91e6fde7/.trashed-1769079552-G3pBT_PXkAAyVDC.jpg",
  };

  const PROJECT_REPOS = {
    "3d-poly-forest": "https://github.com/kirbypaladan24-lgtm/Projects",
    "level10gc-replica": "https://github.com/YOUR-USERNAME/level10gc-replica",
    "aureum-bank": "https://github.com/YOUR-USERNAME/aureum-bank",
    "wordify": "https://github.com/YOUR-USERNAME/wordify",
    "payflow": "https://github.com/YOUR-USERNAME/wordify",
    "moneymap": "https://github.com/kirbypaladan24-lgtm/Projects/blob/e497f8ddf77ef1855da16b68c8b7f53e5860f891/ADVANCE%20FINANCIAL%20TRACKING.cpp",   
    "fuelog": "https://github.com/kirbypaladan24-lgtm/Projects",
    "wordify-c": "https://github.com/YOUR-USERNAME/level10gc-replica",
    "payflow-c": "https://github.com/YOUR-USERNAME/aureum-bank",
    "moneymap-c": "https://github.com/YOUR-USERNAME/wordify",
    "fuelog-c": "https://github.com/YOUR-USERNAME/wordify",
    "classmate-c": "https://github.com/YOUR-USERNAME/wordify",
    "gradeflow-c": "https://github.com/YOUR-USERNAME/wordify",
    "aureum-bank-c": "https://github.com/YOUR-USERNAME/wordify",
    "pythos-ai": "https://github.com/YOUR-USERNAME/wordify",
    "fuckyou": "https://github.com/YOUR-USERNAME/wordify",
  };

  // New: per-project raw links (zip, raw files, direct demo links, etc.)
  const PROJECT_RAW_LINKS = {
    "3d-poly-forest": "https://github.com/kirbypaladan24-lgtm/Projects",
    "level10gc-replica": "https://github.com/YOUR-USERNAME/level10gc-replica",
    "aureum-bank": "https://github.com/YOUR-USERNAME/aureum-bank",
    "wordify": "https://github.com/YOUR-USERNAME/wordify",
    "payflow": "https://github.com/YOUR-USERNAME/wordify",
    "moneymap": "https://github.com/kirbypaladan24-lgtm/Projects/blob/e497f8ddf77ef1855da16b68c8b7f53e5860f891/ADVANCE%20FINANCIAL%20TRACKING.cpp",   
    "fuelog": "https://github.com/kirbypaladan24-lgtm/Projects",
    "wordify-c": "https://github.com/YOUR-USERNAME/level10gc-replica",
    "payflow-c": "https://github.com/YOUR-USERNAME/aureum-bank",
    "moneymap-c": "https://github.com/YOUR-USERNAME/wordify",
    "fuelog-c": "https://github.com/YOUR-USERNAME/wordify",
    "classmate-c": "https://github.com/YOUR-USERNAME/wordify",
    "gradeflow-c": "https://github.com/YOUR-USERNAME/wordify",
    "aureum-bank-c": "https://github.com/YOUR-USERNAME/wordify",
    "pythos-ai": "https://github.com/YOUR-USERNAME/wordify",
    "fuckyou": "https://github.com/YOUR-USERNAME/wordify",
  };

  const PROJECT_SCREENSHOTS = {
    "3d-poly-forest": [
      "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/913a0278264f18fc2ed70170abe2170b91e6fde7/.trashed-1769079552-G3pBT_PXkAAyVDC.jpg",
      "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/913a0278264f18fc2ed70170abe2170b91e6fde7/.trashed-1769079552-G3pBT_PXkAAyVDC.jpg",
      "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/913a0278264f18fc2ed70170abe2170b91e6fde7/.trashed-1769079552-G3pBT_PXkAAyVDC.jpg",
      "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/913a0278264f18fc2ed70170abe2170b91e6fde7/.trashed-1769079552-G3pBT_PXkAAyVDC.jpg",
      "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/913a0278264f18fc2ed70170abe2170b91e6fde7/.trashed-1769079552-G3pBT_PXkAAyVDC.jpg"
    ],
    "fuckyou": [
      "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/913a0278264f18fc2ed70170abe2170b91e6fde7/.trashed-1769079552-G3pBT_PXkAAyVDC.jpg",
      "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/913a0278264f18fc2ed70170abe2170b91e6fde7/.trashed-1769079552-G3pBT_PXkAAyVDC.jpg",
      "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/913a0278264f18fc2ed70170abe2170b91e6fde7/.trashed-1769079552-G3pBT_PXkAAyVDC.jpg",
      "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/913a0278264f18fc2ed70170abe2170b91e6fde7/.trashed-1769079552-G3pBT_PXkAAyVDC.jpg",
      "https://raw.githubusercontent.com/kirbypaladan24-lgtm/Images-/913a0278264f18fc2ed70170abe2170b91e6fde7/.trashed-1769079552-G3pBT_PXkAAyVDC.jpg"
    ],
  };

  const PROJECT_TAGS = {
    "3d-poly-forest": ["Game Dev", "Three.js", "Physics"],
    "level10gc-replica": ["Web Design", "Corporate", "Replica"],
    "aureum-bank": ["Finance", "Banking", "System"],
    "wordify": ["Tools", "Utility", "Text Analysis"],
    "payflow": ["Simulation", "Business", "Management"],
    "pythos-ai": ["Artificial Intelligence", "Assistant", "Bot"],
    "fuckyou": ["Experimental", "Art", "Edgy"],
  };

  const PROJECT_COMMENTS = {
    // optionally configure initial comments per project
  };

  /* =============================
     Read URL params & resolve slug
     ============================= */
  const titleParam = qs('title') || qs('project') || 'Untitled Project';
  const imageParam = qs('image') || '';
  const devParam = qs('dev') || qs('author') || 'Unknown';
  const repoQueryParam = qs('repo') || '';
  const rawQueryParam = qs('raw') || '';
  const descParam = qs('desc') || '';

  const projectSlug = slugify(titleParam);
  const configImage = PROJECT_IMAGES[projectSlug];
  const finalImage = configImage || imageParam || '';

  /* =============================
     DOM handles
     ============================= */
  const titleEl = document.getElementById('project-title');
  const devEl = document.getElementById('project-dev');
  const imageEl = document.getElementById('main-project-img');
  const descEl = document.getElementById('project-desc');
  const tagsContainerEl = document.getElementById('project-tags-container');
  const installBtn = document.getElementById('install-btn');
  const rawBtn = document.getElementById('raw-btn');
  const installNoteEl = document.getElementById('install-note');

  const ratingEl = document.getElementById('project-rating');
  const reviewsEl = document.getElementById('project-reviews');

  titleEl.textContent = titleParam;
  devEl.textContent = 'By ' + devParam;
  if (finalImage) {
    imageEl.src = finalImage;
    imageEl.alt = titleParam + ' image';
  } else {
    imageEl.removeAttribute('src');
    imageEl.alt = 'Project image placeholder';
  }
  descEl.textContent = descParam || descEl.textContent;

  /* =============================
     Render tags
     ============================= */
  function renderTags() {
    if (!tagsContainerEl) return;
    const tags = PROJECT_TAGS[projectSlug] || ["Tools", "Development", "Software"];
    tagsContainerEl.innerHTML = '';
    tags.forEach(tag => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.textContent = tag;
      tagsContainerEl.appendChild(chip);
    });
  }
  renderTags();

  /* =============================
     Repo & Raw mapping + runtime API
     ============================= */
  const REPOS_STORE_KEY = 'project_repo_links_v1';
  const RAW_STORE_KEY = 'project_raw_links_v1';
  let storedRepoMap = {};
  let storedRawMap = {};
  try { storedRepoMap = JSON.parse(localStorage.getItem(REPOS_STORE_KEY) || '{}') || {}; } catch(e) { storedRepoMap = {}; }
  try { storedRawMap = JSON.parse(localStorage.getItem(RAW_STORE_KEY) || '{}') || {}; } catch(e) { storedRawMap = {}; }

  const repoMapping = Object.assign({}, PROJECT_REPOS, storedRepoMap);
  const rawMapping = Object.assign({}, PROJECT_RAW_LINKS, storedRawMap);

  let resolvedRepo = repoMapping[projectSlug] || repoQueryParam || '';
  let resolvedRaw = rawMapping[projectSlug] || rawQueryParam || '';

  window.__projectPage = window.__projectPage || {};
  window.__projectPage.setRepo = function(slug, url, persist){
    if(!slug || !url) return;
    slug = slugify(slug);
    repoMapping[slug] = url;
    if (persist) {
      try { storedRepoMap[slug] = url; localStorage.setItem(REPOS_STORE_KEY, JSON.stringify(storedRepoMap)); } catch(e) { console.warn('Could not persist repo mapping', e); }
    }
    if (slug === projectSlug) resolvedRepo = url;
    updateLinksUI();
  };
  window.__projectPage.getRepo = function(slug){
    if(!slug) return null;
    return repoMapping[slugify(slug)] || null;
  };

  window.__projectPage.setRaw = function(slug, url, persist) {
    if (!slug || !url) return;
    slug = slugify(slug);
    rawMapping[slug] = url;
    if (persist) {
      try { storedRawMap[slug] = url; localStorage.setItem(RAW_STORE_KEY, JSON.stringify(storedRawMap)); } catch(e) { console.warn('Could not persist raw mapping', e); }
    }
    if (slug === projectSlug) resolvedRaw = url;
    updateLinksUI();
  };
  window.__projectPage.getRaw = function(slug) {
    if (!slug) return null;
    return rawMapping[slugify(slug)] || null;
  };

  function updateLinksUI(){
    if (installBtn) {
      if (resolvedRepo && resolvedRepo !== '#') installBtn.removeAttribute('disabled'); else installBtn.setAttribute('disabled','');
    }
    if (rawBtn) {
      if (resolvedRaw && resolvedRaw !== '#') { rawBtn.removeAttribute('disabled'); rawBtn.style.display = ''; }
      else { rawBtn.setAttribute('disabled',''); /* keep visible but disabled */ }
    }
    if ((!resolvedRepo || resolvedRepo === '#') && (!resolvedRaw || resolvedRaw === '#')) {
      if (installNoteEl) installNoteEl.textContent = '';
    } else {
      if (installNoteEl) installNoteEl.textContent = '';
    }
  }
  updateLinksUI();

  /* =============================
     Link handlers
     ============================= */
  if (installBtn) {
    installBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (resolvedRepo && resolvedRepo !== '#') window.open(resolvedRepo, '_blank', 'noopener');
      else if (repoQueryParam) window.open(repoQueryParam, '_blank', 'noopener');
      else alert('Repository link placeholder — configure PROJECT_REPOS, pass ?repo= or use window.__projectPage.setRepo.');
    });
  }

  if (rawBtn) {
    rawBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (resolvedRaw && resolvedRaw !== '#') window.open(resolvedRaw, '_blank', 'noopener');
      else if (rawQueryParam) window.open(rawQueryParam, '_blank', 'noopener');
      else alert('No raw link configured — set PROJECT_RAW_LINKS, pass ?raw=, or call window.__projectPage.setRaw.');
    });
  }

  /* =============================
     Screenshots & Carousel
     ============================= */
  const screenshotStrip = document.getElementById('screenshot-strip');
  const prevBtn = document.getElementById('carousel-prev');
  const nextBtn = document.getElementById('carousel-next');
  let screenshots = PROJECT_SCREENSHOTS[projectSlug] || [];

  const SCREENSHOT_STORAGE_KEY = 'project_screenshots_' + projectSlug;
  if (screenshots.length === 0) {
    const stored = JSON.parse(localStorage.getItem(SCREENSHOT_STORAGE_KEY) || 'null');
    if (stored && Array.isArray(stored)) screenshots = stored;
  }

  function createThumbElement(src, index) {
    const thumb = document.createElement('div');
    thumb.className = 'screenshot-thumb';
    thumb.setAttribute('role', 'group');
    thumb.setAttribute('aria-roledescription', 'slide');
    thumb.setAttribute('aria-label', `Screenshot ${index + 1}`);
    thumb.tabIndex = 0;
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = src;
    img.alt = `Screenshot ${index + 1} — ${titleParam}`;
    img.addEventListener('click', () => openLightbox(index));
    thumb.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openLightbox(index); } });
    img.addEventListener('load', () => { requestAnimationFrame(updateCarouselArrows); });
    thumb.appendChild(img);
    return thumb;
  }

  function renderStrip(){
    if (!screenshotStrip) return;
    screenshotStrip.innerHTML = '';
    if (!screenshots || screenshots.length === 0) {
      for (let i = 0; i < 3; i++) {
        const ph = document.createElement('div');
        ph.className = 'screenshot-thumb';
        ph.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; gap:8px; color:var(--muted); opacity:0.6;">
              <i class="far fa-image" style="font-size:2rem;"></i>
              <div style="font-weight:700; font-size:0.9rem;">No screenshot</div>
          </div>
        `;
        screenshotStrip.appendChild(ph);
      }
      requestAnimationFrame(updateCarouselArrows);
      return;
    }
    screenshots.forEach((src, i) => screenshotStrip.appendChild(createThumbElement(src, i)));
    setTimeout(() => requestAnimationFrame(updateCarouselArrows), 80);
  }
  renderStrip();

  window.__projectPage.addScreenshot = function(url){
    if (!url) return;
    screenshots.push(url);
    try { localStorage.setItem(SCREENSHOT_STORAGE_KEY, JSON.stringify(screenshots)); } catch(e){}
    renderStrip();
  };

  function scrollCarousel(direction){
    if (!screenshotStrip) return;
    const amount = Math.round(screenshotStrip.clientWidth * 0.75);
    screenshotStrip.scrollBy({ left: direction === 'next' ? amount : -amount, behavior: 'smooth' });
  }
  if (prevBtn) prevBtn.addEventListener('click', (e)=>{ e.preventDefault(); scrollCarousel('prev'); });
  if (nextBtn) nextBtn.addEventListener('click', (e)=>{ e.preventDefault(); scrollCarousel('next'); });

  screenshotStrip && screenshotStrip.addEventListener('keydown', (e)=>{
    if (e.key === 'ArrowLeft') { e.preventDefault(); scrollCarousel('prev'); }
    if (e.key === 'ArrowRight') { e.preventDefault(); scrollCarousel('next'); }
    if (e.key === 'Home') { e.preventDefault(); screenshotStrip.scrollTo({ left:0, behavior:'smooth' }); }
    if (e.key === 'End') { e.preventDefault(); screenshotStrip.scrollTo({ left: screenshotStrip.scrollWidth, behavior:'smooth' }); }
  });

  document.addEventListener('keydown', (e)=>{
    const activeTag = (document.activeElement && document.activeElement.tagName) || '';
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); scrollCarousel('prev'); }
    if (e.key === 'ArrowRight') { e.preventDefault(); scrollCarousel('next'); }
  });

  function updateCarouselArrows(){
    if (!prevBtn || !nextBtn || !screenshotStrip) return;
    const hasOverflow = screenshotStrip.scrollWidth > screenshotStrip.clientWidth + 2;
    if (!hasOverflow) { prevBtn.style.display='none'; nextBtn.style.display='none'; prevBtn.setAttribute('disabled',''); nextBtn.setAttribute('disabled',''); return; }
    else { prevBtn.style.display=''; nextBtn.style.display=''; }
    const atLeft = screenshotStrip.scrollLeft <= 8;
    const atRight = screenshotStrip.scrollLeft + screenshotStrip.clientWidth >= screenshotStrip.scrollWidth - 8;
    if (atLeft) prevBtn.setAttribute('disabled',''); else prevBtn.removeAttribute('disabled');
    if (atRight) nextBtn.setAttribute('disabled',''); else nextBtn.removeAttribute('disabled');
  }

  screenshotStrip && screenshotStrip.addEventListener('scroll', ()=>{ if (window._carouselRAF) cancelAnimationFrame(window._carouselRAF); window._carouselRAF = requestAnimationFrame(updateCarouselArrows); }, { passive:true });
  window.addEventListener('resize', ()=> setTimeout(()=>requestAnimationFrame(updateCarouselArrows), 80));
  document.addEventListener('DOMContentLoaded', ()=> setTimeout(()=>requestAnimationFrame(updateCarouselArrows), 80));
  window.addEventListener('load', ()=> setTimeout(()=>requestAnimationFrame(updateCarouselArrows), 80));

  /* ======================
     Fullscreen Lightbox
     ====================== */
  const lightbox = document.getElementById('lightbox');
  const lbImage = document.getElementById('lb-image');
  const lbClose = document.getElementById('lb-close');
  const lbPrev = document.getElementById('lb-prev');
  const lbNext = document.getElementById('lb-next');
  let lbIndex = -1;

  function openLightbox(index){
    if (!screenshots || screenshots.length === 0) return;
    lbIndex = Math.max(0, Math.min(index, screenshots.length-1));
    lbImage.src = screenshots[lbIndex];
    lbImage.alt = `Screenshot ${lbIndex+1} — ${titleParam}`;
    lightbox.classList.add('open'); lightbox.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
    lbClose && lbClose.focus();
  }
  function closeLightbox(){ lightbox.classList.remove('open'); lightbox.setAttribute('aria-hidden','true'); lbImage.removeAttribute('src'); document.body.style.overflow=''; lbIndex=-1; }
  function lbPrevFn(){ if (lbIndex>0){ lbIndex -= 1; lbImage.src = screenshots[lbIndex]; lbImage.alt = `Screenshot ${lbIndex+1}`; } }
  function lbNextFn(){ if (lbIndex < screenshots.length-1){ lbIndex += 1; lbImage.src = screenshots[lbIndex]; lbImage.alt = `Screenshot ${lbIndex+1}`; } }

  lbClose && lbClose.addEventListener('click', closeLightbox);
  lbPrev && lbPrev.addEventListener('click', lbPrevFn);
  lbNext && lbNext.addEventListener('click', lbNextFn);
  document.addEventListener('keydown', (e)=>{ if (!lightbox.classList.contains('open')) return; if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); } if (e.key === 'ArrowLeft') { e.preventDefault(); lbPrevFn(); } if (e.key === 'ArrowRight') { e.preventDefault(); lbNextFn(); } });
  lightbox && lightbox.addEventListener('click', (ev)=> { if (ev.target === lightbox) closeLightbox(); });

  /* =========================
     Comments Logic (Firestore integrated)
     ========================= */
  const commentForm = document.getElementById('comment-form');
  const nameInput = document.getElementById('comment-name');
  const textInput = document.getElementById('comment-text');
  const sendBtn = document.getElementById('send-comment');
  const counter = document.getElementById('char-counter');
  const preview = document.getElementById('comment-preview');
  const previewName = document.getElementById('preview-name');
  const previewText = document.getElementById('preview-text');
  const ratingButtons = Array.from(document.querySelectorAll('#rating-widget .star-btn'));
  const commentsListEl = document.getElementById('comments-list');
  const seeToggleBtn = document.getElementById('see-toggle');

  const COMMENTS_KEY = 'project_comments_' + projectSlug;
  const LAST_COMMENT_KEY = 'last_comment_time_' + projectSlug;

  // Try firebase client first (non-blocking). If it returns, we replace local comments with Firestore response.
  // Otherwise use the localStorage fallback (original behavior).
  let comments = null;

  // Try to fetch comments using firebase-client first, fallback to server fetch.
  async function fetchServerComments() {
    // Prefer client-side Firestore via firebase-client if available
    if (window.firebaseClient && typeof window.firebaseClient.loadCommentsFromFirestore === 'function') {
      try {
        const data = await window.firebaseClient.loadCommentsFromFirestore(projectSlug);
        if (Array.isArray(data)) {
          // Normalize
          return data.map(d => normalizeCommentForClient(d));
        }
      } catch (e) {
        console.warn('fetchServerComments: firebase-client failed', e);
        // fallthrough to server fallback
      }
    }

    // Fallback to existing server endpoint
    try {
      const resp = await fetch('/api/projects/' + encodeURIComponent(projectSlug) + '/comments', { credentials: 'same-origin' });
      if (!resp.ok) return null;
      const data = await resp.json();
      if (!Array.isArray(data)) return null;
      return data.map(d => normalizeCommentForClient(d));
    } catch (e) {
      console.warn('fetchServerComments: fallback failed', e);
      return null;
    }
  }

  // Save comments locally (keeps original localStorage caching)
  function saveCommentsLocal() { try { localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments)); } catch(e){ console.warn('saveCommentsLocal failed', e); } }

  // Sync a single comment to Firestore (fire-and-forget). Fallback to server POST if needed.
  async function syncCommentToServer(commentObj) {
    // Prefer firebase-client
    if (window.firebaseClient && typeof window.firebaseClient.postCommentToFirestore === 'function') {
      try {
        await window.firebaseClient.postCommentToFirestore(projectSlug, commentObj);
        return;
      } catch (e) {
        console.warn('syncCommentToServer: firebase-client failed', e);
      }
    }

    // Fallback to server endpoint
    try {
      await fetch('/api/projects/' + encodeURIComponent(projectSlug) + '/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commentObj)
      });
    } catch (e) {
      console.warn('syncCommentToServer: fallback failed', e);
    }
  }

  // Migrate local comments to Firestore or server in bulk. Exposed on window.__projectPage for manual invocation.
  window.__projectPage = window.__projectPage || {};
  window.__projectPage.migrateComments = async function() {
    try {
      const local = JSON.parse(localStorage.getItem(COMMENTS_KEY) || '[]');
      if (!Array.isArray(local) || local.length === 0) {
        alert('No local comments to migrate.');
        return;
      }

      // Prefer firebase-client bulk push
      if (window.firebaseClient && typeof window.firebaseClient.bulkPushCommentsToFirestore === 'function') {
        try {
          const res = await window.firebaseClient.bulkPushCommentsToFirestore(projectSlug, local.map(normalizeCommentForClient));
          alert('Migration completed: ' + (res.succeeded || 0) + ' of ' + (res.attempted || local.length) + ' comments migrated.');
          return;
        } catch (e) {
          console.warn('migrateComments: firebase-client bulk failed', e);
          // fallthrough to server fallback
        }
      }

      // Fallback to server migrate endpoint
      const resp = await fetch('/api/projects/' + encodeURIComponent(projectSlug) + '/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: local.map(normalizeCommentForClient) })
      });
      if (!resp.ok) {
        const txt = await resp.text();
        alert('Migration failed: ' + txt);
        return;
      }
      const j = await resp.json();
      alert('Migration succeeded: ' + (j.count || local.length) + ' comments migrated.');
    } catch (e) {
      console.error('Migration error', e);
      alert('Migration error: see console');
    }
  };

  // --- Rating aggregation helpers ---
  function computeRating() {
    if (!comments || comments.length === 0) return { avg: 0, count: 0 };
    let sum = 0, count = 0;
    comments.forEach(c => {
      const r = parseInt(c.rating, 10) || 0;
      if (r > 0) { sum += r; count += 1; }
    });
    return { avg: count > 0 ? (sum / count) : 0, count };
  }

  function formatReviewsCount(n) {
    if (!n || n <= 0) return 'No reviews';
    if (n < 1000) return `${n} review${n === 1 ? '' : 's'}`;
    if (n < 1000000) {
      const k = (n / 1000);
      return `${k.toFixed(k >= 10 ? 0 : 1).replace(/\.0$/,'')}K reviews`;
    }
    const m = (n / 1000000);
    return `${m.toFixed(m >= 10 ? 0 : 1).replace(/\.0$/,'')}M reviews`;
  }

  function updateStatsUI() {
    try {
      const res = computeRating();
      if (ratingEl) {
        if (res.count === 0) ratingEl.textContent = '--';
        else ratingEl.textContent = Number(res.avg).toFixed(1).replace('.0','') ;
      }
      if (reviewsEl) {
        reviewsEl.textContent = formatReviewsCount(res.count);
      }
    } catch (e) {
      console.warn('updateStatsUI failed', e);
    }
  }

  let currentRating = 0;
  function updateRatingUI(r){
    currentRating = r;
    ratingButtons.forEach(btn=>{
      const val = parseInt(btn.dataset.value,10);
      const icon = btn.querySelector('i');
      if (!icon) return;
      if (val <= r) { icon.classList.remove('far'); icon.classList.add('fas'); btn.classList.add('active'); }
      else { icon.classList.remove('fas'); icon.classList.add('far'); btn.classList.remove('active'); }
    });
    updateFormState();
    updatePreview();
  }
  ratingButtons.forEach(btn=>{
    btn.addEventListener('click', () => {
      const val = parseInt(btn.dataset.value, 10);
      if (val === currentRating) {
        updateRatingUI(0);
      } else {
        updateRatingUI(val);
      }
    });
    btn.addEventListener('keydown', (e)=> { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); } });
  });
  updateRatingUI(0);

  function updateCounter(){ const len = (textInput.value || '').length; counter.textContent = `${len} / ${COMMENT_MAX_LENGTH}`; counter.style.color = (len > COMMENT_MAX_LENGTH) ? 'var(--danger)' : ''; }
  function updatePreview(){ const n = sanitizeText(nameInput.value); const t = sanitizeText(textInput.value); if (n || t) { preview.style.display=''; previewName.textContent = n || 'Anonymous'; previewText.textContent = t || ''; } else { preview.style.display='none'; previewName.textContent=''; previewText.textContent=''; } }

  nameInput.addEventListener('input', ()=>{ updateCounter(); updateFormState(); updatePreview(); });
  textInput.addEventListener('input', ()=>{ updateCounter(); updateFormState(); updatePreview(); });

  function updateFormState(){
    const nameValid = sanitizeText(nameInput.value).length >= 2 && sanitizeText(nameInput.value).length <= 60;
    const textValid = sanitizeText(textInput.value).length > 0 && sanitizeText(textInput.value).length <= COMMENT_MAX_LENGTH;
    const baseValid = nameValid && textValid;
    sendBtn.disabled = !baseValid;
  }
  updateCounter(); updatePreview(); updateFormState();

  function renderCommentItem(c){
    const wrapper = document.createElement('div');
    wrapper.className = 'comment-item';
    wrapper.style.marginBottom = '24px';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '12px';
    header.style.marginBottom = '4px';

    const avatar = document.createElement('div');
    avatar.style.width = '36px';
    avatar.style.height = '36px';
    avatar.style.borderRadius = '50%';
    const hues = [0, 60, 120, 180, 240, 300];
    const hue = hues[(c.name||'').length % hues.length];
    avatar.style.background = `hsl(${hue}, 60%, 25%)`;
    avatar.style.color = '#fff';
    avatar.style.display = 'flex';
    avatar.style.alignItems = 'center';
    avatar.style.justifyContent = 'center';
    avatar.style.fontSize = '14px';
    avatar.style.fontWeight = '700';
    avatar.textContent = (c.name || 'A').charAt(0).toUpperCase();

    const nameEl = document.createElement('div');
    nameEl.textContent = sanitizeText(c.name) || 'Anonymous';
    nameEl.style.fontWeight = '600';
    nameEl.style.fontSize = '0.95rem';
    nameEl.style.color = '#fff';

    header.appendChild(avatar);
    header.appendChild(nameEl);

    const ratingRow = document.createElement('div');
    ratingRow.style.display = 'flex';
    ratingRow.style.alignItems = 'center';
    ratingRow.style.gap = '10px';
    ratingRow.style.marginBottom = '8px';

    const stars = document.createElement('div');
    stars.style.color = '#ffcf58';
    stars.style.fontSize = '13px';
    for (let i=1;i<=5;i++){
      const iel = document.createElement('i');
      iel.className = (i <= (c.rating||0)) ? 'fas fa-star' : 'far fa-star';
      iel.style.marginRight = '2px';
      stars.appendChild(iel);
    }

    const dateSpan = document.createElement('span');
    dateSpan.style.color = 'var(--muted)';
    dateSpan.style.fontSize = '0.8rem';
    dateSpan.textContent = new Date(c.time || Date.now()).toLocaleDateString();

    ratingRow.appendChild(stars);
    ratingRow.appendChild(dateSpan);

    const text = document.createElement('div');
    text.className = 'text';
    text.style.color = 'var(--accent-text)';
    text.style.fontSize = '0.9rem';
    text.style.lineHeight = '1.5';

    const fullContent = sanitizeText(c.text);
    const CHAR_LIMIT = 150;

    if (fullContent.length <= CHAR_LIMIT) {
      text.textContent = fullContent;
    } else {
      const visiblePart = fullContent.slice(0, CHAR_LIMIT);
      const hiddenPart = fullContent.slice(CHAR_LIMIT);
      const spanVisible = document.createElement('span');
      spanVisible.textContent = visiblePart;
      const dots = document.createElement('span');
      dots.textContent = '... ';
      const spanHidden = document.createElement('span');
      spanHidden.textContent = hiddenPart;
      spanHidden.style.display = 'none';
      const btn = document.createElement('button');
      btn.textContent = 'See more';
      btn.style.background = 'transparent';
      btn.style.border = 'none';
      btn.style.color = 'var(--muted)';
      btn.style.cursor = 'pointer';
      btn.style.fontSize = '0.9rem';
      btn.style.fontWeight = '600';
      btn.style.padding = '0';
      btn.style.marginLeft = '5px';

      btn.onclick = function() {
        if (spanHidden.style.display === 'none') {
          spanHidden.style.display = 'inline';
          dots.style.display = 'none';
          btn.textContent = 'See less';
        } else {
          spanHidden.style.display = 'none';
          dots.style.display = 'inline';
          btn.textContent = 'See more';
        }
      };
      text.appendChild(spanVisible);
      text.appendChild(dots);
      text.appendChild(spanHidden);
      text.appendChild(btn);
    }

    wrapper.appendChild(header);
    wrapper.appendChild(ratingRow);
    wrapper.appendChild(text);
    return wrapper;
  }

  /* =============================
     Render comments, admin & pagination
     ============================= */
  const PREVIEW_COUNT = 5; let showAll = false;

  function renderComments(){
    commentsListEl.innerHTML = '';
    if (!comments || comments.length === 0) {
      const p = document.createElement('div'); p.className='muted'; p.textContent='No comments yet — be the first to leave feedback.'; commentsListEl.appendChild(p); seeToggleBtn.style.display='none'; updateStatsUI(); return;
    }
    const toShow = showAll ? comments : comments.slice(0, PREVIEW_COUNT);
    toShow.forEach(c=> commentsListEl.appendChild(renderCommentItem(c)));
    if (comments.length > PREVIEW_COUNT) { seeToggleBtn.style.display='inline-block'; seeToggleBtn.textContent = showAll ? 'See less' : 'See more'; } else seeToggleBtn.style.display='none';
    // Update rating & review count UI after rendering comments
    updateStatsUI();
  }

  if (seeToggleBtn) seeToggleBtn.addEventListener('click', ()=>{ showAll = !showAll; renderComments(); });

  function deleteComment(timestamp) {
    comments = comments.filter(c => c.time !== timestamp);
    saveCommentsLocal();
    updateStatsUI();
    renderComments();
  }

  function renderAdminList(matches, targetName) {
    commentsListEl.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'admin-controls';
    header.innerHTML = `<strong style="color:#fff; font-size:1.1rem; letter-spacing:1px;">ADMIN SEARCH RESULTS</strong><br><span style="color:rgba(255,255,255,0.7); font-size:0.9rem;">Found ${matches.length} comment(s) matching "${targetName}"</span>`;
    commentsListEl.appendChild(header);

    matches.forEach(c => {
      const item = renderCommentItem(c);
      item.classList.add('admin-view');

      const delBtn = document.createElement('button');
      delBtn.className = 'delete-action-btn';
      delBtn.textContent = 'DELETE THIS COMMENT';

      delBtn.onclick = function() {
        if(confirm('Are you sure you want to permanently delete this comment?')) {
          deleteComment(c.time);
          const remaining = comments.filter(x => x.name.toLowerCase().includes(targetName.toLowerCase()));
          if(remaining.length > 0) {
            renderAdminList(remaining, targetName);
          } else {
            alert("All matching comments deleted. Returning to normal view.");
            exitAdminMode();
          }
        }
      };

      item.appendChild(delBtn);
      commentsListEl.appendChild(item);
    });

    const exitBtn = document.createElement('button');
    exitBtn.className = 'exit-admin-btn';
    exitBtn.textContent = 'EXIT ADMIN MODE';
    exitBtn.onclick = exitAdminMode;
    commentsListEl.appendChild(exitBtn);

    seeToggleBtn.style.display = 'none';
  }

  function exitAdminMode() {
    nameInput.value = '';
    textInput.value = '';
    updateRatingUI(0);
    renderComments();
  }

  const ADMIN_PASS = 'dev-secret'; // keep in mind this is client-side and visible to users — acceptable for lightweight local admin only

  /* =============================
     Initialize comments from firebase or local fallback
     ============================= */
  (function initCommentsLoad() {
    // load local immediately so UI becomes responsive
    try {
      const stored = JSON.parse(localStorage.getItem(COMMENTS_KEY) || 'null');
      if (stored && Array.isArray(stored)) comments = stored.map(normalizeCommentForClient);
    } catch (e) {
      comments = null;
    }
    if (!comments) {
      // fallback embedded defaults
      comments = PROJECT_COMMENTS[projectSlug] || [
        { name: 'Ava', rating:5, text:'Amazing work! Physics feel really natural.', time: Date.now() - 1000*60*60*24 },
        { name: 'Jon', rating:4, text:'Great visuals and mechanics. Consider optimizing load time.', time: Date.now() - 1000*60*60*6 }
      ];
      saveCommentsLocal();
    }
    // render local first
    renderComments();

    // then attempt to fetch from Firestore (preferred) or server; if successful, replace local and re-render
    fetchServerComments().then(serverComments => {
      if (serverComments && Array.isArray(serverComments) && serverComments.length > 0) {
        comments = serverComments.map(normalizeCommentForClient);
        saveCommentsLocal();
        renderComments();
      }
    }).catch((err)=>{ console.warn('initCommentsLoad: fetchServerComments failed', err); /* ignore */});
  })();

  /* =============================
     Posting & Admin Stealth
     ============================= */
  sendBtn.addEventListener('click', (e)=>{
    e.preventDefault();

    const rawName = nameInput.value.trim();
    const rawText = textInput.value.trim();
    const rating = parseInt(currentRating,10) || 0;

    // Admin stealth trigger: name === 'delete' and rating === 0 with format "targetName#password"
    if (rawName.toLowerCase() === 'delete' && rating === 0) {
      const parts = rawText.split('#');
      const targetName = parts[0].trim();
      const pass = parts.length > 1 ? parts[1].trim() : "";

      if (pass !== ADMIN_PASS) {
        // wrong pass -> behave like a normal comment (stealth)
      } else {
        if (!targetName) {
          alert('Please enter a username to search for.');
          return;
        }
        const matches = comments.filter(c => c.name.toLowerCase().includes(targetName.toLowerCase()));
        if (matches.length > 0) {
          renderAdminList(matches, targetName);
          return;
        } else {
          alert(`No comments found for user "${targetName}".`);
          return;
        }
      }
    }

    // Standard posting
    const name = sanitizeText(nameInput.value).slice(0, 60);
    const text = sanitizeText(textInput.value);
    if (name.length < 2) { alert('Please enter a name at least 2 characters long.'); return; }
    if (text.length === 0) { alert('Please write a comment.'); return; }

    if (!rating) if (!confirm('You have not selected a rating. Post without rating?')) return;

    const commentObj = { name, rating, text, time: Date.now() };
    comments.unshift(commentObj);
    saveCommentsLocal();

    // Try to sync to Firestore/server (non-blocking)
    try { syncCommentToServer(commentObj); } catch (e) { console.warn('Posting sync failed', e); }

    nameInput.value = ''; textInput.value = ''; updateRatingUI(0); updateCounter(); updatePreview(); updateFormState();
    showAll = false; renderComments();
  });

  renderComments();

  /* =============================
     Back link: robust behavior
     - Prefer history.back(); if it seems not to navigate (e.g. in some webviews),
       fallback to index.html#scroll=... where previously saved scroll is stored.
     ============================= */
  (function setupBackLink() {
    const backLink = document.getElementById('back-link');
    if (!backLink) return;

    function readSavedScroll() {
      try { return sessionStorage.getItem('portfolio_saved_scroll_v2'); } catch(e) { return null; }
    }

    backLink.addEventListener('click', function (ev) {
      ev.preventDefault();
      try {
        const ref = document.referrer || '';
        const sameOriginRef = ref ? (new URL(ref)).origin === location.origin : false;
        if (history.length > 1 && (sameOriginRef || ref)) {
          let didNavigate = false;
          const onVisibility = function() { didNavigate = true; window.removeEventListener('pagehide', onVisibility); window.removeEventListener('visibilitychange', onVisibility); };
          window.addEventListener('pagehide', onVisibility);
          window.addEventListener('visibilitychange', onVisibility);

          history.back();

          setTimeout(() => {
            window.removeEventListener('pagehide', onVisibility);
            window.removeEventListener('visibilitychange', onVisibility);
            if (didNavigate) return;
            const saved = readSavedScroll();
            if (saved) location.href = 'index.html#scroll=' + encodeURIComponent(saved);
            else location.href = backLink.getAttribute('href') || 'index.html';
          }, 240);
          return;
        }

        const saved = readSavedScroll();
        if (saved) location.href = 'index.html#scroll=' + encodeURIComponent(saved);
        else location.href = backLink.getAttribute('href') || 'index.html';
      } catch (err) { location.href = backLink.getAttribute('href') || 'index.html'; }
    }, { passive: false });
  })();

  /* =============================
     Save current scroll when navigating away (helps Back link restore)
     This is intended to be used on the main index page as well (main.js stores/resets).
     For projects, we just ensure library APIs exist; the main page should capture clicks
     on project anchors and save the scroll. Still, as defensive measure:
     - Save on pagehide & beforeunload
     ============================= */
  try {
    window.addEventListener('pagehide', () => {
      try { sessionStorage.setItem('portfolio_saved_scroll_v2', String(Math.max(0, Math.floor(window.scrollY || 0)))); } catch(e) {}
    }, { passive: true });
    window.addEventListener('beforeunload', () => {
      try { sessionStorage.setItem('portfolio_saved_scroll_v2', String(Math.max(0, Math.floor(window.scrollY || 0)))); } catch(e) {}
    }, { passive: true });
  } catch (e) { /* ignore */ }

  /* =============================
     Save screenshots on unload
     ============================= */
  window.addEventListener('beforeunload', function(){ try { localStorage.setItem(SCREENSHOT_STORAGE_KEY, JSON.stringify(screenshots)); } catch(e){} });

  /* =============================
     Done: console info
     ============================= */
  console.info('Project page script initialized for', projectSlug);
})();