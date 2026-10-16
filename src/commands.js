import { resetCharge } from "./charge.js";
import { resetFootballAI } from "./football-ai.js";
import {
  resetPlayer,
  resetPlay,
  restartMatch,
  syncBots,
  FIELD,
} from "./simulation.js";
export function applyCommand(room, player, message) {
  if (
    room.match.phase !== "playing" &&
    !["reset", "restart", "rename"].includes(message.type)
  )
    return;
  if (room.dancing && !["dance", "reset", "rename"].includes(message.type))
    return;
  switch (message.type) {
    case "input":
      player.forward = Math.max(-1, Math.min(1, Number(message.forward) || 0));
      player.turn = Math.max(-1, Math.min(1, Number(message.turn) || 0));
      break;
    case "mode":
      resetCharge(player);
      if (["walk", "roller"].includes(message.mode)) player.mode = message.mode;
      break;
    case "dance":
      room.dancing = !room.dancing;
      resetFootballAI(room);
      for (const actor of room.players.values()) {
        resetCharge(actor);
        actor.forward = 0;
        actor.turn = 0;
        actor.kickRequested = false;
        actor.kickFoot = null;
        actor.kickSource = null;
      }
      break;
    case "restart":
      if (room.match.phase === "finished") restartMatch(room, player);
      break;
    case "reset":
      if (room.match.phase === "finished") restartMatch(room, player);
      else resetPlay(room, player);
      break;
    case "spectator":
      resetCharge(player);
      player.spectator = !player.spectator;
      if (player.spectator) {
        player.z = FIELD.halfWidth + 0.2;
        player.forward = 0;
        player.turn = 0;
        player.resetRevision++;
        player.resetPose = { x: player.x, z: player.z, yaw: player.yaw };
      } else resetPlayer(player);
      break;
    case "charge":
      player.chargeRequested = true;
      break;
    case "kick":
      player.kickRequested = true;
      player.kickSource = "manual";
      break;
    case "quack":
      player.quack = 0.55;
      break;
    case "auto":
      player.auto = !!message.value;
      break;
    case "ai":
      room.ai = !!message.value;
      syncBots(room);
      break;
    case "team":
      player.team = player.team === "blue" ? "orange" : "blue";
      resetPlayer(player);
      syncBots(room);
      break;
    case "rename":
      player.name = String(message.name || "小鸭队长")
        .trim()
        .slice(0, 24);
      break;
  }
}
