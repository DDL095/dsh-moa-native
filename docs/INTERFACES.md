# moa-native 技术参考与 DSH 升级恢复对照

> 用途:①排查链路问题时查契约;②**DSH 破坏性升级后对照恢复**(每条依赖附验证方法)。
> 配套:[GUIDE.md](../GUIDE.md)(用户手册)· [TEST-SOP.md](TEST-SOP.md)(测试手册)· [设计文档](../../docs/DSH-MoA-v4-native-design.md)。

## 一、三事件契约(agent 生命周期)

| 事件 | 时机 | 返回语义 | 陷阱(实测) |
|---|---|---|---|
| `agent/pre-step` | 每轮消息进入前 | 返回 `{kind:"enter", messages}` 可改消息;`next()` 放行 | **唯一能看/改 messages 的点**;返回 enter 后下游以改后版本为准 |
| `agent/request` | 每次模型请求前 | **消费端 await**——listener 可为 async;返回改写后的请求配置 | waterfall 语义:返回值直接成为请求配置 |
| `llm/stream` | 每次 llm.stream 调用 | **消费端不 await**——listener 必须**同步**返回 AsyncIterable | ⚠️ async listener 会把放行 next() 包成 Promise,**污染全进程所有 llm.stream**(headless 实测炸点);拦截主体放 async generator(消费端迭代时才执行) |

## 二、llm 消息与请求契约(dsh-llm)

refs 直调与探针共用的请求形态(违反即 throw/静默失败):

| 契约 | 正确形态 | 违反后果(实测) |
|---|---|---|
| content parts | `[{type:"text", text}]` 数组 | 纯字符串 → `content.some is not a function` |
| assistant source | 消息带 `source: {kind:"model", provider, model}` | 无 source → `forAdapter` 读 `.replayState` 报 UNKNOWN(dsh-llm 假设 assistant 必带 source, forAdapter:2271 附近) |
| system | 请求顶层 `system` 字符串字段 | 塞 messages 里 role:"system" 行为不可预期 |
| resolveCallConfig | `await llm.resolveCallConfig(base)` 展开 provider 默认档,失败回退 base | 缺失时 effort/方言不兼容 |
| tools | OpenAI 形状 `[{name, description, parameters}]` | — |

## 三、伪 provider(registerAdapter)

- `ctx.llm.registerAdapter([PSEUDO], adapter)`,PSEUDO="moa-native"
- `buildPseudoModels()` 动态:**default(默认配置,摘要动态)+ 每个配方一个 model 选项**(配置即模型);ref/full 为兼容遗留直配入口(保留字 `PSEUDO_RESERVED=["default","standard","ref","full"]`,standard=default 旧名)
- ⚠️ **efforts 必须全档声明且每项 `{id, name}` 双字段**(少 name → INVALID_MODEL_REASONING;不声明 → 任何来源 effort 传入都 UNSUPPORTED_REASONING_EFFORT 硬炸,因 prepareCall 的 effort 校验链被激活)
- adapter.stream 到达=拦截器失守 → 显式 MOA_NATIVE_INTERCEPTOR_MISS 错误流,不静默

## 四、工具注册契约(ctx.tools.register)

```js
ctx.tools.register({
  name, description, timeoutMs: undefined,   // 顶层字段
  parameters: { type:"object", properties },
  output: { schema: {type:"object", additionalProperties:true},   // 开放根
            render: (args, value) => [{type:"text", text}] },     // 模型唯一可见通道
  async execute(args) { return object; },
});
```

⚠️ OpenAI function 包装(`{type:"function", function:{...}}`)→ 拒绝:`tool "undefined" must declare output {schema, render}`(2026-10-24 实锤)。工具 timeoutMs 不声明=官方无死线。

## 五、config schema(moa-native.config.json,热读)

