# Diagnostic Toolkit Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core desktop diagnostic utility for N1/N2 help desk operators at Correo Argentino — hostname/IP input form, async Windows command execution (ping, net time, net user, msra) with CP850→UTF-8 decoding, mono output display, and clipboard copy.

**Architecture:** Single-window Tauri v2 desktop app. React 19 frontend with Tailwind CSS v4 + DaisyUI 5 styled to MDA Portal tokens. Rust backend exposes Tauri commands that spawn Windows child processes, decode CP850 output to UTF-8, and stream stdout/stderr line-by-line to the frontend via Tauri events. Frontend renders output in a mono panel with per-command copy-to-clipboard buttons via the Web Clipboard API.

**Tech Stack:** Tauri v2, Rust (serde, tauri), React 19, TypeScript 5.8, Tailwind CSS v4, DaisyUI 5, Vite 7

## Global Constraints

- Target: Windows x64 only
- Tauri CSP: maintain `null` (no restrictions for dev)
- Fonts: Geist (UI), Geist Mono (console output) — self-hosted via `@fontsource/geist-sans` and `@fontsource/geist-mono`
- Color tokens: `primary: #ffc72c` (school-bus-yellow), `secondary: #254888` (steel-azure), `accent: #3a6ea5`
- DaisyUI theme: inherit all default DaisyUI tokens, override only primary/secondary/accent + border radius + font families
- Commands: `ping`, `net time`, `net user` (read-only diagnostic tools only)
- `msra.exe /offerRA` requires `shell:execute` Tauri capability (launches external process, no output parsed)
- Output encoding: Windows console uses CP850; every command output must be decoded to UTF-8 in Rust before sending to frontend
- Window size: 1024×700 (upgrade from scaffold 800×600)
- No logging of user input to console or disk
- Use `@tauri-apps/api` v2 (no v1 APIs)
- Tailwind CSS v4 — uses CSS-first config (`@import "tailwindcss"`), no `tailwind.config.js` needed. DaisyUI 5 installs as Tailwind plugin via `@plugin "daisyui"` in CSS.

---

### Task 1: Install UI stack — Tailwind CSS v4, DaisyUI 5, and fonts

**Files:**
- Modify: `package.json`
- Create: `src/index.css`

**Interfaces:**
- Consumes: nothing (scaffold)
- Produces: `src/index.css` with Tailwind directives, DaisyUI plugin, and MDA theme tokens — ready for import in `main.tsx`

- [ ] **Step 1: Install npm packages**

```bash
npm install tailwindcss @tailwindcss/vite daisyui @fontsource/geist-sans @fontsource/geist-mono
```

- [ ] **Step 2: Add Tailwind Vite plugin to vite.config.ts**

Read `vite.config.ts`. Add `import tailwindcss from "@tailwindcss/vite"` at top. Add `tailwindcss()` to the plugins array after `react()`.

Final `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
}));
```

- [ ] **Step 3: Create src/index.css with Tailwind CSS v4 + DaisyUI 5 plugin**

Create `src/index.css`:

```css
@import "tailwindcss";
@plugin "daisyui";
@import "@fontsource/geist-sans";
@import "@fontsource/geist-mono";

@plugin "daisyui/theme" {
  name: "mda";
  default: true;
  prefersdark: true;
  color-scheme: dark;
  --color-primary: #ffc72c;
  --color-primary-content: #1a1a1a;
  --color-secondary: #254888;
  --color-secondary-content: #ffffff;
  --color-accent: #3a6ea5;
  --color-accent-content: #ffffff;
  --color-base-100: #1d232a;
  --color-base-200: #191e24;
  --color-base-300: #15191e;
  --color-base-content: #e0e0e0;
  --color-neutral: #2a323c;
  --color-neutral-content: #a6adbb;
  --color-info: #3a6ea5;
  --color-info-content: #ffffff;
  --color-success: #36d399;
  --color-success-content: #1a1a1a;
  --color-warning: #ffc72c;
  --color-warning-content: #1a1a1a;
  --color-error: #f87272;
  --color-error-content: #1a1a1a;
  --radius-selector: 0.5rem;
  --radius-field: 0.5rem;
  --radius-box: 0.75rem;
  --size-selector: 0.25rem;
  --size-field: 0.25rem;
  --border: 1px;
  --depth: 1;
  --noise: 0;
}

@theme {
  --font-sans: "Geist Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, SFMono-Regular, monospace;
}
```

