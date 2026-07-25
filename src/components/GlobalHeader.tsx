interface GlobalHeaderProps {
  hostname: string;
  onHostnameChange: (hostname: string) => void;
  onRunAll: () => void;
  disabled?: boolean;
}

export default function GlobalHeader({
  hostname,
  onHostnameChange,
  onRunAll,
  disabled,
}: GlobalHeaderProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && hostname.trim() && !disabled) {
      onRunAll();
    }
  };

  return (
    <div className="w-full px-4 py-3 bg-base-200/50 border-b border-base-300">
      <div className="flex items-center gap-3 max-w-full">
        <div className="form-control flex-1 min-w-0">
          <label className="label py-0.5" htmlFor="global-hostname">
            <span className="label-text font-semibold text-sm">Hostname o Dirección IP</span>
          </label>
          <input
            id="global-hostname"
            type="text"
            value={hostname}
            onChange={(e) => onHostnameChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ej: PC-001 o 192.168.1.50"
            className="input input-bordered input-sm w-full font-mono"
            disabled={disabled}
            autoFocus
          />
        </div>
        <button
          onClick={onRunAll}
          disabled={disabled || !hostname.trim()}
          className="btn btn-primary btn-sm mt-5 shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
          Ejecutar Todo
        </button>
        <div className="text-xs shrink-0 self-end pb-1.5 text-base-content/40">
          Enter → Ejecutar todo
        </div>
      </div>
    </div>
  );
}
