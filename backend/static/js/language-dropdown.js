// Language Dropdown Management
export class LanguageDropdown {
    constructor(dropdownId, buttonId, menuId) {
        this.dropdown = document.getElementById(dropdownId);
        this.button = document.getElementById(buttonId);
        this.menu = document.getElementById(menuId);
        this.currentLanguage = 'en';
        
        this.init();
    }
    
    init() {
        if (!this.dropdown || !this.button || !this.menu) {
            return;
        }

        // Set initial language from cookie or default
        const savedLang = this.getCookie('preferred_language') || 'en';
        this.setLanguage(savedLang, false);

        // Button click handler
        this.button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });
        
        // Menu item click handlers
        this.menu.addEventListener('click', (e) => {
            const item = e.target.closest('.language-dropdown-item');
            if (item) {
                const lang = item.getAttribute('data-lang');
                this.setLanguage(lang, true);
                this.close();
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.dropdown.contains(e.target)) {
                this.close();
            }
        });
        
        // Close dropdown on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        });
        
        // Listen for language changes from other components
        window.addEventListener('languageChanged', (e) => {
            this.setLanguage(e.detail.language, false);
            // Also update the button text when language changes
            this.updateButtonText(e.detail.language);
        });
    }
    
    toggle() {
        console.log('Toggle called, current state:', this.dropdown.classList.contains('open'));
        if (this.dropdown.classList.contains('open')) {
            this.close();
        } else {
            this.open();
        }
    }
    
    open() {
        this.dropdown.classList.add('open');
        // Focus first item for keyboard navigation
        const firstItem = this.menu.querySelector('.language-dropdown-item');
        if (firstItem) {
            firstItem.focus();
        }
    }
    
    close() {
        this.dropdown.classList.remove('open');
    }

    updateButtonText(lang) {
        const currentLangSpan = this.button.querySelector('.current-language');
        if (currentLangSpan && window.t) {
            const langKeys = {
                'ko': 'languages.korean',
                'en': 'languages.english',
                'vi': 'languages.vietnamese'
            };
            currentLangSpan.textContent = window.t(langKeys[lang] || 'languages.english');
        }
    }
    
    setLanguage(lang, triggerChange = true) {
        this.currentLanguage = lang;
        
        // Update active state in menu
        this.menu.querySelectorAll('.language-dropdown-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-lang') === lang);
        });
        
        // Update button text using data-i18n system
        const currentLangSpan = this.button.querySelector('.current-language');
        if (currentLangSpan) {
            // Update the data-i18n attribute based on selected language
            const langKeys = {
                'ko': 'languages.korean',
                'en': 'languages.english',
                'vi': 'languages.vietnamese'
            };
            currentLangSpan.setAttribute('data-i18n', langKeys[lang] || 'languages.english');

            // Update the text using the translation system
            if (window.t) {
                currentLangSpan.textContent = window.t(langKeys[lang] || 'languages.english');
            }
        }
        
        if (triggerChange) {
            if (window.changeLanguage) {
                window.changeLanguage(lang);
            } else if (window.i18next && window.i18next.changeLanguage) {
                window.i18next.changeLanguage(lang);
            }
        }
    }
    
    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }
}

// Initialize language dropdowns when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Main language dropdown
    const mainDropdown = new LanguageDropdown(
        'languageDropdown',
        'languageDropdownButton', 
        'languageDropdownMenu'
    );
    
    // Initial setup language dropdown (only if elements exist)
    let initialDropdown = null;
    if (document.getElementById('initialLanguageDropdown')) {
        initialDropdown = new LanguageDropdown(
            'initialLanguageDropdown',
            'initialLanguageDropdownButton',
            'initialLanguageDropdownMenu'
        );
    }
    
    // Store references globally for other scripts
    window.languageDropdowns = {
        main: mainDropdown,
        initial: initialDropdown
    };
});

// Legacy support for existing toggle-based code
export function initializeLanguageDropdown() {
    // This function maintains compatibility with existing code
    // that might call initializeLanguage
}

// Export for use in other modules
export { LanguageDropdown as default };
