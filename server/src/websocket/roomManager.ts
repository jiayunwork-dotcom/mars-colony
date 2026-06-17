import { v4 as uuidv4 } from 'uuid';
import { Server, Socket } from 'socket.io';
import { GameState, PlayerAction, RoomState } from '../types/game';
import {
  createInitialGameState,
  processTurn,
  serializeGameState,
  queuePlayerAction,
} from '../game/engine';
import {
  setRoomState,
  getRoomState,
  deleteRoomState,
  markPlayerReady,
  getReadyPlayers,
  clearReadyPlayers,
  acquireTurnLock,
  releaseTurnLock,
} from '../db/redis';
import { saveGame, saveRoom, loadRoom, pool } from '../db/postgres';
import { DEFAULT_GAME_SETTINGS, PLAYER_COLORS } from '../game/constants';

const rooms: Map<string, {
  state: RoomState;
  gameState: GameState | null;
  turnTimer: NodeJS.Timeout | null;
  sockets: Map<string, Socket>;
}> = new Map();

export function createRoom(
  io: Server,
  socket: Socket,
  playerName: string,
  roomName: string,
  settings: { mapRadius: number; maxTurns: number; turnTimeout: number }
): { roomId: string; playerId: string } {
  const roomId = uuidv4();
  const playerId = uuidv4();

  const roomState: RoomState = {
    id: roomId,
    name: roomName,
    hostId: playerId,
    maxPlayers: DEFAULT_GAME_SETTINGS.maxPlayers,
    players: [
      {
        id: playerId,
        name: playerName,
        color: PLAYER_COLORS[0],
        isReady: false,
        isHost: true,
      },
    ],
    gameStateId: null,
    status: 'lobby',
    settings: {
      mapRadius: settings.mapRadius || DEFAULT_GAME_SETTINGS.mapRadius,
      maxTurns: settings.maxTurns || DEFAULT_GAME_SETTINGS.maxTurns,
      turnTimeout: settings.turnTimeout || DEFAULT_GAME_SETTINGS.turnTimeout,
    },
  };

  rooms.set(roomId, {
    state: roomState,
    gameState: null,
    turnTimer: null,
    sockets: new Map([[playerId, socket]]),
  });

  socket.join(roomId);
  socket.data.playerId = playerId;
  socket.data.roomId = roomId;

  setRoomState(roomId, roomState);
  saveRoom(roomId, roomState);

  return { roomId, playerId };
}

export function joinRoom(
  io: Server,
  socket: Socket,
  roomId: string,
  playerName: string
): { success: boolean; playerId?: string; error?: string } {
  const room = rooms.get(roomId);
  if (!room) {
    return { success: false, error: '房间不存在' };
  }

  if (room.state.status !== 'lobby') {
    return { success: false, error: '游戏已开始' };
  }

  if (room.state.players.length >= room.state.maxPlayers) {
    return { success: false, error: '房间已满' };
  }

  const playerId = uuidv4();
  const colorIndex = room.state.players.length % PLAYER_COLORS.length;

  room.state.players.push({
    id: playerId,
    name: playerName,
    color: PLAYER_COLORS[colorIndex],
    isReady: false,
    isHost: false,
  });

  room.sockets.set(playerId, socket);

  socket.join(roomId);
  socket.data.playerId = playerId;
  socket.data.roomId = roomId;

  io.to(roomId).emit('room:updated', room.state);
  setRoomState(roomId, room.state);

  return { success: true, playerId };
}

export function setPlayerReady(
  io: Server,
  socket: Socket,
  isReady: boolean
): void {
  const roomId = socket.data.roomId;
  const playerId = socket.data.playerId;
  const room = rooms.get(roomId);

  if (!room) return;

  const player = room.state.players.find(p => p.id === playerId);
  if (player) {
    player.isReady = isReady;
    io.to(roomId).emit('room:updated', room.state);
    setRoomState(roomId, room.state);
  }
}

export function startGame(io: Server, socket: Socket): void {
  const roomId = socket.data.roomId;
  const playerId = socket.data.playerId;
  const room = rooms.get(roomId);

  if (!room || room.state.hostId !== playerId) return;

  const readyPlayers = room.state.players.filter(p => p.isReady);
  if (readyPlayers.length < DEFAULT_GAME_SETTINGS.minPlayers) {
    socket.emit('error', `至少需要 ${DEFAULT_GAME_SETTINGS.minPlayers} 名玩家准备就绪`);
    return;
  }

  const gameState = createInitialGameState(readyPlayers.length);

  readyPlayers.forEach((p, index) => {
    const gamePlayerId = `player_${index + 1}`;
    if (gameState.players[gamePlayerId]) {
      gameState.players[gamePlayerId].name = p.name;
      gameState.players[gamePlayerId].color = p.color;
      (gameState.players[gamePlayerId] as any).socketPlayerId = p.id;
    }
    const s = room.sockets.get(p.id);
    if (s) {
      s.data.gamePlayerId = gamePlayerId;
    }
  });

  room.gameState = gameState;
  room.state.status = 'in_game';
  room.state.gameStateId = gameState.id;

  io.to(roomId).emit('game:started', {
    gameState: serializeGameState(gameState),
    playerMapping: Object.fromEntries(
      readyPlayers.map((p, i) => [p.id, `player_${i + 1}`])
    ),
  });

  io.to(roomId).emit('room:updated', room.state);

  saveGame(gameState.id, serializeGameState(gameState));
  saveRoom(roomId, room.state);

  startTurnTimer(io, roomId);
}

