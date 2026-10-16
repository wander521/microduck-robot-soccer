const angle = (value) => Math.atan2(Math.sin(value), Math.cos(value));
export const FORMATION_SPACING = 0.48;
export const FORMATION_Z = -0.12;
export const FORMATION_YAW = -Math.PI / 2;

// Assign the line in current left-to-right order so robots do not swap places.
export class DanceFormation {
  constructor(actors) {
    const sorted = [...actors].sort((a, b) => a.x - b.x || a.z - b.z || a.id.localeCompare(b.id));
    this.slots = new Map(sorted.map((p, i) => [p.id, {
      x: (i - (sorted.length - 1) / 2) * FORMATION_SPACING,
      z: FORMATION_Z, arrived: false,
    }]));
    this.time = 0;
    this.stableFor = 0;
    this.phase = "forming";
    this.ready = 0;
  }
  update(actors, dt) {
    this.time += dt;
    this.ready = 0;
    for (const p of actors) {
      const target = this.slots.get(p.id);
      let dx = target.x - p.x, dz = target.z - p.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.055) target.arrived = true;
      if (distance > 0.095) target.arrived = false;
      let heading = FORMATION_YAW, forward = 0;
      if (!target.arrived) {
        // Yield around nearby actors rather than trying to walk through them.
        for (const other of actors) {
          if (other === p) continue;
          const ax = p.x - other.x, az = p.z - other.z, d = Math.hypot(ax, az);
          if (d > 0.001 && d < 0.29) {
            const avoid = (0.29 - d) * 1.4;
            dx += ax / d * avoid;
            dz += az / d * avoid;
          }
        }
        heading = Math.atan2(-dz, dx);
        const error = angle(heading - p.yaw);
        // This learned gait has a dead band at small commands: take a real step,
        // then brake inside the arrival radius rather than tapering to a stall.
        forward = Math.abs(error) <= 0.24 ? 1 : 0;
      }
      const error = angle(heading - p.yaw);
      p.forward = forward;
      p.turn = Math.abs(error) > 0.24 ? Math.sign(error) : 0;
      p.kickRequested = false;
      if (target.arrived && Math.abs(angle(FORMATION_YAW - p.yaw)) < 0.28
          && p.speed < 0.08 && p.height > 0.08 && !p.recovery) this.ready++;
    }
    const settled = this.ready === actors.length;
    this.stableFor = settled ? this.stableFor + dt : 0;
    this.phase = settled ? "settling" : "forming";
    return this.stableFor >= 0.45;
  }
}
