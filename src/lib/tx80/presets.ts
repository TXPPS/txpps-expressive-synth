import { cloneTx80Patch, TX80_INIT_PATCH, type Tx80Layer, type Tx80Patch } from "./types";

/** TX-80 factory presets — all original TXPPS sound design. IDs are
 *  permanent (favorites/selection persist them on user devices). */

type LayerOverride = Partial<Omit<Tx80Layer, "filter" | "filterEnv" | "ampEnv">> & {
  filter?: Partial<Tx80Layer["filter"]>;
  filterEnv?: Partial<Tx80Layer["filterEnv"]>;
  ampEnv?: Partial<Tx80Layer["ampEnv"]>;
};

type PatchOverride = Partial<Omit<Tx80Patch, "layers" | "name">> & {
  layers?: [LayerOverride, LayerOverride];
};

function mkLayer(base: Tx80Layer, o: LayerOverride | undefined): Tx80Layer {
  if (!o) return base;
  return {
    ...base,
    ...o,
    filter: { ...base.filter, ...(o.filter ?? {}) },
    filterEnv: { ...base.filterEnv, ...(o.filterEnv ?? {}) },
    ampEnv: { ...base.ampEnv, ...(o.ampEnv ?? {}) },
  };
}

function mk(name: string, overrides: PatchOverride): Tx80Patch {
  const base = cloneTx80Patch(TX80_INIT_PATCH);
  const { layers, ...rest } = overrides;
  const next: Tx80Patch = {
    ...base,
    ...rest,
    name,
    layers: [mkLayer(base.layers[0], layers?.[0]), mkLayer(base.layers[1], layers?.[1])],
    pitchTravel: { ...base.pitchTravel, ...(overrides.pitchTravel ?? {}) },
    ribbon: { ...base.ribbon, ...(overrides.ribbon ?? {}) },
    lfoA: { ...base.lfoA, ...(overrides.lfoA ?? {}) },
    lfoB: { ...base.lfoB, ...(overrides.lfoB ?? {}) },
    chorus: { ...base.chorus, ...(overrides.chorus ?? {}) },
    delay: { ...base.delay, ...(overrides.delay ?? {}) },
    reverb: { ...base.reverb, ...(overrides.reverb ?? {}) },
    master: { ...base.master, ...(overrides.master ?? {}) },
  };
  return cloneTx80Patch(next);
}

export interface Tx80FactoryEntry {
  /** Permanent stable ID — never rename. */
  id: string;
  patch: Tx80Patch;
}

