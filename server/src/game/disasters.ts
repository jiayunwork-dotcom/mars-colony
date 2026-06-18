import { v4 as uuidv4 } from 'uuid';
import {
  GameState,
  ActiveDisaster,
  DisasterType,
  DisasterWarning,
  WarningLevel,
  DisasterSettlement,
  DisasterHistoryEntry,
  HexCoord,
  FacilityType,
} from '../types/game';
import { DISASTER_CONFIG, BASE_WARNING_TURNS, FACILITY_CONFIG } from './constants';
import { getTilesWithinRadius, coordKey, hexDistance } from './hexGrid';

export function calculateSatelliteWarningBonus(state: GameState): number {
  let bonus = 0;
  let satelliteCount = 0;
  for (const tile of state.map.tiles.values()) {
    if (tile.facility?.type === 'weather_satellite' && !tile.facility.isDisabled) {
      satelliteCount++;
    }
  }
  if (satelliteCount >= 1) bonus += 1;
  if (satelliteCount >= 2) bonus += Math.floor(0.5);
  return bonus;
}

export function getWarningLevel(turnsUntilArrival: number): WarningLevel {
  if (turnsUntilArrival <= 1) return 'red';
  if (turnsUntilArrival <= 2) return 'orange';
  return 'yellow';
}

export function rollDisasterWarnings(state: GameState): DisasterWarning[] {
  const newWarnings: DisasterWarning[] = [];
  const satelliteBonus = calculateSatelliteWarningBonus(state);
  const totalWarningTurns = BASE_WARNING_TURNS + satelliteBonus;

  for (const disasterType of Object.keys(DISASTER_CONFIG) as DisasterType[]) {
    const config = DISASTER_CONFIG[disasterType];
    const isSummer = state.season === 0 || state.season === 1;
    const isSunActive = state.sunActivityCycle >= 8 && state.sunActivityCycle <= 12;

    let probability = config.baseProbability;
    if (disasterType === 'sandstorm' && isSummer) probability *= 2;
    if (disasterType === 'solar_flare' && isSunActive) probability *= 2;
    if (disasterType === 'cold_storm' && !isSummer) probability *= 1.5;

    const alreadyWarned = state.disasterWarnings.some(w => w.disasterType === disasterType);
    const alreadyActive = state.activeDisasters.some(d => d.type === disasterType);
    if (alreadyWarned || alreadyActive) continue;

    if (Math.random() < probability) {
      const center = pickDisasterCenter(state, disasterType);
      if (!center) continue;

      const radius = config.radius;
      const affectedTiles = getTilesWithinRadius(center, radius).filter(c =>
        state.map.tiles.has(coordKey(c))
      );

      const estimatedLosses = estimateLosses(state, affectedTiles, disasterType);

      newWarnings.push({
        id: uuidv4(),
        disasterType,
        warningLevel: getWarningLevel(totalWarningTurns),
        turnsUntilArrival: totalWarningTurns,
        estimatedCenter: center,
        estimatedRadius: radius,
        affectedTiles,
        estimatedLosses,
      });
    }
  }

  return newWarnings;
}

function pickDisasterCenter(state: GameState, disasterType: DisasterType): HexCoord | null {
  const allTiles = Array.from(state.map.tiles.values());
  if (allTiles.length === 0) return null;

  if (disasterType === 'earthquake') {
    const edges = allTiles.filter(t => {
      const dist = hexDistance(t.coord, { q: 0, r: 0 });
      return dist >= state.map.radius - 2;
    });
    if (edges.length > 0) {
      return edges[Math.floor(Math.random() * edges.length)].coord;
    }
  }

  const randomTile = allTiles[Math.floor(Math.random() * allTiles.length)];
  return randomTile.coord;
}

