import { useEffect, useRef, useState } from "react";
import { ALGORITHMS, type AlgoId, type Step } from "@/lib/algorithms";
import { trackRace, trackReplay } from "@/lib/dna-tracker";
import RocketLoader from "@/components/RocketLoader";

type Preset = "random" | "sorted" | "reversed" | "nearly" | "custom";
type View = "bench" | "race";

const make = (n: number, p: Exclude<Preset, "custom">): number[] => {
  const a = Array.from({ length: n }, () => Math.floor(Math.random() * 95) + 5);
  if (p === "sorted") return [...a].sort((x, y) => x - y);
  if (p === "reversed") return [...a].sort((x, y) => y - x);
  if (p === "nearly") {
    const s = [...a].sort((x, y) => x - y);
    for (let k = 0; k < Math.max(1, Math.floor(n / 10)); k++) {
      const i = Math.floor(Math.random() * n);
      const j = Math.floor(Math.random() * n);
      [s[i], s[j]] = [s[j], s[i]];
    }
    return s;
  }
  return a;
};

interface Row {
  id: string;
  name: string;
  comparisons: number;
  swaps: number;
  writes: number;
  total: number;
  ms: number;
}

interface HistoryEntry {
  id: string;
  at: number;
  pattern: Preset;
  size: number;
  input: number[];
  rows: Row[];
}

const STORAGE_KEY = "algomaster.compare.history.v1";
const MAX_HISTORY = 10;

const parseCustom = (raw: string): number[] | string => {
  const parts = raw.split(/[\s,]+/).filter(Boolean);
  if (parts.length < 2) return "Enter at least 2 numbers.";
  if (parts.length > 500) return "Max 500 numbers.";
  const nums: number[] = [];
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isFinite(n)) return `"${p}" is not a number.`;
    nums.push(n);
  }
  return nums;
};

const runBench = (input: number[], algos = ALGORITHMS): { rows: Row[]; steps: Record<AlgoId, Step[]> } => {
  const stepsMap: Record<string, Step[]> = {};
  const rows = algos.map((a) => {
    const t0 = performance.now();
    const steps = a.run(input);
    const ms = performance.now() - t0;
    stepsMap[a.id] = steps;
    let c = 0, s = 0, w = 0;
    for (const st of steps) {
      if (st.kind === "compare") c++;
      else if (st.kind === "swap") { s++; w += 2; }
      else if (st.kind === "overwrite") w++;
    }
    return { id: a.id, name: a.name, comparisons: c, swaps: s, writes: w, total: c + s + w, ms };
  });
  return { rows, steps: stepsMap as Record<AlgoId, Step[]> };
};

