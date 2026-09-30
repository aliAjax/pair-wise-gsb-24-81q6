import { useState } from "react";
import { useStore } from "../store";
import type { Stratum } from "../model";

function StratumRow({ stratum }: { stratum: Stratum }) {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<"topElev" | "bottomElev">("bottomElev");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const pending = state.revisions.find(
    (r) => r.stratumId === stratum.id && r.status === "proposed",
  );

  return (
    <div className={`stratum-row ${stratum.confirmed ? "confirmed" : ""}`}>
      <div className="stratum-head">
        <strong>{stratum.code}</strong>
        <span className="soil">{stratum.soil}</span>
        {stratum.confirmed ? (
          <span className="tag tag-lock" title="领队确认，不可直接改">领队已确认 🔒</span>
        ) : (
          <span className="tag tag-open">未确认</span>
        )}
        {pending && <span className="tag tag-rev">修订待裁定 {pending.id}</span>}
      </div>
      <div className="stratum-elev">
        <span>顶 <b>{stratum.topElev.toFixed(2)}</b>m</span>
        <span className="arrow">→</span>
        <span>底 <b>{stratum.bottomElev.toFixed(2)}</b>m</span>
        <span className="thick">厚 {(stratum.topElev - stratum.bottomElev).toFixed(2)}m</span>
        {state.role === "field" && stratum.confirmed && (
          <button className="mini" onClick={() => setOpen((v) => !v)}>
            {open ? "收起" : "补观察·提修订"}
          </button>
        )}
      </div>
      {open && (
        <div className="rev-inline">
          <p className="explain">确认层不能直接改高程：现场补一条观察并生成新修订，领队裁定后才生效。</p>
          <div className="rev-form">
            <select value={field} onChange={(e) => setField(e.target.value as typeof field)}>
              <option value="topElev">顶界高程</option>
              <option value="bottomElev">底界高程</option>
            </select>
            <input
              type="number"
              step="0.01"
              placeholder="修订高程 m，如 101.30"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <input
              placeholder="现场补观察：剖面/钻探依据"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              className="primary-action"
              disabled={!value || !note}
              onClick={() => {
                dispatch({
                  type: "PROPOSE_REVISION",
                  stratumId: stratum.id,
                  field,
                  proposedValue: Number(value),
                  note,
                });
                setValue("");
                setNote("");
                setOpen(false);
              }}
            >
              提交修订
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Trenches() {
  const { state } = useStore();
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>本探方编号体系保留</p>
          <h2>探方地层簿</h2>
        </div>
        <span className="hint">各探方自编地层号、自记顶底高程；跨方对应关系在下方接界表里关联</span>
      </div>
      <div className="trench-grid">
        {state.trenches.map((t) => (
          <article key={t.id} className="trench-card">
            <header>
              <h3>{t.name}</h3>
              <span className={`net-dot ${state.online[t.id] ? "on" : "off"}`}>
                {state.online[t.id] ? "在线" : "断网"}
              </span>
            </header>
            <div className="stratum-list">
              {state.strata
                .filter((s) => s.trenchId === t.id)
                .map((s) => (
                  <StratumRow key={s.id} stratum={s} />
                ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
