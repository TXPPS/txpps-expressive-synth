import { create } from "zustand";
import { PARAM_BY_ID, defaultPatch, type PatchValues } from "./params";
import { loadPersistedUiMode, persistUiMode } from "@/lib/uiModePersistence";

export type UiMode = "full" | "edit" | "play";
export type AudioStatus = "idle" | "starting" | "running" | "suspended" | "failed";
export type EditorSection = "layerI" | "layerII" | "mod" | "fx" | "master";

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
  activeLayerTab: EditorSection;
  setActiveLayerTab: (t: EditorSection) => void;
  /** EDIT mode: collapsible audition keyboard (does not reset patch/audio). */
  editKeysVisible: boolean;
  setEditKeysVisible: (v: boolean) => void;

  // Audio lifecycle
  audioStatus: AudioStatus;
  setAudioStatus: (s: AudioStatus) => void;

  // Preset
  currentPreset: PresetMeta | null;
  setCurrentPreset: (p: PresetMeta | null) => void;
  /** Level 1 — compact quick patch list */
  presetQuickOpen: boolean;
  setPresetQuickOpen: (v: boolean) => void;
  /** Level 2 — full patch library */
  presetBrowserOpen: boolean;
  setPresetBrowserOpen: (v: boolean) => void;

  // Perf transient
  pitchBend: number; // -1..1
  modWheel: number; // 0..1
  sustainPedal: boolean;
  keyboardOctave: number;
  setPitchBend: (v: number) => void;
  setModWheel: (v: number) => void;
  setSustainPedal: (v: boolean) => void;
  setKeyboardOctave: (v: number) => void;

  // Panic
  panicToken: number;
  panic: () => void;
}

const initialUiMode = (typeof window !== "undefined" && loadPersistedUiMode()) || "full";

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

  uiMode: initialUiMode,
  setUiMode: (m) => {
    persistUiMode(m);
    set({ uiMode: m });
  },
  activeLayerTab: "layerI",
  setActiveLayerTab: (t) => set({ activeLayerTab: t }),
  editKeysVisible: false,
  setEditKeysVisible: (v) => set({ editKeysVisible: v }),

  audioStatus: "idle",
  setAudioStatus: (s) => set({ audioStatus: s }),

  currentPreset: null,
  setCurrentPreset: (p) => set({ currentPreset: p }),
  presetQuickOpen: false,
  setPresetQuickOpen: (v) => set({ presetQuickOpen: v }),
  presetBrowserOpen: false,
  setPresetBrowserOpen: (v) =>
    set({
      presetBrowserOpen: v,
      ...(v ? { presetQuickOpen: false } : {}),
    }),

  pitchBend: 0,
  modWheel: 0,
  sustainPedal: false,
  keyboardOctave: 4,
  setPitchBend: (v) => set({ pitchBend: Math.max(-1, Math.min(1, v)) }),
  setModWheel: (v) => set({ modWheel: Math.max(0, Math.min(1, v)) }),
  setSustainPedal: (v) => set({ sustainPedal: v }),
  setKeyboardOctave: (v) => set({ keyboardOctave: Math.max(0, Math.min(8, Math.round(v))) }),

  panicToken: 0,
  panic: () => set((s) => ({ panicToken: s.panicToken + 1, sustainPedal: false })),
}));
