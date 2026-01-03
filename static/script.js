const VK_ID = "487502463"; 
let currentCategory = 'all';
let viewMode = 'feed';
let itemsData = []; // Храним загруженные данные

document.addEventListener("DOMContentLoaded", () => {
    loadGallery();
    
    // Поиск
    document.getElementById('search-input').addEventListener('input', (e) => {
        loadGallery(e.target.value);
    });

    // Категории
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentCategory = e.target.dataset.cat;
            loadGallery();
        });
    });

    // Переключение вида
    document.getElementById('view-toggle-btn').addEventListener('click', toggleView);
});

function scrollToGallery() {
    const el = document.getElementById('gallery-container');
    el.scrollIntoView({ behavior: 'smooth' });
}

function toggleView() {
    const container = document.getElementById('gallery-container');
    const btn = document.getElementById('view-toggle-btn');
    if (viewMode === 'feed') {
        viewMode = 'grid';
        container.className = 'grid-mode';
        btn.innerHTML = '<i class="fas fa-stream"></i>';
    } else {
        viewMode = 'feed';
        container.className = 'feed-mode';
        btn.innerHTML = '<i class="fas fa-th-large"></i>';
    }
    renderItems(); // Перерисовка без перезагрузки
}

async function loadGallery(search = '') {
    const hero = document.getElementById('hero-wrapper');
    const container = document.getElementById('dynamic-content');
    
    // Скрываем Hero, если ищем или фильтруем
    if (search || currentCategory !== 'all') {
        hero.style.display = 'none';
        container.style.paddingTop = '120px'; // Отступ для фиксированной шапки
    } else {
        hero.style.display = 'flex';
        container.style.paddingTop = '0';
    }

    let url = `/api/items?`;
    if (currentCategory !== 'all') url += `category=${currentCategory}&`;
    if (search) url += `search=${search}`;

    try {
        const res = await fetch(url);
        itemsData = await res.json();
        renderItems();
    } catch (e) {
        console.error(e);
    }
}

function renderItems() {
    const container = document.getElementById('dynamic-content');
    container.innerHTML = '';
    
    if (itemsData.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:50px;">Ничего не найдено</div>';
        return;
    }

    itemsData.forEach(item => {
        const el = document.createElement('div');
        if (viewMode === 'feed') {
            el.className = 'slide-section';
            el.innerHTML = getFeedHTML(item);
        } else {
            el.className = 'grid-item';
            el.innerHTML = getGridHTML(item);
        }
        container.appendChild(el);
    });
}

function getFeedHTML(item) {
    // Если картинок нет, ставим заглушку. Если есть, берем первую.
    const images = item.images.length ? item.images : ['/static/placeholder.png'];
    // Сохраняем массив картинок в data-атрибут (или в JS переменную, но так проще)
    const imagesJson = JSON.stringify(images).replace(/"/g, '&quot;');
    
    const arrowBtns = images.length > 1 ? `
        <button class="slider-btn prev-btn" onclick="switchImage(this, -1, ${imagesJson})">&#10094;</button>
        <button class="slider-btn next-btn" onclick="switchImage(this, 1, ${imagesJson})">&#10095;</button>
    ` : '';

    return `
        <div class="art-card">
            <div class="art-img-wrapper">
                <img src="${images[0]}" class="art-img" data-idx="0">
                ${arrowBtns}
            </div>
            <div class="art-info">
                <div>
                    <h2 class="art-title">${item.title}</h2>
                    <span style="color:var(--accent); font-weight:bold;">${item.price} ₽</span>
                </div>
                <div class="btn-group">
                    <button class="action-btn desc-btn" onclick="openDesc('${item.title}', \`${item.description}\`)">Описание</button>
                    <button class="action-btn" onclick="openVk('${item.title}', ${item.price})">Купить</button>
                </div>
            </div>
        </div>
    `;
}

function getGridHTML(item) {
    const img = item.images.length ? item.images[0] : '';
    return `
        <img src="${img}" class="grid-img">
        <div class="grid-details">
            <b>${item.title}</b>
            <p>${item.price} ₽</p>
            <button class="action-btn" style="width:100%" onclick="openVk('${item.title}', ${item.price})">Купить</button>
        </div>
    `;
}

// --- Слайдер картинок ---
window.switchImage = function(btn, dir, images) {
    const wrapper = btn.parentElement;
    const imgTag = wrapper.querySelector('.art-img');
    let currentIdx = parseInt(imgTag.dataset.idx);
    
    let newIdx = currentIdx + dir;
    if (newIdx < 0) newIdx = images.length - 1;
    if (newIdx >= images.length) newIdx = 0;
    
    imgTag.src = images[newIdx];
    imgTag.dataset.idx = newIdx;
};

// --- Модальные окна ---
window.openVk = function(title, price) {
    const text = `Здравствуйте! Хочу купить "${title}" за ${price}р.`;
    navigator.clipboard.writeText(text);
    const url = `https://vk.com/write${VK_ID}?message=${encodeURIComponent(text)}`;
    document.getElementById('vk-go-btn').onclick = () => window.open(url, '_blank');
    document.getElementById('vk-modal').style.display = 'block';
};

window.openDesc = function(title, desc) {
    document.getElementById('desc-title').innerText = title;
    document.getElementById('desc-text').innerText = desc;
    document.getElementById('desc-modal').style.display = 'block';
};

window.closeModal = function(id) {
    document.getElementById(id).style.display = 'none';
};