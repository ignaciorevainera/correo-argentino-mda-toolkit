import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNotification } from "./contexts/NotificationContext";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { getCurrentWindow } from "@tauri-apps/api/window";
import GlobalHeader from "./components/GlobalHeader";
import TitleBar from "./components/TitleBar";
import { useInputHistory } from "./hooks/useInputHistory";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { getSettings, AppSettings } from "./utils/settings";
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
  return octetIp(hostname, "250");
}

function serverIp(hostname: string): string {
  return octetIp(hostname, "231");
}

function octetIp(hostname: string, octet: string): string {
  const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
  if (!isIp) return hostname;
  const lastDot = hostname.lastIndexOf(".");
  return lastDot > 0 ? hostname.slice(0, lastDot) + "." + octet : hostname;
}

type ActionType = "ping" | "router" | "server" | "ping-t" | "router-t" | "server-t" | "nslookup" | "nettime" | "netuser" | "ipconfig" | "tracert";

function actionConfig(type: ActionType, hostname: string, username: string) {
  switch (type) {
    case "ping":
      return { type: "ping" as const, title: `Ping — ${hostname}`, command: `ping -n 4 ${hostname}` };
    case "router":
      return { type: "ping" as const, title: `Ping Router — ${routerIp(hostname)}`, command: `ping -n 4 ${routerIp(hostname)}` };
    case "server":
      return { type: "ping" as const, title: `Ping Servidor — ${serverIp(hostname)}`, command: `ping -n 4 ${serverIp(hostname)}` };
    case "ping-t":
      return { type: "ping" as const, title: `Ping continuo — ${hostname}`, command: `ping -t ${hostname}` };
    case "router-t":
      return { type: "ping" as const, title: `Ping continuo Router — ${routerIp(hostname)}`, command: `ping -t ${routerIp(hostname)}` };
    case "server-t":
      return { type: "ping" as const, title: `Ping continuo Servidor — ${serverIp(hostname)}`, command: `ping -t ${serverIp(hostname)}` };
    case "nslookup":
      return { type: "text" as const, title: `nslookup — ${hostname}`, command: `nslookup ${hostname}` };
    case "nettime":
      return { type: "text" as const, title: `net time — ${hostname}`, command: `net time \\\\${hostname}` };
    case "netuser":
      return { type: "text" as const, title: `net user /domain — ${username}`, command: `net user ${username} /domain` };
    case "ipconfig":
      return { type: "text" as const, title: `ipconfig — ${hostname}`, command: `psexec \\\\${hostname} -s ipconfig /all` };
    case "tracert":
      return { type: "text" as const, title: `tracert — ${hostname}`, command: `tracert -d ${hostname}` };
  }
}

