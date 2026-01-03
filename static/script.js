const VK_USER_ID = "487502463"; 

document.addEventListener("DOMContentLoaded", () => {
    loadFullPageGallery('all');
});

// Наблюдатель: когда секция появляется на экране более чем на 50%,
// мы добавляем ей класс .active, который запускает CSS-анимации рамок
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        } else {
            // Опционально: убирать класс, чтобы анимация проигрывалась каждый раз заново
            entry.target.classList.remove('active'); 
        }
    });
}, { threshold: 0.5 }); // Срабатывает когда видно 50% слайда

async function loadFullPageGallery(filterCategory) {
    const container = document.getElementById('dynamic-slides');
    container.innerHTML = ''; // Очистить старое

    try {
        const response = await fetch(`/api/items?category=${filterCategory}`);
        let items = await response.json();

        // Заглушки, если база пуста
        if (items.length === 0) items = getStubItems(filterCategory);

        items.forEach(item => {
            const section = createSlide(item);
            container.appendChild(section);
            observer.observe(section); // Начинаем следить за секцией
        });
    } catch (e) {
        console.error("Ошибка:", e);
    }
}

function createSlide(item) {
    const section = document.createElement('section');
    
    // Определяем стиль по категории
    let styleClass = 'style-graphic'; // default
    if (item.category === 'watercolor') styleClass = 'style-watercolor';
    if (item.category === 'oil') styleClass = 'style-oil';
    
    section.className = `slide-section ${styleClass}`;
    
    section.innerHTML = `
        <!-- Декоративные элементы (рамки), выезжающие с боков -->
        <div class="deco deco-top"></div>
        <div class="deco deco-right"></div>
        <div class="deco deco-bottom"></div>
        <div class="deco deco-left"></div>

        <!-- Контент -->
        <div class="art-content">
            <img src="${item.image_url}" alt="${item.title}" class="art-image">
            <div class="art-info">
                <div>
                    <h2 class="art-title">${item.title}</h2>
                    <span class="art-price">${item.price} ₽</span>
                </div>
                <button class="buy-btn-small" onclick="buyItem('${item.title}', ${item.price})">
                    Купить
                </button>
            </div>
        </div>
    `;
    return section;
}

// Заглушки (те же, что и были, но можно добавить больше деталей)
function getStubItems(filterCategory) {
    const allStubs = [
        { id: 1, title: "Утренний туман", price: 3500, category: "watercolor", image_url: "https://placehold.co/800x1000/e3f2fd/1565c0?text=Акварель" },
        { id: 2, title: "Портрет осени", price: 7000, category: "oil", image_url: "https://placehold.co/1000x800/fff3e0/e65100?text=Масло+Холст" },
        { id: 3, title: "Геометрия города", price: 2500, category: "graphic", image_url: "https://placehold.co/800x600/f5f5f5/000000?text=Графика" },
        { id: 4, title: "Морской бриз", price: 4200, category: "watercolor", image_url: "https://placehold.co/900x900/e0f7fa/006064?text=Море" }
    ];
    if (filterCategory === 'all' || !filterCategory) return allStubs;
    return allStubs.filter(i => i.category === filterCategory);
}

// Переменные для модального окна ВК
const vkModal = document.getElementById('vk-confirm-modal');
const vkBtn = document.getElementById('go-to-vk-btn');

function closeVkModal() {
    if(vkModal) vkModal.style.display = 'none';
}

async function buyItem(title, price) {
    console.log("Нажата кнопка купить:", title); // Для проверки в консоли (F12)

    const text = `Здравствуйте! Хочу приобрести работу "${title}" за ${price}р.`;
    
    // 1. Пытаемся скопировать (безопасно)
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            console.log('Текст скопирован успешно');
        } else {
            console.log('Clipboard API недоступен (не страшно, идем дальше)');
        }
    } catch (err) {
        console.error('Ошибка при копировании:', err);
    }

    // 2. Подготавливаем ссылку
    const url = `https://vk.com/write${VK_USER_ID}?message=${encodeURIComponent(text)}`;
    
    // 3. Настраиваем кнопку в модальном окне
    if (vkBtn) {
        vkBtn.onclick = () => {
            window.open(url, '_blank');
            closeVkModal();
        };
    } else {
        console.error("Ошибка: Кнопка go-to-vk-btn не найдена в HTML");
        // Если кнопки нет, просто открываем ВК сразу как резервный вариант
        window.open(url, '_blank');
        return;
    }

    // 4. Показываем модальное окно
    if (vkModal) {
        vkModal.style.display = 'block';
    } else {
        console.error("Ошибка: Модальное окно vk-confirm-modal не найдено в HTML");
    }
}

// Закрытие по клику вне окна (дублируем логику, так как теперь два модальных окна)
window.onclick = (e) => { 
    const modalImg = document.getElementById('modal'); // Старое окно просмотра
    if (e.target == modalImg) modalImg.style.display = 'none';
    
    if (e.target == vkModal) vkModal.style.display = 'none';
}

// Вспомогательная функция для красивого уведомления (по желанию)
function showNotification(message) {
    const note = document.createElement('div');
    note.innerText = message;
    note.style.position = 'fixed';
    note.style.bottom = '20px';
    note.style.right = '20px';
    note.style.background = '#333';
    note.style.color = '#fff';
    note.style.padding = '15px 25px';
    note.style.borderRadius = '50px';
    note.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';
    note.style.zIndex = '10000';
    note.style.animation = 'fadeIn 0.5s forwards';
    note.style.fontFamily = 'Montserrat, sans-serif';
    
    document.body.appendChild(note);
    
    // Удаляем через 3 секунды
    setTimeout(() => {
        note.style.opacity = '0';
        setTimeout(() => note.remove(), 500);
    }, 3000);
}

// Простая фильтрация (перезагружает список)
function filterItems(category) {
    // Сброс скролла на начало
    document.getElementById('main-container').scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
        loadFullPageGallery(category);
    }, 500); // Небольшая задержка для плавности
}