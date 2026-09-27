(() => {
    const trigger = document.querySelector('.feature-preview-trigger');
    const dialog = document.getElementById('feature-preview-dialog');
    // The image link remains usable when the browser cannot open a modal.
    if (!trigger || !dialog || typeof dialog.showModal !== 'function') return;

    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', dialog.id);
    trigger.addEventListener('click', (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        dialog.showModal();
        document.documentElement.classList.add('feature-preview-open');
    });

    dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
        document.documentElement.classList.remove('feature-preview-open');
        trigger.focus({ preventScroll: true });
    });
})();
