// §11 一键验收(重启成功后跑): node scripts/verify-v13.mjs [基地址]
// 2026-10-28 改形态断言: 原版写死 v13 回填快照(entries=3/特定会话id/全restored), 数据增长后必过期;
// 现断言结构与不变量(字段在位/过滤语义/聚合非空), 对任意轮次的实例恒成立。
const BASE = process.argv[2] || "http://127.0.0.1:3080";
let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS" : "FAIL") + " " + m); if (!c) fails++; };
const j = async (u) => { const r = await fetch(BASE + u, { cache: "no-store" }); return r.json(); };

const all = await j("/moa-native/trace.json?limit=60");
ok(all.ok === true, "trace.json ok");
const es = all.entries || [];
ok(Array.isArray(es) && es.length >= 1, "entries ≥ 1(实际 " + es.length + ")");
ok(es.every((e) => e.restored === undefined || typeof e.restored === "boolean"), "restored 字段可选(实时条目无此键, 回填条目为布尔)");
ok(es.every((e) => Number.isInteger(e.turnInSession) && e.turnInSession >= 1), "turnInSession 会话化(每条 ≥ 1)" + (es[0] ? "—— 示例 " + (es[0].sessionId || "").slice(8, 16) + ":" + es[0].turnInSession : ""));
ok(Number.isInteger(all.totalTurns) && all.totalTurns >= es.length, "totalTurns ≥ entries(实际 " + all.totalTurns + ")");
ok(Array.isArray(all.sessions) && all.sessions.length >= 1, "sessions 聚合 ≥ 1(实际 " + (all.sessions || []).length + ")");
ok((all.sessions || []).every((s) => typeof s.ws === "string" && s.ws.length > 0), "sessions[].ws 非空字符串");
ok(Array.isArray(all.stats && all.stats.refs) && all.stats.refs.length >= 1, "stats.refs 聚合(" + ((all.stats && all.stats.refs) || []).length + " 路)");
ok(Array.isArray(all.workspaces) && all.workspaces.length >= 1, "workspaces 非空");

const WS = "--D-my-workspace--";
if (Array.isArray(all.workspaces) && all.workspaces.includes(WS)) {
	const hit = await j("/moa-native/trace.json?ws=" + encodeURIComponent(WS));
	ok(hit.ok === true && (hit.entries || []).length >= 1, "ws 过滤命中 ≥ 1(实际 " + (hit.entries || []).length + ")");
} else {
	ok(true, "ws 过滤跳过(当前实例无 my-workspace 轨迹)");
}
const miss = await j("/moa-native/trace.json?ws=" + encodeURIComponent("--NOT-EXIST--"));
ok(miss.ok === true && (miss.entries || []).length === 0, "ws=不存在→空集(实际 " + (miss.entries || []).length + ")");

console.log(fails === 0 ? "VERIFY ALL PASS" : fails + " FAILURES");
await new Promise((r) => setTimeout(r, 150)); /* Windows libuv 优雅退出: 等 keep-alive socket 排空再 exit, 防 UV_HANDLE_CLOSING 断言 */
process.exit(fails === 0 ? 0 : 1);
