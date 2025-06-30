/**
 * D3 Force-Directed Schema Visualization Module
 * Handles interactive database schema rendering with auto-arranging tables
 */

class D3SchemaRenderer {
    constructor(container) {
        this.container = container;
        this.svg = null;
        this.simulation = null;
        this.nodes = [];
        this.links = [];
        this.width = 800;
        this.height = 600;
        this.svgId = 'd3-schema-svg'; // Unique ID for the SVG
        this.arrowType = 'elbow'; // Default arrow type: 'elbow', 'straight', 'curved'
    }

    async render(data) {
        try {
            console.log('Rendering D3 force-directed schema...');

            // Clear any existing D3 SVG
            const existingSvg = this.container.querySelector(`#${this.svgId}`);
            if (existingSvg) {
                existingSvg.remove();
            }

            // Hide other schema elements and enable D3 overflow
            const graphvizContent = this.container.querySelector('#graphvizContent');
            const mermaidDiv = this.container.querySelector('.mermaid');
            const d3Content = this.container.querySelector('#d3Content');

            if (graphvizContent) graphvizContent.style.display = 'none';
            if (mermaidDiv) mermaidDiv.style.display = 'none';
            if (d3Content) d3Content.style.display = 'none';

            // Add class to allow D3 content to extend beyond container
            this.container.classList.add('d3-active');

            if (!window.d3) {
                throw new Error('D3.js library not loaded');
            }

            // Fetch D3-specific data if needed
            let d3Data = data;
            if (!data.d3_metadata) {
                console.log('Fetching D3-enhanced schema data...');
                const response = await fetch(`${window.location.origin}/schema?type=d3`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                d3Data = await response.json();
                
                if (d3Data.error) {
                    throw new Error(d3Data.error);
                }
            }

            this.setupSVG();
            this.prepareData(d3Data);
            this.createForceSimulation();
            this.renderLinks();
            this.renderNodes();
            this.setupInteractions();

            // Zoom/pan will be initialized by the main schema.js after rendering
            
            this.container.style.opacity = '1';
            console.log('D3 force-directed schema rendered successfully');
            
        } catch (error) {
            console.error('Error rendering D3 schema:', error);
            this.container.innerHTML = `<div style="color: red; padding: 20px;">Failed to render D3 diagram: ${error.message}</div>`;
        }
    }

    getThemeColors() {
        // Create a temporary element to compute CSS custom properties
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.visibility = 'hidden';
        document.body.appendChild(tempDiv);

        const computedStyle = getComputedStyle(tempDiv);

        const colors = {
            surface: computedStyle.getPropertyValue('--md-sys-color-surface').trim() || '#fef7ff',
            surfaceVariant: computedStyle.getPropertyValue('--md-sys-color-surface-variant').trim() || '#e7e0ec',
            primaryContainer: computedStyle.getPropertyValue('--md-sys-color-primary-container').trim() || '#eaddff',
            primary: computedStyle.getPropertyValue('--md-sys-color-primary').trim() || '#6750a4',
            secondary: computedStyle.getPropertyValue('--md-sys-color-secondary').trim() || '#625b71',
            outline: computedStyle.getPropertyValue('--md-sys-color-outline').trim() || '#79747e',
            onSurface: computedStyle.getPropertyValue('--md-sys-color-on-surface').trim() || '#1d1b20',
            onSurfaceVariant: computedStyle.getPropertyValue('--md-sys-color-on-surface-variant').trim() || '#49454f',
            onPrimaryContainer: computedStyle.getPropertyValue('--md-sys-color-on-primary-container').trim() || '#21005d',
            onPrimary: computedStyle.getPropertyValue('--md-sys-color-on-primary').trim() || '#ffffff'
        };

        document.body.removeChild(tempDiv);

        // Fallback to theme-appropriate colors if CSS variables are empty
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (!colors.surface || colors.surface === '') {
            if (isDark) {
                colors.surface = '#141218';
                colors.surfaceVariant = '#49454f';
                colors.primaryContainer = '#4f378b';
                colors.primary = '#d0bcff';
                colors.secondary = '#ccc2dc';
                colors.outline = '#938f99';
                colors.onSurface = '#e6e0e9';
                colors.onSurfaceVariant = '#cac4d0';
                colors.onPrimaryContainer = '#eaddff';
                colors.onPrimary = '#381e72';
            } else {
                colors.surface = '#fef7ff';
                colors.surfaceVariant = '#e7e0ec';
                colors.primaryContainer = '#eaddff';
                colors.primary = '#6750a4';
                colors.secondary = '#625b71';
                colors.outline = '#79747e';
                colors.onSurface = '#1d1b20';
                colors.onSurfaceVariant = '#49454f';
                colors.onPrimaryContainer = '#21005d';
                colors.onPrimary = '#ffffff';
            }
        }

        return colors;
    }

    setupSVG() {
        // Get container dimensions - use full container size
        const containerRect = this.container.getBoundingClientRect();
        this.width = Math.max(800, containerRect.width || 800);
        this.height = Math.max(600, containerRect.height || 600);

        // Get computed theme colors
        this.colors = this.getThemeColors();

        // Create SVG directly in the main container with overflow handling
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('id', this.svgId)
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${this.width} ${this.height}`)
            .style('position', 'absolute')
            .style('top', '0')
            .style('left', '0')
            .style('background', this.colors.surface)
            .style('border-radius', '8px')
            .style('cursor', 'grab')
            .style('user-select', 'none')
            .style('z-index', '1')
            .style('overflow', 'visible'); // Allow content to extend beyond boundaries

        // Add background rectangle for zoom/pan events
        this.svg.append('rect')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('fill', 'transparent')
            .attr('class', 'zoom-background');

        // Create container groups for proper layering
        this.linkGroup = this.svg.append('g').attr('class', 'links');
        this.nodeGroup = this.svg.append('g').attr('class', 'nodes');

        // Add arrowhead markers for elbow connectors
        this.setupMarkers();
    }

    setupMarkers() {
        const defs = this.svg.append('defs');
        
        // Standard arrowhead
        defs.append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 8)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', this.colors.outline);

        // Highlighted arrowhead
        defs.append('marker')
            .attr('id', 'arrowhead-highlight')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 8)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', this.colors.primary);
    }

    prepareData(d3Data) {
        const tables = d3Data.tables || {};
        const relationships = d3Data.relationships || [];
        const metadata = d3Data.d3_metadata || {};
        
        // Create nodes with enhanced information
        this.nodes = Object.keys(tables).map(tableName => {
            const table = tables[tableName];
            const weight = metadata.node_weights?.[tableName] || 0;
            const cluster = metadata.cluster_hints?.[tableName] || 'general';
            const isPrimary = metadata.primary_tables?.includes(tableName) || false;

            // Categorize columns - table is directly an array of columns
            const columns = Array.isArray(table) ? table : (table.columns || []);

            // Identify foreign keys by checking relationships
            const foreignKeyColumns = new Set();
            relationships.forEach(rel => {
                if (rel.from.table === tableName) {
                    foreignKeyColumns.add(rel.from.column);
                }
            });

            const primaryKeys = columns.filter(col => col.is_primary === true);
            const foreignKeys = columns.filter(col => foreignKeyColumns.has(col.name));
            const regularColumns = columns.filter(col => !col.is_primary && !foreignKeyColumns.has(col.name));
            
            // Debug logging
            console.log(`Table ${tableName}:`, {
                totalColumns: columns.length,
                primaryKeys: primaryKeys.length,
                foreignKeys: foreignKeys.length,
                regularColumns: regularColumns.length,
                sampleColumns: columns.slice(0, 3)
            });

            return {
                id: tableName,
                name: tableName,
                columns: columns,
                primaryKeys: primaryKeys,
                foreignKeys: foreignKeys,
                regularColumns: regularColumns,
                weight: weight,
                cluster: cluster,
                isPrimary: isPrimary,
                x: this.width / 2 + (Math.random() - 0.5) * 200,
                y: this.height / 2 + (Math.random() - 0.5) * 200
            };
        });

        // Create links
        this.links = relationships.map(rel => ({
            source: rel.from.table,
            target: rel.to.table,
            sourceColumn: rel.from.column,
            targetColumn: rel.to.column,
            type: 'foreign_key'
        }));

        console.log(`D3 Schema: ${this.nodes.length} tables, ${this.links.length} relationships`);
    }

    createForceSimulation() {
        // Default values for medium spacing (slider value 50)
        this.layoutSettings = {
            linkDistance: 200,
            linkStrength: 0.7,
            chargeStrength: -1000,
            collisionRadius: 100
        };

        this.simulation = d3.forceSimulation(this.nodes)
            .force('link', d3.forceLink(this.links).id(d => d.id).distance(this.layoutSettings.linkDistance).strength(this.layoutSettings.linkStrength))
            .force('charge', d3.forceManyBody().strength(this.layoutSettings.chargeStrength))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .force('collision', d3.forceCollide().radius(this.layoutSettings.collisionRadius))
            .force('x', d3.forceX(this.width / 2).strength(0.1))
            .force('y', d3.forceY(this.height / 2).strength(0.1));
    }

    updateLayoutSpacing(sliderValue) {
        // Convert slider value (0-100) to layout parameters
        // 0 = tight clustering, 100 = spread out
        const factor = sliderValue / 50; // 0-2 range, 1 = default

        this.layoutSettings = {
            linkDistance: 120 + (factor * 180), // 120-480 range
            linkStrength: Math.max(0.3, 0.9 - (factor * 0.4)), // 0.9-0.3 range (stronger = tighter)
            chargeStrength: -600 - (factor * 1400), // -600 to -2000 range (more negative = more repulsion)
            collisionRadius: 80 + (factor * 60) // 80-200 range
        };

        // Update the simulation forces
        if (this.simulation) {
            // Update link force
            this.simulation.force('link')
                .distance(this.layoutSettings.linkDistance)
                .strength(this.layoutSettings.linkStrength);

            // Update charge force
            this.simulation.force('charge')
                .strength(this.layoutSettings.chargeStrength);

            // Update collision force
            this.simulation.force('collision')
                .radius(this.layoutSettings.collisionRadius);

            // Restart simulation with new parameters
            this.simulation.alpha(0.3).restart();
        }
    }

    resetLayout() {
        // Reset all nodes to random positions around center
        this.nodes.forEach(node => {
            node.x = this.width / 2 + (Math.random() - 0.5) * 200;
            node.y = this.height / 2 + (Math.random() - 0.5) * 200;
            node.fx = null;
            node.fy = null;
        });

        if (this.simulation) {
            this.simulation.alpha(1).restart();
        }
    }

    pauseSimulation() {
        if (this.simulation) {
            if (this.simulation.alpha() > 0) {
                this.simulation.stop();
                return true; // Was running, now paused
            } else {
                this.simulation.alpha(0.3).restart();
                return false; // Was paused, now running
            }
        }
        return false;
    }

    renderLinks() {
        // We'll render elbow connectors instead of straight lines
        this.linkElements = this.linkGroup.selectAll('.link-group')
            .data(this.links)
            .enter().append('g')
            .attr('class', 'link-group');

        // Add elbow path for each link
        this.linkElements.append('path')
            .attr('class', 'link-path')
            .attr('fill', 'none')
            .attr('stroke', this.colors.outline)
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.6)
            .attr('marker-end', 'url(#arrowhead)');

        // Add relationship labels
        this.linkElements.append('text')
            .attr('class', 'link-label')
            .attr('font-family', 'system-ui, -apple-system, sans-serif')
            .attr('font-size', '10px')
            .attr('fill', this.colors.onSurfaceVariant)
            .attr('text-anchor', 'middle')
            .attr('opacity', 0.7)
            .text(d => `${d.sourceColumn} → ${d.targetColumn}`);
    }

    renderNodes() {
        this.nodeElements = this.nodeGroup.selectAll('.table-node')
            .data(this.nodes)
            .enter().append('g')
            .attr('class', 'table-node')
            .style('cursor', 'grab')
            .call(d3.drag()
                .on('start', (event, d) => this.dragStarted(event, d))
                .on('drag', (event, d) => this.dragged(event, d))
                .on('end', (event, d) => this.dragEnded(event, d)));

        this.renderTableBoxes();
        this.renderTableContent();
    }

    renderTableBoxes() {
        // Calculate dynamic table dimensions
        this.nodeElements.each(function(d) {
            const maxColumns = 8; // Show more columns
            const visibleColumns = Math.min(d.columns.length, maxColumns);
            const headerHeight = 30;
            const columnHeight = 16;
            const padding = 10;
            
            d.width = Math.max(200, d.name.length * 8 + 40);
            d.height = headerHeight + (visibleColumns * columnHeight) + padding * 2;
        });

        // Add table rectangles with enhanced styling
        this.nodeElements.append('rect')
            .attr('class', 'table-rect')
            .attr('width', d => d.width)
            .attr('height', d => d.height)
            .attr('rx', 8)
            .attr('ry', 8)
            .attr('fill', d => d.isPrimary ? this.colors.primaryContainer : this.colors.surfaceVariant)
            .attr('stroke', d => d.isPrimary ? this.colors.primary : this.colors.outline)
            .attr('stroke-width', d => d.isPrimary ? 2 : 1)
            .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');

        // Add header separator line
        this.nodeElements.append('line')
            .attr('class', 'header-line')
            .attr('x1', 5)
            .attr('x2', d => d.width - 5)
            .attr('y1', 30)
            .attr('y2', 30)
            .attr('stroke', d => d.isPrimary ? this.colors.primary : this.colors.outline)
            .attr('stroke-width', 1)
            .attr('opacity', 0.5);
    }

    renderTableContent() {
        // Add table names (headers)
        this.nodeElements.append('text')
            .attr('class', 'table-name')
            .attr('x', d => d.width / 2)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-family', 'system-ui, -apple-system, sans-serif')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .attr('fill', d => d.isPrimary ? this.colors.onPrimaryContainer : this.colors.onSurfaceVariant)
            .text(d => d.name);

        // Add column information with icons and types
        const colors = this.colors; // Capture colors reference for use in callbacks
        this.nodeElements.each(function(d) {
            const nodeGroup = d3.select(this);
            const maxColumns = 8;
            let yOffset = 45;

            // Show primary keys first
            d.primaryKeys.slice(0, maxColumns).forEach((column, i) => {
                if (yOffset > d.height - 20) return;

                nodeGroup.append('text')
                    .attr('x', 8)
                    .attr('y', yOffset)
                    .attr('font-family', 'system-ui, -apple-system, sans-serif')
                    .attr('font-size', '11px')
                    .attr('font-weight', 'bold')
                    .attr('fill', colors.primary)
                    .text(`🔑 ${column.name}: ${column.type}`);

                yOffset += 16;
            });
            
            // Show foreign keys
            d.foreignKeys.slice(0, maxColumns - d.primaryKeys.length).forEach((column, i) => {
                if (yOffset > d.height - 20) return;

                nodeGroup.append('text')
                    .attr('x', 8)
                    .attr('y', yOffset)
                    .attr('font-family', 'system-ui, -apple-system, sans-serif')
                    .attr('font-size', '11px')
                    .attr('fill', colors.secondary)
                    .text(`🔗 ${column.name}: ${column.type}`);

                yOffset += 16;
            });

            // Show regular columns
            const remainingSpace = maxColumns - d.primaryKeys.length - d.foreignKeys.length;
            d.regularColumns.slice(0, remainingSpace).forEach((column, i) => {
                if (yOffset > d.height - 20) return;

                nodeGroup.append('text')
                    .attr('x', 8)
                    .attr('y', yOffset)
                    .attr('font-family', 'system-ui, -apple-system, sans-serif')
                    .attr('font-size', '11px')
                    .attr('fill', d.isPrimary ? colors.onPrimaryContainer : colors.onSurfaceVariant)
                    .attr('opacity', 0.8)
                    .text(`${column.name}: ${column.type}`);

                yOffset += 16;
            });

            // Show "more columns" indicator
            const totalShown = d.primaryKeys.length + d.foreignKeys.length + Math.max(0, remainingSpace);
            if (d.columns.length > totalShown) {
                nodeGroup.append('text')
                    .attr('x', 8)
                    .attr('y', yOffset)
                    .attr('font-family', 'system-ui, -apple-system, sans-serif')
                    .attr('font-size', '10px')
                    .attr('fill', d.isPrimary ? colors.onPrimaryContainer : colors.onSurfaceVariant)
                    .attr('opacity', 0.6)
                    .text(`... +${d.columns.length - totalShown} more columns`);
            }
        });
    }

    setupInteractions() {
        // Add hover effects
        this.nodeElements
            .on('mouseenter', (event, d) => this.onNodeHover(event, d))
            .on('mouseleave', (event, d) => this.onNodeLeave(event, d));

        // Setup simulation tick
        this.simulation.on('tick', () => this.tick());
    }

    onNodeHover(event, d) {
        // Highlight the hovered table
        d3.select(event.currentTarget).select('.table-rect')
            .attr('stroke-width', 3)
            .attr('filter', 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))');

        // Highlight connected links with elbow paths
        this.linkElements.selectAll('.link-path')
            .attr('stroke-opacity', l =>
                (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.2
            )
            .attr('stroke-width', l =>
                (l.source.id === d.id || l.target.id === d.id) ? 3 : 2
            )
            .attr('marker-end', l =>
                (l.source.id === d.id || l.target.id === d.id) ? 'url(#arrowhead-highlight)' : 'url(#arrowhead)'
            );

        // Highlight relationship labels
        this.linkElements.selectAll('.link-label')
            .attr('opacity', l =>
                (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.3
            );
    }

    onNodeLeave(event, d) {
        // Reset table styling
        d3.select(event.currentTarget).select('.table-rect')
            .attr('stroke-width', d => d.isPrimary ? 2 : 1)
            .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');

        // Reset link styles
        this.linkElements.selectAll('.link-path')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 2)
            .attr('marker-end', 'url(#arrowhead)');

        // Reset label opacity
        this.linkElements.selectAll('.link-label')
            .attr('opacity', 0.7);
    }

    tick() {
        // Update connector paths based on arrow type
        this.linkElements.selectAll('.link-path')
            .attr('d', d => this.createPath(d));

        // Update link labels position
        this.linkElements.selectAll('.link-label')
            .attr('x', d => (d.source.x + d.target.x) / 2)
            .attr('y', d => (d.source.y + d.target.y) / 2 - 5);

        // Update node positions
        this.nodeElements.attr('transform', d =>
            `translate(${d.x - d.width / 2}, ${d.y - d.height / 2})`
        );
    }

    setArrowType(type) {
        this.arrowType = type;
        // Update all existing paths
        if (this.linkElements) {
            this.linkElements.selectAll('.link-path')
                .attr('d', d => this.createPath(d));
        }
    }

    createPath(d) {
        switch (this.arrowType) {
            case 'straight':
                return this.createStraightPath(d);
            case 'curved':
                return this.createCurvedPath(d);
            case 'elbow':
            default:
                return this.createElbowPath(d);
        }
    }

    createStraightPath(d) {
        // Simple straight line from center to center
        return `M ${d.source.x} ${d.source.y} L ${d.target.x} ${d.target.y}`;
    }

    createCurvedPath(d) {
        const sourceX = d.source.x;
        const sourceY = d.source.y;
        const targetX = d.target.x;
        const targetY = d.target.y;

        // Calculate connection points on table edges
        const sourcePoint = this.getConnectionPoint(d.source, targetX, targetY);
        const targetPoint = this.getConnectionPoint(d.target, sourceX, sourceY);

        // Create curved path using quadratic Bezier curve
        const midX = (sourcePoint.x + targetPoint.x) / 2;
        const midY = (sourcePoint.y + targetPoint.y) / 2;

        // Calculate control point for curve
        const dx = targetPoint.x - sourcePoint.x;
        const dy = targetPoint.y - sourcePoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Curve intensity based on distance
        const curveOffset = Math.min(distance * 0.3, 100);

        // Control point perpendicular to the line
        const controlX = midX + (-dy / distance) * curveOffset;
        const controlY = midY + (dx / distance) * curveOffset;

        return `M ${sourcePoint.x} ${sourcePoint.y} Q ${controlX} ${controlY} ${targetPoint.x} ${targetPoint.y}`;
    }

    createElbowPath(d) {
        const sourceX = d.source.x;
        const sourceY = d.source.y;
        const targetX = d.target.x;
        const targetY = d.target.y;

        // Calculate connection points on table edges
        const sourcePoint = this.getConnectionPoint(d.source, targetX, targetY);
        const targetPoint = this.getConnectionPoint(d.target, sourceX, sourceY);

        // Create elbow path with rounded corners
        const midX = (sourcePoint.x + targetPoint.x) / 2;
        const cornerRadius = 8;

        if (Math.abs(sourcePoint.y - targetPoint.y) < 20) {
            // Horizontal connection
            return `M ${sourcePoint.x} ${sourcePoint.y} L ${targetPoint.x} ${targetPoint.y}`;
        } else {
            // Elbow connection with rounded corners
            const path = `
                M ${sourcePoint.x} ${sourcePoint.y}
                L ${midX - cornerRadius} ${sourcePoint.y}
                Q ${midX} ${sourcePoint.y} ${midX} ${sourcePoint.y + (sourcePoint.y < targetPoint.y ? cornerRadius : -cornerRadius)}
                L ${midX} ${targetPoint.y + (targetPoint.y > sourcePoint.y ? -cornerRadius : cornerRadius)}
                Q ${midX} ${targetPoint.y} ${midX + cornerRadius} ${targetPoint.y}
                L ${targetPoint.x} ${targetPoint.y}
            `;
            return path.replace(/\s+/g, ' ').trim();
        }
    }

    getConnectionPoint(node, otherX, otherY) {
        const centerX = node.x;
        const centerY = node.y;
        const width = node.width || 200;
        const height = node.height || 100;

        // Determine which side of the rectangle to connect to
        const dx = otherX - centerX;
        const dy = otherY - centerY;

        if (Math.abs(dx) > Math.abs(dy)) {
            // Connect to left or right side
            const x = centerX + (dx > 0 ? width / 2 : -width / 2);
            const y = centerY;
            return { x, y };
        } else {
            // Connect to top or bottom side
            const x = centerX;
            const y = centerY + (dy > 0 ? height / 2 : -height / 2);
            return { x, y };
        }
    }

    dragStarted(event, d) {
        // Prevent zoom/pan when dragging nodes
        event.sourceEvent.stopPropagation();

        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
        d3.select(event.sourceEvent.target.parentNode).style('cursor', 'grabbing');
    }

    dragged(event, d) {
        // Prevent zoom/pan when dragging nodes
        event.sourceEvent.stopPropagation();

        d.fx = event.x;
        d.fy = event.y;
    }

    dragEnded(event, d) {
        // Prevent zoom/pan when dragging nodes
        event.sourceEvent.stopPropagation();

        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
        d3.select(event.sourceEvent.target.parentNode).style('cursor', 'grab');
    }

    destroy() {
        if (this.simulation) {
            this.simulation.stop();
        }

        // Remove only the D3 SVG, not the entire container content
        const svg = this.container.querySelector(`#${this.svgId}`);
        if (svg) {
            svg.remove();
        }

        // Remove D3 active class to restore normal overflow behavior
        this.container.classList.remove('d3-active');
    }
}

// Export for use in schema.js
window.D3SchemaRenderer = D3SchemaRenderer;
