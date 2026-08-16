import { test } from "node:test";
import assert from "node:assert/strict";
import {
  javelinDuelGame,
  computeThrowDistance,
  bestDistance,
  getWinner,
  MAX_THROWS,
} from "./javelinDuel.js";

test("initial state: both players empty, player 1 starts, status playing", () => {
  const state = javelinDuelGame.createInitialState();
  assert.deepEqual(state.throws[1], []);
  assert.deepEqual(state.throws[2], []);
  assert.equal(state.turn, 1);
  assert.equal(state.status, "playing");
});

test("computeThrowDistance peaks near the 42-degree sweet spot at full power/timing", () => {
  const atSweetSpot = computeThrowDistance(42, 100, 1);
  const farFromSweetSpot = computeThrowDistance(5, 100, 1);
  assert.ok(atSweetSpot > farFromSweetSpot);
});

test("computeThrowDistance scales with power", () => {
  const fullPower = computeThrowDistance(42, 100, 1);
  const halfPower = computeThrowDistance(42, 50, 1);
  assert.ok(fullPower > halfPower);
});

test("computeThrowDistance scales with timing accuracy but never zeroes it out", () => {
  const perfectTiming = computeThrowDistance(42, 100, 1);
  const zeroTiming = computeThrowDistance(42, 100, 0);
  assert.ok(perfectTiming > zeroTiming);
  assert.ok(zeroTiming > 0); // a safe-but-slow release still counts for something
});

test("computeThrowDistance clamps out-of-range inputs instead of going negative/huge", () => {
  const overPower = computeThrowDistance(42, 500, 1);
  const normalPower = computeThrowDistance(42, 100, 1);
  assert.equal(overPower, normalPower);
  assert.ok(computeThrowDistance(200, 100, 1) >= 0);
});

test("wrong player's throw is ignored", () => {
  const state = javelinDuelGame.createInitialState();
  const next = javelinDuelGame.applyAction(state, 2, {
    type: "throw",
    angle: 42,
    power: 100,
    timingAccuracy: 1,
    foul: false,
  });
  assert.equal(next, state);
});

test("applyAction stores the raw throw inputs alongside the computed result", () => {
  let state = javelinDuelGame.createInitialState();
  state = javelinDuelGame.applyAction(state, 1, {
    type: "throw",
    angle: 35,
    power: 77,
    timingAccuracy: 0.6,
    foul: false,
  });
  const throw1 = state.throws[1][0];
  assert.equal(throw1.angle, 35);
  assert.equal(throw1.power, 77);
  assert.equal(throw1.timingAccuracy, 0.6);
});

test("a foul throw records distance 0 and still passes the turn", () => {
  let state = javelinDuelGame.createInitialState();
  state = javelinDuelGame.applyAction(state, 1, {
    type: "throw",
    angle: 42,
    power: 100,
    timingAccuracy: 1,
    foul: true,
  });
  assert.equal(state.throws[1].length, 1);
  assert.equal(state.throws[1][0].distance, 0);
  assert.equal(state.throws[1][0].foul, true);
  assert.equal(state.turn, 2);
});

test("turn alternates between players on each throw", () => {
  let state = javelinDuelGame.createInitialState();
  const throwAction = { type: "throw" as const, angle: 42, power: 80, timingAccuracy: 0.8, foul: false };
  state = javelinDuelGame.applyAction(state, 1, throwAction);
  assert.equal(state.turn, 2);
  state = javelinDuelGame.applyAction(state, 2, throwAction);
  assert.equal(state.turn, 1);
});

test("match finishes once both players have thrown MAX_THROWS times", () => {
  let state = javelinDuelGame.createInitialState();
  const throwAction = { type: "throw" as const, angle: 42, power: 80, timingAccuracy: 0.8, foul: false };
  for (let i = 0; i < MAX_THROWS; i++) {
    state = javelinDuelGame.applyAction(state, 1, throwAction);
    state = javelinDuelGame.applyAction(state, 2, throwAction);
  }
  assert.equal(state.status, "finished");
  assert.equal(state.throws[1].length, MAX_THROWS);
  assert.equal(state.throws[2].length, MAX_THROWS);
  assert.equal(javelinDuelGame.isGameOver(state), true);
});

test("a player can't exceed MAX_THROWS even if targeted directly", () => {
  let state = javelinDuelGame.createInitialState();
  const throwAction = { type: "throw" as const, angle: 42, power: 80, timingAccuracy: 0.8, foul: false };
  // Fill player 1 up to the limit via alternating turns.
  for (let i = 0; i < MAX_THROWS; i++) {
    state = javelinDuelGame.applyAction(state, 1, throwAction);
    state = javelinDuelGame.applyAction(state, 2, throwAction);
  }
  const before = state;
  // Game is finished, so further throws should no-op regardless.
  state = javelinDuelGame.applyAction(state, 1, throwAction);
  assert.equal(state, before);
});

test("getWinner picks the player with the farther best throw", () => {
  let state = javelinDuelGame.createInitialState();
  const strongThrow = { type: "throw" as const, angle: 42, power: 100, timingAccuracy: 1, foul: false };
  const weakThrow = { type: "throw" as const, angle: 10, power: 20, timingAccuracy: 0, foul: false };
  for (let i = 0; i < MAX_THROWS; i++) {
    state = javelinDuelGame.applyAction(state, 1, strongThrow);
    state = javelinDuelGame.applyAction(state, 2, weakThrow);
  }
  assert.equal(state.status, "finished");
  assert.ok(bestDistance(state, 1) > bestDistance(state, 2));
  assert.equal(getWinner(state), 1);
});

test("getWinner returns 'tie' when best distances are equal", () => {
  let state = javelinDuelGame.createInitialState();
  const sameThrow = { type: "throw" as const, angle: 42, power: 100, timingAccuracy: 1, foul: false };
  for (let i = 0; i < MAX_THROWS; i++) {
    state = javelinDuelGame.applyAction(state, 1, sameThrow);
    state = javelinDuelGame.applyAction(state, 2, sameThrow);
  }
  assert.equal(getWinner(state), "tie");
});

test("getWinner returns null while the match is still in progress", () => {
  const state = javelinDuelGame.createInitialState();
  assert.equal(getWinner(state), null);
});
