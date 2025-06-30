# D3.js Force-Directed Schema Implementation Plan

## Current System Analysis

### Backend (`monitor.py`)
- **Schema endpoint**: `/schema` route handles both Mermaid and GraphViz requests
- **Data format**: Returns `{tables: {}, relationships: [], theme_colors: []}` for Mermaid
- **GraphViz mode**: Returns `{schema_url: '/static/schema.png'}` when `?type=graphviz&theme=dark/light`
- **Database support**: Both PostgreSQL and MySQL with foreign key detection
- **Table filtering**: Automatically excludes `SequelizeMeta` and other ignored tables

### Frontend (`static/js/schema.js`)
- **Toggle system**: Binary switch between GraphViz (default) and Mermaid
- **State management**: `useGraphviz` boolean, localStorage preferences
- **Rendering functions**: `renderGraphvizSchema()` and `renderMermaidSchema()`
- **Zoom/pan**: Universal `initializeZoomPan()` function for both modes
- **Theme support**: Automatic light/dark theme switching
- **Caching**: GraphViz results cached by theme to avoid re-generation

### UI Structure (`templates/index.html`)
- **Modal container**: `.schema-modal` with `.schema-content`
- **Display elements**: `.mermaid` div and `#graphvizContent` img
- **Controls**: `.schema-controls` with binary toggle switch
- **Current toggle**: GraphViz ↔ Mermaid switch with labels

## Implementation Plan

### Phase 1: Backend Extension (No Breaking Changes)
- [ ] **Extend `/schema` endpoint** to handle `?type=d3` parameter
- [ ] **Return enhanced data format** for D3 with node positioning hints:
  ```json
  {
    "tables": {...},
    "relationships": [...],
    "theme_colors": [...],
    "d3_metadata": {
      "node_weights": {"table_name": relationship_count},
      "cluster_hints": {"table_name": "category"},
      "primary_tables": ["users", "orders"]
    }
  }
  ```
- [ ] **Maintain backward compatibility** - existing Mermaid/GraphViz calls unchanged

### Phase 2: Frontend Infrastructure
- [ ] **Add D3.js library** to `templates/index.html`:
  ```html
  <script src="https://d3js.org/d3.v7.min.js"></script>
  ```
- [ ] **Create D3 container** in schema modal (alongside existing containers):
  ```html
  <div id="d3Content" style="display: none;"></div>
  ```
- [ ] **Extend state management** in `schema.js`:
  ```javascript
  let schemaType = 'graphviz'; // 'graphviz', 'mermaid', 'd3'
  ```

### Phase 3: UI Controls Update
- [ ] **Replace binary toggle** with three-option selector:
  ```html
  <div class="schema-type-selector">
    <button class="schema-option active" data-type="graphviz">GraphViz</button>
    <button class="schema-option" data-type="mermaid">Mermaid</button>
    <button class="schema-option" data-type="d3">Interactive</button>
  </div>
  ```
- [ ] **Update CSS** for new control layout in `static/css/schema.css`
- [ ] **Maintain localStorage** compatibility for preferences

### Phase 4: D3 Force-Directed Implementation
- [ ] **Create `renderD3Schema()` function** in `schema.js`:
  - Force simulation with link, charge, center, and collision forces
  - Table nodes as draggable rectangles with column lists
  - Relationship links with labels
  - Auto-clustering based on relationship density
- [ ] **Implement interactive features**:
  - Drag tables to reposition (simulation continues)
  - Double-click to pin/unpin tables
  - Hover effects to highlight connected tables
  - Zoom/pan integration with existing `initializeZoomPan()`
- [ ] **Theme integration**:
  - Use existing theme detection system
  - Apply consistent colors with current light/dark themes
  - Respect existing CSS custom properties

### Phase 5: Advanced D3 Features
- [ ] **Smart auto-layout algorithms**:
  - Detect hub tables (high relationship count) and center them
  - Group related tables using community detection
  - Hierarchical positioning for parent-child relationships
- [ ] **Progressive disclosure**:
  - Summary view (table names only) vs detailed view (with columns)
  - Collapsible table groups/schemas
  - Relationship filtering by type
- [ ] **Layout persistence**:
  - Save user-customized positions to localStorage
  - Reset to auto-layout option
  - Export custom layouts

### Phase 6: Integration & Polish
- [ ] **Update toggle handler** to support three modes:
  ```javascript
  function switchSchemaType(newType) {
    // Hide all containers
    // Show selected container
    // Render appropriate schema
    // Initialize zoom/pan
  }
  ```
- [ ] **Extend caching system** for D3 layouts
- [ ] **Error handling** for D3 rendering failures
- [ ] **Performance optimization** for large schemas (>50 tables)

### Phase 7: Testing & Refinement
- [ ] **Test with various database schemas**:
  - Small schemas (5-10 tables)
  - Medium schemas (20-30 tables)
  - Large schemas (50+ tables)
- [ ] **Cross-browser compatibility** testing
- [ ] **Theme switching** validation
- [ ] **Performance profiling** and optimization

## Technical Considerations

### Data Flow Compatibility
- **Existing flow**: Frontend fetches `/schema` → renders Mermaid/GraphViz
- **New flow**: Frontend fetches `/schema?type=d3` → renders D3 force-directed
- **No breaking changes**: Existing Mermaid/GraphViz flows remain identical

### State Management
- **Current**: `useGraphviz` boolean + localStorage
- **New**: `schemaType` string + localStorage with migration logic
- **Backward compatibility**: Existing preferences automatically migrated

### Zoom/Pan Integration
- **Existing**: `initializeZoomPan(container, targetElement)` works with images/SVGs
- **D3 integration**: Pass D3 SVG element to existing zoom/pan system
- **Consistent UX**: Same zoom/pan behavior across all three modes

### Performance Considerations
- **Large schemas**: Implement node virtualization for 100+ tables
- **Force simulation**: Limit iterations and provide manual override
- **Memory management**: Proper cleanup when switching between modes

### CSS Integration
- **Existing classes**: Reuse `.schema-container`, `.schema-modal` structure
- **New classes**: Add D3-specific styling without affecting existing modes
- **Theme variables**: Use existing CSS custom properties for consistency

## Risk Mitigation

### Backward Compatibility
- All existing API endpoints remain unchanged
- Existing localStorage preferences automatically migrated
- Fallback to GraphViz if D3 fails to load or render

### Progressive Enhancement
- D3 mode is additive - existing functionality unaffected
- Graceful degradation if D3.js fails to load
- Clear error messages for unsupported browsers

### Performance Safeguards
- Automatic fallback to static mode for very large schemas
- Force simulation timeout to prevent infinite calculations
- Memory cleanup when switching modes or closing modal

## Success Metrics

### Functionality
- [ ] All three schema modes work independently
- [ ] Smooth transitions between modes
- [ ] Consistent zoom/pan behavior
- [ ] Theme switching works in all modes
- [ ] User preferences persist correctly

### User Experience
- [ ] D3 mode provides better schema exploration than static modes
- [ ] Interactive features are intuitive and responsive
- [ ] Auto-layout produces readable diagrams
- [ ] Performance is acceptable for typical database schemas

### Code Quality
- [ ] No breaking changes to existing functionality
- [ ] Clean separation between rendering modes
- [ ] Maintainable and extensible architecture
- [ ] Comprehensive error handling and fallbacks
