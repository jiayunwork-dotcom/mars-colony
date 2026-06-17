import React from 'react';
import { FacilityType, Player, HexCoord, GameState, HexTile } from '../types/game';
import { FACILITY_CONFIG, TERRAIN_CONFIG, RESOURCE_CONFIG, hexKey } from '../lib/gameConfig';

interface BuildMenuProps {
  player: Player;
  gameState: GameState;
  buildMode: FacilityType | null;
  selectedTile: HexCoord | null;
  onSelectBuild: (type: FacilityType | null) => void;
  onBuild: (coord: HexCoord, type: FacilityType) => void;
  onDemolish: (coord: HexCoord) => void;
}

export const BuildMenu: React.FC<BuildMenuProps> = ({
  player,
  gameState,
  buildMode,
  selectedTile,
  onSelectBuild,
  onBuild,
  onDemolish,
}) => {
  const facilityTypes: FacilityType[] = [
    'habitat', 'greenhouse', 'mining_station', 'solar_array',
    'nuclear_reactor', 'water_recycling', 'launch_pad', 'fusion_reactor',
  ];

  const canAfford = (type: FacilityType, terrain: string): boolean => {
    const config = FACILITY_CONFIG[type];
    const terrainConfig = TERRAIN_CONFIG[terrain as keyof typeof TERRAIN_CONFIG];
    const multiplier = terrainConfig?.buildCostMultiplier || 1;

    for (const [res, amount] of Object.entries(config.buildCost)) {
      const needed = (amount as number) * multiplier;
      if ((player.resources as any)[res] < needed) return false;
    }
    return true;
  };

  const isTechUnlocked = (type: FacilityType): boolean => {
    const config = FACILITY_CONFIG[type];
    if (!config.researchRequired) return true;
    return player.research[config.researchRequired.branch].level >= config.researchRequired.level;
  };

  const selectedTileData: HexTile | null = selectedTile
    ? gameState.map.tiles[hexKey(selectedTile.q, selectedTile.r)] || null
    : null;

  return (
    <div className="panel rounded-xl p-4">
      <h3 className="text-lg font-bold mb-3 text-mars-400">🏗️ 建造设施</h3>

      {selectedTileData && (
        <div className="mb-4 p-3 bg-gray-800/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-sm text-gray-400">选中地块: </span>
              <span style={{ color: TERRAIN_CONFIG[selectedTileData.terrain].color }}>
                {TERRAIN_CONFIG[selectedTileData.terrain].name}
              </span>
              {selectedTileData.ownerId && (
                <span className="ml-2 text-sm text-gray-400">
                  (所有者: {gameState.players[selectedTileData.ownerId]?.name})
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-2">
            {TERRAIN_CONFIG[selectedTileData.terrain].description}
          </p>

          {selectedTileData.facility ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{FACILITY_CONFIG[selectedTileData.facility.type].icon}</span>
                <div>
                  <div className="font-semibold">
                    {FACILITY_CONFIG[selectedTileData.facility.type].name}
                    {selectedTileData.facility.isDisabled && (
                      <span className="ml-2 text-red-400 text-sm">⚠️ 已停用</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    {FACILITY_CONFIG[selectedTileData.facility.type].description}
                  </div>
                </div>
              </div>
              {selectedTileData.ownerId === player.id && (
                <button
                  onClick={() => onDemolish(selectedTileData.coord)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm"
                >
                  拆除
                </button>
              )}
            </div>
          ) : buildMode && selectedTileData.ownerId === player.id ? (
            canAfford(buildMode, selectedTileData.terrain) ? (
              <button
                onClick={() => onBuild(selectedTileData.coord, buildMode)}
                className="w-full btn-primary py-2"
              >
                建造 {FACILITY_CONFIG[buildMode].icon} {FACILITY_CONFIG[buildMode].name}
              </button>
            ) : (
              <div className="text-red-400 text-sm">资源不足，无法建造</div>
            )
          ) : null}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {facilityTypes.map((type) => {
          const config = FACILITY_CONFIG[type];
          const unlocked = isTechUnlocked(type);
          const affordable = selectedTileData ? canAfford(type, selectedTileData.terrain) : true;
          const selected = buildMode === type;

          return (
            <button
              key={type}
              onClick={() => onSelectBuild(selected ? null : type)}
              disabled={!unlocked}
              className={`p-2 rounded-lg text-left transition-all ${
                selected
                  ? 'bg-mars-600 border-2 border-mars-400'
                  : unlocked
                  ? 'bg-gray-800/50 hover:bg-gray-700/50 border-2 border-transparent'
                  : 'bg-gray-900/50 border-2 border-transparent opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{config.icon}</span>
                <span className="font-semibold text-sm">{config.name}</span>
              </div>
              {!unlocked && config.researchRequired && (
                <div className="text-xs text-yellow-400 mb-1">
                  需要研究解锁
                </div>
              )}
              <div className="flex flex-wrap gap-1">
                {Object.entries(config.buildCost).map(([res, amt]) => (
                  <span
                    key={res}
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      color: (RESOURCE_CONFIG as any)[res]?.color || '#fff',
                    }}
                  >
                    {(RESOURCE_CONFIG as any)[res]?.icon} {Math.ceil((amt as number) * (selectedTileData ? TERRAIN_CONFIG[selectedTileData.terrain].buildCostMultiplier : 1))}
                  </span>
                ))}
              </div>
              {Object.keys(config.production).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(config.production).map(([res, amt]) => (
                    <span
                      key={res}
                      className="text-xs text-green-400"
                    >
                      +{amt}{(RESOURCE_CONFIG as any)[res]?.icon}
                    </span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
