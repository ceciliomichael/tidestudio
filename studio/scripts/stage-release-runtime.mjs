import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import { openSync, readSync, closeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const studioDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(studioDir, "runtime");
const stagingRoot = join(studioDir, "src-tauri", "release-runtime");

const requiredLlamaFiles = [
  "llama-server.exe",
  "llama-server-impl.dll",
  "llama.dll",
  "ggml.dll",
  "ggml-base.dll",
  "ggml-cuda.dll",
  "cudart64_13.dll",
  "cublas64_13.dll",
  "cublasLt64_13.dll",
];

function isWindowsExecutable(path) {
  const handle = openSync(path, "r");
  try {
    const signature = Buffer.alloc(2);
    return readSync(handle, signature, 0, 2, 0) === 2
      && signature[0] === 0x4d
      && signature[1] === 0x5a;
  } finally {
    closeSync(handle);
  }
}

async function requireExecutable(path) {
  const info = await stat(path);
  if (!info.isFile() || info.size < 1024 || !isWindowsExecutable(path)) {
    throw new Error(`Invalid Windows executable: ${path}`);
  }
}

async function main() {
  if (process.platform !== "win32" || process.arch !== "x64") {
    throw new Error("TideStudio's packaged runtime currently supports Windows x64 only.");
  }

  const llamaDir = join(sourceRoot, "llama.cpp");
  const gatewayExe = join(sourceRoot, "api-gateway", "tidestudio-api-gateway.exe");
  const availableFiles = await readdir(llamaDir);

  for (const file of requiredLlamaFiles) {
    if (!availableFiles.includes(file)) {
      throw new Error(`Missing llama.cpp release dependency: ${file}`);
    }
  }

  await requireExecutable(join(llamaDir, "llama-server.exe"));
  await requireExecutable(gatewayExe);

  const llamaFiles = availableFiles.filter(
    (file) => file.endsWith(".dll") || file === "llama-server.exe"
      || file.startsWith("LICENSE"),
  );

  await rm(stagingRoot, { recursive: true, force: true });
  await mkdir(join(stagingRoot, "llama.cpp"), { recursive: true });
  await mkdir(join(stagingRoot, "api-gateway"), { recursive: true });

  for (const file of llamaFiles) {
    await copyFile(join(llamaDir, file), join(stagingRoot, "llama.cpp", file));
  }

  await copyFile(
    gatewayExe,
    join(stagingRoot, "api-gateway", "tidestudio-api-gateway.exe"),
  );

  console.log(
    `Staged ${llamaFiles.length} llama.cpp runtime files and the API gateway for Windows NSIS.`,
  );
}

await main();
