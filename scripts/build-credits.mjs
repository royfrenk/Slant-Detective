#!/usr/bin/env node
/**
 * scripts/build-credits.mjs — generate extension/assets/credits.json
 *
 * Invocation: node scripts/build-credits.mjs (from repo root)
 *             runs automatically via "prebuild" in extension/package.json
 *
 * Output shape:
 *   { datasets: [...], npmDeps: [...], licensesUrl: string, generated_at: string }
 *
 * Exits non-zero if any production dep has a missing or incompatible license.
 * Reuses ALLOWED_LICENSES + classify() from license-audit.mjs — single source of truth.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const EXTENSION_DIR = join(REPO_ROOT, "extension");
const ASSETS_DIR = join(EXTENSION_DIR, "assets");
const OUTPUT_PATH = join(ASSETS_DIR, "credits.json");

// ---------------------------------------------------------------------------
// License allow-list — canonical copy lives in license-audit.mjs.
// Keep in sync if that list changes.
// ---------------------------------------------------------------------------

const ALLOWED_LICENSES = new Set([
  "MIT",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "MPL-2.0",
  "LGPL-2.0",
  "LGPL-2.0-only",
  "LGPL-2.0-or-later",
  "LGPL-2.1",
  "LGPL-2.1-only",
  "LGPL-2.1-or-later",
  "LGPL-3.0",
  "LGPL-3.0-only",
  "LGPL-3.0-or-later",
  "AGPL-3.0",
  "AGPL-3.0-only",
  "AGPL-3.0-or-later",
  // OFL-1.1: OSI-approved, FSF-approved, AGPL-compatible for bundling.
  "OFL-1.1",
  "OFL-1.1-no-RFN",
  "OFL-1.1-RFN",
]);

/** Extract SPDX identifier from a package.json license field (string or old-npm object). */
function extractLicenseId(licenseField) {
  if (!licenseField) return null;
  if (typeof licenseField === "string") return licenseField.trim();
  if (typeof licenseField === "object" && licenseField.type) {
    return String(licenseField.type).trim();
  }
  return null;
}

/** Classify a license identifier — replicates logic from license-audit.mjs. */
function classify(licenseId) {
  if (!licenseId) return { label: "UNKNOWN", verdict: "BLOCKED" };
  if (ALLOWED_LICENSES.has(licenseId)) return { label: licenseId, verdict: "PASS" };
  return { label: licenseId, verdict: "BLOCKED" };
}

// ---------------------------------------------------------------------------
// Hardcoded dataset attributions
// Source: attribution headers committed with each bundled asset (SD-002)
// ---------------------------------------------------------------------------

