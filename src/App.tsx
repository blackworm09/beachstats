import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity, BarChart3, Settings, XCircle, Users, RotateCcw, Trophy, Zap, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Player, TrackedAction, TeamSide, GameState, Alert
} from './types';
import { calculateStats, detectTrends, isSetWon, getSetLimit, formatMatchDate } from './utils';
import TrackingView from './TrackingView';
import ReportView from './ReportView';

const INITIAL_PLAYERS: Player[] = [
  { id: 'p1', name: '', team: 'own' },
  { id: 'p2', name: '', team: 'own' },
  { id: 'o1', name: '', team: 'opponent' },
  { id: 'o2', name: '', team: 'opponent' },
];

const STORAGE_KEY = 'beachstats_game_data';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => {
    const defaultState: GameState = {
      players: INITIAL_PLAYERS.map(p => ({ ...p })),
      rallies: [],
      isStarted: false,
      score: { own: 0, opponent: 0 },
      lastServer: { own: null, opponent: null },
      sets: { own: 0, opponent: 0 },
      setHistory: [],
      matchDate: new Date().toISOString(),
    };
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaultState, ...parsed };
      } catch { /* ignore */ }
    }
    return defaultState;
  });

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [view, setView] = useState<'track' | 'report'>('track');
  const [showConfig, setShowConfig] = useState(!gameState.isStarted);
  const [setEndModal, setSetEndModal] = useState<{ show: boolean; winner?: TeamSide } | null>(null);
  const [showTrends, setShowTrends] = useState(false);

  // Persist
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
  }, [gameState]);

  // Stats
  const stats = useMemo(() => calculateStats(gameState.rallies, gameState.players), [gameState.rallies, gameState.players]);

  // Alerts — team-level + player trend detection
  useEffect(() => {
    const newAlerts: Alert[] = [];
    const ts = Date.now();

    // Team-level sideout alerts
    if (stats.teamTotals.opponent.sideoutRate > 0.7 && stats.teamTotals.opponent.sideoutOpps >= 5) {
      newAlerts.push({ id: `opp-so-${ts}`, message: `Opponent sideout ${(stats.teamTotals.opponent.sideoutRate * 100).toFixed(0)}%! Adjust serve.`, type: 'alert', timestamp: ts });
    }
    if (stats.teamTotals.own.sideoutRate < 0.5 && stats.teamTotals.own.sideoutOpps >= 5) {
      newAlerts.push({ id: `own-so-${ts}`, message: `Sideout struggle (${(stats.teamTotals.own.sideoutRate * 100).toFixed(0)}%). Focus on pass.`, type: 'warning', timestamp: ts });
    }

    // Player trend alerts (attack patterns, shot preferences, pass/serve issues)
    const trendAlerts = detectTrends(stats);
    trendAlerts.forEach((t, i) => {
      newAlerts.push({ id: `trend-${i}-${ts}`, message: t.message, type: t.type, timestamp: ts });
    });

    setAlerts(prev => {
      const combined = [...newAlerts, ...prev];
      return Array.from(new Map(combined.map(a => [a.message, a])).values()).slice(0, 8);
    });
  }, [stats]);

  // Check for set end after score changes
  useEffect(() => {
    const currentSetNum = gameState.setHistory.length + 1;
    if (isSetWon(gameState.score, currentSetNum)) {
      const winner: TeamSide = gameState.score.own > gameState.score.opponent ? 'own' : 'opponent';
      setSetEndModal({ show: true, winner });
    }
  }, [gameState.score, gameState.setHistory.length]);

  // Handle rally end from TrackingView
  const handleEndRally = (winner: TeamSide, actions: TrackedAction[], servingTeam: TeamSide, rallyId: string) => {
    const serveAction = actions.find(a => a.type === 'serve');
    const serverId = serveAction ? serveAction.playerId : null;

    setGameState(prev => ({
      ...prev,
      rallies: [...prev.rallies, {
        id: rallyId, servingTeam, actions, winner,
        timestamp: Date.now(), setNumber: prev.setHistory.length + 1,
      }],
      score: { ...prev.score, [winner]: prev.score[winner] + 1 },
      lastServer: { ...prev.lastServer, [servingTeam]: serverId },
      isStarted: true,
    }));
  };

  // Confirm set end
  const confirmSetEnd = () => {
    if (!setEndModal?.winner) return;
    const winner = setEndModal.winner;
    const newSets = { ...gameState.sets, [winner]: gameState.sets[winner] + 1 };

    setGameState(prev => ({
      ...prev,
      sets: newSets,
      setHistory: [...prev.setHistory, { ...prev.score }],
      score: { own: 0, opponent: 0 },
      lastServer: { own: null, opponent: null },
    }));
    setSetEndModal(null);

    if (newSets[winner] >= 2) {
      // Match is over — switch to report
      setTimeout(() => setView('report'), 300);
    }
  };

  // Manual end set
  const manualEndSet = () => {
    const s = gameState.score;
    const currentSetNum = gameState.setHistory.length + 1;
    const limit = getSetLimit(currentSetNum);
    const diff = Math.abs(s.own - s.opponent);
    const max = Math.max(s.own, s.opponent);

    if (max < limit || diff < 2) {
      if (!confirm(`Score is ${s.own}:${s.opponent}. Beach volleyball set ends at ${limit} (win by 2). End anyway?`)) return;
    }
    const winner: TeamSide = s.own > s.opponent ? 'own' : 'opponent';
    const newSets = { ...gameState.sets, [winner]: gameState.sets[winner] + 1 };

    setGameState(prev => ({
      ...prev,
      sets: newSets,
      setHistory: [...prev.setHistory, { ...prev.score }],
      score: { own: 0, opponent: 0 },
      lastServer: { own: null, opponent: null },
    }));

    if (newSets[winner] >= 2) {
      setTimeout(() => setView('report'), 300);
    }
  };

  const resetGame = () => {
    if (confirm('Reset the entire match? All data will be lost.')) {
      const fresh: GameState = {
        players: INITIAL_PLAYERS.map(p => ({ ...p })),
        rallies: [],
        isStarted: false,
        score: { own: 0, opponent: 0 },
        lastServer: { own: null, opponent: null },
        sets: { own: 0, opponent: 0 },
        setHistory: [],
        matchDate: new Date().toISOString(),
      };
      setGameState(fresh);
      localStorage.removeItem(STORAGE_KEY);
      setAlerts([]);
      setView('track');
      setShowConfig(true);
    }
  };

  const handleExport = () => {
    const s = calculateStats(gameState.rallies, gameState.players);
    const date = formatMatchDate(gameState.matchDate);
    const myTeam = gameState.players.filter(p => p.team === 'own').map(p => p.name || 'Player').join(' / ');
    const oppTeam = gameState.players.filter(p => p.team === 'opponent').map(p => p.name || 'Opponent').join(' / ');

    // Build CSV body
    let csv = '';
    csv += `Match Date: ${date}\n`;
    csv += `My Team: ${myTeam}\n`;
    csv += `Opponent: ${oppTeam}\n`;
    csv += `Sets: ${gameState.sets.own} - ${gameState.sets.opponent}\n`;
    if (gameState.setHistory.length > 0) {
      csv += `Set Scores: ${gameState.setHistory.map((sc, i) => `Set${i+1} ${sc.own}-${sc.opponent}`).join(', ')}\n`;
    }
    csv += `\n`;

    // Team stats CSV
    csv += `TEAM STATS\n`;
    csv += `Team,Sideout Rate,SO Efficiency,Points,Errors\n`;
    csv += `My Team,${(s.teamTotals.own.sideoutRate * 100).toFixed(1)}%,${(s.teamTotals.own.sideoutEfficiency * 100).toFixed(1)}%,${s.teamTotals.own.totalPoints},${s.teamTotals.own.totalErrors}\n`;
    csv += `Opponent,${(s.teamTotals.opponent.sideoutRate * 100).toFixed(1)}%,${(s.teamTotals.opponent.sideoutEfficiency * 100).toFixed(1)}%,${s.teamTotals.opponent.totalPoints},${s.teamTotals.opponent.totalErrors}\n`;
    csv += `\n`;

    // Individual stats CSV
    csv += `INDIVIDUAL STATS\n`;
    csv += `Player,Team,Serves,Aces,Attacks,Shots,Hits,Points,Errors,Efficiency,Pass Score (0-3),Atk SO Eff\n`;
    s.playerStats.forEach((ps: any) => {
      csv += `${ps.name || 'Unknown'},${ps.team === 'own' ? 'My Team' : 'Opponent'},${ps.serves},${ps.aces},${ps.attacks},${ps.shots},${ps.hits},${ps.points},${ps.errors},${(ps.efficiency * 100).toFixed(1)}%,${ps.passes > 0 ? ps.passScore.toFixed(2) : '-'},${ps.sideoutAttempts > 0 ? ((ps.sideoutPoints - ps.sideoutErrors) / ps.sideoutAttempts).toFixed(3) : '-'}\n`;
    });

    const subject = encodeURIComponent(`BeachStats Match Report - ${myTeam} vs ${oppTeam} - ${date}`);
    const body = encodeURIComponent(csv);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const updatePlayerName = (id: string, name: string) => {
    setGameState(prev => ({
      ...prev,
      players: prev.players.map(p => p.id === id ? { ...p, name } : p)
    }));
  };

  const currentSetNum = gameState.setHistory.length + 1;
  const setLimit = getSetLimit(currentSetNum);

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col font-sans selection:bg-primary selection:text-black">
      {/* HEADER — compact on mobile */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-3 sm:py-5 border-b border-white/10 bg-surface sticky top-0 z-50">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="bg-primary text-black font-black px-2 py-0.5 rounded text-sm sm:text-lg uppercase tracking-tighter">BEACHSTATS</div>
        </div>

        {/* Score */}
        <div className="flex items-center gap-4 sm:gap-8">
          <div className="text-center">
            <div className="text-[9px] text-white/40 uppercase tracking-widest">Set {currentSetNum} <span className="text-white/20">to {setLimit}</span></div>
            <div className="text-3xl sm:text-4xl font-black tracking-tighter tabular-nums leading-none">
              {gameState.score.own} <span className="text-white/20 text-lg">:</span> {gameState.score.opponent}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-white/40 uppercase tracking-widest">Sets</div>
            <div className="text-xl sm:text-2xl font-black italic text-primary leading-none">
              {gameState.sets.own}-{gameState.sets.opponent}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {alerts.length > 0 && (
            <button onClick={() => setShowTrends(true)}
              className="relative p-2.5 bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/10">
              <Zap className="w-4 h-4 text-primary" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-black text-[9px] font-black rounded-full flex items-center justify-center">
                {alerts.length}
              </span>
            </button>
          )}
          <button onClick={() => setView(view === 'track' ? 'report' : 'track')}
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/10">
            {view === 'track' ? <BarChart3 className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
          </button>
          <button onClick={() => setShowConfig(true)}
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/10">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {view === 'track' ? (
          <>
            {/* Tracking panel */}
            <div className="flex-1 flex flex-col bg-surface min-h-0">
              <TrackingView gameState={gameState} onEndRally={handleEndRally} />
            </div>

            {/* Sidebar — hidden on mobile, shown on desktop */}
            <aside className="hidden lg:flex lg:w-80 flex-col bg-background border-l border-white/5 p-4 gap-4 overflow-y-auto">
              {/* Quick stats */}
              <div className="space-y-3">
                <div className="text-[10px] uppercase tracking-widest font-bold opacity-30">Quick Stats</div>
                {(['own', 'opponent'] as const).map(team => (
                  <div key={team} className="flex justify-between items-center text-xs">
                    <span className={`font-bold uppercase ${team === 'own' ? 'text-primary' : 'text-secondary'}`}>
                      {team === 'own' ? 'My Team' : 'Opponent'} SO
                    </span>
                    <span className="font-mono">{(stats.teamTotals[team].sideoutRate * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>

              {/* Alerts */}
              <div className="flex-1 space-y-3">
                <div className="text-[10px] uppercase tracking-widest font-bold opacity-30">Alerts</div>
                <AnimatePresence mode="popLayout">
                  {alerts.length === 0 ? (
                    <div className="text-[10px] opacity-20 text-center py-8 border border-dashed border-white/10 rounded-xl">
                      Waiting for data...
                    </div>
                  ) : alerts.map(alert => (
                    <motion.div key={alert.id} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} layout
                      className={`p-3 rounded-xl text-xs font-bold uppercase leading-tight ${
                        alert.type === 'alert' ? 'bg-secondary text-black' :
                        alert.type === 'warning' ? 'bg-accent text-black' : 'bg-primary text-black'
                      }`}>
                      {alert.message}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Bottom actions */}
              <div className="space-y-2 mt-auto">
                <button onClick={manualEndSet}
                  className="w-full py-3 bg-primary/20 text-primary border border-primary/30 font-bold uppercase text-[10px] tracking-widest rounded-xl active:scale-95 transition-all">
                  End Set
                </button>
                <button onClick={() => setView('report')}
                  className="w-full py-3 bg-white text-black font-black uppercase text-[10px] tracking-widest rounded-xl active:scale-95 transition-all">
                  Full Report
                </button>
              </div>
            </aside>
          </>
        ) : (
          <div className="flex-1 bg-surface overflow-y-auto">
            <ReportView gameState={gameState} onExport={handleExport} onReset={resetGame} />
          </div>
        )}
      </main>

      {/* MOBILE BOTTOM BAR — only in track view */}
      {view === 'track' && (
        <div className="lg:hidden sticky bottom-0 z-40 bg-surface/95 backdrop-blur-xl border-t border-white/10 px-4 py-2 flex items-center gap-2 safe-bottom">
          <button onClick={manualEndSet}
            className="flex-1 py-3 bg-white/10 text-white font-bold uppercase text-[10px] tracking-wider rounded-xl active:scale-95 transition-all border border-white/10">
            End Set
          </button>
          <button onClick={() => setView('report')}
            className="flex-1 py-3 bg-primary text-black font-black uppercase text-[10px] tracking-wider rounded-xl active:scale-95 transition-all">
            Report
          </button>
        </div>
      )}

      {/* SET END MODAL */}
      <AnimatePresence>
        {setEndModal?.show && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface border border-white/10 p-8 rounded-3xl w-full max-w-sm text-center space-y-6">
              <Trophy className="w-12 h-12 text-primary mx-auto" />
              <div>
                <h3 className="text-2xl font-black italic uppercase tracking-tight">Set Over!</h3>
                <p className="text-sm text-white/50 mt-1">
                  {gameState.score.own} - {gameState.score.opponent}
                </p>
                <p className={`text-lg font-black italic uppercase mt-2 ${setEndModal.winner === 'own' ? 'text-primary' : 'text-secondary'}`}>
                  {setEndModal.winner === 'own' ? 'My Team' : 'Opponent'} wins the set!
                </p>
              </div>
              <button onClick={confirmSetEnd}
                className="w-full py-4 bg-primary text-black font-black uppercase tracking-widest text-xs rounded-2xl active:scale-95 transition-all">
                Continue Match
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TRENDS MODAL */}
      <AnimatePresence>
        {showTrends && (
          <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xl" onClick={() => setShowTrends(false)}>
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-surface border border-white/10 p-6 rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl max-h-[80dvh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-black italic uppercase tracking-tight">Live Trends</h3>
                </div>
                <button onClick={() => setShowTrends(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {alerts.length === 0 ? (
                <div className="text-center py-12 opacity-30 text-sm">No trends detected yet. Keep tracking!</div>
              ) : (
                <div className="space-y-2">
                  {alerts.map(alert => (
                    <div key={alert.id}
                      className={`p-3 rounded-xl text-xs font-bold uppercase leading-tight ${
                        alert.type === 'alert' ? 'bg-secondary/20 text-secondary border border-secondary/30' :
                        alert.type === 'warning' ? 'bg-accent/20 text-accent border border-accent/30' :
                        'bg-primary/20 text-primary border border-primary/30'
                      }`}>
                      {alert.message}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIG MODAL */}
      <AnimatePresence>
        {showConfig && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xl">
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="bg-surface border border-white/10 p-6 sm:p-10 rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl space-y-8 max-h-[90dvh] overflow-y-auto">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter text-primary">Roster</h3>
                  <p className="text-[10px] opacity-50 uppercase tracking-widest mt-1 font-mono">Set up teams</p>
                </div>
                <button onClick={() => setShowConfig(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {(['own', 'opponent'] as const).map(team => (
                <div key={team} className="space-y-3">
                  <h4 className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded inline-block ${
                    team === 'own' ? 'text-primary bg-primary/10' : 'text-secondary bg-secondary/10'
                  }`}>{team === 'own' ? 'My Team' : 'Opponent'}</h4>
                  {gameState.players.filter(p => p.team === team).map((p, idx) => (
                    <div key={p.id} className="relative group">
                      <input type="text" value={p.name}
                        onChange={e => updatePlayerName(p.id, e.target.value)}
                        className={`w-full bg-white/5 border-2 border-white/10 p-4 rounded-xl outline-none transition-all uppercase font-bold text-base tracking-tight ${
                          team === 'own' ? 'focus:border-primary' : 'focus:border-secondary'
                        }`}
                        placeholder={`${team === 'own' ? 'Player' : 'Opponent'} ${idx + 1}`}
                      />
                      <Users className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20 group-focus-within:opacity-60" />
                    </div>
                  ))}
                </div>
              ))}

              <div className="space-y-3 pt-2">
                <button onClick={() => setShowConfig(false)}
                  className="w-full p-4 bg-primary text-black rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all">
                  Save & Start
                </button>
                <button onClick={resetGame}
                  className="w-full p-3 bg-danger/10 text-danger border border-danger/20 rounded-2xl font-bold uppercase text-[10px] tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2">
                  <RotateCcw className="w-3 h-3" /> Reset Everything
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
