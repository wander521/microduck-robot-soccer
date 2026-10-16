import { XMLSerializer } from "@xmldom/xmldom";
import {
  JOINT_NAMES,
  DEFAULT_POSE,
  PHYSICS_DT,
  CONTROL_DT,
  OBS_SIZE,
  velocityCommand,
  projectedGravity,
} from "./constants.js";
import { dancePose, DANCE_BPM } from "../dance.js";
import { BAM, MAX_TORQUE, updateServos } from "./servo.mjs";
const elements = (node, tag) => [...node.getElementsByTagName(tag)];
function element(doc, tag, attrs = {}) {
  const el = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}
function empty(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}
function namespaced(doc, source, prefix) {
  const node = doc.importNode(source, true);
  for (const el of [node, ...elements(node, "*")])
    for (const attr of [
      "name",
      "joint",
      "site",
      "body",
      "body1",
      "body2",
      "objname",
    ])
      if (el.hasAttribute(attr))
        el.setAttribute(attr, prefix + el.getAttribute(attr));
  return node;
}
function buildXml(runtime, players, field) {
  const doc = runtime.templates.walk.cloneNode(true),
    root = doc.documentElement;
  root.setAttribute("model", "microduck-football");
  const world = elements(doc, "worldbody")[0],
    actuators = elements(doc, "actuator")[0],
    sensors = elements(doc, "sensor")[0];
  empty(world);
  empty(actuators);
  empty(sensors);
  const assets = elements(doc, "asset")[0];
  const namedAssets = new Set(
    elements(assets, "mesh").map(
      (m) =>
        m.getAttribute("name") || m.getAttribute("file").replace(/\.stl$/, ""),
    ),
  );
  for (const mesh of Object.values(runtime.templates).flatMap(template=>elements(template, "mesh"))) {
    const name =
      mesh.getAttribute("name") ||
      mesh.getAttribute("file").replace(/\.stl$/, "");
    if (!namedAssets.has(name)) {
      assets.appendChild(doc.importNode(mesh, true));
      namedAssets.add(name);
    }
  }
  const materialNames = new Set(
    elements(assets, "material").map((m) => m.getAttribute("name")),
  );
  for (const mat of Object.values(runtime.templates).flatMap(template=>elements(template, "material")))
    if (!materialNames.has(mat.getAttribute("name"))) {
      assets.appendChild(doc.importNode(mat, true));
      materialNames.add(mat.getAttribute("name"));
    }
  for (const mesh of elements(assets, "mesh")) {
    const name =
      mesh.getAttribute("name") ||
      mesh.getAttribute("file").replace(/\.stl$/, "");
    if (!runtime.used.has(name)) assets.removeChild(mesh);
  }
  root.appendChild(
    element(doc, "option", {
      timestep: PHYSICS_DT,
      integrator: "Euler",
    }),
  );
  world.appendChild(
    element(doc, "geom", {
      name: "floor",
      type: "plane",
      size: "0 0 .05",
      friction: "1 .005 .0001",
      condim: 3,
    }),
  );
  const {
    halfLength: L,
    halfWidth: W,
    goalHalfWidth: G,
    goalDepth: D,
    goalHeight: H,
  } = field;
  const box = (name, pos, size, ballOnly = false) =>
    world.appendChild(
      element(doc, "geom", {
        name,
        type: "box",
        pos: pos.join(" "),
        size: size.join(" "),
        friction: ".5 .01 .001",
        contype: ballOnly ? 4 : 1,
        conaffinity: ballOnly ? 4 : 1,
      }),
    );
  for (const sign of [-1, 1]) {
    box(
      "side-" + sign,
      [0, sign * (W + 0.0125), 0.1],
      [L + D + 0.03, 0.0125, 0.1],
      true,
    );
    for (const side of [-1, 1]) {
      box(
        `end-${sign}-${side}`,
        [sign * (L + 0.0125), (side * (W + G)) / 2, 0.1],
        [0.0125, (W - G) / 2, 0.1],
        true,
      );
      box(
        `post-${sign}-${side}`,
        [sign * L, side * G, H / 2],
        [0.0125, 0.0125, H / 2],
      );
    }
    box("bar-" + sign, [sign * L, 0, H], [0.0125, G + 0.0125, 0.0125]);
    box("net-" + sign, [sign * (L + D), 0, H / 2], [0.005, G, H / 2]);
  }
  // Robots can step around a ball against the ball-only inner boards.
  const outerL = L + D + field.runoff,
    outerW = W + field.runoff;
  for (const sign of [-1, 1]) {
    box(`runoff-side-${sign}`, [0, sign * outerW, 0.12], [outerL, 0.015, 0.12]);
    box(`runoff-end-${sign}`, [sign * outerL, 0, 0.12], [0.015, outerW, 0.12]);
  }
  players.forEach((p, i) => {
    const prefix = `duck${i}_`,
      template = runtime.templates[p.danceActor ? "dance" : p.mode === "roller" ? "roller" : "walk"];
    const body = elements(template, "worldbody")[0].getElementsByTagName(
      "body",
    )[0];
    const physicalBody = namespaced(doc, body, prefix);
    for (const joint of elements(physicalBody, "joint")) {
      if (joint.getAttribute("name").includes("passive_"))
        joint.setAttribute("frictionloss", ".003");
      else {
        joint.setAttribute("damping", "0");
        joint.setAttribute("frictionloss", "0");
        joint.setAttribute("armature", String(BAM.armature));
        joint.setAttribute("solreffriction", "-50000 -200");
        joint.setAttribute("solimpfriction", ".99 .9999 .001 .5 2");
      }
    }
    world.appendChild(physicalBody);
    for (const node of [...elements(template, "actuator")[0].childNodes])
      if (node.nodeType === 1)
        actuators.appendChild(
          element(doc, "motor", {
            name: prefix + node.getAttribute("name"),
            joint: prefix + node.getAttribute("joint"),
            gear: 1,
            ctrllimited: false,
            forcelimited: true,
            forcerange: `${-MAX_TORQUE} ${MAX_TORQUE}`,
          }),
        );
    for (const node of [...elements(template, "sensor")[0].childNodes])
      if (node.nodeType === 1)
        sensors.appendChild(namespaced(doc, node, prefix));
  });
  const ball = element(doc, "body", { name: "ball", pos: "0 0 .05" });
  ball.appendChild(element(doc, "freejoint", { name: "ball_freejoint" }));
  ball.appendChild(
    element(doc, "geom", {
      name: "ball_geom",
      contype: 5,
      conaffinity: 5,
      type: "sphere",
      size: field.ballRadius,
      mass: 0.03,
      friction: ".4 .01 .003",
      solref: ".03 .4",
      condim: 6,
    }),
  );
  world.appendChild(ball);
  return new XMLSerializer().serializeToString(doc);
}
function poseYaw(q) {
  return Math.atan2(
    2 * (q[0] * q[3] + q[1] * q[2]),
    1 - 2 * (q[2] * q[2] + q[3] * q[3]),
  );
}
export class PhysicsWorld {
  constructor(runtime, room, field) {
    this.runtime = runtime;
    this.room = room;
    this.field = field;
    this.signature = "";
    this.slots = new Map();
    this.model = null;
    this.data = null;
    this.frame = 0;
    this.elapsed = 0;
    this.lastStepMs = 0;
    this.rebuild();
  }
  rosterSignature() {
    return [...this.room.players.values()]
      .map((p) => p.id + ":" + p.mode)
      .join("|");
  }
  saveStates() {
    const saved = new Map();
    if (!this.data) return saved;
    for (const [id, slot] of this.slots) {
      const q = this.data.qpos,
        v = this.data.qvel;
      saved.set(id, {
        mode: slot.mode,
        resetRevision: slot.resetRevision,
        position: Array.from(q.slice(slot.baseQ, slot.baseQ + 7)),
        velocity: Array.from(v.slice(slot.baseV, slot.baseV + 6)),
        joints: slot.qpos.map((a) => q[a]),
        jointV: slot.dof.map((a) => v[a]),
        lastAction: new Float32Array(slot.lastAction),
      });
    }
    return saved;
  }
  rebuild() {
    const saved = this.saveStates();
    const oldBall = this.data ? this.readBall() : null;
    const players = [...this.room.players.values()];
    const { mj } = this.runtime;
    const xml = buildXml(this.runtime, players, this.field);
    const model = mj.MjModel.from_xml_string(xml, this.runtime.vfs);
    const data = new mj.MjData(model);
    this.data?.delete();
    this.model?.delete();
    this.model = model;
    this.data = data;
    this.slots.clear();
    players.forEach((p, i) => {
      const prefix = `duck${i}_`,
        base = model.jnt(prefix + "trunk_base_freejoint");
      const slot = {
        prefix,
        mode: p.mode,
        baseQ: Number(base.qposadr),
        baseV: Number(base.dofadr),
        bodyId: mj.mj_name2id(
          model,
          mj.mjtObj.mjOBJ_BODY.value,
          prefix + "trunk_base",
        ),
        qpos: JOINT_NAMES.map((n) => Number(model.jnt(prefix + n).qposadr)),
        dof: JOINT_NAMES.map((n) => Number(model.jnt(prefix + n).dofadr)),
        ctrl: JOINT_NAMES.map((n) =>
          mj.mj_name2id(model, mj.mjtObj.mjOBJ_ACTUATOR.value, prefix + n),
        ),
        gyro: Number(model.sensor(prefix + "imu_ang_vel").adr),
        lastAction: new Float32Array(14),
        targets: new Float64Array(DEFAULT_POSE),
        jointIds: JOINT_NAMES.map((n) =>
          mj.mj_name2id(model, mj.mjtObj.mjOBJ_JOINT.value, prefix + n),
        ),
        obs: new Float32Array(OBS_SIZE),
        resetRevision: p.resetRevision || 0,
        fallenFor: 0,
        recovery: null,
        recoveryTime: 0,
        kickTime: 0,
        kickLock: 0,
        kickSide: false,
        feet: ["left_foot_collision", "right_foot_collision"]
          .map((name) =>
            mj.mj_name2id(model, mj.mjtObj.mjOBJ_GEOM.value, prefix + name),
          )
          .filter((id) => id >= 0),
        extra: [],
      };
      const template =
        this.runtime.templates[p.danceActor ? "dance" : p.mode === "roller" ? "roller" : "walk"];
      for (const j of elements(elements(template, "worldbody")[0], "joint")) {
        const name = j.getAttribute("name");
        if (name && !JOINT_NAMES.includes(name))
          slot.extra.push({
            name,
            q: Number(model.jnt(prefix + name).qposadr),
            v: Number(model.jnt(prefix + name).dofadr),
          });
      }
      this.slots.set(p.id, slot);
      const previous = saved.get(p.id);
      if (
        previous &&
        previous.mode === p.mode &&
        previous.resetRevision === slot.resetRevision
      ) {
        data.qpos.set(previous.position, slot.baseQ);
        data.qvel.set(previous.velocity, slot.baseV);
        slot.qpos.forEach((a, j) => (data.qpos[a] = previous.joints[j]));
        slot.dof.forEach((a, j) => (data.qvel[a] = previous.jointV[j]));
        slot.lastAction.set(previous.lastAction);
        slot.ctrl.forEach(
          (a, j) => (slot.targets[j] = DEFAULT_POSE[j] + slot.lastAction[j]),
        );
      } else this.reset(p);
    });
    this.ballQ = Number(model.jnt("ball_freejoint").qposadr);
    this.ballV = Number(model.jnt("ball_freejoint").dofadr);
    this.setBall(oldBall || this.room.balls[0]);
    mj.mj_forward(model, data);
    this.signature = this.rosterSignature();
  }
  reset(p) {
    const slot = this.slots.get(p.id);
    if (!slot) return;
    const q = this.data.qpos,
      v = this.data.qvel;
    const h = p.mode === "roller" ? 0.1385 : 0.125,
      pose = p.resetPose || p;
    delete p.resetPose;
    q.set(
      [
        pose.x,
        -pose.z,
        h,
        Math.cos(pose.yaw / 2),
        0,
        0,
        Math.sin(pose.yaw / 2),
      ],
      slot.baseQ,
    );
    v.fill(0, slot.baseV, slot.baseV + 6);
    slot.qpos.forEach((a, j) => (q[a] = DEFAULT_POSE[j]));
    slot.dof.forEach((a) => (v[a] = 0));
    slot.targets.set(DEFAULT_POSE);
    slot.ctrl.forEach((a) => (this.data.ctrl[a] = 0));
    slot.extra.forEach((e) => {
      q[e.q] = 0;
      v[e.v] = 0;
    });
    slot.lastAction.fill(0);
    slot.fallenFor = 0;
    slot.recovery = null;
    slot.recoveryTime = 0;
    slot.kickTime = 0;
    slot.kickLock = 0;
    slot.resetRevision = p.resetRevision || 0;
  }
  setBall(ball) {
    if (this.ballQ === undefined) return;
    this.data.qpos.set(
      [
        ball.x || 0,
        -(ball.z || 0),
        Math.max(this.field.ballRadius, ball.y ?? this.field.ballRadius),
        ...(ball.quat || [1, 0, 0, 0]),
      ],
      this.ballQ,
    );
    this.data.qvel.set(
      [
        ball.vx || 0,
        -(ball.vz || 0),
        ball.vy || 0,
        ...(ball.angular || [0, 0, 0]),
      ],
      this.ballV,
    );
  }
  readBall() {
    const q = this.data.qpos,
      v = this.data.qvel;
    return {
      id: 0,
      x: q[this.ballQ],
      z: -q[this.ballQ + 1],
      y: q[this.ballQ + 2],
      vx: v[this.ballV],
      vz: -v[this.ballV + 1],
      vy: v[this.ballV + 2],
      quat: Array.from(q.slice(this.ballQ + 3, this.ballQ + 7)),
      angular: Array.from(v.slice(this.ballV + 3, this.ballV + 6)),
      cooldown: this.room.balls[0]?.cooldown || 0,
    };
  }
  async control(p, slot) {
    if (slot.resetRevision !== (p.resetRevision || 0)) this.reset(p);
    const { model, data, runtime } = this;
    const q = data.qpos,
      v = data.qvel;
    const quat = Array.from(q.slice(slot.baseQ + 3, slot.baseQ + 7)),
      gravity = projectedGravity(quat),
      height = q[slot.baseQ + 2];
    if (!Number.isFinite(height) || !quat.every(Number.isFinite)) {
      this.reset(p);
      return;
    }
    const fallen = gravity[2] > -0.5 || height < 0.025;
    slot.fallenFor = fallen ? slot.fallenFor + CONTROL_DT : 0;
    if (!slot.recovery && slot.fallenFor > 0.28) {
      slot.recovery = "settle";
      slot.recoveryTime = 0;
      slot.kickTime = 0;
    }
    if (slot.recovery) {
      slot.recoveryTime += CONTROL_DT;
      if (slot.recovery === "settle" && slot.recoveryTime > 0.22) {
        slot.recovery = "stand";
        slot.recoveryTime = 0;
      }
      if (
        slot.recovery === "stand" &&
        slot.recoveryTime > 0.6 &&
        gravity[2] < -0.88 &&
        height > 0.08
      ) {
        slot.recovery = null;
        slot.fallenFor = 0;
      } else if (slot.recoveryTime > 7) {
        this.reset(p);
        return;
      }
    }
    if (p.kickRequested) {
      if (
        p.mode === "walk" &&
        !slot.recovery &&
        slot.kickTime === 0 &&
        slot.kickLock === 0
      ) {
        slot.kickTime = 0.5;
        slot.kickSide = !slot.kickSide;
      }
      p.kickRequested = false;
    }
    const command =
      slot.recovery || slot.kickTime > 0 || slot.kickLock > 0
        ? [0, 0, 0]
        : velocityCommand(p.forward, p.turn, p.mode);
    const obs = slot.obs;
    let i = 0;
    for (let a = 0; a < 3; a++) obs[i++] = data.sensordata[slot.gyro + a];
    for (const value of gravity) obs[i++] = value;
    for (let j = 0; j < 14; j++) obs[i++] = q[slot.qpos[j]] - DEFAULT_POSE[j];
    for (let j = 0; j < 14; j++) obs[i++] = v[slot.dof[j]];
    for (let j = 0; j < 14; j++) obs[i++] = slot.lastAction[j];
    obs.fill(0, i);
    for (let a = 0; a < 3; a++) obs[i + a] = command[a];
    if (slot.recovery !== "settle") {
      const key = slot.recovery
        ? "stand"
        : slot.kickTime > 0
          ? slot.kickSide
            ? "kickL"
            : "kickR"
          : p.mode === "roller"
            ? "roller"
            : "walk";
      const session = runtime.policies[key];
      const out = await session.run({
        [session.inputNames[0]]: new runtime.ort.Tensor("float32", obs, [
          1,
          OBS_SIZE,
        ]),
      });
      const action = out[session.outputNames[0]].data;
      if (!action.every(Number.isFinite))
        throw new Error("Non-finite policy action");
      slot.lastAction.set(action);
      slot.ctrl.forEach(
        (a, j) => (slot.targets[j] = DEFAULT_POSE[j] + action[j]),
      );
    }
    if (slot.kickTime > 0) {
      slot.kickTime = Math.max(0, slot.kickTime - CONTROL_DT);
      if (slot.kickTime === 0) slot.kickLock = 0.4;
    } else slot.kickLock = Math.max(0, slot.kickLock - CONTROL_DT);
    p.kick = slot.kickTime + slot.kickLock;
    p.recovery = slot.recovery;
  }
  async step() {
    const start = performance.now();
    if (this.signature !== this.rosterSignature()) this.rebuild();
    if (this.room.dancing) {
      this.stepDance();
      return;
    }
    if (this.danceSaved) this.endDance();
    await Promise.all(
      [...this.room.players.values()].map((p) =>
        this.control(p, this.slots.get(p.id)),
      ),
    );
    if (this.room.dancing) {
      this.stepDance();
      return;
    }
    // A reset may arrive while policy inference is awaiting its result.
    for (const p of this.room.players.values()) {
      const slot = this.slots.get(p.id);
      if (slot && slot.resetRevision !== p.resetRevision) this.reset(p);
    }
    if (this.room.ballResetPending) {
      const ball = {
        id: 0,
        x: 0,
        z: 0,
        y: this.field.ballRadius,
        vx: 0,
        vz: 0,
        vy: 0,
        quat: [1, 0, 0, 0],
        angular: [0, 0, 0],
        cooldown: 0,
      };
      this.room.balls[0] = ball;
      this.setBall(ball);
      this.runtime.mj.mj_forward(this.model, this.data);
      this.room.ballResetPending = false;
    }
    for (let i = 0; i < 4; i++) {
      updateServos(this);
      this.runtime.mj.mj_step(this.model, this.data);
    }
    this.releaseBoundaryBall();
    this.frame++;
    this.elapsed += CONTROL_DT;
    this.syncState();
    this.lastStepMs = performance.now() - start;
  }
  stepDance() {
    if (!this.danceSaved) {
      this.danceSaved = {
        qpos: new Float64Array(this.data.qpos),
        qvel: new Float64Array(this.data.qvel),
        goal: this.room.goal,
      };
      this.danceTime = 0;
    }
    this.danceTime += CONTROL_DT;
    const actors = [...this.room.players.values()];
    const blend = Math.min(1, this.danceTime);
    const ease = blend * blend * (3 - 2 * blend);
    this.data.qvel.fill(0);
    this.data.qvel.set(
      this.danceSaved.qvel.slice(this.ballV, this.ballV + 6),
      this.ballV,
    );
    actors.forEach((p, i) => {
      const slot = this.slots.get(p.id);
      const pose = dancePose(this.danceTime, i, actors.length);
      const b = slot.baseQ,
        start = this.danceSaved.qpos;
      this.data.qpos[b] = start[b] + (pose.x - start[b]) * ease;
      this.data.qpos[b + 1] = start[b + 1] + (-pose.z - start[b + 1]) * ease;
      const height = pose.height + (p.mode === "roller" ? 0.0135 : 0);
      this.data.qpos[b + 2] = start[b + 2] + (height - start[b + 2]) * ease;
      // Normalized shortest-arc blend keeps a smooth turn into the chorus line.
      const dot = pose.quat.reduce((n, v, j) => n + v * start[b + 3 + j], 0);
      const q = pose.quat.map(
        (v, j) => start[b + 3 + j] * (1 - ease) + v * ease * (dot < 0 ? -1 : 1),
      );
      const length = Math.hypot(...q);
      this.data.qpos.set(
        q.map((v) => v / length),
        b + 3,
      );
      slot.qpos.forEach((address, j) => {
        this.data.qpos[address] =
          start[address] + (pose.joints[j] - start[address]) * ease;
      });
      p.recovery = null;
      p.kick = 0;
    });
    this.runtime.mj.mj_forward(this.model, this.data);
    // Correct foot height using the actual sole mesh vertices after forward kinematics.
    // The dance is an authored interlude, but the feet still meet the real floor.
    for (const p of actors) {
      const slot = this.slots.get(p.id);
      let floor = Infinity;
      for (const geom of slot.feet) {
        const mesh = this.model.geom_dataid[geom];
        const start = this.model.mesh_vertadr[mesh];
        const count = this.model.mesh_vertnum[mesh];
        const matrix = this.data.geom_xmat;
        const origin = this.data.geom_xpos[geom * 3 + 2];
        for (let i = start; i < start + count; i++) {
          const vertex = this.model.mesh_vert;
          const z =
            origin +
            matrix[geom * 9 + 6] * vertex[i * 3] +
            matrix[geom * 9 + 7] * vertex[i * 3 + 1] +
            matrix[geom * 9 + 8] * vertex[i * 3 + 2];
          floor = Math.min(floor, z);
        }
      }
      if (Number.isFinite(floor))
        this.data.qpos[slot.baseQ + 2] += (0.001 - floor) * ease;
    }
    this.runtime.mj.mj_forward(this.model, this.data);
    const pose = dancePose(this.danceTime, 0, actors.length);
    this.room.dance = {
      time: this.danceTime,
      bpm: DANCE_BPM,
      beat: pose.beat,
      move: pose.move,
    };
    this.syncState();
  }
  endDance() {
    this.data.qpos.set(this.danceSaved.qpos);
    this.data.qvel.set(this.danceSaved.qvel);
    this.room.goal = this.danceSaved.goal;
    this.danceSaved = null;
    this.room.dance = null;
    this.runtime.mj.mj_forward(this.model, this.data);
  }
  releaseBoundaryBall() {
    const ball = this.readBall();
    if (ball.y > this.field.ballRadius + 0.035) return;
    const {
      halfLength: L,
      halfWidth: W,
      goalHalfWidth: G,
      ballRadius: R,
    } = this.field;
    // A gentle bumper releases slow balls from the boards without teleporting.
    const margin = R + 0.1;
    const nudge = (position, velocity, limit) => {
      const depth = Math.abs(position) - (limit - margin);
      if (depth <= 0 || Math.abs(velocity) > 0.22) return velocity;
      return (
        velocity -
        Math.sign(position) * Math.min(1, depth / 0.1) * 0.9 * CONTROL_DT
      );
    };
    this.data.qvel[this.ballV + 1] = -nudge(ball.z, ball.vz, W);
    if (Math.abs(ball.z) > G + R && Math.abs(ball.x) < L + R)
      this.data.qvel[this.ballV] = nudge(ball.x, ball.vx, L);
  }
  syncState() {
    const q = this.data.qpos,
      v = this.data.qvel;
    for (const p of this.room.players.values()) {
      const slot = this.slots.get(p.id);
      if (!slot) continue;
      const b = slot.baseQ;
      const quat = Array.from(q.slice(b + 3, b + 7));
      p.x = q[b];
      p.z = -q[b + 1];
      p.height = q[b + 2];
      p.quat = quat;
      p.yaw = poseYaw(quat);
      p.speed = Math.hypot(v[slot.baseV], v[slot.baseV + 1]);
      p.joints = slot.qpos.map((a) => q[a]);
      p.extraJoints = Object.fromEntries(
        slot.extra.map((e) => [e.name, q[e.q]]),
      );
      p.quack = Math.max(0, p.quack - CONTROL_DT);
    }
    const ball = this.readBall();
    if (!this.room.dancing)
      ball.cooldown = Math.max(0, ball.cooldown - CONTROL_DT);
    const goal =
      !this.room.dancing &&
      Math.abs(ball.x) > this.field.halfLength &&
      Math.abs(ball.z) < this.field.goalHalfWidth - this.field.ballRadius &&
      ball.y < this.field.goalHeight - this.field.ballRadius &&
      ball.cooldown === 0;
    if (goal) {
      const team = ball.x > 0 ? "blue" : "orange";
      this.room.scores[team]++;
      this.room.goal = { team, revision: ++this.room.revision };
      Object.assign(ball, {
        x: 0,
        z: 0,
        y: 0.08,
        vx: 0,
        vz: 0,
        vy: 0,
        quat: [1, 0, 0, 0],
        angular: [0, 0, 0],
        cooldown: 1.5,
      });
      this.setBall(ball);
      this.runtime.mj.mj_forward(this.model, this.data);
    }
    this.room.balls[0] = ball;
    this.room.engine = {
      name: "MuJoCo",
      version: this.runtime.engineVersion,
      actuator: "BAM M6 / XL330",
      policyHz: 50,
      physicsHz: 200,
      simulationTime: this.elapsed,
      contacts: this.data.ncon,
      stepMs: this.lastStepMs,
    };
  }
  dispose() {
    this.data?.delete();
    this.model?.delete();
    this.data = null;
    this.model = null;
  }
}
