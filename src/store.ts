import type { Action, Find, ObservationPoint, State, Stratum, SyncBatch } from "./types";
import { computeStats, nowLabel, stratumById, uid, unitStatus } from "./engine";
import { makeSeed } from "./seed";

function log(state: State, text: string, tone: State["log"][number]["tone"]) {
  state.log.unshift({ id: uid(state, "log"), text, at: nowLabel(), tone });
}

function denied(state: State, what: string, who: string) {
  log(state, `${what}需要${who}权限，当前操作未生效`, "warn");
}

export function reducer(prev: State, action: Action): State {
  const state: State = structuredClone(prev);

  switch (action.type) {
    case "setRole":
      state.role = action.role;
      log(state, `当前角色切换为${ROLE_NAME[action.role]}`, "info");
      return state;

    case "toggleOnline": {
      const sq = state.squares.find((s) => s.id === action.squareId);
      if (!sq) return state;
      sq.online = !sq.online;
      log(
        state,
        sq.online
          ? `${sq.id} 恢复联网，可将本机批次逐批回传合并`
          : `${sq.id} 断网，新观察点改为本机按批暂存`,
        sq.online ? "ok" : "warn"
      );
      return state;
    }

    case "confirmStratum": {
      if (state.role !== "leader") {
        denied(state, "确认地层", "领队");
        return state;
      }
      const st = stratumById(state, action.stratumId);
      if (!st) return state;
      st.confirmed = true;
      log(state, `领队确认 ${st.squareId} ${st.code}，地层锁定：现场只能补观察并生成修订`, "ok");
      return state;
    }

    case "editStratum": {
      // 只有复核员可直接更新未锁定地层；领队确认过的地层不能直接改
      const st = stratumById(state, action.stratumId);
      if (!st) return state;
      if (st.confirmed) {
        log(state, `${st.squareId} ${st.code} 已经领队确认，不能直接改高程，请补观察生成修订`, "danger");
        return state;
      }
      if (state.role !== "reviewer") {
        denied(state, "直接修订未确认地层", "复核员");
        return state;
      }
      pushSnapshot(st, "复核员直接更新未确认地层高程", state);
      st.top = action.top;
      st.bottom = action.bottom;
      log(state, `${st.squareId} ${st.code} 顶底高程已更新，跨方统计即时重算`, "ok");
      return state;
    }

    case "addStratumNote": {
      // 锁定地层也允许现场补观察；带高程建议时生成新修订而不是直接改
      if (state.role !== "field" && state.role !== "reviewer") {
        denied(state, "补充现场观察", "发掘队员/复核员");
        return state;
      }
      const st = stratumById(state, action.stratumId);
      if (!st) return state;
      if (!action.text.trim()) return state;

      const hasProposal =
        action.top !== null || action.bottom !== null;
      if (st.confirmed && hasProposal) {
        const rv = {
          id: uid(state, "rv"),
          stratumId: st.id,
          reason: action.text.trim(),
          fromTop: st.top,
          fromBottom: st.bottom,
          toTop: action.top ?? st.top,
          toBottom: action.bottom ?? st.bottom,
          status: "pending" as const,
          at: nowLabel(),
          by: state.role,
        };
        state.revisions.unshift(rv);
        state.notes.unshift({
          id: uid(state, "note"),
          stratumId: st.id,
          text: action.text.trim(),
          at: nowLabel(),
          by: state.role,
          revisionId: rv.id,
        });
        log(state, `${st.squareId} ${st.code} 已锁定：观察已留档，并生成修订 ${rv.id} 待领队确认`, "warn");
        return state;
      }

      state.notes.unshift({
        id: uid(state, "note"),
        stratumId: st.id,
        text: action.text.trim(),
        at: nowLabel(),
        by: state.role,
      });
      log(state, `${st.squareId} ${st.code} 追加现场观察一条，原有观察与出土物归属不变`, "info");
      return state;
    }

    case "decideRevision": {
      if (state.role !== "leader") {
        denied(state, "确认/驳回修订", "领队");
        return state;
      }
      const rv = state.revisions.find((r) => r.id === action.revisionId);
      const st = rv ? stratumById(state, rv.stratumId) : undefined;
      if (!rv || !st) return state;
      if (rv.status !== "pending") return state;
      rv.decidedAt = nowLabel();
      if (!action.approve) {
        rv.status = "rejected";
        log(state, `领队驳回 ${st.squareId} ${st.code} 的修订提案，原地层未改动`, "warn");
        return state;
      }
      pushSnapshot(st, `领队批准修订 ${rv.id}：${rv.reason}`, state);
      st.top = rv.toTop;
      st.bottom = rv.toBottom;
      rv.status = "approved";
      log(state, `领队批准 ${st.squareId} ${st.code} 修订，高程已更新，接界高差与单位状态重算`, "ok");
      return state;
    }

    case "updateLink": {
      // 复核员更新接界线高程；原观测保留在 updates 留痕里
      if (state.role !== "reviewer") {
        denied(state, "更新接界边界", "复核员");
        return state;
      }
      const link = state.links.find((l) => l.id === action.linkId);
      if (!link) return state;
      link.updates.unshift({
        elevA: link.elevA,
        elevB: link.elevB,
        at: nowLabel(),
        by: state.role,
      });
      link.elevA = action.elevA;
      link.elevB = action.elevB;
      const deltaCm = Math.abs(action.elevA - action.elevB) * 100;
      log(
        state,
        `接界边界已更新，现高差 ${deltaCm.toFixed(1)} cm，统计与摘要、单位状态立即重算`,
        deltaCm > 2 ? "warn" : "ok"
      );
      return state;
    }

    case "addPoint": {
      if (state.role !== "field") {
        denied(state, "现场补观察点", "发掘队员");
        return state;
      }
      const sq = state.squares.find((s) => s.id === action.squareId);
      const unit = state.units.find((u) => u.id === action.unitId);
      if (!sq || !unit || !action.text.trim()) return state;

      const point: ObservationPoint = {
        id: uid(state, "p"),
        unitId: unit.id,
        squareId: sq.id,
        stratumId: action.stratumId,
        text: action.text.trim(),
        observer: `发掘队员·现场`,
        at: nowLabel(),
        finds: [],
        corrections: [],
      };
      if (action.findName.trim() && action.findQty && action.findQty > 0) {
        const f: Find = {
          id: uid(state, "f"),
          name: action.findName.trim(),
          qty: action.findQty,
          unit: "件",
        };
        point.finds.push(f);
      }

      if (!sq.online) {
        // 断网：落到本探方草稿批（没有就新建），回网再合并
        let batch = state.batches.find(
          (b) => b.squareId === sq.id && b.status === "draft"
        );
        if (!batch) {
          batch = {
            id: uid(state, "batch"),
            clientBatchNo: `${sq.id}-B${String(state.seq).slice(-3)}`,
            squareId: sq.id,
            status: "draft",
            willFail: false,
            points: [],
          };
          state.batches.unshift(batch);
        }
        batch.points.push(point);
        log(
          state,
          `${sq.id} 断网：观察点已暂存到本机批次 ${batch.clientBatchNo}，回网后按观察点合并`,
          "warn"
        );
        return state;
      }

      mergePoints(state, [point]);
      if (!unit.pointIds.includes(point.id)) unit.pointIds.push(point.id);
      log(state, `${unit.name} 在 ${sq.id} 新增观察点；跨接界单位仍保持一个单位，不拆分`, "ok");
      return state;
    }

    case "correctPoint": {
      if (state.role !== "reviewer") {
        denied(state, "修正观察点归层", "复核员");
        return state;
      }
      const p = state.points[action.pointId];
      const to = stratumById(state, action.toStratumId);
      if (!p || !to || p.stratumId === action.toStratumId) return state;
      p.corrections.unshift({
        id: uid(state, "corr"),
        fromStratumId: p.stratumId,
        toStratumId: action.toStratumId,
        at: nowLabel(),
        by: state.role,
      });
      p.stratumId = action.toStratumId;
      log(state, `${p.squareId} 观察点归层改为 ${to.code}：原观察与出土物保留，单位状态重算`, "ok");
      return state;
    }

    case "sealBatch": {
      const batch = state.batches.find((b) => b.id === action.batchId);
      if (!batch || batch.status !== "draft") return state;
      batch.status = "queued";
      log(state, `批次 ${batch.clientBatchNo} 已封口待传（共 ${batch.points.length} 个观察点）`, "info");
      return state;
    }

    case "setBatchFail": {
      const batch = state.batches.find((b) => b.id === action.batchId);
      if (!batch) return state;
      batch.willFail = action.willFail;
      log(
        state,
        action.willFail
          ? `已标记 ${batch.clientBatchNo} 下次回传模拟失败（用于演示单独重试）`
          : `已取消 ${batch.clientBatchNo} 的失败模拟`,
        "info"
      );
      return state;
    }

    case "syncBatch":
      syncOne(state, action.batchId);
      return state;

    case "syncSquare": {
      const ids = state.batches
        .filter(
          (b) =>
            b.squareId === action.squareId &&
            (b.status === "queued" || b.status === "failed")
        )
        .map((b) => b.id);
      if (!ids.length) {
        log(state, `${action.squareId} 没有待传批次（草稿需先封口）`, "info");
        return state;
      }
      for (const id of ids) syncOne(state, id);
      return state;
    }

    case "reuploadBatch": {
      const batch = state.batches.find((b) => b.id === action.batchId);
      if (!batch) return state;
      batch.willFail = false;
      batch.error = undefined;
      log(state, `批次 ${batch.clientBatchNo} 重新提交，与其他批次互不影响`, "info");
      syncOne(state, batch.id);
      return state;
    }

    default:
      return state;
  }
}

