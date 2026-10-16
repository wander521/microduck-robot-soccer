# 第三方资料与资源

## Pollen Robotics MicroDuck

- 机器人项目：https://github.com/pollen-robotics/microduck
- 训练项目：https://github.com/pollen-robotics/microduck_rl
- 原始模拟器：https://huggingface.co/spaces/pollen-robotics/microduck-simulator
- `src/duck-rig.js` 改编自上述 Space 的 `app/src/game/duck.js`，主要调整本地资源路径与材质，代码许可 Apache-2.0；完整许可证见 `reference/LICENSE-APACHE-2.0`。
- `public/assets/robot/microduck.glb`、`kinematics.json` 取自上述 Space。机器人三维模型由 **Pollen Robotics** 创作，模型许可 **CC BY-NC-SA 4.0**，详见 `reference/LICENSE-MODELS.md` 及 https://creativecommons.org/licenses/by-nc-sa/4.0/ 。本项目没有更改 GLB 几何文件；运行时配置了不同材质颜色；足球动作来自 MuJoCo / ONNX 策略，舞蹈是单独的原创编舞。

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
- 舞蹈动作类型和节拍编排参考 https://github.com/emwstudio/DuckEMW ，并参考用户提供的视频。未复制该仓库代码、权重或歌曲。`src/dance.js`、`scripts/generate-dance-poses.mjs` 与生成的 `src/dance-squat.js` 为本项目原创；蹲起使用原模型的正向运动学求解脚底固定的关节关键帧，舞蹈时暂停动力学仿真。合成节拍为本地 Web Audio 原创声音。
