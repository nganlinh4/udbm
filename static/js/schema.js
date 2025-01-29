let currentData = null;
let schemaData = null; // Persistent cache for schema data

export function initializeSchema(schemaButton, modal, loading, error, container) {
    console.log('Initializing schema functionality...');
    
    if (schemaButton.dataset.initialized) {
        console.log('Schema already initialized, skipping');
        return;
    }
    schemaButton.dataset.initialized = 'true';
    console.log('Schema initialized');

    // Ensure mermaid is loaded
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
                loading.style.display = 'none';
                currentData = schemaData;
                renderMermaidSchema(container, currentData);
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

    // Add click handler for schema button
    console.log('Adding schema button click handler...');
    schemaButton.onclick = async () => {
        console.log('Schema button clicked');
        try {
            // Wait for mermaid to be loaded
            console.log('Waiting for mermaid to load...');
            await window.mermaidPromise;
            console.log('Mermaid loaded successfully');

            modal.style.display = 'block';
            setTimeout(() => modal.classList.add('visible'), 10);

            try {
                // Only fetch schema if we don't have cached data
                if (!schemaData) {
                    console.log('No cached schema data, fetching from server...');
                    loading.style.display = 'block';
                    error.style.display = 'none';

                    console.log('Fetching schema...');
                    const response = await fetch('/schema');
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const data = await response.json();
                    console.log('Raw schema data:', data);

                    if (data.relationships && data.relationships.length > 0) {
                        console.log('Found relationships:', data.relationships);
                        schemaData = data;
                        currentData = data;
                        renderMermaidSchema(container, data);
                    } else {
                        console.warn('No relationships found in schema data');
                        error.textContent = 'No relationships found in schema';
                        error.style.display = 'block';
                    }
                } else {
                    console.log('Using cached schema data');
                    renderMermaidSchema(container, schemaData);
                }
            } catch (err) {
                console.error('Error fetching schema:', err);
                error.textContent = err.message;
                error.style.display = 'block';
            } finally {
                loading.style.display = 'none';
            }
        } catch (err) {
            console.error('Failed to initialize mermaid:', err);
            error.textContent = 'Failed to initialize diagram renderer';
            error.style.display = 'block';
        }
    };

    // Handle modal close
    console.log('Adding modal close handler...');
    modal.querySelector('.schema-close').addEventListener('click', () => {
        modal.classList.remove('visible');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    });

    // Update Mermaid theme when system theme changes
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'data-theme') {
                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                mermaid.initialize({
                    theme: isDark ? 'dark' : 'default'
                });
                if (currentData) {
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

        const tableLines = [];
        // Start entity block
        tableLines.push(`    ${tableName} {`);
        
        // Process each column
        columns.forEach(column => {
            // Sanitize type names to be Mermaid-compatible (no spaces allowed)
            let type = (column.type || 'unknown').toLowerCase()
                .replace(/varchar\(\d+\)/i, 'varchar')
                .replace(/character varying/i, 'varchar')
                .replace(/int(\(\d+\))?/i, 'int')
                .replace(/datetime/i, 'datetime')
                .replace(/timestamp with(?:out)? time zone/i, 'timestamp')
                .replace(/timestamp\(\d+\)/i, 'timestamp')
                .replace(/boolean/i, 'bool')
                .replace(/decimal\(\d+,\d+\)/i, 'decimal')
                .replace(/numeric(\(\d+,\d+\))?/i, 'decimal')
                .replace(/text/i, 'text')
                .replace(/bigint/i, 'bigint')
                .replace(/double precision/i, 'double')
                .replace(/double/i, 'double')
                .replace(/float/i, 'float')
                .replace(/char\(\d+\)/i, 'char')
                .replace(/user-defined/i, 'enum')
                .replace(/jsonb?/i, 'json')
                .replace(/uuid/i, 'uuid');

            // Add column definition
            const flags = [];
            if (column.primaryKey) flags.push('PK');
            if (data.relationships.some(rel =>
                (rel.from.table === tableName && rel.from.column === column.name) ||
                (rel.to.table === tableName && rel.to.column === column.name)
            )) {
                flags.push('FK');
            }

            // Format: name type "PK,FK" with proper spacing
            tableLines.push(flags.length > 0
                ? `        ${column.name} ${type} "${flags.join(',')}"`
                : `        ${column.name} ${type}`);
        });

        // Close entity block
        tableLines.push('    }');
        tableDefs.push(tableLines.join('\n'));
    });

    // Then define relationships
    console.log('Processing relationships for Mermaid:', data.relationships);
    console.log('Generating Mermaid relationships from:', data.relationships);
    const relationshipDefs = data.relationships.map(rel => {
        // Log each relationship being processed
        console.log('Processing relationship:', JSON.stringify(rel));
        // Format: [Entity1] [Relationship] [Entity2] : [Label]
        // Relationship types: ||--o|, }|--|{, ||--||, ||--o{
        const def = `    ${rel.from.table} }|--|| ${rel.to.table} : "${rel.from.column} > ${rel.to.column}"`;
        console.log('Generated relationship definition:', def);
        return def;
    });

    // Combine everything with careful spacing to avoid Mermaid parsing issues
    const definition = [
        'erDiagram',
        tableDefs.join('\n'),
        relationshipDefs.join('\n')
    ].join('\n\n');

    console.log('Final Mermaid definition:', definition);

    console.log('Generated Mermaid Definition:', definition);
    return definition;
}

