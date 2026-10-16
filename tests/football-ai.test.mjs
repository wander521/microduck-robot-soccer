import test from "node:test";
import assert from "node:assert/strict";
import { createRoom, addPlayer, FIELD } from "../src/simulation.js";
import {
  ballInBodyFrame,
  kickingFoot,
  updateFootballAI,
} from "../src/football-ai.js";
import {
  footballCommand,
  advanceFootballTargets,
  setFootballActive,
} from "../src/physics/football-policy.js";

test("ball transforms and foot selection rotate with the robot and mirror the training left axis", () => {
  const p = { x: 0, z: 0, yaw: 0, team: "blue" },
    ball = { x: 0.12, z: -0.04, vx: 0.3, vz: 0.1 };
  assert.deepEqual(ballInBodyFrame(p, ball), { forward: 0.12, side: -0.04 });
  assert.equal(kickingFoot(p, ball), "left");
  assert.deepEqual(
    footballCommand(p, ball, FIELD).slice(0, 4),
    [0.12, 0.04, 0.3, -0.1],
  );
  p.yaw = Math.PI;
  assert.equal(kickingFoot(p, ball), "right");
  assert.ok(Math.abs(footballCommand(p, ball, FIELD)[0] + 0.12) < 1e-8);
});

test("one robot per team pursues the ball while the partner supports, with role hysteresis", () => {
  const room = createRoom();
  for (const [i, team] of ["blue", "blue", "orange", "orange"].entries())
    Object.assign(addPlayer(room, String(i), "AI", team), {
      auto: true,
      x: (i < 2 ? -1 : 1) * (0.3 + (i % 2) * 0.02),
      z: (i % 2) * 0.3,
      yaw: i < 2 ? 0 : Math.PI,
    });
  updateFootballAI(room, FIELD);
  for (const team of ["blue", "orange"])
    assert.equal(
      [...room.players.values()].filter(
        (p) => p.team === team && p.footballRole === "striker",
      ).length,
      1,
    );
  const a = room.players.get("0"),
    b = room.players.get("1");
  assert.equal(a.footballRole, "striker");
  b.x = -0.29;
  b.z = 0;
  updateFootballAI(room, FIELD);
  assert.equal(a.footballRole, "striker");
  b.x = -0.03;
  updateFootballAI(room, FIELD);
  assert.equal(b.footballRole, "striker");
});

test("active manual teammate keeps control and receives support, spectator is excluded", () => {
  const room = createRoom(),
    human = addPlayer(room, "human", "Player", "blue"),
    bot = addPlayer(room, "bot", "Bot", "blue");
  Object.assign(human, { x: -0.15, z: 0, forward: 1, turn: 0.3 });
  Object.assign(bot, { auto: true, x: -0.3, z: 0 });
  updateFootballAI(room, FIELD);
  assert.equal(human.forward, 1);
  assert.equal(human.turn, 0.3);
  assert.equal(bot.footballRole, "support");
  human.spectator = true;
  updateFootballAI(room, FIELD);
  assert.equal(bot.footballRole, "striker");
});

test("football target transport delays four physics steps and clears on exit", () => {
  const slot = { dof: [0], targets: new Float64Array([0]) },
    world = { data: { qvel: new Float64Array([2]) } };
  setFootballActive(world, slot, true);
  slot.targets[0] = 1;
  for (let i = 0; i < 4; i++) {
    advanceFootballTargets(new Map([["a", slot]]));
    assert.equal(slot.motorTargets[0], 0);
  }
  advanceFootballTargets(new Map([["a", slot]]));
  assert.equal(slot.motorTargets[0], 1);
  setFootballActive(world, slot, false);
  assert.equal(slot.motorTargets, undefined);
});

test("an explicit F request survives automatic decisions until physics consumes it", () => {
  const room = createRoom(),
    p = addPlayer(room, "a", "Player", "blue");
  Object.assign(p, {
    auto: true,
    x: -0.6,
    kickRequested: true,
    kickSource: "manual",
  });
  updateFootballAI(room, FIELD);
  assert.equal(p.kickRequested, true);
});

test("a manual shot keeps its chosen heading even after the ball moves", () => {
  const p = { x: 0, z: 0, yaw: Math.PI / 2, team: "blue" },
    ball = { x: 1, z: 0.3, vx: 0, vz: 0 };
  const command = footballCommand(p, ball, FIELD, { x: 0, z: -1 });
  assert.ok(Math.abs(command[4] - 1) < 1e-8);
  assert.ok(Math.abs(command[5]) < 1e-8);
});

test("the published football weights match their runtime manifest", async () => {
  const { readFile } = await import("node:fs/promises");
  const { createHash } = await import("node:crypto");
  const root = new URL("../public/assets/policies/", import.meta.url);
  const manifest = JSON.parse(
    await readFile(new URL("football.json", root), "utf8"),
  );
  const weights = await readFile(new URL(manifest.file, root));
  assert.equal(
    createHash("sha256").update(weights).digest("hex"),
    manifest.sha256,
  );
  assert.equal(manifest.training.status, "complete");
  assert.equal(manifest.training.completedIterations, 2000);
});
