import { SettingsModal } from "./SettingsModal";

interface GlobalHeaderProps {
  hostname: string;
  onHostnameChange: (hostname: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export default function GlobalHeader({
  hostname,
  onHostnameChange,
  onKeyDown,
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
          className="input input-md w-full font-mono text-sm"
          autoComplete="off"
          autoFocus
        />
        <SettingsModal />
      </div>
    </div>
  );
}


