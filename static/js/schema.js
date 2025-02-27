let currentData = null;
let schemaData = null; // Persistent cache for schema data
let useGraphviz = false; // Track which visualization to use
let lastGraphvizTheme = null; // Track last theme used for GraphViz
let lastGraphvizResult = null; // Store last GraphViz response

export function initializeSchema(schemaButton, modal, loading, error, container) {
    console.log('Initializing schema functionality...');
    
    if (schemaButton.dataset.initialized) {
        console.log('Schema already initialized, skipping');
        return;
    }
    schemaButton.dataset.initialized = 'true';
    console.log('Schema initialized');

    // Load saved schema type preference and set initial state
    const savedSchemaType = localStorage.getItem('preferredSchemaType');
    if (savedSchemaType === 'graphviz' || savedSchemaType === null) { // Default to GraphViz
        useGraphviz = true;
        const toggle = document.getElementById('schemaTypeToggle');
        if (toggle) toggle.checked = true;
    }

    
    // Initialize copy button
    const copyButton = container.querySelector('.copy-button');
    if (copyButton) {
        copyButton.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
                <path d="M8 4v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.242a2 2 0 0 0-.602-1.43L16.083 2.57A2 2 0 0 0 14.685 2H10a2 2 0 0 0-2 2z"></path>
                <path d="M16 18v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2"></path>
            </svg>
        `;
        copyButton.addEventListener('click', async () => {
            try {
                if (useGraphviz) {
                    const img = container.querySelector('#graphvizContent');
                    const response = await fetch(img.src);
                    const blob = await response.blob();
                    const item = new ClipboardItem({ 'image/png': blob });
                    await navigator.clipboard.write([item]);
                } else {
                    const svg = container.querySelector('svg');
                    if (svg) {
                        const svgData = new XMLSerializer().serializeToString(svg);
                        const blob = new Blob([svgData], { type: 'image/svg+xml' });
                        const item = new ClipboardItem({ 'image/svg+xml': blob });
                        await navigator.clipboard.write([item]);
                    }
                }
            } catch (error) {
                console.error('Failed to copy schema:', error);
            }
        });
    }

    // Initialize download button
    const downloadButton = container.querySelector('.download-button');
    if (downloadButton) {
        downloadButton.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
        `;
        downloadButton.addEventListener('click', async () => {
            try {
                if (useGraphviz) {
                    const img = container.querySelector('#graphvizContent');
                    const response = await fetch(img.src);
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'schema.png';
                    link.click();
                    window.URL.revokeObjectURL(url);
                } else {
                    // Handle Mermaid download
                    const svg = container.querySelector('svg');
                    if (svg) {
                        const svgData = new XMLSerializer().serializeToString(svg);
                        const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
                        const url = URL.createObjectURL(svgBlob);
                        const link = document.createElement('a');
                        link.download = 'schema.svg';
                        link.href = url;
                        link.click();
                        URL.revokeObjectURL(url);
                    }
                }
            } catch (error) {
                console.error('Failed to download schema:', error);
            }
        });
    }

    // Add schema type toggle handler
    document.getElementById('schemaTypeToggle').addEventListener('change', function(e) {
        useGraphviz = e.target.checked;
        localStorage.setItem('preferredSchemaType', useGraphviz ? 'graphviz' : 'mermaid');
        if (currentData) { 
            // Reset GraphViz cache when switching
            lastGraphvizTheme = null;
            lastGraphvizResult = null;
            
            if (useGraphviz) {
                document.querySelector('.mermaid').style.display = 'none';
                document.getElementById('graphvizContent').style.display = 'block';
                renderGraphvizSchema(container, currentData);
            } else {
                document.querySelector('.mermaid').style.display = 'block';
                document.getElementById('graphvizContent').style.display = 'none';
                renderMermaidSchema(container, currentData);
            }
            
            // Initialize appropriate zoom/pan
            const targetElement = useGraphviz ? container.querySelector('#graphvizContent') : container.querySelector('.mermaid');
            initializeZoomPan(container, targetElement);
        }
    });

    if (typeof mermaid === 'undefined') {
        console.error('Mermaid library not loaded!');
        return;
    }
    console.log('Mermaid library found');

    if (!window.mermaidPromise) {
        console.error('Mermaid promise not initialized');
        return;
    }
    console.log('Mermaid promise found');

    schemaButton.addEventListener('click', async () => {
        console.log('Schema button clicked');
        try {
            // Wait for mermaid to be loaded
            console.log('Waiting for mermaid to load...');
            await window.mermaidPromise;
            console.log('Mermaid loaded successfully');

            modal.style.display = 'block';
            setTimeout(() => modal.classList.add('visible'), 10);
            
            const showSchema = () => {
                const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
                // Reset GraphViz theme cache if theme has changed
                if (useGraphviz && lastGraphvizTheme !== currentTheme) {
                    lastGraphvizTheme = null;
                    lastGraphvizResult = null;
                }
                loading.style.display = 'none';
                currentData = schemaData;
                if (useGraphviz) {
                    document.querySelector('.mermaid').style.display = 'none';
                    document.getElementById('graphvizContent').style.display = 'block';
                    renderGraphvizSchema(container, currentData);
                } else {
                    document.querySelector('.mermaid').style.display = 'block';
                    document.getElementById('graphvizContent').style.display = 'none';
                    renderMermaidSchema(container, currentData);
                }
            };

            if (schemaData) {
                showSchema();
                return;
            }

            loading.style.display = 'block';
            error.style.display = 'none';

            try {
                console.log('Fetching schema data...');
                const schemaUrl = `${window.location.origin}/schema`;
                console.log('Schema URL:', schemaUrl);
                const response = await fetch(schemaUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }

                console.log('Raw Schema Data:', data);
                console.log('Raw Relationships:', data.relationships);

                // Filter out SequelizeMeta table
                const filteredTables = { ...data.tables };
                delete filteredTables.SequelizeMeta;

                // Filter relationships involving SequelizeMeta
                const filteredRelationships = data.relationships.filter(rel =>
                    rel.from.table !== 'SequelizeMeta' && rel.to.table !== 'SequelizeMeta'
                );

                console.log('Filtered Relationships:', filteredRelationships);

                // Debug output
                console.log('Filtered Tables:', filteredTables);
                console.log('Sample Table Structure:', Object.entries(filteredTables)[0]);
                console.log('Filtered Relationships:', filteredRelationships);

                schemaData = {
                    tables: filteredTables,
                    relationships: filteredRelationships
                };
                
                showSchema();
            } catch (err) {
                loading.style.display = 'none';
                error.textContent = err.message;
                error.style.display = 'block';
            }
        } catch (err) {
            console.error('Failed to initialize mermaid:', err);
            error.textContent = 'Failed to initialize diagram renderer';
            error.style.display = 'block';
        }
    });

    // Handle modal close
    console.log('Adding modal close handler...');
    modal.querySelector('.schema-close').addEventListener('click', () => {
        modal.classList.remove('visible');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    });

    // Update theme observer to handle both Mermaid and GraphViz
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'data-theme') {
                if (useGraphviz && currentData) {
                    // Reset GraphViz theme cache on theme change
                    lastGraphvizTheme = null;
                    lastGraphvizResult = null;
                    renderGraphvizSchema(container, currentData);
                } else if (!useGraphviz && currentData) {
                    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                    mermaid.initialize({
                        theme: isDark ? 'dark' : 'default'
                    });
                    renderMermaidSchema(container, currentData);
                }
            }
        });
    });

    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
    });
}

