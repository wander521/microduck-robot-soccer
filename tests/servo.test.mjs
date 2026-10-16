import test from "node:test";
import assert from "node:assert/strict";
import { updateServos, servoTorque, BAM } from "../src/physics/servo.mjs";

test("free-base and second-robot friction constraints use DOF addresses", () => {
  const model = {
    nv: 46,
    njnt: 31,
    dof_frictionloss: new Float64Array(46),
    dof_damping: new Float64Array(46),
  };
  const data = {
    nefc: 2,
    efc_type: [3, 3],
    efc_id: [6, 26],
    efc_force: [0.5, 0.2],
    qpos: new Float64Array(46),
    qvel: new Float64Array(46),
    qfrc_actuator: new Float64Array(46),
    qfrc_bias: new Float64Array(46),
    qfrc_constraint: new Float64Array(46),
    ctrl: new Float64Array(28),
  };
  data.qfrc_constraint[6] = 0.5;
  data.qfrc_constraint[26] = 0.2;
  const slots = new Map(
    [0, 1].map((_, i) => [
      String(i),
      {
        dof: Array.from({ length: 14 }, (_, j) => i * 20 + j + 6),
        qpos: Array.from({ length: 14 }, (_, j) => i * 20 + j + 6),
        jointIds: Array.from({ length: 14 }, (_, j) => i * 15 + j + 1),
        ctrl: Array.from({ length: 14 }, (_, j) => i * 14 + j),
        targets: new Float64Array(14),
      },
    ]),
  );
  updateServos({
    model,
    data,
    slots,
    runtime: { mj: { mjtConstraint: { mjCNSTR_FRICTION_DOF: { value: 3 } } } },
  });
  // The constraint is entirely gearbox friction, so external load is zero.
  const unloaded = BAM.friction_base + BAM.friction_stribeck;
  assert.ok(Math.abs(model.dof_frictionloss[6] - unloaded) < 1e-10);
  assert.ok(Math.abs(model.dof_frictionloss[26] - unloaded) < 1e-10);
});

test("trained football current limiter constrains PWM before the motor equation", () => {
  const positive = servoTorque(2, 0, 5, 1.75),
    negative = servoTorque(-2, 0, -5, 1.75);
  assert.ok(Math.abs(positive - BAM.kt * 1.75) < 1e-10);
  assert.ok(Math.abs(negative + BAM.kt * 1.75) < 1e-10);
  assert.ok(servoTorque(2, 0, 5) > positive);
});
