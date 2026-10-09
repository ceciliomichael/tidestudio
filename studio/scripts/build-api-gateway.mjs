import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const destination = resolve(root, "studio/runtime/api-gateway");
mkdirSync(destination, { recursive: true });
const file =
  process.platform === "win32"
    ? "tidestudio-api-gateway.exe"
    : "tidestudio-api-gateway";
const result = spawnSync("go", ["build", "-o", resolve(destination, file), "./cmd/tidestudio-api-gateway"], {
  cwd: resolve(root, "studio/api-gateway"),
  stdio: "inherit",
});
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
