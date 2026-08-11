# Stardust Colony Frontend Design Spec

## Overview

Browser-based pixel-art colony simulation game frontend. Players build colonies on alien planets, manage production chains, attract alien tourists through a 6-dimension gravity system. Core loop: Build -> Produce -> Consume -> Expand. No fail state, no death penalty.

## Architecture

- **Tooling**: Vite dev server + bundler, ES modules throughout
- **Framework**: None -- vanilla JS with single GameState object + EventBus pub/sub
- **Rendering**: Dual-layer HTML5 Canvas 2D (static terrain layer + dynamic entity layer)
- **Styling**: Modular CSS files with CSS custom properties, no preprocessor
- **Fonts**: Noto Sans SC (CDN) for Chinese text, JetBrains Mono (CDN) for numeric data
- **Icons**: Lucide Icons (CDN), inline SVG usage for consistent line-art sci-fi aesthetic
- **Persistence**: localStorage for saves, IndexedDB for AI response cache (future)

## File Structure

```
stardust-colony/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.js                    # Entry: init all modules, start game loop
│   ├── core/
│   │   ├── GameState.js           # Singleton global state
│   │   ├── GameLoop.js            # Main loop (tick + render dispatch)
│   │   ├── EventBus.js            # Publish/subscribe event system
│   │   └── TimeSystem.js          # Game time management
│   ├── map/
│   │   ├── MapGenerator.js        # Simplex noise + constraint rules
│   │   ├── TileTypes.js           # Tile type constants
│   │   └── TileUtils.js           # Tile utility functions
│   ├── buildings/
│   │   ├── BuildingTemplates.js   # All preset building data
│   │   ├── BuildingManager.js     # Place/demolish/upgrade/connection check
│   │   └── ProductionSystem.js    # Production cycle + quality calc
│   ├── gravity/
│   │   ├── GravityVector.js       # 6-dimension vector class
│   │   ├── GravityCalculator.js   # Gravity field calculation
│   │   └── GravityHeatmap.js      # Heatmap render logic
│   ├── residents/
│   │   ├── ResidentManager.js     # Resident CRUD + growth + assignment
│   │   ├── ResidentAI.js          # State machine + behavior decisions
│   │   └── PersonalitySystem.js   # Personality tag effect calc
│   ├── tourists/
│   │   ├── SpeciesTemplates.js    # Preset alien species data
│   │   ├── TouristManager.js      # Arrival/path/consume/depart
│   │   └── ReputationSystem.js    # Reputation + threshold rewards
│   ├── exploration/
│   │   ├── RegionData.js          # Exploration region definitions
│   │   ├── ExplorationManager.js  # Squad/dispatch/event handling
│   │   └── CombatSystem.js        # Simplified auto-combat
│   ├── research/
│   │   ├── TechTree.js            # Tech tree data
│   │   └── ResearchManager.js     # Research progress/unlock
│   ├── economy/
│   │   ├── ResourceManager.js     # Resource add/subtract/cap
│   │   ├── ItemDatabase.js        # Item definitions
│   │   └── TradeSystem.js         # Tourist consumption calc
│   ├── events/
│   │   ├── EventTriggers.js       # Trigger condition checks
│   │   ├── EventTemplates.js      # Preset event data
│   │   └── EventManager.js        # Event lifecycle
│   ├── combos/
│   │   ├── ComboPresets.js        # Preset combo table (fallback)
│   │   └── ComboManager.js        # Combo check + apply + notify
│   ├── ai/
│   │   ├── AIRequestQueue.js      # Request queue (priority/concurrency/cache/fallback)
│   │   ├── AIPrompts.js           # System prompts per request type
│   │   ├── AISchemas.js           # Output validation functions
│   │   └── AIFallbacks.js         # Fallback data (preset text library)
│   ├── ui/
│   │   ├── UIManager.js           # UI dispatch (panel switching, modal management)
│   │   ├── TopBar.js              # Top status bar render + update
│   │   ├── ToolPanel.js           # Left toolbar (buttons + gravity toggles)
│   │   ├── SidePanel.js           # Right dynamic panel (context switching)
│   │   ├── BottomBar.js           # Bottom notification scroll
│   │   ├── BuildMenu.js           # Build modal logic
│   │   ├── ResidentPanel.js       # Resident panel logic
│   │   ├── TechTreePanel.js       # Tech tree panel + SVG node rendering
│   │   ├── ExplorePanel.js        # Explore panel logic
│   │   ├── DiplomacyPanel.js      # Diplomacy panel logic
│   │   ├── AnnualReviewPanel.js   # Annual review + radar chart
│   │   ├── StatsPanel.js          # Statistics panel + charts
│   │   ├── SettingsPanel.js       # Settings panel
│   │   ├── EventModal.js          # Event popup
│   │   ├── Notifications.js       # Notification system (create/enter/timer/exit)
│   │   ├── ConfirmDialog.js       # Confirmation dialog
│   │   └── Tooltip.js             # Generic hover tooltip
│   ├── render/
│   │   ├── Renderer.js            # Canvas render main (dual-layer management)
│   │   ├── TerrainRenderer.js     # Terrain layer rendering
│   │   ├── BuildingRenderer.js    # Building layer rendering
│   │   ├── EntityRenderer.js      # Resident/tourist rendering
│   │   ├── EffectRenderer.js      # Effects (floating text/smoke/glow)
│   │   ├── HeatmapRenderer.js     # Gravity heatmap Canvas overlay
│   │   └── Camera.js              # Viewport control (drag pan/scroll zoom/bounds)
│   ├── save/
│   │   ├── SaveManager.js         # Save/load/autosave
│   │   └── SaveSchema.js          # Serialize/deserialize
│   └── utils/
│       ├── math.js                # Math utilities (manhattan, gaussian, range)
│       ├── pathfinding.js         # A* pathfinding
│       ├── uid.js                 # Unique ID generation
│       ├── simplex-noise.js       # Simplex noise generator
│       └── dom.js                 # DOM operation helpers
├── data/
│   ├── buildings.js               # Preset building data (JS module export)
│   ├── items.js                   # Preset item data
│   ├── techs.js                   # Tech tree data
│   ├── species.js                 # Alien species data
│   ├── events.js                  # Preset event data
│   ├── combos.js                  # Preset combo data
│   └── residents.js               # Initial resident data
└── public/
    └── favicon.ico
```

