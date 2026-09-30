import React, { createContext, useContext, useMemo, useReducer } from "react";
import type {
  AppState,
  BatchStatus,
  BoundaryLink,
  LogEntry,
  Observation,
  Role,
  SyncBatch,
} from "./model";
import { linkStatusOf } from "./model";
import { createInitialState } from "./data";

export type Action =
  | { type: "ROLE"; role: Role }
  | { type: "TOGGLE_NET"; trenchId: string }
  | {
      type: "RESOLVE_LINK";
      linkId: string;
      elevA: number;
      elevB: number;
      stratumA?: string;
      stratumB?: string;
      note: string;
    }
  | { type: "CORRECT_LAYER"; obsId: string; layerId: string }
  | {
      type: "PROPOSE_REVISION";
      stratumId: string;
      field: "topElev" | "bottomElev";
      proposedValue: number;
      note: string;
    }
  | { type: "DECIDE_REVISION"; revisionId: string; adopt: boolean }
  | {
      type: "ADD_OFFLINE_POINT";
      trenchId: string;
      unitId: string;
      layerRaw: string;
      coord: string;
      note: string;
      artifacts: string;
    }
  | { type: "SYNC_TRENCH"; trenchId: string; forceFail: boolean }
  | { type: "RETRY_BATCH"; batchId: string }
  | { type: "REPLAY_DUPLICATE"; batchId: string };

type Tone = LogEntry["tone"];

