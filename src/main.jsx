import React from "react";
import ReactDOM from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import App from "./App.jsx";
import ViewportStage from "./components/ViewportStage.jsx";
import { SessionProvider } from "./lib/SessionProvider.jsx";
import GroveView from "./grove/GroveView.jsx";

const grovePreview = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get("preview")
  : null;
const showGrovePreview = grovePreview === "grove-mall" || grovePreview === "canopy-park";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SessionProvider>
      <ViewportStage>
        {showGrovePreview
          ? <GroveView previewMall={grovePreview === "grove-mall"} previewPark={grovePreview === "canopy-park"} />
          : <App />}
      </ViewportStage>
    </SessionProvider>
  </React.StrictMode>
);
