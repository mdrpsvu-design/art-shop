const TG_USER = "martianovaolga"; 
let currentCategory = 'all';
let allLoadedItems = []; // Хранилище всех загруженных товаров (для модалок)
let currentPage = 1;
let isLoading = false;
let hasMoreItems = true;
let searchDebounceStr = '';

// Observer для анимации появления (прозрачность -> видимость)
const animationObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
    });
}, { threshold: 0.1 });

// Observer для подсветки меню категорий
const spyObserver = new IntersectionObserver((entries) => {
    if (currentCategory !== 'all') return;
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const cat = entry.target.dataset.cat;
            if (cat) highlightMenu(cat);
        }
    });
}, { threshold: 0.5 });

// Observer для бесконечной прокрутки (следит за "дном" списка)
const sentinelObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && hasMoreItems && !isLoading) {
            loadNextPage();
        }
    });
}, { rootMargin: "200px" }); // Начинаем грузить за 200px до конца

function highlightMenu(cat) {
    document.querySelectorAll('.cat-btn').forEach(b => {
        if (b.dataset.cat === cat) b.classList.add('active');
        else b.classList.remove('active');
    });
}

document.addEventListener("DOMContentLoaded", () => {
    // Первая инициализация
    resetGalleryState();
    loadNextPage();
    
    setTimeout(() => {
        const hText = document.querySelector('.hero-text');
        const hImg = document.querySelector('.hero-image-box');
        if(hText) hText.classList.add('visible');
        if(hImg) hImg.classList.add('visible');
    }, 100);

    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) closeModal(event.target.id);
    }

    let debounce;
    document.getElementById('search-input').addEventListener('input', (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            searchDebounceStr = e.target.value;
            resetGalleryState();
            loadNextPage();
        }, 500);
    });

    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            currentCategory = e.target.dataset.cat;
            searchDebounceStr = ''; // Сброс поиска при смене категории
            document.getElementById('search-input').value = '';

            document.getElementById('main-scroller').scrollTo({ top: 0, behavior: 'smooth' });
            
            resetGalleryState();
            loadNextPage();
        });
    });
});

function resetToHero() {
    // 1. Очищаем поле поиска визуально
    document.getElementById('search-input').value = '';

    // 2. Проверяем, нужно ли перезагружать данные.
    // Перезагрузка нужна ТОЛЬКО если:
    // А) Была выбрана конкретная категория (не 'all')
    // Б) Или был активен поиск
    const needReload = (currentCategory !== 'all') || (searchDebounceStr !== '');

    // 3. Сбрасываем внутренние переменные в дефолт
    currentCategory = 'all';
    searchDebounceStr = '';

    // 4. Обновляем кнопки меню (подсвечиваем "Коллекция")
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.cat-btn[data-cat="all"]').classList.add('active');

    // 5. Гарантируем, что Hero-секция видима (она могла скрыться при поиске)
    document.getElementById('hero-section').style.display = 'flex';

    // 6. Скроллим наверх
    document.getElementById('main-scroller').scrollTo({ top: 0, behavior: 'smooth' });

    // 7. Самое важное:
    if (needReload) {
        // Если мы пришли из "Кукол" или поиска -> нам нужно сбросить список,
        // чтобы показать полную коллекцию заново.
        resetGalleryState();
        loadNextPage();
    } else {
        // Если мы и так смотрели "Коллекцию" -> НИЧЕГО НЕ УДАЛЯЕМ.
        // Просто скроллим вверх (пункт 6). Все прогруженные товары остаются внизу.
    }
}

function scrollToNext() {
    document.getElementById('main-scroller').scrollBy({ top: window.innerHeight, behavior: 'smooth' });
}

// Сброс состояния перед новой фильтрацией/категорией
function resetGalleryState() {
    currentPage = 1;
    hasMoreItems = true;
    allLoadedItems = [];
    isLoading = false;
    
    const container = document.getElementById('dynamic-content');
    container.innerHTML = ''; // Очищаем старые товары
    
    // Удаляем старый сентинел (индикатор загрузки), если был
    const oldSentinel = document.getElementById('scroll-sentinel');
    if (oldSentinel) oldSentinel.remove();
    
    // Логика Hero секции
    const hero = document.getElementById('hero-section');
    if (searchDebounceStr) hero.style.display = 'none';
    else if (currentCategory === 'all') hero.style.display = 'flex';
    else hero.style.display = 'none';
}

