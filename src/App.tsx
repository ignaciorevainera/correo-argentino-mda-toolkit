import { useState } from "react";
import GlobalHeader from "./components/GlobalHeader";
import DiagnosticCard from "./components/DiagnosticCard";
import MsraCard from "./components/MsraCard";

function App() {
  const [hostname, setHostname] = useState("");
  const [netUserUsername, setNetUserUsername] = useState("");
  const [runAllTrigger, setRunAllTrigger] = useState(0);

  const handleRunAll = () => {
    setRunAllTrigger((prev) => prev + 1);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-base-100 text-base-content" data-theme="mda">
      <GlobalHeader
        hostname={hostname}
        onHostnameChange={setHostname}
        onRunAll={handleRunAll}
      />

      <main className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min">
          <DiagnosticCard
            title="Ping"
            commandName="run_ping"
            commandArgs={{ hostname }}
            hostname={hostname}
            executeTrigger={runAllTrigger}
          />

          <DiagnosticCard
            title="Net Time"
            commandName="run_net_time"
            commandArgs={{ hostname }}
            hostname={hostname}
            executeTrigger={runAllTrigger}
          />

          <DiagnosticCard
            title="Nslookup"
            commandName="run_nslookup"
            commandArgs={{ hostname }}
            hostname={hostname}
            executeTrigger={runAllTrigger}
          />

          <DiagnosticCard
            title="Net User"
            commandName="run_net_user"
            commandArgs={{ username: netUserUsername }}
            hostname={hostname}
            executeTrigger={runAllTrigger}
            extraInput={{
              key: "username",
              label: "Usuario de red",
              placeholder: "Ej: usuario.red",
              value: netUserUsername,
              onChange: setNetUserUsername,
            }}
          />

          <MsraCard hostname={hostname} />
        </div>
      </main>
    </div>
  );
}

export default App;
