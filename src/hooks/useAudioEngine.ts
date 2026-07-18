/**
 * useAudioEngine hook
 * 
 * Initializes the audio engine on user gesture.
 * Routes store parameter changes to the engine.
 * Provides noteOn/noteOff callbacks for the Keyboard.
 * Handles panic and status updates.
 */

import { useEffect, useCallback, useRef } from "react";
import { useSynthStore } from "@/state/store";
import { getAudioEngine } from "@/audio/engine";
import { isAudioContextRunning, resumeAudioContext } from "@/audio/context";

export function useAudioEngine() {
  const { patch, setAudioStatus, panicToken } = useSynthStore();
  const engineRef = useRef(getAudioEngine());
  const initializeAttempted = useRef(false);

  // Initialize engine on first user interaction
  const initialize = useCallback(async () => {
    if (initializeAttempted.current) return;
    initializeAttempted.current = true;

    setAudioStatus("starting");
    try {
      await resumeAudioContext();
      await engineRef.current.initialize(patch);
      setAudioStatus("running");
    } catch (error) {
      console.error("Audio engine failed to initialize:", error);
      setAudioStatus("failed");
    }
  }, [patch, setAudioStatus]);

  // Ensure AudioContext resumes on visibility change
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState === "visible" && isAudioContextRunning()) {
        try {
          await resumeAudioContext();
        } catch (error) {
          console.warn("Failed to resume audio on visibility change:", error);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Handle panic
  useEffect(() => {
    if (panicToken === 0) return;
    engineRef.current.panic();
  }, [panicToken]);

  // Route parameter changes to engine
  useEffect(() => {
    // On each patch change, update all parameters in the engine
    for (const [id, value] of Object.entries(patch)) {
      engineRef.current.setParam(id, value);
    }
  }, [patch]);

  const handleNoteOn = useCallback(
    (midi: number, velocity: number) => {
      if (!initializeAttempted.current) {
        initialize();
      }
      engineRef.current.noteOn(midi, velocity);
    },
    [initialize]
  );

  const handleNoteOff = useCallback((midi: number) => {
    engineRef.current.noteOff(midi);
  }, []);

  return {
    initialize,
    handleNoteOn,
    handleNoteOff,
  };
}
