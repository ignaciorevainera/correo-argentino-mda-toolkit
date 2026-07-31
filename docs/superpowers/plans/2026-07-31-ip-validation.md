# IP / Hostname Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop corrupting incomplete/malformed IPs with the `.correo.local` suffix. Valid IPv4 addresses run exactly as typed; valid hostnames get the `.correo.local` suffix (unless already present); incomplete or malformed IPs are blocked with a clear status message and no window is opened.

**Architecture:** Extract the inline host-vs-IP detection from `App.tsx:123-126` into a pure classifier in `src/utils/ip.ts`. `App.tsx` calls the classifier in `openWindow`; on `invalid-ip` it shows an error status and returns before creating the popup window. Same pattern as existing `src/utils/pingParser.ts` (pure util module).

**Tech Stack:** TypeScript strict mode (`noUnusedLocals`, `noUnusedParameters`), no runtime deps. **No test framework — NO vitest** (repo has none; verification is `npm run build` (tsc) + manual matrix via `npm run dev`).

## Global Constraints

- No new dependencies, no test framework, no `package.json` changes.
- Do not touch Rust backend (`src-tauri/`), capabilities, or CSP.
- Classifier is a pure function — no DOM, no Tauri imports.
- `npm run build` must pass (tsc + vite).
- Valid IP passes through **exactly as typed** (no trimming of internal spaces beyond existing `trim()` on input; `targetHost` == trimmed input verbatim).
- Hostname rule unchanged: append `.correo.local` unless it already ends with `.correo.local` (case-insensitive).
- Invalid-IP detection uses the same visual cue a help desk operator would use: input starts with a digit and looks IP-shaped (numeric segments separated by dots) but is not a valid IPv4.

---

### Task 1: Pure IP classifier

**Files:**
- New: `src/utils/ip.ts`

**Interfaces:**
- Produces:
  - `export type IpClassification = { kind: "ip"; value: string } | { kind: "hostname"; value: string } | { kind: "invalid-ip"; value: string };`
  - `export function classifyIpInput(input: string): IpClassification`

**Classification rules (in order):**
1. Trim input.
2. **Valid IPv4:** matches `/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/` AND every octet is in `0..255` → `{ kind: "ip", value: trimmed }`.
3. **Looks-like-IP:** matches `/^\d+(\.\d+){1,}$/` (starts with a digit, at least one dot, all segments numeric) → `{ kind: "invalid-ip", value: trimmed }`. This catches incomplete IPs (`192.168`, `1.2.3`) and out-of-range octets (`999.1.1.1`, `10.0.0.999`).
4. **Else** hostname → `{ kind: "hostname", value: trimmed }`.

- [ ] **Step 1: Create `src/utils/ip.ts`** with the type + classifier per rules above. No comments unless the existing util style has them — check `pingParser.ts` first and mirror its header/style.
- [ ] **Step 2: Verify** `npm run build` passes (tsc catches type errors).

---

### Task 2: Wire classifier into `App.tsx`

**Files:**
- Modify: `src/App.tsx` — `openWindow` (lines ~119-148) and imports

**Interfaces:**
- Consumes: `classifyIpInput` from `src/utils/ip`.

**Behavior:**
- Replace inline `isIp` regex + `targetHost` ternary (`App.tsx:123-126`).
- `classifyIpInput(trimmedHost)`:
  - `"ip"` → `targetHost = value` (exactly as typed).
  - `"hostname"` → existing suffix rule: `value.toLowerCase().endsWith(".correo.local") ? value : \`${value}.correo.local\``.
  - `"invalid-ip"` → `showStatus(\`Dirección IP incompleta o inválida: ${value}\`, "error")` and `return` (no window, no history add).
- Keep the existing `hostEnabled` gate (`trimmedHost.length > 0`); invalid-ip only reachable when non-empty.
- `addHistory(trimmedHost)` on success path unchanged (still only when `hostEnabled && type !== "netuser"`).

- [ ] **Step 1: Modify `App.tsx`** imports + `openWindow` per behavior above.
- [ ] **Step 2: Verify** `npm run build` passes.
- [ ] **Step 3: Manual verification matrix** via `npm run dev` (Vite-only, no Rust needed for window-creation validation):
  | Input | Expected |
  |-------|----------|
  | `10.0.0.15` | runs exactly as typed |
  | `192.168.1.1` | runs exactly as typed |
  | `0.0.0.0` | runs exactly as typed |
  | `255.255.255.255` | runs exactly as typed |
  | `999.1.1.1` | blocked, error status (octet out of range) |
  | `1.2.3` | blocked, error status (incomplete) |
  | `192.168` | blocked, error status (incomplete) |
  | `10.0.0.999` | blocked, error status (octet out of range) |
  | `pc01` | `pc01.correo.local` |
  | `PC01.CORREO.LOCAL` | unchanged |
  | `pc01.correo.local` | unchanged |
  | (empty) | button disabled |
