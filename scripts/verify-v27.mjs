#!/usr/bin/env node
// verify-v27.mjs — §二十六 v27 两特性断言: subagent 门控 + 预运行框架
// 用法: node scripts/verify-v27.mjs   (纯逻辑复演+源码断言, 不依赖 DSH 重启)
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const host = readFileSync(join(root, "host.mjs"), "utf8");
const client = readFileSync(join(root, "client.mjs"), "utf8");
let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS" : "FAIL") + " " + m); if (!c) fails++; };

/* ── 1. subagent_policy 解析逻辑复演(与 host loadConfig 同构) ── */
const parsePolicy = (j) => {
	const warnings = [];
	let p = { mode: "passthrough" };
	if (j.subagent_policy === "passthrough" || j.subagent_policy === "full") p = { mode: j.subagent_policy };
	else if (j.subagent_policy && typeof j.subagent_policy === "object" && Number.isFinite(j.subagent_policy.every_n)) p = { mode: "every_n", n: Math.min(50, Math.max(1, Math.floor(j.subagent_policy.every_n))) };
	else if (j.subagent_policy !== undefined) warnings.push("bad");
	return { p, warnings };
};
{
	const r1 = parsePolicy({}); ok(r1.p.mode === "passthrough" && r1.warnings.length === 0, "缺省=passthrough 无警告");
	const r2 = parsePolicy({ subagent_policy: "full" }); ok(r2.p.mode === "full", "full 直收");
	const r3 = parsePolicy({ subagent_policy: { every_n: 5 } }); ok(r3.p.mode === "every_n" && r3.p.n === 5, "every_n:5 → {mode:every_n,n:5}");
	const r4 = parsePolicy({ subagent_policy: { every_n: 999 } }); ok(r4.p.n === 50, "every_n:999 钳到 50");
	const r5 = parsePolicy({ subagent_policy: { every_n: 0 } }); ok(r5.p.n === 1, "every_n:0 钳到 1");
	const r6 = parsePolicy({ subagent_policy: "bogus" }); ok(r6.p.mode === "passthrough" && r6.warnings.length === 1, "非法值=passthrough+警告");
}

/* ── 2. 门控计数语义复演((n-1)%N===0 → 放行完整 MoA) ── */
{
	const gate = (n, N) => (n - 1) % N === 0;
	const seq5 = [1, 2, 3, 4, 5, 6].map((n) => gate(n, 5));
	ok(JSON.stringify(seq5) === JSON.stringify([true, false, false, false, false, true]), "every_n=5: 第1/6次放行, 2-5 直转");
	const seq1 = [1, 2, 3].map((n) => gate(n, 1));
	ok(seq1.every(Boolean), "every_n=1: 每次都放行(等效 full)");
}

/* ── 3. host 源码断言(门控/识别/预运行落点) ── */
ok(host.includes("function sessionOriginOf"), "sessionOriginOf 识别函数在位");
ok(host.includes('h.origin === "subagent"') && host.includes("delegationDepth > 0"), "识别判据=origin+delegationDepth 双通道");
ok(host.includes("subagentGateCounts"), "every_n 计数表在位");
ok(host.includes('"passthrough"'), "passthrough 通道在位");
ok(host.includes("pol.mode === \"full\"") || host.includes("pol.mode === 'full'") || /pol\.mode === "full"/.test(host), "full 旧形态保留");
ok(host.includes("options.purpose) return true"), "purpose 辅助调用不消耗计数(先判)");
ok(host.includes("[MoA 预运行参考]"), "机制段改预运行框架");
ok(host.includes("把它们当作你自己的多份草稿来核对与超越"), "草稿核对句在位");
ok(!host.includes("[MoA 参考输入]") && !host.includes("[MoA 参考意见] 以下来自"), "旧机制段措辞已退役");
ok(host.includes("唯一执行者"), "唯一执行者声明在位");

/* ── 4. client 序列化往返断言 ── */
ok(client.includes("subagentPolicy"), "面板状态字段在位");
ok(client.includes('edit.subagentPolicy === "full" ? "full"'), "full 序列化");
ok(client.includes("{ every_n: Math.max(1, Math.min(50, parseInt"), "every_n 序列化(1-50 钳制)");
ok(client.includes("passthrough(直转agg)"), "下拉选项文案");
ok(client.includes("[3, 5, 8, 10, 15, 20, 30]"), "下拉七档(含 15/20/30 扩档)");
ok(client.includes('value: "full"'), "full 选项本体在位(防扩档重写漏项)");
ok(!/subagent_policy: "passthrough"/.test(client), "passthrough 序列化为省略(最小 diff)");

/* ── 5. 发布管线锚点自检(export v2 对 host 的两个剥离锚仍可命中) ── */
const UL_DEF = /\/\* ── W1\.5 用量归流[\s\S]*?const ulRun = \(info, fn\) => \{[\s\S]*?\};\n/;
const UL_CALL = /await ulRun\(\{ sid: options\.sessionId \|\| null, note: "moa-native\/refs" \}, \(\) => (.+)\);/;
const ABS_DYN = /await import\("file:\/\/\/C:\/[^"]*dsh-typert-protocol\/lib\/index\.js"\)/;
ok(UL_DEF.test(host) && UL_CALL.test(host), "W1.5 剥离锚点可命中(导出脚本可用)");
ok(ABS_DYN.test(host), "动态 import 锚点可命中(导出脚本可用)");

console.log(fails === 0 ? "V27 ALL PASS (" + 0 + " failures)" : fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);
