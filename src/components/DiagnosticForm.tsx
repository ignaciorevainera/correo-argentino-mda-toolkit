import { type FormEvent, useState } from "react";

export interface DiagnosticInput {
  hostname: string;
  username: string;
}

interface DiagnosticFormProps {
  onSubmit: (input: DiagnosticInput) => void;
  disabled?: boolean;
}

export default function DiagnosticForm({ onSubmit, disabled }: DiagnosticFormProps) {
  const [hostname, setHostname] = useState("");
  const [username, setUsername] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!hostname.trim()) return;
    onSubmit({ hostname: hostname.trim(), username: username.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="form-control w-full max-w-md">
        <label className="label" htmlFor="hostname">
          <span className="label-text font-medium">Hostname o dirección IP</span>
        </label>
        <input
          id="hostname"
          type="text"
          value={hostname}
          onChange={(e) => setHostname(e.target.value)}
          placeholder="Ej: PC-001 o 192.168.1.50"
          className="input input-bordered w-full font-mono"
          disabled={disabled}
          autoFocus
        />
        <label className="label">
          <span className="label-text-alt text-base-content/50">
            Nombre de equipo o IP del puesto a diagnosticar
          </span>
        </label>
      </div>

      <div className="form-control w-full max-w-md">
        <label className="label" htmlFor="username">
          <span className="label-text font-medium">
            Usuario de red <span className="text-base-content/40">(opcional)</span>
          </span>
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Ej: usuario.red"
          className="input input-bordered w-full font-mono"
          disabled={disabled}
        />
        <label className="label">
          <span className="label-text-alt text-base-content/50">
            Usuario de red para comandos net user
          </span>
        </label>
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={disabled || !hostname.trim()}
      >
        Ejecutar Diagnóstico
      </button>
    </form>
  );
}
