import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, ChevronRight } from 'lucide-react';
import {
  TrackedAction, ActionType, ActionResult,
  AttackType, ServeType, TeamSide, GameState
} from './types';
import { PlayerSelectButton, OutcomeButton, ActionButton, getSelectedPlayerId } from './components';

type RallyStep = 'choose_server' | 'serve' | 'ace_passer' | 'pass' | 'attack' | 'defense_result';

interface TrackingViewProps {
  gameState: GameState;
  onEndRally: (winner: TeamSide, actions: TrackedAction[], servingTeam: TeamSide, rallyId: string) => void;
}

export default function TrackingView({ gameState, onEndRally }: TrackingViewProps) {
  const [currentRally, setCurrentRally] = useState<{
    id: string;
    servingTeam: TeamSide | null;
    actions: TrackedAction[];
    step: RallyStep;
  }>({ id: '', servingTeam: null, actions: [], step: 'choose_server' });

  const [selectedAttackType, setSelectedAttackType] = useState<AttackType>('hit line');
  const [selectedServeType, setSelectedServeType] = useState<ServeType>('topspin');
  const [isOption, setIsOption] = useState(false);

  const startRally = (team: TeamSide) => {
    setCurrentRally({ id: `r-${Date.now()}`, servingTeam: team, actions: [], step: 'serve' });
  };

  const getDefaultAttackerId = () => {
    const passAction = currentRally.actions.find(a => a.type === 'pass');
    if (!passAction) return null;
    const passer = gameState.players.find(p => p.id === passAction.playerId);
    if (!passer) return null;
    if (isOption) {
      // Option: the passer's partner hits
      const partner = gameState.players.find(p => p.team === passer.team && p.id !== passer.id);
      return partner?.id ?? null;
    }
    // Normal set: passer is the hitter
    return passAction.playerId;
  };

  const finishRally = (winner: TeamSide, actions: TrackedAction[]) => {
    onEndRally(winner, actions, currentRally.servingTeam!, currentRally.id);
    setCurrentRally({ id: `r-${Date.now()}`, servingTeam: winner, actions: [], step: 'serve' });
  };

  const addAction = (player: string, type: ActionType, options?: { result?: ActionResult; attackType?: AttackType; serveType?: ServeType }) => {
    const newAction: TrackedAction = {
      id: `a-${Date.now()}`, playerId: player, type,
      result: options?.result, attackType: options?.attackType,
      serveType: options?.serveType, timestamp: Date.now()
    };
    const updatedActions = [...currentRally.actions, newAction];
    let nextStep = currentRally.step;

    if (type === 'serve') {
      if (options?.result === 'ace') {
        // Ace: go to ace_passer step to record which receiver was at fault
        setCurrentRally(prev => ({ ...prev, actions: updatedActions, step: 'ace_passer' }));
        return;
      }
      if (options?.result === 'error') {
        const winner: TeamSide = currentRally.servingTeam === 'own' ? 'opponent' : 'own';
        finishRally(winner, updatedActions);
        return;
      }
      nextStep = 'pass';
    } else if (type === 'pass') {
      // Skip setup step — auto-record a set action for the partner and go to attack
      const passer = gameState.players.find(p => p.id === player);
      if (passer) {
        const partner = gameState.players.find(p => p.team === passer.team && p.id !== passer.id);
        if (partner) {
          const setAction: TrackedAction = {
            id: `a-${Date.now() + 1}`, playerId: partner.id, type: 'set',
            timestamp: Date.now() + 1
          };
          updatedActions.push(setAction);
        }
      }
      setIsOption(false);
      nextStep = 'attack';
    } else if (type === 'set' || type === 'option') {
      nextStep = 'attack';
    } else if (type === 'attack') {
      if (options?.result === 'point' || options?.result === 'error' || options?.result === 'blocked') {
        const winner: TeamSide = options.result === 'point'
          ? (gameState.players.find(p => p.id === player)?.team || 'own')
          : (gameState.players.find(p => p.id === player)?.team === 'own' ? 'opponent' : 'own');
        finishRally(winner, updatedActions);
        return;
      }
      if (options?.result === 'defended') nextStep = 'defense_result';
    }
    setCurrentRally(prev => ({ ...prev, actions: updatedActions, step: nextStep }));
  };

  const undoLastAction = () => {
    if (currentRally.actions.length > 0) {
      const newActions = [...currentRally.actions];
      if (currentRally.step === 'attack') {
        // Pop the auto-recorded set action, then the pass action
        const last = newActions[newActions.length - 1];
        if (last?.type === 'set') newActions.pop(); // remove auto-set
        if (newActions[newActions.length - 1]?.type === 'pass') newActions.pop(); // remove pass
        setCurrentRally(prev => ({ ...prev, actions: newActions, step: 'pass' }));
      } else {
        newActions.pop();
        const prevMap: Record<string, RallyStep> = { ace_passer: 'serve', pass: 'serve', defense_result: 'attack' };
        setCurrentRally(prev => ({ ...prev, actions: newActions, step: prevMap[prev.step] || 'serve' }));
      }
    } else if (currentRally.step !== 'choose_server') {
      setCurrentRally(prev => ({ ...prev, step: 'choose_server', servingTeam: null }));
    }
  };

  const steps = ['serve', 'pass', 'attack'] as const;

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto pb-32">
      {/* Step Progress + Undo */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-1.5">
          {steps.map((s, i) => (
            <div key={s} className={`h-1.5 w-8 rounded-full transition-all ${
              currentRally.step === s ? 'bg-primary' :
              steps.indexOf(currentRally.step as any) > i ? 'bg-primary/40' : 'bg-white/10'
            }`} />
          ))}
        </div>
        {currentRally.step !== 'choose_server' && (
          <button onClick={undoLastAction}
            className="text-[10px] font-bold uppercase text-primary border border-primary/30 px-3 py-1.5 rounded-lg active:scale-95 flex items-center gap-1">
            <RotateCcw className="w-3 h-3" /> Undo
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* CHOOSE SERVER */}
        {currentRally.step === 'choose_server' && (
          <motion.div key="server" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4 flex-1 flex flex-col justify-center">
            <h3 className="text-xs font-bold text-white/30 uppercase tracking-widest text-center">Who's serving?</h3>
            <ActionButton onClick={() => startRally('own')} className="h-28 bg-primary text-black" label="MY TEAM" icon={<ChevronRight />} />
            <ActionButton onClick={() => startRally('opponent')} className="h-28 bg-secondary text-black" label="OPPONENT" icon={<ChevronRight />} />
          </motion.div>
        )}

        {/* SERVE */}
        {currentRally.step === 'serve' && (
          <motion.div key="serve" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <h3 className="text-xs font-bold text-white/30 uppercase tracking-widest">Server</h3>
            <div className="grid grid-cols-2 gap-3">
              {gameState.players.filter(p => p.team === currentRally.servingTeam).map(p => {
                const lastServerId = gameState.lastServer[currentRally.servingTeam!];
                const teamPlayers = gameState.players.filter(pp => pp.team === currentRally.servingTeam);
                const lastIdx = teamPlayers.findIndex(pp => pp.id === lastServerId);
                const lastRally = gameState.rallies[gameState.rallies.length - 1];
                const wasContinuing = lastRally && lastRally.winner === lastRally.servingTeam && lastRally.winner === currentRally.servingTeam;
                const suggestedId = wasContinuing ? lastServerId : (lastIdx === -1 ? teamPlayers[0]?.id : teamPlayers[(lastIdx + 1) % teamPlayers.length]?.id);
                return <PlayerSelectButton key={p.id} player={p} onSelect={() => {}} selected={suggestedId === p.id} />;
              })}
            </div>
            <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
              {(['topspin', 'float'] as ServeType[]).map(t => (
                <button key={t} onClick={() => setSelectedServeType(t)}
                  className={`flex-1 py-2 rounded-lg font-bold uppercase text-[11px] tracking-wider transition-all ${selectedServeType === t ? 'bg-primary text-black' : 'text-white/40'}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <OutcomeButton label="Ace" onClick={pid => addAction(pid, 'serve', { result: 'ace', serveType: selectedServeType })} variant="positive" team={currentRally.servingTeam!} />
              <OutcomeButton label="In" onClick={pid => addAction(pid, 'serve', { result: 'in', serveType: selectedServeType })} variant="neutral" team={currentRally.servingTeam!} />
              <OutcomeButton label="Error" onClick={pid => addAction(pid, 'serve', { result: 'error', serveType: selectedServeType })} variant="negative" team={currentRally.servingTeam!} />
            </div>
          </motion.div>
        )}

        {/* ACE — Select receiving passer */}
        {currentRally.step === 'ace_passer' && (
          <motion.div key="ace_passer" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <h3 className="text-xs font-bold text-white/30 uppercase tracking-widest">Ace! Which passer?</h3>
            <div className="grid grid-cols-2 gap-3">
              {gameState.players.filter(p => p.team !== currentRally.servingTeam).map(p => {
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      // Record an ace pass (score 0) for this receiver, then finish rally
                      const passAction: TrackedAction = {
                        id: `a-${Date.now()}`, playerId: p.id, type: 'pass',
                        result: 'ace', timestamp: Date.now()
                      };
                      finishRally(currentRally.servingTeam!, [...currentRally.actions, passAction]);
                    }}
                    className="min-h-[64px] rounded-2xl p-4 flex flex-col justify-center transition-all active:scale-95 border-2 border-white/10 bg-white/5 hover:bg-primary/15 hover:border-primary"
                  >
                    <span className="font-black italic uppercase leading-none text-lg text-left">
                      {p.name || 'Opp ' + p.id.slice(1)}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* PASS */}
        {currentRally.step === 'pass' && (
          <motion.div key="pass" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <h3 className="text-xs font-bold text-white/30 uppercase tracking-widest">Passer</h3>
            <div className="grid grid-cols-2 gap-3">
              {gameState.players.filter(p => p.team !== currentRally.servingTeam).map(p => (
                <PlayerSelectButton key={p.id} player={p} onSelect={() => {}} />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <OutcomeButton label="Perfect" onClick={pid => addAction(pid, 'pass', { result: 'perfect' })} variant="positive" team={currentRally.servingTeam === 'own' ? 'opponent' : 'own'} />
              <OutcomeButton label="Good" onClick={pid => addAction(pid, 'pass', { result: 'good' })} variant="neutral" team={currentRally.servingTeam === 'own' ? 'opponent' : 'own'} />
              <OutcomeButton label="Bad" onClick={pid => addAction(pid, 'pass', { result: 'bad' })} variant="negative" team={currentRally.servingTeam === 'own' ? 'opponent' : 'own'} />
            </div>
          </motion.div>
        )}



        {/* ATTACK */}
        {currentRally.step === 'attack' && (
          <motion.div key="attack" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-white/30 uppercase tracking-widest">Attack</h3>
              {getDefaultAttackerId() && (
                <span className="text-[10px] bg-primary/20 text-primary px-2 py-1 rounded font-bold uppercase">
                  {gameState.players.find(p => p.id === getDefaultAttackerId())?.name} (auto)
                </span>
              )}
            </div>
            {!getDefaultAttackerId() && (
              <div className="grid grid-cols-2 gap-3">
                {gameState.players.filter(p => p.team !== currentRally.servingTeam).map(p => (
                  <PlayerSelectButton key={p.id} player={p} onSelect={() => {}} />
                ))}
              </div>
            )}
            <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10 mb-1">
              {(['set', 'option'] as const).map(t => (
                <button key={t} onClick={() => setIsOption(t === 'option')}
                  className={`flex-1 py-2 rounded-lg font-bold uppercase text-[11px] tracking-wider transition-all ${
                    (t === 'option') === isOption ? 'bg-primary text-black' : 'text-white/40'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
              {(['hit line', 'line shot', 'dink', 'hit cross', 'cut shot', 'rainbow'] as AttackType[]).map(t => (
                <button key={t} onClick={() => setSelectedAttackType(t)}
                  className={`py-2 rounded-lg font-bold uppercase text-[10px] tracking-tight transition-all ${
                    selectedAttackType === t ? 'bg-primary text-black' : 'text-white/40'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { const pid = getDefaultAttackerId() || getSelectedPlayerId(); if (pid) addAction(pid, 'attack', { result: 'point', attackType: selectedAttackType }); }}
                className="py-6 bg-success text-black font-black uppercase rounded-xl active:scale-95 transition-all text-base">Point</button>
              <button onClick={() => { const pid = getDefaultAttackerId() || getSelectedPlayerId(); if (pid) addAction(pid, 'attack', { result: 'error', attackType: selectedAttackType }); }}
                className="py-6 bg-danger text-white font-black uppercase rounded-xl active:scale-95 transition-all text-base">Error</button>
              <button onClick={() => { const pid = getDefaultAttackerId() || getSelectedPlayerId(); if (pid) addAction(pid, 'attack', { result: 'defended', attackType: selectedAttackType }); }}
                className="py-4 border border-white/10 text-white/50 font-bold uppercase rounded-xl text-xs tracking-wider">Defended</button>
              <button onClick={() => { const pid = getDefaultAttackerId() || getSelectedPlayerId(); if (pid) addAction(pid, 'attack', { result: 'blocked', attackType: selectedAttackType }); }}
                className="py-4 border border-white/10 text-white/50 font-bold uppercase rounded-xl text-xs tracking-wider">Blocked</button>
            </div>
          </motion.div>
        )}

        {/* DEFENSE RESULT — who scored? */}
        {currentRally.step === 'defense_result' && (() => {
          const servingTeam = currentRally.servingTeam!;
          const sideoutTeam: TeamSide = servingTeam === 'own' ? 'opponent' : 'own';
          const servingLabel = servingTeam === 'own' ? 'My Team' : 'Opponent';
          const sideoutLabel = sideoutTeam === 'own' ? 'My Team' : 'Opponent';
          return (
            <motion.div key="defense" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 flex-1 flex flex-col justify-center">
              <h3 className="text-xs font-bold text-white/30 uppercase tracking-widest text-center">Who scored?</h3>
              <button onClick={() => finishRally(servingTeam, currentRally.actions)}
                className={`py-12 font-black uppercase rounded-2xl text-xl active:scale-95 transition-all ${servingTeam === 'own' ? 'bg-primary text-black' : 'bg-secondary text-black'}`}>
                {servingLabel}
                <span className="block text-[10px] font-bold opacity-60 mt-1 normal-case tracking-wider">Serving team</span>
              </button>
              <button onClick={() => finishRally(sideoutTeam, currentRally.actions)}
                className={`py-12 font-black uppercase rounded-2xl text-xl active:scale-95 transition-all ${sideoutTeam === 'own' ? 'bg-primary text-black' : 'bg-secondary text-black'}`}>
                {sideoutLabel}
                <span className="block text-[10px] font-bold opacity-60 mt-1 normal-case tracking-wider">Sideout team</span>
              </button>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
