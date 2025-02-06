import { setCookie, getCookie, getTextWidth, translations, getCurrentLanguage } from './utils.js';

// Constants
const ROWS_PER_LOAD = 50;

// Global state variables
let tableChunks = {};  // Store the current chunk range for each table
let isLoading = {};
let autoScrolling = false;
let isAdminMode = false;

// Global state variables
let isRelationMode = false;
let schemaData = null;

// Preload schema data when page loads
async function loadSchemaData() {
    try {
        const response = await fetch(`${window.location.origin}/schema`);
        if (!response.ok) throw new Error('Failed to fetch schema');
        schemaData = await response.json();
        console.log('Schema data loaded:', schemaData);
    } catch (error) {
        console.error('Error loading schema:', error);
    }
}

// Initialize admin mode and arrangement handler
let initialArrangement = localStorage.getItem('arrangementMode') === 'true';

// Set initial arrangement state before DOM is fully loaded
document.addEventListener('DOMContentLoaded', async () => {
    const adminToggle = document.getElementById('adminToggle');
    const arrangementToggle = document.getElementById('arrangementToggle');
    
    // Load schema data first
    await loadSchemaData();
    
    // Hide content until we arrange it
    const tablesContainer = document.getElementById('tables-container');
    const buttonsLine = document.querySelector('.table-buttons-line');
    if (tablesContainer && buttonsLine) {
        tablesContainer.style.visibility = 'hidden';
        buttonsLine.style.visibility = 'hidden';
    }
    
    if (adminToggle) {
        adminToggle.addEventListener('change', (e) => {
            isAdminMode = e.target.checked;
            document.querySelectorAll('td.focused').forEach(cell => {
                cell.classList.remove('focused');
            });
        });
    }
    
    if (arrangementToggle) {
        // Load saved state
        // Load and apply saved state immediately without transitions
        arrangementToggle.checked = initialArrangement;
        isRelationMode = initialArrangement;
        
        const tableSections = document.querySelectorAll('.table-section');
        const sortedOrder = initialArrangement && schemaData ? getSortedTableOrder() :
            Array.from(tableSections).map(section => section.getAttribute('data-table-name')).sort();
        
        const tablesContainer = document.getElementById('tables-container');
        const buttonsLine = document.querySelector('.table-buttons-line');

        // Apply arrangement without animations
        sortedOrder.forEach(tableName => {
            // Rearrange table sections
            const section = document.querySelector(`.table-section[data-table-name="${tableName}"]`);
            if (section) {
                tablesContainer.appendChild(section);
            }
            
            // Rearrange table pills
            const pill = document.querySelector(`.table-button[data-table="${tableName}"]`);
            if (pill) {
                buttonsLine.appendChild(pill);
            }
        });

        if (initialArrangement) {
            // Mark related tables
            tableSections.forEach(section => {
                const tableName = section.getAttribute('data-table-name');
                if (hasRelations(tableName)) {
                    section.classList.add('relation-group');
                }
            });
        }

        // Show content after arrangement is complete
        if (tablesContainer && buttonsLine) {
            tablesContainer.style.visibility = '';
            buttonsLine.style.visibility = '';
        }
        // Add change event listener
        arrangementToggle.addEventListener('change', (e) => {
            isRelationMode = e.target.checked;
            localStorage.setItem('arrangementMode', e.target.checked);
            const tableSections = document.querySelectorAll('.table-section');
            const tablePills = document.querySelectorAll('.table-button');
            
            // Add transitions
            tableSections.forEach(section => {
                section.style.transition = 'all 0.3s ease-out';
            });
            tablePills.forEach(pill => {
                pill.style.transition = 'all 0.3s ease-out';
            });
            
            if (isRelationMode) {
                // Get sorted order from relation arrangement
                const sortedOrder = getSortedTableOrder();
                
                // Rearrange table sections
                const tablesContainer = document.getElementById('tables-container');
                sortedOrder.forEach(tableName => {
                    const section = document.querySelector(`.table-section[data-table-name="${tableName}"]`);
                    if (section) {
                        tablesContainer.appendChild(section);
                    }
                });
                
                // Rearrange table pills
                const buttonsLine = document.querySelector('.table-buttons-line');
                sortedOrder.forEach(tableName => {
                    const pill = document.querySelector(`.table-button[data-table="${tableName}"]`);
                    if (pill) {
                        buttonsLine.appendChild(pill);
                    }
                });

                // Mark related tables
                tableSections.forEach(section => {
                    const tableName = section.getAttribute('data-table-name');
                    if (hasRelations(tableName)) {
                        section.classList.add('relation-group');
                    }
                });
            } else {
                arrangeAlphabetically();
            }
            
            // Clean up transitions
            setTimeout(() => {
                tableSections.forEach(section => {
                    section.style.transition = '';
                });
                tablePills.forEach(pill => {
                    pill.style.transition = '';
                });
            }, 300);
        });
    }

    // Helper function to get sorted table order based on relationships
    function getSortedTableOrder() {
        if (!schemaData || !schemaData.relationships) {
            return Array.from(document.querySelectorAll('.table-section'))
                .map(section => section.getAttribute('data-table-name'));
        }

        // Build relationship graph
        const relationGraph = new Map();
        const connectionCounts = new Map();
        
        // Initialize maps with all tables
        document.querySelectorAll('.table-section').forEach(section => {
            const tableName = section.getAttribute('data-table-name');
            relationGraph.set(tableName, new Set());
            connectionCounts.set(tableName, 0);
        });
        
        // Add relationships and count connections
        schemaData.relationships.forEach(rel => {
            relationGraph.get(rel.from.table).add(rel.to.table);
            relationGraph.get(rel.to.table).add(rel.from.table);
            connectionCounts.set(rel.from.table, (connectionCounts.get(rel.from.table) || 0) + 1);
            connectionCounts.set(rel.to.table, (connectionCounts.get(rel.to.table) || 0) + 1);
        });

        // Sort tables by connection count and then group related tables
        const visited = new Set();
        const sortedTables = [];
        
        // Sort by connection count first
        const tablesByConnections = Array.from(connectionCounts.entries())
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([table]) => table);

        // Helper function to add related tables
        function addRelatedTables(tableName) {
            if (visited.has(tableName)) return;
            visited.add(tableName);
            sortedTables.push(tableName);
            
            // Add directly related tables
            if (relationGraph.has(tableName)) {
                Array.from(relationGraph.get(tableName))
                    .sort((a, b) => {
                        const countDiff = (connectionCounts.get(b) || 0) - (connectionCounts.get(a) || 0);
                        return countDiff !== 0 ? countDiff : a.localeCompare(b);
                    })
                    .forEach(related => {
                        if (!visited.has(related)) {
                            addRelatedTables(related);
                        }
                    });
            }
        }

        // Process all tables
        tablesByConnections.forEach(tableName => {
            if (!visited.has(tableName)) {
                addRelatedTables(tableName);
            }
        });

        return sortedTables;
    }

    // Helper function to check if a table has relations
    function hasRelations(tableName) {
        return schemaData?.relationships?.some(rel =>
            rel.from.table === tableName || rel.to.table === tableName
        ) || false;
    }
});

