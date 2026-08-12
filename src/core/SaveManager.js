import { gameState } from './GameState.js';

const SLOT_COUNT = 3;
const SLOT_PREFIX = 'stardust-colony-slot-';
const FORMAT = 'stardust-colony-save';
const VERSION = 1;
const ACTIVE_SLOT_KEY = 'stardust-colony-active-slot';

function key(slotId) { return `${SLOT_PREFIX}${slotId}`; }
function assertSlot(slotId) {
  if (!Number.isInteger(slotId) || slotId < 1 || slotId > SLOT_COUNT) throw new Error('无效存档槽位');
}
function validateEnvelope(value) {
  if (!value || value.format !== FORMAT || value.version !== VERSION || typeof value.state !== 'string') throw new Error('存档格式不正确');
  const parsed = JSON.parse(value.state);
  if (!parsed || !Array.isArray(parsed.residents) || !Array.isArray(parsed.buildings) || typeof parsed.resources !== 'object') throw new Error('存档内容不完整');
  return value;
}

export class SaveManager {
  list() {
    return Array.from({ length: SLOT_COUNT }, (_, index) => {
      const slotId = index + 1;
      try {
        const data = validateEnvelope(JSON.parse(localStorage.getItem(key(slotId))));
        return { slotId, empty: false, name: data.name, savedAt: data.savedAt, year: data.year, day: data.day };
      } catch {
        return { slotId, empty: true, name: `存档 ${slotId}` };
      }
    });
  }

  save(slotId, name = `存档 ${slotId}`) {
    assertSlot(slotId);
    const data = { format: FORMAT, version: VERSION, name: name.trim().slice(0, 30) || `存档 ${slotId}`, savedAt: Date.now(), year: gameState.state.year, day: gameState.state.day, state: gameState.serialize() };
    localStorage.setItem(key(slotId), JSON.stringify(data));
    localStorage.setItem(ACTIVE_SLOT_KEY, String(slotId));
    return data;
  }

  load(slotId) {
    assertSlot(slotId);
    const raw = localStorage.getItem(key(slotId));
    if (!raw) throw new Error('该槽位为空');
    const data = validateEnvelope(JSON.parse(raw));
    gameState.deserialize(data.state);
    localStorage.setItem(ACTIVE_SLOT_KEY, String(slotId));
    return data;
  }

  loadActive() {
    const slotId = Number(localStorage.getItem(ACTIVE_SLOT_KEY));
    if (!Number.isInteger(slotId) || !localStorage.getItem(key(slotId))) return null;
    try {
      return this.load(slotId);
    } catch {
      localStorage.removeItem(ACTIVE_SLOT_KEY);
      return null;
    }
  }

  clearActive() { localStorage.removeItem(ACTIVE_SLOT_KEY); }

  getActiveSlot() {
    const slotId = Number(localStorage.getItem(ACTIVE_SLOT_KEY));
    return Number.isInteger(slotId) && slotId >= 1 && slotId <= SLOT_COUNT ? slotId : null;
  }

  rename(slotId, name) {
    assertSlot(slotId);
    const data = validateEnvelope(JSON.parse(localStorage.getItem(key(slotId))));
    data.name = name.trim().slice(0, 30) || data.name;
    localStorage.setItem(key(slotId), JSON.stringify(data));
  }

  remove(slotId) {
    assertSlot(slotId);
    localStorage.removeItem(key(slotId));
    if (this.getActiveSlot() === slotId) localStorage.removeItem(ACTIVE_SLOT_KEY);
  }

  export(slotId) {
    assertSlot(slotId);
    return new Blob([localStorage.getItem(key(slotId)) || (() => { throw new Error('该槽位为空'); })()], { type: 'application/json' });
  }

  async import(slotId, file) {
    assertSlot(slotId);
    if (!file) throw new Error('请选择存档文件');
    const data = validateEnvelope(JSON.parse(await file.text()));
    localStorage.setItem(key(slotId), JSON.stringify(data));
    return data;
  }
}

export const saveManager = new SaveManager();
