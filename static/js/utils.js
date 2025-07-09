// Cookie utilities
export function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/`;
}

export function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// Text width utility
export function getTextWidth(text, font) {
    const canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement('canvas'));
    const context = canvas.getContext('2d');
    context.font = font || '16px Arial';
    return context.measureText(text).width;
}

// Theme management
export let isDarkMode = false;

export function initializeTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const savedTheme = document.documentElement.getAttribute('data-theme');
    themeToggle.selected = savedTheme === 'dark';
    isDarkMode = savedTheme === 'dark';

    themeToggle.addEventListener('change', () => {
        isDarkMode = themeToggle.selected;
        document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
        setCookie('preferred_theme', isDarkMode ? 'dark' : 'light', 365);
    });
}

// Language management with i18next
let currentLang = 'en';

export function getCurrentLanguage() {
    return currentLang;
}

// Helper function to get translation using i18next
export function t(key, options = {}) {
    if (window.i18next && window.i18next.isInitialized) {
        return window.i18next.t(key, options);
    }

    // Get current language for fallback
    const currentLang = getCurrentLanguage();

    // Language-specific fallback translations
    const fallbackTranslations = {
        ko: {
            'ui.noData': '데이터가 없습니다.',
            'ui.scrollMore': '스크롤하여 더 많은 데이터 불러오기!',
            'ui.allDataLoaded': '모든 데이터가 로드되었습니다.',
            'ui.rows': '행',
            'ui.hide': '숨기기',
            'ui.show': '보이기',
            'ui.timeUnit': '초',
            'connection.connecting': '연결 중...',
            'connection.connected': '연결됨',
            'connection.disconnected': '연결 끊김',
            'connection.noDatabase': '데이터베이스 없음',
            'connection.attemptPrefix': '재시도 중 (',
            'connection.attemptSuffix': '번째)',
            'admin.adminMode': '관리자 모드',
            'admin.adminTooltip': '외래 키 검사 무시 - 주의해서 사용하세요',
            'admin.customQuery': 'SQL 쿼리 작성',
            'admin.afterSelectingCell': '셀을 선택한 후:',
            'admin.addNewRow': '새 빈 행 추가',
            'admin.deleteRow': '선택한 행 삭제',
            'admin.deleteAllMatching': '동일한 값이 있는 모든 행 삭제',
            'admin.editValue': '값 수정',
            'admin.oneMoreClick': '한 번 더 클릭',
            'schema.schema': '스키마',
            'schema.tooltip': '데이터베이스의 최신 스키마를 확인합니다',
            'database.smartOrder': '스마트정렬',
            'monitoring.pausedCopying': '텍스트를 복사하고 있어서 모니터링이 일시 중지되었습니다',
            'monitoring.refreshRate': '갱신 주기',
            'query.customQuery': '사용자 정의 쿼리',
            'query.execute': '실행',
            'favicon.useCustomFavicon': '사용자 지정 파비콘 사용',
            'favicon.uploadFavicon': '파비콘 업로드',
            'logo.useCustomLogo': '사용자 지정 로고 사용',
            'logo.uploadLogo': '로고 업로드',
            'database.databaseType': '데이터베이스 유형',
            'database.host': '호스트',
            'database.user': '사용자',
            'database.password': '비밀번호',
            'database.database': '데이터베이스',
            'database.add': '추가',
            'database.connect': '연결하기',
            'database.addNewDatabase': '새 데이터베이스 추가',
            'database.goBack': '뒤로 가기',
            'database.smartOrder': '스마트정렬',
            'schema.layoutSpacing': '레이아웃 간격',
            'schema.tight': '밀집',
            'schema.spread': '분산',
            'schema.arrowStyle': '화살표 스타일',
            'schema.elbow': '꺾인선',
            'schema.straight': '직선',
            'schema.curved': '곡선',
            'schema.resetLayout': '레이아웃 재설정',
            'schema.optimizeLayout': '레이아웃 최적화',
            'schema.pause': '일시정지',
            'schema.resume': '재개',
            'schema.optimizing': '최적화 중...',
            'image.displaySettings': '이미지 표시 설정',
            'image.showImagesInTable': '경로 대신 테이블에 이미지 표시',
            'image.pathPrefixes': '이미지 경로 접두사',
            'image.add': '추가',
            'image.apply': '적용',
            'image.cancel': '취소',
            'image.imagePath': '이미지 경로',
            'image.download': '다운로드',
            'languages.korean': '한국어',
            'languages.english': 'English',
            'languages.vietnamese': 'Tiếng Việt'
        },
        en: {
            'ui.noData': 'No data available.',
            'ui.scrollMore': 'Scroll to load more data!',
            'ui.allDataLoaded': 'All data loaded.',
            'ui.rows': 'rows',
            'ui.hide': 'Hide',
            'ui.show': 'Show',
            'ui.timeUnit': 's',
            'connection.connecting': 'Connecting...',
            'connection.connected': 'Connected',
            'connection.disconnected': 'Disconnected',
            'connection.noDatabase': 'No Database',
            'connection.attemptPrefix': 'Attempt (',
            'connection.attemptSuffix': ')',
            'admin.adminMode': 'ADMIN MODE',
            'admin.adminTooltip': 'Ignoring foreign key checks - Use with caution',
            'admin.customQuery': 'Custom SQL query',
            'admin.afterSelectingCell': 'After selecting a cell:',
            'admin.addNewRow': 'Add new empty row',
            'admin.deleteRow': 'Delete selected row',
            'admin.deleteAllMatching': 'Delete all rows matching value',
            'admin.editValue': 'Edit value',
            'admin.oneMoreClick': 'One more click',
            'schema.schema': 'SCHEMA',
            'schema.tooltip': 'See the latest SCHEMA from the database',
            'database.smartOrder': 'Smart Order',
            'monitoring.pausedCopying': 'Monitoring is paused since you are copying texts',
            'monitoring.refreshRate': 'Refresh rate',
            'query.customQuery': 'Custom Query',
            'query.execute': 'Execute',
            'favicon.useCustomFavicon': 'Use Custom Favicon',
            'favicon.uploadFavicon': 'Upload Favicon',
            'logo.useCustomLogo': 'Use Custom Logo',
            'logo.uploadLogo': 'Upload Logo',
            'database.databaseType': 'Database Type',
            'database.host': 'Host',
            'database.user': 'User',
            'database.password': 'Password',
            'database.database': 'Database',
            'database.add': 'Add',
            'database.connect': 'Connect',
            'database.addNewDatabase': 'Add New Database',
            'database.goBack': 'Go Back',
            'database.smartOrder': 'Smart Order',
            'schema.layoutSpacing': 'Layout Spacing',
            'schema.tight': 'Tight',
            'schema.spread': 'Spread',
            'schema.arrowStyle': 'Arrow Style',
            'schema.elbow': 'Elbow',
            'schema.straight': 'Straight',
            'schema.curved': 'Curved',
            'schema.resetLayout': 'Reset Layout',
            'schema.optimizeLayout': 'Optimize Layout',
            'schema.pause': 'Pause',
            'schema.resume': 'Resume',
            'schema.optimizing': 'Optimizing...',
            'image.displaySettings': 'Image Display Settings',
            'image.showImagesInTable': 'Show images in table instead of paths',
            'image.pathPrefixes': 'Image Path Prefixes',
            'image.add': 'Add',
            'image.apply': 'Apply',
            'image.cancel': 'Cancel',
            'image.imagePath': 'Image Path',
            'image.download': 'Download',
            'languages.korean': '한국어',
            'languages.english': 'English',
            'languages.vietnamese': 'Tiếng Việt',
            'ui.warningPerformance': 'Setting refresh rate under 2s may affect system performance.',
            'ui.rowDeleted': 'Row has been deleted.',
            'ui.databaseSetup': 'Database Setup'
        },
        vi: {
            'ui.noData': 'Không có dữ liệu.',
            'ui.scrollMore': 'Cuộn để tải thêm dữ liệu!',
            'ui.allDataLoaded': 'Đã tải tất cả dữ liệu.',
            'ui.rows': 'hàng',
            'ui.hide': 'Ẩn',
            'ui.show': 'Hiện',
            'ui.timeUnit': 'giây',
            'connection.connecting': 'Đang kết nối...',
            'connection.connected': 'Đã kết nối',
            'connection.disconnected': 'Mất kết nối',
            'connection.noDatabase': 'Không có cơ sở dữ liệu',
            'connection.attemptPrefix': 'Thử lần (',
            'connection.attemptSuffix': ')',
            'admin.adminMode': 'CHẾ ĐỘ QUẢN TRỊ',
            'admin.adminTooltip': 'Bỏ qua kiểm tra khóa ngoại - Sử dụng cẩn thận',
            'admin.customQuery': 'Truy vấn SQL tùy chỉnh',
            'admin.afterSelectingCell': 'Sau khi chọn ô:',
            'admin.addNewRow': 'Thêm hàng trống mới',
            'admin.deleteRow': 'Xóa hàng đã chọn',
            'admin.deleteAllMatching': 'Xóa tất cả hàng có giá trị giống nhau',
            'admin.editValue': 'Chỉnh sửa giá trị',
            'admin.oneMoreClick': 'Nhấp thêm một lần',
            'schema.schema': 'LƯỢC ĐỒ',
            'schema.tooltip': 'Xem lược đồ mới nhất từ cơ sở dữ liệu',
            'database.smartOrder': 'Sắp xếp thông minh',
            'monitoring.pausedCopying': 'Giám sát tạm dừng vì bạn đang sao chép văn bản',
            'monitoring.refreshRate': 'Tần suất làm mới',
            'query.customQuery': 'Truy vấn tùy chỉnh',
            'query.execute': 'Thực thi',
            'favicon.useCustomFavicon': 'Sử dụng Favicon tùy chỉnh',
            'favicon.uploadFavicon': 'Tải lên Favicon',
            'logo.useCustomLogo': 'Sử dụng Logo tùy chỉnh',
            'logo.uploadLogo': 'Tải lên Logo',
            'database.databaseType': 'Loại cơ sở dữ liệu',
            'database.host': 'Máy chủ',
            'database.user': 'Người dùng',
            'database.password': 'Mật khẩu',
            'database.database': 'Cơ sở dữ liệu',
            'database.add': 'Thêm',
            'database.connect': 'Kết nối',
            'database.addNewDatabase': 'Thêm cơ sở dữ liệu mới',
            'database.goBack': 'Quay lại',
            'database.smartOrder': 'Sắp xếp thông minh',
            'schema.layoutSpacing': 'Khoảng cách bố cục',
            'schema.tight': 'Chặt',
            'schema.spread': 'Rộng',
            'schema.arrowStyle': 'Kiểu mũi tên',
            'schema.elbow': 'Gấp khúc',
            'schema.straight': 'Thẳng',
            'schema.curved': 'Cong',
            'schema.resetLayout': 'Đặt lại bố cục',
            'schema.optimizeLayout': 'Tối ưu bố cục',
            'schema.pause': 'Tạm dừng',
            'schema.resume': 'Tiếp tục',
            'schema.optimizing': 'Đang tối ưu...',
            'image.displaySettings': 'Cài đặt hiển thị hình ảnh',
            'image.showImagesInTable': 'Hiển thị hình ảnh trong bảng thay vì đường dẫn',
            'image.pathPrefixes': 'Tiền tố đường dẫn hình ảnh',
            'image.add': 'Thêm',
            'image.apply': 'Áp dụng',
            'image.cancel': 'Hủy',
            'image.imagePath': 'Đường dẫn hình ảnh',
            'image.download': 'Tải xuống',
            'languages.korean': '한국어',
            'languages.english': 'English',
            'languages.vietnamese': 'Tiếng Việt',
            'ui.warningPerformance': 'Đặt tần suất làm mới dưới 2 giây có thể ảnh hưởng đến hiệu suất hệ thống.',
            'ui.rowDeleted': 'Hàng đã được xóa.',
            'ui.databaseSetup': 'Thiết lập cơ sở dữ liệu',
            'ui.warningPerformance': '갱신 주기가 2초 미만일 경우 시스템 성능에 영향을 줄 수 있습니다.',
            'ui.rowDeleted': '행이 삭제되었습니다.',
            'ui.databaseSetup': '데이터베이스 설정'
        }
    };

    return fallbackTranslations[currentLang]?.[key] || fallbackTranslations['en']?.[key] || key;
}

export function updateLanguage(updateStaticLanguageElements, updateDynamicElements, updateDropdownOptions, updateConnectionStatus) {
    if (window.languageUpdateTimeout) {
        clearTimeout(window.languageUpdateTimeout);
    }

    // Update i18next translations
    if (window.updateTranslations) {
        window.updateTranslations();
    }

    updateStaticLanguageElements();
    updateConnectionStatus();

    requestAnimationFrame(() => {
        updateDynamicElements();
    });

    // The dropdown options will be handled by CSS based on data-lang attribute
    // No need to set inline styles

    if (updateDropdownOptions) {
        updateDropdownOptions();
    }
}

export function initializeSettings() {
    // Initialize settings from localStorage or set defaults
    let settings = JSON.parse(localStorage.getItem('settings') || '{}');
    
    // Set default settings if not present
    if (!settings.hasOwnProperty('useLogo')) {
        settings.useLogo = false;
    }
    if (!settings.hasOwnProperty('useFavicon')) {
        settings.useFavicon = false;
    }
    
    // Save settings
    localStorage.setItem('settings', JSON.stringify(settings));
    
    // Apply initial settings
    const logo = settings.useLogo ? localStorage.getItem('logoImage') : null;
    const favicon = settings.useFavicon ? localStorage.getItem('faviconImage') : null;
    
    if (logo && settings.useLogo) {
        updateLogo();
    }
    if (favicon && settings.useFavicon) {
        updateFavicon();
    }
}

export function initializeLanguage(updateLanguage, updateStaticLanguageElements, updateDynamicElements, updateDropdownOptions, updateConnectionStatus) {
    // Get saved language or default to English
    const savedLang = getCookie('preferred_language') || 'en';
    currentLang = savedLang;

    // Set initial language attribute
    document.documentElement.setAttribute('data-lang', currentLang);

    // Wait for i18next to be ready, then update language
    if (window.i18nextPromise && typeof window.i18nextPromise.then === 'function') {
        window.i18nextPromise.then(() => {
            if (window.changeLanguage) {
                window.changeLanguage(currentLang);
            }
            updateLanguage(updateStaticLanguageElements, updateDynamicElements, updateDropdownOptions, updateConnectionStatus);
        }).catch(() => {
            // Fallback if i18next fails
            updateLanguage(updateStaticLanguageElements, updateDynamicElements, updateDropdownOptions, updateConnectionStatus);
        });
    } else {
        // Fallback if i18next is not available
        setTimeout(() => {
            updateLanguage(updateStaticLanguageElements, updateDynamicElements, updateDropdownOptions, updateConnectionStatus);
        }, 100);
    }

    // Listen for language changes from dropdown
    window.addEventListener('languageChanged', (e) => {
        currentLang = e.detail.language;

        // Update data-i18n elements
        if (window.updateDataI18nElements) {
            window.updateDataI18nElements(currentLang);
        }

        updateLanguage(updateStaticLanguageElements, updateDynamicElements, updateDropdownOptions, updateConnectionStatus);
    });

    // Legacy support for old toggle system (if still present)
    const languageToggle = document.getElementById('languageToggle');
    if (languageToggle) {
        const languageLabels = document.querySelectorAll('.switch-label');
        languageToggle.selected = currentLang === 'en';

        languageToggle.addEventListener('change', () => {
            const newLang = languageToggle.checked ? 'en' : 'ko';
            if (newLang !== currentLang) {
                languageLabels.forEach(label => {
                    label.classList.toggle('language-active', label.dataset.lang === newLang);
                    label.classList.toggle('language-inactive', label.dataset.lang !== newLang);
                });

                currentLang = newLang;
                document.documentElement.setAttribute('data-lang', currentLang);
                setCookie('preferred_language', currentLang, 365);

                if (window.changeLanguage) {
                    window.changeLanguage(currentLang);
                }
                updateLanguage(updateStaticLanguageElements, updateDynamicElements, updateDropdownOptions, updateConnectionStatus);
            }
        });

        languageLabels.forEach(label => {
            label.classList.toggle('language-active', label.dataset.lang === currentLang);
            label.classList.toggle('language-inactive', label.dataset.lang !== currentLang);
        });
    }
}

export function updateStaticLanguageElements() {
    // Simply ensure the data-lang attribute is set correctly
    // CSS will handle the visibility based on this attribute
    document.documentElement.setAttribute('data-lang', currentLang);
}

// Connection management
export let connectionAttempts = 0;

export async function checkConnection(baseUrl, updateConnectionStatus) {
    try {
        const status = document.getElementById('connection-status');
        if (!status.classList.contains('connected') &&
            !status.classList.contains('disconnected') &&
            !status.classList.contains('no-database')) {
            status.classList.add('connecting');
        }

        const response = await fetch(`${baseUrl}/connection`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            },
            credentials: 'include'
        });

        const data = await response.json();
        if (data.status === 'connected') {
            connectionAttempts = 0;
            status.classList.remove('connecting', 'disconnected', 'no-database');
            status.classList.add('connected');
            updateConnectionStatus();
            return true;
        } else if (data.status === 'no_database') {
            status.classList.remove('connecting', 'connected', 'disconnected');
            status.classList.add('no-database');
            updateConnectionStatus();
            return 'no_database';
        } else {
            throw new Error('Connection failed');
        }
        throw new Error('Connection failed');
    } catch (error) {
        connectionAttempts++;
        const status = document.getElementById('connection-status');
        status.classList.remove('connecting', 'connected', 'no-database');
        status.classList.add('disconnected');
        updateConnectionStatus();
        return false;
    }
}
