import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "mda-input-history";

export function useInputHistory(
  onValueChange: (value: string) => void,
  maxLength: number = 20
) {
  const [history, setHistory] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [historyIndex, setHistoryIndex] = useState<number | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {}
  }, [history]);

  const addHistory = useCallback((value: string) => {
    if (!value.trim()) return;
    setHistory((prev) => {
      if (prev.length > 0 && prev[prev.length - 1] === value) {
        return prev;
      }
      const next = [...prev, value];
      return next.length > maxLength ? next.slice(next.length - maxLength) : next;
    });
    setHistoryIndex(null);
  }, [maxLength]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;

      setHistoryIndex((prev) => {
        const nextIndex = prev === null ? history.length - 1 : Math.max(0, prev - 1);
        onValueChange(history[nextIndex]);
        return nextIndex;
      });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === null) return;

      setHistoryIndex((prev) => {
        if (prev === null) return null;
        if (prev < history.length - 1) {
          const nextIndex = prev + 1;
          onValueChange(history[nextIndex]);
          return nextIndex;
        } else {
          onValueChange("");
          return null;
        }
      });
    }
  }, [history, historyIndex, onValueChange]);

  const resetIndex = useCallback(() => setHistoryIndex(null), []);

  return { addHistory, handleKeyDown, resetIndex };
}
