# Settings Page Implementation

## Scope
Add TideCode-inspired Settings navigation with General and Updates. When Settings opens, its dedicated sidebar replaces the normal app sidebar. General exposes only Theme and Language. Theme choices Light, Dark, System use TideStudio's existing SegmentedField. Language uses the existing Dropdown.

## Structure
- `studio/src/app/App.tsx`: Settings route, section selection, and primary/sidebar replacement behavior.
- `studio/src/app/NavigationPanel.tsx`: enabled Settings entry.
- `studio/src/features/settings/SettingsSidebar.tsx`: secondary General/Updates navigation.
- `studio/src/features/settings/GeneralSettings.tsx`: Appearance and Preferences rows.
- `studio/src/features/settings/UpdatesSettings.tsx`: installed application version.
- `studio/src/lib/appearance.ts`: SQLite-backed appearance and locale preferences.
- `studio/src/styles/global.css`: shared light/dark tokens and settings layout.
- `DESIGN.md` and `AGENTS_LEARNING.md`: visual guidelines and durable preferences.

The Settings workspace reuses the existing no-inspector layout mode rather than introducing another resize implementation. The Settings sidebar occupies the existing left panel slot.

## Verification
`npm run build` passed for the API gateway, TypeScript frontend, and Vite production bundle. The bundle-size warning does not block the build. Desktop UI interactions require visual smoke testing on the running Tauri application.
