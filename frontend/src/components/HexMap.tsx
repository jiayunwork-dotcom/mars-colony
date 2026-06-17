import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  GameState,
  HexTile,
  HexCoord,
  FacilityType,
} from '../types/game';
import {
  HEX_SIZE,
  TERRAIN_CONFIG,
  FACILITY_CONFIG,
  hexKey,
  hexToPixel,
  hexCorners,
  getNeighbors,
} from '../lib/gameConfig';

interface HexMapProps {
  gameState: GameState;
  playerId: string;
  selectedTile: HexCoord | null;
  onTileSelect: (coord: HexCoord | null) => void;
  buildMode: FacilityType | null;
}

export const HexMap: React.FC<HexMapProps> = ({
  gameState,
  playerId,
  selectedTile,
  onTileSelect,
  buildMode,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewBox, setViewBox] = useState({ x: -400, y: -300, width: 800, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [hoveredTile, setHoveredTile] = useState<string | null>(null);

  const tiles = Object.values(gameState.map.tiles);
  const currentPlayer = gameState.players[playerId];

  const canBuildOn = useCallback((tile: HexTile): boolean => {
    if (!buildMode) return false;
    if (tile.facility) return false;

    if (tile.ownerId === playerId) return true;
    if (tile.ownerId !== null) return false;

    const neighbors = getNeighbors(tile.coord);
    return neighbors.some(n => {
      const neighborTile = gameState.map.tiles[hexKey(n.q, n.r)];
      return neighborTile?.ownerId === playerId;
    });
  }, [buildMode, gameState.map.tiles, playerId]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && !buildMode) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [buildMode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      const dx = (e.clientX - dragStart.x) * (viewBox.width / containerRef.current!.clientWidth);
      const dy = (e.clientY - dragStart.y) * (viewBox.height / containerRef.current!.clientHeight);
      setViewBox(prev => ({
        ...prev,
        x: prev.x - dx,
        y: prev.y - dy,
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [isDragging, dragStart, viewBox.width, viewBox.height]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1.1 : 0.9;
    const newScale = Math.max(0.5, Math.min(3, scale * delta));
    const rect = containerRef.current!.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const viewBoxMouseX = viewBox.x + (mouseX / rect.width) * viewBox.width;
    const viewBoxMouseY = viewBox.y + (mouseY / rect.height) * viewBox.height;

    const newWidth = viewBox.width * delta;
    const newHeight = viewBox.height * delta;
    const newX = viewBoxMouseX - (mouseX / rect.width) * newWidth;
    const newY = viewBoxMouseY - (mouseY / rect.height) * newHeight;

    setViewBox({ x: newX, y: newY, width: newWidth, height: newHeight });
    setScale(newScale);
  }, [scale, viewBox]);

  const handleTileClick = useCallback((coord: HexCoord) => {
    if (buildMode) {
      const tile = gameState.map.tiles[hexKey(coord.q, coord.r)];
      if (tile && canBuildOn(tile)) {
        onTileSelect(coord);
      }
    } else {
      onTileSelect(coord);
    }
  }, [buildMode, gameState.map.tiles, canBuildOn, onTileSelect]);

  const isSelected = (coord: HexCoord): boolean => {
    return selectedTile?.q === coord.q && selectedTile?.r === coord.r;
  };

  return (
    <div
      ref={containerRef}
      className="hex-grid-container w-full h-full relative bg-gradient-to-br from-gray-900 via-mars-950 to-gray-900 rounded-xl overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <svg
        ref={svgRef}
        className="w-full h-full"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        style={{ cursor: isDragging ? 'grabbing' : buildMode ? 'crosshair' : 'grab' }}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {tiles.map((tile) => {
          const key = hexKey(tile.coord.q, tile.coord.r);
          const pixel = hexToPixel(tile.coord, HEX_SIZE);
          const terrainConfig = TERRAIN_CONFIG[tile.terrain];
          const canBuild = canBuildOn(tile);
          const isHovered = hoveredTile === key;
          const selected = isSelected(tile.coord);

          let fillColor = terrainConfig.color;
          let strokeColor = 'rgba(255,255,255,0.1)';
          let strokeWidth = 1;

          if (tile.ownerId) {
            const owner = gameState.players[tile.ownerId];
            if (owner) {
              strokeColor = owner.color;
              strokeWidth = 2;
            }
          }

          if (buildMode && canBuild) {
            strokeColor = '#22c55e';
            strokeWidth = 3;
          }

          if (selected) {
            strokeColor = '#fff';
            strokeWidth = 4;
          }

          if (isHovered) {
            strokeColor = '#ffd700';
            strokeWidth = 3;
          }

          return (
            <g
              key={key}
              className="hex-tile"
              onClick={(e) => {
                e.stopPropagation();
                handleTileClick(tile.coord);
              }}
              onMouseEnter={() => setHoveredTile(key)}
              onMouseLeave={() => setHoveredTile(null)}
              style={{ cursor: canBuild || !buildMode ? 'pointer' : 'not-allowed' }}
            >
              <polygon
                points={hexCorners(pixel.x, pixel.y, HEX_SIZE - 2)}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                opacity={tile.ownerId ? 0.95 : 0.7}
              />

              {tile.facility && (
                <>
                  <circle
                    cx={pixel.x}
                    cy={pixel.y}
                    r={HEX_SIZE * 0.45}
                    fill="rgba(0,0,0,0.5)"
                    stroke={tile.facility.isDisabled ? '#ef4444' : '#22c55e'}
                    strokeWidth={2}
                  />
                  <text
                    x={pixel.x}
                    y={pixel.y + 6}
                    textAnchor="middle"
                    fontSize={HEX_SIZE * 0.5}
                    className="pointer-events-none select-none"
                  >
                    {FACILITY_CONFIG[tile.facility.type].icon}
                  </text>
                  {tile.facility.isDisabled && (
                    <text
                      x={pixel.x}
                      y={pixel.y - HEX_SIZE * 0.35}
                      textAnchor="middle"
                      fontSize={HEX_SIZE * 0.3}
                      fill="#ef4444"
                      className="pointer-events-none select-none"
                    >
                      ⚠️
                    </text>
                  )}
                </>
              )}

              {selected && (
                <polygon
                  points={hexCorners(pixel.x, pixel.y, HEX_SIZE - 2)}
                  fill="none"
                  stroke="#fff"
                  strokeWidth={3}
                  filter="url(#glow)"
                />
              )}

              {canBuild && buildMode && !tile.facility && (
                <text
                  x={pixel.x}
                  y={pixel.y + 8}
                  textAnchor="middle"
                  fontSize={HEX_SIZE * 0.6}
                  opacity={0.6}
                  className="pointer-events-none select-none"
                >
                  {FACILITY_CONFIG[buildMode].icon}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => {
            const delta = 0.8;
            const newWidth = viewBox.width * delta;
            const newHeight = viewBox.height * delta;
            const cx = viewBox.x + viewBox.width / 2;
            const cy = viewBox.y + viewBox.height / 2;
            setViewBox({
              x: cx - newWidth / 2,
              y: cy - newHeight / 2,
              width: newWidth,
              height: newHeight,
            });
            setScale(scale / delta);
          }}
          className="w-10 h-10 bg-gray-800/80 hover:bg-gray-700 rounded-lg flex items-center justify-center text-white font-bold backdrop-blur-sm"
        >
          +
        </button>
        <button
          onClick={() => {
            const delta = 1.2;
            const newWidth = viewBox.width * delta;
            const newHeight = viewBox.height * delta;
            const cx = viewBox.x + viewBox.width / 2;
            const cy = viewBox.y + viewBox.height / 2;
            setViewBox({
              x: cx - newWidth / 2,
              y: cy - newHeight / 2,
              width: newWidth,
              height: newHeight,
            });
            setScale(scale / delta);
          }}
          className="w-10 h-10 bg-gray-800/80 hover:bg-gray-700 rounded-lg flex items-center justify-center text-white font-bold backdrop-blur-sm"
        >
          −
        </button>
        <button
          onClick={() => {
            setViewBox({ x: -400, y: -300, width: 800, height: 600 });
            setScale(1);
          }}
          className="w-10 h-10 bg-gray-800/80 hover:bg-gray-700 rounded-lg flex items-center justify-center text-white text-sm backdrop-blur-sm"
        >
          ⌂
        </button>
      </div>

      {buildMode && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-mars-600/90 px-6 py-2 rounded-lg backdrop-blur-sm">
          <span className="text-white font-semibold">
            建造模式: {FACILITY_CONFIG[buildMode].icon} {FACILITY_CONFIG[buildMode].name}
          </span>
          <span className="ml-4 text-white/70 text-sm">点击绿色边框地块建造</span>
        </div>
      )}
    </div>
  );
};
