import { useState, useRef, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { StreamLinePayload, StreamDonePayload } from "../types";

export function useCommandStream() {
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unlistenRef = useRef<(() => void)[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      unlistenRef.current.forEach((fn) => fn());
    };
  }, []);

  const execute = useCallback(async (command: string) => {
    setLoading(true);
    setError(null);
    setLines([]);
    setExitCode(null);
    unlistenRef.current.forEach((fn) => fn());
    unlistenRef.current = [];

    const runId = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const unlistenLine = await listen<StreamLinePayload>("command-line", (event) => {
      if (event.payload.id === runId && mountedRef.current) {
        setLines((prev) => [...prev, event.payload.text]);
      }
    });

    const unlistenDone = await listen<StreamDonePayload>("command-done", (event) => {
      if (event.payload.id === runId && mountedRef.current) {
        setExitCode(event.payload.exit_code);
        setLoading(false);
        unlistenLine();
        unlistenDone();
      }
    });

    unlistenRef.current = [unlistenLine, unlistenDone];

    try {
      await invoke("run_command_stream", { id: runId, command });
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
        unlistenLine();
        unlistenDone();
      }
    }
  }, []);

  return { execute, loading, lines, exitCode, error };
}
