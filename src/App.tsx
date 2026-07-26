import { useState } from "react";
import { useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import GlobalHeader from "./components/GlobalHeader";
import PingModal from "./components/PingModal";
import TextOutputModal from "./components/TextOutputModal";

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
  const lastDot = hostname.lastIndexOf(".");
  return lastDot > 0 ? hostname.slice(0, lastDot) + ".250" : hostname;
}

type ModalType = "ping" | "router" | "nslookup" | "nettime" | "netuser";

function App() {
  useUpdater();

  const [hostname, setHostname] = useState("");
  const [username, setUsername] = useState("");
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);

  const trimmedHost = hostname.trim();
  const trimmedUser = username.trim();

  const openModal = (type: ModalType) => {
    setActiveModal(type);
  };

  const closeModal = () => {
    setActiveModal(null);
  };

  const hostEnabled = trimmedHost.length > 0;
  const userEnabled = trimmedUser.length > 0;

  return (
    <div
      className="h-screen flex flex-col bg-base-100 text-base-content"
      data-theme="mda"
    >
      <GlobalHeader hostname={hostname} onHostnameChange={setHostname} />

      <div className="flex flex-col gap-2 px-3 py-1">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => openModal("ping")}
            disabled={!hostEnabled}
            className="btn btn-primary btn-sm"
          >
            Ping
          </button>
          <button
            onClick={() => openModal("router")}
            disabled={!hostEnabled}
            className="btn btn-secondary btn-sm"
          >
            .250
          </button>
          <button
            onClick={() => openModal("nslookup")}
            disabled={!hostEnabled}
            className="btn btn-accent btn-sm"
          >
            nslookup
          </button>
          <button
            onClick={() => openModal("nettime")}
            disabled={!hostEnabled}
            className="btn btn-neutral btn-sm"
          >
            net time
          </button>
        </div>

        <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-secondary shrink-0">
              Usuario
            </span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="usuario"
              className="input input-sm w-full font-mono text-xs"
            />
            <button
              onClick={() => openModal("netuser")}
              disabled={!userEnabled}
              className="btn btn-primary btn-sm shrink-0"
            >
              net user /do
            </button>
          </div>
      </div>

      <PingModal
        open={activeModal === "ping"}
        onClose={closeModal}
        title={`Ping — ${trimmedHost}`}
        command={`ping -n 4 ${trimmedHost}`}
      />

      <PingModal
        open={activeModal === "router"}
        onClose={closeModal}
        title={`Ping Router — ${routerIp(trimmedHost)}`}
        command={`ping -n 2 ${routerIp(trimmedHost)}`}
      />

      <TextOutputModal
        open={activeModal === "nslookup"}
        onClose={closeModal}
        title={`nslookup — ${trimmedHost}`}
        command={`nslookup ${trimmedHost}`}
      />

      <TextOutputModal
        open={activeModal === "nettime"}
        onClose={closeModal}
        title={`net time — ${trimmedHost}`}
        command={`net time \\\\${trimmedHost}`}
      />

      <TextOutputModal
        open={activeModal === "netuser"}
        onClose={closeModal}
        title={`net user /domain — ${trimmedUser}`}
        command={`net user ${trimmedUser} /domain`}
      />
    </div>
  );
}

export default App;
