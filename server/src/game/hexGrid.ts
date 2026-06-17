import { HexCoord, HexTile, GameMap, TerrainType } from '../types/game';
import { TERRAIN_CONFIG } from './constants';

export function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}

export function coordKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

export function parseKey(key: string): HexCoord {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
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

export function generateMap(radius: number): GameMap {
  const tiles = new Map<string, HexTile>();
  const terrainTypes: TerrainType[] = ['crater', 'canyon', 'polar', 'lava_tube', 'plain'];
  const terrainWeights = [0.12, 0.15, 0.1, 0.08, 0.55];

  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      const coord = { q, r };
      const terrain = weightedRandomTerrain(terrainTypes, terrainWeights, coord, radius);
      const config = TERRAIN_CONFIG[terrain];

      const tile: HexTile = {
        coord,
        terrain,
        ownerId: null,
        facility: null,
        resourceBonus: config.resourceMultipliers,
      };

      tiles.set(hexKey(q, r), tile);
    }
  }

  return { radius, tiles };
}

function weightedRandomTerrain(
  types: TerrainType[],
  weights: number[],
  coord: HexCoord,
  radius: number
): TerrainType {
  const distance = hexDistance(coord, { q: 0, r: 0 });
  const edgeRatio = distance / radius;

  const adjustedWeights = [...weights];
  if (edgeRatio > 0.7) {
    adjustedWeights[2] += 0.15;
    adjustedWeights[0] += 0.1;
  }

  const total = adjustedWeights.reduce((a, b) => a + b, 0);
  let random = Math.random() * total;

  for (let i = 0; i < types.length; i++) {
    random -= adjustedWeights[i];
    if (random <= 0) return types[i];
  }

  return 'plain';
}

export function getTile(map: GameMap, coord: HexCoord): HexTile | null {
  return map.tiles.get(coordKey(coord)) || null;
}

export function setTile(map: GameMap, tile: HexTile): void {
  map.tiles.set(coordKey(tile.coord), tile);
}

export function getPlayerTiles(map: GameMap, playerId: string): HexTile[] {
  return Array.from(map.tiles.values()).filter(t => t.ownerId === playerId);
}

export function getAdjacentOwnedTiles(map: GameMap, coord: HexCoord, playerId: string): HexTile[] {
  return getNeighbors(coord)
    .map(c => getTile(map, c))
    .filter((t): t is HexTile => t !== null && t.ownerId === playerId);
}

export function canBuildOn(map: GameMap, coord: HexCoord, playerId: string): boolean {
  const tile = getTile(map, coord);
  if (!tile) return false;
  if (tile.facility) return false;

  if (tile.ownerId === playerId) return true;
  if (tile.ownerId !== null) return false;

  const adjacentOwned = getAdjacentOwnedTiles(map, coord, playerId);
  return adjacentOwned.length > 0;
}

export function hexToPixel(coord: HexCoord, size: number): { x: number; y: number } {
  const x = size * (3 / 2 * coord.q);
  const y = size * (Math.sqrt(3) / 2 * coord.q + Math.sqrt(3) * coord.r);
  return { x, y };
}

export function pixelToHex(x: number, y: number, size: number): HexCoord {
  const q = (2 / 3 * x) / size;
  const r = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / size;
  return hexRound({ q, r });
}

export function hexRound(coord: HexCoord): HexCoord {
  const s = -coord.q - coord.r;
  let rq = Math.round(coord.q);
  let rr = Math.round(coord.r);
  let rs = Math.round(s);

  const qDiff = Math.abs(rq - coord.q);
  const rDiff = Math.abs(rr - coord.r);
  const sDiff = Math.abs(rs - s);

  if (qDiff > rDiff && qDiff > sDiff) {
    rq = -rr - rs;
  } else if (rDiff > sDiff) {
    rr = -rq - rs;
  }

  return { q: rq, r: rr };
}
