import { useCallback, useEffect, useRef, useState } from "react"
import { api, subscribeEvents } from "./lib/opencode"
import HeaderBar from "./components/HeaderBar"
import Sidebar from "./components/Sidebar"
import ChatView from "./components/ChatView"
import bgVideo from "../iron-man-hud.1920x1080.mp4"

function upsertPart(messages, messageId, part) {
  const idx = messages.findIndex((m) => m.id === messageId)
  if (idx === -1) {
    return [...messages, { id: messageId, role: "assistant", time: Date.now(), parts: [part] }]
  }
  const next = [...messages]
  const msg = next[idx]
  const pi = msg.parts.findIndex((p) => p.id === part.id)
  let parts
  if (pi === -1) {
    parts = [...msg.parts, part]
  } else {
    parts = [...msg.parts]
    parts[pi] = part
  }
  next[idx] = { ...msg, parts }
  return next
}

function buildModelList(providers) {
  const connected = providers.connected || []
  const out = []
  for (const p of providers.all || []) {
    if (!connected.includes(p.id)) continue
    const models = p.models || {}
    const def = providers.default?.[p.id]
    const keys = Object.keys(models)
    const ordered = def ? [def, ...keys.filter((k) => k !== def)] : keys
    for (const key of ordered.slice(0, 20)) {
      const m = models[key]
      const modelID = m?.id || key
      out.push({ providerID: p.id, modelID, label: m?.name || modelID })
    }
  }
  return out
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "cyan")
  const [connected, setConnected] = useState(false)
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [busy, setBusy] = useState(false)
  const [agents, setAgents] = useState([])
  const [agent, setAgent] = useState(null)
  const [models, setModels] = useState([])
  const [model, setModel] = useState(null)

  const activeRef = useRef(activeId)
  const busyTimer = useRef(null)
  const pendingUser = useRef(null)

  useEffect(() => {
    activeRef.current = activeId
  }, [activeId])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem("theme", theme)
  }, [theme])

  const loadSessions = useCallback(async () => {
    try {
      setSessions(await api.listSessions())
    } catch (err) {
      console.error("list sessions:", err)
    }
  }, [])

  const loadMessages = useCallback(async (id) => {
    try {
      const list = await api.getMessages(id)
      setMessages(
        list.map(({ info, parts }) => ({
          id: info.id,
          role: info.role,
          time: info.time?.created ?? Date.now(),
          parts,
        }))
      )
    } catch (err) {
      console.error("get messages:", err)
    }
  }, [])

  const openSession = useCallback(
    (id) => {
      setActiveId(id)
      setMessages([])
      setBusy(false)
      loadMessages(id)
    },
    [loadMessages]
  )

  const newSession = useCallback(async () => {
    try {
      const s = await api.createSession("New chat")
      setSessions((prev) => [s, ...prev])
      openSession(s.id)
    } catch (err) {
      console.error("create session:", err)
    }
  }, [openSession])

  const deleteSession = useCallback(
    async (id) => {
      try {
        await api.deleteSession(id)
        setSessions((prev) => prev.filter((s) => s.id !== id))
        if (activeId === id) {
          setActiveId(null)
          setMessages([])
          setBusy(false)
        }
      } catch (err) {
        console.error("delete session:", err)
      }
    },
    [activeId]
  )

  useEffect(() => {
    api.agents().then(setAgents).catch(console.error)
    loadSessions()
    api
      .providers()
      .then((providers) => {
        const list = buildModelList(providers)
        setModels(list)
        const pref =
          list.find((m) => m.providerID === "opencode" && m.modelID === "big-pickle") ||
          list.find((m) => m.providerID === "opencode") ||
          list[0]
        setModel(pref || null)
      })
      .catch(console.error)
  }, [loadSessions])

  const resetBusyTimer = useCallback(() => {
    clearTimeout(busyTimer.current)
    busyTimer.current = setTimeout(() => setBusy(false), 120000)
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeEvents(
      (type, props) => {
        const sid = props.sessionID
        if (sid === activeRef.current && (type === "message.part.updated" || type === "message.updated")) {
          resetBusyTimer()
        }
        switch (type) {
          case "session.created":
            loadSessions()
            break
          case "session.updated":
            if (props.info?.title) loadSessions()
            break
          case "session.idle":
            if (sid === activeRef.current) {
              setBusy(false)
              loadMessages(sid)
            }
            loadSessions()
            break
          case "message.part.updated": {
            if (sid !== activeRef.current) break
            const part = props.part
            const mid = part?.messageID || props.messageID
            if (!part || !mid) break
            setMessages((prev) => {
              const pending = pendingUser.current
              if (pending && mid !== pending.id && part.type === "text" && pending.parts.some((p) => p.type === "text" && p.text === part.text)) {
                pendingUser.current = null
                const realIdx = prev.findIndex((m) => m.id === mid)
                if (realIdx !== -1) {
                  return prev
                    .filter((m) => m.id !== pending.id)
                    .map((m) => (m.id === mid ? { ...m, role: "user", parts: [part] } : m))
                }
                const localIdx = prev.findIndex((m) => m.id === pending.id)
                if (localIdx !== -1) {
                  const next = [...prev]
                  next[localIdx] = { ...pending, id: mid, parts: [part] }
                  return next
                }
              }
              return upsertPart(prev, mid, part)
            })
            break
          }
          case "message.updated": {
            if (sid !== activeRef.current) break
            const info = props.info
            if (!info) break
            setMessages((prev) => {
              const idx = prev.findIndex((m) => m.id === info.id)
              if (idx === -1) {
                return [
                  ...prev,
                  { id: info.id, role: info.role, time: info.time?.created ?? Date.now(), parts: [] },
                ]
              }
              const next = [...prev]
              next[idx] = { ...next[idx], id: info.id, role: info.role, time: info.time?.created ?? next[idx].time }
              return next
            })
            break
          }
        }
      },
      (err) => console.error("event stream:", err)
    )
    return unsubscribe
  }, [loadMessages, loadSessions, resetBusyTimer])

  useEffect(() => {
    let alive = true
    const poll = async () => {
      try {
        const h = await api.health()
        if (alive) setConnected(Boolean(h?.healthy))
      } catch {
        if (alive) setConnected(false)
      }
    }
    poll()
    const t = setInterval(poll, 5000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  const send = useCallback(
    async (text) => {
      const trimmed = text.trim()
      if (!activeId || !trimmed) return
      const rememberMatch = trimmed.match(/^remember[\s_:\-]+(.+)/i)
      if (rememberMatch) {
        const memory = rememberMatch[1].trim()
        setMessages((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}`,
            role: "user",
            time: Date.now(),
            parts: [{ type: "text", text: trimmed }],
          },
          {
            id: `sys-${Date.now()}`,
            role: "assistant",
            time: Date.now(),
            parts: [{ type: "text", text: `Remembered: ${memory}` }],
          },
        ])
        try {
          const res = await window.opencodeDesktop?.saveMemory?.(memory)
          console.log("memory saved:", res)
        } catch (err) {
          console.error("save memory:", err)
        }
        return
      }
      if (busy) return
      const pending = {
        id: `local-${Date.now()}`,
        role: "user",
        time: Date.now(),
        parts: [{ type: "text", text: trimmed }],
      }
      pendingUser.current = pending
      setMessages((prev) => [...prev, pending])
      setBusy(true)
      resetBusyTimer()
      try {
        await api.promptAsync(activeId, trimmed, agent, model)
      } catch (err) {
        console.error("prompt:", err)
        setBusy(false)
      }
    },
    [activeId, busy, agent, model, resetBusyTimer]
  )

  const stop = useCallback(async () => {
    if (!activeId) return
    setBusy(false)
    try {
      await api.abort(activeId)
      loadMessages(activeId)
    } catch (err) {
      console.error("abort:", err)
    }
  }, [activeId, loadMessages])

  return (
    <>
      <video
        className="bg-video"
        src={bgVideo}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      <div className="app">
      <HeaderBar connected={connected} theme={theme} onTheme={setTheme} onNew={newSession} />
      <div className="app-body">
        <Sidebar
          sessions={sessions}
          activeId={activeId}
          onSelect={openSession}
          onNew={newSession}
          onDelete={deleteSession}
        />
        <ChatView
          activeId={activeId}
          messages={messages}
          busy={busy}
          onSend={send}
          onStop={stop}
          onNew={newSession}
          agents={agents}
          agent={agent}
          onAgent={setAgent}
          models={models}
          model={model}
          onModel={setModel}
        />
      </div>
      </div>
    </>
  )
}
