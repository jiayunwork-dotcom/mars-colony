import { v4 as uuidv4 } from 'uuid';
import {
  Player,
  Colonist,
  ProfessionType,
  Resources,
  HexCoord,
  GameState,
} from '../types/game';
import { PROFESSION_CONFIG, LOGISTIC_GROWTH_RATE, RECRUIT_COST_INCREASE } from './constants';
import { multiplyResources } from './resources';

export function createColonist(profession: ProfessionType): Colonist {
  return {
    id: uuidv4(),
    profession,
    assignedFacility: null,
    health: 100,
    isSick: false,
  };
}

export function createInitialPopulation(): Colonist[] {
  const colonists: Colonist[] = [];
  for (let i = 0; i < 5; i++) colonists.push(createColonist('engineer'));
  for (let i = 0; i < 3; i++) colonists.push(createColonist('scientist'));
  for (let i = 0; i < 3; i++) colonists.push(createColonist('farmer'));
  for (let i = 0; i < 3; i++) colonists.push(createColonist('miner'));
  return colonists;
}

export function getRecruitCost(profession: ProfessionType, currentTurn: number): Partial<Resources> {
  const baseCost = PROFESSION_CONFIG[profession].baseCost;
  const multiplier = Math.pow(1 + RECRUIT_COST_INCREASE, currentTurn);
  return multiplyResources(baseCost, multiplier);
}

export function recruitColonist(player: Player, profession: ProfessionType, currentTurn: number): boolean {
  const cost = getRecruitCost(profession, currentTurn);
  for (const key of Object.keys(cost) as (keyof Resources)[]) {
    if ((player.resources[key] || 0) < (cost[key] || 0)) {
      return false;
    }
  }

  for (const key of Object.keys(cost) as (keyof Resources)[]) {
    player.resources[key] -= cost[key] || 0;
  }

  player.population.colonists.push(createColonist(profession));
  return true;
}

export function calculatePopulationGrowth(player: Player): number {
  const population = player.population.colonists.length;
  const capacity = player.population.habitatCapacity;

  if (capacity <= 0 || population >= capacity) return 0;

  const foodSupply = player.resources.food;
  const foodConsumption = population;
  const foodRate = foodConsumption > 0 ? Math.min(1, foodSupply / foodConsumption) : 0;

  const spaceRate = capacity > 0 ? 1 - population / capacity : 0;

  const limitingFactor = Math.min(foodRate, spaceRate);

  const growth = population * LOGISTIC_GROWTH_RATE * limitingFactor * (1 - population / capacity);
  return Math.floor(growth);
}

export function growPopulation(player: Player): Colonist[] {
  const growth = calculatePopulationGrowth(player);
  const newColonists: Colonist[] = [];
  const professions: ProfessionType[] = ['engineer', 'scientist', 'farmer', 'miner'];

  for (let i = 0; i < growth; i++) {
    const profession = professions[Math.floor(Math.random() * professions.length)];
    const colonist = createColonist(profession);
    newColonists.push(colonist);
    player.population.colonists.push(colonist);
  }

  return newColonists;
}

export function calculateMorale(player: Player, disasterCount: number): number {
  let morale = 50;

  const population = player.population.colonists.length;
  const capacity = player.population.habitatCapacity;
  const density = capacity > 0 ? population / capacity : 1;

  if (density < 0.5) morale += 20;
  else if (density < 0.8) morale += 10;
  else if (density > 1) morale -= 30;
  else morale -= 10;

  const foodSupply = player.resources.food;
  const foodNeed = population;
  if (foodSupply >= foodNeed * 2) morale += 15;
  else if (foodSupply >= foodNeed) morale += 5;
  else if (foodSupply >= foodNeed * 0.5) morale -= 10;
  else morale -= 25;

  const waterSupply = player.resources.water;
  const waterNeed = population;
  if (waterSupply >= waterNeed * 2) morale += 10;
  else if (waterSupply >= waterNeed) morale += 5;
  else morale -= 20;

  morale -= disasterCount * 10;

  morale = Math.max(0, Math.min(100, morale));

  const sickCount = player.population.colonists.filter(c => c.isSick).length;
  if (sickCount > 0) {
    morale -= sickCount * 5;
  }

  return morale;
}

export function assignWorker(
  player: Player,
  colonistId: string,
  facilityCoord: HexCoord | null
): boolean {
  const colonist = player.population.colonists.find(c => c.id === colonistId);
  if (!colonist || colonist.isSick) return false;

  const oldCoord = colonist.assignedFacility;
  if (oldCoord) {
    const oldKey = `${oldCoord.q},${oldCoord.r}`;
  }

  colonist.assignedFacility = facilityCoord;
  return true;
}

export function getColonistsByProfession(player: Player): Record<ProfessionType, number> {
  const result: Record<ProfessionType, number> = {
    engineer: 0,
    scientist: 0,
    farmer: 0,
    miner: 0,
  };

  for (const c of player.population.colonists) {
    if (!c.isSick) {
      result[c.profession]++;
    }
  }

  return result;
}

export function processColonistHealth(player: Player, radiationDamage: number, hasMedicalTech: boolean): void {
  const healRate = hasMedicalTech ? 1.3 : 1;

  for (const colonist of player.population.colonists) {
    if (radiationDamage > 0) {
      colonist.health -= radiationDamage;
    }

    if (colonist.health < 100 && !colonist.isSick) {
      colonist.health = Math.min(100, colonist.health + 5 * healRate);
    }
  }

  player.population.colonists = player.population.colonists.filter(c => c.health > 0);
}
