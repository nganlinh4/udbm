import { getTextWidth, t } from './utils.js';
import { adjustColumnWidths } from './table.js';

// Constants
const ROWS_PER_LOAD = 50;
const baseUrl = window.location.origin;

// State management function
function updateMonitoringState(newPausedState) {
    const button = document.getElementById('pauseButton');

    if (newPausedState === isMonitoringPaused) return;

    isMonitoringPaused = newPausedState;
    button.classList.toggle('paused', newPausedState);

    if (newPausedState) {
        if (monitorIntervalId) {
            clearInterval(monitorIntervalId);
            monitorIntervalId = null;
        }
    } else {
        startMonitoring();
    }
    updateClockAnimation();
}

// Using i18next for translations

let currentLang = 'ko'; // Set default language to Korean

// Global variables
let fetchError = false;
let previousData = {};
let tableNames = [];
let tableOffsets = {};
let isLoading = {};
let connectionAttempts = 0;

// Add new global variables for state tracking
let tableChunks = {};  // Store the current chunk range for each table
let tablesWithHistoricalData = new Set(); // Track tables with historical data
let isMonitoringPaused = false; // Track global monitoring state
// [Previous file content continues here, maintaining all existing functionality]
function showError(message) {
    document.getElementById('error-message').innerText = message;
    document.getElementById('error-message').style.display = 'block';
}

function hideError() {
    document.getElementById('error-message').style.display = 'none';
}

function updateTablesIfChanged(newData) {
    Object.keys(newData).forEach(tableName => {
        if (JSON.stringify(newData[tableName]) !== JSON.stringify(previousData[tableName])) {
            updateSingleTable(tableName, newData[tableName]);
        }
    });
    previousData = JSON.parse(JSON.stringify(newData));
}

