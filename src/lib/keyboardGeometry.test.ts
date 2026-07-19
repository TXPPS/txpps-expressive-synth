import { describe, expect, it } from "vitest";
import { whiteKeyCountForWidth, geometryPolicy } from "@/lib/keyboardGeometry";

describe("keyboardGeometry", () => {
  it("uses TX27 discrete steps for compact widths", () => {
    expect(whiteKeyCountForWidth(340, 34)).toBe(10);
    expect(whiteKeyCountForWidth(300, 34)).toBe(7);
    expect(whiteKeyCountForWidth(420, 30)).toBe(14);
    expect(whiteKeyCountForWidth(200, 30)).toBe(7);
  });

  it("allows broader desktop ranges", () => {
    expect(whiteKeyCountForWidth(900, 24, true)).toBe(28);
    expect(whiteKeyCountForWidth(520, 24, true)).toBe(21);
    expect(whiteKeyCountForWidth(360, 24, true)).toBe(14);
  });

  it("phone portrait PLAY prefers tall key height class", () => {
    const p = geometryPolicy({
      isPhonePortrait: true,
      isPhoneLandscape: false,
      isTablet: false,
      isDesktop: false,
      isPortrait: true,
      variant: "play",
    });
    expect(p.minKeyWidth).toBe(34);
    expect(p.keyHeightClass).toContain("min-h-[200px]");
    expect(p.whiteKeyTarget).toBe("7–10");
  });
});
