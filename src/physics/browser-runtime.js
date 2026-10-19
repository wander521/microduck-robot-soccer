import * as ort from "onnxruntime-web/wasm";
import { assetUrl } from "../assets.js";
import { createPhysicsRuntime } from "./runtime.js";
export async function loadBrowserRuntime(onProgress) {
  onProgress(0.02, "正在唤醒机器鸭…");
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = assetUrl("assets/runtime/");
  const moduleUrl = assetUrl("assets/runtime/mujoco.js");
  // Load the small JS factory first so bulk asset requests cannot delay its WASM fetch.
  const { default: loadMujoco } = await import(/* @vite-ignore */ moduleUrl);
  const mj = loadMujoco({ locateFile: file => assetUrl(`assets/runtime/${file}`) });
  onProgress(0.2, "正在装配球场与机器人…");
  const get = async (path) => {
    const response = await fetch(assetUrl(`assets/${path}`));
    if (!response.ok)
      throw new Error(`资源加载失败 (${response.status}): ${path}`);
    return response;
  };
  // Fetch the ONNX engine immediately, alongside MuJoCo and model assets, rather
  // than waiting for the first session. Keep the existing single-thread factory.
  const onnxBytes = get("runtime/ort-wasm-simd-threaded.wasm")
    .then(response => response.arrayBuffer())
    .then(bytes => { ort.env.wasm.wasmBinary = new Uint8Array(bytes); });
  const runtime = createPhysicsRuntime({
    mj,
    ort,
    onProgress,
    readText: async (path) => (await get(path)).text(),
    readBinary: async (path) => (await get(path)).arrayBuffer(),
    createPolicy: async (_path, bytes) => {
      await onnxBytes;
      const session = await ort.InferenceSession.create(bytes, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
        enableCpuMemArena: true,
      });
      // The initialized factory retains its own memory; release the download copy.
      ort.env.wasm.wasmBinary = undefined;
      return session;
    },
  });
  // Observe both failures immediately, including a failed early engine download.
  return (await Promise.all([runtime, onnxBytes]))[0];
}
