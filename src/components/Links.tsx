import { useState } from "react";
import { useStore } from "../store";
import type { BoundaryLink } from "../model";
import { elevDiff } from "../model";

const STATUS_TEXT = {
  normal: "高程吻合",
  pending: "待复核（差 > 2cm）",
  reviewed: "复核已收敛",
} as const;

function LinkCard({ link }: { link: BoundaryLink }) {
  const { state, dispatch } = useStore();
  const sA = state.strata.find((s) => s.id === link.stratumA);
  const sB = state.strata.find((s) => s.id === link.stratumB);
  const [elevA, setElevA] = useState(link.elevA.toFixed(2));
  const [elevB, setElevB] = useState(link.elevB.toFixed(2));
  const [note, setNote] = useState("");
  const diff = elevDiff(link);
  const canReview = state.role === "reviewer";

  const layerOptions = (trenchId: string) => state.strata.filter((s) => s.trenchId === trenchId);

  return (
    <article className={`link-card link-${link.status}`}>
      <header>
        <div>
          <h3>{link.edge}</h3>
          <p className="link-pair">
            关联：{link.trenchA} <b>{sA?.code}</b> ↔ {link.trenchB} <b>{sB?.code}</b>
          </p>
        </div>
        <span className={`tag tag-${link.status}`}>{STATUS_TEXT[link.status]}</span>
      </header>

      <div className="link-body">
        <label>
          <span>{link.trenchA} 侧接界高程 m</span>
          <input
            type="number"
            step="0.01"
            value={elevA}
            disabled={!canReview}
            onChange={(e) => setElevA(e.target.value)}
          />
          <select
            disabled={!canReview}
            value={link.stratumA}
            onChange={(e) => dispatch({ type: "RESOLVE_LINK", linkId: link.id, elevA: Number(elevA), elevB: Number(elevB), stratumA: e.target.value, note })}
          >
            {layerOptions(link.trenchA).map((s) => (
              <option key={s.id} value={s.id}>{s.code}（{s.soil}）</option>
            ))}
          </select>
        </label>

        <div className="link-diff">
          <span className={diff > 0.02 + 1e-9 ? "diff-bad" : "diff-ok"}>Δ {diff.toFixed(2)}m</span>
          <span className="hint">阈值 0.02m</span>
        </div>

        <label>
          <span>{link.trenchB} 侧接界高程 m</span>
          <input
            type="number"
            step="0.01"
            value={elevB}
            disabled={!canReview}
            onChange={(e) => setElevB(e.target.value)}
          />
          <select
            disabled={!canReview}
            value={link.stratumB}
            onChange={(e) => dispatch({ type: "RESOLVE_LINK", linkId: link.id, elevA: Number(elevA), elevB: Number(elevB), stratumB: e.target.value, note })}
          >
            {layerOptions(link.trenchB).map((s) => (
              <option key={s.id} value={s.id}>{s.code}（{s.soil}）</option>
            ))}
          </select>
        </label>
      </div>

      <footer>
        <input
          className="note-input"
          placeholder="复核结论：以哪一侧为准／是否坡降（不覆盖原观察）"
          disabled={!canReview}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          className="primary-action"
          disabled={!canReview}
          title={canReview ? "" : "仅复核员可更新边界"}
          onClick={() =>
            dispatch({ type: "RESOLVE_LINK", linkId: link.id, elevA: Number(elevA), elevB: Number(elevB), note })
          }
        >
          更新边界并重算
        </button>
      </footer>

      {link.resolvedNote && (
        <p className="resolved-note">
          复核留痕（{link.resolvedAt}）：{link.resolvedNote}
        </p>
      )}
      {!canReview && (
        <p className="hint role-note">当前角色「{state.role === "field" ? "发掘队员" : "领队"}」只读；更新边界请切换复核员。</p>
      )}
    </article>
  );
}

export function Links() {
  const { state } = useStore();
  const pendingFirst = [...state.links].sort((a, b) => {
    const rank = { pending: 0, normal: 1, reviewed: 2 };
    return rank[a.status] - rank[b.status];
  });
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>不统一编号，只在接界处挂关联</p>
          <h2>探方接界校核</h2>
        </div>
        <span className="hint">改任一侧高程或换挂地层，高差与单位状态立即重算</span>
      </div>
      <div className="link-list">
        {pendingFirst.map((l) => (
          <LinkCard key={l.id} link={l} />
        ))}
      </div>
    </section>
  );
}
