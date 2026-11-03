import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ mode }) => {
  const { PORT = "3000" } = loadEnv(mode, repoRoot, "");
  return {
    plugins: [react()],
    resolve: {
      alias: { "@sdk": fileURLToPath(new URL("./src/sdk/index.ts", import.meta.url)) },
      // Widgets live in their own workspace package and must share this app's React.
      dedupe: ["react", "react-dom"],
    },
    server: {
      proxy: { "/api": `http://localhost:${PORT}` },
    },
  };
});
