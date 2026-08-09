import { useEffect, useRef, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useCommandStream } from "./hooks/useCommandStream";
import TitleBar from "./components/TitleBar";

export default function CommandView() {
  const params = new URLSearchParams(window.location.search);
  const title = params.get("title") || "Resultado";
  const command = params.get("command") || "";

  const { execute, stop, loading, lines, exitCode, error } = useCommandStream();
  const executedRef = useRef(false);

  useEffect(() => {
    if (!executedRef.current && command) {
      executedRef.current = true;
      execute(command);
    }
  }, [execute, command]);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.repeat) {
        await stop();
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

  const outputText = lines.join("\n") + (exitCode !== null ? `\nexit ${exitCode}` : "");
  const hasOutput = lines.length > 0;

  const handleClose = async () => {
    await stop();
    getCurrentWebviewWindow().close();
  };

  return (
    <div className="h-screen flex flex-col bg-base-100 text-base-content overflow-hidden">
      <TitleBar title={title} onClose={handleClose}>
        {loading && (
          <button
            onClick={stop}
            className="btn btn-error btn-xs"
            aria-label="Detener comando"
          >
            Detener
          </button>
        )}
        <button
          onClick={handleCopy}
          className="btn btn-ghost btn-xs text-xs"
          aria-label="Copiar al portapapeles"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </TitleBar>

      <div className="flex-1 flex flex-col gap-2 p-3 min-h-0 overflow-y-auto">
        <span className="text-[10px] font-mono text-base-content/50 truncate -mt-2 px-1 select-none pointer-events-none">
          {command}
        </span>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-base-content/50 py-2">
            <span className="loading loading-spinner loading-sm text-primary"></span>
            Ejecutando...
          </div>
        )}

        {error && (
          <div className="text-xs text-error bg-error/10 px-2 py-1 rounded">{error}</div>
        )}

        {!loading && (
          <pre className="text-xs font-mono text-base-content/80 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed flex-1 border border-base-300 rounded p-2">
            {hasOutput || exitCode !== null ? outputText : <span className="text-base-content/30 italic">Sin salida</span>}
          </pre>
        )}
      </div>
    </div>
  );
}
