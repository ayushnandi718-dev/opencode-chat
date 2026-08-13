# OpenCode Chat

A GNOME/Adwaita-style desktop chat UI for [OpenCode](https://opencode.ai) agents, built with Electron, Vite and React.

![Electron](https://img.shields.io/badge/Electron-43-47848F) ![React](https://img.shields.io/badge/React-19-61DAFB) ![Vite](https://img.shields.io/badge/Vite-8-646CFF)

## Features

- Clean GNOME/Adwaita look with a light cyan accent theme
- Sidebar with your chat sessions
- Agent and model pickers right in the composer
- Rendered markdown replies (GFM) with tool-call chips
- Typing indicator while the agent responds
- Dark theme support

## Requirements

- **Windows 10/11** (the prebuilt installer is Windows-only)
- [OpenCode CLI](https://opencode.ai) installed and available on your `PATH` — the app talks to it via its local SDK/API

## Install (Windows)

1. Go to the [Releases page](https://github.com/ayushnandi718-dev/opencode-chat/releases)
2. Download `OpenCode-Chat-Setup-0.1.0.exe`
3. Run the installer and launch **OpenCode Chat**

The installer is unsigned — Windows SmartScreen may show a warning. Click **More info → Run anyway**.

## Build from source

```bash
npm install
npm run dev        # run in development (Vite + Electron)
npm run dist       # build the Windows installer into release/
```

## Usage

Pick an agent and model in the composer, type your message, and press Enter. The reply streams in as markdown. Use the sidebar to manage sessions and the header buttons for new chats or stopping a running agent.

## Troubleshooting

- **"Agent not found / connection error"**: make sure `opencode` is installed and on your `PATH`, then restart the app.
- **Windows shows an unknown publisher warning**: the app is unsigned; this is expected.

## License

MIT
