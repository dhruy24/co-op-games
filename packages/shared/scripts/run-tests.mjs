// Cross-platform test runner: Windows doesn't glob-expand `src/**/*.test.ts`
// the way bash does, so we find test files ourselves and hand tsx an
// explicit file list.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const srcDir = fileURLToPath(new URL("../src", import.meta.url));

function findTestFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findTestFiles(full));
    } else if (entry.name.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
}

const testFiles = findTestFiles(srcDir);
if (testFiles.length === 0) {
  console.error("No test files found.");
  process.exit(1);
}

const result = spawnSync("npx", ["tsx", "--test", ...testFiles], {
  stdio: "inherit",
  shell: true,
});
process.exit(result.status ?? 1);
