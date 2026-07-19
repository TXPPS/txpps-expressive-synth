# TX-80 Mobile / Responsive QA Matrix

Public preview: https://txpps-tx-80.toppsmusicproductions.workers.dev/

Automated coverage:

- `tests/e2e/responsive-modes.e2e.ts` (Chromium matrix)
- `tests/e2e/fixed-header.e2e.ts` (**mobile WebKit** project + Chromium)
- `tests/e2e/voice-stress.e2e.ts`
- `tests/e2e/gate2-runtime.e2e.ts`

Screenshots (gitignored): `qa/responsive-screenshots/`

## Viewport matrix

| Viewport | Size | Modes tested |
|----------|------|--------------|
| iPhone SE portrait | 375×667 | FULL, EDIT, PLAY |
| Large iPhone portrait | 430×932 | FULL, EDIT, PLAY |
| iPhone landscape | 844×390 | FULL, EDIT, PLAY |
| Small Android portrait | 360×740 | FULL, EDIT, PLAY |
| Small Android landscape | 740×360 | FULL, EDIT, PLAY |
| iPad portrait | 768×1024 | FULL, EDIT, PLAY |
| iPad landscape | 1024×768 | FULL, EDIT, PLAY |
| Desktop | 1366×768 | FULL, EDIT, PLAY |
| Wide desktop | 1920×1080 | FULL, EDIT, PLAY |

## Automated assertions

1. No horizontal page overflow  
2. Header brand does not overlap mode switcher  
3. **Fixed** app header (`position: fixed`) — stays at viewport top after deep scroll (WebKit suite)  
4. Main content padded by `--tx80-header-height`; first section below header  
5. Exactly one audio-start control; one header instance across orientation  
6. Autoplay banner absent  
7. PLAY: tall Pitch/Mod (large phone ≥160–200px); portrait keys ≥160px  
8. PLAY: lower dock regions share aligned tops; Sustain ≥44×44 and grows  
9. PLAY phone: no build footer  
10. EDIT: no dock by default; SHOW KEYS / HIDE KEYS works  
11. FULL: editor + dock  
12. Quick patch list + full library  
13. Orientation preserves mode + patch  
14. Voice stress: 500 events / 5 seeds  
15. Screenshots under `qa/responsive-screenshots/`

## Physical phone checklist (still required)

- [ ] iPhone Safari — **app toolbar stays put** while scrolling FULL/EDIT (Safari URL bar may move)  
- [ ] iPhone Safari portrait PLAY — Pitch/Mod/Sustain fill dock height with keyboard  
- [ ] iPhone Safari landscape PLAY — no layout regression  
- [ ] Android Chrome portrait + landscape same checks  
- [ ] Audio START / READY / background suspend + RESUME  
- [ ] Hard refresh after deploy  
- [ ] SETTINGS → ABOUT shows layout tier line  
- [ ] Human listening across factory patches  

## Hard refresh / cache

After deploy:

1. Close all tabs for the preview origin.  
2. iOS Safari: Settings → Safari → Clear History and Website Data (or remove site data for the workers.dev host), then reopen.  
3. Or open a private tab to the preview URL.  
4. Confirm SETTINGS → DIAGNOSTICS / ABOUT build commit matches `main` HEAD.  

## Known limitations

- Emulation alone is **not** sufficient proof for sticky/fixed header behavior.  
- Physical-device validation remains mandatory after every mobile layout deploy.  
- Ribbon **trigger** and MIDI remain deferred.  
- Full-repo lint still reports historical CRLF prettier noise.
