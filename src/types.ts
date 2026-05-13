export type TeamSide = 'own' | 'opponent';

export interface Player {
  id: string;
  name: string;
  team: TeamSide;
}

export type ActionType =
  | 'serve'
  | 'pass'
  | 'set'
  | 'attack'
  | 'option';

export type ActionResult =
  | 'ace'
  | 'error'
  | 'in'
  | 'perfect'
  | 'good'
  | 'bad'
  | 'point'
  | 'blocked'
  | 'defended';

export type AttackType = 'shot' | 'hit' | 'hit line' | 'hit cross' | 'line shot' | 'cutshot' | 'dink' | 'rainbow';
export type ServeType = 'topspin' | 'float';

export interface TrackedAction {
  id: string;
  playerId: string;
  type: ActionType;
  result?: ActionResult;
  attackType?: AttackType;
  serveType?: ServeType;
  timestamp: number;
}

export interface Rally {
  id: string;
  servingTeam: TeamSide;
  actions: TrackedAction[];
  winner: TeamSide;
  timestamp: number;
  setNumber: number;
}

export interface GameState {
  players: Player[];
  rallies: Rally[];
  isStarted: boolean;
  score: { own: number; opponent: number };
  lastServer: { own: string | null; opponent: string | null };
  sets: { own: number; opponent: number };
  setHistory: { own: number; opponent: number }[];
  matchDate: string; // ISO date string
}

export interface Alert {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'alert';
  timestamp: number;
}
