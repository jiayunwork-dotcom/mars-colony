import { v4 as uuidv4 } from 'uuid';
import { GameState, JointDefenseProtocol, JointDefenseRequest } from '../types/game';
import { hexDistance } from './hexGrid';
import { FACILITY_CONFIG } from './constants';

export const MAX_JOINT_DEFENSE_PROTOCOLS = 2;

export function requestJointDefense(
  state: GameState,
  fromPlayerId: string,
  toPlayerId: string
): { success: boolean; error?: string; request?: JointDefenseRequest } {
  if (fromPlayerId === toPlayerId) {
    return { success: false, error: '不能与自己签订联防协议' };
  }

  if (!state.players[toPlayerId]) {
    return { success: false, error: '目标玩家不存在' };
  }

  const fromCount = countActiveProtocols(state, fromPlayerId);
  if (fromCount >= MAX_JOINT_DEFENSE_PROTOCOLS) {
    return { success: false, error: '你的联防协议已达上限(2个)' };
  }

  const toCount = countActiveProtocols(state, toPlayerId);
  if (toCount >= MAX_JOINT_DEFENSE_PROTOCOLS) {
    return { success: false, error: '对方的联防协议已达上限(2个)' };
  }

  const existing = state.jointDefenseProtocols.find(
    p =>
      (p.playerAId === fromPlayerId && p.playerBId === toPlayerId) ||
      (p.playerAId === toPlayerId && p.playerBId === fromPlayerId)
  );
  if (existing && existing.status !== 'terminated') {
    return { success: false, error: '已存在与该玩家的联防协议' };
  }

  const existingPending = state.pendingJointDefenseRequests.find(
    r =>
      (r.fromPlayerId === fromPlayerId && r.toPlayerId === toPlayerId) ||
      (r.fromPlayerId === toPlayerId && r.toPlayerId === fromPlayerId)
  );
  if (existingPending) {
    return { success: false, error: '已存在待处理的联防请求' };
  }

  const request: JointDefenseRequest = {
    id: uuidv4(),
    fromPlayerId,
    toPlayerId,
    turnCreated: state.currentTurn,
  };

  state.pendingJointDefenseRequests.push(request);
  return { success: true, request };
}

export function acceptJointDefense(
  state: GameState,
  requestId: string,
  acceptingPlayerId: string
): { success: boolean; error?: string; protocol?: JointDefenseProtocol } {
  const requestIndex = state.pendingJointDefenseRequests.findIndex(
    r => r.id === requestId
  );
  if (requestIndex === -1) {
    return { success: false, error: '请求不存在' };
  }

  const request = state.pendingJointDefenseRequests[requestIndex];

  if (request.toPlayerId !== acceptingPlayerId && request.fromPlayerId !== acceptingPlayerId) {
    return { success: false, error: '无权处理此请求' };
  }

  const otherPlayerId = request.fromPlayerId === acceptingPlayerId
    ? request.toPlayerId
    : request.fromPlayerId;

  const myCount = countActiveProtocols(state, acceptingPlayerId);
  if (myCount >= MAX_JOINT_DEFENSE_PROTOCOLS) {
    state.pendingJointDefenseRequests.splice(requestIndex, 1);
    return { success: false, error: '你的联防协议已达上限(2个)' };
  }

  const otherCount = countActiveProtocols(state, otherPlayerId);
  if (otherCount >= MAX_JOINT_DEFENSE_PROTOCOLS) {
    state.pendingJointDefenseRequests.splice(requestIndex, 1);
    return { success: false, error: '对方的联防协议已达上限(2个)' };
  }

  state.pendingJointDefenseRequests.splice(requestIndex, 1);

  const protocol: JointDefenseProtocol = {
    id: uuidv4(),
    playerAId: request.fromPlayerId,
    playerBId: request.toPlayerId,
    status: 'active',
    activeTurn: state.currentTurn,
  };

  state.jointDefenseProtocols.push(protocol);
  return { success: true, protocol };
}

