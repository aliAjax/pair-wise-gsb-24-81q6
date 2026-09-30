import { useStore } from "../store";

const STATUS_TEXT = {
  proposed: "待领队裁定",
  adopted: "已采纳·已生效",
  rejected: "已驳回",
} as const;

export function Revisions() {
  const { state, dispatch } = useStore();
  const canDecide = state.role === "director";

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>确认层只走修订，不直接改</p>
          <h2>地层修订单</h2>
        </div>
        <span className={`hint ${canDecide ? "" : "dim"}`}>
          {canDecide ? "领队可逐条采纳／驳回，采纳后全域重算" : `当前非领队角色（${state.role === "field" ? "发掘队员" : "复核员"}），仅查看`}
        </span>
      </div>

      {state.revisions.length === 0 ? (
        <p className="empty">暂无修订。发掘队员可在「探方地层簿」对领队确认层「补观察·提修订」。</p>
      ) : (
        <div className="revision-list">
          {state.revisions.map((r) => {
            const stratum = state.strata.find((s) => s.id === r.stratumId);
            return (
              <article key={r.id} className={`revision-card rev-${r.status}`}>
                <div className="rev-main">
                  <div className="rev-head">
                    <code>{r.id}</code>
                    <b>{r.trenchId} · {stratum?.code}</b>
                    <span className={`tag tag-rev-${r.status}`}>{STATUS_TEXT[r.status]}</span>
                    <span className="hint">{r.createdAt}</span>
                  </div>
                  <p className="rev-note">现场补观察：{r.note}</p>
                  <p className="rev-values">
                    {r.field === "topElev" ? "顶界" : "底界"}高程
                    <s>{r.currentValue.toFixed(2)}m</s>
                    <span className="arrow">→</span>
                    <b>{r.proposedValue.toFixed(2)}m</b>
                  </p>
                </div>
                {r.status === "proposed" && (
                  <div className="rev-actions">
                    <button
                      className="primary-action"
                      disabled={!canDecide}
                      onClick={() => dispatch({ type: "DECIDE_REVISION", revisionId: r.id, adopt: true })}
                    >
                      采纳并改高程
                    </button>
                    <button
                      disabled={!canDecide}
                      onClick={() => dispatch({ type: "DECIDE_REVISION", revisionId: r.id, adopt: false })}
                    >
                      驳回
                    </button>
                  </div>
                )}
                {r.status !== "proposed" && r.decidedAt && (
                  <span className="hint">领队于 {r.decidedAt} {r.status === "adopted" ? "采纳" : "驳回"}</span>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
