import { GameState, Player, Resources, TradeOffer } from '../types/game';
import { getPlayerTiles } from './hexGrid';
import { addResources, subtractResources, hasEnoughResources } from './resources';

export function calculatePlayerScore(state: GameState, player: Player): {
  territory: number;
  population: number;
  research: number;
  resources: number;
  trade: number;
  total: number;
} {
  const allPlayers = Object.values(state.players);

  const playerTiles = getPlayerTiles(state.map, player.id);
  const maxTiles = Math.max(...allPlayers.map(p => getPlayerTiles(state.map, p.id).length), 1);
  const territory = Math.round((playerTiles.length / maxTiles) * 100 * 0.25);

  const population = player.population.colonists.length;
  const maxPopulation = Math.max(...allPlayers.map(p => p.population.colonists.length), 1);
  const populationScore = Math.round((population / maxPopulation) * 100 * 0.25);

  let totalResearchLevels = 0;
  for (const branch of Object.keys(player.research) as (keyof typeof player.research)[]) {
    totalResearchLevels += player.research[branch].level;
  }
  const maxResearchLevels = Math.max(
    ...allPlayers.map(p => {
      let total = 0;
      for (const branch of Object.keys(p.research) as (keyof typeof p.research)[]) {
        total += p.research[branch].level;
      }
      return total;
    }),
    1
  );
  const research = Math.round((totalResearchLevels / maxResearchLevels) * 100 * 0.20);

  const resourceWeights: Record<keyof Resources, number> = {
    oxygen: 0.5,
    water: 0.8,
    food: 1,
    power: 0.3,
    materials: 0.6,
    fuel: 1.2,
    rare_minerals: 2,
  };

  let totalResourceValue = 0;
  for (const key of Object.keys(player.resources) as (keyof Resources)[]) {
    totalResourceValue += player.resources[key] * resourceWeights[key];
  }

  const maxResourceValue = Math.max(
    ...allPlayers.map(p => {
      let value = 0;
      for (const key of Object.keys(p.resources) as (keyof Resources)[]) {
        value += p.resources[key] * resourceWeights[key];
      }
      return value;
    }),
    1
  );
  const resources = Math.round((totalResourceValue / maxResourceValue) * 100 * 0.15);

  const completedTrades = state.completedTrades.filter(
    t => t.fromPlayerId === player.id || t.toPlayerId === player.id
  );
  let tradeValue = completedTrades.length * 10;

  let maxTradeValue = Math.max(
    ...allPlayers.map(p => {
      const trades = state.completedTrades.filter(
        t => t.fromPlayerId === p.id || t.toPlayerId === p.id
      );
      return trades.length * 10;
    }),
    1
  );
  const trade = Math.round((tradeValue / maxTradeValue) * 100 * 0.15);

  const total = territory + populationScore + research + resources + trade;

  return {
    territory,
    population: populationScore,
    research,
    resources,
    trade,
    total,
  };
}

export function updateAllScores(state: GameState): void {
  for (const playerId of Object.keys(state.players)) {
    const player = state.players[playerId];
    player.score = calculatePlayerScore(state, player);
  }
}

export function createTradeOffer(
  fromPlayerId: string,
  toPlayerId: string,
  offerResources: Partial<Resources>,
  requestResources: Partial<Resources>,
  currentTurn: number
): TradeOffer {
  return {
    id: Math.random().toString(36).substr(2, 9),
    fromPlayerId,
    toPlayerId,
    offerResources,
    requestResources,
    status: 'pending',
    turnCreated: currentTurn,
  };
}

export function acceptTradeOffer(state: GameState, tradeId: string): boolean {
  const trade = state.pendingTrades.find(t => t.id === tradeId);
  if (!trade || trade.status !== 'pending') return false;

  const fromPlayer = state.players[trade.fromPlayerId];
  const toPlayer = state.players[trade.toPlayerId];

  if (!fromPlayer || !toPlayer) return false;

  if (!hasEnoughResources(fromPlayer.resources, trade.offerResources)) return false;
  if (!hasEnoughResources(toPlayer.resources, trade.requestResources)) return false;

  fromPlayer.resources = subtractResources(fromPlayer.resources, trade.offerResources);
  fromPlayer.resources = addResources(fromPlayer.resources, trade.requestResources);

  toPlayer.resources = subtractResources(toPlayer.resources, trade.requestResources);
  toPlayer.resources = addResources(toPlayer.resources, trade.offerResources);

  trade.status = 'accepted';
  state.completedTrades.push(trade);
  state.pendingTrades = state.pendingTrades.filter(t => t.id !== tradeId);

  return true;
}

export function rejectTradeOffer(state: GameState, tradeId: string): boolean {
  const trade = state.pendingTrades.find(t => t.id === tradeId);
  if (!trade || trade.status !== 'pending') return false;

  trade.status = 'rejected';
  state.completedTrades.push(trade);
  state.pendingTrades = state.pendingTrades.filter(t => t.id !== tradeId);

  return true;
}

export function cancelTradeOffer(state: GameState, tradeId: string, playerId: string): boolean {
  const trade = state.pendingTrades.find(t => t.id === tradeId);
  if (!trade || trade.status !== 'pending') return false;
  if (trade.fromPlayerId !== playerId) return false;

  trade.status = 'cancelled';
  state.completedTrades.push(trade);
  state.pendingTrades = state.pendingTrades.filter(t => t.id !== tradeId);

  return true;
}

export function getWinner(state: GameState): string | null {
  const players = Object.values(state.players);
  if (players.length === 0) return null;

  let winner = players[0];
  for (const p of players) {
    if (p.score.total > winner.score.total) {
      winner = p;
    }
  }

  return winner.id;
}
