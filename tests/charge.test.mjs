import test from "node:test";
import assert from "node:assert/strict";
import { createRoom, addPlayer } from "../src/simulation.js";
import { applyCommand } from "../src/commands.js";
import {
  updateCharges,
  chargeVelocity,
  CHARGE_COOLDOWN,
} from "../src/charge.js";

test("R is edge-triggered, cools down, and cannot bypass dance, recovery or roller mode", () => {
  const room = createRoom(),
    p = addPlayer(room, "a", "Player");
  applyCommand(room, p, { type: "charge" });
  updateCharges(room);
  assert.ok(p.charge > 0);
  assert.equal(p.chargeCooldown, CHARGE_COOLDOWN);
  for (let i = 0; i < 70; i++) {
    applyCommand(room, p, { type: "charge" });
    updateCharges(room);
  }
  assert.equal(p.charge, 0);
  assert.ok(p.chargeCooldown < CHARGE_COOLDOWN);
  for (let i = 0; i < 500; i++) updateCharges(room);
  for (const state of [
    { mode: "roller" },
    { mode: "walk", recovery: "stand" },
    { recovery: null, spectator: true },
  ]) {
    Object.assign(p, state);
    applyCommand(room, p, { type: "charge" });
    updateCharges(room);
    assert.equal(p.charge, 0);
  }
  p.spectator = false;
  applyCommand(room, p, { type: "dance" });
  applyCommand(room, p, { type: "charge" });
  updateCharges(room);
  assert.equal(p.charge, 0);
  applyCommand(room, p, { type: "reset" });
  assert.equal(p.chargeCooldown, 0);
  assert.equal(p.chargeRequested, false);
});

test("charge ramps the learned velocity command and does not alter a physical pose", () => {
  const room = createRoom(),
    p = addPlayer(room, "a", "Player"),
    before = { x: p.x, z: p.z, yaw: p.yaw };
  applyCommand(room, p, { type: "charge" });
  updateCharges(room);
  const initial = chargeVelocity(p)[0];
  for (let i = 0; i < 15; i++) updateCharges(room);
  assert.ok(chargeVelocity(p)[0] > initial);
  assert.ok(chargeVelocity(p)[0] <= 0.8);
  assert.deepEqual({ x: p.x, z: p.z, yaw: p.yaw }, before);
});

test("AI only charges a nearby opponent contesting the ball, and cancels on recovery", () => {
  const room = createRoom(),
    p = addPlayer(room, "a", "AI", "blue"),
    q = addPlayer(room, "b", "Opponent", "orange");
  Object.assign(p, { bot: true, auto: true, x: 0, z: 0, yaw: 0, height: 0.12 });
  Object.assign(q, { x: 0.3, z: 0, height: 0.12 });
  room.physics = { elapsed: 2.8 };
  updateCharges(room);
  assert.ok(p.charge > 0);
  assert.equal(p.chargeTarget, q.id);
  p.recovery = "stand";
  updateCharges(room);
  assert.equal(p.charge, 0);
});
