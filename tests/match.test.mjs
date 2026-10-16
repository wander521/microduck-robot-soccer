import test from "node:test";
import assert from "node:assert/strict";
import { createRoom, addPlayer, resetPlay, tick } from "../src/simulation.js";
import {
  advanceMatch,
  beginKickoff,
  formatMatchTime,
  MATCH_SECONDS,
} from "../src/match.js";
import { applyCommand } from "../src/commands.js";

test("five-minute clock settles blue wins, orange wins and ties once, then ignores play inputs", () => {
  for (const [blue, orange, winner] of [
    [3, 2, "blue"],
    [1, 4, "orange"],
    [2, 2, "draw"],
  ]) {
    const room = createRoom(),
      p = addPlayer(room, "a", "Player");
    room.scores = { blue, orange };
    p.forward = 1;
    p.charge = 0.5;
    advanceMatch(room, 299);
    assert.equal(formatMatchTime(room.match.remaining), "00:01");
    advanceMatch(room, 1);
    assert.equal(room.match.phase, "finished");
    assert.equal(room.match.remaining, 0);
    assert.equal(room.match.winner, winner);
    assert.deepEqual(room.match.finalScore, { blue, orange });
    assert.equal(p.forward, 0);
    assert.equal(p.charge, 0);
    applyCommand(room, p, { type: "input", forward: 1 });
    applyCommand(room, p, { type: "kick" });
    assert.equal(p.forward, 0);
    assert.equal(p.kickRequested, false);
    advanceMatch(room, 200);
    assert.equal(room.match.winner, winner);
    assert.equal(formatMatchTime(room.match.remaining), "00:00");
  }
  assert.equal(MATCH_SECONDS, 300);
});

test("3-2-1 kickoff freezes active match time and blocks early movement", async () => {
  const room = createRoom(),
    p = addPlayer(room, "a", "Player");
  let steps = 0;
  room.physics = {
    step: async () => {
      steps++;
    },
  };
  beginKickoff(room);
  assert.equal(room.match.kickoffRemaining, 3);
  for (const number of [2, 1]) {
    applyCommand(room, p, { type: "input", forward: 1 });
    applyCommand(room, p, { type: "charge" });
    await tick(room, 1);
    assert.equal(Math.ceil(room.match.kickoffRemaining), number);
    assert.equal(room.match.remaining, 300);
    assert.equal(p.forward, 0);
    assert.equal(p.charge, 0);
  }
  await tick(room, 1);
  assert.equal(room.match.phase, "playing");
  assert.equal(room.match.remaining, 300);
  await tick(room, 0.5);
  assert.equal(room.match.remaining, 299.5);
  assert.equal(steps, 4);
});

test("dance pauses the clock, Space preserves score/time, and a new round clears them", () => {
  const room = createRoom(),
    p = addPlayer(room, "a", "Player");
  room.scores = { blue: 2, orange: 1 };
  advanceMatch(room, 30);
  room.dancing = true;
  advanceMatch(room, 60);
  assert.equal(room.match.remaining, 270);
  resetPlay(room, p);
  assert.equal(room.match.remaining, 270);
  assert.deepEqual(room.scores, { blue: 2, orange: 1 });
  advanceMatch(room, 270);
  assert.equal(room.match.phase, "finished");
  applyCommand(room, p, { type: "reset" });
  assert.equal(room.match.phase, "kickoff");
  assert.equal(room.match.remaining, 300);
  assert.equal(room.match.round, 2);
  assert.deepEqual(room.scores, { blue: 0, orange: 0 });
  assert.equal(room.match.finalScore, null);
  assert.equal(room.goal, null);
  applyCommand(room, p, { type: "restart" });
  assert.equal(room.match.round, 2);
});
