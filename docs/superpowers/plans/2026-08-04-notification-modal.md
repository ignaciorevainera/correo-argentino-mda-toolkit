# Sistema de Modal de Notificaciones — Plan de Implementación

> **Para agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Reemplazar el toast inline actual por un sistema de notificaciones modal global (error / info / warning) accesible desde cualquier componente via React Context.

**Architecture:** Un React Context (`NotificationContext`) expone `showNotification(title, message, type)` y mantiene estado de notificación activa. Un componente `NotificationModal` usa `<dialog>` nativo + clases DaisyUI `modal` (mismo patrón que SettingsModal) para renderizar el modal. El provider se monta en `main.tsx` envolviendo toda la app. `App.tsx` consume el hook `useNotification` y reemplaza todas las llamadas a `showStatus` por `showNotification`.

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS v4, DaisyUI v5, native `<dialog>` element.

## Global Constraints

- TypeScript strict mode: `noUnusedLocals: true`, `noUnusedParameters: true` — variables/parámetros sin uso causan error de build.
- DaisyUI v5 via `@plugin "daisyui"` en `src/index.css` — no `tailwind.config.js`.
- Modal usa `<dialog>` nativo (mismo patrón que `SettingsModal.tsx`).
- No hay framework de tests — verificación via `npm run build` (tsc + vite build).
- Estilo de código: componentes funcionales, hooks, interfaces con `interface` keyword (no `type` para objetos).
- Sin comentarios en el código fuente (convención del proyecto).

---

### Task 1: Crear NotificationContext

**Files:**
- Create: `src/contexts/NotificationContext.tsx`

**Interfaces:**
- Produces: `NotificationProvider` (componente React), `useNotification()` (hook que retorna `{ showNotification, closeNotification }`), `NotificationType = "error" | "info" | "warning"`, `NotificationPayload = { title: string; message: string; type: NotificationType }`

- [ ] **Step 1: Crear el archivo del contexto**

```tsx
import { createContext, useContext, useState, useCallback } from "react";

export type NotificationType = "error" | "info" | "warning";

export interface NotificationPayload {
  title: string;
  message: string;
  type: NotificationType;
}

interface NotificationContextValue {
  showNotification: (payload: NotificationPayload) => void;
  closeNotification: () => void;
  notification: NotificationPayload | null;
  isOpen: boolean;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notification, setNotification] = useState<NotificationPayload | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const showNotification = useCallback((payload: NotificationPayload) => {
    setNotification(payload);
    setIsOpen(true);
  }, []);

  const closeNotification = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification, closeNotification, notification, isOpen }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return ctx;
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: PASS (el archivo compila sin errores, aunque nadie lo usa aún — verificar que `noUnusedLocals` no lo marque).

- [ ] **Step 3: Commit**

```bash
git add src/contexts/NotificationContext.tsx
git commit -m "feat: add NotificationContext for global modal notifications"
```

---

### Task 2: Crear componente NotificationModal

**Files:**
- Create: `src/components/NotificationModal.tsx`

**Interfaces:**
- Consumes: `NotificationPayload`, `NotificationType` de `../contexts/NotificationContext`; `useNotification()` hook
- Produces: `<NotificationModal />` componente — auto-renderiza dentro del provider, no requiere props

- [ ] **Step 1: Crear el archivo del modal**

```tsx
import { useEffect, useRef } from "react";
import { useNotification, type NotificationPayload } from "../contexts/NotificationContext";

const iconMap: Record<NotificationPayload["type"], string> = {
  error: "✕",
  info: "i",
  warning: "!",
};

const headerClassMap: Record<NotificationPayload["type"], string> = {
  error: "bg-error text-error-content",
  info: "bg-info text-info-content",
  warning: "bg-warning text-warning-content",
};

export default function NotificationModal() {
  const { notification, isOpen, closeNotification } = useNotification();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && notification) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen, notification]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      closeNotification();
    };

    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [closeNotification]);

  if (!notification) return null;

  const headerClass = headerClassMap[notification.type];

  return (
    <dialog ref={dialogRef} className="modal">
      <div className="modal-box w-11/12 max-w-sm p-0 overflow-hidden">
        <div className={`flex items-center gap-2 px-5 py-3 ${headerClass}`}>
          <span className="text-lg font-bold opacity-80">{iconMap[notification.type]}</span>
          <h3 className="font-semibold text-sm flex-1">{notification.title}</h3>
        </div>
        <div className="px-5 py-3">
          <p className="text-sm text-base-content/70 whitespace-pre-wrap break-all">
            {notification.message}
          </p>
        </div>
        <div className="modal-action px-5 pb-3 mt-0">
          <form method="dialog">
            <button className="btn btn-sm">Cerrar</button>
          </form>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/NotificationModal.tsx
git commit -m "feat: add NotificationModal component using DaisyUI dialog"
```

---

### Task 3: Integrar Provider y Modal en main.tsx

**Files:**
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `NotificationProvider` de `./contexts/NotificationContext`, `NotificationModal` de `./components/NotificationModal`

- [ ] **Step 1: Modificar main.tsx**

Reemplazar el contenido completo de `src/main.tsx`:

```tsx
import "./index.css";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import CommandView from "./CommandView";
import ErrorBoundary from "./components/ErrorBoundary";
import { NotificationProvider } from "./contexts/NotificationContext";
import NotificationModal from "./components/NotificationModal";
import { initializeSettings } from "./utils/settings";

initializeSettings();

const params = new URLSearchParams(window.location.search);
const isPopup = params.has("type");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <ErrorBoundary>
      <NotificationProvider>
        {isPopup ? <CommandView /> : <App />}
        <NotificationModal />
      </NotificationProvider>
    </ErrorBoundary>
  </StrictMode>,
);
```

- [ ] **Step 2: Verificar que compila y build funciona**

Run: `npm run build`
Expected: PASS (tsc + vite build sin errores)

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx
git commit -m "feat: wrap app with NotificationProvider and Modal"
```

