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
    <div className="min-h-screen flex flex-col bg-base-100 text-base-content" data-theme="mda">
      <GlobalHeader
        hostname={hostname}
        onHostnameChange={setHostname}
        onRunAll={handleRunAll}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto p-3 flex flex-col gap-3">
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
              placeholder: "usuario",
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
