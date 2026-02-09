import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  base: "./", // ALWAYS relative for Electron
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@tanstack")) return "vendor-query";
            if (id.includes("react-router")) return "vendor-router";
            if (id.includes("axios")) return "vendor-axios";
            if (id.includes("recharts")) return "vendor-recharts";
            if (id.includes("react-toastify")) return "vendor-toastify";
            if (id.includes("react-icons")) return "vendor-icons";
            if (id.includes("jspdf")) return "vendor-jspdf";
            if (id.includes("xlsx")) return "vendor-xlsx";
            if (id.includes("react-hook-form")) return "vendor-form";
            if (id.includes("date-fns")) return "vendor-date";
            return "vendor";
          }
        },
      },
    },
  },
});
