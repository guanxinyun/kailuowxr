/**
 * 星尘殖民地 — EventBus 发布/订阅系统
 */
export class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const set = this._listeners.get(event);
    if (set) {
      set.delete(callback);
      if (set.size === 0) this._listeners.delete(event);
    }
  }

  emit(event, data) {
    const set = this._listeners.get(event);
    if (set) {
      for (const cb of set) {
        try { cb(data); } catch (e) { console.error(`EventBus [${event}]:`, e); }
      }
    }
  }

  once(event, callback) {
    const unsub = this.on(event, (data) => {
      unsub();
      callback(data);
    });
    return unsub;
  }

  clear() {
    this._listeners.clear();
  }
}

export const bus = new EventBus();
