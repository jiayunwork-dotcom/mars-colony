import { v4 as uuidv4 } from 'uuid';
import { GameState, ActiveDisaster, DisasterType, HexTile, Player } from '../types/game';
import { DISASTER_CONFIG } from './constants';
import { getNeighbors, coordKey, getPlayerTiles } from './hexGrid';
import { processColonistHealth } from './population';

export function rollDisasters(state: GameState): ActiveDisaster[] {
  const newDisasters: ActiveDisaster[] = [];
  const isSummer = state.season === 0 || state.season === 1;
  const isSunActive = state.sunActivityCycle >= 8 && state.sunActivityCycle <= 12;

  for (const disasterType of Object.keys(DISASTER_CONFIG) as DisasterType[]) {
    const config = DISASTER_CONFIG[disasterType];
    let probability = config.baseProbability;

    if (disasterType === 'sandstorm' && isSummer) {
      probability *= 2;
    }
    if (disasterType === 'radiation_storm' && isSunActive) {
      probability *= 2;
    }

    const alreadyActive = state.activeDisasters.some(d => d.type === disasterType);
    if (alreadyActive) continue;

    if (Math.random() < probability) {
      const duration = Math.floor(
        Math.random() * (config.maxDuration - config.minDuration + 1)
      ) + config.minDuration;

      let affectedTiles: { q: number; r: number }[] = [];

      if (disasterType === 'sandstorm' || disasterType === 'radiation_storm') {
        affectedTiles = Array.from(state.map.tiles.values()).map(t => ({ q: t.coord.q, r: t.coord.r }));
      } else if (disasterType === 'meteor_impact') {
        const allTiles = Array.from(state.map.tiles.values());
        const randomTile = allTiles[Math.floor(Math.random() * allTiles.length)];
        affectedTiles = [{ q: randomTile.coord.q, r: randomTile.coord.r }];
      } else if (disasterType === 'plague') {
        const inhabitedTiles = Array.from(state.map.tiles.values()).filter(
          t => t.facility?.type === 'habitat' && t.ownerId
        );
        if (inhabitedTiles.length > 0) {
          const startTile = inhabitedTiles[Math.floor(Math.random() * inhabitedTiles.length)];
          affectedTiles = [{ q: startTile.coord.q, r: startTile.coord.r }];
        }
      } else if (disasterType === 'equipment_failure') {
        const allFacilities = Array.from(state.map.tiles.values()).filter(t => t.facility && !t.facility.isDisabled);
        if (allFacilities.length > 0) {
          const randomTile = allFacilities[Math.floor(Math.random() * allFacilities.length)];
          affectedTiles = [{ q: randomTile.coord.q, r: randomTile.coord.r }];
        }
      }

      if (affectedTiles.length > 0) {
        newDisasters.push({
          type: disasterType,
          turnsRemaining: duration,
          affectedTiles,
        });
      }
    }
  }

  return newDisasters;
}

