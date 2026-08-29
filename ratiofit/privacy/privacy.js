document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    const buttonEn = document.getElementById('btn-en');
    const buttonJa = document.getElementById('btn-ja');
    const description = document.querySelector('meta[name="description"]');

    document.querySelectorAll('.secure-email').forEach((element) => {
        const name = atob(element.dataset.name);
        const host = atob(element.dataset.host);
        const address = [name, host].join(String.fromCharCode(64));
        const link = document.createElement('a');
        link.href = ['mailto', address].join(':');
        link.textContent = address;
        element.replaceChildren(link);
    });

    function setLanguage(language, persist = true) {
        const selected = language === 'ja' ? 'ja' : 'en';
        body.classList.toggle('lang-ja', selected === 'ja');
        body.classList.toggle('lang-en', selected === 'en');
        document.documentElement.lang = selected;
        buttonJa.classList.toggle('active', selected === 'ja');
        buttonEn.classList.toggle('active', selected === 'en');

        if (selected === 'ja') {
            document.title = 'RatioFit プライバシーポリシー';
            description.content = 'PATHが提供するAndroidアプリ「RatioFit」のプライバシーポリシーです。';
        } else {
            document.title = 'RatioFit Privacy Policy';
            description.content = 'Privacy Policy for the RatioFit Android app provided by PATH.';
        }

        if (persist) localStorage.setItem('ratiofit-privacy-language', selected);
    }

    buttonEn.addEventListener('click', () => setLanguage('en'));
    buttonJa.addEventListener('click', () => setLanguage('ja'));

    const queryLanguage = new URLSearchParams(window.location.search).get('lang');
    const savedLanguage = localStorage.getItem('ratiofit-privacy-language');
    const initialLanguage = queryLanguage === 'ja' || queryLanguage === 'en'
        ? queryLanguage
        : (savedLanguage || (navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en'));
    setLanguage(initialLanguage, false);
});
