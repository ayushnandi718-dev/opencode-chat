const { app, BrowserWindow, dialog, ipcMain } = require("electron")
const { spawn, exec } = require("child_process")
const http = require("http")
const path = require("path")
const fs = require("fs")

const OPENCODE_PORT = 4096
const UI_PORT = 5173
const UI_ORIGIN = `http://localhost:${UI_PORT}`
const SERVER_URL = `http://127.0.0.1:${OPENCODE_PORT}`

let opencodeProcess = null
let staticServer = null
let mainWindow = null

function log(prefix, msg) {
  console.log(`[${prefix}] ${msg}`)
}

function spawnOpencodeServer() {
  const args = [
    "serve",
    "--port", String(OPENCODE_PORT),
    "--hostname", "127.0.0.1",
    "--cors", UI_ORIGIN,
  ]
  log("opencode", `spawning: opencode ${args.join(" ")}`)
  opencodeProcess = spawn("opencode", args, { shell: process.platform === "win32" })
  opencodeProcess.stdout.on("data", (d) => log("opencode", d.toString().trim()))
  opencodeProcess.stderr.on("data", (d) => log("opencode", d.toString().trim()))
  opencodeProcess.on("exit", (code, signal) => {
    log("opencode", `server exited (code=${code} signal=${signal})`)
    opencodeProcess = null
  })
}

function killOpencodeServer() {
  if (!opencodeProcess) return
  const pid = opencodeProcess.pid
  opencodeProcess = null
  if (process.platform === "win32") {
    exec(`taskkill /pid ${pid} /T /F`, () => {})
  } else {
    try { opencodeProcess.kill("SIGTERM") } catch {}
  }
}

function waitForHealth(timeoutMs = 30000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      fetch(`${SERVER_URL}/global/health`)
        .then((r) => r.json())
        .then((j) => {
          if (j.healthy) resolve()
          else throw new Error("unhealthy")
        })
        .catch((err) => {
          if (Date.now() - start > timeoutMs) {
            reject(new Error(`opencode server did not become healthy: ${err.message}`))
          } else {
            setTimeout(tick, 300)
          }
        })
    }
    tick()
  })
}

async function ensureServer() {
  try {
    const r = await fetch(`${SERVER_URL}/global/health`)
    const j = await r.json()
    if (j.healthy) {
      log("opencode", "already running, reusing existing server")
      return
    }
  } catch {}
  spawnOpencodeServer()
  await waitForHealth()
}

function memoryFile() {
  const candidates = [path.join(process.cwd(), "AGENTS.md")]
  if (!app.isPackaged) candidates.unshift(path.join(__dirname, "..", "AGENTS.md"))
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        fs.accessSync(c, fs.constants.W_OK)
        return c
      }
    } catch {}
  }
  return path.join(app.getPath("userData"), "AGENTS.md")
}

ipcMain.handle("memory:save", (event, text) => {
  const memory = String(text || "").trim()
  if (!memory) return { ok: false, error: "empty" }
  const file = memoryFile()
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19)
  const line = `- [${ts}] ${memory}`
  let content = ""
  if (fs.existsSync(file)) content = fs.readFileSync(file, "utf8")
  const marker = "## User memories"
  if (content.includes(marker)) {
    content = content.replace(marker, `${marker}\n${line}`)
  } else {
    content = `${content.trimEnd()}\n\n${marker}\n\n${line}\n`
  }
  fs.writeFileSync(file, content, "utf8")
  log("memory", `saved -> ${file}: ${memory}`)
  return { ok: true, file }
})

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}

function startStaticServer(dir) {
  return new Promise((resolve) => {
    staticServer = http.createServer((req, res) => {
      let urlPath = decodeURIComponent((req.url || "/").split("?")[0])
      if (urlPath === "/") urlPath = "/index.html"
      const filePath = path.join(dir, path.normalize(urlPath))
      if (!filePath.startsWith(path.resolve(dir))) {
        res.writeHead(403)
        res.end("forbidden")
        return
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404)
          res.end("not found")
          return
        }
        res.writeHead(200, { "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream" })
        res.end(data)
      })
    })
    staticServer.listen(UI_PORT, "127.0.0.1", () => {
      log("ui", `serving renderer at ${UI_ORIGIN}`)
      resolve()
    })
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 760,
    minHeight: 520,
    title: "OpenCode Chat",
    backgroundColor: "#242424",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  mainWindow.on("closed", () => { mainWindow = null })
  return mainWindow
}

app.whenReady().then(async () => {
  const devUrl = process.env.VITE_DEV_SERVER_URL

  try {
    await ensureServer()
  } catch (err) {
    dialog.showErrorBox("OpenCode server failed to start", err.message)
  }

  const win = createWindow()

  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    const dist = path.join(__dirname, "..", "dist")
    if (fs.existsSync(path.join(dist, "index.html"))) {
      await startStaticServer(dist)
      win.loadURL(`${UI_ORIGIN}/index.html`)
    } else {
      dialog.showErrorBox("Build missing", "Run `npm run build` before `npm start`, or use `npm run dev`.")
    }
  }
})

app.on("window-all-closed", () => {
  app.quit()
})

app.on("before-quit", () => {
  killOpencodeServer()
  if (staticServer) {
    try { staticServer.close() } catch {}
  }
})

app.on("will-quit", () => {
  killOpencodeServer()
})
