import { describe, expect, it } from "vitest";
import { getDropdownNaturalHeight } from "./Dropdown";

describe("dropdown menu sizing", () => {
  it("includes borders and rounding allowance for a short two-option menu", () => {
    expect(getDropdownNaturalHeight(74, 76, 74)).toBe(77);
    expect(getDropdownNaturalHeight(74, 76, 74)).toBeGreaterThan(74);
  });

  it("preserves a larger menu's full measured height for viewport clamping", () => {
    expect(getDropdownNaturalHeight(420, 322, 320)).toBe(423);
    expect(Math.min(getDropdownNaturalHeight(420, 322, 320), 320)).toBe(320);
  });
});
