import "./style.css";
import { assetUrl } from "./assets.js";
import { BrowserGame } from "./browser-game.js";
import { CameraTransition } from "./camera-transition.js";
import { createIslandWorld } from "./island-world.js";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  buildRig,
  cloneRig,
  setJoint,
  setJawOpen,
  groundFullBody,
} from "./duck-rig.js";
import { FIELD, BALL_COUNT } from "./simulation.js";
import { JOINT_NAMES } from "./physics/constants.js";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
let sceneKey =
  params.get("scene") === "little-world" ? "little-world" : "moon-base";
let entered = false,
  ready = false,
  loadError = null,
  myId = null,
  game = null,
  snapshot = null,
  freeCamera = false,
  following = true,
  sound = true,
  auto = false,
  spectator = false,
  dancing = false,
  dancePerforming = false,
  danceCamera = null,
  lastDanceBeat = -1,
  lastGoalRevision = 0,
  toastTimer,
  goalTimer;
const keys = new Set(),
  ducks = new Map(),
  balls = [],
  temporary = new THREE.Vector3(),
  clock = new THREE.Clock();
const homePose = {
  left_hip_yaw: 0,
  left_hip_roll: -0.087266,
  left_hip_pitch: -0.457924,
  left_knee: -0.00494,
  left_ankle: 0.452984,
  neck_pitch: 0.349066,
  head_pitch: 0.349066,
  head_yaw: 0,
  head_roll: 0,
  right_hip_yaw: 0,
  right_hip_roll: 0.087266,
  right_hip_pitch: 0.457924,
  right_knee: 0.00494,
  right_ankle: -0.452984,
};
let renderer,
  scene,
  camera,
  controls,
  cameraTransition,
  prototypeRig,
  rollerPrototypeRig,
  moonWorld,
  smallWorld,
  orbitPlanet;
