// Глобальные переменные для хранения данных
let coreData = null;
let pointsData = null;
let competitorsData = null;
let gbpData = null; // Добавляем переменную для хранения GBP данных
let map = null;
let markers = [];
let selectedCompetitor = null;
let competitorsGrid = null;
let keywordsGrid = null;
let positionsGrid = null;
let tableObserver = null;
let modalMap = null;
let modalMarkers = [];
let groupKeywordsEnabled = false;
let legendControl = null;
let isUpdatingHandlers = false; // Флаг для предотвращения бесконечного цикла

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    // Добавляем обработчик для кнопки загрузки данных
    const loadTestDataBtn = document.getElementById('loadTestDataBtn');
    if (loadTestDataBtn) {
        loadTestDataBtn.addEventListener('click', loadTestData);
    }
    
    // Добавляем обработчик для кнопки экспорта HTML
    const exportHtmlBtn = document.getElementById('exportHtmlBtn');
    if (exportHtmlBtn) {
        exportHtmlBtn.addEventListener('click', exportToHtml);
    }
    
    // Закрытие детальной информации
    const closeDetailBtn = document.getElementById('closeDetailBtn');
    if (closeDetailBtn) {
        closeDetailBtn.addEventListener('click', () => {
            document.getElementById('competitorDetailSection').style.display = 'none';
            document.getElementById('competitorsRankingSection').style.display = 'block';
        });
    }
    
    // Обработчик изменения состояния группировки по ключевым словам
    const groupByKeywordCheckbox = document.getElementById('groupByKeyword');
    if (groupByKeywordCheckbox) {
        groupByKeywordCheckbox.addEventListener('change', function() {
            groupKeywordsEnabled = this.checked;
            if (selectedCompetitor) {
                const keywordSelect = document.getElementById('modalKeywordFilter');
                const keyword = keywordSelect ? keywordSelect.value : '';
                
                if (keyword) {
                    showPositionsOnModalMap(selectedCompetitor, keyword);
                } else {
                    showAllPositionsOnModalMap(selectedCompetitor);
                }
            }
        });
    }
    
    // Обработчик поиска по ключевым словам
    const modalKeywordSearch = document.getElementById('modalKeywordSearch');
    if (modalKeywordSearch) {
        modalKeywordSearch.addEventListener('input', function() {
            filterModalPositionsTable(this.value);
        });
    }
    
    // Обработчик экспорта в CSV
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportToCSV);
    }
    
    // Автоматическая загрузка данных при запуске
    loadTestData();
});

// Загрузка данных
async function loadTestData() {
    let retried = false;
    let errorMessage = '';
    
    while (true) {
        try {
            showLoadingIndicator();
            const cachedData = getCachedData();
            if (cachedData) {
                console.log('Используем кэшированные данные');
                loadData(cachedData);
                hideLoadingIndicator();
                return;
            }
            try {
                console.log('Начинаем загрузку данных...');
                
                // Загружаем файлы по одному, чтобы легче отследить ошибку
                console.log('Загрузка test.subjects.json...');
                const coreResponse = await fetch('json/test.subjects.json');
                if (!coreResponse.ok) {
                    throw new Error(`Ошибка HTTP при загрузке test.subjects.json: ${coreResponse.status}`);
                }
                
                console.log('Загрузка test.pointsdatas.json...');
                const pointsResponse = await fetch('json/test.pointsdatas.json');
                if (!pointsResponse.ok) {
                    throw new Error(`Ошибка HTTP при загрузке test.pointsdatas.json: ${pointsResponse.status}`);
                }
                
                console.log('Загрузка test.competitorsanalyses.json...');
                const competitorsResponse = await fetch('json/test.competitorsanalyses.json');
                if (!competitorsResponse.ok) {
                    throw new Error(`Ошибка HTTP при загрузке test.competitorsanalyses.json: ${competitorsResponse.status}`);
                }
                
                // Загружаем данные GBP
                console.log('Загрузка it-reports.gbp_data.json...');
                const gbpResponse = await fetch('json/it-reports.gbp_data.json');
                if (!gbpResponse.ok) {
                    console.warn(`Ошибка HTTP при загрузке it-reports.gbp_data.json: ${gbpResponse.status}`);
                    // Продолжаем выполнение даже если GBP данные не загружены
                }
                
                // Парсинг JSON с проверкой на ошибки
                console.log('Парсинг test.subjects.json...');
                let core;
                try {
                    core = await coreResponse.json();
                } catch (e) {
                    throw new Error(`Ошибка парсинга JSON test.subjects.json: ${e.message}`);
                }
                
                console.log('Парсинг test.pointsdatas.json...');
                let pointsData;
                try {
                    pointsData = await pointsResponse.json();
                } catch (e) {
                    throw new Error(`Ошибка парсинга JSON test.pointsdatas.json: ${e.message}`);
                }
                
                console.log('Парсинг test.competitorsanalyses.json...');
                let competitorsAnalysis;
                try {
                    competitorsAnalysis = await competitorsResponse.json();
                } catch (e) {
                    throw new Error(`Ошибка парсинга JSON test.competitorsanalyses.json: ${e.message}`);
                }
                
                // Парсинг GBP данных
                let gbpDataJson = null;
                if (gbpResponse && gbpResponse.ok) {
                    console.log('Парсинг it-reports.gbp_data.json...');
                    try {
                        gbpDataJson = await gbpResponse.json();
                        console.log('GBP данные успешно загружены');
                    } catch (e) {
                        console.warn(`Ошибка парсинга JSON it-reports.gbp_data.json: ${e.message}`);
                    }
                }
                
                // Проверяем, что все данные правильно загружены
                if (!Array.isArray(core) || !Array.isArray(competitorsAnalysis)) {
                    throw new Error('Неверный формат данных: core или competitorsAnalysis не являются массивами');
                }
                
                console.log('Все данные успешно загружены');
                const jsonData = {
                    core: core[0],
                    pointsData: pointsData,
                    competitorsAnalysis: competitorsAnalysis[0],
                    gbpData: gbpDataJson && gbpDataJson.length > 0 ? gbpDataJson[0] : null
                };
                
                // Валидация данных
                if (!jsonData.core || !jsonData.pointsData || !jsonData.competitorsAnalysis) {
                    throw new Error('Отсутствуют необходимые данные в загруженных файлах');
                }
                
                if (validateData(jsonData)) {
                    cacheData(jsonData);
                    loadData(jsonData);
                    const exportHtmlBtn = document.getElementById('exportHtmlBtn');
                    if (exportHtmlBtn) exportHtmlBtn.style.display = 'inline-block';
                } else {
                    throw new Error('Формат данных некорректный. Проверьте структуру файлов JSON.');
                }
                break;
            } catch (fetchError) {
                // Подробное логирование ошибки
                console.error('Подробная ошибка при загрузке данных:', fetchError);
                errorMessage = fetchError.message || 'Неизвестная ошибка при загрузке данных';
                
                // Очищаем кэш при ошибке
                localStorage.removeItem('googleMapsAnalysisData');
                localStorage.removeItem('dataCacheTime');
                
                if (!retried) {
                    retried = true;
                    console.warn('Повторная попытка загрузки данных...');
                    continue;
                }
                
                // Пробуем загрузить демонстрационные данные
                console.log('Пробуем использовать демонстрационные данные...');
                const demoData = generateDemoData();
                if (demoData) {
                    console.log('Используем демонстрационные данные');
                    loadData(demoData);
                } else {
                    // Если и демонстрационные данные не удалось создать, показываем ошибку
                    alert('Не удалось загрузить данные. Проверьте наличие файлов JSON в директории /json/.\nОшибка: ' + errorMessage);
                }
                break;
            }
        } catch (error) {
            // Общая обработка любых других ошибок
            console.error('Критическая ошибка при загрузке данных:', error);
            localStorage.removeItem('googleMapsAnalysisData');
            localStorage.removeItem('dataCacheTime');
            alert('Произошла ошибка при загрузке данных: ' + (error.message || 'Неизвестная ошибка'));
            break;
        } finally {
            hideLoadingIndicator();
        }
    }
}

// Функция для генерации демонстрационных данных улучшена, чтобы быть более надежной
function generateDemoData() {
    try {
        console.log('Генерируем демонстрационные данные...');
        // Базовые данные о бизнесе
        const core = {
            name: "Демонстрационный бизнес",
            keys: ["кафе", "ресторан", "доставка еды", "пиццерия"],
            create_date: new Date().toISOString(),
            points: {
                latitude: 55.751244,
                longitude: 37.618423
            }
        };
        
        // Точки
        const points = [];
        for (let i = 0; i < 5; i++) {
            points.push({
                id: `point_${i}`,
                lat: 55.751244 + (Math.random() - 0.5) * 0.1,
                lng: 37.618423 + (Math.random() - 0.5) * 0.1,
                location: `Демо-адрес ${i+1}`
            });
        }
        
        // Конкуренты
        const competitors = [];
        for (let i = 0; i < 10; i++) {
            const positions = [];
            
            core.keys.forEach(key => {
                const pointsData = [];
                
                points.forEach(p => {
                    pointsData.push({
                        lat: p.lat,
                        lng: p.lng,
                        coordinates: { lat: p.lat, lng: p.lng }, // Добавляем coordinates для совместимости
                        rank: Math.floor(Math.random() * 20) + 1,
                        location: p.location
                    });
                });
                
                // Рассчитываем средний ранг
                let sum = 0;
                pointsData.forEach(pd => {
                    sum += pd.rank;
                });
                const avgRank = sum / pointsData.length;
                
                positions.push({
                    key: key,
                    keyword: key,
                    averageRank: avgRank.toFixed(1),
                    points: pointsData
                });
            });
            
            competitors.push({
                name: `Конкурент ${i+1}`,
                averageRank: (Math.random() * 10 + 1).toFixed(1),
                positions: positions
            });
        }
        
        console.log('Демонстрационные данные успешно сгенерированы');
        return {
            core: core,
            pointsData: points,
            competitorsAnalysis: {
                competitors: competitors
            }
        };
    } catch (e) {
        console.error('Ошибка при генерации демонстрационных данных:', e);
        return null;
    }
}

// Валидация данных
function validateData(data) {
    // Проверяем наличие всех необходимых данных
    if (!data.core || !data.pointsData || !data.competitorsAnalysis) {
        return false;
    }
    
    // Обрабатываем MongoDB формат
    if (data.core.coordinates && data.core.coordinates.latitude && data.core.coordinates.longitude) {
        // Преобразуем структуру, чтобы соответствовать ожидаемому формату
        data.core.points = {
            latitude: data.core.coordinates.latitude,
            longitude: data.core.coordinates.longitude
        };
    }
    
    // Проверяем наличие даты создания в формате MongoDB
    if (data.core.create_date && data.core.create_date.$date) {
        data.core.create_date = data.core.create_date.$date;
    }
    
    return true;
}

