function timeAgo(ts) {
  if (!ts) return ""
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

export default function Sidebar({ sessions, activeId, onSelect, onNew, onDelete }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <button className="btn flat full" onClick={onNew}>
          New chat
        </button>
      </div>
      <div className="session-list">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`session-row ${s.id === activeId ? "selected" : ""}`}
            onClick={() => onSelect(s.id)}
          >
            <div className="session-title">{s.title || "Untitled"}</div>
            <div className="session-meta">
              <span className="session-time">{timeAgo(s.time?.updated)}</span>
              <button
                className="btn icon-btn small session-delete"
                title="Delete session"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(s.id)
                }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        {sessions.length === 0 && <div className="sidebar-empty">No sessions yet</div>}
      </div>
    </aside>
  )
}
