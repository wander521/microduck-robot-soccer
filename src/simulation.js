// Server-authoritative football simulation. Units: metres, seconds, radians.
export const FIELD = {
  halfLength: 1.575,
  halfWidth: 0.93,
  goalHalfWidth: 0.45,
  goalDepth: 0.24,
  goalHeight: 0.32,
  runoff: 0.34,
  ballRadius: 0.05,
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const BALL_COUNT = 1;
export function createRoom() {
  return {
    players: new Map(),
    balls: [{ id: 0, x: 0, z: 0, y: 0.05, vx: 0, vz: 0, cooldown: 0 }],
    scores: { blue: 0, orange: 0 },
    ai: true,
    dancing: false,
    dance: null,
    goal: null,
    revision: 0,
  };
}
export function addPlayer(room, id, name, team) {
  const p = {
    id,
    name,
    team:
      team ||
      ([...room.players.values()].filter((p) => !p.bot && p.team === "blue")
        .length >
      [...room.players.values()].filter((p) => !p.bot && p.team === "orange")
        .length
        ? "orange"
        : "blue"),
    x: 0,
    z: 0,
    yaw: 0,
    mode: "walk",
    speed: 0,
    forward: 0,
    turn: 0,
    spectator: false,
    auto: false,
    quack: 0,
    kick: 0,
    resetRevision: 0,
    kickRequested: false,
  };
  if (room.players.size === 0) p.x = -0.2;
  if (room.players.size) {
    p.x = p.team === "blue" ? -0.55 : 0.55;
    p.z = room.players.size % 2 ? 0.25 : -0.25;
    p.yaw = p.team === "blue" ? 0 : Math.PI;
  }
  room.players.set(id, p);
  return p;
}
export function resetPlayer(p) {
  p.x = p.team === "blue" ? -0.2 : 0.2;
  p.z = 0;
  p.yaw = p.team === "blue" ? 0 : Math.PI;
  p.spectator = false;
  p.speed = 0;
  p.forward = 0;
  p.turn = 0;
  p.kickRequested = false;
  p.resetRevision = (p.resetRevision || 0) + 1;
  p.resetPose = { x: p.x, z: p.z, yaw: p.yaw };
}
export function resetPlay(room, player) {
  room.dancing = false;
  resetPlayer(player);
  room.ballResetPending = true;
}
export function syncBots(room) {
  const humans = [...room.players.values()].filter((p) => !p.bot);
  const count = room.ai ? Math.max(0, 4 - humans.length) : 0;
  for (const [id, p] of room.players) if (p.bot) room.players.delete(id);
  for (let i = 0; i < count; i++) {
    const blue = [...room.players.values()].filter(
      (p) => !p.spectator && p.team === "blue",
    ).length;
    const orange = [...room.players.values()].filter(
      (p) => !p.spectator && p.team === "orange",
    ).length;
    const p = addPlayer(
      room,
      `bot-${i}`,
      ["豆豆 · AI", "小橘 · AI", "皮皮 · AI"][i] || "Duck · AI",
      blue <= orange ? "blue" : "orange",
    );
    p.bot = true;
    p.auto = true;
    p.x = p.team === "blue" ? -0.65 : 0.65;
    p.z =
      [...room.players.values()].filter(
        (other) => other.bot && other.team === p.team,
      ).length > 1
        ? 0.28
        : -0.28;
    p.yaw = p.team === "blue" ? 0 : Math.PI;
  }
}
function driveAI(p, room) {
  if (p.spectator) return;
  let closest = null,
    d = Infinity;
  for (const b of room.balls) {
    const n = Math.hypot(b.x - p.x, b.z - p.z);
    if (n < d) {
      closest = b;
      d = n;
    }
  }
  if (!closest) return;
  const dir = p.team === "blue" ? 1 : -1;
  let tx = closest.x - dir * 0.13,
    tz = closest.z; // get behind the ball before shooting
  if (d < 0.22 && dir * (closest.x - p.x) > 0) {
    tx = closest.x + dir * 0.16;
    tz = closest.z * 0.3;
  }
  const delta = angleDifference(Math.atan2(-(tz - p.z), tx - p.x), p.yaw);
  p.turn = clamp(delta * 2, -1, 1);
  p.forward =
    Math.abs(delta) < 1.2
      ? clamp(Math.hypot(tx - p.x, tz - p.z) * 4, 0.1, 1)
      : 0.06;
  if (d < 0.22 && Math.abs(delta) < 0.5 && p.kick <= 0) p.kickRequested = true;
}
export async function tick(room) {
  if (!room.physics) throw new Error("MuJoCo physics has not been initialized");
  if (!room.dancing)
    for (const p of room.players.values())
      if (p.bot || p.auto) driveAI(p, room);
  await room.physics.step();
}
export function snapshot(room) {
  return {
    type: "state",
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      x: p.x,
      z: p.z,
      yaw: p.yaw,
      speed: p.speed,
      height: p.height,
      quat: p.quat,
      joints: p.joints,
      extraJoints: p.extraJoints,
      recovery: p.recovery,
      mode: p.mode,
      spectator: p.spectator,
      auto: p.auto,
      bot: !!p.bot,
      quack: p.quack,
      kick: p.kick,
    })),
    balls: room.balls.map((b) => ({
      id: b.id,
      x: b.x,
      z: b.z,
      y: b.y,
      vx: b.vx,
      vz: b.vz,
      quat: b.quat,
    })),
    scores: room.scores,
    goal: room.goal,
    ai: room.ai,
    dance: room.dance,
    engine: room.engine,
  };
}
