# Correo Argentino MDA Toolkit

Tauri v2 + React 19 + TypeScript + Tailwind CSS v4 + DaisyUI v5. Desktop utility for N1/N2 help desk operators.

## Dev commands

| Command | What |
|---------|------|
| `npm run tauri dev` | Full Tauri dev (Vite + Rust) |
| `npm run tauri build` | Production build |
| `npm run dev` | Vite-only frontend (no Rust IPC) |
| `npm run build` | `tsc && vite build` |

Tauri dev URL: `http://localhost:1420`. HMR port: `1421` (when `TAURI_DEV_HOST` set). Vite `strictPort: true` — fails if port taken.

## Architecture

**Entry:** `src/main.tsx` → reads `?type=` URL param → renders `App` (main) or `CommandView` (popup). Both wrapped in `ErrorBoundary`.

**Main window (`App.tsx`):** hostname input + username input + grid of action buttons. Each button calls `WebviewWindow` to open a separate popup window with command params in URL.

**Popup window (`CommandView.tsx`):** Receives `type`, `title`, `command` from URL. Auto-executes command on mount via `useCommandStream`. Shows structured output (ping bars for ping type, raw text for others).

**Rust backend:** 2 Tauri commands — `run_command_stream` (executes `cmd /c <command>`, streams stdout/stderr line-by-line via `command-line` / `command-done` events, hidden cmd window via `CREATE_NO_WINDOW`), `run_msra_offer` (spawns `msra.exe /offerRA <hostname>`)

**IPC pattern:** `invoke("run_command_stream", { id, command })` + `listen("command-line")` / `listen("command-done")`. Each listen returns an `unlisten` function — must call on completion/error to prevent stale listeners. Events emit to caller window (popup invokes → popup receives events).

**Windows-1252:** Rust backend decodes cmd output via `encoding_rs::WINDOWS_1252` — UTF-8 fallback, handles Spanish accented chars.

**Key hooks:**
- `useCommandStream.ts` — wraps `invoke` + `listen`, returns `{ execute, loading, lines, exitCode, error }`
- Updater hook in `App.tsx` — checks updates on mount via `@tauri-apps/plugin-updater`

**Utility:** `pingParser.ts` — parses Spanish/English ping output into `PingResult[]` with ms and status.

**Error handling:** `ErrorBoundary` catches React render crashes. Status toast in `App.tsx` shows errors from window creation failures.

## Tailwind CSS v4 + DaisyUI v5

**No `tailwind.config.js` or `postcss.config.js`.** Config entirely in `src/index.css`:
- `@import "tailwindcss"` — Tailwind v4 CSS-first setup
- `@plugin "daisyui"` — DaisyUI v5 plugin directive
- Two custom themes: `mda` (light, default), `mda-dark` (dark)
- `@theme { --font-sans: "Geist Sans" ...; --font-mono: "Geist Mono" ... }` — custom font tokens

All DaisyUI theme tokens (primary: `#ffc72c`, secondary: `#254888`, accent: `#3a6ea5`) defined in CSS `@plugin "daisyui/theme"` blocks. Do NOT edit via `tailwind.config.js` — edit `index.css`.

## TypeScript

Strict mode. `noUnusedLocals: true`, `noUnusedParameters: true` — unused vars/params produce build errors. `noEmit: true` (Vite handles bundling).

## Permissions & capabilities

Capabilities in `src-tauri/capabilities/default.json`. Windows matched: `main` + `result-*` (popup windows). Required permissions:
- `core:default` — basic IPC, events, window management
- `core:webview:allow-create-webview-window` — creating popup windows from JS
- `opener:default`, `updater:default` — plugins
- `core:window:allow-close` — close popup windows

Popup windows (`result-*`) have same permissions via wildcard match.

## Tauri config quirks

- **No CSP:** `security.csp: null` — agent modifying security should set explicit CSP.
- **Window:** 360x200, min 360x200, not resizable.
- **CREATE_NO_WINDOW:** `run_command_stream` uses `creation_flags(0x08000000)` on Windows to hide cmd window.
- **Signing:** `createUpdaterArtifacts: false` — no private key configured. Set `TAURI_SIGNING_PRIVATE_KEY` env var to enable.

## What's NOT configured

No ESLint, no Prettier, no pre-commit hooks, no CI/CD, no test framework.
