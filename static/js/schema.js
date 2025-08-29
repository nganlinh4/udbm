let currentData = null;
let schemaData = null;
let useGraphviz = true; // Keep for backward compatibility
let schemaType = 'hierarchy'; // New: 'hierarchy', 'mermaid', 'd3'
let lastGraphvizTheme = null;
let lastGraphvizResult = null;

let elkDirection = localStorage.getItem('hierarchyDirection') || 'RIGHT';
function showSuccessPopup(message) {
    const popup = document.createElement('div');
    popup.className = 'warning-popup';
    popup.style.fontFamily = 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
    popup.innerHTML = `
        <span class="warning-icon" style="color: #4caf50;">✓</span>
        ${message}
    `;
    document.body.appendChild(popup);
    setTimeout(() => {
        popup.classList.add('show');
    }, 10);
    setTimeout(() => {
        popup.classList.remove('show');
        setTimeout(() => popup.remove(), 300);
    }, 2000);
}

function showErrorPopup(message) {
    const popup = document.createElement('div');
    popup.className = 'warning-popup';
    popup.style.fontFamily = 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
    popup.innerHTML = `
        <span class="warning-icon" style="color: #ff5252;">⚠</span>
        ${message}
    `;
    document.body.appendChild(popup);
    setTimeout(() => {
        popup.classList.add('show');
    }, 10);
    setTimeout(() => {
        popup.classList.remove('show');
        setTimeout(() => popup.remove(), 300);
    }, 2000);
}

// Helper function to copy blob to clipboard - MUST WORK, NO FALLBACKS
async function copyBlobToClipboard(blob) {
    console.log('Copying image to clipboard...');

    // Ensure we have the required APIs
    if (!navigator.clipboard) {
        throw new Error('Clipboard API not available. Please use HTTPS or localhost.');
    }

    if (typeof ClipboardItem === 'undefined') {
        throw new Error('ClipboardItem not supported in this browser version.');
    }

    if (!window.isSecureContext) {
        throw new Error('Clipboard requires secure context (HTTPS). Current page is not secure.');
    }

    try {
        // Create ClipboardItem with the PNG blob
        const clipboardItem = new ClipboardItem({
            'image/png': blob
        });

        // Write to clipboard
        await navigator.clipboard.write([clipboardItem]);

        console.log('✅ Image successfully copied to clipboard');
        return { success: true, method: 'ClipboardItem' };

    } catch (error) {
        console.error('Clipboard write failed:', error);

        // Provide specific error messages based on the error type
        if (error.name === 'NotAllowedError') {
            throw new Error('Clipboard access denied. Please allow clipboard permissions for this site.');
        } else if (error.name === 'DataError') {
            throw new Error('Invalid image data. Please try regenerating the schema.');
        } else if (error.name === 'SecurityError') {
            throw new Error('Security error. Please ensure you are on HTTPS or localhost.');
        } else {
            throw new Error(`Clipboard error: ${error.message}`);
        }
    }
}

// Function to check clipboard requirements and provide user guidance
function checkClipboardSupport() {
    const issues = [];

    if (!window.isSecureContext) {
        issues.push('Page must be served over HTTPS or localhost');
    }

    if (!navigator.clipboard) {
        issues.push('Clipboard API not available in this browser');
    }

    if (typeof ClipboardItem === 'undefined') {
        issues.push('ClipboardItem not supported in this browser version');
    }

    return {
        supported: issues.length === 0,
        issues: issues,
        guidance: issues.length > 0 ?
            `To enable clipboard functionality: ${issues.join(', ')}` :
            'Clipboard functionality is available'
    };
}






