import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

redis.on('connect', () => {
  console.log('Redis connected');
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

export async function setRoomState(roomId: string, state: any, ttl?: number): Promise<void> {
  const key = `room:${roomId}`;
  if (ttl) {
    await redis.setex(key, ttl, JSON.stringify(state));
  } else {
    await redis.set(key, JSON.stringify(state));
  }
}

export async function getRoomState(roomId: string): Promise<any | null> {
  const key = `room:${roomId}`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

export async function deleteRoomState(roomId: string): Promise<void> {
  await redis.del(`room:${roomId}`);
}

export async function acquireTurnLock(roomId: string, timeout: number = 35000): Promise<boolean> {
  const key = `turn_lock:${roomId}`;
  const result = await redis.set(key, '1', 'PX', timeout, 'NX');
  return result === 'OK';
}

export async function releaseTurnLock(roomId: string): Promise<void> {
  await redis.del(`turn_lock:${roomId}`);
}

export async function acquireAuctionLock(roomId: string, timeout: number = 5000): Promise<boolean> {
  const key = `auction_lock:${roomId}`;
  const result = await redis.set(key, '1', 'PX', timeout, 'NX');
  return result === 'OK';
}

export async function releaseAuctionLock(roomId: string): Promise<void> {
  await redis.del(`auction_lock:${roomId}`);
}

export async function markPlayerReady(roomId: string, playerId: string): Promise<void> {
  await redis.sadd(`ready:${roomId}`, playerId);
}

export async function getReadyPlayers(roomId: string): Promise<string[]> {
  return await redis.smembers(`ready:${roomId}`);
}

export async function clearReadyPlayers(roomId: string): Promise<void> {
  await redis.del(`ready:${roomId}`);
}

export async function setPlayerSocket(playerId: string, socketId: string): Promise<void> {
  await redis.set(`player_socket:${playerId}`, socketId);
}

export async function getPlayerSocket(playerId: string): Promise<string | null> {
  return await redis.get(`player_socket:${playerId}`);
}

export { redis };
