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
  const [walkXml, rollerXml, danceXml, danceManifest, footballManifest] =
    await Promise.all([
      readText("robot/robot_allcollisions.xml"),
      readText("robot/robot_allcollisions_rollers.xml"),
      readText("robot/robot_dance.xml"),
      readText("policies/duckemw_dance.json"),
      readText("policies/football.json"),
    ]);
  const danceInfo = JSON.parse(danceManifest);
  const footballInfo = JSON.parse(footballManifest);
  if (
    footballInfo.enabled &&
    (footballInfo.schema !== "microduck-game-football-v1" ||
      footballInfo.runtime?.observationSize !== 61 ||
      footballInfo.runtime?.actionSize !== 14 ||
      footballInfo.runtime?.policyHz !== 50 ||
      footballInfo.runtime?.physicsHz !== 200 ||
      footballInfo.runtime?.actuatorDelayPhysicsSteps !== 4 ||
      footballInfo.runtime?.jointVelocityDelayControlSteps !== 1 ||
      !(footballInfo.windowSeconds >= 0.3 && footballInfo.windowSeconds <= 3) ||
      footballInfo.currentLimitAmps !== 1.75)
  )
    throw new Error("足球策略与当前运行时契约不兼容");
  const contract = danceInfo.runtime;
  if (
    danceInfo.schema !== "microduck-game-dance-v1" ||
    contract?.observationSize !== 61 ||
    contract?.actionSize !== 14 ||
    contract?.policyHz !== 50 ||
    contract?.physicsHz !== 200 ||
    contract?.actuatorDelayPhysicsSteps !== 4 ||
    contract?.jointVelocityDelayControlSteps !== 1
  )
    throw new Error("舞蹈策略与当前运行时契约不兼容");
  const templates = {
    walk: physicsTemplate(walkXml),
    roller: physicsTemplate(rollerXml),
    dance: physicsTemplate(danceXml),
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
    dance: "duckemw_dance.onnx",
  };
  if (footballInfo.enabled) files.football = footballInfo.file;
  const policies = {};
  let loaded = 0;
  // Sequential session creation avoids concurrent WASM initialization on static hosts.
  for (const [key, file] of Object.entries(files)) {
    const revision =
      key === "dance"
        ? danceInfo.sha256
        : key === "football"
          ? footballInfo.sha256
          : null;
    policies[key] = await createPolicy(
      `policies/${file}${revision ? "?sha256=" + revision : ""}`,
    );
    onProgress(
      0.5 + (++loaded / Object.keys(files).length) * 0.45,
      "正在准备行走、射门与舞步…",
    );
  }
  return {
    mj,
    ort,
    vfs,
    templates,
    used,
    policies,
    danceInfo,
    footballInfo: footballInfo.enabled ? footballInfo : null,
    engineVersion: mj.mj_versionString(),
  };
}
