---
name: "小鸭开球！ · MicroDuck Arcade"
description: "Cream enamel controls around a playful local robot football world."
colors:
  paper: "#fff7e7"
  ink: "#203746"
  muted: "#566971"
  coral: "#bd4930"
  orange: "#ee7957"
  line: "#d7d3c3"
  selected-marine: "#263f50"
  coral-hover: "#9e3824"
  blue-team: "#245a78"
  orange-team: "#ad472e"
  hover-paper: "#eee5d1"
  field-paper: "#fffdf5"
  field-border: "#b7c0bf"
  field-placeholder: "#63757d"
  focus: "#c44828"
  field-focus: "#eeb598"
  field-focus-border: "#a7432d"
  error: "#a33e2b"
  field-error: "#b03b24"
  soft-action: "#f7d8bb"
  soft-action-ink: "#873a27"
  kick: "#f6b176"
  kick-ink: "#4b2f1f"
  key-paper: "#f5f0e4"
  key-ink: "#3e5662"
  moon-sky: "#172d43"
  island-sky: "#9dbbca"
  moon-pitch: "#487d70"
  island-pitch: "#78a16e"
typography:
  display:
    fontFamily: "Bungee, sans-serif"
    fontSize: "54px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.03em"
  brand:
    fontFamily: "Bungee, sans-serif"
    fontSize: "35px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.03em"
  score:
    fontFamily: "Bungee, sans-serif"
    fontSize: "38px"
    fontWeight: 400
    lineHeight: 1.2
  headline:
    fontFamily: "\"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "29px"
    fontWeight: 850
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  intro:
    fontFamily: "\"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "14px"
    lineHeight: 1.85
  menu-title:
    fontFamily: "\"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "13px"
    fontWeight: 800
  control:
    fontFamily: "\"PingFang SC\", \"Microsoft YaHei\", sans-serif"
    fontSize: "12px"
    fontWeight: 750
  key:
    fontFamily: "\"PingFang SC\", sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1
rounded:
  key: "5px"
  label: "7px"
  tool: "8px"
  field: "9px"
  primary: "10px"
  banner: "12px"
  dock: "13px"
  panel: "14px"
  entry: "16px"
  score-mobile: "0 0 18px 18px"
  score: "0 0 24px 24px"
  touch: "50%"
spacing:
  dock-inset: "5px"
  dock-gap: "6px"
  primary-inset: "12px 18px"
  field-inset: "10px 13px"
  entry-inset: "32px 34px"
  menu-inset: "4px 20px 18px"
  desktop-edge: "28px"
  mobile-edge: "12px"
components:
  button-primary:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.paper}"
    rounded: "{rounded.primary}"
    padding: "{spacing.primary-inset}"
    width: "100%"
  button-primary-hover:
    backgroundColor: "{colors.coral-hover}"
  button-dock:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0 13px"
  button-dock-selected:
    backgroundColor: "{colors.selected-marine}"
    textColor: "{colors.paper}"
  player-name-field:
    backgroundColor: "{colors.field-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "{spacing.field-inset}"
    height: "48px"
    width: "100%"
  scene-navigation:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.dock}"
    padding: "{spacing.dock-inset}"
  game-menu:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    width: "304px"
  scoreboard:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.score}"
    padding: "12px 27px 14px"
  controlled-player:
    backgroundColor: "{colors.selected-marine}"
    textColor: "{colors.paper}"
    rounded: "{rounded.label}"
    padding: "4px 7px"
  dance-banner:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.banner}"
    padding: "11px 19px"
  touch-direction:
    backgroundColor: "#fff7e7ed"
    textColor: "{colors.ink}"
    rounded: "{rounded.touch}"
    width: "46px"
    height: "46px"
---

# Design System: 小鸭开球！

## Overview

**Creative North Star: "奶油搪瓷街机 · Enamel Toy Sports Arcade"**

奶油白的操作件、深海蓝的文字和珊瑚色动作按钮，让足球场像一台可亲手玩的玩具街机。粗厚的 Bungee 字标与比分承担游戏性，中文系统字体负责直接、易读的操作说明。三维球场与机器鸭是主角，HUD 保持紧凑、安定。

