import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useClipboard } from "../hooks/useClipboard";
import type { CommandResult } from "../types";

interface DiagnosticCardProps {
  title: string;
  commandName: string;
  commandArgs: Record<string, string>;
  hostname: string;
  executeTrigger: number;
  disabled?: boolean;
  extraInput?: {
    key: string;
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
  };
}

function OutputBlock({ result }: { result: CommandResult }) {
  const { copied, copy } = useClipboard();
  const hasOutput = result.stdout.trim() || result.stderr.trim();
  const outputText = [result.stdout, result.stderr]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="border border-base-300 overflow-hidden rounded">
      <div className="flex items-center justify-between px-2 py-1 bg-base-300/30 border-b border-base-300">
        <span className={`badge badge-xs ${
          result.exit_code === 0 ? "badge-outline" : "badge-error"
        }`}>
          {result.exit_code !== null ? `exit ${result.exit_code}` : "error"}
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
      </pre>
    </div>
  );
}

export default function DiagnosticCard({
  title,
  commandName,
  commandArgs,
  hostname,
  executeTrigger,
  disabled,
  extraInput,
}: DiagnosticCardProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CommandResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef(executeTrigger);

  const isDisabled = disabled || !hostname.trim();

  const execute = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await invoke<CommandResult>(commandName, commandArgs);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (executeTrigger !== 0 && executeTrigger !== triggerRef.current) {
      triggerRef.current = executeTrigger;
      if (!isDisabled) {
        execute();
      }
    }
  }, [executeTrigger]);

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

      {result && <OutputBlock result={result} />}

      {!result && !loading && !error && (
        <div className="text-xs text-base-content/30 italic py-4 text-center">
          Presione Ejecutar
        </div>
      )}
    </div>
  );
}
