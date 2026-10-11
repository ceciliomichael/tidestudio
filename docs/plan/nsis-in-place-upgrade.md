# NSIS In-Place Upgrade

## Intended result

Running a TideStudio Windows setup over an existing NSIS installation should update the installed files directly instead of showing Tauri's "Already Installed" maintenance page.

The installer should keep the current install directory, close a running TideStudio instance before file replacement, preserve user data and models, and continue installation without requiring the user to uninstall first.

Legacy WiX installations should still be removed before installation so WiX and NSIS registrations do not overlap.

## Project structure

```text
D:\tidestudio\
├── CHANGELOG.md
├── docs\
│   └── plan\
│       └── nsis-in-place-upgrade.md
└── studio\
    └── src-tauri\
        ├── tauri.conf.json
        └── nsis\
            ├── close-running-app.nsh
            └── installer.nsi
```

## File-by-file changes

- `studio/src-tauri/nsis/installer.nsi` - created from the Tauri CLI 2.12.1 NSIS template and customized so existing NSIS installs are treated as in-place updates without the maintenance page. Legacy WiX migration remains supported.
- `studio/src-tauri/tauri.conf.json` - modified to use the custom NSIS template.
- `studio/src-tauri/nsis/close-running-app.nsh` - unchanged. Its preinstall hook continues to gracefully close TideStudio before files are replaced, with Restart Manager fallback for older builds.
- `CHANGELOG.md` - modified to document the new Windows setup behavior.
- `docs/plan/nsis-in-place-upgrade.md` - created to document the installer behavior and validation.

## Behavior

For an existing NSIS installation:

1. Detect the existing TideStudio uninstall registration.
2. Mark the setup as update mode.
3. Keep the previously registered install directory.
4. Skip the maintenance choice and install-directory/start-menu pages.
5. Run the existing preinstall shutdown hook.
6. Replace the installed application and bundled runtime files in place.
7. Preserve user data, model storage, and application preferences outside the installation directory.

For a legacy WiX installation:

1. Detect the matching WiX uninstall registration.
2. Run the legacy WiX uninstaller.
3. Continue with the normal NSIS installation.

## Verification

- Run `git diff --check`.
- Build with `npm run release:windows`.
- Confirm the generated NSIS script uses the custom template.
- Confirm the generated script does not contain the interactive `PageReinstall` maintenance flow.
- Confirm the generated installer is `TideStudio_0.1.1_x64-setup.exe`.
- Confirm the close-running-app preinstall hook is still included.
