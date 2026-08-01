# Continuous Ping (-t) + Stop Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add continuous ping buttons (`ping -t`, `ping .250 -t`) to the main window and a Stop button in command popup headers that kills the running command without closing the window.

**Architecture:** Backend tracks spawned child PIDs in Tauri-managed shared state (`PidMap`); a new `stop_command_stream(id)` command kills the PID's process tree via `taskkill /F /T`. Frontend: `useCommandStream` exposes `stop()`, `CommandView` shows a Detener button while loading, ping rows split into main button + `∞` badge.

**Tech Stack:** Rust (tauri v2, tokio), React 19 + TypeScript strict, Tailwind v4 + daisyUI v5.

## Global Constraints

- No test framework on frontend — frontend verification is `npm run build` (tsc strict + vite). Rust verification is `cargo test --lib`.
- `noUnusedLocals`/`noUnusedParameters` on — unused vars/params fail the build.
- Windows-only behavior. All spawned processes must keep `CREATE_NO_WINDOW` (`0x08000000`) so no console window ever appears.
- `taskkill.exe` is a Windows built-in; `/F` force-kill, `/T` kills the whole process tree (cmd.exe parent + ping.exe child).
- No new crates, no new npm packages.
- PowerShell 5.1 shell: use `;` and `if ($?)`, never `&&`.

---

### Task 1: Rust backend — PID registry + `stop_command_stream`

**Files:**
- Modify: `src-tauri/src/lib.rs` (imports, `run_command_stream`, new `stop_command_stream`, `run()` setup + handler registration)
- Test: `src-tauri/src/lib.rs` (`#[cfg(test)] mod tests`)

**Interfaces:**
- Consumes: existing `spawn_cmd`, `stream_output`, `CREATE_NO_WINDOW`, `StreamDonePayload`.
- Produces:
  - `type PidMap = Arc<std::sync::Mutex<HashMap<String, u32>>>` (shared Tauri state)
  - `fn kill_process_tree(pid: u32) -> std::io::Result<std::process::ExitStatus>` — taskkill helper, used by command and test
  - `#[tauri::command] async fn stop_command_stream(state: tauri::State<'_, PidMap>, id: String) -> Result<(), String>`
  - `run_command_stream` gains a `state: tauri::State<'_, PidMap>` param, registers PID on spawn, removes on completion

- [ ] **Step 1: Write the failing test**

Add to the `mod tests` block in `src-tauri/src/lib.rs`:

```rust
    #[tokio::test]
    async fn kill_process_tree_terminates_infinite_ping() {
        let mut child = spawn_cmd("ping -t 127.0.0.1").expect("cmd must spawn");
        let pid = child.id().expect("pid must exist");

        let kill_status = kill_process_tree(pid).expect("taskkill must run");
        assert!(kill_status.success(), "taskkill must exit 0");

        let status = child.wait().await.expect("wait must succeed");
        assert!(!status.success(), "killed process must not exit successfully");
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --lib kill_process_tree_terminates_infinite_ping`
Expected: FAIL — `kill_process_tree` not defined.

- [ ] **Step 3: Add imports and the PID registry type**

At the top of `src-tauri/src/lib.rs`, after the existing imports:

```rust
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
```

After the `CREATE_NO_WINDOW` constant, add:

```rust
type PidMap = Arc<Mutex<HashMap<String, u32>>>;

fn kill_process_tree(pid: u32) -> std::io::Result<std::process::ExitStatus> {
    StdCommand::new("taskkill")
        .creation_flags(CREATE_NO_WINDOW)
        .args(["/F", "/T", "/PID", &pid.to_string()])
        .spawn()?
        .wait()
}
```

- [ ] **Step 4: Register PID in `run_command_stream`**

Change the signature of `run_command_stream` to accept the state and register the PID right after spawn:

```rust
#[tauri::command]
async fn run_command_stream(
    window: tauri::Window,
    state: tauri::State<'_, PidMap>,
    id: String,
    command: String,
) -> Result<(), String> {
    let mut child = spawn_cmd(&command).map_err(|e| format!("Failed to spawn: {}", e))?;

    if let Some(pid) = child.id() {
        state.0.lock().unwrap().insert(id.clone(), pid);
    }
```

