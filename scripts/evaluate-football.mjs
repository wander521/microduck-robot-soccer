// Reproducible real MuJoCo/ONNX rollouts, never a kinematic scoring surrogate.
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
const source = resolve(process.env.FOOTBALL_SOURCE || ".");
const { createRoom, addPlayer, syncBots, tick, FIELD } = await import(
  pathToFileURL(source + "/src/simulation.js")
);
const { loadPhysicsRuntime, PhysicsWorld } = await import(
  pathToFileURL(source + "/src/physics/world.mjs")
);
const { projectedGravity } = await import(
  pathToFileURL(source + "/src/physics/constants.js")
);
const output = resolve(process.argv[2] || "football-evaluation.json"),
  suite = process.argv[3] || "standard";
const runtime = await loadPhysicsRuntime(),
  results = [],
  frames = [];
if (process.env.FOOTBALL_CANDIDATE) {
  runtime.policies.football = await runtime.ort.InferenceSession.create(
    resolve(process.env.FOOTBALL_CANDIDATE),
    { executionProviders: ["cpu"], intraOpNumThreads: 1, interOpNumThreads: 1 },
  );
  runtime.footballInfo = {
    id: process.env.FOOTBALL_CANDIDATE,
    windowSeconds: Number(process.env.FOOTBALL_WINDOW || 1.2),
    currentLimitAmps: Number(process.env.FOOTBALL_CURRENT) || null,
  };
}
const room = createRoom();
addPlayer(room, "human", "Player", "blue");
syncBots(room);
const defaultLayout = [...room.players.values()].map((p) => ({
  x: p.x,
  z: p.z,
  yaw: p.yaw,
  team: p.team,
}));
const singles = [
  ["single-centre", 0, 0],
  ["single-offset", 0.1, 0.38],
  ["single-sideline", 0.3, 0.86],
];
const tests = singles.map(([name, x, z]) => ({
  name,
  ball: { x, z },
  layout: [{ x: -0.65, z: 0 }],
  duration: 45,
}));
if (suite === "standard" || suite === "all")
  tests.push(
    {
      name: "2v2-default",
      layout: defaultLayout,
      ball: { x: 0, z: 0 },
      duration: 120,
    },
    {
      name: "2v2-offset",
      layout: defaultLayout,
      ball: { x: 0.3, z: 0.35 },
      duration: 120,
    },
    {
      name: "2v2-spread",
      layout: [
        { x: -0.65, z: -0.35 },
        { x: 0.65, z: -0.35, yaw: Math.PI, team: "orange" },
        { x: -0.65, z: 0.35 },
        { x: 0.65, z: 0.35, yaw: Math.PI, team: "orange" },
      ],
      ball: { x: -0.2, z: 0.1 },
      duration: 120,
    },
  );
if (suite === "holdout" || suite === "all")
  tests.push(
    ...[
      ["single-mirror", 0.15, -0.42, -0.7, 0.1, 0, "blue"],
      ["single-own-corner", -1.4, 0.8, -0.3, -0.1, 1.1, "blue"],
      ["single-opponent-corner", 1.39, -0.8, -0.45, 0.2, -0.8, "blue"],
      ["single-orange", -0.1, -0.38, 0.65, 0, Math.PI, "orange"],
      ["single-moving", 0.25, -0.25, -0.65, 0.1, 0, "blue", -0.14, 0.1],
    ].map(([name, x, z, px, pz, yaw, team, vx = 0, vz = 0]) => ({
      name,
      ball: { x, z, vx, vz },
      layout: [{ x: px, z: pz, yaw, team }],
      duration: 60,
    })),
  );
