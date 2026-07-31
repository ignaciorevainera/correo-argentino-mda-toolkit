# Hide Console Windows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every process spawned by the app (ping, net user, nslookup, net time, msra) runs with `CREATE_NO_WINDOW` so no cmd/console window ever appears — results appear only in the app's popup window.

**Architecture:** Add `creation_flags(0x08000000)` (`CREATE_NO_WINDOW`) to both process spawn sites in the Rust backend, extracted into one shared helper for the streamed command path. The flag is inheritable, so child processes (ping, net, etc.) spawned by `cmd /c` inherit the no-console state. Popup window + streaming IPC already deliver results to the UI — untouched.

**Tech Stack:** Rust (tauri v2, tokio v1 `process`/`io-util` features), `std::os::windows::process::CommandExt`, `cargo test`. Windows-only (app is Windows-only: `cmd /c`, `msra.exe`, `windows_subsystem`).

## Global Constraints

- Windows target only — existing code already assumes Windows (`cmd /c`, `msra.exe`).
- No new dependencies. Only additive tokio features: `macros`, `rt` (for `#[tokio::test]`).
- Do not touch frontend — `CommandView.tsx` popup already renders results; user requirement is backend-only.
- Do not touch `capabilities/default.json` or CSP.
- Constant value: `0x08000000` (`CREATE_NO_WINDOW`) — verbatim, no other flag value.
- `run_command_stream` must keep streaming stdout/stderr line-by-line with the flag set (pipes + `CREATE_NO_WINDOW` are compatible; regression tests guard this).

---

### Task 1: Hidden spawn helper for streamed commands

**Files:**
- Modify: `src-tauri/Cargo.toml:26`
- Modify: `src-tauri/src/lib.rs:3` (add import), `:63-114` (rewrite spawn block)
- Test: `src-tauri/src/lib.rs` — new `#[cfg(test)] mod tests` at file end

**Interfaces:**
- Consumes: existing `Command` (tokio alias) + `StdCommand` imports.
- Produces:
  - `const CREATE_NO_WINDOW: u32 = 0x08000000;`
  - `fn spawn_cmd(command: &str) -> std::io::Result<tokio::process::Child>` — spawns `cmd /c <command>` with stdout/stderr piped and `CREATE_NO_WINDOW`.
  - `#[cfg(test)] mod tests` with 2 tests.
  - Trait import `use std::os::windows::process::CommandExt;` (enables `.creation_flags()` on `StdCommand`, used by Task 2).

- [ ] **Step 1: Enable tokio test features**

In `src-tauri/Cargo.toml:26`, change:

```toml
tokio = { version = "1", features = ["process", "io-util"] }
```

to:

```toml
tokio = { version = "1", features = ["process", "io-util", "macros", "rt"] }
```

- [ ] **Step 2: Write the failing tests**

Append to `src-tauri/src/lib.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn hidden_cmd_streams_output_through_pipes() {
        let child = spawn_cmd("ping -n 2 127.0.0.1").expect("cmd must spawn");
        let output = child.wait_with_output().await.expect("wait must succeed");
        assert!(output.status.success(), "ping must exit 0");
        assert!(!output.stdout.is_empty(), "ping stdout must still be captured");
    }

    #[tokio::test]
    async fn hidden_std_command_captures_output() {
        let output = StdCommand::new("cmd")
            .creation_flags(CREATE_NO_WINDOW)
            .args(["/c", "echo hidden-ok"])
            .output()
            .expect("cmd must run");
        assert!(output.status.success());
        assert_eq!(String::from_utf8_lossy(&output.stdout).trim(), "hidden-ok");
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run (workdir `src-tauri`): `cargo test`
Expected: FAIL to compile — `spawn_cmd`, `CREATE_NO_WINDOW` undefined. That is the red state.

- [ ] **Step 4: Implement the hidden spawn**

In `src-tauri/src/lib.rs`:

After line 3 (existing imports), add:

```rust
use std::os::windows::process::CommandExt;
```

After `decode_windows_output` (line 31), add:

```rust
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn spawn_cmd(command: &str) -> std::io::Result<tokio::process::Child> {
    Command::new("cmd")
        .args(["/c", command])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
}
```

Replace lines 69-74 in `run_command_stream`:

```rust
    let mut child = Command::new("cmd")
        .args(["/c", &command])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn: {}", e))?;
