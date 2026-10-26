import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  server: { port: 3000 },
  plugins: [
    tailwindcss(),
    svgr({ svgrOptions: { icon: true } }),
    tanstackStart(),
    // Nitro adapts the same app to the deploy target; default preset is Bun.
    nitro({ preset: process.env.NITRO_PRESET ?? "bun" }),
    viteReact(),
  ],
});
