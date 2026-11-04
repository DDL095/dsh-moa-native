# moa-native 使用指南(v13/v14 配置即模型+轨迹会话化·四级下钻版)

内生 MoA(generation-time 融合,Hermes 形态):参考模型(refs)并行看上下文给建议,行动模型(aggregator)融合建议后带完整工具循环干活。与 moa 三件套(judgment-time 盲审)并存互补——三件套审结论,moa-native 让每轮回答更强。

> 配套文档:**[docs/INTERFACES.md](docs/INTERFACES.md)**(技术参考+DSH 升级恢复对照)· **[docs/TEST-SOP.md](docs/TEST-SOP.md)**(链路测试手册)· **[docs/DESIGN-CONSOLE.md](docs/DESIGN-CONSOLE.md)**(设计思路·含 §六轨迹观测)

## 一、触发形态(配置即模型)

provider 页 `moa-native` 组 = **default + 每个配方一个条目**,选谁=该会话常驻谁:

| 形态 | 用法 | 说明 |
|---|---|---|
| **常驻 default** | 模型下拉选 `moa-native · default` | 按面板默认配置(出厂=四路 flash 最高档+glm@max 聚合,F 模式) |
| **常驻配方** | 模型下拉选 `moa-native · 「配方名」` | 该会话常驻此配方全套(模式/阵容/cadence/参数) |
| **`/moaR` `/moaF` 斜杠** | 消息以 `/moaR ` 或 `/moaF ` 开头 | 当轮**只临时覆盖参考视野**(R 裁剪/F 镜像; 前缀剥除模型不可见);`/moa `=当轮按绑定模式。阵容/agg/cadence 全部沿用当前条目——斜杠不换"谁来看/多久看一次"。cadence=user_turn 时斜杠轮新指纹必 miss=等效手动强制扇出一次 |
| 兼容遗留 | 选 `moa-native · ref / full` | 直配模式的 R/F 显式入口(保留字) |

**斜杠语义速查(常见误解澄清)**: 斜杠只改「refs 这轮看什么」(R 裁剪视图 / F 全量镜像), **不改阵容、不改 aggregator、不改节奏**——这三样取自该会话常驻的条目(default 或配方)。控制台工作台首屏的「⌨ 斜杠生效预览」实时显示当前编辑目标下 /moaR /moaF 的实际组合, 可直接核对 R/F 与阵容的适配性(小窗 ref 模型选 R 省输入, 1M 窗模型 F 零信息差)。

配方在设置页「配置即模型 · 工作台」新建(详见三);**新配方保存后需重启一次**才出现在 provider 页下拉。

## 二、R 与 F 模式怎么选

默认 **F**(实测最优)。

| | R(裁剪视图) | F(全量 mirror) |
|---|---|---|
| refs 看到什么 | 裁剪摘要(system 丢弃/工具结果折叠/persona 防污染) | 主会话原样镜像(system+工具定义+完整历史+尾部提示) |
| 适用 | 小窗模型/省钱档/上下文污染敏感 | 1M 上下文模型/质量优先 |
| 缓存实测(30 轮) | 稳态命中率 44.6% | **稳态命中率 91.5-99.3%**(探针矩阵实锤) |

实测数据(2026-10-24 探针矩阵,`~/.dsh/mirror-probe-runs/`):F 模式与 DSH 压缩兼容(压缩轮一次失效,约 5 轮恢复 90%+);guidance 尾巴轮换对前缀缓存零伤害。模式优先级:`/moaR//moaF` 显式 > 配方 mode 绑定 > 面板默认 > **F 兜底**。

## 三、设置面板「MoA-Native 控制台」

设置页 → **MoA-Native 控制台**。所有改动**保存即热生效**(无需重启;新配方条目出现在 provider 页需重启一次)。

### 首屏:配置即模型 · 工作台
- **default 按钮**=默认配置编辑入口(provider 页同名条目)
- **配方列表**:每个配方一行(名称+摘要+✎重命名+🗑删除),点选进入编辑。✎=行内改名(Enter 确认/Esc 取消, 拦保留字与重名; 保存后生效, provider 页条目名重启后同步)
- **新配方**:命名(空=参数N 自动)→「从当前编辑新建配方」
- 这里编辑的一切(default 与配方)都是 provider 页 moa-native 组的条目——**设置页与"配置即模型"完全统一,不是两套**