export function applyDisasterEffects(state: GameState): void {
  for (const disaster of state.activeDisasters) {
    switch (disaster.type) {
      case 'equipment_failure':
        for (const coord of disaster.affectedTiles) {
          const tile = state.map.tiles.get(`${coord.q},${coord.r}`);
          if (tile?.facility) {
            tile.facility.isDisabled = true;
            tile.facility.disabledTurns = 1;
          }
        }
        break;

      case 'sandstorm':
        for (const tile of state.map.tiles.values()) {
          if (tile.facility && !tile.facility.isDisabled) {
            if (tile.terrain === 'canyon') {
              if (Math.random() < 0.3) {
                tile.facility.isDisabled = true;
                tile.facility.disabledTurns = 2;
              }
            } else if (tile.terrain !== 'lava_tube') {
              if (Math.random() < 0.15) {
                tile.facility.isDisabled = true;
                tile.facility.disabledTurns = 1;
              }
            }
          }
        }
        break;

      case 'radiation_storm':
        for (const playerId of Object.keys(state.players)) {
          const player = state.players[playerId];
          const hasMedicalTech = player.research.medical.level >= 2;
          const damage = hasMedicalTech ? 10 : 20;

          processColonistHealth(player, damage, hasMedicalTech);

          for (const tile of state.map.tiles.values()) {
            if (tile.ownerId !== playerId || !tile.facility) continue;
            if (tile.terrain !== 'lava_tube' && tile.facility.type !== 'habitat') {
              const deathChance = hasMedicalTech ? 0.05 : 0.1;
              const workersInFacility = player.population.colonists.filter(
                c => c.assignedFacility &&
                  c.assignedFacility.q === tile.coord.q &&
                  c.assignedFacility.r === tile.coord.r
              );
              for (const worker of workersInFacility) {
                if (Math.random() < deathChance) {
                  worker.health = 0;
                }
              }
            }
          }

          player.population.colonists = player.population.colonists.filter(c => c.health > 0);
        }
        break;

      case 'plague':
        const newAffected: { q: number; r: number }[] = [];
        for (const coord of disaster.affectedTiles) {
          const tile = state.map.tiles.get(`${coord.q},${coord.r}`);
          if (tile?.facility?.type === 'habitat' && tile.ownerId) {
            const player = state.players[tile.ownerId];
            const workersInHabitat = player.population.colonists.filter(
              c => c.assignedFacility &&
                c.assignedFacility.q === coord.q &&
                c.assignedFacility.r === coord.r
            );
            for (const w of workersInHabitat) {
              if (!w.isSick && Math.random() < 0.5) {
                w.isSick = true;
              }
            }

            const neighbors = getNeighbors(coord);
            for (const n of neighbors) {
              const nTile = state.map.tiles.get(`${n.q},${n.r}`);
              if (nTile?.facility?.type === 'habitat' && nTile.ownerId) {
                if (!disaster.affectedTiles.some(t => t.q === n.q && t.r === n.r) &&
                    !newAffected.some(t => t.q === n.q && t.r === n.r)) {
                  if (Math.random() < 0.3) {
                    newAffected.push({ q: n.q, r: n.r });
                  }
                }
              }
            }
          }
        }
        disaster.affectedTiles.push(...newAffected);

        for (const playerId of Object.keys(state.players)) {
          const player = state.players[playerId];
          if (player.research.medical.level >= 2) {
            for (const c of player.population.colonists) {
              if (c.isSick && Math.random() < 0.4) {
                c.isSick = false;
              }
            }
          }
        }
        break;

      case 'meteor_impact':
        for (const coord of disaster.affectedTiles) {
          const tile = state.map.tiles.get(`${coord.q},${coord.r}`);
          if (tile) {
            if (tile.ownerId) {
              const player = state.players[tile.ownerId];
              player.population.colonists = player.population.colonists.filter(
                c => !(c.assignedFacility &&
                  c.assignedFacility.q === coord.q &&
                  c.assignedFacility.r === coord.r)
              );
            }
            tile.facility = null;
            tile.ownerId = null;
          }
        }
        break;
    }
  }
}

export function decrementDisasters(state: GameState): void {
  const expired: ActiveDisaster[] = [];

  state.activeDisasters = state.activeDisasters.filter(d => {
    d.turnsRemaining--;
    if (d.turnsRemaining <= 0) {
      expired.push(d);
      return false;
    }
    return true;
  });

  for (const d of expired) {
    if (d.type === 'equipment_failure') {
      for (const coord of d.affectedTiles) {
        const tile = state.map.tiles.get(`${coord.q},${coord.r}`);
        if (tile?.facility) {
          tile.facility.isDisabled = false;
          tile.facility.disabledTurns = 0;
        }
      }
    }
  }

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
        const tile = state.map.tiles.get(`${coord.q},${coord.r}`);
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
