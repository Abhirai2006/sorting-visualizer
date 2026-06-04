import { useEffect, useState } from "react";

const COLORS = [
  "oklch(0.72 0.2 280)",
  "oklch(0.78 0.18 195)",
  "oklch(0.88 0.18 90)",
  "oklch(0.72 0.18 150)",
  "oklch(0.78 0.18 330)",
];

interface Piece {
  id: number;
  x: number;
  delay: number;
  dur: number;
  rot: number;
  color: string;
  shape: "rect" | "circle";
}

export default function Confetti({ trigger }: { trigger: number }) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (!trigger) return;
    const next: Piece[] = Array.from({ length: 80 }, (_, i) => ({
      id: trigger * 1000 + i,
      x: Math.random() * 100,
      delay: Math.random() * 200,
      dur: 1400 + Math.random() * 1200,
      rot: Math.random() * 720 - 360,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: Math.random() > 0.5 ? "rect" : "circle",
    }));
    setPieces(next);
    const t = setTimeout(() => setPieces([]), 3000);
    return () => clearTimeout(t);
  }, [trigger]);

  if (pieces.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(var(--rot,360deg)); opacity: 0.6; }
        }
      `}</style>
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: 0,
            width: p.shape === "rect" ? 8 : 7,
            height: p.shape === "rect" ? 14 : 7,
            background: p.color,
            borderRadius: p.shape === "circle" ? "50%" : 2,
            // @ts-ignore
            "--rot": `${p.rot}deg`,
            animation: `confetti-fall ${p.dur}ms ${p.delay}ms cubic-bezier(0.2,0.7,0.3,1) forwards`,
            boxShadow: `0 0 8px ${p.color}`,
          }}
        />
      ))}
    </div>
  );
}
