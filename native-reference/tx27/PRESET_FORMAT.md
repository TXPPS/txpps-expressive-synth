# Preset Format

**Status:** Verified; schema version 1.

Single preset:

```text
{ schemaVersion, product, metadata, patch }
```

Library:

```text
{ schemaVersion, product, exportedAt, presets: [{ metadata, patch }] }
```

- Product tag: `TXPPS TX27`
- Extensions: `.tx27preset.json`, `.tx27library.json`
- Parser: `src/lib/patch-library/importExport.ts`
- Sanitizer/migration: `src/lib/patch-library/migration.ts`
- Storage: `tx27.userLibrary.v2` payload with `schemaVersion: 1`
- Stable metadata IDs are not derived from renameable preset names.
- `glideMode` is now explicitly sanitized and round-trip tested.
- Patch field names remain compatible; stable parameter IDs are aliases/mappings, not a silent persisted-file rename.
