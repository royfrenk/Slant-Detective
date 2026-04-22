#!/usr/bin/env node
/**
 * lint-source-bias.mjs
 *
 * Structural validator for extension/public/assets/source-bias-labels.json.
 * Checks schema correctness only — label quality is human editorial judgment.
 *
 * Exit code 0: all checks passed.
 * Exit code 1: one or more checks failed (errors printed to stderr).
 *
 * Usage:
 *   node scripts/lint-source-bias.mjs [path/to/source-bias-labels.json]
 *   npm run lint:source-bias
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_JSON_PATH = resolve(
  __dirname,
  "../public/assets/source-bias-labels.json",
);

const ALLOWED_LABELS = new Set([
  "left",
  "lean-left",
  "left-center",
  "center",
  "right-center",
  "lean-right",
  "right",
  "mixed",
]);

const ALLOWED_CONFIDENCE = new Set(["high", "medium", "low"]);

const DOMAIN_PATTERN = /^[a-z0-9][a-z0-9\-\.]+[a-z0-9]$/;

const MIN_DOMAIN_COUNT = 150;
const MIN_NOTES_LENGTH = 20;

// ---------------------------------------------------------------------------
// Self-test fixture — a minimal valid dataset used when --self-test is passed
// ---------------------------------------------------------------------------
const SELF_TEST_FIXTURE = {
  dataset: "Test Dataset",
  version: "0.2.0",
  license: "AGPL-3.0-or-later",
  authored_by: "Slant Detective project",
  compiled: "2026-04-20",
  domains: Array.from({ length: 150 }, (_, i) => ({
    domain: `example${i}.com`,
    label: [
      "left",
      "lean-left",
      "left-center",
      "center",
      "right-center",
      "lean-right",
      "right",
      "mixed",
    ][i % 8],
    confidence: ["high", "medium", "low"][i % 3],
    notes: "This is a sufficiently long notes string for testing purposes only.",
  })),
};

// Known-bad entries to verify the lint script rejects them
const KNOWN_BAD_ENTRIES = [
  {
    description: "www. prefix on domain",
    entry: {
      domain: "www.example.com",
      label: "center",
      confidence: "high",
      notes: "Should be rejected because of www. prefix.",
    },
  },
  {
    description: "https:// prefix on domain",
    entry: {
      domain: "https://example.com",
      label: "center",
      confidence: "high",
      notes: "Should be rejected because of https:// prefix.",
    },
  },
  {
    description: "uppercase in domain",
    entry: {
      domain: "Example.com",
      label: "center",
      confidence: "high",
      notes: "Should be rejected because of uppercase letter.",
    },
  },
  {
    description: "invalid label value",
    entry: {
      domain: "badlabel.com",
      label: "far-right",
      confidence: "high",
      notes: "Should be rejected because far-right is not an allowed label.",
    },
  },
  {
    description: "invalid confidence value",
    entry: {
      domain: "badconfidence.com",
      label: "center",
      confidence: "very-high",
      notes: "Should be rejected because very-high is not an allowed confidence.",
    },
  },
  {
    description: "empty notes field",
    entry: {
      domain: "nonotes.com",
      label: "center",
      confidence: "high",
      notes: "",
    },
  },
  {
    description: "notes field too short",
    entry: {
      domain: "shortnotes.com",
      label: "center",
      confidence: "high",
      notes: "Too short.",
    },
  },
  {
    description: "missing label field",
    entry: {
      domain: "missinglabel.com",
      confidence: "high",
      notes: "This entry is missing the required label field.",
    },
  },
  {
    description: "trailing slash on domain",
    entry: {
      domain: "trailingslash.com/",
      label: "center",
      confidence: "high",
      notes: "Should be rejected because of trailing slash on domain.",
    },
  },
];

// ---------------------------------------------------------------------------
// Validation logic
// ---------------------------------------------------------------------------

/**
 * Validate a parsed dataset object.
 * Returns an array of error strings. Empty array = all checks passed.
 */
