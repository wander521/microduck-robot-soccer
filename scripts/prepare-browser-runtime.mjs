import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const dir = resolve("public/assets/runtime");
await mkdir(dir, { recursive: true });
const files = [
  ["@mujoco/mujoco/mujoco.js", "mujoco.js"],
  ["@mujoco/mujoco/mujoco.wasm", "mujoco.wasm"],
  [
    "onnxruntime-web/dist/ort-wasm-simd-threaded.mjs",
    "ort-wasm-simd-threaded.mjs",
  ],
  [
    "onnxruntime-web/dist/ort-wasm-simd-threaded.wasm",
    "ort-wasm-simd-threaded.wasm",
  ],
];
await Promise.all(
  files.map(([from, to]) =>
    copyFile(resolve("node_modules", from), resolve(dir, to)),
  ),
);
console.log("Prepared self-hosted MuJoCo and single-thread ONNX WASM.");
