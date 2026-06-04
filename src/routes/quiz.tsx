import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ALGORITHMS, type AlgoId, type Step, type StepKind } from "@/lib/algorithms";

export const Route = createFileRoute("/quiz")({
  head: () => ({
    meta: [
      { title: "O(patience) — Quiz: test your sorting knowledge" },
      { name: "description", content: "Tiered quizzes: identify algorithms, predict next steps, fill traces, spot bugs, reorder pseudocode, and reason about trade-offs." },
      { property: "og:title", content: "Sorting algorithm quiz" },
      { property: "og:description", content: "Multi-mode quiz from pattern-recognition to deep reasoning." },
    ],
  }),
  component: QuizPage,
});

const randArray = (n = 12) =>
  Array.from({ length: n }, () => Math.floor(Math.random() * 95) + 5);

type Tier = 1 | 2 | 3;
type QType = "identify" | "predict" | "trace" | "bug" | "reorder" | "tradeoff";

const TIER_OF: Record<QType, Tier> = {
  identify: 1, predict: 1,
  trace: 2, bug: 2,
  reorder: 3, tradeoff: 3,
};

const TIER_LABEL: Record<Tier, string> = {
  1: "Tier 1 · 1pt",
  2: "Tier 2 · 2pt",
  3: "Tier 3 · 3pt",
};

const TIER_COLOR: Record<Tier, string> = {
  1: "oklch(0.72 0.18 195)",
  2: "oklch(0.85 0.18 75)",
  3: "oklch(0.78 0.18 330)",
};

interface QChoice { id: string; label: string; }
interface BaseQ {
  type: QType;
  tier: Tier;
  prompt: string;
  hint?: string;
  choices: QChoice[];
  correctId: string;
  explain: string;
  // optional visual payload
  vis?: { arr: number[]; active?: number[]; pivot?: number };
  pseudo?: string[];
  algoName?: string;
}

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ---------- Question builders ----------

function qIdentify(): BaseQ {
  const algo = pick(ALGORITHMS);
  return {
    type: "identify",
    tier: 1,
    prompt: "Watch the animation. Which algorithm is this?",
    choices: shuffle(ALGORITHMS.map((a) => ({ id: a.id, label: a.name }))),
    correctId: algo.id,
    explain: `${algo.name} — ${algo.description}`,
    algoName: algo.name,
    vis: { arr: [] }, // signals "animate"
  };
}

function qPredict(): BaseQ {
  // Pick algo, run, pick a random compare/swap step, ask "what's the next action"
  const algo = pick(ALGORITHMS);
  const arr = randArray(8);
  const steps = algo.run(arr);
  // pick a step early-mid so there's a meaningful "next"
  const candidates = steps
    .map((s, i) => ({ s, i }))
    .filter(({ s, i }) => i < steps.length - 2 && (s.kind === "compare" || s.kind === "pivot"));
  if (candidates.length === 0) return qIdentify();
  const { s, i } = pick(candidates);
  const next = steps[i + 1];

  const kindLabel = (k: StepKind, indices: number[]) => {
    if (k === "swap") return `Swap a[${indices[0]}] and a[${indices[1]}]`;
    if (k === "compare") return `Compare a[${indices[0]}] and a[${indices[1]}]`;
    if (k === "overwrite") return `Overwrite a[${indices[0]}]`;
    if (k === "mark-sorted") return `Mark index ${indices[0]} sorted`;
    if (k === "pivot") return `Choose pivot a[${indices[0]}]`;
    return "Done";
  };

  // Build 4 plausible distractors
  const correct = kindLabel(next.kind, next.indices);
  const distractorPool = new Set<string>();
  // Add alternative actions on adjacent indices
  const n = s.array.length;
  const a = s.indices[0] ?? 0;
  const b = s.indices[1] ?? Math.min(n - 1, a + 1);
  distractorPool.add(`Swap a[${a}] and a[${b}]`);
  distractorPool.add(`Compare a[${a}] and a[${b}]`);
  distractorPool.add(`Mark index ${a} sorted`);
  if (a + 1 < n) distractorPool.add(`Compare a[${a + 1}] and a[${Math.min(n - 1, a + 2)}]`);
  distractorPool.delete(correct);
  const distractors = shuffle([...distractorPool]).slice(0, 3);

  const choices = shuffle([
    { id: "correct", label: correct },
    ...distractors.map((d, k) => ({ id: `d${k}`, label: d })),
  ]);

  return {
    type: "predict",
    tier: 1,
    prompt: `${algo.name}: given the highlighted state, what's the very next operation the algorithm performs?`,
    hint: s.note,
    choices,
    correctId: "correct",
    explain: `Next operation: ${correct}. ${next.note ?? ""}`,
    vis: { arr: s.array, active: s.indices, pivot: s.pointers?.pivot },
    algoName: algo.name,
  };
}