function App() {
  useUpdater();

  const [hostname, setHostname] = useState("");
  const [settings, setSettings] = useState<AppSettings>(getSettings());

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "app_settings" && e.newValue) {
        try {
          setSettings(JSON.parse(e.newValue));
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (!hostEnabled) return;

      const keyActions: Record<string, () => void> = {
        "1": () => openWindow("ping"),
        "2": () => openWindow("ping-t"),
        "3": () => openWindow("router"),
        "4": () => openWindow("server"),
        "5": () => openWindow("nslookup"),
        "6": () => openWindow("nettime"),
        "7": () => launchMsra(),
        "8": () => launchVnc(),
        "9": () => openWindow("ipconfig"),
        "0": () => openWindow("tracert"),
      };

      const action = keyActions[e.key];
      if (action) {
        e.preventDefault();
        action();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  const [username, setUsername] = useState("");

  const { addHistory, handleKeyDown, resetIndex } = useInputHistory(setHostname, 20);

  const { showNotification } = useNotification();

  const trimmedHost = hostname.trim();
  const trimmedUser = username.trim();
  const hostEnabled = trimmedHost.length > 0;
  const userEnabled = trimmedUser.length > 0;

  const openWindow = async (type: ActionType, customHost?: string) => {
    const rawHost = customHost !== undefined ? customHost : trimmedHost;
    const hostToUse = rawHost.trim();
    const classification = classifyIpInput(hostToUse);

    if (classification.kind === "invalid-ip" && type !== "netuser") {
      showNotification({ title: "Dirección IP inválida", message: `El valor ingresado no es una IP válida: ${classification.value}`, type: "error" });
      return;
    }

    if (hostToUse.length > 0 && type !== "netuser") {
      addHistory(hostToUse);
    }
    const targetHost = classification.kind === "ip" || classification.value.toLowerCase().endsWith(".correo.local")
      ? classification.value
      : `${classification.value}.correo.local`;

    const needsOctet = type === "router" || type === "router-t" || type === "server" || type === "server-t";
    const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(targetHost);
    let effectiveHost = targetHost;

    if (needsOctet && !isIp) {
      try {
        effectiveHost = await invoke<string>("resolve_host", { hostname: targetHost });
      } catch (err) {
        showNotification({ title: "Error de resolución DNS", message: err instanceof Error ? err.message : String(err), type: "error" });
        return;
      }
    }

    const cfg = actionConfig(type, effectiveHost, trimmedUser);
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
        showNotification({ title: "Error al crear ventana", message: msg, type: "error" });
      });
    } catch (err) {
      showNotification({ title: "Error al abrir ventana", message: err instanceof Error ? err.message : String(err), type: "error" });
    }
  };

  const handleGlobalShortcut = async (action: string, clipboardText: string) => {
    const classification = classifyIpInput(clipboardText);

    if (classification.kind === "invalid-ip") {
      showNotification({
        title: "Dirección IP inválida",
        message: `El valor del portapapeles no es una IP válida: ${classification.value}`,
        type: "error",
      });
      return;
    }

    const targetHost =
      classification.kind === "ip" ||
      classification.value.toLowerCase().endsWith(".correo.local")
        ? classification.value
        : `${classification.value}.correo.local`;

    if (action === "F9") {
      openWindow("ping", targetHost);
    } else if (action === "F10") {
      let effectiveHost = targetHost;
      const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(targetHost);
      if (!isIp) {
        try {
          effectiveHost = await invoke<string>("resolve_host", {
            hostname: targetHost,
          });
        } catch (err) {
          showNotification({
            title: "Error de resolución DNS",
            message: err instanceof Error ? err.message : String(err),
            type: "error",
          });
          return;
        }
      }
      openWindow("router", effectiveHost);
    } else if (action === "F11") {
      openWindow("nettime", targetHost);
    } else if (action === "F12") {
      addHistory(targetHost);
      try {
        await invoke("run_msra_offer", { hostname: targetHost });
      } catch (err) {
        showNotification({
          title: "Error al ejecutar msra",
          message: err instanceof Error ? err.message : String(err),
          type: "error",
        });
      }
    }
  };

  useGlobalShortcuts(settings.globalShortcuts, handleGlobalShortcut);

  const launchMsra = async () => {
    const classification = classifyIpInput(trimmedHost);

    if (classification.kind === "invalid-ip") {
      showNotification({ title: "Dirección IP inválida", message: `El valor ingresado no es una IP válida: ${classification.value}`, type: "error" });
      return;
    }

    addHistory(trimmedHost);

    const targetHost = classification.kind === "ip" || classification.value.toLowerCase().endsWith(".correo.local")
      ? classification.value
      : `${classification.value}.correo.local`;

    try {
      await invoke("run_msra_offer", { hostname: targetHost });
    } catch (err) {
      showNotification({ title: "Error al ejecutar msra", message: err instanceof Error ? err.message : String(err), type: "error" });
    }
  };

  const launchVnc = async () => {
    const classification = classifyIpInput(trimmedHost);

    if (classification.kind === "invalid-ip") {
      showNotification({ title: "Dirección IP inválida", message: `El valor ingresado no es una IP válida: ${classification.value}`, type: "error" });
      return;
    }

    addHistory(trimmedHost);

    const targetHost = classification.kind === "ip" || classification.value.toLowerCase().endsWith(".correo.local")
      ? classification.value
      : `${classification.value}.correo.local`;

    try {
      await invoke("run_vnc", { hostname: targetHost });
    } catch (err) {
      showNotification({ title: "Error al ejecutar VNC", message: err instanceof Error ? err.message : String(err), type: "error" });
    }
  };

  return (
    <div className="h-screen flex flex-col bg-base-100 text-base-content overflow-hidden">
      <TitleBar title="MDA Toolkit" onClose={() => getCurrentWindow().hide()} />
      <div className="flex-1 flex flex-col gap-2 p-2 min-h-0 overflow-y-auto">
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
            -t
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
            -t
          </button>
        </div>
        <div className="flex gap-1 col-span-2 *:h-full">
          <button
            onClick={() => openWindow("server")}
            disabled={!hostEnabled}
            className="btn btn-accent btn-sm flex-1"
          >
            ping .231
          </button>
          <button
            onClick={() => openWindow("server-t")}
            disabled={!hostEnabled}
            className="btn btn-accent btn-sm btn-outline shrink-0 px-2"
            title="Ping continuo"
            aria-label="Ping continuo"
          >
            -t
          </button>
          <button
            onClick={() => openWindow("nslookup")}
            disabled={!hostEnabled}
            className="btn btn-neutral btn-sm flex-1"
          >
            nslookup
          </button>
          <button
            onClick={() => openWindow("nettime")}
            disabled={!hostEnabled}
            className="btn btn-neutral btn-sm flex-1"
          >
            net time
          </button>
        </div>
        <div className="flex gap-1 col-span-2 *:h-full">
          <button
            onClick={launchMsra}
            disabled={!hostEnabled}
            className="btn btn-info btn-sm flex-1"
          >
            msra
          </button>
          <button
            onClick={launchVnc}
            disabled={!hostEnabled}
            className="btn btn-accent btn-sm flex-1"
            title="UltraVNC a equipos Ubuntu/Debian (puerto 5901)"
            aria-label="UltraVNC Ubuntu/Debian"
          >
            vnc :5901
          </button>
        </div>
        <div className="flex gap-1 col-span-2 *:h-full">
          <button
            onClick={() => openWindow("ipconfig")}
            disabled={!hostEnabled}
            className="btn btn-neutral btn-sm flex-1"
          >
            ipconfig
          </button>
          <button
            onClick={() => openWindow("tracert")}
            disabled={!hostEnabled}
            className="btn btn-neutral btn-sm flex-1"
          >
            tracert
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && userEnabled) {
              openWindow("netuser");
            }
          }}
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
    </div>
  );
}

export default App;