### 配置态(折叠):编辑配方 / 模型开关
- **配方字段**:模式(不绑定=兜底F)/ refs(每路=**provider→模型→effort 三级下拉**,与 DSH 会话 UI 同构)/ agg 同构 / cadence / settle_ms / ref max_tokens / debug
- **无内置配方**——全部自己创造;模型开关(disabled_models)勾选=禁用,引用处告警**不阻断**(fail-loud 绝不静默替补);手写配置文件中的槽位别名仍可解析(兼容层保留, v4.3.10 起无管理界面)
- **effort 下拉**(每路 ref 与 agg 各一个)=该路**真实**推理等级: `off`=关思考(仅部分模型有此档——deepseek/qwen 系提供, glm/minimax 思考常开只能选低档省成本); `effort:默认`=不传=模型自身默认档。**会话头部「推理等级」对 MoA 无效**(伪路由 agent/request 自动剥除)——阵容思考深度的唯一配置点=此处

### 运行轨迹(首屏下方,M4.4)
**四级下钻(v13/v14)**:L1 会话列表(工作区下拉[隔离闸]/按时间·按工作区排序/📌置顶/累计 N 轮·跨重启回填)→ L2 轮次列表(`#会话内轮次 时间 ▶融合/⟲缓存复用·配方·refs 概览·agg`)→ L3 模型卡片(model@effort+耗时+字数+状态)→ L4 **advisory 原文全文**。自动轮询(进行中 3s/静息 15s,可关)。重启自动从当日 zstd 归档回填 ring(标"回填");「历史归档」区选日期载入并池(🗃 标记);refs 统计折叠区含各路次数/均耗时/失败率与成本估算(配置 `prices` 后)。输入零落盘——只存输出与计量。`trace:false` 可在配置文件关闭。

### 运行参数
- **cadence**:参考意见重算频率。`user_turn`=同一轮用户消息只算一次(最省,默认);`per_iteration`=每个执行步后重询;`every_n×N`=扇出后跳 N 步再算(周期 N+1 步);`tiered`=节拍档(重模型定调 + 轻模型巡检 + 非拍步冻结, v4.4.0)——四档详解见下节
- **settle_ms**:打断宽容窗口——你取消后,已临近完成的 refs 结果再多等这么久落袋
- **ref max_tokens**:每路参考上限(留空=模型默认;**thinking 模型建议留空**,否则思考预算被截导致空输出)
- **ref_deadline_ms / ref_idle_ms**(v4.4.0,**仅配置文件可设, 面板暂无编辑面**):每路 refs 的两道闸——`idle`=连续无 chunk 判挂死(每个 chunk 都重置, 故它是"静默/挂死闸"不是"总耗时闸"),`deadline`=单路总耗时上限。缺省 idle 240s / deadline 600s(v4.4.0 前为 120s/180s)。**旧 180s 死线不是"偏紧"而是会静默截断慢路**(2026-11-03 实测: 当日 1014 条 refs 路里 32 条精确落在 180.003–180.021s, 跨 5 个不同模型——五个厂商不可能都恰好在 180.000s 完成; 其中 17 条已吐 17.9k–33.5k 字, 而正常完成路的最大值只有 5.7k)。更糟的是 abort 被流吞掉后该路被记成 `done`、错误为空——**被砍断的内容照样进 guidance**, 在任何失败指标里都看不见。deadline 抬到 600s 后同批模型自然跑完 173–228s, 扎堆消失。可全局配,也可逐槽配(`ref_overrides[label].deadline_ms` / `.idle_ms`)。超时**不盲重试**(本地定时器判死,重发必再超时;旧档盲重试会把单路墙钟放大到 3×600s=30min 拖死整轮),而是标记为独立终态 `timeout`,在轨迹面板显示 ⏱、在守卫健康卡显示 ⏱ 计数。
- **长尾代价与对策**(v4.4.0):refs 是 `Promise.all` 并行——**任一路卡住都会把整轮 fanout 拖到该路的 deadline**。deadline 抬到 600s 的代价就是"最坏等 10 分钟"(旧值 180s)。对策正是上面的逐槽覆盖:**只给重的定调路放宽, 轻的巡检路保持紧**, 例如
  ```jsonc
  "ref_overrides": {
    "zai-coding-cn/glm-5.3@max": { "deadline_ms": 600000 },
    "kimi-coding/k3.1-pro@max":  { "deadline_ms": 600000 },
    "qwen-token-plan-anthropic/qwen3.8-flash@xhigh": { "deadline_ms": 180000 }
  }
  ```
  ⚠️ **键 = `refs[]`/lane 阵容里那一项的原样字符串**(含 `@effort` 后缀; 若那一项写的是槽位名则用槽位名)。键写错**静默失效、无告警**——照抄别的示例最易踩。
