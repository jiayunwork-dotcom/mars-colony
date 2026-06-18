import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

let socketInstance: Socket | null = null;
const listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
const connectionStateSubscribers: Set<(connected: boolean) => void> = new Set();

let currentConnected = false;

function updateConnectionState(connected: boolean): void {
  if (currentConnected === connected) return;
  currentConnected = connected;
  connectionStateSubscribers.forEach(sub => {
    try { sub(connected); } catch (e) { console.error(e); }
  });
}

export function getSocket(): Socket {
  if (socketInstance) {
    return socketInstance;
  }

  const socket = io(WS_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
    updateConnectionState(true);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
    updateConnectionState(false);
  });

  socket.on('connect_error', (err) => {
    console.warn('Socket connect error:', err.message);
    updateConnectionState(false);
  });

  socket.onAny((event, ...args) => {
    const handlers = listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (e) {
          console.error('Error in socket event handler:', event, e);
        }
      });
    }
  });

  currentConnected = socket.connected;
  socketInstance = socket;

  return socket;
}

export function isSocketConnected(): boolean {
  return currentConnected;
}

export function subscribeConnectionState(callback: (connected: boolean) => void): () => void {
  getSocket();
  connectionStateSubscribers.add(callback);
  try { callback(currentConnected); } catch (e) { console.error(e); }
  return () => {
    connectionStateSubscribers.delete(callback);
  };
}

export function onSocket(event: string, handler: (...args: any[]) => void): () => void {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event)!.add(handler);

  return () => {
    const handlers = listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  };
}

export function offSocket(event: string, handler?: (...args: any[]) => void): void {
  if (!handler) {
    listeners.delete(event);
  } else {
    const handlers = listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }
}

export function emitSocket(event: string, data?: any, callback?: (response: any) => void): void {
  const socket = getSocket();
  const doEmit = () => {
    if (callback) {
      socket.emit(event, data, callback);
    } else {
      socket.emit(event, data);
    }
  };

  if (socket.connected) {
    doEmit();
  } else {
    socket.once('connect', doEmit);
  }
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    listeners.clear();
    connectionStateSubscribers.clear();
    updateConnectionState(false);
  }
}
