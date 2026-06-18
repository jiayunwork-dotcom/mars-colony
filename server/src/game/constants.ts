import { TerrainType, FacilityType, ResourceType, ProfessionType, ResearchBranch, DisasterType, WarningLevel } from '../types/game';

export const HEX_SIZE = 40;

export const TERRAIN_CONFIG: Record<TerrainType, {
  name: string;
  color: string;
  buildCostMultiplier: number;
  maxFacilities: number;
  resourceMultipliers: Partial<Record<ResourceType, number>>;
  description: string;
}> = {
  crater: {
    name: '陨石坑',
    color: '#8B4513',
    buildCostMultiplier: 2,
    maxFacilities: 5,
    resourceMultipliers: { rare_minerals: 2, materials: 1.2 },
    description: '富含稀有矿物但建设成本翻倍',
  },
  canyon: {
    name: '峡谷',
    color: '#CD853F',
    buildCostMultiplier: 1,
    maxFacilities: 5,
    resourceMultipliers: { power: 1.5 },
    description: '风力资源好但有沙尘暴易损风险',
  },
  polar: {
    name: '极冠冰原',
    color: '#B0E0E6',
    buildCostMultiplier: 1.2,
    maxFacilities: 5,
    resourceMultipliers: { water: 2, power: 0.4 },
    description: '水资源丰富但太阳能产出只有40%',
  },
  lava_tube: {
    name: '熔岩管',
    color: '#2F4F4F',
    buildCostMultiplier: 0.8,
    maxFacilities: 3,
    resourceMultipliers: {},
    description: '天然防辐射适合建居住舱但地形狭窄',
  },
  plain: {
    name: '平原',
    color: '#DEB887',
    buildCostMultiplier: 1,
    maxFacilities: 5,
    resourceMultipliers: {},
    description: '标准地形，适合各类建设',
  },
};

