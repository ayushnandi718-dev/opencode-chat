import { useEffect, useRef, useState } from "react"
import Markdown from "./Markdown"

function MessageBubble({ m }) {
  if (m.role === "user") {
    const text = m.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("\n")
    return (
      <div className="bubble-row user">
        <div className="bubble user-bubble">{text}</div>
      </div>
    )
  }

  const text = m.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n")
  const tools = m.parts.filter((p) => p.type === "tool")

  return (
    <div className="bubble-row assistant">
      <div className="bubble assistant-bubble">
        {tools.map((p, i) => (
          <div key={p.id || i} className="tool-chip">
            <span className={`tool-state ${p.state || "pending"}`} />
            {p.tool || "tool"} {p.state ? `· ${p.state}` : ""}
          </div>
        ))}
        {text ? (
          <Markdown text={text} />
        ) : (
          <span className="muted">{m.parts.length === 0 ? "…" : ""}</span>
        )}
      </div>
    </div>
  )
}

const parseModel = (val) => {
  const [providerID, ...rest] = val.split("::")
  return { providerID, modelID: rest.join("::") }
}

export default function ChatView({
  activeId,
  messages,
  busy,
  onSend,
  onStop,
  onNew,
  agents,
  agent,
  onAgent,
  models,
  model,
  onModel,
}) {
  const [draft, setDraft] = useState("")
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, busy])

  const submit = () => {
    if (!draft.trim()) return
    onSend(draft)
    setDraft("")
  }

  return (
    <main className="chatview">
      {activeId ? (
        <>
          <div className="messages">
            {messages.map((m) => (
              <MessageBubble key={m.id} m={m} />
            ))}
            {busy && (
              <div className="bubble-row assistant">
                <div className="bubble assistant-bubble typing-row">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="composer">
            <select
              className="agent-select"
              value={agent ?? ""}
              onChange={(e) => onAgent(e.target.value)}
              title="Which opencode agent answers"
            >
              {agents.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.name || a.id}
                </option>
              ))}
            </select>
            <select
              className="agent-select model-select"
              value={model ? `${model.providerID}::${model.modelID}` : ""}
              onChange={(e) => onModel(parseModel(e.target.value))}
              title="Model used for replies"
            >
              {models.map((m) => (
                <option key={`${m.providerID}::${m.modelID}`} value={`${m.providerID}::${m.modelID}`}>
                  {m.label}
                </option>
              ))}
            </select>
            <textarea
              className="entry"
              value={draft}
              rows={1}
              placeholder="Ask an opencode agent…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
            />
            {busy ? (
              <button className="btn stop-btn" onClick={onStop} title="Stop generation">
                <svg width="14" height="14" viewBox="0 0 14 14">
                  <rect x="1" y="1" width="12" height="12" rx="2" fill="currentColor" />
                </svg>
              </button>
            ) : (
              <button className="btn suggested send-btn" onClick={submit} disabled={!draft.trim()}>
                Send
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="empty">
          <div className="empty-icon">✺</div>
          <h2>No conversation selected</h2>
          <p>Start a new chat and let an opencode agent answer your questions.</p>
          <button className="btn suggested" onClick={onNew}>
            New chat
          </button>
        </div>
      )}
    </main>
  )
}