function generateMermaidDefinition(data) {
    if (!data || !data.tables || !data.relationships) {
        console.error('Invalid schema data:', data);
        return 'erDiagram\n    %% No schema data available';
    }

    // First, define all tables with their structures
    const tableDefs = [];
    Object.entries(data.tables).forEach(([tableName, columns]) => {
        if (!Array.isArray(columns) || columns.length === 0) return;

        // Sanitize table name for Mermaid 10.6.1
        const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '_');
        
        const tableLines = [];
        // Start entity block
        tableLines.push(`    ${safeTableName} {`);

        // Process each column
        columns.forEach(column => {
            // Sanitize type names to be Mermaid-compatible (no spaces allowed)
            let type = column.type || 'unknown';
            // Extract base type without size/precision
            type = type.split('(')[0].toLowerCase();
            
            // Map common types
            const typeMap = {
                'character varying': 'varchar',
                'timestamp with time zone': 'timestamp',
                'timestamp without time zone': 'timestamp',
                'double precision': 'double',
                'numeric': 'decimal',
                'boolean': 'bool',
                'jsonb': 'json',
                'user-defined': 'enum'
            };
            
            type = typeMap[type] || type;
            
            // Sanitize column name for Mermaid 10.6.1
            const safeColumnName = column.name.replace(/[^a-zA-Z0-9_]/g, '_');
            
            // Add column definition
            const flags = [];
            if (column.primaryKey) flags.push('PK');
            if (data.relationships.some(rel =>
                (rel.from.table === tableName && rel.from.column === column.name) ||
                (rel.to.table === tableName && rel.to.column === column.name)
            )) {
                flags.push('FK');
            }

            // Format: name type "flags" with proper quotes for Mermaid 10.6.1
            tableLines.push(flags.length > 0
                ? `        ${safeColumnName} ${type} "${flags.join(',')}"`
                : `        ${safeColumnName} ${type}`);
        });

        // Close entity block
        tableLines.push('    }');
        tableDefs.push(tableLines.join('\n'));
    });

    // Then define relationships - Updated for Mermaid 10.6.1 compatibility
    const relationshipDefs = data.relationships.map(rel => {
        // Sanitize table names for Mermaid 10.6.1
        const safeFromTable = rel.from.table.replace(/[^a-zA-Z0-9_]/g, '_');
        const safeToTable = rel.to.table.replace(/[^a-zA-Z0-9_]/g, '_');
        
        // For Mermaid 10.6.1, simplify the relationship description
        // Format: TableA ||--o{ TableB : "relates to"
        return `    ${safeToTable} ||--o{ ${safeFromTable} : "relates to"`;
    });

    // Combine everything with careful spacing to avoid Mermaid parsing issues
    // Mermaid 10.6.1 requires proper spacing between sections
    const definition = [
        'erDiagram',
        tableDefs.join('\n'),
        relationshipDefs.join('\n')
    ].join('\n\n');

    console.log('Generated Mermaid Definition for 10.6.1:', definition);
    return definition;
}

