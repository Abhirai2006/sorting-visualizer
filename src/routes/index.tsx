import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import Visualizer from "@/components/Visualizer";
import Compare from "@/components/Compare";
import CursorGlow from "@/components/CursorGlow";
import Signature from "@/components/Signature";
import SortingLoader from "@/components/SortingLoader";
import SplashScreen from "@/components/SplashScreen";
import Tilt from "@/components/Tilt";
import { useReveal } from "@/hooks/use-reveal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "O(patience) — Sorting Algorithm Visualizer" },
      { name: "description", content: "Step through five classic sorting algorithms with live pointers, stats, pseudocode and side-by-side benchmarks." },
      { property: "og:title", content: "O(patience) — Sorting Algorithm Visualizer" },
      { property: "og:description", content: "Visualize Bubble, Selection, Insertion, Merge and Quick sort step by step." },
    ],
  }),
  component: Index,
});

function Index() {
  // Flow: Splash (click to Enter) → Hourglass loader (1.5s) → Main app
  // Splash only shows once per session — coming back from /quiz shouldn't replay it.
  const seen = typeof window !== "undefined" && sessionStorage.getItem("opatience-splash-seen") === "1";
  const [splash, setSplash] = useState(!seen);
  const [loading, setLoading] = useState(false);
  const [contentIn, setContentIn] = useState(seen);
  const compareRef = useReveal<HTMLDivElement>();

  // Loader is bounded — exactly ~1.5s after splash dismissed
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => {
      setLoading(false);
      setContentIn(true);
    }, 1500);
    return () => clearTimeout(t);
  }, [loading]);

  return (
    <>
      {splash && (
        <SplashScreen
          onEnter={() => {
            try { sessionStorage.setItem("opatience-splash-seen", "1"); } catch {}
            setSplash(false);
            setLoading(true);
          }}
        />
      )}
      {loading && <SortingLoader onDone={() => { /* timer in effect drives it */ }} />}

      <main className="animated-bg min-h-screen text-foreground">
        <CursorGlow />
        <Signature />
        <div
          className="relative z-10 mx-auto max-w-6xl px-4 py-10 md:py-16 transition-opacity duration-700"
          style={{ opacity: splash || loading ? 0 : 1 }}
        >
          <header
            className="relative mb-10 md:mb-14 transition-all duration-700"
            style={{
              opacity: contentIn ? 1 : 0,
              transform: contentIn ? "translateY(0)" : "translateY(20px)",
            }}
          >
            {/* Ambient floating orbs */}
            <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
              <div className="orb orb-a" style={{ top: "-40px", left: "-60px", width: 260, height: 260, background: "oklch(0.62 0.22 275 / 0.55)" }} />
              <div className="orb orb-b" style={{ top: "40px", right: "-80px", width: 320, height: 320, background: "oklch(0.72 0.18 195 / 0.45)" }} />
              <div className="orb orb-c" style={{ bottom: "-80px", left: "30%", width: 280, height: 280, background: "oklch(0.55 0.2 320 / 0.4)" }} />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Tilt max={15} className="rounded-xl">
                  <div
                    className="h-10 w-10 rounded-xl"
                    style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
                    aria-hidden
                  />
                </Tilt>
                <span className="font-medium tracking-tight text-muted-foreground flex items-baseline title-float">
                  <span
                    className="font-display text-3xl md:text-4xl font-extrabold leading-none title-shimmer"
                    style={{
                      background: "var(--gradient-primary)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    O
                  </span>
                  <span className="font-serif italic text-xs md:text-sm lowercase tracking-wide opacity-80">(patience)</span>
                </span>
              </div>
              <Link
                to="/quiz"
                className="rounded-full glass px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary hover:scale-105"
              >
                🎯 Quiz mode →
              </Link>
            </div>

            {/* Glass hero card */}
            <Tilt max={6} className="mt-8 block">
              <div className="glass-pop px-6 py-10 md:px-12 md:py-14">
                <h1 className="font-display text-4xl font-extrabold tracking-tight md:text-6xl leading-[1.05]">
                  {["See", "how", "sorting"].map((w, i) => (
                    <span key={i} className="word-rise mr-3" style={{ animationDelay: `${i * 120}ms` }}>
                      {w}
                    </span>
                  ))}
                  <span
                    className="word-rise italic font-serif mr-3"
                    style={{
                      animationDelay: "360ms",
                      background: "var(--gradient-primary)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    actually works
                  </span>
                  <span className="word-rise" style={{ animationDelay: "480ms" }}>.</span>
                </h1>
                <p
                  className="mt-5 max-w-2xl text-base text-muted-foreground md:text-lg word-rise"
                  style={{ animationDelay: "640ms" }}
                >
                  Step through the inner loop of five classic algorithms. Watch every
                  compare, swap and write — with live complexity and stats.
                </p>
              </div>
            </Tilt>
          </header>


          <h2 className="sr-only">Algorithm Visualizer</h2>
          <div
            className="transition-all duration-700 delay-200"
            style={{
              opacity: contentIn ? 1 : 0,
              transform: contentIn ? "translateY(0)" : "translateY(30px)",
            }}
          >
            <Visualizer />
          </div>

          <div className="my-16 h-px w-full" style={{ background: "linear-gradient(to right, transparent, oklch(0.28 0.05 275), transparent)" }} />

          <div ref={compareRef}>
            <Compare />
          </div>

          <footer className="mt-16 border-t border-border pt-6 text-xs text-muted-foreground">
            Built for curious minds. Use ← / → to step through, Space to play.
          </footer>
        </div>
      </main>
    </>
  );
}
