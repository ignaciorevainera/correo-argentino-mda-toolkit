# Single-Pane Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-architect the diagnostic toolkit UI from a sidebar+form+output layout into a single-pane responsive dashboard with independent per-command cards, a global hostname header, and per-card execution.

**Architecture:** Single-page React app with no sidebar or multi-page routing. A global hostname/IP input sits at the top with an "Ejecutar Todo" button. Below it, a responsive CSS grid of diagnostic cards (Ping, Net Time, Nslookup, Net User, MSRA). Enter in the header or clicking "Ejecutar Todo" fires all cards simultaneously via a trigger counter. Each card also has its own "Ejecutar" button for individual re-runs. Each card manages its own loading/result/error state, has copy-to-clipboard, and internal overflow-y scroll.

**Tech Stack:** Tauri v2, React 19, TypeScript 5.8, Tailwind CSS v4, DaisyUI 5

## Global Constraints

- Target: Windows x64 only
- Color tokens: primary `#ffc72c` (school-bus-yellow), secondary `#254888` (steel-azure), accent `#3a6ea5`
- Fonts: Geist Sans (UI), Geist Mono (console output) — self-hosted via @fontsource
- Minimize custom CSS classes: prefer DaisyUI component defaults
- All cards share the same global hostname/IP from the header
- Net User card has its own username input field
- Each card's console output area must use `font-mono` and have `overflow-y-auto` with `max-h-48`
- Window size: 1024×700 (already configured)
- Tauri invoke: use `@tauri-apps/api/core`
- Build verification: `npm run build` (tsc + vite)

---

### Task 1: Add per-command Tauri commands to Rust backend

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: existing `run_single_command` helper, `CommandResult` struct
- Produces: `run_ping(hostname: String) -> Result<CommandResult, String>`, `run_net_time(hostname: String) -> Result<CommandResult, String>`, `run_nslookup(hostname: String) -> Result<CommandResult, String>` — each runs a single Windows command independently

- [ ] **Step 1: Add run_ping, run_net_time, run_nslookup commands**

Read `src-tauri/src/lib.rs`. Add these three command functions after the existing `run_msra_offer` function but before the `run()` builder:

```rust
#[tauri::command]
fn run_ping(hostname: String) -> Result<CommandResult, String> {
    let command = format!("ping -n 4 {}", hostname);
    let result = run_single_command(&command);
    Ok(result)
}

#[tauri::command]
fn run_net_time(hostname: String) -> Result<CommandResult, String> {
    let command = format!("net time \\\\{}", hostname);
    let result = run_single_command(&command);
    Ok(result)
}

#[tauri::command]
fn run_nslookup(hostname: String) -> Result<CommandResult, String> {
    let command = format!("nslookup {}", hostname);
    let result = run_single_command(&command);
    Ok(result)
}
```

- [ ] **Step 2: Register new commands in invoke_handler**

Add `run_ping`, `run_net_time`, and `run_nslookup` to the `generate_handler!` macro:

```rust
.invoke_handler(tauri::generate_handler![
    execute_diagnostic,
    run_net_user,
    run_msra_offer,
    run_ping,
    run_net_time,
    run_nslookup,
])
```

- [ ] **Step 3: Verify Rust build**

Run `cargo check` in `src-tauri/`.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add run_ping, run_net_time, run_nslookup Tauri commands"
```

---

### Task 2: Create GlobalHeader component

**Files:**
- Create: `src/components/GlobalHeader.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `GlobalHeader` component that renders a hostname/IP input, an "Ejecutar Todo" button, and Enter key support. Fires `onHostnameChange(hostname: string)`, `onRunAll()`.

- [ ] **Step 1: Create GlobalHeader component**

Create `src/components/GlobalHeader.tsx`:

