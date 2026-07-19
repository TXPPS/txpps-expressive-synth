import type { ViewportLayout } from "@/hooks/useViewportLayout";
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
 * Coordinated performance dock: ribbon + keyboard + pitch/mod + octave/sustain.
 * Layout contracts follow TX27 behavioral patterns adapted to TX-80 identity.
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
  const playPortrait = variant === "play" && layout.isPhonePortrait;
  const playLandscape = variant === "play" && (layout.isPhoneLandscape || layout.isShortLandscape);
  const audition = variant === "audition";

  const minKeyWidth =
    variant === "play"
      ? playPortrait
        ? 34
        : playLandscape
          ? 30
          : 28
      : audition
        ? 28
        : layout.isPhonePortrait
          ? 30
          : 24;

  const keyHeight = audition
    ? "h-20"
    : playPortrait
      ? "h-[min(15vh,125px)] min-h-[90px]"
      : playLandscape
        ? "h-full min-h-[120px]"
        : layout.isPhonePortrait
          ? "h-[min(18vh,140px)] min-h-[100px]"
          : "h-28 sm:h-36 md:h-40";

  const shellClass =
    variant === "play"
      ? "flex-1 min-h-0 flex flex-col"
      : audition
        ? "shrink-0"
        : "shrink-0";

  return (
    <section
      data-tx80-perf-dock={variant}
      data-tx80-ui-mode={uiMode}
      className={`border-t border-[color:var(--hairline)] px-2 sm:px-4 pt-2 bg-[color:var(--panel)] flex min-w-0 ${shellClass}`}
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
        paddingLeft: "max(env(safe-area-inset-left), 0.5rem)",
        paddingRight: "max(env(safe-area-inset-right), 0.5rem)",
      }}
    >
      {playPortrait ? (
        <div className="flex-1 min-h-0 flex flex-col gap-2" style={{ minHeight: 200 }}>
          <OctaveSustainColumn horizontal />
          <PerformanceStrip orientation="horizontal" className="shrink-0" />
          <Ribbon onPosition={onRibbonPosition} onRelease={onRibbonRelease} />
          <div className="mt-auto shrink-0">
            <Keyboard
              onNoteOn={onNoteOn}
              onNoteOff={onNoteOff}
              showSideControls={false}
              minKeyWidth={minKeyWidth}
              heightClass={keyHeight}
            />
          </div>
        </div>
      ) : playLandscape ? (
        <div className="flex-1 min-h-0 flex flex-col gap-1.5" style={{ minHeight: 160 }}>
          <Ribbon onPosition={onRibbonPosition} onRelease={onRibbonRelease} />
          <div className="flex-1 min-h-0 flex gap-2 items-stretch">
            <PerformanceStrip orientation="vertical" className="shrink-0 self-stretch" />
            <OctaveSustainColumn />
            <Keyboard
              onNoteOn={onNoteOn}
              onNoteOff={onNoteOff}
              showSideControls={false}
              minKeyWidth={minKeyWidth}
              heightClass={keyHeight}
              className="flex-1"
            />
          </div>
        </div>
      ) : (
        <div
          className={`flex flex-col gap-2 w-full min-w-0 ${variant === "play" ? "flex-1 min-h-0" : ""}`}
        >
          <Ribbon onPosition={onRibbonPosition} onRelease={onRibbonRelease} />
          <div
            className={`flex gap-2 sm:gap-3 items-stretch min-w-0 ${variant === "play" ? "flex-1 min-h-0" : ""}`}
          >
            <PerformanceStrip orientation="vertical" />
            <Keyboard
              onNoteOn={onNoteOn}
              onNoteOff={onNoteOff}
              showSideControls
              minKeyWidth={minKeyWidth}
              heightClass={keyHeight}
              className="flex-1"
            />
          </div>
        </div>
      )}
    </section>
  );
}