这是由已实现源码提取的替换设计系统，视觉依据是当前原创场景与街机控件。用户已授权替换早期 FPVSIM 深灰/黄色参考；保留官方机器鸭的比例、白橙材质与真实足球运动。月球基地与浮空小岛共享同一套 HUD，不为不同场景另造控制语言。

**Key Characteristics:**

- 暖奶油底、海蓝文字、珊瑚动作色；队伍继续用蓝橙文字与场上标记区分。
- Bungee 仅用于拉丁字标、比分与进球展示，中文使用系统无衬线。
- 固定边缘的圆角操作件、短投影、原生折叠菜单；球场保持连续可见。
- 同步舞蹈是明确暂停比赛的独立演出状态，控制与退出反馈保持真实。

## Colors

暖色奶油表面衬托冷海蓝文字，珊瑚色给出直接动作；场景材质与 HUD 色彩各司其职。数值以 frontmatter 和 `src/style.css` 为准。

- **Primary — 珊瑚动作色** (`coral`)：上场按钮、舞蹈选中、触摸射门、进球文字；悬停用 `coral-hover`。
- **Secondary — 海蓝搪瓷** (`selected-marine`)：场地和移动方式选中、“你”标记、入场字标。常规正文用 `ink`，辅助说明与 VS 用 `muted`。
- **Teams — 海盐蓝 / 汽水橙** (`blue-team` / `orange-team`)：队名、比分和标签；“你的队”、队友/对手文字补充身份。队色不替代动作语义。
- **Neutral — 奶油纸面** (`paper`)：比分、菜单、底角 dock、入场容器、提示；`line` 做内部细分隔。姓名字段用 `field-paper` 与 `field-border`。
- **Interaction — 暖色反馈**：普通 dock 悬停用 `hover-paper`，次级开关激活用 `soft-action` / `soft-action-ink`；桌面射门为 `kick` / `kick-ink`。焦点、字段焦点和错误沿用已实现的独立色值。
- **Scene — 原创小世界**：月球天空/草坪为 `moon-sky` / `moon-pitch`；浮空岛为 `island-sky` / `island-pitch`。这些是三维场景色，不扩散为菜单背景。

浮空岛沿用低多边形玩具树林：多冠阔叶树、分层松树、浅色树干的桦树以不同高度和朝向错落排列。灰绿岩石、奶油/蜜黄/陶粉野花与灌木只分布在球场外围；小屋带窗框、花箱、烟囱和石板路。岛外的云团与三个小浮岛补充远景深度，缩远或环顾时可见。所有装饰为本地程序几何，无新增下载资产；重复几何按材质实例化，不参与比赛碰撞，保持球场及活动区通畅。

**The Meaningful Accent Rule.** 珊瑚用于主要操作、舞蹈选中态和进球反馈；深海蓝用于选场与移动方式的选中态。队伍身份同时以文字说明。

## Typography

**Display Font:** 自托管 `Bungee`，400，后备 sans-serif；字体文件 `/assets/fonts/Bungee-Regular.ttf`，许可证随资产提供。运行时不请求远程字体。

**Body Font:** `"PingFang SC", "Microsoft YaHei", sans-serif`。中文的字号和字重建立层级，不用 Bungee 模拟中文标题。

- **Display**：入场 DUCK! 为 54px/1、-0.03em；手机 48px，矮屏 34px，固定 -5° 小角度是字标姿态。
- **Brand**：桌面角落字标 35px/1，手机 23px，380px 以下 19px；480px 以下整体隐藏，把空间留给比分与菜单。
- **Score**：38px/1.2、等宽数字；手机 27px，380px 以下 25px。VS 同为 Bungee，桌面 15px，手机 11px，颜色为 `muted`。
- **Headline**：入场中文 h1 为 29px/1.2、850、-0.025em。介绍为 14px/1.85。
- **Controls**：常规 dock 12px/750，菜单摘要 13px/800，菜单 h2 13px/1.4；手机 dock 10px。姓名输入始终 16px，主要按钮 15px/800。
- **Keycaps / Notes**：键帽 11px/1、700；说明多为 11px，关于说明行高 1.75。
- **Goal**：`clamp(28px, 5vw, 62px)/1.2 Bungee`，配中文队伍结果文字。

