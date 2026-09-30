import { useState } from "react";
import type { Stratum, SyncBatch } from "../types";
import { cm, strataOfSquare, pendingBatchesOfSquare } from "../engine";
import { ROLE_NAME } from "../store";
import { Locked, PanelProps, Tag } from "./shared";

export function SquaresPanel({ state, dispatch }: PanelProps) {
  return (
    <section className="panel tall-panel">
      <div className="section-heading">
        <div>
          <p>探方与地层</p>
          <h2>各探方地层档案</h2>
        </div>
        <Tag tone="muted">地层编号与高程归属各探方</Tag>
      </div>
      <div className="square-list">
        {state.squares.map((sq) => {
          const strata = strataOfSquare(state, sq.id);
          const pendingBatches = pendingBatchesOfSquare(state.batches, sq.id);
          const queuedCount = pendingBatches.reduce((n, b) => n + b.points.length, 0);
          return (
            <article key={sq.id} className={`square-card ${sq.online ? "" : "is-offline"}`}>
              <header className="square-head">
                <div>
                  <h3>
                    {sq.id} <span className="muted-text">{sq.label}</span>
                  </h3>
                  <p className="muted-text small">
                    地层 {strata.length} 层 · 已领队确认 {strata.filter((s) => s.confirmed).length} 层
                  </p>
                </div>
                <button
                  className={sq.online ? "online-btn" : "offline-btn"}
                  onClick={() => dispatch({ type: "toggleOnline", squareId: sq.id })}
                >
                  <i className={`dot ${sq.online ? "dot-on" : "dot-off"}`} />
                  {sq.online ? "联网" : "断网暂存"}
                </button>
              </header>

              {!sq.online && (
                <div className="offline-banner">
                  断网中：新观察点先进本机批次
                  {queuedCount > 0 && <>（待回网 {queuedCount} 点）</>}
                </div>
              )}

              <div className="stratum-list">
                {strata.map((st) => (
                  <StratumCard key={st.id} st={st} state={state} dispatch={dispatch} />
                ))}
              </div>

              <Outbox state={state} dispatch={dispatch} squareId={sq.id} />
            </article>
          );
        })}
      </div>
    </section>
  );
}

