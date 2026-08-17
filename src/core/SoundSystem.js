/**
 * 星尘殖民地 — 程序化音效系统 (Web Audio API)
 * 无需外部音频文件，纯代码合成治愈、轻快、开罗风格的 8-bit / 复古科幻音效。
 * 遵循浏览器交互策略（首次用户交互后初始化 AudioContext）。
 */

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.4;
    this.bgmEnabled = true;
    this.bgmVolume = 0.25;
    this.initialized = false;
    this.bgmPlaying = false;
    this.bgmTimer = null;
    this.bgmStep = 0;

    // 从本地存储读取设置
    try {
      const saved = localStorage.getItem('stardust_audio_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.enabled === 'boolean') this.enabled = parsed.enabled;
        if (typeof parsed.volume === 'number') this.volume = parsed.volume;
        if (typeof parsed.bgmEnabled === 'boolean') this.bgmEnabled = parsed.bgmEnabled;
        if (typeof parsed.bgmVolume === 'number') this.bgmVolume = parsed.bgmVolume;
      }
    } catch {
      // 忽略存储读取异常
    }
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.initialized = true;
        if (this.bgmEnabled) {
          this.startBGM();
        }
      }
    } catch {
      // AudioContext 不可用时静默回退
    }
  }

  ensureContext() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.bgmEnabled && !this.bgmPlaying) {
      this.startBGM();
    }
  }

  saveSettings() {
    try {
      localStorage.setItem('stardust_audio_settings', JSON.stringify({
        enabled: this.enabled,
        volume: this.volume,
        bgmEnabled: this.bgmEnabled,
        bgmVolume: this.bgmVolume,
      }));
    } catch {
      // 忽略存储写入异常
    }
  }

  setEnabled(val) {
    this.enabled = Boolean(val);
    this.saveSettings();
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, Number(val) || 0));
    this.saveSettings();
  }

  setBgmEnabled(val) {
    this.bgmEnabled = Boolean(val);
    this.saveSettings();
    if (this.bgmEnabled) {
      this.startBGM();
    } else {
      this.stopBGM();
    }
  }

  setBgmVolume(val) {
    this.bgmVolume = Math.max(0, Math.min(1, Number(val) || 0));
    this.saveSettings();
  }

  // ==================== 程序化治愈 BGM 旋律引擎 ====================
  // 开罗/星际暖心轻音乐，五声音阶（C major pentatonic / Lydian 梦幻空灵）
  startBGM() {
    if (this.bgmPlaying || !this.bgmEnabled) return;
    this.bgmPlaying = true;
    this._scheduleBGMStep();
  }

  stopBGM() {
    this.bgmPlaying = false;
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  _scheduleBGMStep() {
    if (!this.bgmPlaying || !this.ctx) {
      this.bgmPlaying = false;
      return;
    }

    // 治愈系旋律小节序列（Hz 频率）
    // C4, D4, E4, G4, A4, B4, C5, D5, E5, G5
    const SCALE = [261.63, 293.66, 329.63, 392.00, 440.00, 493.88, 523.25, 587.33, 659.25, 783.99];
    // 8小节循环治愈主旋律
    const MELODY = [
      [2, 4, 6], [4, 6, 7], [6, 8, 9], [7, 6, 4],
      [4, 2, 0], [2, 4, 6], [5, 4, 2], [0, 2, 4],
    ];

    const currentBar = MELODY[this.bgmStep % MELODY.length];
    const now = this.ctx.currentTime;

    // 1. 底层温润低音 (Root Bass / Pad)
    const BASS_ROOTS = [130.81, 164.81, 196.00, 174.61]; // C3, E3, G3, F3
    const bassFreq = BASS_ROOTS[Math.floor(this.bgmStep / 2) % BASS_ROOTS.length];
    this._playPadNote(bassFreq, now, 1.8, 0.12 * this.bgmVolume);

    // 2. 灵动音符 (Bell/Chime)
    currentBar.forEach((noteIdx, i) => {
      const freq = SCALE[noteIdx % SCALE.length];
      const noteTime = now + i * 0.45;
      this._playChimeNote(freq, noteTime, 0.4, 0.15 * this.bgmVolume);
    });

    this.bgmStep++;
    // 每 1.8 秒走完一个小节
    this.bgmTimer = setTimeout(() => {
      this._scheduleBGMStep();
    }, 1750);
  }

  _playChimeNote(freq, startTime, duration, vol) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(vol, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    } catch {
      // 忽略音频调度错误
    }
  }

  _playPadNote(freq, startTime, duration, vol) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(vol, startTime + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.1);
    } catch {
      // 忽略音频调度错误
    }
  }

  /**
   * 播放程序化合成音效
   * @param {'click'|'build'|'cash'|'tech'|'card_play'|'card_win'|'card_fail'|'event'|'explore_start'} type
   */
  play(type) {
    if (!this.enabled || this.volume <= 0) return;
    this.ensureContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      switch (type) {
        case 'click':
          this._playClick(now);
          break;
        case 'build':
          this._playBuild(now);
          break;
        case 'cash':
          this._playCash(now);
          break;
        case 'tech':
          this._playTech(now);
          break;
        case 'card_play':
          this._playCardPlay(now);
          break;
        case 'card_win':
          this._playCardWin(now);
          break;
        case 'card_fail':
          this._playCardFail(now);
          break;
        case 'event':
          this._playEvent(now);
          break;
        case 'explore_start':
          this._playExploreStart(now);
          break;
        default:
          this._playClick(now);
          break;
      }
    } catch {
      // 静默防止打断游戏
    }
  }

  // 1. 轻柔点击音
  _playClick(t) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.04);

    gain.gain.setValueAtTime(0.2 * this.volume, t);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  // 2. 建造放置音（双重清脆敲击/叮咚）
  _playBuild(t) {
    const notes = [523.25, 659.25]; // C5, E5
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = t + i * 0.06;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.3 * this.volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.13);
    });
  }

  // 3. 金币/星币清脆哗啦声
  _playCash(t) {
    const freqs = [987.77, 1318.51]; // B5, E6
    freqs.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = t + i * 0.07;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.25 * this.volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.2);
    });
  }

  // 4. 科技研究/卡牌解锁音（上行和弦，未来科技感）
  _playTech(t) {
    const chord = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
    chord.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = t + i * 0.08;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.25 * this.volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.36);
    });
  }

  // 5. 出牌发牌声（快速滑音）
  _playCardPlay(t) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(350, t);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.08);

    gain.gain.setValueAtTime(0.3 * this.volume, t);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  // 6. 卡牌过关（欢快三连音）
  _playCardWin(t) {
    const notes = [587.33, 739.99, 880]; // D5, F#5, A5
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = t + i * 0.09;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.3 * this.volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.26);
    });
  }

  // 7. 卡牌未通过（低沉两连音，温和不惩罚）
  _playCardFail(t) {
    const notes = [330, 293.66]; // E4, D4
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = t + i * 0.12;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.2 * this.volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.22);
    });
  }

  // 8. 突发事件/使节来访（优雅风铃双音）
  _playEvent(t) {
    const notes = [783.99, 1046.50]; // G5, C6
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = t + i * 0.11;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.25 * this.volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.42);
    });
  }

  // 9. 出发探索号角声
  _playExploreStart(t) {
    const notes = [440, 554.37, 659.25]; // A4, C#5, E5
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = t + i * 0.08;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.25 * this.volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.32);
    });
  }
}

export const sound = new SoundSystem();
