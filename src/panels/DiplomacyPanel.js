/**
 * 星尘殖民地 — 外交面板
 */
import { gameState } from '../core/GameState.js';
import { ui } from '../core/UIManager.js';
import { aiAdvisor } from '../core/AIAdvisor.js';
import { AI_REQUEST_TYPES } from '../ai/AIPrompts.js';
import { createElement, lucideIcon } from '../core/utils.js';
import { SPECIES } from '../data/species.js';
import { GRAVITY_CONFIG } from '../data/gamedata.js';

export function openDiplomacyPanel() {
  const container = createElement('div', { className: 'diplomacy-panel-inner' });
  const list = createElement('div', { className: 'species-list' });

  for (const species of SPECIES) {
    const dipState = gameState.state.diplomacy[species.id] || { reputation: 0, contacted: false };
    list.appendChild(createSpeciesCard(species, dipState));
  }

  container.appendChild(list);

  const content = ui.createModalContent('星际外交', 'globe', container);
  content.querySelector('.modal-body').classList.add('diplomacy-panel');
  ui.openModal(content, 'modal-xl');
}

function createSpeciesCard(species, dipState) {
  const card = createElement('div', { className: `species-card ${species.id}` });

  // Header
  const header = createElement('div', { className: 'species-card-header' }, [
    createElement('div', { className: 'species-avatar' }, [lucideIcon(species.icon, 28)]),
    createElement('div', { className: 'species-info' }, [
      createElement('h3', {}, [species.name]),
      createElement('div', { className: 'species-homeworld' }, [species.homeworld]),
    ]),
  ]);
  card.appendChild(header);

  // Body
  const body = createElement('div', { className: 'species-card-body' });

  // Lore
  const lore = createElement('div', { className: 'species-lore' }, [
    createElement('div', { className: 'lore-label' }, ['种族特征: ' + species.trait]),
    createElement('p', {}, [species.lore]),
    createElement('div', { className: 'lore-label', style: { marginTop: '8px' } }, ['性格倾向: ' + species.personality]),
  ]);
  body.appendChild(lore);

  // Radar chart
  const radarSection = createElement('div', { className: 'species-radar-section' }, [
    createElement('h4', {}, ['引力偏好']),
    createRadarChart(species.gravityPreference, 130),
  ]);
  body.appendChild(radarSection);

  // Reputation
  const repSection = createElement('div', { className: 'reputation-section' }, [
    createElement('h4', { style: { fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' } }, ['好感度']),
    createReputationBar(dipState.reputation, species.tiers),
  ]);
  body.appendChild(repSection);

  // Tier rewards
  const rewards = createElement('div', { className: 'tier-rewards' });
  for (const tier of species.tiers) {
    const unlocked = dipState.reputation >= tier.level;
    rewards.appendChild(createElement('div', {
      className: `tier-reward-card ${unlocked ? 'unlocked' : 'locked'}`,
    }, [
      createElement('div', { className: 'tier-reward-level' }, [tier.name]),
      createElement('div', { className: 'tier-reward-desc' }, [tier.reward]),
    ]));
  }
  body.appendChild(rewards);

  // Fun fact
  body.appendChild(createElement('div', { className: 'species-funfact' }, [species.funfact]));

  // AI 外交建议（信号接收 → 打字机效果）
  const aiContainer = createElement('div', { style: { marginTop: '8px' } });
  body.appendChild(aiContainer);

  aiAdvisor.showWithPlaceholder(
    AI_REQUEST_TYPES.DIPLOMACY_ADVICE,
    { speciesId: species.id, speciesName: species.name },
    aiContainer,
    { label: 'AI 外交建议', typeSpeed: 20 }
  );

  card.appendChild(body);
  return card;
}

function createReputationBar(value, tiers) {
  const container = createElement('div', { className: 'reputation-bar-container' });
  const bar = createElement('div', { className: 'reputation-bar' });
  const fill = createElement('div', {
    className: 'reputation-fill',
    style: { width: `${Math.min(value, 100)}%` },
  });
  bar.appendChild(fill);

  // Tier markers
  const markers = createElement('div', { className: 'reputation-markers' });
  for (const tier of tiers) {
    const marker = createElement('div', {
      className: `reputation-marker ${value >= tier.level ? 'reached' : ''}`,
      style: { left: `${tier.level}%` },
    });
    marker.appendChild(createElement('span', { className: 'reputation-marker-label' }, [`${tier.level}`]));
    markers.appendChild(marker);
  }
  bar.appendChild(markers);

  container.appendChild(bar);
  return container;
}

export function createRadarChart(values, size = 150) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', '0 0 200 200');

  const cx = 100, cy = 100, r = 80;
  const dims = Object.keys(GRAVITY_CONFIG);
  const n = dims.length;

  // Background rings
  for (let ring = 1; ring <= 4; ring++) {
    const rr = r * ring / 4;
    const points = dims.map((_, i) => {
      const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
      return `${cx + rr * Math.cos(angle)},${cy + rr * Math.sin(angle)}`;
    }).join(' ');
    const polygon = document.createElementNS(svgNS, 'polygon');
    polygon.setAttribute('points', points);
    polygon.setAttribute('fill', 'none');
    polygon.setAttribute('stroke', 'rgba(100,140,255,0.1)');
    polygon.setAttribute('stroke-width', '0.5');
    svg.appendChild(polygon);
  }

  // Axis lines
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', cx);
    line.setAttribute('y1', cy);
    line.setAttribute('x2', cx + r * Math.cos(angle));
    line.setAttribute('y2', cy + r * Math.sin(angle));
    line.setAttribute('stroke', 'rgba(100,140,255,0.08)');
    line.setAttribute('stroke-width', '0.5');
    svg.appendChild(line);
  }

  // Data polygon
  const maxVal = 10;
  const dataPoints = dims.map((dim, i) => {
    const val = Math.min((values[dim] || 0) / maxVal, 1);
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    return `${cx + r * val * Math.cos(angle)},${cy + r * val * Math.sin(angle)}`;
  }).join(' ');

  const dataPolygon = document.createElementNS(svgNS, 'polygon');
  dataPolygon.setAttribute('points', dataPoints);
  dataPolygon.setAttribute('fill', 'rgba(100,140,255,0.15)');
  dataPolygon.setAttribute('stroke', 'rgba(100,140,255,0.6)');
  dataPolygon.setAttribute('stroke-width', '1.5');
  svg.appendChild(dataPolygon);

  // Data points + labels
  dims.forEach((dim, i) => {
    const val = Math.min((values[dim] || 0) / maxVal, 1);
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    const px = cx + r * val * Math.cos(angle);
    const py = cy + r * val * Math.sin(angle);

    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', px);
    circle.setAttribute('cy', py);
    circle.setAttribute('r', '3');
    circle.setAttribute('fill', GRAVITY_CONFIG[dim].color);
    svg.appendChild(circle);

    // Label
    const lx = cx + (r + 16) * Math.cos(angle);
    const ly = cy + (r + 16) * Math.sin(angle);
    const label = document.createElementNS(svgNS, 'text');
    label.setAttribute('x', lx);
    label.setAttribute('y', ly);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute('fill', GRAVITY_CONFIG[dim].color);
    label.setAttribute('font-size', '11');
    label.setAttribute('font-family', 'Noto Sans SC');
    label.textContent = GRAVITY_CONFIG[dim].name;
    svg.appendChild(label);
  });

  return svg;
}