function initializeZoomPan(container, targetElement) {
    if (!targetElement || targetElement.dataset.zoomInitialized === 'true') return;

    // Check if element already has a transform applied (for D3 SVG)
    const existingTransform = targetElement.style.transform;
    let initialPanX = 0, initialPanY = 0, initialScale = 0.7;

    if (existingTransform) {
        // Parse existing transform values
        const translateMatch = existingTransform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
        const scaleMatch = existingTransform.match(/scale\(([^)]+)\)/);

        if (translateMatch) {
            initialPanX = parseFloat(translateMatch[1]);
            initialPanY = parseFloat(translateMatch[2]);
        }
        if (scaleMatch) {
            initialScale = parseFloat(scaleMatch[1]);
        }
    }

    const state = {
        panX: initialPanX,
        panY: initialPanY,
        scale: initialScale,
        isDragging: false,
        startX: 0,
        startY: 0
    };

    // Re-enable pointer events for the actual image/container
    targetElement.style.pointerEvents = 'auto';
    targetElement.style.cursor = 'grab';
    targetElement.style.transformOrigin = '0 0';

    const minZoom = 0.1;
    const maxZoom = 5;
    const zoomStep = 0.05;

    const updateTransform = () => {
        targetElement.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;
    };

    // Pan handlers
    targetElement.addEventListener('mousedown', (e) => {
        if (e.button === 0 && !e.ctrlKey) {
            state.isDragging = true;
            state.startX = e.clientX - state.panX;
            state.startY = e.clientY - state.panY;
            targetElement.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });

    container.addEventListener('mousemove', (e) => {
        if (state.isDragging) {
            state.panX = e.clientX - state.startX;
            state.panY = e.clientY - state.startY;
            e.preventDefault();
            updateTransform();
        }
    });

    const stopDragging = () => {
        if (!state.isDragging) return;
        state.isDragging = false;
        targetElement.style.cursor = 'grab';
    };

    // Mouse wheel zoom
    container.addEventListener('wheel', (e) => {
        if (e.target === targetElement || targetElement.contains(e.target)) {
            e.preventDefault();

            const rect = targetElement.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Get mouse position relative to the target with current pan
            const x = mouseX - state.panX;
            const y = mouseY - state.panY;

            const oldScale = state.scale;
            const delta = e.deltaY;
            const scaleChange = 1 + (delta > 0 ? -zoomStep : zoomStep);
            const newScale = Math.min(Math.max(oldScale * scaleChange, minZoom), maxZoom);

            // Adjust pan to zoom at mouse position
            state.scale = newScale;
            state.panX = mouseX - (x * newScale / oldScale);
            state.panY = mouseY - (y * newScale / oldScale);

            updateTransform();
        }
    });

    // Zoom buttons
    const zoomIn = container.closest('.schema-modal').querySelector('.zoom-in');
    const zoomOut = container.closest('.schema-modal').querySelector('.zoom-out');
    const buttonZoomStep = 0.25;

    const zoomFromPoint = (zoomIn, point) => {
        const rect = targetElement.getBoundingClientRect();
        const x = point.x - rect.left - state.panX;
        const y = point.y - rect.top - state.panY;

        const oldScale = state.scale;
        const newScale = oldScale * (1 + (zoomIn ? buttonZoomStep : -buttonZoomStep));
        const limitedScale = Math.min(Math.max(newScale, minZoom), maxZoom);

        state.scale = limitedScale;
        state.panX = state.panX + (x * (1 - limitedScale/oldScale));
        state.panY = state.panY + (y * (1 - limitedScale/oldScale));

        updateTransform();
    };

    zoomIn.addEventListener('click', (e) => {
        // Zoom from center if no specific point
        const rect = targetElement.getBoundingClientRect();
        zoomFromPoint(true, {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        });
    });

    zoomOut.addEventListener('click', (e) => {
        const rect = targetElement.getBoundingClientRect();
        zoomFromPoint(false, {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        });
    });

    container.addEventListener('mouseup', stopDragging);
    targetElement.addEventListener('mouseup', stopDragging);
    targetElement.addEventListener('mouseleave', stopDragging);

    // Center the content initially (only for non-D3 SVG elements)
    const centerContent = () => {
        const containerRect = container.getBoundingClientRect();

        // For D3 SVG, skip centering as it's already positioned correctly
        if (targetElement.tagName === 'svg' && targetElement.id === 'd3-schema-svg') {
            return; // D3 SVG is already positioned correctly
        }

        // For D3 SVG, use the viewBox dimensions
        if (targetElement.tagName === 'svg') {
            const viewBox = targetElement.getAttribute('viewBox');
            if (viewBox) {
                const [, , width, height] = viewBox.split(' ').map(Number);
                const containerCenterX = containerRect.width / 2;
                const containerCenterY = containerRect.height / 2;
                const targetCenterX = (width * state.scale) / 2;
                const targetCenterY = (height * state.scale) / 2;

                state.panX = containerCenterX - targetCenterX;
                state.panY = containerCenterY - targetCenterY;
            }
        } else {
            // For images and other elements
            const targetRect = targetElement.getBoundingClientRect();
            const containerCenterX = containerRect.width / 2;
            const containerCenterY = containerRect.height / 2;
            const targetCenterX = (targetRect.width * state.scale) / 2;
            const targetCenterY = (targetRect.height * state.scale) / 2;

            state.panX = containerCenterX - targetCenterX;
            state.panY = containerCenterY - targetCenterY;
        }
    };

    // Apply centering and initial transform
    centerContent();
    updateTransform();

    targetElement.dataset.zoomInitialized = 'true';
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

        // Sanitize table name for Mermaid
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

            // Sanitize column name for Mermaid
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

            // Format: name type "flags" with proper quotes for Mermaid
            tableLines.push(flags.length > 0
                ? `        ${safeColumnName} ${type} "${flags.join(',')}"`
                : `        ${safeColumnName} ${type}`);
        });

        // Close entity block
        tableLines.push('    }');
        tableDefs.push(tableLines.join('\n'));
    });

    // Then define relationships
    const relationshipDefs = data.relationships.map(rel => {
        // Sanitize table names for Mermaid
        const safeFromTable = rel.from.table.replace(/[^a-zA-Z0-9_]/g, '_');
        const safeToTable = rel.to.table.replace(/[^a-zA-Z0-9_]/g, '_');

        // Show which columns are connected between tables
        const relationshipLabel = `${rel.from.column} -> ${rel.to.column}`;

        // Format: TableA ||--o{ TableB : "relationship label"
        return `    ${safeToTable} ||--o{ ${safeFromTable} : "${relationshipLabel}"`;
    });

    // Combine everything with careful spacing to avoid Mermaid parsing issues
    const definition = [
        'erDiagram',
        tableDefs.join('\n'),
        relationshipDefs.join('\n')
    ].join('\n\n');

    console.log('Generated Mermaid Definition:', definition);
    return definition;
}

