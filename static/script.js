--- START OF FILE script.js ---

const VK_ID = "487502463"; 
let currentCategory = 'all';
let itemsData = []; 

// Основной observer для анимации появления текста/картинок
const animationObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
    });
}, { threshold: 0.1 });

// ИСПРАВЛЕНИЕ 4 (Часть 1): Шпион для меню категорий при скролле
const spyObserver = new IntersectionObserver((entries) => {
    // Работает только если мы смотрим всю коллекцию, иначе меню должно стоять на выбранной категории
    if (currentCategory !== 'all') return;

    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const cat = entry.target.dataset.cat;
            if (cat) highlightMenu(cat);
        }
    });
}, { threshold: 0.5 }); // Срабатывает, когда товар на 50% на экране

function highlightMenu(cat) {
    document.querySelectorAll('.cat-btn').forEach(b => {
        if (b.dataset.cat === cat) b.classList.add('active');
        else b.classList.remove('active');
    });
}

document.addEventListener("DOMContentLoaded", () => {
    loadGallery();
    
    setTimeout(() => {
        const hText = document.querySelector('.hero-text');
        const hImg = document.querySelector('.hero-image-box');
        if(hText) hText.classList.add('visible');
        if(hImg) hImg.classList.add('visible');
    }, 100);

    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            closeModal(event.target.id);
        }
    }

    let debounce;
    document.getElementById('search-input').addEventListener('input', (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => loadGallery(e.target.value), 500);
    });

    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Если кликнули, жестко ставим активный класс
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            currentCategory = e.target.dataset.cat;
            
            // Скролл вверх
            document.getElementById('main-scroller').scrollTo({ top: 0, behavior: 'smooth' });
            
            // Загрузка
            loadGallery();
        });
    });
});

function resetToHero() {
    currentCategory = 'all';
    document.getElementById('search-input').value = '';
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.cat-btn[data-cat="all"]').classList.add('active');
    document.getElementById('main-scroller').scrollTo({ top: 0, behavior: 'smooth' });
    loadGallery();
}

function scrollToNext() {
    document.getElementById('main-scroller').scrollBy({ top: window.innerHeight, behavior: 'smooth' });
}

// ИСПРАВЛЕНИЕ 4 (Часть 2): Плавное выцветание при смене
async function loadGallery(search = '') {
    const hero = document.getElementById('hero-section');
    const container = document.getElementById('dynamic-content');

    // 1. Скрываем (Fade Out)
    container.classList.add('fading');
    
    // Ждем анимацию исчезновения (300ms)
    await new Promise(r => setTimeout(r, 300));

    // Логика показа Hero
    if (search) hero.style.display = 'none';
    else if (currentCategory === 'all') hero.style.display = 'flex';
    else hero.style.display = 'none';

    let url = `/api/items?`;
    if (currentCategory !== 'all') url += `category=${currentCategory}&`;
    if (search) url += `search=${search}`;

    try {
        const res = await fetch(url);
        itemsData = await res.json();
        renderItems();
    } catch (e) { console.error(e); }

    // 2. Показываем (Fade In) с небольшой задержкой для рендеринга
    requestAnimationFrame(() => {
        container.classList.remove('fading');
    });
}

function renderItems() {
    const container = document.getElementById('dynamic-content');
    container.innerHTML = '';
    
    if (itemsData.length === 0) {
        container.innerHTML = '<div style="height:50vh; display:flex; align-items:center; justify-content:center; font-family:var(--font-head); font-size:1.5rem;">Нет работ.</div>';
        return;
    }

    itemsData.forEach(item => {
        const el = document.createElement('section');
        el.className = `slide-section theme-${item.category}`;
        // Добавляем data-cat для шпиона
        el.dataset.cat = item.category; 
        el.innerHTML = getSlideHTML(item);
        container.appendChild(el);
        
        // Подключаем наблюдателей
        animationObserver.observe(el);
        spyObserver.observe(el);
    });
}

function getSlideHTML(item) {
    const images = item.images.length ? item.images : ['/static/favicon.png'];
    const imagesAttr = JSON.stringify(images).replace(/"/g, '&quot;');
    const arrows = images.length > 1 ? `
        <button class="nav-arrow prev-arrow" onclick="changeSlide(this, -1, ${imagesAttr})"><i class="fas fa-chevron-left"></i></button>
        <button class="nav-arrow next-arrow" onclick="changeSlide(this, 1, ${imagesAttr})"><i class="fas fa-chevron-right"></i></button>
    ` : '';

    return `
        <div class="content-wrapper">
            <div class="art-left-col">
                <div class="art-img-container">
                    <img src="${images[0]}" class="art-img" data-idx="0">
                    ${arrows}
                </div>
            </div>
            <div class="art-right-col">
                <div class="art-cat">${item.category}</div>
                <h2 class="art-title">${item.title}</h2>
                <div class="art-price">${item.price} ₽</div>
                <div class="btn-group">
                    <button class="action-btn desc-btn" onclick="openDesc(${item.id})">О работе</button>
                    <button class="action-btn buy-btn" onclick="openVk(${item.id})">Купить</button>
                </div>
            </div>
        </div>
    `;
}

window.changeSlide = function(btn, dir, images) {
    const container = btn.parentElement;
    const imgTag = container.querySelector('.art-img');
    imgTag.style.opacity = '0'; 
    setTimeout(() => {
        let currentIdx = parseInt(imgTag.dataset.idx);
        let newIdx = currentIdx + dir;
        if (newIdx < 0) newIdx = images.length - 1;
        if (newIdx >= images.length) newIdx = 0;
        imgTag.src = images[newIdx];
        imgTag.dataset.idx = newIdx;
        imgTag.onload = () => { imgTag.style.opacity = '1'; }; 
    }, 300);
};

window.openModal = function(id) {
    document.getElementById(id).style.display = 'block';
};

window.closeModal = function(id) {
    document.getElementById(id).style.display = 'none';
};

window.openVk = function(id) {
    const item = itemsData.find(i => i.id === id);
    if(!item) return;
    const text = `Здравствуйте! Хочу приобрести "${item.title}" за ${item.price}р.`;
    navigator.clipboard.writeText(text);
    const url = `https://vk.com/write${VK_ID}?message=${encodeURIComponent(text)}`;
    document.getElementById('vk-go-btn').onclick = () => window.open(url, '_blank');
    openModal('vk-modal');
};

window.openDesc = function(id) {
    const item = itemsData.find(i => i.id === id);
    if(!item) return;
    document.getElementById('desc-title').innerText = item.title;
    document.getElementById('desc-text').innerText = item.description;
    openModal('desc-modal');
};