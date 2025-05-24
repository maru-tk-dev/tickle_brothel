document.addEventListener('DOMContentLoaded', () => {
    console.log("Shop detail page DOM fully loaded and parsed.");

    // Get DOM elements
    const shopNameElement = document.getElementById('shop-name');
    const shopImageElement = document.getElementById('shop-image');
    const shopDescriptionElement = document.getElementById('shop-description');
    const shopAddressElement = document.getElementById('shop-address');
    const shopTagsElement = document.getElementById('shop-tags');
    const shopWebsiteElement = document.getElementById('shop-website');
    const individualsListElement = document.getElementById('individuals-list');
    const pageTitle = document.querySelector('title');

    // Get shop ID from URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const shopId = urlParams.get('id');

    if (!shopId) {
        if (shopNameElement) shopNameElement.textContent = 'お店のIDが見つかりません。';
        console.error("Shop ID not found in URL parameters.");
        return;
    }

    async function fetchAndDisplayShopDetails() {
        try {
            const shopsResponse = await fetch('data/shops.json');
            if (!shopsResponse.ok) throw new Error(`HTTP error! status: ${shopsResponse.status} while fetching shops.json`);
            const allShops = await shopsResponse.json();

            const individualsResponse = await fetch('data/individuals.json');
            if (!individualsResponse.ok) throw new Error(`HTTP error! status: ${individualsResponse.status} while fetching individuals.json`);
            const allIndividuals = await individualsResponse.json();

            const shop = allShops.find(s => s.id === shopId);

            if (!shop) {
                if (shopNameElement) shopNameElement.textContent = 'お店が見つかりません。';
                console.error("Shop not found for ID:", shopId);
                return;
            }

            // Populate shop details
            if (pageTitle) pageTitle.textContent = `${shop.name} - お店の詳細 | くすぐりフェチ専科`;
            if (shopNameElement) shopNameElement.textContent = shop.name;
            if (shopImageElement) {
                shopImageElement.src = shop.image_url || 'images/shop_placeholder.png';
                shopImageElement.alt = shop.name;
            }
            if (shopDescriptionElement) shopDescriptionElement.textContent = shop.description;
            if (shopAddressElement) shopAddressElement.textContent = `場所: ${shop.address_general}`;
            if (shopTagsElement) shopTagsElement.textContent = `タグ: ${Array.isArray(shop.tags) ? shop.tags.join(', ') : 'なし'}`;
            if (shopWebsiteElement) {
                if (shop.website_url) {
                    shopWebsiteElement.innerHTML = `<a href="${shop.website_url}" target="_blank" rel="noopener noreferrer">ウェブサイトを見る</a>`;
                } else {
                    shopWebsiteElement.innerHTML = 'ウェブサイトなし';
                }
            }

            // Filter and display individuals for this shop
            const shopIndividuals = allIndividuals.filter(ind => ind.shop_id === shopId);
            if (individualsListElement) {
                individualsListElement.innerHTML = ''; // Clear loading message
                if (shopIndividuals.length > 0) {
                    shopIndividuals.forEach(individual => {
                        const individualCard = document.createElement('div');
                        individualCard.className = 'individual-card'; // Reuse class from main.js for styling
                        individualCard.innerHTML = `
                            <h3>${individual.name}</h3>
                            <img src="${individual.image_url || 'images/individual_placeholder.png'}" alt="${individual.name}" style="width:100%;max-width:200px;">
                            <p>${individual.bio}</p>
                            <div class="tags">タグ: ${Array.isArray(individual.tags) ? individual.tags.join(', ') : 'なし'}</div>
                        `;
                        individualsListElement.appendChild(individualCard);
                    });
                } else {
                    individualsListElement.innerHTML = '<p>このお店に所属している女の子の情報はまだありません。</p>';
                }
            }
            console.log("Shop details and individuals rendered for shop ID:", shopId);

        } catch (error) {
            console.error("Failed to fetch or display shop details:", error);
            if (shopNameElement) shopNameElement.textContent = '情報の読み込みに失敗しました。';
            if (individualsListElement) individualsListElement.innerHTML = `<p>情報の読み込みに失敗しました。詳細: ${error.message}</p>`;
        }
    }

    fetchAndDisplayShopDetails();
});
