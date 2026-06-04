import { useEffect, useMemo, useRef, useState } from "react";
import {
  Compass, Microscope, Zap, Heart, Target, Sparkles, Share2, RotateCcw, Dna,
} from "lucide-react";
import {
  bumpVisitor, getDna, resetDna, scoreDna, derivePersonality,
  type DnaState, type PersonalityKey, trackSlowTick,
} from "@/lib/dna-tracker";

const ICONS: Record<PersonalityKey, React.ComponentType<{ className?: string }>> = {
  explorer: Compass,
  deepdiver: Microscope,
  speedrunner: Zap,
  loyalist: Heart,
  completionist: Target,
  chaotic: Sparkles,
};

function useDna() {
  const [s, setS] = useState<DnaState>(() => getDna());
  useEffect(() => {
    const refresh = () => setS(getDna());
    window.addEventListener("dna:update", refresh);
    return () => window.removeEventListener("dna:update", refresh);
  }, []);
  return s;
}

function useVisitor() {
  const [total, setTotal] = useState(0);
  const [online, setOnline] = useState(() => 200 + Math.floor(Math.random() * 200));
  useEffect(() => {
    setTotal(bumpVisitor().total);
    const id = setInterval(() => {
      setOnline((v) => {
        const drift = Math.floor(Math.random() * 21) - 10;
        return Math.max(200, Math.min(400, v + drift));
      });
    }, 30000);
    return () => clearInterval(id);
  }, []);
  return { total, online, week: Math.round(total * 0.15) };
}

// Track slow dwell on whichever page is open. Every 2s of mouse-idle adds a tick.
function useSlowDwellTicker() {
  useEffect(() => {
    let last = Date.now();
    const bump = () => { last = Date.now(); };
    window.addEventListener("mousemove", bump, { passive: true });
    window.addEventListener("keydown", bump);
    const id = setInterval(() => {
      if (Date.now() - last >= 2000) trackSlowTick();
    }, 2000);
    return () => {
      window.removeEventListener("mousemove", bump);
      window.removeEventListener("keydown", bump);
      clearInterval(id);
    };
  }, []);
}

function ScoreBar({ label, value, color, delay }: { label: string; value: number; color: string; delay: number }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="font-mono text-xs tabular-nums text-foreground">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-out"
          style={{ width: `${w}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function Footer() {
  const dna = useDna();
  const visitor = useVisitor();
  useSlowDwellTicker();

  const scores = useMemo(() => scoreDna(dna), [dna]);
  const personality = useMemo(() => derivePersonality(scores, dna), [scores, dna]);
  const Icon = ICONS[personality.key];

  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.origin : "";
    const text = `I'm ${personality.title} on O(patience) — Curiosity ${scores.curiosity}, Speed ${scores.speed}, Breadth ${scores.breadth}, Race ${scores.race} 🧬 ${url}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <footer className="mt-16 border-t border-border bg-card/40 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Visitor counter pill row */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
          <div className="flex items-center gap-2 rounded-full border border-border bg-background/60 px-3.5 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[oklch(0.72_0.18_150)] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[oklch(0.72_0.18_150)]" />
            </span>
            <span className="text-muted-foreground">Total explorers</span>
            <span className="font-mono font-semibold text-foreground tabular-nums">{visitor.total.toLocaleString()}</span>
          </div>
          <div className="rounded-full border border-border bg-background/60 px-3.5 py-1.5">
            <span className="text-muted-foreground">Online now </span>
            <span className="font-mono font-semibold text-foreground tabular-nums">{visitor.online}</span>
          </div>
          <div className="rounded-full border border-border bg-background/60 px-3.5 py-1.5">
            <span className="text-muted-foreground">This week </span>
            <span className="font-mono font-semibold text-foreground tabular-nums">{visitor.week}</span>
          </div>
        </div>

        {/* Sort DNA */}
        <div className="mt-8 rounded-2xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-elegant)" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Dna className="h-4 w-4 text-[oklch(0.78_0.18_330)]" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Your Sort DNA</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={share}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-secondary"
              >
                <Share2 className="h-3.5 w-3.5" />
                {copied ? "Copied!" : "Share my DNA"}
              </button>
              <button
                onClick={resetDna}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset session
              </button>
            </div>
          </div>

          {/* Personality + bars */}
          <div className="mt-5 grid gap-6 md:grid-cols-[1fr_2fr]">
            <div className="flex flex-col items-start justify-center rounded-xl border border-border bg-background/40 p-4">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
                >
                  <Icon className="h-5 w-5 text-primary-foreground" />
                </span>
                <div>
                  <p className="text-lg font-bold tracking-tight text-foreground">{personality.title}</p>
                  <p className="text-xs text-muted-foreground">{personality.blurb}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <ScoreBar label="Curiosity" value={scores.curiosity} color="oklch(0.72 0.18 195)" delay={50} />
              <ScoreBar label="Speed" value={scores.speed} color="oklch(0.78 0.18 330)" delay={150} />
              <ScoreBar label="Breadth" value={scores.breadth} color="oklch(0.85 0.18 75)" delay={250} />
              <ScoreBar label="Race mode" value={scores.race} color="oklch(0.72 0.18 150)" delay={350} />
            </div>
          </div>

          {/* Mini stats */}
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "algos tried", value: dna.algosVisited.length },
              { label: "steps watched", value: dna.stepsAdvanced },
              { label: "races run", value: dna.racesRun },
            ].map((cell) => (
              <div key={cell.label} className="rounded-lg border border-border bg-background/40 p-3">
                <div className="font-mono text-xl font-bold tabular-nums text-foreground">{cell.value}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{cell.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          <a
            href="https://github.com/Abhirai2006"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-4 py-1.5 text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground hover:border-primary/60 hover:bg-background"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2.2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.4-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2.9-.3 1.9-.4 2.9-.4s2 .1 2.9.4c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
            </svg>
            github.com/Abhirai2006
          </a>
          <p className="text-[10px] text-muted-foreground">
            O(patience) — built with sorting in mind. © {new Date().getFullYear()}
          </p>
        </div>

      </div>
    </footer>
  );
}
