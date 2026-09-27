(() => {
    const track = document.getElementById('review-carousel');
    const controls = document.querySelector('.reviews-controls');
    if (!track || !controls) return;
    const buttons = [...controls.querySelectorAll('[data-review-step]')];
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const update = () => {
        const maximum = Math.max(0, track.scrollWidth - track.clientWidth);
        buttons.forEach((button) => {
            button.disabled = Number(button.dataset.reviewStep) < 0
                ? track.scrollLeft <= 2
                : track.scrollLeft >= maximum - 2;
        });
    };
    const move = (direction) => {
        const card = track.querySelector('.review-card');
        if (!card) return;
        const distance = card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap);
        track.scrollBy({ left: direction * distance, behavior: motion.matches ? 'auto' : 'smooth' });
    };
    buttons.forEach((button) => button.addEventListener('click', () => move(Number(button.dataset.reviewStep))));
    track.addEventListener('scroll', update, { passive: true });
    track.addEventListener('keydown', (event) => {
        if (event.target !== track) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            move(event.key === 'ArrowLeft' ? -1 : 1);
        } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            track.scrollTo({ left: event.key === 'Home' ? 0 : track.scrollWidth, behavior: motion.matches ? 'auto' : 'smooth' });
        }
    });
    if ('ResizeObserver' in window) new ResizeObserver(update).observe(track);
    else window.addEventListener('resize', update, { passive: true });
    controls.hidden = false;
    update();
})();
