"use client";

import { motion } from "framer-motion";

type SpinnerVariant = "dna" | "coin" | "task" | "earnings" | "hub";
type SpinnerSize = "sm" | "md" | "lg" | "xl";

interface SpinnerProps {
  variant?: SpinnerVariant;
  size?: SpinnerSize;
  label?: string;
  className?: string;
}

const sizes: Record<SpinnerSize, number> = { sm: 32, md: 52, lg: 72, xl: 108 };

// brand palette
const P = "#004030"; // primary deep green
const S = "#4A9782"; // secondary teal
const A = "#DCD0A8"; // accent warm sand
const BG = "#FFF9E5"; // cream

// ── DNA: glowing double helix (kept from before) ─────────────────────────────
function DNASpinner({ size }: { size: number }) {
  const nodes = 8;
  const nodeSize = size * 0.1;
  return (
    <div
      style={{ width: size * 0.6, height: size }}
      className="relative overflow-hidden"
    >
      {Array.from({ length: nodes }).map((_, i) => {
        const progress = i / (nodes - 1);
        const delay = -progress * 1.4;
        return (
          <div
            key={i}
            className="absolute w-full flex justify-between items-center"
            style={{ top: `${progress * 85}%` }}
          >
            <motion.span
              className="rounded-full"
              style={{
                width: nodeSize,
                height: nodeSize,
                background: S,
                boxShadow: `0 0 ${nodeSize * 2}px ${S}`,
              }}
              animate={{
                x: [0, size * 0.22, 0],
                scaleX: [1, 0.15, 1],
                opacity: [1, 0.15, 1],
              }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                ease: "easeInOut",
                delay,
              }}
            />
            <motion.span
              className="flex-1 mx-1"
              style={{
                height: 1.5,
                background: `linear-gradient(90deg,${S},${A})`,
              }}
              animate={{ scaleX: [1, 0.04, 1], opacity: [0.5, 0.04, 0.5] }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                ease: "easeInOut",
                delay,
              }}
            />
            <motion.span
              className="rounded-full"
              style={{
                width: nodeSize,
                height: nodeSize,
                background: A,
                boxShadow: `0 0 ${nodeSize * 2}px ${A}`,
              }}
              animate={{
                x: [0, -size * 0.22, 0],
                scaleX: [1, 0.15, 1],
                opacity: [1, 0.15, 1],
              }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                ease: "easeInOut",
                delay,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── COIN: TaskHub coin flipping in 3D ────────────────────────────────────────
// Represents the coin economy at the heart of the platform.
function CoinSpinner({ size }: { size: number }) {
  const r = size * 0.42;
  const thickness = size * 0.08;
  return (
    <div
      style={{ width: size, height: size, perspective: size * 4 }}
      className="flex items-center justify-center"
    >
      <motion.div
        style={{
          width: r * 2,
          height: r * 2,
          transformStyle: "preserve-3d",
          position: "relative",
        }}
        animate={{ rotateY: [0, 360] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* front face */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 35%, ${A}, #b8a87a)`,
            boxShadow: `0 0 0 ${thickness}px #b8a87a, 0 ${size * 0.04}px ${size * 0.12}px rgba(0,64,48,0.35)`,
            backfaceVisibility: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: r * 0.55,
              fontWeight: 900,
              color: P,
              fontFamily: "Manrope, sans-serif",
              letterSpacing: "-0.04em",
              userSelect: "none",
            }}
          >
            T
          </span>
        </div>
        {/* back face */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: `radial-gradient(circle at 65% 65%, ${A}, #c9b98e)`,
            boxShadow: `0 0 0 ${thickness}px #b8a87a`,
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: r * 0.38,
              fontWeight: 700,
              color: P,
              userSelect: "none",
            }}
          >
            HUB
          </span>
        </div>
      </motion.div>
      {/* shadow on ground */}
      <motion.div
        style={{
          position: "absolute",
          bottom: size * 0.04,
          width: r * 1.4,
          height: size * 0.06,
          borderRadius: "50%",
          background: `rgba(0,64,48,0.15)`,
          filter: `blur(${size * 0.04}px)`,
        }}
        animate={{ scaleX: [1, 0.15, 1], opacity: [0.5, 0.1, 0.5] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

// ── TASK: animated checklist — tasks being ticked off ────────────────────────
// Represents the core action: workers completing tasks.
function TaskSpinner({ size }: { size: number }) {
  const items = 4;
  const rowH = size / (items + 1);
  const checkSize = rowH * 0.55;
  return (
    <div
      style={{ width: size * 1.1, height: size }}
      className="relative flex flex-col justify-center gap-0"
    >
      {Array.from({ length: items }).map((_, i) => (
        <motion.div
          key={i}
          className="flex items-center gap-2"
          style={{ height: rowH }}
          initial={{ opacity: 0, x: -size * 0.1 }}
          animate={{ opacity: [0, 1, 1, 0.3], x: [-size * 0.08, 0, 0, 0] }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            delay: i * 0.45,
            ease: "easeOut",
          }}
        >
          {/* checkbox */}
          <motion.div
            style={{
              width: checkSize,
              height: checkSize,
              borderRadius: checkSize * 0.28,
              border: `2px solid ${S}`,
              flexShrink: 0,
              position: "relative",
              background: BG,
            }}
            animate={{
              backgroundColor: [BG, S, S, BG],
              borderColor: [S, S, S, S],
            }}
            transition={{
              duration: 2.4,
              repeat: Infinity,
              delay: i * 0.45 + 0.3,
            }}
          >
            {/* checkmark path */}
            <motion.svg
              viewBox="0 0 12 12"
              style={{ position: "absolute", inset: 2 }}
              initial={{ pathLength: 0 }}
            >
              <motion.path
                d="M2 6 L5 9 L10 3"
                fill="none"
                stroke={BG}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                animate={{ pathLength: [0, 1, 1, 0] }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  delay: i * 0.45 + 0.4,
                  ease: "easeInOut",
                }}
              />
            </motion.svg>
          </motion.div>
          {/* task line */}
          <div
            style={{
              flex: 1,
              height: rowH * 0.22,
              borderRadius: 99,
              background: `${P}18`,
              overflow: "hidden",
            }}
          >
            <motion.div
              style={{
                height: "100%",
                background: S,
                borderRadius: 99,
                transformOrigin: "left",
              }}
              animate={{
                scaleX: [0, 0.85, 0.85, 0.85],
                opacity: [0, 1, 1, 0.4],
              }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                delay: i * 0.45 + 0.2,
              }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── EARNINGS: coins raining into a wallet ────────────────────────────────────
// Represents workers earning and withdrawing coins.
function EarningsSpinner({ size }: { size: number }) {
  const coinCount = 6;
  const walletW = size * 0.7;
  const walletH = size * 0.42;
  const coinR = size * 0.09;

  return (
    <div
      style={{ width: size, height: size }}
      className="relative flex items-end justify-center"
    >
      {/* falling coins */}
      {Array.from({ length: coinCount }).map((_, i) => {
        const xOffset = (i / (coinCount - 1) - 0.5) * walletW * 0.7;
        return (
          <motion.div
            key={i}
            style={{
              position: "absolute",
              width: coinR * 2,
              height: coinR * 2,
              borderRadius: "50%",
              background: `radial-gradient(circle at 35% 35%, ${A}, #b8a87a)`,
              border: `${coinR * 0.18}px solid #b8a87a`,
              left: "50%",
              marginLeft: -coinR + xOffset,
              top: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: coinR * 0.9,
              fontWeight: 900,
              color: P,
            }}
            animate={{
              y: [0, size * 0.52, size * 0.52],
              opacity: [0, 1, 0],
              scaleY: [1, 1, 0.1],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: ["easeIn", "easeIn", "easeIn"],
            }}
          >
            ¢
          </motion.div>
        );
      })}

      {/* wallet body */}
      <div
        style={{
          width: walletW,
          height: walletH,
          borderRadius: size * 0.08,
          background: P,
          position: "relative",
          overflow: "hidden",
          boxShadow: `0 ${size * 0.04}px ${size * 0.12}px rgba(0,64,48,0.3)`,
        }}
      >
        {/* wallet slot */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: walletW * 0.35,
            height: size * 0.04,
            background: `${S}88`,
            borderRadius: "0 0 99px 99px",
          }}
        />
        {/* wallet clasp */}
        <div
          style={{
            position: "absolute",
            right: walletW * 0.1,
            top: "50%",
            transform: "translateY(-50%)",
            width: walletH * 0.45,
            height: walletH * 0.45,
            borderRadius: "50%",
            background: S,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "45%",
              height: "45%",
              borderRadius: "50%",
              background: P,
            }}
          />
        </div>
        {/* fill level animating */}
        <motion.div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: `${S}33`,
            borderRadius: `0 0 ${size * 0.08}px ${size * 0.08}px`,
          }}
          animate={{ height: ["10%", "55%", "10%"] }}
          transition={{
            duration: 1.2 * coinCount * 0.2 + 1.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>
    </div>
  );
}

// ── HUB: buyer → task → worker → coin cycle ──────────────────────────────────
// Represents the full TaskHub marketplace loop in one visual.
function HubSpinner({ size }: { size: number }) {
  const r = size * 0.36; // orbit radius
  const nodeR = size * 0.1; // node circle radius
  const cx = size / 2;
  const cy = size / 2;

  // 4 nodes: Buyer (top), Task (right), Worker (bottom), Coin (left)
  const nodes = [
    { label: "B", color: P, angle: -90, title: "Buyer" },
    { label: "✓", color: S, angle: 0, title: "Task" },
    { label: "W", color: P, angle: 90, title: "Worker" },
    { label: "¢", color: A, angle: 180, title: "Coin" },
  ];

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  return (
    <div style={{ width: size, height: size }} className="relative">
      {/* orbit ring */}
      <svg
        style={{ position: "absolute", inset: 0 }}
        width={size}
        height={size}
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={`${P}18`}
          strokeWidth={1.5}
          strokeDasharray="4 6"
        />
        {/* animated arc highlight */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={S}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={`${r * 0.8} ${r * 10}`}
          animate={{ strokeDashoffset: [0, -r * 2 * Math.PI] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />
      </svg>

      {/* orbiting dot */}
      <motion.div
        style={{
          position: "absolute",
          width: nodeR * 0.55,
          height: nodeR * 0.55,
          borderRadius: "50%",
          background: A,
          boxShadow: `0 0 ${nodeR}px ${A}`,
          top: cy - nodeR * 0.275,
          left: cx - nodeR * 0.275,
        }}
        animate={{
          x: Array.from(
            { length: 121 },
            (_, t) => r * Math.cos(toRad((t / 120) * 360 - 90)),
          ),
          y: Array.from(
            { length: 121 },
            (_, t) => r * Math.sin(toRad((t / 120) * 360 - 90)),
          ),
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      />

      {/* nodes */}
      {nodes.map((n, i) => {
        const x = cx + r * Math.cos(toRad(n.angle));
        const y = cy + r * Math.sin(toRad(n.angle));
        return (
          <motion.div
            key={i}
            style={{
              position: "absolute",
              width: nodeR * 2,
              height: nodeR * 2,
              borderRadius: "50%",
              background: n.color,
              border: `2px solid ${n.color === A ? "#b8a87a" : S}`,
              top: y - nodeR,
              left: x - nodeR,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: nodeR * 0.85,
              fontWeight: 800,
              color: n.color === P ? BG : P,
              boxShadow: `0 0 ${nodeR * 1.2}px ${n.color}66`,
            }}
            animate={{ scale: [1, 1.18, 1] }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.75,
            }}
          >
            {n.label}
          </motion.div>
        );
      })}

      {/* center hub dot */}
      <motion.div
        style={{
          position: "absolute",
          width: nodeR * 1.1,
          height: nodeR * 1.1,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${S}, ${P})`,
          top: cy - nodeR * 0.55,
          left: cx - nodeR * 0.55,
          boxShadow: `0 0 ${nodeR * 1.5}px ${S}88`,
        }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────
export default function Spinner({
  variant = "hub",
  size = "md",
  label,
  className = "",
}: SpinnerProps) {
  const px = sizes[size];

  const map: Record<SpinnerVariant, React.ReactNode> = {
    dna: <DNASpinner size={px} />,
    coin: <CoinSpinner size={px} />,
    task: <TaskSpinner size={px} />,
    earnings: <EarningsSpinner size={px} />,
    hub: <HubSpinner size={px} />,
  };

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
    >
      {map[variant]}
      {label && (
        <motion.p
          className="text-xs font-semibold tracking-[0.2em] uppercase"
          style={{ color: S }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          {label}
        </motion.p>
      )}
    </div>
  );
}