// Загрузка и отображение данных
function loadData(data) {
    if (!data || !data.core || !data.pointsData || !data.competitorsAnalysis) {
        console.error('Некорректные данные для загрузки');
        return;
    }
    // Сохраняем данные
    coreData = data.core;
    pointsData = data.pointsData;
    competitorsData = data.competitorsAnalysis;
    gbpData = data.gbpData; // Сохраняем GBP данные

    // Отображаем информацию о бизнесе
    if (gbpData) {
        showGBPBusinessInfo(); // Если есть GBP данные, используем их
    } else {
        showBusinessInfo(); // Иначе используем обычные данные
    }
    
    // Отображаем рейтинг конкурентов
    showCompetitorsRanking();
    
    // Заполняем фильтры ключевых слов
    fillKeywordFilters();
}

// Отображение информации о бизнесе из GBP данных
function showGBPBusinessInfo() {
    if (!gbpData) {
        console.warn('Нет GBP данных для отображения');
        console.log('Доступные данные:', { coreData, pointsData, competitorsData, gbpData });
        showBusinessInfo(); // Используем стандартную функцию, если GBP данных нет
        return;
    }
    
    console.log('GBP данные:', gbpData);
    
    // Получаем контейнер для информации о бизнесе
    const businessInfoSection = document.getElementById('businessInfoSection');
    if (!businessInfoSection) {
        console.error('Не найден контейнер businessInfoSection');
        return;
    }
    
    // Очищаем секцию перед добавлением информации
    businessInfoSection.innerHTML = '';
    
    // Создаем основную карточку
    const mainCardHTML = `
        <div class="col">
            <div class="card">
                <div class="card-header bg-info text-white">
                    <i class="fas fa-building me-2"></i> Основная информация о бизнесе
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label class="fw-bold">ID:</label>
                                <div>${gbpData._id?.$oid || 'Нет данных'}</div>
                            </div>
                            <div class="mb-3">
                                <label class="fw-bold">Название:</label>
                                <div>${gbpData.name || 'Нет данных'}</div>
                            </div>
                            <div class="mb-3">
                                <label class="fw-bold">Тип:</label>
                                <div>${gbpData.type || 'Нет данных'}</div>
                            </div>
                            <div class="mb-3">
                                <label class="fw-bold">Неделя:</label>
                                <div>${gbpData.week || 'Нет данных'}</div>
                            </div>
                            <div class="mb-3">
                                <label class="fw-bold">Телефон:</label>
                                <div>${gbpData.phone || 'Нет данных'}</div>
                            </div>
                            <div class="mb-3">
                                <label class="fw-bold">Вебсайт:</label>
                                <div>${gbpData.website ? 
                                    `<a href="${gbpData.website}" target="_blank">${gbpData.website}</a>` : 
                                    'Нет данных'}</div>
                            </div>
                            <div class="mb-3">
                                <label class="fw-bold">Основная категория:</label>
                                <div>${gbpData.mainCategory || 'Нет данных'}</div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label class="fw-bold">Адрес:</label>
                                <div>${gbpData.address || 'Нет данных'}</div>
                            </div>
                            <div class="mb-3">
                                <label class="fw-bold">Ссылка для бронирования:</label>
                                <div>${gbpData.bookingLink ? 
                                    `<a href="${gbpData.bookingLink}" target="_blank">${gbpData.bookingLink}</a>` : 
                                    'Нет данных'}</div>
                            </div>
                            <div class="mb-3">
                                <label class="fw-bold">Часовой пояс:</label>
                                <div>${gbpData.timeZone || 'Нет данных'}</div>
                            </div>
                            <div class="mb-3">
                                <label class="fw-bold">Рейтинг:</label>
                                <div>${gbpData.rating ? 
                                    `${gbpData.rating} ★ (${gbpData.reviewsCount} отзывов)` : 
                                    'Нет данных'}</div>
                            </div>
                            <div class="mb-3">
                                <label class="fw-bold">Place ID:</label>
                                <div>${gbpData.place_id || 'Нет данных'}</div>
                            </div>
                            <div class="mb-3">
                                <label class="fw-bold">Координаты:</label>
                                <div>${gbpData.location ? 
                                    `${gbpData.location.lat}, ${gbpData.location.lng}` : 
                                    'Нет данных'}</div>
                            </div>
                            <div class="mb-3">
                                <label class="fw-bold">Дата создания:</label>
                                <div>${gbpData.create_date?.$date ? 
                                    new Date(gbpData.create_date.$date).toLocaleDateString() : 
                                    'Нет данных'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Добавляем основную карточку
    businessInfoSection.innerHTML += mainCardHTML;
    
    // Если есть изображение, добавляем его
    if (gbpData.sampleImage) {
        const imageCardHTML = `
            <div class="col mt-3">
                <div class="card">
                    <div class="card-header bg-info text-white">
                        <i class="fas fa-image me-2"></i> Изображение бизнеса
                    </div>
                    <div class="card-body text-center">
                        <a href="${gbpData.sampleImage}" target="_blank" class="btn btn-outline-primary">
                            <i class="fas fa-external-link-alt me-2"></i>
                            Открыть изображение
                        </a>
                        <div class="mt-2">
                            <small class="text-muted">${gbpData.sampleImage}</small>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        businessInfoSection.innerHTML += imageCardHTML;
    }
    
    // Добавляем карточку с категориями
    if (gbpData.categories && gbpData.categories.length > 0) {
        const categoriesHTML = gbpData.categories.map(category => 
            `<span class="badge bg-primary me-1 mb-1">${category}</span>`).join('');
        
        const categoriesCardHTML = `
            <div class="col mt-3">
                <div class="card">
                    <div class="card-header bg-info text-white">
                        <i class="fas fa-tags me-2"></i> Категории
                    </div>
                    <div class="card-body">
                        ${categoriesHTML}
                    </div>
                </div>
            </div>
        `;
        
        businessInfoSection.innerHTML += categoriesCardHTML;
    }
    
    // Добавляем карточку с часами работы
    if (gbpData.openingHours) {
        const hoursCardHTML = `
            <div class="col mt-3">
                <div class="card">
                    <div class="card-header bg-info text-white">
                        <i class="fas fa-clock me-2"></i> Часы работы
                    </div>
                    <div class="card-body">
                        ${formatOpeningHours(gbpData.openingHours)}
                    </div>
                </div>
            </div>
        `;
        
        businessInfoSection.innerHTML += hoursCardHTML;
    }
    
    // Добавляем карточку с дополнительной информацией
    if (gbpData.aboutInfo && gbpData.aboutInfo.length > 0) {
        let aboutInfoHTML = '';
        
        gbpData.aboutInfo.forEach(info => {
            if (info.title && info.content && info.content.length > 0) {
                aboutInfoHTML += `
                    <div class="mb-3">
                        <h6 class="fw-bold">${info.title}</h6>
                        <ul class="list-group">
                            ${info.content.map(item => `<li class="list-group-item">${item}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }
        });
        
        if (aboutInfoHTML) {
            const aboutCardHTML = `
                <div class="col mt-3">
                    <div class="card">
                        <div class="card-header bg-info text-white">
                            <i class="fas fa-info-circle me-2"></i> Дополнительная информация
                        </div>
                        <div class="card-body">
                            ${aboutInfoHTML}
                        </div>
                    </div>
                </div>
            `;
            
            businessInfoSection.innerHTML += aboutCardHTML;
        }
    }
    
    // Добавляем карточку со всеми изображениями
    if (gbpData.images && gbpData.images.length > 0) {
        let imagesHTML = '<ul class="list-group">';
        
        gbpData.images.forEach(image => {
            imagesHTML += `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${image.name}</strong>
                    </div>
                    <a href="${image.img}" target="_blank" class="btn btn-sm btn-outline-primary">
                        <i class="fas fa-external-link-alt me-1"></i>
                        Открыть
                    </a>
                </li>
            `;
        });
        
        imagesHTML += '</ul>';
        
        const allImagesCardHTML = `
            <div class="col mt-3">
                <div class="card">
                    <div class="card-header bg-info text-white">
                        <i class="fas fa-images me-2"></i> Все изображения (${gbpData.images.length})
                    </div>
                    <div class="card-body">
                        ${imagesHTML}
                    </div>
                </div>
            </div>
        `;
        
        businessInfoSection.innerHTML += allImagesCardHTML;
    }
    
    // Добавляем карточку с отзывами
    if (gbpData.reviews && gbpData.reviews.length > 0) {
        let reviewsHTML = '';
        
        // Ограничиваем количество отображаемых отзывов до 5
        const displayedReviews = gbpData.reviews.slice(0, 5);
        
        displayedReviews.forEach(review => {
            // Создаем звезды для рейтинга
            const stars = '★'.repeat(review.number_stars) + '☆'.repeat(5 - review.number_stars);
            
            reviewsHTML += `
                <div class="card mb-3">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h6 class="fw-bold mb-0">${review.author}</h6>
                            <span class="text-warning">${stars}</span>
                        </div>
                        <p class="mb-1 text-muted small">${review.date}</p>
                        <p class="card-text">${review.message}</p>
                    </div>
                </div>
            `;
        });
        
        const reviewsCardHTML = `
            <div class="col mt-3">
                <div class="card">
                    <div class="card-header bg-info text-white">
                        <i class="fas fa-comments me-2"></i> Последние отзывы (${gbpData.reviews.length} всего)
                    </div>
                    <div class="card-body">
                        ${reviewsHTML}
                        ${gbpData.reviews.length > 5 ? 
                            `<button class="btn btn-outline-primary mt-2" onclick="showAllReviews()">Показать все ${gbpData.reviews.length} отзывов</button>` : 
                            ''}
                    </div>
                </div>
            </div>
        `;
        
        businessInfoSection.innerHTML += reviewsCardHTML;
    }
    
    // Добавляем карточку с ключевыми словами из отзывов
    if (gbpData.reviewsKeywords && gbpData.reviewsKeywords.length > 0) {
        // Сортируем ключевые слова по частоте упоминания (от большего к меньшему)
        const sortedKeywords = [...gbpData.reviewsKeywords].sort((a, b) => 
            parseInt(b.number) - parseInt(a.number)
        );
        
        let keywordsHTML = '<div class="row">';
        
        sortedKeywords.forEach(keyword => {
            // Рассчитываем размер шрифта в зависимости от частоты (от 1.0 до 2.0)
            const fontSize = 1.0 + Math.min(1.0, parseInt(keyword.number) / 30);
            // Определяем интенсивность цвета в зависимости от частоты
            const colorIntensity = Math.min(90, 40 + parseInt(keyword.number) * 2);
            
            keywordsHTML += `
                <div class="col-md-4 mb-2">
                    <div class="d-flex align-items-center">
                        <span class="badge bg-primary me-2">${keyword.number}</span>
                        <span style="font-size: ${fontSize}rem; color: hsl(210, ${colorIntensity}%, 50%);">
                            ${keyword.key}
                        </span>
                    </div>
                </div>
            `;
        });
        
        keywordsHTML += '</div>';
        
        const keywordsCardHTML = `
            <div class="col mt-3">
                <div class="card">
                    <div class="card-header bg-info text-white">
                        <i class="fas fa-cloud me-2"></i> Ключевые слова из отзывов
                    </div>
                    <div class="card-body">
                        ${keywordsHTML}
                    </div>
                </div>
            </div>
        `;
        
        businessInfoSection.innerHTML += keywordsCardHTML;
    }
    
    // Отображаем секцию
    businessInfoSection.style.display = 'block';
    businessInfoSection.classList.add('fade-in');
}

