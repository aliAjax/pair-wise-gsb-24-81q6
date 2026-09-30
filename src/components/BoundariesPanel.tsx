import { useState } from "react";
import type { BoundaryLink } from "../types";
import { boundaryById, cm, isLinkPending, linkDelta, linksOfBoundary, stratumById } from "../engine";
import { Locked, PanelProps, Tag } from "./shared";

export function BoundariesPanel({ state, dispatch }: PanelProps) {
  return (
    <section className="panel tall-panel">
      <div className="section-heading">
        <div>
          <p>跨探方接界校核</p>
          <h2>接界地层关联台</h2>
        </div>
        <Tag tone="muted">阈值 2.0 cm，超差自动进待复核</Tag>
      </div>

      <div className="boundary-list">
        {state.boundaries.map((b) => {
          const links = linksOfBoundary(state, b.id);
          const pending = links.filter(isLinkPending).length;
          return (
            <article key={b.id} className="boundary-card">
              <header className="boundary-head">
                <h3>{b.label}</h3>
                {pending > 0 ? <Tag tone="review">{pending} 条待复核</Tag> : <Tag tone="ok">全部对平</Tag>}
              </header>

              {links.map((link) => (
                <LinkRow key={link.id} link={link} state={state} dispatch={dispatch} />
              ))}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function LinkRow({ link, state, dispatch }: { link: BoundaryLink } & PanelProps) {
  const boundary = boundaryById(state, link.boundaryId)!;
  const sa = stratumById(state, link.aStratumId)!;
  const sb = stratumById(state, link.bStratumId)!;
  const pending = isLinkPending(link);
  const deltaCm = linkDelta(link) * 100;
  const [a, setA] = useState(String(link.elevA));
  const [b, setB] = useState(String(link.elevB));

  const save = () => {
    const va = Number(a);
    const vb = Number(b);
    if (Number.isNaN(va) || Number.isNaN(vb)) return;
    dispatch({ type: "updateLink", linkId: link.id, elevA: va, elevB: vb });
  };

  return (
    <div className={`link-row ${pending ? "is-pending" : "is-ok"}`}>
      <div className="link-sides">
        <div className="link-side">
          <span className="muted-text small">{boundary.aSquareId} 本地编号</span>
          <strong>{sa.code}</strong>
        </div>
        <div className="link-vs">↔</div>
        <div className="link-side">
          <span className="muted-text small">{boundary.bSquareId} 本地编号</span>
          <strong>{sb.code}</strong>
        </div>
        <div className="link-delta">
          {pending ? <Tag tone="review">待复核 · 差 {deltaCm.toFixed(1)} cm</Tag> : <Tag tone="ok">已校核 · 差 {deltaCm.toFixed(1)} cm</Tag>}
        </div>
      </div>

      <Locked role={state.role} need={["reviewer"]}>
        <div className="inline-form link-edit">
          <label>
            <span>{boundary.aSquareId} 侧接界线高程</span>
            <input value={a} step="0.001" onChange={(e) => setA(e.target.value)} />
          </label>
          <label>
            <span>{boundary.bSquareId} 侧接界线高程</span>
            <input value={b} step="0.001" onChange={(e) => setB(e.target.value)} />
          </label>
          <button className="primary-action small" onClick={save}>
            更新边界
          </button>
        </div>
      </Locked>

      {link.updates.length > 0 && (
        <div className="history-block">
          <p className="block-label">边界更新留痕（原观测保留，统计即时重算）</p>
          {link.updates.map((u, i) => (
            <p key={i} className="history-row">
              {u.at} · 复核员：{cm(u.elevA)} / {cm(u.elevB)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
