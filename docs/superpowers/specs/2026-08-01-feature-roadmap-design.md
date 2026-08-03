# Correo Argentino MDA Toolkit — Feature Roadmap

Spec de nuevas funcionalidades para implementar incrementalmente. Cada seccion es autocontenida: se puede implementar, testear y deployar de forma independiente.

Estado actual (previo a este spec): ping / ping -t / ping .250 / ping -t .250 / ping .231 / ping -t .231 / nslookup / net time / net user /domain. Ventana emergente con streaming en vivo raw output + auto-scroll. Tray icon + Ctrl+Space global shortcut + updater.

---

## ~~1. MSRA — Asistencia Remota~~ (Completado)

**Que es:** Boton que lanza `msra.exe /offerRA <hostname>` para tomar control remoto de una PC Windows del usuario.

**Backend:** Ya implementado. `run_msra_offer` en `src-tauri/src/lib.rs:159`. Usa `StdCommand` con `CREATE_NO_WINDOW` — no abre consola. No hay ventana emergente web; MSRA tiene su propia UI nativa.

**Frontend:** Boton nuevo en App.tsx. Handler directo:

```ts
const launchMsra = async () => {
  const targetHost = ...; // misma logica de clasificacion que openWindow
  try {
    await invoke("run_msra_offer", { hostname: targetHost });
  } catch (err) {
    showStatus(err.message, "error");
  }
};
```

- **Label:** `msra`
- **Color sugerido:** `btn-info`
- **Row:** Junto a nslookup y net time en la fila de diagnosticos
- **Estado:** deshabilitado si `!hostEnabled`
- **Resolucion:** Si es hostname, resuelve a `.correo.local`

**Files tocados:** `src/App.tsx` (+1 boton, +1 handler)

---

## ~~2. UltraVNC — Conexion Remota VNC~~ (Completado)

**Que es:** Boton que lanza `vncviewer.exe <hostname>` para conectar via VNC a maquinas Ubuntu/Debian.

**Backend nuevo:** `src-tauri/src/lib.rs`

```rust
#[tauri::command]
fn run_vnc(hostname: String) -> Result<(), String> {
    StdCommand::new("vncviewer.exe")
        .creation_flags(CREATE_NO_WINDOW)
        .arg(&hostname)
        .spawn()
        .map_err(|e| format!("No se pudo abrir VNC Viewer: {}", e))?;
    Ok(())
}
```

Registrar en `invoke_handler`.

**Consideraciones:**
- El binario `vncviewer.exe` esta en PATH en todas las terminales (confirmado por usuario)
- Sin ventana emergente web. VNC Viewer abre su propia ventana nativa
- Si el binario no esta en PATH, devuelve error y lo muestra como toast
- Misma logica de resolucion de hostname → `.correo.local`

**Frontend:** Boton nuevo en App.tsx.

- **Label:** `vnc`
- **Color sugerido:** `btn-accent`
- **Row:** Diagnosticos (junto a msra, nslookup, net time)
- **Estado:** deshabilitado si `!hostEnabled`

**Files tocados:** `src-tauri/src/lib.rs` (+15 lineas), `src/App.tsx` (+1 boton, +1 handler)

---

## ~~3. ipconfig remoto via PSExec~~ (Completado)

**Que es:** Ejecuta `psexec \\<hostname> ipconfig /all` y muestra el output en ventana emergente con streaming en vivo.

**Backend:** Reutiliza `run_command_stream`. El comando se construye en el frontend, mismo patron que ping/nslookup.

**Comando:** `psexec \\<hostname> -s ipconfig /all`

**Consideraciones:**
- `psexec.exe` debe estar en PATH. Si no esta, el comando fallara y se muestra el error en la ventana emergente
- PSExec requiere credenciales de dominio — el operador ya tiene sesion abierta con su usuario de red, PSExec usa la autenticacion integrada de Windows
- Con `-s` ejecuta como SYSTEM, asegura acceso a la info de red completa
- Ventana emergente tipo `text` con streaming en vivo

**Frontend:**
- **Label:** `ipconfig` (tipo `text`, usa `openWindow`)
- **Color sugerido:** `btn-neutral`
- **Row:** Diagnosticos
- **Estado:** deshabilitado si `!hostEnabled`