// Function to arrange tables by relations
// Function to arrange tables by relations
function arrangeByRelations() {
    if (!schemaData || !schemaData.relationships) {
        console.error('Schema data not available');
        return;
    }

    const tablesContainer = document.getElementById('tables-container');
    const tableSections = Array.from(tablesContainer.querySelectorAll('.table-section'));
    
    // Reset all groups
    tableSections.forEach(section => {
        section.classList.remove('relation-group');
        section.style.opacity = '0';
    });

    // Build relationship graph
    const relationGraph = new Map();
    // Count direct connections for each table
    const connectionCounts = new Map();
    
    schemaData.relationships.forEach(rel => {
        // Initialize maps
        [rel.from.table, rel.to.table].forEach(table => {
            if (!relationGraph.has(table)) {
                relationGraph.set(table, new Set());
                connectionCounts.set(table, 0);
            }
        });
        
        // Add bidirectional relationships
        relationGraph.get(rel.from.table).add(rel.to.table);
        relationGraph.get(rel.to.table).add(rel.from.table);
        
        // Increment connection counts
        connectionCounts.set(rel.from.table, connectionCounts.get(rel.from.table) + 1);
        connectionCounts.set(rel.to.table, connectionCounts.get(rel.to.table) + 1);
    });

    // Sort tables by connection count (most connected first)
    const sortedTables = [...tableSections].sort((a, b) => {
        const nameA = a.getAttribute('data-table-name');
        const nameB = b.getAttribute('data-table-name');
        const countA = connectionCounts.get(nameA) || 0;
        const countB = connectionCounts.get(nameB) || 0;
        
        if (countA !== countB) {
            return countB - countA;
        }
        return nameA.localeCompare(nameB);
    });

    // Group related tables together
    const grouped = new Set();
    const finalOrder = [];

    sortedTables.forEach(section => {
        const tableName = section.getAttribute('data-table-name');
        if (grouped.has(tableName)) return;

        const group = [];
        const addToGroup = (name) => {
            if (grouped.has(name)) return;
            
            const tableSection = sortedTables.find(s =>
                s.getAttribute('data-table-name') === name
            );
            if (tableSection) {
                group.push(tableSection);
                grouped.add(name);
                
                // Add direct relations
                if (relationGraph.has(name)) {
                    relationGraph.get(name).forEach(related => {
                        if (!grouped.has(related)) {
                            addToGroup(related);
                        }
                    });
                }
            }
        };

        addToGroup(tableName);

        // Add groups to final order with visual separation
        if (group.length > 0) {
            if (finalOrder.length > 0) {
                const lastSection = finalOrder[finalOrder.length - 1];
                lastSection.style.marginBottom = '20px';
            }
            
            // Mark related tables
            if (group.length > 1) {
                group.forEach(section => {
                    section.classList.add('relation-group');
                });
            }
            
            finalOrder.push(...group);
        }
    });

    // Add any remaining tables
    sortedTables.forEach(section => {
        if (!grouped.has(section.getAttribute('data-table-name'))) {
            finalOrder.push(section);
        }
    });

    // Update DOM with animation
    finalOrder.forEach((section, index) => {
        section.style.transition = 'all 0.3s ease-out';
        section.style.transitionDelay = `${index * 0.05}s`;
        tablesContainer.appendChild(section);
        requestAnimationFrame(() => {
            section.style.opacity = '1';
        });
    });

    // Clean up transitions
    setTimeout(() => {
        finalOrder.forEach(section => {
            section.style.transition = '';
            section.style.transitionDelay = '';
        });
    }, finalOrder.length * 50 + 300);
}
// Function to arrange tables alphabetically
function arrangeAlphabetically() {
    const tablesContainer = document.getElementById('tables-container');
    const tableSections = Array.from(tablesContainer.querySelectorAll('.table-section'));
    const buttonsLine = document.querySelector('.table-buttons-line');
    const tablePills = Array.from(buttonsLine.querySelectorAll('.table-button'));
    
    // Remove relation-group class and reset margins
    tableSections.forEach(section => {
        section.classList.remove('relation-group');
        section.style.marginBottom = '';
        section.style.opacity = '0';
    });
    
    // Get alphabetically sorted table names
    const sortedNames = tableSections
        .map(section => section.getAttribute('data-table-name'))
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    
    // Reorder table sections with animation
    sortedNames.forEach((tableName, index) => {
        const section = tableSections.find(s =>
            s.getAttribute('data-table-name') === tableName
        );
        if (section) {
            section.style.transition = 'all 0.3s ease-out';
            section.style.transitionDelay = `${index * 0.05}s`;
            tablesContainer.appendChild(section);
            requestAnimationFrame(() => {
                section.style.opacity = '1';
            });
        }
    });
    
    // Reorder table pills with animation
    sortedNames.forEach((tableName, index) => {
        const pill = tablePills.find(p =>
            p.getAttribute('data-table') === tableName
        );
        if (pill) {
            pill.style.transition = 'all 0.3s ease-out';
            pill.style.transitionDelay = `${index * 0.05}s`;
            buttonsLine.appendChild(pill);
        }
    });
    
    // Clean up transitions
    setTimeout(() => {
        tableSections.forEach(section => {
            section.style.transition = '';
            section.style.transitionDelay = '';
        });
        tablePills.forEach(pill => {
            pill.style.transition = '';
            pill.style.transitionDelay = '';
        });
    }, sortedNames.length * 50 + 300);
}

