import { defineConfig, loadEnv, type Plugin } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";

// Development reload workflow:
// `npm run dev` rebuilds on every file save (Vite watch mode).
// Chrome does NOT hot-reload extensions automatically. After a rebuild:
//   1. Go to chrome://extensions
//   2. Click the refresh icon on the Slant Detective card
//   3. Click the extension icon to re-open the side panel
// The side panel itself hot-reloads its own React tree between panel opens.

// Content scripts are injected as classic IIFE scripts (not ES modules) by
// crxjs. `import.meta.url` is a syntax error in classic scripts, but Vite
// keeps it in worker URL constructions. This plugin rewrites the one worker
// new URL(…, import.meta.url) call to use chrome.runtime.getURL() instead.
// The worker filename is kept hash-free (see worker.rollupOptions below) so
// the stable path "assets/embedding-worker.js" is safe to hardcode here.
function crxWorkerUrlFixPlugin(): Plugin {
  return {
    name: "crx-worker-url-fix",
    enforce: "post",
    generateBundle(_opts, bundle) {
      for (const fileName of Object.keys(bundle)) {
        const chunk = bundle[fileName];
        if (chunk.type !== "chunk") continue;
        if (!chunk.code.includes("import.meta.url")) continue;
        chunk.code = chunk.code.replace(
          /new URL\("\/assets\/embedding-worker\.js",import\.meta\.url\)/g,
          'chrome.runtime.getURL("assets/embedding-worker.js")',
        );
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load .env before the define block so VITE_RUBRIC_VERSION is available at
  // config-eval time (Vite does not populate process.env from .env until after
  // config resolution, so we must load it ourselves here).
  const env = loadEnv(mode, process.cwd(), '');
  const rubricVersion = process.env['VITE_RUBRIC_VERSION'] ?? env['VITE_RUBRIC_VERSION'];
  if (!rubricVersion) {
    throw new Error('VITE_RUBRIC_VERSION must be set (see extension/.env.example)');
  }

  const targetBrowser = (process.env['BROWSER_TARGET'] ?? 'chrome') as 'chrome' | 'firefox';
  const manifestFile = targetBrowser === 'firefox' ? './manifest.firefox.json' : './manifest.json';
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const manifest = require(manifestFile);

  return {
  plugins: [
    react(),
    crx({ manifest, browser: targetBrowser }),
    crxWorkerUrlFixPlugin(),
  ],
  define: {
    __RUBRIC_VERSION__: JSON.stringify(rubricVersion),
  },
  // Vite copies everything in publicDir verbatim to outDir at build time.
  // extension/public/assets/ → dist/assets/ (icons, JSON datasets, ONNX model)
  publicDir: "public",
  // Emit Web Workers as ES modules so they can use `import` statements
  // (required by embedding-worker.ts which imports @xenova/transformers).
  // Fixed entryFileNames (no content hash) so the content script IIFE can
  // reference the worker via chrome.runtime.getURL() with a stable path.
  worker: {
    format: "es",
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name].js",
      },
    },
  },
  build: {
    outDir: targetBrowser === 'firefox' ? 'dist-firefox' : 'dist',
    emptyOutDir: true,
    // Prevent Vite from inlining binary assets (e.g. the ONNX model) as data URLs.
    // Assets in publicDir are never inlined — this guards against any future import().
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        welcome: resolve(__dirname, "welcome.html"),
        credits: resolve(__dirname, "credits.html"),
        options: resolve(__dirname, "options.html"),
        // SD-028: in-extension reference pages (output to dist/src/pages/*.html)
        "pages/how-we-measure": resolve(__dirname, "src/pages/how-we-measure.html"),
        "pages/privacy": resolve(__dirname, "src/pages/privacy.html"),
        "pages/credits": resolve(__dirname, "src/pages/credits.html"),
        "pages/how-to-get-a-key": resolve(__dirname, "src/pages/how-to-get-a-key.html"),
      },
    },
  },
  };
});