字段全表:mode("R"|"F"|缺省)· recipe(string)· recipes({name:{refs[], aggregator, mode?, cadence?, settle_ms?, reference_max_tokens?, debug?, **cadence_tiered?**}})· refs[]/aggregator(直配)· slots({name:"provider/model[@effort]"})· disabled_models[] · cadence("user_turn"|"per_iteration"|{every_n}|"tiered")· **cadence_tiered({initial:"steering"|"patrol"|"off", n:2..21|null 缺省 4, m:6..64|null 缺省 3n, anchor:0|1(=1 仅配 m:null), steering:[…], patrol:[…]?})**(v4.4.0; 顶层或配方 cadence="tiered" 均激活; **配方可带私属 cadence_tiered 整体替换全局**(同键同构, recipeTieredParams 单点消费, 2026-11-04 用户实锤「共享致改一定调全体跟变」), lane 条目支持 `"provider/model@effort"` 字符串或 `{model, injection}` 对象(2026-11-04 用户裁定 lane=refs 子集: **字符串/对象缺 injection 键=随 refs 继承**——refs 全体同一注入名则承之(全 `__blank__` ⇒ lane 也 blank), 不统一落默认并 debug 记录; **显式注入(含 `__default__`)须对象形态**, 不被继承覆盖); 无私属表的 tiered 配方=引用全局参数; 外置顶层键切回旧档零丢失; n:1=per_iteration 迁移 canonical 特例; 配方 tiered 无任何参数表时按缺省点亮)· **prompt_lang("zh"|"en", 缺省 zh; 非法 warn 后按 zh)**(2026-11-04 用户指令)——切换 **F 侧内置提示词**(MECH_F 机制段/默认路注入/agg 纪律两保留字各备 zh/en 双份, 运行时经 injDefaultOf/aggDiscipline*Of 取用, guidanceBlock 带 lang 形参透传 E.promptLang); 自建注入/纪律模块=自由文本任意语言不受辖(用户语言自由度通道); **R 侧(Hermes 谱系)不参与切换恒原文**(2026-11-04 用户裁决回滚: MECH_R/R 块头/REF_PERSONA/ADVISORY_INSTRUCTION 恢复 23c611c 前原文——零框架词不变式收窄到 F 模型面)· subagent_policy("passthrough"|"full"|"replica"|{every_n:N}|{mode:"beat",lane:"patrol"|"steering",every:N})· guard({enabled:false?} 缺省开)· settle_ms· reference_max_tokens· **ref_deadline_ms / ref_idle_ms**(v4.4.0; refs 单路总超时/无 chunk 静默闸, 缺省 600000/240000, 域 30000..3600000)· ref_overrides({label:{reasoning_effort, reference_max_tokens, deadline_ms?, idle_ms?}})· trace(默认 true, 运行轨迹)· **guidance_anchor(boolean, 缺省 true=开; 仅显式 false 才关)**(v4.5.0 缓存友好化核心特性)——预演记录(guidance)【钉在产出它的那一步】的位置, 而非每步末尾追加: provider 缓存按**最长公共前缀**匹配, 尾随形态下预演记录落在请求末尾、下一轮不在同一位置 ⇒ 公共前缀只到拍点历史 ⇒ 预演记录每步重新计费; 定点形态 [拍点历史][预演] 逐字节稳定 ⇒ 整段命中, 每步只付新增量。**对全部 cadence 档生效**(user_turn/per_iteration/every_n/tiered——注入点在 fresh/冻结分支之外, 与拍位无关)。锚点按**消息 id** 定位(不用下标: surface replace 会移动下标), 且**随缓存条目存取**(真扇出时记录、冻结复用时取回; 现算当次末条会漂移并退化成尾随)。护栏: 不改原消息数组(refs 镜像仍干净, 无回声自激)/ 不插在 assistant tool_use 与其 tool_result 之间(Anthropic 系要求相邻) / 锚点缺失或不安全 ⇒ 回落尾随(安全退化)。实测(2026-11-05 冻结步对齐 trace): 尾随期未缓存均值 3,308 tok → 定点期 1,931 tok(同会话 -36%), 命中率 p50 99.15%。面板开关在 debug 旁, 关闭时显红字警示。设计全文见 docs/GUIDANCE-ANCHOR-DESIGN.md)· debug。

