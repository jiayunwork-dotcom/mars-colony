import { useEffect, useState, useCallback } from 'react';
import { getSocket, subscribeConnectionState, onSocket, offSocket, emitSocket, disconnectSocket } from '../lib/socket';

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    getSocket();
    const unsubscribe = subscribeConnectionState((connected) => {
      setIsConnected(connected);
    });
    return unsubscribe;
  }, []);

  const emit = useCallback((event: string, data?: any, callback?: (response: any) => void) => {
    emitSocket(event, data, callback);
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    onSocket(event, handler);
  }, []);

  const off = useCallback((event: string, handler?: (...args: any[]) => void) => {
    offSocket(event, handler);
  }, []);

  const connect = useCallback(() => {
    return getSocket();
  }, []);

  const disconnect = useCallback(() => {
    disconnectSocket();
  }, []);

  return {
    socket: null,
    isConnected,
    connect,
    disconnect,
    emit,
    on,
    off,
  };
}
