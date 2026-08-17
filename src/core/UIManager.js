/**
 * 星尘殖民地 — UI管理器
 * Handles modals, notifications, sidepanel, and all UI state
 */
import { bus } from './EventBus.js';
import { gameState } from './GameState.js';
import { $, $$, createElement, lucideIcon, removeChildren, formatNumber, animateValue } from './utils.js';
import { GRAVITY_CONFIG, RESOURCES, SEASONS } from '../data/gamedata.js';
import { BUILDINGS } from '../data/buildings.js';

export class UIManager {
  constructor() {
    this._activeModal = null;
    this._modalStack = [];
    this._notificationTimers = new Map();
    this._overlayClickHandler = null;
    this._escHandler = null;
    this._previousSpeedBeforeModal = null; // 记录打开弹窗前的游戏速度，用于关闭后恢复
    this._setupListeners();
  }

  _setupListeners() {
    // Resource changes
    bus.on('resource:change', ({ type, value }) => {
      const el = $(`.resource-value[data-resource="${type}"]`);
      if (el) {
        const old = parseInt(el.textContent) || 0;
        animateValue(el, old, value);
      }
    });

    // Day advance
    bus.on('day:advance', ({ day, season }) => {
      const dateEl = $('.date-display .date-text');
      if (dateEl) dateEl.textContent = `Y${gameState.state.year} · 第${day}天`;

      const seasonEl = $('.season-indicator');
      if (seasonEl) {
        const s = SEASONS[season];
        seasonEl.textContent = s.name;
        seasonEl.style.color = s.color;
      }
    });

    // Population
    bus.on('state:population', ({ value }) => {
      const el = $('.pop-count');
      if (el) el.textContent = value;
    });

    // Notifications
    bus.on('notification:new', (n) => this.showNotification(n));

    // Speed controls
    bus.on('state:speed', ({ value }) => {
      $$('.speed-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.speed) === value);
      });
    });

