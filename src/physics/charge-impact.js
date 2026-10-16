// Charge impact is a bounded game ability, applied only after MuJoCo reports
// robot/robot contact. It adds equal, opposite impulses over 60 ms; the solver
// and learned balance/get-up controllers determine the resulting motion.
import { PHYSICS_DT } from "./constants.js";
export function clearChargeImpacts(world) {
  world.chargeImpacts = [];
  world.data?.qfrc_applied.fill(0);
}
export function applyChargeImpacts(world) {
  const { data, model, runtime, room } = world;
  data.qfrc_applied.fill(0);
  world.chargeImpacts ||= [];
  const charging = [...room.players.values()].some(
    (p) => p.charge > 0 && !p.chargeHit,
  );
  if (charging) {
    const contacts = data.contact;
    try {
      for (let i = 0; i < data.ncon; i++) {
        const contact = contacts.get(i);
        try {
          if (contact.dist > 0.001) continue;
          const a = world.geomPlayers.get(contact.geom1),
            b = world.geomPlayers.get(contact.geom2);
          if (!a || !b || a === b) continue;
          for (const [id, otherId] of [
            [a, b],
            [b, a],
          ]) {
            const p = room.players.get(id),
              other = room.players.get(otherId);
            if (
              !p ||
              !other ||
              p.team === other.team ||
              p.charge <= 0 ||
              p.chargeHit ||
              p.recovery ||
              other.spectator
            )
              continue;
            const slot = world.slots.get(id),
              target = world.slots.get(otherId);
            const dx = other.x - p.x,
              dz = other.z - p.z,
              range = Math.hypot(dx, dz);
            if (range < 1e-6) continue;
            const ux = dx / range,
              uy = -dz / range;
            if (ux * Math.cos(p.yaw) + uy * Math.sin(p.yaw) < 0.5) continue;
            const closing =
              (data.qvel[slot.baseV] - data.qvel[target.baseV]) * ux +
              (data.qvel[slot.baseV + 1] - data.qvel[target.baseV + 1]) * uy;
            if (closing < 0.12) continue;
            const impulse = Math.min(0.5, 0.32 + closing * 0.35);
            world.chargeImpacts.push({
              time: 0.06,
              force: [(ux * impulse) / 0.06, (uy * impulse) / 0.06, 0],
              point: Array.from(contact.pos),
              attacker: slot.bodyId,
              target: target.bodyId,
            });
            p.chargeHit = true;
            p.charge = Math.min(p.charge, 0.18);
          }
        } finally {
          contact?.delete();
        }
      }
    } finally {
      contacts.delete();
    }
  }
  world.chargeImpacts = world.chargeImpacts.filter((impact) => {
    const { force, point, attacker, target } = impact;
    runtime.mj.mj_applyFT(
      model,
      data,
      force,
      [0, 0, 0],
      point,
      target,
      data.qfrc_applied,
    );
    runtime.mj.mj_applyFT(
      model,
      data,
      force.map((v) => -v),
      [0, 0, 0],
      point,
      attacker,
      data.qfrc_applied,
    );
    impact.time -= PHYSICS_DT;
    return impact.time > 1e-9;
  });
}
