export type TerrainType = 'crater' | 'canyon' | 'polar' | 'lava_tube' | 'plain';

export type FacilityType =
  | 'habitat'
  | 'greenhouse'
  | 'mining_station'
  | 'solar_array'
  | 'nuclear_reactor'
  | 'water_recycling'
  | 'launch_pad'
  | 'fusion_reactor';

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
  | 'radiation_storm'
  | 'equipment_failure'
  | 'plague'
  | 'meteor_impact';

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
  type: DisasterType;
  turnsRemaining: number;
  affectedTiles: HexCoord[];
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
  tiles: Record<string, HexTile>;
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
  pendingTrades: TradeOffer[];
  completedTrades: TradeOffer[];
  turnDeadline: number | null;
  winner: string | null;
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
    | 'chat';
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

export interface ChatMessage {
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}
