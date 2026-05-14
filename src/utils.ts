import { Rally, Player } from './types';

// Beach volleyball set point limits
export function getSetLimit(setNumber: number): number {
  return setNumber >= 3 ? 15 : 21;
}

// Check if a set is won: must reach limit AND be ahead by 2
export function isSetWon(score: { own: number; opponent: number }, setNumber: number): boolean {
  const limit = getSetLimit(setNumber);
  const max = Math.max(score.own, score.opponent);
  const diff = Math.abs(score.own - score.opponent);
  return max >= limit && diff >= 2;
}

// Format date for display
export function formatMatchDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

// Calculate all statistics
export function calculateStats(rallies: Rally[], players: Player[]) {
  const playerStats = players.reduce((acc, p) => {
    acc[p.id] = {
      id: p.id,
      name: p.name,
      team: p.team,
      attacks: 0,
      shots: 0,
      hits: 0,
      serves: 0,
      aces: 0,
      points: 0,
      errors: 0,
      passes: 0,
      perfectPasses: 0,
      goodPasses: 0,
      badPasses: 0,
      acePasses: 0,
      sideoutAttempts: 0,
      sideoutPoints: 0,
      sideoutErrors: 0,
      serveErrors: 0,
      attacksByType: {} as Record<string, { count: number; points: number; errors: number }>,
    };
    return acc;
  }, {} as Record<string, any>);

  const teamTotals = {
    own: { sideoutOpps: 0, sideoutWon: 0, sideoutErrors: 0, totalErrors: 0, totalPoints: 0 },
    opponent: { sideoutOpps: 0, sideoutWon: 0, sideoutErrors: 0, totalErrors: 0, totalPoints: 0 }
  };

  rallies.forEach(rally => {
    const recTeam = rally.servingTeam === 'own' ? 'opponent' : 'own';
    teamTotals[recTeam].sideoutOpps++;

    if (rally.winner === recTeam) {
      teamTotals[recTeam].sideoutWon++;
    }

    rally.actions.forEach(action => {
      const ps = playerStats[action.playerId];
      if (!ps) return;
      const isRecSide = ps.team === recTeam;

      if (action.type === 'serve') {
        ps.serves++;
        if (action.result === 'ace') { ps.aces++; ps.points++; teamTotals[ps.team].totalPoints++; }
        if (action.result === 'error') { ps.errors++; ps.serveErrors++; teamTotals[ps.team].totalErrors++; }
      }

      if (action.type === 'pass') {
        ps.passes++;
        if (action.result === 'perfect') ps.perfectPasses++;
        else if (action.result === 'good') ps.goodPasses++;
        else if (action.result === 'bad') ps.badPasses++;
        else if (action.result === 'ace') ps.acePasses++;
      }

      if (action.type === 'attack') {
        ps.attacks++;
        if (isRecSide) ps.sideoutAttempts++;

        // Track by attack type
        const atkType = action.attackType || 'unknown';
        if (!ps.attacksByType[atkType]) {
          ps.attacksByType[atkType] = { count: 0, points: 0, errors: 0 };
        }
        ps.attacksByType[atkType].count++;

        if (['shot', 'line shot', 'cutshot', 'dink', 'rainbow'].includes(atkType)) {
          ps.shots++;
        } else if (atkType.startsWith('hit')) {
          ps.hits++;
        }

        if (action.result === 'point') {
          ps.points++; teamTotals[ps.team].totalPoints++;
          if (isRecSide) ps.sideoutPoints++;
          ps.attacksByType[atkType].points++;
        }
        if (action.result === 'error') {
          ps.errors++; teamTotals[ps.team].totalErrors++;
          if (isRecSide) { ps.sideoutErrors++; teamTotals[ps.team].sideoutErrors++; }
          ps.attacksByType[atkType].errors++;
        }
      }
    });
  });

  const calcEff = (p: number, e: number, a: number) => a > 0 ? (p - e) / a : 0;

  return {
    playerStats: Object.values(playerStats).map((ps: any) => ({
      ...ps,
      efficiency: calcEff(ps.points, ps.errors, ps.attacks + ps.serves),
      sideoutEfficiency: calcEff(ps.sideoutPoints, ps.sideoutErrors, ps.sideoutAttempts),
      passPercentage: ps.passes > 0 ? ((ps.perfectPasses + ps.goodPasses) / ps.passes) * 100 : 0,
      passScore: ps.passes > 0 ? (ps.perfectPasses * 3 + ps.goodPasses * 2 + ps.badPasses * 1) / ps.passes : 0,
    })),
    teamTotals: {
      own: {
        ...teamTotals.own,
        sideoutRate: teamTotals.own.sideoutOpps > 0 ? teamTotals.own.sideoutWon / teamTotals.own.sideoutOpps : 0,
        sideoutEfficiency: teamTotals.own.sideoutOpps > 0 ? (teamTotals.own.sideoutWon - teamTotals.own.sideoutErrors) / teamTotals.own.sideoutOpps : 0
      },
      opponent: {
        ...teamTotals.opponent,
        sideoutRate: teamTotals.opponent.sideoutOpps > 0 ? teamTotals.opponent.sideoutWon / teamTotals.opponent.sideoutOpps : 0,
        sideoutEfficiency: teamTotals.opponent.sideoutOpps > 0 ? (teamTotals.opponent.sideoutWon - teamTotals.opponent.sideoutErrors) / teamTotals.opponent.sideoutOpps : 0
      }
    }
  };
}

