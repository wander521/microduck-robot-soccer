import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import loadMujoco from "@mujoco/mujoco";
import * as ort from "onnxruntime-node";
import { createPhysicsRuntime } from "./runtime.js";
export { PhysicsWorld } from "./world-core.js";
let runtimePromise;
export function loadPhysicsRuntime() {
  return (runtimePromise ??= (async () =>
    createPhysicsRuntime({
      mj: await loadMujoco(),
      ort,
      readText: (path) => readFile(resolve("public/assets", path), "utf8"),
      readBinary: (path) => readFile(resolve("public/assets", path)),
      createPolicy: (path) =>
        ort.InferenceSession.create(resolve("public/assets", path.split("?")[0]), {
          executionProviders: ["cpu"],
          intraOpNumThreads: 1,
          interOpNumThreads: 1,
          graphOptimizationLevel: "all",
        }),
    }))());
}
