import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const targetTriple = execFileSync("rustc", ["--print", "host-tuple"], {
  encoding: "utf8",
}).trim();
const packageByTarget = {
  "x86_64-pc-windows-msvc": "@ccusage/ccusage-win32-x64",
  "aarch64-pc-windows-msvc": "@ccusage/ccusage-win32-arm64",
};
const nativePackage = packageByTarget[targetTriple];

if (!nativePackage) {
  throw new Error(`Unsupported release target: ${targetTriple}. This product currently ships for Windows.`);
}

const ccusageRequire = createRequire(require.resolve("ccusage/package.json"));
const source = ccusageRequire.resolve(`${nativePackage}/bin/ccusage.exe`);
const destination = join(
  projectRoot,
  "src-tauri",
  "binaries",
  `ccusage-${targetTriple}.exe`,
);

mkdirSync(dirname(destination), { recursive: true });

let current = false;
try {
  current = statSync(source).size === statSync(destination).size;
} catch {
  // The destination is created below.
}

if (!current) {
  copyFileSync(source, destination);
  console.log(`Prepared ccusage sidecar for ${targetTriple}`);
} else {
  console.log(`ccusage sidecar is current for ${targetTriple}`);
}