export const TX80_FACTORY_PRESETS: readonly Tx80FactoryEntry[] = [
  {
    id: "tx80-factory-dual-strings",
    patch: mk("Dual Strings", {
      layers: [
        {
          wave: "saw",
          oscLevel: 0.75,
          level: 0.75,
          pan: -0.25,
          fine: -5,
          filter: { cutoff: 5200, resonance: 0.12, envAmount: 0.15, keyTracking: 0.6 },
          filterEnv: { attack: 0.5, decay: 1.2, sustain: 0.7, release: 1.1 },
          ampEnv: { attack: 0.45, decay: 0.8, sustain: 0.85, release: 1.4 },
        },
        {
          enabled: true,
          wave: "saw",
          oscLevel: 0.7,
          level: 0.7,
          pan: 0.25,
          fine: 7,
          filter: { cutoff: 4200, resonance: 0.1, envAmount: 0.1, keyTracking: 0.6 },
          filterEnv: { attack: 0.7, decay: 1.4, sustain: 0.65, release: 1.2 },
          ampEnv: { attack: 0.6, decay: 0.8, sustain: 0.85, release: 1.6 },
        },
      ],
      lfoB: { wave: "sine", rate: 0.25, depth: 0.18, destination: "filter" },
      chorus: { enabled: true, amount: 0.45, rate: 0.5, depth: 0.004 },
      reverb: {
        enabled: true,
        type: "hall",
        mix: 0.32,
        size: 0.75,
        decay: 0.65,
        preDelay: 0.03,
        damping: 0.45,
        width: 1,
      },
    }),
  },
  {
    id: "tx80-factory-velvet-brass",
    patch: mk("Velvet Brass", {
      layers: [
        {
          wave: "saw",
          oscLevel: 0.85,
          level: 0.8,
          filter: { cutoff: 2600, resonance: 0.22, envAmount: 0.55, keyTracking: 0.55 },
          filterEnv: { attack: 0.09, decay: 0.5, sustain: 0.55, release: 0.35 },
          ampEnv: { attack: 0.06, decay: 0.4, sustain: 0.8, release: 0.35 },
        },
        {
          enabled: true,
          wave: "saw",
          oscLevel: 0.7,
          level: 0.6,
          coarse: 0,
          fine: -8,
          octave: 0,
          filter: { cutoff: 2100, resonance: 0.18, envAmount: 0.5, keyTracking: 0.55 },
          filterEnv: { attack: 0.12, decay: 0.6, sustain: 0.5, release: 0.35 },
          ampEnv: { attack: 0.09, decay: 0.4, sustain: 0.8, release: 0.4 },
        },
      ],
      lfoA: { wave: "sine", rate: 5.4, depth: 0.1, destination: "pitch" },
      reverb: {
        enabled: true,
        type: "hall",
        mix: 0.24,
        size: 0.55,
        decay: 0.5,
        preDelay: 0.02,
        damping: 0.55,
        width: 0.9,
      },
    }),
  },
  {
    id: "tx80-factory-glass-pad",
    patch: mk("Glass Pad", {
      layers: [
        {
          wave: "triangle",
          oscLevel: 0.8,
          subLevel: 0.15,
          level: 0.75,
          pan: -0.2,
          filter: { cutoff: 7000, resonance: 0.1, envAmount: 0.2, keyTracking: 0.7 },
          filterEnv: { attack: 1.2, decay: 2, sustain: 0.7, release: 2 },
          ampEnv: { attack: 1.1, decay: 1, sustain: 0.85, release: 2.4 },
        },
        {
          enabled: true,
          wave: "pulse",
          pulseWidth: 0.22,
          oscLevel: 0.55,
          level: 0.6,
          pan: 0.2,
          octave: 1,
          fine: 4,
          filter: { cutoff: 5200, resonance: 0.15, envAmount: 0.15, keyTracking: 0.7 },
          filterEnv: { attack: 1.6, decay: 2, sustain: 0.6, release: 2 },
          ampEnv: { attack: 1.4, decay: 1, sustain: 0.8, release: 2.6 },
        },
      ],
      lfoB: { wave: "triangle", rate: 0.3, depth: 0.25, destination: "pw" },
      chorus: { enabled: true, amount: 0.5, rate: 0.35, depth: 0.005 },
      reverb: {
        enabled: true,
        type: "glass",
        mix: 0.42,
        size: 0.85,
        decay: 0.75,
        preDelay: 0.04,
        damping: 0.3,
        width: 1,
      },
    }),
  },
  {
    id: "tx80-factory-twin-bass",
    patch: mk("Twin Bass", {
      voiceMode: "solo",
      pitchTravel: { mode: "porta", time: 0.09 },
      layers: [
        {
          wave: "saw",
          oscLevel: 0.9,
          subLevel: 0.5,
          level: 0.85,
          octave: -1,
          filter: { cutoff: 900, resonance: 0.35, envAmount: 0.6, keyTracking: 0.3 },
          filterEnv: { attack: 0.003, decay: 0.35, sustain: 0.25, release: 0.2 },
          ampEnv: { attack: 0.003, decay: 0.3, sustain: 0.75, release: 0.16 },
        },
        {
          enabled: true,
          wave: "pulse",
          pulseWidth: 0.3,
          oscLevel: 0.6,
          level: 0.55,
          octave: -1,
          fine: 9,
          filter: { cutoff: 1400, resonance: 0.25, envAmount: 0.45, keyTracking: 0.3 },
          filterEnv: { attack: 0.003, decay: 0.28, sustain: 0.2, release: 0.2 },
          ampEnv: { attack: 0.003, decay: 0.3, sustain: 0.7, release: 0.16 },
        },
      ],
      reverb: {
        enabled: true,
        type: "digital",
        mix: 0.1,
        size: 0.3,
        decay: 0.25,
        preDelay: 0.005,
        damping: 0.6,
        width: 0.6,
      },
    }),
  },
  {
    id: "tx80-factory-ribbon-lead",
    patch: mk("Ribbon Lead", {
      voiceMode: "solo",
      pitchTravel: { mode: "porta", time: 0.14 },
      ribbon: { mode: "pitch", range: 12 },
      layers: [
        {
          wave: "pulse",
          pulseWidth: 0.35,
          oscLevel: 0.9,
          level: 0.85,
          filter: { cutoff: 3800, resonance: 0.3, envAmount: 0.4, keyTracking: 0.6 },
          filterEnv: { attack: 0.01, decay: 0.5, sustain: 0.6, release: 0.3 },
          ampEnv: { attack: 0.005, decay: 0.3, sustain: 0.85, release: 0.25 },
        },
        {
          enabled: true,
          wave: "saw",
          oscLevel: 0.6,
          level: 0.5,
          fine: -10,
          filter: { cutoff: 3000, resonance: 0.2, envAmount: 0.35, keyTracking: 0.6 },
          filterEnv: { attack: 0.01, decay: 0.5, sustain: 0.55, release: 0.3 },
          ampEnv: { attack: 0.005, decay: 0.3, sustain: 0.85, release: 0.25 },
        },
      ],
      lfoA: { wave: "sine", rate: 5.8, depth: 0.12, destination: "pitch" },
      delay: { enabled: true, time: 0.3, feedback: 0.3, mix: 0.22 },
    }),
  },
  {
    id: "tx80-factory-stepped-sky",
    patch: mk("Stepped Sky", {
      pitchTravel: { mode: "gliss", time: 0.3 },
      ribbon: { mode: "gliss", range: 12 },
      layers: [
        {
          wave: "pulse",
          pulseWidth: 0.42,
          oscLevel: 0.75,
          level: 0.75,
          filter: { cutoff: 4600, resonance: 0.2, envAmount: 0.3, keyTracking: 0.6 },
          filterEnv: { attack: 0.05, decay: 0.7, sustain: 0.5, release: 0.6 },
          ampEnv: { attack: 0.03, decay: 0.5, sustain: 0.8, release: 0.7 },
        },
        {
          enabled: true,
          wave: "triangle",
          oscLevel: 0.65,
          level: 0.6,
          octave: 1,
          filter: { cutoff: 6800, resonance: 0.1, envAmount: 0.2, keyTracking: 0.7 },
          filterEnv: { attack: 0.08, decay: 0.8, sustain: 0.5, release: 0.6 },
          ampEnv: { attack: 0.05, decay: 0.5, sustain: 0.8, release: 0.8 },
        },
      ],
      delay: { enabled: true, time: 0.42, feedback: 0.42, mix: 0.3 },
      reverb: {
        enabled: true,
        type: "glass",
        mix: 0.3,
        size: 0.7,
        decay: 0.6,
        preDelay: 0.03,
        damping: 0.35,
        width: 1,
      },
    }),
  },
  {
    id: "tx80-factory-hollow-organ",
    patch: mk("Hollow Organ", {
      layers: [
        {
          wave: "sine",
          oscLevel: 0.85,
          subLevel: 0.6,
          level: 0.8,
          filter: { cutoff: 9000, resonance: 0.05, envAmount: 0, keyTracking: 0.8 },
          filterEnv: { attack: 0.005, decay: 0.2, sustain: 1, release: 0.2 },
          ampEnv: { attack: 0.004, decay: 0.1, sustain: 1, release: 0.12 },
        },
        {
          enabled: true,
          wave: "triangle",
          oscLevel: 0.6,
          level: 0.55,
          octave: 1,
          coarse: 7,
          filter: { cutoff: 10000, resonance: 0.05, envAmount: 0, keyTracking: 0.8 },
          filterEnv: { attack: 0.005, decay: 0.2, sustain: 1, release: 0.2 },
          ampEnv: { attack: 0.004, decay: 0.1, sustain: 1, release: 0.12 },
        },
      ],
      lfoA: { wave: "sine", rate: 6.2, depth: 0.06, destination: "pitch" },
      chorus: { enabled: true, amount: 0.35, rate: 0.8, depth: 0.003 },
      reverb: {
        enabled: true,
        type: "hall",
        mix: 0.2,
        size: 0.5,
        decay: 0.45,
        preDelay: 0.015,
        damping: 0.5,
        width: 0.85,
      },
    }),
  },
  {
    id: "tx80-factory-drift-choir",
    patch: mk("Drift Choir", {
      layers: [
        {
          wave: "pulse",
          pulseWidth: 0.18,
          oscLevel: 0.7,
          noiseLevel: 0.04,
          level: 0.75,
          pan: -0.3,
          filter: { cutoff: 2400, resonance: 0.3, envAmount: 0.25, keyTracking: 0.65 },
          filterEnv: { attack: 0.9, decay: 1.5, sustain: 0.65, release: 1.6 },
          ampEnv: { attack: 0.8, decay: 0.8, sustain: 0.85, release: 1.8 },
        },
        {
          enabled: true,
          wave: "pulse",
          pulseWidth: 0.26,
          oscLevel: 0.7,
          level: 0.7,
          pan: 0.3,
          fine: 11,
          filter: { cutoff: 2000, resonance: 0.28, envAmount: 0.2, keyTracking: 0.65 },
          filterEnv: { attack: 1.1, decay: 1.6, sustain: 0.6, release: 1.7 },
          ampEnv: { attack: 1, decay: 0.8, sustain: 0.85, release: 2 },
        },
      ],
      lfoA: { wave: "triangle", rate: 4.6, depth: 0.07, destination: "pitch" },
      lfoB: { wave: "sine", rate: 0.18, depth: 0.5, destination: "pw" },
      chorus: { enabled: true, amount: 0.55, rate: 0.4, depth: 0.005 },
      reverb: {
        enabled: true,
        type: "hall",
        mix: 0.4,
        size: 0.85,
        decay: 0.7,
        preDelay: 0.04,
        damping: 0.5,
        width: 1,
      },
    }),
  },
  {
    id: "tx80-factory-pan-weaver",
    patch: mk("Pan Weaver", {
      layers: [
        {
          wave: "triangle",
          oscLevel: 0.8,
          level: 0.75,
          filter: { cutoff: 5600, resonance: 0.2, envAmount: 0.3, keyTracking: 0.6 },
          filterEnv: { attack: 0.02, decay: 0.9, sustain: 0.3, release: 0.7 },
          ampEnv: { attack: 0.01, decay: 0.7, sustain: 0.5, release: 0.9 },
        },
        {
          enabled: true,
          wave: "sine",
          oscLevel: 0.7,
          level: 0.6,
          octave: 1,
          fine: -6,
          filter: { cutoff: 8000, resonance: 0.1, envAmount: 0.2, keyTracking: 0.7 },
          filterEnv: { attack: 0.03, decay: 1.1, sustain: 0.25, release: 0.8 },
          ampEnv: { attack: 0.02, decay: 0.9, sustain: 0.45, release: 1.1 },
        },
      ],
      lfoA: { wave: "sine", rate: 0.7, depth: 0.6, destination: "pan" },
      lfoB: { wave: "triangle", rate: 0.22, depth: 0.35, destination: "balance" },
      delay: { enabled: true, time: 0.36, feedback: 0.38, mix: 0.28 },
      reverb: {
        enabled: true,
        type: "glass",
        mix: 0.3,
        size: 0.7,
        decay: 0.6,
        preDelay: 0.03,
        damping: 0.35,
        width: 1,
      },
    }),
  },
  {
    id: "tx80-factory-init",
    patch: mk("Init Layered", {
      layers: [{}, { enabled: true }],
    }),
  },
];

/** Safe default preset — the first factory entry. */
export const TX80_DEFAULT_PRESET = TX80_FACTORY_PRESETS[0];