async function renderGraphvizSchema(container, data) {
    // Replaced GraphViz with ELK.js hierarchical layout rendered client-side
    const img = container.querySelector('#graphvizContent');
    img.style.opacity = '0';
    img.style.cssText = 'opacity: 0; transition: opacity 0.3s ease; cursor: grab;';

    try {
        if (typeof ELK === 'undefined') {
            throw new Error('ELK.js not loaded');
        }

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const theme = {
            bg: 'transparent',
            nodeFill: isDark ? '#1f2937' : '#ffffff',
            nodeStroke: isDark ? '#374151' : '#d1d5db',
            text: isDark ? '#e5e7eb' : '#111827',
            edge: isDark ? '#9ca3af' : '#4b5563'
        };

        const elk = new ELK();

        // Build ELK graph with ports per column for precise edge attachment
        const PORT_HEIGHT = 20;
        const HEADER_HEIGHT = 28;
        const NODE_WIDTH = 200;
        const MIN_NODE_WIDTH = 150;
        const MAX_NODE_WIDTH = 220;

        // Determine colors per table (from server theme_colors or deterministic hash)
        const palette = (data.theme_colors && Array.isArray(data.theme_colors) && data.theme_colors.length)
            ? data.theme_colors
            : ['#C5CAE9','#B2DFDB','#F8BBD0','#FFE0B2','#C8E6C9','#E1BEE7','#B3E5FC','#FFF9C4','#D7CCC8','#CFD8DC'];
        const colorForTable = (name) => {
            if (data.theme_colors && data.theme_colors.length) {
                // Use index by stable order of keys
                const keys = Object.keys(data.tables || {});
                const idx = Math.max(0, keys.indexOf(name));
                return palette[idx % palette.length];
            }
            // fallback: hash name
            let h = 0; for (let i=0;i<name.length;i++){h = (h*31 + name.charCodeAt(i))|0;}
            return palette[Math.abs(h) % palette.length];
        };

        const nodes = Object.entries(data.tables || {}).map(([tableName, columns]) => {
            const rows = Array.isArray(columns) ? columns : [];
            const height = HEADER_HEIGHT + Math.max(1, rows.length) * PORT_HEIGHT;

            // Estimate width from content (table name and longest column)
            const fontCharW = 7; // approximate px per char
            const headerW = Math.max(120, tableName.length * fontCharW + 40);
            const longestCol = rows.reduce((m, c) => Math.max(m, (c.name || '').length + (c.type ? 3 + String(c.type).length : 0)), 0);
            const columnsW = Math.max(120, longestCol * fontCharW + 24);
            const estWidth = Math.max(headerW, columnsW);
            const width = Math.max(160, Math.min(estWidth, 240)); // clamp

            const ports = rows.map((col) => ({
                id: `${tableName}:${col.name}`,
                properties: { 'port.side': 'EAST' }
            }));

            return {
                id: tableName,
                width,
                height,
                color: colorForTable(tableName),
                ports
            };
        });

        const edges = (data.relationships || []).map((rel, idx) => ({
            id: `${rel.from.table}->${rel.to.table}-${idx}`,
            sources: [rel.from.table],
            targets: [rel.to.table],
            sourcePort: `${rel.from.table}:${rel.from.column}`,
            targetPort: `${rel.to.table}:${rel.to.column}`,
            labels: [{ text: `${rel.from.column} → ${rel.to.column}` }]
        }));

        const elkGraph = {
            id: 'root',
            layoutOptions: {
                'algorithm': 'layered',
                'elk.direction': elkDirection,
                'elk.edgeRouting': 'ORTHOGONAL',
                'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
                'elk.layered.cycleBreaking.strategy': 'GREEDY',
                'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
                'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
                'elk.layered.thoroughness': '10',
                'elk.layered.mergeEdges': 'false',
                'elk.layered.mergeHierarchyEdges': 'false',
                'elk.spacing.nodeNode': '48',
                'elk.layered.spacing.nodeNodeBetweenLayers': '72',
                'elk.spacing.edgeNode': '28',
                'elk.spacing.edgeEdge': '24',
                'elk.portConstraints': 'FIXED_ORDER',
                'elk.portAlignment.default': 'CENTER'
            },
            children: nodes,
            edges: edges
        };

        console.log('Computing ELK layout...');
        const layout = await elk.layout(elkGraph);

        // Create SVG from layout
        const margin = 40;
        const svgW = Math.ceil((layout.width || 800) + margin * 2);
        const svgH = Math.ceil((layout.height || 600) + margin * 2);

        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('xmlns', svgNS);
        svg.setAttribute('width', String(svgW));
        svg.setAttribute('height', String(svgH));
        svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
        svg.style.background = theme.bg;

        // Define marker for arrows
        const defs = document.createElementNS(svgNS, 'defs');
        const marker = document.createElementNS(svgNS, 'marker');
        marker.setAttribute('id', 'arrow');
        marker.setAttribute('orient', 'auto');
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '7');
        marker.setAttribute('refX', '10');
        marker.setAttribute('refY', '3.5');
        const markerPath = document.createElementNS(svgNS, 'path');
        markerPath.setAttribute('d', 'M0,0 L10,3.5 L0,7 Z');
        markerPath.setAttribute('fill', theme.edge);
        marker.appendChild(markerPath);
        defs.appendChild(marker);

        // Alternating row background pattern
        const bgPattern = document.createElementNS(svgNS, 'pattern');
        bgPattern.setAttribute('id', 'rowAlt');
        bgPattern.setAttribute('patternUnits', 'userSpaceOnUse');
        bgPattern.setAttribute('width', '4');
        bgPattern.setAttribute('height', String(PORT_HEIGHT));
        const altRect = document.createElementNS(svgNS, 'rect');
        altRect.setAttribute('x', '0');
        altRect.setAttribute('y', '0');
        altRect.setAttribute('width', '100%');
        altRect.setAttribute('height', String(PORT_HEIGHT));
        altRect.setAttribute('fill', isDark ? '#111827' : '#f9fafb');
        altRect.setAttribute('opacity', '0.7');
        bgPattern.appendChild(altRect);
        defs.appendChild(bgPattern);

        svg.appendChild(defs);

        // Draw edges first (under nodes) and collect labels
        const edgeIdCounts = {};
        const labelsToDraw = [];
        (layout.edges || []).forEach(edge => {
            (edge.sections || []).forEach((section) => {
                const pointsArr = [section.startPoint, ...(section.bendPoints || []), section.endPoint];
                const points = pointsArr
                    .map(p => `${Math.round(p.x + margin)},${Math.round(p.y + margin)}`)
                    .join(' ');

                // Alternating offset pattern (B): 0, +3, -3, +6, -6, ...
                const key = `${edge.sources?.[0]}|${edge.targets?.[0]}`;
                const count = (edgeIdCounts[key] = (edgeIdCounts[key] || 0) + 1);
                const step = 3;
                const mag = count === 1 ? 0 : Math.ceil((count - 1) / 2) * step;
                const sign = (count % 2 === 0) ? 1 : -1; // 2:+, 3:-, 4:+, 5:- ... (1 is base 0)
                const offsetX = elkDirection === 'DOWN' ? sign * mag : 0;
                const offsetY = elkDirection === 'RIGHT' ? sign * mag : 0;

                const polyline = document.createElementNS(svgNS, 'polyline');
                polyline.setAttribute('points', points);
                polyline.setAttribute('fill', 'none');
                polyline.setAttribute('stroke', theme.edge);
                polyline.setAttribute('stroke-width', '1.5');
                polyline.setAttribute('marker-end', 'url(#arrow)');
                polyline.setAttribute('transform', `translate(${offsetX}, ${offsetY})`);
                svg.appendChild(polyline);

                // Edge label near the middle, recorded to draw above nodes
                if (edge.labels && edge.labels.length) {
                    const midIndex = Math.floor(pointsArr.length / 2);
                    const a = pointsArr[Math.max(0, midIndex - 1)];
                    const b = pointsArr[Math.min(pointsArr.length - 1, midIndex)];
                    const midX = Math.round(((a.x + b.x) / 2) + margin + offsetX + 6);
                    const midY = Math.round(((a.y + b.y) / 2) + margin + offsetY - 6);
                    const dx = (b.x - a.x);
                    const dy = (b.y - a.y);
                    labelsToDraw.push({ x: midX, y: midY, text: edge.labels[0].text, dx, dy });
                }
            });
        });

        // Draw nodes with header and per-column rows
        (layout.children || []).forEach(node => {
            const g = document.createElementNS(svgNS, 'g');
            g.setAttribute('transform', `translate(${Math.round((node.x || 0) + margin)}, ${Math.round((node.y || 0) + margin)})`);

            const width = Math.round(node.width || NODE_WIDTH);
            const height = Math.round(node.height || HEADER_HEIGHT);

            // Node outer box
            const rect = document.createElementNS(svgNS, 'rect');
            rect.setAttribute('width', String(width));
            rect.setAttribute('height', String(height));
            rect.setAttribute('rx', '6');
            rect.setAttribute('fill', theme.nodeFill);
            rect.setAttribute('stroke', theme.nodeStroke);
            rect.setAttribute('stroke-width', '1');
            g.appendChild(rect);

            // Header background fill using per-table color
            const nodeData = (nodes.find(n => n.id === node.id));
            const headerFill = nodeData && nodeData.color ? nodeData.color : (isDark ? '#374151' : '#e5e7eb');
            const headerRect = document.createElementNS(svgNS, 'rect');
            headerRect.setAttribute('x', '0');
            headerRect.setAttribute('y', '0');
            headerRect.setAttribute('width', String(width));
            headerRect.setAttribute('height', String(HEADER_HEIGHT));
            headerRect.setAttribute('fill', headerFill);
            headerRect.setAttribute('rx', '6');
            headerRect.setAttribute('ry', '6');
            g.appendChild(headerRect);

            // Separator line below header
            const headerSep = document.createElementNS(svgNS, 'line');
            headerSep.setAttribute('x1', '0');
            headerSep.setAttribute('y1', String(HEADER_HEIGHT));
            headerSep.setAttribute('x2', String(width));
            headerSep.setAttribute('y2', String(HEADER_HEIGHT));
            headerSep.setAttribute('stroke', theme.nodeStroke);
            headerSep.setAttribute('stroke-width', '1');
            g.appendChild(headerSep);

            // Decide readable header text color
            const hex = headerFill.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16), gC = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16);
            const luminance = (0.299 * r + 0.587 * gC + 0.114 * b) / 255;
            const headerText = luminance > 0.6 ? '#111827' : '#f9fafb';

            // Table name (header)
            const title = document.createElementNS(svgNS, 'text');
            title.setAttribute('x', String(Math.round(width / 2)));
            title.setAttribute('y', '18');
            title.setAttribute('text-anchor', 'middle');
            title.setAttribute('font-family', 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif');
            title.setAttribute('font-size', '13');
            title.setAttribute('font-weight', '600');
            title.setAttribute('fill', headerText);
            const titleSpan = document.createElementNS(svgNS, 'tspan');
            titleSpan.textContent = node.id;
            title.appendChild(titleSpan);
            g.appendChild(title);

            // Column rows from ports positions
            const nodeMeta = (nodes.find(n => n.id === node.id));
            const rowStartY = HEADER_HEIGHT + 14; // baseline for text in first row
            const fontSize = 12;

            if (nodeMeta && Array.isArray(nodeMeta.ports)) {
                nodeData.ports.forEach((port, idx) => {
                    const y = HEADER_HEIGHT + idx * PORT_HEIGHT;

                    // Alternating row background fill
                    if (idx % 2 === 1) {
                        const rowBg = document.createElementNS(svgNS, 'rect');
                        rowBg.setAttribute('x', '0');
                        rowBg.setAttribute('y', String(y));
                        rowBg.setAttribute('width', String(width));
        // After drawing all nodes, place edge labels on top and nudge to dodge nodes
        const nodeBoxes = (layout.children || []).map(n => ({
            id: n.id,
            x1: Math.round((n.x || 0) + margin),
            y1: Math.round((n.y || 0) + margin),
            x2: Math.round((n.x || 0) + margin + (n.width || NODE_WIDTH)),
            y2: Math.round((n.y || 0) + margin + (n.height || HEADER_HEIGHT))
        }));

        const labelPadding = 6; // gap from node box
        const maxNudges = 3;
        labelsToDraw.forEach(({ x, y, text, dx, dy }) => {
            let lx = x, ly = y;

            // Nudge loop: try up to maxNudges to escape node boxes
            for (let i = 0; i < maxNudges; i++) {
                const hit = nodeBoxes.find(b => lx >= b.x1 && lx <= b.x2 && ly >= b.y1 && ly <= b.y2);
                if (!hit) break;
                const len = Math.max(1, Math.hypot(dx, dy));
                const ux = -dy / len, uy = dx / len; // perpendicular
                const cx = (hit.x1 + hit.x2) / 2, cy = (hit.y1 + hit.y2) / 2;
                const sgn = ((lx - cx) * ux + (ly - cy) * uy) >= 0 ? 1 : -1;
                const bump = labelPadding + 8 + i * 4; // progressively larger
                lx += sgn * ux * bump;
                ly += sgn * uy * bump;
            }

            // Text with stroke outline (no halo)
            const label = document.createElementNS(svgNS, 'text');
            label.setAttribute('x', String(lx));
            label.setAttribute('y', String(ly));
            label.setAttribute('font-family', 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif');
            label.setAttribute('font-size', '11');
            label.setAttribute('fill', theme.text);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('dominant-baseline', 'central');
            label.setAttribute('paint-order', 'stroke');
            label.setAttribute('stroke', isDark ? '#0b0f19' : '#ffffff');
            label.setAttribute('stroke-width', '2.5');
            label.setAttribute('pointer-events', 'none');
            label.textContent = text;
            svg.appendChild(label);
        });
                        rowBg.setAttribute('height', String(PORT_HEIGHT));
                        rowBg.setAttribute('fill', isDark ? '#0b1220' : '#f5f7fa');
                        rowBg.setAttribute('opacity', '0.7');
                        g.appendChild(rowBg);
                    }

                    // Row separator
                    const rowLine = document.createElementNS(svgNS, 'line');
                    rowLine.setAttribute('x1', '0');
                    rowLine.setAttribute('y1', String(y));
                    rowLine.setAttribute('x2', String(width));
                    rowLine.setAttribute('y2', String(y));
                    rowLine.setAttribute('stroke', theme.nodeStroke);
                    rowLine.setAttribute('stroke-width', '0.5');
                    g.appendChild(rowLine);

                    // Extract column name
                    const colName = port.id.split(':').slice(1).join(':');

                    // Column text with type
                    const txt = document.createElementNS(svgNS, 'text');
                    txt.setAttribute('x', '8');
                    txt.setAttribute('y', String(rowStartY + idx * PORT_HEIGHT));
                    txt.setAttribute('font-family', 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif');
                    txt.setAttribute('font-size', String(fontSize));
                    txt.setAttribute('fill', theme.text);

                    // Badges for PK/FK
                    const tableCols = (data.tables[node.id] || []);
                    const colInfo = tableCols.find(c => c.name === colName);
                    const badges = [];
                    if (colInfo && colInfo.is_primary) badges.push('PK');
                    const isFK = (data.relationships || []).some(rel =>
                        (rel.from.table === node.id && rel.from.column === colName) ||
                        (rel.to.table === node.id && rel.to.column === colName)
                    );
                    if (isFK) badges.push('FK');

                    if (badges.length) {
                        const badge = document.createElementNS(svgNS, 'tspan');
                        badge.textContent = `[${badges.join(',')}] `;
                        badge.setAttribute('font-weight', '600');
                        txt.appendChild(badge);
                    }

                    const nameSpan = document.createElementNS(svgNS, 'tspan');
                    nameSpan.textContent = colName + (colInfo && colInfo.type ? ` : ${colInfo.type}` : '');
                    nameSpan.setAttribute('fill-opacity', colInfo && colInfo.type ? '0.9' : '1');
                    txt.appendChild(nameSpan);
                    g.appendChild(txt);
                });
            }

            svg.appendChild(g);
        });

        // Convert SVG to PNG data URL
        const xml = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const tempImg = new Image();
        tempImg.src = url;
        await new Promise((resolve) => {
            tempImg.onload = () => {
                const scale = 2; // 2x for crispness
                const canvas = document.createElement('canvas');
                canvas.width = svgW * scale;
                canvas.height = svgH * scale;
                const ctx = canvas.getContext('2d');
                ctx.setTransform(scale, 0, 0, scale, 0, 0);
                ctx.drawImage(tempImg, 0, 0);
                img.src = canvas.toDataURL('image/png');
                URL.revokeObjectURL(url);
                resolve();
            };
        });

        img.onload = () => {
            img.style.opacity = '1';
            img.style.pointerEvents = 'auto';
            img.style.cursor = 'grab';
            if (!img.dataset.zoomInitialized) {
                initializeZoomPan(container, img);
            }
        };
    } catch (error) {
        console.error('Error rendering ELK (hierarchical) schema:', error);
        img.style.display = 'none';
        const errorMsg = container.querySelector('.schema-error');
        errorMsg.textContent = `Failed to render hierarchical diagram: ${error.message}`;
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

        // Create a fresh container with proper textContent
        const newContainer = document.createElement('div');
        newContainer.className = 'mermaid';
        newContainer.textContent = definition;

        // Append to container
        mermaidDiv.appendChild(newContainer);

        // Render diagram
        const mermaid = await window.mermaidPromise;
        console.log('Using Mermaid version:', mermaid.version ? mermaid.version() : 'unknown');

        // Reset mermaid instance with configuration
        mermaid.initialize({
            startOnLoad: false,
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
                fontSize: 20
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

            const svg = newContainer.querySelector('svg');
            if (svg && !svg.hasAttribute('data-png-converted')) {
                // Convert SVG to PNG
                const svgData = new XMLSerializer().serializeToString(svg);
                const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
                const DOMURL = window.URL || window.webkitURL || window;
                const url = DOMURL.createObjectURL(svgBlob);

                const img = new Image();
                img.src = url;

                await new Promise(resolve => {
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = svg.viewBox.baseVal.width * 2;  // 2x for better quality
                        canvas.height = svg.viewBox.baseVal.height * 2;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                        // Replace SVG with PNG image
                        const pngImage = document.createElement('img');
                        pngImage.src = canvas.toDataURL('image/png');
                        pngImage.style.width = '100%';
                        pngImage.style.height = '100%';
                        pngImage.setAttribute('data-png-converted', 'true');
                        newContainer.innerHTML = '';
                        newContainer.appendChild(pngImage);

                        DOMURL.revokeObjectURL(url);
                        resolve();
                    };
                });
            }

            // Make the diagram visible
            setTimeout(() => {
                mermaidDiv.style.opacity = '1';
                container.closest('.schema-modal').classList.add('loaded');
            }, 100);

            // Initialize zoom/pan for the appropriate element
            const targetElement = useGraphviz ? container.querySelector('#graphvizContent') : container.querySelector('.mermaid img, .mermaid svg');
            initializeZoomPan(container, targetElement);
        } catch (renderError) {
            console.error('Mermaid render error:', renderError);
            throw renderError;
        }
    } catch (error) {
        console.error('Error rendering mermaid diagram:', error);
        container.querySelector('.mermaid').innerHTML = `<div style="color: red; padding: 20px;">Failed to render schema diagram: ${error.message}</div>`;
    }
}

