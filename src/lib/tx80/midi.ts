/** Guarded Web MIDI input for TX-80.
 *
 *  Rules (from the product requirements):
 *  · No MIDI calls during module import — everything happens inside enable().
 *  · Unsupported browsers and permission denials resolve to a status, never
 *    throw or crash.
 *  · Listeners are attached exactly once per input and re-attached on device
 *    reconnect (statechange); disable() removes everything.
 *  · All notes are released on device disconnect.
 *  · MIDI is never required for basic synth use.
 */

export type Tx80MidiStatus =
  | { state: "idle" }
  | { state: "unsupported" }
  | { state: "denied" }
  | { state: "error"; message: string }
  | { state: "enabled"; inputs: string[] };

export interface Tx80MidiHandlers {
  noteOn: (note: number, velocity: number) => void;
  noteOff: (note: number) => void;
  sustain: (down: boolean) => void;
  pitchBend: (normalized: number) => void;
  modWheel: (normalized: number) => void;
  allNotesOff: () => void;
}

export class Tx80Midi {
  private access: MIDIAccess | null = null;
  private readonly wired = new Set<MIDIInput>();
  private status: Tx80MidiStatus = { state: "idle" };
  private listeners = new Set<(s: Tx80MidiStatus) => void>();
  private stateChangeHandler: ((e: Event) => void) | null = null;

  constructor(private readonly handlers: Tx80MidiHandlers) {}

  getStatus(): Tx80MidiStatus {
    return this.status;
  }

  subscribe(listener: (s: Tx80MidiStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private publish(s: Tx80MidiStatus): void {
    this.status = s;
    for (const l of this.listeners) l(s);
  }

  /** Idempotent: repeated calls while enabled just refresh the input list. */
  async enable(): Promise<Tx80MidiStatus> {
    if (typeof navigator === "undefined" || !("requestMIDIAccess" in navigator)) {
      this.publish({ state: "unsupported" });
      return this.status;
    }
    if (this.access) {
      this.wireInputs();
      return this.status;
    }
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      this.access = access;
      this.stateChangeHandler = () => {
        // Newly connected inputs get wired; a disconnect must never leave
        // notes hanging (the device can no longer send its note-offs).
        this.handlers.allNotesOff();
        this.wireInputs();
      };
      access.addEventListener("statechange", this.stateChangeHandler);
      this.wireInputs();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const denied = err instanceof DOMException && err.name === "SecurityError";
      this.publish(denied ? { state: "denied" } : { state: "error", message });
    }
    return this.status;
  }

  private wireInputs(): void {
    if (!this.access) return;
    const names: string[] = [];
    for (const input of this.access.inputs.values()) {
      names.push(input.name ?? input.id);
      if (this.wired.has(input)) continue;
      input.onmidimessage = (e: MIDIMessageEvent) => this.onMessage(e);
      this.wired.add(input);
    }
    // Drop references to inputs that vanished.
    for (const input of [...this.wired]) {
      if (input.state === "disconnected") {
        input.onmidimessage = null;
        this.wired.delete(input);
      }
    }
    this.publish({ state: "enabled", inputs: names });
  }

  private onMessage(e: MIDIMessageEvent): void {
    const data = e.data;
    if (!data || data.length < 1) return;
    const statusByte = data[0] & 0xf0;
    if (statusByte === 0x90 && data.length >= 3) {
      const note = data[1];
      const vel = data[2];
      if (vel === 0) this.handlers.noteOff(note);
      else this.handlers.noteOn(note, vel / 127);
      return;
    }
    if (statusByte === 0x80 && data.length >= 2) {
      this.handlers.noteOff(data[1]);
      return;
    }
    if (statusByte === 0xb0 && data.length >= 3) {
      const cc = data[1];
      const value = data[2];
      if (cc === 1) this.handlers.modWheel(value / 127);
      else if (cc === 64) this.handlers.sustain(value >= 64);
      else if (cc === 120 || cc === 123) this.handlers.allNotesOff();
      return;
    }
    if (statusByte === 0xe0 && data.length >= 3) {
      const raw = (data[2] << 7) | data[1]; // 0..16383, centre 8192
      this.handlers.pitchBend((raw - 8192) / 8192);
    }
  }

  disable(): void {
    for (const input of this.wired) input.onmidimessage = null;
    this.wired.clear();
    if (this.access && this.stateChangeHandler) {
      this.access.removeEventListener("statechange", this.stateChangeHandler);
    }
    this.stateChangeHandler = null;
    this.access = null;
    this.handlers.allNotesOff();
    this.publish({ state: "idle" });
  }
}
