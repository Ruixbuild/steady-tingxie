"use client";

import { useEffect, useState } from "react";

const COLORS = ["var(--go)", "var(--accent)", "var(--ok)", "var(--warn)"];

type Piece = {
  left: number;
  delay: number;
  duration: number;
  color: string;
  rotate: number;
};

export default function Confetti({ onDone }: { onDone?: () => void }) {
  const [pieces, setPieces] = useState<Piece[] | null>(null);

  useEffect(() => {
    // Randomized burst layout must only be generated once, client-side,
    // after mount — never during render (would be impure / hydration-unsafe).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPieces(
      Array.from({ length: 40 }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.3,
        duration: 1.4 + Math.random() * 0.8,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotate: Math.random() * 360,
      }))
    );
    const timer = setTimeout(() => onDone?.(), 2200);
    return () => clearTimeout(timer);
  }, [onDone]);

  if (!pieces) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 60,
      }}
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: -20,
            left: `${p.left}%`,
            width: 8,
            height: 8,
            background: p.color,
            borderRadius: 2,
            transform: `rotate(${p.rotate}deg)`,
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          to {
            top: 100%;
            transform: translateY(0) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
