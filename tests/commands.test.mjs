import test from "node:test";
import assert from "node:assert/strict";
import { createRoom, addPlayer } from "../src/simulation.js";
import { applyCommand } from "../src/commands.js";
test("browser commands clamp input, preserve dance lock and let Space exit", () => {
  const room = createRoom(),
    p = addPlayer(room, "you", "Player");
  applyCommand(room, p, { type: "input", forward: 100, turn: -9 });
  assert.equal(p.forward, 1);
  assert.equal(p.turn, -1);
  applyCommand(room, p, { type: "dance" });
  assert.equal(room.dancing, true);
  applyCommand(room, p, { type: "input", forward: 1, turn: 1 });
  assert.equal(p.forward, 0);
  assert.equal(p.turn, 0);
  applyCommand(room, p, { type: "mode", mode: "roller" });
  assert.equal(p.mode, "walk");
  applyCommand(room, p, { type: "reset" });
  assert.equal(room.dancing, false);
  assert.equal(room.ballResetPending, true);
  assert.equal(p.resetRevision, 1);
});
test("browser controls change teams, mode, AI, name and autoplay locally", () => {
  const room = createRoom(),
    p = addPlayer(room, "you", "Player");
  applyCommand(room, p, { type: "ai", value: true });
  assert.equal(room.players.size, 4);
  applyCommand(room, p, { type: "ai", value: false });
  assert.equal(room.players.size, 1);
  applyCommand(room, p, { type: "team" });
  assert.equal(p.team, "orange");
  applyCommand(room, p, { type: "mode", mode: "roller" });
  assert.equal(p.mode, "roller");
  applyCommand(room, p, { type: "mode", mode: "invalid" });
  assert.equal(p.mode, "roller");
  applyCommand(room, p, { type: "rename", name: " 小鸭球员 " });
  assert.equal(p.name, "小鸭球员");
  applyCommand(room, p, { type: "auto", value: true });
  assert.equal(p.auto, true);
  applyCommand(room, p, { type: "kick" });
  assert.equal(p.kickRequested, true);
});
