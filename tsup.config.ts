import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  target: "node18",
  clean: true,
  sourcemap: false,
  minify: false,
  outDir: "dist",
  noExternal: [],
  external: [
    "hono",
    "@hono/node-server",
    "@distube/ytdl-core",
    "yt-dlp-wrap",
    "instaloader",
  ],
});