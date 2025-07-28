import { setCookie, getCookie, getTextWidth, getCurrentLanguage, t } from './utils.js';

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
    const queryInput = document.getElementById('queryInput');
    const resultArea = document.getElementById('queryResult');
    
    // Load saved query history
    const queryHistory = JSON.parse(localStorage.getItem('queryHistory') || '[]');
    let historyIndex = -1;

    // Function to handle closing the popup
    function handleClose() {
        queryPopup.classList.remove('visible');
        queryInput.value = '';
        // Only remove download buttons and example queries from within the query popup
        queryPopup.querySelector('.download-buttons')?.remove();
        queryPopup.querySelector('.example-queries')?.remove();
        resultArea.textContent = '';
    }

    // Create example queries container only if it doesn't exist
    if (!queryPopup.querySelector('.example-queries')) {
        const exampleContainer = document.createElement('div');
        exampleContainer.className = 'example-queries';
        exampleContainer.style.cssText = `
            display: flex;
            overflow-x: auto;
            gap: 8px;
            padding: 8px;
            margin-bottom: -4px;
            -webkit-overflow-scrolling: touch;
        `;
        
        // Example queries
        const examples = [
            { name: 'Select All', query: 'SELECT * FROM table_name', caution: false },
            { name: 'Basic Select', query: 'SELECT column1, column2 FROM table_name WHERE condition' },
            { name: 'Count Rows', query: 'SELECT COUNT(*) FROM table_name' },
            { name: 'Simple Join', query: 'SELECT * FROM table1 JOIN table2 ON table1.id = table2.id' },
            { name: 'Insert Row', query: 'INSERT INTO table_name (column1, column2) VALUES (value1, value2)' },
            { name: 'Update Row', query: 'UPDATE table_name SET column1 = value1 WHERE condition', caution: true },
            { name: 'Delete Row', query: 'DELETE FROM table_name WHERE condition', caution: true },
            { name: 'Group By', query: 'SELECT column1, COUNT(*) FROM table_name GROUP BY column1' },
            { name: 'Order By', query: 'SELECT * FROM table_name ORDER BY column_name DESC' },
            
            // Advanced SELECT queries
            { name: 'Select Distinct', query: 'SELECT DISTINCT column_name FROM table_name' },
            { name: 'Select Case', query: 'SELECT column1, CASE WHEN condition THEN value1 ELSE value2 END FROM table_name' },
            { name: 'Select With', query: 'WITH cte_name AS (SELECT * FROM table_name) SELECT * FROM cte_name' },
            { name: 'Select Into', query: 'SELECT * INTO backup_table FROM source_table' },
            { name: 'Select Top', query: 'SELECT TOP 10 * FROM table_name' },
            { name: 'Select Offset', query: 'SELECT * FROM table_name OFFSET 10 ROWS FETCH NEXT 10 ROWS ONLY' },
            
            // JOIN variations
            { name: 'Inner Join', query: 'SELECT * FROM table1 INNER JOIN table2 ON table1.id = table2.id' },
            { name: 'Left Join', query: 'SELECT * FROM table1 LEFT JOIN table2 ON table1.id = table2.id' },
            { name: 'Right Join', query: 'SELECT * FROM table1 RIGHT JOIN table2 ON table1.id = table2.id' },
            { name: 'Full Join', query: 'SELECT * FROM table1 FULL OUTER JOIN table2 ON table1.id = table2.id' },
            { name: 'Cross Join', query: 'SELECT * FROM table1 CROSS JOIN table2' },
            { name: 'Self Join', query: 'SELECT * FROM table1 t1 JOIN table1 t2 ON t1.id = t2.parent_id' },
            { name: 'Multiple Joins', query: 'SELECT * FROM table1 JOIN table2 ON table1.id = table2.id JOIN table3 ON table2.id = table3.id' },
            
            // Aggregate functions
            { name: 'Count Rows', query: 'SELECT COUNT(*) FROM table_name;' },
            { name: 'Average', query: 'SELECT AVG(column_name) FROM table_name;' },
            { name: 'Sum', query: 'SELECT SUM(column_name) FROM table_name' },
            { name: 'Max Value', query: 'SELECT MAX(column_name) FROM table_name' },
            { name: 'Min Value', query: 'SELECT MIN(column_name) FROM table_name' },
            { name: 'String Agg', query: 'SELECT STRING_AGG(column_name, \',\') FROM table_name' },
            
            // Complex conditions
            { name: 'Between', query: 'SELECT * FROM table_name WHERE column_name BETWEEN value1 AND value2' },
            { name: 'In List', query: 'SELECT * FROM table_name WHERE column_name IN (value1, value2, value3)' },
            { name: 'Like Pattern', query: 'SELECT * FROM table_name WHERE column_name LIKE \'pattern%\'' },
            { name: 'Null Check', query: 'SELECT * FROM table_name WHERE column_name IS NULL' },
            { name: 'Exists', query: 'SELECT * FROM table1 WHERE EXISTS (SELECT 1 FROM table2 WHERE table2.id = table1.id)' },
            
            // Having clauses
            { name: 'Having Count', query: 'SELECT column1, COUNT(*) FROM table_name GROUP BY column1 HAVING COUNT(*) > 1' },
            { name: 'Having Sum', query: 'SELECT column1, SUM(amount) FROM table_name GROUP BY column1 HAVING SUM(amount) > 1000' },
            { name: 'Having Avg', query: 'SELECT column1, AVG(amount) FROM table_name GROUP BY column1 HAVING AVG(amount) > 100' },
            
            // Subqueries
            { name: 'Subquery Where', query: 'SELECT * FROM table_name WHERE column_name IN (SELECT column_name FROM another_table)' },
            { name: 'Subquery From', query: 'SELECT * FROM (SELECT * FROM table_name) AS subquery' },
            { name: 'Correlated', query: 'SELECT * FROM table1 WHERE column1 > (SELECT AVG(column1) FROM table1 t2 WHERE t2.id = table1.id)' },
            
            // Table operations
            { name: 'Create Table', query: 'CREATE TABLE table_name (column1 datatype, column2 datatype)', caution: true },
            { name: 'Drop Table', query: 'DROP TABLE table_name', caution: true },
            { name: 'Truncate', query: 'TRUNCATE TABLE table_name', caution: true },
            { name: 'Rename Table', query: 'ALTER TABLE old_name RENAME TO new_name', caution: true },
            { name: 'Copy Table', query: 'CREATE TABLE new_table AS SELECT * FROM existing_table' },
            
            // Column operations
            { name: 'Add Column', query: 'ALTER TABLE table_name ADD COLUMN column_name datatype', caution: true },
            { name: 'Drop Column', query: 'ALTER TABLE table_name DROP COLUMN column_name', caution: true },
            { name: 'Modify Column', query: 'ALTER TABLE table_name ALTER COLUMN column_name TYPE new_datatype', caution: true },
            { name: 'Rename Column', query: 'ALTER TABLE table_name RENAME COLUMN old_name TO new_name', caution: true },
            
            // Constraint operations
            { name: 'Add Primary Key', query: 'ALTER TABLE table_name ADD PRIMARY KEY (column_name)', caution: true },
            { name: 'Add Foreign Key', query: 'ALTER TABLE table_name ADD FOREIGN KEY (column_name) REFERENCES other_table(id)', caution: true },
            { name: 'Add Unique', query: 'ALTER TABLE table_name ADD CONSTRAINT constraint_name UNIQUE (column_name)', caution: true },
            { name: 'Add Check', query: 'ALTER TABLE table_name ADD CONSTRAINT constraint_name CHECK (condition)', caution: true },
            
            // Index operations
            { name: 'Create Index', query: 'CREATE INDEX index_name ON table_name (column_name)' },
            { name: 'Create Unique Index', query: 'CREATE UNIQUE INDEX index_name ON table_name (column_name)' },
            { name: 'Drop Index', query: 'DROP INDEX index_name', caution: true },
            { name: 'Rebuild Index', query: 'ALTER INDEX index_name REBUILD' },
            
            // View operations
            { name: 'Create View', query: 'CREATE VIEW view_name AS SELECT * FROM table_name WHERE condition', caution: true },
            { name: 'Replace View', query: 'CREATE OR REPLACE VIEW view_name AS SELECT * FROM table_name', caution: true },
            { name: 'Drop View', query: 'DROP VIEW view_name', caution: true },
            { name: 'Materialized View', query: 'CREATE MATERIALIZED VIEW view_name AS SELECT * FROM table_name' },
            
            // Transaction control
            { name: 'Begin Transaction', query: 'BEGIN TRANSACTION' },
            { name: 'Commit', query: 'COMMIT' },
            { name: 'Rollback', query: 'ROLLBACK' },
            { name: 'Savepoint', query: 'SAVEPOINT savepoint_name' },
            
            // User management
            { name: 'Create User', query: 'CREATE USER username WITH PASSWORD \'password\'', caution: true },
            { name: 'Grant Select', query: 'GRANT SELECT ON table_name TO username', caution: true },
            { name: 'Revoke', query: 'REVOKE SELECT ON table_name FROM username', caution: true },
            { name: 'Drop User', query: 'DROP USER username', caution: true },
            
            // Database operations
            { name: 'Create Database', query: 'CREATE DATABASE database_name', caution: true },
            { name: 'Drop Database', query: 'DROP DATABASE database_name', caution: true },
            { name: 'Backup Database', query: 'BACKUP DATABASE database_name TO DISK = \'path\'', caution: true },
            { name: 'Restore Database', query: 'RESTORE DATABASE database_name FROM DISK = \'path\'' }
        ];
        
        examples.forEach(({name, query, caution}) => {
            const button = document.createElement('button');
            button.className = 'example-query-pill';
            if (caution) {
                button.classList.add('caution');
            }
            button.textContent = name;
            
            button.addEventListener('click', () => {
                const input = document.getElementById('queryInput');
                if (input) {
                    input.value = query;
                    input.focus();
                }
            });
            
            exampleContainer.appendChild(button);
        });
        
        // Insert container into query-header
        const queryHeader = queryPopup.querySelector('.query-header');
        const closeButton = queryHeader.querySelector('.query-close');
        queryHeader.insertBefore(exampleContainer, closeButton);

        // Add horizontal scroll handler for mouse wheel
        exampleContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
        // Increase scroll speed with multiplier
            exampleContainer.scrollLeft += e.deltaY * 3;
        });
    }

    return { queryPopup, executeButton, queryInput, resultArea, queryHistory, historyIndex, handleClose };
}