async function renderMermaidSchema(container, data) {
    const mermaidDiv = container.querySelector('.mermaid');
    
    // Add opacity transition
    mermaidDiv.style.transition = 'opacity 0.3s ease';
    mermaidDiv.style.opacity = '0';
    
    // Show loading message with smooth fade
    mermaidDiv.innerHTML = '<div style="padding: 20px; text-align: center; transition: opacity 0.3s ease;">Preparing diagram...</div>';
    await new Promise(resolve => setTimeout(resolve, 50)); // Tiny delay for transition
    mermaidDiv.style.opacity = '1';
    
    // Generate and verify definition
    const definition = generateMermaidDefinition(data);
    if (!definition.includes('{')) {
        console.error('Invalid diagram definition - no entities found');
        mermaidDiv.innerHTML = '<div style="color: red; padding: 20px;">Failed to generate schema diagram: No valid entities found</div>';
        return;
    }
    
    try {
        // Wait for mermaid to be loaded
        const mermaid = await window.mermaidPromise;
        
        // Hide the content while processing
        mermaidDiv.style.opacity = '0';
        await new Promise(resolve => setTimeout(resolve, 300)); // Wait for fade out
        
        // Configure mermaid with optimized settings for PostgreSQL schema
        mermaid.initialize({
            startOnLoad: false,
            theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default',
            themeVariables: {
                'line-length': 50
            },
            er: {
                diagramPadding: 20,
                layoutDirection: 'TB',
                minEntityWidth: 200,
                minEntityHeight: 50,
                entityPadding: 15,
                stroke: 'gray',
                fill: 'white',
                fontSize: 12,
                useMaxWidth: true,
                attributeBackground: '#fafafa',
                wrap: true,
                titleTopMargin: 30,
                entitySpacing: 80,
                relativeEdges: true
            },
            flowchart: {
                curve: 'basis',
                padding: 20,
                useMaxWidth: true
            },
            securityLevel: 'loose'
        });
        console.log('Generated Definition:', definition);

        // Create diagram element
        const id = 'mermaid-' + Date.now();
        const pre = document.createElement('pre');
        pre.className = 'mermaid';
        pre.id = id;
        pre.textContent = definition;
        mermaidDiv.innerHTML = '';
        mermaidDiv.appendChild(pre);
    
        // Add download button if it doesn't exist
        let downloadButton = container.querySelector('.download-button');
        if (!downloadButton) {
            downloadButton = document.createElement('button');
            downloadButton.className = 'download-button';
            downloadButton.innerHTML = `
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
            `;
            downloadButton.title = "Download schema as image";
            container.appendChild(downloadButton);
    
            downloadButton.addEventListener('click', () => {
                // Create a temporary SVG element with the current transform
                const svg = container.querySelector('svg').cloneNode(true);
                const originalTransform = mermaidDiv.style.transform;
                const scale = parseFloat(mermaidDiv.dataset.scale) || 1;
                
                // Reset transform for accurate sizing
                mermaidDiv.style.transform = 'none';
                
                // Set SVG size
                const width = svg.viewBox.baseVal.width * scale;
                const height = svg.viewBox.baseVal.height * scale;
                svg.setAttribute('width', width);
                svg.setAttribute('height', height);
                
                // Set background color in SVG
                const bgColor = document.documentElement.getAttribute('data-theme') === 'dark' ? '#191c1e' : '#ffffff';
                svg.style.backgroundColor = bgColor;
                
                // Convert SVG to string with proper background
                const svgData = new XMLSerializer().serializeToString(svg);
                const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(svgBlob);
                
                // Download
                const link = document.createElement('a');
                link.download = 'schema.svg';
                link.href = url;
                link.click();
                
                // Cleanup
                URL.revokeObjectURL(url);
                mermaidDiv.style.transform = originalTransform;
            });
        }

        // Parse and render
        await mermaid.parse(definition);
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for DOM
        await mermaid.init(undefined, `#${id}`);
        
        // Fade in the rendered diagram
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to ensure rendering is complete
        mermaidDiv.style.opacity = '1';

        // Initialize zoom and pan functionality
        initializeZoomPan(container, mermaidDiv);
    } catch (error) {
        console.error('Error rendering mermaid diagram:', error);
        mermaidDiv.innerHTML = `
            <div style="color: red; padding: 20px;">
                Failed to render schema diagram.
                <br>
                Error: ${error.message}
            </div>
        `;
    }
}

