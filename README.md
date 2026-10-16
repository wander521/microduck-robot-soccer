# 小鸭开球！

四只 MicroDuck 在月球基地或浮空小岛进行 2v2 足球比赛，也可以一起列队跳舞。

**[点击游玩](https://wander521.github.io/sim-duck/)**

## 当前版本与分支

- **`github-pages`**：当前公开版本，MuJoCo WASM 与 ONNX Runtime Web 在浏览器 Worker 中运行，不需要游戏后端。
- **`feat/football-team-control`**：当前足球控制与比赛规则开发分支。
- **`main`**：保留早期 Node.js 本地服务实现，不代表当前网页的策略和功能。

当前网页支持五分钟比赛、进球后全场归位与 3 秒准备、蓝橙队色、R 加速冲撞、X 行走集合并使用训练舞蹈、键盘与手机触屏操作。每个标签页独立单人比赛，没有联机功能。

## 使用与开发文档

完整说明维护在当前发布分支：

| 文档 | 内容 |
| --- | --- |
| [README](https://github.com/wander521/sim-duck/blob/github-pages/README.md) | 比赛规则、全部操作、本地运行、架构、测试与部署 |
| [策略清单](https://github.com/wander521/sim-duck/blob/github-pages/reference/POLICIES.md) | 7 个 ONNX 文件、来源、调用条件、SHA-256 与替换步骤 |
| [比赛规则](https://github.com/wander521/sim-duck/blob/github-pages/reference/MATCH_RULES.md) | 计时、胜负、全场归位、队色与冲撞条件 |
| [足球策略与评估](https://github.com/wander521/sim-duck/blob/github-pages/reference/FOOTBALL_POLICY.md) | 球位感知踢球训练、团队 AI、冲撞实现与测试 |
| [舞蹈策略](https://github.com/wander521/sim-duck/blob/github-pages/reference/DANCE_POLICY.md) | 独立舞蹈训练、检查点、运行契约与验证 |
| [资源与许可证](https://github.com/wander521/sim-duck/blob/github-pages/THIRD_PARTY.md) | 官方模型、代码、字体与依赖的来源和许可 |

当前网页使用官方行走、起身和轮滑权重，配合本项目独立训练的球位感知踢球及舞蹈权重；官方左右脚踢球模型保留作兼容路径。团队战术和冲撞时机由规则控制，冲撞复用行走网络，没有独立冲撞神经网络。

## 运行当前网页版本

需要 Node.js 22+：

```sh
git clone --branch github-pages https://github.com/wander521/sim-duck.git
cd sim-duck
npm ci
npm run dev
```

默认打开 `http://localhost:5173/`。GitHub Pages 构建、子路径预览和策略替换，请按发布分支 README 操作。

机器人模型来自 Pollen Robotics；其几何资源采用 CC BY-NC-SA 4.0。相关上游代码与依赖许可见各版本的 THIRD_PARTY.md。
