// Simple Setup Language Cycler - NO i18next interference

// Language configuration
const LANGUAGES = [
    { code: 'en', flag: '🇺🇸', name: 'EN' },
    { code: 'ko', flag: '🇰🇷', name: 'KO' },
    { code: 'vi', flag: '🇻🇳', name: 'VI' }
];

let currentLangIndex = 0;
let isChangingLanguage = false;

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

// Update button display
function updateButton(buttonId, langIndex) {
    const lang = LANGUAGES[langIndex];
    const newText = `${lang.flag} ${lang.name}`;

    // Get fresh reference to button each time
    const button = document.getElementById(buttonId);
    if (!button) return;

    // Nuclear option - completely replace the button content
    button.innerHTML = newText;
    button.textContent = newText;
    button.setAttribute('data-lang', lang.code);
    button.removeAttribute('data-i18n');

    // Use multiple approaches to ensure the update sticks
    setTimeout(() => {
        const freshButton = document.getElementById(buttonId);
        if (freshButton) {
            freshButton.innerHTML = newText;
            freshButton.textContent = newText;
        }
    }, 10);

    setTimeout(() => {
        const freshButton = document.getElementById(buttonId);
        if (freshButton) {
            freshButton.innerHTML = newText;
            freshButton.textContent = newText;
        }
    }, 100);

    setTimeout(() => {
        const freshButton = document.getElementById(buttonId);
        if (freshButton) {
            freshButton.innerHTML = newText;
            freshButton.textContent = newText;
        }
    }, 500);
}

// Simple language change - NO i18next interference
function changeLanguage(langCode) {
    if (isChangingLanguage) return; // Prevent multiple simultaneous changes
    isChangingLanguage = true;

    // Set cookie
    setLanguageCookie(langCode);

    // Update document attribute
    document.documentElement.setAttribute('data-lang', langCode);

    // Only call i18next ONCE and don't let it interfere with our button
    if (window.i18next && window.i18next.changeLanguage) {
        try {
            window.i18next.changeLanguage(langCode).then(() => {
                // Reset flag after i18next is done
                setTimeout(() => {
                    isChangingLanguage = false;
                }, 100);
            }).catch(() => {
                isChangingLanguage = false;
            });
        } catch (error) {
            isChangingLanguage = false;
        }
    } else {
        isChangingLanguage = false;
    }
}

// Simple, bulletproof language cycler
function initSetupLanguageCycler() {
    const button = document.getElementById('setupLangCycler');
    if (!button) {
        return;
    }

    // Find current language index
    const currentLang = getCurrentLanguage();
    currentLangIndex = LANGUAGES.findIndex(lang => lang.code === currentLang);
    if (currentLangIndex === -1) currentLangIndex = 0;

    // Update button to show current language
    const lang = LANGUAGES[currentLangIndex];
    button.textContent = `${lang.flag} ${lang.name}`;

    // Simple click handler - no complex logic
    button.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        // Prevent multiple rapid clicks
        if (isChangingLanguage) return false;

        // Cycle to next language
        currentLangIndex = (currentLangIndex + 1) % LANGUAGES.length;
        const newLang = LANGUAGES[currentLangIndex];

        // Update button text immediately
        button.textContent = `${newLang.flag} ${newLang.name}`;

        // Change language
        changeLanguage(newLang.code);

        return false;
    });

    // Also handle mousedown as backup
    button.addEventListener('mousedown', function(e) {
        e.preventDefault();
        return false;
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSetupLanguageCycler);
} else {
    initSetupLanguageCycler();
}

// Also initialize after a delay as backup
setTimeout(initSetupLanguageCycler, 500);
setTimeout(initSetupLanguageCycler, 1000);

// Make it globally available
window.initSetupLanguageCycler = initSetupLanguageCycler;
