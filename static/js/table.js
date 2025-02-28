import { setCookie, getCookie, getTextWidth, translations, getCurrentLanguage } from './utils.js';

// Constants and state variables
const ROWS_PER_LOAD = 50;
let tableChunks = {};
let isLoading = {};
let autoScrolling = false;
let isAdminMode = localStorage.getItem('adminToggleState') === 'true';
let isRelationMode = false;

// Function to set up query popup handlers
function setupQueryPopup() {
    const queryPopup = document.getElementById('queryPopup');
    const executeButton = document.getElementById('executeQuery');
    const closeButton = queryPopup.querySelector('.query-close');
    const queryInput = document.getElementById('queryInput');
    const resultArea = document.getElementById('queryResult');
    
    // Load saved query history
    const queryHistory = JSON.parse(localStorage.getItem('queryHistory') || '[]');
    let historyIndex = -1;

    // Function to handle closing the popup
    function handleClose() {
        queryPopup.classList.remove('visible');
        queryInput.value = '';
        document.querySelector('.download-buttons')?.remove();
        resultArea.textContent = '';
    }

    return { queryPopup, executeButton, queryInput, resultArea, queryHistory, historyIndex, handleClose };
}

// Set up global query handler (independent of table state)
document.addEventListener('keydown', (e) => {
    if (!isAdminMode) return;
    if (!e.key || e.key.toLowerCase() !== 'q') return;

    let { queryPopup, executeButton, queryInput, resultArea, queryHistory, historyIndex, handleClose } = setupQueryPopup();

    const isQueryInputFocused = document.activeElement?.id === 'queryInput';
    const isQueryPopupVisible = queryPopup?.classList.contains('visible');
    
    if (isQueryInputFocused || isQueryPopupVisible) return;
    
    e.preventDefault();

    // Clear and show popup
    queryPopup.classList.add('visible');
    queryInput.value = '';
    document.querySelector('.download-buttons')?.remove();
    resultArea.textContent = '';

    // Set up execute button text
    executeButton.innerHTML = `
        <span class="lang-ko">(Ctrl+Enter) 실행</span>
        <span class="lang-en">(Ctrl+Enter) Execute</span>
    `;

    // Replace elements to clear old event listeners
    const newInput = queryInput.cloneNode(true);
    const newButton = executeButton.cloneNode(true);
    queryInput.parentNode.replaceChild(newInput, queryInput);
    executeButton.parentNode.replaceChild(newButton, executeButton);
    queryInput = newInput;
    queryInput.focus();

    // Handle query execution
    const handleExecute = async () => {
        const query = queryInput.value.trim();
        // Clean up previous download buttons
        document.querySelector('.download-buttons')?.remove();
        if (!query) return;

        // Save to history
        if (!queryHistory.includes(query)) {
            queryHistory.unshift(query);
            if (queryHistory.length > 50) queryHistory.pop();
            localStorage.setItem('queryHistory', JSON.stringify(queryHistory));
        }
        historyIndex = -1;

        try {
            const response = await fetch(`${window.baseUrl}/execute_query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            const data = await response.json();
            if (data.error) {
                resultArea.textContent = `Error: ${data.error}`;
                return;
            }

            if (data.results) {
                if (Array.isArray(data.results) && data.results.length > 0 && typeof data.results[0] === 'object') {
                    createQueryResultTable(resultArea, data.results);
                } else {
                    resultArea.textContent = JSON.stringify(data.results, null, 2);
                }
            }
         } catch (error) {
             resultArea.textContent = `Error: ${error.message}`;
         }
    };

    // Create query result table function
    function createQueryResultTable(resultArea, results) {
        resultArea.innerHTML = '';
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-scroll-wrapper';
    
    // Create download buttons container
    const downloadButtons = document.createElement('div');
    downloadButtons.className = 'download-buttons';
    
    const csvButton = document.createElement('button');
    csvButton.className = 'download-button';
    csvButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        </svg>
        CSV
    `;
    
    const xlsxButton = document.createElement('button');
    xlsxButton.className = 'download-button';
    xlsxButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        </svg>
        XLSX
    `;
    
    csvButton.onclick = () => {
        const filename = `query_result_${new Date().toISOString().slice(0,19).replace(/[:]/g, '-')}.csv`;
        if (!results || !results.length) return;
        const headers = Object.keys(results[0]);
        const csvContent = [
            headers.join(','),
            ...results.map(row => headers.map(header => {
                let value = row[header] ?? '';
                
                // Convert to string and handle special cases
                value = String(value);
                
                // Convert JSON objects to strings
                if (typeof row[header] === 'object' && row[header] !== null) {
                    value = JSON.stringify(row[header]);
                }
                
                // Escape values containing commas or quotes
                if (value.includes(',') || value.includes('"')) {
                    value = value.replace(/"/g, '""');
                    value = `"${value}"`;
                }
                return value;
            }).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    };
    
    xlsxButton.onclick = () => {
        const filename = `query_result_${new Date().toISOString().slice(0,19).replace(/[:]/g, '-')}.xlsx`;
        if (!results || !results.length) return;

        const headers = Object.keys(results[0]);
        fetch(`${window.baseUrl}/download/xlsx`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                data: results.map(row => {
                    const newRow = {};
                    headers.forEach(header => {
                        const value = row[header];
                        newRow[header] = typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
                    });
                    return newRow;
                }), 
                filename })
        })
        .then(async response => {
            if (response.ok) {
                return await response.blob();
            } else {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        })
        .then(blob => {
            // Create a new blob with explicit type
            const excelBlob = new Blob([blob], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            
            // Download file
            let link = document.createElement('a');
            const url = URL.createObjectURL(excelBlob);
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 100);
        })
        .catch(error => {
            console.error('Error downloading XLSX:', error);
            alert(
                'Failed to download Excel file. Please ensure the server supports Excel downloads ' +
                'or try downloading as CSV instead.'
            );
            link.click();
        });
    };
    
    downloadButtons.appendChild(csvButton);
    downloadButtons.appendChild(xlsxButton);
    
    // Add download buttons to query-buttons
    const queryButtons = document.querySelector('.query-buttons');
    if (queryButtons) {
        queryButtons.insertBefore(downloadButtons, queryButtons.firstChild);
    }
        const table = document.createElement('table');
        
        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        Object.keys(results[0]).forEach(key => {
            const th = document.createElement('th');
            th.textContent = key;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create body
        const tbody = document.createElement('tbody');
        results.forEach(row => {
            const tr = document.createElement('tr');
            Object.values(row).forEach(value => {
                const td = document.createElement('td');
                if (value === null) {
                    td.textContent = 'NULL';
                } else if (typeof value === 'object' || (typeof value === 'string' && value.trim().startsWith('{'))) {
                    const jsonView = formatJsonCell(value);
                    td.appendChild(jsonView);
                } else {
                    td.textContent = value;
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        
        tableWrapper.appendChild(table);
        resultArea.appendChild(tableWrapper);
        setTimeout(() => adjustColumnWidths(table), 0);
    }

    // Event listeners
    queryInput.addEventListener('keydown', (e) => {
        if (e.key === 'q' && e.ctrlKey) {
            e.stopPropagation();
        } else if (e.key === 'ArrowUp') {
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
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleExecute();

        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleExecute();
        }
    });

    // Set up close handlers
    queryPopup.querySelector('.query-close').addEventListener('click', handleClose);
    queryPopup.addEventListener('keydown', e => e.key === 'Escape' && handleClose());
});
let queryHandler = null;

// Initialize global query handler
function setupQueryHandler() {
    if (queryHandler) return; // Only set up once

    queryHandler = (e) => {
        if (!isAdminMode) return;
        if (!e.key || e.key.toLowerCase() !== 'q') return;
        
        const queryPopup = document.getElementById('queryPopup');
        const isQueryInputFocused = document.activeElement?.id === 'queryInput';
        const isQueryPopupVisible = queryPopup?.classList.contains('visible');
        
        if (isQueryInputFocused || isQueryPopupVisible) return;
        
        e.preventDefault();
        
        const queryInput = document.getElementById('queryInput');
        const executeButton = document.getElementById('executeQuery');
        const resultArea = document.getElementById('queryResult');
        
        // Load saved query history
        const queryHistory = JSON.parse(localStorage.getItem('queryHistory') || '[]');
        let historyIndex = -1;
        
        queryPopup.classList.add('visible');
        queryInput.value = '';
        resultArea.textContent = '';
        queryInput.focus();
        
        executeButton.innerHTML = `
            <span class="lang-ko">(Ctrl+Enter) 실행</span>
            <span class="lang-en">(Ctrl+Enter) Execute</span>
        `;

        // Clean up previous event listeners
        const newExecuteButton = executeButton.cloneNode(true);
        const newQueryInput = queryInput.cloneNode(true);
        executeButton.parentNode.replaceChild(newExecuteButton, executeButton);
        queryInput.parentNode.replaceChild(newQueryInput, queryInput);
        
        // Set up new event listeners
        newQueryInput.addEventListener('keydown', (e) => {
            if (e.key === 'q' && e.ctrlKey) {
                e.stopPropagation();
            }
            
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (historyIndex < queryHistory.length - 1) {
                    historyIndex++;
                    newQueryInput.value = queryHistory[historyIndex];
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (historyIndex > -1) {
                    historyIndex--;
                    newQueryInput.value = historyIndex === -1 ? '' : queryHistory[historyIndex];
                }
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleExecute();
            }
        });
        
        const handleExecute = async () => {
            const query = newQueryInput.value.trim();
            if (!query) return;
            
            // Save to history
            if (!queryHistory.includes(query)) {
                queryHistory.unshift(query);
                if (queryHistory.length > 50) queryHistory.pop();
                localStorage.setItem('queryHistory', JSON.stringify(queryHistory));
            }
            
            try {
                const response = await fetch(`${window.baseUrl}/execute_query`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query })
                });
                
                const data = await response.json();
                resultArea.textContent = data.error 
                    ? `Error: ${data.error}` 
                    : JSON.stringify(data.results, null, 2);
            } catch (error) {
                resultArea.textContent = `Error: ${error.message}`;
            }
        };
        
        newExecuteButton.addEventListener('click', handleExecute);
    };

    // Add global keydown listener
    document.addEventListener('keydown', queryHandler);
}

// Call setup when module loads
setupQueryHandler();
let schemaData = null;

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

// Load schema data immediately when script loads
loadSchemaData().then(() => {
    // Hide content and prepare initial arrangement
    const tablesContainer = document.getElementById('tables-container');
    const buttonsLine = document.querySelector('.table-buttons-line');
    const savedArrangement = localStorage.getItem('arrangementMode');
    const initialArrangement = savedArrangement !== null ? JSON.parse(savedArrangement) : false;
    
    if (tablesContainer && buttonsLine && schemaData) {
        const tableSections = document.querySelectorAll('.table-section');
        const sortedOrder = initialArrangement ? getSortedTableOrder() :
            Array.from(tableSections).map(section => section.getAttribute('data-table-name')).sort();

        sortedOrder.forEach(tableName => {
            const section = document.querySelector(`.table-section[data-table-name="${tableName}"]`);
            if (section) {
                tablesContainer.appendChild(section);
            }
            const pill = document.querySelector(`.table-button[data-table="${tableName}"]`);
            if (pill) {
                buttonsLine.appendChild(pill);
            }
        });

        // Show content after initial arrangement
        requestAnimationFrame(() => {
            tablesContainer.style.opacity = '1';
            buttonsLine.style.opacity = '1';
        });
    }
});

// Move query popup handler to module level for global availability
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('keydown', async (e) => {
        // Handle Q key for query popup
        // Prevent query popup when typing in query input or when query popup is visible
        const queryPopup = document.getElementById('queryPopup');
        const isQueryInputFocused = document.activeElement && document.activeElement.id === 'queryInput';
        const isQueryPopupVisible = queryPopup && queryPopup.classList.contains('visible');
        
        if (e.key && e.key.toLowerCase() === 'q' && isAdminMode && !isQueryInputFocused && !isQueryPopupVisible) {
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

            // Clean up previous event listeners
            const newExecuteButton = executeButton.cloneNode(true);
            const newQueryInput = queryInput.cloneNode(true);
            executeButton.parentNode.replaceChild(newExecuteButton, executeButton);
            queryInput.parentNode.replaceChild(newQueryInput, queryInput);
            
            newQueryInput.addEventListener('keydown', (e) => {
                if (e.key === 'q' && e.ctrlKey) {
                    e.stopPropagation(); // Prevent triggering the global Q handler
                }
            });

            // Handle query history navigation
            newQueryInput.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (historyIndex < queryHistory.length - 1) {
                        historyIndex++;
                        newQueryInput.value = queryHistory[historyIndex];
                    }
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (historyIndex > -1) {
                        historyIndex--;
                        newQueryInput.value = historyIndex === -1 ? '' : queryHistory[historyIndex];
                    }
                }
            });
            
            // Handle execute button click
            const handleExecute = async () => {
                const query = newQueryInput.value.trim();
                if (!query) return;
                
                // Save to history (if not already the most recent)
                if (!queryHistory.includes(query)) {
                    queryHistory.unshift(query);
                    if (queryHistory.length > 50) queryHistory.pop(); // Keep last 50 queries
                    localStorage.setItem('queryHistory', JSON.stringify(queryHistory));
                }
                historyIndex = -1;

                try {
                    const response = await fetch(`${window.baseUrl}/execute_query`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ query: newQueryInput.value })
                    });
                    
                    const data = await response.json();
                    if (data.error) {
                        resultArea.textContent = `Error: ${data.error}`;
                        return;
                    }
                    
                    if (data.results) {
                        if (Array.isArray(data.results) && data.results.length > 0 && typeof data.results[0] === 'object') {
                            resultArea.innerHTML = '';
                            const tableWrapper = document.createElement('div');
                            tableWrapper.className = 'table-scroll-wrapper';
                            const table = document.createElement('table');
                            
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
                            
                            tableWrapper.appendChild(table);
                            resultArea.appendChild(tableWrapper);
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
            
            newExecuteButton.addEventListener('click', handleExecute);
            
            // Handle Ctrl+Enter for execution
            let isExecuting = false;
            newQueryInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !isExecuting) {
                    e.preventDefault();
                    isExecuting = true;
                    handleExecute().finally(() => {
                        isExecuting = false;
                    });
                }
            });
            
            // Handle close button
            const closeButton = queryPopup.querySelector('.query-close');
            const handleClose = () => {
                queryPopup.classList.remove('visible');
            };
            
            closeButton.addEventListener('click', handleClose);
            
            // Handle Escape key
            queryPopup.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    handleClose();
                }
            });
        }
    });
});

// Initialize visibility control
(function hideContentImmediately() {
    const tablesContainer = document.getElementById('tables-container');
    const buttonsLine = document.querySelector('.table-buttons-line');
    if (tablesContainer && buttonsLine) {
        tablesContainer.style.opacity = '0';
        buttonsLine.style.opacity = '0';
        tablesContainer.style.transition = 'opacity 0.3s ease-out';
        buttonsLine.style.transition = 'opacity 0.3s ease-out';
    }
})();

// Set up initial arrangement and admin mode
document.addEventListener('DOMContentLoaded', async () => {
    const adminToggle = document.getElementById('adminToggle');
    const arrangementToggle = document.getElementById('arrangementToggle');
    
    // Set up admin mode
    if (adminToggle) {
        adminToggle.addEventListener('change', (e) => {
            const checked = e.target.checked;
            isAdminMode = checked;
            document.querySelectorAll('td.focused').forEach(cell => {
                cell.classList.remove('focused');
            });
        });
    }

    // Set up arrangement toggle
    if (arrangementToggle) {
        // Load and apply saved state
        const savedArrangement = localStorage.getItem('arrangementMode');
        const initialArrangement = savedArrangement !== null ? JSON.parse(savedArrangement) : false;
        
        arrangementToggle.checked = initialArrangement;
        isRelationMode = initialArrangement;

        // Add change event listener
        arrangementToggle.addEventListener('change', (e) => {
            isRelationMode = e.target.checked;
            localStorage.setItem('arrangementMode', JSON.stringify(e.target.checked));
            const tableSections = document.querySelectorAll('.table-section');
            const tablePills = document.querySelectorAll('.table-button');
            
            // Add transitions for smooth reordering
            tableSections.forEach(section => {
                section.style.transition = 'all 0.3s ease-out';
            });
            tablePills.forEach(pill => {
                pill.style.transition = 'all 0.3s ease-out';
            });
            
            if (isRelationMode) {
                arrangeByRelations();
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
});

function formatJsonCell(value) {
    try {
        // If it's already an object, use it directly
        const jsonObj = typeof value === 'object' ? value : JSON.parse(value);
        const formattedJson = JSON.stringify(jsonObj, null, 2);
        // Create a wrapper div with custom styling
        const wrapper = document.createElement('div');
        wrapper.className = 'json-cell';
        wrapper.style.whiteSpace = 'pre-wrap';
        wrapper.textContent = formattedJson;
        return wrapper;
    } catch (e) {
        return value;
    }
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
            data: Array.from(cells).map(cell => {
                const jsonCell = cell.querySelector('.json-cell');
                if (jsonCell) {
                    try {
                        // Parse JSON data for proper comparison
                        return JSON.parse(jsonCell.textContent);
                    } catch (e) {
                        return jsonCell.textContent;
                    }
                }
                return cell.textContent;
            })
        });
    });

    const fragment = document.createDocumentFragment();
    let animateAll = hasRowCountChanged && currentRows > 0; // Only animate if not initial load

    tableData.forEach((row, index) => {
        const rowKey = String(row[columns[0]]);
        const existing = existingRows.get(rowKey);
        const tr = document.createElement('tr');
        
        if (existing) {
            // Check if data changed by comparing actual values
            const hasChanged = columns.some((col, idx) => {
                const newVal = row[col];
                const existingVal = existing.data[idx];
                
                // Special handling for JSON comparison
                if (typeof newVal === 'object' && newVal !== null) {
                    try {
                        // Deep compare objects
                        return JSON.stringify(newVal) !== JSON.stringify(existingVal);
                    } catch (e) {
                        return true;
                    }
                }
                
                return String(newVal !== null ? newVal : '') !== String(existingVal !== null ? existingVal : '');
            });

            if (hasChanged) {
                tr.classList.add('changed');
            }
            
            columns.forEach((col, idx) => {
                const td = document.createElement('td');
                const val = row[col];
                
                if (val !== null) {
                    if (typeof val === 'object' || (typeof val === 'string' && val.trim().startsWith('{'))) {
                        const jsonView = formatJsonCell(val);
                        td.appendChild(jsonView);
                    } else {
                        td.textContent = String(val);
                    }
                } else {
                    td.textContent = '';
                }
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
                
                if (val !== null) {
                    if (typeof val === 'object' || (typeof val === 'string' && val.trim().startsWith('{'))) {
                        const jsonView = formatJsonCell(val);
                        td.appendChild(jsonView);
                    } else {
                        td.textContent = String(val);
                    }
                } else {
                    td.textContent = '';
                }
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
                
                if (val !== null) {
                    if (typeof val === 'object' || (typeof val === 'string' && val.trim().startsWith('{'))) {
                        const jsonView = formatJsonCell(val);
                        td.appendChild(jsonView);
                    } else {
                        td.textContent = String(val);
                    }
                } else {
                    td.textContent = '';
                }
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
        
        // Check if it's a JSON cell
        try {
            const parsedJson = JSON.parse(originalValue);
            const jsonView = formatJsonCell(parsedJson);
            cell.textContent = '';
            cell.appendChild(jsonView);
        } catch (e) {
            // Not JSON, restore as plain text
            cell.textContent = originalValue;
        }
        
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
    const startEditing = (cell, clickEvent) => {
        if (isEditing) {
            restoreCell(currentEditCell);
        }

        // Pause monitoring while editing
        const wasPaused = window.isMonitoringPaused;
        if (!wasPaused) {
            window.toggleMonitoring();
        }

        const jsonCell = cell.querySelector('.json-cell');
        originalValue = jsonCell ? jsonCell.textContent : cell.textContent;
        currentEditCell = cell;
        isEditing = true;
        cell.classList.add('editing');

        const input = document.createElement('textarea');
        input.style.overflow = 'hidden';
        input.style.resize = 'none';
        input.style.fontSize = jsonCell ? '0.9rem' : '1em';  // Match font size based on cell type
        input.style.boxSizing = 'border-box';

        input.value = jsonCell ? JSON.stringify(JSON.parse(originalValue), null, 2) : originalValue;

        // Adjust height on content change
        const adjustHeight = () => {
            input.style.height = '0'; // Reset height
            const minHeight = jsonCell ? 100 : Math.max(24, input.scrollHeight);
            const newHeight = Math.max(minHeight, input.scrollHeight);
            input.style.height = `${newHeight}px`;
        };

        // Handle input height adjustments
        input.addEventListener('input', adjustHeight);
        
        // Initial height adjustment
        cell.appendChild(input);
        requestAnimationFrame(() => {
            adjustHeight();

            // Focus the input and set cursor position if click event exists
            if (clickEvent) {
                input.focus();

                const cellRect = cell.getBoundingClientRect();
                const clickX = clickEvent.clientX - cellRect.left;
                const clickY = clickEvent.clientY - cellRect.top;
                const style = window.getComputedStyle(input);
                const lineHeight = parseFloat(style.lineHeight);
                const paddingLeft = parseFloat(style.paddingLeft);

                if (jsonCell) {
                    // Calculate line number from click position
                    const lines = input.value.split('\n');
                    let clickedLineIndex = Math.floor((clickY - parseFloat(style.paddingTop)) / lineHeight);
                    clickedLineIndex = Math.max(0, Math.min(clickedLineIndex, lines.length - 1));

                    // Get position within the line
                    const charWidth = getTextWidth('m', style.font); // Use 'm' as average character width
                    let position = 0;

                    // Add length of all previous lines
                    for (let i = 0; i < clickedLineIndex; i++) {
                        position += lines[i].length + 1; // +1 for newline
                    }

                    // Calculate position within the clicked line
                    const clickedLine = lines[clickedLineIndex];
                    const adjustedClickX = clickX - paddingLeft;
                    const charPosition = Math.floor(adjustedClickX / charWidth);
                    position += Math.max(0, Math.min(charPosition, clickedLine.length));

                    input.setSelectionRange(position, position);
                } else {
                    const charWidth = getTextWidth('a', style.font);
                    const estimatedPosition = Math.round(clickX / charWidth);
                    input.setSelectionRange(estimatedPosition, estimatedPosition);
                }
            } else {
                input.focus();
            }
        });

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
                    // Validate JSON if it's a JSON cell
                    if (jsonCell) {
                        JSON.parse(newValue); // Will throw if invalid
                    }
                    
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
                    
                    if (jsonCell) {
                        const newJsonView = formatJsonCell(newValue);
                        cell.textContent = '';
                        cell.appendChild(newJsonView);
                    } else {
                        cell.textContent = newValue;
                    }
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
                    // Show error message for all update failures
                    const errorMessage = error instanceof SyntaxError ? 'Invalid JSON format' : 'Failed to update value';
                    const koreanMessage = error instanceof SyntaxError ? 'JSON 형식이 잘못되었습니다' : '값 업데이트에 실패했습니다';
                    
                    const deletePopup = document.getElementById('deletePopup');
                    const icon = deletePopup.querySelector('.warning-icon');
                    icon.textContent = '⚠';
                    deletePopup.querySelector('.lang-en').textContent = errorMessage;
                    deletePopup.querySelector('.lang-ko').textContent = koreanMessage;
                    deletePopup.classList.add('show');
                    setTimeout(() => {
                        icon.textContent = '✓';
                        deletePopup.classList.remove('show');
                    }, 2000);
                    // Restore cell to original value
                    restoreCell(cell);
                    return;
                }
            } else {
                restoreCell(cell);
            }
            
            cell.classList.remove('editing');
            isEditing = false;
            currentEditCell = null;
        };

        // Handle Enter, Tab, and Escape events
        input.addEventListener('keydown', async (e) => {
            if (e.key === 'Tab' || e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault();
                const shouldSave = e.key !== 'Escape';

                if (e.key === 'Tab') {
                    // Save current cell
                    await handleEditComplete(input.value, true);
                    
                    // Find the next cell to edit
                    const currentRow = cell.closest('tr');
                    const cells = Array.from(currentRow.cells);
                    const currentIndex = cells.indexOf(cell);
                    
                    // Remove focus from current cell
                    cell.classList.remove('focused');
                    
                    if (!e.shiftKey && currentIndex < cells.length - 1) {
                        // Move to next cell in the same row
                        cells[currentIndex + 1].classList.add('focused');
                        startEditing(cells[currentIndex + 1]);
                    } else if (e.shiftKey && currentIndex > 0) {
                        // Move to previous cell in the same row
                        cells[currentIndex - 1].classList.add('focused');
                        startEditing(cells[currentIndex - 1]);
                    } else if (!e.shiftKey) {
                        // Move to first cell of next row
                        const nextRow = currentRow.nextElementSibling;
                        if (nextRow) {
                            nextRow.cells[0].classList.add('focused');
                            startEditing(nextRow.cells[0]);
                        }
                    } else {
                        // Move to last cell of previous row
                        const prevRow = currentRow.previousElementSibling;
                        if (prevRow) {
                            prevRow.cells[prevRow.cells.length - 1].classList.add('focused');
                            startEditing(prevRow.cells[prevRow.cells.length - 1]);
                        }
                    }
                } else {
                    handleEditComplete(input.value, shouldSave);
                }
            }
        });

        input.addEventListener('blur', (e) => {
            // Don't restore original value on blur if we're switching to another cell
            const relatedTarget = e.relatedTarget;
            if (!relatedTarget || !relatedTarget.closest('td')) {
                handleEditComplete(originalValue, false);
            }
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
            startEditing(cell, e);
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
            startEditing(cell, e);
        }
    });

    // Add document click handler for deselection
    document.addEventListener('click', (e) => {
        if (!isAdminMode) return;
        
        // Check if click was outside any table cell
        const clickedCell = e.target.closest('td');
        if (!clickedCell) {
            // Remove focus from any focused cells
            document.querySelectorAll('td.focused').forEach(td => {
                td.classList.remove('focused');
            });
        }
    });

    // Add keydown handler for 'D', 'A', 'X', and 'Q' keys
    document.addEventListener('keydown', async (e) => {
        // Handle Q key for query popup
        // Prevent query popup when typing in query input or when query popup is visible
        const queryPopup = document.getElementById('queryPopup');
        const isQueryInputFocused = document.activeElement && document.activeElement.id === 'queryInput';
        const isQueryPopupVisible = queryPopup && queryPopup.classList.contains('visible');
        // Removed query popup handler since it's now handled globally
        
                if ((e.key.toLowerCase() === 'd' || e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'x')
            && !isEditing && isAdminMode) {
            const focusedCell = table.querySelector('td.focused');
            if (!focusedCell) return;

            const row = focusedCell.closest('tr');
            if (!row) return;

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
    const PADDING = 20;
    const MIN_JSON_WIDTH = 0;
    const MAX_JSON_WIDTH = 400;
    const INDENT_SIZE = 2;
    const NESTING_PADDING = 10; // Reduced padding per nesting level

    columns.forEach((th, index) => {
        th.style.width = '';
        const cells = Array.from(table.querySelectorAll(`td:nth-child(${index + 1})`));
        const allCells = [th, ...cells];
        let maxWidth = 0;
        let hasJsonCells = false;

        allCells.forEach(cell => {
            const jsonCell = cell.querySelector('.json-cell');
            if (jsonCell) {
                hasJsonCells = true;
                try {
                    const jsonObj = JSON.parse(jsonCell.textContent);
                    const formattedJson = JSON.stringify(jsonObj, null, INDENT_SIZE);
                    const lines = formattedJson.split('\n');
                    const cellFont = window.getComputedStyle(jsonCell).font;

                    // Calculate optimal width based on longest meaningful content
                    let contentMaxWidth = 0;
                    lines.forEach(line => {
                        // Only consider content length, not full indentation
                        const content = line.trim();
                        // Ignore braces and brackets alone
                        if (content && !['[', ']', '{', '}', ','].includes(content)) {
                            contentMaxWidth = Math.max(contentMaxWidth, getTextWidth(content, cellFont));
                        }
                    });
                    maxWidth = Math.max(maxWidth, contentMaxWidth);
 
                } catch (e) {
                    maxWidth = Math.max(maxWidth, getTextWidth(jsonCell.textContent, window.getComputedStyle(jsonCell).font));
                }
            } else {
                const cellText = cell.textContent;
                const cellFont = window.getComputedStyle(cell).font;
                // For normal cells, consider word breaks for long content
                const cellWidth = Math.min(getTextWidth(cellText, cellFont), 300);
                maxWidth = Math.max(maxWidth, cellWidth);
            }
        });

        // Add padding and handle special cases
        let finalWidth = maxWidth + PADDING;
        if (hasJsonCells) {
            // Add fixed padding for JSON formatting
            finalWidth += NESTING_PADDING;
            finalWidth = Math.max(finalWidth, MIN_JSON_WIDTH);
            finalWidth = Math.min(finalWidth, MAX_JSON_WIDTH);
        }
        if (index === columns.length - 1) {
            finalWidth += 30;
        }

        // Apply the width uniformly
        [th, ...cells].forEach(cell => {
            cell.style.width = `${finalWidth}px`;
            cell.style.minWidth = `${finalWidth}px`;
            if (!cell.querySelector('.json-cell')) {
                cell.style.maxWidth = `${finalWidth}px`;
            }
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
        const defaultTooltip = pauseButton?.querySelector('.default-tooltip');
        const tempTooltip = pauseButton?.querySelector('.temp-tooltip');
        
        // Safely get currentLang, default to 'ko' if it's undefined
        let currentLang = 'ko';
        try {
            currentLang = getCurrentLanguage() || 'ko';
        } catch (e) {
            console.warn('Error getting current language, defaulting to Korean', e);
        }
        
        // Only trigger pause on first historical data load
        const hasOldData = Object.keys(tableChunks).some(tn => tableChunks[tn].end > ROWS_PER_LOAD);
        const noOldDataYet = !hasOldData;
        
        if (!window.isMonitoringPaused && !isHidden && noOldDataYet) {
            if (defaultTooltip && tempTooltip) {
                defaultTooltip.style.display = 'none';
                tempTooltip.style.display = 'block';
            }
            
            if (window.toggleMonitoring) {
                window.toggleMonitoring();
            }
    
            const limitedInfoSpan = document.getElementById(`${tableName}_limited_info`);
            if (limitedInfoSpan && translations) {
                limitedInfoSpan.innerHTML = `
                    <span class="lang-ko" style="display: ${currentLang === 'ko' ? 'inline' : 'none'}">${translations.ko?.scrollMore || '스크롤하여 더 많은 데이터 불러오기!'}</span>
                    <span class="lang-en" style="display: ${currentLang === 'en' ? 'inline' : 'none'}">${translations.en?.scrollMore || 'Scroll to load more data!'}</span>
                `;
                limitedInfoSpan.classList.add('visible');
            }
    
            // Hide temp tooltip after 3 seconds
            if (tempTooltip && defaultTooltip) {
                setTimeout(() => {
                    tempTooltip.style.display = 'none';
                    defaultTooltip.style.display = '';
                }, 3000);
            }
        }
    
        // Always fetch more data when scrolling to bottom, regardless of monitoring state
        fetchTableData(tableName, true, baseUrl, translations, currentLang, updateSingleTable);
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
            if (window.toggleMonitoring) {
                window.toggleMonitoring();
            }
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

// Function to arrange tables by relations
function arrangeByRelations() {
    if (!schemaData || !schemaData.relationships) {
        console.error('Schema data not available');
        return;
    }

    const tablesContainer = document.getElementById('tables-container');
    const buttonsLine = document.querySelector('.table-buttons-line');
    const tableSections = Array.from(tablesContainer.querySelectorAll('.table-section'));
    
    // Reset all groups
    tableSections.forEach(section => {
        section.classList.remove('relation-group');
        section.style.opacity = '0';
    });

    const sortedOrder = getSortedTableOrder();
    
    // Update DOM with animation
    sortedOrder.forEach((tableName, index) => {
        const section = document.querySelector(`.table-section[data-table-name="${tableName}"]`);
        const pill = document.querySelector(`.table-button[data-table="${tableName}"]`);
        
        if (section) {
            section.style.transition = 'all 0.3s ease-out';
            section.style.transitionDelay = `${index * 0.05}s`;
            tablesContainer.appendChild(section);
            if (hasRelations(tableName)) {
                section.classList.add('relation-group');
            }
            requestAnimationFrame(() => {
                section.style.opacity = '1';
            });
        }
        
        if (pill) {
            buttonsLine.appendChild(pill);
        }
    });

    // Clean up transitions
    setTimeout(() => {
        tableSections.forEach(section => {
            section.style.transition = '';
            section.style.transitionDelay = '';
        });
    }, sortedOrder.length * 50 + 300);
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
    
    // Reorder table pills
    sortedNames.forEach((tableName) => {
        const pill = tablePills.find(p =>
            p.getAttribute('data-table') === tableName
        );
        if (pill) {
            buttonsLine.appendChild(pill);
        }
    });
    
    // Clean up transitions
    setTimeout(() => {
        tableSections.forEach(section => {
            section.style.transition = '';
            section.style.transitionDelay = '';
        });
    }, sortedNames.length * 50 + 300);
}
