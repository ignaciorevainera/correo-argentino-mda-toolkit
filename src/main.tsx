import "./index.css";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import CommandView from "./CommandView";
import ErrorBoundary from "./components/ErrorBoundary";
import { initializeSettings } from "./utils/settings";

initializeSettings();

const params = new URLSearchParams(window.location.search);
const isPopup = params.has("type");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <ErrorBoundary>
      {isPopup ? <CommandView /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
);