function stamp(): string {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

function withLog(state: AppState, text: string, tone: Tone): LogEntry[] {
  const entry: LogEntry = { id: `LOG-${state.seq}`, at: stamp(), text, tone };
  return [entry, ...state.logs].slice(0, 60);
}

function nextId(state: AppState, prefix: string): string {
  return `${prefix}-${state.seq}`;
}

/** 任一高程或关联变化后，重算所有接界状态；reviewed 仅在复核员提交时单独置位 */
function recheckLinks(links: BoundaryLink[]): BoundaryLink[] {
  return links.map((l) =>
    l.status === "reviewed"
      ? l
      : { ...l, status: linkStatusOf(l.elevA, l.elevB) },
  );
}

export function reducer(prev: AppState, action: Action): AppState {
  let state = { ...prev, seq: prev.seq + 1 };

  switch (action.type) {
    case "ROLE":
      state.role = action.role;
      state.logs = withLog(state, `当前角色切换为${action.role === "field" ? "发掘队员" : action.role === "reviewer" ? "复核员" : "领队"}。`, "info");
      return state;

    case "TOGGLE_NET": {
      const online = !state.online[action.trenchId];
      state.online = { ...state.online, [action.trenchId]: online };
      state.logs = withLog(
        state,
        `${action.trenchId} ${online ? "恢复联网" : "进入断网"}，${online ? "离线批次可回传合并" : "观察先在本机暂存"}。`,
        online ? "ok" : "warn",
      );
      return state;
    }

    case "RESOLVE_LINK": {
      if (state.role !== "reviewer") {
        state.logs = withLog(state, "只有复核员能更新接界边界。", "danger");
        return state;
      }
      const link = state.links.find((l) => l.id === action.linkId);
      if (!link) return prev;
      const diff = Math.abs(action.elevA - action.elevB);
      const stillPending = diff > 0.02 + 1e-9;
      state.links = state.links.map((l) =>
        l.id === link.id
          ? {
              ...l,
              elevA: action.elevA,
              elevB: action.elevB,
              stratumA: action.stratumA ?? l.stratumA,
              stratumB: action.stratumB ?? l.stratumB,
              status: stillPending ? "pending" : "reviewed",
              resolvedNote: action.note || l.resolvedNote,
              resolvedBy: "reviewer",
              resolvedAt: stamp(),
            }
          : l,
      );
      state.links = recheckLinks(state.links);
      state.logs = withLog(
        state,
        `${link.edge}：复核员更新边界，高程差 ${diff.toFixed(2)}m，${stillPending ? "仍超过 2cm，保持待复核" : "已收敛，统计与单位状态立即重算"}。原观察、出土物归属保留。`,
        stillPending ? "danger" : "ok",
      );
      return state;
    }

    case "CORRECT_LAYER": {
      if (state.role !== "reviewer") {
        state.logs = withLog(state, "归层更正由复核员执行。", "danger");
        return state;
      }
      const obs = state.observations.find((o) => o.id === action.obsId);
      if (!obs) return prev;
      state.observations = state.observations.map((o) =>
        o.id === obs.id
          ? { ...o, correctedLayerId: action.layerId, correctedAt: stamp() }
          : o,
      );
      state.logs = withLog(
        state,
        `${obs.trenchId} 观察点 ${obs.id} 归层由「${obs.layerRaw}」更正（原记录与出土物保留），所属遗迹单位仍为 ${obs.unitId}，未拆分。`,
        "ok",
      );
      return state;
    }

    case "PROPOSE_REVISION": {
      if (state.role !== "field") {
        state.logs = withLog(state, "补观察与新修订由现场发掘队员提交。", "danger");
        return state;
      }
      const stratum = state.strata.find((s) => s.id === action.stratumId);
      if (!stratum) return prev;
      const revision = {
        id: nextId(state, "RV"),
        stratumId: stratum.id,
        trenchId: stratum.trenchId,
        field: action.field,
        currentValue: stratum[action.field],
        proposedValue: action.proposedValue,
        note: action.note,
        status: "proposed" as const,
        createdAt: stamp(),
      };
      state.revisions = [revision, ...state.revisions];
      state.logs = withLog(
        state,
        `${stratum.trenchId} ${stratum.code} 为领队确认层，现场未直接改动；已补观察并生成修订 ${revision.id}（${action.field === "topElev" ? "顶界" : "底界"} ${stratum[action.field].toFixed(2)} → ${action.proposedValue.toFixed(2)}m），待领队裁定。`,
        "warn",
      );
      return state;
    }

    case "DECIDE_REVISION": {
      if (state.role !== "director") {
        state.logs = withLog(state, "修订只能由领队采纳或驳回。", "danger");
        return state;
      }
      const revision = state.revisions.find((r) => r.id === action.revisionId);
      if (!revision || revision.status !== "proposed") return prev;
      state.revisions = state.revisions.map((r) =>
        r.id === revision.id ? { ...r, status: action.adopt ? "adopted" : "rejected", decidedAt: stamp() } : r,
      );
      if (action.adopt) {
        state.strata = state.strata.map((s) =>
          s.id === revision.stratumId ? { ...s, [revision.field]: revision.proposedValue } : s,
        );
        state.links = recheckLinks(state.links);
      }
      state.logs = withLog(
        state,
        `领队${action.adopt ? "采纳" : "驳回"}修订 ${revision.id}${action.adopt ? `，${revision.trenchId} 地层高程已更新并触发全域重算` : ""}。`,
        action.adopt ? "ok" : "info",
      );
      return state;
    }

    case "ADD_OFFLINE_POINT": {
      if (state.online[action.trenchId]) {
        state.logs = withLog(state, `${action.trenchId} 在线，无需走离线暂存。`, "info");
        return state;
      }
      const point = {
        clientId: nextId(state, "C"),
        unitId: action.unitId,
        layerRaw: action.layerRaw,
        coord: action.coord,
        note: action.note,
        artifacts: action.artifacts,
      };
      state.pending = { ...state.pending, [action.trenchId]: [...(state.pending[action.trenchId] ?? []), point] };
      state.logs = withLog(state, `${action.trenchId} 断网观察 ${point.clientId} 已本机暂存（单位 ${point.unitId}）。`, "info");
      return state;
    }

    case "SYNC_TRENCH": {
      const points = state.pending[action.trenchId] ?? [];
      if (!state.online[action.trenchId]) {
        state.logs = withLog(state, `${action.trenchId} 仍断网，无法回传。`, "danger");
        return state;
      }
      if (points.length === 0) {
        state.logs = withLog(state, `${action.trenchId} 没有待同步观察。`, "info");
        return state;
      }
      const batchId = nextId(state, "BT");
      const batch: SyncBatch = {
        id: batchId,
        trenchId: action.trenchId,
        status: "queued",
        createdAt: stamp(),
        failNext: false,
        pointClientIds: points.map((p) => p.clientId),
      };

      if (action.forceFail) {
        batch.status = "failed";
        batch.error = "网关超时（模拟），批次保留，可单独重试";
        state.batches = [batch, ...state.batches];
        state.logs = withLog(state, `${action.trenchId} 批次 ${batchId}（${points.length} 个观察点）上传失败，未合并；其他探方不受影响。`, "danger");
        return state;
      }

      return mergeBatch(state, batch);
    }

    case "RETRY_BATCH": {
      const batch = state.batches.find((b) => b.id === action.batchId);
      if (!batch || batch.status !== "failed") return prev;
      return mergeBatch(state, { ...batch });
    }

    case "REPLAY_DUPLICATE": {
      const batch = state.batches.find((b) => b.id === action.batchId);
      if (!batch) return prev;
      // 同批次观察点再次推送：按 clientId 去重，已合并的一律只算一次
      const existing = new Set(state.observations.filter((o) => o.clientId).map((o) => o.clientId));
      const dupCount = batch.pointClientIds.filter((c) => existing.has(c)).length;
      state.logs = withLog(
        state,
        `检测到 ${batch.id} 重复上传 ${batch.pointClientIds.length} 个观察点，其中 ${dupCount} 个已合并，按观察点去重后新增 0 条。`,
        "warn",
      );
      return state;
    }

    default:
      return prev;
  }
}

/** 回网合并：按观察点 clientId 幂等并入对应遗迹单位；成功后清掉本机暂存 */
function mergeBatch(prev: AppState, batch: SyncBatch): AppState {
  let state = { ...prev };
  const points = (state.pending[batch.trenchId] ?? []).filter((p) =>
    batch.pointClientIds.includes(p.clientId),
  );
  const existing = new Set(state.observations.filter((o) => o.clientId).map((o) => o.clientId));

  let added = 0;
  const newObs: Observation[] = [];
  for (const point of points) {
    if (existing.has(point.clientId)) continue; // 重复上传只算一次
    const stratum = state.strata.find(
      (s) => s.trenchId === batch.trenchId && s.code === point.layerRaw.trim(),
    );
    const obs: Observation = {
      id: nextId(state, "OB"),
      unitId: point.unitId,
      trenchId: batch.trenchId,
      layerId: stratum?.id ?? `${batch.trenchId}:?`,
      layerRaw: point.layerRaw,
      coord: point.coord,
      note: point.note,
      artifacts: point.artifacts,
      source: "synced",
      clientId: point.clientId,
    };
    newObs.push(obs);
    added += 1;
    state = { ...state, seq: state.seq + 1 };
  }

  state.observations = [...state.observations, ...newObs];
  state.units = state.units.map((u) =>
    newObs.some((o) => o.unitId === u.id)
      ? { ...u, observationIds: [...u.observationIds, ...newObs.filter((o) => o.unitId === u.id).map((o) => o.id)] }
      : u,
  );

  const mergedIds = new Set(points.map((p) => p.clientId));
  state.pending = {
    ...state.pending,
    [batch.trenchId]: (state.pending[batch.trenchId] ?? []).filter((p) => !mergedIds.has(p.clientId)),
  };

  const status: BatchStatus = "synced";
  state.batches = state.batches.some((b) => b.id === batch.id)
    ? state.batches.map((b) => (b.id === batch.id ? { ...b, status, syncedAt: stamp(), error: undefined } : b))
    : [{ ...batch, status, syncedAt: stamp() }, ...state.batches];

  const skipped = points.length - added;
  state.logs = withLog(
    state,
    `${batch.trenchId} 批次 ${batch.id} 回网合并：${added} 个观察点并入原遗迹单位（不拆新单位）${skipped ? `，${skipped} 个重复点只算一次` : ""}，统计已重算。`,
    added ? "ok" : "warn",
  );
  return state;
}

interface Store {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("StoreProvider missing");
  return ctx;
}