    // 建筑放置 HUD 控制器（适配手机触控与桌面无右键/快速取消操作）
    bus.on('state:placingBuilding', ({ value }) => {
      this._updatePlacementHUD(value);
    });
  }

  /**
   * 悬浮放置控制条（HUD）
   * 处于放置模式时显示当前正在放置的建筑名称，并提供显眼的「❌ 取消建造」按钮与「✅ 选定地块确认」操作
   */
  _updatePlacementHUD(placingBuildingId) {
    let hud = $('.placement-hud');
    if (!placingBuildingId) {
      if (hud) {
        hud.classList.remove('active');
        setTimeout(() => hud?.remove(), 250);
      }
      return;
    }

    const buildingData = BUILDINGS.find(b => b.id === placingBuildingId);
    const buildingName = buildingData ? buildingData.name : '建筑';

    if (!hud) {
      hud = createElement('div', { className: 'placement-hud' });
      document.body.appendChild(hud);
    }

    removeChildren(hud);

    // 建筑图标与名称
    const info = createElement('div', { className: 'placement-hud-info' }, [
      createElement('span', { className: 'placement-hud-badge' }, ['正在建造']),
      createElement('strong', { className: 'placement-hud-name' }, [buildingName]),
      createElement('span', { className: 'placement-hud-tip' }, ['点击地块确认，或点击取消']),
    ]);

    // 取消按钮
    const cancelBtn = createElement('button', {
      className: 'btn btn-danger placement-hud-cancel',
      title: '取消放置 (Esc / 右键)',
    }, [
      lucideIcon('x', 16),
      document.createTextNode(' 取消放置'),
    ]);

    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      gameState.set('placingBuilding', null);
    });

    hud.appendChild(info);
    hud.appendChild(cancelBtn);

    // 强制重绘以触发 transition
    requestAnimationFrame(() => {
      hud.classList.add('active');
    });
  }

  // ===== Modal System =====
  openModal(contentEl, sizeClass = 'modal-lg', options = {}) {
    const overlay = $('.modal-overlay');
    if (!overlay) return;

    // options: { priority: number, modalId: string, onClose: Function }
    // priority: 0 (普通手动面板: 建造/科技/外交), 10 (事件/简报/探索发现), 20 (高优交互: 卡牌挑战/移民面试)
    const priority = options.priority || 0;

    // 严格排队保护：如果当前已经有弹窗在展示
    if (this._activeModal) {
      // 场景A: 当前弹窗是正在交互的高优或同优弹窗（如卡牌游戏/事件弹窗，或当前弹窗优先级 >= 新弹窗）
      // 新弹窗绝不能覆盖打断它，一律推入等待队列（FIFO 尾部追加）
      if (this._activeModalPriority >= priority || this._activeModalPriority >= 10) {
        this._modalStack.push({ contentEl, sizeClass, options: { ...options, priority } });
        return;
      }

      // 场景B: 当前只是玩家手动打开的普通面板（priority 0），新来了一个事件/卡牌（priority >= 10）
      // 将正在查看的普通面板保存到队列底部，优先展示重要事件
      this._modalStack.unshift({
        contentEl: this._activeModalContent,
        sizeClass: this._activeModalSizeClass,
        options: {
          priority: this._activeModalPriority,
          onClose: this._activeModalOnClose,
        },
      });
      this.closeModal(false, false);
    }

    // 自动暂停时间机制（可在设置中关闭）：首次打开弹窗时记录旧速度并暂停
    const shouldPause = gameState.state.settings?.pauseOnModal !== false;
    if (shouldPause && this._previousSpeedBeforeModal === null) {
      this._previousSpeedBeforeModal = gameState.state.speed;
      if (gameState.state.speed > 0) {
        gameState.set('speed', 0);
      }
    }

    const modal = createElement('div', { className: `modal ${sizeClass}` }, [contentEl]);
    removeChildren(overlay);
    overlay.appendChild(modal);
    overlay.classList.add('active');
    this._activeModal = modal;
    this._activeModalContent = contentEl;
    this._activeModalSizeClass = sizeClass;
    this._activeModalPriority = priority;
    this._activeModalOnClose = options.onClose;

    // 弹窗只在点击关闭按钮或按 Escape 时关闭，点击空白区域不会消失
    this._escHandler = (e) => {
      if (e.key === 'Escape') this.closeModal();
    };
    document.addEventListener('keydown', this._escHandler);

    bus.emit('modal:open', { modal });
  }

  closeModal(animate = true, popQueue = true) {
    const overlay = $('.modal-overlay');
    if (!overlay || !this._activeModal) return;

    const onClose = this._activeModalOnClose;

    // 清理事件监听器
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }

    const cleanup = () => {
      overlay.classList.remove('active');
      removeChildren(overlay);
      this._activeModal = null;
      this._activeModalContent = null;
      this._activeModalSizeClass = null;
      this._activeModalPriority = 0;
      this._activeModalOnClose = null;
      if (onClose) onClose();
      bus.emit('modal:close');

      // 检查排队队列中是否有等待显示的弹窗 (FIFO: shift 弹出队首)
      if (popQueue && this._modalStack.length > 0) {
        const next = this._modalStack.shift();
        if (next && next.contentEl) {
          setTimeout(() => {
            this.openModal(next.contentEl, next.sizeClass, next.options);
          }, 80);
        }
      } else {
        // 所有弹窗全部关闭完毕，恢复之前记录的游戏速度
        const shouldPause = gameState.state.settings?.pauseOnModal !== false;
        if (shouldPause && this._previousSpeedBeforeModal !== null) {
          const restoreSpeed = this._previousSpeedBeforeModal;
          this._previousSpeedBeforeModal = null;
          // 若关闭后当前仍是暂停状态，则恢复原来的速度
          if (gameState.state.speed === 0 && restoreSpeed > 0) {
            gameState.set('speed', restoreSpeed);
          }
        } else {
          this._previousSpeedBeforeModal = null;
        }
      }
    };

    if (animate) {
      this._activeModal.classList.add('closing');
      setTimeout(cleanup, 180);
    } else {
      cleanup();
    }
  }

  createModalContent(title, iconName, bodyContent, footer = null) {
    const header = createElement('div', { className: 'modal-header' }, [
      createElement('h2', {}, [
        lucideIcon(iconName, 22),
        document.createTextNode(title),
      ]),
      this._createCloseButton(),
    ]);

    const body = createElement('div', { className: 'modal-body' }, [bodyContent]);

    const children = [header, body];
    if (footer) {
      children.push(createElement('div', { className: 'modal-footer' }, [footer]));
    }

    return createElement('div', { className: 'modal-inner' }, children);
  }

  _createCloseButton() {
    const btn = createElement('div', { className: 'modal-close' }, [lucideIcon('x', 18, 2)]);
    btn.addEventListener('click', () => this.closeModal());
    return btn;
  }

  // ===== Notification System =====
  showNotification({ id, title, text, type = 'success', icon = 'info', duration = 3000 }) {
    const container = $('.notification-container');
    if (!container) return;

    const card = createElement('div', {
      className: `notification-card type-${type}`,
      dataset: { id },
    }, [
      createElement('div', { className: 'notification-icon' }, [lucideIcon(icon, 16)]),
      createElement('div', { className: 'notification-content' }, [
        createElement('div', { className: 'notification-title' }, [title]),
        createElement('div', { className: 'notification-text' }, [text]),
      ]),
      createElement('div', { className: 'notification-timer' }),
    ]);

    // Close button
    const closeBtn = createElement('div', { className: 'notification-close' }, [lucideIcon('x', 12, 2)]);
    closeBtn.addEventListener('click', () => this.dismissNotification(id));
    card.appendChild(closeBtn);

    container.appendChild(card);

    // Auto dismiss
    if (duration > 0) {
      const timer = setTimeout(() => this.dismissNotification(id), duration);
      this._notificationTimers.set(id, timer);
    }
  }

  dismissNotification(id) {
    const card = document.querySelector(`.notification-card[data-id="${id}"]`);
    if (!card) return;

    clearTimeout(this._notificationTimers.get(id));
    this._notificationTimers.delete(id);

    card.classList.add('exiting');
    setTimeout(() => card.remove(), 250);
  }

  // ===== Confirm Dialog =====
  showConfirm({ title, text, icon = 'alert-triangle', confirmText = '确认', cancelText = '取消', onConfirm, onCancel }) {
    const content = createElement('div', { className: 'confirm-dialog' }, [
      createElement('div', { className: 'confirm-dialog-icon' }, [lucideIcon(icon, 24)]),
      createElement('div', { className: 'confirm-dialog-title' }, [title]),
      createElement('div', { className: 'confirm-dialog-text' }, [text]),
      createElement('div', { className: 'confirm-dialog-actions' }, [
        (() => {
          const btn = createElement('button', { className: 'btn' }, [cancelText]);
          btn.addEventListener('click', () => { this.closeModal(); onCancel?.(); });
          return btn;
        })(),
        (() => {
          const btn = createElement('button', { className: 'btn btn-danger' }, [confirmText]);
          btn.addEventListener('click', () => { this.closeModal(); onConfirm?.(); });
          return btn;
        })(),
      ]),
    ]);

    this.openModal(content, 'modal-sm');
  }

  // ===== Side Panel =====
  openSidePanel(content) {
    const panel = $('.side-panel');
    if (!panel) return;
    removeChildren(panel);
    panel.appendChild(content);
    panel.classList.add('active');
  }

  closeSidePanel() {
    const panel = $('.side-panel');
    if (panel) {
      panel.classList.remove('active');
      setTimeout(() => removeChildren(panel), 300);
    }
  }

  // ===== Bottom Bar =====
  setBottomMessage(text) {
    const el = $('.bottom-message');
    if (el) el.textContent = text;
  }

  // ===== Resource Display Update =====
  updateResourceDisplay() {
    const res = gameState.state.resources;
    for (const [key, val] of Object.entries(res)) {
      const el = $(`.resource-value[data-resource="${key}"]`);
      if (el) el.textContent = formatNumber(val);
    }

    const popEl = $('.pop-count');
    if (popEl) popEl.textContent = `${gameState.state.population}/${gameState.state.maxPopulation}`;
  }
}

export const ui = new UIManager();
