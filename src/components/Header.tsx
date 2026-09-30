import { useStore } from "../store";
import { computeStats, ROLE_LABEL } from "../model";
import type { Role, Stats } from "../model";

const METRICS: { key: keyof Stats; label: (s: Stats) => string; tone: "ok" | "watch" | "danger" }[] = [
  { key: "trenchCount", label: () => "探方数", tone: "ok" },
  { key: "stratumCount", label: (s) => `地层数（领队确认 ${s.confirmedCount}）`, tone: "ok" },
  { key: "linkPending", label: () => "接界待复核（>2cm）", tone: "danger" },
  { key: "unitDanger", label: () => "遗迹单位·疑似归错层", tone: "danger" },
  { key: "unitWatch", label: () => "遗迹单位·挂待复核接界", tone: "watch" },
  { key: "revisionPending", label: () => "修订待领队裁定", tone: "watch" },
  { key: "failedBatches", label: () => "失败批次（可单批重试）", tone: "danger" },
  { key: "pendingPoints", label: () => "断网待回传观察点", tone: "watch" },
];

export function Header() {
  const { state, dispatch } = useStore();
  const stats = computeStats(state);

  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-10 · 跨探方地层关系校核台</p>
          <h1>接界高程对不上，先校核再归层</h1>
          <p className="subtitle">
            各探方保留自己的地层编号与顶底高程；接界只做关联、不强行统一编号。跨接界遗迹单位两侧各留观察点、同属一个单位；
            接界线高程差超过 <strong>2 厘米</strong> 自动进入待复核；复核员更新边界后统计、摘要、单位状态立即重算。
          </p>
        </div>
        <div className="stack-card">
          <span>当前角色（权限演示）</span>
          <div className="role-switch">
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <button
                key={r}
                className={state.role === r ? "role-btn active" : "role-btn"}
                onClick={() => dispatch({ type: "ROLE", role: r })}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
          <span className="hint">现场只能补观察＋生成修订 · 复核员更新边界 · 确认层改动待领队裁定</span>
        </div>
      </section>

      <section className="metrics-grid metrics-8">
        {METRICS.map((m) => (
          <article className={`metric-card metric-${m.tone}`} key={m.key}>
            <span>{m.label(stats)}</span>
            <strong>{stats[m.key]}</strong>
            <i className={`status-${m.tone}`} />
          </article>
        ))}
      </section>
    </>
  );
}
