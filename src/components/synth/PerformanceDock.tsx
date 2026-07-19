import type { ViewportLayout } from "@/hooks/useViewportLayout";
import { geometryPolicy } from "@/lib/keyboardGeometry";
import { PerformanceStrip } from "./PerformanceStrip";
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
 * Coordinated performance dock — TX27 side-column proportions with TX-80 ribbon.
 * Phone portrait PLAY uses tall vertical Pitch/Mod + tall key bed (not short bars).
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

  /** Shared side-column row: tall wheels | octave/sus | keyboard */
  const sideColumnRow = (
    <div
      className={`flex gap-2 sm:gap-3 items-stretch min-w-0 ${playFocused ? "flex-1 min-h-0" : ""}`}
      style={playFocused ? { minHeight: playPortrait ? 220 : 170 } : undefined}
      data-tx80-dock-row="side"
    >
      <PerformanceStrip orientation="vertical" fillHeight className="shrink-0" />
      <OctaveSustainColumn />
      <Keyboard
        onNoteOn={onNoteOn}
        onNoteOff={onNoteOff}
        showSideControls={false}
        minKeyWidth={policy.minKeyWidth}
        useDesktopSteps={policy.useDesktopSteps}
        heightClass={policy.keyHeightClass}
        className="flex-1 min-h-0"
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
        paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
        paddingLeft: "max(env(safe-area-inset-left), 0.5rem)",
        paddingRight: "max(env(safe-area-inset-right), 0.5rem)",
      }}
    >
      {playPortrait || playLandscape || playFocused ? (
        <div className="flex-1 min-h-0 flex flex-col gap-1.5 w-full">
          <Ribbon onPosition={onRibbonPosition} onRelease={onRibbonRelease} />
          {sideColumnRow}
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
