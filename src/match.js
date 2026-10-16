import { resetCharge } from "./charge.js";
export const MATCH_SECONDS = 5 * 60;
export function createMatch(round = 1) {
  return {
    round,
    phase: "playing",
    remaining: MATCH_SECONDS,
    winner: null,
    finalScore: null,
    kickoffRemaining: 0,
  };
}
export function beginKickoff(room) {
  room.match.phase = "kickoff";
  room.match.kickoffRemaining = 3;
}
export function formatMatchTime(remaining) {
  const seconds = Math.max(0, Math.ceil(remaining));
  return (
    Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0") +
    ":" +
    (seconds % 60).toString().padStart(2, "0")
  );
}
export function advanceMatch(room, elapsedSeconds) {
  const match = room.match;
  if (match.phase === "finished" || room.dancing) return;
  let elapsed = Number.isFinite(elapsedSeconds)
    ? Math.max(0, elapsedSeconds)
    : 0;
  if (match.phase === "kickoff") {
    const consumed = Math.min(match.kickoffRemaining, elapsed);
    match.kickoffRemaining = Math.max(0, match.kickoffRemaining - consumed);
    elapsed -= consumed;
    if (match.kickoffRemaining > 1e-8) return;
    match.kickoffRemaining = 0;
    match.phase = "playing";
  }
  match.remaining = Math.max(0, match.remaining - elapsed);
  if (match.remaining > 1e-8) return;
  match.remaining = 0;
  match.phase = "finished";
  match.finalScore = { ...room.scores };
  match.winner =
    room.scores.blue === room.scores.orange
      ? "draw"
      : room.scores.blue > room.scores.orange
        ? "blue"
        : "orange";
  for (const player of room.players.values()) {
    player.forward = player.turn = 0;
    player.kickRequested = false;
    resetCharge(player);
  }
}
