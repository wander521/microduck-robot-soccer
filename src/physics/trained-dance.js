import { clearChargeImpacts } from "./charge-impact.js";
import { DEFAULT_POSE, CONTROL_DT, OBS_SIZE, projectedGravity } from "./constants.js";
import { danceCommand } from "./dance-command.js";
import { DanceFormation } from "./dance-formation.js";
import { updateServos } from "./servo.mjs";

// Keep the observation and nominal bus latency of the trained deployment.
export const DANCE_ACTUATOR_LAG = 4;
const SETTLE_SECONDS = 0.6;

function rebuildAtCurrentTime(world) {
  const time = world.data.time;
  world.rebuild();
  world.data.time = time;
}

function restorePose(world, player, state, heightOffset = 0) {
  const slot = world.slots.get(player.id);
  world.data.qpos.set(state.position, slot.baseQ);
  world.data.qpos[slot.baseQ + 2] += heightOffset;
  world.data.qvel.set(state.velocity, slot.baseV);
  slot.qpos.forEach((address, j) => { world.data.qpos[address] = state.joints[j]; });
  slot.dof.forEach((address, j) => { world.data.qvel[address] = state.jointV[j]; });
}

export function beginPolicyDance(world) {
  clearChargeImpacts(world);
  if (!world.runtime.policies.dance || !world.runtime.templates.dance)
    throw new Error("Trained dance assets are not loaded");
  const states = world.saveStates();
  world.danceSaved = {
    states,
    actors: new Map([...world.room.players.values()].map(p => [p.id, {
      mode: p.mode, spectator: p.spectator,
    }])),
    ball: world.readBall(),
    goal: world.room.goal,
  };
  const rollers = [...world.room.players.values()].filter(p => p.mode === "roller");
  for (const p of world.room.players.values()) {
    p.mode = "walk";
    p.spectator = false;
    p.forward = 0;
    p.turn = 0;
    p.kickRequested = false;
  }
  if (rollers.length) {
    rebuildAtCurrentTime(world);
    rollers.forEach(p => restorePose(world, p, states.get(p.id), -0.0135));
    world.runtime.mj.mj_forward(world.model, world.data);
    world.syncState();
  }
  for (const slot of world.slots.values()) {
    slot.kickTime = 0;
    slot.kickLock = 0;
  }
  world.formation = new DanceFormation([...world.room.players.values()]);
  world.dancePolicyStarted = false;
  world.danceSettleTime = 0;
  world.danceTime = 0;
  world.danceFalls = 0;
}

function startPolicyModel(world) {
  for (const p of world.room.players.values()) p.danceActor = true;
  // Rebuild preserves the reached pose; it only selects the trained collision model.
  rebuildAtCurrentTime(world);
  const { mj } = world.runtime;
  const ballGeom = mj.mj_name2id(world.model, mj.mjtObj.mjOBJ_GEOM.value, "ball_geom");
  world.model.geom_contype[ballGeom] = 0;
  world.model.geom_conaffinity[ballGeom] = 0;
  for (const slot of world.slots.values()) {
    slot.danceVelocity = new Float32Array(slot.dof.map(a => world.data.qvel[a]));
    slot.danceFallen = false;
    slot.danceTargetHistory = Array.from({length: DANCE_ACTUATOR_LAG + 1},
      () => new Float64Array(slot.targets));
    slot.danceTargetIndex = 0;
  }
  world.dancePolicyStarted = true;
}

function holdBall(world) {
  world.setBall({...world.danceSaved.ball, vx: 0, vz: 0, vy: 0, angular: [0, 0, 0]});
}

function advancePhysics(world, delayed = false) {
  for (let i = 0; i < 4; i++) {
    holdBall(world);
    if (delayed) for (const slot of world.slots.values()) {
      slot.danceTargetHistory[slot.danceTargetIndex].set(slot.targets);
      slot.danceTargetIndex = (slot.danceTargetIndex + 1) % slot.danceTargetHistory.length;
      slot.motorTargets = slot.danceTargetHistory[slot.danceTargetIndex];
    }
    updateServos(world);
    world.runtime.mj.mj_step(world.model, world.data);
  }
  holdBall(world);
  world.frame++;
  world.elapsed += CONTROL_DT;
}