// Функция для отображения всех отзывов
function showAllReviews() {
    if (!gbpData || !gbpData.reviews) return;
    
    const modal = new bootstrap.Modal(document.getElementById('allReviewsModal') || createAllReviewsModal());
    
    // Заполняем модальное окно отзывами
    const reviewsContainer = document.getElementById('allReviewsContainer');
    if (!reviewsContainer) return;
    
    let reviewsHTML = '';
    
    gbpData.reviews.forEach(review => {
        // Создаем звезды для рейтинга
        const stars = '★'.repeat(review.number_stars) + '☆'.repeat(5 - review.number_stars);
        
        reviewsHTML += `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h6 class="fw-bold mb-0">${review.author}</h6>
                        <span class="text-warning">${stars}</span>
                    </div>
                    <p class="mb-1 text-muted small">${review.date}</p>
                    <p class="card-text">${review.message}</p>
                </div>
            </div>
        `;
    });
    
    reviewsContainer.innerHTML = reviewsHTML;
    
    // Отображаем модальное окно
    modal.show();
}

// Создаем модальное окно для отзывов, если его нет
function createAllReviewsModal() {
    const modalHTML = `
        <div class="modal fade" id="allReviewsModal" tabindex="-1" aria-labelledby="allReviewsModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header bg-info text-white">
                        <h5 class="modal-title" id="allReviewsModalLabel">
                            <i class="fas fa-comments me-2"></i> Все отзывы
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Закрыть"></button>
                    </div>
                    <div class="modal-body">
                        <div id="allReviewsContainer"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Закрыть</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    return document.getElementById('allReviewsModal');
}

// Форматирование часов работы для отображения
function formatOpeningHours(openingHours) {
    if (!openingHours) return 'Нет данных';
    
    let html = '<ul class="list-unstyled mb-0">';
    
    for (const [day, hours] of Object.entries(openingHours)) {
        html += `<li><strong>${day}:</strong> ${hours}</li>`;
    }
    
    html += '</ul>';
    return html;
}

// Отображение информации о бизнесе (стандартный вариант)
function showBusinessInfo() {
    const businessNameEl = document.getElementById('businessName');
    const businessKeywordsEl = document.getElementById('businessKeywords');
    const businessCreateDateEl = document.getElementById('businessCreateDate');
    const businessCoordinatesEl = document.getElementById('businessCoordinates');
    const pointsCountEl = document.getElementById('pointsCount');
    const competitorsCountEl = document.getElementById('competitorsCount');
    
    if (businessNameEl) businessNameEl.textContent = coreData.name;
    if (businessKeywordsEl) businessKeywordsEl.textContent = coreData.keys.join(', ');
    if (businessCreateDateEl) businessCreateDateEl.textContent = new Date(coreData.create_date).toLocaleDateString();
    if (businessCoordinatesEl) businessCoordinatesEl.textContent = `${coreData.points.latitude}, ${coreData.points.longitude}`;
    if (pointsCountEl) pointsCountEl.textContent = pointsData.length;
    if (competitorsCountEl) competitorsCountEl.textContent = competitorsData.competitors.length;
    
    // Показываем секцию
    const section = document.getElementById('businessInfoSection');
    if (section) {
        section.style.display = 'block';
        section.classList.add('fade-in');
    }
}

// Заполнение фильтров ключевых слов
function fillKeywordFilters() {
    // Получаем уникальные ключевые слова
    const keywords = coreData.keys;
    
    // Инициализируем массив для фильтров
    const filters = [];
    
    // Добавляем только существующие элементы
    const keywordFilter = document.getElementById('keywordFilter');
    const pointKeywordFilter = document.getElementById('pointKeywordFilter');
    
    if (keywordFilter) filters.push(keywordFilter);
    if (pointKeywordFilter) filters.push(pointKeywordFilter);
    
    // Очищаем существующие опции
    filters.forEach(filter => {
        // Оставляем только первую опцию (все/выберите)
        while (filter.options.length > 1) {
            filter.remove(1);
        }
    });
    
    // Заполняем фильтры
    keywords.forEach(keyword => {
        filters.forEach(filter => {
            const option = document.createElement('option');
            option.value = keyword;
            option.textContent = keyword;
            filter.appendChild(option);
        });
    });
    
    // Обработчики изменения фильтров
    if (keywordFilter) {
        keywordFilter.addEventListener('change', function() {
            filterCompetitorsTable(this.value);
        });
    }

}

// Функция для привязки обработчиков к строкам таблицы
function attachTableRowHandlers() {
    // Устанавливаем короткую задержку для уверенности, что DOM обновился
    setTimeout(() => {
        const competitors = competitorsData?.competitors || [];
        const tableRows = document.querySelectorAll('#competitorsTable .gridjs-tbody tr');
        
        if (!tableRows.length) {
            console.log('Нет строк в таблице для обработки');
            return;
        }
        
        // Создаем или обновляем наблюдателя за изменениями в таблице
        setupTableObserver();
        
        // Обрабатываем случай, когда таблица отфильтрована или отсортирована
        if (competitorsGrid?.config?.data) {
            try {
                // Создаем соответствие отображаемых строк к индексам всех данных
                tableRows.forEach((row) => {
                    // Очищаем предыдущие обработчики
                    if (row._clickHandler) {
                        row.removeEventListener('click', row._clickHandler);
                    }
                    
                    // Создаем и привязываем новый обработчик
                    row._clickHandler = function(event) {
                        // Предотвращаем стандартное поведение, если это не клик по кнопке или элементу таблицы
                        if (event.target.tagName !== 'BUTTON' && !event.target.closest('.gridjs-th')) {
                            event.preventDefault();
                            
                            // Добавляем визуальный эффект активной строки
                            tableRows.forEach(r => r.classList.remove('row-active'));
                            row.classList.add('row-active');
                            
                            // Получаем имя конкурента прямо из HTML-ячейки (второй столбец)
                            const competitorNameCell = row.querySelector('td:nth-child(2)');
                            
                            if (competitorNameCell) {
                                const competitorName = competitorNameCell.textContent.trim();
                                console.log(`Ищем конкурента по имени из HTML: ${competitorName}`);
                                
                                // Ищем конкурента по имени в полном массиве конкурентов
                                const competitor = competitors.find(c => c.name === competitorName);
                                
                                if (competitor) {
                                    console.log(`Найден конкурент: ${competitor.name}`);
                                    showPositionsModal(competitor);
                                } else {
                                    console.error(`Не найден конкурент по имени: ${competitorName}`);
                                }
                            } else {
                                console.error('Не удалось найти ячейку с именем конкурента');
                            }
                        }
                    };
                    
                    row.addEventListener('click', row._clickHandler);
                    
                    // Добавляем визуальные подсказки для строк
                    row.classList.add('hoverable-row');
                });
            } catch (error) {
                console.error('Ошибка при обработке строк таблицы:', error);
            }
        } else {
            console.error('Таблица не инициализирована или нет данных');
        }
    }, 150); // Немного увеличиваем задержку для более стабильной работы
}

// Функция для настройки наблюдателя за изменениями в таблице
function setupTableObserver() {
    // Отключаем предыдущий наблюдатель, если он существует
    if (tableObserver) {
        tableObserver.disconnect();
        tableObserver = null;
    }
    
    const tableContainer = document.querySelector('#competitorsTable .gridjs-tbody');
    if (!tableContainer) {
        console.log('Не найден контейнер таблицы для наблюдения, попробуем позже');
        setTimeout(setupTableObserver, 500);
        return;
    }
    
    let observerTimeout = null;
    
    // Создаем новый наблюдатель
    tableObserver = new MutationObserver((mutations) => {
        // Если уже обновляем обработчики, пропускаем
        if (isUpdatingHandlers) return;
        
        // Проверяем, произошли ли существенные изменения в структуре таблицы
        let significantChange = false;
        for (const mutation of mutations) {
            // Нас интересуют только добавление/удаление элементов
            if (mutation.type === 'childList' && 
                (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
                significantChange = true;
                break;
            }
        }
        
        if (!significantChange) return;
        
        // Очищаем предыдущий таймаут, если он был
        if (observerTimeout) {
            clearTimeout(observerTimeout);
        }
        
        // Устанавливаем новый таймаут для дебаунсинга
        observerTimeout = setTimeout(() => {
            setupRowHandlers();
            observerTimeout = null;
        }, 300);
    });
    
    // Начинаем наблюдение только за изменениями в структуре
    tableObserver.observe(tableContainer, {
        childList: true,
        subtree: true
    });
    
    console.log('Наблюдатель за таблицей настроен');
}

// Функция для установки обработчиков на строки таблицы
function setupRowHandlers() {
    // Устанавливаем флаг, что обновляем обработчики
    isUpdatingHandlers = true;
    
    try {
        const tableRows = document.querySelectorAll('#competitorsTable .gridjs-tbody tr');
        console.log(`Обновление обработчиков для ${tableRows.length} строк таблицы`);
        
        tableRows.forEach(row => {
            // Если обработчик уже установлен, пропускаем
            if (row.hasAttribute('data-has-handler')) {
                return;
            }
            
            // Добавляем обработчик
            row.addEventListener('click', function(event) {
                const nameCell = row.querySelector('td:nth-child(2)');
                if (!nameCell) return;
                
                const competitorName = nameCell.textContent.trim();
                const competitor = competitorsData?.competitors?.find(c => c.name === competitorName);
                
                if (competitor) {
                    showPositionsModal(competitor);
                }
            });
            
            // Отмечаем, что обработчик установлен
            row.setAttribute('data-has-handler', 'true');
            row.classList.add('hoverable-row');
            row.style.cursor = 'pointer';
        });
    } finally {
        // Снимаем флаг в любом случае
        setTimeout(() => {
            isUpdatingHandlers = false;
        }, 100);
    }
}

// Отображение рейтинга конкурентов
function showCompetitorsRanking() {
    // Проверка на валидность данных
    if (!competitorsData || !Array.isArray(competitorsData.competitors) || !competitorsData.competitors.length) {
        console.warn('Нет данных для отображения рейтинга конкурентов');
        return;
    }
    // Показываем секцию с рейтингом и добавляем анимацию
    const section = document.getElementById('competitorsRankingSection');
    if (section) {
        section.style.display = 'block';
        section.classList.add('slide-in');
    }
    
    // Получаем данные о конкурентах
    const competitors = competitorsData.competitors;
    
    // Преобразуем данные для Grid.js
    const gridData = competitors.map((competitor, index) => {
        // Рассчитываем дополнительные данные
        const stats = calculateCompetitorStats(competitor);
        
        return [
            index + 1,
            competitor.name,
            formatRankHTML(competitor.averageRank),
            formatRankHTML(stats.bestRank),
            formatRankHTML(stats.worstRank),
            // Добавляем колонку с количеством точек с позицией < 20
            `<div class="d-flex align-items-center">
                <span class="me-2">${stats.visiblePointsCount} из ${stats.totalPositionsCount}</span>
                <div class="progress flex-grow-1" style="height: 8px; width: 80px;">
                    <div class="progress-bar ${getVisibilityColorClass(stats.visibilityPercent)}" 
                        role="progressbar" 
                        style="width: ${stats.visibilityPercent}%;"
                        aria-valuenow="${stats.visibilityPercent}" 
                        aria-valuemin="0" 
                        aria-valuemax="100">
                    </div>
                </div>
                <span class="ms-2 small">${stats.visibilityPercent}%</span>
            </div>`
        ];
    });

    // Получаем контейнер для таблицы
    const competitorsTableEl = document.getElementById('competitorsTable');
    if (!competitorsTableEl) {
        console.error('Element with ID "competitorsTable" not found');
        return;
    }

    // Создаем таблицу с помощью Grid.js
    if (competitorsGrid) {
        competitorsGrid.updateConfig({
            data: gridData,
            columns: [
                { name: '№', width: '50px' },
                { name: 'Название', width: '250px' },
                { 
                    name: 'Средний ранг', 
                    width: '120px',
                    formatter: (cell) => gridjs.html(cell)
                },
                { 
                    name: 'Лучшая позиция', 
                    width: '140px',
                    formatter: (cell) => gridjs.html(cell)
                },
                { 
                    name: 'Худшая позиция', 
                    width: '140px',
                    formatter: (cell) => gridjs.html(cell)
                },
                {
                    name: 'Видимых точек', 
                    width: '200px',
                    formatter: (cell) => gridjs.html(cell),
                    sort: {
                        compare: (a, b) => {
                            // Извлекаем числа из HTML для сортировки
                            const percentA = parseInt(a.match(/(\d+)%/)[1]);
                            const percentB = parseInt(b.match(/(\d+)%/)[1]);
                            return percentA - percentB;
                        }
                    }
                }
            ]
        }).forceRender();
    } else {
        competitorsGrid = new gridjs.Grid({
            columns: [
                { name: '№', width: '50px' },
                { name: 'Название', width: '250px' },
                { 
                    name: 'Средний ранг', 
                    width: '120px',
                    formatter: (cell) => gridjs.html(cell),
                    sort: {
                        compare: (a, b) => {
                            const rankA = extractRankNumberFromHTML(a);
                            const rankB = extractRankNumberFromHTML(b);
                            return rankA - rankB;
                        }
                    }
                },
                { 
                    name: 'Лучшая позиция', 
                    width: '140px',
                    formatter: (cell) => gridjs.html(cell),
                    sort: {
                        compare: (a, b) => {
                            const rankA = extractRankNumberFromHTML(a);
                            const rankB = extractRankNumberFromHTML(b);
                            return rankA - rankB;
                        }
                    }
                },
                { 
                    name: 'Худшая позиция', 
                    width: '140px',
                    formatter: (cell) => gridjs.html(cell),
                    sort: {
                        compare: (a, b) => {
                            const rankA = extractRankNumberFromHTML(a);
                            const rankB = extractRankNumberFromHTML(b);
                            return rankA - rankB;
                        }
                    }
                },
                {
                    name: 'Видимых точек', 
                    width: '200px',
                    formatter: (cell) => gridjs.html(cell),
                    sort: {
                        compare: (a, b) => {
                            // Извлекаем числа из HTML для сортировки
                            const percentA = parseInt(a.match(/(\d+)%/)[1]);
                            const percentB = parseInt(b.match(/(\d+)%/)[1]);
                            return percentA - percentB;
                        }
                    }
                }
            ],
            data: gridData,
            search: true,
            sort: true,
            className: {
                table: 'table table-hover' // Добавляем стиль для строк, чтобы они выглядели кликабельными
            },
            pagination: {
                limit: 15
            },
            language: {
                search: {
                    placeholder: 'Поиск...'
                },
                pagination: {
                    previous: 'Назад',
                    next: 'Вперед',
                    showing: 'Показано',
                    results: () => 'записей',
                    of: 'из'
                }
            }
        }).render(competitorsTableEl);
    }
    
    // Настраиваем обработчики событий таблицы после небольшой задержки
    // чтобы убедиться, что таблица полностью инициализирована
    setTimeout(() => {
        setupCompetitorsTableEvents();
        
        // Инициализируем наблюдатель за изменениями в таблице
        setupTableObserver();
    }, 300);
}

// Функция для определения класса цвета в зависимости от процента видимости
function getVisibilityColorClass(percent) {
    if (percent >= 75) return 'bg-success';
    if (percent >= 50) return 'bg-info';
    if (percent >= 25) return 'bg-warning';
    return 'bg-danger';
}

// Новая функция для настройки событий таблицы конкурентов
function setupCompetitorsTableEvents() {
    if (!competitorsGrid) return;
    
    console.log('Настройка обработчиков событий таблицы');
    
    // Устанавливаем обработчики на строки
    setupRowHandlers();
    
    // Инициализируем наблюдатель за изменениями
    setupTableObserver();
    
    // События для ручного обновления обработчиков
    const events = ['afterSearch', 'pageChange', 'afterSort'];
    events.forEach(event => {
        competitorsGrid.on(event, () => {
            console.log(`Событие таблицы: ${event}`);
            // Даем DOM обновиться
            setTimeout(setupRowHandlers, 200);
        });
    });
}

// Расчет статистики конкурента
function calculateCompetitorStats(competitor) {
    let bestRank = 100;
    let worstRank = 0;
    let visiblePointsCount = 0; // Количество точек с позицией < 20
    let totalPositionsCount = 0; // Общее количество позиций
    
    competitor.positions.forEach(position => {
        position.points.forEach(point => {
            const rankNum = rankToNumber(point.rank);
            totalPositionsCount++;
            
            if (rankNum < bestRank) {
                bestRank = rankNum;
            }
            
            if (rankNum > worstRank) {
                worstRank = rankNum;
            }
            
            // Подсчитываем точки с позицией меньше 20
            if (rankNum < 20) {
                visiblePointsCount++;
            }
        });
    });
    
    // Рассчитываем процент видимости
    const visibilityPercent = totalPositionsCount > 0 ? 
        Math.round((visiblePointsCount / totalPositionsCount) * 100) : 0;
    
    return { 
        bestRank, 
        worstRank, 
        visiblePointsCount, 
        totalPositionsCount,
        visibilityPercent
    };
}

// Фильтрация таблицы конкурентов по ключевому слову
function filterCompetitorsTable(keyword) {
    // Если выбраны все ключевые слова
    if (keyword === 'all') {
        showCompetitorsRanking();
        return;
    }
    
    // Создаем массив соответствия между отфильтрованными данными и оригинальными объектами
    let filteredCompetitors = [];
    
    // Фильтруем и отображаем конкурентов по выбранному ключевому слову
    const filteredData = competitorsData.competitors.map((competitor, index) => {
        // Находим позицию для выбранного ключевого слова
        const position = competitor.positions.find(p => p.key === keyword);
        
        if (position) {
            // Рассчитываем статистику только для этого ключевого слова
            let bestRank = 100;
            let worstRank = 0;
            
            position.points.forEach(point => {
                const rankNum = rankToNumber(point.rank);
                
                if (rankNum < bestRank) {
                    bestRank = rankNum;
                }
                
                if (rankNum > worstRank) {
                    worstRank = rankNum;
                }
            });
            
            // Сохраняем ссылку на оригинальный объект конкурента
            filteredCompetitors.push(competitor);
            
            return [
                index + 1,
                competitor.name,
                formatRankHTML(position.averageRank),
                formatRankHTML(bestRank),
                formatRankHTML(worstRank)
            ];
        }
        return null;
    }).filter(row => row !== null);
    
    // Сохраняем отфильтрованные данные для дальнейшего использования
    competitorsGrid._filteredCompetitors = filteredCompetitors;
    
    // Обновляем таблицу с конфигурацией, включающей formatter для HTML
        competitorsGrid.updateConfig({
            data: filteredData,
            columns: [
                { name: '№', width: '50px' },
                { name: 'Название', width: '250px' },
                { 
                    name: 'Средний ранг', 
                    width: '120px',
                    formatter: (cell) => gridjs.html(cell),
                    sort: {
                        compare: (a, b) => {
                            const rankA = extractRankNumberFromHTML(a);
                            const rankB = extractRankNumberFromHTML(b);
                            return rankA - rankB;
                        }
                    }
                },
                { 
                    name: 'Лучшая позиция', 
                    width: '140px',
                    formatter: (cell) => gridjs.html(cell),
                    sort: {
                        compare: (a, b) => {
                            const rankA = extractRankNumberFromHTML(a);
                            const rankB = extractRankNumberFromHTML(b);
                            return rankA - rankB;
                        }
                    }
                },
                { 
                    name: 'Худшая позиция', 
                    width: '140px',
                    formatter: (cell) => gridjs.html(cell),
                    sort: {
                        compare: (a, b) => {
                            const rankA = extractRankNumberFromHTML(a);
                            const rankB = extractRankNumberFromHTML(b);
                            return rankA - rankB;
                        }
                    }
                }
            ],
        // Сбрасываем пагинацию при фильтрации
        pagination: {
            limit: 15,
            page: 0
        }
    }).forceRender();
    
    // Привязываем обработчики для строк таблицы после фильтрации
    setTimeout(() => {
        attachTableRowHandlers();
    }, 200);
}

// Отображение детальной информации о конкуренте
function showCompetitorDetails(competitorIndex) {
    // Получаем конкурента
    const competitor = competitorsData.competitors[competitorIndex];
    if (!competitor) {
        console.error('Конкурент не найден');
        return;
    }
    
    // Сохраняем выбранного конкурента
    selectedCompetitor = competitor;
    
    // Отображаем имя конкурента в заголовке
    const nameEl = document.getElementById('selectedCompetitorName');
    if (nameEl) nameEl.textContent = competitor.name;
    
    // Вычисляем статистику
    const stats = calculateCompetitorStats(competitor);
    
    // Отображаем статистику в карточке
    const avgRankEl = document.getElementById('competitorAvgRank');
    const bestRankEl = document.getElementById('competitorBestRank');
    const keywordsCountEl = document.getElementById('competitorKeywordsCount');
    
    if (avgRankEl) avgRankEl.innerHTML = formatRankHTML(competitor.averageRank);
    if (bestRankEl) bestRankEl.innerHTML = formatRankHTML(stats.bestRank);
    
    // Подсчитываем количество уникальных ключевых слов
    const uniqueKeywords = new Set();
    competitor.positions.forEach(position => {
        uniqueKeywords.add(position.keyword || position.key);
    });
    if (keywordsCountEl) keywordsCountEl.textContent = uniqueKeywords.size;
    
    // Заполняем таблицу ключевых слов
    fillKeywordsTable(competitor);
    
    // Заполняем фильтр по ключевым словам для карты
    fillPointKeywordFilter(competitor);
    
    // Отображаем карту
    initMap();
    
    // Скрываем секцию с рейтингом и показываем детали
    document.getElementById('competitorsRankingSection').style.display = 'none';
    
    const detailSection = document.getElementById('competitorDetailSection');
    detailSection.style.display = 'block';
    detailSection.classList.add('slide-in');
    
    // Прокручиваем страницу к деталям
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Заполнение фильтра ключевых слов для карты
function fillPointKeywordFilter(competitor) {
    const pointKeywordFilter = document.getElementById('pointKeywordFilter');
    
    if (!pointKeywordFilter) return;
    
    // Очищаем существующие опции, кроме первой (выберите ключевое слово)
    while (pointKeywordFilter.options.length > 1) {
        pointKeywordFilter.remove(1);
    }
    
    // Получаем уникальные ключевые слова
    const uniqueKeywords = new Set();
    competitor.positions.forEach(position => {
        uniqueKeywords.add(position.keyword || position.key);
    });
    
    // Заполняем фильтр
    uniqueKeywords.forEach(keyword => {
        // Для фильтра карты
        const pointOption = document.createElement('option');
        pointOption.value = keyword;
        pointOption.textContent = keyword;
        pointKeywordFilter.appendChild(pointOption);
    });
    
}

// Инициализация карты
function initMap() {
    // Если карта уже инициализирована, очищаем маркеры
    if (map) {
        // Очищаем существующие маркеры
        markers.forEach(marker => marker.remove());
        markers = [];
        return;
    }
    
    // Получаем контейнер для карты
    const mapContainer = document.getElementById('positionsMap');
    if (!mapContainer) {
        console.error('Контейнер для карты не найден');
        return;
    }
    
    // Очищаем содержимое контейнера карты
    mapContainer.innerHTML = '';
    
    try {
        // Создаем карту с центром в координатах бизнеса или по умолчанию в центре Москвы
        const defaultCenter = [55.751244, 37.618423]; // Москва
        const businessCenter = coreData && coreData.points ? 
            [coreData.points.latitude, coreData.points.longitude] : 
            defaultCenter;
        
        map = L.map('positionsMap').setView(businessCenter, 10);
        
        // Добавляем тайлы OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        // Добавляем маркер бизнеса
        const businessIcon = L.divIcon({
            className: 'map-marker',
            html: '<i class="fas fa-building" style="color: #007bff; font-size: 24px;"></i>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        L.marker(businessCenter, { icon: businessIcon })
            .addTo(map)
            .bindTooltip('Ваш бизнес', { className: 'map-marker-tooltip' });
        
        // Добавляем кнопки управления масштабом
        L.control.zoom({
            position: 'topright'
        }).addTo(map);
        
        // Добавляем легенду
        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = function() {
            const div = L.DomUtil.create('div', 'map-legend bg-white p-2 rounded shadow-sm');
            div.innerHTML = `
                <h6 class="mb-2">Позиции:</h6>
                <div class="d-flex align-items-center mb-1">
                    <span class="rank-badge rank-1 me-2" style="width: 20px; height: 20px; display: inline-block;"></span>
                    <small>1</small>
                </div>
                <div class="d-flex align-items-center mb-1">
                    <span class="rank-badge rank-2-3 me-2" style="width: 20px; height: 20px; display: inline-block;"></span>
                    <small>2-3</small>
                </div>
                <div class="d-flex align-items-center mb-1">
                    <span class="rank-badge rank-4-10 me-2" style="width: 20px; height: 20px; display: inline-block;"></span>
                    <small>4-10</small>
                </div>
                <div class="d-flex align-items-center mb-1">
                    <span class="rank-badge rank-11-20 me-2" style="width: 20px; height: 20px; display: inline-block;"></span>
                    <small>11-20</small>
                </div>
                <div class="d-flex align-items-center">
                    <span class="rank-badge rank-20-plus me-2" style="width: 20px; height: 20px; display: inline-block;"></span>
                    <small>>20</small>
                </div>
            `;
            return div;
        };
        legend.addTo(map);
        
        // Обновляем размер карты после её инициализации
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
        
    } catch (error) {
        console.error('Ошибка при инициализации карты:', error);
        mapContainer.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Ошибка при загрузке карты. Пожалуйста, обновите страницу.
            </div>
        `;
    }
}

