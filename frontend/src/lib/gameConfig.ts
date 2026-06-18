import { HexCoord, TerrainType, FacilityType, ResourceType, ProfessionType, ResearchBranch, DisasterType, WarningLevel } from '../types/game';

export const HEX_SIZE = 35;

export const TERRAIN_CONFIG: Record<TerrainType, {
  name: string;
  color: string;
  buildCostMultiplier: number;
  maxFacilities: number;
  description: string;
}> = {
  crater: {
    name: '陨石坑',
    color: '#8B4513',
    buildCostMultiplier: 2,
    maxFacilities: 5,
    description: '富含稀有矿物但建设成本翻倍',
  },
  canyon: {
    name: '峡谷',
    color: '#CD853F',
    buildCostMultiplier: 1,
    maxFacilities: 5,
    description: '风力资源好但有沙尘暴易损风险',
  },
  polar: {
    name: '极冠冰原',
    color: '#B0E0E6',
    buildCostMultiplier: 1.2,
    maxFacilities: 5,
    description: '水资源丰富但太阳能产出只有40%',
  },
  lava_tube: {
    name: '熔岩管',
    color: '#2F4F4F',
    buildCostMultiplier: 0.8,
    maxFacilities: 3,
    description: '天然防辐射适合建居住舱但地形狭窄',
  },
  plain: {
    name: '平原',
    color: '#DEB887',
    buildCostMultiplier: 1,
    maxFacilities: 5,
    description: '标准地形，适合各类建设',
  },
};

