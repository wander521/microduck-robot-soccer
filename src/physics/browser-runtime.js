import * as ort from "onnxruntime-web/wasm";
import { assetUrl } from "../assets.js";
import { createPhysicsRuntime } from "./runtime.js";
export async function loadBrowserRuntime(onProgress) {
  onProgress(0.02, "正在唤醒机器鸭…");
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = assetUrl("assets/runtime/");
  const moduleUrl = assetUrl("assets/runtime/mujoco.js");
  const { default: loadMujoco } = await import(/* @vite-ignore */ moduleUrl);
  const mj = await loadMujoco({
    locateFile: (file) => assetUrl(`assets/runtime/${file}`),
  });
  onProgress(0.2, "正在装配球场与机器人…");
  const get = async (path) => {
    const response = await fetch(assetUrl(`assets/${path}`));
    if (!response.ok)
      throw new Error(`资源加载失败 (${response.status}): ${path}`);
    return response;
  };
  return createPhysicsRuntime({
    mj,
    ort,
    onProgress,
    readText: async (path) => (await get(path)).text(),
    readBinary: async (path) => (await get(path)).arrayBuffer(),
    createPolicy: async (path) =>
      ort.InferenceSession.create(await (await get(path)).arrayBuffer(), {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
        enableCpuMemArena: true,
      }),
  });
}
