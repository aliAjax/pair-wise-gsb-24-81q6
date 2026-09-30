import { useStore } from "../store";
import { deriveUnit, effectiveLayerId } from "../model";
import type { Observation } from "../model";

const LEVEL_META = {
  ok: { text: "归层已对齐", cls: "tag-normal" },
  watch: { text: "等待接界复核", cls: "tag-pending" },
  danger: { text: "疑似归错层", cls: "tag-danger" },
} as const;

function ObservationRow({ obs }: { obs: Observation }) {
  const { state, dispatch } = useStore();
  const raw = state.strata.find((s) => s.id === obs.layerId);
  const effective = state.strata.find((s) => s.id === effectiveLayerId(obs));
  const corrected = obs.correctedLayerId && obs.correctedLayerId !== obs.layerId;

  return (
    <div className="obs-row">
      <div className="obs-id">
        <span className="trench-badge">{obs.trenchId}</span>
        <code>{obs.id}</code>
        {obs.source === "synced" && <span className="tag tag-synced">断网回传合并</span>}
      </div>
      <div className="obs-main">
        <p className="obs-note">{obs.note}</p>
        <p className="obs-meta">
          坐标 {obs.coord || "—"} · 出土物归属：<b>{obs.artifacts || "无"}</b>
          <span className="preserved">（复核只追加，原归属保留）</span>
        </p>
        <div className="obs-layer">
          <span>现场原记：<b>{obs.layerRaw}</b>{raw ? `（${raw.code}）` : ""}</span>
          <span className="arrow">→</span>
          <span className={corrected ? "corrected" : ""}>
            有效归层：<b>{effective ? effective.code : "待指认"}</b>
            {corrected && <span className="tag tag-reviewed">已更正 {obs.correctedAt}</span>}
          </span>
        </div>
      </div>
      {state.role === "reviewer" && (
        <select
          className="correct-select"
          value={effectiveLayerId(obs) === `${obs.trenchId}:?` ? "" : effectiveLayerId(obs)}
          onChange={(e) => dispatch({ type: "CORRECT_LAYER", obsId: obs.id, layerId: e.target.value })}
        >
          <option value="">更正归层…</option>
          {state.strata
            .filter((s) => s.trenchId === obs.trenchId)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.soil}
              </option>
            ))}
        </select>
      )}
    </div>
  );
}

export function Units() {
  const { state } = useStore();
  const derived = state.units.map((u) => deriveUnit(state, u));
  const rank = { danger: 0, watch: 1, ok: 2 };

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>一个遗迹单位，跨接界两侧各留观察点</p>
          <h2>遗迹单位状态</h2>
        </div>
        <span className="hint">观察点不拆成新单位；原观察与出土物归属始终保留</span>
      </div>
      <div className="unit-list">
        {[...derived].sort((a, b) => rank[a.level] - rank[b.level]).map((d) => {
          const meta = LEVEL_META[d.level];
          return (
            <article key={d.unit.id} className={`unit-card unit-${d.level}`}>
              <header>
                <div className="unit-title">
                  <h3>{d.unit.code} <span className="kind">{d.unit.kind}</span></h3>
                  <p>{d.unit.summary}</p>
                </div>
                <div className="unit-side">
                  <span className={`tag ${meta.cls}`}>{meta.text}</span>
                  <span className="hint">
                    观察点 {d.checked}/{d.total} 已对齐 · 跨 {d.trenches.join("／")}
                  </span>
                </div>
              </header>

              {d.issues.length > 0 && (
                <ul className="issue-list">
                  {d.issues.map((t, i) => (
                    <li key={i} className={t.includes("归错层") ? "issue-danger" : "issue-watch"}>{t}</li>
                  ))}
                </ul>
              )}

              <div className="obs-list">
                {d.unit.observationIds.map((id) => {
                  const obs = state.observations.find((o) => o.id === id);
                  return obs ? <ObservationRow key={id} obs={obs} /> : null;
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