## Visual Design System

### Color Palette (CSS Variables)

```
--color-food:      #FF8C42  (orange)
--color-knowledge: #4A90D9  (blue)
--color-comfort:   #A8D8B9  (green)
--color-adventure: #E74C3C  (red)
--color-culture:   #9B59B6  (purple)
--color-nature:    #2ECC71  (emerald)

--bg-deep:         #0A0C1C  (deep space background)
--bg-panel:        rgba(15, 18, 35, 0.85)  (glassmorphism panel)
--bg-card:         rgba(25, 30, 55, 0.9)   (card background)
--border-glow:     rgba(100, 140, 255, 0.3) (default border)
--text-primary:    #E8E6F0
--text-secondary:  #8B8AA0
--text-accent:     #A8C4FF
```

### Glassmorphism Treatment

All panels and modals use:
- `backdrop-filter: blur(12px)`
- Semi-transparent dark background
- 1px gradient border stroke (gravity color to transparent)
- Subtle top-edge gradient highlight for metallic feel
- Custom thin scrollbars matching panel background

### Typography

- Chinese body: `'Noto Sans SC', sans-serif` -- weight 400 body, 700 titles, 300 auxiliary
- Numeric data: `'JetBrains Mono', monospace` -- ensures no digit jumping
- Line height: 1.6-1.8 for Chinese readability
- Letter spacing: slightly widened for Chinese text

### Animation System

All animations use `transform` and `opacity` only (no layout triggers):

- **Card hover**: translateY(-4px) + box-shadow expand, reveal gravity detail
- **Button click**: ripple effect (radial gradient expand from click point)
- **Panel switch**: slide-in/fade-in transitions (no display toggle)
- **Notification**: slide-in from right, 3s hold, slide-out + shrink
- **Number change**: digit scroll animation (old value smooth to new)
- **Progress bar**: gradient fill + shimmer sweep
- **Tech unlock**: light wave ripple from node
- **Heatmap toggle**: color cross-fade transition
- **Modal open**: backdrop blur + content scale-up from center
- **Modal close**: reverse animation
- **Tab switch**: cross-fade content area
- **Accordion expand**: smooth height slide-in

## Content Requirements

### 1. Build Panel (24 buildings)

Organized in tabbed categories:

**Core & Housing**: HQ, Tent, Cottage
**Primary Production**: Wheat Farm, Ranch, Mine, Lumber Camp, Flower Farm
**Processing**: Bakery, Smelter, Cheese Workshop, Perfume Workshop, Equipment Workshop
**Commercial & Tourism**: Spaceport, Hotel, Restaurant, Souvenir Shop
**Research & Military**: Research Lab, Library, Training Ground
**Infrastructure & Decoration**: Warehouse, Road, Park, Fountain

Each card shows: name, icon area, build cost (gold/wood/stone/special), 6-dimension mini-bars, one-line description, unlock condition (greyed + lock icon if locked).

