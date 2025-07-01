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
            // SVG will be made visible after zoom/pan initialization

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
            .style('overflow', 'visible') // Allow content to extend beyond boundaries
            .style('opacity', '0'); // Start invisible to prevent flicker

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

        // Create links array
        this.links = relationships.map((rel, index) => ({
            source: rel.from.table,
            target: rel.to.table,
            sourceColumn: rel.from.column,
            targetColumn: rel.to.column,
            type: 'foreign_key',
            index: index
        }));

        // Apply TSP-based initial positioning to minimize intersections
        this.optimizeInitialLayout();

        console.log(`D3 Schema: ${this.nodes.length} tables, ${this.links.length} relationships`);
    }

    createForceSimulation() {
        // Default values for spread layout (slider value 100, was max)
        this.layoutSettings = {
            linkDistance: 480,
            linkStrength: 0.3,
            chargeStrength: -2000,
            collisionRadius: 200
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
        // Convert slider value (0-150) to layout parameters
        // 0 = tight clustering, 100 = old max spread, 150 = ultra spread
        const factor = sliderValue / 50; // 0-3 range, 2 = old default

        this.layoutSettings = {
            linkDistance: 120 + (factor * 240), // 120-840 range (extended from 480)
            linkStrength: Math.max(0.1, 0.9 - (factor * 0.27)), // 0.9-0.1 range (weaker links for ultra spread)
            chargeStrength: -600 - (factor * 1800), // -600 to -6000 range (much stronger repulsion)
            collisionRadius: 80 + (factor * 80) // 80-320 range (larger collision zones)
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
        // Reset all nodes to optimized positions
        this.optimizeInitialLayout();

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

    /**
     * TSP-based optimization for initial table positioning
     * Minimizes connector intersections and table hindering
     * Generates different solutions each time it's called
     */
    optimizeInitialLayout() {
        console.log('Generating new optimized layout using TSP-based algorithm...');

        if (this.nodes.length === 0) {
            console.log('No nodes to optimize');
            return;
        }

        // Calculate table dimensions first
        this.calculateTableDimensions();
        console.log(`Calculated dimensions for ${this.nodes.length} tables`);

        // Build adjacency graph for connected tables
        const adjacencyGraph = this.buildAdjacencyGraph();
        console.log(`Built adjacency graph with ${adjacencyGraph.size} nodes and ${this.links.length} connections`);

        // Generate multiple layout solutions and pick the best one
        const bestLayout = this.generateBestLayout(adjacencyGraph);
        console.log(`Generated optimized layout with score: ${bestLayout.score}`);

        // Apply positions to nodes
        this.applyOptimizedPositions(bestLayout.positions);

        console.log('New optimized layout applied - tables positioned to minimize intersections');
    }

    /**
     * Pre-calculate table dimensions for layout optimization
     */
    calculateTableDimensions() {
        this.nodes.forEach(node => {
            const allColumns = node.columns.length;
            const headerHeight = 30;
            const columnHeight = 16;
            const padding = 10;

            // Calculate width based on longest column name + type
            let maxWidth = node.name.length * 8 + 40;
            node.columns.forEach(col => {
                const columnText = `${col.name}: ${col.type}`;
                const columnWidth = columnText.length * 7 + 40;
                maxWidth = Math.max(maxWidth, columnWidth);
            });

            node.width = Math.max(200, maxWidth);
            node.height = headerHeight + (allColumns * columnHeight) + padding * 2;
        });
    }

    /**
     * Build adjacency graph with connection weights
     */
    buildAdjacencyGraph() {
        const graph = new Map();

        // Initialize graph with all nodes
        this.nodes.forEach(node => {
            graph.set(node.id, new Map());
        });

        // Add weighted connections
        this.links.forEach(link => {
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;

            if (graph.has(sourceId) && graph.has(targetId)) {
                // Weight connections by relationship strength
                const currentWeight = graph.get(sourceId).get(targetId) || 0;
                graph.get(sourceId).set(targetId, currentWeight + 1);
                graph.get(targetId).set(sourceId, currentWeight + 1);
            }
        });

        return graph;
    }

    /**
     * Generate multiple layout solutions and return the best one
     * This ensures each optimization produces a different result
     */
    generateBestLayout(adjacencyGraph) {
        const solutions = [];
        const maxAttempts = Math.min(8, Math.max(3, this.nodes.length)); // 3-8 attempts based on complexity

        console.log(`Generating ${maxAttempts} layout solutions...`);

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // Use different random seeds and strategies for each attempt
            const strategy = this.getLayoutStrategy(attempt, maxAttempts);
            const positions = this.calculateOptimalPositions(adjacencyGraph, strategy);
            const score = this.evaluateLayoutQuality(positions, adjacencyGraph);

            solutions.push({
                positions: new Map(positions), // Clone the positions
                score: score,
                strategy: strategy
            });

            console.log(`Solution ${attempt + 1}: score ${score.toFixed(2)} (${strategy.name})`);
        }

        // Sort by score (lower is better) and return the best
        solutions.sort((a, b) => a.score - b.score);
        const bestSolution = solutions[0];

        console.log(`Selected best solution: ${bestSolution.strategy.name} with score ${bestSolution.score.toFixed(2)}`);
        return bestSolution;
    }

    /**
     * Get different layout strategies for variety
     */
    getLayoutStrategy(attempt, maxAttempts) {
        const strategies = [
            { name: 'Hub-Centric', hubWeight: 1.0, randomness: 0.1, circularBias: 0.8 },
            { name: 'Distributed', hubWeight: 0.5, randomness: 0.3, circularBias: 0.6 },
            { name: 'Clustered', hubWeight: 0.7, randomness: 0.2, circularBias: 0.9 },
            { name: 'Organic', hubWeight: 0.3, randomness: 0.5, circularBias: 0.4 },
            { name: 'Balanced', hubWeight: 0.6, randomness: 0.25, circularBias: 0.7 },
            { name: 'Spread', hubWeight: 0.4, randomness: 0.4, circularBias: 0.5 },
            { name: 'Compact', hubWeight: 0.8, randomness: 0.15, circularBias: 0.95 },
            { name: 'Random-Optimized', hubWeight: Math.random(), randomness: Math.random() * 0.6, circularBias: Math.random() }
        ];

        return strategies[attempt % strategies.length];
    }

    /**
     * Apply sorting strategy with randomization for variety
     */
    applySortingStrategy(nodeIds, connectionCounts, strategy) {
        // Base sort by connection count
        let sortedNodes = nodeIds.sort((a, b) =>
            connectionCounts.get(b) - connectionCounts.get(a)
        );

        // Apply strategy-based modifications
        if (strategy.randomness > 0) {
            // Introduce controlled randomness while preserving general order
            const shuffleAmount = Math.floor(sortedNodes.length * strategy.randomness);
            for (let i = 0; i < shuffleAmount; i++) {
                const idx1 = Math.floor(Math.random() * sortedNodes.length);
                const idx2 = Math.floor(Math.random() * sortedNodes.length);
                [sortedNodes[idx1], sortedNodes[idx2]] = [sortedNodes[idx2], sortedNodes[idx1]];
            }
        }

        // Apply hub weight strategy
        if (strategy.hubWeight !== 1.0) {
            sortedNodes = sortedNodes.sort((a, b) => {
                const scoreA = connectionCounts.get(a) * strategy.hubWeight + Math.random() * (1 - strategy.hubWeight);
                const scoreB = connectionCounts.get(b) * strategy.hubWeight + Math.random() * (1 - strategy.hubWeight);
                return scoreB - scoreA;
            });
        }

        return sortedNodes;
    }

    /**
     * Evaluate the quality of a layout (lower score is better)
     */
    evaluateLayoutQuality(positions, adjacencyGraph) {
        let score = 0;
        const allConnections = [];

        // Collect all connections with their positions
        for (const [nodeId, connections] of adjacencyGraph) {
            for (const [connectedId, weight] of connections) {
                if (positions.has(nodeId) && positions.has(connectedId)) {
                    allConnections.push({
                        from: positions.get(nodeId),
                        to: positions.get(connectedId),
                        weight: weight,
                        fromId: nodeId,
                        toId: connectedId
                    });
                }
            }
        }

        // Score based on connector intersections (major penalty)
        for (let i = 0; i < allConnections.length; i++) {
            for (let j = i + 1; j < allConnections.length; j++) {
                if (this.doLinesIntersect(
                    allConnections[i].from, allConnections[i].to,
                    allConnections[j].from, allConnections[j].to
                )) {
                    score += 100; // Heavy penalty for intersections
                }
            }
        }

        // Score based on connection length (prefer shorter connections)
        allConnections.forEach(conn => {
            const distance = Math.sqrt(
                Math.pow(conn.to.x - conn.from.x, 2) +
                Math.pow(conn.to.y - conn.from.y, 2)
            );
            score += distance * 0.01 * conn.weight;
        });

        // Score based on table spacing (prevent overcrowding)
        const positionArray = Array.from(positions.values());
        for (let i = 0; i < positionArray.length; i++) {
            for (let j = i + 1; j < positionArray.length; j++) {
                const distance = Math.sqrt(
                    Math.pow(positionArray[j].x - positionArray[i].x, 2) +
                    Math.pow(positionArray[j].y - positionArray[i].y, 2)
                );
                if (distance < 150) { // Too close
                    score += (150 - distance) * 0.5;
                }
            }
        }

        return score;
    }

    /**
     * Calculate optimal positions using modified TSP approach
     * Focuses on minimizing connector intersections and table overlap
     */
    calculateOptimalPositions(adjacencyGraph, strategy = null) {
        const positions = new Map();
        const nodeIds = Array.from(adjacencyGraph.keys());

        if (nodeIds.length === 0) return positions;

        // Use default strategy if none provided
        if (!strategy) {
            strategy = { name: 'Default', hubWeight: 0.7, randomness: 0.2, circularBias: 0.8 };
        }

        // Find hub tables (highly connected) to place centrally
        const connectionCounts = new Map();
        nodeIds.forEach(nodeId => {
            const connections = adjacencyGraph.get(nodeId);
            connectionCounts.set(nodeId, connections.size);
        });

        // Sort nodes by connection count with strategy-based randomization
        const sortedNodes = this.applySortingStrategy(nodeIds, connectionCounts, strategy);

        // Use circular placement with intelligent spacing
        const centerX = this.width / 2;
        const centerY = this.height / 2;

        if (sortedNodes.length === 1) {
            // Single table - place at center
            positions.set(sortedNodes[0], { x: centerX, y: centerY });
            return positions;
        }

        // Calculate optimal radius based on table sizes and count
        const avgTableSize = this.nodes.reduce((sum, node) =>
            sum + Math.max(node.width || 200, node.height || 100), 0) / this.nodes.length;
        const baseRadius = Math.max(200, avgTableSize * 1.2);
        const radiusIncrement = Math.max(120, avgTableSize * 0.8);

        // Adjust for viewport size to prevent tables from going off-screen
        const maxRadius = Math.min(this.width, this.height) * 0.4;
        const adjustedBaseRadius = Math.min(baseRadius, maxRadius);
        const adjustedRadiusIncrement = Math.min(radiusIncrement, maxRadius * 0.3);

        // Place hub table(s) at center with strategy-based variation
        const hubCount = Math.min(3, Math.ceil(sortedNodes.length * 0.1 * strategy.hubWeight));
        const hubNodes = sortedNodes.slice(0, Math.max(1, hubCount));

        if (hubNodes.length === 1) {
            // Single hub with slight randomization
            const offsetX = (Math.random() - 0.5) * 100 * strategy.randomness;
            const offsetY = (Math.random() - 0.5) * 100 * strategy.randomness;
            positions.set(hubNodes[0], {
                x: centerX + offsetX,
                y: centerY + offsetY
            });
        } else {
            // Multiple hubs - small circle around center with strategy variation
            hubNodes.forEach((nodeId, index) => {
                const baseAngle = (index * 2 * Math.PI) / hubNodes.length;
                const angleVariation = (Math.random() - 0.5) * Math.PI * 0.3 * strategy.randomness;
                const angle = baseAngle + angleVariation;
                const hubRadius = adjustedBaseRadius * (0.2 + 0.2 * strategy.circularBias);
                positions.set(nodeId, {
                    x: centerX + Math.cos(angle) * hubRadius,
                    y: centerY + Math.sin(angle) * hubRadius
                });
            });
        }

        // Place remaining nodes in concentric circles
        const remainingNodes = sortedNodes.slice(hubNodes.length);
        this.placeNodesInConcentricCircles(remainingNodes, positions, adjacencyGraph,
            centerX, centerY, adjustedBaseRadius, adjustedRadiusIncrement, strategy);

        return positions;
    }

    /**
     * Place nodes in concentric circles with intersection minimization
     */
    placeNodesInConcentricCircles(nodes, positions, adjacencyGraph, centerX, centerY, baseRadius, radiusIncrement, strategy) {
        const maxNodesPerCircle = Math.floor(6 + 4 * strategy.circularBias); // 6-10 nodes per circle based on strategy
        let currentRadius = baseRadius;
        let nodeIndex = 0;

        while (nodeIndex < nodes.length) {
            const nodesInThisCircle = Math.min(maxNodesPerCircle, nodes.length - nodeIndex);
            const circleNodes = nodes.slice(nodeIndex, nodeIndex + nodesInThisCircle);

            // Calculate optimal angles for this circle to minimize intersections
            const optimalAngles = this.calculateOptimalAngles(circleNodes, positions, adjacencyGraph, strategy);

            circleNodes.forEach((nodeId, index) => {
                const angle = optimalAngles[index];
                // Add strategy-based radius variation
                const radiusVariation = (Math.random() - 0.5) * radiusIncrement * 0.3 * strategy.randomness;
                const finalRadius = currentRadius + radiusVariation;

                positions.set(nodeId, {
                    x: centerX + Math.cos(angle) * finalRadius,
                    y: centerY + Math.sin(angle) * finalRadius
                });
            });

            nodeIndex += nodesInThisCircle;
            currentRadius += radiusIncrement * (0.8 + 0.4 * strategy.circularBias); // Strategy affects spacing
        }
    }

    /**
     * Calculate optimal angles for nodes in a circle to minimize connector intersections
     */
    calculateOptimalAngles(circleNodes, existingPositions, adjacencyGraph, strategy) {
        const nodeCount = circleNodes.length;
        const baseAngles = circleNodes.map((_, index) => (index * 2 * Math.PI) / nodeCount);

        if (nodeCount <= 2) {
            // Add small random variation even for simple cases
            return baseAngles.map(angle =>
                angle + (Math.random() - 0.5) * Math.PI * 0.1 * strategy.randomness
            );
        }

        // Try different rotational offsets to find best arrangement
        let bestAngles = [...baseAngles];
        let bestScore = this.calculateIntersectionScore(circleNodes, baseAngles, existingPositions, adjacencyGraph);

        const rotationSteps = Math.min(16, nodeCount * 2);
        const randomRotationOffset = Math.random() * 2 * Math.PI * strategy.randomness;

        for (let step = 1; step < rotationSteps; step++) {
            const rotationOffset = (step * 2 * Math.PI) / rotationSteps + randomRotationOffset;
            const rotatedAngles = baseAngles.map(angle => {
                const baseRotated = angle + rotationOffset;
                // Add individual angle variation based on strategy
                const angleVariation = (Math.random() - 0.5) * Math.PI * 0.2 * strategy.randomness;
                return baseRotated + angleVariation;
            });

            const score = this.calculateIntersectionScore(circleNodes, rotatedAngles, existingPositions, adjacencyGraph);
            if (score < bestScore) {
                bestScore = score;
                bestAngles = [...rotatedAngles];
            }
        }

        return bestAngles;
    }

    /**
     * Calculate intersection score for a given arrangement
     * Lower scores indicate fewer intersections and better layout
     */
    calculateIntersectionScore(circleNodes, angles, existingPositions, adjacencyGraph) {
        let score = 0;
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const currentRadius = 300; // Approximate radius for scoring

        // Create temporary positions for scoring
        const tempPositions = new Map(existingPositions);
        circleNodes.forEach((nodeId, index) => {
            tempPositions.set(nodeId, {
                x: centerX + Math.cos(angles[index]) * currentRadius,
                y: centerY + Math.sin(angles[index]) * currentRadius
            });
        });

        // Score based on connector intersections
        const allConnections = [];
        for (const [nodeId, connections] of adjacencyGraph) {
            for (const [connectedId, weight] of connections) {
                if (tempPositions.has(nodeId) && tempPositions.has(connectedId)) {
                    allConnections.push({
                        from: tempPositions.get(nodeId),
                        to: tempPositions.get(connectedId),
                        weight: weight
                    });
                }
            }
        }

        // Count intersections between connectors
        for (let i = 0; i < allConnections.length; i++) {
            for (let j = i + 1; j < allConnections.length; j++) {
                if (this.doLinesIntersect(
                    allConnections[i].from, allConnections[i].to,
                    allConnections[j].from, allConnections[j].to
                )) {
                    score += 10; // Penalty for intersection
                }
            }
        }

        // Score based on connector length (prefer shorter connections)
        allConnections.forEach(conn => {
            const distance = Math.sqrt(
                Math.pow(conn.to.x - conn.from.x, 2) +
                Math.pow(conn.to.y - conn.from.y, 2)
            );
            score += distance * 0.01 * conn.weight; // Weighted by connection strength
        });

        return score;
    }

    /**
     * Check if two line segments intersect
     */
    doLinesIntersect(p1, q1, p2, q2) {
        const orientation = (p, q, r) => {
            const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
            if (val === 0) return 0; // Collinear
            return val > 0 ? 1 : 2; // Clockwise or Counterclockwise
        };

        const onSegment = (p, q, r) => {
            return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
                   q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
        };

        const o1 = orientation(p1, q1, p2);
        const o2 = orientation(p1, q1, q2);
        const o3 = orientation(p2, q2, p1);
        const o4 = orientation(p2, q2, q1);

        // General case
        if (o1 !== o2 && o3 !== o4) return true;

        // Special cases
        if (o1 === 0 && onSegment(p1, p2, q1)) return true;
        if (o2 === 0 && onSegment(p1, q2, q1)) return true;
        if (o3 === 0 && onSegment(p2, p1, q2)) return true;
        if (o4 === 0 && onSegment(p2, q1, q2)) return true;

        return false;
    }

    /**
     * Apply optimized positions to nodes
     */
    applyOptimizedPositions(positions) {
        this.nodes.forEach(node => {
            const pos = positions.get(node.id);
            if (pos) {
                node.x = pos.x;
                node.y = pos.y;
            } else {
                // Fallback to random position if not in optimized set
                node.x = this.width / 2 + (Math.random() - 0.5) * 200;
                node.y = this.height / 2 + (Math.random() - 0.5) * 200;
            }
            // Clear any fixed positions
            node.fx = null;
            node.fy = null;
        });
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
        // Calculate dynamic table dimensions based on ALL columns
        this.nodeElements.each(function(d) {
            const allColumns = d.columns.length; // Show ALL columns
            const headerHeight = 30;
            const columnHeight = 16;
            const padding = 10;

            // Calculate width based on longest column name + type
            let maxWidth = d.name.length * 8 + 40; // Table name width
            d.columns.forEach(col => {
                const columnText = `${col.name}: ${col.type}`;
                const columnWidth = columnText.length * 7 + 40; // Estimate width
                maxWidth = Math.max(maxWidth, columnWidth);
            });

            d.width = Math.max(200, maxWidth);
            d.height = headerHeight + (allColumns * columnHeight) + padding * 2;
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

        // Add column information with icons and types - SHOW ALL COLUMNS
        const colors = this.colors; // Capture colors reference for use in callbacks
        this.nodeElements.each(function(d) {
            const nodeGroup = d3.select(this);
            let yOffset = 45;

            // Show ALL primary keys first
            d.primaryKeys.forEach((column) => {
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

            // Show ALL foreign keys
            d.foreignKeys.forEach((column) => {
                nodeGroup.append('text')
                    .attr('x', 8)
                    .attr('y', yOffset)
                    .attr('font-family', 'system-ui, -apple-system, sans-serif')
                    .attr('font-size', '11px')
                    .attr('fill', colors.secondary)
                    .text(`🔗 ${column.name}: ${column.type}`);

                yOffset += 16;
            });

            // Show ALL regular columns
            d.regularColumns.forEach((column) => {
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

            // No more "more columns" indicator - we show everything!
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

        // Update link labels position to follow the elbow path
        this.linkElements.selectAll('.link-label')
            .attr('x', d => this.getLabelPosition(d).x)
            .attr('y', d => this.getLabelPosition(d).y);

        // Update node positions
        this.nodeElements.attr('transform', d =>
            `translate(${d.x - d.width / 2}, ${d.y - d.height / 2})`
        );
    }

    getLabelPosition(d) {
        // Position label along the elbow path to avoid overlap
        const sourcePoint = this.getConnectionPoint(d.source, d.target.x, d.target.y, true);
        const targetPoint = this.getConnectionPoint(d.target, d.source.x, d.source.y, false);

        // Calculate how many relationships exist between the same two tables
        const sameTableLinks = this.links.filter(link =>
            (link.source.id === d.source.id && link.target.id === d.target.id) ||
            (link.source.id === d.target.id && link.target.id === d.source.id)
        );

        // Find the position of this link among same-table relationships
        const linkPosition = sameTableLinks.findIndex(link => link.index === d.index);

        // Use larger spacing and handle more than 3 relationships
        const labelOffset = linkPosition * 18; // Increased spacing from 15 to 18

        if (this.arrowType === 'straight') {
            // For straight arrows, use midpoint with staggered offset
            return {
                x: (sourcePoint.x + targetPoint.x) / 2 + labelOffset,
                y: (sourcePoint.y + targetPoint.y) / 2 - 5 - (linkPosition * 12)
            };
        } else if (this.arrowType === 'curved') {
            // For curved arrows, position at curve peak with offset
            const midX = (sourcePoint.x + targetPoint.x) / 2;
            const midY = (sourcePoint.y + targetPoint.y) / 2;
            return {
                x: midX + labelOffset,
                y: midY - 10 - (linkPosition * 12)
            };
        } else {
            // For elbow arrows, position at the elbow corner with staggered placement
            const targetCenterX = d.target.x;
            const targetCenterY = d.target.y;
            const targetDx = targetPoint.x - targetCenterX;
            const targetDy = targetPoint.y - targetCenterY;
            const isTargetOnVerticalEdge = Math.abs(targetDx) > Math.abs(targetDy);

            if (isTargetOnVerticalEdge) {
                // Target on left/right edge - label at HORIZONTAL part of elbow with VERTICAL staggering
                return {
                    x: (sourcePoint.x + targetPoint.x) / 2,
                    y: targetPoint.y - 5 - (linkPosition * 12)  // Vertical staggering based on link position for horizontal connections
                };
            } else {
                // Target on top/bottom edge - label at horizontal part of elbow with HORIZONTAL and VERTICAL staggering
                return {
                    x: (sourcePoint.x + targetPoint.x) / 2 + labelOffset,  // Horizontal staggering for vertical connections
                    y: sourcePoint.y - 5 - (linkPosition * 12)  // Vertical staggering based on link position to prevent overlap
                };
            }
        }
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
        // Calculate connection points
        const sourcePoint = this.getConnectionPoint(d.source, d.target.x, d.target.y, true);
        const targetPoint = this.getConnectionPoint(d.target, d.source.x, d.source.y, false);

        return `M ${sourcePoint.x} ${sourcePoint.y} L ${targetPoint.x} ${targetPoint.y}`;
    }

    createCurvedPath(d) {
        // Calculate connection points
        const sourcePoint = this.getConnectionPoint(d.source, d.target.x, d.target.y, true);
        const targetPoint = this.getConnectionPoint(d.target, d.source.x, d.source.y, false);

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
        // Calculate connection points
        const sourcePoint = this.getConnectionPoint(d.source, d.target.x, d.target.y, true);
        const targetPoint = this.getConnectionPoint(d.target, d.source.x, d.source.y, false);

        const cornerRadius = 12;
        const dx = targetPoint.x - sourcePoint.x;
        const dy = targetPoint.y - sourcePoint.y;

        if (Math.abs(dx) < cornerRadius * 2 && Math.abs(dy) < cornerRadius * 2) {
            // Too close for elbow, use straight line
            return `M ${sourcePoint.x} ${sourcePoint.y} L ${targetPoint.x} ${targetPoint.y}`;
        }

        // Determine which side the target is on to ensure perpendicular approach
        const targetCenterX = d.target.x;
        const targetCenterY = d.target.y;
        const targetDx = targetPoint.x - targetCenterX;
        const targetDy = targetPoint.y - targetCenterY;

        // Check if target is on left/right side (vertical edge) or top/bottom side (horizontal edge)
        const isTargetOnVerticalEdge = Math.abs(targetDx) > Math.abs(targetDy);

        if (isTargetOnVerticalEdge) {
            // Target is on left/right edge - final approach must be HORIZONTAL (perpendicular to vertical edge)
            const elbowX = sourcePoint.x;
            const elbowY = targetPoint.y;

            if (Math.abs(dx) > cornerRadius * 2 && Math.abs(dy) > cornerRadius * 2) {
                const cornerX = elbowX + (targetPoint.x > sourcePoint.x ? cornerRadius : -cornerRadius);
                const cornerY = elbowY + (targetPoint.y > sourcePoint.y ? -cornerRadius : cornerRadius);

                return `
                    M ${sourcePoint.x} ${sourcePoint.y}
                    L ${sourcePoint.x} ${cornerY}
                    Q ${elbowX} ${elbowY} ${cornerX} ${elbowY}
                    L ${targetPoint.x} ${targetPoint.y}
                `.replace(/\s+/g, ' ').trim();
            } else {
                return `M ${sourcePoint.x} ${sourcePoint.y} L ${elbowX} ${elbowY} L ${targetPoint.x} ${targetPoint.y}`;
            }
        } else {
            // Target is on top/bottom edge - final approach must be VERTICAL (perpendicular to horizontal edge)
            const elbowX = targetPoint.x;
            const elbowY = sourcePoint.y;

            if (Math.abs(dx) > cornerRadius * 2 && Math.abs(dy) > cornerRadius * 2) {
                const cornerX = elbowX + (targetPoint.x > sourcePoint.x ? -cornerRadius : cornerRadius);
                const cornerY = elbowY + (targetPoint.y > sourcePoint.y ? cornerRadius : -cornerRadius);

                return `
                    M ${sourcePoint.x} ${sourcePoint.y}
                    L ${cornerX} ${sourcePoint.y}
                    Q ${elbowX} ${elbowY} ${elbowX} ${cornerY}
                    L ${targetPoint.x} ${targetPoint.y}
                `.replace(/\s+/g, ' ').trim();
            } else {
                return `M ${sourcePoint.x} ${sourcePoint.y} L ${elbowX} ${elbowY} L ${targetPoint.x} ${targetPoint.y}`;
            }
        }
    }

    getConnectionPoint(node, otherX, otherY, isSource = true) {
        const centerX = node.x;
        const centerY = node.y;
        const width = node.width || 200;
        const height = node.height || 100;

        // Determine which side of the rectangle to connect to
        const dx = otherX - centerX;
        const dy = otherY - centerY;

        // Use a threshold to prefer horizontal/vertical connections
        const threshold = 1.2; // Bias towards horizontal connections

        if (Math.abs(dx) > Math.abs(dy) * threshold) {
            // Connect to left or right side
            const side = dx > 0 ? 1 : -1;
            const x = centerX + side * (width / 2);
            const y = centerY + Math.max(-height/3, Math.min(height/3, dy * 0.3));
            return { x, y };
        } else {
            // Connect to top or bottom side
            const side = dy > 0 ? 1 : -1;
            const x = centerX + Math.max(-width/3, Math.min(width/3, dx * 0.3));
            const y = centerY + side * (height / 2);
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
