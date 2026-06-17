import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { initDatabase } from './db/postgres';
import {
  createRoom,
  joinRoom,
  setPlayerReady,
  startGame,
  submitAction,
  handleDisconnect,
  sendChatMessage,
  listRooms,
  getRoomStateHandler,
  getGameStateHandler,
} from './websocket/roomManager';
import { serializeGameState } from './game/engine';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.get('/api/rooms', (_req, res) => {
  res.json(listRooms());
});

app.get('/api/rooms/:roomId', (req, res) => {
  const state = getRoomStateHandler(req.params.roomId);
  if (!state) {
    res.status(404).json({ error: 'Room not found' });
  } else {
    res.json(state);
  }
});

app.get('/api/rooms/:roomId/game', (req, res) => {
  const state = getGameStateHandler(req.params.roomId);
  if (!state) {
    res.status(404).json({ error: 'Game not found' });
  } else {
    res.json(serializeGameState(state));
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('room:create', (data: {
    playerName: string;
    roomName: string;
    settings?: { mapRadius: number; maxTurns: number; turnTimeout: number };
  }, callback) => {
    try {
      const { roomId, playerId } = createRoom(
        io,
        socket,
        data.playerName,
        data.roomName,
        data.settings || { mapRadius: 5, maxTurns: 50, turnTimeout: 30000 }
      );
      callback?.({
        success: true,
        roomId,
        playerId,
      });
    } catch (error: any) {
      callback?.({ success: false, error: error.message });
    }
  });

  socket.on('room:join', (data: { roomId: string; playerName: string }, callback) => {
    try {
      const result = joinRoom(io, socket, data.roomId, data.playerName);
      callback?.(result);
    } catch (error: any) {
      callback?.({ success: false, error: error.message });
    }
  });

  socket.on('room:ready', (data: { isReady: boolean }) => {
    setPlayerReady(io, socket, data.isReady);
  });

  socket.on('game:start', () => {
    startGame(io, socket);
  });

  socket.on('game:action', (data: { action: any }) => {
    submitAction(io, socket, data.action);
  });

  socket.on('chat:send', (data: { message: string }) => {
    sendChatMessage(io, socket, data.message);
  });

  socket.on('game:get-state', (data: { roomId: string }, callback) => {
    const state = getGameStateHandler(data.roomId);
    if (state) {
      callback?.({ success: true, gameState: serializeGameState(state) });
    } else {
      callback?.({ success: false, error: 'Game not found' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    handleDisconnect(io, socket);
  });
});

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await initDatabase();
    server.listen(PORT, () => {
      console.log(`Mars Colony Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