function initializeZoomPan(container, mermaidDiv) {
    // Store scale in the element's dataset to persist it
    if (!mermaidDiv.dataset.scale) {
        mermaidDiv.dataset.scale = '1';
    }

    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    
    // Configure zoom settings
    const minZoom = 0.5;     // Minimum zoom level (50%)
    const maxZoom = 20;      // Maximum zoom level (2000%)
    const zoomStep = 0.05;   // 5% change per wheel tick for finer control

    // Helper function to get current scale
    const getScale = () => parseFloat(mermaidDiv.dataset.scale);

    // Helper function to update transform
    const updateTransform = () => {
        mermaidDiv.style.transform = `translate(${panX}px, ${panY}px) scale(${getScale()})`;
    };

    // Helper function to update scale with new limits
    const updateScale = (newScale) => {
        const limitedScale = Math.min(Math.max(newScale, minZoom), maxZoom);
        mermaidDiv.dataset.scale = limitedScale.toString();
        updateTransform();
    };

    // Zoom with mouse wheel - finer control
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY;
        const currentScale = getScale();
        const scaleChange = 1 + (delta > 0 ? -zoomStep : zoomStep);
        updateScale(currentScale * scaleChange);
    });

    // Zoom with buttons - using consistent zoom steps
    const zoomIn = container.closest('.schema-modal').querySelector('.zoom-in');
    const zoomOut = container.closest('.schema-modal').querySelector('.zoom-out');

    // Use larger steps for button clicks (20% change)
    const buttonZoomStep = 0.1;

    zoomIn.addEventListener('click', () => {
        const currentScale = getScale();
        updateScale(currentScale * (1 + buttonZoomStep));
    });

    zoomOut.addEventListener('click', () => {
        const currentScale = getScale();
        updateScale(currentScale * (1 - buttonZoomStep));
    });

    // Pan with mouse drag
    container.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // Left click only
            isDragging = true;
            startX = e.clientX - panX;
            startY = e.clientY - panY;
            container.style.cursor = 'grabbing';
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
        container.style.cursor = 'grab';
    };

    container.addEventListener('mouseup', stopDragging);
    container.addEventListener('mouseleave', stopDragging);
}