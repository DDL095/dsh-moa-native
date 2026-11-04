/* moa-native client.mjs — 分层拓扑控制台 v3(两态: 使用态首屏+配置态折叠; DESIGN-CONSOLE.md 定稿)
 * 数据通道: ctx.remote nativeCfg(host 网关 nativeCfgGw: list/models/efforts/save)
 * 面板: settings.section "moa-native-console" — 保存热生效。 */
window.__ModuleLoader__.load({
	id: "dsh-moa-native",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		const React = require("react");
		/* inject 不得含 "remote.nativeCfg"(浏览器端第三方 ns 只能本模块 apply 里
		 * remote.$mount(...) 注册; inject 等它 = 永久 pending 死锁——compactplus 教训)。 */
		const inject = ["slots", "remote"];

		const inputStyle = { padding: "4px 8px", borderRadius: "4px", border: "1px solid rgba(127,127,127,0.4)", background: "transparent", color: "inherit", fontSize: "13px" };
		const boxStyle = { border: "1px solid rgba(127,127,127,0.25)", borderRadius: "6px", padding: "10px 12px", margin: "8px 0" };
		const hStyle = { margin: "0 0 6px", fontSize: "13px", fontWeight: 600, opacity: 0.9 };
		const hintStyle = { fontSize: "12px", opacity: 0.65, margin: "2px 0 6px" };
		const BUILTIN = []; /* 2026-10-24 15:25 用户裁定: 无内置配方——全部用户自建 */
		const splitEffort = (s) => { const i = typeof s === "string" ? s.lastIndexOf("@") : -1; return i > 0 ? [s.slice(0, i), s.slice(i + 1)] : [s, ""]; };
		const shortName = (s, slots) => (slots && slots[s] ? s : (String(s).split("/").pop() || s));

		function NativeConsole({ callCfg }) {
			const [st, setSt] = React.useState(null);
			const [pv, setPv] = React.useState(null); /* v20: guidance 组合预览弹窗(null|"agg") */ /* {models, err, saving, saved} */
			const [edit, setEdit] = React.useState(null);
			/* 2026-11-04 saveAs 数据丢失修复: 最近一次落盘的配方快照(加载时建, 保存成功时刷)。
			 * 用户实锤: 编辑配方 A(删 kimi 路)→「从当前编辑新建」B→保存 ⇒ A 带残缺态落盘(kimi 路丢失,
			 * A/B refs 同构)。「另存为」语义=新配方带走当前编辑, 原配方回到最近落盘态。
			 * 全链路更新均为不可变(Object.assign 新对象), 该引用恒净。 */
			const recipes0Ref = React.useRef(null);
			const [rn, setRn] = React.useState(null); /* §三十 v4.3.9: 配方行内重命名 {from, val, err} */
			React.useEffect(() => { (async () => {
				try {
					/* v8: HTTP 直读优先(panel.json 无 typert result 过滤), 失败回退 typert 通道 */
					let cfgRes = null, modelRes = null, healthRes = null;
					try {
						const r = await fetch("/moa-native/panel.json", { cache: "no-store" });
						const j = await r.json();
						if (j && j.ok && j.list && j.list.ok) { cfgRes = j.list; modelRes = j.models || {}; healthRes = j.health || null; }
					} catch { /* 回退 */ }
					if (!cfgRes) { [cfgRes, modelRes] = await Promise.all([callCfg("list"), callCfg("models")]); }
					if (!cfgRes || !cfgRes.ok) throw new Error((cfgRes && cfgRes.error) || "list 失败");
					/* v7: JSON 字符串直通优先(浏览器端 typert 对嵌套对象 result 有字段过滤) */
					const parseJsonField = (js, fb) => { try { const v = (typeof js === "string" && js) ? JSON.parse(js) : null; return (v && typeof v === "object") ? v : (fb || {}); } catch { return fb || {}; } };
					const raw = parseJsonField(cfgRes.rawJson, cfgRes.raw || {});
					const tieredReadBackDegraded = !((typeof cfgRes.rawJson === "string") && cfgRes.rawJson.length > 2) && !(raw.cadence_tiered && typeof raw.cadence_tiered === "object") && !Object.values(raw.recipes || {}).some((r) => r && r.cadence_tiered && typeof r.cadence_tiered === "object") && ((raw.cadence === "tiered") || Object.values(raw.recipes || {}).some((r) => r && r.cadence === "tiered")); /* v4.4.0 审计修复(client#2)+v4.4.0 扩展: typert 降级双丢哨兵——rawJson 直通串缺失且 raw 亦无参数表(全局或配方级)且盘上有 tiered 引用方 → 读回降级, 保存跳过该键防默认空阵容覆盖 */
					const v7provs = parseJsonField(modelRes && modelRes.providersJson, (modelRes && modelRes.providers) || {});
					const v7slots = parseJsonField(modelRes && modelRes.slotsJson, (modelRes && modelRes.slots) || {});
					const eff = cfgRes.effective || {};
					const normCad = (v) => v === "per_iteration" ? "per_iteration" : v === "tiered" ? "tiered" : (v && typeof v === "object" && Number.isFinite(v.every_n)) ? (v.every_n === 0 ? "per_iteration" : String(v.every_n)) : "user_turn"; /* 验证期修复+审计修复(client#5): every_n:0≡per_iteration(host:372 同语义)往返保真——原 falsy 判定丢 0 形态 */
					/* v4.4.0 往返保真修复(2026-11-03 实测): 配方侧三态——未设(undefined/null)必须保留为 ""(本文件既有「未绑定」惯用法, 同 mode 字段),
					 * 原 normCad 把未设归一成 "user_turn"(truthy) → 序列化门 `if (r.cadence)` 写盘成**显式 user_turn**
					 * → host:1654 的「配方未设 cadence ⇒ 继承顶层激活位」这一支永远走不到(顶层 cadence="tiered" 时继承被钉死)。
					 * 顶层(direct)不适用三态: 顶层必有档, host 缺省即 user_turn, 保留 user_turn 兜底即可。 */
					const normCadTri = (v) => (v === undefined || v === null) ? "" : normCad(v);
				/* v4.4.0 节拍 lane 对象化+配方私属表: 定调/巡检路从纯字符串升级为 {model, injection}(与 refs 同构——
				 * host 运行侧 runRefs/normalizeTiered 本就认对象条目, 原缺口只在编辑器与序列化);
				 * 全局与配方私属两处共用本归一器(同构保往返)。字符串输入=默认注入。 */
				const normLane = (r) => (r && typeof r === "object") ? { model: typeof r.model === "string" ? r.model : "", injection: typeof r.injection === "string" ? r.injection : "" } : { model: String(r || ""), injection: "" };
				const normTieredEdit = (t) => { t = (t && typeof t === "object") ? t : {}; return { initial: (t.initial === "patrol" || t.initial === "off") ? t.initial : "steering", n: Number.isFinite(Math.floor(Number(t.n))) ? String(Math.floor(Number(t.n))) : "4", m: Number.isFinite(Math.floor(Number(t.m))) ? String(Math.floor(Number(t.m))) : "", steering: Array.isArray(t.steering) ? t.steering.map(normLane).filter((x) => x.model) : [], patrolFollowRefs: !(Array.isArray(t.patrol) && t.patrol.filter((s) => (typeof s === "string" && s.trim()) || (s && typeof s === "object" && s.model)).length), patrol: Array.isArray(t.patrol) ? t.patrol.map(normLane).filter((x) => x.model) : [] }; };
					const normRecipe = (v, fb, top) => {
						v = v || {};
						/* §十一 v15: refs 元素内部统一对象 {model, injection}(字符串输入=默认注入);
						 * 序列化时无注入还原字符串(最小 diff), 有注入输出对象 */
						const normRef = (r) => (r && typeof r === "object")
							? { model: typeof r.model === "string" ? r.model : "", injection: typeof r.injection === "string" ? r.injection : "", includeReasoning: r.includeReasoning === true }
							: { model: String(r || ""), injection: "", includeReasoning: false }; /* §十九 v22-B */
						return {
							refs: Array.isArray(v.refs) && v.refs.length ? v.refs.map(normRef).filter((x) => x.model) : (fb ? [{ model: fb[0], injection: "" }] : [{ model: "", injection: "" }]),
							aggregator: typeof v.aggregator === "string" && v.aggregator ? v.aggregator : (fb ? fb[0] : ""),
							mode: (v.mode === "R" || v.mode === "F") ? v.mode : "",
							cadence: top ? normCad(v.cadence) : normCadTri(v.cadence),
							settle_ms: Number.isFinite(v.settle_ms) ? String(v.settle_ms) : "",
							reference_max_tokens: Number.isFinite(v.reference_max_tokens) ? String(v.reference_max_tokens) : "",
							debug: !!v.debug,
							aggInjection: typeof v.aggInjection === "string" && v.aggInjection ? v.aggInjection : "agg_default",
							inputModalities: Array.isArray(v.inputModalities) ? (v.inputModalities.includes("image") ? "both" : "text") : "", /* §二十八 v4.3.7: 视觉声明往返保持(""/text/both), 面板保存不丢手工字段 */
							tiered: (v.cadence_tiered && typeof v.cadence_tiered === "object") ? normTieredEdit(v.cadence_tiered) : undefined, /* v4.4.0: 配方私属节拍参数表(undefined=无私属, 消费共享全局) */
						};
					};
					/* 内置只读快照(effective 合并表中, raw.recipes 没有的内置名=未覆盖) */
					const builtinSnap = {};
					for (const k of BUILTIN) if (eff.recipes && eff.recipes[k] && !(raw.recipes && raw.recipes[k])) builtinSnap[k] = normRecipe(eff.recipes[k], null, false);
					const recipesInit = (() => { const o = {}; for (const [k, v] of Object.entries(raw.recipes || {})) o[k] = normRecipe(v, null, false); return o; })();
					recipes0Ref.current = recipesInit; /* saveAs 还原基准=本次加载快照(保存成功时刷新; 全链路不可变更新故引用恒净) */
					setEdit({
						recipe: typeof raw.recipe === "string" ? raw.recipe : "",
						recipes: recipesInit,
						builtinSnap,
						direct: normRecipe({ refs: raw.refs, aggregator: raw.aggregator, aggInjection: raw.aggInjection, mode: raw.mode, cadence: raw.cadence, settle_ms: raw.settle_ms, reference_max_tokens: raw.reference_max_tokens, debug: raw.debug }, ["minimax-fast", "kimi-flagship"], true),
						slots: JSON.parse(JSON.stringify(raw.slots && typeof raw.slots === "object" ? raw.slots : {})),
						disabled_models: Array.isArray(raw.disabled_models) ? raw.disabled_models.slice() : [],
						/* §二十六 v27: subagent 门控("passthrough"|"full"|数字串=every_n) */
						subagentPolicy: (() => { const p = raw.subagent_policy; if (p === "full") return "full"; if (p === "replica") return "replica"; if (p && typeof p === "object" && p.mode === "beat" && (p.lane === "patrol" || p.lane === "steering")) return "beat:" + p.lane + ":" + Math.floor(p.every || 4); if (p && typeof p === "object" && Number.isFinite(p.every_n)) return String(Math.floor(p.every_n)); return "passthrough"; })(),
						promptLang: raw.prompt_lang === "en" ? "en" : "zh", /* v4.4.0 中英切换: F 侧内置提示词语言(自建模块=自由文本不受辖) */
						/* §十一 v15: 用户自建注入文本模块(名→文本); 内置默认🔒/空白🔒运行时合成不落盘 */
						injections: (() => { const o = {}; if (raw.injections && typeof raw.injections === "object") for (const [k, v] of Object.entries(raw.injections)) if (typeof v === "string" && v.trim()) o[k] = v; return o; })(),
						aggInjections: (() => { const o = {}; if (raw.aggInjections && typeof raw.aggInjections === "object") for (const [k, v] of Object.entries(raw.aggInjections)) if (typeof v === "string" && v.trim()) o[k] = v; return o; })(),
						/* 验证期补建 v2: cadence_tiered 节拍参数区(lane 阵容=三级下拉行编辑器, 与 refs 同构;
						 * patrol 缺省沿用 refs(§二), 去勾=独立巡检编辑; m 空=host 3n 派生)。
						 * v4.4.0: lane 对象化({model, injection})共用 normTieredEdit(与配方私属表同构保往返)。 */
						cadTiered: normTieredEdit(raw.cadence_tiered),
						newName: "",
					});
				/* M4.4.2: providers/slots/efforts 用 JSON 直通解析结果覆盖(防 typert 字段过滤) */
					const effortsBy = parseJsonField(modelRes && modelRes.effortsJson, (modelRes && modelRes.effortsBy) || {});
					const modsBy = parseJsonField(modelRes && modelRes.modsJson, (modelRes && modelRes.modsBy) || {}); /* §二十九: 视觉徽章数据链 */
					setSt({ models: Object.assign({}, modelRes, { providers: v7provs, slots: v7slots, effortsBy: effortsBy, modsBy: modsBy }), injDefault: (eff && typeof eff.injectionDefault === "string") ? eff.injectionDefault : "(默认注入文本下发失败——host v15 未生效?)", aggInjDefault: (eff && typeof eff.aggInjDefault === "string") ? eff.aggInjDefault : "", aggInjForRefsBlank: (eff && typeof eff.aggInjForRefsBlank === "string") ? eff.aggInjForRefsBlank : "", mechF: (eff && typeof eff.mechF === "string") ? eff.mechF : "", mechR: (eff && typeof eff.mechR === "string") ? eff.mechR : "", injectionDefaultEn: (eff && typeof eff.injectionDefaultEn === "string") ? eff.injectionDefaultEn : "", aggInjDefaultEn: (eff && typeof eff.aggInjDefaultEn === "string") ? eff.aggInjDefaultEn : "", aggInjForRefsBlankEn: (eff && typeof eff.aggInjForRefsBlankEn === "string") ? eff.aggInjForRefsBlankEn : "", mechFEn: (eff && typeof eff.mechFEn === "string") ? eff.mechFEn : "", guardHealth: healthRes, warnings: (eff && Array.isArray(eff.warnings)) ? eff.warnings : [], tieredReadBackDegraded }); /* §七 序3: guardHealth 随 panel.json; 2026-11-04: 四件内置文本 EN 变体随 effective 下发(Zh 走单字段随已存语言)——🌐 切换即时显示, L8n 按 edit.promptLang 取用 */
				} catch (e) { setSt({ err: String(e && e.message || e) }); }
			})(); }, [callCfg]);
			if (st && st.err) return React.createElement("div", { style: { color: "var(--dsh-error, #c46)", padding: "12px", fontSize: "13px" } }, "加载失败: " + st.err);
			if (!st || !edit) return React.createElement("div", { style: { padding: "12px", fontSize: "13px", opacity: 0.7 } }, "moa-native 控制台加载中…");
			const models = st.models || {};
			const slotsTable = Object.assign({}, models.slots, edit.slots);
			const provEntries = Object.entries(models.providers || {});
			/* effort 下拉: 选定模型后按需查档位 */
			/* §三十 v4.3.9: 该路 effort=真实旋钮(逐路传 reasoningEffort); off 档仅部分模型提供
			 * (实况: deepseek/qwen 系有 off; glm/minimax 思考常开只能选低档省成本)。会话头部
			 * 「推理等级」对 MoA 无效(伪路由 agent/request 剥除), 思考深度的唯一配置点=此处。 */
			const EFFORT_TIP = "该路推理等级(真实生效): off=关思考(仅部分模型有此档, 如 deepseek/qwen 系; glm/minimax 思考常开, 低档=最省); effort:默认=不传=模型自身默认档。会话头部「推理等级」对 MoA 无效(伪路由自动剥除, 阵容思考深度在此配置)。";
			const EffortSelect = ({ mid, val, onCh }) => {
				/* v10: 本地 effortsBy 映射优先(panel.json 一次带全, 不走 typert); 无映射再异步查 */
				const localEfforts = ((models.effortsBy || {})[mid]);
				const [efforts, setEfforts] = React.useState(null);
				const loaded = React.useRef("");
				React.useEffect(() => { let gone = false; (async () => {
					if (!mid) { setEfforts(null); return; }
					if (loaded.current === mid) return;
					loaded.current = mid;
					/* v10b: HTTP 惰性端点优先(typert efforts 通道同被过滤) */
					try {
						const [pp, mm] = mid.split("/");
						const r = await fetch("/moa-native/efforts.json?provider=" + encodeURIComponent(pp) + "&model=" + encodeURIComponent(mm), { cache: "no-store" }).then((x) => x.json());
						if (!gone) setEfforts((r && r.ok && r.efforts) ? r.efforts : []);
					} catch { if (!gone) setEfforts([]); }
				})(); return () => { gone = true; }; }, [mid]);
				if (!mid) return null;
				if (Array.isArray(localEfforts) && localEfforts.length) {
					const known = localEfforts.includes(val);
					return React.createElement("select", { value: val || "", onChange: (e) => onCh(e.target.value), title: EFFORT_TIP, style: Object.assign({}, inputStyle, { flex: "0 1 110px" }) },
						React.createElement("option", { value: "" }, "effort:默认"),
						val && !known ? React.createElement("option", { value: val }, val + "（保留）") : null,
						localEfforts.map((e) => React.createElement("option", { key: e, value: e }, e)));
				}
				if (efforts === null) return React.createElement("span", { style: Object.assign({}, hintStyle, { margin: 0, flex: "0 0 auto", alignSelf: "center" }) }, "effort…");
				if (!efforts.length) return React.createElement("span", { style: Object.assign({}, hintStyle, { margin: 0, flex: "0 0 auto", alignSelf: "center" }) }, "（无档位）");
				const known = efforts.includes(val);
				return React.createElement("select", { value: val || "", onChange: (e) => onCh(e.target.value), title: EFFORT_TIP, style: Object.assign({}, inputStyle, { flex: "0 1 110px" }) },
					React.createElement("option", { value: "" }, "effort:默认"),
					val && !known ? React.createElement("option", { value: val }, val + "（保留）") : null,
					efforts.map((e) => React.createElement("option", { key: e, value: e }, e)));
			};
			const upd = (patch) => setEdit(Object.assign({}, edit, patch));
			/* 2026-11-04(用户指令「英文在切换开关的时候, 相应内容框架内直接显示相应内容」): 内置文本展示
			 * 按**当前编辑态**语言即时取用(zh 走 effective 单字段/已存语言; en 走 EN 变体, 缺=回落 zh)——
			 * 🌐 切换不等保存即变。单一事实源不变(变体由 host panel.json 下发, client 零内置字面量)。 */
			const L8n = (zh, en) => ((edit.promptLang === "en") && typeof en === "string" && en) ? en : zh;
			/* 编辑目标: 自定义配方 > 内置快照(只读, 修改=自动另存"-N"副本) > 直配; 末尾兜底直配
			 * (修复: recipe 指向已删/未同步配方名时 tgt undefined → reading 'mode' 渲染崩) */
			const usingRecipe = !!edit.recipe;
			const isBuiltinRO = usingRecipe && !!edit.builtinSnap[edit.recipe];
			const tgt = (usingRecipe ? (edit.recipes[edit.recipe] || edit.builtinSnap[edit.recipe]) : null) || edit.direct;
			const setTgtRaw = (patch) => {
				if (!usingRecipe) { upd({ direct: Object.assign({}, edit.direct, patch) }); return; }
				if (isBuiltinRO) {
					let n = 1; const taken = Object.keys(edit.recipes); while (taken.includes(edit.recipe + "-" + n)) n++;
					const nm = edit.recipe + "-" + n;
					upd({ recipes: Object.assign({}, edit.recipes, { [nm]: Object.assign({}, tgt, patch) }), recipe: nm });
					return;
				}
				upd({ recipes: Object.assign({}, edit.recipes, { [edit.recipe]: Object.assign({}, tgt, patch) }) });
			};
			const setTgtRef = (i, nv) => { const a = tgt.refs.slice(); a[i] = Object.assign({}, a[i], { model: nv }); setTgtRaw({ refs: a }); };
			const setTgtInj = (i, ninj) => { const a = tgt.refs.slice(); a[i] = Object.assign({}, a[i], { injection: ninj }); setTgtRaw({ refs: a }); };
			const setTgtInc = (i, v) => { const a = tgt.refs.slice(); a[i] = Object.assign({}, a[i], { includeReasoning: !!v }); setTgtRaw({ refs: a }); }; /* §十九 v22-B: 思考传递勾选 */
			/* §七 v9: 三级下拉(provider→model→effort), 与 DSH 会话 UI 同构; 值仍存 "provider/model@effort" */
			const TripleSelect = ({ val, onCh }) => {
				const [bare0, eff] = splitEffort(val);
				const slash = bare0.indexOf("/");
				const isLegacy = slash <= 0;
				const prov = isLegacy ? "" : bare0.slice(0, slash);
				const model = isLegacy ? bare0 : bare0.slice(slash + 1);
				const modelList = (models.providers || {})[prov] || [];
				const setP = (np) => { const ms = (models.providers || {})[np] || []; onCh((ms[0] ? np + "/" + ms[0] : np + "/") + (eff ? "@" + eff : "")); };
				const setM = (nm) => { onCh(prov + "/" + nm + (eff ? "@" + eff : "")); };
				return React.createElement("span", { style: { display: "flex", gap: "4px", flex: "1", alignItems: "center", flexWrap: "wrap" } },
					React.createElement("select", { value: prov, onChange: (e) => setP(e.target.value), style: Object.assign({}, inputStyle, { flex: "1 1 100px" }) },
						React.createElement("option", { value: "" }, isLegacy && bare0 ? "旧槽位名→重选" : "provider…"),
						provEntries.map(([p]) => React.createElement("option", { key: p, value: p }, p)),
					),
					React.createElement("select", { value: model, onChange: (e) => setM(e.target.value), style: Object.assign({}, inputStyle, { flex: "1 1 120px" }) },
						React.createElement("option", { value: "" }, "model…"),
						isLegacy && bare0 ? React.createElement("option", { value: model }, model + "（槽位名）") : null,
						!isLegacy && model && !modelList.includes(model) ? React.createElement("option", { value: model }, model + "（表外）") : null,
						modelList.map((m) => React.createElement("option", { key: m, value: m }, m + (edit.disabled_models.includes(prov + "/" + m) ? "（禁用）" : ""))),
					),
					React.createElement(EffortSelect, { mid: isLegacy ? "" : bare0, val: eff, onCh: (ne) => onCh(bare0 + (ne ? "@" + ne : "")) }),
				);
			};
			/* §十一 v15: ref 行=三级模型下拉+注入下拉(默认🔒/空白🔒/自建N) */
			const injOptions = [
				{ v: "__default__", t: "默认(类Hermes)" },
				{ v: "__blank__", t: "空白(零注入)" },
			].concat(Object.keys(edit.injections).map((k) => ({ v: k, t: k })));
			const modBadge = (mid) => { const mv = ((st.models && st.models.modsBy) || {})[String(mid || "").split("@")[0]]; return React.createElement("span", { title: mv ? (mv.includes("image") ? "视觉模型: 该路可看图" : "纯文本模型: 图像将投影为占位文本(自动降级)") : "目录无模态声明(派生按纯文本计)", style: { fontSize: "12px", opacity: 0.85 } }, mv && mv.includes("image") ? "👁" : "📄"); }; /* §二十九 v4.3.8: 视觉徽章(modsBy 数据链, 设置时即见) */
			const refRow = (v, i) => {
				const inj = v.injection || "__default__";
				const known = injOptions.some((o) => o.v === inj);
				return React.createElement("span", { key: i, style: { display: "flex", gap: "4px", marginBottom: "4px", alignItems: "center", flexWrap: "wrap" } },
					React.createElement(TripleSelect, { val: v.model, onCh: (nv) => setTgtRef(i, nv) }),
					React.createElement("select", { value: inj, onChange: (e) => setTgtInj(i, e.target.value), title: "注入文本模块(F 模式尾注)", style: Object.assign({}, inputStyle, { flex: "0 1 130px" }) },
						!known ? React.createElement("option", { value: inj }, inj + "(缺失)") : null,
						injOptions.map((o) => React.createElement("option", { key: o.v, value: o.v }, "✎ " + o.t))),
					modBadge(v.model),
					React.createElement("label", { title: "思考传递(§十九 v22-B): 该路思考原文(无截断)进 guidance, 块头+思考标注; 默认关。成本提示: guidance 在请求尾部, 每步 agg 全价重付", style: { fontSize: "11px", display: "flex", gap: "3px", alignItems: "center", opacity: 0.92, cursor: "pointer" } },
						React.createElement("input", { type: "checkbox", checked: v.includeReasoning === true, onChange: (e) => setTgtInc(i, e.target.checked) }),
						"思考"),
					React.createElement("button", { onClick: () => setTgtRaw({ refs: tgt.refs.filter((_, j) => j !== i) }), style: inputStyle }, "✕"));
			};
			const saveAs = () => {
				const taken = Object.keys(edit.recipes);
				let nm = (edit.newName || "").trim();
				if (!nm) { let n = 1; while (taken.includes("参数" + n)) n++; nm = "参数" + n; }
				/* v4.4.0 数据丢失修复(用户实锤 2026-11-04): 旧 saveAs 只复制不还原——编辑配方 A(就地写 recipes[A])后
				 * 「从当前编辑新建」B 再保存 ⇒ A 带着编辑残缺态落盘(实测: 节拍MOA 删 kimi 路另存 _无kimi 后两者 refs 同构, kimi 路丢失)。
				 * 「另存为」语义=新配方带走当前编辑, 原配方回到最近落盘态(recipes0Ref=加载/上次保存快照)。
				 * 直配态(未选配方)无原配方可还原, 维持纯复制; 内置只读快照同理不入 recipes。 */
				const base = Object.assign({}, edit.recipes, { [nm]: JSON.parse(JSON.stringify(tgt)) });
				if (usingRecipe && !isBuiltinRO && recipes0Ref.current && recipes0Ref.current[edit.recipe]) base[edit.recipe] = recipes0Ref.current[edit.recipe];
				upd({ recipes: base, recipe: nm, newName: "" });
			};
			const delRecipe = () => { const nr = Object.assign({}, edit.recipes); delete nr[edit.recipe]; upd({ recipes: nr, recipe: "" }); };
			/* §三十 v4.3.9: 配方行内重命名(改键保序+编辑指针跟随); 保留字表与 host PSEUDO_RESERVED 同源 */
			const PSEUDO_RESERVED_CLIENT = ["default", "standard", "ref", "full"];
			const doRename = (from) => {
				const to = (rn && rn.val ? String(rn.val) : "").trim();
				if (!to) { setRn(Object.assign({}, rn, { err: "名称不能为空" })); return; }
				if (to === from) { setRn(null); return; }
				if (PSEUDO_RESERVED_CLIENT.includes(to)) { setRn(Object.assign({}, rn, { err: "保留字(provider 页不可见): " + to })); return; }
				if (edit.recipes[to]) { setRn(Object.assign({}, rn, { err: "已存在同名配方: " + to })); return; }
				const nr = {};
				for (const [kk, vv] of Object.entries(edit.recipes)) nr[kk === from ? to : kk] = vv;
				upd({ recipes: nr, recipe: edit.recipe === from ? to : edit.recipe });
				setRn(null);
			};
			const toggleDisabled = (mid) => upd({ disabled_models: edit.disabled_models.includes(mid) ? edit.disabled_models.filter((x) => x !== mid) : edit.disabled_models.concat([mid]) });
			/* v4.4.0 审计修复(client#1/#3): n/m 序列化与预览同源归一——空/非法=省略键走 host 缺省(n=4/m=3n, 原 n:null 落盘致 host 零告警熄火而预览仍按4); 域内钳制对齐 host(n 2..21, 0/1 特例透传=显式巡检关闭/canonical; m 6..64)。组件体定义——save 与预览区双消费(useEffect 加载闭包内定义对二者不可见) */
			const tieredN = (r) => { const v0 = Math.floor(Number(r)); if (String(r).trim() === "" || !Number.isFinite(v0)) return null; if (v0 === 0 || v0 === 1) return v0; return Math.min(21, Math.max(2, v0)); };
			const tieredM = (r) => { const v0 = Math.floor(Number(r)); if (String(r).trim() === "" || !Number.isFinite(v0)) return null; return Math.min(64, Math.max(6, v0)); };
			/* v4.4.0 节拍 lane 序列化(与 serRef 同构语义): 无注入=还原字符串(最小 diff), 有注入={model,injection}对象 */
			/* 2026-11-04 修正(用户裁定 lane=refs 子集): 任何非空注入(含显式 __default__)输出对象——
			 * 空=字符串=「随 refs」继承态; 若把 __default__ 坍缩成字符串会与继承态不可辨(字符串语义已改随 refs)。 */
			const serLane = (x) => (!x || !x.model || !String(x.model).trim()) ? null : (x.injection ? { model: x.model, injection: x.injection } : x.model);
			const serLanes = (a) => (Array.isArray(a) ? a : []).map(serLane).filter(Boolean);
			const save = async () => {
				setSt(Object.assign({}, st, { saving: true, saved: null }));
				try {
					/* v4.4.0 往返保真修复(2026-11-03 实测): 未设 cadence 的配方原被 normCad 归一成 "user_turn"(truthy),
					 * 序列化门 `if (r.cadence)` 遂写盘成**显式 user_turn** → 顶层节拍继承被钉死(host:1654 的
					 * "配方未设 cadence ⇒ 继承顶层激活位"这一支永远走不到)。现用本文件既有"未绑定"惯用法(mode 用 ""):
					 * 未设 = "" ⇒ cadOut("") 返回 undefined ⇒ 该键被 JSON.stringify 丢弃 ⇒ host 端配方真无 cadence 键 ⇒ 继承成立。
					 * ⚠ cadOut 末臂兜底会吃空串 ⇒ 必须先判 "" (否则顶层直配也会被写成 {every_n:2}——比原缺陷更贵)。 */
					const cadOut = (v) => v === "" || v === undefined || v === null ? undefined : v === "user_turn" ? "user_turn" : v === "per_iteration" ? "per_iteration" : v === "tiered" ? "tiered" : { every_n: Math.max(1, parseInt(v, 10) || 2) }; /* 验证期修复: tiered 档直通(节拍参数在 cadence_tiered 独立顶层键, 不随本字段序列化) */
					/* §十一 v15: refs 序列化——无注入还原字符串(最小 diff), 有注入输出 {model,injection} */
					const serRef = (x) => { if (!x || !x.model) return ""; const base = (x.injection && x.injection !== "__default__") ? { model: x.model, injection: x.injection } : x.model; return (x.includeReasoning === true) ? Object.assign({}, typeof base === "string" ? { model: base } : base, { includeReasoning: true }) : base; }; /* §十九 v22-B: 勾选=对象形态带 includeReasoning, 未勾=最小 diff */
					const outRecipe = (r) => { const o = { refs: r.refs.filter((x) => x && x.model && x.model.trim()).map(serRef), aggregator: r.aggregator }; if (r.aggInjection && r.aggInjection !== "agg_default") o.aggInjection = r.aggInjection; if (r.mode) o.mode = r.mode; if (r.cadence) o.cadence = cadOut(r.cadence); if (r.settle_ms !== "") o.settle_ms = Math.max(0, parseInt(r.settle_ms, 10) || 2000); if (r.reference_max_tokens !== "") o.reference_max_tokens = parseInt(r.reference_max_tokens, 10); if (r.debug) o.debug = true; if (r.inputModalities === "text" || r.inputModalities === "both") o.inputModalities = r.inputModalities === "text" ? ["text"] : ["text", "image"]; if (r.tiered) { const tp2 = { initial: r.tiered.initial || "steering", steering: serLanes(r.tiered.steering) }; const n2 = tieredN(r.tiered.n); if (n2 !== null) tp2.n = n2; const m2 = tieredM(r.tiered.m); if (m2 !== null) tp2.m = m2; if (!r.tiered.patrolFollowRefs) tp2.patrol = serLanes(r.tiered.patrol); o.cadence_tiered = tp2; } return o; }; /* §二十八: 显式视觉声明随配方序列化(空=省略走派生); v4.4.0: 配方私属节拍参数表整体序列化(降级哨兵在 patch 层统一剥离) */
					const patch = {
						mode: edit.direct.mode || undefined,
						recipes: (() => { const o = {}; for (const [k, v] of Object.entries(edit.recipes)) o[k] = outRecipe(v); return o; })(),
						refs: edit.direct.refs.filter((x) => x && x.model && x.model.trim()).map(serRef),
						injections: (() => { const o = {}; for (const [k, v] of Object.entries(edit.injections)) if (v && v.trim()) o[k] = v; return o; })(),
						aggregator: edit.direct.aggregator,
						aggInjection: edit.direct.aggInjection,
						aggInjections: (() => { const o = {}; for (const [k, v] of Object.entries(edit.aggInjections)) if (v && v.trim()) o[k] = v; return o; })(),
						cadence: cadOut(edit.direct.cadence),
						settle_ms: edit.direct.settle_ms !== "" ? Math.max(0, parseInt(edit.direct.settle_ms, 10) || 2000) : undefined,
						reference_max_tokens: edit.direct.reference_max_tokens !== "" ? parseInt(edit.direct.reference_max_tokens, 10) : undefined,
						debug: !!edit.direct.debug,
						inputModalities: edit.direct.inputModalities === "text" ? ["text"] : edit.direct.inputModalities === "both" ? ["text", "image"] : null, /* §二十八: null=显式清除(host 侧删键), 防切回派生残留旧值 */
						slots: edit.slots,
						disabled_models: edit.disabled_models,
						/* §二十六 v27: subagent 门控序列化("passthrough"=省略保最小 diff) */
						subagent_policy: edit.subagentPolicy === "full" ? "full" : edit.subagentPolicy === "replica" ? "replica" : (/^beat:(patrol|steering):\d+$/.test(String(edit.subagentPolicy)) ? (() => { const seg = String(edit.subagentPolicy).split(":"); return { mode: "beat", lane: seg[1], every: Math.max(1, Math.min(50, parseInt(seg[2], 10))) }; })() : (/^\d+$/.test(String(edit.subagentPolicy)) ? { every_n: Math.max(1, Math.min(50, parseInt(edit.subagentPolicy, 10))) } : "passthrough")), /* v3.9 序2: passthrough 显式落盘(修面板无法切回既有 bug——undefined 被 delete 使 host 保留旧值) + beat/replica 三态 */
						prompt_lang: edit.promptLang === "en" ? "en" : "zh", /* v4.4.0: 显式落盘(zh 也写); R 侧 Hermes 原文不受辖 */
					};
					if (!patch.mode) delete patch.mode;
					let tieredSkipNote = "";
					if ((edit.direct.cadence === "tiered") || Object.values(edit.recipes || {}).some((r) => r && r.cadence === "tiered")) { const ct = edit.cadTiered || {}; if (st && st.tieredReadBackDegraded) { tieredSkipNote = "; ⚠ 节拍参数读回降级, 本次保存已跳过 cadence_tiered(防默认值覆盖盘上参数, 刷新页面后重试)"; } else { const ctp = { initial: ct.initial || "steering", steering: serLanes(ct.steering) }; const nn = tieredN(ct.n); if (nn !== null) ctp.n = nn; const mm = tieredM(ct.m); if (mm !== null) ctp.m = mm; if (!ct.patrolFollowRefs) ctp.patrol = serLanes(ct.patrol); patch.cadence_tiered = ctp; } } /* v4.4.0 审计修复: #1 空/非法 n=省略键(原 null 落盘→host 零告警熄火); #3 越界钳制对齐(原原值落盘回显≠运行); #2 降级哨兵跳键; v3 序列化门=全局或任一配方 tiered; cadence_tiered=全局顶层键。 v4.4.0: lane 对象化序列化(serLanes) */
					if (st && st.tieredReadBackDegraded) for (const k2 of Object.keys(patch.recipes || {})) delete patch.recipes[k2].cadence_tiered; /* v4.4.0: 降级哨兵同护配方私属表(读回已丢则不写, 防默认空阵容覆盖盘上私属参数) */
					if (!patch.subagent_policy) delete patch.subagent_policy;
					if (!patch.settle_ms) delete patch.settle_ms;
					if (!patch.reference_max_tokens) delete patch.reference_max_tokens;
					if (!patch.inputModalities && patch.inputModalities !== null) delete patch.inputModalities; /* null 保留(host 清除), undefined 删 */
					const res = await callCfg("save", patch);
					if (res && res.ok) recipes0Ref.current = JSON.parse(JSON.stringify(edit.recipes)); /* v4.4.0: saveAs 还原基准随落盘刷新(防「编辑→保存→再编辑→另存」链中原配方回退到过旧快照) */
					setSt(Object.assign({}, st, { saving: false, saved: res && res.ok ? ("已保存(热生效)—— default 与配方已同步到 provider 页(新配方需重启后出现)" + tieredSkipNote) : "保存失败: " + ((res && res.error) || "未知"), warnings: (res && res.ok && res.effective && Array.isArray(res.effective.warnings)) ? res.effective.warnings : st.warnings })); /* v4.4.0 审计修复(client#4): 保存回执 warnings 即时刷新 ⚠ 区(原 normalizeTiered 告警需重开面板才见) */
				} catch (e) { setSt(Object.assign({}, st, { saving: false, saved: "保存异常: " + String(e && e.message || e) })); }
			};
			/* 摘要(provider 页 description 同款) */
			/* v4.4.0 可见性修复(2026-11-03 实测): cadence 标签与 host cadLabel 同源语义——
			 * 原直接印原始值: 节拍档显裸 "tiered"、跳N档显裸数字 "5"(面板与 provider 页两处同源标签)。
			 * v4.4.0 往返保真: 未设("")不得显示为 user_turn——那是本轮在消灭的同一类谎报。 */
			const cadTag = (v) => v === "" || v === undefined || v === null ? "未设·继承顶层" : v === "tiered" ? "tiered·节拍" : (v === "per_iteration" ? "per_iteration" : (/^\d+$/.test(String(v)) ? ("跳" + v + "步") : "user_turn"));
			const summary = (r) => (r.mode || "F") + " · [" + r.refs.map((x) => shortName(splitEffort((x && x.model) || x || "")[0], slotsTable) + ((x && x.injection && x.injection !== "__default__") ? "[" + x.injection + "]" : "") + ((x && x.includeReasoning) ? "+思" : "")).join("+") + "→" + shortName(splitEffort(r.aggregator)[0], slotsTable) + "] · " + cadTag(r.cadence) + ((r.cadence === "tiered") ? (r.tiered ? "(独立节拍·定调" + (r.tiered.steering || []).length + "路)" : "(共享全局节拍)") : ""); /* v4.4.0: tiered 摘要显私属/共享——原两行同构不可辨(用户实锤) */
			const allModels = []; for (const [p, ms] of provEntries) for (const m of (ms || [])) allModels.push(p + "/" + m);
			return React.createElement("div", { style: { fontSize: "13px", maxWidth: "880px" } },
				/* ══ 配方工作台(与 provider 页统一: 这里编辑的一切都是 provider 页条目) ══ */
				React.createElement("div", { style: boxStyle },
					React.createElement("div", { style: hStyle }, "配置即模型 · 工作台 v13"),
					((st && st.warnings && st.warnings.length) ? React.createElement("div", { style: { color: "var(--dsh-error, #c46)", border: "1px solid rgba(200,80,90,0.5)", borderRadius: "6px", padding: "4px 10px", margin: "4px 0", fontSize: "12px" } },
						"⚠ 配置警告: " + st.warnings.join(" | ")) : null),
					React.createElement("div", { style: hintStyle }, "这里编辑的 default 与每个配方, 都出现在 provider 页 moa-native 组——选谁=该会话常驻谁。/moaR /moaF 斜杠可临时覆盖模式。"),
					/* §二十七 v4.3.1(用户决策): 斜杠生效预览——显式标明 /moaR /moaF 实际组合与 R/F 适配性 */
					React.createElement("div", { style: Object.assign({}, hintStyle, { background: "rgba(127,127,127,0.12)", borderRadius: "4px", padding: "4px 8px", margin: "4px 0" }) },
						(function () {
							const t = tgt || edit.direct;
							const refs = (t.refs || []).filter((x) => x && x.model).map((x) => shortName(splitEffort((x && x.model) || x || "")[0], slotsTable)).join("+");
							const agg = shortName(splitEffort(t.aggregator || "")[0], slotsTable);
							/* v4.4.0 往返保真(2026-11-03 实测): 斜杠预览须显示**生效**档位——配方 cadence=""(未设)时
							 * 实际生效=顶层档位(host:1654 的继承支), 原直接印 t.cadence ⇒ 显示「未设·继承顶层」,
							 * 与斜杠轮真实行为不符(同一类档位谎报)。 */
							const effCad = (t.cadence === "" || t.cadence === undefined || t.cadence === null) ? (edit.direct.cadence || "user_turn") : t.cadence;
							const cad = cadTag(effCad);
							const base = "[" + (refs || "（空阵容）") + "→" + (agg || "?") + "]";
							const cadTail = (cad === "user_turn") ? "(斜杠轮新指纹必 miss=等效手动强制扇出一次)" : (cad === "tiered·节拍" ? ((t.cadence === "" || t.cadence === undefined || t.cadence === null) ? "(节拍档·继承顶层: 拍位由引擎按 n/m 判定——定调/巡检/冻结, 斜杠只换视野不改节律)" : "(节拍档: 拍位由引擎按 n/m 判定——定调/巡检/冻结, 斜杠只换视野不改节律)") : "(斜杠轮照常按缓存/节奏决策)");
							return "⌨ 斜杠生效预览(常驻会话内): /moaR → " + base + " · R 裁剪视图(省输入, 小窗模型友好) | /moaF → " + base + " · F 全量镜像(零信息差, 缓存最优)。阵容/agg/节奏取自当前编辑目标, 斜杠只换视野; cadence=" + cad + cadTail;
						})()),
					React.createElement("div", { style: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", margin: "4px 0" } },
						React.createElement("button", { onClick: () => upd({ recipe: "" }), style: Object.assign({}, inputStyle, usingRecipe ? {} : { fontWeight: 600, borderColor: "rgba(100,160,255,0.8)" }) }, "⌂ 默认配置 default · " + summary(edit.direct)),
						React.createElement("button", { onClick: save, disabled: st.saving, style: Object.assign({}, inputStyle, { fontWeight: 600 }) }, st.saving ? "保存中…" : "💾 保存(热生效)"),
					),
					st.saved ? React.createElement("div", { style: Object.assign({}, hintStyle, { margin: "4px 0 0" }) }, st.saved) : null,
					React.createElement("div", { style: hintStyle }, "配方(provider 页同名条目, 点选进入编辑):"),
					Object.keys(edit.recipes).map((k) => React.createElement("div", { key: "row-" + k, style: { display: "flex", gap: "6px", alignItems: "center", margin: "2px 0" } },
						(rn && rn.from === k)
							? [React.createElement("input", { key: "in", autoFocus: true, value: rn.val, placeholder: "新名称", onChange: (e) => setRn({ from: k, val: e.target.value, err: "" }), onKeyDown: (e) => { if (e.key === "Enter") doRename(k); else if (e.key === "Escape") setRn(null); }, style: Object.assign({}, inputStyle, { flex: "1 1 auto" }) }),
								React.createElement("button", { key: "ok", onClick: () => doRename(k), title: "确认重命名(Enter)", style: inputStyle }, "✓"),
								React.createElement("button", { key: "no", onClick: () => setRn(null), title: "取消(Esc)", style: inputStyle }, "✕"),
								(rn.err ? React.createElement("span", { key: "err", style: { color: "var(--dsh-error, #c46)", fontSize: "12px" } }, rn.err) : null)]
							: [React.createElement("button", { key: "sel", onClick: () => upd({ recipe: k }), style: Object.assign({}, inputStyle, { flex: "1 1 auto", textAlign: "left" }, edit.recipe === k ? { fontWeight: 600, borderColor: "rgba(100,160,255,0.8)" } : {}) }, (edit.recipe === k ? "▸ " : "") + k + " · " + summary(edit.recipes[k])),
								React.createElement("button", { key: "rnb", onClick: () => setRn({ from: k, val: k, err: "" }), title: "重命名配方(改键名, 保序; 需保存生效, provider 页条目名重启后同步)", style: inputStyle }, "✎"),
								React.createElement("button", { key: "del", onClick: () => { const nr = Object.assign({}, edit.recipes); delete nr[k]; upd({ recipes: nr, recipe: edit.recipe === k ? "" : edit.recipe }); if (rn && rn.from === k) setRn(null); }, style: inputStyle }, "🗑")])),
					React.createElement("div", { style: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", margin: "4px 0" } },
						React.createElement("span", null, "新配方名:"), React.createElement("input", { value: edit.newName, placeholder: "空=参数N 自动", onChange: (e) => upd({ newName: e.target.value }), style: Object.assign({}, inputStyle, { flex: "0 1 150px" }) }),
						React.createElement("button", { onClick: saveAs, style: inputStyle }, "＋ 从当前编辑新建配方")),
				),
				/* ══ 配置态(折叠·全部拓扑自由度) ══ */
				React.createElement("details", { style: boxStyle },
					React.createElement("summary", { style: hStyle }, "▸ 配置态: 编辑配方 / 模型开关"),
					React.createElement("div", { style: Object.assign({}, hintStyle, { background: "rgba(127,127,127,0.12)", borderRadius: "4px", padding: "4px 8px", margin: "6px 0" }) },
						"正在编辑: " + (usingRecipe ? ("配方「" + edit.recipe + "」(provider 页同名条目)") : "default · 默认配置(provider 页 moa-native · default)")),
					/* §二十六 v27: subagent 门控(全局字段, 不随配方; 主会话不受影响) */
					React.createElement("div", { style: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", margin: "4px 0" } },
						React.createElement("span", { style: { flex: "0 0 auto" } }, "subagent 门控:"),
						React.createElement("select", { value: edit.subagentPolicy || "passthrough", onChange: (e) => upd({ subagentPolicy: e.target.value }), title: "子会话门控: passthrough=直转 aggregator 零扇出(默认)/每N次=每第 N 次放完整 MoA/beat=固定周期单拍单 lane(patrol 防漂移校订/steering 周期方向复评)/replica=按自身生效节律跑完整引擎(tiered 激活时, 顶层或配方)/full=同权全扇", style: Object.assign({}, inputStyle, { flex: "0 1 160px" }) },
							React.createElement("option", { value: "passthrough" }, "passthrough(直转agg)"),
							(!["passthrough", "full", "replica", "beat:patrol:4", "beat:steering:10", "3", "5", "8", "10", "15", "20", "30"].includes(String(edit.subagentPolicy)) ? React.createElement("option", { value: String(edit.subagentPolicy) }, "每" + edit.subagentPolicy + "次(保留)") : null),
							[3, 5, 8, 10, 15, 20, 30].map((n) => React.createElement("option", { key: "sg" + n, value: String(n) }, "每" + n + "次扇一次")),
							React.createElement("option", { value: "beat:patrol:4" }, "beat·巡检·每4步"),
							React.createElement("option", { value: "beat:steering:10" }, "beat·定调·每10步"),
							React.createElement("option", { value: "replica" }, "replica(全节律)"),
							React.createElement("option", { value: "full" }, "full(同权全扇)")),
						React.createElement("span", { style: hintStyle }, "子会话每步都跑(直转 agg); 每 N 步升级一次完整 MoA(第 1 步必扇)。主会话不受影响")),
					React.createElement("div", { style: { margin: "8px 0" } },
						React.createElement("div", { style: { display: "flex", gap: "6px", alignItems: "center", margin: "4px 0" } },
							React.createElement("span", null, "模式:"), React.createElement("select", { value: tgt.mode, onChange: (e) => setTgtRaw({ mode: e.target.value }), style: inputStyle },
								React.createElement("option", { value: "" }, "不绑定(兜底F)"), React.createElement("option", { value: "R" }, "R·裁剪视图"), React.createElement("option", { value: "F" }, "F·全量mirror")),
							React.createElement("span", { style: { fontSize: "12px", opacity: 0.85 } }, "视觉:"), React.createElement("select", { value: tgt.inputModalities || "", onChange: (e) => setTgtRaw({ inputModalities: e.target.value }), title: "伪模型 inputModalities 广告(贴图/read_image 入口闸): 派生=按成分目录声明并集(C 口径, 任一成分有视觉即开——vision refs 可看图转述给 text agg); 仅文本/文本+图像=强制覆盖。数据流各成分按自身声明治理(text-only 路自动投影占位, 不炸); 模型视觉纠正在 DSH 设置页·模型条目·输入类型", style: inputStyle },
								React.createElement("option", { value: "" }, "派生·并集(默认)"), React.createElement("option", { value: "text" }, "仅文本"), React.createElement("option", { value: "both" }, "文本+图像"))),
						(() => { const mB = (st.models && st.models.modsBy) || {}; const rr = (tgt.refs || []).filter((x) => x && x.model); const vn = rr.filter((x) => (mB[String(x.model).split("@")[0]] || []).includes("image")).length; const av = (mB[String(tgt.aggregator || "").split("@")[0]] || []).includes("image"); return React.createElement("div", { style: hintStyle }, "👁 视觉构成: refs " + vn + "/" + rr.length + " 路有视觉, agg " + (av ? "有视觉(图像直达全链路)" : "纯文本(vision refs 看图转述, 图像对 agg 投影占位)") + "。徽章无=目录无声明按文本计; 模型视觉在 DSH 设置页·模型条目·输入类型处修正(改后 30s 内派生自动跟随)。"); })(),
						React.createElement("div", { style: hintStyle }, "refs(参考路, 每路=provider/模型/effort 三级下拉+注入模块下拉):"),
						tgt.refs.map((v, i) => refRow(v, i)),
						React.createElement("button", { onClick: () => setTgtRaw({ refs: tgt.refs.concat([{ model: "", injection: "", includeReasoning: false }]) }), style: inputStyle }, "+ ref 路"),
						React.createElement("div", { style: { display: "flex", gap: "4px", alignItems: "center", marginTop: "4px" } },
							React.createElement("span", { style: { flex: "0 0 auto" } }, "agg:"), React.createElement(TripleSelect, { val: tgt.aggregator, onCh: (nv) => setTgtRaw({ aggregator: nv }) }), modBadge(tgt.aggregator)),
						React.createElement("div", { style: { display: "flex", gap: "4px", alignItems: "center", marginTop: "2px" } },
							React.createElement("span", { style: { flex: "0 0 auto", fontSize: "12px", opacity: 0.85 } }, "agg注入:"),
							React.createElement("select", { value: tgt.aggInjection || "agg_default", onChange: (e) => setTgtRaw({ aggInjection: e.target.value }), title: "aggregator 纪律段注入(机制段自动不可配)", style: Object.assign({}, inputStyle, { flex: "0 1 170px" }) },
								React.createElement("option", { value: "agg_default" }, "默认🔒通用纪律"),
								React.createElement("option", { value: "agg_blank" }, "空白🔒零纪律"),
								React.createElement("option", { value: "agg_forrefsblank" }, "refs全blank🔒平行预案"),
								Object.keys(edit.aggInjections || {}).map((k) => React.createElement("option", { key: k, value: k }, k))),
							React.createElement("button", { onClick: () => setPv("agg"), title: "预览当前组合下 aggregator 收到的完整 guidance 骨架", style: Object.assign({}, inputStyle, { flex: "0 0 auto" }) }, "ⓘ 预览")),
						React.createElement("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", margin: "6px 0" } },
							React.createElement("label", null, "cadence ", React.createElement("select", { value: tgt.cadence, onChange: (e) => setTgtRaw({ cadence: e.target.value }), style: inputStyle },
								/* v4.4.0 往返保真(2026-11-03 实测): 配方态新增「未设·继承顶层」项——配方 cadence 可为 ""(=继承顶层激活位, host:1654),
								 * 若下拉无匹配项, 浏览器会视觉回落到首项 user_turn(正是本轮在消灭的档位谎报), 且用户无法改回继承。
								 * 顶层(direct)不提供此选项: 顶层必有档(host 缺省即 user_turn)。 */
								usingRecipe ? React.createElement("option", { value: "" }, "未设·继承顶层") : null,
								React.createElement("option", { value: "user_turn" }, "user_turn"), React.createElement("option", { value: "per_iteration" }, "per_iteration"), React.createElement("option", { value: "tiered" }, "tiered·节拍(定制)"), Array.from({ length: 10 }, (_, i) => i + 1).map((n) => React.createElement("option", { key: "cad" + n, value: String(n) }, "跳" + n + "步")))),
						(tgt.cadence === "tiered") ? (() => {
							/* v4.4.0 配方私属节拍表(用户实锤: 全局共享致「改一个配方的定调, 另一个也变」)——
							 * 私属表在位(tieredOwn)=本编辑器读写配方表(全局不动); 不在位=读写全局(验证期修复 v3 语义保留)。 */
							const tieredOwn = !!(usingRecipe && tgt.tiered);
							const ct = tieredOwn ? tgt.tiered : (edit.cadTiered || {});
							const setCt = (k, v) => { const nc = Object.assign({}, ct, { [k]: v }); if (!usingRecipe) { upd({ cadTiered: nc }); return; } if (tieredOwn) { upd({ recipes: Object.assign({}, edit.recipes, { [edit.recipe]: Object.assign({}, tgt, { cadence: "tiered", tiered: nc }) }) }); return; } upd({ cadTiered: nc, [isBuiltinRO ? "_builtinRO_" : "recipes"]: isBuiltinRO ? edit.recipes : Object.assign({}, edit.recipes, { [edit.recipe]: Object.assign({}, tgt, { cadence: "tiered" }) }) }); }; /* 内置只读态复制分支不写 recipes(键名占位 _builtinRO_ 不落盘, save 只取已知字段) */
							const laneRow = (which, sv, si) => React.createElement("div", { key: which + si, style: { display: "flex", gap: "4px", alignItems: "center", margin: "2px 0" } },
								React.createElement(TripleSelect, { val: sv.model, onCh: (nv) => setCt(which, (ct[which] || []).map((x, xi) => xi === si ? Object.assign({}, x, { model: nv }) : x)) }), modBadge(sv.model),
								React.createElement("select", { value: sv.injection || "", onChange: (e) => setCt(which, (ct[which] || []).map((x, xi) => xi === si ? Object.assign({}, x, { injection: e.target.value }) : x)), title: "该路注入(2026-11-04 用户裁定: steering/patrol 是 refs 的子集): 空=随 refs 上级——refs 全体同注入则承之(全 blank ⇒ lane 也 blank), 不统一落默认; 显式选 默认/空白/自建 则不继承", style: Object.assign({}, inputStyle, { flex: "0 1 140px" }) },
									React.createElement("option", { value: "" }, "✎ 随 refs(上级一致)"),
									injOptions.map((o) => React.createElement("option", { key: o.v, value: o.v }, "✎ " + o.t))),
								React.createElement("button", { onClick: () => setCt(which, (ct[which] || []).filter((_, xi) => xi !== si)), style: Object.assign({}, inputStyle, { padding: "0 8px" }) }, "✕"));
							const n = (() => { const v = tieredN(ct.n); return v === null ? 4 : v; })(); /* v4.4.0 审计修复(client#1): 预览与序列化同源归一(原空/非法时预览按4、落盘 null 三方分裂) */
							const m = (() => { const v = tieredM(ct.m); return v === null ? 3 * n : v; })();
							const kind = ct.initial || "steering";
							const strip = Array.from({ length: 30 }, (_, i) => { const s = i + 1; if (s === 1) return kind === "off" ? "·" : (kind === "patrol" ? "○" : "●"); if (m && s % m === 0) return "●"; if (n && s % n === 0) return "○"; return "·"; }).join("");
							return React.createElement("div", { style: Object.assign({}, hintStyle, { border: "1px dashed rgba(127,127,127,0.4)", borderRadius: "6px", padding: "6px 10px", margin: "2px 0" }) },
								React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" } },
									"🎼 节拍参数:",
									React.createElement("label", null, " 首拍 ", React.createElement("select", { value: kind, onChange: (e) => setCt("initial", e.target.value), style: inputStyle }, React.createElement("option", { value: "steering" }, "定调"), React.createElement("option", { value: "patrol" }, "巡检"), React.createElement("option", { value: "off" }, "无"))),
									React.createElement("label", null, " n 巡检间隔 ", React.createElement("input", { value: ct.n, onChange: (e) => setCt("n", e.target.value), style: Object.assign({}, inputStyle, { width: "46px" }), placeholder: "4" })),
									React.createElement("label", null, " m 定调间隔 ", React.createElement("input", { value: ct.m, onChange: (e) => setCt("m", e.target.value), style: Object.assign({}, inputStyle, { width: "46px" }), placeholder: String(3 * n) + "(=3n)" })),
									usingRecipe && !isBuiltinRO ? React.createElement("label", { title: "勾选=本配方私属节拍参数表(整体替换, 优先于全局 cadence_tiered; host 侧 recipeTieredParams 同一优先级); 去勾=删除私属表, 回落共享全局。", style: { fontSize: "12px" } }, React.createElement("input", { type: "checkbox", checked: tieredOwn, onChange: (e) => { if (e.target.checked) upd({ recipes: Object.assign({}, edit.recipes, { [edit.recipe]: Object.assign({}, tgt, { cadence: "tiered", tiered: JSON.parse(JSON.stringify(ct)) }) }) }); else { const nt = Object.assign({}, tgt); delete nt.tiered; upd({ recipes: Object.assign({}, edit.recipes, { [edit.recipe]: nt }) }); } } }), " 本配方独立节拍(不随全局变)") : null),
								React.createElement("div", { style: { fontFamily: "monospace", fontSize: "12px", margin: "3px 0", letterSpacing: "1px" } }, "节律预览(前30拍): " + strip + "  ●定调 ○巡检 ·冻结"),
								React.createElement("div", { style: { fontSize: "12px", margin: "2px 0" } }, "定调拍阵容(steering·每 m 步·重模型 1-2 路, 空=回落 refs):"),
								(ct.steering || []).map((sv, si) => laneRow("steering", sv, si)),
								React.createElement("button", { onClick: () => setCt("steering", (ct.steering || []).concat([{ model: "", injection: "" }])), style: Object.assign({}, inputStyle, { padding: "0 10px" }) }, "+ 定调路"),
								React.createElement("div", { style: { display: "flex", gap: "6px", alignItems: "center", margin: "4px 0 2px", fontSize: "12px" } },
									React.createElement("input", { type: "checkbox", checked: !!ct.patrolFollowRefs, onChange: (e) => setCt("patrolFollowRefs", e.target.checked) }), " 巡检拍沿用 refs(下方 refs 即巡检阵容; 去勾=独立配置)"),
								!ct.patrolFollowRefs ? React.createElement("div", null,
									React.createElement("div", { style: { fontSize: "12px", margin: "2px 0" } }, "巡检拍阵容(patrol·每 n 步·flash 多路):"),
									(ct.patrol || []).map((sv, si) => laneRow("patrol", sv, si)),
									React.createElement("button", { onClick: () => setCt("patrol", (ct.patrol || []).concat([{ model: "", injection: "" }])), style: Object.assign({}, inputStyle, { padding: "0 10px" }) }, "+ 巡检路")) : null,
								React.createElement("div", { style: { opacity: 0.85 } }, "n=巡检每 n 步(2..21) | m=定调每 m 步(6..64, 空=3n) | 谐波 m=k·n 最优(默认 4/12) | 切回旧档参数保留零丢失 | 未勾「独立」=本配方用全局参数, 勾「独立」=本配方私属表整体替换(与 refs/agg 的配方级配置对齐)。每路可独立配注入(与 refs 同构)。"),
								/* v4.4.0 阵容归属提示(用户实锤「没有相关的流程定义」): 面板上「配方 refs」与「定调拍阵容」是两处不同字段,
								 * 「重模型定调 + 轻模型巡查」的落点=重模型放上面的定调拍阵容, 巡检拍沿用下方 refs。
								 * 原面板无任何提示=用户看不出该改哪一处, 意图被引擎正确执行也看不出。 */
								React.createElement("div", { style: { fontSize: "12px", opacity: 0.9, margin: "4px 0 2px", padding: "4px 8px", borderLeft: "2px solid rgba(127,127,127,0.45)", background: "rgba(127,127,127,0.06)" } },
									"🎯 意图落点: 「重模型定调 + 轻模型巡查」= 上面的定调拍阵容放重模型(方向判断, 每 m 步) + 下面的巡检拍沿用 refs(轻模型执行校订, 每 n 步)。配方自己的 refs 只是巡检回落池——节拍档下 refs 不再承担定调职责。当前定调阵容 " + ((ct.steering || []).length ? (ct.steering || []).length + " 路" : "空(回落 refs)") + " · 巡检阵容 " + (ct.patrolFollowRefs ? "沿用 refs" : ((ct.patrol || []).length + " 路")) + "。"),
							(st && st.tieredReadBackDegraded) ? React.createElement("div", { style: { color: "var(--dsh-error, #c46)", fontSize: "12px", margin: "2px 0" } }, "⚠ 节拍参数读回降级(rawJson 直通缺失)——保存将跳过 cadence_tiered 防覆盖, 请刷新页面重试") : null);
						})() : null,
							React.createElement("label", null, " settle_ms ", React.createElement("input", { value: tgt.settle_ms, placeholder: "2000", onChange: (e) => setTgtRaw({ settle_ms: e.target.value }), style: Object.assign({}, inputStyle, { width: "66px" }) })),
							React.createElement("label", null, " ref max_tokens ", React.createElement("input", { value: tgt.reference_max_tokens, placeholder: "(默认)", onChange: (e) => setTgtRaw({ reference_max_tokens: e.target.value }), style: Object.assign({}, inputStyle, { width: "76px" }) })),
							React.createElement("label", null, " ", React.createElement("input", { type: "checkbox", checked: tgt.debug, onChange: (e) => setTgtRaw({ debug: e.target.checked }) }), " debug")),
												React.createElement("div", { style: hintStyle }, "cadence=重算频率(user_turn 同轮一次最省/per_iteration 每步/跳N步=扇出后跳 N 步再扇, user 输入轮天然重置/tiered·节拍=重模型每 m 步定调+flash 每 n 步巡检+非拍步冻结复用); settle_ms=打断后落袋宽限; max_tokens=参考路上限(thinking 模型留空); debug=详细日志。"),
						(() => {
							if (pv !== "agg") return null;
							const short = (m) => String(m || "").split("@")[0].split("/").pop();
							const refs = (tgt.refs || []).filter((x) => x && x.model);
							/* v3.9 §四: 机制段=host MECH_F/MECH_R 常量经 panel.json effective 同源下发(单一事实源, 零插值零计数零真名) */
							const mech = (st && (tgt.mode === "R" ? st.mechR : L8n(st.mechF, st.mechFEn))) || "(机制段常量下发失败——host 未生效?)";
							const nm = tgt.aggInjection || "agg_default";
							let disc = "";
							if (nm === "agg_default") disc = L8n((st && st.aggInjDefault) || "", st && st.aggInjDefaultEn);
							else if (nm === "agg_forrefsblank") disc = L8n((st && st.aggInjForRefsBlank) || "", st && st.aggInjForRefsBlankEn);
							else if (nm !== "agg_blank") disc = (edit.aggInjections || {})[nm] || "(自建模块不存在——运行时回落 agg_default)";
							const blocks = refs.map((x) => "[" + ((tgt.mode === "R") ? "reference · " : "预演·" + ((x.injection === "__blank__") ? "续写" : "评审意见") + ((x && x.includeReasoning) ? "+思考" : "") + " · ") + short(x.model) + "]" + ((x && x.includeReasoning) ? "\n▍思考过程(原文, 无截断)…" : "") + "\n" + "(该路输出正文…)"); /* v3.9: 失败壳示例移除; 2026-11-04: 预览块头随模型面——F=预演(用户裁定 旧概念=并行执行预演), R=reference(Hermes 回滚) */
							const pvText = mech + (disc ? "\n\n" + disc : "") + "\n\n" + blocks.join("\n\n");
							return React.createElement("div", { onClick: () => setPv(null), style: { position: "fixed", inset: "0", background: "rgba(0,0,0,0.35)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" } },
								React.createElement("div", { onClick: (e) => e.stopPropagation(), style: { background: "var(--dsh-input-bg, #fff)", color: "inherit", border: "1px solid rgba(127,127,127,0.4)", borderRadius: "8px", maxWidth: "720px", width: "90%", maxHeight: "80vh", overflowY: "auto", padding: "14px 16px", fontSize: "12.5px" } },
									React.createElement("div", { style: { display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "4px" } },
										React.createElement("b", null, "guidance 组合预览(aggregator 视角)"),
										React.createElement("span", { style: { opacity: 0.6, fontSize: "11px" } }, "机制段自动 · 纪律段=agg 注入 · 示意预览(运行态含实时输出/降级口径/STALE)"),
										React.createElement("button", { onClick: () => setPv(null), style: { marginLeft: "auto" } }, "✕")),
									React.createElement("pre", { style: { whiteSpace: "pre-wrap", background: "rgba(127,127,127,0.12)", borderRadius: "6px", padding: "8px 10px", margin: "8px 0", fontSize: "12px", fontFamily: "inherit" } }, pvText),
									React.createElement("div", { style: { opacity: 0.8, fontSize: "11.5px" } },
										"时态: STALE 已迁宿主侧(trace/UI 徽标), 不进注入文本; 防重放语义由机制段常量句承载(「已执行/结果一律不是事实记录」); header 永不含时态/计数/成败插值(v3.9 三不可见)。",
										React.createElement("br"),
										"保留字: agg_default🔒=通用纪律 · agg_blank🔒=零纪律纯透明 frame · agg_forrefsblank🔒=refs 全 blank 平行预案纪律。")));
						})(),
					),
					/* §十一 v15: 注入文本模块管理(默认🔒+空白🔒+自建) */
				React.createElement("details", { style: { margin: "8px 0" } },
					React.createElement("summary", { style: { fontSize: "12px", opacity: 0.8 } }, "▸ 注入文本模块(F 模式尾注; 默认🔒/空白🔒/自建)"),
					React.createElement("div", { style: Object.assign({}, hintStyle, { background: "rgba(127,127,127,0.12)", borderRadius: "4px", padding: "4px 8px", margin: "6px 0" }) },
						"每路 ref 的尾注=所选模块文本(完全替换不叠加); 空白=零尾注纯镜像; 内容自由(一句 persona 到整段领域文档)。一切注入可见可编辑, 无隐藏引导。"),
					React.createElement("div", { style: { display: "flex", gap: "8px", alignItems: "center", margin: "6px 0" } },
						React.createElement("label", { title: "F 侧内置提示词(默认注入/agg 纪律两保留字/机制段)的语言; 自建模块=自由文本不受辖; R 侧(Hermes 谱系)恒原文。", style: { fontSize: "12px" } }, "🌐 提示词语言 ",
							React.createElement("select", { value: edit.promptLang || "zh", onChange: (e) => upd({ promptLang: e.target.value }), style: Object.assign({}, inputStyle, { flex: "0 1 110px" }) },
								React.createElement("option", { value: "zh" }, "中文(缺省)"),
								React.createElement("option", { value: "en" }, "English"))),
						React.createElement("span", { style: Object.assign({}, hintStyle, { margin: 0 }) }, "切换只影响下方🔒内置文本与 F 机制段, 保存后热生效")),
					React.createElement("div", { style: { margin: "6px 0" } },
						React.createElement("div", { style: { fontSize: "12px", opacity: 0.85, marginBottom: "2px" } }, "🔒 默认(类 Hermes 修订版·不可编辑不可删)"),
						React.createElement("textarea", { readOnly: true, value: L8n(st.injDefault || "", st.injectionDefaultEn), rows: 4, style: Object.assign({}, inputStyle, { width: "100%", opacity: 0.75, resize: "vertical", fontFamily: "inherit" }) }),
						React.createElement("div", { style: Object.assign({}, hintStyle, { marginTop: "4px" }) }, "修订: 已去除\"勿调用工具/不得自称执行/不是给用户答案\"三条禁令——模型差异与偏好纳入处理。"),
						React.createElement("div", { style: { fontSize: "12px", opacity: 0.85, margin: "8px 0 2px" } }, "🔒 空白(零注入·纯镜像)"),
						Object.entries(edit.injections).map(([k, v], idx) => React.createElement("div", { key: "inj" + idx, style: { margin: "6px 0" } }, /* v25.1: key 去可变名 */
							React.createElement("div", { style: { display: "flex", gap: "4px", alignItems: "center", marginBottom: "2px" } },
								React.createElement("span", { style: { fontSize: "12px", opacity: 0.85 } }, "✎"),
								React.createElement("input", { value: k, placeholder: "模块名", onChange: (e) => { const ni = {}; for (const [kk, vv] of Object.entries(edit.injections)) ni[kk === k ? e.target.value : kk] = vv; upd({ injections: ni }); }, style: Object.assign({}, inputStyle, { flex: "0 1 140px" }) }),
								React.createElement("button", { onClick: () => { const ni = Object.assign({}, edit.injections); delete ni[k]; upd({ injections: ni }); }, style: inputStyle }, "🗑")),
							React.createElement("textarea", { value: v, rows: 4, placeholder: "注入文本(自由内容; 留空则该行保存时被滤除)", onChange: (e) => upd({ injections: Object.assign({}, edit.injections, { [k]: e.target.value }) }), style: Object.assign({}, inputStyle, { width: "100%", resize: "vertical", fontFamily: "inherit" }) }))),
						React.createElement("button", { onClick: () => { let n = 1; const t = Object.keys(edit.injections); while (t.includes("注入" + n)) n++; upd({ injections: Object.assign({}, edit.injections, { ["注入" + n]: "" }) }); }, style: inputStyle }, "+ 新建注入模块"),
					React.createElement("hr", { style: { border: "none", borderTop: "1px dashed rgba(127,127,127,0.3)", margin: "10px 0" } }),
					React.createElement("div", { style: { fontSize: "12px", fontWeight: 600, marginBottom: "2px" } }, "agg 注入(纪律段, aggregator 收到的 guidance)"),
					React.createElement("div", { style: hintStyle }, "guidance = 机制段(自动·不可配: 路数/模型名/共享视野/未执行声明) + 此处所选纪律 + 各路标注块。三保留字🔒 + 自建。"),
					React.createElement("div", { style: { fontSize: "12px", opacity: 0.85, margin: "6px 0 2px" } }, "🔒 默认 agg_default(通用纪律·不可编辑)"),
					React.createElement("textarea", { readOnly: true, value: L8n(st.aggInjDefault || "(host v20 未生效?)", st.aggInjDefaultEn), rows: 3, style: Object.assign({}, inputStyle, { width: "100%", opacity: 0.75, resize: "vertical", fontFamily: "inherit" }) }),
					React.createElement("div", { style: { fontSize: "12px", opacity: 0.85, margin: "8px 0 2px" } }, "🔒 refs全blank 专用 agg_forrefsblank(平行预案纪律·不可编辑)"),
					React.createElement("textarea", { readOnly: true, value: L8n(st.aggInjForRefsBlank || "(host v20 未生效?)", st.aggInjForRefsBlankEn), rows: 3, style: Object.assign({}, inputStyle, { width: "100%", opacity: 0.75, resize: "vertical", fontFamily: "inherit" }) }),
					React.createElement("div", { style: { fontSize: "12px", opacity: 0.85, margin: "8px 0 2px" } }, "🔒 空白 agg_blank(零纪律——只剩机制段+裸块)"),
					Object.entries(edit.aggInjections || {}).map(([k, v], idx) => React.createElement("div", { key: "aggi" + idx, style: { margin: "6px 0" } }, /* v25.1: key 去可变名 */
						React.createElement("div", { style: { display: "flex", gap: "4px", alignItems: "center", marginBottom: "2px" } },
							React.createElement("span", { style: { fontSize: "12px", opacity: 0.85 } }, "✎"),
							React.createElement("input", { value: k, placeholder: "agg 注入名", onChange: (e) => { const ni = {}; for (const [kk, vv] of Object.entries(edit.aggInjections)) ni[kk === k ? e.target.value : kk] = vv; upd({ aggInjections: ni }); }, style: Object.assign({}, inputStyle, { flex: "0 1 140px" }) }),
							React.createElement("button", { onClick: () => { const ni = Object.assign({}, edit.aggInjections); delete ni[k]; upd({ aggInjections: ni }); }, style: inputStyle }, "🗑")),
						React.createElement("textarea", { value: v, rows: 3, placeholder: "纪律文本(自由内容; 留空则该行保存时被滤除)", onChange: (e) => upd({ aggInjections: Object.assign({}, edit.aggInjections, { [k]: e.target.value }) }), style: Object.assign({}, inputStyle, { width: "100%", resize: "vertical", fontFamily: "inherit" }) }))),
					React.createElement("button", { onClick: () => { let n = 1; const t = Object.keys(edit.aggInjections); while (t.includes("agg注入" + n)) n++; upd({ aggInjections: Object.assign({}, edit.aggInjections, { ["agg注入" + n]: "" }) }); }, style: inputStyle }, "+ 新建 agg 注入")),
				),
				/* 模型开关 */
					React.createElement("details", { style: { margin: "8px 0" } },
						React.createElement("summary", { style: { fontSize: "12px", opacity: 0.8 } }, "▸ 模型开关(disabled_models, 全局)"),
						allModels.length ? React.createElement("div", { style: { maxHeight: "150px", overflowY: "auto", border: "1px solid rgba(127,127,127,0.2)", borderRadius: "4px", padding: "4px 8px" } },
							allModels.map((mid) => React.createElement("label", { key: mid, style: { display: "inline-block", margin: "2px 10px 2px 0", fontSize: "12px" } },
								React.createElement("input", { type: "checkbox", checked: edit.disabled_models.includes(mid), onChange: () => toggleDisabled(mid) }), " " + mid)),
						) : React.createElement("div", { style: hintStyle }, "(模型表不可用)"),
						React.createElement("div", { style: hintStyle }, "勾选=禁用(下拉标注; 引用处告警不阻断——fail-loud)。"),
					),
				),
				/* ══ §九 v14: 运行轨迹·四级下钻(HTTP trace.json 通道) ══ */
				React.createElement(TracePanel),
				React.createElement("div", { style: Object.assign({}, hintStyle, { borderTop: "1px solid rgba(127,127,127,0.2)", paddingTop: "8px" }) },
					"机制: guidance 请求级注入不落会话历史(回查无据属正常); refs 失败如实标注绝不换路。文档: GUIDE.md · docs/{INTERFACES,TEST-SOP,DESIGN-CONSOLE}.md。"),
				/* ══ §七 序3: 守卫健康卡(宿主侧观测面——用户可见/模型不可见; 单向流出: 数据止于 UI, 不回写注入文本或工具摘要) ══
				 * 2026-11-04 用户裁定(排版 + 位置): ①原布局=一行流水账(模型名后直接缀五个计数, 挤成一条长串,
				 * 模型名长短不一时列对不齐, 读哪一列要靠数符号) → 改表格(模型列 + 五个计数列, 列头带符号图例);
				 * ②位置从面板顶部挪到末尾——它是观测面, 不该在配置编辑区入口处抢注意力。 */
				(() => {
					const gh = st && st.guardHealth;
					if (!gh) return React.createElement("div", { style: hintStyle }, "🛡 守卫健康: 数据通道未携带(typert 回退路径; 事件仍完整落盘 ~/.dsh/moa-native-health)");
					if (!gh.total) return React.createElement("div", { style: hintStyle }, "🛡 守卫健康: 近 2 天无守卫事件(账本 ~/.dsh/moa-native-health)");
					const th = { textAlign: "left", fontWeight: 600, padding: "2px 10px 2px 0", opacity: 0.72, whiteSpace: "nowrap", borderBottom: "1px solid rgba(127,127,127,0.25)" };
					const td = { padding: "1px 10px 1px 0", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
					const sev = (n) => (n > 0 ? { color: "var(--dsh-warning, #c96)" } : { opacity: 0.35 });
					const rows = Object.entries(gh.byModel).sort((a, b) => ((b[1].ref_fail + b[1].dropped + b[1].abort + (b[1].timeout || 0)) - (a[1].ref_fail + a[1].dropped + a[1].abort + (a[1].timeout || 0)))).slice(0, 8);
					/* §七 序3 v3.9 扩展: 每 lane 健康位(定调/巡检泳道各自失败画像)——用户判断「重模型定调路稳不稳」的唯一依据;
					 * v4.4.0: lane 桶只收真泳道(steering/patrol), 冻结步(beat=none)不入(见 host guardHealth 判据)。 */
					const laneRows = Object.entries(gh.byLane || {}).filter(([, v]) => v.total).sort((a, b) => b[1].total - a[1].total);
					const head = (t) => React.createElement("th", { style: th }, t);
					return React.createElement("div", { style: { border: "1px solid rgba(127,127,127,0.35)", borderRadius: "6px", padding: "6px 10px", margin: "10px 0 4px", fontSize: "12px" } },
						React.createElement("div", { style: { fontWeight: 600, marginBottom: "4px" } },
							"🛡 守卫健康 · 近 2 天 " + gh.total + " 事件 · 宿主观测(模型不可见·单向流出)"),
						React.createElement("div", { style: { opacity: 0.7, marginBottom: "4px" } }, "✗失败 ⊘守卫剔除 ⚡中止 ⏱超时 ⚠警告(thinking 超长) · 账本 ~/.dsh/moa-native-health"),
						React.createElement("table", { style: { borderCollapse: "collapse", width: "100%" } },
							React.createElement("thead", null, React.createElement("tr", null, head("模型"), head("✗"), head("⊘"), head("⚡"), head("⏱"), head("⚠"))),
							React.createElement("tbody", null,
								rows.map(([k, v]) => React.createElement("tr", { key: "gh" + k },
									React.createElement("td", { style: Object.assign({}, td, { fontFamily: "monospace" }) }, k.split("/").pop()),
									React.createElement("td", { style: Object.assign({}, td, sev(v.ref_fail)) }, "✗" + v.ref_fail),
									React.createElement("td", { style: Object.assign({}, td, sev(v.dropped)) }, "⊘" + v.dropped),
									React.createElement("td", { style: Object.assign({}, td, sev(v.abort)) }, "⚡" + v.abort),
									React.createElement("td", { style: Object.assign({}, td, sev(v.timeout || 0)) }, "⏱" + (v.timeout || 0)),
									React.createElement("td", { style: Object.assign({}, td, sev(v.warn)) }, "⚠" + v.warn))),
								Object.keys(gh.byModel).length > 8 ? React.createElement("tr", { key: "ghmore" }, React.createElement("td", { style: Object.assign({}, td, { opacity: 0.6 }) }, "… 其余 " + (Object.keys(gh.byModel).length - 8) + " 个模型")) : null)),
						laneRows.length ? React.createElement("div", { style: { marginTop: "8px" } },
							React.createElement("div", { style: { opacity: 0.85, marginBottom: "2px" } }, "泳道(定调/巡检各自分离画像)"),
							React.createElement("table", { style: { borderCollapse: "collapse" } },
								React.createElement("thead", null, React.createElement("tr", null, head("泳道"), head("事件"), head("✗"), head("⊘"), head("⚡"), head("⏱"), head("⚠"))),
								React.createElement("tbody", null, laneRows.map(([k, v]) => React.createElement("tr", { key: "gl" + k },
									React.createElement("td", { style: td }, k === "steering" ? "●定调" : k === "patrol" ? "○巡检" : k),
									React.createElement("td", { style: Object.assign({}, td, { opacity: 0.8 }) }, v.total),
									React.createElement("td", { style: Object.assign({}, td, sev(v.ref_fail)) }, "✗" + v.ref_fail),
									React.createElement("td", { style: Object.assign({}, td, sev(v.dropped)) }, "⊘" + v.dropped),
									React.createElement("td", { style: Object.assign({}, td, sev(v.abort)) }, "⚡" + v.abort),
									React.createElement("td", { style: Object.assign({}, td, sev(v.timeout || 0)) }, "⏱" + (v.timeout || 0)),
									React.createElement("td", { style: Object.assign({}, td, sev(v.warn)) }, "⚠" + v.warn)))))) : null,
						React.createElement("div", { style: { opacity: 0.6, marginTop: "4px" } }, "守卫检出退化即剔除该路(不重发不降档); 计数只到面板, 不回写注入文本。"));
				})(),
			);
		}

		/* ══ §九 v14: 运行轨迹·四级下钻(L1 会话列表→L2 轮次→L3 模型卡片→L4 输出全文) ══
		 * 数据源: HTTP /moa-native/trace.json(绕开 typert result 过滤; v12 的 remote trace 通道退役)
		 * 工作区隔离: ws= 过滤(服务端闸)+下拉软隔离(默认记忆); 归档载入=同日期 zstd 解回并入视图 */
		function TracePanel() {
			const [data, setData] = React.useState(null); /* trace.json 响应 */
			const [loadErr, setLoadErr] = React.useState(null); /* v25.1: 首载失败可见(旧静默永卡"加载中…") */
			const [arch, setArch] = React.useState(null); /* 归档载入 {ok, date, count, entries} */
			const [archDate, setArchDate] = React.useState("");
			const [auto, setAuto] = React.useState(true);
			const [view, setView] = React.useState({ lv: 1 }); /* {lv:1}|{lv:2,sid}|{lv:3,sid,key} */
			const [expanded, setExpanded] = React.useState({});
			const [wsFilter, setWsFilter] = React.useState(() => { try { return window.localStorage.getItem("moaNative.ws") || ""; } catch { return ""; } });
			const [sortBy, setSortBy] = React.useState(() => { try { return window.localStorage.getItem("moaNative.sort") || "time"; } catch { return "time"; } });
			const [pins, setPins] = React.useState(() => { try { return JSON.parse(window.localStorage.getItem("moaNative.pins") || "[]"); } catch { return []; } });
			const setWs = (v) => { setWsFilter(v); try { window.localStorage.setItem("moaNative.ws", v); } catch { /* noop */ } };
			const setSort = (v) => { setSortBy(v); try { window.localStorage.setItem("moaNative.sort", v); } catch { /* noop */ } };
			const togglePin = (sid) => { const np = pins.includes(sid) ? pins.filter((x) => x !== sid) : pins.concat([sid]); setPins(np); try { window.localStorage.setItem("moaNative.pins", JSON.stringify(np)); } catch { /* noop */ } };
			const load = React.useCallback(async () => {
				try {
					const q = "/moa-native/trace.json?limit=60" + (wsFilter ? "&ws=" + encodeURIComponent(wsFilter) : "");
					const r = await fetch(q, { cache: "no-store" }).then((x) => x.json());
					if (r && r.ok) { setData(r); setLoadErr(null); } else setLoadErr("trace.json 返回 ok=false");
				} catch (e) { setLoadErr(String((e && e.message) || e)); }
			}, [wsFilter]);
			React.useEffect(() => { load(); }, [load]);
			React.useEffect(() => {
				if (!auto) return undefined;
				const hasRunning = (data && data.entries || []).some((e) => e.status === "running" || (e.agg && e.agg.status === "running") || (e.refs || []).some((x) => x.status === "running"));
				const t = setInterval(load, hasRunning ? 3000 : 15000);
				return () => clearInterval(t);
			}, [auto, data, load]);
			/* 工具函数 */
			const fmtT = (ts) => { try { const d = new Date(ts); return d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) + " " + d.toLocaleTimeString("zh-CN", { hour12: false }); } catch { return "?"; } };
			const fmtMs = (ms) => (ms == null) ? "" : (ms >= 1000 ? (ms / 1000).toFixed(1) + "s" : ms + "ms");
			const dot = (s) => (s === "done" ? "✓" : s === "failed" ? "✗" : s === "running" ? "◐" : s === "aborted" ? "⊘" : s === "timeout" ? "⏱" : "·"); /* v25.1: aborted 建模; v4.4.0: timeout=看门狗判死(独立终态, 与 dock stIcon 同款) */
			const dotColor = (s) => (s === "done" ? "var(--dsh-ok, #4c4)" : s === "failed" ? "var(--dsh-error, #c46)" : s === "timeout" ? "var(--dsh-warning, #c96)" : "inherit");
			/* v4.4.0 拍位标签(轨迹面板用): 节拍档下每轮标明本轮是定调拍/巡检拍/冻结步——
			 * GUIDE 承诺「轨迹面板每轮列出拍位」, 原实现只渲染 dock 横幅, 面板侧缺=文档与代码不符。
			 * 判据与 dock 一致: beat/lane 皆空=非节拍档(cadence 复用), 不显示(避免语义误导)。 */
			const beatTagOf = (en) => {
				if (!en) return null;
				const b = en.beat, l = en.lane;
				if (!b && !l) return null;
				/* v4.4.0 审计修复(P3-5): lane 优先于 beat——lane 决定实际扇出阵容(host laneBase 按 (laneOverride||lane) 选
			 * steering/patrol 阵容), beat 只是引擎拍位; subagent 门控 beat 放行(laneOverride)可与引擎拍位相撞
			 * (引擎 steering + 门控 patrol), 原判据 beat 优先会谎报●定调(提取复演实测 6 例; 生产 subagent_policy=passthrough 下该路径当前不可达)。 */
				if (l === "steering") return "●定调";
				if (l === "patrol") return "○巡检";
				if (b === "steering") return "●定调";
				if (b === "patrol") return "○巡检";
				if (b === "initial") return "●定调";
				if (b === "none" || en.kind === "cache") return "·冻结";
				return null;
			};
			const beatTagStyle = { fontSize: "11px", padding: "0 5px", borderRadius: "3px", border: "1px solid rgba(127,127,127,0.4)", opacity: 0.9 };
			const shortSid = (s) => String(s || "").replace(/^session-/, "").slice(0, 8);
			/* wsDir 友好显示: --D-my-workspace-- → D-my-workspace; ~XXXX~ → Unicode 还原 */
			const decodeWs = (w) => { if (!w) return "?"; try { return w.replace(/^--|--$/g, "").replace(/~([0-9A-Fa-f]{4})~/g, (m, h) => String.fromCharCode(parseInt(h, 16))); } catch { return w; } };
			const loadArch = async () => {
				setArch({ loading: true });
				try { const r = await fetch("/moa-native/trace-archive.json?date=" + archDate, { cache: "no-store" }).then((x) => x.json()); setArch(r); } catch (e) { setArch({ ok: false, error: String(e) }); }
			};
			if (data === null) return React.createElement("div", { style: boxStyle },
				React.createElement("div", { style: hStyle }, "运行轨迹"),
				loadErr
					? React.createElement("div", { style: Object.assign({}, hintStyle, { color: "var(--dsh-error, #c46)" }) },
						"加载失败: " + loadErr + " ",
						React.createElement("button", { onClick: () => load(), style: Object.assign({}, inputStyle, { marginLeft: "6px", padding: "2px 8px" }) }, "重试"))
					: React.createElement("div", { style: hintStyle }, "加载中…"));
			/* v25.1: 归档载入按 seq 去重(live 优先)——ring 冷启动回填与归档同源, 直接 concat 会同轮双显/轮次虚高 */
			const liveEntries = data.entries || [];
			const liveSeqs = new Set(liveEntries.map((e) => String(e.seq)));
			const entries = liveEntries.concat((arch && arch.ok && Array.isArray(arch.entries)) ? arch.entries.filter((e) => !liveSeqs.has(String(e.seq))).map((e) => Object.assign({}, e, { archived: true })) : []);
			const bySid = new Map();
			for (const e of entries) {
				const sid = e.sessionId || "(unknown)";
				if (wsFilter && e.archived && (e.ws || "") !== wsFilter) continue; /* v25.1: 前端二次过滤只作用于归档行——live running 行无 ws 字段, 旧逻辑误删本工作区在跑轮次(服务端已动态反查放行) */
				let g = bySid.get(sid);
				if (!g) { g = { sid, ws: e.ws || null, turns: 0, firstTs: e.ts, lastTs: e.ts, recipes: new Set(), archived: false, running: false }; bySid.set(sid, g); }
				g.turns++; if (e.ts < g.firstTs) g.firstTs = e.ts; if (e.ts > g.lastTs) g.lastTs = e.ts;
				if (e.recipe) g.recipes.add(e.recipe); if (e.archived) g.archived = true;
				if (e.status === "running") g.running = true;
			}
			const sessions = [...bySid.values()].sort((a, b) => (sortBy === "ws" ? ((a.ws || "").localeCompare(b.ws || "") || b.lastTs - a.lastTs) : b.lastTs - a.lastTs)).sort((a, b) => (pins.includes(b.sid) ? 1 : 0) - (pins.includes(a.sid) ? 1 : 0));
			const pinBtn = (sid) => React.createElement("button", { onClick: (e) => { e.stopPropagation(); togglePin(sid); }, style: Object.assign({}, inputStyle, { padding: "2px 6px" }), title: "置顶/取消" }, pins.includes(sid) ? "📌" : "⚲");
			/* ── L3: 模型卡片(轮次详情; key=seq+archived 后缀) ── */
			if (view.lv === 3) {
				const sid = view.sid;
				const en = entries.find((e) => (e.sessionId || "(unknown)") === sid && String(e.seq) + (e.archived ? "a" : "") === view.key);
				if (!en) return React.createElement("div", { style: boxStyle }, React.createElement("div", { style: hintStyle }, "轮次不存在(可能已被 ring 淘汰)"), React.createElement("button", { onClick: () => setView({ lv: 2, sid }), style: inputStyle }, "‹ 返回"));
				return React.createElement("div", { style: boxStyle },
					React.createElement("div", { style: Object.assign({}, hStyle, { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }) },
						React.createElement("button", { onClick: () => setView({ lv: 2, sid }), style: inputStyle }, "‹ 会话"),
						React.createElement("span", null, "轮次 #" + (en.turnInSession != null ? en.turnInSession : en.seq) + " · " + fmtT(en.ts) + " · " + (en.mode || "?") + (en.recipe ? " · " + en.recipe : " · 直配") + (en.restored ? " · 回填" : "") + (en.archived ? " · 🗃" : "")),
						beatTagOf(en) ? React.createElement("span", { style: beatTagStyle, title: "本轮拍位: 定调=重模型方向判断 / 巡检=轻模型执行校订 / 冻结=复用最近一拍" }, beatTagOf(en)) : null),
					React.createElement("div", { style: hintStyle }, (en.kind === "cache" ? "⟲ 缓存复用轮(原文在对应 ▶ 融合轮)" + (en.cached ? " · 第" + (en.cached.entryCount || 0) + "次" + (en.cached.stale ? " +STALE" : "") : "") : "refs 并行咨询 → 聚合输出; 点卡片看 advisory 全文")),
					(en.refs || []).map((r, i) => React.createElement("div", { key: "r" + i, style: { borderTop: "1px solid rgba(127,127,127,0.15)", padding: "6px 0" } },
						React.createElement("div", { onClick: () => setExpanded(Object.assign({}, expanded, { [view.key + "#r" + i]: !expanded[view.key + "#r" + i] })), style: { cursor: "pointer", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", fontSize: "12px" } },
							React.createElement("b", { style: { color: dotColor(r.status) } }, dot(r.status)), React.createElement("span", { fontWeight: 600 }, r.label || ("ref" + (i + 1))),
							r.injection && r.injection !== "__default__" ? React.createElement("span", { style: { opacity: 0.65 } }, "✎" + (r.injection === "__blank__" ? "零注入" : r.injection)) : null,
							React.createElement("span", { style: { opacity: 0.85 } }, (r.provider || "?") + "/" + (r.model || "?") + (r.effort ? "@" + r.effort : "")),
							React.createElement("span", { style: { opacity: 0.7 } }, r.status === "running" ? "…" : fmtMs(r.ms) + (r.chars ? " · " + r.chars + "字" : "") + (r.salvaged ? " · ◇思考兜底" : "") + (r.err ? " · " + r.err : "")),
							React.createElement("span", { style: { opacity: 0.5 } }, expanded[view.key + "#r" + i] ? "▾ 全文" : "▸ 全文")),
						expanded[view.key + "#r" + i] && r.text ? React.createElement("pre", { style: { margin: "4px 0 2px 12px", padding: "8px 10px", background: "rgba(127,127,127,0.1)", borderRadius: "4px", fontSize: "12px", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "360px", overflowY: "auto" } }, r.text) : null)),
					en.agg ? React.createElement("div", { style: { borderTop: "1px solid rgba(127,127,127,0.15)", padding: "6px 0" } },
						React.createElement("div", { style: { fontSize: "12px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" } },
							React.createElement("b", { style: { color: dotColor(en.agg.status) } }, dot(en.agg.status)), React.createElement("span", { fontWeight: 600 }, "aggregator"),
							React.createElement("span", { style: { opacity: 0.85 } }, (en.agg.provider || "?") + "/" + (en.agg.model || "?") + (en.agg.effort ? "@" + en.agg.effort : "")),
							React.createElement("span", { style: { opacity: 0.7 } }, en.agg.status === "running" ? "…" : fmtMs(en.agg.ms) + (en.agg.chars ? " · " + en.agg.chars + "字" : "") + (en.agg.err ? " · " + en.agg.err : ""))),
						React.createElement("div", { style: hintStyle }, "输出即会话消息(不重复存档)——去会话 UI 看最终回答")) : null);
			}
			/* ── L2: 轮次列表(会话详情) ── */
			if (view.lv === 2) {
				const sid = view.sid;
				const turns = entries.filter((e) => (e.sessionId || "(unknown)") === sid).sort((a, b) => b.ts - a.ts);
				const g = bySid.get(sid);
				return React.createElement("div", { style: boxStyle },
					React.createElement("div", { style: Object.assign({}, hStyle, { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }) },
						React.createElement("button", { onClick: () => setView({ lv: 1 }), style: inputStyle }, "‹ 会话列表"),
						React.createElement("span", null, "会话 " + shortSid(sid) + " · " + (g ? decodeWs(g.ws) + " · " + g.turns + " 轮 · " + [...g.recipes].join("/") : "?"))),
					turns.length ? turns.map((en) => {
						const key = String(en.seq) + (en.archived ? "a" : "");
						return React.createElement("div", { key: key, onClick: () => setView({ lv: 3, sid: sid, key: key }), style: { borderTop: "1px solid rgba(127,127,127,0.15)", padding: "6px 0", cursor: "pointer", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", fontSize: "12px" } },
							React.createElement("span", { style: { fontVariantNumeric: "tabular-nums", opacity: 0.8 } }, "#" + (en.turnInSession != null ? en.turnInSession : en.seq) + " " + fmtT(en.ts)),
							React.createElement("span", { fontWeight: 600 }, (en.kind === "cache" ? "⟲ 缓存复用" : "▶ 融合") + " · " + (en.mode || "?") + (en.recipe ? " · " + en.recipe : "")),
						beatTagOf(en) ? React.createElement("span", { style: beatTagStyle, title: "本轮拍位(定调/巡检/冻结)" }, beatTagOf(en)) : null,
							React.createElement("span", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
								(en.refs || []).map((r, i) => React.createElement("span", { key: "s" + i },
									React.createElement("b", { style: { color: dotColor(r.status) } }, dot(r.status)), " ",
									String(r.label || "?").split("/").pop() + (r.status === "running" ? "…" : " " + fmtMs(r.ms))))),
							en.agg ? React.createElement("span", null, React.createElement("b", { style: { color: dotColor(en.agg.status) } }, dot(en.agg.status)), " agg " + String(en.agg.model || "?").split("/").pop()) : null,
							en.restored ? React.createElement("span", { style: { opacity: 0.5 } }, "回填") : null,
							en.archived ? React.createElement("span", { style: { opacity: 0.5 } }, "🗃") : null);
					}) : React.createElement("div", { style: hintStyle }, "(该会话在当前视图无轮次)"));
			}
			/* ── L1: 会话列表(默认) ── */
			const stats = (data && data.stats) || null;
			const cost = (data && data.cost) || null;
			return React.createElement("div", { style: boxStyle },
				React.createElement("div", { style: Object.assign({}, hStyle, { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }) },
					"运行轨迹(累计 " + (data.totalTurns != null ? data.totalTurns : "?") + " 轮 · 跨重启回填)",
					React.createElement("button", { onClick: load, style: inputStyle }, "⟳ 刷新"),
					React.createElement("label", { style: { fontSize: "12px", opacity: 0.8, display: "flex", gap: "4px", alignItems: "center" } },
						React.createElement("input", { type: "checkbox", checked: auto, onChange: (e) => setAuto(e.target.checked) }), "自动")),
				React.createElement("div", { style: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", margin: "4px 0" } },
					React.createElement("span", { style: { fontSize: "12px", opacity: 0.8 } }, "工作区:"),
					React.createElement("select", { value: wsFilter, onChange: (e) => setWs(e.target.value), style: inputStyle },
						React.createElement("option", { value: "" }, "全部"),
						((data.workspaces || [])).map((w) => React.createElement("option", { key: w, value: w }, decodeWs(w)))),
					React.createElement("span", { style: { fontSize: "12px", opacity: 0.8 } }, "排序:"),
					React.createElement("select", { value: sortBy, onChange: (e) => setSort(e.target.value), style: inputStyle },
						React.createElement("option", { value: "time" }, "按时间"), React.createElement("option", { value: "ws" }, "按工作区"))),
				React.createElement("div", { style: hintStyle }, "工作区隔离: 选定后只显示该工作区的轮次(member 互不可见); 会话→轮次→模型→advisory 全文四级下钻。"),
				stats && stats.refs && stats.refs.length ? React.createElement("details", { style: { margin: "6px 0" } },
					React.createElement("summary", { style: { fontSize: "12px", opacity: 0.8 } }, "▸ refs 统计" + (cost ? "(成本≈$" + cost.costEst + ")" : "")),
					React.createElement("div", { style: { fontSize: "12px", margin: "4px 0 4px 8px" } },
						stats.refs.map((s) => React.createElement("div", { key: s.key, style: { opacity: 0.85 } }, s.key + " · " + s.calls + "次 · 均" + fmtMs(s.avgMs) + " · 均" + s.avgChars + "字" + (s.fails ? " · ✗" + s.fails : "") + (s.timeouts ? " · ⏱" + s.timeouts : "") + (s.salvaged ? " · ◇" + s.salvaged : ""))),
						React.createElement("div", { style: { opacity: 0.85 } }, "agg · " + stats.agg.calls + "次 · 均" + fmtMs(stats.agg.avgMs) + " · 均" + stats.agg.avgChars + "字" + (stats.agg.fails ? " · ✗" + stats.agg.fails : "")),
						cost ? React.createElement("div", { style: hintStyle }, "输出侧估算 " + cost.outputTokEst + " tok ≈ $" + cost.costEst + "(" + cost.note + "; 单价表 config prices 字段)") : null),
				) : null,
				sessions.length ? sessions.map((g) => React.createElement("div", { key: g.sid, onClick: () => setView({ lv: 2, sid: g.sid }), style: { borderTop: "1px solid rgba(127,127,127,0.15)", padding: "6px 0", cursor: "pointer", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", fontSize: "12px" } },
					pinBtn(g.sid),
					React.createElement("span", { fontWeight: 600 }, shortSid(g.sid)),
					React.createElement("span", { style: { opacity: 0.75 } }, decodeWs(g.ws)),
					React.createElement("span", null, [...g.recipes].join("/") || "直配"),
					React.createElement("span", { style: { opacity: 0.8 } }, g.turns + " 轮"),
					React.createElement("span", { style: { opacity: 0.6 } }, fmtT(g.firstTs) + " ~ " + fmtT(g.lastTs)),
					g.running ? React.createElement("span", null, "◐ 运行中") : null,
					g.archived ? React.createElement("span", { style: { opacity: 0.5 } }, "🗃 含归档") : null,
				)) : React.createElement("div", { style: hintStyle }, "(尚无轨迹——在 provider 页选 moa-native 条目发起会话, 或 /moa 斜杠触发后回到这里)"),
				React.createElement("details", { style: { margin: "8px 0 0" } },
					React.createElement("summary", { style: { fontSize: "12px", opacity: 0.8 } }, "▸ 历史归档(zstd 按日)"),
					React.createElement("div", { style: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", margin: "4px 0" } },
						React.createElement("input", { value: archDate, placeholder: "YYYYMMDD", onChange: (e) => setArchDate(e.target.value.replace(/[^0-9]/g, "").slice(0, 8)), style: Object.assign({}, inputStyle, { width: "100px" }) }),
						React.createElement("button", { onClick: loadArch, style: inputStyle }, "载入"),
						arch && arch.ok ? React.createElement("span", { style: hintStyle }, "已并入: " + arch.date + " 共 " + arch.count + " 轮(🗃 标记)") : null,
						arch && arch.ok === false ? React.createElement("span", { style: hintStyle }, "读取失败: " + (arch.error || "?")) : null),
					React.createElement("div", { style: hintStyle }, "载入后归档轮次并入会话分组, 可继续下钻; 文件: ~/.dsh/moa-native-traces/trace-<date>.jsonl.zstd")),
			);
		}

		const PanelSafe = (props) => {
			try { return NativeConsole(props); } catch (e) {
				return React.createElement("div", { style: { color: "var(--dsh-error, #c46)", padding: "12px", fontSize: "13px" } }, "NativeConsole 渲染错误(自捕获): " + String(e && e.message || e));
			}
		};

		/* ══ §十三 v17 MoaDock / §十五 v18 交互升级——输入框上方实时阶段横幅(conversation.input.dock 官方 seat, compactplus 同款) ══
		 * 数据源: HTTP /moa-native/live.json?sid=(ring 实时状态, 零新增埋点); 1s 轮询(running)/8s 静默(v18 修 stale closure 后真正生效);
		 * 渲染: REF 各路 ⭕✓✗带耗时 + AGG 等待/流式; 终态 15s 隐藏(精确 timer); ⟲ 缓存轮 10s; ✕ 可关闭至新 entry; 失联静默零打扰 */
		function MoaDock(props) {
			const sessionId = props && props.sessionId;
			const [snap, setSnap] = React.useState(null);
			/* [v18 Fix] stale closure: poll 递归闭包引用 state 初值(null)且误用 .entry(setSnap 的就是 entry 本身)
			 * → running 判定恒 false → 设计的 2s/8s 双档实际恒 8s 慢轮询(用户感知刷新慢的根因); 改 ref 携带最新 entry */
			const snapRef = React.useRef(null);
			const [dismissed, setDismissed] = React.useState(null); /* §十五: ✕ 关闭的 entryKey, 新 entry 自动重显 */
			const [, setHideTick] = React.useState(0); /* §十五: 精确隐藏 timer 驱动重渲染(到点即隐, 不等下一轮 poll) */
			const isRunning = (e) => {
				if (!e) return false;
				if (e.status !== "running" && !(e.refs || []).some((x) => x.s === "running") && !(e.agg && e.agg.s === "running")) return false;
				return (Date.now() - (e.ts || 0)) < 1200000; /* v25.1 兜底: 超 10min 仍 running 视作失联降出快轮询(host finally 已补终态, 双保险);
					*v4.4.0 放宽到 20min——refs deadline 已放宽到 600s(=旧兜底值), 一路贴死线再叠 agg 时长会超 600s,
					旧兜底会把仍在跑的轮次误判为"已完成"(banner 提前消失, 用户以为结束实则还在跑)。 */
			};
			React.useEffect(() => {
				if (!sessionId) return undefined;
				let alive = true, timer = null;
				const poll = async () => {
					try {
						const r = await fetch("/moa-native/live.json?sid=" + encodeURIComponent(sessionId), { cache: "no-store" }).then((x) => x.json());
						if (!alive) return;
						if (r && r.ok) { snapRef.current = r.entry || null; setSnap(r.entry || null); }
					} catch (e) { /* 静默: dock 失联不打扰输入区 */ }
					if (alive) timer = setTimeout(poll, isRunning(snapRef.current) ? 1000 : 8000); /* v18: running 1s/静默 8s */
				};
				poll();
				return () => { alive = false; if (timer) clearTimeout(timer); };
			}, [sessionId]);
			/* 精确隐藏: 终态/⟲ 到点重渲染一次(hooks 均在 early-return 之前, 顺序恒定) */
			React.useEffect(() => {
				const e = snapRef.current;
				if (!e || isRunning(e)) return undefined;
				const lim = e.kind === "cache" ? 10000 : 15000;
				const remain = lim - (Date.now() - (e.finishedAt || e.ts)); /* v25.1: 终态窗口以完成时刻为准(旧=开始时刻, 长轮完成瞬间即隐) */
				if (remain <= 0) return undefined;
				const t = setTimeout(() => setHideTick((x) => x + 1), remain + 60);
				return () => clearTimeout(t);
			}, [snap]);
			if (!sessionId || !snap) return null;
			const fmtMs = (ms) => (ms >= 1000 ? (ms / 1000).toFixed(1) + "s" : ms + "ms");
			const stIcon = (s) => (s === "done" ? "✓" : s === "failed" ? "✗" : s === "running" ? "⭕" : s === "aborted" ? "⊘" : s === "timeout" ? "⏱" : s === "pending" ? "◷" : "·"); /* v25.1: aborted 建模; v4.4.0: timeout=看门狗判死(独立终态), pending=agg 规划中未起跑 */
			const stColor = (s) => (s === "done" ? "var(--dsh-success, #4a9)" : s === "failed" ? "var(--dsh-error, #c46)" : s === "timeout" ? "var(--dsh-warning, #c96)" : "inherit");
			const running = isRunning(snap);
			const age = Date.now() - (snap.finishedAt || snap.ts); /* v25.1: 完成时刻优先 */
			/* §十五: ✕ dismiss(entryKey=ts+kind, 同快照不复活/新 entry 自动重显) + 终态 60s→15s(⟲ 保留 10s) */
			const entryKey = snap.ts + "|" + snap.kind;
			const xBtn = React.createElement("span", { onClick: () => setDismissed(entryKey), title: "关闭横幅(新事件自动重新显示)", style: { cursor: "pointer", opacity: 0.45, marginLeft: "auto", fontSize: "12px", alignSelf: "center", padding: "0 2px" } }, "✕");
			if (!running && (dismissed === entryKey || age > (snap.kind === "cache" ? 10000 : 15000))) return null;
			const bar = { border: "1px solid var(--dsh-border, rgba(128,128,128,0.4))", borderRadius: "8px", padding: "6px 12px", margin: "4px 0", fontSize: "13px", display: "flex", gap: "10px", alignItems: "baseline", flexWrap: "wrap", background: "var(--dsh-input-bg, rgba(127,127,127,0.06))" };
			const dim = { opacity: 0.65, fontSize: "12px" };
			if (snap.kind === "cache") {
				return React.createElement("div", { style: bar },
					React.createElement("span", { style: { fontWeight: "bold" } }, "⟲ MoA 同轮复用"),
					/* v4.4.0: 冻结徽标(非拍步=复用最近一拍, 不重扇)——拍位徽标在下方 fanout 分支, cache 分支提前 return,
					 * 原实现放在下方的 "·冻结" 分支不可达。
					 * 条件化: 只在节拍档显示(beat/lane 非空)。user_turn/every_n 档的复用是 cadence 复用, 不是"拍位冻结", 硬显会语义不准。
					 * 节拍档非拍步 beat="none"(字符串 truthy)→ 仍显示冻结。 */
					(snap.beat || snap.lane) ? React.createElement("span", { style: { fontSize: "12px", padding: "0 6px", borderRadius: "3px", border: "1px solid rgba(127,127,127,0.4)", opacity: 0.9 }, title: "非拍步: 复用最近一拍的 guidance, 不重跑 refs" }, "·冻结") : null,
					React.createElement("span", { style: dim }, "第" + ((snap.cached && snap.cached.entryCount) || 0) + "次" + (snap.cached && snap.cached.stale ? " +STALE" : "") + " — 本轮 refs 意见直接再注入(cadence 省算), 明细在轨迹面板"),
					xBtn);
			}
			const aggRunning = snap.agg && snap.agg.s === "running";
			const totalMs = running ? Date.now() - snap.ts : null;
			/* v4.4.0: 拍位徽标(定调/巡检/冻结)——拍位本只存宿主侧 trace, 投影层丢失致用户无从判断当前是定调拍还是巡检拍
			 * (2026-11-03 用户实锤「没有相关的流程定义」)。编排词汇仅宿主面可见, 不进 guidance 文本。 */
			/* v4.4.0 审计修复(P3-5): lane 优先于 beat——与轨迹面板 beatTagOf 同款判据(lane 决定实际扇出阵容) */
			const beatTag = (snap.lane === "steering") ? "●定调" : (snap.lane === "patrol" ? "○巡检" : (snap.beat === "steering" ? "●定调" : (snap.beat === "patrol" ? "○巡检" : (snap.kind === "cache" ? "·冻结" : ""))));
			const beatTagTitle = beatTag === "●定调" ? "定调拍(steering): 重模型方向判断" : (beatTag === "○巡检" ? "巡检拍(patrol): 轻模型执行校订" : "非拍步: 复用最近一拍的 guidance, 不重跑 refs");
			const beatTagStyle = { fontSize: "12px", padding: "0 6px", borderRadius: "3px", border: "1px solid rgba(127,127,127,0.4)", opacity: 0.9 };
			return React.createElement("div", { style: bar },
				React.createElement("span", { style: { fontWeight: "bold" } }, (running ? "⏳ " : (snap.status === "failed" ? "✗ " : snap.status === "aborted" ? "⊘ " : "✓ ")) + "MoA · " + snap.mode + (snap.recipe ? "·" + snap.recipe : "")),
				beatTag ? React.createElement("span", { style: beatTagStyle, title: beatTagTitle }, beatTag) : null,
				React.createElement("span", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
					"REF:",
					(snap.refs || []).map((r, i) => React.createElement("span", { key: "r" + i, title: r.e || "" },
						React.createElement("b", { style: { color: stColor(r.s) } }, stIcon(r.s)), " " + r.n + (r.s === "running" ? " " + fmtMs(r.ms) : (r.ms ? " " + fmtMs(r.ms) : "") + (r.c ? "·" + r.c + "字" : "") + (r.s === "timeout" ? "·超时" : "") + (r.sv ? "·◇思考兜底" : ""))))),
				snap.agg ? React.createElement("span", null,
					React.createElement("b", { style: { color: stColor(snap.agg.s) } }, stIcon(snap.agg.s)), " AGG: " + snap.agg.m + " " + (snap.agg.s === "running" ? "流式中 " + fmtMs(snap.agg.ms) : (snap.agg.plan ? "待起跑(refs 咨询中)" : (aggRunning ? "" : fmtMs(snap.agg.ms) + (snap.agg.c ? "·" + snap.agg.c + "字" : ""))))) : null,
				!snap.agg && running ? React.createElement("span", { style: dim }, "AGG: 等待 refs") : null,
				totalMs != null ? React.createElement("span", { style: dim }, "(" + fmtMs(totalMs) + ")") : null,
				!running && snap.status === "done" ? React.createElement("span", { style: dim }, "融合完成") : null,
				!running && snap.status === "aborted" ? React.createElement("span", { style: dim }, "已取消(上游中断)") : null,
				!running && snap.status === "failed" ? React.createElement("span", { style: dim }, (((snap.refs || []).length && !(snap.refs || []).some((r) => r.s === "done")) ? ((snap.refs || []).some((r) => r.s === "timeout") ? "失败——refs 有路被闸判死(超时), 已降级直转 agg" : "失败——refs 全败, 已降级直转 agg") : "失败——agg 流中断/异常")) : null, /* v25.1: failed 文案按来源分支(旧固定写 refs 全败, agg 失败被误导); v4.4.0: 超时路单独点名 */
				xBtn);
		}
		const MoaDockSafe = (props) => {
			try { return MoaDock(props); } catch (e) {
				return React.createElement("div", { style: { color: "var(--dsh-error, #c46)", fontSize: "12px", padding: "2px 8px" } }, "MoaDock 错误(自捕获): " + String(e && e.message || e));
			}
		};

		async function apply(ctx) {
			const remote = ctx.remote;
			const wide = { parse: (v) => v };
			const resultOf = (m) => ({ mode: "strict", typeSymbol: "moa-native#nativeCfg/" + m + ":result", schema: wide, create: () => wide });
			const disposeMount = await remote.$mount({
				package: "moa-native",
				descriptors: [
					{ id: "moa-native#nativeCfg/list", service: "nativeCfgGw", namespace: "nativeCfg", method: "list", invocation: { kind: "direct" }, parameters: [], result: resultOf("list") },
					{ id: "moa-native#nativeCfg/models", service: "nativeCfgGw", namespace: "nativeCfg", method: "models", invocation: { kind: "direct" }, parameters: [], result: resultOf("models") },
					{ id: "moa-native#nativeCfg/efforts", service: "nativeCfgGw", namespace: "nativeCfg", method: "efforts", invocation: { kind: "direct" }, parameters: [{ name: "provider", wire: "provider", source: "json", codec: { mode: "strict", typeSymbol: "moa-native#eff.provider", schema: wide, create: () => wide } }, { name: "model", wire: "model", source: "json", codec: { mode: "strict", typeSymbol: "moa-native#eff.model", schema: wide, create: () => wide } }], result: resultOf("efforts") },
					{ id: "moa-native#nativeCfg/save", service: "nativeCfgGw", namespace: "nativeCfg", method: "save", invocation: { kind: "direct" }, parameters: [{ name: "patch", wire: "patch", source: "json", codec: { mode: "strict", typeSymbol: "moa-native#patch", schema: wide, create: () => wide } }], result: resultOf("save") },
					{ id: "moa-native#nativeCfg/trace", service: "nativeCfgGw", namespace: "nativeCfg", method: "trace", invocation: { kind: "direct" }, parameters: [{ name: "limit", wire: "limit", source: "json", codec: { mode: "strict", typeSymbol: "moa-native#trace.limit", schema: wide, create: () => wide } }], result: resultOf("trace") },
				],
			});
			const callCfg = async (op, arg, arg2) => {
				const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("host 网关 15s 未响应")), ms || 15000))]);
				const svc = (typeof ctx.get === "function" && ctx.get("remote.nativeCfg")) || (remote && remote.nativeCfg);
				if (!svc) throw new Error("remote.nativeCfg 不可用(host 网关未挂载?)");
				if (op === "list") return withTimeout(svc.list());
				if (op === "models") return withTimeout(svc.models());
				if (op === "efforts") return withTimeout(svc.efforts(arg, arg2));
				if (op === "save") return withTimeout(svc.save(arg));
				if (op === "trace") return withTimeout(svc.trace(arg), 20000);
				throw new Error("未知 op: " + String(op));
			};
			const slots = ctx.slots;
			slots.inject("settings.section", () => slots.register({
				name: "settings.section",
				id: "moa-native-console",
				order: 63,
				label: () => "MoA-Native 控制台",
			}, () => React.createElement(PanelSafe, { callCfg: callCfg })));
			/* §十三 v17: 会话 dock(输入框上方全宽横幅, compactplus 同款官方 seat; session scope 只显当前会话;
			 * inject(sessionId) 官方契约: dock 绑定会话时调用, 返回值作组件 props; order=12 错开 compactplus(11)) */
			slots.inject("conversation.input.dock", () => slots.register({
				name: "conversation.input.dock",
				id: "moa-native",
				order: 12,
				inject: (sessionId) => ({ sessionId: sessionId }),
			}, MoaDockSafe));
			return async () => { try { await disposeMount(); } catch (e) { /* noop */ } };
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