function validate(data, { minDomainCount = MIN_DOMAIN_COUNT } = {}) {
  const errors = [];

  // Check 1: top-level required fields
  const requiredTopLevel = [
    "dataset",
    "version",
    "license",
    "authored_by",
    "compiled",
    "domains",
  ];
  for (const field of requiredTopLevel) {
    if (!(field in data)) {
      errors.push(`Missing top-level field: "${field}"`);
    }
  }

  // Early exit if domains is missing or wrong type
  if (!Array.isArray(data.domains)) {
    errors.push(`"domains" must be an array`);
    return errors;
  }

  // Check 2: domain count
  if (data.domains.length < minDomainCount) {
    errors.push(
      `"domains" array has ${data.domains.length} entries; minimum required is ${minDomainCount}`,
    );
  }

  // Check 3-9: per-entry validation
  const seenDomains = new Map(); // domain -> index (for duplicate detection)

  for (let i = 0; i < data.domains.length; i++) {
    const entry = data.domains[i];
    const prefix = `domains[${i}]`;

    // Required fields present
    for (const field of ["domain", "label", "confidence", "notes"]) {
      if (!(field in entry)) {
        errors.push(`${prefix}: missing required field "${field}"`);
      }
    }

    // domain format
    if (typeof entry.domain !== "string") {
      errors.push(`${prefix}.domain: must be a string`);
    } else {
      if (!DOMAIN_PATTERN.test(entry.domain)) {
        errors.push(
          `${prefix}.domain: "${entry.domain}" does not match pattern ` +
            `/^[a-z0-9][a-z0-9\\-\\.]+[a-z0-9]$/ ` +
            `(no www., no https://, no trailing slash, lowercase only)`,
        );
      }
      // Explicit www. check for clarity
      if (entry.domain.startsWith("www.")) {
        errors.push(
          `${prefix}.domain: "${entry.domain}" must not start with "www."`,
        );
      }
      // Explicit https:// check
      if (entry.domain.includes("://")) {
        errors.push(
          `${prefix}.domain: "${entry.domain}" must not contain "://"`,
        );
      }

      // Duplicate check
      if (seenDomains.has(entry.domain)) {
        errors.push(
          `${prefix}.domain: "${entry.domain}" is a duplicate (first seen at domains[${seenDomains.get(entry.domain)}])`,
        );
      } else {
        seenDomains.set(entry.domain, i);
      }
    }

    // label value
    if (typeof entry.label !== "string") {
      errors.push(`${prefix}.label: must be a string`);
    } else if (!ALLOWED_LABELS.has(entry.label)) {
      errors.push(
        `${prefix}.label: "${entry.label}" is not an allowed value. ` +
          `Allowed: ${[...ALLOWED_LABELS].join(", ")}`,
      );
    }

    // confidence value
    if (typeof entry.confidence !== "string") {
      errors.push(`${prefix}.confidence: must be a string`);
    } else if (!ALLOWED_CONFIDENCE.has(entry.confidence)) {
      errors.push(
        `${prefix}.confidence: "${entry.confidence}" is not an allowed value. ` +
          `Allowed: ${[...ALLOWED_CONFIDENCE].join(", ")}`,
      );
    }

    // notes non-empty and min length
    if (typeof entry.notes !== "string") {
      errors.push(`${prefix}.notes: must be a string`);
    } else if (entry.notes.trim().length === 0) {
      errors.push(`${prefix}.notes: must not be empty`);
    } else if (entry.notes.trim().length < MIN_NOTES_LENGTH) {
      errors.push(
        `${prefix}.notes: too short (${entry.notes.trim().length} chars); ` +
          `minimum is ${MIN_NOTES_LENGTH} characters`,
      );
    }
  }

  return errors;
}

/**
 * Run self-test: verify the lint script correctly accepts a valid fixture
 * and rejects each of the known-bad entries.
 */
