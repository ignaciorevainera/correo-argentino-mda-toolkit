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
    <div className="bg-base-100 border border-base-300 p-3 flex flex-col gap-2 rounded">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-secondary">Asistencia Remota</h3>
        <button
          onClick={launch}
          disabled={isDisabled}
          className="btn btn-outline btn-secondary btn-xs"
        >
          {status === "launching" && (
            <span className="loading loading-spinner loading-xs"></span>
          )}
          {status === "launched" && "✓ "}
          {status === "idle" && "Abrir"}
        </button>
      </div>
      <p className="text-xs text-base-content/50 font-mono truncate">
        msra.exe /offerRA {hostname || "<hostname>"}
      </p>
    </div>
  );
}
