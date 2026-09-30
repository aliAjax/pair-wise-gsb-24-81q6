import { useState } from "react";
import { pointsOfUnit, strataOfSquare, unitStatus } from "../engine";
import { ROLE_NAME } from "../store";
import { Locked, PanelProps, Tag } from "./shared";

const STATUS_META = {
  ok: { tag: "ok" as const, label: "已校核" },
  review: { tag: "review" as const, label: "待复核" },
  mismatch: { tag: "danger" as const, label: "错层风险" },
};

export function UnitsPanel({ state, dispatch }: PanelProps) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>遗迹单位与跨方观察点</p>
          <h2>一个单位 · 两侧观察点</h2>
        </div>
        <Tag tone="muted">跨接界不拆成两个单位，按归层连通性判态</Tag>
      </div>

      <div className="unit-list">
        {state.units.map((unit) => {
          const points = pointsOfUnit(state, unit.id);
          const squares = [...new Set(points.map((p) => p.squareId))];
          const { status, reason } = unitStatus(state, unit);
          const meta = STATUS_META[status];
          const cross = points.length > 1;
          return (
            <article key={unit.id} className={`unit-card unit-${status}`}>
              <header className="unit-head">
                <div>
                  <h3>
                    {unit.name} <span className="muted-text">{unit.kind}</span>
                    {cross && <Tag tone="info">跨 {squares.join(" / ")} · 单位唯一</Tag>}
                  </h3>
                  <p className="small muted-text">{reason}</p>
                </div>
                <Tag tone={meta.tag}>{meta.label}</Tag>
              </header>

              <div className="point-grid">
                {points.map((p) => {
                  const st = state.strata.find((s) => s.id === p.stratumId)!;
                  return (
                    <div key={p.id} className="point-card">
                      <div className="point-head">
                        <strong>{p.squareId}</strong>
                        <Tag tone="muted">归层 {st.code}</Tag>
                      </div>
                      <p className="small">{p.text}</p>
                      <p className="small muted-text">
                        {p.observer} · {p.at}
                      </p>
                      {p.finds.length > 0 && (
                        <p className="small finds-line">
                          出土物（归此观察点，修正不移动）：
                          {p.finds.map((f) => `${f.name}${f.qty}${f.unit}`).join("，")}
                        </p>
                      )}
                      {p.corrections.length > 0 && (
                        <div className="history-block">
                          {p.corrections.map((c) => {
                            const from = state.strata.find((s) => s.id === c.fromStratumId);
                            const to = state.strata.find((s) => s.id === c.toStratumId);
                            return (
                              <p key={c.id} className="history-row">
                                {c.at} · {ROLE_NAME[c.by]} 归层修正：{from?.code ?? c.fromStratumId} →{" "}
                                {to?.code ?? c.toStratumId}（原观察保留）
                              </p>
                            );
                          })}
                        </div>
                      )}
                      <Locked role={state.role} need={["reviewer"]}>
                        <div className="inline-form tight">
                          <select
                            value={p.stratumId}
                            onChange={(e) =>
                              dispatch({
                                type: "correctPoint",
                                pointId: p.id,
                                toStratumId: e.target.value,
                              })
                            }
                          >
                            {strataOfSquare(state, p.squareId).map((s) => (
                              <option key={s.id} value={s.id}>
                                改归 {s.code}
                              </option>
                            ))}
                          </select>
                        </div>
                      </Locked>
                    </div>
                  );
                })}
              </div>

              <AddPointForm unitId={unit.id} state={state} dispatch={dispatch} />
            </article>
          );
        })}
      </div>
    </section>
  );
}

function AddPointForm({ unitId, state, dispatch }: { unitId: string } & PanelProps) {
  const [squareId, setSquareId] = useState(state.squares[0]?.id ?? "");
  const strata = strataOfSquare(state, squareId);
  const [stratumId, setStratumId] = useState(strata[0]?.id ?? "");
  const [text, setText] = useState("");
  const [findName, setFindName] = useState("");
  const [findQty, setFindQty] = useState("");
  const sq = state.squares.find((s) => s.id === squareId);

  const changeSquare = (id: string) => {
    setSquareId(id);
    setStratumId(strataOfSquare(state, id)[0]?.id ?? "");
  };

  const submit = () => {
    if (!text.trim() || !stratumId) return;
    const q = findQty === "" ? null : Number(findQty);
    dispatch({
      type: "addPoint",
      unitId,
      squareId,
      stratumId,
      text,
      findName,
      findQty: q && q > 0 ? q : null,
    });
    setText("");
    setFindName("");
    setFindQty("");
  };

  return (
    <Locked role={state.role} need={["field"]}>
      <div className="add-point">
        <p className="block-label">在相邻探方补观察点（同一单位；断网探方自动进本机批次）</p>
        <div className="inline-form">
          <label>
            <span>探方</span>
            <select value={squareId} onChange={(e) => changeSquare(e.target.value)}>
              {state.squares.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}{s.online ? "" : "（断网）"}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>本探方归层</span>
            <select value={stratumId} onChange={(e) => setStratumId(e.target.value)}>
              {strata.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}
                </option>
              ))}
            </select>
          </label>
          <label className="grow">
            <span>观察记录</span>
            <input placeholder="现象描述" value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <label>
            <span>出土物</span>
            <input placeholder="名称" value={findName} onChange={(e) => setFindName(e.target.value)} />
          </label>
          <label>
            <span>数量</span>
            <input placeholder="可空" value={findQty} onChange={(e) => setFindQty(e.target.value)} />
          </label>
          <button className="primary-action small" onClick={submit}>
            {sq?.online ? "提交观察点" : "暂存到本机批次"}
          </button>
        </div>
      </div>
    </Locked>
  );
}