// Вспомогательные функции

// Преобразование ранга в число
function rankToNumber(rank) {
    if (rank === '-' || rank === null || rank === undefined) return 100;
    
    // Если это строка с "+" (например, "20+"), извлекаем числовую часть
    if (typeof rank === 'string' && rank.includes('+')) {
        return parseInt(rank, 10);
    }
    
    const numRank = parseInt(rank, 10);
    return isNaN(numRank) ? 100 : numRank;
}

// Форматирование HTML для отображения ранга
function formatRankHTML(rank, trend = null) {
    const numRank = rankToNumber(rank);
    if (numRank === 100) return '-';
    
    // Определяем стиль для отображения ранга
    const rankClass = getRankClass(numRank);
    
    // Базовый HTML для отображения ранга
    // Если ранг 20 и больше, отображаем как "20+"
    const displayRank = numRank >= 20 ? '20+' : numRank;
    let html = `<span class="rank-badge ${rankClass}">${displayRank}</span>`;
    
    // Добавляем индикатор тренда, если он указан
    if (trend) {
        let trendIcon, trendClass;
        
        switch (trend) {
            case 'up':
                trendIcon = 'fa-arrow-up';
                trendClass = 'trend-up';
                break;
            case 'down':
                trendIcon = 'fa-arrow-down';
                trendClass = 'trend-down';
                break;
            default:
                trendIcon = 'fa-minus';
                trendClass = 'trend-neutral';
        }
        
        // Добавляем индикатор тренда рядом с рангом
        html += ` <span class="ms-2 ${trendClass}"><i class="fas ${trendIcon}"></i></span>`;
    }
    
    return html;
}