export const FACILITY_CONFIG: Record<FacilityType, {
  name: string;
  icon: string;
  buildCost: Partial<Record<ResourceType, number>>;
  maintenance: Partial<Record<ResourceType, number>>;
  production: Partial<Record<ResourceType, number>>;
  powerConsumption: number;
  powerProduction: number;
  powerRadius: number;
  radiationRadius: number;
  requiredWorkers: number;
  optimalProfession: ProfessionType;
  capacityBonus?: number;
  description: string;
  researchRequired?: { branch: ResearchBranch; level: number };
  isDefense?: boolean;
  shieldRadius?: number;
  shelterCapacity?: number;
  baseDurability?: number;
  satelliteWarningBonus?: number;
}> = {
  habitat: {
    name: '居住舱',
    icon: '🏠',
    buildCost: { materials: 20, power: 10 },
    maintenance: { oxygen: 2, water: 1 },
    production: {},
    powerConsumption: 5,
    powerProduction: 0,
    powerRadius: 0,
    radiationRadius: 0,
    requiredWorkers: 0,
    optimalProfession: 'engineer',
    capacityBonus: 10,
    description: '提供居住空间，每级+10人口容量',
    baseDurability: 100,
  },
  greenhouse: {
    name: '温室大棚',
    icon: '🌱',
    buildCost: { materials: 15, water: 10 },
    maintenance: { water: 3 },
    production: { food: 10, oxygen: 5 },
    powerConsumption: 8,
    powerProduction: 0,
    powerRadius: 0,
    radiationRadius: 0,
    requiredWorkers: 2,
    optimalProfession: 'farmer',
    description: '消耗水和电力产出食物和氧气，需要水回收厂在2格内满产',
    baseDurability: 80,
  },
  mining_station: {
    name: '采矿站',
    icon: '⛏️',
    buildCost: { materials: 30, fuel: 5 },
    maintenance: {},
    production: { materials: 8, rare_minerals: 2 },
    powerConsumption: 15,
    powerProduction: 0,
    powerRadius: 0,
    radiationRadius: 0,
    requiredWorkers: 3,
    optimalProfession: 'miner',
    description: '消耗电力产出建材和稀有矿物，受相邻电力设施供电量限制',
    baseDurability: 120,
  },
  solar_array: {
    name: '太阳能阵列',
    icon: '☀️',
    buildCost: { materials: 25 },
    maintenance: {},
    production: { power: 20 },
    powerConsumption: 0,
    powerProduction: 20,
    powerRadius: 2,
    radiationRadius: 0,
    requiredWorkers: 1,
    optimalProfession: 'engineer',
    description: '利用太阳能发电，沙尘暴时产出降低',
    baseDurability: 60,
  },
  nuclear_reactor: {
    name: '核反应堆',
    icon: '⚛️',
    buildCost: { materials: 50, rare_minerals: 5, fuel: 10 },
    maintenance: { fuel: 2 },
    production: { power: 50 },
    powerConsumption: 0,
    powerProduction: 50,
    powerRadius: 3,
    radiationRadius: 1,
    requiredWorkers: 2,
    optimalProfession: 'engineer',
    description: '大量供电，半径1格内不能建居住舱和温室',
    baseDurability: 150,
  },
  water_recycling: {
    name: '水回收厂',
    icon: '💧',
    buildCost: { materials: 20 },
    maintenance: {},
    production: { water: 15 },
    powerConsumption: 10,
    powerProduction: 0,
    powerRadius: 0,
    radiationRadius: 0,
    requiredWorkers: 1,
    optimalProfession: 'scientist',
    description: '消耗电力产出水，为温室提供生产加成',
    baseDurability: 100,
  },
  launch_pad: {
    name: '发射台',
    icon: '🚀',
    buildCost: { materials: 80, fuel: 20 },
    maintenance: {},
    production: {},
    powerConsumption: 5,
    powerProduction: 0,
    powerRadius: 0,
    radiationRadius: 0,
    requiredWorkers: 2,
    optimalProfession: 'engineer',
    description: '消耗燃料进行贸易，连接地球市场',
    baseDurability: 100,
  },
  fusion_reactor: {
    name: '核聚变反应堆',
    icon: '🔮',
    buildCost: { materials: 100, rare_minerals: 25, fuel: 30 },
    maintenance: { fuel: 1 },
    production: { power: 150 },
    powerConsumption: 0,
    powerProduction: 150,
    powerRadius: 4,
    radiationRadius: 0,
    requiredWorkers: 3,
    optimalProfession: 'scientist',
    description: '高级能源设施，产电量是普通核反应堆3倍',
    researchRequired: { branch: 'energy', level: 3 },
    baseDurability: 200,
  },
  shield_generator: {
    name: '防护罩发生器',
    icon: '🛡️',
    buildCost: { materials: 40, rare_minerals: 10, power: 20 },
    maintenance: { power: 15 },
    production: {},
    powerConsumption: 15,
    powerProduction: 0,
    powerRadius: 0,
    radiationRadius: 0,
    requiredWorkers: 1,
    optimalProfession: 'engineer',
    description: '保护周围1格范围内建筑不受灾害破坏，消耗大量电力维持',
    isDefense: true,
    shieldRadius: 1,
    baseDurability: 150,
  },
  shelter: {
    name: '避难所',
    icon: '🏛️',
    buildCost: { materials: 30, food: 15 },
    maintenance: { food: 2, oxygen: 1 },
    production: {},
    powerConsumption: 5,
    powerProduction: 0,
    powerRadius: 0,
    radiationRadius: 0,
    requiredWorkers: 0,
    optimalProfession: 'engineer',
    description: '灾害来临时自动转移人口避免死亡，有容量上限',
    isDefense: true,
    shelterCapacity: 20,
    baseDurability: 120,
  },
  weather_satellite: {
    name: '气象卫星',
    icon: '🛰️',
    buildCost: { materials: 35, rare_minerals: 8, fuel: 10 },
    maintenance: { fuel: 1 },
    production: {},
    powerConsumption: 3,
    powerProduction: 0,
    powerRadius: 0,
    radiationRadius: 0,
    requiredWorkers: 1,
    optimalProfession: 'scientist',
    description: '提前1回合发现灾害并提升预警精度，可叠加部署增加预警提前量',
    isDefense: true,
    satelliteWarningBonus: 1,
    baseDurability: 80,
  },
};