- **◇思考兜底标记**(v4.4.0):重模型"思考耗尽、正文未落"时, 引擎会用思考原文顶替正文当参考意见(v3.10 同款既有语义, 本次未改其质量行为)。这类路在 dock 显示 `◇思考兜底`——**它的正文不是模型给的答案, 是思考流水**, 与正常参考意见不同源。旧码的看门狗砍断也会落进这条兜底(且被记成"正常完成"), 造成思考流水静默冒充参考意见; v4.4.0 已把"被砍断"与"思考耗尽"分开: 前者判 `timeout` 不进 guidance, 后者带 `◇` 标记可辨认。

### cadence 四档详解(给人类看的版本)

**先建立一个心智模型:什么叫"一步"?**

```
你发一条消息 ──► 模型开始回复 ──► 中途可能调工具(每调一次 = 一个"执行步") ──► 回复完成
     └──────────────── 这整个过程 = "一轮" ────────────────┘
```

模型不是一口气说完的:它常常"读个文件→跑个分析→再写报告",每个工具调用之后它都会**带着新结果再次思考**——每一次再思考,都是一次向 refs 咨询的机会。cadence 决定的就是:**这个机会多久用一次**。

**三档行为对比(同一轮内的时序)**

```
user_turn(默认 · 同轮算一次)
  你: 帮我分析这份数据
  ├─ 执行步1(读文件)   ◆ refs 4路并行咨询——本轮唯一一次
  ├─ 执行步2(跑分析)   ⟲ 复用上面那份意见(附 STALE 提醒)
  └─ 执行步3(写报告)   ⟲ 继续复用
  模型: 完成。结果如下…
  → 成本: 4路×1次。STALE 提醒="该意见产生于你最新工具结果之前,已完成的调用别重做"

per_iteration(每步全新算)
  你: 帮我分析这份数据
  ├─ 执行步1   ◆ refs 咨询(第1次)
  ├─ 执行步2   ◆ refs 重新咨询(第2次——这次 refs 已能看到步1的结果)
  └─ 执行步3   ◆ refs 重新咨询(第3次)
  → 成本: 4路×3步=12次。意见永远基于最新局面

every_n×2(跳 2 步再算 · 周期 3 步)
  步1 ◆算 → 步2 ⟲复用 → 步3 ⟲复用 → 步4 ◆算 → 步5 ⟲复用 → 步6 ⟲复用…
  ⚠ N = 扇出后跳过的**复用步数**, 周期 = N+1 步(引擎判据: 复用计数 ≥ N 即重扇; host:649 n=5 → 落点 1,7,13)。
     故 every_n:3 = 每 4 步扇一次(跳 3 步), 不是"每 3 步"。

### cadence 第四档: 节拍(定制, v4.4.0)

> 节拍模式图解(拍位落点/职能分工/成本账/可见性边界)见 `docs/tiered-rhythm.svg`;公开面(README 双语)已嵌该图。

三档都是「同一阵容、均匀周期」。节拍档把 refs 拆成两类角色、按不同周期轮转:

```
cadence: "tiered",
cadence_tiered: {          // 外置独立键——切回旧档时此键原样保留, 零丢失
  "initial": "steering",   // 首步拍型: steering(默认)|patrol|off
  "n": 4,                  // 巡检间隔: 每 n 步一次 flash 多路校订(2..21|null 关闭; 缺省 4)
  "m": 12,                 // 定调间隔: 每 m 步一次重模型方向判断(6..64|null; 缺省 3n)
  "anchor": 0,             // 1=复刻旧「主会话跳N」落点(仅配 m:null)
  "steering": ["kimi-coding/k3.1-pro@max"],  // 定调拍阵容; 空则回落 refs
  "patrol": ["…", "…"]     // 巡检拍阵容; 省略=沿用 refs(现役阵容原样平移)
}
```

- **定调拍(steering)**:重模型、思考顶格——管「方向对不对」,默认每 12 步一次(kimi 类 p50 17s, 长自主任务可接受; 交互短任务建议 m=null 关掉);
- **巡检拍(patrol)**:flash 多路——管「执行有没有漂」,每 4 步一次(阵容缺省=refs, 即现役形态);
- **非拍步**:冻结复用最近一拍的 guidance(缓存命中),零成本;
- **一拍一事**:某步恰逢定调+巡检重叠时只发定调拍(定调压制当位巡检);
- 谐波推荐 m=k·n:4/12(默认)·5/15·5/10·3/12·6/12·2/6;
- 模型对此**无感知**:编排词汇(拍/拍型/失败/规模)只存在于宿主侧 trace 与面板, 注入文本零痕迹(三不可见)。
- **配方级激活**:配方 cadence 选 `tiered`=引用同一份全局 `cadence_tiered` 参数表(顶层 cadence 保持 `user_turn` 亦可; 顶层或配方任一激活均生效; 无参数表时按缺省 4/12 点亮)。

#### 拍位阵容归属表(v4.4.0:「全局重模型定调 + 轻模型巡查」的落点)

**关键**:节拍档下有两个互不相干的阵容字段,配错就看不出意图:

| 位置 | 字段 | 作用 | 缺省 |
|---|---|---|---|
| 直配 | `refs` | 顶层默认阵容(非节拍档直接当 refs 用) | 四路 flash 最高档 |
| 配方 | `recipes.<名>.refs` | 该配方自己的 refs(节拍档下**仅作巡检拍回落池**) | 继承直配 |
| **全局参数表** | `cadence_tiered.steering` | **定调拍阵容=重模型方向判断**(全局共享, 配方级 tiered 也引用它) | 空=回落 refs |
| **全局参数表** | `cadence_tiered.patrol` | **巡检拍阵容=轻模型执行校订** | 空=沿用 refs(配方 refs 即巡检阵容) |

即「重模型定调 + 轻模型巡查」= 在 **`cadence_tiered.steering` 放重模型**(`@max`/`@xhigh` 思考顶格, 如 `kimi-coding/k3.1-pro@max`、`zai-coding-cn/glm-5.3@max`)+ **巡检拍沿用 refs**(refs 配 flash 轻模型)。面板「节拍参数」区直接编辑这两行; 配方自己的 `refs` 不用动。

**当前拍的可见性(v4.4.0)**:dock 横幅显示 `●定调` / `○巡检` / `·冻结` 徽标, 并显示聚合器模型名(`AGG: <model>`); 轨迹面板每轮列出拍位。编排词汇只在这两个宿主面可见, 不进 guidance 文本。

**subagent 门控新增两态**(配合节拍档):`beat{lane,every}`=子会话固定每 N 步一次单拍扇出(patrol 防漂移校订 / steering 周期方向复评, 适合 M 级主题包工兵);`replica`=子会话按自身节律跑完整引擎(适合 L/XL/foreman/AgentTeams 队长系)。原有 passthrough/every_n/full 不变。

**守卫(v4.4.0 起常开)**:refs 与 agg 流均有退化守卫(重复循环检测), 检出即剔除该路——不重发不降档(与思考强度无关);面板**末尾**「🛡 守卫健康」卡以表格显示各模型失败/剔除/中止/超时/警告计数(用户可见、模型不可见); 账本落 `~/.dsh/moa-native-health/guard-YYYYMMDD.jsonl`。`{"guard":{"enabled":false}}` 可整体旁路。

  **泳道桶只收真泳道**(2026-11-04 实测修正):判定=lane 优先、次取 beat,但两者都须是 `steering`/`patrol` 才入桶;冻结步(`beat="none"`)、初始拍(`beat="initial"`)、非节拍档(`beat=null`)一律不入。原判据 `lane || beat` 会把冻结步算成一条名为 `none` 的伪泳道(面板实锤出现过「none (2事件)」)。事件本身仍全计入 `total` 与 `byModel`,只是不进泳道桶。
  → 折中: 成本约一半, 意见每两步刷新
```

