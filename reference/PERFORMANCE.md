# Browser performance / 浏览器性能

2026-10-19 · Baseline: [`5b35a94`](https://github.com/wander521/microduck-robot-soccer/commit/5b35a9424477bb712a0bade303d3524ee365c4f9) · Branch: `perf/browser-runtime`

This optimization preserves gameplay, learned policy weights, graphics quality and the bilingual UI. The largest measured benefit is lower main-thread work; cold loading improves modestly. Results below are controlled local measurements, not production or real-phone guarantees.

本轮从 GitHub 的 `origin/main` 建立干净分支，使用 `npm ci` 安装锁定依赖。没有采用主工作目录的未提交代码。没有新增玩法、场景、控件或策略，也没有调整规则、模型权重、200 Hz 物理 / 50 Hz 推理、渲染分辨率、抗锯齿、材质、灯光和阴影质量。

## Changes / 修改

- 独立的碰撞网格和策略字节并行下载，MuJoCo 加载与资源 / ONNX 初始化重叠。优先取得小型 MuJoCo JS 工厂，避免大文件请求阻塞引擎入口。
- ONNX WASM 提前下载，避免等第一个策略会话才开始请求。会话仍串行创建，保持单线程 WASM 工厂初始化契约；首次会话完成后清除下载缓冲引用。保留全部七个策略、manifest 验证与失败提示。
- 缓存固定 HUD 元素；仅在文字、属性或开关值变化时写入 DOM，避免 50 Hz 快照反复重建相同文本。
- 姓名牌使用 transform 定位、缓存尺寸和数值碰撞判断，取消逐帧位置写入与 `getBoundingClientRect()` 交错。姓名、语言、字体及窗口尺寸变化时重新测量；受控球员优先及窄屏隐藏 AI 标签的规则不变。
- 合并足球场与月球背景中同材质、同阴影状态的静态网格。球场地板仍可独立换色，星球仍可旋转，透明物体和机器人不合批。浮空岛已有的实例化保留。
- 复用热循环的向量与媒体查询对象，减少短命分配。

## Measurements / 实测

Chrome 155，独立无扩展浏览器；桌面 1440 × 900、DPR 1；手机模拟 390 × 844、DPR 2、页面 CPU 4 倍限速。使用生产构建及相同 Pages 子路径，CDP 页面网络设为 60 ms 延迟、2 MiB/s 下载。两场景均开启四鸭自动比赛；预热后采样约 10 秒，启用相同 CPU profiler / DOM observer。手机是桌面浏览器模拟，不等于实机 Android 或 iPhone。

| 每约 10 秒 / per ~10 s | Before | After |
| --- | ---: | ---: |
| 桌面月球：主线程任务耗时 / main-thread task time | 2.197 s | 1.119 s |
| 桌面浮空岛：主线程任务耗时 | 2.045 s | 1.070 s |
| 手机模拟月球：主线程任务耗时 | 8.884 s | 4.085 s |
| 手机模拟浮空岛：主线程任务耗时 | 7.378 s | 4.067 s |
| 桌面月球：布局次数 / layouts | 1054 | 13 |
| 桌面浮空岛：布局次数 | 1043 | 16 |
| 手机模拟月球：布局次数 | 5242 | 12 |
| 手机模拟浮空岛：布局次数 | 5184 | 14 |
| 桌面月球：每帧绘制提交 / draw calls | 494 | 333 |
| 桌面浮空岛：每帧绘制提交 | 442 | 341 |
| 手机模拟月球：每帧绘制提交 | 429 | 330 |
| 手机模拟浮空岛：每帧绘制提交 | 389 | 341 |

主线程任务耗时下降约 **45%–54%**；布局次数下降 **98% 以上**。前后均接近 60 FPS，P95 帧间隔约 16.7–16.8 ms，没有采到超过 50 ms 的长任务。这说明运行余量增加，不能解释为帧率翻倍。实际绘制次数会随镜头和机器人运动变化；合批保留网格精度，可能因整体包围盒产生少量额外绘制三角形。

冷启动另行交替运行三轮，每次启动新浏览器且不并行跑测试。计时从导航开始，立即填写名字并点击入场，直到四鸭物理状态就绪；不包含随后 3 秒开球倒数，也不是入场表单首次可交互时间。

| 四鸭初始化 / four-duck initialization | Trial 1 | Trial 2 | Trial 3 | Median |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 22.152 s | 22.217 s | 22.185 s | 22.185 s |
| Optimized | 21.496 s | 21.436 s | 21.661 s | 21.496 s |

冷启动中位数改善约 **3.1%**。本地 Vite preview 没有为 WASM / STL 配置生产压缩，CDP 限速在页面 target 上配置；线上 GitHub Pages 的 WASM 响应带 gzip，因此这些秒数不能直接用于预测线上速度。两套大体积 WASM 及完整策略 / 碰撞资源仍是首次加载的主要成本。

本轮没有减少资源精度或文件总量。main + Three.js 的 gzip 代码约增加 **1.7 kB**，用于合批和 DOM 更新控制。未宣称降低总下载量、稳定减少内存或提高物理模拟频率。主线程 `performance` resource 条目不含 Worker 内请求，不能把它们的字节和当成全站下载量。

静态场景与入场页对照在两种尺寸、两套场景下，高于 8/255 色差的像素占比均低于 0.006%；微小差异来自合批坐标精度与抗锯齿。

结构化结果见 [PERFORMANCE_RESULTS.json](PERFORMANCE_RESULTS.json)。稳态数据采集后仅调整了 Worker 初始化中小型 JS 工厂的下载顺序；渲染 / HUD 路径相同，最终冷启动三轮使用该加载顺序。

## Reproduce / 复现

```sh
npm ci
BASE_PATH=/microduck-robot-soccer/ npm run build
BASE_PATH=/microduck-robot-soccer/ npm run preview -- --host 127.0.0.1 --port 52842 --strictPort
```

基准工具不属于游戏依赖。可在临时目录安装 Playwright，并将 `PLAYWRIGHT_MODULE` 指向该包的绝对路径，使用本机 Chrome：

```sh
npm install --prefix /tmp/microduck-perf-tools playwright
PLAYWRIGHT_MODULE=/tmp/microduck-perf-tools/node_modules/playwright \
  node scripts/benchmark-browser.cjs /tmp/microduck-result \
  http://127.0.0.1:52842/microduck-robot-soccer/ all
```

`all` 顺序测桌面及手机模拟；`desktop` / `mobile` 只测一种；`cold` 仅测新浏览器的初始化。输出 JSON、CPU profiles 与截图。用两份独立构建、不同严格端口交替运行 `cold`，至少比较三轮中位数。运行时不要同时构建或跑 CPU 密集测试。

## Regression coverage / 回归

`npm test`：57 项，55 通过，2 个原有可选原生协议测试跳过。新增测试覆盖 DOM 无变化时不写入、静态合批的坐标 / 阴影 / 动态部件隔离、引擎与下载重叠但会话串行，以及策略下载失败时停止初始化。

浏览器检查覆盖两场景的桌面 / 手机画面、中英文切换、行走、射门、冲撞、轮滑与行走切换、全场归位、真实步态列队 / 策略舞蹈 / 返回、窗口缩放和资源失败后的重试入口。具体运行结果保存在本次本地检查记录中。
