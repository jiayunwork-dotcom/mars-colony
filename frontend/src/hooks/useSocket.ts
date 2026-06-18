import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket, isSocketConnected, onSocket, offSocket, emitSocket, disconnectSocket } from '../lib/socket';

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const hasConnected = useRef(false);

  useEffect(() => {
    try {
      const socket = getSocket();
      setIsConnected(socket.connected);

      const handleConnect = () => setIsConnected(true);
      const handleDisconnect = () => setIsConnected(false);

      if (!hasConnected.current) {
        hasConnected.current = true;
        if (socket.connected) {
          setIsConnected(true);
        }
      }

      onSocket('connect', handleConnect);
      onSocket('disconnect', handleDisconnect);

      return () => {
        offSocket('connect', handleConnect);
        offSocket('disconnect', handleDisconnect);
      };
    } catch (e) {
      return;
    }
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
