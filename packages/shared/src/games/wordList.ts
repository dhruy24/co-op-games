import { VALID_GUESSES } from "./validGuesses.js";

// Small curated list of common 5-letter words for the answer pool.
// Kept intentionally short and simple for the MVP.
export const ANSWER_WORDS = [
  "HEART", "SMILE", "DANCE", "PEACE", "LIGHT", "OCEAN", "DREAM", "HAPPY",
  "SUNNY", "MUSIC", "PARTY", "STORY", "MAGIC", "SWEET", "CLOUD", "WORLD",
  "TIGER", "PLANT", "RIVER", "TOAST", "GRAPE", "CHESS", "PLANE",
  "BEACH", "HOUSE", "PIANO", "CANDY", "BREAD", "LEMON", "MOUSE",
];

const VALID_GUESS_SET = new Set(VALID_GUESSES);

export function isValidGuessShape(guess: string): boolean {
  return /^[A-Z]{5}$/.test(guess);
}

/** True only for real 5-letter English words — rejects gibberish like "ZZZXX". */
export function isValidGuessWord(guess: string): boolean {
  return isValidGuessShape(guess) && VALID_GUESS_SET.has(guess);
}

export function pickRandomAnswer(): string {
  return ANSWER_WORDS[Math.floor(Math.random() * ANSWER_WORDS.length)];
}
