import { useEffect, useId, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DiagnosticTerminal } from "./DiagnosticTerminal";
import { formatBuildSummary, getBuildInfo } from "@/lib/diagnostics/buildInfo";
import { getRuntimeDiagSnapshot } from "@/lib/diagnostics/runtime";
import {
  loadTx80Settings,
  saveTx80Settings,
  TX80_DEFAULT_SETTINGS,
  type Tx80Settings,
  clampBendRange,
} from "@/synth-core/tx80/storage";
import { diagInfo, diagWarn } from "@/lib/diagnostics/buffer";

type Section = "SYSTEM" | "AUDIO" | "MIDI" | "DIAGNOSTICS" | "ABOUT";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * SETTINGS — instrument-level preferences + diagnostics.
 * Uses the shared Radix dialog (focus trap, Escape, return focus).
 */
export function SettingsDialog({ open, onOpenChange }: Props) {
  const titleId = useId();
  const [section, setSection] = useState<Section>("DIAGNOSTICS");
  const [settings, setSettings] = useState<Tx80Settings>(TX80_DEFAULT_SETTINGS);
  const [storageOk, setStorageOk] = useState(true);

  useEffect(() => {
    if (!open) return;
    try {
      setSettings(loadTx80Settings());
      setStorageOk(true);
    } catch {
      setStorageOk(false);
      diagWarn("SYSTEM", "settings load failed");
    }
  }, [open]);

  const updateSettings = (partial: Partial<Tx80Settings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    try {
      saveTx80Settings(next);
      setStorageOk(true);
    } catch {
      setStorageOk(false);
    }
    if (typeof partial.bendRangeSemitones === "number") {
      const w = window as unknown as { __TX80_SET_BEND_RANGE?: (n: number) => void };
      w.__TX80_SET_BEND_RANGE?.(next.bendRangeSemitones);
    }
    diagInfo("SYSTEM", "settings updated", {
      bend: next.bendRangeSemitones,
      confirm: next.confirmPresetChange,
    });
  };

  const snap = getRuntimeDiagSnapshot();
  const build = getBuildInfo();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="enclosure border-[color:var(--hairline-strong)] bg-[color:var(--panel)] text-[color:var(--foreground)] max-w-2xl max-h-[90vh] overflow-y-auto sm:rounded-lg"
        aria-labelledby={titleId}
      >
        <DialogHeader>
          <DialogTitle id={titleId} className="silkscreen-strong text-[color:var(--phosphor)]">
            SETTINGS · TX-80
          </DialogTitle>
          <DialogDescription className="silkscreen text-[color:var(--silkscreen-dim)]">
            Instrument preferences and runtime diagnostics
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Settings sections">
          {(["SYSTEM", "AUDIO", "MIDI", "DIAGNOSTICS", "ABOUT"] as Section[]).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={section === id}
              onClick={() => setSection(id)}
              className={`silkscreen-strong rounded-md border px-2 py-1 text-[0.65rem] ${
                section === id
                  ? "border-[color:var(--phosphor)] text-[color:var(--phosphor)]"
                  : "border-[color:var(--hairline)] text-[color:var(--silkscreen-dim)]"
              }`}
            >
              {id}
            </button>
          ))}
        </div>

        <div className="mt-2 space-y-3">
          {section === "SYSTEM" && (
            <SectionBox title="SYSTEM">
              <Row
                label="Pitch bend range"
                hint="Applies to the pitch wheel · stored on this device"
              >
                <select
                  className="readout bg-transparent border border-[color:var(--hairline)] rounded px-2 py-1 text-sm"
                  value={settings.bendRangeSemitones}
                  onChange={(e) =>
                    updateSettings({
                      bendRangeSemitones: clampBendRange(parseInt(e.target.value, 10)),
                    })
                  }
                  aria-label="Pitch bend range in semitones"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n} className="bg-[color:var(--panel-raised)]">
                      ±{n} st
                    </option>
                  ))}
                </select>
              </Row>
              <Row label="Confirm preset change" hint="Ask before discarding unsaved edits">
                <button
                  type="button"
                  className={`silkscreen rounded border px-2 py-1 text-[0.6rem] ${
                    settings.confirmPresetChange
                      ? "border-[color:var(--phosphor)] text-[color:var(--phosphor)]"
                      : "border-[color:var(--hairline)] text-[color:var(--silkscreen-dim)]"
                  }`}
                  aria-pressed={settings.confirmPresetChange}
                  onClick={() =>
                    updateSettings({ confirmPresetChange: !settings.confirmPresetChange })
                  }
                >
                  {settings.confirmPresetChange ? "ON" : "OFF"}
                </button>
              </Row>
              <p className="silkscreen text-[0.55rem]">
                Persistence: {storageOk ? "available" : "unavailable"}
              </p>
            </SectionBox>
          )}

          {section === "AUDIO" && (
            <SectionBox title="AUDIO">
              <pre className="panel-sunken p-2 text-[0.65rem] font-mono text-[color:var(--phosphor)] whitespace-pre-wrap">
                {`phase: ${snap.audioPhase}
context: ${snap.contextState}
sampleRate: ${snap.sampleRate ?? "n/a"}
baseLatency: ${snap.baseLatency ?? "n/a"}
outputLatency: ${snap.outputLatency ?? "n/a"}
voices: ${snap.activeVoices} / ${snap.maxPolyphony}
contextsCreated: ${snap.contextsCreated}
enginesCreated: ${snap.enginesCreated}
sustain: ${snap.sustain}
master: ${snap.masterLevel}
oldEngineLoaded: ${snap.oldEngineLoaded}`}
              </pre>
              <p className="silkscreen text-[0.55rem] text-[color:var(--silkscreen-dim)]">
                Use TAP TO START in the header to enable audio · PANIC clears voices
              </p>
            </SectionBox>
          )}

          {section === "MIDI" && (
            <SectionBox title="MIDI">
              <p className="silkscreen-strong text-[color:var(--amber)] text-[0.7rem]">
                DISABLED — deferred to Gate 5 / MIDI milestone
              </p>
              <p className="silkscreen text-[0.6rem] text-[color:var(--silkscreen-dim)]">
                Web MIDI support detected:{" "}
                {snap.midiAvailable === null ? "unknown" : snap.midiAvailable ? "yes" : "no"}
              </p>
              <p className="silkscreen text-[0.55rem]">
                Device I/O, CC sustain, and pitch-bend from hardware are not mounted in Gate 2.
              </p>
            </SectionBox>
          )}

          {section === "DIAGNOSTICS" && <DiagnosticTerminal />}

          {section === "ABOUT" && (
            <SectionBox title="ABOUT">
              <pre className="tx80-diag-terminal panel-sunken p-2 text-[0.65rem] font-mono text-[color:var(--phosphor)] whitespace-pre-wrap">
                {formatBuildSummary(build)}
              </pre>
              <p className="silkscreen text-[0.55rem] text-[color:var(--silkscreen-dim)]">
                TXPPS TX-80 · dual-layer expressive web synthesizer · Gate 2
              </p>
            </SectionBox>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel p-3 space-y-2" aria-label={title}>
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="silkscreen-strong text-[0.65rem]">{label}</div>
        {hint && <div className="silkscreen text-[0.5rem] mt-0.5">{hint}</div>}
      </div>
      {children}
    </div>
  );
}
