import React, { useState } from 'react';
import { GameState, Player, ResourceType, Resources, TradeOffer } from '../types/game';
import { RESOURCE_CONFIG } from '../lib/gameConfig';

interface TradePanelProps {
  gameState: GameState;
  currentPlayerId: string;
  onCreateTrade: (toPlayerId: string, offer: Partial<Resources>, request: Partial<Resources>) => void;
  onAcceptTrade: (tradeId: string) => void;
  onRejectTrade: (tradeId: string) => void;
  onCancelTrade: (tradeId: string) => void;
}

export const TradePanel: React.FC<TradePanelProps> = ({
  gameState,
  currentPlayerId,
  onCreateTrade,
  onAcceptTrade,
  onRejectTrade,
  onCancelTrade,
}) => {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [offerResources, setOfferResources] = useState<Partial<Resources>>({});
  const [requestResources, setRequestResources] = useState<Partial<Resources>>({});

  const resourceTypes = Object.keys(RESOURCE_CONFIG) as ResourceType[];
  const otherPlayers = Object.values(gameState.players).filter(p => p.id !== currentPlayerId);

  const handleResourceChange = (
    type: 'offer' | 'request',
    resource: ResourceType,
    value: number
  ) => {
    if (type === 'offer') {
      setOfferResources(prev => ({ ...prev, [resource]: Math.max(0, value) }));
    } else {
      setRequestResources(prev => ({ ...prev, [resource]: Math.max(0, value) }));
    }
  };

  const handleSubmit = () => {
    if (!selectedPlayer) return;
    const hasOffer = Object.values(offerResources).some(v => v && v > 0);
    const hasRequest = Object.values(requestResources).some(v => v && v > 0);
    if (!hasOffer || !hasRequest) {
      alert('请输入要提供和请求的资源');
      return;
    }
    onCreateTrade(selectedPlayer, offerResources, requestResources);
    setShowCreate(false);
    setOfferResources({});
    setRequestResources({});
    setSelectedPlayer('');
  };

  const incomingTrades = gameState.pendingTrades.filter(t => t.toPlayerId === currentPlayerId);
  const outgoingTrades = gameState.pendingTrades.filter(t => t.fromPlayerId === currentPlayerId);

  const renderResources = (resources: Partial<Resources>) => (
    <div className="flex flex-wrap gap-1">
      {Object.entries(resources)
        .filter(([_, v]) => v && v > 0)
        .map(([key, value]) => {
          const config = (RESOURCE_CONFIG as any)[key];
          return (
            <span
              key={key}
              className="text-xs px-2 py-0.5 rounded bg-gray-700"
              style={{ color: config?.color }}
            >
              {config?.icon} {value}
            </span>
          );
        })}
    </div>
  );

  return (
    <div className="panel rounded-xl p-4 max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-mars-400">🤝 贸易系统</h3>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn-primary px-3 py-1 text-sm"
        >
          {showCreate ? '取消' : '发起贸易'}
        </button>
      </div>

      {showCreate && (
        <div className="mb-4 p-4 bg-gray-800/50 rounded-lg space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">选择贸易对象</label>
            <select
              value={selectedPlayer}
              onChange={(e) => setSelectedPlayer(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
            >
              <option value="">选择玩家...</option>
              {otherPlayers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-green-400 mb-2 font-semibold">我方提供</div>
              <div className="space-y-1">
                {resourceTypes.map(res => {
                  const config = RESOURCE_CONFIG[res];
                  return (
                    <div key={res} className="flex items-center gap-2">
                      <span className="w-16 text-sm">{config.icon} {config.name}</span>
                      <input
                        type="number"
                        min={0}
                        value={(offerResources as any)[res] || 0}
                        onChange={(e) => handleResourceChange('offer', res, parseInt(e.target.value) || 0)}
                        className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="text-sm text-yellow-400 mb-2 font-semibold">请求对方</div>
              <div className="space-y-1">
                {resourceTypes.map(res => {
                  const config = RESOURCE_CONFIG[res];
                  return (
                    <div key={res} className="flex items-center gap-2">
                      <span className="w-16 text-sm">{config.icon} {config.name}</span>
                      <input
                        type="number"
                        min={0}
                        value={(requestResources as any)[res] || 0}
                        onChange={(e) => handleResourceChange('request', res, parseInt(e.target.value) || 0)}
                        className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            className="w-full btn-primary"
          >
            发送贸易请求
          </button>
        </div>
      )}

      {incomingTrades.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-green-400 mb-2">📥 收到的请求</h4>
          <div className="space-y-2">
            {incomingTrades.map(trade => {
              const fromPlayer = gameState.players[trade.fromPlayerId];
              return (
                <div key={trade.id} className="p-3 bg-gray-800/50 rounded-lg">
                  <div className="font-semibold mb-2 text-sm">
                    来自: {fromPlayer?.name}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                    <div>
                      <span className="text-gray-400">对方提供:</span>
                      {renderResources(trade.offerResources)}
                    </div>
                    <div>
                      <span className="text-gray-400">要求我方:</span>
                      {renderResources(trade.requestResources)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onAcceptTrade(trade.id)}
                      className="flex-1 py-1 bg-green-600 hover:bg-green-500 rounded text-sm"
                    >
                      接受
                    </button>
                    <button
                      onClick={() => onRejectTrade(trade.id)}
                      className="flex-1 py-1 bg-red-600 hover:bg-red-500 rounded text-sm"
                    >
                      拒绝
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {outgoingTrades.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-yellow-400 mb-2">📤 已发送</h4>
          <div className="space-y-2">
            {outgoingTrades.map(trade => {
              const toPlayer = gameState.players[trade.toPlayerId];
              return (
                <div key={trade.id} className="p-3 bg-gray-800/50 rounded-lg">
                  <div className="font-semibold mb-2 text-sm">
                    发送给: {toPlayer?.name}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                    <div>
                      <span className="text-gray-400">我方提供:</span>
                      {renderResources(trade.offerResources)}
                    </div>
                    <div>
                      <span className="text-gray-400">请求对方:</span>
                      {renderResources(trade.requestResources)}
                    </div>
                  </div>
                  <button
                    onClick={() => onCancelTrade(trade.id)}
                    className="w-full py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                  >
                    取消
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {incomingTrades.length === 0 && outgoingTrades.length === 0 && !showCreate && (
        <div className="text-center text-gray-500 py-4">
          暂无进行中的贸易
        </div>
      )}
    </div>
  );
};
