document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const buttons = { ja: document.getElementById('btn-ja'), en: document.getElementById('btn-en') };
    let currentLang = 'ja';

    // This script is shared with the legal page.
    document.querySelectorAll('.secure-email').forEach((element) => {
        try {
            const email = atob(element.dataset.u) + '@' + atob(element.dataset.d);
            const link = document.createElement('a');
            link.href = 'mailto:' + email;
            link.textContent = email;
            element.replaceChildren(link);
        } catch (_) { /* The readable fallback remains if an address is malformed. */ }
    });

    function showImage(img, lang) {
        if (img.hasAttribute('data-defer')) return;
        const pick = (element) => lang === 'en' ? element.dataset.en : element.dataset.ja;
        const picture = img.parentElement;
        if (picture && picture.tagName === 'PICTURE') {
            picture.querySelectorAll('source[data-ja]').forEach((source) => {
                const url = pick(source);
                if (url && source.getAttribute('srcset') !== url) source.srcset = url;
            });
        }
        const src = pick(img);
        if (src && img.getAttribute('src') !== src) img.src = src;
        const alt = lang === 'en' ? img.dataset.altEn : img.dataset.altJa;
        if (alt) img.alt = alt;
    }

    const gallery = document.querySelector('.gallery-scroll');
    const galleryButtons = Array.from(document.querySelectorAll('[data-gallery-step]'));
    function updateGallery() {
        if (!gallery) return;
        const maximum = Math.max(0, gallery.scrollWidth - gallery.clientWidth);
        galleryButtons.forEach((button) => {
            const backwards = Number(button.dataset.galleryStep) < 0;
            button.disabled = backwards ? gallery.scrollLeft <= 2 : gallery.scrollLeft >= maximum - 2;
            button.setAttribute('aria-label', currentLang === 'ja'
                ? (backwards ? '前のスクリーンショット' : '次のスクリーンショット')
                : (backwards ? 'Previous screenshots' : 'Next screenshots'));
        });
        gallery.setAttribute('aria-label', currentLang === 'ja' ? 'Passageのスクリーンショット' : 'Passage screenshots');
    }
    galleryButtons.forEach((button) => button.addEventListener('click', () => {
        if (!gallery) return;
        gallery.scrollBy({ left: Number(button.dataset.galleryStep) * gallery.clientWidth * 0.85, behavior: motion.matches ? 'auto' : 'smooth' });
    }));
    if (gallery) {
        gallery.addEventListener('scroll', updateGallery, { passive: true });
        window.addEventListener('resize', updateGallery, { passive: true });
        gallery.querySelectorAll('img').forEach((img) => img.addEventListener('load', updateGallery));
    }

    function setLanguage(value, updateUrl = false) {
        currentLang = value === 'en' ? 'en' : 'ja';
        const english = currentLang === 'en';
        body.classList.toggle('lang-en', english);
        body.classList.toggle('lang-ja', !english);
        document.documentElement.lang = currentLang;
        Object.entries(buttons).forEach(([lang, button]) => {
            if (!button) return;
            button.classList.toggle('active', lang === currentLang);
            button.setAttribute('aria-pressed', String(lang === currentLang));
        });
        const legal = /^\/legal(?:\/|\.html$)/.test(window.location.pathname);
        const title = legal
            ? (english ? 'PATH - Legal Information' : 'PATH - 特定商取引法に基づく表記 / Legal Information')
            : (english ? 'Passage | A journey worth keeping.' : 'Passage｜旅の軌跡を美しい一枚に。');
        const description = legal
            ? (english ? 'Legal and trader information for apps provided by PATH.' : 'PATHが提供するアプリに関する特定商取引法に基づく表記およびEU/EEA向け事業者情報です。')
            : (english ? 'Add flight details and train routes to your travel photos. Passage turns photo location data into a journey worth keeping, on iOS and Android.' : 'フライトや列車のルートを旅の写真に。Passageは写真の位置情報から移動の軌跡を描くiOS・Androidアプリです。');
        document.title = title;
        const metadata = { 'meta[name="description"]': description, 'meta[property="og:title"]': title, 'meta[property="og:description"]': description, 'meta[name="twitter:title"]': title, 'meta[name="twitter:description"]': description, 'meta[property="og:locale"]': english ? 'en_US' : 'ja_JP', 'meta[property="og:locale:alternate"]': english ? 'ja_JP' : 'en_US' };
        Object.entries(metadata).forEach(([selector, content]) => {
            const meta = document.querySelector(selector);
            if (meta) meta.content = content;
        });
        document.querySelectorAll('.lang-img').forEach((img) => showImage(img, currentLang));
        const routes = { hub: english ? '/?lang=en' : '/?lang=ja', timeline: english ? '/timeline-visualizer/?lang=en' : '/timeline-visualizer/?lang=ja', ratiofit: english ? '/ratiofit/en/' : '/ratiofit/', legal: english ? '/legal/?lang=en' : '/legal/?lang=ja' };
        document.querySelectorAll('[data-lang-link]').forEach((link) => {
            if (routes[link.dataset.langLink]) link.setAttribute('href', routes[link.dataset.langLink]);
        });
        try { localStorage.setItem('preferred-lang', currentLang); } catch (_) { /* The page does not require browser storage. */ }
        if (updateUrl) {
            const url = new URL(window.location.href);
            url.searchParams.set('lang', currentLang);
            history.replaceState(history.state, '', url);
        }
        updateGallery();
    }
    buttons.ja?.addEventListener('click', () => setLanguage('ja', true));
    buttons.en?.addEventListener('click', () => setLanguage('en', true));
    let savedLang;
    try { savedLang = localStorage.getItem('preferred-lang'); } catch (_) { /* Fall back to the browser language. */ }
    const urlLang = new URLSearchParams(window.location.search).get('lang');
    const initialLang = ['ja', 'en'].includes(urlLang) ? urlLang : ['ja', 'en'].includes(savedLang) ? savedLang : navigator.language.startsWith('ja') ? 'ja' : 'en';
    setLanguage(initialLang);
    window.addEventListener('popstate', () => {
        const lang = new URLSearchParams(window.location.search).get('lang');
        setLanguage(['ja', 'en'].includes(lang) ? lang : currentLang);
    });

    // Native lazy loading also keeps the gallery available without JavaScript.
    // Older markup using data-defer continues to work with this shared script.
    const deferredImages = document.querySelectorAll('img[data-defer]');
    const activateImage = (img) => {
        img.removeAttribute('data-defer');
        showImage(img, currentLang);
    };
    if ('IntersectionObserver' in window) {
        const deferredObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                deferredObserver.unobserve(entry.target);
                activateImage(entry.target);
            });
        }, { rootMargin: '400px' });
        deferredImages.forEach((img) => deferredObserver.observe(img));
    } else deferredImages.forEach(activateImage);

    let revealObserver;
    const revealElements = document.querySelectorAll('.feature-card, .plus-card, .tool-card');
    function setupReveals() {
        revealObserver?.disconnect();
        revealElements.forEach((element) => {
            element.classList.remove('will-reveal');
            element.classList.add('revealed');
        });
        if (motion.matches || !('IntersectionObserver' in window)) return;
        revealObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('revealed');
                revealObserver.unobserve(entry.target);
            });
        }, { threshold: 0.1 });
        revealElements.forEach((element) => {
            if (element.getBoundingClientRect().top <= window.innerHeight) return;
            element.classList.add('will-reveal');
            element.classList.remove('revealed');
            revealObserver.observe(element);
        });
    }
    revealElements.forEach((element) => element.addEventListener('focusin', () => element.classList.add('revealed')));
    setupReveals();
    if (motion.addEventListener) motion.addEventListener('change', setupReveals);
    else motion.addListener(setupReveals);

    const snsSection = document.getElementById('sns');
    if (snsSection) {
        if ('IntersectionObserver' in window) {
            const snsObserver = new IntersectionObserver((entries) => {
                if (!entries.some((entry) => entry.isIntersecting)) return;
                snsObserver.disconnect();
                renderSocialPosts();
            }, { rootMargin: '200px', threshold: 0.05 });
            snsObserver.observe(snsSection);
        } else renderSocialPosts();
    }
    if (document.fonts) document.fonts.ready.then(updateGallery);
});

