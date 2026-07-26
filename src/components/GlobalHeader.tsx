interface GlobalHeaderProps {
  hostname: string;
  onHostnameChange: (hostname: string) => void;
}

export default function GlobalHeader({
  hostname,
  onHostnameChange,
}: GlobalHeaderProps) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        <input
          id="global-hostname"
          type="text"
          value={hostname}
          onChange={(e) => onHostnameChange(e.target.value)}
          placeholder="hostname o dirección IPv4"
          className="input input-sm w-full font-mono text-xs"
          autoFocus
        />
      </div>
    </div>
  );
}
