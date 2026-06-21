import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      },
    }),
    tsconfigPaths(),
  ],
  server: {
    port: parseInt(process.env.PORT || "3000"),
    host: "0.0.0.0",
  },
  build: {
    target: "node20",
    sourcemap: true,
  },
  optimizeDeps: {
    include: [
      "@shopify/polaris",
      "@shopify/polaris-icons",
      "@shopify/app-bridge-react",
      "recharts",
      "@tanstack/react-table",
      "@tanstack/react-query",
    ],
  },
});