v4.4.0 节拍语义(trace entry 新字段):fanout 轮携带 `beat`("initial"|"steering"|"patrol"|null)与 `lane`("steering"|"patrol"|null)——宿主侧编排观测, 注入文本零拍位词汇(§一编排不可见);fanout 轮另带 `aggPlan`({provider, model, effort})=规划期即解析的聚合器(供 live.json 在 refs 跑完前显示聚合器模型名);守卫账本 `~/.dsh/moa-native-health/guard-YYYYMMDD.jsonl`(schemaVersion=2, 12 字段, event∈detect/abort/dropped/ref_fail/timeout/warn; sample 凭证脱敏; **beat/lane=序2 回填**——v4.4.0 前 beat 恒 null, 现由 tr.beat/tr.lane 透传进四个 guardLedger 调用点(ref 终检/思考超长/ref 失败/agg 流), 拍位维度是用户判断「重模型定调路稳不稳」的唯一依据);panel.json 新增 `health`(guardHealth(2) 聚合: byModel×ref_fail/dropped/abort/timeout/warn + **byLane**×同五桶(序3 v3.9 扩展「每 lane 健康位」, 面板渲染「●定调/○巡检」泳道表; **v4.4.0 判据修正**=lane 优先/次取 beat, 但二者均须 ∈{steering,patrol} 才入桶——冻结步 `beat="none"` 与初始拍 `beat="initial"` 不入桶, 防臆造出名为 `none` 的伪泳道; 事件本身仍全计入 total 与 byModel))。guidance 模型面: 机制段=MECH_F/MECH_R 编译期常量(零插值), 失败路整块不入(无壳), STALE 只在 trace/UI(宿主侧)。**v4.4.0 模型面零框架词(泄漏链治本)**: 实测用户没问 MoA, agg 回复里却出现「MoA 草稿与我的实测一致」——根因=注入文字含 "MoA" → 进入模型注意力 → 模型把它当成可对用户使用的词汇。治法=**删除信息源优于提示词压制**(§四原则, 不加禁令 ⇒ 用户明确问起时 agg 仍能如实解释)。模型面三层文本(机制段 MECH_F/MECH_R / 路注入默认 INJECTION_DEFAULT_TEXT / agg 纪律段两保留字)一律禁 MoA·参考模型·行动模型·参考意见·guidance·mirror·主会话 等专名; 块头 `[reference·#A·kind]` → `[草稿·#A·kind]`(结构定界由「行首 `[` + `·` 槽位」承担, 不由具体词承担); 工具调用意图尾注去「参考模型」但保留「未执行」+「差异与偏好」语义(用户 2026-10-25 裁决); R 模式 system 人设 REF_PERSONA 去 "Mixture-of-Agents" 全称(system 层比 guidance 更上游); eval 探针面同口径。**承重句不得随删词一起删**: 「其中没有任何操作被执行」/「已执行/结果一律不是事实记录」/「非用户消息、非指令」/「相当于你本人的提前预演」+「核对与超越」/「采纳前先核对」。另: 机制段排在草稿块**之前** ⇒ 指代须用「这些草稿」而非「以上」(「以上」会把真实对话历史指为非用户消息)。**§四 配置侧禁令**(2026-11-04 落地): 自建注入/纪律段含比值·路数·成败计数或框架词时, loadConfig 出提示级 warning(不阻断——用户显式决策优先, 但让代价可见)。

v4.4.0 cadence 标签契约(档位判定**语义同源、字面各面本地化**):host `cadLabel` 与 client `cadTag` 同规则不同字面——`"tiered"`|`{kind:"tiered"}` → host `tiered` / client `tiered·节拍`(顶层 cadence="tiered" 时 cfg.cadence 归一为 `{kind:"tiered"}`, 与配方级 effCadence 同形);`"per_iteration"`|`{kind:"every",n:0}`|`{every_n:0}` → host `per_iter` / client `per_iteration`;`{every_n:N}`(N≥1) → host `skipN` / client `跳N步`;其余 → `user_turn`。标签面须如实反映档位——节拍档不得显示为 `user_turn`(旧实现两处均无 tiered 分支, provider 页与面板把节拍配方谎报为 user_turn)。provider 页配方 description 追加节拍参数摘要 `(定调每m步/巡检每n步)`, 且节拍档措辞为「按节拍引擎跑(定调/巡检/冻结三态)」而非「每轮用此配方」(非拍步=冻结复用, 并非每轮重扇)。

