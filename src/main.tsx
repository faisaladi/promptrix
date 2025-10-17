import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Send a simple event on app load to confirm Mixpanel wiring
window.mixpanel?.track("App Loaded", { env: import.meta.env.MODE });

createRoot(document.getElementById("root")!).render(<App />);
