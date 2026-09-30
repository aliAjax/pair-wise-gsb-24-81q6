import assert from "node:assert";
import { createInitialState } from "../src/data";
import { computeStats, deriveUnit, elevDiff } from "../src/model";

// 直接复刻 store 的 reducer 入口（store.tsx 带 React 依赖，这里用 esbuild 已打包进来）
import { reducer } from "../src/store";

let s = createInitialState();

// --- 初始：LK-2 超差待复核，F2 watch，H12 danger（OB-2 归错层） ---
assert.equal(s.links.find((l) => l.id === "LK-2")!.status, "pending");
let stats0 = computeStats(s);
assert.equal(stats0.linkPending, 1);
assert.equal(deriveUnit(s, s.units.find((u) => u.id === "U-H12")!).level, "danger");
assert.equal(deriveUnit(s, s.units.find((u) => u.id === "U-F2")!).level, "watch");

// 现场不能更新接界
s = reducer(s, { type: "ROLE", role: "field" });
s = reducer(s, { type: "RESOLVE_LINK", linkId: "LK-2", elevA: 101.26, elevB: 101.26, note: "x" });
assert.equal(s.links.find((l) => l.id === "LK-2")!.status, "pending");

// 复核员先更正 OB-2 归层（原记录保留，单位不拆）
s = reducer(s, { type: "ROLE", role: "reviewer" });
s = reducer(s, { type: "CORRECT_LAYER", obsId: "OB-2", layerId: "T0204:L3" });
const ob2 = s.observations.find((o) => o.id === "OB-2")!;
assert.equal(ob2.layerRaw, "②层"); // 原观察还在
assert.equal(ob2.correctedLayerId, "T0204:L3");
assert.equal(deriveUnit(s, s.units.find((u) => u.id === "U-H12")!).level, "ok");
assert.equal(s.units.find((u) => u.id === "U-H12")!.observationIds.length, 2); // 没拆单位

// 复核员收敛 LK-2
s = reducer(s, { type: "RESOLVE_LINK", linkId: "LK-2", elevA: 101.27, elevB: 101.26, note: "南接界自然坡降" });
assert.ok(elevDiff(s.links.find((l) => l.id === "LK-2")!) <= 0.02);
assert.equal(s.links.find((l) => l.id === "LK-2")!.status, "reviewed");
assert.equal(deriveUnit(s, s.units.find((u) => u.id === "U-F2")!).level, "ok");
assert.equal(computeStats(s).linkPending, 0);

// 仍超差则保持 pending
s = reducer(s, { type: "RESOLVE_LINK", linkId: "LK-1", elevA: 101.34, elevB: 101.0, note: "y" });
assert.equal(s.links.find((l) => l.id === "LK-1")!.status, "pending");
s = reducer(s, { type: "RESOLVE_LINK", linkId: "LK-1", elevA: 101.34, elevB: 101.33, note: "恢复" });

// 确认层：现场只能提修订，不能直接改
s = reducer(s, { type: "ROLE", role: "field" });
const before = s.strata.find((x) => x.id === "T0203:L2")!.bottomElev;
s = reducer(s, { type: "PROPOSE_REVISION", stratumId: "T0203:L2", field: "bottomElev", proposedValue: 101.3, note: "剖面复测" });
assert.equal(s.strata.find((x) => x.id === "T0203:L2")!.bottomElev, before);
const rv = s.revisions[0];
assert.equal(rv.status, "proposed");
// 复核员不能裁定
s = reducer(s, { type: "ROLE", role: "reviewer" });
s = reducer(s, { type: "DECIDE_REVISION", revisionId: rv.id, adopt: true });
assert.equal(s.revisions.find((x) => x.id === rv.id)!.status, "proposed");
// 领队采纳后生效
s = reducer(s, { type: "ROLE", role: "director" });
s = reducer(s, { type: "DECIDE_REVISION", revisionId: rv.id, adopt: true });
assert.equal(s.strata.find((x) => x.id === "T0203:L2")!.bottomElev, 101.3);
assert.equal(s.revisions.find((x) => x.id === rv.id)!.status, "adopted");

// 断网：暂存 -> 失败批次保留 -> 重试合并 -> 重复上传幂等
s = reducer(s, { type: "ROLE", role: "field" });
s = reducer(s, { type: "TOGGLE_NET", trenchId: "T0301" });
s = reducer(s, { type: "ADD_OFFLINE_POINT", trenchId: "T0301", unitId: "U-F2", layerRaw: "3层", coord: "E2 S1", note: "断网补柱洞", artifacts: "陶片1" });
s = reducer(s, { type: "ADD_OFFLINE_POINT", trenchId: "T0301", unitId: "U-F2", layerRaw: "3层", coord: "E2 S2", note: "断网补面", artifacts: "" });
assert.equal(s.pending.T0301.length, 2);
// 断网不能传
s = reducer(s, { type: "SYNC_TRENCH", trenchId: "T0301", forceFail: false });
assert.equal(s.batches.length, 0);
// 回网但首批强制失败：观察点不并入
s = reducer(s, { type: "TOGGLE_NET", trenchId: "T0301" });
const obsCountBefore = s.observations.length;
s = reducer(s, { type: "SYNC_TRENCH", trenchId: "T0301", forceFail: true });
assert.equal(s.batches[0].status, "failed");
assert.equal(s.observations.length, obsCountBefore);
assert.equal(s.pending.T0301.length, 2);
// 单独重试 -> 合并进同一单位
const bid = s.batches[0].id;
s = reducer(s, { type: "RETRY_BATCH", batchId: bid });
assert.equal(s.batches.find((b) => b.id === bid)!.status, "synced");
assert.equal(s.observations.length, obsCountBefore + 2);
assert.equal(s.pending.T0301.length, 0);
const f2 = s.units.find((u) => u.id === "U-F2")!;
assert.equal(f2.observationIds.length, 4);
assert.ok(s.observations.filter((o) => o.unitId === "U-F2").every((o) => f2.observationIds.includes(o.id)));
assert.ok(s.observations.slice(-2).every((o) => o.source === "synced"));
// 重复上传只算一次
s = reducer(s, { type: "REPLAY_DUPLICATE", batchId: bid });
assert.equal(s.observations.length, obsCountBefore + 2);

// 新观察点合并后仍参与单位校核（F2 此时 ok，LK-2 已 reviewed）
assert.equal(deriveUnit(s, f2).level, "ok");

console.log("ALL REDUCER TESTS PASSED");
