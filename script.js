document.addEventListener('DOMContentLoaded', () => {
    // Decrypt secure emails to protect against crawlers
    document.querySelectorAll('.secure-email').forEach(el => {
        const u = atob(el.getAttribute('data-u'));
        const d = atob(el.getAttribute('data-d'));
        const email = `${u}@${d}`;
        el.innerHTML = `<a href="mailto:${email}">${email}</a>`;
    });

    // Reveal animations on scroll
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Start observing elements
    const revealElements = document.querySelectorAll('.feature-card, .section-title, .hero-text, .hero-image, .plus-card');
    revealElements.forEach(el => observer.observe(el));

    // Render SNS posts lazily when the #sns section scrolls into view
    const snsSection = document.getElementById('sns');
    if (snsSection) {
        const snsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    renderSocialPosts();
                    snsObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        snsObserver.observe(snsSection);
    }

    // Track scroll for header glass effect
    const header = document.querySelector('header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 20) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // Simple smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Language Switcher Logic
    const btnJa = document.getElementById('btn-ja');
    const btnEn = document.getElementById('btn-en');
    const body = document.body;

    function setLanguage(lang) {
        const metaDesc = document.querySelector('meta[name="description"]');
        const langImages = document.querySelectorAll('.lang-img');
        const isLegalPage = window.location.pathname.includes('legal.html');

        if (lang === 'en') {
            body.classList.remove('lang-ja');
            body.classList.add('lang-en');
            btnEn.classList.add('active');
            btnJa.classList.remove('active');
            
            if (isLegalPage) {
                document.title = "Passage - Legal Notice";
                if (metaDesc) metaDesc.content = "Legal notice for Passage under the Japanese Act on Specified Commercial Transactions and the EU Digital Services Act.";
            } else {
                document.title = "Passage - Your journey, captured beautifully.";
                if (metaDesc) metaDesc.content = "Passage beautifully overlays flight info and routes onto your travel photos. Captures altitude, speed, and your path through the sky.";
            }
            
            // Swap to English images
            langImages.forEach(img => {
                if (img.dataset.en) img.src = img.dataset.en;
            });
        } else {
            body.classList.remove('lang-en');
            body.classList.add('lang-ja');
            btnJa.classList.add('active');
            btnEn.classList.remove('active');
            
            if (isLegalPage) {
                document.title = "Passage - 特定商取引法に基づく表記 / DSA対応表示";
                if (metaDesc) metaDesc.content = "Passageの特定商取引法に基づく表記およびEU DSA対応に関する法的表示です。";
            } else {
                document.title = "Passage - 旅の軌跡を、美しい一枚に。";
                if (metaDesc) metaDesc.content = "Passageは、フライトや列車の移動情報を写真に美しくオーバーレイするiOSアプリです。出発/到着地、ルートマップを自動で写真に刻みます。";
            }

            // Swap to Japanese images
            langImages.forEach(img => {
                if (img.dataset.ja) img.src = img.dataset.ja;
            });
        }
        localStorage.setItem('preferred-lang', lang);
    }

    if (btnJa && btnEn) {
        btnJa.addEventListener('click', () => setLanguage('ja'));
        btnEn.addEventListener('click', () => setLanguage('en'));
    }

    // Load preferred language (?lang= in URL takes priority over saved preference / browser language)
    const urlLang = new URLSearchParams(window.location.search).get('lang');
    const savedLang = (urlLang === 'ja' || urlLang === 'en')
        ? urlLang
        : (localStorage.getItem('preferred-lang') || (navigator.language.startsWith('ja') ? 'ja' : 'en'));
    setLanguage(savedLang);
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
