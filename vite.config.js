import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1500,
  },
  test: {
    // Server code and pure helpers run in Node; component tests opt into
    // jsdom with a `// @vitest-environment jsdom` comment.
    environment: "node",
    include: ["src/**/*.test.{js,jsx}", "netlify/**/*.test.mjs"],
    restoreMocks: true,
  },
});
