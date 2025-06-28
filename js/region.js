// region.js - display shops filtered by region

document.addEventListener('DOMContentLoaded', () => {
    const region = document.body.dataset.region;
    const shopsContainer = document.getElementById('shops-container');

    function renderShops(shops) {
        shopsContainer.innerHTML = '';
        if (!shops.length) {
            shopsContainer.innerHTML = '<p>該当するお店が見つかりませんでした。</p>';
            return;
        }
        shops.forEach(shop => {
            const card = document.createElement('div');
            card.className = 'shop-card';
            card.innerHTML = `
                <h3><a href="shop-detail.html?id=${shop.id}">${shop.name}</a></h3>
                <img src="${shop.image_url || 'images/shop_placeholder.png'}" alt="${shop.name}" style="width:100%;max-width:300px;height:auto;object-fit:contain;">
                <p>${shop.description}</p>
                <p class="address">場所: ${shop.address_general}</p>
                <div class="tags">タグ: ${Array.isArray(shop.tags) ? shop.tags.join(', ') : 'タグなし'}</div>
                ${shop.website_url ? `<p><a href="${shop.website_url}" target="_blank" rel="noopener noreferrer">ウェブサイトを見る</a></p>` : ''}
                <p><a href="shop-detail.html?id=${shop.id}">詳細を見る</a></p>
            `;
            shopsContainer.appendChild(card);
        });
    }

    async function fetchShops() {
        try {
            const res = await fetch('data/shops.json');
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();
            const filtered = data.filter(shop => Array.isArray(shop.tags) && shop.tags.includes(region));
            renderShops(filtered);
        } catch (err) {
            console.error('Failed to load shops:', err);
            shopsContainer.innerHTML = `<p>データの読み込みに失敗しました。詳細: ${err.message}</p>`;
        }
    }

    fetchShops();
});
