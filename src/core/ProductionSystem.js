import { bus } from './EventBus.js';
import { gameState } from './GameState.js';
import { getBuildingById } from '../data/buildings.js';
import { getProductionRecipe, getQuality } from '../data/production.js';
import { getBuildingEfficiency, getBuildingOperationalState } from './BuildingSystem.js';
import { getComboBonus, getComboMultiplier } from './ComboSystem.js';
import { addResidentExperience } from './ResidentGrowthSystem.js';
import { aiClient } from '../ai/AIClient.js';
import { buildProductFacts, getNarrationFallback } from './AIContentFacts.js';

function averageEngineering() {
  const residents = gameState.state.residents || [];
  if (!residents.length) return 1;
  return residents.reduce((sum, resident) => sum + (resident.skills?.engineering || 1), 0) / residents.length;
}

function getOperationalWorkshops() {
  return gameState.state.buildings.filter((building) =>
    building.buildingId === 'workshop' && getBuildingOperationalState(building).operational
  );
}

function getQualityScore() {
  const engineering = averageEngineering();
  const workshopQuality = getOperationalWorkshops().reduce((sum, building) => sum + 12 * getBuildingEfficiency(building), 0);
  return Math.min(100, Math.round((engineering - 1) * 8 + workshopQuality + getComboBonus('production_quality')));
}

export function getProductionState() {
  if (!gameState.state.production) {
    gameState.state.production = { inventory: {}, queue: [], completed: 0 };
  }
  return gameState.state.production;
}

export function getInventoryEntry(productId) {
  const production = getProductionState();
  const stored = production.inventory[productId];
  if (typeof stored === 'number') {
    production.inventory[productId] = { quantity: stored, qualityScore: 0 };
  } else if (!stored) {
    production.inventory[productId] = { quantity: 0, qualityScore: 0 };
  }
  return production.inventory[productId];
}

export function getInventoryQuantity(productId) {
  return getInventoryEntry(productId).quantity;
}

export function getEstimatedProductionQuality() {
  return getQuality(getQualityScore());
}

export function canStartProduction(recipeId) {
  const recipe = getProductionRecipe(recipeId);
  const production = getProductionState();
  if (!recipe) return { ok: false, reason: '找不到这个配方' };
  if (getOperationalWorkshops().length <= 0) return { ok: false, reason: '需要先建造综合工坊' };
  if (production.queue.length >= 3) return { ok: false, reason: '生产队列已满' };
  for (const [resource, amount] of Object.entries(recipe.inputs)) {
    const available = gameState.state.resources[resource] ?? getInventoryQuantity(resource);
    if (available < amount) return { ok: false, reason: `${resource} 不足` };
  }
  return { ok: true, recipe };
}

export function startProduction(recipeId) {
  const validation = canStartProduction(recipeId);
  if (!validation.ok) return validation;
  const { recipe } = validation;
  const production = getProductionState();
  const ingredientScores = Object.keys(recipe.inputs)
    .filter((resource) => !(resource in gameState.state.resources))
    .map((resource) => getInventoryEntry(resource).qualityScore);

  for (const [resource, amount] of Object.entries(recipe.inputs)) {
    if (resource in gameState.state.resources) gameState.addResource(resource, -amount);
    else addInventory(resource, -amount);
  }

  const inheritedQuality = ingredientScores.length
    ? ingredientScores.reduce((sum, score) => sum + score, 0) / ingredientScores.length * 0.35
    : 0;
  const job = {
    id: `job_${gameState.state.day}_${production.completed + production.queue.length + 1}`,
    recipeId,
    startedDay: gameState.state.day,
    remainingDays: recipe.days,
    totalDays: recipe.days,
    qualityScore: Math.min(100, Math.round(getQualityScore() + inheritedQuality)),
  };
  production.queue.push(job);
  bus.emit('production:started', job);
  return { ok: true, job };
}

export function updateProductionSystem() {
  const production = getProductionState();
  if (!production.queue.length) return;
  const workshops = getOperationalWorkshops();
  if (!workshops.length) return;
  const bestWorkshopEfficiency = Math.max(...workshops.map(getBuildingEfficiency));
  const engineeringBonus = Math.max(1, 1 + (averageEngineering() - 1) * 0.04)
    * bestWorkshopEfficiency
    * getComboMultiplier('production_speed');

  for (const job of [...production.queue]) {
    job.remainingDays -= engineeringBonus;
    if (job.remainingDays > 0) continue;
    const recipe = getProductionRecipe(job.recipeId);
    if (!recipe) {
      production.queue = production.queue.filter((entry) => entry !== job);
      continue;
    }
    const quality = getQuality(job.qualityScore);
    addInventory(recipe.output.id, recipe.output.quantity, job.qualityScore);
    production.completed++;
    production.queue = production.queue.filter((entry) => entry !== job);
    const engineer = [...gameState.state.residents]
      .sort((a, b) => (b.skills?.engineering || 0) - (a.skills?.engineering || 0))[0];
    if (engineer) addResidentExperience(engineer, 12, 'engineering', '完成加工订单');
    gameState.addNotification({
      title: '加工完成',
      text: `${recipe.output.name} ×${recipe.output.quantity}（${quality.grade}级）已入库`,
      type: 'success',
      icon: recipe.icon,
    });
    const facts = buildProductFacts(recipe, quality);
    const fallback = () => ({ displayName: recipe.output.name, description: getNarrationFallback('product_copy', facts) });
    bus.emit('production:completed', { job, recipe, quality, copy: fallback() });
    aiClient.generate('product_copy', facts, fallback).then(copy => bus.emit('production:copy', { productId: recipe.output.id, copy }));
  }
}

export function addInventory(productId, quantity, qualityScore = 0) {
  const entry = getInventoryEntry(productId);
  const previousQuantity = entry.quantity;
  const nextQuantity = Math.max(0, previousQuantity + quantity);
  if (quantity > 0 && nextQuantity > 0) {
    entry.qualityScore = Math.round(
      ((entry.qualityScore * previousQuantity) + (qualityScore * quantity)) / nextQuantity,
    );
  }
  entry.quantity = nextQuantity;
  if (nextQuantity === 0) entry.qualityScore = 0;
  bus.emit('production:inventory', { productId, quantity, value: { ...entry } });
}

export function getProductionSummary() {
  const production = getProductionState();
  return {
    workshops: getOperationalWorkshops().length,
    inventory: Object.fromEntries(
      Object.keys(production.inventory).map((id) => [id, { ...getInventoryEntry(id) }]),
    ),
    queue: production.queue.map((job) => ({ ...job, recipe: getProductionRecipe(job.recipeId) })),
    completed: production.completed,
  };
}
