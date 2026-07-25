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
