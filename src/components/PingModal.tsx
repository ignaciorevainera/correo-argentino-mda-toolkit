import { useEffect, useRef } from "react";
import Modal from "./Modal";
import { useCommandStream } from "../hooks/useCommandStream";
import { parsePingOutput } from "../utils/pingParser";
import type { PingResult } from "../utils/pingParser";

interface PingModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  command: string;
}

function barColor(ms: number, status: "success" | "timeout"): string {
  if (status === "timeout") return "bg-error";
  if (ms < 30) return "bg-success";
  if (ms < 100) return "bg-warning";
  return "bg-error";
}

function PingBar({ result, maxMs }: { result: PingResult; maxMs: number }) {
  const width = maxMs === 0 ? 100 : Math.max((result.ms / maxMs) * 100, 3);
  const label = result.status === "timeout" ? "sin respuesta" : `${result.ms} ms`;
  const color = barColor(result.ms, result.status);

  return (
    <div className="flex items-center gap-2 py-1">
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

export default function PingModal({ open, onClose, title, command }: PingModalProps) {
  const { execute, loading, lines, exitCode, error } = useCommandStream();
  const prevOpen = useRef(false);

  useEffect(() => {
    if (open && !prevOpen.current) {
      execute(command);
    }
    prevOpen.current = open;
  }, [open, command, execute]);

  const results = parsePingOutput(lines);
  const maxMs = results.reduce((max, r) => Math.max(max, r.ms), 0);

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {loading && (
        <div className="flex items-center gap-2 text-sm text-base-content/50 py-2">
          <span className="loading loading-spinner loading-sm text-primary"></span>
          Ejecutando...
        </div>
      )}

      {error && (
        <div className="text-xs text-error bg-error/10 px-2 py-1 rounded mb-2">
          {error}
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="flex flex-col gap-1">
          {results.map((r, i) => (
            <PingBar key={i} result={r} maxMs={maxMs} />
          ))}
          {exitCode !== null && (
            <div className="text-xs text-base-content/40 mt-2 text-right">
              exit {exitCode}
            </div>
          )}
        </div>
      )}

      {!loading && !error && results.length === 0 && exitCode !== null && (
        <div className="text-sm text-base-content/40 italic py-4 text-center">
          Sin resultados
        </div>
      )}
    </Modal>
  );
}
