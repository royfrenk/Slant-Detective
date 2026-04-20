#!/usr/bin/env node
/**
 * scripts/license-audit.mjs — Slant Detective dependency license auditor
 *
 * Invocation: node scripts/license-audit.mjs (from repo root)
 *             npm run license-audit             (via root package.json)
 *
 * Scope: Audits direct dependencies in extension/ workspace by running
 *   `npm list --json --depth=0` inside extension/. Transitive deps are not
 *   audited in v1 (Week 1 scope). CI upgrade tracked as SD-002 follow-up.
 *
 * Exit codes:
 *   0 — all deps PASS (or no deps found)
 *   1 — one or more deps BLOCKED or UNKNOWN
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const EXTENSION_DIR = join(REPO_ROOT, "extension");

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
  // OFL-1.1 (SIL Open Font License) is OSI-approved, FSF-approved, and AGPL-compatible.
  // It permits use, modification, and redistribution in free/open software projects.
  // Blocked only for standalone font sale. Bundling in an AGPL extension is permitted.
  "OFL-1.1",
  "OFL-1.1-no-RFN",
  "OFL-1.1-RFN",
]);

/**
 * Extract the license identifier string from a package.json license field.
 * Handles:
 *   - string: "MIT"
 *   - old npm object: { "type": "MIT", "url": "..." }
 *   - missing field: returns null
 */
function extractLicenseId(licenseField) {
  if (!licenseField) return null;
  if (typeof licenseField === "string") return licenseField.trim();
  if (typeof licenseField === "object" && licenseField.type) {
    return String(licenseField.type).trim();
  }
  return null;
}

/**
 * Classify a license identifier as PASS or BLOCKED.
 * null / empty string → UNKNOWN → BLOCKED (fail closed).
 */
function classify(licenseId) {
  if (!licenseId) return { label: "UNKNOWN", verdict: "BLOCKED" };
  if (ALLOWED_LICENSES.has(licenseId)) return { label: licenseId, verdict: "PASS" };
  return { label: licenseId, verdict: "BLOCKED" };
}

/**
 * Print a fixed-width table row.
 */
function row(pkg, version, license, verdict) {
  const col1 = pkg.padEnd(40);
  const col2 = version.padEnd(16);
  const col3 = license.padEnd(24);
  return `${col1} ${col2} ${col3} ${verdict}`;
}

function main() {
  // Guard: extension/ must exist.
  if (!existsSync(EXTENSION_DIR)) {
    console.log("No extension/ directory found — no deps to audit.");
    console.log("(SD-001 workspace not yet created. This is expected in early sprint.)");
    process.exit(0);
  }

  // Guard: extension/package.json must exist.
  const extPkgPath = join(EXTENSION_DIR, "package.json");
  if (!existsSync(extPkgPath)) {
    console.log("No extension/package.json found — no deps to audit.");
    process.exit(0);
  }

  // Run npm list --json --depth=0 inside extension/.
  let npmListOutput;
  try {
    npmListOutput = execSync("npm list --json --depth=0 2>/dev/null", {
      cwd: EXTENSION_DIR,
      encoding: "utf8",
    });
  } catch (err) {
    // npm list exits non-zero when there are peer-dep warnings; use stdout anyway.
    npmListOutput = err.stdout || "{}";
  }

  let listData;
  try {
    listData = JSON.parse(npmListOutput);
  } catch {
    console.error("Failed to parse npm list output.");
    process.exit(1);
  }

  const deps = listData.dependencies || {};
  const pkgNames = Object.keys(deps);

  if (pkgNames.length === 0) {
    console.log("No direct dependencies found — nothing to audit.");
    process.exit(0);
  }

  const header = row("PACKAGE", "VERSION", "LICENSE", "VERDICT");
  const separator = "-".repeat(header.length);
  console.log(header);
  console.log(separator);

  const results = [];

  for (const pkgName of pkgNames.sort()) {
    const depInfo = deps[pkgName];
    const version = depInfo.version || "unknown";

    // Locate the package.json for this dep.
    const pkgJsonPath = join(EXTENSION_DIR, "node_modules", pkgName, "package.json");
    let licenseField = null;

    if (existsSync(pkgJsonPath)) {
      try {
        const raw = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
        licenseField = raw.license ?? raw.licenses ?? null;
        // Handle licenses array (old npm format): [{ type: "MIT" }]
        if (Array.isArray(licenseField) && licenseField.length > 0) {
          licenseField = licenseField[0];
        }
      } catch {
        licenseField = null;
      }
    }

    const licenseId = extractLicenseId(licenseField);
    const { label, verdict } = classify(licenseId);
    console.log(row(pkgName, version, label, verdict));
    results.push({ pkgName, version, label, verdict });
  }

  console.log(separator);

  const blocked = results.filter((r) => r.verdict === "BLOCKED");
  if (blocked.length > 0) {
    console.log(`\nAudit FAILED: ${blocked.length} blocked dep(s).`);
    process.exit(1);
  }

  console.log(`\nAudit PASSED: all ${results.length} dep(s) have compatible licenses.`);
  process.exit(0);
}

main();
