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

**Entry:** `src/main.tsx` → `App.tsx`
**Components:** `GlobalHeader` (hostname input + "Todo" button), `DiagnosticCard` (reusable, 4 instances: Ping, Net Time, Nslookup, Net User), `MsraCard` (remote assistance launch)
**Rust backend:** 2 Tauri commands — `run_command_stream` (executes `cmd /c <command>`, streams stdout/stderr line-by-line via `command-line` / `command-done` events), `run_msra_offer` (spawns `msra.exe /offerRA <hostname>`)
**IPC pattern:** `invoke("run_command_stream", { id, command })` + `listen("command-line")` / `listen("command-done")`. Each listen returns an `unlisten` function — must call on completion/error to prevent stale listeners.
**Windows-1252:** Rust backend decodes cmd output via `encoding_rs::WINDOWS_1252` — UTF-8 fallback, handles Spanish accented chars.
**Run All:** `GlobalHeader` increments `executeTrigger` counter → all `DiagnosticCard` instances react via `useEffect`.
**Types:** `src/types.ts` mirrors Rust `StreamLinePayload` / `StreamDonePayload` structs.
**Clipboard:** `src/hooks/useClipboard.ts` — `navigator.clipboard.writeText` with `execCommand("copy")` fallback.

## Tailwind CSS v4 + DaisyUI v5

**No `tailwind.config.js` or `postcss.config.js`.** Config entirely in `src/index.css`:
- `@import "tailwindcss"` — Tailwind v4 CSS-first setup
- `@plugin "daisyui"` — DaisyUI v5 plugin directive
- Two custom themes: `mda` (light, default), `mda-dark` (dark). Colors match Portal MDA design system.
- `@theme { --font-sans: "Geist Sans" ...; --font-mono: "Geist Mono" ... }` — custom font tokens

All DaisyUI theme tokens (primary: `#ffc72c`, secondary: `#254888`, accent: `#3a6ea5`) defined in CSS `@plugin "daisyui/theme"` blocks. Do NOT edit via `tailwind.config.js` — edit `index.css`.

## TypeScript

Strict mode. `noUnusedLocals: true`, `noUnusedParameters: true` — unused vars/params produce build errors. `noEmit: true` (Vite handles bundling).

## Tauri config quirks

- **No CSP:** `security.csp: null` — agent modifying security should set explicit CSP.
- **Window:** 700x750, min 420x480.
- **Capabilities:** Only `core:default` and `opener:default` permissions.

## What's NOT configured

No ESLint, no Prettier, no pre-commit hooks, no CI/CD, no test framework.
