import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.svg", "icons/icon-maskable.svg"],
      manifest: {
        name: "CruciPenna",
        short_name: "CruciPenna",
        description: "Cruciverba ottimizzato per iPad con input Apple Pencil",
        start_url: "/",
        display: "standalone",
        orientation: "landscape",
        background_color: "#f4efe3",
        theme_color: "#f4efe3",
        lang: "it-IT",
        icons: [
          {
            src: "/icons/icon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icons/icon-maskable.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
});
