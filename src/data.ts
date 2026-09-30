import type { AppState } from "./model";

const now = "2026-09-30 09:00";

// 演示初始档案：3 个相邻探方，接界处地层各编各号、高程部分对不上。
export function createInitialState(): AppState {
  return {
    role: "reviewer",
    online: { T0203: true, T0204: true, T0301: true },
    trenches: [
      { id: "T0203", name: "T0203 探方" },
      { id: "T0204", name: "T0204 探方（东邻）" },
      { id: "T0301", name: "T0301 探方（南邻）" },
    ],
    strata: [
      { id: "T0203:L1", trenchId: "T0203", code: "第1层", soil: "耕土 灰黄", topElev: 102.35, bottomElev: 101.92, confirmed: true },
      { id: "T0203:L2", trenchId: "T0203", code: "第2层", soil: "黄褐土", topElev: 101.92, bottomElev: 101.34, confirmed: true },
      { id: "T0203:L3", trenchId: "T0203", code: "第3层", soil: "灰褐土", topElev: 101.34, bottomElev: 100.71, confirmed: false },
      { id: "T0204:L1", trenchId: "T0204", code: "①层", soil: "表土", topElev: 102.31, bottomElev: 101.9, confirmed: true },
      { id: "T0204:L2", trenchId: "T0204", code: "②层", soil: "褐黄土", topElev: 101.9, bottomElev: 101.31, confirmed: false },
      { id: "T0204:L3", trenchId: "T0204", code: "③层", soil: "灰褐淤土", topElev: 101.31, bottomElev: 100.6, confirmed: false },
      { id: "T0301:2", trenchId: "T0301", code: "2层", soil: "扰土", topElev: 102.4, bottomElev: 101.88, confirmed: true },
      { id: "T0301:3", trenchId: "T0301", code: "3层", soil: "灰褐花土", topElev: 101.88, bottomElev: 101.26, confirmed: false },
    ],
    links: [
      {
        id: "LK-1",
        edge: "T0203／T0204 东接界",
        trenchA: "T0203",
        stratumA: "T0203:L3",
        elevA: 101.34,
        trenchB: "T0204",
        stratumB: "T0204:L3",
        elevB: 101.33,
        status: "normal",
      },
      {
        id: "LK-2",
        edge: "T0203／T0301 南接界",
        trenchA: "T0203",
        stratumA: "T0203:L3",
        elevA: 101.34,
        trenchB: "T0301",
        stratumB: "T0301:3",
        elevB: 101.26,
        status: "pending", // 差 8cm，超 2cm
      },
    ],
    units: [
      {
        id: "U-H12",
        code: "H12",
        kind: "灰坑",
        summary: "黑褐土，夹炭屑，见动物骨；跨 T0203／T0204 东接界，一个单位两观察点。",
        observationIds: ["OB-1", "OB-2"],
      },
      {
        id: "U-F2",
        code: "F2",
        kind: "房址",
        summary: "夯土面，柱洞关系需复核；跨 T0203／T0301 南接界。",
        observationIds: ["OB-3", "OB-4"],
      },
    ],
    observations: [
      {
        id: "OB-1",
        unitId: "U-H12",
        trenchId: "T0203",
        layerId: "T0203:L3",
        layerRaw: "第3层",
        coord: "E3 N4",
        note: "坑口与第3层底界持平，陶片集中",
        artifacts: "陶片 12 件",
        source: "online",
      },
      {
        id: "OB-2",
        unitId: "U-H12",
        trenchId: "T0204",
        layerId: "T0204:L2",
        layerRaw: "②层",
        coord: "E0+1.2 N4",
        note: "接界东侧现场记为②层，疑似归错层",
        artifacts: "兽骨 2 件",
        source: "online",
      },
      {
        id: "OB-3",
        unitId: "U-F2",
        trenchId: "T0203",
        layerId: "T0203:L3",
        layerRaw: "第3层",
        coord: "E3 N0+0.8",
        note: "夯土面被南接界切开",
        artifacts: "夯土块（留档）",
        source: "online",
      },
      {
        id: "OB-4",
        unitId: "U-F2",
        trenchId: "T0301",
        layerId: "T0301:3",
        layerRaw: "3层",
        coord: "E3 S1",
        note: "柱洞 3 个，开口高程待统一",
        artifacts: "",
        source: "online",
      },
    ],
    revisions: [],
    pending: {},
    batches: [],
    logs: [
      { id: "LOG-0", at: now, text: "档案载入：LK-2 南接界高程差 0.08m 已进入待复核；H12 在 T0204 侧归层存疑。", tone: "warn" },
    ],
    seq: 100,
  };
}