function updateTableRows(tbody, tableData, columns) {
    const currentRows = Array.from(tbody.querySelectorAll('tr')).length;
    const newRowCount = tableData.length;
    const hasRowCountChanged = currentRows !== newRowCount;
    
    // Store focused cell info before update
    const focusedCell = tbody.querySelector('td.focused');
    let focusedRowKey = null;
    let focusedCellIndex = -1;
    if (focusedCell) {
        focusedRowKey = focusedCell.closest('tr').querySelector('td').textContent;
        const cells = Array.from(focusedCell.closest('tr').querySelectorAll('td'));
        focusedCellIndex = cells.indexOf(focusedCell);
    }

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

    // Restore focused cell if it existed
    if (focusedRowKey !== null && focusedCellIndex !== -1) {
        const rows = tbody.querySelectorAll('tr');
        for (const row of rows) {
            const firstCell = row.querySelector('td');
            if (firstCell && firstCell.textContent === focusedRowKey) {
                const cells = row.querySelectorAll('td');
                if (cells[focusedCellIndex]) {
                    cells[focusedCellIndex].classList.add('focused');
                }
                break;
            }
        }
    }
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
    handleRowDeletion(tableDiv, tableDiv.id, baseUrl);
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

// Function to handle row deletion and cell editing
export function handleRowDeletion(tableDiv, tableName, baseUrl) {
    const table = tableDiv.querySelector('table');
    if (!table) return;

    let isEditing = false;
    let currentEditCell = null;
    let originalValue = null;

    // Function to restore cell to non-editing state
    const restoreCell = (cell) => {
        if (!cell) return;
        cell.textContent = originalValue;
        cell.classList.remove('editing');
        isEditing = false;
        currentEditCell = null;

        // Resume monitoring if it wasn't paused before
        if (editingState && !editingState.wasPaused && window.isMonitoringPaused) {
            window.toggleMonitoring();
        }

        originalValue = null;
        editingState = null;
    };

    // Add monitoring state handler
    let editingState = null;

    // Handler for starting cell edit
    const startEditing = (cell) => {
        if (isEditing) {
            restoreCell(currentEditCell);
        }

        // Pause monitoring while editing
        const wasPaused = window.isMonitoringPaused;
        if (!wasPaused) {
            window.toggleMonitoring();
        }

        originalValue = cell.textContent;
        currentEditCell = cell;
        isEditing = true;
        cell.classList.add('editing');
        const input = document.createElement('input');
        input.value = originalValue;

        // Store editing state for monitoring updates
        const row = cell.closest('tr');
        editingState = {
            rowId: row.cells[0].textContent,
            columnIndex: Array.from(row.cells).indexOf(cell),
            value: input.value,
            selectionStart: 0,
            selectionEnd: 0,
            wasPaused: wasPaused // Store monitoring state
        };

        const handleEditComplete = async (newValue, shouldSave) => {
            if (shouldSave && newValue !== originalValue) {
                const row = cell.closest('tr');
                const rowId = row.cells[0].textContent;
                const columnIndex = Array.from(row.cells).indexOf(cell);
                const columnName = table.querySelector('th:nth-child(' + (columnIndex + 1) + ')').textContent;
                
                try {
                    const response = await fetch(`${baseUrl}/update/${tableName}/${rowId}/${columnName}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ value: newValue })
                    });

                    if (!response.ok) {
                        throw new Error('Update failed');
                    }

                    cell.textContent = newValue;
                    originalValue = newValue;

                    // Show success popup
                    const deletePopup = document.getElementById('deletePopup');
                    deletePopup.querySelector('.warning-icon').textContent = '✓';
                    deletePopup.querySelector('.lang-en').textContent = 'Value updated successfully';
                    deletePopup.querySelector('.lang-ko').textContent = '값이 업데이트되었습니다';
                    deletePopup.classList.add('show');
                    setTimeout(() => {
                        deletePopup.classList.remove('show');
                    }, 2000);
                } catch (error) {
                    console.error('Error updating cell:', error);
                    restoreCell(cell);
                    // Show error popup
                    const deletePopup = document.getElementById('deletePopup');
                    const icon = deletePopup.querySelector('.warning-icon');
                    icon.textContent = '⚠';
                    deletePopup.querySelector('.lang-en').textContent = 'Failed to update value';
                    deletePopup.querySelector('.lang-ko').textContent = '값 업데이트에 실패했습니다';
                    deletePopup.classList.add('show');
                    setTimeout(() => {
                        icon.textContent = '✓';
                        deletePopup.classList.remove('show');
                    }, 2000);
                    return;
                }
            } else {
                restoreCell(cell);
            }
            
            cell.classList.remove('editing');
            isEditing = false;
            currentEditCell = null;
        };

        input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleEditComplete(input.value, true);
            } else if (e.key === 'Escape') {
                handleEditComplete(originalValue, false);
            }
        });

        input.addEventListener('blur', () => {
            handleEditComplete(originalValue, false);
        });
        
        cell.textContent = '';
        cell.appendChild(input);
        input.focus();
    };

    // Add click and double click handlers
    table.addEventListener('click', (e) => {
        const cell = e.target.closest('td');
        if (!cell) return;

        if (e.target.tagName === 'INPUT' || !isAdminMode) {
            return; // Don't handle clicks when not in admin mode or clicking on input
        }

        if (cell.classList.contains('focused') && !isEditing) {
            startEditing(cell);
        } else if (!isEditing) {
            // Remove focus from any previously focused cell
            table.querySelectorAll('td').forEach(td => td.classList.remove('focused'));
            // Add focus to clicked cell
            cell.classList.add('focused');
        }
    });

    // Add double click handler
    table.addEventListener('dblclick', (e) => {
        const cell = e.target.closest('td');
        if (cell && !isEditing && isAdminMode) {
            startEditing(cell);
        }
    });

    // Add keydown handler for 'D', 'A', 'X', and 'Q' keys
    document.addEventListener('keydown', async (e) => {
        // Handle Q key for query popup
        // Prevent query popup when typing in query input or when query popup is visible
        const queryPopup = document.getElementById('queryPopup');
        const isQueryInputFocused = document.activeElement && document.activeElement.id === 'queryInput';
        const isQueryPopupVisible = queryPopup && queryPopup.classList.contains('visible');
        
        if (e.key.toLowerCase() === 'q' && isAdminMode && !isQueryInputFocused && !isQueryPopupVisible) {
          e.preventDefault();
            
            const queryInput = document.getElementById('queryInput');
            const executeButton = document.getElementById('executeQuery');
            const resultArea = document.getElementById('queryResult');
            const queryContent = document.querySelector('.query-content');
            
            // Load saved query history from localStorage
            const queryHistory = JSON.parse(localStorage.getItem('queryHistory') || '[]');
            let historyIndex = -1;
            
            queryPopup.classList.add('visible');
            queryInput.focus();
            
            // Clear previous result
            resultArea.textContent = '';
            
            // Set Execute button style with Ctrl+Enter text
            executeButton.innerHTML = `
                <span class="lang-ko">(Ctrl+Enter) 실행</span>
                <span class="lang-en">(Ctrl+Enter) Execute</span>
            `;
            queryInput.addEventListener('keydown', (e) => {
                if (e.key === 'q' && e.ctrlKey) {
                    e.stopPropagation(); // Prevent triggering the global Q handler
                }
            });
            // Handle query history navigation
            queryInput.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (historyIndex < queryHistory.length - 1) {
                        historyIndex++;
                        queryInput.value = queryHistory[historyIndex];
                    }
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (historyIndex > -1) {
                        historyIndex--;
                        queryInput.value = historyIndex === -1 ? '' : queryHistory[historyIndex];
                    }
                }
            });
            
            // Handle execute button click
            const handleExecute = async () => {
                const query = queryInput.value.trim();
                if (!query) return;
                
                // Save to history (if not already the most recent)
                if (!queryHistory.includes(query)) {
                    queryHistory.unshift(query);
                    if (queryHistory.length > 50) queryHistory.pop(); // Keep last 50 queries
                    localStorage.setItem('queryHistory', JSON.stringify(queryHistory));
                }
                historyIndex = -1;
                try {
                    const response = await fetch(`${baseUrl}/execute_query`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ query: queryInput.value })
                    });
                    
                    const data = await response.json();
                    if (data.error) {
                        resultArea.textContent = `Error: ${data.error}`;
                        return;
                    }
                    
                    if (data.results) {
                        // Check if results is array of objects (table format)
                        if (Array.isArray(data.results) && data.results.length > 0 && typeof data.results[0] === 'object') {
                            // Clear previous content
                            resultArea.innerHTML = '';
                            
                            // Create table wrapper with dynamic width
                            const queryContent = document.querySelector('.query-content');
                            queryContent.style.width = '100%';
                            queryContent.style.overflowX = 'auto';

                            const tableWrapper = document.createElement('div');
                            tableWrapper.className = 'table-scroll-wrapper';
                            tableWrapper.style.width = '100%';
                            tableWrapper.style.maxWidth = '100%';
                            
                            const table = document.createElement('table');
                            table.style.width = '100%';
                            
                            // Create header
                            const thead = document.createElement('thead');
                            const headerRow = document.createElement('tr');
                            Object.keys(data.results[0]).forEach(key => {
                                const th = document.createElement('th');
                                th.textContent = key;
                                headerRow.appendChild(th);
                            });
                            thead.appendChild(headerRow);
                            table.appendChild(thead);
                            
                            // Create body
                            const tbody = document.createElement('tbody');
                            data.results.forEach(row => {
                                const tr = document.createElement('tr');
                                Object.values(row).forEach(value => {
                                    const td = document.createElement('td');
                                    td.textContent = value === null ? 'NULL' : value;
                                    tr.appendChild(td);
                                });
                                tbody.appendChild(tr);
                            });
                            table.appendChild(tbody);
                            
                            // Append table to wrapper and wrapper to result area
                            tableWrapper.appendChild(table);
                            resultArea.appendChild(tableWrapper);

                            // Auto-adjust column widths after data is loaded
                            setTimeout(() => adjustColumnWidths(table), 0);
                        } else {
                            resultArea.textContent = JSON.stringify(data.results, null, 2);
                        }
                    } else {
                        resultArea.textContent = data.message;
                    }
                } catch (error) {
                    resultArea.textContent = `Error: ${error.message}`;
                }
            };
            
            // Clean up previous event listeners
            executeButton.removeEventListener('click', handleExecute);
            executeButton.addEventListener('click', handleExecute);
            
            // Handle close button
            const closeButton = queryPopup.querySelector('.query-close');
            const handleClose = () => {
                queryPopup.classList.remove('visible');
            };
            
            closeButton.removeEventListener('click', handleClose);
            closeButton.addEventListener('click', handleClose);
            
            // Handle Escape key
            queryPopup.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    handleClose();
                }
            }, { once: true });
            
            let isExecuting = false;
            // Handle Enter with Ctrl/Cmd
            queryInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !isExecuting) {
                    e.preventDefault();
                    isExecuting = true;
                    handleExecute().finally(() => {
                        isExecuting = false;
                    });
                }
            });
            
            return;
        }
        if ((e.key.toLowerCase() === 'd' || e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'x')
            && !isEditing && isAdminMode) {
            const focusedCell = table.querySelector('td.focused');
            if (!focusedCell) return;

            const row = focusedCell.closest('tr');
            if (!row) return;

            // Get row ID from first cell
            if (e.key.toLowerCase() === 'x') {
                const columnIndex = Array.from(row.cells).indexOf(focusedCell);
                const valueToDelete = focusedCell.textContent;
                const columnName = table.querySelector(`th:nth-child(${columnIndex + 1})`).textContent;

                try {
                    const response = await fetch(`${baseUrl}/delete/${tableName}/column/${columnName}/value/${valueToDelete}`, {
                        method: 'DELETE'
                    });

                    if (!response.ok) {
                        throw new Error('Delete failed');
                    }

                    // Find all rows with the same value in the same column
                    const rowsToDelete = Array.from(table.querySelectorAll('tr')).filter(r => {
                        return r.cells[columnIndex] && r.cells[columnIndex].textContent === valueToDelete;
                    });

                    // Add deleting animation to all matching rows
                    rowsToDelete.forEach(r => {
                        r.classList.add('deleting');
                    });
                    
                    // Remove rows after animation
                    setTimeout(() => {
                        rowsToDelete.forEach(r => r.remove());
                    }, 300);

                    // Show success popup
                    const deletePopup = document.getElementById('deletePopup');
                    deletePopup.querySelector('.warning-icon').textContent = '✓';
                    deletePopup.querySelector('.lang-en').textContent = 'Matching rows have been deleted';
                    deletePopup.querySelector('.lang-ko').textContent = '동일한 값을 가진 행이 삭제되었습니다';
                    deletePopup.classList.add('show');
                    setTimeout(() => {
                        deletePopup.classList.remove('show');
                    }, 2000);

                } catch (error) {
                    console.error('Error deleting rows:', error);
                    const deletePopup = document.getElementById('deletePopup');
                    const icon = deletePopup.querySelector('.warning-icon');
                    icon.textContent = '⚠';
                    deletePopup.querySelector('.lang-en').textContent = 'Failed to delete matching rows';
                    deletePopup.querySelector('.lang-ko').textContent = '행 삭제에 실패했습니다';
                    deletePopup.classList.add('show');
                    setTimeout(() => {
                        icon.textContent = '✓';
                        deletePopup.classList.remove('show');
                    }, 2000);
                }
            } else if (e.key.toLowerCase() === 'd') {
                const rowId = row.cells[0].textContent;

                try {
                    const response = await fetch(`${baseUrl}/delete/${tableName}/${rowId}`, {
                        method: 'DELETE'
                    });

                    if (!response.ok) {
                        throw new Error('Delete failed');
                    }

                    // Add deleting animation class
                    row.classList.add('deleting');
                    
                    // Remove row after animation
                    setTimeout(() => {
                        row.remove();
                    }, 300);

                    // Show success popup
                    const deletePopup = document.getElementById('deletePopup');
                    deletePopup.querySelector('.warning-icon').textContent = '✓';
                    deletePopup.querySelector('.lang-en').textContent = 'Row has been deleted';
                    deletePopup.querySelector('.lang-ko').textContent = '행이 삭제되었습니다';
                    deletePopup.classList.add('show');
                    setTimeout(() => {
                        deletePopup.classList.remove('show');
                    }, 2000);
                } catch (error) {
                    console.error('Error deleting row:', error);
                    // Show error in warningPopup style
                    const deletePopup = document.getElementById('deletePopup');
                    const icon = deletePopup.querySelector('.warning-icon');
                    icon.textContent = '⚠';
                    deletePopup.querySelector('.lang-en').textContent = 'Failed to delete row';
                    deletePopup.querySelector('.lang-ko').textContent = '행 삭제에 실패했습니다';
                    deletePopup.classList.add('show');
                    setTimeout(() => {
                        // Reset popup back to success state
                        icon.textContent = '✓';
                        deletePopup.classList.remove('show');
                    }, 2000);
                }
            } else if (e.key.toLowerCase() === 'a') {
                try {
                    // Get table columns
                    const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent);
                    
                    // Create empty row data object
                    const emptyRow = {};
                    headers.forEach(col => {
                        emptyRow[col] = '';
                    });

                    const response = await fetch(`${baseUrl}/add/${tableName}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(emptyRow)
                    });

                    if (!response.ok) {
                        throw new Error('Add failed');
                    }

                    const newRowData = await response.json();
                    
                    // Create new row element
                    const newRow = document.createElement('tr');
                    newRow.classList.add('new-row');
                    
                    // Add cells to new row
                    headers.forEach(col => {
                        const td = document.createElement('td');
                        td.textContent = newRowData[col] || '';
                        newRow.appendChild(td);
                    });

                    // Insert new row at the focused row's position
                    row.insertAdjacentElement('beforebegin', newRow);

                    // Show success popup
                    const deletePopup = document.getElementById('deletePopup');
                    deletePopup.querySelector('.warning-icon').textContent = '✓';
                    deletePopup.querySelector('.lang-en').textContent = 'New row added';
                    deletePopup.querySelector('.lang-ko').textContent = '새 행이 추가되었습니다';
                    deletePopup.classList.add('show');
                    setTimeout(() => {
                        deletePopup.classList.remove('show');
                    }, 2000);
                } catch (error) {
                    console.error('Error adding row:', error);
                    // Show error in warningPopup style
                    const deletePopup = document.getElementById('deletePopup');
                    const icon = deletePopup.querySelector('.warning-icon');
                    icon.textContent = '⚠';
                    deletePopup.querySelector('.lang-en').textContent = 'Failed to add row';
                    deletePopup.querySelector('.lang-ko').textContent = '행 추가에 실패했습니다';
                    deletePopup.classList.add('show');
                    setTimeout(() => {
                        // Reset popup back to success state
                        icon.textContent = '✓';
                        deletePopup.classList.remove('show');
                    }, 2000);
                }
            }
        }
    });

    // Handle monitoring updates preserving edit state
    const originalUpdateTableRows = window.updateTableRows;
    window.updateTableRows = (tbody, tableData, columns) => {
        if (isEditing && currentEditCell) {
            const editingRowId = currentEditCell.closest('tr').cells[0].textContent;
            const editingColIndex = Array.from(currentEditCell.closest('tr').cells).indexOf(currentEditCell);
            
            originalUpdateTableRows(tbody, tableData, columns);
            
            // Restore editing state
            const newRow = Array.from(tbody.querySelectorAll('tr')).find(tr => tr.cells[0].textContent === editingRowId);
            if (newRow) {
                const cell = newRow.cells[editingColIndex];
                if (cell) {
                    const input = document.createElement('input');
                    input.value = originalValue;
                    cell.textContent = '';
                    cell.classList.add('editing');
                    cell.appendChild(input);
                    input.focus();
                    currentEditCell = cell;
                }
            }
        } else {
            originalUpdateTableRows(tbody, tableData, columns);
        }
    };
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
