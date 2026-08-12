# Production, Balance, AI, Tutorial, and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make resource flows understandable and configurable, enrich deterministic AI-assisted narration and onboarding, formalize tests, shrink context packs, and ship the verified result.

**Architecture:** Pure modules calculate balance values, daily resource flows, AI facts/triggers, and tutorial state; runtime and DOM panels consume those modules. Core values remain local and deterministic, while AI only decorates validated facts and always has a fallback.

**Tech Stack:** Vanilla JavaScript ES modules, Node 20 built-in test runner, Vite 5, DOM/Canvas UI, GitHub Actions.

## Global Constraints

- No game over, debt, permanent death, combat, forced deadlines, or irreversible destruction.
- AI cannot decide rules, prices, outputs, routes, quality, unlocks, or rewards; offline fallback must remain complete.
- API keys cannot enter localStorage, saves, `VITE_*`, or build artifacts.
- New state is JSON-serializable and receives defaults when absent.
- Do not overwrite or stage unrelated pre-existing working-tree changes.
- Use ordinary push only; never force-push.

## File Map

- Create `src/data/balance.js`: editable numeric constants.
- Create `src/core/ResourceFlowSystem.js`: pure daily production/consumption/net calculations and formatting data.
- Create `src/core/AIContentFacts.js`: fact builders and fallback text for five narration types.
- Create `src/core/AITriggerSystem.js`: serializable milestone, cooldown, and shortage tracking.
- Create `test/*.test.js`: deterministic Node tests.
- Modify runtime, panels, AI client/prompts, tutorial, state, architecture index, docs, package scripts, and CI only where consumed.

---

### Task 1: Test Harness and Daily Resource Flows

**Files:**
- Create: `src/data/balance.js`
- Create: `src/core/ResourceFlowSystem.js`
- Create: `test/resource-flow.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `BALANCE`; `calculateBuildingDailyOutput(data, building, context)`; `calculateDailyResourceFlow(state, context)` returning `{ production, consumption, net }`; `formatDailyRate(value)`.

- [ ] **Step 1: Add failing tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBuildingDailyOutput, calculateDailyResourceFlow } from '../src/core/ResourceFlowSystem.js';

test('mine produces its base daily output continuously', () => {
  const result = calculateBuildingDailyOutput(
    { id: 'mine', effect: { metal: 4 } },
    { buildingId: 'mine', built: true, level: 1 },
    { operational: true, engineeringSkill: 1 },
  );
  assert.equal(result.metal, 0.6);
});

test('flow reports population food consumption and net change', () => {
  const flow = calculateDailyResourceFlow({ population: 3, buildings: [] });
  assert.equal(flow.consumption.food, 0.9);
  assert.equal(flow.net.food, -0.9);
});
```

- [ ] **Step 2: Run `node --test test/resource-flow.test.js`; expect module-not-found failure.**
- [ ] **Step 3: Implement frozen `BALANCE` with `buildingOutputRate: 0.15`, `foodPerResidentPerDay: 0.3`, construction, production, growth, tourism, event, and AI trigger groups; implement pure output and flow functions with zero output for non-operational buildings.**
- [ ] **Step 4: Add `test`, `test:watch`, and `verify` scripts using `node --test`, architecture check, and build; run the focused test until it passes.**
- [ ] **Step 5: Commit only Task 1 paths with `feat: centralize daily resource balance`.**

### Task 2: Use One Flow for Runtime and UI

**Files:**
- Modify: `src/main.js`
- Modify: `src/panels/BuildPanel.js`
- Modify: `src/panels/BuildingManagementPanel.js`
- Modify: `src/panels/UtilityPanels.js`
- Modify: `src/core/BuildingSystem.js`
- Create: `test/resource-flow-integration.test.js`

**Interfaces:**
- Consumes: Task 1 flow functions.
- Produces: `getCurrentDailyResourceFlow()` for runtime/UI; building cards distinguish `/天`, capacities, continuous attributes, and unlocks.

- [ ] **Step 1: Test that a connected mine adds the same metal amount returned by the flow calculator and that recipe inputs are absent from daily consumption.**
- [ ] **Step 2: Run focused test; expect failure because runtime still contains inline `prodRate` and food consumption.**
- [ ] **Step 3: Replace inline building resource additions and population food subtraction with one calculated flow application per game day; preserve storage clamping through `addResource`.**
- [ ] **Step 4: Render `产出 +x/天 · 消耗 -y/天 · 净增/净减 z/天` in resource statistics; render base daily output in build preview and current daily output/offline reason in facility management.**
- [ ] **Step 5: Run resource tests and `npm run build`; commit Task 2 paths with `feat: show daily production consumption and net flow`.**

### Task 3: Five AI Narration Types and Natural Triggers

**Files:**
- Create: `src/core/AIContentFacts.js`
- Create: `src/core/AITriggerSystem.js`
- Create: `test/ai-content.test.js`
- Create: `test/ai-triggers.test.js`
- Modify: `src/ai/AIClient.js`
- Modify: `src/ai/AIPrompts.js`
- Modify: `src/ai/AISchemas.js`
- Modify: `src/ai/AIFallbacks.js`
- Modify: `src/ai/AIRequestQueue.js`
- Modify: `src/core/DynamicContentSystem.js`
- Modify: `src/core/ProductionSystem.js`
- Modify: `src/core/TouristManager.js`
- Modify: `src/core/ExplorationSystem.js`
- Modify: `src/core/AnnualReviewSystem.js`
- Modify: `src/core/GameState.js`
- Modify: `src/main.js`