**"⟲ 复用"就是缓存复用**——同一轮内意见原文不变直接再注入(不重跑模型),面板轨迹里 ⟲ 标记的轮就是它;跨轮**永不**复用(每条新消息重新咨询)。STALE 前缀如实告知时序,防止模型重放已完成的工具调用。

**怎么选**:
- **对话/问答/单文件小任务** → `user_turn`(默认,足够——"任务该怎么做"的意见在一轮内不会变质)
- **长工具链**(连续跑代码/多文件改写/迭代验证)→ `per_iteration` 或 `every_n×2`(扇出后跳 2 步再算, 周期 3 步; 意见随局面演进,但成本×步数)
- 拿不准 → 先用默认,看轨迹面板里各轮耗时再调

## 四、当轮发生了什么(流程)

```
你的消息(/moaR|/moaF|/moa 前缀)
   │ agent/pre-step: 前缀剥除+标记模式(唯一能改 messages 的点)
   ▼
agent/request: 路由改写 → 伪路由 moa-native/{default|配方名|ref|full}
   ▼
llm/stream 拦截(只认伪路由):
   ├─ R: 裁剪视图(persona+折叠) / F: options 原样镜像+尾部提示
   ├─ refs 并行直调(真实槽位; 失败如实标注不换路)——全程进运行轨迹
   ▼
guidance 拼装(各路意见, 独立尾随 user message 注入——绝不合并进你的消息)
   ▼
改写回真实 aggregator 槽位(完整工具循环)→ 回答
```

