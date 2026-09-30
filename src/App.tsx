import { useMemo, useReducer } from "react";
import "./styles.css";
import { makeSeed } from "./seed";
import { reducer, ROLE_NAME } from "./store";
import { computeStats } from "./engine";
import type { Role } from "./types";
import { SquaresPanel } from "./components/SquaresPanel";
import { BoundariesPanel } from "./components/BoundariesPanel";
import { UnitsPanel } from "./components/UnitsPanel";
import { RevisionsPanel } from "./components/RevisionsPanel";
import { SummaryPanel } from "./components/SummaryPanel";

const ROLES: Role[] = ["field", "reviewer", "leader"];

function App() {
  const [state, dispatch] = useReducer(reducer, undefined, makeSeed);
  const stats = useMemo(() => computeStats(state), [state]);

  const metrics = [
    { label: "探方（联网/总数）", value: `${stats.onlineSquares}/${stats.squares}`, tone: stats.onlineSquares < stats.squares ? "warn" : "ok" },
    { label: "接界关联 · 待复核", value: `${stats.pendingLinks}/${stats.links}`, tone: stats.pendingLinks ? "danger" : "ok" },
    { label: "遗迹单位 已校核/待核/错层", value: `${stats.unitOk}/${stats.unitReview}/${stats.unitMismatch}`, tone: stats.unitMismatch ? "danger" : stats.unitReview ? "warn" : "ok" },
    { label: "已合并观察点", value: String(stats.syncedPoints), tone: "ok" },
    { label: "断网暂存点（待回网）", value: String(stats.queuedPoints), tone: stats.queuedPoints ? "warn" : "ok" },
    { label: "失败批次（可单独重试）", value: String(stats.failedBatches), tone: stats.failedBatches ? "danger" : "ok" },
    { label: "出土物累计", value: String(stats.findQty), tone: "ok" },
    { label: "地层修订待领队确认", value: String(stats.pendingRevisions), tone: stats.pendingRevisions ? "warn" : "ok" },
  ];

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-10 · 跨探方关系校核台</p>
          <h1>考古探方地层接界校核</h1>
          <p className="subtitle">
            每个探方保留自己的地层编号与顶底高程；接界关联相邻地层，高差超 2cm 自动进待复核。
            跨接界遗迹单位在两探方各留观察点、仍是同一个单位。原有观察与出土物归属始终保留。
          </p>
        </div>
        <div className="stack-card">
          <span>当前角色（切换查看权限边界）</span>
          <div className="role-switch">
            {ROLES.map((r) => (
              <button
                key={r}
                className={state.role === r ? "role-btn active" : "role-btn"}
                onClick={() => dispatch({ type: "setRole", role: r })}
              >
                {ROLE_NAME[r]}
              </button>
            ))}
          </div>
          <p className="small muted-text">
            {state.role === "field" && "发掘队员：补观察/观察点（锁定层只能生成修订）、批次回传"}
            {state.role === "reviewer" && "复核员：更新未锁定地层与接界边界、修正归层，统计即时重算"}
            {state.role === "leader" && "领队：确认地层锁定、批准或驳回修订，确认后的地层不可直接改"}
          </p>
        </div>
      </section>

      <section className="metrics-grid metrics-8">
        {metrics.map((m) => (
          <article key={m.label} className="metric-card">
            <span>{m.label}</span>
            <strong>{m.value}</strong>
            <i className={`status-${m.tone === "warn" ? "watch" : m.tone}`} />
          </article>
        ))}
      </section>

      <section className="workspace two-col">
        <SquaresPanel state={state} dispatch={dispatch} />
        <BoundariesPanel state={state} dispatch={dispatch} />
      </section>

      <section className="workspace single">
        <UnitsPanel state={state} dispatch={dispatch} />
      </section>

      <section className="workspace two-col">
        <RevisionsPanel state={state} dispatch={dispatch} />
        <SummaryPanel state={state} dispatch={dispatch} />
      </section>
    </main>
  );
}

export default App;