/** @type {Array<{name: string, author: string, license: string, url: string}>} */
const DATASETS = [
  {
    name: "BABE bias-word lexicon",
    author: "Media-Bias-Group (Spinde et al., 2021)",
    license: "AGPL-3.0",
    url: "https://github.com/Media-Bias-Group/Neural-Media-Bias-Detection-Using-Distant-Supervision-With-BABE",
  },
  {
    name: "Media-Bias-Taxonomy",
    author: "Media-Bias-Group (Spinde et al., 2022)",
    license: "AGPL-3.0",
    url: "https://github.com/Media-Bias-Group/Media-Bias-Taxonomy",
  },
  {
    name: "source-bias-labels.json",
    author: "Originally authored — Slant Detective",
    license: "AGPL-3.0",
    url: "https://github.com/royfrenk/Slant-Detective",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read a JSON file and return parsed value, or null on error.
 * @param {string} filePath
 * @returns {unknown}
 */
function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Build the LICENSES/ URL from the root package.json.
 * Falls back to a generic GitHub URL if the repository field is absent.
 * @returns {string}
 */
function buildLicensesUrl() {
  const rootPkg = readJson(join(REPO_ROOT, "package.json"));
  if (!rootPkg || typeof rootPkg !== "object") {
    return "https://github.com/royfrenk/Slant-Detective/tree/main/LICENSES";
  }
  const pkg = /** @type {Record<string, unknown>} */ (rootPkg);
  const repo = pkg["repository"];
  if (typeof repo === "string") {
    // Handle shorthand "github:owner/repo" or "owner/repo"
    const cleaned = repo.replace(/^github:/, "");
    return `https://github.com/${cleaned}/tree/main/LICENSES`;
  }
  if (typeof repo === "object" && repo !== null) {
    const repoObj = /** @type {Record<string, unknown>} */ (repo);
    const url = String(repoObj["url"] ?? "").replace(/\.git$/, "");
    if (url) {
      const match = url.match(/github\.com[:/](.+)/);
      if (match) return `https://github.com/${match[1]}/tree/main/LICENSES`;
    }
  }
  // Fallback: derive from package name if it follows org/project pattern
  const name = typeof pkg["name"] === "string" ? pkg["name"] : "";
  if (name.includes("/")) {
    return `https://github.com/${name}/tree/main/LICENSES`;
  }
  return "https://github.com/royfrenk/Slant-Detective/tree/main/LICENSES";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const extPkgPath = join(EXTENSION_DIR, "package.json");
  if (!existsSync(extPkgPath)) {
    console.error("ERROR: extension/package.json not found.");
    process.exit(1);
  }

  const extPkg = readJson(extPkgPath);
  if (!extPkg || typeof extPkg !== "object") {
    console.error("ERROR: could not parse extension/package.json.");
    process.exit(1);
  }

  const pkg = /** @type {Record<string, unknown>} */ (extPkg);
  const productionDeps = pkg["dependencies"];
  if (!productionDeps || typeof productionDeps !== "object") {
    console.error("ERROR: no 'dependencies' field in extension/package.json.");
    process.exit(1);
  }

  const depNames = Object.keys(/** @type {Record<string, unknown>} */ (productionDeps)).sort();

  /** @type {Array<{name: string, version: string, license: string, homepage: string}>} */
  const npmDeps = [];
  /** @type {string[]} */
  const blocked = [];

  for (const depName of depNames) {
    const depPkgPath = join(EXTENSION_DIR, "node_modules", depName, "package.json");
    const depPkg = readJson(depPkgPath);

    if (!depPkg || typeof depPkg !== "object") {
      blocked.push(`${depName} (package.json not found)`);
      continue;
    }

    const depObj = /** @type {Record<string, unknown>} */ (depPkg);

    const version = typeof depObj["version"] === "string" ? depObj["version"] : "unknown";

    // Resolve homepage — fall back to npmjs.com
    let homepage = "";
    if (typeof depObj["homepage"] === "string" && depObj["homepage"].trim()) {
      homepage = depObj["homepage"].trim();
    } else {
      homepage = `https://npmjs.com/package/${depName}`;
    }

    // Resolve license
    let licenseField = depObj["license"] ?? depObj["licenses"] ?? null;
    if (Array.isArray(licenseField) && licenseField.length > 0) {
      licenseField = licenseField[0];
    }
    const licenseId = extractLicenseId(/** @type {unknown} */ (licenseField));
    const { verdict } = classify(licenseId);

    if (verdict === "BLOCKED") {
      blocked.push(`${depName}@${version} (license: ${licenseId ?? "MISSING"})`);
    }

    npmDeps.push({
      name: depName,
      version,
      license: licenseId ?? "UNKNOWN",
      homepage,
    });
  }

  if (blocked.length > 0) {
    console.error("\nERROR: build-credits.mjs — incompatible or missing licenses found:");
    for (const item of blocked) {
      console.error(`  ✗ ${item}`);
    }
    console.error("\nFix the above before running the build.");
    process.exit(1);
  }

  const licensesUrl = buildLicensesUrl();

  const output = {
    generated_at: new Date().toISOString(),
    datasets: DATASETS,
    npmDeps,
    licensesUrl,
  };

  // Ensure assets/ directory exists
  if (!existsSync(ASSETS_DIR)) {
    mkdirSync(ASSETS_DIR, { recursive: true });
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf8");
  console.log(`credits.json written: ${DATASETS.length} datasets, ${npmDeps.length} npm deps`);
}

main();
