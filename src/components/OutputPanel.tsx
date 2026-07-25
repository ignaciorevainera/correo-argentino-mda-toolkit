import { useClipboard } from "../hooks/useClipboard";
import type { CommandResult } from "../types";

interface OutputPanelProps {
  results: CommandResult[];
  loading: boolean;
}

function OutputBlock({ result }: { result: CommandResult }) {
  const { copied, copy } = useClipboard();
  const hasOutput = result.stdout.trim() || result.stderr.trim();
  const outputText = [result.stdout, result.stderr]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="rounded-box bg-base-200 border border-base-300 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-base-300/50 border-b border-base-300">
        <div className="flex items-center gap-2">
          <span className="badge badge-sm badge-primary font-mono text-xs">
            {result.command}
          </span>
          {result.exit_code !== null && (
            <span
              className={`badge badge-sm text-xs ${
                result.exit_code === 0 ? "badge-success" : "badge-error"
              }`}
            >
              exit {result.exit_code}
            </span>
          )}
        </div>
        <button
          onClick={() => copy(outputText)}
          className="btn btn-ghost btn-xs"
          disabled={!hasOutput}
          aria-label="Copy output"
        >
          {copied ? (
            <span className="text-success flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Copiado
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
              </svg>
              Copiar
            </span>
          )}
        </button>
      </div>
      <pre className="p-4 text-sm font-mono text-base-content/90 overflow-x-auto whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
        {hasOutput ? outputText : <span className="text-base-content/30 italic">Sin salida</span>}
      </pre>
    </div>
  );
}

export default function OutputPanel({ results, loading }: OutputPanelProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-base-content/60">
          <span className="loading loading-spinner loading-md text-primary"></span>
          <span className="text-sm">Ejecutando comandos de diagnóstico...</span>
        </div>
        {results.map((r) => (
          <OutputBlock key={r.command} result={r} />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-base-content/40">
        <p className="text-lg mb-1">Sin resultados</p>
        <p className="text-sm">Complete el formulario y ejecute el diagnóstico.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-secondary">Resultados</h2>
      {results.map((r) => (
        <OutputBlock key={r.command} result={r} />
      ))}
    </div>
  );
}
