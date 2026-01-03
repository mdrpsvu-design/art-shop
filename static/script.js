const VK_ID = "487502463"; 
let currentCategory = 'all';
let viewMode = 'feed';
let itemsData = []; 

// Настройка Анимации появления
const observerOptions = {
    root: document.getElementById('main-scroller'), // Следим внутри скролл-контейнера
    threshold: 0.2 // Срабатывает когда видно 20% элемента
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);


document.addEventListener("DOMContentLoaded", () => {
    loadGallery();
    
    // Наблюдаем за элементами в Hero секции сразу
    document.querySelectorAll('.reveal-element').forEach(el => observer.observe(el));

    // Поиск
    let debounce;
    document.getElementById('search-input').addEventListener('input', (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => loadGallery(e.target.value), 500);
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

    document.getElementById('view-toggle-btn').addEventListener('click', toggleView);
});

function scrollToNext() {
    const container = document.getElementById('main-scroller');
    container.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
}

function toggleView() {
    viewMode = (viewMode === 'feed') ? 'grid' : 'feed';
    const btn = document.getElementById('view-toggle-btn');
    const container = document.getElementById('main-scroller');
    const content = document.getElementById('dynamic-content');
    
    if (viewMode === 'grid') {
        btn.innerHTML = '<i class="fas fa-stream"></i>';
        container.classList.add('grid-active');
        content.className = 'grid-container';
        // В сетке скрываем Hero
        document.getElementById('hero-section').style.display = 'none';
    } else {
        btn.innerHTML = '<i class="fas fa-th-large"></i>';
        container.classList.remove('grid-active');
        content.className = '';
        document.getElementById('hero-section').style.display = 'flex';
    }
    renderItems(); 
}

async function loadGallery(search = '') {
    const hero = document.getElementById('hero-section');
    
    // Если поиск - скрываем Hero и переключаем в Grid (удобнее искать)
    if (search) {
        if(viewMode === 'feed') toggleView(); // Принудительно в сетку при поиске
    } else if (currentCategory === 'all' && viewMode === 'feed') {
        hero.style.display = 'flex';
    }

    let url = `/api/items?`;
    if (currentCategory !== 'all') url += `category=${currentCategory}&`;
    if (search) url += `search=${search}`;

    try {
        const res = await fetch(url);
        itemsData = await res.json();
        renderItems();
    } catch (e) { console.error(e); }
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
            // Добавляем наблюдение за анимацией
            el.querySelectorAll('.reveal-element').forEach(animEl => observer.observe(animEl));
        } else {
            el.className = 'grid-item';
            el.innerHTML = getGridHTML(item);
        }
        container.appendChild(el);
    });
}

function getFeedHTML(item) {
    const images = item.images.length ? item.images : ['/static/favicon.png'];
    const imagesAttr = JSON.stringify(images).replace(/"/g, '&quot;');
    
    const arrowBtns = images.length > 1 ? `
        <button class="slider-btn prev-btn" onclick="switchImage(this, -1, ${imagesAttr})">&#10094;</button>
        <button class="slider-btn next-btn" onclick="switchImage(this, 1, ${imagesAttr})">&#10095;</button>
    ` : '';

    return `
        <div class="content-wrapper">
            <!-- Левая колонка: Фото -->
            <div class="art-left-col reveal-element">
                <div class="art-img-wrapper">
                    <img src="${images[0]}" class="art-img" data-idx="0">
                    ${arrowBtns}
                </div>
            </div>
            
            <!-- Правая колонка: Инфо -->
            <div class="art-right-col reveal-element delay-100">
                <h2 class="art-title">${item.title}</h2>
                <div class="art-price">${item.price} ₽</div>
                
                <div class="btn-group">
                    <button class="action-btn desc-btn" onclick="openDesc(${item.id})">Описание</button>
                    <button class="action-btn buy-btn" onclick="openVk(${item.id})">Купить</button>
                </div>
            </div>
        </div>
    `;
}

function getGridHTML(item) {
    const img = item.images.length ? item.images[0] : '';
    return `
        <img src="${img}" class="grid-img" loading="lazy">
        <div class="grid-info">
            <b>${item.title}</b>
            <p>${item.price} ₽</p>
            <button class="action-btn buy-btn" style="width:100%; font-size:0.9rem" onclick="openVk(${item.id})">Купить</button>
        </div>
    `;
}

// Анимация фото
window.switchImage = function(btn, dir, images) {
    const wrapper = btn.parentElement;
    const imgTag = wrapper.querySelector('.art-img');
    imgTag.classList.add('fade-out');
    setTimeout(() => {
        let currentIdx = parseInt(imgTag.dataset.idx);
        let newIdx = currentIdx + dir;
        if (newIdx < 0) newIdx = images.length - 1;
        if (newIdx >= images.length) newIdx = 0;
        imgTag.src = images[newIdx];
        imgTag.dataset.idx = newIdx;
        imgTag.onload = () => imgTag.classList.remove('fade-out');
        setTimeout(() => imgTag.classList.remove('fade-out'), 50);
    }, 200);
};

// Модалки
window.openVk = function(id) {
    const item = itemsData.find(i => i.id === id);
    if(!item) return;
    const text = `Здравствуйте! Хочу купить "${item.title}" за ${item.price}р.`;
    navigator.clipboard.writeText(text);
    const url = `https://vk.com/write${VK_ID}?message=${encodeURIComponent(text)}`;
    document.getElementById('vk-go-btn').onclick = () => window.open(url, '_blank');
    document.getElementById('vk-modal').style.display = 'block';
};

window.openDesc = function(id) {
    const item = itemsData.find(i => i.id === id);
    if(!item) return;
    document.getElementById('desc-title').innerText = item.title;
    document.getElementById('desc-text').innerText = item.description;
    document.getElementById('desc-modal').style.display = 'block';
};

window.closeModal = function(id) {
    document.getElementById(id).style.display = 'none';
};