/**
 * 星尘殖民地 - 教程系统
 * 引导新玩家学习基本操作
 */
import { bus } from './EventBus.js';
import { $, lucideIcon } from './utils.js';

// 教程步骤定义
const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: '欢迎来到星尘殖民地！',
    text: '你的殖民飞船已经着陆。让我来教你如何建设你的新家园。点击"下一步"继续。',
    highlight: null,
    waitForEvent: null,
  },
  {
    id: 'build_button',
    title: '打开建造面板',
    text: '点击左侧的"建造"按钮，查看可建造的建筑。',
    highlight: '[data-tool="build"]',
    waitForEvent: 'modal:open',
  },
  {
    id: 'select_building',
    title: '选择一个建筑',
    text: '选择"水培农场"或任意建筑来准备放置。食物是殖民地的生命线！',
    highlight: null,
    waitForEvent: 'state:placingBuilding',
  },
  {
    id: 'place_building',
    title: '放置建筑',
    text: '在地图上找到绿色高亮的位置，点击放置建筑。避开水域和山地！',
    highlight: '#canvas-container',
    waitForEvent: 'building:placed',
  },
  {
    id: 'roads',
    title: '建造道路',
    text: '建筑需要通过道路连接才能高效运作。试试再建造一条"连接通道"吧！你可以按 B 键快速打开建造面板。',
    highlight: null,
    waitForEvent: null,
  },
  {
    id: 'speed_control',
    title: '控制时间流速',
    text: '使用顶部的速度按钮控制游戏速度，或按空格键暂停/继续。加速可以更快看到资源产出！',
    highlight: '.speed-controls',
    waitForEvent: null,
  },
  {
    id: 'residents',
    title: '你的居民',
    text: '地图上的小人是你的殖民者。他们会自动在建筑之间走动、工作和休息。点击"居民"按钮可以查看详情。',
    highlight: '[data-tool="residents"]',
    waitForEvent: null,
  },
  {
    id: 'complete',
    title: '准备就绪！',
    text: '你已经掌握了基础操作！探索更多建筑、研究科技、与外星种族建立外交关系吧。祝你好运，殖民者！',
    highlight: null,
    waitForEvent: null,
  },
];

export class TutorialManager {
  constructor() {
    this.steps = TUTORIAL_STEPS;
    this.currentStep = 0;
    this.active = false;
    this.overlay = null;
    this.dialog = null;
    this._eventCleanup = null;
  }

  /**
   * 开始教程
   */
  start() {
    if (this.active) return;
    this.active = true;
    this.currentStep = 0;

    // 创建教程覆盖层
    this.overlay = document.createElement('div');
    this.overlay.className = 'tutorial-overlay active';
    document.body.appendChild(this.overlay);

    this.showStep(0);
  }

  /**
   * 显示指定步骤
   */
  showStep(index) {
    if (index >= this.steps.length) {
      this.complete();
      return;
    }

    this.currentStep = index;
    const step = this.steps[index];

    // 清理上一步
    this._clearHighlight();
    this._clearDialog();
    this._clearEventListener();

    // 高亮元素
    if (step.highlight) {
      this._highlightElement(step.highlight);
    } else if (this.overlay) {
      // 没有高亮元素时，添加全屏半透明遮罩
      const fullscreen = document.createElement('div');
      fullscreen.className = 'tutorial-spotlight fullscreen';
      this.overlay.appendChild(fullscreen);
    }

    // 如果需要等待事件，让overlay允许点击穿透到底层UI
    if (step.waitForEvent && this.overlay) {
      this.overlay.style.pointerEvents = 'none';
    } else if (this.overlay) {
      this.overlay.style.pointerEvents = '';
    }

    // 创建对话框
    this._createDialog(step, index);

    // 设置事件监听（自动推进）
    if (step.waitForEvent) {
      this._waitForEvent(step.waitForEvent);
    }
  }

  /**
   * 下一步
   */
  nextStep() {
    this.showStep(this.currentStep + 1);
  }

  /**
   * 跳过教程
   */
  skip() {
    this.complete();
  }

  /**
   * 教程完成
   */
  complete() {
    this.active = false;
    this._clearHighlight();
    this._clearDialog();
    this._clearEventListener();

    if (this.overlay) {
      this.overlay.classList.remove('active');
      setTimeout(() => {
        if (this.overlay && this.overlay.parentNode) {
          this.overlay.parentNode.removeChild(this.overlay);
        }
        this.overlay = null;
      }, 300);
    }

    // 标记教程已完成
    localStorage.setItem('stardust_tutorial_done', '1');
  }

  /**
   * 高亮指定元素，并使其可点击（穿透overlay）
   */
  _highlightElement(selector) {
    const el = $(selector);
    if (!el) return;

    // 给目标元素添加 tutorial-highlight 类，使其 z-index 提升到 overlay 之上
    el.classList.add('tutorial-highlight');
    this._highlightedEl = el;

    const spotlight = document.createElement('div');
    spotlight.className = 'tutorial-spotlight';

    // 获取元素位置
    const rect = el.getBoundingClientRect();
    const padding = 6;
    spotlight.style.left = (rect.left - padding) + 'px';
    spotlight.style.top = (rect.top - padding) + 'px';
    spotlight.style.width = (rect.width + padding * 2) + 'px';
    spotlight.style.height = (rect.height + padding * 2) + 'px';

    if (this.overlay) {
      this.overlay.appendChild(spotlight);
    }
  }