// How many SNS posts to show before requiring a "show more" click.
// Embeds are heavy third-party content, so we avoid rendering dozens at once.
const SNS_INITIAL_COUNT = 6;

const SNS_EMBED_SCRIPTS = {
    x: { id: 'twitter-widgets-js', src: 'https://platform.x.com/widgets.js' },
    threads: { id: 'threads-embed-js', src: 'https://www.threads.com/embed.js' },
    instagram: { id: 'instagram-embed-js', src: 'https://www.instagram.com/embed.js' },
};

// Identifies the platform from either a bare post URL or a full embed-code snippet,
// so posts.js entries don't need to declare their platform explicitly.
function detectSnsPlatform(raw) {
    if (/class="twitter-tweet"|(?:\/\/|^)(?:www\.)?(?:twitter|x)\.com/i.test(raw)) return 'x';
    if (/class="text-post-media"|(?:\/\/|^)(?:www\.)?threads\.(?:net|com)/i.test(raw)) return 'threads';
    if (/class="instagram-media"|(?:\/\/|^)(?:www\.)?instagram\.com/i.test(raw)) return 'instagram';
    return null;
}

// A bare URL gets turned into a minimal official blockquote; a pasted embed-code
// snippet is used as-is (any inline <script> tag inside it is inert via innerHTML
// and harmless — the real embed script is loaded separately below).
function buildSnsEmbedHtml(raw, platform) {
    if (!/^https?:\/\//i.test(raw.trim())) return raw;
    if (platform === 'x') return `<blockquote class="twitter-tweet"><a href="${raw}"></a></blockquote>`;
    if (platform === 'threads') return `<blockquote class="text-post-media" data-text-post-permalink="${raw}"><a href="${raw}"></a></blockquote>`;
    if (platform === 'instagram') return `<blockquote class="instagram-media" data-instgrm-permalink="${raw}" data-instgrm-version="14"></blockquote>`;
    return '';
}

// (Re-)injects a platform's embed script so it scans the page for any
// not-yet-processed blockquotes. Safe to call repeatedly — re-scanning
// already-rendered embeds is a no-op for these widgets.
function loadSnsEmbedScript(platform) {
    const info = SNS_EMBED_SCRIPTS[platform];
    if (!info) return;
    const existing = document.getElementById(info.id);
    if (existing) existing.remove();
    const script = document.createElement('script');
    script.id = info.id;
    script.src = info.src;
    script.async = true;
    document.body.appendChild(script);
}

// Renders the curated SNS posts listed in posts.js (window.PASSAGE_POSTS) into #sns-grid.
// Shows the first SNS_INITIAL_COUNT posts and reveals the rest behind a "show more"
// button. Only loads the platform embed scripts that are actually needed.
function renderSocialPosts() {
    const section = document.getElementById('sns');
    const grid = document.getElementById('sns-grid');
    if (!section || !grid) return;

    const rawPosts = window.PASSAGE_POSTS || [];
    if (rawPosts.length === 0) {
        section.classList.add('is-empty');
        return;
    }

    const posts = rawPosts.map(raw => {
        const platform = detectSnsPlatform(raw);
        return platform ? { platform, html: buildSnsEmbedHtml(raw, platform) } : null;
    }).filter(Boolean);

    function revealBatch(batch) {
        const usedPlatforms = new Set();
        batch.forEach(post => {
            const wrapper = document.createElement('div');
            wrapper.className = 'sns-post';
            wrapper.innerHTML = post.html;
            grid.appendChild(wrapper);
            usedPlatforms.add(post.platform);
        });
        usedPlatforms.forEach(loadSnsEmbedScript);
    }

    revealBatch(posts.slice(0, SNS_INITIAL_COUNT));

    const remaining = posts.slice(SNS_INITIAL_COUNT);
    if (remaining.length > 0) {
        const moreBtn = document.createElement('button');
        moreBtn.type = 'button';
        moreBtn.className = 'btn btn-outline sns-more-btn';
        moreBtn.innerHTML = '<span class="lang-ja">もっと見る</span><span class="lang-en">Show more</span>';
        moreBtn.addEventListener('click', () => {
            revealBatch(remaining);
            moreBtn.remove();
        });
        grid.insertAdjacentElement('afterend', moreBtn);
    }
}
