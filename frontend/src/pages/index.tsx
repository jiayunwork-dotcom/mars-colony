import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSocket } from '../hooks/useSocket';
import type { RoomState } from '../types/game';

export default function Home() {
  const router = useRouter();
  const { connect, emit, on, isConnected } = useSocket();
  const [playerName, setPlayerName] = useState('');
  const [roomName, setRoomName] = useState('火星殖民室');
  const [rooms, setRooms] = useState<RoomState[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    connect();
    fetchRooms();
  }, [connect]);

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (e) {
      console.error('Failed to fetch rooms:', e);
    }
  };

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      alert('请输入你的名字');
      return;
    }
    if (!roomName.trim()) {
      alert('请输入房间名');
      return;
    }

    setIsLoading(true);
    emit('room:create', {
      playerName: playerName.trim(),
      roomName: roomName.trim(),
      settings: { mapRadius: 5, maxTurns: 50, turnTimeout: 30000 },
    }, (response: any) => {
      setIsLoading(false);
      if (response?.success) {
        localStorage.setItem('playerId', response.playerId);
        localStorage.setItem('roomId', response.roomId);
        router.push(`/room/${response.roomId}`);
      } else {
        alert(response?.error || '创建房间失败');
      }
    });
  };

  const handleJoinRoom = (roomId: string) => {
    if (!playerName.trim()) {
      alert('请输入你的名字');
      return;
    }

    setIsLoading(true);
    emit('room:join', {
      roomId,
      playerName: playerName.trim(),
    }, (response: any) => {
      setIsLoading(false);
      if (response?.success) {
        localStorage.setItem('playerId', response.playerId);
        localStorage.setItem('roomId', roomId);
        router.push(`/room/${roomId}`);
      } else {
        alert(response?.error || '加入房间失败');
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-mars-950 via-gray-900 to-mars-900 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-6xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-mars-400 to-orange-500 mb-4">
              🔴 火星殖民
            </h1>
            <p className="text-gray-400 text-xl">
              多人回合制火星殖民资源竞赛策略游戏
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="panel rounded-2xl p-8">
              <h2 className="text-2xl font-bold mb-6 text-mars-400">创建 / 加入房间</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">你的名字</label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-mars-500 text-white"
                    placeholder="输入你的名字..."
                    maxLength={20}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">房间名称（创建时使用）</label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-mars-500 text-white"
                    placeholder="输入房间名称..."
                    maxLength={30}
                  />
                </div>

                <button
                  onClick={handleCreateRoom}
                  disabled={isLoading}
                  className="w-full btn-primary py-3 text-lg disabled:opacity-50"
                >
                  {isLoading ? '处理中...' : '🚀 创建新房间'}
                </button>
              </div>
            </div>

            <div className="panel rounded-2xl p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-mars-400">可用房间</h2>
                <button
                  onClick={fetchRooms}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  🔄 刷新
                </button>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                {rooms.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    暂无可用房间，创建一个新房间吧！
                  </div>
                ) : (
                  rooms.map((room) => (
                    <div
                      key={room.id}
                      className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 hover:border-mars-500 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">{room.name}</h3>
                          <p className="text-sm text-gray-400">
                            玩家: {room.players.length}/{room.maxPlayers} · 回合: {room.settings.maxTurns}
                          </p>
                        </div>
                        <button
                          onClick={() => handleJoinRoom(room.id)}
                          disabled={room.players.length >= room.maxPlayers || isLoading}
                          className="btn-primary px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          加入
                        </button>
                      </div>
                      <div className="flex gap-2 mt-3">
                        {room.players.map((p) => (
                          <div
                            key={p.id}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                            style={{ backgroundColor: p.color }}
                            title={p.name}
                          >
                            {p.name.charAt(0)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="panel rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">🗺️</div>
              <h3 className="font-semibold mb-1">六边形地图</h3>
              <p className="text-sm text-gray-400">多种地貌类型</p>
            </div>
            <div className="panel rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">🏗️</div>
              <h3 className="font-semibold mb-1">7种设施</h3>
              <p className="text-sm text-gray-400">协同效应策略</p>
            </div>
            <div className="panel rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">🔬</div>
              <h3 className="font-semibold mb-1">6条科研路线</h3>
              <p className="text-sm text-gray-400">科技解锁升级</p>
            </div>
            <div className="panel rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">👥</div>
              <h3 className="font-semibold mb-1">4-8人对战</h3>
              <p className="text-sm text-gray-400">同步回合制</p>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center py-4 text-gray-600 text-sm">
        {isConnected ? '🟢 已连接到服务器' : '🔴 连接中...'}
      </div>
    </div>
  );
}
