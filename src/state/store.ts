import { create } from "zustand";
import { PARAM_BY_ID, defaultPatch, type PatchValues } from "./params";

export type UiMode = "full" | "edit" | "play";
export type AudioStatus = "idle" | "starting" | "running" | "suspended" | "failed";

export interface PresetMeta {
  id: string;
  name: string;
  category: string;
  source: "factory" | "user";
}

interface Store {
  // Patch (all synth params)
  patch: PatchValues;
  setParam: (id: string, value: number | string | boolean) => void;
  loadPatch: (values: PatchValues) => void;

  // UI
  uiMode: UiMode;
  setUiMode: (m: UiMode) => void;
  activeLayerTab: "layerI" | "layerII" | "mod" | "fx" | "master";
  setActiveLayerTab: (t: Store["activeLayerTab"]) => void;

  // Audio lifecycle (real wiring in Milestone 2)
  audioStatus: AudioStatus;
  setAudioStatus: (s: AudioStatus) => void;

  // Preset
  currentPreset: PresetMeta | null;
  setCurrentPreset: (p: PresetMeta | null) => void;

  // Perf transient
  pitchBend: number; // -1..1
  modWheel: number; // 0..1
  sustainPedal: boolean;
  setPitchBend: (v: number) => void;
  setModWheel: (v: number) => void;
  setSustainPedal: (v: boolean) => void;

  // Panic
  panicToken: number;
  panic: () => void;
}

export const useSynthStore = create<Store>((set) => ({
  patch: defaultPatch(),
  setParam: (id, value) =>
    set((s) => {
      const def = PARAM_BY_ID.get(id);
      if (!def) {
        if (import.meta.env.DEV) console.warn("Unknown param", id);
        return s;
      }
      // Gate 2: trigger ribbon mode is not live — coerce to continuous.
      let next = value;
      if (id === "ribbon.mode" && value === "trigger") next = "continuous";
      return { patch: { ...s.patch, [id]: next } };
    }),
  loadPatch: (values) =>
    set(() => {
      const merged = { ...defaultPatch(), ...values };
      if (merged["ribbon.mode"] === "trigger") merged["ribbon.mode"] = "continuous";
      return { patch: merged };
    }),

  uiMode: "full",
  setUiMode: (m) => set({ uiMode: m }),
  activeLayerTab: "layerI",
  setActiveLayerTab: (t) => set({ activeLayerTab: t }),

  audioStatus: "idle",
  setAudioStatus: (s) => set({ audioStatus: s }),

  currentPreset: null,
  setCurrentPreset: (p) => set({ currentPreset: p }),

  pitchBend: 0,
  modWheel: 0,
  sustainPedal: false,
  setPitchBend: (v) => set({ pitchBend: Math.max(-1, Math.min(1, v)) }),
  setModWheel: (v) => set({ modWheel: Math.max(0, Math.min(1, v)) }),
  setSustainPedal: (v) => set({ sustainPedal: v }),

  panicToken: 0,
  panic: () => set((s) => ({ panicToken: s.panicToken + 1, sustainPedal: false })),
}));
