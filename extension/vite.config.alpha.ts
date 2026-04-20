import { defineConfig, mergeConfig } from "vite";
import baseConfig from "./vite.config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    define: {
      __BUILD_MODE__: JSON.stringify("alpha"),
      __BUILD_VERSION__: JSON.stringify("0.2.0-alpha"),
    },
    build: {
      outDir: "dist",
    },
  }),
);
