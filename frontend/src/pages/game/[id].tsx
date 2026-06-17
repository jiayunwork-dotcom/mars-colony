import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSocket } from '../../hooks/useSocket';
import { HexMap } from '../../components/HexMap';
import { ResourcePanel } from '../../components/ResourcePanel';
import { TurnTimer } from '../../components/TurnTimer';
import { BuildMenu } from '../../components/BuildMenu';
import { ResearchTree } from '../../components/ResearchTree';
import { TradePanel } from '../../components/TradePanel';
import { ChatPanel } from '../../components/ChatPanel';
import { DisasterPanel } from '../../components/DisasterPanel';
import { PopulationPanel } from '../../components/PopulationPanel';
import type {
  GameState,
  HexCoord,
  FacilityType,
  ProfessionType,
  Resources,
  ChatMessage,
  PlayerAction,
} from '../../types/game';

type TabType = 'build' | 'research' | 'trade' | 'population';

export default function Game() {
  const router = useRouter();
  const { id } = router.query;
  const { connect, emit, on, off, isConnected } = useSocket();

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [selectedTile, setSelectedTile] = useState<HexCoord | null>(null);
  const [buildMode, setBuildMode] = useState<FacilityType | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('build');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showEndScreen, setShowEndScreen] = useState(false);

  useEffect(() => {
    if (!id) return;

    const socket = connect();
    const storedGamePlayerId = localStorage.getItem('gamePlayerId');
    if (storedGamePlayerId) {
      setPlayerId(storedGamePlayerId);
    }

    const handleTurnCompleted = (data: { gameState: GameState }) => {
      setGameState(data.gameState);
      if (data.gameState.phase === 'ended') {
        setShowEndScreen(true);
      }
    };

    const handleTurnStarted = () => {
      setBuildMode(null);
      setSelectedTile(null);
    };

    const handleChatMessage = (msg: ChatMessage) => {
      setMessages(prev => [...prev.slice(-50), msg]);
    };

    const handleGameEnded = () => {
      setShowEndScreen(true);
    };

    const handlePlayerDisconnected = (data: { playerId: string }) => {
      setMessages(prev => [
        ...prev,
        {
          playerId: 'system',
          playerName: '系统',
          message: `玩家 ${data.playerId} 已断开连接`,
          timestamp: Date.now(),
        },
      ]);
    };

    on('turn:completed', handleTurnCompleted);
    on('turn:started', handleTurnStarted);
    on('chat:message', handleChatMessage);
    on('game:ended', handleGameEnded);
    on('player:disconnected', handlePlayerDisconnected);

    emit('game:get-state', { roomId: id }, (response: any) => {
      if (response?.success) {
        setGameState(response.gameState);
      }
    });

    return () => {
      off('turn:completed', handleTurnCompleted);
      off('turn:started', handleTurnStarted);
      off('chat:message', handleChatMessage);
      off('game:ended', handleGameEnded);
      off('player:disconnected', handlePlayerDisconnected);
    };
  }, [id, connect, on, off, emit]);

  const currentPlayer = gameState && playerId ? gameState.players[playerId] : null;

  const submitAction = useCallback((action: PlayerAction) => {
    emit('game:action', { action });
  }, [emit]);

  const handleBuild = useCallback((coord: HexCoord, type: FacilityType) => {
    submitAction({
      type: 'build_facility',
      payload: { coord, facilityType: type },
    });
    setBuildMode(null);
    setSelectedTile(null);
  }, [submitAction]);

  const handleDemolish = useCallback((coord: HexCoord) => {
    if (confirm('确定要拆除这个设施吗？')) {
      submitAction({
        type: 'demolish_facility',
        payload: { coord },
      });
      setSelectedTile(null);
    }
  }, [submitAction]);

  const handleRecruit = useCallback((profession: ProfessionType) => {
    submitAction({
      type: 'recruit_colonist',
      payload: { profession },
    });
  }, [submitAction]);

  const handleCreateTrade = useCallback((
    toPlayerId: string,
    offer: Partial<Resources>,
    request: Partial<Resources>
  ) => {
    submitAction({
      type: 'trade_offer',
      payload: { toPlayerId, offerResources: offer, requestResources: request },
    });
  }, [submitAction]);

  const handleAcceptTrade = useCallback((tradeId: string) => {
    submitAction({
      type: 'trade_response',
      payload: { tradeId, accepted: true },
    });
  }, [submitAction]);

  const handleRejectTrade = useCallback((tradeId: string) => {
    submitAction({
      type: 'trade_response',
      payload: { tradeId, accepted: false },
    });
  }, [submitAction]);

  const handleCancelTrade = useCallback((tradeId: string) => {
    submitAction({
      type: 'trade_response',
      payload: { tradeId, accepted: false },
    });
  }, [submitAction]);

  const handleEndTurn = useCallback(() => {
    emit('room:ready', { isReady: true });
  }, [emit]);

  const handleSendMessage = useCallback((message: string) => {
    emit('chat:send', { message });
  }, [emit]);

  const handleLeaveGame = () => {
    router.push('/');
  };

  if (!gameState || !currentPlayer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-mars-950 via-gray-900 to-mars-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🚀</div>
          <div className="text-white text-xl">加载游戏中...</div>
          <div className="text-gray-400 text-sm mt-2">
            {isConnected ? '已连接服务器' : '正在连接...'}
          </div>
        </div>
      </div>
    );
  }

  const sortedPlayers = Object.values(gameState.players).sort(
    (a, b) => b.score.total - a.score.total
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-mars-950 via-gray-900 to-mars-900 p-3">
      <div className="max-w-[1920px] mx-auto">
        <div className="mb-3">
          <ResourcePanel player={currentPlayer} />
        </div>

        <div className="grid grid-cols-12 gap-3" style={{ height: 'calc(100vh - 140px)' }}>
          <div className="col-span-3 space-y-3 overflow-y-auto">
            <TurnTimer
              gameState={gameState}
              player={currentPlayer}
              onEndTurn={handleEndTurn}
            />

            <DisasterPanel gameState={gameState} />

            <div className="panel rounded-xl p-4">
              <h3 className="text-lg font-bold mb-3 text-mars-400">🏆 排行榜</h3>
              <div className="space-y-2">
                {sortedPlayers.map((p, i) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-2 rounded-lg ${
                      p.id === playerId
                        ? 'bg-mars-600/30 border border-mars-500'
                        : 'bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold w-6 text-center">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </span>
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ backgroundColor: p.color }}
                      >
                        {p.name.charAt(0)}
                      </div>
                      <span className="font-semibold text-sm">
                        {p.name}
                        {p.disconnected && <span className="text-red-400 ml-1 text-xs">(掉线)</span>}
                      </span>
                    </div>
                    <span className="font-bold text-yellow-400">{p.score.total}</span>
                  </div>
                ))}
              </div>
            </div>

            <PopulationPanel player={currentPlayer} onRecruit={handleRecruit} />
          </div>

          <div className="col-span-6 flex flex-col gap-3">
            <div className="flex-1 min-h-0">
              <HexMap
                gameState={gameState}
                playerId={playerId}
                selectedTile={selectedTile}
                onTileSelect={setSelectedTile}
                buildMode={buildMode}
              />
            </div>

            <ChatPanel messages={messages} onSendMessage={handleSendMessage} />
          </div>

          <div className="col-span-3 space-y-3 overflow-y-auto">
            <div className="panel rounded-xl p-2">
              <div className="grid grid-cols-4 gap-1">
                {(['build', 'research', 'trade', 'population'] as TabType[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-2 px-1 rounded-lg text-xs font-semibold transition-colors ${
                      activeTab === tab
                        ? 'bg-mars-600 text-white'
                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-white'
                    }`}
                  >
                    {tab === 'build' && '🏗️ 建造'}
                    {tab === 'research' && '🔬 科研'}
                    {tab === 'trade' && '🤝 贸易'}
                    {tab === 'population' && '👥 人口'}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === 'build' && (
              <BuildMenu
                player={currentPlayer}
                gameState={gameState}
                buildMode={buildMode}
                selectedTile={selectedTile}
                onSelectBuild={setBuildMode}
                onBuild={handleBuild}
                onDemolish={handleDemolish}
              />
            )}

            {activeTab === 'research' && (
              <ResearchTree player={currentPlayer} />
            )}

            {activeTab === 'trade' && (
              <TradePanel
                gameState={gameState}
                currentPlayerId={playerId}
                onCreateTrade={handleCreateTrade}
                onAcceptTrade={handleAcceptTrade}
                onRejectTrade={handleRejectTrade}
                onCancelTrade={handleCancelTrade}
              />
            )}

            {activeTab === 'population' && (
              <PopulationPanel player={currentPlayer} onRecruit={handleRecruit} />
            )}

            <button
              onClick={handleLeaveGame}
              className="w-full btn-secondary"
            >
              ← 离开游戏
            </button>
          </div>
        </div>
      </div>

      {showEndScreen && gameState.phase === 'ended' && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="panel rounded-2xl p-8 max-w-2xl w-full">
            <h2 className="text-4xl font-bold text-center mb-6 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
              🏆 游戏结束！
            </h2>

            {gameState.winner && gameState.players[gameState.winner] && (
              <div className="text-center mb-6">
                <div
                  className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-3xl font-bold mb-3"
                  style={{ backgroundColor: gameState.players[gameState.winner].color }}
                >
                  {gameState.players[gameState.winner].name.charAt(0)}
                </div>
                <div className="text-2xl font-bold">
                  {gameState.winner === playerId ? '🎉 恭喜你获胜！' : `${gameState.players[gameState.winner].name} 获胜！`}
                </div>
              </div>
            )}

            <div className="space-y-2 mb-6">
              {sortedPlayers.map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-3 rounded-xl ${
                    p.id === playerId
                      ? 'bg-mars-600/30 border-2 border-mars-500'
                      : i === 0
                      ? 'bg-yellow-600/20 border-2 border-yellow-500'
                      : 'bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold w-10 text-center">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </span>
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.name.charAt(0)}
                    </div>
                    <span className="font-semibold text-lg">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-yellow-400">{p.score.total}</div>
                    <div className="text-xs text-gray-400">
                      领地{p.score.territory} · 人口{p.score.population} · 科研{p.score.research} · 资源{p.score.resources} · 贸易{p.score.trade}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={handleLeaveGame}
                className="btn-primary px-8 py-3 text-lg"
              >
                返回大厅
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
