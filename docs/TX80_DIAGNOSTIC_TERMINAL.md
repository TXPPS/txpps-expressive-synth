# TX-80 Diagnostic Terminal

Local, in-memory runtime console for Gate 2 debugging.

## Architecture

- `src/lib/diagnostics/buffer.ts` — bounded event ring (`DIAG_BUFFER_CAPACITY = 256`)
- `src/lib/diagnostics/runtime.ts` — live session snapshot + browser error mirrors
- `src/lib/diagnostics/buildInfo.ts` — Vite-injected commit/branch/time/version
- `src/components/synth/DiagnosticTerminal.tsx` — UI inside SETTINGS → DIAGNOSTICS

## Selection policy

The instrument shell uses `user-select: none`. The terminal opts back in via `.tx80-diag-terminal` (`user-select: text`). It is the only general copy/select region.

## Event model

Each entry: `{ id, ts, severity, subsystem, message, meta? }`

Severities: `INFO | WARN | ERROR | DEBUG`  
Subsystems: `BUILD | BROWSER | AUDIO | INPUT | PATCH | MIDI | SYSTEM | PERF | ERROR`

## Privacy

- No network transmission
- Secret-like meta keys redacted
- No SysEx dumps
- No per-sample / audio-render-path logging

## Controls

Severity/subsystem filters, auto-scroll, wrap, pause/live, SNAP, COPY ALL, CLEAR.
