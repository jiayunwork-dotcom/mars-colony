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
  DisasterSettlement,
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
  rollDisasterWarnings,
  decrementDisasters,
  getActiveDisasterCount,
  advanceSeason,
  advanceWarningsAndCollectArrived,
  convertArrivedWarningsToDisasters,
  addSettlementToHistory,
  processOngoingDisasterEffects,
  applyTriggeredDisasterEffects,
} from './disasters';
import {
  updateAllScores,
  getWinner,
  createTradeOffer,
  acceptTradeOffer,
  rejectTradeOffer,
  cancelTradeOffer,
} from './scoring';
import {
  createOrder,
  cancelOrder,
  fillOrder,
  startNegotiation,
  makeNegotiationOffer,
  respondToNegotiation,
  checkNegotiationTimeouts,
  checkExpiredOrders,
} from './auction';
import {
  requestJointDefense,
  cancelJointDefenseRequest,
  terminateJointDefense,
  updateInvalidProtocols,
  expireOldRequests,
  tryAutoMatchAllRequests,
} from './jointDefense';

function deepClone<T>(obj: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  const cloned: any = JSON.parse(JSON.stringify(obj));
  if (cloned && cloned.map && cloned.map.tiles && !(cloned.map.tiles instanceof Map)) {
    const tiles = new Map<string, any>();
    for (const [key, tile] of Object.entries(cloned.map.tiles)) {
      tiles.set(key, tile);
    }
    cloned.map.tiles = tiles;
  }
  return cloned;
}

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

  const playerTradeStats: Record<string, any> = {};
  for (const playerId of Object.keys(players)) {
    playerTradeStats[playerId] = {
      totalBought: 0,
      totalSold: 0,
      totalSpent: {},
      totalEarned: {},
      tradeCount: 0,
      profitLoss: {},
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
    disasterWarnings: [],
    disasterHistory: [],
    pendingSettlement: null,
    pendingTrades: [],
    completedTrades: [],
    turnActions: {},
    turnDeadline: null,
    winner: null,
    orders: [],
    negotiations: [],
    tradeHistory: [],
    playerTradeStats,
    jointDefenseProtocols: [],
    pendingJointDefenseRequests: [],
  };
}

function ensureGameStateFields(state: GameState): void {
  if (!state.activeDisasters) state.activeDisasters = [];
  if (!state.disasterWarnings) state.disasterWarnings = [];
  if (!state.disasterHistory) state.disasterHistory = [];
  if (!state.pendingSettlement) state.pendingSettlement = null;
  if (!state.pendingTrades) state.pendingTrades = [];
  if (!state.completedTrades) state.completedTrades = [];
  if (!state.orders) state.orders = [];
  if (!state.negotiations) state.negotiations = [];
  if (!state.tradeHistory) state.tradeHistory = [];
  if (!state.turnActions) state.turnActions = {};
  if (!state.playerTradeStats) state.playerTradeStats = {};
  if (!state.jointDefenseProtocols) state.jointDefenseProtocols = [];
  if (!state.pendingJointDefenseRequests) state.pendingJointDefenseRequests = [];
  for (const tile of state.map.tiles.values()) {
    if (tile.facility) {
      const f = tile.facility as any;
      if (f.durability === undefined) {
        const cfg = (FACILITY_CONFIG as any)[f.type];
        f.durability = cfg?.baseDurability || 100;
        f.maxDurability = cfg?.baseDurability || 100;
      }
      if (f.maxDurability === undefined) {
        f.maxDurability = f.durability;
      }
      if (f.isDisabled === undefined) {
        f.isDisabled = false;
      }
      if (f.disabledTurns === undefined) {
        f.disabledTurns = 0;
      }
      if (f.shelterCapacity === undefined) {
        const cfg = (FACILITY_CONFIG as any)[f.type];
        if (cfg?.shelterCapacity) {
          f.shelterCapacity = cfg.shelterCapacity;
        }
      }
    }
  }
  for (const player of Object.values(state.players)) {
    if (!player.population) continue;
    for (const colonist of player.population.colonists) {
      if ((colonist as any).health === undefined) {
        (colonist as any).health = 100;
      }
      if ((colonist as any).isSick === undefined) {
        (colonist as any).isSick = false;
      }
    }
  }
}

