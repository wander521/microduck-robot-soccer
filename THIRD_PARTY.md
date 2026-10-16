# 第三方资料与资源

## Pollen Robotics MicroDuck

- 机器人项目：https://github.com/pollen-robotics/microduck
- 训练项目：https://github.com/pollen-robotics/microduck_rl
- 原始模拟器：https://huggingface.co/spaces/pollen-robotics/microduck-simulator
- `src/duck-rig.js` 改编自上述 Space 的 `app/src/game/duck.js`，主要调整本地资源路径与材质，代码许可 Apache-2.0；完整许可证见 `reference/LICENSE-APACHE-2.0`。
- `public/assets/robot/microduck.glb`、`kinematics.json` 取自上述 Space。机器人三维模型由 **Pollen Robotics** 创作，模型许可 **CC BY-NC-SA 4.0**，详见 `reference/LICENSE-MODELS.md` 及 https://creativecommons.org/licenses/by-nc-sa/4.0/ 。本项目没有更改 GLB 几何文件；运行时配置了不同材质颜色；足球动作来自 MuJoCo / ONNX 策略，舞蹈来自另一项任务独立训练的 DuckEMW 兼容策略。

## 参考场景

- 参考页面：https://fpvsim.com/zh-cn/sim-duck?scene=lake-house
- `reference/legacy-lake-house.glb`（已停用、不随网页分发）来源：https://fpvsim.com/q/client/glbs/lake-house.glb?v=1
- 该场景已按用户要求从游戏和发布资源中移除，仅保留本地参考归档。当前月球基地与浮空小岛为原创程序场景。

## 库

- Three.js（MIT），https://github.com/mrdoob/three.js
- Draco 解码器：随 Three.js 分发，`public/assets/draco/` 保留其原始文件头声明。
- Vite（MIT），https://github.com/vitejs/vite
- ws（MIT），https://github.com/websockets/ws

## 真实物理与策略控制

- `public/assets/policies/` 的 5 个 ONNX 文件、机器人两份 MJCF、滚轮运动学和额外滚轮 STL 均来自 Pollen Robotics 官方模拟器（见上方链接）。
- `scripts/prepare-physics-meshes.mjs` 将原始 GLB 的碰撞用几何转换为二进制 STL；生成的模型衍生文件保留 Pollen Robotics 署名与 CC BY-NC-SA 4.0 条款。
- `src/physics/` 的观察量契约和策略切换依据官方模拟器、`microduck_rl/scripts/infer_policy.py`；参考源文件保存在 `reference/`，Apache-2.0。
- `src/physics/servo.mjs` 是 Rhoban BAM M6 / XL330 电压控制及摩擦公式的 JavaScript 改编。原作者 Marc Duclusaud、Grégoire Passault；Apache-2.0。来源 https://github.com/Rhoban/bam/tree/mjlab_frictionloss ，源参考及完整许可见 `reference/upstream-bam-*`、`reference/LICENSE-BAM`。`reference/bam-xl330-m6.json` 保留其原始标定参数。
- MuJoCo（Apache-2.0），https://github.com/google-deepmind/mujoco
- ONNX Runtime（MIT），https://github.com/microsoft/onnxruntime

## 字体与舞蹈参考

- Bungee Regular：David Jonathan Ross，SIL Open Font License 1.1。字体与完整许可保存在 `public/assets/fonts/`，来源 https://github.com/google/fonts/tree/main/ofl/bungee 。
- 舞蹈训练参考 https://github.com/emwstudio/DuckEMW ，部署的是本项目另一项训练任务完成 4000 轮训练后导出的第 3500 轮检查点，来源、版本与部署契约见 `reference/DANCE_POLICY.md` 和策略 manifest；没有复制上游未公开权重或歌曲。舞蹈动作由 ONNX 与 MuJoCo 实际推理，旧关节关键帧已移除；本地 Web Audio 只合成节拍。
- `public/assets/robot/robot_dance.xml` 和四个 `meshes/dance_*.stl` 来自 Pollen Robotics 官方训练基座 `5946fd9` 的 walk 模型；移除视觉几何并改碰撞资源名以匹配训练接触模型。几何仍按 CC BY-NC-SA 4.0 署名与分发，相关代码沿用 Apache-2.0。

## 浏览器版运行时

- `src/physics/world-core.js` 与原生版共享相同的物理场景、观察量和伺服模型。浏览器使用 `@mujoco/mujoco` 3.11.0（Apache-2.0）与 `onnxruntime-web` 1.30.0（MIT）；构建时将固定版本的 WASM/JS 复制到 `assets/runtime/`，不使用 CDN。

## 本地足球训练

- 新增感知球位的 `football.onnx`，基于 Pollen Robotics 官方训练基座独立训练；版本、运行时合同和评估说明见 `reference/FOOTBALL_POLICY.md`。保留官方模型与 BAM 控制来源和许可证。冲撞为上层游戏能力，复用行走策略并在真实接触时施加有限物理冲量。
