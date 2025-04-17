
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Conditionally load cartographer plugin
const loadCartographer = async () => {
  if (process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined) {
    const cartographer = await import("@replit/vite-plugin-cartographer");
    return [cartographer.cartographer()];
  }
  return [];
};

// Create plugins array without top-level await
const createPlugins = async () => {
  return [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...(await loadCartographer()),
  ];
};

// Use a function to create config to avoid top-level await
const createConfig = async () => {
  return defineConfig({
    plugins: await createPlugins(),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client", "src"),
        "@shared": path.resolve(__dirname, "shared"),
      },
    },
    root: path.resolve(__dirname, "client"),
    build: {
      outDir: path.resolve(__dirname, "dist/public"),
      emptyOutDir: true,
    },
  });
};

// Export a promise that resolves to the config
export default createConfig();
