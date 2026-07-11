document.addEventListener('DOMContentLoaded', () => {
    const elements = {
        name: document.getElementById('shop-name'),
        image: document.getElementById('shop-image'),
        description: document.getElementById('shop-description'),
        address: document.getElementById('shop-address'),
        tags: document.getElementById('shop-tags'),
        website: document.getElementById('shop-website'),
        individualSection: document.getElementById('shop-individuals-container'),
        individualList: document.getElementById('individuals-list'),
        metaDescription: document.getElementById('meta-description'),
        metaRobots: document.getElementById('meta-robots'),
        canonical: document.getElementById('canonical-url'),
        ogTitle: document.getElementById('og-title'),
        ogDescription: document.getElementById('og-description'),
        ogUrl: document.getElementById('og-url'),
        twitterTitle: document.getElementById('twitter-title'),
        twitterDescription: document.getElementById('twitter-description')
    };

    const shopId = new URLSearchParams(window.location.search).get('id');
    const shops = Array.isArray(window.allShopsData) ? window.allShopsData : [];
    const individuals = Array.isArray(window.allIndividualsData) ? window.allIndividualsData : [];
    const shop = shops.find((item) => item.id === shopId);

    function showError(message) {
        elements.metaRobots?.setAttribute('content', 'noindex, follow');
        if (elements.name) elements.name.textContent = message;
        if (elements.description) elements.description.textContent = '店舗一覧からもう一度お選びください。';
    }

    function renderTags(tags) {
        if (!elements.tags) return;
        elements.tags.textContent = '';
        (Array.isArray(tags) ? tags : []).forEach((tag) => {
            const item = document.createElement('span');
            item.textContent = tag;
            elements.tags.appendChild(item);
        });
    }

    function renderWebsite(url) {
        if (!elements.website) return;
        elements.website.textContent = '';
        if (!url) {
            elements.website.textContent = '公式サイトの登録はありません。';
            return;
        }

        const link = document.createElement('a');
        link.className = 'primary-button';
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = '公式サイトを見る ↗';
        elements.website.appendChild(link);
    }

    function renderIndividuals() {
        const publishedIndividuals = individuals.filter((individual) => (
            individual.shop_id === shopId && individual.published === true
        ));

        if (!publishedIndividuals.length || !elements.individualSection || !elements.individualList) return;

        elements.individualList.textContent = '';
        publishedIndividuals.forEach((individual) => {
            const card = document.createElement('article');
            card.className = 'individual-card';

            const image = document.createElement('img');
            image.src = individual.image_url || 'images/individual_placeholder.png';
            image.alt = individual.name;
            image.loading = 'lazy';

            const heading = document.createElement('h3');
            heading.textContent = individual.name;

            const bio = document.createElement('p');
            bio.textContent = individual.bio || '';

            card.append(image, heading, bio);
            elements.individualList.appendChild(card);
        });

        elements.individualSection.hidden = false;
    }

    function addStructuredData() {
        const data = {
            '@context': 'https://schema.org',
            '@type': 'LocalBusiness',
            name: shop.name,
            description: shop.description,
            url: window.location.href,
            address: {
                '@type': 'PostalAddress',
                addressLocality: shop.address_general,
                addressCountry: 'JP'
            }
        };
        if (shop.website_url) data.sameAs = shop.website_url;
        if (shop.image_url) data.image = new URL(shop.image_url, document.baseURI).href;

        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(data);
        document.head.appendChild(script);
    }

    if (!shopId) {
        showError('お店のIDが見つかりません。');
        return;
    }

    if (!shop) {
        showError('お店が見つかりません。');
        return;
    }

    const detailTitle = `${shop.name} - お店の詳細 | くすぐりフェチ専科`;
    const detailUrl = new URL(window.location.pathname, window.location.origin);
    detailUrl.searchParams.set('id', shop.id);

    document.title = detailTitle;
    elements.metaDescription?.setAttribute('content', shop.description);
    elements.metaRobots?.setAttribute('content', 'index, follow');
    elements.canonical?.setAttribute('href', detailUrl.href);
    elements.ogTitle?.setAttribute('content', detailTitle);
    elements.ogDescription?.setAttribute('content', shop.description);
    elements.ogUrl?.setAttribute('content', detailUrl.href);
    elements.twitterTitle?.setAttribute('content', detailTitle);
    elements.twitterDescription?.setAttribute('content', shop.description);

    if (elements.name) elements.name.textContent = shop.name;
    if (elements.description) elements.description.textContent = shop.description;
    if (elements.address) elements.address.textContent = shop.address_general;
    if (elements.image) {
        elements.image.src = shop.image_url || 'images/shop_placeholder.png';
        elements.image.alt = shop.name;
    }

    renderTags(shop.tags);
    renderWebsite(shop.website_url);
    renderIndividuals();
    addStructuredData();
});
