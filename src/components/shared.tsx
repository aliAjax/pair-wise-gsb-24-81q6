import type { Dispatch, ReactNode } from "react";
import type { Action, State } from "../types";
import { ROLE_NAME } from "../store";

export interface PanelProps {
  state: State;
  dispatch: Dispatch<Action>;
}

export function Panel({
  eyebrow,
  title,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Tag({ tone, children }: { tone: "ok" | "review" | "danger" | "muted" | "info"; children: ReactNode }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

export function Locked({ role, need, children }: { role: State["role"]; need: State["role"][]; children: ReactNode }) {
  const allowed = need.includes(role);
  return (
    <div className={allowed ? "" : "locked"} title={`需要${need.map((r) => ROLE_NAME[r]).join("/")}权限`}>
      {children}
      {!allowed && <div className="lock-mask">需{need.map((r) => ROLE_NAME[r]).join("/")}操作</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