  /**
   * 创建对话框 - 匹配 tutorial.css 的结构
   */
  _createDialog(step, index) {
    const dialog = document.createElement('div');
    dialog.className = 'tutorial-dialog';

    // === 头部 ===
    const header = document.createElement('div');
    header.className = 'tutorial-dialog-header';

    const avatar = document.createElement('div');
    avatar.className = 'tutorial-avatar';
    avatar.appendChild(lucideIcon('sparkles', 22));
    header.appendChild(avatar);

    const speaker = document.createElement('div');
    speaker.className = 'tutorial-speaker';
    const speakerName = document.createElement('div');
    speakerName.className = 'tutorial-speaker-name';
    speakerName.textContent = '殖民地AI助手';
    const speakerTitle = document.createElement('div');
    speakerTitle.className = 'tutorial-speaker-title';
    speakerTitle.textContent = '新手引导';
    speaker.appendChild(speakerName);
    speaker.appendChild(speakerTitle);
    header.appendChild(speaker);

    const badge = document.createElement('div');
    badge.className = 'tutorial-step-badge';
    badge.textContent = `${index + 1} / ${this.steps.length}`;
    header.appendChild(badge);

    dialog.appendChild(header);

    // === 内容 ===
    const body = document.createElement('div');
    body.className = 'tutorial-dialog-body';

    const title = document.createElement('div');
    title.className = 'tutorial-speaker-name';
    title.style.fontSize = 'var(--fs-lg)';
    title.style.marginBottom = 'var(--sp-2)';
    title.textContent = step.title;
    body.appendChild(title);

    const text = document.createElement('div');
    text.className = 'tutorial-text';
    text.textContent = step.text;
    body.appendChild(text);

    dialog.appendChild(body);

    // === 底部 ===
    const footer = document.createElement('div');
    footer.className = 'tutorial-dialog-footer';

    // 进度指示器
    const progress = document.createElement('div');
    progress.className = 'tutorial-progress';
    for (let i = 0; i < this.steps.length; i++) {
      const dot = document.createElement('div');
      dot.className = 'tutorial-progress-dot';
      if (i < index) dot.classList.add('completed');
      if (i === index) dot.classList.add('current');
      progress.appendChild(dot);
    }
    footer.appendChild(progress);

    // 按钮组
    const actions = document.createElement('div');
    actions.className = 'tutorial-actions';

    // 跳过按钮
    const skipBtn = document.createElement('button');
    skipBtn.className = 'tutorial-btn tutorial-btn-skip';
    skipBtn.textContent = '跳过教程';
    skipBtn.addEventListener('click', () => this.skip());
    actions.appendChild(skipBtn);

    // 下一步按钮（如果不需要等待事件）
    if (!step.waitForEvent) {
      const nextBtn = document.createElement('button');
      nextBtn.className = 'tutorial-btn tutorial-btn-primary';
      nextBtn.textContent = index === this.steps.length - 1 ? '开始游戏！' : '下一步';
      nextBtn.addEventListener('click', () => this.nextStep());
      actions.appendChild(nextBtn);
    }

    footer.appendChild(actions);
    dialog.appendChild(footer);

    // 等待操作提示
    if (step.waitForEvent) {
      const hint = document.createElement('div');
      hint.className = 'tutorial-hint';
      hint.style.margin = 'var(--sp-3) var(--sp-5) var(--sp-3)';
      hint.appendChild(lucideIcon('compass', 14));
      const hintText = document.createElement('span');
      hintText.textContent = '请执行上述操作以继续...';
      hint.appendChild(hintText);
      dialog.appendChild(hint);
    }

    if (this.overlay) {
      this.overlay.appendChild(dialog);
    }
    // 确保对话框在overlay pointer-events:none时仍可点击
    dialog.style.pointerEvents = 'auto';
    this.dialog = dialog;
  }

  /**
   * 等待事件触发后自动推进
   */
  _waitForEvent(eventName) {
    const handler = () => {
      // 延迟一点再推进，让玩家看到操作结果
      setTimeout(() => this.nextStep(), 800);
    };
    bus.on(eventName, handler);
    this._eventCleanup = () => bus.off(eventName, handler);
  }

  /**
   * 清理高亮
   */
  _clearHighlight() {
    // 移除目标元素的 tutorial-highlight 类
    if (this._highlightedEl) {
      this._highlightedEl.classList.remove('tutorial-highlight');
      this._highlightedEl = null;
    }
    if (this.overlay) {
      // 清除所有 spotlight（包括 fullscreen 遮罩）
      const spotlights = this.overlay.querySelectorAll('.tutorial-spotlight');
      spotlights.forEach(s => s.remove());
    }
  }

  /**
   * 清理对话框
   */
  _clearDialog() {
    if (this.dialog && this.dialog.parentNode) {
      this.dialog.parentNode.removeChild(this.dialog);
    }
    this.dialog = null;
  }

  /**
   * 清理事件监听
   */
  _clearEventListener() {
    if (this._eventCleanup) {
      this._eventCleanup();
      this._eventCleanup = null;
    }
  }
}