function runSelfTest() {
  let passed = 0;
  let failed = 0;

  // Test 1: valid fixture passes with min domain count 150
  {
    const errors = validate(SELF_TEST_FIXTURE, { minDomainCount: 150 });
    if (errors.length === 0) {
      process.stdout.write("[PASS] Valid fixture (150 entries) accepted\n");
      passed++;
    } else {
      process.stderr.write(
        `[FAIL] Valid fixture was rejected:\n  ${errors.join("\n  ")}\n`,
      );
      failed++;
    }
  }

  // Test 2: fixture with 149 entries rejected for domain count
  {
    const smallFixture = {
      ...SELF_TEST_FIXTURE,
      domains: SELF_TEST_FIXTURE.domains.slice(0, 149),
    };
    const errors = validate(smallFixture, { minDomainCount: 150 });
    if (errors.some((e) => e.includes("minimum required is 150"))) {
      process.stdout.write("[PASS] 149-entry fixture correctly rejected for count\n");
      passed++;
    } else {
      process.stderr.write(
        `[FAIL] 149-entry fixture should have been rejected for count but got: ${errors.join("; ")}\n`,
      );
      failed++;
    }
  }

  // Test 3: duplicate domain rejected
  {
    const dupFixture = {
      ...SELF_TEST_FIXTURE,
      domains: [
        ...SELF_TEST_FIXTURE.domains,
        { ...SELF_TEST_FIXTURE.domains[0] }, // duplicate of first entry
      ],
    };
    const errors = validate(dupFixture, { minDomainCount: 150 });
    if (errors.some((e) => e.includes("duplicate"))) {
      process.stdout.write("[PASS] Duplicate domain correctly rejected\n");
      passed++;
    } else {
      process.stderr.write(
        `[FAIL] Duplicate domain should have been rejected but got: ${errors.join("; ")}\n`,
      );
      failed++;
    }
  }

  // Test 4-N: each known-bad entry should cause at least one error
  for (const { description, entry } of KNOWN_BAD_ENTRIES) {
    const fixtureWithBadEntry = {
      ...SELF_TEST_FIXTURE,
      domains: [
        ...SELF_TEST_FIXTURE.domains.slice(0, 149),
        entry, // replace last entry with bad one
      ],
    };
    const errors = validate(fixtureWithBadEntry, { minDomainCount: 150 });
    // Filter errors to only the last entry (index 149)
    const entryErrors = errors.filter((e) => e.startsWith("domains[149]"));
    if (entryErrors.length > 0) {
      process.stdout.write(`[PASS] Known-bad entry rejected: ${description}\n`);
      passed++;
    } else {
      process.stderr.write(
        `[FAIL] Known-bad entry "${description}" was NOT rejected. ` +
          `All errors: ${errors.join("; ") || "(none)"}\n`,
      );
      failed++;
    }
  }

  process.stdout.write(`\nSelf-test complete: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.includes("--self-test")) {
  const ok = runSelfTest();
  process.exit(ok ? 0 : 1);
}

const jsonPath = args[0] ? resolve(args[0]) : DEFAULT_JSON_PATH;

let rawText;
try {
  rawText = readFileSync(jsonPath, "utf8");
} catch (err) {
  process.stderr.write(`Cannot read file: ${jsonPath}\n  ${err.message}\n`);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(rawText);
} catch (err) {
  process.stderr.write(
    `JSON parse error in ${jsonPath}:\n  ${err.message}\n`,
  );
  process.exit(1);
}

const errors = validate(data);

if (errors.length === 0) {
  process.stdout.write(
    `lint-source-bias: OK — ${data.domains.length} domains, version ${data.version}\n`,
  );
  process.exit(0);
} else {
  process.stderr.write(
    `lint-source-bias: FAILED — ${errors.length} error(s) in ${jsonPath}\n`,
  );
  for (const err of errors) {
    process.stderr.write(`  - ${err}\n`);
  }
  process.exit(1);
}
