import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    host: true,
    // Allow tunneled hostnames during dev (localtunnel, ngrok, cloudflared).
    // Production builds don't read this — safe to leave permissive.
    allowedHosts: true,
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "icons/apple-touch-icon.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-192-maskable.png",
        "icons/icon-512-maskable.png",
      ],
      manifest: {
        name: "Toto",
        short_name: "Toto",
        description: "In-store AI concierge for outdoor retail — list, map, scan.",
        theme_color: "#2C7A55",
        background_color: "#F5F7F2",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/",
        scope: "/",
        lang: "en",
        categories: ["shopping", "utilities"],
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-192-maskable.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // App shell + hashed assets + bundled catalog (via JS chunk) + WASM.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2,wasm,json,webmanifest}"],
        // Navigations: network-first so a deploy is picked up when online;
        // falls back to the cached shell offline.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Google Fonts CSS
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Google Fonts files
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Keep SW off in `vite` so camera / HMR stay simple during local work.
        enabled: false,
      },
    }),
  ],
});