**The Display Role Rule.** Bungee 用于字标、比分和 GOOOAL；中文说明与交互标签使用系统字体。

## Layout

全视口 Three.js 画布，无文档滚动；入场面板与菜单内容独立滚动。桌面字标左上、比分居中上方、菜单右上。选场 dock 左下，移动/视角 dock 右下，射门/舞蹈/归位动作居中下方。桌面横边留 28px，dock 离底 26px；使用 safe-area inset。比分 326px 最小宽，顶部 20px，内边距 12px 27px 14px。

dock 通常 5px 内边距、6px 项间距，按钮 45px 最小高度。入场容器宽 `min(402px, calc(100vw - 32px))`、最大高 `calc(100dvh - 40px)`、内边距 32px 34px；菜单展开宽 304px，内容最大高 `calc(100dvh - 140px)`。

- **721–1190px**：移除移动提示和归位键帽、收窄 dock 按钮内边距，隐藏字标旁的状态说明。
- **≤720px**：dock 离横边 12px、底边至少 16px；按钮最小高 42px。比分最小宽 230px、顶部 12px；菜单折叠为 42px 图标按钮，展开宽 `min(304px, calc(100vw - 24px))`。舞蹈与归位移至顶部 83px；射门交给底部触摸按钮。方向盘位于左下、射门和嘎嘎在右下，离底 110px。触摸方向按钮 46px，射门 66px。
- **≤480px**：隐藏左上品牌，比分和菜单优先。**≤380px**：比分最小宽 212px，收窄 dock 按钮并去掉选场图标。
- **高度 ≤550px**：压缩顶部/底部留白、入场内边距与字标，触摸控制离底 78px，菜单内容可滚动。

玩家标记先处理“你”，宽屏对重叠标签进行碰撞裁剪；≤720px 只保留受控球员标记。舞蹈隐藏所有姓名牌。不要把屏幕空间不足导致的重叠当作密度规范。

**The Playfield Rule.** 把持久操作放在视口边缘，让球、球员和球门保持可读。

## Elevation & Depth

UI 是平整、不透明的奶油操作件，短投影把它们从三维场景提起；不使用玻璃模糊或拟金属渐变。三维世界由真实几何、光照与投影承担空间感。

- **HUD**：`0 6px 22px #07182030`，用于比分、dock、菜单、舞蹈条和 toast。
- **Entry**：`0 18px 60px #08131c55`；遮罩 `#10233277`，对话框本身奶油实底。
- **Player label**：`0 3px 8px #15293625`；触摸按钮 `0 3px 9px #15293625`。

控件置于画布上方；菜单高于一般 HUD，入场遮罩高于整套游戏界面。提示和进球是短时反馈，不变成持久面板。

## Shapes

圆角来自小型搪瓷操作件：键帽 5px，标签/次级设置 7px，移动工具 8px，字段/选场按钮 9px，主要按钮与 toast 10px，舞蹈条 12px，dock 13px，菜单与进球块 14px，入场 16px。比分是上方直边、下方 24px 圆角的悬挂记分牌，手机下圆角 18px。触摸控制用圆形。

SVG 使用统一无填色、1.8 描边、圆端点和圆转角，常规 22px，dock 图标 19px。方向与进入箭头使用相同描边，不依赖字体字形。

## Components

### Primary / Dock buttons

主要按钮珊瑚底配奶油字，10px 圆角、49px 最小高度、12px 18px 内边距；hover 深一档。普通 dock 按钮透明，hover 浅奶油，选中海蓝底奶油字。自由视角与模式之间用一根细分隔，激活后浅暖底并改为“跟随小鸭”。设置中的声音、自动踢球通过文字与 `aria-pressed` 共同表达状态。按钮 active 下移 1px；disabled 降至 .55 不透明度并阻止操作。

### Input / Entry / Loading

球员名字为显式 label 的 48px 高字段、9px 圆角、16px 输入字体。焦点是 3px 暖色轮廓、2px 偏移与深色边框；错误边框和关联 `role="alert"` 文案共同呈现。入场是有标题的模态对话框，管理初始焦点与 Tab 范围；资源进度来自实际加载、带 progressbar 数值，失败显示“重新加载”。

