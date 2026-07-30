import { defineConfig } from "vite";
import { fresh } from "@fresh/plugin-vite";
import tailwindcss from "@tailwindcss/vite";
import { loadBindAddress } from "./runtime/config.ts";

export default defineConfig({
  resolve: {
    alias: {
      debug: new URL("./runtime/debug_compat.ts", import.meta.url).pathname,
    },
  },
  plugins: [fresh(), tailwindcss()],
  server: {
    host: loadBindAddress(),
  },
});