// New function to add download buttons to table headers
export function addDownloadButtons() {
    const tableSections = document.querySelectorAll('.table-section');
    tableSections.forEach(section => {
        const tableName = section.dataset.tableName;
        const dragHandle = section.querySelector('.drag-handle');
        if (dragHandle && !section.querySelector('.download-buttons')) {
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

            // Setup click handlers
            csvButton.onclick = async () => {
                try {
                    const response = await fetch(`${window.baseUrl}/download/${tableName}/csv`);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const blob = await response.blob();
                    downloadBlob(blob, `${tableName}_${new Date().toISOString().slice(0,19).replace(/[:]/g, '-')}.csv`);
                } catch (error) {
                    console.error('Error downloading CSV:', error);
                }
            };

            xlsxButton.onclick = async () => {
                try {
                    const response = await fetch(`${window.baseUrl}/download/${tableName}/xlsx`);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const blob = await response.blob();
                    downloadBlob(blob, `${tableName}_${new Date().toISOString().slice(0,19).replace(/[:]/g, '-')}.xlsx`);
                } catch (error) {
                    console.error('Error downloading XLSX:', error);
                }
            };

            // Create image settings button
            const imageButton = document.createElement('button');
            imageButton.className = 'download-button image-settings-button';
            imageButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                </svg>
                IMG
            `;

            // Setup image settings click handler
            imageButton.onclick = () => {
                openImageSettingsModal(tableName);
            };

            downloadButtons.appendChild(csvButton);
            downloadButtons.appendChild(xlsxButton);
            downloadButtons.appendChild(imageButton);
            dragHandle.insertAdjacentElement('afterend', downloadButtons);
        }
    });
}

// Helper function to handle blob downloads
function downloadBlob(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

// Image settings functionality
export let imageSettings = {
    showImages: false,
    pathPrefixes: [],
    imageScale: 1.0  // Default scale (1.0 = 100px, range 0.5-3.0)
};

// Load image settings from localStorage
function loadImageSettings() {
    const saved = localStorage.getItem('imageSettings');
    if (saved) {
        try {
            imageSettings = { ...imageSettings, ...JSON.parse(saved) };
        } catch (e) {
            console.warn('Failed to load image settings:', e);
        }
    }
}

// Save image settings to localStorage
function saveImageSettings() {
    localStorage.setItem('imageSettings', JSON.stringify(imageSettings));
}

// Check if a value looks like an image path
function isImagePath(value) {
    if (!value || typeof value !== 'string') return false;
    const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i;
    return imageExtensions.test(value.trim());
}

// Try to construct a valid image URL with prefixes
function tryImageUrl(imagePath) {
    if (!imagePath) return null;

    const urls = [];

    // Try the path as-is first (for web URLs)
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('/')) {
        urls.push(imagePath);
    }

    // Try with each prefix
    imageSettings.pathPrefixes.forEach(prefix => {
        if (prefix) {
            let fullPath;

            // Check if prefix is a local file path (Windows or Unix style)
            const isLocalPath = prefix.match(/^[A-Za-z]:\\/) || prefix.startsWith('/') || prefix.startsWith('./') || prefix.startsWith('../');

            if (isLocalPath) {
                // For local paths, construct the full path
                const separator = prefix.includes('\\') ? '\\' : '/';
                const cleanPrefix = prefix.endsWith(separator) ? prefix : prefix + separator;
                const cleanPath = imagePath.startsWith(separator) ? imagePath.substring(1) : imagePath;
                fullPath = cleanPrefix + cleanPath;

                // Convert Windows paths to file:// URLs for local access
                if (fullPath.match(/^[A-Za-z]:\\/)) {
                    // Windows path - convert to file:// URL
                    const fileUrl = 'file:///' + fullPath.replace(/\\/g, '/');
                    urls.push(fileUrl);
                } else {
                    // Unix-style path
                    urls.push('file://' + fullPath);
                }

                // Also try the backend endpoint (if available)
                const encodedPath = encodeURIComponent(fullPath);
                urls.push(`${window.baseUrl}/api/local-image?path=${encodedPath}`);
            } else {
                // For web URLs, handle normally
                const cleanPrefix = prefix.endsWith('/') ? prefix : prefix + '/';
                const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
                fullPath = cleanPrefix + cleanPath;
                urls.push(fullPath);
            }
        }
    });

    return urls;
}

// Create image element with fallback
function createImageElement(imagePath) {
    const urls = tryImageUrl(imagePath);
    if (!urls || urls.length === 0) return null;

    const container = document.createElement('div');
    container.className = 'table-image-container';
    container.style.display = 'inline-block';
    container.style.position = 'relative';

    const img = document.createElement('img');
    const baseSize = 100; // Base size in pixels
    const scaledSize = Math.round(baseSize * imageSettings.imageScale);
    img.style.maxWidth = `${scaledSize}px`;
    img.style.maxHeight = `${scaledSize}px`;
    img.style.objectFit = 'contain';
    img.style.border = '1px solid var(--md-sys-color-outline-variant)';
    img.style.borderRadius = '4px';
    img.style.display = 'block';
    img.alt = imagePath;
    img.title = `Click to view full size: ${imagePath}`;

    let currentUrlIndex = 0;
    let hasLoaded = false;

    const tryNextUrl = () => {
        if (currentUrlIndex < urls.length && !hasLoaded) {
            console.log(`Trying to load image: ${urls[currentUrlIndex]}`);
            img.src = urls[currentUrlIndex];
            currentUrlIndex++;
        } else if (!hasLoaded) {
            // All URLs failed, return null to show as normal text
            return null;
        }
    };

    img.onload = () => {
        hasLoaded = true;
        console.log(`Successfully loaded image: ${img.src}`);
    };

    img.onerror = (e) => {
        console.warn(`Failed to load image: ${img.src}`, e);
        tryNextUrl();
    };

    // Add click event for full-view modal
    container.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openImageFullview(imagePath, img.src);
    });

    container.appendChild(img);
    tryNextUrl(); // Start with first URL

    return container;
}

// Open image settings modal
function openImageSettingsModal(tableName) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('imageSettingsModal');
    if (!modal) {
        modal = createImageSettingsModal();
        document.body.appendChild(modal);
    }

    // Update modal content for this table
    updateImageSettingsModal(modal, tableName);

    // Show modal
    modal.classList.add('visible');
}

// Create the image settings modal
function createImageSettingsModal() {
    const modal = document.createElement('div');
    modal.id = 'imageSettingsModal';
    modal.className = 'image-settings-modal';

    modal.innerHTML = `
        <div class="image-settings-content">
            <div class="image-settings-header">
                <h3>
                    <span class="lang-ko">이미지 표시 설정</span>
                    <span class="lang-en">Image Display Settings</span>
                    <span class="lang-vi">Cài đặt hiển thị hình ảnh</span>
                </h3>
                <button class="image-settings-close" type="button">×</button>
            </div>
            <div class="image-settings-body">
                <div class="setting-group">
                    <div class="switch-container">
                        <span class="switch-label">
                            <span class="lang-ko">경로 대신 테이블에 이미지 표시</span>
                            <span class="lang-en">Show images in table instead of paths</span>
                            <span class="lang-vi">Hiển thị hình ảnh trong bảng thay vì đường dẫn</span>
                        </span>
                        <md-switch id="showImagesToggle" aria-label="Show Images Toggle"></md-switch>
                    </div>
                </div>

                <div class="setting-group">
                    <label class="setting-label">
                        <span class="lang-ko">이미지 크기:</span>
                        <span class="lang-en">Image Scale:</span>
                        <span class="lang-vi">Tỷ lệ hình ảnh:</span>
                    </label>
                    <div class="scale-slider-container">
                        <div class="scale-slider-wrapper">
                            <span class="scale-label-min">50%</span>
                            <input type="range" id="imageScaleSlider" min="0.5" max="3.0" step="0.1" value="1.0" class="scale-slider">
                            <span class="scale-label-max">300%</span>
                        </div>
                        <div class="scale-value-display">
                            <span id="scaleValueText">100%</span>
                            <span class="scale-size-hint">(<span id="scaleSizeHint">100px</span>)</span>
                        </div>
                    </div>
                </div>

                <div class="setting-group">
                    <label class="setting-label">
                        <span class="lang-ko">이미지 경로 접두사:</span>
                        <span class="lang-en">Image Path Prefixes:</span>
                        <span class="lang-vi">Tiền tố đường dẫn hình ảnh:</span>
                    </label>
                    <div class="prefix-list" id="prefixList">
                        <!-- Prefixes will be added here -->
                    </div>
                    <div class="prefix-input-group">
                        <input type="text" id="newPrefixInput" placeholder="Enter image path prefix (e.g., https://example.com/images/)" class="prefix-input">
                        <button type="button" id="addPrefixBtn" class="add-prefix-btn">
                            <span class="lang-ko">추가</span>
                            <span class="lang-en">Add</span>
                            <span class="lang-vi">Thêm</span>
                        </button>
                    </div>
                    <div class="prefix-help">
                        <small>
                            <span class="lang-ko">
                                <strong>이미지를 찾기 위한 URL 접두사 추가:</strong><br>
                                • 웹 이미지: <code>https://example.com/images/</code><br>
                                • 로컬 파일: <code>C:\\path\\to\\images\\</code> 또는 <code>/home/user/images/</code><br>
                                <em>참고: 로컬 파일 접근은 브라우저 보안에 의해 제한될 수 있습니다. 로컬 파일의 최상의 결과를 위해 로컬 웹 서버 설정을 고려하세요.</em>
                            </span>
                            <span class="lang-en">
                                <strong>Add URL prefixes to help locate images:</strong><br>
                                • For web images: <code>https://example.com/images/</code><br>
                                • For local files: <code>C:\\path\\to\\images\\</code> or <code>/home/user/images/</code><br>
                                <em>Note: Local file access may be limited by browser security. For best results with local files, consider setting up a local web server.</em>
                            </span>
                            <span class="lang-vi">
                                <strong>Thêm tiền tố URL để giúp định vị hình ảnh:</strong><br>
                                • Cho hình ảnh web: <code>https://example.com/images/</code><br>
                                • Cho tệp cục bộ: <code>C:\\path\\to\\images\\</code> hoặc <code>/home/user/images/</code><br>
                                <em>Lưu ý: Truy cập tệp cục bộ có thể bị hạn chế bởi bảo mật trình duyệt. Để có kết quả tốt nhất với tệp cục bộ, hãy xem xét thiết lập máy chủ web cục bộ.</em>
                            </span>
                        </small>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Set up event listeners
    setupImageSettingsEventListeners(modal);

    return modal;
}

// Update modal content for specific table
function updateImageSettingsModal(modal, tableName) {
    // Load current settings
    loadImageSettings();

    // Update toggle state
    const toggle = modal.querySelector('#showImagesToggle');
    toggle.selected = imageSettings.showImages;

    // Update scale slider
    const scaleSlider = modal.querySelector('#imageScaleSlider');
    const scaleValueText = modal.querySelector('#scaleValueText');
    const scaleSizeHint = modal.querySelector('#scaleSizeHint');
    if (scaleSlider) {
        scaleSlider.value = imageSettings.imageScale;
        scaleValueText.textContent = Math.round(imageSettings.imageScale * 100) + '%';
        scaleSizeHint.textContent = Math.round(100 * imageSettings.imageScale) + 'px';
    }

    // Update prefix list
    updatePrefixList(modal);

    // Store current table name for reference
    modal.dataset.tableName = tableName;
}

// Update the prefix list display
function updatePrefixList(modal) {
    const prefixList = modal.querySelector('#prefixList');
    prefixList.innerHTML = '';

    imageSettings.pathPrefixes.forEach((prefix, index) => {
        const prefixItem = document.createElement('div');
        prefixItem.className = 'prefix-item';
        prefixItem.innerHTML = `
            <span class="prefix-text">${prefix}</span>
            <button type="button" class="remove-prefix-btn" data-index="${index}">×</button>
        `;
        prefixList.appendChild(prefixItem);
    });
}

// Set up event listeners for the modal
function setupImageSettingsEventListeners(modal) {
    // Close button
    modal.querySelector('.image-settings-close').addEventListener('click', () => {
        modal.classList.remove('visible');
    });

    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('visible');
        }
    });

    // Show images toggle switch
    const showImagesToggle = modal.querySelector('#showImagesToggle');
    if (showImagesToggle) {
        showImagesToggle.addEventListener('change', (e) => {
            imageSettings.showImages = e.target.selected;
            saveImageSettings();

            // Refresh all tables to apply image settings immediately
            document.querySelectorAll('.table-section').forEach(section => {
                const tableName = section.getAttribute('data-table-name');
                if (tableName) {
                    refreshTableWithImageSettings(tableName);
                }
            });
        });
    }

    // Image scale slider
    const scaleSlider = modal.querySelector('#imageScaleSlider');
    const scaleValueText = modal.querySelector('#scaleValueText');
    const scaleSizeHint = modal.querySelector('#scaleSizeHint');
    if (scaleSlider) {
        scaleSlider.addEventListener('input', (e) => {
            const scale = parseFloat(e.target.value);
            imageSettings.imageScale = scale;
            saveImageSettings();

            // Update display values
            scaleValueText.textContent = Math.round(scale * 100) + '%';
            scaleSizeHint.textContent = Math.round(100 * scale) + 'px';

            // Refresh all tables to apply new scale immediately
            document.querySelectorAll('.table-section').forEach(section => {
                const tableName = section.getAttribute('data-table-name');
                if (tableName) {
                    refreshTableWithImageSettings(tableName);
                }
            });
        });
    }

    // Add prefix button
    modal.querySelector('#addPrefixBtn').addEventListener('click', () => {
        const input = modal.querySelector('#newPrefixInput');
        const prefix = input.value.trim();
        if (prefix && !imageSettings.pathPrefixes.includes(prefix)) {
            imageSettings.pathPrefixes.push(prefix);
            saveImageSettings();
            updatePrefixList(modal);
            input.value = '';

            // Refresh all tables to apply new prefix immediately
            document.querySelectorAll('.table-section').forEach(section => {
                const tableName = section.getAttribute('data-table-name');
                if (tableName) {
                    refreshTableWithImageSettings(tableName);
                }
            });
        }
    });

    // Enter key in prefix input
    modal.querySelector('#newPrefixInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            modal.querySelector('#addPrefixBtn').click();
        }
    });

    // Remove prefix buttons (delegated event)
    modal.querySelector('#prefixList').addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-prefix-btn')) {
            const index = parseInt(e.target.dataset.index);
            imageSettings.pathPrefixes.splice(index, 1);
            saveImageSettings();
            updatePrefixList(modal);

            // Refresh all tables to apply prefix removal immediately
            document.querySelectorAll('.table-section').forEach(section => {
                const tableName = section.getAttribute('data-table-name');
                if (tableName) {
                    refreshTableWithImageSettings(tableName);
                }
            });
        }
    });
}