- 同轮工具迭代**复用**缓存 guidance(user_turn 档);已有工具活动时自动附 STALE 标注
- **guidance 是请求级注入,不写会话历史**——会话内回查(含 refs 镜像)看不到 [reference] 原文属正常;要看原文去控制台「运行轨迹」
- refs 全部失败 → 跳过注入,aggregator 正常回答(MoA 永不卡死);60s 负缓存防故障重跑

## 五、配置文件(面板背后,可直接手编)

`~/.dsh/profiles/web/moa-native.config.json`(热读):

```jsonc
{
  "mode": "F",                    // "R"|"F"|缺省=按配方绑定(兜底 F)
  "recipe": "",                   // 面板选定配方(provider 页手选配方名时被覆盖)
  "recipes": {                    // 配方=完整配置预设包(无内置, 全用户自建)
    "旗舰R": { "refs": ["kimi-flagship", "glm-flagship"], "aggregator": "kimi-flagship", "mode": "R" }
  },
  "refs": ["qwen-token-plan-anthropic/qwen3.8-flash@xhigh", "..."],  // 直配(default; 出厂=四路 flash 最高档)
  "aggregator": "zai-coding-cn/glm-5.3-Flash@max",
  "slots": { "native-ref1": "zai-coding-cn/glm-5.3-Flash@low" },  // 独立槽位
  "disabled_models": ["provider/model"],      // 模型开关
  "cadence": "user_turn",         // "user_turn"|"per_iteration"|{"every_n":3}
  "settle_ms": 2000, "reference_max_tokens": 4096,
  "ref_deadline_ms": 600000, "ref_idle_ms": 240000,  // refs 单路闸(全局; 面板无编辑面, 手编此文件)
  "ref_overrides": { "kimi-coding/k3.1-pro@max": { "reasoning_effort": "low" } },  // 键=refs[] 项的原样字符串(含 @effort), 写错静默失效
  "trace": true,                  // 运行轨迹(默认 true)
  "debug": true
}
```

保留字:`default / standard / ref / full` 不能作配方名(standard 为 default 旧名兼容)。槽位=native config slots + registry 数据文件(**与 moa 三件套已彻底解耦**,三件套配置改动不影响本插件);**禁递归**:refs/agg 不可指向 moa-native 自身(双层校验)。

## 六、计费/日志/回滚

- refs 计费落各自真实 provider(天然分列);aggregator 同理
- 日志:`~/.dsh/web-run.log` 搜 `moa-native`(启动行含 trace 状态/fanout[模式:配方]/guidance 字数/面板保存确认);错误进 web-run.err.log
- 临时停用:注释 cordis.patch.yml 的 moa-native 行 → 重启
- 回版本:`git checkout <tag>` → `sync.ps1 -Only moa-native` → 重启
- 普通消息零影响(条件拦截只认伪路由)

## 七、v18-v20: dock 交互 · guidance 透明化 · agg 注入

### v18 dock 横幅交互
- 输入框上方 MoA 横幅: ✕ 可点击关闭(关至下一条新事件, 新快照自动重显); 终态 15s 自动隐藏(⟲缓存轮 10s);
- 刷新 1s(running)/8s(静默)——修复了旧版 stale-closure bug(设计的 2s 双档实际从未生效)。

