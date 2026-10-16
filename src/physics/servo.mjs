// JavaScript adaptation of Rhoban BAM M6 and XL330 voltage control.
// Copyright 2025 Marc Duclusaud & Grégoire Passault. Apache-2.0.
// Adaptation: local MuJoCo multi-robot loop; see THIRD_PARTY.md and reference/.
import { BAM } from "./bam-config.js";
export { BAM } from "./bam-config.js";
export const BATTERY_VOLTS = 7.35;
export const MAX_TORQUE = (BATTERY_VOLTS * BAM.kt) / BAM.R;
const ERROR_GAIN = 4096 / (2 * Math.PI) / (256 * 885);
const KP_FW = 200;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function servoTorque(target, q, velocity) {
  const duty = clamp((target - q) * KP_FW * ERROR_GAIN, -1, 1);
  return clamp(
    (BAM.kt * BATTERY_VOLTS * duty) / BAM.R -
      (BAM.kt * BAM.kt * velocity) / BAM.R,
    -MAX_TORQUE,
    MAX_TORQUE,
  );
}
export function frictionBudget(motor, external, velocity) {
  const stribeck = Math.exp(
    -Math.pow(Math.abs(velocity / BAM.dtheta_stribeck), BAM.alpha),
  );
  let friction =
    BAM.friction_base +
    Math.abs(
      external * BAM.load_friction_external - motor * BAM.load_friction_motor,
    );
  friction +=
    stribeck *
    (BAM.friction_stribeck +
      Math.abs(
        external * BAM.load_friction_external_stribeck -
          motor * BAM.load_friction_motor_stribeck,
      ));
  if (Math.sign(external) !== Math.sign(motor))
    friction +=
      stribeck *
      (Math.abs(external) < Math.abs(motor)
        ? BAM.load_friction_external_quad * external * external
        : Math.abs(external) > Math.abs(motor)
          ? BAM.load_friction_motor_quad * motor * motor
          : 0);
  return friction;
}
export function updateServos(world) {
  const { model, data, runtime, slots } = world;
  const frictionForJoint = new Float64Array(model.njnt);
  const type = runtime.mj.mjtConstraint.mjCNSTR_FRICTION_DOF.value;
  for (let i = 0; i < data.nefc; i++)
    if (data.efc_type[i] === type)
      frictionForJoint[data.efc_id[i]] += data.efc_force[i];
  for (const slot of slots.values())
    for (let j = 0; j < 14; j++) {
      const dof = slot.dof[j],
        q = data.qpos[slot.qpos[j]],
        velocity = data.qvel[dof];
      const motor = data.qfrc_actuator[dof];
      const external =
        -data.qfrc_bias[dof] +
        data.qfrc_constraint[dof] -
        frictionForJoint[slot.jointIds[j]];
      // A policy with trained bus latency can provide a delayed target;
      // the existing football policies keep their immediate target path.
      data.ctrl[slot.ctrl[j]] = servoTorque(
        (slot.motorTargets || slot.targets)[j], q, velocity,
      );
      model.dof_frictionloss[dof] = frictionBudget(motor, external, velocity);
      model.dof_damping[dof] = BAM.friction_viscous;
    }
}