// Refresh table with image settings applied
function refreshTableWithImageSettings(tableName) {
    const tableSection = document.querySelector(`.table-section[data-table-name="${tableName}"]`);
    if (!tableSection) return;

    const tbody = tableSection.querySelector('tbody');
    if (!tbody) return;

    // Get current table data and columns
    const table = tableSection.querySelector('table');
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent);

    // Re-render all cells to apply image settings
    tbody.querySelectorAll('tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        cells.forEach((cell, index) => {
            // Get the original data value, not the current display content
            let originalValue = cell.dataset.originalValue;

            // If no original value is stored, try to extract it from current content
            if (!originalValue) {
                const imageContainer = cell.querySelector('.table-image-container');
                if (imageContainer) {
                    // If there's an image container, get the original path from img alt
                    const img = imageContainer.querySelector('img');
                    if (img) {
                        originalValue = img.alt;
                    }
                } else {
                    // No image container, use text content as original value
                    originalValue = cell.textContent;
                }
                // Store the original value for future use
                cell.dataset.originalValue = originalValue;
            }

            if (imageSettings.showImages && isImagePath(originalValue)) {
                const imageElement = createImageElement(originalValue);
                if (imageElement) {
                    cell.innerHTML = '';
                    cell.appendChild(imageElement);
                } else {
                    // Image element creation failed (image not found), show as text
                    cell.innerHTML = '';
                    cell.textContent = originalValue;
                }
            } else if (!imageSettings.showImages && cell.querySelector('.table-image-container')) {
                // Convert back to text if images are disabled
                cell.innerHTML = '';
                cell.textContent = originalValue;
            }
        });
    });
}

