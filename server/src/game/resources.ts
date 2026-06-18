import { Resources, ResourceType, FacilityType, HexCoord, GameState, Player, HexTile } from '../types/game';
import { FACILITY_CONFIG, TERRAIN_CONFIG } from './constants';
import { getTile, getTilesWithinRadius, hexDistance, coordKey } from './hexGrid';

export function createEmptyResources(): Resources {
  return {
    oxygen: 0,
    water: 0,
    food: 0,
    power: 0,
    materials: 0,
    fuel: 0,
    rare_minerals: 0,
  };
}

export function addResources(a: Resources, b: Partial<Resources>): Resources {
  const result = { ...a };
  for (const key of Object.keys(b) as ResourceType[]) {
    result[key] = (result[key] || 0) + (b[key] || 0);
  }
  return result;
}

export function subtractResources(a: Resources, b: Partial<Resources>): Resources {
  const result = { ...a };
  for (const key of Object.keys(b) as ResourceType[]) {
    result[key] = (result[key] || 0) - (b[key] || 0);
  }
  return result;
}

export function hasEnoughResources(a: Resources, b: Partial<Resources>): boolean {
  for (const key of Object.keys(b) as ResourceType[]) {
    if ((a[key] || 0) < (b[key] || 0)) return false;
  }
  return true;
}

export function multiplyResources(r: Partial<Resources>, multiplier: number): Partial<Resources> {
  const result: Partial<Resources> = {};
  for (const key of Object.keys(r) as ResourceType[]) {
    result[key] = Math.floor((r[key] || 0) * multiplier);
  }
  return result;
}

export function calculateFacilityProduction(
  state: GameState,
  tile: HexTile,
  player: Player
): Partial<Resources> {
  if (!tile.facility || !tile.facility.isActive || tile.facility.isDisabled) {
    return {};
  }

  const facility = tile.facility;
  const config = FACILITY_CONFIG[facility.type];
  const terrainConfig = TERRAIN_CONFIG[tile.terrain];
  const production = { ...config.production };

  let workerMultiplier = 1;
  const totalWorkers = Object.values(facility.workers).reduce((a, b) => a + b, 0);
  if (totalWorkers < config.requiredWorkers) {
    workerMultiplier = config.requiredWorkers > 0 ? totalWorkers / config.requiredWorkers : 1;
  }

  const optimalWorkers = facility.workers[config.optimalProfession] || 0;
  if (optimalWorkers > 0) {
    workerMultiplier += 0.5 * (optimalWorkers / Math.max(totalWorkers, 1));
  }

  if (player.population.morale < 30) {
    workerMultiplier *= 0.5;
  }

  for (const key of Object.keys(production) as ResourceType[]) {
    let value = production[key] || 0;
    value = Math.floor(value * workerMultiplier);

    if (terrainConfig.resourceMultipliers[key]) {
      value = Math.floor(value * terrainConfig.resourceMultipliers[key]!);
    }

    if (key === 'power' && tile.terrain === 'polar' && facility.type === 'solar_array') {
      value = Math.floor(value * 0.4);
    }

    const sandstorm = state.activeDisasters.find(d => d.type === 'sandstorm');
    if (sandstorm && key === 'power' && facility.type === 'solar_array') {
      value = Math.floor(value * 0.2);
    }

    if (facility.type === 'greenhouse' && key !== 'power') {
      let hasWaterRecycling = false;
      const nearbyTiles = getTilesWithinRadius(tile.coord, 2);
      for (const nearCoord of nearbyTiles) {
        const nearTile = getTile(state.map, nearCoord);
        if (nearTile?.facility?.type === 'water_recycling' && nearTile.ownerId === tile.ownerId) {
          hasWaterRecycling = true;
          break;
        }
      }
      if (!hasWaterRecycling) {
        value = Math.floor(value * 0.5);
      }
    }

    production[key] = value;
  }

  return production;
}

export function calculateFacilityConsumption(
  state: GameState,
  tile: HexTile
): Partial<Resources> {
  if (!tile.facility || !tile.facility.isActive || tile.facility.isDisabled) {
    return {};
  }

  const facility = tile.facility;
  const config = FACILITY_CONFIG[facility.type];
  const consumption = { ...config.maintenance };

  delete consumption.power;

  if (config.powerConsumption > 0) {
    consumption.power = config.powerConsumption;
  }

  return consumption;
}

export function getFacilityBuildCost(
  facilityType: FacilityType,
  terrain: string,
  player: Player
): Partial<Resources> {
  const config = FACILITY_CONFIG[facilityType];
  const terrainConfig = TERRAIN_CONFIG[terrain as keyof typeof TERRAIN_CONFIG];
  let cost = { ...config.buildCost };

  if (terrainConfig?.buildCostMultiplier) {
    cost = multiplyResources(cost, terrainConfig.buildCostMultiplier) as Resources;
  }

  const materialsLevel = player.research.materials.level;
  if (materialsLevel >= 1) {
    cost = multiplyResources(cost, 1 - 0.1 * materialsLevel) as Resources;
  }

  return cost;
}

export function validateFacilityPlacement(
  state: GameState,
  coord: HexCoord,
  facilityType: FacilityType,
  playerId: string
): { valid: boolean; reason?: string } {
  const tile = getTile(state.map, coord);
  if (!tile) return { valid: false, reason: '无效的坐标' };
  if (tile.ownerId !== playerId && tile.ownerId !== null) {
    return { valid: false, reason: '该地块已被其他玩家占领' };
  }
  if (tile.facility) return { valid: false, reason: '该地块已有设施' };

  const terrainConfig = TERRAIN_CONFIG[tile.terrain];
  const playerFacilityCountOnSameTerrain = Array.from(state.map.tiles.values())
    .filter(t =>
      t.ownerId === playerId &&
      t.facility &&
      t.terrain === tile.terrain
    )
    .length;

  if (playerFacilityCountOnSameTerrain >= terrainConfig.maxFacilities) {
    return { valid: false, reason: `${terrainConfig.name}地形最多只能建${terrainConfig.maxFacilities}个设施` };
  }

  if (facilityType === 'habitat' || facilityType === 'greenhouse') {
    for (const t of state.map.tiles.values()) {
      if (!t.facility) continue;
      const fc = FACILITY_CONFIG[t.facility.type];
      if (fc.radiationRadius > 0 && t.ownerId === playerId) {
        if (hexDistance(t.coord, coord) <= fc.radiationRadius) {
          return { valid: false, reason: '距离核反应堆太近，存在辐射风险' };
        }
      }
    }
  }

  const config = FACILITY_CONFIG[facilityType];
  if (config.researchRequired) {
    const progress = playerId ? state.players[playerId]?.research[config.researchRequired.branch] : null;
    if (!progress || progress.level < config.researchRequired.level) {
      return { valid: false, reason: '需要先研究对应科技' };
    }
  }

  return { valid: true };
}
