import React from 'react';
import { Player, ProfessionType } from '../types/game';
import { PROFESSION_CONFIG } from '../lib/gameConfig';

interface PopulationPanelProps {
  player: Player;
  onRecruit: (profession: ProfessionType) => void;
}

export const PopulationPanel: React.FC<PopulationPanelProps> = ({ player, onRecruit }) => {
  const professions = Object.keys(PROFESSION_CONFIG) as ProfessionType[];

  const getCountByProfession = (prof: ProfessionType) =>
    player.population.colonists.filter(c => c.profession === prof && !c.isSick).length;

  const getSickCount = () =>
    player.population.colonists.filter(c => c.isSick).length;

  const getAverageHealth = () => {
    if (player.population.colonists.length === 0) return 100;
    const total = player.population.colonists.reduce((sum, c) => sum + c.health, 0);
    return Math.round(total / player.population.colonists.length);
  };

  return (
    <div className="panel rounded-xl p-4">
      <h3 className="text-lg font-bold mb-3 text-mars-400">👥 人口管理</h3>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {professions.map(prof => {
          const config = PROFESSION_CONFIG[prof];
          const count = getCountByProfession(prof);
          return (
            <div
              key={prof}
              className="p-2 rounded-lg text-center"
              style={{ backgroundColor: `${config.color}22` }}
            >
              <div className="text-xl">{config.icon}</div>
              <div className="text-xs text-gray-400">{config.name}</div>
              <div className="font-bold" style={{ color: config.color }}>{count}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4 text-center text-sm">
        <div className="bg-gray-800/50 rounded p-2">
          <div className="text-gray-400 text-xs">总人口</div>
          <div className="font-bold text-lg">{player.population.colonists.length}</div>
        </div>
        <div className="bg-gray-800/50 rounded p-2">
          <div className="text-gray-400 text-xs">容量</div>
          <div className="font-bold text-lg">{player.population.habitatCapacity}</div>
        </div>
        <div className="bg-gray-800/50 rounded p-2">
          <div className="text-gray-400 text-xs">平均健康</div>
          <div className="font-bold text-lg" style={{ color: getAverageHealth() >= 70 ? '#22c55e' : getAverageHealth() >= 40 ? '#eab308' : '#ef4444' }}>
            {getAverageHealth()}%
          </div>
        </div>
      </div>

      {getSickCount() > 0 && (
        <div className="mb-3 p-2 bg-red-900/30 rounded-lg text-sm text-red-400 text-center border border-red-500/50">
          🦠 {getSickCount()} 名殖民者患病
        </div>
      )}

      <div>
        <div className="text-sm text-gray-400 mb-2">招募殖民者 (每回合成本递增15%)</div>
        <div className="grid grid-cols-4 gap-2">
          {professions.map(prof => {
            const config = PROFESSION_CONFIG[prof];
            return (
              <button
                key={prof}
                onClick={() => onRecruit(prof)}
                className="p-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg text-center transition-colors border border-gray-700 hover:border-gray-500"
                title={`招募${config.name}`}
              >
                <div className="text-lg">{config.icon}</div>
                <div className="text-xs">{config.name}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
