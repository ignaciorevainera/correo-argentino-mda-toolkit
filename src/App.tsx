import { useState, useEffect, useCallback } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { getCurrentWindow } from "@tauri-apps/api/window";
import GlobalHeader from "./components/GlobalHeader";
import { useInputHistory } from "./hooks/useInputHistory";
import { classifyIpInput } from "./utils/ip";
import { version } from "../package.json";

export function useUpdater() {
  useEffect(() => {
    async function verificarActualizaciones() {
      try {
        const update = await check();
        if (update) {
          await update.downloadAndInstall();
          await relaunch();
        }
      } catch (error) {
        console.error("Error al buscar actualizaciones:", error);
      }
    }

    verificarActualizaciones();
  }, []);
}

function routerIp(hostname: string): string {
  const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
  if (!isIp) return hostname;
  const lastDot = hostname.lastIndexOf(".");
  return lastDot > 0 ? hostname.slice(0, lastDot) + ".250" : hostname;
}

type ActionType = "ping" | "router" | "ping-t" | "router-t" | "nslookup" | "nettime" | "netuser";

function actionConfig(type: ActionType, hostname: string, username: string) {
  switch (type) {
    case "ping":
      return { type: "ping" as const, title: `Ping — ${hostname}`, command: `ping -n 4 ${hostname}` };
    case "router":
      return { type: "ping" as const, title: `Ping Router — ${routerIp(hostname)}`, command: `ping -n 2 ${routerIp(hostname)}` };
    case "ping-t":
      return { type: "ping" as const, title: `Ping continuo — ${hostname}`, command: `ping -t ${hostname}` };
    case "router-t":
      return { type: "ping" as const, title: `Ping continuo Router — ${routerIp(hostname)}`, command: `ping -t ${routerIp(hostname)}` };
    case "nslookup":
      return { type: "text" as const, title: `nslookup — ${hostname}`, command: `nslookup ${hostname}` };
    case "nettime":
      return { type: "text" as const, title: `net time — ${hostname}`, command: `net time \\\\${hostname}` };
    case "netuser":
      return { type: "text" as const, title: `net user /domain — ${username}`, command: `net user ${username} /domain` };
  }
}

function App() {
  useUpdater();

  const [hostname, setHostname] = useState("");

  useEffect(() => {
    let active = true;
    const setupShortcut = async () => {
      try {
        await register("CommandOrControl+Space", async (event) => {
          if (event.state === "Pressed") {
            const win = getCurrentWindow();
            await win.show();
            await win.unminimize();
            await win.setFocus();
            
            const text = await readText();
            if (text) {
              setHostname(text);
              document.getElementById("global-hostname")?.focus();
            }
          }
        });
        if (!active) {
          await unregister("CommandOrControl+Space");
        }
      } catch (err) {
        console.error("Shortcut error:", err);
      }
    };

    setupShortcut();

    return () => {
      active = false;
      unregister("CommandOrControl+Space").catch(() => {});
    };
  }, []);

  useEffect(() => {
    const win = getCurrentWindow();
    const unlisten = win.onCloseRequested((event) => {
      event.preventDefault();
      win.hide();
    });
    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<{ msg: string; type: "error" | "ok" } | null>(null);

  const { addHistory, handleKeyDown, resetIndex } = useInputHistory(setHostname, 20);

  const showStatus = useCallback((msg: string, type: "error" | "ok") => {
    setStatus({ msg, type });
    setTimeout(() => setStatus(null), 4000);
  }, []);

  const trimmedHost = hostname.trim();
  const trimmedUser = username.trim();
  const hostEnabled = trimmedHost.length > 0;
  const userEnabled = trimmedUser.length > 0;

  const openWindow = async (type: ActionType) => {
    const classification = classifyIpInput(trimmedHost);

    if (classification.kind === "invalid-ip" && type !== "netuser") {
      showStatus(`Dirección IP incompleta o inválida: ${classification.value}`, "error");
      return;
    }

    if (hostEnabled && type !== "netuser") {
      addHistory(trimmedHost);
    }
    const targetHost = classification.kind === "ip" || classification.value.toLowerCase().endsWith(".correo.local")
      ? classification.value
      : `${classification.value}.correo.local`;
    const cfg = actionConfig(type, targetHost, trimmedUser);
    const params = new URLSearchParams({ type: cfg.type, title: cfg.title, command: cfg.command });
    const url = `/?${params.toString()}`;

    try {
      const win = new WebviewWindow(`result-${Date.now()}`, {
        url,
        width: 600,
        height: 400,
        title: cfg.title,
        resizable: false,
        maximizable: false,
        decorations: false,
      });
      win.once("tauri://error", (e: unknown) => {
        const msg = e instanceof Object && "payload" in (e as object)
          ? String((e as { payload: unknown }).payload)
          : String(e);
        showStatus(`Error al crear ventana: ${msg}`, "error");
      });
    } catch (err) {
      showStatus(`Error al abrir ventana: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  };

  return (
    <div
      className="h-screen flex flex-col gap-2 bg-base-100 p-2 text-base-content"
      data-theme="mda"
    >
      <GlobalHeader 
        hostname={hostname} 
        onHostnameChange={(val) => {
          setHostname(val);
          resetIndex();
        }}
        onKeyDown={(e) => {
          handleKeyDown(e);
          if (e.key === "Enter" && hostEnabled) {
            openWindow("ping");
          }
        }} 
      />

      {status && (
        <div className={`text-xs px-2 py-1 rounded ${status.type === "error" ? "bg-error/10 text-error" : "bg-success/10 text-success"}`}>
          {status.msg}
        </div>
      )}

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
            aria-label="Ping continuo"
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
            aria-label="Ping continuo"
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

      <div className="flex items-center gap-1">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="usuario de red"
          className="input input-sm w-full font-mono text-xs"
          autoComplete="off"
        />
        <button
          onClick={() => openWindow("netuser")}
          disabled={!userEnabled}
          className="btn btn-primary btn-sm shrink-0"
        >
          net user /do
        </button>
      </div>
      <div className="flex justify-between items-center text-[9px] text-base-content/40 px-1 mt-auto select-none">
        <span></span>
        <span>v{version}</span>
      </div>
    </div>
  );
}

export default App;