const select = process.env.FOOTBALL_CASE;
const started = performance.now();
try {
  for (const scenario of tests.filter((t) => !select || t.name === select)) {
    const room = createRoom();
    room.ai = false;
    for (const [i, pose] of scenario.layout.entries())
      Object.assign(
        addPlayer(room, "p" + i, "Duck " + i, pose.team || "blue"),
        pose,
        { auto: false },
      );
    const world = (room.physics = new PhysicsWorld(runtime, room, FIELD));
    const m = {
      name: scenario.name,
      duration: scenario.duration,
      players: scenario.layout.length,
      kickAttempts: 0,
      chargeAttempts: 0,
      chargeHits: 0,
      kickDistances: [],
      goals: {},
      firstGoalSeconds: null,
      ballSlowSeconds: 0,
      teammatesCloseSeconds: 0,
      threeAtBallSeconds: 0,
      recoveryEntries: 0,
      forcedResets: 0,
      fallenRobotSeconds: 0,
      ballPathMetres: 0,
      ballMaxSpeed: 0,
      finite: true,
    };
    const charging = new Set(),
      chargeHit = new Set();
    let recording = false,
      previousBall;
    const control = world.control.bind(world),
      reset = world.reset.bind(world);
    world.reset = (...args) => {
      if (
        recording &&
        !room.ballResetPending &&
        world.slots.get(args[0].id)?.resetRevision === args[0].resetRevision
      )
        m.forcedResets++;
      return reset(...args);
    };
    world.control = async (p, slot) => {
      const kick = slot.kickTime,
        recovery = slot.recovery;
      await control(p, slot);
      if (recording && kick === 0 && slot.kickTime > 0) {
        m.kickAttempts++;
        m.kickDistances.push(
          Math.hypot(p.x - room.balls[0].x, p.z - room.balls[0].z),
        );
      }
      if (recording && !recovery && slot.recovery) m.recoveryEntries++;
    };
    const series = [];
    try {
      world.setBall({ x: 1.2, z: 0.7, y: 0.05 });
      for (let i = 0; i < 50; i++) await tick(room);
      for (const p of room.players.values()) p.auto = true;
      world.setBall({ ...scenario.ball, y: 0.05 });
      room.balls[0] = world.readBall();
      recording = true;
      for (let i = 0; i < scenario.duration * 50; i++) {
        await tick(room);
        for (const p of room.players.values()) {
          if (p.charge > 0 && !charging.has(p.id)) {
            m.chargeAttempts++;
            charging.add(p.id);
          }
          if (!(p.charge > 0)) {
            charging.delete(p.id);
            chargeHit.delete(p.id);
          }
          if (p.chargeHit && p.charge > 0 && !chargeHit.has(p.id)) {
            m.chargeHits++;
            chargeHit.add(p.id);
          }
        }
        const b = room.balls[0],
          ps = [...room.players.values()],
          score = room.scores.blue + room.scores.orange;
        const speed = Math.hypot(b.vx, b.vz);
        m.ballMaxSpeed = Math.max(m.ballMaxSpeed, speed);
        if (speed < 0.03) m.ballSlowSeconds += 0.02;
        if (score && m.firstGoalSeconds === null)
          m.firstGoalSeconds = (i + 1) * 0.02;
        if (previousBall && score === previousBall.score)
          m.ballPathMetres += Math.hypot(
            b.x - previousBall.x,
            b.z - previousBall.z,
          );
        previousBall = { x: b.x, z: b.z, score };
        if (
          ps.filter((p) => Math.hypot(p.x - b.x, p.z - b.z) < 0.35).length >= 3
        )
          m.threeAtBallSeconds += 0.02;
        if (
          ps.some((p, a) =>
            ps.some(
              (q, c) =>
                c > a &&
                p.team === q.team &&
                Math.hypot(p.x - q.x, p.z - q.z) < 0.22,
            ),
          )
        )
          m.teammatesCloseSeconds += 0.02;
        for (const p of ps)
          if (projectedGravity(p.quat)[2] > -0.5 || p.height < 0.025)
            m.fallenRobotSeconds += 0.02;
        if (i % 10 === 0) {
          m.finite &&= [...world.data.qpos, ...world.data.qvel].every(
            Number.isFinite,
          );
          series.push({
            t: (i + 1) * 0.02,
            ball: { x: b.x, z: b.z, vx: b.vx, vz: b.vz },
            scores: { ...room.scores },
            players: ps.map((p) => ({
              id: p.id,
              team: p.team,
              x: p.x,
              z: p.z,
              yaw: p.yaw,
              height: p.height,
              speed: p.speed,
              kick: p.kick,
              recovery: p.recovery,
              forward: p.forward,
              turn: p.turn,
              role: p.footballRole,
              stage: p.footballStage,
              charge: p.charge,
              chargeHit: p.chargeHit,
            })),
          });
        }
      }
      m.goals = { ...room.scores };
      results.push(m);
      frames.push({ name: scenario.name, series });
      console.log(JSON.stringify(m));
      await mkdir(resolve(output, ".."), { recursive: true });
      await writeFile(
        output,
        JSON.stringify(
          {
            suite,
            results,
            wallSeconds: (performance.now() - started) / 1000,
            source,
            simulationSha256: createHash("sha256")
              .update(await readFile(source + "/src/simulation.js"))
              .digest("hex"),
          },
          null,
          2,
        ) + "\n",
      );
      await writeFile(output + ".frames.json", JSON.stringify(frames));
    } finally {
      world.dispose();
    }
  }
} finally {
  for (const s of Object.values(runtime.policies)) await s.release();
  runtime.vfs.delete();
}
