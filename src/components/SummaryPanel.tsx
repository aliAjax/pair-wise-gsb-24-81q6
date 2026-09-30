import { computeStats, isLinkPending, stratumById } from "../engine";
import { PanelProps } from "./shared";

export function SummaryPanel({ state }: PanelProps) {
  const stats = computeStats(state);

  const lines: { tone: "ok" | "review" | "danger" | "muted"; text: string }[] = [];
  if (stats.pendingLinks > 0) {
    for (const link of state.links.filter(isLinkPending)) {
      const a = stratumById(state, link.aStratumId);
      const b = stratumById(state, link.bStratumId);
      lines.push({
        tone: "review",
        text: `接界 ${a?.squareId}/${a?.code} ↔ ${b?.squareId}/${b?.code} 高差 ${(
          Math.abs(link.elevA - link.elevB) * 100
        ).toFixed(1)} cm，待复核`,
      });
    }
  } else {
    lines.push({ tone: "ok", text: "全部接界关联高差 ≤ 2 cm" });
  }

  lines.push({
    tone: stats.unitMismatch ? "danger" : stats.unitReview ? "review" : "ok",
    text: `遗迹单位 ${stats.units} 个（跨接界 ${stats.crossBoundaryUnits}）：已校核 ${stats.unitOk} · 待复核 ${stats.unitReview} · 错层风险 ${stats.unitMismatch}`,
  });

  if (stats.failedBatches > 0) {
    lines.push({ tone: "danger", text: `${stats.failedBatches} 个批次回传失败，单独重试，不影响其他批次` });
  }
  if (stats.queuedPoints > 0) {
    lines.push({ tone: "review", text: `${stats.queuedPoints} 个观察点在本机批次待回网，按观察点合并、重复只算一次` });
  }
  lines.push({ tone: "muted", text: `已合并观察点 ${stats.syncedPoints} 个；出土物累计 ${stats.findQty} 件；地层 ${stats.confirmedStrata}/${stats.strata} 经领队确认` });

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>即时摘要（随边界/归层/同步自动重算）</p>
          <h2>校核摘要</h2>
        </div>
      </div>
      <ul className="summary-lines">
        {lines.map((l, i) => (
          <li key={i} className={`summary-tone-${l.tone}`}>
            {l.text}
          </li>
        ))}
      </ul>

      <div className="log-block">
        <p className="block-label">操作动态</p>
        <ul className="log-list">
          {state.log.slice(0, 12).map((e) => (
            <li key={e.id} className={`log-tone-${e.tone}`}>
              <span className="log-time">{e.at}</span>
              {e.text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
