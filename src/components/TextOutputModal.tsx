import { useEffect, useRef } from "react";
import Modal from "./Modal";
import { useCommandStream } from "../hooks/useCommandStream";
import { useClipboard } from "../hooks/useClipboard";

interface TextOutputModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  command: string;
}

export default function TextOutputModal({ open, onClose, title, command }: TextOutputModalProps) {
  const { execute, loading, lines, exitCode, error } = useCommandStream();
  const { copied, copy } = useClipboard();
  const prevOpen = useRef(false);
  const commandRef = useRef(command);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      const openedNow = !prevOpen.current;
      const commandChanged = command !== commandRef.current;
      if (openedNow || commandChanged) {
        execute(command);
      }
    }
    prevOpen.current = open;
    commandRef.current = command;
  }, [open, command, execute]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length]);

  const outputText = lines.join("\n");
  const hasOutput = lines.length > 0;

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

      {!loading && (
        <div className="border border-base-300 rounded overflow-hidden">
          <div className="flex items-center justify-between px-2 py-1 bg-base-300/30 border-b border-base-300">
            <span
              className={`badge badge-xs ${
                exitCode === null
                  ? "badge-warning"
                  : exitCode === 0
                    ? "badge-outline"
                    : "badge-error"
              }`}
            >
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
            {hasOutput ? (
              outputText
            ) : (
              <span className="text-base-content/30 italic">Sin salida</span>
            )}
            <div ref={bottomRef} />
          </pre>
        </div>
      )}
    </Modal>
  );
}
