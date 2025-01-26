import { setCookie, getCookie, getTextWidth, translations, getCurrentLanguage } from './utils.js';

// Constants
const ROWS_PER_LOAD = 50;

// Add new global variables for chunk tracking
let tableChunks = {};  // Store the current chunk range for each table
let isLoading = {};
let autoScrolling = false;

function updateTableRows(tbody, tableData, columns) {
    const currentRows = Array.from(tbody.querySelectorAll('tr')).length;
    const newRowCount = tableData.length;
    const hasRowCountChanged = currentRows !== newRowCount;
    
    // Store current view for comparison
    const existingRows = new Map();
    tbody.querySelectorAll('tr').forEach(tr => {
        const cells = tr.querySelectorAll('td');
        const rowKey = cells[0]?.textContent;
        existingRows.set(rowKey, {
            element: tr,
            data: Array.from(cells).map(cell => cell.textContent)
        });
    });

    const fragment = document.createDocumentFragment();
    let animateAll = hasRowCountChanged && currentRows > 0; // Only animate if not initial load

    tableData.forEach((row, index) => {
        const rowKey = String(row[columns[0]]);
        const existing = existingRows.get(rowKey);
        const tr = document.createElement('tr');
        
        if (existing) {
            // Check if data changed
            const hasChanged = columns.some((col, idx) => {
                const newVal = row[col] !== null ? String(row[col]) : '';
                return existing.data[idx] !== newVal;
            });

            if (hasChanged || animateAll) {
                tr.classList.add('changed');
            }
            
            columns.forEach((col, idx) => {
                const td = document.createElement('td');
                const newVal = row[col] !== null ? String(row[col]) : '';
                td.textContent = newVal;
                tr.appendChild(td);
            });
            
            existingRows.delete(rowKey);
        } else {
            // Only add new-row animation if this isn't the initial load
            if (currentRows > 0) {
                tr.classList.add('new-row');
            }
            columns.forEach(col => {
                const td = document.createElement('td');
                const val = row[col];
                td.textContent = val !== null ? String(val) : '';
                tr.appendChild(td);
            });
        }
        
        fragment.appendChild(tr);
    });

    // Clear and update tbody
    tbody.innerHTML = '';
    tbody.appendChild(fragment);

    // Add cascade animation to affected rows
    if (hasRowCountChanged && currentRows > 0) {
        tbody.querySelectorAll('tr').forEach((tr, index) => {
            tr.style.animationDelay = `${index * 0.05}s`;
        });
    }

    // Clean up animations
    setTimeout(() => {
        tbody.querySelectorAll('.changed, .new-row').forEach(el => {
            el.classList.remove('changed', 'new-row');
            el.style.animationDelay = '';
        });
    }, 1500);
}