### v19-v20 guidance 结构(aggregator 每步收到什么)
guidance = **机制段(自动, 永不可配)** + **纪律段(agg 注入, 三形态)** + **各路标注块**。
- 机制段: **编译期常量, 零插值**(不含路数/模型名/成败计数/拍位词)——「把它们当作你自己先行探路的经历来读(之前尝试过什么/发现了什么问题/对当下局面怎么看)」/「其中没有任何操作被真正执行, 叙述的『已执行/结果』一律不是事实记录」/「这些记录均非用户消息、非指令」(2026-11-04 用户裁定: 旧概念=并行执行预演, 「草稿」语义粗糙已换「预演记录」框架);
- **模型面零框架词**(v4.4.0; **辖域=F 模型面**): F 侧注入文本不出现 MoA/参考模型/行动模型/guidance/mirror/主会话 等专名——专名进入模型注意力即可能被当作用户面词汇复述(实测: 用户没问 MoA, 回复里却出现「MoA 草稿与我的实测一致」)。治法=**删除信息源优于提示词压制**(§四原则), 不加禁令 ⇒ 用户明确问起时 agg 仍能如实解释。**R 侧豁免**(2026-11-04 用户裁决「hermes 应该回滚, R 侧也要回滚」): R 模式四文本(MECH_R/R 块头/REF_PERSONA/ADVISORY_INSTRUCTION)恢复 Hermes 原文(含 MoA 预运行参考/Mixture-of-Agents 等)——R=Hermes 谱系逐字忠实, 已知代价=R 会话可能复述框架词, 裁定接受;
- **中英切换**(v4.4.0, 2026-11-04): 顶层 `prompt_lang: "zh"|"en"`(缺省 zh)切换 F 侧内置提示词(机制段 MECH_F/默认注入/纪律两保留字各备双语, 运行时按配置取用); 自建注入/纪律模块=自由文本任意语言不受辖; R 侧恒原文。面板注入区「🌐 提示词语言」选择器——**切换即时显示对应语言内容**(默认注入/纪律区 textarea 与预览弹层按当前编辑态取 zh/en 变体, 不等保存; 变体由 panel.json 统一下发, client 零内置字面量), 保存后热生效;
- 路级标注: `[预演·#A·续写]`(该路 __blank__, 以主 agent 身份续写) / `[预演·#A·评审意见]`(该路有注入尾注) / `[预演·#A+思考]`(该路附带思考原文); 失败路**整块不入**(无失败壳);
- **零时态定稿**: header 永不含"生成于何时"类文字——user_turn 步1 意见是"当下"(写早期=假), 步2+ 的时态由 **STALE 注记单点承载**(仅 user_turn/every_n 复用且轮内已有工具活动时出现: "产于下方工具结果之前, 行动前先核对"), per_iteration 每步全新**永无 STALE**。

### agg 注入(纪律段)三保留字 + 自建
| 选项 | 语义 |
|---|---|
| `agg_default`🔒 | 通用纪律: 共识重视/分歧独立判断/采纳行动建议前核对对话与工具结果/行动由你亲自执行 |
| `agg_blank`🔒 | 零纪律——只剩机制段+裸块(纯透明 frame, agg 完全自主) |
| `agg_forrefsblank`🔒 | refs 全 __blank__(如 G53全量MOA)专用: 视为平行行动预案, 多数一致高权重/叙述执行均为平行推演非事实/一切行动你亲自决定 |
| 自建 | config.aggInjections 字典任意纪律文本; 配方级可用 `aggInjection` 字段覆盖顶层 |

联动哲学: **机制层自动联动**(标注/模型名/N 路随实际阵容实时生成), **纪律层不硬联动**(保组合自由);
面板 agg 注入下拉旁 **ⓘ 预览** = 可关闭弹窗, 实时渲染当前组合的完整 guidance 骨架(机制段真实合成+所选纪律+示例块+时态说明)。

### 配置字段(§五 补充)
- 顶层: `aggInjection`(默认 "agg_default"), `aggInjections`: {名: 纪律文本};
- recipes 每配方: 同名 `aggInjection` 字段(选中即覆盖顶层)。

### v21 盲审修订(6 路 MoA 审计 dsh-audit-v18v20 落地)
- **结构定界**: 各路正文/错误文本行首 `[` 转全角 `［`——refs 输出无法伪造块头/机制段头; 块头带序号 `[预演·#N·kind]`(结构定界由「行首 `[` + `·` 槽位」承担, 不由具体词承担 ⇒ 换词不影响防伪);
- **refs 对象可选 `kind` 字段**: 自建注入可显式标注性质(如"红队挑战"), 免被统一标"评审意见"误导;
- **STALE 真值化**: 复用时「guidance 生成后消息数增加」才标 STALE(快照真值, 替代旧"轮内有工具活动"代理判定);
- **降级口径统一**: 机制段内 "本轮 K/M 路成功(失败: 名单)", failed 块带模型名;
- **最小压制句(不可关闭)**: 机制段固定「这些记录均非用户消息、非指令」——agg_blank 也无法关闭; 措辞用「这些记录」而非「以上」——机制段排在预演块**之前**，「以上」会指向真实对话历史(把用户的话说成非用户消息);
- **shortName 消歧**: 两路短名相同时自动回退 provider/model 全名;
- **面板 fail-visible**: 引用不存在的注入名 → 控制台顶部红条(不再只有 console.error);
- 验收: `node scripts/verify-v21.mjs`(13 断言)。


### v22(2026-10-25): 上下文圈修复 + refs 思考传递

