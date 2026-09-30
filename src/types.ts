// 跨探方关系校核台：领域模型

export type Role = "field" | "reviewer" | "leader";

/** 探方 */
export interface Square {
  id: string; // T0203
  label: string; // 方位说明，如 "中部探方"
  online: boolean; // 当前是否联网（断网时观察先落本机批次）
}

/** 地层（每个探方保留自己的本地编号与顶底高程） */
export interface Stratum {
  id: string;
  squareId: string;
  code: string; // 本探方内部编号，如 "第3层" / "③层"
  top: number; // 顶高程 m
  bottom: number; // 底高程 m
  soil: string; // 土色土质
  confirmed: boolean; // 领队是否已确认；确认后锁定，只能补观察 / 提修订
  history: StratumSnapshot[]; // 历次高程变更（原值保留）
}

export interface StratumSnapshot {
  top: number;
  bottom: number;
  note: string;
  at: string;
  by: Role;
}

/** 现场对地层补的观察（锁定地层也允许追加） */
export interface StratumNote {
  id: string;
  stratumId: string;
  text: string;
  at: string;
  by: Role;
  revisionId?: string; // 若该观察触发了新修订
}

/** 修订提案（领队确认前不得改动原地层） */
export interface Revision {
  id: string;
  stratumId: string;
  reason: string;
  fromTop: number;
  fromBottom: number;
  toTop: number;
  toBottom: number;
  status: "pending" | "approved" | "rejected";
  at: string;
  by: Role;
  decidedAt?: string;
}

/** 探方接界（两个相邻探方共用的界壁） */
export interface Boundary {
  id: string;
  aSquareId: string;
  bSquareId: string;
  label: string;
}

/** 接界关联：把两侧探方各自编号的地层对上号，并记录接界线两侧高程 */
export interface BoundaryLink {
  id: string;
  boundaryId: string;
  aStratumId: string;
  bStratumId: string;
  elevA: number; // 接界线处 A 侧高程 m
  elevB: number; // 接界线处 B 侧高程 m
  updates: BoundaryUpdate[]; // 复核员更新边界的留痕（原观测保留）
}

export interface BoundaryUpdate {
  elevA: number;
  elevB: number;
  at: string;
  by: Role;
}

/** 出土物（归属于具体观察点，不随归层修正移动） */
export interface Find {
  id: string;
  name: string;
  qty: number;
  unit: string;
}

/** 归层修正：原观察保留，只追加修正记录 */
export interface LayerCorrection {
  id: string;
  fromStratumId: string;
  toStratumId: string;
  at: string;
  by: Role;
}

/** 遗迹单位的观察点：跨接界单位在两个探方各留一点，但单位只有一个 */
export interface ObservationPoint {
  id: string;
  unitId: string;
  squareId: string;
  stratumId: string; // 当前归层
  text: string;
  observer: string;
  at: string;
  finds: Find[];
  corrections: LayerCorrection[];
}

/** 遗迹单位（全局唯一，不因子项在不同探方而拆成两个单位） */
export interface FeatureUnit {
  id: string;
  kind: string; // 灰坑 / 墓葬 / 房址 / 沟状遗迹
  name: string;
  pointIds: string[];
}

export type BatchStatus = "draft" | "queued" | "failed" | "synced";

/** 断网期间按批暂存的观察点，回网后逐批同步、按观察点去重合并 */
export interface SyncBatch {
  id: string;
  clientBatchNo: string;
  squareId: string;
  status: BatchStatus;
  willFail: boolean; // 演示用：模拟本批回传失败
  error?: string;
  points: ObservationPoint[];
  syncedAt?: string;
}

export interface LogEntry {
  id: string;
  text: string;
  at: string;
  tone: "info" | "ok" | "warn" | "danger";
}

export interface State {
  role: Role;
  seq: number;
  squares: Square[];
  strata: Stratum[];
  notes: StratumNote[];
  revisions: Revision[];
  boundaries: Boundary[];
  links: BoundaryLink[];
  units: FeatureUnit[];
  points: Record<string, ObservationPoint>;
  batches: SyncBatch[];
  log: LogEntry[];
}

export type Action =
  | { type: "setRole"; role: Role }
  | { type: "toggleOnline"; squareId: string }
  | { type: "confirmStratum"; stratumId: string }
  | { type: "editStratum"; stratumId: string; top: number; bottom: number }
  | {
      type: "addStratumNote";
      stratumId: string;
      text: string;
      top: number | null;
      bottom: number | null;
    }
  | { type: "decideRevision"; revisionId: string; approve: boolean }
  | { type: "updateLink"; linkId: string; elevA: number; elevB: number }
  | {
      type: "addPoint";
      unitId: string;
      squareId: string;
      stratumId: string;
      text: string;
      findName: string;
      findQty: number | null;
    }
  | { type: "correctPoint"; pointId: string; toStratumId: string }
  | { type: "sealBatch"; batchId: string }
  | { type: "setBatchFail"; batchId: string; willFail: boolean }
  | { type: "syncBatch"; batchId: string }
  | { type: "syncSquare"; squareId: string }
  | { type: "reuploadBatch"; batchId: string };