function StratumCard({
  st,
  state,
  dispatch,
}: {
  st: Stratum;
} & PanelProps) {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(String(st.top));
  const [bottom, setBottom] = useState(String(st.bottom));
  const [note, setNote] = useState("");
  const [toTop, setToTop] = useState("");
  const [toBottom, setToBottom] = useState("");

  const notes = state.notes.filter((n) => n.stratumId === st.id);
  const revisions = state.revisions.filter((r) => r.stratumId === st.id);

  const saveEdit = () => {
    const t = Number(top);
    const b = Number(bottom);
    if (Number.isNaN(t) || Number.isNaN(b)) return;
    dispatch({ type: "editStratum", stratumId: st.id, top: t, bottom: b });
  };

  const submitNote = () => {
    if (!note.trim()) return;
    const t = toTop === "" ? null : Number(toTop);
    const b = toBottom === "" ? null : Number(toBottom);
    dispatch({
      type: "addStratumNote",
      stratumId: st.id,
      text: note,
      top: t !== null && !Number.isNaN(t) ? t : null,
      bottom: b !== null && !Number.isNaN(b) ? b : null,
    });
    setNote("");
    setToTop("");
    setToBottom("");
  };

  return (
    <div className={`stratum-card ${st.confirmed ? "is-locked" : ""}`}>
      <div className="stratum-head" onClick={() => setOpen((v) => !v)}>
        <div>
          <strong>
            {st.code}
            {st.confirmed && <Tag tone="info">领队已确认 · 锁定</Tag>}
          </strong>
          <span className="muted-text small">{st.soil}</span>
        </div>
        <div className="stratum-elev">
          <span>
            顶 <b>{cm(st.top)}</b>
          </span>
          <span>
            底 <b>{cm(st.bottom)}</b>
          </span>
          <button className="chevron">{open ? "收起" : "展开"}</button>
        </div>
      </div>

      {open && (
        <div className="stratum-body">
          {st.history.length > 0 && (
            <div className="history-block">
              <p className="block-label">高程变更留痕（原值保留）</p>
              {st.history.map((h, i) => (
                <p key={i} className="history-row">
                  {h.at} · {ROLE_NAME[h.by]}：{cm(h.top)} / {cm(h.bottom)} → 现值
                  <span className="muted-text">（{h.note}）</span>
                </p>
              ))}
            </div>
          )}

          {!st.confirmed && (
            <Locked role={state.role} need={["reviewer"]}>
              <div className="inline-form">
                <label>
                  <span>顶高程</span>
                  <input value={top} step="0.001" onChange={(e) => setTop(e.target.value)} />
                </label>
                <label>
                  <span>底高程</span>
                  <input value={bottom} step="0.001" onChange={(e) => setBottom(e.target.value)} />
                </label>
                <button className="primary-action small" onClick={saveEdit}>
                  复核员更新高程
                </button>
              </div>
            </Locked>
          )}

          {!st.confirmed && (
            <Locked role={state.role} need={["leader"]}>
              <button
                className="small"
                onClick={() => dispatch({ type: "confirmStratum", stratumId: st.id })}
              >
                领队确认此层（确认后锁定）
              </button>
            </Locked>
          )}

          <Locked role={state.role} need={["field", "reviewer"]}>
            <div className="note-form">
              <p className="block-label">
                补现场观察{st.confirmed && "（锁定层：带高程建议将生成新修订，不直接改值）"}
              </p>
              <textarea
                rows={2}
                placeholder="记录土色、叠压、接界处现象……"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              {st.confirmed && (
                <div className="inline-form">
                  <label>
                    <span>建议顶高程（可空）</span>
                    <input placeholder={String(st.top)} value={toTop} onChange={(e) => setToTop(e.target.value)} />
                  </label>
                  <label>
                    <span>建议底高程（可空）</span>
                    <input placeholder={String(st.bottom)} value={toBottom} onChange={(e) => setToBottom(e.target.value)} />
                  </label>
                </div>
              )}
              <button className="small" onClick={submitNote}>
                追加观察{st.confirmed && "并生成修订"}
              </button>
            </div>
          </Locked>

          {notes.length > 0 && (
            <div className="notes-block">
              <p className="block-label">现场观察（不覆盖原记录）</p>
              {notes.map((n) => (
                <p key={n.id} className="history-row">
                  {n.at} · {ROLE_NAME[n.by]}：{n.text}
                  {n.revisionId && <Tag tone="review">已生成修订 {n.revisionId}</Tag>}
                </p>
              ))}
            </div>
          )}

          {revisions.length > 0 && (
            <div className="notes-block">
              <p className="block-label">关联修订</p>
              {revisions.map((r) => (
                <p key={r.id} className="history-row">
                  <Tag tone={r.status === "approved" ? "ok" : r.status === "rejected" ? "muted" : "review"}>
                    {r.status === "approved" ? "领队已批准" : r.status === "rejected" ? "已驳回" : "待领队确认"}
                  </Tag>
                  {cm(r.fromTop)}/{cm(r.fromBottom)} → {cm(r.toTop)}/{cm(r.toBottom)}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Outbox({
  state,
  dispatch,
  squareId,
}: { squareId: string } & PanelProps) {
  const batches = state.batches.filter((b) => b.squareId === squareId);
  if (!batches.length) return null;
  const sq = state.squares.find((s) => s.id === squareId)!;

  return (
    <div className="outbox">
      <p className="block-label">本机暂存批次（按批回传 · 按观察点幂等合并）</p>
      {batches.map((b) => (
        <BatchRow key={b.id} batch={b} online={sq.online} state={state} dispatch={dispatch} />
      ))}
    </div>
  );
}

function BatchRow({
  batch,
  online,
  dispatch,
}: { batch: SyncBatch; online: boolean } & PanelProps) {
  return (
    <div className={`batch-row batch-${batch.status}`}>
      <div className="batch-main">
        <div>
          <strong>{batch.clientBatchNo}</strong>{" "}
          <Tag
            tone={
              batch.status === "synced"
                ? "ok"
                : batch.status === "failed"
                ? "danger"
                : batch.status === "queued"
                ? "review"
                : "muted"
            }
          >
            {batch.status === "draft"
              ? "记录中（草稿）"
              : batch.status === "queued"
              ? "待回传"
              : batch.status === "failed"
              ? "回传失败"
              : "已同步"}
          </Tag>
        </div>
        <p className="small muted-text">
          {batch.points.length} 个观察点
          {batch.error && <span className="error-text"> · {batch.error}</span>}
          {batch.syncedAt && <span> · 合并于 {batch.syncedAt}</span>}
        </p>
        <ul className="batch-points">
          {batch.points.map((p) => (
            <li key={p.id} className="small">
              {p.at} {p.text}
            </li>
          ))}
        </ul>
      </div>
      <div className="batch-actions">
        {batch.status === "draft" && (
          <button className="small" onClick={() => dispatch({ type: "sealBatch", batchId: batch.id })}>
            封口待传
          </button>
        )}
        {(batch.status === "queued" || batch.status === "failed" || batch.status === "draft") && (
          <label className="fail-toggle small">
            <input
              type="checkbox"
              checked={batch.willFail}
              onChange={(e) =>
                dispatch({ type: "setBatchFail", batchId: batch.id, willFail: e.target.checked })
              }
            />
            模拟回传失败
          </label>
        )}
        {batch.status === "failed" && (
          <button
            className="small primary-action"
            onClick={() => dispatch({ type: "reuploadBatch", batchId: batch.id })}
          >
            单独重试
          </button>
        )}
        {(batch.status === "queued" || batch.status === "failed") && (
          <button
            className="small"
            disabled={!online}
            onClick={() => dispatch({ type: "syncBatch", batchId: batch.id })}
          >
            回传此批
          </button>
        )}
        {(batch.status === "queued" || batch.status === "failed") && online && (
          <button className="small" onClick={() => dispatch({ type: "syncSquare", squareId: batch.squareId })}>
            回传本探方全部待传批
          </button>
        )}
        {!online && batch.status !== "synced" && batch.status !== "draft" && (
          <p className="small error-text">断网中，回网后可传</p>
        )}
      </div>
    </div>
  );
}
