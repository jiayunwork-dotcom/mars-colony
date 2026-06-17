import React from 'react';
import { GameState } from '../types/game';
import { DISASTER_CONFIG } from '../lib/gameConfig';

interface DisasterPanelProps {
  gameState: GameState;
}

export const DisasterPanel: React.FC<DisasterPanelProps> = ({ gameState }) => {
  const disasters = gameState.activeDisasters;

  if (disasters.length === 0) {
    return (
      <div className="panel rounded-xl p-3">
        <h3 className="text-sm font-bold mb-2 text-mars-400">⚠️ 当前灾害</h3>
        <div className="text-center text-gray-500 text-sm py-2">
          无活跃灾害
        </div>
      </div>
    );
  }

  return (
    <div className="panel rounded-xl p-3">
      <h3 className="text-sm font-bold mb-2 text-mars-400">⚠️ 当前灾害</h3>
      <div className="space-y-2">
        {disasters.map((disaster, i) => {
          const config = DISASTER_CONFIG[disaster.type];
          return (
            <div
              key={i}
              className="p-2 rounded-lg text-sm"
              style={{ backgroundColor: `${config.color}22`, borderLeft: `3px solid ${config.color}` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{config.icon}</span>
                  <span className="font-semibold">{config.name}</span>
                </div>
                <span className="text-xs" style={{ color: config.color }}>
                  剩余 {disaster.turnsRemaining} 回合
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{config.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
