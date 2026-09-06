(function () {
    'use strict';

    const body = document.body;
    const canvas = document.getElementById('flight-canvas');
    const journey = document.getElementById('journey');
    const apps = document.getElementById('apps');
    const phaseLabel = document.getElementById('flight-phase');
    const progressLabel = document.getElementById('flight-progress');
    const progressTrack = document.getElementById('flight-track');
    const sceneStatus = document.getElementById('scene-status');
    const overlay = document.getElementById('departure-overlay');
    const steps = Array.from(document.querySelectorAll('.flight-step'));
    const cards = Array.from(document.querySelectorAll('.destination-card'));
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const destinations = {
        passage: { name: 'Passage', code: 'PSG', direction: -1, ja: '/passage/?lang=ja', en: '/passage/?lang=en' },
        timeline: { name: 'Timeline Visualizer', code: 'TLV', direction: 0, ja: '/timeline-visualizer/?lang=ja', en: '/timeline-visualizer/?lang=en' },
        ratiofit: { name: 'RatioFit', code: 'RTF', direction: 1, ja: '/ratiofit/', en: '/ratiofit/en/' }
    };
    const phases = {
        ja: ['出発の準備', 'テイクオフ', '空の旅へ'],
        en: ['At the gate', 'Taking off', 'In the air']
    };
    let language = 'ja';
    let scene = null;
    let sceneVersion = 0;
    let sceneState = 'loading';
    let progress = 0;
    let pendingFrame = 0;
    let revealObserver = null;
    let departure = null;

    function updateFlightLabels() {
        const phase = progress < 0.2 ? 0 : progress < 0.68 ? 1 : 2;
        if (phaseLabel) phaseLabel.textContent = phases[language][phase];
        if (progressLabel) progressLabel.textContent = String(Math.round(progress * 100)).padStart(2, '0') + '%';
        if (progressTrack) progressTrack.style.transform = 'scaleX(' + progress + ')';
        steps.forEach((step) => {
            const index = Number(step.dataset.step);
            step.classList.toggle('is-active', index === phase);
            step.classList.toggle('is-complete', index < phase);
            if (index === phase) step.setAttribute('aria-current', 'step');
            else step.removeAttribute('aria-current');
        });
        if (sceneStatus) {
            const statusText = sceneState === 'unavailable'
                ? (language === 'en' ? 'Explore the products below.' : '各プロダクトへそのまま移動できます。')
                : sceneState === 'ready'
                    ? (language === 'en' ? 'Scroll to follow the flight.' : 'スクロールすると飛行機が離陸します。')
                    : '';
            if (sceneStatus.textContent !== statusText) sceneStatus.textContent = statusText;
        }
    }

    function updateProgress() {
        pendingFrame = 0;
        let cloudScroll = 0;
        if (journey && apps) {
            const start = journey.getBoundingClientRect().top + window.scrollY;
            const end = apps.getBoundingClientRect().top + window.scrollY - 100;
            progress = Math.max(0, Math.min(1, (window.scrollY - start) / Math.max(1, end - start)));
            cloudScroll = (window.scrollY - start) / Math.max(1, window.innerHeight);
        }
        // Retire the flight instruments as the opaque contact/footer section enters.
        // The stage is also clipped by .journey so it never paints over legal links.
        const contact = document.getElementById('links');
        body.classList.toggle('destinations-visible', Boolean(apps && apps.getBoundingClientRect().top < window.innerHeight - 76));
        body.classList.toggle('flight-ended', Boolean(contact && contact.getBoundingClientRect().top < window.innerHeight * 0.48));
        if (!departure && scene) {
            const slot = document.querySelector('.destination-flight-slot');
            const heading = document.getElementById('destinations-title');
            const bounds = slot?.getBoundingClientRect();
            const stage = canvas.getBoundingClientRect();
            const headingTop = heading?.getBoundingClientRect().top ?? window.innerHeight;
            let destinationPose = null;
            if (bounds?.height && window.innerWidth <= 760) {
                const ease = (value) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
                const mix = (a, b, t) => a + (b - a) * t;
                const viewport = window.innerHeight;
                const rail = ease((viewport * 0.95 - headingTop) / (viewport * 0.40));
                // Move down the reserved right-hand lane before crossing into
                // the full-width slot. It grows within the visible slot area
                // and reaches full size once the entire slot fits on screen.
                const settle = ease((viewport + 64 - bounds.bottom) / 80);
                const descend = ease((viewport * 1.10 - bounds.top) / (viewport * 0.35));
                const slotY = bounds.top + bounds.height / 2;
                const railY = mix(Math.max(viewport * 0.30, Math.min(viewport * 0.65, headingTop + 90)), Math.min(viewport - 80, slotY), descend);
                destinationPose = {
                    x: mix(mix(0.5, 0.84, rail), (bounds.left + bounds.width / 2 - stage.left) / stage.width, settle),
                    y: mix(mix(0.255, (railY - stage.top) / stage.height, rail), (slotY - stage.top) / stage.height, settle),
                    width: mix(mix(0.64, 0.23, rail), 0.56, settle),
                    lane: rail * (1 - settle)
                };
            }
            scene.setCruiseSlot(destinationPose);
            scene.setCloudScroll(cloudScroll);
            scene.setProgress(progress);
        }
        updateFlightLabels();
    }

    function requestProgress() {
        if (!pendingFrame) pendingFrame = requestAnimationFrame(updateProgress);
    }

    function setLanguage(nextLanguage, updateUrl) {
        language = nextLanguage === 'en' ? 'en' : 'ja';
        const english = language === 'en';
        body.classList.toggle('lang-en', english);
        body.classList.toggle('lang-ja', !english);
        document.documentElement.lang = language;
        ['ja', 'en'].forEach((code) => {
            const button = document.getElementById('btn-' + code);
            if (!button) return;
            button.classList.toggle('active', language === code);
            button.setAttribute('aria-pressed', String(language === code));
        });
        document.title = english ? 'PATH | Your next little journey.' : 'PATH｜旅のつづきはここから。';
        const description = document.querySelector('meta[name="description"]');
        if (description) {
            description.content = english
                ? 'Capture your journeys. Retrace your steps. Shape your memories. Passage, Timeline Visualizer, and RatioFit. Begin a new journey with PATH.'
                : '旅を記録する。軌跡をたどる。思い出を整える。Passage、Timeline Visualizer、RatioFit。PATHのアプリと、新しい旅へ。';
        }
        const socialTitle = document.querySelector('meta[property="og:title"]');
        const socialDescription = document.querySelector('meta[property="og:description"]');
        if (socialTitle) socialTitle.content = document.title;
        if (socialDescription) socialDescription.content = english
            ? 'Capture your journeys. Retrace your steps. Shape your memories. Begin a new journey with PATH.'
            : '旅を記録する。軌跡をたどる。思い出を整える。PATHのアプリと、新しい旅へ。';
        document.querySelectorAll('a[data-destination]').forEach((link) => {
            const destination = destinations[link.dataset.destination];
            if (destination) link.setAttribute('href', destination[language]);
        });
        if (updateUrl) {
            const url = new URL(window.location.href);
            url.searchParams.set('lang', language);
            history.replaceState(history.state, '', url);
        }
        updateFlightLabels();
        requestProgress();
    }

    function revealCards() {
        if (revealObserver) revealObserver.disconnect();
        cards.forEach((card) => {
            card.classList.add('is-visible');
            card.classList.remove('will-reveal');
        });
        if (motionPreference.matches || !('IntersectionObserver' in window)) return;
        revealObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                revealObserver.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px 32px 0px' });
        cards.forEach((card) => {
            if (card.getBoundingClientRect().top > window.innerHeight) {
                card.classList.add('will-reveal');
                card.classList.remove('is-visible');
                revealObserver.observe(card);
            }
        });
    }

    function sceneUnavailable() {
        sceneState = 'unavailable';
        body.classList.remove('scene-ready');
        body.classList.add('scene-unavailable');
        if (scene) {
            try { scene.dispose(); } catch (_) { /* Links remain available if WebGL is lost. */ }
            scene = null;
        }
        updateFlightLabels();
        requestProgress();
    }

    async function loadScene() {
        if (!canvas) return;
        const version = ++sceneVersion;
        try {
            const { createFlightScene } = await import('./flight-scene.js?v=20260906-scroll-clouds1');
            if (version !== sceneVersion) return;
            const nextScene = await createFlightScene(canvas, {
                reducedMotion: motionPreference.matches,
                onReady: () => {
                    if (version !== sceneVersion) return;
                    sceneState = 'ready';
                    body.classList.add('scene-ready');
                    body.classList.remove('scene-unavailable');
                    updateFlightLabels();
                    requestProgress();
                }
            });
            if (version !== sceneVersion) {
                nextScene.dispose();
                return;
            }
            scene = nextScene;
            scene.setProgress(progress);
            requestProgress();
        } catch (_) {
            if (version === sceneVersion) sceneUnavailable();
        }
    }

    function clearDeparture() {
        if (departure) departure.timers.forEach(clearTimeout);
        departure = null;
        if (scene && typeof scene.cancelDeparture === 'function') scene.cancelDeparture();
        body.classList.remove('is-departing');
        if (overlay) {
            overlay.classList.remove('is-visible');
            overlay.setAttribute('aria-hidden', 'true');
        }
        if (scene) scene.setProgress(progress);
    }

    function navigate(flight) {
        if (departure !== flight || flight.navigated) return;
        flight.navigated = true;
        flight.timers.forEach(clearTimeout);
        try {
            if (!motionPreference.matches) {
                sessionStorage.setItem('path-flight-arrival', JSON.stringify({
                    path: flight.url.pathname,
                    search: flight.url.search,
                    name: flight.destination.name,
                    code: flight.destination.code,
                    time: Date.now()
                }));
            }
        } catch (_) { /* Navigation does not require browser storage. */ }
        window.location.assign(flight.url.href);
    }

    function showDepartureVeil(flight) {
        if (departure !== flight || flight.veilShown) return;
        flight.veilShown = performance.now();
        if (overlay) {
            overlay.classList.add('is-visible');
            overlay.setAttribute('aria-hidden', 'false');
        }
    }

    function finishDeparture(flight) {
        if (departure !== flight || flight.finishing) return;
        flight.finishing = true;
        if (motionPreference.matches) {
            navigate(flight);
            return;
        }
        showDepartureVeil(flight);
        const remainingFade = Math.max(0, 360 - (performance.now() - flight.veilShown));
        flight.timers.push(setTimeout(() => navigate(flight), remainingFade));
    }

    function followDestination(event, link) {
        const destination = destinations[link.dataset.destination];
        if (!destination || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
        const url = new URL(link.href, window.location.href);
        if (url.origin !== window.location.origin || !/^https?:$/.test(url.protocol)) return;
        if (departure) {
            event.preventDefault();
            return;
        }
        if (motionPreference.matches || !scene || sceneState !== 'ready') return;
        event.preventDefault();
        const flight = { destination, url, timers: [], veilShown: 0, finishing: false, navigated: false };
        departure = flight;
        body.classList.add('is-departing');
        const name = document.getElementById('departure-name');
        const code = document.getElementById('departure-code');
        if (name) name.textContent = destination.name;
        if (code) code.textContent = destination.code;
        flight.timers.push(setTimeout(() => showDepartureVeil(flight), 1040));
        // A failed renderer or interrupted frame loop must never strand the link.
        flight.timers.push(setTimeout(() => finishDeparture(flight), 2400));
        try {
            Promise.resolve(scene.depart({ direction: destination.direction, duration: 1400 }))
                .then(() => finishDeparture(flight), () => finishDeparture(flight));
        } catch (_) {
            finishDeparture(flight);
        }
    }

    document.getElementById('btn-ja')?.addEventListener('click', () => setLanguage('ja', true));
    document.getElementById('btn-en')?.addEventListener('click', () => setLanguage('en', true));
    window.addEventListener('popstate', () => setLanguage(new URLSearchParams(window.location.search).get('lang'), false));
    document.querySelectorAll('[data-path-link]').forEach((link) => {
        link.addEventListener('click', (event) => {
            if (typeof window.gtag === 'function') {
                try {
                    window.gtag('event', 'path_hub_link_click', { link_name: link.dataset.pathLink, language });
                } catch (_) { /* Analytics must not block a product link. */ }
            }
            followDestination(event, link);
        });
    });
    cards.forEach((card) => card.addEventListener('focusin', () => card.classList.add('is-visible')));
    window.addEventListener('scroll', requestProgress, { passive: true });
    window.addEventListener('resize', () => {
        if (scene) scene.resize();
        requestProgress();
    }, { passive: true });
    window.addEventListener('pageshow', () => {
        clearDeparture();
        requestProgress();
    });
    canvas?.addEventListener('webglcontextlost', () => {
        ++sceneVersion;
        sceneUnavailable();
        if (departure) finishDeparture(departure);
    });
    function updateMotionPreference() {
        body.classList.toggle('reduced-motion', motionPreference.matches);
        revealCards();
        if (departure && motionPreference.matches) navigate(departure);
        if (scene && typeof scene.setReducedMotion === 'function') {
            scene.setReducedMotion(motionPreference.matches);
        } else if (scene) {
            scene.dispose();
            scene = null;
            loadScene();
        }
        requestProgress();
    }
    if (motionPreference.addEventListener) motionPreference.addEventListener('change', updateMotionPreference);
    else motionPreference.addListener(updateMotionPreference);
    body.classList.toggle('reduced-motion', motionPreference.matches);
    setLanguage(new URLSearchParams(window.location.search).get('lang'), false);
    updateProgress();
    revealCards();
    loadScene();
    if (document.fonts) document.fonts.ready.then(requestProgress);
})();