export const FACILITY_CONFIG: Record<FacilityType, {
  name: string;
  icon: string;
  description: string;
  buildCost: Partial<Record<ResourceType, number>>;
  production: Partial<Record<ResourceType, number>>;
  powerConsumption: number;
  requiredWorkers: number;
  optimalProfession: ProfessionType;
  researchRequired?: { branch: ResearchBranch; level: number };
  isDefense?: boolean;
  shieldRadius?: number;
  shelterCapacity?: number;
  baseDurability?: number;
}> = {
  habitat: {
    name: '居住舱',
    icon: '🏠',
    description: '提供居住空间，每级+10人口容量',
    buildCost: { materials: 20, power: 10 },
    production: {},
    powerConsumption: 5,
    requiredWorkers: 0,
    optimalProfession: 'engineer',
    baseDurability: 100,
  },
  greenhouse: {
    name: '温室大棚',
    icon: '🌱',
    description: '消耗水和电力产出食物和氧气',
    buildCost: { materials: 15, water: 10 },
    production: { food: 10, oxygen: 5 },
    powerConsumption: 8,
    requiredWorkers: 2,
    optimalProfession: 'farmer',
    baseDurability: 80,
  },
  mining_station: {
    name: '采矿站',
    icon: '⛏️',
    description: '消耗电力产出建材和稀有矿物',
    buildCost: { materials: 30, fuel: 5 },
    production: { materials: 8, rare_minerals: 2 },
    powerConsumption: 15,
    requiredWorkers: 3,
    optimalProfession: 'miner',
    baseDurability: 120,
  },
  solar_array: {
    name: '太阳能阵列',
    icon: '☀️',
    description: '利用太阳能发电',
    buildCost: { materials: 25 },
    production: { power: 20 },
    powerConsumption: 0,
    requiredWorkers: 1,
    optimalProfession: 'engineer',
    baseDurability: 60,
  },
  nuclear_reactor: {
    name: '核反应堆',
    icon: '⚛️',
    description: '大量供电，半径1格内不能建居住舱和温室',
    buildCost: { materials: 50, rare_minerals: 5, fuel: 10 },
    production: { power: 50 },
    powerConsumption: 0,
    requiredWorkers: 2,
    optimalProfession: 'engineer',
    baseDurability: 150,
  },
  water_recycling: {
    name: '水回收厂',
    icon: '💧',
    description: '消耗电力产出水',
    buildCost: { materials: 20 },
    production: { water: 15 },
    powerConsumption: 10,
    requiredWorkers: 1,
    optimalProfession: 'scientist',
    baseDurability: 100,
  },
  launch_pad: {
    name: '发射台',
    icon: '🚀',
    description: '消耗燃料进行贸易',
    buildCost: { materials: 80, fuel: 20 },
    production: {},
    powerConsumption: 5,
    requiredWorkers: 2,
    optimalProfession: 'engineer',
    baseDurability: 100,
  },
  fusion_reactor: {
    name: '核聚变反应堆',
    icon: '🔮',
    description: '高级能源设施，产电量是普通核反应堆3倍',
    buildCost: { materials: 100, rare_minerals: 25, fuel: 30 },
    production: { power: 150 },
    powerConsumption: 0,
    requiredWorkers: 3,
    optimalProfession: 'scientist',
    researchRequired: { branch: 'energy', level: 3 },
    baseDurability: 200,
  },
  shield_generator: {
    name: '防护罩发生器',
    icon: '🛡️',
    description: '保护周围1格范围内建筑不受灾害破坏，消耗大量电力维持',
    buildCost: { materials: 40, rare_minerals: 10, power: 20 },
    production: {},
    powerConsumption: 15,
    requiredWorkers: 1,
    optimalProfession: 'engineer',
    isDefense: true,
    shieldRadius: 1,
    baseDurability: 150,
  },
  shelter: {
    name: '避难所',
    icon: '🏛️',
    description: '灾害来临时自动转移人口避免死亡，有容量上限',
    buildCost: { materials: 30, food: 15 },
    production: {},
    powerConsumption: 5,
    requiredWorkers: 0,
    optimalProfession: 'engineer',
    isDefense: true,
    shelterCapacity: 20,
    baseDurability: 120,
  },
  weather_satellite: {
    name: '气象卫星',
    icon: '🛰️',
    description: '提前1回合发现灾害并提升预警精度，可叠加部署增加预警提前量',
    buildCost: { materials: 35, rare_minerals: 8, fuel: 10 },
    production: {},
    powerConsumption: 3,
    requiredWorkers: 1,
    optimalProfession: 'scientist',
    isDefense: true,
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
}> = {
  engineer: { name: '工程师', icon: '👷', color: '#FF6347' },
  scientist: { name: '科学家', icon: '🔬', color: '#4682B4' },
  farmer: { name: '农民', icon: '👨‍🌾', color: '#32CD32' },
  miner: { name: '矿工', icon: '⛏️', color: '#DAA520' },
};

export const RESEARCH_CONFIG: Record<ResearchBranch, {
  name: string;
  icon: string;
  color: string;
  levels: Array<{
    requiredPoints: number;
    effects: string[];
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
      { requiredPoints: 250, effects: ['解锁核聚变反应堆'] },
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
  description: string;
  warningDescription: string;
}> = {
  sandstorm: {
    name: '沙尘暴',
    icon: '🌪️',
    color: '#D2691E',
    description: '大范围低伤害，降低太阳能产出3回合',
    warningDescription: '检测到大规模沙尘活动，太阳能阵列将受严重影响',
  },
  meteor_impact: {
    name: '陨石撞击',
    icon: '☄️',
    color: '#FF0000',
    description: '小范围高伤害，直接摧毁落点建筑',
    warningDescription: '追踪到陨石轨迹，落点附近建筑面临毁灭性打击',
  },
  cold_storm: {
    name: '极寒风暴',
    icon: '❄️',
    color: '#00BFFF',
    description: '中范围，冻结水资源产出2回合',
    warningDescription: '极地气旋正在形成，水资源系统将面临冻结风险',
  },
  earthquake: {
    name: '地震',
    icon: '🌋',
    color: '#8B0000',
    description: '线性范围沿断裂带，损坏所有建筑耐久50%',
    warningDescription: '探测到地壳异常活动，断裂带沿线建筑面临严重损毁',
  },
  solar_flare: {
    name: '太阳耀斑',
    icon: '☀️',
    color: '#FFD700',
    description: '全图范围，损坏电子设备即太阳能阵列和气象卫星',
    warningDescription: '太阳活动急剧增强，电子设备面临过载损毁风险',
  },
  toxic_gas: {
    name: '有毒气体泄漏',
    icon: '☠️',
    color: '#9ACD32',
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

export function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}

export function coordKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

export function hexDistance(a: HexCoord, b: HexCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

export function getNeighbors(coord: HexCoord): HexCoord[] {
  const directions = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ];
  return directions.map(d => ({ q: coord.q + d.q, r: coord.r + d.r }));
}

export function getTilesWithinRadius(center: HexCoord, radius: number): HexCoord[] {
  const results: HexCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      results.push({ q: center.q + q, r: center.r + r });
    }
  }
  return results;
}

export function hexToPixel(coord: HexCoord, size: number): { x: number; y: number } {
  const x = size * (3 / 2 * coord.q);
  const y = size * (Math.sqrt(3) / 2 * coord.q + Math.sqrt(3) * coord.r);
  return { x, y };
}

export function hexCorners(centerX: number, centerY: number, size: number): string {
  const corners: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i - 30;
    const angleRad = (Math.PI / 180) * angleDeg;
    const x = centerX + size * Math.cos(angleRad);
    const y = centerY + size * Math.sin(angleRad);
    corners.push(`${x},${y}`);
  }
  return corners.join(' ');
}
