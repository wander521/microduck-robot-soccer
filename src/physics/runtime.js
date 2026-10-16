import { DOMParser } from "@xmldom/xmldom";
const elements = (node, tag) => [...node.getElementsByTagName(tag)];
function physicsTemplate(xml) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  for (const geom of elements(doc, "geom"))
    if (geom.getAttribute("class") === "visual")
      geom.parentNode.removeChild(geom);
  return doc;
}
export async function createPhysicsRuntime({
  mj,
  ort,
  readText,
  readBinary,
  createPolicy,
  onProgress = () => {},
}) {
  const [walkXml, rollerXml] = await Promise.all([
    readText("robot/robot_allcollisions.xml"),
    readText("robot/robot_allcollisions_rollers.xml"),
  ]);
  const templates = {
    walk: physicsTemplate(walkXml),
    roller: physicsTemplate(rollerXml),
  };
  const used = new Set(
    Object.values(templates).flatMap((doc) =>
      elements(doc, "geom")
        .map((g) => g.getAttribute("mesh"))
        .filter(Boolean),
    ),
  );
  const vfs = new mj.MjVFS();
  const meshes = await Promise.all(
    [...used].map(async (name) => [
      name,
      await readBinary(`robot/meshes/${name}.stl`),
    ]),
  );
  for (const [name, data] of meshes)
    vfs.addBuffer(`assets/${name}.stl`, new Uint8Array(data));
  onProgress(0.5, "物理球场已就绪，正在加载小鸭步态…");
  const files = {
    walk: "BEST_alpha_walking.onnx",
    stand: "BEST_alpha_stand.onnx",
    roller: "BEST_roller.onnx",
    kickL: "ball_kick_left.onnx",
    kickR: "ball_kick_right.onnx",
  };
  const policies = {};
  let loaded = 0;
  // Sequential session creation avoids concurrent WASM initialization on static hosts.
  for (const [key, file] of Object.entries(files)) {
    policies[key] = await createPolicy(`policies/${file}`);
    onProgress(0.5 + (++loaded / 5) * 0.45, "正在准备行走、射门与起身动作…");
  }
  return {
    mj,
    ort,
    vfs,
    templates,
    used,
    policies,
    engineVersion: mj.mj_versionString(),
  };
}