**Interfaces:**
- Produces: `buildProductFacts`, `buildTouristFacts`, `buildExplorationFacts`, `buildDiaryFacts`, `buildAnnualFacts`; `normalizeAITriggerState`, `recordMilestone`, `updateShortages`, `shouldTrigger`.

- [ ] **Step 1: Test that each fact builder contains only supplied deterministic facts, fallback always returns text, milestones fire once, shortages require configured consecutive days, recovery resets the counter, and pending/cooldown limits apply.**
- [ ] **Step 2: Run focused tests; expect missing exports.**
- [ ] **Step 3: Add request types for product copy, tourist personality/review, exploration log, factual diary, and annual summary; schemas validate text length/shape and forbidden themes. Product IDs, routes, scores, rewards, and annual results remain outside writable AI output.**
- [ ] **Step 4: Connect narration asynchronously to production completion, tourist arrival/departure, exploration start/completion, diary timing, and annual display; use immediate local fallback and never await narration inside the daily tick.**
- [ ] **Step 5: Emit/consume technology completion, `map:revealed`, first combo, `diplomacy:tier`, and sustained-shortage triggers; add serializable defaults under `aiContent.triggers`; do not backfill historical events when AI is re-enabled.**
- [ ] **Step 6: Run AI tests and build; commit Task 3 paths with `feat: add factual AI narration and milestone triggers`.**

### Task 4: Expanded Onboarding

**Files:**
- Modify: `src/core/TutorialManager.js`
- Modify: `src/panels/UtilityPanels.js`
- Modify: `src/main.js`
- Modify: `src/styles/tutorial.css`
- Create: `test/tutorial.test.js`

**Interfaces:**
- Produces: exported `BASIC_TUTORIAL_STEPS`, `CONTEXTUAL_TUTORIALS`, `TutorialProgress`; local keys `stardust_tutorial_done` and `stardust_tutorial_hints`.

- [ ] **Step 1: Test ordered basic step IDs, unique contextual IDs, separate basic reset versus all-hints reset, and saved speed restoration for finish/skip.**
- [ ] **Step 2: Run focused test; expect missing exports.**
- [ ] **Step 3: Expand the short basic path to teach pause, daily production/consumption/net, building base rate, placement, roads, speed, current facility rate, and residents. Always provide manual continuation when a target is absent or an event was already satisfied.**
- [ ] **Step 4: Add one-time contextual hints for workshop, upgrade, combo, research, peaceful exploration, tourists, diplomacy, AI proposal, annual review, and sustained shortage. Hints use fixed local copy and never wait for online AI.**
- [ ] **Step 5: Add settings actions `重新开始基础教程` and `重置全部教学提示`; run tests and build; commit Task 4 paths with `feat: expand progressive onboarding`.**

### Task 5: Small Context Packs

**Files:**
- Modify: `scripts/build-context.mjs`
- Modify: `docs/architecture/systems.json`
- Create: `test/context-builder.test.js`
- Modify: `CLAUDE.md`

**Interfaces:**
- Produces CLI modes: compact default; `--full`; `--max-chars=<n>`; `--output=<path>`.

- [ ] **Step 1: Spawn the context script in tests and assert compact output is below 30000 characters, contains system ID/files/exports/callers, and does not embed full `CLAUDE.md` or `SYSTEMS.md`; assert `--full` includes source sections.**
- [ ] **Step 2: Run focused test; expect compact-size assertion failure.**
- [ ] **Step 3: Change the default to a locator pack containing contract summary, files, callers, exports, events, design refs, and bounded source signatures/snippets; only `--full` appends whole files. Set default budget to 30000 and document both commands.**
- [ ] **Step 4: Run context tests and `npm run architecture:check`; commit Task 5 paths with `perf: shrink generated system context`.**

### Task 6: Documentation, CI, Architecture, and Release Verification

**Files:**
- Create: `README.md`
- Create: `docs/BALANCING.md`
- Modify: `docs/architecture/SYSTEMS.md`
- Modify: `docs/architecture/systems.json`
- Modify: `.github/workflows/deploy.yml`
- Modify: `package.json`
- Modify as verified necessary: `vercel.json`, stale combat comments/fields in touched files only

**Interfaces:**
- Consumes all earlier tasks.
- Produces `npm run verify` as the release gate.

- [ ] **Step 1: Add/extend tests asserting architecture entries include new public files/exports and package scripts invoke tests before build.**
- [ ] **Step 2: Run `npm run verify`; record and fix only failures caused by this work.**
- [ ] **Step 3: Document setup, play, saves, textures, player AI security, compact context usage, and exact balance fields/units/recommended ranges. Update CI to run `npm run verify` before Pages upload.**
- [ ] **Step 4: Run `npm run verify` again, then launch the app and browser-check daily flow, tutorial, building operation, offline AI fallback, triggers, saves, and settings; inspect console errors.**
- [ ] **Step 5: Review `git diff` and `git status`; stage only intended paths, preserving unrelated pre-existing changes. Commit with `feat: complete balance AI onboarding and release checks`.**
- [ ] **Step 6: Fetch and ensure the branch is not behind incompatibly; push `feat/production-balance-ai-release` normally to `origin`; report the branch/commit and any deployment URL or remote failure without force-pushing.**
