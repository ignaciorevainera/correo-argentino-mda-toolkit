import { useState } from "react";
import GlobalHeader from "./components/GlobalHeader";

function App() {
  const [hostname, setHostname] = useState("");

  return (
    <div
      className="min-h-screen flex flex-col bg-base-100 text-base-content"
      data-theme="mda"
    >
      <GlobalHeader
        hostname={hostname}
        onHostnameChange={setHostname}
      />
    </div>
  );
}

export default App;