**Nuevo ActionType:** `psexec`

**Files tocados:** `src/App.tsx` (+1 ActionType, +1 case en actionConfig, +1 boton)

---

## ~~4. tracert — Trace Route~~ (Completado)

**Que es:** Boton que ejecuta `tracert <hostname>` para diagnosticar la ruta de red hacia el host.

**Comando:** `tracert -d <hostname>` (flag `-d` evita resolucion DNS inversa, mas rapido)

**Implementacion:** Reutiliza `openWindow` existente. Tipo `text`.

**Frontend:**
- **Label:** `tracert`
- **Color sugerido:** `btn-neutral`
- **Row:** Diagnosticos

**Nuevo ActionType:** `tracert`

**Files tocados:** `src/App.tsx` (+1 ActionType, +1 case en actionConfig, +1 boton)

---

## 5. Exportar resultados a archivo

**Que es:** Boton "Guardar" en la ventana emergente que graba el output del comando a un archivo `.txt`.

**Implementacion:**
- Boton `[Guardar]` en el header de CommandView, junto a `[Detener]`, `[Copiar]`, `[X]`
- Click → abre dialog nativo de guardado via `tauri-plugin-dialog` (necesita agregarse)
- Guarda `lines.join("\n")` al path elegido
- Toast `"Guardado"` o error
- Nombre sugerido por defecto: `<tipo>_<hostname>_<timestamp>.txt` (ej: `ping_10.10.10.10_20260801_2230.txt`)

**Dependencia nueva:** `tauri-plugin-dialog` → `cargo add tauri-plugin-dialog && npm install @tauri-apps/plugin-dialog`. Agregar `dialog:default` a capabilities.

**Ruta alternativa sin dependencia extra:** Usar `@tauri-apps/plugin-fs` + `window.showSaveFilePicker()` (Web API) — pero el Web File API no esta disponible en WebView2 de Windows. Mejor usar `tauri-plugin-dialog`.

**Files tocados:** `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`, `package.json`, `src/CommandView.tsx`

---

## 6. Historial de hosts persistente con autocompletado

**Estado actual:** `useInputHistory` ya persiste en `localStorage` y navega con flechas ↑↓. El historial se llena al hacer cualquier accion.

**Mejora propuesta:** Agregar un dropdown/badge list debajo del input que muestre los ultimos 5-8 hostnames. Click en uno → lo rellena en el input.

**Implementacion:**
- Componente `HistoryDropdown` debajo del input en `GlobalHeader`
- Muestra chips/badges clicables con los ultimos hostnames (mas recientes primero)
- Click → `setHostname(host)` y focus en input
- Solo visible cuando el input esta enfocado o hay historial
- Estilo: `badge badge-sm badge-ghost` con DaisyUI

**Files tocados:** `src/components/GlobalHeader.tsx`, `src/hooks/useInputHistory.ts` (exponer `history` array)

---

## ~~7. Atajos de teclado numericos (1-6)~~ (Completado - extendido a 1-8 y 9-0)

**Que es:** Teclas 1-6 en la ventana principal disparan acciones. Velocidad 10x sin mouse.

**Mapeo propuesto:**

| Tecla | Accion |
|-------|--------|
| 1 | ping |
| 2 | ping -t |
| 3 | ping .250 |
| 4 | ping .231 |
| 5 | nslookup |
| 6 | msra |

Ctrl+1-6 para las variantes -t de .250, .231? O solo 6 atajos principales.

**Implementacion:** `useEffect` con `keydown` en App.tsx. Filtra por hostEnabled y tecla 1-9 (no Ctrl, no Alt). No dispara si el foco esta en un input (para no interferir con escritura).

```ts
const keyToAction: Record<string, ActionType> = {
  "1": "ping", "2": "ping-t", "3": "router",
  "4": "server", "5": "nslookup", "6": "msra",
};
```

**Pista visual:** Mostrar el numero de atajo en cada boton como subindice o badge: `ping (1)`, `ping -t (2)`, etc. Opcional — si el usuario lo prefiere.

**Files tocados:** `src/App.tsx` (+1 useEffect, pequeñas modificaciones)

