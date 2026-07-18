import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Header } from "@/components/synth/Header";
import { PresetBar } from "@/components/synth/PresetBar";
import { LayerPanel } from "@/components/synth/LayerPanel";
import { ModPanel } from "@/components/synth/ModPanel";
import { FxPanel } from "@/components/synth/FxPanel";
import { MasterPanel } from "@/components/synth/MasterPanel";
import { PerformanceStrip } from "@/components/synth/PerformanceStrip";
import { Ribbon } from "@/components/synth/Ribbon";
import { Keyboard } from "@/components/synth/Keyboard";
import { useSynthStore } from "@/state/store";

export const Route = createFileRoute("/")({
  component: TX80Panel,
});

function TX80Panel() {
  const audioStatus = useSynthStore((s) => s.audioStatus);
  const setAudioStatus = useSynthStore((s) => s.setAudioStatus);

  // TEMP M1: mark the audio subsystem "idle → ready" via a click gesture on
  // the enable-audio pill. Full AudioContext lifecycle lands in Milestone 2.
  useEffect(() => {}, []);

  const enableAudio = () => {
    if (audioStatus === "running") return;
    setAudioStatus("starting");
    // Placeholder for M1: pretend startup succeeded so the shell reports READY.
    // M2 replaces this with real AudioContext.resume().
    setTimeout(() => setAudioStatus("running"), 120);
  };

  return (
    <div className="min-h-screen enclosure flex flex-col safe-t">
      <Header />
      <PresetBar />

      {/* Compact audio-enable pill (non-blocking; replaces a big modal) */}
      {audioStatus !== "running" && (
        <button
          onClick={enableAudio}
          className="mx-3 sm:mx-4 mb-2 panel-sunken silkscreen-strong text-[color:var(--amber)] border border-[color:var(--amber-dim)] px-3 py-1.5 rounded self-start text-[0.65rem] sm:text-xs"
        >
          ▶ TAP TO ENABLE AUDIO — {audioStatus === "starting" ? "starting…" : "browser autoplay policy"}
        </button>
      )}

      {/* Main workspace — CSS grid drives responsive rearrangement */}
      <main className="flex-1 grid gap-3 px-3 sm:px-4 pb-3 min-h-0"
            style={{
              gridTemplateAreas: "'layerI' 'layerII' 'mod' 'fx' 'master'",
              gridTemplateColumns: "minmax(0,1fr)",
            }}>
        <div style={{ gridArea: "layerI" }}><LayerPanel scope="layerI" label="Layer I" /></div>
        <div style={{ gridArea: "layerII" }}><LayerPanel scope="layerII" label="Layer II" /></div>
        <div style={{ gridArea: "mod" }}><ModPanel /></div>
        <div style={{ gridArea: "fx" }}><FxPanel /></div>
        <div style={{ gridArea: "master" }}><MasterPanel /></div>
      </main>

      {/* Performance zone — always anchored above the keyboard */}
      <section className="border-t border-[color:var(--hairline)] px-3 sm:px-4 py-2 bg-[color:var(--panel)] flex items-stretch gap-2 min-w-0">
        <PerformanceStrip />
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <Ribbon />
          <Keyboard />
        </div>
      </section>

      <div className="silkscreen text-center py-1.5 border-t border-[color:var(--hairline)] safe-b">
        TXPPS TX-80 · Milestone 1 · responsive shell — audio engine wires in M2
      </div>

      {/* Responsive rearrangement via inline media queries in a style tag.
          Keeps a single source of layout truth co-located with the route. */}
      <style>{`
        @media (min-width: 640px) {
          main { grid-template-areas:
              'layerI layerII'
              'mod fx'
              'master master' !important;
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (min-width: 1024px) {
          main { grid-template-areas:
              'layerI layerII mod'
              'layerI layerII fx'
              'master master master' !important;
            grid-template-columns: 1.15fr 1.15fr 0.9fr !important;
          }
        }
        @media (min-width: 1400px) {
          main { grid-template-areas:
              'layerI layerII mod fx'
              'master master master master' !important;
            grid-template-columns: 1.1fr 1.1fr 0.9fr 0.9fr !important;
          }
        }
        /* Phone landscape: performance-first — compress panels, keep keyboard tall */
        @media (max-height: 500px) and (orientation: landscape) {
          main { display: none; }
        }
      `}</style>
    </div>
  );
}
