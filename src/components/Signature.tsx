import { useState } from "react";

export default function Signature() {
  const [hover, setHover] = useState(false);
  return (
    <div
      className="fixed bottom-0 right-0 z-50 p-4"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* invisible hover hotspot */}
      <div className="relative h-10 w-32">
        <div
          className={`absolute bottom-0 right-0 whitespace-nowrap rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-medium backdrop-blur transition-all duration-300 ${
            hover ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
          }`}
          style={{ boxShadow: "var(--shadow-elegant)" }}
        >
          <span className="text-muted-foreground">made by </span>
          <span
            style={{
              background: "var(--gradient-primary)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
            className="font-signature text-lg"
          >
            Abhirai
          </span>
        </div>
        {/* tiny dot hint */}
        <div
          className={`absolute bottom-2 right-2 h-2 w-2 rounded-full transition-opacity ${
            hover ? "opacity-0" : "opacity-60"
          }`}
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
        />
      </div>
    </div>
  );
}
