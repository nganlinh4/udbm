// Ultra-Simple Language Switcher - NO i18next dependency

// Language configuration with manual translations
const LANG_CONFIG = {
    en: {
        flag: '🇺🇸',
        name: 'EN',
        translations: {
            'database-setup-title': 'Database Setup',
            'database-setup-desc': 'Add a database to start monitoring',
            'database-type': 'Database Type',
            'host': 'Host',
            'user': 'User',
            'password': 'Password',
            'database': 'Database',
            'connect': 'Connect'
        }
    },
    ko: {
        flag: '🇰🇷',
        name: 'KO',
        translations: {
            'database-setup-title': '데이터베이스 설정',
            'database-setup-desc': '모니터링을 시작하려면 데이터베이스를 추가하세요',
            'database-type': '데이터베이스 유형',
            'host': '호스트',
            'user': '사용자',
            'password': '비밀번호',
            'database': '데이터베이스',
            'connect': '연결'
        }
    },
    vi: {
        flag: '🇻🇳',
        name: 'VI',
        translations: {
            'database-setup-title': 'Thiết lập cơ sở dữ liệu',
            'database-setup-desc': 'Thêm cơ sở dữ liệu để bắt đầu giám sát',
            'database-type': 'Loại cơ sở dữ liệu',
            'host': 'Máy chủ',
            'user': 'Người dùng',
            'password': 'Mật khẩu',
            'database': 'Cơ sở dữ liệu',
            'connect': 'Kết nối'
        }
    }
};

const LANG_ORDER = ['en', 'ko', 'vi'];
let currentLangIndex = 0;

// Get current language from cookie
function getCurrentLanguage() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'preferred_language') {
            return value;
        }
    }
    return 'en';
}

// Set language cookie
function setLanguageCookie(lang) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (365 * 24 * 60 * 60 * 1000));
    document.cookie = `preferred_language=${lang};expires=${expires.toUTCString()};path=/`;
}

// Aggressive translation function that actually works
function translatePage(langCode) {
    // First, try to use i18next if available
    if (window.i18next && window.i18next.changeLanguage) {
        try {
            window.i18next.changeLanguage(langCode);
        } catch (error) {
            console.warn('i18next failed, using manual translation');
        }
    }

    // Also do manual translation as backup
    // Hide all language spans
    const allLangSpans = document.querySelectorAll('.lang-en, .lang-ko, .lang-vi');
    allLangSpans.forEach(span => {
        span.style.display = 'none';
    });

    // Show only the selected language spans
    const targetSpans = document.querySelectorAll(`.lang-${langCode}`);
    targetSpans.forEach(span => {
        span.style.display = 'inline';
    });

    // Force update document language attribute
    document.documentElement.setAttribute('lang', langCode);
    document.documentElement.setAttribute('data-lang', langCode);

    // Dispatch language change event for other systems
    window.dispatchEvent(new CustomEvent('languageChanged', {
        detail: { language: langCode }
    }));

    // Force a reflow to ensure changes are applied
    document.body.offsetHeight;
}

// Initialize simple language switcher
function initSimpleLangSwitcher() {
    const button = document.getElementById('setupLangCycler');
    if (!button) {
        return;
    }
    
    // Find current language index
    const currentLang = getCurrentLanguage();
    currentLangIndex = LANG_ORDER.indexOf(currentLang);
    if (currentLangIndex === -1) currentLangIndex = 0;
    
    // Update button to show current language
    const config = LANG_CONFIG[LANG_ORDER[currentLangIndex]];
    button.textContent = `${config.flag} ${config.name}`;
    
    // Translate page to current language
    translatePage(LANG_ORDER[currentLangIndex]);
    
    // Use mousedown since click events are being blocked
    button.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();

        // Cycle to next language
        currentLangIndex = (currentLangIndex + 1) % LANG_ORDER.length;
        const newLangCode = LANG_ORDER[currentLangIndex];
        const newConfig = LANG_CONFIG[newLangCode];

        // Update button immediately
        button.textContent = `${newConfig.flag} ${newConfig.name}`;

        // Set cookie
        setLanguageCookie(newLangCode);

        // Translate page
        translatePage(newLangCode);

        return false;
    });
    

}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSimpleLangSwitcher);
} else {
    initSimpleLangSwitcher();
}

// Also initialize after a delay as backup
setTimeout(initSimpleLangSwitcher, 500);
