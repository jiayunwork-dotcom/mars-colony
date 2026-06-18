import React, { useState } from 'react';
import { GameState, Player, DisasterSettlement, DisasterHistoryEntry } from '../types/game';
import { DISASTER_CONFIG, WARNING_LEVEL_CONFIG, FACILITY_CONFIG, hexKey, hexDistance } from '../lib/gameConfig';

interface DefensePanelProps {
  gameState: GameState;
  player: Player;
  onSettlementClose?: () => void;
  showDefenseOverlay: boolean;
  onToggleDefenseOverlay: (show: boolean) => void;
}

export const DefensePanel: React.FC<DefensePanelProps> = ({ gameState, player, onSettlementClose, showDefenseOverlay, onToggleDefenseOverlay }) => {
  const warnings = gameState.disasterWarnings;
  const activeDisasters = gameState.activeDisasters;
  const history = gameState.disasterHistory;
  const [selectedHistory, setSelectedHistory] = useState<DisasterHistoryEntry | null>(null);

  const defenseFacilities = Object.values(gameState.map.tiles).filter(
    t => t.facility && FACILITY_CONFIG[t.facility.type]?.isDefense && t.ownerId === player.id
  );

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
        />
      )}
    </div>
  );
};

interface SettlementModalProps {
  settlement: DisasterSettlement;
  onClose: () => void;
  title?: string;
}

export const SettlementModal: React.FC<SettlementModalProps> = ({ settlement, onClose, title }) => {
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
                <div key={i} className="text-xs text-gray-300">
                  {FACILITY_CONFIG[d.defenseType]?.icon} {FACILITY_CONFIG[d.defenseType]?.name}
                  <span className="text-green-400 ml-1">吸收伤害 {d.damageAbsorbed}</span>
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
