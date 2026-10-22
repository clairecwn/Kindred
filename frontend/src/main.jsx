import React from "react";
import ReactDOM from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import App from "./App.jsx";
import ViewportStage from "./components/ViewportStage.jsx";
import { SessionProvider } from "./lib/SessionProvider.jsx";
import GroveView from "./grove/GroveView.jsx";
import KingdomView from "./kingdom/KingdomView.jsx";

const grovePreview = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get("preview")
  : null;
const showGrovePreview = ["grove-game", "grove-mall", "canopy-park"].includes(grovePreview);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SessionProvider>
      <ViewportStage>
        {grovePreview === "kingdom-island"
          ? <KingdomView />
          : showGrovePreview
            ? <GroveView previewMall={grovePreview === "grove-mall"} previewPark={grovePreview === "canopy-park"} />
            : <App />}
      </ViewportStage>
    </SessionProvider>
  </React.StrictMode>
);
