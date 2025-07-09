// Main Interface Language Switcher - Beautiful Pill Design

// Language configuration
const MAIN_LANG_CONFIG = {
    en: { flag: '🇺🇸', name: 'EN' },
    ko: { flag: '🇰🇷', name: 'KO' },
    vi: { flag: '🇻🇳', name: 'VI' }
};

const MAIN_LANG_ORDER = ['en', 'ko', 'vi'];
let mainCurrentLangIndex = 0;

// Get current language from cookie
function getMainCurrentLanguage() {
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
function setMainLanguageCookie(lang) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (365 * 24 * 60 * 60 * 1000));
    document.cookie = `preferred_language=${lang};expires=${expires.toUTCString()};path=/`;
}

// Change language using existing systems
function changeMainLanguage(langCode) {
    // Set cookie
    setMainLanguageCookie(langCode);
    
    // Update document attribute
    document.documentElement.setAttribute('lang', langCode);
    document.documentElement.setAttribute('data-lang', langCode);
    
    // Use existing i18next system
    if (window.i18next && window.i18next.changeLanguage) {
        try {
            window.i18next.changeLanguage(langCode);
        } catch (error) {
            console.warn('i18next error:', error);
        }
    }
    
    // Use existing global changeLanguage function
    if (window.changeLanguage && typeof window.changeLanguage === 'function') {
        try {
            window.changeLanguage(langCode);
        } catch (error) {
            console.warn('Global changeLanguage error:', error);
        }
    }
    
    // Dispatch language change event
    window.dispatchEvent(new CustomEvent('languageChanged', { 
        detail: { language: langCode } 
    }));
}

// Initialize main language switcher
function initMainLangSwitcher() {
    const button = document.getElementById('mainLangCycler');
    if (!button) {
        return;
    }
    
    // Find current language index
    const currentLang = getMainCurrentLanguage();
    mainCurrentLangIndex = MAIN_LANG_ORDER.indexOf(currentLang);
    if (mainCurrentLangIndex === -1) mainCurrentLangIndex = 0;
    
    // Update button to show current language
    const config = MAIN_LANG_CONFIG[MAIN_LANG_ORDER[mainCurrentLangIndex]];
    button.textContent = `${config.flag} ${config.name}`;
    
    // Click handler for main interface
    button.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        // Cycle to next language
        mainCurrentLangIndex = (mainCurrentLangIndex + 1) % MAIN_LANG_ORDER.length;
        const newLangCode = MAIN_LANG_ORDER[mainCurrentLangIndex];
        const newConfig = MAIN_LANG_CONFIG[newLangCode];

        // Update button immediately
        button.textContent = `${newConfig.flag} ${newConfig.name}`;

        // Change language
        changeMainLanguage(newLangCode);

        return false;
    });
    
    // Listen for language changes from other components
    window.addEventListener('languageChanged', function(e) {
        const langCode = e.detail.language;
        const langIndex = MAIN_LANG_ORDER.indexOf(langCode);
        if (langIndex !== -1) {
            mainCurrentLangIndex = langIndex;
            const config = MAIN_LANG_CONFIG[langCode];
            button.textContent = `${config.flag} ${config.name}`;
        }
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMainLangSwitcher);
} else {
    initMainLangSwitcher();
}

// Also initialize after a delay as backup
setTimeout(initMainLangSwitcher, 500);
