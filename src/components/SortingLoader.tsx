import { useEffect, useState } from "react";

const INITIAL = [40, 75, 25, 90, 55, 15, 65, 35, 80, 50, 20, 70];

// precompute bubble-sort frames
function buildFrames(arr: number[]): number[][] {
  const frames: number[][] = [arr.slice()];
  const a = arr.slice();
  const n = a.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n - i - 1; j++) {
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        frames.push(a.slice());
      }
    }
  }
  return frames;
}

const FRAMES = buildFrames(INITIAL);

export default function SortingLoader({ onDone }: { onDone: () => void }) {
  const [frame, setFrame] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (frame >= FRAMES.length - 1) {
      const t1 = setTimeout(() => setFadeOut(true), 450);
      const t2 = setTimeout(onDone, 950);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    const t = setTimeout(() => setFrame((f) => f + 1), 90);
    return () => clearTimeout(t);
  }, [frame, onDone]);

  const arr = FRAMES[frame];
  const max = Math.max(...arr);
  const progress = (frame / (FRAMES.length - 1)) * 100;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-500 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
      style={{ background: "var(--gradient-bg)" }}
    >
      <div className="mb-8 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
          Sorting things out
        </p>
      </div>

      <div className="flex h-48 items-end gap-1.5 px-6">
        {arr.map((v, i) => {
          const sorted = frame >= FRAMES.length - 1;
          return (
            <div
              key={i}
              className="w-4 rounded-t-md transition-all duration-150 ease-out sm:w-6"
              style={{
                height: `${(v / max) * 100}%`,
                background: sorted
                  ? "linear-gradient(180deg, oklch(0.78 0.18 150), oklch(0.55 0.18 150))"
                  : "linear-gradient(180deg, oklch(0.72 0.2 280), oklch(0.5 0.2 275))",
                boxShadow: sorted
                  ? "0 0 12px oklch(0.72 0.18 150 / 0.6)"
                  : "0 2px 8px oklch(0.1 0.04 280 / 0.4)",
              }}
            />
          );
        })}
      </div>

      <div className="mt-10 h-1 w-64 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full transition-all duration-100"
          style={{ width: `${progress}%`, background: "var(--gradient-primary)" }}
        />
      </div>
      <p className="mt-3 font-mono text-[10px] tabular-nums text-muted-foreground">
        {Math.round(progress)}%
      </p>

      <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
        made by{" "}
        <span
          className="font-signature text-base"
          style={{
            background: "var(--gradient-primary)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          Abhirai
        </span>
      </p>
    </div>
  );
}
