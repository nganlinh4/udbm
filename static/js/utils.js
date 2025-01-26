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
    themeToggle.checked = savedTheme === 'dark';
    isDarkMode = savedTheme === 'dark';

    themeToggle.addEventListener('change', () => {
        isDarkMode = themeToggle.checked;
        document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
        setCookie('preferred_theme', isDarkMode ? 'dark' : 'light', 365);
    });
}

// Language management
export const translations = {
    ko: {
        connecting: "연결 중...",
        connected: "연결됨",
        disconnected: "연결 끊김,",
        noDatabase: "데이터베이스 없음",
        attemptPrefix: "재시도 중 (",
        attemptSuffix: "번째)",
        hide: "숨기기",
        show: "보이기",
        noData: "데이터가 없습니다.",
        scrollMore: "스크롤하여 더 많은 데이터 불러오기!",
        allDataLoaded: "모든 데이터가 로드되었습니다.",
        rows: "행",
        timeUnit: '초',
    },
    en: {
        connecting: "Connecting...",
        connected: "Connected",
        disconnected: "Disconnected,",
        noDatabase: "No Database",
        attemptPrefix: "Attempt (",
        attemptSuffix: ")",
        hide: "Hide",
        show: "Show",
        noData: "No data available.",
        scrollMore: "Scroll to load more data!",
        allDataLoaded: "All data loaded.",
        rows: "rows",
        timeUnit: 's',
    }
};

let currentLang = 'ko';

export function getCurrentLanguage() {
    return currentLang;
}

export function updateLanguage(updateStaticLanguageElements, updateDynamicElements, updateDropdownOptions, updateConnectionStatus) {
    if (window.languageUpdateTimeout) {
        clearTimeout(window.languageUpdateTimeout);
    }

    updateStaticLanguageElements();
    updateConnectionStatus();

    requestAnimationFrame(() => {
        updateDynamicElements();
    });

    const dropdown = document.getElementById('monitorDropdown');
    dropdown.querySelectorAll('option').forEach(option => {
        option.querySelectorAll('.lang-ko, .lang-en').forEach(el => {
            el.style.cssText = 'display: none !important';
        });
        option.querySelectorAll(`.lang-${currentLang}`).forEach(el => {
            el.style.cssText = 'display: inline !important';
        });
    });

    updateDropdownOptions();
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
    currentLang = 'en';  // Changed from 'ko' to 'en'
    updateLanguage(updateStaticLanguageElements, updateDynamicElements, updateDropdownOptions, updateConnectionStatus);

    const languageToggle = document.getElementById('languageToggle');
    const languageLabels = document.querySelectorAll('.switch-label');

    languageToggle.checked = currentLang === 'en';  // Will be true by default now

    languageToggle.addEventListener('change', () => {
        const newLang = languageToggle.checked ? 'en' : 'ko';
        if (newLang !== currentLang) {
            languageLabels.forEach(label => {
                label.classList.toggle('language-active', label.dataset.lang === newLang);
                label.classList.toggle('language-inactive', label.dataset.lang !== newLang);
            });

            currentLang = newLang;
            document.documentElement.setAttribute('data-lang', currentLang); // Add this line
            setCookie('preferred_language', currentLang, 365);
            updateLanguage(updateStaticLanguageElements, updateDynamicElements, updateDropdownOptions, updateConnectionStatus);
        }
    });

    const savedLang = getCookie('preferred_language');
    if (savedLang) {
        currentLang = savedLang;
        document.documentElement.setAttribute('data-lang', currentLang); // Add this line
        languageToggle.checked = currentLang === 'en';
        languageLabels.forEach(label => {
            label.classList.toggle('language-active', label.dataset.lang === currentLang);
            label.classList.toggle('language-inactive', label.dataset.lang !== currentLang);
        });
        updateLanguage(updateStaticLanguageElements, updateDynamicElements, updateDropdownOptions, updateConnectionStatus);
    }
}

export function updateStaticLanguageElements() {
    requestAnimationFrame(() => {
        document.querySelectorAll('.lang-ko, .lang-en').forEach(el => {
            el.style.cssText = 'display: none !important';
        });
        document.querySelectorAll(`.lang-${currentLang}`).forEach(el => {
            el.style.cssText = 'display: inline !important';
        });
    });
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
