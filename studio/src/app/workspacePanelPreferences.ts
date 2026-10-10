export const WORKSPACE_PANEL_WIDTHS_PREFERENCE_KEY =
  "workspace.panel_widths.v1";

export type WorkspacePanelPreferences = {
  left: number;
  standardRight: number;
  detailRight: number;
};

const DEFAULTS: WorkspacePanelPreferences = {
  left: 220,
  standardRight: 320,
  detailRight: 640,
};

function isUsableWidth(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function defaultWorkspacePanelPreferences(): WorkspacePanelPreferences {
  return { ...DEFAULTS };
}

export function parseWorkspacePanelPreferences(
  raw: string | null,
): WorkspacePanelPreferences {
  if (!raw) return defaultWorkspacePanelPreferences();

  try {
    const parsed = JSON.parse(raw) as Partial<WorkspacePanelPreferences>;
    return {
      left: isUsableWidth(parsed.left) ? parsed.left : DEFAULTS.left,
      standardRight: isUsableWidth(parsed.standardRight)
        ? parsed.standardRight
        : DEFAULTS.standardRight,
      detailRight: isUsableWidth(parsed.detailRight)
        ? parsed.detailRight
        : DEFAULTS.detailRight,
    };
  } catch {
    return defaultWorkspacePanelPreferences();
  }
}
