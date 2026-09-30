import "./styles.css";
import { StoreProvider } from "./store";
import { Header } from "./components/Header";
import { Trenches } from "./components/Trenches";
import { Links } from "./components/Links";
import { Units } from "./components/Units";
import { Revisions } from "./components/Revisions";
import { Sync } from "./components/Sync";
import { LogPanel } from "./components/Log";

function App() {
  return (
    <StoreProvider>
      <main className="app-shell">
        <Header />
        <section className="workflow-strip panel">
          <ol>
            <li><b>① 各编各号</b><span>探方保留本地层号与顶底高程</span></li>
            <li><b>② 接界挂联</b><span>高差 &gt; 2cm 自动待复核</span></li>
            <li><b>③ 单位不拆</b><span>跨方遗迹两侧留观察点、同属一单位</span></li>
            <li><b>④ 复核留档</b><span>原观察／出土物不动，状态立即重算</span></li>
            <li><b>⑤ 确认层走修订</b><span>现场补观察，领队裁定后生效</span></li>
            <li><b>⑥ 断网合并</b><span>观察点幂等，失败批次单独重试</span></li>
          </ol>
        </section>
        <Trenches />
        <div className="spacer" />
        <Links />
        <div className="spacer" />
        <Units />
        <div className="spacer" />
        <Sync />
        <div className="spacer" />
        <Revisions />
        <div className="spacer" />
        <LogPanel />
        <footer className="page-foot">
          hxwl-10 跨探方关系校核台 · React + Vite + TypeScript · 演示数据含 1 条超差接界与 1 处疑似归错层
        </footer>
      </main>
    </StoreProvider>
  );
}

export default App;
