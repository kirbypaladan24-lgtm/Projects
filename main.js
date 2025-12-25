/* LIVING DATA-VERSE + PORTFOLIO LOGIC
   - Optimized for Smoothness (High-Performance Transitions)
   - Preserves all original logic
   - Fixes:
     * Desktop settings panel visibility (already applied earlier)
     * Mobile settings: reset now works correctly (updates inputs, select, preview toggle)
     * Mobile live preview toggle now reliably starts/stops the preview
*/

(() => {
    // ----------------------------
    // Persistent settings (defaults)
    // ----------------------------
    const STORAGE_KEY = 'eyeSettings_v1';
    const DEFAULT_SETTINGS = {
        idleTimeout: 17,
        idleMoveSpeed: 0.02,
        idleRotSpeed: 0.03,
        activeMoveSpeed: 0.08,
        activeRotSpeed: 0.12,
        saccadeMin: 2,
        saccadeMax: 4.5,
        pupilMin: 0.7,
        pupilMax: 1.2,

        blinkMin: 2.0,
        blinkMax: 6.0,
        blinkDuration: 0.25,

        emotionMin: 4.0,
        emotionMax: 10.0,

        colorPreset: 'neon',

        // Eye sizing controls
        eyeScale: 1.0,
        eyeWidth: 1.0,
        eyeHeight: 1.0,

        // New laser size control (multiplier)
        laserSize: 1.0
    };

    window.eyeSettings = Object.assign({}, DEFAULT_SETTINGS);
    function loadSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) Object.assign(window.eyeSettings, JSON.parse(raw));
        } catch (e) {
            console.warn('Eye settings load failed, using defaults.', e);
        }
    }
    function saveSettings() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(window.eyeSettings)); }
        catch (e) { console.warn('Eye settings save failed.', e); }
    }
    loadSettings();

    // ----------------------------
    // Scroll persistence helpers
    // ----------------------------
    const PORTFOLIO_SCROLL_KEY = 'portfolio_saved_scroll_v2';

    function savePortfolioScroll() {
        try {
            const y = (window.scrollY !== undefined ? window.scrollY : (document.documentElement && document.documentElement.scrollTop) || 0);
            const intY = Math.max(0, Math.floor(y));
            // Save in sessionStorage for fallback
            sessionStorage.setItem(PORTFOLIO_SCROLL_KEY, String(intY));
            // Also embed into history.state so that a subsequent history.back restores it
            try {
                const newState = Object.assign({}, history.state || {}, { portfolioScroll: intY });
                history.replaceState(newState, '', location.href);
            } catch (e) { /* ignore */ }
        } catch (e) {
            // ignore
        }
    }

    function readPortfolioScrollFromState() {
        try {
            if (history.state && typeof history.state.portfolioScroll !== 'undefined' && history.state.portfolioScroll !== null) {
                const n = parseInt(history.state.portfolioScroll, 10);
                if (!isNaN(n)) return n;
            }
            return null;
        } catch (e) { return null; }
    }
    function readPortfolioScrollFromHash() {
        try {
            const m = window.location.hash ? window.location.hash.match(/scroll=([^&]+)/) : null;
            if (m && m[1]) {
                const val = parseInt(decodeURIComponent(m[1]), 10);
                if (!isNaN(val)) return val;
            }
            return null;
        } catch (e) { return null; }
    }
    function readPortfolioScrollFromSession() {
        try {
            const v = sessionStorage.getItem(PORTFOLIO_SCROLL_KEY);
            if (!v) return null;
            const n = parseInt(v, 10);
            if (isNaN(n)) return null;
            return n;
        } catch (e) { return null; }
    }
    function clearPortfolioScroll() {
        try { sessionStorage.removeItem(PORTFOLIO_SCROLL_KEY); } catch(e){}
    }

    function restorePortfolioScrollIfPresent() {
        try {
            // 1) prefer history.state (best)
            const stateVal = readPortfolioScrollFromState();
            if (stateVal !== null) {
                // Use 'auto' (instant) for restoration to prevent visual jumping on load
                setTimeout(() => {
                    window.scrollTo({ top: stateVal, behavior: 'auto' });
                    // Clear state key to avoid reusing repeatedly
                    try {
                        const s = Object.assign({}, history.state || {});
                        delete s.portfolioScroll;
                        history.replaceState(s, '', window.location.pathname + window.location.search);
                    } catch (e) {}
                }, 40);
                return;
            }

            // 2) hash fallback: index.html#scroll=123
            const hashVal = readPortfolioScrollFromHash();
            if (hashVal !== null) {
                setTimeout(() => {
                    window.scrollTo({ top: hashVal, behavior: 'auto' });
                    try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) {}
                }, 40);
                return;
            }

            // 3) sessionStorage fallback
            const saved = readPortfolioScrollFromSession();
            if (saved !== null) {
                setTimeout(() => {
                    window.scrollTo({ top: saved, behavior: 'auto' });
                    clearPortfolioScroll();
                }, 40);
            }
        } catch (e) { /* ignore */ }
    }

    // Save scroll when page is hidden/unloaded (defensive)
    try {
        window.addEventListener('pagehide', savePortfolioScroll, { passive: true });
        window.addEventListener('beforeunload', savePortfolioScroll, { passive: true });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') savePortfolioScroll();
        });
    } catch (e) { /* ignore */ }

    // Also restore on pageshow (important for bfcache / history navigation and some webviews)
    window.addEventListener('pageshow', (ev) => {
        // pageshow fires on normal load and when restored from bfcache; restore scroll in either case
        try { restorePortfolioScrollIfPresent(); } catch (e) {}
    });

    // ---------- Ensure we persist scroll just before navigating to projects ----------
    // Use delegated click listener to catch any anchor navigating to project.html
    function isProjectLinkAnchor(a) {
        if (!a || !a.getAttribute) return false;
        const href = (a.getAttribute('href') || '').trim();
        if (!href) return false;
        // match project.html in href (relative or absolute). You can adjust to your URL patterns.
        return href.includes('project.html') || href.match(/\/project(\/|\.html)/);
    }
    document.addEventListener('click', (e) => {
        try {
            const a = e.target.closest && e.target.closest('a');
            if (!a) return;
            if (isProjectLinkAnchor(a)) {
                // store scroll in sessionStorage and history.state right away
                savePortfolioScroll();
                // small synchronous delay is okay — browser will navigate afterwards
            }
        } catch (err) { /* ignore */ }
    }, { passive: true });

    // ----------------------------
    // Color constants, prefs, threejs, UI etc.
    // ----------------------------

    // ----------------------------
    // Color constants
    // ----------------------------
    const CLAY_WHITE_HEX = '#9aa0a0';
    const CLAY_WHITE_ALT_HEX = '#8f9696';
    const PUPIL_COLOR = 0x000000; // force pupil to pure black

    // ----------------------------
    // Respect user motion preferences
    // ----------------------------
    const PREFERS_REDUCED_MOTION = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || false;

    // Expose mobile preview enabled flag
    window.__mobilePreviewEnabled = (localStorage.getItem('mobilePreviewEnabled') !== null) ? (localStorage.getItem('mobilePreviewEnabled') === '1') : (!PREFERS_REDUCED_MOTION);
    function setMobilePreviewEnabled(val) {
        window.__mobilePreviewEnabled = !!val;
        try { localStorage.setItem('mobilePreviewEnabled', window.__mobilePreviewEnabled ? '1' : '0'); } catch (e) { /* ignore */ }
    }

    // ----------------------------
    // Color presets
    // ----------------------------
    const COLOR_PRESETS = {
        neon: { home: '#ff3ba8', about: '#7afcff', skills: '#39ff14', experience: '#9d00ff', projects: '#ffa500', certificates: '#ffff00', contact: '#ff0000' },
        sunset: { home: '#ff6b6b', about: '#ffd166', skills: '#06d6a0', experience: '#8338ec', projects: '#ff9f1c', certificates: '#ffe066', contact: '#ff4d6d' },
        cool: { home: '#4cc9f0', about: '#4361ee', skills: '#3a0ca3', experience: '#4895ef', projects: '#90e0ef', certificates: '#bde0fe', contact: '#023e8a' },
        monochrome: { home: '#d1d1d1', about: '#b3b3b3', skills: '#9a9a9a', experience: '#7f7f7f', projects: '#666666', certificates: '#4c4c4c', contact: '#2b2b2b' },
        vibrant: { home: '#ff2d95', about: '#00f5d4', skills: '#ffea00', experience: '#9b5cff', projects: '#ff7b00', certificates: '#00d4ff', contact: '#ff0044' }
    };

    let sectionColors = { home: null, about: null, skills: null, experience: null, projects: null, certificates: null, contact: null, settings: null };
    function applyColorPreset(presetKey) {
        const preset = COLOR_PRESETS[presetKey] || COLOR_PRESETS.neon;
        if (typeof THREE !== 'undefined') {
            try {
                sectionColors.home = new THREE.Color(preset.home);
                sectionColors.about = new THREE.Color(preset.about);
                sectionColors.skills = new THREE.Color(preset.skills);
                sectionColors.experience = new THREE.Color(preset.experience);
                sectionColors.projects = new THREE.Color(preset.projects);
                sectionColors.certificates = new THREE.Color(preset.certificates);
                sectionColors.contact = new THREE.Color(preset.contact);
                sectionColors.settings = sectionColors.home.clone();
            } catch (e) {
                sectionColors = Object.assign({}, preset, { settings: preset.home });
            }
        } else {
            sectionColors = Object.assign({}, preset, { settings: preset.home });
        }
        // sync if scene is present
        if (window.__three && window.__three.iris) {
            try { window.__three.iris.material.color.copy(sectionColors.home); } catch (e) {}
        }
    }
    applyColorPreset(window.eyeSettings.colorPreset || DEFAULT_SETTINGS.colorPreset);

    // Laser config
    const LASER = {
        chanceOnSaccade: 0.35,
        duration: 0.22,
        radius: 40,
        pushStrength: 300,
        baseRadius: 0.06,
        sizeMultiplier: window.eyeSettings.laserSize || 1.0
    };
    function applyLaserSize() { LASER.sizeMultiplier = parseFloat(window.eyeSettings.laserSize) || 1.0; }
    applyLaserSize();

    // Helpers
    function isMobileLayout() { return window.matchMedia('(max-width: 768px)').matches; }
    function getPanel(id) { return document.getElementById(id); }

    function applyEyeSize() {
        try {
            const eyeObj = window.__eye && window.__eye.rotatingEye;
            if (!eyeObj) return;
            const w = parseFloat(window.eyeSettings.eyeWidth) || 1.0;
            const h = parseFloat(window.eyeSettings.eyeHeight) || 1.0;
            const s = parseFloat(window.eyeSettings.eyeScale) || 1.0;
            eyeObj.scale.set(w, h, s);
        } catch (e) { console.warn('applyEyeSize failed', e); }
    }

    // Save original landscape/material state
    function saveOriginalLandscapeState(three) {
        if (!three) return;
        if (!three._orig) three._orig = {};
        try {
            if (three.pMat) {
                three._orig.pMatColor = three.pMat.color ? three.pMat.color.clone() : null;
                three._orig.pMatSize = three.pMat.size || null;
                three._orig.pMatOpacity = typeof three.pMat.opacity !== 'undefined' ? three.pMat.opacity : null;
            }
            if (three.bloomPass) {
                three._orig.bloom = { strength: three.bloomPass.strength, radius: three.bloomPass.radius, threshold: three.bloomPass.threshold };
            }
        } catch (e) { /* ignore */ }
    }

    // Create/ensure iris glow helper (reused) - left in place but not used for glow
    function createRadialSpriteMaterial(hexColor, size = 256, intensity = 1.0) {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const ctx = c.getContext('2d');
        const grd = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        const color = new THREE.Color(hexColor);
        const rgba = `rgba(${Math.round(color.r*255)},${Math.round(color.g*255)},${Math.round(color.b*255)},`;
        grd.addColorStop(0, rgba + Math.min(1, 0.8 * intensity) + ')');
        grd.addColorStop(0.18, rgba + Math.min(1, 0.5 * intensity) + ')');
        grd.addColorStop(0.5, rgba + '0.18)');
        grd.addColorStop(1, rgba + '0.0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0,0,size,size);
        const tex = new THREE.CanvasTexture(c);
        tex.needsUpdate = true;
        const mat = new THREE.SpriteMaterial({ map: tex, color: 0xffffff, blending: THREE.NormalBlending, transparent: true, depthTest: false, depthWrite: false });
        return mat;
    }
    function ensureIrisGlow(three, colorHex) {
        // Keep as a no-op for now to avoid additive glow sprites.
        // If needed in the future we can re-enable a subtle glow variant.
        return;
    }

    // ----------------------------
    // Certificate modal implementation
    // ----------------------------
    (function initCertificateModal() {
        const modal = document.getElementById('cert-modal');
        const img = document.getElementById('cert-modal-img');
        const caption = document.getElementById('cert-modal-caption');
        const backBtn = document.getElementById('cert-modal-back');
        const closeBtn = document.getElementById('cert-modal-close');

        if (!modal || !img) return;

        let isOpen = false;

        function openModal(src, alt) {
            if (!modal) return;
            img.src = src || '';
            img.alt = alt || 'Certificate';
            caption.textContent = alt || '';
            // Use RAF for smooth transition triggering
            requestAnimationFrame(() => {
                modal.classList.add('open');
                modal.setAttribute('aria-hidden', 'false');
            });
            isOpen = true;
            try { history.pushState({ certFull: true }, '', '#cert-full'); } catch (e) {}
            try { (backBtn || closeBtn).focus(); } catch (e) {}
        }
        function closeModalByUser() {
            if (history.state && history.state.certFull) {
                history.back();
            } else {
                closeModal();
            }
        }
        function closeModal() {
            if (!modal) return;
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
            isOpen = false;
            // Wait for transition to finish before removing src (optional, but cleaner)
            setTimeout(() => { try { img.removeAttribute('src'); } catch (e) {} }, 300);
        }

        window.addEventListener('popstate', (e) => {
            if (isOpen) {
                const st = e.state;
                if (!(st && st.certFull)) closeModal();
            }
        });

        backBtn && backBtn.addEventListener('click', () => {
            try { history.back(); } catch (e) { closeModal(); }
        });
        closeBtn && closeBtn.addEventListener('click', closeModalByUser);

        modal.addEventListener('click', (ev) => {
            if (ev.target === modal) closeModalByUser();
        });

        window.addEventListener('keydown', (ev) => {
            if (!isOpen) return;
            if (ev.key === 'Escape') {
                ev.preventDefault();
                closeModalByUser();
            }
        });

        function attachCertClickHandlers() {
            const certImages = document.querySelectorAll('.cert-card img');
            certImages.forEach(imgEl => {
                imgEl.style.cursor = 'zoom-in';
                if (imgEl.dataset.certListenerAttached) return;
                imgEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const src = imgEl.src || imgEl.getAttribute('src');
                    const alt = imgEl.alt || imgEl.getAttribute('alt') || 'Certificate';
                    openModal(src, alt);
                });
                imgEl.dataset.certListenerAttached = '1';
            });
        }

        document.addEventListener('DOMContentLoaded', attachCertClickHandlers);
        attachCertClickHandlers();
    })();

    // ----------------------------
    // Project modal implementation
    // ----------------------------
    (function initProjectModal() {
        const modal = document.getElementById('project-modal');
        const titleEl = document.getElementById('project-modal-title');
        const descEl = document.getElementById('project-modal-desc');
        const linksEl = document.getElementById('project-modal-links');
        const backBtn = document.getElementById('project-modal-back');
        const closeBtn = document.getElementById('project-modal-close');

        if (!modal || !titleEl) return;

        let isOpen = false;

        function openProject(data) {
            titleEl.textContent = data.title || 'Project';
            descEl.textContent = data.desc || '';
            linksEl.innerHTML = data.links ? data.links.map(l => `<a href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`).join(' • ') : '';
            
            requestAnimationFrame(() => {
                modal.classList.add('open');
                modal.setAttribute('aria-hidden', 'false');
            });
            
            isOpen = true;
            try { history.pushState({ projectOpen: true }, '', '#project'); } catch (e) {}
            try { (backBtn || closeBtn).focus(); } catch (e) {}
        }
        function closeByUser() {
            if (history.state && history.state.projectOpen) {
                history.back();
            } else close();
        }
        function close() {
            modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); isOpen = false;
        }

        window.addEventListener('popstate', (e) => {
            if (isOpen) {
                const st = e.state;
                if (!(st && st.projectOpen)) close();
            }
        });

        backBtn && backBtn.addEventListener('click', () => { try { history.back(); } catch (e) { close(); } });
        closeBtn && closeBtn.addEventListener('click', closeByUser);

        modal.addEventListener('click', (ev) => { if (ev.target === modal) closeByUser(); });
        window.addEventListener('keydown', (ev) => { if (!isOpen) return; if (ev.key === 'Escape') { ev.preventDefault(); closeByUser(); } });

        function attachProjectHandlers() {
            const projectCards = document.querySelectorAll('.project-card');
            projectCards.forEach(card => {
                if (card.dataset.listenerAttached) return;
                function openFromCard(e) {
                    if (card.tagName.toLowerCase() === 'a') {
                        const href = (card.getAttribute('href') || '').trim();
                        if (href && href !== '#' && !href.startsWith('javascript:')) {
                            return;
                        }
                    }
                    e.preventDefault();
                    e.stopPropagation();
                    const title = card.dataset.title || (card.querySelector('h3') && card.querySelector('h3').textContent) || '';
                    const desc = card.dataset.desc || (card.querySelector('p') && card.querySelector('p').textContent) || '';
                    openProject({ title, desc, links: [] });
                }
                card.addEventListener('click', openFromCard);
                card.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') openFromCard(ev); });
                card.dataset.listenerAttached = '1';
            });
        }
        document.addEventListener('DOMContentLoaded', attachProjectHandlers);
        attachProjectHandlers();
    })();

    // ----------------------------
    // Utility
    // ----------------------------
    function randomBetween(a,b) { return a + Math.random()*(b-a); }

    // Mobile menu toggle
    function initMobileMenu() {
        const mobileToggle = document.getElementById('mobile-toggle');
        const navLinksContainer = document.getElementById('nav-links');
        if (!mobileToggle || !navLinksContainer) return;
        mobileToggle.addEventListener('click', () => {
            navLinksContainer.classList.toggle('mobile-active');
            const icon = mobileToggle.querySelector('i');
            if (navLinksContainer.classList.contains('mobile-active')) {
                if (icon) { icon.classList.remove('fa-bars'); icon.classList.add('fa-times'); }
            } else {
                if (icon) { icon.classList.remove('fa-times'); icon.classList.add('fa-bars'); }
            }
        });
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navLinksContainer.classList.remove('mobile-active');
                const icon = mobileToggle.querySelector('i');
                if (icon) { icon.classList.remove('fa-times'); icon.classList.add('fa-bars'); }
            });
        });
    }

    // SPA navigation
    let currentPanelId = 'home';
    function setActiveNavLink(sectionId) {
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link.dataset.target === sectionId) link.classList.add('active'); else link.classList.remove('active');
        });
    }
    function scrollToPanelSmooth(sectionId) {
        const el = getPanel(sectionId);
        if (!el) return;
        el.classList.remove('hidden');
        const offset = 140;
        const rectTop = el.getBoundingClientRect().top + window.scrollY;
        // Optimization: Explicitly use smooth behavior
        window.scrollTo({ top: Math.max(0, rectTop - offset), behavior: 'smooth' });
        currentPanelId = sectionId;
        setActiveNavLink(sectionId);
    }
    function switchSection(sectionId) {
        if (!sectionId) return;
        if (isMobileLayout()) { scrollToPanelSmooth(sectionId); return; }
        if (sectionId === currentPanelId) return;
        const from = getPanel(currentPanelId);
        const to = getPanel(sectionId);
        if (!from || !to) return;
        from.classList.remove('active'); from.classList.add('hidden');
        to.classList.remove('hidden'); 
        
        // Use double RAF to ensure class addition triggers CSS transition (smooth fade/slide)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                to.classList.add('active');
            });
        });
        
        setActiveNavLink(sectionId); currentPanelId = sectionId;
    }
    function initNavigation() {
        document.addEventListener('click', (e) => {
            const el = e.target.closest('[data-target]');
            if (!el) return;
            const href = el.getAttribute('href');
            if (href && (href.startsWith('http') || href.startsWith('mailto'))) return;
            if (el.dataset.target === 'settings' && isMobileLayout()) return;
            e.preventDefault();
            switchSection(el.dataset.target);
        });
    }
    // ----------------------------
    // initThreeJS (nebula background + eye + particles)
    // ----------------------------
    function initThreeJS() {
        if (typeof THREE === 'undefined') { console.warn('THREE.js not available — skipping 3D initialization.'); return; }
        const canvas = document.getElementById('bg-canvas');
        if (!canvas) { console.warn('No #bg-canvas found — skipping 3D.'); return; }

        // Optimization: Alpha: true helps with compositing, powerPreference helps select dGPU if available
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
        // Optimization: Cap pixel ratio at 2 to prevent performance kill on high-res mobile screens
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(0x000000, 0);
        renderer.toneMapping = THREE.ReinhardToneMapping;

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x000510, 0.0018);

        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(0, 18, 36);
        scene.add(camera);

        // Bloom (disabled for smoother, less glow)
        let composer = null; let bloomActive = false; let bloomPass = null;
        try {
            // Intentionally disable bloom/unreal bloom pass for a smoother, less "glowy" feel.
            bloomActive = false;
            composer = null;
            bloomPass = null;
        } catch (e) { console.warn('Bloom init bypassed.', e); composer = null; bloomActive = false; bloomPass = null; }

        // ---------- Nebula background (soft sprites but toned down) ----------
        const nebulaGroup = new THREE.Group();
        scene.add(nebulaGroup);

        const nebulaPresets = [
            { color: 0xff3ba8, size: 900, intensity: 0.65, z: -300, speed: 0.003, rotation: 0.0008 },
            { color: 0x7afcff, size: 800, intensity: 0.55, z: -420, speed: 0.0022, rotation: -0.0006 },
            { color: 0xffa500, size: 600, intensity: 0.45, z: -520, speed: 0.0015, rotation: 0.0005 },
            { color: 0x39ff14, size: 500, intensity: 0.35, z: -700, speed: 0.0010, rotation: -0.0004 }
        ];

        const nebulaSprites = [];
        nebulaPresets.forEach((p, idx) => {
            const mat = createRadialSpriteMaterial(p.color, 1024, p.intensity);
            mat.color = new THREE.Color(p.color);
            // Tone down nebula opacity and use NormalBlending to avoid strong additive glow
            mat.opacity = 0.6;
            mat.blending = THREE.NormalBlending;
            const sprite = new THREE.Sprite(mat);
            const scale = (p.size / 256) * 3.0; // slightly smaller scale
            sprite.scale.set(scale * 20, scale * 10, 1.0);
            sprite.position.set((idx - 1.5) * 80, Math.sin(idx) * 20, p.z);
            sprite.renderOrder = 0;
            sprite.material.depthTest = false;
            nebulaGroup.add(sprite);
            nebulaSprites.push({ sprite, speed: p.speed, rotationSpeed: p.rotation });
        });

        // ---------- Subtle particles (reduced count & softer properties) ----------
        const isMobileLocal = window.innerWidth <= 768;
        // REDUCED: fewer particles on both desktop and mobile to improve smoothness
        const particleCount = isMobileLocal ? 80 : 200;
        const pGeo = new THREE.BufferGeometry();
        const pPos = new Float32Array(particleCount * 3);
        const pSpeed = new Float32Array(particleCount);
        for (let i = 0; i < particleCount; i++) {
            pPos[i*3] = (Math.random() - 0.5) * 800;
            pPos[i*3+1] = (Math.random() - 0.2) * 200;
            pPos[i*3+2] = -Math.random() * 1200;
            // REDUCED: slower and narrower speed range
            pSpeed[i] = 0.01 + Math.random() * 0.04;
        }
        pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
        pGeo.setAttribute('aSpeed', new THREE.BufferAttribute(pSpeed, 1));
        // use NormalBlending & lower opacity and smaller size to remove "glow"
        const pMat = new THREE.PointsMaterial({ color: 0xff3ba8, size: isMobileLocal ? 1.0 : 1.2, transparent: true, opacity: 0.45, blending: THREE.NormalBlending });
        const particles = new THREE.Points(pGeo, pMat);
        scene.add(particles);

        // ---------- EYE HUD ----------
        const eyeHUD = new THREE.Group(); camera.add(eyeHUD);
        const rotatingEye = new THREE.Group(); eyeHUD.add(rotatingEye);

        const scleraGeo = new THREE.IcosahedronGeometry(2.4, 2);
        const scleraMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.15 });
        const sclera = new THREE.Mesh(scleraGeo, scleraMat); rotatingEye.add(sclera);

        const irisGeo = new THREE.IcosahedronGeometry(0.9, 2);
        const irisMat = new THREE.MeshBasicMaterial({ color: 0xff3ba8, transparent: true, opacity: 0.9 });
        const iris = new THREE.Mesh(irisGeo, irisMat); iris.scale.z = 0.4; iris.position.z = 2.0; rotatingEye.add(iris);

        const pupilGeo = new THREE.IcosahedronGeometry(0.4, 2);
        const pupilMatLocal = new THREE.MeshBasicMaterial({ color: PUPIL_COLOR });
        const pupil = new THREE.Mesh(pupilGeo, pupilMatLocal); pupil.scale.z = 0.4; pupil.position.z = 2.3; rotatingEye.add(pupil);

        const lidRadius = 2.6; const lidSegments = 32;
        const lidMatSolid = new THREE.MeshBasicMaterial({ color: 0x000510, side: THREE.DoubleSide });
        const lidMatWire = new THREE.MeshBasicMaterial({ color: 0x7afcff, wireframe: true, transparent: true, opacity: 0.3 });

        const topLidGeo = new THREE.SphereGeometry(lidRadius, lidSegments, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const topLid = new THREE.Group(); topLid.add(new THREE.Mesh(topLidGeo, lidMatSolid)); topLid.add(new THREE.Mesh(topLidGeo, lidMatWire)); rotatingEye.add(topLid);

        const bottomLidGeo = new THREE.SphereGeometry(lidRadius, lidSegments, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
        const bottomLid = new THREE.Group(); bottomLid.add(new THREE.Mesh(bottomLidGeo, lidMatSolid)); bottomLid.add(new THREE.Mesh(bottomLidGeo, lidMatWire)); rotatingEye.add(bottomLid);

        // expose handles
        window.__eye = { rotatingEye, eyeHUD, sclera, iris, pupil };
        window.__three = { renderer, scene, camera, pMat, iris, sclera, pupil, composer, bloomPass, nebulaGroup };

        // Save original state (extend with nebula snapshot)
        saveOriginalLandscapeState(window.__three);
        try {
            if (!window.__three._orig) window.__three._orig = {};
            // store nebula originals
            window.__three._orig.nebula = nebulaSprites.map(n => {
                const mat = n.sprite && n.sprite.material;
                if (!mat) return null;
                return { color: mat.color ? mat.color.clone() : null, opacity: typeof mat.opacity !== 'undefined' ? mat.opacity : null, blending: mat.blending };
            });
        } catch (e) {}

        // --- Laser system & animation helpers (kept) ---
        const activeBeams = [];
        function fireLaserBetween(start, target) {
            if (!start || !target) return;
            const dir = new THREE.Vector3().subVectors(target, start);
            const length = Math.max(dir.length(), 0.001);
            const eyeScale = parseFloat(window.eyeSettings.eyeScale) || 1.0;
            const beamRadius = LASER.baseRadius * (LASER.sizeMultiplier || 1) * eyeScale;
            const cylGeo = new THREE.CylinderGeometry(beamRadius, beamRadius, length, 8, 1, true);
            const beamCol = (iris && iris.material && iris.material.color) ? iris.material.color.getHex() : (sectionColors.home instanceof THREE.Color ? sectionColors.home.getHex() : 0xff3ba8);
            const beamMat = new THREE.MeshBasicMaterial({ color: beamCol, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
            const beam = new THREE.Mesh(cylGeo, beamMat);

            const midpoint = new THREE.Vector3().addVectors(start, target).multiplyScalar(0.5);
            beam.position.copy(midpoint);
            const up = new THREE.Vector3(0, 1, 0);
            const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
            beam.quaternion.copy(q);

            const coreGeo = new THREE.CylinderGeometry(beamRadius * 0.5, beamRadius * 0.5, length, 8, 1, true);
            const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
            const core = new THREE.Mesh(coreGeo, coreMat);
            core.position.copy(midpoint);
            core.quaternion.copy(q);

            const group = new THREE.Group();
            group.add(beam);
            group.add(core);
            scene.add(group);

            activeBeams.push({ group, createdAt: performance.now()/1000, duration: LASER.duration });

            // Particle impact
            const ppArr = pGeo.attributes.position.array;
            const psArr = pGeo.attributes.aSpeed.array;
            const blastCenter = target;
            const r = LASER.radius;
            for (let i = 0; i < particleCount; i++) {
                const px = ppArr[i*3], py = ppArr[i*3+1], pz = ppArr[i*3+2];
                const dx = px - blastCenter.x, dy = py - blastCenter.y, dz = pz - blastCenter.z;
                const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                if (dist < r) {
                    const push = (1 - (dist / r)) * LASER.pushStrength * (0.5 + Math.random()*0.8);
                    const nx = dx / (dist + 0.0001), ny = dy / (dist + 0.0001), nz = dz / (dist + 0.0001);
                    ppArr[i*3] += nx * (push * 0.02);
                    ppArr[i*3+1] += ny * (push * 0.02);
                    ppArr[i*3+2] += nz * (push * 0.6);
                    psArr[i] = Math.min(5.0, psArr[i] + (push * 0.002));
                }
            }
            pGeo.attributes.position.needsUpdate = true;
            pGeo.attributes.aSpeed.needsUpdate = true;
        }

        function fireLaserFromEye() {
            try {
                const eyePupil = pupil || (window.__eye && window.__eye.pupil);
                if (!eyePupil) return;
                const start = new THREE.Vector3();
                eyePupil.getWorldPosition(start);
                const dir = new THREE.Vector3();
                eyePupil.getWorldDirection(dir);
                if (dir.lengthSq() < 1e-6 && rotatingEye) rotatingEye.getWorldDirection(dir);
                const distance = 600;
                const target = new THREE.Vector3().copy(start).add(dir.normalize().multiplyScalar(distance));
                fireLaserBetween(start, target);
            } catch (e) {
                console.warn('fireLaserFromEye failed', e);
            }
        }

        // animation vars & state (preserve previous behavior)
        const clock = new THREE.Clock();
        const posAttr = pGeo.attributes.position;
        const posAttrA = pGeo.attributes.aSpeed;

        const mouse = { x: 0, y: 0 };
        let lastInteractionTime = Date.now();
        function updateInput(x, y) { mouse.x = (x / window.innerWidth) * 2 - 1; mouse.y = (y / window.innerHeight) * 2 - 1; lastInteractionTime = Date.now(); }
        window.addEventListener('mousemove', (e) => updateInput(e.clientX, e.clientY));
        window.addEventListener('touchmove', (e) => { if (e.touches.length>0) updateInput(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
        window.addEventListener('touchstart', (e) => { if (e.touches.length>0) updateInput(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
        window.addEventListener('scroll', () => { lastInteractionTime = Date.now(); });

        let blinkStateLocal = { isBlinking: false, startTime: 0, duration: window.eyeSettings.blinkDuration || 0.25, nextBlinkTime: 0 };
        let lookOffsetXLocal = -0.6, lookOffsetYLocal = 0;
        let idleTargetRotation = { x: 0, y: 0 };
        let idleTargetPosition = new THREE.Vector3(6, 0, -15);
        let nextSaccadeTime = 0;
        let idleFocusScale = 1.0;

        const EMOTIONS_LOCAL = {
            NEUTRAL: { top: -Math.PI/6, bottom: Math.PI/6 },
            SUSPICIOUS: { top: -0.25, bottom: 0.25 },
            SURPRISED: { top: -0.9, bottom: 0.9 },
            TIRED: { top: -0.15, bottom: Math.PI/6 }
        };
        let currentEmotionLocal = EMOTIONS_LOCAL.NEUTRAL;
        let nextEmotionTimeLocal = 0;

        // convert sectionColors to THREE.Color if needed
        Object.keys(sectionColors).forEach(k => {
            const v = sectionColors[k];
            if (v && !(v instanceof THREE.Color)) {
                try { sectionColors[k] = new THREE.Color(v); } catch (e) { /* ignore */ }
            }
        });

        function getContent3DCoordinates() {
            const navTargets = Array.from(document.querySelectorAll('.nav-link'));
            const activePanel = document.querySelector('.panel.active');
            let contentTargets = [];
            if (activePanel) contentTargets = Array.from(activePanel.querySelectorAll('h1, h2, .project-card, .cert-card, .flip-card, .neon-btn'));
            const allTargets = [...navTargets, ...contentTargets];
            if (allTargets.length === 0) return null;
            const el = allTargets[Math.floor(Math.random()*allTargets.length)];
            if (!el) return null;
            const rect = el.getBoundingClientRect();
            if (rect.width===0 || rect.height===0) return null;
            const centerX = rect.left + rect.width/2;
            const centerY = rect.top + rect.height/2;
            const ndcX = (centerX / window.innerWidth)*2 - 1;
            const ndcY = -(centerY / window.innerHeight)*2 + 1;
            const targetX = ndcX * 35; const targetY = ndcY * 20;
            let focusScale = 1.0; const tag = el.tagName.toLowerCase();
            if (tag === 'h1' || tag === 'h2') focusScale = 1.4;
            else if (el.classList.contains('project-card') || el.classList.contains('cert-card')) focusScale = 1.0;
            else focusScale = 0.6;
            return { pos: new THREE.Vector3(targetX, targetY, -50), rot: { x: ndcY * -0.5, y: ndcX * 0.5 }, focusScale };
        }

        let defaultPosLocal = new THREE.Vector3(6,0,-15);

        function resizeLocal() {
            const w = window.innerWidth, h = window.innerHeight;
            if (canvas.width !== w || canvas.height !== h) {
                renderer.setSize(w, h, false);
                if (bloomActive && composer) composer.setSize(w, h);
                camera.aspect = w/h; camera.updateProjectionMatrix();
            }
            if (w <= 768) { defaultPosLocal.set(0,4.5,-20); lookOffsetXLocal = 0; lookOffsetYLocal = 0.35; eyeHUD.scale.set(0.7,0.7,0.7); }
            else { defaultPosLocal.set(6,0,-15); lookOffsetXLocal = -0.6; lookOffsetYLocal = 0; eyeHUD.scale.set(1,1,1); }
        }
        resizeLocal();

        // timers
        const tStart = clock.getElapsedTime();
        blinkStateLocal.duration = parseFloat(window.eyeSettings.blinkDuration) || blinkStateLocal.duration;
        blinkStateLocal.nextBlinkTime = tStart + randomBetween(parseFloat(window.eyeSettings.blinkMin) || DEFAULT_SETTINGS.blinkMin, parseFloat(window.eyeSettings.blinkMax) || DEFAULT_SETTINGS.blinkMax);
        nextEmotionTimeLocal = tStart + randomBetween(parseFloat(window.eyeSettings.emotionMin) || DEFAULT_SETTINGS.emotionMin, parseFloat(window.eyeSettings.emotionMax) || DEFAULT_SETTINGS.emotionMax);

        // Main animation loop
        function animateLocal() {
            requestAnimationFrame(animateLocal);
            const w = window.innerWidth, h = window.innerHeight;
            if (canvas.width !== w || canvas.height !== h) resizeLocal();

            const t = clock.getElapsedTime(); const now = Date.now();

            // update active beams: fade & remove
            const nowSec = performance.now()/1000;
            for (let i = activeBeams.length - 1; i >= 0; i--) {
                const b = activeBeams[i];
                const elapsed = nowSec - b.createdAt;
                const progress = Math.min(1, elapsed / b.duration);
                b.group.children.forEach(child => {
                    if (child.material) child.material.opacity = Math.max(0, 1 - progress);
                });
                if (progress >= 1) {
                    if (b.group.parent) b.group.parent.remove(b.group);
                    activeBeams.splice(i, 1);
                }
            }

            // animate nebula sprites (reduced motion)
            nebulaSprites.forEach((n, i) => {
                n.sprite.rotation += n.rotationSpeed;
                // smaller position oscillation to avoid heavy redraws
                n.sprite.position.x += Math.sin(t * n.speed + i) * (n.speed * 20) * 0.0015;
                n.sprite.position.y += Math.cos(t * n.speed + i*0.3) * (n.speed * 20) * 0.0015;
            });

            // particles motion (gentle, reduced speeds)
            const pp = posAttr.array; const ps = posAttrA.array;
            for (let i=0;i<particleCount;i++){
                pp[i*3+2] += ps[i];
                if (pp[i*3+2] > camera.position.z + 10) pp[i*3+2] = -1200 - Math.random() * 400;
            }
            posAttr.needsUpdate = true;

            // Eye iris + particle tint
            const tColor = (sectionColors[currentPanelId] instanceof THREE.Color) ? sectionColors[currentPanelId] : (sectionColors.home instanceof THREE.Color ? sectionColors.home : new THREE.Color(0xff3ba8));
            iris.material.color.lerp(tColor, 0.05);
            if (pMat) pMat.color.lerp(tColor, 0.05);
            nebulaSprites.forEach(n => {
                if (n.sprite && n.sprite.material && n.sprite.material.color) {
                    try { n.sprite.material.color.lerp(tColor, 0.01); n.sprite.material.needsUpdate = true; } catch(e){}
                }
            });

            // --- AI LOGIC (idle vs active) ---
            let targetRotY, targetRotX, targetPosVector, targetPupilScale;
            let moveSpeed = 0.05, rotSpeed = 0.08;

            if (now - lastInteractionTime > (window.eyeSettings.idleTimeout * 1000)) {
                // IDLE
                if (t > nextSaccadeTime) {
                    const data = getContent3DCoordinates();
                    if (data) {
                        idleTargetPosition.copy(data.pos);
                        idleTargetRotation.x = data.rot.y;
                        idleTargetRotation.y = data.rot.x;
                        idleFocusScale = data.focusScale;
                    } else {
                        idleTargetPosition.set((Math.random()-0.5)*40, (Math.random()-0.5)*20, -60);
                        idleFocusScale = 1.0;
                    }
                    const minS = Math.max(0.1, parseFloat(window.eyeSettings.saccadeMin) || DEFAULT_SETTINGS.saccadeMin);
                    const maxS = Math.max(minS, parseFloat(window.eyeSettings.saccadeMax) || DEFAULT_SETTINGS.saccadeMax);
                    nextSaccadeTime = t + minS + Math.random()*(maxS - minS);

                    if (!PREFERS_REDUCED_MOTION && Math.random() < LASER.chanceOnSaccade) {
                        fireLaserFromEye();
                    }
                }

                if (t > nextEmotionTimeLocal) {
                    const keys = Object.keys(EMOTIONS_LOCAL);
                    const randomKey = keys[Math.floor(Math.random()*keys.length)];
                    currentEmotionLocal = EMOTIONS_LOCAL[randomKey];
                    const minE = Math.max(0.1, parseFloat(window.eyeSettings.emotionMin) || DEFAULT_SETTINGS.emotionMin);
                    const maxE = Math.max(minE, parseFloat(window.eyeSettings.emotionMax) || DEFAULT_SETTINGS.emotionMax);
                    nextEmotionTimeLocal = t + minE + Math.random()*(maxE - minE);
                }

                targetPosVector = idleTargetPosition;
                targetRotY = idleTargetRotation.x;
                targetRotX = idleTargetRotation.y;
                targetPupilScale = idleFocusScale;
                moveSpeed = parseFloat(window.eyeSettings.idleMoveSpeed) || DEFAULT_SETTINGS.idleMoveSpeed;
                rotSpeed = parseFloat(window.eyeSettings.idleRotSpeed) || DEFAULT_SETTINGS.idleRotSpeed;
            } else {
                // ACTIVE
                targetPosVector = defaultPosLocal;
                currentEmotionLocal = EMOTIONS_LOCAL.NEUTRAL;
                targetRotY = (mouse.x * 0.4) + lookOffsetXLocal;
                targetRotX = (mouse.y * 0.4) + lookOffsetYLocal;
                const distToCenter = Math.sqrt(mouse.x*mouse.x + mouse.y*mouse.y);
                const pMin = parseFloat(window.eyeSettings.pupilMin) || DEFAULT_SETTINGS.pupilMin;
                const pMax = parseFloat(window.eyeSettings.pupilMax) || DEFAULT_SETTINGS.pupilMax;
                targetPupilScale = THREE.MathUtils.lerp(pMin, pMax, distToCenter);
                moveSpeed = parseFloat(window.eyeSettings.activeMoveSpeed) || DEFAULT_SETTINGS.activeMoveSpeed;
                rotSpeed = parseFloat(window.eyeSettings.activeRotSpeed) || DEFAULT_SETTINGS.activeRotSpeed;
            }

            if (rotatingEye) {
                eyeHUD.position.lerp(targetPosVector, moveSpeed);
                if (!PREFERS_REDUCED_MOTION) {
                    eyeHUD.position.x += Math.sin(t * 0.25) * 0.02;
                    eyeHUD.position.y += Math.sin(t) * 0.02;
                } else {
                    eyeHUD.position.y += Math.sin(t) * 0.01;
                }

                rotatingEye.rotation.y = THREE.MathUtils.lerp(rotatingEye.rotation.y, targetRotY, rotSpeed);
                rotatingEye.rotation.x = THREE.MathUtils.lerp(rotatingEye.rotation.x, targetRotX, rotSpeed);
                sclera.rotation.z = -t * 0.1;
                pupil.scale.set(THREE.MathUtils.lerp(pupil.scale.x, targetPupilScale, 0.1), THREE.MathUtils.lerp(pupil.scale.y, targetPupilScale, 0.1), 0.4);
                // enforce pupil black each frame
                try { if (pupil && pupil.material) { pupil.material.color.set(PUPIL_COLOR); pupil.material.needsUpdate = true; } } catch (e) {}
            }

            // --- Blink logic ---
            blinkStateLocal.duration = parseFloat(window.eyeSettings.blinkDuration) || blinkStateLocal.duration;
            if (!blinkStateLocal.isBlinking && t > blinkStateLocal.nextBlinkTime) {
                blinkStateLocal.isBlinking = true; blinkStateLocal.startTime = t;
            }
            let topAngle = currentEmotionLocal.top, bottomAngle = currentEmotionLocal.bottom;
            if (blinkStateLocal.isBlinking) {
                const elapsed = t - blinkStateLocal.startTime; const progress = elapsed / blinkStateLocal.duration;
                if (progress >= 1) {
                    blinkStateLocal.isBlinking = false;
                    const minB = Math.max(0.1, parseFloat(window.eyeSettings.blinkMin) || DEFAULT_SETTINGS.blinkMin);
                    const maxB = Math.max(minB, parseFloat(window.eyeSettings.blinkMax) || DEFAULT_SETTINGS.blinkMax);
                    blinkStateLocal.nextBlinkTime = t + minB + Math.random()*(maxB - minB);
                } else {
                    const closure = Math.sin(progress * Math.PI);
                    topAngle = THREE.MathUtils.lerp(currentEmotionLocal.top, 0.1, closure);
                    bottomAngle = THREE.MathUtils.lerp(currentEmotionLocal.bottom, -0.1, closure);
                }
            } else {
                topLid.rotation.x = THREE.MathUtils.lerp(topLid.rotation.x, topAngle, 0.05);
                bottomLid.rotation.x = THREE.MathUtils.lerp(bottomLid.rotation.x, bottomAngle, 0.05);
            }
            if (blinkStateLocal.isBlinking) { topLid.rotation.x = topAngle; bottomLid.rotation.x = bottomAngle; }

            // Render (no bloom for smoother perf)
            if (bloomActive && composer) {
                try { composer.render(); } catch (e) { console.error('Bloom render failed -> fallback', e); bloomActive = false; renderer.render(scene, camera); }
            } else { renderer.render(scene, camera); }
        }

        animateLocal();

    } // end initThreeJS
    // ------------------------
    // Settings UI: Desktop + Mobile
    // ------------------------
    function createSettingsPanel() {
        if (document.getElementById('settings')) return;
        if (isMobileLayout()) return;

        const styleId = 'settings-panel-styles';
        if (!document.getElementById(styleId)) {
            const s = document.createElement('style'); s.id = styleId;
            // NOTE: This CSS ensures the desktop settings panel is positioned, visible and scrollable.
            s.textContent = `
                /* Desktop settings panel placement + visible scrollable content */
                .panel#settings {
                    position: absolute;
                    top: 0;
                    right: 0;
                    width: 45%;
                    height: 100vh;
                    padding: 140px 50px 50px 50px; /* match other panels top padding */
                    box-sizing: border-box;
                    overflow-y: auto;
                    background: linear-gradient(90deg, rgba(0,5,16,0.9) 0%, rgba(0,5,16,0.5) 100%);
                    border-left: 1px solid rgba(122,252,255,0.05);
                    z-index: 1200;
                    -webkit-overflow-scrolling: touch;
                }
                .settings-inner { max-width: 980px; margin: 0 auto; color: #dfeffd; opacity: 0; animation: settingsFade 0.38s var(--ease-smooth) forwards; transform-origin: top left; }
                .settings-grid { display:flex; gap:20px; flex-wrap:wrap; }
                .settings-column { flex:1 1 320px; background: rgba(6,10,20,0.7); padding:16px; border-radius:10px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); transition: transform 0.3s var(--ease-smooth); }
                .settings-column:hover { transform: translateY(-2px); }
                .settings-column h3 { margin-top:0; color:#9fdcff; font-size:16px; }
                .setting-row { display:flex; align-items:center; gap:10px; margin:8px 0; }
                .setting-row label { flex:1; font-size:13px; color:#bfefff; }
                .setting-row input[type="range"]{ flex:1 1 180px; cursor: pointer; }
                .setting-row .val { width:56px; text-align:right; color:#bfefff; font-size:12px; }
                .settings-actions { display:flex; gap:8px; margin-top:12px; }
                .btn { background:#0b2b3a; color:#bfefff; border:none; padding:8px 10px; border-radius:8px; cursor:pointer; transition: background 0.2s ease, transform 0.2s ease; }
                .btn:hover { background: #0f3a4e; transform: translateY(-1px); }

                @keyframes settingsFade {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* Hide on small screens (mobile uses overlay instead) */
                @media (max-width: 768px) {
                    .panel#settings { display: none !important; }
                }
            `;
            document.head.appendChild(s);
        }

        const panel = document.createElement('section');
        panel.id = 'settings';
        panel.className = 'panel hidden';
        panel.setAttribute('aria-label','Settings');

        panel.innerHTML = `
            <div class="settings-inner">
                <h1 class="section-title">Settings</h1>
                <div class="settings-grid">
                    <div class="settings-column" id="settings-controls">
                        <h3>Eye Behavior</h3>
                        <div class="setting-row"><label for="idleTimeoutRange">Idle timeout (s)</label><input id="idleTimeoutRange" type="range" min="3" max="60" step="1"><div class="val" id="idleTimeoutVal"></div></div>
                        <div class="setting-row"><label for="idleMoveSpeedRange">Idle move speed</label><input id="idleMoveSpeedRange" type="range" min="0.001" max="0.2" step="0.001"><div class="val" id="idleMoveSpeedVal"></div></div>
                        <div class="setting-row"><label for="idleRotSpeedRange">Idle rot speed</label><input id="idleRotSpeedRange" type="range" min="0.001" max="0.2" step="0.001"><div class="val" id="idleRotSpeedVal"></div></div>
                        <div class="setting-row"><label for="activeMoveSpeedRange">Active move speed</label><input id="activeMoveSpeedRange" type="range" min="0.01" max="0.3" step="0.001"><div class="val" id="activeMoveSpeedVal"></div></div>
                        <div class="setting-row"><label for="activeRotSpeedRange">Active rot speed</label><input id="activeRotSpeedRange" type="range" min="0.01" max="0.3" step="0.001"><div class="val" id="activeRotSpeedVal"></div></div>

                        <h3 style="margin-top:14px">Eye Size & Shape</h3>
                        <div class="setting-row"><label for="eyeScaleRange">Eye depth (scale)</label><input id="eyeScaleRange" type="range" min="0.5" max="2.0" step="0.01"><div class="val" id="eyeScaleVal"></div></div>
                        <div class="setting-row"><label for="eyeWidthRange">Eye width</label><input id="eyeWidthRange" type="range" min="0.6" max="1.8" step="0.01"><div class="val" id="eyeWidthVal"></div></div>
                        <div class="setting-row"><label for="eyeHeightRange">Eye height</label><input id="eyeHeightRange" type="range" min="0.6" max="1.8" step="0.01"><div class="val" id="eyeHeightVal"></div></div>

                        <h3 style="margin-top:14px">Laser</h3>
                        <div class="setting-row"><label for="laserSizeRange">Laser size</label><input id="laserSizeRange" type="range" min="0.2" max="3.0" step="0.05"><div class="val" id="laserSizeVal"></div></div>

                        <h3 style="margin-top:14px">Saccades & Pupil</h3>
                        <div class="setting-row"><label for="saccadeMinRange">Saccade min (s)</label><input id="saccadeMinRange" type="range" min="0.2" max="10" step="0.1"><div class="val" id="saccadeMinVal"></div></div>
                        <div class="setting-row"><label for="saccadeMaxRange">Saccade max (s)</label><input id="saccadeMaxRange" type="range" min="0.5" max="15" step="0.1"><div class="val" id="saccadeMaxVal"></div></div>
                        <div class="setting-row"><label for="pupilMinRange">Pupil min</label><input id="pupilMinRange" type="range" min="0.3" max="1.2" step="0.01"><div class="val" id="pupilMinVal"></div></div>
                        <div class="setting-row"><label for="pupilMaxRange">Pupil max</label><input id="pupilMaxRange" type="range" min="0.5" max="2.0" step="0.01"><div class="val" id="pupilMaxVal"></div></div>
                    </div>

                    <div class="settings-column" id="settings-advanced">
                        <h3>Blinks & Emotions</h3>
                        <div class="setting-row"><label for="blinkMinRange">Blink min (s)</label><input id="blinkMinRange" type="range" min="0.2" max="8" step="0.1"><div class="val" id="blinkMinVal"></div></div>
                        <div class="setting-row"><label for="blinkMaxRange">Blink max (s)</label><input id="blinkMaxRange" type="range" min="0.5" max="12" step="0.1"><div class="val" id="blinkMaxVal"></div></div>
                        <div class="setting-row"><label for="blinkDurationRange">Blink duration (s)</label><input id="blinkDurationRange" type="range" min="0.05" max="1.0" step="0.01"><div class="val" id="blinkDurationVal"></div></div>

                        <div style="height:12px"></div>

                        <div class="setting-row"><label for="emotionMinRange">Emotion min (s)</label><input id="emotionMinRange" type="range" min="1" max="10" step="0.1"><div class="val" id="emotionMinVal"></div></div>
                        <div class="setting-row"><label for="emotionMaxRange">Emotion max (s)</label><input id="emotionMaxRange" type="range" min="2" max="20" step="0.1"><div class="val" id="emotionMaxVal"></div></div>

                        <h3 style="margin-top:14px">Appearance</h3>
                        <div class="setting-row"><label for="presetSelect">Color preset</label><select id="presetSelect" style="flex:1 1 auto;"></select><div class="val" id="presetVal" style="width:auto;"></div></div>

                        <div class="settings-actions"><button id="saveSettingsBtn" class="btn">Save</button><button id="resetSettingsBtn" class="btn">Reset</button></div>
                    </div>
                </div>
            </div>
        `;
        (document.querySelector('main') || document.body).appendChild(panel);

        const presetSelect = panel.querySelector('#presetSelect');
        Object.keys(COLOR_PRESETS).forEach(k => {
            const o = document.createElement('option'); o.value = k; o.textContent = k.charAt(0).toUpperCase()+k.slice(1);
            if (window.eyeSettings.colorPreset === k) o.selected = true;
            presetSelect.appendChild(o);
        });
        panel.querySelector('#presetVal').textContent = window.eyeSettings.colorPreset;

        function wireRangeLocal(id, key, display, cast=parseFloat, prec=null, onChange=null) {
            const input = panel.querySelector(`#${id}`); const displayEl = panel.querySelector(`#${display}`);
            if (!input || !displayEl) return;
            input.value = window.eyeSettings[key];
            const update = ()=>{ const val = cast(input.value); window.eyeSettings[key]=val; displayEl.textContent = (prec!==null)?Number(val).toFixed(prec):String(val).replace(/\.?0+$/,''); saveSettings(); if (typeof onChange === 'function') onChange(val); };
            input.addEventListener('input', update); input.addEventListener('change', update); update();
        }

        // wire fields (including laserSize)
        wireRangeLocal('idleTimeoutRange','idleTimeout','idleTimeoutVal', v=>parseInt(v,10), 0);
        wireRangeLocal('idleMoveSpeedRange','idleMoveSpeed','idleMoveSpeedVal', parseFloat, 3);
        wireRangeLocal('idleRotSpeedRange','idleRotSpeed','idleRotSpeedVal', parseFloat, 3);
        wireRangeLocal('activeMoveSpeedRange','activeMoveSpeed','activeMoveSpeedVal', parseFloat, 3);
        wireRangeLocal('activeRotSpeedRange','activeRotSpeed','activeRotSpeedVal', parseFloat, 3);

        wireRangeLocal('eyeScaleRange','eyeScale','eyeScaleVal', parseFloat, 2, applyEyeSize);
        wireRangeLocal('eyeWidthRange','eyeWidth','eyeWidthVal', parseFloat, 2, applyEyeSize);
        wireRangeLocal('eyeHeightRange','eyeHeight','eyeHeightVal', parseFloat, 2, applyEyeSize);

        wireRangeLocal('laserSizeRange','laserSize','laserSizeVal', parseFloat, 2, (v)=>{ applyLaserSize(); });

        wireRangeLocal('saccadeMinRange','saccadeMin','saccadeMinVal', parseFloat, 1);
        wireRangeLocal('saccadeMaxRange','saccadeMax','saccadeMaxVal', parseFloat, 1);
        wireRangeLocal('pupilMinRange','pupilMin','pupilMinVal', parseFloat, 2);
        wireRangeLocal('pupilMaxRange','pupilMax','pupilMaxVal', parseFloat, 2);

        wireRangeLocal('blinkMinRange','blinkMin','blinkMinVal', parseFloat, 1);
        wireRangeLocal('blinkMaxRange','blinkMax','blinkMaxVal', parseFloat, 1);
        wireRangeLocal('blinkDurationRange','blinkDuration','blinkDurationVal', parseFloat, 2);

        wireRangeLocal('emotionMinRange','emotionMin','emotionMinVal', parseFloat, 1);
        wireRangeLocal('emotionMaxRange','emotionMax','emotionMaxVal', parseFloat, 1);

        presetSelect.addEventListener('change', (e) => {
            window.eyeSettings.colorPreset = e.target.value;
            panel.querySelector('#presetVal').textContent = e.target.value;
            applyColorPreset(e.target.value);
            saveSettings();
        });

        panel.querySelector('#saveSettingsBtn').addEventListener('click', () => { saveSettings(); const btn = panel.querySelector('#saveSettingsBtn'); const prev = btn.textContent; btn.textContent='Saved'; setTimeout(()=>btn.textContent=prev,900); });

        panel.querySelector('#resetSettingsBtn').addEventListener('click', () => {
            Object.assign(window.eyeSettings, DEFAULT_SETTINGS); saveSettings();
            const inputs = panel.querySelectorAll('input, select'); inputs.forEach(inp => {
                if (!inp.id) return;
                const map = {
                    idleTimeoutRange:'idleTimeout', idleMoveSpeedRange:'idleMoveSpeed', idleRotSpeedRange:'idleRotSpeed',
                    activeMoveSpeedRange:'activeMoveSpeed', activeRotSpeedRange:'activeRotSpeed',
                    eyeScaleRange:'eyeScale', eyeWidthRange:'eyeWidth', eyeHeightRange:'eyeHeight',
                    laserSizeRange:'laserSize',
                    saccadeMinRange:'saccadeMin', saccadeMaxRange:'saccadeMax',
                    pupilMinRange:'pupilMin', pupilMaxRange:'pupilMax',
                    blinkMinRange:'blinkMin', blinkMaxRange:'blinkMax', blinkDurationRange:'blinkDuration',
                    emotionMinRange:'emotionMin', emotionMaxRange:'emotionMax', presetSelect:'colorPreset'
                };
                if (map[inp.id]) { inp.value = window.eyeSettings[map[inp.id]]; inp.dispatchEvent(new Event('input')); inp.dispatchEvent(new Event('change')); }
            });
            applyColorPreset(window.eyeSettings.colorPreset);
            applyEyeSize();
            applyLaserSize();
        });
    }

    function createMobileSettingsPage() {
        if (document.getElementById('settings-mobile')) return;
        const styleId = 'settings-mobile-styles';
        if (!document.getElementById(styleId)) {
            const st = document.createElement('style'); st.id = styleId;
            st.textContent = `
                #settings-mobile { position:fixed; inset:0; background:#050811; color:#dfeffd; z-index:11000; overflow:auto; padding:18px; display:none; -webkit-overflow-scrolling:touch; opacity: 0; transition: opacity 0.3s var(--ease-smooth); }
                #settings-mobile.open { display: block; opacity: 1; }
                #settings-mobile .mobile-header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
                #settings-mobile h1 { margin:0; font-size:18px; color:#9fdcff; }
                #settings-mobile .mobile-close { background:transparent; border:0; color:#bfefff; font-size:20px; padding:8px; }
                #settings-mobile .mobile-content { max-width:820px; margin:0 auto; }
                .mobile-setting-row { display:flex; align-items:center; gap:12px; margin:10px 0; }
                .mobile-setting-row label { flex:1; font-size:14px; color:#bfefff; }
                .mobile-setting-row input[type="range"]{ flex:1.1; }
                .mobile-setting-row .val { width:56px; text-align:right; color:#bfefff; font-size:13px; }
                .mob-actions { display:flex; gap:10px; margin-top:16px; }
                .btn { background:#0b2b3a; color:#bfefff; border:none; padding:10px 12px; border-radius:8px; cursor:pointer; }

                /* preview area */
                #settings-mobile-preview { margin-top:18px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.03); display:flex; justify-content:center; flex-direction:column; gap:10px; }
                #settings-mobile-preview .preview-wrap { width:100%; max-width:420px; height:160px; display:flex; align-items:center; justify-content:center; background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.15)); border-radius:10px; position:relative; }
                #preview-canvas { width:100%; height:100%; display:block; border-radius:8px; }
                #preview-label { position:absolute; left:10px; top:8px; color:#9fdcff; font-size:12px; opacity:0.9; }
                .preview-controls { display:flex; align-items:center; gap:8px; justify-content:center; }
                .preview-controls label { font-size:13px; color:#bfefff; }
            `;
            document.head.appendChild(st);
        }

        const mobile = document.createElement('div'); mobile.id = 'settings-mobile';
        mobile.innerHTML = `
            <div class="mobile-header">
                <h1>Settings</h1>
                <div>
                    <button class="btn" id="settings-mobile-save">Save</button>
                    <button class="btn" id="settings-mobile-reset">Reset</button>
                    <button class="mobile-close" id="settings-mobile-close">✕</button>
                </div>
            </div>
            <div class="mobile-content">
                <div class="mobile-section">
                    <h3 style="color:#9fdcff">Appearance</h3>
                    <div class="mobile-setting-row"><label for="mobile-presetSelect">Color preset</label><select id="mobile-presetSelect"></select><div class="val" id="mobile-presetVal"></div></div>
                </div>

                <div style="height:12px"></div>

                <div class="mobile-section">
                    <h3 style="color:#9fdcff">Eye Behavior & Size</h3>
                    <div class="mobile-setting-row"><label for="mobile-idleTimeoutRange">Idle timeout (s)</label><input id="mobile-idleTimeoutRange" type="range" min="3" max="60" step="1"><div class="val" id="mobile-idleTimeoutVal"></div></div>
                    <div class="mobile-setting-row"><label for="mobile-eyeScaleRange">Eye depth (scale)</label><input id="mobile-eyeScaleRange" type="range" min="0.5" max="2.0" step="0.01"><div class="val" id="mobile-eyeScaleVal"></div></div>
                    <div class="mobile-setting-row"><label for="mobile-eyeWidthRange">Eye width</label><input id="mobile-eyeWidthRange" type="range" min="0.6" max="1.8" step="0.01"><div class="val" id="mobile-eyeWidthVal"></div></div>
                    <div class="mobile-setting-row"><label for="mobile-eyeHeightRange">Eye height</label><input id="mobile-eyeHeightRange" type="range" min="0.6" max="1.8" step="0.01"><div class="val" id="mobile-eyeHeightVal"></div></div>
                    <div class="mobile-setting-row"><label for="mobile-laserSizeRange">Laser size</label><input id="mobile-laserSizeRange" type="range" min="0.2" max="3.0" step="0.05"><div class="val" id="mobile-laserSizeVal"></div></div>
                </div>

                <div style="height:12px"></div>

                <div class="mobile-section">
                    <h3 style="color:#9fdcff">Blinks & Emotions</h3>
                    <div class="mobile-setting-row"><label for="mobile-blinkMinRange">Blink min (s)</label><input id="mobile-blinkMinRange" type="range" min="0.2" max="8" step="0.1"><div class="val" id="mobile-blinkMinVal"></div></div>
                    <div class="mobile-setting-row"><label for="mobile-blinkMaxRange">Blink max (s)</label><input id="mobile-blinkMaxRange" type="range" min="0.5" max="12" step="0.1"><div class="val" id="mobile-blinkMaxVal"></div></div>
                    <div class="mobile-setting-row"><label for="mobile-blinkDurationRange">Blink duration (s)</label><input id="mobile-blinkDurationRange" type="range" min="0.05" max="1.0" step="0.01"><div class="val" id="mobile-blinkDurationVal"></div></div>
                </div>

                <div id="settings-mobile-preview">
                    <div class="preview-controls">
                        <label><input type="checkbox" id="mobile-previewToggle"> Live preview</label>
                        <div style="font-size:12px;color:#9fdcff;">(turn off to save battery)</div>
                    </div>
                    <div class="preview-wrap">
                        <div id="preview-label">Eye preview</div>
                        <canvas id="preview-canvas" width="420" height="160"></canvas>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(mobile);

        const presetSelect = mobile.querySelector('#mobile-presetSelect');
        Object.keys(COLOR_PRESETS).forEach(k => {
            const o = document.createElement('option'); o.value = k; o.textContent = k.charAt(0).toUpperCase()+k.slice(1);
            if (window.eyeSettings.colorPreset === k) o.selected = true;
            presetSelect.appendChild(o);
        });
        mobile.querySelector('#mobile-presetVal').textContent = window.eyeSettings.colorPreset;

        function wireMobileRange(id,key,display,cast=parseFloat,prec=null,onChange=null){
            const input = mobile.querySelector(`#${id}`), displayEl = mobile.querySelector(`#${display}`);
            if (!input || !displayEl) return;
            input.value = window.eyeSettings[key];
            const update = ()=>{ const val = cast(input.value); window.eyeSettings[key]=val; displayEl.textContent = (prec!==null)?Number(val).toFixed(prec):String(val).replace(/\.?0+$/,''); if (typeof onChange === 'function') onChange(val); };
            input.addEventListener('input',update); input.addEventListener('change',update); update();
        }

        // mobile wiring including laser size
        wireMobileRange('mobile-idleTimeoutRange','idleTimeout','mobile-idleTimeoutVal', v=>parseInt(v,10),0);
        wireMobileRange('mobile-eyeScaleRange','eyeScale','mobile-eyeScaleVal', parseFloat,2, applyEyeSize);
        wireMobileRange('mobile-eyeWidthRange','eyeWidth','mobile-eyeWidthVal', parseFloat,2, applyEyeSize);
        wireMobileRange('mobile-eyeHeightRange','eyeHeight','mobile-eyeHeightVal', parseFloat,2, applyEyeSize);

        wireMobileRange('mobile-laserSizeRange','laserSize','mobile-laserSizeVal', parseFloat,2, ()=>{ applyLaserSize(); });

        wireMobileRange('mobile-blinkMinRange','blinkMin','mobile-blinkMinVal', parseFloat,1);
        wireMobileRange('mobile-blinkMaxRange','blinkMax','mobile-blinkMaxVal', parseFloat,1);
        wireMobileRange('mobile-blinkDurationRange','blinkDuration','mobile-blinkDurationVal', parseFloat,2);

        presetSelect.addEventListener('change',(e)=>{ window.eyeSettings.colorPreset = e.target.value; mobile.querySelector('#mobile-presetVal').textContent = e.target.value; applyColorPreset(e.target.value); saveSettings(); updateMobileSettingsAppearance(); updateMobilePreview(); });

        mobile.querySelector('#settings-mobile-save').addEventListener('click', ()=>{ saveSettings(); const btn = mobile.querySelector('#settings-mobile-save'); const prev = btn.textContent; btn.textContent='Saved'; setTimeout(()=>btn.textContent=prev,800); });

        // ===== FIXED: Mobile Reset Handler =====
        mobile.querySelector('#settings-mobile-reset').addEventListener('click', ()=> {
            // Reset stored settings and UI elements to defaults
            Object.assign(window.eyeSettings, DEFAULT_SETTINGS);
            // Reset mobile preview enabled flag to default behavior
            const defaultMobilePreview = (!PREFERS_REDUCED_MOTION);
            setMobilePreviewEnabled(defaultMobilePreview);
            saveSettings();

            // Map of mobile input/select IDs to eyeSettings keys
            const map = {
                'mobile-idleTimeoutRange':'idleTimeout',
                'mobile-eyeScaleRange':'eyeScale',
                'mobile-eyeWidthRange':'eyeWidth',
                'mobile-eyeHeightRange':'eyeHeight',
                'mobile-laserSizeRange':'laserSize',
                'mobile-blinkMinRange':'blinkMin',
                'mobile-blinkMaxRange':'blinkMax',
                'mobile-blinkDurationRange':'blinkDuration',
                'mobile-presetSelect':'colorPreset'
            };

            const inputs = mobile.querySelectorAll('input, select');
            inputs.forEach(inp => {
                if (!inp.id) return;
                // handle preview toggle (checkbox) specially
                if (inp.id === 'mobile-previewToggle') {
                    inp.checked = window.__mobilePreviewEnabled && !PREFERS_REDUCED_MOTION;
                    // dispatch change so that preview starts/stops according to new state
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                    return;
                }
                if (map[inp.id]) {
                    const key = map[inp.id];
                    // For select -> set string value, for input range -> set numeric/string value
                    inp.value = window.eyeSettings[key];
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                    inp.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });

            // Ensure color preset UI and threejs apply
            const preset = window.eyeSettings.colorPreset || DEFAULT_SETTINGS.colorPreset;
            const presetEl = mobile.querySelector('#mobile-presetSelect');
            if (presetEl) { presetEl.value = preset; presetEl.dispatchEvent(new Event('change', { bubbles: true })); }

            applyColorPreset(window.eyeSettings.colorPreset);
            updateMobileSettingsAppearance();
            applyEyeSize();
            applyLaserSize();

            // Start/stop/init preview according to enabled flag
            const p = mobile.__preview;
            if (window.__mobilePreviewEnabled && !PREFERS_REDUCED_MOTION) {
                if (p && typeof p.start === 'function') p.start();
                else initMobilePreview();
            } else {
                if (p && typeof p.stop === 'function') p.stop();
            }
        });

        // Close button
        mobile.querySelector('#settings-mobile-close').addEventListener('click', ()=>{ closeMobileSettingsPage(); history.back(); });

        function updateMobileSettingsAppearance(){ const preset = COLOR_PRESETS[window.eyeSettings.colorPreset]||COLOR_PRESETS.neon; const accent = preset.home||'#ff3ba8'; const header = mobile.querySelector('.mobile-header'); if (header) header.style.borderBottom = `4px solid ${accent}`; if (typeof THREE!=='undefined') try{ sectionColors.settings = new THREE.Color(accent); }catch(e){ sectionColors.settings = accent; } }
        updateMobileSettingsAppearance();

        // --- Eye preview implementation (re-uses exact site eye if available) ---
        let preview = { renderer: null, scene: null, camera: null, eyeClone: null, irisMats: [], pupilMeshes: [], animId: null, resizeObserver: null, lastTime: performance.now(), looping:false };

        function cloneMeshMaterialsAndGeometries(src) {
            src.traverse((node) => {
                if (node.isMesh) {
                    if (node.material) {
                        if (Array.isArray(node.material)) {
                            node.material = node.material.map(m => m.clone());
                        } else {
                            node.material = node.material.clone();
                        }
                    }
                }
            });
        }

        function initMobilePreview() {
            if (typeof THREE === 'undefined') return;
            const canvas = document.getElementById('preview-canvas');
            if (!canvas) return;

            if (preview.renderer) {
                preview.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
                // start preview if enabled
                if (window.__mobilePreviewEnabled && !PREFERS_REDUCED_MOTION) preview.start && preview.start();
                return;
            }

            const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
            renderer.setClearColor(0x000000, 0);

            const scene = new THREE.Scene();

            const cam = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
            cam.position.set(0, 0, 10);
            scene.add(cam);

            preview.renderer = renderer;
            preview.scene = scene;
            preview.camera = cam;

            function tryUseRealEye() {
                if (window.__eye && window.__eye.rotatingEye) {
                    try {
                        const realEye = window.__eye.rotatingEye;
                        const eyeClone = realEye.clone(true);
                        cloneMeshMaterialsAndGeometries(eyeClone);
                        eyeClone.position.set(0, 0, 0);
                        eyeClone.rotation.set(0, 0, 0);
                        eyeClone.scale.set(1,1,1);
                        preview.scene.add(eyeClone);
                        preview.eyeClone = eyeClone;
                        preview.irisMats = [];
                        preview.pupilMeshes = [];
                        eyeClone.traverse((n) => {
                            if (n.isMesh && n.material) {
                                const hex = (n.material.color && n.material.color.getHex) ? n.material.color.getHex() : null;
                                if (hex === 0x000000) preview.pupilMeshes.push(n);
                                else preview.irisMats.push(n.material);
                            }
                        });
                        preview.pupilMeshes.forEach(pm => { try { if (pm.material && pm.material.color) pm.material.color.set(PUPIL_COLOR); } catch(e){} });
                        updateMobilePreview();
                        return true;
                    } catch (e) {
                        console.warn('Failed to clone real eye for preview, falling back to simple eye.', e);
                    }
                }
                return false;
            }

            let usedRealEye = tryUseRealEye();

            if (!usedRealEye) {
                const eyeGroup = new THREE.Group();
                const scleraG = new THREE.SphereGeometry(1.8, 16, 16);
                const scleraM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, wireframe: true });
                const scleraMesh = new THREE.Mesh(scleraG, scleraM); eyeGroup.add(scleraMesh);

                const irisG = new THREE.SphereGeometry(0.7, 16, 16);
                const irisM = new THREE.MeshBasicMaterial({ color: COLOR_PRESETS[window.eyeSettings.colorPreset].home || 0xff3ba8, transparent: true, opacity: 0.95 });
                const irisMesh = new THREE.Mesh(irisG, irisM); irisMesh.position.z = 1.2; irisMesh.scale.z = 0.5; eyeGroup.add(irisMesh);

                const pupilG = new THREE.SphereGeometry(0.3, 12, 12);
                const pupilM = new THREE.MeshBasicMaterial({ color: PUPIL_COLOR });
                const pupilMesh = new THREE.Mesh(pupilG, pupilM); pupilMesh.position.z = 1.35; pupilMesh.scale.z = 0.5; eyeGroup.add(pupilMesh);

                const lidMat = new THREE.MeshBasicMaterial({ color: 0x000510, side: THREE.DoubleSide });
                const lidTopG = new THREE.PlaneGeometry(4, 2);
                const lidTop = new THREE.Mesh(lidTopG, lidMat); lidTop.position.set(0, 0.9, 0.6); lidTop.rotation.x = -0.5; eyeGroup.add(lidTop);
                const lidBottom = new THREE.Mesh(lidTopG, lidMat); lidBottom.position.set(0, -0.9, 0.6); lidBottom.rotation.x = 0.5; eyeGroup.add(lidBottom);

                eyeGroup.rotation.x = 0;
                preview.scene.add(eyeGroup);
                preview.eyeClone = eyeGroup;
                preview.irisMats = [irisM];
                preview.pupilMeshes = [pupilMesh];
            }

            function loop() {
                preview.lastTime = performance.now();
                const time = preview.lastTime / 1000;
                if (preview.eyeClone) {
                    preview.eyeClone.rotation.y = Math.sin(time * 0.6) * 0.08;
                    preview.eyeClone.rotation.x = Math.sin(time * 0.4) * 0.04;
                }
                const pmin = parseFloat(window.eyeSettings.pupilMin) || DEFAULT_SETTINGS.pupilMin;
                const pmax = parseFloat(window.eyeSettings.pupilMax) || DEFAULT_SETTINGS.pupilMax;
                const pscale = (pmin + pmax) / 2;
                preview.pupilMeshes.forEach(pm => {
                    pm.scale.x = THREE.MathUtils.lerp(pm.scale.x || 1, pscale, 0.1);
                    pm.scale.y = THREE.MathUtils.lerp(pm.scale.y || 1, pscale, 0.1);
                    try { if (pm.material && pm.material.color) pm.material.color.set(PUPIL_COLOR); } catch(e){}
                });

                preview.renderer.render(preview.scene, preview.camera);
                preview.animId = requestAnimationFrame(loop);
                preview.looping = true;
            }

            function startPreview() {
                if (preview.animId || !preview.renderer) return;
                if (!window.__mobilePreviewEnabled || PREFERS_REDUCED_MOTION) return;
                preview.animId = requestAnimationFrame(loop);
            }
            function stopPreview() {
                if (preview.animId) cancelAnimationFrame(preview.animId);
                preview.animId = null;
                preview.looping = false;
            }

            preview.start = startPreview;
            preview.stop = stopPreview;

            const ro = new ResizeObserver(() => {
                if (!preview.renderer) return;
                const w = canvas.clientWidth, h = canvas.clientHeight;
                preview.renderer.setSize(w, h, false);
                preview.camera.aspect = w / h;
                preview.camera.updateProjectionMatrix();
            });
            ro.observe(canvas);
            preview.resizeObserver = ro;

            // Start automatically if user preference allows it
            if (window.__mobilePreviewEnabled && !PREFERS_REDUCED_MOTION) startPreview();

            mobile.__preview = preview;
        }

        function updateMobilePreview() {
            const previewLocal = mobile.__preview;
            if (!previewLocal) return;
            try {
                const presetKey = window.eyeSettings.colorPreset || DEFAULT_SETTINGS.colorPreset;
                const preset = COLOR_PRESETS[presetKey] || COLOR_PRESETS.neon;
                previewLocal.irisMats.forEach(mat => {
                    if (mat && mat.color) {
                        mat.color.set(preset.home);
                        if (typeof mat.opacity !== 'undefined') mat.opacity = 0.95;
                    }
                });
                const w = parseFloat(window.eyeSettings.eyeWidth) || 1.0;
                const h = parseFloat(window.eyeSettings.eyeHeight) || 1.0;
                const s = parseFloat(window.eyeSettings.eyeScale) || 1.0;
                if (previewLocal.eyeClone) previewLocal.eyeClone.scale.set(w, h, s);

                const pmin = parseFloat(window.eyeSettings.pupilMin) || DEFAULT_SETTINGS.pupilMin;
                const pmax = parseFloat(window.eyeSettings.pupilMax) || DEFAULT_SETTINGS.pupilMax;
                const pscale = (pmin + pmax) / 2;
                previewLocal.pupilMeshes.forEach(pm => {
                    if (pm) {
                        pm.scale.set(pscale, pscale, pm.scale.z || 1);
                        try { if (pm.material && pm.material.color) pm.material.color.set(PUPIL_COLOR); } catch(e){}
                    }
                });
            } catch (e) {
                console.warn('updateMobilePreview failed', e);
            }
        }

        if (typeof THREE !== 'undefined') {
            initMobilePreview();
        } else {
            const checkThree = setInterval(() => {
                if (typeof THREE !== 'undefined') {
                    clearInterval(checkThree);
                    initMobilePreview();
                }
            }, 250);
        }

        const previewToggle = mobile.querySelector('#mobile-previewToggle');
        if (previewToggle) {
            // Initialize checked state from saved preference (respect reduced motion)
            previewToggle.checked = window.__mobilePreviewEnabled && !PREFERS_REDUCED_MOTION;
            previewToggle.addEventListener('change', (e) => {
                const enabled = !!e.target.checked;
                setMobilePreviewEnabled(enabled);
                const p = mobile.__preview;
                if (p) {
                    if (enabled && !PREFERS_REDUCED_MOTION) p.start();
                    else p.stop();
                } else {
                    if (enabled && !PREFERS_REDUCED_MOTION) initMobilePreview();
                }
            });
        }

        const previewTriggers = [
            'mobile-eyeScaleRange','mobile-eyeWidthRange','mobile-eyeHeightRange','mobile-presetSelect',
            'mobile-laserSizeRange','mobile-blinkDurationRange','mobile-blinkMinRange','mobile-blinkMaxRange',
            'mobile-idleTimeoutRange'
        ];
        previewTriggers.forEach(id => {
            const el = mobile.querySelector('#' + id);
            if (!el) return;
            el.addEventListener('input', () => {
                applyColorPreset(window.eyeSettings.colorPreset);
                applyEyeSize();
                applyLaserSize();
                updateMobilePreview();
            });
        });

        if (PREFERS_REDUCED_MOTION) {
            setMobilePreviewEnabled(false);
            const pt = mobile.querySelector('#mobile-previewToggle');
            if (pt) { pt.checked = false; pt.disabled = true; pt.parentElement.title = 'Disabled due to Reduced Motion preference'; }
        }

        function cleanupPreview() {
            const previewLocal = mobile.__preview;
            if (!previewLocal || !previewLocal.renderer) return;
            if (previewLocal.animId) cancelAnimationFrame(previewLocal.animId);
            if (previewLocal.resizeObserver) previewLocal.resizeObserver.disconnect();
            try {
                previewLocal.scene.traverse((o) => {
                    if (o.geometry) { o.geometry.dispose && o.geometry.dispose(); }
                    if (o.material) {
                        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose && m.dispose());
                        else o.material.dispose && o.material.dispose();
                    }
                    if (o.dispose) try { o.dispose(); } catch(e){}
                });
                previewLocal.renderer.dispose();
            } catch (e) { /* ignore cleanup errors */ }
            mobile.__preview = null;
        }

        mobile.querySelector('#settings-mobile-close').addEventListener('click', () => {
            cleanupPreview();
        });

        window.addEventListener('popstate', function onPop(e) {
            const mobileEl = document.getElementById('settings-mobile');
            if (!mobileEl || mobileEl.style.display === 'none') {
                if (mobile && mobile.__preview) {
                    mobile.__preview.stop && mobile.__preview.stop();
                }
                window.removeEventListener('popstate', onPop);
            }
        });
    }

    function openMobileSettingsPage() {
        createMobileSettingsPage();
        const mobile = document.getElementById('settings-mobile'); if (!mobile) return;
        document.body.classList.add('no-scroll-mobile-settings'); 
        mobile.style.display = 'block';
        requestAnimationFrame(() => mobile.classList.add('open'));
        history.pushState({ mobileSettings: true }, 'Settings', '#settings-mobile');
        const inputs = mobile.querySelectorAll('input, select'); inputs.forEach(i=>i.dispatchEvent(new Event('input')));
    }
    function closeMobileSettingsPage(){ 
        const mobile=document.getElementById('settings-mobile'); if(!mobile) return; 
        mobile.classList.remove('open');
        setTimeout(() => {
            mobile.style.display='none'; 
            document.body.classList.remove('no-scroll-mobile-settings'); 
        }, 300);
    }

    window.addEventListener('popstate', (e)=>{ if (e.state && e.state.mobileSettings) return; const mobile=document.getElementById('settings-mobile'); if (mobile && mobile.style.display!=='none') closeMobileSettingsPage(); });
    window.addEventListener('resize', ()=>{ 
        if (!isMobileLayout()) {
            try { createSettingsPanel(); } catch(e){ console.error('createSettingsPanel on resize failed', e); }
            const mobile = document.getElementById('settings-mobile'); if (mobile && mobile.style.display!=='none') closeMobileSettingsPage();
        } else {
            const spaSettings = document.getElementById('settings');
            if (spaSettings && !spaSettings.classList.contains('hidden')) spaSettings.classList.add('hidden');
        }
    });

    // Insert /settings nav item
    function insertSettingsNavItem() {
        const candidates = [document.getElementById('nav-links'), document.querySelector('.nav-links'), document.querySelector('#nav'), document.querySelector('.nav'), document.querySelector('header'), document.querySelector('nav')];
        let container = null;
        for (const c of candidates) { if (c) { container = c; break; } }
        const link = document.createElement('a'); link.className='nav-link'; link.href='#settings'; link.dataset.target='settings'; link.textContent='/settings';
        if (container) container.appendChild(link); else document.body.appendChild(link);
        link.addEventListener('click', (e) => {
            if (!isMobileLayout()) return; e.preventDefault(); e.stopPropagation(); openMobileSettingsPage();
        });
    }

    // Initialize (wrapped so we can call immediately or on DOMContentLoaded)
    function doInit() {
        try {
            initMobileMenu();
            initNavigation();
            insertSettingsNavItem();

            if (!isMobileLayout()) createSettingsPanel();

            try { startTyping(); } catch (e) { console.error('startTyping failed:', e); }

            try { initThreeJS(); } catch (e) { console.error('initThreeJS failed:', e); }

            try { initScrollSpy(); initHackerEffect(); initCardTilt(); } catch (e) { console.error('post-init failed:', e); }

            // Ensure clicking project anchors saves scroll (defensive, in addition to delegated listener above)
            try {
                const projectAnchors = document.querySelectorAll('a[href*="project.html"]');
                projectAnchors.forEach(a => {
                    a.addEventListener('click', () => { savePortfolioScroll(); }, { passive: true });
                });
            } catch (e) { /* ignore */ }

            // Restore saved scroll if this page was opened with a #scroll=... or a session value
            try { restorePortfolioScrollIfPresent(); } catch (e) { /* ignore */ }

        } catch (err) {
            console.error('Initialization failed', err);
        }
    }

    // If the document is already ready (DOMContentLoaded fired), run init immediately.
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', doInit);
    } else {
        // DOM already ready
        setTimeout(doInit, 0);
    }

    // Typing animation (unchanged)
    async function startTyping() {
        const typeEl = document.getElementById('typed-name');
        if (!typeEl) return;
        const text = "KIRBY H. PALADAN";
        for (let i = 0; i < text.length; i++) { typeEl.textContent += text.charAt(i); await new Promise(r => setTimeout(r, 80)); }
        const subEl = document.getElementById('typed-subtitle');
        const subCursor = document.getElementById('cursor-subtitle');
        if (subCursor) subCursor.classList.remove('hidden');
        const subText = "BSCS STUDENT // 3D GAME DEV // PHILIPPINES";
        if (subEl) {
            for (let i = 0; i < subText.length; i++) { subEl.textContent += subText.charAt(i); await new Promise(r => setTimeout(r, 40)); }
        }
        if (subCursor) subCursor.classList.add('hidden');
        const loopEl = document.getElementById('typed-loop');
        const loopCursor = document.getElementById('cursor-loop');
        if (loopCursor) loopCursor.classList.remove('hidden');
        const phrases = ["Building Custom Game Engines...", "Simulating Real Physics...", "Vibe Coding..."];
        let idx = 0;
        while (true) {
            const phrase = phrases[idx];
            if (!loopEl) break;
            for (let i = 0; i < phrase.length; i++) { loopEl.textContent += phrase.charAt(i); await new Promise(r => setTimeout(r, 60)); }
            await new Promise(r => setTimeout(r, 1500));
            while (loopEl.textContent.length > 0) { loopEl.textContent = loopEl.textContent.slice(0, -1); await new Promise(r => setTimeout(r, 30)); }
            await new Promise(r => setTimeout(r, 500));
            idx = (idx + 1) % phrases.length;
        }
    }

    // Other helpers (unchanged)
    function initScrollSpy() {
        const observerOptions = { root: null, rootMargin: '-40% 0px -60% 0px', threshold: 0 };
        const observer = new IntersectionObserver((entries) => {
            if (!isMobileLayout()) return;
            entries.forEach(entry => { if (entry.isIntersecting) { setActiveNavLink(entry.target.id); currentPanelId = entry.target.id; } });
        }, observerOptions);
        document.querySelectorAll('.panel').forEach(section => { observer.observe(section); });
    }

    function initHackerEffect() {
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
        const targets = document.querySelectorAll('.nav-link, .section-title, .neon-btn');
        targets.forEach(item => {
            item.dataset.value = item.innerText;
            item.addEventListener('mouseover', event => {
                let iterations = 0;
                const originalText = event.target.dataset.value;
                clearInterval(event.target.interval);
                event.target.interval = setInterval(() => {
                    event.target.innerText = originalText.split("").map((letter, index) => {
                        if (index < iterations) return originalText[index];
                        return letters[Math.floor(Math.random() * letters.length)];
                    }).join("");
                    if (iterations >= originalText.length) clearInterval(event.target.interval);
                    iterations += 1/2;
                }, 30);
            });
        });
    }

    function initCardTilt() {
        // Optimization: use passive event listeners and requestAnimationFrame
        const cards = document.querySelectorAll('.project-card, .cert-card');
        cards.forEach(card => {
            let ticking = false;
            card.addEventListener('mousemove', (e) => {
                if (!ticking) {
                    window.requestAnimationFrame(() => {
                        const rect = card.getBoundingClientRect();
                        const x = e.clientX - rect.left; const y = e.clientY - rect.top;
                        const centerX = rect.width / 2; const centerY = rect.height / 2;
                        const rotateX = ((y - centerY) / centerY) * -10;
                        const rotateY = ((x - centerX) / centerX) * 10;
                        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
                        ticking = false;
                    });
                    ticking = true;
                }
            }, {passive: true});
            card.addEventListener('mouseleave', () => { card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)'; });
        });
    }

})();