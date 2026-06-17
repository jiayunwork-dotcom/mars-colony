import { HexCoord, TerrainType, FacilityType, ResourceType, ProfessionType, ResearchBranch, DisasterType } from '../types/game';

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
}> = {
  sandstorm: {
    name: '沙尘暴',
    icon: '🌪️',
    color: '#D2691E',
    description: '太阳能产出降到20%，户外设施有30%概率损坏',
  },
  radiation_storm: {
    name: '辐射风暴',
    icon: '☢️',
    color: '#ADFF2F',
    description: '殖民者健康-20，非防护设施内的人口有10%死亡概率',
  },
  equipment_failure: {
    name: '设备故障',
    icon: '🔧',
    color: '#808080',
    description: '随机一个设施停产1回合',
  },
  plague: {
    name: '疫病',
    icon: '🦠',
    color: '#556B2F',
    description: '传染到相邻居住舱，病人不工作',
  },
  meteor_impact: {
    name: '陨石撞击',
    icon: '☄️',
    color: '#FF0000',
    description: '摧毁一个格子及其设施',
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
