import { useState } from "react";

interface Props {
  onEnter: () => void;
}

/**
 * Full-screen splash entry. User must click "Enter" to proceed.
 * Gradient button CSS (from Uiverse.io by dexter-st) and GitHub cube
 * (from Uiverse.io by Philippcmd) are scoped via the .splash-* class prefix
 * to avoid leaking globally.
 */
export default function SplashScreen({ onEnter }: Props) {
  const [leaving, setLeaving] = useState(false);

  const handleEnter = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onEnter, 650);
  };

  return (
    <div
      className={`fixed inset-0 z-[120] flex flex-col items-center justify-center transition-opacity duration-700 ${
        leaving ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ background: "#0a0a0a" }}
    >
      {/* Starfield + shooting stars */}
      <div className="splash-stars" />
      <div className="splash-shoot" />
      <div className="splash-shoot s2" />
      <div className="splash-shoot s3" />

      {/* Subtle aurora glow behind content */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 40%, oklch(0.32 0.16 280 / 0.45), transparent 70%), radial-gradient(ellipse 40% 30% at 50% 80%, oklch(0.28 0.16 195 / 0.35), transparent 70%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-6">
        <h1
          className="font-display text-6xl md:text-8xl font-extrabold tracking-tight text-white leading-none"
          style={{ textShadow: "0 0 40px oklch(0.62 0.22 275 / 0.6)" }}
          aria-label="O(patience)"
        >
          <span className="splash-type">
            O<span className="font-serif italic font-medium text-white/85">(patience)</span>
          </span>
          <span className="splash-caret" />
        </h1>
        <p
          className="mt-5 font-mono text-sm md:text-base uppercase tracking-[0.4em] text-white/55 splash-fade-up"
          style={{ animationDelay: "1.7s" }}
        >
          Visualize. Compare. Understand.
        </p>

        <div
          className="mt-12 splash-btn-wrapper splash-fade-up"
          style={{ animationDelay: "2.1s" }}
          onClick={handleEnter}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleEnter(); }}
        >
          <div className="splash-light" />
          <div className="splash-gradient-layer" />
          <div className="splash-gradient-layer" />
          <button type="button" className="splash-gradient-btn">Enter</button>
          <div className="splash-text-overlay">Enter</div>
        </div>

        <p
          className="mt-8 font-mono text-[10px] uppercase tracking-[0.3em] text-white/30 splash-fade-up"
          style={{ animationDelay: "2.4s" }}
        >
          a sorting playground · made by{" "}
          <span className="font-serif italic text-white/70 normal-case tracking-normal text-xs">
            Abhirai
          </span>
        </p>
      </div>
    </div>

  );
}
