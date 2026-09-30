// 跨探方关系校核台 · 领域模型
// 每个探方保留自己的地层编号与顶底高程；跨探方的关联只通过"接界关联"与"观察点"表达。

export type Role = "field" | "reviewer" | "director";

export type LinkStatus = "normal" | "pending" | "reviewed";
export type UnitLevel = "ok" | "watch" | "danger";
export type RevisionStatus = "proposed" | "adopted" | "rejected";
export type BatchStatus = "queued" | "synced" | "failed";

export interface Stratum {
  id: string; // 探方内部编号，如 T0203:L3
  trenchId: string;
  code: string; // 该探方自己的地层编号：第3层
  soil: string; // 土色土质
  topElev: number; // 顶界高程 m
  bottomElev: number; // 底界高程 m
  confirmed: boolean; // 领队是否已确认（确认后不可直接改，只能走修订）
}

export interface BoundaryLink {
  id: string;
  edge: string; // 接界线名称
  trenchA: string;
  stratumA: string; // A 探方在接界处的地层 id
  elevA: number; // A 侧接界线高程
  trenchB: string;
  stratumB: string;
  elevB: number;
  status: LinkStatus;
  resolvedNote?: string; // 复核员更新边界后的留痕
  resolvedBy?: Role;
  resolvedAt?: string;
}

export interface Observation {
  id: string; // 观察点 id（同一观察点重复上传时幂等键）
  unitId: string; // 所属遗迹单位（跨接界也只有一个单位 id）
  trenchId: string; // 观察点所在探方
  layerId: string; // 归层（原始记录，保留不动）
  layerRaw: string; // 现场原始填写
  coord: string;
  note: string;
  artifacts: string; // 出土物归属，复核只追加，不覆盖
  correctedLayerId?: string; // 复核后的有效归层
  correctedAt?: string;
  source: "online" | "synced";
  clientId?: string; // 回网合并前的离线键，重复上传据此去重
}

export interface FeatureUnit {
  id: string;
  code: string; // H12 灰坑 / F2 房址 …
  kind: string;
  summary: string;
  observationIds: string[]; // 两个探方各留观察点，但同属一个单位
}

export interface Revision {
  id: string;
  stratumId: string;
  trenchId: string;
  field: "topElev" | "bottomElev";
  currentValue: number;
  proposedValue: number;
  note: string; // 现场补观察说明
  status: RevisionStatus;
  createdAt: string;
  decidedAt?: string;
}

export interface PendingPoint {
  clientId: string; // 观察点幂等键
  unitId: string;
  layerRaw: string;
  coord: string;
  note: string;
  artifacts: string;
}

export interface SyncBatch {
  id: string;
  trenchId: string;
  status: BatchStatus;
  createdAt: string;
  syncedAt?: string;
  failNext: boolean; // 演示用：标记下一批同步强制失败
  pointClientIds: string[];
  error?: string;
}

export interface LogEntry {
  id: string;
  at: string;
  text: string;
  tone: "info" | "ok" | "warn" | "danger";
}

export interface AppState {
  role: Role;
  online: Record<string, boolean>;
  trenches: { id: string; name: string }[];
  strata: Stratum[];
  links: BoundaryLink[];
  observations: Observation[];
  units: FeatureUnit[];
  revisions: Revision[];
  pending: Record<string, PendingPoint[]>; // 断网期间按探方暂存
  batches: SyncBatch[];
  logs: LogEntry[];
  seq: number;
}

export const ELEV_TOLERANCE_M = 0.02;

export const ROLE_LABEL: Record<Role, string> = {
  field: "发掘队员",
  reviewer: "复核员",
  director: "领队",
};

export function elevDiff(link: BoundaryLink): number {
  return Math.abs(link.elevA - link.elevB);
}

/** 高程差超过 2 厘米即待复核；复核员处理过的保留 reviewed 状态 */
export function linkStatusOf(elevA: number, elevB: number, current?: LinkStatus): LinkStatus {
  if (current === "reviewed") return "reviewed";
  return Math.abs(elevA - elevB) > ELEV_TOLERANCE_M + 1e-9 ? "pending" : "normal";
}

