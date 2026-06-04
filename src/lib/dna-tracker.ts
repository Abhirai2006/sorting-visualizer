// Session-scoped activity tracker for the "Sort DNA" footer.
// Uses sessionStorage so a single tab/session is tracked.
// Visitor counter uses localStorage for persistence.

export const TOTAL_ALGOS = 5;
const KEY = "sortlab:dna:v1";
const VISITOR_KEY = "sortlab:visitor:v1";
const SESSION_FLAG = "sortlab:sess:v1";

export interface DnaState {
  algosVisited: string[];           // unique algo ids viewed
  algoUsage: Record<string, number>;// step views per algo (for "loyalist")
  pseudoViews: number;
  stepsAdvanced: number;
  racesRun: number;
  replays: number;
  slowDwellTicks: number;           // each tick = 2s spent on a single step
  startedAt: number;
}

const empty = (): DnaState => ({
  algosVisited: [],
  algoUsage: {},
  pseudoViews: 0,
  stepsAdvanced: 0,
  racesRun: 0,
  replays: 0,
  slowDwellTicks: 0,
  startedAt: Date.now(),
});

const safeGet = (): DnaState => {
  if (typeof window === "undefined") return empty();
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return empty();
    return { ...empty(), ...JSON.parse(raw) };
  } catch {
    return empty();
  }
};

const save = (s: DnaState) => {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  window.dispatchEvent(new CustomEvent("dna:update"));
};

export const getDna = safeGet;

export const updateDna = (mut: (s: DnaState) => void) => {
  const s = safeGet();
  mut(s);
  save(s);
};

export const resetDna = () => save(empty());

export const trackAlgo = (id: string) => updateDna((s) => {
  if (!s.algosVisited.includes(id)) s.algosVisited.push(id);
  s.algoUsage[id] = (s.algoUsage[id] ?? 0) + 1;
});

export const trackStep = () => updateDna((s) => { s.stepsAdvanced += 1; });
export const trackPseudo = () => updateDna((s) => { s.pseudoViews += 1; });
export const trackRace = () => updateDna((s) => { s.racesRun += 1; });
export const trackReplay = () => updateDna((s) => { s.replays += 1; });
export const trackSlowTick = () => updateDna((s) => { s.slowDwellTicks += 1; });

// ---- Visitor counter (localStorage) ----
export interface VisitorState { total: number; }
export const bumpVisitor = (): VisitorState => {
  if (typeof window === "undefined") return { total: 0 };
  let total = 0;
  try {
    total = Number(localStorage.getItem(VISITOR_KEY) ?? "0") || 0;
    if (!sessionStorage.getItem(SESSION_FLAG)) {
      total += 1;
      localStorage.setItem(VISITOR_KEY, String(total));
      sessionStorage.setItem(SESSION_FLAG, "1");
    }
  } catch {}
  return { total };
};

// ---- Scoring ----
export interface DnaScores {
  curiosity: number;
  speed: number;
  breadth: number;
  race: number;
}

export const scoreDna = (s: DnaState): DnaScores => {
  const curiosity = Math.min(100,
    s.algosVisited.length * 10 + s.pseudoViews * 2 + s.stepsAdvanced * 1
  );
  const speed = Math.max(0, 100 - s.slowDwellTicks);
  const breadth = Math.min(100, Math.round((s.algosVisited.length / TOTAL_ALGOS) * 100));
  const race = Math.min(100, s.racesRun * 20 + s.replays * 10);
  return { curiosity, speed, breadth, race };
};

export type PersonalityKey =
  | "explorer" | "deepdiver" | "speedrunner" | "loyalist" | "completionist" | "chaotic";

export interface Personality {
  key: PersonalityKey;
  title: string;
  blurb: string;
}

export const derivePersonality = (sc: DnaScores, s: DnaState): Personality => {
  const usages = Object.values(s.algoUsage);
  const topUsage = Math.max(0, ...usages);
  const oneAlgoDominant = topUsage > 0 && sc.breadth < 50 && topUsage / Math.max(1, s.stepsAdvanced) > 0.7;
  const balanced = [sc.curiosity, sc.speed, sc.breadth, sc.race].every((v) => v >= 55);

  if (balanced) return { key: "completionist", title: "The Completionist", blurb: "suspiciously thorough" };
  if (sc.race >= 40 && sc.speed >= 60) return { key: "chaotic", title: "The Chaotic One", blurb: "just vibing, honestly" };
  if (sc.race >= 60 && sc.speed >= 50) return { key: "speedrunner", title: "The Speedrunner", blurb: "here for the chaos, not the theory" };
  if (oneAlgoDominant) return { key: "loyalist", title: "The Loyalist", blurb: "found their algo and never left" };
  if (sc.curiosity >= 50 && sc.speed < 50) return { key: "deepdiver", title: "The Deep Diver", blurb: "slow, methodical, obsessed" };
  if (sc.curiosity >= 40 && sc.breadth >= 40) return { key: "explorer", title: "The Explorer", blurb: "tries everything, skips nothing" };
  return { key: "explorer", title: "The Explorer", blurb: "tries everything, skips nothing" };
};