export default function Compare() {
  const [viewMode, setViewMode] = useState<"race" | "versus">("race");
  const [versusA, setVersusA] = useState<AlgoId>("quick");
  const [versusB, setVersusB] = useState<AlgoId>("merge");
  const activeAlgos = viewMode === "versus"
    ? ALGORITHMS.filter((a) => a.id === versusA || a.id === versusB)
    : ALGORITHMS;

  const [size, setSize] = useState(40);
  const [preset, setPreset] = useState<Preset>("random");
  const [custom, setCustom] = useState("64, 34, 25, 12, 22, 11, 90, 50, 7, 18");
  const [customErr, setCustomErr] = useState<string | null>(null);
  const [current, setCurrent] = useState<HistoryEntry | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [seed, setSeed] = useState(0);

  // Race state
  const [raceSteps, setRaceSteps] = useState<Record<AlgoId, Step[]> | null>(null);
  const [raceIdx, setRaceIdx] = useState<Record<AlgoId, number>>({} as Record<AlgoId, number>);
  const [racePlaying, setRacePlaying] = useState(false);
  const [raceSpeed, setRaceSpeed] = useState(75);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  // Load history
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const saveHistory = (h: HistoryEntry[]) => {
    setHistory(h);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(h)); } catch { /* ignore */ }
  };

  const runAll = () => {
    let input: number[];
    if (preset === "custom") {
      const parsed = parseCustom(custom);
      if (typeof parsed === "string") { setCustomErr(parsed); return; }
      setCustomErr(null);
      input = parsed;
    } else {
      input = make(size, preset);
    }
    const { rows, steps } = runBench(input, activeAlgos);
    const entry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: Date.now(),
      pattern: preset,
      size: input.length,
      input,
      rows,
    };
    setCurrent(entry);
    setRaceSteps(steps);
    setRaceIdx(Object.fromEntries(activeAlgos.map((a) => [a.id, 0])) as Record<AlgoId, number>);
    setRacePlaying(false);
    saveHistory([entry, ...history].slice(0, MAX_HISTORY));
    setSeed((x) => x + 1);
    trackRace();
  };

  const replay = (e: HistoryEntry) => {
    const { rows, steps } = runBench(e.input, activeAlgos);
    const entry = { ...e, rows, at: Date.now(), id: `${Date.now()}-r` };
    setCurrent(entry);
    setRaceSteps(steps);
    setRaceIdx(Object.fromEntries(activeAlgos.map((a) => [a.id, 0])) as Record<AlgoId, number>);
    setRacePlaying(false);
    setSeed((x) => x + 1);
    trackReplay();
  };

  const clearHistory = () => saveHistory([]);

  // Race playback loop
  useEffect(() => {
    if (!racePlaying || !raceSteps) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    // Cap the race to a bounded number of ticks so large inputs stay smooth.
    // Every algo advances the SAME number of raw steps per tick — so the
    // algorithm with the fewest total steps genuinely finishes first.
    const maxSteps = Math.max(
      ...(Object.keys(raceSteps) as AlgoId[]).map((id) => raceSteps[id].length)
    );
    const TARGET_TICKS = 600;
    const stepsPerTick = Math.max(1, Math.ceil(maxSteps / TARGET_TICKS));
    const tick = (t: number) => {
      const delay = Math.max(2, 200 - raceSpeed * 1.95);
      if (t - lastTickRef.current >= delay) {
        lastTickRef.current = t;
        setRaceIdx((prev) => {
          const next: Record<string, number> = { ...prev };
          let stillMoving = false;
          for (const id of Object.keys(raceSteps) as AlgoId[]) {
            const last = raceSteps[id].length - 1;
            const cur = prev[id] ?? 0;
            if (cur < last) {
              next[id] = Math.min(last, cur + stepsPerTick);
              stillMoving = true;
            } else next[id] = cur;
          }
          if (!stillMoving) setRacePlaying(false);
          return next as Record<AlgoId, number>;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [racePlaying, raceSpeed, raceSteps]);

  const resetRace = () => {
    if (!raceSteps) return;
    setRaceIdx(Object.fromEntries(Object.keys(raceSteps).map((id) => [id, 0])) as Record<AlgoId, number>);
    setRacePlaying(false);
  };

  const exportRaceJSON = () => {
    if (!current) return;
    const payload = {
      at: new Date(current.at).toISOString(),
      pattern: current.pattern,
      size: current.size,
      input: current.input,
      rows: current.rows,
      history,
    };
    download(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `race-${current.id}.json`);
  };

  const exportRaceCSV = () => {
    if (!current) return;
    const header = "algorithm,comparisons,swaps,writes,total_steps,ms";
    const body = current.rows.map(r => `${r.name},${r.comparisons},${r.swaps},${r.writes},${r.total},${r.ms.toFixed(3)}`).join("\n");
    download(new Blob([header + "\n" + body], { type: "text/csv" }), `race-${current.id}.csv`);
  };


  const rows = current?.rows ?? [];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">
            {viewMode === "race" ? "🏁 Race all algorithms" : "⚔️ Versus: head-to-head"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {viewMode === "race"
              ? "Same input, every algorithm — watch them sort side by side."
              : "Pick any two algorithms and focus on a clean comparison."}
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-card p-1 text-sm">
          {(["race", "versus"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setViewMode(m); setRaceSteps(null); setCurrent(null); }}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                viewMode === m ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              style={viewMode === m ? { background: "var(--gradient-primary)" } : undefined}
            >
              {m === "race" ? "Race" : "Versus"}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "versus" && (
        <div className="grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
          {([["A", versusA, setVersusA], ["B", versusB, setVersusB]] as const).map(([lbl, val, set]) => (
            <label key={lbl} className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Algorithm {lbl}
              </span>
              <select
                value={val}
                onChange={(e) => set(e.target.value as AlgoId)}
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
              >
                {ALGORITHMS.map((a) => (
                  <option key={a.id} value={a.id} disabled={lbl === "B" ? a.id === versusA : a.id === versusB}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      <div className="grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className={`block ${preset === "custom" ? "opacity-40 pointer-events-none" : ""}`}>
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Input size: {size}
          </span>
          <input
            type="range" min={10} max={100} value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-full accent-[oklch(0.62_0.22_275)]"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Pattern
          </span>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as Preset)}
            className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
          >
            <option value="random">Random</option>
            <option value="sorted">Sorted</option>
            <option value="reversed">Reversed</option>
            <option value="nearly">Nearly sorted</option>
            <option value="custom">Custom array</option>
          </select>
        </label>
        <button
          onClick={runAll}
          className="rounded-md px-5 py-2 text-sm font-semibold text-primary-foreground"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
        >
          {raceSteps ? "Reload race" : "Load race"}
        </button>
      </div>

      {preset === "custom" && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Your numbers (comma or space separated, 2–500 values)
            </span>
            <textarea
              value={custom}
              onChange={(e) => { setCustom(e.target.value); setCustomErr(null); }}
              rows={3}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm font-mono text-foreground"
              placeholder="64, 34, 25, 12, 22, 11, 90"
            />
          </label>
          {customErr && <p className="text-xs text-[oklch(0.68_0.2_25)]">{customErr}</p>}
        </div>
      )}

      {/* === RACE VIEW === */}
      {raceSteps && current && (
        <div className="space-y-5 animate-fade-in">
          {racePlaying && (
            <div className="flex items-center justify-center rounded-2xl border border-border glass px-4 py-2">
              <RocketLoader />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <label className="flex-1 min-w-[180px]">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Race speed: {raceSpeed}%
              </span>
              <input
                type="range" min={1} max={100} value={raceSpeed}
                onChange={(e) => setRaceSpeed(Number(e.target.value))}
                className="w-full accent-[oklch(0.62_0.22_275)]"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setRacePlaying((p) => !p)}
                className="rounded-md px-5 py-2 text-sm font-semibold text-primary-foreground"
                style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
              >
                {racePlaying ? "Pause" : "▶ Race"}
              </button>
              <button
                onClick={resetRace}
                className="rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium hover:bg-muted"
              >Reset</button>
              <button
                onClick={() => exportRaceJSON()}
                className="rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium hover:bg-muted"
              >Export JSON</button>
              <button
                onClick={() => exportRaceCSV()}
                className="rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium hover:bg-muted"
              >Export CSV</button>
            </div>
          </div>

          {/* Leaderboard */}
          {(() => {
            const board = activeAlgos.map((algo) => {
              const steps = raceSteps[algo.id];
              const idx = raceIdx[algo.id] ?? 0;
              const total = steps.length;
              const remaining = Math.max(0, total - 1 - idx);
              const progress = total > 1 ? idx / (total - 1) : 1;
              const done = idx >= total - 1;
              return { id: algo.id, name: algo.name, progress, done, idx, total, remaining };
            }).sort((a, b) => {
              // Fewer remaining steps = closer to finish = ahead in the race
              if (a.done !== b.done) return a.done ? -1 : 1;
              if (a.done && b.done) return a.total - b.total;
              if (a.remaining !== b.remaining) return a.remaining - b.remaining;
              return a.total - b.total;
            });
            const medals = ["🥇", "🥈", "🥉"];
            return (
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Leaderboard</h3>
                  <span className="text-[10px] font-mono text-muted-foreground">live ranking · fewest remaining steps wins</span>
                </div>
                <ol className="space-y-1.5">
                  {board.map((b, i) => (
                    <li
                      key={b.id}
                      className="flex items-center gap-3 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2"
                      style={b.done && i === 0 ? { boxShadow: "0 0 16px oklch(0.78 0.18 150 / 0.4)" } : undefined}
                    >
                      <span className="w-6 text-center text-sm font-bold tabular-nums">
                        {medals[i] ?? `#${i + 1}`}
                      </span>
                      <span className="flex-1 text-sm font-medium truncate">{b.name}</span>
                      <div className="hidden sm:block w-40 h-1.5 rounded-full overflow-hidden bg-background">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${b.progress * 100}%`,
                            background: b.done ? "oklch(0.72 0.18 150)" : "var(--gradient-primary)",
                          }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground tabular-nums w-24 text-right">
                        {b.done ? `✓ ${b.total} steps` : `${b.remaining} left`}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })()}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeAlgos.map((algo) => {
              const steps = raceSteps[algo.id];
              const idx = raceIdx[algo.id] ?? 0;
              const cur = steps[idx];
              const arr = cur?.array ?? current.input;
              const active = new Set(cur?.indices ?? []);
              const max = Math.max(...arr, 1);
              const progress = steps.length > 1 ? (idx / (steps.length - 1)) * 100 : 0;
              const done = idx >= steps.length - 1;
              return (
                <div
                  key={algo.id}
                  className="rounded-2xl border border-border bg-card p-4"
                  style={{ boxShadow: done ? "0 0 24px oklch(0.78 0.18 150 / 0.35)" : "var(--shadow-elegant)" }}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">{algo.name}</h4>
                    {done && <span className="text-xs text-[oklch(0.78_0.18_150)]">✓ done</span>}
                  </div>
                  <div className="mt-3 flex h-32 items-end gap-[2px]">
                    {arr.map((v, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-sm transition-[height] duration-150"
                        style={{
                          height: `${(v / max) * 100}%`,
                          background: done
                            ? "linear-gradient(180deg, oklch(0.78 0.18 150), oklch(0.55 0.18 150))"
                            : active.has(i)
                            ? "linear-gradient(180deg, oklch(0.82 0.18 195), oklch(0.55 0.18 195))"
                            : "linear-gradient(180deg, oklch(0.72 0.2 280), oklch(0.5 0.2 275))",
                        }}
                      />
                    ))}
                  </div>
                  <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full transition-all"
                      style={{ width: `${progress}%`, background: done ? "oklch(0.72 0.18 150)" : "var(--gradient-primary)" }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[10px] font-mono text-muted-foreground tabular-nums">
                    <span>step {idx + 1}/{steps.length}</span>
                    <span>{algo.avg}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {rows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
          Pick a size and pattern, then hit <span className="text-foreground font-medium">Load race</span>.
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Recent runs</h3>
            <button
              onClick={clearHistory}
              className="text-xs text-muted-foreground hover:text-foreground"
            >Clear</button>
          </div>
          <ul className="space-y-1.5">
            {history.map((h) => {
              const winner = [...h.rows].sort((a, b) => a.ms - b.ms)[0];
              return (
                <li key={h.id}>
                  <button
                    onClick={() => replay(h)}
                    className="w-full flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 text-left text-sm hover:bg-secondary transition"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono text-muted-foreground shrink-0">
                        {new Date(h.at).toLocaleTimeString()}
                      </span>
                      <span className="font-medium capitalize">{h.pattern}</span>
                      <span className="text-xs text-muted-foreground">n={h.size}</span>
                    </span>
                    <span className="font-mono text-xs text-accent shrink-0">
                      🏆 {winner?.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
