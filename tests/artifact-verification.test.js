import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const docsDir = join(root, "docs");
const lifecycleFiles = [
  "requirements.md",
  "architecture.md",
  "design-review.md",
  "impl-plan.md",
  "code-review.md",
  "verification.md",
  "pr-description.md",
];

test("all Jira KAN-2 lifecycle documents exist", () => {
  for (const file of lifecycleFiles) {
    assert.doesNotThrow(() => readFileSync(join(docsDir, file), "utf8"), `${file} must exist`);
  }
});

test("requirements align to Jira KAN-2 and document source, destination, and workflow", () => {
  const requirements = readFileSync(join(docsDir, "requirements.md"), "utf8");
  assert.match(requirements, /KAN-2/);
  assert.match(requirements, /Automated Documentation Sync/);
  assert.match(requirements, /Jira/i);
  assert.match(requirements, /docs\//);
});

test("PR description contains every required reviewer section", () => {
  const pr = readFileSync(join(docsDir, "pr-description.md"), "utf8");
  for (const heading of ["Summary", "Changes Made", "Test Evidence", "Known Limitations", "Reviewer Checklist"]) {
    assert.ok(pr.includes(`## ${heading}`), `missing PR section: ${heading}`);
  }
});

test("repository text does not contain common MCP credential material", () => {
  const ignored = new Set([".git", "node_modules"]);
  const scan = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) scan(path);
      else if (entry.isFile() && /\.(md|json|js|yml|yaml|env|txt)$/i.test(entry.name)) {
        const text = readFileSync(path, "utf8");
        assert.doesNotMatch(text, /(?:client_secret|access_token|refresh_token|authorization:\s*Bearer)\s*[:=]/i);
      }
    }
  };
  scan(root);
});