export function processTurn(state: GameState): GameState {
  if (state.phase !== 'playing') return state;

  const newState = deepClone(state);
  ensureGameStateFields(newState);
  newState.pendingSettlement = null;

  step1_ResourceProduction(newState);
  step2_ResourceConsumption(newState);
  step3_ProcessActions(newState);
  step4_Research(newState);
  step5_PopulationChange(newState);
  step6_Disasters(newState);
  step7_TradeSettlement(newState);
  step7_5_AuctionCleanup(newState);
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
    const playerTiles = Array.from(state.map.tiles.values()).filter(t => t.ownerId === playerId);

    let totalPowerProduction = 0;
    let totalPowerConsumption = 0;
    const powerProducers: Array<{ tile: HexTile; actualPower: number }> = [];
    const powerConsumers: Array<{ tile: HexTile; consumption: number }> = [];
    const allFacilities: Array<HexTile> = [];

    for (const tile of playerTiles) {
      if (!tile.facility || tile.facility.isDisabled) continue;
      const config = FACILITY_CONFIG[tile.facility.type];
      allFacilities.push(tile);

      if (config.powerProduction > 0) {
        let actualPower = config.powerProduction;
        if (tile.terrain === 'polar' && tile.facility.type === 'solar_array') {
          actualPower = Math.floor(actualPower * 0.4);
        }
        const sandstorm = state.activeDisasters.find(d => d.type === 'sandstorm');
        if (sandstorm && tile.facility.type === 'solar_array') {
          actualPower = Math.floor(actualPower * 0.2);
        }
        totalPowerProduction += actualPower;
        powerProducers.push({ tile, actualPower });
      }

      if (config.powerConsumption > 0) {
        totalPowerConsumption += config.powerConsumption;
        powerConsumers.push({ tile, consumption: config.powerConsumption });
      }
    }

    const powerRatio = totalPowerConsumption > 0
      ? Math.min(1, totalPowerProduction / totalPowerConsumption)
      : 1;

    for (const tile of allFacilities) {
      const facility = tile.facility!;
      const config = FACILITY_CONFIG[facility.type];

      if (config.powerConsumption > 0 && powerRatio < 1) {
        facility.isActive = Math.random() < powerRatio;
      } else {
        facility.isActive = true;
      }
    }

    let totalProduction = createEmptyResources();
    for (const tile of allFacilities) {
      if (!tile.facility?.isActive) continue;
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
    case 'auction_create_order': {
      const { type, resourceType, quantity, priceResource, pricePerUnit } = action.payload;
      createOrder(state, playerId, type, resourceType, quantity, priceResource, pricePerUnit);
      break;
    }
    case 'auction_cancel_order': {
      const { orderId } = action.payload;
      cancelOrder(state, orderId, playerId);
      break;
    }
    case 'auction_fill_order': {
      const { orderId, quantity } = action.payload;
      fillOrder(state, orderId, playerId, quantity);
      break;
    }
    case 'auction_start_negotiation': {
      const { orderId, quantity, pricePerUnit } = action.payload;
      startNegotiation(state, orderId, playerId, quantity, pricePerUnit);
      break;
    }
    case 'auction_negotiation_offer': {
      const { negotiationId, quantity, pricePerUnit } = action.payload;
      makeNegotiationOffer(state, negotiationId, playerId, quantity, pricePerUnit);
      break;
    }
    case 'auction_negotiation_response': {
      const { negotiationId, accept } = action.payload;
      respondToNegotiation(state, negotiationId, playerId, accept);
      break;
    }
    case 'joint_defense_request': {
      const { toPlayerId } = action.payload as { toPlayerId: string };
      requestJointDefense(state, playerId, toPlayerId);
      break;
    }
    case 'joint_defense_cancel': {
      const { requestId } = action.payload as { requestId: string };
      cancelJointDefenseRequest(state, requestId, playerId);
      break;
    }
    case 'joint_defense_terminate': {
      const { protocolId } = action.payload as { protocolId: string };
      terminateJointDefense(state, protocolId, playerId);
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

  const config = FACILITY_CONFIG[facilityType];

  tile.ownerId = playerId;
  tile.facility = {
    type: facilityType,
    level: 1,
    workers: {},
    isActive: true,
    isDisabled: false,
    disabledTurns: 0,
    durability: config.baseDurability || 100,
    maxDurability: config.baseDurability || 100,
    shelterCapacity: config.shelterCapacity,
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
  // 1. 推进预警倒计时，收集到达的预警（同时从列表移除）
  const arrivedWarnings = advanceWarningsAndCollectArrived(state);

  // 2. 将到达预警转化为 ActiveDisaster（新触发的灾害）
  const newlyTriggeredDisasters = convertArrivedWarningsToDisasters(state, arrivedWarnings);
  state.activeDisasters.push(...newlyTriggeredDisasters);

  // 3. 对本回合新触发的灾害应用一次性影响（建筑摧毁、人口伤亡等）并生成结算
  if (newlyTriggeredDisasters.length > 0) {
    const settlements = applyTriggeredDisasterEffects(state, newlyTriggeredDisasters);
    for (const settlement of settlements) {
      addSettlementToHistory(state, settlement);
    }
    if (settlements.length > 0) {
      state.pendingSettlement = mergeSettlements(settlements);
    }
  }

  // 4. 处理持续灾害的每回合效果（如有毒气体每回合掉血）
  processOngoingDisasterEffects(state);

  // 5. 推进 active 灾害的剩余回合数，处理结束
  decrementDisasters(state);

  // 6. 生成新的灾害预警
  const newWarnings = rollDisasterWarnings(state);
  state.disasterWarnings.push(...newWarnings);

  // 7. 联防协议维护
  updateInvalidProtocols(state);
  expireOldRequests(state);
}

function mergeSettlements(settlements: DisasterSettlement[]): DisasterSettlement {
  if (settlements.length === 1) return settlements[0];

  const merged: DisasterSettlement = {
    id: uuidv4(),
    disasterType: settlements[0].disasterType,
    center: settlements[0].center,
    radius: settlements[0].radius,
    turn: settlements[0].turn,
    buildingsDestroyed: [],
    buildingsDamaged: [],
    populationCasualties: 0,
    populationSavedByShelter: 0,
    resourcesLost: {},
    productionInterrupted: [],
    defenseSuccesses: [],
    shieldedTiles: [],
  };

  for (const s of settlements) {
    merged.buildingsDestroyed.push(...s.buildingsDestroyed);
    merged.buildingsDamaged.push(...s.buildingsDamaged);
    merged.populationCasualties += s.populationCasualties;
    merged.populationSavedByShelter += s.populationSavedByShelter;
    merged.productionInterrupted.push(...s.productionInterrupted);
    merged.defenseSuccesses.push(...s.defenseSuccesses);
    merged.shieldedTiles.push(...s.shieldedTiles);
    for (const [key, val] of Object.entries(s.resourcesLost)) {
      merged.resourcesLost[key as ResourceType] = (merged.resourcesLost[key as ResourceType] || 0) + (val || 0);
    }
  }

  return merged;
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

function step7_5_AuctionCleanup(state: GameState): void {
  checkExpiredOrders(state);
  checkNegotiationTimeouts(state);
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
            facility: tile.facility ? {
              ...tile.facility,
              durability: tile.facility.durability,
              maxDurability: tile.facility.maxDurability,
              shelterCapacity: tile.facility.shelterCapacity,
            } : null,
          },
        ])
      ),
    },
    activeDisasters: state.activeDisasters,
    disasterWarnings: state.disasterWarnings,
    disasterHistory: state.disasterHistory,
    pendingSettlement: state.pendingSettlement,
    pendingTrades: state.pendingTrades,
    completedTrades: state.completedTrades.slice(-20),
    winner: state.winner,
    turnDeadline: state.turnDeadline,
    orders: state.orders.filter(o => o.status === 'active'),
    negotiations: state.negotiations.filter(n => n.status === 'pending'),
    tradeHistory: state.tradeHistory.slice(-50),
    playerTradeStats: state.playerTradeStats,
    jointDefenseProtocols: state.jointDefenseProtocols,
    pendingJointDefenseRequests: state.pendingJointDefenseRequests,
  };
}