---

## 8. Cerrar todas las ventanas emergentes

**Que es:** Boton o atajo que cierra todas las ventanas de resultado abiertas de una vez.

**Implementacion:**
- Backend: `#[tauri::command]` que itera `app.webview_windows()` y cierra todas las que matcheen `result-*`
- Frontend: boton `[Cerrar todo]` en App.tsx (esquina inferior izquierda) o atajo Ctrl+Shift+W
- Antes de cerrar, envia evento `stop-command` para matar procesos en ejecucion

**Backend:**
```rust
#[tauri::command]
async fn close_all_results(app: tauri::AppHandle) -> Result<(), String> {
    for (label, window) in app.webview_windows() {
        if label.starts_with("result-") {
            let _ = window.close();
        }
    }
    Ok(())
}
```

**Files tocados:** `src-tauri/src/lib.rs`, `src/App.tsx`

---

## ~~9. Modo siempre visible (on-top)~~ (Completado)

**Que es:** Toggle para mantener la ventana principal siempre encima de otras ventanas.

**Implementacion:**
- Usa `@tauri-apps/api/window` → `getCurrentWindow().setAlwaysOnTop(true/false)`
- Boton toggle en App.tsx (Header o esquina)
- Visual: icono de pin o texto `📌` con estado activo/inactivo
- Estado persiste en `localStorage`

**Permiso necesario:** `core:window:allow-set-always-on-top` en capabilities.

**Files tocados:** `src-tauri/capabilities/default.json`, `src/App.tsx`

---

## ~~10. Toggle tema oscuro~~ (Completado)

**Que es:** Switch o boton para alternar entre tema `mda` (claro) y `mda-dark` (oscuro).

**Estado actual:** Ambos temas ya definidos en `src/index.css`. Solo tema `mda` se usa (`data-theme="mda"` hardcodeado).

**Implementacion:**
- Boton en header: icono sol/luna
- Cambia `data-theme` en el `<html>` (mejor que solo en el div raiz — afecta todas las ventanas)
- Estado persiste en `localStorage`
- Se lee al iniciar (antes del primer render) para evitar flash

```ts
const [dark, setDark] = useState(() => localStorage.getItem("theme") === "mda-dark");
useEffect(() => {
  document.documentElement.setAttribute("data-theme", dark ? "mda-dark" : "mda");
  localStorage.setItem("theme", dark ? "mda-dark" : "mda");
}, [dark]);
```

**Files tocados:** `src/App.tsx` (o `src/components/GlobalHeader.tsx`)

---

## ~~11. Sonido en ping -t al recuperar host~~ (Completado)

**Que es:** Beep audible cuando un host previamente caido vuelve a responder en ping -t. Util para monitoreo pasivo.

**Implementacion:**
- En `CommandView.tsx`, dentro del efecto que procesa `lines`, trackear estado previo del host
- Cuando la linea deja de ser timeout y pasa a tener tiempo de respuesta, emitir beep
- Usar `new Audio("data:audio/wav;base64,...")` o Web Audio API para beep corto
- Solo activo durante `loading` (ping -t esta corriendo)

**Consideracion:** Esto requiere parsear `lines` en tiempo real. Como ya se elimino `pingParser`, habria que volver a agregar una version simplificada en CommandView (solo para detectar el cambio de estado timeout → success).

**Alternativa:** No parsear, sino trackear si la ultima linea contiene "tiempo" o "time" seguido de un numero. Simple regex en el efecto.

```ts
const prevHadTimeout = useRef(false);
useEffect(() => {
  const last = lines[lines.length - 1];
  if (!last || !loading) return;
  const hasTimeout = /(tiempo|time).*(agotado|out)/i.test(last);
  if (!hasTimeout && prevHadTimeout.current) {
    new Audio(beepBase64).play().catch(() => {});
  }
  prevHadTimeout.current = hasTimeout;
}, [lines, loading]);
```

**Files tocados:** `src/CommandView.tsx`

---

## 12. Reorganizar grilla de botones

