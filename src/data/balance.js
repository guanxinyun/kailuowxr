import { currentBalance } from '../core/DynamicBalanceManager.js';

/**
 * 动态代理 BALANCE 对象
 * 核心系统读取 BALANCE 时，透明路由至当前调制的 currentBalance
 */
export const BALANCE = new Proxy({}, {
  get(_, prop) {
    return currentBalance[prop];
  },
  set(_, prop, value) {
    currentBalance[prop] = value;
    return true;
  },
  has(_, prop) {
    return prop in currentBalance;
  },
  ownKeys(_) {
    return Reflect.ownKeys(currentBalance);
  },
  getOwnPropertyDescriptor(_, prop) {
    return {
      configurable: true,
      enumerable: true,
      value: currentBalance[prop],
      writable: true,
    };
  },
});
