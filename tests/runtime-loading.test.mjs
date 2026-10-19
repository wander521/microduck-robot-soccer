import test from "node:test";
import assert from "node:assert/strict";
import { createPhysicsRuntime } from "../src/physics/runtime.js";

const contract = {
  observationSize: 61,
  actionSize: 14,
  policyHz: 50,
  physicsHz: 200,
  actuatorDelayPhysicsSteps: 4,
  jointVelocityDelayControlSteps: 1,
};
const dance = {
  schema: "microduck-game-dance-v1",
  runtime: contract,
  sha256: "dance-revision",
};
const football = {
  schema: "microduck-game-football-v1",
  runtime: contract,
  enabled: true,
  file: "football.onnx",
  sha256: "football-revision",
  windowSeconds: 1,
  currentLimitAmps: 1.75,
};
const xml =
  '<mujoco><worldbody><body><geom class="visual" mesh="display"/><geom mesh="contact"/></body></worldbody></mujoco>';
const readText = async (path) =>
  path.endsWith(".xml")
    ? xml
    : JSON.stringify(path.endsWith("football.json") ? football : dance);
const engine = {
  MjVFS: class {
    buffers = new Map();
    addBuffer(name, value) {
      this.buffers.set(name, value);
    }
  },
  mj_versionString: () => "test",
};

test("downloads overlap engine initialization while ONNX sessions still initialize one at a time", async () => {
  let resolveEngine, resolvePolicies;
  const engineReady = new Promise((resolve) => {
    resolveEngine = resolve;
  });
  const policiesReady = new Promise((resolve) => {
    resolvePolicies = resolve;
  });
  const downloads = [],
    sessions = [];
  let active = 0,
    peak = 0;
  const pending = createPhysicsRuntime({
    mj: engineReady,
    ort: {},
    readText,
    readBinary: async (path) => {
      downloads.push(path);
      return new Uint8Array([7]);
    },
    createPolicy: async (path, bytes) => {
      assert.equal(downloads.length, 8); // one unique collision mesh + seven policies
      assert.equal(bytes[0], 7);
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setImmediate(resolve));
      sessions.push(path);
      active--;
      if (sessions.length === 7) resolvePolicies();
      return { path };
    },
  });
  await policiesReady;
  assert.equal(peak, 1);
  assert.ok(
    sessions.some((path) =>
      path.endsWith("football.onnx?sha256=football-revision"),
    ),
  );
  assert.ok(
    sessions.some((path) =>
      path.endsWith("duckemw_dance.onnx?sha256=dance-revision"),
    ),
  );
  assert.ok(!downloads.some((path) => path.includes("display")));
  resolveEngine(engine);
  const runtime = await pending;
  assert.equal(Object.keys(runtime.policies).length, 7);
  assert.equal(runtime.vfs.buffers.size, 1);
  assert.equal(runtime.mj, engine);
});

test("a failed parallel policy download rejects startup instead of changing policy behavior", async () => {
  let sessions = 0;
  await assert.rejects(
    createPhysicsRuntime({
      mj: engine,
      ort: {},
      readText,
      readBinary: async (path) => {
        if (path.startsWith("policies/football.onnx"))
          throw new Error("HTTP 404 football");
        return new Uint8Array();
      },
      createPolicy: async () => {
        sessions++;
      },
    }),
    /HTTP 404 football/,
  );
  assert.equal(sessions, 0);
});
