export type TerrainType = 'crater' | 'canyon' | 'polar' | 'lava_tube' | 'plain';

export type FacilityType =
  | 'habitat'
  | 'greenhouse'
  | 'mining_station'
  | 'solar_array'
  | 'nuclear_reactor'
  | 'water_recycling'
  | 'launch_pad'
  | 'fusion_reactor'
  | 'shield_generator'
  | 'shelter'
  | 'weather_satellite';

export type ResourceType =
  | 'oxygen'
  | 'water'
  | 'food'
  | 'power'
  | 'materials'
  | 'fuel'
  | 'rare_minerals';

export type ProfessionType = 'engineer' | 'scientist' | 'farmer' | 'miner';

export type ResearchBranch =
  | 'materials'
  | 'biosphere'
  | 'energy'
  | 'mining'
  | 'communication'
  | 'medical';

export type DisasterType =
  | 'sandstorm'
  | 'meteor_impact'
  | 'cold_storm'
  | 'earthquake'
  | 'solar_flare'
  | 'toxic_gas';

export type WarningLevel = 'yellow' | 'orange' | 'red';

export interface HexCoord {
  q: number;
  r: number;
}

export interface HexTile {
  coord: HexCoord;
  terrain: TerrainType;
  ownerId: string | null;
  facility: Facility | null;
  resourceBonus: Partial<Record<ResourceType, number>>;
}

export interface Resources {
  oxygen: number;
  water: number;
  food: number;
  power: number;
  materials: number;
  fuel: number;
  rare_minerals: number;
}

export interface Facility {
  type: FacilityType;
  level: number;
  workers: Partial<Record<ProfessionType, number>>;
  isActive: boolean;
  isDisabled: boolean;
  disabledTurns: number;
  durability: number;
  maxDurability: number;
  shelterCapacity?: number;
}

export interface Colonist {
  id: string;
  profession: ProfessionType;
  assignedFacility: HexCoord | null;
  health: number;
  isSick: boolean;
}

export interface PlayerPopulation {
  colonists: Colonist[];
  morale: number;
  habitatCapacity: number;
}

export interface ResearchProgress {
  branch: ResearchBranch;
  level: number;
  points: number;
  requiredPoints: number;
}

export interface ActiveDisaster {
  id: string;
  type: DisasterType;
  turnsRemaining: number;
  affectedTiles: HexCoord[];
  center: HexCoord;
  radius: number;
}

export interface DisasterWarning {
  id: string;
  disasterType: DisasterType;
  warningLevel: WarningLevel;
  turnsUntilArrival: number;
  estimatedCenter: HexCoord;
  estimatedRadius: number;
  affectedTiles: HexCoord[];
  estimatedLosses: DisasterEstimate;
}

export interface DisasterEstimate {
  buildingsAtRisk: number;
  populationAtRisk: number;
  resourceLoss: Partial<Record<ResourceType, number>>;
}

export interface DisasterSettlement {
  id: string;
  disasterType: DisasterType;
  center: HexCoord;
  radius: number;
  turn: number;
  buildingsDestroyed: Array<{
    coord: HexCoord;
    facilityType: FacilityType;
    ownerId: string;
  }>;
  buildingsDamaged: Array<{
    coord: HexCoord;
    facilityType: FacilityType;
    ownerId: string;
    durabilityLost: number;
  }>;
  populationCasualties: number;
  populationSavedByShelter: number;
  resourcesLost: Partial<Record<ResourceType, number>>;
  productionInterrupted: Array<{
    coord: HexCoord;
    facilityType: FacilityType;
    turnsInterrupted: number;
  }>;
  defenseSuccesses: Array<{
    coord: HexCoord;
    defenseType: FacilityType;
    damageAbsorbed: number;
    allyPlayerName?: string;
  }>;
  shieldedTiles: HexCoord[];
}

export interface DisasterHistoryEntry {
  turn: number;
  disasterType: DisasterType;
  center: HexCoord;
  settlement: DisasterSettlement;
}

export type JointDefenseProtocolStatus = 'active' | 'invalid' | 'terminated';

export interface JointDefenseProtocol {
  id: string;
  playerAId: string;
  playerBId: string;
  status: JointDefenseProtocolStatus;
  activeTurn: number;
}