### 2. Tech Tree (13 technologies)

SVG node-graph visualization:

**Tier 1**: Basic Cooking, Basic Mining, Writing, Construction Improvement
**Tier 2**: Animal Husbandry, Metallurgy, Space Communication, Botany, Fermentation
**Tier 3**: Smithing, Chemistry, Advanced Baking
**Tier 4**: Basic Automation

Three visual states: Researched (bright, filled), Available (outlined, pulsing), Locked (dim, dashed outline). Prerequisite lines connect nodes. Hover shows detail card with cost, prerequisites, unlocks, flavor text.

### 3. Diplomacy Panel (4 species)

Full info cards for each:

- **Squid Aliens** (species_squid): Food-focused, high social media influence, pink sprite
- **Crystal Aliens** (species_crystal): Knowledge/culture focused, high budget, translucent sprite
- **Mecha Clan** (species_mecha): Adventure-focused, small pilot inside mech, grey sprite
- **Flora Spirits** (species_flora): Nature-focused, plant-form beings, green sprite

Each card: species name, homeworld, appearance description, 6-dimension preference radar chart, reputation progress bar with 3 tier thresholds (30/60/100), tier reward previews, fun fact.

### 4. Resident Panel (3 initial residents)

- **Hank**: Baker archetype. Stats: work 72, explore 25, combat 30, charisma 45. Personality: meticulous, grumpy, secretly_kind. High food affinity.
- **Aira**: Explorer archetype. Stats: work 40, explore 68, combat 55, charisma 60. Personality: curious, cheerful, wanderer. High adventure/nature affinity.
- **Zero**: Researcher archetype (android). Stats: work 55, explore 35, combat 20, charisma 30. Personality: efficient, night_owl, shy. High knowledge affinity.

Each card: stat bars, personality tags, affinity radar chart, mood value, diary placeholder with "signal receiving" animation.

### 5. Annual Review

- 6-dimension SVG radar chart with smooth data transition animation
- Score bars for each dimension (0-100) with gradient fill
- Commentary display area (AI placeholder with "signal receiving" animation)
- Rank change: large number + arrow with visual impact animation
- Special awards display section

### 6. Gravity Heatmap

- 6 toggle buttons on left toolbar, each colored with corresponding gravity color
- Canvas overlay rendering with alpha-blended color intensity
- Mouse hover on tile shows 6-dimension gravity value tooltip bubble
- Smooth color cross-fade when switching dimensions
- Keyboard shortcuts 1-6 for quick toggle

## Interaction Design

### Canvas Map
- Drag to pan: cursor changes grab -> grabbing
- Scroll wheel to zoom (with bounds constraint)
- Click tile/building/entity: triggers right panel context switch with slide transition
- Building placement mode: semi-transparent preview follows mouse, green (valid) / red (invalid) overlay

### Panel System
- Left toolbar: persistent, current selection has glow/highlight indicator
- Right panel: context-sensitive, auto-switches based on canvas click target
- Modals: lazy-rendered (DOM created on first open), center scale-in with backdrop blur

### Notification System
- In-game custom UI (no browser alert/confirm)
- Stacked cards in top-right corner
- Left colored stripe indicates type (orange=product, purple=tourist, blue=research, red=event)
- Enter: slide from right; Exit: slide right + shrink after 3s
- Confirm dialogs: custom modal with themed buttons

### AI Content Placeholders
- "Signal receiving" style: 3 dots blinking sequentially + mini radar scan icon
- Graceful fallback to preset static text when AI unavailable
- Never show empty or "loading" spinner

## Performance Considerations

- Semantic HTML5 tags throughout
- Descriptive unique IDs on all interactive elements
- Canvas: viewport culling (don't render off-screen), static layer only redraws on map change
- DOM: lazy modal rendering, event delegation, virtual scroll for long lists
- CSS: animations on transform/opacity only, will-change sparingly
- requestAnimationFrame for render loop, max 6 ticks per frame to prevent lag

## Implementation Phases

1. **Project setup + CSS system**: Vite scaffold, CSS variables, base styles, layout grid
2. **Data files**: All building/tech/species/resident/item data as JS modules
3. **Core systems**: GameState, EventBus, TimeSystem, GameLoop stubs
4. **Canvas + Map**: Terrain rendering, camera controls, heatmap overlay
5. **Main layout UI**: TopBar, ToolPanel, SidePanel shell, BottomBar
6. **Content panels**: Build menu, Tech tree, Diplomacy, Residents, Annual review, Explore/Stats/Settings
7. **Interactions**: Building placement, notifications, confirm dialogs, event popups
8. **Polish**: All micro-animations, AI placeholders, responsive adjustments