function qTrace(): BaseQ {
  // Show input + 2 correct intermediate snapshots + 1 missing slot,
  // ask which array state appears next.
  const algo = pick(ALGORITHMS.filter((a) => a.id !== "merge")); // merge less intuitive trace
  const arr = randArray(6);
  const steps = algo.run(arr).filter((s) => s.kind === "swap" || s.kind === "overwrite");
  if (steps.length < 3) return qIdentify();
  const k = 1 + Math.floor(Math.random() * Math.min(steps.length - 1, 4));
  const target = steps[k].array;
  const prev = steps[k - 1].array;

  // Distractors: swap two random indices in prev
  const makeDistractor = () => {
    const a = [...prev];
    let i = Math.floor(Math.random() * a.length);
    let j = Math.floor(Math.random() * a.length);
    while (j === i) j = Math.floor(Math.random() * a.length);
    [a[i], a[j]] = [a[j], a[i]];
    return a;
  };
  const fmt = (a: number[]) => `[${a.join(", ")}]`;
  const distractors = [makeDistractor(), makeDistractor(), makeDistractor()];

  const choices = shuffle([
    { id: "correct", label: fmt(target) },
    ...distractors.map((d, i) => ({ id: `d${i}`, label: fmt(d) })),
  ]);

  return {
    type: "trace",
    tier: 2,
    prompt: `${algo.name}: previous state was ${fmt(prev)}. Which is the array after the next ${steps[k].kind}?`,
    hint: steps[k].note,
    choices,
    correctId: "correct",
    explain: `Correct: ${fmt(target)}. ${steps[k].note ?? ""}`,
    algoName: algo.name,
  };
}

function qBug(): BaseQ {
  // Show pseudocode with one line subtly wrong, identify the wrong line.
  const algo = pick(ALGORITHMS);
  const lines = [...algo.pseudocode];
  const candidates = lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => /[<>]|swap|min|pivot|low|high|mid|return|j \+ 1|i \+ 1/.test(l));
  if (candidates.length === 0) return qIdentify();
  const target = pick(candidates);

  // Mutate the chosen line
  let buggy = target.l;
  if (/>/.test(buggy)) buggy = buggy.replace(/>/, "<");
  else if (/</.test(buggy)) buggy = buggy.replace(/</, ">");
  else if (/swap/.test(buggy)) buggy = buggy.replace(/swap/, "skip");
  else if (/return i/.test(buggy)) buggy = buggy.replace(/return i/, "return i + 1");
  else if (/min = j/.test(buggy)) buggy = buggy.replace(/min = j/, "min = i");
  else buggy = buggy + "  // off-by-one";

  const shown = [...lines];
  shown[target.i] = buggy;

  const lineChoices = shown
    .map((l, i) => ({ id: String(i), label: `Line ${i + 1}: ${l || "(blank)"}`, raw: l }))
    .filter(({ raw }) => raw.trim() !== "");
  const wrongOnes = lineChoices.filter((c) => c.id !== String(target.i));
  const choices = shuffle([
    lineChoices.find((c) => c.id === String(target.i))!,
    ...shuffle(wrongOnes).slice(0, 3),
  ]).map(({ id, label }) => ({ id, label }));

  return {
    type: "bug",
    tier: 2,
    prompt: `${algo.name}: one line below has a bug. Which is it?`,
    choices,
    correctId: String(target.i),
    explain: `Line ${target.i + 1} is wrong. Original: "${target.l}". Buggy: "${buggy}".`,
    pseudo: shown,
    algoName: algo.name,
  };
}