Immediately before the final `window.emit("command-done", ...)` block (after `child.wait().await`), remove the PID:

```rust
    state.0.lock().unwrap().remove(&id);

    let _ = window.emit(
```

- [ ] **Step 5: Add `stop_command_stream` command**

After `run_command_stream` (before `run_msra_offer`), add:

```rust
#[tauri::command]
async fn stop_command_stream(
    state: tauri::State<'_, PidMap>,
    id: String,
) -> Result<(), String> {
    let pid = state.0.lock().unwrap().remove(&id);
    if let Some(pid) = pid {
        kill_process_tree(pid).map_err(|e| format!("Failed to kill process: {}", e))?;
    }
    Ok(())
}
```

- [ ] **Step 6: Manage state + register handler**

In `run()`, inside `.setup(|app| { ... })` as the first line, add:

```rust
            app.manage(Arc::new(Mutex::new(HashMap::<String, u32>::new())));
```

Update the invoke handler to include the new command:

```rust
        .invoke_handler(tauri::generate_handler![
            run_command_stream,
            stop_command_stream,
            run_msra_offer
        ])
```

- [ ] **Step 7: Run all tests**

Run: `cargo test --lib`
Expected: 4 tests PASS (3 existing + 1 new). The `ping -t` process is killed inside the test, so it cannot hang.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add stop_command_stream backend command with PID registry"
```

---

### Task 2: `useCommandStream` — expose `stop()`

**Files:**
- Modify: `src/hooks/useCommandStream.ts`

**Interfaces:**
- Consumes: `invoke` from `@tauri-apps/api/core`; existing `execute`, `loading`, `lines`, `exitCode`, `error`.
- Produces: `stop: () => Promise<void>` — returns immediately if no active run id; clears `runIdRef` on completion/error.

- [ ] **Step 1: Add run-id ref**

After the existing `mountedRef` declaration (line ~12), add:

```ts
  const runIdRef = useRef<string | null>(null);
```

- [ ] **Step 2: Set the ref when a run starts**

In `execute`, right after the `runId` is built (line ~31), add:

```ts
    runIdRef.current = runId;
```

- [ ] **Step 3: Clear the ref on completion**

In the `command-done` listener, alongside `setLoading(false)`:

```ts
        runIdRef.current = null;
```

In the `catch` block, after `setLoading(false)`:

```ts
        runIdRef.current = null;
```

- [ ] **Step 4: Add `stop` callback**

After `execute`, add:

```ts
  const stop = useCallback(async () => {
    const id = runIdRef.current;
    if (!id) return;
    await invoke("stop_command_stream", { id });
  }, []);
```

- [ ] **Step 5: Return `stop`**

Update the return statement:

```ts
  return { execute, stop, loading, lines, exitCode, error };
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: tsc + vite succeed, no unused-var errors.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useCommandStream.ts
git commit -m "feat: expose stop() from useCommandStream"
```

---

### Task 3: Main window — new action types + split ping buttons

**Files:**
- Modify: `src/App.tsx` (`ActionType`, `actionConfig`, grid)

**Interfaces:**
- Consumes: existing `openWindow`, `routerIp`, `classifyIpInput`, `hostEnabled`.
- Produces: two new `ActionType` values `"ping-t"` and `"router-t"`; `actionConfig` handles them; grid renders two-button ping cells.

- [ ] **Step 1: Extend `ActionType`**

```ts
type ActionType = "ping" | "router" | "ping-t" | "router-t" | "nslookup" | "nettime" | "netuser";
```

- [ ] **Step 2: Add `actionConfig` cases**

After the `router` case:

```ts
    case "ping-t":
      return { type: "ping" as const, title: `Ping continuo — ${hostname}`, command: `ping -t ${hostname}` };
    case "router-t":
      return { type: "ping" as const, title: `Ping continuo Router — ${routerIp(hostname)}`, command: `ping -t ${routerIp(hostname)}` };
