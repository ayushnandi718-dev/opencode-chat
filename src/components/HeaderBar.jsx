const THEMES = [
  { id: "cyan", label: "CYAN" },
  { id: "amber", label: "AMBER" },
  { id: "phosphor", label: "PHOSPHOR" },
  { id: "violet", label: "VIOLET" },
]

export default function HeaderBar({ connected, theme, onTheme, onNew }) {
  return (
    <header className="headerbar">
      <div className="header-start">
        <button className="btn suggested" onClick={onNew}>
          New chat
        </button>
      </div>
      <div className="header-title">OpenCode Chat</div>
      <div className="header-end">
        <span className="sys-readout">
          SYS <b>{connected ? "ONLINE" : "OFFLINE"}</b>
        </span>
        <span
          className={`status-dot ${connected ? "ok" : "err"}`}
          title={connected ? "Connected to opencode server" : "opencode server offline"}
        />
        <select
          className="theme-select"
          value={theme}
          onChange={(e) => onTheme(e.target.value)}
          title="Switch theme"
        >
          {THEMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
    </header>
  )
}
