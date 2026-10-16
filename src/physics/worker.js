import { loadBrowserRuntime } from "./browser-runtime.js";
import { PhysicsWorld } from "./world-core.js";
import {
  createRoom,
  addPlayer,
  syncBots,
  tick,
  snapshot,
  FIELD,
} from "../simulation.js";
import { applyCommand } from "../commands.js";
let room,
  player,
  paused = false,
  busy = false,
  timer = null,
  initializing = false;
function fail(error) {
  paused = true;
  postMessage({ type: "error", message: error.message || String(error) });
}
async function pump() {
  timer = null;
  if (paused || !room || busy) return;
  busy = true;
  const start = performance.now();
  try {
    await tick(room);
    postMessage(snapshot(room));
  } catch (error) {
    fail(error);
  } finally {
    busy = false;
    if (!paused)
      timer = setTimeout(pump, Math.max(0, 20 - (performance.now() - start)));
  }
}
async function initialize(name) {
  if (initializing || room) return;
  initializing = true;
  const runtime = await loadBrowserRuntime((value, message) =>
    postMessage({ type: "progress", value, message }),
  );
  room = createRoom();
  player = addPlayer(room, "you", String(name || "小鸭队长").slice(0, 24));
  syncBots(room);
  room.physics = new PhysicsWorld(runtime, room, FIELD);
  await tick(room);
  postMessage({
    type: "progress",
    value: 1,
    message: "小鸭已就绪，准备开球！",
  });
  postMessage({ type: "ready", id: player.id });
  postMessage(snapshot(room));
  pump();
}
self.onmessage = ({ data }) => {
  if (data.type === "init") {
    initialize(data.name).catch(fail);
    return;
  }
  if (!room) return;
  if (data.type === "pause") {
    paused = !!data.value;
    if (paused) {
      player.forward = 0;
      player.turn = 0;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    } else if (timer === null && !busy) pump();
    return;
  }
  applyCommand(room, player, data);
};
