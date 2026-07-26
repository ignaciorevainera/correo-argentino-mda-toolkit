import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import CommandView from "./CommandView";

const params = new URLSearchParams(window.location.search);
const isPopup = params.has("type");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isPopup ? <CommandView /> : <App />}
  </React.StrictMode>,
);
