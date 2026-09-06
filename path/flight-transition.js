(function () {
    'use strict';
    let arrival;
    try {
        const saved = sessionStorage.getItem('path-flight-arrival');
        if (!saved) return;
        sessionStorage.removeItem('path-flight-arrival');
        arrival = JSON.parse(saved);
    } catch (_) {
        return;
    }
    if (!arrival || typeof arrival !== 'object') return;
    const age = Date.now() - arrival.time;
    if (!Number.isFinite(age) || age < 0 || age > 15000 || arrival.path !== window.location.pathname || arrival.search !== window.location.search || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const root = document.documentElement;
    root.classList.add('path-flight-arriving');
    function clearVeil() {
        root.classList.remove('path-flight-arriving', 'path-flight-landed');
    }
    function revealPage() {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (!root.classList.contains('path-flight-arriving')) return;
                root.classList.add('path-flight-landed');
                setTimeout(clearVeil, 850);
            });
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', revealPage, { once: true });
    else revealPage();
    // Loading a third-party resource must not leave the destination covered.
    setTimeout(clearVeil, 2500);
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) clearVeil();
    });
})();
