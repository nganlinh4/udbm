import {
    setCookie,
    getCookie,
    initializeTheme,
    getCurrentLanguage,
    initializeLanguage,
    updateLanguage,
    updateStaticLanguageElements,
    checkConnection,
    connectionAttempts,
    t
} from './utils.js';
import './main-lang-switcher.js';
import './simple-lang-switcher.js';
import { 
    updateSingleTable, 
    fetchTableData, 
    fetchTableCount, 
    adjustColumnWidths,
    addDownloadButtons 
} from './table.js';

// Constants
const baseUrl = window.location.origin;

// Make baseUrl available globally for other modules
window.baseUrl = baseUrl;

// Export it for use in other modules
export { baseUrl };

// Global variables
let previousData = {};
let tableNames = [];
let tableOffsets = {};

// Add new global variables for monitor interval
let monitorInterval = 5000; // Default monitor interval of 5 seconds
let monitorIntervalId = null; // Store interval ID

// Declare tableChunks and isLoading
let tableChunks = {};

function showError(message) {
    document.getElementById('error-message').innerText = message;
    document.getElementById('error-message').style.display = 'block';
}

function hideError() {
    document.getElementById('error-message').style.display = 'none';
}

function updateTablesIfChanged(newData) {
    Object.keys(newData).forEach(tableName => {
        if (!previousData[tableName] || JSON.stringify(newData[tableName].data) !== JSON.stringify(previousData[tableName].data)) {
            updateSingleTable(tableName, newData[tableName], null, getCurrentLanguage(), fetchTableData);
        }
    });
    previousData = JSON.parse(JSON.stringify(newData));
}

// Function to measure the max width needed for both languages
function measureConnectionStatusWidth(status, statusText) {
    // Create a temporary div to measure text width
    const measureDiv = document.createElement('div');
    measureDiv.style.cssText = `
        position: absolute;
        visibility: hidden;
        height: auto;
        width: auto;
        white-space: nowrap;
        font-size: 0.85rem;
        padding: 6px 12px;
        display: inline-flex;
        align-items: center;
        font-family: Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    `;
    document.body.appendChild(measureDiv);

    // Add text content
    const textSpan = document.createElement('span');
    textSpan.textContent = statusText;
    measureDiv.appendChild(textSpan);

    const width = measureDiv.offsetWidth;
    document.body.removeChild(measureDiv);
    return width;
}

function updateConnectionStatus(forceLang) {
    const status = document.getElementById('connection-status');
    const isNoDatabase = status.classList.contains('no-database');
    const isConnected = status.classList.contains('connected');
    const isDisconnected = status.classList.contains('disconnected');

    // Keep existing classes to maintain state
    status.className = 'connection-status';
    if (isNoDatabase) status.classList.add('no-database');
    if (isConnected) status.classList.add('connected');
    if (isDisconnected) status.classList.add('disconnected');

    // Get text for current language using i18next
    const currentLang = forceLang || getCurrentLanguage();
    let statusText;

    if (isNoDatabase) {
        statusText = t('connection.noDatabase');
    } else if (isConnected) {
        statusText = t('connection.connected');
    } else {
        statusText = `${t('connection.disconnected')} ${t('connection.attemptPrefix')}${connectionAttempts}${t('connection.attemptSuffix')}`;
    }

    // For width calculation, we'll use the current text
    const koText = statusText;
    const enText = statusText;
    const viText = statusText;

    // Measure widths
    const koWidth = measureConnectionStatusWidth(status, koText);
    const enWidth = measureConnectionStatusWidth(status, enText);
    const viWidth = measureConnectionStatusWidth(status, viText);
    const maxWidth = Math.max(koWidth, enWidth, viWidth);

    // Store max width in cookie if it's different
    const savedWidth = parseInt(getCookie('connection_status_width')) || 0;
    if (maxWidth !== savedWidth) {
        setCookie('connection_status_width', maxWidth, 365);
    }

    // Apply the width to the connection status element
    status.style.setProperty('--connection-status-width', `${maxWidth}px`);

    // Update the content - CSS will handle visibility based on data-lang attribute
    status.innerHTML = `
        <span class="lang-ko">${statusText}</span>
        <span class="lang-en">${statusText}</span>
        <span class="lang-vi">${statusText}</span>
    `;
}

function loadTableStates() {
    const tableElements = document.querySelectorAll('.table-container');
    tableNames = Array.from(tableElements).map(el => el.id);

    // Phase 1: Initialize all tables as hidden first
    tableNames.forEach(tableName => {
        const container = document.getElementById(tableName);
        const button = container.previousElementSibling.querySelector('.toggle-button');
        const limitedInfoSpan = document.getElementById(`${tableName}_limited_info`);

        // Initially hide all tables
        container.classList.add('hidden-table');
        button.classList.remove('hide');
        button.classList.add('show');
        updateToggleButtonText(button, true);
        limitedInfoSpan.textContent = '';
        limitedInfoSpan.classList.remove('visible');

        // Apply theme class to the button
        const themeClass = container.className.match(/theme-\d+/)[0];
        button.classList.add(themeClass);

        container.classList.add('initialized');
        
        // Always fetch table count
        fetchTableCount(tableName, baseUrl, null, getCurrentLanguage());
    });

    // Phase 2: After a brief delay, simulate clicking for previously visible tables
    setTimeout(() => {
        tableNames.forEach(tableName => {
            const currentDb = getCurrentDatabaseKey();
            if (currentDb) {
                const state = getCookie(`table_${currentDb}_${tableName}`);
                if (state === 'visible') {
                    toggleTable(tableName);
                }
            }
        });
    }, 100); // Small delay to ensure initial state is properly set

    document.body.classList.add('loaded');
}

function saveTableOrder() {
    const currentDb = getCurrentDatabaseKey();
    if (!currentDb) return;

    const tableOrder = Array.from(document.querySelectorAll('.table-section'))
        .map(section => section.dataset.tableName);
    setCookie(`tableOrder_${currentDb}`, JSON.stringify(tableOrder), 365);
}

function loadTableOrder() {
    const currentDb = getCurrentDatabaseKey();
    if (!currentDb) return;

    const orderCookie = getCookie(`tableOrder_${currentDb}`);
    if (!orderCookie) return;

    try {
        const order = JSON.parse(orderCookie);
        const container = document.getElementById('tables-container');
        const sections = Array.from(document.querySelectorAll('.table-section'));

        sections.sort((a, b) => {
            const aIndex = order.indexOf(a.dataset.tableName);
            const bIndex = order.indexOf(b.dataset.tableName);
            return aIndex - bIndex;
        });

        sections.forEach(section => container.appendChild(section));
    } catch (error) {
        console.error('Error loading table order:', error);
    }
}

function updateDropdownOptions() {
    const dropdown = document.getElementById('monitorDropdown');
    if (dropdown) {
        dropdown.querySelectorAll('option').forEach(option => {
            // Remove any existing units first (Korean: 초, English: s, Vietnamese: giây)
            const baseValue = option.textContent.replace(/[초s]|giây/g, '').trim();
            option.textContent = `${baseValue}${t('ui.timeUnit')}`;
        });
    }
}

function updateDynamicElements() {
    // Update all dynamic elements at once
    document.querySelectorAll('.toggle-button').forEach(button => {
        const isHidden = button.closest('.table-section').querySelector('.table-container').classList.contains('hidden-table');
        updateToggleButtonText(button, isHidden);
    });

    // Update row counts
    document.querySelectorAll('[id$="_count"]').forEach(countSpan => {
        const count = countSpan.textContent.match(/\d+/);
        if (count) {
            countSpan.textContent = `(${count[0]} ${t('ui.rows')})`;
        }
    });

    // Update tooltips and info spans
    document.querySelectorAll('[id$="_limited_info"]').forEach(span => {
        if (!span.textContent) return;

        const isScrollMore = span.textContent.includes('scroll') || span.textContent.includes('스크롤') || span.textContent.includes('Cuộn');
        const text = isScrollMore ? t('ui.scrollMore') : t('ui.allDataLoaded');
        span.innerHTML = `<span class="lang-ko">${text}</span><span class="lang-en">${text}</span><span class="lang-vi">${text}</span>`;
    });

    // Update empty table messages
    document.querySelectorAll('.table-container p').forEach(p => {
        if (p.textContent.includes('No data') || p.textContent.includes('데이터가') || p.textContent.includes('Không có')) {
            p.innerHTML = `<span class="lang-ko">${t('ui.noData')}</span><span class="lang-en">${t('ui.noData')}</span><span class="lang-vi">${t('ui.noData')}</span>`;
        }
    });
}

