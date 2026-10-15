import {
  closeSync,
  createWriteStream,
  existsSync,
  openSync,
  readSync,
  statSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RELEASE_API =
  "https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=30";
const DOWNLOAD_ROOT = "https://github.com/ggml-org/llama.cpp/releases/download";
const CUDA_ARCHIVE = "cudart-llama-bin-win-cuda-13.4-x64.zip";
const PINNED_TAG = "b11429";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const studioDir = resolve(scriptDir, "..");
const runtimeDir = join(studioDir, "runtime", "llama.cpp");

const REQUIRED_RUNTIME_FILES = [
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

function executableArchiveName(tag) {
  return `llama-${tag}-bin-win-cuda-13.4-x64.zip`;
}

function pinnedRelease() {
  const names = [executableArchiveName(PINNED_TAG), CUDA_ARCHIVE];
  return {
    tag: PINNED_TAG,
    build: PINNED_TAG.slice(1),
    assets: names.map((name) => ({
      name,
      url: `${DOWNLOAD_ROOT}/${PINNED_TAG}/${name}`,
    })),
  };
}

function compatibleRelease(release) {
  if (!release || release.draft || !/^b[0-9]+$/.test(release.tag_name)) {
    return null;
  }

  const names = [executableArchiveName(release.tag_name), CUDA_ARCHIVE];
  const assets = names.map((name) => {
    const asset = release.assets?.find(
      (entry) =>
        entry.name === name &&
        typeof entry.browser_download_url === "string" &&
        entry.browser_download_url.startsWith(
          `${DOWNLOAD_ROOT}/${release.tag_name}/`,
        ),
    );
    return asset ? { name, url: asset.browser_download_url } : null;
  });

  if (assets.some((asset) => asset === null)) {
    return null;
  }

  return {
    tag: release.tag_name,
    build: release.tag_name.slice(1),
    assets,
  };
}

export function selectLatestCompatibleRelease(releases) {
  if (!Array.isArray(releases)) {
    throw new Error("GitHub returned an invalid llama.cpp releases response.");
  }

  const candidates = releases
    .map(compatibleRelease)
    .filter((release) => release !== null)
    .sort((a, b) => Number(b.build) - Number(a.build));

  if (candidates.length === 0) {
    throw new Error(
      "No llama.cpp release contains both required Windows x64 CUDA 13.4 archives.",
    );
  }

  return candidates[0];
}

async function latestRelease() {
  const response = await fetch(RELEASE_API, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "TideStudio-runtime-bootstrap",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(
      `Could not retrieve llama.cpp releases: HTTP ${response.status}`,
    );
  }

  return selectLatestCompatibleRelease(await response.json());
}

function isRealPeFile(path) {
  if (!existsSync(path) || statSync(path).size < 1024) {
    return false;
  }

  const fd = openSync(path, "r");
  try {
    const signature = Buffer.allocUnsafe(2);
    return (
      readSync(fd, signature, 0, 2, 0) === 2 &&
      signature[0] === 0x4d &&
      signature[1] === 0x5a
    );
  } finally {
    closeSync(fd);
  }
}

export function versionMatches(versionText, build) {
  return new RegExp(`\\bbuild\\s+${build}\\b`).test(versionText);
}

function runtimeMatches(directory, release) {
  if (
    !REQUIRED_RUNTIME_FILES.every((name) =>
      isRealPeFile(join(directory, name)),
    )
  ) {
    return false;
  }

  const result = spawnSync(join(directory, "llama-server.exe"), ["--version"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 10000,
  });
  const versionText = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  return result.status === 0 && versionMatches(versionText, release.build);
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

function expandArchive(archive, destination) {
  const command =
    `Expand-Archive -LiteralPath ${psQuote(archive)} ` +
    `-DestinationPath ${psQuote(destination)} -Force`;
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", command],
    { stdio: "inherit", windowsHide: true },
  );

  if (result.status !== 0) {
    throw new Error(`Failed to extract ${archive}`);
  }
}

async function installRuntime(stagedDir) {
  const backupDir = join(
    dirname(runtimeDir),
    `.llama.cpp-backup-${randomUUID()}`,
  );
  const hadExistingRuntime = existsSync(runtimeDir);

  if (hadExistingRuntime) {
    await rename(runtimeDir, backupDir);
  }

  try {
    await rename(stagedDir, runtimeDir);
  } catch (error) {
    if (hadExistingRuntime) {
      try {
        await rename(backupDir, runtimeDir);
      } catch (restoreError) {
        throw new AggregateError(
          [error, restoreError],
          `Failed to install llama.cpp and restore the prior runtime from ${backupDir}`,
        );
      }
    }
    throw error;
  }

  if (hadExistingRuntime) {
    await rm(backupDir, { recursive: true, force: true });
  }
}

async function main() {
  if (process.platform !== "win32" || process.arch !== "x64") {
    throw new Error(
      "The TideStudio llama.cpp runtime bootstrap supports Windows x64 only.",
    );
  }

  const release = process.argv.includes("--latest")
    ? await latestRelease()
    : pinnedRelease();

  if (runtimeMatches(runtimeDir, release)) {
    console.log(`llama.cpp ${release.tag} runtime is already installed.`);
    return;
  }

  await mkdir(dirname(runtimeDir), { recursive: true });
  const stagedDir = await mkdtemp(
    join(dirname(runtimeDir), ".llama.cpp-stage-"),
  );
  const downloadDir = await mkdtemp(join(tmpdir(), "tidestudio-llama-"));

  try {
    console.log(`Preparing llama.cpp ${release.tag} for Windows x64...`);
    for (const asset of release.assets) {
      const archive = join(downloadDir, asset.name);
      console.log(`Downloading ${asset.name}...`);
      await download(asset.url, archive);
      console.log(`Extracting ${asset.name}...`);
      expandArchive(archive, stagedDir);
    }

    if (!runtimeMatches(stagedDir, release)) {
      throw new Error(
        `Downloaded llama.cpp runtime ${release.tag} is incomplete or invalid.`,
      );
    }

    await installRuntime(stagedDir);
    console.log(`Prepared llama.cpp ${release.tag} in ${runtimeDir}`);
  } finally {
    await rm(stagedDir, { recursive: true, force: true });
    await rm(downloadDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