function pushSnapshot(st: Stratum, note: string, state: State) {
  st.history.unshift({
    top: st.top,
    bottom: st.bottom,
    note,
    at: nowLabel(),
    by: state.role,
  });
}

/**
 * 回网合并：按观察点 ID 幂等入库。
 * 断网重传 / 重复上传时已合并过的点只算一次。
 */
function mergePoints(state: State, incoming: ObservationPoint[]): number {
  let merged = 0;
  let dup = 0;
  for (const p of incoming) {
    if (state.points[p.id]) {
      dup++;
      continue;
    }
    state.points[p.id] = p;
    merged++;
    const unit = state.units.find((u) => u.id === p.unitId);
    if (unit && !unit.pointIds.includes(p.id)) unit.pointIds.push(p.id);
  }
  if (merged > 0) log(state, `按观察点合并 ${merged} 个观察点${dup ? `，重复上传 ${dup} 个只算一次` : ""}`, "ok");
  else if (dup > 0) log(state, `本批 ${dup} 个观察点此前已合并，重复上传只算一次`, "info");
  return merged;
}

function syncOne(prev: State, batchId: string) {
  const state = prev;
  const batch = state.batches.find((b) => b.id === batchId) as SyncBatch | undefined;
  if (!batch) return;
  if (batch.status === "synced") return;
  const sq = state.squares.find((s) => s.id === batch.squareId);
  if (sq && !sq.online) {
    log(state, `${batch.clientBatchNo} 无法回传：${batch.squareId} 仍处于断网状态`, "danger");
    return;
  }
  if (batch.status === "draft") {
    log(state, `${batch.clientBatchNo} 仍是草稿，请先封口再回传`, "warn");
    return;
  }
  if (batch.willFail) {
    batch.status = "failed";
    batch.error = "回传超时（模拟 HTTP 504）";
    log(state, `批次 ${batch.clientBatchNo} 回传失败（${batch.points.length} 点保留本机，可单独重试）`, "danger");
    return;
  }
  mergePoints(state, batch.points);
  batch.status = "synced";
  batch.error = undefined;
  batch.syncedAt = nowLabel();
  log(state, `批次 ${batch.clientBatchNo} 同步成功，本批完结，不影响其他失败批次`, "ok");
}

export const ROLE_NAME: Record<State["role"], string> = {
  field: "发掘队员",
  reviewer: "复核员",
  leader: "领队",
};

export { computeStats, unitStatus };
