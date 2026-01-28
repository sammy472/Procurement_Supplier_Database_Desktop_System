import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Handle OAuth redirect for HashRouter
if (window.location.pathname === "/provider/callback") {
  const search = window.location.search;
  window.location.replace(`/#/provider/callback${search}`);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
