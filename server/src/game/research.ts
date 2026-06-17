import { GameState, Player, ResearchBranch } from '../types/game';
import { RESEARCH_CONFIG } from './constants';

export function createInitialResearch(): Record<ResearchBranch, {
  branch: ResearchBranch;
  level: number;
  points: number;
  requiredPoints: number;
}> {
  const result = {} as Record<ResearchBranch, any>;
  for (const branch of Object.keys(RESEARCH_CONFIG) as ResearchBranch[]) {
    result[branch] = {
      branch,
      level: 0,
      points: 0,
      requiredPoints: RESEARCH_CONFIG[branch].levels[0].requiredPoints,
    };
  }
  return result;
}

export function addResearchPoints(
  player: Player,
  branch: ResearchBranch,
  points: number
): { leveledUp: boolean; newLevel: number } {
  const progress = player.research[branch];
  let leveledUp = false;

  progress.points += points;

  while (progress.level < 4 && progress.points >= progress.requiredPoints) {
    progress.points -= progress.requiredPoints;
    progress.level++;
    leveledUp = true;

    if (progress.level < 4) {
      progress.requiredPoints = RESEARCH_CONFIG[branch].levels[progress.level].requiredPoints;
    }
  }

  return { leveledUp, newLevel: progress.level };
}

export function calculateResearchOutput(
  state: GameState,
  player: Player
): Partial<Record<ResearchBranch, number>> {
  const result: Partial<Record<ResearchBranch, number>> = {};
  const scientists = player.population.colonists.filter(
    c => c.profession === 'scientist' && !c.isSick
  );

  let scientistMultiplier = 1;
  if (player.research.communication.level >= 2) {
    scientistMultiplier = 1.3;
  }

  const researchPerScientist = 2 * scientistMultiplier;

  for (const scientist of scientists) {
    const coord = scientist.assignedFacility;
    if (coord) {
      const tile = state.map.tiles.get(`${coord.q},${coord.r}`);
      if (tile?.facility?.type === 'habitat') {
        const branch = (result as any)['_default'] || 'materials';
        result[branch as ResearchBranch] = (result[branch as ResearchBranch] || 0) + researchPerScientist;
      }
    }
  }

  if (Object.keys(result).length === 0 && scientists.length > 0) {
    result.materials = scientists.length * researchPerScientist;
  }

  return result;
}

export function canJointResearch(
  player1: Player,
  player2: Player,
  branch: ResearchBranch
): boolean {
  const p1 = player1.research[branch];
  const p2 = player2.research[branch];

  if (p1.level >= 4 || p2.level >= 4) return false;
  if (p1.level !== p2.level) return false;

  return true;
}

export function processJointResearch(
  player1: Player,
  player2: Player,
  branch: ResearchBranch,
  pointsPerPlayer: number
): boolean {
  if (!canJointResearch(player1, player2, branch)) return false;

  addResearchPoints(player1, branch, pointsPerPlayer);
  addResearchPoints(player2, branch, pointsPerPlayer);

  return true;
}