let loadingProgress = 0;
function progress(p, text) {
  loadingProgress = Math.max(p, loadingProgress);
  $("#percent").textContent = `${Math.round(loadingProgress * 100)}%`;
  $("#progress-bar").style.width = `${loadingProgress * 100}%`;
  $(".progress").setAttribute(
    "aria-valuenow",
    Math.round(loadingProgress * 100),
  );
  $("#loading-message").textContent = text;
}
function toast(text, duration = 3000) {
  clearTimeout(toastTimer);
  $("#toast").textContent = text;
  $("#toast").classList.add("visible");
  toastTimer = setTimeout(
    () => $("#toast").classList.remove("visible"),
    duration,
  );
}
function send(value) {
  game?.send(value);
}
function safeStoredName() {
  try {
    return localStorage.getItem("microduck-name") || "";
  } catch {
    return "";
  }
}
function saveName(name) {
  try {
    localStorage.setItem("microduck-name", name);
  } catch {}
}
function modalInert(active) {
  for (const el of document.body.children)
    if (el.id !== "preflight" && el.tagName !== "SCRIPT") el.inert = active;
}
$("#player-name").value = safeStoredName() || "小鸭队长";
document.body.classList.add("preflight-active");
modalInert(true);
if (matchMedia("(max-width:720px)").matches) $("#keys").open = false;
$("#player-name").focus();
function material(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts });
}
function box(w, h, d, color, x, y, z, parent = scene, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    material(color, opts),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function line(points, color = 0xf1f0d9, width = 0.006, parent = scene) {
  for (let i = 1; i < points.length; i++) {
    if (points[i][1] <= 0.005 && points[i - 1][1] <= 0.005) {
      const a = new THREE.Vector3(...points[i - 1]),
        b = new THREE.Vector3(...points[i]),
        delta = b.clone().sub(a);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(a.distanceTo(b), width),
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
      );
      m.rotation.set(-Math.PI / 2, 0, -Math.atan2(delta.z, delta.x));
      m.position.copy(a).add(b).multiplyScalar(0.5);
      parent.add(m);
      continue;
    }
    const a = new THREE.Vector3(...points[i - 1]),
      b = new THREE.Vector3(...points[i]);
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(width / 2, width / 2, a.distanceTo(b), 5),
      material(color),
    );
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.sub(a).normalize(),
    );
    m.receiveShadow = true;
    parent.add(m);
  }
}
function makePitch() {
  const {
    halfLength: L,
    halfWidth: W,
    goalHalfWidth: G,
    goalHeight: H,
    goalDepth: D,
  } = FIELD;
  const court = new THREE.Group();
  court.name = "football-pitch";
  scene.add(court);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(L * 2, W * 2),
    material(0x487d70),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.001;
  floor.receiveShadow = true;
  floor.name = "little-world-pitch-floor";
  floor.visible = true;
  court.add(floor);
  const y = 0.003;
  line(
    [
      [-L, y, -W],
      [L, y, -W],
      [L, y, W],
      [-L, y, W],
      [-L, y, -W],
    ],
    0xf1f0d9,
    0.006,
    court,
  );
  line(
    [
      [0, y, -W],
      [0, y, W],
    ],
    0xf1f0d9,
    0.006,
    court,
  );
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.265, 0.273, 72),
    new THREE.MeshBasicMaterial({ color: 0xf1f0d9, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = y;
  court.add(ring);
  for (const sign of [-1, 1]) {
    const x = sign * L,
      back = x + sign * D,
      color = sign < 0 ? 0xb8d9e9 : 0xf2c492;
    line(
      [
        [x - sign * 0.44, y, -0.55],
        [x - sign * 0.44, y, 0.55],
        [x, y, 0.55],
      ],
      0xf1f0d9,
      0.005,
      court,
    );
    line(
      [
        [x, y, -0.55],
        [x - sign * 0.44, y, -0.55],
      ],
      0xf1f0d9,
      0.005,
      court,
    );
    for (const z of [-G, G]) {
      box(0.025, H, 0.025, color, x, H / 2, z, court);
      line(
        [
          [x, H, z],
          [back, H, z],
          [back, 0.005, z],
        ],
        color,
        0.009,
        court,
      );
      line(
        [
          [x, 0.005, z],
          [back, 0.005, z],
        ],
        color,
        0.009,
        court,
      );
    }
    box(0.025, 0.025, G * 2 + 0.025, color, x, H, 0, court);
    line(
      [
        [back, H, -G],
        [back, H, G],
      ],
      color,
      0.007,
      court,
    );
    for (let z = -G; z <= G + 0.001; z += 0.045)
      line(
        [
          [back, 0.003, z],
          [back, H, z],
        ],
        0xc4d4c0,
        0.0012,
        court,
      );
    for (let h = 0.04; h < H; h += 0.04) {
      line(
        [
          [back, h, -G],
          [back, h, G],
        ],
        0xc4d4c0,
        0.0012,
        court,
      );
      for (const z of [-G, G])
        line(
          [
            [x, h, z],
            [back, h, z],
          ],
          0xc4d4c0,
          0.0012,
          court,
        );
    }
  }
  // Low ball boards leave the robot's larger run-off lane open.
  for (const sign of [-1, 1]) {
    box(2 * L, 0.035, 0.018, 0x99b2b0, 0, 0.0175, sign * (W + 0.012), court);
    for (const side of [-1, 1])
      box(
        0.018,
        0.035,
        W - G,
        0x99b2b0,
        sign * (L + 0.012),
        0.0175,
        (side * (W + G)) / 2,
        court,
      );
    box(
      2 * (L + D + FIELD.runoff),
      0.055,
      0.03,
      0x718d98,
      0,
      0.0275,
      sign * (W + FIELD.runoff),
      court,
    );
    box(
      0.03,
      0.055,
      2 * (W + FIELD.runoff),
      0x718d98,
      sign * (L + D + FIELD.runoff),
      0.0275,
      0,
      court,
    );
  }
}
function football() {
  const group = new THREE.Group();
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 24, 18),
    material(0xf6f6f3, { roughness: 0.9 }),
  );
  sphere.castShadow = true;
  sphere.receiveShadow = true;
  group.add(sphere);
  const icosa = new THREE.IcosahedronGeometry(1, 0);
  const pos = icosa.attributes.position;
  const directions = new Map();
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i).normalize();
    directions.set(
      v
        .toArray()
        .map((n) => n.toFixed(3))
        .join(","),
      v,
    );
  }
  const patchMat = material(0x373a49);
  for (const v of directions.values()) {
    const patch = new THREE.Mesh(new THREE.CircleGeometry(0.0105, 5), patchMat);
    patch.position.copy(v).multiplyScalar(0.05005);
    patch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v);
    group.add(patch);
  }
  scene.add(group);
  return group;
}
function createLittleWorld() {
  const g = createIslandWorld();
  scene.add(g);
  return g;
}
function createMoonWorld() {
  const g = new THREE.Group();
  g.name = "moon-base";
  const dust = material(0x74869a, { flatShading: true });
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(5.8, 5.2, 0.6, 56),
    dust,
  );
  base.position.y = -0.31;
  base.receiveShadow = true;
  g.add(base);
  // The striped deck and its open run-off lane sit at the same physical height.
  box(4.25, 0.05, 2.65, 0x587b80, 0, -0.026, 0, g);
  for (let i = -7; i <= 7; i++) {
    box(0.18, 0.002, 2.45, i % 2 ? 0x65888a : 0x5c8183, i * 0.27, 0.0001, 0, g);
  }
  const makeCrater = (x, z, radius) => {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(radius, radius * 0.17, 6, 16),
      dust,
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, 0.015, z);
    rim.receiveShadow = true;
    g.add(rim);
    const basin = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.86, 20),
      material(0x657c8d),
    );
    basin.rotation.x = -Math.PI / 2;
    basin.position.set(x, 0.002, z);
    g.add(basin);
  };
  for (let i = 0; i < 18; i++) {
    const a = i * 2.399,
      r = 3.4 + (i % 4) * 0.85;
    makeCrater(Math.cos(a) * r, Math.sin(a) * r, 0.15 + (i % 3) * 0.09);
  }
  // A toy rocket: enamel body, porthole and three sturdy coral fins.
  const rocket = new THREE.Group();
  rocket.position.set(-2.7, 0, -1.9);
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.19, 0.8, 16),
    material(0xfff2db),
  );
  shell.position.y = 0.65;
  shell.castShadow = true;
  rocket.add(shell);
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.19, 0.4, 16),
    material(0xe98059),
  );
  nose.position.y = 1.25;
  rocket.add(nose);
  const window = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.095, 0.035, 24),
    material(0x35546e, { metalness: 0.35, roughness: 0.25 }),
  );
  window.rotation.x = Math.PI / 2;
  window.position.set(0, 0.77, 0.19);
  rocket.add(window);
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.5, 3),
      material(0xe98059),
    );
    const a = (i * Math.PI * 2) / 3;
    fin.position.set(Math.sin(a) * 0.21, 0.28, Math.cos(a) * 0.21);
    fin.castShadow = true;
    rocket.add(fin);
  }
  g.add(rocket);
  // A small observatory and a faceted solar array beyond the orange goal.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.53, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    material(0xe9dcc2),
  );
  dome.position.set(2.9, 0.12, -2.1);
  dome.castShadow = true;
  g.add(dome);
  box(1.12, 0.12, 1.12, 0x557c88, 2.9, 0.06, -2.1, g);
  box(0.23, 0.28, 0.025, 0x35546e, 2.9, 0.14, -1.57, g);
  for (const x of [2.35, 3.1]) {
    box(0.04, 0.33, 0.04, 0xc1d0d3, x, 0.16, -0.95, g);
    const panel = box(0.62, 0.025, 0.42, 0x294c70, x, 0.35, -0.95, g);
    panel.rotation.x = -0.28;
    for (let j = -1; j <= 1; j++)
      box(0.012, 0.027, 0.43, 0x7aa8b9, x + j * 0.15, 0.367, -0.95, g);
  }
  // Seats are little robot spectators, well outside the playing surface.
  for (let side of [-1, 1]) {
    box(2.2, 0.12, 0.25, 0xd3bda1, -0.2, 0.06, side * 1.9, g);
    for (let i = 0; i < 8; i++) {
      const x = -0.99 + i * 0.23;
      box(
        0.12,
        0.15,
        0.12,
        i % 2 ? 0xe5a177 : 0xa4c3d2,
        x,
        0.195,
        side * 1.9,
        g,
      );
      box(0.075, 0.025, 0.02, 0x354c61, x, 0.21, side * 1.83, g);
    }
  }
  const planet = new THREE.Group();
  planet.position.set(-2.5, 1.8, -3.8);
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.65, 32, 24),
    material(0xdea96d, { roughness: 0.9 }),
  );
  planet.add(orb);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1.12, 80),
    new THREE.MeshBasicMaterial({
      color: 0xb9d3d5,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    }),
  );
  ring.rotation.set(Math.PI * 0.38, 0.18, 0.25);
  planet.add(ring);
  orbitPlanet = planet;
  g.add(planet);
  const starPositions = [];
  for (let i = 0; i < 160; i++) {
    const a = i * 2.39996,
      y = 3 + ((i * 17) % 70) / 5,
      radius = 22 + (i % 7);
    starPositions.push(Math.cos(a) * radius, y, Math.sin(a) * radius);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(starPositions, 3),
  );
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      color: 0xffefcf,
      size: 0.045,
      sizeAttenuation: true,
      fog: false,
    }),
  );
  g.add(stars);
  g.visible = false;
  scene.add(g);
  return g;
}

