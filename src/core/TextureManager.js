import { bus } from './EventBus.js';
import { getTextureSlot } from '../data/textureSlots.js';

const DB_NAME = 'stardust-colony-assets';
const DB_VERSION = 1;
const STORE_NAME = 'textures';
const MANIFEST_KEY = 'stardust-colony-texture-manifest-v1';
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_DIMENSION = 1024;
const SPRITE_COLUMNS = 3;
const SPRITE_ROWS = 4;

function readManifest() {
  try {
    return JSON.parse(localStorage.getItem(MANIFEST_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveManifest(entries) {
  try {
    localStorage.setItem(MANIFEST_KEY, JSON.stringify({ version: 1, entries }));
  } catch {
    // The game can still render from IndexedDB when metadata storage is full.
  }
}

function decodeBlob(blob) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(blob);
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片无法解码'));
    };
    image.src = url;
  });
}

function readImageDimensions(image) {
  return { width: image.width || image.naturalWidth, height: image.height || image.naturalHeight };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('无法读取纹理'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl) {
  const match = /^data:(image\/png);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('纹理包只支持 PNG data URL');
  const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: match[1] });
}

export function validateTextureFile(file, slotId) {
  const slot = getTextureSlot(slotId);
  if (!slot) throw new Error('未知纹理槽位');
  if (!file || file.type !== 'image/png') throw new Error('请上传 PNG 图片');
  if (file.size <= 0) throw new Error('图片文件为空');
  if (file.size > MAX_FILE_SIZE) throw new Error('单张纹理不能超过 2MB');
  return slot;
}

export class TextureManager {
  constructor() {
    this.images = new Map();
    this.records = new Map();
    this.db = null;
    this.persistenceAvailable = true;
  }

  async init() {
    if (typeof indexedDB === 'undefined') {
      this.persistenceAvailable = false;
      return;
    }

    try {
      this.db = await this._openDatabase();
      const records = await this._readAll();
      for (const record of records) {
        try {
          const image = await this._decodeAndValidate(record.blob, record.slotId);
          this.records.set(record.slotId, record);
          this.images.set(record.slotId, image);
        } catch {
          await this._deleteRecord(record.slotId);
        }
      }
      this._writeManifest();
    } catch (error) {
      console.warn('纹理持久化不可用，将使用本次会话素材:', error);
      this.persistenceAvailable = false;
      this.db = null;
    }
  }

  getImage(slotId) {
    return this.images.get(slotId) || null;
  }

  resolveImage(slotIds) {
    for (const slotId of slotIds) {
      const image = this.getImage(slotId);
      if (image) return image;
    }
    return null;
  }

  getRecord(slotId) {
    return this.records.get(slotId) || null;
  }

  listInstalled() {
    return [...this.records.values()].map(({ blob, ...metadata }) => ({ ...metadata }));
  }

  async install(slotId, file) {
    const slot = validateTextureFile(file, slotId);
    const image = await this._decodeAndValidate(file, slotId);
    const dimensions = readImageDimensions(image);
    const record = {
      slotId,
      name: file.name || `${slotId}.png`,
      type: 'image/png',
      size: file.size,
      width: dimensions.width,
      height: dimensions.height,
      updatedAt: Date.now(),
      blob: file,
    };

    if (this.db) await this._putRecord(record);
    this.records.set(slotId, record);
    this.images.set(slotId, image);
    this._writeManifest();
    bus.emit('textures:changed', { slotId, action: 'installed' });
    return { ...record, blob: undefined };
  }

  async remove(slotId) {
    if (!getTextureSlot(slotId)) throw new Error('未知纹理槽位');
    if (this.db) await this._deleteRecord(slotId);
    const image = this.images.get(slotId);
    if (image?.close) image.close();
    this.images.delete(slotId);
    this.records.delete(slotId);
    this._writeManifest();
    bus.emit('textures:changed', { slotId, action: 'removed' });
  }

  async clearAll() {
    if (this.db) {
      await new Promise((resolve, reject) => {
        const request = this.db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear();
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
      });
    }
    for (const image of this.images.values()) image.close?.();
    this.images.clear();
    this.records.clear();
    this._writeManifest();
    bus.emit('textures:changed', { action: 'cleared' });
  }

  async exportPack(name = '我的纹理包') {
    const entries = [];
    for (const record of this.records.values()) {
      entries.push({
        slotId: record.slotId,
        name: record.name,
        width: record.width,
        height: record.height,
        dataUrl: await blobToDataUrl(record.blob),
      });
    }
    return new Blob([JSON.stringify({ format: 'stardust-texture-pack', version: 1, name, entries })], { type: 'application/json' });
  }

  async importPack(file) {
    if (!file || file.type !== 'application/json') throw new Error('请导入 JSON 纹理包');
    const pack = JSON.parse(await file.text());
    if (pack?.format !== 'stardust-texture-pack' || pack.version !== 1 || !Array.isArray(pack.entries)) {
      throw new Error('纹理包格式不受支持');
    }

    const pending = [];
    for (const entry of pack.entries) {
      const slot = getTextureSlot(entry.slotId);
      if (!slot) throw new Error(`纹理包包含未知槽位：${entry.slotId}`);
      const blob = dataUrlToBlob(entry.dataUrl);
      validateTextureFile(blob, entry.slotId);
      const image = await this._decodeAndValidate(blob, entry.slotId);
      const dimensions = readImageDimensions(image);
      pending.push({
        slotId: entry.slotId,
        name: entry.name || `${entry.slotId}.png`,
        type: 'image/png',
        size: blob.size,
        width: dimensions.width,
        height: dimensions.height,
        updatedAt: Date.now(),
        blob,
        image,
      });
    }

    if (this.db) {
      await new Promise((resolve, reject) => {
        const transaction = this.db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        for (const record of pending) store.put(recordWithoutImage(record));
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('导入纹理包失败'));
      });
    }

    for (const record of pending) {
      this.images.get(record.slotId)?.close?.();
      this.records.set(record.slotId, recordWithoutImage(record));
      this.images.set(record.slotId, record.image);
    }
    this._writeManifest();
    bus.emit('textures:changed', { action: 'imported', count: pending.length });
    return { count: pending.length, name: pack.name || '未命名纹理包' };
  }

  _writeManifest() {
    saveManifest(this.listInstalled());
  }

  _openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'slotId' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  _readAll() {
    return new Promise((resolve, reject) => {
      const request = this.db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  _putRecord(record) {
    return new Promise((resolve, reject) => {
      const request = this.db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(record);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  }

  _deleteRecord(slotId) {
    return new Promise((resolve, reject) => {
      const request = this.db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(slotId);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  }

  async _decodeAndValidate(blob, slotId) {
    const image = await decodeBlob(blob);
    const { width, height } = readImageDimensions(image);
    if (!width || !height || width > MAX_DIMENSION || height > MAX_DIMENSION) {
      image.close?.();
      throw new Error('图片尺寸必须在 1×1 到 1024×1024 之间');
    }
    const slot = getTextureSlot(slotId);
    if (slot.kind === 'sprite' && (width % SPRITE_COLUMNS !== 0 || height % SPRITE_ROWS !== 0)) {
      image.close?.();
      throw new Error('角色精灵表必须能均分为 3 列×4 行');
    }
    return image;
  }
}

function recordWithoutImage(record) {
  const { image, ...stored } = record;
  return stored;
}

export const textureManager = new TextureManager();
