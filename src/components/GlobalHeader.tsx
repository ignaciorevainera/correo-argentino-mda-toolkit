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
  return (
    <div className="w-full px-3 py-2 bg-base-100 border-b border-base-300">
      <div className="flex items-center gap-2 max-w-xl mx-auto">
        <span className="text-xs font-semibold text-secondary shrink-0">
          Host
        </span>
        <input
          id="global-hostname"
          type="text"
          value={hostname}
          onChange={(e) => onHostnameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && hostname.trim() && !disabled) {
              onRunAll();
            }
          }}
          placeholder="IP o hostname"
          className="input input-sm w-full font-mono text-xs"
          disabled={disabled}
          autoFocus
        />
        <button
          onClick={onRunAll}
          disabled={disabled || !hostname.trim()}
          className="btn btn-primary btn-xs shrink-0"
        >
          Todo
        </button>
      </div>
    </div>
  );
}