function updateTableRows(tbody, tableData, columns) {
    // Store current column widths before updating
    const currentWidths = {};
    columns.forEach((col, index) => {
        const cells = tbody.closest('table').querySelectorAll(`td:nth-child(${index + 1})`);
        if (cells.length > 0) {
            currentWidths[col] = cells[0].style.width;
        }
    });

    tbody.innerHTML = ''; // Clear existing rows
    tableData.forEach(row => {
        try {
            const tr = document.createElement('tr');
            columns.forEach((col, index) => {
                const td = document.createElement('td');
                const span = document.createElement('span');  // Create span for text content
                const val = row[col];
                span.textContent = val !== null && val !== undefined ? String(val) : '';
                td.appendChild(span);  // Add span to td
                // Apply stored width to maintain column size
                if (currentWidths[col]) {
                    td.style.width = currentWidths[col];
                    td.style.minWidth = currentWidths[col];
                    td.style.maxWidth = currentWidths[col];
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        } catch (error) {
            console.error('Error creating row:', error, row);
        }
    });
}

function createNewTable(tableDiv, tableData, columns) {
    if (!tableData || !tableData.length) {
        tableDiv.innerHTML = `<p><span class="lang-ko">${t('ui.noData')}</span><span class="lang-en">${t('ui.noData')}</span><span class="lang-vi">${t('ui.noData')}</span></p>`;
        return;
    }

    // Create header wrapper and table
    const headerWrapper = document.createElement('div');
    headerWrapper.className = 'table-header-wrapper';

    const headerTable = document.createElement('table');
    headerTable.className = 'header-table';
    const thead = document.createElement('thead');

    // Create body wrapper and table
    const bodyWrapper = document.createElement('div');
    bodyWrapper.className = 'table-scroll-wrapper';

    const bodyTable = document.createElement('table');
    bodyTable.className = 'body-table';
    const tbody = document.createElement('tbody');

    const headerRow = document.createElement('tr');
    columns.forEach(col => {
        const th = document.createElement('th');
        // Create span for text content
        const span = document.createElement('span');
        span.textContent = col;
        th.appendChild(span);

        // Add resizer
        const resizer = document.createElement('div');
        resizer.className = 'resizer';
        th.appendChild(resizer);

        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    headerTable.appendChild(thead);
    headerWrapper.appendChild(headerTable);

    bodyTable.appendChild(tbody);
    bodyWrapper.appendChild(bodyTable);

    updateTableRows(tbody, tableData, columns);

    tableDiv.innerHTML = '';
    tableDiv.appendChild(headerWrapper);
    tableDiv.appendChild(bodyWrapper);

    // Synchronize table widths and column alignment
    setTimeout(() => {
        // Make both tables have exactly the same width
        const bodyTableWidth = bodyTable.scrollWidth; // Total width including overflow
        headerTable.style.width = `${bodyTableWidth}px`;
        bodyTable.style.width = `${bodyTableWidth}px`;

        // Synchronize column widths - force header cells to match body cell widths exactly
        const headerCells = headerTable.querySelectorAll('th');
        const bodyRows = bodyTable.querySelectorAll('tbody tr');
        if (bodyRows.length > 0) {
            const bodyCells = bodyRows[0].querySelectorAll('td');
            headerCells.forEach((th, index) => {
                if (bodyCells[index]) {
                    // Get the header content area width (this is what we want to match)
                    const headerContent = th.querySelector('.header-content');
                    const headerContentWidth = headerContent ? headerContent.offsetWidth : th.offsetWidth;

                    // Calculate the actual box model differences between header and body
                    const headerComputedStyle = getComputedStyle(th);
                    const bodyComputedStyle = getComputedStyle(bodyCells[index]);

                    // Get header content actual dimensions
                    const headerPaddingLeft = parseFloat(headerComputedStyle.paddingLeft) || 0;
                    const headerPaddingRight = parseFloat(headerComputedStyle.paddingRight) || 0;
                    const headerBorderLeft = parseFloat(headerComputedStyle.borderLeftWidth) || 0;
                    const headerBorderRight = parseFloat(headerComputedStyle.borderRightWidth) || 0;
                    const headerBoxOverhead = headerPaddingLeft + headerPaddingRight + headerBorderLeft + headerBorderRight;

                    // Get body cell box model
                    const bodyPaddingLeft = parseFloat(bodyComputedStyle.paddingLeft) || 0;
                    const bodyPaddingRight = parseFloat(bodyComputedStyle.paddingRight) || 0;
                    const bodyBorderLeft = parseFloat(bodyComputedStyle.borderLeftWidth) || 0;
                    const bodyBorderRight = parseFloat(bodyComputedStyle.borderRightWidth) || 0;
                    const bodyBoxOverhead = bodyPaddingLeft + bodyPaddingRight + bodyBorderLeft + bodyBorderRight;

                    // Calculate the target: header content width adjusted for box model differences
                    // We want: body.offsetWidth = header.contentWidth
                    // So: body.styleWidth + body.boxOverhead = header.contentWidth
                    // Therefore: body.styleWidth = header.contentWidth - body.boxOverhead
                    const targetBodyStyleWidth = headerContentWidth - bodyBoxOverhead;

                    // Set body cells to match header content area
                    bodyCells[index].style.width = `${targetBodyStyleWidth}px`;
                    bodyCells[index].style.minWidth = `${targetBodyStyleWidth}px`;
                    bodyCells[index].style.maxWidth = `${targetBodyStyleWidth}px`;

                    // Apply to all body cells in this column
                    bodyTable.querySelectorAll(`td:nth-child(${index + 1})`).forEach(td => {
                        td.style.width = `${targetBodyStyleWidth}px`;
                        td.style.minWidth = `${targetBodyStyleWidth}px`;
                        td.style.maxWidth = `${targetBodyStyleWidth}px`;
                    });

                    // Keep header cell as is (don't change its width)
                    // The header already has the right width including buttons
                }
            });
        }

        // Ensure both tables have the same width accounting for scrollbar
        const bodyWrapperScrollbarWidth = bodyWrapper.offsetWidth - bodyWrapper.clientWidth;
        const bodyTableTargetWidth = bodyWrapper.clientWidth; // Available width without scrollbar

        // Set both tables to the same width (the available content width)
        headerTable.style.width = `${bodyTableTargetWidth}px`;
        bodyTable.style.width = `${bodyTableTargetWidth}px`;
    }, 100);

    // Add resizer event listeners
    addResizerListeners(headerTable, bodyTable, columns);

    bodyWrapper.addEventListener('scroll', function() {
        // Simple scroll synchronization
        headerWrapper.scrollLeft = this.scrollLeft;
        const tableName = tableDiv.id;
        const bottomOffset = 50;
        const isAtBottom = this.scrollHeight - (this.scrollTop + this.clientHeight) < bottomOffset;
        const isAtTop = this.scrollTop === 0;

        // Load more data when reaching bottom
        if (isAtBottom && !isLoading[tableName] && tableChunks[tableName]) {
            // Always fetch more data at bottom, historical state is managed in fetchTableData
            fetchTableData(tableName, true);
        }

        // Handle return to top - clear historical state and resume monitoring
        if (isAtTop && tablesWithHistoricalData.has(tableName)) {
            // Check if filters are active for this table
            const hasActiveFilters = typeof tableFilters !== 'undefined' &&
                                   tableFilters.has(tableName) &&
                                   Object.keys(tableFilters.get(tableName) || {}).length > 0;

            // Reset the table's data when returning to top (only if no filters)
            if (!hasActiveFilters) {
                tableChunks[tableName] = {
                    start: 0,
                    end: ROWS_PER_LOAD,
                    isHistorical: false
                };
                tablesWithHistoricalData.delete(tableName);
                fetchTableData(tableName, false);

                // Resume monitoring if no tables have historical data and no filters
                if (tablesWithHistoricalData.size === 0 && isMonitoringPaused) {
                    updateMonitoringState(false);
                }
            }
        }
    });
}

// Function to add resizer event listeners
function addResizerListeners(headerTable, bodyTable, columns) {
    const thElements = headerTable.querySelectorAll('th');
    thElements.forEach((th, index) => {
        const resizer = th.querySelector('.resizer');
        let startX, startWidth;
        let currentWidth;

        // Initialize column width if not already set
        const initialWidth = th.offsetWidth;
        th.style.width = `${initialWidth}px`;
        th.style.minWidth = `${initialWidth}px`;

        // Apply initial width to all cells in the body table column
        bodyTable.querySelectorAll(`td:nth-child(${index + 1})`).forEach(td => {
            td.style.width = `${initialWidth}px`;
            td.style.minWidth = `${initialWidth}px`;
            td.style.maxWidth = `${initialWidth}px`;
        });

        function onMouseMove(e) {
            if (!startX) return;
            const deltaX = e.pageX - startX;
            currentWidth = Math.max(30, startWidth + deltaX); // Minimum 30px width
            th.style.width = `${currentWidth}px`;
            th.style.minWidth = `${currentWidth}px`;

            // Update all cells in this column in the body table
            const cells = bodyTable.querySelectorAll(`td:nth-child(${index + 1})`);
            cells.forEach(cell => {
                cell.style.width = `${currentWidth}px`;
                cell.style.minWidth = `${currentWidth}px`;
                cell.style.maxWidth = `${currentWidth}px`;
            });

            // Synchronize table widths after column resize
            const headerTable = th.closest('.header-table');
            const bodyWrapper = bodyTable.closest('.table-scroll-wrapper');
            if (headerTable && bodyWrapper) {
                setTimeout(() => {
                    const bodyTableTargetWidth = bodyWrapper.clientWidth; // Available width without scrollbar
                    headerTable.style.width = `${bodyTableTargetWidth}px`;
                    bodyTable.style.width = `${bodyTableTargetWidth}px`;
                }, 0);
            }
        }

        function onMouseUp() {
            if (!currentWidth) return;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';

            // Save the final width
            const widths = getSavedColumnWidths(headerTable);
            widths[columns[index]] = currentWidth;
            saveColumnWidths(headerTable, widths);

            startX = null;
            currentWidth = null;
        }

        resizer.addEventListener('mousedown', function(e) {
            startX = e.pageX;
            startWidth = th.offsetWidth;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            document.body.style.cursor = 'col-resize';
            e.preventDefault(); // Prevent text selection
        });

        // Touch support
        resizer.addEventListener('touchstart', function(e) {
            const touch = e.touches[0];
            startX = touch.pageX;
            startWidth = th.offsetWidth;
            document.addEventListener('touchmove', onTouchMove);
            document.addEventListener('touchend', onTouchEnd);
            e.preventDefault();
        });

        function onTouchMove(e) {
            const touch = e.touches[0];
            onMouseMove({ pageX: touch.pageX });
        }

        function onTouchEnd() {
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
            onMouseUp();
        }
    });
}

// Function to save column widths to cookie
function saveColumnWidths(table, widths) {
    const tableName = table.closest('.table-container').id;
    const cookieName = `table_${tableName}_widths`;
    const cookieValue = JSON.stringify(widths);
    setCookie(cookieName, cookieValue, 365);
}

// Function to get saved column widths from cookie
function getSavedColumnWidths(table) {
    const tableName = table.closest('.table-container').id;
    const cookieName = `table_${tableName}_widths`;
    const widths = getCookie(cookieName);
    return widths ? JSON.parse(widths) : {};
}

// Function to apply saved column widths
function applySavedColumnWidths(headerTable, bodyTable, columns) {
    const widths = getSavedColumnWidths(headerTable);
    const thElements = headerTable.querySelectorAll('th');
    thElements.forEach((th, index) => {
        const colName = columns[index];
        if (widths[colName]) {
            const width = widths[colName];
            th.style.width = `${width}px`;
            th.style.minWidth = `${width}px`;

            // Update all cells in this column in the body table
            bodyTable.querySelectorAll(`td:nth-child(${index + 1})`).forEach(td => {
                td.style.width = `${width}px`;
                td.style.minWidth = `${width}px`;
                td.style.maxWidth = `${width}px`;
            });
        }
    });
}

function updateSingleTable(tableName, tableInfo) {
    const tableDiv = document.getElementById(tableName);
    if (tableDiv) {
        const countSpan = document.getElementById(`${tableName}_count`);
        if (countSpan) {
            countSpan.textContent = `(${tableInfo.count} ${t('ui.rows')})`;
        }

        const limitedInfoSpan = document.getElementById(`${tableName}_limited_info`);
        if (limitedInfoSpan) {
            if (tableInfo.limited) {
                limitedInfoSpan.innerHTML = `<span class="lang-ko">${t('ui.scrollMore')}</span><span class="lang-en">${t('ui.scrollMore')}</span><span class="lang-vi">${t('ui.scrollMore')}</span>`;
                // Small delay to ensure the text is set before animation
                requestAnimationFrame(() => {
                    limitedInfoSpan.classList.add('visible');
                });
            } else {
                limitedInfoSpan.innerHTML = `<span class="lang-ko">${t('ui.allDataLoaded')}</span><span class="lang-en">${t('ui.allDataLoaded')}</span><span class="lang-vi">${t('ui.allDataLoaded')}</span>`;
                requestAnimationFrame(() => {
                    limitedInfoSpan.classList.add('visible');
                });
            }
        }

        if (tableInfo.data && tableInfo.data.length) {
            let existingBodyTable = tableDiv.querySelector('.body-table');
            if (existingBodyTable) {
                const tbody = existingBodyTable.querySelector('tbody');
                if (tbody) {
                    updateTableRows(tbody, tableInfo.data, tableInfo.columns);
                }
            } else {
                createNewTable(tableDiv, tableInfo.data, tableInfo.columns);
                existingBodyTable = tableDiv.querySelector('.body-table');
            }

            // Preserve current column widths during monitoring updates
            if (existingBodyTable) {
                const headerTable = tableDiv.querySelector('.header-table');
                if (headerTable) {
                    // Only apply saved widths if the table doesn't have explicit widths set
                    const firstTh = headerTable.querySelector('th');
                    if (!firstTh || !firstTh.style.width) {
                        applySavedColumnWidths(headerTable, existingBodyTable, tableInfo.columns);
                    }
                    // If widths are already set, don't change them during monitoring updates
                }
            }

            tableDiv.classList.add('initialized');
        } else {
            tableDiv.innerHTML = `<p><span class="lang-ko">${t('ui.noData')}</span><span class="lang-en">${t('ui.noData')}</span><span class="lang-vi">${t('ui.noData')}</span></p>`;
        }

        // Use double requestAnimationFrame for smoother animation
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                tableDiv.classList.add('expanded');
            });
        });
    }
}

function updateConnectionStatus() {
    const status = document.getElementById('connection-status');
    const isConnected = status.classList.contains('connected');

    status.className = `connection-status ${isConnected ? 'connected' : 'disconnected'}`;
    status.innerHTML = `
        <span class="lang-ko" style="display: ${currentLang === 'ko' ? 'inline' : 'none'}">
            ${isConnected ? t('connection.connected') : `${t('connection.disconnected')} ${t('connection.attemptPrefix')}${connectionAttempts}${t('connection.attemptSuffix')}`}
        </span>
        <span class="lang-en" style="display: ${currentLang === 'en' ? 'inline' : 'none'}">
            ${isConnected ? t('connection.connected') : `${t('connection.disconnected')} ${t('connection.attemptPrefix')}${connectionAttempts}${t('connection.attemptSuffix')}`}
        </span>
        <span class="lang-vi" style="display: ${currentLang === 'vi' ? 'inline' : 'none'}">
            ${isConnected ? t('connection.connected') : `${t('connection.disconnected')} ${t('connection.attemptPrefix')}${connectionAttempts}${t('connection.attemptSuffix')}`}
        </span>
    `;
}

// Modify checkConnection function to use async/await for better error handling
async function checkConnection() {
    try {
        const response = await fetch(baseUrl, {
            method: 'GET',
            headers: {
                'Accept': 'text/html',
                'Cache-Control': 'no-cache'
            },
        });

        if (response.ok) {
            connectionAttempts = 0;
            const status = document.getElementById('connection-status');
            status.className = 'connection-status connected';
            updateConnectionStatus();
        } else {
            throw new Error('Connection failed');
        }
    } catch (error) {
        connectionAttempts++;
        const status = document.getElementById('connection-status');
        status.className = 'connection-status disconnected';
        updateConnectionStatus();
    }
}

function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/`;
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// Modify fetchTableData function
function fetchTableData(tableName, append = false) {
    const tableDiv = document.getElementById(tableName);
    if (isLoading[tableName]) return Promise.resolve();
    isLoading[tableName] = true;

    // Initialize or get current chunk info
    if (!tableChunks[tableName]) {
        tableChunks[tableName] = {
            start: 0,
            end: ROWS_PER_LOAD
        };
    }

    const offset = append ? tableChunks[tableName].end : tableChunks[tableName].start;

    // Build URL with filter parameters if filters are active
    const filterParams = new URLSearchParams();
    filterParams.append('limit', ROWS_PER_LOAD.toString());
    filterParams.append('offset', offset.toString());

    // Get active filters for this table (if tableFilters is available from table.js)
    if (typeof tableFilters !== 'undefined') {
        const allFilters = tableFilters.get(tableName) || {};
        Object.entries(allFilters).forEach(([columnName, selectedValues]) => {
            if (columnName && selectedValues.length > 0) {
                filterParams.append(`filter_${columnName}`, selectedValues.join(','));
            }
        });
    }

    // Get active sort for this table (if tableSorts is available from table.js)
    if (typeof tableSorts !== 'undefined') {
        const sortState = tableSorts.get(tableName) || { column: null, direction: null };
        if (sortState.column) {
            filterParams.append('sort_column', sortState.column);
            filterParams.append('sort_direction', sortState.direction);
        }
    }

    const url = `${baseUrl}/data/${tableName}?${filterParams.toString()}`;

    return fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
        },
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        hideError();
        if (append) {
            appendTableData(tableName, data);

            // Update chunk range
            const newEnd = tableChunks[tableName].end + data.data.length;
            tableChunks[tableName].end = newEnd;

            // Mark as historical data after first chunk
            if (newEnd > ROWS_PER_LOAD && !tableChunks[tableName].isHistorical) {
                tableChunks[tableName].isHistorical = true;
                if (!tablesWithHistoricalData.has(tableName)) {
                    tablesWithHistoricalData.add(tableName);
                    // Auto-pause monitoring when first historical data is loaded
                    if (tablesWithHistoricalData.size === 1) {
                        updateMonitoringState(true);
                    }
                }
            }
        } else {
            updateSingleTable(tableName, data);
            // Reset chunk tracking
            tableChunks[tableName] = {
                start: 0,
                end: data.data.length,
                isHistorical: false
            };
            // Clear historical state for this table
            tablesWithHistoricalData.delete(tableName);
            // Resume monitoring if no other tables have historical data
            if (tablesWithHistoricalData.size === 0 && isMonitoringPaused) {
                updateMonitoringState(false);
            }
        }
        isLoading[tableName] = false;
        updateStaticLanguageElements();
    })
    .catch(error => {
        console.error('Error fetching table data:', error);
        showError(`Failed to fetch data for ${tableName}.`);
        isLoading[tableName] = false;
    });
}

function appendTableData(tableName, tableInfo) {
    const tableDiv = document.getElementById(tableName);
    const existingTable = tableDiv.querySelector('table');
    const tbody = existingTable ? existingTable.querySelector('tbody') : null;

    if (tbody && Array.isArray(tableInfo.data)) {
        tableInfo.data.forEach(row => {
            const tr = document.createElement('tr');
            tableInfo.columns.forEach(col => {
                const td = document.createElement('td');
                const val = row[col];
                td.textContent = val !== null ? String(val) : '';
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    const countSpan = document.getElementById(`${tableName}_count`);
    countSpan.textContent = `(${tableInfo.count} ${t('ui.rows')})`;

    const limitedInfoSpan = document.getElementById(`${tableName}_limited_info`);
    if (tableInfo.limited) {
        limitedInfoSpan.innerHTML = `<span class="lang-ko">${t('ui.scrollMore')}</span><span class="lang-en">${t('ui.scrollMore')}</span><span class="lang-vi">${t('ui.scrollMore')}</span>`;
        limitedInfoSpan.classList.add('visible');
    } else {
        limitedInfoSpan.innerHTML = `<span class="lang-ko">${t('ui.allDataLoaded')}</span><span class="lang-en">${t('ui.allDataLoaded')}</span><span class="lang-vi">${t('ui.allDataLoaded')}</span>`;
        limitedInfoSpan.classList.add('visible');
    }
}

// Modify the fetchTableCount function to prevent interference with sort state
function fetchTableCount(tableName) {
    const url = `${baseUrl}/data/${tableName}?limit=0&offset=0`;
    fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/json', // Ensure JSON response
            'Cache-Control': 'no-cache'
        },
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        const countSpan = document.getElementById(`${tableName}_count`);
        if (data.count !== undefined) {
            countSpan.textContent = `(${data.count} ${t('ui.rows')})`;
        } else {
            countSpan.textContent = `(0 ${t('ui.rows')})`;
        }
    })
    .catch(error => {
        console.error(`Error fetching count for ${tableName}:`, error);
        const countSpan = document.getElementById(`${tableName}_count`);
        countSpan.textContent = `(Error)`;
    });
}

function loadTableStates() {
    const tableElements = document.querySelectorAll('.table-container');
    tableNames = Array.from(tableElements).map(el => el.id);

    tableNames.forEach(tableName => {
        const container = document.getElementById(tableName);
        const button = container.previousElementSibling.querySelector('.toggle-button');
        const limitedInfoSpan = document.getElementById(`${tableName}_limited_info`);

        // Load the expand/collapse state from cookies
        const state = getCookie(`table_${tableName}`);
        if (state === 'visible') {
            // Show the table
            container.classList.remove('hidden-table');
            button.classList.remove('show');
            button.classList.add('hide');
            updateToggleButtonText(button, false);
            limitedInfoSpan.textContent = '';
            limitedInfoSpan.classList.remove('visible');

            // Apply theme class to the button
            const themeClass = container.className.match(/theme-\d+/)[0];
            button.classList.add(themeClass);

            container.classList.add('initialized');

            // Fetch table data
            fetchTableData(tableName, false);
        } else {
            // Hide the table
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
        }

        // Fetch table count always
        fetchTableCount(tableName);
    });

    document.body.classList.add('loaded');
}

function saveTableOrder() {
    const tableOrder = Array.from(document.querySelectorAll('.table-section'))
        .map(section => section.dataset.tableName);
    setCookie('tableOrder', JSON.stringify(tableOrder), 365);
}

function loadTableOrder() {
    const orderCookie = getCookie('tableOrder');
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

// Keep pill buttons order in sync with section order
function syncPillsToSections() {
    const container = document.getElementById('tables-container');
    const buttonsLine = document.querySelector('.table-buttons-line');
    if (!container || !buttonsLine) return;
    const order = Array.from(container.querySelectorAll('.table-section'))
        .map(section => section.dataset.tableName);
    order.forEach((tableName) => {
        const pill = buttonsLine.querySelector(`.table-button[data-table="${tableName}"]`);
        if (pill) buttonsLine.appendChild(pill);
    });
}


document.addEventListener('DOMContentLoaded', () => {
    // Initialize connection status as connected by default
    const status = document.getElementById('connection-status');
    status.className = 'connection-status connected';
    updateConnectionStatus();

    loadTableStates();
    checkConnection();

    new Sortable(document.getElementById('tables-container'), {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        onEnd: function() {
            saveTableOrder();
            // Keep pills in the same order as sections after manual drag
            syncPillsToSections();
        }
    });

    // Enable dragging the pill buttons themselves and sync section order
    const buttonsLine = document.querySelector('.table-buttons-line');
    if (buttonsLine) {
        new Sortable(buttonsLine, {
            animation: 150,
            draggable: '.table-button',
            filter: '.arrangement-mode',
            direction: 'horizontal',
            forceFallback: true,
            fallbackOnBody: true,
            fallbackTolerance: 5,
            swapThreshold: 0.5,
            invertSwap: true,
            bubbleScroll: true,
            onStart: function () { window.__pillDragActive = true; },
            onEnd: function () {
                const order = Array.from(buttonsLine.querySelectorAll('.table-button'))
                    .map(btn => btn.dataset.table);
                const container = document.getElementById('tables-container');
                if (container) {
                    order.forEach((tableName) => {
                        const section = container.querySelector(`.table-section[data-table-name="${tableName}"]`);
                        if (section) container.appendChild(section);
                    });
                }
                saveTableOrder();
                window.__pillDragActive = false;
            }
        });
    }


    loadTableOrder();

    // Set Korean as default and remove language switching functionality
    currentLang = 'ko';
    updateLanguage();

    // Replace the language switcher handler with this new version
    const languageToggle = document.getElementById('languageToggle');
    const languageLabels = document.querySelectorAll('.switch-label');

    // Set initial state based on saved language
    languageToggle.selected = currentLang === 'en';

    languageToggle.addEventListener('change', () => {
        const newLang = languageToggle.selected ? 'en' : 'ko';
        if (newLang !== currentLang) {
            // Update active states
            languageLabels.forEach(label => {
                label.classList.toggle('language-active', label.dataset.lang === newLang);
                label.classList.toggle('language-inactive', label.dataset.lang !== newLang);
            });

            // Update language and trigger changes
            currentLang = newLang;
            setCookie('preferred_language', currentLang, 365);
            updateLanguage();
        }
    });

    // Load preferred language from cookie
    const savedLang = getCookie('preferred_language');
    if (savedLang) {
        currentLang = savedLang;
        languageToggle.checked = currentLang === 'en';
        languageLabels.forEach(label => {
            label.classList.toggle('language-active', label.dataset.lang === currentLang);
            label.classList.toggle('language-inactive', label.dataset.lang !== currentLang);
        });
        updateLanguage();
    }

    // Add dropdown initialization
    const dropdown = document.getElementById('monitorDropdown');
    const warningPopup = document.getElementById('warningPopup');
    let warningTimeout;

    function updateDropdownDangerState(milliseconds) {
        if (milliseconds < 500) {
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

        if (milliseconds < 2000) {  // Changed from 500 to 2000
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
        monitorInterval = 10000;
        setCookie('monitor_interval', monitorInterval, 365);
    }

    // Always set both the dropdown value and the actual interval to 10000ms
    dropdown.value = '10000';
    monitorInterval = 10000;

    // Initialize danger class based on current value
    updateDropdownDangerState(monitorInterval);

    // Restart monitoring with new interval
    startMonitoring();
    updateClockAnimation();

    // Add pause button handler
    const pauseButton = document.getElementById('pauseButton');
    pauseButton.addEventListener('click', toggleMonitoring);

    // Add theme toggle handler
    const themeToggle = document.getElementById('themeToggle');

    // Load saved theme preference
    const savedTheme = document.documentElement.getAttribute('data-theme');
    themeToggle.selected = savedTheme === 'dark';
    isDarkMode = savedTheme === 'dark';

    themeToggle.addEventListener('change', () => {
        isDarkMode = themeToggle.selected;
        document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
        setCookie('preferred_theme', isDarkMode ? 'dark' : 'light', 365);
    });

    // Initialize admin toggle state
    const adminToggle = document.getElementById('adminToggle');
    if (adminToggle) {
        // Load saved state from localStorage
        const savedAdminState = localStorage.getItem('adminToggleState');

        // Set the switch state based on saved value
        adminToggle.selected = savedAdminState === 'true';

        // Update body class to match the toggle state
        document.body.classList.toggle('admin-mode', adminToggle.selected);

        adminToggle.addEventListener('change', () => {
            // Save the current state to localStorage
            localStorage.setItem('adminToggleState', adminToggle.selected.toString());

            // Update body class when toggle changes
            document.body.classList.toggle('admin-mode', adminToggle.selected);
        });
    }

    startMonitoring();
    updateClockAnimation();
});

function toggleTable(tableName) {
    const container = document.getElementById(tableName);
    const button = container.previousElementSibling.querySelector('.toggle-button');
    const limitedInfoSpan = document.getElementById(`${tableName}_limited_info`);

    // Add transition class before toggling
    container.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

    const isHidden = container.classList.toggle('hidden-table');

    // Clear historical data tracking when collapsing
    if (isHidden) {
        if (limitedInfoSpan) {
            limitedInfoSpan.innerHTML = '';
            limitedInfoSpan.classList.remove('visible');
        }
        tablesWithHistoricalData.delete(tableName);

        // Resume monitoring if no tables have historical data
        if (tablesWithHistoricalData.size === 0 && isMonitoringPaused) {
            updateMonitoringState(false);
        }
    }

    updateToggleButtonText(button, isHidden);
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

    setCookie(`table_${tableName}`, isHidden ? 'hidden' : 'visible', 365);

    if (isHidden) {
        // Reset chunk tracking when hiding table
        tableChunks[tableName] = {
            start: 0,
            end: ROWS_PER_LOAD,
            isHistorical: false
        };
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
            end: ROWS_PER_LOAD
        };

        // Fetch table data before revealing the table
        fetchTableData(tableName, false).then(() => {
            // Removed adjustColumnWidths call - it interferes with our alignment
            // const tableDiv = document.getElementById(tableName);
            // const tableElement = tableDiv.querySelector('table');
            // if (tableElement) {
            //     adjustColumnWidths(tableElement);
            // }
            // Proceed to reveal the table
            requestAnimationFrame(() => {
                container.classList.add('expanded');
            });
        });
    }
}



// Add new function to update language display
function updateLanguage() {
    // Clear any pending timeouts
    if (window.languageUpdateTimeout) {
        clearTimeout(window.languageUpdateTimeout);
    }

    // First update all language elements immediately
    updateStaticLanguageElements();
    updateConnectionStatus();

    // Use a single RAF call for all dynamic updates
    requestAnimationFrame(() => {
        updateDynamicElements();
    });

    // The dropdown options will be handled by CSS based on data-lang attribute
    // No need to set inline styles

    // Update dropdown options with correct unit
    updateDropdownOptions();
}

function updateStaticLanguageElements() {
    // Simply ensure the data-lang attribute is set correctly
    // CSS will handle the visibility based on this attribute
    document.documentElement.setAttribute('data-lang', currentLang);
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
        span.innerHTML = `<span class="lang-${currentLang}" style="display: inline">${text}</span>`;
    });

    // Update empty table messages
    document.querySelectorAll('.table-container p').forEach(p => {
        if (p.textContent.includes('No data') || p.textContent.includes('데이터가') || p.textContent.includes('Không có')) {
            p.innerHTML = `<span class="lang-${currentLang}" style="display: inline">${t('ui.noData')}</span>`;
        }
    });
}

// Modify existing functions to use translations
function updateConnectionStatus() {
    const status = document.getElementById('connection-status');
    const isConnected = status.classList.contains('connected');

    status.className = `connection-status ${isConnected ? 'connected' : 'disconnected'}`;
    status.innerHTML = `
        <span class="lang-ko" style="display: ${currentLang === 'ko' ? 'inline' : 'none'}">
            ${isConnected ? t('connection.connected') : `${t('connection.disconnected')} ${t('connection.attemptPrefix')}${connectionAttempts}${t('connection.attemptSuffix')}`}
        </span>
        <span class="lang-en" style="display: ${currentLang === 'en' ? 'inline' : 'none'}">
            ${isConnected ? t('connection.connected') : `${t('connection.disconnected')} ${t('connection.attemptPrefix')}${connectionAttempts}${t('connection.attemptSuffix')}`}
        </span>
        <span class="lang-vi" style="display: ${currentLang === 'vi' ? 'inline' : 'none'}">
            ${isConnected ? t('connection.connected') : `${t('connection.disconnected')} ${t('connection.attemptPrefix')}${connectionAttempts}${t('connection.attemptSuffix')}`}
        </span>
    `;
}

function updateTableButtons() {
    // Update the toggle buttons to use translations
    const buttons = document.querySelectorAll('.toggle-button');
    buttons.forEach(button => {
        const isHidden = button.closest('.table-section').querySelector('.table-container').classList.contains('hidden-table');
        button.innerHTML = `
            <span class="lang-ko">${isHidden ? t('ui.show') : t('ui.hide')}</span>
            <span class="lang-en">${isHidden ? t('ui.show') : t('ui.hide')}</span>
            <span class="lang-vi">${isHidden ? t('ui.show') : t('ui.hide')}</span>
        `;
    });
    updateLanguage();
}

// Update the limited info text with translations
function updateLimitedInfo(tableName, isLimited) {
    const limitedInfoSpan = document.getElementById(`${tableName}_limited_info`);
    if (limitedInfoSpan) {
        const text = isLimited ? t('ui.scrollMore') : t('ui.allDataLoaded');
        limitedInfoSpan.innerHTML = `<span class="lang-${currentLang}">${text}</span>`;
    }
}

// Add new helper function for button text updates
function updateToggleButtonText(button, isHidden) {
    button.innerHTML = `
        <span class="lang-ko" style="display: ${currentLang === 'ko' ? 'inline' : 'none'}">${isHidden ? t('ui.show') : t('ui.hide')}</span>
        <span class="lang-en" style="display: ${currentLang === 'en' ? 'inline' : 'none'}">${isHidden ? t('ui.show') : t('ui.hide')}</span>
        <span class="lang-vi" style="display: ${currentLang === 'vi' ? 'inline' : 'none'}">${isHidden ? t('ui.show') : t('ui.hide')}</span>
    `;
}

// Modify the startMonitoring function
function startMonitoring() {
    if (monitorIntervalId) {
        clearInterval(monitorIntervalId);
    }

    if (isMonitoringPaused) return;

    monitorIntervalId = setInterval(() => {
        const currentLanguageState = currentLang;

        // First check connection
        checkConnection();

        // Then update tables
        tableNames.forEach(tableName => {
            const container = document.getElementById(tableName);
            if (!container.classList.contains('hidden-table') && tableChunks[tableName]) {
                const offset = tableChunks[tableName].start;
                const limit = tableChunks[tableName].end - tableChunks[tableName].start;

                // Build URL with filter parameters if filters are active
                const filterParams = new URLSearchParams();
                filterParams.append('limit', limit.toString());
                filterParams.append('offset', offset.toString());

                // Get active filters for this table (if tableFilters is available from table.js)
                if (typeof tableFilters !== 'undefined') {
                    const allFilters = tableFilters.get(tableName) || {};
                    Object.entries(allFilters).forEach(([columnName, selectedValues]) => {
                        if (columnName && selectedValues.length > 0) {
                            filterParams.append(`filter_${columnName}`, selectedValues.join(','));
                        }
                    });
                }

                // Get active sort for this table (if tableSorts is available from table.js)
                if (typeof tableSorts !== 'undefined') {
                    const sortState = tableSorts.get(tableName) || { column: null, direction: null };
                    if (sortState.column) {
                        filterParams.append('sort_column', sortState.column);
                        filterParams.append('sort_direction', sortState.direction);
                    }
                }

                const url = `${baseUrl}/data/${tableName}?${filterParams.toString()}`;

                if (!isLoading[tableName]) {
                    fetch(url, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'Cache-Control': 'no-cache'
                        },
                    })
                    .then(response => response.json())
                    .then(data => {
                        currentLang = currentLanguageState;
                        updateSingleTable(tableName, data);
                        updateStaticLanguageElements();
                        updateDynamicElements();
                    })
                    .catch(error => console.error('Error in periodic update:', error));
                }
            } else {
                fetchTableCount(tableName);
            }
        });
    }, monitorInterval);
    updateClockAnimation();
}

// Add new function to handle pause/resume
function toggleMonitoring() {
    const wasMonitoringPaused = isMonitoringPaused;

    if (isMonitoringPaused) {
        // If paused and has historical data, clear it before resuming
        if (tablesWithHistoricalData.size > 0) {
            const tablesToRefresh = Array.from(tablesWithHistoricalData);
            tablesWithHistoricalData.clear();

            // Reset each table that had historical data
            tablesToRefresh.forEach(tableName => {
                const container = document.getElementById(tableName);
                if (container && !container.classList.contains('hidden-table')) {
                    // Reset chunk state and data
                    tableChunks[tableName] = {
                        start: 0,
                        end: ROWS_PER_LOAD,
                        isHistorical: false
                    };
                    // Fetch fresh data to reset view
                    fetchTableData(tableName, false);
                }
            });
        }
        updateMonitoringState(false);
    } else {
        updateMonitoringState(true);
    }
}

// Add new function to snap slider value to predefined steps
function snapToStep(value) {
    const steps = [500, 600, 700, 800, 900, 1000,
                   1250, 1500, 1750, 2000, 3000, 4000, 5000,
                   7500, 10000, 20000, 60000];

    return steps.reduce((prev, curr) => {
        return Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev;
    });
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

function updateClockAnimation() {
    const clockHand = document.querySelector('.clock-hand');
    const clockIcon = document.querySelector('.clock-icon');
    if (clockHand) {
        clockHand.style.animationDuration = `${monitorInterval / 1000}s`;
        clockHand.style.animationPlayState = isMonitoringPaused ? 'paused' : 'running';

        // Remove previous event listeners to prevent duplicates
        clockHand.removeEventListener('animationiteration', handleClockEffect);

        // Add event listener for when the hand completes a full rotation
        clockHand.addEventListener('animationiteration', handleClockEffect);

    // Enable dragging the pill buttons themselves and sync section order
    const buttonsLine2 = document.querySelector('.table-buttons-line');
    if (buttonsLine2) {
        new Sortable(buttonsLine2, {
            animation: 150,
            draggable: '.table-button',
            filter: '.arrangement-mode',
            direction: 'horizontal',
            forceFallback: true,
            fallbackOnBody: true,
            fallbackTolerance: 5,
            swapThreshold: 0.5,
            invertSwap: true,
            bubbleScroll: true,
            onStart: function () { window.__pillDragActive = true; },
            onEnd: function () {
                const order = Array.from(buttonsLine2.querySelectorAll('.table-button'))
                    .map(btn => btn.dataset.table);
                const container = document.getElementById('tables-container');
                if (container) {
                    order.forEach((tableName) => {
                        const section = container.querySelector(`.table-section[data-table-name="${tableName}"]`);
                        if (section) container.appendChild(section);
                    });
                }
                saveTableOrder();
                window.__pillDragActive = false;
            }
        });
    }

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

document.addEventListener('DOMContentLoaded', () => {
    loadTableStates();
    checkConnection();

    new Sortable(document.getElementById('tables-container'), {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        onEnd: function() {
            saveTableOrder();
            // Keep pills in the same order as sections after manual drag
            syncPillsToSections();
        }
    });

    loadTableOrder();

    // Set Korean as default and remove language switching functionality
    currentLang = 'ko';
    updateLanguage();

    // Replace the language switcher handler with this new version
    const languageToggle = document.getElementById('languageToggle');
    const languageLabels = document.querySelectorAll('.switch-label');

    // Set initial state based on saved language
    languageToggle.selected = currentLang === 'en';

    languageToggle.addEventListener('change', () => {
        const newLang = languageToggle.selected ? 'en' : 'ko';
        if (newLang !== currentLang) {
            // Update active states
            languageLabels.forEach(label => {
                label.classList.toggle('language-active', label.dataset.lang === newLang);
                label.classList.toggle('language-inactive', label.dataset.lang !== newLang);
            });

            // Update language and trigger changes
            currentLang = newLang;
            setCookie('preferred_language', currentLang, 365);
            updateLanguage();
        }
    });

    // Load preferred language from cookie
    const savedLang = getCookie('preferred_language');
    if (savedLang) {
        currentLang = savedLang;
        languageToggle.checked = currentLang === 'en';
        languageLabels.forEach(label => {
            label.classList.toggle('language-active', label.dataset.lang === currentLang);
            label.classList.toggle('language-inactive', label.dataset.lang !== currentLang);
        });
        updateLanguage();
    }

    // Add dropdown initialization
    const dropdown = document.getElementById('monitorDropdown');
    const warningPopup = document.getElementById('warningPopup');
    let warningTimeout;

    function updateDropdownDangerState(milliseconds) {
        if (milliseconds < 2000) {  // Changed from 500 to 2000
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

        if (milliseconds < 2000) {  // Changed from 500 to 2000
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
        monitorInterval = 10000;
        setCookie('monitor_interval', monitorInterval, 365);
    }

    // Always set both the dropdown value and the actual interval to 10000ms
    dropdown.value = '10000';
    monitorInterval = 10000;

    // Initialize admin toggle state
    const adminToggle = document.getElementById('adminToggle');
    if (adminToggle) {
        // Load saved state and apply it immediately
        const initialState = localStorage.getItem('adminToggleState');
        if (initialState === 'true') {
            // Trigger a change event to properly initialize admin mode
            adminToggle.checked = true;
            adminToggle.dispatchEvent(new Event('change'));
        }

        adminToggle.addEventListener('change', () => {
            const isChecked = adminToggle.checked;
            document.body.classList.toggle('admin-mode', isChecked);
            localStorage.setItem('adminToggleState', isChecked);
        });
    }

    // Initialize danger class based on current value
    updateDropdownDangerState(monitorInterval);

    // Restart monitoring with new interval
    startMonitoring();
    updateClockAnimation();

    // Add pause button handler
    const pauseButton = document.getElementById('pauseButton');
    pauseButton.addEventListener('click', toggleMonitoring);

    // Add theme toggle handler
    const themeToggle = document.getElementById('themeToggle');

    // Load saved theme preference
    const savedTheme = document.documentElement.getAttribute('data-theme');
    themeToggle.selected = savedTheme === 'dark';
    isDarkMode = savedTheme === 'dark';

    themeToggle.addEventListener('change', () => {
        isDarkMode = themeToggle.selected;
        document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
        setCookie('preferred_theme', isDarkMode ? 'dark' : 'light', 365);
    });

    startMonitoring();
    updateClockAnimation();
});