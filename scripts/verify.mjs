// §11 v13/v14 一键验收(重启成功后跑): node scripts/verify-v13.mjs
// 断言: 回填3轮/turnInSession/totalTurns/sessions聚合/ws过滤/回填日志
const BASE = process.argv[2] || "http://127.0.0.1:3080"; /* 可选参数: 实例基地址 */
let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS" : "FAIL") + " " + m); if (!c) fails++; };
const j = async (u) => { const r = await fetch(BASE + u, { cache: "no-store" }); return r.json(); };

const all = await j("/moa-native/trace.json?limit=60");
ok(all.ok === true, "trace.json ok");
const es = all.entries || [];
ok(es.length === 3, "entries=3(实际 " + es.length + ")");
ok(es.every((e) => e.restored === true), "全部 restored:true");
const seq = es.map((e) => (e.sessionId || "").slice(8, 16) + ":" + e.turnInSession).join(" ");
ok(/c9cc7f7f:2|c9cc7f7f:1/.test(seq) && /9f2d6dfd:1/.test(seq), "turnInSession 会话化(9f2d6dfd:1 / c9cc7f7f:1,2)—— " + seq);
ok(all.totalTurns === 3, "totalTurns=3(实际 " + all.totalTurns + ")");
ok(Array.isArray(all.sessions) && all.sessions.length === 2, "sessions 聚合=2 会话(实际 " + (all.sessions || []).length + ")");
ok((all.sessions || []).every((s) => s.ws === "--D-my-workspace--"), "sessions[].ws=D-my-workspace");
ok(Array.isArray(all.stats && all.stats.refs) && all.stats.refs.length >= 1, "stats.refs 聚合(" + ((all.stats && all.stats.refs) || []).length + " 路)");
ok(Array.isArray(all.workspaces) && all.workspaces.includes("--D-my-workspace--"), "workspaces 含 my-workspace");

const hit = await j("/moa-native/trace.json?ws=" + encodeURIComponent("--D-my-workspace--"));
ok(hit.ok && (hit.entries || []).length === 3, "ws=my-workspace 过滤→3 轮(实际 " + (hit.entries || []).length + ")");
const miss = await j("/moa-native/trace.json?ws=" + encodeURIComponent("--NOT-EXIST--"));
ok(miss.ok && (miss.entries || []).length === 0, "ws=不存在→空集(实际 " + (miss.entries || []).length + ")");

console.log(fails === 0 ? "VERIFY ALL PASS" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