// Add new helper function for button text updates
function updateToggleButtonText(button, isHidden) {
    const text = isHidden ? t('ui.show') : t('ui.hide');
    button.innerHTML = `
        <span class="lang-ko">${text}</span>
        <span class="lang-en">${text}</span>
        <span class="lang-vi">${text}</span>
    `;
}

// Modify the startMonitoring function
function startMonitoring() {
    if (monitorIntervalId) {
        clearInterval(monitorIntervalId);
    }

    if (window.isMonitoringPaused) return;

    const currentLang = getCurrentLanguage();
    // Immediately check connection when monitoring starts/resumes
    checkConnection(baseUrl, () => updateConnectionStatus(currentLang));

    // Add storage for previous counts
    const previousCounts = {};
monitorIntervalId = setInterval(async () => {
    // Store the current language for consistent usage
    const currentLang = getCurrentLanguage();
    // Check connection status first
    const isConnected = await checkConnection(baseUrl, () => updateConnectionStatus(currentLang));
    if (!isConnected) {
        return; // Skip data fetching if connection is down
    }

        // Update all table counts only if connected
        tableNames.forEach(tableName => {
            fetchTableCount(tableName, baseUrl, null, currentLang)
                .then(newCount => {
                    const oldCount = previousCounts[tableName];
                    
                    if (oldCount !== undefined && newCount !== oldCount) {
                        const delta = newCount - oldCount;
                        
                        // Update table row count
                        const countSpan = document.getElementById(`${tableName}_count`);
                        if (!countSpan.classList.contains('table-row-count')) {
                            countSpan.className = 'table-row-count';
                        }
                        
                        // Update pill count
                        const buttonCount = document.getElementById(`${tableName}_button_count`);
                        const pillWrapper = buttonCount.closest('.pill-count-wrapper') || createPillWrapper(buttonCount);
                        if (!buttonCount.classList.contains('pill-count')) {
                            buttonCount.className = 'pill-count';
                        }
                        
                        // Add delta indicators
                        [countSpan, buttonCount].forEach(element => {
                            const deltaPopup = document.createElement('span');
                            deltaPopup.className = `count-delta ${delta > 0 ? 'positive' : 'negative'}`;
                            deltaPopup.textContent = `${delta > 0 ? '+' : ''}${delta}`;
                            
                            const container = element.closest('.table-row-count, .pill-count-wrapper');
                            const existingDelta = container.querySelector('.count-delta');
                            if (existingDelta) {
                                existingDelta.remove();
                            }
                            
                            container.appendChild(deltaPopup);
                            
                            // Trigger animation
                            element.classList.remove('count-update');
                            void element.offsetWidth;
                            element.classList.add('count-update');
                        });

                        // Cleanup
                        setTimeout(() => {
                            document.querySelectorAll(`#${tableName}_count, #${tableName}_button_count`)
                                .forEach(el => el.classList.remove('count-update'));
                        }, 1500);
                    }
                    
                    previousCounts[tableName] = newCount;
                });
        });

        // Then update content only for visible tables
        const visibleTables = document.querySelectorAll('.table-container:not(.hidden-table)');
        visibleTables.forEach(tableContainer => {
            const tableName = tableContainer.id;
            fetchTableData(
                tableName,
                false,
                baseUrl,
                null,
                currentLang,
                updateSingleTable
            );
        });
    }, monitorInterval);

    updateClockAnimation();
}

function createPillWrapper(buttonCount) {
    const wrapper = document.createElement('span');
    wrapper.className = 'pill-count-wrapper';
    buttonCount.parentNode.insertBefore(wrapper, buttonCount);
    wrapper.appendChild(buttonCount);
    return wrapper;
}

// Add new function to handle pause/resume
function toggleMonitoring() {
    const pauseButton = document.getElementById('pauseButton');
    const clockHand = document.querySelector('.clock-hand');
    const tempTooltip = pauseButton.querySelector('.temp-tooltip');
    
    window.isMonitoringPaused = !window.isMonitoringPaused;
    
    // Use the global function from icon-morph.js
    window.togglePausePlayIcon(!window.isMonitoringPaused);
    
    if (window.isMonitoringPaused) {
        if (monitorIntervalId) {
            clearInterval(monitorIntervalId);
            monitorIntervalId = null;
        }
        if (clockHand) {
            clockHand.style.animationPlayState = 'paused';
        }
    } else {
        if (clockHand) {
            clockHand.style.animationPlayState = 'running';
        }
        if (tempTooltip) tempTooltip.style.display = 'none';
        startMonitoring();
    }
}

// Make toggleMonitoring globally available
window.toggleMonitoring = toggleMonitoring;

// Add new function to snap slider value to predefined steps
function snapToStep(value) {
    const steps = [500, 600, 700, 800, 900, 1000,
        1250, 1500, 1750, 2000, 3000, 4000, 5000,
        7500, 10000, 20000, 60000];

    return steps.reduce((prev, curr) => {
        return Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev;
    });
}

function updateClockAnimation() {
    const clockHand = document.querySelector('.clock-hand');
    const clockIcon = document.querySelector('.clock-icon');
    if (clockHand) {
        clockHand.style.animationDuration = `${monitorInterval / 1000}s`;

        // Update pause button class to ensure CSS selector works
        const pauseButton = document.querySelector('.pause-button');
        if (window.isMonitoringPaused) {
            pauseButton.classList.add('paused');
        } else {
            pauseButton.classList.remove('paused');
        }

        // Remove previous event listeners to prevent duplicates
        clockHand.removeEventListener('animationiteration', handleClockEffect);

        // Add event listener for when the hand completes a full rotation
        clockHand.addEventListener('animationiteration', handleClockEffect);
    }
}

function handleClockEffect() {
    const clockIcon = document.querySelector('.clock-icon');
    if (clockIcon) {
        // Add the effect class to trigger the heartbeat or color-blink animation
        clockIcon.classList.add('effect');

        // Remove the effect after the animation completes
        setTimeout(() => {
            clockIcon.classList.remove('effect');
        }, 500); // Duration matches the heartbeat animation duration
    }
}

