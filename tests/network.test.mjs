import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
const enabled = process.env.RUN_NETWORK_TESTS === "1";
const base = process.env.TEST_SERVER || "ws://127.0.0.1:5173";
function client(room, name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `${base}/play?room=${room}&name=${encodeURIComponent(name)}`,
    );
    const client = { ws, id: null, state: null, waiters: [] };
    ws.on("error", reject);
    ws.on("message", (raw) => {
      const message = JSON.parse(raw);
      if (message.type === "welcome") client.id = message.id;
      if (message.type === "state") client.state = message;
      for (const wake of client.waiters.splice(0)) wake();
      if (client.id && client.state) resolve(client);
    });
  });
}
async function until(c, check) {
  const start = Date.now();
  while (!check(c.state)) {
    if (Date.now() - start > 5000)
      throw new Error("Timed out waiting for shared state");
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 100);
      c.waiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}
test(
  "local sessions are single-player and isolated even with identical room parameters",
  { skip: !enabled },
  async () => {
    const room = `same-${Date.now()}`;
    const a = await client(room, "Alice"),
      b = await client(room, "Bob");
    try {
      for (const c of [a, b]) {
        assert.equal(c.state.players.filter((p) => !p.bot).length, 1);
        assert.equal(c.state.players.filter((p) => p.bot).length, 3);
        assert.equal(c.state.balls.length, 1);
        assert.equal(c.state.engine.name, "MuJoCo");
      }
      assert.ok(!a.state.players.some((p) => p.id === b.id));
      a.ws.send(JSON.stringify({ type: "ai", value: false }));
      await until(a, (s) => !s.ai);
      assert.equal(a.state.players.length, 1);
      assert.equal(b.state.ai, true);
    } finally {
      a.ws.close();
      b.ws.close();
    }
  },
);
test(
  "local controls and Space reset keep the football and player in sync",
  { skip: !enabled },
  async () => {
    const a = await client(`controls-${Date.now()}`, "Alice");
    let heartbeat;
    try {
      a.ws.send(JSON.stringify({ type: "ai", value: false }));
      a.ws.send(JSON.stringify({ type: "mode", mode: "roller" }));
      await until(
        a,
        (s) => !s.ai && s.players.find((p) => p.id === a.id).mode === "roller",
      );
      const input = () =>
        a.ws.send(JSON.stringify({ type: "input", forward: 1, turn: 0 }));
      input();
      heartbeat = setInterval(input, 100);
      await until(a, (s) => Math.abs(s.balls[0].x) > 0.06);
      clearInterval(heartbeat);
      a.ws.send(JSON.stringify({ type: "input", forward: 0, turn: 0 }));
      a.ws.send(JSON.stringify({ type: "reset" }));
      await until(
        a,
        (s) =>
          Math.hypot(s.balls[0].x, s.balls[0].z) < 0.001 &&
          Math.abs(s.players.find((p) => p.id === a.id).x + 0.2) < 0.01,
      );
      assert.equal(a.state.balls.length, 1);
      a.ws.send(JSON.stringify({ type: "dance" }));
      await until(a, (s) => s.dance?.time > 1.1);
      assert.equal(a.state.players.length, 1);
      assert.ok(Math.abs(a.state.players[0].z + 0.12) < 0.001);
      a.ws.send(JSON.stringify({ type: "dance" }));
      await until(a, (s) => !s.dance);
      a.ws.send(JSON.stringify({ type: "team" }));
      await until(
        a,
        (s) => s.players.find((p) => p.id === a.id).team === "orange",
      );
    } finally {
      clearInterval(heartbeat);
      a.ws.close();
    }
  },
);
