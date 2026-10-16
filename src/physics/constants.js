// Pollen Robotics' exported 61D policy contract (Apache-2.0).
export const JOINT_NAMES = [
  "left_hip_yaw",
  "left_hip_roll",
  "left_hip_pitch",
  "left_knee",
  "left_ankle",
  "neck_pitch",
  "head_pitch",
  "head_yaw",
  "head_roll",
  "right_hip_yaw",
  "right_hip_roll",
  "right_hip_pitch",
  "right_knee",
  "right_ankle",
];
export const DEFAULT_POSE = [
  0, -0.08726646259971647, -0.457924, -0.00494, 0.452984, 0.3490658503988659,
  0.3490658503988659, 0, 0, 0, 0.08726646259971647, 0.457924, 0.00494,
  -0.452984,
];
export const PHYSICS_DT = 0.005;
export const CONTROL_DT = 0.02;
export const OBS_SIZE = 61;
// Keyboard range from microduck_rl/scripts/infer_policy.py.
export function velocityCommand(forward, turn, mode = "walk") {
  const limits = mode === "roller" ? [0.6, -0.5, 0.3] : [0.3, -0.3, 1.5];
  return [
    forward * (forward >= 0 ? limits[0] : -limits[1]),
    0,
    turn * limits[2],
  ];
}
export function projectedGravity(q) {
  const [w, x, y, z] = q;
  return [2 * (w * y - x * z), -2 * (y * z + w * x), 2 * (x * x + y * y) - 1];
}
