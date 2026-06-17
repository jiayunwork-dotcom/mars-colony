import React from 'react';
import { Player, ResourceType } from '../types/game';
import { RESOURCE_CONFIG } from '../lib/gameConfig';

interface ResourcePanelProps {
  player: Player;
}

export const ResourcePanel: React.FC<ResourcePanelProps> = ({ player }) => {
  const resources = player.resources;
  const resourceOrder: ResourceType[] = [
    'oxygen', 'water', 'food', 'power', 'materials', 'fuel', 'rare_minerals'
  ];

  return (
    <div className="resource-bar rounded-xl p-4">
      <div className="grid grid-cols-7 gap-2">
        {resourceOrder.map((key) => {
          const config = RESOURCE_CONFIG[key];
          const value = Math.floor(resources[key]);
          return (
            <div
              key={key}
              className="bg-gray-800/50 rounded-lg p-2 text-center"
              title={config.name}
            >
              <div className="text-2xl mb-1">{config.icon}</div>
              <div
                className="text-lg font-bold"
                style={{ color: config.color }}
              >
                {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
              </div>
              <div className="text-xs text-gray-400 truncate">{config.name}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
