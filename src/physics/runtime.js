import { DOMParser } from "@xmldom/xmldom";
const elements = (node, tag) => [...node.getElementsByTagName(tag)];
function physicsTemplate(xml) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  for (const geom of elements(doc, "geom"))
    if (geom.getAttribute("class") === "visual")
      geom.parentNode.removeChild(geom);
  return doc;
}
async function loadRuntimeAssets({
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
  const files = {
    walk: "BEST_alpha_walking.onnx",
    stand: "BEST_alpha_stand.onnx",
    roller: "BEST_roller.onnx",
    kickL: "ball_kick_left.onnx",
    kickR: "ball_kick_right.onnx",
    dance: "duckemw_dance.onnx",
  };
  if (footballInfo.enabled) files.football = footballInfo.file;
  const plans = Object.entries(files).map(([key, file]) => {
    const revision = key === "dance" ? danceInfo.sha256
      : key === "football" ? footballInfo.sha256 : null;
    return { key, path: `policies/${file}${revision ? "?sha256=" + revision : ""}` };
  });
  // Fetch independent collision meshes and policy bytes together. Session creation
  // stays sequential: ONNX's shared WASM factory must initialize only once.
  const [meshes, binaries] = await Promise.all([
    Promise.all([...used].map(async name => [
      name, await readBinary(`robot/meshes/${name}.stl`),
    ])),
    Promise.all(plans.map(({ path }) => readBinary(path))),
  ]);
  onProgress(0.5, "物理球场已就绪，正在加载小鸭步态…");
  const policies = {};
  for (const [index, { key, path }] of plans.entries()) {
    policies[key] = await createPolicy(path, binaries[index]);
    onProgress(0.5 + ((index + 1) / plans.length) * 0.45,
      "正在准备行走、射门与舞步…");
  }
  return { templates, used, meshes, policies, danceInfo,
    footballInfo: footballInfo.enabled ? footballInfo : null };
}

export async function createPhysicsRuntime(options) {
  // MuJoCo loading/compilation is independent of asset downloads and ONNX setup.
  // Accept a ready engine (native) or its promise (browser) without serializing them.
  const [mj, assets] = await Promise.all([options.mj, loadRuntimeAssets(options)]);
  const vfs = new mj.MjVFS();
  for (const [name, data] of assets.meshes)
    vfs.addBuffer(`assets/${name}.stl`, new Uint8Array(data));
  const { meshes, ...runtimeAssets } = assets;
  return { ...runtimeAssets, mj, ort: options.ort, vfs,
    engineVersion: mj.mj_versionString() };
}