function estimateLosses(
  state: GameState,
  affectedTiles: HexCoord[],
  _disasterType: DisasterType
) {
  let buildingsAtRisk = 0;
  let populationAtRisk = 0;

  for (const coord of affectedTiles) {
    const tile = state.map.tiles.get(coordKey(coord));
    if (!tile || !tile.facility) continue;
    const shielded = isTileShielded(state, coord);
    if (shielded) continue;
    buildingsAtRisk++;
    if (tile.ownerId) {
      const player = state.players[tile.ownerId];
      if (player) {
        const workersHere = player.population.colonists.filter(
          c => c.assignedFacility &&
            c.assignedFacility.q === coord.q &&
            c.assignedFacility.r === coord.r
        ).length;
        populationAtRisk += workersHere;
      }
    }
  }

  return {
    buildingsAtRisk,
    populationAtRisk,
    resourceLoss: {},
  };
}

function isTileShielded(state: GameState, coord: HexCoord): boolean {
  for (const tile of state.map.tiles.values()) {
    if (tile.facility?.type === 'shield_generator' && !tile.facility.isDisabled && tile.facility.durability > 0) {
      const radius = FACILITY_CONFIG.shield_generator.shieldRadius || 1;
      if (hexDistance(tile.coord, coord) <= radius) {
        return true;
      }
    }
  }
  return false;
}

function getShieldStrength(state: GameState, coord: HexCoord): number {
  let maxStrength = 0;
  for (const tile of state.map.tiles.values()) {
    if (tile.facility?.type === 'shield_generator' && !tile.facility.isDisabled && tile.facility.durability > 0) {
      const radius = FACILITY_CONFIG.shield_generator.shieldRadius || 1;
      if (hexDistance(tile.coord, coord) <= radius) {
        const strength = tile.facility.durability / tile.facility.maxDurability;
        if (strength > maxStrength) {
          maxStrength = strength;
        }
      }
    }
  }
  return maxStrength;
}

function isTileGreenhouseCovered(state: GameState, coord: HexCoord): boolean {
  const tile = state.map.tiles.get(coordKey(coord));
  if (tile?.facility?.type === 'greenhouse') return true;
  for (const neighbor of getNeighborsWithin(coord, 1)) {
    const nTile = state.map.tiles.get(coordKey(neighbor));
    if (nTile?.facility?.type === 'greenhouse') return true;
  }
  return false;
}

function getNeighborsWithin(coord: HexCoord, radius: number): HexCoord[] {
  const results: HexCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      if (q === 0 && r === 0) continue;
      results.push({ q: coord.q + q, r: coord.r + r });
    }
  }
  return results;
}

function getEarthquakeLineTiles(state: GameState, center: HexCoord): HexCoord[] {
  const tiles: HexCoord[] = [];
  const directions = [
    { q: 1, r: 0 },
    { q: -1, r: 0 },
  ];

  tiles.push(center);

  for (const dir of directions) {
    for (let dist = 1; dist <= 3; dist++) {
      const coord = { q: center.q + dir.q * dist, r: center.r + dir.r * dist };
      if (state.map.tiles.has(coordKey(coord))) {
        tiles.push(coord);
      }
    }
  }

  return tiles;
}

export function advanceWarningsAndCollectArrived(state: GameState): DisasterWarning[] {
  const arrived: DisasterWarning[] = [];
  state.disasterWarnings = state.disasterWarnings.filter(w => {
    w.turnsUntilArrival--;
    w.warningLevel = getWarningLevel(w.turnsUntilArrival);
    if (w.turnsUntilArrival <= 0) {
      arrived.push(w);
      return false;
    }
    return true;
  });
  return arrived;
}

export function convertArrivedWarningsToDisasters(
  state: GameState,
  arrivedWarnings: DisasterWarning[]
): ActiveDisaster[] {
  const newDisasters: ActiveDisaster[] = [];

  for (const warning of arrivedWarnings) {
    const config = DISASTER_CONFIG[warning.disasterType];
    const duration = Math.floor(
      Math.random() * (config.maxDuration - config.minDuration + 1)
    ) + config.minDuration;

    let affectedTiles = warning.affectedTiles;
    if (warning.disasterType === 'earthquake') {
      affectedTiles = getEarthquakeLineTiles(state, warning.estimatedCenter);
    }

    newDisasters.push({
      id: uuidv4(),
      type: warning.disasterType,
      turnsRemaining: duration,
      affectedTiles,
      center: warning.estimatedCenter,
      radius: warning.estimatedRadius,
    });
  }

  return newDisasters;
}