```

- [ ] **Step 3: Split the ping row in the grid**

Replace the two single buttons (`ping` and `ping .250`) with wrapper divs. Keep the existing nslookup/net time buttons untouched. Final grid:

```tsx
      <div className="grid grid-cols-2 gap-1 grow *:h-full">
        <div className="flex gap-1 *:h-full">
          <button
            onClick={() => openWindow("ping")}
            disabled={!hostEnabled}
            className="btn btn-primary btn-sm flex-1"
          >
            ping
          </button>
          <button
            onClick={() => openWindow("ping-t")}
            disabled={!hostEnabled}
            className="btn btn-primary btn-sm btn-outline shrink-0 px-2"
            title="Ping continuo"
          >
            ∞
          </button>
        </div>
        <div className="flex gap-1 *:h-full">
          <button
            onClick={() => openWindow("router")}
            disabled={!hostEnabled}
            className="btn btn-secondary btn-sm flex-1"
          >
            ping .250
          </button>
          <button
            onClick={() => openWindow("router-t")}
            disabled={!hostEnabled}
            className="btn btn-secondary btn-sm btn-outline shrink-0 px-2"
            title="Ping continuo"
          >
            ∞
          </button>
        </div>
        <button
          onClick={() => openWindow("nslookup")}
          disabled={!hostEnabled}
          className="btn btn-accent btn-sm"
        >
          nslookup
        </button>
        <button
          onClick={() => openWindow("nettime")}
          disabled={!hostEnabled}
          className="btn btn-neutral btn-sm"
        >
          net time
        </button>
      </div>
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: tsc + vite succeed.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add continuous ping (-t) buttons to main window"
```

---

### Task 4: Command popup — live ping bars + Detener button

**Files:**
- Modify: `src/CommandView.tsx`

**Interfaces:**
- Consumes: `stop` from `useCommandStream` (Task 2).
- Produces: stop button visible while `loading`; ping bars render live during continuous pings.

- [ ] **Step 1: Destructure `stop`**

```ts
  const { execute, stop, loading, lines, exitCode, error } = useCommandStream();
```

- [ ] **Step 2: Add Detener button to the header**

In the header button container (before the Copiar button), add:

```tsx
          {loading && (
            <button
              onClick={stop}
              className="btn btn-error btn-xs"
              aria-label="Detener comando"
            >
              Detener
            </button>
          )}
```

- [ ] **Step 3: Render ping bars live**

Change the ping-bars render condition from:

```tsx
      {type === "ping" && !loading && results.length > 0 && (
```

to:

```tsx
      {type === "ping" && results.length > 0 && (
```

Leave the text-type condition (`type === "text" && !loading`) and the "Sin resultados" branch (`!loading && ... exitCode !== null`) unchanged.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: tsc + vite succeed.

- [ ] **Step 5: Manual smoke test**

Run: `npm run tauri dev`
Expected:
1. Main window grid shows `[ping][∞]` and `[ping .250][∞]` cells.
2. Click `∞` next to ping → popup opens, ping bars stream live, header shows `[Detener][Copiar][✕]`.
3. Click Detener → bars freeze, output preserved, window stays open, no console window flashes.
4. Regular `ping` and `ping .250` still auto-complete and show bars + `exit 0`.
5. Quick commands (nslookup, net time) unaffected.

- [ ] **Step 6: Commit**

```bash
git add src/CommandView.tsx
git commit -m "feat: add stop button and live ping bars to command popup"
```

---

## Self-Review

**Spec coverage:**
- Split buttons with ∞ badge (spec §2) → Task 3 Step 3.
- New action types + actionConfig (spec §1) → Task 3 Steps 1-2.
- PidMap state + registration + stop command (spec §3-4) → Task 1.
- Kill → completion flow (spec §4) → Task 1 (taskkill /T), unchanged command-done payload.
- `stop()` in useCommandStream (spec §5) → Task 2.
- Live ping bars (spec §6) → Task 4 Step 3.
- Stop button header (spec §7) → Task 4 Step 2.
- Verification (§Verification) → Task 1 Step 7 (cargo), Tasks 2-4 build, Task 4 Step 5 manual.

**Placeholder scan:** No TBD/TODO; every code step has real code.

**Type consistency:** `stop_command_stream` name consistent between Task 1 (Rust command) and Task 2 (invoke). `kill_process_tree` same name in Task 1 Step 1 (test) and Step 3 (impl). `stop` return shape consistent across Tasks 2 and 4. Action types `ping-t`/`router-t` used identically in Task 3 Steps 1-3.