**Estado actual:**
```
[ ping         ] [ ping .250    ]
[ ping -t      ] [ ping .250 -t ]
[ ping .231    ] [ ping .231 -t ] [ nslookup ] [ net time ]
[ msra ] [ vnc ] [ ipconfig ] [ tracert ]     (nuevos)
[ ... ] [ net user /domain ]
```

**Problema:** Muchos botones en espacio chico (360x200). Hay que reorganizar con tabs o categorias.

**Propuesta:** Agregar tabs DaisyUI con 3 categorias:

**Tab 1 — "Ping":** Todos los pings actuales
```
[ ping         ] [ ping .250    ]
[ ping -t      ] [ ping .250 -t ]
[ ping .231    ] [ ping .231 -t ]
```

**Tab 2 — "Diagnostico":**
```
[ nslookup ] [ net time ]
[ ipconfig  ] [ tracert  ]
```

**Tab 3 — "Remoto":**
```
[ msra ] [ vnc ]
```

**Implementacion:**
- `tabs tabs-lift` de DaisyUI
- Estado del tab activo en `useState`
- Solo un tab visible a la vez — ahorra espacio vertical
- Los tabs estan siempre visibles, el contenido cambia

**Files tocados:** `src/App.tsx` (reestructurar JSX de la grilla)

---

## 13. Indicador de conectividad en tray icon

**Que es:** Icono en la bandeja que cambia de color segun conectividad — util para monitoreo pasivo. Por ejemplo, verde si hay ping a un host predefinido, gris si no se checkeo hoy, rojo si fallo.

**Complejidad:** Alta (requiere iconos multiples, tarea periodica en Rust, configuracion de host de referencia). **Dejar para fase 2** si hay interes.

---

## Prioridad de implementacion (recomendada)

| Orden | Feature | Por que primero |
|-------|---------|----------------|
| 1 | ~~MSRA~~ (Completado) | Backend ya existe. Solo UI. Alto impacto, 0 riesgo |
| 2 | ~~UltraVNC~~ (Completado) | Nuevo comando simple. Alto valor para operadores |
| 3 | Reorganizar grilla (tabs) | Previo a agregar mas botones, ordena el espacio |
| 4 | ~~ipconfig~~ (Completado) | Reutiliza infraestructura existente |
| 5 | ~~tracert~~ (Completado) | Idem, minima adicion |
| 6 | Historial con chips | Mejora UX sustancial. ya hay datos en localStorage |
| 7 | ~~Atajos numericos~~ (Completado) | Productividad para operadores frecuentes |
| 8 | Exportar a archivo | Requiere nueva dependencia. Documenta tickets |
| 9 | Modo on-top | Util para multitarea |
| 10 | Tema oscuro | Los tokens ya existen, es solo toggle |
| 11 | Sonido ping -t | Nice-to-have |
| 12 | Cerrar todas ventanas | Util pero menos prioritario |
| 13 | Indicador tray | Complejo — fase 2 |

---

## Dependencias nuevas requeridas

| Feature | Dependencia |
|---------|------------|
| Exportar a archivo | `tauri-plugin-dialog` (Rust + npm) |
| Modo on-top | Solo permiso en capabilities (`core:window:allow-set-always-on-top`) |

---

## Capacidades a agregar en `default.json`

```jsonc
"core:window:allow-set-always-on-top",
// si se usa dialog:
"dialog:default"
```

---

## Notas de arquitectura

- **Patron de comandos:** Todos los comandos nuevos que ejecutan binarios externos (vnc) siguen exactamente el mismo patron que `run_msra_offer`: `StdCommand` + `creation_flags(CREATE_NO_WINDOW)` + `.spawn()`. No comparten estado con `run_command_stream`.
- **Ventanas emergentes:** Los comandos tipo ping/nslookup/ipconfig/tracert usan `openWindow` → `useCommandStream` → streaming en vivo. Los comandos MSRA/VNC usan su propia UI nativa, sin ventana web.
- **Resolucion de hostname:** La logica de `classifyIpInput` + `.correo.local` + `resolve_host` (para octetos) es comun a todos los botones. Extraer a helper `resolveTargetHost(trimmedHost, type)` para no repetir.
- **Tamaño de ventana:** La ventana principal es 360x200 fija. Si con tabs + nuevos botones el contenido no entra, evaluar aumentar a 360x240.