export function applyTriggeredDisasterEffects(
  state: GameState,
  triggeredDisasters: ActiveDisaster[]
): DisasterSettlement[] {
  const settlements: DisasterSettlement[] = [];
  for (const disaster of triggeredDisasters) {
    const settlement = applySingleDisaster(state, disaster);
    settlements.push(settlement);
  }
  return settlements;
}

export function processOngoingDisasterEffects(state: GameState): void {
  for (const disaster of state.activeDisasters) {
    if (disaster.type === 'toxic_gas') {
      for (const coord of disaster.affectedTiles) {
        const tile = state.map.tiles.get(coordKey(coord));
        if (!tile || !tile.ownerId) continue;
        if (isTileShielded(state, coord)) continue;
        if (isTileGreenhouseCovered(state, coord)) continue;

        const player = state.players[tile.ownerId];
        if (!player) continue;

        const casualties = killUnprotectedPopulation(state, player, coord, 0.2);
        if (casualties.killed > 0 && tile.facility) {
          const damage = Math.floor(tile.facility.maxDurability * 0.05);
          tile.facility.durability = Math.max(0, tile.facility.durability - damage);
          if (tile.facility.durability <= 0) {
            removeFacility(state, coord, tile);
          }
        }
      }
    }
  }
}

function applySingleDisaster(state: GameState, disaster: ActiveDisaster): DisasterSettlement {
  const settlement: DisasterSettlement = {
    id: uuidv4(),
    disasterType: disaster.type,
    center: disaster.center,
    radius: disaster.radius,
    turn: state.currentTurn,
    buildingsDestroyed: [],
    buildingsDamaged: [],
    populationCasualties: 0,
    populationSavedByShelter: 0,
    resourcesLost: {},
    productionInterrupted: [],
    defenseSuccesses: [],
    shieldedTiles: [],
  };

  for (const coord of disaster.affectedTiles) {
    const tile = state.map.tiles.get(coordKey(coord));
    if (!tile) continue;

    if (isTileShielded(state, coord)) {
      settlement.shieldedTiles.push(coord);
      for (const sTile of state.map.tiles.values()) {
        if (sTile.facility?.type === 'shield_generator' && !sTile.facility.isDisabled && sTile.facility.durability > 0) {
          const radius = FACILITY_CONFIG.shield_generator.shieldRadius || 1;
          if (hexDistance(sTile.coord, coord) <= radius) {
            const durabilityLoss = 20;
            sTile.facility.durability = Math.max(0, sTile.facility.durability - durabilityLoss);
            settlement.defenseSuccesses.push({
              coord: sTile.coord,
              defenseType: 'shield_generator',
              damageAbsorbed: durabilityLoss,
            });
            if (sTile.facility.durability <= 0) {
              sTile.facility = null;
            }
            break;
          }
        }
      }
      continue;
    }

    switch (disaster.type) {
      case 'sandstorm':
        applySandstorm(state, coord, tile, settlement);
        break;
      case 'meteor_impact':
        applyMeteorImpact(state, coord, tile, settlement);
        break;
      case 'cold_storm':
        applyColdStorm(state, coord, tile, settlement);
        break;
      case 'earthquake':
        applyEarthquake(state, coord, tile, settlement);
        break;
      case 'solar_flare':
        applySolarFlare(state, coord, tile, settlement);
        break;
      case 'toxic_gas':
        applyToxicGas(state, coord, tile, settlement);
        break;
    }
  }

  return settlement;
}

function applySandstorm(
  state: GameState,
  coord: HexCoord,
  tile: typeof state.map.tiles extends Map<string, infer V> ? V : never,
  settlement: DisasterSettlement
): void {
  if (!tile.facility) return;

  if (tile.facility.type === 'solar_array') {
    tile.facility.isDisabled = true;
    tile.facility.disabledTurns = 3;
    settlement.productionInterrupted.push({
      coord,
      facilityType: 'solar_array',
      turnsInterrupted: 3,
    });
  }

  if (tile.terrain !== 'lava_tube' && Math.random() < 0.15) {
    const damage = Math.floor(tile.facility.maxDurability * 0.1);
    tile.facility.durability -= damage;
    settlement.buildingsDamaged.push({
      coord,
      facilityType: tile.facility.type,
      ownerId: tile.ownerId || '',
      durabilityLost: damage,
    });
    if (tile.facility.durability <= 0) {
      settlement.buildingsDestroyed.push({
        coord,
        facilityType: tile.facility.type,
        ownerId: tile.ownerId || '',
      });
      removeFacility(state, coord, tile);
    }
  }
}

