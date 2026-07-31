# Command Popup Window UX — Design Spec

**Date:** 2026-07-31
**Status:** approved

## Goal

Redesign the command execution popup window header: show the executed command, add a copy-to-clipboard button for the full output, remove the close button, and drop native OS window decorations. Close via Escape key only. Apply to all current and future commands.

## Approach

Single-component change: modify `CommandView.tsx` header + `App.tsx` window creation options. No backend changes.

## Detailed Design

### 1. Window decorations (`App.tsx`)

Set `decorations: false` on every `WebviewWindow` created in `openWindow`. The native OS title bar is removed; the React-rendered header becomes the sole title area.

```ts
const win = new WebviewWindow(`result-${Date.now()}`, {
  url,
  width: 600,
  height: 400,
  title: cfg.title,
  resizable: true,
  decorations: false,
});
```

### 2. Header layout (`CommandView.tsx`)

Replace current header:

```
[✕] Ping a PC01                         ← current
```

With:

```
[📋 Copy]  Ping a PC01                   ← title (text-sm font-semibold)
           ping PC01.correo.local -n 10   ← command (text-xs font-mono truncate)
```

- **Title:** `text-sm font-semibold text-secondary truncate` (unchanged from current)
- **Command:** `text-xs font-mono text-base-content/50 truncate` — shows the raw `command` URL param
- **Copy button:** `btn btn-ghost btn-xs` with "Copiar" text. On click: reads `lines` state (joined with `\n`), writes to clipboard via `writeText()` from `@tauri-apps/plugin-clipboard-manager`. Shows brief visual feedback (e.g., button text changes to "Copiado" for 1.5s).

### 3. Removals

- Remove the ✕ button element and its `onClick={handleClose}`
- Remove the `handleClose` function

### 4. Escape key handler

Add a `useEffect` with `keydown` listener on `window`. On Escape key press, call `getCurrentWebviewWindow().close()`.

```ts
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      getCurrentWebviewWindow().close();
    }
  };
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, []);
```

### 5. Copy feedback

Track a `copied` boolean state. On copy:
- Set `copied = true`, write clipboard
- After 1.5s timeout, set `copied = false`
- Button text: `copied ? "Copiado" : "Copiar"`

### 6. Unchanged

- Loading spinner, error display, ping bars, raw `<pre>` output — all intact
- `useCommandStream` hook — no changes
- Rust backend (`spawn_cmd`, `CREATE_NO_WINDOW`) — no changes
- `actionConfig`, `classifyIpInput`, `pingParser` — no changes
- `tauri.conf.json`, CSP, capabilities — no changes (clipboard permission already present)

## Files Changed

| File | Change |
|------|--------|
| `src/App.tsx:139-145` | Add `decorations: false` to WebviewWindow options |
| `src/CommandView.tsx` | Rewrite header (line 67-72), add Escape listener + copy logic, remove close handler |

## Dependencies

- `@tauri-apps/plugin-clipboard-manager` v2 — already installed and registered:
  - `package.json`: `^2.2.0`
  - `Cargo.toml`: `2.0.0-rc`
  - `capabilities/default.json`: `clipboard-manager:default`
  - `lib.rs`: `app.handle().plugin(tauri_plugin_clipboard_manager::init())?;`
- No new dependencies.

## Verification

- `npm run build` must pass (tsc strict + vite)
- Manual: open any command popup → verify no native title bar, header shows title + command, Escape closes, Copy button copies full output to clipboard
