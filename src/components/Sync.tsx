import { useState } from "react";
import { useStore } from "../store";

const BATCH_TEXT = {
  queued: "排队中",
  synced: "已合并",
  failed: "失败待重试",
} as const;

export function Sync() {
  const { state, dispatch } = useStore();
  const [unitId, setUnitId] = useState(state.units[0]?.id ?? "");
  const [layerRaw, setLayerRaw] = useState("第3层");
  const [coord, setCoord] = useState("");
  const [note, setNote] = useState("");
  const [artifacts, setArtifacts] = useState("");
  const [forceFail, setForceFail] = useState(false);

  return (
    <section className="panel sync-panel">
      <div className="section-heading">
        <div>
          <p>断网先暂存，回网按观察点合并</p>
          <h2>离线观察与批次</h2>
        </div>
        <span className="hint">重复上传按观察点只算一次 · 失败批次单独重试，不牵连其他批</span>
      </div>

      <div className="sync-grid">
        <div className="sync-trenches">
          {state.trenches.map((t) => {
            const online = state.online[t.id];
            const pending = state.pending[t.id] ?? [];
            const failedBatch = state.batches.find((b) => b.trenchId === t.id && b.status === "failed");
            return (
              <article key={t.id} className={`sync-trench ${online ? "on" : "off"}`}>
                <header>
                  <b>{t.name}</b>
                  <span className={`net-dot ${online ? "on" : "off"}`}>{online ? "在线" : "断网"}</span>
                  <button onClick={() => dispatch({ type: "TOGGLE_NET", trenchId: t.id })}>
                    模拟{online ? "断网" : "回网"}
                  </button>
                </header>

                {!online && (
                  <div className="offline-form">
                    <p className="hint">本机暂存 {pending.length} 个观察点，回网后整批合并进原单位。</p>
                    <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                      {state.units.map((u) => (
                        <option key={u.id} value={u.id}>{u.code} {u.kind}（并入此单位，不新建）</option>
                      ))}
                    </select>
                    <input placeholder="该探方自编号，如 第3层 / ③层" value={layerRaw} onChange={(e) => setLayerRaw(e.target.value)} />
                    <input placeholder="坐标，如 E2 N1" value={coord} onChange={(e) => setCoord(e.target.value)} />
                    <input placeholder="观察描述" value={note} onChange={(e) => setNote(e.target.value)} />
                    <input placeholder="出土物归属（可留空）" value={artifacts} onChange={(e) => setArtifacts(e.target.value)} />
                    <button
                      className="primary-action"
                      disabled={!layerRaw || !note}
                      onClick={() => {
                        dispatch({
                          type: "ADD_OFFLINE_POINT",
                          trenchId: t.id,
                          unitId,
                          layerRaw,
                          coord,
                          note,
                          artifacts,
                        });
                        setCoord("");
                        setNote("");
                        setArtifacts("");
                      }}
                    >
                      暂存一条断网观察
                    </button>
                  </div>
                )}

                {online && (
                  <div className="sync-actions">
                    <label className="checkline">
                      <input type="checkbox" checked={forceFail} onChange={(e) => setForceFail(e.target.checked)} />
                      模拟本批上传失败
                    </label>
                    <button
                      className="primary-action"
                      disabled={pending.length === 0 || Boolean(failedBatch)}
                      title={failedBatch ? "有失败批次，请先单独重试" : ""}
                      onClick={() => dispatch({ type: "SYNC_TRENCH", trenchId: t.id, forceFail })}
                    >
                      回网合并{pending.length ? `（${pending.length} 点）` : ""}
                    </button>
                    {failedBatch && <span className="tag tag-danger">先重试失败批次 {failedBatch.id}</span>}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div className="batch-list">
          <h3>上传批次</h3>
          {state.batches.length === 0 && <p className="empty">还没有批次。</p>}
          {state.batches.map((b) => (
            <article key={b.id} className={`batch-card batch-${b.status}`}>
              <div>
                <code>{b.id}</code>
                <b>{b.trenchId}</b>
                <span className={`tag tag-batch-${b.status}`}>{BATCH_TEXT[b.status]}</span>
                <span className="hint">{b.syncedAt ?? b.createdAt}</span>
              </div>
              <p className="batch-points">观察点 {b.pointClientIds.join("、")}</p>
              {b.error && <p className="batch-error">{b.error}</p>}
              <div className="batch-btns">
                {b.status === "failed" && (
                  <button
                    className="primary-action"
                    onClick={() => dispatch({ type: "RETRY_BATCH", batchId: b.id })}
                  >
                    单独重试此批
                  </button>
                )}
                {b.status === "synced" && (
                  <button onClick={() => dispatch({ type: "REPLAY_DUPLICATE", batchId: b.id })}>
                    模拟重复上传（验证幂等）
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
