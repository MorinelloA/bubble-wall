import { defineConfig } from "vite";

// base "./" keeps every path relative, so the same build runs at
// landonarcher.com/bubble-wall/ and inside a native wrapper.
export default defineConfig({
  base: "./",
  build: { target: "es2022", sourcemap: false },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
