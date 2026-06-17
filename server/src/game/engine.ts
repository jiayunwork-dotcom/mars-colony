import { v4 as uuidv4 } from 'uuid';
import {
  GameState,
  Player,
  Resources,
  FacilityType,
  HexCoord,
  HexTile,
  PlayerAction,
  ResourceType,
  ProfessionType,
  ResearchBranch,
  TerrainType,
} from '../types/game';
import {
  DEFAULT_GAME_SETTINGS,
  FACILITY_CONFIG,
  TERRAIN_CONFIG,
  PLAYER_COLORS,
} from './constants';
import { generateMap, getTile, coordKey, setTile, canBuildOn } from './hexGrid';
import {
  createEmptyResources,
  addResources,
  subtractResources,
  hasEnoughResources,
  calculateFacilityProduction,
  calculateFacilityConsumption,
  getFacilityBuildCost,
  validateFacilityPlacement,
} from './resources';
import {
  createInitialPopulation,
  recruitColonist,
  growPopulation,
  calculateMorale,
  assignWorker,
} from './population';
import {
  createInitialResearch,
  addResearchPoints,
  calculateResearchOutput,
} from './research';
import {
  rollDisasters,
  applyDisasterEffects,
  decrementDisasters,
  getActiveDisasterCount,
  advanceSeason,
} from './disasters';
import {
  updateAllScores,
  getWinner,
  createTradeOffer,
  acceptTradeOffer,
  rejectTradeOffer,
  cancelTradeOffer,
} from './scoring';

export function createInitialGameState(playerCount: number): GameState {
  const map = generateMap(DEFAULT_GAME_SETTINGS.mapRadius);
  const players: Record<string, Player> = {};

  const startPositions = [
    { q: -3, r: 0 },
    { q: 3, r: 0 },
    { q: 0, r: -3 },
    { q: 0, r: 3 },
    { q: -2, r: -2 },
    { q: 2, r: 2 },
    { q: -2, r: 4 },
    { q: 2, r: -4 },
  ];

  for (let i = 0; i < playerCount; i++) {
    const playerId = `player_${i + 1}`;
    const startPos = startPositions[i];
    const tile = getTile(map, startPos);

    if (tile) {
      tile.terrain = 'plain';
      tile.ownerId = playerId;
      tile.resourceBonus = {};
    }

    players[playerId] = {
      id: playerId,
      name: `玩家 ${i + 1}`,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      resources: {
        oxygen: 100,
        water: 100,
        food: 100,
        power: 50,
        materials: 150,
        fuel: 50,
        rare_minerals: 10,
      },
      population: {
        colonists: createInitialPopulation(),
        morale: 70,
        habitatCapacity: 10,
      },
      research: createInitialResearch(),
      score: {
        territory: 0,
        population: 0,
        research: 0,
        resources: 0,
        trade: 0,
        total: 0,
      },
      isReady: true,
      disconnected: false,
    };
  }

  return {
    id: uuidv4(),
    currentTurn: 1,
    maxTurns: DEFAULT_GAME_SETTINGS.maxTurns,
    phase: 'playing',
    season: 0,
    sunActivityCycle: 1,
    players,
    map,
    activeDisasters: [],
    pendingTrades: [],
    completedTrades: [],
    turnActions: {},
    turnDeadline: null,
    winner: null,
  };
}

export function processTurn(state: GameState): GameState {
  if (state.phase !== 'playing') return state;

  const newState = state;

  step3_ProcessActions(newState);
  step1_ResourceProduction(newState);
  step2_ResourceConsumption(newState);
  step4_Research(newState);
  step5_PopulationChange(newState);
  step6_Disasters(newState);
  step7_TradeSettlement(newState);
  step8_UpdateScores(newState);

  newState.currentTurn++;
  advanceSeason(newState);

  if (newState.currentTurn > newState.maxTurns) {
    newState.phase = 'ended';
    newState.winner = getWinner(newState);
  }

  return newState;
}

