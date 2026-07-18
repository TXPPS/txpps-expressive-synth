# UI Control Mapping

**Status:** Verified for Gate 2 route bindings.

The route sends stable IDs through `setParameter` / `setParameters`; product paths are resolved by `src/lib/tx27/parameters.ts`.

| UI section  | Parameter prefix                             |
| ----------- | -------------------------------------------- |
| Operators   | `op1.*` … `op4.*`                            |
| Algorithm   | `algo`                                       |
| FM globals  | `fm.*`, `velocity.sensitivity`, `envelope.*` |
| Voice       | `voice.*`, `glide.*`                         |
| Filter      | `filter.*`                                   |
| Mix/effects | `master.volume`, `fx.*`                      |
| Vintage     | `vintage.*`                                  |

Global bend range and confirm-discard are application settings, not DSP parameters. Display labels and layouts may change without renaming IDs.
