import React, { useState, useMemo } from 'react';
import { GameState, Player, DisasterSettlement, DisasterHistoryEntry, JointDefenseProtocol, JointDefenseRequest } from '../types/game';
import { DISASTER_CONFIG, WARNING_LEVEL_CONFIG, FACILITY_CONFIG, hexKey, hexDistance } from '../lib/gameConfig';

interface DefensePanelProps {
  gameState: GameState;
  player: Player;
  onSettlementClose?: () => void;
  showDefenseOverlay: boolean;
  onToggleDefenseOverlay: (show: boolean) => void;
  onJointDefenseRequest?: (toPlayerId: string) => void;
  onJointDefenseCancel?: (requestId: string) => void;
  onJointDefenseTerminate?: (protocolId: string) => void;
}

export const DefensePanel: React.FC<DefensePanelProps> = ({
  gameState,
  player,
  onSettlementClose,
  showDefenseOverlay,
  onToggleDefenseOverlay,
  onJointDefenseRequest,
  onJointDefenseCancel,
  onJointDefenseTerminate,
}) => {
  const warnings = gameState.disasterWarnings;
  const activeDisasters = gameState.activeDisasters;
  const history = gameState.disasterHistory;
  const [selectedHistory, setSelectedHistory] = useState<DisasterHistoryEntry | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);

  const defenseFacilities = Object.values(gameState.map.tiles).filter(
    t => t.facility && FACILITY_CONFIG[t.facility.type]?.isDefense && t.ownerId === player.id
  );

  const myProtocols = useMemo(() => {
    return (gameState.jointDefenseProtocols || []).filter(
      p => (p.playerAId === player.id || p.playerBId === player.id) && p.status !== 'terminated'
    );
  }, [gameState.jointDefenseProtocols, player.id]);

  const myPendingRequests = useMemo(() => {
    return (gameState.pendingJointDefenseRequests || []).filter(
      r => r.toPlayerId === player.id || r.fromPlayerId === player.id
    );
  }, [gameState.pendingJointDefenseRequests, player.id]);

  const incomingRequests = useMemo(() => {
    return myPendingRequests.filter(r => r.toPlayerId === player.id);
  }, [myPendingRequests, player.id]);

  const outgoingRequests = useMemo(() => {
    return myPendingRequests.filter(r => r.fromPlayerId === player.id);
  }, [myPendingRequests, player.id]);

  const activeProtocolCount = useMemo(() => {
    return (gameState.jointDefenseProtocols || []).filter(
      p => (p.playerAId === player.id || p.playerBId === player.id) && p.status === 'active'
    ).length;
  }, [gameState.jointDefenseProtocols, player.id]);

  const allyShieldInfo = useMemo(() => {
    const result: Array<{
      protocolId: string;
      allyId: string;
      allyName: string;
      shieldCount: number;
      coveredTileCount: number;
      status: string;
    }> = [];

    const tiles = Object.values(gameState.map.tiles);

    for (const protocol of myProtocols) {
      const allyId = protocol.playerAId === player.id ? protocol.playerBId : protocol.playerAId;
      const allyPlayer = gameState.players[allyId];

      let shieldCount = 0;
      const coveredCoords = new Set<string>();

      for (const tile of tiles) {
        if (
          tile.facility?.type === 'shield_generator' &&
          tile.ownerId === allyId &&
          !tile.facility.isDisabled &&
          tile.facility.durability > 0
        ) {
          shieldCount++;
          const radius = FACILITY_CONFIG.shield_generator.shieldRadius || 1;
          for (const otherTile of tiles) {
            if (hexDistance(tile.coord, otherTile.coord) <= radius) {
              coveredCoords.add(`${otherTile.coord.q},${otherTile.coord.r}`);
            }
          }
        }
      }

      result.push({
        protocolId: protocol.id,
        allyId,
        allyName: allyPlayer?.name || allyId,
        shieldCount,
        coveredTileCount: coveredCoords.size,
        status: protocol.status,
      });
    }

    return result;
  }, [myProtocols, gameState.players, gameState.map.tiles, player.id]);

  const availablePlayers = useMemo(() => {
    return Object.values(gameState.players).filter(p => {
      if (p.id === player.id) return false;
      if (p.disconnected) return false;
      const existingProtocol = (gameState.jointDefenseProtocols || []).find(
        proto =>
          (proto.playerAId === player.id && proto.playerBId === p.id) ||
          (proto.playerAId === p.id && proto.playerBId === player.id)
      );
      if (existingProtocol && existingProtocol.status !== 'terminated') return false;
      const existingMyRequest = (gameState.pendingJointDefenseRequests || []).find(
        r => r.fromPlayerId === player.id && r.toPlayerId === p.id
      );
      if (existingMyRequest) return false;
      const theirCount = (gameState.jointDefenseProtocols || []).filter(
        proto => (proto.playerAId === p.id || proto.playerBId === p.id) && proto.status === 'active'
      ).length;
      if (theirCount >= 2) return false;
      return true;
    });
  }, [gameState.players, gameState.jointDefenseProtocols, gameState.pendingJointDefenseRequests, player.id]);

  const statusLabel: Record<string, { text: string; color: string }> = {
    active: { text: '生效中', color: '#22c55e' },
    invalid: { text: '无效', color: '#ef4444' },
    terminated: { text: '已解约', color: '#6b7280' },
  };

  return (
    <div className="space-y-3">
      {warnings.length > 0 && (
        <div className="panel rounded-xl p-3">
          <h3 className="text-sm font-bold mb-2 text-yellow-400">⚠️ 灾害预警</h3>
          <div className="space-y-2">
            {warnings.map(w => {
              const disasterConfig = DISASTER_CONFIG[w.disasterType];
              const warningConfig = WARNING_LEVEL_CONFIG[w.warningLevel];
              return (
                <div
                  key={w.id}
                  className="p-2 rounded-lg text-xs"
                  style={{
                    backgroundColor: warningConfig.bgColor,
                    borderLeft: `3px solid ${warningConfig.color}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{disasterConfig.icon}</span>
                      <span className="font-semibold">{disasterConfig.name}</span>
                      <span
                        className="px-1.5 py-0.5 rounded text-xs font-bold"
                        style={{
                          backgroundColor: warningConfig.color + '33',
                          color: warningConfig.color,
                        }}
                      >
                        {warningConfig.name}
                      </span>
                    </div>
                    <span className="font-bold" style={{ color: warningConfig.color }}>
                      {w.turnsUntilArrival} 回合后到达
                    </span>
                  </div>
                  <p className="text-gray-400 mb-1">{disasterConfig.warningDescription}</p>
                  <div className="flex gap-3 text-gray-500">
                    <span>🏢 风险建筑: {w.estimatedLosses.buildingsAtRisk}</span>
                    <span>👥 风险人口: {w.estimatedLosses.populationAtRisk}</span>
                    <span>📍 影响范围: {w.affectedTiles.length}格</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeDisasters.length > 0 && (
        <div className="panel rounded-xl p-3">
          <h3 className="text-sm font-bold mb-2 text-red-400">🔥 活跃灾害</h3>
          <div className="space-y-2">
            {activeDisasters.map(d => {
              const config = DISASTER_CONFIG[d.type];
              return (
                <div
                  key={d.id}
                  className="p-2 rounded-lg text-xs"
                  style={{ backgroundColor: config.color + '22', borderLeft: `3px solid ${config.color}` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{config.icon}</span>
                      <span className="font-semibold">{config.name}</span>
                    </div>
                    <span className="text-xs" style={{ color: config.color }}>
                      剩余 {d.turnsRemaining} 回合
                    </span>
                  </div>
                  <p className="text-gray-400 mt-1">{config.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="panel rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-blue-400">🛡️ 防御设施状态</h3>
          <button
            onClick={() => onToggleDefenseOverlay(!showDefenseOverlay)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              showDefenseOverlay
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {showDefenseOverlay ? '✓ 显示覆盖范围' : '显示防御覆盖'}
          </button>
        </div>
        {defenseFacilities.length === 0 ? (
          <div className="text-center text-gray-500 text-xs py-2">
            未部署任何防御设施
          </div>
        ) : (
          <div className="space-y-2">
            {defenseFacilities.map(tile => {
              if (!tile.facility) return null;
              const config = FACILITY_CONFIG[tile.facility.type] as any;
              const f = tile.facility as any;
              const maxDur = f.maxDurability || config?.baseDurability || 100;
              const dur = f.durability !== undefined ? f.durability : maxDur;
              const durabilityPct = (dur / maxDur) * 100;
              const durabilityColor = durabilityPct > 60 ? '#22c55e' : durabilityPct > 30 ? '#eab308' : '#ef4444';
              return (
                <div key={hexKey(tile.coord.q, tile.coord.r)} className="p-2 bg-gray-800/50 rounded-lg text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span>{config.icon}</span>
                      <span className="font-semibold">{config.name}</span>
                    </div>
                    {tile.facility.type === 'shelter' && (
                      <span className="text-gray-400">容量: {f.shelterCapacity || config.shelterCapacity}</span>
                    )}
                    {tile.facility.type === 'shield_generator' && (
                      <span className="text-gray-400">覆盖半径: {config.shieldRadius}格</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-xs">耐久</span>
                    <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${durabilityPct}%`,
                          backgroundColor: durabilityColor,
                        }}
                      />
                    </div>
                    <span className="text-xs" style={{ color: durabilityColor }}>
                      {dur}/{maxDur}
                    </span>
                  </div>
                  {f.isDisabled && (
                    <div className="text-red-400 text-xs mt-1">⚠️ 已停用</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="panel rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-cyan-400">🤝 联防协议</h3>
          <span className="text-xs text-gray-500">{activeProtocolCount}/2 协议</span>
        </div>

        {myProtocols.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {myProtocols.map(protocol => {
              const info = allyShieldInfo.find(a => a.protocolId === protocol.id);
              const sl = statusLabel[protocol.status] || statusLabel.active;
              return (
                <div key={protocol.id} className="p-2 bg-gray-800/50 rounded-lg text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold" style={{ color: gameState.players[info?.allyId || '']?.color || '#fff' }}>
                        {info?.allyName || '未知'}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                        style={{
                          backgroundColor: sl.color + '22',
                          color: sl.color,
                        }}
                      >
                        {sl.text}
                      </span>
                    </div>
                    {onJointDefenseTerminate && protocol.status !== 'terminated' && (
                      <button
                        onClick={() => onJointDefenseTerminate(protocol.id)}
                        className="text-[10px] px-1.5 py-0.5 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 transition-colors"
                      >
                        解约
                      </button>
                    )}
                  </div>
                  {info && (
                    <div className="flex gap-3 text-gray-400 text-[10px]">
                      <span>🛡️ 共享防护罩: {info.shieldCount}个</span>
                      <span>📍 覆盖格子: {info.coveredTileCount}格</span>
                    </div>
                  )}
                  {protocol.status === 'invalid' && (
                    <div className="text-[10px] text-gray-500 mt-1">
                      提示：任一方防护罩全部摧毁后协议暂时无效，重建防护罩后自动恢复
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {incomingRequests.length > 0 && (
          <div className="mb-2">
            <div className="text-xs text-yellow-400 font-semibold mb-1">📨 收到的请求</div>
            <div className="space-y-1">
              {incomingRequests.map(req => {
                const fromPlayer = gameState.players[req.fromPlayerId];
                const sameTurn = req.turnCreated === gameState.currentTurn;
                return (
                  <div key={req.id} className="p-1.5 bg-yellow-900/20 border border-yellow-800/30 rounded text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span>
                        <span className="font-semibold" style={{ color: fromPlayer?.color || '#fff' }}>
                          {fromPlayer?.name || req.fromPlayerId}
                        </span>
                        <span className="text-gray-400 ml-1">向你发起联防请求</span>
                      </span>
                      <span className="text-[10px] text-gray-500">回合 {req.turnCreated}</span>
                    </div>
                    {onJointDefenseRequest && sameTurn && (
                      <button
                        onClick={() => onJointDefenseRequest(req.fromPlayerId)}
                        className="text-[10px] w-full py-1 bg-cyan-900/30 text-cyan-400 rounded hover:bg-cyan-900/50 border border-cyan-800/30"
                      >
                        我也申请联防（本回合内互发即生效）
                      </button>
                    )}
                    {!sameTurn && (
                      <div className="text-[10px] text-gray-500">
                        已过期（需在同一回合内互发请求才能生效）
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {outgoingRequests.length > 0 && (
          <div className="mb-2">
            <div className="text-xs text-gray-500 font-semibold mb-1">📤 已发送请求</div>
            <div className="space-y-1">
              {outgoingRequests.map(req => {
                const toPlayer = gameState.players[req.toPlayerId];
                const sameTurn = req.turnCreated === gameState.currentTurn;
                return (
                  <div key={req.id} className="p-1.5 bg-gray-800/30 rounded text-xs flex items-center justify-between">
                    <div>
                      <span className="font-semibold" style={{ color: toPlayer?.color || '#fff' }}>
                        {toPlayer?.name || req.toPlayerId}
                      </span>
                      <span className="text-gray-500 ml-1">
                        {sameTurn ? '等待对方回应' : '已过期'}
                      </span>
                    </div>
                    {onJointDefenseCancel && (
                      <button
                        onClick={() => onJointDefenseCancel(req.id)}
                        className="text-[10px] px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded hover:bg-gray-600"
                      >
                        取消
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {onJointDefenseRequest && (
          <button
            onClick={() => setShowRequestModal(true)}
            disabled={activeProtocolCount >= 2}
            className={`w-full text-xs py-1.5 rounded-lg transition-colors ${
              activeProtocolCount >= 2
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-cyan-900/30 text-cyan-400 hover:bg-cyan-900/50 border border-cyan-800/30'
            }`}
          >
            {activeProtocolCount >= 2 ? '协议已满(2/2)' : '+ 发起联防请求'}
          </button>
        )}

        {myProtocols.length === 0 && incomingRequests.length === 0 && outgoingRequests.length === 0 && (
          <div className="text-center text-gray-500 text-xs py-1">
            暂无联防协议
          </div>
        )}

        <div className="mt-2 text-[10px] text-gray-600 text-center">
          💡 双方在同一回合内互相发出请求，协议自动生效
        </div>
      </div>

      {showRequestModal && onJointDefenseRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={() => setShowRequestModal(false)}>
          <div className="panel rounded-xl p-4 max-w-xs w-full" onClick={e => e.stopPropagation()}>
            <h4 className="text-sm font-bold text-cyan-400 mb-3">🤝 发起联防请求</h4>
            <p className="text-[11px] text-gray-400 mb-3">
              向对方发出联防请求后，需对方在同一回合也向你发出请求，协议才会自动生效。
            </p>
            {availablePlayers.length === 0 ? (
              <div className="text-xs text-gray-500 text-center py-2">没有可签约的玩家</div>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {availablePlayers.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onJointDefenseRequest(p.id);
                      setShowRequestModal(false);
                    }}
                    className="w-full p-2 bg-gray-800/50 rounded-lg text-xs text-left hover:bg-gray-700/50 transition-colors flex items-center gap-2"
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.name.charAt(0)}
                    </div>
                    <span className="font-semibold">{p.name}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowRequestModal(false)}
              className="w-full mt-3 text-xs py-1.5 bg-gray-700 text-gray-400 rounded-lg hover:bg-gray-600"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="panel rounded-xl p-3">
        <h3 className="text-sm font-bold mb-2 text-gray-400">📜 历史灾害记录</h3>
        {history.length === 0 ? (
          <div className="text-center text-gray-500 text-xs py-2">
            暂无灾害记录
          </div>
        ) : (
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {[...history].reverse().map((entry, i) => {
              const config = DISASTER_CONFIG[entry.disasterType];
              const s = entry.settlement;
              return (
                <div
                  key={i}
                  className="p-1.5 bg-gray-800/30 rounded text-xs cursor-pointer hover:bg-gray-700/40 transition-colors"
                  onClick={() => setSelectedHistory(entry)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span>{config.icon}</span>
                      <span className="font-semibold">{config.name}</span>
                      <span className="text-gray-500">回合{entry.turn}</span>
                    </div>
                    <span className="text-gray-500 text-[10px]">🔍 点击查看</span>
                  </div>
                  <div className="flex gap-3 text-gray-500 mt-0.5">
                    {s.buildingsDestroyed.length > 0 && (
                      <span className="text-red-400">摧毁建筑{s.buildingsDestroyed.length}</span>
                    )}
                    {s.buildingsDamaged.length > 0 && (
                      <span className="text-yellow-400">受损{s.buildingsDamaged.length}</span>
                    )}
                    {s.populationCasualties > 0 && (
                      <span className="text-red-400">伤亡{s.populationCasualties}</span>
                    )}
                    {s.defenseSuccesses.length > 0 && (
                      <span className="text-green-400">抵御{s.defenseSuccesses.length}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedHistory && (
        <SettlementModal
          settlement={selectedHistory.settlement}
          onClose={() => setSelectedHistory(null)}
          title={`${DISASTER_CONFIG[selectedHistory.disasterType].name} · 历史记录 · 回合 ${selectedHistory.turn}`}
          players={gameState.players}
        />
      )}
    </div>
  );
};

interface SettlementModalProps {
  settlement: DisasterSettlement;
  onClose: () => void;
  title?: string;
  players?: Record<string, Player>;
}

export const SettlementModal: React.FC<SettlementModalProps> = ({ settlement, onClose, title, players }) => {
  const config = DISASTER_CONFIG[settlement.disasterType];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div
        className="panel rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">{config.icon}</div>
          <h2 className="text-2xl font-bold" style={{ color: config.color }}>
            {title || `${config.name} 灾害结算`}
          </h2>
          {!title && <p className="text-gray-400 text-sm mt-1">回合 {settlement.turn}</p>}
        </div>

        <div className="space-y-3">
          {settlement.buildingsDestroyed.length > 0 && (
            <div className="p-3 bg-red-900/20 border border-red-800/50 rounded-lg">
              <h4 className="text-red-400 font-semibold text-sm mb-2">💥 建筑被摧毁 ({settlement.buildingsDestroyed.length})</h4>
              {settlement.buildingsDestroyed.map((b, i) => (
                <div key={i} className="text-xs text-gray-300 flex items-center gap-1">
                  <span>{FACILITY_CONFIG[b.facilityType]?.icon}</span>
                  <span>{FACILITY_CONFIG[b.facilityType]?.name}</span>
                  <span className="text-gray-500">({b.coord.q},{b.coord.r})</span>
                </div>
              ))}
            </div>
          )}

          {settlement.buildingsDamaged.length > 0 && (
            <div className="p-3 bg-yellow-900/20 border border-yellow-800/50 rounded-lg">
              <h4 className="text-yellow-400 font-semibold text-sm mb-2">🔧 建筑受损 ({settlement.buildingsDamaged.length})</h4>
              {settlement.buildingsDamaged.map((b, i) => (
                <div key={i} className="text-xs text-gray-300 flex items-center gap-1">
                  <span>{FACILITY_CONFIG[b.facilityType]?.icon}</span>
                  <span>{FACILITY_CONFIG[b.facilityType]?.name}</span>
                  <span className="text-yellow-500">耐久 -{b.durabilityLost}</span>
                  <span className="text-gray-500">({b.coord.q},{b.coord.r})</span>
                </div>
              ))}
            </div>
          )}

          {(settlement.populationCasualties > 0 || settlement.populationSavedByShelter > 0) && (
            <div className="p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg">
              <h4 className="text-gray-300 font-semibold text-sm mb-2">👥 人口伤亡</h4>
              {settlement.populationCasualties > 0 && (
                <div className="text-xs text-red-400">💀 伤亡: {settlement.populationCasualties} 人</div>
              )}
              {settlement.populationSavedByShelter > 0 && (
                <div className="text-xs text-green-400">🏛️ 避难所保护: {settlement.populationSavedByShelter} 人</div>
              )}
            </div>
          )}

          {settlement.productionInterrupted.length > 0 && (
            <div className="p-3 bg-orange-900/20 border border-orange-800/50 rounded-lg">
              <h4 className="text-orange-400 font-semibold text-sm mb-2">⚡ 产出中断</h4>
              {settlement.productionInterrupted.map((p, i) => (
                <div key={i} className="text-xs text-gray-300">
                  {FACILITY_CONFIG[p.facilityType]?.icon} {FACILITY_CONFIG[p.facilityType]?.name}
                  <span className="text-orange-400 ml-1">停产 {p.turnsInterrupted} 回合</span>
                </div>
              ))}
            </div>
          )}

          {settlement.defenseSuccesses.length > 0 && (
            <div className="p-3 bg-green-900/20 border border-green-800/50 rounded-lg">
              <h4 className="text-green-400 font-semibold text-sm mb-2">🛡️ 防御成功</h4>
              {settlement.defenseSuccesses.map((d, i) => (
                <div key={i} className="text-xs text-gray-300 flex items-center gap-1">
                  <span>{FACILITY_CONFIG[d.defenseType]?.icon}</span>
                  <span>{FACILITY_CONFIG[d.defenseType]?.name}</span>
                  <span className="text-green-400 ml-1">吸收伤害 {d.damageAbsorbed}</span>
                  {d.allyPlayerName && (
                    <span className="text-cyan-400 ml-1">[联防协议·{d.allyPlayerName}]</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {settlement.shieldedTiles.length > 0 && (
            <div className="p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg">
              <h4 className="text-blue-400 font-semibold text-sm mb-2">✨ 防护罩保护区域</h4>
              <div className="text-xs text-gray-300">{settlement.shieldedTiles.length} 个格子完全免疫灾害效果</div>
            </div>
          )}

          {settlement.buildingsDestroyed.length === 0 &&
            settlement.buildingsDamaged.length === 0 &&
            settlement.populationCasualties === 0 &&
            settlement.productionInterrupted.length === 0 && (
            <div className="p-3 bg-green-900/20 border border-green-800/50 rounded-lg text-center">
              <span className="text-green-400 text-sm">🎉 本次灾害未造成任何损失！</span>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-center">
          <button onClick={onClose} className="btn-primary px-8 py-2">
            确认
          </button>
        </div>
      </div>
    </div>
  );
};
