import type { GameModule, PlayerSlot } from "../gameModule.js";
import { isValidGuessWord, pickRandomAnswer } from "./wordList.js";

export const WORD_DUEL_ID = "word-duel";
export const MAX_ATTEMPTS = 6;
export const MAX_HINTS = 1;

export type LetterStatus = "correct" | "present" | "absent";

export interface GuessRow {
  guess: string;
  statuses: LetterStatus[];
  guessedBy: PlayerSlot;
}

export interface HintedLetter {
  index: number;
  letter: string;
}

export interface WordDuelState {
  /** Not sent to clients as plaintext until the game ends; see toClientState. */
  answer: string;
  rows: GuessRow[];
  turn: PlayerSlot;
  status: "playing" | "won" | "lost";
  hints: HintedLetter[];
}

export type WordDuelAction = { type: "guess"; guess: string } | { type: "hint" };

/** Shape actually sent over the wire — never leaks the answer mid-game. */
export interface WordDuelClientState {
  rows: GuessRow[];
  turn: PlayerSlot;
  status: "playing" | "won" | "lost";
  attemptsRemaining: number;
  maxAttempts: number;
  answer: string | null; // revealed only once status !== "playing"
  hints: HintedLetter[];
  hintsRemaining: number;
  maxHints: number;
}

export function toClientState(state: WordDuelState): WordDuelClientState {
  return {
    rows: state.rows,
    turn: state.turn,
    status: state.status,
    attemptsRemaining: MAX_ATTEMPTS - state.rows.length,
    maxAttempts: MAX_ATTEMPTS,
    answer: state.status === "playing" ? null : state.answer,
    hints: state.hints,
    hintsRemaining: MAX_HINTS - state.hints.length,
    maxHints: MAX_HINTS,
  };
}

function scoreGuess(guess: string, answer: string): LetterStatus[] {
  const statuses: LetterStatus[] = new Array(guess.length).fill("absent");
  const answerLetters = answer.split("");
  const used = new Array(answer.length).fill(false);

  // First pass: exact matches.
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answerLetters[i]) {
      statuses[i] = "correct";
      used[i] = true;
    }
  }
  // Second pass: right letter, wrong position (respecting letter counts).
  for (let i = 0; i < guess.length; i++) {
    if (statuses[i] === "correct") continue;
    const idx = answerLetters.findIndex((c, j) => !used[j] && c === guess[i]);
    if (idx !== -1) {
      statuses[i] = "present";
      used[idx] = true;
    }
  }
  return statuses;
}

export const wordDuelGame: GameModule<WordDuelState, WordDuelAction, WordDuelClientState> = {
  id: WORD_DUEL_ID,

  toClientState,

  createInitialState(): WordDuelState {
    return {
      answer: pickRandomAnswer(),
      rows: [],
      turn: 1,
      status: "playing",
      hints: [],
    };
  },

  applyAction(state, playerSlot, action): WordDuelState {
    if (state.status !== "playing") return state;

    if (action.type === "hint") {
      // A hint is a shared team resource, not turn-locked — either player
      // can use it whenever it's available.
      if (state.hints.length >= MAX_HINTS) return state;
      const revealedIndices = new Set(state.hints.map((h) => h.index));
      const available = [...state.answer].map((_, i) => i).filter((i) => !revealedIndices.has(i));
      if (available.length === 0) return state;
      const index = available[Math.floor(Math.random() * available.length)];
      return { ...state, hints: [...state.hints, { index, letter: state.answer[index] }] };
    }

    if (playerSlot !== state.turn) return state; // not this player's turn

    const guess = action.guess.trim().toUpperCase();
    // Only accept real 5-letter words — rejects gibberish (this also covers
    // the shape check, since non-words of the wrong length never match).
    if (!isValidGuessWord(guess)) return state;

    const statuses = scoreGuess(guess, state.answer);
    const rows = [...state.rows, { guess, statuses, guessedBy: playerSlot }];
    const won = guess === state.answer;
    const outOfAttempts = rows.length >= MAX_ATTEMPTS;

    return {
      ...state,
      rows,
      turn: playerSlot === 1 ? 2 : 1,
      status: won ? "won" : outOfAttempts ? "lost" : "playing",
    };
  },

  isGameOver(state): boolean {
    return state.status !== "playing";
  },
};
