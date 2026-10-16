// A charge is a short velocity command to the learned gait, followed by recovery.
export const CHARGE_SECONDS = 1.1;
export const CHARGE_COOLDOWN = 9;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrap = (v) => Math.atan2(Math.sin(v), Math.cos(v));
export function resetCharge(p) {
  p.charge = 0;
  p.chargeCooldown = 0;
  p.chargeRequested = false;
  p.chargeTarget = null;
  p.chargeHit = false;
}
export function canCharge(room, p) {
  return (
    !room.dancing &&
    !p.spectator &&
    p.mode === "walk" &&
    !p.recovery &&
    !(p.kick > 0) &&
    !(p.charge > 0) &&
    !(p.chargeCooldown > 0) &&
    (p.height == null || p.height > 0.085)
  );
}
export function updateCharges(room, dt = 0.02) {
  const players = [...room.players.values()];
  for (const p of players) {
    p.chargeCooldown = Math.max(0, (p.chargeCooldown || 0) - dt);
    p.charge = Math.max(0, (p.charge || 0) - dt);
    if (
      room.dancing ||
      p.spectator ||
      p.mode !== "walk" ||
      p.recovery ||
      p.kick > 0
    ) {
      p.charge = 0;
      p.chargeRequested = false;
      continue;
    }
    const requested = p.chargeRequested;
    p.chargeRequested = false;
    let target = null;
    if (!requested && (p.bot || p.auto) && canCharge(room, p)) {
      // Only challenge an upright opponent contesting the ball. Stagger the
      // decision windows per actor, so four robots never all charge on kickoff.
      const phase = (room.physics?.elapsed || 0) % 8;
      const window =
        2 +
        (String(p.id)
          .split("")
          .reduce((n, c) => n + c.charCodeAt(0), 0) %
          4) *
          0.8;
      if (phase >= window && phase < window + 0.08)
        target = players.find(
          (q) =>
            q.team !== p.team &&
            !q.spectator &&
            !q.recovery &&
            q.height > 0.085 &&
            Math.hypot(q.x - room.balls[0].x, q.z - room.balls[0].z) < 0.5 &&
            Math.hypot(q.x - p.x, q.z - p.z) > 0.22 &&
            Math.hypot(q.x - p.x, q.z - p.z) < 0.45 &&
            Math.abs(wrap(Math.atan2(-(q.z - p.z), q.x - p.x) - p.yaw)) < 0.22,
        );
    }
    if ((requested || target) && canCharge(room, p)) {
      p.charge = CHARGE_SECONDS;
      p.chargeCooldown = CHARGE_COOLDOWN;
      p.chargeHeading = p.yaw;
      p.chargeTarget = target?.id || null;
      p.chargeHit = false;
      p.kickRequested = false;
    }
    if (p.charge > 0) {
      const q = room.players.get(p.chargeTarget);
      const heading =
        q && !p.chargeHit
          ? Math.atan2(-(q.z - p.z), q.x - p.x)
          : p.chargeHeading;
      p.chargeTurn = clamp(wrap(heading - p.yaw) * 2, -0.3, 0.3);
    }
  }
}
export function chargeVelocity(p) {
  if (!(p.charge > 0)) return null;
  const elapsed = CHARGE_SECONDS - p.charge;
  const strength = Math.min(1, elapsed / 0.14, p.charge / 0.18);
  return [0.3 + 0.5 * Math.max(0, strength), 0, (p.chargeTurn || 0) * 1.5];
}
