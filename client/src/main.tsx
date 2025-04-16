import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./components/ui/admin-fixes.css";
import "./components/ui/menu-fixes.css";

createRoot(document.getElementById("root")!).render(<App />);
