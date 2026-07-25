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