```

with:

```rust
    let mut child = spawn_cmd(&command).map_err(|e| format!("Failed to spawn: {}", e))?;
```

- [ ] **Step 5: Run tests to verify they pass**

Run (workdir `src-tauri`): `cargo test`
Expected: 2 passed, 0 failed. Both confirm output still streams/captures with `CREATE_NO_WINDOW` set.

- [ ] **Step 6: Build to confirm no warnings**

Run (workdir `src-tauri`): `cargo build`
Expected: compiles clean, no dead-code warnings (`spawn_cmd` used by `run_command_stream`).

- [ ] **Step 7: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/lib.rs
git commit -m "fix: run cmd streams with CREATE_NO_WINDOW"
```

### Task 2: Hidden spawn for msra + doc accuracy

**Files:**
- Modify: `src-tauri/src/lib.rs:116-123` (`run_msra_offer`)
- Modify: `AGENTS.md:24` and `AGENTS.md` "Tauri config quirks" CREATE_NO_WINDOW bullet

**Interfaces:**
- Consumes: `CREATE_NO_WINDOW` const, `std::os::windows::process::CommandExt` import (both from Task 1).
- Produces: `run_msra_offer` spawns msra with the same flag; AGENTS.md describes actual behavior.

- [ ] **Step 1: Add flag to msra spawn**

In `src-tauri/src/lib.rs`, replace:

```rust
    StdCommand::new("msra.exe")
        .args(["/offerRA", &hostname])
        .spawn()
```

with:

```rust
    StdCommand::new("msra.exe")
        .creation_flags(CREATE_NO_WINDOW)
        .args(["/offerRA", &hostname])
        .spawn()
```

Note: msra.exe is a GUI app (never had a console window) and is not currently wired to any UI button — this is defensive uniformity so every spawn path uses the same flag.

- [ ] **Step 2: Run tests + build**

Run (workdir `src-tauri`): `cargo test`
Expected: still 2 passed (Task 1's StdCommand test guards this code path).

Run (workdir `src-tauri`): `cargo build`
Expected: compiles clean.

- [ ] **Step 3: Fix AGENTS.md accuracy**

In `AGENTS.md`, the "Rust backend" bullet currently claims the flag exists. Update to describe reality:

```markdown
**Rust backend:** 2 Tauri commands — `run_command_stream` (executes `cmd /c <command>` via shared `spawn_cmd` helper with `creation_flags(0x08000000)` / `CREATE_NO_WINDOW`, streams stdout/stderr line-by-line via `command-line` / `command-done` events, no visible console window ever), `run_msra_offer` (spawns `msra.exe /offerRA <hostname>` with the same `CREATE_NO_WINDOW` flag). Regression tests in `src-tauri/src/lib.rs` (`#[cfg(test)] mod tests`) verify output still streams with the flag set.
```

In the "Tauri config quirks" section, update the CREATE_NO_WINDOW bullet to mention it applies to both commands via the shared constant.

- [ ] **Step 4: Manual acceptance — no visible console window**

1. Run (workdir root): `npm run tauri dev`
2. Type a hostname, click `ping`. Expected: popup window opens with ping output. **No cmd/console window flashes.**
3. Run a long command (ping) and, while it runs, open PowerShell and run:

```powershell
Get-Process conhost -ErrorAction SilentlyContinue | Measure-Object
```

   Run the count again right after a fresh ping finishes. Expected: count does not increase from the ping. (Increase means a console host was created.)

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs AGENTS.md
git commit -m "fix: hide console for msra spawn, document CREATE_NO_WINDOW"
```

---

## Self-Review

- **Spec coverage:** "ningún comando abre cmd visible" → Task 1 (streamed cmd path: ping, nslookup, net time, net user). Task 2 (msra). Popup-only results → already implemented, frontend untouched. ✓
- **Placeholder scan:** no TBDs/TODOs; all steps have real code/commands. ✓
- **Type consistency:** `spawn_cmd(&str) -> io::Result<tokio::process::Child>`, `CREATE_NO_WINDOW: u32` defined Task 1, consumed Task 2; `CommandExt` import defined Task 1, used Task 2. No drift. ✓
