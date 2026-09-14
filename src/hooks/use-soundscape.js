import { useCallback, useEffect, useRef, useState } from "react";
import { SoundscapeEngine } from "@/lib/soundscapes";

export const SOUNDSCAPE_MODES = [
  { key: "none", label: "Off", hint: "no ambient" },
  { key: "cyber", label: "Cyber Synth", hint: "detuned pads · arp" },
  { key: "lo-fi", label: "Lo-Fi Chill", hint: "warm · tape dust" },
  { key: "binaural", label: "Binaural Alpha", hint: "~10 Hz beat" },
  { key: "brown", label: "Deep Brown Noise", hint: "full-spectrum calm" },
];

export function useSoundscape() {
  const engineRef = useRef(null);
  const poll = useRef(null);
  const [mode, setMode] = useState("none");
  const [playing, setPlaying] = useState(false);
  const [levels, setLevels] = useState(() => Array(24).fill(2));

  useEffect(
    () => () => {
      if (poll.current) clearInterval(poll.current);
      if (engineRef.current) engineRef.current.dispose();
    },
    []
  );

  const start = useCallback((key) => {
    if (!engineRef.current) engineRef.current = new SoundscapeEngine();
    try {
      engineRef.current.start(key);
    } catch {
      // audio unavailable or blocked — silently degrade
    }
    setMode(key);
    setPlaying(key !== "none");
    if (poll.current) {
      clearInterval(poll.current);
      poll.current = null;
    }
    if (key !== "none") {
      poll.current = setInterval(() => {
        if (engineRef.current) setLevels(engineRef.current.levels(24));
      }, 90);
    }
  }, []);

  return { mode, playing, levels, start };
}