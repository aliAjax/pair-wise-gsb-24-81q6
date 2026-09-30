import { useStore } from "../store";

const TONE_CLASS = {
  info: "log-info",
  ok: "log-ok",
  warn: "log-warn",
  danger: "log-danger",
};

export function LogPanel() {
  const { state } = useStore();
  return (
    <section className="panel log-panel">
      <div className="section-heading">
        <div>
          <p>每一步留痕，统计即时重算</p>
          <h2>校核动态</h2>
        </div>
      </div>
      <ul className="log-list">
        {state.logs.map((log) => (
          <li key={log.id} className={TONE_CLASS[log.tone]}>
            <time>{log.at}</time>
            <span>{log.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
