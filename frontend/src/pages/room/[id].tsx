import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSocket } from '../../hooks/useSocket';
import type { RoomState } from '../../types/game';

export default function Room() {
  const router = useRouter();
  const { id } = router.query;
  const { connect, emit, on, off, isConnected } = useSocket();
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [gameStarting, setGameStarting] = useState(false);

  useEffect(() => {
    if (!id) return;

    const socket = connect();
    const storedPlayerId = localStorage.getItem('playerId');
    if (storedPlayerId) setPlayerId(storedPlayerId);

    const handleRoomUpdated = (roomState: RoomState) => {
      setRoom(roomState);
      const currentPlayer = storedPlayerId ? roomState.players.find(p => p.id === storedPlayerId) : null;
      if (currentPlayer) {
        setIsHost(currentPlayer.isHost);
        setIsReady(currentPlayer.isReady);
      }
    };

    const handleGameStarted = (data: any) => {
      setGameStarting(true);
      localStorage.setItem('gamePlayerId', data.playerMapping[storedPlayerId || '']);
      setTimeout(() => {
        router.push(`/game/${id}`);
      }, 1000);
    };

    on('room:updated', handleRoomUpdated);
    on('game:started', handleGameStarted);

    const fetchRoomState = async () => {
      try {
        const res = await fetch(`/api/rooms/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setRoom(data);
            const currentPlayer = storedPlayerId ? data.players.find((p: any) => p.id === storedPlayerId) : null;
            if (currentPlayer) {
              setIsHost(currentPlayer.isHost);
              setIsReady(currentPlayer.isReady);
            }
            return;
          }
        }
      } catch (e) {
        console.log('HTTP fetch failed, trying WebSocket...');
      }

      emit('room:get-state', { roomId: id, playerId: storedPlayerId || undefined }, (response: any) => {
        if (response?.success) {
          setRoom(response.roomState);
          if (response.playerId) {
            setPlayerId(response.playerId);
            localStorage.setItem('playerId', response.playerId);
          }
          const currentPlayer = storedPlayerId || response.playerId
            ? response.roomState.players.find((p: any) => p.id === (storedPlayerId || response.playerId))
            : null;
          if (currentPlayer) {
            setIsHost(currentPlayer.isHost);
            setIsReady(currentPlayer.isReady);
          }
        } else {
          setTimeout(fetchRoomState, 1000);
        }
      });
    };

    fetchRoomState();

    return () => {
      off('room:updated', handleRoomUpdated);
      off('game:started', handleGameStarted);
    };
  }, [id, connect, on, off, emit, router]);

  const handleToggleReady = () => {
    emit('room:ready', { isReady: !isReady });
  };

  const handleStartGame = () => {
    emit('game:start');
  };

  const handleLeaveRoom = () => {
    router.push('/');
  };

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-mars-950 via-gray-900 to-mars-900 flex items-center justify-center">
        <div className="text-white text-xl">加载中...</div>
      </div>
    );
  }

  if (gameStarting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-mars-950 via-gray-900 to-mars-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🚀</div>
          <div className="text-white text-2xl">游戏即将开始...</div>
        </div>
      </div>
    );
  }

  const readyCount = room.players.filter(p => p.isReady).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-mars-950 via-gray-900 to-mars-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={handleLeaveRoom}
            className="btn-secondary"
          >
            ← 返回
          </button>
          <div className="text-right">
            <div className="text-sm text-gray-400">连接状态</div>
            <div className={isConnected ? 'text-green-400' : 'text-red-400'}>
              {isConnected ? '🟢 已连接' : '🔴 未连接'}
            </div>
          </div>
        </div>

        <div className="panel rounded-2xl p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-mars-400 mb-2">{room.name}</h1>
              <p className="text-gray-400">
                地图半径: {room.settings.mapRadius} · 总回合数: {room.settings.maxTurns} · 回合时限: {room.settings.turnTimeout / 1000}秒
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{room.players.length}/{room.maxPlayers}</div>
              <div className="text-sm text-gray-400">玩家</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {room.players.map((player) => (
              <div
                key={player.id}
                className="bg-gray-800/50 rounded-xl p-4 border-2 transition-all"
                style={{ borderColor: player.isReady ? '#22c55e' : 'rgba(255,255,255,0.1)' }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                    style={{ backgroundColor: player.color }}
                  >
                    {player.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold">
                      {player.name}
                      {player.isHost && <span className="ml-2 text-yellow-400 text-sm">👑</span>}
                      {player.id === playerId && <span className="ml-2 text-mars-400 text-sm">(你)</span>}
                    </div>
                    <div className="text-sm" style={{ color: player.isReady ? '#22c55e' : '#9ca3af' }}>
                      {player.isReady ? '✓ 已准备' : '等待中...'}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {Array.from({ length: Math.max(0, 4 - room.players.length) }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="bg-gray-800/30 rounded-xl p-4 border-2 border-dashed border-gray-700 flex items-center justify-center"
              >
                <div className="text-gray-600 text-center">
                  <div className="text-2xl mb-1">➕</div>
                  <div className="text-sm">等待玩家</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-4 justify-center">
            {!isHost ? (
              <button
                onClick={handleToggleReady}
                disabled={gameStarting}
                className={`px-8 py-3 rounded-lg font-bold text-lg transition-all ${
                  isReady
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'btn-primary'
                } disabled:opacity-50`}
              >
                {isReady ? '✓ 已准备就绪' : '准备就绪'}
              </button>
            ) : (
              <button
                onClick={handleStartGame}
                disabled={readyCount < 4 || gameStarting}
                className="btn-primary px-8 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {readyCount < 4
                  ? `需要至少 4 名玩家准备 (${readyCount}/4)`
                  : '🚀 开始游戏'}
              </button>
            )}
          </div>
        </div>

        <div className="panel rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4 text-mars-400">游戏规则概览</h2>
          <div className="grid md:grid-cols-2 gap-6 text-gray-300">
            <div>
              <h3 className="font-semibold text-white mb-2">🎯 目标</h3>
              <p className="text-sm">在有限回合内建成最大规模的殖民地并获得最高综合评分</p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">🗺️ 地图</h3>
              <p className="text-sm">六边形网格，多种地貌：陨石坑、峡谷、极冠冰原、熔岩管、平原</p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">🏗️ 建造</h3>
              <p className="text-sm">7种设施：居住舱、温室、采矿站、太阳能阵列、核反应堆、水回收厂、发射台</p>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">📊 评分</h3>
              <p className="text-sm">领地25% + 人口25% + 科研20% + 资源15% + 贸易15%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
