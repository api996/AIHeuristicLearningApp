import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// 直接在主入口文件导入关键CSS样式，确保它们在构建中被包含
import "./components/ui/mobile-fixes.css";
import "./components/ui/ipad-fixes.css";
import "./components/ui/button-styles.css";

createRoot(document.getElementById("root")!).render(<App />);