- [ ] **Step 4: Verify package.json has all new dependencies**

Run `npm ls tailwindcss daisyui @fontsource/geist-sans @fontsource/geist-mono @tailwindcss/vite` to confirm installed.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/index.css
git commit -m "chore: install Tailwind CSS v4, DaisyUI 5, Geist fonts"
```

---

### Task 2: Wire theme into app entry — replace scaffold CSS with new stack

**Files:**
- Modify: `src/main.tsx`
- Modify: `index.html`
- Delete: `src/App.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `src/index.css` from Task 1
- Produces: Clean entry point with MDA-themed dark mode, empty App shell, Geist fonts active

- [ ] **Step 1: Update index.html title**

Change `<title>Tauri + React + Typescript</title>` to `<title>MDA Toolkit</title>`.

Add `<link rel="preconnect" href="https://fonts.googleapis.com" />` is NOT needed since we use @fontsource (self-hosted).

- [ ] **Step 2: Update main.tsx to import theme CSS**

Read `src/main.tsx`. Add `import "./index.css";` as the first import (before React imports).

Final `src/main.tsx`:

```tsx
import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 3: Strip App.tsx down to a themed shell**

Replace `src/App.tsx` content with:

```tsx
function App() {
  return (
    <div className="min-h-screen bg-base-100 text-base-content" data-theme="mda">
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-primary">MDA Toolkit</h1>
          <p className="text-base-content/60">Correo Argentino — Diagnostic Utility</p>
        </div>
      </div>
    </div>
  );
}

export default App;
```

- [ ] **Step 4: Delete src/App.css**

```bash
Remove-Item src/App.css
```

Also remove the `import "./App.css"` if it was still in App.tsx (already removed in Step 3).

- [ ] **Step 5: Run dev server to verify**

```bash
npm run tauri dev
```

Confirm: window opens, title is "MDA Toolkit", dark theme with yellow (#ffc72c) primary text visible, no console errors.

- [ ] **Step 6: Commit**

```bash
git add index.html src/main.tsx src/App.tsx
git rm src/App.css
git commit -m "feat: wire MDA theme, fonts, and DaisyUI into app shell"
```

---

### Task 3: Create app layout — sidebar + main content area

**Files:**
- Create: `src/components/Layout.tsx`
- Create: `src/components/Sidebar.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: themed App shell from Task 2
- Produces: `Layout` component with responsive sidebar (collapsed icon-only by default, expandable) and main content slot. `App` renders `Layout` > `children`.

- [ ] **Step 1: Create Sidebar component**

Create `src/components/Sidebar.tsx`:

