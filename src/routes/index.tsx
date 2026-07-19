import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Header } from "@/components/synth/Header";
import { PresetBar } from "@/components/synth/PresetBar";
import { LayerPanel } from "@/components/synth/LayerPanel";
import { ModPanel } from "@/components/synth/ModPanel";
import { FxPanel } from "@/components/synth/FxPanel";
import { MasterPanel } from "@/components/synth/MasterPanel";
import { PerformanceDock } from "@/components/synth/PerformanceDock";
import { useSynthStore, type EditorSection } from "@/state/store";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { installDiagnosticCapture, patchRuntimeDiag } from "@/lib/diagnostics/runtime";
import { useViewportLayout } from "@/hooks/useViewportLayout";

export const Route = createFileRoute("/")({
  component: TX80Panel,
});

const SECTIONS: { id: EditorSection; label: string }[] = [
  { id: "layerI", label: "LAYER I" },
  { id: "layerII", label: "LAYER II" },
  { id: "mod", label: "MOD" },
  { id: "fx", label: "FX" },
  { id: "master", label: "MASTER" },
];

function TX80Panel() {
  const uiMode = useSynthStore((s) => s.uiMode);
  const activeLayerTab = useSynthStore((s) => s.activeLayerTab);
  const setActiveLayerTab = useSynthStore((s) => s.setActiveLayerTab);
  const editKeysVisible = useSynthStore((s) => s.editKeysVisible);
  const setEditKeysVisible = useSynthStore((s) => s.setEditKeysVisible);
  const layout = useViewportLayout();
  const { initialize, handleNoteOn, handleNoteOff, handleRibbonPosition, handleRibbonRelease } =
    useAudioEngine();

  useEffect(() => {
    installDiagnosticCapture();
    document.documentElement.dataset.tx80Hydrated = "true";
    return () => {
      delete document.documentElement.dataset.tx80Hydrated;
    };
  }, []);

  useEffect(() => {
    patchRuntimeDiag({
      uiMode,
      viewport: `${layout.width}x${layout.height}`,
      orientation: layout.isPortrait ? "portrait" : "landscape",
      layoutTier: layout.tier,
    });
  }, [uiMode, layout]);

  const showEditor = uiMode === "full" || uiMode === "edit";
  const showPerfDock = uiMode === "full" || uiMode === "play" || (uiMode === "edit" && editKeysVisible);
  const playFocused = uiMode === "play";
  const useSectionNav = showEditor && (layout.isPhonePortrait || (layout.isNarrow && uiMode === "edit"));

  const dockVariant = playFocused ? "play" : uiMode === "edit" ? "audition" : "full";

  return (
    <div
      className={`enclosure flex flex-col ${
        playFocused ? "h-[100dvh] max-h-[100dvh]" : "min-h-[100dvh]"
      }`}
      data-tx80-shell={uiMode}
      data-tx80-tier={layout.tier}
      data-tx80-scroll-owner="document"
      style={{
        // Fixed app header publishes --tx80-header-height; pad content so nothing hides under it.
        // Fallback covers first paint before ResizeObserver. Safe-area is inside the header itself.
        paddingTop: "var(--tx80-header-height, 3.25rem)",
      }}
    >
      <Header onAudioStart={initialize} />
      <PresetBar />

      {showEditor && (
        <>
          {useSectionNav && (
            <nav
              className="flex gap-1 px-2 sm:px-4 pb-2 overflow-x-auto shrink-0"
              aria-label="Editor sections"
              data-tx80-section-nav="true"
            >
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveLayerTab(s.id)}
                  className={`silkscreen-strong shrink-0 rounded-md border px-2 py-2 text-[0.55rem] min-h-11 ${
                    activeLayerTab === s.id
                      ? "border-[color:var(--phosphor)] text-[color:var(--phosphor)]"
                      : "border-[color:var(--hairline)] text-[color:var(--silkscreen-dim)]"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </nav>
          )}

          <main
            className={`flex-1 grid gap-2 sm:gap-3 px-2 sm:px-4 pb-2 min-h-0 min-w-0 ${
              playFocused ? "hidden" : ""
            } ${useSectionNav ? "tx80-editor-nav" : "tx80-editor-grid"}`}
            data-tx80-editor="true"
          >
            {(!useSectionNav || activeLayerTab === "layerI") && (
              <div style={{ gridArea: useSectionNav ? undefined : "layerI" }} data-tx80-section="layerI">
                <LayerPanel scope="layerI" label="Layer I" />
              </div>
            )}
            {(!useSectionNav || activeLayerTab === "layerII") && (
              <div style={{ gridArea: useSectionNav ? undefined : "layerII" }} data-tx80-section="layerII">
                <LayerPanel scope="layerII" label="Layer II" />
              </div>
            )}
            {(!useSectionNav || activeLayerTab === "mod") && (
              <div style={{ gridArea: useSectionNav ? undefined : "mod" }} data-tx80-section="mod">
                <ModPanel />
              </div>
            )}
            {(!useSectionNav || activeLayerTab === "fx") && (
              <div style={{ gridArea: useSectionNav ? undefined : "fx" }} data-tx80-section="fx">
                <FxPanel />
              </div>
            )}
            {(!useSectionNav || activeLayerTab === "master") && (
              <div style={{ gridArea: useSectionNav ? undefined : "master" }} data-tx80-section="master">
                <MasterPanel />
              </div>
            )}
          </main>

          {uiMode === "edit" && (
            <div className="px-2 sm:px-4 pb-2 shrink-0">
              <button
                type="button"
                data-tx80-edit-keys-toggle="true"
                onClick={() => setEditKeysVisible(!editKeysVisible)}
                className="silkscreen-strong w-full sm:w-auto rounded-md border border-[color:var(--hairline)] px-3 py-2 text-[0.65rem] min-h-11"
                aria-pressed={editKeysVisible}
              >
                {editKeysVisible ? "HIDE KEYS" : "SHOW KEYS"}
              </button>
            </div>
          )}
        </>
      )}

      {showPerfDock && (
        <PerformanceDock
          uiMode={uiMode}
          layout={layout}
          variant={dockVariant}
          onNoteOn={handleNoteOn}
          onNoteOff={handleNoteOff}
          onRibbonPosition={handleRibbonPosition}
          onRibbonRelease={handleRibbonRelease}
        />
      )}

      {/* PLAY: no footer — reclaim height for Pitch/Mod/Sustain/keys.
          FULL/EDIT: thin build line only on non-phone; phone uses Settings → ABOUT. */}
      {!playFocused && !layout.isNarrow && (
        <div
          className="silkscreen text-center py-1 border-t border-[color:var(--hairline)] safe-b shrink-0"
          data-tx80-build-footer="true"
        >
          TXPPS TX-80 · {uiMode === "edit" ? "EDIT" : "FULL"} · {layout.tier}
        </div>
      )}

      <style>{`
        .tx80-editor-grid {
          grid-template-areas: 'layerI' 'layerII' 'mod' 'fx' 'master';
          grid-template-columns: minmax(0,1fr);
        }
        .tx80-editor-nav {
          grid-template-columns: minmax(0,1fr);
          grid-template-areas: none;
        }
        @media (min-width: 640px) {
          .tx80-editor-grid {
            grid-template-areas:
              'layerI layerII'
              'mod fx'
              'master master' !important;
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (min-width: 1024px) {
          .tx80-editor-grid {
            grid-template-areas:
              'layerI layerII mod'
              'layerI layerII fx'
              'master master master' !important;
            grid-template-columns: 1.15fr 1.15fr 0.9fr !important;
          }
        }
        @media (min-width: 1400px) {
          .tx80-editor-grid {
            grid-template-areas:
              'layerI layerII mod fx'
              'master master master master' !important;
            grid-template-columns: 1.1fr 1.1fr 0.9fr 0.9fr !important;
          }
        }
        /* Phone landscape: keep FULL editor available only when not height-starved play */
        @media (max-height: 420px) and (orientation: landscape) {
          [data-tx80-shell="full"] .tx80-editor-grid {
            max-height: 38dvh;
            overflow-y: auto;
          }
        }
      `}</style>
    </div>
  );
}