export interface JointDefenseRequest {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  turnCreated: number;
}

export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  offerResources: Partial<Resources>;
  requestResources: Partial<Resources>;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  turnCreated: number;
}

export type OrderType = 'sell' | 'buy';
export type OrderStatus = 'active' | 'filled' | 'cancelled';

export interface Order {
  id: string;
  playerId: string;
  playerName: string;
  type: OrderType;
  resourceType: ResourceType;
  quantity: number;
  remainingQuantity: number;
  priceResource: ResourceType;
  pricePerUnit: number;
  status: OrderStatus;
  createdAt: number;
  expiresAt: number;
}

export type NegotiationStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'timeout';

export interface NegotiationOffer {
  playerId: string;
  playerName: string;
  quantity: number;
  pricePerUnit: number;
  timestamp: number;
}

export interface Negotiation {
  id: string;
  orderId: string;
  initiatorPlayerId: string;
  initiatorPlayerName: string;
  targetPlayerId: string;
  targetPlayerName: string;
  resourceType: ResourceType;
  priceResource: ResourceType;
  offers: NegotiationOffer[];
  currentRound: number;
  maxRounds: number;
  status: NegotiationStatus;
  createdAt: number;
  expiresAt: number;
  lastActionAt: number;
}

export interface TradeRecord {
  id: string;
  buyerPlayerId: string;
  buyerPlayerName: string;
  sellerPlayerId: string;
  sellerPlayerName: string;
  resourceType: ResourceType;
  quantity: number;
  priceResource: ResourceType;
  pricePerUnit: number;
  totalPrice: number;
  timestamp: number;
  orderId?: string;
}

export interface PlayerTradeStats {
  totalBought: number;
  totalSold: number;
  totalSpent: Partial<Resources>;
  totalEarned: Partial<Resources>;
  tradeCount: number;
  profitLoss: Partial<Resources>;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  resources: Resources;
  population: PlayerPopulation;
  research: Record<ResearchBranch, ResearchProgress>;
  score: {
    territory: number;
    population: number;
    research: number;
    resources: number;
    trade: number;
    total: number;
  };
  isReady: boolean;
  disconnected: boolean;
}

export interface GameMap {
  radius: number;
  tiles: Map<string, HexTile>;
}

export interface GameState {
  id: string;
  currentTurn: number;
  maxTurns: number;
  phase: 'waiting' | 'playing' | 'ended';
  season: number;
  sunActivityCycle: number;
  players: Record<string, Player>;
  map: GameMap;
  activeDisasters: ActiveDisaster[];
  disasterWarnings: DisasterWarning[];
  disasterHistory: DisasterHistoryEntry[];
  pendingSettlement: DisasterSettlement | null;
  pendingTrades: TradeOffer[];
  completedTrades: TradeOffer[];
  turnActions: Record<string, PlayerAction[]>;
  turnDeadline: number | null;
  winner: string | null;
  orders: Order[];
  negotiations: Negotiation[];
  tradeHistory: TradeRecord[];
  playerTradeStats: Record<string, PlayerTradeStats>;
  jointDefenseProtocols: JointDefenseProtocol[];
  pendingJointDefenseRequests: JointDefenseRequest[];
}

export interface PlayerAction {
  type:
    | 'build_facility'
    | 'demolish_facility'
    | 'assign_worker'
    | 'unassign_worker'
    | 'recruit_colonist'
    | 'research'
    | 'trade_offer'
    | 'trade_response'
    | 'chat'
    | 'auction_create_order'
    | 'auction_cancel_order'
    | 'auction_fill_order'
    | 'auction_start_negotiation'
    | 'auction_negotiation_offer'
    | 'auction_negotiation_response'
    | 'joint_defense_request'
    | 'joint_defense_accept'
    | 'joint_defense_reject'
    | 'joint_defense_terminate';
  payload: any;
}

export interface RoomState {
  id: string;
  name: string;
  hostId: string;
  maxPlayers: number;
  players: Array<{
    id: string;
    name: string;
    color: string;
    isReady: boolean;
    isHost: boolean;
  }>;
  gameStateId: string | null;
  status: 'lobby' | 'in_game' | 'finished';
  settings: {
    mapRadius: number;
    maxTurns: number;
    turnTimeout: number;
  };
}