function step1_ResourceProduction(state: GameState): void {
  for (const playerId of Object.keys(state.players)) {
    const player = state.players[playerId];
    let totalProduction = createEmptyResources();
    const playerTiles = Array.from(state.map.tiles.values()).filter(t => t.ownerId === playerId);

    let totalPowerProduction = 0;
    let totalPowerConsumption = 0;
    const facilities: Array<{ tile: HexTile; config: any }> = [];

    for (const tile of playerTiles) {
      if (!tile.facility || tile.facility.isDisabled) continue;
      const config = FACILITY_CONFIG[tile.facility.type];
      totalPowerProduction += config.powerProduction || 0;
      totalPowerConsumption += config.powerConsumption || 0;
      facilities.push({ tile, config });
    }

    const sandstorm = state.activeDisasters.find(d => d.type === 'sandstorm');
    if (sandstorm) {
      totalPowerProduction = Math.floor(totalPowerProduction * 0.2);
    }

    const powerRatio = totalPowerConsumption > 0 ? Math.min(1, totalPowerProduction / totalPowerConsumption) : 1;

    for (const { tile, config } of facilities) {
      const facility = tile.facility!;
      const terrainConfig = TERRAIN_CONFIG[tile.terrain as TerrainType];

      if (config.powerConsumption > 0 && powerRatio < 1) {
        facility.isActive = Math.random() < powerRatio;
      } else {
        facility.isActive = true;
      }

      if (!facility.isActive) continue;

      const production = calculateFacilityProduction(state, tile, player);
      totalProduction = addResources(totalProduction, production);
    }

    player.resources = addResources(player.resources, totalProduction);
  }
}

function step2_ResourceConsumption(state: GameState): void {
  for (const playerId of Object.keys(state.players)) {
    const player = state.players[playerId];
    let totalConsumption = createEmptyResources();

    for (const tile of state.map.tiles.values()) {
      if (tile.ownerId !== playerId) continue;
      const consumption = calculateFacilityConsumption(state, tile);
      totalConsumption = addResources(totalConsumption, consumption);
    }

    const population = player.population.colonists.length;
    totalConsumption = addResources(totalConsumption, {
      oxygen: population,
      water: population,
      food: population,
    });

    distributeResourcesByPriority(player, totalConsumption);
  }
}

function distributeResourcesByPriority(player: Player, totalConsumption: Resources): void {
  const priorityOrder: Array<keyof Resources> = [
    'oxygen', 'water', 'food', 'power', 'materials', 'fuel', 'rare_minerals'
  ];

  for (const key of priorityOrder) {
    const needed = totalConsumption[key];
    const available = player.resources[key];

    if (available >= needed) {
      player.resources[key] = available - needed;
    } else {
      player.resources[key] = 0;
    }
  }
}

function step3_ProcessActions(state: GameState): void {
  for (const playerId of Object.keys(state.turnActions)) {
    const actions = state.turnActions[playerId];
    const player = state.players[playerId];
    if (!player) continue;

    for (const action of actions) {
      processPlayerAction(state, playerId, action);
    }
  }

  state.turnActions = {};
}

function processPlayerAction(state: GameState, playerId: string, action: PlayerAction): void {
  const player = state.players[playerId];

  switch (action.type) {
    case 'build_facility': {
      const { coord, facilityType } = action.payload as { coord: HexCoord; facilityType: FacilityType };
      buildFacility(state, playerId, coord, facilityType);
      break;
    }
    case 'demolish_facility': {
      const { coord } = action.payload as { coord: HexCoord };
      demolishFacility(state, playerId, coord);
      break;
    }
    case 'assign_worker': {
      const { colonistId, coord } = action.payload as { colonistId: string; coord: HexCoord | null };
      assignWorker(player, colonistId, coord);
      break;
    }
    case 'recruit_colonist': {
      const { profession } = action.payload as { profession: ProfessionType };
      recruitColonist(player, profession, state.currentTurn);
      break;
    }
    case 'research': {
      const { branch, points } = action.payload as { branch: ResearchBranch; points: number };
      addResearchPoints(player, branch, points);
      break;
    }
    case 'trade_offer': {
      const { toPlayerId, offerResources, requestResources } = action.payload;
      const offer = createTradeOffer(playerId, toPlayerId, offerResources, requestResources, state.currentTurn);
      state.pendingTrades.push(offer);
      break;
    }
    case 'trade_response': {
      const { tradeId, accepted } = action.payload as { tradeId: string; accepted: boolean };
      if (accepted) {
        acceptTradeOffer(state, tradeId);
      } else {
        rejectTradeOffer(state, tradeId);
      }
      break;
    }
  }
}