// Detect player attack trends and patterns — returns actionable alerts
export function detectTrends(stats: ReturnType<typeof calculateStats>): { message: string; type: 'info' | 'warning' | 'alert' }[] {
  const trends: { message: string; type: 'info' | 'warning' | 'alert' }[] = [];

  stats.playerStats.forEach((ps: any) => {
    const name = ps.name || (ps.team === 'own' ? 'Player' : 'Opp') + ' ' + ps.id.slice(1);
    const isOpponent = ps.team === 'opponent';

    // --- Attack type preferences (need at least 3 attacks) ---
    if (ps.attacks >= 3) {
      const typeEntries = Object.entries(ps.attacksByType) as [string, { count: number; points: number; errors: number }][];
      if (typeEntries.length > 0) {
        // Find dominant attack type
        const sorted = [...typeEntries].sort((a, b) => b[1].count - a[1].count);
        const [topType, topData] = sorted[0];
        const pct = Math.round((topData.count / ps.attacks) * 100);

        if (pct >= 50 && topData.count >= 3) {
          if (isOpponent) {
            trends.push({
              message: `${name} favors ${topType} (${pct}% of attacks). Adjust defense!`,
              type: 'alert'
            });
          } else {
            // If own player has high error rate on their favorite shot
            const errRate = topData.count > 0 ? topData.errors / topData.count : 0;
            if (errRate > 0.5 && topData.errors >= 2) {
              trends.push({
                message: `${name} has ${Math.round(errRate * 100)}% errors on ${topType}. Try mixing up.`,
                type: 'warning'
              });
            }
          }
        }

        // Shots vs Hits preference
        if (ps.shots + ps.hits >= 4) {
          const shotRatio = ps.shots / (ps.shots + ps.hits);
          if (shotRatio >= 0.7) {
            trends.push({
              message: `${name} uses shots over hits (${ps.shots}:${ps.hits})${isOpponent ? '. Expect soft attacks.' : ''}`,
              type: isOpponent ? 'alert' : 'info'
            });
          } else if (shotRatio <= 0.3) {
            trends.push({
              message: `${name} prefers hitting (${ps.hits}:${ps.shots} hit:shot)${isOpponent ? '. Set your block.' : ''}`,
              type: isOpponent ? 'alert' : 'info'
            });
          }
        }

        // Line tendency (hit line + line shot combined)
        const lineCount = (ps.attacksByType['hit line']?.count || 0) + (ps.attacksByType['line shot']?.count || 0);
        if (lineCount >= 3 && ps.attacks >= 4) {
          const linePct = Math.round((lineCount / ps.attacks) * 100);
          if (linePct >= 50) {
            trends.push({
              message: `${name} goes line ${linePct}% of the time (${lineCount}/${ps.attacks})!`,
              type: isOpponent ? 'alert' : 'info'
            });
          }
        }

        // Cross tendency
        const crossCount = (ps.attacksByType['hit cross']?.count || 0) + (ps.attacksByType['cutshot']?.count || 0);
        if (crossCount >= 3 && ps.attacks >= 4) {
          const crossPct = Math.round((crossCount / ps.attacks) * 100);
          if (crossPct >= 50) {
            trends.push({
              message: `${name} goes cross ${crossPct}% (${crossCount}/${ps.attacks}). Shift defense.`,
              type: isOpponent ? 'alert' : 'info'
            });
          }
        }
      }
    }

    // --- Serve error rate ---
    if (ps.serves >= 3) {
      const serveErrRate = ps.serveErrors / ps.serves;
      if (serveErrRate >= 0.33 && ps.serveErrors >= 2) {
        if (ps.team === 'own') {
          trends.push({
            message: `${name}: ${ps.serveErrors}/${ps.serves} serve errors. Dial it back.`,
            type: 'warning'
          });
        } else {
          trends.push({
            message: `${name} has ${ps.serveErrors} serve errors in ${ps.serves}. Free points!`,
            type: 'info'
          });
        }
      }
    }

    // --- Pass struggles ---
    if (ps.passes >= 3) {
      const badRate = ps.badPasses / ps.passes;
      if (badRate >= 0.5 && ps.badPasses >= 2) {
        if (isOpponent) {
          trends.push({
            message: `${name} struggling on pass (${Math.round(badRate * 100)}% bad). Target them!`,
            type: 'alert'
          });
        } else {
          trends.push({
            message: `${name} pass trouble (${Math.round(badRate * 100)}% bad). Simplify.`,
            type: 'warning'
          });
        }
      }
    }
  });

  return trends;
}