// Global D3 renderer instance
let d3Renderer = null;

async function renderD3Schema(container, data) {
    try {
        console.log('Rendering D3 force-directed schema...');

        if (!window.D3SchemaRenderer) {
            throw new Error('D3SchemaRenderer module not loaded');
        }

        // Clean up previous renderer
        if (d3Renderer) {
            d3Renderer.destroy();
        }

        // Create new renderer instance with the main container (like GraphViz and Mermaid)
        d3Renderer = new window.D3SchemaRenderer(container);

        // Render the schema
        await d3Renderer.render(data);

        // Initialize zoom/pan after D3 rendering is complete
        setTimeout(() => {
            const svgElement = container.querySelector('#d3-schema-svg');
            if (svgElement) {
                console.log('Initializing zoom/pan for D3 SVG...');

                // Apply initial zoom and centering before making visible
                const containerRect = container.getBoundingClientRect();
                const viewBox = svgElement.getAttribute('viewBox');
                const initialScale = 0.7;

                if (viewBox) {
                    const [, , width, height] = viewBox.split(' ').map(Number);
                    const containerCenterX = containerRect.width / 2;
                    const containerCenterY = containerRect.height / 2;
                    const targetCenterX = (width * initialScale) / 2;
                    const targetCenterY = (height * initialScale) / 2;

                    const panX = containerCenterX - targetCenterX;
                    const panY = containerCenterY - targetCenterY;

                    // Apply the transform immediately
                    svgElement.style.transform = `translate(${panX}px, ${panY}px) scale(${initialScale})`;
                    svgElement.style.transformOrigin = '0 0';
                }

                // Make SVG visible with the correct transform already applied
                svgElement.style.opacity = '1';

                // Initialize zoom/pan system
                initializeZoomPan(container, svgElement);
            } else {
                console.warn('SVG element not found for zoom initialization');
            }
        }, 300);

        console.log('D3 force-directed schema rendered successfully');

    } catch (error) {
        console.error('Error rendering D3 schema:', error);
        // Create error message in main container
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'color: red; padding: 20px; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);';
        errorDiv.textContent = `Failed to render D3 diagram: ${error.message}`;
        container.appendChild(errorDiv);
    }
}

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

    // Migrate old preferences and set defaults
    if (savedSchemaType === null || savedSchemaType === 'graphviz' || savedSchemaType === 'hierarchy') {
        schemaType = 'hierarchy';
        useGraphviz = true; // 'useGraphviz' now means 'useHierarchy'
        // Migrate stored preference
        localStorage.setItem('preferredSchemaType', 'hierarchy');
    } else if (savedSchemaType === 'mermaid') {
        schemaType = 'mermaid';
        useGraphviz = false;
    } else if (savedSchemaType === 'd3') {
        schemaType = 'd3';
        useGraphviz = false;
    } else {
        // Default fallback
        schemaType = 'hierarchy';
        useGraphviz = true;
        localStorage.setItem('preferredSchemaType', 'hierarchy');
    }

    // Set initial UI state
    document.querySelectorAll('.schema-option').forEach(option => {
        option.classList.remove('active');
    });
    const activeOption = document.querySelector(`[data-type="${schemaType}"]`);
    if (activeOption) {
        activeOption.classList.add('active');
    }

    // Initialize hierarchy controls visibility and events
    const hc = document.querySelector('.hierarchy-controls');
    if (hc) hc.style.display = (schemaType === 'hierarchy') ? 'flex' : 'none';
    const dirBtn = document.getElementById('hierarchyDirectionToggle');
    if (dirBtn) {
        dirBtn.textContent = elkDirection;
        dirBtn.addEventListener('click', () => {
            elkDirection = (elkDirection === 'RIGHT') ? 'DOWN' : 'RIGHT';
            localStorage.setItem('hierarchyDirection', elkDirection);
            dirBtn.textContent = elkDirection;
            if (schemaType === 'hierarchy' && currentData) {
                renderGraphvizSchema(container, currentData);
            }
        });
    }
    // Setup the resize observer for responsive content
    setupResizeObserver(modal);

    // Initialize resize functionality for schema modal
    const schemaContent = modal.querySelector('.schema-content');

    // Save dimensions when closing schema
    modal.querySelector('.schema-close').addEventListener('click', () => {
        const width = parseInt(window.getComputedStyle(schemaContent).width, 10);
        const height = parseInt(window.getComputedStyle(schemaContent).height, 10);
        localStorage.setItem('schemaDimensions', JSON.stringify({ width, height }));
    });

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
                let blob;
                let schemaName = 'Schema';

                // Generate the appropriate blob based on schema type
                if (useGraphviz) {
                    const img = container.querySelector('#graphvizContent');
                    if (!img || !img.src) {
                        throw new Error('Hierarchy image not found');
                    }
                    const response = await fetch(img.src);
                    blob = await response.blob();
                    schemaName = 'Hierarchy schema';
                } else if (schemaType === 'd3') {
                    // Handle D3 copy

                    if (!d3Renderer) {

                        throw new Error('D3 renderer not available. Please render the schema first.');
                    }
                    blob = await d3Renderer.toPngBlob();
                    schemaName = 'D3 schema';
                    console.log(`Generated D3 schema PNG blob: ${blob.size} bytes`);
                } else {
                    // Handle Mermaid copy
                    const img = container.querySelector('.mermaid img');
                    if (!img || !img.src) {
                        throw new Error('Mermaid image not found');
                    }
                    const response = await fetch(img.src);
                    blob = await response.blob();
                    schemaName = 'Mermaid schema';
                }

                // Validate the blob
                if (!blob || blob.size === 0) {
                    throw new Error('Generated image is empty or invalid');
                }

                // Copy to clipboard - MUST WORK
                await copyBlobToClipboard(blob);

                // Success!
                showSuccessPopup(`${schemaName} copied to clipboard successfully!`);
                console.log(`✅ ${schemaName} copied to clipboard successfully`);

            } catch (error) {
                console.error('❌ Copy failed:', error);
                showErrorPopup(`Copy failed: ${error.message}`);
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
                } else if (schemaType === 'd3') {
                    // Handle D3 download
                    if (d3Renderer) {
                        const blob = await d3Renderer.toPngBlob();
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = 'schema-d3.png';
                        link.click();
                        window.URL.revokeObjectURL(url);
                        console.log('Downloaded D3 schema as PNG');
                    } else {
                        throw new Error('D3 renderer not available');
                    }
                } else {
                    // Handle Mermaid download
                    const img = container.querySelector('.mermaid img');
                    if (img) {
                        const link = document.createElement('a');
                        link.download = 'schema.png';
                        link.href = img.src;
                        link.click();
                    }
                }
            } catch (error) {
                console.error('Failed to download schema:', error);
                showErrorPopup('Failed to download schema');
            }
        });
    }

    // Add schema type selector handlers
    function switchSchemaType(newType) {
        console.log('Switching schema type to:', newType);
        schemaType = newType;

        // Update backward compatibility flag
        useGraphviz = (newType === 'hierarchy');

        // Save preference
        localStorage.setItem('preferredSchemaType', newType);

        // Update UI - remove active class from all options
        document.querySelectorAll('.schema-option').forEach(option => {
            option.classList.remove('active');
        });

        // Add active class to selected option (tabs only)
        const tabBtn = document.querySelector(`.schema-option[data-type="${newType}"]`);
        if (tabBtn) tabBtn.classList.add('active');

        // Show/hide hierarchy controls
        const showHC = (newType === 'hierarchy');
        const hc = document.querySelector('.hierarchy-controls');
        if (hc) hc.style.display = showHC ? 'flex' : 'none';

        // Reset zoom initialization flags
        container.querySelector('#graphvizContent')?.removeAttribute('data-zoom-initialized');
        container.querySelector('.mermaid')?.removeAttribute('data-zoom-initialized');
        container.querySelector('#d3Content')?.removeAttribute('data-zoom-initialized');

        if (currentData) {
            // Hide all containers and clean up D3
            document.querySelector('.mermaid').style.display = 'none';
            document.getElementById('graphvizContent').style.display = 'none';

            // Clean up D3 when switching away from it
            if (d3Renderer) {
                d3Renderer.destroy();
                d3Renderer = null;
            }

            // Remove D3 active class when switching away from D3
            container.classList.remove('d3-active');

            // Reset caches when switching
            lastGraphvizTheme = null;
            lastGraphvizResult = null;

            // Show and render appropriate container
            if (newType === 'hierarchy') {
                document.getElementById('graphvizContent').style.display = 'block';
                document.getElementById('graphvizContent').style.pointerEvents = 'auto';
                renderGraphvizSchema(container, currentData);
            } else if (newType === 'mermaid') {
                document.querySelector('.mermaid').style.display = 'block';
                renderMermaidSchema(container, currentData);
            } else if (newType === 'd3') {
                renderD3Schema(container, currentData);
            }
        }
    }

    // Add click handlers to schema option buttons
    document.querySelectorAll('.schema-option').forEach(option => {
        option.addEventListener('click', function() {
            const newType = this.dataset.type;
            switchSchemaType(newType);

            // Show/hide D3 controls based on selection
            updateD3ControlsVisibility(newType);
        });
    });

    // Function to update D3 controls visibility
    function updateD3ControlsVisibility(schemaType) {
        const d3Controls = document.querySelector('.d3-controls');
        if (d3Controls) {
            d3Controls.style.display = schemaType === 'd3' ? 'flex' : 'none';
        }
    }

    // Check initial schema type and show D3 controls if needed
    const activeSchemaOption = document.querySelector('.schema-option.active');
    if (activeSchemaOption) {
        const initialSchemaType = activeSchemaOption.dataset.type;
        updateD3ControlsVisibility(initialSchemaType);
    }

    // Add D3 control handlers
    const clumpingSlider = document.getElementById('clumpingSlider');
    const resetLayoutBtn = document.getElementById('resetLayout');
    const optimizeLayoutBtn = document.getElementById('optimizeLayout');
    const pauseSimulationBtn = document.getElementById('pauseSimulation');

    if (clumpingSlider) {
        clumpingSlider.addEventListener('input', (e) => {
            if (d3Renderer) {
                d3Renderer.updateLayoutSpacing(parseInt(e.target.value));
            }
        });
    }

    if (resetLayoutBtn) {
        resetLayoutBtn.addEventListener('click', () => {
            if (d3Renderer) {
                d3Renderer.resetLayout();
            }
        });
    }

    if (optimizeLayoutBtn) {
        optimizeLayoutBtn.addEventListener('click', () => {
            if (d3Renderer) {
                // Show loading state
                const originalHTML = optimizeLayoutBtn.innerHTML;
                optimizeLayoutBtn.innerHTML = `<span class="lang-ko">최적화 중...</span><span class="lang-en">Optimizing...</span><span class="lang-vi">Đang tối ưu...</span>`;
                optimizeLayoutBtn.disabled = true;

                // Use setTimeout to allow UI to update before heavy computation
                setTimeout(() => {
                    try {
                        d3Renderer.optimizeInitialLayout();
                        // Restart simulation to apply the new positions
                        if (d3Renderer.simulation) {
                            d3Renderer.simulation.alpha(0.5).restart();
                        }
                    } finally {
                        // Restore button state
                        optimizeLayoutBtn.innerHTML = originalHTML;
                        optimizeLayoutBtn.disabled = false;
                    }
                }, 50);
            }
        });
    }

    if (pauseSimulationBtn) {
        pauseSimulationBtn.addEventListener('click', () => {
            if (d3Renderer) {
                const isPaused = d3Renderer.pauseSimulation();
                // Update button text with language spans
                pauseSimulationBtn.innerHTML = isPaused ?
                    `<span class="lang-ko">재개</span><span class="lang-en">Resume</span><span class="lang-vi">Tiếp tục</span>` :
                    `<span class="lang-ko">일시정지</span><span class="lang-en">Pause</span><span class="lang-vi">Tạm dừng</span>`;
                pauseSimulationBtn.classList.toggle('active', isPaused);
            }
        });
    }

    // Add arrow type control handlers
    document.querySelectorAll('.arrow-option').forEach(option => {
        option.addEventListener('click', function() {
            // Remove active class from all arrow options
            document.querySelectorAll('.arrow-option').forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked option
            this.classList.add('active');

            const arrowType = this.dataset.arrow;
            if (d3Renderer) {
                d3Renderer.setArrowType(arrowType);
            }
        });
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

            const schemaContent = modal.querySelector('.schema-content');

            // Set display before loading dimensions so computed styles work correctly
            modal.style.display = 'block';

            // Small delay to ensure modal is rendered before we modify dimensions
            await new Promise(resolve => setTimeout(resolve, 50));

            // Load saved dimensions immediately when modal opens
            const savedDimensions = localStorage.getItem('schemaDimensions');
            if (savedDimensions) {
                try {
                    const { width, height } = JSON.parse(savedDimensions);
                    schemaContent.style.width = `${width}px`;
                    schemaContent.style.height = `${height}px`;
                } catch (e) {
                    console.error('Error loading saved schema dimensions:', e);
                }
            }

            setTimeout(() => modal.classList.add('visible'), 10);
            const showSchema = () => {
                const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

                // Reset caches if theme has changed
                if (schemaType === 'graphviz' && lastGraphvizTheme !== currentTheme) {
                    lastGraphvizTheme = null;
                    lastGraphvizResult = null;
                }

                loading.style.display = 'none';
                currentData = schemaData;

                // Show D3 controls if D3 is the active schema type
                updateD3ControlsVisibility(schemaType);

                // Hide all containers
                document.querySelector('.mermaid').style.display = 'none';
                document.getElementById('graphvizContent').style.display = 'none';
                document.getElementById('d3Content').style.display = 'none';

                // Show and render appropriate container
                if (schemaType === 'hierarchy') {
                    document.getElementById('graphvizContent').style.display = 'block';
                    renderGraphvizSchema(container, currentData);
                } else if (schemaType === 'mermaid') {
                    document.querySelector('.mermaid').style.display = 'block';
                    renderMermaidSchema(container, currentData);
                } else if (schemaType === 'd3') {
                    renderD3Schema(container, currentData);
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
    const closeModal = () => {
        modal.classList.remove('visible');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    };

    // Add ESC key handler
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'block') {
            closeModal();
        }
    });

    modal.querySelector('.schema-close').addEventListener('click', () => {
        closeModal();
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

function setupResizeObserver(modal) {
    const schemaContent = modal.querySelector('.schema-content');
    const schemaContainer = modal.querySelector('.schema-container');

    if (window.ResizeObserver) {
        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (currentData && schemaContainer) {
                    if (useGraphviz) {
                        const img = schemaContainer.querySelector('#graphvizContent');
                        if (img && img.dataset.zoomInitialized) {
                            img.style.maxWidth = `${entry.contentRect.width - 40}px`;
                            img.style.maxHeight = `${entry.contentRect.height - 40}px`;
                        }
                    } else {
                        const mermaidDiv = schemaContainer.querySelector('.mermaid');
                        if (mermaidDiv && mermaidDiv.dataset.zoomInitialized) {
                            mermaidDiv.dispatchEvent(new CustomEvent('containerResized'));
                        }
                    }
                }

                schemaContainer.style.width = `${entry.contentRect.width - 40}px`;
                schemaContainer.style.height = `${entry.contentRect.height - 40}px`;
            }
        });

        resizeObserver.observe(schemaContent);
    }
}
