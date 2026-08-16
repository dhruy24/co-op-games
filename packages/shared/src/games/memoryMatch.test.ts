import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryMatchGame } from "./memoryMatch.js";

// Small helper: build a state with a known, non-shuffled card layout so
// tests are deterministic. Cards: [A, A, B, B] at indices 0-3, plus the
// real 16-card deck padded on for index-bounds tests where needed.
function baseState() {
  const state = memoryMatchGame.createInitialState();
  return {
    ...state,
    cards: [
      { value: "A", matched: false },
      { value: "A", matched: false },
      { value: "B", matched: false },
      { value: "B", matched: false },
    ],
  };
}

test("initial state deals a shuffled, fully face-down board", () => {
  const state = memoryMatchGame.createInitialState();
  assert.equal(state.cards.length, 16);
  assert.equal(state.cards.every((c) => !c.matched), true);
  assert.deepEqual(state.flipped, []);
  assert.equal(state.turn, 1);
  assert.deepEqual(state.scores, { 1: 0, 2: 0 });
  assert.equal(state.status, "playing");
});

test("wrong player's flip is ignored", () => {
  const state = baseState();
  const next = memoryMatchGame.applyAction(state, 2, { type: "flip", index: 0 });
  assert.equal(next, state);
});

test("first flip of a turn just reveals one card", () => {
  const state = baseState();
  const next = memoryMatchGame.applyAction(state, 1, { type: "flip", index: 0 });
  assert.deepEqual(next.flipped, [0]);
  assert.equal(next.turn, 1);
});

test("matching pair: marks matched, scores the player, grants a bonus turn", () => {
  let state = baseState();
  state = memoryMatchGame.applyAction(state, 1, { type: "flip", index: 0 });
  state = memoryMatchGame.applyAction(state, 1, { type: "flip", index: 1 });
  assert.equal(state.cards[0].matched, true);
  assert.equal(state.cards[1].matched, true);
  assert.deepEqual(state.flipped, []);
  assert.equal(state.scores[1], 1);
  assert.equal(state.turn, 1); // bonus turn, same player
  assert.equal(state.status, "playing"); // B pair still unmatched
});

test("mismatched pair: stays visible and passes the turn", () => {
  let state = baseState();
  state = memoryMatchGame.applyAction(state, 1, { type: "flip", index: 0 }); // A
  state = memoryMatchGame.applyAction(state, 1, { type: "flip", index: 2 }); // B — mismatch
  assert.deepEqual(state.flipped, [0, 2]);
  assert.equal(state.cards[0].matched, false);
  assert.equal(state.turn, 2); // turn passed
  assert.equal(state.scores[1], 0);
});

test("the next player's first flip clears the old mismatched pair", () => {
  let state = baseState();
  state = memoryMatchGame.applyAction(state, 1, { type: "flip", index: 0 }); // A
  state = memoryMatchGame.applyAction(state, 1, { type: "flip", index: 2 }); // B — mismatch, turn -> 2
  state = memoryMatchGame.applyAction(state, 2, { type: "flip", index: 1 }); // player 2's first flip
  assert.deepEqual(state.flipped, [1]); // old pair (0, 2) cleared, only the new flip shows
});

test("winning: status becomes won once every card is matched", () => {
  let state = baseState();
  state = memoryMatchGame.applyAction(state, 1, { type: "flip", index: 0 });
  state = memoryMatchGame.applyAction(state, 1, { type: "flip", index: 1 }); // A pair matched, bonus turn
  state = memoryMatchGame.applyAction(state, 1, { type: "flip", index: 2 });
  state = memoryMatchGame.applyAction(state, 1, { type: "flip", index: 3 }); // B pair matched -> board clear
  assert.equal(state.status, "won");
  assert.equal(state.scores[1], 2);
});

test("flipping an already-matched card is rejected", () => {
  let state = baseState();
  state = memoryMatchGame.applyAction(state, 1, { type: "flip", index: 0 });
  state = memoryMatchGame.applyAction(state, 1, { type: "flip", index: 1 }); // A pair matched
  const before = state;
  state = memoryMatchGame.applyAction(state, 1, { type: "flip", index: 0 });
  assert.equal(state, before);
});

test("an out-of-range index is rejected", () => {
  const state = baseState();
  const next = memoryMatchGame.applyAction(state, 1, { type: "flip", index: 99 });
  assert.equal(next, state);
});

test("once the game is won, further flips are no-ops", () => {
  let state = baseState();
  state = memoryMatchGame.applyAction(state, 1, { type: "flip", index: 0 });
  state = memoryMatchGame.applyAction(state, 1, { type: "flip", index: 1 });
  state = memoryMatchGame.applyAction(state, 1, { type: "flip", index: 2 });
  state = memoryMatchGame.applyAction(state, 1, { type: "flip", index: 3 });
  assert.equal(state.status, "won");
  const before = state;
  state = memoryMatchGame.applyAction(state, 1, { type: "flip", index: 0 });
  assert.equal(state, before);
});
