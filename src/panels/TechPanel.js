/**
 * 星尘殖民地 — 科技树面板
 */
import { gameState } from '../core/GameState.js';
import { ui } from '../core/UIManager.js';
import { createElement, lucideIcon } from '../core/utils.js';
import { TECHS, getTechById, getAvailableTechs } from '../data/techs.js';
import { GRAVITY_CONFIG, RESOURCES } from '../data/gamedata.js';
import { bus } from '../core/EventBus.js';

const NODE_W = 140;
const NODE_H = 60;

export function openTechPanel() {
  const container = createElement('div', { className: 'tech-panel-inner', style: { position: 'relative', width: '100%', height: '100%' } });

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'tech-tree-svg');
  // 动态计算 SVG 高度以容纳 AI 生成的科技
  const maxY = Math.max(520, ...TECHS.map(t => t.position.y + NODE_H + 40));
  svg.setAttribute('width', '900');
  svg.setAttribute('height', String(maxY));

  const researched = gameState.state.researchedTechs;
  const available = getAvailableTechs(researched).map(t => t.id);
  const researchingId = gameState.state.currentResearch?.techId || null;

  // Draw connections first
  for (const tech of TECHS) {
    for (const prereqId of tech.prereqs) {
      const prereq = getTechById(prereqId);
      if (!prereq) continue;

      const line = document.createElementNS(svgNS, 'path');
      const x1 = prereq.position.x + NODE_W / 2;
      const y1 = prereq.position.y + NODE_H;
      const x2 = tech.position.x + NODE_W / 2;
      const y2 = tech.position.y;
      const cy = (y1 + y2) / 2;

      line.setAttribute('d', `M${x1},${y1} C${x1},${cy} ${x2},${cy} ${x2},${y2}`);

      let lineClass = 'tech-line';
      if (researched.includes(tech.id) && researched.includes(prereqId)) {
        lineClass += ' researched';
      } else if (available.includes(tech.id)) {
        lineClass += ' available';
      }
      line.setAttribute('class', lineClass);
      svg.appendChild(line);
    }
  }

  // Draw nodes
  for (const tech of TECHS) {
    const isResearched = researched.includes(tech.id);
    const isAvailable = available.includes(tech.id);
    const isResearching = tech.id === researchingId;
    const isLocked = !isResearched && !isAvailable;

    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', `tech-node ${isResearched ? 'researched' : isResearching ? 'researching' : isAvailable ? 'available' : 'locked'}`);
    g.setAttribute('transform', `translate(${tech.position.x}, ${tech.position.y})`);

    // Background rect
    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('class', 'tech-node-bg');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', NODE_W);
    rect.setAttribute('height', NODE_H);
    g.appendChild(rect);

    // Icon
    const iconText = document.createElementNS(svgNS, 'text');
    iconText.setAttribute('class', 'tech-node-icon');
    iconText.setAttribute('x', '20');
    iconText.setAttribute('y', '35');
    iconText.textContent = getIconChar(tech.icon);
    g.appendChild(iconText);

    // Name
    const name = document.createElementNS(svgNS, 'text');
    name.setAttribute('class', 'tech-node-name');
    name.setAttribute('x', NODE_W / 2 + 10);
    name.setAttribute('y', '28');
    name.textContent = tech.name;
    g.appendChild(name);

    // Tier
    const tier = document.createElementNS(svgNS, 'text');
    tier.setAttribute('class', 'tech-node-tier');
    tier.setAttribute('x', NODE_W / 2 + 10);
    tier.setAttribute('y', '48');
    tier.textContent = `${tech.tier}阶`;
    g.appendChild(tier);

    // Status indicator
    if (isResearched) {
      const check = document.createElementNS(svgNS, 'text');
      check.setAttribute('class', 'tech-node-check');
      check.setAttribute('x', NODE_W - 18);
      check.setAttribute('y', '20');
      check.textContent = '✓';
      g.appendChild(check);
    } else if (isResearching) {
      const spin = document.createElementNS(svgNS, 'text');
      spin.setAttribute('class', 'tech-node-researching');
      spin.setAttribute('x', NODE_W - 18);
      spin.setAttribute('y', '20');
      spin.textContent = '⟳';
      g.appendChild(spin);
    }

    // Click handler
    g.style.cursor = 'pointer';
    g.addEventListener('click', () => {
      if (isAvailable) {
        startResearch(tech);
      }
      showTechDetail(tech, container);
    });

    // Hover handler
    g.addEventListener('mouseenter', (e) => showTechDetail(tech, container, e));
    g.addEventListener('mouseleave', () => hideTechDetail(container));

    svg.appendChild(g);
  }

  const scrollContainer = createElement('div', { className: 'tech-tree-container' }, [svg]);
  container.appendChild(scrollContainer);

  // Research progress bar
  const researchBar = createElement('div', {
    className: `tech-research-bar ${gameState.state.currentResearch ? 'active' : ''}`,
  });
  if (gameState.state.currentResearch) {
    const cr = gameState.state.currentResearch;
    const tech = getTechById(cr.techId);
    researchBar.innerHTML = `
      <span class="tech-research-name">${tech?.name || ''}</span>
      <div class="tech-research-progress">
        <div class="progress-bar"><div class="progress-fill knowledge" style="width:${cr.progress * 100}%"></div></div>
      </div>
      <span class="tech-research-time">${Math.round(cr.progress * 100)}%</span>
    `;
  }
  container.appendChild(researchBar);

  const content = ui.createModalContent('科技树', 'flask-conical', container);
  ui.openModal(content, 'modal-xl');
}

