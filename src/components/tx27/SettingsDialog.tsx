import { useState } from "react";
import { PatchDialogShell } from "./patch-library/PatchDialogShell";
import { TxSelect } from "./TxSelect";
import { DEFAULT_SETTINGS, type Tx27Settings } from "@/lib/settings";
import { formatDiag, readStartupDiagnostics } from "@/lib/startup-diagnostics";

const BEND_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `±${i + 1} ST`,
}));

/**
 * SETUP — global performance settings. These are instrument-level (stored on
 * the device, never inside patches): pitch-bend wheel range and the
 * confirm-before-discarding-edits behavior of preset switching.
 * Rendered in the shared themed dialog shell (focus trap, Esc, backdrop).
 */
export function SettingsDialog({
  settings,
  onChange,
  onClose,
}: {
  settings: Tx27Settings;
  onChange: (partial: Partial<Tx27Settings>) => void;
  onClose: () => void;
}) {
  const [diagOpen, setDiagOpen] = useState(false);
  // Read once per dialog open — records don't change while it is on screen.
  const [diag] = useState(() => readStartupDiagnostics());
  return (
    <PatchDialogShell title="SETUP · GLOBAL SETTINGS" onCancel={onClose}>
      {/* Pitch bend range */}
      <div className="flex items-center gap-2 pt-1">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] tracking-widest text-tx-cream">PITCH BEND RANGE</div>
          <div className="text-[9px] text-tx-muted mt-0.5 leading-relaxed">
            APPLIES TO EVERY PRESET · NEVER SAVED WITH PATCHES.
          </div>
        </div>
        <TxSelect
          className="text-center shrink-0"
          value={settings.bendRangeSemitones}
          options={BEND_OPTIONS}
          onChange={(v) => onChange({ bendRangeSemitones: v })}
          ariaLabel="Global pitch bend range in semitones"
        />
      </div>

      {/* Confirm preset change */}
      <div className="border-t border-black/40 pt-2 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] tracking-widest text-tx-cream">CONFIRM PRESET CHANGE</div>
          <div className="text-[9px] text-tx-muted mt-0.5 leading-relaxed">
            {settings.confirmPresetChange
              ? "ASKS BEFORE DISCARDING UNSAVED EDITS WHEN LOADING A PRESET."
              : "PRESETS LOAD INSTANTLY — UNSAVED EDITS ARE DISCARDED WITHOUT ASKING."}
          </div>
        </div>
        <div className="flex gap-1 shrink-0" role="group" aria-label="Confirm preset change">
          <button
            className={`tx-btn px-3 ${settings.confirmPresetChange ? "tx-btn-active" : ""}`}
            aria-pressed={settings.confirmPresetChange}
            onClick={() => onChange({ confirmPresetChange: true })}
          >
            ON
          </button>
          <button
            className={`tx-btn px-3 ${!settings.confirmPresetChange ? "tx-btn-active" : ""}`}
            aria-pressed={!settings.confirmPresetChange}
            onClick={() => onChange({ confirmPresetChange: false })}
          >
            OFF
          </button>
        </div>
      </div>

      {/* Startup diagnostics — LOCAL records only (this launch + previous),
          for debugging intermittent cold-start audio failures on physical
          devices. Nothing is ever transmitted anywhere. */}
      <div className="border-t border-black/40 pt-2">
        <button
          className="tx-btn w-full"
          aria-expanded={diagOpen}
          onClick={() => setDiagOpen((o) => !o)}
        >
          STARTUP DIAGNOSTICS {diagOpen ? "▴" : "▾"}
        </button>
        {diagOpen && (
          <div className="tx-lcd-box mt-1 p-2 text-[8px] leading-relaxed whitespace-pre-wrap break-words select-text max-h-48 overflow-y-auto">
            {`THIS LAUNCH\n${formatDiag(diag.current)}\n\nPREVIOUS LAUNCH\n${formatDiag(diag.previous)}\n\nSTORED ON THIS DEVICE ONLY.`}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-black/40 pt-2 flex items-center gap-1">
        <button
          className="tx-btn flex-1"
          onClick={() => onChange({ ...DEFAULT_SETTINGS })}
          title="Restore defaults: ±2 ST bend range, confirmation ON"
        >
          RESET SETTINGS
        </button>
        <button className="tx-btn flex-1 tx-btn-active" onClick={onClose}>
          CLOSE
        </button>
      </div>
      <div className="text-[8px] text-tx-muted tracking-wider text-center">
        GLOBAL · STORED ON THIS DEVICE
      </div>
    </PatchDialogShell>
  );
}
