import type {
  Boundary,
  BoundaryLink,
  FeatureUnit,
  ObservationPoint,
  Square,
  State,
  Stratum,
  SyncBatch,
} from "./types";

/** 接界线高程差允许阈值：2cm */
export const ELEV_TOLERANCE = 0.02;

export function uid(state: State, prefix: string): string {
  return `${prefix}-${++state.seq}`;
}

export function nowLabel(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

export const cm = (m: number) => `${m.toFixed(3)} m`;

export function linkDelta(link: BoundaryLink): number {
  return Math.abs(link.elevA - link.elevB);
}

/** 高差是否超过 2cm（进待复核）。0.020 视为合格。 */
export function isLinkPending(link: BoundaryLink): boolean {
  return linkDelta(link) > ELEV_TOLERANCE + 1e-9;
}

export function linkState(link: BoundaryLink): "ok" | "review" {
  return isLinkPending(link) ? "review" : "ok";
}

export function squareById(state: State, id: string): Square | undefined {
  return state.squares.find((s) => s.id === id);
}

export function stratumById(state: State, id: string): Stratum | undefined {
  return state.strata.find((s) => s.id === id);
}

export function boundaryById(state: State, id: string): Boundary | undefined {
  return state.boundaries.find((b) => b.id === id);
}

export function strataOfSquare(state: State, squareId: string): Stratum[] {
  return state.strata.filter((s) => s.squareId === squareId);
}

export function linksOfBoundary(state: State, boundaryId: string): BoundaryLink[] {
  return state.links.filter((l) => l.boundaryId === boundaryId);
}

export function pointsOfUnit(state: State, unitId: string): ObservationPoint[] {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit) return [];
  return unit.pointIds
    .map((id) => state.points[id])
    .filter((p): p is ObservationPoint => Boolean(p));
}

export function pendingBatchesOfSquare(batches: SyncBatch[], squareId: string): SyncBatch[] {
  return batches.filter(
    (b) =>
      b.squareId === squareId &&
      (b.status === "draft" || b.status === "queued" || b.status === "failed")
  );
}

/** 全部暂存观察点（草稿/待传/失败批里的点，回网合并前不计入正式观察） */
export function queuedPoints(state: State): ObservationPoint[] {
  return state.batches
    .filter((b) => b.status !== "synced")
    .flatMap((b) => b.points);
}

interface Graph {
  edges: Map<string, { to: string; ok: boolean }[]>;
}

/**
 * 跨探方地层连通图：
 * 节点是各探方自己编号的地层，边是接界关联。
 * 高程差 ≤ 2cm 的边为「已校核边」，超差的边只作待复核关联。
 */
export function buildGraph(state: State): Graph {
  const edges = new Map<string, { to: string; ok: boolean }[]>();
  const add = (a: string, b: string, ok: boolean) => {
    if (!edges.has(a)) edges.set(a, []);
    if (!edges.has(b)) edges.set(b, []);
    edges.get(a)!.push({ to: b, ok });
    edges.get(b)!.push({ to: a, ok });
  };
  for (const link of state.links) {
    add(link.aStratumId, link.bStratumId, !isLinkPending(link));
  }
  for (const s of state.strata) {
    if (!edges.has(s.id)) edges.set(s.id, []);
  }
  return { edges };
}

export type UnitStatus = "ok" | "review" | "mismatch";

/** 从 start 出发能否沿已校核边到达 target */
function reachableOk(graph: Graph, start: string, target: string): boolean {
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === target) return true;
    for (const e of graph.edges.get(cur) ?? []) {
      if (!e.ok || seen.has(e.to)) continue;
      seen.add(e.to);
      queue.push(e.to);
    }
  }
  return false;
}

