document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed. Initializing script...");

    // Global Variables
    let allShops = [];
    let allIndividuals = [];
    const activeShopTags = new Set();
    const activeIndividualTags = new Set();

    // DOM Element References
    const shopsContainer = document.getElementById('shops-container');
    const individualsContainer = document.getElementById('individuals-container');
    const shopTagsContainer = document.getElementById('shop-tags');
    const individualTagsContainer = document.getElementById('individual-tags');
    const clearFiltersButton = document.getElementById('clear-filters-button');

    // Fetch Data Function
    async function fetchData() {
        try {
            const shopsResponse = await fetch('data/shops.json');
            if (!shopsResponse.ok) {
                throw new Error(`HTTP error! status: ${shopsResponse.status} while fetching shops.json`);
            }
            allShops = await shopsResponse.json();

            const individualsResponse = await fetch('data/individuals.json');
            if (!individualsResponse.ok) {
                throw new Error(`HTTP error! status: ${individualsResponse.status} while fetching individuals.json`);
            }
            allIndividuals = await individualsResponse.json();

            console.log("Data fetched successfully:", { allShops, allIndividuals });
            initializePage();
        } catch (error) {
            console.error("Failed to fetch data:", error);
            if (shopsContainer) shopsContainer.innerHTML = `<p>データの読み込みに失敗しました。詳細: ${error.message}</p>`;
            if (individualsContainer) individualsContainer.innerHTML = `<p>データの読み込みに失敗しました。詳細: ${error.message}</p>`;
        }
    }

    // Render Shops Function
    function renderShops(shopsToRender) {
        if (!shopsContainer) {
            console.error("Shops container not found!");
            return;
        }
        shopsContainer.innerHTML = ''; // Clear previous content

        if (shopsToRender.length === 0) {
            shopsContainer.innerHTML = '<p>該当するお店は見つかりませんでした。</p>';
            return;
        }

        shopsToRender.forEach(shop => {
            const shopCard = document.createElement('div');
            shopCard.className = 'shop-card';
            shopCard.innerHTML = `
                <h3>${shop.name}</h3>
                <img src="${shop.image_url || 'images/shop_placeholder.png'}" alt="${shop.name}" style="width:100%;max-width:300px;">
                <p>${shop.description}</p>
                <p class="address">場所: ${shop.address_general}</p>
                <div class="tags">タグ: ${shop.tags.join(', ')}</div>
                ${shop.website_url ? `<p><a href="${shop.website_url}" target="_blank" rel="noopener noreferrer">ウェブサイトを見る</a></p>` : ''}
            `;
            shopsContainer.appendChild(shopCard);
        });
    }

    // Render Individuals Function
    function renderIndividuals(individualsToRender) {
        if (!individualsContainer) {
            console.error("Individuals container not found!");
            return;
        }
        individualsContainer.innerHTML = ''; // Clear previous content

        if (individualsToRender.length === 0) {
            individualsContainer.innerHTML = '<p>該当する女の子は見つかりませんでした。</p>';
            return;
        }

        individualsToRender.forEach(individual => {
            const individualCard = document.createElement('div');
            individualCard.className = 'individual-card';
            const shop = allShops.find(s => s.id === individual.shop_id);
            const shopName = shop ? shop.name : '不明なお店';

            individualCard.innerHTML = `
                <h3>${individual.name} (${shopName})</h3>
                <img src="${individual.image_url || 'images/individual_placeholder.png'}" alt="${individual.name}" style="width:100%;max-width:200px;">
                <p>${individual.bio}</p>
                <div class="tags">タグ: ${individual.tags.join(', ')}</div>
            `;
            individualsContainer.appendChild(individualCard);
        });
    }

    // Render Tags Function
    function renderTags() {
        if (!shopTagsContainer || !individualTagsContainer) {
            console.error("Tag containers not found!");
            return;
        }
        shopTagsContainer.innerHTML = '';
        individualTagsContainer.innerHTML = '';

        const shopTags = new Set();
        allShops.forEach(shop => Array.isArray(shop.tags) && shop.tags.forEach(tag => shopTags.add(tag)));

        shopTags.forEach(tag => {
            const tagButton = document.createElement('button');
            tagButton.className = 'tag-button';
            tagButton.textContent = tag;
            tagButton.dataset.tag = tag;
            tagButton.addEventListener('click', () => {
                if (activeShopTags.has(tag)) {
                    activeShopTags.delete(tag);
                    tagButton.classList.remove('active');
                } else {
                    activeShopTags.add(tag);
                    tagButton.classList.add('active');
                }
                filterAndRender();
            });
            shopTagsContainer.appendChild(tagButton);
        });

        const individualTags = new Set();
        allIndividuals.forEach(individual => Array.isArray(individual.tags) && individual.tags.forEach(tag => individualTags.add(tag)));

        individualTags.forEach(tag => {
            const tagButton = document.createElement('button');
            tagButton.className = 'tag-button';
            tagButton.textContent = tag;
            tagButton.dataset.tag = tag;
            tagButton.addEventListener('click', () => {
                if (activeIndividualTags.has(tag)) {
                    activeIndividualTags.delete(tag);
                    tagButton.classList.remove('active');
                } else {
                    activeIndividualTags.add(tag);
                    tagButton.classList.add('active');
                }
                filterAndRender();
            });
            individualTagsContainer.appendChild(tagButton);
        });
        console.log("Tags rendered and event listeners added.");
    }

    // Filter and Render Function
    function filterAndRender() {
        console.log("Filtering and rendering...", { activeShopTags, activeIndividualTags });

        // Filter Shops
        let filteredShops = allShops;
        if (activeShopTags.size > 0) {
            filteredShops = allShops.filter(shop => 
                Array.isArray(shop.tags) && shop.tags.some(tag => activeShopTags.has(tag))
            );
        }

        // Filter Individuals
        let filteredIndividuals = allIndividuals;
        // 1. Filter by individual tags
        if (activeIndividualTags.size > 0) {
            filteredIndividuals = filteredIndividuals.filter(individual =>
                Array.isArray(individual.tags) && individual.tags.some(tag => activeIndividualTags.has(tag))
            );
        }

        // 2. Filter by currently displayed shops (if shop tags are active)
        if (activeShopTags.size > 0) {
            const filteredShopIds = new Set(filteredShops.map(shop => shop.id));
            filteredIndividuals = filteredIndividuals.filter(individual => 
                filteredShopIds.has(individual.shop_id)
            );
        }
        
        renderShops(filteredShops);
        renderIndividuals(filteredIndividuals);
        updateTagButtonStates(); // Ensure all buttons reflect current active sets
        console.log("Rendering complete after filtering.");
    }
    
    // Update Tag Button Visual States
    function updateTagButtonStates() {
        document.querySelectorAll('#shop-tags .tag-button').forEach(button => {
            if (activeShopTags.has(button.dataset.tag)) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        document.querySelectorAll('#individual-tags .tag-button').forEach(button => {
            if (activeIndividualTags.has(button.dataset.tag)) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    // Clear Filters Function
    function clearFilters() {
        console.log("Clearing all filters.");
        activeShopTags.clear();
        activeIndividualTags.clear();
        // updateTagButtonStates will be called by filterAndRender
        filterAndRender();
    }

    // Initialize Page Function
    function initializePage() {
        console.log("Initializing page content...");
        if (!allShops.length && !allIndividuals.length) {
            console.warn("No data available to initialize page.");
            if (shopsContainer) shopsContainer.innerHTML = '<p>表示できるお店がありません。</p>';
            if (individualsContainer) individualsContainer.innerHTML = '<p>表示できる女の子がいません。</p>';
            return;
        }
        renderTags(); // Sets up tags and their click listeners
        filterAndRender(); // Initial render based on (empty) active filters
        console.log("Page initialized.");
    }

    // Event Listener for Clear Button
    if (clearFiltersButton) {
        clearFiltersButton.addEventListener('click', clearFilters);
    } else {
        console.error("Clear filters button not found!");
    }

    // Initial Call
    fetchData();

});
