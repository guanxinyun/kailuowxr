# Stardust Colony Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete, interactive frontend prototype for the Stardust Colony pixel-art colony simulation game with glassmorphism UI, Canvas map, 6 content-rich panels, and AI content placeholders.

**Architecture:** Vite + vanilla JS with ES modules. Single GameState object + EventBus pub/sub. Dual-layer Canvas for map rendering. Modular CSS with custom properties. All game data as JS module exports.

**Tech Stack:** Vite, vanilla JS (ES modules), HTML5 Canvas 2D, CSS custom properties, Noto Sans SC + JetBrains Mono (CDN), Lucide Icons (CDN)

## Global Constraints

- No frontend framework (React/Vue/etc) -- vanilla JS only
- No emoji anywhere -- use Lucide Icons SVG inline
- All UI text in Chinese
- CSS animations use transform/opacity only (no layout triggers)
- Semantic HTML5 tags throughout
- Descriptive unique IDs on all interactive elements
- In-game custom notifications only (no browser alert/confirm)
- AI content placeholders use "signal receiving" animation, never empty/spinner

---

### Task 1: Project Scaffold + CSS Design System

### Task 2: Data Files (Buildings, Tech, Species, Residents, Items)

### Task 3: Core Systems (EventBus, GameState, TimeSystem)

### Task 4: Main Layout HTML + Shell UI (TopBar, ToolPanel, BottomBar)

### Task 5: Canvas Map + Camera + Terrain Rendering

### Task 6: Build Panel Modal (24 buildings, tabbed, full content)

### Task 7: Tech Tree Panel (13 nodes, SVG graph, 3 states)

### Task 8: Diplomacy Panel (4 species, radar charts, reputation)

### Task 9: Resident Panel (3 residents, stats, diary placeholder)

### Task 10: Annual Review Panel (radar chart, scores, rank animation)

### Task 11: Gravity Heatmap + Toggle System

### Task 12: Notification System + Confirm Dialog + Event Modal

### Task 13: Building Placement Mode + Interactions

### Task 14: Explore, Stats, Settings Panels + Polish
