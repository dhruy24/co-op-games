import type { GameModule, PlayerSlot } from "../gameModule.js";

export const MEMORY_MATCH_ID = "memory-match";

// 8 distinct emoji, each duplicated once, gives a classic 4x4 / 8-pair board.
const SYMBOLS = ["❤️", "🍕", "🎸", "🌈", "🎲", "🐶", "🎯", "🎨"];

export interface MemoryMatchCard {
  value: string;
  matched: boolean;
}

export interface MemoryMatchState {
  cards: MemoryMatchCard[];
  /** Indices currently face-up but not yet resolved as a match/mismatch (0, 1, or 2 of them). */
  flipped: number[];
  turn: PlayerSlot;
  scores: Record<PlayerSlot, number>;
  status: "playing" | "won";
}

export type MemoryMatchAction = { type: "flip"; index: number };

export interface MemoryMatchClientCard {
  /** Null unless this card is currently flipped or already matched — never leaks unseen values. */
  value: string | null;
  matched: boolean;
}

export interface MemoryMatchClientState {
  cards: MemoryMatchClientCard[];
  flipped: number[];
  turn: PlayerSlot;
  scores: Record<PlayerSlot, number>;
  status: "playing" | "won";
}

function shuffledDeck(): MemoryMatchCard[] {
  const deck = [...SYMBOLS, ...SYMBOLS].map((value) => ({ value, matched: false }));
  // Fisher-Yates shuffle.
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function toClientState(state: MemoryMatchState): MemoryMatchClientState {
  return {
    cards: state.cards.map((card, i) => ({
      value: card.matched || state.flipped.includes(i) ? card.value : null,
      matched: card.matched,
    })),
    flipped: state.flipped,
    turn: state.turn,
    scores: state.scores,
    status: state.status,
  };
}

export const memoryMatchGame: GameModule<MemoryMatchState, MemoryMatchAction, MemoryMatchClientState> = {
  id: MEMORY_MATCH_ID,

  toClientState,

  createInitialState(): MemoryMatchState {
    return {
      cards: shuffledDeck(),
      flipped: [],
      turn: 1,
      scores: { 1: 0, 2: 0 },
      status: "playing",
    };
  },

  applyAction(state, playerSlot, action): MemoryMatchState {
    if (state.status !== "playing") return state;
    if (action.type !== "flip") return state;
    if (playerSlot !== state.turn) return state; // not this player's turn

    const { index } = action;
    if (index < 0 || index >= state.cards.length) return state;
    if (state.cards[index].matched) return state;
    if (state.flipped.includes(index)) return state; // already face-up

    // A leftover mismatched pair from the previous turn is still shown
    // face-up in `flipped` — the current player's first flip of their new
    // turn clears it, so the mismatch briefly stays visible without needing
    // any server-side timer.
    const flipped = state.flipped.length === 2 ? [] : state.flipped;

    const nextFlipped = [...flipped, index];

    if (nextFlipped.length < 2) {
      return { ...state, flipped: nextFlipped };
    }

    const [firstIndex, secondIndex] = nextFlipped;
    const isMatch = state.cards[firstIndex].value === state.cards[secondIndex].value;

    if (isMatch) {
      const cards = state.cards.map((card, i) =>
        i === firstIndex || i === secondIndex ? { ...card, matched: true } : card
      );
      const scores = { ...state.scores, [playerSlot]: state.scores[playerSlot] + 1 };
      const won = cards.every((card) => card.matched);
      return {
        ...state,
        cards,
        flipped: [], // matched cards are shown via `matched`, not `flipped`
        scores,
        turn: playerSlot, // bonus turn — same player goes again
        status: won ? "won" : "playing",
      };
    }

    // Mismatch: keep both cards face-up in `flipped` for the client to
    // display, and pass the turn to the other player.
    return { ...state, flipped: nextFlipped, turn: playerSlot === 1 ? 2 : 1 };
  },

  isGameOver(state): boolean {
    return state.status !== "playing";
  },
};