export function submitAction(
  io: Server,
  socket: Socket,
  action: PlayerAction
): void {
  const roomId = socket.data.roomId;
  const gamePlayerId = socket.data.gamePlayerId;
  const room = rooms.get(roomId);

  if (!room || !room.gameState || room.state.status !== 'in_game') return;

  queuePlayerAction(room.gameState, gamePlayerId, action);
  markPlayerReady(roomId, gamePlayerId);

  io.to(roomId).emit('player:action-submitted', {
    playerId: gamePlayerId,
    actionType: action.type,
  });

  checkAllPlayersReady(io, roomId);
}

async function checkAllPlayersReady(io: Server, roomId: string): Promise<void> {
  const room = rooms.get(roomId);
  if (!room || !room.gameState) return;

  const readyPlayers = await getReadyPlayers(roomId);
  const totalPlayers = Object.keys(room.gameState.players).length;

  if (readyPlayers.length >= totalPlayers) {
    await processGameTurn(io, roomId);
  }
}

export function startTurnTimer(io: Server, roomId: string): void {
  const room = rooms.get(roomId);
  if (!room || !room.gameState) return;

  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
  }

  clearReadyPlayers(roomId);

  const timeout = room.state.settings.turnTimeout;
  room.gameState.turnDeadline = Date.now() + timeout;

  io.to(roomId).emit('turn:started', {
    turnNumber: room.gameState.currentTurn,
    deadline: room.gameState.turnDeadline,
  });

  room.turnTimer = setTimeout(() => {
    processGameTurn(io, roomId);
  }, timeout);
}

async function processGameTurn(io: Server, roomId: string): Promise<void> {
  const room = rooms.get(roomId);
  if (!room || !room.gameState) return;

  const lockAcquired = await acquireTurnLock(roomId, 60000);
  if (!lockAcquired) return;

  try {
    if (room.turnTimer) {
      clearTimeout(room.turnTimer);
      room.turnTimer = null;
    }

    const newState = processTurn(room.gameState);
    room.gameState = newState;

    io.to(roomId).emit('turn:completed', {
      gameState: serializeGameState(newState),
    });

    saveGame(newState.id, serializeGameState(newState));

    if (newState.phase === 'ended') {
      room.state.status = 'finished';
      io.to(roomId).emit('game:ended', {
        winner: newState.winner,
        finalScores: Object.fromEntries(
          Object.entries(newState.players).map(([id, p]) => [id, p.score])
        ),
      });
      saveRoom(roomId, room.state);
    } else {
      startTurnTimer(io, roomId);
    }
  } finally {
    await releaseTurnLock(roomId);
  }
}

export function handleDisconnect(io: Server, socket: Socket): void {
  const roomId = socket.data.roomId;
  const playerId = socket.data.playerId;

  if (!roomId || !playerId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  room.sockets.delete(playerId);

  if (room.state.status === 'lobby') {
    room.state.players = room.state.players.filter(p => p.id !== playerId);

    if (room.state.players.length === 0) {
      deleteRoomState(roomId);
      rooms.delete(roomId);
      return;
    }

    if (room.state.hostId === playerId) {
      room.state.hostId = room.state.players[0].id;
      room.state.players[0].isHost = true;
    }

    io.to(roomId).emit('room:updated', room.state);
    setRoomState(roomId, room.state);
  } else if (room.gameState) {
    const gamePlayerId = socket.data.gamePlayerId;
    if (gamePlayerId && room.gameState.players[gamePlayerId]) {
      room.gameState.players[gamePlayerId].disconnected = true;
      io.to(roomId).emit('player:disconnected', { playerId: gamePlayerId });
    }
  }
}

export function sendChatMessage(
  io: Server,
  socket: Socket,
  message: string
): void {
  const roomId = socket.data.roomId;
  const playerId = socket.data.playerId;
  const room = rooms.get(roomId);

  if (!room) return;

  const player = room.state.players.find(p => p.id === playerId);
  if (!player) return;

  io.to(roomId).emit('chat:message', {
    playerId: socket.data.gamePlayerId || playerId,
    playerName: player.name,
    message,
    timestamp: Date.now(),
  });
}

export function getRoomStateHandler(roomId: string): RoomState | null {
  return rooms.get(roomId)?.state || null;
}

export function getGameStateHandler(roomId: string): GameState | null {
  return rooms.get(roomId)?.gameState || null;
}

export function listRooms(): RoomState[] {
  return Array.from(rooms.values())
    .map(r => r.state)
    .filter(r => r.status === 'lobby');
}

export async function restoreRoomsFromDB(io: Server): Promise<void> {
  try {
    const result = await pool.query('SELECT id, state FROM rooms WHERE state->>\'status\' = \'lobby\'');
    for (const row of result.rows) {
      const roomState = row.state as RoomState;
      if (!rooms.has(roomState.id)) {
        rooms.set(roomState.id, {
          state: roomState,
          gameState: null,
          turnTimer: null,
          sockets: new Map(),
        });
        console.log(`Restored room: ${roomState.id} - ${roomState.name}`);
      }
    }
    console.log(`Restored ${result.rows.length} rooms from database`);
  } catch (err) {
    console.error('Failed to restore rooms from DB:', err);
  }
}

export function getRoomStateBySocket(roomId: string, socket: Socket, playerId: string | null): {
  roomState: RoomState | null;
  playerId: string | null;
} {
  const room = rooms.get(roomId);
  if (!room) {
    return { roomState: null, playerId: null };
  }

  let foundPlayerId = playerId;
  if (!foundPlayerId) {
    for (const [pid, sock] of room.sockets.entries()) {
      if (sock.id === socket.id) {
        foundPlayerId = pid;
        break;
      }
    }
  }

  return { roomState: room.state, playerId: foundPlayerId };
}