export function deserializeGameState(data: any): GameState {
  const tiles = new Map<string, any>();
  for (const [key, tile] of Object.entries(data?.map?.tiles || {})) {
    const t = typeof tile === 'object' && tile !== null ? { ...(tile as object) } : { coord: { q: 0, r: 0 } } as any;
    if (t.facility) {
      const f: any = { ...t.facility };
      if (f.durability === undefined) {
        const cfg = (FACILITY_CONFIG as any)[f.type];
        f.durability = cfg?.baseDurability || 100;
      }
      if (f.maxDurability === undefined) {
        f.maxDurability = f.durability;
      }
      if (f.isDisabled === undefined) {
        f.isDisabled = false;
      }
      if (f.disabledTurns === undefined) {
        f.disabledTurns = 0;
      }
      if (f.shelterCapacity === undefined) {
        const cfg = (FACILITY_CONFIG as any)[f.type];
        if (cfg?.shelterCapacity) {
          f.shelterCapacity = cfg.shelterCapacity;
        }
      }
      t.facility = f;
    }
    tiles.set(key, t);
  }

  const players: any = {};
  for (const [id, p] of Object.entries(data?.players || {})) {
    const pl = typeof p === 'object' && p !== null ? { ...(p as object) } : {} as any;
    if (pl.population && pl.population.colonists) {
      pl.population = {
        ...pl.population,
        colonists: pl.population.colonists.map((c: any) => ({
          ...c,
          health: c.health === undefined ? 100 : c.health,
          isSick: c.isSick === undefined ? false : c.isSick,
        })),
      };
    }
    players[id] = pl;
  }

  return {
    ...data,
    players,
    map: {
      ...data.map,
      tiles,
    },
    activeDisasters: data.activeDisasters || [],
    disasterWarnings: data.disasterWarnings || [],
    disasterHistory: data.disasterHistory || [],
    pendingSettlement: data.pendingSettlement || null,
    pendingTrades: data.pendingTrades || [],
    completedTrades: data.completedTrades || [],
    orders: data.orders || [],
    negotiations: data.negotiations || [],
    tradeHistory: data.tradeHistory || [],
    turnActions: data.turnActions || {},
    playerTradeStats: data.playerTradeStats || {},
    jointDefenseProtocols: data.jointDefenseProtocols || [],
    pendingJointDefenseRequests: data.pendingJointDefenseRequests || [],
  };
}
