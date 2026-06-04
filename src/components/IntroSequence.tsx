import { useEffect, useState } from "react";

const FULL = "(patience)";

interface Props {
  onDone: () => void;
}

/**
 * After the SortingLoader finishes, this overlays a single-shot intro:
 *  1. Giant gradient "O" pops in
 *  2. "(patience)" types out letter-by-letter next to it
 *  3. Whole lockup slides up to the corner & fades, then unmounts
 */
export default function IntroSequence({ onDone }: Props) {
  const [typed, setTyped] = useState(0);
  const [phase, setPhase] = useState<"intro" | "shrink" | "gone">("intro");

  // Type the rest of the word
  useEffect(() => {
    if (phase !== "intro") return;
    if (typed >= FULL.length) {
      const t = setTimeout(() => setPhase("shrink"), 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setTyped((n) => n + 1), 85);
    return () => clearTimeout(t);
  }, [typed, phase]);

  // Slide away → unmount
  useEffect(() => {
    if (phase !== "shrink") return;
    const t = setTimeout(() => {
      setPhase("gone");
      onDone();
    }, 850);
    return () => clearTimeout(t);
  }, [phase, onDone]);

  if (phase === "gone") return null;

  const shrinking = phase === "shrink";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-none"
      style={{
        background: shrinking
          ? "transparent"
          : "radial-gradient(ellipse at center, oklch(0.18 0.06 280 / 0.95), oklch(0.13 0.04 280 / 0.98))",
        transition: "background 600ms ease-out",
      }}
    >
      <div
        className="flex items-baseline gap-1 will-change-transform"
        style={{
          transform: shrinking
            ? "translate(-38vw, -42vh) scale(0.18)"
            : "translate(0, 0) scale(1)",
          opacity: shrinking ? 0 : 1,
          transition: "transform 800ms cubic-bezier(0.7, 0, 0.3, 1), opacity 700ms ease-out 150ms",
        }}
      >
        <span
          className="text-[18vw] font-extrabold leading-none"
          style={{
            background: "var(--gradient-primary)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            filter: "drop-shadow(0 0 60px oklch(0.62 0.22 275 / 0.45))",
            animation: "intro-pop 600ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
          }}
        >
          O
        </span>
        <span
          className="text-[6vw] font-semibold text-foreground/90 tracking-tight"
          style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
        >
          {FULL.slice(0, typed)}
          {typed < FULL.length && (
            <span className="ml-0.5 inline-block w-[0.5ch] animate-pulse text-accent">|</span>
          )}
        </span>
      </div>
    </div>
  );
}