async function loadNextPage() {
    if (isLoading || !hasMoreItems) return;
    isLoading = true;

    const container = document.getElementById('dynamic-content');
    const mainScroller = document.getElementById('main-scroller'); // Получаем контейнер скролла

    let sentinel = document.getElementById('scroll-sentinel');
    if (!sentinel) {
        sentinel = document.createElement('div');
        sentinel.id = 'scroll-sentinel';
        sentinel.innerHTML = '<div class="loader-spinner"></div>';
        container.appendChild(sentinel);
        sentinelObserver.observe(sentinel);
    }

    let url = `/api/items?page=${currentPage}&limit=10`; 
    if (currentCategory !== 'all') url += `&category=${currentCategory}`;
    if (searchDebounceStr) url += `&search=${searchDebounceStr}`;

    try {
        const res = await fetch(url);
        const newItems = await res.json();
        
        if (newItems.length === 0) {
            hasMoreItems = false;
            sentinel.remove(); 
            if (currentPage === 1) {
                container.innerHTML = '<div style="height:50vh; display:flex; align-items:center; justify-content:center; font-family:var(--font-head); font-size:1.5rem;">Нет работ в этой категории.</div>';
            } else {
                renderFooter(container); 
            }
        } else {
            // --- ФИКС ПРЫЖКОВ НА НОУТБУКЕ ---
            // 1. Временно отключаем прилипание, чтобы браузер не сходил с ума при вставке
            mainScroller.style.scrollSnapType = 'none';

            allLoadedItems = [...allLoadedItems, ...newItems];
            
            newItems.forEach(item => {
                const el = document.createElement('section');
                el.className = `slide-section theme-${item.category}`;
                el.dataset.cat = item.category;
                el.innerHTML = getSlideHTML(item);
                
                container.insertBefore(el, sentinel);
                
                animationObserver.observe(el);
                spyObserver.observe(el);
            });

            currentPage++;

            // 2. Ждем совсем чуть-чуть, пока браузер отрисует новые блоки, 
            // и только потом включаем прилипание обратно.
            // requestAnimationFrame гарантирует, что это произойдет в следующем кадре отрисовки.
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    mainScroller.style.scrollSnapType = 'y mandatory';
                });
            });
        }
    } catch (e) {
        console.error(e);
        if(sentinel) sentinel.remove();
    } finally {
        isLoading = false;
    }
}

function renderFooter(container) {
    const footerEl = document.createElement('section');
    footerEl.className = 'slide-section footer-section';
    footerEl.innerHTML = `
        <div class="footer-content">
            <div class="end-icon"><i class="fas fa-seedling"></i></div>
            <div class="footer-text">Вы просмотрели всю коллекцию</div>
            <button class="back-to-top-btn" onclick="resetToHero()">В начало</button>
            <div style="margin-top: 30px; font-size: 0.9rem; color: #888;">
                &copy; 2026 Handmade Soul
            </div>
        </div>
    `;
    container.appendChild(footerEl);
    animationObserver.observe(footerEl);
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
                    <button class="action-btn buy-btn" onclick="openTg(${item.id})">Купить</button>
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

window.openModal = function(id) { document.getElementById(id).style.display = 'block'; };
window.closeModal = function(id) { document.getElementById(id).style.display = 'none'; };

window.openTg = function(id) {
    const item = allLoadedItems.find(i => i.id === id); // Ищем в глобальном массиве
    if(!item) return;
    const text = `Здравствуйте! Хочу приобрести "${item.title}" за ${item.price}р.`;
    const url = `https://t.me/${TG_USER}?text=${encodeURIComponent(text)}`;
    const btn = document.getElementById('tg-go-btn');
    if (btn) btn.onclick = () => window.open(url, '_blank');
    openModal('tg-modal');
};

window.openDesc = function(id) {
    const item = allLoadedItems.find(i => i.id === id); // Ищем в глобальном массиве
    if(!item) return;
    document.getElementById('desc-title').innerText = item.title;
    document.getElementById('desc-text').innerText = item.description;
    openModal('desc-modal');
};