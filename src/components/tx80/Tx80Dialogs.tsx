import { useState } from "react";
import { PatchDialogShell } from "@/components/tx27/patch-library/PatchDialogShell";
import { TxSelect } from "@/components/tx27/TxSelect";
import type { Tx80MidiStatus } from "@/lib/tx80/midi";
import type { Tx80Settings } from "@/lib/tx80/storage";

/** Name-only save/rename dialog (themed, focus-trapped, no browser prompts). */
export function Tx80SaveDialog({
  title,
  initialName,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  title: string;
  initialName: string;
  submitLabel: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const valid = name.trim().length > 0;
  return (
    <PatchDialogShell title={title} onCancel={onCancel}>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit(name);
        }}
      >
        <label className="text-[9px] tracking-[0.25em] text-tx-muted" htmlFor="tx80-preset-name">
          PRESET NAME
        </label>
        <input
          id="tx80-preset-name"
          className="tx-lcd-box px-2.5 py-2 text-sm tracking-wider outline-none"
          value={name}
          maxLength={40}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
        />
        <div className="flex gap-1 justify-end pt-1">
          <button
            type="button"
            className="tx-btn px-3"
            style={{ minHeight: 44 }}
            onClick={onCancel}
          >
            CANCEL
          </button>
          <button
            type="submit"
            className="tx-btn px-3 disabled:opacity-40"
            style={{ minHeight: 44 }}
            disabled={!valid}
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </PatchDialogShell>
  );
}

const BEND_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `±${i + 1} ST`,
}));

/** SETUP — global performance settings + guarded Web MIDI control. */
export function Tx80SetupDialog({
  settings,
  onChange,
  midiStatus,
  onEnableMidi,
  onDisableMidi,
  storageOk,
  onClose,
}: {
  settings: Tx80Settings;
  onChange: (partial: Partial<Tx80Settings>) => void;
  midiStatus: Tx80MidiStatus;
  onEnableMidi: () => void;
  onDisableMidi: () => void;
  storageOk: boolean;
  onClose: () => void;
}) {
  const midiLine =
    midiStatus.state === "enabled"
      ? midiStatus.inputs.length > 0
        ? `CONNECTED: ${midiStatus.inputs.join(", ").toUpperCase()}`
        : "ENABLED — NO INPUTS DETECTED"
      : midiStatus.state === "unsupported"
        ? "WEB MIDI NOT SUPPORTED IN THIS BROWSER"
        : midiStatus.state === "denied"
          ? "MIDI ACCESS DENIED — CHECK BROWSER PERMISSIONS"
          : midiStatus.state === "error"
            ? `MIDI ERROR: ${midiStatus.message.toUpperCase()}`
            : "OFF — THE SYNTH WORKS FULLY WITHOUT MIDI";
  return (
    <PatchDialogShell title="SETUP · TX-80" onCancel={onClose} wide>
      <div className="flex items-center gap-2">
        <div
          className="text-[10px] tracking-widest text-tx-muted flex-1"
          title="Global setting — applies to every preset, never saved with patches"
        >
          PITCH BEND RANGE
        </div>
        <TxSelect
          value={settings.bendRangeSemitones}
          options={BEND_OPTIONS}
          onChange={(v) => onChange({ bendRangeSemitones: v })}
          className="min-w-24 text-center"
          ariaLabel="Global pitch bend range in semitones"
        />
      </div>
      <div className="flex items-center gap-2">
        <div className="text-[10px] tracking-widest text-tx-muted flex-1">
          CONFIRM PRESET CHANGE WITH UNSAVED EDITS
        </div>
        <button
          className={`tx-btn ${settings.confirmPresetChange ? "tx-btn-active" : ""}`}
          onClick={() => onChange({ confirmPresetChange: !settings.confirmPresetChange })}
          aria-pressed={settings.confirmPresetChange}
        >
          {settings.confirmPresetChange ? "ON" : "OFF"}
        </button>
      </div>
      <div className="border-t border-black/40 pt-2 flex flex-col gap-1.5">
        <div className="text-[10px] tracking-widest text-tx-muted">WEB MIDI INPUT</div>
        <div className="tx-lcd-box px-2 py-1.5 text-[10px] tracking-wider leading-snug">
          {midiLine}
        </div>
        <div className="flex gap-1 justify-end">
          {midiStatus.state === "enabled" ? (
            <button className="tx-btn px-3" onClick={onDisableMidi}>
              DISABLE MIDI
            </button>
          ) : (
            <button className="tx-btn px-3" onClick={onEnableMidi}>
              ENABLE MIDI
            </button>
          )}
        </div>
      </div>
      {!storageOk && (
        <div className="text-[9px] tracking-widest leading-snug" style={{ color: "var(--tx-red)" }}>
          LOCAL STORAGE IS UNAVAILABLE — USER PRESETS WILL NOT SURVIVE A RELOAD. FACTORY PRESETS AND
          THE FULL INSTRUMENT KEEP WORKING.
        </div>
      )}
      <div className="flex justify-end pt-1">
        <button className="tx-btn px-4" style={{ minHeight: 44 }} onClick={onClose}>
          CLOSE
        </button>
      </div>
    </PatchDialogShell>
  );
}