// Получение класса для отображения ранга
function getRankClass(rank) {
    if (rank === 1) return 'rank-1';
    if (rank >= 2 && rank <= 3) return 'rank-2-3';
    if (rank >= 4 && rank <= 10) return 'rank-4-10';
    if (rank >= 11 && rank <= 20) return 'rank-11-20';
    return 'rank-20-plus';
}

// Получение цвета для ранга (для маркеров на карте)
function getColorForRank(rank) {
    const numRank = rankToNumber(rank);
    if (numRank === 1) return '#28a745';
    if (numRank >= 2 && numRank <= 3) return '#5cb85c';
    if (numRank >= 4 && numRank <= 10) return '#ffc107';
    if (numRank >= 11 && numRank <= 20) return '#fd7e14';
    return '#dc3545';
}

// Форматирование HTML для отображения видимости
function formatVisibilityHTML(visibility) {
    // Создаем HTML с прогресс-баром
    let progressClass = 'bg-danger';
    
    if (visibility >= 80) {
        progressClass = 'bg-success';
    } else if (visibility >= 60) {
        progressClass = 'bg-info';
    } else if (visibility >= 40) {
        progressClass = 'bg-warning';
    } else if (visibility >= 20) {
        progressClass = 'bg-orange';
    }
    
    // Создаем прогресс-бар с соответствующим классом
    const html = `
        <div class="d-flex align-items-center">
            <div class="progress flex-grow-1 me-2" style="height: 8px;">
                <div class="progress-bar ${progressClass}" role="progressbar" 
                    style="width: ${visibility}%;" 
                    aria-valuenow="${visibility}" 
                    aria-valuemin="0" 
                    aria-valuemax="100"></div>
            </div>
            <div class="small fw-bold">${visibility}%</div>
        </div>
    `;
    
    return html;
}