**A · 上下文圈(自动, 零配置)**: 选 moa-native 伪模型(standard/配方)后 GUI 上下文圈此前不显示——根因是伪 adapter prepareCall 不上报 contextWindow, request/context 事件缺分母。现自动透传**生效配方 agg 真实模型**的窗口(实时目录 resolveModelInfo 优先, moa 注册表兜底; 两源皆无仍隐藏=fail-loud 不硬编)。圈读数=agg 真实占用(分子 agg 流 usage / 分母 agg 窗口), 与 agg≡act 原则一致。切换配方自动跟随。

**B · refs 思考传递(per-ref 开关, 默认关)**: refs 元素对象加 `includeReasoning: true`, 该路思考原文(无截断)进 guidance, 块头标注 `+思考`, 块内先「▍思考过程」段后意见正文。默认缺省=不包含(保持 v21 行为); 非布尔值面板红条告警。

```json
{ "refs": [
    "qwen-token-plan-anthropic/qwen3.8-flash@xhigh",
    { "model": "minimax-cn-proxy/MiniMax-M3.1-Flash@max", "includeReasoning": true }
] }
```

### v23(2026-10-26): eval 盲测端点——moa-native vs 单模型 A/B

**用途**: 把 moa-native(伪 provider 完整管线)与直连单模型做同题盲测对比(消融: 同 agg 档位下 refs 辅政的净增值)。

| 通道 | 说明 |
|---|---|
| `POST /moa-native/eval.json` | body `{dataset?, limit?, offset?, arms?, baseline?, judges?}` → 启动后台 run |
| `GET /moa-native/eval.json?run=<id>` | 查进度 + summary(胜率/长度/耗时/token) |
| `GET /moa-native/eval.json` | 列历史 runs |