function applyMeteorImpact(
  state: GameState,
  coord: HexCoord,
  tile: typeof state.map.tiles extends Map<string, infer V> ? V : never,
  settlement: DisasterSettlement
): void {
  if (!tile.facility) return;

  if (tile.ownerId) {
    const player = state.players[tile.ownerId];
    if (player) {
      const casualties = killUnprotectedPopulation(state, player, coord, 1.0);
      settlement.populationCasualties += casualties.killed;
      settlement.populationSavedByShelter += casualties.saved;
    }
  }

  settlement.buildingsDestroyed.push({
    coord,
    facilityType: tile.facility.type,
    ownerId: tile.ownerId || '',
  });
  removeFacility(state, coord, tile);
}

function applyColdStorm(
  state: GameState,
  coord: HexCoord,
  tile: typeof state.map.tiles extends Map<string, infer V> ? V : never,
  settlement: DisasterSettlement
): void {
  if (!tile.facility) return;

  if (tile.facility.type === 'water_recycling') {
    tile.facility.isDisabled = true;
    tile.facility.disabledTurns = 2;
    settlement.productionInterrupted.push({
      coord,
      facilityType: 'water_recycling',
      turnsInterrupted: 2,
    });
  }

  if (Math.random() < 0.25) {
    const damage = Math.floor(tile.facility.maxDurability * 0.2);
    tile.facility.durability -= damage;
    settlement.buildingsDamaged.push({
      coord,
      facilityType: tile.facility.type,
      ownerId: tile.ownerId || '',
      durabilityLost: damage,
    });
    if (tile.facility.durability <= 0) {
      settlement.buildingsDestroyed.push({
        coord,
        facilityType: tile.facility.type,
        ownerId: tile.ownerId || '',
      });
      removeFacility(state, coord, tile);
    }
  }
}

function applyEarthquake(
  state: GameState,
  coord: HexCoord,
  tile: typeof state.map.tiles extends Map<string, infer V> ? V : never,
  settlement: DisasterSettlement
): void {
  if (!tile.facility) return;

  const damage = Math.floor(tile.facility.maxDurability * 0.5);
  tile.facility.durability -= damage;
  settlement.buildingsDamaged.push({
    coord,
    facilityType: tile.facility.type,
    ownerId: tile.ownerId || '',
    durabilityLost: damage,
  });

  if (tile.facility.durability <= 0) {
    settlement.buildingsDestroyed.push({
      coord,
      facilityType: tile.facility.type,
      ownerId: tile.ownerId || '',
    });
    removeFacility(state, coord, tile);
  }
}

function applySolarFlare(
  state: GameState,
  coord: HexCoord,
  tile: typeof state.map.tiles extends Map<string, infer V> ? V : never,
  settlement: DisasterSettlement
): void {
  if (!tile.facility) return;

  if (tile.facility.type === 'solar_array' || tile.facility.type === 'weather_satellite') {
    const damage = Math.floor(tile.facility.maxDurability * 0.6);
    tile.facility.durability -= damage;
    settlement.buildingsDamaged.push({
      coord,
      facilityType: tile.facility.type,
      ownerId: tile.ownerId || '',
      durabilityLost: damage,
    });
    if (tile.facility.durability <= 0) {
      settlement.buildingsDestroyed.push({
        coord,
        facilityType: tile.facility.type,
        ownerId: tile.ownerId || '',
      });
      removeFacility(state, coord, tile);
    }
  }
}

