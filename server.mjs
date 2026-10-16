import { applyCommand } from "./src/commands.js";
import { beginKickoff } from "./src/match.js";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { loadPhysicsRuntime, PhysicsWorld } from "./src/physics/world.mjs";
import {
  createRoom,
  addPlayer,
  syncBots,
  tick,
  snapshot,
  FIELD,
} from "./src/simulation.js";
const port = Number(process.env.PORT) || 5173;
const production = process.argv.includes("--production");
const vite = production
  ? null
  : await createViteServer({
      server: { middlewareMode: true, hmr: { port: 24678 } },
      appType: "spa",
    });
const dist = resolve("dist");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".glb": "model/gltf-binary",
  ".md": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
};
console.log("正在加载 MuJoCo 和官方 MicroDuck 策略…");
const physicsRuntime = await loadPhysicsRuntime();
const rooms = new Map();
const server = http.createServer(async (req, res) => {
  if (!production) {
    vite.middlewares(req, res);
    return;
  }
  try {
    let pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = resolve(dist, "." + pathname);
    if (!file.startsWith(dist + "/")) {
      res.writeHead(403);
      res.end();
      return;
    }
    const data = await readFile(file);
    res.setHeader(
      "Content-Type",
      mime[extname(file)] || "application/octet-stream",
    );
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Resource not found. Run npm run build first.");
  }
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
server.on("upgrade", (req, socket, head) => {
  if (new URL(req.url, "http://localhost").pathname === "/play")
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req),
    );
});
wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "http://localhost");
  // Each local browser session gets its own single-player match.
  const key = randomUUID();
  const room = { ...createRoom(), clients: new Map() };
  rooms.set(key, room);
  const id = randomUUID();
  const name = (url.searchParams.get("name") || "Guest Duck")
    .trim()
    .slice(0, 24);
  const p = addPlayer(room, id, name);
  room.clients.set(id, ws);
  syncBots(room);
  beginKickoff(room);
  ws.send(JSON.stringify({ type: "welcome", id }));
  let lastInput = Date.now(),
    messages = 0,
    windowStart = Date.now();
  ws.on("message", (raw) => {
    try {
      const now = Date.now();
      if (now - windowStart > 1000) {
        messages = 0;
        windowStart = now;
      }
      if (++messages > 90) return;
      const m = JSON.parse(raw);
      lastInput = now;
      if (m.type === "pause") {
        room.paused = !!m.value;
        room.lastTickAt = null;
      } else applyCommand(room, p, m);
    } catch {}
  });
  const guard = setInterval(() => {
    if (Date.now() - lastInput > 500) {
      p.forward = 0;
      p.turn = 0;
    }
  }, 250);
  ws.on("close", () => {
    clearInterval(guard);
    room.players.delete(id);
    room.clients.delete(id);
    syncBots(room);
    if (!room.clients.size) {
      room.pendingDispose = true;
      rooms.delete(key);
      if (!busy) room.physics?.dispose();
    }
  });
});
let busy = false;
setInterval(async () => {
  if (busy) return;
  busy = true;
  try {
    for (const room of [...rooms.values()]) {
      if (room.pendingDispose) {
        room.physics?.dispose();
        continue;
      }
      if (room.paused) continue;
      try {
        room.physics ??= new PhysicsWorld(physicsRuntime, room, FIELD);
        const now = performance.now();
        const elapsed =
          room.lastTickAt == null ? 0 : (now - room.lastTickAt) / 1000;
        room.lastTickAt = now;
        await tick(room, elapsed);
        if (!room.pendingDispose) {
          const data = JSON.stringify(snapshot(room));
          for (const ws of room.clients.values())
            if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 100000)
              ws.send(data);
        }
      } catch (error) {
        console.error("MuJoCo room error:", error);
        for (const ws of room.clients.values())
          if (ws.readyState === WebSocket.OPEN)
            ws.send(
              JSON.stringify({
                type: "physics-error",
                message: "物理引擎遇到错误，请重新进入球场。",
              }),
            );
      } finally {
        if (room.pendingDispose) room.physics?.dispose();
      }
    }
  } finally {
    busy = false;
  }
}, 20);
server.listen(port, "127.0.0.1", () => {
  console.log(`MicroDuck 单人足球: http://localhost:${port}`);
});
function shutdown() {
  for (const room of rooms.values()) room.physics?.dispose();
  wss.close();
  server.close();
  vite?.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
