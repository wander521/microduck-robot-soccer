import { readFile, writeFile, mkdir } from "node:fs/promises";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { geometryToBinaryStl } from "../src/duck-rig.js";
import { DOMParser } from "@xmldom/xmldom";
const buffer = await readFile("public/assets/robot/microduck.glb");
const gltf = await new GLTFLoader().parseAsync(
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  "",
);
const geometries = new Map();
gltf.scene.traverse((o) => {
  if (o.isMesh) geometries.set(o.userData.meshFile || o.name, o.geometry);
});
const needed = new Set();
for (const file of [
  "robot_allcollisions.xml",
  "robot_allcollisions_rollers.xml",
]) {
  const doc = new DOMParser().parseFromString(
    await readFile("public/assets/robot/" + file, "utf8"),
    "text/xml",
  );
  for (const g of [...doc.getElementsByTagName("geom")])
    if (g.getAttribute("mesh") && g.getAttribute("class") !== "visual")
      needed.add(g.getAttribute("mesh") + ".stl");
}
await mkdir("public/assets/robot/meshes", { recursive: true });
for (const name of needed) {
  const geometry = geometries.get(name);
  if (geometry) {
    await writeFile(
      "public/assets/robot/meshes/" + name,
      new Uint8Array(geometryToBinaryStl(geometry)),
    );
    console.log("Prepared", name);
  } else console.log("External mesh needed:", name);
}
const kin = JSON.parse(
  await readFile("public/assets/robot/kinematics_rollers.json", "utf8"),
);
console.log("Roller visual extras:", [
  ...new Set(
    kin.bodies
      .flatMap((b) => b.geoms.map((g) => g.mesh))
      .filter((n) => n && !geometries.has(n)),
  ),
]);