function qReorder(): BaseQ {
  // Show shuffled pseudocode, ask which option is the correct ordering (encoded as join).
  const algo = pick(ALGORITHMS);
  const lines = algo.pseudocode.filter((l) => l.trim() !== "").slice(0, 5);
  if (lines.length < 3) return qIdentify();

  const correct = lines.join(" → ");
  const opts = new Set<string>([correct]);
  while (opts.size < 4) opts.add(shuffle(lines).join(" → "));

  const choices = shuffle([...opts]).map((o, i) => ({
    id: o === correct ? "correct" : `d${i}`,
    label: o,
  }));

  return {
    type: "reorder",
    tier: 3,
    prompt: `${algo.name}: which ordering of these lines correctly describes the algorithm?`,
    choices,
    correctId: "correct",
    explain: `Correct order:\n${lines.map((l, i) => `${i + 1}. ${l}`).join("\n")}`,
    algoName: algo.name,
  };
}

function qTradeoff(): BaseQ {
  const bank: BaseQ[] = [
    {
      type: "tradeoff", tier: 3,
      prompt: "Which algorithm is the best default for sorting a huge file from disk where you can't fit it in RAM?",
      choices: shuffle([
        { id: "merge", label: "Merge Sort" },
        { id: "quick", label: "Quick Sort" },
        { id: "bubble", label: "Bubble Sort" },
        { id: "selection", label: "Selection Sort" },
      ]),
      correctId: "merge",
      explain: "Merge Sort's sequential, divide-and-conquer access pattern is the canonical external sort — chunks fit in RAM, then merged via streamed passes.",
    },
    {
      type: "tradeoff", tier: 3,
      prompt: "You need stable sorting AND guaranteed O(n log n). Which qualifies?",
      choices: shuffle([
        { id: "merge", label: "Merge Sort" },
        { id: "quick", label: "Quick Sort" },
        { id: "insertion", label: "Insertion Sort" },
        { id: "selection", label: "Selection Sort" },
      ]),
      correctId: "merge",
      explain: "Quick Sort is O(n²) worst case and unstable. Insertion/Selection are O(n²). Merge Sort gives both stability and O(n log n) worst case.",
    },
    {
      type: "tradeoff", tier: 3,
      prompt: "Data arrives one item at a time and must stay sorted as it streams in. Best choice?",
      choices: shuffle([
        { id: "insertion", label: "Insertion Sort" },
        { id: "quick", label: "Quick Sort" },
        { id: "merge", label: "Merge Sort" },
        { id: "bubble", label: "Bubble Sort" },
      ]),
      correctId: "insertion",
      explain: "Insertion Sort runs in O(n) on nearly-sorted input and inserts each new element in place — ideal for online streaming.",
    },
    {
      type: "tradeoff", tier: 3,
      prompt: "Write cost is extremely high (think: flash memory wear). Which algorithm minimizes writes?",
      choices: shuffle([
        { id: "selection", label: "Selection Sort" },
        { id: "bubble", label: "Bubble Sort" },
        { id: "merge", label: "Merge Sort" },
        { id: "quick", label: "Quick Sort" },
      ]),
      correctId: "selection",
      explain: "Selection Sort performs at most n swaps total — the lowest write count of the classic comparison sorts.",
    },
    {
      type: "tradeoff", tier: 3,
      prompt: "What's the worst-case time complexity of Quick Sort with last-element pivot on an already-sorted array?",
      choices: shuffle([
        { id: "n2", label: "O(n²)" },
        { id: "nlogn", label: "O(n log n)" },
        { id: "n", label: "O(n)" },
        { id: "logn", label: "O(log n)" },
      ]),
      correctId: "n2",
      explain: "Sorted input + last-element pivot creates maximally unbalanced partitions — every partition removes only one element, giving O(n²).",
    },
  ];
  return pick(bank);
}

