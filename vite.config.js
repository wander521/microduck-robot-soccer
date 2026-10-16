import { defineConfig } from "vite";
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  worker: { format: "es" },
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks: {
          three: [
            "three",
            "three/addons/loaders/GLTFLoader.js",
            "three/addons/loaders/DRACOLoader.js",
            "three/addons/controls/OrbitControls.js",
            "three/addons/loaders/STLLoader.js",
            "three/addons/utils/BufferGeometryUtils.js",
          ],
        },
      },
    },
  },
});
