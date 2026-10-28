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

字段全表:mode("R"|"F"|缺省)· recipe(string)· recipes({name:{refs[], aggregator, mode?, cadence?, settle_ms?, reference_max_tokens?, debug?}})· refs[]/aggregator(直配)· slots({name:"provider/model[@effort]"})· disabled_models[] · cadence("user_turn"|"per_iteration"|{every_n})· settle_ms· reference_max_tokens· ref_overrides({label:{reasoning_effort, reference_max_tokens}})· trace(默认 true, 运行轨迹)· debug。

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

