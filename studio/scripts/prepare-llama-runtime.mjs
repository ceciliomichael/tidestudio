import { createWriteStream, existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const LLAMA_TAG = "b11429";
const LLAMA_BUILD = "11429";
const RELEASE_ROOT =
  `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_TAG}`;
const ASSETS = [
  "llama-b11429-bin-win-cuda-13.4-x64.zip",
  "cudart-llama-bin-win-cuda-13.4-x64.zip",
];

const scriptDir = dirname(fileURLToPath(import.meta.url));
const studioDir = resolve(scriptDir, "..");
const runtimeDir = join(studioDir, "runtime", "llama.cpp");
const serverPath = join(runtimeDir, "llama-server.exe");

function runtimeMatches() {
  if (!existsSync(serverPath)) {
    return false;
  }

  const result = spawnSync(serverPath, ["--version"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const versionText = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  return result.status === 0 && versionText.includes(`build ${LLAMA_BUILD}`);
}

async function download(url, destination) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "TideStudio-runtime-bootstrap",
    },
    redirect: "follow",
  });
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
}

function psQuote(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function expandArchive(archive) {
  const command =
    `Expand-Archive -LiteralPath ${psQuote(archive)} ` +
    `-DestinationPath ${psQuote(runtimeDir)} -Force`;
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", command],
    { stdio: "inherit", windowsHide: true },
  );
  if (result.status !== 0) {
    throw new Error(`Failed to extract ${archive}`);
  }
}

async function main() {
  if (process.platform !== "win32" || process.arch !== "x64") {
    throw new Error(
      "The pinned TideStudio llama.cpp runtime bootstrap currently supports Windows x64 only.",
    );
  }

  if (runtimeMatches()) {
    console.log(`llama.cpp ${LLAMA_TAG} runtime is already installed.`);
    return;
  }

  await mkdir(runtimeDir, { recursive: true });
  const tempDir = await mkdtemp(join(tmpdir(), "tidestudio-llama-"));

  try {
    for (const asset of ASSETS) {
      const archive = join(tempDir, asset);
      console.log(`Downloading ${asset}...`);
      await download(`${RELEASE_ROOT}/${asset}`, archive);
      console.log(`Extracting ${asset}...`);
      expandArchive(archive);
    }

    if (!runtimeMatches()) {
      throw new Error(
        `Downloaded llama.cpp runtime does not report expected build ${LLAMA_BUILD}.`,
      );
    }

    console.log(`Prepared llama.cpp ${LLAMA_TAG} in ${runtimeDir}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

await main();
