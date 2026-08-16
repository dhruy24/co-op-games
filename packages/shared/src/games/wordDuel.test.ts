import { test } from "node:test";
import assert from "node:assert/strict";
import { wordDuelGame, toClientState, MAX_ATTEMPTS, MAX_HINTS } from "./wordDuel.js";
import { isValidGuessWord } from "./wordList.js";

test("initial state starts on player 1's turn with no rows", () => {
  const state = wordDuelGame.createInitialState();
  assert.equal(state.turn, 1);
  assert.equal(state.rows.length, 0);
  assert.equal(state.status, "playing");
});

test("wrong player's action is ignored", () => {
  const state = wordDuelGame.createInitialState();
  const next = wordDuelGame.applyAction(state, 2, { type: "guess", guess: "HEART" });
  assert.equal(next, state);
});

test("correct guess wins and reveals the answer", () => {
  let state = wordDuelGame.createInitialState();
  state = { ...state, answer: "HEART" };
  state = wordDuelGame.applyAction(state, 1, { type: "guess", guess: "HEART" });
  assert.equal(state.status, "won");
  assert.equal(wordDuelGame.isGameOver(state), true);
  assert.equal(toClientState(state).answer, "HEART");
});

test("turn alternates between players after each guess", () => {
  let state = wordDuelGame.createInitialState();
  state = { ...state, answer: "HEART" };
  state = wordDuelGame.applyAction(state, 1, { type: "guess", guess: "SMILE" });
  assert.equal(state.turn, 2);
  state = wordDuelGame.applyAction(state, 2, { type: "guess", guess: "DANCE" });
  assert.equal(state.turn, 1);
});

test("running out of attempts loses the game", () => {
  let state = wordDuelGame.createInitialState();
  state = { ...state, answer: "HEART" };
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const slot = (i % 2 === 0 ? 1 : 2) as 1 | 2;
    state = wordDuelGame.applyAction(state, slot, { type: "guess", guess: "SMILE" });
  }
  assert.equal(state.status, "lost");
  assert.equal(toClientState(state).attemptsRemaining, 0);
});

test("scoreGuess marks correct, present, and absent letters", () => {
  let state = wordDuelGame.createInitialState();
  state = { ...state, answer: "HEART" };
  state = wordDuelGame.applyAction(state, 1, { type: "guess", guess: "TRACE" });
  const statuses = state.rows[0].statuses;
  // TRACE vs HEART -> T:present R:present A:correct C:absent E:present
  assert.deepEqual(statuses, ["present", "present", "correct", "absent", "present"]);
});

test("hint reveals a correct letter and is not turn-locked", () => {
  let state = wordDuelGame.createInitialState();
  state = { ...state, answer: "HEART" };
  // Player 2 uses the hint even though it's player 1's turn.
  state = wordDuelGame.applyAction(state, 2, { type: "hint" });
  assert.equal(state.hints.length, 1);
  const hint = state.hints[0];
  assert.equal(state.answer[hint.index], hint.letter);
  assert.equal(state.turn, 1); // turn is unaffected by using a hint
  assert.equal(toClientState(state).hintsRemaining, MAX_HINTS - 1);
});

test("hint is exhausted after MAX_HINTS uses", () => {
  let state = wordDuelGame.createInitialState();
  state = { ...state, answer: "HEART" };
  for (let i = 0; i < MAX_HINTS; i++) {
    state = wordDuelGame.applyAction(state, 1, { type: "hint" });
  }
  const before = state;
  state = wordDuelGame.applyAction(state, 1, { type: "hint" });
  assert.equal(state, before); // no-op once exhausted
  assert.equal(toClientState(state).hintsRemaining, 0);
});

test("isValidGuessWord accepts real words and rejects gibberish", () => {
  assert.equal(isValidGuessWord("HEART"), true);
  assert.equal(isValidGuessWord("TRACE"), true);
  assert.equal(isValidGuessWord("ZZZXX"), false); // not a word
  assert.equal(isValidGuessWord("ABCD"), false); // wrong length
  assert.equal(isValidGuessWord("ABCDEF"), false); // wrong length
});

test("gibberish guesses are rejected and don't consume an attempt or change turn", () => {
  let state = wordDuelGame.createInitialState();
  state = { ...state, answer: "HEART" };
  const before = state;
  state = wordDuelGame.applyAction(state, 1, { type: "guess", guess: "ZZZXX" });
  assert.equal(state, before);
  assert.equal(state.rows.length, 0);
  assert.equal(state.turn, 1);
});