export const RESOURCE_CONFIG: Record<ResourceType, {
  name: string;
  icon: string;
  color: string;
}> = {
  oxygen: { name: '氧气', icon: '💨', color: '#87CEEB' },
  water: { name: '水', icon: '💧', color: '#4169E1' },
  food: { name: '食物', icon: '🍞', color: '#90EE90' },
  power: { name: '电力', icon: '⚡', color: '#FFD700' },
  materials: { name: '建材', icon: '🧱', color: '#A0522D' },
  fuel: { name: '燃料', icon: '⛽', color: '#FF4500' },
  rare_minerals: { name: '稀有矿物', icon: '💎', color: '#9932CC' },
};

export const PROFESSION_CONFIG: Record<ProfessionType, {
  name: string;
  icon: string;
  color: string;
  baseCost: Partial<Record<ResourceType, number>>;
}> = {
  engineer: {
    name: '工程师',
    icon: '👷',
    color: '#FF6347',
    baseCost: { materials: 10, fuel: 5 },
  },
  scientist: {
    name: '科学家',
    icon: '🔬',
    color: '#4682B4',
    baseCost: { materials: 15, food: 10 },
  },
  farmer: {
    name: '农民',
    icon: '👨‍🌾',
    color: '#32CD32',
    baseCost: { food: 15, water: 10 },
  },
  miner: {
    name: '矿工',
    icon: '⛏️',
    color: '#DAA520',
    baseCost: { food: 10, materials: 5 },
  },
};

export const RESEARCH_CONFIG: Record<ResearchBranch, {
  name: string;
  icon: string;
  color: string;
  levels: Array<{
    requiredPoints: number;
    effects: string[];
    unlocks?: FacilityType[];
  }>;
}> = {
  materials: {
    name: '材料科学',
    icon: '🔩',
    color: '#708090',
    levels: [
      { requiredPoints: 50, effects: ['所有设施建造成本-10%'] },
      { requiredPoints: 120, effects: ['设施维护消耗-15%'] },
      { requiredPoints: 250, effects: ['采矿站产出+30%'] },
      { requiredPoints: 500, effects: ['所有设施耐久度+50%'] },
    ],
  },
  biosphere: {
    name: '生物圈',
    icon: '🌿',
    color: '#228B22',
    levels: [
      { requiredPoints: 50, effects: ['温室产出+20%'] },
      { requiredPoints: 120, effects: ['水回收厂效率+30%'] },
      { requiredPoints: 250, effects: ['人口上限+20%', '食物消耗-20%'] },
      { requiredPoints: 500, effects: ['殖民者免疫疫病'] },
    ],
  },
  energy: {
    name: '能源',
    icon: '🔋',
    color: '#FF8C00',
    levels: [
      { requiredPoints: 50, effects: ['太阳能阵列产出+25%'] },
      { requiredPoints: 120, effects: ['所有电力设施效率+15%'] },
      { requiredPoints: 250, effects: ['解锁核聚变反应堆'], unlocks: ['fusion_reactor'] },
      { requiredPoints: 500, effects: ['电力消耗-25%'] },
    ],
  },
  mining: {
    name: '采矿',
    icon: '⛏️',
    color: '#8B0000',
    levels: [
      { requiredPoints: 50, effects: ['稀有矿物产出+25%'] },
      { requiredPoints: 120, effects: ['采矿站工人需求-1'] },
      { requiredPoints: 250, effects: ['建材产出+40%'] },
      { requiredPoints: 500, effects: ['陨石坑建设成本恢复正常'] },
    ],
  },
  communication: {
    name: '通信',
    icon: '📡',
    color: '#4B0082',
    levels: [
      { requiredPoints: 50, effects: ['贸易手续费-10%'] },
      { requiredPoints: 120, effects: ['联合研究效率+30%'] },
      { requiredPoints: 250, effects: ['可查看其他玩家资源储备'] },
      { requiredPoints: 500, effects: ['联合国仲裁成功率+50%'] },
    ],
  },
  medical: {
    name: '医疗',
    icon: '💊',
    color: '#DC143C',
    levels: [
      { requiredPoints: 50, effects: ['殖民者健康恢复+30%'] },
      { requiredPoints: 120, effects: ['可治愈疫病'] },
      { requiredPoints: 250, effects: ['辐射伤害减半'] },
      { requiredPoints: 500, effects: ['人口增长+50%'] },
    ],
  },
};

