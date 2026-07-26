import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useClipboard } from "../hooks/useClipboard";
import type { StreamLinePayload, StreamDonePayload } from "../types";

interface DiagnosticCardProps {
  title: string;
  command: string;
  hostname: string;
  executeTrigger: number;
  disabled?: boolean;
  requiresHostname?: boolean;
  extraInput?: {
    key: string;
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
  };
}

function OutputBlock({ lines, exitCode }: { lines: string[]; exitCode: number | null }) {
  const { copied, copy } = useClipboard();
  const outputText = lines.join("\n");
  const hasOutput = lines.length > 0;
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length]);

  return (
    <div className="border border-base-300 overflow-hidden rounded">
      <div className="flex items-center justify-between px-2 py-1 bg-base-300/30 border-b border-base-300">
        <span className={`badge badge-xs ${exitCode === null ? "badge-warning" : exitCode === 0 ? "badge-outline" : "badge-error"}`}>
          {exitCode !== null ? `exit ${exitCode}` : "en curso"}
        </span>
        <button
          onClick={() => copy(outputText)}
          className="btn btn-ghost btn-xs text-base-content/60"
          disabled={!hasOutput}
          aria-label="Copiar salida"
        >
          {copied ? "✓" : "Copiar"}
        </button>
      </div>
      <pre className="p-2 text-xs font-mono text-base-content/80 overflow-x-auto whitespace-pre-wrap break-all max-h-40 overflow-y-auto leading-relaxed">
        {hasOutput ? outputText : <span className="text-base-content/30 italic">Sin salida</span>}
        <div ref={bottomRef} />
      </pre>
    </div>
  );
}

export default function DiagnosticCard({
  title,
  command,
  hostname,
  executeTrigger,
  disabled,
  requiresHostname = true,
  extraInput,
}: DiagnosticCardProps) {
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef(executeTrigger);
  const abortRef = useRef(false);

  const isDisabled = disabled || (requiresHostname && !hostname.trim());

  const execute = useCallback(async () => {
    if (loading) return;
    abortRef.current = false;
    setLoading(true);
    setError(null);
    setLines([]);
    setExitCode(null);

    const runId = `${title}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const unlistenLine = await listen<StreamLinePayload>("command-line", (event) => {
      if (event.payload.id === runId && !abortRef.current) {
        setLines((prev) => [...prev, event.payload.text]);
      }
    });

    const unlistenDone = await listen<StreamDonePayload>("command-done", (event) => {
      if (event.payload.id === runId && !abortRef.current) {
        setExitCode(event.payload.exit_code);
        setLoading(false);
        unlistenLine();
        unlistenDone();
      }
    });

    try {
      await invoke("run_command_stream", { id: runId, command });
    } catch (err) {
      if (!abortRef.current) {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
        unlistenLine();
        unlistenDone();
      }
    }
  }, [command, loading, title]);

  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (executeTrigger !== 0 && executeTrigger !== triggerRef.current) {
      triggerRef.current = executeTrigger;
      if (!isDisabled) {
        execute();
      }
    }
  }, [executeTrigger, execute, isDisabled]);

  return (
    <div className="bg-base-100 border border-base-300 p-3 flex flex-col gap-2 rounded">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-secondary">{title}</h3>
        <button
          onClick={execute}
          disabled={isDisabled || loading}
          className="btn btn-primary btn-xs"
        >
          {loading ? (
            <span className="loading loading-spinner loading-xs"></span>
          ) : (
            "Ejecutar"
          )}
        </button>
      </div>

      {extraInput && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-base-content/60 shrink-0 font-mono">
            net user
          </span>
          <input
            type="text"
            value={extraInput.value}
            onChange={(e) => extraInput.onChange(e.target.value)}
            placeholder={extraInput.placeholder}
            className="input input-xs w-full font-mono"
            disabled={isDisabled || loading}
          />
          <span className="text-xs text-base-content/40 shrink-0 font-mono">
            /domain
          </span>
        </div>
      )}

      {error && (
        <div className="text-xs text-error bg-error/10 px-2 py-1 rounded">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-1.5 text-xs text-base-content/50 py-1">
          <span className="loading loading-spinner loading-xs text-primary"></span>
          Ejecutando...
        </div>
      )}

      {(lines.length > 0 || exitCode !== null) && (
        <OutputBlock lines={lines} exitCode={exitCode} />
      )}

      {lines.length === 0 && !loading && !error && exitCode === null && (
        <div className="text-xs text-base-content/30 italic py-4 text-center">
          Presione Ejecutar
        </div>
      )}
    </div>
  );
}
