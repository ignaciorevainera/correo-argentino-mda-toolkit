import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Layout from "./components/Layout";
import DiagnosticForm, { type DiagnosticInput } from "./components/DiagnosticForm";
import ActionButtons from "./components/ActionButtons";
import OutputPanel from "./components/OutputPanel";
import type { CommandResult } from "./types";

function App() {
  const [loading, setLoading] = useState(false);
  const [lastHostname, setLastHostname] = useState("");
  const [results, setResults] = useState<CommandResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleDiagnostic = async (input: DiagnosticInput) => {
    setLastHostname(input.hostname);
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const data = await invoke<CommandResult[]>("execute_diagnostic", {
        hostname: input.hostname,
      });
      setResults(data);

      if (input.username) {
        const userResult = await invoke<CommandResult>("run_net_user", {
          username: input.username,
        });
        setResults((prev) => [...prev, userResult]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-primary mb-1">Diagnóstico de Red</h1>
          <p className="text-base-content/60">
            Ingrese los datos del equipo a diagnosticar.
          </p>
        </div>

        <DiagnosticForm onSubmit={handleDiagnostic} disabled={loading} />

        {lastHostname && (
          <ActionButtons hostname={lastHostname} disabled={loading} />
        )}

        {error && (
          <div role="alert" className="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <OutputPanel results={results} loading={loading} />
      </div>
    </Layout>
  );
}

export default App;
