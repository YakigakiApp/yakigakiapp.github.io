document.addEventListener('DOMContentLoaded', () => {
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
    const revealElements = document.querySelectorAll('.feature-card, .section-title, .hero-text, .hero-image');
    revealElements.forEach(el => observer.observe(el));

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

        if (lang === 'en') {
            body.classList.remove('lang-ja');
            body.classList.add('lang-en');
            btnEn.classList.add('active');
            btnJa.classList.remove('active');
            document.title = "Passage - Your journey, captured beautifully.";
            if (metaDesc) metaDesc.content = "Passage beautifully overlays flight info and routes onto your travel photos. Captures altitude, speed, and your path through the sky.";
            
            // Swap to English images
            langImages.forEach(img => {
                if (img.dataset.en) img.src = img.dataset.en;
            });
        } else {
            body.classList.remove('lang-en');
            body.classList.add('lang-ja');
            btnJa.classList.add('active');
            btnEn.classList.remove('active');
            document.title = "Passage - 旅の軌跡を、美しい一枚に。";
            if (metaDesc) metaDesc.content = "Passageは、フライトや列車の移動情報を写真に美しくオーバーレイするiOSアプリです。高度、速度、ルートマップを自動で写真に刻みます。";

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

    // Load preferred language
    const savedLang = localStorage.getItem('preferred-lang') || (navigator.language.startsWith('ja') ? 'ja' : 'en');
    setLanguage(savedLang);
});
