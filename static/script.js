const VK_ID = "487502463"; 
let currentCategory = 'all';
let itemsData = []; 

// Анимация при скролле
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
    });
}, { threshold: 0.1 });

document.addEventListener("DOMContentLoaded", () => {
    loadGallery();
    
    // Анимация Hero
    setTimeout(() => {
        const hText = document.querySelector('.hero-text');
        const hImg = document.querySelector('.hero-image-box');
        if(hText) hText.classList.add('visible');
        if(hImg) hImg.classList.add('visible');
    }, 100);

    // Закрытие модалок по фону
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
            
            // Скролл вверх
            document.getElementById('main-scroller').scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => loadGallery(), 300);
        });
    });
});

function scrollToNext() {
    document.getElementById('main-scroller').scrollBy({ top: window.innerHeight, behavior: 'smooth' });
}

// Загрузка
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
        container.innerHTML = '<div style="height:50vh; display:flex; align-items:center; justify-content:center; font-family:var(--font-head); font-size:1.5rem;">Нет работ.</div>';
        return;
    }

    itemsData.forEach(item => {
        const el = document.createElement('section');
        el.className = `slide-section theme-${item.category}`;
        el.innerHTML = getSlideHTML(item);
        container.appendChild(el);
        // Запускаем наблюдение (чтобы текст выезжал)
        observer.observe(el);
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

// Смена слайда
window.changeSlide = function(btn, dir, images) {
    const container = btn.parentElement;
    const imgTag = container.querySelector('.art-img');
    imgTag.style.opacity = '0'; // fade out
    setTimeout(() => {
        let currentIdx = parseInt(imgTag.dataset.idx);
        let newIdx = currentIdx + dir;
        if (newIdx < 0) newIdx = images.length - 1;
        if (newIdx >= images.length) newIdx = 0;
        imgTag.src = images[newIdx];
        imgTag.dataset.idx = newIdx;
        imgTag.onload = () => { imgTag.style.opacity = '1'; }; // fade in
    }, 300);
};

// Модалки
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