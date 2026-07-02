import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cloudflare(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Agent Notes",
        short_name: "Notes",
        description: "Markdown + HTML notes shared between you and an agent",
        theme_color: "#f7f2e7",
        background_color: "#f7f2e7",
        display: "standalone",
        icons: [
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        navigateFallbackDenylist: [/^\/api\//, /^\/raw\//],
        runtimeCaching: [
          {
            urlPattern: /^\/(api|raw)\//,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
});
