# TX-80 Mobile / Responsive QA Matrix

Public preview: https://txpps-tx-80.toppsmusicproductions.workers.dev/

Automated coverage: `tests/e2e/responsive-modes.e2e.ts`  
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

## Automated assertions (per mode/viewport)

1. No horizontal page overflow  
2. Header brand does not overlap mode switcher  
3. Exactly one audio-start control  
4. Autoplay banner absent  
5. PLAY: dock visible, no editor, meaningful dock height  
6. EDIT: no dock by default; SHOW KEYS / HIDE KEYS works  
7. FULL: editor + dock  
8. Preset browser opens; 18 factory rows; select + Escape  
9. Orientation change preserves mode + patch  
10. Settings / diagnostic terminal selectable  
11. No Lovable branding  
12. Screenshots written under `qa/responsive-screenshots/`

## Physical phone checklist (still required)

- [ ] iPhone Safari portrait PLAY — keys + ribbon + sustain reachable without scrolling editors  
- [ ] iPhone Safari landscape PLAY — no vertical scroll while playing; safe areas clear  
- [ ] iPhone EDIT — SHOW KEYS audition; panels via section nav  
- [ ] Android Chrome portrait + landscape same checks  
- [ ] Audio START / READY / background suspend + RESUME  
- [ ] Hard refresh after deploy (see below)  
- [ ] Custom TXPPS favicon + title  
- [ ] Human listening across factory patches  

## Hard refresh / cache

After deploy:

1. Close all tabs for the preview origin.  
2. iOS Safari: Settings → Safari → Clear History and Website Data (or remove the site data for the workers.dev host), then reopen.  
3. Or open a private tab to the preview URL.  
4. Confirm SETTINGS → DIAGNOSTICS build commit matches `main` HEAD.  

## Known limitations

- Physical-device validation is not claimed by automation alone.  
- Ribbon **trigger** and MIDI remain deferred.  
- Some layer registry params remain unmapped (Gate 6).  
- Full-repo lint still reports historical CRLF prettier noise.
