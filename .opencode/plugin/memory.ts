import type { Plugin } from "@opencode-ai/plugin"
import { join } from "node:path"
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs"

export default (async ({ project, directory, $ }) => {
  const memoryDir = project || directory
  const memoryFile = join(memoryDir, "AGENTS.md")
  const logDir = join(memoryDir, ".opencode")
  const logFile = join(logDir, "memory-log.json")

  function readLog(): unknown[] {
    try {
      return JSON.parse(readFileSync(logFile, "utf8"))
    } catch {
      return []
    }
  }

  return {
    "chat.message": async (input) => {
      const msg = input as { role?: string; info?: { parts?: { text?: string }[] } }
      if (msg?.role !== "assistant") return

      const text = (msg?.info?.parts ?? [])
        .map((p: { text?: string }) => p.text ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
      if (!text) return

      const stamp = new Date().toISOString()
      const snippet = text.length > 160 ? text.slice(0, 160) + "…" : text

      try {
        appendFileSync(memoryFile, `- [${stamp}] ${snippet}\n`, "utf8")
      } catch {
        // memory must never crash the session
      }

      try {
        if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true })
        const entries = readLog()
        entries.push({ at: stamp, role: "assistant", snippet, length: text.length })
        writeFileSync(logFile, JSON.stringify(entries, null, 2), "utf8")
      } catch {
        // ignore
      }
    },
  }
}) satisfies Plugin