v4.4.0 配方 cadence 三态与继承契约(往返保真, 2026-11-03 实测修复):**配方未设 cadence 必须保持「无此键」**, host:1654 的 `E.tiered` 三支判定据此分派——①配方 `cadence==="tiered"` → 激活节拍;②配方显式旧档(`user_turn`/`per_iteration`/`{every_n}`) → 非节拍档;③配方**未设** → 继承顶层激活位 `cfg.tiered`。往返链(client 读回 → 编辑态 → 保存 → 盘上)必须保真: client 配方侧用三态(`""`=未设, 同本文件 mode 字段的「不绑定」惯用法), 顶层直配保留 `user_turn` 二态(顶层必有档, host 缺省即 user_turn); 序列化门 `if (r.cadence)` 下 `""` 为 falsy 故不写键, 且 `cadOut("")` 必须返回 `undefined`——否则末臂兜底会把空串写成 `{every_n:2}`(比原缺陷更贵: 直接把顶层档改掉)。原实现 `normCad` 把未设归一成 `"user_turn"`(truthy) → 保存时落盘成**显式** `user_turn` → 继承支永远走不到。面板 cadence 下拉在配方态须提供「未设·继承顶层」项(否则浏览器视觉回落首项 `user_turn` = 同一类谎报, 且用户无法改回继承); 斜杠生效预览须显示**生效**档位(配方未设时=顶层档), 非编辑态原值。显示侧节拍判定(`recipeTieredParams`)与运行侧 `E.tiered` 三支同语义; lane 阵容并集(`pseudoModsForSync`/`pseudoModsAsync`)的条件同样须覆盖「配方继承顶层」与「顶层自身 tiered」两支——原条件只认配方自身 `tiered`, 漏报使实际会跑的 steering 视觉模型不被计入伪模型广告面(欠报 text+image ⇒ 贴图被闸门拦)。

v4.4.0 超时终态(v4.4.0 用户裁定「不要让慢模型被抛弃」):refs 单路被看门狗判死时终态为 `status:"timeout"`(≠"failed"), 结构化码 `REF_DEADLINE`/`STREAM_IDLE`;该类不再盲重试(本地定时器判死, 重发必再超时);`live.json` 的 refs 投影带 `s:"timeout"` + `e`(脱敏错误), dock 显示 ⏱;per-model stats 的 `timeouts` 单列且**同时计入 fails**(新增终态不得让丢失的路从失败率里消失)。生效闸值优先级=逐槽 ref_overrides[label].deadline_ms/idle_ms > 全局 ref_deadline_ms/ref_idle_ms > 常量缺省。

槽位两层解析(§七解耦后):**native config slots > registry 数据文件(~/.dsh/DSH-MoA-model-registry.json)**——moa.config.json 层已砍除(2026-10-24 用户指示彻底解耦)。模式优先级:`/moaR·/moaF` 显式 > 配方 mode 绑定 > config.mode > **"F" 兜底**(2026-10-24 用户裁定, 实测 F 缓存最优)。

## 六、面板数据通道(TypertRemoteService)

- host:`ctx.provide("nativeCfg", {list, models, efforts, trace, save})` + webServer 挂 Gateway(serviceKey=**nativeCfgGw**, namespace=nativeCfg;⚠️ 不得与 provide 同名,同名二次注册 throw)
- ⚠️ **typert 形参契约(2026-10-24 实锤)**:gateway prototype 方法**形参名必须与 client $mount descriptor 的 parameters[].name/wire 完全一致**——host 的 typert.local 无 strict 定义时走 SRC fallback,按 prototype 形参名校验(dsh-api-gateway `assertExactArguments`),不一致报 `args fields do not match the descriptor: unexpected "X"`(save 形参 p≠client patch 潜伏两版才暴露;dsh-moa 同位 cfg=cfg 一致从未炸)。无参方法不受影响
- models() **双源**:ctx.llm.listProviders+listModels 实时(权威)+ MODEL_REGISTRY_PATH 注册表兜底(独立于 adapter 目录);efforts() resolveModel 失败时注册表 reasoningEfforts/thinkingBudgets 兜底
- client:`remote.$mount({package:"moa-native", descriptors:[...]})` 自挂;⚠️ **inject 不得含 "remote.nativeCfg"**(浏览器端第三方 ns 只能 mount 里注册,inject 等它=永久 pending 死锁——compactplus 教训);mount 后取 ns 用 `ctx.get("remote.nativeCfg")` 不走属性访问
- 静态 import 路径:`@deepseek-ai/dsh-typert-protocol`(bundle 形态经 peerDependencies 解析)(**DSH 升级后此路径变化=网关挂载失败, 面板 404**)