function toggleTable(tableName) {
    const container = document.getElementById(tableName);
    const button = container.previousElementSibling.querySelector('.toggle-button');
    const limitedInfoSpan = document.getElementById(`${tableName}_limited_info`);
    const currentLang = getCurrentLanguage();  // Get current language

    // Add transition class before toggling
    container.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

    const isHidden = container.classList.toggle('hidden-table');
    updateToggleButtonText(button, isHidden); // Use the updated toggle-specific function
    button.classList.toggle('show', isHidden);
    button.classList.toggle('hide', !isHidden);

    // Apply theme class to the button
    const themeClass = container.className.match(/theme-\d+/)[0];
    button.classList.forEach(cls => {
        if (cls.startsWith('theme-')) {
            button.classList.remove(cls);
        }
    });
    button.classList.add(themeClass);

    const currentDb = getCurrentDatabaseKey();
    if (currentDb) {
        setCookie(`table_${currentDb}_${tableName}`, isHidden ? 'hidden' : 'visible', 365);
    }

    if (isHidden) {
        // If we're hiding the table and monitoring was paused, resume it
        if (window.isMonitoringPaused) {
            window.toggleMonitoring();
        }
        
        // Reset chunk tracking when hiding table
        delete tableChunks[tableName];
        // Add hiding class for slide-out animation
        limitedInfoSpan.classList.add('hiding');
        limitedInfoSpan.classList.remove('visible');

        // Wait for animation to complete before removing text
        setTimeout(() => {
            limitedInfoSpan.textContent = '';
            limitedInfoSpan.classList.remove('hiding');
        }, 300); // Match the transition duration

        // Use requestAnimationFrame for smooth cleanup
        const handleTransitionEnd = () => {
            if (isHidden) {
                container.innerHTML = '';
                delete previousData[tableName];
                delete tableOffsets[tableName];
            }
            container.removeEventListener('transitionend', handleTransitionEnd);
        };

        container.addEventListener('transitionend', handleTransitionEnd);
    } else {
        // Initialize chunk tracking when showing table
        tableChunks[tableName] = {
            start: 0,
            end: 50
        };

        // Pass baseUrl when calling fetchTableData
        fetchTableData(tableName, false, baseUrl, null, getCurrentLanguage(),
            (tName, tInfo, trans, lang, fetchFn) => {
                const limitedInfoSpan = document.getElementById(`${tName}_limited_info`);
                if (limitedInfoSpan) {
                    if (tInfo.limited) {
                        limitedInfoSpan.innerHTML = `
                            <span class="lang-ko" style="display: ${getCurrentLanguage() === 'ko' ? 'inline' : 'none'}">${t('ui.scrollMore')}</span>
                            <span class="lang-en" style="display: ${getCurrentLanguage() === 'en' ? 'inline' : 'none'}">${t('ui.scrollMore')}</span>
                            <span class="lang-vi" style="display: ${getCurrentLanguage() === 'vi' ? 'inline' : 'none'}">${t('ui.scrollMore')}</span>
                        `;
                    } else {
                        limitedInfoSpan.innerHTML = `
                            <span class="lang-ko" style="display: ${getCurrentLanguage() === 'ko' ? 'inline' : 'none'}">${t('ui.allDataLoaded')}</span>
                            <span class="lang-en" style="display: ${getCurrentLanguage() === 'en' ? 'inline' : 'none'}">${t('ui.allDataLoaded')}</span>
                            <span class="lang-vi" style="display: ${getCurrentLanguage() === 'vi' ? 'inline' : 'none'}">${t('ui.allDataLoaded')}</span>
                        `;
                    }
                    limitedInfoSpan.classList.add('visible');
                }
                updateSingleTable(tName, tInfo, trans, lang, fetchFn, baseUrl);
            }
        ).then(() => {
            const tableDiv = document.getElementById(tableName);
            const headerTable = tableDiv.querySelector('.header-table');
            // Removed adjustColumnWidths call - it interferes with our alignment
            // if (headerTable) {
            //     adjustColumnWidths(headerTable);
            // }
            requestAnimationFrame(() => {
                container.classList.add('expanded');
                // Ensure image settings are applied after table is fully loaded
                if (window.applyImageSettingsToAllTables) {
                    setTimeout(() => {
                        window.applyImageSettingsToAllTables();
                    }, 100);
                }

                // Removed triggerTableAlignment call - it overrides our intelligent width calculation
                // The intelligent calculation in createNewTable handles alignment properly
                // setTimeout(() => {
                //     if (window.triggerTableAlignment) {
                //         window.triggerTableAlignment(tableName);
                //     }
                // }, 150);
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Add download buttons to all table headers
    addDownloadButtons();
    
    const initialSetup = document.getElementById('initial-setup');
    const mainInterface = document.getElementById('main-interface');

    // Initialize favicon controls
    const faviconToggle = document.getElementById('faviconToggle');
    const faviconUpload = document.getElementById('faviconUpload');
    const faviconUploadButton = document.querySelector('.favicon-upload');
    const defaultFaviconPath = '/static/monitor_icon.png';
    
    // Load saved favicon preferences
    const savedFavicon = localStorage.getItem('customFavicon');
    const useCustomFavicon = localStorage.getItem('useCustomFavicon') === 'true';
    
    // Initialize toggle state and visibility
    faviconToggle.selected = useCustomFavicon;
    faviconUploadButton.style.display = useCustomFavicon ? 'block' : 'none';
    updateFavicon();

    // Handle favicon toggle
    faviconToggle.addEventListener('change', () => {
        localStorage.setItem('useCustomFavicon', faviconToggle.selected);
        faviconUploadButton.style.display = faviconToggle.selected ? 'block' : 'none';
        updateFavicon();
    });

    // Handle favicon upload
    faviconUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                localStorage.setItem('customFavicon', e.target.result);
                updateFavicon();
            };
            reader.readAsDataURL(file);
        }
    });

    function updateFavicon() {
        const favicon = document.querySelector('link[rel="icon"]');
        if (!faviconToggle.selected) {
            favicon.href = defaultFaviconPath;
        } else {
            const customFavicon = localStorage.getItem('customFavicon');
            if (customFavicon) {
                favicon.href = customFavicon;
            } else {
                favicon.href = defaultFaviconPath;
            }
        }
    }
    
    // Handle favicon drag-and-drop
    // Use the existing faviconUploadButton variable, but get the specific button element
    const uploadButton = document.querySelector('.favicon-upload .upload-button');
    uploadButton.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadButton.classList.add('dragover');
    });
    uploadButton.addEventListener('dragleave', () => {
        uploadButton.classList.remove('dragover');
    });
    uploadButton.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadButton.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                localStorage.setItem('customFavicon', e.target.result);
                updateFavicon();
            };
            reader.readAsDataURL(file);
        }
    });

    // Add loaded class immediately to make content visible
    document.body.classList.add('loaded');
    
    // First fetch current database state
    fetch(`${baseUrl}/api/database`)
        .then(response => response.json())
        .then(config => {
            if (!config.database) {
                // Show initial setup screen
                initialSetup.style.display = 'flex';
                mainInterface.style.display = 'none';
                
                // Get the existing form
                const form = document.querySelector('.setup-form-container form');
                const typeSelect = form.querySelector('select[name="type"]');
                let config = { type: typeSelect.value }; // Initialize config with selected type

                // Handle type selection changes
                typeSelect.addEventListener('change', () => {
                    config.type = typeSelect.value;
                });

                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const formData = new FormData(form);
                    // Merge formData into config
                    for (let [key, value] of formData.entries()) {
                        config[key] = value;
                    }

                    try {
                        const response = await fetch(`${baseUrl}/api/database`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(config)
                        });
                        
                        if (response.ok) {
                            window.location.reload();
                        } else {
                            const error = await response.json();
                            throw new Error(error.message);
                        }
                    } catch (error) {
                        // Show error message
                        let errorDiv = form.querySelector('.db-error');
                        if (!errorDiv) {
                            errorDiv = document.createElement('div');
                            errorDiv.className = 'db-error';
                            form.insertBefore(errorDiv, form.firstChild);
                        }
                        errorDiv.textContent = error.message;
                    }
                });
            } else {
                // Show main interface and initialize
                initialSetup.style.display = 'none';
                mainInterface.style.display = 'block';
                loadTableStates();
                checkConnection(baseUrl, updateConnectionStatus);
            }
        });
    
    new Sortable(document.getElementById('tables-container'), {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        onEnd: function () {
            saveTableOrder();
        }
    });

    loadTableOrder();

    initializeLanguage(updateLanguage, updateStaticLanguageElements, updateDynamicElements, updateDropdownOptions, updateConnectionStatus);

    // Add dropdown initialization
    const dropdown = document.getElementById('monitorDropdown');
    const warningPopup = document.getElementById('warningPopup');
    let warningTimeout;

    function updateDropdownDangerState(milliseconds) {
        if (milliseconds < 2000) {
            dropdown.classList.add('danger');
        } else {
            dropdown.classList.remove('danger');
        }
    }

    function showWarning() {
        const warningPopup = document.getElementById('warningPopup');
        requestAnimationFrame(() => {
            warningPopup.classList.add('show');
            clearTimeout(window.warningTimeout);
            window.warningTimeout = setTimeout(() => {
                warningPopup.classList.remove('show');
            }, 2000);
        });
    }

    dropdown.addEventListener('change', (e) => {
        const milliseconds = parseInt(e.target.value);
        const seconds = (milliseconds / 1000).toFixed(milliseconds >= 1000 ? 1 : 1);

        updateDropdownDangerState(milliseconds);

        if (milliseconds < 2000) {
            showWarning();
        } else {
            warningPopup.classList.remove('show');
            clearTimeout(warningTimeout);
        }

        monitorInterval = milliseconds;
        setCookie('monitor_interval', monitorInterval, 365);
        startMonitoring();
        updateClockAnimation();
    });

    // Remove or modify the old savedInterval loading code
    const savedInterval = getCookie('monitor_interval');
    if (savedInterval) {
        monitorInterval = parseInt(savedInterval);
    } else {
        // Set default if no saved interval exists
        monitorInterval = 5000;
        setCookie('monitor_interval', monitorInterval, 365);
    }

    // Always set both the dropdown value and the actual interval to 5000ms
    dropdown.value = '5000';
    monitorInterval = 5000;

    // Initialize danger class based on current value
    updateDropdownDangerState(monitorInterval);

    // Restart monitoring with new interval
    startMonitoring();
    updateClockAnimation();

    // Add pause button handler
    const pauseButton = document.getElementById('pauseButton');
    pauseButton.addEventListener('click', toggleMonitoring);

    initializeTheme();

    // Fix admin toggle initialization to maintain state across page loads
    const adminToggle = document.getElementById('adminToggle');
    if (adminToggle) {
        // Load saved state from localStorage
        const savedAdminState = localStorage.getItem('adminToggleState');
        adminToggle.selected = savedAdminState === 'true';

        // Update UI to reflect the loaded state
        document.body.classList.toggle('admin-mode', adminToggle.selected);

        adminToggle.addEventListener('change', () => {
            // Save state to localStorage when changed
            localStorage.setItem('adminToggleState', adminToggle.selected);
            // Update UI based on new state
            document.body.classList.toggle('admin-mode', adminToggle.selected);
        });
    }

    // Expose toggleTable to global scope
    window.toggleTable = toggleTable;
    window.baseUrl = baseUrl;

    // Add after other initializations in DOMContentLoaded
    function initializeDatabaseSwitcher() {
        const dbSwitchButton = document.getElementById('dbSwitchButton');
        const dbMenu = document.getElementById('dbMenu');
        const addDbButton = document.getElementById('addDbButton');
        const dbList = document.querySelector('.db-list');
        let isFormOpen = false;
        
        // Load saved databases from cookie with proper encoding/decoding
        const savedConfigs = (() => {
            try {
                const configStr = getCookie('db_configs');
                return configStr ? JSON.parse(decodeURIComponent(configStr)) : {};
            } catch (e) {
                console.warn('Failed to parse saved database configs:', e);
                return {};
            }
        })();
        
        const currentDb = document.querySelector('.current-db');
        
        // Update currentDb display for no configuration
        if (!Object.keys(savedConfigs).length) {
            currentDb.textContent = 'No Database Connected';
            currentDb.style.color = '#999';
            // Show the add database form immediately and disable close on click outside
            dbMenu.classList.add('show', 'force-show');
            showAddDatabaseForm();
        }

        // Handle force-show class for the database menu
        document.addEventListener('click', (e) => {
            if (dbMenu.classList.contains('force-show')) {
                e.stopPropagation();  // Prevent closing when force-show is active
                return;
            }
        }, true);  // Use capture phase to handle click before other listeners
        
        function showAddDatabaseForm() {
            // Form height is the same for all DBs
            const currentDb = getCurrentDatabaseKey();
            const cachedFormHeight = localStorage.getItem('dbMenuFormHeight_' + (currentDb || 'default'));
            if (cachedFormHeight && !isNaN(parseInt(cachedFormHeight))) {
                requestAnimationFrame(() => {
                    dbMenu.style.height = cachedFormHeight + 'px';
                });
            }

            // After all animations complete, store the stable form height
            setTimeout(() => {
                // Only store if height has settled
                const previousHeight = dbMenu.offsetHeight;
                setTimeout(() => {
                    const currentHeight = dbMenu.offsetHeight;
                    // If height hasn't changed in the last 100ms, consider it stable
                    if (currentHeight === previousHeight) {
                        localStorage.setItem('dbMenuFormHeight_' + (currentDb || 'default'), currentHeight + 'px');
                    }
                }, 100);
            }, 1000);

            // Begin animation: fade out the current list
            dbList.classList.add('animating-out');

            // Store current height before any changes
            const currentHeight = dbMenu.scrollHeight;
            dbMenu.style.height = currentHeight + 'px';

            // Define form content first
            const formHtml = `
                <form class="db-form material-form">
                    <div class="form-group">
                        <div class="db-type-wrapper">
                            <select name="type" class="db-type-select" required>
                                <option value="mysql">MySQL</option>
                                <option value="postgresql">PostgreSQL</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <input type="text" name="host" id="host" required placeholder=" ">
                        <label for="host">
                            <span class="lang-ko">호스트</span>
                            <span class="lang-en">Host</span>
                            <span class="lang-vi">Máy chủ</span>
                        </label>
                    </div>
                    <div class="form-group">
                        <input type="text" name="user" id="user" required placeholder=" ">
                        <label for="user">
                            <span class="lang-ko">사용자</span>
                            <span class="lang-en">User</span>
                            <span class="lang-vi">Người dùng</span>
                        </label>
                    </div>
                    <div class="form-group">
                        <input type="password" name="password" id="password" placeholder=" ">
                        <label for="password">
                            <span class="lang-ko">비밀번호</span>
                            <span class="lang-en">Password</span>
                            <span class="lang-vi">Mật khẩu</span>
                        </label>
                    </div>
                    <div class="form-group">
                        <input type="text" name="database" id="database" required placeholder=" ">
                        <label for="database">
                            <span class="lang-ko">데이터베이스</span>
                            <span class="lang-en">Database</span>
                            <span class="lang-vi">Cơ sở dữ liệu</span>
                        </label>
                    </div>
                    <button type="submit" class="add-db-button">
                        <span class="lang-ko">추가</span>
                        <span class="lang-en">Add</span>
                        <span class="lang-vi">Thêm</span>
                    </button>
                </form>
            `;

            
            // After a short delay to allow fade out animation
            setTimeout(() => {
                isFormOpen = true;
                updateAddButtonState(true);
                
                // Instead of removing favicon controls, just hide them
                const faviconControls = dbMenu.querySelector('.favicon-controls');
                if (faviconControls) {
                    // Just hide it instead of removing
                    faviconControls.style.opacity = '0';
                    faviconControls.style.visibility = 'hidden';
                    faviconControls.style.display = 'none';
                    
                    // We don't need to store it since we're no longer removing it
                    // But keep the reference in case it's needed elsewhere
                    dbMenu.dataset.hasFaviconControls = 'true';
                }
               
                // Create temporary container to measure form height
                const tempContainer = document.createElement('div');
                tempContainer.style.position = 'absolute';
                tempContainer.style.visibility = 'hidden';
                tempContainer.innerHTML = formHtml;
                dbMenu.appendChild(tempContainer);
                
                // Get the final height from temp container
                const finalHeight = tempContainer.scrollHeight;
                
                // Remove temp container
                dbMenu.removeChild(tempContainer);
                
                // Now update actual content and animate height
                requestAnimationFrame(() => {
                    dbList.innerHTML = formHtml;
                    const form = dbList.querySelector('.db-form');
                    form.style.opacity = '0';
                    form.classList.add('animating-in');
                    setTimeout(() => {
                        dbMenu.style.height = form.scrollHeight + 'px';
                    }, 50);
                    
                    // Add cleanup timeout
                    setTimeout(() => {
                        form.style.opacity = '1';
                        dbList.classList.remove('animating-out');
                        form.classList.remove('animating-in');
                        // Reset to auto height after animation
                        dbMenu.style.height = 'auto';
                        
                        // Setup radio button handlers after form is visible
                        // Handle form submission after form is ready
                        form.addEventListener('submit', (e) => {
                            e.preventDefault();
                            const formData = new FormData(form);
                            const config = Object.fromEntries(formData);
                            
                            // Get type from select element
                            const type = config.type; // Type is already in the FormData
                            
                            // Add the type to the config and save
                            const fullConfig = {
                                ...config,
                                type // Explicitly set the type field
                            };
                            const configKey = `${fullConfig.host}/${fullConfig.database}`;
                            savedConfigs[configKey] = fullConfig;
                            
                            setCookie('db_configs', encodeURIComponent(JSON.stringify(savedConfigs)), 365);
                            
                            // Show the updated list before switching
                            updateDbList();
                            isFormOpen = false;
                            updateAddButtonState(false);
                            
                            // Switch to the new database
                            switchDatabase(config);
                        });
                    }, 300);
                });
                
            }, 300); // Wait for fade-out animation to complete
        }

        function updateDbList() {
            // If there's a form, fade it out first
            const form = dbList.querySelector('.db-form');
            const currentHeight = dbMenu.scrollHeight;
            
            // Set fixed height to prevent jumps
            dbMenu.style.height = currentHeight + 'px';
            
            if (form) {
                form.classList.add('animating-out');
                
                // Wait for fade-out to complete
                setTimeout(() => {
                    // Create temporary container for measuring
                    const tempContainer = document.createElement('div');
                    tempContainer.style.position = 'absolute';
                    tempContainer.style.visibility = 'hidden';
                    tempContainer.style.width = dbList.offsetWidth + 'px';
                    dbMenu.appendChild(tempContainer);
                    
                    tempContainer.innerHTML = dbList.innerHTML;
                    populateDbList(tempContainer);
                    
                    // Measure final height
                    const finalHeight = tempContainer.scrollHeight;
                    
                    // Remove temp container
                    dbMenu.removeChild(tempContainer);
                    
                    // Now update actual content
                    requestAnimationFrame(() => {
                        // First set explicit height
                        dbMenu.style.height = currentHeight + 'px';
                        
                        // Update content
                        dbList.innerHTML = '';
                        populateDbList(dbList);
                        
                        // Force a reflow
                        void dbList.offsetHeight;

                        // Animate to new height
                        requestAnimationFrame(() => {
                            dbMenu.style.height = finalHeight + 'px';
                            
                            // Reset to auto after animation completes
                            setTimeout(() => {
                                dbMenu.style.height = 'auto';
                            }, 300); // Wait for fade-out
                        });
                    });
                }, 300); // Wait for fade-out
            } else {
                // Create temp container for measuring new content
                const tempContainer = document.createElement('div');
                tempContainer.style.position = 'absolute';
                tempContainer.style.visibility = 'hidden';
                tempContainer.style.width = dbList.offsetWidth + 'px';
                dbMenu.appendChild(tempContainer);
                
                populateDbList(tempContainer);
                const finalHeight = tempContainer.scrollHeight;
                dbMenu.removeChild(tempContainer);
                
                // Now update actual content with smooth transition
                requestAnimationFrame(() => {
                    // Set current height explicitly
                    dbMenu.style.height = currentHeight + 'px';
                    
                    // Update content
                    dbList.innerHTML = '';
                    populateDbList(dbList);
                    
                    // Force reflow
                    void dbList.offsetHeight;
                    
                    // Animate to new height
                    requestAnimationFrame(() => {
                        dbMenu.style.height = finalHeight + 'px';
                        
                        // Reset to auto after animation
                        setTimeout(() => {
                            dbMenu.style.height = 'auto';
                        }, 300);
                    }, 50);
                });
            }
        }
        
        function populateDbList(container = dbList) {
            const entries = Object.entries(savedConfigs);
            
            // Show favicon controls when updating db list
            const faviconControls = dbMenu.querySelector('.favicon-controls');
            if (faviconControls) {
                // Make visible with a smooth transition
                requestAnimationFrame(() => {
                    faviconControls.style.display = 'flex';
                    // Force a reflow to ensure the display change is processed
                    void faviconControls.offsetWidth;
                    faviconControls.style.opacity = '1';
                    faviconControls.style.visibility = 'visible';
                    
                    // Add visible class for additional animation if defined
                    setTimeout(() => {
                        faviconControls.classList.add('visible');
                    }, 50);
                });
            }
            
            if (entries.length === 0) {
                showAddDatabaseForm();
                // Clear server-side state when no databases remain
                fetch(`${baseUrl}/api/database`, { method: 'DELETE' })
                    .then(() => {
                        currentDb.textContent = 'No Database Connected';
                        currentDb.style.color = '#999';
                        location.reload(); // Refresh to clear all data
                    });
                return;
            }
            
            // Clear existing content
            container.innerHTML = '';
            
            entries.forEach(([key, config], index) => {
                const item = document.createElement('div');
                item.className = 'db-item';
                // Apply staggered animation effect if no delays are already present
                if(!container.querySelector('.db-item')) {
                    // First item has default animation timing
                    // Other items will get their delay from CSS
                }
                
                const contentSpan = document.createElement('span');
                contentSpan.className = 'db-item-content';
                const dbType = config.type;
                contentSpan.innerHTML = `${config.database} (${config.host}) <span class="db-type-badge db-type-${dbType.toLowerCase()}">${dbType === 'postgresql' ? 'PostgreSQL' : 'MySQL'}</span>`;
                contentSpan.addEventListener('click', () => switchDatabase(config));
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-db';
                deleteBtn.innerHTML = '×';
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    
                    // Store references to important elements before deletion
                    const configKey = `${config.host}/${config.database}`;
                    const dbItemToRemove = e.target.closest('.db-item');
                    
                    // Calculate initial heights before any changes
                    const initialMenuHeight = dbMenu.scrollHeight;
                    const itemHeight = dbItemToRemove.offsetHeight;
                    
                    // Estimate new height after item is removed (but before actual DOM change)
                    const estimatedNewHeight = initialMenuHeight - itemHeight;
                    
                    // Set fixed height to allow for smooth transition
                    dbMenu.style.height = `${initialMenuHeight}px`;
                    dbMenu.style.overflow = 'hidden';
                    
                    // Force reflow
                    void dbMenu.offsetHeight;
                    
                    // Animate item being deleted
                    dbItemToRemove.style.transition = 'opacity 0.3s, transform 0.3s';
                    dbItemToRemove.style.opacity = '0';
                    dbItemToRemove.style.transform = 'translateX(-10px)';
                    
                    // Clear height caches for this DB
                    try {
                        localStorage.removeItem('dbMenuListHeight_' + configKey);
                        // Don't remove form height as it's shared
                        
                        // Also clear any old format caches
                        localStorage.removeItem('dbMenuListHeight');
                        localStorage.removeItem('dbMenuFormHeight');
                    } catch (e) {
                        console.warn('Failed to clear height caches:', e);
                    }
                    
                    const currentDb = getCurrentDatabaseKey();
                    
                    // Begin actual height transition to estimated height
                    setTimeout(() => {
                        dbMenu.style.height = `${estimatedNewHeight}px`;
                        
                        // Now remove the item from the data structure
                        delete savedConfigs[key];
                        
                        // After transition completes, update the DOM structure
                        setTimeout(() => {
                            // If this was the last database
                            if (Object.keys(savedConfigs).length === 0) {
                                // Clear cookie and redirect to setup
                                setCookie('db_configs', '', -1);
                                showAddDatabaseForm();
                                return;
                            }
                            
                            // Remove the item from DOM
                            if (dbItemToRemove.parentNode) {
                                dbItemToRemove.parentNode.removeChild(dbItemToRemove);
                            }
                            
                            // Update cookie with remaining configs
                            setCookie('db_configs', encodeURIComponent(JSON.stringify(savedConfigs)), 365);
                            
                            // If we're deleting the currently active database, switch to another one
                            if (currentDb && currentDb === configKey) {
                                const nextDbKey = Object.keys(savedConfigs)[0];
                                if (nextDbKey) {
                                    switchDatabase(savedConfigs[nextDbKey]);
                                }
                            }
                        }, 300); // Match the height transition duration
                    }, 100); // Slight delay to allow opacity change to start
                });
                
                item.appendChild(contentSpan);
                item.appendChild(deleteBtn);
                container.appendChild(item);
            });
        }

        function switchDatabase(config) {
            const dbList = document.querySelector('.db-list');
            dbList.innerHTML = '<div class="db-loading">Connecting...</div>';
            
            const dbConfig = { // Use provided config directly
                ...config
            };
            
            fetch(`${baseUrl}/api/database`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dbConfig)
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    const newConfigs = { ...savedConfigs };
                    const configKey = `${config.host}/${config.database}`;
                    newConfigs[configKey] = config;
                    
                    // Clear old db's list height cache before switching
                    const currentDb = getCurrentDatabaseKey();
                    if (currentDb) {
                        try {
                            localStorage.removeItem('dbMenuListHeight_' + currentDb);
                            // We don't clear form height as it's shared
                        } catch (e) {
                            console.warn('Failed to clear old db height cache:', e);
                        }
                    }
                    
                    setCookie('db_configs', encodeURIComponent(JSON.stringify(newConfigs)), 365);
                    location.reload();
                } else {
                    throw new Error(data.message || 'Failed to connect to database');
                }
            })
            .catch(error => {
                dbList.innerHTML = `<div class="db-error">${error.message}</div>`;
                setTimeout(updateDbList, 2000);
            });
        }
        
        // Toggle menu with proper animation sequence
        dbSwitchButton.addEventListener('click', () => {
            // Opening the menu
            if (!dbMenu.classList.contains('show')) {
                // Lock menu button to prevent double clicking during animation
                dbSwitchButton.classList.add('disabled');

                // First make sure the menu is available in DOM but invisible to users
                dbMenu.classList.remove('closing');
                dbMenu.style.display = 'block';
                dbMenu.style.opacity = '0';
                dbMenu.style.height = 'auto'; // Let it expand to full content size
                dbMenu.style.overflow = 'hidden';
                dbMenu.style.visibility = 'hidden'; // Hide it completely during preparation

                // Prepare all content in the actual menu (not offscreen)
                if (!isFormOpen) {
                    // Update the database list
                    const realDbList = dbMenu.querySelector('.db-list');
                    realDbList.innerHTML = '';
                    populateDbList(realDbList);
                    
                    // Show the controls
                    const faviconControls = dbMenu.querySelector('.favicon-controls');
                    if (faviconControls) {
                        faviconControls.style.display = 'flex';
                        faviconControls.style.visibility = 'visible';
                        faviconControls.style.opacity = '1';
                        
                        // Add visible class for additional animation
                        setTimeout(() => {
                            faviconControls.classList.add('visible');
                        }, 50);
                    }
                }
                
                // Wait a generous amount of time for all content to be fully loaded and rendered
                setTimeout(() => {
                    // Measure the final height from the fully rendered content
                    const finalHeight = dbMenu.scrollHeight;
                    
                    // Store for future reference
                    const currentDb = getCurrentDatabaseKey();
                    localStorage.setItem('dbMenuListHeight_' + (currentDb || 'default'), finalHeight + 'px');
                    
                    // Now prepare the actual animation
                    // First, set starting height to 0 without showing menu yet
                    dbMenu.style.height = '0px';
                    dbMenu.style.opacity = '0';
                    dbMenu.style.visibility = 'visible'; // Make visible but with 0 height/opacity
                    
                    // Force a reflow
                    void dbMenu.offsetHeight;
                    
                    // Now start the animation with both height and opacity
                    setTimeout(() => {
                        dbMenu.style.height = `${finalHeight}px`;
                        dbMenu.style.opacity = '1';
                        dbMenu.classList.add('show');
                        
                        // Add materialReveal animation class
                        dbMenu.classList.add('materialReveal');
                        
                        // Reset to auto height after animation completes
                        setTimeout(() => {
                            dbMenu.style.height = 'auto';
                            dbMenu.style.overflow = '';
                            
                            // Remove the animation class after animation completes
                            dbMenu.classList.remove('materialReveal');
                            
                            // Re-enable the button
                            dbSwitchButton.classList.remove('disabled');
                        }, 400); // Match animation duration in CSS
                    }, 10);
                }, 100); // Give browser time to fully render content
                
            } else {
                // For closing: first add closing class to start the animation
                dbMenu.classList.add('closing');
                
                // Lock height to current value to prevent jumping
                const currentHeight = dbMenu.scrollHeight;
                dbMenu.style.height = `${currentHeight}px`;
                dbMenu.style.overflow = 'hidden';
                
                // Force a reflow
                void dbMenu.offsetHeight;
                
                // Animate height to 0 and fade out
                requestAnimationFrame(() => {
                    dbMenu.style.height = '0';
                    dbMenu.style.opacity = '0';
                    dbMenu.classList.remove('show');
                });
                
                // Wait for animation to complete before hiding
                setTimeout(() => {
                    if (!dbMenu.classList.contains('show')) {
                        dbMenu.style.display = 'none';
                        dbMenu.classList.remove('closing');
                        dbMenu.style.overflow = '';
                        
                        // Reset height to auto for next opening
                        dbMenu.style.height = 'auto';
                    }
                }, 400); // Match the animation duration
                
                // If a form is open, go back to the database list view
                if (isFormOpen) {
                    updateDbList();
                    isFormOpen = false;
                    updateAddButtonState(false);
                }
            }
        });

        // Add new button state management
        function updateAddButtonState(isFormOpen) {
            const addBtn = document.getElementById('addDbButton');
            const addText = addBtn.querySelector('.add-text');
            const backText = addBtn.querySelector('.back-text');

            if (isFormOpen) {
                addBtn.classList.add('back');
                addText.style.display = 'none';
                backText.style.display = 'block';
            } else {
                addBtn.classList.remove('back');
                addText.style.display = 'block';
                backText.style.display = 'none';
            }
        }

        // Add new database
        addDbButton.addEventListener('click', () => {
            if (isFormOpen) {
                // Going back to database list from form
                // Lock button to prevent clicking during animation
                addDbButton.classList.add('disabled');
                
                // First, mark that we're no longer in form mode
                isFormOpen = false;
                updateAddButtonState(false);
                
                // Fade out the form
                const form = dbList.querySelector('.db-form');
                if (form) {
                    form.classList.add('animating-out');
                    form.style.opacity = '0';
                }
                
                // Lock current height
                const currentHeight = dbMenu.scrollHeight;
                dbMenu.style.height = `${currentHeight}px`;
                dbMenu.style.overflow = 'hidden';
                
                // Wait briefly for form fade out to start
                setTimeout(() => {
                    // Create the database list in the actual menu (hidden initially)
                    dbList.style.opacity = '0';
                    dbList.innerHTML = '';
                    populateDbList(dbList);
                    
                    // Prepare controls
                    const faviconControls = dbMenu.querySelector('.favicon-controls');
                    const logoControls = dbMenu.querySelector('.logo-controls');
                    
                    if (faviconControls) {
                        faviconControls.style.display = 'flex';
                        faviconControls.style.opacity = '0';
                        faviconControls.style.visibility = 'hidden';
                    }
                    
                    if (logoControls) {
                        logoControls.style.display = 'flex';
                        logoControls.style.opacity = '0';
                        logoControls.style.visibility = 'hidden';
                    }
                    
                    // Now measure the final height with everything in place
                    // Give browser time to render everything
                    setTimeout(() => {
                        // Temporarily set auto height to get full content height
                        const originalHeight = dbMenu.style.height;
                        dbMenu.style.height = 'auto';
                        const finalHeight = dbMenu.scrollHeight;
                        dbMenu.style.height = originalHeight; // Reset to original height
                        
                        // Store this height for future reference
                        const currentDb = getCurrentDatabaseKey();
                        localStorage.setItem('dbMenuListHeight_' + (currentDb || 'default'), finalHeight + 'px');
                        
                        // Now start the transition to the final state
                        requestAnimationFrame(() => {
                            dbMenu.style.height = `${finalHeight}px`;
                            dbList.style.opacity = '1';
                            
                            // Fade in controls after height animation starts
                            setTimeout(() => {
                                if (faviconControls) {
                                    faviconControls.style.visibility = 'visible';
                                    faviconControls.style.opacity = '1';
                                }
                                
                                if (logoControls) {
                                    logoControls.style.visibility = 'visible';
                                    logoControls.style.opacity = '1';
                                }
                                
                                // Reset to auto height once animation completes
                                setTimeout(() => {
                                    dbMenu.style.height = 'auto';
                                    dbMenu.style.overflow = '';
                                    
                                    // Re-enable the button
                                    addDbButton.classList.remove('disabled');
                                }, 300);
                            }, 100);
                        });
                    }, 50);
                }, 150); // Wait briefly for form fade-out
                return;
            }
            
            // Disable the button during animation
            addDbButton.classList.add('disabled');
            
            // Begin animation for showing the form
            // Step 1: Measure and set initial height
            const currentHeight = dbMenu.scrollHeight;
            dbMenu.style.height = `${currentHeight}px`;
            dbMenu.style.overflow = 'hidden';
            
            // Step 2: Prepare the form but keep it hidden
            const formHtml = `
                <form class="db-form material-form">
                    <div class="form-group">
                        <div class="db-type-wrapper">
                            <select name="type" class="db-type-select" required>
                                <option value="mysql">MySQL</option>
                                <option value="postgresql">PostgreSQL</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <input type="text" name="host" id="host" required placeholder=" ">
                        <label for="host">
                            <span class="lang-ko">호스트</span>
                            <span class="lang-en">Host</span>
                            <span class="lang-vi">Máy chủ</span>
                        </label>
                    </div>
                    <div class="form-group">
                        <input type="text" name="user" id="user" required placeholder=" ">
                        <label for="user">
                            <span class="lang-ko">사용자</span>
                            <span class="lang-en">User</span>
                            <span class="lang-vi">Người dùng</span>
                        </label>
                    </div>
                    <div class="form-group">
                        <input type="password" name="password" id="password" placeholder=" ">
                        <label for="password">
                            <span class="lang-ko">비밀번호</span>
                            <span class="lang-en">Password</span>
                            <span class="lang-vi">Mật khẩu</span>
                        </label>
                    </div>
                    <div class="form-group">
                        <input type="text" name="database" id="database" required placeholder=" ">
                        <label for="database">
                            <span class="lang-ko">데이터베이스</span>
                            <span class="lang-en">Database</span>
                            <span class="lang-vi">Cơ sở dữ liệu</span>
                        </label>
                    </div>
                    <button type="submit" class="add-db-button">
                        <span class="lang-ko">추가</span>
                        <span class="lang-en">Add</span>
                        <span class="lang-vi">Thêm</span>
                    </button>
                </form>
            `;
            
            // Step 3: Create a temporary form to measure its height
            const tempContainer = document.createElement('div');
            tempContainer.style.position = 'absolute';
            tempContainer.style.visibility = 'hidden';
            tempContainer.style.width = dbList.offsetWidth + 'px';
            tempContainer.innerHTML = formHtml;
            dbMenu.appendChild(tempContainer);
            
            // Step 4: Measure the form height
            const estimatedFormHeight = tempContainer.scrollHeight;
            dbMenu.removeChild(tempContainer);
            
            // Step 5: Fade out current content
            const currentContent = Array.from(dbList.children);
            currentContent.forEach(el => {
                el.style.transition = 'opacity 0.2s ease-out';
                el.style.opacity = '0';
            });
            
            // Step 6: Hide favicon controls with animation
            const faviconControls = dbMenu.querySelector('.favicon-controls');
            if (faviconControls) {
                faviconControls.style.transition = 'opacity 0.2s ease-out';
                faviconControls.style.opacity = '0';
            }
            
            // Step 7: After fade out, swap content and animate to new height
            setTimeout(() => {
                // Mark as form open for state tracking
                isFormOpen = true;
                updateAddButtonState(true);
                
                // Hide favicon controls
                if (faviconControls) {
                    faviconControls.style.visibility = 'hidden';
                    faviconControls.style.display = 'none';
                }
                
                // Update the content
                dbList.innerHTML = formHtml;
                
                // Start with the form hidden
                const form = dbList.querySelector('.db-form');
                form.style.opacity = '0';
                
                // Force a reflow
                void dbList.offsetHeight;
                
                // Animate to the new height
                requestAnimationFrame(() => {
                    dbMenu.style.height = `${estimatedFormHeight}px`;
                    
                    // Once height animation has started, fade in the form
                    setTimeout(() => {
                        form.style.transition = 'opacity 0.3s ease-in';
                        form.style.opacity = '1';
                        
                        // Final cleanup once animation completes
                        setTimeout(() => {
                            dbMenu.style.height = 'auto';
                            dbMenu.style.overflow = '';
                            addDbButton.classList.remove('disabled');
                            
                            // Store the actual height after everything is visible
                            const actualFormHeight = dbMenu.scrollHeight;
                            const currentDb = getCurrentDatabaseKey();
                            localStorage.setItem('dbMenuFormHeight_' + (currentDb || 'default'), actualFormHeight);
                            
                            // Setup form submission handler
                            form.addEventListener('submit', (e) => {
                                e.preventDefault();
                                const formData = new FormData(form);
                                const config = Object.fromEntries(formData);
                                
                                // Get type from select element
                                const type = config.type; // Type is already in the FormData
                                
                                // Add the type to the config and save
                                const fullConfig = {
                                    ...config,
                                    type // Explicitly set the type field
                                };
                                const configKey = `${fullConfig.host}/${fullConfig.database}`;
                                savedConfigs[configKey] = fullConfig;
                                
                                setCookie('db_configs', encodeURIComponent(JSON.stringify(savedConfigs)), 365);
                                
                                // Show the updated list before switching
                                updateDbList();
                                isFormOpen = false;
                                updateAddButtonState(false);
                                
                                // Switch to the new database
                                switchDatabase(config);
                            });
                        }, 300);
                    }, 50);
                });
            }, 250); // Wait for fade-out to complete
        });

        // Close menu when clicking outside with proper closing animation
        document.addEventListener('click', (e) => {
            if (!dbMenu.contains(e.target) && !dbSwitchButton.contains(e.target) && dbMenu.classList.contains('show')) {
                // For closing: first add closing class to start the animation
                dbMenu.classList.add('closing');
                
                // Allow a brief moment for closing class to apply before removing show class
                requestAnimationFrame(() => {
                    dbMenu.classList.remove('show');
                });
                
                // Wait for animation to complete before hiding
                setTimeout(() => {
                    if (!dbMenu.classList.contains('show')) {
                        dbMenu.style.display = 'none';
                        dbMenu.classList.remove('closing');
                    }
                }, 400); // Match the animation duration
                
                if (isFormOpen) {
                    updateDbList();
                    isFormOpen = false;
                    updateAddButtonState(false);
                }
            }
        });
        
        // Load current database info
        fetch(`${baseUrl}/api/database`)
            .then(response => response.json())
            .then(config => {
                if (config.database) {
                    const dbSwitchButton = document.getElementById('dbSwitchButton');
                    const currentDb = document.querySelector('.current-db');
                    // Add any necessary logic here
                }
            }); // end initializeDatabaseSwitcher
    }

    initializeDatabaseSwitcher(); // Add this line
    initializePageTitle();

    // Modified swipe-to-toggle functionality
    const buttonsLine = document.querySelector('.table-buttons-line');
    let isMouseDown = false;
    let startButton = null;
    let lastToggledButton = null;
    let initialState = null;
    let processedButtons = new Set();
    let mouseDownTime = 0;
    let startX = 0;
    let startY = 0;
    let hasMoved = false;

    buttonsLine.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        hasMoved = false;
        mouseDownTime = Date.now();
        startX = e.clientX;
        startY = e.clientY;
        
        const targetButton = e.target.closest('.table-button');
        if (targetButton) {
            startButton = targetButton;
            initialState = !targetButton.classList.contains('active');
            if (hasMovedEnough(e)) {
                processAndToggleButton(targetButton);
            }
        }
        
        processedButtons.clear();
        e.preventDefault();
    });

    function hasMovedEnough(e) {
        const moveX = Math.abs(e.clientX - startX);
        const moveY = Math.abs(e.clientY - startY);
        return moveX > 5 || moveY > 5; // 5px threshold for movement
    }

    function processAndToggleButton(button) {
        if (!button || !button.classList.contains('table-button')) return;
        if (!hasMoved) return; // Don't process if it's just a click

        const tableName = button.dataset.table;
        const tableSection = document.querySelector(`.table-section[data-table-name="${tableName}"]`);
        const currentDb = getCurrentDatabaseKey();
        
        if (!processedButtons.has(button)) {
            if (initialState) {
                button.classList.add('active');
                tableSection.style.display = 'block';
                requestAnimationFrame(() => {
                    tableSection.classList.add('visible');
                });
                if (currentDb) {
                    setCookie(`table_${currentDb}_${tableName}`, 'visible', 365);
                }
            } else {
                button.classList.remove('active');
                tableSection.classList.remove('visible');
                tableSection.classList.add('hiding');
                setTimeout(() => {
                    tableSection.classList.remove('hiding');
                    tableSection.style.display = 'none';
                }, 300);
                if (currentDb) {
                    setCookie(`table_${currentDb}_${tableName}`, 'hidden', 365);
                }
            }
            
            processedButtons.add(button);
        }
    }

    buttonsLine.addEventListener('mousemove', (e) => {
        if (!isMouseDown) return;
        
        // Check if movement threshold is met
        if (!hasMoved && hasMovedEnough(e)) {
            hasMoved = true;
            buttonsLine.classList.add('swiping');
        }

        if (!hasMoved) return; // Don't process if movement threshold isn't met
        
        const elementsUnderMouse = document.elementsFromPoint(e.clientX, e.clientY);
        const currentButton = elementsUnderMouse.find(el => el.classList.contains('table-button'));
        
        if (currentButton && initialState === null) {
            initialState = !currentButton.classList.contains('active');
        }
        
        if (currentButton) {
            processAndToggleButton(currentButton);
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (!isMouseDown) return;

        isMouseDown = false;
        startButton = null;
        lastToggledButton = null;
        initialState = null;
        processedButtons.clear();
        buttonsLine.classList.remove('swiping');
        hasMoved = false;
    });

    // Add swipe guide animation
    const guideElement = document.createElement('div');
    guideElement.className = 'swipe-guide';
    document.body.appendChild(guideElement);

    
    // Show guide when hovering over any table button - only once per page load
    let hasShownGuide = false;
    const firstTableButton = document.querySelector('.table-button');
    document.querySelectorAll('.table-button').forEach(button => {
        button.addEventListener('mouseenter', () => {
            const dbMenu = document.getElementById('dbMenu');
            if (!hasShownGuide && firstTableButton && !dbMenu.classList.contains('show')) {
                const buttonRect = firstTableButton.getBoundingClientRect();
                const guide = document.createElement('div');
                guide.className = 'swipe-guide';
                guide.style.top = `${buttonRect.top + (buttonRect.height * 1.3)}px`;
                guide.style.left = `${buttonRect.left + (buttonRect.width * 0.5)}px`;
                document.body.appendChild(guide);
                
                requestAnimationFrame(() => {
                    guide.classList.add('animate');
                });
                
                setTimeout(() => {
                    guide.remove();
                }, 2000);
                
                hasShownGuide = true;
            }
        });
    });

    // Add selection monitoring
    document.addEventListener('selectionchange', handleTextSelection);
    document.addEventListener('mouseup', handleTextSelection);
}); // end DOMContentLoaded