/** 从 start 出发是否存在一条到达 target 的路径经过待复核（超差）边 */
function reachableViaPending(graph: Graph, start: string, target: string): boolean {
  const seen = new Set<string>([start]);
  const queue: { id: string; touchedPending: boolean }[] = [{ id: start, touchedPending: false }];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.id === target && cur.touchedPending) return true;
    for (const e of graph.edges.get(cur.id) ?? []) {
      const key = `${e.to}:${cur.touchedPending || !e.ok}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ id: e.to, touchedPending: cur.touchedPending || !e.ok });
    }
  }
  return false;
}

/**
 * 单位状态（统计即时重算的核心）：
 * - 一个单位在多个探方的观察点归到不同地层：
 *   - 任两点地层连已校核边都不通 → 错层风险（常被归错层）
 *   - 连通但路径上有待复核接界 → 待复核
 *   - 全部经已校核边连通 → 已校核（跨接界单位仍只有一个单位）
 */
export function unitStatus(state: State, unit: FeatureUnit): {
  status: UnitStatus;
  reason: string;
} {
  const points = pointsOfUnit(state, unit.id);
  const strataIds = [...new Set(points.map((p) => p.stratumId))];
  if (points.length <= 1 || strataIds.length <= 1) {
    return { status: "ok", reason: "单探方观察，无跨方归层" };
  }
  const graph = buildGraph(state);
  let anyDisconnected = false;
  let anyPendingPath = false;
  for (let i = 0; i < strataIds.length; i++) {
    for (let j = i + 1; j < strataIds.length; j++) {
      const [a, b] = [strataIds[i], strataIds[j]];
      if (reachableOk(graph, a, b)) continue;
      if (reachableViaPending(graph, a, b)) {
        anyPendingPath = true;
      } else {
        anyDisconnected = true;
      }
    }
  }
  if (anyDisconnected) {
    return { status: "mismatch", reason: "各探方归层在接界关系图上不连通，疑似归错层" };
  }
  if (anyPendingPath) {
    return { status: "review", reason: "归层经高差超 2cm 的待复核接界相连" };
  }
  return { status: "ok", reason: "跨探方归层均已对平校核" };
}

export interface Stats {
  squares: number;
  onlineSquares: number;
  strata: number;
  confirmedStrata: number;
  links: number;
  pendingLinks: number;
  units: number;
  crossBoundaryUnits: number;
  unitOk: number;
  unitReview: number;
  unitMismatch: number;
  syncedPoints: number;
  queuedPoints: number;
  queuedBatches: number;
  failedBatches: number;
  findQty: number;
  pendingRevisions: number;
}

export function computeStats(state: State): Stats {
  const unitResults = state.units.map((u) => ({
    unit: u,
    result: unitStatus(state, u),
  }));
  const queued = queuedPoints(state);
  const findQty =
    Object.values(state.points).reduce(
      (sum, p) => sum + p.finds.reduce((s, f) => s + f.qty, 0),
      0
    ) + queued.reduce((sum, p) => sum + p.finds.reduce((s, f) => s + f.qty, 0), 0);

  return {
    squares: state.squares.length,
    onlineSquares: state.squares.filter((s) => s.online).length,
    strata: state.strata.length,
    confirmedStrata: state.strata.filter((s) => s.confirmed).length,
    links: state.links.length,
    pendingLinks: state.links.filter(isLinkPending).length,
    units: state.units.length,
    crossBoundaryUnits: unitResults.filter((r) => r.unit.pointIds.length > 1).length,
    unitOk: unitResults.filter((r) => r.result.status === "ok").length,
    unitReview: unitResults.filter((r) => r.result.status === "review").length,
    unitMismatch: unitResults.filter((r) => r.result.status === "mismatch").length,
    syncedPoints: Object.keys(state.points).length,
    queuedPoints: queued.length,
    queuedBatches: state.batches.filter(
      (b) => b.status === "draft" || b.status === "queued"
    ).length,
    failedBatches: state.batches.filter((b) => b.status === "failed").length,
    findQty,
    pendingRevisions: state.revisions.filter((r) => r.status === "pending").length,
  };
}