## 七、fail-loud 边界(设计性)

- refs 走 `ctx.llm.stream` 直调,**不经过 agent/request 瀑布** → model-fallback 插件(只挂 agent/request[-error])不辖——阵容无静默换路
- disabled_models 引用=日志告警不阻断;全部 refs 失败=跳过注入(60s 负缓存)

## 八、DSH 破坏性升级恢复对照表

升级 DSH 后逐项验证(顺序=依赖深度):

| # | 依赖 | 验证方法 | 失败症状 → 恢复 |
|---|---|---|---|
| 1 | 三事件瀑布(pre-step enter/request await/stream 同步) | 发 `/moaF 测试`,看 web-run.log 链路三行(前缀命中/路由改写/fanout) | 无路由改写行 → 事件契约变更,对照 dsh 源码 agent 循环 |
| 2 | forAdapter assistant source 校验 | subagent 发 /moa,refs 无 UNKNOWN | UNKNOWN/replayState 报错 → source 形态变更 |
| 3 | content parts 契约 | 同上,refs 无 content.some 报错 | throw → 消息序列化变更 |
| 4 | registerAdapter efforts 校验 | 启动日志"伪 provider 已注册"+GUI 下拉见 default+配方 | INVALID_MODEL_REASONING → efforts 声明要求变化 |
| 5 | tools.register 契约 | `moa_cache_probe` 裸名可调 | 工具消失 → 注册形状/output 要求变化(查 err.log) |
| 6 | TypertRemoteService import 路径 | 启动日志"nativeCfg remote 网关已挂载" | 面板 404/挂载失败 → npm 包路径变更,更新 import |
| 7 | remote.$mount descriptor 形态 | 面板加载 list 不超时 | 15s 超时 → descriptor/codec 形态变更(对照 moa 包同步修) |
| 7b | typert SRC fallback 形参校验 | 面板点保存返回 ok | `args fields do not match` → host 网关形参名与 client descriptor 字段不一致, 逐方法对齐 |
| 8 | settings.section 槽位 | 设置页见「MoA-Native 控制台」 | 分节消失 → 槽位注册 API 变更 |
| 9 | 模块加载(window.__ModuleLoader__) | 浏览器 console 无模块错误 | 面板空白 → loader 契约变更(对照 compactplus) |
| 10 | deepFreeze 历史前缀稳定性 | 跑 `moa_cache_probe {scenario:"mirror", turns:10}`,命中率 >85% | 骤降 → 组装链开始污染前缀(对照 moa 包同修) |

**升级 SOP**:升级 DSH → 重启 → 跑本表 1/4/5/6 四项快检(2 分钟)→ 全绿即恢复;任一红 → 对照"失败症状"列修 host.mjs/client.mjs → commit → sync → 重启复检。探针(moa_cache_probe)是第 10 项的常驻体检工具。

## v13/v14 新增(2026-10-25)

### GET /moa-native/trace.json?limit=N&ws=<wsDir>
- `limit`: 1-60(默认 60); `ws`: 非空=工作区隔离闸(只返回该 ws 轮次, entry.ws 优先/旧行动态反查 ~/.dsh/sessions/<wsDir>/<session-uuid>/)
- 响应: `{ ok, entries[](新→旧, 含 turnInSession/ws/restored/refs[].text advisory 原文/agg 计量), capacity, totalTurns(全部归档累计), sessions[]({sid,ws,turns,firstTs,lastTs,recipes[],running}), stats.refs[]({key,calls,avgMs,avgChars,fails})+stats.agg, prices(config 原样, 未配=null), cost(未配价格=null; 配了={outputTokEst≈chars/2, costEst 输出侧粗估}), workspaces[](有记录的 wsDir 清单) }`
- 成本读时计算不落盘(价格表会变); 单价表 = config `prices: { "provider/model": {in,out $/Mtok} }`

### trace entry 新字段(v13)
- `turnInSession`: 会话内真实轮次(Map<sid,n> 计数, 回填续号; `seq` 保留进程级流水号语义)
- `ws`: 工作区短名(如 `--D-my-workspace--`; 旧行无此字段=端点读出时动态反查)
- `restored`: 冷启动回填标记(host 启动时今日归档尾部 ≤60 条回填 ring)

