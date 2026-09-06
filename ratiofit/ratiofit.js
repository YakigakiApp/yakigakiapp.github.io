(function () {
    'use strict';

    document.querySelectorAll('[data-play-link]').forEach((link) => {
        link.addEventListener('click', () => {
            if (typeof window.gtag !== 'function') return;
            try {
                window.gtag('event', 'ratiofit_play_click', {
                    language: document.documentElement.lang,
                    placement: link.dataset.placement || 'unknown'
                });
            } catch (_) { /* A product link does not depend on analytics. */ }
        });
    });

    const frame = document.getElementById('demo-frame');
    const label = document.getElementById('demo-ratio-label');
    const ratios = {
        '1:1': { ratio: 1, width: 300 },
        '4:5': { ratio: 4 / 5, width: 280 },
        '9:16': { ratio: 9 / 16, width: 203 },
        '16:9': { ratio: 16 / 9, width: 360 }
    };
    const options = Array.from(document.querySelectorAll('[data-ratio]'));
    options.forEach((button) => {
        button.addEventListener('click', () => {
            const selected = ratios[button.dataset.ratio];
            if (!selected || !frame) return;
            frame.style.setProperty('--demo-ratio', String(selected.ratio));
            frame.style.setProperty('--demo-width', selected.width + 'px');
            if (label) label.textContent = button.dataset.ratio;
            options.forEach((option) => {
                const active = option === button;
                option.classList.toggle('is-selected', active);
                option.setAttribute('aria-pressed', String(active));
            });
        });
    });
})();
