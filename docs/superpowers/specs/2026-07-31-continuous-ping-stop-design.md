# Continuous Ping (-t) + Stop Command — Design Spec

**Date:** 2026-07-31
**Status:** approved

## Goal

Add continuous ping buttons (ping `-t` / ping `.250` `-t`) to the main window, and a Stop button in command popup windows that kills the running command process without closing the window. Applies to all current and future commands.

## Approach

Two parts: (1) frontend — new action types + split buttons in the ping rows + a stop button in the popup header; (2) backend — a new Tauri command `stop_command_stream(id)` that kills a running child process by PID via `taskkill /F /T /PID <pid>`, tracked in shared Tauri state.

## Detailed Design

### 1. New action types (`src/App.tsx`)

Extend `ActionType` union: `"ping" | "router" | "ping-t" | "router-t" | "nslookup" | "nettime" | "netuser"`.

`actionConfig` additions:

| Type | title | command | visual type |
|------|-------|---------|-------------|
| `ping-t` | `Ping continuo — <hostname>` | `ping -t <hostname>` | `"ping"` (bars) |
| `router-t` | `Ping continuo Router — <routerIp>` | `ping -t <routerIp>` | `"ping"` (bars) |

### 2. Split buttons (`src/App.tsx` grid)

The first grid row (ping + ping .250) splits into two-button cells:

```
[  ping  ][∞]  [ping .250][∞]
[  nslookup  ]  [  net time  ]
```

- Big button: `flex-1`, existing color/size (`btn btn-primary btn-sm`).
- `∞` badge: `shrink-0`, `btn btn-primary btn-sm btn-outline`, narrow padding (`px-2`), full cell height. Title tooltip: `Ping continuo`.
- Cell wrapper: `flex gap-1 *:h-full`. Grid keeps `grid-cols-2 gap-1 grow *:h-full`.
- The `∞` button calls `openWindow("ping-t")` / `openWindow("router-t")`; `openWindow` already handles classification/suffix/validation for any host-targeted action.

### 3. Backend: process registry (`src-tauri/src/lib.rs`)

**Shared state:** `type PidMap = Arc<std::sync::Mutex<HashMap<String, u32>>>;` managed via `app.manage()` in `.setup()`.

**`run_command_stream`:** after `spawn_cmd`, register PID: `if let Some(pid) = child.id() { state.0.lock().unwrap().insert(id.clone(), pid); }`. On completion (after `child.wait()`), remove: `state.0.lock().unwrap().remove(&id);`. Add `state: tauri::State<'_, PidMap>` parameter.

**New command:**
```rust
#[tauri::command]
async fn stop_command_stream(
    state: tauri::State<'_, PidMap>,
    id: String,
) -> Result<(), String> {
    let pid = state.0.lock().unwrap().remove(&id);
    if let Some(pid) = pid {
        StdCommand::new("taskkill")
            .creation_flags(CREATE_NO_WINDOW)
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .spawn()
            .map_err(|e| format!("Failed to kill: {}", e))?
            .wait()
            .map_err(|e| format!("Kill wait error: {}", e))?;
    }
    Ok(())
}
```

- `/F` force-kill, `/T` kills the whole process tree (cmd.exe parent + ping.exe child).
- `CREATE_NO_WINDOW` — no console flash.
- Missing PID (already finished / unknown id) → no-op, `Ok(())`.

**Registration:** add `stop_command_stream` to `tauri::generate_handler![]`.

### 4. Kill → completion flow

When `stop_command_stream` runs `taskkill /T`:
- Process tree dies → stdout/stderr pipes close → `stream_output` tasks exit normally (`read_until` returns `Ok(0)`).
- `child.wait()` returns the killed status → `command-done` emits with `exit_code` (likely `None`).
- Frontend sees `command-done` → `loading = false`, output preserved, window stays open.

No change to the `command-done` payload or stream events.

### 5. Frontend: `useCommandStream` stop support

Track the current run id in a ref; expose `stop()`. Clear the ref on completion/error so a late `stop()` becomes a no-op:

```ts
const runIdRef = useRef<string | null>(null);

// in execute(), after building runId:
runIdRef.current = runId;

// in command-done handler and catch() block:
runIdRef.current = null;

const stop = useCallback(async () => {
  const id = runIdRef.current;
  if (!id) return;
  await invoke("stop_command_stream", { id });
}, []);
```

Return `{ execute, stop, loading, lines, exitCode, error }`.

### 6. Live ping bars (`src/CommandView.tsx`)

Current ping-bars render condition is `type === "ping" && !loading && results.length > 0` (line ~116). With `ping -t` (infinite), `loading` stays `true` forever, so bars would never render — only the spinner.

**Change:** drop `!loading` from the ping-bars condition → `type === "ping" && results.length > 0`. `parsePingOutput(lines)` runs over the accumulated lines, so bars render live as lines stream in. The `exit {code}` line stays gated on `exitCode !== null` (only after stop/complete).

### 7. Stop button (`src/CommandView.tsx` header)

Header button order: `[Detener] [Copiar] [✕]`.

```tsx
{loading && (
  <button onClick={stop} className="btn btn-error btn-xs">Detener</button>
)}
```

- Visible only while `loading` (command running).
- `btn-error` (red) communicates "stop".
- Kills the command; does NOT close the window. Output preserved.

## Files Changed

| File | Change |
|------|--------|
| `src-tauri/src/lib.rs` | `PidMap` state, PID registration/cleanup in `run_command_stream`, new `stop_command_stream` command, handler registration, `use std::collections::HashMap`, `use std::sync::{Arc, Mutex}` |
| `src/App.tsx` | ActionType union, 2 new actionConfig cases, split ping-row buttons |
| `src/hooks/useCommandStream.ts` | `runIdRef`, `stop()`, updated return type |
| `src/CommandView.tsx` | Stop button in header |
| `src-tauri/capabilities/default.json` | No change (custom commands allowed by default) |

## Dependencies

- `taskkill.exe` — Windows built-in, no install.
- No new crates, no new npm packages.
- `tokio::process` already enabled in Cargo.toml.

## Verification

- `npm run build` passes (tsc strict + vite).
- `cargo test --lib` passes (existing 3 tests).
- Manual (`npm run tauri dev`): open `ping -t` popup → bars stream continuously → click Detener → output freezes, window stays open, no console window. Same for regular ping (stop works during brief run). Main window grid shows split ping row with ∞ badges.
