import { useEffect, useState } from "react";

/**
 * Capability-based viewport tiers (no user-agent sniffing).
 * Combines width, height, orientation, and coarse aspect to drive
 * PLAY / EDIT / FULL layout contracts.
 */

export type ViewportTier =
  | "phone-portrait-compact"
  | "phone-portrait-large"
  | "phone-landscape-compact"
  | "phone-landscape-large"
  | "tablet-portrait"
  | "tablet-landscape"
  | "desktop"
  | "wide-desktop";

export interface ViewportLayout {
  tier: ViewportTier;
  width: number;
  height: number;
  isPortrait: boolean;
  isLandscape: boolean;
  /** Phone-class width (≤767) */
  isNarrow: boolean;
  /** Short landscape (height ≤560) — prioritize keyboard */
  isShortLandscape: boolean;
  /** Phone-class + portrait */
  isPhonePortrait: boolean;
  /** Phone-class + landscape */
  isPhoneLandscape: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

function classify(w: number, h: number): ViewportLayout {
  const isPortrait = h >= w;
  const isLandscape = !isPortrait;
  const isNarrow = w <= 767;
  const isShortLandscape = isLandscape && h <= 560;
  const shortSide = Math.min(w, h);
  const longSide = Math.max(w, h);

  let tier: ViewportTier;
  if (isNarrow && isPortrait) {
    tier = shortSide < 390 ? "phone-portrait-compact" : "phone-portrait-large";
  } else if (isNarrow && isLandscape) {
    tier = h < 420 ? "phone-landscape-compact" : "phone-landscape-large";
  } else if (w < 1024 && isPortrait) {
    tier = "tablet-portrait";
  } else if (w < 1024 && isLandscape) {
    tier = "tablet-landscape";
  } else if (w >= 1600) {
    tier = "wide-desktop";
  } else {
    tier = "desktop";
  }

  // Prefer tablet labels when both sides are tablet-ish even if width ≤767 in landscape foldables
  if (!isNarrow && shortSide >= 600 && longSide < 1400 && (tier === "desktop" || tier.startsWith("phone"))) {
    tier = isPortrait ? "tablet-portrait" : "tablet-landscape";
  }

  return {
    tier,
    width: w,
    height: h,
    isPortrait,
    isLandscape,
    isNarrow,
    isShortLandscape,
    isPhonePortrait: isNarrow && isPortrait,
    isPhoneLandscape: isNarrow && isLandscape,
    isTablet: tier.startsWith("tablet"),
    isDesktop: tier === "desktop" || tier === "wide-desktop",
  };
}

export function useViewportLayout(): ViewportLayout {
  const [layout, setLayout] = useState<ViewportLayout>(() =>
    typeof window === "undefined"
      ? classify(1280, 800)
      : classify(window.innerWidth, window.innerHeight),
  );

  useEffect(() => {
    const update = () => setLayout(classify(window.innerWidth, window.innerHeight));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    const mq = window.matchMedia("(orientation: portrait)");
    mq.addEventListener?.("change", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      mq.removeEventListener?.("change", update);
    };
  }, []);

  return layout;
}