```tsx
interface GlobalHeaderProps {
  hostname: string;
  onHostnameChange: (hostname: string) => void;
  onRunAll: () => void;
  disabled?: boolean;
}

export default function GlobalHeader({
  hostname,
  onHostnameChange,
  onRunAll,
  disabled,
}: GlobalHeaderProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && hostname.trim() && !disabled) {
      onRunAll();
    }
  };

  return (
    <div className="w-full px-4 py-3 bg-base-200/50 border-b border-base-300">
      <div className="flex items-center gap-3 max-w-full">
        <div className="form-control flex-1 min-w-0">
          <label className="label py-0.5" htmlFor="global-hostname">
            <span className="label-text font-semibold text-sm">Hostname o Dirección IP</span>
          </label>
          <input
            id="global-hostname"
            type="text"
            value={hostname}
            onChange={(e) => onHostnameChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ej: PC-001 o 192.168.1.50"
            className="input input-bordered input-sm w-full font-mono"
            disabled={disabled}
            autoFocus
          />
        </div>
        <button
          onClick={onRunAll}
          disabled={disabled || !hostname.trim()}
          className="btn btn-primary btn-sm mt-5 shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
          </svg>
          Ejecutar Todo
        </button>
        <div className="text-xs shrink-0 self-end pb-1.5 text-base-content/40">
          Enter → Ejecutar todo
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

Run `npx tsc --noEmit`.

- [ ] **Step 3: Commit**

```bash
git add src/components/GlobalHeader.tsx
git commit -m "feat: add global hostname header component with Enter support"
```

---

### Task 3: Create DiagnosticCard component

**Files:**
- Create: `src/components/DiagnosticCard.tsx`

**Interfaces:**
- Consumes: `useClipboard` hook, `CommandResult` type, Tauri invoke API
- Produces: `DiagnosticCard` — reusable card component with title, optional input field, execute button, output area with copy button, and `executeTrigger` prop for automatic execution when "Ejecutar Todo" is fired. Manages its own loading/result/error state per card.

```tsx
interface DiagnosticCardProps {
  title: string;
  commandName: string;
  commandArgs: Record<string, string>;
  hostname: string;
  executeTrigger: number;
  disabled?: boolean;
  extraInput?: {
    key: string;
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
  };
}
```

- [ ] **Step 1: Create DiagnosticCard component**

Create `src/components/DiagnosticCard.tsx`:

```tsx
import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useClipboard } from "../hooks/useClipboard";
import type { CommandResult } from "../types";

interface DiagnosticCardProps {
  title: string;
  commandName: string;
  commandArgs: Record<string, string>;
  hostname: string;
  executeTrigger: number;
  disabled?: boolean;
  extraInput?: {
    key: string;
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
  };
}

function OutputBlock({ result }: { result: CommandResult }) {
  const { copied, copy } = useClipboard();
  const hasOutput = result.stdout.trim() || result.stderr.trim();
  const outputText = [result.stdout, result.stderr]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="rounded-box bg-base-300/50 border border-base-300 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-base-300/30 border-b border-base-300">
        <span className={`badge badge-xs text-xs ${
          result.exit_code === 0 ? "badge-success" : "badge-error"
        }`}>
          {result.exit_code !== null ? `exit ${result.exit_code}` : "error"}
        </span>
        <button
          onClick={() => copy(outputText)}
          className="btn btn-ghost btn-xs"
          disabled={!hasOutput}
          aria-label="Copiar salida"
        >
          {copied ? "✓ Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="p-3 text-xs font-mono text-base-content/80 overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto leading-relaxed">
        {hasOutput ? outputText : <span className="text-base-content/30 italic">Sin salida</span>}
      </pre>
    </div>
  );
}