// Initialize image settings on page load
function initializeImageSettings() {
    loadImageSettings();
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
    // Only remove download buttons from query popup, not from table sections
    queryPopup.querySelector('.download-buttons')?.remove();
    resultArea.textContent = '';

    // Set up execute button text
    executeButton.innerHTML = `
        <span class="lang-ko">(Ctrl+Enter) 실행</span>
        <span class="lang-en">(Ctrl+Enter) Execute</span>
        <span class="lang-vi">(Ctrl+Enter) Thực thi</span>
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
        // Clean up previous download buttons only from query popup
        queryPopup.querySelector('.download-buttons')?.remove();
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
        } else if (e.key === 'Tab') {
            e.preventDefault();
            if (!queryInput.value && queryInput.placeholder) {
                queryInput.value = queryInput.placeholder;
                queryInput.selectionStart = queryInput.value.length;
                queryInput.selectionEnd = queryInput.value.length;
            }
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
            <span class="lang-vi">(Ctrl+Enter) Thực thi</span>
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

// Helper function to get current database key
function getCurrentDatabaseKey() {
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

// Helper function to save table order to cookies
function saveTableOrderFromArrangement() {
    const currentDb = getCurrentDatabaseKey();
    if (!currentDb) {
        console.log('No current database, using simple cookie key');
        // Fallback for monitor.js compatibility
        const tableOrder = Array.from(document.querySelectorAll('.table-section'))
            .map(section => section.dataset.tableName);
        setCookie('tableOrder', JSON.stringify(tableOrder), 365);
        return;
    }

    const tableOrder = Array.from(document.querySelectorAll('.table-section'))
        .map(section => section.dataset.tableName);
    setCookie(`tableOrder_${currentDb}`, JSON.stringify(tableOrder), 365);
    console.log('Saved table order:', tableOrder);
}

// Helper function to get sorted table order based on relationships
function getSortedTableOrder() {
    console.log('getSortedTableOrder() called');
    console.log('schemaData available:', !!schemaData);
    console.log('relationships available:', !!schemaData?.relationships);

    if (!schemaData || !schemaData.relationships) {
        console.log('No schema data, returning alphabetical order');
        return Array.from(document.querySelectorAll('.table-section'))
            .map(section => section.getAttribute('data-table-name'));
    }

    console.log('Building relationship graph from', schemaData.relationships.length, 'relationships');

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

    console.log('Final sorted table order:', sortedTables);
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
        if (!response.ok) {
            // If no database is configured, that's expected - just log it quietly
            if (response.status === 400) {
                console.log('Schema data not available (no database configured)');
                return;
            }
            throw new Error(`Failed to fetch schema: ${response.status}`);
        }
        const data = await response.json();
        if (data.error) {
            console.log('Schema data not available:', data.error);
            return;
        }
        schemaData = data;
        console.log('Schema data loaded:', schemaData);
    } catch (error) {
        console.log('Schema data not available:', error.message);
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
                <span class="lang-vi">(Ctrl+Enter) Thực thi</span>
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
    // Initialize image settings
    initializeImageSettings();

    // Ensure translations are applied to table interface elements
    if (window.updateTranslations) {
        window.updateTranslations();
    } else if (window.updateDataI18nElements) {
        const currentLang = document.documentElement.getAttribute('data-lang') || 'en';
        window.updateDataI18nElements(currentLang);
    }

    // Also try again after a short delay in case i18next is still initializing
    setTimeout(() => {
        if (window.updateTranslations) {
            window.updateTranslations();
        } else if (window.updateDataI18nElements) {
            const currentLang = document.documentElement.getAttribute('data-lang') || 'en';
            window.updateDataI18nElements(currentLang);
        }
    }, 500);

    const adminToggle = document.getElementById('adminToggle');
    const arrangementToggle = document.getElementById('arrangementToggle');
    
    // Set up admin mode
    if (adminToggle) {
        adminToggle.addEventListener('change', (e) => {
            const selected = e.target.selected;
            isAdminMode = selected;
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
        
        arrangementToggle.selected = initialArrangement;
        isRelationMode = initialArrangement;

        // Apply initial arrangement based on saved state
        console.log('Applying initial arrangement:', initialArrangement ? 'smart' : 'alphabetical');
        if (initialArrangement) {
            arrangeByRelations();
        } else {
            arrangeAlphabetically();
        }

        // Add change event listener
        arrangementToggle.addEventListener('change', (e) => {
            const isSmartMode = e.target.selected;
            console.log('Arrangement toggle changed to:', isSmartMode ? 'SMART ORDER (ON)' : 'ALPHABETICAL (OFF)');
            isRelationMode = isSmartMode;
            localStorage.setItem('arrangementMode', JSON.stringify(isSmartMode));
            const tableSections = document.querySelectorAll('.table-section');
            const tablePills = document.querySelectorAll('.table-button');

            console.log('Found tableSections:', tableSections.length);
            console.log('Found tablePills:', tablePills.length);

            // Add transitions for smooth reordering
            tableSections.forEach(section => {
                section.style.transition = 'all 0.3s ease-out';
            });
            tablePills.forEach(pill => {
                pill.style.transition = 'all 0.3s ease-out';
            });

            if (isRelationMode) {
                console.log('Switching to SMART ORDER (relation mode)');
                arrangeByRelations();
            } else {
                console.log('Switching to ALPHABETICAL mode');
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
    const noDataMessage = tbody.querySelector('.no-data-message');
        const wasNoDataFocused = focusedCell && focusedCell.querySelector('.no-data-message');
        
        if (focusedCell && !wasNoDataFocused) {
        focusedRowKey = focusedCell.closest('tr').querySelector('td').textContent;
        const cells = Array.from(focusedCell.closest('tr').querySelectorAll('td'));
        focusedCellIndex = cells.indexOf(focusedCell);
    }

    // Store current view for comparison using stored raw data when available
    const existingRows = new Map();

    // Try to use stored raw data from previous update (avoids DOM extraction issues with images)
    if (tbody.dataset.lastRawData && tbody.dataset.lastColumns) {
        try {
            const lastRawData = JSON.parse(tbody.dataset.lastRawData);
            const lastColumns = JSON.parse(tbody.dataset.lastColumns);

            lastRawData.forEach((row) => {
                const rowKey = String(row[lastColumns[0]]);
                existingRows.set(rowKey, {
                    data: lastColumns.map(col => row[col])
                });
            });


        } catch (e) {
            console.warn('Failed to parse stored raw data, falling back to DOM extraction:', e);
        }
    }

    // Fallback to DOM extraction if no stored data (first load or error)
    if (existingRows.size === 0) {
        tbody.querySelectorAll('tr').forEach(tr => {
            const cells = tr.querySelectorAll('td');
            const rowKey = cells[0]?.textContent;
            existingRows.set(rowKey, {
                element: tr,
                data: Array.from(cells).map(cell => {
                    const jsonCell = cell.querySelector('.json-cell');
                    if (jsonCell) {
                        try {
                            return JSON.parse(jsonCell.textContent);
                        } catch (e) {
                            return jsonCell.textContent;
                        }
                    }
                    return cell.textContent;
                })
            });
        });

    }

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
                    // Store original value for image refresh functionality
                    td.dataset.originalValue = String(val);

                    if (typeof val === 'object' || (typeof val === 'string' && val.trim().startsWith('{'))) {
                        const jsonView = formatJsonCell(val);
                        td.appendChild(jsonView);
                    } else if (imageSettings.showImages && isImagePath(String(val))) {
                        const imageElement = createImageElement(String(val));
                        if (imageElement) {
                            td.appendChild(imageElement);
                        } else {
                            td.textContent = String(val);
                        }
                    } else {
                        td.textContent = String(val);
                    }
                } else {
                    td.textContent = '';
                    td.dataset.originalValue = '';
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
                    // Store original value for image refresh functionality
                    td.dataset.originalValue = String(val);

                    if (typeof val === 'object' || (typeof val === 'string' && val.trim().startsWith('{'))) {
                        const jsonView = formatJsonCell(val);
                        td.appendChild(jsonView);
                    } else if (imageSettings.showImages && isImagePath(String(val))) {
                        const imageElement = createImageElement(String(val));
                        if (imageElement) {
                            td.appendChild(imageElement);
                        } else {
                            td.textContent = String(val);
                        }
                    } else {
                        td.textContent = String(val);
                    }
                } else {
                    td.textContent = '';
                    td.dataset.originalValue = '';
                }
                tr.appendChild(td);
            });
        }
        
        fragment.appendChild(tr);
    });

    // Store raw data for next comparison (to avoid DOM extraction issues with images)
    tbody.dataset.lastRawData = JSON.stringify(tableData);
    tbody.dataset.lastColumns = JSON.stringify(columns);

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

    // Restore focused cell state
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
    } else if (wasNoDataFocused && !tableData.length) {
        // If "No data available" cell was focused and table is still empty, restore focus
        const noDataCell = tbody.querySelector('td');
        if (noDataCell && noDataCell.querySelector('.no-data-message')) {
            noDataCell.classList.add('focused');
        }
    }

    // Reapply filters after updating rows (only if not already filtered by database)
    const table = tbody.closest('table');
    if (table && table.querySelectorAll('.filter-btn').length > 0) {
        const container = table.closest('.table-container');
        const tableId = container ? container.id : 'default-table';
        const allFilters = tableFilters.get(tableId) || {};

        // Only apply frontend filtering if no database filters are active
        if (Object.keys(allFilters).length === 0) {
            filterTableFrontend(table);
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
    columns.forEach((col, index) => {
        const th = document.createElement('th');

        // Header content container
        const headerContent = document.createElement('div');
        headerContent.className = 'header-content';

        const span = document.createElement('span');
        span.textContent = col;
        span.className = 'header-text';
        headerContent.appendChild(span);

        // Sort button
        const sortBtn = document.createElement('button');
        sortBtn.className = 'sort-btn';
        sortBtn.setAttribute('data-column', col);
        sortBtn.setAttribute('data-column-index', index);
        sortBtn.innerHTML = '↕'; // Up-down arrow for unsorted
        sortBtn.title = `Sort ${col}`;
        headerContent.appendChild(sortBtn);

        // Filter button
        const filterBtn = document.createElement('button');
        filterBtn.className = 'filter-btn';
        filterBtn.setAttribute('data-column', col);
        filterBtn.setAttribute('data-column-index', index);
        filterBtn.innerHTML = '⋮'; // Three dots filter icon
        filterBtn.title = `Filter ${col}`;
        headerContent.appendChild(filterBtn);

        th.appendChild(headerContent);

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

    // Add filter functionality
    addFilterListeners(table, columns);

    if (!tableData || !tableData.length) {
        const noDataRow = document.createElement('tr');
        const noDataCell = document.createElement('td');
        const wasFocused = tableDiv.querySelector('.table-scroll-wrapper td.focused') !== null;
        noDataCell.colSpan = columns.length;
        noDataCell.innerHTML = `<span class="lang-ko no-data-message">데이터가 없습니다.</span><span class="lang-en no-data-message">No data available.</span>`;
        noDataCell.style.textAlign = 'center';
        if (wasFocused) {
            noDataCell.classList.add('focused');
        }
        noDataRow.appendChild(noDataCell);
        tbody.appendChild(noDataRow);
        return;
    }

    updateTableRows(tbody, tableData, columns);
}

export function updateSingleTable(tableName, tableInfo, translations, currentLang, fetchTableData, baseUrl) {
    const tableDiv = document.getElementById(tableName);
    if (!tableDiv) return;
    
    // Add download buttons if they don't exist
    const tableSection = tableDiv.closest('.table-section');
    if (tableSection) {
        const dragHandle = tableSection.querySelector('.drag-handle');
        if (dragHandle && !tableSection.querySelector('.download-buttons')) {
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
                if (!tableInfo.data || !tableInfo.data.length) return;
                const filename = `${tableName}_${new Date().toISOString().slice(0,19).replace(/[:]/g, '-')}.csv`;
                const headers = tableInfo.columns;
                const csvContent = [
                    headers.join(','),
                    ...tableInfo.data.map(row => headers.map(header => {
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
                if (!tableInfo.data || !tableInfo.data.length) return;
                const filename = `${tableName}_${new Date().toISOString().slice(0,19).replace(/[:]/g, '-')}.xlsx`;
                fetch(`${baseUrl}/download/xlsx`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        data: tableInfo.data,
                        filename
                    })
                })
                .then(async response => {
                    if (response.ok) {
                        return await response.blob();
                    } else {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                })
                .then(blob => {
                    const excelBlob = new Blob([blob], { 
                        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
                    });
                    const link = document.createElement('a');
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
                });
            };

            // Create image settings button
            const imageButton = document.createElement('button');
            imageButton.className = 'download-button image-settings-button';
            imageButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                </svg>
                IMG
            `;

            // Setup image settings click handler
            imageButton.onclick = () => {
                openImageSettingsModal(tableName);
            };

            downloadButtons.appendChild(csvButton);
            downloadButtons.appendChild(xlsxButton);
            downloadButtons.appendChild(imageButton);
            dragHandle.insertAdjacentElement('afterend', downloadButtons);
        }
    }

    const countSpan = document.getElementById(`${tableName}_count`);
    if (countSpan) {
        countSpan.textContent = `(${tableInfo.count} ${t('ui.rows')})`;
    }

    const isHidden = tableDiv.classList.contains('hidden-table');
    const limitedInfoSpan = document.getElementById(`${tableName}_limited_info`);
    if (limitedInfoSpan && !isHidden) {
        if (tableInfo.limited) {
            limitedInfoSpan.innerHTML = `
                <span class="lang-ko">${t('ui.scrollMore')}</span>
                <span class="lang-en">${t('ui.scrollMore')}</span>
                <span class="lang-vi">${t('ui.scrollMore')}</span>
            `;
        } else {
            limitedInfoSpan.innerHTML = `
                <span class="lang-ko">${t('ui.allDataLoaded')}</span>
                <span class="lang-en">${t('ui.allDataLoaded')}</span>
                <span class="lang-vi">${t('ui.allDataLoaded')}</span>
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
        const wasFocused = tbody?.querySelector('td.focused') !== null;
        if (tbody) {
            if (!tableInfo.data || !tableInfo.data.length) {
                tbody.innerHTML = '';
                const noDataRow = document.createElement('tr');
                const noDataCell = document.createElement('td');
                noDataCell.colSpan = tableInfo.columns.length;
                noDataCell.innerHTML = `<span class="lang-ko no-data-message">${t('ui.noData')}</span><span class="lang-en no-data-message">${t('ui.noData')}</span><span class="lang-vi no-data-message">${t('ui.noData')}</span>`;
                noDataCell.style.textAlign = 'center';
                if (wasFocused) {
                    noDataCell.classList.add('focused');
                }
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
    // Only get header cells from the first row (not filter row)
    const headerRow = table.querySelector('thead tr:first-child');
    const thElements = headerRow.querySelectorAll('th');

    thElements.forEach((th, index) => {
        const resizer = th.querySelector('.resizer');

        // Skip if no resizer found
        if (!resizer) return;

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

    // Build URL with filter parameters if filters are active
    const filterParams = new URLSearchParams();
    filterParams.append('limit', ROWS_PER_LOAD.toString());
    filterParams.append('offset', offset.toString());

    // Get active filters for this table
    const allFilters = tableFilters.get(tableName) || {};
    Object.entries(allFilters).forEach(([columnName, selectedValues]) => {
        if (columnName && selectedValues.length > 0) {
            filterParams.append(`filter_${columnName}`, selectedValues.join(','));
        }
    });

    // Get active sort for this table
    const sortState = getTableSort(tableName);
    if (sortState.column) {
        filterParams.append('sort_column', sortState.column);
        filterParams.append('sort_direction', sortState.direction);
    }

    const url = `${baseUrl}/data/${tableName}?${filterParams.toString()}`;

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
                    // Store original value for image refresh functionality
                    td.dataset.originalValue = String(val);

                    if (typeof val === 'object' || (typeof val === 'string' && val.trim().startsWith('{'))) {
                        const jsonView = formatJsonCell(val);
                        td.appendChild(jsonView);
                    } else if (imageSettings.showImages && isImagePath(String(val))) {
                        const imageElement = createImageElement(String(val));
                        if (imageElement) {
                            td.appendChild(imageElement);
                        } else {
                            td.textContent = String(val);
                        }
                    } else {
                        td.textContent = String(val);
                    }
                } else {
                    td.textContent = '';
                    td.dataset.originalValue = '';
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    const countSpan = document.getElementById(`${tableName}_count`);
    if (countSpan) {
        countSpan.textContent = `(${tableInfo.count} ${t('ui.rows')})`;
    }

    const limitedInfoSpan = document.getElementById(`${tableName}_limited_info`);
    if (limitedInfoSpan) {
        if (tableInfo.limited) {
            limitedInfoSpan.innerHTML = `
                <span class="lang-ko">${t('ui.scrollMore')}</span>
                <span class="lang-en">${t('ui.scrollMore')}</span>
                <span class="lang-vi">${t('ui.scrollMore')}</span>
            `;
        } else {
            limitedInfoSpan.innerHTML = `
                <span class="lang-ko">${t('ui.allDataLoaded')}</span>
                <span class="lang-en">${t('ui.allDataLoaded')}</span>
                <span class="lang-vi">${t('ui.allDataLoaded')}</span>
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
            countSpan.textContent = `(${data.count} ${t('ui.rows')})`;
            return data.count;
        } else {
            countSpan.textContent = `(0 ${t('ui.rows')})`;
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

        if (cell.classList.contains('focused') && !isEditing && !cell.querySelector('.no-data-message')) {
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
        if (cell && !isEditing && isAdminMode && !e.target.classList.contains('no-data-message')) {
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
        
                if (e.key && (e.key.toLowerCase() === 'd' || e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'x')
            && !isEditing && isAdminMode) {
            const focusedCell = table.querySelector('td.focused');
            if (!focusedCell) return;

            const row = focusedCell.closest('tr');
            if (!row) return;

            if (e.key && e.key.toLowerCase() === 'x') {
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
            } else if (e.key && e.key.toLowerCase() === 'd') {
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
            } else if (e.key && e.key.toLowerCase() === 'a') {
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

// Add filter and sort functionality to table
function addFilterListeners(table, columns) {
    const filterBtns = table.querySelectorAll('.filter-btn');
    const sortBtns = table.querySelectorAll('.sort-btn');

    // Filter button listeners
    filterBtns.forEach((btn, columnIndex) => {
        btn.addEventListener('click', async function(e) {
            e.stopPropagation();
            e.preventDefault();

            const columnName = btn.getAttribute('data-column');
            await toggleFilterDropdown(table, btn, columnName, columnIndex);
        });

        // Prevent admin mode interactions
        btn.addEventListener('keydown', function(e) {
            e.stopPropagation();
        });
    });

    // Sort button listeners
    sortBtns.forEach((btn) => {
        btn.addEventListener('click', async function(e) {
            e.stopPropagation();
            e.preventDefault();

            const columnName = btn.getAttribute('data-column');
            await toggleSort(table, columnName);
        });

        btn.addEventListener('mouseenter', function() {
            btn.style.opacity = '1';
        });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.filter-dropdown') && !e.target.closest('.filter-btn')) {
            closeAllFilterDropdowns();
        }
    });

    // Close dropdowns on page scroll (but not dropdown internal scroll)
    let scrollTimeout;
    window.addEventListener('scroll', function(e) {
        // Don't close if scrolling inside a dropdown
        if (e.target.closest('.filter-dropdown-content')) {
            return;
        }

        // Debounce scroll events to avoid excessive closing
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            closeAllFilterDropdowns();
        }, 100);
    }, true);

    // Close dropdowns on window resize
    window.addEventListener('resize', function() {
        closeAllFilterDropdowns();
    });
}

// Toggle filter dropdown for a column
async function toggleFilterDropdown(table, btn, columnName, columnIndex) {
    // Close other dropdowns first
    closeAllFilterDropdowns();

    // Check if this dropdown is already open for this button
    if (btn.hasAttribute('data-dropdown-open')) {
        return; // Already closed by closeAllFilterDropdowns
    }

    // Create and show dropdown (no need to pause monitoring anymore!)
    const dropdown = await createFilterDropdown(table, columnName, columnIndex);

    // Append to body to avoid clipping issues
    document.body.appendChild(dropdown);

    // Store reference to the button that opened this dropdown
    dropdown.setAttribute('data-source-button', btn.getAttribute('data-column-index'));
    btn.setAttribute('data-dropdown-open', 'true');

    // Position dropdown
    positionDropdown(dropdown, btn);

    // Show dropdown
    setTimeout(() => {
        dropdown.classList.add('show');
    }, 10);

    // Mark button as active
    btn.classList.add('active');
}

// Create filter dropdown with unique values
async function createFilterDropdown(table, columnName, columnIndex) {
    const dropdown = document.createElement('div');
    dropdown.className = 'filter-dropdown';

    // Prevent dropdown interactions from closing it
    dropdown.addEventListener('click', function(e) {
        e.stopPropagation();
    });

    dropdown.addEventListener('scroll', function(e) {
        e.stopPropagation();
    });

    dropdown.addEventListener('wheel', function(e) {
        e.stopPropagation();
    });

    // Handle keyboard events
    dropdown.addEventListener('keydown', function(e) {
        e.stopPropagation();

        // Close on Escape
        if (e.key === 'Escape') {
            closeAllFilterDropdowns();
        }
    });

    // Header
    const header = document.createElement('div');
    header.className = 'filter-dropdown-header';
    header.textContent = `Filter: ${columnName}`;
    dropdown.appendChild(header);

    // Content container
    const content = document.createElement('div');
    content.className = 'filter-dropdown-content';

    // Prevent scroll events from bubbling up
    content.addEventListener('scroll', function(e) {
        e.stopPropagation();
    });

    // Prevent wheel events from bubbling up
    content.addEventListener('wheel', function(e) {
        e.stopPropagation();
    });

    dropdown.appendChild(content);

    // Show loading state
    content.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--md-sys-color-on-surface-variant);">Loading...</div>';

    // Get unique values for this column
    try {
        const uniqueValues = await getUniqueColumnValues(table, columnName);
        const currentFilters = getColumnFilters(table, columnIndex);

        // Clear loading and create virtualized list
        content.innerHTML = '';
        createVirtualizedList(content, uniqueValues, currentFilters, async (selectedValues) => {
            setColumnFilter(table, columnIndex, selectedValues);
            updateFilterButton(table, columnIndex);
            await applyDatabaseFilter(table);
        });
    } catch (error) {
        content.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--md-sys-color-error);">Error loading values</div>';
        console.error('Error creating filter dropdown:', error);
    }

    return dropdown;
}

// Get unique values from a column via API
async function getUniqueColumnValues(table, columnName) {
    try {
        const tableContainer = table.closest('.table-container');
        const tableName = tableContainer ? tableContainer.id : 'unknown';

        const response = await fetch(`/data/${tableName}/column/${columnName}/values`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.values || [];
    } catch (error) {
        console.error('Error fetching column values:', error);
        // Fallback to frontend filtering if API fails
        return getFallbackColumnValues(table, columnName);
    }
}

// Fallback function to get values from current table data
function getFallbackColumnValues(table, columnName) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const values = new Set();

    // Find column index
    const headers = Array.from(table.querySelectorAll('thead tr:first-child th'));
    const columnIndex = headers.findIndex(th => th.textContent.trim() === columnName);

    if (columnIndex === -1) return [];

    rows.forEach(row => {
        if (row.querySelector('.no-data-message')) return;

        const cells = row.querySelectorAll('td');
        const cell = cells[columnIndex];
        if (cell) {
            const value = cell.textContent.trim();
            if (value !== '') {
                values.add(value);
            }
        }
    });

    return Array.from(values).sort();
}

// Create virtualized list for filter options
function createVirtualizedList(container, values, selectedValues, onSelectionChange) {
    const ITEM_HEIGHT = 32;
    const MAX_VISIBLE_ITEMS = 8;
    const containerHeight = Math.min(values.length * ITEM_HEIGHT, MAX_VISIBLE_ITEMS * ITEM_HEIGHT);

    container.style.height = `${containerHeight}px`;
    container.style.overflowY = 'auto';

    // Add "All" option
    const allOption = createFilterOption('(All)', selectedValues.length === 0, async (checked) => {
        if (checked) {
            // Clear all selections for this column
            await onSelectionChange([]);
        }
    });
    container.appendChild(allOption);

    // Add separator
    const separator = document.createElement('div');
    separator.style.borderTop = '1px solid var(--md-sys-color-outline-variant)';
    separator.style.margin = '4px 0';
    container.appendChild(separator);

    // Add individual options
    values.forEach(value => {
        const isSelected = selectedValues.includes(value);
        const option = createFilterOption(value, isSelected, async (checked) => {
            let newSelection = [...selectedValues];
            if (checked) {
                if (!newSelection.includes(value)) {
                    newSelection.push(value);
                }
            } else {
                newSelection = newSelection.filter(v => v !== value);
            }
            await onSelectionChange(newSelection);
        });
        container.appendChild(option);
    });
}

// Create individual filter option
function createFilterOption(value, isSelected, onChange) {
    const option = document.createElement('div');
    option.className = `filter-option ${isSelected ? 'selected' : ''}`;

    const checkbox = document.createElement('div');
    checkbox.className = 'filter-option-checkbox';
    option.appendChild(checkbox);

    const label = document.createElement('span');
    label.textContent = value;
    label.style.flex = '1';
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';
    label.style.whiteSpace = 'nowrap';
    option.appendChild(label);

    option.addEventListener('click', async (e) => {
        e.stopPropagation();
        const wasSelected = option.classList.contains('selected');

        if (wasSelected) {
            option.classList.remove('selected');
        } else {
            option.classList.add('selected');
        }

        await onChange(!wasSelected);
    });

    return option;
}

// Filter management functions
const tableFilters = new Map(); // Store filters per table

// Sort management functions
const tableSorts = new Map(); // Store sort state per table

// Helper function to check if a table has active filters
function hasActiveFilters(tableName) {
    return tableFilters.has(tableName) && Object.keys(tableFilters.get(tableName) || {}).length > 0;
}

function getColumnFilters(table, columnIndex) {
    const container = table.closest('.table-container');
    const tableId = container ? container.id : 'default-table';
    const filters = tableFilters.get(tableId) || {};

    // Get column name from filter button
    const filterBtn = table.querySelector(`[data-column-index="${columnIndex}"]`);
    const columnName = filterBtn ? filterBtn.getAttribute('data-column') : columnIndex.toString();

    return filters[columnName] || [];
}

function setColumnFilter(table, columnIndex, selectedValues) {
    const container = table.closest('.table-container');
    const tableId = container ? container.id : 'default-table';
    const filters = tableFilters.get(tableId) || {};

    // Get column name from filter button
    const filterBtn = table.querySelector(`[data-column-index="${columnIndex}"]`);
    const columnName = filterBtn ? filterBtn.getAttribute('data-column') : columnIndex.toString();

    if (selectedValues.length === 0) {
        delete filters[columnName];
    } else {
        filters[columnName] = selectedValues;
    }

    tableFilters.set(tableId, filters);
}

// Sort management functions
function getTableSort(tableName) {
    return tableSorts.get(tableName) || { column: null, direction: null };
}

function setTableSort(tableName, column, direction) {
    tableSorts.set(tableName, { column, direction });
}

function clearTableSort(tableName) {
    tableSorts.delete(tableName);
}

function updateFilterButton(table, columnIndex) {
    const btn = table.querySelector(`[data-column-index="${columnIndex}"].filter-btn`);
    if (!btn) return;

    const filters = getColumnFilters(table, columnIndex);

    if (filters.length > 0) {
        btn.classList.add('active');
        btn.innerHTML = '⋯'; // Horizontal ellipsis for active filter
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '⋮'; // Vertical ellipsis for inactive filter
    }
}

function updateSortButton(table, columnName) {
    const container = table.closest('.table-container');
    const tableName = container ? container.id : 'default-table';
    const sortState = getTableSort(tableName);

    // Update all sort buttons
    const sortBtns = table.querySelectorAll('.sort-btn');
    sortBtns.forEach(btn => {
        const btnColumn = btn.getAttribute('data-column');
        if (btnColumn === sortState.column) {
            btn.classList.add('active');
            btn.innerHTML = sortState.direction === 'asc' ? '↑' : '↓';
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '↕'; // Up-down arrow for unsorted
        }
    });
}

// Toggle sort for a column
async function toggleSort(table, columnName) {
    const container = table.closest('.table-container');
    const tableName = container ? container.id : 'default-table';
    const currentSort = getTableSort(tableName);

    let newDirection;
    if (currentSort.column === columnName) {
        // Same column - toggle direction
        newDirection = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        // Different column - start with descending
        newDirection = 'desc';
    }

    // Update sort state
    setTableSort(tableName, columnName, newDirection);

    // Update button appearance
    updateSortButton(table, columnName);

    // Apply database-level sorting
    await applyDatabaseSort(table);
}

// Apply database-level sorting
async function applyDatabaseSort(table) {
    const container = table.closest('.table-container');
    const tableId = container ? container.id : 'default-table';
    const allFilters = tableFilters.get(tableId) || {};
    const sortState = getTableSort(tableId);

    try {
        // Build parameters for the API
        const params = new URLSearchParams();
        params.append('limit', '50');
        params.append('offset', '0');

        // Add filter parameters
        Object.entries(allFilters).forEach(([columnName, selectedValues]) => {
            if (columnName && selectedValues.length > 0) {
                params.append(`filter_${columnName}`, selectedValues.join(','));
            }
        });

        // Add sort parameters
        if (sortState.column) {
            params.append('sort_column', sortState.column);
            params.append('sort_direction', sortState.direction);
        }

        // Fetch sorted data
        const response = await fetch(`/data/${tableId}?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Update table with sorted data
        if (data.data) {
            const tbody = table.querySelector('tbody');
            updateTableRows(tbody, data.data, data.columns);

            // Reset chunk tracking for sorted data
            if (typeof tableChunks !== 'undefined' && tableChunks[tableId]) {
                tableChunks[tableId] = {
                    start: 0,
                    end: data.data.length,
                    isFiltered: Object.keys(allFilters).length > 0,
                    isSorted: sortState.column !== null
                };
            }
        }

    } catch (error) {
        console.error('Error applying database sort:', error);
    }
}

// Close all filter dropdowns
function closeAllFilterDropdowns() {
    const dropdowns = document.querySelectorAll('.filter-dropdown');
    dropdowns.forEach(dropdown => {
        // Find and clean up the source button
        const sourceButtonIndex = dropdown.getAttribute('data-source-button');
        if (sourceButtonIndex) {
            const sourceButton = document.querySelector(`[data-column-index="${sourceButtonIndex}"][data-dropdown-open]`);
            if (sourceButton) {
                sourceButton.removeAttribute('data-dropdown-open');

                // Only remove active class if no filters are applied
                const table = sourceButton.closest('table');
                if (table) {
                    const filters = getColumnFilters(table, parseInt(sourceButtonIndex));
                    if (filters.length === 0) {
                        sourceButton.classList.remove('active');
                    }
                }
            }
        }

        dropdown.remove();
    });
}

// Position dropdown relative to button
function positionDropdown(dropdown, btn) {
    const btnRect = btn.getBoundingClientRect();
    const thRect = btn.closest('th').getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate position
    let left = thRect.left;
    let top = thRect.bottom + 4;

    // Ensure dropdown doesn't go off-screen horizontally
    const dropdownWidth = 250; // Approximate width
    if (left + dropdownWidth > viewportWidth) {
        left = viewportWidth - dropdownWidth - 10;
    }
    if (left < 10) {
        left = 10;
    }

    // Ensure dropdown doesn't go off-screen vertically
    const dropdownHeight = 300; // Max height
    if (top + dropdownHeight > viewportHeight) {
        top = thRect.top - dropdownHeight - 4; // Show above instead
    }

    // Apply positioning
    dropdown.style.left = `${left}px`;
    dropdown.style.top = `${top}px`;
    dropdown.style.width = `${Math.min(dropdownWidth, thRect.width * 2)}px`;
}

// Pause monitoring for filtering operations
async function pauseMonitoringForFiltering() {
    // Check if monitoring is currently active
    const isCurrentlyMonitoring = (typeof window.isMonitoringPaused !== 'undefined' && !window.isMonitoringPaused) ||
                                  (typeof window.isMonitoringPaused === 'undefined');

    if (isCurrentlyMonitoring) {
        console.log('Pausing monitoring for filtering operation...');

        // Use the global toggle function if available
        if (typeof window.toggleMonitoring === 'function') {
            window.toggleMonitoring();
        } else if (typeof toggleMonitoring === 'function') {
            toggleMonitoring();
        } else {
            // Fallback: set the global variable directly
            if (typeof window.isMonitoringPaused !== 'undefined') {
                window.isMonitoringPaused = true;
            }
        }

        // Also notify the backend
        try {
            const response = await fetch('/monitoring/state', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ paused: true })
            });

            if (!response.ok) {
                console.warn('Failed to notify backend of monitoring pause');
            }
        } catch (error) {
            console.error('Error setting monitoring state:', error);
        }

        // Update pause button visual state if it exists
        const pauseButton = document.getElementById('pauseButton');
        if (pauseButton && !pauseButton.classList.contains('paused')) {
            pauseButton.click(); // Trigger the pause button
        }

        // Add visual indicator that filtering is active
        addFilteringIndicator();
    }
}





// Apply database-level filtering
async function applyDatabaseFilter(table) {
    const container = table.closest('.table-container');
    const tableId = container ? container.id : 'default-table';
    const allFilters = tableFilters.get(tableId) || {};

    try {
        // Build filter parameters for the API
        const filterParams = new URLSearchParams();
        filterParams.append('limit', '50');
        filterParams.append('offset', '0');

        // Add filter parameters
        Object.entries(allFilters).forEach(([columnName, selectedValues]) => {
            if (columnName && selectedValues.length > 0) {
                filterParams.append(`filter_${columnName}`, selectedValues.join(','));
            }
        });

        // Fetch filtered data
        const response = await fetch(`/data/${tableId}?${filterParams.toString()}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Update table with filtered data
        if (data.data) {
            const tbody = table.querySelector('tbody');
            updateTableRows(tbody, data.data, data.columns);

            // Reset chunk tracking for filtered data
            if (typeof tableChunks !== 'undefined' && tableChunks[tableId]) {
                tableChunks[tableId] = {
                    start: 0,
                    end: data.data.length,
                    isFiltered: Object.keys(allFilters).length > 0
                };
            }
        }

    } catch (error) {
        console.error('Error applying database filter:', error);
        // Fallback to frontend filtering
        filterTableFrontend(table);
    }
}

// Frontend filtering fallback (original function)
function filterTableFrontend(table) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const container = table.closest('.table-container');
    const tableId = container ? container.id : 'default-table';
    const allFilters = tableFilters.get(tableId) || {};

    // Check if any filters are active
    const hasActiveFilters = Object.keys(allFilters).length > 0;

    if (!hasActiveFilters) {
        // Show all rows if no filters
        rows.forEach(row => {
            row.style.display = '';
            row.classList.remove('filtered-out');
        });
        return;
    }

    // Get column headers for mapping
    const headers = Array.from(table.querySelectorAll('thead tr:first-child th'));
    const columnMap = {};
    headers.forEach((th, index) => {
        const filterBtn = th.querySelector('.filter-btn');
        if (filterBtn) {
            const columnName = filterBtn.getAttribute('data-column');
            if (columnName) {
                columnMap[columnName] = index;
            }
        }
    });

    rows.forEach(row => {
        if (row.querySelector('.no-data-message')) {
            // Don't filter the "no data" message row
            return;
        }

        let shouldShow = true;
        const cells = Array.from(row.querySelectorAll('td'));

        shouldShow = Object.entries(allFilters).every(([columnName, selectedValues]) => {
            const columnIndex = columnMap[columnName];
            if (columnIndex === undefined) return true;

            const cell = cells[columnIndex];
            if (!cell) return true;

            const cellText = cell.textContent.trim();
            return selectedValues.includes(cellText);
        });

        if (shouldShow) {
            row.style.display = '';
            row.classList.remove('filtered-out');
        } else {
            row.style.display = 'none';
            row.classList.add('filtered-out');
        }
    });
}



export function adjustColumnWidths(table) {
    const columns = Array.from(table.querySelectorAll('th'));
    const PADDING = 20;
    const MIN_JSON_WIDTH = 0;
    const MAX_JSON_WIDTH = 400;
    const INDENT_SIZE = 2;
    const NESTING_PADDING = 10; // Reduced padding per nesting level

    // Get column names for saving widths
    const columnNames = columns.map(th => th.textContent.trim());
    const calculatedWidths = {};

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

        // Store the calculated width for saving
        calculatedWidths[columnNames[index]] = finalWidth;
    });

    // Save the calculated widths to cookies
    const tableName = table.closest('.table-container')?.id || table.closest('.table-section')?.getAttribute('data-table-name');
    if (tableName) {
        const cookieName = `table_${tableName}_widths`;
        setCookie(cookieName, JSON.stringify(calculatedWidths), 365);
    }
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
            if (limitedInfoSpan) {
                limitedInfoSpan.innerHTML = `
                    <span class="lang-ko">${t('ui.scrollMore')}</span>
                    <span class="lang-en">${t('ui.scrollMore')}</span>
                    <span class="lang-vi">${t('ui.scrollMore')}</span>
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
        // Use global variables and imports that are available
        const baseUrl = window.baseUrl;
        const currentLangValue = getCurrentLanguage();

        if (baseUrl) {
            fetchTableData(tableName, true, baseUrl, null, currentLangValue, updateSingleTable);
        }
    }
    
    // Resume monitoring if table is hidden or at top (but not if filters are active)
    const tableHasActiveFilters = hasActiveFilters(tableName);

    if ((atTop || isHidden) && window.isMonitoringPaused && !tableHasActiveFilters) {
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
    console.log('arrangeByRelations() called');
    console.log('schemaData:', schemaData);
    console.log('schemaData.relationships:', schemaData?.relationships);

    if (!schemaData || !schemaData.relationships) {
        console.warn('Schema data not available for relation arrangement, falling back to alphabetical');
        console.warn('schemaData:', schemaData);
        arrangeAlphabetically();
        return;
    }

    const tablesContainer = document.getElementById('tables-container');
    const buttonsLine = document.querySelector('.table-buttons-line');
    const tableSections = Array.from(tablesContainer.querySelectorAll('.table-section'));

    console.log('tablesContainer:', tablesContainer);
    console.log('buttonsLine:', buttonsLine);
    console.log('tableSections count:', tableSections.length);

    // Reset all groups
    tableSections.forEach(section => {
        section.classList.remove('relation-group');
        section.style.opacity = '0';
    });

    const sortedOrder = getSortedTableOrder();
    console.log('sortedOrder:', sortedOrder);

    // Update DOM with animation
    sortedOrder.forEach((tableName, index) => {
        const section = document.querySelector(`.table-section[data-table-name="${tableName}"]`);
        const pill = document.querySelector(`.table-button[data-table="${tableName}"]`);

        console.log(`Processing table ${tableName}: section=${!!section}, pill=${!!pill}`);

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
            console.log(`Reordering pill for ${tableName}`);
            buttonsLine.appendChild(pill);
        } else {
            console.warn(`No pill found for table ${tableName}`);
        }
    });

    // Save the new table order to cookies
    saveTableOrderFromArrangement();

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
    console.log('arrangeAlphabetically() called');

    const tablesContainer = document.getElementById('tables-container');
    const tableSections = Array.from(tablesContainer.querySelectorAll('.table-section'));
    const buttonsLine = document.querySelector('.table-buttons-line');
    const tablePills = Array.from(buttonsLine.querySelectorAll('.table-button'));

    console.log('tablesContainer:', tablesContainer);
    console.log('buttonsLine:', buttonsLine);
    console.log('tableSections count:', tableSections.length);
    console.log('tablePills count:', tablePills.length);

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

    console.log('sortedNames:', sortedNames);

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
        console.log(`Processing pill for ${tableName}: found=${!!pill}`);
        if (pill) {
            console.log(`Reordering pill for ${tableName}`);
            buttonsLine.appendChild(pill);
        } else {
            console.warn(`No pill found for table ${tableName}`);
        }
    });

    // Save the new table order to cookies
    saveTableOrderFromArrangement();

    // Clean up transitions
    setTimeout(() => {
        tableSections.forEach(section => {
            section.style.transition = '';
            section.style.transitionDelay = '';
        });
    }, sortedNames.length * 50 + 300);
}

// Image settings modal functions
function closeImageSettingsModal() {
    const modal = document.getElementById('imageSettingsModal');
    if (modal) {
        modal.classList.remove('visible');
    }
}

// Full-view image modal functions
function openImageFullview(imagePath, imageUrl) {
    const modal = document.getElementById('imageFullviewModal');
    const image = document.getElementById('fullviewImage');
    const pathElement = document.getElementById('fullviewPath');

    if (!modal || !image || !pathElement) {
        console.error('Full-view modal elements not found');
        return;
    }

    // Set image source
    image.src = imageUrl;
    image.alt = imagePath;

    // Set image path
    const fullPath = imageSettings.prefix ? `${imageSettings.prefix}\\${imagePath}` : imagePath;
    pathElement.textContent = fullPath;

    // Store current image path for other functions
    modal.dataset.imagePath = imagePath;
    modal.dataset.imageUrl = imageUrl;
    modal.dataset.fullPath = fullPath;

    // Show modal
    modal.classList.add('show');

    // Initialize resize functionality
    initializeImageModalResize(modal);

    // Add escape key listener
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeImageFullview();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    // Add click outside to close (but not during resize)
    const handleClickOutside = (e) => {
        if (e.target === modal && !modal._isResizing) {
            closeImageFullview();
            modal.removeEventListener('click', handleClickOutside);
        }
    };
    modal.addEventListener('click', handleClickOutside);

    // Store resize state for click handler
    modal._isResizing = false;
    modal._handleClickOutside = handleClickOutside;
}

function closeImageFullview() {
    const modal = document.getElementById('imageFullviewModal');
    if (modal) {
        modal.classList.remove('show');
        // Clean up resize listeners
        if (modal._cleanupResize) {
            modal._cleanupResize();
        }
    }
}

// Initialize resize functionality for image modal
function initializeImageModalResize(modal) {
    const content = modal.querySelector('.image-fullview-content');
    if (!content) return;

    let isResizing = false;
    let startX, startY, startWidth, startHeight;

    const onMouseDown = (e) => {
        // Check if click is in the resize handle area (bottom-right 30x30px)
        const rect = content.getBoundingClientRect();
        const isInResizeArea = (
            e.clientX >= rect.right - 30 &&
            e.clientY >= rect.bottom - 30
        );

        if (!isInResizeArea) return;

        isResizing = true;
        modal._isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(document.defaultView.getComputedStyle(content).width, 10);
        startHeight = parseInt(document.defaultView.getComputedStyle(content).height, 10);

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.body.style.cursor = 'nwse-resize';
        e.preventDefault();
    };

    const onMouseMove = (e) => {
        if (!isResizing) return;

        const newWidth = startWidth + (e.clientX - startX);
        const newHeight = startHeight + (e.clientY - startY);

        // Apply min/max constraints
        const minWidth = 800;
        const minHeight = 600;
        const maxWidth = window.innerWidth * 0.99;
        const maxHeight = window.innerHeight * 0.96;

        const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        const constrainedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

        content.style.width = constrainedWidth + 'px';
        content.style.height = constrainedHeight + 'px';
    };

    const onMouseUp = () => {
        if (!isResizing) return;

        isResizing = false;
        setTimeout(() => {
            modal._isResizing = false;
        }, 100); // Small delay to prevent immediate click-outside close

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
    };

    // Add event listener
    content.addEventListener('mousedown', onMouseDown);

    // Store cleanup function
    modal._cleanupResize = () => {
        content.removeEventListener('mousedown', onMouseDown);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
    };
}

function downloadFullviewImage() {
    const modal = document.getElementById('imageFullviewModal');
    const imageUrl = modal?.dataset.imageUrl;
    const imagePath = modal?.dataset.imagePath;

    if (!imageUrl || !imagePath) {
        console.error('No image data available for download');
        return;
    }

    // Create download link
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = imagePath.split(/[/\\]/).pop() || 'image.jpg'; // Get filename from path
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Make functions globally available
window.openImageSettingsModal = openImageSettingsModal;
window.closeImageSettingsModal = closeImageSettingsModal;
window.openImageFullview = openImageFullview;
window.closeImageFullview = closeImageFullview;
window.downloadFullviewImage = downloadFullviewImage;
