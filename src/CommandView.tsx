import { useEffect, useRef, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useCommandStream } from "./hooks/useCommandStream";
import { parsePingOutput } from "./utils/pingParser";
import type { PingResult } from "./utils/pingParser";

interface PingBarProps {
  result: PingResult;
  maxMs: number;
}

function barColor(ms: number, status: "success" | "timeout"): string {
  if (status === "timeout") return "bg-error";
  if (ms < 30) return "bg-success";
  if (ms < 100) return "bg-warning";
  return "bg-error";
}

function PingBar({ result, maxMs }: PingBarProps) {
  const width = maxMs === 0 ? 100 : Math.max((result.ms / maxMs) * 100, 3);
  const label = result.status === "timeout" ? "sin respuesta" : `${result.ms} ms`;
  const color = barColor(result.ms, result.status);

  return (
    <div className="flex items-center gap-2 py-0.5">
      <div className="w-full bg-base-300 rounded-full h-6 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-300 flex items-center justify-end pr-2`}
          style={{ width: `${width}%` }}
        >
          <span className="text-xs font-mono text-white font-semibold drop-shadow">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function CommandView() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get("type") as "ping" | "text" | null;
  const title = params.get("title") || "Resultado";
  const command = params.get("command") || "";

  const { execute, loading, lines, exitCode, error } = useCommandStream();
  const executedRef = useRef(false);

  useEffect(() => {
    if (!executedRef.current && command) {
      executedRef.current = true;
      execute(command);
    }
  }, [execute, command]);

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

  const results = type === "ping" ? parsePingOutput(lines) : [];
  const maxMs = results.reduce((max, r) => Math.max(max, r.ms), 0);
  const outputText = lines.join("\n");
  const hasOutput = lines.length > 0;

  return (
    <div className="h-screen flex flex-col bg-base-100 text-base-content p-3 gap-2">
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

      {loading && (
        <div className="flex items-center gap-2 text-sm text-base-content/50 py-2">
          <span className="loading loading-spinner loading-sm text-primary"></span>
          Ejecutando...
        </div>
      )}

      {error && (
        <div className="text-xs text-error bg-error/10 px-2 py-1 rounded">{error}</div>
      )}

      {type === "ping" && !loading && results.length > 0 && (
        <div className="flex flex-col gap-0.5 overflow-y-auto">
          {results.map((r, i) => (
            <PingBar key={i} result={r} maxMs={maxMs} />
          ))}
          {exitCode !== null && (
            <div className="text-xs text-base-content/40 mt-1 text-right">exit {exitCode}</div>
          )}
        </div>
      )}

      {type === "text" && !loading && (
        <pre className="text-xs font-mono text-base-content/80 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed flex-1 border border-base-300 rounded p-2">
          {hasOutput ? outputText : <span className="text-base-content/30 italic">Sin salida</span>}
        </pre>
      )}

      {type === "ping" && !loading && !error && results.length === 0 && exitCode !== null && (
        <div className="text-sm text-base-content/40 italic py-4 text-center">Sin resultados</div>
      )}
    </div>
  );
}
