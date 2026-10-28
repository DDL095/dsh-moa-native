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
			React.useEffect(() => { (async () => {
				try {
					/* v8: HTTP 直读优先(panel.json 无 typert result 过滤), 失败回退 typert 通道 */
					let cfgRes = null, modelRes = null;
					try {
						const r = await fetch("/moa-native/panel.json", { cache: "no-store" });
						const j = await r.json();
						if (j && j.ok && j.list && j.list.ok) { cfgRes = j.list; modelRes = j.models || {}; }
					} catch { /* 回退 */ }
					if (!cfgRes) { [cfgRes, modelRes] = await Promise.all([callCfg("list"), callCfg("models")]); }
					if (!cfgRes || !cfgRes.ok) throw new Error((cfgRes && cfgRes.error) || "list 失败");
					/* v7: JSON 字符串直通优先(浏览器端 typert 对嵌套对象 result 有字段过滤) */
					const parseJsonField = (js, fb) => { try { const v = (typeof js === "string" && js) ? JSON.parse(js) : null; return (v && typeof v === "object") ? v : (fb || {}); } catch { return fb || {}; } };
					const raw = parseJsonField(cfgRes.rawJson, cfgRes.raw || {});
					const v7provs = parseJsonField(modelRes && modelRes.providersJson, (modelRes && modelRes.providers) || {});
					const v7slots = parseJsonField(modelRes && modelRes.slotsJson, (modelRes && modelRes.slots) || {});
					const eff = cfgRes.effective || {};
					const normCad = (v) => v === "per_iteration" ? "per_iteration" : (v && typeof v === "object" && v.every_n) ? String(v.every_n) : "user_turn";
					const normRecipe = (v, fb) => {
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
							cadence: normCad(v.cadence),
							settle_ms: Number.isFinite(v.settle_ms) ? String(v.settle_ms) : "",
							reference_max_tokens: Number.isFinite(v.reference_max_tokens) ? String(v.reference_max_tokens) : "",
							debug: !!v.debug,
							aggInjection: typeof v.aggInjection === "string" && v.aggInjection ? v.aggInjection : "agg_default",
						};
					};
					/* 内置只读快照(effective 合并表中, raw.recipes 没有的内置名=未覆盖) */
					const builtinSnap = {};
					for (const k of BUILTIN) if (eff.recipes && eff.recipes[k] && !(raw.recipes && raw.recipes[k])) builtinSnap[k] = normRecipe(eff.recipes[k]);
					setEdit({
						recipe: typeof raw.recipe === "string" ? raw.recipe : "",
						recipes: (() => { const o = {}; for (const [k, v] of Object.entries(raw.recipes || {})) o[k] = normRecipe(v); return o; })(),
						builtinSnap,
						direct: normRecipe({ refs: raw.refs, aggregator: raw.aggregator, aggInjection: raw.aggInjection, mode: raw.mode, cadence: raw.cadence, settle_ms: raw.settle_ms, reference_max_tokens: raw.reference_max_tokens, debug: raw.debug }, ["minimax-fast", "kimi-flagship"]),
						slots: JSON.parse(JSON.stringify(raw.slots && typeof raw.slots === "object" ? raw.slots : {})),
						disabled_models: Array.isArray(raw.disabled_models) ? raw.disabled_models.slice() : [],
						/* §二十六 v27: subagent 门控("passthrough"|"full"|数字串=every_n) */
						subagentPolicy: (() => { const p = raw.subagent_policy; if (p === "full") return "full"; if (p && typeof p === "object" && Number.isFinite(p.every_n)) return String(Math.floor(p.every_n)); return "passthrough"; })(),
						/* §十一 v15: 用户自建注入文本模块(名→文本); 内置默认🔒/空白🔒运行时合成不落盘 */
						injections: (() => { const o = {}; if (raw.injections && typeof raw.injections === "object") for (const [k, v] of Object.entries(raw.injections)) if (typeof v === "string" && v.trim()) o[k] = v; return o; })(),
						aggInjections: (() => { const o = {}; if (raw.aggInjections && typeof raw.aggInjections === "object") for (const [k, v] of Object.entries(raw.aggInjections)) if (typeof v === "string" && v.trim()) o[k] = v; return o; })(),
						newName: "",
					});
				/* M4.4.2: providers/slots/efforts 用 JSON 直通解析结果覆盖(防 typert 字段过滤) */
					const effortsBy = parseJsonField(modelRes && modelRes.effortsJson, (modelRes && modelRes.effortsBy) || {});
					setSt({ models: Object.assign({}, modelRes, { providers: v7provs, slots: v7slots, effortsBy: effortsBy }), injDefault: (eff && typeof eff.injectionDefault === "string") ? eff.injectionDefault : "(默认注入文本下发失败——host v15 未生效?)", aggInjDefault: (eff && typeof eff.aggInjDefault === "string") ? eff.aggInjDefault : "", aggInjForRefsBlank: (eff && typeof eff.aggInjForRefsBlank === "string") ? eff.aggInjForRefsBlank : "", warnings: (eff && Array.isArray(eff.warnings)) ? eff.warnings : [] });
				} catch (e) { setSt({ err: String(e && e.message || e) }); }
			})(); }, [callCfg]);
			if (st && st.err) return React.createElement("div", { style: { color: "var(--dsh-error, #c46)", padding: "12px", fontSize: "13px" } }, "加载失败: " + st.err);
			if (!st || !edit) return React.createElement("div", { style: { padding: "12px", fontSize: "13px", opacity: 0.7 } }, "moa-native 控制台加载中…");
			const models = st.models || {};
			const slotsTable = Object.assign({}, models.slots, edit.slots);
			const provEntries = Object.entries(models.providers || {});
			/* 模型下拉: 命名条目组 + provider 分组(两级视觉: zai→glm-5.3…) */
			const ModelSelect = ({ val, onCh }) => {
				const bare = splitEffort(val)[0];
				const known = provEntries.some(([p, ms]) => (ms || []).some((m) => p + "/" + m === bare));
				return React.createElement("select", { value: bare || "", onChange: (e) => onCh(e.target.value), style: Object.assign({}, inputStyle, { flex: "1" }) },
					React.createElement("option", { value: "" }, "（选择…）"),
					bare && !known ? React.createElement("option", { value: bare }, bare + "（表外保留）") : null,
					provEntries.map(([p, ms]) => React.createElement("optgroup", { key: "p-" + p, label: p }, (ms || []).map((m) => React.createElement("option", { key: p + "/" + m, value: p + "/" + m }, m + (edit.disabled_models.includes(p + "/" + m) ? "（禁用）" : ""))))),
				);
			};
			/* effort 下拉: 选定模型后按需查档位; 命名条目=自带 effort 不再选 */
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
					return React.createElement("select", { value: val || "", onChange: (e) => onCh(e.target.value), style: Object.assign({}, inputStyle, { flex: "0 1 110px" }) },
						React.createElement("option", { value: "" }, "effort:默认"),
						val && !known ? React.createElement("option", { value: val }, val + "（保留）") : null,
						localEfforts.map((e) => React.createElement("option", { key: e, value: e }, e)));
				}
				if (efforts === null) return React.createElement("span", { style: Object.assign({}, hintStyle, { margin: 0, flex: "0 0 auto", alignSelf: "center" }) }, "effort…");
				if (!efforts.length) return React.createElement("span", { style: Object.assign({}, hintStyle, { margin: 0, flex: "0 0 auto", alignSelf: "center" }) }, "（无档位）");
				const known = efforts.includes(val);
				return React.createElement("select", { value: val || "", onChange: (e) => onCh(e.target.value), style: Object.assign({}, inputStyle, { flex: "0 1 110px" }) },
					React.createElement("option", { value: "" }, "effort:默认"),
					val && !known ? React.createElement("option", { value: val }, val + "（保留）") : null,
					efforts.map((e) => React.createElement("option", { key: e, value: e }, e)));
			};
			const upd = (patch) => setEdit(Object.assign({}, edit, patch));
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
			const refRow = (v, i) => {
				const inj = v.injection || "__default__";
				const known = injOptions.some((o) => o.v === inj);
				return React.createElement("span", { key: i, style: { display: "flex", gap: "4px", marginBottom: "4px", alignItems: "center", flexWrap: "wrap" } },
					React.createElement(TripleSelect, { val: v.model, onCh: (nv) => setTgtRef(i, nv) }),
					React.createElement("select", { value: inj, onChange: (e) => setTgtInj(i, e.target.value), title: "注入文本模块(F 模式尾注)", style: Object.assign({}, inputStyle, { flex: "0 1 130px" }) },
						!known ? React.createElement("option", { value: inj }, inj + "(缺失)") : null,
						injOptions.map((o) => React.createElement("option", { key: o.v, value: o.v }, "✎ " + o.t))),
					React.createElement("label", { title: "思考传递(§十九 v22-B): 该路思考原文(无截断)进 guidance, 块头+思考标注; 默认关。成本提示: guidance 在请求尾部, 每步 agg 全价重付", style: { fontSize: "11px", display: "flex", gap: "3px", alignItems: "center", opacity: 0.92, cursor: "pointer" } },
						React.createElement("input", { type: "checkbox", checked: v.includeReasoning === true, onChange: (e) => setTgtInc(i, e.target.checked) }),
						"思考"),
					React.createElement("button", { onClick: () => setTgtRaw({ refs: tgt.refs.filter((_, j) => j !== i) }), style: inputStyle }, "✕"));
			};
			const saveAs = () => {
				const taken = Object.keys(edit.recipes);
				let nm = (edit.newName || "").trim();
				if (!nm) { let n = 1; while (taken.includes("参数" + n)) n++; nm = "参数" + n; }
				upd({ recipes: Object.assign({}, edit.recipes, { [nm]: JSON.parse(JSON.stringify(tgt)) }), recipe: nm, newName: "" });
			};
			const delRecipe = () => { const nr = Object.assign({}, edit.recipes); delete nr[edit.recipe]; upd({ recipes: nr, recipe: "" }); };
			const toggleDisabled = (mid) => upd({ disabled_models: edit.disabled_models.includes(mid) ? edit.disabled_models.filter((x) => x !== mid) : edit.disabled_models.concat([mid]) });
			const save = async () => {
				setSt(Object.assign({}, st, { saving: true, saved: null }));
				try {
					const cadOut = (v) => v === "user_turn" ? "user_turn" : v === "per_iteration" ? "per_iteration" : { every_n: Math.max(1, parseInt(v, 10) || 2) };
					/* §十一 v15: refs 序列化——无注入还原字符串(最小 diff), 有注入输出 {model,injection} */
					const serRef = (x) => { if (!x || !x.model) return ""; const base = (x.injection && x.injection !== "__default__") ? { model: x.model, injection: x.injection } : x.model; return (x.includeReasoning === true) ? Object.assign({}, typeof base === "string" ? { model: base } : base, { includeReasoning: true }) : base; }; /* §十九 v22-B: 勾选=对象形态带 includeReasoning, 未勾=最小 diff */
					const outRecipe = (r) => { const o = { refs: r.refs.filter((x) => x && x.model && x.model.trim()).map(serRef), aggregator: r.aggregator }; if (r.aggInjection && r.aggInjection !== "agg_default") o.aggInjection = r.aggInjection; if (r.mode) o.mode = r.mode; if (r.cadence) o.cadence = cadOut(r.cadence); if (r.settle_ms !== "") o.settle_ms = Math.max(0, parseInt(r.settle_ms, 10) || 2000); if (r.reference_max_tokens !== "") o.reference_max_tokens = parseInt(r.reference_max_tokens, 10); if (r.debug) o.debug = true; return o; };
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
						slots: edit.slots,
						disabled_models: edit.disabled_models,
						/* §二十六 v27: subagent 门控序列化("passthrough"=省略保最小 diff) */
						subagent_policy: edit.subagentPolicy === "full" ? "full" : (/^\d+$/.test(String(edit.subagentPolicy)) ? { every_n: Math.max(1, Math.min(50, parseInt(edit.subagentPolicy, 10))) } : undefined),
					};
					if (!patch.mode) delete patch.mode;
					if (!patch.subagent_policy) delete patch.subagent_policy;
					if (!patch.settle_ms) delete patch.settle_ms;
					if (!patch.reference_max_tokens) delete patch.reference_max_tokens;
					const res = await callCfg("save", patch);
					setSt(Object.assign({}, st, { saving: false, saved: res && res.ok ? "已保存(热生效)—— default 与配方已同步到 provider 页(新配方需重启后出现)" : "保存失败: " + ((res && res.error) || "未知") }));
				} catch (e) { setSt(Object.assign({}, st, { saving: false, saved: "保存异常: " + String(e && e.message || e) })); }
			};
			/* 摘要(provider 页 description 同款) */
			const summary = (r) => (r.mode || "F") + " · [" + r.refs.map((x) => shortName(splitEffort((x && x.model) || x || "")[0], slotsTable) + ((x && x.injection && x.injection !== "__default__") ? "[" + x.injection + "]" : "") + ((x && x.includeReasoning) ? "+思" : "")).join("+") + "→" + shortName(splitEffort(r.aggregator)[0], slotsTable) + "] · " + r.cadence;
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
							const cad = t.cadence === "per_iteration" ? "per_iteration" : (/^\d+$/.test(String(t.cadence)) ? ("跳" + t.cadence + "步") : "user_turn");
							const base = "[" + (refs || "（空阵容）") + "→" + (agg || "?") + "]";
							return "⌨ 斜杠生效预览(常驻会话内): /moaR → " + base + " · R 裁剪视图(省输入, 小窗模型友好) | /moaF → " + base + " · F 全量镜像(零信息差, 缓存最优)。阵容/agg/节奏取自当前编辑目标, 斜杠只换视野; cadence=" + cad + (cad === "user_turn" ? "(斜杠轮新指纹必 miss=等效手动强制扇出一次)" : "(斜杠轮照常按缓存/节奏决策)");
						})()),
					React.createElement("div", { style: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", margin: "4px 0" } },
						React.createElement("button", { onClick: () => upd({ recipe: "" }), style: Object.assign({}, inputStyle, usingRecipe ? {} : { fontWeight: 600, borderColor: "rgba(100,160,255,0.8)" }) }, "⌂ 默认配置 default · " + summary(edit.direct)),
						React.createElement("button", { onClick: save, disabled: st.saving, style: Object.assign({}, inputStyle, { fontWeight: 600 }) }, st.saving ? "保存中…" : "💾 保存(热生效)"),
					),
					st.saved ? React.createElement("div", { style: Object.assign({}, hintStyle, { margin: "4px 0 0" }) }, st.saved) : null,
					React.createElement("div", { style: hintStyle }, "配方(provider 页同名条目, 点选进入编辑):"),
					Object.keys(edit.recipes).map((k) => React.createElement("div", { key: k, style: { display: "flex", gap: "6px", alignItems: "center", margin: "2px 0" } },
						React.createElement("button", { onClick: () => upd({ recipe: k }), style: Object.assign({}, inputStyle, { flex: "1 1 auto", textAlign: "left" }, edit.recipe === k ? { fontWeight: 600, borderColor: "rgba(100,160,255,0.8)" } : {}) }, (edit.recipe === k ? "▸ " : "") + k + " · " + summary(edit.recipes[k])),
						React.createElement("button", { onClick: () => { const nr = Object.assign({}, edit.recipes); delete nr[k]; upd({ recipes: nr, recipe: edit.recipe === k ? "" : edit.recipe }); }, style: inputStyle }, "🗑"))),
					React.createElement("div", { style: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", margin: "4px 0" } },
						React.createElement("span", null, "新配方名:"), React.createElement("input", { value: edit.newName, placeholder: "空=参数N 自动", onChange: (e) => upd({ newName: e.target.value }), style: Object.assign({}, inputStyle, { flex: "0 1 150px" }) }),
						React.createElement("button", { onClick: saveAs, style: inputStyle }, "＋ 从当前编辑新建配方")),
				),
				/* ══ 配置态(折叠·全部拓扑自由度) ══ */
				React.createElement("details", { style: boxStyle },
					React.createElement("summary", { style: hStyle }, "▸ 配置态: 编辑配方 / 命名条目 / 模型开关"),
					React.createElement("div", { style: Object.assign({}, hintStyle, { background: "rgba(127,127,127,0.12)", borderRadius: "4px", padding: "4px 8px", margin: "6px 0" }) },
						"正在编辑: " + (usingRecipe ? ("配方「" + edit.recipe + "」(provider 页同名条目)") : "default · 默认配置(provider 页 moa-native · default)")),
					/* §二十六 v27: subagent 门控(全局字段, 不随配方; 主会话不受影响) */
					React.createElement("div", { style: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", margin: "4px 0" } },
						React.createElement("span", { style: { flex: "0 0 auto" } }, "subagent 门控:"),
						React.createElement("select", { value: edit.subagentPolicy || "passthrough", onChange: (e) => upd({ subagentPolicy: e.target.value }), title: "子会话门控: passthrough=直转 aggregator 零扇出(默认)/每N次=每第 N 次 LLM 请求放一次完整 MoA(第 1 次必放, 其余各步照常直转 agg 跑)/full=同权全扇。子会话每步都会执行, 只是多数步不带 refs 扇出", style: Object.assign({}, inputStyle, { flex: "0 1 160px" }) },
							React.createElement("option", { value: "passthrough" }, "passthrough(直转agg)"),
							(!["passthrough", "full", "3", "5", "8", "10", "15", "20", "30"].includes(String(edit.subagentPolicy)) ? React.createElement("option", { value: String(edit.subagentPolicy) }, "每" + edit.subagentPolicy + "次(保留)") : null),
							[3, 5, 8, 10, 15, 20, 30].map((n) => React.createElement("option", { key: "sg" + n, value: String(n) }, "每" + n + "次扇一次")),
							React.createElement("option", { value: "full" }, "full(同权全扇)")),
						React.createElement("span", { style: hintStyle }, "子会话每步都跑(直转 agg); 每 N 步升级一次完整 MoA(第 1 步必扇)。主会话不受影响")),
					React.createElement("div", { style: { margin: "8px 0" } },
						React.createElement("div", { style: { display: "flex", gap: "6px", alignItems: "center", margin: "4px 0" } },
							React.createElement("span", null, "模式:"), React.createElement("select", { value: tgt.mode, onChange: (e) => setTgtRaw({ mode: e.target.value }), style: inputStyle },
								React.createElement("option", { value: "" }, "不绑定(兜底F)"), React.createElement("option", { value: "R" }, "R·裁剪视图"), React.createElement("option", { value: "F" }, "F·全量mirror"))),
						React.createElement("div", { style: hintStyle }, "refs(参考路, 每路=provider/模型/effort 三级下拉+注入模块下拉):"),
						tgt.refs.map((v, i) => refRow(v, i)),
						React.createElement("button", { onClick: () => setTgtRaw({ refs: tgt.refs.concat([{ model: "", injection: "", includeReasoning: false }]) }), style: inputStyle }, "+ ref 路"),
						React.createElement("div", { style: { display: "flex", gap: "4px", alignItems: "center", marginTop: "4px" } },
							React.createElement("span", { style: { flex: "0 0 auto" } }, "agg:"), React.createElement(TripleSelect, { val: tgt.aggregator, onCh: (nv) => setTgtRaw({ aggregator: nv }) })),
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
								React.createElement("option", { value: "user_turn" }, "user_turn"), React.createElement("option", { value: "per_iteration" }, "per_iteration"), Array.from({ length: 10 }, (_, i) => i + 1).map((n) => React.createElement("option", { key: "cad" + n, value: String(n) }, "跳" + n + "步")))),
							React.createElement("label", null, " settle_ms ", React.createElement("input", { value: tgt.settle_ms, placeholder: "2000", onChange: (e) => setTgtRaw({ settle_ms: e.target.value }), style: Object.assign({}, inputStyle, { width: "66px" }) })),
							React.createElement("label", null, " ref max_tokens ", React.createElement("input", { value: tgt.reference_max_tokens, placeholder: "(默认)", onChange: (e) => setTgtRaw({ reference_max_tokens: e.target.value }), style: Object.assign({}, inputStyle, { width: "76px" }) })),
							React.createElement("label", null, " ", React.createElement("input", { type: "checkbox", checked: tgt.debug, onChange: (e) => setTgtRaw({ debug: e.target.checked }) }), " debug")),
												React.createElement("div", { style: hintStyle }, "cadence=重算频率(user_turn 同轮一次最省/per_iteration 每步/跳N步=扇出后跳 N 步再扇, user 输入轮天然重置); settle_ms=打断后落袋宽限; max_tokens=参考路上限(thinking 模型留空); debug=详细日志。"),
						(() => {
							if (pv !== "agg") return null;
							const short = (m) => String(m || "").split("@")[0].split("/").pop();
							const refs = (tgt.refs || []).filter((x) => x && x.model);
							const names = refs.map((x) => short(x.model)).join(", ");
							const mech = (tgt.mode === "R") ? "[MoA 预运行参考] 以下来自 " + refs.length + " 路参考顾问(" + names + "), 相当于你本人的提前预演(基于会话文本视图), 未执行任何操作。把它们当作你自己的多份草稿来核对与超越。" : "[MoA 预运行参考] 以下来自 " + refs.length + " 路并行模型(" + names + "), 相当于你本人的提前预演(共享同一份完整会话状态)。它们均未执行任何操作——文中叙述的「已执行/结果」一律不是事实记录。把它们当作你自己的多份草稿来核对与超越。";
							const nm = tgt.aggInjection || "agg_default";
							let disc = "";
							if (nm === "agg_default") disc = (st && st.aggInjDefault) || "";
							else if (nm === "agg_forrefsblank") disc = (st && st.aggInjForRefsBlank) || "";
							else if (nm !== "agg_blank") disc = (edit.aggInjections || {})[nm] || "(自建模块不存在——运行时回落 agg_default)";
							const blocks = refs.map((x) => "[" + ((tgt.mode === "R") ? "reference · " : "reference·" + ((x.injection === "__blank__") ? "平行续写" : "评审意见") + ((x && x.includeReasoning) ? "+思考" : "") + " · ") + short(x.model) + "]" + ((x && x.includeReasoning) ? "\n▍思考过程(原文, 无截断)…" : "") + "\n" + "(该路输出正文…)").concat(["[reference: failed]" + "\n" + "(失败路示例, 脱敏后 120 字内)"]);
							const pvText = mech + (disc ? "\n\n" + disc : "") + "\n\n" + blocks.join("\n\n");
							return React.createElement("div", { onClick: () => setPv(null), style: { position: "fixed", inset: "0", background: "rgba(0,0,0,0.35)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" } },
								React.createElement("div", { onClick: (e) => e.stopPropagation(), style: { background: "var(--dsh-input-bg, #fff)", color: "inherit", border: "1px solid rgba(127,127,127,0.4)", borderRadius: "8px", maxWidth: "720px", width: "90%", maxHeight: "80vh", overflowY: "auto", padding: "14px 16px", fontSize: "12.5px" } },
									React.createElement("div", { style: { display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "4px" } },
										React.createElement("b", null, "guidance 组合预览(aggregator 视角)"),
										React.createElement("span", { style: { opacity: 0.6, fontSize: "11px" } }, "机制段自动 · 纪律段=agg 注入 · 示意预览(运行态含实时输出/降级口径/STALE)"),
										React.createElement("button", { onClick: () => setPv(null), style: { marginLeft: "auto" } }, "✕")),
									React.createElement("pre", { style: { whiteSpace: "pre-wrap", background: "rgba(127,127,127,0.12)", borderRadius: "6px", padding: "8px 10px", margin: "8px 0", fontSize: "12px", fontFamily: "inherit" } }, pvText),
									React.createElement("div", { style: { opacity: 0.8, fontSize: "11.5px" } },
										"时态: user_turn/every_n 复用且轮内已有工具活动时, guidance 首部另加 STALE 注记(产于下方工具结果之前, 行动前先核对); per_iteration 每步全新永无 STALE; header 本身永不含时态(v19 定稿)。",
										React.createElement("br"),
										"保留字: agg_default🔒=通用纪律 · agg_blank🔒=零纪律纯透明 frame · agg_forrefsblank🔒=refs 全 blank 平行预案纪律。")));
						})(),
					),
					/* 命名条目(像新添加模型) */
					React.createElement("details", { style: { margin: "8px 0" } },
						React.createElement("summary", { style: { fontSize: "12px", opacity: 0.8 } }, "▸ 命名条目(模型+effort→命名, 像新添加模型一样复用)"),
						Object.entries(edit.slots).map(([k, v], idx) => React.createElement("div", { key: "slot" + idx, style: { display: "flex", gap: "4px", marginBottom: "4px", alignItems: "center" } }, /* v25.1: key 去可变名(旧 k+idx 改名每键失焦) */
							React.createElement("input", { value: k, placeholder: "条目名", onChange: (e) => { const ns = {}; for (const [kk, vv] of Object.entries(edit.slots)) ns[kk === k ? e.target.value : kk] = vv; upd({ slots: ns }); }, style: Object.assign({}, inputStyle, { flex: "0 1 110px" }) }),
							React.createElement(ModelSelect, { val: v, onCh: (nv) => { const e2 = splitEffort(v)[1]; upd({ slots: Object.assign({}, edit.slots, { [k]: e2 ? nv + "@" + e2 : nv }) }); } }),
							React.createElement(EffortSelect, { mid: splitEffort(v)[0], val: splitEffort(v)[1], onCh: (ne) => { const b = splitEffort(v)[0]; upd({ slots: Object.assign({}, edit.slots, { [k]: ne ? b + "@" + ne : b }) }); } }),
							React.createElement("button", { onClick: () => { const ns = Object.assign({}, edit.slots); delete ns[k]; upd({ slots: ns }); }, style: inputStyle }, "✕"))),
						React.createElement("button", { onClick: () => { let n = 1; const t = Object.keys(edit.slots); while (t.includes("条目" + n)) n++; upd({ slots: Object.assign({}, edit.slots, { ["条目" + n]: "" }) }); }, style: inputStyle }, "+ 新条目"),
						React.createElement("div", { style: hintStyle }, "条目出现在模型下拉的「命名条目」组; 引用共享槽位名(glm-fast 等)仍可解析(兼容层)。"),
					),
					/* §十一 v15: 注入文本模块管理(默认🔒+空白🔒+自建) */
				React.createElement("details", { style: { margin: "8px 0" } },
					React.createElement("summary", { style: { fontSize: "12px", opacity: 0.8 } }, "▸ 注入文本模块(F 模式尾注; 默认🔒/空白🔒/自建)"),
					React.createElement("div", { style: Object.assign({}, hintStyle, { background: "rgba(127,127,127,0.12)", borderRadius: "4px", padding: "4px 8px", margin: "6px 0" }) },
						"每路 ref 的尾注=所选模块文本(完全替换不叠加); 空白=零尾注纯镜像; 内容自由(一句 persona 到整段领域文档)。一切注入可见可编辑, 无隐藏引导。"),
					React.createElement("div", { style: { margin: "6px 0" } },
						React.createElement("div", { style: { fontSize: "12px", opacity: 0.85, marginBottom: "2px" } }, "🔒 默认(类 Hermes 修订版·不可编辑不可删)"),
						React.createElement("textarea", { readOnly: true, value: st.injDefault || "", rows: 4, style: Object.assign({}, inputStyle, { width: "100%", opacity: 0.75, resize: "vertical", fontFamily: "inherit" }) }),
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
					React.createElement("textarea", { readOnly: true, value: st.aggInjDefault || "(host v20 未生效?)", rows: 3, style: Object.assign({}, inputStyle, { width: "100%", opacity: 0.75, resize: "vertical", fontFamily: "inherit" }) }),
					React.createElement("div", { style: { fontSize: "12px", opacity: 0.85, margin: "8px 0 2px" } }, "🔒 refs全blank 专用 agg_forrefsblank(平行预案纪律·不可编辑)"),
					React.createElement("textarea", { readOnly: true, value: st.aggInjForRefsBlank || "(host v20 未生效?)", rows: 3, style: Object.assign({}, inputStyle, { width: "100%", opacity: 0.75, resize: "vertical", fontFamily: "inherit" }) }),
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
			const dot = (s) => (s === "done" ? "✓" : s === "failed" ? "✗" : s === "running" ? "◐" : s === "aborted" ? "⊘" : "·"); /* v25.1: aborted 建模 */
			const dotColor = (s) => (s === "done" ? "var(--dsh-ok, #4c4)" : s === "failed" ? "var(--dsh-error, #c46)" : "inherit");
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
						React.createElement("span", null, "轮次 #" + (en.turnInSession != null ? en.turnInSession : en.seq) + " · " + fmtT(en.ts) + " · " + (en.mode || "?") + (en.recipe ? " · " + en.recipe : " · 直配") + (en.restored ? " · 回填" : "") + (en.archived ? " · 🗃" : ""))),
					React.createElement("div", { style: hintStyle }, (en.kind === "cache" ? "⟲ 缓存复用轮(原文在对应 ▶ 融合轮)" + (en.cached ? " · 第" + (en.cached.entryCount || 0) + "次" + (en.cached.stale ? " +STALE" : "") : "") : "refs 并行咨询 → 聚合输出; 点卡片看 advisory 全文")),
					(en.refs || []).map((r, i) => React.createElement("div", { key: "r" + i, style: { borderTop: "1px solid rgba(127,127,127,0.15)", padding: "6px 0" } },
						React.createElement("div", { onClick: () => setExpanded(Object.assign({}, expanded, { [view.key + "#r" + i]: !expanded[view.key + "#r" + i] })), style: { cursor: "pointer", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", fontSize: "12px" } },
							React.createElement("b", { style: { color: dotColor(r.status) } }, dot(r.status)), React.createElement("span", { fontWeight: 600 }, r.label || ("ref" + (i + 1))),
							r.injection && r.injection !== "__default__" ? React.createElement("span", { style: { opacity: 0.65 } }, "✎" + (r.injection === "__blank__" ? "零注入" : r.injection)) : null,
							React.createElement("span", { style: { opacity: 0.85 } }, (r.provider || "?") + "/" + (r.model || "?") + (r.effort ? "@" + r.effort : "")),
							React.createElement("span", { style: { opacity: 0.7 } }, r.status === "running" ? "…" : fmtMs(r.ms) + (r.chars ? " · " + r.chars + "字" : "") + (r.err ? " · " + r.err : "")),
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
						stats.refs.map((s) => React.createElement("div", { key: s.key, style: { opacity: 0.85 } }, s.key + " · " + s.calls + "次 · 均" + fmtMs(s.avgMs) + " · 均" + s.avgChars + "字" + (s.fails ? " · ✗" + s.fails : ""))),
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
				return (Date.now() - (e.ts || 0)) < 600000; /* v25.1 兜底: 超 10min 仍 running 视作失联降出快轮询(host finally 已补终态, 双保险) */
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
			const stIcon = (s) => (s === "done" ? "✓" : s === "failed" ? "✗" : s === "running" ? "⭕" : s === "aborted" ? "⊘" : "·"); /* v25.1: aborted 建模 */
			const stColor = (s) => (s === "done" ? "var(--dsh-success, #4a9)" : s === "failed" ? "var(--dsh-error, #c46)" : "inherit");
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
					React.createElement("span", { style: dim }, "第" + ((snap.cached && snap.cached.entryCount) || 0) + "次" + (snap.cached && snap.cached.stale ? " +STALE" : "") + " — 本轮 refs 意见直接再注入(cadence 省算), 明细在轨迹面板"),
					xBtn);
			}
			const aggRunning = snap.agg && snap.agg.s === "running";
			const totalMs = running ? Date.now() - snap.ts : null;
			return React.createElement("div", { style: bar },
				React.createElement("span", { style: { fontWeight: "bold" } }, (running ? "⏳ " : (snap.status === "failed" ? "✗ " : snap.status === "aborted" ? "⊘ " : "✓ ")) + "MoA · " + snap.mode + (snap.recipe ? "·" + snap.recipe : "")),
				React.createElement("span", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
					"REF:",
					(snap.refs || []).map((r, i) => React.createElement("span", { key: "r" + i },
						React.createElement("b", { style: { color: stColor(r.s) } }, stIcon(r.s)), " " + r.n + (r.s === "running" ? " " + fmtMs(r.ms) : (r.ms ? " " + fmtMs(r.ms) : "") + (r.c ? "·" + r.c + "字" : ""))))),
				snap.agg ? React.createElement("span", null,
					React.createElement("b", { style: { color: stColor(snap.agg.s) } }, stIcon(snap.agg.s)), " AGG: " + snap.agg.m + " " + (snap.agg.s === "running" ? "流式中 " + fmtMs(snap.agg.ms) : (aggRunning ? "" : fmtMs(snap.agg.ms) + (snap.agg.c ? "·" + snap.agg.c + "字" : "")))) : null,
				!snap.agg && running ? React.createElement("span", { style: dim }, "AGG: 等待 refs") : null,
				totalMs != null ? React.createElement("span", { style: dim }, "(" + fmtMs(totalMs) + ")") : null,
				!running && snap.status === "done" ? React.createElement("span", { style: dim }, "融合完成") : null,
				!running && snap.status === "aborted" ? React.createElement("span", { style: dim }, "已取消(上游中断)") : null,
				!running && snap.status === "failed" ? React.createElement("span", { style: dim }, (((snap.refs || []).length && !(snap.refs || []).some((r) => r.s === "done")) ? "失败——refs 全败, 已降级直转 agg" : "失败——agg 流中断/异常")) : null, /* v25.1: failed 文案按来源分支(旧固定写 refs 全败, agg 失败被误导) */
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
