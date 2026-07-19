import type { ViewportLayout } from "@/hooks/useViewportLayout";
import { geometryPolicy } from "@/lib/keyboardGeometry";
import { PitchColumn, ModColumn, PerformanceStrip } from "./PerformanceStrip";
import { Ribbon } from "./Ribbon";
import { Keyboard, OctaveSustainColumn } from "./Keyboard";
import type { UiMode } from "@/state/store";

interface Props {
  uiMode: UiMode;
  layout: ViewportLayout;
  variant: "full" | "play" | "audition";
  onNoteOn: (midi: number, velocity: number) => void;
  onNoteOff: (midi: number) => void;
  onRibbonPosition: (norm: number) => void;
  onRibbonRelease: () => void;
}

/**
 * Coordinated performance dock.
 *
 * Portrait PLAY uses a deterministic CSS grid so Pitch | Mod | Oct/Sus | Keyboard
 * share one lower-row height (TX27-style). Shared geometry CSS vars are set per tier.
 */
export function PerformanceDock({
  uiMode,
  layout,
  variant,
  onNoteOn,
  onNoteOff,
  onRibbonPosition,
  onRibbonRelease,
}: Props) {
  const playFocused = variant === "play";
  const playPortrait = playFocused && layout.isPhonePortrait;
  const playLandscape =
    playFocused && (layout.isPhoneLandscape || layout.isShortLandscape || layout.isTablet);

  const policy = geometryPolicy({
    isPhonePortrait: layout.isPhonePortrait,
    isPhoneLandscape: layout.isPhoneLandscape || layout.isShortLandscape,
    isTablet: layout.isTablet,
    isDesktop: layout.isDesktop,
    isPortrait: layout.isPortrait,
    variant,
  });

  const shellClass = playFocused ? "flex-1 min-h-0 flex flex-col" : "shrink-0";
  const geo = dockGeometryVars(layout, playFocused);

  /** Grid lower row: Pitch | Mod | Oct/Sus | Keyboard — identical stretch height */
  const lowerGrid = (
    <div
      className="tx80-dock-lower min-w-0 w-full"
      data-tx80-dock-lower="true"
      style={{
        display: "grid",
        gridTemplateColumns:
          "var(--tx80-side-control-width) var(--tx80-side-control-width) var(--tx80-oct-col-width) minmax(0, 1fr)",
        gridTemplateRows: "minmax(var(--tx80-lower-perf-min), 1fr)",
        gap: "var(--tx80-dock-gap)",
        flex: playFocused ? 1 : undefined,
        minHeight: playFocused ? 0 : "var(--tx80-lower-perf-min)",
        alignItems: "stretch",
        height: playFocused ? "100%" : undefined,
      }}
    >
      <PitchColumn />
      <ModColumn />
      <OctaveSustainColumn fill />
      <Keyboard
        onNoteOn={onNoteOn}
        onNoteOff={onNoteOff}
        showSideControls={false}
        minKeyWidth={policy.minKeyWidth}
        useDesktopSteps={policy.useDesktopSteps}
        heightClass={policy.keyHeightClass}
        className="min-h-0 h-full self-stretch"
      />
    </div>
  );

  return (
    <section
      data-tx80-perf-dock={variant}
      data-tx80-ui-mode={uiMode}
      data-tx80-geo-tier={policy.tier}
      className={`border-t border-[color:var(--hairline)] px-2 sm:px-4 pt-2 bg-[color:var(--panel)] flex min-w-0 ${shellClass}`}
      style={{
        ...geo,
        paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
        paddingLeft: "max(env(safe-area-inset-left), 0.5rem)",
        paddingRight: "max(env(safe-area-inset-right), 0.5rem)",
      }}
    >
      {playPortrait || playLandscape || playFocused ? (
        <div className="flex-1 min-h-0 flex flex-col gap-0 w-full">
          <div className="shrink-0" data-tx80-ribbon-slot="true">
            <Ribbon onPosition={onRibbonPosition} onRelease={onRibbonRelease} />
          </div>
          {lowerGrid}
        </div>
      ) : (
        <div className="flex flex-col gap-2 w-full min-w-0">
          <Ribbon onPosition={onRibbonPosition} onRelease={onRibbonRelease} />
          <div className="flex gap-2 sm:gap-3 items-stretch min-w-0">
            <PerformanceStrip orientation="vertical" fillHeight={false} />
            <Keyboard
              onNoteOn={onNoteOn}
              onNoteOff={onNoteOff}
              showSideControls
              minKeyWidth={policy.minKeyWidth}
              useDesktopSteps={policy.useDesktopSteps}
              heightClass={policy.keyHeightClass}
              className="flex-1"
            />
          </div>
        </div>
      )}
    </section>
  );
}

/** Tier-tuned shared geometry (CSS custom properties on the dock). */
function dockGeometryVars(
  layout: ViewportLayout,
  playFocused: boolean,
): Record<string, string> {
  const largePhonePortrait =
    layout.isPhonePortrait && layout.tier === "phone-portrait-large";
  const compactPhonePortrait =
    layout.isPhonePortrait && layout.tier === "phone-portrait-compact";

  if (layout.isPhonePortrait) {
    return {
      "--tx80-dock-gap": "0.5rem",
      "--tx80-side-control-width": "2.75rem",
      "--tx80-oct-col-width": "3.5rem",
      "--tx80-ribbon-height": "2.75rem",
      // Lower row fills remaining dock; min based on available height, not a tiny fixed strip
      "--tx80-lower-perf-min": largePhonePortrait
        ? playFocused
          ? "min(52dvh, 28rem)"
          : "14rem"
        : compactPhonePortrait
          ? playFocused
            ? "min(48dvh, 22rem)"
            : "12.5rem"
          : "13rem",
    };
  }

  if (layout.isPhoneLandscape || layout.isShortLandscape) {
    return {
      "--tx80-dock-gap": "0.4rem",
      "--tx80-side-control-width": "2.5rem",
      "--tx80-oct-col-width": "3.25rem",
      "--tx80-ribbon-height": "2.25rem",
      "--tx80-lower-perf-min": playFocused ? "min(58dvh, 14rem)" : "9.5rem",
    };
  }

  if (layout.isTablet) {
    return {
      "--tx80-dock-gap": "0.6rem",
      "--tx80-side-control-width": "3rem",
      "--tx80-oct-col-width": "3.75rem",
      "--tx80-ribbon-height": "3rem",
      "--tx80-lower-perf-min": playFocused
        ? layout.isPortrait
          ? "min(42dvh, 22rem)"
          : "min(48dvh, 16rem)"
        : "12rem",
    };
  }

  return {
    "--tx80-dock-gap": "0.75rem",
    "--tx80-side-control-width": "3rem",
    "--tx80-oct-col-width": "4rem",
    "--tx80-ribbon-height": "3rem",
    "--tx80-lower-perf-min": playFocused ? "14rem" : "12rem",
  };
}
