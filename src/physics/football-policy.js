// microduck-game-football-v1, 61D actor: 48 proprio + zero twist/head + ball6.
export const FOOTBALL_ACTUATOR_LAG = 4;
const bound = (value) => Math.max(-3, Math.min(3, value));
export function footballCommand(player, ball, field, direction = null) {
  const c = Math.cos(player.yaw),
    s = Math.sin(player.yaw);
  const dx = ball.x - player.x,
    dz = ball.z - player.z;
  const targetX =
    direction?.x ??
    (player.team === "blue" ? 1 : -1) * (field.halfLength + 0.1) - ball.x;
  const targetZ = direction?.z ?? -ball.z,
    length = Math.hypot(targetX, targetZ) || 1;
  // Game +Z is MuJoCo -Y. The training actor's left axis is MuJoCo +Y.
  return [
    c * dx - s * dz,
    -s * dx - c * dz,
    c * (ball.vx || 0) - s * (ball.vz || 0),
    -s * (ball.vx || 0) - c * (ball.vz || 0),
    (c * targetX - s * targetZ) / length,
    (-s * targetX - c * targetZ) / length,
  ].map(bound);
}
export function setFootballActive(world, slot, active) {
  if (active && !slot.footballActive) {
    slot.footballVelocity = Float64Array.from(
      slot.dof.map((a) => world.data.qvel[a]),
    );
    slot.footballHistory = Array.from(
      { length: FOOTBALL_ACTUATOR_LAG + 1 },
      () => new Float64Array(slot.targets),
    );
    slot.footballIndex = 0;
  }
  if (!active && slot.footballActive) {
    delete slot.motorTargets;
    delete slot.footballHistory;
    delete slot.footballVelocity;
  }
  slot.footballActive = active;
}
export function advanceFootballTargets(slots) {
  for (const slot of slots.values())
    if (slot.footballActive) {
      slot.footballHistory[slot.footballIndex].set(slot.targets);
      slot.footballIndex =
        (slot.footballIndex + 1) % slot.footballHistory.length;
      slot.motorTargets = slot.footballHistory[slot.footballIndex];
    }
}
