import { Icon } from "@iconify/react";

interface GlobalHeaderProps {
  hostname: string;
  onHostnameChange: (hostname: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  alwaysOnTop: boolean;
  onToggleAlwaysOnTop: () => void;
  dark: boolean;
  onToggleDark: () => void;
}

export default function GlobalHeader({
  hostname,
  onHostnameChange,
  onKeyDown,
  alwaysOnTop,
  onToggleAlwaysOnTop,
  dark,
  onToggleDark,
}: GlobalHeaderProps) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        <input
          id="global-hostname"
          type="text"
          value={hostname}
          onChange={(e) => onHostnameChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="hostname o dirección IPv4"
          className="input input-sm w-full font-mono text-xs"
          autoComplete="off"
          autoFocus
        />
        <button
          onClick={onToggleAlwaysOnTop}
          className={`btn btn-sm btn-square btn-ghost ${alwaysOnTop ? "text-warning" : "text-base-content/30"}`}
          title={alwaysOnTop ? "Desactivar siempre visible" : "Activar siempre visible"}
          aria-label="Toggle siempre visible"
        >
          <Icon icon={alwaysOnTop ? "ph:push-pin-fill" : "ph:push-pin-slash-fill"} className="size-4" />
        </button>
        <button
          onClick={onToggleDark}
          className="btn btn-sm btn-square btn-ghost text-base-content/30"
          title={dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
          aria-label="Toggle tema"
        >
          <Icon icon={dark ? "ph:sun-fill" : "ph:moon-fill"} className="size-4" />
        </button>
      </div>
    </div>
  );
}
