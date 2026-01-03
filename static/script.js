const VK_ID = "487502463"; 
let currentCategory = 'all';
let itemsData = []; 

// Наблюдатель появления (для анимаций)
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.2 });

document.addEventListener("DOMContentLoaded", () => {
    loadGallery();
    
    // Анимация Hero секции
    setTimeout(() => {
        document.querySelector('.hero-text').classList.add('visible');
        document.querySelector('.hero-image-box').classList.add('visible');
    }, 100);

    // Закрытие модалок по клику на фон (Overlay)
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            closeModal(event.target.id);
        }
    }

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
            
            // Плавный скролл вверх
            document.getElementById('main-scroller').scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => loadGallery(), 400);
        });
    });
});

function scrollToNext() {
    document.getElementById('main-scroller').scrollBy({ top: window.innerHeight, behavior: 'smooth' });
}

// --- ЗАГРУЗКА ДАННЫХ ---
async function loadGallery(search = '') {
    const hero = document.getElementById('hero-section');
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
}

function renderItems() {
    const container = document.getElementById('dynamic-content');
    container.innerHTML = '';
    
    if (itemsData.length === 0) {
        container.innerHTML = '<div style="height:50vh; display:flex; align-items:center; justify-content:center; font-family:var(--font-head); font-size:1.5rem;">В этой категории пока нет работ.</div>';
        return;
    }

    itemsData.forEach(item => {
        const el = document.createElement('section');
        el.className = `slide-section theme-${item.category}`; // Класс для уникального фона
        el.innerHTML = getSlideHTML(item);
        container.appendChild(el);
        observer.observe(el); // Следим за появлением
    });
}

function getSlideHTML(item) {
    const images = item.images.length ? item.images : ['/static/favicon.png'];
    const imagesAttr = JSON.stringify(images).replace(/"/g, '&quot;');
    
    // Стрелки только если картинок > 1
    const arrows = images.length > 1 ? `
        <button class="nav-arrow prev-arrow" onclick="changeSlide(this, -1, ${imagesAttr})"><i class="fas fa-chevron-left"></i></button>
        <button class="nav-arrow next-arrow" onclick="changeSlide(this, 1, ${imagesAttr})"><i class="fas fa-chevron-right"></i></button>
    ` : '';

    return `
        <div class="content-wrapper">
            <!-- ЛЕВАЯ КОЛОНКА: ФОТО В РАМЕ -->
            <div class="art-left-col">
                <div class="art-img-container">
                    <img src="${images[0]}" class="art-img" data-idx="0">
                    ${arrows}
                </div>
            </div>
            
            <!-- ПРАВАЯ КОЛОНКА: ТЕКСТ -->
            <div class="art-right-col">
                <div class="art-cat">${getCatName(item.category)}</div>
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

function getCatName(cat) {
    const names = { 'doll': 'Кукла', 'weaving': 'Ткачество', 'painting': 'Роспись', 'scrap': 'Скрапбукинг', 'decoupage': 'Декупаж', 'gifts': 'Подарки' };
    return names[cat] || 'Ручная работа';
}

// --- АНИМАЦИЯ ПЕРЕКЛЮЧЕНИЯ ФОТО (CROSS FADE) ---
window.changeSlide = function(btn, dir, images) {
    const container = btn.parentElement;
    const imgTag = container.querySelector('.art-img');
    
    // 1. Уменьшаем прозрачность (Fade Out)
    imgTag.style.opacity = '0';
    
    setTimeout(() => {
        // 2. Меняем источник
        let currentIdx = parseInt(imgTag.dataset.idx);
        let newIdx = currentIdx + dir;
        if (newIdx < 0) newIdx = images.length - 1;
        if (newIdx >= images.length) newIdx = 0;
        
        imgTag.src = images[newIdx];
        imgTag.dataset.idx = newIdx;
        
        // 3. Возвращаем прозрачность (Fade In)
        // Небольшая задержка, чтобы браузер успел подхватить src
        imgTag.onload = () => { imgTag.style.opacity = '1'; };
        // Страховка если картинка в кэше
        setTimeout(() => { imgTag.style.opacity = '1'; }, 50);
        
    }, 400); // Ждем пока исчезнет (время должно совпадать с CSS transition)
};

// --- МОДАЛЬНЫЕ ОКНА ---
window.openModal = function(id) {
    const m = document.getElementById(id);
    m.style.display = 'block';
    setTimeout(() => m.classList.add('show'), 10); // Плавное появление
};

window.closeModal = function(id) {
    const m = document.getElementById(id);
    m.classList.remove('show');
    setTimeout(() => m.style.display = 'none', 300); // Ждем анимацию исчезновения
};

window.openVk = function(id) {
    const item = itemsData.find(i => i.id === id);
    if(!item) return;
    const text = `Здравствуйте! Хочу приобрести работу "${item.title}" за ${item.price}р.`;
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