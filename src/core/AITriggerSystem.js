import { BALANCE } from '../data/balance.js';

export function createAITriggerState(value = {}) {
  return {
    milestones: [...(value.milestones || [])],
    shortages: { ...(value.shortages || {}) },
    lastTriggered: { ...(value.lastTriggered || {}) },
  };
}

export function recordMilestone(state, key) {
  if (state.milestones.includes(key)) return false;
  state.milestones.push(key);
  return true;
}

export function updateShortages(state, resources, day, config = BALANCE.aiTriggers) {
  const due = [];
  for (const [resource, threshold] of Object.entries(config.shortageThresholds)) {
    const entry = state.shortages[resource] || { days: 0, lastTriggeredDay: -Infinity };
    if ((resources[resource] ?? Infinity) < threshold) entry.days += 1;
    else entry.days = 0;
    if (entry.days === config.shortageDays && day - entry.lastTriggeredDay >= config.shortageCooldownDays) {
      entry.lastTriggeredDay = day;
      due.push(resource);
    }
    state.shortages[resource] = entry;
  }
  return due;
}

export function canCreateProposal(state, type, day, pendingCount, config = BALANCE.aiTriggers) {
  if (pendingCount >= config.proposalLimit) return false;
  const cooldown = type === 'combo_proposal' ? config.comboCooldownDays : type === 'species_proposal' ? config.speciesCooldownDays : config.buildingCooldownDays;
  return day - (state.lastTriggered[type] ?? -Infinity) >= cooldown;
}

export function markTriggered(state, type, day) {
  state.lastTriggered[type] = day;
}
