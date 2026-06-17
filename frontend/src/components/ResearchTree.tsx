import React from 'react';
import { Player, ResearchBranch } from '../types/game';
import { RESEARCH_CONFIG } from '../lib/gameConfig';

interface ResearchTreeProps {
  player: Player;
}

export const ResearchTree: React.FC<ResearchTreeProps> = ({ player }) => {
  const branches = Object.keys(RESEARCH_CONFIG) as ResearchBranch[];

  return (
    <div className="panel rounded-xl p-4 max-h-96 overflow-y-auto">
      <h3 className="text-lg font-bold mb-4 text-mars-400">🔬 科研树</h3>

      <div className="space-y-4">
        {branches.map((branch) => {
          const config = RESEARCH_CONFIG[branch];
          const progress = player.research[branch];

          return (
            <div key={branch} className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{config.icon}</span>
                  <span className="font-semibold">{config.name}</span>
                </div>
                <div
                  className="px-2 py-1 rounded text-sm font-bold"
                  style={{ backgroundColor: config.color }}
                >
                  Lv.{progress.level}/4
                </div>
              </div>

              <div className="w-full bg-gray-700 rounded-full h-2 mb-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: progress.level >= 4
                      ? '100%'
                      : `${(progress.points / progress.requiredPoints) * 100}%`,
                    backgroundColor: config.color,
                  }}
                />
              </div>

              <div className="grid grid-cols-4 gap-1">
                {config.levels.map((level, i) => (
                  <div
                    key={i}
                    className={`text-center p-1.5 rounded text-xs ${
                      i < progress.level
                        ? 'bg-green-600/50 border border-green-500'
                        : i === progress.level
                        ? 'bg-yellow-600/30 border border-yellow-500'
                        : 'bg-gray-700/50 border border-gray-600'
                    }`}
                    title={level.effects.join('\n')}
                  >
                    <div className="font-bold mb-0.5">Lv.{i + 1}</div>
                    <div className="text-[10px] opacity-75">
                      {level.requiredPoints}点
                    </div>
                  </div>
                ))}
              </div>

              {progress.level < 4 && (
                <div className="mt-2 text-xs text-gray-400">
                  下一级: {progress.points}/{progress.requiredPoints} 研究点
                  {config.levels[progress.level] && (
                    <span className="ml-2 text-green-400">
                      → {config.levels[progress.level].effects.join(', ')}
                    </span>
                  )}
                </div>
              )}
              {progress.level >= 4 && (
                <div className="mt-2 text-xs text-green-400 font-semibold">
                  ✓ 已完成全部研究
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