export default function DiagnosticCard({
  title,
  commandName,
  commandArgs,
  hostname,
  executeTrigger,
  disabled,
  extraInput,
}: DiagnosticCardProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CommandResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef(executeTrigger);

  const isDisabled = disabled || !hostname.trim();

  const execute = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await invoke<CommandResult>(commandName, commandArgs);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (executeTrigger !== triggerRef.current) {
      triggerRef.current = executeTrigger;
      if (!isDisabled && !loading) {
        execute();
      }
    }
  }, [executeTrigger]);

  return (
    <div className="rounded-box bg-base-200 border border-base-300 p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-secondary truncate">{title}</h3>
        <button
          onClick={execute}
          disabled={isDisabled || loading}
          className="btn btn-primary btn-xs shrink-0"
        >
          {loading ? (
            <span className="loading loading-spinner loading-xs"></span>
          ) : (
            "Ejecutar"
          )}
        </button>
      </div>

      {extraInput && (
        <div className="form-control w-full">
          <label className="label py-0.5">
            <span className="label-text text-xs font-medium">
              {extraInput.label}
            </span>
          </label>
          <input
            type="text"
            value={extraInput.value}
            onChange={(e) => extraInput.onChange(e.target.value)}
            placeholder={extraInput.placeholder}
            className="input input-bordered input-sm w-full font-mono text-xs"
            disabled={isDisabled || loading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && extraInput.value.trim() && !isDisabled && !loading) {
                execute();
              }
            }}
          />
        </div>
      )}

      {error && (
        <div role="alert" className="alert alert-error text-xs py-1.5">
          <span className="truncate">{error}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-base-content/50 text-xs py-1">
          <span className="loading loading-spinner loading-xs text-primary"></span>
          Ejecutando...
        </div>
      )}

      {result && <OutputBlock result={result} />}

      {!result && !loading && !error && (
        <div className="text-xs text-base-content/30 italic py-6 text-center">
          Presione Ejecutar para iniciar
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

Run `npx tsc --noEmit`.

- [ ] **Step 3: Commit**

```bash
git add src/components/DiagnosticCard.tsx
git commit -m "feat: add reusable diagnostic card with per-command execution"
```

---

### Task 4: Create MsraCard component

**Files:**
- Create: `src/components/MsraCard.tsx`

**Interfaces:**
- Consumes: Tauri invoke API for `run_msra_offer`
- Produces: `MsraCard` — a simple card with a launch button for Remote Assistance, no console output

- [ ] **Step 1: Create MsraCard component**

Create `src/components/MsraCard.tsx`:

```tsx
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface MsraCardProps {
  hostname: string;
  disabled?: boolean;
}

export default function MsraCard({ hostname, disabled }: MsraCardProps) {
  const [status, setStatus] = useState<"idle" | "launching" | "launched">("idle");

  const launch = async () => {
    setStatus("launching");
    try {
      await invoke("run_msra_offer", { hostname });
      setStatus("launched");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("idle");
    }
  };

  const isDisabled = disabled || !hostname.trim() || status !== "idle";

  return (
    <div className="rounded-box bg-base-200 border border-base-300 p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-secondary truncate">Asistencia Remota</h3>
      </div>

      <p className="text-xs text-base-content/50">
        Abre MSRA para ofrecer asistencia remota al equipo de destino.
      </p>

      <button
        onClick={launch}
        disabled={isDisabled}
        className="btn btn-outline btn-secondary btn-sm"
      >
        {status === "launching" && (
          <span className="loading loading-spinner loading-xs"></span>
        )}
        {status === "launched" && "✓ "}
        {status === "idle" && "Abrir Asistencia Remota"}
      </button>

      <p className="text-xs text-base-content/30 font-mono truncate">
        msra.exe /offerRA {hostname || "<hostname>"}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

Run `npx tsc --noEmit`.

- [ ] **Step 3: Commit**

```bash
git add src/components/MsraCard.tsx
git commit -m "feat: add MSRA card component for remote assistance"
```

---

### Task 5: Rewrite App.tsx as single-pane dashboard grid

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `GlobalHeader`, `DiagnosticCard`, `MsraCard` — all created in Tasks 2-4
- Produces: Complete single-pane responsive dashboard with global hostname header and 2×2 card grid

- [ ] **Step 1: Replace App.tsx with dashboard layout**

Replace `src/App.tsx` content:

```tsx
import { useState } from "react";
import GlobalHeader from "./components/GlobalHeader";
import DiagnosticCard from "./components/DiagnosticCard";
import MsraCard from "./components/MsraCard";

function App() {
  const [hostname, setHostname] = useState("");
  const [netUserUsername, setNetUserUsername] = useState("");
  const [runAllTrigger, setRunAllTrigger] = useState(0);

  const handleRunAll = () => {
    setRunAllTrigger((prev) => prev + 1);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-base-100 text-base-content" data-theme="mda">
      <GlobalHeader
        hostname={hostname}
        onHostnameChange={setHostname}
        onRunAll={handleRunAll}
      />

      <main className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min">
          <DiagnosticCard
            title="Ping"
            commandName="run_ping"
            commandArgs={{ hostname }}
            hostname={hostname}
            executeTrigger={runAllTrigger}
          />

          <DiagnosticCard
            title="Net Time"
            commandName="run_net_time"
            commandArgs={{ hostname }}
            hostname={hostname}
            executeTrigger={runAllTrigger}
          />

          <DiagnosticCard
            title="Nslookup"
            commandName="run_nslookup"
            commandArgs={{ hostname }}
            hostname={hostname}
            executeTrigger={runAllTrigger}
          />

          <DiagnosticCard
            title="Net User"
            commandName="run_net_user"
            commandArgs={{ username: netUserUsername }}
            hostname={hostname}
            executeTrigger={runAllTrigger}
            extraInput={{
              key: "username",
              label: "Usuario de red",
              placeholder: "Ej: usuario.red",
              value: netUserUsername,
              onChange: setNetUserUsername,
            }}
          />

          <MsraCard hostname={hostname} />
        </div>
      </main>
    </div>
  );
}

export default App;
```

- [ ] **Step 2: Verify TypeScript**

Run `npx tsc --noEmit`.

- [ ] **Step 3: Verify build**

Run `npm run build`.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: replace sidebar layout with single-pane responsive dashboard grid"
```

---

### Task 6: Remove old unused components

**Files:**
- Delete: `src/components/DiagnosticForm.tsx`
- Delete: `src/components/OutputPanel.tsx`
- Delete: `src/components/ActionButtons.tsx`
- Delete: `src/components/Layout.tsx`
- Delete: `src/components/Sidebar.tsx`

**Interfaces:**
- Consumes: new dashboard in App.tsx (Task 5) which no longer imports any of these
- Produces: Clean component directory with only active files

- [ ] **Step 1: Delete old components**

```bash
Remove-Item src/components/DiagnosticForm.tsx
Remove-Item src/components/OutputPanel.tsx
Remove-Item src/components/ActionButtons.tsx
Remove-Item src/components/Layout.tsx
Remove-Item src/components/Sidebar.tsx
```

- [ ] **Step 2: Verify TypeScript still compiles**

Run `npx tsc --noEmit`. All old imports are gone from App.tsx so no errors expected.

- [ ] **Step 3: Verify build**

Run `npm run build`.

- [ ] **Step 4: Commit**

```bash
git rm src/components/DiagnosticForm.tsx src/components/OutputPanel.tsx src/components/ActionButtons.tsx src/components/Layout.tsx src/components/Sidebar.tsx
git commit -m "refactor: remove old sidebar and form components replaced by dashboard"
```

---

### Task 7: Final polish — responsive tweaks and remaining files

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `index.html`

**Interfaces:**
- Consumes: final dashboard from Task 6
- Produces: Polished single-pane app with correct window constraints

- [ ] **Step 1: Ensure tauri.conf.json has correct window config**

Read `src-tauri/tauri.conf.json`. Confirm title is `"MDA Toolkit — Correo Argentino"`, width=1024, height=700.

If not already set, update:
```json
"windows": [{"title": "MDA Toolkit — Correo Argentino", "width": 1024, "height": 700, "minWidth": 640, "minHeight": 480}]
```

- [ ] **Step 2: Verify index.html title**

Read `index.html`. Confirm title is `"MDA Toolkit"`.

- [ ] **Step 3: Final build check**

Run `npm run build`.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/tauri.conf.json index.html
git commit -m "chore: set minimum window size and confirm app title"
```

---

## Self-Review Results

**1. Spec coverage check:**
- Adaptive without overflow — Task 5 (responsive grid lg:grid-cols-3), Task 3 (max-h-48 overflow-y-auto) ✓
- Global hostname/IP header block with "Ejecutar Todo" button — Task 2 ✓
- Enter key triggers all commands simultaneously — Task 2 (onRunAll on Enter), Task 3 (executeTrigger useEffect) ✓
- Card-based grid layout visible simultaneously — Task 5 (5 cards in grid) ✓
- Ping card — Task 5 (DiagnosticCard with run_ping) ✓
- Net Time card — Task 5 (DiagnosticCard with run_net_time) ✓
- Nslookup card — Task 5 (DiagnosticCard with run_nslookup) ✓
- Net User card with username input + Enter support — Task 5 (DiagnosticCard with extraInput + run_net_user) ✓
- MSRA card with dedicated launch button, no console — Task 4 ✓
- Clipboard copy per card — Task 3 (OutputBlock inside DiagnosticCard) ✓
- MDA styling (primary #ffc72c, secondary #254888) — DaisyUI tokens throughout ✓
- Minimize custom CSS — no custom classes added ✓

**2. Placeholder scan:** No TBD, TODO, or vague instructions found. Every step has concrete code or exact file paths.

**3. Type consistency:**
- `CommandResult` interface: unchanged from existing `src/types.ts`, used in Task 3 ✓
- Tauri command names: `run_ping`, `run_net_time` defined in Task 1 lib.rs, invoked in Task 5 App.tsx via `commandName` prop ✓
- `DiagnosticCardProps.hostname` passed from App.tsx state — single source of truth ✓
- `extraInput.key` matches `commandArgs` shape — net user uses `username` key ✓
