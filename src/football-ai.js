// Football decisions command the existing policies; they never move physical bodies.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrap = (v) => Math.atan2(Math.sin(v), Math.cos(v));
const turnCommand = (error, gain = 2.2, limit = 1) =>
  Math.abs(error) < 0.035
    ? 0
    : Math.sign(error) * clamp(Math.abs(error) * gain, 0.36, limit);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const rooms = new WeakMap();
const actors = new WeakMap();
export function ballInBodyFrame(player, ball) {
  const dx = ball.x - player.x,
    dz = ball.z - player.z;
  const c = Math.cos(player.yaw),
    s = Math.sin(player.yaw);
  return { forward: c * dx - s * dz, side: s * dx + c * dz };
}
export function kickingFoot(player, ball) {
  return ballInBodyFrame(player, ball).side <= 0 ? "left" : "right";
}
function stateFor(player) {
  let state = actors.get(player);
  if (
    !state ||
    state.reset !== player.resetRevision ||
    state.team !== player.team ||
    state.mode !== player.mode
  ) {
    state = {
      reset: player.resetRevision,
      team: player.team,
      mode: player.mode,
      stage: "approach",
      foot: "left",
      stable: 0,
      stuck: 0,
      last: { x: player.x, z: player.z },
      escape: 0,
      age: 0,
    };
    actors.set(player, state);
  }
  return state;
}
function steer(player, target, heading, nearPose = false) {
  const dx = target.x - player.x,
    dz = target.z - player.z,
    rho = Math.hypot(dx, dz);
  const alpha = wrap(Math.atan2(-dz, dx) - player.yaw);
  player.turn = turnCommand(alpha);
  // The deployed walking policy barely advances below ~0.24 m/s. Use its
  // measured working command and brake at the target, rather than asking for
  // an unreachable slow/backward gait during docking.
  player.forward = Math.abs(alpha) < 0.65 ? 0.95 : 0;
  if (rho < (nearPose ? 0.018 : 0.065)) {
    player.forward = 0;
    player.turn = turnCommand(wrap(heading - player.yaw), 2, 0.8);
  }
}
function avoid(player, target, players, ball, state, enabled = true) {
  if (!enabled) return target;
  const dx = target.x - player.x,
    dz = target.z - player.z,
    len = Math.hypot(dx, dz);
  if (len < 0.05) return target;
  const ux = dx / len,
    uz = dz / len;
  for (const other of players) {
    if (other === player || other.spectator) continue;
    const ox = other.x - player.x,
      oz = other.z - player.z,
      along = ox * ux + oz * uz,
      side = ox * -uz + oz * ux;
    if (along > -0.03 && along < Math.min(len, 0.42) && Math.abs(side) < 0.2) {
      const turnSide = side >= 0 ? -1 : 1;
      return {
        x: other.x + ux * 0.1 - uz * turnSide * 0.28,
        z: other.z + uz * 0.1 + ux * turnSide * 0.28,
      };
    }
  }
  return target;
}
function chooseChaser(room, team, players, ball, memory) {
  const side = players.filter((p) => p.team === team && !p.spectator);
  const activeManual = side.find(
    (p) =>
      !p.bot &&
      !p.auto &&
      distance(p, ball) < 0.45 &&
      (Math.abs(p.forward) > 0.1 || Math.abs(p.turn) > 0.1 || p.kick > 0),
  );
  if (activeManual) {
    memory[team] = { id: activeManual.id, age: 0 };
    return activeManual;
  }
  const candidates = side.filter((p) => p.bot || p.auto);
  if (!candidates.length) return null;
  const score = (p) =>
    distance(p, ball) +
    (p.recovery ? 0.9 : 0) +
    Math.abs(wrap(Math.atan2(-(ball.z - p.z), ball.x - p.x) - p.yaw)) * 0.06;
  candidates.sort(
    (a, b) => score(a) - score(b) || String(a.id).localeCompare(String(b.id)),
  );
  const old = memory[team],
    held = old && candidates.find((p) => p.id === old.id);
  if (held && score(held) < score(candidates[0]) + 0.22) {
    old.age += 0.02;
    return held;
  }
  const pick = candidates[0];
  memory[team] = { id: pick.id, age: 0 };
  return pick;
}
function shoot(player, room, field, players, state) {
  const ball = room.balls[0],
    dir = player.team === "blue" ? 1 : -1;
  const aim = { x: dir * (field.halfLength + 0.1), z: 0 };
  const heading = Math.atan2(-(aim.z - ball.z), aim.x - ball.x),
    c = Math.cos(heading),
    s = Math.sin(heading);
  const rel = ballInBodyFrame(player, ball);
  if (player.mode === "roller") {
    const target =
      rel.forward > 0
        ? { x: ball.x + c * 0.16, z: ball.z - s * 0.16 }
        : { x: ball.x - c * 0.25, z: ball.z + s * 0.25 };
    player.footballStage = state.stage = "dribble";
    steer(
      player,
      avoid(
        player,
        target,
        players,
        ball,
        state,
        distance(player, ball) > 0.22,
      ),
      heading,
    );
    return;
  }
  if (state.stage === "approach" && distance(player, ball) < 0.25)
    state.foot = rel.side <= 0 ? "left" : "right";
  const side = state.foot === "left" ? -0.042 : 0.042;
  const pose = {
    x: ball.x - c * (room.footballPolicy ? 0.13 : 0.09) - s * side,
    z: ball.z + s * (room.footballPolicy ? 0.13 : 0.09) - c * side,
  };
  const rho = distance(player, pose),
    aimError = wrap(heading - player.yaw);
  const ballAware = !!room.footballPolicy;
  const localReady = ballAware
    ? rel.forward > 0.09 &&
      rel.forward < 0.18 &&
      Math.abs(rel.side) < 0.085 &&
      Math.abs(aimError) < 0.18
    : rel.forward > 0.055 &&
      rel.forward < 0.107 &&
      Math.abs(rel.side - side) < 0.027 &&
      Math.abs(aimError) < 0.24;
  if (player.kick > 0 || player.recovery) {
    state.stable = 0;
    state.stage = "recover";
    player.forward = player.turn = 0;
    return;
  }
  if (state.stage === "recover") {
    state.stage = "approach";
    if (state.shotBall && distance(ball, state.shotBall) < 0.04) {
      state.escape = 1.5;
      state.escapeTarget = {
        x: ball.x - c * 0.28 + s * 0.15,
        z: ball.z + s * 0.28 + c * 0.15,
      };
    }
    state.shotBall = null;
  }
  if (localReady && (ballAware || rho < 0.045) && state.escape <= 0) {
    state.stage = "settle";
    player.forward = 0;
    player.turn = turnCommand(aimError, 1.8, 0.4);
    const ready = player.speed < 0.12 && Math.hypot(ball.vx, ball.vz) < 0.2;
    state.stable = ready
      ? state.stable + 0.02
      : Math.max(0, state.stable - 0.01);
    if (state.stable >= 0.12) {
      player.kickRequested = true;
      player.kickFoot = state.foot;
      state.stable = 0;
      state.shotBall = { x: ball.x, z: ball.z };
      state.stage = "shoot";
    }
    return;
  }
  state.stable = 0;
  const behind = (player.x - ball.x) * c - (player.z - ball.z) * s;
  let target = pose;
  if (behind > -0.03 && distance(player, ball) > 0.14) {
    // Circle the ball before approaching; don't bulldoze it toward our own goal.
    const flank =
      (player.z - ball.z) * c + (player.x - ball.x) * s >= 0 ? 1 : -1;
    target = {
      x: ball.x - c * 0.23 + s * flank * 0.24,
      z: ball.z + s * 0.23 + c * flank * 0.24,
    };
    state.stage = "circle";
  } else state.stage = rho < 0.2 ? "align" : "approach";
  if (state.escape > 0) {
    state.escape -= 0.02;
    target = state.escapeTarget;
    state.stage = "unstick";
  } else if (state.stuck > 1.2) {
    state.escape = 1.3;
    state.stuck = 0;
    const flank = rel.side > 0 ? -1 : 1;
    target = state.escapeTarget = {
      x: player.x - c * 0.2 + s * flank * 0.24,
      z: player.z + s * 0.2 + c * flank * 0.24,
    };
  }
  target.x = clamp(
    target.x,
    -field.halfLength - field.goalDepth - field.runoff + 0.08,
    field.halfLength + field.goalDepth + field.runoff - 0.08,
  );
  target.z = clamp(
    target.z,
    -field.halfWidth - field.runoff + 0.08,
    field.halfWidth + field.runoff - 0.08,
  );
  target = avoid(player, target, players, ball, state, rho > 0.16);
  target.x = clamp(
    target.x,
    -field.halfLength - field.goalDepth - field.runoff + 0.08,
    field.halfLength + field.goalDepth + field.runoff - 0.08,
  );
  target.z = clamp(
    target.z,
    -field.halfWidth - field.runoff + 0.08,
    field.halfWidth + field.runoff - 0.08,
  );
  steer(
    player,
    target,
    heading,
    rho < 0.24 && state.stage !== "circle" && state.escape <= 0,
  );
}
export function resetFootballAI(room) {
  rooms.delete(room);
  for (const p of room.players.values()) {
    actors.delete(p);
    delete p.footballRole;
    delete p.footballStage;
  }
}
export function updateFootballAI(room, field) {
  const ball = room.balls[0];
  if (!ball) return;
  const players = [...room.players.values()];
  let memory = rooms.get(room);
  if (!memory || memory.revision !== room.revision) {
    resetFootballAI(room);
    memory = { revision: room.revision };
    rooms.set(room, memory);
  }
  const chasers = {
    blue: chooseChaser(room, "blue", players, ball, memory),
    orange: chooseChaser(room, "orange", players, ball, memory),
  };
  for (const player of players) {
    if (player.spectator || (!player.bot && !player.auto)) continue;
    const state = stateFor(player);
    state.age += 0.02;
    if (state.age > 0.5) {
      state.stuck =
        distance(player, state.last) < 0.012 &&
        Math.abs(player.forward) > 0.22 &&
        player.kick <= 0
          ? state.stuck + 0.5
          : 0;
      state.last = { x: player.x, z: player.z };
      state.age = 0;
    }
    const manualKick = player.kickSource === "manual" && player.kickRequested;
    player.kickRequested = false;
    if (chasers[player.team] === player) {
      player.footballRole = "striker";
      shoot(player, room, field, players, state);
    } else {
      player.footballRole = "support";
      state.stable = 0;
      state.stage = "support";
      const dir = player.team === "blue" ? 1 : -1;
      state.supportFlank ??= player.z >= ball.z ? 1 : -1;
      if (Math.abs(ball.z) > 0.45) state.supportFlank = ball.z > 0 ? -1 : 1;
      const flank = state.supportFlank;
      const target = {
        x: clamp(
          ball.x - dir * 0.62,
          -field.halfLength + 0.3,
          field.halfLength - 0.3,
        ),
        z: clamp(
          ball.z * 0.45 + flank * 0.42,
          -field.halfWidth + 0.14,
          field.halfWidth - 0.14,
        ),
      };
      const facing = Math.atan2(-(ball.z - player.z), ball.x - player.x);
      if (distance(player, target) < 0.1) {
        player.forward = 0;
        player.turn = turnCommand(wrap(facing - player.yaw), 1.7, 0.7);
      } else steer(player, avoid(player, target, players, ball, state), facing);
    }
    if (manualKick) {
      player.kickRequested = true;
      player.kickFoot = kickingFoot(player, ball);
    }
    player.footballStage = state.stage;
  }
}
