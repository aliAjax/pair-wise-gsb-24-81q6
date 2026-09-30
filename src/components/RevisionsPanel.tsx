import { cm, stratumById } from "../engine";
import { ROLE_NAME } from "../store";
import { Empty, Locked, PanelProps, Tag } from "./shared";

export function RevisionsPanel({ state, dispatch }: PanelProps) {
  const pending = state.revisions.filter((r) => r.status === "pending");
  const done = state.revisions.filter((r) => r.status !== "pending");

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>领队确认制</p>
          <h2>地层修订</h2>
        </div>
        <Tag tone={pending.length ? "review" : "ok"}>待确认 {pending.length}</Tag>
      </div>

      {pending.length === 0 && done.length === 0 && <Empty>暂无修订提案。锁定地层补观察并附高程建议即可生成。</Empty>}

      <div className="revision-list">
        {pending.map((r) => {
          const st = stratumById(state, r.stratumId)!;
          return (
            <article key={r.id} className="revision-card pending-rev">
              <div>
                <p className="small muted-text">
                  {r.id} · {st.squareId} {st.code}（已锁定） · {r.at} {ROLE_NAME[r.by]} 提议
                </p>
                <p>{r.reason}</p>
                <p className="small">
                  顶 {cm(r.fromTop)} → <b>{cm(r.toTop)}</b>　底 {cm(r.fromBottom)} → <b>{cm(r.toBottom)}</b>
                </p>
              </div>
              <Locked role={state.role} need={["leader"]}>
                <div className="rev-actions">
                  <button
                    className="primary-action small"
                    onClick={() => dispatch({ type: "decideRevision", revisionId: r.id, approve: true })}
                  >
                    领队批准
                  </button>
                  <button
                    className="small"
                    onClick={() => dispatch({ type: "decideRevision", revisionId: r.id, approve: false })}
                  >
                    驳回
                  </button>
                </div>
              </Locked>
            </article>
          );
        })}

        {done.map((r) => {
          const st = stratumById(state, r.stratumId);
          return (
            <article key={r.id} className="revision-card">
              <p className="small muted-text">
                <Tag tone={r.status === "approved" ? "ok" : "muted"}>
                  {r.status === "approved" ? "已批准" : "已驳回"}
                </Tag>
                {st ? `${st.squareId} ${st.code}` : r.stratumId} · {r.decidedAt}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
