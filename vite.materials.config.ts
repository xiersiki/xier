import { defineConfig } from "vite";
export default defineConfig({
  build: {
    rollupOptions: {
      external: ["node:sqlite"],
      output: { entryFileNames: "material-service.js" },
    },
  },
});
