const VK_ID = "487502463"; 
let currentCategory = 'all';
let viewMode = 'feed';
let itemsData = []; 

document.addEventListener("DOMContentLoaded", () => {
    loadGallery();
    
    // Поиск с задержкой (чтобы не дергалось)
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

function scrollToGallery() {
    // Скроллим к первому элементу после Hero
    const firstItem = document.querySelector('.slide-section');
    if(firstItem) firstItem.scrollIntoView({ behavior: 'smooth' });
}

function toggleView() {
    viewMode = (viewMode === 'feed') ? 'grid' : 'feed';
    const btn = document.getElementById('view-toggle-btn');
    
    if (viewMode === 'grid') {
        btn.innerHTML = '<i class="fas fa-stream"></i>';
        document.body.classList.remove('snap-active'); // Выключаем магнит
    } else {
        btn.innerHTML = '<i class="fas fa-th-large"></i>';
        document.body.classList.add('snap-active'); // Включаем магнит
    }
    renderItems(); 
}

async function loadGallery(search = '') {
    const hero = document.getElementById('hero-wrapper');
    const container = document.getElementById('dynamic-content');
    
    // Логика отображения Hero секции
    if (search || currentCategory !== 'all') {
        hero.style.display = 'none';
        // Если поиск, выключаем магнит, чтобы удобно листать результаты
        document.body.classList.remove('snap-active');
    } else {
        if(viewMode === 'feed') {
             hero.style.display = 'flex';
             document.body.classList.add('snap-active'); // Включаем магнит на главной
        } else {
             hero.style.display = 'none';
        }
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
            el.className = 'slide-section'; // Секция для магнитного скролла
            el.innerHTML = getFeedHTML(item);
        } else {
            el.className = 'grid-item';
            el.innerHTML = getGridHTML(item);
        }
        container.appendChild(el);
    });
}

function getFeedHTML(item) {
    const images = item.images.length ? item.images : ['/static/favicon.png'];
    // Сохраняем ссылки для переключения
    const imagesAttr = JSON.stringify(images).replace(/"/g, '&quot;');
    
    const arrowBtns = images.length > 1 ? `
        <button class="slider-btn prev-btn" onclick="switchImage(this, -1, ${imagesAttr})">&#10094;</button>
        <button class="slider-btn next-btn" onclick="switchImage(this, 1, ${imagesAttr})">&#10095;</button>
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
                    <span class="art-price">${item.price} ₽</span>
                </div>
                <div class="btn-group">
                    <!-- Передаем ID, а не текст описания, чтобы не ломалось -->
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
        <div class="grid-details">
            <b>${item.title}</b>
            <p>${item.price} ₽</p>
            <button class="action-btn buy-btn" style="width:100%" onclick="openVk(${item.id})">Купить</button>
        </div>
    `;
}

// --- Анимация переключения фото ---
window.switchImage = function(btn, dir, images) {
    const wrapper = btn.parentElement;
    const imgTag = wrapper.querySelector('.art-img');
    
    // 1. Добавляем класс затухания
    imgTag.classList.add('fade-out');

    // 2. Ждем 200мс, меняем картинку, убираем класс
    setTimeout(() => {
        let currentIdx = parseInt(imgTag.dataset.idx);
        let newIdx = currentIdx + dir;
        
        if (newIdx < 0) newIdx = images.length - 1;
        if (newIdx >= images.length) newIdx = 0;
        
        imgTag.src = images[newIdx];
        imgTag.dataset.idx = newIdx;
        
        // Когда картинка загрузится (из кэша быстро), убираем прозрачность
        imgTag.onload = () => imgTag.classList.remove('fade-out');
        // На случай если она уже в кэше
        setTimeout(() => imgTag.classList.remove('fade-out'), 50);
        
    }, 200); // Время должно совпадать с CSS transition
};

// --- Модальные окна ---
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