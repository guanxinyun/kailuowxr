/**
 * 星尘殖民地 — UI管理器
 * Handles modals, notifications, sidepanel, and all UI state
 */
import { bus } from './EventBus.js';
import { gameState } from './GameState.js';
import { $, $$, createElement, lucideIcon, removeChildren, formatNumber, animateValue } from './utils.js';
import { GRAVITY_CONFIG, RESOURCES, SEASONS } from '../data/gamedata.js';

export class UIManager {
  constructor() {
    this._activeModal = null;
    this._modalStack = [];
    this._notificationTimers = new Map();
    this._overlayClickHandler = null;
    this._escHandler = null;
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
  }

  // ===== Modal System =====
  openModal(contentEl, sizeClass = 'modal-lg') {
    const overlay = $('.modal-overlay');
    if (!overlay) return;

    // Close existing
    if (this._activeModal) {
      this.closeModal(false);
    }

    const modal = createElement('div', { className: `modal ${sizeClass}` }, [contentEl]);
    removeChildren(overlay);
    overlay.appendChild(modal);
    overlay.classList.add('active');
    this._activeModal = modal;

    // Close on overlay click (不使用once，正确管理handler)
    this._overlayClickHandler = (e) => {
      if (e.target === overlay) this.closeModal();
    };
    overlay.addEventListener('click', this._overlayClickHandler);

    // Close on Escape
    this._escHandler = (e) => {
      if (e.key === 'Escape') this.closeModal();
    };
    document.addEventListener('keydown', this._escHandler);

    bus.emit('modal:open', { modal });
  }

  closeModal(animate = true) {
    const overlay = $('.modal-overlay');
    if (!overlay || !this._activeModal) return;

    // 清理事件监听器
    if (this._overlayClickHandler) {
      overlay.removeEventListener('click', this._overlayClickHandler);
      this._overlayClickHandler = null;
    }
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }

    if (animate) {
      this._activeModal.classList.add('closing');
      setTimeout(() => {
        overlay.classList.remove('active');
        removeChildren(overlay);
        this._activeModal = null;
        bus.emit('modal:close');
      }, 200);
    } else {
      overlay.classList.remove('active');
      removeChildren(overlay);
      this._activeModal = null;
      bus.emit('modal:close');
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

    return createElement('div', {}, children);
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
