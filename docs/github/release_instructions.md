# GitHub Release Instructions

This document defines how TideStudio GitHub releases should be prepared and written.

## Release version

Use semantic versions in the form:

```text
vMAJOR.MINOR.PATCH
```

Examples:

```text
v0.1.0
v0.1.1
v0.2.0
```

Before building a release, keep the application version synchronized in all of these files:

```text
studio/package.json
studio/package-lock.json
studio/src-tauri/Cargo.toml
studio/src-tauri/Cargo.lock
studio/src-tauri/tauri.conf.json
```

The version in the Git tag, changelog, application metadata, and installer must match.

## CHANGELOG.md

Every release gets its own section in `CHANGELOG.md`.

Use this structure when applicable:

```markdown
## [0.1.1] - 2026-10-12

### Added

- New user-facing functionality.

### Changed

- Existing behavior that was improved or intentionally changed.

### Fixed

- Bugs and regressions that were corrected.
```

Keep changelog entries factual and user-facing. Avoid listing internal refactors unless they have a meaningful effect on users.

Keep `## [Unreleased]` at the top for work intended for the next release.

## Release title

Use a short title with the version followed by the main focus of the release.

Format:

```text
TideStudio v<VERSION> - <Short Release Focus>
```

Example:

```text
TideStudio v0.1.1 - Model Loading Improvements
```

Do not use exaggerated marketing language.

## Release description

Release descriptions should be concise, readable, and focused on what changed for users.

Recommended structure:

```markdown
# TideStudio v0.1.1

One or two sentences summarizing the release.

## What's changed

### Feature or area

- Change
- Change
- Change

### Fixes and improvements

- Fix
- Improvement

## Platform support

TideStudio currently supports:

- Windows x64

macOS and Linux builds are not available yet.

## Feedback

If you run into a problem or have a suggestion, open an issue:

[GitHub Issues](https://github.com/ceciliomichael/tidestudio/issues)
```

Sections should reflect the actual release. Do not add headings that have nothing useful underneath them.

## GitHub links

Use normal GitHub Markdown links with the visible title inside square brackets and the URL immediately after it in parentheses.

Correct:

```markdown
[GitHub Issues](https://github.com/ceciliomichael/tidestudio/issues)
```

This must render as one clickable `GitHub Issues` label.

Do not write a separate title followed by a raw URL when a named link is intended.

Use the same form for other links:

```markdown
[Releases](https://github.com/ceciliomichael/tidestudio/releases)
[llama.cpp](https://github.com/ggml-org/llama.cpp)
```

When copying generated release text into GitHub, paste the Markdown source into the **Write** tab and verify it in **Preview** before publishing.

## Platform wording

Until additional builds are actually supported and tested, use:

```markdown
## Platform support

TideStudio currently supports:

- Windows x64

macOS and Linux builds are not available yet.
```

Do not claim macOS or Linux support before those builds are ready.

## Building the Windows release

From the project:

```powershell
cd D:\tidestudio\studio
npm ci
npm run release:windows
```

The Windows release build checks the published llama.cpp GitHub releases and
automatically downloads the newest release with both Windows x64 CUDA 13.4
archives. If that exact runtime is already installed locally, it is reused.
The new runtime is validated before replacing the existing one. A failed
download or invalid runtime stops packaging rather than bundling stale files.
This requires a working internet connection when checking for releases.

Development startup continues to use the pinned llama.cpp runtime.

The NSIS installer is generated under:

```text
studio\src-tauri\target\release\bundle\nsis\
```

Confirm the generated installer filename contains the intended release version before uploading it.

## Before publishing

Check all of the following:

- The intended changes are committed.
- The working tree contains no accidental files.
- `CHANGELOG.md` contains the release entry.
- All application version files match.
- The Windows installer builds successfully.
- The installer has been manually tested.
- The release title uses the correct version.
- The release description matches the actual changes.
- Markdown links render correctly in GitHub Preview.
- Only intended release assets are uploaded.

## Tagging

After the release commit is pushed:

```powershell
cd D:\tidestudio
git tag -a v0.1.1 -m "TideStudio v0.1.1"
git push origin v0.1.1
```

Replace `0.1.1` with the version being released.

## GitHub release

Create the release from:

```text
https://github.com/ceciliomichael/tidestudio/releases/new
```

Use:

- Tag: the matching `vX.Y.Z` tag
- Target: `main`
- Title: the release title defined above
- Description: the prepared Markdown release description
- Asset: the generated Windows x64 NSIS setup executable

Preview the release description before publishing.
