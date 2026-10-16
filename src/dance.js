import { SQUAT_FRAMES } from "./dance-squat.js";

// Original keyframed choreography inspired by DuckEMW's beat-based move families.
// This interlude pauses physics; it does not claim to run DuckEMW's trained policy.
export const DANCE_BPM = 128;
export const DANCE_MOVES = ["蹦蹦舞", "左右摇摆", "点头时间", "嘎嘎齐舞"];
export function dancePose(time, index, count) {
  const beat = (Math.max(0, time - 1) * DANCE_BPM) / 60;
  const phase = beat * Math.PI * 2;
  const move = Math.floor(beat / 8) % DANCE_MOVES.length;
  const envelope = Math.min(1, Math.max(0, time - 1) * 2);
  const bounce = ((1 - Math.cos(phase)) / 2) * envelope;
  const sway = Math.sin(phase / 2) * envelope;
  const energy = move === 3 ? 1 : 0.82;
  const sample = bounce * energy * (SQUAT_FRAMES.length - 1);
  const lower = Math.floor(sample),
    upper = Math.min(lower + 1, SQUAT_FRAMES.length - 1);
  const mix = sample - lower;
  const joints = SQUAT_FRAMES[lower].joints.map(
    (v, j) => v + (SQUAT_FRAMES[upper].joints[j] - v) * mix,
  );
  const rock = sway * (move === 1 || move === 3 ? 0.24 : 0.15);
  joints[1] += rock;
  joints[10] += rock;
  joints[5] += Math.sin(phase) * (move === 2 ? 0.4 : 0.22) * envelope;
  joints[6] -= Math.sin(phase) * (move === 2 ? 0.5 : 0.3) * envelope;
  joints[7] = Math.sin(phase / 2) * 0.48 * envelope;
  joints[8] = -rock * 1.35;
  const yaw = -Math.PI / 2 + sway * (move === 3 ? 0.4 : 0.25);
  const roll = rock * 0.6;
  const c = Math.cos(yaw / 2),
    s = Math.sin(yaw / 2);
  return {
    x: (index - (count - 1) / 2) * 0.48 + sway * 0.018,
    z: -0.12,
    height: 0.125 - bounce * 0.04 * energy,
    quat: [
      c * Math.cos(roll / 2),
      c * Math.sin(roll / 2),
      s * Math.sin(roll / 2),
      s * Math.cos(roll / 2),
    ],
    joints,
    beat,
    move: DANCE_MOVES[move],
  };
}
