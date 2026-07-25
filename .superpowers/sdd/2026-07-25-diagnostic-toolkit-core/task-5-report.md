# Task 5: Rust command execution with CP850→UTF-8 decoding

**Status:** ✅ Done

## Commands / Output

| Step | Action | Result |
|------|--------|--------|
| 1 | Add `encoding_rs = "0.8"` to Cargo.toml | Done |
| 2 | Replace `lib.rs` with command execution code | Done |
| 3 | `cargo check` in `src-tauri/` | ✅ Passed (1 warning: unused `state` in `run_net_user` — intentional per brief) |
| 4 | Update `tauri.conf.json` width→1024, height→700 | Done |
| 5 | Commit | Done |

## cargo check output

```
Checking encoding_rs v0.8.35
Checking correo-argentino-mda-toolkit v0.1.0
warning: unused variable: `state`
  --> src\lib.rs:86:35
   |
86 | fn run_net_user(username: String, state: State<'_, AppState>) -> String {
   |                                   ^^^^^ help: prefix with `_state`
   |
   = note: `#[warn(unused_variables)]` on by default

Finished `dev` profile [unoptimized + debuginfo] target(s) in 1m 09s
```

## Commit

```
25ec5db feat: add Rust command execution with CP1252→UTF-8 fallback decoding
```

## Concerns

- `Cargo.lock` CRLF warnings on Windows are cosmetic, no impact.

## Fix (post-review)

**Finding:** unused `state: State<'_, AppState>` in `run_net_user`.

**Fix:** renamed `state` → `_state` in function signature.

**cargo check:** ✅ zero warnings.

```
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 35.58s
```

**Commit:** `1e3c82c`