export function createNewTable(tableDiv, tableData, columns, baseUrl) {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-scroll-wrapper';

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // Create header row
    const headerRow = document.createElement('tr');
    columns.forEach(col => {
        const th = document.createElement('th');
        const span = document.createElement('span');
        span.textContent = col;
        th.appendChild(span);

        const resizer = document.createElement('div');
        resizer.className = 'resizer';
        th.appendChild(resizer);

        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    table.appendChild(tbody);

    wrapper.appendChild(table);
    tableDiv.innerHTML = '';
    tableDiv.appendChild(wrapper);

    // Add event listeners
    addResizerListeners(table, columns);
    wrapper.addEventListener('scroll', function () {
        handleTableScroll(this, tableDiv.id);
    });

    if (!tableData || !tableData.length) {
        const noDataRow = document.createElement('tr');
        const noDataCell = document.createElement('td');
        noDataCell.colSpan = columns.length;
        noDataCell.innerHTML = `<span class="lang-ko">데이터가 없습니다.</span><span class="lang-en">No data available.</span>`;
        noDataCell.style.textAlign = 'center';
        noDataRow.appendChild(noDataCell);
        tbody.appendChild(noDataRow);
        return;
    }

    updateTableRows(tbody, tableData, columns);
}

export function updateSingleTable(tableName, tableInfo, translations, currentLang, fetchTableData, baseUrl) {
    const tableDiv = document.getElementById(tableName);
    if (!tableDiv) return;

    const countSpan = document.getElementById(`${tableName}_count`);
    if (countSpan) {
        countSpan.textContent = `(${tableInfo.count} ${translations[currentLang].rows})`;
    }

    const isHidden = tableDiv.classList.contains('hidden-table');
    const limitedInfoSpan = document.getElementById(`${tableName}_limited_info`);
    if (limitedInfoSpan && !isHidden) {
        if (tableInfo.limited) {
            limitedInfoSpan.innerHTML = `
                <span class="lang-ko" style="display: ${currentLang === 'ko' ? 'inline' : 'none'}">${translations.ko.scrollMore}</span>
                <span class="lang-en" style="display: ${currentLang === 'en' ? 'inline' : 'none'}">${translations.en.scrollMore}</span>
            `;
        } else {
            limitedInfoSpan.innerHTML = `
                <span class="lang-ko" style="display: ${currentLang === 'ko' ? 'inline' : 'none'}">${translations.ko.allDataLoaded}</span>
                <span class="lang-en" style="display: ${currentLang === 'en' ? 'inline' : 'none'}">${translations.en.allDataLoaded}</span>
            `;
        }
        limitedInfoSpan.classList.add('visible');
    } else if (limitedInfoSpan && isHidden) {
        limitedInfoSpan.innerHTML = '';
        limitedInfoSpan.classList.remove('visible');
    }

    let existingTable = tableDiv.querySelector('table');
    if (existingTable) {
        const tbody = existingTable.querySelector('tbody');
        if (tbody) {
            if (!tableInfo.data || !tableInfo.data.length) {
                tbody.innerHTML = '';
                const noDataRow = document.createElement('tr');
                const noDataCell = document.createElement('td');
                noDataCell.colSpan = tableInfo.columns.length;
                noDataCell.innerHTML = `<span class="lang-ko">${translations.ko.noData}</span><span class="lang-en">${translations.en.noData}</span>`;
                noDataCell.style.textAlign = 'center';
                noDataRow.appendChild(noDataCell);
                tbody.appendChild(noDataRow);
            } else {
                updateTableRows(tbody, tableInfo.data, tableInfo.columns);
            }
        }
    } else {
        createNewTable(tableDiv, tableInfo.data, tableInfo.columns, baseUrl);
        existingTable = tableDiv.querySelector('table');
    }

    if (existingTable && tableInfo.data && tableInfo.data.length) {
        applySavedColumnWidths(existingTable, tableInfo.columns);
    }

    tableDiv.classList.add('initialized');
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            tableDiv.classList.add('expanded');
        });
    });
}

// Helper functions
function addResizerListeners(table, columns) {
    const thElements = table.querySelectorAll('th');
    thElements.forEach((th, index) => {
        const resizer = th.querySelector('.resizer');
        let startX, startWidth;
        let currentWidth;

        const initialWidth = th.offsetWidth;
        th.style.width = `${initialWidth}px`;
        th.style.minWidth = `${initialWidth}px`;

        table.querySelectorAll(`td:nth-child(${index + 1})`).forEach(td => {
            td.style.width = `${initialWidth}px`;
            td.style.minWidth = `${initialWidth}px`;
            td.style.maxWidth = `${initialWidth}px`;
        });

        const onMouseMove = (e) => {
            if (!startX) return;
            const deltaX = e.pageX - startX;
            currentWidth = Math.max(30, startWidth + deltaX);
            th.style.width = `${currentWidth}px`;
            th.style.minWidth = `${currentWidth}px`;

            table.querySelectorAll(`td:nth-child(${index + 1})`).forEach(cell => {
                cell.style.width = `${currentWidth}px`;
                cell.style.minWidth = `${currentWidth}px`;
                cell.style.maxWidth = `${currentWidth}px`;
            });
        };

        const onMouseUp = () => {
            if (!currentWidth) return;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';

            const widths = getSavedColumnWidths(table);
            widths[columns[index]] = currentWidth;
            saveColumnWidths(table, widths);

            startX = null;
            currentWidth = null;
        };

        resizer.addEventListener('mousedown', (e) => {
            startX = e.pageX;
            startWidth = th.offsetWidth;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            document.body.style.cursor = 'col-resize';
            e.preventDefault();
        });

        // Touch support
        const onTouchMove = (e) => {
            const touch = e.touches[0];
            onMouseMove({ pageX: touch.pageX });
        };

        const onTouchEnd = () => {
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
            onMouseUp();
        };

        resizer.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            startX = touch.pageX;
            startWidth = th.offsetWidth;
            document.addEventListener('touchmove', onTouchMove);
            document.addEventListener('touchend', onTouchEnd);
            e.preventDefault();
        });
    });
}

