# TX-80 Patch Browser Behavior

Two-level workflow (TX27-style), one shared catalog / selection path.

## Level 1 — Quick list

- Open: tap current patch name (`data-tx80-preset-open`)
- UI: anchored popover (desktop/tablet) or compact bottom sheet (phone portrait)
- Sections: RECENT / FAVORITES / NEARBY
- Select → load immediately → close
- Escape / outside pointer → close
- Footer: **OPEN PATCH LIBRARY** → Level 2

## Level 2 — Full library

- Open: **LIBRARY** / **LIB** strip button, or quick-list footer
- Search + wrapable category chips (ALL / KEYS / PADS / LEADS / BASS / EXP / FAVORITES / USER)
- USER chip must not clip
- Save / Restore Factory / favorites
- All 18 factory patches remain
- Escape / CLOSE / backdrop → close; body scroll locked while open

## Strip

Prev / name (+ count) / LIBRARY / SAVE / favorite / Next.
Does not reset audio or recreate the engine.