### Scoreboard / Player cue

海盐蓝队与汽水橙队使用文字、数字和“你的队”标记。隐藏的队伍标记保持占位，避免比分跳动。受控小鸭标记为深海蓝小牌、奶油“你”；次要 AI 标签为暖白小牌，不能遮住主要动作。VS 与辅助说明均用 `muted`。

### Scene navigation / Movement dock

选场固定月球基地与浮空小岛；行走/轮滑明确切换。选中状态同时写入 class 和 `aria-pressed`。布局收缩时先移除图标与附属文案，保留真实操作名。自由视角有独立可访问名称。

### Native game menu / Help

`details` / `summary` 作为原生折叠菜单，内含球员名字、比赛设置、操作指南、相机说明与关于鸣谢。设置包括机器鸭开关、自动踢球、换队、声音。菜单 Escape 可切换；键盘移动、F 射门、X 舞蹈、Space 归位、M 嘎嘎、C 跟随、E 场外漫游。不要显示联机、邀请或人数。

### Touch controls

四个有名称的圆形 SVG 方向按钮，W/S 前后、A/D 转向；46px 按钮、5px 间隔。右侧 66px 珊瑚“射门”配 46px“嘎嘎”。pointer capture 和松手/失焦清理输入避免持续移动；按钮不触发页面手势。

### Dance interlude / Feedback

X 或“一起跳舞”先按当前位置从左到右分配站位，由官方步态与 MuJoCo 驱动小鸭自行移动、避让、转向；全部站稳后加载训练碰撞模型并运行已验证的 DuckEMW 舞蹈 ONNX 检查点。所有舞蹈关节与身体运动由推理和物理产生，无关键帧或根部纠正。集合显示“正在集合 · n/4 就位”，站稳后切正面镜头和“小鸭舞团”状态条；移动、AI、换队、自动、视角和射门暂时禁用，触摸盘与姓名牌隐藏。球和比分暂停，机器人物理始终继续。

镜头切换从当前视点出发，清除 OrbitControls 的残余拖动阻尼，集合/开跳/退出分别连续过渡约 .65/.7/.55 秒。过渡时相机只有一个控制者，返回跟随的目标是玩家当前移动位置。reduced-motion 使用一次直接切镜。按 X 从小鸭当前物理位置、姿态继续比赛，恢复原行走/轮滑模式，不恢复旧坐标；Space 保持显式归位。4096 并行环境、4000 轮训练已完成，当前选用第 3500 轮检查点，版本与验证结果记录在策略 manifest；未来更新 ONNX 与 manifest 即可，列队与退出独立于检查点。本地合成 128 BPM 节拍受声音开关控制。

toast 与进球提示用 `role="status"` / polite live region；进球显示 GOOOAL! 与得分队文字，约 2.2 秒后退出。普通按钮/链接/summary 有 3px 珊瑚焦点环、4px 偏移。hover 只过渡 background/color（.16s ease-out），入场退场 .22s，toast .18s，进度宽 .2s。`prefers-reduced-motion: reduce` 关闭 CSS 过渡，核心比赛与用户主动进入的舞蹈仍为运动内容。

## Do's and Don'ts

### Do

- Do 延续奶油操作件、海蓝选中态与珊瑚主要操作，沿用实际字号、圆角和间距。
- Do 让桌面和手机都能直接射门、切换舞蹈、重新开球，并保留可见焦点与有意义的按钮名称。
- Do 优先保留受控小鸭的“你”标记；窄屏隐藏 AI 姓名牌，宽屏裁掉碰撞的次要标记。
- Do 保持真实步态、训练舞蹈和比赛间的空间连续性：X 在当前位置续踢，Space 显式归位。

### Don't

- Don't 恢复旧版深灰/黄色参考 HUD，或把湖屋、邀请、共享房间和在线人数带回当前单人界面。
- Don't 让帮助、长说明或姓名牌挡住主要比赛动作；说明和鸣谢放在折叠菜单。
- Don't 把预训练足球策略说成自行训练；舞蹈的训练完成状态与部署检查点必须和 manifest 一致。
- Don't 为普通控件混用字符箭头、图标字体或装饰性图标；沿用一致的内联 SVG 描边。