export { toggleTable, updateDropdownOptions, updateStaticLanguageElements, updateDynamicElements, updateConnectionStatus };

function initializePageTitle() {
    const pageTitle = document.getElementById('pageTitle');
    const currentDb = getCurrentDatabaseKey();

    if (currentDb) {
        const savedTitles = JSON.parse(localStorage.getItem('pageTitles') || '{}');
        const savedTitle = savedTitles[currentDb];
        
        if (savedTitle) {
            requestAnimationFrame(() => {
                pageTitle.textContent = savedTitle;
                document.title = savedTitle;
            });
        }
    }
    
    // Add initialized class after checking for saved title
    requestAnimationFrame(() => {
        pageTitle.classList.add('initialized');
    });

    pageTitle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            pageTitle.blur();
        }
    });

    pageTitle.addEventListener('input', () => {
        pageTitle.classList.add('editing');
    });

    pageTitle.addEventListener('blur', () => {
        pageTitle.classList.remove('editing');
        savePageTitle();
    });
}

function savePageTitle() {
    const pageTitle = document.getElementById('pageTitle');
    const currentDb = getCurrentDatabaseKey();
    const titleText = pageTitle.textContent.trim();

    if (currentDb && titleText) {
        const savedTitles = JSON.parse(localStorage.getItem('pageTitles') || '{}');
        savedTitles[currentDb] = titleText;
        localStorage.setItem('pageTitles', JSON.stringify(savedTitles));
        document.title = titleText;
    }
}

