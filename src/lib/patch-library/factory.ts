import { FACTORY_PRESETS } from "../presets";
import {
  FACTORY_AUTHOR,
  FACTORY_PACK,
  PRODUCT,
  type LibraryEntry,
  type PresetCategory,
  type PresetMetadata,
} from "./types";

/**
 * Factory preset metadata. IDs are hand-written, permanent identifiers —
 * they must NEVER change across releases (favorites and recent lists persist
 * them on user devices). New factory presets get new IDs appended here.
 * Patch DSP data itself stays in src/lib/presets.ts (single source of truth);
 * entries reference those objects directly and every load path clones.
 */
interface FactoryMetaDef {
  id: string;
  category: PresetCategory;
  tags: string[];
  description: string;
}

const FACTORY_META: Record<string, FactoryMetaDef> = {
  "TX Electric": {
    id: "tx27-factory-tx-electric",
    category: "KEYS",
    tags: ["FM", "Electric Piano", "Digital", "Clean", "Expressive"],
    description: "Classic late-80s FM electric piano with chorus shimmer.",
  },
  "Glass Roads": {
    id: "tx27-factory-glass-roads",
    category: "TEXTURE",
    tags: ["FM", "Glass", "Digital", "Ambient", "Evolving", "Wide"],
    description: "Glassy evolving texture with a long crystalline reverb tail.",
  },
  "Soft Tines": {
    id: "tx27-factory-soft-tines",
    category: "KEYS",
    tags: ["FM", "Electric Piano", "Soft", "Warm", "Clean"],
    description: "Gentle tine piano with a soft chorus halo.",
  },
  "Neon Bell": {
    id: "tx27-factory-neon-bell",
    category: "BELL",
    tags: ["FM", "Bell", "Bright", "Metallic", "Digital", "Long"],
    description: "Bright inharmonic bell that blooms into glass reverb.",
  },
  "Chrome Bass": {
    id: "tx27-factory-chrome-bass",
    category: "BASS",
    tags: ["FM", "Mono", "Aggressive", "Metallic", "Short"],
    description: "Punchy mono FM bass with filtered chrome bite and glide.",
  },
  "Hollow Fifth": {
    id: "tx27-factory-hollow-fifth",
    category: "LEAD",
    tags: ["FM", "Digital", "Wide", "Retro"],
    description: "Stacked-fifth lead with a hollow digital core.",
  },
  "Digital Choir": {
    id: "tx27-factory-digital-choir",
    category: "CHOIR",
    tags: ["FM", "Digital", "Soft", "Wide", "Evolving", "Long"],
    description: "Detuned FM voices swelling into a wide hall wash.",
  },
  "Night Mallet": {
    id: "tx27-factory-night-mallet",
    category: "MALLET",
    tags: ["FM", "Percussive", "Digital", "Short", "Clean"],
    description: "Late-night mallet keys echoed by a tempo delay.",
  },
  "Frozen Pad": {
    id: "tx27-factory-frozen-pad",
    category: "PAD",
    tags: ["FM", "Ambient", "Evolving", "Wide", "Soft", "Long"],
    description: "Slow icy pad drifting through glass reverb.",
  },
  "Wire Pluck": {
    id: "tx27-factory-wire-pluck",
    category: "PLUCK",
    tags: ["FM", "Percussive", "Metallic", "Digital", "Short"],
    description: "Snappy wire pluck feeding a regenerative delay.",
  },
  "Data Organ": {
    id: "tx27-factory-data-organ",
    category: "ORGAN",
    tags: ["FM", "Digital", "Clean", "Retro"],
    description: "Additive-style FM organ with a fast rotary-like chorus.",
  },
  "Broken Terminal": {
    id: "tx27-factory-broken-terminal",
    category: "FX",
    tags: ["FM", "Lo-Fi", "Experimental", "Aggressive", "Vintage", "Dark"],
    description: "Damaged terminal noise machine, deep in the vintage circuit.",
  },
  "Vintage EP": {
    id: "tx27-factory-vintage-ep",
    category: "KEYS",
    tags: ["FM", "Electric Piano", "Warm", "Vintage", "Expressive"],
    description: "Aged tine EP played through worn vintage circuitry.",
  },
  "Aged Brass": {
    id: "tx27-factory-aged-brass",
    category: "BRASS",
    tags: ["FM", "Vintage", "Warm", "Retro"],
    description: "Worn FM brass section with drive and dust.",
  },
  "1987 Memory": {
    id: "tx27-factory-1987-memory",
    category: "PAD",
    tags: ["FM", "Vintage", "Ambient", "Evolving", "Warm", "Long"],
    description: "A faded pad memory from 1987 — aged, echoing, half-remembered.",
  },
};

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Read-only factory library: existing factory patches wrapped in metadata.
 *  Factory entries cannot be renamed or deleted; they can be favorited,
 *  duplicated into USER, and exported. */
export const FACTORY_LIBRARY: LibraryEntry[] = FACTORY_PRESETS.map((patch) => {
  const def = FACTORY_META[patch.name];
  if (!def && typeof console !== "undefined") {
    console.warn(`TX27 factory preset "${patch.name}" is missing library metadata.`);
  }
  const meta: PresetMetadata = {
    id: def?.id ?? `tx27-factory-${slug(patch.name)}`,
    name: patch.name,
    product: PRODUCT,
    author: FACTORY_AUTHOR,
    pack: FACTORY_PACK,
    category: def?.category ?? "UNCATEGORIZED",
    tags: def?.tags ?? [],
    description: def?.description ?? "",
    version: 1,
    source: "factory",
  };
  return { meta, patch };
});

export const FACTORY_IDS = new Set(FACTORY_LIBRARY.map((e) => e.meta.id));
