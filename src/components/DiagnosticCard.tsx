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
    <div className="rounded-box bg-base-300/50 border border-base-300 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-base-300/30 border-b border-base-300">
        <span className={`badge badge-xs text-xs ${
          result.exit_code === 0 ? "badge-success" : "badge-error"
        }`}>
          {result.exit_code !== null ? `exit ${result.exit_code}` : "error"}
        </span>
        <button
          onClick={() => copy(outputText)}
          className="btn btn-ghost btn-xs"
          disabled={!hasOutput}
          aria-label="Copiar salida"
        >
          {copied ? "✓ Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="p-3 text-xs font-mono text-base-content/80 overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto leading-relaxed">
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
    if (executeTrigger !== triggerRef.current) {
      triggerRef.current = executeTrigger;
      if (!isDisabled && !loading) {
        execute();
      }
    }
  }, [executeTrigger]);

  return (
    <div className="rounded-box bg-base-200 border border-base-300 p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-secondary truncate">{title}</h3>
        <button
          onClick={execute}
          disabled={isDisabled || loading}
          className="btn btn-primary btn-xs shrink-0"
        >
          {loading ? (
            <span className="loading loading-spinner loading-xs"></span>
          ) : (
            "Ejecutar"
          )}
        </button>
      </div>

      {extraInput && (
        <div className="form-control w-full">
          <label className="label py-0.5">
            <span className="label-text text-xs font-medium">
              {extraInput.label}
            </span>
          </label>
          <input
            type="text"
            value={extraInput.value}
            onChange={(e) => extraInput.onChange(e.target.value)}
            placeholder={extraInput.placeholder}
            className="input input-bordered input-sm w-full font-mono text-xs"
            disabled={isDisabled || loading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && extraInput.value.trim() && !isDisabled && !loading) {
                execute();
              }
            }}
          />
        </div>
      )}

      {error && (
        <div role="alert" className="alert alert-error text-xs py-1.5">
          <span className="truncate">{error}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-base-content/50 text-xs py-1">
          <span className="loading loading-spinner loading-xs text-primary"></span>
          Ejecutando...
        </div>
      )}

      {result && <OutputBlock result={result} />}

      {!result && !loading && !error && (
        <div className="text-xs text-base-content/30 italic py-6 text-center">
          Presione Ejecutar para iniciar
        </div>
      )}
    </div>
  );
}