export const DISASTER_CONFIG: Record<DisasterType, {
  name: string;
  icon: string;
  color: string;
  baseProbability: number;
  minDuration: number;
  maxDuration: number;
  radius: number;
  description: string;
  warningDescription: string;
}> = {
  sandstorm: {
    name: '沙尘暴',
    icon: '🌪️',
    color: '#D2691E',
    baseProbability: 0.08,
    minDuration: 3,
    maxDuration: 3,
    radius: 4,
    description: '大范围低伤害，降低太阳能产出3回合',
    warningDescription: '检测到大规模沙尘活动，太阳能阵列将受严重影响',
  },
  meteor_impact: {
    name: '陨石撞击',
    icon: '☄️',
    color: '#FF0000',
    baseProbability: 0.03,
    minDuration: 1,
    maxDuration: 1,
    radius: 1,
    description: '小范围高伤害，直接摧毁落点建筑',
    warningDescription: '追踪到陨石轨迹，落点附近建筑面临毁灭性打击',
  },
  cold_storm: {
    name: '极寒风暴',
    icon: '❄️',
    color: '#00BFFF',
    baseProbability: 0.06,
    minDuration: 2,
    maxDuration: 2,
    radius: 3,
    description: '中范围，冻结水资源产出2回合',
    warningDescription: '极地气旋正在形成，水资源系统将面临冻结风险',
  },
  earthquake: {
    name: '地震',
    icon: '🌋',
    color: '#8B0000',
    baseProbability: 0.04,
    minDuration: 1,
    maxDuration: 1,
    radius: 3,
    description: '线性范围沿断裂带，损坏所有建筑耐久50%',
    warningDescription: '探测到地壳异常活动，断裂带沿线建筑面临严重损毁',
  },
  solar_flare: {
    name: '太阳耀斑',
    icon: '☀️',
    color: '#FFD700',
    baseProbability: 0.05,
    minDuration: 1,
    maxDuration: 1,
    radius: 99,
    description: '全图范围，损坏电子设备即太阳能阵列和气象卫星',
    warningDescription: '太阳活动急剧增强，电子设备面临过载损毁风险',
  },
  toxic_gas: {
    name: '有毒气体泄漏',
    icon: '☠️',
    color: '#9ACD32',
    baseProbability: 0.04,
    minDuration: 3,
    maxDuration: 3,
    radius: 2,
    description: '小范围，区域内人口每回合掉血直到建筑温室覆盖该区域',
    warningDescription: '地下有毒气体正在渗漏，区域内人口健康面临威胁',
  },
};

export const WARNING_LEVEL_CONFIG: Record<WarningLevel, {
  name: string;
  color: string;
  bgColor: string;
  borderColor: string;
  severity: number;
}> = {
  yellow: {
    name: '黄色预警',
    color: '#FFD700',
    bgColor: 'rgba(255, 215, 0, 0.15)',
    borderColor: '#FFD700',
    severity: 1,
  },
  orange: {
    name: '橙色预警',
    color: '#FF8C00',
    bgColor: 'rgba(255, 140, 0, 0.2)',
    borderColor: '#FF8C00',
    severity: 2,
  },
  red: {
    name: '红色预警',
    color: '#FF0000',
    bgColor: 'rgba(255, 0, 0, 0.25)',
    borderColor: '#FF0000',
    severity: 3,
  },
};

export const BASE_WARNING_TURNS = 2;

export const PLAYER_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#FF8C42',
  '#6C5CE7',
];

export const DEFAULT_GAME_SETTINGS = {
  mapRadius: 5,
  maxTurns: 50,
  turnTimeout: 30000,
  minPlayers: 4,
  maxPlayers: 8,
};

export const RECRUIT_COST_INCREASE = 0.15;
export const LOGISTIC_GROWTH_RATE = 0.1;
export const MORALE_DECAY_THRESHOLD = 30;
export const MORALE_PRODUCTION_PENALTY = 0.5;
