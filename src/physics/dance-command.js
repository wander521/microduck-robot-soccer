// DuckEMW DanceCommand: 61D actor, body-pose slots 55..60.
// Two-beat phase and binary move encoding match the training MDP.
export const DANCE_BPM = 128;
export const DANCE_MOVE_NAMES = ["蹦蹦舞", "左右摇摆", "点头时间", "嘎嘎齐舞", "嘎嘎高歌"];
// Start with the main dance after assembly; quiet poses close the phrase.
const SEQUENCE = [[3, 16], [1, 8], [0, 8], [4, 4], [2, 4]];
export function danceCommand(time, bpm = DANCE_BPM, forcedMove) {
  const beat = Math.max(0, time) * bpm / 60;
  let move = forcedMove;
  if (move === undefined) {
    let remaining = beat % 40;
    for (const [id, length] of SEQUENCE) {
      move = id;
      if (remaining < length) break;
      remaining -= length;
    }
  }
  if (!Number.isInteger(move) || move < 0 || move > 4)
    throw new RangeError("Unknown trained dance move");
  const phase = Math.PI * beat;
  return {
    beat,
    bpm,
    move,
    moveName: DANCE_MOVE_NAMES[move],
    body: [Math.sin(phase), Math.cos(phase), bpm / 120, move & 1, (move >> 1) & 1, (move >> 2) & 1],
  };
}
