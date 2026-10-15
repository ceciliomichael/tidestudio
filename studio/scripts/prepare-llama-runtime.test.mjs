import assert from "node:assert/strict";
import test from "node:test";
import {
  selectLatestCompatibleRelease,
  versionMatches,
} from "./prepare-llama-runtime.mjs";

const DOWNLOAD_ROOT = "https://github.com/ggml-org/llama.cpp/releases/download";
const CUDA_RUNTIME = "cudart-llama-bin-win-cuda-13.4-x64.zip";

function buildRelease(tag, includedAssets, extra = {}) {
  return {
    tag_name: tag,
    draft: false,
    assets: includedAssets.map((name) => ({
      name,
      browser_download_url: `${DOWNLOAD_ROOT}/${tag}/${name}`,
    })),
    ...extra,
  };
}

function completeRelease(tag, extra = {}) {
  return buildRelease(tag, [
    `llama-${tag}-bin-win-cuda-13.4-x64.zip`,
    CUDA_RUNTIME,
  ], extra);
}

test("selects the newest complete Windows CUDA release, not GitHub's latest semantic tag", () => {
  const result = selectLatestCompatibleRelease([
    buildRelease("v0.7.0", []),
    completeRelease("b11662"),
    completeRelease("b11669"),
  ]);

  assert.equal(result.tag, "b11669");
  assert.equal(result.build, "11669");
  assert.deepEqual(
    result.assets.map((asset) => asset.name),
    [
      "llama-b11669-bin-win-cuda-13.4-x64.zip",
      CUDA_RUNTIME,
    ],
  );
});

test("skips incomplete newer builds and draft releases", () => {
  const result = selectLatestCompatibleRelease([
    buildRelease("b11680", [
      "llama-b11680-bin-win-cuda-13.4-x64.zip",
    ]),
    completeRelease("b11675", { draft: true }),
    completeRelease("b11669"),
  ]);

  assert.equal(result.tag, "b11669");
});

test("does not select mismatched architecture or CUDA assets", () => {
  const result = selectLatestCompatibleRelease([
    buildRelease("b11680", [
      "llama-b11680-bin-win-cuda-13.4-arm64.zip",
      "cudart-llama-bin-win-cuda-13.4-arm64.zip",
    ]),
    buildRelease("b11679", [
      "llama-b11679-bin-win-cuda-12.4-x64.zip",
      "cudart-llama-bin-win-cuda-12.4-x64.zip",
    ]),
    completeRelease("b11669"),
  ]);

  assert.equal(result.tag, "b11669");
});

test("fails clearly rather than silently reusing a pinned build", () => {
  assert.throws(
    () => selectLatestCompatibleRelease([buildRelease("v0.7.0", [])]),
    /No llama.cpp release contains both required/,
  );
  assert.throws(
    () => selectLatestCompatibleRelease({ message: "API rate limit exceeded" }),
    /invalid llama.cpp releases response/,
  );
});

test("recognizes only the exact reported llama-server build", () => {
  const output = "version: 0.6.0-dev (build 11669, commit 123456789)";
  assert.equal(versionMatches(output, "11669"), true);
  assert.equal(versionMatches(output, "1166"), false);
  assert.equal(versionMatches(output, "116690"), false);
});