const robotMaterial = (name, body, rgba) => {
  if (name === "lens.stl")
    return { color: [0.01, 0.012, 0.02], roughness: 0.05 };
  if (/noenoeil|soft_mouth_top|jaw_soft/.test(name))
    return { color: [1, 0.413, 0.007], roughness: 0.4 };
  if (/bottom_head_shell|^jaw\.stl|foot_|ankle_/.test(name))
    return { color: [1, 0.144, 0.008], roughness: 0.45 };
  if (/sole_/.test(name)) return { color: [1, 0.608, 0.021], roughness: 0.4 };
  if (
    /top_head_shell|left_shell|right_shell|trunk_base|upper_leg_.*\.stl/.test(
      name,
    )
  )
    return { color: [0.888, 0.86, 0.798], roughness: 0.35 };
  if (/m12_lens_holder|xl330|yaw2roll|battery|speaker|noen/.test(name))
    return { color: [0.012, 0.012, 0.014], roughness: 0.55, metalness: 0.3 };
  if (/neck|leg\.stl|support|bearing/.test(name))
    return { color: [0.256, 0.256, 0.279], roughness: 0.5, metalness: 0.35 };
  return { color: rgba.slice(0, 3), roughness: 0.7 };
};
async function initialize() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x172d43);
  scene.fog = new THREE.Fog(0x172d43, 18, 65);
  camera = new THREE.PerspectiveCamera(
    52,
    innerWidth / innerHeight,
    0.008,
    1000,
  );
  camera.position.set(1.9, 2.077, 2.3);
  camera.zoom = Math.min(1, Math.max(0.52, innerWidth / innerHeight / 1.18));
  camera.updateProjectionMatrix();
  renderer = new THREE.WebGLRenderer({
    canvas: $("#world"),
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.177, 0);
  cameraTransition = new CameraTransition(camera, controls);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.28;
  controls.maxDistance = 14;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.enablePan = false;
  controls.update();
  controls.addEventListener("start", () => {
    following = false;
  });
  scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x4d453a, 1.7));
  const sun = new THREE.DirectionalLight(0xffefd7, 3.0);
  sun.position.set(-2, 5, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -3;
  sun.shadow.camera.right = 3;
  sun.shadow.camera.top = 3;
  sun.shadow.camera.bottom = -3;
  sun.shadow.camera.near = 0.01;
  sun.shadow.camera.far = 12;
  sun.shadow.bias = -0.00015;
  sun.shadow.normalBias = 0.003;
  scene.add(sun);
  makePitch();
  smallWorld = createLittleWorld();
  moonWorld = createMoonWorld();
  for (let i = 0; i < BALL_COUNT; i++)
    balls.push({
      mesh: football(),
      last: new THREE.Vector3(),
      target: new THREE.Vector3(0, 0.05, 0),
    });
  progress(0.35, "球场已就绪，正在装配机器鸭…");
  const loadingDuck = fetch(assetUrl("assets/robot/kinematics.json"))
    .then((r) => {
      if (!r.ok) throw new Error("机器人装配数据加载失败");
      return r.json();
    })
    .then((k) =>
      buildRig(
        { ...k, mesh_dir: assetUrl("assets/robot/meshes") },
        {
          materialForMesh: robotMaterial,
        },
      ),
    )
    .then((rig) => {
      prototypeRig = rig;
      for (const [name, value] of Object.entries(homePose))
        setJoint(rig, name, value);
      groundFullBody(rig, 0.002);
      rig.baseY = rig.placer.position.y;
      rig.placer.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
    });
  const loadingRoller = fetch(assetUrl("assets/robot/kinematics_rollers.json"))
    .then((r) => {
      if (!r.ok) throw new Error("滚轮模型加载失败");
      return r.json();
    })
    .then((k) => {
      k.mesh_dir = assetUrl("assets/robot/meshes");
      return buildRig(k, { materialForMesh: robotMaterial });
    })
    .then((rig) => {
      rollerPrototypeRig = rig;
      for (const [name, value] of Object.entries(homePose))
        setJoint(rig, name, value);
      rig.placer.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
    });
  renderer.setAnimationLoop(render);
  await Promise.all([loadingDuck, loadingRoller]);
  setScene(sceneKey, false);
  progress(0.35, "机器鸭已就绪，正在准备比赛…");
  ready = true;
}
const loadPromise = initialize().catch((error) => {
  console.error(error);
  loadError = error;
  $("#loading-message").textContent =
    `加载失败：${error.message}。请检查本地资源后重试。`;
  $("#retry").hidden = false;
  return false;
});
function setScene(key, update = true) {
  sceneKey = key;
  if (moonWorld) moonWorld.visible = key === "moon-base";
  if (smallWorld) smallWorld.visible = key === "little-world";
  const floor = scene.getObjectByName("little-world-pitch-floor");
  if (floor)
    floor.material.color.set(key === "moon-base" ? 0x487d70 : 0x78a16e);
  scene.background.set(key === "moon-base" ? 0x172d43 : 0x9dbbca);
  scene.fog.color.copy(scene.background);
  document.body.dataset.scene = key;
  $$("[data-scene]").forEach((b) => {
    const active = b.dataset.scene === key;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", active);
  });
  document.title = `小鸭开球！ · ${key === "moon-base" ? "月球基地" : "浮空小岛"}`;
  if (update) {
    params.set("scene", key);
    params.delete("room");
    history.replaceState(null, "", `?${params}`);
    toast(
      key === "moon-base" ? "抵达月球基地，开球！" : "抵达浮空小岛，开球！",
    );
  }
}
function makeDuck(player) {
  const rig = cloneRig(
    player.mode === "roller" ? rollerPrototypeRig : prototypeRig,
  );
  const group = rig.placer;
  group.position.set(player.x, 0, player.z);
  group.rotation.y = 0;
  scene.add(group);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.105, 0.13, 48),
    new THREE.MeshBasicMaterial({
      color: player.team === "blue" ? 0x8ed4f8 : 0xffbc70,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(player.x, 0.005, player.z);
  scene.add(ring);
  const label = document.createElement("div");
  label.className = "player-label";
  const relation = document.createElement("small"),
    name = document.createElement("span");
  label.append(relation, name);
  $("#labels").append(label);
  const duck = {
    rig,
    ring,
    label,
    relation,
    name,
    data: player,
    rigMode: player.mode,
    angles: [...(player.joints || Object.values(homePose))],
    bodyQuat: new THREE.Quaternion(),
  };
  ducks.set(player.id, duck);
  return duck;
}
function updateSceneState(state) {
  snapshot = state;
  updateDanceUI(state.dance);
  const seen = new Set();
  for (const player of state.players) {
    seen.add(player.id);
    let d = ducks.get(player.id);
    if (d && d.rigMode !== player.mode) {
      scene.remove(d.rig.placer, d.ring);
      d.label.remove();
      d.ring.geometry.dispose();
      d.ring.material.dispose();
      ducks.delete(player.id);
      d = null;
    }
    d ||= makeDuck(player);
    const previousRecovery = d.data?.recovery;
    d.data = player;
    if (player.id === myId && player.recovery && !previousRecovery)
      toast("小鸭失去平衡，正在自主起身…", 3500);
    d.ring.material.color.set(player.team === "blue" ? 0x8ed4f8 : 0xffbc70);
    d.ring.visible = !player.spectator;
    d.label.classList.toggle("orange", player.team === "orange");
    const mine = player.id === myId;
    d.name.textContent = mine ? "你" : player.name;
    d.label.hidden = false;
    d.label.classList.toggle("mine", mine);
    d.relation.textContent = mine
      ? ""
      : player.spectator
        ? "观众"
        : player.team === state.players.find((p) => p.id === myId)?.team
          ? "队友"
          : "对手";
    if (mine) {
      $("#player-handle").textContent = player.name;
      $("#player-team").textContent = player.spectator
        ? " · 观众"
        : ` · ${player.team === "blue" ? "蓝色" : "橙色"}队`;
      $("#player-team").classList.toggle("orange", player.team === "orange");
      $("#you-blue").hidden = player.team !== "blue";
      $("#you-orange").hidden = player.team !== "orange";
      $("#switch-team").textContent =
        player.team === "blue" ? "换到橙队" : "换到蓝队";
      auto = player.auto;
      spectator = player.spectator;
      $("#autoplay").setAttribute("aria-pressed", auto);
      $("#autoplay").textContent = auto ? "接管小鸭" : "自动踢球";
      $$("[data-mode]").forEach((b) => {
        const active = b.dataset.mode === player.mode;
        b.classList.toggle("active", active);
        b.setAttribute("aria-pressed", active);
      });
    }
  }
  for (const [id, d] of ducks)
    if (!seen.has(id)) {
      scene.remove(d.rig.placer, d.ring);
      d.label.remove();
      d.ring.geometry.dispose();
      d.ring.material.dispose();
      ducks.delete(id);
    }
  state.balls.forEach((b, i) => {
    if (!balls[i]) return;
    balls[i].target.set(b.x, b.y, b.z);
    if (b.quat)
      balls[i].targetQuat = new THREE.Quaternion(
        b.quat[1],
        b.quat[3],
        -b.quat[2],
        b.quat[0],
      );
  });
  $("#score-blue").textContent = state.scores.blue;
  $("#score-orange").textContent = state.scores.orange;
  $("#ai").checked = state.ai;
  $("#connection-text").textContent = state.ai
    ? "单人游玩 · 机器鸭陪练"
    : "单人游玩 · 自由练习";
  if (state.goal && state.goal.revision > lastGoalRevision) {
    lastGoalRevision = state.goal.revision;
    showGoal(state.goal.team);
  }
}
async function connect() {
  game?.dispose();
  game = new BrowserGame();
  $("#connection-text").textContent = "正在准备比赛";
  game.onState = updateSceneState;
  game.onError = (error) => {
    loadError = error;
    $(".status-dot").classList.add("offline");
    $("#connection-text").textContent = "准备失败，请重新加载";
    $("#loading-message").textContent =
      `加载失败：${error.message}。请重新加载球场。`;
    $("#retry").hidden = false;
    if (entered) toast("游戏运行中断，请刷新页面后重试。", 6000);
  };
  const id = await game.start($("#player-name").value.trim(), (p, text) =>
    progress(0.35 + p * 0.65, text),
  );
  myId = id;
  lastGoalRevision = 0;
  $(".status-dot").classList.remove("offline");
  $("#scoreboard").hidden = false;
}
function updateDanceUI(dance) {
  const active = !!dance;
  if (active !== dancing) {
    dancing = active;
    keys.clear();
    $("#dance-action").setAttribute("aria-pressed", active);
    $("#dance-action span").textContent = active ? "返回比赛" : "一起跳舞";
    $("#dance-banner").hidden = !active;
    document.body.classList.toggle("dancing", active);
    for (const el of $$(
      "[data-mode],#ai,#switch-team,#autoplay,#camera,#kick-action,#touch-kick",
    ))
      el.disabled = active;
    if (active) {
      lastDanceBeat = -1;
      danceCamera = {
        position: camera.position.clone(),
        target: controls.target.clone(),
        following,
        freeCamera,
        offset: camera.position.clone().sub(controls.target),
      };
      following = false;
      dancePerforming = false;
      const offset = danceCamera.offset.clone();
      if (offset.length() < 3.2) offset.setLength(3.2);
      offset.y = Math.max(1.6, offset.y);
      const target = new THREE.Vector3(0, 0.177, 0);
      cameraTransition.start({
        offset, target,
        zoom: () => Math.min(1, Math.max(0.52, camera.aspect / 1.18)),
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 0.65,
      });
    } else if (danceCamera) {
      const saved = danceCamera;
      following = saved.following;
      freeCamera = saved.freeCamera;
      const target = following ? () => {
        const mine = ducks.get(myId);
        const position = mine?.rig.placer.position;
        const player = snapshot?.players.find(p => p.id === myId);
        return new THREE.Vector3(position?.x ?? player?.x ?? 0, 0.177, position?.z ?? player?.z ?? 0);
      } : saved.target;
      cameraTransition.start({
        position: saved.position, target,
        offset: following ? saved.offset : null,
        zoom: () => Math.min(1, Math.max(0.52, camera.aspect / 1.18)),
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 0.55,
      });
      danceCamera = null;
    }
    camera.updateProjectionMatrix();
    controls.update();
  }
  if (!dance) return;
  const performing = dance.phase === "dancing";
  if (performing && !dancePerforming) {
    dancePerforming = true;
    cameraTransition.start({
      position: new THREE.Vector3(0, 0.85, 2.15),
      target: new THREE.Vector3(0, 0.18, -0.12),
      zoom: () => Math.min(1, Math.max(0.55, camera.aspect / 0.9)),
      duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 0.7,
    });
  }
  $("#dance-move").textContent = !performing
    ? dance.phase === "settling" ? "站稳了，准备开跳" : `正在集合 · ${dance.ready}/${dance.total} 就位`
    : dance.move;
  const beat = Math.floor(dance.beat);
  if (performing && beat !== lastDanceBeat) {
    lastDanceBeat = beat;
    if (sound) playDanceBeat(beat);
  }
}
function playDanceBeat(beat) {
  // Original, locally synthesized rhythm; no downloaded music or audio requests.
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    const osc = audioContext.createOscillator(),
      gain = audioContext.createGain();
    const now = audioContext.currentTime;
    osc.type = beat % 2 ? "triangle" : "sine";
    osc.frequency.setValueAtTime(beat % 2 ? 480 : 120, now);
    osc.frequency.exponentialRampToValueAtTime(beat % 2 ? 220 : 45, now + 0.12);
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  } catch {}
}
function showGoal(team) {
  clearTimeout(goalTimer);
  $("#goal").hidden = false;
  $("#goal span").textContent =
    `${team === "blue" ? "蓝队" : "橙队"}得分 · 重新开球`;
  goalTimer = setTimeout(() => ($("#goal").hidden = true), 2200);
  if (sound) playTone([523, 659, 784], 0.16);
}
let audioContext;
function playTone(notes, duration = 0.07) {
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    notes.forEach((f, i) => {
      const osc = audioContext.createOscillator(),
        gain = audioContext.createGain(),
        start = audioContext.currentTime + i * duration;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(f, start);
      osc.frequency.exponentialRampToValueAtTime(f * 0.6, start + duration);
      gain.gain.setValueAtTime(0.045, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start(start);
      osc.stop(start + duration);
    });
  } catch {}
}
function quack() {
  if (!entered) return;
  send({ type: "quack" });
  if (sound) playTone([560, 380, 460], 0.07);
}
let cameraOffset = new THREE.Vector3(1.9, 1.9, 2.3),
  lastTarget = new THREE.Vector3(),
  inputTime = 0;