function saveColumnWidths(table, widths) {
    const tableName = table.closest('.table-container').id;
    const cookieName = `table_${tableName}_widths`;
    setCookie(cookieName, JSON.stringify(widths), 365);
}

function getSavedColumnWidths(table) {
    const tableName = table.closest('.table-container').id;
    const cookieName = `table_${tableName}_widths`;
    const widths = getCookie(cookieName);
    return widths ? JSON.parse(widths) : {};
}

function applySavedColumnWidths(table, columns) {
    const widths = getSavedColumnWidths(table);
    table.querySelectorAll('th').forEach((th, index) => {
        const colName = columns[index];
        if (widths[colName]) {
            const width = widths[colName];
            th.style.width = `${width}px`;
            th.style.minWidth = `${width}px`;

            table.querySelectorAll(`td:nth-child(${index + 1})`).forEach(td => {
                td.style.width = `${width}px`;
                td.style.minWidth = `${width}px`;
                td.style.maxWidth = `${width}px`;
            });
        }
    });
}

export function fetchTableData(tableName, append = false, baseUrl, translations, currentLang, updateSingleTable) {
    if (!baseUrl) {
        console.error('baseUrl is not defined');
        return Promise.reject(new Error('baseUrl is not defined'));
    }

    if (isLoading[tableName]) return Promise.resolve();
    isLoading[tableName] = true;

    if (!tableChunks[tableName]) {
        tableChunks[tableName] = {
            start: 0,
            end: ROWS_PER_LOAD
        };
    }

    const offset = append ? tableChunks[tableName].end : tableChunks[tableName].start;
    const url = `${baseUrl}/data/${tableName}?limit=${ROWS_PER_LOAD}&offset=${offset}`;

    return fetch(url)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (!data || !data.data) {
                throw new Error('Invalid data received from server');
            }
            
            if (append) {
                if (data.data.length > 0) {
                    appendTableData(tableName, data, translations, currentLang);
                    tableChunks[tableName].end += data.data.length;
                }
            } else {
                updateSingleTable(tableName, data, translations, currentLang, fetchTableData, baseUrl);
                tableChunks[tableName] = {
                    start: 0,
                    end: data.data.length
                };
            }
        })
        .catch(error => {
            console.error(`Error fetching data for ${tableName}:`, error);
        })
        .finally(() => {
            isLoading[tableName] = false;
        });
}

function appendTableData(tableName, tableInfo, translations, currentLang) {
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
    if (countSpan) {
        countSpan.textContent = `(${tableInfo.count} ${translations[currentLang].rows})`;
    }

    const limitedInfoSpan = document.getElementById(`${tableName}_limited_info`);
    if (limitedInfoSpan) {
        if (tableInfo.limited) {
            limitedInfoSpan.innerHTML = `
                <span class="lang-ko" style="display: ${currentLang === 'ko' ? 'inline' : 'none'}">${translations.ko.scrollMore}</span>
                <span class="lang-en" style="display: ${currentLang === 'en' ? 'inline' : 'none'}">${translations.en.scrollMore}</span>
            `;
        } else {
            limitedInfoSpan.innerHTML = `
                <span class="lang-ko" style="display: ${currentLang === 'ko' ? 'inline' : 'none'}">${translations.ko.allDataLoaded}</span>
                <span class="lang-en" style="display: ${currentLang === 'en' ? 'inline' : 'none'}">${translations.en.allDataLoaded}</span>
            `;
        }
        limitedInfoSpan.classList.add('visible');
    }
}

// Modify the fetchTableCount function to prevent interference with sort state
export function fetchTableCount(tableName, baseUrl, translations, currentLang) {
    const url = `${baseUrl}/data/${tableName}?limit=1&offset=0`;
    return fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
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
            countSpan.textContent = `(${data.count} ${translations[currentLang].rows})`;
            return data.count;
        } else {
            countSpan.textContent = `(0 ${translations[currentLang].rows})`;
            return 0;
        }
    })
    .catch(error => {
        console.error(`Error fetching count for ${tableName}:`, error);
        const countSpan = document.getElementById(`${tableName}_count`);
        countSpan.textContent = `(Error)`;
        return null;
    });
}

