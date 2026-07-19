/**
 * TX27-derived keyboard geometry for TX-80.
 * Discrete white-key ranges — never shrink keys just to show more notes.
 */

/** Musically sensible visible ranges (white keys). */
export const RANGE_STEPS_COMPACT = [14, 10, 7] as const;
/** Desktop may show a broader range when width allows. */
export const RANGE_STEPS_DESKTOP = [28, 21, 14, 10, 7] as const;

export type GeometryTier =
  | "phone-portrait"
  | "phone-landscape"
  | "tablet-portrait"
  | "tablet-landscape"
  | "desktop";

export interface KeyboardGeometryPolicy {
  tier: GeometryTier;
  minKeyWidth: number;
  /** Target / minimum keyboard bed height in CSS. */
  keyHeightClass: string;
  /** Documented expected white-key count band (for docs/tests). */
  whiteKeyTarget: string;
  useDesktopSteps: boolean;
}

export function whiteKeyCountForWidth(
  widthPx: number,
  minKeyWidth: number,
  useDesktopSteps = false,
): number {
  const steps = useDesktopSteps ? RANGE_STEPS_DESKTOP : RANGE_STEPS_COMPACT;
  const w = Math.max(0, widthPx);
  for (const c of steps) {
    if (w / c >= minKeyWidth) return c;
  }
  return 7;
}

export function geometryPolicy(args: {
  isPhonePortrait: boolean;
  isPhoneLandscape: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isPortrait: boolean;
  variant: "full" | "play" | "audition";
}): KeyboardGeometryPolicy {
  const { isPhonePortrait, isPhoneLandscape, isTablet, isDesktop, isPortrait, variant } = args;

  if (variant === "audition") {
    return {
      tier: isPhonePortrait ? "phone-portrait" : isDesktop ? "desktop" : "tablet-portrait",
      minKeyWidth: 28,
      keyHeightClass: "h-[min(18vh,140px)] min-h-[110px]",
      whiteKeyTarget: "7–10",
      useDesktopSteps: false,
    };
  }

  if (isPhonePortrait) {
    return {
      tier: "phone-portrait",
      minKeyWidth: variant === "play" ? 34 : 30,
      // PLAY: aggressively tall keys (TX27 portrait was short; screenshots demand taller).
      keyHeightClass:
        variant === "play"
          ? "h-full min-h-[200px]"
          : "h-[min(22vh,180px)] min-h-[140px]",
      whiteKeyTarget: "7–10",
      useDesktopSteps: false,
    };
  }

  if (isPhoneLandscape) {
    return {
      tier: "phone-landscape",
      minKeyWidth: 30,
      keyHeightClass: "h-full min-h-[140px]",
      whiteKeyTarget: "10–14",
      useDesktopSteps: false,
    };
  }

  if (isTablet && isPortrait) {
    return {
      tier: "tablet-portrait",
      minKeyWidth: 28,
      keyHeightClass: variant === "play" ? "h-full min-h-[180px]" : "h-[min(22vh,200px)] min-h-[150px]",
      whiteKeyTarget: "10–14",
      useDesktopSteps: false,
    };
  }

  if (isTablet) {
    return {
      tier: "tablet-landscape",
      minKeyWidth: 26,
      keyHeightClass: variant === "play" ? "h-full min-h-[170px]" : "h-[min(26vh,240px)] min-h-[170px]",
      whiteKeyTarget: "14",
      useDesktopSteps: false,
    };
  }

  return {
    tier: "desktop",
    minKeyWidth: 24,
    keyHeightClass: variant === "play" ? "h-full min-h-[180px]" : "h-[min(26vh,260px)] min-h-[170px]",
    whiteKeyTarget: "14–28",
    useDesktopSteps: true,
  };
}
