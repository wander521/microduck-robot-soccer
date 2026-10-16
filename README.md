# 小鸭开球！ · GitHub Pages 版

在月球基地和浮空小岛踢球、跳舞的本地单人小游戏，使用 Pollen Robotics 官方机器人模型。

## 分支与运行

- `main`：原始本地服务版本（Node.js + 原生 ONNX 推理）。
- `github-pages`：当前纯浏览器版本，MuJoCo WASM 与 ONNX Runtime Web 在独立 Worker 中运行，无需后端。

开发需要 Node.js 22+：

```sh
npm ci
npm run dev
```

构建和预览与 GitHub Pages 一样的路径：

```sh
BASE_PATH=/sim-duck/ npm run build
BASE_PATH=/sim-duck/ npm start
```

默认预览地址是 `http://localhost:5173/sim-duck/`。部署后，访问者只需现代浏览器，不需要安装 Node.js。首次启动会下载本地托管的物理引擎、动作模型和机器人资源；后续由浏览器缓存。每个标签页独立单人比赛。

## GitHub Pages 发布

`.github/workflows/pages.yml` 在推送 `github-pages` 分支后自动测试、构建并发布 `dist/`。仓库的 **Settings → Pages → Source** 需要选择 **GitHub Actions**；`github-pages` 环境应允许同名分支部署。默认网站路径为 `https://wander521.github.io/sim-duck/`。

所有字体、WASM 和模型均由站点自身提供，不依赖 CDN。ONNX 使用单线程 WASM，不需要 GitHub Pages 无法自定义的跨源隔离响应头。

## 操作

| 操作 | 按键 |
| --- | --- |
| 前进 / 后退 | W / S 或 ↑ / ↓ |
| 左转 / 右转 | A / D 或 ← / → |
| 踢球 | F |
| 张嘴、嘎嘎 | M |
| 小鸭与足球归位 / 退出跳舞 | Space |
| 排成一排跳舞 / 继续比赛 | X |
| 观众 / 场外漫游 | E |
| 恢复跟随视角 | C |
| 环顾 / 缩放 | 鼠标拖动 / 滚轮 |
| 自由视角移动 | 工具栏“自由视角”，WASD 移动，Q / E 升降 |

手机支持触摸方向键、踢球与嘎嘎。底角可切换月球基地 / 浮空小岛、行走 / 轮滑。右上游戏菜单内可开关 AI、自动踢球、换队、声音。

## 实现范围

- Three.js 渲染、官方分关节模型，直接显示物理计算得到的身体姿态、关节角和被动轮转动。
- 浏览器 Worker 以 MuJoCo 3.11 进行 200 Hz 多机器人与单球物理仿真，以 ONNX Runtime Web 执行官方策略进行 50 Hz 控制；画面通过 Worker 消息接收姿态，不创建 WebSocket 或连接游戏服务器。硬件性能较慢时实际速度可能降低。
- AI 采用追球、绕到球后和瞄准球门的规则控制。
- 机器人行走、滚轮、踢球、起身使用 Pollen Robotics 预训练策略；伺服采用训练项目的 XL330 / BAM M6 电压、反电动势、摩擦与惯量模型。按键提交目标速度，不直接平移或旋转身体。本项目未重新训练策略。
- 月球基地与浮空小岛为原创程序场景。球场长宽各放大到原来的 1.5 倍（3.15 × 1.86 m），边线外有 .34 m 活动区，贴边低速球轻微回场。
- X 先让小鸭通过官方步态与真实物理自行列队，站稳后启用原创 128 BPM 舞蹈；集合过程中可随时再次按 X 返回比赛，Space 退出并归位。按用户视频参考放大蹲起、摆胯和甩头；实际脚底几何校正贴地。编舞阶段是暂停物理后的关键帧表演，退出还原比赛，不是 DuckEMW ONNX 推理。
- 已保留官方模型与代码归属，详见 [THIRD_PARTY.md](THIRD_PARTY.md)。

## 验证和构建

```sh
npm test
npm run build
```

`npm run build` 生成完整静态 `dist/`。构建会从固定版本依赖复制浏览器运行时，不把生成文件重复提交到 Git。`npm start` 仅启动静态预览。

本地原生验证工具仍可通过 `npm run dev:native`、`npm run start:native` 使用；`RUN_NETWORK_TESTS=1 npm test` 用于验证该辅助服务。网页本身使用浏览器 Worker。

当前场上始终只有一个共享足球。行走速度指令为前后 ±0.3 m/s、转向 ±1.5 rad/s；滚轮采用前进 0.6 m/s、后退 0.5 m/s、转向 0.3 rad/s。这些是策略目标值，实际速度由接触、摩擦和策略决定。

真实碰撞覆盖足球场、球门、机器人和足球；场外装饰几何暂未加入碰撞世界。