export function adjustColumnWidths(table) {
    const columns = Array.from(table.querySelectorAll('th'));
    columns.forEach((th, index) => {
        // Reset any existing widths
        th.style.width = '';

        // Calculate the max width needed for this column
        const cells = Array.from(table.querySelectorAll(`td:nth-child(${index + 1})`));
        const allCells = [th, ...cells];
        let maxWidth = 0;

        allCells.forEach(cell => {
            const cellText = cell.innerText || cell.textContent;
            const cellFont = window.getComputedStyle(cell).font;
            const cellWidth = getTextWidth(cellText, cellFont);
            if (cellWidth > maxWidth) {
                maxWidth = cellWidth;
            }
        });

        // Apply the width to the header and cells (add padding as needed)
        let finalWidth = maxWidth + 24; // Add padding

        // Add extra width to the final column for the delete button
        if (index === columns.length - 1) {
            finalWidth += 30; // Extra width for the 'x' button
        }

        th.style.width = `${finalWidth}px`;

        cells.forEach(cell => {
            cell.style.width = `${finalWidth}px`;
        });
    });
}

export function handleTableScroll(wrapper, tableName) {
    if (autoScrolling) return;
    
    // Immediately check for horizontal scroll
    const currentScrollLeft = wrapper.scrollLeft;
    const isHorizontalScroll = wrapper.lastScrollLeft !== undefined &&
                              wrapper.lastScrollLeft !== currentScrollLeft;
    
    // Update last scroll position after check
    wrapper.lastScrollLeft = currentScrollLeft;
    
    // Exit early if this is a horizontal scroll
    if (isHorizontalScroll) return;

    // Handle vertical scroll events
    const bottomOffset = 50;
    const topOffset = 50;
    const atBottom = wrapper.scrollHeight - (wrapper.scrollTop + wrapper.clientHeight) < bottomOffset;
    const atTop = wrapper.scrollTop < topOffset;
    const tableDiv = document.getElementById(tableName);
    const isHidden = tableDiv.classList.contains('hidden-table');

    if (atBottom && !isLoading[tableName] && !isHorizontalScroll) {
        // Show temporary pause message
        const pauseButton = document.getElementById('pauseButton');
        const defaultTooltip = pauseButton.querySelector('.default-tooltip');
        const tempTooltip = pauseButton.querySelector('.temp-tooltip');
        const currentLang = getCurrentLanguage();  // Get current language
        
        // Only trigger pause on first historical data load
        const hasOldData = Object.keys(tableChunks).some(tn => tableChunks[tn].end > ROWS_PER_LOAD);
        const noOldDataYet = !hasOldData;
        
        if (!window.isMonitoringPaused && !isHidden && noOldDataYet) {
            defaultTooltip.style.display = 'none';
            tempTooltip.style.display = 'block';
            window.toggleMonitoring();
    
            const limitedInfoSpan = document.getElementById(`${tableName}_limited_info`);
            if (limitedInfoSpan) {
                limitedInfoSpan.innerHTML = `
                    <span class="lang-ko" style="display: ${currentLang === 'ko' ? 'inline' : 'none'}">${translations.ko.scrollMore}</span>
                    <span class="lang-en" style="display: ${currentLang === 'en' ? 'inline' : 'none'}">${translations.en.scrollMore}</span>
                `;
                limitedInfoSpan.classList.add('visible');
            }
    
            // Hide temp tooltip after 3 seconds
            setTimeout(() => {
                tempTooltip.style.display = 'none';
                defaultTooltip.style.display = '';
            }, 3000);
        }
    
        // Always fetch more data when scrolling to bottom, regardless of monitoring state
        fetchTableData(tableName, true, baseUrl, translations, getCurrentLanguage(), updateSingleTable);
    }

    // Resume monitoring if table is hidden or at top
    if ((atTop || isHidden) && window.isMonitoringPaused) {
        autoScrolling = true;
        if (!isHidden) {
            wrapper.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
        
        setTimeout(() => {
            window.toggleMonitoring();
            autoScrolling = false;
        }, 300);
    }
}

function scrollTableToTop(container) {
    const wrapper = container.querySelector('.table-scroll-wrapper');
    if (wrapper) {
        autoScrolling = true;
        wrapper.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
        
        setTimeout(() => {
            autoScrolling = false;
        }, 300);
    }
}

export function scrollAllTablesToTop() {
    const visibleTables = document.querySelectorAll('.table-container:not(.hidden-table)');
    visibleTables.forEach(container => {
        scrollTableToTop(container);
    });
}