function applyToxicGas(
  state: GameState,
  coord: HexCoord,
  tile: typeof state.map.tiles extends Map<string, infer V> ? V : never,
  settlement: DisasterSettlement
): void {
  if (!tile.facility) return;

  if (isTileGreenhouseCovered(state, coord)) return;

  if (tile.ownerId) {
    const player = state.players[tile.ownerId];
    if (player) {
      const casualties = killUnprotectedPopulation(state, player, coord, 0.3);
      settlement.populationCasualties += casualties.killed;
      settlement.populationSavedByShelter += casualties.saved;
    }
  }

  const damage = Math.floor(tile.facility.maxDurability * 0.1);
  tile.facility.durability -= damage;
  if (damage > 0) {
    settlement.buildingsDamaged.push({
      coord,
      facilityType: tile.facility.type,
      ownerId: tile.ownerId || '',
      durabilityLost: damage,
    });
  }
  if (tile.facility.durability <= 0) {
    settlement.buildingsDestroyed.push({
      coord,
      facilityType: tile.facility.type,
      ownerId: tile.ownerId || '',
    });
    removeFacility(state, coord, tile);
  }
}

interface CasualtyResult {
  killed: number;
  saved: number;
}

function killUnprotectedPopulation(
  state: GameState,
  player: typeof state.players[string],
  coord: HexCoord,
  killChance: number
): CasualtyResult {
  const workersHere = player.population.colonists.filter(
    c => c.assignedFacility &&
      c.assignedFacility.q === coord.q &&
      c.assignedFacility.r === coord.r
  );

  let killed = 0;
  let saved = 0;
  let shelterCapacity = getAvailableShelterCapacity(state, player.id);

  for (const worker of workersHere) {
    if (shelterCapacity > 0) {
      shelterCapacity--;
      saved++;
    } else if (Math.random() < killChance) {
      worker.health = 0;
      killed++;
    }
  }

  player.population.colonists = player.population.colonists.filter(c => c.health > 0);
  return { killed, saved };
}

function getAvailableShelterCapacity(state: GameState, playerId: string): number {
  let totalCapacity = 0;
  for (const tile of state.map.tiles.values()) {
    if (tile.facility?.type === 'shelter' && tile.ownerId === playerId && !tile.facility.isDisabled && tile.facility.durability > 0) {
      totalCapacity += tile.facility.shelterCapacity || FACILITY_CONFIG.shelter.shelterCapacity || 20;
    }
  }
  return totalCapacity;
}

function removeFacility(
  state: GameState,
  coord: HexCoord,
  tile: typeof state.map.tiles extends Map<string, infer V> ? V : never
): void {
  if (tile.ownerId && tile.facility?.type === 'habitat') {
    const player = state.players[tile.ownerId];
    if (player) {
      player.population.habitatCapacity -= FACILITY_CONFIG.habitat.capacityBonus || 10;
    }
  }
  tile.facility = null;
}

export function decrementDisasters(state: GameState): void {
  state.activeDisasters = state.activeDisasters.filter(d => {
    d.turnsRemaining--;
    return d.turnsRemaining > 0;
  });

  for (const tile of state.map.tiles.values()) {
    if (tile.facility && tile.facility.disabledTurns > 0) {
      tile.facility.disabledTurns--;
      if (tile.facility.disabledTurns <= 0) {
        tile.facility.isDisabled = false;
      }
    }
  }
}

export function getActiveDisasterCount(state: GameState, playerId?: string): number {
  let count = 0;
  for (const d of state.activeDisasters) {
    if (playerId) {
      const hasPlayerTile = d.affectedTiles.some(coord => {
        const tile = state.map.tiles.get(coordKey(coord));
        return tile?.ownerId === playerId;
      });
      if (hasPlayerTile) count++;
    } else {
      count++;
    }
  }
  return count;
}

export function advanceSeason(state: GameState): void {
  state.season = (state.season + 1) % 4;
  state.sunActivityCycle = (state.sunActivityCycle % 12) + 1;
}

export function addSettlementToHistory(state: GameState, settlement: DisasterSettlement): void {
  const entry: DisasterHistoryEntry = {
    turn: settlement.turn,
    disasterType: settlement.disasterType,
    center: settlement.center,
    settlement,
  };
  state.disasterHistory.push(entry);
  if (state.disasterHistory.length > 10) {
    state.disasterHistory = state.disasterHistory.slice(-10);
  }
}
