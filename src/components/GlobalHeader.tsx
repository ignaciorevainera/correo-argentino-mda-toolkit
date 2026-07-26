interface GlobalHeaderProps {
  hostname: string;
  onHostnameChange: (hostname: string) => void;
}

export default function GlobalHeader({
  hostname,
  onHostnameChange,
}: GlobalHeaderProps) {
  return (
    <div className="w-full px-3 py-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-secondary shrink-0">
          Host
        </span>
        <input
          id="global-hostname"
          type="text"
          value={hostname}
          onChange={(e) => onHostnameChange(e.target.value)}
          placeholder="IP o hostname"
          className="input input-sm w-full font-mono text-xs"
          autoFocus
        />
      </div>
    </div>
  );
}