export function linkLabel(state: AppState, link: BoundaryLink): string {
  const sA = state.strata.find((s) => s.id === link.stratumA);
  const sB = state.strata.find((s) => s.id === link.stratumB);
  return `${link.trenchA} ${sA?.code ?? "?"} ↔ ${link.trenchB} ${sB?.code ?? "?"}`;
}

/** 观察点有效归层：复核更新优先，否则用原始层 */
export function effectiveLayerId(obs: Observation): string {
  return obs.correctedLayerId ?? obs.layerId;
}

export interface UnitDerivation {
  unit: FeatureUnit;
  level: UnitLevel;
  crossTrench: boolean;
  trenches: string[];
  issues: string[];
  checked: number;
  total: number;
}

/** 跨探方遗迹单位状态：归层被归错=红，相关接界待复核=黄，全部对齐=绿 */
export function deriveUnit(state: AppState, unit: FeatureUnit): UnitDerivation {
  const obsList = unit.observationIds
    .map((id) => state.observations.find((o) => o.id === id))
    .filter((o): o is Observation => Boolean(o));
  const trenches = [...new Set(obsList.map((o) => o.trenchId))];
  const crossTrench = trenches.length > 1;
  const issues: string[] = [];
  let checked = 0;

  for (const obs of obsList) {
    const layerId = effectiveLayerId(obs);

    if (!crossTrench) {
      // 单探方单位不涉及接界，观察点直接计入已校核
      checked += 1;
      continue;
    }

    // 该观察点所在接界：接界两侧探方都须在本单位的观察点范围内，
    // 且本侧关联地层必须与观察点有效归层一致。
    const link = state.links.find((l) => {
      const sideA = l.trenchA === obs.trenchId && l.stratumA === layerId;
      const sideB = l.trenchB === obs.trenchId && l.stratumB === layerId;
      if (!sideA && !sideB) return false;
      const otherTrench = sideA ? l.trenchB : l.trenchA;
      return trenches.includes(otherTrench);
    });

    if (link) {
      if (link.status === "pending") {
        issues.push(`${obs.trenchId} 观察点 ${obs.id}：接界 ${link.edge} 高程差 ${elevDiff(link).toFixed(2)}m 待复核`);
      } else {
        checked += 1;
      }
    } else {
      issues.push(`${obs.trenchId} 观察点 ${obs.id} 归入 ${layerId.split(":")[1]}，与任一接界关联地层不一致，疑似归错层`);
    }
  }

  const level: UnitLevel = issues.some((t) => t.includes("归错层")) ? "danger" : issues.length > 0 ? "watch" : "ok";

  return { unit, level, crossTrench, trenches, issues, checked, total: obsList.length };
}

export interface Stats {
  trenchCount: number;
  stratumCount: number;
  confirmedCount: number;
  linkPending: number;
  unitDanger: number;
  unitWatch: number;
  unitOk: number;
  revisionPending: number;
  queuedBatches: number;
  failedBatches: number;
  pendingPoints: number;
  artifactCount: number;
}

export function computeStats(state: AppState): Stats {
  const derivations = state.units.map((u) => deriveUnit(state, u));
  return {
    trenchCount: state.trenches.length,
    stratumCount: state.strata.length,
    confirmedCount: state.strata.filter((s) => s.confirmed).length,
    linkPending: state.links.filter((l) => l.status === "pending").length,
    unitDanger: derivations.filter((d) => d.level === "danger").length,
    unitWatch: derivations.filter((d) => d.level === "watch").length,
    unitOk: derivations.filter((d) => d.level === "ok").length,
    revisionPending: state.revisions.filter((r) => r.status === "proposed").length,
    queuedBatches: state.batches.filter((b) => b.status === "queued").length,
    failedBatches: state.batches.filter((b) => b.status === "failed").length,
    pendingPoints: Object.values(state.pending).reduce((n, list) => n + list.length, 0),
    artifactCount: state.observations.filter((o) => o.artifacts.trim().length > 0).length,
  };
}
