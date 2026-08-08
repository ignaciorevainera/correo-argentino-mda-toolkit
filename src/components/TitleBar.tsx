import { ReactNode, MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface TitleBarProps {
  title: string;
  children?: ReactNode;
  onClose: () => void;
  showMinimize?: boolean;
}

export default function TitleBar({
  title,
  children,
  onClose,
  showMinimize = true,
}: TitleBarProps) {
  const handleMinimize = async () => {
    try {
      const win = getCurrentWindow();
      await win.minimize();
    } catch (err) {
      console.error("Error minimizing window:", err);
    }
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (e.button === 0 && e.detail === 1) {
      const target = e.target as HTMLElement;
      if (target.closest('button')) return;
      getCurrentWindow().startDragging();
    }
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      className="h-8 flex items-center justify-between bg-base-200 text-base-content select-none shrink-0 px-2 rounded-t-lg"
    >
      <div className="flex items-center gap-2 min-w-0 pointer-events-none">
        <span className="text-xs font-bold font-sans text-secondary truncate pl-1">
          {title}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {children}
        {showMinimize && (
          <button
            onClick={handleMinimize}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-base-300 transition-colors"
            title="Minimizar"
            aria-label="Minimizar"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M20 12H4"
              />
            </svg>
          </button>
        )}
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-error hover:text-error-content transition-colors"
          title="Cerrar"
          aria-label="Cerrar"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
