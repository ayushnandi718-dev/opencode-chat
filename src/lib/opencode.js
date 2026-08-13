const baseUrl = window.opencodeDesktop?.serverUrl ?? "http://127.0.0.1:4096"

async function request(url, options = {}) {
  const res = await fetch(`${baseUrl}${url}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`opencode API ${res.status} ${url}: ${body}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  health: () => request("/global/health"),
  agents: () => request("/agent"),
  providers: () => request("/provider"),
  listSessions: () => request("/session"),
  getMessages: (id) => request(`/session/${encodeURIComponent(id)}/message`),
  createSession: (title) =>
    request("/session", { method: "POST", body: JSON.stringify({ title: title || "New chat" }) }),
  deleteSession: (id) => request(`/session/${encodeURIComponent(id)}`, { method: "DELETE" }),
  promptAsync: (id, text, agent, model) =>
    request(`/session/${encodeURIComponent(id)}/prompt_async`, {
      method: "POST",
      body: JSON.stringify({
        parts: [{ type: "text", text }],
        ...(agent ? { agent } : {}),
        ...(model?.providerID && model?.modelID ? { model } : {}),
      }),
    }),
  abort: (id) => request(`/session/${encodeURIComponent(id)}/abort`, { method: "POST" }),
}

export function subscribeEvents(onEvent, onError) {
  const controller = new AbortController()

  async function run() {
    const res = await fetch(`${baseUrl}/event`, { signal: controller.signal })
    if (!res.ok || !res.body) throw new Error(`event stream ${res.status}`)
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let idx
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        let eventName = null
        let data = ""
        for (const line of raw.split("\n")) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim()
          else if (line.startsWith("data:")) data += line.slice(5).trim()
        }
        if (!data) continue
        let parsed
        try {
          parsed = JSON.parse(data)
        } catch {
          continue
        }
        const type = parsed.type || parsed.event || eventName
        const props = parsed.properties || {}
        try {
          onEvent(type, props)
        } catch (err) {
          console.error("event handler:", err)
        }
      }
    }
  }

  run().catch((err) => {
    if (!controller.signal.aborted) onError?.(err)
  })

  return () => controller.abort()
}
