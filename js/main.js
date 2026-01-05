document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed. Initializing script...");

    // Global Variables (Sets for active tags)
    const activeShopTags = new Set();
    const activeIndividualTags = new Set();

    // DOM Element References
    const clearFiltersButton = document.getElementById('clear-filters-button');
    const shopTagButtons = document.querySelectorAll('#shop-tags .tag-button');
    const individualTagButtons = document.querySelectorAll('#individual-tags .tag-button');
    
    // Get all cards (These are now pre-rendered by Jekyll)
    const shopCards = document.querySelectorAll('.shop-card');
    const individualCards = document.querySelectorAll('.individual-card');

    // Filter Function
    function filterElements() {
        console.log("Filtering...", { activeShopTags, activeIndividualTags });
        
        // 1. Filter Shops
        let visibleShopIds = new Set();
        
        shopCards.forEach(card => {
            const tagsAttr = card.getAttribute('data-tags') || '';
            const tags = tagsAttr.split(',').filter(t => t); // split and remove empty
            const shopId = card.getAttribute('data-id');
            
            let isVisible = true;
            
            // Check shop tags
            if (activeShopTags.size > 0) {
                const hasMatchingTag = tags.some(tag => activeShopTags.has(tag));
                if (!hasMatchingTag) isVisible = false;
            }
            
            if (isVisible) {
                card.style.display = ''; // Show
                visibleShopIds.add(shopId);
            } else {
                card.style.display = 'none'; // Hide
            }
        });

        // 2. Filter Individuals
        individualCards.forEach(card => {
            const tagsAttr = card.getAttribute('data-tags') || '';
            const tags = tagsAttr.split(',').filter(t => t);
            const shopId = card.getAttribute('data-shop-id');
            
            let isVisible = true;
            
            // A. Filter by individual tags
            if (activeIndividualTags.size > 0) {
                const hasMatchingTag = tags.some(tag => activeIndividualTags.has(tag));
                if (!hasMatchingTag) isVisible = false;
            }
            
            // B. Filter by currently displayed shops
            // If shop tags are active, only show individuals belonging to visible shops
            if (activeShopTags.size > 0) {
                 if (!visibleShopIds.has(shopId)) {
                     isVisible = false;
                 }
            }
            
            if (isVisible) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
        
        updateTagButtonStates();
    }
    
    // Event Listeners for Tags (Shop tags)
    shopTagButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tag = button.getAttribute('data-tag');
            if (activeShopTags.has(tag)) {
                activeShopTags.delete(tag);
            } else {
                activeShopTags.add(tag);
            }
            filterElements();
        });
    });

    // Event Listeners for Tags (Individual tags)
    individualTagButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tag = button.getAttribute('data-tag');
            if (activeIndividualTags.has(tag)) {
                activeIndividualTags.delete(tag);
            } else {
                activeIndividualTags.add(tag);
            }
            filterElements();
        });
    });

    // Update Tag Button Visual States
    function updateTagButtonStates() {
        shopTagButtons.forEach(button => {
            const tag = button.getAttribute('data-tag');
            if (activeShopTags.has(tag)) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        individualTagButtons.forEach(button => {
            const tag = button.getAttribute('data-tag');
            if (activeIndividualTags.has(tag)) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    // Clear Filters
    if (clearFiltersButton) {
        clearFiltersButton.addEventListener('click', () => {
            activeShopTags.clear();
            activeIndividualTags.clear();
            filterElements();
        });
    }
    
    // Initial Filter Run
    filterElements();
});