export function rejectJointDefense(
  state: GameState,
  requestId: string,
  rejectingPlayerId: string
): { success: boolean; error?: string } {
  const requestIndex = state.pendingJointDefenseRequests.findIndex(
    r => r.id === requestId
  );
  if (requestIndex === -1) {
    return { success: false, error: '请求不存在' };
  }

  const request = state.pendingJointDefenseRequests[requestIndex];

  if (request.toPlayerId !== rejectingPlayerId && request.fromPlayerId !== rejectingPlayerId) {
    return { success: false, error: '无权处理此请求' };
  }

  state.pendingJointDefenseRequests.splice(requestIndex, 1);
  return { success: true };
}

export function terminateJointDefense(
  state: GameState,
  protocolId: string,
  terminatingPlayerId: string
): { success: boolean; error?: string } {
  const protocol = state.jointDefenseProtocols.find(p => p.id === protocolId);
  if (!protocol) {
    return { success: false, error: '协议不存在' };
  }

  if (protocol.playerAId !== terminatingPlayerId && protocol.playerBId !== terminatingPlayerId) {
    return { success: false, error: '无权终止此协议' };
  }

  if (protocol.status === 'terminated') {
    return { success: false, error: '协议已终止' };
  }

  protocol.status = 'terminated';
  return { success: true };
}

export function countActiveProtocols(state: GameState, playerId: string): number {
  return state.jointDefenseProtocols.filter(
    p =>
      (p.playerAId === playerId || p.playerBId === playerId) &&
      p.status === 'active'
  ).length;
}

export function getPlayerAllies(state: GameState, playerId: string): string[] {
  return state.jointDefenseProtocols
    .filter(
      p =>
        (p.playerAId === playerId || p.playerBId === playerId) &&
        p.status === 'active'
    )
    .map(p =>
      p.playerAId === playerId ? p.playerBId : p.playerAId
    );
}

export function getAllyShieldCoverage(
  state: GameState,
  playerId: string
): Array<{
  allyId: string;
  shieldCount: number;
  coveredTileCount: number;
}> {
  const allies = getPlayerAllies(state, playerId);
  return allies.map(allyId => {
    let shieldCount = 0;
    const coveredCoords = new Set<string>();

    for (const tile of state.map.tiles.values()) {
      if (
        tile.facility?.type === 'shield_generator' &&
        tile.ownerId === allyId &&
        !tile.facility.isDisabled &&
        tile.facility.durability > 0
      ) {
        shieldCount++;
        const radius = FACILITY_CONFIG.shield_generator.shieldRadius || 1;
        for (const otherTile of state.map.tiles.values()) {
          if (hexDistance(tile.coord, otherTile.coord) <= radius) {
            coveredCoords.add(`${otherTile.coord.q},${otherTile.coord.r}`);
          }
        }
      }
    }

    return {
      allyId,
      shieldCount,
      coveredTileCount: coveredCoords.size,
    };
  });
}

export function updateInvalidProtocols(state: GameState): void {
  for (const protocol of state.jointDefenseProtocols) {
    if (protocol.status === 'terminated') continue;

    const aHasShields = playerHasActiveShields(state, protocol.playerAId);
    const bHasShields = playerHasActiveShields(state, protocol.playerBId);

    if (!aHasShields && !bHasShields) {
      protocol.status = 'invalid';
    } else {
      protocol.status = 'active';
    }
  }
}

function playerHasActiveShields(state: GameState, playerId: string): boolean {
  for (const tile of state.map.tiles.values()) {
    if (
      tile.facility?.type === 'shield_generator' &&
      tile.ownerId === playerId &&
      !tile.facility.isDisabled &&
      tile.facility.durability > 0
    ) {
      return true;
    }
  }
  return false;
}

export function isJointDefenseActive(
  state: GameState,
  playerAId: string,
  playerBId: string
): boolean {
  return state.jointDefenseProtocols.some(
    p =>
      ((p.playerAId === playerAId && p.playerBId === playerBId) ||
        (p.playerAId === playerBId && p.playerBId === playerAId)) &&
      p.status === 'active'
  );
}

export function getPendingRequestsForPlayer(
  state: GameState,
  playerId: string
): JointDefenseRequest[] {
  return state.pendingJointDefenseRequests.filter(
    r => r.toPlayerId === playerId || r.fromPlayerId === playerId
  );
}

export function expireOldRequests(state: GameState): void {
  state.pendingJointDefenseRequests = state.pendingJointDefenseRequests.filter(
    r => state.currentTurn - r.turnCreated <= 3
  );
}