const BUILDERS: Record<QType, () => BaseQ> = {
  identify: qIdentify,
  predict: qPredict,
  trace: qTrace,
  bug: qBug,
  reorder: qReorder,
  tradeoff: qTradeoff,
};

const ALL_TYPES: QType[] = ["identify", "predict", "trace", "bug", "reorder", "tradeoff"];

// ---------- Component ----------

function QuizPage() {
  const [enabledTiers, setEnabledTiers] = useState<Record<Tier, boolean>>({ 1: true, 2: true, 3: true });
  const [round, setRound] = useState<BaseQ>(() => qIdentify());
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);

  const nextRound = () => {
    const allowedTypes = ALL_TYPES.filter((t) => enabledTiers[TIER_OF[t]]);
    const type = allowedTypes.length ? pick(allowedTypes) : "identify";
    setRound(BUILDERS[type]());
    setPicked(null);
  };

  const choose = (id: string) => {
    if (picked) return;
    setPicked(id);
    const correct = id === round.correctId;
    setTotal((t) => t + 1);
    if (correct) {
      setScore((s) => s + round.tier);
      setStreak((s) => {
        const ns = s + 1;
        setBest((b) => Math.max(b, ns));
        return ns;
      });
    } else {
      setStreak(0);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Back</Link>
          <div className="flex items-center gap-4 font-mono text-xs tabular-nums text-muted-foreground">
            <span>Score <span className="text-foreground font-semibold">{score}</span></span>
            <span>Q {total}</span>
            <span>🔥 {streak} <span className="opacity-60">(best {best})</span></span>
          </div>
        </div>

        <h1 className="text-3xl font-bold tracking-tight">🎯 Sorting Quiz</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Six question types across three difficulty tiers. Harder questions are worth more points.
        </p>

        {/* Tier filters */}
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/60 p-3">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Difficulty:</span>
          {([1, 2, 3] as Tier[]).map((t) => (
            <button
              key={t}
              onClick={() => setEnabledTiers((prev) => ({ ...prev, [t]: !prev[t] }))}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                enabledTiers[t]
                  ? "border-transparent text-primary-foreground"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground"
              }`}
              style={enabledTiers[t] ? { background: TIER_COLOR[t], color: "oklch(0.12 0.04 280)" } : undefined}
            >
              {TIER_LABEL[t]}
            </button>
          ))}
        </div>

        <RoundCard round={round} picked={picked} onChoose={choose} />

        {picked && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5 animate-fade-in">
            <p className="text-sm">
              {picked === round.correctId
                ? <span className="font-semibold text-[oklch(0.78_0.18_150)]">✓ Correct (+{round.tier} pt)</span>
                : <span className="font-semibold text-[oklch(0.72_0.22_25)]">✗ Not quite</span>}
            </p>
            <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground" style={{ fontFamily: "inherit" }}>
              {round.explain}
            </pre>
            <button
              onClick={nextRound}
              className="mt-4 rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
            >
              Next question →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

// ---------- Round renderers ----------

function RoundCard({ round, picked, onChoose }: { round: BaseQ; picked: string | null; onChoose: (id: string) => void }) {
  return (
    <div className="mt-5 rounded-2xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-elegant)" }}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{ background: TIER_COLOR[round.tier], color: "oklch(0.12 0.04 280)" }}
        >
          {TIER_LABEL[round.tier]}
        </span>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{round.type}</span>
      </div>
      <p className="text-base font-medium text-foreground">{round.prompt}</p>
      {round.hint && <p className="mt-1 text-xs text-muted-foreground">Hint: {round.hint}</p>}

      {/* Visual payload */}
      {round.type === "identify" && <IdentifyAnimation algoName={round.algoName!} />}
      {round.vis && round.vis.arr.length > 0 && round.type !== "identify" && (
        <StaticBars arr={round.vis.arr} active={round.vis.active ?? []} pivot={round.vis.pivot} />
      )}
      {round.pseudo && (
        <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-background/60 p-3 text-[12px] leading-relaxed"
          style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
          {round.pseudo.map((l, i) => (
            <div key={i}><span className="mr-2 inline-block w-6 text-right text-muted-foreground">{i + 1}</span>{l || " "}</div>
          ))}
        </pre>
      )}

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {round.choices.map((c) => {
          const isAnswer = picked && c.id === round.correctId;
          const isWrong = picked === c.id && c.id !== round.correctId;
          return (
            <button
              key={c.id}
              onClick={() => onChoose(c.id)}
              disabled={!!picked}
              className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                isAnswer ? "border-[oklch(0.72_0.18_150)] bg-[oklch(0.72_0.18_150/0.15)]" :
                isWrong ? "border-[oklch(0.68_0.2_25)] bg-[oklch(0.68_0.2_25/0.15)]" :
                "border-border bg-card hover:bg-secondary"
              } ${picked && !isAnswer && !isWrong ? "opacity-50" : ""}`}
            >
              {c.label}
              {isAnswer && <span className="ml-2 text-[oklch(0.72_0.18_150)]">✓</span>}
              {isWrong && <span className="ml-2 text-[oklch(0.68_0.2_25)]">✗</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StaticBars({ arr, active, pivot }: { arr: number[]; active: number[]; pivot?: number }) {
  const max = Math.max(...arr, 1);
  return (
    <div className="mt-4 flex h-56 items-stretch gap-1 rounded-lg border border-border bg-background/40 p-3">
      {arr.map((v, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end">
          <span className="mb-1 text-[9px] font-mono text-muted-foreground tabular-nums">{v}</span>
          <div
            className="w-full rounded-t-md min-h-[4px]"
            style={{
              height: `${Math.max(4, (v / max) * 100)}%`,
              background: i === pivot
                ? "linear-gradient(180deg, oklch(0.92 0.18 90), oklch(0.7 0.2 60))"
                : active.includes(i)
                  ? "linear-gradient(180deg, oklch(0.82 0.18 195), oklch(0.55 0.18 195))"
                  : "linear-gradient(180deg, oklch(0.72 0.2 280), oklch(0.5 0.2 275))",
            }}
          />
          <span className="mt-0.5 text-[9px] font-mono text-muted-foreground">{i}</span>
        </div>
      ))}
    </div>
  );
}

function IdentifyAnimation({ algoName }: { algoName: string }) {
  const algo = useMemo(() => ALGORITHMS.find((a) => a.name === algoName)!, [algoName]);
  const steps = useMemo(() => algo.run(randArray(14)), [algo]);
  const [idx, setIdx] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);

  useEffect(() => {
    setIdx(0);
    const tick = (t: number) => {
      if (t - lastRef.current >= 90) {
        lastRef.current = t;
        setIdx((i) => (i >= steps.length - 1 ? i : i + 1));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [steps]);

  const s = steps[idx];
  const arr = s?.array ?? [];
  const max = Math.max(...arr, 1);
  const active = new Set(s?.indices ?? []);
  return (
    <div className="mt-4">
      <div className="flex h-56 items-end gap-1 rounded-lg border border-border bg-background/40 p-3">
        {arr.map((v, i) => (
          <div key={i} className="flex-1 rounded-t-md transition-[height] duration-150"
            style={{
              height: `${(v / max) * 100}%`,
              background: active.has(i)
                ? "linear-gradient(180deg, oklch(0.82 0.18 195), oklch(0.55 0.18 195))"
                : "linear-gradient(180deg, oklch(0.72 0.2 280), oklch(0.5 0.2 275))",
            }} />
        ))}
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full transition-all"
          style={{ width: `${steps.length > 1 ? (idx / (steps.length - 1)) * 100 : 0}%`, background: "var(--gradient-primary)" }} />
      </div>
    </div>
  );
}