function showTechDetail(tech, container, event) {
  hideTechDetail(container);

  const researched = gameState.state.researchedTechs;
  const isResearched = researched.includes(tech.id);
  const isAvailable = getAvailableTechs(researched).some(t => t.id === tech.id);
  const isResearching = gameState.state.currentResearch?.techId === tech.id;

  const card = createElement('div', { className: 'tech-detail-card' });

  card.innerHTML = `
    <div class="tech-detail-name">${tech.name}</div>
    <div class="tech-detail-tier">${tech.tier}阶 ${isResearched ? '· 已研究' : isResearching ? '· 研究中' : isAvailable ? '· 可研究' : '· 锁定'}</div>
    <div class="tech-detail-section">
      <div class="tech-detail-section-title">描述</div>
      <div style="font-size:13px;color:var(--text-secondary);line-height:1.6">${tech.desc}</div>
    </div>
    <div class="tech-detail-section">
      <div class="tech-detail-section-title">研究消耗</div>
      <div class="tech-detail-cost">
        ${Object.entries(tech.cost).map(([k, v]) => `<span class="cost-item">${k}: ${v}</span>`).join('')}
      </div>
    </div>
    ${tech.prereqs.length ? `
    <div class="tech-detail-section">
      <div class="tech-detail-section-title">前置科技</div>
      <div class="tech-detail-prereqs">
        ${tech.prereqs.map(p => {
          const pt = getTechById(p);
          return `<span class="tag ${researched.includes(p) ? 'tag-knowledge' : ''}">${pt?.name || p}</span>`;
        }).join('')}
      </div>
    </div>` : ''}
    <div class="tech-detail-section">
      <div class="tech-detail-section-title">解锁</div>
      <div class="tech-detail-unlocks">${tech.unlocks.join(', ')}</div>
    </div>
    <div class="tech-detail-flavor">${tech.flavor}</div>
  `;

  // Position near the node
  card.style.left = (tech.position.x + NODE_W + 10) + 'px';
  card.style.top = tech.position.y + 'px';

  container.appendChild(card);
}

function hideTechDetail(container) {
  const existing = container.querySelector('.tech-detail-card');
  if (existing) existing.remove();
}

function startResearch(tech) {
  if (gameState.state.currentResearch) {
    ui.showConfirm({
      title: '切换研究',
      text: `当前正在研究其他科技，确定要切换到「${tech.name}」吗？`,
      onConfirm: () => {
        gameState.set('currentResearch', { techId: tech.id, progress: 0 });
        bus.emit('research:start', tech);
      },
    });
  } else {
    gameState.set('currentResearch', { techId: tech.id, progress: 0 });
    bus.emit('research:start', tech);
  }
}

function getIconChar(iconName) {
  const map = {
    'dna': '⦿', 'telescope': '☉', 'shield': '⛨', 'book-open': '≡',
    'leaf': '❦', 'bug': '⁂', 'radar': '◎', 'zap': '⚡',
    'sparkles': '✨', 'atom': '⚛', 'handshake': '❤', 'monitor-play': '▶',
    'orbit': '⭕', 'brain': '⚙',
  };
  return map[iconName] || '◆';
}
