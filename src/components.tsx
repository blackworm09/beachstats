import React from 'react';
import { Player, TeamSide } from './types';

// Get selected player from DOM (used by outcome buttons)
export function getSelectedPlayerId(): string | undefined {
  return (document.querySelector('[data-selected="true"]') as HTMLElement)?.dataset.playerId;
}

// Player selection button — large touch target for phone
export function PlayerSelectButton({ player, onSelect, selected }: {
  key?: React.Key;
  player: Player;
  onSelect: () => void;
  selected?: boolean;
}) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    document.querySelectorAll('[data-player-button="true"]').forEach(el =>
      el.setAttribute('data-selected', 'false')
    );
    e.currentTarget.setAttribute('data-selected', 'true');
    onSelect();
  };

  const displayName = player.name || (player.team === 'own' ? 'Player' : 'Opp') + ' ' + player.id.slice(1);

  return (
    <button
      data-player-button="true"
      data-player-id={player.id}
      data-selected={selected ? 'true' : 'false'}
      onClick={handleClick}
      className={`min-h-[64px] group relative overflow-hidden rounded-2xl p-4 flex flex-col justify-center transition-all active:scale-95 border-2 bg-white/5 hover:bg-white/10
        data-[selected=true]:border-primary data-[selected=true]:bg-primary/15
        data-[selected=false]:border-white/10`}
    >
      <span className="font-black italic uppercase leading-none text-lg sm:text-xl text-left block group-data-[selected=true]:text-primary transition-colors">
        {displayName}
      </span>
    </button>
  );
}

// Outcome button (Ace, Error, Point, etc.)
export function OutcomeButton({ label, onClick, variant = 'positive' }: {
  key?: React.Key;
  label: string;
  onClick: (playerId: string) => void;
  team: TeamSide;
  variant?: 'positive' | 'negative' | 'neutral';
}) {
  const handleClick = () => {
    const pid = getSelectedPlayerId();
    if (pid) {
      onClick(pid);
    } else {
      const el = document.querySelector('[data-player-button="true"]');
      if (el) {
        el.classList.add('animate-shake');
        setTimeout(() => el.classList.remove('animate-shake'), 300);
      }
    }
  };

  const colors = {
    positive: 'bg-success text-black hover:brightness-110',
    negative: 'bg-danger text-white hover:brightness-110',
    neutral: 'bg-white/10 text-white border border-white/20 hover:bg-white/20',
  };

  return (
    <button
      onClick={handleClick}
      className={`py-4 px-3 rounded-xl font-bold uppercase text-xs tracking-wider transition-all ${colors[variant]} active:scale-90`}
    >
      {label}
    </button>
  );
}

// Large action button (serving team select)
export function ActionButton({ onClick, className, label, icon }: {
  onClick: () => void;
  className?: string;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl p-5 flex flex-col justify-between transition-all active:scale-95 border border-white/10 ${className}`}
    >
      <span className="text-[10px] font-bold uppercase opacity-50 text-left">SERVING</span>
      <div className="absolute top-5 right-5 opacity-20">{icon}</div>
      <span className="font-black uppercase italic tracking-tighter text-2xl sm:text-3xl leading-none text-left">
        {label}
      </span>
    </button>
  );
}