// Функция экспорта данных в HTML файл
function exportToHtml() {
    if (!coreData || !pointsData || !competitorsData) {
        alert('Сначала необходимо загрузить данные.');
        return;
    }
    
    // Создаем HTML-контент
    const htmlContent = generateHtmlContent();
    
    // Создаем Blob с HTML-контентом
    const blob = new Blob([htmlContent], { type: 'text/html' });
    
    // Создаем URL для скачивания
    const url = URL.createObjectURL(blob);
    
    // Создаем временную ссылку для скачивания
    const a = document.createElement('a');
    a.href = url;
    a.download = `${coreData.name}_analysis.html`;
    document.body.appendChild(a);
    a.click();
    
    // Освобождаем URL
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

// Генерация HTML-контента
function generateHtmlContent() {
    // Получаем базовые стили страницы
    const styleSheets = Array.from(document.styleSheets);
    let styles = '';
    
    styleSheets.forEach(sheet => {
        try {
            const rules = sheet.cssRules || sheet.rules;
            for (let i = 0; i < rules.length; i++) {
                styles += rules[i].cssText + '\n';
            }
        } catch (e) {
            // Пропускаем стили, загруженные с других доменов
        }
    });
    
    // Получаем данные о конкурентах для таблицы
    const competitorsTableHtml = generateCompetitorsTableHtml();
    
    // Если выбран конкурент, генерируем таблицу с ключевыми словами
    let keywordsTableHtml = '';
    if (selectedCompetitor) {
        keywordsTableHtml = generateKeywordsTableHtml(selectedCompetitor);
    }
    
    // Если выбран конкурент и ключевое слово, генерируем карту
    let mapHtml = '';
    if (selectedCompetitor) {
        const keywordFilter = document.getElementById('pointKeywordFilter').value;
        if (keywordFilter) {
            mapHtml = generateMapHtml(selectedCompetitor, keywordFilter);
        }
    }
    
    // Создаем HTML
    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Анализ конкурентов - ${coreData.name}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://unpkg.com/gridjs/dist/theme/mermaid.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css">
    <style>
        ${styles}
        body { padding: 20px; }
        .rank-badge {
            padding: 4px 8px;
            border-radius: 4px;
            color: white;
            font-weight: bold;
        }
        .rank-1 { background-color: #28a745; }
        .rank-2-3 { background-color: #5cb85c; }
        .rank-4-10 { background-color: #ffc107; color: #333; }
        .rank-11-20 { background-color: #fd7e14; }
        .rank-20-plus { background-color: #dc3545; }
        .map-container { height: 500px; margin-top: 20px; }
        #exportMapContainer { width: 100%; height: 500px; }
        .map-marker-tooltip { font-size: 12px; }
        .card { margin-bottom: 20px; }
        .fade-in { animation: fadeIn 0.5s; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="mb-4">Отчет по анализу конкурентов</h1>
        <p>Дата создания: ${new Date().toLocaleDateString()}</p>
        
        <div class="card">
            <div class="card-header bg-primary text-white">
                <h3>Информация о бизнесе</h3>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <p><strong>Название:</strong> ${coreData.name}</p>
                        <p><strong>Ключевые слова:</strong> ${coreData.keys.join(', ')}</p>
                        <p><strong>Дата создания:</strong> ${new Date(coreData.create_date).toLocaleDateString()}</p>
                    </div>
                    <div class="col-md-6">
                        <p><strong>Координаты:</strong> ${coreData.points.latitude}, ${coreData.points.longitude}</p>
                        <p><strong>Количество точек:</strong> ${pointsData.length}</p>
                        <p><strong>Количество конкурентов:</strong> ${competitorsData.competitors.length}</p>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header bg-primary text-white">
                <h3>Рейтинг конкурентов</h3>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-striped table-bordered">
                        <thead>
                            <tr>
                                <th>№</th>
                                <th>Название</th>
                                <th>Средний ранг</th>
                                <th>Лучшая позиция</th>
                                <th>Худшая позиция</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${competitorsTableHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    
        ${selectedCompetitor ? `
        <div class="card">
            <div class="card-header bg-primary text-white">
                <h3>Статистика по ключевым словам "${selectedCompetitor.name}"</h3>
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-striped table-bordered">
                        <thead>
                            <tr>
                                <th>Ключевое слово</th>
                                <th>Средний ранг</th>
                                <th>Видимость</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${keywordsTableHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        ` : ''}
        
        ${mapHtml}
    </div>
    
    ${mapHtml ? `
    <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
    <script>
        // Инициализация экспортированной карты
        document.addEventListener('DOMContentLoaded', function() {
            initExportedMap();
        });
        
        function initExportedMap() {
            // Данные для карты
            const mapData = ${JSON.stringify({
                center: [coreData.points.latitude, coreData.points.longitude],
                points: getPointsForMap(selectedCompetitor, keywordFilter)
            })};
            
            // Создаем карту
            const map = L.map('exportMapContainer').setView(mapData.center, 12);
            
            // Добавляем слой OpenStreetMap
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);
            
            // Добавляем маркер для бизнеса
            L.marker(mapData.center, {
                icon: L.divIcon({
                    className: 'map-marker',
                    html: '<i class="fas fa-building"></i>',
                    iconSize: [30, 30]
                })
            }).addTo(map)
            .bindTooltip("${coreData.name}", { 
                className: 'map-marker-tooltip',
                direction: 'top'
            });
            
            // Добавляем маркеры для точек
            const markers = [];
            
            mapData.points.forEach(point => {
                // Создаем маркер
                const marker = L.marker([point.lat, point.lng], {
                    icon: L.divIcon({
                        className: 'map-marker ' + point.rankClass,
                        html: '<div style="background-color: ' + point.color + '; width: 30px; height: 30px; color: white; display: flex; align-items: center; justify-content: center;">' + point.rank + '</div>',
                        iconSize: [30, 30]
                    })
                }).addTo(map);
                
                // Добавляем всплывающую подсказку
                marker.bindTooltip('Позиция: ' + point.rank + '<br>Координаты: ' + point.lat.toFixed(6) + ', ' + point.lng.toFixed(6), {
                    className: 'map-marker-tooltip',
                    direction: 'top'
                });
                
                markers.push(marker);
            });
            
            // Подгоняем карту под маркеры
            if (markers.length > 0) {
                const group = new L.featureGroup(markers);
                map.fitBounds(group.getBounds().pad(0.1));
            }
        }
    </script>
    ` : ''}
</body>
</html>`;
}

// Генерация HTML для карты
function generateMapHtml(competitor, keyword) {
    if (!competitor || !keyword) return '';
    
    return `
    <div class="card">
        <div class="card-header bg-primary text-white">
            <h3>Позиции конкурента "${competitor.name}" для ключевого слова "${keyword}"</h3>
        </div>
        <div class="card-body">
            <div id="exportMapContainer" class="map-container"></div>
        </div>
    </div>`;
}

// Получение точек для карты
function getPointsForMap(competitor, keyword) {
    if (!competitor || !keyword) return [];
    
    const pointsData = [];
    const position = competitor.positions.find(p => p.key === keyword);
    
    if (position) {
        position.points.forEach(point => {
            const rank = point.rank;
            const rankClass = getRankClass(rank);
            const color = getColorForRank(rank);
            
            pointsData.push({
                lat: point.coordinates.lat,
                lng: point.coordinates.lng,
                rank: rank,
                rankClass: rankClass,
                color: color
            });
        });
    }
    
    return pointsData;
}

// Генерация HTML для таблицы конкурентов
function generateCompetitorsTableHtml() {
    let tableHtml = '';
    
    competitorsData.competitors.forEach((competitor, index) => {
        const { bestRank, worstRank } = calculateCompetitorStats(competitor);
        
        tableHtml += `
            <tr>
                <td>${index + 1}</td>
                <td>${competitor.name}</td>
                <td>${formatRankHTML(competitor.averageRank)}</td>
                <td>${formatRankHTML(bestRank)}</td>
                <td>${formatRankHTML(worstRank)}</td>
            </tr>`;
    });
    
    return tableHtml;
}

// Генерация HTML для таблицы ключевых слов
function generateKeywordsTableHtml(competitor) {
    if (!competitor) return '';
    
    let html = '';
    
    competitor.positions.forEach(position => {
        const { visibility } = calculateKeywordStats(position);
        
        html += `
            <tr>
                <td>${position.key}</td>
                <td>${formatRankHTML(position.averageRank)}</td>
                <td>${formatVisibilityHTML(visibility)}</td>
            </tr>`;
    });
    
    return html;
}

// Функция для подсветки строк таблицы и добавления интерактивности
function highlightTableRows(rows) {
    if (!rows || !rows.length) return;
    
    rows.forEach(row => {
        // Добавляем/обновляем стили для наведения
        row.classList.add('hoverable-row');
        
        // Добавляем эффект нажатия
        row.addEventListener('mousedown', function() {
            this.classList.add('row-active');
        });
        
        row.addEventListener('mouseup', function() {
            this.classList.remove('row-active');
        });
        
        row.addEventListener('mouseleave', function() {
            this.classList.remove('row-active');
        });
    });
}

// Показать индикатор загрузки
function showLoadingIndicator() {
    let loadingIndicator = document.getElementById('loadingIndicator');
    
    // Если индикатора загрузки еще нет, создаем его
    if (!loadingIndicator) {
        loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'loadingIndicator';
        loadingIndicator.className = 'loading-overlay fade-in';
        loadingIndicator.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Загрузка...</span>
            </div>
            <div class="mt-2 text-white">Загрузка данных...</div>
        `;
        document.body.appendChild(loadingIndicator);
    } else {
        loadingIndicator.style.display = 'flex';
    }
}

// Скрыть индикатор загрузки
function hideLoadingIndicator() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

// Кэширование данных
function cacheData(data) {
    try {
        localStorage.setItem('googleMapsAnalysisData', JSON.stringify(data));
        localStorage.setItem('dataCacheTime', Date.now().toString());
        console.log('Данные успешно кэшированы');
    } catch (error) {
        console.error('Ошибка при кэшировании данных:', error);
        // Пробуем очистить хранилище и повторить попытку
        try {
            localStorage.clear();
            localStorage.setItem('googleMapsAnalysisData', JSON.stringify(data));
            console.log('Кэширование после очистки хранилища выполнено успешно');
        } catch (retryError) {
            console.error('Не удалось кэшировать данные даже после очистки:', retryError);
        }
    }
}

// Получение кэшированных данных
function getCachedData() {
    try {
        const cacheTimeStr = localStorage.getItem('dataCacheTime');
        if (!cacheTimeStr) return null;
        
        // Проверяем, не устарел ли кэш (24 часа)
        const cacheTime = parseInt(cacheTimeStr, 10);
        const currentTime = Date.now();
        const cacheAgeHours = (currentTime - cacheTime) / (1000 * 60 * 60);
        
        if (cacheAgeHours > 24) {
            console.log('Кэш устарел, загружаем новые данные');
            localStorage.removeItem('googleMapsAnalysisData');
            localStorage.removeItem('dataCacheTime');
            return null;
        }
        
        const cachedDataStr = localStorage.getItem('googleMapsAnalysisData');
        if (!cachedDataStr) return null;
        
        return JSON.parse(cachedDataStr);
    } catch (error) {
        console.error('Ошибка при получении кэшированных данных:', error);
        return null;
    }
}

// Заполнение таблицы ключевых слов
function fillKeywordsTable(competitor) {
    if (!competitor || !Array.isArray(competitor.positions) || !competitor.positions.length) {
        console.warn('Нет данных для таблицы ключевых слов');
        return;
    }
    // Получаем уникальные ключевые слова и их статистику
    const keywordsMap = new Map();
    
    competitor.positions.forEach(position => {
        const keyword = position.keyword;
        if (!keywordsMap.has(keyword)) {
            const stats = calculateKeywordStats(position);
            keywordsMap.set(keyword, {
                keyword: keyword,
                averageRank: position.averageRank,
                visibility: stats.visibility
            });
        }
    });
    
    // Преобразуем в массив для таблицы
    const keywordsData = Array.from(keywordsMap.values()).map(item => {
        return [
            item.keyword,
            formatRankHTML(item.averageRank),
            formatVisibilityHTML(item.visibility)
        ];
    });
    
    // Получаем контейнер для таблицы
    const keywordsTableEl = document.getElementById('keywordsTable');
    if (!keywordsTableEl) {
        console.error('Element with ID "keywordsTable" not found');
        return;
    }
    
    // Создаем таблицу ключевых слов с помощью Grid.js
    if (keywordsGrid) {
        keywordsGrid.updateConfig({
            data: keywordsData,
            columns: [
                { name: 'Ключевое слово' },
                { 
                    name: 'Средний ранг',
                    formatter: (cell) => gridjs.html(cell),
                    sort: {
                        compare: (a, b) => {
                            // Извлекаем числовые значения из HTML-строк для сортировки
                            const matchA = a.match(/(\d+)(\+)?/);
                            const matchB = b.match(/(\d+)(\+)?/);
                            
                            // Если нет совпадений, считаем значение как 100
                            let rankA = 100;
                            let rankB = 100;
                            
                            if (matchA) {
                                rankA = parseInt(matchA[1]);
                                // Если есть "+", добавляем 0.5 для корректной сортировки
                                if (matchA[2] === '+') rankA += 0.5;
                            }
                            
                            if (matchB) {
                                rankB = parseInt(matchB[1]);
                                // Если есть "+", добавляем 0.5 для корректной сортировки
                                if (matchB[2] === '+') rankB += 0.5;
                            }
                            
                            return rankA - rankB;
                        }
                    }
                },
                { 
                    name: 'Видимость',
                    formatter: (cell) => gridjs.html(cell),
                    sort: {
                        compare: (a, b) => {
                            // Извлекаем числовые значения из процентов видимости
                            const percentA = parseInt(a.match(/(\d+)%/)?.[1] || '0');
                            const percentB = parseInt(b.match(/(\d+)%/)?.[1] || '0');
                            return percentA - percentB;
                        }
                    }
                }
            ]
        }).forceRender();
    } else {
        keywordsGrid = new gridjs.Grid({
            columns: [
                { name: 'Ключевое слово' },
                { 
                    name: 'Средний ранг',
                    formatter: (cell) => gridjs.html(cell),
                    sort: {
                        compare: (a, b) => {
                            // Извлекаем числовые значения из HTML-строк для сортировки
                            const matchA = a.match(/(\d+)(\+)?/);
                            const matchB = b.match(/(\d+)(\+)?/);
                            
                            // Если нет совпадений, считаем значение как 100
                            let rankA = 100;
                            let rankB = 100;
                            
                            if (matchA) {
                                rankA = parseInt(matchA[1]);
                                // Если есть "+", добавляем 0.5 для корректной сортировки
                                if (matchA[2] === '+') rankA += 0.5;
                            }
                            
                            if (matchB) {
                                rankB = parseInt(matchB[1]);
                                // Если есть "+", добавляем 0.5 для корректной сортировки
                                if (matchB[2] === '+') rankB += 0.5;
                            }
                            
                            return rankA - rankB;
                        }
                    }
                },
                { 
                    name: 'Видимость',
                    formatter: (cell) => gridjs.html(cell),
                    sort: {
                        compare: (a, b) => {
                            // Извлекаем числовые значения из процентов видимости
                            const percentA = parseInt(a.match(/(\d+)%/)?.[1] || '0');
                            const percentB = parseInt(b.match(/(\d+)%/)?.[1] || '0');
                            return percentA - percentB;
                        }
                    }
                }
            ],
            data: keywordsData,
            sort: true,
            pagination: {
                limit: 10
            },
            language: {
                pagination: {
                    previous: 'Назад',
                    next: 'Вперед',
                    showing: 'Показано',
                    results: () => 'записей',
                    of: 'из'
                }
            }
        }).render(keywordsTableEl);
        
        // Добавляем обработчики событий для таблицы ключевых слов
        if (keywordsGrid) {
            // События для обновления стилей таблицы
            const tableEvents = ['afterSort', 'afterPagination'];
            tableEvents.forEach(event => {
                keywordsGrid.on(event, () => {
                    console.log(`Событие таблицы ключевых слов: ${event}`);
                    // Применяем стили к строкам
                    setTimeout(() => {
                        const rows = document.querySelectorAll('#keywordsTable .gridjs-tbody tr');
                        highlightTableRows(rows);
                        // Добавляем обработчики клика для открытия модального окна
                        attachKeywordsRowHandlers(rows, selectedCompetitor);
                    }, 100);
                });
            });
            
            // Когда таблица готова, добавляем обработчики для строк
            keywordsGrid.on('ready', () => {
                setTimeout(() => {
                    const rows = document.querySelectorAll('#keywordsTable .gridjs-tbody tr');
                    attachKeywordsRowHandlers(rows, selectedCompetitor);
                }, 100);
            });
        }
    }
}

// Функция для прикрепления обработчиков к строкам таблицы ключевых слов
function attachKeywordsRowHandlers(rows, competitor) {
    if (!rows || !rows.length) return;
    
    rows.forEach((row, rowIndex) => {
        // Очищаем предыдущие обработчики
        if (row._clickHandler) {
            row.removeEventListener('click', row._clickHandler);
        }
        
        // Добавляем визуальный эффект курсора указателя
        row.style.cursor = 'pointer';
        
        // Создаем и привязываем новый обработчик
        row._clickHandler = function(event) {
            // Предотвращаем стандартное поведение
            event.preventDefault();
            
            // Подсвечиваем активную строку
            rows.forEach(r => r.classList.remove('row-active'));
            row.classList.add('row-active');
            
            // Получаем данные о ключевом слове из строки
            const cells = row.querySelectorAll('td');
            if (cells.length > 0) {
                const keyword = cells[0].textContent.trim();
                // Открываем модальное окно с позициями для этого ключевого слова
                showPositionsModal(competitor, keyword);
            }
        };
        
        row.addEventListener('click', row._clickHandler);
    });
}

// Функция для отображения модального окна с позициями конкурента
function showPositionsModal(competitor, keyword) {
    if (!competitor || !Array.isArray(competitor.positions) || !competitor.positions.length) {
        console.warn('Нет данных для модального окна позиций');
        return;
    }
    
    // Дополнительная проверка корректности данных конкурента
    if (!competitor.name || !Array.isArray(competitor.positions)) {
        console.error('Неверный формат данных конкурента:', competitor);
        return;
    }
    
    console.log('Открываю модальное окно для конкурента:', competitor.name, 'с', competitor.positions.length, 'позициями');
    
    // Сохраняем выбранного конкурента
    selectedCompetitor = competitor;
    
    // Устанавливаем заголовок модального окна
    const modalCompetitorName = document.getElementById('modalCompetitorName');
    if (modalCompetitorName) {
        modalCompetitorName.textContent = competitor.name;
    }
    
    // Сбрасываем значение поля поиска
    const searchField = document.getElementById('modalKeywordSearch');
    if (searchField) {
        searchField.value = '';
    }
    
    // Сбрасываем чекбокс группировки
    const groupCheckbox = document.getElementById('groupByKeyword');
    if (groupCheckbox) {
        groupCheckbox.checked = false;
        groupKeywordsEnabled = false;
    }
    
    // Заполняем селект с ключевыми словами
    fillModalKeywordFilter(competitor);
    
    // Создаем данные для таблицы позиций
    const tableData = [];
    competitor.positions.forEach(position => {
        const keyword = position.keyword || position.key;
        const stats = calculateKeywordStats(position);
        
        position.points.forEach(point => {
            tableData.push([
                keyword,
                point.coordinates?.lat?.toFixed(6) || point.lat.toFixed(6), 
                point.coordinates?.lng?.toFixed(6) || point.lng.toFixed(6),
                formatRankHTML(point.rank)
            ]);
        });
    });
    
    // Получаем контейнер для таблицы в модальном окне
    const modalTableEl = document.getElementById('modalPositionsTable');
    if (!modalTableEl) {
        console.error('Element with ID "modalPositionsTable" not found');
        return;
    }
    
    // Создаем таблицу позиций
    const modalPositionsGrid = new gridjs.Grid({
        columns: [
            { 
                name: 'Ключевое слово',
                sort: true
            },
            { 
                name: 'Широта',
                sort: true
            },
            { 
                name: 'Долгота',
                sort: true
            },
            { 
                name: 'Позиция',
                formatter: (cell) => gridjs.html(cell),
                sort: {
                    compare: (a, b) => {
                        const rankA = extractRankNumberFromHTML(a);
                        const rankB = extractRankNumberFromHTML(b);
                        return rankA - rankB;
                    }
                }
            }
        ],
        data: tableData,
        pagination: {
            limit: 15
        },
        language: {
            pagination: {
                previous: 'Назад',
                next: 'Вперед',
                showing: 'Показано',
                results: () => 'записей',
                of: 'из'
            }
        },
        className: {
            td: 'position-table-cell'
        }
    }).render(modalTableEl);
    
    // Сохраняем ссылку на таблицу
    positionsGrid = modalPositionsGrid;
    
    // Инициализация карты в модальном окне
    initModalMap();
    
    // Открываем модальное окно
    const positionsModal = new bootstrap.Modal(document.getElementById('positionsModal'));
    positionsModal.show();
    
    // Добавляем обработчик для очистки данных при закрытии модального окна
    document.getElementById('positionsModal').addEventListener('hidden.bs.modal', function() {
        if (modalPositionsGrid) {
            modalPositionsGrid.destroy();
        }
        
        // Очищаем маркеры на карте
        if (modalMap) {
            modalMarkers.forEach(marker => marker.remove());
            modalMarkers = [];
        }
        
        // Очищаем выбранного конкурента
        selectedCompetitor = null;
    }, { once: true });
    
    // Настраиваем обработчик события отрисовки таблицы для добавления обработчиков событий к строкам
    modalPositionsGrid.on('rowClick', (_, e) => {
        // Подсвечиваем активную строку
        const allRows = document.querySelectorAll('#modalPositionsTable .gridjs-tbody tr');
        allRows.forEach(row => row.classList.remove('row-active'));
        e.currentTarget.classList.add('row-active');
        
        // Получаем данные из ячеек
        const cells = e.currentTarget.querySelectorAll('td');
        if (cells.length >= 4) {
            const keyword = cells[0].textContent;
            const lat = parseFloat(cells[1].textContent);
            const lng = parseFloat(cells[2].textContent);
            
            // Если координаты валидны, центрируем карту и показываем маркер
            if (!isNaN(lat) && !isNaN(lng) && modalMap) {
                modalMap.setView([lat, lng], 14);
                
                // Находим соответствующий маркер и добавляем к нему анимацию
                modalMarkers.forEach(marker => {
                    const markerLatLng = marker.getLatLng();
                    if (Math.abs(markerLatLng.lat - lat) < 0.0001 && Math.abs(markerLatLng.lng - lng) < 0.0001) {
                        // Анимируем маркер
                        const icon = marker.getElement();
                        if (icon) {
                            icon.style.transform = 'scale(1.3)';
                            icon.style.zIndex = 1000;
                            setTimeout(() => {
                                icon.style.transform = '';
                                icon.style.zIndex = '';
                            }, 500);
                        }
                        
                        // Открываем всплывающую подсказку
                        marker.openTooltip();
                    }
                });
            }
        }
    });
}

// Заполнение фильтра ключевых слов для модального окна
function fillModalKeywordFilter(competitor) {
    const keywordFilter = document.getElementById('modalKeywordFilter');
    
    if (!keywordFilter) return;
    
    // Очищаем существующие опции, кроме первой
    while (keywordFilter.options.length > 1) {
        keywordFilter.remove(1);
    }
    
    // Получаем уникальные ключевые слова
    const uniqueKeywords = new Set();
    competitor.positions.forEach(position => {
        uniqueKeywords.add(position.keyword || position.key);
    });
    
    // Заполняем фильтр
    uniqueKeywords.forEach(keyword => {
        const option = document.createElement('option');
        option.value = keyword;
        option.textContent = keyword;
        keywordFilter.appendChild(option);
    });
    
    // Обработчик изменения фильтра
    keywordFilter.addEventListener('change', function() {
        if (this.value) {
            showPositionsOnModalMap(selectedCompetitor, this.value);
        } else {
            // Показываем все позиции, если выбрано "Все ключевые слова"
            showAllPositionsOnModalMap(selectedCompetitor);
        }
    });
    
    // По умолчанию показываем все позиции
    showAllPositionsOnModalMap(selectedCompetitor);
}

// Инициализация карты в модальном окне
function initModalMap() {
    // Если карта уже инициализирована, очищаем маркеры
    if (modalMap) {
        // Очищаем существующие маркеры, если они есть
        if (modalMarkers && modalMarkers.length > 0) {
            modalMarkers.forEach(marker => marker.remove());
            modalMarkers = [];
        }
        return;
    }
    
    // Получаем контейнер для карты
    const mapContainer = document.getElementById('modalPositionsMap');
    if (!mapContainer) {
        console.error('Контейнер для карты не найден');
        return;
    }
    
    // Очищаем содержимое контейнера карты
    mapContainer.innerHTML = '';
    
    try {
        // Создаем карту с центром в координатах бизнеса или по умолчанию в центре Москвы
        const defaultCenter = [55.751244, 37.618423]; // Москва
        const businessCenter = coreData && coreData.points ? 
            [coreData.points.latitude, coreData.points.longitude] : 
            defaultCenter;
        
        modalMap = L.map('modalPositionsMap').setView(businessCenter, 10);
        
        // Добавляем тайлы OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(modalMap);
        
        // Инициализируем массив маркеров, если он не существует
        if (!modalMarkers) {
            modalMarkers = [];
        }
        
        // Обновляем размер карты после её инициализации
        setTimeout(() => {
            if (modalMap) {
                modalMap.invalidateSize();
            }
        }, 300);
        
    } catch (error) {
        console.error('Ошибка при инициализации карты:', error);
        mapContainer.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Ошибка при загрузке карты. Пожалуйста, обновите страницу.
            </div>
        `;
    }
}

// Отображение всех позиций конкурента на карте
function showAllPositionsOnModalMap(competitor) {
    if (!modalMap || !competitor) {
        console.error('Не все данные доступны для отображения на карте');
        return;
    }
    
    try {
        // Очищаем существующие маркеры
        modalMarkers.forEach(marker => marker.remove());
        modalMarkers = [];
        
        // Собираем все точки для отображения
        const allPoints = [];
        const keywordColors = {};
        const keywordList = [];
        
        // Генерируем случайные цвета для каждого ключевого слова
        competitor.positions.forEach((position, index) => {
            const keyword = position.keyword || position.key;
            if (!keywordColors[keyword]) {
                // Генерируем разные цвета для разных ключевых слов
                const hue = (index * 137) % 360; // Используем золотое сечение для равномерного распределения цветов
                keywordColors[keyword] = `hsl(${hue}, 70%, 50%)`;
                keywordList.push({ keyword, color: keywordColors[keyword] });
            }
        });
        
        // Собираем все точки с информацией о ключевых словах
        competitor.positions.forEach(position => {
            const keyword = position.keyword || position.key;
            
            position.points.forEach(point => {
                const rank = rankToNumber(point.rank);
                // Если группировка по ключевым словам включена, используем цвет ключевого слова
                // иначе используем цвет ранга
                const color = groupKeywordsEnabled ? 
                    keywordColors[keyword] : 
                    getColorForRank(rank);
                
                allPoints.push({
                    coords: point.coordinates ? [point.coordinates.lat, point.coordinates.lng] : [point.lat, point.lng],
                    rank: rank,
                    color: color,
                    location: point.location || 'Неизвестно',
                    keyword: keyword
                });
            });
        });
        
        if (allPoints.length === 0) {
            console.log('Нет данных о позициях');
            return;
        }
        
        // Обновляем легенду на карте, если группировка по ключевым словам включена
        if (groupKeywordsEnabled) {
            updateMapLegend(keywordList);
        } else {
            // Сбрасываем легенду к стандартному отображению рангов
            updateMapLegend([]);
        }
        
        // Добавляем маркеры на карту
        allPoints.forEach(point => {
            // Для отображения на маркере используем преобразованное значение
            const displayRank = point.rank >= 20 ? '20+' : point.rank;
            
            const markerIcon = L.divIcon({
                className: 'map-marker',
                html: `<div style="background-color: ${point.color}; width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">${groupKeywordsEnabled ? '' : displayRank}</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });
            
            const marker = L.marker(point.coords, { icon: markerIcon })
                .addTo(modalMap)
                .bindTooltip(`
                    <div>
                        <strong>Ключевое слово:</strong> ${point.keyword}<br>
                        <strong>Ранг:</strong> ${displayRank}<br>
                        <strong>Локация:</strong> ${point.location}
                    </div>
                `, { className: 'map-marker-tooltip' });
                
            // Добавляем эффект при клике
            marker.on('click', function() {
                // Анимация маркера
                const icon = marker.getElement();
                if (icon) {
                    icon.style.transform = 'scale(1.2)';
                    setTimeout(() => {
                        icon.style.transform = '';
                    }, 300);
                }
            });
            
            modalMarkers.push(marker);
        });
        
        // Устанавливаем границы карты, чтобы видеть все точки
        if (allPoints.length > 0) {
            const bounds = L.latLngBounds(allPoints.map(p => p.coords));
            modalMap.fitBounds(bounds, { padding: [50, 50] });
        }
        
    } catch (error) {
        console.error('Ошибка при отображении позиций на карте:', error);
    }
}

// Отображение позиций конкурента для выбранного ключевого слова на карте
function showPositionsOnModalMap(competitor, keyword) {
    if (!modalMap || !competitor || !keyword) {
        console.error('Не все данные доступны для отображения на карте');
        return;
    }
    
    try {
        // Очищаем существующие маркеры
        modalMarkers.forEach(marker => marker.remove());
        modalMarkers = [];
        
        // Находим позиции для выбранного ключевого слова
        const position = competitor.positions.find(p => (p.keyword === keyword || p.key === keyword));
        if (!position || !position.points || position.points.length === 0) {
            console.log(`Нет данных о позициях для ключа "${keyword}"`);
            return;
        }
        
        // Собираем все точки для отображения
        const points = position.points.map(point => {
            const rank = rankToNumber(point.rank);
            const color = getColorForRank(rank);
            
            return {
                coords: point.coordinates ? [point.coordinates.lat, point.coordinates.lng] : [point.lat, point.lng],
                rank: rank,
                color: color,
                location: point.location || 'Неизвестно',
                keyword: keyword
            };
        });
        
        if (points.length === 0) {
            console.log(`Нет данных о позициях для ключа "${keyword}"`);
            return;
        }
        
        // Добавляем маркеры на карту
        points.forEach(point => {
            // Для отображения на маркере используем преобразованное значение
            const displayRank = point.rank >= 20 ? '20+' : point.rank;
            
            const markerIcon = L.divIcon({
                className: 'map-marker',
                html: `<div style="background-color: ${point.color}; width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">${displayRank}</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });
            
            const marker = L.marker(point.coords, { icon: markerIcon })
                .addTo(modalMap)
                .bindTooltip(`
                    <div>
                        <strong>Ключевое слово:</strong> ${point.keyword}<br>
                        <strong>Ранг:</strong> ${displayRank}<br>
                        <strong>Локация:</strong> ${point.location}
                    </div>
                `, { className: 'map-marker-tooltip' });
                
            // Добавляем эффект при клике
            marker.on('click', function() {
                // Анимация маркера
                const icon = marker.getElement();
                if (icon) {
                    icon.style.transform = 'scale(1.2)';
                    setTimeout(() => {
                        icon.style.transform = '';
                    }, 300);
                }
            });
            
            modalMarkers.push(marker);
        });
        
        // Обновляем легенду для отображения цвета ключевого слова
        updateMapLegend([{ keyword: keyword, color: '#3388ff' }]);
        
        // Устанавливаем границы карты, чтобы видеть все точки
        if (points.length > 0) {
            const bounds = L.latLngBounds(points.map(p => p.coords));
            modalMap.fitBounds(bounds, { padding: [50, 50] });
        }
        
    } catch (error) {
        console.error('Ошибка при отображении позиций на карте:', error);
    }
}

// Расчет статистики для ключевого слова
function calculateKeywordStats(position) {
    let visiblePositions = 0;
    
    position.points.forEach(point => {
        if (rankToNumber(point.rank) <= 20) {
            visiblePositions++;
        }
    });
    
    const visibility = position.points.length > 0 
        ? Math.round((visiblePositions / position.points.length) * 100) 
        : 0;
    
    return { visibility };
}

// Функция для поиска и фильтрации позиций в модальном окне
function filterModalPositionsTable(searchText) {
    if (!positionsGrid) return;
    
    const rows = document.querySelectorAll('#modalPositionsTable .gridjs-tbody tr');
    if (!rows || rows.length === 0) return;
    
    const searchLower = searchText.toLowerCase().trim();
    
    rows.forEach(row => {
        const keywordCell = row.querySelector('td:first-child');
        if (!keywordCell) return;
        
        const keywordText = keywordCell.textContent.toLowerCase();
        
        if (searchLower === '' || keywordText.includes(searchLower)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// Обновление легенды на карте
function updateMapLegend(keywordList) {
    const mapLegend = document.getElementById('mapLegend');
    if (!mapLegend) return;
    
    if (keywordList && keywordList.length > 0 && groupKeywordsEnabled) {
        // Легенда для ключевых слов
        let legendHTML = '<div class="fw-bold mb-2">Ключевые слова:</div>';
        
        keywordList.forEach(item => {
            legendHTML += `
                <div class="legend-item">
                    <span class="legend-color" style="background-color: ${item.color};"></span>
                    <small>${item.keyword.length > 20 ? item.keyword.substring(0, 20) + '...' : item.keyword}</small>
                </div>
            `;
        });
        
        mapLegend.innerHTML = legendHTML;
        mapLegend.style.display = 'block';
    } else {
        // Стандартная легенда для рангов
        mapLegend.innerHTML = `
            <div class="fw-bold mb-2">Позиции:</div>
            <div class="legend-item">
                <span class="legend-color" style="background-color: #28a745;"></span>
                <small>1</small>
            </div>
            <div class="legend-item">
                <span class="legend-color" style="background-color: #5cb85c;"></span>
                <small>2-3</small>
            </div>
            <div class="legend-item">
                <span class="legend-color" style="background-color: #ffc107;"></span>
                <small>4-10</small>
            </div>
            <div class="legend-item">
                <span class="legend-color" style="background-color: #fd7e14;"></span>
                <small>11-20</small>
            </div>
            <div class="legend-item">
                <span class="legend-color" style="background-color: #dc3545;"></span>
                <small>>20</small>
            </div>
        `;
        mapLegend.style.display = 'block';
    }
}

// Экспорт данных в CSV
function exportToCSV() {
    if (!selectedCompetitor) {
        alert('Нет данных для экспорта');
        return;
    }
    
    try {
        // Формируем заголовки
        let csvContent = 'Ключевое слово,Средний рейтинг,Количество позиций,Лучшая позиция,Локация лучшей позиции\n';
        
        // Формируем данные
        selectedCompetitor.positions.forEach(position => {
            const keyword = position.keyword || position.key;
            const stats = calculateKeywordStats(position);
            
            const avgRank = stats.avgRank.toFixed(1);
            const count = stats.count;
            const bestRank = stats.bestRank;
            const bestLocation = stats.bestLocation.replace(/,/g, ' '); // Убираем запятые для корректного CSV
            
            csvContent += `"${keyword}",${avgRank},${count},${bestRank},"${bestLocation}"\n`;
        });
        
        // Создаем ссылку для скачивания
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        // Создаем элемент для скачивания
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${selectedCompetitor.name}_позиции_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.display = 'none';
        
        // Добавляем на страницу и эмулируем клик
        document.body.appendChild(link);
        link.click();
        
        // Очищаем
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
        
    } catch (error) {
        console.error('Ошибка при экспорте данных в CSV:', error);
        alert('Произошла ошибка при экспорте данных');
    }
} 

// Вспомогательная функция для извлечения числа из HTML-строки ранга
function extractRankNumberFromHTML(cell) {
    // Убираем все теги, оставляем только текст
    const text = cell.replace(/<[^>]*>/g, '').trim();
    const match = text.match(/(\d+)(\+)?/);
    let rank = 100;
    if (match) {
        rank = parseInt(match[1]);
        if (match[2] === '+') rank += 0.5;
    }
    return rank;
}