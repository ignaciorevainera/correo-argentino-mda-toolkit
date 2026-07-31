# Command Popup Window UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign command popup windows — remove close button and native title bar, show executed command in header, add copy-to-clipboard button, close only via Escape key.

**Architecture:** Two-file change. `App.tsx` adds `decorations: false` to WebviewWindow options (removes native OS title bar). `CommandView.tsx` rewrites header to show title + command + copy button, removes ✕ close button, adds Escape key handler. Rust backend untouched — `CREATE_NO_WINDOW` and streaming unchanged.

**Tech Stack:** React 19 + TypeScript strict, Tauri v2 (`WebviewWindow`, `getCurrentWebviewWindow`, `@tauri-apps/plugin-clipboard-manager`). No new dependencies — clipboard plugin already installed and registered.

## Global Constraints

- No new dependencies, no `package.json` changes, no `Cargo.toml` changes.
- Do not touch Rust backend (`src-tauri/`), capabilities, CSP, `tauri.conf.json`.
- `npm run build` must pass (tsc strict + vite). `noUnusedLocals`, `noUnusedParameters`.
- Close mechanism: Escape key only. No close button. No auto-close.
- Copy button copies full command output (`lines.join("\n")`).
- Header shows title AND command string (title large, command smaller monospace).
- Applies to all command popups (ping, net user, nslookup, net time, msra, router IP).
- `@tauri-apps/plugin-clipboard-manager` already installed — use `writeText()` from it.
- No native OS title bar — `decorations: false` on all `result-*` windows.

---

### Task 1: Remove native title bar from popup windows

**Files:**
- Modify: `src/App.tsx:139-145`

**Interfaces:**
- Consumes: `WebviewWindow` from `@tauri-apps/api/webviewWindow` (already imported, line 6).
- Produces: popup windows open without native OS title bar.

- [ ] **Step 1: Add `decorations: false` to WebviewWindow options**

In `src/App.tsx`, inside `openWindow`, add `decorations: false` to the `WebviewWindow` constructor options. The current code at lines 139-145:

```tsx
      const win = new WebviewWindow(`result-${Date.now()}`, {
        url,
        width: 600,
        height: 400,
        title: cfg.title,
        resizable: true,
      });
```

Change to:

```tsx
      const win = new WebviewWindow(`result-${Date.now()}`, {
        url,
        width: 600,
        height: 400,
        title: cfg.title,
        resizable: true,
        decorations: false,
      });
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: tsc passes, vite builds successfully. No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: remove native title bar from command popup windows"
```

---

### Task 2: Rewrite popup header — title + command + copy button + Escape close

**Files:**
- Modify: `src/CommandView.tsx:1-107`

**Interfaces:**
- Consumes: `lines` from `useCommandStream()` hook (string array, already available), `title` and `command` from URL params (already extracted), `getCurrentWebviewWindow` from `@tauri-apps/api/webviewWindow` (already imported, line 2), `writeText` from `@tauri-apps/plugin-clipboard-manager`.
- Produces: header with title + command + copy button, Escape key closes window, no ✕ button.

- [ ] **Step 1: Add imports**

In `src/CommandView.tsx` line 1, add `useState` to the React import:

```tsx
import { useEffect, useRef, useState } from "react";
```

Add clipboard import after the webviewWindow import (line 2):

```tsx
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
```

- [ ] **Step 2: Add copy state and Escape handler**

Between the `executedRef` logic and the `handleClose` function (lines 49-58), add:

```tsx
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        getCurrentWebviewWindow().close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleCopy = async () => {
    await writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
```

Note: `useState` and `useEffect` are already imported from React (line 1). No import change needed.

- [ ] **Step 3: Remove old close handler**

Delete the `handleClose` function (currently lines 56-58):

```tsx
  const handleClose = () => {
    getCurrentWebviewWindow().close();
  };
```

Remove these three lines entirely.

- [ ] **Step 4: Rewrite the header JSX**

Replace the current header block (lines 67-72):

```tsx
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-sm font-semibold text-secondary truncate">{title}</h1>
        <button onClick={handleClose} className="btn btn-ghost btn-xs" aria-label="Cerrar">
          ✕
        </button>
      </div>
```

With the new header block:

```tsx
      <div className="flex items-start justify-between shrink-0 gap-2">
        <div className="min-w-0 flex flex-col">
          <h1 className="text-sm font-semibold text-secondary truncate">{title}</h1>
          <span className="text-xs font-mono text-base-content/50 truncate">{command}</span>
        </div>
        <button
          onClick={handleCopy}
          className="btn btn-ghost btn-xs shrink-0"
          aria-label="Copiar al portapapeles"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: tsc passes, vite builds successfully. No type errors, no unused imports/variables.

- [ ] **Step 6: Commit**

```bash
git add src/CommandView.tsx
git commit -m "feat: add command display, copy button, and escape close to popup header"
```