- **arms** 缺省 `[{name:"G53全量MOA"},{name:"default"}]`(moa-native 配方; 也可给 `{provider, model, effort}` 直连第三方模型作对照); **baseline** 缺省 `zai-coding-cn/glm-5.3@max`; **judges** 缺省 `kimi-coding/k3.1-pro + deepseek-official/deepseek-v4-pro`(刻意避开 glm 系——A 路 agg 即 glm, 有自我偏好风险);
- **裁判协议**: 每 (arm, judge) 位置互换判两遍(`[[A]]/[[B]]/[[tie]]`), 两序不一致→tie; 跨 judge 不一致→tie(保守合成); judge prompt 明示忽略长度差异;
- **管线自检**: A 路调用前后查 traceRing, 无 fanout/cache 事件则该题记 `moaPipeline:false`(防 purpose 标记静默绕过拦截器);
- **产物**: `~/.dsh/moa-native-eval/<run_id>/{meta.json, gen.jsonl, judge.jsonl, summary.json}` 逐事件 append, 可审计可复算;
- **约束**: dataset 路径白名单(`~/.dsh/moa-native-eval\` 或 `~/.dsh/moa-native-eval/`), limit≤100, POST body≤8MB;
- **题集**: Arena-Hard v2.0(750 题=coding253/math247/creative250)下载于 `~/.dsh/moa-native-eval\data\questions.jsonl`, 分层抽样 `pilot50.jsonl`/`smoke3.jsonl`(seed 42 可复现)。

**读法**: `summary.pairs.<配方名>.win/lose/tie` = 该配方 vs baseline 胜负(保守口径, tie 偏多属正常); `summary.gen.<arm>.avgChars/avgMs/inTok/outTok` = 生成侧计量; `win+lose)/(judged)` 显著>50% 才是真实信号, 50 题试点建议同时看 moaPipeline 计数是否等于题数(管线全触发)。

成本提示: guidance 在请求尾部(前缀缓存之外), 每步 agg 全价重付; N 路 max 档思考可撑 guidance 至 20k-50k tok。开启后上下文圈分子如实上涨=成本显式可见。思考永不进会话历史(guidance 下一步蒸发)。

### v27(2026-10-28): subagent 门控 + 预运行框架

**A · subagent 门控(默认只给主会话)**: 子会话识别=会话头 `origin:'subagent'` 或 `delegationDepth>0`(创建即定, 只读一次缓存; 判不出=按主会话, 门控只收紧子会话不误伤)。三态 `subagent_policy`(控制台「subagent 门控」下拉, 全局字段不随配方):

| 值 | 行为 |
|---|---|
| `"passthrough"`(默认) | 子会话零扇出零注入, 直转 aggregator 真实路由(只付一次 agg 成本) |
| `{"every_n": N}` | 子会话每第 N 次被拦截请求放一次完整 MoA(第 1 次必扇; 计数按会话累计, purpose 辅助调用不消耗) |
| `"full"` | 旧行为: 子会话与主会话同权全扇 |

主会话永远不受门控影响; /moaR//moaF 斜杠显式触发在子会话同样过门控(想显式放开=配 every_n)。

**B · 预运行框架(guidance 机制段重写)**: 机制段从「参考输入」改为「预演记录」(2026-11-04 前一度用「草稿」, 用户裁定语义粗糙——旧概念=并行执行预演)——明示各路是 agg 本人在同一局面下先跑过一遍的预演(之前尝试过什么/发现了什么问题/对当下局面怎么看), agg 是唯一执行者, 结尾固定「对照它们核对自己的判断, 再超越它们作答」。(v4.4.0 起该段**不再含 MoA/参考模型等专名**, 见 v19-v20 节「模型面零框架词」。)**实用推论**: 与 aggregator 同模型的 ref 边际价值低(≈自己预演一遍自己), 阵容里可去掉该路省一路成本——默认四路阵容中的 glm-5.3-Flash ref 与 agg 同模型, 可按此裁撤。

- 验收: `node scripts/verify-v27.mjs`(策略解析/门控计数/机制段文本/client 序列化往返断言)。

### v4.3.7(2026-10-30): 伪模型视觉模态派生(修 read_image "does not declare image input")

**问题**: 伪模型此前三处硬编码 `inputModalities:["text"]`——选 moa-native 配方的会话里 `read_image`/贴图被宿主入口闸(dsh-acp 按会话路由的模态声明判定)拒绝, 即使配方成分(如 qwen3.8)实际有视觉。属「假阴性」: LLM 层对 text-only 路本有图片投影降级(dsh-llm projectImagesForTextModel), 闸门声明才是唯一卡点。

**修复(用户裁定: C 并集口径+显式开关+完全自洽)**:
- **派生(默认)**: 伪模型广告 = 生效配方成分(agg∪refs)目录声明的**并集**——任一成分有 image 即 `["text","image"]`。红利: vision refs 看图→guidance 转述给 text agg(「视觉转述」MoA 特有形态)。
- **自洽性**: 闸门只承诺入口; 数据流各成分按自身声明治理——text-only 路自动收图片投影占位, 不炸; 声明视觉永不产生任何一路处理不了的请求。
- **显式终裁(与成分零偶联)**: 配方级/顶层 `inputModalities: ["text"]|["text","image"]` 强制覆盖派生(面板「视觉」三态下拉: 派生·并集/仅文本/文本+图像; 切回派生=null 显式清除不残留)。~~`model_modalities` 每模型纠偏表~~ v4.3.8 移除——单一事实源=DSH 设置页·模型条目·输入类型(目录错在源头修, 派生 30s 内自动跟随)。
- **工程形态**: 目录快照缓存(启动预热+30s TTL; 空目录不盖 TTL=恒重试, provider 就绪后秒级自愈); listModels(同步)读缓存, resolveModel/prepareCall(异步)刷新后重算——read_image 闸经 resolveModelInfo→resolveModel 拿到新鲜值。派生审计行打成分明细(每路 vision/text+来源 catalog/unknown)。
- 附带修复: v21/v22 verify 陈旧锚点(v27 文案变更遗留); `git stash` 会经 autocrlf 重写工作区行尾(LF→CRLF 破坏多行提取式断言), 已恢复——对照基线勿用 stash, 用 `git show HEAD:file`。
- 验收: `node scripts/verify-v28.mjs`(36 断言: 派生行为 7/normMods 5/源码结构 8/配置层 5/client 往返 8/版本 1); 七套全量回归绿。

### v4.3.8(2026-10-30): 影子层移除 + 设置时视觉提醒

- **model_modalities 移除(用户裁定"多此一举"成立)**: DSH 设置页模型条目本身有输入类型编辑器(text/image 复选框写回 profile 覆盖 catalog)——模态唯一事实源在设置页, 影子备份层违背单一事实源; 旧配置带该字段=面板红条弃用警告(fail-visible)。派生签名 4 参→3 参(目录快照唯一来源)。
- **设置时提醒(用户需求"设置的时候提醒全部具有视觉或缺少视觉回退文本")**: ①ref 行与 agg 行 **👁/📄徽章**(悬停提示: 视觉模型可看图/纯文本自动投影降级/无声明按文本计), 数据=host models 端点顺路收集的 modsBy(零额外调用); ②**视觉构成汇总行**: "refs N/M 路有视觉, agg 有视觉(图像直达)/纯文本(vision refs 看图转述)"——设置阵容时即见全链路视觉口径; ③模型视觉修正入口指路(设置页·模型条目·输入类型, 改后 30s 派生自动跟随)。
