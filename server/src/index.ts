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
  restoreRoomsFromDB,
  getRoomStateBySocket,
  rejoinRoom,
  handleCreateOrder,
  handleCancelOrder,
  handleFillOrder,
  handleStartNegotiation,
  handleMakeNegotiationOffer,
  handleRespondNegotiation,
  handleJointDefenseRequest,
  handleJointDefenseAccept,
  handleJointDefenseReject,
  handleJointDefenseTerminate,
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

  socket.on('room:get-state', (data: { roomId: string; playerId?: string }, callback) => {
    const storedPlayerId = socket.data.playerId || data.playerId || null;

    if (storedPlayerId && !socket.data.roomId) {
      rejoinRoom(io, socket, data.roomId, storedPlayerId);
    }

    const result = getRoomStateBySocket(data.roomId, socket, storedPlayerId);
    if (result.roomState) {
      callback?.({
        success: true,
        roomState: result.roomState,
        playerId: result.playerId,
      });
    } else {
      callback?.({ success: false, error: 'Room not found' });
    }
  });

  socket.on('auction:create-order', (data: {
    type: any;
    resourceType: any;
    quantity: number;
    priceResource: any;
    pricePerUnit: number;
  }, callback) => {
    handleCreateOrder(io, socket, data, callback);
  });

  socket.on('auction:cancel-order', (data: { orderId: string }, callback) => {
    handleCancelOrder(io, socket, data, callback);
  });

  socket.on('auction:fill-order', (data: { orderId: string; quantity: number }, callback) => {
    handleFillOrder(io, socket, data, callback);
  });

  socket.on('auction:start-negotiation', (data: {
    orderId: string;
    quantity: number;
    pricePerUnit: number;
  }, callback) => {
    handleStartNegotiation(io, socket, data, callback);
  });

  socket.on('auction:make-offer', (data: {
    negotiationId: string;
    quantity: number;
    pricePerUnit: number;
  }, callback) => {
    handleMakeNegotiationOffer(io, socket, data, callback);
  });

  socket.on('auction:respond-negotiation', (data: {
    negotiationId: string;
    accept: boolean;
  }, callback) => {
    handleRespondNegotiation(io, socket, data, callback);
  });

  socket.on('joint_defense:request', (data: { toPlayerId: string }, callback) => {
    handleJointDefenseRequest(io, socket, data, callback);
  });

  socket.on('joint_defense:accept', (data: { requestId: string }, callback) => {
    handleJointDefenseAccept(io, socket, data, callback);
  });

  socket.on('joint_defense:reject', (data: { requestId: string }, callback) => {
    handleJointDefenseReject(io, socket, data, callback);
  });

  socket.on('joint_defense:terminate', (data: { protocolId: string }, callback) => {
    handleJointDefenseTerminate(io, socket, data, callback);
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
    await restoreRoomsFromDB(io);
    server.listen(PORT, () => {
      console.log(`Mars Colony Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
