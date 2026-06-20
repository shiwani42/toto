import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    // Allow tunneled hostnames during dev (localtunnel, ngrok, cloudflared).
    // Production builds don't read this — safe to leave permissive.
    allowedHosts: true,
  },
});
