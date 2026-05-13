import React from 'react';
import { BarChart3, Download, RotateCcw } from 'lucide-react';
import { GameState } from './types';
import { calculateStats, formatMatchDate } from './utils';

interface ReportViewProps {
  gameState: GameState;
  onExport: () => void;
  onReset: () => void;
}

export default function ReportView({ gameState, onExport, onReset }: ReportViewProps) {
  const stats = calculateStats(gameState.rallies, gameState.players);
  const myTeam = gameState.players.filter(p => p.team === 'own').map(p => p.name || 'Player').join(' / ');
  const oppTeam = gameState.players.filter(p => p.team === 'opponent').map(p => p.name || 'Opponent').join(' / ');

  return (
    <div className="p-4 sm:p-8 overflow-y-auto max-w-2xl mx-auto space-y-6 pb-32">
      {/* Header */}
      <div>
        <h2 className="text-3xl sm:text-4xl font-black italic uppercase tracking-tighter">Match Report</h2>
        <p className="text-xs text-primary font-mono tracking-widest mt-1 uppercase">
          {formatMatchDate(gameState.matchDate)}
        </p>
      </div>

      {/* Teams */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-widest opacity-50 mb-1">My Team</div>
          <div className="font-black italic text-sm uppercase">{myTeam}</div>
        </div>
        <div className="bg-secondary/10 border border-secondary/30 rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-widest opacity-50 mb-1">Opponent</div>
          <div className="font-black italic text-sm uppercase">{oppTeam}</div>
        </div>
      </div>

      {/* Score Summary */}
      <div className="bg-surface border border-white/10 rounded-2xl p-6 text-center">
        <div className="text-[10px] uppercase tracking-widest opacity-40 mb-2">Sets</div>
        <div className="text-5xl font-black italic tracking-tighter text-primary">
          {gameState.sets.own} <span className="text-white/20">-</span> {gameState.sets.opponent}
        </div>
        {gameState.setHistory.length > 0 && (
          <div className="flex justify-center gap-3 mt-3">
            {gameState.setHistory.map((s, i) => (
              <span key={i} className="text-xs font-mono bg-white/5 px-3 py-1 rounded-lg">
                {s.own}:{s.opponent}
              </span>
            ))}
          </div>
        )}
        {(gameState.score.own > 0 || gameState.score.opponent > 0) && (
          <div className="text-xs font-mono opacity-40 mt-2">
            Current set: {gameState.score.own}-{gameState.score.opponent}
          </div>
        )}
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-2 gap-3">
        {(['own', 'opponent'] as const).map(team => {
          const t = stats.teamTotals[team];
          const color = team === 'own' ? 'primary' : 'secondary';
          return (
            <div key={team} className="bg-surface border border-white/10 rounded-2xl p-4 space-y-3">
              <span className={`text-[10px] uppercase font-bold tracking-widest text-${color}`}>
                {team === 'own' ? 'My Team' : 'Opponent'}
              </span>
              <div>
                <div className="text-2xl font-black italic text-white">
                  {(t.sideoutRate * 100).toFixed(0)}%
                </div>
                <div className="text-[10px] opacity-40 uppercase">Sideout Rate</div>
              </div>
              <div>
                <div className="text-xl font-black italic">
                  {(t.sideoutEfficiency * 100).toFixed(0)}%
                </div>
                <div className="text-[10px] opacity-40 uppercase">SO Efficiency</div>
              </div>
              <div className="flex gap-4 text-xs">
                <span className="text-success font-bold">{t.totalPoints} pts</span>
                <span className="text-danger font-bold">{t.totalErrors} err</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Individual Stats */}
      <div className="bg-surface border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/5 flex justify-between items-center">
          <h3 className="font-black italic uppercase tracking-tight text-lg">Player Stats</h3>
          <BarChart3 className="text-primary w-5 h-5" />
        </div>
        <div className="divide-y divide-white/5">
          {stats.playerStats.map((ps: any) => (
            <div key={ps.id} className="p-4 space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-black italic uppercase text-base">{ps.name || 'Unknown'}</span>
                  <span className={`ml-2 text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                    ps.team === 'own' ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'
                  }`}>{ps.team === 'own' ? 'MY TEAM' : 'OPP'}</span>
                </div>
                <span className={`text-lg font-black italic ${
                  ps.efficiency > 0 ? 'text-success' : ps.efficiency < 0 ? 'text-danger' : 'text-white/50'
                }`}>
                  {(ps.efficiency * 100).toFixed(0)}%
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-sm font-bold">{ps.points}</div>
                  <div className="text-[9px] opacity-40 uppercase">Pts</div>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-sm font-bold">{ps.errors}</div>
                  <div className="text-[9px] opacity-40 uppercase">Err</div>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-sm font-bold">{ps.attacks}</div>
                  <div className="text-[9px] opacity-40 uppercase">Atk</div>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-sm font-bold">{ps.serves}</div>
                  <div className="text-[9px] opacity-40 uppercase">Srv</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                <div>
                  <span className="opacity-40">Aces: </span>
                  <span className="font-bold">{ps.aces}</span>
                </div>
                <div>
                  <span className="opacity-40">Pass%: </span>
                  <span className="font-bold">{ps.passPercentage.toFixed(0)}%</span>
                </div>
                <div>
                  <span className="opacity-40">SO Eff: </span>
                  <span className="font-bold">{(ps.sideoutEfficiency * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onExport}
          className="flex-1 py-4 bg-primary text-black font-black uppercase text-xs tracking-widest rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <Download className="w-4 h-4" /> Email Stats
        </button>
        <button
          onClick={onReset}
          className="py-4 px-6 bg-danger/20 text-danger border border-danger/30 font-bold uppercase text-xs tracking-widest rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <RotateCcw className="w-4 h-4" /> Reset
        </button>
      </div>
    </div>
  );
}
