import { useEffect, useMemo, useRef, useState } from "react";
import { ALGORITHMS, type AlgoId, type Step } from "@/lib/algorithms";
import Confetti from "@/components/Confetti";
import { trackAlgo, trackStep, trackPseudo } from "@/lib/dna-tracker";

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

const generate = (n: number) =>
  Array.from({ length: n }, () => Math.floor(Math.random() * 95) + 5);

type Preset = "random" | "sorted" | "reversed" | "nearly";

const presetArray = (n: number, p: Preset): number[] => {
  const a = generate(n);
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

// pointer label -> color (oklch)
const POINTER_COLORS: Record<string, string> = {
  i: "oklch(0.85 0.18 75)",      // amber
  j: "oklch(0.78 0.16 195)",     // cyan
  k: "oklch(0.78 0.18 330)",     // pink
  mid: "oklch(0.95 0.02 270)",   // white-ish
  low: "oklch(0.78 0.18 150)",   // green
  high: "oklch(0.72 0.22 25)",   // red
  min: "oklch(0.82 0.18 55)",    // orange
  pivot: "oklch(0.88 0.18 95)",  // yellow
};

const worstCaseFor = (id: AlgoId, n: number): number[] => {
  const sorted = Array.from({ length: n }, (_, i) =>
    Math.max(1, Math.min(100, Math.round(5 + (i * 95) / Math.max(1, n - 1))))
  );
  if (id === "merge") {
    const a: number[] = [];
    let lo = 0, hi = n - 1;
    while (lo <= hi) { a.push(sorted[lo++]); if (lo <= hi) a.push(sorted[hi--]); }
    return a;
  }
  if (id === "quick") return sorted; // last-element pivot worst case
  return [...sorted].reverse(); // bubble / insertion / selection
};

export default function Visualizer({ embed = false }: { embed?: boolean } = {}) {
  const [algoId, setAlgoId] = useState<AlgoId>("quick");
  const [size, setSize] = useState(20);
  const [speed, setSpeed] = useState(55);
  const [speedByAlgo, setSpeedByAlgo] = useState<Record<string, number>>({});
  const [preset, setPreset] = useState<Preset>("random");
  const [array, setArray] = useState<number[]>(() => presetArray(20, "random"));
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sortedSet, setSortedSet] = useState<Set<number>>(new Set());
  const [soundOn, setSoundOn] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [labelMode, setLabelMode] = useState<"auto" | "on" | "off">("auto");
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastSoundStepRef = useRef<number>(-1);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const hydratedRef = useRef(false);

  const algo = ALGORITHMS.find((a) => a.id === algoId)!;

  // Hydrate from URL on mount (shareable snapshot / embed)
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    try {
      const sp = new URL(window.location.href).searchParams;
      const a = sp.get("a") as AlgoId | null;
      const v = sp.get("v");
      if (v) {
        const nums = v.split(",").map(Number).filter((x) => Number.isFinite(x)).slice(0, 100)
          .map((x) => Math.max(1, Math.min(100, Math.round(x))));
        if (nums.length >= 2) { setArray(nums); setSize(nums.length); }
      }
      if (a && ALGORITHMS.some((x) => x.id === a)) setAlgoId(a);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    const s = algo.run(array);
    setSteps(s);
    setStepIdx(0);
    setSortedSet(new Set());
    setPlaying(false);
  }, [array, algoId]);

  useEffect(() => { trackAlgo(algoId); }, [algoId]);
  useEffect(() => { if (stepIdx > 0) trackStep(); }, [stepIdx]);



  // Per-algo speed memory
  useEffect(() => {
    setSpeedByAlgo((prev) => ({ ...prev, [algoId]: speed }));
  }, [speed, algoId]);
  useEffect(() => {
    setSpeed((prev) => speedByAlgo[algoId] ?? prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [algoId]);

  useEffect(() => {
    setArray(presetArray(size, preset));
  }, [size, preset]);

  const current = steps[stepIdx];
  const display = current?.array ?? array;
  const activeIndices = current?.indices ?? [];
  const pointers = current?.pointers ?? {};

  // build map: index -> list of pointer labels on that index
  const pointersByIdx = useMemo(() => {
    const m: Record<number, string[]> = {};
    Object.entries(pointers).forEach(([label, idx]) => {
      if (idx == null || idx < 0 || idx >= display.length) return;
      (m[idx] ||= []).push(label);
    });
    return m;
  }, [pointers, display.length]);

  const pivotIdx = pointers.pivot;

  useEffect(() => {
    const next = new Set<number>();
    for (let i = 0; i <= stepIdx && i < steps.length; i++) {
      const st = steps[i];
      if (st.kind === "mark-sorted") st.indices.forEach((x) => next.add(x));
      if (st.kind === "done") for (let j = 0; j < display.length; j++) next.add(j);
    }
    setSortedSet(next);
  }, [stepIdx, steps]);

  const { comparisons, swaps, writes } = useMemo(() => {
    let c = 0, s = 0, w = 0;
    // Clamp: protects against the brief render after an algo-switch where
    // stepIdx hasn't reset yet relative to fresh steps.
    const upto = Math.min(stepIdx, steps.length - 1);
    for (let i = 0; i <= upto; i++) {
      const k = steps[i].kind;
      if (k === "compare") c++;
      else if (k === "swap") { s++; w += 2; }
      else if (k === "overwrite") w++;
    }
    return { comparisons: c, swaps: s, writes: w };
  }, [stepIdx, steps]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = (t: number) => {
      const delay = Math.max(4, 400 - speed * 3.9);
      if (t - lastTickRef.current >= delay) {
        lastTickRef.current = t;
        setStepIdx((i) => {
          if (i >= steps.length - 1) { setPlaying(false); return i; }
          return i + 1;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, steps.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === "Space") { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.key === "r" || e.key === "R") reset();
      else if (e.key === "ArrowRight") setStepIdx((i) => Math.min(steps.length - 1, i + 1));
      else if (e.key === "ArrowLeft") setStepIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length]);

  const reset = () => { setPlaying(false); setStepIdx(0); setSortedSet(new Set()); };
  const shuffle = () => setArray(presetArray(size, preset));

  const maxVal = Math.max(...display, 1);
  const progress = steps.length > 1 ? (stepIdx / (steps.length - 1)) * 100 : 0;
  const done = stepIdx >= steps.length - 1 && steps.length > 0;
  const showLabels = labelMode === "on" ? true : labelMode === "off" ? false : display.length <= 32;
  const hasDuplicates = useMemo(() => new Set(display).size !== display.length, [display]);
  const dedupArray = () => {
    const used = new Set<number>();
    const out: number[] = [];
    for (const v of display) {
      let cand = v;
      while (used.has(cand)) cand = (cand % 100) + 1;
      used.add(cand); out.push(cand);
    }
    setArray(out);
  };
  const shareSnapshot = async (forEmbed: boolean) => {
    try {
      const params = new URLSearchParams({ a: algoId, v: display.join(",") });
      const url = `${window.location.origin}${forEmbed ? "/embed" : "/"}?${params}`;
      if (forEmbed) {
        const code = `<iframe src="${url}" width="100%" height="600" style="border:0;border-radius:12px" loading="lazy" title="${algo.name} visualization"></iframe>`;
        await navigator.clipboard.writeText(code);
        setShareMsg("Embed code copied to clipboard");
      } else {
        await navigator.clipboard.writeText(url);
        setShareMsg("Share link copied to clipboard");
      }
      setTimeout(() => setShareMsg(null), 2500);
    } catch {
      setShareMsg("Couldn't access clipboard");
      setTimeout(() => setShareMsg(null), 2500);
    }
  };
  const compactPointers = display.length > 40;
  const swapIndices = current?.kind === "swap" ? activeIndices : [];

  // confetti trigger increments every time we reach a fresh "done"
  const [confettiKey, setConfettiKey] = useState(0);
  const wasDoneRef = useRef(false);
  useEffect(() => {
    if (done && !wasDoneRef.current && steps.length > 1) {
      setConfettiKey((k) => k + 1);
      wasDoneRef.current = true;
    }
    if (!done) wasDoneRef.current = false;
  }, [done, steps.length]);


  // Sound: play a tone proportional to current step's main value
  useEffect(() => {
    if (!soundOn || !current || stepIdx === lastSoundStepRef.current) return;
    lastSoundStepRef.current = stepIdx;
    if (current.kind === "done" || current.kind === "mark-sorted") return;
    const idx = current.indices[0];
    if (idx == null) return;
    const v = current.array[idx];
    if (v == null) return;
    try {
      if (!audioCtxRef.current) {
        const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
        if (!Ctx) return;
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      // Map value (1..100) -> 220Hz..880Hz
      const freq = 220 + (v / 100) * 660;
      osc.type = current.kind === "swap" ? "square" : "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } catch {}
  }, [stepIdx, soundOn, current]);

  // Step history — last 40 ops up to current step
  const history = useMemo(() => {
    const start = Math.max(0, stepIdx - 39);
    return steps.slice(start, stepIdx + 1).map((s, i) => ({ ...s, n: start + i + 1 }));
  }, [stepIdx, steps]);

  useEffect(() => {
    if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [history.length]);

  const applyCustomInput = () => {
    setCustomError(null);
    const parts = customInput.split(/[\s,]+/).filter(Boolean);
    if (parts.length < 2) { setCustomError("Enter at least 2 numbers."); return; }
    if (parts.length > 100) { setCustomError("Max 100 numbers."); return; }
    const nums: number[] = [];
    for (const p of parts) {
      const n = Number(p);
      if (!Number.isFinite(n)) { setCustomError(`"${p}" is not a number.`); return; }
      nums.push(Math.max(1, Math.min(100, Math.round(n))));
    }
    setSize(nums.length);
    setArray(nums);
  };

  // unique set of pointer labels currently active (for legend)
  const activeLabels = Object.keys(pointers);

  return (
    <div className="relative space-y-6">
      <Confetti trigger={confettiKey} />
      <div className="flex flex-wrap gap-2">
        {ALGORITHMS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAlgoId(a.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
              algoId === a.id
                ? "text-primary-foreground shadow-[var(--shadow-glow)]"
                : "bg-card text-muted-foreground hover:text-foreground hover:bg-secondary border border-border"
            }`}
            style={algoId === a.id ? { background: "var(--gradient-primary)" } : undefined}
          >
            {a.name}
          </button>
        ))}
      </div>

      {/* Visualizer canvas */}
      <div
        className="relative rounded-2xl border border-border bg-card p-4 sm:p-6 overflow-hidden"
        style={{ boxShadow: "var(--shadow-elegant)" }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{ background: "radial-gradient(ellipse at top, oklch(0.62 0.22 275 / 0.25), transparent 60%)" }}
        />
        <div
          className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
          style={{ background: "oklch(0.62 0.22 275)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full opacity-25 blur-3xl"
          style={{ background: "oklch(0.72 0.18 195)" }}
        />

        {/* Bars row */}
        <div className="relative flex h-[420px] items-end justify-center gap-[3px]">
          {display.map((v, i) => {
            const isActive = activeIndices.includes(i);
            const isSorted = sortedSet.has(i);
            const isPivot = pivotIdx === i;
            const labels = pointersByIdx[i] || [];
            const hasPointer = labels.length > 0;

            let bg = "linear-gradient(180deg, oklch(0.72 0.2 280), oklch(0.5 0.2 275))";
            let border = "transparent";
            if (isSorted) bg = "linear-gradient(180deg, oklch(0.78 0.18 150), oklch(0.55 0.18 150))";
            if (isActive) bg = "linear-gradient(180deg, oklch(0.82 0.18 195), oklch(0.55 0.18 195))";
            if (isPivot) {
              bg = "linear-gradient(180deg, oklch(0.92 0.18 90), oklch(0.7 0.2 60))";
              border = "oklch(0.95 0.18 90)";
            }

            return (
              <div key={i} className="relative flex h-full flex-1 flex-col items-center justify-end">
                {/* Pointer flags */}
                {hasPointer && (
                  <div className="pointer-pulse absolute -top-1 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-0.5">
                    {labels.map((lbl) => (
                      <span
                        key={lbl}
                        className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider leading-none shadow"
                        style={{
                          backgroundColor: POINTER_COLORS[lbl] ?? "oklch(0.85 0.05 270)",
                          color: "oklch(0.12 0.04 280)",
                        }}
                      >
                        {compactPointers ? lbl[0] : lbl}
                      </span>
                    ))}
                    <span
                      className="h-3 w-px"
                      style={{ background: POINTER_COLORS[labels[0]] ?? "white" }}
                    />
                  </div>
                )}

                {/* Value */}
                {showLabels && (
                  <span
                    className="mb-1 text-[10px] font-mono font-semibold tabular-nums"
                    style={{
                      color: isActive || isPivot
                        ? "oklch(0.98 0.02 270)"
                        : "oklch(0.75 0.04 270)",
                    }}
                  >
                    {v}
                  </span>
                )}

                {/* Bar */}
                <div
                  key={swapIndices.includes(i) ? `swap-${stepIdx}-${i}` : `bar-${i}`}
                  className={`w-full rounded-t-md transition-[height] duration-200 ease-out ${swapIndices.includes(i) ? "bar-swap" : ""}`}
                  style={{
                    height: `${(v / maxVal) * 78}%`,
                    background: bg,
                    border: `1px solid ${border}`,
                    boxShadow:
                      isPivot ? "0 0 18px oklch(0.88 0.18 90 / 0.7)"
                      : isActive ? "0 0 14px oklch(0.78 0.18 195 / 0.6)"
                      : "0 2px 8px oklch(0.1 0.04 280 / 0.4)",
                  }}
                  aria-label={`index ${i}, value ${v}`}
                />

                {/* Index */}
                {showLabels && (
                  <span className="mt-1 text-[9px] font-mono text-muted-foreground tabular-nums">
                    {i}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Note / caption */}
        <div className="relative mt-4 min-h-[44px] rounded-lg border border-border bg-secondary/40 px-4 py-2.5 backdrop-blur">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor:
                  current?.kind === "swap" ? "oklch(0.72 0.22 25 / 0.25)" :
                  current?.kind === "compare" ? "oklch(0.72 0.18 195 / 0.25)" :
                  current?.kind === "pivot" ? "oklch(0.88 0.18 90 / 0.25)" :
                  current?.kind === "overwrite" ? "oklch(0.78 0.18 330 / 0.25)" :
                  current?.kind === "mark-sorted" ? "oklch(0.72 0.18 150 / 0.25)" :
                  "oklch(0.5 0.04 270 / 0.25)",
                color: "oklch(0.95 0.02 270)",
              }}
            >
              {current?.kind ?? "idle"}
            </span>
            <span className="text-sm text-foreground">
              {current?.note ?? "Press Play to begin"}
            </span>
          </div>
          {activeLabels.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-2">
              {activeLabels.map((lbl) => (
                <span
                  key={lbl}
                  className="inline-flex items-center gap-1 rounded-full bg-card/60 px-2 py-0.5 text-[10px] font-mono"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: POINTER_COLORS[lbl] ?? "white" }}
                  />
                  <span className="text-muted-foreground">{lbl} =</span>
                  <span className="font-semibold text-foreground tabular-nums">{pointers[lbl]}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full transition-all"
            style={{ width: `${progress}%`, background: "var(--gradient-primary)" }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] font-mono text-muted-foreground tabular-nums">
          <span>step {Math.min(stepIdx + 1, steps.length)}</span>
          <span>{steps.length} total</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-2.5 text-xs">
        <span className="text-muted-foreground">Legend:</span>
        <LegendDot color="oklch(0.62 0.22 275)" label="unsorted" />
        <LegendDot color="oklch(0.72 0.18 195)" label="comparing" />
        <LegendDot color="oklch(0.88 0.18 90)" label="pivot" />
        <LegendDot color="oklch(0.72 0.18 150)" label="sorted" />
      </div>

      {/* Duplicate-value warning */}
      {hasDuplicates && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[oklch(0.72_0.18_90/0.4)] bg-[oklch(0.72_0.18_90/0.08)] px-4 py-2.5 text-xs">
          <span className="font-semibold text-[oklch(0.85_0.18_90)]">⚠ Duplicate values</span>
          <span className="text-muted-foreground">Equal-height bars can make compares/swaps look like no-ops — affects stable-vs-unstable demos.</span>
          <button onClick={dedupArray}
            className="ml-auto rounded-md border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium hover:bg-muted">
            Make values unique
          </button>
        </div>
      )}

      {/* Parameters */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">⚙️ Parameters</h3>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={`Size: ${size}`}>
            <input type="range" min={6} max={80} value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="w-full accent-[oklch(0.62_0.22_275)]" />
          </Field>
          <Field label={`Speed: ${speed}%`}>
            <input type="range" min={1} max={100} value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full accent-[oklch(0.62_0.22_275)]" />
          </Field>
          <Field label="Pattern">
            <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground">
              <option value="random">Random</option>
              <option value="sorted">Sorted</option>
              <option value="reversed">Reversed</option>
              <option value="nearly">Nearly sorted</option>
            </select>
          </Field>
          <Field label="Data">
            <button onClick={shuffle}
              className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition">
              Generate new
            </button>
          </Field>
        </div>
      </div>

      {/* Playback controls */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">▶︎ Playback & tools</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            className="rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium hover:bg-muted">‹ Prev</button>
          <button onClick={() => { if (done) reset(); setPlaying((p) => !p); }}
            className="rounded-md px-5 py-2 text-sm font-semibold text-primary-foreground"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
            {playing ? "Pause" : done ? "Replay" : "Play"}
          </button>
          <button onClick={() => setStepIdx((i) => Math.min(steps.length - 1, i + 1))}
            className="rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium hover:bg-muted">Next ›</button>
          <button onClick={() => { setPlaying(false); setStepIdx(Math.max(0, steps.length - 1)); }}
            className="rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium hover:bg-muted"
            title="Jump to final sorted state">Skip ⏭</button>
          <button onClick={reset}
            className="rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium hover:bg-muted">Reset</button>
          <button
            onClick={() => setSoundOn((s) => !s)}
            title="Pitch follows the value of the bar being touched"
            className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
              soundOn
                ? "border-transparent text-primary-foreground"
                : "border-border bg-secondary hover:bg-muted"
            }`}
            style={soundOn ? { background: "var(--gradient-primary)" } : undefined}
          >
            {soundOn ? "🔊 Sound on" : "🔇 Sound off"}
          </button>
          <button
            onClick={() => setLabelMode((m) => m === "auto" ? "on" : m === "on" ? "off" : "auto")}
            title="Toggle value labels on bars"
            className="rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            Labels: {labelMode}
          </button>
          <button
            onClick={() => { setArray(worstCaseFor(algoId, size)); setPreset("random"); }}
            title={`Generate worst-case input for ${algo.name}`}
            className="rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            💥 Worst case
          </button>
          {!embed && (
            <>
              <button
                onClick={() => shareSnapshot(false)}
                title="Copy a link to the current array + algorithm"
                className="rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium hover:bg-muted"
              >🔗 Share</button>
              <button
                onClick={() => shareSnapshot(true)}
                title="Copy an <iframe> snippet for embedding"
                className="rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium hover:bg-muted"
              >&lt;/&gt; Embed</button>
            </>
          )}
        </div>
      </div>
      {shareMsg && (
        <div className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs text-foreground">{shareMsg}</div>
      )}

      {/* Custom array input */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            🔢 Custom array
          </span>
          <span className="text-xs text-muted-foreground">— comma or space separated, 1–100, up to 100 numbers</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyCustomInput(); }}
            placeholder="e.g. 42, 17, 88, 5, 23, 60"
            className="min-w-0 flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <button
            onClick={applyCustomInput}
            className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground"
            style={{ background: "var(--gradient-primary)" }}
          >
            Use these
          </button>
        </div>
        {customError && <p className="mt-2 text-xs text-destructive">{customError}</p>}
      </div>

      {/* Step history */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            📖 Step history
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted-foreground">
              showing last {history.length} of {steps.length}
            </span>
            <button
              disabled={steps.length === 0}
              onClick={() => {
                const payload = {
                  at: new Date().toISOString(),
                  algorithm: algo.name,
                  algorithmId: algo.id,
                  preset,
                  size,
                  input: steps[0]?.array ?? array,
                  totalSteps: steps.length,
                  steps: steps.map((s, i) => ({ n: i + 1, ...s })),
                };
                download(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `steps-${algo.id}-${Date.now()}.json`);
              }}
              className="rounded-md border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium hover:bg-muted disabled:opacity-40"
            >Export JSON</button>
            <button
              disabled={steps.length === 0}
              onClick={() => {
                const header = "n,kind,indices,note";
                const body = steps.map((s, i) =>
                  `${i + 1},${s.kind},"${(s.indices ?? []).join(" ")}","${(s.note ?? "").replace(/"/g, '""')}"`
                ).join("\n");
                download(new Blob([header + "\n" + body], { type: "text/csv" }), `steps-${algo.id}-${Date.now()}.csv`);
              }}
              className="rounded-md border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium hover:bg-muted disabled:opacity-40"
            >Export CSV</button>
          </div>
        </div>
        <div
          ref={historyRef}
          className="mt-3 h-48 overflow-y-auto rounded-lg border border-border bg-background/60 p-3 font-mono text-xs"
        >
          {history.length === 0 && (
            <p className="text-muted-foreground">No steps yet — press Play.</p>
          )}
          {history.map((h) => (
            <div key={h.n} className="flex gap-2 py-0.5">
              <span className="w-10 shrink-0 text-right text-muted-foreground tabular-nums">{h.n}</span>
              <span
                className="w-20 shrink-0 rounded px-1.5 text-[10px] uppercase tracking-wider"
                style={{
                  backgroundColor:
                    h.kind === "swap" ? "oklch(0.72 0.22 25 / 0.25)" :
                    h.kind === "compare" ? "oklch(0.72 0.18 195 / 0.25)" :
                    h.kind === "pivot" ? "oklch(0.88 0.18 90 / 0.25)" :
                    h.kind === "overwrite" ? "oklch(0.78 0.18 330 / 0.25)" :
                    h.kind === "mark-sorted" ? "oklch(0.72 0.18 150 / 0.25)" :
                    "oklch(0.5 0.04 270 / 0.25)",
                  color: "oklch(0.95 0.02 270)",
                }}
              >
                {h.kind}
              </span>
              <span className="truncate text-foreground/80">{h.note ?? `indices ${h.indices.join(",")}`}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats + info */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Stat label="Comparisons" value={comparisons} />
        <Stat label="Swaps" value={swaps} />
        <Stat label="Array writes" value={writes} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold text-foreground">{algo.name}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{algo.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge>Stable: {algo.stable ? "Yes" : "No"}</Badge>
            <Badge>Space {algo.space}</Badge>
          </div>
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Real-world use</p>
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              {algo.useCases.map((u) => (
                <li key={u} className="flex gap-2"><span className="text-accent">›</span>{u}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold text-foreground">Complexity</h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Cx label="Best" value={algo.best} />
            <Cx label="Average" value={algo.avg} />
            <Cx label="Worst" value={algo.worst} />
            <Cx label="Space" value={algo.space} />
          </div>
          <div className="mt-6 rounded-lg bg-secondary/50 p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Keyboard</p>
            <p>Space — play/pause &nbsp; · &nbsp; ←/→ — step &nbsp; · &nbsp; R — reset</p>
          </div>
        </div>
      </div>

      {/* Pseudocode */}
      <div className="rounded-2xl border border-border bg-card p-6" onMouseEnter={() => trackPseudo()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Pseudocode — {algo.name}</h3>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {current?.kind ?? "idle"}
          </span>
        </div>
        <pre
          className="mt-4 overflow-x-auto rounded-lg border border-border bg-background/60 p-4 text-[13px] leading-relaxed"
          style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
        >
{algo.pseudocode.map((line, idx) => (
            <div
              key={idx}
              className="whitespace-pre"
              style={{ color: line.trim() === "" ? "transparent" : "oklch(0.9 0.02 270)" }}
            >
              <span className="mr-3 inline-block w-6 select-none text-right text-muted-foreground">{idx + 1}</span>
              {line || " "}
            </div>
          ))}
        </pre>
      </div>

      {/* Sticky floating playback toolbar — always reachable, glass blur */}
      {!embed && (
        <div className="fixed inset-x-0 bottom-4 z-40 pointer-events-none flex justify-center px-3">
          <div className="pointer-events-auto glass-strong flex items-center gap-2 rounded-full px-3 py-2 shadow-2xl">
            <button
              onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
              title="Previous step (←)"
              className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground/90 hover:bg-white/10 transition"
            >‹</button>
            <button
              onClick={() => { if (done) reset(); setPlaying((p) => !p); }}
              title="Play / Pause (Space)"
              className="rounded-full px-5 py-1.5 text-sm font-semibold text-primary-foreground"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
            >
              {playing ? "❚❚ Pause" : done ? "↻ Replay" : "▶ Play"}
            </button>
            <button
              onClick={() => setStepIdx((i) => Math.min(steps.length - 1, i + 1))}
              title="Next step (→)"
              className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground/90 hover:bg-white/10 transition"
            >›</button>
            <span className="mx-1 h-5 w-px bg-white/15" />
            <span className="hidden sm:inline px-2 text-[11px] font-mono text-muted-foreground tabular-nums">
              {Math.min(stepIdx + 1, steps.length)}/{steps.length}
            </span>
            <button
              onClick={reset}
              title="Reset (R)"
              className="rounded-full px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-white/10 transition"
            >Reset</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-foreground">{value.toLocaleString()}</p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground">{children}</span>
  );
}

function Cx({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold text-accent">{value}</p>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
