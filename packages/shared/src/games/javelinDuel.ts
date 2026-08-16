import type { GameModule, PlayerSlot } from "../gameModule.js";

export const JAVELIN_DUEL_ID = "javelin-duel";

export const MAX_THROWS = 3;
const SWEET_SPOT_ANGLE = 42;
const BASE_DISTANCE = 40; // meters, achieved at perfect angle/power/timing

export interface ThrowResult {
  distance: number;
  foul: boolean;
  /** Raw inputs that produced this result — kept so any client (thrower or
   * spectating partner) can replay the same flight animation once this
   * throw shows up in state, not just the player who submitted it. */
  angle: number;
  power: number;
  timingAccuracy: number;
}

export interface JavelinDuelState {
  throws: Record<PlayerSlot, ThrowResult[]>;
  turn: PlayerSlot;
  status: "playing" | "finished";
}

export interface JavelinDuelAction {
  type: "throw";
  /** Degrees, 0-90. */
  angle: number;
  /** Percent, 0-100. */
  power: number;
  /** 0-1, how close to the foul line the release landed (only meaningful if not a foul). */
  timingAccuracy: number;
  /** True if the run-up crossed the foul line before a throw was released. */
  foul: boolean;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Pure scoring formula, kept separate from applyAction so it's directly
 * testable. Distance peaks when angle is near the sweet spot and both power
 * and timing are maxed; degrades smoothly away from the sweet spot rather
 * than cutting off sharply.
 */
export function computeThrowDistance(angle: number, power: number, timingAccuracy: number): number {
  const clampedAngle = Math.max(0, Math.min(90, angle));
  const clampedPower = clamp01(power / 100);
  const clampedTiming = clamp01(timingAccuracy);

  const angleEfficiency = clamp01(1 - Math.abs(clampedAngle - SWEET_SPOT_ANGLE) / 90);
  // Timing still contributes even at 0 accuracy (a slow-but-safe release
  // isn't a total waste), it just caps out lower than a perfectly-timed one.
  const timingMultiplier = 0.5 + 0.5 * clampedTiming;

  return Math.max(0, BASE_DISTANCE * angleEfficiency * clampedPower * timingMultiplier);
}

function otherSlot(slot: PlayerSlot): PlayerSlot {
  return slot === 1 ? 2 : 1;
}

export const javelinDuelGame: GameModule<JavelinDuelState, JavelinDuelAction> = {
  id: JAVELIN_DUEL_ID,

  createInitialState(): JavelinDuelState {
    return {
      throws: { 1: [], 2: [] },
      turn: 1,
      status: "playing",
    };
  },

  applyAction(state, playerSlot, action): JavelinDuelState {
    if (state.status !== "playing") return state;
    if (action.type !== "throw") return state;
    if (playerSlot !== state.turn) return state; // not this player's turn
    if (state.throws[playerSlot].length >= MAX_THROWS) return state; // safety guard

    const distance = action.foul ? 0 : computeThrowDistance(action.angle, action.power, action.timingAccuracy);
    const throws = {
      ...state.throws,
      [playerSlot]: [
        ...state.throws[playerSlot],
        {
          distance,
          foul: action.foul,
          angle: action.angle,
          power: action.power,
          timingAccuracy: action.timingAccuracy,
        },
      ],
    };

    const bothDone = throws[1].length >= MAX_THROWS && throws[2].length >= MAX_THROWS;

    return {
      throws,
      turn: otherSlot(playerSlot),
      status: bothDone ? "finished" : "playing",
    };
  },

  isGameOver(state): boolean {
    return state.status !== "playing";
  },
};

/** Best single throw for a player, or 0 if they haven't thrown yet. */
export function bestDistance(state: JavelinDuelState, slot: PlayerSlot): number {
  return state.throws[slot].reduce((max, t) => Math.max(max, t.distance), 0);
}

/** Winning slot once the match is finished, or "tie" if best distances are equal. */
export function getWinner(state: JavelinDuelState): PlayerSlot | "tie" | null {
  if (state.status !== "finished") return null;
  const d1 = bestDistance(state, 1);
  const d2 = bestDistance(state, 2);
  if (d1 === d2) return "tie";
  return d1 > d2 ? 1 : 2;
}