---

### Task 4: Reemplazar toast inline en App.tsx por notificaciones modales

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useNotification` de `./contexts/NotificationContext`
- Removes: estado `status`, callback `showStatus`, div inline del toast

- [ ] **Step 1: Agregar import de useNotification**

En `src/App.tsx`, agregar el import después de los imports existentes (antes de la línea `export function useUpdater()`):

```typescript
import { useNotification } from "./contexts/NotificationContext";
```

- [ ] **Step 2: Reemplazar estado `status` y `showStatus` por el hook**

Eliminar la línea 157:
```typescript
const [status, setStatus] = useState<{ msg: string; type: "error" | "ok" } | null>(null);
```

Eliminar las líneas 161-164 (el callback `showStatus`):
```typescript
const showStatus = useCallback((msg: string, type: "error" | "ok") => {
  setStatus({ msg, type });
  setTimeout(() => setStatus(null), 4000);
}, []);
```

Agregar en su lugar (después de la línea 159, donde están los hooks `useInputHistory`):
```typescript
const { showNotification } = useNotification();
```

- [ ] **Step 3: Verificar que `useState`, `useCallback` siguen siendo necesarios**

`useState` se usa para `hostname`, `username`. `useCallback` ya no se usa — verificar con `npx tsc --noEmit`. Si `useCallback` no se usa en ningún otro lado, removerlo del import de React en línea 1:

```typescript
import { useState, useEffect } from "react";
```

- [ ] **Step 4: Reemplazar todas las llamadas a `showStatus` por `showNotification`**

**IP inválida en openWindow (línea ~175):**
```typescript
// Antes:
showStatus(`Dirección IP incompleta o inválida: ${classification.value}`, "error");
// Después:
showNotification({ title: "Dirección IP inválida", message: `El valor ingresado no es una IP válida: ${classification.value}`, type: "error" });
```

**Error de resolve_host (línea ~194):**
```typescript
// Antes:
showStatus(err instanceof Error ? err.message : String(err), "error");
// Después:
showNotification({ title: "Error de resolución DNS", message: err instanceof Error ? err.message : String(err), type: "error" });
```

**Error de creación de ventana — listener tauri://error (línea ~213-218):**
```typescript
// Antes:
showStatus(`Error al crear ventana: ${msg}`, "error");
// Después:
showNotification({ title: "Error al crear ventana", message: msg, type: "error" });
```

**Error de creación de ventana — catch (línea ~220):**
```typescript
// Antes:
showStatus(`Error al abrir ventana: ${err instanceof Error ? err.message : String(err)}`, "error");
// Después:
showNotification({ title: "Error al abrir ventana", message: err instanceof Error ? err.message : String(err), type: "error" });
```

**IP inválida en launchMsra (línea ~228):**
```typescript
// Antes:
showStatus(`Dirección IP incompleta o inválida: ${classification.value}`, "error");
// Después:
showNotification({ title: "Dirección IP inválida", message: `El valor ingresado no es una IP válida: ${classification.value}`, type: "error" });
```

**Error de msra (línea ~241):**
```typescript
// Antes:
showStatus(err instanceof Error ? err.message : String(err), "error");
// Después:
showNotification({ title: "Error al ejecutar msra", message: err instanceof Error ? err.message : String(err), type: "error" });
```

**IP inválida en launchVnc (línea ~249):**
```typescript
// Antes:
showStatus(`Dirección IP incompleta o inválida: ${classification.value}`, "error");
// Después:
showNotification({ title: "Dirección IP inválida", message: `El valor ingresado no es una IP válida: ${classification.value}`, type: "error" });
```

**Error de vnc (línea ~262):**
```typescript
// Antes:
showStatus(err instanceof Error ? err.message : String(err), "error");
// Después:
showNotification({ title: "Error al ejecutar VNC", message: err instanceof Error ? err.message : String(err), type: "error" });
```

- [ ] **Step 5: Eliminar el div del toast inline**

Eliminar las líneas 282-286 (el bloque condicional que renderiza el toast):
```tsx
{status && (
  <div className={`text-xs px-2 py-1 rounded ${status.type === "error" ? "bg-error/10 text-error" : "bg-success/10 text-success"}`}>
    {status.msg}
  </div>
)}
```

- [ ] **Step 6: Verificar que compila**

Run: `npm run build`
Expected: PASS (tsc + vite build sin errores). Si `useCallback` fue removido del import y `tsc` no se queja, todo OK.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: replace inline toast with modal notifications in App"
```

---

### Task 5: Verificación final de build completo

**Files:**
- None (solo verificación)

- [ ] **Step 1: Build completo**

Run: `npm run build`
Expected: PASS. TypeScript `tsc` sin errores, Vite build exitoso.

- [ ] **Step 2: Verificar que no hay variables/imports sin uso**

Run: `npx tsc --noEmit`
Expected: PASS sin warnings de `noUnusedLocals` o `noUnusedParameters`.

- [ ] **Step 3: Commit de verificaciones (si hubo ajustes)**

Si no hubo cambios, este commit se omite.

---
