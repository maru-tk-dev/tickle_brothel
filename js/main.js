document.addEventListener('DOMContentLoaded', () => {
    const areaButtons = [...document.querySelectorAll('.area-button')];
    const featureButtons = [...document.querySelectorAll('.feature-button')];
    const shopCards = [...document.querySelectorAll('.shop-card')];
    const clearFiltersButton = document.getElementById('clear-filters-button');
    const noResults = document.getElementById('no-results');
    const noResultsClearButton = noResults?.querySelector('button');
    const resultCount = document.getElementById('result-count');

    let activeArea = '';
    const activeFeatures = new Set();

    function updateButtonState(button, isActive) {
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    }

    function applyFilters() {
        let visibleCount = 0;

        shopCards.forEach((card) => {
            const cardArea = card.dataset.area || '';
            const tags = (card.dataset.tags || '').split(',').filter(Boolean);
            const matchesArea = !activeArea || cardArea === activeArea;
            const matchesFeatures = [...activeFeatures].every((tag) => tags.includes(tag));
            const isVisible = matchesArea && matchesFeatures;

            card.hidden = !isVisible;
            if (isVisible) visibleCount += 1;
        });

        areaButtons.forEach((button) => {
            updateButtonState(button, button.dataset.area === activeArea);
        });
        featureButtons.forEach((button) => {
            updateButtonState(button, activeFeatures.has(button.dataset.tag));
        });

        const hasFilters = Boolean(activeArea || activeFeatures.size);
        if (clearFiltersButton) clearFiltersButton.disabled = !hasFilters;
        if (resultCount) resultCount.textContent = `${visibleCount}件のお店`;
        if (noResults) noResults.hidden = visibleCount !== 0;
    }

    function clearFilters() {
        activeArea = '';
        activeFeatures.clear();
        applyFilters();
    }

    areaButtons.forEach((button) => {
        button.addEventListener('click', () => {
            activeArea = activeArea === button.dataset.area ? '' : button.dataset.area;
            applyFilters();
        });
    });

    featureButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const tag = button.dataset.tag;
            if (activeFeatures.has(tag)) {
                activeFeatures.delete(tag);
            } else {
                activeFeatures.add(tag);
            }
            applyFilters();
        });
    });

    clearFiltersButton?.addEventListener('click', clearFilters);
    noResultsClearButton?.addEventListener('click', clearFilters);

    applyFilters();
});