export function buildFacility(
  state: GameState,
  playerId: string,
  coord: HexCoord,
  facilityType: FacilityType
): boolean {
  const player = state.players[playerId];
  const tile = getTile(state.map, coord);

  if (!tile) return false;
  if (!canBuildOn(state.map, coord, playerId)) return false;

  const validation = validateFacilityPlacement(state, coord, facilityType, playerId);
  if (!validation.valid) return false;

  const cost = getFacilityBuildCost(facilityType, tile.terrain, player);
  if (!hasEnoughResources(player.resources, cost)) return false;

  player.resources = subtractResources(player.resources, cost);

  tile.ownerId = playerId;
  tile.facility = {
    type: facilityType,
    level: 1,
    workers: {},
    isActive: true,
    isDisabled: false,
    disabledTurns: 0,
  };

  if (facilityType === 'habitat') {
    player.population.habitatCapacity += FACILITY_CONFIG.habitat.capacityBonus || 10;
  }

  return true;
}

export function demolishFacility(state: GameState, playerId: string, coord: HexCoord): boolean {
  const player = state.players[playerId];
  const tile = getTile(state.map, coord);

  if (!tile || tile.ownerId !== playerId || !tile.facility) return false;

  if (tile.facility.type === 'habitat') {
    player.population.habitatCapacity -= FACILITY_CONFIG.habitat.capacityBonus || 10;
  }

  tile.facility = null;
  return true;
}

function step4_Research(state: GameState): void {
  for (const playerId of Object.keys(state.players)) {
    const player = state.players[playerId];
    const output = calculateResearchOutput(state, player);

    for (const branch of Object.keys(output) as ResearchBranch[]) {
      const points = output[branch] || 0;
      if (points > 0) {
        addResearchPoints(player, branch, points);
      }
    }
  }
}

function step5_PopulationChange(state: GameState): void {
  for (const playerId of Object.keys(state.players)) {
    const player = state.players[playerId];
    growPopulation(player);
    const disasterCount = getActiveDisasterCount(state, playerId);
    player.population.morale = calculateMorale(player, disasterCount);
  }
}

function step6_Disasters(state: GameState): void {
  decrementDisasters(state);
  const newDisasters = rollDisasters(state);
  state.activeDisasters.push(...newDisasters);
  applyDisasterEffects(state);
}

function step7_TradeSettlement(state: GameState): void {
  state.pendingTrades = state.pendingTrades.filter(t => {
    if (state.currentTurn - t.turnCreated > 3) {
      t.status = 'cancelled';
      state.completedTrades.push(t);
      return false;
    }
    return true;
  });
}

function step8_UpdateScores(state: GameState): void {
  updateAllScores(state);
}

export function queuePlayerAction(
  state: GameState,
  playerId: string,
  action: PlayerAction
): void {
  if (!state.turnActions[playerId]) {
    state.turnActions[playerId] = [];
  }
  state.turnActions[playerId].push(action);
}

export function serializeGameState(state: GameState): any {
  return {
    id: state.id,
    currentTurn: state.currentTurn,
    maxTurns: state.maxTurns,
    phase: state.phase,
    season: state.season,
    sunActivityCycle: state.sunActivityCycle,
    players: Object.fromEntries(
      Object.entries(state.players).map(([id, p]) => [
        id,
        {
          ...p,
          population: {
            ...p.population,
            colonists: p.population.colonists.map(c => ({
              id: c.id,
              profession: c.profession,
              health: c.health,
              isSick: c.isSick,
              assignedFacility: c.assignedFacility,
            })),
          },
        },
      ])
    ),
    map: {
      radius: state.map.radius,
      tiles: Object.fromEntries(
        Array.from(state.map.tiles.entries()).map(([key, tile]) => [
          key,
          {
            ...tile,
          },
        ])
      ),
    },
    activeDisasters: state.activeDisasters,
    pendingTrades: state.pendingTrades,
    completedTrades: state.completedTrades.slice(-20),
    winner: state.winner,
    turnDeadline: state.turnDeadline,
  };
}

export function deserializeGameState(data: any): GameState {
  const tiles = new Map<string, any>();
  for (const [key, tile] of Object.entries(data.map.tiles)) {
    tiles.set(key, tile);
  }

  return {
    ...data,
    map: {
      ...data.map,
      tiles,
    },
  };
}
