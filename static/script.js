const VK_USER_ID = "487502463"; // ID Вашей мамы
let currentCategory = 'all';
let viewMode = 'feed'; // 'feed' or 'grid'
let searchQuery = '';

document.addEventListener("DOMContentLoaded", () => {
    loadGallery();
    setupControls();
});

// Наблюдатель для анимаций в ленте
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        }
    });
}, { threshold: 0.4 });

function setupControls() {
    // Категории
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentCategory = e.target.dataset.cat;
            loadGallery();
        });
    });

    // Поиск (Debounce)
    const searchInput = document.getElementById('search-input');
    let timeout = null;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            searchQuery = e.target.value.trim();
            loadGallery();
        }, 500);
    });

    // Переключение вида
    const toggleBtn = document.getElementById('view-toggle-btn');
    const container = document.getElementById('gallery-container');
    
    toggleBtn.addEventListener('click', () => {
        if (viewMode === 'feed') {
            viewMode = 'grid';
            container.className = 'grid-mode';
            toggleBtn.innerHTML = '<i class="fas fa-stream"></i>'; // Иконка списка
        } else {
            viewMode = 'feed';
            container.className = 'feed-mode';
            toggleBtn.innerHTML = '<i class="fas fa-th-large"></i>'; // Иконка сетки
        }
        loadGallery(); // Перерисовать контент
    });
}

async function loadGallery() {
    const container = document.getElementById('dynamic-content');
    container.innerHTML = '<div style="text-align:center; padding:20px;">Загрузка...</div>';
    
    // Скрываем/показываем Hero секцию
    const hero = document.getElementById('hero');
    if (viewMode === 'grid' || currentCategory !== 'all' || searchQuery !== '') {
        hero.style.display = 'none';
    } else {
        hero.style.display = 'flex';
    }

    try {
        let url = `/api/items?`;
        if (currentCategory !== 'all') url += `category=${currentCategory}&`;
        if (searchQuery) url += `search=${searchQuery}`;

        const res = await fetch(url);
        let items = await res.json();
        
        container.innerHTML = '';

        if (items.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:50px; width:100%;">Работ не найдено. Попробуйте другую категорию.</div>';
            return;
        }

        items.forEach(item => {
            const html = viewMode === 'feed' ? createSlideHtml(item) : createGridHtml(item);
            const el = document.createElement('div');
            // Для ленты это section, для сетки div
            if (viewMode === 'feed') {
                el.className = `slide-section theme-${item.category}`;
                el.innerHTML = html;
                observer.observe(el);
            } else {
                el.className = 'grid-item';
                el.innerHTML = html;
            }
            container.appendChild(el);
        });

    } catch (e) {
        console.error(e);
        container.innerHTML = 'Ошибка загрузки данных.';
    }
}

function createSlideHtml(item) {
    return `
        <div class="art-card">
            <div class="art-img-wrapper">
                <img src="${item.image_url}" class="art-img" alt="${item.title}">
            </div>
            <div class="art-info">
                <div>
                    <h2 class="art-title">${item.title}</h2>
                    <span style="font-weight:bold; color:var(--accent);">${item.price} ₽</span>
                </div>
                <button class="buy-btn" onclick="openVkModal('${item.title}', ${item.price})">Купить</button>
            </div>
        </div>
    `;
}

function createGridHtml(item) {
    return `
        <img src="${item.image_url}" class="grid-img" loading="lazy">
        <div class="grid-details">
            <h3 style="margin:0; font-family:var(--font-head); font-size:1.2rem;">${item.title}</h3>
            <p style="color:#666; font-size:0.9rem;">${item.price} ₽</p>
            <button class="buy-btn" style="width:100%; padding:8px;" onclick="openVkModal('${item.title}', ${item.price})">Купить</button>
        </div>
    `;
}

// --- VK MODAL LOGIC ---
const modal = document.getElementById('vk-modal');
const closeBtn = document.querySelector('.close-modal');
const vkGoBtn = document.getElementById('vk-go-btn');

function openVkModal(title, price) {
    const text = `Здравствуйте! Хочу приобрести работу "${title}" за ${price}р.`;
    
    // Копируем текст
    navigator.clipboard.writeText(text).then(() => {
        console.log('Copied');
    }).catch(err => console.log('Copy failed', err));

    // Настраиваем ссылку
    const url = `https://vk.com/write${VK_USER_ID}?message=${encodeURIComponent(text)}`;
    vkGoBtn.onclick = () => window.open(url, '_blank');
    
    modal.style.display = 'block';
}

closeBtn.onclick = () => modal.style.display = 'none';
window.onclick = (e) => { if (e.target == modal) modal.style.display = 'none'; };