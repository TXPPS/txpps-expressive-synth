// Regenerates PARAMETER_MATRIX.md from the authoritative TX-80 registry.
// Run with: bun scripts/generate-parameter-matrix.mjs
import { TX80_PARAMETER_DEFINITIONS } from "../src/lib/tx80/parameters.ts";
import { writeFileSync } from "node:fs";

const DEST = {
  "Layer I": "Per-voice Layer I sub-voice nodes (osc/filter/env gains) + layer bus",
  "Layer II": "Per-voice Layer II sub-voice nodes (osc/filter/env gains) + layer bus",
  Voice: "Voice allocator (poly/solo policy, count, velocity mapping)",
  Performance: "Note-on pitch scheduling (porta/gliss) · ribbonSource ConstantSource",
  "LFO A": "LFO A oscillator + depth gain → selected destination bus",
  "LFO B": "LFO B oscillator + depth gain → selected destination bus",
  Chorus: "Chorus wet/dry gains, tap LFO rate/depth",
  Delay: "DelayNode.delayTime, feedback gain (≤0.85), wet/dry gains",
  Reverb: "Convolver wet/dry, pre-delay; size/decay/damping/width bake the cached IR",
  Master: "masterGain / layer balance crossfade gains",
};

const UI = {
  "Layer I": "LayerPanel (index 0) via ParamKnob / wave buttons / ON-MUTED toggle",
  "Layer II": "LayerPanel (index 1) via ParamKnob / wave buttons / ON-MUTED toggle",
  Voice: "PERF panel buttons + ParamKnob",
  Performance: "PERF panel buttons, ParamKnob, TxSelect",
  "LFO A": "MOD panel wave buttons, ParamKnob, TxSelect",
  "LFO B": "MOD panel wave buttons, ParamKnob, TxSelect",
  Chorus: "FX panel ON/OFF + ParamKnob",
  Delay: "FX panel ON/OFF + ParamKnob",
  Reverb: "FX panel ON/OFF, type buttons + ParamKnob",
  Master: "OUT panel ParamKnob",
};

const rows = TX80_PARAMETER_DEFINITIONS.map((d) => {
  const range = d.choices
    ? d.choices.join(" / ")
    : typeof d.defaultValue === "boolean"
      ? "true / false"
      : `${d.minimum} … ${d.maximum}${d.step && d.step !== 0.001 ? ` (step ${d.step})` : ""}`;
  return `| \`${d.id}\` | ${UI[d.category] ?? d.category} | \`${d.path}\` | ${JSON.stringify(d.defaultValue)} | ${range} | ${d.unit ?? "—"} | ${d.smoothing} | ${d.serialized ? "yes" : "no"} | ${DEST[d.category] ?? "—"} |`;
});

const doc = `# TX-80 Parameter Matrix

Generated from \`src/lib/tx80/parameters.ts\` by \`scripts/generate-parameter-matrix.mjs\`
— regenerate after any registry change; do not edit the table by hand.

Every row is one authoritative parameter definition. The UI binds through
\`ParamKnob\`/buttons/\`TxSelect\` → \`setParameter(id, value)\` →
\`setTx80Parameter\` (coerce + clamp) → React patch state **and**
\`TX80ProductEngine.setParameter\` → \`TX80Engine.setPatch\` (section-diffed
application). Presets serialize the full \`Tx80Patch\`; transient performance
state (held notes, pointer state, pitch-bend position, ribbon position) is
never serialized.

**Verification status:** every parameter's UI→state→serialize→restore path is
covered by unit tests (registry round-trip + factory-preset round-trip) and
the browser e2e layer covers representative members of every engine section
(see \`tests/e2e/tx80-engine.e2e.ts\`). Audible/perceptual verification of each
individual parameter remains on the human listening list in MANUAL_QA.md.

| Parameter ID | UI component | State path | Default | Range / choices | Unit | Smoothing | Preset | Engine destination |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows.join("\n")}

**Not in the patch registry (deliberately):** global pitch-bend range and
confirm-preset-change live in \`tx80-settings\` (localStorage); UI mode in
\`tx80-ui-mode\`; last preset id in \`tx80-last-preset\`. Pitch bend, mod
wheel, sustain, ribbon position and held notes are live performance state.
`;

writeFileSync(new URL("../PARAMETER_MATRIX.md", import.meta.url), doc);
console.log(`wrote PARAMETER_MATRIX.md with ${rows.length} parameters`);
