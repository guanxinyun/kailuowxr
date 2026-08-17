import { ui } from '../core/UIManager.js';
import { gameState } from '../core/GameState.js';
import { createElement, lucideIcon } from '../core/utils.js';
import { getActiveTourists, calculateVisitSatisfaction } from '../core/TouristManager.js';
import { getBuildingById } from '../data/buildings.js';
import { getBuildingOperationalState } from '../core/BuildingSystem.js';
import { GRAVITY_LABELS } from '../data/residents.js';

export function openTourismPanel() {
  const container = createElement('div', { className: 'tourism-panel-inner' });
  container.appendChild(createElement('p', { className: 'settings-hint' }, [
    '游客会根据自己的六维偏好、景点引力和距离自主选择目的地。玩家无需设置路线，只需优化布局与道路。',
  ]));

  const attractions = gameState.state.buildings.filter(b =>
    ['museum', 'concert_hall', 'monument', 'trade_hub', 'plaza'].includes(b.buildingId)
  );
  const attractionSection = createElement('div', { className: 'tourism-attractions' });
  attractionSection.appendChild(createElement('h3', {}, ['景点概况']));
  if (!attractions.length) attractionSection.appendChild(createElement('div', { className: 'production-empty' }, ['尚未建造旅游景点']));
  for (const building of attractions) {
    const data = getBuildingById(building.buildingId);
    const operation = getBuildingOperationalState(building);
    attractionSection.appendChild(createElement('div', { className: `tourism-attraction ${operation.operational ? '' : 'offline'}` }, [
      lucideIcon(data.icon, 16),
      createElement('strong', {}, [data.name]),
      createElement('span', {}, [operation.operational ? `(${building.x}, ${building.y}) · 开放` : operation.reason]),
    ]));
  }
  container.appendChild(attractionSection);

  const tourists = getActiveTourists();
  const touristSection = createElement('div', { className: 'tourism-visitors' });
  touristSection.appendChild(createElement('h3', {}, [`当前游客（${tourists.length}）`]));
  if (!tourists.length) touristSection.appendChild(createElement('div', { className: 'production-empty' }, ['暂时没有游客，建设运营中的文化景点会吸引访客。']));
  const operational = gameState.state.buildings.filter(b => getBuildingOperationalState(b).operational);
  for (const tourist of tourists) {
    const satisfaction = calculateVisitSatisfaction(tourist, operational);
    const topPreferences = Object.entries(tourist.preference)
      .sort((a, b) => b[1] - a[1]).slice(0, 2)
      .map(([dim, value]) => `${GRAVITY_LABELS[dim]} ${value}`).join(' · ');
    const stops = (tourist.itinerary || []).map(id => {
      const building = gameState.state.buildings.find(b => b.id === id);
      return building ? getBuildingById(building.buildingId)?.name : null;
    }).filter(Boolean);
    const traits = tourist.traits || [];
    const traitsEl = createElement('div', {
      style: { display: 'flex', gap: '6px', margin: '4px 0', flexWrap: 'wrap' },
    });
    for (const t of traits) {
      traitsEl.appendChild(createElement('span', {
        title: t.desc,
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: '600',
          background: `${t.color || '#3498DB'}22`,
          color: t.color || '#3498DB',
          border: `1px solid ${t.color || '#3498DB'}44`,
        },
      }, [
        lucideIcon(t.icon || 'smile', 12),
        document.createTextNode(t.label),
      ]));
    }

    touristSection.appendChild(createElement('div', { className: 'tourism-visitor' }, [
      createElement('div', { className: 'tourism-visitor-header' }, [
        createElement('strong', {}, [tourist.name]),
        createElement('span', {}, [`${tourist.speciesName} · 满意度 ${satisfaction.score}%`]),
      ]),
      traitsEl,
      createElement('div', { className: 'tourism-preference' }, [`心声：${tourist.personality || '温和好奇'} · 偏好：${topPreferences}`]),
      createElement('div', { className: 'tourism-itinerary' }, [`自主行程：${stops.join(' → ') || '尚未找到合适景点'}`]),
      createElement('div', { className: 'tourism-progress' }, [`已访问 ${tourist.visitedStops?.length || 0}/${stops.length} · 预算 ${tourist.budget} 星币`]),
    ]));
  }
  container.appendChild(touristSection);

  const content = ui.createModalContent('旅游观察', 'map-pinned', container);
  ui.openModal(content, 'modal-lg');
}