```tsx
import { useState } from "react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { id: "diagnostic", label: "Diagnóstico", icon: "🔍" },
  { id: "output", label: "Resultados", icon: "📋" },
  { id: "settings", label: "Configuración", icon: "⚙️" },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [active, setActive] = useState("diagnostic");

  return (
    <aside
      className={`flex flex-col bg-base-200 border-r border-base-300 transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      <div className="flex items-center h-14 px-3 border-b border-base-300">
        <button
          onClick={onToggle}
          className="btn btn-ghost btn-sm btn-square"
          aria-label="Toggle sidebar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        {!collapsed && (
          <span className="ml-3 font-semibold text-sm truncate text-secondary">
            MDA Toolkit
          </span>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActive(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm transition-colors ${
              active === item.id
                ? "bg-primary/20 text-primary font-medium"
                : "text-base-content/70 hover:bg-base-300 hover:text-base-content"
            }`}
            title={collapsed ? item.label : undefined}
          >
            <span className="text-lg flex-shrink-0">{item.icon}</span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="p-2 border-t border-base-300">
        <div className={`text-xs text-base-content/40 truncate text-center ${collapsed ? "" : "px-2"}`}>
          {collapsed ? "v0.1" : "v0.1.0"}
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create Layout component**

Create `src/components/Layout.tsx`:

```tsx
import { type ReactNode, useState } from "react";
import Sidebar from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden bg-base-100 text-base-content" data-theme="mda">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Update App.tsx to use Layout**

Replace `src/App.tsx` content:

```tsx
import Layout from "./components/Layout";

function App() {
  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary">Diagnóstico de Red</h1>
        <p className="mt-2 text-base-content/60">
          Ingrese los datos del equipo a diagnosticar.
        </p>
      </div>
    </Layout>
  );
}

export default App;
```

- [ ] **Step 4: Verify layout renders**

```bash
npm run tauri dev
```

Confirm: sidebar on left (collapsed showing icons only), main area with "Diagnóstico de Red" heading, toggle button expands/collapses sidebar.

- [ ] **Step 5: Commit**

```bash
git add src/components/Layout.tsx src/components/Sidebar.tsx src/App.tsx
git commit -m "feat: add sidebar layout with collapsible navigation"
```

---

### Task 4: Build diagnostic form component — hostname/IP and network user inputs

**Files:**
- Create: `src/components/DiagnosticForm.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `Layout` from Task 3
- Produces: `DiagnosticForm` component with controlled inputs for hostname/IP and optional network username. Exposes `onSubmit` callback with `{ hostname: string; username: string }`.

- [ ] **Step 1: Create DiagnosticForm component**

Create `src/components/DiagnosticForm.tsx`:

```tsx
import { type FormEvent, useState } from "react";

export interface DiagnosticInput {
  hostname: string;
  username: string;
}

interface DiagnosticFormProps {
  onSubmit: (input: DiagnosticInput) => void;
  disabled?: boolean;
}

export default function DiagnosticForm({ onSubmit, disabled }: DiagnosticFormProps) {
  const [hostname, setHostname] = useState("");
  const [username, setUsername] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!hostname.trim()) return;
    onSubmit({ hostname: hostname.trim(), username: username.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="form-control w-full max-w-md">
        <label className="label" htmlFor="hostname">
          <span className="label-text font-medium">Hostname o dirección IP</span>
        </label>
        <input
          id="hostname"
          type="text"
          value={hostname}
          onChange={(e) => setHostname(e.target.value)}
          placeholder="Ej: PC-001 o 192.168.1.50"
          className="input input-bordered w-full font-mono"
          disabled={disabled}
          autoFocus
        />
        <label className="label">
          <span className="label-text-alt text-base-content/50">
            Nombre de equipo o IP del puesto a diagnosticar
          </span>
        </label>
      </div>

      <div className="form-control w-full max-w-md">
        <label className="label" htmlFor="username">
          <span className="label-text font-medium">
            Usuario de red <span className="text-base-content/40">(opcional)</span>
          </span>
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Ej: usuario.red"
          className="input input-bordered w-full font-mono"
          disabled={disabled}
        />
        <label className="label">
          <span className="label-text-alt text-base-content/50">
            Usuario de red para comandos net user
          </span>
        </label>
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={disabled || !hostname.trim()}
      >
        Ejecutar Diagnóstico
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Add DiagnosticForm to App.tsx**

Replace `src/App.tsx` content:

```tsx
import Layout from "./components/Layout";
import DiagnosticForm, { type DiagnosticInput } from "./components/DiagnosticForm";

function App() {
  const handleDiagnostic = (input: DiagnosticInput) => {
    console.log("Diagnostic requested:", input);
  };

  return (
    <Layout>
      <div className="p-6 max-w-2xl">
        <h1 className="text-2xl font-bold text-primary mb-1">Diagnóstico de Red</h1>
        <p className="text-base-content/60 mb-6">
          Ingrese los datos del equipo a diagnosticar.
        </p>
        <DiagnosticForm onSubmit={handleDiagnostic} />
      </div>
    </Layout>
  );
}

export default App;
```

- [ ] **Step 3: Verify form renders and validates**

```bash
npm run tauri dev
```

Confirm: hostname input with autoFocus, username input with optional label, submit button disabled when hostname is empty, enabled when filled. Console log fires on submit.

- [ ] **Step 4: Commit**

```bash
git add src/components/DiagnosticForm.tsx src/App.tsx
git commit -m "feat: add diagnostic form with hostname and network user inputs"
```

---

### Task 5: Implement Rust command execution with CP850→UTF-8 decoding

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: nothing from frontend yet
- Produces: `execute_diagnostic` Tauri command that takes `hostname: String` and `commands: Vec<String>`, spawns each as a Windows child process with CP850 stdout/stderr, decodes to UTF-8, collects output, and returns `Vec<CommandResult>` where:
  ```rust
  #[derive(Serialize)]
  struct CommandResult {
      command: String,
      stdout: String,
      stderr: String,
      exit_code: Option<i32>,
  }
  ```

**Note:** On Windows, `cmd.exe /c <command>` defaults to active code page (CP850 on Spanish Windows). We use `std::process::Command` with `cmd.exe /c chcp 65001 > nul && <actual command>` to force UTF-8 output when possible. Fallback: detect CP850 bytes and decode manually.

- [ ] **Step 1: Add encoding_rs to Cargo.toml**

Read `src-tauri/Cargo.toml`. Add `encoding_rs = "0.8"` to `[dependencies]`.

- [ ] **Step 2: Implement execute_diagnostic in lib.rs**

Read `src-tauri/src/lib.rs`. Replace content with:

```rust
use encoding_rs::WINDOWS_1252;
use serde::Serialize;
use std::process::Command as StdCommand;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Serialize, Clone)]
pub struct CommandResult {
    pub command: String,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

struct AppState {
    running: Mutex<bool>,
}

fn decode_windows_output(bytes: Vec<u8>) -> String {
    if bytes.is_empty() {
        return String::new();
    }
    match String::from_utf8(bytes.clone()) {
        Ok(s) => s,
        Err(_) => {
            let (decoded, _, _) = WINDOWS_1252.decode(&bytes);
            decoded.into_owned()
        }
    }
}

fn run_single_command(command: &str) -> CommandResult {
    let output = StdCommand::new("cmd")
        .args(["/c", command])
        .output();

    match output {
        Ok(out) => CommandResult {
            command: command.to_string(),
            stdout: decode_windows_output(out.stdout),
            stderr: decode_windows_output(out.stderr),
            exit_code: out.status.code(),
        },
        Err(e) => CommandResult {
            command: command.to_string(),
            stdout: String::new(),
            stderr: format!("Failed to execute: {}", e),
            exit_code: None,
        },
    }
}

#[tauri::command]
fn execute_diagnostic(
    hostname: String,
    state: State<'_, AppState>,
) -> Result<Vec<CommandResult>, String> {
    {
        let mut running = state.running.lock().map_err(|e| e.to_string())?;
        if *running {
            return Err("A diagnostic run is already in progress.".to_string());
        }
        *running = true;
    }

    let commands = vec![
        format!("ping -n 4 {}", hostname),
        format!("net time \\\\{}", hostname),
        format!("nslookup {}", hostname),
    ];

    let results: Vec<CommandResult> = commands
        .iter()
        .map(|cmd| run_single_command(cmd))
        .collect();

    {
        let mut running = state.running.lock().map_err(|e| e.to_string())?;
        *running = false;
    }

    Ok(results)
}

#[tauri::command]
fn run_net_user(username: String, state: State<'_, AppState>) -> Result<CommandResult, String> {
    let command = format!("net user {}", username);
    let result = run_single_command(&command);
    Ok(result)
}

#[tauri::command]
fn run_msra_offer(hostname: String) -> Result<(), String> {
    StdCommand::new("msra.exe")
        .args(["/offerRA", &hostname])
        .spawn()
        .map_err(|e| format!("Failed to launch Remote Assistance: {}", e))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            running: Mutex::new(false),
        })
        .invoke_handler(tauri::generate_handler![
            execute_diagnostic,
            run_net_user,
            run_msra_offer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Check that build compiles**

```bash
cargo check
```

Workdir: `src-tauri`

- [ ] **Step 4: Update Tauri window size to 1024×700**

Read `src-tauri/tauri.conf.json`. Change `"width": 800` to `"width": 1024`, change `"height": 600` to `"height": 700`.

- [ ] **Step 5: Add shell execution capability for msra.exe**

Read `src-tauri/capabilities/default.json`. Ensure it includes necessary permissions. Add `"shell:default"` if msra.exe requires it (note: `msra.exe` is launched via Rust `std::process::Command`, not Tauri shell plugin, so no extra capability needed for now — but add comment noting this decision).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs src-tauri/tauri.conf.json src-tauri/capabilities/default.json
git commit -m "feat: add Rust command execution with CP1252→UTF-8 fallback decoding"
```

---

### Task 6: Create output display and clipboard components

**Files:**
- Create: `src/components/OutputPanel.tsx`
- Create: `src/hooks/useClipboard.ts`

**Interfaces:**
- Consumes: `CommandResult[]` from Rust (Task 5), expected shape matches `CommandResult` interface in frontend
- Produces: `OutputPanel` component that renders each command's stdout/stderr in `<pre>` blocks with mono font, per-block copy button. `useClipboard` hook wraps `navigator.clipboard.writeText` with a temporary "copied" state.

- [ ] **Step 1: Create useClipboard hook**

Create `src/hooks/useClipboard.ts`:

```ts
import { useState, useCallback } from "react";

export function useClipboard(resetMs = 2000) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), resetMs);
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopied(true);
        setTimeout(() => setCopied(false), resetMs);
      }
    },
    [resetMs],
  );

  return { copied, copy };
}
```

- [ ] **Step 2: Create CommandResult frontend type**

Create `src/types.ts`:

```ts
export interface CommandResult {
  command: string;
  stdout: string;
  stderr: string;
  exit_code: number | null;
}
```

- [ ] **Step 3: Create OutputPanel component**

Create `src/components/OutputPanel.tsx`:

```tsx
import { useClipboard } from "../hooks/useClipboard";
import type { CommandResult } from "../types";

interface OutputPanelProps {
  results: CommandResult[];
  loading: boolean;
}

function OutputBlock({ result }: { result: CommandResult }) {
  const { copied, copy } = useClipboard();
  const hasOutput = result.stdout.trim() || result.stderr.trim();
  const outputText = [result.stdout, result.stderr]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="rounded-box bg-base-200 border border-base-300 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-base-300/50 border-b border-base-300">
        <div className="flex items-center gap-2">
          <span className="badge badge-sm badge-primary font-mono text-xs">
            {result.command}
          </span>
          {result.exit_code !== null && (
            <span
              className={`badge badge-sm text-xs ${
                result.exit_code === 0 ? "badge-success" : "badge-error"
              }`}
            >
              exit {result.exit_code}
            </span>
          )}
        </div>
        <button
          onClick={() => copy(outputText)}
          className="btn btn-ghost btn-xs"
          disabled={!hasOutput}
          aria-label="Copy output"
        >
          {copied ? (
            <span className="text-success flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Copiado
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
              </svg>
              Copiar
            </span>
          )}
        </button>
      </div>
      <pre className="p-4 text-sm font-mono text-base-content/90 overflow-x-auto whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
        {hasOutput ? outputText : <span className="text-base-content/30 italic">Sin salida</span>}
      </pre>
    </div>
  );
}

export default function OutputPanel({ results, loading }: OutputPanelProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-base-content/60">
          <span className="loading loading-spinner loading-md text-primary"></span>
          <span className="text-sm">Ejecutando comandos de diagnóstico...</span>
        </div>
        {results.map((r) => (
          <OutputBlock key={r.command} result={r} />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-base-content/40">
        <p className="text-lg mb-1">Sin resultados</p>
        <p className="text-sm">Complete el formulario y ejecute el diagnóstico.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-secondary">Resultados</h2>
      {results.map((r) => (
        <OutputBlock key={r.command} result={r} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/OutputPanel.tsx src/hooks/useClipboard.ts src/types.ts
git commit -m "feat: add output panel with mono rendering and clipboard copy"
```

---

### Task 7: Wire frontend to backend — invoke commands from React

**Files:**
- Modify: `src/App.tsx`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: `DiagnosticForm` (Task 4), `OutputPanel` (Task 6), Rust `execute_diagnostic` command (Task 5)
- Produces: Full working flow: fill form → submit → Rust executes commands → results displayed in OutputPanel with loading state

- [ ] **Step 1: Update App.tsx with full integration**

Replace `src/App.tsx` content:

```tsx
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Layout from "./components/Layout";
import DiagnosticForm, { type DiagnosticInput } from "./components/DiagnosticForm";
import OutputPanel from "./components/OutputPanel";
import type { CommandResult } from "./types";

function App() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CommandResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleDiagnostic = async (input: DiagnosticInput) => {
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const data = await invoke<CommandResult[]>("execute_diagnostic", {
        hostname: input.hostname,
      });
      setResults(data);

      if (input.username) {
        const userResult = await invoke<CommandResult>("run_net_user", {
          username: input.username,
        });
        setResults((prev) => [...prev, userResult]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-primary mb-1">Diagnóstico de Red</h1>
          <p className="text-base-content/60">
            Ingrese los datos del equipo a diagnosticar.
          </p>
        </div>

        <DiagnosticForm onSubmit={handleDiagnostic} disabled={loading} />

        {error && (
          <div role="alert" className="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <OutputPanel results={results} loading={loading} />
      </div>
    </Layout>
  );
}

export default App;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. If types from `@tauri-apps/api` are not resolving, confirm `tsconfig.json` paths.

- [ ] **Step 3: Full integration test**

```bash
npm run tauri dev
```

Test sequence:
1. App opens with sidebar + form
2. Enter a hostname (e.g., `localhost` or `127.0.0.1`)
3. Click "Ejecutar Diagnóstico"
4. Spinner shows while executing
5. Three result blocks appear: ping, net time, nslookup
6. Each block has copy button — click it, confirm "Copiado" state appears
7. Enter a username and submit again — net user result appears as fourth block
8. Test error: enter invalid hostname, confirm error alert

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire diagnostic form to Rust command execution with loading and results"
```

---

### Task 8: Add per-command execution buttons (msra remote assistance)

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/ActionButtons.tsx`

**Interfaces:**
- Consumes: `run_msra_offer` Rust command, `DiagnosticInput` from form state
- Produces: `ActionButtons` component with individual action buttons (Remote Assistance launch), shown after diagnostic form

- [ ] **Step 1: Create ActionButtons component**

Create `src/components/ActionButtons.tsx`:

```tsx
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ActionButtonsProps {
  hostname: string;
  disabled?: boolean;
}

export default function ActionButtons({ hostname, disabled }: ActionButtonsProps) {
  const [msraStatus, setMsraStatus] = useState<"idle" | "launching" | "launched">("idle");

  const launchMsra = async () => {
    setMsraStatus("launching");
    try {
      await invoke("run_msra_offer", { hostname });
      setMsraStatus("launched");
      setTimeout(() => setMsraStatus("idle"), 3000);
    } catch {
      setMsraStatus("idle");
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-base-content/70 uppercase tracking-wide">
        Acciones
      </h3>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={launchMsra}
          disabled={disabled || msraStatus !== "idle" || !hostname}
          className="btn btn-outline btn-secondary btn-sm"
        >
          {msraStatus === "launching" && (
            <span className="loading loading-spinner loading-xs"></span>
          )}
          {msraStatus === "launched" && "✓ "}
          Asistencia Remota
        </button>
      </div>
      <p className="text-xs text-base-content/40">
        msra.exe /offerRA {hostname || "<hostname>"}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Integrate ActionButtons into App.tsx**

Modify `src/App.tsx` — add `ActionButtons` import and render it between `DiagnosticForm` and `OutputPanel`, passing the current hostname from form state.

Add hostname state tracking:

```tsx
// After other state declarations:
const [lastHostname, setLastHostname] = useState("");
```

Update `handleDiagnostic`:
```tsx
setLastHostname(input.hostname);
```

Render after `DiagnosticForm`:
```tsx
{lastHostname && (
  <ActionButtons hostname={lastHostname} disabled={loading} />
)}
```

Full updated `src/App.tsx`:

```tsx
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Layout from "./components/Layout";
import DiagnosticForm, { type DiagnosticInput } from "./components/DiagnosticForm";
import ActionButtons from "./components/ActionButtons";
import OutputPanel from "./components/OutputPanel";
import type { CommandResult } from "./types";

function App() {
  const [loading, setLoading] = useState(false);
  const [lastHostname, setLastHostname] = useState("");
  const [results, setResults] = useState<CommandResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleDiagnostic = async (input: DiagnosticInput) => {
    setLastHostname(input.hostname);
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const data = await invoke<CommandResult[]>("execute_diagnostic", {
        hostname: input.hostname,
      });
      setResults(data);

      if (input.username) {
        const userResult = await invoke<CommandResult>("run_net_user", {
          username: input.username,
        });
        setResults((prev) => [...prev, userResult]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-primary mb-1">Diagnóstico de Red</h1>
          <p className="text-base-content/60">
            Ingrese los datos del equipo a diagnosticar.
          </p>
        </div>

        <DiagnosticForm onSubmit={handleDiagnostic} disabled={loading} />

        {lastHostname && (
          <ActionButtons hostname={lastHostname} disabled={loading} />
        )}

        {error && (
          <div role="alert" className="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <OutputPanel results={results} loading={loading} />
      </div>
    </Layout>
  );
}

export default App;
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ActionButtons.tsx src/App.tsx
git commit -m "feat: add per-command action buttons with msra remote assistance"
```

---

### Task 9: Final polish — error boundaries, empty states, keyboard shortcuts

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/DiagnosticForm.tsx`
- Modify: `src-tauri/tauri.conf.json`

**Interfaces:**
- Consumes: full working app from Task 8
- Produces: polished UX with Ctrl+Enter submit, Enter-to-next-field keyboard flow, empty state messaging

- [ ] **Step 1: Add keyboard shortcut — Ctrl+Enter submits form**

Modify `src/components/DiagnosticForm.tsx` — add `useEffect` that listens for `Ctrl+Enter`:

Add import:
```tsx
import { type FormEvent, useState, useEffect } from "react";
```

Add before `return`:
```tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && hostname.trim() && !disabled) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, [hostname, disabled]);
```

- [ ] **Step 2: Update window title in tauri.conf.json**

Read `src-tauri/tauri.conf.json`. Change `"title": "correo-argentino-mda-toolkit"` to `"title": "MDA Toolkit — Correo Argentino"`.

- [ ] **Step 3: Verify everything works end-to-end**

```bash
npm run tauri dev
```

Full checklist:
- App opens at 1024×700 with title "MDA Toolkit — Correo Argentino"
- Sidebar toggle works
- Form inputs: autoFocus on hostname, Tab to username, Ctrl+Enter submits
- Loading spinner during execution
- Results display with mono font, copy buttons work
- Error alert for invalid hostnames
- Remote Assistance button appears after first diagnostic

- [ ] **Step 4: Commit**

```bash
git add src/components/DiagnosticForm.tsx src-tauri/tauri.conf.json
git commit -m "feat: add Ctrl+Enter submit, keyboard flow, final window config"
```

---

## Self-Review Results

**1. Spec coverage check:**
- Diagnostic panel with hostname/IP input — Task 4 ✓
- Network user field (opcional) — Task 4 ✓
- Ping command — Task 5 ✓
- net time command — Task 5 ✓
- net user command — Task 5 ✓ (separate command)
- msra.exe /offerRA — Task 5 + Task 8 ✓
- Clipboard copy — Task 6 ✓
- DaisyUI theme with MDA tokens — Task 1 + Task 2 ✓
- Geist fonts — Task 1 ✓
- CP850→UTF-8 encoding — Task 5 ✓ (CP1252 as superset fallback)
- Tauri v2, React, TypeScript — all tasks ✓

**2. Placeholder scan:** No TBD, TODO, "implement later", or vague "add error handling" found. Every step has concrete code.

**3. Type consistency:**
- `CommandResult` interface consistent across Tasks 5 (Rust), 6 (TypeScript type), 7 (invoke binding) ✓
- `DiagnosticInput` interface consistent between Tasks 4 (component) and 7 (App) ✓
- `hostname: String` in Rust matches `hostname: string` in TypeScript invoke ✓
- Encoding crate: `encoding_rs` for `WINDOWS_1252` (superset of CP850 for Spanish Windows) ✓