function initializeZoomPan(container, targetElement) {
    if (!targetElement || targetElement.dataset.zoomInitialized === 'true') return;

    if (!targetElement.dataset.scale) {
        targetElement.dataset.scale = '1';
    }

    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    
    const minZoom = 0.5;
    const maxZoom = 20;
    const zoomStep = 0.05;

    const getScale = () => parseFloat(targetElement.dataset.scale);

    const updateTransform = () => {
        targetElement.style.transform = `translate(${panX}px, ${panY}px) scale(${getScale()})`;
    };

    const updateScale = (newScale) => {
        const limitedScale = Math.min(Math.max(newScale, minZoom), maxZoom);
        targetElement.dataset.scale = limitedScale.toString();
        updateTransform();
    };

    // Mouse wheel zoom
    container.addEventListener('wheel', (e) => {
        if (e.target === targetElement || targetElement.contains(e.target)) {
            e.preventDefault();
            const delta = e.deltaY;
            const currentScale = getScale();
            const scaleChange = 1 + (delta > 0 ? -zoomStep : zoomStep);
            updateScale(currentScale * scaleChange);
        }
    });

    // Zoom buttons
    const zoomIn = container.closest('.schema-modal').querySelector('.zoom-in');
    const zoomOut = container.closest('.schema-modal').querySelector('.zoom-out');
    const buttonZoomStep = 0.1;

    zoomIn.addEventListener('click', () => {
        const currentScale = getScale();
        updateScale(currentScale * (1 + buttonZoomStep));
    });

    zoomOut.addEventListener('click', () => {
        const currentScale = getScale();
        updateScale(currentScale * (1 - buttonZoomStep));
    });

    // Pan handlers
    targetElement.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            isDragging = true;
            startX = e.clientX - panX;
            startY = e.clientY - panY;
            targetElement.style.cursor = 'grabbing';
        }
    });

    container.addEventListener('mousemove', (e) => {
        if (isDragging) {
            panX = e.clientX - startX;
            panY = e.clientY - startY;
            updateTransform();
        }
    });

    const stopDragging = () => {
        isDragging = false;
        targetElement.style.cursor = 'grab';
    };

    targetElement.addEventListener('mouseup', stopDragging);
    targetElement.addEventListener('mouseleave', stopDragging);
    targetElement.dataset.zoomInitialized = 'true';
}
async function renderGraphvizSchema(container, data) {
    const img = container.querySelector('#graphvizContent');
    img.style.opacity = '0';
    img.style.cssText = 'opacity: 0; transition: opacity 0.3s ease; cursor: grab;';
    const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    console.log('Rendering GraphViz schema with theme:', currentTheme);

    try {
        // Only fetch new schema if theme has changed or no previous result
        if (lastGraphvizTheme !== currentTheme || !lastGraphvizResult) {
            console.log('Getting new GraphViz schema for theme:', currentTheme);
            const response = await fetch(`/schema?type=graphviz&theme=${currentTheme}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            lastGraphvizResult = await response.json();
            lastGraphvizTheme = currentTheme;
            console.log('New GraphViz schema received');
        } else {
            console.log('Using cached GraphViz schema');
        }
        
        if (lastGraphvizResult && lastGraphvizResult.schema_url) {
            img.src = `${lastGraphvizResult.schema_url}?t=${new Date().getTime()}`; // Add cache buster
            img.onload = () => {
                img.style.opacity = '1';
                if (!img.dataset.zoomInitialized) {
                    initializeZoomPan(container, img);
                    img.dataset.zoomInitialized = 'true';
                }
            };
        } else {
            console.error('No valid GraphViz schema URL');
            lastGraphvizResult = null; // Clear invalid result
            throw new Error('No valid schema URL available');
        }
    } catch (error) {
        console.error('Error rendering GraphViz schema:', error);
        img.style.display = 'none';
        const errorMsg = container.querySelector('.schema-error');
        errorMsg.textContent = `Failed to render GraphViz diagram: ${error.message}`;
        errorMsg.style.display = 'block';
    }
}

async function renderMermaidSchema(container, data) {
    try {
        const mermaidDiv = container.querySelector('.mermaid');
        mermaidDiv.style.transition = 'opacity 0.3s ease';
        mermaidDiv.style.opacity = '0';
        mermaidDiv.innerHTML = ''; // Clear previous content
        
        if (!mermaidDiv) {
            throw new Error('Mermaid container not found');
        }

        const definition = generateMermaidDefinition(data);
        if (!definition.includes('{')) {
            throw new Error('No valid entities found in schema');
        }

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        console.log('Rendering schema with theme:', isDark ? 'dark' : 'default');

        // Create a fresh container with proper textContent instead of innerHTML
        const newContainer = document.createElement('div');
        newContainer.className = 'mermaid';
        newContainer.textContent = definition; // Use textContent for proper escaping in Mermaid 10.6.1
        
        // Append to container
        mermaidDiv.appendChild(newContainer);
        
        // Render diagram with Mermaid 10.6.1 compatible configuration
        const mermaid = await window.mermaidPromise;
        console.log('Using Mermaid version:', mermaid.version ? mermaid.version() : 'unknown');
        
        // Reset mermaid instance with configuration optimized for 10.6.1
        mermaid.initialize({
            startOnLoad: false, // Important: set to false for explicit rendering
            theme: isDark ? 'dark' : 'default',
            securityLevel: 'loose',
            flowchart: { curve: 'basis' },
            er: {
                diagramPadding: 20,
                layoutDirection: 'TB',
                minEntityWidth: 100,
                minEntityHeight: 75,
                entityPadding: 15,
                stroke: 'gray',
                fill: 'honeydew',
                fontSize: 12
            },
            themeVariables: isDark ? {
                primaryColor: '#1f6feb',
                lineColor: '#666',
                textColor: '#adbac7',
                mainBkg: '#22272e',
                nodeBorder: '#444c56',
                fontSize: '14px'
            } : {
                primaryColor: '#0969da',
                lineColor: '#333',
                textColor: '#24292f',
                mainBkg: '#ffffff',
                nodeBorder: '#d0d7de',
                fontSize: '14px'
            },
            fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
        });

        try {
            // Wait for container to be ready
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Force synchronous rendering
            await mermaid.init(undefined, newContainer);
            mermaidDiv.style.opacity = '1';
            console.log('Mermaid rendering completed');
            
            // Make the diagram visible
            setTimeout(() => {
                mermaidDiv.style.opacity = '1';
                container.closest('.schema-modal').classList.add('loaded');
            }, 100);
        } catch (renderError) {
            console.error('Mermaid render error:', renderError);
            throw renderError;
        }
        
        initializeZoomPan(container, newContainer);
    } catch (error) {
        console.error('Error rendering mermaid diagram:', error);
        container.querySelector('.mermaid').innerHTML = `<div style="color: red; padding: 20px;">Failed to render schema diagram: ${error.message}</div>`;
    }
}

