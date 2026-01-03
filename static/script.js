const VK_ID = "487502463"; 
let currentCategory = 'all';
let viewMode = 'feed';
let itemsData = []; 

// Анимация появления
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
    });
}, { threshold: 0.15 });

document.addEventListener("DOMContentLoaded", () => {
    loadGallery();
    
    document.querySelectorAll('.reveal-element').forEach(el => observer.observe(el));

    let debounce;
    document.getElementById('search-input').addEventListener('input', (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => loadGallery(e.target.value), 500);
    });

    // Обработчик категорий
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // 1. Активируем кнопку
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            // 2. Меняем категорию
            currentCategory = e.target.dataset.cat;
            
            // 3. Анимация полета вверх!
            const scroller = document.getElementById('main-scroller');
            scroller.scrollTo({ top: 0, behavior: 'smooth' });

            // 4. Загружаем данные с небольшой задержкой (пока летит вверх)
            setTimeout(() => loadGallery(), 300);
        });
    });

    document.getElementById('view-toggle-btn').addEventListener('click', toggleView);
});

function scrollToNext() {
    document.getElementById('main-scroller').scrollBy({ top: window.innerHeight, behavior: 'smooth' });
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
        document.getElementById('hero-section').style.display = 'none';
        // При переходе в сетку скроллим вверх
        container.scrollTo({ top: 0 });
    } else {
        btn.innerHTML = '<i class="fas fa-th-large"></i>';
        container.classList.remove('grid-active');
        content.className = '';
        if(currentCategory === 'all') document.getElementById('hero-section').style.display = 'flex';
    }
    renderItems(); 
}

async function loadGallery(search = '') {
    const hero = document.getElementById('hero-section');
    
    if (search) {
        if(viewMode === 'feed') toggleView(); 
    } else if (currentCategory === 'all' && viewMode === 'feed') {
        hero.style.display = 'flex';
    } else {
        hero.style.display = 'none';
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
        container.innerHTML = '<div style="text-align:center; padding:100px; font-size:1.2rem;">В этой категории пока нет работ.</div>';
        return;
    }

    itemsData.forEach(item => {
        const el = document.createElement('div');
        
        if (viewMode === 'feed') {
            // Добавляем класс темы к секции
            el.className = `slide-section theme-${item.category}`;
            // Добавляем декоративные элементы (рамки)
            el.innerHTML = getDecorationsHTML(item.category) + getFeedHTML(item);
            
            el.querySelectorAll('.reveal-element').forEach(animEl => observer.observe(animEl));
        } else {
            el.className = 'grid-item';
            el.innerHTML = getGridHTML(item);
        }
        container.appendChild(el);
    });
}

// Генерирует HTML для рамок в зависимости от категории
function getDecorationsHTML(cat) {
    let decos = '';
    if (cat === 'doll') decos = '<div class="deco deco-top"></div><div class="deco deco-bottom"></div>';
    if (cat === 'weaving') decos = '<div class="deco deco-left"></div><div class="deco deco-right"></div>';
    if (cat === 'painting') decos = '<div class="deco deco-top"></div><div class="deco deco-bottom"></div><div class="deco deco-left"></div><div class="deco deco-right"></div>';
    if (cat === 'decoupage') decos = '<div class="deco deco-corner deco-tl"></div><div class="deco deco-corner deco-tr"></div><div class="deco deco-corner deco-bl"></div><div class="deco deco-corner deco-br"></div>';
    if (cat === 'gifts') decos = '<div class="deco"></div>';
    return decos;
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
            <div class="art-left-col reveal-element">
                <div class="art-img-wrapper">
                    <img src="${images[0]}" class="art-img" data-idx="0">
                    ${arrowBtns}
                </div>
            </div>
            <div class="art-right-col reveal-element delay-100">
                <h2 class="art-title">${item.title}</h2>
                <div class="art-price">${item.price} ₽</div>
                <div class="btn-group">
                    <button class="action-btn desc-btn" onclick="openDesc(${item.id})">О работе</button>
                    <button class="action-btn buy-btn" onclick="openVk(${item.id})">Приобрести</button>
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
            <div style="font-family:'Cormorant Garamond'; font-size:1.2rem; font-weight:bold;">${item.title}</div>
            <div style="color:#b07d62;">${item.price} ₽</div>
            <button class="action-btn buy-btn" style="width:100%; margin-top:10px;" onclick="openVk(${item.id})">Купить</button>
        </div>
    `;
}

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

window.openVk = function(id) {
    const item = itemsData.find(i => i.id === id);
    if(!item) return;
    const text = `Здравствуйте! Хочу приобрести работу "${item.title}" за ${item.price}р.`;
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