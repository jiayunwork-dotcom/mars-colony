import React, { useState, useEffect } from 'react';
import { GameState, Player } from '../types/game';

interface TurnTimerProps {
  gameState: GameState;
  player: Player;
  onEndTurn: () => void;
}

export const TurnTimer: React.FC<TurnTimerProps> = ({ gameState, player, onEndTurn }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setSubmitted(false);
  }, [gameState.currentTurn]);

  useEffect(() => {
    if (!gameState.turnDeadline) return;

    const updateTimer = () => {
      const remaining = Math.max(0, gameState.turnDeadline! - Date.now());
      setTimeLeft(Math.ceil(remaining / 1000));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [gameState.turnDeadline, gameState.currentTurn]);

  const seasonNames = ['春', '夏', '秋', '冬'];
  const seasonEmojis = ['🌸', '☀️', '🍂', '❄️'];

  const percentage = gameState.turnDeadline
    ? (timeLeft / 30) * 100
    : 100;

  const timerColor = timeLeft > 20 ? '#22c55e' : timeLeft > 10 ? '#eab308' : '#ef4444';

  return (
    <div className="panel rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-sm text-gray-400">回合</span>
          <span className="ml-2 text-2xl font-bold text-mars-400">
            {gameState.currentTurn}/{gameState.maxTurns}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xl">{seasonEmojis[gameState.season]}</span>
          <span className="text-sm text-gray-300">{seasonNames[gameState.season]}</span>
          {gameState.sunActivityCycle >= 8 && (
            <span className="ml-2 text-yellow-400 text-xs animate-pulse">☀️ 太阳活动期</span>
          )}
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-400">剩余时间</span>
          <span className="font-bold" style={{ color: timerColor }}>
            {timeLeft}秒
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${percentage}%`, backgroundColor: timerColor }}
          />
        </div>
      </div>

      <div className="flex gap-3 mb-3">
        <div className="flex-1 bg-gray-800/50 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-400">综合评分</div>
          <div className="text-xl font-bold text-yellow-400">{player.score.total}</div>
        </div>
        <div className="flex-1 bg-gray-800/50 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-400">人口</div>
          <div className="text-xl font-bold text-green-400">
            {player.population.colonists.length}/{player.population.habitatCapacity}
          </div>
        </div>
        <div className="flex-1 bg-gray-800/50 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-400">士气</div>
          <div
            className="text-xl font-bold"
            style={{ color: player.population.morale >= 50 ? '#22c55e' : player.population.morale >= 30 ? '#eab308' : '#ef4444' }}
          >
            {player.population.morale}%
          </div>
        </div>
      </div>

      <button
        onClick={() => {
          onEndTurn();
          setSubmitted(true);
        }}
        disabled={submitted || gameState.phase !== 'playing'}
        className={`w-full py-3 rounded-lg font-bold text-lg transition-all ${
          submitted
            ? 'bg-green-600 text-white'
            : 'btn-primary'
        } disabled:opacity-50`}
      >
        {submitted ? '✓ 已提交回合' : '提交回合操作'}
      </button>
    </div>
  );
};