function render() {
  if (!renderer) return;
  const dt = Math.min(clock.getDelta(), 0.05),
    time = clock.elapsedTime;
  if (orbitPlanet && !matchMedia("(prefers-reduced-motion: reduce)").matches)
    orbitPlanet.rotation.y = time * 0.025;
  for (const duck of ducks.values()) {
    const p = duck.data,
      group = duck.rig.placer;
    const f = 1 - Math.exp(-dt * 60);
    group.position.x = THREE.MathUtils.lerp(group.position.x, p.x, f);
    group.position.z = THREE.MathUtils.lerp(group.position.z, p.z, f);
    group.position.y = 0;
    group.rotation.y = 0;
    duck.rig.root.rotation.y = 0;
    const trunk = duck.rig.bodies.get("trunk_base");
    trunk.position.set(
      0,
      0,
      THREE.MathUtils.lerp(trunk.position.z, p.height ?? 0.12, f),
    );
    if (p.quat) {
      duck.bodyQuat.set(p.quat[1], p.quat[2], p.quat[3], p.quat[0]);
      trunk.quaternion.slerp(duck.bodyQuat, f);
    }
    if (p.joints)
      JOINT_NAMES.forEach((name, j) => {
        duck.angles[j] = THREE.MathUtils.lerp(duck.angles[j], p.joints[j], f);
        setJoint(duck.rig, name, duck.angles[j]);
      });
    if (p.extraJoints)
      for (const [name, value] of Object.entries(p.extraJoints))
        setJoint(duck.rig, name, value);
    setJawOpen(duck.rig, p.quack > 0 ? Math.min(1, p.quack * 4) : 0);
    duck.ring.position.set(group.position.x, 0.005, group.position.z);
    const v = temporary
      .set(group.position.x, 0.35 + group.position.y, group.position.z)
      .project(camera);
    duck.label.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
    duck.label.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
    duck.label.style.display =
      v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 ? "" : "none";
  }
  if (!dancing) {
    const occupied = [];
    const labels = [...ducks.values()].sort(
      (a, b) => Number(b.data.id === myId) - Number(a.data.id === myId),
    );
    for (const duck of labels) {
      if (duck.label.style.display === "none") continue;
      if (innerWidth <= 720 && duck.data.id !== myId) {
        duck.label.style.display = "none";
        continue;
      }
      const rect = duck.label.getBoundingClientRect();
      if (
        occupied.some(
          (r) =>
            rect.left < r.right + 8 &&
            rect.right > r.left - 8 &&
            rect.top < r.bottom + 6 &&
            rect.bottom > r.top - 6,
        )
      )
        duck.label.style.display = "none";
      else occupied.push(rect);
    }
  }
  for (const ball of balls) {
    ball.last.copy(ball.mesh.position);
    ball.mesh.position.lerp(ball.target, 1 - Math.exp(-dt * 60));
    if (ball.targetQuat)
      ball.mesh.quaternion.slerp(ball.targetQuat, 1 - Math.exp(-dt * 60));
  }
  const mine = ducks.get(myId);
  if (mine && entered) {
    if (freeCamera && !dancing && !cameraTransition.active) {
      const movement = new THREE.Vector3();
      camera.getWorldDirection(movement);
      movement.y = 0;
      movement.normalize();
      const side = new THREE.Vector3().crossVectors(
        movement,
        new THREE.Vector3(0, 1, 0),
      );
      const speed = dt * (keys.has("ShiftLeft") ? 3 : 1);
      const direction =
        (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
        (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
      const strafe =
        (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
        (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
      const delta = movement
        .multiplyScalar(direction * speed)
        .add(side.multiplyScalar(strafe * speed));
      if (keys.has("KeyQ")) delta.y -= speed;
      if (keys.has("KeyE")) delta.y += speed;
      camera.position.add(delta);
      controls.target.add(delta);
    } else if (following && !dancing && !cameraTransition.active) {
      const target = new THREE.Vector3(
        mine.rig.placer.position.x,
        0.177,
        mine.rig.placer.position.z,
      );
      const delta = target.clone().sub(controls.target);
      camera.position.add(delta);
      controls.target.copy(target);
      lastTarget.copy(target);
    }
    inputTime += dt;
    if (inputTime > 1 / 50) {
      inputTime = 0;
      sendInput();
    }
  }
  cameraTransition.update(dt);
  controls.update();
  renderer.render(scene, camera);
}
function sendInput() {
  if (!entered) return;
  const blocked = dancing || freeCamera || !$("#preflight").hidden;
  send({
    type: "input",
    forward: blocked
      ? 0
      : (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
        (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0),
    turn: blocked
      ? 0
      : (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) -
        (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0),
  });
}
function resumeFollow() {
  if (dancing) return;
  following = true;
  freeCamera = false;
  document.body.classList.remove("free");
  $("#camera").setAttribute("aria-pressed", false);
  $("#camera span").textContent = "自由视角";
  const mine = ducks.get(myId);
  if (mine) {
    controls.target.set(mine.data.x, 0.177, mine.data.z);
    camera.position.copy(controls.target).add(cameraOffset);
  }
  toast("已恢复小鸭跟随视角");
}
async function enterGame(event) {
  event.preventDefault();
  const name = $("#player-name").value.trim();
  if (name.length < 2) {
    $("#name-error").textContent = "请输入 2–24 个字符的玩家姓名。";
    $("#player-name").setAttribute("aria-invalid", "true");
    $("#player-name").focus();
    return;
  }
  $("#player-name").removeAttribute("aria-invalid");
  $("#name-error").textContent = "";
  saveName(name);
  $("#name-state").hidden = true;
  $("#loading-state").hidden = false;
  await loadPromise;
  if (loadError) return;
  if (entered) {
    send({ type: "rename", name });
  } else {
    try {
      await connect();
    } catch {
      return;
    }
    entered = true;
  }
  $("#preflight").classList.add("dismissed");
  document.body.classList.remove("preflight-active");
  setTimeout(() => {
    $("#preflight").hidden = true;
    modalInert(false);
    $("#world").tabIndex = 0;
    $("#world").focus();
  }, 180);
}
$("#name-form").addEventListener("submit", enterGame);
$("#retry").addEventListener("click", () => location.reload());
function rename() {
  keys.clear();
  modalInert(true);
  $("#preflight").hidden = false;
  $("#preflight").classList.remove("dismissed");
  $("#name-state").hidden = false;
  $("#loading-state").hidden = true;
  document.body.classList.add("preflight-active");
  $("#player-name").focus();
  $("#player-name").select();
}
$("#rename").onclick = rename;
$("#profile").onclick = rename;
$$("[data-scene]").forEach(
  (b) => (b.onclick = () => setScene(b.dataset.scene)),
);
$$("[data-mode]").forEach(
  (b) =>
    (b.onclick = () => {
      send({ type: "mode", mode: b.dataset.mode });
      toast(
        b.dataset.mode === "walk"
          ? "行走模式"
          : "滚轮模式 · 速度更快，转弯更柔和",
      );
    }),
);
$("#autoplay").onclick = () => {
  send({ type: "auto", value: !auto });
  toast(
    auto ? "已接管，使用 WASD 控制" : "自动踢球已开启，点“接管小鸭”可恢复手动",
  );
};
$("#ai").onchange = (e) => send({ type: "ai", value: e.target.checked });
$("#switch-team").onclick = () => send({ type: "team" });
$("#sound").onclick = () => {
  sound = !sound;
  $("#sound").textContent = `声音：${sound ? "开" : "关"}`;
  $("#sound").setAttribute("aria-pressed", sound);
};
$("#camera").onclick = () => {
  if (dancing) return;
  if (freeCamera) {
    resumeFollow();
    return;
  }
  freeCamera = true;
  following = false;
  document.body.classList.add("free");
  $("#camera").setAttribute("aria-pressed", true);
  $("#camera span").textContent = "跟随小鸭";
  toast("自由视角：WASD 移动，Q / E 升降，拖动环顾");
};
$("#kick-action").onclick = () => send({ type: "kick" });
$("#dance-action").onclick = () => send({ type: "dance" });
function resetMatch() {
  send({ type: "reset" });
  toast("小鸭与足球已归位，重新开球！");
}
$("#reset-action").onclick = resetMatch;
addEventListener("keydown", (e) => {
  if (
    e.target.matches?.(
      "input:not([type=checkbox]):not([type=radio]),textarea,[contenteditable=true]",
    ) ||
    !entered ||
    !$("#preflight").hidden
  )
    return;
  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
      e.code,
    )
  )
    e.preventDefault();
  keys.add(e.code);
  sendInput();
  if (e.repeat) return;
  if (e.code === "KeyX") {
    send({ type: "dance" });
    return;
  }
  if (dancing && !["Space", "Escape"].includes(e.code)) return;
  if (e.code === "Space") {
    resetMatch();
  }
  if (e.code === "KeyE" && !freeCamera) {
    send({ type: "spectator" });
    toast(spectator ? "已加入球场" : "观众模式 · 可在球场外自由漫游");
  }
  if (e.code === "KeyM") quack();
  if (e.code === "KeyF") send({ type: "kick" });
  if (e.code === "KeyC") resumeFollow();
  if (e.code === "Escape") {
    $("#keys").open = !$("#keys").open;
  }
  if (
    [
      "KeyW",
      "KeyS",
      "KeyA",
      "KeyD",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ].includes(e.code) &&
    auto &&
    !freeCamera
  ) {
    send({ type: "auto", value: false });
  }
});
addEventListener("keyup", (e) => {
  keys.delete(e.code);
  sendInput();
});
addEventListener("blur", () => {
  keys.clear();
  send({ type: "input", forward: 0, turn: 0 });
});
document.addEventListener("visibilitychange", () => {
  game?.send({ type: "pause", value: document.hidden });
  if (document.hidden) {
    keys.clear();
    send({ type: "input", forward: 0, turn: 0 });
  }
});
$$("[data-key]").forEach((b) => {
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    keys.add(b.dataset.key);
    sendInput();
    if (auto) send({ type: "auto", value: false });
  });
  const release = () => {
    keys.delete(b.dataset.key);
    sendInput();
  };
  b.addEventListener("pointerup", release);
  b.addEventListener("pointercancel", release);
  b.addEventListener("lostpointercapture", release);
});
$("#touch-quack").onclick = quack;
$("#touch-kick").onclick = () => send({ type: "kick" });
addEventListener("resize", () => {
  if (!renderer) return;
  camera.aspect = innerWidth / innerHeight;
  camera.zoom = dancing
    ? Math.min(1, Math.max(0.55, camera.aspect / 0.9))
    : Math.min(1, Math.max(0.52, camera.aspect / 1.18));
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
});
// Read-only diagnostics used by the smoke tests and useful during local development.
window.microduck = {
  get state() {
    return snapshot;
  },
  get id() {
    return myId;
  },
  get ready() {
    return ready;
  },
  get renderer() {
    return renderer;
  },
  get scene() {
    return scene;
  },
};

$("#preflight").addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return;
  const items = [
    ...$("#preflight").querySelectorAll(
      "input:not([disabled]),button:not([disabled]),a[href]",
    ),
  ].filter((el) => el.getClientRects().length);
  if (!items.length) {
    e.preventDefault();
    return;
  }
  if (e.shiftKey && document.activeElement === items[0]) {
    e.preventDefault();
    items.at(-1).focus();
  } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
    e.preventDefault();
    items[0].focus();
  }
});