async function inferDance(world, player, slot, command) {
  const { data, runtime } = world;
  const q = data.qpos, v = data.qvel;
  const obs = new Float32Array(OBS_SIZE);
  for (let j = 0; j < 3; j++) obs[j] = data.sensordata[slot.gyro + j];
  const gravity = projectedGravity(Array.from(q.slice(slot.baseQ + 3, slot.baseQ + 7)));
  obs.set(gravity, 3);
  for (let j = 0; j < 14; j++) {
    obs[6 + j] = q[slot.qpos[j]] - DEFAULT_POSE[j];
    obs[20 + j] = slot.danceVelocity[j];
    slot.danceVelocity[j] = v[slot.dof[j]];
  }
  obs.set(slot.lastAction, 34);
  obs.set(command.body, 55);
  const fallen = gravity[2] > -0.6 || q[slot.baseQ + 2] < 0.025;
  if (fallen && !slot.danceFallen) world.danceFalls++;
  slot.danceFallen = fallen;
  const session = runtime.policies.dance;
  const out = await session.run({
    [session.inputNames[0]]: new runtime.ort.Tensor("float32", obs, [1, OBS_SIZE]),
  });
  const action = out[session.outputNames[0]].data;
  if (action.length !== 14 || !action.every(Number.isFinite))
    throw new Error("Invalid trained dance output");
  slot.lastAction.set(action);
  slot.targets.set(action.map((value, j) => DEFAULT_POSE[j] + value));
  player.recovery = null;
  player.kick = 0;
}

export async function stepPolicyDance(world) {
  const start = performance.now();
  if (!world.danceSaved) beginPolicyDance(world);
  const actors = [...world.room.players.values()];
  let phase = "forming";
  if (!world.dancePolicyStarted) {
    const ready = world.formation.update(actors, CONTROL_DT);
    if (ready) startPolicyModel(world);
    else {
      phase = world.formation.phase;
      await Promise.all(actors.map(p => world.control(p, world.slots.get(p.id))));
    }
  }
  if (world.dancePolicyStarted) {
    actors.forEach(p => { p.forward = 0; p.turn = 0; });
    if (world.danceSettleTime < SETTLE_SECONDS) {
      phase = "settling";
      world.danceSettleTime += CONTROL_DT;
      await Promise.all(actors.map(p => world.control(p, world.slots.get(p.id))));
      for (const slot of world.slots.values())
        slot.dof.forEach((address, j) => { slot.danceVelocity[j] = world.data.qvel[address]; });
    } else {
      phase = "dancing";
      const command = danceCommand(world.danceTime);
      await Promise.all(actors.map(p => inferDance(world, p, world.slots.get(p.id), command)));
      world.danceTime += CONTROL_DT;
    }
  }
  // X/Space can arrive while native or WASM inference is awaiting its result.
  if (!world.room.dancing) {
    endPolicyDance(world);
    await world.step();
    return;
  }
  advancePhysics(world, world.dancePolicyStarted);
  const command = danceCommand(world.danceTime);
  world.room.dance = {
    phase, stage: phase === "dancing" ? "dance" : phase === "forming" ? "formation" : "settle",
    ready: world.formation.ready, total: actors.length,
    time: world.danceTime, bpm: command.bpm, beat: command.beat,
    move: phase === "dancing" ? command.moveName : "全体集合！",
    engine: "onnx", policy: world.runtime.danceInfo.id, falls: world.danceFalls,
  };
  world.syncState();
  world.lastStepMs = performance.now() - start;
}

export function endPolicyDance(world) {
  const saved = world.danceSaved;
  if (!saved) return;
  // Resume the match where each robot physically is now, including mid-formation.
  const reached = world.saveStates();
  for (const p of world.room.players.values()) {
    const previous = saved.actors.get(p.id);
    if (previous) {
      p.mode = previous.mode;
      if (p.resetRevision === saved.states.get(p.id)?.resetRevision)
        p.spectator = previous.spectator;
    }
    delete p.danceActor;
    p.forward = 0;
    p.turn = 0;
    p.kickRequested = false;
  }
  rebuildAtCurrentTime(world);
  for (const p of world.room.players.values()) {
    const state = reached.get(p.id), slot = world.slots.get(p.id);
    restorePose(world, p, state, p.mode === "roller" ? 0.0135 : 0);
    slot.resetRevision = state.resetRevision; // Preserve an in-flight Space reset.
    slot.qpos.forEach((address, j) => {
      slot.targets[j] = world.data.qpos[address];
      slot.lastAction[j] = slot.targets[j] - DEFAULT_POSE[j];
    });
  }
  world.room.balls[0] = saved.ball;
  world.setBall(saved.ball);
  world.room.goal = saved.goal;
  world.danceSaved = null;
  world.formation = null;
  world.dancePolicyStarted = false;
  world.room.dance = null;
  world.runtime.mj.mj_forward(world.model, world.data);
}
