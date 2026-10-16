import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { danceCommand } from "../src/physics/dance-command.js";

test("dance commands preserve two-beat observability and binary moves", () => {
  for (let move = 0; move < 5; move++) {
    const a = danceCommand(0, 120, move);
    const b = danceCommand(.5, 120, move);
    const c = danceCommand(1, 120, move);
    assert.deepEqual(a.body.slice(3), [move & 1, (move >> 1) & 1, (move >> 2) & 1]);
    assert.equal(a.body[2], 1);
    assert.ok(Math.abs(a.body[1] + b.body[1]) < 1e-8);
    assert.ok(Math.abs(a.body[1] - c.body[1]) < 1e-8);
  }
  assert.throws(() => danceCommand(0, 128, 5), RangeError);
});
test("the stage sequence includes every trained move and loops at 40 beats", () => {
  assert.equal(danceCommand(0).move, 3);
  const moves = new Set(Array.from({ length: 40 }, (_, beat) => danceCommand(beat * 60 / 128 + .0001).move));
  assert.equal(moves.size, 5);
  assert.equal(danceCommand(0).move, danceCommand(40 * 60 / 128).move);
});
test("deployed dance weights match their training provenance manifest", async () => {
  const base = new URL("../public/assets/policies/", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("duckemw_dance.json", base), "utf8"));
  const weights = await readFile(new URL(manifest.file, base));
  assert.equal(createHash("sha256").update(weights).digest("hex"), manifest.sha256);
  assert.equal(manifest.runtime.observationSize, 61);
  assert.equal(manifest.runtime.actionSize, 14);
  assert.equal(manifest.runtime.policyHz, 50);
  assert.equal(manifest.runtime.physicsHz, 200);
  assert.ok(manifest.training.checkpointIteration <= manifest.training.targetIterations);
  assert.equal(manifest.verification.falls, 0);
});