function getCurrentDatabaseKey() {
    // Get current database configuration from cookie
    const dbConfigsCookie = getCookie('db_configs');
    const lastUsedDb = getCookie('last_used_db');
    
    if (dbConfigsCookie && lastUsedDb) {
        try {
            const dbConfigs = JSON.parse(decodeURIComponent(dbConfigsCookie));
            return lastUsedDb;
        } catch (e) {
            console.error('Error parsing database configuration:', e);
        }
    }
    return null;
}

// Add text selection state
let isSelectionPaused = false;
let selectionCheckInterval = null;
let monitorWasPausedBeforeSelection = false;

// Add handleTextSelection function
function handleTextSelection() {
    const selection = window.getSelection();
    const hasSelection = selection.toString().length > 0;
    const pauseButton = document.getElementById('pauseButton');
    const tempTooltip = pauseButton.querySelector('.temp-tooltip');
    const defaultTooltip = pauseButton?.querySelector('.default-tooltip');

    // Clear any existing check interval
    if (selectionCheckInterval) {
        clearInterval(selectionCheckInterval);
        selectionCheckInterval = null;
    }
    
    // When text is selected, always pause monitoring
    if (hasSelection && !isSelectionPaused) {
        isSelectionPaused = true;
        monitorWasPausedBeforeSelection = window.isMonitoringPaused; // Store previous state
        if (!window.isMonitoringPaused) {
            toggleMonitoring();
            if (tempTooltip) tempTooltip.style.display = 'block';
            if (defaultTooltip) defaultTooltip.style.display = 'none';
        }
        
        // Start checking selection continuously
        selectionCheckInterval = setInterval(() => {
            const currentSelection = window.getSelection();
            if (currentSelection.toString().length === 0) {
                // Selection is gone
                clearInterval(selectionCheckInterval);
                selectionCheckInterval = null;
                isSelectionPaused = false;
                
                // Check if monitoring was already paused before selection
                if (!monitorWasPausedBeforeSelection) {
                    // Only check for historical data if monitoring wasn't already paused
                    const hasHistoricalData = Object.values(tableChunks).some(chunk => 
                        chunk && chunk.end > 50
                    );
                
                    // Resume monitoring ONLY if no historical data
                    if (!hasHistoricalData) {
                        toggleMonitoring();
                        if (tempTooltip) tempTooltip.style.display = 'none';
                        if (defaultTooltip) defaultTooltip.style.display = '';
                    }
                    // Keep paused if has historical data
                } else {
                    // Hide tooltips
                    if (tempTooltip) tempTooltip.style.display = 'none';
                    if (defaultTooltip) defaultTooltip.style.display = '';
                }
                
                // Reset the stored state
                monitorWasPausedBeforeSelection = false;
            }
        }, 100); // Check every 100ms
    } 
    // This branch handles when we already know selection was removed (direct mouseup without selection)
    else if (!hasSelection && isSelectionPaused && !selectionCheckInterval) {
        isSelectionPaused = false;

        // Check if monitoring was already paused before selection
        if (!monitorWasPausedBeforeSelection) {
            const hasHistoricalData = Object.values(tableChunks).some(chunk => 
                chunk && chunk.end > 50
            );
            
            if (!hasHistoricalData) {
                toggleMonitoring();
            }
        }
        
        // Always clean up tooltips
        if (tempTooltip) tempTooltip.style.display = 'none';
        if (defaultTooltip) defaultTooltip.style.display = '';
        
        // Reset stored state
        monitorWasPausedBeforeSelection = false;
    }
}
